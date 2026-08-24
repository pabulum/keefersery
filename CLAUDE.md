# keefersery.com

Personal site. Static Astro build, no runtime data fetching, no shipped JavaScript
bundles. See README.md for what it does and how to edit content; this file is the set of
constraints that are not obvious from reading the code.

## Before pushing

```bash
npm run verify       # format, types, unit tests, build — fast, no browser needed
npm run verify:all   # the above plus the Playwright suite (what CI gates on)
```

## House style

Comments explain **why**, and name the alternative that was rejected and the reason it
lost. This is unusually dense for a personal site and it is deliberate — most of the
non-obvious decisions here are ones that look arbitrary six months later. Match that
density when editing; a change that removes the reasoning is a regression even if the
code is equivalent.

Prose favours the specific over the enthusiastic. No exclamation marks, no "simply", no
marketing register.

## Invariants

**No JavaScript bundles ship today** — and the Lighthouse budget pins that at 0 bytes,
plus 0 third-party requests. This is a **tripwire, not a policy**: it exists to catch a
dependency quietly pulling in client-side code, not to forbid writing any. If you add
client-side code on purpose, raise the ceiling in `lighthouserc.json` in the same commit;
that is the intended workflow, not a fight with the config.

The only client-side code right now is three inline `<script>` elements in `Base.astro`
(pre-paint theme, JSON-LD, theme toggle). Note that inline scripts count toward
`document` size rather than `script`, and each needs a CSP hash — see below.

**All data resolves at build time.** `output: "static"`. The GitHub API is read during
the build only; the deployed site is plain HTML. Nothing fetches at runtime.

**Quantitative facts are derived, never written down.** Commit counts, date ranges,
activity, and project ordering all come from the GitHub API via `src/lib/github.ts`.
`src/data/projects.ts` holds only what a machine cannot derive — what the thing is and
why it was interesting. If you find yourself typing a number into `src/data/`, it
probably belongs in a derivation instead.

**One source of truth per fact.** Identity lives in `src/data/site.ts`. The rule for how
a link opens lives in `src/lib/links.ts`, and `src/lib/external-links.mjs` is _injected_
with that same predicate rather than reimplementing it. The nav is derived from
conditions in `src/data/nav.ts`, not declared per page.

## Things that will bite you

**`src/lib/*` must be loadable by plain Node.** The unit suite runs under `node --test`
with type stripping, which uses Node's ESM resolver — it does not infer extensions. That
is why `src/lib/links.ts` imports `"../data/site.ts"` with the extension while the rest
of the project imports extensionlessly and lets Vite resolve. `tsconfig.json` sets
`allowImportingTsExtensions` for this. Modules in this layer must also avoid importing
`astro:*` virtual modules at the top level, or they stop being unit-testable.

This is the reason `astro:env` is **not** used for `GITHUB_TOKEN`. Importing
`astro:env/server` in `github.ts` would break `node --test` for the whole module, and it
would buy nothing: the token is optional by design (it only lifts a rate limit), there is
nothing to validate beyond "string or absent", and it would drop the `GH_TOKEN` fallback.
`process.env` is the right call here.

**`@astrojs/markdown-satteri` must be declared, and must resolve to one copy.**
`astro.config.mjs` imports it directly, so it has to be a real dependency rather than
something borrowed from Astro's hoisted tree. Astro also depends on it, at an exact
version — and if our range ever resolves to a different one, npm hoists one copy and nests
the other, so our config builds a processor from one version while Astro's internals
expect another.

This used to be handled by pinning our dependency to Astro's exact version and telling
Dependabot to leave it alone. That was the wrong shape of fix: it only held while the two
happened to match, it failed silently in _both_ directions, and the Dependabot ignore made
lagging the likelier failure. `tests/dependencies.test.mjs` asserts the property directly
instead, so the range is an ordinary caret Dependabot maintains and a split tree fails a
build. Same file covers the equivalent zod constraint — scoped to Astro-side packages,
because a `zod@3` nested under Puppeteer via `@lhci/cli` is correctly isolated and not
something to force-dedupe.

**The font config names one exact file, and that is not an accident.** `fonts` in
`astro.config.mjs` uses `fontProviders.local()` pointing at
`@fontsource-variable/inter/files/inter-latin-opsz-normal.woff2`. It looks like something
that wants simplifying to a named provider. Both obvious simplifications are wrong, and
both were measured:

- `fontProviders.fontsource()` with `name: "Inter"` resolves to
  `inter-latin-wght-normal.woff2` — verified byte-identical. That is the **weight-only**
  variable font. It is 24kB smaller precisely because it has no optical-size axis, which
  would make `font-optical-sizing: auto` in `global.css` silently do nothing. The page
  still renders; the type just quietly gets worse.
- `fontProviders.npm()` reading `opsz.css` keeps the axis but emits **all seven** subsets
  and preloads every one — 348kB fetched eagerly, replacing the 73kB that unicode-range
  fetched lazily. Worse than not doing this at all.

Only the latin subset ships now. Text outside that range falls back to the system stack;
add a variant if that stops being acceptable. The visual baselines are what proved the
migration was pixel-identical, so re-run `npm run test:visual` if you touch this.

**Icons are generated, never checked in.** `src/pages/icons/[size].png.ts` rasterises
`public/favicon.svg` at build time with resvg (already a dependency, for OG cards). Do not
add PNG files to `public/` — checked-in rasters are binaries that keep showing the old
mark after someone edits the SVG. `ICON_SIZES` there, the `<link>` tags in `Base.astro`,
and `site.webmanifest.ts` have to agree.

**The `overrides` block exists to keep `npm audit` at zero, and CI gates on that.**
`@lhci/cli` carries a deep transitive tree and is the source of every advisory this repo
has ever had to override. Each entry pins one leaf to a patched version that its parent's
declared range would not have reached on its own:

- `tmp` — symlink/traversal. `@lhci/cli` asks for `^0.1.0`; the fix is in 0.2.x.
- `uuid` — buffer bounds in v3/v5/v6. `@lhci/cli` asks for `^8.3.1`.
- `@puppeteer/browsers` — the one that is not a simple leaf pin, see below.

`extract-zip` has **no patched version at all** — the advisory covers `*`, and 2.0.1 is
still the latest release. The only escape is a parent that stopped depending on it, which
`@puppeteer/browsers@3` did (it extracts with `modern-tar` now). `puppeteer-core@24`
pins `@puppeteer/browsers` at an exact `2.13.2`, so this override deliberately crosses an
exact pin and a major boundary. It holds because `lhci collect` launches Chrome through
`chrome-launcher` and never enters puppeteer's browser-download path — verified by a full
`lhci autorun`, which is the check to re-run if this ever looks suspect.

The rejected alternative was overriding `lighthouse` to 13.x, which is also patched.
It crosses `@lhci/utils`' exact `lighthouse: 12.6.1` pin in the same way but lands
somewhere far worse: a Lighthouse major moves scoring and audit ids, and every threshold
in `lighthouserc.json` is asserted against them. Swapping a leaf that is never called
beats swapping the thing the budgets are written in terms of.

Notes:

- `npm audit fix --force` wants to "fix" this by installing `@lhci/cli@0.1.0` — a
  downgrade from 0.15 to 0.1. Never run it here. Plain `npm audit fix` is fine and is
  usually the right first move: advisories whose parents already allow a patched version
  need a lockfile bump, not an override.
- The overrides are tree-wide, so they also reach prettier, Astro and Playwright. All
  four suites plus a full `lhci autorun` were verified against them before this landed.
  Re-verify if you change them.
- Dependabot will not bump an override. When `@lhci/cli` updates its own dependencies,
  drop the corresponding entry and confirm `npm audit` is still clean — overrides are a
  patch over someone else's lockfile, not a permanent fixture. `brace-expansion` was
  dropped exactly this way once the `minimatch`/`glob` chain reached a patched 1.1.18.

**`src/data/activity-cache.json` is generated but committed.** It is the fallback when
the GitHub API is unreachable, so the build succeeds with slightly stale numbers instead
of failing. Do not gitignore it. It is `.prettierignore`d because the writer owns its
formatting. The nightly `refresh-cache` job commits it back so it does not go stale;
locally, `saveCache` skips byte-identical writes so an ordinary build does not dirty the
working tree.

**A stalled build does not look stalled, and that is why there are two alarms.** Every
relative date on the site — "last push today", "5d ago" in `ProjectCard.astro` — is
resolved against `Date.now()` during the build and frozen into the HTML. A pipeline that
stops running therefore does not degrade into something visibly broken; the page goes on
asserting a freshness it lost, confidently, for as long as nobody looks. In Aug 2026 that
ran for three weeks: `npm audit` picked up a new advisory in the `@lhci/cli` tree, verify
went red, and because `deploy` and `refresh-cache` both `needs: verify`, the site and its
committed fallback froze together on the same day.

Note the shape of that trigger. `npm audit` is the only check in verify that can go from
green to red with no change to this repo — the outside world decides when, and a build-time
devDependency of the Lighthouse tooling has no bearing on the safety of the plain HTML that
actually ships. Weigh that when a nightly is red and the diff is empty.

Two alarms because they fail differently and neither subsumes the other:

- `deploy.yml`'s `alarm` job opens one issue, kept pointed at the latest run, whenever any
  job in Deploy fails. It catches the loud case the same morning. It cannot catch a Deploy
  that reports success — an expired Cloudflare token, a publish against the wrong Pages
  project — nor a schedule that never fires, which GitHub does after 60 days of repository
  inactivity. Worth knowing that the `refresh-cache` bot commits were most of what kept
  this repo "active", so a long enough stall is self-deepening.
- `freshness.yml` fetches `/build.json` off the live domain and opens an issue when the
  deployed build is over 36 hours old. It answers "are the bytes on the domain current",
  which is the claim that actually failed, and it does not care why the answer is no.

The 36h threshold alarms on the second consecutive missed night, not the first: GitHub's
cron drifts by hours (observed Deploy starts range from 06:41 to 09:53), and an alarm that
cries wolf at every delayed run gets filtered into the same silence it was built to break.
`/build.json` is `no-store` in `public/_headers` — a cached copy would report a cached
build date, which defeats the whole mechanism.

**A red Dependabot PR usually is not about the dependency.** Two failure modes account
for nearly all of them, and neither is a reason to distrust the bump:

- `verify` red with an empty-looking diff is the `npm audit` gate above, on a branch that
  predates whatever fixed it on `main`. `@dependabot rebase` clears it.
- `preview` red is structural. Dependabot pull requests read secrets from a separate
  Dependabot store rather than the Actions one, so `secrets: inherit` hands the job a
  blank `CLOUDFLARE_API_TOKEN` and wrangler refuses. `pr.yml` skips the job for
  `dependabot[bot]` rather than putting a Pages-write credential inside a run whose
  purpose is installing the dependency being evaluated — see the comment there, including
  what that costs.

A third kind is real and worth reading closely: `npm ci` failing with `ERESOLVE` means the
bump genuinely does not fit the tree. TypeScript 7 is the standing example — `@astrojs/check`
caps its peer range at `^5 || ^6`, and no combination of published versions satisfies both,
so that PR cannot go green until Astro ships a check that accepts it.

**The CSP is real and it will block things.** `security.csp` in `astro.config.mjs` emits
a per-page `<meta http-equiv>`, and `src/lib/csp-inline-scripts.mjs` adds hashes for the
inline scripts at `astro:build:done` — Astro does not hash `is:inline` scripts itself.
Consequences worth knowing:

- Adding or editing an inline script is safe; the hash is recomputed from the shipped
  bytes every build. Adding a **`<style>` element** is not — strict `style-src` will
  refuse it. Put styles in `global.css` or a scoped `.astro` style block.
- Shiki's per-token inline `style` attributes are allowed via `style-src-attr`, scoped to
  the attribute channel only. Astro prints a generic "Shiki is incompatible with CSP"
  warning at every build; it cannot see the override, so it is expected, not a problem.
- `frame-ancestors` lives in `public/_headers`, not the meta policy, because meta
  elements ignore it. The two policies compose.
- `tests/e2e/csp.spec.ts` is what proves all of this. Do not skip it — a broken CSP
  produces a green build and a silently broken site.

**Coverage thresholds are a ratchet, not a target.** `npm run test:coverage` gates at
lines 70 / branches 90 / functions 75, a little under the current figures. The global line
number is held down by `src/lib/github.ts`, most of which is network I/O that the real
build exercises far better than a mocked `fetch` would. Raise the floor when the pure
surface grows; do not chase it by mocking the API.

**Visual snapshots are a local tool, not a CI gate.** `{platform}` resolves to `linux`
both locally and on `ubuntu-latest`, so it separates macOS/Windows but not distro-level
font rasterisation. Gating cross-machine pixel comparison would need a fixed container.
Run `npm run test:visual` when changing CSS; the first run after adding a route writes
the baseline and reports failure, and the next run compares against it.

Snapshots mask every data-driven region (`.feed`, `.sparkline`, `.meta`, and the commit
totals) because the homepage renders live GitHub data — unmasked, they would go red every
time work happened. They also hide `.sheet__grain` / `.sheet__crumple`, whose noise
dominates the PNG size and eats the diff budget without ever being the thing under review.

## Known wart

`/writing/` is listed in the sitemap while it carries `noindex` (which it does only while
no post is published). Fixing it properly would mean re-implementing draft-frontmatter
parsing inside `astro.config.mjs`, since the sitemap integration cannot reach
`getCollection`. It resolves itself the moment a real post ships.
