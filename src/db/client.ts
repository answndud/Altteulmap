import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getRequiredServerEnv, shouldUseMockData } from "@/lib/env";
import * as schema from "@/db/schema";

const DATABASE_STATEMENT_TIMEOUT_MS = 4_500;
const DATABASE_LOCK_TIMEOUT_MS = 2_000;
const DATABASE_IDLE_TRANSACTION_TIMEOUT_MS = 5_000;
const DATABASE_CONNECT_TIMEOUT_SECONDS = 5;
const DATABASE_MAX_LIFETIME_SECONDS = 60;

function createPostgresClient() {
  const connectionString = getRequiredServerEnv("DATABASE_URL");

  return postgres(connectionString, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
    connect_timeout: DATABASE_CONNECT_TIMEOUT_SECONDS,
    max_lifetime: DATABASE_MAX_LIFETIME_SECONDS,
    connection: {
      application_name: "altteulmap-server",
      statement_timeout: DATABASE_STATEMENT_TIMEOUT_MS,
      lock_timeout: DATABASE_LOCK_TIMEOUT_MS,
      idle_in_transaction_session_timeout: DATABASE_IDLE_TRANSACTION_TIMEOUT_MS,
    },
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
};

function createDbState(): DatabaseState {
  const client = createPostgresClient();

  return {
    client,
    db: createDb(client),
  };
}

function isDatabaseTemporarilyUnavailable() {
  const unavailableUntil = globalForDb.__altteulmapDbUnavailableUntil ?? 0;

  if (unavailableUntil <= 0) {
    return false;
  }

  if (Date.now() >= unavailableUntil) {
    globalForDb.__altteulmapDbUnavailableUntil = 0;
    return false;
  }

  return true;
}

function isDatabaseEnabled() {
  return !shouldUseMockData() && !isDatabaseTemporarilyUnavailable();
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
