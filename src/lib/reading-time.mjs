/**
 * Sätteri mdast plugin: estimates reading time and exposes it on the page frontmatter.
 *
 * Written inline rather than pulled from npm — it's a word count and a division, and
 * the packages for it would drag the whole unified/mdast tree back in, which Astro 7
 * no longer installs by default.
 *
 * Exported as a factory: Sätteri calls it once per compile, so `words` resets per
 * document rather than accumulating across posts.
 */

const WORDS_PER_MINUTE = 225;

export function remarkReadingTime() {
  let words = 0;
  return {
    name: "reading-time",
    /** Only `text` nodes are visited, so code blocks and inline code are skipped for free. */
    text(node, ctx) {
      words += node.value.split(/\s+/u).filter(Boolean).length;
      const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
      ctx.data.astro.frontmatter.readingTime = `${minutes} min read`;
      ctx.data.astro.frontmatter.wordCount = words;
    },
  };
}
