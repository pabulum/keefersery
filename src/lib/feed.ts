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
