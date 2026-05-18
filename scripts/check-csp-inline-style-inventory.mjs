import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const cwd = process.cwd();
const patterns = [
  "style=\\{\\{",
  "style=\\\"",
  "dangerouslySetInnerHTML",
  "innerHTML",
  "<style",
  "createElement\\([^)]*style",
  "setAttribute\\([^)]*style",
];
const includeRoots = ["src", "public"];

function runRipgrep(pattern) {
  try {
    return execFileSync(
      "rg",
      [
        "-n",
        "--glob",
        "!**/*.md",
        "--glob",
        "!**/dist/**",
        pattern,
        ...includeRoots,
      ],
      {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    )
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

const findings = patterns.flatMap((pattern) =>
  runRipgrep(pattern).map((line) => {
    const [filePath, lineNumber, ...rest] = line.split(":");

    return {
      pattern,
      filePath,
      lineNumber: Number(lineNumber),
      snippet: rest.join(":").trim(),
    };
  }),
);

const grouped = new Map();

for (const finding of findings) {
  const key = finding.filePath;
  const item = grouped.get(key) ?? [];
  item.push(finding);
  grouped.set(key, item);
}

const cspSources = [
  join(cwd, "src/worker/http/security-headers.ts"),
  join(cwd, "public/_headers"),
];
const workerSecurityHeaderPath = cspSources[0];
const publicHeadersPath = cspSources[1];

function normalizeCsp(value) {
  return value
    .replace(/\s+/g, " ")
    .split(";")
    .map((directive) => directive.trim())
    .filter(Boolean)
    .join("; ");
}

function getStringLiteral(line) {
  const match = line.match(/^\s*"([^"]+)",?\s*$/);

  return match?.[1] ?? null;
}

function extractWorkerCsp() {
  const content = readFileSync(workerSecurityHeaderPath, "utf8");
  const match = content.match(
    /const contentSecurityPolicy = \[([\s\S]*?)\]\.join\("; "\);/,
  );

  if (!match) {
    return null;
  }

  const directives = [];
  let nestedDirective = null;

  for (const rawLine of match[1].split("\n")) {
    const line = rawLine.trim();

    if (!line || line.startsWith("const ")) {
      continue;
    }

    if (line === "[") {
      nestedDirective = [];
      continue;
    }

    if (line.startsWith("].join")) {
      if (nestedDirective) {
        directives.push(nestedDirective.join(" "));
      }
      nestedDirective = null;
      continue;
    }

    const literal = getStringLiteral(line);

    if (!literal) {
      continue;
    }

    if (nestedDirective) {
      nestedDirective.push(literal);
    } else {
      directives.push(literal);
    }
  }

  return normalizeCsp(directives.join("; "));
}

function extractPublicHeadersCsp() {
  const content = readFileSync(publicHeadersPath, "utf8");
  const match = content.match(/Content-Security-Policy:\s*(.+)/);

  return match ? normalizeCsp(match[1]) : null;
}

const cspStatus = cspSources.map((filePath) => {
  const content = readFileSync(filePath, "utf8");

  return {
    filePath: filePath.replace(`${cwd}/`, ""),
    hasUnsafeInline: content.includes("'unsafe-inline'"),
  };
});
const workerCsp = extractWorkerCsp();
const publicHeadersCsp = extractPublicHeadersCsp();
const cspHeaderParity = {
  ok: Boolean(workerCsp && publicHeadersCsp && workerCsp === publicHeadersCsp),
  workerCsp,
  publicHeadersCsp,
};
const ok = findings.length === 0 && cspHeaderParity.ok;

process.stdout.write(
  `${JSON.stringify(
    {
      ok,
      checkedRoots: includeRoots,
      totalFindings: findings.length,
      files: [...grouped.entries()].map(([filePath, items]) => ({
        filePath,
        count: items.length,
        items: items.map(({ lineNumber, pattern, snippet }) => ({
          lineNumber,
          pattern,
          snippet,
        })),
      })),
      cspStatus,
      cspHeaderParity,
    },
    null,
    2,
  )}\n`,
);

if (!ok) {
  process.exitCode = 1;
}
