import { NextRequest, NextResponse } from "next/server";
import { runtime } from "@/lib/openclaw-runtime";

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
    return NextResponse.json({ agent }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
