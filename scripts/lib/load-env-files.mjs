import fs from "node:fs";
import path from "node:path";

function stripInlineComment(value) {
  let quote = null;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if ((char === '"' || char === "'") && value[index - 1] !== "\\") {
      quote = quote === char ? null : (quote ?? char);
      continue;
    }

    if (char === "#" && quote === null) {
      return value.slice(0, index).trimEnd();
    }
  }

  return value.trim();
}

function unquoteValue(value) {
  if (value.length < 2) {
    return value;
  }

  const first = value[0];
  const last = value[value.length - 1];

  if (first !== last || (first !== '"' && first !== "'")) {
    return value;
  }

  const inner = value.slice(1, -1);

  if (first === "'") {
    return inner;
  }

  return inner
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function parseEnvFile(contents) {
  const entries = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalizedLine = line.startsWith("export ")
      ? line.slice("export ".length)
      : line;
    const separatorIndex = normalizedLine.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();

    if (!key) {
      continue;
    }

    const rawValue = normalizedLine.slice(separatorIndex + 1).trim();
    const value = unquoteValue(stripInlineComment(rawValue));

    entries[key] = value;
  }

  return entries;
}

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

    const parsed = parseEnvFile(fs.readFileSync(fullPath, "utf8"));

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
