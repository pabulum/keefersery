import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const writing = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    /** Shown in the feed and in search results. One or two sentences. */
    description: z.string(),
    date: z.coerce.date(),
    /** Set true to keep a post out of the feed and the writing index. */
    draft: z.boolean().default(false),
    /** Optional: where this was cross-posted, for the distribution play. */
    crosspost: z.string().url().optional(),
  }),
})

export const collections = { writing }
