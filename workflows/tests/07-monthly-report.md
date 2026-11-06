# Flow 07 test contract

Issue #8 — HU-08 · Informe mensual. Run `node --test workflows/code/07-monthly-report.test.js` from the repository root.

## Expected cases

| Case | Expected result |
| --- | --- |
| Scheduled 1 November 2026 at 09:00 Madrid | 1–31 October inclusive; no November movements |
| January rollover, leap February, both DST changes | Calendar month dates, no UTC/day shifting |
| Invalid/current/future month | Reject without email |
| Sales cash 6.50, card 20; deposits cash 10, Bizum 5 | Sales 26.50; deposits 15; combined 41.50; cash 16.50/card 20/Bizum 5 |
| EUR 0.10 + 0.20 | Exactly EUR 0.30 |
| Initial payment or fully paid at creation | Initial counts once as deposit; full payment also counts as new and settled |
| September final payment imported in October | September settlement, not October; no invented transition timestamp |
| Deadline 30 September, voucher 1 October | Expired in October, not September |
| Active pending 14 + 40; expired pending 30 | Current active pending 54, not 84; not historical month-end debt |
| Empty month/app | Zero collections, explicit no-movements text; retain any current active debt |
| More than 25 rows | Complete results; compare X-Total-Count where available |
| Unknown payment method | Visible `Otros métodos`, not omitted |
| Duplicate IDs, invalid amounts/dates, missing voucher/payment date, truncated list | Fail instead of inventing complete figures |
| Explicit manual preview | No mail, business writes, AI calls or cloud files |
| Confirmed scheduled send repeated | Skip normal duplicate; explicit manual resend remains intentional |
| Optional converter failure, if delivered | Attempt one table email with warning, no attachment or duplicate report |

## Evidence boundaries

- 2026-10-27: 14 pure JavaScript tests passed for periods, validation, arithmetic, attribution, Spanish HTML and mocked delivery state. This is not an SMTP delivery or n8n integration result.
- 2026-10-27: five additional generator/embedded-node tests passed (19 monthly tests total). Canonical JSON checked inactive, credential-free, correct timezone/cron, GET-only shop requests, full-response envelopes, explicit email gate and no SMTP retry.
- Disposable n8n 2.32.6 with no network or user volumes: imported temporary copies and executed empty preview (one zero-total output, no SMTP stage), mixed input (4150 cents, one mocked SMTP success) and HTTP-503 response (execution error, no SMTP stage). API and SMTP nodes were mocked in these copies. The actual Code/Set/IF graph ran; no real email was sent.
- Independent real API check: `python3 scripts/verify-monthly-report.py 2026-09` compared the JavaScript calculation with Python Decimal over the same five GET responses. PASS: direct sales 401775 cents, deposits 28400, total 430175; new 5, settled 2, expired 0; current active pending 61515 across 18 active reservations. Per-method sums also matched. These are current David-local aggregates, not portable expected fixture values.
- Imported only two new inactive local drafts: **07 Monthly Report** (canonical graph, existing shop/SMTP associations and local Error Workflow selection) and **TEST HU08 Read-only Preview** (manual-only September input, SMTP replaced by a prohibiting error node). CLI-executed the read-only copy using actual HTTP Request nodes/credential: same totals/counts as the independent check, ended at Monthly Preview Result with `email_sent=false`. All 11 previously existing workflows' names, active flags, nodes, connections and settings were independently compared unchanged afterward.
- With David's explicit single-email authorization, executed a new manual-only **TEST HU08 Single Table Email** copy through CLI using real API and existing Infomaniak SMTP. One Send Monthly Report execution, a returned SMTP message ID, one accepted recipient and zero rejected recipients; report month September, 401775/28400/430175 cents. No PDF, workflow publication or business writes. Restored its `send_email=false` afterward and independently verified every prior workflow unchanged. This is real SMTP acceptance, not inbox confirmation or an editor execution.
- David confirmed actual inbox reception, correct figures and correctly displayed Spanish accents. Editor execution itself remains unverified; no automatic schedule or HU-08 Error Workflow dispatch proof is claimed.
- Full regression run: all 212 repository JavaScript tests passed, including the 19 monthly tests; strict OpenSpec validation, Python syntax and diff whitespace checks passed.
- PDF trial: succeeded from 21:36:38Z to 21:43:07Z (6m29s), under the 20-minute limit. Gotenberg 8.39.0 Chromium generated a 25,606-byte synthetic report; parsed text and visual inspection showed one readable A4 page, correct accents/EUR and matching synthetic figures. A main URL conversion to the private shop address was blocked with HTTP 403. The shop/n8n start times precede the trial; neither was restarted, and the converter publishes no host ports.
- Real n8n PDF graph: **TEST HU08 PDF success**, send false and SMTP physically prohibited, used actual five API GETs, HTML preparation, multipart HTTP conversion and binary validation; produced a 26,363-byte one-page September PDF with matching 4017.75/284/4301.75/615.15 figures and counts 5/2/0. Parsed text and page image inspected. **TEST HU08 PDF fallback** used an intentionally unreachable converter port, ended successfully with the full table, a Spanish missing-PDF warning and no binary attachment. Neither reached the SMTP node or created business records.
- Optional converter and PDF fallback have 21 monthly unit/embedded-node checks. The separately authorized real PDF email was subsequently received and opened successfully, as confirmed by David. Existing table-only inbox confirmation remains valid and must not be repeated unnecessarily.
- Final PDF-version regression run: **214/214 repository JavaScript tests passed**, including 21 monthly tests; strict OpenSpec validation, Python syntax, safe-default/no-credential/no-business-write checks and diff whitespace checks passed. A fresh export of the inactive local canonical draft matched repository node IDs/positions/code/parameters/connections exactly after ignoring only per-instance credential bindings and workflow metadata.
- After separate explicit authorization, **TEST HU08 Single PDF Email** executed once with actual API, local converter and Infomaniak SMTP. One SMTP attempt, one accepted recipient/zero rejected, `pdf_attached=true`, `pdf_warning=false`, filename `paso-firme-monthly-report-2026-09.pdf`; totals match the completed baseline. Both input flags restored false afterward, the copy remains inactive, and all prior workflows were independently checked unchanged. David separately confirmed the email arrived perfectly and the PDF opened correctly. This is actual inbox/opening confirmation, not merely SMTP acceptance.

## Manual-editor verification

The agent has no browser/editor interaction tool and its own executions were CLI-driven. David subsequently ran the corrected canonical draft in the editor and explicitly confirmed that no email was sent and the generated PDF was downloadable. This is user-confirmed editor evidence, distinct from the agent's CLI runs. Task 2.5 is now complete; the confirmed SMTP/inbox tests need no repetition.

No scheduled day-1 execution, live scheduled static-data persistence, or automatic HU-08 Error Workflow dispatch has been executed. Their configuration and mocked/pure checks are documented separately. The workflow remains unpublished and no automatic unattended operation is claimed.

## Editor-trigger regression and fix

David attempted the editor test but the general Execute workflow button started Monthly Day 1 at 09:00, not the manual branch. He reported an additional table-only email; scheduled PDF was false. This does not verify the requested manual PDF preview. The previous guidance was insufficient and manual-field gates alone did not protect the other entry.

Added a runtime marker (`scheduled_execution` derived from actual n8n `$mode === 'trigger'`) and a fail-closed guard before API reads. Listed Manual Report Preview first without changing canvas positions, IDs, credential references or connections. Two new local unit/embedded checks cover the guard (23 monthly checks). Actual n8n temporary copies with SMTP physically prohibited verified: wrong scheduled CLI start stops at Prepare Monthly Period before GETs/SMTP; the default manual start still completes real API/PDF preview with email false and a valid PDF. No further email was sent in these regression checks. All unrelated workflows remained unchanged.

David then confirmed the corrected editor preview worked as intended: no email, PDF generated and downloaded. Latest full regression: **216/216 JavaScript tests passed**, strict OpenSpec validation passed. This does not claim actual scheduled execution, live concurrent duplicate suppression, or automatic HU-08 error dispatch.
- Local HU-03/demo fixture movements remain in API totals; never remove data to make expected numbers match.

## Delivery limits

There is no application settlement timestamp. Counts use the accepted last-payment business-date rule. Imports can alter earlier reports. Pending is current at consultation, not a reconstructed month-end snapshot. API calls are not one atomic snapshot. SMTP acceptance is not inbox receipt; uncertain delivery needs human inspection before a resend. Manual tests do not verify automatic static-data persistence or exactly-once delivery under concurrency/crashes.
