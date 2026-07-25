"use client";

import { useEffect } from "react";
import { getClientPbId } from "@/lib/tenant";

function darken(hex: string, amount: number) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function lighten(hex: string, amount: number) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function setCssVars(primary: string, caption: string, bg: string) {
  const root = document.documentElement;
  root.style.setProperty("--color-primary", primary);
  root.style.setProperty("--color-primary-hover", darken(primary, 20));
  root.style.setProperty("--color-primary-light", lighten(primary, 180));
  root.style.setProperty("--color-primary-lighter", lighten(primary, 220));
  root.style.setProperty("--color-primary-ring", primary + "1a");
  root.style.setProperty("--color-caption", caption);
  root.style.setProperty("--color-caption-hover", darken(caption, 30));
  root.style.setProperty("--color-bg", bg);
}

const DEFAULT_PRIMARY = "#0d9488";
const DEFAULT_CAPTION = "#0d9488";
const DEFAULT_BG = "#f0fdfa";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const u = JSON.parse(raw);
        const p = u.primaryColor || u.pb?.primaryColor || DEFAULT_PRIMARY;
        const c = u.captionColor || DEFAULT_CAPTION;
        const b = u.bgColor || DEFAULT_BG;
        setCssVars(p, c, b);
      } else {
        setCssVars(DEFAULT_PRIMARY, DEFAULT_CAPTION, DEFAULT_BG);
      }
    } catch {
      setCssVars(DEFAULT_PRIMARY, DEFAULT_CAPTION, DEFAULT_BG);
    }

    const pbId = getClientPbId();
    if (!pbId) return;
    fetch("/api/pbs/" + pbId)
      .then((r) => r.ok ? r.json() : null)
      .then((pb) => {
        if (!pb) return;
        const raw = localStorage.getItem("user");
        if (!raw) return;
        const u = JSON.parse(raw);
        const serverPrimary = pb.primaryColor || DEFAULT_PRIMARY;
        const localPrimary = u.primaryColor || u.pb?.primaryColor;
        if (serverPrimary !== localPrimary) {
          u.primaryColor = serverPrimary;
          u.pb = { ...u.pb, primaryColor: serverPrimary };
          localStorage.setItem("user", JSON.stringify(u));
          const c = u.captionColor || DEFAULT_CAPTION;
          const b = u.bgColor || DEFAULT_BG;
          setCssVars(serverPrimary, c, b);
        }
      })
      .catch(() => {});
  }, []);
  return <>{children}</>;
}
