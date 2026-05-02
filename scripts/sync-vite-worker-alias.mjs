import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const distRoot = join(process.cwd(), "dist");
const canonicalWorkerOutput = join(distRoot, "altteulmap");
const legacyWorkerOutput = join(distRoot, "altteulmap_vite_migration");
const canonicalWranglerConfig = join(canonicalWorkerOutput, "wrangler.json");

if (!existsSync(canonicalWranglerConfig)) {
  throw new Error(
    `Cannot create legacy Cloudflare build alias because ${canonicalWranglerConfig} does not exist. Run npm run build first.`,
  );
}

mkdirSync(distRoot, { recursive: true });
rmSync(legacyWorkerOutput, { force: true, recursive: true });
cpSync(canonicalWorkerOutput, legacyWorkerOutput, { recursive: true });

console.log(
  `Synced legacy Cloudflare Worker output alias: ${legacyWorkerOutput}`,
);
