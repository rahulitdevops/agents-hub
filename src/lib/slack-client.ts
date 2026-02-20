/**
 * Slack Multi-Bot Client
 *
 * Central module for managing 6 Slack bot apps (Groot, Forge, Pixel, Helm, Sentinel, Quill).
 * Handles bot resolution, request signature verification, event deduplication,
 * and Slack Web API calls using native fetch (zero external Slack dependencies).
 */

import crypto from "crypto";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SlackBotConfig {
  name: string;           // "groot", "forge", "pixel", "helm", "sentinel", "quill"
  agentId: string;        // Runtime agent ID (matched by name lookup)
  appId: string;          // Slack App ID (e.g., "A0AG4GE0TUN")
  botToken: string;       // xoxb-...
  signingSecret: string;  // HMAC signing secret
}

// ─── Command → Bot Mapping ──────────────────────────────────────────────────

const COMMAND_TO_BOT: Record<string, string> = {
  // Groot (Director)
  "/groot": "groot",
  "/agents": "groot",
  "/task": "groot",
  "/status": "groot",
  // Forge (Backend)
  "/forge": "forge",
  "/api": "forge",
  "/schema": "forge",
  // Pixel (Frontend)
  "/pixel": "pixel",
  "/component": "pixel",
  "/ui-review": "pixel",
  // Helm (DevOps)
  "/helm": "helm",
  "/deploy": "helm",
  "/pipeline": "helm",
  // Sentinel (SRE)
  "/sentinel": "sentinel",
  "/incident": "sentinel",
  "/health": "sentinel",
  "/postmortem": "sentinel",
  // Quill (Content)
  "/quill": "quill",
  "/docs": "quill",
  "/changelog": "quill",
  "/review": "quill",
};

// ─── Bot Registry ───────────────────────────────────────────────────────────

const BOT_DEFINITIONS = [
  { name: "groot",    envPrefix: "SLACK_GROOT" },
  { name: "forge",    envPrefix: "SLACK_FORGE" },
  { name: "pixel",    envPrefix: "SLACK_PIXEL" },
  { name: "helm",     envPrefix: "SLACK_HELM" },
  { name: "sentinel", envPrefix: "SLACK_SENTINEL" },
  { name: "quill",    envPrefix: "SLACK_QUILL" },
] as const;

let cachedBots: SlackBotConfig[] | null = null;

/**
 * Load all configured Slack bots from environment variables.
 * Caches after first call. Only includes bots with a valid bot token.
 */
export function getSlackBots(): SlackBotConfig[] {
  if (cachedBots) return cachedBots;

  cachedBots = BOT_DEFINITIONS
    .map((def) => ({
      name: def.name,
      agentId: def.name, // Default; processor resolves actual runtime agent by name
      appId: process.env[`${def.envPrefix}_APP_ID`] || "",
      botToken: process.env[`${def.envPrefix}_BOT_TOKEN`] || "",
      signingSecret: process.env[`${def.envPrefix}_SIGNING_SECRET`] || "",
    }))
    .filter((bot) => bot.botToken.length > 0);

  console.log(
    `[slack-client] Loaded ${cachedBots.length} bot(s):`,
    cachedBots.map((b) => b.name).join(", ") || "none"
  );

  return cachedBots;
}

/** Clear the cached bots (useful for testing or env reload) */
export function clearBotCache(): void {
  cachedBots = null;
}

// ─── Bot Resolution ─────────────────────────────────────────────────────────

/** Look up a bot by its Slack App ID (from event payloads) */
export function getBotByAppId(appId: string): SlackBotConfig | undefined {
  return getSlackBots().find((b) => b.appId === appId);
}

/** Look up a bot by slash command (e.g., "/deploy" → helm bot) */
export function getBotByCommand(command: string): SlackBotConfig | undefined {
  const botName = COMMAND_TO_BOT[command.toLowerCase()];
  if (!botName) return undefined;
  return getSlackBots().find((b) => b.name === botName);
}

/** Look up a bot by name */
export function getBotByName(name: string): SlackBotConfig | undefined {
  return getSlackBots().find((b) => b.name === name.toLowerCase());
}

// ─── Signature Verification ─────────────────────────────────────────────────

/**
 * Verify a Slack request signature (HMAC-SHA256).
 *
 * @param signingSecret - The bot's signing secret
 * @param timestamp     - `x-slack-request-timestamp` header value
 * @param rawBody       - The raw request body string
 * @param signature     - `x-slack-signature` header value (e.g., "v0=abc123...")
 * @returns true if the signature is valid
 */
export function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  rawBody: string,
  signature: string
): boolean {
  // Reject requests older than 5 minutes (replay protection)
  const requestAge = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (requestAge > 300) {
    console.warn("[slack-client] Request timestamp too old:", requestAge, "seconds");
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto.createHmac("sha256", signingSecret);
  hmac.update(sigBasestring);
  const computedSignature = `v0=${hmac.digest("hex")}`;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedSignature, "utf8"),
      Buffer.from(signature, "utf8")
    );
  } catch {
    return false;
  }
}

// ─── Event Deduplication ────────────────────────────────────────────────────

const processedEvents = new Map<string, number>();

const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Cleanup old entries every 60 seconds
setInterval(() => {
  const cutoff = Date.now() - DEDUP_TTL_MS;
  for (const [id, ts] of processedEvents) {
    if (ts < cutoff) processedEvents.delete(id);
  }
}, 60_000).unref(); // .unref() so this doesn't keep the process alive

/** Check if an event has already been processed. If not, marks it as processed. */
export function isDuplicateEvent(eventId: string): boolean {
  if (processedEvents.has(eventId)) return true;
  processedEvents.set(eventId, Date.now());
  return false;
}

// ─── Slack Web API Helpers ──────────────────────────────────────────────────

const SLACK_API_BASE = "https://slack.com/api";

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/** Call a Slack Web API method */
async function slackApiCall(
  method: string,
  botToken: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: Record<string, any>
): Promise<SlackApiResponse> {
  const res = await fetch(`${SLACK_API_BASE}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${botToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as SlackApiResponse;

  if (!data.ok) {
    console.error(`[slack-client] ${method} failed:`, data.error);
  }

  return data;
}

/**
 * Post a message to a Slack channel.
 */
export async function postMessage(
  botToken: string,
  channel: string,
  text: string,
  options?: { thread_ts?: string; blocks?: unknown[] }
): Promise<SlackApiResponse> {
  return slackApiCall("chat.postMessage", botToken, {
    channel,
    text,
    ...(options?.thread_ts && { thread_ts: options.thread_ts }),
    ...(options?.blocks && { blocks: options.blocks }),
  });
}

/**
 * Add a reaction emoji to a message.
 */
export async function addReaction(
  botToken: string,
  channel: string,
  timestamp: string,
  emoji: string
): Promise<SlackApiResponse> {
  return slackApiCall("reactions.add", botToken, {
    channel,
    timestamp,
    name: emoji,
  });
}

/**
 * Remove a reaction emoji from a message.
 */
export async function removeReaction(
  botToken: string,
  channel: string,
  timestamp: string,
  emoji: string
): Promise<SlackApiResponse> {
  return slackApiCall("reactions.remove", botToken, {
    channel,
    timestamp,
    name: emoji,
  });
}

/**
 * Post a follow-up response to a Slack response_url (for slash commands).
 * This is different from chat.postMessage — it uses the ephemeral response_url
 * provided by Slack in the slash command payload.
 */
export async function postToResponseUrl(
  responseUrl: string,
  text: string,
  options?: { response_type?: "in_channel" | "ephemeral"; replace_original?: boolean }
): Promise<void> {
  try {
    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        response_type: options?.response_type || "in_channel",
        replace_original: options?.replace_original ?? false,
      }),
    });
  } catch (err) {
    console.error("[slack-client] Failed to post to response_url:", err);
  }
}
