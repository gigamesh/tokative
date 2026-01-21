"use client";

import { useEffect, useRef } from "react";

export function useScrollRestore(key: string, ready: boolean) {
  const restored = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem(key, String(window.scrollY));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [key]);

  useEffect(() => {
    if (ready && !restored.current) {
      restored.current = true;
      const saved = sessionStorage.getItem(key);
      if (saved) {
        // Wait for virtualized list to render
        requestAnimationFrame(() => {
          window.scrollTo(0, parseInt(saved, 10));
        });
      }
    }
  }, [key, ready]);
}
