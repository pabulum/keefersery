/**
 * Build-time GitHub data.
 *
 * Runs once per build, never in the browser. Two design constraints drove this:
 *
 *  1. A deploy must never fail because GitHub rate-limited us. Unauthenticated
 *     requests get 60/hour, which a few local builds can burn through. So every
 *     fetch falls back to a committed snapshot (activity-cache.json) and the build
 *     continues with slightly stale data rather than dying.
 *  2. The site should get *more* accurate over time without maintenance. Everything
 *     here is derived from commit history, so it updates itself on the daily rebuild.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

// Resolved from cwd, not import.meta.url: this module gets bundled during `astro build`,
// so import.meta.url points at a temp chunk rather than at src/. Astro runs both `dev`
// and `build` from the project root, so cwd is the stable anchor.
const CACHE_PATH = resolve(process.cwd(), "src/data/activity-cache.json");

/** GitHub Actions injects GITHUB_TOKEN, lifting the rate limit to 5000/hour. */
const TOKEN = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";

/** Only count commits authored by this account, so forks and PR merges don't inflate. */
export const GITHUB_LOGIN = "pabulum";

export type Commit = {
  sha: string;
  shortSha: string;
  message: string;
  /** First line only — the rest is body text nobody wants in a feed. */
  title: string;
  date: string;
  url: string;
  repo: string;
  repoName: string;
};

export type RepoActivity = {
  repo: string;
  description: string | null;
  stars: number;
  language: string | null;
  commits: Commit[];
  commitCount: number;
  firstCommit: string | null;
  lastCommit: string | null;
  /** Commits in the trailing 90 days — the "is this alive" number. */
  recentCommitCount: number;
  /** Commits per week for the trailing 26 weeks, oldest first. Drives the sparkline. */
  weeklyHistogram: number[];
};

const WEEKS = 26;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const MS_PER_90_DAYS = 90 * 24 * 60 * 60 * 1000;

async function gh<T>(path: string): Promise<T | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "keefersery.com-build",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

  try {
    const res = await fetch(`https://api.github.com${path}`, { headers });
    if (!res.ok) {
      console.warn(`[github] ${path} → ${res.status} ${res.statusText}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[github] ${path} → ${(err as Error).message}`);
    return null;
  }
}

type ApiRepo = {
  description: string | null;
  stargazers_count: number;
  language: string | null;
};

type ApiCommit = {
  sha: string;
  html_url: string;
  commit: { message: string; author: { date: string } | null };
  author: { login: string } | null;
};

const PER_PAGE = 100;
const MAX_PAGES = 4;

/**
 * Every commit on the default branch, up to `MAX_PAGES * PER_PAGE` of them.
 *
 * Returns `null` for a failed fetch, distinct from `[]` for a repo that genuinely has
 * no commits. Collapsing the two is how a rate-limited request used to read as an
 * empty repo: the caller saw `length === 0` and quietly substituted cached data for a
 * repo that was fine, or dropped a repo that was merely new.
 */
async function fetchAllCommits(
  repo: string,
): Promise<{ commits: ApiCommit[]; truncated: boolean } | null> {
  const all: ApiCommit[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await gh<ApiCommit[]>(
      `/repos/${repo}/commits?per_page=${PER_PAGE}&page=${page}`,
    );
    // A failure on any page, not just the first: a partial history would silently
    // understate commitCount and move firstCommit forward, which is worse than
    // falling back to a complete snapshot from the last good build.
    if (!batch) return null;
    all.push(...batch);
    if (batch.length < PER_PAGE) return { commits: all, truncated: false };
  }

  // Hit the page cap with a full final page, so there is almost certainly more. The
  // derived numbers are now wrong in a way nothing downstream can detect — say so.
  console.warn(
    `[github] ${repo}: stopped at the ${MAX_PAGES * PER_PAGE}-commit page cap; ` +
      `commitCount and firstCommit understate the real history. Raise MAX_PAGES.`,
  );
  return { commits: all, truncated: true };
}

/**
 * Exported for tests. The bucket arithmetic is the one piece of this module with real
 * off-by-one exposure and no visible failure mode — a wrong window silently draws a
 * plausible-looking sparkline — so it is tested directly rather than through a build.
 */
export function buildHistogram(dates: string[], now: number): number[] {
  const buckets = new Array<number>(WEEKS).fill(0);
  for (const d of dates) {
    const age = now - new Date(d).getTime();
    if (age < 0 || age >= WEEKS * MS_PER_WEEK) continue;
    // Bucket 0 is the oldest week in the window, WEEKS-1 is the current week.
    const idx = WEEKS - 1 - Math.floor(age / MS_PER_WEEK);
    buckets[idx]!++;
  }
  return buckets;
}

async function loadCache(): Promise<Record<string, RepoActivity>> {
  try {
    return JSON.parse(await readFile(CACHE_PATH, "utf8")) as Record<
      string,
      RepoActivity
    >;
  } catch {
    return {};
  }
}

async function saveCache(data: Record<string, RepoActivity>): Promise<void> {
  const next = `${JSON.stringify(data, null, 2)}\n`;
  try {
    // Skip a byte-identical write. The file is tracked, so an unconditional write
    // leaves the working tree dirty after every single build — including `astro dev`
    // starting up, and including builds that changed nothing. Two builds in the same
    // week with no new commits produce identical content, so this is the common case.
    // (Across a week boundary the histogram buckets shift and it rewrites, correctly.)
    const current = await readFile(CACHE_PATH, "utf8").catch(() => null);
    if (current === next) return;

    await mkdir(dirname(CACHE_PATH), { recursive: true });
    await writeFile(CACHE_PATH, next);
  } catch (err) {
    console.warn(`[github] could not write cache: ${(err as Error).message}`);
  }
}

let memo: Record<string, RepoActivity> | null = null;

/**
 * Fetch activity for every repo, with cache fallback per-repo. Memoized because
 * Astro evaluates page modules more than once during a build.
 */
export async function getActivity(
  repos: string[],
): Promise<Record<string, RepoActivity>> {
  if (memo) return memo;

  const cache = await loadCache();
  const now = Date.now();
  const out: Record<string, RepoActivity> = {};

  await Promise.all(
    repos.map(async (repo) => {
      const repoName = repo.split("/")[1] ?? repo;
      const [meta, fetched] = await Promise.all([
        gh<ApiRepo>(`/repos/${repo}`),
        fetchAllCommits(repo),
      ]);

      // Any failure on either call: keep whatever the last good build recorded. A repo
      // with a real but empty commit list is not a failure and falls through.
      if (!meta || !fetched) {
        const cached = cache[repo];
        if (cached) {
          console.warn(`[github] using cached data for ${repo}`);
          out[repo] = cached;
        }
        return;
      }

      const mine = fetched.commits.filter(
        (c) =>
          !c.author ||
          c.author.login.toLowerCase() === GITHUB_LOGIN.toLowerCase(),
      );

      const commits: Commit[] = mine
        .filter((c) => c.commit.author?.date)
        .map((c) => ({
          sha: c.sha,
          shortSha: c.sha.slice(0, 7),
          message: c.commit.message,
          title: c.commit.message.split("\n")[0]!.trim(),
          date: c.commit.author!.date,
          url: c.html_url,
          repo,
          repoName,
        }))
        .sort((a, b) => +new Date(b.date) - +new Date(a.date));

      const dates = commits.map((c) => c.date);

      out[repo] = {
        repo,
        description: meta.description,
        stars: meta.stargazers_count,
        language: meta.language,
        commits,
        commitCount: commits.length,
        lastCommit: dates[0] ?? null,
        firstCommit: dates[dates.length - 1] ?? null,
        recentCommitCount: dates.filter(
          (d) => now - +new Date(d) < MS_PER_90_DAYS,
        ).length,
        weeklyHistogram: buildHistogram(dates, now),
      };
    }),
  );

  /*
   * A repo that failed to fetch *and* has no cache entry is absent from `out`
   * entirely. Downstream that is silent: `rankProjects` drops it, `ProjectCard` is
   * never rendered for it, and the page builds and deploys a project short with a
   * green check. The only signal was a `console.warn` in a log nobody reads.
   *
   * Locally that is the right behaviour — offline builds should still work. In CI it
   * is not: a deploy is about to replace the live site, so an incomplete page has to
   * stop the pipeline instead of shipping.
   */
  const missing = repos.filter((repo) => !out[repo]);
  if (missing.length > 0) {
    const detail = `no GitHub data and no cached fallback for: ${missing.join(", ")}`;
    if (process.env.CI) {
      throw new Error(
        `[github] ${detail}. Refusing to build a deploy that would silently drop ` +
          `a pinned project. Check the API status and the GITHUB_TOKEN secret.`,
      );
    }
    console.warn(
      `[github] ${detail} — those projects will be missing locally.`,
    );
  }

  // Only overwrite the cache with repos we actually refreshed.
  await saveCache({ ...cache, ...out });
  memo = out;
  return out;
}
