"use client";

import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { AnalyticsDataPoint } from "@/lib/types";
import { formatNumber, formatCost } from "@/lib/utils";

interface Props {
  analytics: AnalyticsDataPoint[];
  summary: Record<string, number>;
}

export function AnalyticsClient({ analytics, summary }: Props) {
  const totalReqs = analytics.reduce((s, d) => s + d.requests, 0);
  const totalTokens = analytics.reduce((s, d) => s + d.tokens, 0);
  const totalCost = analytics.reduce((s, d) => s + d.cost, 0);
  const totalErrors = analytics.reduce((s, d) => s + d.errors, 0);

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Requests", value: formatNumber(totalReqs), color: "from-blue-500 to-cyan-500" },
          { label: "Tokens Used", value: formatNumber(totalTokens), color: "from-violet-500 to-purple-500" },
          { label: "Total Cost", value: formatCost(totalCost), color: "from-orange-500 to-red-500" },
          { label: "Errors", value: String(totalErrors), color: "from-red-500 to-pink-500" },
        ].map((m) => (
          <div key={m.label} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
            <div className={`w-10 h-1.5 rounded-full bg-gradient-to-r ${m.color} mb-3`} />
            <div className="text-2xl font-bold text-white">{m.value}</div>
            <div className="text-sm text-slate-400 mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Request Volume</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={analytics}>
              <defs>
                <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", fontSize: "13px" }} />
              <Area type="monotone" dataKey="requests" stroke="#f97316" fill="url(#aGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Daily Cost</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analytics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", fontSize: "13px" }} formatter={(v: number) => `$${v}`} />
              <Bar dataKey="cost" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Token Usage</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={analytics}>
              <defs>
                <linearGradient id="tGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1e6).toFixed(1)}M`} />
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", fontSize: "13px" }} formatter={(v: number) => `${(v / 1e6).toFixed(2)}M tokens`} />
              <Area type="monotone" dataKey="tokens" stroke="#3b82f6" fill="url(#tGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Error Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={analytics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", fontSize: "13px" }} />
              <Line type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} dot={{ fill: "#ef4444", r: 3 }} />
              <Line type="monotone" dataKey="avgLatency" stroke="#a855f7" strokeWidth={2} dot={{ fill: "#a855f7", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
