/**
 * The routes the build actually emitted, discovered from dist/ rather than hardcoded.
 *
 * Two reasons this is derived instead of listed. Adding a page should not require
 * remembering to add it here — an untested page is exactly the one that breaks. And the
 * post route only exists when a non-draft post exists, so a fixed list would either
 * fail on a site with no published writing yet, or quietly stop covering post pages.
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";

export type Route = {
  /** URL path to visit. */
  path: string;
  /** Readable name for test titles. */
  name: string;
};

function describePath(path: string): string {
  if (path === "/") return "home";
  if (path === "/404.html") return "404";
  if (path === "/writing/") return "writing index";
  return `post ${path}`;
}

export const ROUTES: Route[] = readdirSync(DIST, { recursive: true })
  .map(String)
  .filter((f) => f.endsWith(".html"))
  .map((file) => {
    if (file === "404.html") return "/404.html";
    // dist/index.html -> "/", dist/writing/index.html -> "/writing/"
    const dir = file.replace(/(^|\/)index\.html$/, "$1");
    return `/${dir}`.replace(/\/{2,}/g, "/");
  })
  .sort()
  .map((path) => ({ path, name: describePath(path) }));

/**
 * Post pages are the only ones that can contain a highlighted code block, which is the
 * case that makes CSP interesting — Shiki emits a per-token inline style attribute.
 * Null while every post is still a draft.
 */
export const POST_ROUTE: Route | null =
  ROUTES.find(
    (r) => r.path.startsWith("/writing/") && r.path !== "/writing/",
  ) ?? null;

/** Sanity check: a build that emitted nothing would make every suite vacuously pass. */
export function assertRoutesDiscovered(): void {
  if (ROUTES.length === 0) {
    throw new Error(
      `No HTML files found in ${join(process.cwd(), DIST)}. Run \`npm run build\` first.`,
    );
  }
}
