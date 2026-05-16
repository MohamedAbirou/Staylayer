import {
  alertSeverityToPriority,
  buildBulkPatch,
  clampLimit,
  MAX_BULK_TASK_IDS,
  MAX_TASKS_PER_PAGE,
} from "./audit-tasks.helpers";

describe("audit-tasks.helpers", () => {
  describe("alertSeverityToPriority", () => {
    it("maps CRITICAL severity to CRITICAL priority", () => {
      expect(alertSeverityToPriority("CRITICAL")).toBe("CRITICAL");
    });

    it("maps WARNING severity to HIGH priority", () => {
      expect(alertSeverityToPriority("WARNING")).toBe("HIGH");
    });
  });

  describe("buildBulkPatch", () => {
    const now = new Date("2026-05-16T12:00:00Z");

    it("returns assigneeUserId patch for ASSIGN", () => {
      expect(
        buildBulkPatch({ kind: "ASSIGN", assigneeUserId: "user_1" }, now),
      ).toEqual({ assigneeUserId: "user_1" });
    });

    it("supports unassign via null", () => {
      expect(
        buildBulkPatch({ kind: "ASSIGN", assigneeUserId: null }, now),
      ).toEqual({ assigneeUserId: null });
    });

    it("returns status + resolvedAt=now for STATUS=RESOLVED", () => {
      expect(
        buildBulkPatch({ kind: "STATUS", status: "RESOLVED" }, now),
      ).toEqual({ status: "RESOLVED", resolvedAt: now });
    });

    it("returns status + resolvedAt=now for STATUS=DISMISSED", () => {
      expect(
        buildBulkPatch({ kind: "STATUS", status: "DISMISSED" }, now),
      ).toEqual({ status: "DISMISSED", resolvedAt: now });
    });

    it("clears resolvedAt when status reopens", () => {
      expect(buildBulkPatch({ kind: "STATUS", status: "OPEN" }, now)).toEqual({
        status: "OPEN",
        resolvedAt: null,
      });
      expect(
        buildBulkPatch({ kind: "STATUS", status: "IN_PROGRESS" }, now),
      ).toEqual({ status: "IN_PROGRESS", resolvedAt: null });
    });

    it("returns priority patch for PRIORITY", () => {
      expect(
        buildBulkPatch({ kind: "PRIORITY", priority: "LOW" }, now),
      ).toEqual({
        priority: "LOW",
      });
    });

    it("returns null for DELETE (caller dispatches deleteMany)", () => {
      expect(buildBulkPatch({ kind: "DELETE" }, now)).toBeNull();
    });
  });

  describe("clampLimit", () => {
    it("returns fallback for missing/non-numeric input", () => {
      expect(clampLimit(undefined, 100, 25)).toBe(25);
      expect(clampLimit("abc", 100, 25)).toBe(25);
    });

    it("caps at max", () => {
      expect(clampLimit(9999, 100, 25)).toBe(100);
    });

    it("rejects values below 1", () => {
      expect(clampLimit(0, 100, 25)).toBe(1);
      expect(clampLimit(-5, 100, 25)).toBe(1);
    });

    it("passes through valid values", () => {
      expect(clampLimit(50, 100, 25)).toBe(50);
    });
  });

  it("exposes sane constants", () => {
    expect(MAX_BULK_TASK_IDS).toBe(200);
    expect(MAX_TASKS_PER_PAGE).toBe(100);
  });
});
