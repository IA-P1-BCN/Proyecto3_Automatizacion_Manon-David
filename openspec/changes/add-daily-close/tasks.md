# Tasks

## 1. Credentials and inputs

- [ ] 1.1 Create the Header Auth credential `X-API-Key` and verify `GET /api/ventas?desde=2026-10-01&hasta=2026-10-01` returns items from inside n8n.
- [ ] 1.2 Create the Google Sheet with the agreed header row and the Google Sheets credential; verify a test row can be written and updated by `fecha`.
- [ ] 1.3 Build the Schedule Trigger (23:55, Europe/Madrid) and the Manual Trigger with a date field feeding one Set node that outputs `fecha`; verify both produce the right date format `YYYY-MM-DD`.

## 2. Calculation

- [ ] 2.1 Fetch sales and deposits for `fecha` and verify both calls return the app's records for that date, including the case of zero records.
- [ ] 2.2 Write the Code node (cent arithmetic per method and per source, "otros" bucket, always one output item) and verify it against the cases in `workflows/tests/05-daily-close.md`: mixed day, decimal case (0.10 + 0.20 + 4.50), empty day, unknown method.
- [ ] 2.3 Compare the output to the totals obtained directly from the app (`GET /api/ventas` / `abonos` or its Excel download) for three seeded dates and verify they are identical.

## 3. Outputs

- [ ] 3.1 Add the Send Email node with the Spanish summary (date, per-method and overall totals, "no movements" variant, Bizum-includes-transfers note); verify the email for a busy day and an empty day.
- [ ] 3.2 Add the Google Sheets *append or update* on `fecha`; verify one row per date and that running the same date twice leaves one row.
- [ ] 3.3 Run both outputs in parallel and verify that a deliberately wrong sheet ID still sends the email and then fails the execution.

## 4. End-to-end checks

- [ ] 4.1 Run the manual trigger for a past date and verify the summary and the row are for that date only and no other row changes.
- [ ] 4.2 Create a reservation (initial deposit) and a sale in the app, run the close, and verify both are counted.
- [ ] 4.3 Stop the app container, run the close, and verify flow 08 alerts; restart the app.
- [ ] 4.4 Let the schedule fire once at 23:55 (or temporarily set a near time) and verify the email arrives; restore 23:55.

## 5. Export and docs

- [ ] 5.1 Set flow 08 as the *Error Workflow*, export to `workflows/05-daily-close.json`, and verify no credentials, sheet ID or real address are in it.
- [ ] 5.2 Add the credentials/variables (SMTP/IMAP mailbox, X-API-Key, Google Sheets, sheet ID, `TIENDA_EMAIL_AVISOS`) to the README, plus the note about running the manual close and checking the history for gaps.
- [ ] 5.3 Save screenshots of an email and of the sheet in `docs/evidence/05-daily-close/`, log prompts and agent corrections in `docs/ai-log.md`, open the PR and verify the other teammate reviewed it.

## Workflow follow-up

- Archive this change after the PR is merged.
