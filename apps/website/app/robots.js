import { headers } from "next/headers";
import { normalizeHostname } from "@/lib/runtime/host";
import { fetchPublicRuntimeSiteMeta } from "@/lib/runtime/public-site-api";
import { getRequestIdFromHeaders } from "@/lib/runtime/request-id";

export const dynamic = "force-dynamic";

const DEFAULT_BOT_GROUP = { userAgent: "*", disallow: "/" };

/**
 * Render robots.txt for the resolved tenant.
 *
 * Output structure mirrors Next.js's MetadataRoute.Robots — multiple rule
 * groups with explicit user-agent arrays. We emit:
 *   1. A platform-managed wildcard group reflecting the site indexing flag.
 *   2. One group per AI crawler the operator has overridden.
 *   3. Free-form custom rules appended after the managed groups.
 *   4. Sitemap + host directives anchored at the canonical host.
 */
export default async function robots() {
  const headerList = await headers();
  const hostname = normalizeHostname(
    headerList.get("x-staylayer-canonical-host") || headerList.get("host"),
  );
  const requestId = getRequestIdFromHeaders(headerList);

  if (!hostname) {
    return { rules: DEFAULT_BOT_GROUP };
  }

  try {
    const meta = await fetchPublicRuntimeSiteMeta({ hostname, requestId });
    const canonicalHost = meta?.canonicalHost || hostname;
    const indexingEnabled = meta?.indexingEnabled !== false;

    const rules = [];

    rules.push(
      indexingEnabled
        ? { userAgent: "*", allow: "/" }
        : { userAgent: "*", disallow: "/" },
    );

    const policy = meta?.robots?.aiCrawlerPolicy ?? {};
    for (const [userAgent, decision] of Object.entries(policy)) {
      if (decision !== "allow" && decision !== "disallow") continue;
      rules.push({
        userAgent,
        ...(decision === "allow" ? { allow: "/" } : { disallow: "/" }),
      });
    }

    const custom = parseCustomRules(meta?.robots?.customRules ?? "");
    for (const group of custom) rules.push(group);

    return {
      rules,
      ...(indexingEnabled
        ? { sitemap: `https://${canonicalHost}/sitemap.xml` }
        : {}),
      host: canonicalHost,
    };
  } catch (error) {
    console.error(
      `[website] robots upstream error host=${hostname} requestId=${requestId ?? "-"} status=${
        error?.status ?? "?"
      } message=${error?.message ?? "unknown"}`,
    );
    return { rules: DEFAULT_BOT_GROUP };
  }
}

/**
 * Parse the operator's free-form robots.txt block into Next-compatible rule
 * groups. We honor the standard syntax: each User-agent line opens (or joins)
 * a group, subsequent Allow/Disallow lines populate the active group.
 */
function parseCustomRules(raw) {
  if (!raw || typeof raw !== "string") return [];
  const groups = [];
  let current = null;

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const directive = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (!directive) continue;

    if (directive === "user-agent") {
      if (!current || current.allow.length || current.disallow.length) {
        current = { userAgent: [value], allow: [], disallow: [] };
        groups.push(current);
      } else {
        current.userAgent.push(value);
      }
      continue;
    }

    if (!current) {
      current = { userAgent: ["*"], allow: [], disallow: [] };
      groups.push(current);
    }

    if (directive === "allow") {
      if (value) current.allow.push(value);
    } else if (directive === "disallow") {
      current.disallow.push(value);
    } else if (directive === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }

  return groups
    .map((group) => {
      const out = {
        userAgent:
          group.userAgent.length === 1 ? group.userAgent[0] : group.userAgent,
      };
      if (group.allow.length) {
        out.allow = group.allow.length === 1 ? group.allow[0] : group.allow;
      }
      if (group.disallow.length) {
        out.disallow =
          group.disallow.length === 1 ? group.disallow[0] : group.disallow;
      }
      if (group.crawlDelay !== undefined) out.crawlDelay = group.crawlDelay;
      return out;
    })
    .filter((g) => g.allow || g.disallow || g.crawlDelay !== undefined);
}
