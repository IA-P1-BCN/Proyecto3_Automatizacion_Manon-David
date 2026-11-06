# Peer-audit presentation: prep sheet

Format: 12 minutes (5 demo, 5 questions, 2 feedback). Either of us must be able to run it alone. Last audited: 2026-10-29.

## 1. Before Friday (pre-flight)

| Check | How | Status |
|---|---|---|
| Stack up | `docker compose -p paso-firme up -d` (never wipe volumes). App: http://localhost:8001 (port 8000 is used by another project), n8n: http://localhost:5678 | ok on 2026-10-29 |
| Workflows imported and equal to the repo | Compared node by node on 2026-10-29: 15/15 identical | ok |
| Credentials | SMTP, `X-API-Key` (shop), `Authorization` (kDrive), IMAP chosen on every node | ok |
| Error Workflow connected | *Settings → Error Workflow → 08* on every flow except 08 itself | ok in n8n |
| Active flows for the demo | 00, 01, 02, 04, 06, 06b, 08, 09 | ok |
| No secrets in Git | `.env` is in `.gitignore` and not tracked; no key/token values in `workflows/*.json` (the "key"/"token" hits are variable names such as `idempotency-key`) | ok |
| Specs, AGENTS.md, AI log to hand | `specs/`, `openspec/`, `AGENTS.md`, `docs/ai-log.md`, `docs/decisions-clarify.md` | ok |
| Demo mailbox | Customer email = `TIENDA_EMAIL_AVISOS` (team inbox), open it on screen before starting | do on the day |
| Dry run, twice | Follow section 2 once each, timed | do on the day |

Known soft spots to fix or admit: flow 03 has 14 node names over 60 characters (hard to read on the canvas); the exported JSON in the repo has no *Error Workflow* setting because that ID belongs to each n8n instance, so show it live in n8n.

### Publish order (only if a flow has to be republished)

Do not unpublish and republish everything. n8n refuses to publish a workflow whose sub-workflows are unpublished, and a caller runs the *published* version of its sub-workflow, not the draft. So check each flow for "unpublished changes" and republish in place, callees first:

| Step | Publish | Why this position |
|---|---|---|
| 1 | 08 Error Workflow | target of the *Error Workflow* setting on every other flow |
| 2 | 09 Consent Check | called by 00, 06, 06b (and 11) |
| 3 | 01, 02, 04 | called by 00 |
| 4 | 00, 06, 06b | callers; publish last |

Flows 03, 11 and 11b are not part of the demo; if used, publish 11b before 03 (03 calls it) and 09 before 11. After republishing, run one reservation from the demo script as a smoke test.

## 2. Five-minute demo script

1. **Setup (20 s).** Show `docker compose ps`, the app, and n8n with flows 00, 01, 02 active.
2. **Create a reservation (60 s).** In the app create an apartado with the shop's inbox as customer email and an initial deposit. Say: the app sends `apartado.creado` to the router.
3. **Show the email (40 s).** Flow 01 sends the confirmation; amounts and deadline come from the app, never recalculated by n8n. Open the execution of 00 → 01 and follow the data left to right.
4. **Register a deposit (60 s).** Flow 02 sends the receipt; pay the rest to show the "collect your shoes" variant (status `liquidado`).
5. **Large sale (30 s).** A direct sale above `TIENDA_UMBRAL_VENTA_GRANDE` (150 €) alerts Marisa (flow 04); one at exactly 150 € does not.
6. **Failure path (60 s).** Run `99 Error Test`: flow 08 emails the alert. Add the case "customer without a valid email": the shop gets a notice instead.
7. **Scheduled flows (30 s, show only).** 06 (7 and 1 day reminders, logged in `avisos.csv`), 06b (expires late reservations, voucher), both run daily; run them manually with the `fecha` field.

Backups if something is slow: flow 90 (`Demo Data`) creates five demo reservations in one run, and `workflows/tests/*.md` plus `docs/evidence/` hold screenshots and results.

## 3. Flow map (what each one is for)

| Flow | Trigger | One-line purpose |
|---|---|---|
| 00 Event Router | webhook from the app (token) | Validates, checks consent, routes by `evento` |
| 01 Reservation Confirmation | called by 00 | Confirmation email to the customer |
| 02 Deposit Receipt | called by 00 | Receipt per deposit, pickup message when settled |
| 03 Remote Deposits | IMAP | Bank notice → AI extracts → flow decides; unclear means ask Marisa |
| 04 Large Sale Alert | called by 00 | Alert above the threshold |
| 05 Daily Close | schedule | Daily totals, history row in `basedatos.csv` on kDrive |
| 06 Due Reminders | schedule 09:00 | 7- and 1-day reminders, once each |
| 06b Expired Reservations | schedule 09:05 | Expire, voucher, one summary to Marisa |
| 07 Monthly Report | schedule / manual | Previous-month report, optional PDF |
| 08 Error Workflow | error trigger | Alert email to Marisa |
| 09 / 09b Consent | called / manual | Who may be messaged |
| 10 Excel Migration | form, manual | Clean and load the old Excel, report |
| 90 Demo Data | manual | Five demo reservations |

## 4. The four review blocks: what they will see

1. **Names and order.** No generic names (checked: none). Flows read left to right. Weak spot: flow 03 names are long.
2. **Security.** Keys only in n8n credentials; `.env` ignored; the router rejects events without `TIENDA_WEBHOOK_TOKEN` (401); only subject and body go to Groq, behind `allow_external_ai` (default false); consent table before any message (`docs/ai-data-inventory.md`).
3. **Errors and edge cases.** Every flow has an error branch to 08; no email, invalid email, missing threshold, app down, duplicate runs (idempotent: `avisos.csv`, payment idempotency key), unclear payment (nothing registered). Tests: `workflows/tests/`.
4. **Efficiency.** Logic sits in few Code nodes with named steps; no leftover nodes (stub flows are archived).

Also: how we used the AI agent. Be ready to show `AGENTS.md`, `docs/ai-log.md` (accepted and rejected suggestions, agent mistakes and fixes), the OpenSpec changes, and the constitution.

## 5. Likely questions and honest answers

- *Why does the app, not n8n, calculate amounts?* One source of truth; flows only present them.
- *What if n8n is down when an event happens?* The event is lost: the app sends once, no retries. Mitigation: daily flows read the API directly. See improvement below.
- *What if the AI is wrong?* It only extracts; the flow checks payer, amount and reservation, and registers nothing when unsure.
- *How do you avoid double sends?* 06 logs each reminder; deposits carry an idempotency key.
- *What did the agent get wrong?* Answer from `docs/ai-log.md` (read two entries beforehand).
- If you don't know something about your own flow, say so.

## 6. Improvement we would make for Marisa's shop

Make events reliable: the app outbox plus retries, or have the router poll the API for missed events, so a restart of n8n never loses a confirmation. Second: move from the shared SMTP mailbox test setup to the shop's real sender domain with SPF/DKIM, and a runbook for credential expiry (today a failed alert email is only visible in the executions list).

## 7. Feedback we will give the other pair

Prepare one real strength and one concrete production improvement from their checklist (names, secrets, errors, efficiency).

## 8. The peer audit sheet (Google Doc) mapped to our project

| Sheet item | Our evidence | Gap |
|---|---|---|
| Emails on new items and status changes; amounts from the app | Flows 01, 02 (creation, deposit, settled), 06b (expiry); amounts never recalculated | none |
| Clear names, left-to-right | No generic names | Flow 03 names are long |
| Keys in credentials, `.env` not on GitHub | Checked 2026-10-29 | none |
| Error flow connected | 08 on every flow (live n8n) | repo JSON does not carry the setting |
| Daily close with zero sales and payments | Closing date 2026-10-29: API lists empty; David confirmed the zero/no-movements email and correct kDrive history save on 2026-10-30. See `docs/evidence/05-daily-close/README.md` | Empty-day manual case demonstrated; no screenshot supplied. The broader three-date integration checklist remains open; no scheduled-run claim |
| Doubtful emails handled safely | Flow 03: nothing registered, Marisa asked | none |
| Optional webhook check | `TIENDA_WEBHOOK_TOKEN`, 401 without it | none |
| AI only for extraction | Only flow 03, only subject and body | none |
| AGENTS.md, specs, AI log; one agent error and its fix | All present; example in `docs/ai-log.md` (agent assumed autonomy meant commit/push/PR; boundary written into `AGENTS.md`) | pick the example you will tell |

After the audit each team writes a **half-page report** on what it saw and learned from the other project.
