---
name: auto
description: Full autonomous build mode — spawns agent teams, skips permissions, builds out entire request end-to-end
user_invocable: true
---

# /auto — Autonomous Multi-Agent Build Mode

You are entering FULL AUTONOMOUS BUILD MODE. Execute the user's entire request without stopping for confirmations. Use parallel agent teams to maximize speed.

## Rules
1. **No stopping for permission** — you already have full permissions via dangerouslySkipPermissions
2. **Read handoff.md first** — `.claude/handoff.md` has current project state
3. **Use agent teams** — spawn parallel agents for independent tasks
4. **Fix as you go** — if something breaks, fix it immediately, don't ask
5. **Journal when done** — write a session entry to `memory/journal/`
6. **Update handoff.md** — update "Active Work" section when done

## Procedure

### Step 1: Understand the Request
Parse the user's full request. Break it into independent workstreams that can run in parallel.

### Step 2: Read Context
```
Read .claude/handoff.md
Read the relevant source files for the task
```

### Step 3: Plan & Assign Agent Teams
For each independent workstream, spawn an agent:
- Use `subagent_type: "general-purpose"` for implementation tasks
- Use `subagent_type: "Explore"` for research/discovery tasks
- Run independent agents in parallel (single message, multiple Agent tool calls)
- Give each agent a complete, self-contained prompt with all context needed

### Step 4: Build
Execute all changes. For each file:
- Read before editing
- Make the change
- Verify it compiles/builds

### Step 5: Verify
After all changes are applied:
- Run the build command for affected project(s)
- If Angular: `cd adjuster-portal-ui && npx ng build --configuration production 2>&1 | tail -20`
- If Claim Rush: `cd claim-rush && npm run build 2>&1`
- If Backend: `cd upa-portal/backend/app && poetry run python -c "from app.main import app; print('OK')"`
- Fix any errors immediately

### Step 6: Report
Give a concise summary:
- What was built
- Files changed
- Whether builds pass
- What to test manually

### Step 7: Journal & Handoff
- Write session entry to `memory/journal/YYYY-MM-DD_session.md`
- Update `.claude/handoff.md` with new state
