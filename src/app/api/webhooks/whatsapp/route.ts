import { NextRequest, NextResponse } from "next/server";
import { loadSettings } from "@/lib/settings";

/**
 * WhatsApp Webhook — Meta Cloud API
 *
 * GET  — Webhook verification (Meta sends hub.mode, hub.verify_token, hub.challenge)
 * POST — Incoming messages from WhatsApp users
 */

// ─── GET: Webhook Verification ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && challenge) {
    // Look up the verify token from saved channel integrations
    const settings = loadSettings();
    const whatsapp = (settings.channelIntegrations || []).find(
      (c) => c.channel === "whatsapp" && c.enabled
    );

    const savedToken = whatsapp?.credentials?.verifyToken;

    if (savedToken && token === savedToken) {
      console.log("[webhook:whatsapp] Verification successful");
      return new NextResponse(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    console.warn("[webhook:whatsapp] Verification failed — token mismatch");
    return NextResponse.json({ error: "Verification failed" }, { status: 403 });
  }

  return NextResponse.json({ status: "WhatsApp webhook active" });
}

// ─── POST: Incoming Messages ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Log incoming webhook payload
    console.log("[webhook:whatsapp] Incoming:", JSON.stringify(body).slice(0, 500));

    // Extract message data from Meta's webhook format
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (value?.messages?.[0]) {
      const msg = value.messages[0];
      const from = msg.from;           // sender phone number
      const text = msg.text?.body;      // message text
      const msgType = msg.type;         // "text", "image", "audio", etc.

      console.log(`[webhook:whatsapp] Message from ${from}: [${msgType}] ${text || "(media)"}`);

      // TODO: Route to agent for processing
      // - Load agent config
      // - Send message to openclaw agent
      // - Reply via WhatsApp Cloud API
    }

    // Always return 200 to acknowledge receipt (Meta will retry on non-200)
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("[webhook:whatsapp] Error processing webhook:", err);
    return NextResponse.json({ status: "ok" }); // Still return 200 to prevent Meta retries
  }
}
