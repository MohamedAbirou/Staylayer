import { SetMetadata } from "@nestjs/common";
import type { OperatorPermissionKey } from "./operator-permissions.registry";

/**
 * Metadata key used by `OperatorPermissionGuard` to read the required
 * permission set off a handler or controller class.
 */
export const REQUIRE_OPERATOR_PERMISSIONS_KEY = "operator:permissions:require";

/**
 * Decorator that declares the granular operator permissions required to
 * execute the decorated route. ALL listed permissions must be satisfied —
 * use multiple decorators or compose helper bundles if you need OR-of-sets
 * semantics.
 *
 * Usage:
 * ```ts
 * @UseGuards(OperatorJwtAuthGuard, OperatorPermissionGuard)
 * @RequireOperatorPermissions(OPERATOR_PERMISSIONS.TENANT_SUSPEND_ALL)
 * @Post(":id/suspend")
 * async suspend(...) { ... }
 * ```
 *
 * SECURITY: this decorator alone does NOT enforce anything. It MUST be paired
 * with `OperatorPermissionGuard` (which itself depends on
 * `OperatorJwtAuthGuard` having populated `req.user`).
 */
export function RequireOperatorPermissions(
  ...permissions: OperatorPermissionKey[]
): ClassDecorator & MethodDecorator {
  if (permissions.length === 0) {
    throw new Error(
      "@RequireOperatorPermissions called with no permissions. Pass at least one OperatorPermissionKey.",
    );
  }
  return SetMetadata(REQUIRE_OPERATOR_PERMISSIONS_KEY, permissions);
}
