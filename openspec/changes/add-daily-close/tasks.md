# Tasks

## 1. Credentials and inputs

- [x] 1.1 Associate the shop Header Auth credential with header Name `X-API-Key`; user confirmed Fetch Sales works in local n8n after correcting the header and runtime key mismatch. Exact example-date query is not claimed.
- [ ] 1.2 Associate the drive-scoped Header Auth credential (`token_n8n`) and verify create, download and replacement of `basedatos.csv` in the configured folder; never touch `registro.txt`.
- [x] 1.3 Generate the Schedule Trigger (23:55, Europe/Madrid), Manual Trigger, date field and send_email boolean; test date validation and manual-email defaults locally.
- [ ] 1.4 Execute both trigger paths in local n8n and verify the chosen Madrid date.

## 2. Calculation

- [ ] 2.1 Fetch sales and deposits for `fecha` and verify both calls return the app's records for that date, including the case of zero records.
- [x] 2.2 Write the Code node (cent arithmetic per method and per source, "otros" bucket, always one output item) and verify it locally against the cases in `workflows/tests/05-daily-close.md`: mixed day, decimal case (0.10 + 0.20 + 4.50), empty day, unknown method.
- [x] 2.3 Compare the calculation output to independently summed live local app API records for three seeded dates; totals identical. This verifies the shared calculation code, not a complete n8n execution.

## 3. Outputs

- [ ] 3.1 Add the Send Email node with the Spanish summary (date, per-method and overall totals, "no movements" variant, Bizum-includes-transfers note); verify the email for a busy day and an empty day.
- [x] 3.2 Implement strict UTF-8 semicolon/decimal-comma CSV upsert by `fecha`; verify local reruns preserve other dates and one row per date.
- [ ] 3.3 Verify actual kDrive same-ID updates, ETag concurrency rejection and create-only-once behavior using local credentials.
- [ ] 3.4 Verify output isolation: denied kDrive save still attempts requested email; SMTP failure still permits history save and then fails the execution.
- [x] 3.5 User-reported manual verification: summary email delivered, CSV created and a second-date update succeeded after the `data` response-field correction; repeated dates did not add duplicate rows. This does not verify remaining failure/schedule/empty-day cases.
- [ ] 3.6 Apply the user's insertion-order requirement: append new dates at the end and replace existing dates in place; update source, generator, tests, design and local workflow coherently. Current sorting remains pending final acceptance.

## 4. End-to-end checks

- [ ] 4.1 Run the manual trigger for a past date, verify no other row changes, email is skipped by default and explicit send_email resends it.
- [ ] 4.2 Create a reservation (initial deposit) and a sale in the app, run the close, and verify both are counted.
- [ ] 4.3 Stop the app container, run the close, and verify flow 08 alerts; restart the app.
- [ ] 4.4 Let the schedule fire once at 23:55 (or temporarily set a near time) and verify the email arrives; restore 23:55.

## 5. Export and docs

- [x] 5.1 Generate the inactive credential-free `workflows/05-daily-close.json` and verify import in an isolated disposable n8n container, not the user's instance.
- [ ] 5.2 Associate local credentials and flow 08 as Error Workflow; review/export the locally tested configuration without secrets or local references.
- [x] 5.3 Document SMTP, X-API-Key, kDrive token/IDs, CSV recovery and late-movement boundaries in `docs/daily-close-setup.md` without rewriting the supplied README assignment.
- [ ] 5.4 Save safe evidence under `docs/evidence/05-daily-close/`, complete the activity log, obtain commit/push/PR permission and request teammate review. Local implementation is not remote acceptance.

## Workflow follow-up

- Archive this change after the PR is merged.
