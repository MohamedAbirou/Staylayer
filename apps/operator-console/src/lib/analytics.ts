/**
 * Formatting helpers used across Phase 10 analytics pages.
 *
 * Kept in a dedicated file so the chart primitives stay format-agnostic.
 */

export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(
    value,
  );
}

export function formatPercent(
  value: number | null | undefined,
  options: { fromFraction?: boolean } = {},
): string {
  if (value == null || Number.isNaN(value)) return "—";
  const pct = options.fromFraction ? value * 100 : value;
  return `${pct.toFixed(pct < 10 ? 1 : 0)}%`;
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  if (ms < 3_600_000) {
    const minutes = Math.floor(ms / 60_000);
    const seconds = Math.round((ms % 60_000) / 1000);
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.round((ms % 3_600_000) / 60_000);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(minutes)) return "—";
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  if (minutes < 60) return `${minutes.toFixed(0)}m`;
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const days = Math.floor(minutes / 1440);
  const h = Math.round((minutes % 1440) / 60);
  return h > 0 ? `${days}d ${h}h` : `${days}d`;
}

export function formatCurrencyMinor(
  amountMinor: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (amountMinor == null || Number.isNaN(amountMinor)) return "—";
  const code = (currency ?? "usd").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(amountMinor / 100);
  } catch {
    return `${code} ${(amountMinor / 100).toFixed(0)}`;
  }
}

export const ANALYTICS_RANGE_OPTIONS: Array<{
  value: 7 | 30 | 90;
  label: string;
}> = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];
