import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getApiKeyForProvider, loadPlatformIntegrations, loadSettings } from "@/lib/settings";
import { runtime, MODELS } from "@/lib/openclaw-runtime";
import { MODEL_REGISTRY } from "@/lib/model-registry";
import { GROOT_AGENT_ID } from "@/lib/types";
import { processAgentResponse } from "@/lib/agent-actions";
import { resolveAgentPlatformEnv } from "@/lib/platform-integrations";

/**
 * POST /api/chat — Send a message to Groot via the OpenClaw agent runtime.
 *
 * Uses `openclaw agent --local` to run the full agent with:
 *   - Workspace files (SOUL.md, IDENTITY.md, AGENTS.md)
 *   - Tools (read, write, exec, browser, web_search, memory, etc.)
 *   - Skills (healthcheck, skill-creator)
 *   - Session memory via --session-id
 *
 * Model comes from openclaw.json (synced when changed in Agents UI).
 * API keys come from auth-profiles.json (synced from Settings page).
 */

const OPENCLAW_AGENT_NAME = process.env.OPENCLAW_AGENT_NAME || "main";
const OPENCLAW_CONFIG = "/app/openclaw-config/openclaw.json";
const AUTH_PROFILES_PATH = "/root/.openclaw/agents/main/agent/auth-profiles.json";

// ─── Auth & Config Sync ──────────────────────────────────────────────────

/**
 * Ensure auth-profiles.json exists with current API keys.
 * Called before every agent invocation to keep keys up-to-date.
 */
function ensureAuthProfiles(): boolean {
  const apiKey = getApiKeyForProvider("anthropic");

  // Also check env var as fallback
  const key = apiKey || process.env.ANTHROPIC_API_KEY || "";
  if (!key) return false;

  // Use type:"token" to match openclaw.json auth.profiles which declare mode:"token"
  // If types don't match, openclaw's resolveAuthProfileOrder filters the profile out
  const profiles: Record<string, unknown> = {
    "anthropic:default": { type: "token", provider: "anthropic", token: key },
  };

  // Add other providers if configured
  for (const provider of ["openai", "google", "deepseek", "groq", "mistral"]) {
    const pk = getApiKeyForProvider(provider);
    if (pk) {
      profiles[`${provider}:default`] = { type: "token", provider, token: pk };
    }
  }

  const store = { version: 1, profiles };
  const dir = join("/root/.openclaw/agents/main/agent");
  const storeJson = JSON.stringify(store, null, 2);

  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(AUTH_PROFILES_PATH, storeJson);

    // Also write to shared config volume so worker-pool can read it
    const sharedDir = "/app/openclaw-config/agents/main/agent";
    if (!existsSync(sharedDir)) mkdirSync(sharedDir, { recursive: true });
    writeFileSync(join(sharedDir, "auth-profiles.json"), storeJson);

    return true;
  } catch (err) {
    console.error("[chat] Failed to write auth-profiles.json:", err);
    return false;
  }
}

/**
 * Sync Groot's model to openclaw.json so the agent uses the right model.
 */
function syncModelConfig() {
  const groot = runtime.getAgent(GROOT_AGENT_ID);
  if (!groot) return;

  try {
    if (!existsSync(OPENCLAW_CONFIG)) return;
    const config = JSON.parse(readFileSync(OPENCLAW_CONFIG, "utf-8"));

    const currentModel = config.agents?.defaults?.model?.primary;
    if (currentModel !== groot.model) {
      if (!config.agents) config.agents = {};
      if (!config.agents.defaults) config.agents.defaults = {};
      if (!config.agents.defaults.model) config.agents.defaults.model = {};
      config.agents.defaults.model.primary = groot.model;

      writeFileSync(OPENCLAW_CONFIG, JSON.stringify(config, null, 2));

      // Also write to the local copy
      const localConfig = "/root/.openclaw/openclaw.json";
      if (existsSync(localConfig)) {
        const lc = JSON.parse(readFileSync(localConfig, "utf-8"));
        if (!lc.agents) lc.agents = {};
        if (!lc.agents.defaults) lc.agents.defaults = {};
        if (!lc.agents.defaults.model) lc.agents.defaults.model = {};
        lc.agents.defaults.model.primary = groot.model;
        writeFileSync(localConfig, JSON.stringify(lc, null, 2));
      }

      console.log(`[chat] Synced model to ${groot.model}`);
    }
  } catch (err) {
    console.error("[chat] Failed to sync model config:", err);
  }
}

// ─── Agent Context Injection ──────────────────────────────────────────────

/**
 * Write PLATFORM-CONTEXT.md to the workspace before every agent call.
 * This gives Groot awareness of the current agent roster and action format.
 */
function writeAgentContext() {
  const agents = runtime.getAgents();

  const subAgents = agents.filter((a) => a.id !== "groot");
  const agentList = agents
    .map(
      (a) =>
        `- **${a.name}** (id: \`${a.id}\`, role: ${a.role}, status: ${a.status}, model: ${a.model}, avatar: ${a.avatar})`,
    )
    .join("\n");

  const subAgentList = subAgents
    .map(
      (a) =>
        `| ${a.avatar} ${a.name} | \`${a.id}\` | ${a.status} | ${a.description} |`,
    )
    .join("\n");

  const settings = loadSettings();
  const configuredProviders = settings.providers
    .filter((p) => p.enabled && p.apiKey && p.apiKey.length > 0)
    .map((p) => p.provider);

  const modelList = MODEL_REGISTRY.map((m) => {
    const configured = configuredProviders.includes(m.provider);
    const caps = m.capabilities.join(", ");
    const status = configured ? "" : " ⚠ NOT CONFIGURED";
    return `- **${m.displayName}** (\`${m.id}\`) — ${m.tier}, ${m.contextWindowLabel} ctx [${caps}]${status}`;
  }).join("\n");

  const content = `# PLATFORM-CONTEXT.md

**IMPORTANT: This file is refreshed before EVERY message. Always read it for current state.**

## Your Team (${agents.length} agents total, ${subAgents.length} sub-agents)
${agentList}

${subAgents.length > 0 ? `## Sub-Agent Quick Reference
| Agent | ID | Status | Description |
|-------|-----|--------|-------------|
${subAgentList}

## How to Coordinate With Your Team
To assign a task to a sub-agent, use an action block in your response:
\`\`\`
[AGENT_ACTION]{"action":"assign_task","params":{"agentId":"<ID from table above>","input":"<detailed task description>","priority":"high"}}[/AGENT_ACTION]
\`\`\`
The task will be dispatched to the Worker Pool and executed by the agent.
` : `## No Sub-Agents Yet
You have no sub-agents. Create them with create_agent action blocks. See AGENT-MANAGEMENT.md.
`}
## Available Models
${modelList}

## Action Reference
Format: \`[AGENT_ACTION]{"action":"<type>","params":{...}}[/AGENT_ACTION]\`
Actions: create_agent, update_agent, delete_agent, start_agent, pause_agent, stop_agent, list_agents, **assign_task**

Updated: ${new Date().toISOString()}
`;

  try {
    const contextPath = "/root/.openclaw/workspace/PLATFORM-CONTEXT.md";
    const dir = "/root/.openclaw/workspace";
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(contextPath, content);
  } catch (err) {
    console.error("[chat] Failed to write agent context:", err);
  }
}

// ─── Agent Context Injection (into message) ─────────────────────────────────

/**
 * Build a concise context prefix that gets prepended to every user message.
 * This ensures Groot ALWAYS knows about the sub-agents, regardless of whether
 * it reads workspace files. The openclaw CLI has no --system-prompt flag, so
 * injecting context into the message is the only reliable per-call mechanism.
 */
function buildAgentContextPrefix(): string {
  const agents = runtime.getAgents();
  const subAgents = agents.filter((a) => a.id !== GROOT_AGENT_ID);

  if (subAgents.length === 0) return "";

  const roster = subAgents
    .map(
      (a) =>
        `- ${a.avatar} ${a.name} (id: ${a.id}, status: ${a.status}) — ${a.description}`,
    )
    .join("\n");

  return (
    `[PLATFORM CONTEXT — Your current team of sub-agents on the platform:]\n` +
    `${roster}\n\n` +
    `To coordinate with or assign tasks to these agents, use action blocks in your response:\n` +
    `[AGENT_ACTION]{"action":"assign_task","params":{"agentId":"<agent-id-from-above>","input":"<detailed task>","priority":"high"}}[/AGENT_ACTION]\n\n` +
    `To manage agents (create/delete/start/stop), see AGENT-MANAGEMENT.md in your workspace.\n` +
    `[USER MESSAGE BELOW]\n`
  );
}

// ─── Route handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, sessionId, thinking } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Ensure auth profiles are up to date
    if (!ensureAuthProfiles()) {
      return NextResponse.json(
        {
          error: "No Anthropic API key configured",
          details: "Go to Settings and add your Anthropic API key, then save.",
        },
        { status: 503 }
      );
    }

    // Sync Groot's model config to openclaw.json
    syncModelConfig();

    // PRE-PROCESS: Write current agent context to workspace
    writeAgentContext();

    const groot = runtime.getAgent(GROOT_AGENT_ID);
    const session = sessionId || "groot-webchat";
    const thinkLevel = thinking || groot?.thinking || "medium";
    const startTime = Date.now();

    // Inject platform context (agent roster) directly into the message
    // so Groot always knows about sub-agents regardless of workspace file reads
    const contextPrefix = buildAgentContextPrefix();
    const contextualMessage = contextPrefix + message;

    // Resolve Groot's platform credentials as env vars
    const integrations = loadPlatformIntegrations();
    const grootPlatformEnv = resolveAgentPlatformEnv(
      groot?.platformAccess || ["*"],
      integrations,
    );

    const response = await callLocalAgent({
      message: contextualMessage,
      sessionId: session,
      thinking: thinkLevel,
      platformEnv: Object.keys(grootPlatformEnv).length > 0 ? grootPlatformEnv : undefined,
    });

    // POST-PROCESS: Extract and execute action blocks from Groot's response
    const { displayText, actionResults } = processAgentResponse(response.reply);

    // Build the final reply: conversational text + action execution results
    let finalReply = displayText;
    if (actionResults.length > 0) {
      const resultLines = actionResults.map((r) => {
        const icon = r.success ? "✅" : "❌";
        return `${icon} ${r.message}`;
      });
      const actionSection = "**Platform Actions:**\n" + resultLines.join("\n");
      finalReply = finalReply
        ? finalReply + "\n\n---\n" + actionSection
        : actionSection;
    }

    return NextResponse.json({
      reply: finalReply,
      sessionId: session,
      model: response.model || groot?.model || "anthropic/claude-opus-4-6",
      tokensUsed: response.tokensUsed || 0,
      duration: Date.now() - startTime,
      // Expose action results so frontend can refresh agent list
      agentActions: actionResults.length > 0 ? actionResults : undefined,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[chat] Error:", errMsg);
    return NextResponse.json(
      { error: "Chat request failed", details: errMsg },
      { status: 502 }
    );
  }
}

// ─── OpenClaw Agent Call ───────────────────────────────────────────────────

interface AgentParams {
  message: string;
  sessionId: string;
  thinking: string;
  platformEnv?: Record<string, string>;
}

interface AgentResponse {
  reply: string;
  model?: string;
  tokensUsed?: number;
}

function callLocalAgent(params: AgentParams): Promise<AgentResponse> {
  return new Promise((resolve, reject) => {
    const args = [
      "agent",
      "--local",
      "--agent", OPENCLAW_AGENT_NAME,
      "--session-id", params.sessionId,
      "--thinking", params.thinking,
      "--json",
      "-m", params.message,
    ];

    console.log(`[chat] Running: openclaw agent --local --session-id ${params.sessionId} --thinking ${params.thinking}`);

    execFile("openclaw", args, {
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        ...(params.platformEnv || {}), // Inject platform credentials as env vars
        HOME: "/root",
      },
    }, (error, stdout, stderr) => {
      if (stderr) {
        console.log("[chat] stderr:", stderr.substring(0, 500));
      }

      if (error) {
        console.error("[chat] exec error:", error.message);
        if (!stdout?.trim()) {
          const errDetail = stderr?.includes("No API key")
            ? "No API key configured. Please add your Anthropic API key in Settings."
            : error.message;
          reject(new Error(errDetail));
          return;
        }
      }

      const output = stdout?.trim();
      if (!output) {
        reject(new Error("Empty response from agent"));
        return;
      }

      console.log("[chat] Output:", output.substring(0, 300));

      try {
        const result = JSON.parse(output);

        // OpenClaw agent --json format:
        // { payloads: [{ text, mediaUrl }], meta: { agentMeta: { model, usage, ... } } }
        if (result.payloads && Array.isArray(result.payloads)) {
          const textParts = result.payloads
            .map((p: { text?: string }) => p.text)
            .filter(Boolean);
          const replyText = textParts.join("\n\n");
          const meta = result.meta?.agentMeta;
          resolve({
            reply: replyText || "No response",
            model: meta ? `${meta.provider}/${meta.model}` : undefined,
            tokensUsed: meta?.usage?.total || meta?.lastCallUsage?.total,
          });
          return;
        }

        // Fallback: other JSON formats
        const text = result.text
          || result.content
          || result.reply
          || result.result?.text
          || result.result?.content
          || result.message;

        if (text) {
          resolve({
            reply: text,
            model: result.model || result.result?.model,
            tokensUsed: result.tokensUsed || result.usage?.total_tokens,
          });
          return;
        }

        if (result.error) {
          const errMsg = typeof result.error === "string"
            ? result.error
            : result.error.message || JSON.stringify(result.error);
          reject(new Error(errMsg));
          return;
        }

        resolve({ reply: output });
      } catch {
        resolve({ reply: output });
      }
    });
  });
}
