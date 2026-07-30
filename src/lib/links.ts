/**
 * Where a link points decides how it opens. One rule, one place — so a new link is
 * correct by construction rather than by remembering to add two attributes.
 */

// Explicit `.ts`, unlike the extensionless imports elsewhere in the project: this
// module is unit-tested with `node --test`, which runs it through Node's own resolver
// rather than Vite's, and Node's ESM resolver does not guess extensions. See CLAUDE.md.
import { SITE } from "../data/site.ts";

const SITE_HOST = new URL(SITE.url).host;

/**
 * True only for http(s) links that leave the site.
 *
 * Relative paths and fragments are in-site by definition. `mailto:` and `tel:` are
 * deliberately excluded: they hand off to another application, so a new tab either
 * sits empty or blanks out the moment the handler takes over.
 */
export function isExternal(href: string): boolean {
  if (!/^(https?:)?\/\//i.test(href)) return false;
  try {
    return new URL(href, SITE.url).host !== SITE_HOST;
  } catch {
    return false;
  }
}

/**
 * Rewrites root-relative `href`/`src` attributes in a fragment of HTML to absolute URLs.
 *
 * For content that leaves the site as markup rather than as a page: the RSS feed carries
 * rendered posts, and a feed reader resolves `/writing/a-post/` against *its* origin, not
 * ours, so every in-site link in a syndicated post would 404.
 *
 * Only root-relative paths are rewritten. Absolute URLs, protocol-relative URLs,
 * fragments and `mailto:` targets are all left exactly as they are — the `(?!\/)` is what
 * keeps `//cdn.example.com` from being mangled into the site's own origin.
 */
export function absolutiseHtml(html: string): string {
  return html.replace(
    /(<(?:a|img|source)\b[^>]*?\s(?:href|src|srcset)=")\/(?!\/)/g,
    `$1${SITE.url}/`,
  );
}

/**
 * The full attribute set for an anchor, href included — spread it as the only thing
 * an `<a>` needs to know about its destination:
 *
 *     <a {...linkAttrs(project.liveUrl)}>Open the app</a>
 *
 * Internal links come back as a bare href, so this is safe to apply to every link
 * uniformly rather than only the ones known to be off-site. Carrying the href here is
 * what keeps the URL expression from being written twice at each call site.
 *
 * @param rel Extra rel token to preserve, e.g. "me" on the identity links.
 */
export function linkAttrs(href: string, rel?: string) {
  if (!isExternal(href)) return rel ? { href, rel } : { href };
  return {
    href,
    target: "_blank",
    rel: [rel, "noopener", "noreferrer"].filter(Boolean).join(" "),
  };
}
