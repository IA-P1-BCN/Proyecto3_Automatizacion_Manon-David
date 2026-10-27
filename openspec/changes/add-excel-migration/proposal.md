# Proposal

## Why

Marisa still has her history in an Excel sheet. Until it is in the app she keeps two systems and the daily close, reminders and reports miss every old reservation (story HU-10, Medium level). The CSV also has formats the app rejects (`15€`, `7/9/26`, lower-case names) and rows that break the app's rules, which must be reported, not forced in.

## What Changes

- Add flow 10, `10 Excel Migration`, run by hand from an n8n form (Form Trigger with two file uploads), with no schedule. It reads the two CSV files, with `data/excel_actual_apartados.csv` and `data/excel_actual_ventas.csv` as the test files.
- Clean the rows: dates (`dd/mm/yyyy`, `d/m/yy`), names (case and spaces), phones, amounts (`15€`, comma or point decimals). Cleaning is silent; it never changes meaning.
- Turn the apartados sheet into app calls: the first row of a customer and product is an apartado with its initial abono, later rows are abonos. Create them with `POST /api/apartados` and `POST /api/apartados/{id}/abonos`, keeping the original `fecha`.
- Take `forma_pago` from the sales line with the same `fecha` and `importe`, else `efectivo`.
- Ignore sales lines that repeat an apartado deposit and the hand-typed monthly total; load the other lines with `POST /api/ventas` and their `fecha`.
- Be idempotent by asking the app: a row whose natural key already exists is skipped; identical rows on one day are compared by count.
- Hold back, and never load, rows that break a rule (initial abono under 5 €, abono above the pending balance, missing or unreadable `fecha`, `importe` or `cliente`) and every later abono of a held apartado.
- Email Marisa one Spanish report: loaded, skipped as already loaded, held back with the reason, and the deposits that got the default payment method.
- Add a **migration flag**: the flow switches it on at the start and off at the end (also on failure); while it is on, flow 00 ignores every app event, so the migration sends no historical emails and raises no "no email" alerts.
- Wire flow 08 as the Error Workflow.

## Capabilities

### New Capabilities
- `excel-migration`: the old Excel is loaded into the app once, with cleaned data and original dates, without duplicates, and doubtful rows are reported to Marisa instead of loaded.

### Modified Capabilities
- `event-routing`: the router ignores app events while a migration is running. (`openspec/specs/` is still empty, so this is an ADDED requirement on the capability introduced by `add-event-router`.)

## Impact

- **New files:** `workflows/10-excel-migration.json` (no credentials), its generator, pure-logic code (cleaning, grouping, rules, report text) and tests under `workflows/code/`, and `workflows/tests/10-excel-migration.md`, following flows 05 and 06.
- **Changed files:** `workflows/00-event-router.json`, `workflows/code/build-00-event-router.js` and `workflows/tests/00-event-router.md` (flag check before routing). Flow 00 is Manon's and is merged in `dev`.
- **New config:** an n8n Data Table `migration_state` for the flag (no secret); no `docker-compose.yml` change (the files come through the form). Reuses `TIENDA_EMAIL_FROM`, `TIENDA_EMAIL_AVISOS`, the shop Header Auth and the SMTP credential.
- **Depends on:** flow 08 and flow 00 (both merged). Independent of flows 01 to 06, HU-03, HU-07 and HU-08.
- **Rules kept:** the app is the source of truth for amounts, states and deadlines; the flow only decides what to do with a row the app would reject, and never recalculates `pendiente`. No AI is used. `resta` in the CSV is ignored.
- **Decisions:** idempotency by app lookup, migration flag, report by email, doubtful rows, `forma_pago` fallback and owner are in `docs/decisions-clarify.md` (sections "Excel migration: …").
- **Out of scope:** forcing rejected data, a Marisa-fixed CSV re-feed, loading emails (the CSV has none), merging customers with different phones, undoing a migration (the app has no delete), a schedule.
- **Owner:** Manon.
- **Issue · branch:** #10 · `feat/10-excel-migration` (PR targets `dev`).
