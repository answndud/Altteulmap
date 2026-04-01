import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import KakaoProvider from "next-auth/providers/kakao";
import NaverProvider from "next-auth/providers/naver";

import { verifyCredentials } from "@/features/auth/repository";
import {
  listSocialAuthProviders,
  syncOAuthUser,
} from "@/features/auth/repository";
import type { AppUserRole } from "@/features/auth/constants";
import { getRequiredServerEnv, serverEnv } from "@/lib/env";

function createAuthProviders() {
  const providers: NextAuthOptions["providers"] = [
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
  ];

  const socialProviders = listSocialAuthProviders();

  if (socialProviders.some((provider) => provider.id === "kakao" && provider.enabled)) {
    providers.push(
      KakaoProvider({
        clientId: serverEnv.AUTH_KAKAO_CLIENT_ID!,
        clientSecret: serverEnv.AUTH_KAKAO_CLIENT_SECRET!,
      }),
    );
  }

  if (socialProviders.some((provider) => provider.id === "naver" && provider.enabled)) {
    providers.push(
      NaverProvider({
        clientId: serverEnv.AUTH_NAVER_CLIENT_ID!,
        clientSecret: serverEnv.AUTH_NAVER_CLIENT_SECRET!,
      }),
    );
  }

  return providers;
}

export const authOptions: NextAuthOptions = {
  secret: getRequiredServerEnv("AUTH_SECRET"),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: createAuthProviders(),
  callbacks: {
    async signIn({ user, account }) {
      if (!account || account.provider === "credentials") {
        return true;
      }

      if (account.provider !== "kakao" && account.provider !== "naver") {
        return true;
      }

      if (!user.email) {
        return "/login?error=OAuthEmailRequired";
      }

      const syncedUser = await syncOAuthUser({
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        type: account.type,
        email: user.email,
        name: user.name,
        accessToken:
          typeof account.access_token === "string" ? account.access_token : null,
        refreshToken:
          typeof account.refresh_token === "string"
            ? account.refresh_token
            : null,
        expiresAt:
          typeof account.expires_at === "number" ? account.expires_at : null,
        tokenType:
          typeof account.token_type === "string" ? account.token_type : null,
        scope: typeof account.scope === "string" ? account.scope : null,
        idToken:
          typeof account.id_token === "string" ? account.id_token : null,
        sessionState:
          typeof account.session_state === "string"
            ? account.session_state
            : null,
      });

      if (!syncedUser) {
        return "/login?error=OAuthAccountSyncFailed";
      }

      user.id = syncedUser.id;
      user.email = syncedUser.email;
      user.name = syncedUser.nickname ?? syncedUser.email.split("@")[0];
      user.role = syncedUser.role;

      return true;
    },
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
