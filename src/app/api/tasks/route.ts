import { NextRequest, NextResponse } from "next/server";
import { runtime } from "@/lib/openclaw-runtime";
import type { TaskStatus } from "@/lib/types";

// GET /api/tasks?status=running&agentId=xxx&limit=50
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tasks = runtime.getTasks({
    status: (searchParams.get("status") as TaskStatus) || undefined,
    agentId: searchParams.get("agentId") || undefined,
    limit: parseInt(searchParams.get("limit") || "100"),
  });
  return NextResponse.json({ tasks, count: tasks.length });
}

// POST /api/tasks — enqueue a new task
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const task = runtime.createTask(body);
    return NextResponse.json({ task }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
