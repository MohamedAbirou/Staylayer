import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { SearchConsoleSyncJobType } from "@prisma/client";

import { SearchConsoleService } from "./search-console.service";
import { SearchConsoleSyncService } from "./search-console-sync.service";

/**
 * Run the Search Console daily sync. Implemented as a 15-minute tick that
 * picks the next batch of connections due for refresh — this keeps logic
 * simple without pulling in @nestjs/schedule.
 */
const TICK_INTERVAL_MS = 15 * 60_000;
const TICK_INTERVAL_MS_DEV =
  process.env.NODE_ENV === "production" ? TICK_INTERVAL_MS : 60 * 60_000;

@Injectable()
export class SearchConsoleCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SearchConsoleCronService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly service: SearchConsoleService,
    private readonly syncService: SearchConsoleSyncService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID) return;
    if (process.env.SEARCH_CONSOLE_CRON_DISABLED === "true") {
      this.logger.log("Search Console cron disabled by env flag");
      return;
    }
    this.timer = setInterval(
      () => void this.tick(),
      TICK_INTERVAL_MS_DEV,
    );
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
        `Search Console daily sync: ${due.length} connection(s) due`,
      );
      for (const conn of due) {
        try {
          await this.syncService.runSync(conn, {
            type: SearchConsoleSyncJobType.DAILY,
            triggeredBy: "cron",
          });
        } catch (err) {
          this.logger.warn(
            `Daily sync failed for site=${conn.siteId}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Search Console cron tick error: ${
          err instanceof Error ? err.message : String(err)
        }`,
        err instanceof Error ? err.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}
