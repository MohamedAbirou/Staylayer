/**
 * `BarChart` — inline SVG bar chart for stacked or simple categorical data.
 *
 * Renders vertical bars for each data point. Up to two series can be drawn,
 * with the second stacked behind the first using a translucent fill. Used
 * by analytics pages for deployment success/failure, submission volume, etc.
 */
export interface BarChartSeries {
  label: string;
  color: string;
  values: ReadonlyArray<number>;
}

export function BarChart({
  labels,
  series,
  height = 140,
  width = 360,
  className,
}: {
  labels: ReadonlyArray<string>;
  series: ReadonlyArray<BarChartSeries>;
  height?: number;
  width?: number;
  className?: string;
}) {
  const safeSeries = series.filter((s) => s.values.length > 0);
  if (safeSeries.length === 0 || labels.length === 0) {
    return (
      <div
        className={`flex h-[${height}px] items-center justify-center text-xs text-slate-400 ${className ?? ""}`}
      >
        No data in the selected range.
      </div>
    );
  }

  const columnTotals = labels.map((_, i) =>
    safeSeries.reduce((sum, s) => sum + (s.values[i] ?? 0), 0),
  );
  const max = Math.max(1, ...columnTotals);
  const paddingTop = 12;
  const paddingBottom = 22;
  const paddingX = 12;
  const innerHeight = height - paddingTop - paddingBottom;
  const innerWidth = width - paddingX * 2;
  const groupWidth = innerWidth / labels.length;
  const barWidth = Math.max(2, groupWidth * 0.65);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label="bar chart"
    >
      <line
        x1={paddingX}
        x2={width - paddingX}
        y1={height - paddingBottom}
        y2={height - paddingBottom}
        stroke="#334155"
        strokeWidth={1}
      />
      {labels.map((label, i) => {
        const cx = paddingX + groupWidth * (i + 0.5);
        let cursor = height - paddingBottom;
        return (
          <g key={`${label}-${i}`}>
            {safeSeries.map((s) => {
              const value = s.values[i] ?? 0;
              const barHeight = (value / max) * innerHeight;
              const y = cursor - barHeight;
              cursor = y;
              return (
                <rect
                  key={`${s.label}-${i}`}
                  x={cx - barWidth / 2}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={s.color}
                  rx={1.5}
                >
                  <title>
                    {label}: {s.label} = {value}
                  </title>
                </rect>
              );
            })}
            {labels.length <= 12 || i % Math.ceil(labels.length / 12) === 0 ? (
              <text
                x={cx}
                y={height - 6}
                textAnchor="middle"
                fontSize={9}
                fill="#94a3b8"
              >
                {shortLabel(label)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function shortLabel(label: string): string {
  // ISO dates → "MM-DD"; categorical → first 10 chars.
  if (/^\d{4}-\d{2}-\d{2}/.test(label)) {
    return label.slice(5, 10);
  }
  return label.length > 10 ? `${label.slice(0, 9)}…` : label;
}
