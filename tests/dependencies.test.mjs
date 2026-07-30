/**
 * Dependency-tree invariants, asserted against the lockfile.
 *
 * These are the constraints that are true of the *installed shape* of the project rather
 * than of any code in it, so there is nowhere else they can live. Checking the lockfile
 * rather than `node_modules` makes them deterministic and fast: the lockfile is exactly
 * what `npm ci` will produce, and it does not require an install to have happened.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));

/** Every install path a package resolved to. More than one means the tree split. */
function installPaths(name) {
  return Object.keys(lock.packages).filter(
    (path) =>
      path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`),
  );
}

describe("the markdown pipeline is installed exactly once", () => {
  /*
   * astro.config.mjs imports `satteri` directly, and Astro also depends on it — at an
   * exact version. If our declared range ever resolves to a different version than the
   * one Astro pins, npm hoists one copy and nests the other, and the markdown pipeline
   * runs across two versions of itself: our config builds a processor from one, Astro's
   * internals expect the other.
   *
   * That used to be "managed" by pinning our dependency to the exact same version as
   * Astro's and telling Dependabot to leave it alone. It was the wrong shape of fix — it
   * only held while the two happened to match, and it failed silently in *both*
   * directions (we lag Astro, or Astro lags us). Asserting the property directly means
   * the range can be an ordinary caret that Dependabot maintains, and a split tree fails
   * a build instead of producing a subtly different markdown render.
   */
  test("@astrojs/markdown-satteri resolves to a single copy", () => {
    const paths = installPaths("@astrojs/markdown-satteri");

    assert.equal(
      paths.length,
      1,
      `Expected one installed copy, found ${paths.length}:\n` +
        paths.map((p) => `  ${p} -> ${lock.packages[p].version}`).join("\n") +
        `\n\nOur declared range and Astro's pinned version have diverged. Align them:\n` +
        `  npm ls @astrojs/markdown-satteri\n` +
        `  npm install @astrojs/markdown-satteri@<the version astro depends on>`,
    );
  });

  test("it is declared directly, not relied on via hoisting", () => {
    // astro.config.mjs imports it by name. A package that is only present because it
    // happens to be hoisted out of Astro's own tree breaks under a different install
    // strategy (pnpm, `--install-strategy=nested`) with a bare module-not-found.
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    assert.ok(
      pkg.dependencies["@astrojs/markdown-satteri"],
      "astro.config.mjs imports @astrojs/markdown-satteri, so it must be a declared dependency",
    );
  });
});

describe("the content-schema zod is shared with Astro", () => {
  /*
   * src/content.config.ts builds schemas with our zod; Astro validates entries with the
   * zod *it* resolved. If those are two different copies, a schema built here is not
   * recognised as a schema there — zod's internal brand checks are identity-based, so the
   * failure is a confusing validation error rather than a version warning.
   *
   * Scoped to the Astro side on purpose. An earlier version of this asserted "exactly one
   * zod in the whole tree" and failed immediately — but on `zod@3` nested under
   * `chromium-bidi`, which reaches the tree through Puppeteer via `@lhci/cli`. That copy
   * is a dev tool's business and is correctly isolated; forcing it to dedupe with the
   * content pipeline would be meddling in something that is not broken. What matters is
   * only that nothing on the Astro side has its own.
   */
  const ASTRO_SIDE = ["astro", "@astrojs/rss", "@astrojs/sitemap"];

  test("no Astro-side package nests its own zod", () => {
    const nested = ASTRO_SIDE.flatMap((pkg) =>
      Object.keys(lock.packages)
        .filter((path) => path === `node_modules/${pkg}/node_modules/zod`)
        .map((path) => `  ${path} -> ${lock.packages[path].version}`),
    );

    assert.deepEqual(
      nested,
      [],
      `Astro-side packages resolved their own zod:\n${nested.join("\n")}\n\n` +
        `Align the \`zod\` range in package.json with what these depend on so the tree dedupes.`,
    );
  });

  test("we depend on zod directly, at the root of the tree", () => {
    // The hoisted copy is the one Astro shares. If our declaration disappeared, the root
    // entry could be some transitive package's choice rather than the one our schemas use.
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    assert.ok(
      pkg.dependencies.zod,
      "src/content.config.ts imports zod directly",
    );
    assert.ok(
      lock.packages["node_modules/zod"],
      "zod should be hoisted to the root of the tree",
    );
  });
});
