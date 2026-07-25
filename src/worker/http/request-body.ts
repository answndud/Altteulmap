type LimitedBodyResult =
  | { ok: true; body: Uint8Array }
  | { ok: false; reason: "too-large" };

export async function readRequestBodyWithinLimit(
  request: Request,
  maxBytes: number,
): Promise<LimitedBodyResult> {
  if (!request.body) {
    return { ok: true, body: new Uint8Array() };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: "too-large" };
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, body };
}
