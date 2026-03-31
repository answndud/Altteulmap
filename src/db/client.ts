import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getRequiredServerEnv } from "@/lib/env";
import * as schema from "@/db/schema";

function createDb() {
  const connectionString = getRequiredServerEnv("DATABASE_URL");

  const client = postgres(connectionString, {
    max: 1,
    prepare: false,
  });

  return drizzle(client, { schema });
}

type Database = ReturnType<typeof createDb>;

const globalForDb = globalThis as {
  __altteulmapDb?: Database;
};

export const db = globalForDb.__altteulmapDb ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__altteulmapDb = db;
}
