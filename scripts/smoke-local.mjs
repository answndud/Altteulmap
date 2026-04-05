const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

function printLine(message) {
  process.stdout.write(`${message}\n`);
}

function logStep(label, detail) {
  printLine(`- ${label}: ${detail}`);
}

function normalizeComparableUrl(value) {
  const url = new URL(value);
  const normalizedPath = url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, "");
  return `${url.origin}${normalizedPath}${url.search}`;
}

function extractCanonicalHref(html) {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

function extractSitemapLocations(xml) {
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1]);
}

async function request(pathname, options = {}) {
  const response = await fetch(new URL(pathname, baseUrl), {
    ...options,
    headers: options.headers,
    redirect: "manual",
  });

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

async function main() {
  printLine(`Running smoke checks against ${baseUrl}`);

  const homeResponse = await request("/");
  if (!homeResponse.ok) {
    throw new Error(`/ returned ${homeResponse.status}`);
  }

  const homeHtml = await homeResponse.text();
  const homeCanonical = extractCanonicalHref(homeHtml);

  if (!homeCanonical || normalizeComparableUrl(homeCanonical) !== normalizeComparableUrl(`${baseUrl}/`)) {
    throw new Error("home canonical did not match base URL");
  }

  logStep("home canonical", homeCanonical);

  await expectOk("/robots.txt", (body) => body.includes("Sitemap:"));
  logStep("robots", "ok");

  const sitemapResponse = await request("/sitemap.xml");
  if (!sitemapResponse.ok) {
    throw new Error(`/sitemap.xml returned ${sitemapResponse.status}`);
  }

  const sitemapXml = await sitemapResponse.text();
  const sitemapLocations = extractSitemapLocations(sitemapXml);
  const samplePlaceUrl = sitemapLocations.find((location) => location.includes("/place/"));

  if (!sitemapLocations.some((location) => normalizeComparableUrl(location) === normalizeComparableUrl(`${baseUrl}/`))) {
    throw new Error("sitemap did not include home URL");
  }

  if (!samplePlaceUrl) {
    throw new Error("sitemap did not include any place detail URL");
  }

  logStep("sitemap", `${sitemapLocations.length} urls`);

  const samplePlaceResponse = await fetch(samplePlaceUrl, { redirect: "manual" });
  if (!samplePlaceResponse.ok) {
    throw new Error(`sample place page returned ${samplePlaceResponse.status}`);
  }

  const samplePlaceHtml = await samplePlaceResponse.text();
  const samplePlaceCanonical = extractCanonicalHref(samplePlaceHtml);

  if (
    !samplePlaceCanonical ||
    normalizeComparableUrl(samplePlaceCanonical) !==
      normalizeComparableUrl(samplePlaceUrl)
  ) {
    throw new Error("sample place canonical did not match sitemap URL");
  }

  logStep("sample place canonical", samplePlaceCanonical);

  const mapResponse = await request(
    "/api/places/map?scope=global&query=%EA%B9%80%EB%B0%A5",
  );
  const mapPayload = await mapResponse.json();

  if (!mapResponse.ok || !Array.isArray(mapPayload.items) || mapPayload.items.length < 1) {
    throw new Error("map API did not return any items");
  }

  logStep("map api", `${mapPayload.items.length} items`);

  const targetPlaceId = mapPayload.items[0]?.id;

  if (!targetPlaceId) {
    throw new Error("map API did not return a place id");
  }

  const placeResponse = await request(`/api/places/${targetPlaceId}`);
  const placePayload = await placeResponse.json();

  if (!placeResponse.ok || !placePayload.item?.id) {
    throw new Error("place detail API failed");
  }

  logStep("place api", placePayload.item.id);

  const loginPageResponse = await request("/login");
  const loginPage = await loginPageResponse.text();

  if (
    !loginPage.includes('data-testid="login-form"') ||
    !loginPage.includes(">로그인<")
  ) {
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
  printLine("Smoke checks passed.");
}

main().catch((error) => {
  console.error(`Smoke checks failed: ${error.message}`);
  process.exitCode = 1;
});
