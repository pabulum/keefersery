// @ts-check
import { defineConfig, fontProviders } from "astro/config";
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
   * Inter, through Astro's font pipeline rather than a bare `import` of the Fontsource
   * CSS, so the file gets a real `<link rel="preload">` and the fallback gets adjusted
   * metrics. It is the largest asset on the page, and previously the browser could not
   * discover it until the stylesheet had parsed.
   *
   * The `local` provider, naming one exact file, is the only configuration that works
   * here. Both alternatives were tried and both are wrong:
   *
   *  - `fontProviders.fontsource()` resolves Inter to `inter-latin-wght-normal.woff2`
   *    (verified byte-identical). That is the *weight-only* variable font. It is 24kB
   *    smaller because it has no optical-size axis — which would make
   *    `font-optical-sizing: auto` in global.css silently do nothing. The type would
   *    still render, just flatter, and no test would catch it.
   *  - `fontProviders.npm()` reading `opsz.css` keeps the right axis but emits all seven
   *    of Fontsource's subsets *and preloads every one of them* — 348kB of fonts fetched
   *    eagerly, replacing the 73kB that unicode-range used to fetch lazily. Strictly
   *    worse than doing nothing.
   *
   * Naming the file directly sidesteps both. `src` accepts a package import, so this
   * still resolves through the pinned `@fontsource-variable/inter` dependency rather than
   * vendoring a binary, and a path that ever stops resolving fails the build loudly.
   *
   * Tradeoff worth stating: only the latin subset ships now, where all seven used to be
   * built (though only latin was ever fetched). Text outside that range falls back to the
   * system stack. For an English site with an English byline that is the right side of
   * the trade; add another variant here if that stops being true.
   */
  fonts: [
    {
      provider: fontProviders.local(),
      name: "Inter Variable",
      cssVariable: "--font-inter",
      options: {
        variants: [
          {
            src: [
              "@fontsource-variable/inter/files/inter-latin-opsz-normal.woff2",
            ],
            // The full variable range, not static instances: one file covers every weight
            // the stylesheet asks for (--w-roman 400, --w-bold 700).
            weight: "100 900",
            style: "normal",
          },
        ],
      },
      display: "swap",
      // The stack that used to live in global.css. Astro derives `size-adjust` and
      // `ascent-override` from the real file so the swap does not shift the grid.
      fallbacks: [
        "Helvetica Neue",
        "Helvetica",
        "Liberation Sans",
        "Arial",
        "sans-serif",
      ],
    },
  ],

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
  experimental: {
    /*
     * Frontmatter autocompletion and type hints for `src/content/writing/*.md` in the
     * editor, driven by the zod schema in src/content.config.ts. Build-time only — it
     * generates editor metadata and changes nothing about the output.
     */
    contentIntellisense: true,

    /*
     * Lets Chrome DevTools write CSS edits straight back to the source file instead of
     * losing them on reload. Worth having on a site whose styling is ~1300 lines of
     * hand-tuned CSS with no component library under it, where most of the work is
     * nudging values and looking at the result.
     *
     * Dev-server only; it has no effect on `astro build`.
     */
    chromeDevtoolsWorkspace: true,
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
