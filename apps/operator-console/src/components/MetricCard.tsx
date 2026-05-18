import type { ReactNode } from "react";

/**
 * `MetricCard` — single KPI tile used across analytics pages.
 *
 * Renders a label, primary value, optional delta line, optional sparkline,
 * and an optional intent badge. Pure presentational; receives ready-to-render
 * strings so callers can format currency/duration/percentages as needed.
 */
export function MetricCard({
  label,
  value,
  helper,
  delta,
  deltaTone = "neutral",
  intent = "default",
  icon,
  children,
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  delta?: ReactNode;
  deltaTone?: "neutral" | "positive" | "negative";
  intent?: "default" | "warn" | "critical" | "success";
  icon?: ReactNode;
  children?: ReactNode;
}) {
  const intentBorder =
    intent === "critical"
      ? "border-rose-900/60 bg-rose-950/40"
      : intent === "warn"
        ? "border-amber-900/60 bg-amber-950/30"
        : intent === "success"
          ? "border-emerald-900/60 bg-emerald-950/30"
          : "border-slate-800 bg-slate-900";
  const deltaColor =
    deltaTone === "positive"
      ? "text-emerald-400"
      : deltaTone === "negative"
        ? "text-rose-400"
        : "text-slate-400";

  return (
    <div
      className={`flex flex-col gap-2 rounded-2xl border p-4 shadow-sm ${intentBorder}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          {label}
        </span>
        {icon ? <span className="text-cyan-400">{icon}</span> : null}
      </div>
      <div className="text-2xl font-semibold text-white">{value}</div>
      {helper ? <div className="text-xs text-slate-400">{helper}</div> : null}
      {delta ? (
        <div className={`text-xs font-medium ${deltaColor}`}>{delta}</div>
      ) : null}
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}
