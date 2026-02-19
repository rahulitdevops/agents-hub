/**
 * OpenClaw Runtime — bridges the Next.js server with the OpenClaw Gateway.
 *
 * Connects via WebSocket to the local OpenClaw Gateway daemon.
 * Agent configs are persisted to /app/data/agents.json (Docker volume).
 * Tasks and analytics are kept in-memory (ephemeral).
 */

import { v4 as uuid } from "uuid";
import {
  GROOT_AGENT_ID,
  type AgentConfig,
  type AgentMetrics,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type GatewayEvent,
  type AnalyticsDataPoint,
} from "./types";
import { loadAgents, saveAgents } from "./agent-store";

// ─── Available Models ────────────────────────────────────────────────────────
// Model list is derived from the centralized registry — add models there.

import { MODEL_IDS } from "./model-registry";
export const MODELS = MODEL_IDS;

function emptyMetrics(): AgentMetrics {
  return {
    uptime: "0d 0h",
    cpu: 0,
    memory: 0,
    tasksCompleted: 0,
    tasksQueued: 0,
    avgResponseTime: 0,
    errorRate: 0,
    lastActive: "never",
    tokensUsed: 0,
    totalCost: 0,
  };
}

// ─── Default Groot Config ───────────────────────────────────────────────────

function createGrootConfig(): AgentConfig {
  return {
    id: GROOT_AGENT_ID,
    name: "Groot",
    description: "Director agent — orchestrates all other agents",
    role: "director",
    avatar: "🌱",
    model: "anthropic/claude-opus-4-6",
    status: "running",
    thinking: "high",
    temperature: 0.3,
    maxTokens: 8192,
    systemPrompt:
      "You are Groot, the Director agent on the OpenClaw Platform. " +
      "You manage a team of sub-agents and coordinate tasks across them.\n\n" +
      "CRITICAL: Always read PLATFORM-CONTEXT.md in your workspace before responding — " +
      "it lists your CURRENT team of agents with their IDs, roles, and status. " +
      "These agents are REAL and running on the platform. You coordinate them " +
      "using [AGENT_ACTION] blocks (see AGENT-MANAGEMENT.md).\n\n" +
      "To DELEGATE work to an agent, use assign_task:\n" +
      "[AGENT_ACTION]{\"action\":\"assign_task\",\"params\":{\"agentId\":\"<id from PLATFORM-CONTEXT.md>\",\"input\":\"<task description>\",\"priority\":\"high\"}}[/AGENT_ACTION]\n\n" +
      "To CREATE/DELETE/START/STOP agents, use the corresponding action blocks.\n\n" +
      "When the user asks you to coordinate with or assign work to an agent, " +
      "look up the agent's ID from PLATFORM-CONTEXT.md and use assign_task. " +
      "Do NOT say agents don't exist if they're listed in PLATFORM-CONTEXT.md.\n\n" +
      "Be genuinely helpful, not performatively helpful. Skip corporate pleasantries — just do the thing. " +
      "Have opinions, be resourceful, earn trust through competence. " +
      "Start WhatsApp messages with 🌱. Mix Hindi/English naturally when the user does.",
    skills: [
      { id: "sk-orchestration", name: "Agent Orchestration", description: "Coordinate and delegate tasks across agents", enabled: true, source: "bundled" },
      { id: "sk-agent-mgmt", name: "Agent Management", description: "Create, configure, and manage sub-agents via action blocks", enabled: true, source: "bundled" },
      { id: "sk-memory", name: "Memory Management", description: "Persistent memory through workspace files", enabled: true, source: "workspace" },
      { id: "sk-web-search", name: "Web Search", description: "Search the web for information", enabled: true, source: "bundled" },
    ],
    channels: [
      { type: "webchat", enabled: true, config: {} },
      { type: "whatsapp", enabled: true, config: {} },
    ],
    rateLimit: 500,
    maxConcurrency: 10,
    timeout: 120,
    retryPolicy: "exponential",
    maxRetries: 3,
    dmPolicy: "pairing",
    platformAccess: ["*"], // Groot has access to all platforms
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metrics: emptyMetrics(),
  };
}

// ─── Runtime Singleton ───────────────────────────────────────────────────────

class OpenClawRuntime {
  private agents: Map<string, AgentConfig> = new Map();
  private tasks: Task[] = [];
  private analytics: AnalyticsDataPoint[] = [];
  private events: GatewayEvent[] = [];
  private gatewayConnected = false;

  constructor() {
    // 1. Try loading persisted agents from disk
    const persisted = loadAgents();

    if (persisted.length > 0) {
      for (const agent of persisted) {
        // Ensure metrics object exists (older saved data may lack it)
        if (!agent.metrics) agent.metrics = emptyMetrics();
        // Ensure platformAccess exists (backward compat)
        if (!agent.platformAccess) agent.platformAccess = agent.id === GROOT_AGENT_ID ? ["*"] : [];
        this.agents.set(agent.id, agent);
      }
      console.log(`[runtime] Restored ${persisted.length} agent(s) from disk`);
    }

    // 2. Ensure Groot always exists with canonical defaults
    if (!this.agents.has(GROOT_AGENT_ID)) {
      const groot = createGrootConfig();
      this.agents.set(groot.id, groot);
      this.persist();
      console.log("[runtime] Seeded Groot (no persisted data found)");
    } else {
      // Update Groot's system prompt and skills to latest (code takes precedence)
      const existing = this.agents.get(GROOT_AGENT_ID)!;
      const canonical = createGrootConfig();
      existing.systemPrompt = canonical.systemPrompt;
      existing.skills = canonical.skills;
      existing.description = canonical.description;
      // Preserve user-modified fields: model, thinking, temperature, status, etc.
      this.agents.set(GROOT_AGENT_ID, existing);
    }
  }

  // ── Persistence ─────────────────────────────────────────────────────────

  private persist() {
    saveAgents(this.getAgents());
  }

  // ── Agents ───────────────────────────────────────────────────────────────

  getAgents(): AgentConfig[] {
    const all = Array.from(this.agents.values());
    // Director agent always first
    return all.sort((a, b) => {
      if (a.id === GROOT_AGENT_ID) return -1;
      if (b.id === GROOT_AGENT_ID) return 1;
      return 0;
    });
  }

  getAgent(id: string): AgentConfig | undefined {
    return this.agents.get(id);
  }

  createAgent(partial: Partial<AgentConfig>): AgentConfig {
    const agent: AgentConfig = {
      id: `oc-agent-${uuid().slice(0, 8)}`,
      name: partial.name || "New Agent",
      description: partial.description || "",
      role: partial.role || "worker",
      avatar: partial.avatar || "🤖",
      model: partial.model || "anthropic/claude-sonnet-4-6",
      status: "stopped",
      thinking: partial.thinking || "medium",
      temperature: partial.temperature ?? 0.3,
      maxTokens: partial.maxTokens ?? 4096,
      systemPrompt: partial.systemPrompt || "You are a helpful AI assistant.",
      skills: partial.skills || [],
      channels: partial.channels || [{ type: "webchat", enabled: true, config: {} }],
      rateLimit: partial.rateLimit ?? 500,
      maxConcurrency: partial.maxConcurrency ?? 10,
      timeout: partial.timeout ?? 60,
      retryPolicy: partial.retryPolicy || "exponential",
      maxRetries: partial.maxRetries ?? 3,
      dmPolicy: partial.dmPolicy || "pairing",
      platformAccess: partial.platformAccess || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metrics: emptyMetrics(),
    };
    this.agents.set(agent.id, agent);
    this.persist();
    this.pushEvent({ type: "agent_started", agentId: agent.id, data: { name: agent.name }, timestamp: new Date().toISOString() });
    return agent;
  }

  updateAgent(id: string, updates: Partial<AgentConfig>): AgentConfig | null {
    const agent = this.agents.get(id);
    if (!agent) return null;
    const updated = { ...agent, ...updates, updatedAt: new Date().toISOString() };
    this.agents.set(id, updated);
    this.persist();
    return updated;
  }

  deleteAgent(id: string): boolean {
    if (id === GROOT_AGENT_ID) return false; // Cannot delete the Director agent
    const deleted = this.agents.delete(id);
    if (deleted) this.persist();
    return deleted;
  }

  startAgent(id: string): AgentConfig | null {
    return this.updateAgent(id, { status: "running" });
  }

  pauseAgent(id: string): AgentConfig | null {
    return this.updateAgent(id, { status: "paused" });
  }

  stopAgent(id: string): AgentConfig | null {
    return this.updateAgent(id, { status: "stopped" });
  }

  // ── Tasks ────────────────────────────────────────────────────────────────

  getTasks(filters?: { status?: TaskStatus; agentId?: string; limit?: number }): Task[] {
    let result = [...this.tasks];
    if (filters?.status) result = result.filter((t) => t.status === filters.status);
    if (filters?.agentId) result = result.filter((t) => t.agentId === filters.agentId);
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (filters?.limit) result = result.slice(0, filters.limit);
    return result;
  }

  createTask(partial: Partial<Task>): Task {
    const agent = partial.agentId ? this.agents.get(partial.agentId) : undefined;
    const task: Task = {
      id: `task-${uuid().slice(0, 8)}`,
      agentId: partial.agentId || "",
      agentName: agent?.name || partial.agentName || "Unknown",
      type: partial.type || "general",
      status: "queued",
      priority: partial.priority || "medium",
      input: partial.input || "",
      output: "Waiting\u2026",
      createdAt: new Date().toISOString(),
      duration: "\u2014",
      tokensUsed: 0,
      cost: 0,
      metadata: partial.metadata,
    };
    this.tasks.unshift(task);
    return task;
  }

  updateTask(id: string, updates: Partial<Task>): Task | null {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return null;
    Object.assign(task, updates);
    return task;
  }

  cancelTask(id: string): Task | null {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return null;
    task.status = "cancelled";
    task.completedAt = new Date().toISOString();
    return task;
  }

  // ── Analytics ──────────────────────────────────────────────────────────

  getAnalytics(): AnalyticsDataPoint[] {
    return this.analytics;
  }

  getSummary() {
    const agents = this.getAgents();
    const tasks = this.tasks;
    const running = agents.filter((a) => a.status === "running");
    return {
      totalAgents: agents.length,
      runningAgents: running.length,
      errorAgents: agents.filter((a) => a.status === "error").length,
      totalTasks: tasks.length,
      completedTasks: tasks.filter((t) => t.status === "completed").length,
      failedTasks: tasks.filter((t) => t.status === "failed").length,
      queuedTasks: tasks.filter((t) => t.status === "queued").length,
      runningTasks: tasks.filter((t) => t.status === "running").length,
      totalTokens: agents.reduce((s, a) => s + a.metrics.tokensUsed, 0),
      totalCost: agents.reduce((s, a) => s + a.metrics.totalCost, 0),
      avgResponseTime: running.length > 0
        ? +(running.reduce((s, a) => s + a.metrics.avgResponseTime, 0) / running.length).toFixed(1)
        : 0,
    };
  }

  // ── Gateway Events ─────────────────────────────────────────────────────

  private pushEvent(event: GatewayEvent) {
    this.events.unshift(event);
    if (this.events.length > 1000) this.events.length = 1000;
  }

  getEvents(limit = 50): GatewayEvent[] {
    return this.events.slice(0, limit);
  }

  getGatewayStatus() {
    return {
      connected: this.gatewayConnected,
      url: process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789",
      agents: this.getAgents().filter((a) => a.status === "running").length,
    };
  }
}

// Export singleton
export const runtime = new OpenClawRuntime();
