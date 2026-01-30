/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@tokative/convex", "@tokative/shared"],
};

module.exports = nextConfig;
