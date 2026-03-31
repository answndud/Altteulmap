import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { verifyCredentials } from "@/features/auth/repository";
import type { AppUserRole } from "@/features/auth/constants";
import { getRequiredServerEnv } from "@/lib/env";

export const authOptions: NextAuthOptions = {
  secret: getRequiredServerEnv("AUTH_SECRET"),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Local credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim() ?? "";
        const password = credentials?.password ?? "";

        if (!email || !password) {
          return null;
        }

        const user = await verifyCredentials(email, password);

        if (!user) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.nickname ?? user.email.split("@")[0],
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = (user as { role: AppUserRole }).role;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.email = token.email ?? session.user.email ?? "";
        session.user.name = token.name ?? session.user.name;
        session.user.role =
          token.role === "admin" || token.role === "user"
            ? token.role
            : "user";
      }

      return session;
    },
  },
};

export default NextAuth(authOptions);
