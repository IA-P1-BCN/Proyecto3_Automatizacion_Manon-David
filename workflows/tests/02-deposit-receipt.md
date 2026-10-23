# Test payloads · 02 Deposit Receipt (issue #2)

The Code node is covered by `node --test workflows/code/02-format-receipt.test.js` (run from the repo root). The payloads below test the flow in n8n: send them to the router webhook once flow 02 is linked in `00 Event Router`, or paste the `datos` object as pinned input of `When Called By Router`. Payloads come from `docs/guia-de-la-app.md`, seeded sample data, no real customers. The test inbox receives the customer messages because the sample emails are replaced by a test address before sending (never use a real customer address).

| # | Event data | Expected result | Execution |
|---|---|---|---|
| 1 | Partial deposit: `importe` 20.0, `estado` `activo`, `pendiente` 59.9, `fecha_limite` 2027-01-18, email present | Customer gets "Recibo de tu abono · Botín piel marrón" with 20,00 € paid, 59,90 € pending, 18/01/2027 | success |
| 2 | Final deposit: `importe` 12.0, `estado` `liquidado`, `pendiente` 0 | Customer gets "Ya puedes recoger tus zapatos · …" with 12,00 € and no pending amount | success |
| 3 | `email` empty | No customer message; shop gets "Abono sin recibo: el apartado nº 25 no tiene email válido" with number, customer, phone, amount, reason | success |
| 4 | `email` without `@` (`carmen.example.com`) | Same as 3 | success |
| 5 | Two deposits in a row (payload 1, then `importe` 10.0 and `pendiente` 49.9) | Two receipts, each with its own amount | success |
| 6 | `importe` missing | No message; the execution fails | error, flow 08 alert |

## PowerShell commands

Run from any PowerShell window while the router is published and flow 02 is linked and published. The `$url` line is shared by all commands. Replace `tu-prueba@example.com` with your test inbox. Payloads contain accents, so they are sent as UTF-8 bytes.

```powershell
$url = 'http://localhost:5678/webhook/tienda'
function Send-Event($json) {
  Invoke-RestMethod -Method Post -Uri $url -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($json))
}

# 1 · partial deposit
Send-Event '{"evento": "abono.registrado", "datos": {"id": 25, "fecha": "2026-10-20", "cliente": "Carmen Ruiz", "telefono": "612 345 001", "email": "tu-prueba@example.com", "producto": "Botín piel marrón", "talla": "38", "precio": 89.9, "fecha_limite": "2027-01-18", "estado": "activo", "abonado": 30.0, "pendiente": 59.9, "importe": 20.0}}'

# 2 · final deposit (liquidado)
Send-Event '{"evento": "abono.registrado", "datos": {"id": 25, "fecha": "2026-10-20", "cliente": "Carmen Ruiz", "telefono": "612 345 001", "email": "tu-prueba@example.com", "producto": "Botín piel marrón", "talla": "38", "precio": 89.9, "fecha_limite": "2027-01-18", "estado": "liquidado", "abonado": 89.9, "pendiente": 0, "importe": 12.0}}'

# 3 · no email
Send-Event '{"evento": "abono.registrado", "datos": {"id": 25, "fecha": "2026-10-20", "cliente": "Carmen Ruiz", "telefono": "612 345 001", "email": "", "producto": "Botín piel marrón", "talla": "38", "precio": 89.9, "fecha_limite": "2027-01-18", "estado": "activo", "abonado": 30.0, "pendiente": 59.9, "importe": 20.0}}'

# 4 · email without @
Send-Event '{"evento": "abono.registrado", "datos": {"id": 25, "fecha": "2026-10-20", "cliente": "Carmen Ruiz", "telefono": "612 345 001", "email": "carmen.example.com", "producto": "Botín piel marrón", "talla": "38", "precio": 89.9, "fecha_limite": "2027-01-18", "estado": "activo", "abonado": 30.0, "pendiente": 59.9, "importe": 20.0}}'

# 5 · second deposit right after payload 1
Send-Event '{"evento": "abono.registrado", "datos": {"id": 25, "fecha": "2026-10-20", "cliente": "Carmen Ruiz", "telefono": "612 345 001", "email": "tu-prueba@example.com", "producto": "Botín piel marrón", "talla": "38", "precio": 89.9, "fecha_limite": "2027-01-18", "estado": "activo", "abonado": 40.0, "pendiente": 49.9, "importe": 10.0}}'

# 6 · no importe (must fail and alert)
Send-Event '{"evento": "abono.registrado", "datos": {"id": 25, "cliente": "Carmen Ruiz", "email": "tu-prueba@example.com", "producto": "Botín piel marrón", "talla": "38", "fecha_limite": "2027-01-18", "estado": "activo", "pendiente": 59.9}}'
```

## Results

Unit tests of the Code node: 9 of 9 pass (2026-10-23).

### Run on the team's n8n (reported by Manon, 2026-10-23)

| # | Result |
|---|---|
| 1 | Receipt arrived with 20,00 € paid, 59,90 € pending and 18/01/2027; execution successful |
| 2 | "Collect your shoes" message arrived; execution successful |
| 3, 4 | Shop alert arrived, nothing sent to the customer; execution successful |
| 5, 6 | Covered by the app tests below |

Tasks 2.1 to 2.6 (reported as passing): deposit from the app screen, a deposit that settles the reservation, a deposit through the API, a reservation without email, two deposits in a row, and flow 08's alert after the SMTP credential was broken and restored. The agent ran no n8n execution itself.
