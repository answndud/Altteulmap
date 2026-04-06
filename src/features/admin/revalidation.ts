import {
  getPlaceReadRevalidationEntries,
  revalidateEntries,
} from "@/features/places/revalidation";

export function revalidateAfterPlaceModeration(placeId: string) {
  revalidateEntries([
    { path: "/admin" },
    { path: "/admin/places" },
    { path: "/api/admin/places" },
    ...getPlaceReadRevalidationEntries(placeId),
  ]);
}

export function revalidateAfterPriceModeration(placeId: string) {
  revalidateEntries([
    { path: "/admin" },
    { path: "/admin/prices" },
    { path: "/api/admin/prices" },
    ...getPlaceReadRevalidationEntries(placeId),
  ]);
}

export function revalidateAfterPriceItemUpdate(placeId?: string | null) {
  revalidateEntries([
    { path: "/admin" },
    { path: "/admin/prices" },
    { path: "/api/admin/prices" },
    ...(placeId ? [{ path: `/admin/prices/places/${placeId}` }] : []),
    ...getPlaceReadRevalidationEntries(placeId),
  ]);
}

export function revalidateAfterReportModeration() {
  revalidateEntries([
    { path: "/admin" },
    { path: "/admin/reports" },
    { path: "/api/admin/reports" },
  ]);
}

export function revalidateAfterReportSubmission() {
  revalidateAfterReportModeration();
}
