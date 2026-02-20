/**
 * Agent Store — File-based persistence for agent configs AND tasks.
 *
 * Stores data as JSON on the openclaw-data Docker volume at /app/data/.
 * Both agents and tasks survive container restarts.
 *
 * FIX: Added task persistence (loadTasks / saveTasks).
 *      Tasks in "terminal" states (completed/failed/cancelled/parked)
 *      are persisted; active/queued/running tasks are ephemeral by design.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { AgentConfig, Task } from "./types";

const DATA_DIR = join(process.cwd(), "data");
const AGENTS_PATH = join(DATA_DIR, "agents.json");
const TASKS_PATH = join(DATA_DIR, "tasks.json");

// Keep last N terminal tasks to cap file size
const MAX_PERSISTED_TASKS = 500;

// ─── Agent Store ──────────────────────────────────────────────────────────────

interface AgentStore {
  version: number;
  agents: AgentConfig[];
}

/**
 * Load persisted agent configs from disk.
 * Returns empty array if file doesn't exist or is corrupt.
 */
export function loadAgents(): AgentConfig[] {
  try {
    if (existsSync(AGENTS_PATH)) {
      const raw = readFileSync(AGENTS_PATH, "utf-8");
      const store: AgentStore = JSON.parse(raw);
      if (store.agents && Array.isArray(store.agents) && store.agents.length > 0) {
        console.log(`[agent-store] Loaded ${store.agents.length} agent(s) from ${AGENTS_PATH}`);
        return store.agents;
      }
    }
  } catch (err) {
    console.error("[agent-store] Failed to load agents.json:", err);
  }
  return [];
}

/**
 * Save agent configs to disk.
 * Called after every create/update/delete operation.
 */
export function saveAgents(agents: AgentConfig[]): void {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    const store: AgentStore = { version: 1, agents };
    writeFileSync(AGENTS_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("[agent-store] Failed to save agents.json:", err);
  }
}

// ─── Task Store ───────────────────────────────────────────────────────────────

interface TaskStore {
  version: number;
  savedAt: string;
  tasks: Task[];
}

/**
 * Load persisted tasks from disk.
 * Only terminal-state tasks are stored (completed/failed/cancelled/parked).
 * Returns empty array if file doesn't exist or is corrupt.
 */
export function loadTasks(): Task[] {
  try {
    if (existsSync(TASKS_PATH)) {
      const raw = readFileSync(TASKS_PATH, "utf-8");
      const store: TaskStore = JSON.parse(raw);
      if (store.tasks && Array.isArray(store.tasks)) {
        console.log(`[agent-store] Loaded ${store.tasks.length} task(s) from ${TASKS_PATH}`);
        return store.tasks;
      }
    }
  } catch (err) {
    console.error("[agent-store] Failed to load tasks.json:", err);
  }
  return [];
}

/**
 * Save tasks to disk. Only persists terminal-state tasks to keep file small.
 * Active (queued/running) tasks are ephemeral — they restart clean after a crash.
 *
 * Called after every task status transition to a terminal state.
 */
export function saveTasks(tasks: Task[]): void {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }

    // Only persist terminal-state tasks
    const terminalStatuses = new Set(["completed", "failed", "cancelled", "parked"]);
    const persistable = tasks
      .filter((t) => terminalStatuses.has(t.status))
      .slice(0, MAX_PERSISTED_TASKS); // cap to prevent unbounded growth

    const store: TaskStore = {
      version: 1,
      savedAt: new Date().toISOString(),
      tasks: persistable,
    };

    writeFileSync(TASKS_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("[agent-store] Failed to save tasks.json:", err);
  }
}
