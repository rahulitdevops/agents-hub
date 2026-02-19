import { NextRequest, NextResponse } from "next/server";
import { runtime } from "@/lib/openclaw-runtime";
import { GROOT_AGENT_ID } from "@/lib/types";

// GET /api/agents/:id
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = runtime.getAgent(id);
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  return NextResponse.json({ agent });
}

// PATCH /api/agents/:id — update agent config or trigger actions
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  // Action shortcuts
  if (body.action === "start") {
    const agent = runtime.startAgent(id);
    return agent ? NextResponse.json({ agent }) : NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  if (body.action === "pause") {
    const agent = runtime.pauseAgent(id);
    return agent ? NextResponse.json({ agent }) : NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  if (body.action === "stop") {
    const agent = runtime.stopAgent(id);
    return agent ? NextResponse.json({ agent }) : NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const agent = runtime.updateAgent(id, body);
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  return NextResponse.json({ agent });
}

// DELETE /api/agents/:id
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === GROOT_AGENT_ID) {
    return NextResponse.json({ error: "Cannot delete the Director agent" }, { status: 403 });
  }
  const deleted = runtime.deleteAgent(id);
  if (!deleted) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
