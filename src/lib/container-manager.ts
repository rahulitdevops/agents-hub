/**
 * Container Manager — Manages per-agent Docker containers.
 *
 * Each sub-agent gets its own dedicated Docker container, named
 * `openclaw-agent-{slug}`. Containers stay idle (tail -f /dev/null)
 * and tasks are dispatched via `docker exec`.
 *
 * If Docker socket is unavailable, the system falls back to direct
 * `execFile` in the platform container.
 */

import Docker from "dockerode";
import { existsSync } from "fs";
import { execFile } from "child_process";
import type { AgentConfig, Task } from "./types";
import { GROOT_AGENT_ID } from "./types";

// ─── Configuration ────────────────────────────────────────────────────────────

const DOCKER_SOCKET = "/var/run/docker.sock";
const AGENT_IMAGE = process.env.AGENT_CONTAINER_IMAGE || "agents-hub-worker-pool";
const DOCKER_NETWORK = process.env.DOCKER_NETWORK || "agents-hub_default";
const CONTAINER_PREFIX = "openclaw-agent-";
const EXEC_TIMEOUT = 180_000; // 3 minutes
const MAX_BUFFER = 10 * 1024 * 1024; // 10MB

// ─── State ────────────────────────────────────────────────────────────────────

let docker: Docker | null = null;
let dockerAvailable = false;

// Simple lock to serialize operations on the same agent
const operationLocks = new Map<string, Promise<void>>();

// ─── Initialization ───────────────────────────────────────────────────────────

export function initDocker(): boolean {
  try {
    if (!existsSync(DOCKER_SOCKET)) {
      console.log("[container-manager] Docker socket not found at", DOCKER_SOCKET);
      dockerAvailable = false;
      return false;
    }
    docker = new Docker({ socketPath: DOCKER_SOCKET });
    dockerAvailable = true;
    console.log("[container-manager] Docker client initialized");
    return true;
  } catch (err) {
    console.error("[container-manager] Failed to init Docker:", err);
    dockerAvailable = false;
    return false;
  }
}

export function isDockerAvailable(): boolean {
  return dockerAvailable;
}

// ─── Name Helpers ─────────────────────────────────────────────────────────────

export function agentSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

export function containerName(agentName: string): string {
  return `${CONTAINER_PREFIX}${agentSlug(agentName)}`;
}

// ─── Lock Helper ──────────────────────────────────────────────────────────────

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = operationLocks.get(key) || Promise.resolve();
  const current = prev.then(fn, fn);
  operationLocks.set(key, current.then(() => {}, () => {}));
  return current;
}

// ─── Container Lifecycle ──────────────────────────────────────────────────────

async function getContainer(name: string): Promise<Docker.Container | null> {
  if (!docker) return null;
  try {
    const container = docker.getContainer(name);
    await container.inspect();
    return container;
  } catch {
    return null;
  }
}

export async function createAgentContainer(agent: AgentConfig): Promise<string> {
  if (!docker) throw new Error("Docker not available");

  const name = containerName(agent.name);

  return withLock(name, async () => {
    // Check if already exists
    const existing = await getContainer(name);
    if (existing) {
      const info = await existing.inspect();
      if (!info.State.Running) {
        await existing.start();
        console.log(`[container-manager] Started existing container ${name}`);
      }
      return existing.id;
    }

    // Truncate system prompt for env var (Docker has limits)
    const systemPrompt = (agent.systemPrompt || "You are a helpful AI assistant.").substring(0, 4000);

    const container = await docker!.createContainer({
      name,
      Image: AGENT_IMAGE,
      Entrypoint: ["agent-entrypoint.sh"],
      Cmd: ["tail", "-f", "/dev/null"],
      Env: [
        `AGENT_NAME=${agent.name}`,
        `AGENT_ID=${agent.id}`,
        `AGENT_MODEL=${agent.model}`,
        `AGENT_SLUG=${agentSlug(agent.name)}`,
        `AGENT_SYSTEM_PROMPT=${systemPrompt}`,
        `HOME=/root`,
        `NODE_ENV=production`,
        // Pass API keys from platform's environment
        `ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY || ""}`,
        `OPENAI_API_KEY=${process.env.OPENAI_API_KEY || ""}`,
        `GOOGLE_API_KEY=${process.env.GOOGLE_API_KEY || ""}`,
        `DEEPSEEK_API_KEY=${process.env.DEEPSEEK_API_KEY || ""}`,
      ],
      HostConfig: {
        Binds: [
          "openclaw-config:/app/openclaw-config:ro",
          "openclaw-agent-sessions:/sessions",
        ],
        NetworkMode: DOCKER_NETWORK,
        RestartPolicy: { Name: "unless-stopped", MaximumRetryCount: 0 },
      },
      Labels: {
        "openclaw.agent.id": agent.id,
        "openclaw.agent.name": agent.name,
        "openclaw.agent.role": agent.role,
        "openclaw.managed": "true",
      },
    });

    await container.start();
    console.log(`[container-manager] Created and started container ${name} (${container.id.substring(0, 12)})`);

    // Brief wait for entrypoint to initialize
    await new Promise((r) => setTimeout(r, 2000));

    return container.id;
  });
}

export async function startAgentContainer(agentName: string): Promise<void> {
  if (!docker) return;
  const name = containerName(agentName);

  return withLock(name, async () => {
    const container = await getContainer(name);
    if (!container) {
      console.warn(`[container-manager] Container ${name} not found for start`);
      return;
    }
    const info = await container.inspect();
    if (!info.State.Running) {
      await container.start();
      console.log(`[container-manager] Started container ${name}`);
    }
  });
}

export async function stopAgentContainer(agentName: string): Promise<void> {
  if (!docker) return;
  const name = containerName(agentName);

  return withLock(name, async () => {
    const container = await getContainer(name);
    if (!container) return;
    const info = await container.inspect();
    if (info.State.Running) {
      await container.stop({ t: 5 });
      console.log(`[container-manager] Stopped container ${name}`);
    }
  });
}

export async function removeAgentContainer(agentName: string): Promise<void> {
  if (!docker) return;
  const name = containerName(agentName);

  return withLock(name, async () => {
    const container = await getContainer(name);
    if (!container) return;
    try {
      await container.stop({ t: 5 });
    } catch {
      /* may already be stopped */
    }
    await container.remove({ force: true });
    console.log(`[container-manager] Removed container ${name}`);
  });
}

// ─── Task Execution via docker exec ───────────────────────────────────────────

export interface AgentExecResult {
  success: boolean;
  reply?: string;
  error?: string;
  model?: string;
  tokensUsed?: number;
  duration: number;
  agentId: string;
  agentName: string;
}

export async function execInAgentContainer(
  agent: AgentConfig,
  taskInput: string,
  options?: {
    sessionId?: string;
    thinking?: string;
    platformEnv?: Record<string, string>;
  },
): Promise<AgentExecResult> {
  if (!docker) throw new Error("Docker not available");

  const name = containerName(agent.name);
  const container = await getContainer(name);

  if (!container) {
    // Auto-create container if it doesn't exist
    console.log(`[container-manager] Container ${name} not found, creating...`);
    await createAgentContainer(agent);
    // Re-fetch
    const newContainer = await getContainer(name);
    if (!newContainer) {
      throw new Error(`Failed to create container ${name}`);
    }
    return execInContainer(newContainer, agent, taskInput, options);
  }

  // Ensure running
  const info = await container.inspect();
  if (!info.State.Running) {
    await container.start();
    await new Promise((r) => setTimeout(r, 2000));
  }

  return execInContainer(container, agent, taskInput, options);
}

async function execInContainer(
  container: Docker.Container,
  agent: AgentConfig,
  taskInput: string,
  options?: {
    sessionId?: string;
    thinking?: string;
    platformEnv?: Record<string, string>;
  },
): Promise<AgentExecResult> {
  const session = options?.sessionId || `agent-${agent.id}`;
  const thinking = options?.thinking || agent.thinking || "medium";

  const cmd = [
    "openclaw", "agent", "--local",
    "--agent", "main",
    "--session-id", session,
    "--thinking", thinking,
    "--json",
    "-m", taskInput,
  ];

  // Build env list for platform credentials
  const envList = Object.entries(options?.platformEnv || {}).map(
    ([k, v]) => `${k}=${v}`,
  );

  const startTime = Date.now();

  const exec = await container.exec({
    Cmd: cmd,
    Env: envList.length > 0 ? envList : undefined,
    AttachStdout: true,
    AttachStderr: true,
  });

  return new Promise<AgentExecResult>((resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        success: false,
        error: "Execution timed out (180s)",
        duration: Date.now() - startTime,
        agentId: agent.id,
        agentName: agent.name,
      });
    }, EXEC_TIMEOUT);

    exec.start({ Tty: false }, (err: Error | null, stream: NodeJS.ReadableStream | undefined) => {
      if (err || !stream) {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: err?.message || "Failed to start exec",
          duration: Date.now() - startTime,
          agentId: agent.id,
          agentName: agent.name,
        });
        return;
      }

      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => {
        clearTimeout(timeout);
        const rawOutput = Buffer.concat(chunks).toString("utf-8");
        const duration = Date.now() - startTime;

        // Docker multiplexed stream has 8-byte header per frame
        // Clean the output by removing non-printable prefixes
        const output = cleanDockerOutput(rawOutput).trim();

        console.log(`[container-manager] Exec completed for ${agent.name} in ${duration}ms (${output.length} bytes)`);
        resolve(parseAgentOutput(output, duration, agent));
      });
      stream.on("error", (streamErr: Error) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: `Stream error: ${streamErr.message}`,
          duration: Date.now() - startTime,
          agentId: agent.id,
          agentName: agent.name,
        });
      });
    });
  });
}

/**
 * Clean Docker multiplexed stream output.
 * Docker exec with AttachStdout adds 8-byte headers to each frame:
 * [stream_type(1), 0, 0, 0, size(4)] + payload
 */
function cleanDockerOutput(raw: string): string {
  // Try to find JSON in the output (handles Docker stream headers)
  const jsonStart = raw.indexOf("{");
  const jsonEnd = raw.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    return raw.substring(jsonStart, jsonEnd + 1);
  }
  // If no JSON found, strip non-printable chars and return
  return raw.replace(/[\x00-\x08\x0e-\x1f]/g, "").trim();
}

// ─── Output Parsing (mirrors worker-pool/server.js lines 226-292) ─────────────

function parseAgentOutput(
  output: string,
  duration: number,
  agent: AgentConfig,
): AgentExecResult {
  if (!output) {
    return {
      success: false,
      error: "Empty response from agent",
      duration,
      agentId: agent.id,
      agentName: agent.name,
    };
  }

  try {
    const result = JSON.parse(output);

    // OpenClaw --json format: { payloads: [{ text }], meta: { agentMeta } }
    if (result.payloads && Array.isArray(result.payloads)) {
      const textParts = result.payloads
        .map((p: { text?: string }) => p.text)
        .filter(Boolean);
      const replyText = textParts.join("\n\n");
      const meta = result.meta?.agentMeta;

      return {
        success: true,
        reply: replyText || "Task completed (no text output)",
        model: meta ? `${meta.provider}/${meta.model}` : agent.model,
        tokensUsed: meta?.usage?.total || meta?.lastCallUsage?.total || 0,
        duration,
        agentId: agent.id,
        agentName: agent.name,
      };
    }

    // Fallback formats
    const text =
      result.text || result.content || result.reply || result.result?.text || result.message;
    if (text) {
      return {
        success: true,
        reply: text,
        model: result.model || agent.model,
        tokensUsed: result.tokensUsed || result.usage?.total_tokens || 0,
        duration,
        agentId: agent.id,
        agentName: agent.name,
      };
    }

    if (result.error) {
      return {
        success: false,
        error:
          typeof result.error === "string"
            ? result.error
            : result.error.message || JSON.stringify(result.error),
        duration,
        agentId: agent.id,
        agentName: agent.name,
      };
    }

    // Raw output as reply
    return { success: true, reply: output, duration, agentId: agent.id, agentName: agent.name };
  } catch {
    // Non-JSON output — treat as text reply
    return { success: true, reply: output, duration, agentId: agent.id, agentName: agent.name };
  }
}

// ─── Fallback: Direct Execution in Platform Container ─────────────────────────

export function dispatchDirectExecution(
  agent: AgentConfig,
  task: Task,
  taskInput: string,
  platformEnv: Record<string, string>,
  onComplete: (result: AgentExecResult) => void,
): void {
  const session = `local-${agent.id}`;
  const thinking = agent.thinking || "medium";

  const args = [
    "agent", "--local",
    "--agent", "main",
    "--session-id", session,
    "--thinking", thinking,
    "--json",
    "-m", taskInput,
  ];

  const startTime = Date.now();

  execFile(
    "openclaw",
    args,
    {
      timeout: EXEC_TIMEOUT,
      maxBuffer: MAX_BUFFER,
      env: { ...process.env, ...platformEnv, HOME: "/root" },
    },
    (error, stdout, stderr) => {
      const duration = Date.now() - startTime;

      if (stderr) {
        console.log(`[container-manager] Direct exec stderr (${agent.name}): ${stderr.substring(0, 200)}`);
      }

      if (error && !stdout?.trim()) {
        const errDetail = stderr?.includes("No API key")
          ? "No API key configured"
          : error.message;
        onComplete({
          success: false,
          error: errDetail,
          duration,
          agentId: agent.id,
          agentName: agent.name,
        });
        return;
      }

      const output = stdout?.trim() || "";
      onComplete(parseAgentOutput(output, duration, agent));
    },
  );
}

// ─── Container Status ─────────────────────────────────────────────────────────

export interface ContainerInfo {
  name: string;
  agentId: string;
  agentName: string;
  role: string;
  state: string;
  containerId: string;
}

export async function getAgentContainerStatus(
  agentName: string,
): Promise<{ exists: boolean; running: boolean; containerId?: string }> {
  if (!docker) return { exists: false, running: false };
  const name = containerName(agentName);
  const container = await getContainer(name);
  if (!container) return { exists: false, running: false };
  const info = await container.inspect();
  return {
    exists: true,
    running: info.State.Running,
    containerId: container.id,
  };
}

export interface ContainerStats {
  cpuPercent: number;
  memoryPercent: number;
}

export async function getContainerStats(agentName: string): Promise<ContainerStats | null> {
  if (!docker) return null;
  const name = containerName(agentName);
  const container = await getContainer(name);
  if (!container) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stats: any = await container.stats({ stream: false });
    // Calculate CPU percentage
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const numCpus = stats.cpu_stats.online_cpus || stats.cpu_stats.cpu_usage.percpu_usage?.length || 1;
    const cpuPercent = systemDelta > 0 ? +((cpuDelta / systemDelta) * numCpus * 100).toFixed(1) : 0;

    // Calculate memory percentage
    const memUsage = stats.memory_stats.usage || 0;
    const memLimit = stats.memory_stats.limit || 1;
    const memoryPercent = +((memUsage / memLimit) * 100).toFixed(1);

    return { cpuPercent, memoryPercent };
  } catch {
    return null;
  }
}

export async function getAllManagedContainers(): Promise<ContainerInfo[]> {
  if (!docker) return [];
  try {
    const containers = await docker.listContainers({
      all: true,
      filters: { label: ["openclaw.managed=true"] },
    });

    return containers.map((c) => ({
      name: c.Names[0]?.replace(/^\//, "") || "",
      agentId: c.Labels["openclaw.agent.id"] || "",
      agentName: c.Labels["openclaw.agent.name"] || "",
      role: c.Labels["openclaw.agent.role"] || "",
      state: c.State || "unknown",
      containerId: c.Id.substring(0, 12),
    }));
  } catch (err) {
    console.error("[container-manager] Failed to list containers:", err);
    return [];
  }
}

// ─── Reconciliation (on platform startup) ─────────────────────────────────────

export async function reconcileAgentContainers(agents: AgentConfig[]): Promise<void> {
  if (!docker) return;

  // 1. Verify Docker connectivity
  try {
    await docker.ping();
  } catch {
    dockerAvailable = false;
    console.warn("[container-manager] Docker ping failed, disabling container mode");
    return;
  }

  console.log("[container-manager] Reconciling agent containers...");

  // 2. List all managed containers
  const containers = await docker.listContainers({
    all: true,
    filters: { label: ["openclaw.managed=true"] },
  });

  const existingContainers = new Map(
    containers.map((c) => [c.Names[0]?.replace(/^\//, ""), c]),
  );

  // 3. For each persisted agent (not Groot), ensure container matches desired state
  for (const agent of agents) {
    if (agent.id === GROOT_AGENT_ID) continue;

    const name = containerName(agent.name);
    const containerInfo = existingContainers.get(name);

    if (agent.status === "running") {
      if (!containerInfo) {
        // Agent should be running but no container — create it
        console.log(`[container-manager] Recreating container for ${agent.name}`);
        try {
          await createAgentContainer(agent);
        } catch (err) {
          console.error(`[container-manager] Failed to create container for ${agent.name}:`, err);
        }
      } else if (containerInfo.State !== "running") {
        // Container exists but not running — start it
        try {
          const container = docker.getContainer(containerInfo.Id);
          await container.start();
          console.log(`[container-manager] Restarted container ${name}`);
        } catch (err) {
          console.error(`[container-manager] Failed to restart ${name}:`, err);
        }
      } else {
        console.log(`[container-manager] Container ${name} already running`);
      }
    } else if (agent.status === "stopped" || agent.status === "paused") {
      if (containerInfo && containerInfo.State === "running") {
        // Agent stopped but container running — stop it
        try {
          const container = docker.getContainer(containerInfo.Id);
          await container.stop({ t: 5 });
          console.log(`[container-manager] Stopped container ${name} (agent stopped)`);
        } catch (err) {
          console.error(`[container-manager] Failed to stop ${name}:`, err);
        }
      }
    }

    // Remove from map so we can detect orphans
    existingContainers.delete(name);
  }

  // 4. Remove orphan containers (containers whose agent no longer exists)
  for (const [orphanName, containerInfo] of existingContainers) {
    console.log(`[container-manager] Removing orphan container ${orphanName}`);
    try {
      const container = docker.getContainer(containerInfo.Id);
      try {
        await container.stop({ t: 2 });
      } catch {
        /* already stopped */
      }
      await container.remove({ force: true });
    } catch (err) {
      console.error(`[container-manager] Failed to remove orphan ${orphanName}:`, err);
    }
  }

  console.log("[container-manager] Reconciliation complete");
}
