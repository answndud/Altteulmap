import { z } from "zod";

export const placeReactionSchema = z.object({
  reaction: z.enum(["like", "dislike"]).nullable(),
});

export type PlaceReactionInput = z.output<typeof placeReactionSchema>;
