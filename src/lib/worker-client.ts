/**
 * Worker Client — HTTP client for Platform → Worker Pool communication.
 *
 * Dispatches tasks to the worker pool container and retrieves status.
 * The worker pool URL is configured via WORKER_POOL_URL environment variable.
 */

const WORKER_POOL_URL =
  process.env.WORKER_POOL_URL || "http://worker-pool:18790";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WorkerTaskRequest {
  agentId: string;
  agentName: string;
  model: string;
  systemPrompt: string;
  taskInput: string;
  sessionId?: string;
  thinking?: string;
  platformEnv?: Record<string, string>; // Platform credential env vars for this task
}

export interface WorkerTaskResult {
  success: boolean;
  reply?: string;
  error?: string;
  model?: string;
  tokensUsed?: number;
  duration?: number;
  agentId: string;
  agentName: string;
}

export interface WorkerAsyncResponse {
  taskId: string;
  status: string;
  position?: number;
}

export interface WorkerTaskStatus {
  taskId: string;
  status: string;
  success?: boolean;
  reply?: string;
  error?: string;
  duration?: number;
  agentId?: string;
  agentName?: string;
}

export interface WorkerPoolStatus {
  activeWorkers: number;
  maxWorkers: number;
  queueDepth: number;
  totalExecuted: number;
  totalFailed: number;
  recentHistory: Array<{
    agentId: string;
    agentName: string;
    taskInput: string;
    success: boolean;
    duration: number;
    completedAt: string;
  }>;
  uptime: number;
}

// ─── Client Functions ───────────────────────────────────────────────────────

/**
 * Dispatch a task to the worker pool (synchronous — waits for result).
 * Use for short tasks where you need the result immediately.
 */
export async function dispatchToWorkerPool(
  request: WorkerTaskRequest,
): Promise<WorkerTaskResult> {
  try {
    const res = await fetch(`${WORKER_POOL_URL}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(190_000), // slightly over worker's 180s timeout
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        success: false,
        error: (data as { error?: string }).error || `Worker pool returned ${res.status}`,
        agentId: request.agentId,
        agentName: request.agentName,
      };
    }

    return (await res.json()) as WorkerTaskResult;
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "Worker pool connection failed";
    console.error(`[worker-client] Dispatch error: ${errMsg}`);
    return {
      success: false,
      error: errMsg,
      agentId: request.agentId,
      agentName: request.agentName,
    };
  }
}

/**
 * Dispatch a task asynchronously (fire-and-forget).
 * Returns a taskId immediately; poll /task/:id for results.
 */
export async function dispatchToWorkerPoolAsync(
  request: WorkerTaskRequest,
): Promise<WorkerAsyncResponse> {
  try {
    const res = await fetch(`${WORKER_POOL_URL}/execute-async`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(
        (data as { error?: string }).error || `Worker pool returned ${res.status}`,
      );
    }

    return (await res.json()) as WorkerAsyncResponse;
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "Worker pool connection failed";
    console.error(`[worker-client] Async dispatch error: ${errMsg}`);
    throw new Error(errMsg);
  }
}

/**
 * Check status of an async task.
 */
export async function getWorkerTaskStatus(
  taskId: string,
): Promise<WorkerTaskStatus> {
  const res = await fetch(`${WORKER_POOL_URL}/task/${taskId}`);
  if (!res.ok) {
    throw new Error(`Task ${taskId} not found`);
  }
  return (await res.json()) as WorkerTaskStatus;
}

/**
 * Get worker pool status (active workers, queue depth, etc.).
 */
export async function getWorkerPoolStatus(): Promise<WorkerPoolStatus> {
  try {
    const res = await fetch(`${WORKER_POOL_URL}/status`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`Worker pool returned ${res.status}`);
    }

    return (await res.json()) as WorkerPoolStatus;
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "Worker pool unavailable";
    return {
      activeWorkers: 0,
      maxWorkers: 0,
      queueDepth: 0,
      totalExecuted: 0,
      totalFailed: 0,
      recentHistory: [],
      uptime: 0,
    };
  }
}

/**
 * Check if worker pool is healthy.
 */
export async function isWorkerPoolHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${WORKER_POOL_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
