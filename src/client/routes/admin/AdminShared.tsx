import { moderationActionMap } from "@/client/routes/admin/labels";
import type { ModerationSuggestion } from "@/client/routes/admin/types";

export function DataBadge({ source, mock }: { source: string; mock: boolean }) {
  return (
    <span
      className={`altteulmap-badge ${
        mock
          ? "border-[rgba(181,90,43,0.18)] bg-[rgba(181,90,43,0.12)] text-[var(--altteul-accent-text)]"
          : "border-[var(--altteul-primary-border)] bg-[var(--altteul-primary-soft)] text-[var(--altteul-primary-text)]"
      }`}
    >
      데이터: {source === "database" ? "실데이터" : "목업"}
    </span>
  );
}

export function AdminAiReviewPanel({
  fallback,
  suggestion,
}: {
  fallback: string;
  suggestion?: ModerationSuggestion;
}) {
  return (
    <div
      data-testid="admin-ai-review-panel"
      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-amber-800">AI 1차 검수</p>
        {suggestion ? (
          <span className="rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
            {moderationActionMap[suggestion.suggestedAction]} ·{" "}
            {suggestion.confidence}%
          </span>
        ) : null}
      </div>
      <p className="mt-1">{suggestion?.summary ?? fallback}</p>
      {suggestion && (suggestion.flags.length > 0 || suggestion.checks.length > 0) ? (
        <div className="mt-2 grid gap-1 text-xs">
          {suggestion.flags.length > 0
            ? suggestion.flags.slice(0, 2).map((flag) => (
                <p key={`flag-${flag}`}>주의: {flag}</p>
              ))
            : suggestion.checks.slice(0, 2).map((check) => (
                <p key={`check-${check}`}>확인: {check}</p>
              ))}
        </div>
      ) : null}
    </div>
  );
}

export function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50 p-8 text-sm leading-6 text-stone-600">
      {message}
    </div>
  );
}
