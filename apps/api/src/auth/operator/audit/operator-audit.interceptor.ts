import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { createHash } from "crypto";
import type { Request, Response } from "express";
import { Observable, tap } from "rxjs";
import {
  ensureRequestId,
  type RequestWithContext,
} from "../../../common/request-context";
import {
  OPERATOR_AUDIT_KEY,
  type OperatorAuditMetadata,
} from "./operator-audit.decorator";
import { OperatorAuditService } from "./operator-audit.service";
import { REQUIRE_OPERATOR_PERMISSIONS_KEY } from "../permissions/require-operator-permissions.decorator";
import type { OperatorPermissionKey } from "../permissions/operator-permissions.registry";
import {
  OPERATOR_JWT_AUDIENCE,
  type OperatorAuthenticatedRequestUser,
} from "../operator-auth.types";

const TARGET_ID_PARAM_FALLBACKS = [
  "id",
  "tenantId",
  "siteId",
  "caseId",
  "subscriptionId",
  "invoiceId",
  "accountId",
  "operatorUserId",
];

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Attaches structured audit context to every operator request and writes a
 * persistent audit row for declared operator mutations.
 *
 * Behaviour:
 *  - Always attaches `requestId`, actor user id, platform role, and the
 *    declared permission keys to the per-request context so the
 *    `LoggingInterceptor` includes them in HTTP completion logs.
 *  - For handlers decorated with `@OperatorAudit({...})`, writes a row to
 *    `operator_audit_logs` after a successful (2xx) response.
 *  - For handlers marked `sensitive`, requires a non-empty `reason` field in
 *    the request body and rejects the call with 400 if absent. This is the
 *    backend half of the "billing actions require stronger confirmation and
 *    reason capture" invariant.
 *  - Mutation handlers (POST/PUT/PATCH/DELETE) on the operator surface that
 *    omit `@OperatorAudit` are logged at WARN level so the regression is
 *    visible.
 *
 * Writes are best-effort — see `OperatorAuditService.record`.
 */
@Injectable()
export class OperatorAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(OperatorAuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: OperatorAuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithContext>();
    const response = http.getResponse<Response>();
    const path = request.originalUrl ?? request.url ?? "";

    // Only run audit logic for operator-prefixed routes. This keeps the
    // interceptor cheap if a future deployment wires it globally.
    if (!path.startsWith("/operator")) {
      return next.handle();
    }

    const user = request.user as OperatorAuthenticatedRequestUser | undefined;
    const requestId = ensureRequestId(request, response);

    const auditMeta = this.reflector.getAllAndOverride<
      OperatorAuditMetadata | undefined
    >(OPERATOR_AUDIT_KEY, [context.getHandler(), context.getClass()]);

    const requiredPermissions = this.reflector.getAllAndOverride<
      OperatorPermissionKey[] | undefined
    >(REQUIRE_OPERATOR_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Sensitive actions require a reason in the body. Validate BEFORE
    // executing the handler so we never partially mutate state.
    let reason: string | null = null;
    if (auditMeta?.sensitive) {
      reason = this.extractReason(request);
      if (!reason) {
        throw new BadRequestException({
          code: "OPERATOR_REASON_REQUIRED",
          message:
            "A non-empty `reason` is required for this sensitive operator action.",
        });
      }
    } else if (auditMeta) {
      reason = this.extractReason(request);
    }

    // Stash structured context on the request so LoggingInterceptor can pick
    // it up. We avoid leaking PII into logs (raw email, IP, UA).
    (request as RequestWithContext).user = {
      ...(request.user as object | undefined),
      ...(user
        ? {
            id: user.id,
            sub: user.id,
            platformRole: user.platformRole,
          }
        : {}),
    } as RequestWithContext["user"];

    const startedAt = Date.now();
    const isMutation = MUTATION_METHODS.has(request.method);

    return next.handle().pipe(
      tap({
        next: () => {
          const statusCode = response.statusCode ?? 200;
          if (auditMeta && user && statusCode < 400) {
            void this.auditService.record({
              requestId,
              actorUserId: user.id,
              platformRole: user.platformRole,
              action: auditMeta.action,
              permissionKeys: requiredPermissions ?? [],
              targetType: auditMeta.targetType ?? null,
              targetId: this.resolveTargetId(request, auditMeta),
              tenantId: this.resolveScopedId(request, ["tenantId"]),
              siteId: this.resolveScopedId(request, ["siteId"]),
              method: request.method,
              path,
              statusCode,
              durationMs: Date.now() - startedAt,
              sensitive: Boolean(auditMeta.sensitive),
              reason,
              ipHash: this.hash(request.ip ?? null),
              userAgentHash: this.hash(request.get("user-agent") ?? null),
              metadata: null,
            });
          } else if (
            isMutation &&
            user?.aud === OPERATOR_JWT_AUDIENCE &&
            !auditMeta
          ) {
            this.logger.warn(
              JSON.stringify({
                event: "operator_mutation_missing_audit_metadata",
                requestId,
                actorUserId: user.id,
                method: request.method,
                path,
              }),
            );
          }
        },
        error: (err: unknown) => {
          // Failures are not written to the audit table (we only audit
          // successful actor decisions) but we emit a structured log line
          // so denied or failed sensitive actions are still observable.
          if (auditMeta && user) {
            const status =
              (err as { status?: number; getStatus?: () => number })?.status ??
              (err as { getStatus?: () => number })?.getStatus?.() ??
              500;
            this.logger.warn(
              JSON.stringify({
                event: "operator_action_failed",
                requestId,
                action: auditMeta.action,
                actorUserId: user.id,
                statusCode: status,
                durationMs: Date.now() - startedAt,
              }),
            );
          }
        },
      }),
    );
  }

  private resolveTargetId(
    request: Request,
    meta: OperatorAuditMetadata,
  ): string | null {
    const params = (request.params ?? {}) as Record<string, string>;
    if (meta.targetIdParam && params[meta.targetIdParam]) {
      return params[meta.targetIdParam];
    }
    for (const candidate of TARGET_ID_PARAM_FALLBACKS) {
      if (params[candidate]) return params[candidate];
    }
    return null;
  }

  private resolveScopedId(
    request: Request,
    keys: ReadonlyArray<string>,
  ): string | null {
    const params = (request.params ?? {}) as Record<string, string>;
    const query = (request.query ?? {}) as Record<string, unknown>;
    const body = (request.body ?? {}) as Record<string, unknown>;
    for (const k of keys) {
      if (typeof params[k] === "string" && params[k]) return params[k];
      const q = query[k];
      if (typeof q === "string" && q) return q;
      const b = body[k];
      if (typeof b === "string" && b) return b;
    }
    return null;
  }

  private extractReason(request: Request): string | null {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const raw = body.reason;
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > 2000) return trimmed.slice(0, 2000);
    return trimmed;
  }

  private hash(value: string | null): string | null {
    if (!value) return null;
    return createHash("sha256").update(value).digest("hex").slice(0, 32);
  }
}
