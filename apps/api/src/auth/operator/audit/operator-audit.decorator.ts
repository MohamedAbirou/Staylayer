import { SetMetadata } from "@nestjs/common";

/**
 * Metadata key used by `OperatorAuditInterceptor` to look up audit metadata
 * for the current handler.
 */
export const OPERATOR_AUDIT_KEY = "operator:audit";

export interface OperatorAuditMetadata {
  /**
   * Stable machine-readable action identifier, e.g. `tenant.suspend`,
   * `billing.subscription.change_plan`. Used as the `action` column on the
   * `operator_audit_logs` table.
   */
  action: string;
  /**
   * Type of the primary target the action operates on, e.g. `tenant`,
   * `site`, `billing_account`. Used together with `targetIdParam` to
   * populate the `target_type` / `target_id` columns. Omit for actions that
   * have no single target.
   */
  targetType?: string;
  /**
   * Name of the route parameter (e.g. `id`, `tenantId`) that carries the
   * target id. If omitted the interceptor will attempt common parameter
   * names (`id`, `tenantId`, `siteId`, `caseId`, `subscriptionId`,
   * `invoiceId`).
   */
  targetIdParam?: string;
  /**
   * Marks the action as sensitive. Sensitive actions are required by policy
   * to capture a `reason` field in the request body and will fail audit
   * recording with a 400 if it is missing. Used for billing mutations,
   * refunds, suspensions, etc.
   */
  sensitive?: boolean;
}

/**
 * Declare audit metadata for an operator mutation. The
 * `OperatorAuditInterceptor` consumes this metadata to record a structured
 * audit row for every operator action.
 *
 * Read-only handlers do not need this decorator. Mutations that bypass
 * `@OperatorAudit` will be logged at WARN level by the interceptor so
 * regressions are obvious in production logs.
 */
export function OperatorAudit(
  metadata: OperatorAuditMetadata,
): ClassDecorator & MethodDecorator {
  return SetMetadata(OPERATOR_AUDIT_KEY, metadata);
}
