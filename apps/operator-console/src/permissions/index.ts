// Public surface of the operator console permission layer. Import from
// `~/permissions` rather than reaching into individual files.

export {
  OPERATOR_PERMISSIONS,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
} from "./registry";
export type { OperatorPermissionKey } from "./registry";
export { OperatorPermissionContext } from "./PermissionContext";
export type { OperatorPermissionContextValue } from "./PermissionContext";
export { PermissionProvider } from "./PermissionProvider";
export { useCan, useCanAll, useCanAny, usePermissions } from "./useCan";
export { RequireOperatorPermission } from "./RequireOperatorPermission";
export type { RequireOperatorPermissionProps } from "./RequireOperatorPermission";
export { PermissionRoute } from "./PermissionRoute";
export { PermissionButton } from "./PermissionButton";
export type { PermissionButtonProps } from "./PermissionButton";
