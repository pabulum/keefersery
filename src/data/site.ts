/**
 * Single source of truth for identity. Everything that needs your name, contact, or
 * profile links reads from here — including the JSON-LD `Person` block in the layout,
 * which is what lets a search engine treat these accounts as one entity rather than
 * three unrelated pages.
 */

export const SITE = {
  name: "Keefer Sery",
  domain: "keefersery.com",
  url: "https://keefersery.com",

  /** Shown under your name. Positioning, not a job title. */
  role: "Product engineer",

  /** Used for <title> suffixes and OG descriptions. */
  tagline:
    "Product engineer. I take vague problems to shipped things — the analysis, the interface, and the deploy.",

  /**
   * Routed through Cloudflare Email Routing to the real inbox, which is the point:
   * a domain address does more for the "this is my locus" goal than a Gmail one,
   * and it stays disposable. If harvesters ever bury it, burn this local-part and
   * mint a new one without touching the underlying account.
   *
   * Keep catch-all OFF in the Cloudflare dashboard — it turns every dictionary
   * guess against the domain into a delivered message.
   */
  email: "me@keefersery.com",

  /**
   * `rel="me"` on each of these is what makes the identity graph machine-verifiable:
   * a link here plus a link back from the profile is a two-way proof that the same
   * person controls both. Add the site URL to each profile for the return leg.
   */
  profiles: [
    { label: "GitHub", url: "https://github.com/pabulum", handle: "@pabulum" },
    // TODO: uncomment once the profile exists, then add keefersery.com to it.
    // { label: 'LinkedIn', url: 'https://www.linkedin.com/in/YOUR-SLUG/', handle: 'in/YOUR-SLUG' },
  ],

  /** Repos the activity feed and project ranking pull from. */
  repos: ["pabulum/vibelock", "pabulum/SlowYourRoll"],
} as const;
