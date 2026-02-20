<div align="center">

# 🤖 Agent Hub

**Deploy, monitor, and orchestrate AI agents from a single control plane.**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docker.com)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![OpenClaw](https://img.shields.io/badge/Powered%20by-OpenClaw-orange)](https://openclaw.ai)

*A self-hosted platform for managing teams of AI agents — each running in its own Docker container, coordinated by a Director agent, with real-time monitoring and a beautiful dashboard.*

[Quick Start](#-quick-start) · [Features](#-features) · [Architecture](#-architecture) · [Configuration](#-configuration) · [API Reference](#-api-reference)

</div>

---

## ✨ Features

### 🏠 Dashboard
Real-time overview of your entire agent fleet — cost tracking, token usage, task throughput, and per-agent performance metrics with interactive charts.

### 💬 Chat Interface
Talk directly to **Groot** (the Director agent) through a built-in chat UI. Groot reads your workspace files, uses tools, and delegates tasks to sub-agents automatically.

### 🤖 Agent Management
Create, configure, start/stop/pause agents from the UI. Each agent gets:
- Dedicated Docker container with isolated execution
- Configurable model, thinking level, temperature, system prompt
- Real-time CPU/memory monitoring
- Channel integrations (WhatsApp, Telegram, Discord, Slack, Webchat)

### 📋 Task Queue
Kanban-style task board with drag-and-drop. Tasks flow through: **Queued → Running → Completed/Failed**. Park tasks for offline agents, reassign on the fly.

### 📊 Analytics
30-day analytics dashboard with switchable views — cost, tokens, requests, errors. Per-agent breakdowns and trend analysis.

### ⚙️ Settings
Configure API keys for multiple providers, manage platform integrations (AWS, GitHub, Notion, etc.), and control gateway settings.

### 🧠 Multi-Provider Models
Support for **12+ models** across 7 providers out of the box:

| Provider | Models |
|----------|--------|
| **Anthropic** | Claude Opus 4.6, Sonnet 4.6/4.5, Haiku 4.5 |
| **OpenAI** | GPT-4o, GPT-4o mini |
| **Google** | Gemini 2.0 Flash, Gemini 1.5 Pro (2M context!) |
| **DeepSeek** | DeepSeek R1 |
| **Groq** | Llama 3.3 70B (ultra-fast inference) |
| **Mistral** | Mistral Large |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser / Client                   │
│              (Next.js React Dashboard)                │
└──────────────┬──────────────────┬────────────────────┘
               │ HTTP/REST        │ WebSocket
               ▼                  ▼
┌──────────────────────┐  ┌─────────────────────┐
│   Platform Service   │  │  OpenClaw Gateway    │
│   (Next.js + API)    │──│  (Agent Runtime)     │
│   Port 3000          │  │  Port 18789          │
│                      │  │                      │
│  • Dashboard UI      │  │  • Agent sessions    │
│  • REST API          │  │  • Tool execution    │
│  • Agent management  │  │  • Skill loading     │
│  • Task dispatch     │  │  • Memory management │
└──────┬───────────────┘  └──────────────────────┘
       │ Docker API
       ▼
┌─────────────────────────────────────────────────────┐
│                   Docker Engine                       │
│                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Agent: Writer │  │ Agent: Coder │  │ Agent: ... │ │
│  │ (container)   │  │ (container)  │  │ (container)│ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │         Worker Pool (fallback execution)         │ │
│  │                  Port 18790                      │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Three Docker services:**
- **Platform** — Next.js dashboard + API (port 3000)
- **Gateway** — OpenClaw agent runtime with tools, skills, memory (port 18789)
- **Worker Pool** — Fallback execution engine + container image builder (port 18790)

**Per-agent containers** are dynamically created when you add agents. Each runs an isolated OpenClaw instance with its own session, model config, and system prompt.

---

## 🚀 Quick Start

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) + [Docker Compose](https://docs.docker.com/compose/install/)
- An API key from at least one provider (Anthropic recommended)

### 1. Clone & Configure

```bash
git clone https://github.com/rahulitdevops/agents-hub.git
cd agents-hub
cp .env.example .env
```

Edit `.env` with your API key:
```env
ANTHROPIC_API_KEY=sk-ant-...your-key-here
OPENCLAW_GATEWAY_TOKEN=your-secure-token
DASHBOARD_PASSWORD=your-dashboard-password
```

### 2. Launch

```bash
docker compose up -d
```

### 3. Open Dashboard

Navigate to **http://localhost:3000** → You're in! 🎉

---

### Local Development (without Docker)

```bash
# Install dependencies
npm install

# Install OpenClaw globally
npm install -g openclaw@latest

# Start the gateway
openclaw gateway --port 18789 --verbose &

# Start Next.js dev server
npm run dev
```

Open **http://localhost:3000**

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key | — |
| `OPENAI_API_KEY` | OpenAI API key (optional) | — |
| `OPENCLAW_GATEWAY_URL` | Gateway WebSocket URL | `ws://gateway:18789` |
| `OPENCLAW_GATEWAY_PORT` | Gateway port | `18789` |
| `OPENCLAW_GATEWAY_TOKEN` | Gateway auth token | — |
| `DASHBOARD_PASSWORD` | Basic auth for dashboard | — (open in dev) |
| `DATABASE_URL` | SQLite or PostgreSQL | `file:./data/openclaw.db` |
| `PORT` | Platform port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `LOG_LEVEL` | Logging level | `info` |

### Authentication Modes

**`OPENCLAW_AUTH_MODE=api_key`** (default) — Use provider API keys directly.

**`OPENCLAW_AUTH_MODE=claude_subscription`** — Use your Claude Pro/Team session key.

---

## 📁 Project Structure

```
agents-hub/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── dashboard/          # Main dashboard
│   │   ├── agents/             # Agent management + detail
│   │   ├── chat/               # Chat with Groot
│   │   ├── tasks/              # Task queue / Kanban
│   │   ├── analytics/          # Analytics dashboard
│   │   ├── settings/           # API keys & integrations
│   │   └── api/                # REST API routes
│   │       ├── agents/         # CRUD agents
│   │       ├── chat/           # Chat endpoint
│   │       ├── tasks/          # Task management
│   │       ├── analytics/      # Analytics data
│   │       ├── workers/        # Worker pool status
│   │       └── settings/       # Settings management
│   ├── components/             # React components
│   │   ├── chat/               # Chat UI components
│   │   ├── sidebar.tsx         # Navigation sidebar
│   │   ├── header.tsx          # Page header
│   │   ├── model-picker.tsx    # Model selection component
│   │   └── task-board.tsx      # Kanban task board
│   ├── hooks/                  # Custom React hooks
│   └── lib/                    # Core business logic
│       ├── openclaw-runtime.ts # Runtime singleton (agents, tasks, analytics)
│       ├── container-manager.ts# Docker container lifecycle
│       ├── agent-actions.ts    # Action block parser & executor
│       ├── agent-bus.ts        # Agent-to-agent communication
│       ├── model-registry.ts   # Model definitions & pricing
│       ├── settings.ts         # Settings & API key management
│       ├── platform-integrations.ts # External platform credentials
│       ├── worker-client.ts    # Worker pool HTTP client
│       ├── types.ts            # TypeScript type definitions
│       └── utils.ts            # Shared utilities
├── config/openclaw/            # OpenClaw gateway config
├── worker-pool/                # Worker pool service
├── docker-compose.yml          # Multi-service orchestration
├── Dockerfile                  # Platform container
├── Dockerfile.gateway          # Gateway container
├── Dockerfile.worker           # Worker pool container
└── middleware.ts               # Dashboard Basic Auth
```

---

## 📡 API Reference

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/agents` | List all agents |
| `POST` | `/api/agents` | Create a new agent |
| `GET` | `/api/agents/:id` | Get agent details |
| `PATCH` | `/api/agents/:id` | Update agent / trigger action |
| `DELETE` | `/api/agents/:id` | Delete agent + container |

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Send message to Groot |
| `POST` | `/api/chat/clear` | Clear chat session |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tasks` | List tasks (with filters) |
| `POST` | `/api/tasks` | Create a task |
| `GET` | `/api/tasks/stream` | SSE stream for task updates |

### Analytics & Workers

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/analytics` | Dashboard summary + timeseries |
| `GET` | `/api/workers` | Worker pool + container status |

---

## 🔧 How Agent Orchestration Works

1. **You send a message** via the Chat UI
2. **Groot** (Director agent) receives it with full platform context
3. Groot can **delegate tasks** using `[AGENT_ACTION]` blocks in its response:
   ```
   [AGENT_ACTION]{"action":"assign_task","params":{"agentId":"oc-agent-abc123","input":"Write a blog post about AI agents","priority":"high"}}[/AGENT_ACTION]
   ```
4. The platform **intercepts action blocks**, executes them against the runtime
5. Tasks are **dispatched to agent containers** via `docker exec`
6. Results flow back through the **task queue** with real-time status updates

### Available Actions
- `create_agent` — Spin up a new agent with container
- `delete_agent` — Remove agent and its container
- `start_agent` / `stop_agent` / `pause_agent` — Lifecycle control
- `assign_task` — Dispatch work to any agent
- `update_agent` — Modify agent configuration

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

```bash
git clone https://github.com/rahulitdevops/agents-hub.git
cd agents-hub
npm install
npm run dev
```

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ using [OpenClaw](https://openclaw.ai) + [Next.js](https://nextjs.org)**

[⬆ Back to top](#-agent-hub)

</div>
