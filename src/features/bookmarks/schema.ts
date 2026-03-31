import { z } from "zod";

export const bookmarkToggleSchema = z.object({
  bookmarked: z.boolean(),
});

export type BookmarkToggleInput = z.output<typeof bookmarkToggleSchema>;
