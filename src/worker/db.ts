import { drizzle } from "drizzle-orm/postgres-js";
import { AsyncLocalStorage } from "node:async_hooks";
import postgres from "postgres";

import * as schema from "@/db/schema";

export type WorkerDatabaseBindings = {
  DATABASE_URL?: string;
  HYPERDRIVE?: {
    connectionString?: string;
  };
  USE_MOCK_DATA?: string;
};

const DATABASE_UNAVAILABLE_TTL_MS = 60_000;
const DATABASE_READ_TIMEOUT_MS = 5_000;
const DATABASE_STATEMENT_TIMEOUT_MS = 4_500;
const DATABASE_LOCK_TIMEOUT_MS = 2_000;
const DATABASE_IDLE_TRANSACTION_TIMEOUT_MS = 5_000;
const DATABASE_CONNECT_TIMEOUT_SECONDS = 5;
const DATABASE_MAX_LIFETIME_SECONDS = 60;

function createPostgresClient(databaseUrl: string) {
  return postgres(databaseUrl, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
    connect_timeout: DATABASE_CONNECT_TIMEOUT_SECONDS,
    max_lifetime: DATABASE_MAX_LIFETIME_SECONDS,
    connection: {
      application_name: "altteulmap-worker",
      statement_timeout: DATABASE_STATEMENT_TIMEOUT_MS,
      lock_timeout: DATABASE_LOCK_TIMEOUT_MS,
      idle_in_transaction_session_timeout: DATABASE_IDLE_TRANSACTION_TIMEOUT_MS,
    },
  });
}

function createDb(client: ReturnType<typeof createPostgresClient>) {
  return drizzle(client, { schema });
}

type DatabaseState = {
  client: ReturnType<typeof createPostgresClient>;
  connectionString: string;
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

export class WorkerDatabaseUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkerDatabaseUnavailableError";
  }
}

function getWorkerDatabaseConnection(env: WorkerDatabaseBindings) {
  const hyperdriveConnectionString = env.HYPERDRIVE?.connectionString?.trim();

  if (hyperdriveConnectionString) {
    return {
      connectionString: hyperdriveConnectionString,
      source: "hyperdrive" as const,
    };
  }

  const databaseUrl = env.DATABASE_URL?.trim();

  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      source: "database-url" as const,
    };
  }

  return null;
}

export function getWorkerDatabaseConnectionSource(env: WorkerDatabaseBindings) {
  return getWorkerDatabaseConnection(env)?.source ?? "missing";
}

function createDbState(connectionString: string): DatabaseState {
  const client = createPostgresClient(connectionString);

  return {
    client,
    connectionString,
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
    Boolean(getWorkerDatabaseConnection(env)) &&
    !isDatabaseTemporarilyUnavailable()
  );
}

export function isWorkerMockDataEnabled(env: WorkerDatabaseBindings) {
  return env.USE_MOCK_DATA === "true";
}

export function assertWorkerDatabaseReadEnabled(
  env: WorkerDatabaseBindings,
  label: string,
) {
  if (isWorkerMockDataEnabled(env)) {
    return;
  }

  if (!getWorkerDatabaseConnection(env)) {
    throw new WorkerDatabaseUnavailableError(
      `${label} requires HYPERDRIVE or DATABASE_URL when USE_MOCK_DATA is not true.`,
    );
  }

  if (isDatabaseTemporarilyUnavailable()) {
    throw new WorkerDatabaseUnavailableError(
      `${label} database is temporarily unavailable after a recent failure.`,
    );
  }
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

function resetWorkerDatabaseConnection() {
  void closeWorkerDatabaseConnection();
}

export function markWorkerDatabaseUnavailable() {
  globalForWorkerDb.__altteulmapWorkerDbUnavailableUntil =
    Date.now() + DATABASE_UNAVAILABLE_TTL_MS;
  resetWorkerDatabaseConnection();
}

export function getWorkerDb(env: WorkerDatabaseBindings) {
  const connection = getWorkerDatabaseConnection(env);

  if (!isWorkerDatabaseEnabled(env) || !connection) {
    throw new Error(
      "Database access is disabled. Set USE_MOCK_DATA=false and configure HYPERDRIVE or DATABASE_URL to enable it.",
    );
  }

  const context = workerDatabaseStorage.getStore();

  if (!context) {
    throw new Error(
      "Worker database access must run inside withWorkerDatabaseConnection.",
    );
  }

  const existing = context?.state;

  if (existing?.connectionString === connection.connectionString) {
    return existing.db;
  }

  if (existing) {
    context.state = undefined;
    void closeDatabaseState(existing);
  }

  const state = createDbState(connection.connectionString);

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
