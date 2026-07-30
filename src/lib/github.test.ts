/**
 * The sparkline window arithmetic.
 *
 * These tests exist because the failure mode is invisible: shift the window by one
 * bucket and the sparkline still renders 26 plausible bars, just describing the wrong
 * 26 weeks. Nothing downstream can detect that, and no page will fail to build.
 *
 * `now` is passed in as a fixed epoch rather than read from the clock, so every
 * boundary below is exact instead of "roughly a week ago".
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildHistogram } from "./github.ts";

const WEEKS = 26;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** A fixed reference point: 2026-07-01T00:00:00Z. */
const NOW = Date.UTC(2026, 6, 1);

/** An ISO timestamp exactly `ms` before NOW. */
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("buildHistogram", () => {
  test("always returns one bucket per week in the window", () => {
    assert.equal(buildHistogram([], NOW).length, WEEKS);
    assert.equal(buildHistogram([ago(0)], NOW).length, WEEKS);
  });

  test("an empty history is all zeroes, not a sparse array", () => {
    const buckets = buildHistogram([], NOW);
    assert.deepEqual(buckets, new Array(WEEKS).fill(0));
  });

  test("a commit right now lands in the last bucket", () => {
    const buckets = buildHistogram([ago(0)], NOW);
    assert.equal(buckets[WEEKS - 1], 1, "current week is the final bucket");
    assert.equal(
      buckets.slice(0, WEEKS - 1).reduce((a, b) => a + b, 0),
      0,
      "nothing else is touched",
    );
  });

  test("a commit one week old lands one bucket earlier", () => {
    const buckets = buildHistogram([ago(MS_PER_WEEK)], NOW);
    assert.equal(buckets[WEEKS - 2], 1);
    assert.equal(buckets[WEEKS - 1], 0);
  });

  test("the oldest commit still inside the window lands in bucket 0", () => {
    // 1ms short of the full window — the last instant that should still count.
    const buckets = buildHistogram([ago(WEEKS * MS_PER_WEEK - 1)], NOW);
    assert.equal(buckets[0], 1);
  });

  test("a commit exactly one window old is excluded", () => {
    // The boundary is `age >= WEEKS * MS_PER_WEEK`. Were it `>`, this would land in
    // bucket -1 and the write would either throw or silently corrupt the array.
    const buckets = buildHistogram([ago(WEEKS * MS_PER_WEEK)], NOW);
    assert.deepEqual(buckets, new Array(WEEKS).fill(0));
  });

  test("commits older than the window are excluded", () => {
    const buckets = buildHistogram([ago(WEEKS * MS_PER_WEEK * 3)], NOW);
    assert.deepEqual(buckets, new Array(WEEKS).fill(0));
  });

  test("future-dated commits are excluded rather than wrapping", () => {
    // Commit dates come from git metadata, which is author-controlled and routinely
    // skewed. A negative age must not index from the end of the array.
    const buckets = buildHistogram([ago(-MS_PER_WEEK)], NOW);
    assert.deepEqual(buckets, new Array(WEEKS).fill(0));
  });

  test("commits in the same week accumulate", () => {
    const buckets = buildHistogram(
      [ago(0), ago(1000), ago(MS_PER_WEEK - 1)],
      NOW,
    );
    assert.equal(buckets[WEEKS - 1], 3);
  });

  test("buckets run oldest-first", () => {
    // One commit in the oldest in-window week and two in the current one. Read left to
    // right, the array must show the old work first — this is the orientation the
    // Sparkline component draws without re-checking.
    const buckets = buildHistogram(
      [ago(WEEKS * MS_PER_WEEK - 1), ago(0), ago(60_000)],
      NOW,
    );
    assert.equal(buckets[0], 1);
    assert.equal(buckets[WEEKS - 1], 2);
  });

  test("total count never exceeds the commits that were in range", () => {
    const dates = [
      ago(0),
      ago(MS_PER_WEEK * 5),
      ago(MS_PER_WEEK * 25),
      ago(MS_PER_WEEK * 40), // out of window
      ago(-1000), // future
    ];
    const total = buildHistogram(dates, NOW).reduce((a, b) => a + b, 0);
    assert.equal(total, 3);
  });
});
