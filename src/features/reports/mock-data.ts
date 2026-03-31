export type MockReportRecord = {
  id: string;
  placeId: string;
  placeName: string;
  reasonType:
    | "price_error"
    | "duplicate_place"
    | "closed_or_wrong_info"
    | "promotional_content"
    | "other";
  detail: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  createdAt: string;
};

export const mockReports: MockReportRecord[] = [
  {
    id: "report-001",
    placeId: "dongne-mart24",
    placeName: "동네마트24",
    reasonType: "price_error",
    detail: "계란 10구 가격표가 바뀌었는데 이전 가격이 아직 보입니다.",
    status: "open",
    createdAt: "2026-03-30",
  },
  {
    id: "report-002",
    placeId: "onsaemiro-laundry",
    placeName: "온새미로세탁",
    reasonType: "duplicate_place",
    detail: "같은 세탁소가 근처 검색에 두 번 나오는 것 같습니다.",
    status: "reviewing",
    createdAt: "2026-03-29",
  },
  {
    id: "report-003",
    placeId: "print-station",
    placeName: "프린트스테이션",
    reasonType: "closed_or_wrong_info",
    detail: "토요일 영업시간 정보가 실제와 다릅니다.",
    status: "resolved",
    createdAt: "2026-03-25",
  },
];
