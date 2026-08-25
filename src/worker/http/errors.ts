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

export function logWorkerRequest(
  request: Request,
  requestId: string,
  status: number,
  durationMs: number,
) {
  const url = new URL(request.url);

  console.log(
    JSON.stringify({
      level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
      event: "worker_request_complete",
      requestId,
      method: request.method,
      path: url.pathname,
      status,
      durationMs: Math.round(durationMs),
    }),
  );
}
