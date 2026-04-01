import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "알뜰맵",
    short_name: "알뜰맵",
    description: "내 주변의 저렴한 식당과 생활 서비스 정보를 지도에서 찾는 웹 서비스",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#1c1917",
    lang: "ko-KR",
  };
}
