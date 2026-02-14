import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    TOKATIVE_ENDPOINT_PLACEHOLDER: JSON.stringify("https://test.tokative.com"),
    CONVEX_SITE_URL_PLACEHOLDER: JSON.stringify(
      "https://test-convex.tokative.com",
    ),
    SENTRY_DSN_EXTENSION_PLACEHOLDER: JSON.stringify(""),
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
