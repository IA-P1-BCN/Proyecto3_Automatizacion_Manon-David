# Design

## Context

The app has no idempotency key and no field to mark an imported row. `POST /api/apartados` and `/abonos` accept an optional `fecha`; the app sets `fecha_limite = fecha + 90 days`, enforces the 5 € minimum initial abono, refuses to overpay, and answers `422` with `{"detail": "..."}` when a rule breaks. Every create fires a webhook (`apartado.creado`, `abono.registrado`, `venta.registrada`) that flow 00 routes to flows 01, 02 and 04. In `abono.registrado` the payload's `fecha` is the apartado's creation date, not the deposit date. See `docs/guia-de-la-app.md`.

The two CSVs (`data/excel_actual_*.csv`): apartados and abonos are mixed in one sheet (12 rows, no `forma_pago`, no email, `resta` computed by hand); the sales sheet (9 sales plus a typed total) records three initial deposits as sales. Existing patterns: generated workflow JSON plus tested pure code in `workflows/code/` (flows 05 and 06), SMTP notices to `TIENDA_EMAIL_AVISOS`, the shop Header Auth credential, flow 08 as Error Workflow.

Decisions already made are in `docs/decisions-clarify.md` ("Excel migration: …"): lookup in the app, migration flag, email report, doubtful rows, `forma_pago` fallback, form upload, owner.

## Goals / Non-Goals

**Goals:** a one-off, re-runnable load that never duplicates, never forces a rejected row, sends no historical emails, and tells Marisa exactly what was left out and why.

**Non-Goals:** undoing a migration (the app has no delete); a Marisa-corrected CSV re-feed (she fixes the row in the app or edits the file and re-runs, which the lookup makes safe); email addresses (none in the CSV); merging customers by phone; changing the app or `docker-compose.yml`.

## Decisions

1. **Form Trigger with two file uploads, read by a Code node.** Fields `Apartados` and `Ventas`; n8n puts each file in a binary property named after its field. The first Code node reads both buffers and parses them with a small tested CSV reader (`parseCsv`: quoted fields such as `"1.842,30"`, doubled quotes, CRLF or LF, BOM), so the parsing is unit-tested like the rest. *Alternative:* Extract From File (one node per file, and the second file's binary would be lost after the first extraction, so it needs extra plumbing). Header columns are validated (`fecha,cliente,telefono,modelo,talla,precio,abono,resta,notas` and `fecha,concepto,importe,forma_pago`); a wrong header throws before any call. The end page is an n8n Form node ("Migración terminada"), which makes the execution show as *waiting* until someone opens that page; this is how n8n form endings work. *Alternatives* for how the files arrive are in the decision doc.

2. **Three pure steps, in tested code, with the network in between.**
   - `clean(rows)` → typed rows or `held` entries (missing/unreadable `fecha`, `importe`, `cliente`). Dates `dd/mm/yyyy` and `d/m/yy` (day first, two-digit year = 2000+), amounts without `€`, comma or point decimals, names title-cased with collapsed spaces, phone as `XXX XXX XXX` when 9 digits.
   - `group(rows, sales)` → reservations: key = normalised `cliente` (lower case, no accents) + normalised `producto` + `talla`; sort by `fecha` (stable); first row = apartado with initial abono, later rows = abonos. A row whose `precio` differs from the first is held. Sales lines are classified: total line, deposit repeat (concept mentions `abono` or `apartado`, and a deposit has the same `fecha` and `importe`; it supplies `forma_pago`), unmatched deposit-looking line (held), or a plain sale.
   - `rules(reservation)` → hold the apartado if the initial abono is under 5 €, hold an abono that exceeds `precio - sum(previous)`, and hold every later abono of a held apartado. The 5 € figure is a copy of `backend/config.py`; it is a named constant with a test, and the app's `422` is the safety net (decision 5).
   The app stays the source of truth: the flow never computes `pendiente`; it only predicts a rejection to avoid creating something half-valid.

3. **Idempotency by lookup, before any create.** One `GET /api/apartados` (no filter, all states, no `pagina`) and one `GET /api/ventas?desde=<min>&hasta=<max>` with the shop Header Auth. An apartado exists when `cliente` (normalised), `producto`, `fecha` and `precio` match. For each match, `GET /api/apartados/{id}` gives its abonos (the initial one is the first); abonos are compared by `fecha` + `importe` **counting occurrences** (CSV count minus app count, never below zero). Sales are compared by `fecha` + `concepto` + `importe` with the same counting. The pure function `plan(clean, existing)` returns the exact creates left to do, already ordered. The report lists the rest as "skipped, already loaded". *Risk:* a legitimate second purchase with the same key on the same day looks like a duplicate; accepted, the counting rule covers identical rows inside the CSV.

4. **Creation in three stages, linear, no loop.** Stage 1 builds one `POST /api/apartados` per new reservation (body `cliente, telefono, producto, talla, precio, abono_inicial, forma_pago, fecha`; no `email`); stage 2 reads the ids from the responses and builds the `POST /api/apartados/{id}/abonos` requests (new apartados and apartados that already existed, whose `id` comes from the lookup), in date order; stage 3 builds the `POST /api/ventas` requests. Each stage is a Code node (tested, pure), then a literal-`POST` HTTP node, and the next stage reads the responses in the same order. Items run one at a time (the n8n HTTP default). Two n8n facts shaped this and were found by running it: (a) the HTTP node drops the body options when `method` is an expression, so each create is its own node with a literal method; (b) a node that receives no items does not run, so a stage with nothing to send passes one `{ empty: true }` marker around its HTTP node through an IF gate (`Apartados To Send?`, `Abonos To Send?`, `Sales To Send?`).

5. **`422` is data, other errors are failures.** The create nodes never throw (`neverError`, and "continue" on a network error), so every answer becomes an item and the next stage judges it: a `2xx` is created, a `422` becomes a held row with the app's `detail` (and its dependents are held), anything else (`401`, `5xx`, unreachable app) throws and goes to the failure path (decision 6). Creates are never retried, so a retry cannot duplicate; the lookups (reads) retry 3 times.

6. **Migration flag in an n8n Data Table `migration_state`** (one row: `clave = migracion`, `activa` true/false, `desde` ISO timestamp). The migration sets it on right after the lookups succeed (so a bad file or an unreachable app never silences the shop) and off **15 seconds after the last create**: the app sends each webhook right after its create, but n8n starts the router executions up to a second or two later (measured on 2.44.5: with an immediate switch-off all 16 historical events reached flows 01 and 02), so a `Let Events Pass` wait keeps the flag on until they have been handled. Every failure path sets it off, then throws so flow 08 alerts. A final check makes the report say if turning it off failed. *Alternatives:* n8n static data (not shared between workflows); `N8N_WEBHOOK_URL` toggling (manual); an environment variable (read-only at runtime); a kDrive CSV like `avisos.csv` (extra credential and ETag handling for one boolean).

7. **Flow 00 reads the flag before `Route by Event`.** A Data Table "Get" node, then an IF: if `activa` is true and `desde` is less than 30 minutes ago, go to a no-op output (execution succeeds, nothing is called); otherwise continue to the Switch. If the read fails, continue to the Switch with the error visible (continue on fail, never drop a real event). Existing router tests stay valid when the flag is off. *Risk:* the Data Table node must exist and be usable on the team's n8n version; task 1.1 verifies it, with the kDrive flag as the fallback.

8. **Report.** One Code node builds a Spanish subject and body from counts and lists (created, skipped, held with reason, default `forma_pago`), then Send Email (SMTP) to `$env.TIENDA_EMAIL_AVISOS` from `TIENDA_EMAIL_FROM`. Held reasons are Spanish sentences for Marisa ("El abono inicial es menor de 5 €"). A missing `TIENDA_EMAIL_AVISOS` throws, like flow 05. Amounts are formatted `59,90 €` from the data.

9. **Error handling.** Flow 08 is the Error Workflow. Because the form run is interactive, the form's final page says "Migración terminada, revisa el correo" or the failure text.

10. **Testing data.** The test files are the repo's CSVs against the seeded app. Expected on a clean app: 7 apartados created (Lucía's is held), 3 follow-up abonos (Carmen, Jorge, Ana), 6 sales, 3 sales lines skipped as repeated deposits, 1 total line ignored, 2 rows held (Lucía's 4 € and 41 €), and the `forma_pago` of Miguel Ángel (efectivo), Ana's second abono (efectivo) and Sofía (bizum) taken from the sales lines.

## Risks / Trade-offs

- [The lookup mistakes a real new purchase for a duplicate] → same customer, product, date and price is the key; documented, and the report lists every skip.
- [A first run stops after creating an apartado but before its abonos] → the second run finds the apartado and creates only the missing abonos (decision 3, covered by a test).
- [The app's apartado list becomes large] → no `pagina`, one call; fine for a shop of this size, and the report shows the count.
- [`resta` and typed notes in the Excel are lost] → intended; the app computes amounts and `notas` has no field.
- [Webhooks of a real sale during the migration are dropped] → the run takes seconds, Marisa runs it with the shop closed (decision doc); the 30-minute expiry limits the worst case.
- [The 5 € copy in the flow drifts from `backend/config.py`] → a named constant, a test, and the `422` safety net.
- [Customer data in the report email] → only names and amounts of the shop's own customers go to the shop's own mailbox.

## Migration Plan

Run on the team's n8n after the PR is merged, with the app in a known state (compare `GET /api/apartados/resumen` before and after). If the first run is wrong, fix the flow and re-run: the lookup prevents duplicates, but the app cannot delete, so wrong rows already created stay. For that reason the real run is done on a copy of the data first (task 4.1) and the team's n8n is only used once the report matches the expected numbers.

## Open Questions

- Exact Spanish wording of each held reason, to read with Marisa; the flow works unchanged if the text changes.
- Whether Marisa wants the report also as a file; not needed to meet the story.
