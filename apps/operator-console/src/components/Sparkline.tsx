/**
 * `Sparkline` — minimalist inline SVG line chart for time series rendering.
 *
 * Renders a smoothed area beneath a 1px stroke. No tooltips, no axes —
 * intended for `MetricCard` accents. Empty / single-point datasets render
 * a flat baseline so the parent layout never shifts.
 */
export function Sparkline({
  values,
  width = 120,
  height = 32,
  stroke = "#06b6d4",
  fill = "rgba(6, 182, 212, 0.15)",
  className,
  ariaLabel,
}: {
  values: ReadonlyArray<number>;
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  className?: string;
  ariaLabel?: string;
}) {
  if (values.length === 0) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className={className}
        role="img"
        aria-label={ariaLabel ?? "no data"}
      >
        <line
          x1={0}
          y1={height - 1}
          x2={width}
          y2={height - 1}
          stroke="#334155"
          strokeWidth={1}
        />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : width;

  const points = values
    .map((value, index) => {
      const x = index * stepX;
      const y = height - ((value - min) / range) * (height - 2) - 1;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const areaPath = `M 0,${height} L ${values
    .map((value, index) => {
      const x = index * stepX;
      const y = height - ((value - min) / range) * (height - 2) - 1;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" L ")} L ${width.toFixed(2)},${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={ariaLabel ?? "sparkline"}
    >
      <path d={areaPath} fill={fill} stroke="none" />
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
