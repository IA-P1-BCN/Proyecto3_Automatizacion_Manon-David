# Test cases · HU-14 Personal data (issue #14)

Covers the three specs of `add-personal-data-protection`: webhook authentication and validation (flow 00), the consent register and check (flows 09, 09b, 00, 06, 06b) and the AI data inventory.

The pure logic is covered by `node --test workflows/code/00-check-token.test.js workflows/code/00-validate-event.test.js workflows/code/09-consent.test.js workflows/code/09-consent-workflow.test.js workflows/code/00-router-workflow.test.js workflows/code/09-consent-in-reminders.test.js workflows/code/ai-inventory.test.js`. The workflow tests also run the Code nodes of the exported flows against fake inputs.

Run the cases below on a **clean copy of the app** (separate compose project, `SEED=0`), never on the team's data. All people and emails are invented (`example.com`).

## Webhook authentication and validation

Send each case as a `POST` with a JSON body, such as `{"evento":"venta.registrada","datos":{"id":1,"concepto":"x","importe":10,"forma_pago":"efectivo"}}`.

| # | Request | Expected | Spec scenario |
|---|---|---|---|
| A1 | no token (the old URL) | `401`, no handler, no alert | Missing or wrong token |
| A2 | `?token=` wrong, or empty | `401`, no handler, no alert | Missing or wrong token |
| A3 | `?token=<secret>` (how the app calls) | `200`, event routed | App call with the token in the URL |
| A4 | header `X-Webhook-Token: <secret>`, no query | `200`, event routed | Caller with the header |
| A5 | header `X-Webhook-Token` wrong | `401` | Missing or wrong token |
| A6 | `TIENDA_WEBHOOK_TOKEN` empty in n8n, any request | `401`, and one flow 08 alert per request: "TIENDA_WEBHOOK_TOKEN está vacío en n8n…", step `Raise Token Misconfiguration` | Token not configured |
| A7 | valid token, `abono.registrado` with `importe` as text | router fails at `Extract Event`; alert names the flow, the step and "datos.importe debe ser un número", **no name, email or value** | Missing or wrong-typed field |
| A8 | valid token, `{"datos": {}}` or a body that is not JSON | router fails at `Extract Event` ("falta evento…", "no es un objeto JSON"); alert | Missing or wrong-typed field |
| A9 | valid token, `apartado.vencido` or `cosa.rara` | `200`, ends silently | Unknown event still ignored |
| A10 | valid token, `venta.registrada` of 10 € (threshold 150) | `200`, flow 04 runs, no email | Valid event |

## Consent

| # | Situation | Expected | Spec scenario |
|---|---|---|---|
| C1 | New reservation with `Carmen@Example.com` and no row | row `carmen@example.com`, `activo`, today, origin `tienda`; confirmation mail sent | New customer with email |
| C2 | Deposit of that customer | receipt mail sent | Customer with active consent |
| C3 | Marisa sets `estado` to `retirado`; deposit | no mail; router and flow 09 succeed | Withdrawn between two sends |
| C4 | Same customer reserves again | no confirmation; row still `retirado`, no second row | Customer who withdrew |
| C5 | Customer whose row was deleted pays a deposit | no mail, nothing recorded | Customer without a row |
| C6 | Reservation without email | no row; flow 01 sends only its warning to the shop | No email |
| C7 | Flow 09 reading a table that does not exist | no customer mail; flow 09 and the router fail; flow 08 alerts (2 alerts per event) | Register unreadable |
| C8 | `09b` with 3 customers in the app (2 without a row, 1 withdrawn) | 2 rows added with origin `tienda (migración)`; the withdrawn row unchanged; no mail | Backfill, first run |
| C9 | `09b` again | nothing added or changed | Backfill, second run |
| C10 | `06b` with three expired reservations: active consent, withdrawn consent, no email | customer mail only to the first; shop summary lists all three vouchers and says "sin consentimiento para recibir mensajes automáticos" for the second and "sin email válido" for the third | Withdrawn consent (06b) |
| C11 | `06`: reminder for a customer without consent | no reminder, not written to `avisos.csv`; the others unchanged | Withdrawn consent on a reminder |
| C12 | Migration flag on while a reservation is created | no mail, no row recorded; after the flag is off, the next event works | (unchanged from HU-10) |
| C13 | Alert, daily close or report to `TIENDA_EMAIL_AVISOS` | not gated by flow 09 | Messages to the shop are not gated |

## AI data inventory

| # | Check | Expected |
|---|---|---|
| I1 | `ai-inventory.test.js` on the current flows | passes; the only AI node is the Groq call of flow 03 |
| I2 | A copy of a flow with an unlisted AI node | the test names the flow and the node |

## Results

Run on 2026-10-28 in a throwaway stack (n8n 2.44.5, the repo's app image with `SEED=0`, Mailpit as mailbox; the real flows 00, 01, 02, 04, 06b, 08, 09 and 09b with the router linked to them, flow 08 published as Error Workflow). It is not the team's instance.

| Case | Result |
|---|---|
| A1–A5 | as expected (`401`, `401`, `200`, `200`, `401`); the four `401` router runs ended with status success and sent no alert |
| A6 | restarted n8n with an empty token: three requests (no token, any token, empty token) gave `401` and three alerts with the expected text |
| A7 | alert received: flow `00 Event Router`, step `Extract Event`, error "Aviso de la tienda rechazado: datos.importe debe ser un número"; no customer data in the mail |
| A8 | covered by unit and graph tests; not sent to the stack |
| A9, A10 | `200`; no handler ran for the unknown events; flow 04 ran for the 10 € sale and sent nothing |
| C1–C6 | as expected, including `Carmen@Example.com` stored as `carmen@example.com` |
| C7 | no customer mail; two alerts per event (flow 09 and the router) |
| C8, C9 | 2 rows added, the `retirado` row untouched; the second run added nothing; no mail. Run through a temporary webhook attached to a **test copy** of 09b, because a manual trigger cannot be started from the API |
| C10 | as expected; one customer mail to the active customer, one summary to the shop with both reasons |
| C11 | run by Manon on the team's n8n on 2026-10-28 (not in the throwaway stack: flow 06 needs the kDrive credential). Two test reservations due in 7 days, one with consent (A) and one withdrawn (B). First run: *Keep Consented* kept 1 item, only A received the reminder, `avisos.csv` got one row for A and none for B. Second run: nothing sent, file unchanged. B set back to `activo` and a third run: B received the reminder and got a row, so the earlier skip had not been recorded as notified |
| C12 | no mail while the flag was on; the next event after switching it off sent the confirmation |
| C13 | the flow 08 alerts, the flow 06b summary and the "sin confirmación" warning of flow 01 reached the shop without any consent call (the daily close and the reports were not run) |
| I1, I2 | pass (unit test) |

Observed while testing:

- n8n 2.44.5 **refuses to publish a workflow whose sub-workflows are not published**. Publish flows 09, 01, 02 and 04 before the router.
- The Data Table node resolves a table **by name once and then keeps its id**: renaming the table in the editor did not break the flow, while deleting and re-creating it would. After re-creating `consentimientos`, open the *Read Consent Register*, *Record Consent* nodes of flow 09 and *Read Consent Register*, *Record Consents* of 09b and choose the table again.
- An unreadable register produces two alerts per event (flow 09 and the router). Grouping alerts is still postponed ([future ideas](../../docs/future-implementation-ideas.md)).

## PowerShell commands

Set the two variables once. `$token` is the value of `TIENDA_WEBHOOK_TOKEN` in your `.env` (never paste it into Git or the chat).

```powershell
$token = Read-Host 'TIENDA_WEBHOOK_TOKEN'
$url = 'http://localhost:5678/webhook/tienda'
$body = '{"evento":"venta.registrada","datos":{"id":1,"concepto":"x","importe":10,"forma_pago":"efectivo"}}'

# A1 · no token (must be 401)
try { Invoke-RestMethod -Method Post -Uri $url -ContentType 'application/json' -Body $body } catch { $_.Exception.Response.StatusCode.value__ }

# A2 · wrong token (must be 401)
try { Invoke-RestMethod -Method Post -Uri "$url?token=nope" -ContentType 'application/json' -Body $body } catch { $_.Exception.Response.StatusCode.value__ }

# A3 · token in the URL, as the app sends it (must be 200)
Invoke-WebRequest -Method Post -Uri "$url?token=$token" -ContentType 'application/json' -Body $body | Select-Object -ExpandProperty StatusCode

# A4 · token in the header (must be 200)
Invoke-WebRequest -Method Post -Uri $url -Headers @{ 'X-Webhook-Token' = $token } -ContentType 'application/json' -Body $body | Select-Object -ExpandProperty StatusCode

# A7 · invalid amount (200, then a flow 08 alert)
Invoke-WebRequest -Method Post -Uri "$url?token=$token" -ContentType 'application/json' -Body '{"evento":"abono.registrado","datos":{"id":3,"importe":"veinte","email":"ana@example.com"}}' | Select-Object -ExpandProperty StatusCode
```

Withdraw a customer's consent from the n8n editor: **Data tables → consentimientos**, change `estado` to `retirado`. Set it back to `activo` to resume.

## Setup after importing

1. Create the Data Table `consentimientos` with four text columns: `email`, `estado`, `fecha`, `origen`.
2. Import `workflows/09-consent-check.json` and `workflows/09b-consent-backfill.json`; in 09 choose the table in *Read Consent Register* and *Record Consent*, in 09b the shop Header Auth credential on *Fetch Reservations* and the table in the two table nodes. Set *Settings → Error Workflow* to `08 Error Workflow` on 09.
3. Publish 09. Run 09b once by hand (**Execute workflow**); it only adds missing customers.
4. Import the new `00-event-router.json`, `06-due-reminders.json` and `06b-expired-reservations.json` over the old ones (the script `scripts/import_new_workflows.py` never replaces an existing flow), choose flow 09 in each *Check Consent* node and the other sub-workflows in the router's *Call …* nodes, and publish the router.
5. In `.env` set `TIENDA_WEBHOOK_TOKEN` and `N8N_WEBHOOK_URL=http://n8n:5678/webhook/tienda?token=<the same value>`, then `docker compose -p paso-firme up -d`. Until both are set, every event from the app is rejected.
