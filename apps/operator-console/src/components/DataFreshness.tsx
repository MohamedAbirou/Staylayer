import { useEffect, useState } from "react";

/**
 * Renders a small "Updated Xs ago" indicator for cached data freshness.
 * Refreshes every 15s so operators can tell at a glance whether a panel is
 * stale. Pure presentational; safe to render inside long-lived pages.
 */
export function DataFreshness({
  generatedAt,
  className,
}: {
  generatedAt: string | null | undefined;
  className?: string;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 15_000);
    return () => window.clearInterval(id);
  }, []);

  if (!generatedAt) return null;
  const generated = new Date(generatedAt).getTime();
  if (Number.isNaN(generated)) return null;
  const seconds = Math.max(0, Math.floor((Date.now() - generated) / 1000));
  return (
    <span
      className={[
        "inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-widest text-slate-500",
        className ?? "",
      ].join(" ")}
      title={new Date(generatedAt).toLocaleString()}
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-500"
      />
      Updated {formatRelative(seconds)}
    </span>
  );
}

function formatRelative(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
