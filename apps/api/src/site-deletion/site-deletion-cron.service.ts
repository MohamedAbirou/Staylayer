import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";

import { SiteDeletionService } from "./site-deletion.service";

/**
 * Polls for QUEUED `SiteDeletionJob` rows and dispatches them through the
 * runner. Mirrors the cron pattern used by `SeoAuditCronService` —
 * deliberately staying with `setInterval` to avoid pulling in
 * `@nestjs/schedule`.
 *
 * In production we tick every minute so freshly queued deletions feel
 * near-instant; in dev we tick every 5 minutes to keep logs quieter.
 */
const TICK_INTERVAL_MS_PROD = 60_000;
const TICK_INTERVAL_MS_DEV = 5 * 60_000;

@Injectable()
export class SiteDeletionCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SiteDeletionCronService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly siteDeletion: SiteDeletionService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID) return;
    if (process.env.SITE_DELETION_CRON_DISABLED === "true") {
      this.logger.log("Site deletion cron disabled by env flag");
      return;
    }
    const interval =
      process.env.NODE_ENV === "production"
        ? TICK_INTERVAL_MS_PROD
        : TICK_INTERVAL_MS_DEV;
    this.timer = setInterval(() => void this.tick(), interval);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Exposed for tests. */
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const ids = await this.siteDeletion.listClaimableJobIds(5);
      if (ids.length === 0) return;
      this.logger.log(`Site deletion cron: dispatching ${ids.length} job(s)`);
      for (const id of ids) {
        try {
          await this.siteDeletion.runJob(id);
        } catch (err) {
          this.logger.warn(
            `Site deletion job ${id} threw: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Site deletion cron tick error: ${
          err instanceof Error ? err.message : String(err)
        }`,
        err instanceof Error ? err.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}
