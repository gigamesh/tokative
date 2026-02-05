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
        accent: {
          cyan: {
            50: "#ecfffe",
            100: "#cffffe",
            200: "#a5fffe",
            300: "#67fffc",
            400: "#25F4EE",
            500: "#00d8d5",
            600: "#00aeb2",
            700: "#008b8f",
            800: "#066d72",
            900: "#0a5a5e",
            950: "#003a40",
            DEFAULT: "#25F4EE",
            // Semantic tokens that adapt to light/dark mode
            text: "var(--accent-cyan-text)",
            "text-hover": "var(--accent-cyan-text-hover)",
            solid: "var(--accent-cyan-solid)",
            "solid-hover": "var(--accent-cyan-solid-hover)",
            muted: "var(--accent-cyan-muted)",
            "muted-half": "var(--accent-cyan-muted-half)",
          },
          pink: {
            50: "#fff0f3",
            100: "#ffe1e8",
            200: "#ffc7d6",
            300: "#ff9ab4",
            400: "#ff5c8a",
            500: "#FE2C55",
            600: "#ec0c42",
            700: "#c70038",
            800: "#a60335",
            900: "#8c0733",
            950: "#4e0016",
            DEFAULT: "#FE2C55",
          },
        },
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
