/**
 * Pure redirect graph analyzer. No DB, no IO — just data in / data out so
 * the dashboard can preview problems before they're persisted and unit tests
 * can exercise edge cases cheaply.
 *
 * Detects:
 *   • LOOP       — a redirect chain that revisits a previous node.
 *   • CHAIN      — a `from → to` pair whose `to` is itself another `from`.
 *   • CONFLICT   — two enabled rules with the same normalized `(from, locale)`.
 *   • SELF       — a rule pointing to itself (`from === to`).
 *   • DISABLED_DEST — a chain pointing through a disabled rule.
 *
 * Path matching is case-insensitive with normalized leading slash + no
 * trailing slash, to mirror SeoService.normalizePath.
 */

export type RedirectIssueSeverity = "error" | "warning" | "info";
export type RedirectIssueCode =
  | "LOOP"
  | "CHAIN"
  | "CONFLICT"
  | "SELF"
  | "DISABLED_DEST";

export interface AnalyzerRedirect {
  id: string;
  fromPath: string;
  toPath: string;
  locale: string | null;
  enabled: boolean;
  statusCode: number;
  source?: string;
}

export interface RedirectIssue {
  code: RedirectIssueCode;
  severity: RedirectIssueSeverity;
  redirectIds: string[];
  fromPath: string;
  toPath: string;
  locale: string | null;
  message: string;
  /** Full chain of paths (only set for LOOP/CHAIN). */
  chain?: string[];
}

export interface RedirectAnalysisResult {
  totalRules: number;
  enabledRules: number;
  issues: RedirectIssue[];
  /** Map of locale → fromPath → list of rules (for downstream tooling). */
  groupsByLocale: Record<string, Record<string, AnalyzerRedirect[]>>;
}

const MAX_CHAIN_DEPTH = 25;
const LOCALE_WILDCARD = "*";

export function normalizeRedirectPath(input: string): string {
  let p = (input ?? "").trim();
  if (p.length === 0) return "/";
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p.toLowerCase();
}

function localeKey(locale: string | null | undefined): string {
  return locale ?? LOCALE_WILDCARD;
}

/**
 * Build a lookup map keyed by `${locale}::${fromPath}` to all rules at that
 * (locale, fromPath). Wildcard-locale rules are stored under "*".
 */
function buildIndex(
  redirects: AnalyzerRedirect[],
): Map<string, AnalyzerRedirect[]> {
  const idx = new Map<string, AnalyzerRedirect[]>();
  for (const r of redirects) {
    const key = `${localeKey(r.locale)}::${normalizeRedirectPath(r.fromPath)}`;
    const bucket = idx.get(key);
    if (bucket) bucket.push(r);
    else idx.set(key, [r]);
  }
  return idx;
}

/**
 * For a given (locale, from) look up the matching rule. Locale-specific rule
 * wins over the wildcard rule (mirrors SeoService.resolveRedirect ordering).
 */
function lookup(
  index: Map<string, AnalyzerRedirect[]>,
  locale: string | null,
  from: string,
): AnalyzerRedirect | null {
  const normFrom = normalizeRedirectPath(from);
  if (locale) {
    const localized = index.get(`${locale}::${normFrom}`);
    if (localized && localized.length > 0) {
      return pickActive(localized);
    }
  }
  const wildcard = index.get(`${LOCALE_WILDCARD}::${normFrom}`);
  if (wildcard && wildcard.length > 0) return pickActive(wildcard);
  return null;
}

function pickActive(rules: AnalyzerRedirect[]): AnalyzerRedirect {
  return rules.find((r) => r.enabled) ?? rules[0]!;
}

/**
 * Walk a chain starting from `seed`. Stops at MAX_CHAIN_DEPTH, on a loop, or
 * when no next rule matches.
 */
export function walkChain(
  index: Map<string, AnalyzerRedirect[]>,
  seed: AnalyzerRedirect,
): { chain: string[]; cycle: boolean; hops: AnalyzerRedirect[] } {
  const chain: string[] = [
    normalizeRedirectPath(seed.fromPath),
    normalizeRedirectPath(seed.toPath),
  ];
  const hops: AnalyzerRedirect[] = [seed];
  const seen = new Set<string>([chain[0]!]);
  let cycle = false;
  let current = seed;

  for (let i = 0; i < MAX_CHAIN_DEPTH; i++) {
    const nextFrom = normalizeRedirectPath(current.toPath);
    if (seen.has(nextFrom)) {
      cycle = true;
      break;
    }
    seen.add(nextFrom);
    const next = lookup(index, current.locale, nextFrom);
    if (!next) break;
    hops.push(next);
    chain.push(normalizeRedirectPath(next.toPath));
    current = next;
  }

  return { chain, cycle, hops };
}

export function analyzeRedirects(
  redirects: AnalyzerRedirect[],
): RedirectAnalysisResult {
  const issues: RedirectIssue[] = [];
  const enabled = redirects.filter((r) => r.enabled);
  const index = buildIndex(redirects);

  // 1. Self-redirects (from === to)
  for (const r of redirects) {
    if (normalizeRedirectPath(r.fromPath) === normalizeRedirectPath(r.toPath)) {
      issues.push({
        code: "SELF",
        severity: "error",
        redirectIds: [r.id],
        fromPath: r.fromPath,
        toPath: r.toPath,
        locale: r.locale,
        message: `Redirect points to itself (${r.fromPath}).`,
      });
    }
  }

  // 2. Conflicts — multiple enabled rules sharing the same (from, locale).
  const conflictMap = new Map<string, AnalyzerRedirect[]>();
  for (const r of enabled) {
    const key = `${localeKey(r.locale)}::${normalizeRedirectPath(r.fromPath)}`;
    const bucket = conflictMap.get(key);
    if (bucket) bucket.push(r);
    else conflictMap.set(key, [r]);
  }
  for (const [, group] of conflictMap) {
    if (group.length > 1) {
      const first = group[0]!;
      issues.push({
        code: "CONFLICT",
        severity: "error",
        redirectIds: group.map((g) => g.id),
        fromPath: first.fromPath,
        toPath: first.toPath,
        locale: first.locale,
        message: `${group.length} enabled redirects share the same source (${first.fromPath}).`,
      });
    }
  }

  // 3 + 4. Chains and loops. Walk each enabled rule once.
  for (const seed of enabled) {
    if (
      normalizeRedirectPath(seed.fromPath) ===
      normalizeRedirectPath(seed.toPath)
    ) {
      continue; // already reported as SELF
    }
    const walk = walkChain(index, seed);
    if (walk.cycle) {
      issues.push({
        code: "LOOP",
        severity: "error",
        redirectIds: walk.hops.map((h) => h.id),
        fromPath: seed.fromPath,
        toPath: seed.toPath,
        locale: seed.locale,
        message: `Redirect loop detected (${walk.chain.join(" → ")}).`,
        chain: walk.chain,
      });
    } else if (walk.hops.length > 1) {
      issues.push({
        code: "CHAIN",
        severity: "warning",
        redirectIds: walk.hops.map((h) => h.id),
        fromPath: seed.fromPath,
        toPath: walk.chain[walk.chain.length - 1]!,
        locale: seed.locale,
        message: `Redirect chain of ${walk.hops.length} hops (${walk.chain.join(
          " → ",
        )}). Update internal links to point at the final destination.`,
        chain: walk.chain,
      });
    }

    // 5. Destination points to a *disabled* rule (silent breakage).
    const target = lookup(index, seed.locale, seed.toPath);
    if (target && !target.enabled) {
      issues.push({
        code: "DISABLED_DEST",
        severity: "warning",
        redirectIds: [seed.id, target.id],
        fromPath: seed.fromPath,
        toPath: seed.toPath,
        locale: seed.locale,
        message: `Destination ${seed.toPath} matches a disabled redirect.`,
      });
    }
  }

  // groupsByLocale (for UI grouping)
  const groupsByLocale: Record<string, Record<string, AnalyzerRedirect[]>> = {};
  for (const r of redirects) {
    const lk = localeKey(r.locale);
    const fromKey = normalizeRedirectPath(r.fromPath);
    if (!groupsByLocale[lk]) groupsByLocale[lk] = {};
    if (!groupsByLocale[lk]![fromKey]) groupsByLocale[lk]![fromKey] = [];
    groupsByLocale[lk]![fromKey]!.push(r);
  }

  return {
    totalRules: redirects.length,
    enabledRules: enabled.length,
    issues,
    groupsByLocale,
  };
}
