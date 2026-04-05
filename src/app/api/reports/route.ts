import { revalidateAfterReportSubmission } from "@/features/admin/revalidation";
import { createReportSubmission } from "@/features/reports/repository";
import { reportSubmissionSchema } from "@/features/reports/schema";
import {
  getPublicWriteActor,
  setPublicWriteActorCookie,
} from "@/lib/public-write-actor";
import {
  applyRateLimitHeaders,
  consumeRateLimitPolicy,
} from "@/lib/rate-limit";

export async function POST(request: Request) {
  const actor = await getPublicWriteActor(request);

  const rateLimit = consumeRateLimitPolicy(
    "contentReportSubmission",
    actor.key,
  );

  if (!rateLimit.ok) {
    const response = Response.json(
      {
        ok: false,
        message: "신고 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
        retryAfterMs: rateLimit.retryAfterMs,
      },
      { status: 429 },
    );

    setPublicWriteActorCookie(response, actor, request);

    return applyRateLimitHeaders(response, rateLimit);
  }

  const body = await request.json();
  const parsed = reportSubmissionSchema.safeParse(body);

  if (!parsed.success) {
    const response = Response.json(
      {
        ok: false,
        message: "신고 입력값 검증에 실패했습니다.",
        error: parsed.error.flatten(),
      },
      { status: 400 },
    );

    setPublicWriteActorCookie(response, actor, request);

    return applyRateLimitHeaders(response, rateLimit);
  }

  const result = await createReportSubmission(parsed.data, actor.user?.id ?? null);

  if (result.ok) {
    revalidateAfterReportSubmission();
  }

  const response = Response.json(result);
  setPublicWriteActorCookie(response, actor, request);
  return applyRateLimitHeaders(response, rateLimit);
}
