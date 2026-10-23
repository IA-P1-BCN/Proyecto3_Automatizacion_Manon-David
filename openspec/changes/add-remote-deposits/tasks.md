# Tasks

## 1. Inputs and credentials

- [ ] 1.1 Configure the Email Trigger (IMAP, about every minute, bank-sender filter from configuration) and verify it fires for a sample email sent to the inbox and not for the flow's own sent mail.
- [ ] 1.2 Confirm the existing Groq credential works, pick a Groq model, and verify it answers a test prompt; note the model in `docs/ai-log.md`.
- [ ] 1.3 Create the Header Auth credential `X-API-Key` for the app and verify `GET http://tienda:8000/api/apartados?estado=activo` returns the list from inside n8n.

## 2. Extraction and validation

- [ ] 2.1 Add "mark as processed" before any other step and verify a processed email is not picked up again.
- [ ] 2.2 Write the extraction prompt (only subject+body in, JSON out) and verify the model returns the four fields for each Bizum and transfer sample and `no_es_pago` for the advertising email.
- [ ] 2.3 Write the validation Code node (non-empty payer, numeric amount > 0, allowed type, amount present in the email text) and verify it against good output, invented amount, non-JSON output and an advertising email; keep cases in `workflows/tests/03-remote-deposits.md`.

## 3. Matching and registration

- [ ] 3.1 Write the matching Code node (number in concept, contained name, abbreviated payer plus product, exactly-one rule, normalisation) and verify with the seeded reservations that it returns the expected result for every sample email.
- [ ] 3.2 Add the registration HTTP call (`POST /api/apartados/{id}/abonos`, method `bizum`, continue on error) and verify a deposit appears in the app for a clear payment.
- [ ] 3.3 Add the "ask Marisa" email (payer, amount, concept, type, reason, candidates) for doubtful payments, unknown payers and app refusals; verify it arrives with the app's 422 message for the overpayment and past-deadline cases.

## 4. Test against all sample emails

- [ ] 4.1 Send each of the nine emails in `data/correos/` to the inbox and verify the outcomes: 01 and 09 register; 02 registers by number; 03 registers and settles; 04 asks Marisa (overpayment); 05 asks Marisa; 06 asks Marisa (past deadline); 07 asks Marisa; 08 is ignored. Save a results table in `docs/evidence/03-remote-deposits/`.
- [ ] 4.2 Verify the customer receives their receipt from flow 02 for the registered ones and that this flow sends nothing to customers.
- [ ] 4.3 Run the flow twice over the same emails and verify no duplicate deposits appear in the app.
- [ ] 4.4 Stop the app container and send a payment email; verify the failure triggers flow 08's alert; restart the app.

## 5. Export and docs

- [ ] 5.1 Wire flow 08 as the *Error Workflow*, export to `workflows/03-remote-deposits.json` and verify no credentials or real addresses are in it.
- [ ] 5.2 Add the credentials/variables (SMTP/IMAP mailbox, Groq, X-API-Key, `TIENDA_EMAIL_AVISOS`, bank-sender filter) to the README, and document what data is sent to the AI model.
- [ ] 5.3 Log prompts, model comparison and agent errors in `docs/ai-log.md`, open the PR and verify the other teammate reviewed it.

## Workflow follow-up

- Archive this change after the PR is merged.
