import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";

/**
 * Phase 12 — prune stale `OperatorRefreshSession` rows.
 *
 * The session table grows with every operator login/refresh; over time
 * the bulk of the rows are either long-expired or revoked. They are
 * useful for short-term forensic queries (who signed in last week?) but
 * after a generous retention window we delete them to keep the table
 * small, the unique-JTI index hot, and reuse-detection lookups fast.
 *
 * Retention defaults to 30 days past `expiresAt` (so a stolen refresh
 * cookie remains attributable for at least the maximum refresh-token
 * lifetime + one billing cycle of forensic windowing).
 */
const TICK_INTERVAL_MS_PROD = 60 * 60_000; // hourly
const TICK_INTERVAL_MS_DEV = 30 * 60_000; // half-hourly
const DEFAULT_RETENTION_DAYS = 30;

@Injectable()
export class OperatorRefreshSessionCleanupService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    OperatorRefreshSessionCleanupService.name,
  );
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID) return;
    if (process.env.OPERATOR_REFRESH_CLEANUP_DISABLED === "true") {
      this.logger.log("Operator refresh session cleanup disabled by env flag");
      return;
    }
    const interval =
      process.env.NODE_ENV === "production"
        ? TICK_INTERVAL_MS_PROD
        : TICK_INTERVAL_MS_DEV;
    this.timer = setInterval(() => void this.tick(), interval);
    this.logger.log(
      `Operator refresh session cleanup started (interval=${interval}ms)`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Exposed for tests. Returns number of rows deleted. */
  async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const retentionDays =
        Number(process.env.OPERATOR_REFRESH_RETENTION_DAYS) ||
        DEFAULT_RETENTION_DAYS;
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      const { count } = await this.prisma.operatorRefreshSession.deleteMany({
        where: { expiresAt: { lt: cutoff } },
      });
      if (count > 0) {
        this.logger.log(
          `Operator refresh cleanup: pruned ${count} stale session(s) older than ${retentionDays}d`,
        );
      }
      return count;
    } catch (err) {
      this.logger.error(
        `Operator refresh cleanup error: ${
          err instanceof Error ? err.message : String(err)
        }`,
        err instanceof Error ? err.stack : undefined,
      );
      return 0;
    } finally {
      this.running = false;
    }
  }
}
