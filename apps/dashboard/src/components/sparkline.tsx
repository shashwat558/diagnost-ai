/** Tiny inline SVG sparkline (table trend column). */
export function Sparkline({
  points,
  color = "#7c3aed",
  width = 64,
  height = 20,
}: {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) points = [points[0] ?? 0, points[0] ?? 0];
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const y = (v: number) => height - 2 - ((v - min) / span) * (height - 4);

  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  const last = points[points.length - 1]!;
  const first = points[0]!;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <rect x={width - 3} y={y(last) - 1.5} width="3" height="3" fill={color} />
      <rect x={0} y={y(first) - 1.5} width="3" height="3" fill={color} opacity={0.5} />
    </svg>
  );
}
