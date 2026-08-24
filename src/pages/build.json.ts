import type { APIRoute } from "astro";

/**
 * When this build ran.
 *
 * The site is static and every relative date in it — "last push today", "5d ago" — is
 * resolved against `Date.now()` at build time and then frozen into the HTML. That makes
 * a stalled pipeline invisible in the worst way: the page does not degrade, it goes on
 * asserting freshness it no longer has. This site served an Aug 3 build for three weeks
 * claiming "last push today", and nothing in the output could have told you.
 *
 * So the build date ships as a fact of its own, and `.github/workflows/freshness.yml`
 * polls it against the live domain. Two more obvious homes were rejected:
 *
 * - RSS `lastBuildDate` means "the last time the channel's content changed". The channel
 *   is /writing/, which changes a few times a year; the site rebuilds nightly. Putting
 *   the build time there would make the field say something untrue to every reader whose
 *   feed reader believes it.
 * - A `<meta>` element puts it on every page, where it counts against the
 *   `resource-summary:document:size` budget in lighthouserc.json and has to be explained
 *   to anyone reading the source. An endpoint costs the pages nothing.
 *
 * Deliberately just the timestamp. The commit SHA looks tempting for correlating a live
 * deploy with a revision, but "is what is being served current" is answerable without it,
 * and a second field is a second thing to keep true.
 */
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ builtAt: new Date().toISOString() }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
