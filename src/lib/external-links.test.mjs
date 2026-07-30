/**
 * The prose half of the external-link rule.
 *
 * Templates get `linkAttrs` spread at the call site; markdown prose has no call site,
 * so this plugin decorates the rendered tree instead. The load-bearing claim in its
 * header comment is that the predicate is *injected* rather than reimplemented, so the
 * two paths cannot drift — the last test here is what actually holds that.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { externalLinks } from "./external-links.mjs";

/** Records what the plugin did, standing in for Sätteri's visit context. */
function harness({ isExternal }) {
  const plugin = externalLinks({ isExternal });
  return {
    plugin,
    visit(properties) {
      const node = { type: "element", tagName: "a", properties };
      const set = {};
      const appended = [];
      plugin.element.visit(node, {
        setProperty: (target, key, value) => {
          assert.equal(target, node, "properties are set on the visited node");
          set[key] = value;
        },
        appendChild: (target, child) => {
          assert.equal(
            target,
            node,
            "children are appended to the visited node",
          );
          appended.push(child);
        },
      });
      return { set, appended };
    },
  };
}

const alwaysExternal = () => true;
const neverExternal = () => false;

describe("externalLinks", () => {
  test("only visits anchors", () => {
    assert.deepEqual(
      externalLinks({ isExternal: alwaysExternal }).element.filter,
      ["a"],
    );
  });

  test("declares the name Sätteri identifies it by", () => {
    assert.equal(
      externalLinks({ isExternal: alwaysExternal }).name,
      "external-links",
    );
  });

  test("an external link opens in a new tab with both safety tokens", () => {
    const { set } = harness({ isExternal: alwaysExternal }).visit({
      href: "https://example.com/a",
    });

    assert.equal(set.target, "_blank");
    assert.equal(set.rel, "noopener noreferrer");
  });

  test("an external link is annotated for screen readers and sighted readers alike", () => {
    const { appended } = harness({ isExternal: alwaysExternal }).visit({
      href: "https://example.com/a",
    });

    assert.equal(appended.length, 2, "one warning, one icon");

    const [warning, icon] = appended;
    assert.equal(warning.tagName, "span");
    assert.deepEqual(warning.properties.className, ["visually-hidden"]);
    assert.equal(warning.children[0].value, " (opens in new tab)");

    // Raw rather than a hast element, deliberately — see the plugin's comment.
    assert.equal(icon.type, "raw");
    assert.match(icon.value, /^<svg /);
    assert.match(icon.value, /aria-hidden="true"/);
    assert.match(icon.value, /class="external-icon"/);
  });

  test("an internal link is left completely alone", () => {
    const { set, appended } = harness({ isExternal: neverExternal }).visit({
      href: "/writing/",
    });

    assert.deepEqual(set, {}, "no attributes set");
    assert.deepEqual(appended, [], "no icon, no warning");
  });

  test("a link with no usable href is skipped", () => {
    // Anchors used as targets (`<a id="...">`) have no href at all, and a hast href can
    // be a non-string when the markdown is unusual.
    const h = harness({ isExternal: alwaysExternal });

    for (const properties of [{}, { href: undefined }, { href: 42 }, {}]) {
      const { set, appended } = h.visit(properties);
      assert.deepEqual(set, {});
      assert.deepEqual(appended, []);
    }
  });

  test("a node with no properties object at all does not throw", () => {
    const plugin = externalLinks({ isExternal: alwaysExternal });
    assert.doesNotThrow(() =>
      plugin.element.visit(
        { type: "element", tagName: "a" },
        { setProperty: () => {}, appendChild: () => {} },
      ),
    );
  });

  test("the decision is delegated to the injected predicate, not re-derived", () => {
    // This is the anti-drift guarantee. The plugin must ask the predicate about the
    // exact href it found and do nothing else — no scheme sniffing of its own.
    const seen = [];
    const h = harness({
      isExternal: (href) => {
        seen.push(href);
        // Deliberately inverted relative to any real rule: this "internal-looking"
        // path is external and the off-site URL is not. If the plugin second-guessed
        // the predicate, these assertions would flip.
        return href === "/looks-internal";
      },
    });

    const internalLooking = h.visit({ href: "/looks-internal" });
    assert.equal(internalLooking.set.target, "_blank");
    assert.equal(internalLooking.appended.length, 2);

    const externalLooking = h.visit({ href: "https://example.com/off-site" });
    assert.deepEqual(externalLooking.set, {});
    assert.deepEqual(externalLooking.appended, []);

    assert.deepEqual(seen, ["/looks-internal", "https://example.com/off-site"]);
  });
});
