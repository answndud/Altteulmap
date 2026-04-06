import "server-only";

import { revalidatePath } from "next/cache";

type RevalidationEntry = {
  path: string;
  type?: "layout" | "page";
};

function uniqueEntries(entries: RevalidationEntry[]) {
  const seen = new Set<string>();

  return entries.filter((entry) => {
    const key = `${entry.path}:${entry.type ?? "exact"}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function revalidateEntries(entries: RevalidationEntry[]) {
  for (const entry of uniqueEntries(entries)) {
    if (entry.type) {
      revalidatePath(entry.path, entry.type);
      continue;
    }

    revalidatePath(entry.path);
  }
}

export function getPlaceDetailRevalidationEntries(placeId?: string | null) {
  return [
    { path: "/place/[id]", type: "page" as const },
    ...(placeId
      ? [
          { path: `/place/${placeId}` },
          { path: `/api/places/${placeId}` },
        ]
      : []),
  ];
}

export function getPlaceReadRevalidationEntries(placeId?: string | null) {
  return [
    { path: "/" },
    { path: "/api/places/map" },
    ...getPlaceDetailRevalidationEntries(placeId),
  ];
}

function getAdminPlaceQueueEntries() {
  return [
    { path: "/admin" },
    { path: "/admin/places" },
    { path: "/api/admin/places" },
  ];
}

function getAdminPriceQueueEntries() {
  return [
    { path: "/admin" },
    { path: "/admin/prices" },
    { path: "/api/admin/prices" },
  ];
}

export function revalidateAfterPlaceSubmission() {
  revalidateEntries(getAdminPlaceQueueEntries());
}

export function revalidateAfterPlaceCommentMutation(placeId: string) {
  revalidateEntries(getPlaceDetailRevalidationEntries(placeId));
}

export function revalidateAfterPlacePriceSubmission(placeId: string) {
  revalidateEntries([
    ...getAdminPriceQueueEntries(),
    ...getPlaceDetailRevalidationEntries(placeId),
  ]);
}

export function revalidateAfterPlaceReactionMutation(placeId: string) {
  revalidateEntries(getPlaceReadRevalidationEntries(placeId));
}

export function revalidateAfterBookmarkToggle(placeId: string) {
  revalidateEntries([
    { path: "/bookmarks" },
    { path: "/api/bookmarks" },
    ...getPlaceReadRevalidationEntries(placeId),
  ]);
}
