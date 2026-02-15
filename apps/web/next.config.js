const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@tokative/convex", "@tokative/shared"],
};

module.exports =
  process.env.NODE_ENV === "production"
    ? withSentryConfig(nextConfig, {
        org: "gigamesh",
        project: "tokative-web",
        silent: !process.env.CI,
        widenClientFileUpload: true,
        disableLogger: true,
        hideSourceMaps: true,
      })
    : nextConfig;
