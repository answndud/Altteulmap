import net from "node:net";
import process from "node:process";
import { rmSync } from "node:fs";

const port = Number(process.env.E2E_PORT ?? 3107);

function isPortInUse() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => {
      server.close(() => resolve(false));
    });
    server.listen(port, "127.0.0.1");
  });
}

if (await isPortInUse()) {
  throw new Error(
    `[e2e] port ${port} is already in use. Stop the existing process before running E2E; no process was terminated automatically.`,
  );
}

rmSync("test-results", { recursive: true, force: true });
rmSync("playwright-report", { recursive: true, force: true });
