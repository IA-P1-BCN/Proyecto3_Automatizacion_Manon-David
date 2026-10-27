# Test cases · 10 Excel Migration (issue #10)

The cleaning, grouping, rules, plan, request building and report text are covered by `node --test workflows/code/10-excel-migration.test.js workflows/code/10-excel-migration-stages.test.js workflows/code/00-migration-flag.test.js` (run from the repo root, 54 tests). The cases below test the flow in n8n: open the form (`/form/excel-migration-form` once the flow is published, or its Test URL in the editor), upload the two files of `data/` and submit.

Run them on a **clean copy of the app** (a separate compose project or a fresh volume, started with `SEED=0`), never on the team's data: the app has no delete endpoint, so a wrong load cannot be undone.

## Expected result on a clean app

| Part | Expected |
|---|---|
| Apartados | 7 created with their original `fecha` (`fecha_limite` = `fecha` + 90 days, set by the app) |
| Abonos | 10 in total: the 7 initial ones and 3 more (Carmen Ruiz 20 € on 05/09, Jorge Martín 30 € on 12/09, Ana Torres 20 € on 03/10) |
| Ventas | 6: Calcetines pack 3, Bota montaña T41, Plantillas gel, Zapatilla casa T38, Botín piel negro T40, Crema calzado, each with its original `fecha` and `forma_pago` |
| Not loaded | Lucía Gómez's two rows (line 4: initial abono 4 € < 5 €; line 10: depends on it), reported to Marisa |
| Ignored | The 3 sales lines that repeat an apartado deposit and the "TOTAL SEPTIEMBRE (a mano)" line |
| `forma_pago` | Sofía Navarro's initial abono is `bizum` (from the sales line); Miguel Ángel's and Ana's second abono match `efectivo` sales lines; the other 7 deposits are `efectivo` by default and listed in the report |
| Report | One Spanish email to `TIENDA_EMAIL_AVISOS`: 7 apartados, 3 abonos, 6 ventas, 2 rows to review |

## Cases

| # | Situation | Expected result | Spec scenario |
|---|---|---|---|
| 1 | Clean app, the two files of `data/` | Everything in the table above; subject `Migración del Excel: 7 apartados, 3 abonos, 6 ventas · 2 para revisar` | Run, Apartados and abonos, Payment method, Sales |
| 2 | Same files again | Nothing created; counts in the app unchanged; report says 7 / 10 / 6 already loaded and the same 2 rows to review | Run twice |
| 3 | Delete Carmen's abono of 05/09, Sofía's apartado with its abono and the sale "Crema calzado" from the app, then run again | Exactly 1 apartado, 1 abono and 1 sale created; report says 6 / 8 / 5 already loaded | Partial first run |
| 4 | Wrong API key in the shop credential | Execution fails at **Read App Apartados** (nothing created, flag never switched on); flow 08 alerts | App unreachable / failures |
| 5 | App unreachable after the lookups (the **Create Apartados** URL pointed at a host that does not exist) | Execution fails with "No se pudo hablar con la app…" and "El aviso de migración se desactivó"; flag is off afterwards; flow 08 alerts; nothing reported as doubtful | Failed run |
| 6 | `TIENDA_EMAIL_AVISOS` empty | Execution fails at **Prepare Migration** with "Configure TIENDA_EMAIL_AVISOS." before anything is created | No shop address |
| 7 | Router (flow 00) published while a migration runs (cases 1 and 3) | No event reaches flows 01 or 02 during the run; the router executions all succeed | Events are ignored while a migration runs |
| 8 | Header of a CSV edited (a column removed) | Execution fails with "A la hoja de … le faltan las columnas: …" before any call | A file cannot be read |

Not run: a second apartado with the same customer, product, date and price but another `talla` (the lookup treats it as the same apartado, see the design risks).

## Results

Run on 2026-10-27 in a throwaway stack (n8n 2.44.5, the app from this repo started with `SEED=0`, Mailpit as mailbox), not on the team's instance. Flow 08 and the real flows 01 and 02 were not part of that stack: the router was linked to stub handlers (`workflows/tests/00-stub-*.json`).

| # | Result |
|---|---|
| 1 | 7 apartados, 10 abonos, 6 ventas in the app with the dates, phones and `fecha_limite` expected; Sofía's initial abono `bizum`; report email as expected (7 deposits listed as default `efectivo`) |
| 2 | App unchanged (7 / 10 / 6); report "ya estaba cargado" 7 / 10 / 6 |
| 3 | 1 apartado, 1 abono, 1 venta created; report 1 / 1 / 1 loaded and 6 / 8 / 5 already loaded |
| 4 | Execution failed on the 401 at **Read App Apartados**; app empty; flag `false` |
| 5 | Execution failed with the expected message; flag `false` afterwards |
| 6 | Execution failed with "Configure TIENDA_EMAIL_AVISOS."; app empty |
| 7 | 16 events (7 + 3 + 6) reached the router and all 16 were ignored while the flag was on (stub handler runs +0); flag `false` 15 seconds after the last create |
| 8 | Covered by unit tests only |

An earlier version switched the flag off right after the last create: all 16 historical events then reached the handlers, because n8n starts the router executions up to a second after the app sends them. The `Let Events Pass` wait (15 seconds) before **Flag Off** fixed it.

Pending on the team's n8n: choose the credentials, set flow 08 as the Error Workflow, and repeat cases 1, 2 and 7 with the real flows 01 and 02 published (no customer or shop email may be sent by them during the run).
