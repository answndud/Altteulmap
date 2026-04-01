import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getRequiredServerEnv, shouldUseMockData } from "@/lib/env";
import * as schema from "@/db/schema";

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
};

export function isDatabaseEnabled() {
  return !shouldUseMockData();
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
