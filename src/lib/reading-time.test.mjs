/**
 * Reading-time estimation.
 *
 * The interesting property is not the arithmetic, it's the factory shape: Sätteri calls
 * the plugin once per compile, and the word counter lives in that closure. If it ever
 * became module-level state, every post after the first would inherit the previous
 * post's word count and the numbers would creep upward across a build — which looks
 * completely plausible on the page and is why it needs a test rather than an eyeball.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { remarkReadingTime } from "./reading-time.mjs";

const WORDS_PER_MINUTE = 225;

/** A fresh plugin instance plus the frontmatter object it writes into. */
function instance() {
  const frontmatter = {};
  const plugin = remarkReadingTime();
  const ctx = { data: { astro: { frontmatter } } };
  return {
    frontmatter,
    /** Feed it a text node, the way a visit over the mdast tree would. */
    feed(value) {
      plugin.text({ value }, ctx);
    },
  };
}

const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

describe("remarkReadingTime", () => {
  test("exposes both a label and a raw count on the frontmatter", () => {
    const doc = instance();
    doc.feed(words(WORDS_PER_MINUTE));

    assert.equal(doc.frontmatter.wordCount, 225);
    assert.equal(doc.frontmatter.readingTime, "1 min read");
  });

  test("rounds to the nearest minute", () => {
    const doc = instance();
    doc.feed(words(WORDS_PER_MINUTE * 3));
    assert.equal(doc.frontmatter.readingTime, "3 min read");
  });

  test("never reports less than one minute", () => {
    // A one-word post is still "1 min read" — "0 min read" would be nonsense.
    const doc = instance();
    doc.feed("hello");
    assert.equal(doc.frontmatter.wordCount, 1);
    assert.equal(doc.frontmatter.readingTime, "1 min read");
  });

  test("accumulates across every text node in a document", () => {
    // Prose arrives as many small text nodes — one per paragraph, per emphasis run,
    // per link label. Only the running total is meaningful.
    const doc = instance();
    doc.feed(words(100));
    doc.feed(words(100));
    doc.feed(words(100));

    assert.equal(doc.frontmatter.wordCount, 300);
    assert.equal(doc.frontmatter.readingTime, "1 min read");

    doc.feed(words(200));
    assert.equal(doc.frontmatter.wordCount, 500);
    assert.equal(doc.frontmatter.readingTime, "2 min read");
  });

  test("ignores whitespace runs rather than counting them as words", () => {
    const doc = instance();
    doc.feed("   \n\t  ");
    assert.equal(doc.frontmatter.wordCount, 0);

    doc.feed("two    words");
    assert.equal(doc.frontmatter.wordCount, 2);
  });

  test("collapses irregular spacing and newlines between words", () => {
    const doc = instance();
    doc.feed("one\ntwo\t\tthree    four\n\nfive");
    assert.equal(doc.frontmatter.wordCount, 5);
  });

  test("each document gets its own counter", () => {
    // The whole reason this is a factory. Two instances must not see each other.
    const first = instance();
    const second = instance();

    first.feed(words(1000));
    second.feed(words(50));

    assert.equal(first.frontmatter.wordCount, 1000);
    assert.equal(second.frontmatter.wordCount, 50, "not 1050");
    assert.equal(second.frontmatter.readingTime, "1 min read");
  });

  test("declares the name Sätteri identifies it by", () => {
    assert.equal(remarkReadingTime().name, "reading-time");
  });
});
