"use client";

import { useState } from "react";
import type { Task, AgentConfig, TaskStatus } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  completed: "text-emerald-400",
  running: "text-blue-400",
  queued: "text-slate-400",
  failed: "text-red-400",
  cancelled: "text-slate-500",
};

const PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-red-500/15 text-red-300 border-red-500/30",
  high: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  medium: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  low: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

export function TasksClient({ tasks: initial, agents }: { tasks: Task[]; agents: AgentConfig[] }) {
  const [tasks, setTasks] = useState(initial);
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = tasks.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (agentFilter !== "all" && t.agentId !== agentFilter) return false;
    if (search && !t.input.toLowerCase().includes(search.toLowerCase()) && !t.agentName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts: Record<string, number> = { all: tasks.length };
  tasks.forEach((t) => { counts[t.status] = (counts[t.status] || 0) + 1; });

  async function enqueueTask() {
    const agentId = agentFilter !== "all" ? agentFilter : agents.find(a => a.status === "running")?.id;
    if (!agentId) return;
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, input: "New manual task", type: "manual", priority: "medium" }),
    });
    const { task } = await res.json();
    setTasks((prev) => [task, ...prev]);
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { l: "Total", v: counts.all, c: "text-white" },
          { l: "Running", v: counts.running || 0, c: "text-blue-400" },
          { l: "Queued", v: counts.queued || 0, c: "text-slate-400" },
          { l: "Completed", v: counts.completed || 0, c: "text-emerald-400" },
          { l: "Failed", v: counts.failed || 0, c: "text-red-400" },
        ].map((s) => (
          <div key={s.l} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className={`text-2xl font-bold ${s.c}`}>{s.v}</div>
            <div className="text-sm text-slate-500">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <input type="text" placeholder="Search tasks…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl pl-4 pr-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500" />
        </div>
        <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500">
          <option value="all">All agents</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <div className="flex gap-1.5">
          {(["all", "running", "queued", "completed", "failed"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${statusFilter === s ? "bg-orange-600 text-white" : "bg-slate-800/50 text-slate-400 hover:text-white border border-slate-700/50"}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={enqueueTask} className="px-4 py-2.5 bg-orange-600 text-white rounded-xl text-sm font-medium hover:bg-orange-700">
          + Enqueue Task
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50">
                {["Task", "Agent", "Status", "Priority", "Duration", "Tokens", "Output"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((task) => (
                <tr key={task.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                  <td className="px-5 py-3.5">
                    <div className="text-white text-sm font-medium">{task.input}</div>
                    <div className="text-slate-500 text-xs">{task.id} · {task.type}</div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-300 text-sm">{task.agentName}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-semibold ${STATUS_STYLES[task.status] || "text-slate-400"}`}>{task.status}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_STYLES[task.priority] || ""}`}>{task.priority}</span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-300 text-sm font-mono">{task.duration}</td>
                  <td className="px-5 py-3.5 text-slate-400 text-sm">{task.tokensUsed.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-slate-400 text-sm max-w-48 truncate">{task.error || task.output}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="text-center py-12 text-slate-500">No tasks match your filters</div>}
      </div>
    </div>
  );
}
