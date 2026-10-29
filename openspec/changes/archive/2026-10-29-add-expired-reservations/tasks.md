# Tasks

## 1. Prerequisites and decisions

- [x] 1.1 Create the branch `feat/7-expired-reservations` from `dev` (after PR #6 is merged, or from `feat/6-due-reminders` if the date helpers are still needed); verify `workflows/code/06-due-reminders.js` is available.
- [x] 1.2 Record in `docs/decisions-clarify.md` the expiry decisions (09:05 Madrid, strictly before today, separate flow `06b`, no sent-record file, one shop summary per run, router still ignores `apartado.vencido`, Medium level); add the issue row #7 to the branching table; verify none contradicts an existing decision.

## 2. Pure logic

- [x] 2.1 Write the selection function (reservations + run date → ids to expire) with unit tests in `workflows/code/` for: deadline yesterday, deadline today, deadline tomorrow, not `activo`, empty list, month and year change, leap day, invalid run date; verify no test touches `pendiente` or `abonado`.
- [x] 2.2 Write the Spanish formatter: customer voucher email (code, amount, product, optional size, no-cash note) and shop summary (shoes back on sale, customers to tell by hand, comma decimals); unit tests for one, several, none, missing email, bounced email, no size; verify amounts and code come only from the app response.
- [x] 2.3 Write the result check (expiry failures, bounced emails → error message with reservation ids, no secrets) with unit tests; verify it throws on any failure and passes on none.

## 3. Build the flow

- [ ] 3.1 Create the generator `workflows/code/build-06b-expired-reservations.js` and generate `06b Expired Reservations`: Schedule Trigger `5 9 * * *` (Europe/Madrid) and Manual Trigger → `Choose Date` → `GET /api/apartados?estado=activo` (shop Header Auth) → selection Code node; verify the JSON imports in a throwaway n8n and is inactive. Not run: tests pending on the team's n8n (see `workflows/tests/06b-expired-reservations.md`); archived with this open on 2026-10-29.
- [ ] 3.2 Add `POST /api/apartados/{id}/vencer` per item with the error output on, then the customer Send Email (error output on) and the missing-email path; verify with a stub run that a mixed set (ok, 422, no email) gives the right branches. Not run: tests pending on the team's n8n (see `workflows/tests/06b-expired-reservations.md`); archived with this open on 2026-10-29.
- [ ] 3.3 Add the shop summary (Aggregate → Code → Send Email to `TIENDA_EMAIL_AVISOS`, skipped when nothing expired) and the final `Verify Result` that throws on any failure; verify the order list → expire → notify → summary → verify. Not run: tests pending on the team's n8n (see `workflows/tests/06b-expired-reservations.md`); archived with this open on 2026-10-29.
- [ ] 3.4 Set flow 08 as the Error Workflow of flow 06b and verify the app being unreachable, a 422 on one reservation and a bounced email each trigger the alert while the other reservations are still processed. Not run: tests pending on the team's n8n (see `workflows/tests/06b-expired-reservations.md`); archived with this open on 2026-10-29.

## 4. Tests with real data

- [x] 4.1 Save sample reservations and expected results in `workflows/tests/06b-expired-reservations.md` (deadline yesterday, today, tomorrow, not active, no email, malformed email, no size, several at once); verify every spec scenario is covered.
- [ ] 4.2 Create a reservation of yours (own email, past `fecha_limite` through the demo-data flow or the app's migration `fecha`) and run the manual trigger; verify it is `vencido` in the app, one Spanish voucher email with the app's code and amount, and one summary email listing the shoes. Not run: tests pending on the team's n8n (see `workflows/tests/06b-expired-reservations.md`); archived with this open on 2026-10-29.
- [ ] 4.3 Run it again; verify no second voucher email and no summary (nothing to expire). Not run: tests pending on the team's n8n (see `workflows/tests/06b-expired-reservations.md`); archived with this open on 2026-10-29.
- [ ] 4.4 Run with a reservation without email; verify no customer email and a "avisar a mano" entry with its voucher code in the summary. Not run: tests pending on the team's n8n (see `workflows/tests/06b-expired-reservations.md`); archived with this open on 2026-10-29.
- [ ] 4.5 Break the SMTP credential for one run; verify the reservation is expired, the execution fails, flow 08 alerts and the voucher code still reaches Marisa through the next available channel (document what she sees). Not run: tests pending on the team's n8n (see `workflows/tests/06b-expired-reservations.md`); archived with this open on 2026-10-29.
- [ ] 4.6 Publish the flow only for the test (with permission) and verify the 09:05 schedule fires once in Executions, then unpublish; verify the times shown are Madrid time. Not run: tests pending on the team's n8n (see `workflows/tests/06b-expired-reservations.md`); archived with this open on 2026-10-29.

## 5. Export and docs

- [x] 5.1 Export `workflows/06b-expired-reservations.json` and verify it contains no credentials, `localhost`, or real addresses.
- [ ] 5.2 Document in `docs/README-changes.md` the credentials and variables used (names only), the 09:05 schedule, the manual run with a date, that the app's own date still limits what can be expired, and that a hand expiry from the screen sends no voucher email; verify the text matches the tested flow. Not run: tests pending on the team's n8n (see `workflows/tests/06b-expired-reservations.md`); archived with this open on 2026-10-29.
- [ ] 5.3 Save screenshots of the voucher email and of the shop summary in `docs/evidence/06b-expired-reservations/` and add the entry to `docs/ai-log.md`; verify the entry says no data left n8n except the app calls and the emails. Not run: tests pending on the team's n8n (see `workflows/tests/06b-expired-reservations.md`); archived with this open on 2026-10-29.
- [ ] 5.4 Sync the issue with `python scripts/sync_issue_tasks.py 7`, open the PR to `dev` with `Closes #7` and verify the other teammate reviewed it. Not run: tests pending on the team's n8n (see `workflows/tests/06b-expired-reservations.md`); archived with this open on 2026-10-29.

## Workflow follow-up

- Archive this change after the PR is merged.
