import type { ReactNode } from "react";
import { useCan, useCanAll, useCanAny } from "./useCan";

interface BaseProps {
  /** Rendered when the operator holds the required permission(s). */
  children: ReactNode;
  /** Optional fallback rendered when access is denied. Defaults to `null`. */
  fallback?: ReactNode;
}

interface SingleProps extends BaseProps {
  permission: string;
  anyOf?: never;
  allOf?: never;
}

interface AnyProps extends BaseProps {
  permission?: never;
  anyOf: readonly string[];
  allOf?: never;
}

interface AllProps extends BaseProps {
  permission?: never;
  anyOf?: never;
  allOf: readonly string[];
}

export type RequireOperatorPermissionProps = SingleProps | AnyProps | AllProps;

/**
 * Conditionally renders children when the operator session carries the
 * required permission(s). UI gating only — the API is the only authority
 * that grants or denies the underlying actions.
 *
 * Exactly one of `permission`, `anyOf`, or `allOf` must be provided.
 */
export function RequireOperatorPermission(
  props: RequireOperatorPermissionProps,
) {
  const fallback = props.fallback ?? null;

  // Important: we call all three hooks unconditionally to respect React
  // hook rules. Each receives a stable empty array when not in use.
  const singleKey =
    "permission" in props && props.permission ? props.permission : "";
  const anyKeys = "anyOf" in props && props.anyOf ? props.anyOf : EMPTY;
  const allKeys = "allOf" in props && props.allOf ? props.allOf : EMPTY;

  const okSingle = useCan(singleKey || "__never__");
  const okAny = useCanAny(anyKeys);
  const okAll = useCanAll(allKeys);

  let allowed: boolean;
  if ("permission" in props && props.permission) {
    allowed = okSingle;
  } else if ("anyOf" in props && props.anyOf) {
    allowed = okAny;
  } else if ("allOf" in props && props.allOf) {
    allowed = okAll;
  } else {
    allowed = false;
  }

  return <>{allowed ? props.children : fallback}</>;
}

const EMPTY: readonly string[] = Object.freeze([]);
