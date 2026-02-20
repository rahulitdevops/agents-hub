/**
 * Slack Webhook — Multi-Bot Events API & Slash Commands
 *
 * Single endpoint handling all 6 Slack bots (Groot, Forge, Pixel, Helm, Sentinel, Quill).
 * Routes events to the correct agent based on api_app_id or slash command.
 *
 * POST — Handles:
 *   1. URL verification (type: "url_verification") — returns challenge
 *   2. Event callbacks (type: "event_callback") — messages, app_mentions, reactions
 *   3. Slash commands (application/x-www-form-urlencoded) — interactive commands
 *
 * All heavy processing is async (fire-and-forget) to meet Slack's 3-second deadline.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getBotByAppId,
  getBotByCommand,
  verifySlackSignature,
  isDuplicateEvent,
} from "@/lib/slack-client";
import { processSlackMessage, processSlackCommand } from "@/lib/slack-processor";

// ─── Types for Slack payloads ───────────────────────────────────────────────

interface SlackEventPayload {
  type: string;
  challenge?: string;
  event_id?: string;
  api_app_id?: string;
  event?: {
    type: string;
    user?: string;
    bot_id?: string;
    subtype?: string;
    text?: string;
    channel?: string;
    ts?: string;
    thread_ts?: string;
    reaction?: string;
    item?: { channel?: string; ts?: string };
  };
}

interface SlackCommandPayload {
  command: string;
  text: string;
  user_id: string;
  user_name: string;
  channel_id: string;
  response_url: string;
  trigger_id: string;
  api_app_id: string;
}

// ─── POST Handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Read raw body (needed for signature verification)
    const rawBody = await req.text();
    const timestamp = req.headers.get("x-slack-request-timestamp") || "";
    const signature = req.headers.get("x-slack-signature") || "";
    const contentType = req.headers.get("content-type") || "";

    // Determine if this is a form-encoded slash command or JSON event
    const isFormEncoded = contentType.includes("application/x-www-form-urlencoded");

    // ── 1. Parse the body ─────────────────────────────────────────────────
    let jsonBody: SlackEventPayload | null = null;
    let commandBody: SlackCommandPayload | null = null;

    if (isFormEncoded) {
      const params = new URLSearchParams(rawBody);
      commandBody = Object.fromEntries(params.entries()) as unknown as SlackCommandPayload;
    } else {
      jsonBody = JSON.parse(rawBody) as SlackEventPayload;
    }

    // ── 2. URL Verification (no signature check needed — bootstrap call) ──
    if (jsonBody?.type === "url_verification") {
      console.log("[webhook:slack] URL verification — returning challenge");
      return NextResponse.json({ challenge: jsonBody.challenge });
    }

    // ── 3. Resolve the bot and verify signature ───────────────────────────
    const appId = jsonBody?.api_app_id || commandBody?.api_app_id || "";
    let bot = appId ? getBotByAppId(appId) : undefined;

    // For slash commands, also try resolving by command name
    if (!bot && commandBody?.command) {
      bot = getBotByCommand(commandBody.command);
    }

    if (!bot) {
      console.warn(`[webhook:slack] No bot found for app_id="${appId}" command="${commandBody?.command || ""}"`);
      // Still return 200 to prevent Slack retries
      return NextResponse.json({ status: "ok" });
    }

    // Verify signature (skip if no signing secret configured — dev mode)
    if (bot.signingSecret) {
      const valid = verifySlackSignature(bot.signingSecret, timestamp, rawBody, signature);
      if (!valid) {
        console.warn(`[webhook:slack] Signature verification failed for bot "${bot.name}"`);
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    // ── 4. Handle Event Callbacks ─────────────────────────────────────────
    if (jsonBody?.type === "event_callback") {
      const event = jsonBody.event;
      const eventId = jsonBody.event_id || "";

      // Dedup — Slack retries if it doesn't get 200 in 3s
      if (eventId && isDuplicateEvent(eventId)) {
        console.log(`[webhook:slack] Duplicate event ${eventId} — skipping`);
        return NextResponse.json({ status: "ok" });
      }

      console.log(`[webhook:slack] Event: ${event?.type} for bot "${bot.name}" (${eventId})`);

      // Handle message events (DMs + channels, human only)
      if (event?.type === "message" && !event.bot_id && !event.subtype && event.text && event.channel) {
        // Fire and forget — return 200 immediately
        void processSlackMessage({
          botConfig: bot,
          channel: event.channel,
          user: event.user || "unknown",
          text: event.text,
          threadTs: event.thread_ts,
          eventTs: event.ts || "",
        });
      }

      // Handle app_mention events
      if (event?.type === "app_mention" && !event.bot_id && event.text && event.channel) {
        void processSlackMessage({
          botConfig: bot,
          channel: event.channel,
          user: event.user || "unknown",
          text: event.text,
          threadTs: event.thread_ts,
          eventTs: event.ts || "",
        });
      }

      // Handle reaction events (log only for now)
      if (event?.type === "reaction_added") {
        console.log(`[webhook:slack] Reaction :${event.reaction}: added in ${event.item?.channel}`);
      }

      return NextResponse.json({ status: "ok" });
    }

    // ── 5. Handle Slash Commands ──────────────────────────────────────────
    if (commandBody?.command) {
      const { command, text, user_id, user_name, channel_id, response_url, trigger_id } = commandBody;

      // Dedup by trigger_id
      if (trigger_id && isDuplicateEvent(trigger_id)) {
        console.log(`[webhook:slack] Duplicate command ${trigger_id} — skipping`);
        return NextResponse.json({ response_type: "ephemeral", text: "Already processing..." });
      }

      console.log(`[webhook:slack] Command: ${command} "${text}" from @${user_name} via bot "${bot.name}"`);

      // Fire and forget async processing
      void processSlackCommand({
        botConfig: bot,
        command,
        text: text || "",
        userId: user_id,
        userName: user_name,
        channelId: channel_id,
        responseUrl: response_url,
      });

      // Return immediate acknowledgement
      return NextResponse.json({
        response_type: "ephemeral",
        text: `Processing \`${command}${text ? " " + text : ""}\`...`,
      });
    }

    // ── 6. Unhandled payload type ─────────────────────────────────────────
    console.log("[webhook:slack] Unhandled payload type:", jsonBody?.type || "unknown");
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("[webhook:slack] Error processing webhook:", err);
    // Always return 200 to prevent Slack retries on errors
    return NextResponse.json({ status: "error" }, { status: 200 });
  }
}
