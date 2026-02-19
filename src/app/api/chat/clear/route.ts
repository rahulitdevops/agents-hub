import { NextResponse } from "next/server";
import { existsSync, unlinkSync, readdirSync } from "fs";
import { join } from "path";

/**
 * POST /api/chat/clear — Clear the openclaw session memory.
 *
 * Deletes session files for the "groot-webchat" session so the agent
 * starts fresh on the next message.
 */
export async function POST() {
  const sessionDir = "/root/.openclaw/agents/main/sessions";
  let cleared = 0;

  try {
    if (existsSync(sessionDir)) {
      const files = readdirSync(sessionDir);
      for (const file of files) {
        if (file.includes("groot-webchat")) {
          const filePath = join(sessionDir, file);
          try {
            unlinkSync(filePath);
            cleared++;
          } catch {
            // ignore individual file errors
          }
        }
      }
    }
  } catch (err) {
    console.error("[chat/clear] Error clearing session:", err);
  }

  return NextResponse.json({ cleared });
}
