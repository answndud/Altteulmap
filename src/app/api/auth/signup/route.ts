import { NextResponse } from "next/server";

import { createCredentialsUser } from "@/features/auth/repository";
import { credentialsSignupSchema } from "@/features/auth/schema";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimit = consumeRateLimit({
    scope: "auth_signup",
    key:
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "guest",
    limit: 5,
    windowMs: 30 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: "회원가입 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
        item: null,
        retryAfterMs: rateLimit.retryAfterMs,
      },
      { status: 429 },
    );
  }

  const body = await request.json();
  const parsed = credentialsSignupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "회원가입 입력값 검증에 실패했습니다.",
        item: null,
        error: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const result = await createCredentialsUser(parsed.data);
  const status = result.ok
    ? 201
    : result.message.includes("이미 가입된 이메일")
      ? 409
      : result.message.includes("DB 연결")
        ? 503
        : 500;

  return NextResponse.json(result, { status });
}
