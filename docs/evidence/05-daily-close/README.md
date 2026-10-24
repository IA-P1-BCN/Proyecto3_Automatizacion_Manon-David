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

## Pending real n8n checks

Follow `workflows/tests/05-daily-close.md`. Empty-day integration, same-ID confirmation, ETag rejection, output-failure isolation, flow 08 notification from this flow and scheduled execution are **not yet verified**. The user reported forgetting to publish the workflow for the first night; no nightly execution is inferred. Local tests now total 29 (17 flow 05 + 12 flow 08). The requested append/insertion row order is still pending: this version sorts dates ascending. The review PR must not automatically close #4 until the remaining acceptance work is completed.
