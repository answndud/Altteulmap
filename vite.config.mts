import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  define: {
    "process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID": JSON.stringify(
      process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ?? "",
    ),
    "process.env.NEXT_PUBLIC_NAVER_MAP_KEY_ID": JSON.stringify(
      process.env.NEXT_PUBLIC_NAVER_MAP_KEY_ID ?? "",
    ),
  },
  plugins: [
    react(),
    cloudflare({
      configPath: "./wrangler.jsonc",
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
});
