import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

type CliOptions = {
  limit: number;
  maxPrice: number;
  delayMs: number;
  timeoutMs: number;
  includeDetail: boolean;
  outputPath: string;
  manifestPath: string;
};

type RegionOption = {
  code: string;
  name: string;
};

type GoodpriceListItem = {
  bsshSn: string;
  name: string;
  categoryName: string;
  address: string;
  phone: string;
  representativeMenu: string;
  price: number;
  latitude: number;
  longitude: number;
  pageIndex: number;
  regionCode: string;
  regionName: string;
};

type GoodpriceDetailMenu = {
  label: string;
  amount: number;
  isDesignated: boolean;
};

type GoodpriceDetail = {
  description: string;
  businessHours: string;
  phone: string;
  menus: GoodpriceDetailMenu[];
};

type PlacePriceItem = {
  id: string;
  label: string;
  amount: number;
  verificationStatus: "verified" | "unverified";
  reportedAt: string;
};

type PlaceRecord = {
  id: string;
  name: string;
  businessName?: string;
  categorySlug: string;
  address: string;
  district: string;
  latitude: number;
  longitude: number;
  representativePriceAmount: number;
  representativePriceLabel: string;
  verificationStatus: "verified" | "unverified";
  lastPriceUpdatedAt: string;
  description: string;
  note: string;
  likeCount: number;
  dislikeCount: number;
  viewerReaction: "like" | "dislike" | null;
  priceItems: PlacePriceItem[];
  history: Array<{
    id: string;
    label: string;
    amount: number;
    verificationStatus: "verified" | "unverified";
    recordedAt: string;
  }>;
  comments: Array<{
    id: string;
    authorLabel: string;
    body: string;
    createdAt: string;
  }>;
};

const GOODPRICE_BASE_URL = "https://goodprice.go.kr";
const LIST_PATH = "/bssh/bsshList.do";
const DETAIL_PATH = "/bssh/bsshInfo.json";

function getKstDateStamp() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
  }).format(new Date());
}

const IMPORTED_AT = getKstDateStamp();

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    limit: 1000,
    maxPrice: 10000,
    delayMs: 120,
    timeoutMs: 15000,
    includeDetail: true,
    outputPath: "src/features/places/imported-goodprice.json",
    manifestPath: "data/goodprice/import-meta.json",
  };

  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      continue;
    }

    const [flag, rawValue] = arg.slice(2).split("=", 2);
    const value = rawValue ?? "";

    switch (flag) {
      case "limit":
        options.limit = Number(value) || options.limit;
        break;
      case "max-price":
        options.maxPrice = Number(value) || options.maxPrice;
        break;
      case "delay-ms":
        options.delayMs = Number(value) || options.delayMs;
        break;
      case "timeout-ms":
        options.timeoutMs = Number(value) || options.timeoutMs;
        break;
      case "include-detail":
        options.includeDetail = value !== "false";
        break;
      case "output":
        options.outputPath = value || options.outputPath;
        break;
      case "manifest":
        options.manifestPath = value || options.manifestPath;
        break;
      default:
        break;
    }
  }

  return options;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, " ");
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function cleanText(value: string | undefined) {
  if (!value) {
    return "";
  }

  return decodeEntities(stripTags(value))
    .replace(/\s+/g, " ")
    .trim();
}

function parsePrice(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits.length > 0 ? Number(digits) : Number.NaN;
}

function createSlug(bsshSn: string) {
  return `goodprice-${bsshSn}`;
}

function createStableId(...parts: string[]) {
  return createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 20);
}

function getDistrict(address: string) {
  const tokens = address.split(/\s+/).filter(Boolean);
  return tokens.slice(0, 2).join(" ");
}

function mapCategorySlug(categoryName: string) {
  switch (categoryName) {
    case "한식":
      return "korean";
    case "일식":
      return "japanese";
    case "양식":
      return "western";
    case "중식":
      return "chinese";
    case "베이커리":
      return "bakery";
    case "기타요식업":
      return "other-food";
    case "세탁업":
      return "laundry";
    case "목욕업":
      return "bath";
    case "숙박업":
      return "lodging";
    case "이용업":
      return "barber";
    case "미용업":
      return "beauty";
    case "기타비요식업":
      return "other-service";
    default:
      return "other-service";
  }
}

async function fetchText(
  pathname: string,
  form: Record<string, string>,
  timeoutMs: number,
  expectJson = false,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${GOODPRICE_BASE_URL}${pathname}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: new URLSearchParams(form),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`${pathname} ${response.status} ${response.statusText}`);
    }

    return expectJson ? response.json() : response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function extractRegionOptions(html: string) {
  const selectMatch = html.match(
    /<select name="ctpvCd" id="ctpvCd"[\s\S]*?>([\s\S]*?)<\/select>/,
  );

  if (!selectMatch) {
    throw new Error("Failed to find ctpv select options.");
  }

  return Array.from(
    selectMatch[1].matchAll(/<option value="([^"]*)"\s*>([^<]+)<\/option>/g),
  )
    .map((match) => ({
      code: cleanText(match[1]),
      name: cleanText(match[2]),
    }))
    .filter((option) => option.code.length > 0);
}

function parseCoordinatePayload(html: string) {
  const payloadMatch = html.match(/var articleObject2 = '([\s\S]*?)';/);

  if (!payloadMatch) {
    return [];
  }

  const raw = payloadMatch[1]
    .replace(/\\'/g, "'")
    .replace(/^\[/, "")
    .replace(/\]$/, "");

  if (raw.trim().length === 0) {
    return [];
  }

  return raw
    .split("},")
    .map((chunk) =>
      chunk
        .replace(/[{}\[\]]/g, "")
        .split(",")
        .map((value) => cleanText(value)),
    )
    .filter((parts) => parts.length >= 4)
    .map((parts) => ({
      latitude: Number(parts[0]),
      longitude: Number(parts[1]),
      categoryName: parts[2],
      name: parts.slice(3).join(","),
    }));
}

function parseListPage(
  html: string,
  pageIndex: number,
  region: RegionOption,
): GoodpriceListItem[] {
  const coords = parseCoordinatePayload(html);
  const listBlocks = Array.from(
    html.matchAll(/<li>\s*<div class="msl_nm_wrap">([\s\S]*?)<\/li>/g),
  ).map((match) => match[0]);

  const itemCount = Math.min(coords.length, listBlocks.length);

  return Array.from({ length: itemCount }, (_, index) => {
    const block = listBlocks[index];
    const idMatch = block.match(/goInfo\('(\d+)'\)/);
    const nameMatch = block.match(/<div class="mr10">([\s\S]*?)<\/div>/);
    const addressMatch = block.match(
      /<div class="th">주소<\/div>\s*<div class="td">([\s\S]*?)<\/div>/,
    );
    const phoneMatch = block.match(
      /<div class="th">전화번호<\/div>\s*(?:<div class="td">([\s\S]*?)<\/div>)?/,
    );
    const menuAndPriceMatch = block.match(
      /<div class="th">주요품목<\/div>\s*<div class="td">([\s\S]*?)<\/div>\s*<div class="th">가격<\/div>\s*<div class="td">([\s\S]*?)<\/div>/,
    );

    return {
      bsshSn: cleanText(idMatch?.[1]),
      name: cleanText(nameMatch?.[1]),
      categoryName: coords[index]?.categoryName ?? "기타비요식업",
      address: cleanText(addressMatch?.[1]),
      phone: cleanText(phoneMatch?.[1]),
      representativeMenu: cleanText(menuAndPriceMatch?.[1]),
      price: parsePrice(cleanText(menuAndPriceMatch?.[2])),
      latitude: coords[index]?.latitude ?? Number.NaN,
      longitude: coords[index]?.longitude ?? Number.NaN,
      pageIndex,
      regionCode: region.code,
      regionName: region.name,
    };
  }).filter(
    (item) =>
      item.bsshSn.length > 0 &&
      item.name.length > 0 &&
      item.address.length > 0 &&
      item.representativeMenu.length > 0 &&
      Number.isFinite(item.price) &&
      Number.isFinite(item.latitude) &&
      Number.isFinite(item.longitude),
  );
}

async function fetchDetail(
  bsshSn: string,
  delayMs: number,
  timeoutMs: number,
) {
  try {
    const data = (await fetchText(
      DETAIL_PATH,
      {
        bsshSn,
        pageIndex: "1",
        pageStyle: "list",
        menuId: "MN-0103",
      },
      timeoutMs,
      true,
    )) as {
      result?: {
        bsshDc?: string;
        bsnHr?: string;
        bsshTelno?: string;
      };
      menuList?: Array<{
        menuNm?: string;
        menuPc?: number;
        menuDsgnYn?: string;
      }>;
    };

    await sleep(delayMs);

    return {
      description: cleanText(data.result?.bsshDc),
      businessHours: cleanText(data.result?.bsnHr),
      phone: cleanText(data.result?.bsshTelno),
      menus:
        data.menuList
          ?.filter(
            (menu) =>
              cleanText(menu.menuNm).length > 0 &&
              typeof menu.menuPc === "number" &&
              Number.isFinite(menu.menuPc),
          )
          .map((menu) => ({
            label: cleanText(menu.menuNm),
            amount: Number(menu.menuPc),
            isDesignated: menu.menuDsgnYn === "Y",
          })) ?? [],
    } satisfies GoodpriceDetail;
  } catch (error) {
    console.warn(`Detail fetch failed for ${bsshSn}:`, error);

    return {
      description: "",
      businessHours: "",
      phone: "",
      menus: [],
    } satisfies GoodpriceDetail;
  }
}

function buildDescription(item: GoodpriceListItem, detail: GoodpriceDetail) {
  if (detail.description && detail.description !== "-") {
    return detail.description;
  }

  return `행정안전부 착한가격업소 목록에서 수집한 ${item.categoryName} 업소입니다. 대표 항목은 ${item.representativeMenu} ${item.price.toLocaleString("ko-KR")}원입니다.`;
}

function buildNote(item: GoodpriceListItem, detail: GoodpriceDetail) {
  const notes = [
    `출처: 행정안전부 착한가격업소`,
    `수집일: ${IMPORTED_AT}`,
    detail.phone || item.phone ? `전화: ${detail.phone || item.phone}` : "",
    detail.businessHours && detail.businessHours !== "-" ? `영업시간: ${detail.businessHours}` : "",
  ].filter(Boolean);

  return notes.join(" / ");
}

function buildPriceItems(
  item: GoodpriceListItem,
  detail: GoodpriceDetail,
  maxPrice: number,
): PlacePriceItem[] {
  const filteredDetailMenus = detail.menus.filter((menu) => menu.amount <= maxPrice);
  const sourceMenus =
    filteredDetailMenus.length > 0
      ? filteredDetailMenus
      : [
          {
            label: item.representativeMenu,
            amount: item.price,
            isDesignated: true,
          },
        ];

  const deduped = new Map<string, PlacePriceItem>();

  for (const menu of sourceMenus) {
    const key = `${menu.label}-${menu.amount}`;

    if (deduped.has(key)) {
      continue;
    }

    deduped.set(key, {
      id: createStableId(item.bsshSn, menu.label, String(menu.amount)),
      label: menu.label,
      amount: menu.amount,
      verificationStatus: "verified",
      reportedAt: IMPORTED_AT,
    });
  }

  return Array.from(deduped.values());
}

function toPlaceRecord(
  item: GoodpriceListItem,
  detail: GoodpriceDetail,
  maxPrice: number,
): PlaceRecord {
  const priceItems = buildPriceItems(item, detail, maxPrice);
  const representativePrice =
    detail.menus.find(
      (menu) => menu.isDesignated && menu.amount <= maxPrice,
    ) ??
    detail.menus.find(
      (menu) =>
        menu.label === item.representativeMenu && menu.amount <= maxPrice,
    ) ?? {
      label: item.representativeMenu,
      amount: item.price,
      isDesignated: true,
    };

  return {
    id: createSlug(item.bsshSn),
    name: item.name,
    businessName: item.name,
    categorySlug: mapCategorySlug(item.categoryName),
    address: item.address,
    district: getDistrict(item.address),
    latitude: item.latitude,
    longitude: item.longitude,
    representativePriceAmount: representativePrice.amount,
    representativePriceLabel: representativePrice.label,
    verificationStatus: "verified",
    lastPriceUpdatedAt: IMPORTED_AT,
    description: buildDescription(item, detail),
    note: buildNote(item, detail),
    likeCount: 0,
    dislikeCount: 0,
    viewerReaction: null,
    priceItems,
    history: priceItems.map((priceItem) => ({
      id: `${priceItem.id}-history`,
      label: priceItem.label,
      amount: priceItem.amount,
      verificationStatus: "verified",
      recordedAt: IMPORTED_AT,
    })),
    comments: [],
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const firstPageHtml = (await fetchText(LIST_PATH, {
    pageIndex: "1",
    menuId: "MN-0103",
  }, options.timeoutMs)) as string;

  const regions = extractRegionOptions(firstPageHtml);
  const seenAddresses = new Set<string>();
  const collected: GoodpriceListItem[] = [];
  const pageState = new Map(
    regions.map((region) => [region.code, { nextPage: 1, done: false }]),
  );

  while (collected.length < options.limit) {
    let progressed = false;

    for (const region of regions) {
      if (collected.length >= options.limit) {
        break;
      }

      const state = pageState.get(region.code);

      if (!state || state.done) {
        continue;
      }

      const html =
        ((await fetchText(LIST_PATH, {
          pageIndex: String(state.nextPage),
          menuId: "MN-0103",
          srchCtpvCd: region.code,
        }, options.timeoutMs)) as string);

      const pageItems = parseListPage(html, state.nextPage, region);
      state.nextPage += 1;
      progressed = true;

      if (pageItems.length === 0) {
        state.done = true;
        continue;
      }

      const affordableItems = pageItems.filter(
        (item) =>
          item.price <= options.maxPrice &&
          !seenAddresses.has(`${item.name}@@${item.address}`),
      );

      for (const item of affordableItems) {
        collected.push(item);
        seenAddresses.add(`${item.name}@@${item.address}`);

        if (collected.length >= options.limit) {
          break;
        }
      }

      if (collected.length > 0 && collected.length % 100 === 0) {
        console.log(`Collected ${collected.length}/${options.limit} places...`);
      }

      await sleep(options.delayMs);
    }

    if (!progressed) {
      break;
    }
  }

  const selected = collected.slice(0, options.limit);
  const detailMap = new Map<string, GoodpriceDetail>();

  if (options.includeDetail) {
    for (const [index, item] of selected.entries()) {
      detailMap.set(
        item.bsshSn,
        await fetchDetail(item.bsshSn, options.delayMs, options.timeoutMs),
      );

      if ((index + 1) % 100 === 0) {
        console.log(`Fetched detail ${index + 1}/${selected.length}...`);
      }
    }
  }

  const placeRecords = selected.map((item) =>
    toPlaceRecord(
      item,
      detailMap.get(item.bsshSn) ?? {
        description: "",
        businessHours: "",
        phone: item.phone,
        menus: [],
      },
      options.maxPrice,
    ),
  );

  const manifest = {
    source: `${GOODPRICE_BASE_URL}${LIST_PATH}`,
    importedAt: new Date().toISOString(),
    options,
    selectedCount: selected.length,
    regions: Array.from(
      selected.reduce((map, item) => {
        map.set(item.regionName, (map.get(item.regionName) ?? 0) + 1);
        return map;
      }, new Map<string, number>()),
    ).map(([name, count]) => ({ name, count })),
    categories: Array.from(
      selected.reduce((map, item) => {
        map.set(item.categoryName, (map.get(item.categoryName) ?? 0) + 1);
        return map;
      }, new Map<string, number>()),
    ).map(([name, count]) => ({ name, count })),
    items: selected,
  };

  const outputAbsolutePath = path.resolve(process.cwd(), options.outputPath);
  const manifestAbsolutePath = path.resolve(process.cwd(), options.manifestPath);

  await mkdir(path.dirname(outputAbsolutePath), { recursive: true });
  await mkdir(path.dirname(manifestAbsolutePath), { recursive: true });
  await writeFile(outputAbsolutePath, `${JSON.stringify(placeRecords, null, 2)}\n`);
  await writeFile(
    manifestAbsolutePath,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  console.log(
    `Imported ${placeRecords.length} places to ${path.relative(process.cwd(), outputAbsolutePath)}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
