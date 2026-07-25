import { z } from "zod";

import type { ModerationSuggestion } from "@/shared/admin-contracts";

const moderationSuggestionSchema = z.object({
  suggestedAction: z.enum(["approve", "review", "reject"]),
  confidence: z.number().int().min(0).max(100),
  summary: z.string().trim().min(1).max(2_000),
  checks: z.array(z.string().max(200)).max(50),
  flags: z.array(z.string().max(200)).max(50),
});

export function parseModerationSuggestion(
  value: unknown,
): ModerationSuggestion | null {
  const parsed = moderationSuggestionSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}
