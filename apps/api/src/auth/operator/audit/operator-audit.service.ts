import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";

export interface OperatorAuditRecord {
  requestId: string;
  actorUserId: string;
  platformRole: string;
  action: string;
  permissionKeys: string[];
  targetType: string | null;
  targetId: string | null;
  tenantId: string | null;
  siteId: string | null;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  sensitive: boolean;
  reason: string | null;
  ipHash: string | null;
  userAgentHash: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Writes mutation audit rows to the `operator_audit_logs` table. Failures
 * are swallowed and logged at ERROR level — an operator action MUST NOT be
 * blocked by an audit-store outage, but the gap will be visible in logs
 * and surfaced via a future health check.
 */
@Injectable()
export class OperatorAuditService {
  private readonly logger = new Logger(OperatorAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: OperatorAuditRecord): Promise<void> {
    try {
      await this.prisma.operatorAuditLog.create({
        data: {
          requestId: entry.requestId,
          actorUserId: entry.actorUserId,
          platformRole: entry.platformRole,
          action: entry.action,
          permissionKeys: entry.permissionKeys,
          targetType: entry.targetType,
          targetId: entry.targetId,
          tenantId: entry.tenantId,
          siteId: entry.siteId,
          method: entry.method,
          path: entry.path,
          statusCode: entry.statusCode,
          durationMs: entry.durationMs,
          sensitive: entry.sensitive,
          reason: entry.reason,
          ipHash: entry.ipHash,
          userAgentHash: entry.userAgentHash,
          metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.error(
        JSON.stringify({
          event: "operator_audit_write_failed",
          requestId: entry.requestId,
          action: entry.action,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
