/**
 * Pure helpers for the Phase E.4 audit-task workflow. Kept side-effect-free
 * so the bulk-update logic is exercised directly by unit tests.
 */

import type {
  OperationalAlertSeverity,
  SeoAuditTaskPriority,
  SeoAuditTaskStatus,
} from "@prisma/client";

export type BulkAuditTaskAction =
  | { kind: "ASSIGN"; assigneeUserId: string | null }
  | { kind: "STATUS"; status: SeoAuditTaskStatus }
  | { kind: "PRIORITY"; priority: SeoAuditTaskPriority }
  | { kind: "DELETE" };

export interface BulkAuditTaskPayload {
  taskIds: string[];
  action: BulkAuditTaskAction;
}

/**
 * Map an `OperationalAlertSeverity` (WARNING|CRITICAL) to the corresponding
 * `SeoAuditTaskPriority`. CRITICAL alerts become CRITICAL tasks; WARNING
 * alerts become HIGH so they stay visually distinct from manually-created
 * MEDIUM/LOW work.
 */
export function alertSeverityToPriority(
  severity: OperationalAlertSeverity,
): SeoAuditTaskPriority {
  return severity === "CRITICAL" ? "CRITICAL" : "HIGH";
}

/**
 * Build the per-task patch a bulk action produces. Returning a plain object
 * lets the service layer apply it via a single `updateMany` (DELETE handled
 * separately by the caller).
 */
export function buildBulkPatch(
  action: BulkAuditTaskAction,
  now: Date = new Date(),
): Record<string, unknown> | null {
  switch (action.kind) {
    case "ASSIGN":
      return { assigneeUserId: action.assigneeUserId };
    case "STATUS":
      return {
        status: action.status,
        resolvedAt:
          action.status === "RESOLVED" || action.status === "DISMISSED"
            ? now
            : null,
      };
    case "PRIORITY":
      return { priority: action.priority };
    case "DELETE":
      return null;
  }
}

/** Bound list/bulk operations to keep accidental fanout in check. */
export const MAX_BULK_TASK_IDS = 200;
export const MAX_TASKS_PER_PAGE = 100;

export function clampLimit(
  value: unknown,
  max: number,
  fallback: number,
): number {
  const n =
    typeof value === "number"
      ? value
      : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return Math.min(fallback, max);
  return Math.max(1, Math.min(max, Math.trunc(n)));
}
