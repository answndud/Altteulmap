export type AppUserRole = "user" | "admin";

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
