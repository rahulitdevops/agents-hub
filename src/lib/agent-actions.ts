/**
 * Agent Actions — Intercept-and-Execute engine for Groot's agent management.
 *
 * Groot includes [AGENT_ACTION]{...}[/AGENT_ACTION] blocks in chat responses.
 * This module parses those blocks, executes them against the runtime, and
 * returns clean display text + execution results.
 */

import { runtime, MODELS } from "./openclaw-runtime";
import { GROOT_AGENT_ID, type AgentConfig } from "./types";
import { dispatchToWorkerPoolAsync } from "./worker-client";
import { loadPlatformIntegrations } from "./settings";
import { resolveAgentPlatformEnv } from "./platform-integrations";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AgentAction {
  action: string;
  params: Record<string, unknown>;
}

export interface ActionResult {
  action: string;
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export interface ProcessedResponse {
  displayText: string;
  actionResults: ActionResult[];
}

// ─── Regex ──────────────────────────────────────────────────────────────────

const ACTION_BLOCK_RE = /\[AGENT_ACTION\]\s*([\s\S]*?)\s*\[\/AGENT_ACTION\]/g;

// ─── Extract action blocks from raw agent output ────────────────────────────

export function extractActions(rawText: string): {
  cleanText: string;
  actions: AgentAction[];
} {
  const actions: AgentAction[] = [];

  const cleanText = rawText
    .replace(ACTION_BLOCK_RE, (_, jsonStr: string) => {
      try {
        const parsed = JSON.parse(jsonStr.trim());
        if (parsed.action && typeof parsed.action === "string") {
          actions.push({
            action: parsed.action,
            params: parsed.params || {},
          });
        }
      } catch {
        // Malformed JSON — skip silently
        console.warn("[agent-actions] Malformed action block:", jsonStr.substring(0, 100));
      }
      return ""; // Strip the action block from displayed text
    })
    .replace(/\n{3,}/g, "\n\n") // Collapse excessive newlines left behind
    .trim();

  return { cleanText, actions };
}

// ─── Execute a single action ────────────────────────────────────────────────

export function executeAction(action: AgentAction): ActionResult {
  const { action: actionType, params = {} } = action;

  try {
    switch (actionType) {
      case "create_agent":
        return executeCreateAgent(params);
      case "update_agent":
        return executeUpdateAgent(params);
      case "delete_agent":
        return executeDeleteAgent(params);
      case "start_agent":
        return executeStatusChange(params, "start");
      case "pause_agent":
        return executeStatusChange(params, "pause");
      case "stop_agent":
        return executeStatusChange(params, "stop");
      case "list_agents":
        return executeListAgents();
      case "assign_task":
        return executeAssignTask(params);
      default:
        return {
          action: actionType,
          success: false,
          message: `Unknown action: ${actionType}`,
        };
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    return { action: actionType, success: false, message: `Error: ${errMsg}` };
  }
}

// ─── Action: Create Agent ───────────────────────────────────────────────────

function executeCreateAgent(params: Record<string, unknown>): ActionResult {
  const name = params.name as string;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return {
      action: "create_agent",
      success: false,
      message: "Agent name is required",
    };
  }

  // Check duplicate names
  const existing = runtime
    .getAgents()
    .find((a) => a.name.toLowerCase() === name.trim().toLowerCase());
  if (existing) {
    return {
      action: "create_agent",
      success: false,
      message: `Agent "${name}" already exists (id: ${existing.id})`,
    };
  }

  // Validate model
  if (params.model && typeof params.model === "string") {
    if (!MODELS.includes(params.model)) {
      return {
        action: "create_agent",
        success: false,
        message: `Invalid model "${params.model}". Available: ${MODELS.join(", ")}`,
      };
    }
  }

  // Validate role — director is reserved for Groot
  const validRoles = ["worker", "specialist"];
  if (params.role && !validRoles.includes(params.role as string)) {
    return {
      action: "create_agent",
      success: false,
      message: `Invalid role "${params.role}". Use "worker" or "specialist".`,
    };
  }

  // Build agent config from params
  const agentPartial: Partial<AgentConfig> = {
    name: name.trim(),
    description: (params.description as string) || "",
    role: (params.role as AgentConfig["role"]) || "specialist",
    avatar: (params.avatar as string) || "🤖",
    model: (params.model as string) || "anthropic/claude-sonnet-4-5",
    systemPrompt: (params.systemPrompt as string) || undefined,
    thinking: (params.thinking as AgentConfig["thinking"]) || "medium",
    temperature:
      typeof params.temperature === "number" ? params.temperature : undefined,
  };

  const agent = runtime.createAgent(agentPartial);

  // Auto-start the agent
  runtime.startAgent(agent.id);

  return {
    action: "create_agent",
    success: true,
    message: `Agent "${agent.name}" created and started (id: ${agent.id})`,
    data: {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      model: agent.model,
      status: "running",
    },
  };
}

// ─── Action: Update Agent ───────────────────────────────────────────────────

function executeUpdateAgent(params: Record<string, unknown>): ActionResult {
  const id = params.id as string;
  if (!id) {
    return {
      action: "update_agent",
      success: false,
      message: "Agent ID is required",
    };
  }

  // Protect Groot's role
  if (id === GROOT_AGENT_ID && params.role && params.role !== "director") {
    return {
      action: "update_agent",
      success: false,
      message: "Cannot change Groot's role",
    };
  }

  // Validate model if being updated
  if (params.model && typeof params.model === "string") {
    if (!MODELS.includes(params.model)) {
      return {
        action: "update_agent",
        success: false,
        message: `Invalid model "${params.model}". Available: ${MODELS.join(", ")}`,
      };
    }
  }

  // Extract id from params, pass the rest as updates
  const { id: _id, ...updates } = params;
  const agent = runtime.updateAgent(id, updates as Partial<AgentConfig>);

  if (!agent) {
    return {
      action: "update_agent",
      success: false,
      message: `Agent "${id}" not found`,
    };
  }

  return {
    action: "update_agent",
    success: true,
    message: `Agent "${agent.name}" updated`,
    data: { id: agent.id, name: agent.name },
  };
}

// ─── Action: Delete Agent ───────────────────────────────────────────────────

function executeDeleteAgent(params: Record<string, unknown>): ActionResult {
  const id = params.id as string;
  if (!id) {
    return {
      action: "delete_agent",
      success: false,
      message: "Agent ID is required",
    };
  }

  if (id === GROOT_AGENT_ID) {
    return {
      action: "delete_agent",
      success: false,
      message: "Cannot delete Groot (Director agent)",
    };
  }

  const agent = runtime.getAgent(id);
  if (!agent) {
    return {
      action: "delete_agent",
      success: false,
      message: `Agent "${id}" not found`,
    };
  }

  const name = agent.name;
  const deleted = runtime.deleteAgent(id);

  if (!deleted) {
    return {
      action: "delete_agent",
      success: false,
      message: `Failed to delete agent "${id}"`,
    };
  }

  return {
    action: "delete_agent",
    success: true,
    message: `Agent "${name}" (${id}) removed from the platform`,
  };
}

// ─── Action: Start / Pause / Stop ───────────────────────────────────────────

function executeStatusChange(
  params: Record<string, unknown>,
  action: "start" | "pause" | "stop",
): ActionResult {
  const id = params.id as string;
  if (!id) {
    return {
      action: `${action}_agent`,
      success: false,
      message: "Agent ID is required",
    };
  }

  let agent: AgentConfig | null = null;
  switch (action) {
    case "start":
      agent = runtime.startAgent(id);
      break;
    case "pause":
      agent = runtime.pauseAgent(id);
      break;
    case "stop":
      agent = runtime.stopAgent(id);
      break;
  }

  if (!agent) {
    return {
      action: `${action}_agent`,
      success: false,
      message: `Agent "${id}" not found`,
    };
  }

  return {
    action: `${action}_agent`,
    success: true,
    message: `Agent "${agent.name}" is now ${agent.status}`,
    data: { id: agent.id, name: agent.name, status: agent.status },
  };
}

// ─── Action: List Agents ────────────────────────────────────────────────────

function executeListAgents(): ActionResult {
  const agents = runtime.getAgents();
  const summary = agents.map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    status: a.status,
    model: a.model,
    avatar: a.avatar,
  }));

  return {
    action: "list_agents",
    success: true,
    message: `${agents.length} agent(s) on the platform`,
    data: { agents: summary as unknown as Record<string, unknown> },
  };
}

// ─── Action: Assign Task ────────────────────────────────────────────────────

function executeAssignTask(params: Record<string, unknown>): ActionResult {
  const agentId = params.agentId as string;
  const input = params.input as string;

  if (!agentId || !input) {
    return {
      action: "assign_task",
      success: false,
      message: "Both agentId and input are required",
    };
  }

  const agent = runtime.getAgent(agentId);
  if (!agent) {
    return {
      action: "assign_task",
      success: false,
      message: `Agent "${agentId}" not found`,
    };
  }

  // Create task record in runtime
  const task = runtime.createTask({
    agentId,
    agentName: agent.name,
    type: (params.type as string) || "general",
    input,
    priority: (params.priority as "critical" | "high" | "medium" | "low") || "medium",
  });

  // Mark task as running
  runtime.updateTask(task.id, { status: "running" });

  // Resolve platform environment variables for this agent
  const integrations = loadPlatformIntegrations();
  const platformEnv = resolveAgentPlatformEnv(agent.platformAccess || [], integrations);

  // Dispatch to worker pool asynchronously (fire-and-forget)
  // The worker will execute `openclaw agent --local` with agent-specific config
  dispatchToWorkerPoolAsync({
    agentId: agent.id,
    agentName: agent.name,
    model: agent.model,
    systemPrompt: agent.systemPrompt,
    taskInput: input,
    sessionId: `worker-${agent.id}`,
    thinking: agent.thinking || "medium",
    platformEnv: Object.keys(platformEnv).length > 0 ? platformEnv : undefined,
  })
    .then((asyncRes) => {
      console.log(`[agent-actions] Task ${task.id} dispatched to worker pool (worker task: ${asyncRes.taskId})`);
      runtime.updateTask(task.id, {
        metadata: { ...task.metadata, workerTaskId: asyncRes.taskId },
      });
    })
    .catch((err) => {
      console.error(`[agent-actions] Failed to dispatch task ${task.id} to worker pool:`, err);
      runtime.updateTask(task.id, {
        status: "failed",
        output: `Worker pool dispatch failed: ${err.message}`,
      });
    });

  return {
    action: "assign_task",
    success: true,
    message: `Task "${task.id}" dispatched to ${agent.name} via worker pool`,
    data: { taskId: task.id, agentId, agentName: agent.name },
  };
}

// ─── Process full agent response ────────────────────────────────────────────

export function processAgentResponse(rawReply: string): ProcessedResponse {
  const { cleanText, actions } = extractActions(rawReply);

  if (actions.length === 0) {
    // No actions — return text unchanged (zero overhead path)
    return { displayText: rawReply, actionResults: [] };
  }

  console.log(`[agent-actions] Processing ${actions.length} action(s):`, actions.map((a) => a.action));

  const actionResults = actions.map(executeAction);

  // Log results
  for (const r of actionResults) {
    console.log(`[agent-actions] ${r.success ? "✅" : "❌"} ${r.action}: ${r.message}`);
  }

  return { displayText: cleanText, actionResults };
}
