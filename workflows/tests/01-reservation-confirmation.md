# Test payloads · 01 Reservation Confirmation (issue #1)

The Code node is covered by `node --test workflows/code/01-format-confirmation.test.js` (run from the repo root). The payloads below test the flow in n8n: send them to the router webhook once flow 01 is linked in `00 Event Router`, or paste the `datos` object as pinned input of `When Called By Router`. Payloads come from `docs/guia-de-la-app.md`, seeded sample data, no real customers. Replace the sample email with a test address before sending (never use a real customer address).

| # | Event data | Expected result | Execution |
|---|---|---|---|
| 1 | Normal: Botín piel marrón, talla 38, precio 89.9, abonado 10.0, pendiente 79.9, `fecha_limite` 2027-01-18, email present | Customer gets "Tu apartado en Paso Firme: Botín piel marrón" with 89,90 € price, 10,00 € paid, 79,90 € pending, 18/01/2027 | success |
| 2 | `talla` null | Customer message without any size line | success |
| 3 | `estado` `liquidado`, `abonado` 89.9, `pendiente` 0 | Customer gets the "recoger tus zapatos" text, no pending amount, no deadline | success |
| 4 | Tricky decimals: precio 64.5, abonado 5.0, pendiente 59.5 | Pending shown as 59,50 €, taken from the event | success |
| 5 | `email` empty | No customer message; shop gets "Apartado sin confirmación: el apartado nº 25 no tiene email válido" with number, customer, phone, model, reason | success |
| 6 | `email` without `@` (`carmen.example.com`) | Same as 5 | success |
| 7 | Two reservations in a row (payload 1, then payload 4) | Exactly two emails, one per event | success |
| 8 | `precio` missing | No message; the execution fails | error, flow 08 alert |

## PowerShell commands

Run from any PowerShell window while the router is published and flow 01 is linked and published. The `$url` line is shared by all commands. Replace `tu-prueba@example.com` with your test inbox. Payloads contain accents, so they are sent as UTF-8 bytes.

```powershell
$url = 'http://localhost:5678/webhook/tienda'
function Send-Event($json) {
  Invoke-RestMethod -Method Post -Uri $url -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($json))
}

# 1 · normal reservation
Send-Event '{"evento": "apartado.creado", "datos": {"id": 25, "fecha": "2026-10-20", "cliente": "Carmen Ruiz", "telefono": "612 345 001", "email": "tu-prueba@example.com", "producto": "Botín piel marrón", "talla": "38", "precio": 89.9, "fecha_limite": "2027-01-18", "estado": "activo", "abonado": 10.0, "pendiente": 79.9}}'

# 2 · no size
Send-Event '{"evento": "apartado.creado", "datos": {"id": 25, "fecha": "2026-10-20", "cliente": "Carmen Ruiz", "telefono": "612 345 001", "email": "tu-prueba@example.com", "producto": "Botín piel marrón", "talla": null, "precio": 89.9, "fecha_limite": "2027-01-18", "estado": "activo", "abonado": 10.0, "pendiente": 79.9}}'

# 3 · paid in full at creation
Send-Event '{"evento": "apartado.creado", "datos": {"id": 25, "fecha": "2026-10-20", "cliente": "Carmen Ruiz", "telefono": "612 345 001", "email": "tu-prueba@example.com", "producto": "Botín piel marrón", "talla": "38", "precio": 89.9, "fecha_limite": "2027-01-18", "estado": "liquidado", "abonado": 89.9, "pendiente": 0}}'

# 4 · tricky decimals
Send-Event '{"evento": "apartado.creado", "datos": {"id": 26, "fecha": "2026-10-20", "cliente": "Carmen Ruiz", "telefono": "612 345 001", "email": "tu-prueba@example.com", "producto": "Sandalia cuña", "talla": "37", "precio": 64.5, "fecha_limite": "2027-01-18", "estado": "activo", "abonado": 5.0, "pendiente": 59.5}}'

# 5 · no email
Send-Event '{"evento": "apartado.creado", "datos": {"id": 25, "fecha": "2026-10-20", "cliente": "Carmen Ruiz", "telefono": "612 345 001", "email": "", "producto": "Botín piel marrón", "talla": "38", "precio": 89.9, "fecha_limite": "2027-01-18", "estado": "activo", "abonado": 10.0, "pendiente": 79.9}}'

# 6 · email without @
Send-Event '{"evento": "apartado.creado", "datos": {"id": 25, "fecha": "2026-10-20", "cliente": "Carmen Ruiz", "telefono": "612 345 001", "email": "carmen.example.com", "producto": "Botín piel marrón", "talla": "38", "precio": 89.9, "fecha_limite": "2027-01-18", "estado": "activo", "abonado": 10.0, "pendiente": 79.9}}'

# 8 · no precio (must fail and alert)
Send-Event '{"evento": "apartado.creado", "datos": {"id": 25, "cliente": "Carmen Ruiz", "email": "tu-prueba@example.com", "producto": "Botín piel marrón", "talla": "38", "fecha_limite": "2027-01-18", "estado": "activo", "abonado": 10.0, "pendiente": 79.9}}'
```

## Results

Unit tests of the Code node: 9 of 9 pass (2026-10-23).

### Run on the team's n8n (2026-10-23)

| # | Result |
|---|---|
| 1 to 4 | Sent through the router to a test inbox; flow 01 executions successful; the 4 emails arrived with the expected content (reported by Manon) |
| 5, 6 | Flow 01 executions successful; shop alerts confirmed by Manon |
| 7 | Payloads 1 and 4 sent in a row: one email each |
| 8 | Flow 01 failed and flow 08 ran successfully |

The agent sent the payloads; it cannot read the inboxes.
