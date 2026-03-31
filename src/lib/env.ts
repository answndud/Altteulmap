import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
});

const serverEnv = serverEnvSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
});

export function getRequiredServerEnv(
  name: keyof typeof serverEnv,
): string {
  const value = serverEnv[name];

  if (!value) {
    throw new Error(
      `${name} is not set. Add it to your local .env file before using database features.`,
    );
  }

  return value;
}

export { serverEnv };
