import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";

import "./globals.css";

export const metadata: Metadata = {
  title: "알뜰맵",
  description: "내 주변의 저렴한 식당과 생활 서비스 정보를 지도에서 찾는 웹 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
