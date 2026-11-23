import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { places } from "../../src/db/schema";
import {
  closeWorkerDatabaseConnection,
  getWorkerDb,
  withWorkerDatabaseConnection,
} from "../../src/worker/db";
import {
  getClusterOnlyMapMarkers,
  getMapMarkerMode,
} from "../../src/worker/places/places-read-markers";
import { toPlacePreviewRecords } from "../../src/worker/places/places-read-mappers";
import { listDatabaseMapPlaces } from "../../src/worker/places/places-read-map-repository";
import { assertTestDatabaseReady, getTestDatabaseUrl } from "./test-database";

const workerEnv = {
  DATABASE_URL: getTestDatabaseUrl(),
  USE_MOCK_DATA: "false",
};
// 다른 통합 테스트의 fixture 장소(경도 127.0)가 병렬로 생겼다 지워져도 건수가 흔들리지 않게 그 경도를 뺀다.
const wide = { minLat: 37.4133, maxLat: 37.7151, minLng: 126.7341, maxLng: 126.999 };

before(async () => {
  await assertTestDatabaseReady();
});

after(async () => {
  await closeWorkerDatabaseConnection();
});

test("클러스터 모드는 전체 행 대신 격자 집계를 쓰되 JS 클러스터링과 같은 결과를 낸다", async () => {
  await withWorkerDatabaseConnection(workerEnv, async () => {
    const db = getWorkerDb(workerEnv);
    const result = await listDatabaseMapPlaces(workerEnv, {
      bounds: wide,
      zoom: 11,
      skipCache: true,
    });
    // 기준: 같은 조건의 전체 행을 가져와 기존 JS 방식으로 클러스터링한다.
    // 기존 경로는 (위도, 경도, id) 순으로 읽은 행을 클러스터링했으므로 같은 순서로 맞춘다.
    const allRows = (await db.select().from(places)).sort(
      (left, right) =>
        Number(left.latitude) - Number(right.latitude) ||
        Number(left.longitude) - Number(right.longitude) ||
        left.id.localeCompare(right.id),
    );
    const inBounds = toPlacePreviewRecords(
      allRows
        .filter(
          (row) =>
            row.status === "active" &&
            row.latitude !== null && row.longitude !== null &&
            row.latitude >= wide.minLat && row.latitude <= wide.maxLat &&
            row.longitude >= wide.minLng && row.longitude <= wide.maxLng,
        )
        .map((row) => ({
          internalId: row.id,
          slug: row.slug,
          name: row.name,
          businessName: row.businessName,
          description: row.description,
          note: row.note,
          roadAddress: row.roadAddress,
          district: row.district,
          latitude: row.latitude,
          longitude: row.longitude,
          primaryCategorySlug: row.primaryCategorySlug,
          representativePriceAmount: row.representativePriceAmount,
          representativePriceLabel: row.representativePriceLabel,
          likeCount: row.likeCount,
          dislikeCount: row.dislikeCount,
          verifiedPriceItemCount: row.verifiedPriceItemCount,
          lastPriceUpdatedAt: row.lastPriceUpdatedAt,
        })),
    );

    assert.equal(result.count, inBounds.length);
    assert.equal(result.markerMode, getMapMarkerMode(inBounds.length, 11, null));
    assert.equal(result.markerMode, "cluster", "시드 데이터가 클러스터 모드가 될 만큼 있어야 한다");

    const expected = getClusterOnlyMapMarkers(inBounds, wide, null, 11).filter(
      (marker) => marker.kind === "cluster",
    );
    const actual = result.mapMarkers.filter((marker) => marker.kind === "cluster");

    assert.equal(actual.length, expected.length);
    assert.equal(
      actual.reduce((sum, marker) => sum + marker.placeCount, 0),
      inBounds.length,
    );

    for (const [index, marker] of actual.entries()) {
      const want = expected[index];

      assert.equal(marker.id, want?.id);
      assert.equal(marker.placeCount, want?.placeCount);
      assert.ok(Math.abs(marker.latitude - (want?.latitude ?? 0)) < 1e-9);
      assert.ok(Math.abs(marker.longitude - (want?.longitude ?? 0)) < 1e-9);
      assert.deepEqual(marker.bounds, want?.bounds);
      assert.equal(marker.minPriceAmount, want?.minPriceAmount);
      // 작은 클러스터의 previewPlaces도 기존 방식과 같은 장소·순서다.
      assert.deepEqual(
        marker.previewPlaces?.map((place) => place.id),
        want?.previewPlaces?.map((place) => place.id),
      );
    }

    // 목록은 가격 오름차순 상위 100건만 온다.
    assert.equal(result.items.length, Math.min(100, inBounds.length));
    const prices = result.items.map((item) => item.representativePriceAmount);

    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
  });
});

test("개별 마커 모드는 좁은 영역에서 전체 행을 그대로 돌려준다", async () => {
  await withWorkerDatabaseConnection(workerEnv, async () => {
    const narrow = { minLat: 37.5655, maxLat: 37.5665, minLng: 126.9775, maxLng: 126.9785 };
    const result = await listDatabaseMapPlaces(workerEnv, {
      bounds: narrow,
      zoom: 17,
      skipCache: true,
    });

    assert.equal(result.markerMode, "place");
    assert.equal(result.items.length, result.count);
    assert.equal(
      result.mapMarkers.filter((marker) => marker.kind === "place").length,
      result.count,
    );
  });
});
