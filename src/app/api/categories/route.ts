import { NextResponse } from "next/server";

import { categoryGroups, categoryOptions } from "@/features/categories/catalog";

export function GET() {
  return NextResponse.json({
    groups: categoryGroups,
    categories: categoryOptions,
  });
}
