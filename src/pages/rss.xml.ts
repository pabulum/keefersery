import rss from "@astrojs/rss";
import { getCollection, render } from "astro:content";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import type { APIContext } from "astro";
import { SITE } from "../data/site";
import { absolutiseHtml } from "../lib/links";

/**
 * The writing feed, carrying each post in full rather than just its description.
 *
 * A summary-only feed asks the reader to leave their reader, which for long-form notes
 * is most of the reason they subscribed in the first place. The bodies are markdown
 * written in this repo, not user input, so they go out unsanitised — `sanitize-html`
 * would be the right call the moment this feed carried anything submitted from outside.
 *
 * The container renders each post through the real markdown pipeline, so what a reader
 * receives is what the site shows: the same Shiki highlighting and the same external-link
 * decoration, rather than a second, subtly different rendering path.
 */

export async function GET(context: APIContext) {
  const posts = (await getCollection("writing"))
    .filter((p) => !p.data.draft)
    .sort((a, b) => +b.data.date - +a.data.date);

  const container = await AstroContainer.create();

  const items = await Promise.all(
    posts.map(async (post) => {
      const { Content } = await render(post);
      return {
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.date,
        link: `/writing/${post.id}/`,
        content: absolutiseHtml(await container.renderToString(Content)),
      };
    }),
  );

  return rss({
    title: `${SITE.name} — writing`,
    description: SITE.tagline,
    site: context.site ?? SITE.url,
    items,
  });
}
