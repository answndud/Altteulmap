import fs from "node:fs";

import { parse } from "dotenv";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  adminActions,
  contentReports,
  places,
  priceItems,
  priceReports,
} from "@/db/schema";
import { normalizePriceLabel } from "@/features/places/normalization";

const DEFAULT_BASE_URL = "https://altteulmap.altteul-lab.workers.dev";

function loadProductionEnv() {
  const envFile = process.env.QA_ENV_FILE ?? ".env.production.local";

  if (!fs.existsSync(envFile)) {
    throw new Error(`${envFile} is missing.`);
  }

  return parse(fs.readFileSync(envFile));
}

function getSetCookies(headers: Headers) {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] })
    .getSetCookie;

  if (typeof getSetCookie === "function") {
    return getSetCookie.call(headers);
  }

  const setCookie = headers.get("set-cookie");

  return setCookie ? [setCookie] : [];
}

function createCookieHeader(cookies: string[]) {
  return cookies
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function requestJson<T>(
  baseUrl: string,
  pathname: string,
  options: RequestInit,
  cookieHeader: string,
  label: string,
) {
  const response = await fetch(new URL(pathname, baseUrl), {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
  });
  const body = (await response.json().catch(() => null)) as T | null;

  if (!response.ok || (body && typeof body === "object" && "ok" in body && body.ok === false)) {
    throw new Error(`${label} failed: status=${response.status} body=${JSON.stringify(body)}`);
  }

  return body as T;
}

async function loginAsAdmin(baseUrl: string, password: string) {
  const response = await fetch(new URL("/api/auth/callback/credentials", baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      email: "admin@altteulmap.local",
      password,
      callbackUrl: "/admin",
      json: "true",
    }),
  });

  if (!response.ok) {
    throw new Error(`admin login failed: status=${response.status}`);
  }

  const cookieHeader = createCookieHeader(getSetCookies(response.headers));

  if (!cookieHeader.includes("next-auth.session-token=")) {
    throw new Error("admin session cookie missing.");
  }

  return cookieHeader;
}

async function main() {
  const env = loadProductionEnv();
  const baseUrl = process.env.QA_PUBLIC_URL ?? DEFAULT_BASE_URL;
  const databaseUrl = env.DATABASE_URL;
  const adminPassword = env.AUTH_ADMIN_PASSWORD;

  if (!databaseUrl || !adminPassword) {
    throw new Error("DATABASE_URL and AUTH_ADMIN_PASSWORD are required.");
  }

  const client = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 8,
  });
  const db = drizzle(client);
  const cookieHeader = await loginAsAdmin(baseUrl, adminPassword);
  const suffix = Date.now().toString();
  const placeApprovalSlug = `prod-qa-place-${suffix}`;
  const pricePlaceSlug = `prod-qa-price-place-${suffix}`;
  const reportPlaceSlug = `prod-qa-report-place-${suffix}`;
  const priceLabel = `운영QA가격${suffix.slice(-5)}`;
  const normalizedPriceLabel = normalizePriceLabel(priceLabel);
  const touchedPlaceIds: string[] = [];
  const touchedPriceReportIds: string[] = [];
  const touchedContentReportIds: string[] = [];

  try {
    const [pendingPlace] = await db
      .insert(places)
      .values({
        slug: placeApprovalSlug,
        name: `운영 QA 장소 승인 ${suffix}`,
        roadAddress: "서울특별시 중구 세종대로 110",
        district: "서울 중구",
        latitude: null,
        longitude: null,
        status: "pending_review",
        primaryCategorySlug: "korean",
        representativePriceAmount: 9100,
        representativePriceLabel: "운영 QA 메뉴",
        note: "운영 QA 후 삭제되는 임시 장소입니다.",
      })
      .returning({ id: places.id });
    touchedPlaceIds.push(pendingPlace.id);

    await db.insert(priceItems).values({
      placeId: pendingPlace.id,
      label: "운영 QA 메뉴",
      normalizedLabel: normalizePriceLabel("운영 QA 메뉴"),
      amount: 9100,
      unitLabel: "1인분",
      isActive: true,
      verificationStatus: "unverified",
      latestReportedAt: new Date(),
    });

    const [pricePlace] = await db
      .insert(places)
      .values({
        slug: pricePlaceSlug,
        name: `운영 QA 가격 장소 ${suffix}`,
        roadAddress: "서울특별시 중구 세종대로 110",
        district: "서울 중구",
        latitude: 37.5665,
        longitude: 126.978,
        status: "active",
        primaryCategorySlug: "korean",
      })
      .returning({ id: places.id });
    touchedPlaceIds.push(pricePlace.id);

    const [priceReport] = await db
      .insert(priceReports)
      .values({
        placeId: pricePlace.id,
        label: priceLabel,
        normalizedLabel: normalizedPriceLabel,
        amount: 4321,
        unitLabel: "1개",
        comment: "운영 QA 가격 제보 승인 테스트",
        reportStatus: "pending_review",
      })
      .returning({ id: priceReports.id });
    touchedPriceReportIds.push(priceReport.id);

    const [reportPlace] = await db
      .insert(places)
      .values({
        slug: reportPlaceSlug,
        name: `운영 QA 신고 장소 ${suffix}`,
        roadAddress: "서울특별시 중구 세종대로 110",
        district: "서울 중구",
        latitude: 37.5665,
        longitude: 126.978,
        status: "active",
        primaryCategorySlug: "korean",
      })
      .returning({ id: places.id });
    touchedPlaceIds.push(reportPlace.id);

    const [contentReport] = await db
      .insert(contentReports)
      .values({
        targetType: "place",
        targetId: reportPlace.id,
        reasonType: "price_error",
        detail: `운영 QA 신고 처리 테스트 ${suffix}`,
        status: "open",
      })
      .returning({ id: contentReports.id });
    touchedContentReportIds.push(contentReport.id);

    const placeList = await requestJson<{ items: Array<{ id: string }> }>(
      baseUrl,
      "/api/admin/places",
      {},
      cookieHeader,
      "admin pending places list",
    );

    if (!placeList.items.some((item) => item.id === placeApprovalSlug)) {
      throw new Error("pending place was not visible in admin list.");
    }

    const placeApprove = await requestJson<{ message: string }>(
      baseUrl,
      `/api/admin/places/${placeApprovalSlug}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "approve",
          latitude: 37.5665,
          longitude: 126.978,
        }),
      },
      cookieHeader,
      "admin place approve",
    );

    const priceList = await requestJson<{ items: Array<{ id: string }> }>(
      baseUrl,
      "/api/admin/prices",
      {},
      cookieHeader,
      "admin pending prices list",
    );

    if (!priceList.items.some((item) => item.id === priceReport.id)) {
      throw new Error("pending price report was not visible in admin list.");
    }

    const priceApprove = await requestJson<{ message: string }>(
      baseUrl,
      `/api/admin/prices/${priceReport.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "approve" }),
      },
      cookieHeader,
      "admin price approve",
    );

    const reportList = await requestJson<{ items: Array<{ id: string }> }>(
      baseUrl,
      "/api/admin/reports",
      {},
      cookieHeader,
      "admin reports list",
    );

    if (!reportList.items.some((item) => item.id === contentReport.id)) {
      throw new Error("content report was not visible in admin list.");
    }

    const reportResolve = await requestJson<{ item: { status: string } }>(
      baseUrl,
      `/api/admin/reports/${contentReport.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      },
      cookieHeader,
      "admin report resolve",
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          placeApproval: placeApprove.message,
          priceApproval: priceApprove.message,
          reportStatus: reportResolve.item.status,
          visibility: {
            pendingPlaceVisible: true,
            pendingPriceVisible: true,
            reportVisible: true,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    const targetIds = [
      ...touchedPlaceIds,
      ...touchedPriceReportIds,
      ...touchedContentReportIds,
    ];

    if (targetIds.length > 0) {
      await db.delete(adminActions).where(inArray(adminActions.targetId, targetIds));
    }

    if (touchedContentReportIds.length > 0) {
      await db
        .delete(contentReports)
        .where(inArray(contentReports.id, touchedContentReportIds));
    }

    if (touchedPriceReportIds.length > 0) {
      await db
        .delete(priceReports)
        .where(inArray(priceReports.id, touchedPriceReportIds));
    }

    if (touchedPlaceIds.length > 0) {
      await db.delete(places).where(inArray(places.id, touchedPlaceIds));
    }

    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
