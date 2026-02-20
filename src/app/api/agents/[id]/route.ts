import { NextRequest, NextResponse } from "next/server";
import { runtime } from "@/lib/openclaw-runtime";
import { GROOT_AGENT_ID } from "@/lib/types";
import {
  isDockerAvailable,
  startAgentContainer,
  stopAgentContainer,
  removeAgentContainer,
} from "@/lib/container-manager";

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

  // Action shortcuts — sync container lifecycle with agent status
  if (body.action === "start") {
    const agent = runtime.startAgent(id);
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    if (isDockerAvailable() && agent.id !== GROOT_AGENT_ID) {
      startAgentContainer(agent.name).catch((err) =>
        console.error(`[api/agents] Container start failed for ${agent.name}:`, err),
      );
    }
    return NextResponse.json({ agent });
  }
  if (body.action === "pause") {
    const agent = runtime.pauseAgent(id);
    return agent ? NextResponse.json({ agent }) : NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  if (body.action === "stop") {
    const agent = runtime.stopAgent(id);
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    if (isDockerAvailable() && agent.id !== GROOT_AGENT_ID) {
      stopAgentContainer(agent.name).catch((err) =>
        console.error(`[api/agents] Container stop failed for ${agent.name}:`, err),
      );
    }
    return NextResponse.json({ agent });
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

  // Get agent name before deleting (needed for container removal)
  const agent = runtime.getAgent(id);
  const deleted = runtime.deleteAgent(id);
  if (!deleted) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  // Remove the agent's dedicated Docker container
  if (agent && isDockerAvailable()) {
    removeAgentContainer(agent.name).catch((err) =>
      console.error(`[api/agents] Container remove failed for ${agent.name}:`, err),
    );
  }

  return NextResponse.json({ success: true });
}
