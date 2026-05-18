import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useCan } from "./useCan";

export interface PermissionButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "disabled" | "title"
> {
  /** Permission key that gates this action. */
  permission: string;
  /** When provided, overrides the auto-generated denial title. */
  deniedTitle?: string;
  /** When provided, this disables the button irrespective of permissions. */
  disabled?: boolean;
  /** Optional title shown when the button is enabled. */
  title?: string;
  children?: ReactNode;
}

/**
 * `<button>` wrapper that disables itself and surfaces an informative
 * tooltip when the current operator lacks `permission`. The DOM event
 * handlers are intentionally not invoked when access is denied so accidental
 * keyboard clicks cannot fire mutations.
 *
 * Backend remains the only authority — disabling here is a UX nicety, not a
 * security boundary.
 */
export function PermissionButton({
  permission,
  deniedTitle,
  disabled,
  title,
  onClick,
  ...rest
}: PermissionButtonProps) {
  const allowed = useCan(permission);
  const isDisabled = !allowed || Boolean(disabled);
  const effectiveTitle = !allowed
    ? (deniedTitle ?? `Requires permission: ${permission}`)
    : title;

  return (
    <button
      {...rest}
      disabled={isDisabled}
      aria-disabled={isDisabled || undefined}
      title={effectiveTitle}
      data-permission-denied={!allowed || undefined}
      onClick={!allowed ? undefined : onClick}
    />
  );
}
