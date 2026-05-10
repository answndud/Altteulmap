import { z } from "zod";

export const bookmarkToggleSchema = z.object({
  bookmarked: z.boolean(),
});
