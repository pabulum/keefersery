---
# --- Required ---------------------------------------------------------------

# Plain string. Shown as the <h1> on the post page and as the link text in the
# writing index, the homepage feed, and RSS. No markdown — it renders as text.
title: An example post

# Plain string, one or two sentences. This is the only summary the site has: it
# appears under the title in the writing index, in the <meta name="description">
# tag, in the RSS item description, and in search results. Write it for someone
# deciding whether to click.
description: >-
  A reference post showing every frontmatter field the writing collection accepts.
  Kept as a permanent draft so it never publishes.

# YYYY-MM-DD. Sorts the writing index and the homepage feed (newest first) and
# becomes the RSS pubDate. Formatted in UTC on display, so a bare date is safest —
# adding a time and offset is how posts end up showing the wrong day.
date: 2026-07-27

# --- Optional ---------------------------------------------------------------

# Defaults to false when omitted. True keeps the post out of the writing index,
# RSS, and homepage feed, and prevents a page being generated for it at all.
# Drafts still render under `npm run dev`, so you can preview at the real URL.
draft: true

# Must be a full, valid URL or the build fails. Set it when the post also lives
# somewhere with an existing audience; the feed marks the entry so a reader can
# tell this was published in more than one place. Omit the line entirely when it
# wasn't cross-posted — an empty value is a validation error, not a blank.
crosspost: https://example.com/posts/an-example-post
---

Body starts here, in standard markdown. The filename sets the URL, so this file
publishes to `/writing/example/` — rename the file to change the slug.

Reading time is computed from this body automatically by the remark plugin. Don't
put it in the frontmatter.

## Headings start at h2

The `title` field supplies the h1, so opening the body with `#` gives the page two
competing top-level headings. Start at `##` and nest from there.

Standard inline syntax works as expected: **bold**, _italic_, `inline code`,
[links](https://keefersery.com/), and footnotes.

- Bullet lists
- Work normally

1. As do
2. Numbered lists

> Blockquotes render with their own styling.

Fenced code blocks are highlighted by Shiki using the `github-dark-dimmed` theme
configured in [astro.config.mjs](../../../astro.config.mjs). Long lines wrap rather
than scroll horizontally, so you don't need to hand-break them:

```ts
export function winRate(matches: Match[]): number {
  const won = matches.filter((m) => m.won).length;
  return won / matches.length;
}
```

Name the language on the fence — an unlabelled block renders as plain monospace
with no highlighting.
