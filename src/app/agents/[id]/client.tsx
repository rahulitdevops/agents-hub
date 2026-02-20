"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { AgentConfig, Task } from "@/lib/types";
import { GROOT_AGENT_ID } from "@/lib/types";
import { ModelPicker } from "@/components/model-picker";

const ROLE_STYLES: Record<string, string> = {
  director: "bg-purple-50 text-purple-600 border-purple-200",
  worker: "bg-slate-50 text-slate-500 border-slate-200",
  specialist: "bg-cyan-50 text-cyan-600 border-cyan-200",
};

interface PlatformInfo {
  platform: string;
  label: string;
  icon: string;
  color: string;
  enabled: boolean;
}

export function AgentDetailClient({ agent: initial, tasks }: { agent: AgentConfig; tasks: Task[] }) {
  const [agent, setAgent] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [configuredPlatforms, setConfiguredPlatforms] = useState<PlatformInfo[]>([]);

  // Poll agent data every 5 seconds for live metric updates
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/agents/${initial.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.agent) {
          setAgent((prev) => ({
            ...prev,
            status: data.agent.status,
            metrics: data.agent.metrics,
          }));
        }
      } catch {
        // silently ignore polling errors
      }
    }, 5_000);
    return () => clearInterval(interval);
  }, [initial.id]);

  const [form, setForm] = useState({
    name: agent.name,
    description: agent.description,
    model: agent.model,
    systemPrompt: agent.systemPrompt,
    thinking: agent.thinking,
    temperature: agent.temperature,
    maxTokens: agent.maxTokens,
    rateLimit: agent.rateLimit,
    maxConcurrency: agent.maxConcurrency,
    timeout: agent.timeout,
    retryPolicy: agent.retryPolicy,
    maxRetries: agent.maxRetries,
    dmPolicy: agent.dmPolicy,
    platformAccess: agent.platformAccess || [],
  });

  const isGroot = agent.id === GROOT_AGENT_ID;

  // Fetch configured platforms from settings
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        const integrations = data.platformIntegrations || [];
        const templates = data.platformTemplates || [];
        const platforms: PlatformInfo[] = integrations
          .filter((i: { enabled: boolean }) => i.enabled)
          .map((i: { platform: string; label: string }) => {
            const tmpl = templates.find((t: { key: string }) => t.key === i.platform);
            return {
              platform: i.platform,
              label: i.label || tmpl?.label || i.platform,
              icon: tmpl?.icon || "🔌",
              color: tmpl?.color || "from-slate-500 to-slate-600",
              enabled: true,
            };
          });
        setConfiguredPlatforms(platforms);
      })
      .catch(() => {});
  }, []);

  function isPlatformEnabled(platformKey: string): boolean {
    if (form.platformAccess.includes("*")) return true;
    return form.platformAccess.includes(platformKey);
  }

  function togglePlatformAccess(platformKey: string) {
    if (isGroot) return; // Groot always has ["*"]
    setForm((prev) => {
      const current = prev.platformAccess.filter((p) => p !== "*");
      if (current.includes(platformKey)) {
        return { ...prev, platformAccess: current.filter((p) => p !== platformKey) };
      } else {
        return { ...prev, platformAccess: [...current, platformKey] };
      }
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaveStatus("idle");
    setSaveError("");
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Save failed (${res.status})`);
      }

      const data = await res.json();
      if (data.agent) {
        setAgent(data.agent);
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err) {
      setSaveStatus("error");
      setSaveError(err instanceof Error ? err.message : "Failed to save");
      setTimeout(() => setSaveStatus("idle"), 5000);
    } finally {
      setSaving(false);
    }
  }

  async function handleAction(action: string) {
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.agent) setAgent(data.agent);
    } catch {
      // silently fail for actions
    }
  }

  const statusColor = { running: "text-emerald-600", paused: "text-amber-600", error: "text-red-600", stopped: "text-slate-500", deploying: "text-blue-600" }[agent.status] || "text-slate-500";

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/agents" className="hover:text-slate-900">Agents</Link>
        <span>/</span>
        <span className="text-slate-900">{agent.name}</span>
      </div>

      {/* Status + actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{agent.avatar}</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-slate-900">{agent.name}</h2>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${ROLE_STYLES[agent.role] || ROLE_STYLES.worker}`}>
                  {agent.role}
                </span>
              </div>
              <p className="text-slate-500 mt-1">{agent.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2 text-sm ml-12">
            <span className={`font-medium ${statusColor}`}>{agent.status.toUpperCase()}</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-500">Uptime: {agent.metrics.uptime}</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-500">Last active: {agent.metrics.lastActive}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {agent.status !== "running" && <button onClick={() => handleAction("start")} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700">Start</button>}
          {agent.status === "running" && <button onClick={() => handleAction("pause")} className="px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700">Pause</button>}
          {agent.status !== "stopped" && !isGroot && <button onClick={() => handleAction("stop")} className="px-4 py-2 bg-red-600/80 text-white rounded-xl text-sm font-medium hover:bg-red-700">Stop</button>}
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { l: "CPU", v: `${agent.metrics.cpu}%` },
          { l: "Memory", v: `${agent.metrics.memory}%` },
          { l: "Tasks Done", v: agent.metrics.tasksCompleted.toLocaleString() },
          { l: "Queued", v: String(agent.metrics.tasksQueued) },
          { l: "Avg Latency", v: `${agent.metrics.avgResponseTime}s` },
          { l: "Error Rate", v: `${agent.metrics.errorRate}%` },
        ].map((m) => (
          <div key={m.l} className="bg-white border border-slate-200 shadow-sm rounded-xl p-3">
            <div className="text-xs text-slate-500">{m.l}</div>
            <div className="text-slate-900 font-semibold text-lg">{m.v}</div>
          </div>
        ))}
      </div>

      {/* Configuration form */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
        <h3 className="text-slate-900 font-semibold text-lg mb-4">Configuration</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={isGroot} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-xs text-slate-500 mb-1.5">Model</label>
            <ModelPicker
              value={form.model}
              onChange={(modelId) => setForm({ ...form, model: modelId })}
              agentRole={agent.role as "director" | "worker" | "specialist"}
              variant="expanded"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Thinking Level</label>
            <select value={form.thinking} onChange={(e) => setForm({ ...form, thinking: e.target.value as typeof form.thinking })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-brand-500">
              {["off", "minimal", "low", "medium", "high", "xhigh"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Temperature</label>
            <input type="number" step="0.1" min="0" max="1" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: +e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Max Tokens</label>
            <input type="number" value={form.maxTokens} onChange={(e) => setForm({ ...form, maxTokens: +e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Rate Limit (req/min)</label>
            <input type="number" value={form.rateLimit} onChange={(e) => setForm({ ...form, rateLimit: +e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Concurrency</label>
            <input type="number" value={form.maxConcurrency} onChange={(e) => setForm({ ...form, maxConcurrency: +e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Timeout (sec)</label>
            <input type="number" value={form.timeout} onChange={(e) => setForm({ ...form, timeout: +e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">DM Policy</label>
            <select value={form.dmPolicy} onChange={(e) => setForm({ ...form, dmPolicy: e.target.value as typeof form.dmPolicy })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-brand-500">
              {["pairing", "open", "closed"].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-xs text-slate-500 mb-1.5">System Prompt</label>
            <textarea value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })} rows={4} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-brand-500 resize-none" />
          </div>
        </div>

        {/* Save button + status feedback */}
        <div className="flex items-center justify-end gap-3 mt-4">
          {saveStatus === "success" && (
            <span className="text-sm text-emerald-400 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              Configuration saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-sm text-red-400 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
              {saveError || "Failed to save"}
            </span>
          )}
          <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">
            {saving ? "Saving\u2026" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Platform Access */}
      {configuredPlatforms.length > 0 && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-slate-900 font-semibold text-lg">Platform Access</h3>
              <p className="text-slate-500 text-xs mt-0.5">
                {isGroot
                  ? "Director agent has access to all platforms by default."
                  : "Toggle which platforms this agent can access when executing tasks."}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {configuredPlatforms.map((platform) => {
              const enabled = isPlatformEnabled(platform.platform);
              return (
                <div
                  key={platform.platform}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    enabled
                      ? "bg-slate-50 border-slate-200"
                      : "bg-white border-slate-200 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${platform.color} flex items-center justify-center text-sm`}>
                      {platform.icon}
                    </div>
                    <div>
                      <div className="text-slate-900 text-sm font-medium">{platform.label}</div>
                      <div className="text-xs text-slate-500">
                        {enabled ? "Access granted" : "No access"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => togglePlatformAccess(platform.platform)}
                    disabled={isGroot}
                    className={`relative w-9 h-5 rounded-full transition-colors ${
                      enabled ? "bg-emerald-600" : "bg-slate-300"
                    } ${isGroot ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                        enabled ? "translate-x-4" : ""
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
          {!isGroot && (
            <p className="text-[10px] text-slate-600 mt-3">
              Configure platforms in Settings &rarr; Platform Integrations. Only enabled platforms appear here.
            </p>
          )}
        </div>
      )}

      {/* Skills */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
        <h3 className="text-slate-900 font-semibold text-lg mb-4">Skills</h3>
        {agent.skills.length === 0 ? (
          <p className="text-slate-500">No skills configured for this agent.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {agent.skills.map((skill) => (
              <div key={skill.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <div className="text-slate-900 text-sm font-medium">{skill.name}</div>
                  <div className="text-slate-500 text-xs">{skill.description} · {skill.source}</div>
                </div>
                <span className={`text-xs font-medium ${skill.enabled ? "text-emerald-600" : "text-slate-500"}`}>
                  {skill.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent tasks */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
        <h3 className="text-slate-900 font-semibold text-lg mb-4">Recent Tasks</h3>
        {tasks.length === 0 ? (
          <p className="text-slate-500">No tasks for this agent yet.</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl text-sm">
                <span className={`w-16 text-xs font-medium ${t.status === "completed" ? "text-emerald-600" : t.status === "failed" ? "text-red-600" : t.status === "running" ? "text-blue-600" : t.status === "parked" ? "text-orange-600" : "text-slate-500"}`}>{t.status}</span>
                <span className="text-slate-900 flex-1 truncate">{t.input}</span>
                <span className="text-slate-500 font-mono">{t.duration}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
