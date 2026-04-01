import "server-only";

import type { NextResponse } from "next/server";

import { getSessionUser, type SessionUser } from "@/lib/session";
import {
  createVisitorId,
  getVisitorIdFromCookie,
  setVisitorIdCookie,
} from "@/lib/visitor-id";

export type PublicWriteActor = {
  user: SessionUser | null;
  visitorId: string | null;
  key: string;
};

export async function getPublicWriteActor(
  request: Request,
  options?: {
    createVisitorIfMissing?: boolean;
  },
): Promise<PublicWriteActor> {
  const user = await getSessionUser();
  const createVisitorIfMissing = options?.createVisitorIfMissing ?? true;
  const existingVisitorId = user ? null : await getVisitorIdFromCookie();
  const visitorId = user
    ? null
    : (existingVisitorId ??
      (createVisitorIfMissing ? createVisitorId() : null));

  return {
    user,
    visitorId,
    key:
      user?.id ??
      visitorId ??
      request.headers.get("x-forwarded-for") ??
      "guest",
  };
}

export function setPublicWriteActorCookie(
  response: NextResponse,
  actor: PublicWriteActor,
  request: Request,
) {
  if (!actor.user && actor.visitorId) {
    setVisitorIdCookie(response, actor.visitorId, request.url);
  }
}
