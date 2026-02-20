/**
 * useTaskStream — React hook for real-time task updates via SSE.
 *
 * Connect to /api/tasks/stream and get live task + agent + summary data.
 * Reconnects automatically on disconnect with exponential backoff.
 *
 * Usage:
 *   const { tasks, summary, agents, connected } = useTaskStream();
 */

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { Task, AgentConfig } from "@/lib/types";

interface StreamPayload {
  tasks: Task[];
  summary: Record<string, number>;
  agents: AgentConfig[];
  timestamp: number;
}

interface UseTaskStreamResult {
  tasks: Task[];
  summary: Record<string, number>;
  agents: AgentConfig[];
  connected: boolean;
  lastUpdated: number | null;
}

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

export function useTaskStream(): UseTaskStreamResult {
  const [data, setData] = useState<StreamPayload | null>(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // Clean up existing connection
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const es = new EventSource("/api/tasks/stream");
    esRef.current = es;

    es.addEventListener("task_update", (event) => {
      try {
        const payload: StreamPayload = JSON.parse(event.data);
        setData(payload);
        setConnected(true);
        backoffRef.current = INITIAL_BACKOFF_MS; // Reset backoff on success
      } catch {
        console.error("[useTaskStream] Failed to parse SSE payload");
      }
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      esRef.current = null;

      if (!mountedRef.current) return;

      // Reconnect with exponential backoff
      const delay = backoffRef.current;
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);

      console.log(`[useTaskStream] Reconnecting in ${delay}ms...`);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    es.onopen = () => {
      setConnected(true);
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [connect]);

  return {
    tasks: data?.tasks ?? [],
    summary: data?.summary ?? {},
    agents: data?.agents ?? [],
    connected,
    lastUpdated: data?.timestamp ?? null,
  };
}

/**
 * useTaskNotifications — Listens for task completions and fires a callback.
 *
 * Usage in chat page:
 *   useTaskNotifications((task) => {
 *     addMessage({ role: "system", content: `✅ ${task.agentName} completed: ${task.output}` });
 *   });
 */
export function useTaskNotifications(
  onComplete: (task: Task) => void,
  onFailed?: (task: Task) => void,
) {
  const seenIds = useRef<Set<string>>(new Set());
  const { tasks } = useTaskStream();

  useEffect(() => {
    for (const task of tasks) {
      if (seenIds.current.has(task.id)) continue;

      if (task.status === "completed" || task.status === "failed") {
        seenIds.current.add(task.id);
        if (task.status === "completed") {
          onComplete(task);
        } else if (task.status === "failed" && onFailed) {
          onFailed(task);
        }
      }
    }
  }, [tasks, onComplete, onFailed]);
}
