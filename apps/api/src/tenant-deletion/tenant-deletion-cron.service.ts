import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";

import { TenantDeletionService } from "./tenant-deletion.service";

/**
 * Polls for QUEUED `TenantDeletionJob` rows and dispatches them through the
 * runner. Mirrors `SiteDeletionCronService` exactly so the operational
 * footprint stays consistent.
 */
const TICK_INTERVAL_MS_PROD = 60_000;
const TICK_INTERVAL_MS_DEV = 5 * 60_000;

@Injectable()
export class TenantDeletionCronService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(TenantDeletionCronService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly tenantDeletion: TenantDeletionService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID) return;
    if (process.env.TENANT_DELETION_CRON_DISABLED === "true") {
      this.logger.log("Tenant deletion cron disabled by env flag");
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
      const ids = await this.tenantDeletion.listClaimableJobIds(5);
      if (ids.length === 0) return;
      this.logger.log(`Tenant deletion cron: dispatching ${ids.length} job(s)`);
      for (const id of ids) {
        try {
          await this.tenantDeletion.runJob(id);
        } catch (err) {
          this.logger.warn(
            `Tenant deletion job ${id} threw: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Tenant deletion cron tick error: ${
          err instanceof Error ? err.message : String(err)
        }`,
        err instanceof Error ? err.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}
