/**
 * Applies the same new-tab rule to links written in markdown prose.
 *
 * Templates spread `linkAttrs` from ./links.ts at the call site, but prose links come
 * from an author typing `[text](url)` — there is no call site to decorate. So the rule
 * is enforced here, over the rendered HTML tree, and the predicate is injected rather
 * than reimplemented so the two paths cannot drift.
 *
 * @param {{ isExternal: (href: string) => boolean }} options
 */

const ICON =
  '<svg class="external-icon" aria-hidden="true" focusable="false"' +
  ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"' +
  ' stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M6.75 3.5H3.5v9h9V9.25"/>' +
  '<path d="M9.75 3h3.25v3.25M13 3 7.75 8.25"/>' +
  "</svg>";

export function externalLinks({ isExternal }) {
  return {
    name: "external-links",
    element: {
      filter: ["a"],
      visit(node, ctx) {
        const href = node.properties?.href;
        if (typeof href !== "string" || !isExternal(href)) return;

        ctx.setProperty(node, "target", "_blank");
        ctx.setProperty(node, "rel", "noopener noreferrer");

        // The same two warnings Link.astro appends, for the reasons documented there.
        // A prose link and a template link should be indistinguishable in the output.
        ctx.appendChild(node, {
          type: "element",
          tagName: "span",
          properties: { className: ["visually-hidden"] },
          children: [{ type: "text", value: " (opens in new tab)" }],
        });

        // Raw rather than an element node: hast spells SVG attributes in camelCase and
        // relies on the serializer to put them back, which is a needless bet when the
        // markup is fixed. Keep this glyph identical to the one in Link.astro.
        ctx.appendChild(node, {
          type: "raw",
          value: ICON,
        });
      },
    },
  };
}
