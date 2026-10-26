# Test cases · 06 Due Date Reminders (issue #6)

The decision logic, the Spanish text, the sent-record file and the kDrive listing rules are covered by `node --test workflows/code/06-due-reminders.test.js` (run from the repo root, 24 tests). The cases below test the flow in n8n with the manual trigger: open **Choose Date**, set `fecha` to the day you want to simulate, then run from **Manual Run**. The scheduled run (09:00 Madrid) uses the real date and cannot be given another one.

A reservation's `fecha_limite` is its `fecha` + 90 days (the app sets it), so to get a deadline 7 days after the run date `D` create the reservation with `fecha` = `D` + 7 − 90 days. The commands below do that.

| # | Reservation (state `activo` unless said) | Run date | Expected result | Spec scenario |
|---|---|---|---|---|
| 1 | Deadline = run date + 7, email present | `D` | Customer gets "Tu apartado vence en 7 días · …" with pending, paid and deadline as the app sent them; one row `id;7;enviado;D` in `avisos.csv` | Deadline in 7 days |
| 2 | Same reservation | `D` again | No email, no new row | Run twice the same day |
| 3 | Same reservation | `D + 6` (deadline = run date + 1) | Customer gets "Tu apartado vence mañana · …" ("termina mañana"); second row `id;1;enviado;D+6` | Deadline tomorrow, Both thresholds |
| 4 | Deadline = run date + 6, + 8, + 0 or − 1 | `D` | No email, run succeeds | Any other distance |
| 5 | `liquidado` or `vencido`, deadline = run date + 7 | `D` | No email | Not active |
| 6 | No reservation due | any | Run succeeds, no email, no file change | Nothing due |
| 7 | Deadline = run date + 7, `email` empty | `D` | No customer email; the shop gets "Recordatorio sin enviar: el apartado nº … no tiene email válido" with number, customer, phone, product, deadline, pending; row `id;7;sin_email;D`; run succeeds; other reminders of the day still go out | No email |
| 8 | Same reservation | `D` again | Shop is not alerted again | Re-run |
| 9 | Same as 7 with `email` = `carmen.example.com` | `D` | Same as 7 | No email |
| 10 | Deadline = run date + 7, no `talla` | `D` | Email without any size line | No size |
| 11 | Two reservations due the same day, one with and one without email | `D` | One customer email and one shop alert, each with its own data | No email |
| 12 | Deadline = run date + 7 | `D`, with the SMTP credential broken | Execution fails, flow 08 alerts, no row written for the failed email; with the credential restored, the next run sends it and writes the row | Email rejected |
| 13 | Any | `D`, with the app stopped | Execution fails at **Fetch Reservations**, flow 08 alerts, no email, no row | App unreachable |
| 14 | Any | `D`, with the header of `avisos.csv` edited by hand | Execution fails at **Plan Reminders** before any email is sent; restore the header afterwards | Unreadable record |
| 15 | n8n restarted between two runs on `D` | `D` | The second run sends nothing: the record is in kDrive | Record survives a restart |
| 16 | Flow published for the test | the real 09:00 | One execution in Executions at 09:00, Madrid time | Scheduled run |

## PowerShell commands

Create the test reservations through the app's API (it validates and calculates the deadline). Replace `TU-API-KEY` with your `API_KEY` and `tu-prueba@example.com` with your test inbox. Change `$d` to the run date you want to simulate. Port 8000 is the browser port; use 8001 if you set `TIENDA_PORT`.

```powershell
$key  = 'TU-API-KEY'
$base = 'http://localhost:8000'
$d    = [datetime]'2026-10-26'          # the run date you will put in Choose Date

function New-Apartado($fechaLimite, $email, $talla = '38', $cliente = 'Carmen Ruiz') {
  # fecha_limite = fecha + 90 days, so fecha = fecha_limite - 90 days
  $fecha = ([datetime]$fechaLimite).AddDays(-90).ToString('yyyy-MM-dd')
  $body  = @{ cliente = $cliente; telefono = '612 345 001'; email = $email; producto = 'Botín piel marrón'; talla = $talla;
              precio = 89.9; abono_inicial = 30; forma_pago = 'bizum'; fecha = $fecha } | ConvertTo-Json
  if ($null -eq $talla) { $body = $body -replace '"talla":\s*null,?\s*', '' }
  Invoke-RestMethod -Method Post -Uri "$base/api/apartados" -Headers @{ 'X-API-Key' = $key } `
    -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body))
}

# 1-3 · due in 7 days, with your email
New-Apartado $d.AddDays(7).ToString('yyyy-MM-dd') 'tu-prueba@example.com'

# 4 · other distances (no email expected)
foreach ($n in 6, 8, 0, -1) { New-Apartado $d.AddDays($n).ToString('yyyy-MM-dd') 'tu-prueba@example.com' }

# 7 · no email
New-Apartado $d.AddDays(7).ToString('yyyy-MM-dd') ''

# 9 · email without @
New-Apartado $d.AddDays(7).ToString('yyyy-MM-dd') 'carmen.example.com'

# 10 · no size
New-Apartado $d.AddDays(7).ToString('yyyy-MM-dd') 'tu-prueba@example.com' $null

# See what the flow will read
Invoke-RestMethod -Uri "$base/api/apartados?estado=activo" -Headers @{ 'X-API-Key' = $key } |
  Select-Object id, cliente, email, fecha_limite, pendiente | Format-Table
```

Expected files to check after each run: the email in the test inbox, the Executions list in n8n, and `avisos.csv` in the kDrive folder (header `apartado_id;umbral;resultado;fecha_envio`, one row per reservation and threshold).

Careful: back-dated reservations stay in the app's database as test data. Do not run these commands against the shared demo data without telling David.

## Results

Unit tests: 24 of 24 pass (2026-10-26).

### Run on the team's n8n (reported by Manon, 2026-10-26)

Tasks 3.2, 3.3 and 3.4 (sending branches, record order, flow 08 as Error Workflow) and tasks 4.2 to 4.6 (7-day and 1-day reminders, re-run with nothing sent, reservation without email, broken SMTP credential, published 09:00 run) were reported as passing. The per-case executions were not recorded one by one; the screenshots of the received emails and of `avisos.csv` go in `docs/evidence/06-due-reminders/` (task 5.3). Cases the report did not name explicitly (4, 5, 6, 9, 10, 11, 13, 14, 15) are covered by the unit tests; run them in n8n if the PR reviewer asks.
