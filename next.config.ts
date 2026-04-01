import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

const isDevServer =
  process.argv.some((argument) => argument === "dev") ||
  process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  distDir: isDevServer ? ".next-dev" : ".next",
};

initOpenNextCloudflareForDev();

export default nextConfig;
