# Tasks

## 1. Build the flow

- [ ] 1.1 Create `02 Deposit Receipt` as a sub-workflow with an Execute Workflow trigger and verify it receives a sample `abono.registrado` payload from a pinned input.
- [ ] 1.2 Add the email-validity IF and the `estado` IF (`liquidado` vs otherwise); verify all combinations (email/no email × activo/liquidado) route correctly.
- [ ] 1.3 Add the Code node for Spanish formatting and the two message texts (partial receipt, collect-your-shoes); verify against sample payloads and expected texts in `workflows/tests/02-deposit-receipt.md`.
- [ ] 1.4 Add the Gmail nodes for the customer message and the shop alert; verify both arrive in the test inbox with the right content.

## 2. Wire and test end to end

- [ ] 2.1 Connect to the event router, set flow 08 as the *Error Workflow*, and verify by registering a deposit from the app UI that the receipt arrives within one minute with the app's amounts.
- [ ] 2.2 Register a deposit that settles the reservation and verify the collect-your-shoes message is sent with no pending amount.
- [ ] 2.3 Register a deposit through the API (`POST /api/apartados/{id}/abonos` with the `X-API-Key` header) and verify the same receipt is sent.
- [ ] 2.4 Register a deposit on a reservation without email and verify the shop alert is sent and the execution is successful.
- [ ] 2.5 Register two deposits in a row and verify two receipts, each with its own amount.
- [ ] 2.6 Break the Gmail credential temporarily and verify flow 08's alert fires; restore the credential.

## 3. Export and docs

- [ ] 3.1 Export to `workflows/02-deposit-receipt.json` and verify no credentials or real addresses are in it.
- [ ] 3.2 Add the flow to the README credentials/variables list and save screenshots of the received messages in `docs/evidence/02-deposit-receipt/`.
- [ ] 3.3 Log prompts and agent corrections in `docs/ai-log.md`, open the PR and verify the other teammate reviewed it.

## Workflow follow-up

- Archive this change after the PR is merged.
