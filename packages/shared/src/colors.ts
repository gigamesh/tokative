/**
 * Brand and UI colors for Tokative
 * Use these constants across extension and web app for consistency
 */

export const colors = {
  // Brand colors
  brand: {
    primary: "#fe2c55", // TikTok red - main brand accent
    primaryHover: "#e0284d",
  },

  // Background colors
  background: {
    dark: "#121212",
    darkAlt: "#1a1a1a",
    elevated: "#1f1f1f",
    hover: "#2a2a2a",
  },

  // UI state colors
  status: {
    info: "#3b82f6",
    infoHover: "#2563eb",
    success: "#22c55e",
    warning: "#fbbf24",
    warningHover: "#fcd34d",
    error: "#ef4444",
  },

  // Text colors
  text: {
    primary: "#ffffff",
    secondary: "#e5e5e5",
    muted: "#888888",
    disabled: "#666666",
  },
} as const;

export type Colors = typeof colors;
