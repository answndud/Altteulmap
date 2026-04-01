import type { Metadata } from "next";

import MapPage from "@/app/map/page";

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "지도에서 알뜰 장소 찾기",
  description:
    "주변 식당, 문구점, 프린트, 생활 서비스 가격을 지도에서 비교하고 알뜰 장소를 찾아보세요.",
  alternates: {
    canonical: "/",
  },
};

export default function Home(props: HomePageProps) {
  return <MapPage {...props} />;
}
