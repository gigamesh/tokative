import type { Config } from "tailwindcss";
import { colors } from "@tokative/shared";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: colors.brand.primary,
          "primary-hover": colors.brand.primaryHover,
        },
        surface: {
          dark: colors.background.dark,
          elevated: colors.background.elevated,
          hover: colors.background.hover,
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
