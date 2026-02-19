"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { AgentConfig, AgentStatus } from "@/lib/types";
import { GROOT_AGENT_ID } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ModelPicker } from "@/components/model-picker";

const STATUS_STYLES: Record<string, string> = {
  running: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  paused: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  error: "bg-red-500/15 text-red-400 border-red-500/30",
  stopped: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  deploying: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const ROLE_STYLES: Record<string, string> = {
  director: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  worker: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  specialist: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
};


export function AgentsClient({ agents: initial }: { agents: AgentConfig[] }) {
  const [agents, setAgents] = useState(initial);
  const [filter, setFilter] = useState<"all" | AgentStatus>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: "", description: "", model: "anthropic/claude-sonnet-4-6", systemPrompt: "", avatar: "🤖" });
  const [creating, setCreating] = useState(false);

  // Poll for agent list updates every 5 seconds (catches agents created via chat)
  const refreshAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        if (data.agents) setAgents(data.agents);
      }
    } catch {
      // Silently ignore polling errors
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(refreshAgents, 5000);
    return () => clearInterval(interval);
  }, [refreshAgents]);

  const filtered = filter === "all" ? agents : agents.filter((a) => a.status === filter);
  const counts: Record<string, number> = { all: agents.length };
  agents.forEach((a) => { counts[a.status] = (counts[a.status] || 0) + 1; });

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newAgent) });
      const { agent } = await res.json();
      setAgents((prev) => [...prev, agent]);
      setShowCreate(false);
      setNewAgent({ name: "", description: "", model: "anthropic/claude-sonnet-4-6", systemPrompt: "", avatar: "🤖" });
    } finally {
      setCreating(false);
    }
  }

  async function handleAction(id: string, action: string) {
    const res = await fetch(`/api/agents/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const { agent } = await res.json();
    setAgents((prev) => prev.map((a) => (a.id === id ? agent : a)));
  }

  return (
    <div className="space-y-6">
      {/* Actions bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {(["all", "running", "paused", "error", "stopped"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === f ? "bg-orange-600 text-white shadow-lg shadow-orange-600/20" : "bg-slate-800/50 text-slate-400 hover:text-white border border-slate-700/50"}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f] || 0})
            </button>
          ))}
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-xl text-sm font-medium hover:bg-orange-700 shadow-lg shadow-orange-600/20">
          + New Agent
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-slate-800/80 border border-orange-500/30 rounded-2xl p-6 space-y-4">
          <h3 className="text-white font-semibold text-lg">Create OpenClaw Agent</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Agent Name</label>
              <input value={newAgent.name} onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })} placeholder="My Agent" className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Model</label>
              <ModelPicker
                value={newAgent.model}
                onChange={(modelId) => setNewAgent({ ...newAgent, model: modelId })}
                variant="compact"
                disabled={creating}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Avatar Emoji</label>
              <input value={newAgent.avatar} onChange={(e) => setNewAgent({ ...newAgent, avatar: e.target.value })} placeholder="🤖" className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500" maxLength={4} />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Description</label>
              <input value={newAgent.description} onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })} placeholder="What does this agent do?" className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm text-slate-400 mb-1.5">System Prompt</label>
              <textarea value={newAgent.systemPrompt} onChange={(e) => setNewAgent({ ...newAgent, systemPrompt: e.target.value })} rows={3} placeholder="You are a helpful assistant that..." className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500 resize-none" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
            <button onClick={handleCreate} disabled={!newAgent.name || creating} className="px-5 py-2.5 bg-orange-600 text-white rounded-xl text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
              {creating ? "Creating\u2026" : "Create Agent"}
            </button>
          </div>
        </div>
      )}

      {/* Agent cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((agent) => (
          <div
            key={agent.id}
            className={cn(
              "rounded-2xl p-5 transition-all border",
              agent.id === GROOT_AGENT_ID
                ? "border-purple-500/40 bg-gradient-to-br from-slate-800/80 to-purple-900/10 hover:border-purple-400/60"
                : "border-slate-700/50 bg-slate-800/50 hover:border-slate-600/50"
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <Link href={`/agents/${agent.id}`} className="hover:underline">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{agent.avatar}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-semibold text-lg">{agent.name}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${ROLE_STYLES[agent.role] || ROLE_STYLES.worker}`}>
                        {agent.role}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm mt-0.5">{agent.description}</p>
                  </div>
                </div>
              </Link>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[agent.status]}`}>
                {agent.status}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
              <span className="px-2 py-0.5 bg-slate-900/50 rounded-lg">{agent.model.split("/")[1]}</span>
              <span className="px-2 py-0.5 bg-slate-900/50 rounded-lg">thinking: {agent.thinking}</span>
              {agent.channels.filter(c => c.enabled).map(c => (
                <span key={c.type} className="px-2 py-0.5 bg-slate-900/50 rounded-lg">{c.type}</span>
              ))}
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { label: "CPU", value: `${agent.metrics.cpu}%`, bar: agent.metrics.cpu, color: agent.metrics.cpu > 60 ? "bg-amber-500" : "bg-emerald-500" },
                { label: "Memory", value: `${agent.metrics.memory}%`, bar: agent.metrics.memory, color: agent.metrics.memory > 60 ? "bg-amber-500" : "bg-blue-500" },
                { label: "Tasks", value: String(agent.metrics.tasksCompleted) },
                { label: "Latency", value: `${agent.metrics.avgResponseTime}s` },
              ].map((m) => (
                <div key={m.label} className="bg-slate-900/50 rounded-xl p-2.5">
                  <div className="text-xs text-slate-500">{m.label}</div>
                  <div className="text-white text-sm font-semibold">{m.value}</div>
                  {m.bar !== undefined && (
                    <div className="w-full bg-slate-700 rounded-full h-1 mt-1.5">
                      <div className={`h-1 rounded-full ${m.color}`} style={{ width: `${m.bar}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {agent.status !== "running" && (
                <button onClick={() => handleAction(agent.id, "start")} className="px-3 py-1.5 bg-emerald-600/20 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-600/30">Start</button>
              )}
              {agent.status === "running" && (
                <button onClick={() => handleAction(agent.id, "pause")} className="px-3 py-1.5 bg-amber-600/20 text-amber-400 rounded-lg text-xs font-medium hover:bg-amber-600/30">Pause</button>
              )}
              {agent.status !== "stopped" && agent.id !== GROOT_AGENT_ID && (
                <button onClick={() => handleAction(agent.id, "stop")} className="px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-600/30">Stop</button>
              )}
              <Link href={`/agents/${agent.id}`} className="px-3 py-1.5 bg-slate-600/20 text-slate-400 rounded-lg text-xs font-medium hover:bg-slate-600/30 ml-auto">Configure</Link>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 text-slate-500">No agents match the selected filter.</div>
      )}
    </div>
  );
}
