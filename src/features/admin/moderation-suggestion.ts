export type ModerationSuggestionSubjectType =
  | "place_submission"
  | "price_report"
  | "content_report";

export type ModerationSuggestionAction = "approve" | "review" | "reject";

export type ModerationSuggestionRecord = {
  subjectType: ModerationSuggestionSubjectType;
  subjectKey: string;
  provider: string;
  suggestedAction: ModerationSuggestionAction;
  confidence: number;
  summary: string;
  checks: string[];
  flags: string[];
  generatedAt: string;
};

const moderationSuggestionActionLabelMap: Record<
  ModerationSuggestionSubjectType,
  Record<ModerationSuggestionAction, string>
> = {
  place_submission: {
    approve: "승인 권장",
    review: "추가 확인",
    reject: "반려 권장",
  },
  price_report: {
    approve: "승인 권장",
    review: "추가 확인",
    reject: "반려 권장",
  },
  content_report: {
    approve: "처리 완료 권장",
    review: "검토 중 권장",
    reject: "기각 권장",
  },
};

export function getModerationSuggestionActionLabel(
  subjectType: ModerationSuggestionSubjectType,
  action: ModerationSuggestionAction,
) {
  return moderationSuggestionActionLabelMap[subjectType][action];
}

export function getModerationSuggestionProviderLabel(provider: string) {
  switch (provider) {
    case "local_rule_agent":
      return "로컬 검수 에이전트";
    default:
      return provider;
  }
}
