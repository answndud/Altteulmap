import { categoryGroups, categoryOptions } from "@/features/categories/catalog";

export function GET() {
  return Response.json({
    groups: categoryGroups,
    categories: categoryOptions,
  });
}
