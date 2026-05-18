import type { Hono } from "hono";

import { getPlaceById } from "@/features/places/queries";
import {
  adminPriceItemUpdateSchema,
  priceReportModerationSchema,
} from "@/features/places/write-schema";
import {
  getWorkerAdminPlacePriceDetail,
  listWorkerPendingPriceReports,
  moderateWorkerPriceReport,
  updateWorkerPriceItem,
} from "@/worker/admin-repository";
import {
  isWorkerDatabaseEnabled,
  isWorkerMockDataEnabled,
} from "@/worker/db";
import {
  requireAdminSession,
  type AdminBindings,
  type AdminRouteDependencies,
  type AdminVariables,
} from "@/worker/routes/admin-support";

export function registerAdminPriceRoutes(
  app: Hono<{
    Bindings: AdminBindings;
    Variables: AdminVariables;
  }>,
  dependencies: AdminRouteDependencies,
) {
  app.get("/api/admin/prices", async (c) => {
    const admin = requireAdminSession(c.req.raw, c.env, dependencies.noStoreHeaders);

    if (admin.response) {
      return admin.response;
    }

    if (!isWorkerDatabaseEnabled(c.env)) {
      if (!isWorkerMockDataEnabled(c.env)) {
        return dependencies.databaseUnavailableResponse(
          "가격 제보 검토 목록을 불러오지 못했습니다.",
        );
      }

      return c.json(
        {
          items: [],
          count: 0,
          source: "mock",
          mock: true,
        },
        200,
        dependencies.noStoreHeaders,
      );
    }

    try {
      const result = await dependencies.runWorkerDatabaseRoute(c.env, () =>
        listWorkerPendingPriceReports(c.env),
      );

      return c.json(
        {
          items: result.items,
          count: result.items.length,
          source: result.source,
          mock: false,
        },
        200,
        dependencies.noStoreHeaders,
      );
    } catch (error) {
      console.error("Failed to load worker admin pending prices.", error);

      return c.json(
        {
          ok: false,
          message: "가격 제보 검토 목록을 불러오지 못했습니다.",
        },
        500,
        dependencies.noStoreHeaders,
      );
    }
  });

  app.patch("/api/admin/prices/:id", async (c) => {
    const admin = requireAdminSession(c.req.raw, c.env, dependencies.noStoreHeaders);

    if (admin.response) {
      return admin.response;
    }

    const body = await c.req.json().catch(() => null);
    const parsed = priceReportModerationSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          message: "가격 제보 검토 입력값 검증에 실패했습니다.",
          error: parsed.error.flatten(),
        },
        400,
        dependencies.noStoreHeaders,
      );
    }

    if (!isWorkerDatabaseEnabled(c.env)) {
      if (!isWorkerMockDataEnabled(c.env)) {
        return dependencies.databaseUnavailableResponse(
          "가격 제보 검토 결과를 저장하지 못했습니다.",
        );
      }

      return c.json(
        {
          ok: true,
          message: "목업 모드에서는 가격 제보 검토 결과가 실제 저장되지 않습니다.",
          source: "mock",
          item: null,
        },
        200,
        dependencies.noStoreHeaders,
      );
    }

    try {
      const result = await dependencies.runWorkerDatabaseRoute(c.env, () =>
        moderateWorkerPriceReport(c.env, c.req.param("id"), parsed.data, admin.user),
      );

      return c.json(result, result.ok ? 200 : 404, dependencies.noStoreHeaders);
    } catch (error) {
      console.error("Failed to moderate worker price report.", error);

      return c.json(
        {
          ok: false,
          message: "가격 제보 검토 처리에 실패했습니다.",
          source: "database",
          item: null,
        },
        500,
        dependencies.noStoreHeaders,
      );
    }
  });

  app.get("/api/admin/prices/places/:id", async (c) => {
    const admin = requireAdminSession(c.req.raw, c.env, dependencies.noStoreHeaders);

    if (admin.response) {
      return admin.response;
    }

    if (!isWorkerDatabaseEnabled(c.env)) {
      if (!isWorkerMockDataEnabled(c.env)) {
        return dependencies.databaseUnavailableResponse("장소 가격 정보를 불러오지 못했습니다.");
      }

      const place = getPlaceById(c.req.param("id"));

      return c.json(
        {
          item: place
            ? {
                id: place.id,
                name: place.name,
                district: place.district,
                representativePriceAmount: place.representativePriceAmount,
                representativePriceLabel: place.representativePriceLabel,
                verificationStatus: place.verificationStatus,
                priceItems: place.priceItems.map((item) => ({
                  ...item,
                  verifiedReportCount:
                    item.verificationStatus === "verified" ? 2 : 0,
                  isRepresentative: item.label === place.representativePriceLabel,
                  isActive: true,
                })),
              }
            : null,
          source: "mock",
        },
        place ? 200 : 404,
        dependencies.noStoreHeaders,
      );
    }

    try {
      const result = await dependencies.runWorkerDatabaseRoute(c.env, () =>
        getWorkerAdminPlacePriceDetail(c.env, c.req.param("id")),
      );

      return c.json(
        result,
        result.item ? 200 : 404,
        dependencies.noStoreHeaders,
      );
    } catch (error) {
      console.error("Failed to load worker admin place price detail.", error);

      return c.json(
        {
          ok: false,
          message: "장소 가격 정보를 불러오지 못했습니다.",
        },
        500,
        dependencies.noStoreHeaders,
      );
    }
  });

  app.patch("/api/admin/price-items/:id", async (c) => {
    const admin = requireAdminSession(c.req.raw, c.env, dependencies.noStoreHeaders);

    if (admin.response) {
      return admin.response;
    }

    const body = await c.req.json().catch(() => null);
    const parsed = adminPriceItemUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          message: "가격 항목 수정 입력값 검증에 실패했습니다.",
          error: parsed.error.flatten(),
        },
        400,
        dependencies.noStoreHeaders,
      );
    }

    if (!isWorkerDatabaseEnabled(c.env)) {
      if (!isWorkerMockDataEnabled(c.env)) {
        return dependencies.databaseUnavailableResponse("가격 항목을 업데이트하지 못했습니다.");
      }

      return c.json(
        {
          ok: true,
          message: parsed.data.isActive
            ? "목업 가격 항목을 업데이트했습니다."
            : "목업 가격 항목을 숨겼습니다.",
          source: "mock",
          item: {
            id: c.req.param("id"),
            label: parsed.data.label,
            amount: parsed.data.amount,
            unitLabel: parsed.data.unitLabel || undefined,
            verificationStatus: parsed.data.verificationStatus,
            verifiedReportCount:
              parsed.data.verificationStatus === "verified" ? 2 : 0,
            reportedAt: new Date().toISOString().slice(0, 10),
            isRepresentative: parsed.data.isRepresentative,
            isActive: parsed.data.isActive,
          },
          placeId: null,
        },
        200,
        dependencies.noStoreHeaders,
      );
    }

    try {
      const result = await dependencies.runWorkerDatabaseRoute(c.env, () =>
        updateWorkerPriceItem(c.env, c.req.param("id"), parsed.data, admin.user),
      );
      const status = result.ok
        ? 200
        : result.message === "같은 이름의 가격 항목이 이미 있습니다."
          ? 400
          : 404;

      return c.json(result, status, dependencies.noStoreHeaders);
    } catch (error) {
      console.error("Failed to update worker price item.", error);

      return c.json(
        {
          ok: false,
          message: "가격 항목 업데이트에 실패했습니다.",
          source: "database",
          item: null,
          placeId: null,
        },
        500,
        dependencies.noStoreHeaders,
      );
    }
  });
}
