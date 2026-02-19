#!/bin/sh
# ─── OpenClaw Worker Pool Docker Entrypoint ──────────────────────────────────
# Sets up the openclaw --local agent environment for the worker pool.
# Mirrors platform-entrypoint.sh but tailored for worker execution.

set -e

OPENCLAW_HOME="/root/.openclaw"
SHARED_CONFIG="/app/openclaw-config"
SEED_DIR="/seed-config"

echo "[worker] Initializing OpenClaw worker environment..."

# ── 1. Ensure directory structure ──────────────────────────────────────────
mkdir -p "${OPENCLAW_HOME}/agents/main/agent" \
         "${OPENCLAW_HOME}/agents/main/sessions" \
         "${OPENCLAW_HOME}/workspace"

# ── 2. Seed openclaw.json ─────────────────────────────────────────────────
# Priority: shared volume > seed config
if [ -f "${SHARED_CONFIG}/openclaw.json" ]; then
  echo "[worker] Copying openclaw.json from shared config volume..."
  cp "${SHARED_CONFIG}/openclaw.json" "${OPENCLAW_HOME}/openclaw.json"
elif [ -f "${SEED_DIR}/openclaw.json" ]; then
  echo "[worker] Seeding openclaw.json from seed config..."
  cp "${SEED_DIR}/openclaw.json" "${OPENCLAW_HOME}/openclaw.json"
fi

# ── 3. Fixup workspace path for worker (root user) ────────────────────────
if [ -f "${OPENCLAW_HOME}/openclaw.json" ]; then
  sed -i 's|/home/node/.openclaw/workspace|/root/.openclaw/workspace|g' "${OPENCLAW_HOME}/openclaw.json" 2>/dev/null || true
fi

# ── 4. Copy workspace files ──────────────────────────────────────────────
if [ -d "${SHARED_CONFIG}/workspace" ] && [ "$(ls -A ${SHARED_CONFIG}/workspace 2>/dev/null)" ]; then
  echo "[worker] Copying workspace files from shared volume..."
  cp -r "${SHARED_CONFIG}/workspace/"* "${OPENCLAW_HOME}/workspace/" 2>/dev/null || true
elif [ -d "${SEED_DIR}/workspace" ] && [ "$(ls -A ${SEED_DIR}/workspace 2>/dev/null)" ]; then
  echo "[worker] Seeding workspace files from seed config..."
  cp -r "${SEED_DIR}/workspace/"* "${OPENCLAW_HOME}/workspace/" 2>/dev/null || true
fi

# ── 5. Copy skills if available ──────────────────────────────────────────
if [ -d "${SHARED_CONFIG}/skills" ] && [ "$(ls -A ${SHARED_CONFIG}/skills 2>/dev/null)" ]; then
  echo "[worker] Copying skills from shared volume..."
  mkdir -p "${OPENCLAW_HOME}/skills"
  cp -r "${SHARED_CONFIG}/skills/"* "${OPENCLAW_HOME}/skills/" 2>/dev/null || true
fi

# ── 6. Copy tools if available ───────────────────────────────────────────
if [ -d "${SHARED_CONFIG}/tools" ] && [ "$(ls -A ${SHARED_CONFIG}/tools 2>/dev/null)" ]; then
  echo "[worker] Copying tools from shared volume..."
  mkdir -p "${OPENCLAW_HOME}/tools"
  cp -r "${SHARED_CONFIG}/tools/"* "${OPENCLAW_HOME}/tools/" 2>/dev/null || true
fi

# ── 7. Copy auth profiles from platform's shared data ────────────────────
# The platform writes auth-profiles.json to /app/data; we also check shared config
AUTH_SRC="${SHARED_CONFIG}/agents/main/agent/auth-profiles.json"
AUTH_DST="${OPENCLAW_HOME}/agents/main/agent/auth-profiles.json"
if [ -f "${AUTH_SRC}" ]; then
  echo "[worker] Copying auth profiles from shared config..."
  cp "${AUTH_SRC}" "${AUTH_DST}"
fi

# ── 8. Quick openclaw sanity check ───────────────────────────────────────
if command -v openclaw >/dev/null 2>&1; then
  echo "[worker] OpenClaw CLI: $(openclaw --version 2>/dev/null || echo 'installed')"
else
  echo "[worker] WARNING: OpenClaw CLI not found in PATH"
fi

echo "[worker] Worker environment ready. Starting worker pool..."
exec "$@"
