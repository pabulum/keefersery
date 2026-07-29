/** Single source of truth for identity. Read by the layout's JSON-LD, the footer, and the RSS feed. */

export const SITE = {
  name: "Keefer Sery",
  domain: "keefersery.com",
  url: "https://keefersery.com",
  role: "Product engineer",

  /** Default <meta name="description"> for every page without its own, and the
   *  schema.org `description`. Needs to read as a search-result snippet. */
  tagline:
    "Product engineer. Live projects built in the open, with the reasoning behind each one.",

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

  /** Repos the activity feed and project ranking pull from. */
  repos: ["pabulum/vibelock", "pabulum/SlowYourRoll"],
} as const;
