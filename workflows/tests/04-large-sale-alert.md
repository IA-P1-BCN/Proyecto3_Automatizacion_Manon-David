# Test payloads · 04 Large Sale Alert (issue #9)

The Code node is covered by `node --test workflows/code/04-format-alert.test.js` (run from the repo root). The payloads below test the flow in n8n: send them to the router webhook once flow 04 is linked in `00 Event Router`, or paste `{"datos": {...}}` as pinned input of `When Called By Router`. Payloads follow the `venta.registrada` shape in `docs/guia-de-la-app.md`, with sample data and no real customers. The alert goes to `TIENDA_EMAIL_AVISOS`, so use a test inbox there.

Unless a row says otherwise, the threshold is `TIENDA_UMBRAL_VENTA_GRANDE=150`.

| # | Event data | Expected result | Execution |
|---|---|---|---|
| 1 | Above: `importe` 189.5, `concepto` "Botas de piel", `forma_pago` `tarjeta`, `fecha` 2026-10-20 | One email "Venta grande: 189,50 € · Botas de piel" with concept, "189,50 €", `tarjeta` and 20/10/2026 | success |
| 2 | Just above: `importe` 150.01 | One email with "150,01 €" | success |
| 3 | Equal: `importe` 150 | No email | success |
| 4 | Below: `importe` 4.5 | No email | success |
| 5 | `importe` missing | No sale alert; the execution fails | error, flow 08 alert |
| 6 | `importe` as text (`"189.5"`) | No sale alert; the execution fails | error, flow 08 alert |
| 7 | Threshold empty (variable unset), payload 1 | No sale alert; the execution fails | error, flow 08 alert |
| 8 | Threshold `abc` or `99,99` (comma), payload 1 | No sale alert; the execution fails | error, flow 08 alert |
| 9 | Threshold `99.99` (dot), `importe` 100 | One email with "100,00 €" | success |
| 10 | Threshold changed from 150 to 200 (restart n8n), `importe` 189.5 | No email; the exported JSON is unchanged | success |
| 11 | Other events (`apartado.creado`, `abono.registrado`) sent to the router, with a complete payload | Flow 04 does not run; only the matching flow runs | success |

Rows 7 to 10 need a change of the variable in your own `.env` and `docker compose -p paso-firme up -d`. Put it back to 150 afterwards.

## Spec coverage

| Spec scenario | Rows |
|---|---|
| Sale above the threshold | 1, 2 |
| Sale equal to the threshold | 3 |
| Sale below the threshold | 4 |
| Message shows the sale | 1 |
| Threshold changed | 10 |
| Decimal threshold | 9 |
| Threshold not set | 7 (and 8 for an invalid value) |
| Other events | 11 |
| Missing amount | 5 (and 6 for a non-number) |

## PowerShell commands

Run from any PowerShell window while the router is published and flow 04 is linked and published. The `$url` line is shared by all commands. Payloads are sent as UTF-8 bytes.

```powershell
$url = 'http://localhost:5678/webhook/tienda'
function Send-Event($json) {
  Invoke-RestMethod -Method Post -Uri $url -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($json))
}

# 1 · above the threshold (email expected)
Send-Event '{"evento": "venta.registrada", "datos": {"id": 258, "fecha": "2026-10-20", "concepto": "Botas de piel", "importe": 189.5, "forma_pago": "tarjeta"}}'

# 2 · just above (email expected)
Send-Event '{"evento": "venta.registrada", "datos": {"id": 259, "fecha": "2026-10-20", "concepto": "Zapatillas running", "importe": 150.01, "forma_pago": "bizum"}}'

# 3 · equal to the threshold (no email)
Send-Event '{"evento": "venta.registrada", "datos": {"id": 260, "fecha": "2026-10-20", "concepto": "Sandalias de cuero", "importe": 150, "forma_pago": "efectivo"}}'

# 4 · below the threshold (no email)
Send-Event '{"evento": "venta.registrada", "datos": {"id": 257, "fecha": "2026-10-20", "concepto": "Crema calzado", "importe": 4.5, "forma_pago": "efectivo"}}'

# 5 · importe missing (must fail and alert)
Send-Event '{"evento": "venta.registrada", "datos": {"id": 261, "fecha": "2026-10-20", "concepto": "Cordones", "forma_pago": "efectivo"}}'

# 6 · importe as text (must fail and alert)
Send-Event '{"evento": "venta.registrada", "datos": {"id": 262, "fecha": "2026-10-20", "concepto": "Cordones", "importe": "189.5", "forma_pago": "efectivo"}}'

# 11 · other events (flow 04 must not run; flow 02 sends a receipt to your test inbox, so replace the email)
Send-Event '{"evento": "abono.registrado", "datos": {"id": 25, "fecha": "2026-10-20", "cliente": "Carmen Ruiz", "telefono": "612 345 001", "email": "tu-prueba@example.com", "producto": "Botín piel marrón", "talla": "38", "precio": 89.9, "fecha_limite": "2027-01-18", "estado": "activo", "abonado": 30.0, "pendiente": 59.9, "importe": 20.0}}'
```

Rows 7 to 10 reuse payload 1 (rows 7 and 8) or a copy of it with the `importe` of the row (rows 9 and 10), after changing the variable.

Every command prints `message: Workflow was started`, even for the failing ones: the router answers first and fails afterwards. Check the outcome in n8n's Executions list.

## Pinned data (flow 04 alone)

To test without the router, open `04 Large Sale Alert`, double-click `When Called By Router`, pin this item and click **Execute workflow**. Change `importe` for rows 2 to 6. Unpin it before publishing.

```json
[
  {
    "datos": { "id": 258, "fecha": "2026-10-20", "concepto": "Botas de piel", "importe": 189.5, "forma_pago": "tarjeta" }
  }
]
```

## Results

Unit tests of the Code node: 6 of 6 pass (2026-10-25).

Run on the team's n8n (reported by Manon, 2026-10-25), through the router webhook with flow 04 and the router published and flow 08 set as the Error Workflow of flow 04:

| Row | Result |
|---|---|
| 1, 2 | one "Venta grande" email each (189,50 € and 150,01 €); flow 04 success |
| 3, 4 | no email; flow 04 success |
| 5, 6 | flow 04 error; one flow 08 alert each |
| 11 | flow 02 ran; flow 04 did not run |

Still to run: rows 7 to 10 (empty, invalid, decimal and changed threshold; tasks 2.3 and 4.3) and a sale registered from the app screen (task 4.2). Row 7 and the missing `importe` case of task 2.3: only the missing `importe` is confirmed so far.
