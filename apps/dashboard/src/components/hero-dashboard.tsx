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
    <div className=" overflow-hidden rounded-none bg-black text-gray-200 shadow-2xl ring-1 ring-zinc-700">
      {/* window bar */}


      <div className="grid md:grid-cols-[200px_1fr_230px]">
        {/* mini sidebar */}
        <div className="hidden border-r border-slate-700/70 p-4 text-xs md:block">
          <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Observe
          </div>
          {[
            { icon: "activity", label: "Live map" },
            { icon: "message", label: "Conversations", badge: "20" },
            { icon: "target", label: "Intents", badge: "3" },
            { icon: "database", label: "Events" },
          ].map((i) => (
            <div key={i.label} className="flex items-center gap-2 rounded-none px-2 py-1.5 text-gray-300">
              <Icon name={i.icon} className="h-3.5 w-3.5" />
              {i.label}
              {i.badge && (
                <span className="ml-auto rounded-none bg-slate-700 px-1.5 text-[10px] text-gray-200">
                  {i.badge}
                </span>
              )}
            </div>
          ))}
          <div className="px-1 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Act
          </div>
          {[
            { icon: "bell", label: "Alerts" },
            { icon: "sparkles", label: "Auto-fix" },
            { icon: "shield", label: "Audit log" },
          ].map((i) => (
            <div key={i.label} className="flex items-center gap-2 rounded-none px-2 py-1.5 text-gray-300">
              <Icon name={i.icon} className="h-3.5 w-3.5" />
              {i.label}
            </div>
          ))}
        </div>

        {/* chart */}
        <div className="border-slate-700/70 p-5 md:border-r">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-gray-300">Conversations and failures</span>
            <span className="text-[11px] text-gray-500">daily · last 7 days</span>
          </div>
          <div className="mt-2 h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={SERIES} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
                <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} tickLine={false} axisLine={false} width={44} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 0,
                    fontSize: 11,
                    color: "#e5e7eb",
                  }}
                  formatter={(value, name) => [
                    `${Number(value ?? 0).toLocaleString()} events`,
                    name === "ok" ? "Passed" : "Failed",
                  ]}
                />
                <Area type="monotone" dataKey="ok" stroke="#ea580c" strokeWidth={2} fill="url(#heroOk)" dot={false} name="ok" isAnimationActive={false} />
                <Area type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} fill="url(#heroErr)" dot={false} name="failed" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex items-center gap-4 text-[10px] text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-4 rounded-none bg-accent" /> Passed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-4 rounded-none bg-red-500" /> Failed — spiked Thu
            </span>
          </div>
        </div>

        {/* stats column */}
        <div className="hidden p-5 md:block">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">This week</div>
          <dl className="mt-3 space-y-3">
            {WEEK.map((s) => (
              <div key={s.label} className="flex items-baseline justify-between text-sm">
                <dt className="text-gray-400">{s.label}</dt>
                <dd className={`font-semibold tabular-nums ${s.danger ? "text-red-400" : "text-gray-100"}`}>
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 rounded-none bg-slate-900 p-2.5">
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="text-gray-400">Quota used</span>
              <span className="font-semibold text-gray-100">32%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-none bg-gray-950">
              <div className="h-full w-1/3 rounded-none bg-accent" />
            </div>
            <div className="mt-1 text-[10px] text-gray-500">16k of 50k events</div>
          </div>
        </div>
      </div>
    </div>
  );
}
