# Flow 05 evidence — issue #4

## Observed local checks (2026-10-23)

- `node --test workflows/code/05-daily-close.test.js workflows/code/08-sanitise-error.test.js`: 27 tests passed (15 flow 05 + 12 unchanged flow 08).
- Generated inactive workflow imported successfully with the n8n CLI in a disposable container, `--network none`, no user's volumes mounted. This does not prove node execution, credential assignment, email, cloud writing or scheduling.
- Read-only local app queries, with the API key read internally from the shop container environment and never printed, returned existing movements. Only id/date/amount/method were passed to the calculation; no customer data was recorded.
- Independently summed Python Decimal amounts were compared with the actual generated-flow calculation source:

| Date | Combined cents | Result |
| --- | --- | --- |
| 2026-10-23 | 21365 | sales/deposits/combined match |
| 2026-10-22 | 27390 | sales/deposits/combined match |
| 2026-10-21 | 5690 | sales/deposits/combined match |

These values describe existing local demonstration data at the time of inspection, not fixed acceptance fixtures or actual business income. Later app mutations can legitimately change them.

## User-reported real n8n checks (2026-10-23–24)

- Shop Header Auth worked once its header Name was corrected to `X-API-Key`; a running-container/configuration key mismatch was resolved first. No keys are recorded here.
- SMTP delivered the closing summary successfully. `$env` values were inaccessible to UI preview but resolved at execution time.
- The first execution created `basedatos.csv` in the selected folder. A subsequent execution downloaded it with HTTP 200 and returned CSV text in **`data`**, not `body`. The Code node was corrected accordingly and the user confirmed the update succeeded.
- Spreadsheet screenshot showed dates 2026-10-22 and 2026-10-23 with combined totals 273.90 and 213.65. The CSV needed semicolon import settings; the initial viewer incorrectly split decimal commas.
- The user repeated existing dates and confirmed that no extra rows were created; this specific no-duplicate test was accepted. A changed-amount update and preservation of the same cloud file ID were not independently verified.
- These observations are reported through conversation/screenshots, not browser/API checks performed by the agent. No screenshot files have been fabricated or saved without an actual source file.

## Empty-day manual integration (2026-10-30)

Closing date: **2026-10-29**. This is a local demonstration, not a scheduled
production run or a claim that every flow 05 integration case has passed.

- **Agent-observed input:** read-only requests to the local shop API at
  `http://localhost:8001` returned empty lists for both
  `GET /api/ventas?desde=2026-10-29&hasta=2026-10-29` and
  `GET /api/abonos?desde=2026-10-29&hasta=2026-10-29`: zero sales and zero payments.
- **User-reported execution:** David ran flow 05 manually for that date and
  intentionally requested the summary email. He supplied its text: title
  "Cierre de caja del 29/10/2026", "No hubo movimientos.", and EUR 0.00 for
  sales, payments and combined totals under efectivo, tarjeta, bizum and otros.
  Overall direct sales, payments and collected totals are also EUR 0.00.
- **User-reported persistence:** after being asked to check `basedatos.csv` in
  kDrive for that date, David confirmed it was saved correctly. The agent did
  not independently download the CSV or inspect the execution in n8n.
- **Result:** the empty-day manual case is verified through API input checks
  and user-confirmed email/history outputs. No screenshot or CSV attachment
  was supplied; none is fabricated. The conversation is the output evidence.
- **Boundary:** sending the email was intentional, not an error or a test of
  the default `send_email=false`. This does not verify automatic scheduling,
  same-file-ID replacement, ETag rejection, row order or failure isolation.

## Other real n8n checks not established by the empty-day run

Follow `workflows/tests/05-daily-close.md`. Same-ID confirmation, ETag rejection, output-failure isolation, flow 08 notification from this flow and scheduled execution are **not verified by the evidence recorded here**. The user previously reported forgetting to publish the workflow for the first night; no nightly execution is inferred. Local tests total 29 (17 flow 05 + 12 flow 08). The requested append/insertion row order is still pending in this version, which sorts dates ascending. Issue #4 was observed already closed / Done on 2026-10-30; this documentation follow-up does not reopen it or claim the remaining checks passed.
