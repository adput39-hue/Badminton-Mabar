"use client";

import { useEffect, useRef } from "react";

export function useWakeLock() {
  const sentinel = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    async function request() {
      if (!("wakeLock" in navigator)) return;
      try {
        sentinel.current = await navigator.wakeLock.request("screen");
        sentinel.current.addEventListener("release", () => {
          if (document.visibilityState === "visible") {
            navigator.wakeLock.request("screen").then((s) => { sentinel.current = s; });
          }
        });
      } catch {}
    }
    request();
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !sentinel.current?.released) {
        navigator.wakeLock.request("screen").then((s) => { sentinel.current = s; });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      sentinel.current?.release().catch(() => {});
    };
  }, []);
}
