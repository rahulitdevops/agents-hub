import { NextRequest, NextResponse } from "next/server";
import { runtime } from "@/lib/openclaw-runtime";
import { isDockerAvailable, createAgentContainer } from "@/lib/container-manager";

// GET /api/agents — list all agents
export async function GET() {
  const agents = runtime.getAgents();
  return NextResponse.json({ agents, count: agents.length });
}

// POST /api/agents — create a new agent
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const agent = runtime.createAgent(body);

    // Spawn a dedicated Docker container for the new agent
    if (isDockerAvailable()) {
      createAgentContainer(agent).catch((err) =>
        console.error(`[api/agents] Container create failed for ${agent.name}:`, err),
      );
    }

    return NextResponse.json({ agent }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
