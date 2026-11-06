# Tasks

Issue #8 — HU-08 · Informe mensual. Owner: David. Branch: `feat/8-monthly-report`.

Delivery order: working table email first, then an optional local PDF trial lasting at most 20 minutes within the agreed two-hour effort budget. Stop and report blockers rather than broaden scope or invent verification.

## 1. Deterministic report and focused tests

- [x] 1.1 Implement closed-month selection and Madrid-local previous-month boundaries in the monthly helper; test January rollover, February/leap years, both DST changes, inclusive boundary dates and rejection of malformed/current/future months with `node --test workflows/code/07-monthly-report.test.js`.
- [x] 1.2 Implement strict source validation and cent-safe source/method sums, current active pending sum, new/settled/expired attribution and escaped Spanish HTML; verify initial payments counted once, full payment at creation, backdated imports, latest date independent of ordering, deadline/voucher month differences, unknown methods, duplicate IDs, missing dates/vouchers, unsafe amounts, empty movements and active debt without movements.
- [x] 1.3 Add `specs/07-monthly-report.md` as a concise entry point and the expected-results table in `workflows/tests/07-monthly-report.md`; verify they explain all three count dates, current rather than month-end pending, no AI calls, and collections rather than profit. Add the actual planning/model decisions and corrected errors to `docs/ai-log.md` without copying excluded personal discussions.

## 2. Inactive email workflow and baseline verification

- [x] 2.1 Build inactive `workflows/07-monthly-report.json` and its focused generator using complete-array Header Auth GET responses, schedule/manual inputs, calculation/presentation stages, email opt-in and one SMTP stage. Verify JSON parsing, node/expression/connection integrity, empty-array continuation, Madrid timezone, no financial-write nodes, no AI nodes, no credentials/pinned data and no automatic SMTP retries.
- [x] 2.2 Add scheduled-period success tracking without claiming crash/concurrency exactly-once delivery; test confirmed-repeat suppression and intentional manual resend semantics with mocked state, and document that manual editor tests do not prove static-data persistence.
- [x] 2.3 Write `docs/monthly-report-setup.md` with exact node/field/value instructions, credential reassociation, unchanged existing flows, local Error Workflow selection and safe defaults. Verify a disposable n8n import and execution of preview/empty/error paths where available; clearly distinguish mocked nodes from real integrations.
- [x] 2.4 Confirm the intended David-local services and perform read-only API comparison for at least one closed month with an independent Decimal-based calculation; verify all amounts and counts agree, and record only sanitized aggregate results. Do not add/delete ledger fixtures to obtain expected figures.
- [x] 2.5 Import only the new draft after preserving unrelated workflows, associate local credentials without exporting secrets, and execute a real read-only editor preview. After confirming one controlled recipient and authorization for a single SMTP message, verify the actual table email and record user-confirmed reception separately from agent-executed checks. Keep the workflow unpublished.

Observed: import, local credential association, actual n8n CLI preview, table SMTP/inbox and PDF SMTP/inbox checks passed; David confirmed figures, accents and PDF opening. After the trigger-selection safety fix, David separately confirmed the editor preview succeeded without sending email and he downloaded the generated PDF. No further repeat email is needed.

## 3. Optional PDF trial after the email baseline

- [x] 3.1 Start a recorded trial timer only after baseline verification. Within at most 20 minutes, attempt a synthetic HTML-to-PDF conversion using an optional version-pinned local Gotenberg service, no public port, no business-data volumes and restricted outbound fetches. Start only that service, never restart the shop/n8n; verify Compose scope and actual output. If blocked, record the elapsed time/reason, stop this extension and mark it explicitly deferred without claiming a tested PDF.
- [x] 3.2 If the local trial succeeds within budget, add a false-by-default PDF toggle, gated conversion/binary validation and attachment on the same email stage. Test matching figures, Spanish accents/EUR, page layout and converter-failure fallback with synthetic inputs; update setup/test documentation with actual results. Otherwise retain the unchanged tested email baseline and document the omitted PDF path.

## 4. Delivery consistency and handoff

- [x] 4.1 Run the relevant monthly tests plus the existing JavaScript regression suite and strict OpenSpec validation; inspect the final JSON and diff for secrets, unintended changes and live-setting leakage. Preserve any user-arranged layout when sanitizing a final export. Report static, mocked, API and actual n8n/SMTP/PDF checks distinctly, with unresolved blockers and PDF outcome.
- [x] 4.2 Reconcile delivered files with the spec, setup and test notes and complete the AI-log entry; verify all tracked checkmarks have observed support. Summarize the actual branch, files and remaining limitations, then request specific permission before commit/push/PR. Human review by Manon and any publication remain separately authorized operations, not automatic consequences of implementation.

## Workflow follow-up

- After separately authorized publication and human-reviewed integration, verify issue closure and Project status independently.
- Do not archive the change automatically; archive only after the appropriate request and completion checks.
