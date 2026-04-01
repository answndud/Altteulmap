export type AppUserRole = "user" | "admin";
export type SocialAuthProviderId = "kakao" | "naver";
export type SocialAuthProviderAvailability = {
  id: SocialAuthProviderId;
  label: string;
  enabled: boolean;
  unavailableReason?: string;
};

export const authAccountHints = [
  {
    role: "user" as const,
    label: "일반 사용자",
    email: "demo@altteulmap.local",
    passwordEnv: "AUTH_DEMO_PASSWORD",
  },
  {
    role: "admin" as const,
    label: "운영자",
    email: "admin@altteulmap.local",
    passwordEnv: "AUTH_ADMIN_PASSWORD",
  },
];

export const appUserRoleLabelMap: Record<AppUserRole, string> = {
  user: "일반 사용자",
  admin: "운영자",
};

export const socialAuthProviderLabelMap: Record<
  SocialAuthProviderId,
  string
> = {
  kakao: "카카오",
  naver: "네이버",
};

export const socialAuthProviderMonogramMap: Record<
  SocialAuthProviderId,
  string
> = {
  kakao: "K",
  naver: "N",
};
