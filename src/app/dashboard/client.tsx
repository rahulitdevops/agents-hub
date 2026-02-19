"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { AgentConfig, Task, AnalyticsDataPoint } from "@/lib/types";
import { formatNumber, formatCost } from "@/lib/utils";

interface Props {
  summary: Record<string, number>;
  agents: AgentConfig[];
  recentTasks: Task[];
  analytics: AnalyticsDataPoint[];
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 hover:border-slate-600/50 transition-all">
      <div className={`w-3 h-3 rounded-full mb-3 ${color}`} />
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-slate-400 mt-1">{label}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  running: "bg-emerald-500",
  paused: "bg-amber-500",
  error: "bg-red-500",
  stopped: "bg-slate-500",
  completed: "text-emerald-400",
  failed: "text-red-400",
  queued: "text-slate-400",
};

export function DashboardClient({ summary: initialSummary, agents: initialAgents, recentTasks: initialTasks, analytics: initialAnalytics }: Props) {
  const [summary, setSummary] = useState(initialSummary);
  const [agents, setAgents] = useState(initialAgents);
  const [recentTasks, setRecentTasks] = useState(initialTasks);
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [workerStatus, setWorkerStatus] = useState<{
    healthy: boolean;
    activeWorkers: number;
    maxWorkers: number;
    queueDepth: number;
    totalExecuted: number;
    totalFailed: number;
  } | null>(null);

  // Poll for dashboard updates every 5 seconds
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

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Agents" value={String(summary.totalAgents)} sub={`${summary.runningAgents} active`} color="bg-blue-500" />
        <StatCard label="Tasks Today" value={String(summary.totalTasks)} sub={`${summary.queuedTasks} queued`} color="bg-emerald-500" />
        <StatCard label="Avg Latency" value={`${summary.avgResponseTime}s`} color="bg-violet-500" />
        <StatCard label="Total Cost" value={formatCost(summary.totalCost)} sub={`${formatNumber(summary.totalTokens)} tokens`} color="bg-orange-500" />
      </div>

      {/* Worker Pool Status */}
      {workerStatus && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${workerStatus.healthy ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
            <span className="text-sm font-medium text-white">Worker Pool</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${workerStatus.healthy ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
              {workerStatus.healthy ? "Healthy" : "Offline"}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>
              <span className="text-white font-semibold">{workerStatus.activeWorkers}</span>/{workerStatus.maxWorkers} workers active
            </span>
            <span>
              <span className="text-white font-semibold">{workerStatus.queueDepth}</span> queued
            </span>
            <span>
              <span className="text-white font-semibold">{workerStatus.totalExecuted}</span> executed
            </span>
            {workerStatus.totalFailed > 0 && (
              <span className="text-red-400">
                <span className="font-semibold">{workerStatus.totalFailed}</span> failed
              </span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request volume chart */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Request Volume (18 days)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={analytics}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", fontSize: "13px" }} />
              <Area type="monotone" dataKey="requests" stroke="#f97316" fill="url(#grad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Agent list */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Agents</h3>
            <Link href="/agents" className="text-orange-400 text-xs hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {agents.map((a) => (
              <Link key={a.id} href={`/agents/${a.id}`} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl hover:bg-slate-700/30 transition-colors">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_COLORS[a.status] || "bg-slate-500"}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-white text-sm font-medium truncate">{a.name}</div>
                  <div className="text-slate-500 text-xs truncate">{a.model.split("/")[1]}</div>
                </div>
                <span className="text-xs text-slate-500">{a.metrics.tasksCompleted}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Cost trend + recent tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Daily Cost</h3>
          <ResponsiveContainer width="100%" height={200}>
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Recent Tasks</h3>
            <Link href="/tasks" className="text-orange-400 text-xs hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {recentTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl">
                <span className={`text-xs font-medium ${STATUS_COLORS[t.status] || "text-slate-400"}`}>{t.status}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-white text-sm truncate">{t.input}</div>
                  <div className="text-slate-500 text-xs">{t.agentName}</div>
                </div>
                <span className="text-xs text-slate-500 font-mono">{t.duration}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
