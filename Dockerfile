# ─── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# ─── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── Stage 3: OpenClaw CLI (build with native deps on Alpine) ────────────────
FROM node:22-alpine AS cli-builder
RUN apk add --no-cache git openssh cmake make g++ python3 linux-headers && \
    npm install -g openclaw@latest

# ─── Stage 4: Production ─────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy OpenClaw CLI from cli-builder (includes native koffi module)
# IMPORTANT: The openclaw binary is a symlink to ../lib/node_modules/openclaw/openclaw.mjs
# COPY resolves symlinks, so we must recreate the symlink manually.
COPY --from=cli-builder /usr/local/lib/node_modules/openclaw /usr/local/lib/node_modules/openclaw
RUN ln -sf ../lib/node_modules/openclaw/openclaw.mjs /usr/local/bin/openclaw

# Copy Next.js standalone build
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy seed config (openclaw.json + workspace files) for --local agent mode
COPY config/openclaw /seed-config

# Copy seed data (agents.json, tasks.json, settings.json) for first-boot recovery
COPY config/seed-data /seed-data/data

# Copy and setup platform entrypoint
COPY platform-entrypoint.sh /usr/local/bin/platform-entrypoint.sh
RUN chmod +x /usr/local/bin/platform-entrypoint.sh

# Data directory for settings / sessions
RUN mkdir -p /app/data

# Create openclaw config directory structure for --local agent mode
RUN mkdir -p /root/.openclaw/agents/main/agent \
             /root/.openclaw/agents/main/sessions \
             /root/.openclaw/workspace

EXPOSE 3000

ENTRYPOINT ["platform-entrypoint.sh"]
CMD ["node", "server.js"]
