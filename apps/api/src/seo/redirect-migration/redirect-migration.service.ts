import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Prisma, SearchEngineSubmissionTarget } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { IndexNowService } from "../indexnow/indexnow.service";
import { RobotsService } from "../robots/robots.service";
import {
  analyzeRedirects,
  type AnalyzerRedirect,
  type RedirectAnalysisResult,
  normalizeRedirectPath,
} from "./redirect-analyzer";
import {
  parseRedirectsCsv,
  serializeRedirectsCsv,
  type CsvParseError,
  type ParsedRedirectRow,
} from "./redirect-csv";

export type ImportMode = "skip" | "overwrite" | "strict";

export interface CsvImportSummary {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  totalRows: number;
  errors: CsvParseError[];
  rejected: Array<{ line: number; reason: string }>;
}

export interface SlugChangeInput {
  siteId: string;
  oldSlug: string;
  newSlug: string;
  locale: string;
  reason?: string;
}

const MAX_CSV_BYTES = 1_000_000; // 1 MB
const MAX_ROWS_PER_IMPORT = 5_000;
const SLUG_CHANGE_SOURCE = "SLUG_CHANGE";
const PAGE_DELETE_SOURCE = "PAGE_DELETE";

/**
 * Owns advanced redirect operations: graph analysis, CSV import/export,
 * and auto-redirect bookkeeping for page slug renames / deletions. The
 * straightforward CRUD lives in SeoService; this service handles the
 * "migration suite" surface so SeoService stays small.
 */
@Injectable()
export class RedirectMigrationService {
  private readonly logger = new Logger(RedirectMigrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly indexNowService: IndexNowService,
    private readonly robotsService: RobotsService,
  ) {}

  // ── Analysis ──────────────────────────────────────────────────────────────

  async analyze(siteId: string): Promise<RedirectAnalysisResult> {
    const rows = await this.prisma.redirect.findMany({
      where: { siteId },
      select: {
        id: true,
        fromPath: true,
        toPath: true,
        locale: true,
        enabled: true,
        statusCode: true,
        source: true,
      },
      orderBy: { createdAt: "asc" },
    });
    return analyzeRedirects(rows as AnalyzerRedirect[]);
  }

  // ── Export ────────────────────────────────────────────────────────────────

  async exportCsv(siteId: string): Promise<string> {
    const rows = await this.prisma.redirect.findMany({
      where: { siteId },
      orderBy: [{ fromPath: "asc" }, { locale: "asc" }],
      select: {
        fromPath: true,
        toPath: true,
        statusCode: true,
        locale: true,
        reason: true,
        enabled: true,
        source: true,
      },
    });
    return serializeRedirectsCsv(rows);
  }

  // ── Import ────────────────────────────────────────────────────────────────

  async importCsv(
    siteId: string,
    csv: string,
    mode: ImportMode = "skip",
  ): Promise<CsvImportSummary> {
    if (!csv || csv.length === 0) {
      throw new BadRequestException("CSV payload is empty.");
    }
    if (csv.length > MAX_CSV_BYTES) {
      throw new BadRequestException(
        `CSV payload exceeds the ${MAX_CSV_BYTES.toLocaleString()} byte limit.`,
      );
    }

    const parsed = parseRedirectsCsv(csv);
    if (parsed.rows.length > MAX_ROWS_PER_IMPORT) {
      throw new BadRequestException(
        `CSV contains ${parsed.rows.length} rows; max per import is ${MAX_ROWS_PER_IMPORT}.`,
      );
    }
    if (mode === "strict" && parsed.errors.length > 0) {
      return {
        created: 0,
        updated: 0,
        skipped: 0,
        failed: parsed.rows.length + parsed.errors.length,
        totalRows: parsed.rows.length + parsed.errors.length,
        errors: parsed.errors,
        rejected: [],
      };
    }

    // Pre-fetch existing rules at the affected (locale, from) coordinates
    // so we can decide create vs update without N round trips.
    const lookupKey = (locale: string | null, from: string): string =>
      `${locale ?? "*"}::${from}`;

    const existing = await this.prisma.redirect.findMany({
      where: { siteId },
      select: {
        id: true,
        fromPath: true,
        locale: true,
      },
    });
    const existingMap = new Map<string, { id: string }>();
    for (const r of existing) {
      existingMap.set(lookupKey(r.locale, normalizeRedirectPath(r.fromPath)), {
        id: r.id,
      });
    }

    const summary: CsvImportSummary = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      totalRows: parsed.rows.length,
      errors: parsed.errors,
      rejected: [],
    };

    // Dedupe inside the file itself (last-wins per (locale, from)).
    const dedupedRows = new Map<string, ParsedRedirectRow>();
    for (const row of parsed.rows) {
      dedupedRows.set(lookupKey(row.locale, row.fromPath), row);
    }

    const touchedPaths = new Set<string>();

    for (const row of dedupedRows.values()) {
      const key = lookupKey(row.locale, row.fromPath);
      const existing = existingMap.get(key);
      try {
        if (existing) {
          if (mode === "skip") {
            summary.skipped++;
            continue;
          }
          await this.prisma.redirect.update({
            where: { id: existing.id },
            data: {
              toPath: row.toPath,
              statusCode: row.statusCode,
              permanent: row.statusCode === 301 || row.statusCode === 308,
              locale: row.locale,
              reason: row.reason,
              enabled: row.enabled,
              source: row.source,
            },
          });
          summary.updated++;
        } else {
          await this.prisma.redirect.create({
            data: {
              siteId,
              fromPath: row.fromPath,
              toPath: row.toPath,
              statusCode: row.statusCode,
              permanent: row.statusCode === 301 || row.statusCode === 308,
              locale: row.locale,
              reason: row.reason,
              enabled: row.enabled,
              source: row.source,
            },
          });
          summary.created++;
        }
        touchedPaths.add(row.fromPath);
        touchedPaths.add(row.toPath);
      } catch (err) {
        summary.failed++;
        summary.rejected.push({
          line: row.line,
          reason:
            err instanceof Prisma.PrismaClientKnownRequestError
              ? err.code
              : err instanceof Error
                ? err.message
                : "unknown error",
        });
      }
    }

    if (touchedPaths.size > 0) {
      await this.submitIndexNowSafe(
        siteId,
        Array.from(touchedPaths),
        SearchEngineSubmissionTarget.INDEXNOW_AUTO_REDIRECT_CREATE,
      );
    }

    return summary;
  }

  // ── Slug-change / page-delete hooks ──────────────────────────────────────

  /**
   * Idempotently record an auto-redirect for a slug rename. Re-targets any
   * pre-existing SLUG_CHANGE rule at the same (siteId, locale, oldSlug) so
   * we don't accumulate stale rows on repeated renames.
   */
  async recordSlugChange(input: SlugChangeInput): Promise<void> {
    const fromPath = normalizeRedirectPath(
      "/" + input.oldSlug.replace(/^\//, ""),
    );
    const toPath = normalizeRedirectPath(
      "/" + input.newSlug.replace(/^\//, ""),
    );
    if (fromPath === toPath) return;

    const locale = input.locale || null;
    const reason =
      input.reason ??
      `Auto-redirect after slug rename (${input.oldSlug} → ${input.newSlug}).`;

    try {
      // Prisma's typed composite-unique input rejects `null` for nullable
      // members, so we emulate the upsert via findFirst + update/create.
      const existing = await this.prisma.redirect.findFirst({
        where: { siteId: input.siteId, fromPath, locale },
        select: { id: true },
      });
      if (existing) {
        await this.prisma.redirect.update({
          where: { id: existing.id },
          data: {
            toPath,
            enabled: true,
            source: SLUG_CHANGE_SOURCE,
            reason,
          },
        });
      } else {
        await this.prisma.redirect.create({
          data: {
            siteId: input.siteId,
            fromPath,
            toPath,
            statusCode: 301,
            permanent: true,
            locale,
            reason,
            enabled: true,
            source: SLUG_CHANGE_SOURCE,
          },
        });
      }

      // Re-target any *other* SLUG_CHANGE chain that already points at the
      // old slug, so visitors don't bounce through a stale intermediate.
      await this.prisma.redirect.updateMany({
        where: {
          siteId: input.siteId,
          toPath: fromPath,
          source: SLUG_CHANGE_SOURCE,
          locale,
        },
        data: { toPath },
      });

      await this.submitIndexNowSafe(
        input.siteId,
        [fromPath, toPath],
        SearchEngineSubmissionTarget.INDEXNOW_AUTO_REDIRECT_CREATE,
      );
    } catch (err) {
      // Slug-rename must never fail because of a redirect bookkeeping issue.
      this.logger.warn(
        `recordSlugChange failed for site=${input.siteId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Recorded after a page is permanently deleted so the URL can be redirected
   * to a target (e.g. the homepage) instead of returning 404. Caller chooses
   * the destination.
   */
  async recordPageDelete(input: {
    siteId: string;
    slug: string;
    locale: string | null;
    toPath: string;
    reason?: string;
  }): Promise<void> {
    const fromPath = normalizeRedirectPath("/" + input.slug.replace(/^\//, ""));
    const toPath = normalizeRedirectPath(input.toPath);
    if (fromPath === toPath) return;
    const reason = input.reason ?? "Auto-redirect after page deletion.";

    try {
      const existing = await this.prisma.redirect.findFirst({
        where: {
          siteId: input.siteId,
          fromPath,
          locale: input.locale,
        },
        select: { id: true },
      });
      if (existing) {
        await this.prisma.redirect.update({
          where: { id: existing.id },
          data: {
            toPath,
            enabled: true,
            source: PAGE_DELETE_SOURCE,
            reason,
          },
        });
      } else {
        await this.prisma.redirect.create({
          data: {
            siteId: input.siteId,
            fromPath,
            toPath,
            statusCode: 301,
            permanent: true,
            locale: input.locale,
            reason,
            enabled: true,
            source: PAGE_DELETE_SOURCE,
          },
        });
      }
      await this.submitIndexNowSafe(
        input.siteId,
        [fromPath, toPath],
        SearchEngineSubmissionTarget.INDEXNOW_AUTO_REDIRECT_CREATE,
      );
    } catch (err) {
      this.logger.warn(
        `recordPageDelete failed for site=${input.siteId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async submitIndexNowSafe(
    siteId: string,
    paths: string[],
    target: SearchEngineSubmissionTarget,
  ): Promise<void> {
    try {
      const canonicalHost =
        await this.robotsService.resolveCanonicalHost(siteId);
      if (!canonicalHost) return;
      const urls = paths
        .map((p) => p.trim())
        .filter(Boolean)
        .map(
          (p) => `https://${canonicalHost}${p.startsWith("/") ? p : `/${p}`}`,
        );
      if (urls.length === 0) return;
      await this.indexNowService.submitAuto({ siteId, urls, target });
    } catch {
      // Auto-submission must never break redirect operations.
    }
  }
}
