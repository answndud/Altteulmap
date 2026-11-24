/* global __ENV, __VU, __ITER */
// 로컬(빌드한 Worker + Docker Postgres) 혼합 부하. 지도·상세 읽기는 모든 캐시를 우회(refresh=1)해 DB 경로를 잰다.
// 쓰기는 반복마다 새 visitor(쿠키 초기화)로 가격 제보를 보내, rate limit이 아니라 쓰기 경로 자체의 용량을 잰다.
//   BASE_URL=http://127.0.0.1:8799 k6 run perf/k6/local-mixed.js
import http from "k6/http";
import { check } from "k6";
import { Counter, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:8799";
// 초당 요청 수(전체)의 정점. 시나리오별 비율은 아래 SHARE로 나눈다.
const PEAK_RPS = Number(__ENV.PEAK_RPS || 80);
const SHARE = { map_z11: 0.3, map_z15: 0.3, detail: 0.3, write_price: 0.1 };
const MAP_Z11 =
  "/api/places/map?minLat=37.4133&maxLat=37.7151&minLng=126.7341&maxLng=127.2693&zoom=11&refresh=1";
const MAP_Z15 =
  "/api/places/map?minLat=37.558&maxLat=37.575&minLng=126.977&maxLng=126.979&zoom=15&refresh=1";

const mapDb = new Trend("map_db_ms");
const writeOk = new Counter("write_accepted");
const writeLimited = new Counter("write_rate_limited");

// 닫힌 VU 루프는 서버가 느려지면 실패 응답에도 쉬지 않고 몰아쳐 스스로 무너진다.
// 도착률(arrival rate)로 목표 처리량을 직접 지정해 "처리량 대비 지연" 곡선을 본다.
function scenario(exec, share) {
  const peak = Math.max(1, Math.round(PEAK_RPS * share));

  return {
    executor: "ramping-arrival-rate",
    exec,
    startRate: Math.max(1, Math.round(peak / 8)),
    timeUnit: "1s",
    preAllocatedVUs: Math.max(10, peak * 2),
    maxVUs: Math.max(50, peak * 8),
    stages: [
      { duration: "15s", target: Math.max(1, Math.round(peak / 4)) },
      { duration: "20s", target: Math.max(1, Math.round(peak / 2)) },
      { duration: "25s", target: peak },
      { duration: "20s", target: peak },
      { duration: "10s", target: 1 },
    ],
  };
}

export const options = {
  scenarios: {
    map_z11: scenario("mapZ11", SHARE.map_z11),
    map_z15: scenario("mapZ15", SHARE.map_z15),
    detail: scenario("detail", SHARE.detail),
    write_price: scenario("writePrice", SHARE.write_price),
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    dropped_iterations: ["count<1"],
    "http_req_duration{scenario:map_z11}": ["p(95)<500"],
    "http_req_duration{scenario:map_z15}": ["p(95)<300"],
    "http_req_duration{scenario:detail}": ["p(95)<300"],
    "http_req_duration{scenario:write_price}": ["p(95)<500"],
  },
  summaryTrendStats: ["avg", "p(50)", "p(90)", "p(95)", "max"],
};

export function setup() {
  const response = http.get(`${BASE_URL}${MAP_Z15}`);
  const ids = (response.json("items") || []).map((item) => item.id).slice(0, 50);

  if (ids.length === 0) {
    throw new Error("상세·쓰기 시나리오에 쓸 장소를 찾지 못했다");
  }

  return { ids };
}

// 실패 원인을 알 수 있게 비정상 응답을 아주 드물게 로그로 남긴다.
function sampleFailure(response) {
  if (response.status !== 200 && Math.random() < 0.05) {
    console.log(`status=${response.status} err=${response.error} code=${response.error_code} body=${String(response.body).slice(0, 120)}`);
  }
}

function dbTime(response) {
  const match = /db;dur=([\d.]+)/.exec(response.headers["Server-Timing"] || "");

  if (match) {
    mapDb.add(Number(match[1]));
  }
}

export function mapZ11() {
  const response = http.get(`${BASE_URL}${MAP_Z11}&_=${Math.random()}`, { tags: { name: "map_z11" } });

  dbTime(response);
  sampleFailure(response);
  check(response, { "map z11 200": (r) => r.status === 200 });
}

export function mapZ15() {
  const response = http.get(`${BASE_URL}${MAP_Z15}&_=${Math.random()}`, { tags: { name: "map_z15" } });

  dbTime(response);
  check(response, { "map z15 200": (r) => r.status === 200 });
}

export function detail(data) {
  const id = data.ids[Math.floor(Math.random() * data.ids.length)];
  const response = http.get(`${BASE_URL}/api/places/${id}?_=${Math.random()}`, { tags: { name: "detail" } });

  check(response, { "detail 200": (r) => r.status === 200 });
}

export function writePrice(data) {
  // 반복마다 새 visitor·새 IP로 요청해 rate limit이 아니라 쓰기 경로 자체의 용량을 잰다.
  // (운영에서는 Cloudflare 엣지가 CF-Connecting-IP를 덮어쓰므로 이 헤더로 우회할 수 없다.)
  http.cookieJar().clear(BASE_URL);
  const fakeIp = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
  const id = data.ids[Math.floor(Math.random() * data.ids.length)];
  const response = http.post(
    `${BASE_URL}/api/places/${id}/prices`,
    JSON.stringify({
      label: `k6 부하 ${__VU}-${__ITER}-${Math.random().toString(36).slice(2, 8)}`,
      amount: 5000 + Math.floor(Math.random() * 5000),
      turnstileToken: __ENV.TURNSTILE_BYPASS_TOKEN || "k6-local-bypass",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Origin: BASE_URL,
        "Sec-Fetch-Site": "same-origin",
        "CF-Connecting-IP": fakeIp,
      },
      tags: { name: "write_price" },
      responseCallback: http.expectedStatuses({ min: 200, max: 299 }, 429),
    },
  );

  if (response.status === 429) {
    writeLimited.add(1);
  } else if (response.status >= 200 && response.status < 300) {
    writeOk.add(1);
  }

  check(response, { "write accepted": (r) => (r.status >= 200 && r.status < 300) || r.status === 429 });
}
