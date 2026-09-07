// cspell:ignore errcode
import { randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  lstatSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  type Stats,
} from "node:fs";
import { uptime } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

function privateFile(file: string): Stats {
  const info = lstatSync(file);
  if (!info.isFile() || info.nlink !== 1 || (process.getuid && info.uid !== process.getuid())) {
    throw new Error("DATA_DIRECTORY_LOCK_UNSAFE: lock must be an owned regular file without links");
  }
  return info;
}

function sameFile(left: Stats, right: Stats): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function bootEpoch(): number {
  return Math.floor(Date.now() / 1000 - uptime());
}

function legacyOwnerIsDead(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const holder = value as { pid?: unknown; bootEpoch?: unknown };
  if (
    typeof holder.pid !== "number" ||
    !Number.isInteger(holder.pid) ||
    holder.pid <= 0 ||
    typeof holder.bootEpoch !== "number" ||
    !Number.isFinite(holder.bootEpoch) ||
    holder.bootEpoch <= 0
  )
    return false;
  if (Math.abs(holder.bootEpoch - bootEpoch()) > 3) return true;
  try {
    process.kill(holder.pid, 0);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ESRCH";
  }
}

/** SQLite owns the process lock. Its persistent inode must never be removed or
 * replaced; crash recovery releases the OS lock without deleting a stale claim.
 * The JSON marker only protects ordinary older clients. Upgrades must be offline:
 * old clients do not participate in this protocol's recovery serialization. */
export function acquireDataDirectoryLock(dataDirectory: string): () => void {
  const lockPath = path.join(dataDirectory, ".nimanto-lock.sqlite");
  // Keep creation and close synchronous: closing an unrelated descriptor of the
  // same inode while this process holds a POSIX lock can release that lock.
  // Never open/close an existing sidecar outside SQLite.
  try {
    closeSync(openSync(lockPath, "wx", 0o600));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const inode = privateFile(lockPath);
  chmodSync(lockPath, 0o600);
  const lock = new DatabaseSync(lockPath, { timeout: 250 });
  const marker = path.join(dataDirectory, ".nimanto-lock");
  const payload = JSON.stringify({
    pid: process.pid,
    bootEpoch: bootEpoch(),
    protocol: "sqlite_v1",
    token: randomUUID(),
  });
  const temporaryMarker = `${marker}.${randomUUID()}`;
  try {
    lock.exec("BEGIN EXCLUSIVE");
    if (!sameFile(inode, privateFile(lockPath)))
      throw new Error("DATA_DIRECTORY_LOCK_UNSAFE: sidecar changed during acquisition");
    try {
      privateFile(marker);
      const raw = readFileSync(marker, "utf8");
      let holder: unknown;
      try {
        holder = JSON.parse(raw);
      } catch {
        holder = null;
      }
      // A previous new-protocol process can no longer own this directory once
      // our exclusive transaction succeeds. Unknown legacy claims fail closed.
      const currentProtocol =
        typeof holder === "object" &&
        holder !== null &&
        "protocol" in holder &&
        holder.protocol === "sqlite_v1" &&
        "token" in holder &&
        typeof holder.token === "string" &&
        /^[a-f0-9-]{36}$/u.test(holder.token) &&
        "pid" in holder &&
        typeof holder.pid === "number" &&
        Number.isInteger(holder.pid) &&
        holder.pid > 0 &&
        "bootEpoch" in holder &&
        typeof holder.bootEpoch === "number" &&
        Number.isFinite(holder.bootEpoch) &&
        holder.bootEpoch > 0;
      if (!currentProtocol && !legacyOwnerIsDead(holder)) {
        throw new Error(
          "DATA_DIRECTORY_IN_USE: live or unknown legacy owner; stop all older Nimanto processes before upgrading",
        );
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    // Publish complete metadata atomically, while the kernel lock serializes
    // both acquisition and stale-marker recovery.
    writeFileSync(temporaryMarker, payload, { flag: "wx", mode: 0o600 });
    renameSync(temporaryMarker, marker);
  } catch (error) {
    lock.close();
    try {
      unlinkSync(temporaryMarker);
    } catch {
      /* No published temporary claim. */
    }
    const sqliteCode = (error as { errcode?: number }).errcode;
    if (sqliteCode === 5 || sqliteCode === 6) {
      throw new Error(
        "DATA_DIRECTORY_IN_USE: another Nimanto process has this data directory open",
      );
    }
    throw error;
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    try {
      if (!sameFile(inode, privateFile(lockPath)))
        throw new Error("DATA_DIRECTORY_LOCK_UNSAFE: sidecar changed while held");
      try {
        privateFile(marker);
        if (readFileSync(marker, "utf8") === payload) unlinkSync(marker);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    } finally {
      lock.close();
    }
  };
}
