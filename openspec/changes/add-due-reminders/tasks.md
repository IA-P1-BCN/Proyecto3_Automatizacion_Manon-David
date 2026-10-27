# Tasks

## 1. Prerequisites and decisions

- [x] 1.1 Confirm with David that the kDrive folder and credential of HU-04 may also hold `avisos.csv`, and that flow 05 works on `dev` (`docs/daily-close-setup.md`); verify `KDRIVE_DRIVE_ID` and `KDRIVE_DIRECTORY_ID` reach the n8n container with `docker compose config`.
- [x] 1.2 Record in `docs/decisions-clarify.md` the reminder decisions (09:00 Madrid, exact 7 and 1 day, `avisos.csv` in kDrive, `sin_email` mark, Medium level taken up); verify none of them contradicts an existing decision.

## 2. Pure logic

- [x] 2.1 Write the pure function that, given the reservations, the run date and the sent-records, returns the reminders to send and the shop alerts, with unit tests in `workflows/code/` for: 7 days, 1 day, 6 and 8 days, today, yesterday, not `activo`, already sent, same reservation at both thresholds, empty email, email without `@`, month and year change (`2026-12-28` + 7), leap day; verify no test touches `pendiente` or `abonado`.
- [x] 2.2 Write the Spanish formatter (subject and body for 7 days and 1 day, shop alert, optional size line, `dd/mm/yyyy`, comma decimals) with unit tests; verify amounts are only formatted from the given fields.
- [x] 2.3 Write the CSV helpers for `avisos.csv` (parse, validate columns and unique key, append rows, semicolon format, UTF-8 BOM like `basedatos.csv`) with unit tests for missing file, wrong header and duplicate key; verify a wrong header throws.

## 3. Build the flow

- [x] 3.1 Create the generator `workflows/code/build-06-due-reminders.js` and generate `06 Due Date Reminders`: Schedule Trigger `0 9 * * *` (Europe/Madrid) and Manual Trigger → `Choose Date` → `GET /api/apartados?estado=activo` with the shop Header Auth → read `avisos.csv`; verify the JSON imports in a throwaway n8n and is inactive.
- [x] 3.2 Add the decision step (Code node from 2.1) and the sending branches (Send Email to the customer, Send Email to `TIENDA_EMAIL_AVISOS` for missing email), with the error output on each Send Email; verify with a stub run that the right emails are produced for a mixed set.
- [x] 3.3 Add the save step (append rows for accepted emails only, `If-Match` with the ETag, create the file when absent) and a final `Verify Result` that throws when any send failed; verify the order read → send → save.
- [x] 3.4 Set flow 08 as the Error Workflow of flow 06 and verify the app being unreachable, a wrong CSV header and a bounced email each trigger the alert and send no reminder twice.

## 4. Tests with real data

- [x] 4.1 Save sample reservations and expected results in `workflows/tests/06-due-reminders.md` (7 days, 1 day, other days, not active, no email, malformed email, no size, already sent); verify every spec scenario is covered.
- [x] 4.2 With a reservation of yours (own email), run the manual trigger with `fecha` set to 7 days before its deadline; verify exactly one Spanish email with the app's figures and one new row in `avisos.csv`.
- [x] 4.3 Run the same date again; verify no email is sent and no row is added. Then run with `fecha` one day before the deadline; verify the 1-day email and a second row.
- [x] 4.4 Run with a reservation without email (demo data flow 90 scenario or a hand-made one); verify one shop alert, a `sin_email` row, and no second alert on re-run.
- [x] 4.5 Break the SMTP credential temporarily for one run; verify the execution fails, flow 08 alerts, no row is written for the failed email, and the next run (credential restored) sends it.
- [x] 4.6 Publish the flow only for the test (with permission) and verify the 09:00 schedule fires once in Executions, then unpublish; verify the times shown are Madrid time.

## 5. Export and docs

- [ ] 5.1 Export `workflows/06-due-reminders.json` and verify it contains no credentials, `localhost`, real addresses or kDrive IDs.
- [x] 5.2 Document in `docs/README-changes.md` the credentials and variables used (names only), the `avisos.csv` file and columns, the 09:00 schedule, the manual run with a date, and that a day with n8n down is not caught up; verify the text matches the tested flow.
- [ ] 5.3 Document the test results in `workflows/tests/` and add the entry to `docs/ai-log.md`; verify the entry says no data left n8n except the app and kDrive calls.
- [ ] 5.4 Sync the issue with `python scripts/sync_issue_tasks.py 6`, open the PR to `dev` with `Closes #6` and verify the other teammate reviewed it.

## Workflow follow-up

- HU-07 (overdue reservations and voucher email) gets its own change; reuse the date helpers from task 2.1.
- Archive this change after the PR is merged.
