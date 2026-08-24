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
  /**
   * The owner/repo it is built in, primary first.
   *
   * A list rather than a string because a project is not always one repository —
   * Resiege ships as two, split by who installs which half. The card folds their
   * activity together (see `mergeActivity`) rather than naming one and quietly
   * reporting only its numbers, which would understate the work in exactly the way
   * this file is not allowed to.
   */
  repos: [string, ...string[]];
  /**
   * Deployed, clickable instance. Optional: not everything here is a web app, and a
   * placeholder URL is worse than none — links.yml checks every one of these weekly,
   * so a made-up link becomes a link-rot issue rather than a missing feature. Without
   * one the card's title and its call to action fall back to the repository.
   */
  liveUrl?: string;
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
    repos: ["pabulum/vibelock"],
    liveUrl: "https://pabulum.github.io/vibelock/",
    tagline: "Item builds for Deadlock, generated from live match data.",
    insight:
      "Deadlock build guides rank items by win rate, but win rate mostly records *when* an item gets bought, not what it does. The expensive items are only affordable to players who are already winning, so they inherit a result they had no part in: on live match data, an item's raw win rate tracks the win probability that already held at the moment of purchase at r ≈ 0.91. Vibelock scores each item only against purchases made at a similar net worth, then fills each phase against the budget you'd realistically have, since the five best items rated separately rarely compose into a build you can afford.",
    stack: ["React", "TypeScript", "TanStack Query", "Vite", "Valibot"],
    pinned: true,
  },
  {
    name: "Slow Your Roll",
    repos: ["pabulum/SlowYourRoll"],
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
  {
    name: "Resiege",
    // Two repos, one project. The split is by who installs which half — resiege is what
    // a player installs, zonematch is what a server operator runs — which is a packaging
    // decision, not two pieces of work, so it reads as one card.
    repos: ["pabulum/resiege", "pabulum/zonematch"],
    tagline:
      "Quality-of-life patches and a revived multiplayer lobby for Dungeon Siege (2002).",
    insight:
      "Reviving a dead game usually stalls on its matchmaking server, but Dungeon Siege never hardcoded one: gun_server is a plain INI setting, so pointing a client at a self-hosted lobby is an edit rather than a binary patch or a DNS hijack. The harder half is that ZoneMatch was only ever *discovery* — it hands out addresses and play then runs peer-to-peer over DirectPlay 8, so a faithful revival yields a browsable game list full of games nobody behind NAT can join, and one that is safe to run in 2026 has to relay rather than hand a player's address to another player. The content half rewrites the game's own tank archives directly from Linux, with no Siege Editor and no Windows toolchain, mostly to surface things the game already ships and never offers you.",
    stack: ["Python", "Zig", "x86 assembly", "DirectPlay 8", "Wine/Proton"],
    pinned: true,
  },
];

export const PINNED = PROJECTS.filter((p) => p.pinned);
