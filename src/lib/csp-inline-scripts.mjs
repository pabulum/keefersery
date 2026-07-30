/**
 * Adds CSP hashes for the page's own inline `<script>` elements.
 *
 * Astro's `security.csp` hashes the scripts *it* bundles, but it does not touch
 * `is:inline` scripts — by design, since inlining is the author opting out of the
 * pipeline. This site has three of them per page (the pre-paint theme script, the
 * JSON-LD block, and the theme toggle), so enabling CSP without this leaves a policy
 * that blocks the site's own theme handling. The build still succeeds and the HTML
 * still looks right; the toggle just silently stops working in the browser. That is
 * the exact failure this integration exists to make impossible.
 *
 * Why post-build rather than a static list of hashes in the config:
 *
 *  - A hand-maintained hash list is a trap. Edit the toggle, forget the hash, and the
 *    feature dies in production while every check stays green.
 *  - The hashes cannot all be derived from source anyway. The JSON-LD body is
 *    `JSON.stringify(personSchema)`, computed at render time from src/data/site.ts, so
 *    its hash changes whenever identity data changes.
 *
 * Hashing the shipped bytes is therefore both the only reliable option and the correct
 * one: what gets allowed is, by construction, exactly what was served.
 */

import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/**
 * `<script>` is a raw-text element: the HTML parser does not decode entities inside
 * it, so the bytes between the tags are exactly what the browser hashes. Matching them
 * with a regex is sound for this reason, and only for this reason.
 */
const SCRIPT = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
const HAS_SRC = /\ssrc\s*=/i;
const CSP_META =
  /(<meta http-equiv="content-security-policy" content=")([^"]*)(")/i;

const sha256 = (body) =>
  `'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`;

/** Adds `hashes` to the `script-src` directive of a policy string, preserving order. */
function withScriptHashes(policy, hashes) {
  const directives = policy.split(";");
  const index = directives.findIndex((d) => d.trim().startsWith("script-src "));

  // No script-src to extend means the policy does not constrain scripts at all, so
  // adding hashes would be meaningless — and silently doing nothing would hide that.
  if (index === -1) return null;

  const missing = hashes.filter((h) => !directives[index].includes(h));
  if (missing.length === 0) return policy;

  directives[index] = `${directives[index].trimEnd()} ${missing.join(" ")}`;
  return directives.join(";");
}

async function htmlFilesIn(root) {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".html"))
    .map((e) => join(e.parentPath ?? e.path, e.name));
}

export function cspInlineScripts() {
  return {
    name: "csp-inline-scripts",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const files = await htmlFilesIn(fileURLToPath(dir));
        let patched = 0;
        let hashed = 0;

        for (const file of files) {
          const html = await readFile(file, "utf8");

          const inline = [...html.matchAll(SCRIPT)]
            .filter(([, attrs]) => !HAS_SRC.test(attrs))
            .map(([, , body]) => body);

          if (inline.length === 0) continue;

          const meta = html.match(CSP_META);
          if (!meta) {
            // CSP is configured, this page has inline scripts, and yet no policy was
            // emitted for it. Shipping that means shipping a page whose scripts are
            // unprotected while the rest of the site looks locked down.
            throw new Error(
              `[csp-inline-scripts] ${file} has ${inline.length} inline script(s) ` +
                `but no CSP meta element to extend. Check security.csp in astro.config.mjs.`,
            );
          }

          const hashes = [...new Set(inline.map(sha256))];
          const next = withScriptHashes(meta[2], hashes);
          if (next === null) {
            throw new Error(
              `[csp-inline-scripts] ${file} has a CSP with no script-src directive, ` +
                `so its ${inline.length} inline script(s) cannot be allowed by hash.`,
            );
          }
          if (next === meta[2]) continue;

          await writeFile(file, html.replace(CSP_META, `$1${next}$3`), "utf8");
          patched++;
          hashed += hashes.length;
        }

        logger.info(
          `Added ${hashed} inline script hash(es) across ${patched} page(s)`,
        );
      },
    },
  };
}
