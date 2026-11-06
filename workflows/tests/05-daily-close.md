# Daily close verification — issue #4

Run `node workflows/code/build-05-daily-close.js` then `node --test workflows/code/05-daily-close.test.js`.

## Local contract cases

| Case | Input | Expected |
| --- | --- | --- |
| Mixed | sales 6.50 cash + 20 card; deposits 10 cash + 5 Bizum | total 41.50; sales 26.50; deposits 15.00 |
| Decimals | sales 0.10 + 0.20 + 4.50 | exactly 4.80 |
| Empty | two empty API lists | one zero closing; Spanish no-movements message |
| Unknown method | sale 12 under unknown method | 12 in ventas_otros and total |
| Initial payment | one deposit record | counted once, not added as sale |
| Rerun | same date twice with corrected movements | one updated row; other dates unchanged |
| CSV | decimal amounts | UTF-8 BOM, `;`, decimal comma, CRLF |
| Invalid data | duplicate IDs/dates, bad decimals, inconsistent CSV | fail before storage replacement |
| Manual | selected date, send_email false | same totals, update history, no SMTP |
| Incomplete discovery | more pages remain / API error | fail, never create a replacement file |
| Existing file | exact name, valid ID + ETag | update existing ID using If-Match |

## Real integration checklist (not implied by unit tests)

- [x] Empty-day manual case, closing date 2026-10-29 (tested 2026-10-30): agent's read-only API queries returned zero sales and zero payments; David intentionally requested and received the Spanish no-movements summary with all totals zero, then confirmed `basedatos.csv` was saved correctly in kDrive. Email text supplied in conversation; CSV save user-reported, not independently downloaded by the agent. Details: `docs/evidence/05-daily-close/README.md`.

The other checklist items below retain their existing status. This one manual
case does not complete the three-date comparison, default-no-email check,
same-ID/ETag tests or scheduled execution.

- [ ] Import inactive workflow in local n8n, select local credentials and Error Workflow 08.
- [ ] Confirm the Header Auth shop key works from the HTTP nodes.
- [ ] Confirm drive-only token can list, download and upload in the test folder.
- [ ] First run creates `basedatos.csv`, never changes `registro.txt`.
- [ ] Capture new file ID; rerun a date with corrected records: same ID, one row/date, no renamed file.
- [ ] Compare three dates against app API totals (including an empty day).
- [ ] Manual default sends no email; opt-in sends Spanish summary to controlled test recipient.
- [ ] Invalid SMTP credential still lets history save, then execution fails.
- [ ] Invalid storage permission still attempts requested summary email, then reports failure.
- [ ] Modify the file after listing: If-Match blocks replacement; rerun rereads latest file.
- [ ] Error Workflow 08 receives a failure from a published/automatic test (manual executions do not dispatch Error Trigger).
- [ ] Authorized publication: observe schedule fire, confirm date/time and email; restore 23:55 after temporary test.

Store safe screenshots and results under `docs/evidence/05-daily-close/`. Do not record tokens, full execution payloads with secrets, or mailbox passwords. A successful import is not a successful remote upload or scheduled close.
