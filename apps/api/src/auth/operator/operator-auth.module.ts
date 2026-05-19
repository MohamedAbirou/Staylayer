import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { PrismaModule } from "../../prisma/prisma.module";
import { UsersModule } from "../../users/users.module";
import { OperatorAuthController } from "./operator-auth.controller";
import { OperatorAuthService } from "./operator-auth.service";
import { OperatorJwtAuthGuard } from "./guards/operator-jwt-auth.guard";
import { OperatorJwtStrategy } from "./operator-jwt.strategy";
import { OperatorPermissionGuard } from "./permissions/operator-permission.guard";
import { OperatorAuditService } from "./audit/operator-audit.service";
import { OperatorAuditInterceptor } from "./audit/operator-audit.interceptor";
import { OperatorRefreshSessionCleanupService } from "./operator-refresh-session-cleanup.service";

/**
 * Operator auth + RBAC + audit module.
 *
 * Exports:
 *  - `OperatorAuthService` — login/refresh/logout/session helpers.
 *  - `OperatorJwtStrategy` / `OperatorJwtAuthGuard` — operator-only JWT auth.
 *  - `OperatorPermissionGuard` — granular `resource.action.scope` checks.
 *  - `OperatorAuditService` / `OperatorAuditInterceptor` — audit pipeline
 *    for every operator mutation.
 *
 * Customer and operator surfaces remain isolated:
 *  - Different controller prefix (`/operator/auth/*`).
 *  - Different passport strategy name (`operator-jwt`).
 *  - Different JWT audience/issuer claims.
 *  - Different refresh cookie name and path.
 *  - Independent server-side session table (`OperatorRefreshSession`).
 */
@Module({
  imports: [PassportModule, UsersModule, PrismaModule],
  controllers: [OperatorAuthController],
  providers: [
    OperatorAuthService,
    OperatorJwtStrategy,
    OperatorJwtAuthGuard,
    OperatorPermissionGuard,
    OperatorAuditService,
    OperatorAuditInterceptor,
    OperatorRefreshSessionCleanupService,
  ],
  exports: [
    OperatorAuthService,
    OperatorJwtStrategy,
    OperatorJwtAuthGuard,
    OperatorPermissionGuard,
    OperatorAuditService,
    OperatorAuditInterceptor,
  ],
})
export class OperatorAuthModule {}
