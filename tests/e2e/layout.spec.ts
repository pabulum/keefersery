/**
 * Layout and theming invariants that hold regardless of platform.
 *
 * Separate from the pixel snapshots in visual.spec.ts on purpose: these assertions are
 * about behaviour that is either right or wrong, so they can gate every run. Font
 * rasterisation differs between machines, so screenshots cannot.
 *
 * The site is ~1300 lines of hand-tuned CSS with no component library underneath it, and
 * the failure mode for all of it is visual. Nothing else in the pipeline looks at a
 * rendered page.
 */

import { test, expect } from "@playwright/test";
import { ROUTES, POST_ROUTE, assertRoutesDiscovered } from "./routes.ts";

assertRoutesDiscovered();

const VIEWPORTS = [
  { name: "small phone", width: 360, height: 740 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
];

test.describe("no page scrolls sideways", () => {
  for (const viewport of VIEWPORTS) {
    for (const route of ROUTES) {
      test(`${route.name} at ${viewport.name} (${viewport.width}px)`, async ({
        page,
      }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await page.goto(route.path);
        await page.evaluate(() => document.fonts.ready);

        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          return {
            scrollWidth: doc.scrollWidth,
            clientWidth: doc.clientWidth,
            // Name the specific element that sticks out, so a failure is actionable
            // rather than just "something is too wide".
            culprits: [...document.querySelectorAll("*")]
              .filter(
                (el) => el.getBoundingClientRect().right > doc.clientWidth + 1,
              )
              .slice(0, 5)
              .map((el) => {
                const cls =
                  typeof el.className === "string" && el.className
                    ? `.${el.className.trim().split(/\s+/).join(".")}`
                    : "";
                return `${el.tagName.toLowerCase()}${cls}`;
              }),
          };
        });

        expect(
          overflow.scrollWidth,
          `overflowing elements: ${overflow.culprits.join(", ") || "(none identified)"}`,
        ).toBeLessThanOrEqual(overflow.clientWidth + 1);
      });
    }
  }
});

test.describe("theming", () => {
  test("switching theme actually repaints the page", async ({ page }) => {
    // Guards the CSS side of the toggle. The script can be working perfectly while a
    // renamed custom property leaves the palette unchanged — the button would flip its
    // label and nothing else would happen.
    await page.goto("/");

    const read = () =>
      page.evaluate(() => {
        const style = getComputedStyle(document.body);
        return { bg: style.backgroundColor, fg: style.color };
      });

    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light";
    });
    const light = await read();

    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });
    const dark = await read();

    expect(dark.bg).not.toBe(light.bg);
    expect(dark.fg).not.toBe(light.fg);
  });

  test("both themes keep body text readable against the page", async ({
    page,
  }) => {
    // A contrast floor, not a full audit: enough to catch a palette edit that makes text
    // nearly invisible in one scheme while looking fine in the other.
    await page.goto("/");

    for (const theme of ["light", "dark"] as const) {
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
      }, theme);

      const ratio = await page.evaluate(() => {
        const parse = (c: string) =>
          (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const luminance = ([r, g, b]: number[]) => {
          const f = (v: number) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
        };
        const style = getComputedStyle(document.body);
        const a = luminance(parse(style.color));
        const b = luminance(parse(style.backgroundColor));
        const [hi, lo] = a > b ? [a, b] : [b, a];
        return (hi! + 0.05) / (lo! + 0.05);
      });

      // WCAG AA for body text.
      expect(ratio, `${theme} theme body contrast`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

test.describe("accessibility scaffolding", () => {
  test("the skip link reaches the main landmark", async ({ page }) => {
    await page.goto("/");

    const skip = page.locator("a.skip-link");
    await expect(skip).toHaveAttribute("href", "#main");

    // Visible once focused — a skip link that stays hidden on focus is useless.
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeVisible();
  });

  test("every page has exactly one h1", async ({ page }) => {
    for (const route of ROUTES) {
      await page.goto(route.path);
      await expect(page.locator("h1"), `h1 count on ${route.path}`).toHaveCount(
        1,
      );
    }
  });

  test("the decorative sheet layers stay out of the accessibility tree", async ({
    page,
  }) => {
    await page.goto("/");
    for (const cls of [".sheet__grain", ".sheet__crumple"]) {
      await expect(page.locator(cls)).toHaveAttribute("aria-hidden", "true");
    }
  });
});

test.describe("external links", () => {
  test("template links leave the site safely", async ({ page }) => {
    await page.goto("/");

    const external = page.locator('a[href^="https://github.com"]').first();
    await expect(external).toHaveAttribute("target", "_blank");
    await expect(external).toHaveAttribute("rel", /noopener/);
    await expect(external).toHaveAttribute("rel", /noreferrer/);
  });

  test("the contact link is not given a new tab", async ({ page }) => {
    await page.goto("/");
    const mailto = page.locator('a[href^="mailto:"]').first();
    await expect(mailto).not.toHaveAttribute("target", "_blank");
  });

  test("prose links get the same treatment as template links", async ({
    page,
  }) => {
    // The end-to-end check on external-links.mjs: the unit test proves the plugin
    // decorates a node, this proves the decoration survives the real markdown pipeline.
    test.skip(
      POST_ROUTE === null,
      "no published post containing prose links yet",
    );

    await page.goto(POST_ROUTE!.path);
    const prose = page.locator('main a[target="_blank"]').first();

    if ((await prose.count()) === 0) {
      test.skip(true, "published post contains no external prose links");
    }

    await expect(prose).toHaveAttribute("rel", /noopener/);
    await expect(prose.locator("svg.external-icon")).toHaveCount(1);
    await expect(prose.locator("span.visually-hidden")).toHaveText(
      /opens in new tab/,
    );
  });
});
