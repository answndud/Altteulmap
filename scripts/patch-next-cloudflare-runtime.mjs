import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PATCHES = [
  {
    relativePath: "node_modules/next/dist/server/next-server.js",
    fromCandidates: [
      'const manifest = require(this.middlewareManifestPath);\n            return manifest;',
      'const manifest = JSON.parse(_fs.default.readFileSync(this.middlewareManifestPath, "utf8"));\n            return manifest;',
    ],
    to: 'try {\n                const manifest = JSON.parse(_fs.default.readFileSync(this.middlewareManifestPath, "utf8"));\n                return manifest;\n            } catch (error) {\n                if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {\n                    return null;\n                }\n                throw error;\n            }',
  },
  {
    relativePath: "node_modules/next/dist/esm/server/next-server.js",
    fromCandidates: [
      'const manifest = require(this.middlewareManifestPath);\n            return manifest;',
      'const manifest = JSON.parse(fs.readFileSync(this.middlewareManifestPath, "utf8"));\n            return manifest;',
    ],
    to: 'try {\n                const manifest = JSON.parse(fs.readFileSync(this.middlewareManifestPath, "utf8"));\n                return manifest;\n            } catch (error) {\n                if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {\n                    return null;\n                }\n                throw error;\n            }',
  },
];

function patchFile(projectRoot, patch) {
  const filePath = path.join(projectRoot, patch.relativePath);
  const source = readFileSync(filePath, "utf8");

  if (source.includes(patch.to)) {
    return false;
  }

  const from = patch.fromCandidates.find((candidate) => source.includes(candidate));

  if (!from) {
    throw new Error(
      `[patch-next-cloudflare-runtime] Could not find target snippet in ${patch.relativePath}`,
    );
  }

  writeFileSync(filePath, source.replace(from, patch.to));
  return true;
}

export function patchNextCloudflareRuntime({
  projectRoot = process.cwd(),
} = {}) {
  const changedPaths = PATCHES.filter((patch) => patchFile(projectRoot, patch))
    .map((patch) => patch.relativePath);

  if (changedPaths.length > 0) {
    console.log(
      `[patch-next-cloudflare-runtime] patched ${changedPaths.join(", ")}`,
    );
  } else {
    console.log("[patch-next-cloudflare-runtime] already patched");
  }
}

const entrypointPath = process.argv[1]
  ? path.resolve(process.argv[1])
  : undefined;

if (entrypointPath === fileURLToPath(import.meta.url)) {
  patchNextCloudflareRuntime();
}
