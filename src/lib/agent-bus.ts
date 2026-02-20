/**
 * Agent Bus — Lightweight message bus for agent-to-agent communication.
 *
 * FIX: Agent-to-agent communication (Low priority).
 *
 * Previously all coordination routed through Groot (bottleneck).
 * This module allows agents to send messages and spawn sub-tasks
 * directly to other agents without looping through Groot.
 *
 * Architecture:
 *   Agent A → agentBus.send(toAgentId, message) → Agent B picks up & executes
 *
 * Integration:
 *   1. Import `agentBus` in agent-actions.ts
 *   2. Add "send_message" and "delegate_task" to the action switch
 *   3. Groot can now route tasks between agents in one action block
 */

import { runtime } from "./openclaw-runtime";
import { execInAgentContainer, dispatchDirectExecution, isDockerAvailable } from "./container-manager";
import { loadPlatformIntegrations } from "./settings";
import { resolveAgentPlatformEnv } from "./platform-integrations";
import type { Task } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentMessage {
  id: string;
  fromAgentId: string;
  fromAgentName: string;
  toAgentId: string;
  content: string;
  priority: "critical" | "high" | "medium" | "low";
  createdAt: string;
  status: "pending" | "delivered" | "failed";
}

export interface DelegateTaskParams {
  fromAgentId: string;
  toAgentId: string;
  input: string;
  priority?: "critical" | "high" | "medium" | "low";
  context?: string; // Optional context from the originating agent
}

// ─── In-Memory Message Store ──────────────────────────────────────────────────
// Messages are ephemeral — they exist only while the task is pending.
// Once delivered and acted upon, they're cleared.

class AgentBus {
  private messages: AgentMessage[] = [];
  private messageCounter = 0;

  /**
   * Send a message from one agent to another.
   * The receiving agent will process it as a task input.
   */
  send(params: {
    fromAgentId: string;
    toAgentId: string;
    content: string;
    priority?: AgentMessage["priority"];
  }): AgentMessage {
    const fromAgent = runtime.getAgent(params.fromAgentId);
    const toAgent = runtime.getAgent(params.toAgentId);

    if (!toAgent) {
      throw new Error(`Target agent "${params.toAgentId}" not found`);
    }

    const msg: AgentMessage = {
      id: `msg-${++this.messageCounter}-${Date.now()}`,
      fromAgentId: params.fromAgentId,
      fromAgentName: fromAgent?.name || params.fromAgentId,
      toAgentId: params.toAgentId,
      content: params.content,
      priority: params.priority || "medium",
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    this.messages.push(msg);
    console.log(
      `[agent-bus] Message ${msg.id}: ${msg.fromAgentName} → ${toAgent.name} | "${params.content.substring(0, 80)}..."`
    );

    return msg;
  }

  /**
   * Delegate a task from one agent directly to another.
   * Creates a task record and dispatches it to the target agent's container.
   *
   * This is the core of agent-to-agent coordination — Groot can break
   * a complex workflow into sub-tasks and route each to the right specialist.
   */
  async delegateTask(params: DelegateTaskParams): Promise<Task> {
    const fromAgent = runtime.getAgent(params.fromAgentId);
    const toAgent = runtime.getAgent(params.toAgentId);

    if (!toAgent) {
      throw new Error(`Target agent "${params.toAgentId}" not found`);
    }

    if (toAgent.status !== "running") {
      throw new Error(`Agent "${toAgent.name}" is ${toAgent.status} — cannot accept tasks`);
    }

    // Build task input, optionally with context from the originating agent
    const taskInput = params.context
      ? `[Delegated by ${fromAgent?.name || params.fromAgentId}]\nContext: ${params.context}\n\nTask: ${params.input}`
      : params.input;

    // Create a task record
    const task = runtime.createTask({
      agentId: toAgent.id,
      agentName: toAgent.name,
      type: "delegated",
      input: taskInput,
      priority: params.priority || "medium",
      metadata: {
        delegatedBy: params.fromAgentId,
        delegatedByName: fromAgent?.name || params.fromAgentId,
      },
    });

    // Mark as running
    runtime.updateTask(task.id, { status: "running" });

    // Resolve platform env for the target agent
    const integrations = loadPlatformIntegrations();
    const platformEnv = resolveAgentPlatformEnv(toAgent.platformAccess || [], integrations);

    const sessionId = `delegate-${toAgent.id}-${task.id}`;

    // Dispatch to the target agent
    if (isDockerAvailable()) {
      execInAgentContainer(toAgent, taskInput, {
        sessionId,
        thinking: toAgent.thinking || "medium",
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
          console.log(
            `[agent-bus] Delegated task ${task.id} → ${toAgent.name}: ${result.success ? "completed" : "failed"}`
          );
        })
        .catch((err) => {
          runtime.updateTask(task.id, {
            status: "failed",
            output: `Delegation failed: ${err.message}`,
            completedAt: new Date().toISOString(),
          });
        });
    } else {
      dispatchDirectExecution(toAgent, task, taskInput, platformEnv, (result) => {
        runtime.updateTask(task.id, {
          status: result.success ? "completed" : "failed",
          output: result.reply || result.error || "No output",
          completedAt: new Date().toISOString(),
          duration: `${(result.duration / 1000).toFixed(1)}s`,
          tokensUsed: result.tokensUsed || 0,
        });
      });
    }

    return task;
  }

  /**
   * Get pending messages for a specific agent.
   */
  getMessages(toAgentId: string): AgentMessage[] {
    return this.messages.filter(
      (m) => m.toAgentId === toAgentId && m.status === "pending"
    );
  }

  /**
   * Mark a message as delivered.
   */
  markDelivered(messageId: string): void {
    const msg = this.messages.find((m) => m.id === messageId);
    if (msg) msg.status = "delivered";
  }

  /**
   * Get all messages (for debugging/admin view).
   */
  getAllMessages(): AgentMessage[] {
    return [...this.messages];
  }
}

// Export singleton
export const agentBus = new AgentBus();

// ─── Action Handler Integration ────────────────────────────────────────────────
// Add these cases to the switch in agent-actions.ts → executeAction():
//
//   case "delegate_task":
//     return executeDelegateTask(params);
//   case "send_message":
//     return executeSendMessage(params);

export function executeDelegateTask(
  params: Record<string, unknown>
): { action: string; success: boolean; message: string; data?: Record<string, unknown> } {
  const fromAgentId = params.fromAgentId as string || "groot";
  const toAgentId = params.toAgentId as string;
  const input = params.input as string;
  const context = params.context as string | undefined;
  const priority = params.priority as DelegateTaskParams["priority"] | undefined;

  if (!toAgentId || !input) {
    return {
      action: "delegate_task",
      success: false,
      message: "Both toAgentId and input are required",
    };
  }

  const toAgent = runtime.getAgent(toAgentId);
  if (!toAgent) {
    return {
      action: "delegate_task",
      success: false,
      message: `Agent "${toAgentId}" not found`,
    };
  }

  // Fire and forget — task is dispatched async
  agentBus.delegateTask({ fromAgentId, toAgentId, input, context, priority })
    .catch((err) => console.error("[agent-bus] Delegate task error:", err));

  return {
    action: "delegate_task",
    success: true,
    message: `Task delegated to ${toAgent.name} (${toAgentId})`,
    data: { toAgentId, toAgentName: toAgent.name, input: input.substring(0, 100) },
  };
}

export function executeSendMessage(
  params: Record<string, unknown>
): { action: string; success: boolean; message: string; data?: Record<string, unknown> } {
  const fromAgentId = params.fromAgentId as string || "groot";
  const toAgentId = params.toAgentId as string;
  const content = params.content as string;

  if (!toAgentId || !content) {
    return {
      action: "send_message",
      success: false,
      message: "Both toAgentId and content are required",
    };
  }

  try {
    const msg = agentBus.send({ fromAgentId, toAgentId, content });
    return {
      action: "send_message",
      success: true,
      message: `Message sent to agent ${toAgentId} (msg: ${msg.id})`,
      data: { messageId: msg.id },
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    return {
      action: "send_message",
      success: false,
      message: errMsg,
    };
  }
}
