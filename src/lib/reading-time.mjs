/**
 * Remark plugin: estimates reading time and exposes it on the page frontmatter.
 *
 * Written inline rather than pulled from npm — it's a word count and a division, and
 * the two common packages for it bring in a mdast utility tree we'd otherwise not need.
 */

const WORDS_PER_MINUTE = 225

/** Concatenate every text-bearing node, skipping code blocks (nobody reads those linearly). */
function textOf(node) {
  if (node.type === 'code' || node.type === 'inlineCode') return ''
  if (typeof node.value === 'string') return node.value
  if (!Array.isArray(node.children)) return ''
  return node.children.map(textOf).join(' ')
}

export function remarkReadingTime() {
  return (tree, file) => {
    const words = textOf(tree).split(/\s+/u).filter(Boolean).length
    const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE))
    file.data.astro.frontmatter.readingTime = `${minutes} min read`
    file.data.astro.frontmatter.wordCount = words
  }
}
