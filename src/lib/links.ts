/**
 * Where a link points decides how it opens. One rule, one place — so a new link is
 * correct by construction rather than by remembering to add two attributes.
 */

import { SITE } from "../data/site";

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
