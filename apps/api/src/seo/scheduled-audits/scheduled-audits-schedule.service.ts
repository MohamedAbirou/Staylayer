import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  SiteStatus,
  type SeoAuditSchedule,
  type SeoAuditScheduleCadence,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { computeNextRunAt } from "./scheduled-audits.helpers";

export interface UpdateSchedulePayload {
  cadence?: SeoAuditScheduleCadence;
  enabled?: boolean;
  hourUtc?: number;
  dayOfWeek?: number | null;
}

@Injectable()
export class SeoAuditScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(siteId: string): Promise<SeoAuditSchedule> {
    const existing = await this.prisma.seoAuditSchedule.findUnique({
      where: { siteId },
    });
    if (existing) return existing;

    const now = new Date();
    return this.prisma.seoAuditSchedule.create({
      data: {
        siteId,
        cadence: "WEEKLY",
        enabled: true,
        hourUtc: 3,
        dayOfWeek: 1,
        nextRunAt: computeNextRunAt({
          cadence: "WEEKLY",
          hourUtc: 3,
          dayOfWeek: 1,
          now,
        }),
      },
    });
  }

  async update(
    siteId: string,
    payload: UpdateSchedulePayload,
  ): Promise<SeoAuditSchedule> {
    const existing = await this.getOrCreate(siteId);

    const cadence = payload.cadence ?? existing.cadence;
    const enabled = payload.enabled ?? existing.enabled;
    const hourUtc = payload.hourUtc ?? existing.hourUtc;
    const dayOfWeek =
      payload.dayOfWeek === undefined ? existing.dayOfWeek : payload.dayOfWeek;

    if (!Number.isInteger(hourUtc) || hourUtc < 0 || hourUtc > 23) {
      throw new BadRequestException("hourUtc must be an integer 0–23");
    }
    if (
      cadence === "WEEKLY" &&
      (dayOfWeek === null ||
        dayOfWeek === undefined ||
        !Number.isInteger(dayOfWeek) ||
        dayOfWeek < 0 ||
        dayOfWeek > 6)
    ) {
      throw new BadRequestException(
        "dayOfWeek must be an integer 0 (Sun) – 6 (Sat) for WEEKLY cadence",
      );
    }

    const nextRunAt = enabled
      ? computeNextRunAt({
          cadence,
          hourUtc,
          dayOfWeek: dayOfWeek ?? null,
          now: new Date(),
        })
      : null;

    return this.prisma.seoAuditSchedule.update({
      where: { siteId },
      data: { cadence, enabled, hourUtc, dayOfWeek, nextRunAt },
    });
  }

  /**
   * Pull all schedules that should fire on this tick. A schedule is "due"
   * when it is enabled, cadence != OFF, and its `nextRunAt` is in the past.
   */
  async listDueSchedules(now: Date): Promise<SeoAuditSchedule[]> {
    return this.prisma.seoAuditSchedule.findMany({
      where: {
        enabled: true,
        cadence: { not: "OFF" },
        nextRunAt: { lte: now },
        // Skip schedules whose site has been archived/suspended — archive
        // is fully quiet so background SEO audits must not fire for them.
        site: { is: { status: SiteStatus.ACTIVE } },
      },
      take: 25,
    });
  }

  async markRan(siteId: string, ranAt: Date): Promise<SeoAuditSchedule | null> {
    const schedule = await this.prisma.seoAuditSchedule.findUnique({
      where: { siteId },
    });
    if (!schedule) return null;

    return this.prisma.seoAuditSchedule.update({
      where: { siteId },
      data: {
        lastRunAt: ranAt,
        nextRunAt: computeNextRunAt({
          cadence: schedule.cadence,
          hourUtc: schedule.hourUtc,
          dayOfWeek: schedule.dayOfWeek,
          now: ranAt,
        }),
      },
    });
  }

  /** Lookup; throws if site has no schedule row yet. */
  async require(siteId: string): Promise<SeoAuditSchedule> {
    const schedule = await this.prisma.seoAuditSchedule.findUnique({
      where: { siteId },
    });
    if (!schedule) {
      throw new NotFoundException("Audit schedule not configured for site");
    }
    return schedule;
  }
}
