/** Single source of truth for identity. Read by the layout's JSON-LD, the footer, and the RSS feed. */

export const SITE = {
  name: "Keefer Sery",
  domain: "keefersery.com",
  url: "https://keefersery.com",
  role: "Product engineer",

  tagline:
    "Product engineer. I take vague problems to shipped things — the analysis, the interface, and the deploy.",

  /** Routed through Cloudflare Email Routing. Keep catch-all off there. */
  email: "me@keefersery.com",

  /** Rendered with rel="me". Each profile must link back here for the verification to hold. */
  profiles: [
    { label: "GitHub", url: "https://github.com/pabulum", handle: "@pabulum" },
    // { label: 'LinkedIn', url: 'https://www.linkedin.com/in/YOUR-SLUG/', handle: 'in/YOUR-SLUG' },
  ],

  /** Repos the activity feed and project ranking pull from. */
  repos: ["pabulum/vibelock", "pabulum/SlowYourRoll"],
} as const;
