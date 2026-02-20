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
import {
  isDockerAvailable,
  createAgentContainer,
  startAgentContainer,
  stopAgentContainer,
  removeAgentContainer,
  execInAgentContainer,
  dispatchDirectExecution,
} from "./container-manager";

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

  // Spawn a dedicated Docker container for this agent
  if (isDockerAvailable()) {
    createAgentContainer(agent).catch((err) =>
      console.error(`[agent-actions] Container create failed for ${agent.name}:`, err),
    );
  }

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

  // Remove the agent's dedicated Docker container
  if (isDockerAvailable()) {
    removeAgentContainer(name).catch((err) =>
      console.error(`[agent-actions] Container remove failed for ${name}:`, err),
    );
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

  // Sync container lifecycle with agent status
  if (isDockerAvailable() && agent.id !== GROOT_AGENT_ID) {
    if (action === "start") {
      startAgentContainer(agent.name).catch((err) =>
        console.error(`[agent-actions] Container start failed for ${agent!.name}:`, err),
      );
    } else if (action === "stop") {
      stopAgentContainer(agent.name).catch((err) =>
        console.error(`[agent-actions] Container stop failed for ${agent!.name}:`, err),
      );
    }
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

  // If agent is paused or stopped, park the task instead of dispatching
  if (agent.status === "paused" || agent.status === "stopped") {
    runtime.updateTask(task.id, { status: "parked" });
    return {
      action: "assign_task",
      success: true,
      message: `Task "${task.id}" parked for ${agent.name} (agent is ${agent.status}). Drag to Queued on the task board to resume.`,
      data: { taskId: task.id, agentId, agentName: agent.name, status: "parked" },
    };
  }

  // Mark task as running
  runtime.updateTask(task.id, { status: "running" });

  // Resolve platform environment variables for this agent
  const integrations = loadPlatformIntegrations();
  const platformEnv = resolveAgentPlatformEnv(agent.platformAccess || [], integrations);

  // Dispatch task — prefer per-agent Docker container, fallback to direct exec
  const sessionId = `worker-${agent.id}`;

  if (isDockerAvailable()) {
    // Container-based: docker exec into agent's dedicated container
    execInAgentContainer(agent, input, {
      sessionId,
      thinking: agent.thinking || "medium",
      platformEnv: Object.keys(platformEnv).length > 0 ? platformEnv : undefined,
    })
      .then((result) => {
        runtime.updateTask(task.id, {
          status: result.success ? "completed" : "failed",
          output: result.reply || result.error || "No output",
          completedAt: new Date().toISOString(),
          duration: `${(result.duration / 1000).toFixed(1)}s`,
          tokensUsed: result.tokensUsed || 0,
        });
        // Update agent metrics (success and failure)
        const existing = runtime.getAgent(agentId);
        if (existing) {
          const newTokens = existing.metrics.tokensUsed + (result.tokensUsed || 0);
          const costPerToken = 0.000003; // ~$3 per 1M tokens average
          const taskCost = (result.tokensUsed || 0) * costPerToken;
          const completedCount = existing.metrics.tasksCompleted + (result.success ? 1 : 0);
          const prevTotal = existing.metrics.tasksCompleted;
          const newAvg = prevTotal > 0
            ? +((existing.metrics.avgResponseTime * prevTotal + result.duration / 1000) / (prevTotal + 1)).toFixed(1)
            : +(result.duration / 1000).toFixed(1);

          runtime.updateAgent(agentId, {
            metrics: {
              ...existing.metrics,
              tasksCompleted: completedCount,
              tokensUsed: newTokens,
              totalCost: +(existing.metrics.totalCost + taskCost).toFixed(4),
              lastActive: new Date().toISOString(),
              avgResponseTime: newAvg,
              errorRate: !result.success
                ? +((existing.metrics.errorRate * prevTotal + 100) / (prevTotal + 1)).toFixed(1)
                : existing.metrics.errorRate,
            },
          });
        }
        console.log(`[agent-actions] Task ${task.id} completed via container (${result.success ? "success" : "failed"})`);
      })
      .catch((err) => {
        console.error(`[agent-actions] Container exec failed for task ${task.id}:`, err);
        runtime.updateTask(task.id, {
          status: "failed",
          output: `Container execution failed: ${err.message}`,
          completedAt: new Date().toISOString(),
        });
      });
  } else {
    // Fallback: direct execFile in platform container
    dispatchDirectExecution(agent, task, input, platformEnv, (result) => {
      runtime.updateTask(task.id, {
        status: result.success ? "completed" : "failed",
        output: result.reply || result.error || "No output",
        completedAt: new Date().toISOString(),
        duration: `${(result.duration / 1000).toFixed(1)}s`,
        tokensUsed: result.tokensUsed || 0,
      });
      // Update agent metrics (success and failure)
      const existing = runtime.getAgent(agentId);
      if (existing) {
        const newTokens = existing.metrics.tokensUsed + (result.tokensUsed || 0);
        const costPerToken = 0.000003;
        const taskCost = (result.tokensUsed || 0) * costPerToken;
        const completedCount = existing.metrics.tasksCompleted + (result.success ? 1 : 0);
        const prevTotal = existing.metrics.tasksCompleted;
        const newAvg = prevTotal > 0
          ? +((existing.metrics.avgResponseTime * prevTotal + result.duration / 1000) / (prevTotal + 1)).toFixed(1)
          : +(result.duration / 1000).toFixed(1);

        runtime.updateAgent(agentId, {
          metrics: {
            ...existing.metrics,
            tasksCompleted: completedCount,
            tokensUsed: newTokens,
            totalCost: +(existing.metrics.totalCost + taskCost).toFixed(4),
            lastActive: new Date().toISOString(),
            avgResponseTime: newAvg,
            errorRate: !result.success
              ? +((existing.metrics.errorRate * prevTotal + 100) / (prevTotal + 1)).toFixed(1)
              : existing.metrics.errorRate,
          },
        });
      }
      console.log(`[agent-actions] Task ${task.id} completed via direct exec (${result.success ? "success" : "failed"})`);
    });
  }

  const mode = isDockerAvailable() ? "container" : "direct";
  return {
    action: "assign_task",
    success: true,
    message: `Task "${task.id}" dispatched to ${agent.name} via ${mode} execution`,
    data: { taskId: task.id, agentId, agentName: agent.name, mode },
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
