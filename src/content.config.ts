import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
// Astro deprecated its own `z` re-export from `astro:content`. Importing zod directly
// is the replacement. `zod` is declared as a direct dependency on a caret range that
// overlaps astro's own (`^4.3.6`), so npm resolves both to a single copy — a schema
// built here is validated by the same zod instance astro validates with.
import { z } from "zod";

const writing = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/writing" }),
  schema: z.object({
    title: z.string(),
    /** Shown in the feed and in search results. One or two sentences. */
    description: z.string(),
    date: z.coerce.date(),
    /** Set true to keep a post out of the feed and the writing index. */
    draft: z.boolean().default(false),
    /** Optional: where this was cross-posted, for the distribution play. */
    crosspost: z.url().optional(),
  }),
});

export const collections = { writing };
