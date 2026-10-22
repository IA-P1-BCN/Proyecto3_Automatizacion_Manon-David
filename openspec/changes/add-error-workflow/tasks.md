# Tasks

## 1. Prerequisites

- [ ] 1.1 Start the stack with `docker compose up -d` and verify which configuration mechanism works for `TIENDA_EMAIL_AVISOS` (n8n Variables, environment variable via `docker-compose.yml`, or a Set node); record the choice in `docs/decisions-clarify.md` and verify the chosen mechanism returns a test value inside a node.
- [ ] 1.2 Create the Gmail OAuth2 credential in n8n for the team account and verify it can send a test email to the shop address.

## 2. Sanitise and format

- [ ] 2.1 Write the Code node logic (mask secrets, cut to 500 characters, apply the two fallbacks, build subject and body in Spanish) and verify it against the six sample inputs in the spec (bearer token, JSON key, long message, empty message, missing step, plain message); keep the sample inputs and expected outputs in `workflows/tests/08-error-workflow.md`.
- [ ] 2.2 Confirm the Code node reads only the workflow name, execution id/url, last node and error message, and verify with an input containing a customer name, phone and email that none of them appears in the output.

## 3. Build the error workflow

- [ ] 3.1 Build `08 Error Workflow` as Error Trigger → Code → Gmail with descriptive node names, recipient taken from `TIENDA_EMAIL_AVISOS`, and verify it saves and passes n8n's validation.
- [ ] 3.2 Export it to `workflows/08-error-workflow.json` and verify with a search that the file contains no credentials and no real recipient address.

## 4. Test with real failures

- [ ] 4.1 Build `99-error-test` (Webhook → Code that throws the message from the request), set its *Error Workflow* to flow 08, export it inactive to `workflows/99-error-test.json`, and verify it contains no credentials.
- [ ] 4.2 Run the six scenarios from the spec through `99-error-test` and verify each alert matches the expected result; save screenshots as evidence in `docs/evidence/08-error-workflow/`.
- [ ] 4.3 Verify an alert arrives within one minute and that the time shown is Madrid time.
- [ ] 4.4 Break the Gmail credential on purpose and verify no email is sent, no retry loop occurs and the failed execution is visible in n8n's history; restore the credential afterwards.

## 5. Documentation and hand-off

- [ ] 5.1 Add flow 08 to the README credentials/variables list (Gmail OAuth2, `TIENDA_EMAIL_AVISOS`; names only, no values) and verify the list matches what the flow uses.
- [ ] 5.2 Add the note to the README that the history of failed executions in n8n must be checked periodically, and the instruction to set *Error Workflow* = flow 08 on every Essential flow (01, 02, 03, 05).
- [ ] 5.3 Record the prompts used, any agent mistakes and the final choices in `docs/ai-log.md`, and verify the file has an entry for this flow.
- [ ] 5.4 Open the PR with both exported JSON files and verify the other teammate has reviewed it (definition of done in `docs/constitution.md`).

## Workflow follow-up

- Set flow 08 as the *Error Workflow* of flows 01, 02, 03 and 05 as each is built (tracked in their own changes).
- Archive this change after the PR is merged.
