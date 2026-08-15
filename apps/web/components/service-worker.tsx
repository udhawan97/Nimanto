"use client";

import { useEffect } from "react";

export function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLocaleLowerCase("en-US").replace(/\.$/u, "");
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/u.test(normalized)
  );
}

export function serviceWorkerScriptUrl(basePath: string): string {
  const normalized = basePath === "/" ? "" : basePath.replace(/\/+$/u, "");
  return `${normalized}/sw.js`;
}

export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || isLoopbackHost(location.hostname)) return;
    const script = serviceWorkerScriptUrl(process.env.NEXT_PUBLIC_BASE_PATH ?? "");
    // Offline support is an enhancement to the public static surface. A
    // blocked or unavailable registration must not become an unhandled browser
    // rejection or interfere with the local workbench.
    void navigator.serviceWorker.register(script).catch(() => undefined);
  }, []);
  return null;
}
