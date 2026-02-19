#!/bin/sh
# ─── OpenClaw Gateway Docker Entrypoint ─────────────────────────────────────
# Seeds ~/.openclaw from /seed-config if the config dir is empty/missing,
# then starts the OpenClaw gateway.

set -e

OPENCLAW_HOME="${HOME}/.openclaw"
SEED_DIR="/seed-config"

# Seed config if openclaw.json doesn't exist yet
if [ ! -f "${OPENCLAW_HOME}/openclaw.json" ] && [ -d "${SEED_DIR}" ]; then
  echo "[entrypoint] Seeding OpenClaw config from ${SEED_DIR}..."
  cp -rn "${SEED_DIR}/." "${OPENCLAW_HOME}/" 2>/dev/null || true
  echo "[entrypoint] Config seeded."
else
  echo "[entrypoint] Existing config found at ${OPENCLAW_HOME}/openclaw.json"
fi

# Ensure writable directories exist
mkdir -p "${OPENCLAW_HOME}/agents" \
         "${OPENCLAW_HOME}/browser" \
         "${OPENCLAW_HOME}/canvas" \
         "${OPENCLAW_HOME}/completions" \
         "${OPENCLAW_HOME}/credentials" \
         "${OPENCLAW_HOME}/cron" \
         "${OPENCLAW_HOME}/devices" \
         "${OPENCLAW_HOME}/identity" \
         "${OPENCLAW_HOME}/logs" \
         "${OPENCLAW_HOME}/media" \
         "${OPENCLAW_HOME}/skills" \
         "${OPENCLAW_HOME}/tools" \
         "${OPENCLAW_HOME}/workspace"

echo "[entrypoint] Starting OpenClaw gateway..."
exec "$@"
