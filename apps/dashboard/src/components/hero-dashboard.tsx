"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Icon } from "@/components/icon";

const SERIES = [
  { d: "Mon", ok: 1820, failed: 96 },
  { d: "Tue", ok: 2140, failed: 121 },
  { d: "Wed", ok: 1980, failed: 88 },
  { d: "Thu", ok: 2310, failed: 240 },
  { d: "Fri", ok: 2470, failed: 312 },
  { d: "Sat", ok: 2210, failed: 154 },
  { d: "Sun", ok: 2380, failed: 132 },
];

const WEEK = [
  { label: "Conversations", value: "16,249" },
  { label: "Failed", value: "1,318", danger: true },
  { label: "Intents", value: "20" },
  { label: "Error rate", value: "8.1%" },
  { label: "Slowest 5%", value: "1.8s" },
  { label: "Est. cost", value: "$22.80" },
];

export function HeroDashboard() {
  return (
    <div className="overflow-hidden rounded-2xl bg-zinc-800 text-gray-200 shadow-2xl ring-1 ring-zinc-700">
      {/* window bar */}
      <div className="flex items-center gap-3 border-b border-zinc-700/70 px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-white">
          <span className="flex h-4 w-4 items-center justify-center rounded bg-accent text-[10px] font-bold text-white">
            D
          </span>
          DIAGNOST
        </span>
        <span className="hidden rounded bg-zinc-700 px-2 py-0.5 text-[11px] text-gray-400 sm:inline">
          ● Production
        </span>
        <span className="mx-auto hidden w-full max-w-xs truncate rounded-md bg-zinc-900 px-3 py-1 text-center text-[11px] text-gray-500 md:block">
          Search conversations, intents, errors…
        </span>
        <span className="ml-auto text-[11px] text-gray-500 md:ml-0">Docs</span>
      </div>

      <div className="grid md:grid-cols-[170px_1fr_200px]">
        {/* mini sidebar */}
        <div className="hidden border-r border-zinc-700/70 p-3 text-[11px] md:block">
          <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
            Observe
          </div>
          {[
            { icon: "activity", label: "Live map" },
            { icon: "message", label: "Conversations", badge: "20" },
            { icon: "target", label: "Intents", badge: "3" },
            { icon: "database", label: "Events" },
          ].map((i) => (
            <div key={i.label} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-gray-400">
              <Icon name={i.icon} className="h-3.5 w-3.5" />
              {i.label}
              {i.badge && (
                <span className="ml-auto rounded bg-zinc-700 px-1.5 text-[10px] text-gray-300">
                  {i.badge}
                </span>
              )}
            </div>
          ))}
          <div className="px-1 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
            Act
          </div>
          {[
            { icon: "bell", label: "Alerts" },
            { icon: "sparkles", label: "Auto-fix" },
            { icon: "shield", label: "Audit log" },
          ].map((i) => (
            <div key={i.label} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-gray-400">
              <Icon name={i.icon} className="h-3.5 w-3.5" />
              {i.label}
            </div>
          ))}
        </div>

        {/* chart */}
        <div className="border-zinc-700/70 p-4 md:border-r">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-gray-300">Conversations and failures</span>
            <span className="text-[10px] text-gray-600">daily · last 7 days</span>
          </div>
          <div className="mt-2 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={SERIES} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="heroOk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ea580c" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#ea580c" stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id="heroErr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="d" tick={{ fill: "#9ca3af", fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} tickLine={false} axisLine={false} width={36} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#27272a",
                    border: "1px solid #3f3f46",
                    borderRadius: 8,
                    fontSize: 11,
                    color: "#e5e7eb",
                  }}
                  formatter={(value, name) => [
                    `${Number(value ?? 0).toLocaleString()} events`,
                    name === "ok" ? "Passed" : "Failed",
                  ]}
                />
                <Area type="monotone" dataKey="ok" stroke="#ea580c" strokeWidth={2} fill="url(#heroOk)" dot={false} name="ok" />
                <Area type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} fill="url(#heroErr)" dot={false} name="failed" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex items-center gap-4 text-[10px] text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-4 rounded-full bg-accent" /> Passed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-4 rounded-full bg-red-500" /> Failed — spiked Thu
            </span>
          </div>
        </div>

        {/* stats column */}
        <div className="hidden p-4 md:block">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">This week</div>
          <dl className="mt-2 space-y-2.5">
            {WEEK.map((s) => (
              <div key={s.label} className="flex items-baseline justify-between text-xs">
                <dt className="text-gray-500">{s.label}</dt>
                <dd className={`font-semibold tabular-nums ${s.danger ? "text-red-400" : "text-gray-100"}`}>
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 rounded-lg bg-zinc-900 p-2.5">
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="text-gray-400">Quota used</span>
              <span className="font-semibold text-gray-100">32%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-700">
              <div className="h-full w-1/3 rounded-full bg-accent" />
            </div>
            <div className="mt-1 text-[10px] text-gray-600">16k of 50k events</div>
          </div>
        </div>
      </div>
    </div>
  );
}
