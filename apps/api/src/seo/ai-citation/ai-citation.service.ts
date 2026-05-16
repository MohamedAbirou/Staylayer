import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import {
  extractTranslatableText,
  type TextSegment,
} from "../../translation/puck-json-extractor";

import {
  analyzeAiCitation,
  scoreToGrade,
  type AiCitationInput,
  type AiCitationInputBlock,
  type AiCitationResult,
} from "./ai-citation-analyzer";

export type AiCitationReport = AiCitationResult & {
  siteId: string;
  slug: string;
  locale: string;
  analyzedAt: string;
};

export interface AiCitationOverviewRow {
  slug: string;
  locale: string;
  score: number;
  grade: string;
  entityFactCount: number;
  answerReadyCount: number;
  freshnessDays: number | null;
  analyzedAt: string;
  topIssue: string | null;
}

/**
 * Phase E.2 — AI citation readiness.
 *
 * Heuristic readiness scoring for LLM answer engines. The analyzer is pure
 * (see `./ai-citation-analyzer.ts`); this service maps a stored Puck page
 * into the analyzer's input shape, persists the latest result per page,
 * and exposes per-page + per-site report APIs.
 */
@Injectable()
export class AiCitationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recompute and persist the readiness audit for one page.
   * Caller must already have ensured workspace access to `siteId`.
   */
  async analyzePage(
    siteId: string,
    slug: string,
    locale: string,
  ): Promise<AiCitationReport> {
    const page = await this.prisma.page.findFirst({
      where: { siteId, slug, locale, deletedAt: null },
    });
    if (!page) throw new NotFoundException("Page not found");

    const structuredData = await this.prisma.siteStructuredData.findUnique({
      where: { siteId },
    });
    const structuredDataTypes: string[] = [];
    if (structuredData?.businessType) {
      structuredDataTypes.push(structuredData.businessType);
    }
    const override = (page.jsonLdOverride ?? null) as {
      customNodes?: Array<{ "@type"?: string | string[] }>;
    } | null;
    if (override?.customNodes?.length) {
      for (const node of override.customNodes) {
        const t = node["@type"];
        if (typeof t === "string") structuredDataTypes.push(t);
        else if (Array.isArray(t))
          structuredDataTypes.push(...t.filter((x) => typeof x === "string"));
      }
    }

    const input = buildAnalyzerInput({
      title: page.title,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      seoNoindex: page.seoNoindex,
      puckData: page.puckData,
      updatedAt: page.updatedAt,
      structuredDataTypes,
    });
    const result = analyzeAiCitation(input);

    const existing = await this.prisma.aiCitationAudit.findUnique({
      where: { siteId_slug_locale: { siteId, slug, locale } },
    });
    const data = {
      siteId,
      slug,
      locale,
      score: result.score,
      grade: result.grade,
      entityFactCount: result.signals.entityFacts.count,
      answerReadyCount: result.signals.answerReady.count,
      freshnessDays: result.signals.freshness.daysSinceUpdate,
      findings: result.findings as unknown as object,
      signals: result.signals as unknown as object,
    };
    const saved = existing
      ? await this.prisma.aiCitationAudit.update({
          where: { id: existing.id },
          data: { ...data, analyzedAt: new Date() },
        })
      : await this.prisma.aiCitationAudit.create({ data });

    return {
      ...result,
      siteId,
      slug,
      locale,
      analyzedAt: saved.analyzedAt.toISOString(),
    };
  }

  /**
   * Return the most-recently-persisted report. Re-analyzes on the fly if
   * none exists yet so the dashboard always has data to show.
   */
  async getReport(
    siteId: string,
    slug: string,
    locale: string,
  ): Promise<AiCitationReport> {
    const existing = await this.prisma.aiCitationAudit.findUnique({
      where: { siteId_slug_locale: { siteId, slug, locale } },
    });
    if (!existing) return this.analyzePage(siteId, slug, locale);

    return {
      score: existing.score,
      grade: scoreToGrade(existing.score),
      findings: (existing.findings ??
        []) as unknown as AiCitationResult["findings"],
      signals: (existing.signals ??
        {}) as unknown as AiCitationResult["signals"],
      siteId: existing.siteId,
      slug: existing.slug,
      locale: existing.locale,
      analyzedAt: existing.analyzedAt.toISOString(),
    };
  }

  /**
   * Site-wide rollup. Lists every page that has a persisted audit, worst
   * first. Pages with no audit yet are *not* listed — callers can trigger
   * `analyzePage` on demand.
   */
  async getOverview(siteId: string): Promise<{
    siteId: string;
    pageCount: number;
    averageScore: number | null;
    rows: AiCitationOverviewRow[];
  }> {
    const audits = await this.prisma.aiCitationAudit.findMany({
      where: { siteId },
      orderBy: [{ score: "asc" }, { analyzedAt: "desc" }],
      take: 500,
    });

    const rows: AiCitationOverviewRow[] = audits.map((a) => {
      const findings = (a.findings ?? []) as Array<{
        severity?: string;
        message?: string;
      }>;
      const topIssue =
        findings.find((f) => f.severity === "error")?.message ??
        findings.find((f) => f.severity === "warning")?.message ??
        null;
      return {
        slug: a.slug,
        locale: a.locale,
        score: a.score,
        grade: scoreToGrade(a.score),
        entityFactCount: a.entityFactCount,
        answerReadyCount: a.answerReadyCount,
        freshnessDays: a.freshnessDays,
        analyzedAt: a.analyzedAt.toISOString(),
        topIssue,
      };
    });

    const averageScore =
      audits.length === 0
        ? null
        : Math.round(audits.reduce((s, a) => s + a.score, 0) / audits.length);

    return {
      siteId,
      pageCount: audits.length,
      averageScore,
      rows,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Puck → analyzer input translation
// ─────────────────────────────────────────────────────────────────────────

const HEADING_KEYS = new Set([
  "heading",
  "title",
  "headline",
  "h1",
  "h2",
  "h3",
  "h4",
  "subheading",
  "subtitle",
  "eyebrow",
]);
const PARAGRAPH_KEYS = new Set([
  "text",
  "body",
  "description",
  "content",
  "paragraph",
  "copy",
  "summary",
  "subtext",
]);
const LIST_KEYS = new Set(["item", "feature", "bullet", "tag", "label"]);
const QA_QUESTION_KEYS = new Set(["question", "q", "faqquestion"]);
const QA_ANSWER_KEYS = new Set(["answer", "a", "faqanswer"]);

/**
 * Visible-for-testing. Maps a Page row into the shape expected by
 * `analyzeAiCitation`. The Puck blob is walked with the existing
 * translation extractor so we get just the user-visible strings.
 */
export function buildAnalyzerInput(args: {
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoNoindex: boolean;
  puckData: unknown;
  updatedAt: Date;
  structuredDataTypes: string[];
}): AiCitationInput {
  const segments = extractTranslatableText(args.puckData);
  const blocks = segmentsToBlocks(segments);

  // Title surfaces as a synthesized heading so heading-related heuristics
  // engage even when the Puck tree has no explicit hero heading.
  if (args.title) {
    blocks.unshift({ type: "heading", text: args.title, level: 1 });
  }

  return {
    title: args.title,
    seoTitle: args.seoTitle,
    seoDescription: args.seoDescription,
    blocks,
    updatedAt: args.updatedAt,
    robots: { noindex: args.seoNoindex },
    structuredDataTypes: args.structuredDataTypes,
  };
}

/**
 * Bucket TextSegment paths into heading / paragraph / list / qa blocks.
 * Q&A pairing reconstructs `question + answer` adjacency so the analyzer
 * can credit explicit FAQ blocks.
 */
export function segmentsToBlocks(
  segments: readonly TextSegment[],
): AiCitationInputBlock[] {
  const blocks: AiCitationInputBlock[] = [];
  let pendingQuestion: string | null = null;

  for (const seg of segments) {
    const text = seg.text.trim();
    if (!text) continue;
    const lastKey = lastSegmentKey(seg.path);
    const lk = lastKey.toLowerCase();

    if (QA_QUESTION_KEYS.has(lk)) {
      pendingQuestion = text;
      blocks.push({ type: "heading", text, level: 3 });
      continue;
    }
    if (QA_ANSWER_KEYS.has(lk)) {
      const combined = pendingQuestion ? `${pendingQuestion} — ${text}` : text;
      blocks.push({ type: "qa", text: combined });
      pendingQuestion = null;
      continue;
    }
    if (HEADING_KEYS.has(lk)) {
      const level = inferLevel(lk);
      blocks.push({ type: "heading", text, level });
      continue;
    }
    if (PARAGRAPH_KEYS.has(lk)) {
      blocks.push({ type: "paragraph", text });
      continue;
    }
    if (LIST_KEYS.has(lk)) {
      blocks.push({ type: "list", text });
      continue;
    }
    // Fallback: treat any string ≥ 30 chars as a paragraph, anything
    // shorter as a list-style snippet. Keeps recall high while letting
    // entity-fact detection still see the text.
    if (text.length >= 30) {
      blocks.push({ type: "paragraph", text });
    } else {
      blocks.push({ type: "list", text });
    }
  }

  return blocks;
}

function lastSegmentKey(path: string): string {
  const lastDot = path.lastIndexOf(".");
  const tail = lastDot === -1 ? path : path.slice(lastDot + 1);
  // Strip trailing "[n]" array indices.
  return tail.replace(/\[\d+\]$/, "");
}

function inferLevel(key: string): number {
  if (key === "h1" || key === "title") return 1;
  if (key === "h2" || key === "heading" || key === "headline") return 2;
  if (key === "h3" || key === "subheading") return 3;
  if (key === "h4") return 4;
  if (key === "eyebrow" || key === "subtitle") return 3;
  return 2;
}
