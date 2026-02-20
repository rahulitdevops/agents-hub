"use client";

/**
 * ChatInput — Enhanced chat input area with:
 *   - Auto-resizing textarea
 *   - Thinking level selector integrated
 *   - Send / Cancel buttons with keyboard shortcuts
 *   - Character count & conversation stats
 *   - Slash command hints
 */

import { useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  loading: boolean;
  thinking: string;
  onThinkingChange: (level: string) => void;
  chatCount: number;
  elapsedSeconds: number;
  awayDuringRequest: boolean;
}

// ─── Thinking Level Config ────────────────────────────────────────────────────

const THINKING_LEVELS = [
  { value: "off", label: "Off", icon: "💤", desc: "No chain-of-thought" },
  { value: "minimal", label: "Minimal", icon: "💡", desc: "Quick reasoning" },
  { value: "low", label: "Low", icon: "🧠", desc: "Light thinking" },
  { value: "medium", label: "Medium", icon: "🧠", desc: "Balanced thinking" },
  { value: "high", label: "High", icon: "🔬", desc: "Deep reasoning" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatInput({
  value,
  onChange,
  onSend,
  onCancel,
  loading,
  thinking,
  onThinkingChange,
  chatCount,
  elapsedSeconds,
  awayDuringRequest,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Re-focus after loading ends
  useEffect(() => {
    if (!loading) {
      textareaRef.current?.focus();
    }
  }, [loading]);

  // Auto-resize textarea
  const handleInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.target as HTMLTextAreaElement;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSend();
      }
      if (e.key === "Escape" && loading) {
        e.preventDefault();
        onCancel();
      }
    },
    [onSend, onCancel, loading],
  );

  const loadingLabel = awayDuringRequest
    ? `Still processing · ${elapsedSeconds}s`
    : `Thinking · ${elapsedSeconds}s`;

  return (
    <div className="border-t border-slate-200 bg-white/50 backdrop-blur-sm">
      {/* Loading bar */}
      {loading && (
        <div className="relative h-0.5 bg-slate-100 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-500 via-emerald-500 to-brand-500 animate-shimmer" />
        </div>
      )}

      {/* Loading status */}
      {loading && (
        <div className="flex items-center justify-center gap-3 py-2 bg-slate-50/50">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span className={cn("text-xs", awayDuringRequest ? "text-amber-600" : "text-slate-500")}>
            {loadingLabel}
          </span>
          <button
            onClick={onCancel}
            className="text-[10px] px-2 py-0.5 rounded-lg border border-slate-200 text-slate-500
                       hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            Cancel
          </button>
          {awayDuringRequest && (
            <span className="text-[10px] text-amber-500/60">
              (Request running in background)
            </span>
          )}
        </div>
      )}

      <div className="px-4 py-3">
        {/* Input container */}
        <div className={cn(
          "flex items-end gap-2 rounded-2xl border transition-all duration-200",
          loading
            ? "bg-slate-50 border-slate-200"
            : "bg-white border-slate-200 focus-within:border-brand-500 focus-within:shadow-lg focus-within:shadow-brand-500/5"
        )}>
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={loading ? "Waiting for response..." : "Message Groot... (Enter to send, Shift+Enter for new line)"}
            rows={1}
            disabled={loading}
            className="flex-1 bg-transparent text-slate-900 text-sm resize-none px-4 py-3 focus:outline-none placeholder:text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ maxHeight: "160px" }}
          />

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 px-2 pb-2">
            {/* Thinking level toggle */}
            <div className="relative group/think">
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] transition-all",
                  "border border-slate-200 hover:border-slate-300",
                  thinking === "off"
                    ? "text-slate-500 bg-slate-50"
                    : thinking === "high"
                      ? "text-purple-600 bg-purple-50 border-purple-200"
                      : "text-emerald-600 bg-emerald-50 border-emerald-200"
                )}
              >
                <span className="text-xs">{THINKING_LEVELS.find((t) => t.value === thinking)?.icon || "🧠"}</span>
                <span className="hidden sm:inline">{thinking}</span>
              </button>

              {/* Dropdown */}
              <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover/think:block z-50">
                <div className="bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/50 p-1 min-w-[160px]">
                  <div className="px-2 py-1 text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    Thinking Level
                  </div>
                  {THINKING_LEVELS.map((level) => (
                    <button
                      key={level.value}
                      onClick={() => onThinkingChange(level.value)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all",
                        thinking === level.value
                          ? "bg-brand-50 text-brand-600"
                          : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <span>{level.icon}</span>
                      <span className="font-medium">{level.label}</span>
                      <span className="text-[10px] text-slate-400 ml-auto">{level.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Send button */}
            <button
              onClick={onSend}
              disabled={!value.trim() || loading}
              className={cn(
                "shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200",
                value.trim() && !loading
                  ? "bg-brand-600 hover:bg-brand-500 shadow-lg shadow-brand-600/20 hover:shadow-brand-500/30"
                  : "bg-slate-100 cursor-not-allowed opacity-30"
              )}
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>

        {/* Bottom status bar */}
        <div className="flex items-center justify-between mt-1.5 px-2">
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            {chatCount > 0 ? (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                </svg>
                {chatCount} messages
              </span>
            ) : (
              <span>New conversation</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span className="hidden sm:inline">
              <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-400 text-[9px]">Enter</kbd>
              {" "}send
            </span>
            <span className="hidden sm:inline">
              <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-400 text-[9px]">Shift+Enter</kbd>
              {" "}new line
            </span>
            {loading && (
              <span className="hidden sm:inline">
                <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-400 text-[9px]">Esc</kbd>
                {" "}cancel
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
