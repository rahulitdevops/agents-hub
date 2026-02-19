"use client";

/**
 * ActionResultCard — Rich visual cards for agent action results.
 *
 * Instead of plain text like "✅ Agent created", this renders
 * professional cards with icons, action type labels, and data.
 */

import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActionResult {
  action: string;
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

interface ActionResultCardProps {
  results: ActionResult[];
}

// ─── Action Type Config ──────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  create_agent: {
    label: "Agent Created",
    icon: "🚀",
    color: "emerald",
  },
  update_agent: {
    label: "Agent Updated",
    icon: "✏️",
    color: "blue",
  },
  delete_agent: {
    label: "Agent Removed",
    icon: "🗑️",
    color: "red",
  },
  start_agent: {
    label: "Agent Started",
    icon: "▶️",
    color: "emerald",
  },
  pause_agent: {
    label: "Agent Paused",
    icon: "⏸️",
    color: "amber",
  },
  stop_agent: {
    label: "Agent Stopped",
    icon: "⏹️",
    color: "slate",
  },
  list_agents: {
    label: "Agent Roster",
    icon: "📋",
    color: "blue",
  },
  assign_task: {
    label: "Task Dispatched",
    icon: "📨",
    color: "purple",
  },
};

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  emerald: {
    bg: "bg-emerald-500/5",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  },
  blue: {
    bg: "bg-blue-500/5",
    border: "border-blue-500/20",
    text: "text-blue-400",
    badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  },
  red: {
    bg: "bg-red-500/5",
    border: "border-red-500/20",
    text: "text-red-400",
    badge: "bg-red-500/20 text-red-300 border-red-500/30",
  },
  amber: {
    bg: "bg-amber-500/5",
    border: "border-amber-500/20",
    text: "text-amber-400",
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  },
  slate: {
    bg: "bg-slate-500/5",
    border: "border-slate-500/20",
    text: "text-slate-400",
    badge: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  },
  purple: {
    bg: "bg-purple-500/5",
    border: "border-purple-500/20",
    text: "text-purple-400",
    badge: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  },
};

// ─── Single Result Card ──────────────────────────────────────────────────────

function SingleCard({ result }: { result: ActionResult }) {
  const config = ACTION_CONFIG[result.action] || {
    label: result.action,
    icon: "⚙️",
    color: "slate",
  };
  const colors = COLOR_MAP[result.success ? config.color : "red"] || COLOR_MAP.slate;

  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-all",
        colors.bg,
        colors.border,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-base">{config.icon}</span>
        <span className={cn("text-xs font-semibold", colors.text)}>
          {result.success ? config.label : `Failed: ${config.label}`}
        </span>
        <span
          className={cn(
            "ml-auto text-[10px] px-1.5 py-0.5 rounded-full border font-medium",
            result.success ? colors.badge : "bg-red-500/20 text-red-300 border-red-500/30"
          )}
        >
          {result.success ? "Success" : "Failed"}
        </span>
      </div>

      {/* Message */}
      <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
        {result.message}
      </p>

      {/* Data pills (if any) */}
      {result.data && Object.keys(result.data).length > 0 && result.action !== "list_agents" && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {Object.entries(result.data).map(([key, value]) => (
            <span
              key={key}
              className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800/80 text-slate-400 border border-slate-700/50 font-mono"
            >
              {key}: {String(value)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function ActionResultCards({ results }: ActionResultCardProps) {
  if (!results || results.length === 0) return null;

  return (
    <div className="flex gap-3 mt-1">
      {/* Left spacing to align with assistant messages */}
      <div className="flex-shrink-0 w-8" />

      <div className="flex-1 min-w-0 space-y-2">
        {/* Section header */}
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-gradient-to-r from-blue-500/20 to-transparent" />
          <span className="text-[10px] text-blue-400/60 font-medium uppercase tracking-wider flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Platform Actions
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-blue-500/20 to-transparent" />
        </div>

        {/* Cards */}
        {results.map((result, idx) => (
          <SingleCard key={idx} result={result} />
        ))}
      </div>
    </div>
  );
}
