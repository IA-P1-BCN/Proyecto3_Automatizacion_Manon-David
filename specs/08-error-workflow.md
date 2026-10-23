# Flow 08 · Error Workflow            Story: HU-05          Owner: Manon (@ManonChab)

> Draft predating OpenSpec; to be redone under OpenSpec ([decision](../docs/decisions-clarify.md#spec-tooling-openspec)).

## Why
Marisa must not find out weeks later that an automation stopped working (an unregistered payment, a close that never arrived). Any failure must alert the shop right away, saying which flow, at which step and what error, without leaking passwords or keys. This is the first flow to build: all the others connect to it.

## Trigger
**Error Trigger** node. It runs when any flow that has it set as its *Error Workflow* fails (flow settings → *Error Workflow*). It has no schedule.

> n8n only runs it for failures of **automatic** executions (webhook, scheduled). A manual run from the editor does not trigger it; test with a test flow that fails on purpose (see *Test data*).

## Inputs
Fields delivered by the Error Trigger (n8n's names, not the ontology's):

| Field | Use |
|---|---|
| `workflow.name`, `workflow.id` | Name of the flow that failed |
| `execution.id`, `execution.url` | Link to the failed execution |
| `execution.lastNodeExecuted` | **Step** where it failed |
| `execution.error.message` | Error (sanitised before sending) |
| `execution.mode` | `trigger` / `webhook` / `retry`… (informational) |

Configuration: `TIENDA_EMAIL_AVISOS` (Marisa's address), an environment variable read as `$env.TIENDA_EMAIL_AVISOS` (see *Credentials and variables*).

## Decisions
1. **Always alert.** Every failed execution produces an email alert to the shop ([decision: channel](../docs/decisions-clarify.md#notification-channel)).
2. **Sanitise before sending** (Code node): the error text has these removed or masked as `[oculto]`:
   - `Authorization`, `Bearer …`, `X-API-Key`/`x-api-key` headers and values;
   - the value of `API_KEY` and of any known variable;
   - any string of the form `key=value` / `"key":"value"` whose key contains `key`, `token`, `secret`, `password` or `pass`;
   - the message is cut to 500 characters.
3. **Not included:** the full request body, the node's input data, or customers' personal data (name, phone, email). The execution link is enough for the team to look inside n8n.
4. **The error workflow can't fail silently.** If sending the email fails, the error stays in n8n's execution history; it is not retried in a loop (see *Error cases*).
5. **It doesn't act on the app.** This flow only alerts: it doesn't retry, register or fix anything.

## Outputs
One email to `TIENDA_EMAIL_AVISOS`. It is addressed to Marisa, so the text is in Spanish:

```
Asunto: ⚠️ Falló la automatización «<workflow.name>»

Flujo:   <workflow.name>
Paso:    <execution.lastNodeExecuted>
Error:   <sanitised message, max 500 characters>
Cuándo:  <date and time, Europe/Madrid>
Ejecución: <execution.url>
```

The message is written for Marisa: no needless jargon, but with the link so the technical team can act.

## Error cases
| Situation | What happens | Who finds out |
|---|---|---|
| Any flow fails | The alert is sent | Marisa / shop |
| The error contains a key or token | It is masked before sending | Marisa (without the secret) |
| `execution.error.message` empty or missing | `«error sin mensaje»` is sent + step and link | Marisa / shop |
| `lastNodeExecuted` missing (the trigger failed) | Step = `«desconocido (falló el disparador)»` | Marisa / shop |
| The email send itself fails (expired credential, no network) | The error stays only in n8n's history | **Nobody automatically**; the team checks n8n's history periodically ([decision](../docs/decisions-clarify.md#alert-email-failure-and-repeated-alerts-flow-08)) |
| Several failures in a row from the same flow | One alert per failed execution | Marisa / shop (no limit, decided) |

## Acceptance criteria
Copied from HU-05 and extended:

- [ ] Any flow that fails sends an alert with the **flow name**, the **step** and the **error**.
- [ ] The alert **contains no passwords or keys** (checked with an error containing a test key; the alert shows it as `[oculto]`).
- [ ] All Essential flows (01, 02, 03, 05) have this flow as their *Error Workflow* in their settings.
- [ ] A failure with no message or no known step does not break this flow and produces a readable alert.
- [ ] The alert arrives within one minute of the failure.
- [ ] The exported JSON contains no credentials or Marisa's real address (it uses the variable).

## Test data
Helper flow `99-error-test` (for testing only, **inactive** in production): Webhook → Code node that throws an error.

| # | Input (simulated error) | Expected result |
|---|---|---|
| 1 | `Error: apartado 99 no encontrado` | Email with flow, step and that message |
| 2 | `Request failed: Authorization: Bearer abc123SECRET` | Email with `Authorization: [oculto]`; `abc123SECRET` does not appear |
| 3 | `{"api_key":"sk-test-123","detalle":"422"}` | `api_key` masked, `detalle` visible |
| 4 | 2000-character message | Cut to 500 |
| 5 | Error with no message | `«error sin mensaje»` |
| 6 | Invalid email credential | No email; error visible in n8n's history (document in the evidence) |

## Out of scope
Automatic retries of failed flows; grouping or summarising alerts; alerting through Telegram (Advanced level); incident dashboard.

## Credentials and variables
| Name | Type | Purpose |
|---|---|---|
| Email account (SMTP, the team's Infomaniak mailbox) | n8n credential | Send the alert |
| `TIENDA_EMAIL_FROM` | environment variable | Sender mailbox, same as the SMTP credential's account (no value in Git) |
| `TIENDA_EMAIL_AVISOS` | environment variable (`.env` → `docker-compose.yml` → n8n container) | Address that receives alerts (no value in Git). n8n *Variables* (`$vars`) need a paid plan, so they are not used; requires `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` |

## Decisions made
- Alert email failure: accepted and documented; no backup channel ([decision](../docs/decisions-clarify.md#alert-email-failure-and-repeated-alerts-flow-08)).
- Repeated alerts: one per failed execution, no limit.
- Time zone: `docker-compose.yml` already sets `GENERIC_TIMEZONE=Europe/Madrid`.

## [NEEDS CLARIFICATION]
None.