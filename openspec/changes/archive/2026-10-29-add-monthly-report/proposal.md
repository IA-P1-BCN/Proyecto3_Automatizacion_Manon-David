# Proposal

## Why

Issue #8 — HU-08 · Informe mensual, assigned to David, requires a trustworthy monthly summary so Marisa can see collections and current outstanding balances without manual calculations. The team has accepted explicit accounting rules for settlement and expiry counts because the API does not expose a settlement timestamp.

## What Changes

- Add an inactive `07 Monthly Report` workflow: day 1 at 09:00 Europe/Madrid, plus a manual preview with email off by default.
- Query the previous calendar month's direct sales and deposits, and report each separately by payment method using cent-precision sums. Initial deposits count once.
- Report current active pending balances, distinctly labelled with the consultation time, rather than claiming a historical month-end balance.
- Count new reservations by `fecha`, currently settled reservations by their latest payment date, and expired reservations by voucher date. Disclose the settlement-date limitation.
- Send one Spanish HTML-table email using existing SMTP configuration; no AI calls, financial writes or new business ledger.
- Only after the email baseline passes, attempt an optional local PDF attachment for at most 20 minutes. Use the same report data; PDF failure must not suppress the table email. A failed trial is explicitly deferred rather than blocking the baseline.
- Supply tests, setup instructions, evidence boundaries and an AI-log entry. Budget the agreed implementation and minimum verification at two hours, surfacing blockers rather than silently reducing correctness.

## Capabilities

### New Capabilities

- `monthly-report`: Calendar-month collections, current active pending balances, attributable reservation counts, owner delivery and an optional local PDF representation.

### Modified Capabilities

None. The main capability inventory is empty; existing daily-close, router and payment workflows remain unchanged.

## Impact

- Planned files: `workflows/07-monthly-report.json`, focused `workflows/code/07-*` helpers/tests and generator, `workflows/tests/07-monthly-report.md`, `docs/monthly-report-setup.md`, a short `specs/07-monthly-report.md` entry point and `docs/ai-log.md`.
- Existing integrations: shop REST API through Header Auth `X-API-Key`, Infomaniak SMTP and local flow 08 selection. No backend/frontend changes, kDrive writes, paid n8n Variables or AI provider dependency.
- PDF trial only: an optional separate Compose file may add local Gotenberg without exposing host ports or restarting existing services. Confirm security configuration and actual conversion before claiming PDF integration.
- No commit, push, PR, workflow publication or real SMTP test is inferred from implementation authorization.
