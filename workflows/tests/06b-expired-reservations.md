# Test payloads · 06b Expired Reservations (issue #7)

The Code node logic is covered by `node --test workflows/code/06b-expired-reservations.test.js` (run from the repo root). The table below tests the flow in n8n with the **Manual Run** trigger: *Choose Date* sets `fecha`. The app uses its own real date, so create the reservations with a past `fecha_limite` and run the flow with today's date (or later); a manual `fecha` earlier than the app's today can only expire fewer reservations. Sample data, no real customers; use your own email and a test inbox in `TIENDA_EMAIL_AVISOS`.

Today in the examples is 2026-10-20.

| # | Active reservations in the app | Expected result | Execution |
|---|---|---|---|
| 1 | One with `fecha_limite` 2026-10-19, own `email`, `talla` 40, `abonado` 5.0 | Reservation becomes `vencido` with a voucher; one customer email "Tu apartado ha vencido: aquí tienes tu vale · …" with the app's code and `5,00 €`; one summary email listing the shoes | success |
| 2 | Same run again right after #1 | Nothing selected: no email, no summary | success |
| 3 | `fecha_limite` 2026-10-20 (today) and 2026-10-21 | Nothing expired | success |
| 4 | `liquidado` and `vencido` reservations with a past deadline | Nothing expired | success |
| 5 | No reservations at all | No email, no summary | success |
| 6 | Three past-deadline reservations | Three customer emails and **one** summary listing the three products | success |
| 7 | Past deadline, `email` empty | No customer email; the summary lists it under "Clientes a avisar a mano" with the voucher code and phone | success |
| 8 | Past deadline, `email` `sin-arroba` | Same as #7 | success |
| 9 | Past deadline, no `talla` | Email and summary show the product without a size | success |
| 10 | Two past-deadline reservations, one of them already `vencido` between the listing and the call (expire it by hand while the flow is running, or pin the list) | The other is expired and notified; the refused one is reported; the execution fails | error, flow 08 alert |
| 11 | Past-deadline reservation, SMTP credential broken for one run | Reservation expired; execution fails; flow 08 alerts; the summary (if SMTP allows it) lists the customer under "avisar a mano" | error, flow 08 alert |
| 12 | App stopped (`docker compose -p paso-firme stop tienda`) | Execution fails at *Fetch Reservations*; flow 08 alerts; nothing expired | error, flow 08 alert |
| 13 | Scheduled trigger, flow published only for the test | Fires once at 09:05 Madrid time | success |

Rows 11 and 12 change the stack: restore it afterwards. Row 13 needs permission to publish the flow; unpublish it after the check.

To create a late reservation, post it to the app with `fecha` (migration use) 90 days or more in the past, for example in PowerShell:

```powershell
$h = @{ 'X-API-Key' = '<your key>' }
$body = @{ cliente = 'Prueba Vencida'; email = '<your test email>'; producto = 'Zapatilla de prueba'; talla = '40'; precio = 60; abono_inicial = 5; fecha = '2026-06-01' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/apartados -Headers $h -ContentType 'application/json' -Body $body
```

Use `http://localhost:8001` instead if you set `TIENDA_PORT=8001`. The app sets the deadline 90 days after `fecha`, so 2026-06-01 gives 2026-08-30.

## Spec coverage

| Spec scenario | Rows |
|---|---|
| Scheduled run | 13 |
| Manual run for a chosen date | 1 to 9 (Choose Date) |
| Deadline passed | 1, 6 |
| Deadline today | 3 |
| Not active | 4 |
| Nothing to expire | 3, 4, 5 |
| Run twice the same day | 2 |
| App refuses to expire | 10 |
| Voucher email | 1, 9 |
| Missing or malformed email | 7, 8 |
| Customer email bounces | 11 |
| Several expired the same day | 6 |
| Nothing expired (no summary) | 2, 3, 5 |
| App unreachable | 12 |
| One failure among several | 10 |

## Result

Not run in n8n yet. Pending on the team's n8n.
