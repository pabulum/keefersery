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
  name: string
  /** owner/repo on GitHub. */
  repo: string
  /** Deployed, clickable instance. */
  liveUrl: string
  /** One line: what it is, for whom. */
  tagline: string
  /** The non-obvious problem and how it was solved. Two or three sentences, max. */
  insight: string
  /** Stack chips. Order matters — most distinctive first. */
  stack: string[]
  /** Set false to hide without deleting. */
  pinned: boolean
}

export const PROJECTS: Project[] = [
  {
    name: 'Vibelock',
    repo: 'pabulum/vibelock',
    liveUrl: 'https://pabulum.github.io/vibelock/',
    tagline: 'Data-driven item builds for the game Deadlock, generated from live match data.',
    insight:
      "Most build sites rank items by win rate, but an item's win rate mostly measures *when* it gets bought — expensive items are bought by players already winning, so they look good regardless of what they do. On live data that raw win rate correlates at r ≈ 0.91 with the win probability that already held at the moment of purchase. Vibelock scores against a net-worth-standardized win rate instead, and fills each phase against a real soul budget rather than ranking items independently, because a build is a correlated set under a constraint — the top-N items scored separately don't compose into one.",
    stack: ['React 19', 'TypeScript', 'TanStack Query', 'Vite', 'Valibot'],
    pinned: true,
  },
  {
    name: 'Slow Your Roll',
    repo: 'pabulum/SlowYourRoll',
    liveUrl: 'https://pabulum.github.io/SlowYourRoll/',
    tagline: 'Expected-value tracker for World of Warcraft bonus rolls.',
    insight:
      'Ranks every boss you can spend a token on by the expected value of one roll. The subtlety is the denominator: a roll draws from the boss\'s entire loot table, not just the items your sim report bothered to score, so unscored items have to be filled in at zero value — they dilute the odds without adding upside, exactly as they do in game. That makes loot spec a lever rather than a filter, since switching specs can *remove* items you never wanted and improve the odds on every remaining one.',
    stack: ['Vanilla JS', 'TypeScript (checkJs)', 'Zero-build static', 'Node test runner'],
    pinned: true,
  },
]

export const PINNED = PROJECTS.filter((p) => p.pinned)
