/**
 * Agent Store — File-based persistence for agent configurations.
 *
 * Stores agent configs as JSON on the openclaw-data Docker volume
 * at /app/data/agents.json (same directory as settings.json).
 * Agents survive container restarts.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { AgentConfig } from "./types";

const DATA_DIR = join(process.cwd(), "data");
const AGENTS_PATH = join(DATA_DIR, "agents.json");

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
