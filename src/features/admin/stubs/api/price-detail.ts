import { createExternalAdminApiResponse } from "@/lib/admin-app";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(_: Request, context: RouteContext) {
  const { id } = await context.params;

  return createExternalAdminApiResponse(`/admin/prices#${id}`);
}
