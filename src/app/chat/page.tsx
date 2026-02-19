"use client";

/**
 * Chat Page — Professional-grade agent chat interface.
 *
 * Features:
 *   - Rich markdown rendering for assistant messages (code blocks, tables, lists)
 *   - Syntax-highlighted code with copy buttons
 *   - Agent action result cards
 *   - Date separators between message groups
 *   - Animated thinking indicator
 *   - Enhanced input with integrated thinking selector
 *   - Session persistence via sessionStorage
 *   - keepalive fetch for background tab resilience
 *   - AbortController for request cancellation
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ChatMessage,
  ChatInput,
  ThinkingIndicator,
  ActionResultCards,
  type ChatMessageData,
  type ActionResult,
} from "@/components/chat";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActionResultMessage {
  id: string;
  type: "action-results";
  results: ActionResult[];
  timestamp: string;
}

type ChatItem = ChatMessageData | ActionResultMessage;

function isActionResult(item: ChatItem): item is ActionResultMessage {
  return "type" in item && item.type === "action-results";
}

// ─── Session Persistence ──────────────────────────────────────────────────────

const STORAGE_KEY = "groot-chat-messages";

function loadMessages(): ChatItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveMessages(items: ChatItem[]) {
  try {
    // Only save user + assistant messages + action results (not system)
    const toSave = items.filter((m) => {
      if (isActionResult(m)) return true;
      return m.role !== "system";
    });
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch { /* ignore */ }
}

// ─── Date Separator Helper ────────────────────────────────────────────────────

function DateSeparator({ date }: { date: string }) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let label: string;
  if (d.toDateString() === today.toDateString()) {
    label = "Today";
  } else if (d.toDateString() === yesterday.toDateString()) {
    label = "Yesterday";
  } else {
    label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-800/60" />
      <span className="text-[10px] text-slate-600 font-medium uppercase tracking-wider px-2">{label}</span>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-800/60" />
    </div>
  );
}

// ─── Welcome Screen ───────────────────────────────────────────────────────────

function WelcomeScreen() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md space-y-4">
        {/* Logo */}
        <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center text-3xl shadow-2xl shadow-emerald-500/20 mx-auto">
          🌱
        </div>

        {/* Title */}
        <div>
          <h1 className="text-xl font-bold text-white">Groot</h1>
          <p className="text-sm text-slate-400 mt-1">Director Agent</p>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-500 leading-relaxed">
          I orchestrate your team of AI agents. Ask me to create agents, assign tasks,
          analyze data, write code, or coordinate complex multi-step workflows.
        </p>

        {/* Quick suggestions */}
        <div className="space-y-2 pt-2">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold">Try asking</p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              "What agents do I have?",
              "Create a research agent",
              "Help me write a Python script",
              "Summarize my agent setup",
            ].map((suggestion) => (
              <span
                key={suggestion}
                className="text-xs px-3 py-1.5 rounded-full bg-slate-800/50 text-slate-400 border border-slate-700/50 cursor-default"
              >
                {suggestion}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Chat Header ──────────────────────────────────────────────────────────────

function ChatHeader({
  chatCount,
  loading,
  onClear,
}: {
  chatCount: number;
  loading: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/80 bg-slate-950/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center text-lg shadow-lg shadow-emerald-500/10">
            🌱
          </div>
          {/* Online indicator */}
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950" />
        </div>
        <div>
          <h2 className="text-white font-semibold text-sm leading-tight">Groot</h2>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span>Director Agent</span>
            {loading && (
              <>
                <span className="text-slate-700">·</span>
                <span className="text-emerald-500 animate-pulse">typing...</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Message count */}
        {chatCount > 0 && (
          <span className="text-[10px] px-2 py-1 rounded-lg bg-slate-800/50 text-slate-500 border border-slate-700/30">
            {chatCount} msgs
          </span>
        )}

        {/* Clear chat */}
        {chatCount > 0 && !loading && (
          <button
            onClick={onClear}
            className="text-[11px] text-slate-500 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/5 border border-transparent hover:border-red-500/20 flex items-center gap-1"
            title="Clear conversation"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function ChatPage() {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [thinking, setThinking] = useState<string>("medium");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [awayDuringRequest, setAwayDuringRequest] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── Load persisted messages on mount ────────────────────────────────────────
  useEffect(() => {
    const saved = loadMessages();
    if (saved.length > 0) {
      setItems(saved);
    }
    setInitialized(true);
  }, []);

  // ── Save messages whenever they change ──────────────────────────────────────
  useEffect(() => {
    if (initialized) {
      saveMessages(items);
    }
  }, [items, initialized]);

  // ── Auto-scroll to bottom ───────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, loading]);

  // ── Elapsed time counter while loading ──────────────────────────────────────
  useEffect(() => {
    if (!loading) {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [loading]);

  // ── Visibility change handler ───────────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      if (document.hidden && loading) {
        setAwayDuringRequest(true);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [loading]);

  // Reset away state when loading finishes
  useEffect(() => {
    if (!loading) setAwayDuringRequest(false);
  }, [loading]);

  // ── Send Message ────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessageData = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    setItems((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setAwayDuringRequest(false);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, thinking }),
        keepalive: true,
        signal: controller.signal,
      });

      const data = await res.json();

      if (res.ok && data.reply) {
        const assistantMsg: ChatMessageData = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.reply,
          timestamp: new Date().toISOString(),
          model: data.model,
          tokensUsed: data.tokensUsed,
          duration: data.duration,
        };
        setItems((prev) => [...prev, assistantMsg]);

        // Show agent action results as rich cards
        if (data.agentActions && data.agentActions.length > 0) {
          const actionItem: ActionResultMessage = {
            id: `actions-${Date.now()}`,
            type: "action-results",
            results: data.agentActions,
            timestamp: new Date().toISOString(),
          };
          setItems((prev) => [...prev, actionItem]);
        }
      } else {
        const errorMsg: ChatMessageData = {
          id: `error-${Date.now()}`,
          role: "system",
          content: `Error: ${data.error || "Failed to get response"}${data.details ? ` — ${data.details}` : ""}`,
          timestamp: new Date().toISOString(),
        };
        setItems((prev) => [...prev, errorMsg]);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setItems((prev) => [
          ...prev,
          {
            id: `cancelled-${Date.now()}`,
            role: "system" as const,
            content: "Request cancelled. You can send a new message.",
            timestamp: new Date().toISOString(),
          },
        ]);
      } else {
        setItems((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "system" as const,
            content: "Connection interrupted. The agent may still be processing — try sending your message again.",
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [input, loading, thinking]);

  // ── Cancel ──────────────────────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  // ── Clear Chat ──────────────────────────────────────────────────────────────
  const handleClearChat = useCallback(() => {
    setItems([]);
    sessionStorage.removeItem(STORAGE_KEY);
    fetch("/api/chat/clear", { method: "POST" }).catch(() => { /* ignore */ });
  }, []);

  // ── Derived state ───────────────────────────────────────────────────────────
  const chatCount = items.filter((m) => !isActionResult(m) && (m.role === "user" || m.role === "assistant")).length;
  const hasMessages = items.length > 0;

  // ── Check if we need date separator between items ───────────────────────────
  function needsDateSeparator(currentItem: ChatItem, prevItem: ChatItem | undefined): boolean {
    if (!prevItem) return true; // Always show separator before first message
    const currentDate = new Date(currentItem.timestamp).toDateString();
    const prevDate = new Date(prevItem.timestamp).toDateString();
    return currentDate !== prevDate;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto">
      {/* Header */}
      <ChatHeader chatCount={chatCount} loading={loading} onClear={handleClearChat} />

      {/* Messages Area */}
      {!hasMessages && !loading ? (
        <WelcomeScreen />
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {items.map((item, idx) => {
            const prevItem = idx > 0 ? items[idx - 1] : undefined;
            const showDate = needsDateSeparator(item, prevItem);

            return (
              <div key={isActionResult(item) ? item.id : item.id}>
                {/* Date separator */}
                {showDate && <DateSeparator date={item.timestamp} />}

                {/* Render item */}
                {isActionResult(item) ? (
                  <ActionResultCards results={item.results} />
                ) : (
                  <ChatMessage
                    message={item}
                    isLatest={idx === items.length - 1}
                  />
                )}
              </div>
            );
          })}

          {/* Thinking indicator */}
          {loading && (
            <ThinkingIndicator
              elapsedSeconds={elapsedSeconds}
              awayDuringRequest={awayDuringRequest}
            />
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onCancel={handleCancel}
        loading={loading}
        thinking={thinking}
        onThinkingChange={setThinking}
        chatCount={chatCount}
        elapsedSeconds={elapsedSeconds}
        awayDuringRequest={awayDuringRequest}
      />
    </div>
  );
}
