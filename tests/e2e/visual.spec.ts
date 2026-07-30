/**
 * Pixel baselines for each route in both colour schemes.
 *
 * Tagged `@visual` and kept out of the default run — see README. Two properties of this
 * site make these different from the rest of the suite:
 *
 *  1. Baselines are platform-specific. Font rasterisation on a developer's machine and
 *     on ubuntu-latest do not match, so playwright.config.ts stores baselines under a
 *     per-platform directory and a machine without a baseline of its own writes one
 *     rather than failing against someone else's.
 *
 *  2. The homepage renders live GitHub data. Commit counts, dates, and the sparkline
 *     change on every rebuild, so a naive full-page snapshot would go red every time
 *     work happened — the exact opposite of a useful signal. Every data-driven region
 *     is therefore masked, which narrows these tests to what they should be testing:
 *     typography, spacing, and the layout of the sheet.
 */

import { test, expect, type Page } from "@playwright/test";
import { ROUTES, assertRoutesDiscovered } from "./routes.ts";

assertRoutesDiscovered();

/**
 * Regions whose content comes from the GitHub API or the clock. Masked to a flat block
 * so a snapshot captures their box, not their text.
 */
const DYNAMIC = [
  ".feed", // merged activity stream
  ".section__aside.data", // "N commits · updated Mon D"
  ".sparkline", // 26-week commit histogram
  ".meta", // per-project commit counts and date ranges
  ".colophon .data", // © year
];

/**
 * Hides the two decorative overlays for the duration of a snapshot.
 *
 * Both are high-entropy noise fields covering the whole sheet. Leaving them in costs on
 * both sides of the ledger: they dominate the PNG's byte size (they do not compress —
 * with them visible the six baselines came to 9.2 MB, which is not something to commit
 * and re-commit on every redesign), and they add per-pixel variance that eats into the
 * diff budget without ever being the thing a reviewer wants to catch. They are marked
 * `aria-hidden` decoration; layout does not depend on them.
 *
 * Hidden via the CSSOM rather than `page.addStyleTag`, which injects a <style> element
 * and is refused by this site's own `style-src` — a neat confirmation that the policy in
 * astro.config.mjs is genuinely strict about stylesheets.
 */
async function hideDecorativeNoise(page: Page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>(
      ".sheet__grain, .sheet__crumple",
    )) {
      el.style.display = "none";
    }
  });
}

async function settle(page: Page) {
  // Webfonts land after first paint; screenshotting before they do captures a fallback
  // face and produces a diff that has nothing to do with the change under test.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
}

for (const theme of ["light", "dark"] as const) {
  for (const route of ROUTES) {
    test(`${route.name} — ${theme}`, { tag: "@visual" }, async ({ page }) => {
      // Set the preference before navigating so the pre-paint script applies it on
      // arrival, exactly as a returning visitor would experience it.
      await page.goto(route.path);
      await page.evaluate((t) => localStorage.setItem("theme", t), theme);
      await page.goto(route.path);
      await hideDecorativeNoise(page);
      await settle(page);

      await expect(page).toHaveScreenshot(
        `${route.name.replace(/[^a-z0-9]+/gi, "-")}-${theme}.png`,
        {
          fullPage: true,
          mask: DYNAMIC.map((selector) => page.locator(selector)),
        },
      );
    });
  }
}
