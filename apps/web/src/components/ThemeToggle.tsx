"use client";

import { useTheme } from "@/providers/ThemeProvider";

/** Pill-shaped sun/moon toggle — an orange circle morphs into a white crescent via a sliding mask pseudo-element. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      className={`theme-toggle${isDark ? " theme-toggle-dark" : ""}`}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={`Theme: ${isDark ? "Dark" : "Light"}. Click to toggle.`}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    />
  );
}
