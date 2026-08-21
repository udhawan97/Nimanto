import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function verifyChecksumManifest(manifestPath, expectedArtifactPaths = []) {
  const directory = path.dirname(manifestPath);
  const lines = (await readFile(manifestPath, "utf8")).trim().split("\n").filter(Boolean);
  const failures = [];
  const entries = new Map();

  for (const line of lines) {
    const match = /^([0-9a-f]{64}) {2}([^/\\]+)$/u.exec(line);
    if (!match) {
      failures.push(
        `${path.basename(manifestPath)}: malformed checksum line ${JSON.stringify(line)}`,
      );
      continue;
    }
    entries.set(match[2], match[1]);
  }

  const expectedNames = expectedArtifactPaths.map((artifactPath) => path.basename(artifactPath));
  if (expectedNames.length > 0) {
    const actualNames = [...entries.keys()].toSorted();
    if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames.toSorted())) {
      failures.push(
        `${path.basename(manifestPath)}: expected exactly ${expectedNames.toSorted().join(", ")}; found ${actualNames.join(", ")}`,
      );
    }
  }

  for (const [name, expected] of entries) {
    try {
      const actual = createHash("sha256")
        .update(await readFile(path.join(directory, name)))
        .digest("hex");
      if (actual !== expected) failures.push(`${name}: checksum mismatch`);
    } catch {
      failures.push(`${name}: checksum target is missing`);
    }
  }

  return failures;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [manifestPath, ...artifactPaths] = process.argv.slice(2);
  if (!manifestPath) throw new Error("Pass a checksum manifest and its expected artifact paths.");
  const failures = await verifyChecksumManifest(manifestPath, artifactPaths);
  if (failures.length) {
    for (const failure of failures) console.error(failure);
    process.exitCode = 1;
  } else {
    console.log(`Verified ${artifactPaths.length} checksummed release artifact(s).`);
  }
}
