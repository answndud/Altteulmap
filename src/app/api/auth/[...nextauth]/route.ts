import NextAuth from "next-auth";

import { getAuthOptions } from "@/auth";

export const runtime = "nodejs";

type AuthRouteContext = {
  params: Promise<{
    nextauth?: string[];
  }>;
};

async function handler(request: Request, context: AuthRouteContext) {
  return NextAuth(getAuthOptions())(request, context);
}

export { handler as GET, handler as POST };
