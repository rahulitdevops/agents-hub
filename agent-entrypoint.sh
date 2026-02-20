#!/bin/sh
# ─── OpenClaw Per-Agent Container Entrypoint ────────────────────────────────
# Initializes the openclaw environment for a dedicated agent container.
# Agent-specific config is injected via environment variables at container creation.
#
# Required env vars: AGENT_NAME, AGENT_ID, AGENT_MODEL, AGENT_SLUG
# Optional env vars: AGENT_SYSTEM_PROMPT, ANTHROPIC_API_KEY, OPENAI_API_KEY

set -e

OPENCLAW_HOME="/root/.openclaw"
SHARED_CONFIG="/app/openclaw-config"
SEED_DIR="/seed-config"
AGENT_NAME="${AGENT_NAME:-agent}"
AGENT_ID="${AGENT_ID:-unknown}"
AGENT_MODEL="${AGENT_MODEL:-anthropic/claude-sonnet-4-6}"
AGENT_SLUG="${AGENT_SLUG:-agent}"
SESSION_DIR="/sessions/${AGENT_SLUG}"

echo "[agent:${AGENT_NAME}] Initializing agent container..."

# ── 1. Ensure directory structure ──────────────────────────────────────────
mkdir -p "${OPENCLAW_HOME}/agents/main/agent" \
         "${OPENCLAW_HOME}/agents/main/sessions" \
         "${OPENCLAW_HOME}/workspace" \
         "${SESSION_DIR}"

# ── 2. Seed openclaw.json ─────────────────────────────────────────────────
# Priority: shared volume > seed config
if [ -f "${SHARED_CONFIG}/openclaw.json" ]; then
  echo "[agent:${AGENT_NAME}] Copying openclaw.json from shared config volume..."
  cp "${SHARED_CONFIG}/openclaw.json" "${OPENCLAW_HOME}/openclaw.json"
elif [ -f "${SEED_DIR}/openclaw.json" ]; then
  echo "[agent:${AGENT_NAME}] Seeding openclaw.json from seed config..."
  cp "${SEED_DIR}/openclaw.json" "${OPENCLAW_HOME}/openclaw.json"
fi

# ── 3. Fix workspace path for agent (root user) + override model ──────────
if [ -f "${OPENCLAW_HOME}/openclaw.json" ]; then
  # Fix workspace path
  sed -i 's|/home/node/.openclaw/workspace|/root/.openclaw/workspace|g' \
    "${OPENCLAW_HOME}/openclaw.json" 2>/dev/null || true

  # Override the primary model to agent's configured model
  node -e "
    const fs = require('fs');
    try {
      const cfg = JSON.parse(fs.readFileSync('${OPENCLAW_HOME}/openclaw.json', 'utf-8'));
      if (!cfg.agents) cfg.agents = {};
      if (!cfg.agents.defaults) cfg.agents.defaults = {};
      if (!cfg.agents.defaults.model) cfg.agents.defaults.model = {};
      cfg.agents.defaults.model.primary = '${AGENT_MODEL}';
      fs.writeFileSync('${OPENCLAW_HOME}/openclaw.json', JSON.stringify(cfg, null, 2));
      console.log('[agent:${AGENT_NAME}] Model set to ${AGENT_MODEL}');
    } catch (err) {
      console.error('[agent:${AGENT_NAME}] Failed to set model:', err.message);
    }
  "
fi

# ── 4. Copy workspace files ──────────────────────────────────────────────
if [ -d "${SHARED_CONFIG}/workspace" ] && [ "$(ls -A ${SHARED_CONFIG}/workspace 2>/dev/null)" ]; then
  echo "[agent:${AGENT_NAME}] Copying workspace files from shared volume..."
  cp -r "${SHARED_CONFIG}/workspace/"* "${OPENCLAW_HOME}/workspace/" 2>/dev/null || true
elif [ -d "${SEED_DIR}/workspace" ] && [ "$(ls -A ${SEED_DIR}/workspace 2>/dev/null)" ]; then
  echo "[agent:${AGENT_NAME}] Seeding workspace files from seed config..."
  cp -r "${SEED_DIR}/workspace/"* "${OPENCLAW_HOME}/workspace/" 2>/dev/null || true
fi

# ── 5. Copy skills if available ──────────────────────────────────────────
if [ -d "${SHARED_CONFIG}/skills" ] && [ "$(ls -A ${SHARED_CONFIG}/skills 2>/dev/null)" ]; then
  echo "[agent:${AGENT_NAME}] Copying skills from shared volume..."
  mkdir -p "${OPENCLAW_HOME}/skills"
  cp -r "${SHARED_CONFIG}/skills/"* "${OPENCLAW_HOME}/skills/" 2>/dev/null || true
fi

# ── 6. Copy tools if available ───────────────────────────────────────────
if [ -d "${SHARED_CONFIG}/tools" ] && [ "$(ls -A ${SHARED_CONFIG}/tools 2>/dev/null)" ]; then
  echo "[agent:${AGENT_NAME}] Copying tools from shared volume..."
  mkdir -p "${OPENCLAW_HOME}/tools"
  cp -r "${SHARED_CONFIG}/tools/"* "${OPENCLAW_HOME}/tools/" 2>/dev/null || true
fi

# ── 7. Copy auth profiles ───────────────────────────────────────────────
AUTH_SRC="${SHARED_CONFIG}/agents/main/agent/auth-profiles.json"
AUTH_FALLBACK="/app/data/auth-profiles.json"
AUTH_DST="${OPENCLAW_HOME}/agents/main/agent/auth-profiles.json"

if [ -f "${AUTH_SRC}" ]; then
  echo "[agent:${AGENT_NAME}] Copying auth profiles from shared config..."
  cp "${AUTH_SRC}" "${AUTH_DST}"
elif [ -f "${AUTH_FALLBACK}" ]; then
  echo "[agent:${AGENT_NAME}] Copying auth profiles from data volume..."
  cp "${AUTH_FALLBACK}" "${AUTH_DST}"
fi

# ── 8. Write agent context to workspace ─────────────────────────────────
SYSTEM_PROMPT="${AGENT_SYSTEM_PROMPT:-You are a helpful AI assistant.}"
cat > "${OPENCLAW_HOME}/workspace/WORKER-CONTEXT.md" <<CTXEOF
# Agent Context

You are **${AGENT_NAME}** (id: \`${AGENT_ID}\`).
You are a sub-agent running in your own dedicated container on the OpenClaw Platform.
Execute the assigned task thoroughly and return results.

## Your System Prompt

${SYSTEM_PROMPT}

---
Container started: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Model: ${AGENT_MODEL}
CTXEOF

# ── 9. Link sessions to persistent volume ───────────────────────────────
# This ensures session memory persists across container restarts
if [ -d "${SESSION_DIR}" ]; then
  rm -rf "${OPENCLAW_HOME}/agents/main/sessions" 2>/dev/null || true
  ln -sf "${SESSION_DIR}" "${OPENCLAW_HOME}/agents/main/sessions"
  echo "[agent:${AGENT_NAME}] Sessions linked to persistent volume: ${SESSION_DIR}"
fi

# ── 10. Sanity check ────────────────────────────────────────────────────
if command -v openclaw >/dev/null 2>&1; then
  echo "[agent:${AGENT_NAME}] OpenClaw CLI: $(openclaw --version 2>/dev/null || echo 'installed')"
else
  echo "[agent:${AGENT_NAME}] WARNING: OpenClaw CLI not found in PATH"
fi

echo "[agent:${AGENT_NAME}] Agent container ready. Model: ${AGENT_MODEL}"
exec "$@"
