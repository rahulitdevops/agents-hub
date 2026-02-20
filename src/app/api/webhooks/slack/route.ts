import { NextRequest, NextResponse } from "next/server";

/**
 * Slack Webhook — Events API & Slash Commands
 *
 * POST — Handles:
 *   1. URL verification (type: "url_verification") — returns challenge
 *   2. Event callbacks (type: "event_callback") — incoming messages, reactions, etc.
 *   3. Slash commands — interactive command payloads
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ── 1. URL Verification (Slack sends this when you set up Event Subscriptions)
    if (body.type === "url_verification") {
      console.log("[webhook:slack] URL verification — returning challenge");
      return NextResponse.json({ challenge: body.challenge });
    }

    // ── 2. Event Callbacks
    if (body.type === "event_callback") {
      const event = body.event;
      console.log(`[webhook:slack] Event: ${event?.type}`, JSON.stringify(event).slice(0, 300));

      if (event?.type === "message" && !event.bot_id && !event.subtype) {
        const user = event.user;
        const text = event.text;
        const channel = event.channel;
        const ts = event.ts;

        console.log(`[webhook:slack] Message from ${user} in ${channel}: ${text}`);

        // TODO: Route to agent for processing
        // - Load agent config
        // - Send message to openclaw agent
        // - Reply via Slack Web API (chat.postMessage)
        void ts; // suppress unused warning
      }

      // Always return 200 immediately to acknowledge receipt
      return NextResponse.json({ status: "ok" });
    }

    // ── 3. Slash Commands (application/x-www-form-urlencoded, but we accept JSON too)
    if (body.command) {
      console.log(`[webhook:slack] Slash command: ${body.command} from ${body.user_name}`);

      // TODO: Handle slash commands
      return NextResponse.json({
        response_type: "ephemeral",
        text: `Agent Hub received: \`${body.command}\` — processing coming soon.`,
      });
    }

    console.log("[webhook:slack] Unhandled payload type:", body.type || "unknown");
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("[webhook:slack] Error processing webhook:", err);
    return NextResponse.json({ status: "error" }, { status: 200 }); // Return 200 to prevent retries
  }
}
