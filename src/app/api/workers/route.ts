import { NextResponse } from "next/server";
import { getWorkerPoolStatus, isWorkerPoolHealthy } from "@/lib/worker-client";

// GET /api/workers — Worker pool status for dashboard
export async function GET() {
  try {
    const [status, healthy] = await Promise.all([
      getWorkerPoolStatus(),
      isWorkerPoolHealthy(),
    ]);

    return NextResponse.json({
      healthy,
      ...status,
    });
  } catch {
    return NextResponse.json(
      { healthy: false, activeWorkers: 0, maxWorkers: 0, queueDepth: 0, totalExecuted: 0, totalFailed: 0 },
      { status: 200 }, // Always 200 — worker pool being down is a status, not an error
    );
  }
}
