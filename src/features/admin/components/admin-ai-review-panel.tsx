"use client";

import {
  getModerationSuggestionActionLabel,
  getModerationSuggestionProviderLabel,
  type ModerationSuggestionRecord,
} from "@/features/admin/moderation-suggestion";

type AdminAiReviewPanelProps = {
  suggestion: ModerationSuggestionRecord;
};

function getConfidenceTone(confidence: number) {
  if (confidence >= 80) {
    return "bg-emerald-100 text-emerald-700";
  }

  if (confidence >= 60) {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-rose-100 text-rose-700";
}

export function AdminAiReviewPanel({ suggestion }: AdminAiReviewPanelProps) {
  return (
    <section
      data-testid="admin-ai-review-panel"
      className="rounded-3xl border border-sky-200 bg-sky-50/70 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            AI 1차 검수
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            {suggestion.summary}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
            {getModerationSuggestionActionLabel(
              suggestion.subjectType,
              suggestion.suggestedAction,
            )}
          </span>
          <span
            data-testid="admin-ai-review-confidence"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${getConfidenceTone(
              suggestion.confidence,
            )}`}
          >
            신뢰도 {suggestion.confidence}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            근거
          </p>
          <ul className="mt-2 grid gap-2 text-sm leading-6 text-stone-700">
            {suggestion.checks.map((check) => (
              <li
                key={check}
                className="rounded-2xl bg-white/80 px-3 py-2"
              >
                {check}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            주의 플래그
          </p>
          {suggestion.flags.length > 0 ? (
            <ul className="mt-2 grid gap-2 text-sm leading-6 text-stone-700">
              {suggestion.flags.map((flag) => (
                <li
                  key={flag}
                  className="rounded-2xl bg-white/80 px-3 py-2"
                >
                  {flag}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 rounded-2xl bg-white/80 px-3 py-2 text-sm text-stone-600">
              뚜렷한 위험 플래그는 아직 없습니다.
            </p>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs leading-5 text-stone-500">
        {getModerationSuggestionProviderLabel(suggestion.provider)}가{" "}
        {suggestion.generatedAt}에 자동 생성한 초안입니다. 최종 승인/반려는
        운영자가 직접 확정합니다.
      </p>
    </section>
  );
}
