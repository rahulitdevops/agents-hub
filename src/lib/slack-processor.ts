/**
 * Slack Async Processor
 *
 * Handles the async processing of Slack messages and slash commands.
 * Bridges Slack events → Agent Hub runtime (task creation + execution).
 * Called as fire-and-forget from the webhook handler to meet Slack's 3-second deadline.
 */

import { runtime } from "./openclaw-runtime";
import {
  type SlackBotConfig,
  postMessage,
  addReaction,
  removeReaction,
  postToResponseUrl,
} from "./slack-client";
import {
  isDockerAvailable,
  execInAgentContainer,
  dispatchDirectExecution,
} from "./container-manager";
import { resolveAgentPlatformEnv } from "./platform-integrations";
import { loadSettings } from "./settings";
import { getCostPerToken } from "./model-registry";
import type { AgentConfig } from "./types";

// ─── Helpers ────────────────────────────────────────────────────────────────

const THINKING_EMOJI = "hourglass_flowing_sand";

/**
 * Resolve the Agent Hub runtime agent for a given Slack bot.
 * Groot is hardcoded; other bots match by name (case-insensitive).
 */
function resolveRuntimeAgent(botConfig: SlackBotConfig): AgentConfig | undefined {
  // Groot has a fixed runtime ID
  if (botConfig.name === "groot") {
    return runtime.getAgent("groot");
  }

  // For other bots, find by name
  const agents = runtime.getAgents();
  return agents.find(
    (a) => a.name.toLowerCase() === botConfig.name.toLowerCase()
  );
}

/**
 * Load platform integrations from settings for env variable resolution.
 */
function loadPlatformIntegrations() {
  try {
    const settings = loadSettings();
    return settings.platformIntegrations || [];
  } catch {
    return [];
  }
}

/**
 * Dispatch a task to an agent and wait for the result.
 * Returns the output text or an error message.
 */
async function dispatchAndWait(
  agent: AgentConfig,
  taskId: string,
  input: string
): Promise<string> {
  const integrations = loadPlatformIntegrations();
  const platformEnv = resolveAgentPlatformEnv(agent.platformAccess || [], integrations);
  const sessionId = `slack-${agent.id}`;

  // Mark task as running
  runtime.updateTask(taskId, {
    status: "running",
    startedAt: new Date().toISOString(),
  });

  try {
    let result: { success: boolean; reply?: string; error?: string; duration: number; tokensUsed?: number };

    if (isDockerAvailable()) {
      result = await execInAgentContainer(agent, input, {
        sessionId,
        thinking: agent.thinking || "medium",
        platformEnv: Object.keys(platformEnv).length > 0 ? platformEnv : undefined,
      });
    } else {
      // Fallback: wrap dispatchDirectExecution in a promise
      result = await new Promise((resolve) => {
        dispatchDirectExecution(agent, { id: taskId } as never, input, platformEnv, (res) => {
          resolve(res);
        });
      });
    }

    // Update task with result
    runtime.updateTask(taskId, {
      status: result.success ? "completed" : "failed",
      output: result.reply || result.error || "No output",
      completedAt: new Date().toISOString(),
      duration: `${(result.duration / 1000).toFixed(1)}s`,
      tokensUsed: result.tokensUsed || 0,
    });

    // Update agent metrics
    const existing = runtime.getAgent(agent.id);
    if (existing) {
      const newTokens = existing.metrics.tokensUsed + (result.tokensUsed || 0);
      const costPerToken = getCostPerToken(agent.model);
      const taskCost = (result.tokensUsed || 0) * costPerToken;
      const completedCount = existing.metrics.tasksCompleted + (result.success ? 1 : 0);
      const prevTotal = existing.metrics.tasksCompleted;
      const newAvg = prevTotal > 0
        ? +((existing.metrics.avgResponseTime * prevTotal + result.duration / 1000) / (prevTotal + 1)).toFixed(1)
        : +(result.duration / 1000).toFixed(1);

      runtime.updateAgent(agent.id, {
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

    return result.reply || result.error || "Task completed with no output.";
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    runtime.updateTask(taskId, {
      status: "failed",
      output: `Execution failed: ${errorMsg}`,
      completedAt: new Date().toISOString(),
    });
    return `Sorry, I encountered an error: ${errorMsg}`;
  }
}

// ─── Public Processors ──────────────────────────────────────────────────────

/**
 * Process an incoming Slack message (DM or channel message / app_mention).
 * Runs asynchronously — called as fire-and-forget from the webhook handler.
 */
export async function processSlackMessage(params: {
  botConfig: SlackBotConfig;
  channel: string;
  user: string;
  text: string;
  threadTs?: string;
  eventTs: string;
}): Promise<void> {
  const { botConfig, channel, user, text, threadTs, eventTs } = params;
  const replyTs = threadTs || eventTs; // Reply in thread if exists, else start thread

  try {
    // 1. Add thinking reaction
    await addReaction(botConfig.botToken, channel, eventTs, THINKING_EMOJI).catch(() => {});

    // 2. Resolve the runtime agent
    const agent = resolveRuntimeAgent(botConfig);
    if (!agent) {
      await postMessage(botConfig.botToken, channel,
        `Agent *${botConfig.name}* is not configured in Agent Hub yet. Create the agent in the dashboard first.`,
        { thread_ts: replyTs }
      );
      await removeReaction(botConfig.botToken, channel, eventTs, THINKING_EMOJI).catch(() => {});
      return;
    }

    if (agent.status !== "running") {
      await postMessage(botConfig.botToken, channel,
        `Agent *${agent.name}* is currently *${agent.status}*. Start it from the dashboard to process messages.`,
        { thread_ts: replyTs }
      );
      await removeReaction(botConfig.botToken, channel, eventTs, THINKING_EMOJI).catch(() => {});
      return;
    }

    // 3. Create a task in the runtime
    const task = runtime.createTask({
      agentId: agent.id,
      agentName: agent.name,
      type: "slack-message",
      input: text,
      priority: "medium",
      metadata: { source: "slack", channel, user, threadTs, eventTs },
    });

    console.log(`[slack-processor] Created task ${task.id} for ${agent.name} from Slack user ${user}`);

    // 4. Dispatch and wait for result
    const response = await dispatchAndWait(agent, task.id, text);

    // 5. Post the response to Slack
    // Truncate very long responses (Slack limit is ~40k chars but we keep it reasonable)
    const truncated = response.length > 3000
      ? response.slice(0, 3000) + "\n\n_...response truncated_"
      : response;

    await postMessage(botConfig.botToken, channel, truncated, { thread_ts: replyTs });

    // 6. Remove thinking reaction
    await removeReaction(botConfig.botToken, channel, eventTs, THINKING_EMOJI).catch(() => {});

    console.log(`[slack-processor] Replied to Slack message (task: ${task.id}, agent: ${agent.name})`);
  } catch (err) {
    console.error(`[slack-processor] Error processing message:`, err);
    // Try to post error and remove reaction
    await postMessage(botConfig.botToken, channel,
      `Sorry, something went wrong while processing your message.`,
      { thread_ts: replyTs }
    ).catch(() => {});
    await removeReaction(botConfig.botToken, channel, eventTs, THINKING_EMOJI).catch(() => {});
  }
}

/**
 * Process a Slack slash command.
 * Runs asynchronously — the webhook handler already returned an ephemeral ack.
 * Results are posted via the response_url.
 */
export async function processSlackCommand(params: {
  botConfig: SlackBotConfig;
  command: string;
  text: string;
  userId: string;
  userName: string;
  channelId: string;
  responseUrl: string;
}): Promise<void> {
  const { botConfig, command, text, userId, userName, channelId, responseUrl } = params;

  try {
    // 1. Resolve the runtime agent
    const agent = resolveRuntimeAgent(botConfig);
    if (!agent) {
      await postToResponseUrl(responseUrl,
        `Agent *${botConfig.name}* is not configured in Agent Hub yet. Create the agent in the dashboard first.`,
        { response_type: "ephemeral" }
      );
      return;
    }

    if (agent.status !== "running") {
      await postToResponseUrl(responseUrl,
        `Agent *${agent.name}* is currently *${agent.status}*. Start it from the dashboard first.`,
        { response_type: "ephemeral" }
      );
      return;
    }

    // 2. Build the input from command + text
    const input = text
      ? `Slack command: ${command} ${text}`
      : `Slack command: ${command}`;

    // 3. Create a task
    const task = runtime.createTask({
      agentId: agent.id,
      agentName: agent.name,
      type: "slack-command",
      input,
      priority: "medium",
      metadata: { source: "slack", command, userId, userName, channelId },
    });

    console.log(`[slack-processor] Created task ${task.id} for ${command} from @${userName}`);

    // 4. Dispatch and wait
    const response = await dispatchAndWait(agent, task.id, input);

    // 5. Post result to response_url (visible in channel)
    const truncated = response.length > 3000
      ? response.slice(0, 3000) + "\n\n_...response truncated_"
      : response;

    await postToResponseUrl(responseUrl, truncated, {
      response_type: "in_channel",
      replace_original: true,
    });

    console.log(`[slack-processor] Command ${command} completed (task: ${task.id}, agent: ${agent.name})`);
  } catch (err) {
    console.error(`[slack-processor] Error processing command ${command}:`, err);
    await postToResponseUrl(responseUrl,
      `Sorry, something went wrong while processing \`${command}\`.`,
      { response_type: "ephemeral" }
    ).catch(() => {});
  }
}
