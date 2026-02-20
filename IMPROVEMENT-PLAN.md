# Agents Hub — Improvement Plan

## Architecture Overview
- **Next.js 15 + React 19 + TypeScript + Tailwind** dashboard
- **OpenClaw Gateway** (WebSocket) for AI agent communication
- **Worker Pool** (Docker containers) for per-agent isolated execution
- **Zustand** state management, **Recharts** analytics, **dnd-kit** task board

## Current Issues & Improvements

### 🔴 Critical (Backend)
1. **No README.md** — empty repo front page
2. **Sidebar gateway status is hardcoded** — always shows "connected" (line in sidebar.tsx)
3. **Analytics data is seeded/fake** for empty days — no "seeded" flag in UI
4. **No authentication on API routes** — middleware only protects pages
5. **Worker pool health check in dashboard** doesn't handle offline gracefully
6. **Cost calculation assumes 50/50 input/output** — needs separate tracking
7. **Agent-bus delegate_task/send_message** aren't wired into agent-actions.ts switch
8. **Tasks not paginated** — all tasks loaded at once

### 🟡 Important (Frontend)
1. **No dark mode** — only light theme
2. **Sidebar not responsive** — no mobile hamburger menu
3. **No loading states** — pages jump when data loads
4. **Chat interface** needs streaming support (currently waits for full response)
5. **Task board** needs status-specific columns with proper DnD
6. **Agent detail page** needs logs/output viewer
7. **No toast/notification system** for action results
8. **Gateway status in sidebar** should be dynamic (poll /api health)

### 🟢 Nice to Have
1. **WebSocket for real-time updates** instead of polling every 5s
2. **Multi-model cost comparison** chart in analytics
3. **Agent conversation history** viewer
4. **Keyboard shortcuts** (Cmd+K for search, etc.)
5. **Export analytics** as CSV
6. **Agent templates** for quick creation

## Phase 1 — Ship Now
- README.md + docs
- Fix hardcoded sidebar gateway status
- Wire agent-bus into agent-actions
- API route authentication
- Responsive sidebar
- Loading states & skeleton screens
- Toast notifications

## Phase 2 — Next Sprint
- Dark mode
- Streaming chat
- Real-time WebSocket updates
- Paginated tasks
- Agent logs viewer
- Analytics improvements

## Phase 3 — Polish
- Keyboard shortcuts
- Agent templates
- Export functionality
- Performance optimization
