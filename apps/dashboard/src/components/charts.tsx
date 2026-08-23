"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS = { stroke: "#475569", fontSize: 11 };
const TOOLTIP_STYLE = {
  backgroundColor: "#111832",
  border: "1px solid #1f2a4d",
  borderRadius: 8,
  fontSize: 12,
};

export function VolumeChart({
  data,
}: {
  data: Array<{ bucket: string; ok: number; error: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2a4d" />
        <XAxis dataKey="bucket" tick={AXIS} tickLine={false} />
        <YAxis tick={AXIS} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Area dataKey="ok" stackId="v" stroke="#5eead4" fill="#5eead433" />
        <Area dataKey="error" stackId="v" stroke="#f87171" fill="#f8717133" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LatencyChart({
  data,
}: {
  data: Array<{ bucket: string; p50: number; p95: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2a4d" />
        <XAxis dataKey="bucket" tick={AXIS} tickLine={false} />
        <YAxis tick={AXIS} tickLine={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line dataKey="p50" stroke="#5eead4" dot={false} strokeWidth={2} />
        <Line dataKey="p95" stroke="#f59e0b" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ToolChart({
  data,
}: {
  data: Array<{ name: string; calls: number; errors: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2a4d" />
        <XAxis type="number" tick={AXIS} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} width={130} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="calls" fill="#5eead4" radius={[0, 4, 4, 0]} />
        <Bar dataKey="errors" fill="#f87171" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
