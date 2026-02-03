import type { Config } from "tailwindcss";
import { colors } from "@tokative/shared";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      spacing: {
        header: "57px",
      },
      colors: {
        brand: {
          primary: colors.brand.primary,
          "primary-hover": colors.brand.primaryHover,
        },
        surface: {
          DEFAULT: "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          elevated: "var(--bg-elevated)",
          dark: colors.background.dark,
          hover: colors.background.hover,
        },
        foreground: {
          DEFAULT: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        border: {
          DEFAULT: "var(--border-default)",
        },
        status: {
          info: colors.status.info,
          "info-hover": colors.status.infoHover,
          success: colors.status.success,
          warning: colors.status.warning,
          error: colors.status.error,
        },
        // Keep tiktok alias for backwards compatibility
        tiktok: {
          red: colors.brand.primary,
          dark: colors.background.dark,
          gray: colors.background.elevated,
        },
      },
    },
  },
  plugins: [],
};

export default config;
