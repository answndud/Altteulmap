import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  USE_MOCK_DATA: z.enum(["true", "false"]).default("false"),
  AUTH_SECRET: z.string().min(1).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  AUTH_DEMO_PASSWORD: z.string().min(1).default("demo1234"),
  AUTH_ADMIN_PASSWORD: z.string().min(1).default("admin1234"),
  AUTH_KAKAO_CLIENT_ID: z.string().min(1).optional(),
  AUTH_KAKAO_CLIENT_SECRET: z.string().min(1).optional(),
  AUTH_NAVER_CLIENT_ID: z.string().min(1).optional(),
  AUTH_NAVER_CLIENT_SECRET: z.string().min(1).optional(),
});

const serverEnv = serverEnvSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  USE_MOCK_DATA: process.env.USE_MOCK_DATA,
  AUTH_SECRET: process.env.AUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  AUTH_DEMO_PASSWORD: process.env.AUTH_DEMO_PASSWORD,
  AUTH_ADMIN_PASSWORD: process.env.AUTH_ADMIN_PASSWORD,
  AUTH_KAKAO_CLIENT_ID: process.env.AUTH_KAKAO_CLIENT_ID,
  AUTH_KAKAO_CLIENT_SECRET: process.env.AUTH_KAKAO_CLIENT_SECRET,
  AUTH_NAVER_CLIENT_ID: process.env.AUTH_NAVER_CLIENT_ID,
  AUTH_NAVER_CLIENT_SECRET: process.env.AUTH_NAVER_CLIENT_SECRET,
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

export function shouldUseMockData() {
  return serverEnv.USE_MOCK_DATA === "true" || !serverEnv.DATABASE_URL;
}

export { serverEnv };
