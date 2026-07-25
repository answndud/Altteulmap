import { createHash } from "node:crypto";

import type { WorkerPublicWriteActor } from "@/worker/public-write-actor";

function getPriceReportActorIdentity(actor: WorkerPublicWriteActor) {
  if (actor.user?.id) {
    return `user:${actor.user.id}`;
  }

  if (actor.visitorId) {
    return `visitor:${actor.visitorId}`;
  }

  return `anonymous:${actor.key}`;
}

export function getPriceReportSubmissionKey(
  placeId: string,
  actor: WorkerPublicWriteActor,
  normalizedLabel: string,
  amount: number,
  unitLabel: string | null,
) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        placeId,
        getPriceReportActorIdentity(actor),
        normalizedLabel,
        amount,
        unitLabel ?? "",
      ]),
    )
    .digest("hex");
}
