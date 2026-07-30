import type { APIRoute } from "astro";
import { SITE } from "../../data/site";

/**
 * RFC 9116 security contact.
 *
 * A static site with no backend, no auth and no user input is not much of a target, so
 * this is not really about this site's own risk. It is about the other side: someone who
 * notices a problem — a stale DNS record pointing somewhere they can claim, a broken
 * subdomain, a leaked token in a public commit — currently has to guess at an address.
 * This is a machine-readable answer, and scanners look for it by convention.
 *
 * Generated rather than a static file because `Expires` has to be a real future date and
 * RFC 9116 says a year at most. Hand-written, it would be correct on the day it was
 * committed and quietly expired after that; here it is recomputed on the nightly build.
 */
export const GET: APIRoute = () => {
  // A year and a day out. The nightly rebuild keeps pushing it forward, so the field
  // only goes stale if the site itself stops being rebuilt — which is precisely when a
  // reader should treat the contact as unverified.
  const expires = new Date();
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);
  expires.setUTCDate(expires.getUTCDate() + 1);
  expires.setUTCHours(0, 0, 0, 0);

  const body = [
    `Contact: mailto:${SITE.email}`,
    `Expires: ${expires.toISOString().replace(/\.\d{3}Z$/, "Z")}`,
    "Preferred-Languages: en",
    `Canonical: ${SITE.url}/.well-known/security.txt`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
