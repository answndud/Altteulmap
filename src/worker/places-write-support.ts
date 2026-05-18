import { and, eq } from "drizzle-orm";

import { places } from "@/db/schema";
import { getWorkerDb } from "@/worker/db";

export type DataSource = "database";
export type WorkerDb = ReturnType<typeof getWorkerDb>;
export type WorkerDbTransaction = Parameters<
  Parameters<WorkerDb["transaction"]>[0]
>[0];
export type WorkerDbExecutor = WorkerDb | WorkerDbTransaction;

export async function getActivePlaceIdentityBySlug(
  db: WorkerDbExecutor,
  slug: string,
) {
  const [placeRow] = await db
    .select({
      id: places.id,
      slug: places.slug,
      name: places.name,
      district: places.district,
    })
    .from(places)
    .where(and(eq(places.slug, slug), eq(places.status, "active")))
    .limit(1);

  return placeRow ?? null;
}
