import { createHash } from "node:crypto";

const FOOD_CATEGORY_NAMES = new Set([
  "한식",
  "일식",
  "양식",
  "중식",
  "베이커리",
  "기타요식업",
]);

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

export function cleanText(value: string | undefined) {
  if (!value) {
    return "";
  }

  return decodeEntities(stripTags(value))
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePriceLabel(label: string) {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

export function parsePrice(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits.length > 0 ? Number(digits) : Number.NaN;
}

export function createSlug(bsshSn: string) {
  return `goodprice-${bsshSn}`;
}

export function createStableId(...parts: string[]) {
  return createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 20);
}

export function getDistrict(address: string) {
  const tokens = address.split(/\s+/).filter(Boolean);
  return tokens.slice(0, 2).join(" ");
}

export function isFoodCategory(categoryName: string) {
  return FOOD_CATEGORY_NAMES.has(categoryName);
}

export function mapCategorySlug(categoryName: string) {
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
