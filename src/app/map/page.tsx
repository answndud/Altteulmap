import { permanentRedirect } from "next/navigation";

type LegacyMapPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toRootHref(params: Record<string, string | string[] | undefined>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry) {
          search.append(key, entry);
        }
      }
      continue;
    }

    if (value) {
      search.set(key, value);
    }
  }

  const query = search.toString();

  return query ? `/?${query}` : "/";
}

export default async function LegacyMapPage({
  searchParams,
}: LegacyMapPageProps) {
  permanentRedirect(toRootHref(await searchParams));
}
