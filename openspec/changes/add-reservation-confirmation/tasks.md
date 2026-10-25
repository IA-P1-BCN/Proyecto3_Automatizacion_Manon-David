# Tasks

## 1. Build the flow

- [x] 1.1 Create `01 Reservation Confirmation` as a sub-workflow with an Execute Workflow trigger, and verify it receives a sample `apartado.creado` payload from a pinned input.
- [x] 1.2 Add the email-validity IF (non-empty and contains `@`) and verify both outputs with a payload with email, one empty and one `carmen.example.com`.
- [x] 1.3 Add the Code node that formats comma decimals, `€`, `dd/mm/yyyy`, the optional size line and the paid-in-full text, and verify it against the four sample payloads (normal, no size, paid in full, tricky decimals such as 89.9) with expected texts in `workflows/tests/01-reservation-confirmation.md`.
- [x] 1.4 Add the Send Email node for the customer email and the shop-alert email (reservation number, customer, phone, model, reason); verify both arrive in the test inbox with the right content.

## 2. Wire and test end to end

- [x] 2.1 Connect the flow to the event router and set flow 08 as its *Error Workflow*; verify by creating a reservation in the app UI that the email arrives within one minute with the amounts shown by the app.
- [x] 2.2 Create reservations without email, with a malformed email and paid in full, and verify the shop alert / pick-up text appears and the executions are marked successful.
- [ ] 2.3 Break the SMTP credential temporarily and verify the failure triggers flow 08's alert; restore the credential.
- [x] 2.4 Verify one email is sent per event by creating two reservations in a row and counting messages.

## 3. Export and docs

- [x] 3.1 Export to `workflows/01-reservation-confirmation.json` and verify no credentials or real addresses are in it.
- [x] 3.2 Add the flow to the README credentials/variables list and save screenshots of the received emails in `docs/evidence/01-reservation-confirmation/`.
- [ ] 3.3 Log prompts and agent corrections in `docs/ai-log.md`, open the PR and verify the other teammate reviewed it.

## Workflow follow-up

- Archive this change after the PR is merged.
