"use client";

import { useEffect } from "react";

export default function FaviconSetter() {
  useEffect(() => {
    fetch("/api/app-config")
      .then((r) => r.json())
      .then((config) => {
        if (!config?.favicon) return;
        let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
        if (!link) {
          link = document.createElement("link");
          link.rel = "icon";
          document.head.appendChild(link);
        }
        link.href = config.favicon;
      })
      .catch(() => {});
  }, []);

  return null;
}
