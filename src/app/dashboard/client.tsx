"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { AgentConfig, Task, AnalyticsDataPoint } from "@/lib/types";
import { formatNumber, formatCost } from "@/lib/utils";

interface Props {
  summary: Record<string, number>;
  agents: AgentConfig[];
  recentTasks: Task[];
  analytics: AnalyticsDataPoint[];
}

const STAT_ICONS = [
  // Dollar sign
  { bg: "bg-emerald-50", icon: "text-emerald-600", d: "M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  // Bolt/lightning
  { bg: "bg-blue-50", icon: "text-blue-600", d: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" },
  // Chat bubble
  { bg: "bg-violet-50", icon: "text-violet-600", d: "M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" },
  // Trending up
  { bg: "bg-amber-50", icon: "text-amber-600", d: "M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941" },
];

function StatCard({ label, value, sub, iconIdx }: { label: string; value: string; sub?: string; iconIdx: number }) {
  const icon = STAT_ICONS[iconIdx] || STAT_ICONS[0];
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-all">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 ${icon.bg} rounded-xl flex items-center justify-center`}>
          <svg className={`w-5 h-5 ${icon.icon}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d={icon.d} />
          </svg>
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  running: "bg-emerald-500",
  paused: "bg-amber-500",
  error: "bg-red-500",
  stopped: "bg-slate-400",
  completed: "text-emerald-600",
  failed: "text-red-600",
  queued: "text-slate-500",
  parked: "text-orange-600",
};

type ChartTab = "cost" | "tokens" | "requests" | "errors";

export function DashboardClient({ summary: initialSummary, agents: initialAgents, recentTasks: initialTasks, analytics: initialAnalytics }: Props) {
  const [summary, setSummary] = useState(initialSummary);
  const [agents, setAgents] = useState(initialAgents);
  const [recentTasks, setRecentTasks] = useState(initialTasks);
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [chartTab, setChartTab] = useState<ChartTab>("cost");
  const [workerStatus, setWorkerStatus] = useState<{
    healthy: boolean;
    dockerMode?: boolean;
    containers?: { name: string; agentId: string; status: string }[];
    activeWorkers: number;
    maxWorkers: number;
    queueDepth: number;
    totalExecuted: number;
    totalFailed: number;
  } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [analyticsRes, agentsRes, workersRes] = await Promise.all([
        fetch("/api/analytics"),
        fetch("/api/agents"),
        fetch("/api/workers"),
      ]);
      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        if (data.summary) setSummary(data.summary);
        if (data.timeseries) setAnalytics(data.timeseries);
      }
      if (agentsRes.ok) {
        const data = await agentsRes.json();
        if (data.agents) setAgents(data.agents);
      }
      if (workersRes.ok) {
        const data = await workersRes.json();
        setWorkerStatus(data);
      }
    } catch {
      // Silently ignore polling errors
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const chartDataKey = chartTab;
  const chartColor = chartTab === "cost" ? "#3b82f6" : chartTab === "tokens" ? "#8b5cf6" : chartTab === "requests" ? "#10b981" : "#ef4444";
  const chartFormatter = chartTab === "cost" ? (v: number) => `$${v}` : chartTab === "tokens" ? (v: number) => `${(v / 1000).toFixed(0)}K` : undefined;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Cost" value={formatCost(summary.totalCost)} sub={`${formatNumber(summary.totalTokens)} tokens`} iconIdx={0} />
        <StatCard label="Total Tokens" value={formatNumber(summary.totalTokens)} sub={`${summary.totalTasks} tasks`} iconIdx={1} />
        <StatCard label="Total Agents" value={String(summary.totalAgents)} sub={`${summary.runningAgents} active`} iconIdx={2} />
        <StatCard label="Avg Latency" value={`${summary.avgResponseTime}s`} sub={`${summary.queuedTasks} queued · ${summary.parkedTasks || 0} parked`} iconIdx={3} />
      </div>

      {/* Worker Pool + Docker Status */}
      {workerStatus && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${workerStatus.healthy ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
            <span className="text-sm font-medium text-slate-900">Worker Pool</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${workerStatus.healthy ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {workerStatus.healthy ? "Healthy" : "Offline"}
            </span>
            {workerStatus.dockerMode && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Docker Mode</span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span><span className="text-slate-900 font-semibold">{workerStatus.activeWorkers}</span>/{workerStatus.maxWorkers} workers</span>
            <span><span className="text-slate-900 font-semibold">{workerStatus.queueDepth}</span> queued</span>
            <span><span className="text-slate-900 font-semibold">{workerStatus.totalExecuted}</span> executed</span>
            {workerStatus.totalFailed > 0 && (
              <span className="text-red-600"><span className="font-semibold">{workerStatus.totalFailed}</span> failed</span>
            )}
            {workerStatus.containers && workerStatus.containers.length > 0 && (
              <span><span className="text-slate-900 font-semibold">{workerStatus.containers.length}</span> containers</span>
            )}
          </div>
        </div>
      )}

      {/* Main chart with tab switcher */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-slate-900 font-semibold text-lg">Overview</h3>
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {(["cost", "tokens", "requests", "errors"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setChartTab(tab)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  chartTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analytics}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={(v: string) => { const d = new Date(v); return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={chartFormatter} />
            <Tooltip contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", fontSize: "13px", color: "#0f172a" }} formatter={chartFormatter} />
            <Bar dataKey={chartDataKey} fill={chartColor} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Agent breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-900 font-semibold">By Agent</h3>
            <Link href="/agents" className="text-brand-600 text-xs hover:underline font-medium">View all</Link>
          </div>
          <div className="overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-0 text-xs text-slate-500 font-medium uppercase tracking-wide pb-2 border-b border-slate-100">
              <div>Agent</div>
              <div className="text-right">Tasks</div>
              <div className="text-right">Tokens</div>
              <div className="text-right">Status</div>
            </div>
            <div className="divide-y divide-slate-50">
              {agents.map((a) => (
                <Link key={a.id} href={`/agents/${a.id}`} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center py-3 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg">{a.avatar}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{a.name}</div>
                      <div className="text-xs text-slate-400 truncate">{a.model.split("/")[1]}</div>
                    </div>
                  </div>
                  <div className="text-sm text-slate-700 font-medium tabular-nums">{a.metrics.tasksCompleted}</div>
                  <div className="text-sm text-slate-500 tabular-nums">{formatNumber(a.metrics.tokensUsed)}</div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[a.status] || "bg-slate-400"}`} />
                    <span className="text-xs text-slate-500 capitalize">{a.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Tasks */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-900 font-semibold">Recent Tasks</h3>
            <Link href="/tasks" className="text-brand-600 text-xs hover:underline font-medium">View all</Link>
          </div>
          <div className="space-y-2">
            {recentTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                <span className={`text-xs font-medium capitalize ${STATUS_COLORS[t.status] || "text-slate-500"}`}>{t.status}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-slate-900 text-sm truncate">{t.input}</div>
                  <div className="text-slate-400 text-xs">{t.agentName}</div>
                </div>
                <span className="text-xs text-slate-400 font-mono">{t.duration}</span>
              </div>
            ))}
            {recentTasks.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">No tasks yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
