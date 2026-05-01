import { drizzle } from "drizzle-orm/postgres-js";
import { AsyncLocalStorage } from "node:async_hooks";
import postgres from "postgres";

import * as schema from "@/db/schema";

export type WorkerDatabaseBindings = {
  DATABASE_URL?: string;
  USE_MOCK_DATA?: string;
};

const DATABASE_UNAVAILABLE_TTL_MS = 60_000;
const DATABASE_READ_TIMEOUT_MS = 5_000;

function createPostgresClient(databaseUrl: string) {
  return postgres(databaseUrl, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
  });
}

function createDb(client: ReturnType<typeof createPostgresClient>) {
  return drizzle(client, { schema });
}

type DatabaseState = {
  client: ReturnType<typeof createPostgresClient>;
  databaseUrl: string;
  db: ReturnType<typeof createDb>;
};
type DatabaseContext = {
  env: WorkerDatabaseBindings;
  state?: DatabaseState;
};

const globalForWorkerDb = globalThis as typeof globalThis & {
  __altteulmapWorkerDbUnavailableUntil?: number;
};
const workerDatabaseStorage = new AsyncLocalStorage<DatabaseContext>();

function createDbState(databaseUrl: string): DatabaseState {
  const client = createPostgresClient(databaseUrl);

  return {
    client,
    databaseUrl,
    db: createDb(client),
  };
}

function isDatabaseTemporarilyUnavailable() {
  const unavailableUntil = globalForWorkerDb.__altteulmapWorkerDbUnavailableUntil ?? 0;

  if (unavailableUntil <= 0) {
    return false;
  }

  if (Date.now() >= unavailableUntil) {
    globalForWorkerDb.__altteulmapWorkerDbUnavailableUntil = 0;
    return false;
  }

  return true;
}

export function isWorkerDatabaseEnabled(env: WorkerDatabaseBindings) {
  return (
    env.USE_MOCK_DATA !== "true" &&
    Boolean(env.DATABASE_URL) &&
    !isDatabaseTemporarilyUnavailable()
  );
}

async function closeDatabaseState(state: DatabaseState | undefined) {
  if (!state) {
    return;
  }

  await state.client.end({ timeout: 1 }).catch((error: unknown) => {
    console.warn("Failed to close stale worker database connection.", error);
  });
}

export async function closeWorkerDatabaseConnection() {
  const context = workerDatabaseStorage.getStore();

  if (!context?.state) {
    return;
  }

  const state = context.state;
  context.state = undefined;
  await closeDatabaseState(state);
}

export function resetWorkerDatabaseConnection() {
  void closeWorkerDatabaseConnection();
}

export function markWorkerDatabaseUnavailable() {
  globalForWorkerDb.__altteulmapWorkerDbUnavailableUntil =
    Date.now() + DATABASE_UNAVAILABLE_TTL_MS;
  resetWorkerDatabaseConnection();
}

export function getWorkerDb(env: WorkerDatabaseBindings) {
  if (!isWorkerDatabaseEnabled(env) || !env.DATABASE_URL) {
    throw new Error(
      "Database access is disabled. Set USE_MOCK_DATA=false and DATABASE_URL to enable it.",
    );
  }

  const context = workerDatabaseStorage.getStore();

  if (!context) {
    throw new Error(
      "Worker database access must run inside withWorkerDatabaseConnection.",
    );
  }

  const existing = context?.state;

  if (existing?.databaseUrl === env.DATABASE_URL) {
    return existing.db;
  }

  if (existing) {
    context.state = undefined;
    void closeDatabaseState(existing);
  }

  const state = createDbState(env.DATABASE_URL);

  if (context) {
    context.state = state;
  }

  return state.db;
}

export async function withWorkerDatabaseConnection<T>(
  env: WorkerDatabaseBindings,
  load: () => Promise<T>,
) {
  const context: DatabaseContext = { env };

  return workerDatabaseStorage.run(context, async () => {
    try {
      return await load();
    } finally {
      const state = context.state;
      context.state = undefined;
      await closeDatabaseState(state);
    }
  });
}

export async function withWorkerDatabaseReadTimeout<T>(
  env: WorkerDatabaseBindings,
  label: string,
  load: () => Promise<T>,
) {
  return withWorkerDatabaseConnection(env, async () => {
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
    }
  });
}
