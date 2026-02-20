# Agent Hub — Slack Bot Manifests

## Agents

| Bot | Handle | Role | Color | Slash Commands |
|-----|--------|------|-------|----------------|
| **Groot** | `@groot` | Director | `#1E293B` (slate) | `/groot` `/agents` `/task` `/status` |
| **Forge** | `@forge` | Backend | `#0F172A` (dark) | `/forge` `/api` `/schema` |
| **Pixel** | `@pixel` | Frontend | `#7C3AED` (violet) | `/pixel` `/component` `/ui-review` |
| **Helm** | `@helm` | DevOps | `#0369A1` (blue) | `/helm` `/deploy` `/pipeline` |
| **Sentinel** | `@sentinel` | SRE | `#DC2626` (red) | `/sentinel` `/incident` `/health` `/postmortem` |
| **Quill** | `@quill` | Content | `#059669` (green) | `/quill` `/docs` `/changelog` `/review` |

## Setup

### 1. Create Slack Apps

For each manifest file, go to [api.slack.com/apps](https://api.slack.com/apps):

1. Click **Create New App** > **From an app manifest**
2. Select your workspace
3. Paste the YAML content from the manifest file
4. Replace `${AGENT_HUB_DOMAIN}` with your actual domain (e.g., `agenthub.yourdomain.com`)
5. Click **Create**
6. Install to workspace

### 2. Collect Credentials

After creating each app, collect:
- **Bot Token** (`xoxb-...`) — OAuth & Permissions > Bot User OAuth Token
- **Signing Secret** — Basic Information > App Credentials

### 3. Configure Agent Hub

Add credentials to your `.env`:

```bash
# Groot (Director)
SLACK_GROOT_BOT_TOKEN=xoxb-...
SLACK_GROOT_SIGNING_SECRET=...

# Forge (Backend)
SLACK_FORGE_BOT_TOKEN=xoxb-...
SLACK_FORGE_SIGNING_SECRET=...

# Pixel (Frontend)
SLACK_PIXEL_BOT_TOKEN=xoxb-...
SLACK_PIXEL_SIGNING_SECRET=...

# Helm (DevOps)
SLACK_HELM_BOT_TOKEN=xoxb-...
SLACK_HELM_SIGNING_SECRET=...

# Sentinel (SRE)
SLACK_SENTINEL_BOT_TOKEN=xoxb-...
SLACK_SENTINEL_SIGNING_SECRET=...

# Quill (Content)
SLACK_QUILL_BOT_TOKEN=xoxb-...
SLACK_QUILL_SIGNING_SECRET=...
```

### 4. Webhook URL

All bots share a single webhook endpoint:

```
POST https://<AGENT_HUB_DOMAIN>/api/webhooks/slack
```

The webhook handler routes to the correct agent based on the bot token / command used.
