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
import { useTheme } from "next-themes";

/**
 * Recharts takes colours as props/inline styles, so it cannot use the CSS
 * theme tokens. Derive a matching palette from the resolved theme instead —
 * otherwise the tooltip stays white and the axis lines stay light in dark mode.
 */
function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return {
    axis: dark ? "#9ca3af" : "#6b7280",
    axisLine: dark ? "#2a2a2e" : "#e5e7eb",
    grid: dark ? "#1c1c20" : "#eef1f5",
    cursor: dark ? "#3f3f46" : "#d1d5db",
    dotRing: dark ? "#0a0a0a" : "#ffffff",
    surface: dark ? "#0a0a0a" : "#ffffff",
    line: dark ? "#3a3a3e" : "#e5e7eb",
    shadow: dark ? "0 8px 24px rgba(0, 0, 0, 0.55)" : "0 8px 24px rgba(17, 24, 39, 0.10)",
  };
}

function tooltipStyle(t: ReturnType<typeof useChartTheme>): React.CSSProperties {
  return {
    backgroundColor: t.surface,
    border: `1px solid ${t.line}`,
    borderRadius: 10,
    fontSize: 12,
    boxShadow: t.shadow,
    padding: "8px 10px",
  };
}

function EventsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string }>;
  label?: string;
}) {
  const t = useChartTheme();
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={tooltipStyle(t)}>
      <div className="mb-1 text-xs font-medium text-ink-subtle">Time {label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-sm tabular-nums text-ink">
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
  const t = useChartTheme();
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={tooltipStyle(t)}>
      <div className="mb-1 text-xs font-medium text-ink-subtle">Time {label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-sm tabular-nums text-ink">
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
  const t = useChartTheme();
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
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis dataKey="bucket" tick={{ stroke: t.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: t.axisLine }} minTickGap={48} />
        <YAxis tick={{ stroke: t.axis, fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
        <Tooltip content={<EventsTooltip />} cursor={{ stroke: t.cursor, strokeDasharray: "3 3" }} />
        <Legend
          wrapperStyle={{ fontSize: 13 }}
          iconType="circle"
          iconSize={8}
          formatter={(v) => (v === "ok" ? "Passed" : "Failed")}
        />
        <Area type="monotone" dataKey="ok" stroke="#ea580c" strokeWidth={2} fill="url(#volOk)" dot={false} activeDot={{ r: 3.5, strokeWidth: 1, stroke: t.dotRing }} name="ok" />
        <Area type="monotone" dataKey="error" stroke="#ef4444" strokeWidth={2} fill="url(#volErr)" dot={false} activeDot={{ r: 3.5, strokeWidth: 1, stroke: t.dotRing }} name="error" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LatencyChart({
  data,
}: {
  data: Array<{ bucket: string; p50: number; p95: number }>;
}) {
  const t = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis dataKey="bucket" tick={{ stroke: t.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: t.axisLine }} minTickGap={48} />
        <YAxis tick={{ stroke: t.axis, fontSize: 12 }} tickLine={false} axisLine={false} width={44} />
        <Tooltip content={<MsTooltip />} cursor={{ stroke: t.cursor, strokeDasharray: "3 3" }} />
        <Legend
          wrapperStyle={{ fontSize: 13 }}
          iconType="circle"
          iconSize={8}
          formatter={(v) => (v === "p50" ? "Typical (p50)" : "Slowest 5% (p95)")}
        />
        <Line type="monotone" dataKey="p50" stroke="#ea580c" strokeWidth={2} dot={false} activeDot={{ r: 3.5, strokeWidth: 1, stroke: t.dotRing }} name="p50" />
        <Line type="monotone" dataKey="p95" stroke="#fdba74" strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 3.5, strokeWidth: 1, stroke: t.dotRing }} name="p95" />
      </LineChart>
    </ResponsiveContainer>
  );
}
