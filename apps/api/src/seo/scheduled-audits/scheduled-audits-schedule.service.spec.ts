import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { PrismaService } from "../../prisma/prisma.service";
import { SeoAuditScheduleService } from "./scheduled-audits-schedule.service";

function buildPrismaMock() {
  const store = new Map<string, any>();
  return {
    store,
    seoAuditSchedule: {
      findUnique: jest.fn(async ({ where }) => store.get(where.siteId) ?? null),
      create: jest.fn(async ({ data }) => {
        const row = { id: `sched-${data.siteId}`, ...data };
        store.set(data.siteId, row);
        return row;
      }),
      update: jest.fn(async ({ where, data }) => {
        const existing = store.get(where.siteId);
        const next = { ...existing, ...data };
        store.set(where.siteId, next);
        return next;
      }),
      findMany: jest.fn(async () => []),
    },
  };
}

describe("SeoAuditScheduleService", () => {
  let service: SeoAuditScheduleService;
  let prismaMock: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prismaMock = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        SeoAuditScheduleService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = moduleRef.get(SeoAuditScheduleService);
  });

  it("getOrCreate seeds a weekly schedule with a future nextRunAt", async () => {
    const before = Date.now();
    const row = await service.getOrCreate("site-1");
    expect(row.cadence).toBe("WEEKLY");
    expect(row.enabled).toBe(true);
    expect(row.nextRunAt).toBeInstanceOf(Date);
    expect(row.nextRunAt!.getTime()).toBeGreaterThan(before);
  });

  it("getOrCreate returns the existing row on subsequent calls", async () => {
    const first = await service.getOrCreate("site-1");
    const second = await service.getOrCreate("site-1");
    expect(second.id).toBe(first.id);
    expect(prismaMock.seoAuditSchedule.create).toHaveBeenCalledTimes(1);
  });

  it("update validates hourUtc bounds", async () => {
    await service.getOrCreate("site-1");
    await expect(
      service.update("site-1", { hourUtc: 99 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("update requires dayOfWeek when cadence becomes WEEKLY", async () => {
    await service.getOrCreate("site-1");
    await prismaMock.seoAuditSchedule.update({
      where: { siteId: "site-1" },
      data: { dayOfWeek: null },
    });
    await expect(
      service.update("site-1", { cadence: "WEEKLY", dayOfWeek: null }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("update with cadence OFF or disabled clears nextRunAt", async () => {
    await service.getOrCreate("site-1");
    const off = await service.update("site-1", { cadence: "OFF" });
    expect(off.nextRunAt).toBeNull();
    const disabled = await service.update("site-1", {
      enabled: false,
      cadence: "DAILY",
    });
    expect(disabled.nextRunAt).toBeNull();
  });

  it("markRan advances nextRunAt for a daily schedule", async () => {
    await service.getOrCreate("site-1");
    await service.update("site-1", { cadence: "DAILY", hourUtc: 3 });
    const ran = new Date("2026-05-15T04:00:00Z");
    const updated = await service.markRan("site-1", ran);
    expect(updated?.lastRunAt).toEqual(ran);
    expect(updated?.nextRunAt?.toISOString()).toBe("2026-05-16T03:00:00.000Z");
  });
});
