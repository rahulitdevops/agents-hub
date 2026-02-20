"use client";

/**
 * ThinkingIndicator — Animated typing/thinking indicator for the chat.
 *
 * Shows an animated pulse with the Groot avatar while the agent is processing.
 * Includes elapsed time and visual feedback for extended waits.
 */

import { cn } from "@/lib/utils";

interface ThinkingIndicatorProps {
  elapsedSeconds: number;
  awayDuringRequest: boolean;
}

export function ThinkingIndicator({ elapsedSeconds, awayDuringRequest }: ThinkingIndicatorProps) {
  // Progressive messaging based on elapsed time
  const getMessage = () => {
    if (awayDuringRequest) return "Still processing in background";
    if (elapsedSeconds < 5) return "Thinking";
    if (elapsedSeconds < 15) return "Working on it";
    if (elapsedSeconds < 30) return "Taking a deep think";
    if (elapsedSeconds < 60) return "Complex task — still going";
    return "Deep processing — hang tight";
  };

  return (
    <div className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
      {/* Avatar with pulse */}
      <div className="flex-shrink-0 mt-1 relative">
        <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center text-sm shadow-lg shadow-emerald-500/10">
          🌱
        </div>
        {/* Pulse ring */}
        <div className="absolute inset-0 rounded-xl bg-emerald-500/20 animate-ping" style={{ animationDuration: "2s" }} />
      </div>

      {/* Content */}
      <div className="min-w-0">
        {/* Name */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-semibold text-emerald-600">Groot</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 font-medium animate-pulse">
            typing
          </span>
        </div>

        {/* Thinking bubbles */}
        <div className="inline-flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3">
          {/* Animated dots */}
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  elapsedSeconds > 30 ? "bg-brand-500" : "bg-emerald-500",
                )}
                style={{
                  animation: "thinking-bounce 1.4s ease-in-out infinite",
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>

          {/* Status text */}
          <span className={cn(
            "text-xs ml-1",
            awayDuringRequest ? "text-amber-600" : elapsedSeconds > 30 ? "text-brand-600" : "text-slate-500"
          )}>
            {getMessage()} · {elapsedSeconds}s
          </span>
        </div>

        {/* Extended wait hint */}
        {elapsedSeconds > 20 && (
          <p className="text-[10px] text-slate-400 mt-1.5 ml-1 animate-in fade-in duration-500">
            {awayDuringRequest
              ? "The agent is running in the background. Your response will appear when ready."
              : "The agent is using tools and running tasks. This can take a moment."}
          </p>
        )}
      </div>
    </div>
  );
}
