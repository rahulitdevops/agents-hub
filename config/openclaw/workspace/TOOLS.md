# TOOLS.md - Local Setup & Reference

> Skills define _how_ tools work. This file is for _your specifics_ — the stuff unique to Das's setup.

---

## 🖥️ System Info

### Machine
- **Model:** MacBook Air
- **OS:** macOS (Darwin 25.2.0)
- **Architecture:** arm64 (Apple Silicon)
- **Node:** v22.22.0
- **OpenClaw:** 2026.2.1 (ed4529e)

### Paths
- **Workspace:** `/Users/rahuldas/.openclaw/workspace` (docs, memory, config only)
- **Projects:** `/Users/rahuldas/projects/` ⭐ **DEFAULT for all builds/apps**
- **OpenClaw config:** `/Users/rahuldas/.openclaw/openclaw.json`
- **OpenClaw install:** `/Users/rahuldas/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw`
- **Skills:** `/Users/rahuldas/.openclaw/skills` + built-in skills

---

## 🤖 AI Models

### Anthropic (Cloud, Paid)
- **Provider:** anthropic
- **Auth:** Token (sk-ant…MBSAAA)
- **Models available:**
  - `anthropic/claude-sonnet-4-5` (alias: `sonnet`) — **DEFAULT**
  - `anthropic/claude-haiku-4-5`
- **Cost:**
  - Sonnet: $3/1M input, $15/1M output
  - Haiku: Cheaper, faster, less capable

### Ollama (Local, Free)
- **Provider:** ollama
- **Endpoint:** `http://127.0.0.1:11434/v1`
- **Models installed:**
  - `ollama/llama3.2:latest` (alias: `llama`) — 3.2B, 2.0 GB
  - `ollama/qwen2.5-coder:latest` — 7.6B, 4.7 GB
  - `ollama/deepseek-r1:8b` — 8.2B, 5.2 GB
  - `ollama/codellama:13b` — 13B, 7.4 GB
- **Usage:** Simple tasks only; struggles with OpenClaw's complex prompts
- **Switch:** `/llama` or `/model ollama/llama3.2:latest`

### Google Gemini
- **Provider:** google-gemini-cli
- **Auth:** OAuth (rahul.itservice@gmail.com)
- **Usage:** Available via skill, not primary agent

---

## 📡 Communication Channels

### WhatsApp
- **Plugin:** Enabled
- **Mode:** selfChatMode (same phone conversations)
- **Allowlist:** +917042028777 (Das)
- **Format:** Start replies with 🌱 emoji
- **Debounce:** 0ms
- **Media limit:** 50MB
- **No prefix** (removed `[openclaw]` tag)

### Webchat
- **Status:** Connected
- **Port:** 18789
- **Bind:** loopback (local only)
- **Auth:** Password protected (was@123)

---

## 🛠️ Skills & External Tools

### Available Skills
- **github** — Git operations via `gh` CLI
- **weather** — Current weather and forecasts
- **gemini** — Gemini CLI for Q&A
- **bluebubbles** — iMessage integration
- **coding-agent** — Run coding assistants in background
- **find-skills** — Discover installable skills

### External Integrations

#### Notion 📝
- **Integration:** Alyke Assistant
- **API Key:** Stored in `~/.config/notion/api_key`
- **Database:** Alyke Tasks
- **Database ID:** 2fed89e1-bff1-8007-85cf-d378c025f804
- **Status:** ✅ Connected and tested
- **Setup Date:** 2026-02-06
- **Config:** `notion-alyke-config.md` (workspace)
- **Usage:** Create, update, query Alyke tasks
- **Properties (Simplified):**
  1. Task (title)
  2. Description (text)
  3. Targeted/Delivery (text)
  4. Status (Not started / In progress / Done)
  5. Docs (text)

#### Apple Notes 📝
- **CLI:** memo (v0.3.3)
- **Installed:** 2026-02-04
- **Location:** `/opt/homebrew/bin/memo`
- **Permissions:** Requires Automation access to Notes.app
  - Grant in: System Settings > Privacy & Security > Automation
- **Usage:** Create, view, edit, delete, search notes

#### Apple Reminders ⏰
- **CLI:** remindctl (v0.1.1)
- **Installed:** 2026-02-04
- **Location:** `/opt/homebrew/bin/remindctl`
- **Permissions:** Requires Reminders access
  - Grant in: System Settings > Privacy & Security > Reminders
  - Run `remindctl authorize` to trigger prompt
- **Usage:** List, add, edit, complete, delete reminders

---

## 🎙️ TTS / Voice

### Status
- **TTS configured:** Not yet
- **Preferred voice:** *(To be set)*
- **ElevenLabs (sag):** Not configured

### Notes
- Once configured, use voice for stories, movie summaries, "storytime" moments
- More engaging than walls of text
- Surprise people with funny voices

---

## 📹 Cameras & Nodes

### Paired Nodes
- *(None configured yet)*

### Camera Setup
- *(To be documented when configured)*

**Example format:**
```
- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered
```

---

## 🔐 SSH & Remote Access

### SSH Hosts
- *(To be documented as needed)*

**Example format:**
```
- home-server → 192.168.1.100, user: admin
- dev-box → ssh config alias, key-based auth
```

---

## 📋 Quick Commands

### Model Switching
```bash
/sonnet              # Switch to Claude Sonnet 4.5
/llama               # Switch to Llama 3.2 (local)
/model <name>        # Switch to specific model
```

### Status & Info
```bash
/status              # Show session status, usage, model
/whoami              # Show sender ID
/commands            # List available commands
/help                # General help
```

### Gateway Control
```bash
/restart             # Restart gateway
/stop                # Stop gateway
```

### Useful Shell Aliases
- *(To be added as patterns emerge)*

---

## 🌍 Timezone & Locale

- **Timezone:** Asia/Calcutta (GMT+5:30)
- **Language:** English + Hindi (Hinglish)
- **Date format:** YYYY-MM-DD (ISO 8601)

---

## 🔄 Automation

### Heartbeat Checks
- **File:** HEARTBEAT.md
- **Status:** Currently empty (no periodic checks)
- **Potential uses:**
  - Email checks (Gmail)
  - Calendar reminders
  - Weather updates
  - Social media notifications

### Cron Jobs
- **Status:** None configured yet
- **Use for:** Scheduled reminders, exact-time tasks

---

## 📝 Platform-Specific Notes

### Discord
- *(Not configured)*

### Telegram
- *(Not configured)*

### Slack
- *(Not configured)*

### WhatsApp (Primary)
- Start replies with 🌱
- No markdown tables (use bullet lists)
- No inline buttons enabled yet
- `selfChatMode` active (same phone DMs)

---

## 💾 Backup & Recovery

### Important Paths to Back Up
- `/Users/rahuldas/.openclaw/workspace` — All workspace files
- `/Users/rahuldas/.openclaw/openclaw.json` — Config
- `/Users/rahuldas/.openclaw/skills` — Custom skills

### Recovery Notes
- *(To be documented)*

---

## 🎯 Environment Variables

- *(To be documented as needed)*

---

_This file grows as the setup evolves. Keep it updated with actual working configurations, not just examples._
