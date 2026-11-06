# Monthly report — issue #8

**Issue:** #8 — HU-08 · Informe mensual. Owner: David. Planned workflow: `07 Monthly Report`, `workflows/07-monthly-report.json`.

The behavior contract is [the OpenSpec monthly-report spec](../openspec/changes/add-monthly-report/specs/monthly-report/spec.md); implementation choices and scope are in its [design](../openspec/changes/add-monthly-report/design.md).

- Trigger: day 1, 09:00 Europe/Madrid; manual closed-month preview with email off.
- Inputs: authenticated GET sales/deposits for the previous month, current reservations, payment history and vouchers. No business writes or AI calls.
- Output: Spanish owner email table with source/method collections, current active pending balances, new/settled/expired counts and accounting definitions. Collections are not profit.
- New: reservation creation date. Settled: maximum recorded payment date of currently settled reservations, not a stored state-change timestamp. Expired: voucher date, not deadline. Current active pending is not month-end historical debt.
- Credentials: shop Header Auth (`X-API-Key`), Infomaniak SMTP and local Error Workflow selection. Configuration names: `TIENDA_EMAIL_FROM`, `TIENDA_EMAIL_AVISOS`; manual `month`, `send_email`, `include_pdf`.
- Errors: reject malformed, incomplete or inconsistent source data; bounded GET retries, no SMTP retries; shared Error Workflow for unexpected execution failures. A future optional PDF error must not suppress the table email.
- Security: inactive sanitized export, no pinned customer data, no model provider, no customer contact details in the report. Existing workflows and credentials remain unchanged.
- Acceptance and expected-result examples: [test contract](../workflows/tests/07-monthly-report.md). Do not confuse local/mock tests with actual n8n/SMTP execution.
