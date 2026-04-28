import type { NextConfig } from "next";

const isDevServer =
  process.argv.some((argument) => argument === "dev") ||
  process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  distDir: isDevServer ? ".next-dev" : ".next",
  experimental: {
    externalDir: true,
  },
  typescript: {
    ignoreBuildErrors: process.env.WORKERS_CI === "1",
  },
};

export default nextConfig;
