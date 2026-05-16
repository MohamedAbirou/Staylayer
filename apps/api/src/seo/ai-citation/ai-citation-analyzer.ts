/**
 * Pure AI-citation readiness analyzer. No DB, no IO — given the page's
 * extracted text + metadata, returns a score (0-100), a letter grade, and a
 * list of findings. Used by AiCitationService and exercised by unit tests.
 *
 * The model is intentionally heuristic. It is *not* a prediction of whether
 * a given LLM will cite the page; rather, it surfaces patterns that the
 * Generative-Engine-Optimization community has converged on as helpful:
 *
 *   • Entity facts        — concrete, attribute-bearing statements (name,
 *                           location, prices, hours, phone) that anchor
 *                           a model's grounding.
 *   • Answer-ready blocks — Q&A patterns, definitive "X is Y" sentences,
 *                           and topical lists that copy cleanly into a
 *                           generated response.
 *   • Freshness           — recently-updated pages out-cite stale ones.
 *   • Crawler permissions — `noindex/noarchive/nosnippet` block citation.
 *   • Structured data     — FAQPage / QAPage / HowTo / Article schemas are
 *                           known to be consumed by AI overviews.
 *
 * Output: deterministic for a given input, so tests can pin exact scores.
 */

export type AiFindingSeverity = "error" | "warning" | "info" | "success";

export type AiFindingCode =
  | "ROBOTS_NOINDEX"
  | "ROBOTS_NOARCHIVE"
  | "ROBOTS_NOSNIPPET"
  | "MISSING_TITLE"
  | "MISSING_DESCRIPTION"
  | "DESCRIPTION_TOO_SHORT"
  | "THIN_CONTENT"
  | "NO_ENTITY_FACTS"
  | "FEW_ENTITY_FACTS"
  | "STRONG_ENTITY_FACTS"
  | "NO_ANSWER_READY_SECTIONS"
  | "ANSWER_READY_PRESENT"
  | "STRUCTURED_DATA_PRESENT"
  | "STRUCTURED_DATA_MISSING_QA"
  | "STALE_CONTENT"
  | "FRESH_CONTENT"
  | "NO_HEADINGS"
  | "GOOD_HEADING_STRUCTURE";

export interface AiFinding {
  code: AiFindingCode;
  severity: AiFindingSeverity;
  message: string;
  /** Optional excerpted snippet from the page that triggered the finding. */
  snippet?: string;
  /** Optional locator like "h2" / "paragraph" / "structured-data.FAQPage". */
  locator?: string;
  /** Score delta applied (positive bonus / negative penalty). */
  delta: number;
}

export interface AiCitationInputBlock {
  /** "heading" | "paragraph" | "list" | "qa" | other. Free-form. */
  type: string;
  text: string;
  /** Heading level if `type === "heading"`. */
  level?: number;
}

export interface AiCitationInput {
  title?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  /** Flattened text segments (headings + paragraphs + list items). */
  blocks: AiCitationInputBlock[];
  /** ISO-ish timestamp; null when unknown. */
  updatedAt?: string | Date | null;
  robots?: {
    noindex?: boolean;
    noarchive?: boolean;
    nosnippet?: boolean;
  };
  /** List of schema.org @type strings already published for the page. */
  structuredDataTypes?: string[];
}

export interface AiCitationSignals {
  entityFacts: { count: number; samples: string[] };
  answerReady: { count: number; samples: string[] };
  freshness: {
    daysSinceUpdate: number | null;
    verdict: "fresh" | "ok" | "stale" | "unknown";
  };
  robots: { allowsCitation: boolean; flags: string[] };
  structuredData: { types: string[]; hasQaSchema: boolean };
  headings: { total: number; questionLike: number };
  wordCount: number;
}

export interface AiCitationResult {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  findings: AiFinding[];
  signals: AiCitationSignals;
}

const MIN_WORD_COUNT = 120;
const FRESH_DAYS = 90;
const STALE_DAYS = 365;
const QA_SCHEMA_TYPES = new Set(["FAQPage", "QAPage", "HowTo", "Question"]);

/**
 * Entry point. Computes deterministic score in [0, 100] from the supplied
 * page signals.
 */
export function analyzeAiCitation(input: AiCitationInput): AiCitationResult {
  const findings: AiFinding[] = [];
  const allText = collectText(input);
  const wordCount = countWords(allText);
  const headings = input.blocks.filter((b) => b.type === "heading");
  const paragraphs = input.blocks.filter((b) => b.type === "paragraph");

  // ── Robots / crawler permissions ────────────────────────────────────────
  const robotsFlags: string[] = [];
  let allowsCitation = true;
  if (input.robots?.noindex) {
    allowsCitation = false;
    robotsFlags.push("noindex");
    findings.push({
      code: "ROBOTS_NOINDEX",
      severity: "error",
      message:
        "Page is marked noindex. AI answer engines that obey robots will skip it entirely.",
      locator: "meta.robots",
      delta: -40,
    });
  }
  if (input.robots?.noarchive) {
    robotsFlags.push("noarchive");
    findings.push({
      code: "ROBOTS_NOARCHIVE",
      severity: "warning",
      message:
        "Page is marked noarchive. Some answer engines refuse to quote pages that block archival caching.",
      locator: "meta.robots",
      delta: -10,
    });
  }
  if (input.robots?.nosnippet) {
    robotsFlags.push("nosnippet");
    findings.push({
      code: "ROBOTS_NOSNIPPET",
      severity: "warning",
      message:
        "Page is marked nosnippet. This explicitly disallows answer snippets — citations may still occur but content excerpts will not.",
      locator: "meta.robots",
      delta: -10,
    });
  }

  // ── Title / description ─────────────────────────────────────────────────
  const effectiveTitle = (input.seoTitle ?? input.title ?? "").trim();
  if (effectiveTitle.length === 0) {
    findings.push({
      code: "MISSING_TITLE",
      severity: "error",
      message:
        "Page has no title. LLMs rely on the title to identify the topic.",
      locator: "title",
      delta: -15,
    });
  }
  const description = (input.seoDescription ?? "").trim();
  if (description.length === 0) {
    findings.push({
      code: "MISSING_DESCRIPTION",
      severity: "warning",
      message:
        "No meta description. Answer engines often quote the description verbatim when summarizing a result.",
      locator: "meta.description",
      delta: -8,
    });
  } else if (description.length < 70) {
    findings.push({
      code: "DESCRIPTION_TOO_SHORT",
      severity: "info",
      message: `Description is only ${description.length} chars. 120–160 chars provides better citation context.`,
      locator: "meta.description",
      delta: -3,
    });
  }

  // ── Word count / thin content ───────────────────────────────────────────
  if (wordCount < MIN_WORD_COUNT) {
    findings.push({
      code: "THIN_CONTENT",
      severity: "warning",
      message: `Only ${wordCount} words of body copy. Pages under ${MIN_WORD_COUNT} words rarely get cited.`,
      locator: "body",
      delta: -10,
    });
  }

  // ── Headings ────────────────────────────────────────────────────────────
  const questionHeadings = headings.filter((h) => isQuestionLike(h.text));
  if (headings.length === 0) {
    findings.push({
      code: "NO_HEADINGS",
      severity: "warning",
      message:
        "No headings detected. LLMs use headings to chunk a page; add H2/H3 sections.",
      locator: "headings",
      delta: -8,
    });
  } else if (questionHeadings.length >= 2) {
    findings.push({
      code: "GOOD_HEADING_STRUCTURE",
      severity: "success",
      message: `${questionHeadings.length} question-style headings detected — these align well with answer-engine retrieval.`,
      locator: "headings",
      delta: 5,
    });
  }

  // ── Entity-fact extraction (heuristic) ──────────────────────────────────
  const entitySamples = detectEntityFacts(allText, paragraphs);
  if (entitySamples.length === 0) {
    findings.push({
      code: "NO_ENTITY_FACTS",
      severity: "warning",
      message:
        "No concrete facts (name, location, hours, price, contact) detected. Add at least 3 to anchor citations.",
      locator: "body",
      delta: -10,
    });
  } else if (entitySamples.length < 3) {
    findings.push({
      code: "FEW_ENTITY_FACTS",
      severity: "info",
      message: `Only ${entitySamples.length} entity fact(s) detected — aim for 3+ to be cite-worthy.`,
      locator: "body",
      delta: -4,
    });
  } else {
    findings.push({
      code: "STRONG_ENTITY_FACTS",
      severity: "success",
      message: `${entitySamples.length} entity facts detected (name/location/price/hours/contact).`,
      locator: "body",
      delta: 8,
    });
  }

  // ── Answer-ready section detection ──────────────────────────────────────
  const answerReadySamples = detectAnswerReadyBlocks(input.blocks);
  if (answerReadySamples.length === 0) {
    findings.push({
      code: "NO_ANSWER_READY_SECTIONS",
      severity: "warning",
      message:
        "No Q&A or definitional sections detected. Add an FAQ or 'X is Y' framing to make excerpts copyable.",
      locator: "body",
      delta: -8,
    });
  } else {
    findings.push({
      code: "ANSWER_READY_PRESENT",
      severity: "success",
      message: `${answerReadySamples.length} answer-ready section(s) detected.`,
      locator: "body",
      delta: 8,
    });
  }

  // ── Structured data ─────────────────────────────────────────────────────
  const sdTypes = (input.structuredDataTypes ?? []).filter(Boolean);
  const hasQa = sdTypes.some((t) => QA_SCHEMA_TYPES.has(t));
  if (sdTypes.length === 0) {
    // Already covered indirectly; no penalty beyond defaults.
  } else if (hasQa) {
    findings.push({
      code: "STRUCTURED_DATA_PRESENT",
      severity: "success",
      message: `Schema.org types present that answer engines consume directly: ${sdTypes
        .filter((t) => QA_SCHEMA_TYPES.has(t))
        .join(", ")}.`,
      locator: "structured-data",
      delta: 7,
    });
  } else {
    findings.push({
      code: "STRUCTURED_DATA_MISSING_QA",
      severity: "info",
      message:
        "Structured data is present but missing FAQPage/QAPage/HowTo — adding one boosts AI overview eligibility.",
      locator: "structured-data",
      delta: -2,
    });
  }

  // ── Freshness ───────────────────────────────────────────────────────────
  const freshness = evaluateFreshness(input.updatedAt);
  if (freshness.verdict === "stale") {
    findings.push({
      code: "STALE_CONTENT",
      severity: "warning",
      message: `Page hasn't been updated in ${freshness.daysSinceUpdate} days. Refresh to signal freshness.`,
      locator: "meta.updatedAt",
      delta: -8,
    });
  } else if (freshness.verdict === "fresh") {
    findings.push({
      code: "FRESH_CONTENT",
      severity: "success",
      message: `Updated ${freshness.daysSinceUpdate} days ago — freshness signal is strong.`,
      locator: "meta.updatedAt",
      delta: 4,
    });
  }

  // ── Score aggregation ───────────────────────────────────────────────────
  // Start from a baseline that assumes a competent page; subtract penalties
  // and add bonuses. Clamp to [0, 100].
  const baseline = 70;
  const score = clampScore(
    baseline +
      findings.reduce((sum, f) => sum + f.delta, 0) +
      // Mild bonuses for raw signal strength
      Math.min(8, entitySamples.length) +
      Math.min(6, answerReadySamples.length * 2),
  );

  const result: AiCitationResult = {
    score,
    grade: scoreToGrade(score),
    findings,
    signals: {
      entityFacts: {
        count: entitySamples.length,
        samples: entitySamples.slice(0, 5),
      },
      answerReady: {
        count: answerReadySamples.length,
        samples: answerReadySamples.slice(0, 5),
      },
      freshness,
      robots: { allowsCitation, flags: robotsFlags },
      structuredData: { types: sdTypes, hasQaSchema: hasQa },
      headings: {
        total: headings.length,
        questionLike: questionHeadings.length,
      },
      wordCount,
    },
  };
  return result;
}

// ── Internals ────────────────────────────────────────────────────────────

function clampScore(s: number): number {
  if (!Number.isFinite(s)) return 0;
  return Math.max(0, Math.min(100, Math.round(s)));
}

export function scoreToGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function collectText(input: AiCitationInput): string {
  const parts: string[] = [];
  if (input.title) parts.push(input.title);
  if (input.seoDescription) parts.push(input.seoDescription);
  for (const b of input.blocks) {
    if (b.text) parts.push(b.text);
  }
  return parts.join("\n");
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function isQuestionLike(text: string): boolean {
  const t = text.trim();
  if (t.endsWith("?")) return true;
  return /^(how|what|when|where|why|who|which|can|does|is|are|do)\b/i.test(t);
}

/**
 * Heuristic entity-fact detection. Looks for sentences that carry at least
 * one *concrete* attribute (currency, time-of-day, phone, postal pattern,
 * address tokens, rating, capacity). Returns short snippet samples.
 */
export function detectEntityFacts(
  fullText: string,
  paragraphs: AiCitationInputBlock[],
): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const sentences = splitSentences(fullText);

  const patterns: RegExp[] = [
    /\$\s?\d+(?:[.,]\d+)?/, // prices
    /€\s?\d+(?:[.,]\d+)?/,
    /£\s?\d+(?:[.,]\d+)?/,
    /\b\d{1,2}\s?(?:am|pm)\b/i, // hours
    /\b\d{1,2}:\d{2}\b/, // time
    /\b(?:open|hours?|closed|reservations?)\b/i, // hospitality
    /\b\+?\d[\d\s().-]{7,}\d\b/, // phone
    /\b\d{5}(?:-\d{4})?\b/, // US postal
    /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/, // UK postal
    /\b(?:located|address|street|avenue|road|boulevard|district|neighbou?rhood)\b/i,
    /\b\d+\s?(?:bed|bedroom|bath|guest|km|miles|sq ?m|sq ?ft|m²)s?\b/i,
    /\b\d(?:\.\d)?\s?(?:star|stars)\b/i,
    /\b(?:check[- ]?in|check[- ]?out|breakfast|wifi|parking|pool)\b/i,
  ];

  for (const sentence of sentences) {
    if (!sentence) continue;
    if (sentence.length < 12 || sentence.length > 240) continue;
    if (patterns.some((p) => p.test(sentence))) {
      const norm = sentence.trim();
      const key = norm.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push(norm);
      }
    }
  }

  // Bonus: paragraphs whose first sentence is a definitional "X is Y" — those
  // also count as facts when they include a proper-noun-ish subject.
  for (const p of paragraphs) {
    const m =
      /^([A-Z][\w' -]{2,40})\s+(?:is|are|offers?|provides?|features?)\s+/.exec(
        p.text.trim(),
      );
    if (m) {
      const snippet = p.text.trim().slice(0, 200);
      const key = snippet.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push(snippet);
      }
    }
  }

  return candidates;
}

/**
 * Heuristic answer-ready detection. Looks for:
 *   • Explicit Q&A blocks (block.type === "qa") — strongest signal
 *   • Headings that look like questions followed by a paragraph (FAQ shape)
 *   • Paragraphs whose first sentence is a definitional "X is Y"
 */
export function detectAnswerReadyBlocks(
  blocks: AiCitationInputBlock[],
): string[] {
  const out: string[] = [];

  // Explicit Q&A blocks
  for (const b of blocks) {
    if (b.type === "qa" && b.text.trim().length > 0) {
      out.push(b.text.trim().slice(0, 200));
    }
  }

  // Question heading → answer paragraph adjacency
  for (let i = 0; i < blocks.length - 1; i++) {
    const h = blocks[i]!;
    const next = blocks[i + 1]!;
    if (
      h.type === "heading" &&
      isQuestionLike(h.text) &&
      next.type === "paragraph"
    ) {
      out.push(`${h.text.trim()} — ${next.text.trim().slice(0, 160)}`);
    }
  }

  // Definitional paragraphs: "<Subject> is <predicate>." early in text.
  for (const b of blocks) {
    if (b.type !== "paragraph") continue;
    if (
      /^[A-Z][\w' -]{2,60}\s+is\s+\w+/.test(b.text.trim()) &&
      b.text.trim().length > 40
    ) {
      out.push(b.text.trim().slice(0, 200));
    }
  }

  // Dedup while preserving order.
  const seen = new Set<string>();
  return out.filter((s) => {
    const k = s.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function evaluateFreshness(
  updatedAt: string | Date | null | undefined,
): {
  daysSinceUpdate: number | null;
  verdict: "fresh" | "ok" | "stale" | "unknown";
} {
  if (!updatedAt) return { daysSinceUpdate: null, verdict: "unknown" };
  const d = new Date(updatedAt);
  if (Number.isNaN(d.getTime())) {
    return { daysSinceUpdate: null, verdict: "unknown" };
  }
  const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
  if (days <= FRESH_DAYS) return { daysSinceUpdate: days, verdict: "fresh" };
  if (days >= STALE_DAYS) return { daysSinceUpdate: days, verdict: "stale" };
  return { daysSinceUpdate: days, verdict: "ok" };
}
