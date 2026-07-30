/**
 * Proves the Content Security Policy does not break the site.
 *
 * This is the test that justifies enabling CSP at all. The policy is emitted as a
 * `<meta http-equiv>`, and everything about a mis-scoped policy is invisible without a
 * browser: the build succeeds, `astro check` passes, the HTML contains all the right
 * markup, and the page still renders. What breaks is script execution — so the theme
 * toggle disappears and the pre-paint colour scheme stops applying, in production only.
 *
 * Three inline scripts per page are hashed by src/lib/csp-inline-scripts.mjs. If that
 * integration ever stops matching the shipped bytes, every test in this file fails.
 */

import { test, expect, type Page } from "@playwright/test";
import { ROUTES, POST_ROUTE, assertRoutesDiscovered } from "./routes.ts";

assertRoutesDiscovered();

type Violation = {
  directive: string;
  blockedURI: string;
  sample: string;
};

/**
 * Starts recording CSP violations and console errors before any page script runs.
 *
 * Playwright injects this through CDP rather than as a page script, so it is not itself
 * subject to the policy under test.
 */
async function watchForViolations(page: Page) {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.addInitScript(() => {
    (window as unknown as { __csp: Violation[] }).__csp = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      (window as unknown as { __csp: Violation[] }).__csp.push({
        directive: event.effectiveDirective,
        blockedURI: event.blockedURI,
        sample: event.sample,
      });
    });
  });

  return {
    async collect() {
      const violations = await page.evaluate(
        () => (window as unknown as { __csp: Violation[] }).__csp ?? [],
      );
      return { violations, consoleErrors };
    },
  };
}

test.describe("Content Security Policy", () => {
  for (const route of ROUTES) {
    test(`${route.name} loads with no CSP violations`, async ({ page }) => {
      const watcher = await watchForViolations(page);
      await page.goto(route.path, { waitUntil: "load" });

      const { violations, consoleErrors } = await watcher.collect();

      expect(
        violations,
        `CSP blocked something on ${route.path}:\n${JSON.stringify(violations, null, 2)}`,
      ).toEqual([]);
      expect(consoleErrors, `console errors on ${route.path}`).toEqual([]);
    });
  }

  test("every page actually carries a policy", async ({ page }) => {
    // Guards against the policy silently vanishing — with no CSP at all, every other
    // test in this file would pass for the wrong reason.
    for (const route of ROUTES) {
      await page.goto(route.path);
      const content = await page
        .locator('meta[http-equiv="content-security-policy"]')
        .getAttribute("content");

      expect(content, `no CSP on ${route.path}`).toBeTruthy();
      expect(content).toContain("script-src 'self'");
      expect(content).toContain("style-src 'self'");
    }
  });

  test("the policy does not fall back to unsafe-inline for scripts", async ({
    page,
  }) => {
    // The entire point of hashing the inline scripts. If someone "fixes" a CSP failure
    // by adding 'unsafe-inline' to script-src, the policy stops being worth having —
    // and browsers ignore it anyway once a hash is present, so it would also be a lie.
    await page.goto("/");
    const content = await page
      .locator('meta[http-equiv="content-security-policy"]')
      .getAttribute("content");

    const scriptSrc = content?.split(";").find((d) => d.includes("script-src"));
    expect(scriptSrc).toBeTruthy();
    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).not.toContain("unsafe-eval");
    expect(scriptSrc).toMatch(/'sha256-/);
  });

  test("the Shiki exemption stays scoped to style attributes", async ({
    page,
  }) => {
    // 'unsafe-inline' is acceptable for `style-src-attr` because Shiki's per-token
    // colours are style attributes and cannot be hashed. It is not acceptable for
    // `style-src`, which governs stylesheet elements.
    //
    // Asserted on the home page rather than a post: the directive is emitted site-wide,
    // so this holds even while every post is a draft and no code block is rendered.
    await page.goto("/");
    const content = await page
      .locator('meta[http-equiv="content-security-policy"]')
      .getAttribute("content");

    const directives = Object.fromEntries(
      (content ?? "")
        .split(";")
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => [d.split(/\s+/)[0], d]),
    );

    expect(directives["style-src-attr"]).toContain("'unsafe-inline'");
    expect(directives["style-src"]).not.toContain("'unsafe-inline'");
  });

  test("a real highlighted code block produces no violations", async ({
    page,
  }) => {
    /*
     * The end-to-end version of the Shiki case: not "is the directive present" but
     * "does actual Shiki output pass". Only post pages can contain a code block, and
     * the post route exists only once a post is published — while every post is a
     * draft this is genuinely uncovered, so it skips loudly rather than passing
     * vacuously. Publishing a first post restores the coverage automatically.
     */
    test.skip(
      POST_ROUTE === null,
      "no published post to render a code block — coverage resumes with the first post",
    );

    const watcher = await watchForViolations(page);
    await page.goto(POST_ROUTE!.path, { waitUntil: "load" });

    // Confirm the fixture is actually exercising the case before trusting the result.
    const styledTokens = await page.locator("pre.astro-code [style]").count();
    expect(
      styledTokens,
      "post has no Shiki-highlighted tokens, so this proves nothing",
    ).toBeGreaterThan(0);

    const { violations } = await watcher.collect();
    expect(violations).toEqual([]);
  });
});

test.describe("the theme scripts survive the policy", () => {
  test("the toggle appears, which means its inline script ran", async ({
    page,
  }) => {
    // The button ships with the `hidden` attribute and is revealed by the inline script
    // precisely so it can never appear without working code behind it. That makes its
    // visibility a direct assertion that CSP allowed the script to execute.
    await page.goto("/");
    const toggle = page.locator("#theme-toggle");

    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveText(/^(Light|Dark)$/);
  });

  test("clicking the toggle switches and persists the theme", async ({
    page,
  }) => {
    await page.goto("/");
    const toggle = page.locator("#theme-toggle");
    await expect(toggle).toBeVisible();

    const before = await page.evaluate(
      () => document.documentElement.dataset.theme ?? null,
    );

    await toggle.click();

    const after = await page.evaluate(() => ({
      attr: document.documentElement.dataset.theme,
      stored: localStorage.getItem("theme"),
      label: document.getElementById("theme-toggle")?.textContent,
    }));

    expect(after.attr).toMatch(/^(light|dark)$/);
    expect(after.attr).not.toBe(before);
    expect(after.stored).toBe(after.attr);
    // The visible word names the current mode, per the comment in Base.astro.
    expect(after.label?.toLowerCase()).toBe(after.attr);
  });

  test("a stored choice is applied before first paint", async ({ page }) => {
    // The pre-paint script's whole purpose. It has to be inline and blocking in <head>;
    // if CSP blocked it, the attribute would be missing on arrival and the page would
    // flash the system scheme before the toggle script caught up.
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("theme", "dark"));

    await page.goto("/writing/");
    const themeAtLoad = await page.evaluate(
      () => document.documentElement.dataset.theme,
    );
    expect(themeAtLoad).toBe("dark");
  });

  test("no stored choice leaves the system preference in control", async ({
    page,
  }) => {
    // Documented intent: with nothing stored, no attribute is set at all, which is what
    // hands control back to prefers-color-scheme.
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const attr = await page.evaluate(
      () => document.documentElement.dataset.theme ?? null,
    );
    expect(attr).toBeNull();
  });

  test("the JSON-LD identity block is present and parseable", async ({
    page,
  }) => {
    // It is hashed alongside the executable scripts. A data block that CSP mangled, or
    // that the integration hashed from different bytes than were served, shows up here.
    await page.goto("/");
    const raw = await page
      .locator('script[type="application/ld+json"]')
      .textContent();

    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed["@type"]).toBe("Person");
    expect(parsed.sameAs).toBeInstanceOf(Array);
  });
});
