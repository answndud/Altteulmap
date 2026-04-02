import { createExternalAdminApiResponse } from "@/lib/admin-app";

export const dynamic = "force-dynamic";

export async function GET() {
  return createExternalAdminApiResponse("/admin/prices");
}
