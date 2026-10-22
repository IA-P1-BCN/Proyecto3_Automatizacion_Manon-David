# CLAUDE.md · Paso Firme n8n automations

Project context for coding agents. The teammates use different agents (Claude Code, OpenCode), so keep this file agent-neutral. `AGENTS.md` is owned by David; it can point here instead of duplicating.

## What this is
n8n automations for a shoe shop's layaway ("apartado") system. The FastAPI app in `backend/` + `frontend/` is **given**; we don't change it. We build n8n flows around it. Assignment: `README.md`. App behaviour, endpoints and webhook events: `docs/guia-de-la-app.md`.

## Read first
- `docs/constitution.md`: non-negotiable principles, conventions, definition of done.
- `specs/ontologia.md`: the shared vocabulary (use these names, invent none).
- `docs/decisions-clarify.md`: decisions already made. Don't re-ask them.
- `docs/future-implementation-ideas.md`: what was postponed on purpose.
- `openspec/`: where specs live (see Specs below).

## Rules that matter most
1. The app is the source of truth for amounts, states and deadlines. Flows and AI never recalculate them.
2. AI extracts, the flow decides. When a payment is unclear, register nothing and ask Marisa.
3. No secrets anywhere in Git (flow JSON, docs, `.env`). Credentials live only in n8n. Export flows without credentials.
4. Every flow has an error branch wired to the Error Workflow (flow 08) and is idempotent.
5. Never activate flows in production, and never write credentials.

## Language
Everything is **English**; **customer-facing messages** (emails to customers and Marisa) are **Spanish**. App field and event names stay as the app defines them (`apartado`, `abono`, `fecha_limite`, `apartado.creado`).

## Scope per agent
Each agent edits only its owner's spec and flow files, on the owner's `flow-<name>` branch. Never touch the partner's files, `main`, `backend/` or `frontend/`.

## Git
Conventional Commits, message in English: `feat: add apartado confirmation flow`. One Kanban task = one branch = one PR with the exported flow JSON. Nobody pushes to `main`. Don't commit unless asked.

## Specs (OpenSpec)
Specs are managed with OpenSpec (`openspec/`, schema `spec-driven`). Claude Code: `/opsx:propose`, `/opsx:apply`, `/opsx:archive`. OpenCode: `/opsx-propose`, `/opsx-apply`, `/opsx-archive`. Resolve every `[NEEDS CLARIFICATION]` with the team before implementing.

## Commands
- Start the app and n8n: `docker compose up -d` (app: http://localhost:8000, Swagger: `/docs`, n8n: http://localhost:5678). Stop: `docker compose down`.
- Inside n8n, call the app at `http://tienda:8000`, not `localhost`.
- Backend tests: `pytest` from `backend/`.
