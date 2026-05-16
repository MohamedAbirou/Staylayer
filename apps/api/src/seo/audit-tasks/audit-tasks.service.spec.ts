import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { PrismaService } from "../../prisma/prisma.service";
import { SeoAuditTasksService } from "./audit-tasks.service";

interface TaskRow {
  id: string;
  siteId: string;
  sourceAlertId: string | null;
  source: "ALERT" | "MANUAL";
  slug: string;
  locale: string;
  title: string;
  description: string | null;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  assigneeUserId: string | null;
  createdByUserId: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function buildPrismaMock() {
  const tasks = new Map<string, TaskRow>();
  const sites = new Map<string, { tenantId: string }>([
    ["site-1", { tenantId: "tenant-1" }],
    ["site-2", { tenantId: "tenant-2" }],
  ]);
  const memberships = new Map<
    string,
    { id: string; role: string; user: { id: string; email: string } }
  >();
  // tenant-1 has users U1 + U2; tenant-2 has user U3
  memberships.set("tenant-1|user-1", {
    id: "m1",
    role: "OWNER",
    user: { id: "user-1", email: "owner@t1" },
  });
  memberships.set("tenant-1|user-2", {
    id: "m2",
    role: "EDITOR",
    user: { id: "user-2", email: "editor@t1" },
  });
  memberships.set("tenant-2|user-3", {
    id: "m3",
    role: "ADMIN",
    user: { id: "user-3", email: "admin@t2" },
  });

  let nextId = 1;

  const matches = (row: TaskRow, where: Record<string, any>): boolean => {
    if (where.siteId && row.siteId !== where.siteId) return false;
    if (where.id) {
      if (typeof where.id === "string" && row.id !== where.id) return false;
      if (where.id?.in && !where.id.in.includes(row.id)) return false;
    }
    if (where.status) {
      if (typeof where.status === "string" && row.status !== where.status)
        return false;
      if (where.status?.in && !where.status.in.includes(row.status))
        return false;
      if (where.status?.not && row.status === where.status.not) return false;
    }
    if (where.priority && row.priority !== where.priority) return false;
    if (where.assigneeUserId !== undefined) {
      if (where.assigneeUserId === null && row.assigneeUserId !== null)
        return false;
      if (
        typeof where.assigneeUserId === "string" &&
        row.assigneeUserId !== where.assigneeUserId
      )
        return false;
    }
    if (where.slug && row.slug !== where.slug) return false;
    if (where.locale && row.locale !== where.locale) return false;
    if (where.sourceAlertId && row.sourceAlertId !== where.sourceAlertId)
      return false;
    return true;
  };

  return {
    tasks,
    sites,
    memberships,
    site: {
      findUnique: jest.fn(async ({ where }: any) => {
        const s = sites.get(where.id);
        return s ? { tenantId: s.tenantId } : null;
      }),
    },
    tenantMembership: {
      findUnique: jest.fn(async ({ where }: any) => {
        const key = `${where.tenantId_userId.tenantId}|${where.tenantId_userId.userId}`;
        return memberships.get(key) ?? null;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        return Array.from(memberships.values()).filter((m) => {
          // we don't track tenantId on the value, derive from key
          return Array.from(memberships.entries()).some(
            ([k, v]) => v === m && k.startsWith(`${where.tenantId}|`),
          );
        });
      }),
    },
    seoAuditTask: {
      create: jest.fn(async ({ data }: any) => {
        const id = `task-${nextId++}`;
        const row: TaskRow = {
          id,
          siteId: data.siteId,
          sourceAlertId: data.sourceAlertId ?? null,
          source: data.source ?? "MANUAL",
          slug: data.slug,
          locale: data.locale,
          title: data.title,
          description: data.description ?? null,
          status: data.status ?? "OPEN",
          priority: data.priority ?? "MEDIUM",
          assigneeUserId: data.assigneeUserId ?? null,
          createdByUserId: data.createdByUserId ?? null,
          resolvedAt: data.resolvedAt ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        tasks.set(id, row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = tasks.get(where.id);
        if (!row) throw new Error("not found");
        // Apply scalar fields
        for (const [k, v] of Object.entries(data)) {
          if (k === "assignee") {
            const rel = v as any;
            row.assigneeUserId =
              rel?.connect?.id ?? (rel?.disconnect ? null : row.assigneeUserId);
          } else {
            (row as any)[k] = v;
          }
        }
        row.updatedAt = new Date();
        return row;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const row of tasks.values()) {
          if (matches(row, where)) {
            for (const [k, v] of Object.entries(data)) {
              (row as any)[k] = v;
            }
            count += 1;
          }
        }
        return { count };
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        let count = 0;
        for (const [id, row] of Array.from(tasks.entries())) {
          if (matches(row, where)) {
            tasks.delete(id);
            count += 1;
          }
        }
        return { count };
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.sourceAlertId) {
          return (
            Array.from(tasks.values()).find(
              (t) => t.sourceAlertId === where.sourceAlertId,
            ) ?? null
          );
        }
        return tasks.get(where.id) ?? null;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          Array.from(tasks.values()).find((row) => matches(row, where)) ?? null
        );
      }),
      findMany: jest.fn(async ({ where, take }: any) => {
        const rows = Array.from(tasks.values()).filter((row) =>
          matches(row, where),
        );
        return take ? rows.slice(0, take) : rows;
      }),
      count: jest.fn(async ({ where }: any) => {
        return Array.from(tasks.values()).filter((row) => matches(row, where))
          .length;
      }),
      groupBy: jest.fn(async ({ where }: any) => {
        const grouped: Record<string, number> = {};
        for (const row of tasks.values()) {
          if (matches(row, where))
            grouped[row.status] = (grouped[row.status] ?? 0) + 1;
        }
        return Object.entries(grouped).map(([status, count]) => ({
          status,
          _count: { _all: count },
        }));
      }),
    },
  };
}

describe("SeoAuditTasksService", () => {
  let service: SeoAuditTasksService;
  let prismaMock: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prismaMock = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        SeoAuditTasksService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = moduleRef.get(SeoAuditTasksService);
  });

  describe("createTask", () => {
    it("creates a MANUAL task with sensible defaults", async () => {
      const task = await service.createTask("site-1", "user-1", {
        slug: "/landing",
        locale: "en",
        title: "Investigate CWV regression",
      });
      expect(task.source).toBe("MANUAL");
      expect(task.priority).toBe("MEDIUM");
      expect(task.status).toBe("OPEN");
      expect(task.createdByUserId).toBe("user-1");
    });

    it("rejects an assignee that is not in the site's tenant", async () => {
      await expect(
        service.createTask("site-1", "user-1", {
          slug: "/a",
          locale: "en",
          title: "x",
          assigneeUserId: "user-3", // belongs to tenant-2
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("accepts an assignee that is in the site's tenant", async () => {
      const task = await service.createTask("site-1", "user-1", {
        slug: "/a",
        locale: "en",
        title: "x",
        assigneeUserId: "user-2",
      });
      expect(task.assigneeUserId).toBe("user-2");
    });

    it("requires title/slug/locale", async () => {
      await expect(
        service.createTask("site-1", "user-1", {
          slug: "",
          locale: "en",
          title: "x",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.createTask("site-1", "user-1", {
          slug: "/a",
          locale: "",
          title: "x",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.createTask("site-1", "user-1", {
          slug: "/a",
          locale: "en",
          title: "  ",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("updateTask", () => {
    it("404s when task is not in the requested site", async () => {
      const t = await service.createTask("site-1", "user-1", {
        slug: "/a",
        locale: "en",
        title: "x",
      });
      await expect(
        service.updateTask("site-2", t.id, { status: "RESOLVED" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("sets resolvedAt when status becomes RESOLVED, clears on reopen", async () => {
      const t = await service.createTask("site-1", "user-1", {
        slug: "/a",
        locale: "en",
        title: "x",
      });
      const resolved = await service.updateTask("site-1", t.id, {
        status: "RESOLVED",
      });
      expect(resolved.status).toBe("RESOLVED");
      expect(resolved.resolvedAt).toBeInstanceOf(Date);

      const reopened = await service.updateTask("site-1", t.id, {
        status: "OPEN",
      });
      expect(reopened.status).toBe("OPEN");
      expect(reopened.resolvedAt).toBeNull();
    });

    it("rejects out-of-tenant assignee on update", async () => {
      const t = await service.createTask("site-1", "user-1", {
        slug: "/a",
        locale: "en",
        title: "x",
      });
      await expect(
        service.updateTask("site-1", t.id, { assigneeUserId: "user-3" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("bulkUpdate", () => {
    it("applies STATUS to every targeted task within the site only", async () => {
      const a = await service.createTask("site-1", "user-1", {
        slug: "/a",
        locale: "en",
        title: "A",
      });
      const b = await service.createTask("site-1", "user-1", {
        slug: "/b",
        locale: "en",
        title: "B",
      });
      const c = await service.createTask("site-2", "user-3", {
        slug: "/c",
        locale: "en",
        title: "C",
      });

      const res = await service.bulkUpdate("site-1", {
        taskIds: [a.id, b.id, c.id],
        action: { kind: "STATUS", status: "RESOLVED" },
      });
      expect(res.matched).toBe(2);
      expect(res.affected).toBe(2);
      expect(prismaMock.tasks.get(c.id)?.status).toBe("OPEN");
      expect(prismaMock.tasks.get(a.id)?.status).toBe("RESOLVED");
      expect(prismaMock.tasks.get(a.id)?.resolvedAt).toBeInstanceOf(Date);
    });

    it("DELETE removes tasks scoped to the site", async () => {
      const a = await service.createTask("site-1", "user-1", {
        slug: "/a",
        locale: "en",
        title: "A",
      });
      const c = await service.createTask("site-2", "user-3", {
        slug: "/c",
        locale: "en",
        title: "C",
      });
      const res = await service.bulkUpdate("site-1", {
        taskIds: [a.id, c.id],
        action: { kind: "DELETE" },
      });
      expect(res.affected).toBe(1);
      expect(prismaMock.tasks.has(a.id)).toBe(false);
      expect(prismaMock.tasks.has(c.id)).toBe(true);
    });

    it("ASSIGN validates assignee tenant before writing", async () => {
      const a = await service.createTask("site-1", "user-1", {
        slug: "/a",
        locale: "en",
        title: "A",
      });
      await expect(
        service.bulkUpdate("site-1", {
          taskIds: [a.id],
          action: { kind: "ASSIGN", assigneeUserId: "user-3" },
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("rejects empty / too-large id sets", async () => {
      await expect(
        service.bulkUpdate("site-1", {
          taskIds: [],
          action: { kind: "DELETE" },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      const ids = Array.from({ length: 201 }, (_, i) => `t-${i}`);
      await expect(
        service.bulkUpdate("site-1", {
          taskIds: ids,
          action: { kind: "DELETE" },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("upsertTaskForAlert", () => {
    it("creates a task from an alert (idempotent)", async () => {
      const alert = {
        id: "alert-1",
        siteId: "site-1",
        severity: "WARNING" as const,
        message: "Score dropped on /home",
        metadata: { slug: "/home", locale: "en", reason: "SCORE_DROP" },
      };
      const first = await service.upsertTaskForAlert(alert);
      const second = await service.upsertTaskForAlert(alert);
      expect(first.id).toBe(second.id);
      expect(prismaMock.tasks.size).toBe(1);
      expect(first.priority).toBe("HIGH");
      expect(first.source).toBe("ALERT");
    });

    it("reopens an auto-resolved task when the alert fires again", async () => {
      const alert = {
        id: "alert-2",
        siteId: "site-1",
        severity: "CRITICAL" as const,
        message: "Critical regression",
        metadata: { slug: "/home", locale: "en", reason: "MISSING_SCHEMA" },
      };
      const t = await service.upsertTaskForAlert(alert);
      // user resolved it
      await service.updateTask("site-1", t.id, { status: "RESOLVED" });
      // alert re-fires
      const refreshed = await service.upsertTaskForAlert(alert);
      expect(refreshed.id).toBe(t.id);
      expect(refreshed.status).toBe("OPEN");
      expect(refreshed.resolvedAt).toBeNull();
      expect(refreshed.priority).toBe("CRITICAL");
    });
  });

  describe("listAssignees / getSummary", () => {
    it("listAssignees only returns members of the site tenant", async () => {
      const out = await service.listAssignees("site-1");
      const ids = out.map((u) => u.userId).sort();
      expect(ids).toEqual(["user-1", "user-2"]);
    });

    it("getSummary aggregates statuses + unassigned + critical-open", async () => {
      await service.createTask("site-1", "user-1", {
        slug: "/a",
        locale: "en",
        title: "A",
        priority: "CRITICAL",
      });
      const b = await service.createTask("site-1", "user-1", {
        slug: "/b",
        locale: "en",
        title: "B",
        assigneeUserId: "user-2",
      });
      await service.updateTask("site-1", b.id, { status: "RESOLVED" });

      const s = await service.getSummary("site-1");
      expect(s.total).toBe(2);
      expect(s.open).toBe(1);
      expect(s.resolved).toBe(1);
      expect(s.unassigned).toBe(1);
      expect(s.criticalOpen).toBe(1);
    });
  });
});
