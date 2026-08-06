"use client";

import { useEffect, useState } from "react";

export type Connection = "online" | "offline" | "unreachable";

/* Nimanto runs as two halves the candidate starts themselves: a static page and
 * a local API. When something breaks, saying WHICH half is the whole value —
 * "check your internet" is the wrong advice when the browser is fine and the
 * API is simply not running. */
export function useConnection(apiReachable: boolean): Connection {
  const [browserOnline, setBrowserOnline] = useState(true);

  useEffect(() => {
    const sync = () => setBrowserOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!browserOnline) return "offline";
  return apiReachable ? "online" : "unreachable";
}

export function ConnectionIndicator({ state }: { state: Connection }) {
  const label =
    state === "online"
      ? "Local service connected"
      : state === "unreachable"
        ? "Local service unreachable"
        : "Browser offline";
  return (
    <p className="local-indicator" data-state={state}>
      <span aria-hidden="true" />
      {label}
    </p>
  );
}

export function ConnectionBanner({ state, onRetry }: { state: Connection; onRetry: () => void }) {
  if (state === "online") return null;
  return (
    <div className="connection-banner" role="status">
      {state === "unreachable" ? (
        <>
          <strong>The local Nimanto API is not answering.</strong>
          <p>
            Your browser is online, so this is the API half. Start it with <code>pnpm dev</code> in
            the Nimanto folder, or reopen <code>START-NIMANTO.command</code>, then retry. Nothing is
            lost while it is down — the workbench simply cannot read or write.
          </p>
        </>
      ) : (
        <>
          <strong>This device is offline.</strong>
          <p>
            Nimanto keeps working against the local API once the browser reports a connection again.
            No evidence leaves this machine either way.
          </p>
        </>
      )}
      <button className="button primary" type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
