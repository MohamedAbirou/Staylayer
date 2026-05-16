import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";

import { SeoAuditRunnerService } from "./scheduled-audits-runner.service";
import { SeoAuditScheduleService } from "./scheduled-audits-schedule.service";

/**
 * Polls every 15 minutes (60 in non-production) for SeoAuditSchedule rows
 * whose `nextRunAt` is in the past, and dispatches their audit runs.
 *
 * We deliberately stay with `setInterval` to match the existing pattern of
 * `SearchConsoleCronService` / `BingWebmasterCronService` — no extra dep on
 * `@nestjs/schedule`.
 */
const TICK_INTERVAL_MS_PROD = 15 * 60_000;
const TICK_INTERVAL_MS_DEV = 60 * 60_000;

@Injectable()
export class SeoAuditCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SeoAuditCronService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly scheduleService: SeoAuditScheduleService,
    private readonly runner: SeoAuditRunnerService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID) return;
    if (process.env.SEO_AUDIT_CRON_DISABLED === "true") {
      this.logger.log("SEO audit cron disabled by env flag");
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
      const due = await this.scheduleService.listDueSchedules(new Date());
      if (due.length === 0) return;
      this.logger.log(`SEO audit cron: ${due.length} site(s) due`);
      for (const schedule of due) {
        try {
          await this.runner.runAudit(schedule.siteId, {
            kind: "SCHEDULED",
            triggeredBy: "cron",
          });
        } catch (err) {
          this.logger.warn(
            `Audit run failed for site=${schedule.siteId}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `SEO audit cron tick error: ${
          err instanceof Error ? err.message : String(err)
        }`,
        err instanceof Error ? err.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}
