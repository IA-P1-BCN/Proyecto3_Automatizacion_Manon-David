# Tasks

## 1. Prerequisites and decisions

- [x] 1.1 In the team's n8n (and a throwaway container), create the Data Table `migration_state` (columns `clave`, `activa`, `desde`) and check that the Data Table node reads and writes it from two different workflows; verify, and if the node is unavailable record the kDrive-CSV fallback in `docs/decisions-clarify.md` before going on.
- [x] 1.2 Confirm the Form Trigger shows two file fields and that the Code node's CSV reader (not Extract From File, see design decision 1) parses a quoted field (`"1.842,30"`) and a BOM from the two files in `data/`; verify with a form submission.
- [ ] 1.3 Check the "Excel migration: …" sections of `docs/decisions-clarify.md` against the specs and design, and confirm the four assumptions in "how the CSV files arrive" with David in review; verify none contradicts an existing decision.

## 2. Pure logic (in `workflows/code/`, with unit tests)

- [x] 2.1 Write `clean` (dates `dd/mm/yyyy` and `d/m/yy`, `15€`, comma and point decimals, name case and spaces, phone format, missing phone) with tests for: `7/9/26`, `carmen ruiz`, `15€`, empty phone, empty `fecha`, `importe` that is text, impossible date `31/02/2026`; verify an unreadable value goes to `held`, not to a guess.
- [x] 2.2 Write `group` (reservation key, first row = apartado, later rows = abonos sorted by `fecha`, different `precio` held) and the sales classifier (total line, deposit repeat with `forma_pago`, deposit-looking line with no match held, plain sale) with tests built from the 12 + 10 lines of `data/`; verify the expected counts (7 reservations with Lucía's held, 3 follow-up abonos, 6 sales, 3 repeats, 1 total).
- [x] 2.3 Write `rules` (initial abono under 5 €, abono above `precio - sum(previous)`, dependents of a held apartado, named constant for the 5 €) with tests for 4 €, 5 €, exact balance, 1 cent over, and a held apartado with two later abonos; verify no test touches `pendiente` from the app.
- [x] 2.4 Write `plan` (given clean data and what the app already has: skip existing apartados, abonos and sales by key, with occurrence counts) with tests for: empty app, everything loaded, apartado present but one abono missing, two identical abonos in the CSV and one in the app, same key with different `precio`; verify a second run returns no creates.
- [x] 2.5 Write the Spanish report formatter (subject, counts, held table with reasons, default `forma_pago` list, empty parts, `59,90 €`, `dd/mm/yyyy`) with tests; verify amounts are only formatted from the given fields and a part with no rows still appears.

## 3. Migration flag and router

- [x] 3.1 In `workflows/code/build-00-event-router.js` add the flag check before `Route by Event` (Data Table get, IF `activa` and `desde` within 30 minutes → silent output; read failure → continue to the Switch) and regenerate `workflows/00-event-router.json`; verify the JSON imports, other nodes are unchanged and the workflow stays inactive.
- [ ] 3.2 Add to `workflows/tests/00-event-router.md` the cases flag on, flag off, flag older than 30 minutes and unreadable flag; run them on the team's n8n (set the row by hand) and verify the results as in the spec scenarios, and that the seven existing cases still pass.

## 4. Build flow 10

- [x] 4.1 Create the generator `workflows/code/build-10-excel-migration.js` and generate `10 Excel Migration`: Form Trigger with two files → Code node (CSV reader, header check, `clean`/`group`/`rules`); verify the JSON imports in a throwaway n8n and is inactive.
- [x] 4.2 Add the lookups (`GET /api/apartados`, `GET /api/apartados/{id}` for the matches, `GET /api/ventas?desde&hasta`) with the shop Header Auth and the `plan` node; verify against the seeded app that `plan` returns every create on a clean app.
- [x] 4.3 Add the flag on/off nodes and the creation stages (`POST /api/apartados` → read the ids → `POST /api/apartados/{id}/abonos` in order → `POST /api/ventas`; one literal-method HTTP node and one IF gate per stage), with `422` into held rows and any other failure into "flag off, then throw"; verify against the app that the order is apartado, then its abonos, then sales.
- [ ] 4.4 Add the report (formatter node, Send Email to `$env.TIENDA_EMAIL_AVISOS`, form end page) and set flow 08 as the Error Workflow; verify an unset `TIENDA_EMAIL_AVISOS` throws.

## 5. Tests with real data

- [x] 5.1 On a clean copy of the stack (a second compose project or a fresh `tienda_data` volume, never the team's data), run the form with the two CSVs; verify 7 apartados, 3 follow-up abonos and 6 sales exist in the app with their original `fecha` and the `fecha_limite` the app computed, and that the three `forma_pago` come from the sales lines.
- [x] 5.2 Verify in the report email and in the app that Lucía Gómez's two rows are held with their reasons, the three repeated deposit lines and the total line create nothing, and the amounts match `GET /api/apartados/resumen` and the daily totals.
- [x] 5.3 Run the form again with the same files; verify no row is created, the report says everything was already loaded, and the app's counts are unchanged.
- [x] 5.4 Delete rows from a loaded throwaway app (an abono, a whole apartado with its abono, a sale) and run again; verify only the missing rows are created and no duplicate appears.
- [ ] 5.5 With a real flow 01/02 published, run the migration and verify no customer or shop email is sent by those flows during the run, the router executions show the events ignored, and the flag is off afterwards; then force a failure (wrong API key) and verify the flag is off, flow 08 alerts and nothing is reported as held.
- [x] 5.6 Send a real-looking `abono.registrado` after the run and verify it is routed normally again.

## 6. Export and docs

- [x] 6.1 Export `workflows/10-excel-migration.json` and the updated `workflows/00-event-router.json`; verify neither contains credentials, `localhost`, real addresses or IDs.
- [x] 6.2 Document in `docs/README-changes.md` the form, the files expected (columns), the Data Table `migration_state`, the credentials and variables used (names only), how to read the report, that the shop should be closed during the run, and that the app cannot undo a load; verify the text matches the tested flow.
- [ ] 6.3 Save screenshots of the report email, the app after the load and the router showing ignored events in `docs/evidence/10-excel-migration/`, and add the entry to `docs/ai-log.md`; verify the entry says no data left n8n except the app calls and the report email.
- [ ] 6.4 Sync the issue with `python scripts/sync_issue_tasks.py 10`, open the PR to `dev` with `Closes #10` and verify the other teammate reviewed it.

## Workflow follow-up

- Add #10 to the owner table of "Branching model and issues per flow" in `docs/decisions-clarify.md`.
- Rebase on `dev` before the PR in case HU-03 or HU-07 touch flow 00.
- Archive this change after the PR is merged.
