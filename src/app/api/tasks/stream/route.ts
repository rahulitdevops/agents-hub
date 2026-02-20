/**
 * GET /api/tasks/stream — Server-Sent Events (SSE) endpoint for real-time task updates.
 *
 * FIX: Real-time task result delivery to the UI.
 * Previously, task completions only showed on the task board after manual refresh.
 * Now the chat page and task board receive live updates via SSE.
 *
 * Usage (client-side):
 *   const es = new EventSource('/api/tasks/stream');
 *   es.addEventListener('task_update', (e) => {
 *     const { tasks, summary } = JSON.parse(e.data);
 *     // update UI
 *   });
 */

import { NextRequest } from "next/server";
import { runtime } from "@/lib/openclaw-runtime";

// How often to push task state to connected clients (ms)
const POLL_INTERVAL_MS = 2_000;

// Keepalive ping to prevent proxy/browser timeouts
const KEEPALIVE_INTERVAL_MS = 25_000;

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Helper to send an SSE event
      function send(event: string, data: unknown) {
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Client disconnected — ignore
        }
      }

      // Send initial state immediately
      send("task_update", {
        tasks: runtime.getTasks({ limit: 50 }),
        summary: runtime.getSummary(),
        agents: runtime.getAgents(),
        timestamp: Date.now(),
      });

      // Periodic task state push
      const pollTimer = setInterval(() => {
        send("task_update", {
          tasks: runtime.getTasks({ limit: 50 }),
          summary: runtime.getSummary(),
          agents: runtime.getAgents(),
          timestamp: Date.now(),
        });
      }, POLL_INTERVAL_MS);

      // Keepalive pings to prevent 30s proxy timeouts
      const keepaliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          // Client disconnected
        }
      }, KEEPALIVE_INTERVAL_MS);

      // Clean up on client disconnect
      req.signal.addEventListener("abort", () => {
        clearInterval(pollTimer);
        clearInterval(keepaliveTimer);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
      "Access-Control-Allow-Origin": "*",
    },
  });
}
