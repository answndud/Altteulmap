import { randomUUID } from "node:crypto";

export function createRequestId(request: Request) {
  const cloudflareRay = request.headers.get("cf-ray")?.split("-")[0]?.trim();

  return cloudflareRay || randomUUID();
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function logWorkerError(error: unknown, request: Request, requestId: string) {
  const url = new URL(request.url);

  console.error(
    JSON.stringify({
      level: "error",
      event: "worker_unhandled_error",
      requestId,
      method: request.method,
      path: url.pathname,
      message: getErrorMessage(error),
      errorName: error instanceof Error ? error.name : typeof error,
    }),
  );
}
