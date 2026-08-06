"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

export function CopyLine({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <div className="copy-line">
      <code>{command}</code>
      <button
        type="button"
        className="copy-button"
        onClick={() => {
          void navigator.clipboard?.writeText(command).then(
            () => setCopied(true),
            () => setCopied(false),
          );
        }}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}
