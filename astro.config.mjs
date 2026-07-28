// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { satteri } from "@astrojs/markdown-satteri";
import { remarkReadingTime } from "./src/lib/reading-time.mjs";
import { externalLinks } from "./src/lib/external-links.mjs";
import { isExternal } from "./src/lib/links";

export default defineConfig({
  site: "https://keefersery.com",
  // Static output. Everything — including the GitHub activity feed — is resolved at
  // build time, so the deployed site is plain HTML with no runtime data fetching.
  output: "static",
  trailingSlash: "always",
  integrations: [sitemap()],
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
