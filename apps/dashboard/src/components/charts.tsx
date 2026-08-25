"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS = { stroke: "#9ca3af", fontSize: 11 };
const GRID = "#f3f4f6";
const TOOLTIP_STYLE = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
};

export function VolumeChart({
  data,
}: {
  data: Array<{ bucket: string; ok: number; error: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="bucket" tick={AXIS} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Line dataKey="ok" stroke="#7c3aed" strokeWidth={1.5} dot={false} />
        <Line dataKey="error" stroke="#ef4444" strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function LatencyChart({
  data,
}: {
  data: Array<{ bucket: string; p50: number; p95: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="bucket" tick={AXIS} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />
        <Line dataKey="p50" stroke="#7c3aed" strokeWidth={1.5} dot={false} name="p50" />
        <Line dataKey="p95" stroke="#a78bfa" strokeWidth={1.5} dot={false} strokeDasharray="4 3" name="p95" />
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
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 40 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={130} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="calls" fill="#7c3aed" radius={[0, 3, 3, 0]} barSize={12} />
        <Bar dataKey="errors" fill="#ef4444" radius={[0, 3, 3, 0]} barSize={12} />
      </BarChart>
    </ResponsiveContainer>
  );
}
