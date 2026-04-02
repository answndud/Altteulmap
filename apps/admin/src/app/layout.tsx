import type { Metadata } from "next";

import { GlobalHeader } from "@/components/global-header";
import { getSessionUser } from "@/lib/session";
import { createSiteUrl } from "@/lib/site";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "알뜰맵 운영",
    template: "%s | 알뜰맵 운영",
  },
  description: "알뜰맵 운영 콘솔",
};

export default async function AdminRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();

  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <GlobalHeader
          user={user}
          adminHref="/admin"
          homeHref={createSiteUrl("/").toString()}
        />
        {children}
      </body>
    </html>
  );
}
