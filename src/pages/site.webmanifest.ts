import type { APIRoute } from "astro";
import { SITE } from "../data/site";

/**
 * Web app manifest.
 *
 * Not an attempt to be an installable app — there is no service worker and no offline
 * story, and a personal site does not need one. It exists so that a visitor who does
 * pin the site to an Android home screen gets the mark and the right name instead of a
 * screenshot and a URL, and so the icon set has a declared home.
 *
 * `display: "browser"` is deliberate: it says "this is a website", which stops browsers
 * offering an install prompt for something that gains nothing from being installed.
 */
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      {
        name: SITE.name,
        short_name: SITE.name,
        description: SITE.tagline,
        start_url: "/",
        display: "browser",
        // The red the mark is printed in — see public/favicon.svg. Held flat across
        // both colour schemes for the same reason the icon is.
        theme_color: "#eb0000",
        background_color: "#f5f2eb",
        icons: [
          { src: "/icons/192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      null,
      2,
    ),
    { headers: { "Content-Type": "application/manifest+json" } },
  );
