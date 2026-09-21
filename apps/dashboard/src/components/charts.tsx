"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS = { stroke: "#9ca3af", fontSize: 12 };
const GRID = "#eef1f5";
const TOOLTIP_STYLE = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "0 8px 24px rgba(17, 24, 39, 0.10)",
  padding: "8px 10px",
};

function EventsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <div className="mb-1 text-xs font-medium text-gray-400 dark:text-gray-500">Time {label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-sm tabular-nums text-gray-700 dark:text-gray-300">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: p.name === "ok" ? "#ea580c" : "#ef4444" }}
          />
          {p.name === "ok" ? "Passed" : "Failed"} · <strong>{Number(p.value ?? 0).toLocaleString()}</strong>&nbsp;events
        </div>
      ))}
    </div>
  );
}

function MsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <div className="mb-1 text-xs font-medium text-gray-400 dark:text-gray-500">Time {label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-sm tabular-nums text-gray-700 dark:text-gray-300">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: p.name === "p50" ? "#ea580c" : "#fdba74" }}
          />
          {p.name === "p50" ? "Typical (p50)" : "Slowest 5% (p95)"} ·{" "}
          <strong>{Math.round(Number(p.value ?? 0)).toLocaleString()} ms</strong>
        </div>
      ))}
    </div>
  );
}

export function VolumeChart({
  data,
}: {
  data: Array<{ bucket: string; ok: number; error: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="volOk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ea580c" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#ea580c" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="volErr" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="bucket" tick={AXIS} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} minTickGap={48} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
        <Tooltip content={<EventsTooltip />} cursor={{ stroke: "#d1d5db", strokeDasharray: "3 3" }} />
        <Legend
          wrapperStyle={{ fontSize: 13 }}
          iconType="circle"
          iconSize={8}
          formatter={(v) => (v === "ok" ? "Passed" : "Failed")}
        />
        <Area type="monotone" dataKey="ok" stroke="#ea580c" strokeWidth={2} fill="url(#volOk)" dot={false} activeDot={{ r: 3.5, strokeWidth: 1, stroke: "#fff" }} name="ok" />
        <Area type="monotone" dataKey="error" stroke="#ef4444" strokeWidth={2} fill="url(#volErr)" dot={false} activeDot={{ r: 3.5, strokeWidth: 1, stroke: "#fff" }} name="error" />
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
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="bucket" tick={AXIS} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} minTickGap={48} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
        <Tooltip content={<MsTooltip />} cursor={{ stroke: "#d1d5db", strokeDasharray: "3 3" }} />
        <Legend
          wrapperStyle={{ fontSize: 13 }}
          iconType="circle"
          iconSize={8}
          formatter={(v) => (v === "p50" ? "Typical (p50)" : "Slowest 5% (p95)")}
        />
        <Line type="monotone" dataKey="p50" stroke="#ea580c" strokeWidth={2} dot={false} activeDot={{ r: 3.5, strokeWidth: 1, stroke: "#fff" }} name="p50" />
        <Line type="monotone" dataKey="p95" stroke="#fdba74" strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 3.5, strokeWidth: 1, stroke: "#fff" }} name="p95" />
      </LineChart>
    </ResponsiveContainer>
  );
}
