import { getCollection, render } from "astro:content";
import type { APIRoute, GetStaticPaths } from "astro";
import { SITE } from "../../data/site";
import { renderOgCard } from "../../lib/og";

/**
 * One card per post, at `/og/<slug>.png`.
 *
 * Drafts are filtered out for the same reason they are on the post route: a path that
 * exists is a path that can be found, and an unlinked preview image for an unpublished
 * post is still a published file.
 */
export const getStaticPaths = (async () => {
  const posts = (await getCollection("writing")).filter((p) => !p.data.draft);
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { post } = props as {
    post: Awaited<ReturnType<typeof getCollection>>[number];
  };

  // The same remark plugin the post page reads its reading time from, rather than a
  // second word count that could disagree with the one shown on the page itself.
  const { remarkPluginFrontmatter } = await render(post);
  const readingTime: string | undefined = remarkPluginFrontmatter?.readingTime;

  const date = post.data.date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return new Response(
    await renderOgCard({
      eyebrow: SITE.name,
      title: post.data.title,
      meta: [date, readingTime].filter(Boolean).join(" · "),
    }),
    { headers: { "Content-Type": "image/png" } },
  );
};
