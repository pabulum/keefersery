/**
 * Open Graph card renderer, run at build time only.
 *
 * A link preview is the one piece of the site that gets designed once and then read
 * everywhere else — in a chat window, a timeline, a Slack unfurl — at roughly half the
 * size it was drawn. So this is not the page screenshotted; it is the same system
 * (sheet stock, spot-colour band, two weights of Inter, one bold rule) re-set as a
 * poster, with everything scaled for a card that will usually be looked at small.
 *
 * Satori lays the card out with a flexbox subset and hands back SVG; resvg rasterises
 * it. Both are build-only — nothing here ships to a browser, and the site stays static.
 */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const require = createRequire(import.meta.url);

/**
 * Static Inter, deliberately not the `@fontsource-variable/inter` the site itself
 * serves. Satori's OpenType parser rejects woff2 outright ("Unsupported OpenType
 * signature wOF2") and throws on Inter's variable TTF, so the card needs plain
 * single-weight woff. These two files are the roman/bold pair the stylesheet uses and
 * they never leave the build.
 */
const font = (file: string) =>
  readFileSync(require.resolve(`@fontsource/inter/files/${file}`));

const FONTS = [
  {
    name: "Inter",
    data: font("inter-latin-400-normal.woff"),
    weight: 400 as const,
    style: "normal" as const,
  },
  {
    name: "Inter",
    data: font("inter-latin-700-normal.woff"),
    weight: 700 as const,
    style: "normal" as const,
  },
];

/* The card's only inks, lifted from the stylesheet's light palette. A preview image is
   one fixed file — it cannot answer prefers-color-scheme — so it is always the sheet. */
const SHEET = "#f5f2eb";
const INK = "#14130f";
const INK_FAINT = "#5c594f";
const RED = "#eb0000";

/* 1200x630 is the size every scraper crops to 1.91:1 and the largest most will cache.
   Base.astro states the same pair in og:image:width/height — deliberately not imported
   from here, because that would drag satori and resvg into every page's module graph
   for two numbers that are a fixed convention rather than a choice. */
const WIDTH = 1200;
const HEIGHT = 630;

type Card = {
  /** Small capped line at the head of the card. */
  eyebrow: string;
  /** The one thing the card exists to say. */
  title: string;
  /** Capped line hanging under the rule — date, reading time, section. */
  meta: string;
};

/**
 * Satori takes a React-shaped tree, and this site has no React in it. A three-argument
 * `h` is the whole of what's needed to avoid pulling one in for a build script.
 */
const h = (style: Record<string, unknown>, children: unknown) => ({
  type: "div",
  props: { style, children },
});

/**
 * Three steps rather than a fitted curve. Titles here are one to twelve words, and the
 * jump between steps stays inside the stylesheet's own display range — the point is
 * that a long title still breaks to at most three lines, not that every title is set
 * to a computed optimum.
 */
const titleSize = (title: string) =>
  title.length <= 36 ? 76 : title.length <= 72 ? 62 : 52;

/**
 * Returns a plain `Uint8Array<ArrayBuffer>` rather than resvg's Node `Buffer`. The
 * endpoints pass this straight to a `Response`, and a Buffer — or any view whose
 * backing store is only known to be `ArrayBufferLike`, since that admits
 * SharedArrayBuffer — is not assignable to `BodyInit`, however well it works at
 * runtime. The copy is one memcpy per card at build time.
 */
export async function renderOgCard({
  eyebrow,
  title,
  meta,
}: Card): Promise<Uint8Array<ArrayBuffer>> {
  const svg = await satori(
    h(
      {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: SHEET,
        fontFamily: "Inter",
      },
      [
        /* The band, thicker than the site's 7px hairline for the same reason the type
           is set large: at the size a card is actually viewed, a scaled-down hairline
           is not a band, it is an artefact. */
        h({ display: "flex", height: 14, background: RED }, ""),

        h(
          {
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            padding: "64px 76px 56px",
          },
          [
            h(
              {
                display: "flex",
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: "0.13em",
                textTransform: "uppercase",
                color: INK,
              },
              eyebrow,
            ),

            /* Pushed down so the title sits against the rule rather than floating in
               the middle of the card. The Canon's point about type hanging from a
               ruler cuts both ways: what is above one should be tight to it too. */
            h(
              {
                display: "flex",
                marginTop: "auto",
                fontSize: titleSize(title),
                fontWeight: 700,
                letterSpacing: "-0.025em",
                lineHeight: 1.1,
                color: INK,
              },
              title,
            ),

            h(
              { display: "flex", height: 3, background: INK, marginTop: 44 },
              "",
            ),

            h(
              {
                display: "flex",
                paddingTop: 16,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.13em",
                textTransform: "uppercase",
                color: INK_FAINT,
              },
              meta,
            ),
          ],
        ),
      ],
    ),
    { width: WIDTH, height: HEIGHT, fonts: FONTS },
  );

  return new Uint8Array(
    new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng(),
  );
}
