# Monthly report setup — HU-08 / #8

Canonical workflow: `workflows/07-monthly-report.json`, named **07 Monthly Report**. Only this new draft is imported; do not reimport, rename, rearrange or change existing workflows.

## Business meaning

Day 1 at **09:00 Europe/Madrid** reports the previous complete calendar month. Sales and deposits are separate, with cash/card/Bizum totals; Bizum includes transfers. Initial payments count once as deposits. Collections are **not profit**.

- New reservations: API creation `fecha` in the month.
- Settled reservations: currently `liquidado`, with their latest dated payment in the month. This is an accounting rule, not a stored state-transition timestamp; imported payments belong to their original business date.
- Expired reservations: currently `vencido`, with voucher date in the month, not the payment deadline.
- Pending: sum the API's current `pendiente` of `activo` reservations, labelled with consultation time. This is **not historical month-end debt**. No individual balance is recomputed.

Queries are sequential, not one atomic app snapshot; inconsistent required relationships fail rather than producing guessed figures. Late historical imports can change earlier reports.

## Required local associations (names only)

| Where | Field | Value / action | Keep unchanged | Effect |
| --- | --- | --- | --- | --- |
| n8n at David's `http://localhost:5680` | Import from File | `workflows/07-monthly-report.json` | All other workflows | Creates this draft; does not publish or execute |
| Five `Fetch …` HTTP nodes | Credential for Header Auth | Existing shop credential, header name `X-API-Key`, not Bearer | GET URLs `http://tienda:8000/api/...`, full JSON response and no pagination parameters | Reads app records only |
| `Send Monthly Report` | SMTP credential | Existing Infomaniak SMTP credential | Subject/HTML expressions; retry off | Sends only if the delivery gate allows it |
| Workflow Settings | Error Workflow | Your existing `08 Error Workflow` | Europe/Madrid timezone | Real failed automatic executions can alert via existing flow 08 |
| Existing n8n environment | `TIENDA_EMAIL_FROM`, `TIENDA_EMAIL_AVISOS` | Existing configured test mailbox/sender; no values in Git | Existing Docker services and credentials | Sets sender and one owner/test recipient |

No new paid Variables, Groq key, kDrive credential or cloud file is required. The shop key and n8n management key are unrelated. n8n must reach the shop at **tienda:8000**, not host port 8001. The n8n host port 5680 is not a container-to-container endpoint.

### Current David-local preparation (27 October 2026)

The agent already imported **07 Monthly Report** as a new inactive draft and associated the existing shop Header Auth, Infomaniak SMTP and local Error Workflow. **Do not import another copy or reassociate these again unless the editor shows a missing association.** Its manual defaults remain email/PDF false. No other pre-existing workflow was modified.

**TEST HU08 Read-only Preview** is a separate inactive CLI verification copy: September input, genuine API GETs, no schedule trigger and SMTP physically replaced with a prohibiting error node. It successfully returned the independently verified aggregates, but it is not the canonical workflow and cannot be used to send the test email. Keep the genuine **07 Monthly Report** for editor review and delivery.

After explicit user authorization, **TEST HU08 Single Table Email** sent one September table report through real SMTP (one recipient accepted, none rejected). Its delivery flag was restored to false and it remains inactive. David confirmed reception, correct figures and Spanish accents. **Do not repeat this completed email test.** The agent's CLI execution is not an editor test.

## First safe preview

**Effect: app GET requests only. No email, payments, sales, expiry or other business writes.**

1. In **07 Monthly Report → Choose Month and Delivery**, set the string field `month` to a finished `YYYY-MM` month (for example `2026-09` when running in October 2026). The default expression selects the previous month.
2. Keep boolean `send_email = false` and `include_pdf = false`. Keep `mode = manual`, the five GET nodes and all connections unchanged.
3. Explicitly select **Manual Report Preview** in the execution-start selector before pressing Execute workflow. Do not assume the general button chooses the manual branch. If that selector is not visible, stop and inspect the editor controls rather than executing the schedule entry. Inspect **Monthly Preview Result**: `email_sent=false`, `report.totals`, `report.counts`, `report.pending_cents`, and the `html` string. Monetary numeric fields are cents; the HTML displays EUR.
4. Compare with independent GET-only totals using `python3 scripts/verify-monthly-report.py 2026-09` from the repository root, only when this is the intended David-local shop on port 8001. The script reads the running shop's API key internally without printing it; outputs aggregates only.

Do not try the current/future month: it is rejected. n8n's clock, not the selected report month, determines the current pending snapshot.

## One controlled real email, after permission

**Effect: the same app reads plus one report email to the existing `TIENDA_EMAIL_AVISOS` recipient. It does not write financial records.**

Confirm the recipient is a controlled test inbox before proceeding. In **Choose Month and Delivery**, change only boolean `send_email` to `true`, keep the verified `month`, `mode=manual`, `include_pdf=false`, credentials, layout and connections unchanged. Execute from **Manual Report Preview**. Expected: exactly one HTML-table report and **Record Monthly Delivery** returns `email_sent=true`. Confirm actual inbox reception and correct figures, then restore `send_email=false`.

An SMTP success/message ID is not proof of inbox delivery. If delivery outcome is uncertain, inspect the execution and inbox before manually repeating. Do not enable SMTP automatic retries. Manual editor execution errors do not prove automatic Error Workflow dispatch.

## Schedule and repeats

The inactive export includes **Monthly Day 1 at 09:00**, cron `0 9 1 * *`, workflow timezone Europe/Madrid. Publication needs explicit permission; importing or testing does not publish it. Missed executions are recovered with an explicit manual closed-month report, not automatic catch-up.

**Editor-start safety fix:** David observed that the general Execute workflow button selected the scheduled entry, sending an unintended extra table-only email despite manual preview settings. That is now guarded: the scheduled branch requires the real n8n execution mode `trigger`, otherwise Prepare Monthly Period stops before API reads or SMTP. Manual Trigger is also listed first as a client-default hint; the runtime guard is the actual protection. After loading the updated draft, explicitly choose Manual Report Preview; never bypass or edit the internal `scheduled_execution` expression. The successful guard test used the wrong CLI schedule entry and observed failure before GETs/SMTP; the real manual/PDF preview still succeeded with SMTP physically prohibited.

Normal automatic repeat delivery is suppressed using the persisted successful period marker. Manual `send_email=true` deliberately permits a resend. n8n does not reliably persist workflow static data for manual tests, so an editor rerun is not proof of automatic deduplication. Parallel executions or a crash after SMTP acceptance and before state persistence remain a duplicate-delivery risk. This is not exactly-once SMTP.

## Optional local PDF — implemented and preview-tested

The trial succeeded in **6 minutes 29 seconds**, including image download, synthetic conversion, real n8n PDF preview and failure-path verification (2026-10-27T21:36:38Z through 21:43:07Z). The added `monthly-pdf` service uses **Gotenberg 8.39.0 Chromium**, no public host port, no credentials or business-data volume, disabled JavaScript/download-from/webhooks and blocked public/private Chromium HTTP fetches. The n8n request to this local converter is not a financial API write. Observed memory after testing was about 148 MiB (768 MiB limit), not a usage guarantee.

The base `docker-compose.yml`, shop and n8n are unchanged. To reproduce the optional service on the teammate's own stack:

```sh
docker compose -f docker-compose.yml -f docker-compose.monthly-pdf.yml up -d --no-deps monthly-pdf
```

If the existing stack uses a custom Compose project name, retain that same `-p YOUR_EXISTING_PROJECT` on this command so n8n and the converter share its network. Do not create another shop/n8n stack. Stop only the optional service if needed:

```sh
docker compose -f docker-compose.yml -f docker-compose.monthly-pdf.yml stop monthly-pdf
```

In **07 Monthly Report → Choose Month and Delivery**, set only boolean `include_pdf=true`, keep `send_email=false`, the verified month, credentials, positions and connections unchanged, and execute **Manual Report Preview**. Expected: **Monthly Preview Result → Binary → pdf** contains `paso-firme-monthly-report-YYYY-MM.pdf`; `pdf_attached=true`, `pdf_warning=false`, `email_sent=false`. This generates a local PDF but sends no email or business records. Restore `include_pdf=false` after the preview unless deliberately testing it again.

For an **explicitly authorized** email with PDF, use the same input with `send_email=true`. There is only one **Send Monthly Report** node: its **Options → File Attachments** expression attaches the validated `pdf` field. Do not add a second SMTP node or change the attachment expression. Restore both manual flags false afterward.

David separately authorized one real PDF email; **TEST HU08 Single PDF Email** sent it through SMTP with one accepted recipient, zero rejected and the validated `paso-firme-monthly-report-2026-09.pdf` attached. David confirmed reception and that the PDF opens correctly. Its manual flags were restored false and it remains inactive. **Do not repeat this completed email/PDF test.** No future resend or publication is authorized by that single test permission.

Scheduled PDF is separately controlled by **Scheduled Report Input → include_pdf**, default false. If PDF is wanted on automatic reports after testing, change that boolean to true; do not change the cron/timezone or publish without permission. The exported baseline keeps both manual and scheduled PDF false for safe transfer.

If conversion fails, **Validate PDF Result** produces the same full table with a Spanish missing-PDF warning, `pdf_attached=false`, `pdf_warning=true`, and no attachment. It still reaches the single email gate. This handled warning does not retry SMTP or undo a successful table delivery marker. Actual SMTP failure still fails the run. Validity checks inspect status, MIME type, PDF header/EOF and a 5 MB output limit; they are not a general-purpose PDF security scanner.

The converter receives only rendered aggregate report HTML, not shop API keys, customer contacts or raw API lists. Styles are inline and no external fonts/images are required. Do not replace this with a PDF SaaS as an incidental workaround.

Two additional inactive copies, **TEST HU08 PDF success** and **TEST HU08 PDF fallback**, ran through real API/Code/IF/HTTP nodes with SMTP physically prohibited. They prove local conversion and safe warning fallback, not actual PDF delivery. The assigned canonical draft was updated only at PDF touchpoints/new nodes; previous node IDs, positions and credential associations were preserved. Other workflows were compared unchanged.

## Checks and rollback

Run `node --test workflows/code/07-monthly-report.test.js workflows/code/07-monthly-workflow.test.js workflows/code/07-monthly-pdf.test.js` and `openspec validate add-monthly-report --strict`. These are local/static checks, not real SMTP or schedule evidence. See `workflows/tests/07-monthly-report.md` for observed results.

Rollback: leave only this new workflow unpublished. Never reset Docker volumes, delete existing test movements, overwrite live HU-03 or change other workflows to test HU-08. Export the tested draft without credentials, pinned data or instance bindings; preserve any manually arranged positions and connections. The generator requires explicit `--write` and is not invoked by tests.
