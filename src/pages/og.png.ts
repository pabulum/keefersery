import type { APIRoute } from "astro";
import { SITE } from "../data/site";
import { renderOgCard } from "../lib/og";

/**
 * The site-wide card, used by every page that isn't a post. Built once at `/og.png`.
 *
 * It says the name and the role and nothing else. A default preview is what someone
 * sees when a link to the home page or the index pages is pasted somewhere, and at
 * that moment the only useful job it has is identifying whose site this is.
 */
export const GET: APIRoute = async () =>
  new Response(
    await renderOgCard({
      eyebrow: SITE.domain,
      title: SITE.name,
      meta: SITE.role,
    }),
    { headers: { "Content-Type": "image/png" } },
  );
