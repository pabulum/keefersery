# keefersery.com

Personal site. Static Astro build, no runtime data fetching, and no client-side JS
beyond a small inline theme script.

## What it does

The homepage is a pinned project list plus a merged activity feed. Both are derived
from the GitHub API **at build time**, so the site keeps itself current without a
backend — a daily GitHub Actions cron rebuilds it.

- **Projects** are ranked by most recent push, so the ordering reflects where work is
  actually happening. Each card shows a 26-week commit sparkline, total commits, and
  the date range.
- **The feed** merges writing with commit activity. Commits are bundled per repo per
  day, so one day of work reads as one entry instead of burying posts under commit noise.
- **Identity** is wired for verification: JSON-LD `Person` with `sameAs`, plus
  `rel="me"` on every profile link. Add keefersery.com back to each profile to close
  the loop.

## Commands

```bash
npm run dev      # http://localhost:4321
npm run build    # static output to dist/
npm run preview  # serve the built site

npm run verify       # format + types + unit tests + build. The pre-push check.
npm run verify:all   # the above plus the browser suite — what CI gates on
```

Individually:

```bash
npm run check          # astro check (types + template diagnostics)
npm run format         # prettier --write
npm test               # unit tests (node --test) — pure logic, no browser
npm run test:coverage  # the above, with coverage thresholds
npm run test:e2e       # Playwright: CSP, layout, axe accessibility
npm run test:visual    # Playwright: pixel baselines (local tool — see below)
npm run test:budgets   # Lighthouse performance and accessibility budgets
```

`npm run test:e2e`, `test:visual` and `test:budgets` all run against `dist/`, so build
first. The browser suites need `npx playwright install chromium` once.

## Testing

Three layers, each covering what the others can't:

- **Unit** (`node --test`, no dependencies) — the pure logic where the failure mode is
  invisible: sparkline week bucketing, per-UTC-day commit bundling, project ranking,
  and the internal/external link rule. Run directly against the TypeScript sources via
  Node's type stripping.
- **Browser** (`npm run test:e2e`) — mainly that the Content Security Policy doesn't
  break the site's own inline theme scripts. That failure produces a successful build,
  correct-looking HTML, and a dead theme toggle in production, so nothing short of a
  real browser catches it. Also covers horizontal overflow at three viewports, colour
  contrast in both themes, and the skip link.
- **Accessibility** (part of `test:e2e`) — a full axe pass at WCAG 2.2 AA on every route
  in **both** colour schemes. Distinct from the Lighthouse score of 100, which is computed
  from a weighted subset of these rules and counts an inapplicable rule as a pass. Contrast
  is the rule most likely to regress and the only one whose result depends on the active
  theme, so auditing one scheme would leave half the palette unchecked.
- **Budgets** (`npm run test:budgets`) — per-page transfer ceilings and Lighthouse
  accessibility/SEO at 100. The JS and third-party budgets are currently pinned at zero,
  which is a tripwire for code arriving unintentionally rather than a ban — raise them in
  `lighthouserc.json` when you deliberately add client-side code.

### Visual snapshots

`npm run test:visual` compares full-page screenshots of every route in both themes.
It's a **local** tool, not a CI gate: baselines are stored per platform, but `linux`
covers both this machine and `ubuntu-latest`, and font rasterisation differs between
them. Gating that properly needs a pinned container.

Run it before and after a CSS change. The first run after adding a route writes the
baseline and reports a failure so it can't pass unnoticed; the next run compares.
Regenerate deliberately after an intended redesign:

```bash
npx playwright test --grep @visual --update-snapshots
```

Snapshots mask every region fed by the GitHub API, so they track typography and layout
rather than going red each time a commit lands.

## Editing content

| What                                    | Where                      |
| --------------------------------------- | -------------------------- |
| Name, role, email, profile links        | `src/data/site.ts`         |
| Project cards (tagline, insight, stack) | `src/data/projects.ts`     |
| Homepage intro copy                     | `src/pages/index.astro`    |
| Posts                                   | `src/content/writing/*.md` |

New post: drop a markdown file in `src/content/writing/` with `title`, `description`,
and `date` frontmatter. It appears in the feed, the writing index, and the RSS feed
automatically. Set `draft: true` to keep it out of all three.

`src/data/activity-cache.json` is generated and **committed on purpose** — if the
GitHub API is unreachable or rate-limited, the build falls back to it and succeeds with
slightly stale numbers instead of failing. Don't add it to `.gitignore`.

## CI

Four workflows. `verify.yml` holds the actual checks and is never triggered directly —
both other entry points call it, so the gate on a PR and the gate on a deploy are the
same job and can't drift.

| Workflow     | Runs on                         | Does                                                             |
| ------------ | ------------------------------- | ---------------------------------------------------------------- |
| `verify.yml` | called by the two below         | actionlint, audit, format, types, tests, build, browser, budgets |
| `pr.yml`     | pull requests                   | verify, then a Cloudflare preview deploy commented on the PR     |
| `deploy.yml` | push to `main`, daily 06:00 UTC | verify, publish to Cloudflare Pages, refresh the activity cache  |
| `links.yml`  | Mondays 07:00 UTC               | checks every link in the built site; opens an issue on rot       |

`deploy.yml` publishes the **artifact** that `verify.yml` produced rather than
rebuilding, so what ships is bit-for-bit what passed.

### Secrets

- `CLOUDFLARE_API_TOKEN` — token with the _Cloudflare Pages: Edit_ permission
- `CLOUDFLARE_ACCOUNT_ID` — from the Cloudflare dashboard sidebar

`GITHUB_TOKEN` is injected automatically and raises the API rate limit to 5000/hr.
Note that `src/lib/github.ts` **fails the build** under CI if a pinned repo has neither
fresh API data nor a cached fallback, rather than silently deploying a page with a
project missing.

### DNS

The domain is registered at GoDaddy and currently points at a parking page. To move it:
add the site to Cloudflare, switch the nameservers at GoDaddy to the pair Cloudflare
assigns, then attach `keefersery.com` as a custom domain on the Pages project.
