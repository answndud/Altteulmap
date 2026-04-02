import type { Metadata } from "next";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        {children}
      </body>
    </html>
  );
}
