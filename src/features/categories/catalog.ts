type CategoryGroup = {
  slug: string;
  name: string;
  children: Array<{
    slug: string;
    name: string;
  }>;
};

export const categoryGroups: CategoryGroup[] = [
  {
    slug: "food",
    name: "음식",
    children: [
      { slug: "korean", name: "한식" },
      { slug: "japanese", name: "일식" },
      { slug: "western", name: "양식" },
      { slug: "chinese", name: "중식" },
      { slug: "bunsik", name: "분식" },
      { slug: "bakery", name: "베이커리" },
      { slug: "cafe", name: "카페" },
      { slug: "other-food", name: "기타요식업" },
    ],
  },
  {
    slug: "life-services",
    name: "생활서비스",
    children: [
      { slug: "laundry", name: "세탁업" },
      { slug: "bath", name: "목욕업" },
      { slug: "lodging", name: "숙박업" },
      { slug: "barber", name: "이용업" },
      { slug: "beauty", name: "미용업" },
      { slug: "other-service", name: "기타비요식업" },
    ],
  },
  {
    slug: "shopping",
    name: "장보기/생활용품",
    children: [
      { slug: "mart", name: "마트" },
      { slug: "living-goods", name: "생활용품" },
    ],
  },
  {
    slug: "health",
    name: "건강",
    children: [{ slug: "pharmacy", name: "약국" }],
  },
  {
    slug: "study-work",
    name: "업무/학습",
    children: [{ slug: "print", name: "문구/프린트" }],
  },
];

export const categoryOptions = categoryGroups.flatMap((group) =>
  group.children.map((category) => ({
    ...category,
    parentSlug: group.slug,
    parentName: group.name,
  })),
);

export function getCategoryBySlug(slug: string | null | undefined) {
  if (!slug) {
    return null;
  }

  return categoryOptions.find((category) => category.slug === slug) ?? null;
}
