# Test payloads · 00 Event Router (issue #32)

Send each payload as a `POST` to the router's webhook (`/webhook-test/tienda` while listening in the editor, `/webhook/tienda` once published). Payloads come from `docs/guia-de-la-app.md`. All data is the app's seeded sample data, no real customers.

| # | Payload | Expected route | Router execution |
|---|---|---|---|
| 1 | `{"evento": "apartado.creado", "datos": {"id": 25, "fecha": "2026-10-20", "cliente": "Carmen Ruiz", "telefono": "612 345 001", "email": "carmen@example.com", "producto": "Botín piel marrón", "talla": "38", "precio": 89.9, "fecha_limite": "2027-01-18", "estado": "activo", "abonado": 10.0, "pendiente": 79.9}}` | Flow 01 only, receives `evento` and `datos` unchanged | success |
| 2 | `{"evento": "abono.registrado", "datos": {"id": 25, "fecha": "2026-10-20", "cliente": "Carmen Ruiz", "telefono": "612 345 001", "email": "carmen@example.com", "producto": "Botín piel marrón", "talla": "38", "precio": 89.9, "fecha_limite": "2027-01-18", "estado": "activo", "abonado": 30.0, "pendiente": 59.9, "importe": 20.0}}` | Flow 02 only, receives `evento` and `datos` unchanged (including `importe`) | success |
| 3 | `{"evento": "venta.registrada", "datos": {"id": 257, "fecha": "2026-10-20", "concepto": "Crema calzado", "importe": 4.5, "forma_pago": "efectivo"}}` | Flow 04 only, receives `evento` and `datos` unchanged | success |
| 4 | `{"evento": "apartado.vencido", "datos": {"apartado": {"id": 16, "cliente": "Paula Ramos", "estado": "vencido"}, "vale": {"id": 2, "codigo": "VALE-00016", "importe": 5.0}}}` | No handler yet: "unhandled event" output | success, no alert |
| 5 | `{"evento": "cosa.rara", "datos": {}}` | "unhandled event" output | success, no alert |
| 6 | `{"datos": {"id": 1}}` (no `evento`) | "missing event name" output, throws | error, flow 08 alert |
| 7 | body `esto no es json`, `Content-Type: text/plain` | "missing event name" output, throws | error, flow 08 alert |

The webhook answers immediately (`{"message": "Workflow was started"}`), so the app never waits for a handler.

## Results

Run on 2026-10-23 in a clean throwaway n8n 2.44.5 container (not the team's instance): router and the two stub handlers imported and published through the CLI, payloads posted to `/webhook/tienda`, executions read from the database.

| # | Result |
|---|---|
| 1 | router success; stub for flow 01 ran once and held the payload |
| 2 | router success; stub for flow 02 ran once and held the payload |
| 3 | at that time `venta.registrada` was still ignored, so no stub ran; since flow 04 it is routed to flow 04 (re-test pending, see below) |
| 4, 5 | router success; no stub ran |
| 6, 7 | router error; no stub ran |

### Run on the team's n8n (reported by Manon, 2026-10-23)

With the stubs linked and everything published, the seven payloads and the real app's reservation and deposit events behaved as expected. Payloads 6 and 7 each failed the router and produced a flow 08 alert email (task 2.3 done, 2026-10-23). Still pending: the failing-handler tests.

### Re-test after adding flow 04 (task 3.1 of `add-large-sale-alert`)

`venta.registrada` now has its own output that calls flow 04. Pending on the team's n8n: after choosing flow 04 in **Call Large Sale Alert (flow 04)**, payload 3 must run flow 04 once with `evento` and `datos` unchanged (the sale of 4.5 € gives no email), payloads 1, 2 and 4 to 7 must behave as in the table above, and `cosa.rara` / `apartado.vencido` must still end silently.

Not covered by the throwaway run: flow 08 attached to the router, a failing handler followed by another event (tasks 3.1 and 3.2), and the real app's events (covered by the team's run).

## PowerShell commands

Run from any PowerShell window while the router is published. The `$url` line is shared by all commands. Payloads 1 and 2 contain accents, so they are sent as UTF-8 bytes.

```powershell
$url = 'http://localhost:5678/webhook/tienda'

# 1 · apartado.creado
$body = '{"evento": "apartado.creado", "datos": {"id": 25, "fecha": "2026-10-20", "cliente": "Carmen Ruiz", "telefono": "612 345 001", "email": "carmen@example.com", "producto": "Botín piel marrón", "talla": "38", "precio": 89.9, "fecha_limite": "2027-01-18", "estado": "activo", "abonado": 10.0, "pendiente": 79.9}}'
Invoke-RestMethod -Method Post -Uri $url -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body))

# 2 · abono.registrado
$body = '{"evento": "abono.registrado", "datos": {"id": 25, "fecha": "2026-10-20", "cliente": "Carmen Ruiz", "telefono": "612 345 001", "email": "carmen@example.com", "producto": "Botín piel marrón", "talla": "38", "precio": 89.9, "fecha_limite": "2027-01-18", "estado": "activo", "abonado": 30.0, "pendiente": 59.9, "importe": 20.0}}'
Invoke-RestMethod -Method Post -Uri $url -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body))

# 3 · venta.registrada (reaches flow 04)
Invoke-RestMethod -Method Post -Uri $url -ContentType 'application/json' -Body '{"evento": "venta.registrada", "datos": {"id": 257, "fecha": "2026-10-20", "concepto": "Crema calzado", "importe": 4.5, "forma_pago": "efectivo"}}'

# 4 · apartado.vencido
Invoke-RestMethod -Method Post -Uri $url -ContentType 'application/json' -Body '{"evento": "apartado.vencido", "datos": {"apartado": {"id": 16, "cliente": "Paula Ramos", "estado": "vencido"}, "vale": {"id": 2, "codigo": "VALE-00016", "importe": 5.0}}}'

# 5 · unknown event
Invoke-RestMethod -Method Post -Uri $url -ContentType 'application/json' -Body '{"evento": "cosa.rara", "datos": {}}'

# 6 · no evento (must fail and alert)
Invoke-RestMethod -Method Post -Uri $url -ContentType 'application/json' -Body '{"datos": {"id": 1}}'

# 7 · not JSON (must fail and alert)
Invoke-RestMethod -Method Post -Uri $url -ContentType 'text/plain' -Body 'esto no es json'
```

Every command prints `message: Workflow was started`, even for 6 and 7: the router answers first and fails afterwards. Check the outcome in n8n's Executions list.

## Failing handler (tasks 3.1 and 3.2)

`workflows/tests/00-stub-failing.json` is a test-only handler that always throws. Import it and publish it, then in the router point **Call Deposit Receipt (flow 02)** to it (put the normal stub back afterwards).

```powershell
$url = 'http://localhost:5678/webhook/tienda'

# A · deposit event: the handler fails
Invoke-RestMethod -Method Post -Uri $url -ContentType 'application/json' -Body '{"evento": "abono.registrado", "datos": {"cliente": "PRUEBA-ABONO"}}'

# B · right after, a reservation event: must still be routed to the flow 01 stub
Invoke-RestMethod -Method Post -Uri $url -ContentType 'application/json' -Body '{"evento": "apartado.creado", "datos": {"cliente": "PRUEBA-CREADO"}}'
```

Expected (3.1): the router run for A is **success** (it does not wait for the handler), the failing handler's own run is **error**, and B ends with the flow 01 stub run **success**.

For 3.2, repeat A in two settings and note whether an alert email arrives:

| Step | Error Workflow set on | Alert for the failing handler? |
|---|---|---|
| 1 | router only | **No**: no email arrived |
| 2 | router and the failing handler | **Yes**: an alert arrived |

**Finding (3.2, reported by Manon, 2026-10-23):** the handler's run is a separate execution, so only the handler's own Error Workflow setting fires; the router's setting does not cover it, because the router run itself ends successfully. Every handler (flows 01, 02 and any later sub-workflow) must have flow 08 set in its own settings, besides the router.

Result of 3.1 in the throwaway container (2026-10-23): A gave router success and handler error; B reached the flow 01 stub with success.

Result of 3.1 on the team's n8n (reported by Manon, 2026-10-23): same behaviour, router success, failing handler error, and the next event still routed. Task 3.2 is answered by the table above.

## Migration flag (task 3.2 of `add-excel-migration`, HU-10)

The router now reads the Data Table `migration_state` (row `clave = migracion`) before **Route by Event**. While `activa` is true and `desde` is less than 30 minutes old, the event is ignored: no handler runs and the execution succeeds. The check itself is unit-tested: `node --test workflows/code/00-migration-flag.test.js` (5 tests).

Set the row by hand (or let flow 10 do it), send payload 2 of the table above to `/webhook/tienda`, and check whether the flow 02 handler runs:

| # | Flag row | Expected |
|---|---|---|
| F1 | `activa` false | routed to flow 02 as before |
| F2 | `activa` true, `desde` 1 minute ago | ignored: router success, no handler run |
| F3 | `activa` true, `desde` 29 minutes ago | ignored |
| F4 | `activa` true, `desde` 31 minutes ago (left on by a crash) | routed |
| F5 | table or row missing, or the read fails | routed (the failure shows on **Read Migration Flag**) |
| F6 | `activa` false again | routed |

Result on 2026-10-27 in a throwaway n8n 2.44.5 (router linked to the stub handlers, not the real flows): F1 to F4 and F6 as expected, in that order, by sending the event with each flag state and counting handler runs. F5 was covered by the unit test only. The seven payloads of the main table were not repeated after this change; they pass through **Check Migration Flag** unchanged (it forwards only `evento` and `datos`). Pending on the team's n8n: repeat the seven payloads and F1 to F4 with the real flows.

## Export check (task 4.1)

On 2026-10-23 the router was exported from the team's n8n with `n8n export:workflow` (read-only) and compared with `workflows/00-event-router.json`. Same 7 nodes, same connections and same parameters; the editor only changed node positions and added its own defaults (for example `workflowInputs` on the Execute Workflow nodes). The raw editor export is not committed because it carries instance-specific data: workflow and sub-workflow IDs, the `errorWorkflow` ID, version IDs and the owner's project name. No credentials appear in either file. The generated file stays the portable version.

## Setup after importing

1. Import `workflows/tests/00-stub-reservation-confirmation.json` and `workflows/tests/00-stub-deposit-receipt.json` (placeholders until flows 01 and 02 exist; flow 04 is imported from `workflows/04-large-sale-alert.json`), then `workflows/00-event-router.json`.
2. In the router, open the three *Call …* nodes (flows 01, 02 and 04) and choose the sub-workflow in the **Workflow** field. IDs differ on every n8n instance, so the JSON leaves them empty.
3. Set *Settings → Error Workflow* of the router (and later of each handler) to `08 Error Workflow`.
4. Publish the stubs, then the router. `N8N_WEBHOOK_URL` in `.env` must be `http://n8n:5678/webhook/tienda` for the real app.
