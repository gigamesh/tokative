import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        tiktok: {
          red: "#fe2c55",
          dark: "#121212",
          gray: "#1f1f1f",
        },
      },
    },
  },
  plugins: [],
};

export default config;
