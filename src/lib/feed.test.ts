/**
 * Feed merging, commit bundling, and project ranking.
 *
 * `feed.ts` imports only types, so it loads under plain Node with nothing stubbed —
 * these tests drive the real functions against hand-built fixtures.
 *
 * The bundling rules being pinned here are the ones the module's own comments claim:
 * one entry per repo per UTC day, dated by its newest commit, and posts never buried
 * under commit noise.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { CollectionEntry } from "astro:content";

import { buildFeed, rankProjects } from "./feed.ts";
import type { Commit, RepoActivity } from "./github.ts";

// --- fixtures ---------------------------------------------------------------

function commit(repo: string, date: string, sha = date): Commit {
  return {
    sha,
    shortSha: sha.slice(0, 7),
    message: `work on ${repo}`,
    title: `work on ${repo}`,
    date,
    url: `https://github.com/${repo}/commit/${sha}`,
    repo,
    repoName: repo.split("/")[1] ?? repo,
  };
}

function activity(repo: string, commits: Commit[]): RepoActivity {
  const dates = commits.map((c) => c.date).sort();
  return {
    repo,
    description: null,
    stars: 0,
    language: null,
    commits,
    commitCount: commits.length,
    firstCommit: dates[0] ?? null,
    lastCommit: dates.at(-1) ?? null,
    recentCommitCount: commits.length,
    weeklyHistogram: [],
  };
}

/**
 * A minimal stand-in for a content entry. `CollectionEntry` carries a lot of loader
 * machinery that `buildFeed` never reads, so the cast is narrowing the fixture to the
 * fields under test rather than papering over a type error.
 */
function post(opts: {
  id: string;
  date: string;
  draft?: boolean;
  crosspost?: string;
}): CollectionEntry<"writing"> {
  return {
    id: opts.id,
    data: {
      title: opts.id,
      description: `about ${opts.id}`,
      date: new Date(opts.date),
      draft: opts.draft ?? false,
      crosspost: opts.crosspost,
    },
  } as unknown as CollectionEntry<"writing">;
}

// --- buildFeed --------------------------------------------------------------

describe("buildFeed", () => {
  test("bundles a day of work on one repo into a single entry", () => {
    const feed = buildFeed([], {
      "me/app": activity("me/app", [
        commit("me/app", "2026-03-04T09:00:00Z", "aaaaaaa1"),
        commit("me/app", "2026-03-04T14:30:00Z", "aaaaaaa2"),
        commit("me/app", "2026-03-04T22:10:00Z", "aaaaaaa3"),
      ]),
    });

    assert.equal(feed.length, 1, "three commits, one day, one entry");
    const [entry] = feed;
    assert.equal(entry?.kind, "commits");
    assert.equal(entry?.kind === "commits" && entry.commits.length, 3);
  });

  test("dates a bundle by its newest commit", () => {
    const feed = buildFeed([], {
      "me/app": activity("me/app", [
        commit("me/app", "2026-03-04T09:00:00Z", "aaaaaaa1"),
        commit("me/app", "2026-03-04T22:10:00Z", "aaaaaaa2"),
      ]),
    });

    assert.equal(feed[0]?.date.toISOString(), "2026-03-04T22:10:00.000Z");
  });

  test("orders commits inside a bundle newest first", () => {
    const feed = buildFeed([], {
      "me/app": activity("me/app", [
        commit("me/app", "2026-03-04T09:00:00Z", "oldest0"),
        commit("me/app", "2026-03-04T22:10:00Z", "newest0"),
        commit("me/app", "2026-03-04T14:30:00Z", "middle0"),
      ]),
    });

    const entry = feed[0];
    assert.ok(entry?.kind === "commits");
    assert.deepEqual(
      entry.commits.map((c) => c.sha),
      ["newest0", "middle0", "oldest0"],
    );
  });

  test("groups by UTC day, not by a 24-hour span", () => {
    // 80 minutes apart, but either side of midnight UTC. These are two days of work by
    // the only definition the site uses, and must not collapse into one entry. This is
    // the assertion that would fail if `dayKey` ever started using local time.
    const feed = buildFeed([], {
      "me/app": activity("me/app", [
        commit("me/app", "2026-02-28T23:30:00Z", "feb28aa"),
        commit("me/app", "2026-03-01T00:50:00Z", "mar01aa"),
      ]),
    });

    assert.equal(feed.length, 2);
  });

  test("keeps same-day work on different repos in separate entries", () => {
    const feed = buildFeed([], {
      "me/app": activity("me/app", [
        commit("me/app", "2026-03-04T09:00:00Z", "appaaa1"),
      ]),
      "me/site": activity("me/site", [
        commit("me/site", "2026-03-04T10:00:00Z", "siteaa1"),
      ]),
    });

    assert.equal(feed.length, 2);
    assert.deepEqual(
      feed.map((i) => (i.kind === "commits" ? i.repo : null)),
      ["me/site", "me/app"],
      "and still ordered newest first",
    );
  });

  test("merges posts and commits into one newest-first stream", () => {
    const feed = buildFeed(
      [
        post({ id: "older-post", date: "2026-03-02T12:00:00Z" }),
        post({ id: "newest-post", date: "2026-03-06T12:00:00Z" }),
      ],
      {
        "me/app": activity("me/app", [
          commit("me/app", "2026-03-04T09:00:00Z", "appaaa1"),
        ]),
      },
    );

    assert.deepEqual(
      feed.map((i) => (i.kind === "post" ? i.title : i.repo)),
      ["newest-post", "me/app", "older-post"],
    );
  });

  test("excludes drafts", () => {
    const feed = buildFeed(
      [
        post({ id: "published", date: "2026-03-02T12:00:00Z" }),
        post({ id: "hidden", date: "2026-03-09T12:00:00Z", draft: true }),
      ],
      {},
    );

    assert.deepEqual(
      feed.map((i) => (i.kind === "post" ? i.title : null)),
      ["published"],
    );
  });

  test("builds post hrefs with a trailing slash to match trailingSlash: always", () => {
    const feed = buildFeed([post({ id: "a-post", date: "2026-03-02" })], {});
    assert.equal(feed[0]?.kind === "post" && feed[0].href, "/writing/a-post/");
  });

  test("carries crosspost through when set, and omits it otherwise", () => {
    const [withCross] = buildFeed(
      [
        post({
          id: "x",
          date: "2026-03-02",
          crosspost: "https://example.com/x",
        }),
      ],
      {},
    );
    assert.equal(
      withCross?.kind === "post" && withCross.crosspost,
      "https://example.com/x",
    );

    const [without] = buildFeed([post({ id: "y", date: "2026-03-02" })], {});
    assert.equal(without?.kind === "post" && without.crosspost, undefined);
  });

  test("limit truncates after merging, not before", () => {
    // The limit has to apply to the merged stream. Applied per-source, a burst of
    // commits could push every post out of a limited homepage feed.
    const feed = buildFeed(
      [post({ id: "the-post", date: "2026-03-05T12:00:00Z" })],
      {
        "me/app": activity("me/app", [
          commit("me/app", "2026-03-06T09:00:00Z", "day6aaa"),
          commit("me/app", "2026-03-04T09:00:00Z", "day4aaa"),
          commit("me/app", "2026-03-03T09:00:00Z", "day3aaa"),
        ]),
      },
      2,
    );

    assert.equal(feed.length, 2);
    assert.deepEqual(
      feed.map((i) => (i.kind === "post" ? i.title : i.repo)),
      ["me/app", "the-post"],
    );
  });

  test("no limit returns everything", () => {
    const feed = buildFeed([post({ id: "p", date: "2026-03-05" })], {
      "me/app": activity("me/app", [
        commit("me/app", "2026-03-06T09:00:00Z", "day6aaa"),
        commit("me/app", "2026-03-04T09:00:00Z", "day4aaa"),
      ]),
    });
    assert.equal(feed.length, 3);
  });

  test("an empty site produces an empty feed rather than throwing", () => {
    assert.deepEqual(buildFeed([], {}), []);
  });
});

// --- rankProjects -----------------------------------------------------------

describe("rankProjects", () => {
  test("puts the most recently pushed repo first", () => {
    const order = rankProjects(["me/stale", "me/fresh"], {
      "me/stale": activity("me/stale", [
        commit("me/stale", "2026-01-01T00:00:00Z"),
      ]),
      "me/fresh": activity("me/fresh", [
        commit("me/fresh", "2026-06-01T00:00:00Z"),
      ]),
    });

    assert.deepEqual(order, ["me/fresh", "me/stale"]);
  });

  test("recency outranks total commit count", () => {
    // The documented intent: the reader is asking "is this alive", not "which is
    // biggest". A 1-commit repo touched yesterday beats a 500-commit repo from 2019.
    const big = activity(
      "me/big",
      Array.from({ length: 500 }, (_, i) =>
        commit(
          "me/big",
          `2019-01-01T00:00:${String(i % 60).padStart(2, "0")}Z`,
        ),
      ),
    );
    const small = activity("me/small", [
      commit("me/small", "2026-06-01T00:00:00Z"),
    ]);

    assert.deepEqual(
      rankProjects(["me/big", "me/small"], {
        "me/big": big,
        "me/small": small,
      }),
      ["me/small", "me/big"],
    );
  });

  test("commit count breaks a same-timestamp tie", () => {
    const sameDay = "2026-05-05T12:00:00Z";
    const order = rankProjects(["me/thin", "me/thick"], {
      "me/thin": activity("me/thin", [commit("me/thin", sameDay)]),
      "me/thick": activity("me/thick", [
        commit("me/thick", sameDay, "thick01"),
        commit("me/thick", sameDay, "thick02"),
      ]),
    });

    assert.deepEqual(order, ["me/thick", "me/thin"]);
  });

  test("repos with no activity data sort last instead of disappearing", () => {
    // A repo whose fetch failed with no cache entry is absent from the activity map.
    // Ranking must still return it, so the caller decides what to do about it.
    const order = rankProjects(["me/unknown", "me/known"], {
      "me/known": activity("me/known", [
        commit("me/known", "2026-01-01T00:00:00Z"),
      ]),
    });

    assert.deepEqual(order, ["me/known", "me/unknown"]);
  });

  test("does not mutate the caller's array", () => {
    const input = ["me/a", "me/b"];
    rankProjects(input, {
      "me/b": activity("me/b", [commit("me/b", "2026-06-01T00:00:00Z")]),
    });
    assert.deepEqual(input, ["me/a", "me/b"]);
  });
});
