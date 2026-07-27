/**
 * The nav is derived, not declared. A section lists a `visible` condition and only
 * appears once that condition holds, so an empty section is never linked into a page
 * that says "nothing here yet". Conditions run at build time, alongside the rest of
 * Astro's frontmatter — nothing here reaches the browser.
 */

import { getCollection } from "astro:content";
import { SITE } from "./site";

export type NavItem = {
  label: string;
  href: string;
  /** True when the current pathname belongs to this section. */
  current: (path: string) => boolean;
};

type NavSection = NavItem & {
  /** Omit for sections that are always shown. */
  visible?: () => boolean | Promise<boolean>;
};

/** Matches the section root and everything under it, ignoring the trailing slash. */
const under = (base: string) => (path: string) =>
  path === base || path.startsWith(base.replace(/\/$/, "") + "/");

const SECTIONS: NavSection[] = [
  {
    label: "Home",
    href: "/",
    current: (path) => path === "/",
  },
  {
    label: "Writing",
    href: "/writing/",
    current: under("/writing/"),
    // Drafts don't count — the index filters them out, so a nav link would lead to
    // an empty page.
    visible: async () =>
      (await getCollection("writing", (p) => !p.data.draft)).length > 0,
  },
  {
    label: "GitHub",
    href: SITE.profiles.find((p) => p.label === "GitHub")?.url ?? "",
    current: () => false,
    visible: () => SITE.profiles.some((p) => p.label === "GitHub"),
  },
];

export async function getNav(): Promise<NavItem[]> {
  const resolved = await Promise.all(
    SECTIONS.map(async (section) =>
      (section.visible ? await section.visible() : true) ? section : null,
    ),
  );

  return resolved.filter((section): section is NavSection => section !== null);
}
