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
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
  },
  red: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    badge: "bg-red-100 text-red-700 border-red-200",
  },
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
  },
  slate: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-600",
    badge: "bg-slate-100 text-slate-600 border-slate-200",
  },
  purple: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
    badge: "bg-purple-100 text-purple-700 border-purple-200",
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
            result.success ? colors.badge : "bg-red-100 text-red-700 border-red-200"
          )}
        >
          {result.success ? "Success" : "Failed"}
        </span>
      </div>

      {/* Message */}
      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
        {result.message}
      </p>

      {/* Data pills (if any) */}
      {result.data && Object.keys(result.data).length > 0 && result.action !== "list_agents" && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {Object.entries(result.data).map(([key, value]) => (
            <span
              key={key}
              className="text-[10px] px-2 py-0.5 rounded-lg bg-white text-slate-500 border border-slate-200 font-mono"
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
          <div className="h-px flex-1 bg-gradient-to-r from-brand-500/20 to-transparent" />
          <span className="text-[10px] text-brand-500/60 font-medium uppercase tracking-wider flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Platform Actions
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-brand-500/20 to-transparent" />
        </div>

        {/* Cards */}
        {results.map((result, idx) => (
          <SingleCard key={idx} result={result} />
        ))}
      </div>
    </div>
  );
}
