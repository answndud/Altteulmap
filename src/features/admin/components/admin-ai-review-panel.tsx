"use client";

import { useState } from "react";

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
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const flagsLabel =
    suggestion.flags.length > 0 ? `주의 ${suggestion.flags.length}` : "주의 없음";

  return (
    <section
      data-testid="admin-ai-review-panel"
      className="rounded-[1rem] border border-stone-200 bg-[var(--altteul-bg-subtle)]/65 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-[var(--altteul-accent-text)]">
            AI 1차 검수
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            {suggestion.summary}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--altteul-accent-text)] ring-1 ring-stone-200">
            {getModerationSuggestionActionLabel(
              suggestion.subjectType,
              suggestion.suggestedAction,
            )}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-700 ring-1 ring-stone-200">
            {flagsLabel}
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

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-5 text-stone-500">
          {getModerationSuggestionProviderLabel(suggestion.provider)} ·{" "}
          {suggestion.generatedAt}
        </p>
        <button
          type="button"
          onClick={() => setIsEvidenceOpen((current) => !current)}
          className="altteulmap-button inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-stone-700"
        >
          {isEvidenceOpen ? "근거 접기" : "근거 보기"}
        </button>
      </div>

      {isEvidenceOpen ? (
        <div className="mt-4 grid gap-4 border-t border-stone-200 pt-4 lg:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold text-stone-500">근거</p>
            <ul className="mt-2 grid gap-2 text-sm leading-6 text-stone-700">
              {suggestion.checks.map((check) => (
                <li
                  key={check}
                  className="rounded-[0.9rem] bg-white/80 px-3 py-2"
                >
                  {check}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-stone-500">주의 플래그</p>
            {suggestion.flags.length > 0 ? (
              <ul className="mt-2 grid gap-2 text-sm leading-6 text-stone-700">
                {suggestion.flags.map((flag) => (
                  <li
                    key={flag}
                    className="rounded-[0.9rem] bg-white/80 px-3 py-2"
                  >
                    {flag}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 rounded-[0.9rem] bg-white/80 px-3 py-2 text-sm text-stone-600">
                뚜렷한 위험 플래그는 아직 없습니다.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
