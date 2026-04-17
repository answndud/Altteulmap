import type { Metadata } from "next";

import { GlobalHeader } from "@/components/global-header";
import { VisitTracker } from "@/features/telemetry/visit-tracker";
import { getAdminAppHref } from "@/lib/admin-app";
import { getSessionUser } from "@/lib/session";
import { getSiteOrigin } from "@/lib/site";

import "./globals.css";

const siteName = "알뜰맵";
const siteDescription =
  "내 주변의 저렴한 식당과 생활 서비스 정보를 지도에서 찾는 웹 서비스";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteOrigin()),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();

  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--altteul-bg-canvas)] text-[var(--altteul-text-primary)] antialiased">
        <GlobalHeader user={user} adminHref={getAdminAppHref("/admin")} />
        <VisitTracker scope="public" />
        {children}
      </body>
    </html>
  );
}
