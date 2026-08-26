"use client";

import { Check, CircleAlert, Copy } from "lucide-react";
import { useEffect, useState } from "react";

type CopyState = "idle" | "copied" | "failed";

export function CopyLine({
  command,
  showCommand = true,
}: {
  command: string;
  showCommand?: boolean;
}) {
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), 1800);
    return () => window.clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error("CLIPBOARD_UNAVAILABLE");
      await navigator.clipboard.writeText(command);
      setState("copied");
    } catch {
      setState("failed");
    }
  };

  const label = state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy";

  return (
    <div className={showCommand ? "copy-line" : "copy-control"}>
      {showCommand && <code>{command}</code>}
      <button type="button" className="copy-button" data-state={state} onClick={() => void copy()}>
        {state === "copied" ? (
          <Check size={15} aria-hidden="true" />
        ) : state === "failed" ? (
          <CircleAlert size={15} aria-hidden="true" />
        ) : (
          <Copy size={15} aria-hidden="true" />
        )}
        <span aria-live="polite">{label}</span>
      </button>
    </div>
  );
}
