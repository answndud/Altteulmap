/* global __ENV */
// 운영 읽기 전용 저강도 부하. 쓰기는 보내지 않고, 에러율 1% 초과 또는 p95 3초 초과가 10초 이상 이어지면 즉시 중단한다.
//   k6 run perf/k6/prod-read.js
import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL || "https://altteulmap.altteul-lab.workers.dev";
const Z11 = "/api/places/map?minLat=37.4133&maxLat=37.7151&minLng=126.7341&maxLng=127.2693&zoom=11";
const Z15 = "/api/places/map?minLat=37.558&maxLat=37.575&minLng=126.977&maxLng=126.979&zoom=15";

export const options = {
  scenarios: {
    // 모든 방문자가 같은 URL을 요청하는 첫 화면: 대부분 엣지 캐시 적중·stale이다.
    first_screen_cached: {
      executor: "constant-vus", exec: "firstScreen", vus: 6, duration: "2m",
    },
    // 엣지·isolate 캐시를 우회해 DB까지 가는 요청(진짜 미스). 공유 VPS 보호를 위해 2 VU로 제한한다.
    map_uncached: {
      executor: "constant-vus", exec: "mapUncached", vus: 2, duration: "2m",
    },
    detail_mixed: {
      executor: "constant-vus", exec: "detailMixed", vus: 4, duration: "2m",
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: "rate<0.01", abortOnFail: true, delayAbortEval: "10s" }],
    http_req_duration: [{ threshold: "p(95)<3000", abortOnFail: true, delayAbortEval: "10s" }],
    "http_req_duration{scenario:first_screen_cached}": ["p(95)<1500"],
    "http_req_duration{scenario:map_uncached}": ["p(95)<2500"],
    "http_req_duration{scenario:detail_mixed}": ["p(95)<1500"],
  },
  summaryTrendStats: ["avg", "p(50)", "p(90)", "p(95)", "max"],
};

export function setup() {
  const ids = (http.get(`${BASE_URL}${Z15}`).json("items") || []).map((item) => item.id).slice(0, 20);

  if (ids.length === 0) {
    throw new Error("상세 시나리오에 쓸 장소를 찾지 못했다");
  }

  return { ids };
}

// 실패 원인을 알 수 있게 비정상 응답은 모두 로그로 남긴다(읽기 전용이라 양이 적다).
function logFailure(label, response) {
  if (response.status !== 200) {
    console.log(`${label} status=${response.status} err=${response.error} body=${String(response.body).slice(0, 120)}`);
  }
}

export function firstScreen() {
  const response = http.get(`${BASE_URL}${Z11}`, { tags: { name: "first_screen" } });

  logFailure("first_screen", response);
  check(response, { "200": (r) => r.status === 200 });
}

export function mapUncached() {
  const response = http.get(`${BASE_URL}${Z11}&refresh=1&_=${Math.random()}`, { tags: { name: "map_uncached" } });

  logFailure("map_uncached", response);
  check(response, { "200": (r) => r.status === 200 });
}

export function detailMixed(data) {
  const id = data.ids[Math.floor(Math.random() * data.ids.length)];

  const response = http.get(`${BASE_URL}/api/places/${id}`, { tags: { name: "detail" } });

  logFailure("detail", response);
  check(response, { "200": (r) => r.status === 200 });
}
