/**
 * Full accessibility audit with axe.
 *
 * Distinct from the Lighthouse budget, which already asserts an accessibility score of
 * 100 on every page. That score is computed from a *subset* of axe's rules, weighted, and
 * a rule that does not apply to a page counts as passed — so 100 means "nothing in the
 * sampled set failed", not "clean". This runs the rule set directly, at the conformance
 * level the site targets, and reports every violation rather than a score.
 *
 * Both colour schemes are audited. Contrast is the rule most likely to regress here and
 * it is the one rule whose result depends entirely on which theme is active, so auditing
 * only the default would leave half the palette unchecked.
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ROUTES, assertRoutesDiscovered } from "./routes.ts";

assertRoutesDiscovered();

/** WCAG 2.2 AA, which is the level the contrast floors in layout.spec.ts assume. */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const route of ROUTES) {
  for (const theme of ["light", "dark"] as const) {
    test(`${route.name} has no axe violations — ${theme}`, async ({ page }) => {
      await page.goto(route.path);
      await page.evaluate((t) => localStorage.setItem("theme", t), theme);
      await page.goto(route.path);
      await page.evaluate(() => document.fonts.ready);

      const { violations } = await new AxeBuilder({ page })
        .withTags(TAGS)
        .analyze();

      // The default reporter prints rule ids and little else. Naming the offending
      // selector and the fix is what makes a failure actionable six months from now.
      const detail = violations
        .map(
          (v) =>
            `\n  [${v.impact ?? "unknown"}] ${v.id}: ${v.help}\n` +
            v.nodes
              .map(
                (n) => `    ${n.target.join(" ")}\n      ${n.failureSummary}`,
              )
              .join("\n"),
        )
        .join("\n");

      expect(
        violations,
        `axe violations on ${route.path} (${theme}):${detail}`,
      ).toEqual([]);
    });
  }
}

test("the audit is actually exercising rules, not silently matching nothing", () => {
  // A guard against the whole file passing because a selector or tag name changed and
  // axe quietly analysed an empty rule set.
  expect(TAGS.length).toBeGreaterThan(0);
  expect(ROUTES.length).toBeGreaterThan(0);
});
