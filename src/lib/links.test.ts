/**
 * The one rule that decides how every link on the site opens.
 *
 * Worth pinning down because the consequences are asymmetric and both invisible: miss
 * an external link and it silently navigates away from the site; treat an internal or
 * handler link as external and it opens a blank tab. Neither breaks a build.
 *
 * These assertions are written against the real SITE.url rather than a stub, so they
 * also fail loudly if the canonical host ever changes without this being revisited.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { isExternal, linkAttrs, absolutiseHtml } from "./links.ts";

describe("isExternal", () => {
  test("in-site paths and fragments are internal", () => {
    assert.equal(isExternal("/"), false);
    assert.equal(isExternal("/writing/"), false);
    assert.equal(isExternal("/writing/a-post/"), false);
    assert.equal(isExternal("#main"), false);
    assert.equal(isExternal("?page=2"), false);
    assert.equal(isExternal(""), false);
  });

  test("absolute URLs on the canonical host are internal", () => {
    assert.equal(isExternal("https://keefersery.com/"), false);
    assert.equal(isExternal("https://keefersery.com/writing/"), false);
    // Same host, different scheme — still this site, so still not a new tab.
    assert.equal(isExternal("http://keefersery.com/writing/"), false);
  });

  test("other hosts are external", () => {
    assert.equal(isExternal("https://github.com/pabulum"), true);
    assert.equal(isExternal("https://example.com"), true);
  });

  test("a different subdomain is a different host", () => {
    // `www` is not configured as the canonical host, so a link there leaves the site.
    assert.equal(isExternal("https://www.keefersery.com/"), true);
    assert.equal(isExternal("https://blog.keefersery.com/"), true);
  });

  test("a lookalike host is not treated as this site", () => {
    // Suffix matching rather than host equality would let both of these through.
    assert.equal(isExternal("https://keefersery.com.evil.test/"), true);
    assert.equal(isExternal("https://notkeefersery.com/"), true);
  });

  test("protocol-relative URLs are external", () => {
    // `//host/path` inherits the current scheme and leaves the site, but does not
    // start with `http`, so a naive prefix check would call it internal.
    assert.equal(isExternal("//example.com/x"), true);
  });

  test("scheme casing does not matter", () => {
    assert.equal(isExternal("HTTPS://EXAMPLE.COM/x"), true);
    assert.equal(isExternal("HttPs://keefersery.com/x"), false);
  });

  test("handler schemes are never external", () => {
    // Deliberate: these hand off to another application, so a new tab either sits
    // empty or blanks out the moment the handler takes over.
    assert.equal(isExternal("mailto:me@keefersery.com"), false);
    assert.equal(isExternal("mailto:someone@example.com"), false);
    assert.equal(isExternal("tel:+15555550123"), false);
  });

  test("a malformed URL is internal rather than a thrown build error", () => {
    // Reached from prose markdown, where the href is whatever an author typed.
    assert.equal(isExternal("https://"), false);
    assert.equal(isExternal("http://["), false);
  });
});

describe("linkAttrs", () => {
  test("an internal link is just an href", () => {
    assert.deepEqual(linkAttrs("/writing/"), { href: "/writing/" });
  });

  test("an internal link keeps an explicit rel", () => {
    assert.deepEqual(linkAttrs("/writing/", "me"), {
      href: "/writing/",
      rel: "me",
    });
  });

  test("an external link gets a new tab and both safety tokens", () => {
    assert.deepEqual(linkAttrs("https://github.com/pabulum"), {
      href: "https://github.com/pabulum",
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });

  test("an external link preserves rel=me alongside the safety tokens", () => {
    // The identity links depend on this: drop `me` and the two-way verification with
    // the profile breaks, silently.
    assert.deepEqual(linkAttrs("https://github.com/pabulum", "me"), {
      href: "https://github.com/pabulum",
      target: "_blank",
      rel: "me noopener noreferrer",
    });
  });

  test("a mailto link is not given a target", () => {
    const attrs = linkAttrs("mailto:me@keefersery.com");
    assert.deepEqual(attrs, { href: "mailto:me@keefersery.com" });
    assert.equal("target" in attrs, false);
  });

  test("the href is always carried, so a call site never repeats the URL", () => {
    for (const href of [
      "/",
      "#main",
      "mailto:me@keefersery.com",
      "https://example.com/a",
      "//example.com/b",
    ]) {
      assert.equal(linkAttrs(href).href, href);
    }
  });
});

describe("absolutiseHtml", () => {
  test("rewrites root-relative hrefs to the canonical origin", () => {
    assert.equal(
      absolutiseHtml('<a href="/writing/a-post/">read</a>'),
      '<a href="https://keefersery.com/writing/a-post/">read</a>',
    );
  });

  test("rewrites img and source assets too", () => {
    assert.equal(
      absolutiseHtml('<img src="/diagram.png" alt="">'),
      '<img src="https://keefersery.com/diagram.png" alt="">',
    );
    assert.equal(
      absolutiseHtml('<source srcset="/wide.avif" type="image/avif">'),
      '<source srcset="https://keefersery.com/wide.avif" type="image/avif">',
    );
  });

  test("leaves already-absolute URLs alone", () => {
    const html = '<a href="https://github.com/pabulum">repo</a>';
    assert.equal(absolutiseHtml(html), html);
  });

  test("leaves protocol-relative URLs alone", () => {
    // The case the negative lookahead exists for: `//cdn.example.com` starts with a
    // slash but is already absolute, and rewriting it would point at this site instead.
    const html = '<img src="//cdn.example.com/x.png" alt="">';
    assert.equal(absolutiseHtml(html), html);
  });

  test("leaves fragments and handler schemes alone", () => {
    const html =
      '<a href="#main">skip</a><a href="mailto:me@keefersery.com">mail</a>';
    assert.equal(absolutiseHtml(html), html);
  });

  test("rewrites every occurrence, not just the first", () => {
    assert.equal(
      absolutiseHtml('<a href="/a/">a</a> and <a href="/b/">b</a>'),
      '<a href="https://keefersery.com/a/">a</a> and <a href="https://keefersery.com/b/">b</a>',
    );
  });

  test("does not touch attributes on other elements", () => {
    // Only the elements that actually fetch or navigate are rewritten. A `data-path`
    // or a form action is not this function's business.
    const html = '<div data-path="/not-a-link"></div>';
    assert.equal(absolutiseHtml(html), html);
  });

  test("preserves attributes that precede the href", () => {
    assert.equal(
      absolutiseHtml('<a class="x" rel="me" href="/about/">about</a>'),
      '<a class="x" rel="me" href="https://keefersery.com/about/">about</a>',
    );
  });

  test("an empty or link-free fragment is returned unchanged", () => {
    assert.equal(absolutiseHtml(""), "");
    assert.equal(
      absolutiseHtml("<p>no links here</p>"),
      "<p>no links here</p>",
    );
  });
});
