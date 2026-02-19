# HEARTBEAT.md - Periodic Check Instructions

> **Note:** Keep this file empty or comment-only to skip heartbeat API calls. Add tasks when you want periodic checks.

---

## 🔄 How Heartbeats Work

OpenClaw sends periodic "heartbeat" messages to this session. When received:
1. Read this file for instructions
2. Do the checks listed below
3. Reply `HEARTBEAT_OK` if nothing needs attention
4. Reply with alert text if something needs Das's attention

**Current Status:** 🟢 Active (Gateway reconnection monitoring)

---

## 📋 Active Checks

### Gateway Reconnection Monitor
**ACTIVE** - Check if WhatsApp gateway reconnected after being down
- Check gateway status every heartbeat
- Track last known status in: memory/heartbeat-state.json → gatewayStatus
- If status changes from "disconnected" → "connected":
  - Send greeting: "Hi 👋 Groot is back online!"
  - Include reason for downtime (from logs)
  - Include duration of downtime
- Status codes to watch: 408 (timeout), 440 (login timeout), disconnections

---

### AI & Tech News Monitor 🤖
**ACTIVE** - Monitor breaking news in AI/ML and tech industry
- **Frequency:** 2-3x per day (morning ~9AM, afternoon ~3PM, evening ~8PM IST)
- **Track in:** memory/heartbeat-state.json → lastChecks.aiNews
- **Sources to check:** Google search, tech news sites via browser
- **Topics to monitor:**
  - New AI model releases (OpenAI, Anthropic, Google, Meta, Mistral)
  - AI agent developments and frameworks
  - Major funding rounds in AI startups
  - Regulatory news (EU AI Act, US policy, copyright cases)
  - Open-source AI releases
  - AI product launches from major companies
  - AI research breakthroughs
  
**Alert Das when:**
- New model release from major players (GPT-5, Claude 4, Gemini 2, etc.)
- Significant AI agent news (new frameworks, capabilities)
- Major AI startup funding (>$100M rounds)
- Important regulatory decisions
- Breaking AI news that affects the industry

**Format for alerts:**
```
🤖 AI NEWS ALERT

📰 [Headline]
🏢 Source: [Company/Publication]
📅 Date: [When]

Summary: [2-3 sentence summary]

Why it matters: [Brief significance]

🔗 [Link if available]
```

**Skip alerting for:**
- Minor product updates
- Routine announcements
- News older than 24 hours
- Duplicate stories already reported

---

## 📋 Potential Future Checks (Activate by uncommenting)

### Email Monitoring
**ACTIVE** - Check Gmail for unread emails
- Account: rahul_g@joinalyke.com
- Alert if: Any unread important emails (mark with star/label)
- Frequency: 2-4x per day (morning, midday, evening)
- Track in: memory/heartbeat-state.json → lastChecks.email
- Skip: Late night (23:00-08:00)

### Calendar Reminders
**ACTIVE** - Check Apple Calendar for upcoming events
- Alert if: Event starting in next 2 hours
- Frequency: Every heartbeat (15 min intervals)
- Track in: memory/heartbeat-state.json → lastChecks.calendar
- Skip: Late night (23:00-08:00) unless marked urgent

### Weather Updates
<!--
- Check weather for Calcutta
- Alert if: Rain/storm in next 3 hours
- Frequency: Max 2x per day (morning + evening)
- Track in: memory/heartbeat-state.json → lastChecks.weather
-->

### Social Media Mentions
<!--
- Check Twitter/Discord for @mentions
- Alert if: Unread mentions > 5 minutes old
- Track in: memory/heartbeat-state.json → lastChecks.social
-->

### Project Monitoring
<!--
- Check git status for uncommitted changes in active projects
- Alert if: Changes sitting >24 hours
- Projects: (list paths here)
-->

### System Health
<!--
- Check disk space, memory, CPU
- Alert if: Disk >90%, Memory >85%
- Frequency: Once per day
-->

---

## ⏰ Timing Guidelines

**Check rotation:** Don't do everything every heartbeat. Rotate checks:
- **High priority:** Email, calendar (2-4x per day)
- **Medium priority:** Weather, social (1-2x per day)
- **Low priority:** System health, git status (1x per day)

**Quiet hours:** 23:00-08:00 IST
- Skip non-urgent checks
- Only alert for truly important things

**State tracking:** Use `memory/heartbeat-state.json`:
```json
{
  "lastChecks": {
    "email": 1770145200,
    "calendar": 1770140000,
    "weather": null
  }
}
```

---

## 🎯 When to Alert vs HEARTBEAT_OK

**Alert if:**
- Important email arrived
- Calendar event <2h away
- Weather warning (rain/storm coming)
- Something broke or needs attention
- It's been >8h since last proactive message (check-in)

**HEARTBEAT_OK if:**
- Nothing new since last check
- Late night (unless urgent)
- Das is clearly busy
- Just checked <30 min ago
- Everything is fine

---

## 🔧 Proactive Work During Heartbeats

Even if there's nothing to alert, you can do useful background work:

### Memory Maintenance
- Read recent memory/YYYY-MM-DD.md files
- Update MEMORY.md with significant learnings
- Clean up outdated info

### File Organization
- Organize scattered notes
- Update documentation
- Commit and push doc changes

### Project Health
- Run `git status` on active projects
- Check for TODOs or FIXMEs
- Update project docs

**Rule:** Do this work silently. Only reply if you find something Das should know about.

---

## 📝 Current Active Checks

**Status:** ✅ Email, Calendar, Gateway, AI News monitoring ACTIVE  

**Configured for Das:**
- [x] Email monitoring (Gmail: rahul_g@joinalyke.com)
- [x] Calendar reminders (Apple Calendar)
- [x] Gateway reconnection alerts (WhatsApp)
- [x] **AI & Tech News** (2-3x daily, focus on AI/agents)
- [ ] Weather alerts (available, not active)
- [ ] Git status (available, not active)

---

_Heartbeats are for being helpful in the background. Don't be annoying, but don't be invisible either._
