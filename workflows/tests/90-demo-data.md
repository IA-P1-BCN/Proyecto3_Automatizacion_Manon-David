# Test notes · 90 Demo Data (issue #20)

The Code node logic is covered by `node --test workflows/code/90-build-scenarios.test.js` (11 tests, run from the repo root). `node workflows/code/build-90-demo-data.js` regenerates `workflows/90-demo-data.json` from it. The flow is started by hand (*Execute workflow*) and is never published.

Before a run: flows 00, 01 and 02 published (router last) if you want the emails; the Header Auth credential chosen on `List Reservations`, `Create Reservation` and `Register Deposit`; *Settings → Error Workflow → `08 Error Workflow`*; `TIENDA_EMAIL_AVISOS` set in `.env`.

## Expected result of the first run

| # | Customer | Estado | `abonado` | `pendiente` | Notes |
|---|---|---|---|---|---|
| 1 | Lucía Prado (demo) | `activo` | 30,00 | 59,90 | initial 10 (bizum) + deposit 20 (efectivo), email, size 38 |
| 2 | Marcos Vidal (demo) | `liquidado` | 45,00 | 0,00 | initial 10 + final deposit 35 (tarjeta), no size |
| 3 | Elena Soto (demo) | `liquidado` | 59,90 | 0,00 | paid in full at creation |
| 4 | Pablo Ríos (demo) | `activo` | 15,00 | 59,50 | no email |
| 5 | Irene Mora (demo) | `activo` | 10,00 | 54,50 | `fecha` = today minus 100 days, `fecha_limite` 10 days in the past |

Summary item: `creados` 5, `omitidos` 0, `abonos_registrados` 2, five ids.

**Emails (flows 00, 01 and 02 published): 7**, all to `TIENDA_EMAIL_AVISOS`: four flow 01 confirmations (customers 1, 2, 3, 5), one flow 01 shop alert (customer 4, no email) and two flow 02 messages (a partial receipt for customer 1, "collect your shoes" for customer 2).

**Second run:** nothing is created, no email is sent, summary `creados` 0, `omitidos` 5 and `resultado` "Los datos de demostración ya existen: no se ha creado nada."

## PowerShell checks

Replace `8001` with your `TIENDA_PORT` (8000 by default) and `<API_KEY>` with the value in your `.env`; never paste it into a file in Git.

```powershell
$h = @{ 'X-API-Key' = '<API_KEY>' }
$demo = Invoke-RestMethod 'http://localhost:8001/api/apartados' -Headers $h | Where-Object { $_.cliente -like '*(demo)*' }
$demo | Sort-Object id | Select-Object id, cliente, estado, precio, abonado, pendiente, fecha, fecha_limite, email | Format-Table -AutoSize

# Deposits of one reservation (replace 29 with an id from the table)
(Invoke-RestMethod 'http://localhost:8001/api/apartados/29' -Headers $h).abonos | Format-Table -AutoSize
```

Expected: five rows with the states above, and for id 29 two deposits: the initial 10,00 (bizum) and the 20,00 (efectivo), 30,00 in total.

## Results

Unit tests: 11 of 11 pass (2026-10-26).

### Run on the team's n8n (2026-10-26)

| Check | Result |
|---|---|
| First run on an app without demo data (CLI `n8n execute`) | success: 5 created, 0 skipped, 2 deposits; ids 29 to 33 |
| States and amounts in the app (API) | as in the table above; deadline of customer 5 was 2026-10-16 |
| Emails received (reported by Manon) | 7 |
| Second run | success: 0 created, 5 skipped; the app still held 33 reservations, 5 of them demo |
| Partly-loaded case, wrong URL to flow 08, pinned list (tasks 1.2, 2.1, 2.4) | confirmed by Manon in the editor; not run by the agent |

Evidence: `docs/evidence/90-demo-data/`.

## Known limits

- A run that fails after creating a reservation but before its deposit leaves it as created; the next run does not add the missing deposit. Reset with `docker compose down -v` (wipes all data; see the app guide).
- If the router is not published, the app's events are lost and no email is sent; the data is still created.
