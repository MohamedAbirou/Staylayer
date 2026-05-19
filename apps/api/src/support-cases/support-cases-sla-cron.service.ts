import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";

import { SupportCasesService } from "./support-cases.service";

/**
 * Phase 12 — periodically reconcile support-case SLA breach flags.
 *
 * `SupportCasesService.reconcileSlaBreaches()` scans cases whose
 * first-response or resolution deadline has elapsed without progress and
 * sets the corresponding `slaBreachedFirstResponse` / `slaBreachedResolution`
 * flags so the support workspace can surface them in the breach filter
 * and SLA breach analytics row light up without operator action.
 *
 * Mirrors the cron pattern of `SiteDeletionCronService` (no
 * `@nestjs/schedule` dep). Disabled in test runners and skippable in
 * production via `SUPPORT_SLA_CRON_DISABLED=true`.
 */
const TICK_INTERVAL_MS_PROD = 60_000;
const TICK_INTERVAL_MS_DEV = 5 * 60_000;

@Injectable()
export class SupportCasesSlaCronService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SupportCasesSlaCronService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly supportCases: SupportCasesService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID) return;
    if (process.env.SUPPORT_SLA_CRON_DISABLED === "true") {
      this.logger.log("Support SLA cron disabled by env flag");
      return;
    }
    const interval =
      process.env.NODE_ENV === "production"
        ? TICK_INTERVAL_MS_PROD
        : TICK_INTERVAL_MS_DEV;
    this.timer = setInterval(() => void this.tick(), interval);
    this.logger.log(`Support SLA cron started (interval=${interval}ms)`);
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
      const updated = await this.supportCases.reconcileSlaBreaches();
      if (updated > 0) {
        this.logger.log(`Support SLA cron: flagged ${updated} breach(es)`);
      }
    } catch (err) {
      this.logger.error(
        `Support SLA cron tick error: ${
          err instanceof Error ? err.message : String(err)
        }`,
        err instanceof Error ? err.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}
