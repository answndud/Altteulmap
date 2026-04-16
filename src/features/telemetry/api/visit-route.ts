import { z } from "zod";

import { isDatabaseEnabled, markDatabaseUnavailable } from "@/db/client";
import { PLACE_SHARE_SOURCES } from "@/features/places/share";
import { recordVisitActivity } from "@/features/telemetry/repository";
import {
  getPublicWriteActor,
  setPublicWriteActorCookie,
} from "@/lib/public-write-actor";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

const visitPayloadSchema = z.object({
  path: z.string().trim().min(1).max(160),
  ref: z.enum(["share"]).optional(),
  scope: z.enum(["public", "admin"]).default("public"),
  source: z.enum(PLACE_SHARE_SOURCES).optional(),
}).superRefine((value, context) => {
  if (value.source && value.ref !== "share") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "공유 source는 ref=share와 함께 보내야 합니다.",
      path: ["source"],
    });
  }
});

export async function POST(request: Request) {
  const actor = await getPublicWriteActor(request, {
    createVisitorIfMissing: true,
  });

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    const response = Response.json(
      {
        ok: false,
        message: "방문 이벤트 입력값을 읽지 못했습니다.",
      },
      {
        status: 400,
        headers: noStoreHeaders,
      },
    );

    setPublicWriteActorCookie(response, actor, request);
    return response;
  }

  const parsed = visitPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    const response = Response.json(
      {
        ok: false,
        message: "방문 이벤트 입력값 검증에 실패했습니다.",
        error: parsed.error.flatten(),
      },
      {
        status: 400,
        headers: noStoreHeaders,
      },
    );

    setPublicWriteActorCookie(response, actor, request);
    return response;
  }

  try {
    const result = await recordVisitActivity({
      actorKey: actor.key,
      userId: actor.user?.id ?? null,
      visitorId: actor.visitorId,
      entryRef: parsed.data.ref ?? null,
      entrySource: parsed.data.source ?? null,
      path: parsed.data.path,
      scope: parsed.data.scope,
    });
    const response = Response.json(
      {
        ok: true,
        tracked: result.tracked,
        source: result.source,
      },
      {
        headers: noStoreHeaders,
      },
    );

    setPublicWriteActorCookie(response, actor, request);
    return response;
  } catch (error) {
    markDatabaseUnavailable(error);

    if (!isDatabaseEnabled()) {
      const response = Response.json(
        {
          ok: true,
          tracked: false,
          source: "mock",
        },
        {
          headers: noStoreHeaders,
        },
      );

      setPublicWriteActorCookie(response, actor, request);
      return response;
    }

    console.error("Failed to record visit activity.", error);

    const response = Response.json(
      {
        ok: false,
        message: "방문 이벤트를 기록하지 못했습니다.",
      },
      {
        status: 500,
        headers: noStoreHeaders,
      },
    );

    setPublicWriteActorCookie(response, actor, request);
    return response;
  }
}
