# Agent Handoff — Current State

> This file is the single source of truth for any Claude Code agent spawned in this project.
> Read this FIRST before doing anything. Update it when you complete significant work.

## Last Updated: 2026-03-27

## Project Structure
```
/Users/peterguzzi/Desktop/UPA_PORTAL_FULL_FRONTEND_BACKEND/
├── adjuster-portal-ui/   → Angular 19 RIN Portal frontend (port 4200)
├── upa-portal/            → FastAPI backend (port 8888) + Docker + Terraform
├── claim-rush/            → Vite React Claim Rush landing pages (Vercel)
├── next-app/              → Next.js dashboard app
└── .claude/               → Claude Code config, skills, handoff
```

## What's Running
- **Database**: Docker container `upa-db` on port 5432
- **Backend**: FastAPI on `localhost:8888`
- **Frontend**: Angular on `localhost:4200`
- **Claim Rush**: Vite dev on `localhost:5173`, production on `aciunited.com`

## Production URLs
- **aciunited.com** / **www.aciunited.com** → Claim Rush (Vercel)
- **claim-rush.vercel.app** → Claim Rush (Vercel alias)
- Portal not yet in production

## Git
- **Repo**: github.com/prguzzi-cmyk/claim-rush
- **Branch**: main
- All projects in one monorepo

## Active Work / Recent Changes
- Claim Rush EN/ES landing pages with investment qualification, auto lang detect
- Portal ticker slowed (280s), command bar always visible
- Domain aciunited.com connected and live

## Key Credentials
- See memory/credentials.md for login details
- OpenAI keys replaced with PLACEHOLDER in committed code
- Real keys are in local environment files (gitignored)

## Tech Stack
- **Frontend**: Angular 19 + Material, hash routing, proxy to :8888
- **Backend**: FastAPI + Python 3.11 (Poetry), PostgreSQL, Celery + Redis
- **Landing**: Vite + React 19, deployed to Vercel
- **Infra**: Docker Compose local, Terraform for AWS

## Rules for Agents
1. Read this file before starting work
2. Update "Active Work" section when you finish
3. Do NOT modify ticker speed (already set correctly)
4. Do NOT commit .env files or API keys
5. Use `--legacy-peer-deps` for npm install in adjuster-portal-ui
6. Backend needs pyenv 3.11.14 + Poetry
7. Check journal/ in memory for session history if context is unclear
