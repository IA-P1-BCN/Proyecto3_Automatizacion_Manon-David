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
Each agent edits only its owner's spec and flow files, on the branch of the assigned issue (`feat/<issue#>-<short-description>`, from `dev`). Never touch the partner's files, `main`, `backend/` or `frontend/`. Issue ↔ flow mapping: `docs/decisions-clarify.md#branching-model-and-issues-per-flow`.

## Git
Conventional Commits, message in English: `feat: add apartado confirmation flow`. One issue = one branch (`feat/<issue#>-…`, `docs/<issue#>-…`, `fix/<issue#>-…`, from `dev`) = one PR **targeting `dev`** with the exported flow JSON and a `Closes #N` line. `dev` → `main` goes through a reviewed PR. Nobody pushes to `dev` or `main`. Don't commit unless asked. Commit and PR text in English.

## Issues and tasks
Every Kanban issue shows its detailed tasks: the checklist from `openspec/changes/<change>/tasks.md` is mirrored in the issue body under `## Implementation tasks`. When tasks change (ticked, added, removed), update the repo file and re-sync the issue: `python scripts/sync_issue_tasks.py <issue#>`. The repo file stays the source of truth.

## Specs (OpenSpec)
Specs are managed with OpenSpec (`openspec/`, schema `spec-driven`). Claude Code: `/opsx:propose`, `/opsx:apply`, `/opsx:archive`. OpenCode: `/opsx-propose`, `/opsx-apply`, `/opsx-archive`. Resolve every `[NEEDS CLARIFICATION]` with the team before implementing.

## Commands
- Start the app and n8n: `docker compose up -d` (app: http://localhost:8000, Swagger: `/docs`, n8n: http://localhost:5678). Stop: `docker compose down`. If port 8000 is busy, set `TIENDA_PORT=8001` in your own `.env`: only the browser URL changes (`http://localhost:8001`); inside n8n it stays `http://tienda:8000`.
- Inside n8n, call the app at `http://tienda:8000`, not `localhost`.
- Backend tests: `pytest` from `backend/`.
