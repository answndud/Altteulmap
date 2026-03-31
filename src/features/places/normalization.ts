export function normalizePriceLabel(label: string) {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

export function slugifyPlaceName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u3131-\u318e\uac00-\ud7a3]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}
