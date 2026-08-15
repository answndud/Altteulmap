import {
  assertWorkerDatabaseReadEnabled,
  isWorkerDatabaseConnectivityError,
  isWorkerDatabaseEnabled,
  isWorkerMockDataEnabled,
  markWorkerDatabaseUnavailable,
  WorkerDatabaseUnavailableError,
  type WorkerDatabaseBindings,
  withWorkerDatabaseReadTimeout,
} from "@/worker/db";
import { getDatabasePlaceDetail } from "@/worker/places-read-detail-repository";
import { listDatabaseMapPlaces } from "@/worker/places-read-map-repository";
import {
  getMockPlaceDetail,
  listMockMapPlaces,
} from "@/worker/places-read-mock";
import type {
  PlaceQuery,
  WorkerPlaceViewer,
} from "@/worker/places-read-types";
export type { WorkerPlaceViewer } from "@/worker/places-read-types";

export async function listWorkerMapPlaces(
  env: WorkerDatabaseBindings,
  query: PlaceQuery = {},
) {
  if (!isWorkerDatabaseEnabled(env)) {
    if (isWorkerMockDataEnabled(env)) {
      return listMockMapPlaces(query);
    }

    assertWorkerDatabaseReadEnabled(env, "listWorkerMapPlaces");
  }

  try {
    return await withWorkerDatabaseReadTimeout(env, "listWorkerMapPlaces", () =>
      listDatabaseMapPlaces(env, query),
    );
  } catch (error) {
    if (isWorkerDatabaseConnectivityError(error)) {
      markWorkerDatabaseUnavailable();
    }
    console.error(
      "Failed to load worker map places from database.",
      error,
    );
    throw new WorkerDatabaseUnavailableError(
      "지도 장소 목록을 운영 DB에서 불러오지 못했습니다.",
    );
  }
}

export async function getWorkerPlaceDetail(
  env: WorkerDatabaseBindings,
  slug: string,
  viewer: WorkerPlaceViewer,
) {
  if (!isWorkerDatabaseEnabled(env)) {
    if (isWorkerMockDataEnabled(env)) {
      return getMockPlaceDetail(slug, viewer);
    }

    assertWorkerDatabaseReadEnabled(env, "getWorkerPlaceDetail");
  }

  try {
    return await withWorkerDatabaseReadTimeout(env, "getWorkerPlaceDetail", () =>
      getDatabasePlaceDetail(env, slug, viewer),
    );
  } catch (error) {
    if (isWorkerDatabaseConnectivityError(error)) {
      markWorkerDatabaseUnavailable();
    }
    console.error(
      "Failed to load worker place detail from database.",
      error,
    );
    throw new WorkerDatabaseUnavailableError(
      "장소 상세 정보를 운영 DB에서 불러오지 못했습니다.",
    );
  }
}
