// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { satteri } from "@astrojs/markdown-satteri";
import { remarkReadingTime } from "./src/lib/reading-time.mjs";
import { externalLinks } from "./src/lib/external-links.mjs";
import { cspInlineScripts } from "./src/lib/csp-inline-scripts.mjs";
import { isExternal } from "./src/lib/links";

export default defineConfig({
  site: "https://keefersery.com",
  // Static output. Everything — including the GitHub activity feed — is resolved at
  // build time, so the deployed site is plain HTML with no runtime data fetching.
  output: "static",
  trailingSlash: "always",
  integrations: [sitemap(), cspInlineScripts()],

  /*
   * Content Security Policy, emitted per page as a <meta http-equiv>. Astro hashes the
   * scripts and stylesheets it bundles; the two gaps it leaves are both handled here.
   *
   * `frame-ancestors` is deliberately *not* here — it is ignored in a meta element, so
   * it lives in public/_headers instead. The two policies compose: each is enforced
   * independently, so the header supplies framing rules and this supplies script rules.
   */
  security: {
    csp: {
      styleDirective: {
        /*
         * Shiki colours syntax with a per-token inline `style` attribute — 31 of them
         * on a single post page. Style attributes are governed by `style-src-attr`, and
         * they cannot be hashed: CSP hashes only cover <style> elements. This is why
         * Astro documents Shiki as unsupported under CSP.
         *
         * Astro prints a config warning at every build recommending Prism instead. It
         * is generic — it fires on `shikiConfig` being set at all and cannot see this
         * override — so it is expected here, not an outstanding problem. The Playwright
         * suite asserts zero CSP violations on a page with a highlighted code block,
         * which is the check that would actually catch a regression.
         *
         * Scoping the exemption to `kind: "attribute"` is what makes it acceptable.
         * `style-src` stays strict — a <style> element still needs a hash — and only
         * the attribute channel Shiki actually uses is opened. Putting 'unsafe-inline'
         * in `style-src` instead would be both broader and useless: a browser ignores
         * 'unsafe-inline' in any directive that also carries a hash.
         */
        resources: [{ resource: "'unsafe-inline'", kind: "attribute" }],
      },
    },
  },
  markdown: {
    processor: satteri({
      mdastPlugins: [remarkReadingTime],
      hastPlugins: [externalLinks({ isExternal })],
    }),
    // `github-dark-dimmed` painted every code block a blue-grey that belonged to no
    // other part of the site, and being a single theme it only ever suited one colour
    // scheme. Shipping both halves lets the stylesheet swap them with the palette.
    //
    // The `min-*` pair was tried first — it is by far the most restrained thing Shiki
    // ships, which is the right instinct here — but its dimmer tokens fall under 3:1
    // once the block sits on the sheet's own tint rather than the theme's near-black.
    // Unreadable code is not restraint. GitHub's pair is louder and contrast-checked.
    shikiConfig: {
      themes: { light: "github-light", dark: "github-dark" },
      wrap: true,
    },
  },
});
