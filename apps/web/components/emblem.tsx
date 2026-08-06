"use client";

import { useEffect, useRef, useState } from "react";
import { Mark } from "./brand.js";

type Stage = "loading" | "live" | "fallback";

/* Fallback ladder, in order:
 *   WebGL + motion allowed  → the live emblem
 *   reduced motion          → the emblem, one frame, no loop
 *   no WebGL / three fails  → the flat mark, same box
 * The hero is never blank, and the flat mark is the same geometry, so the page
 * degrades to something quieter rather than to something missing. */
export function Emblem() {
  const host = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Stage>("loading");

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let instance: { dispose(): void } | null = null;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const supportsWebGL = () => {
      try {
        const canvas = document.createElement("canvas");
        return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
      } catch {
        return false;
      }
    };

    if (!supportsWebGL()) {
      setStage("fallback");
      return;
    }

    // Dynamic so three lands in its own chunk and the workbench route, which
    // renders no 3D at all, never downloads it.
    void import("./emblem-core.js")
      .then(({ NimantoEmblem }) => {
        if (disposed || !host.current) return;
        instance = new NimantoEmblem(host.current, { reducedMotion });
        setStage("live");
      })
      .catch(() => {
        if (!disposed) setStage("fallback");
      });

    return () => {
      disposed = true;
      instance?.dispose();
    };
  }, []);

  return (
    <div className="emblem" data-stage={stage}>
      <div className="emblem-stage" ref={host} aria-hidden="true" />
      {stage !== "live" && (
        <div className="emblem-fallback" data-visible={stage === "fallback"}>
          <Mark size={280} title="The Nimanto fold lotus" />
        </div>
      )}
    </div>
  );
}
