import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getRequiredServerEnv, shouldUseMockData } from "@/lib/env";
import * as schema from "@/db/schema";

const DATABASE_UNAVAILABLE_TTL_MS = 60_000;
const DATABASE_READ_TIMEOUT_MS = 5_000;

function createPostgresClient() {
  const connectionString = getRequiredServerEnv("DATABASE_URL");

  return postgres(connectionString, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
  });
}

function createDb(client: ReturnType<typeof createPostgresClient>) {
  return drizzle(client, { schema });
}

type Database = ReturnType<typeof createDb>;
type DatabaseState = {
  client: ReturnType<typeof createPostgresClient>;
  db: Database;
};

const globalForDb = globalThis as {
  __altteulmapDbState?: DatabaseState;
  __altteulmapDbUnavailableUntil?: number;
  __altteulmapDbUnavailableReason?: string;
};

function createDbState(): DatabaseState {
  const client = createPostgresClient();

  return {
    client,
    db: createDb(client),
  };
}

function isCloudflareWorkerRuntime() {
  return (
    typeof navigator !== "undefined" &&
    navigator.userAgent === "Cloudflare-Workers"
  );
}

function getErrorMessage(error: unknown) {
  const messages: string[] = [];
  let current: unknown = error;

  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (current instanceof Error) {
      messages.push(current.message);
    } else if (typeof current === "string") {
      messages.push(current);
    } else if (
      typeof current === "object" &&
      current !== null &&
      "message" in current &&
      typeof current.message === "string"
    ) {
      messages.push(current.message);
    } else {
      messages.push(String(current));
    }

    if (
      typeof current === "object" &&
      current !== null &&
      "cause" in current
    ) {
      current = current.cause;
      continue;
    }

    break;
  }

  return messages.filter(Boolean).join(" | ");
}

function getErrorCode(error: unknown) {
  let current: unknown = error;

  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (
      typeof current === "object" &&
      current !== null &&
      "code" in current &&
      typeof current.code === "string"
    ) {
      return current.code;
    }

    if (
      typeof current === "object" &&
      current !== null &&
      "cause" in current
    ) {
      current = current.cause;
      continue;
    }

    break;
  }

  return "";
}

function isDatabaseTemporarilyUnavailable() {
  const unavailableUntil = globalForDb.__altteulmapDbUnavailableUntil ?? 0;

  if (unavailableUntil <= 0) {
    return false;
  }

  if (Date.now() >= unavailableUntil) {
    globalForDb.__altteulmapDbUnavailableUntil = 0;
    globalForDb.__altteulmapDbUnavailableReason = undefined;
    return false;
  }

  return true;
}

export function isDatabaseEnabled() {
  return !shouldUseMockData() && !isDatabaseTemporarilyUnavailable();
}

export function shouldMarkDatabaseUnavailable(error: unknown) {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);
  const normalizedMessage = message.toLowerCase();

  return (
    code === "ENOTFOUND" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    normalizedMessage.includes("tenant or user not found") ||
    normalizedMessage.includes("tenant/user") ||
    normalizedMessage.includes("connect econnrefused") ||
    normalizedMessage.includes("getaddrinfo enotfound") ||
    normalizedMessage.includes("enotfound") ||
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("connection terminated unexpectedly")
  );
}

export function markDatabaseUnavailable(
  error: unknown,
  ttlMs = DATABASE_UNAVAILABLE_TTL_MS,
) {
  if (!shouldMarkDatabaseUnavailable(error)) {
    return;
  }

  globalForDb.__altteulmapDbUnavailableUntil = Date.now() + ttlMs;
  globalForDb.__altteulmapDbUnavailableReason = getErrorMessage(error);
  resetDatabaseConnection();
}

export function resetDatabaseConnection() {
  const state = globalForDb.__altteulmapDbState;
  globalForDb.__altteulmapDbState = undefined;

  if (!state) {
    return;
  }

  void state.client.end({ timeout: 1 }).catch((error: unknown) => {
    console.warn("Failed to close stale database connection.", error);
  });
}

export function releaseDatabaseConnection() {
  if (isCloudflareWorkerRuntime()) {
    resetDatabaseConnection();
  }
}

export async function withDatabaseReadTimeout<T>(
  label: string,
  load: () => Promise<T>,
): Promise<T> {
  let timedOut = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const operation = load();

  void operation.catch((error) => {
    if (timedOut) {
      console.error(`${label} rejected after the read timeout elapsed.`, error);
    }
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      reject(
        new Error(
          `${label} exceeded the ${DATABASE_READ_TIMEOUT_MS}ms database read timeout.`,
        ),
      );
    }, DATABASE_READ_TIMEOUT_MS);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    releaseDatabaseConnection();
  }
}

export function getDb() {
  if (!isDatabaseEnabled()) {
    throw new Error(
      "Database access is disabled. Set USE_MOCK_DATA=false and DATABASE_URL to enable it.",
    );
  }

  const state = globalForDb.__altteulmapDbState ?? createDbState();
  globalForDb.__altteulmapDbState = state;

  return state.db;
}
