#!/usr/bin/env node
/**
 * OpenClaw Worker Pool — Executes sub-agent tasks via `openclaw agent --local`.
 *
 * HTTP API:
 *   POST /execute   — Run a task for a specific agent
 *   GET  /health    — Health check
 *   GET  /status    — Pool status (active workers, queue, etc.)
 *
 * Concurrency is capped at MAX_CONCURRENT_WORKERS (default 8).
 * Excess requests are queued and processed FIFO.
 */

const http = require("http");
const { execFile } = require("child_process");
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require("fs");
const { join } = require("path");

// ─── Configuration ──────────────────────────────────────────────────────────

const PORT = parseInt(process.env.WORKER_PORT || "18790", 10);
const MAX_WORKERS = parseInt(process.env.MAX_CONCURRENT_WORKERS || "8", 10);
const EXEC_TIMEOUT = parseInt(process.env.WORKER_EXEC_TIMEOUT || "180000", 10); // 3 min
const MAX_BUFFER = 10 * 1024 * 1024; // 10 MB

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || "/root/.openclaw";
const AUTH_PROFILES_PATH = join(OPENCLAW_HOME, "agents/main/agent/auth-profiles.json");
const SHARED_CONFIG = process.env.SHARED_CONFIG || "/app/openclaw-config";

// ─── Worker Pool State ──────────────────────────────────────────────────────

let activeWorkers = 0;
const queue = [];
const workerHistory = []; // last 50 completed tasks
let totalExecuted = 0;
let totalFailed = 0;

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[worker-pool] ${new Date().toISOString()} ${msg}`);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

// ─── Auth Profiles Sync ─────────────────────────────────────────────────────

/**
 * Copy auth-profiles.json from shared config volume if available.
 * Platform writes this file; worker reads it.
 */
function syncAuthProfiles() {
  try {
    const sharedAuth = join(SHARED_CONFIG, "agents/main/agent/auth-profiles.json");
    if (existsSync(sharedAuth)) {
      const data = readFileSync(sharedAuth, "utf-8");
      const dir = join(OPENCLAW_HOME, "agents/main/agent");
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(AUTH_PROFILES_PATH, data);
      return true;
    }

    // Fallback: check if platform already wrote it via shared data volume
    const dataAuth = "/app/data/auth-profiles.json";
    if (existsSync(dataAuth)) {
      const data = readFileSync(dataAuth, "utf-8");
      const dir = join(OPENCLAW_HOME, "agents/main/agent");
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(AUTH_PROFILES_PATH, data);
      return true;
    }
  } catch (err) {
    log(`Auth sync error: ${err.message}`);
  }

  return existsSync(AUTH_PROFILES_PATH);
}

// ─── Agent Execution ────────────────────────────────────────────────────────

/**
 * Write a temporary openclaw config override for the agent's model.
 * This lets each agent use its own model (e.g., haiku for simple tasks).
 */
function writeAgentConfig(agentId, model) {
  try {
    const baseConfig = join(OPENCLAW_HOME, "openclaw.json");
    if (!existsSync(baseConfig)) return;

    const config = JSON.parse(readFileSync(baseConfig, "utf-8"));

    // Override the primary model
    if (!config.agents) config.agents = {};
    if (!config.agents.defaults) config.agents.defaults = {};
    if (!config.agents.defaults.model) config.agents.defaults.model = {};
    config.agents.defaults.model.primary = model;

    writeFileSync(baseConfig, JSON.stringify(config, null, 2));
  } catch (err) {
    log(`Config override error for ${agentId}: ${err.message}`);
  }
}

/**
 * Write agent context to workspace so the agent knows who it is.
 */
function writeAgentWorkspace(agentId, agentName, systemPrompt) {
  try {
    const wsDir = join(OPENCLAW_HOME, "workspace");
    if (!existsSync(wsDir)) mkdirSync(wsDir, { recursive: true });

    const contextFile = join(wsDir, "WORKER-CONTEXT.md");
    const content = `# Worker Agent Context
You are **${agentName}** (id: ${agentId}).
You are a sub-agent running in the OpenClaw worker pool.
Execute the assigned task thoroughly and return results.

## Your System Prompt
${systemPrompt || "You are a helpful AI assistant."}

Updated: ${new Date().toISOString()}
`;
    writeFileSync(contextFile, content);
  } catch (err) {
    log(`Workspace write error for ${agentId}: ${err.message}`);
  }
}

/**
 * Execute a task using `openclaw agent --local`.
 */
function executeTask(task) {
  return new Promise((resolve) => {
    const {
      agentId,
      agentName,
      model,
      systemPrompt,
      taskInput,
      sessionId,
      thinking,
      platformEnv,
    } = task;

    const session = sessionId || `worker-${agentId}`;
    const thinkLevel = thinking || "medium";

    // Pre-flight: sync auth, write config & workspace
    syncAuthProfiles();
    writeAgentConfig(agentId, model || "anthropic/claude-sonnet-4-5");
    writeAgentWorkspace(agentId, agentName, systemPrompt);

    const args = [
      "agent",
      "--local",
      "--agent", "main",
      "--session-id", session,
      "--thinking", thinkLevel,
      "--json",
      "-m", taskInput,
    ];

    log(`Executing task for ${agentName} (${agentId}): "${taskInput.substring(0, 80)}..."`);
    const startTime = Date.now();

    execFile("openclaw", args, {
      timeout: EXEC_TIMEOUT,
      maxBuffer: MAX_BUFFER,
      env: {
        ...process.env,
        ...(platformEnv || {}), // Inject platform credentials as env vars
        HOME: "/root",
      },
    }, (error, stdout, stderr) => {
      const duration = Date.now() - startTime;

      if (stderr) {
        log(`stderr (${agentId}): ${stderr.substring(0, 200)}`);
      }

      if (error && !stdout?.trim()) {
        const errDetail = stderr?.includes("No API key")
          ? "No API key configured"
          : error.message;
        log(`Task failed for ${agentName}: ${errDetail}`);
        resolve({
          success: false,
          error: errDetail,
          duration,
          agentId,
          agentName,
        });
        return;
      }

      const output = stdout?.trim();
      if (!output) {
        resolve({
          success: false,
          error: "Empty response from agent",
          duration,
          agentId,
          agentName,
        });
        return;
      }

      try {
        const result = JSON.parse(output);

        // OpenClaw --json format: { payloads: [{ text }], meta: { agentMeta } }
        if (result.payloads && Array.isArray(result.payloads)) {
          const textParts = result.payloads
            .map((p) => p.text)
            .filter(Boolean);
          const replyText = textParts.join("\n\n");
          const meta = result.meta?.agentMeta;

          resolve({
            success: true,
            reply: replyText || "Task completed (no text output)",
            model: meta ? `${meta.provider}/${meta.model}` : model,
            tokensUsed: meta?.usage?.total || meta?.lastCallUsage?.total || 0,
            duration,
            agentId,
            agentName,
          });
          return;
        }

        // Fallback formats
        const text = result.text || result.content || result.reply || result.result?.text || result.message;
        if (text) {
          resolve({
            success: true,
            reply: text,
            model: result.model || model,
            tokensUsed: result.tokensUsed || result.usage?.total_tokens || 0,
            duration,
            agentId,
            agentName,
          });
          return;
        }

        if (result.error) {
          resolve({
            success: false,
            error: typeof result.error === "string" ? result.error : result.error.message || JSON.stringify(result.error),
            duration,
            agentId,
            agentName,
          });
          return;
        }

        // Raw output as reply
        resolve({
          success: true,
          reply: output,
          duration,
          agentId,
          agentName,
        });
      } catch {
        // Non-JSON output — treat as text reply
        resolve({
          success: true,
          reply: output,
          duration,
          agentId,
          agentName,
        });
      }
    });
  });
}

// ─── Worker Pool Processor ──────────────────────────────────────────────────

function processQueue() {
  while (activeWorkers < MAX_WORKERS && queue.length > 0) {
    const { task, resolve: taskResolve } = queue.shift();
    activeWorkers++;
    log(`Worker started (${activeWorkers}/${MAX_WORKERS} active, ${queue.length} queued)`);

    executeTask(task)
      .then((result) => {
        activeWorkers--;
        totalExecuted++;
        if (!result.success) totalFailed++;

        // Track in history
        workerHistory.unshift({
          agentId: task.agentId,
          agentName: task.agentName,
          taskInput: task.taskInput?.substring(0, 100),
          success: result.success,
          duration: result.duration,
          completedAt: new Date().toISOString(),
        });
        if (workerHistory.length > 50) workerHistory.length = 50;

        log(`Worker done: ${result.success ? "OK" : "FAIL"} (${activeWorkers}/${MAX_WORKERS} active, ${queue.length} queued)`);
        taskResolve(result);
        processQueue(); // Process next in queue
      })
      .catch((err) => {
        activeWorkers--;
        totalFailed++;
        log(`Worker error: ${err.message}`);
        taskResolve({ success: false, error: err.message, agentId: task.agentId, agentName: task.agentName });
        processQueue();
      });
  }
}

function enqueueTask(task) {
  return new Promise((resolve) => {
    queue.push({ task, resolve });
    processQueue();
  });
}

// ─── HTTP Server ────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ── GET /health ─────────────────────────────────────────────────────────
  if (req.method === "GET" && url.pathname === "/health") {
    sendJSON(res, 200, { status: "ok", workers: `${activeWorkers}/${MAX_WORKERS}` });
    return;
  }

  // ── GET /status ─────────────────────────────────────────────────────────
  if (req.method === "GET" && url.pathname === "/status") {
    sendJSON(res, 200, {
      activeWorkers,
      maxWorkers: MAX_WORKERS,
      queueDepth: queue.length,
      totalExecuted,
      totalFailed,
      recentHistory: workerHistory.slice(0, 10),
      uptime: process.uptime(),
    });
    return;
  }

  // ── POST /execute ───────────────────────────────────────────────────────
  if (req.method === "POST" && url.pathname === "/execute") {
    try {
      const body = await readBody(req);

      if (!body.agentId || !body.taskInput) {
        sendJSON(res, 400, { error: "agentId and taskInput are required" });
        return;
      }

      log(`Task received for ${body.agentName || body.agentId}: "${body.taskInput.substring(0, 80)}..."`);

      const result = await enqueueTask(body);
      sendJSON(res, 200, result);
    } catch (err) {
      sendJSON(res, 400, { error: err.message });
    }
    return;
  }

  // ── POST /execute-async ─────────────────────────────────────────────────
  // Fire-and-forget: returns taskId immediately, client polls /task/:id
  if (req.method === "POST" && url.pathname === "/execute-async") {
    try {
      const body = await readBody(req);

      if (!body.agentId || !body.taskInput) {
        sendJSON(res, 400, { error: "agentId and taskInput are required" });
        return;
      }

      const taskId = `wt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      log(`Async task ${taskId} received for ${body.agentName || body.agentId}`);

      // Store result when done
      const taskResults = server._taskResults || (server._taskResults = new Map());
      taskResults.set(taskId, { status: "running", queuedAt: new Date().toISOString() });

      enqueueTask(body).then((result) => {
        taskResults.set(taskId, { status: "completed", ...result });
        // Auto-cleanup after 10 minutes
        setTimeout(() => taskResults.delete(taskId), 600_000);
      });

      sendJSON(res, 202, { taskId, status: "queued", position: queue.length });
    } catch (err) {
      sendJSON(res, 400, { error: err.message });
    }
    return;
  }

  // ── GET /task/:id ───────────────────────────────────────────────────────
  if (req.method === "GET" && url.pathname.startsWith("/task/")) {
    const taskId = url.pathname.split("/")[2];
    const taskResults = server._taskResults || new Map();
    const result = taskResults.get(taskId);

    if (!result) {
      sendJSON(res, 404, { error: "Task not found" });
      return;
    }

    sendJSON(res, 200, { taskId, ...result });
    return;
  }

  // ── 404 ─────────────────────────────────────────────────────────────────
  sendJSON(res, 404, { error: "Not found" });
});

server.listen(PORT, "0.0.0.0", () => {
  log(`Worker pool started on port ${PORT}`);
  log(`Max concurrent workers: ${MAX_WORKERS}`);
  log(`Exec timeout: ${EXEC_TIMEOUT / 1000}s`);

  // Initial auth sync
  if (syncAuthProfiles()) {
    log("Auth profiles synced from shared volume");
  } else {
    log("No auth profiles found (will sync on first task)");
  }
});
