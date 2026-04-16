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
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function getErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
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

  return (
    code === "ENOTFOUND" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    message.includes("Tenant or user not found") ||
    message.includes("connect ECONNREFUSED") ||
    message.includes("getaddrinfo ENOTFOUND") ||
    message.includes("timeout") ||
    message.includes("Connection terminated unexpectedly")
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
