import { sql } from "drizzle-orm";

import type { PlaceReactionType } from "@/features/places/types";
import {
  getWorkerDb,
  type WorkerDatabaseBindings,
} from "@/worker/db";
import {
  formatDate,
  toAuthorLabel,
  toPlaceRecord,
} from "@/worker/places/places-read-mappers";
import type {
  WorkerPlaceDetailResult,
  WorkerPlaceViewer,
} from "@/worker/places/places-read-types";

type DetailRow = {
  internal_id: string;
  slug: string;
  name: string;
  business_name: string | null;
  description: string | null;
  note: string | null;
  road_address: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
  primary_category_slug: string | null;
  representative_price_amount: number | null;
  representative_price_label: string | null;
  like_count: number;
  dislike_count: number;
  verified_price_item_count: number;
  last_price_updated_at: Date | string | null;
  price_items: Array<{
    id: string;
    label: string;
    amount: number;
    unitLabel: string | null;
    verificationStatus: "verified" | "unverified";
    latestReportedAt: string | null;
  }>;
  history: Array<{
    id: string;
    label: string;
    amount: number;
    verificationStatus: "verified" | "unverified";
    recordedAt: string;
  }>;
  comments: Array<{
    id: string;
    userId: string | null;
    visitorId: string | null;
    body: string;
    createdAt: string;
    nickname: string | null;
    email: string | null;
  }>;
  viewer_reaction: PlaceReactionType | null;
};

/**
 * 장소 상세를 쿼리 한 번으로 읽는다. 운영 DB가 멀어 쿼리 한 번의 왕복(약 0.4초)이 비용의 대부분이고,
 * Hyperdrive 경유에서는 한 연결의 쿼리가 사실상 순차로 처리돼 병렬화로는 줄지 않는다. 그래서
 * 가격·이력·코멘트·내 반응을 상관 서브쿼리의 JSON 집계로 한 행에 담아 왕복을 1회로 만든다.
 */
export async function getDatabasePlaceDetail(
  env: WorkerDatabaseBindings,
  slug: string,
  viewer: WorkerPlaceViewer,
): Promise<WorkerPlaceDetailResult> {
  const db = getWorkerDb(env);
  const viewerReaction = viewer?.userId
    ? sql`(select r.reaction_type from place_reactions r where r.place_id = p.id and r.user_id = ${viewer.userId} limit 1)`
    : viewer?.visitorId
      ? sql`(select r.reaction_type from place_reactions r where r.place_id = p.id and r.visitor_id = ${viewer.visitorId} limit 1)`
      : sql`null`;
  const rows = await db.execute<DetailRow>(sql`
    select
      p.id as internal_id, p.slug, p.name, p.business_name, p.description, p.note,
      p.road_address, p.district, p.latitude, p.longitude, p.primary_category_slug,
      p.representative_price_amount, p.representative_price_label,
      p.like_count, p.dislike_count, p.verified_price_item_count, p.last_price_updated_at,
      coalesce((
        select json_agg(json_build_object(
          'id', i.id, 'label', i.label, 'amount', i.amount, 'unitLabel', i.unit_label,
          'verificationStatus', i.verification_status, 'latestReportedAt', i.latest_reported_at
        ) order by i.is_representative desc, i.amount asc, i.label asc)
        from price_items i where i.place_id = p.id and i.is_active
      ), '[]'::json) as price_items,
      coalesce((
        select json_agg(json_build_object(
          'id', r.id, 'label', r.label, 'amount', r.amount,
          'verificationStatus', r.snapshot_verification_status, 'recordedAt', r.created_at
        ) order by r.created_at desc)
        from price_reports r where r.place_id = p.id and r.report_status = 'accepted'
      ), '[]'::json) as history,
      coalesce((
        select json_agg(json_build_object(
          'id', c.id, 'userId', c.user_id, 'visitorId', c.visitor_id, 'body', c.body,
          'createdAt', c.created_at, 'nickname', u.nickname, 'email', u.email
        ) order by c.created_at desc)
        from comments c left join users u on u.id = c.user_id
        where c.place_id = p.id and c.status = 'visible'
      ), '[]'::json) as comments,
      ${viewerReaction} as viewer_reaction
    from places p
    where p.slug = ${slug} and p.status = 'active'
    limit 1
  `);
  const row = rows[0];

  if (!row) {
    return {
      item: null,
      source: "database",
    };
  }

  return {
    item: toPlaceRecord(
      {
        internalId: row.internal_id,
        slug: row.slug,
        name: row.name,
        businessName: row.business_name,
        description: row.description,
        note: row.note,
        roadAddress: row.road_address,
        district: row.district,
        latitude: row.latitude,
        longitude: row.longitude,
        primaryCategorySlug: row.primary_category_slug,
        representativePriceAmount: row.representative_price_amount,
        representativePriceLabel: row.representative_price_label,
        likeCount: row.like_count,
        dislikeCount: row.dislike_count,
        verifiedPriceItemCount: row.verified_price_item_count,
        lastPriceUpdatedAt:
          row.last_price_updated_at === null
            ? null
            : new Date(row.last_price_updated_at),
      },
      {
        priceItems: row.price_items.map((priceItem) => ({
          id: priceItem.id,
          label: priceItem.label,
          amount: priceItem.amount,
          unitLabel: priceItem.unitLabel ?? undefined,
          verificationStatus: priceItem.verificationStatus,
          reportedAt: formatDate(priceItem.latestReportedAt),
        })),
        history: row.history.map((history) => ({
          id: history.id,
          label: history.label,
          amount: history.amount,
          verificationStatus: history.verificationStatus,
          recordedAt: formatDate(history.recordedAt),
        })),
        comments: row.comments.map((comment) => ({
          id: comment.id,
          authorLabel: toAuthorLabel(comment.nickname, comment.email, "익명"),
          body: comment.body,
          createdAt: formatDate(comment.createdAt),
          canDelete:
            viewer?.role === "admin" ||
            (Boolean(comment.userId) && viewer?.userId === comment.userId) ||
            (Boolean(comment.visitorId) && viewer?.visitorId === comment.visitorId),
        })),
        reactionSummary: {
          likeCount: row.like_count,
          dislikeCount: row.dislike_count,
          viewerReaction: row.viewer_reaction ?? null,
        },
      },
    ),
    source: "database",
  };
}
