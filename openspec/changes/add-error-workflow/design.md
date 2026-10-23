# Design

## Context

n8n runs in Docker next to the shop app (`docker-compose.yml`, time zone `Europe/Madrid`). Flows are exported as JSON to `workflows/`. One Infomaniak mailbox both reads (IMAP) and sends (SMTP) mail (see `docs/decisions-clarify.md`). Motivation and scope: see proposal.md. Behaviour: see `specs/error-alerting/spec.md`.

The Error Trigger only fires for failures of automatic executions (webhook, schedule) of flows that name this flow as their *Error Workflow*; a manual run from the editor does not fire it.

## Goals / Non-Goals

**Goals:**
- A small, linear flow: Error Trigger → sanitise → send email.
- Sanitising logic that is testable with fixed inputs, independent of n8n.
- A repeatable way to trigger a real failure for tests and for the execution evidence.

**Non-Goals:**
- Retrying failed flows, backup channels, grouping or rate-limiting alerts (all decided out of scope).
- Alerting on anything other than failed executions (no success or health notices).

## Decisions

1. **Three nodes, in order: Error Trigger → Code (sanitise and format) → Send Email (SMTP).** A Code node is the right place for masking because regex rules are awkward to express in IF/Set nodes, and the same function can be unit-tested with the six inputs listed in the spec. *Alternative:* a Set node with expressions; rejected because chaining several regex replacements there is hard to read and review.

2. **Mask by pattern, not by known values only.** Rules: authorization/bearer/API-key headers; any `key=value` or `"key":"value"` whose key contains `key`, `token`, `secret`, `password` or `pass`; plus the literal value of `API_KEY` when readable. Then cut to 500 characters. *Alternative:* allow-listing safe text; rejected because error messages are free text and an allow-list would drop the useful part.

3. **Do not forward node input data or the request body.** The Code node reads only `workflow.name`, `execution.id/url`, `execution.lastNodeExecuted` and `execution.error.message`. Anything else from the trigger payload is ignored by construction, which is simpler to guarantee than filtering personal data out of a larger object.

4. **Fallbacks live in the Code node.** Missing message → `«error sin mensaje»`; missing step → `«desconocido (falló el disparador)»`. The Send Email node then never receives an empty field.

5. **Recipient comes from configuration, not the JSON.** The address is `TIENDA_EMAIL_AVISOS`. *Alternative:* hard-coding it; rejected (constitution: no real addresses or secrets in Git).

6. **A dedicated test flow `99-error-test`** (Webhook → Code that throws a message taken from the request) set to use this error workflow, active only while testing. This produces genuine failed executions, which is the only way to exercise the Error Trigger. *Alternative:* a manual execution; rejected because it does not fire the trigger.

7. **No special handling when the alert email fails.** The failure stays in n8n's execution history and the team checks it periodically (decided in `docs/decisions-clarify.md`).

## Risks / Trade-offs

- **[Configuration mechanism]** n8n *Variables* (`$vars`) need a paid plan, so they are not an option. The address is an environment variable passed from `.env` through `docker-compose.yml` and read as `$env.TIENDA_EMAIL_AVISOS`. Since n8n v2 that access is blocked by default, so `docker-compose.yml` sets `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`. → Task 1.1 verifies it returns a test value inside a node.
- **[Masking misses an unusual secret format]** → Test inputs cover bearer tokens, header values and JSON pairs; the exported JSON and a sample alert are reviewed in the PR. Alerts exclude input data, which limits exposure.
- **[SMTP credential expires and alerts stop silently]** → Accepted by decision; periodic check of the execution history, documented in the README.
- **[Alert flood from a repeatedly failing flow]** → Accepted by decision; revisit only if it occurs.
- **[Test flow left active in production]** → It is exported inactive and named `99-…`; the definition of done requires it to be inactive.
