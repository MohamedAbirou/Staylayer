import { randomBytes } from "node:crypto";

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import {
  Prisma,
  SearchEngineSubmissionStatus,
  SearchEngineSubmissionTarget,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { RobotsService } from "../robots/robots.service";
import { submitToIndexNow } from "./indexnow.client";

const MAX_URLS_PER_REQUEST = 10_000;
const MAX_URL_LENGTH = 2048;
const MAX_MANUAL_URLS = 500;

/**
 * Maximum number of submission attempts before we give up on a failed row.
 * The first attempt counts as attempt #1, so MAX_ATTEMPTS = 5 means up to
 * four automatic retries.
 */
const MAX_ATTEMPTS = 5;

/**
 * Backoff schedule (ms) between automatic retries. Index 0 is the wait after
 * attempt #1 fails, etc. The last entry is reused if attempts exceeds the
 * array length.
 */
const RETRY_BACKOFF_MS = [
  60_000, // 1 minute
  5 * 60_000, // 5 minutes
  15 * 60_000, // 15 minutes
  60 * 60_000, // 1 hour
];

const RETRY_PROCESSOR_INTERVAL_MS = 60_000;
const RETRY_BATCH_SIZE = 25;
const MAX_SUBMISSION_LIST_LIMIT = 200;

const AUTO_TARGETS = new Set<SearchEngineSubmissionTarget>([
  SearchEngineSubmissionTarget.INDEXNOW_AUTO_PUBLISH,
  SearchEngineSubmissionTarget.INDEXNOW_AUTO_UNPUBLISH,
  SearchEngineSubmissionTarget.INDEXNOW_AUTO_DELETE,
  SearchEngineSubmissionTarget.INDEXNOW_AUTO_REDIRECT_CREATE,
  SearchEngineSubmissionTarget.INDEXNOW_AUTO_REDIRECT_REMOVE,
]);

function isAutoTarget(target: SearchEngineSubmissionTarget): boolean {
  return AUTO_TARGETS.has(target);
}

@Injectable()
export class IndexNowService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IndexNowService.name);
  private retryTimer: NodeJS.Timeout | null = null;
  private retryRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly robotsService: RobotsService,
  ) {}

  onModuleInit(): void {
    // Skip the background retry loop in the test environment so unit tests
    // can run deterministically without a leaked timer.
    if (process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID) return;
    this.retryTimer = setInterval(
      () => void this.processPendingRetries(),
      RETRY_PROCESSOR_INTERVAL_MS,
    );
  }

  onModuleDestroy(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /**
   * Return (and lazily create) the IndexNow key for a site. Idempotent. The
   * key is a 32-character hex token, well within the 8–128 char range the
   * spec mandates.
   */
  async getOrCreateKey(siteId: string): Promise<string> {
    const settings = await this.prisma.siteSettings.findUnique({
      where: { siteId },
      select: { indexNowKey: true },
    });
    if (!settings) {
      throw new NotFoundException({
        code: "SITE_SETTINGS_NOT_FOUND",
        message: "Site settings have not been initialized",
      });
    }
    if (settings.indexNowKey && settings.indexNowKey.length >= 8) {
      return settings.indexNowKey;
    }

    const newKey = this.generateKey();
    await this.prisma.siteSettings.update({
      where: { siteId },
      data: { indexNowKey: newKey },
    });
    return newKey;
  }

  async getOverview(siteId: string): Promise<{
    siteId: string;
    enabled: boolean;
    key: string;
    keyFileUrl: string | null;
    canonicalHost: string;
    indexingEnabled: boolean;
    recentSubmissions: Array<{
      id: string;
      target: SearchEngineSubmissionTarget;
      status: SearchEngineSubmissionStatus;
      urlCount: number;
      urls: string[];
      responseStatus: number | null;
      responseBody: string | null;
      reason: string | null;
      attempts: number;
      lastAttemptAt: string | null;
      nextAttemptAt: string | null;
      createdAt: string;
      createdBy: string | null;
    }>;
  }> {
    const settings = await this.prisma.siteSettings.findUnique({
      where: { siteId },
      select: {
        indexNowEnabled: true,
        indexNowKey: true,
        seoIndexingEnabled: true,
      },
    });
    if (!settings) {
      throw new NotFoundException({
        code: "SITE_SETTINGS_NOT_FOUND",
        message: "Site settings have not been initialized",
      });
    }

    const key = settings.indexNowKey || (await this.getOrCreateKey(siteId));
    const canonicalHost = await this.robotsService.resolveCanonicalHost(siteId);
    const recent = await this.prisma.sitemapSubmissionLog.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
      take: 25,
    });

    return {
      siteId,
      enabled: settings.indexNowEnabled,
      key,
      keyFileUrl: canonicalHost ? `https://${canonicalHost}/${key}.txt` : null,
      canonicalHost,
      indexingEnabled: settings.seoIndexingEnabled,
      recentSubmissions: recent.map((entry) => ({
        id: entry.id,
        target: entry.target,
        status: entry.status,
        urlCount: entry.urlCount,
        urls: entry.urls.slice(0, 50),
        responseStatus: entry.responseStatus,
        responseBody: entry.responseBody,
        reason: entry.reason,
        attempts: entry.attempts,
        lastAttemptAt: entry.lastAttemptAt?.toISOString() ?? null,
        nextAttemptAt: entry.nextAttemptAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
        createdBy: entry.createdBy,
      })),
    };
  }

  async setEnabled(
    siteId: string,
    enabled: boolean,
  ): Promise<{ enabled: boolean }> {
    const settings = await this.prisma.siteSettings.findUnique({
      where: { siteId },
      select: { id: true },
    });
    if (!settings) {
      throw new NotFoundException({
        code: "SITE_SETTINGS_NOT_FOUND",
        message: "Site settings have not been initialized",
      });
    }
    await this.prisma.siteSettings.update({
      where: { siteId },
      data: { indexNowEnabled: enabled },
    });
    return { enabled };
  }

  /**
   * Rotate the IndexNow key. Bing requires the new key file to be served at
   * the new path before the next submission, so the caller MUST publish the
   * key file (handled automatically by the website middleware).
   */
  async rotateKey(siteId: string): Promise<{ key: string }> {
    const settings = await this.prisma.siteSettings.findUnique({
      where: { siteId },
      select: { id: true },
    });
    if (!settings) {
      throw new NotFoundException({
        code: "SITE_SETTINGS_NOT_FOUND",
        message: "Site settings have not been initialized",
      });
    }
    const newKey = this.generateKey();
    await this.prisma.siteSettings.update({
      where: { siteId },
      data: { indexNowKey: newKey },
    });
    return { key: newKey };
  }

  async verifyKey(siteId: string, candidate: string): Promise<boolean> {
    if (!candidate || candidate.length < 8 || candidate.length > 128) {
      return false;
    }
    if (!/^[a-zA-Z0-9-]+$/.test(candidate)) return false;
    const settings = await this.prisma.siteSettings.findUnique({
      where: { siteId },
      select: { indexNowKey: true },
    });
    return Boolean(settings?.indexNowKey && settings.indexNowKey === candidate);
  }

  /**
   * Submit a URL list manually from the dashboard. Validates plan-eligible
   * scope (must be enabled, indexing on, valid URLs on canonical host).
   */
  async submitManual(input: {
    siteId: string;
    urls: string[];
    actor: string | null;
  }): Promise<{
    logId: string;
    status: SearchEngineSubmissionStatus;
    submitted: number;
    skipped: number;
    response: { status: number; body: string } | null;
  }> {
    if (input.urls.length === 0) {
      throw new BadRequestException({
        code: "EMPTY_URL_LIST",
        message: "At least one URL is required",
      });
    }
    if (input.urls.length > MAX_MANUAL_URLS) {
      throw new BadRequestException({
        code: "TOO_MANY_URLS",
        message: `IndexNow manual submission accepts at most ${MAX_MANUAL_URLS} URLs per request`,
      });
    }

    return this.submitInternal({
      siteId: input.siteId,
      urls: input.urls,
      target: SearchEngineSubmissionTarget.INDEXNOW_MANUAL,
      actor: input.actor,
    });
  }

  /**
   * Fire-and-forget submission used by automatic hooks (page publish/unpublish,
   * redirect changes). Always persists a log row regardless of outcome so the
   * operator can audit submissions even if the IndexNow endpoint is down.
   */
  async submitAuto(input: {
    siteId: string;
    urls: string[];
    target: SearchEngineSubmissionTarget;
    actor?: string | null;
  }): Promise<void> {
    try {
      await this.submitInternal({
        siteId: input.siteId,
        urls: input.urls,
        target: input.target,
        actor: input.actor ?? null,
      });
    } catch (error) {
      this.logger.warn(
        `Auto IndexNow submission failed siteId=${input.siteId} target=${input.target} error=${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async submitInternal(input: {
    siteId: string;
    urls: string[];
    target: SearchEngineSubmissionTarget;
    actor: string | null;
  }): Promise<{
    logId: string;
    status: SearchEngineSubmissionStatus;
    submitted: number;
    skipped: number;
    response: { status: number; body: string } | null;
  }> {
    const settings = await this.prisma.siteSettings.findUnique({
      where: { siteId: input.siteId },
      select: {
        indexNowEnabled: true,
        indexNowKey: true,
        seoIndexingEnabled: true,
      },
    });
    if (!settings) {
      return this.persistLog({
        siteId: input.siteId,
        urls: input.urls,
        target: input.target,
        actor: input.actor,
        status: SearchEngineSubmissionStatus.SKIPPED,
        reason: "Site settings missing",
        response: null,
      });
    }

    if (!settings.indexNowEnabled) {
      return this.persistLog({
        siteId: input.siteId,
        urls: input.urls,
        target: input.target,
        actor: input.actor,
        status: SearchEngineSubmissionStatus.SKIPPED,
        reason: "IndexNow disabled for this site",
        response: null,
      });
    }

    if (!settings.seoIndexingEnabled) {
      return this.persistLog({
        siteId: input.siteId,
        urls: input.urls,
        target: input.target,
        actor: input.actor,
        status: SearchEngineSubmissionStatus.SKIPPED,
        reason: "Site indexing is paused — refusing to ping IndexNow",
        response: null,
      });
    }

    const canonicalHost = await this.robotsService.resolveCanonicalHost(
      input.siteId,
    );
    if (!canonicalHost) {
      return this.persistLog({
        siteId: input.siteId,
        urls: input.urls,
        target: input.target,
        actor: input.actor,
        status: SearchEngineSubmissionStatus.SKIPPED,
        reason: "Site has no live canonical host yet",
        response: null,
      });
    }

    const key =
      settings.indexNowKey || (await this.getOrCreateKey(input.siteId));

    const { acceptedUrls, skippedReasons } = this.normalizeUrls(
      input.urls,
      canonicalHost,
    );

    if (acceptedUrls.length === 0) {
      return this.persistLog({
        siteId: input.siteId,
        urls: input.urls,
        target: input.target,
        actor: input.actor,
        status: SearchEngineSubmissionStatus.SKIPPED,
        reason:
          skippedReasons.size > 0
            ? `No URLs accepted: ${Array.from(skippedReasons).join("; ")}`
            : "No valid URLs",
        response: null,
      });
    }

    const result = await submitToIndexNow({
      host: canonicalHost,
      key,
      urlList: acceptedUrls,
    });

    const status = result.ok
      ? SearchEngineSubmissionStatus.SUCCESS
      : SearchEngineSubmissionStatus.FAILED;

    return this.persistLog({
      siteId: input.siteId,
      urls: acceptedUrls,
      target: input.target,
      actor: input.actor,
      status,
      reason:
        skippedReasons.size > 0
          ? `Skipped ${input.urls.length - acceptedUrls.length} URL(s): ${Array.from(
              skippedReasons,
            ).join("; ")}`
          : null,
      response: { status: result.status, body: result.body },
    });
  }

  private async persistLog(input: {
    siteId: string;
    urls: string[];
    target: SearchEngineSubmissionTarget;
    actor: string | null;
    status: SearchEngineSubmissionStatus;
    reason: string | null;
    response: { status: number; body: string } | null;
  }): Promise<{
    logId: string;
    status: SearchEngineSubmissionStatus;
    submitted: number;
    skipped: number;
    response: { status: number; body: string } | null;
  }> {
    const isAuto = isAutoTarget(input.target);
    const shouldScheduleRetry =
      isAuto && input.status === SearchEngineSubmissionStatus.FAILED;
    const now = new Date();
    const data: Prisma.SitemapSubmissionLogCreateInput = {
      site: { connect: { id: input.siteId } },
      target: input.target,
      status: input.status,
      urls: input.urls.slice(0, MAX_URLS_PER_REQUEST),
      urlCount: input.urls.length,
      responseStatus: input.response?.status ?? null,
      responseBody: input.response?.body ?? null,
      reason: input.reason,
      createdBy: input.actor,
      attempts: 1,
      lastAttemptAt:
        input.status === SearchEngineSubmissionStatus.SKIPPED ? null : now,
      nextAttemptAt: shouldScheduleRetry
        ? new Date(now.getTime() + RETRY_BACKOFF_MS[0])
        : null,
    };
    const log = await this.prisma.sitemapSubmissionLog.create({ data });
    return {
      logId: log.id,
      status: input.status,
      submitted:
        input.status === SearchEngineSubmissionStatus.SUCCESS
          ? input.urls.length
          : 0,
      skipped:
        input.status === SearchEngineSubmissionStatus.SKIPPED
          ? input.urls.length
          : 0,
      response: input.response,
    };
  }

  /**
   * Paginated, filterable list of recent IndexNow submission log rows for a site.
   * Used by the dashboard activity panel.
   */
  async listSubmissions(
    siteId: string,
    filters: {
      target?: SearchEngineSubmissionTarget;
      status?: SearchEngineSubmissionStatus;
      cursor?: string;
      limit?: number;
    } = {},
  ): Promise<{
    items: Array<{
      id: string;
      target: SearchEngineSubmissionTarget;
      status: SearchEngineSubmissionStatus;
      urlCount: number;
      urls: string[];
      responseStatus: number | null;
      responseBody: string | null;
      reason: string | null;
      attempts: number;
      lastAttemptAt: string | null;
      nextAttemptAt: string | null;
      createdAt: string;
      createdBy: string | null;
    }>;
    nextCursor: string | null;
  }> {
    const limit = Math.min(
      Math.max(filters.limit ?? 50, 1),
      MAX_SUBMISSION_LIST_LIMIT,
    );
    const where: Prisma.SitemapSubmissionLogWhereInput = { siteId };
    if (filters.target) where.target = filters.target;
    if (filters.status) where.status = filters.status;

    const rows = await this.prisma.sitemapSubmissionLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((entry) => ({
      id: entry.id,
      target: entry.target,
      status: entry.status,
      urlCount: entry.urlCount,
      urls: entry.urls.slice(0, 50),
      responseStatus: entry.responseStatus,
      responseBody: entry.responseBody,
      reason: entry.reason,
      attempts: entry.attempts,
      lastAttemptAt: entry.lastAttemptAt?.toISOString() ?? null,
      nextAttemptAt: entry.nextAttemptAt?.toISOString() ?? null,
      createdAt: entry.createdAt.toISOString(),
      createdBy: entry.createdBy,
    }));

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  /**
   * Manually retry a previously failed submission. Resets the next-attempt
   * window to "now" so it is picked up immediately by the next processor tick,
   * or by an inline call to processPendingRetries.
   */
  async retrySubmission(
    siteId: string,
    logId: string,
    actor: string | null,
  ): Promise<{
    logId: string;
    status: SearchEngineSubmissionStatus;
    attempts: number;
    response: { status: number; body: string } | null;
  }> {
    const row = await this.prisma.sitemapSubmissionLog.findFirst({
      where: { id: logId, siteId },
    });
    if (!row) {
      throw new NotFoundException({
        code: "INDEXNOW_LOG_NOT_FOUND",
        message: "Submission log not found",
      });
    }
    if (row.status === SearchEngineSubmissionStatus.SUCCESS) {
      throw new BadRequestException({
        code: "INDEXNOW_ALREADY_SUCCEEDED",
        message: "This submission already succeeded",
      });
    }
    if (row.status === SearchEngineSubmissionStatus.SKIPPED) {
      throw new BadRequestException({
        code: "INDEXNOW_SKIPPED_NOT_RETRIABLE",
        message:
          "Skipped submissions cannot be retried — re-trigger the action instead",
      });
    }
    if (row.urls.length === 0) {
      throw new BadRequestException({
        code: "INDEXNOW_NO_URLS",
        message: "Original submission has no URLs to retry",
      });
    }

    const result = await this.retryRow(row, { actor, force: true });
    return result;
  }

  /**
   * Background processor: picks up FAILED rows whose retry window has
   * elapsed and replays them. Idempotent — safe to call concurrently with
   * the interval tick, since each row is updated row-by-row.
   */
  async processPendingRetries(): Promise<{ processed: number }> {
    if (this.retryRunning) return { processed: 0 };
    this.retryRunning = true;
    try {
      const now = new Date();
      const rows = await this.prisma.sitemapSubmissionLog.findMany({
        where: {
          status: SearchEngineSubmissionStatus.FAILED,
          attempts: { lt: MAX_ATTEMPTS },
          nextAttemptAt: { lte: now },
          target: {
            in: [
              SearchEngineSubmissionTarget.INDEXNOW_AUTO_PUBLISH,
              SearchEngineSubmissionTarget.INDEXNOW_AUTO_UNPUBLISH,
              SearchEngineSubmissionTarget.INDEXNOW_AUTO_DELETE,
              SearchEngineSubmissionTarget.INDEXNOW_AUTO_REDIRECT_CREATE,
              SearchEngineSubmissionTarget.INDEXNOW_AUTO_REDIRECT_REMOVE,
            ],
          },
        },
        orderBy: { nextAttemptAt: "asc" },
        take: RETRY_BATCH_SIZE,
      });

      let processed = 0;
      for (const row of rows) {
        try {
          await this.retryRow(row, { actor: null, force: false });
          processed += 1;
        } catch (error) {
          this.logger.error(
            `IndexNow retry failed for log ${row.id}: ${(error as Error).message}`,
          );
        }
      }
      return { processed };
    } finally {
      this.retryRunning = false;
    }
  }

  /**
   * Replay a single SitemapSubmissionLog row against IndexNow and update the
   * row in place. Used by both the background processor and manual retries.
   */
  private async retryRow(
    row: {
      id: string;
      siteId: string;
      urls: string[];
      attempts: number;
      status: SearchEngineSubmissionStatus;
    },
    options: { actor: string | null; force: boolean },
  ): Promise<{
    logId: string;
    status: SearchEngineSubmissionStatus;
    attempts: number;
    response: { status: number; body: string } | null;
  }> {
    if (!options.force && row.attempts >= MAX_ATTEMPTS) {
      return {
        logId: row.id,
        status: row.status,
        attempts: row.attempts,
        response: null,
      };
    }

    const settings = await this.prisma.siteSettings.findUnique({
      where: { siteId: row.siteId },
      select: {
        indexNowEnabled: true,
        indexNowKey: true,
        seoIndexingEnabled: true,
      },
    });
    if (
      !settings ||
      !settings.indexNowEnabled ||
      !settings.seoIndexingEnabled
    ) {
      const skipped = await this.prisma.sitemapSubmissionLog.update({
        where: { id: row.id },
        data: {
          status: SearchEngineSubmissionStatus.SKIPPED,
          reason:
            "IndexNow or site indexing was disabled before retry could run",
          nextAttemptAt: null,
          lastAttemptAt: new Date(),
        },
      });
      return {
        logId: skipped.id,
        status: skipped.status,
        attempts: skipped.attempts,
        response: null,
      };
    }

    const canonicalHost = await this.robotsService.resolveCanonicalHost(
      row.siteId,
    );
    if (!canonicalHost) {
      const updated = await this.prisma.sitemapSubmissionLog.update({
        where: { id: row.id },
        data: {
          status: SearchEngineSubmissionStatus.SKIPPED,
          reason: "Canonical host no longer available",
          nextAttemptAt: null,
          lastAttemptAt: new Date(),
        },
      });
      return {
        logId: updated.id,
        status: updated.status,
        attempts: updated.attempts,
        response: null,
      };
    }

    const key = settings.indexNowKey || (await this.getOrCreateKey(row.siteId));

    const result = await submitToIndexNow({
      host: canonicalHost,
      key,
      urlList: row.urls,
    });

    const nextAttempts = row.attempts + 1;
    const nowDate = new Date();

    if (result.ok) {
      const updated = await this.prisma.sitemapSubmissionLog.update({
        where: { id: row.id },
        data: {
          status: SearchEngineSubmissionStatus.SUCCESS,
          responseStatus: result.status,
          responseBody: result.body,
          reason: options.actor
            ? `Retried manually by ${options.actor}`
            : "Auto-retry succeeded",
          attempts: nextAttempts,
          lastAttemptAt: nowDate,
          nextAttemptAt: null,
        },
      });
      return {
        logId: updated.id,
        status: updated.status,
        attempts: updated.attempts,
        response: { status: result.status, body: result.body },
      };
    }

    const remainingAttempts = MAX_ATTEMPTS - nextAttempts;
    const nextAttemptAt =
      remainingAttempts > 0
        ? new Date(nowDate.getTime() + this.backoffMs(nextAttempts))
        : null;
    const updated = await this.prisma.sitemapSubmissionLog.update({
      where: { id: row.id },
      data: {
        status: SearchEngineSubmissionStatus.FAILED,
        responseStatus: result.status,
        responseBody: result.body,
        reason:
          remainingAttempts > 0
            ? `Retry ${nextAttempts}/${MAX_ATTEMPTS} failed; next attempt scheduled`
            : `Gave up after ${MAX_ATTEMPTS} attempts`,
        attempts: nextAttempts,
        lastAttemptAt: nowDate,
        nextAttemptAt,
      },
    });
    return {
      logId: updated.id,
      status: updated.status,
      attempts: updated.attempts,
      response: { status: result.status, body: result.body },
    };
  }

  /**
   * Visible for testing. Returns the wait (ms) before the next retry for a row
   * whose attempt-count is `attemptsCompleted` (i.e. attempt #1 just failed,
   * so attemptsCompleted = 1 returns the first backoff window).
   */
  backoffMs(attemptsCompleted: number): number {
    const idx = Math.max(
      0,
      Math.min(attemptsCompleted - 1, RETRY_BACKOFF_MS.length - 1),
    );
    return RETRY_BACKOFF_MS[idx];
  }

  /**
   * Accepts a path or absolute URL. Outputs absolute URLs scoped to the site
   * canonical host, deduped, with up to MAX_URLS_PER_REQUEST entries.
   */
  private normalizeUrls(
    urls: string[],
    canonicalHost: string,
  ): { acceptedUrls: string[]; skippedReasons: Set<string> } {
    const accepted = new Set<string>();
    const reasons = new Set<string>();
    for (const raw of urls) {
      if (accepted.size >= MAX_URLS_PER_REQUEST) {
        reasons.add(`Truncated to ${MAX_URLS_PER_REQUEST} URLs`);
        break;
      }
      if (typeof raw !== "string") {
        reasons.add("Non-string entry");
        continue;
      }
      const trimmed = raw.trim();
      if (!trimmed) continue;
      if (trimmed.length > MAX_URL_LENGTH) {
        reasons.add("URL longer than 2048 characters");
        continue;
      }
      let parsed: URL;
      try {
        parsed = new URL(trimmed, `https://${canonicalHost}`);
      } catch {
        reasons.add(`Invalid URL: ${trimmed.slice(0, 80)}`);
        continue;
      }
      if (parsed.protocol !== "https:") {
        parsed.protocol = "https:";
      }
      if (parsed.host.toLowerCase() !== canonicalHost.toLowerCase()) {
        reasons.add(
          `URL host "${parsed.host}" does not match canonical host "${canonicalHost}"`,
        );
        continue;
      }
      parsed.hash = "";
      accepted.add(parsed.toString());
    }
    return { acceptedUrls: Array.from(accepted), skippedReasons: reasons };
  }

  private generateKey(): string {
    return randomBytes(16).toString("hex");
  }
}
