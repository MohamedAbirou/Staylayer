import type { ReactNode } from "react";

/**
 * Inline empty-state slot. Used by tables and queues so the operator
 * always sees an explicit "no data" message rather than an ambiguous blank
 * area.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-800 bg-slate-950/50 px-6 py-10 text-center">
      {icon ? <div className="text-slate-500">{icon}</div> : null}
      <p className="text-sm font-medium text-slate-200">{title}</p>
      {description ? (
        <p className="max-w-md text-xs text-slate-500">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
