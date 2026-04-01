const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const demoPassword = process.env.AUTH_DEMO_PASSWORD ?? "demo1234";
const adminPassword = process.env.AUTH_ADMIN_PASSWORD ?? "admin1234";

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  addFromResponse(response) {
    const setCookie =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [];

    for (const cookie of setCookie) {
      const [pair] = cookie.split(";", 1);

      if (!pair) {
        continue;
      }

      const separatorIndex = pair.indexOf("=");

      if (separatorIndex <= 0) {
        continue;
      }

      const key = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      this.cookies.set(key, value);
    }
  }

  toHeader() {
    return Array.from(this.cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }
}

function logStep(label, detail) {
  console.log(`- ${label}: ${detail}`);
}

async function request(pathname, options = {}, jar) {
  const headers = new Headers(options.headers ?? {});

  if (jar) {
    const cookieHeader = jar.toHeader();

    if (cookieHeader) {
      headers.set("cookie", cookieHeader);
    }
  }

  const response = await fetch(new URL(pathname, baseUrl), {
    ...options,
    headers,
    redirect: "manual",
  });

  if (jar) {
    jar.addFromResponse(response);
  }

  return response;
}

async function expectOk(pathname, matcher) {
  const response = await request(pathname);

  if (!response.ok) {
    throw new Error(`${pathname} returned ${response.status}`);
  }

  const body = await response.text();

  if (!matcher(body)) {
    throw new Error(`${pathname} response did not match expected content`);
  }
}

async function loginWithCredentials(email, password) {
  const jar = new CookieJar();
  const csrfResponse = await request("/api/auth/csrf", {}, jar);

  if (!csrfResponse.ok) {
    throw new Error(`csrf request failed with ${csrfResponse.status}`);
  }

  const csrfPayload = await csrfResponse.json();
  const form = new URLSearchParams({
    csrfToken: csrfPayload.csrfToken,
    email,
    password,
    callbackUrl: `${baseUrl}/map`,
  });

  const loginResponse = await request(
    "/api/auth/callback/credentials",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    },
    jar,
  );

  if (loginResponse.status !== 302) {
    throw new Error(`credentials login failed with ${loginResponse.status}`);
  }

  const location = loginResponse.headers.get("location") ?? "";

  if (!location.startsWith(baseUrl)) {
    throw new Error(`credentials login redirected to unexpected URL: ${location}`);
  }

  return jar;
}

async function main() {
  console.log(`Running smoke checks against ${baseUrl}`);

  await expectOk("/robots.txt", (body) => body.includes("Sitemap:"));
  logStep("robots", "ok");

  await expectOk("/sitemap.xml", (body) => body.includes("/map"));
  logStep("sitemap", "ok");

  const mapResponse = await request(
    "/api/places/map?scope=global&query=%EA%B9%80%EB%B0%A5",
  );
  const mapPayload = await mapResponse.json();

  if (!mapResponse.ok || !Array.isArray(mapPayload.items) || mapPayload.items.length < 1) {
    throw new Error("map API did not return any items");
  }

  logStep("map api", `${mapPayload.items.length} items`);

  const placeResponse = await request("/api/places/school-gimbap");
  const placePayload = await placeResponse.json();

  if (!placeResponse.ok || !placePayload.item?.id) {
    throw new Error("place detail API failed");
  }

  logStep("place api", placePayload.item.id);

  const loginPageResponse = await request("/login");
  const loginPage = await loginPageResponse.text();

  if (!loginPage.includes("로컬 로그인")) {
    throw new Error("login page content did not render");
  }

  const providerSummary = [
    loginPage.includes("카카오로 로그인")
      ? "kakao:enabled"
      : loginPage.includes("카카오 로그인 준비 중")
        ? "kakao:disabled"
        : "kakao:hidden",
    loginPage.includes("네이버로 로그인")
      ? "naver:enabled"
      : loginPage.includes("네이버 로그인 준비 중")
        ? "naver:disabled"
        : "naver:hidden",
  ].join(", ");

  logStep("social providers", providerSummary);

  const demoJar = await loginWithCredentials(
    "demo@altteulmap.local",
    demoPassword,
  );
  const bookmarksResponse = await request("/api/bookmarks", {}, demoJar);
  const bookmarksPayload = await bookmarksResponse.json();

  if (!bookmarksResponse.ok || !Array.isArray(bookmarksPayload.items)) {
    throw new Error("bookmarks API failed after demo login");
  }

  logStep("demo login", `${bookmarksPayload.items.length} bookmarks`);

  const adminJar = await loginWithCredentials(
    "admin@altteulmap.local",
    adminPassword,
  );
  const adminPricesResponse = await request("/api/admin/prices", {}, adminJar);
  const adminPricesPayload = await adminPricesResponse.json();

  if (!adminPricesResponse.ok || !Array.isArray(adminPricesPayload.items)) {
    throw new Error("admin prices API failed after admin login");
  }

  logStep("admin login", `${adminPricesPayload.items.length} pending price reports`);
  console.log("Smoke checks passed.");
}

main().catch((error) => {
  console.error(`Smoke checks failed: ${error.message}`);
  process.exitCode = 1;
});
