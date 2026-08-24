/** Single source of truth for identity. Read by the layout's JSON-LD, the footer, and the RSS feed. */

const ROLE = "Product engineer";

/**
 * The tagline without the role sentence in front of it.
 *
 * A search snippet and a link preview want different things from the same sentence. A
 * snippet is read cold, so it has to lead with the role; a preview already shows the
 * name as its site line and the role as its heading, so leading with the role again
 * makes the card say "Product engineer" three times over. Composing the tagline from
 * the two halves keeps that from becoming two strings that drift apart.
 */
const PITCH =
  "Live projects built in the open, with the reasoning behind each one.";

export const SITE = {
  name: "Keefer Sery",
  domain: "keefersery.com",
  url: "https://keefersery.com",
  role: ROLE,
  pitch: PITCH,

  /** Default <meta name="description"> for every page without its own, and the
   *  schema.org `description`. Needs to read as a search-result snippet. */
  tagline: `${ROLE}. ${PITCH}`,

  /** Routed through Cloudflare Email Routing. Keep catch-all off there. */
  email: "me@keefersery.com",

  /**
   * Named in the intro and emitted as schema.org `worksFor`, which is the strongest
   * entity-disambiguation signal available for an uncommon personal name. This is a
   * personal site, not an employer channel — the footer disclaimer says so.
   */
  employer: {
    name: "Bank of America",
    url: "https://www.bankofamerica.com",
    title: "Software Engineer III",
  },

  /** Rendered with rel="me". Each profile must link back here for the verification to hold. */
  profiles: [
    { label: "GitHub", url: "https://github.com/pabulum", handle: "@pabulum" },
    // { label: 'LinkedIn', url: 'https://www.linkedin.com/in/YOUR-SLUG/', handle: 'in/YOUR-SLUG' },
  ],

  /**
   * Repos the activity feed and project ranking pull from.
   *
   * A superset of what `PROJECTS` names: a repo listed here shows up in the activity
   * feed and the commit total whether or not it has a card, so work in progress is
   * visible before there is anything worth writing an insight about.
   */
  repos: [
    "pabulum/vibelock",
    "pabulum/SlowYourRoll",
    "pabulum/resiege",
    "pabulum/zonematch",
  ],
} as const;
