# Test payloads · 00 Event Router (issue #32)

Send each payload as a `POST` to the router's webhook (`/webhook-test/tienda` while listening in the editor, `/webhook/tienda` once published). Payloads come from `docs/guia-de-la-app.md`. All data is the app's seeded sample data, no real customers.

| # | Payload | Expected route | Router execution |
|---|---|---|---|
| 1 | `{"evento": "apartado.creado", "datos": {"id": 25, "fecha": "2026-10-20", "cliente": "Carmen Ruiz", "telefono": "612 345 001", "email": "carmen@example.com", "producto": "Botín piel marrón", "talla": "38", "precio": 89.9, "fecha_limite": "2027-01-18", "estado": "activo", "abonado": 10.0, "pendiente": 79.9}}` | Flow 01 only, receives `evento` and `datos` unchanged | success |
| 2 | `{"evento": "abono.registrado", "datos": {"id": 25, "fecha": "2026-10-20", "cliente": "Carmen Ruiz", "telefono": "612 345 001", "email": "carmen@example.com", "producto": "Botín piel marrón", "talla": "38", "precio": 89.9, "fecha_limite": "2027-01-18", "estado": "activo", "abonado": 30.0, "pendiente": 59.9, "importe": 20.0}}` | Flow 02 only, receives `evento` and `datos` unchanged (including `importe`) | success |
| 3 | `{"evento": "venta.registrada", "datos": {"id": 257, "fecha": "2026-10-20", "concepto": "Crema calzado", "importe": 4.5, "forma_pago": "efectivo"}}` | No handler yet: "unhandled event" output | success, no alert |
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
| 3, 4, 5 | router success; no stub ran |
| 6, 7 | router error; no stub ran |

Not covered by this run: flow 08 attached to the router (alert email), a failing handler followed by another event, and events sent by the real app. Those are tasks 2.2, 2.3 and 3.x.

## Setup after importing

1. Import `workflows/tests/00-stub-reservation-confirmation.json` and `workflows/tests/00-stub-deposit-receipt.json` (placeholders until flows 01 and 02 exist), then `workflows/00-event-router.json`.
2. In the router, open both *Call …* nodes and choose the sub-workflow in the **Workflow** field. IDs differ on every n8n instance, so the JSON leaves them empty.
3. Set *Settings → Error Workflow* of the router (and later of each handler) to `08 Error Workflow`.
4. Publish the stubs, then the router. `N8N_WEBHOOK_URL` in `.env` must be `http://n8n:5678/webhook/tienda` for the real app.
