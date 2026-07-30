import { defineConfig, devices } from "@playwright/test";

/**
 * Browser-level checks against the *built* site.
 *
 * These run over `astro preview`, not `astro dev`, for two reasons: CSP is not applied
 * in dev (Vite injects its own machinery), and dev-server HTML is not what ships. The
 * suite's most important job is proving that the Content Security Policy in
 * astro.config.mjs does not break the site's own inline theme scripts — a failure mode
 * that no amount of build-time checking can detect, because the build succeeds and the
 * HTML looks correct either way.
 *
 * `testMatch` is `*.spec.ts` and the unit suite is `*.test.ts`, so `node --test` and
 * Playwright never try to run each other's files.
 */

const PORT = 4321;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",

  // A CSP regression is not flaky, and a retry that hides one is worse than a red run.
  retries: 0,
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: process.env.CI ? "retain-on-failure" : "off",
  },

  /*
   * Baselines are stored per platform. Font rasterisation differs between a developer's
   * machine and ubuntu-latest, so a single shared baseline would either fail constantly
   * or have to be regenerated on every push — see README for how the visual suite is
   * meant to be run.
   */
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{platform}/{arg}{-projectName}{ext}",

  /*
   * `missing` writes any baseline that does not exist yet, then still reports that run
   * as failed so it cannot pass unnoticed; the next run compares against it and passes.
   * Existing baselines always gate normally. Adding a route is therefore a two-step
   * operation locally, and never a silent one.
   *
   * `none` in CI: a missing baseline there means the committed set is incomplete, and
   * generating one on the fly would make the check permanently vacuous.
   */
  updateSnapshots: process.env.CI ? "none" : "missing",

  expect: {
    toHaveScreenshot: {
      // Absorbs sub-pixel antialiasing noise without hiding a real layout shift.
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
    },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    // Serves dist/ as built. Deliberately does not run a build first: CI builds once in
    // the verify job and these checks must run against that exact output.
    command: "npm run preview",
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
