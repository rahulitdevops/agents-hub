/**
 * Slack Interactions Webhook
 *
 * Handles interactive component payloads: button clicks, modal submissions,
 * select menus, and message shortcuts. Slack sends these as form-encoded
 * with a single "payload" field containing JSON.
 *
 * This is a minimal stub — expand as interactive features are built.
 */

import { NextRequest, NextResponse } from "next/server";
import { getBotByAppId, verifySlackSignature } from "@/lib/slack-client";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const timestamp = req.headers.get("x-slack-request-timestamp") || "";
    const signature = req.headers.get("x-slack-signature") || "";

    // Interactions are always form-encoded with a "payload" field
    const params = new URLSearchParams(rawBody);
    const payloadStr = params.get("payload");

    if (!payloadStr) {
      console.warn("[webhook:slack:interactions] No payload in request");
      return NextResponse.json({ error: "No payload" }, { status: 400 });
    }

    const payload = JSON.parse(payloadStr);

    // Resolve bot from api_app_id
    const bot = getBotByAppId(payload.api_app_id || "");
    if (!bot) {
      console.warn(`[webhook:slack:interactions] Unknown app_id: ${payload.api_app_id}`);
      return NextResponse.json({ status: "ok" });
    }

    // Verify signature
    if (bot.signingSecret) {
      const valid = verifySlackSignature(bot.signingSecret, timestamp, rawBody, signature);
      if (!valid) {
        console.warn(`[webhook:slack:interactions] Signature failed for bot "${bot.name}"`);
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    // Route by interaction type
    switch (payload.type) {
      case "block_actions":
        console.log(
          `[webhook:slack:interactions] Block action from @${payload.user?.username || "unknown"} via ${bot.name}:`,
          payload.actions?.map((a: { action_id: string }) => a.action_id).join(", ")
        );
        // TODO: Handle button clicks, select menus, etc.
        break;

      case "view_submission":
        console.log(
          `[webhook:slack:interactions] Modal submission via ${bot.name}:`,
          payload.view?.callback_id
        );
        // TODO: Handle modal form submissions
        break;

      case "shortcut":
      case "message_action":
        console.log(
          `[webhook:slack:interactions] Shortcut/action via ${bot.name}:`,
          payload.callback_id
        );
        // TODO: Handle message shortcuts
        break;

      default:
        console.log(`[webhook:slack:interactions] Unhandled type: ${payload.type}`);
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("[webhook:slack:interactions] Error:", err);
    return NextResponse.json({ status: "error" }, { status: 200 });
  }
}
