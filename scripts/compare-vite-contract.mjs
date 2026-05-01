const nextBaseUrl = process.env.CONTRACT_NEXT_BASE_URL ?? "http://localhost:3000";
const viteBaseUrl = process.env.CONTRACT_VITE_BASE_URL ?? "http://localhost:3118";
const skipNext = process.env.CONTRACT_SKIP_NEXT === "1";
const expectedViteSource = process.env.CONTRACT_EXPECT_VITE_SOURCE ?? "";

const cookieJars = new Map();

function printLine(message) {
  process.stdout.write(`${message}\n`);
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function cookieHeaderFor(origin) {
  const jar = cookieJars.get(origin);

  if (!jar || jar.size === 0) {
    return undefined;
  }

  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function storeCookies(origin, response) {
  const rawSetCookie = response.headers.getSetCookie?.() ?? [];
  const fallbackCookie = response.headers.get("set-cookie");
  const cookieValues = rawSetCookie.length > 0
    ? rawSetCookie
    : fallbackCookie
      ? [fallbackCookie]
      : [];

  if (cookieValues.length === 0) {
    return;
  }

  const jar = cookieJars.get(origin) ?? new Map();

  for (const cookieValue of cookieValues) {
    const [pair] = cookieValue.split(";");
    const separatorIndex = pair.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    jar.set(pair.slice(0, separatorIndex), pair.slice(separatorIndex + 1));
  }

  cookieJars.set(origin, jar);
}

async function requestJson(baseUrl, contract) {
  const origin = normalizeBaseUrl(baseUrl);
  const url = new URL(contract.path, origin);
  const headers = {
    ...(contract.body ? { "content-type": "application/json" } : {}),
    ...(cookieHeaderFor(origin) ? { cookie: cookieHeaderFor(origin) } : {}),
  };
  const response = await fetch(url, {
    method: contract.method,
    headers,
    body: contract.body ? JSON.stringify(contract.body) : undefined,
    redirect: "manual",
  });

  storeCookies(origin, response);

  const text = await response.text();
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return {
    body,
    contentType: response.headers.get("content-type") ?? "",
    status: response.status,
  };
}

function getType(value) {
  if (Array.isArray(value)) {
    return "array";
  }

  if (value === null) {
    return "null";
  }

  return typeof value;
}

function signature(value, depth = 0) {
  const type = getType(value);

  if (depth >= 4 || value === null || type !== "object" && type !== "array") {
    return type;
  }

  if (Array.isArray(value)) {
    return {
      type: "array",
      item: value.length > 0 ? signature(value[0], depth + 1) : "empty",
    };
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, signature(value[key], depth + 1)]),
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertHasKeys(body, keys, label) {
  for (const key of keys) {
    assert(
      body && Object.prototype.hasOwnProperty.call(body, key),
      `${label} missing key '${key}'`,
    );
  }
}

function assertExpectedViteSource(contract, result) {
  if (!expectedViteSource || !result.body || typeof result.body !== "object") {
    return;
  }

  if (!Object.prototype.hasOwnProperty.call(result.body, "source")) {
    return;
  }

  assert(
    result.body.source === expectedViteSource,
    `${contract.name} expected Vite source '${expectedViteSource}' but received '${result.body.source}'`,
  );

  if (Object.prototype.hasOwnProperty.call(result.body, "mock")) {
    assert(
      result.body.mock === (expectedViteSource === "mock"),
      `${contract.name} mock flag does not match expected source '${expectedViteSource}'`,
    );
  }

  if (
    expectedViteSource === "database" &&
    Object.prototype.hasOwnProperty.call(result.body, "tracked")
  ) {
    assert(
      result.body.tracked === true,
      `${contract.name} expected database-backed telemetry to be tracked`,
    );
  }
}

const contracts = [
  {
    name: "categories",
    method: "GET",
    path: "/api/categories",
    expect: ({ body, status }) => {
      assert(status === 200, "categories status must be 200");
      assertHasKeys(body, ["groups", "categories"], "categories");
      assert(Array.isArray(body.groups), "categories.groups must be an array");
      assert(Array.isArray(body.categories), "categories.categories must be an array");
    },
  },
  {
    name: "map search",
    method: "GET",
    path: "/api/places/map?scope=global&query=%EA%B9%80%EB%B0%A5",
    expect: ({ body, status }) => {
      assert(status === 200, "map search status must be 200");
      assertHasKeys(
        body,
        [
          "items",
          "mapMarkers",
          "markerMode",
          "count",
          "returnedCount",
          "mapMarkerCount",
          "truncated",
          "bounds",
          "filters",
          "source",
          "mock",
        ],
        "map search",
      );
      assert(Array.isArray(body.items), "map search items must be an array");
    },
  },
  {
    name: "place detail",
    method: "GET",
    path: "/api/places/goodprice-14501",
    expect: ({ body, status }) => {
      assert(status === 200, "place detail status must be 200");
      assertHasKeys(body, ["item", "source", "mock"], "place detail");
      assertHasKeys(
        body.item,
        ["id", "name", "priceItems", "history", "comments"],
        "place detail item",
      );
    },
  },
  {
    name: "place not found",
    method: "GET",
    path: "/api/places/not-found",
    expect: ({ body, status }) => {
      assert(status === 404, "place not found status must be 404");
      assertHasKeys(body, ["error"], "place not found");
      assert(body.error.code === "NOT_FOUND", "place not found error code mismatch");
    },
  },
  {
    name: "bookmarks unauthenticated",
    method: "GET",
    path: "/api/bookmarks",
    expect: ({ body, status }) => {
      assert(status === 401, "bookmarks unauthenticated status must be 401");
      assert(body.ok === false, "bookmarks unauthenticated ok must be false");
      assert(typeof body.message === "string", "bookmarks message must be a string");
    },
  },
  {
    name: "place submission validation",
    method: "POST",
    path: "/api/places",
    body: {
      name: "",
    },
    expect: ({ body, status }) => {
      assert(status === 400, "place submission validation status must be 400");
      assert(body.ok === false, "place submission validation ok must be false");
      assertHasKeys(body, ["message", "error"], "place submission validation");
    },
  },
  {
    name: "price report validation",
    method: "POST",
    path: "/api/places/goodprice-14501/prices",
    body: {
      label: "",
      amount: -1,
    },
    expect: ({ body, status }) => {
      assert(status === 400, "price report validation status must be 400");
      assert(body.ok === false, "price report validation ok must be false");
      assertHasKeys(body, ["message", "error"], "price report validation");
    },
  },
  {
    name: "comment validation",
    method: "POST",
    path: "/api/places/goodprice-14501/comments",
    body: {
      body: "",
    },
    expect: ({ body, status }) => {
      assert(status === 400, "comment validation status must be 400");
      assert(body.ok === false, "comment validation ok must be false");
      assertHasKeys(body, ["message", "error"], "comment validation");
    },
  },
  {
    name: "reaction validation",
    method: "PUT",
    path: "/api/places/goodprice-14501/reaction",
    body: {
      reaction: "love",
    },
    expect: ({ body, status }) => {
      assert(status === 400, "reaction validation status must be 400");
      assert(body.ok === false, "reaction validation ok must be false");
      assertHasKeys(body, ["message", "error"], "reaction validation");
    },
  },
  {
    name: "report validation",
    method: "POST",
    path: "/api/reports",
    body: {
      placeId: "",
      placeName: "",
      reasonType: "price_error",
      detail: "",
    },
    expect: ({ body, status }) => {
      assert(status === 400, "report validation status must be 400");
      assert(body.ok === false, "report validation ok must be false");
      assertHasKeys(body, ["message", "error"], "report validation");
    },
  },
  {
    name: "telemetry valid",
    method: "POST",
    path: "/api/telemetry/visit",
    body: {
      path: "/place/goodprice-14501",
      ref: "share",
      scope: "public",
      source: "detail",
    },
    expect: ({ body, status }) => {
      assert(status === 200, "telemetry valid status must be 200");
      assert(body.ok === true, "telemetry valid ok must be true");
      assertHasKeys(body, ["tracked", "source"], "telemetry valid");
    },
  },
  {
    name: "telemetry validation",
    method: "POST",
    path: "/api/telemetry/visit",
    body: {
      path: "/place/goodprice-14501",
      scope: "public",
      source: "detail",
    },
    expect: ({ body, status }) => {
      assert(status === 400, "telemetry validation status must be 400");
      assert(body.ok === false, "telemetry validation ok must be false");
      assertHasKeys(body, ["message", "error"], "telemetry validation");
    },
  },
];

function compareSignatures(name, nextResult, viteResult) {
  const nextSignature = signature(nextResult.body);
  const viteSignature = signature(viteResult.body);
  const nextText = JSON.stringify(nextSignature);
  const viteText = JSON.stringify(viteSignature);

  if (nextText !== viteText) {
    throw new Error(
      `${name} signature mismatch\nnext: ${JSON.stringify(nextSignature, null, 2)}\nvite: ${JSON.stringify(viteSignature, null, 2)}`,
    );
  }
}

async function runAgainst(label, baseUrl) {
  const results = [];

  for (const contract of contracts) {
    const result = await requestJson(baseUrl, contract);

    contract.expect(result);
    if (label === "vite") {
      assertExpectedViteSource(contract, result);
    }
    results.push({
      name: contract.name,
      result,
    });
    printLine(`- ${label} ${contract.name}: ${result.status}`);
  }

  return results;
}

async function main() {
  printLine(`Running Vite contract checks against ${viteBaseUrl}`);
  const viteResults = await runAgainst("vite", viteBaseUrl);

  if (skipNext) {
    printLine("Skipping Next comparison because CONTRACT_SKIP_NEXT=1.");
    printLine("Vite contract checks passed.");
    return;
  }

  printLine(`Running Next contract checks against ${nextBaseUrl}`);
  const nextResults = await runAgainst("next", nextBaseUrl);

  for (let index = 0; index < contracts.length; index += 1) {
    const contract = contracts[index];
    const nextResult = nextResults[index].result;
    const viteResult = viteResults[index].result;

    if (nextResult.status !== viteResult.status) {
      throw new Error(
        `${contract.name} status mismatch: next=${nextResult.status}, vite=${viteResult.status}`,
      );
    }

    compareSignatures(contract.name, nextResult, viteResult);
  }

  printLine("Next/Vite contract comparison passed.");
}

main().catch((error) => {
  console.error(`Contract comparison failed: ${error.message}`);
  process.exitCode = 1;
});
