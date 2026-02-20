"use client";

import { useState, useCallback, useEffect } from "react";
import type { Task, AgentConfig, TaskStatus } from "@/lib/types";
import { TaskBoard } from "@/components/task-board";
import { useTaskStream } from "@/hooks/useTaskStream";

const STATUS_STYLES: Record<string, string> = {
  completed: "text-emerald-600",
  running: "text-blue-600",
  queued: "text-slate-500",
  parked: "text-orange-600",
  failed: "text-red-600",
  cancelled: "text-slate-400",
};

const PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-amber-100 text-amber-700 border-amber-200",
  medium: "bg-blue-100 text-blue-700 border-blue-200",
  low: "bg-slate-100 text-slate-500 border-slate-200",
};

type ViewMode = "table" | "board";

export function TasksClient({ tasks: initial, agents: initialAgents }: { tasks: Task[]; agents: AgentConfig[] }) {
  const [tasks, setTasks] = useState(initial);
  const [agents, setAgents] = useState(initialAgents);
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("board");

  // Subscribe to real-time task updates via SSE
  const { tasks: liveTasks, agents: liveAgents, connected } = useTaskStream();

  // Sync live SSE data into local state
  useEffect(() => {
    if (liveTasks.length > 0 || connected) {
      setTasks(liveTasks);
    }
  }, [liveTasks, connected]);

  useEffect(() => {
    if (liveAgents.length > 0) {
      setAgents(liveAgents);
    }
  }, [liveAgents]);

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

  // Kanban drag handler — optimistic update + PATCH API
  const handleTaskUpdate = useCallback(async (taskId: string, newStatus: TaskStatus) => {
    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    // PATCH API
    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });
    } catch {
      // Revert on failure
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: t.status } : t))
      );
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { l: "Total", v: counts.all, c: "text-slate-900" },
          { l: "Running", v: counts.running || 0, c: "text-blue-600" },
          { l: "Parked", v: counts.parked || 0, c: "text-orange-600" },
          { l: "Queued", v: counts.queued || 0, c: "text-slate-500" },
          { l: "Completed", v: counts.completed || 0, c: "text-emerald-600" },
          { l: "Failed", v: counts.failed || 0, c: "text-red-600" },
        ].map((s) => (
          <div key={s.l} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className={`text-2xl font-bold ${s.c}`}>{s.v}</div>
            <div className="text-sm text-slate-500">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Filters + View Toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <input
            type="text"
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-4 pr-4 py-2.5 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
          />
        </div>
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-brand-500"
        >
          <option value="all">All agents</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <div className="flex gap-1.5">
          {(["all", "running", "parked", "queued", "completed", "failed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                statusFilter === s
                  ? "bg-brand-600 text-white"
                  : "bg-white text-slate-500 hover:text-slate-900 border border-slate-200"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode("board")}
            className={`p-1.5 rounded-md transition-all ${
              viewMode === "board" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
            }`}
            title="Board view"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`p-1.5 rounded-md transition-all ${
              viewMode === "table" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
            }`}
            title="Table view"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M12 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M21.375 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M12 17.25v-5.25" />
            </svg>
          </button>
        </div>

        <button
          onClick={enqueueTask}
          className="px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          + Enqueue Task
        </button>
      </div>

      {/* Board View */}
      {viewMode === "board" && (
        <TaskBoard tasks={filtered} onTaskUpdate={handleTaskUpdate} />
      )}

      {/* Table View */}
      {viewMode === "table" && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  {["Task", "Agent", "Status", "Priority", "Duration", "Tokens", "Output"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((task) => (
                  <tr key={task.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="text-slate-900 text-sm font-medium">{task.input}</div>
                      <div className="text-slate-400 text-xs">{task.id} · {task.type}</div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 text-sm">{task.agentName}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold ${STATUS_STYLES[task.status] || "text-slate-400"}`}>{task.status}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_STYLES[task.priority] || ""}`}>{task.priority}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 text-sm font-mono">{task.duration}</td>
                    <td className="px-5 py-3.5 text-slate-500 text-sm">{task.tokensUsed.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-slate-500 text-sm max-w-48 truncate">{task.error || task.output}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <div className="text-center py-12 text-slate-400">No tasks match your filters</div>}
        </div>
      )}
    </div>
  );
}
