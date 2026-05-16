import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { BingSyncJobType } from "@prisma/client";

import { BingWebmasterService } from "./bing-webmaster.service";
import { BingWebmasterSyncService } from "./bing-webmaster-sync.service";

const TICK_INTERVAL_MS = 15 * 60_000;
const TICK_INTERVAL_MS_DEV =
  process.env.NODE_ENV === "production" ? TICK_INTERVAL_MS : 60 * 60_000;

/**
 * Daily Bing Webmaster sync. 15-minute tick in production, 60-minute tick in
 * dev. Skipped entirely during tests.
 */
@Injectable()
export class BingWebmasterCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BingWebmasterCronService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly service: BingWebmasterService,
    private readonly syncService: BingWebmasterSyncService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID) return;
    if (process.env.BING_WEBMASTER_CRON_DISABLED === "true") {
      this.logger.log("Bing Webmaster cron disabled by env flag");
      return;
    }
    this.timer = setInterval(() => void this.tick(), TICK_INTERVAL_MS_DEV);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.service.listConnectionsDueForSync();
      if (due.length === 0) return;
      this.logger.log(
        `Bing Webmaster daily sync: ${due.length} connection(s) due`,
      );
      for (const conn of due) {
        try {
          await this.syncService.runSync(conn, {
            type: BingSyncJobType.DAILY,
            triggeredBy: "cron",
          });
        } catch (err) {
          this.logger.warn(
            `Daily Bing sync failed for site=${conn.siteId}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Bing Webmaster cron tick error: ${
          err instanceof Error ? err.message : String(err)
        }`,
        err instanceof Error ? err.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}
