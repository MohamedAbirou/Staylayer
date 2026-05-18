/**
 * Skeleton placeholder for loading states. Uses pulse animation; consumers
 * pass width/height via className.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={[
        "animate-pulse rounded-md bg-slate-800/70",
        className ?? "h-4 w-24",
      ].join(" ")}
    />
  );
}
