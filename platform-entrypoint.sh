#!/bin/sh
# ─── OpenClaw Platform Docker Entrypoint ──────────────────────────────────
# Sets up the openclaw --local agent environment:
#   1. Seeds openclaw.json from shared config volume or seed-config
#   2. Copies workspace files (SOUL.md, IDENTITY.md, etc.)
#   3. Creates agent directories for sessions and auth
#   4. Migrates settings.json from old format if needed

set -e

OPENCLAW_HOME="/root/.openclaw"
SHARED_CONFIG="/app/openclaw-config"
SEED_DIR="/seed-config"

echo "[platform] Initializing OpenClaw agent environment..."

# ── 1. Ensure directory structure ──────────────────────────────────────────
mkdir -p "${OPENCLAW_HOME}/agents/main/agent" \
         "${OPENCLAW_HOME}/agents/main/sessions" \
         "${OPENCLAW_HOME}/workspace"

# ── 2. Seed openclaw.json ─────────────────────────────────────────────────
# Priority: shared volume > seed config > skip
if [ -f "${SHARED_CONFIG}/openclaw.json" ]; then
  echo "[platform] Copying openclaw.json from shared config volume..."
  cp "${SHARED_CONFIG}/openclaw.json" "${OPENCLAW_HOME}/openclaw.json"
elif [ -f "${SEED_DIR}/openclaw.json" ]; then
  echo "[platform] Seeding openclaw.json from seed config..."
  cp "${SEED_DIR}/openclaw.json" "${OPENCLAW_HOME}/openclaw.json"
fi

# ── 3. Fixup workspace path for platform (root user) ─────────────────────
if [ -f "${OPENCLAW_HOME}/openclaw.json" ]; then
  # Replace /home/node/.openclaw/workspace with /root/.openclaw/workspace
  sed -i 's|/home/node/.openclaw/workspace|/root/.openclaw/workspace|g' "${OPENCLAW_HOME}/openclaw.json" 2>/dev/null || true
fi

# ── 4. Copy workspace files ──────────────────────────────────────────────
# Priority: shared volume workspace > seed config workspace
if [ -d "${SHARED_CONFIG}/workspace" ] && [ "$(ls -A ${SHARED_CONFIG}/workspace 2>/dev/null)" ]; then
  echo "[platform] Copying workspace files from shared volume..."
  cp -r "${SHARED_CONFIG}/workspace/"* "${OPENCLAW_HOME}/workspace/" 2>/dev/null || true
elif [ -d "${SEED_DIR}/workspace" ] && [ "$(ls -A ${SEED_DIR}/workspace 2>/dev/null)" ]; then
  echo "[platform] Seeding workspace files from seed config..."
  cp -r "${SEED_DIR}/workspace/"* "${OPENCLAW_HOME}/workspace/" 2>/dev/null || true
fi

# ── 5. Copy skills if available ──────────────────────────────────────────
if [ -d "${SHARED_CONFIG}/skills" ] && [ "$(ls -A ${SHARED_CONFIG}/skills 2>/dev/null)" ]; then
  echo "[platform] Copying skills from shared volume..."
  mkdir -p "${OPENCLAW_HOME}/skills"
  cp -r "${SHARED_CONFIG}/skills/"* "${OPENCLAW_HOME}/skills/" 2>/dev/null || true
fi

# ── 6. Copy tools if available ───────────────────────────────────────────
if [ -d "${SHARED_CONFIG}/tools" ] && [ "$(ls -A ${SHARED_CONFIG}/tools 2>/dev/null)" ]; then
  echo "[platform] Copying tools from shared volume..."
  mkdir -p "${OPENCLAW_HOME}/tools"
  cp -r "${SHARED_CONFIG}/tools/"* "${OPENCLAW_HOME}/tools/" 2>/dev/null || true
fi

# ── 7. Quick openclaw sanity check ───────────────────────────────────────
if command -v openclaw >/dev/null 2>&1; then
  echo "[platform] OpenClaw CLI: $(openclaw --version 2>/dev/null || echo 'installed')"
else
  echo "[platform] WARNING: OpenClaw CLI not found in PATH"
fi

# ── 8. Seed agent data if volume is empty (first boot / volume loss) ───
# The /app/data/ directory is a Docker volume mount. On first boot it's empty.
# We seed from /seed-data/data/ which is baked into the Docker image.
if [ ! -f "/app/data/agents.json" ] && [ -f "/seed-data/data/agents.json" ]; then
  echo "[platform] Seeding agents.json from image (first boot)..."
  cp /seed-data/data/agents.json /app/data/agents.json
fi
if [ ! -f "/app/data/tasks.json" ] && [ -f "/seed-data/data/tasks.json" ]; then
  echo "[platform] Seeding tasks.json from image..."
  cp /seed-data/data/tasks.json /app/data/tasks.json
fi
if [ ! -f "/app/data/settings.json" ] && [ -f "/seed-data/data/settings.json" ]; then
  echo "[platform] Seeding settings.json from image..."
  cp /seed-data/data/settings.json /app/data/settings.json
fi

echo "[platform] Agent environment ready. Starting Next.js..."
exec "$@"
