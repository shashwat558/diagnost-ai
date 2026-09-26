"use client";

import { useId } from "react";
import { Area, AreaChart, Tooltip } from "recharts";

/** Recharts-based sparkline (table trend column, header card). */
export function Sparkline({
  points,
  color = "#ea580c",
  width = 64,
  height = 20,
}: {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const gradientId = `spark-${useId().replace(/:/g, "")}`;
  const values = points.length >= 2 ? points : [points[0] ?? 0, points[0] ?? 0];
  const data = values.map((v, i) => ({ i, v }));

  return (
    <AreaChart width={width} height={height} data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <Tooltip
        content={({ active, payload }) =>
          active && payload && payload.length > 0 ? (
            <div className="rounded-md border border-line bg-surface px-2 py-1 text-xs tabular-nums text-ink shadow-lg">
              {Number(payload[0]!.value).toLocaleString()}
            </div>
          ) : null
        }
      />
      <Area
        type="monotone"
        dataKey="v"
        stroke={color}
        strokeWidth={1.5}
        fill={`url(#${gradientId})`}
        dot={false}
        activeDot={{ r: 2.5, fill: color, stroke: "#fff", strokeWidth: 1 }}
        isAnimationActive={false}
      />
    </AreaChart>
  );
}
