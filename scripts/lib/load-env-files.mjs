import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

export function loadEnvFilesWithShellPrecedence({
  cwd = process.cwd(),
  filenames,
}) {
  const shellEnvKeys = new Set(Object.keys(process.env));
  const loadedFiles = [];

  for (const filename of filenames) {
    const fullPath = path.join(cwd, filename);

    if (!fs.existsSync(fullPath)) {
      continue;
    }

    const parsed = dotenv.parse(fs.readFileSync(fullPath));

    for (const [key, value] of Object.entries(parsed)) {
      if (shellEnvKeys.has(key)) {
        continue;
      }

      process.env[key] = value;
    }

    loadedFiles.push(filename);
  }

  return loadedFiles;
}
