# Design

## Context

The router (`workflows/code/build-00-event-router.js`) is a Webhook node → Set (`evento`, `datos`) → migration-flag check (Data Table, fail open) → Switch → Execute Workflow nodes. The app's sender (`backend/services/n8n.py`) posts JSON to `N8N_WEBHOOK_URL` with only `Content-Type`; it is given and cannot be changed. Customer emails are sent by flows 01, 02 (via the router) and 06, 06b (scheduled, direct). Flows 05, 07, 04 and 08 write only to the shop. The only AI node is Groq in flow 03 (bank-notice emails to Marisa). Consent is today implied by giving an email ([decision](../../../docs/decisions-clarify.md#consent-to-receive-messages)); the register was postponed to this level ([future-implementation-ideas.md](../../../docs/future-implementation-ideas.md)). Flow 10 already uses an n8n Data Table, so that mechanism is proven here. See proposal.md and the three specs.

## Goals / Non-Goals

**Goals:** nothing runs on an unauthenticated request; nothing is written to a customer without a recorded, revocable consent; it is documented and tested what reaches an AI model; flows 01 and 02 stay untouched.

**Non-Goals:** explicit opt-in with confirm link; TLS and exposing n8n publicly (HU-16); authentication of Telegram users (HU-11/12); alert grouping.

## Decisions

1. **Shared secret in a query parameter or header, checked in a Code node, not the Webhook node's Header Auth.** The app cannot add headers, so a credential-based header check would reject the app itself. The app's URL (`N8N_WEBHOOK_URL`) can carry `?token=…`, and a Code node compares the token (header first, then query) with `$env.TIENDA_WEBHOOK_TOKEN` in constant time. *Alternatives:* header-only auth plus a reverse proxy that injects the header (extra service to run); a secret path (the path would sit in the exported JSON, a secret in Git). *Limit, stated honestly:* a token in a URL can show up in access logs, so inside the Docker network it is acceptable but over the internet (HU-16) it must be paired with HTTPS and rotated; the header remains available for callers that can send it.

2. **Respond `401` through a Respond to Webhook node.** The Webhook node switches to "Using Respond to Webhook" so rejected calls get a real status. The accepted path responds `200` immediately after the check, before the handlers run, so the app's 5-second timeout is never at risk. An empty `TIENDA_WEBHOOK_TOKEN` rejects everything (fail closed) and throws once to flow 08; a wrong token ends quietly to avoid alert floods.

3. **Validation as a pure, tested function** in `workflows/code/00-validate-event.js`, embedded by the generator like the migration flag: returns `{ ok, evento, datos }` or `{ ok: false, reason }`. The reason never includes payload values. Per-event required fields come from `docs/guia-de-la-app.md`. A failed validation throws so flow 08 alerts with the reason only.

4. **Consent register as a Data Table `consentimientos`**, created by hand once (like `migration_state`), email normalised as the key. *Alternatives:* Google Sheets (new credential and second system, previously rejected for Essential), a column in the app (not changeable). Marisa can edit or filter it in the n8n UI to withdraw consent. Stores only email, `estado`, `fecha`, `origen`: no name, phone or balance (data minimisation).

5. **Fail closed, unlike the migration flag.** The migration flag fails open because losing a real event is worse. For consent, sending to someone who did not agree is worse than a missed message, so an unreadable table, a missing row or an invalid email all block the send and the first also alerts.

6. **Gate at the router for flows 01 and 02, inside the flow for 06 and 06b.** `apartado.creado` records consent then calls flow 01; `abono.registrado` checks consent then calls flow 02. Flows 06 and 06b are triggered by a schedule, not the router, so each calls `09 Consent Check` as a sub-workflow before its send; those two edits are small and go to the PR for the other teammate's review. *Alternative:* editing 01 and 02 as well; rejected because the router already sees every event and it keeps the diffs small.

7. **`09 Consent Check` is a sub-workflow** (Execute Workflow Trigger with `email`; reads the table; returns `permitido`/`no_permitido` and a reason). The decision is a pure function (`workflows/code/09-consent.js`: normalise, validate, decide) with unit tests, so flows share one rule.

8. **Backfill is a separate manual flow (`09b`)** that reads `GET /api/apartados` with the shop Header Auth and upserts missing emails, so first deployment does not silently stop all existing customers' reminders. It sends nothing. *Assumption to confirm with Marisa:* customers who gave an email in the shop count as consenting, as the earlier decision stated; the `origen` field records that basis.

9. **AI inventory as a document plus a test.** `docs/ai-data-inventory.md` describes each AI node; `workflows/code/ai-inventory.test.js` loads every `workflows/*.json`, finds nodes whose type contains `langchain` or HTTP Request nodes whose URL points to a known AI API host (flow 03 calls Groq this way, there is no AI node type), and checks each is named in the inventory. This keeps the document from drifting from the flows. It does not evaluate what data flows into the node; that remains in the review checklist.

## Risks / Trade-offs

- **Breaking change:** every `.env` needs `N8N_WEBHOOK_URL` with the token and `TIENDA_WEBHOOK_TOKEN` set in n8n; until then the app's events get `401`. Mitigated by documenting both in the README and `.env.example`, and by testing the old URL explicitly.
- **Existing customers:** until the backfill runs, no reminder or receipt is sent. The task order puts the backfill before enabling the gate.
- **Query-string token** is weaker than a header; see decision 1.
- **Shared flows 06/06b** are owned by the other teammate; changes there need their review and may conflict with their open branches.
- **Consent basis** is still "gave an email in the shop"; real opt-in remains in `future-implementation-ideas.md`.
