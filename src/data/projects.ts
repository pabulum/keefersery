/**
 * Hand-written project metadata.
 *
 * Everything quantitative — commit counts, date ranges, activity — comes from the
 * GitHub API at build time (see src/lib/github.ts). What lives here is the part a
 * machine can't derive: what the thing is, and why it was interesting to build.
 *
 * `insight` is the load-bearing field. Most portfolio sites list what a project does;
 * the differentiator is the reasoning behind it. Keep it to one specific, falsifiable
 * claim — the kind of thing that makes a reader want to open the repo.
 */

export type Project = {
  /** Display name. */
  name: string;
  /** owner/repo on GitHub. */
  repo: string;
  /** Deployed, clickable instance. */
  liveUrl: string;
  /** One line: what it is, for whom. */
  tagline: string;
  /** The non-obvious problem and how it was solved. Two or three sentences, max. */
  insight: string;
  /** Stack chips. Order matters — most distinctive first. */
  stack: string[];
  /** Set false to hide without deleting. */
  pinned: boolean;
};

export const PROJECTS: Project[] = [
  {
    name: "Vibelock",
    repo: "pabulum/vibelock",
    liveUrl: "https://pabulum.github.io/vibelock/",
    tagline: "Item builds for Deadlock, generated from live match data.",
    insight:
      "Deadlock build guides rank items by win rate, but win rate mostly records *when* an item gets bought, not what it does. The expensive items are only affordable to players who are already winning, so they inherit a result they had no part in: on live match data, an item's raw win rate tracks the win probability that already held at the moment of purchase at r ≈ 0.91. Vibelock scores each item only against purchases made at a similar net worth, then fills each phase against the budget you'd realistically have, since the five best items rated separately rarely compose into a build you can afford.",
    stack: ["React", "TypeScript", "TanStack Query", "Vite", "Valibot"],
    pinned: true,
  },
  {
    name: "Slow Your Roll",
    repo: "pabulum/SlowYourRoll",
    liveUrl: "https://pabulum.github.io/SlowYourRoll/",
    tagline: "Expected-value tracker for World of Warcraft bonus rolls.",
    insight:
      "A bonus roll buys one extra chance at a boss's loot, and the usual advice is to spend it where you have the most upgrades, or where your best-in-slot item drops. Both fail because a roll draws from the boss's entire loot table, so a long list of upgrades dilutes every individual chance, while a small shot at a big upgrade is often worth less than a good shot at a modest one. Slow Your Roll scores what a roll is actually worth on average, then applies that number to the decisions around it: which boss to spend on, whether the guaranteed item in your weekly vault beats rolling, and whether switching loot specialization would improve the pool.",
    stack: [
      "Vanilla JS",
      "TypeScript (checkJs)",
      "Zero-build static",
      "Node test runner",
    ],
    pinned: true,
  },
];

export const PINNED = PROJECTS.filter((p) => p.pinned);
