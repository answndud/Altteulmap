import { createCredentialsUser } from "@/features/auth/repository";
import { credentialsSignupSchema } from "@/features/auth/schema";
import {
  applyRateLimitHeaders,
  consumeRateLimitPolicy,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimit = consumeRateLimitPolicy(
    "authSignup",
    request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "guest",
  );

  if (!rateLimit.ok) {
    return applyRateLimitHeaders(
      Response.json(
        {
          ok: false,
          message: "회원가입 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
          item: null,
          retryAfterMs: rateLimit.retryAfterMs,
        },
        { status: 429 },
      ),
      rateLimit,
    );
  }

  const body = await request.json();
  const parsed = credentialsSignupSchema.safeParse(body);

  if (!parsed.success) {
    return applyRateLimitHeaders(
      Response.json(
        {
          ok: false,
          message: "회원가입 입력값 검증에 실패했습니다.",
          item: null,
          error: parsed.error.flatten(),
        },
        { status: 400 },
      ),
      rateLimit,
    );
  }

  const result = await createCredentialsUser(parsed.data);
  const status = result.ok
    ? 201
    : result.message.includes("이미 가입된 이메일")
      ? 409
      : result.message.includes("데이터 연결")
        ? 503
        : 500;

  return applyRateLimitHeaders(Response.json(result, { status }), rateLimit);
}
