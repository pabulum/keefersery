import type { APIRoute, GetStaticPaths } from "astro";
import { readFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

/**
 * Raster icons, rasterised at build time from the same `public/favicon.svg` the modern
 * `rel="icon"` points at.
 *
 * Generated rather than checked in so there is still one source of truth for the mark:
 * a checked-in PNG set is four binaries that silently keep showing the *old* logo after
 * someone edits the SVG. Nothing here ships a rasteriser to the browser — `@resvg/resvg-js`
 * is already a build-only dependency for the OG cards.
 *
 * An SVG favicon covers current browsers, so these exist for the places that still
 * cannot take one:
 *
 *  - **180** — iOS home screen (`apple-touch-icon`). iOS ignores SVG entirely.
 *  - **32** — the `image/png` fallback for older Safari and most feed readers.
 *  - **192 / 512** — the two sizes a web app manifest is expected to provide.
 */

const SOURCE = "public/favicon.svg";

/** The four sizes referenced by Base.astro and site.webmanifest. Keep them in sync. */
export const ICON_SIZES = [32, 180, 192, 512] as const;

export const getStaticPaths: GetStaticPaths = () =>
  ICON_SIZES.map((size) => ({ params: { size: String(size) } }));

export const GET: APIRoute = ({ params }) => {
  const size = Number(params.size);

  // The route is statically generated from ICON_SIZES, so this can only fire if that
  // list and the generated paths ever disagree. Better a build error than a 0x0 PNG.
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error(`[icons] invalid icon size: ${params.size}`);
  }

  const svg = readFileSync(SOURCE);
  const png = new Resvg(svg, {
    // The mark is square, so constraining width fixes both dimensions.
    fitTo: { mode: "width", value: size },
  })
    .render()
    .asPng();

  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png" },
  });
};
