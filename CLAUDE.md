# UPA / ACI / RIN Platform — Claude Code Configuration

## First Things First
1. **Read `.claude/handoff.md`** — current project state, what's running, recent changes
2. **Check `memory/journal/`** — session history for context when memory is stale or context was compressed
3. **Never ask for permission** — `dangerouslySkipPermissions` is enabled globally

## Project Layout
```
adjuster-portal-ui/   → Angular 19 RIN Portal frontend (port 4200)
upa-portal/            → FastAPI backend (port 8888) + Docker + Terraform
claim-rush/            → Vite React Claim Rush landing pages (Vercel → aciunited.com)
next-app/              → Next.js dashboard app
.claude/               → Skills, handoff, settings
```

## Skills (slash commands)
- `/auto` — Full autonomous build mode with agent teams. Builds entire request end-to-end.
- `/verify` — Recursive browser verification loop. Screenshots, console logs, fix, repeat.
- `/deploy` — Build and deploy Claim Rush to Vercel, verify aciunited.com.
- `/strategist` — Talk to your product strategist (roadmap, pricing, go-to-market).
- `/engineer` — Talk to your senior engineer (architecture, implementation, debugging).
- `/designer` — Talk to your UI/UX designer (layout, conversion, visual design).

## Agent Teams
When spawning agents for parallel work, follow these patterns:
- **Research phase**: Use `subagent_type: "Explore"` for codebase discovery
- **Build phase**: Use `subagent_type: "general-purpose"` for implementation
- **Always** include handoff context in the agent prompt so it knows the project state
- **Always** run independent agents in parallel (single message, multiple Agent calls)

## Journal System
- Location: `memory/journal/YYYY-MM-DD_session.md`
- Write a journal entry at the end of significant sessions
- When context gets compressed or a new conversation starts, read journal entries first
- Journal captures what was done, what files changed, and what state things are in

## Handoff Protocol
- `.claude/handoff.md` is the handoff file for all agents
- Update it when finishing significant work
- Every spawned agent should read it before starting

## Build Commands
```bash
# Portal frontend
cd adjuster-portal-ui && npx ng serve --proxy-config proxy.conf.json

# Portal backend
cd upa-portal/backend/app && poetry run uvicorn app.main:app --host 0.0.0.0 --port 8888 --reload

# Claim Rush dev
cd claim-rush && npx vite

# Claim Rush build
cd claim-rush && npm run build

# Deploy Claim Rush
cd claim-rush && npx vercel --prod --yes
```

## Rules
- Use `--legacy-peer-deps` for npm install in adjuster-portal-ui
- Do NOT modify ticker speed (set to 280s, confirmed correct)
- Do NOT commit .env files or API keys
- OpenAI keys in environment files are PLACEHOLDER — real keys stay local
- Backend needs pyenv 3.11.14 + Poetry
- Database runs in Docker container `upa-db`

<!-- VERCEL BEST PRACTICES START -->
## Vercel Best Practices
- Treat Vercel Functions as stateless + ephemeral
- Edge Functions (standalone) are deprecated; prefer Vercel Functions
- Store secrets in Vercel Env Variables; not in git
- Use Cron Jobs for schedules; cron runs in UTC
- Use Vercel Blob for uploads/media; Use Edge Config for small config
<!-- VERCEL BEST PRACTICES END -->
