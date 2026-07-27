# keefersery.com

Personal site. Static Astro build, no runtime data fetching, no client JS.

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
npm run check    # astro check (types + template diagnostics)
```

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

## Deploying

`.github/workflows/deploy.yml` builds and publishes to Cloudflare Pages on push to
`main` and daily at 06:00 UTC. It needs two repo secrets:

- `CLOUDFLARE_API_TOKEN` — token with the _Cloudflare Pages: Edit_ permission
- `CLOUDFLARE_ACCOUNT_ID` — from the Cloudflare dashboard sidebar

`GITHUB_TOKEN` is injected automatically and raises the API rate limit to 5000/hr.

### DNS

The domain is registered at GoDaddy and currently points at a parking page. To move it:
add the site to Cloudflare, switch the nameservers at GoDaddy to the pair Cloudflare
assigns, then attach `keefersery.com` as a custom domain on the Pages project.
