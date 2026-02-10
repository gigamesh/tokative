import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    TOKATIVE_URL_PLACEHOLDER: JSON.stringify("https://test.tokative.com"),
    CONVEX_SITE_URL_PLACEHOLDER: JSON.stringify(
      "https://test-convex.tokative.com",
    ),
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
