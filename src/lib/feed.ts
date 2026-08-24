/**
 * The unified activity feed.
 *
 * Merges two very different-sized streams: a handful of posts and hundreds of
 * commits. Interleaving them raw would bury every post under a wall of commit
 * noise, so commits are grouped into per-repo, per-day bundles first. One day of
 * work on one project reads as one entry — which is also how the work actually
 * happened.
 */

import type { CollectionEntry } from "astro:content";
import type { Commit, RepoActivity } from "./github";

export type FeedItem =
  | {
      kind: "post";
      date: Date;
      title: string;
      description: string;
      href: string;
      crosspost?: string;
    }
  | {
      kind: "commits";
      date: Date;
      repo: string;
      repoName: string;
      commits: Commit[];
    };

/** YYYY-MM-DD in UTC, so grouping doesn't shift with the build machine's timezone. */
function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function groupCommits(activity: Record<string, RepoActivity>): FeedItem[] {
  const groups = new Map<
    string,
    { repo: string; repoName: string; commits: Commit[] }
  >();

  for (const repo of Object.values(activity)) {
    for (const commit of repo.commits) {
      const key = `${commit.repo}:${dayKey(commit.date)}`;
      let group = groups.get(key);
      if (!group) {
        group = { repo: commit.repo, repoName: commit.repoName, commits: [] };
        groups.set(key, group);
      }
      group.commits.push(commit);
    }
  }

  return [...groups.values()].map((g) => {
    // Newest commit in the bundle dates the entry.
    const commits = g.commits.sort(
      (a, b) => +new Date(b.date) - +new Date(a.date),
    );
    return {
      kind: "commits" as const,
      date: new Date(commits[0]!.date),
      repo: g.repo,
      repoName: g.repoName,
      commits,
    };
  });
}

export function buildFeed(
  posts: CollectionEntry<"writing">[],
  activity: Record<string, RepoActivity>,
  limit?: number,
): FeedItem[] {
  const postItems: FeedItem[] = posts
    .filter((p) => !p.data.draft)
    .map((p) => ({
      kind: "post" as const,
      date: p.data.date,
      title: p.data.title,
      description: p.data.description,
      href: `/writing/${p.id}/`,
      crosspost: p.data.crosspost,
    }));

  const merged = [...postItems, ...groupCommits(activity)].sort(
    (a, b) => +b.date - +a.date,
  );

  return limit ? merged.slice(0, limit) : merged;
}

/**
 * Fold several repos' activity into one, for a project that ships as more than one
 * repository.
 *
 * The rejected alternative was letting such a card name a primary repo and report only
 * that repo's numbers. It reads fine and is wrong: the commit count, the date range and
 * the sparkline would all understate work that the card itself claims. Deriving the
 * total is the only version that keeps `src/data` free of numbers.
 *
 * Histograms sum element-wise because every repo in a build is bucketed against the same
 * `now` (see `buildHistogram`), so bucket i covers the same week in all of them. That
 * stops being true if repos are ever fetched across a week boundary in one build, which
 * `getActivity` does not do.
 *
 * Identity fields — repo, description, language — come from the primary rather than
 * being merged: they name one repository and there is no honest way to average them.
 */
export function mergeActivity(
  repos: readonly string[],
  activity: Record<string, RepoActivity>,
): RepoActivity | undefined {
  const parts = repos
    .map((repo) => activity[repo])
    .filter((a): a is RepoActivity => Boolean(a));

  // One repo is the common case and must stay referentially identical, so a single-repo
  // project renders from exactly the object the API produced.
  if (parts.length <= 1) return parts[0];

  const bounds = parts
    .flatMap((p) => [p.firstCommit, p.lastCommit])
    .filter((d): d is string => Boolean(d))
    .sort();

  const sum = (pick: (a: RepoActivity) => number) =>
    parts.reduce((n, p) => n + pick(p), 0);

  return {
    ...parts[0]!,
    commits: parts
      .flatMap((p) => p.commits)
      .sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    commitCount: sum((p) => p.commitCount),
    stars: sum((p) => p.stars),
    recentCommitCount: sum((p) => p.recentCommitCount),
    firstCommit: bounds[0] ?? null,
    lastCommit: bounds.at(-1) ?? null,
    weeklyHistogram: parts[0]!.weeklyHistogram.map((_, i) =>
      sum((p) => p.weeklyHistogram[i] ?? 0),
    ),
  };
}

/**
 * Rank for the pinned-projects list. Recency dominates, because the question a
 * reader is really asking is "is this alive," not "which is biggest." Total commits
 * only breaks ties between projects touched around the same time.
 */
export function rankProjects(
  repos: string[],
  activity: Record<string, RepoActivity>,
): string[] {
  return [...repos].sort((a, b) => {
    const ra = activity[a];
    const rb = activity[b];
    const la = ra?.lastCommit ? +new Date(ra.lastCommit) : 0;
    const lb = rb?.lastCommit ? +new Date(rb.lastCommit) : 0;
    if (la !== lb) return lb - la;
    return (rb?.commitCount ?? 0) - (ra?.commitCount ?? 0);
  });
}
