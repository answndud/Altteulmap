import NextAuth from "next-auth";

import { getAuthOptions } from "@/auth";

export const runtime = "nodejs";

async function handler(request: Request) {
  return NextAuth(getAuthOptions())(request);
}

export { handler as GET, handler as POST };
