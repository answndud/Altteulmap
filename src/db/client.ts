import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getRequiredServerEnv, shouldUseMockData } from "@/lib/env";
import * as schema from "@/db/schema";

const DATABASE_UNAVAILABLE_TTL_MS = 60_000;

function createDb() {
  const connectionString = getRequiredServerEnv("DATABASE_URL");

  const client = postgres(connectionString, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
  });

  return drizzle(client, { schema });
}

type Database = ReturnType<typeof createDb>;

const globalForDb = globalThis as {
  __altteulmapDb?: Database;
  __altteulmapDbUnavailableUntil?: number;
  __altteulmapDbUnavailableReason?: string;
};

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
}

export function getDb() {
  if (!isDatabaseEnabled()) {
    throw new Error(
      "Database access is disabled. Set USE_MOCK_DATA=false and DATABASE_URL to enable it.",
    );
  }

  const db = globalForDb.__altteulmapDb ?? createDb();
  globalForDb.__altteulmapDb = db;

  return db;
}
