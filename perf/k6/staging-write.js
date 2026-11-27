/* global __ENV, __ITER */
// staging Worker(운영과 같은 Cloudflare → Hyperdrive → VPS 경로, 운영과 분리된 DB)에 가격 제보와 로그인을 순차로 보내
// 요청 하나의 지연을 잰다. 처리량 시험이 아니라 쓰기·인증 경로의 요청당 지연(구문·연결 수의 효과)을 보는 용도다.
// rate limit은 운영과 같이 걸려 있어 한 번에 많이 보내지 않고, 러너가 라운드 사이에 staging 버킷을 비운다.
//   BASE_URL=https://altteulmap-staging.altteul-lab.workers.dev ITERS=8 k6 run perf/k6/staging-write.js
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "https://altteulmap-staging.altteul-lab.workers.dev";
const ITERS = Number(__ENV.ITERS || 8);

if (!BASE_URL.includes("staging")) {
  throw new Error("staging URL이 아니면 실행하지 않는다(운영에 쓰기를 보내지 않기 위한 안전장치).");
}

const priceMs = new Trend("price_report_ms", true);
const loginMs = new Trend("login_ms", true);
const priceLimited = new Counter("price_report_429");
const loginLimited = new Counter("login_429");
const priceOther = new Counter("price_report_other");
const loginOther = new Counter("login_other");

export const options = {
  scenarios: {
    sequential: { executor: "per-vu-iterations", vus: 1, iterations: ITERS, maxDuration: "5m" },
  },
  summaryTrendStats: ["avg", "p(50)", "p(95)", "max"],
};

const JSON_HEADERS = {
  "Content-Type": "application/json",
  Origin: BASE_URL,
  "Sec-Fetch-Site": "same-origin",
};

export function setup() {
  const ids = (http
    .get(`${BASE_URL}/api/places/map?minLat=37.558&maxLat=37.575&minLng=126.977&maxLng=126.979&zoom=15`)
    .json("items") || []).map((item) => item.id).slice(0, 20);
  const email = `k6-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
  const password = `k6-password-${Math.floor(Math.random() * 1e9)}`;
  const signup = http.post(
    `${BASE_URL}/api/auth/signup`,
    JSON.stringify({ email, password, nickname: "k6 staging" }),
    { headers: JSON_HEADERS },
  );

  if (ids.length === 0 || signup.status >= 300) {
    throw new Error(`setup 실패: places=${ids.length} signup=${signup.status} ${String(signup.body).slice(0, 120)}`);
  }

  return { ids, email, password };
}

export default function (data) {
  // 반복마다 새 visitor로 요청해 visitor 단위 한도가 아니라 요청 경로 자체를 잰다.
  http.cookieJar().clear(BASE_URL);

  const id = data.ids[__ITER % data.ids.length];
  const price = http.post(
    `${BASE_URL}/api/places/${id}/prices`,
    JSON.stringify({
      label: `k6 staging ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      amount: 5000 + Math.floor(Math.random() * 5000),
      turnstileToken: "staging-always-pass",
    }),
    { headers: JSON_HEADERS, responseCallback: http.expectedStatuses({ min: 200, max: 299 }, 429) },
  );

  if (price.status >= 200 && price.status < 300) {
    priceMs.add(price.timings.duration);
  } else if (price.status === 429) {
    priceLimited.add(1);
  } else {
    priceOther.add(1);
    console.log(`price status=${price.status} body=${String(price.body).slice(0, 120)}`);
  }

  const csrf = http.get(`${BASE_URL}/api/auth/csrf`).json("csrfToken");
  const login = http.post(
    `${BASE_URL}/api/auth/callback/credentials`,
    JSON.stringify({ email: data.email, password: data.password, csrfToken: csrf, json: "true" }),
    { headers: JSON_HEADERS, responseCallback: http.expectedStatuses({ min: 200, max: 299 }, 429) },
  );

  if (login.status >= 200 && login.status < 300) {
    loginMs.add(login.timings.duration);
  } else if (login.status === 429) {
    loginLimited.add(1);
  } else {
    loginOther.add(1);
    console.log(`login status=${login.status} body=${String(login.body).slice(0, 120)}`);
  }

  check(price, { "price ok or limited": (r) => (r.status >= 200 && r.status < 300) || r.status === 429 });
  check(login, { "login ok or limited": (r) => (r.status >= 200 && r.status < 300) || r.status === 429 });
  sleep(0.5);
}
