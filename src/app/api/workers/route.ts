import { NextResponse } from "next/server";
import { getWorkerPoolStatus, isWorkerPoolHealthy } from "@/lib/worker-client";
import { isDockerAvailable, getAllManagedContainers } from "@/lib/container-manager";

// GET /api/workers — Worker pool & agent container status for dashboard
export async function GET() {
  try {
    const [status, healthy] = await Promise.all([
      getWorkerPoolStatus(),
      isWorkerPoolHealthy(),
    ]);

    // Include per-agent container status when Docker is available
    let containers: { name: string; agentId: string; status: string }[] = [];
    if (isDockerAvailable()) {
      try {
        const managed = await getAllManagedContainers();
        containers = managed.map((c) => ({
          name: c.name,
          agentId: c.agentId,
          status: c.state,
        }));
      } catch (err) {
        console.error("[api/workers] Failed to list managed containers:", err);
      }
    }

    return NextResponse.json({
      healthy,
      dockerMode: isDockerAvailable(),
      containers,
      ...status,
    });
  } catch {
    return NextResponse.json(
      {
        healthy: false,
        dockerMode: isDockerAvailable(),
        containers: [],
        activeWorkers: 0,
        maxWorkers: 0,
        queueDepth: 0,
        totalExecuted: 0,
        totalFailed: 0,
      },
      { status: 200 }, // Always 200 — worker pool being down is a status, not an error
    );
  }
}
