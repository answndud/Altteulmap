import type { MetadataRoute } from "next";

import { listPlaces } from "@/features/places/repository";
import { createSiteUrl } from "@/lib/site";

function toLastModified(value: string) {
  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const result = await listPlaces({
    sort: "recent",
  });

  return [
    {
      url: createSiteUrl("/").toString(),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...result.items.map((place) => ({
      url: createSiteUrl(`/place/${place.id}`).toString(),
      lastModified: toLastModified(place.lastPriceUpdatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
