# AI data inventory

> What personal data leaves the shop for an AI model, per flow. Kept in step with the exported flows by `workflows/code/ai-inventory.test.js`: that test fails when a flow has an AI node that is not named below. It checks that the node is declared, not what data flows into it; that stays a review item for every PR.

**Rule for every AI flow (HU-14):** send the least text that does the job; never phone numbers, emails, balances, deadlines or reservation ids; never data about a customer without consent in the register `consentimientos` ([decision](decisions-clarify.md#personal-data-consent-register-hu-14)); amounts, states and deadlines are never produced by the model.

## Flows that send data to an AI model

### Flow 03 · Remote deposits

| | |
|---|---|
| **Node** | `Extract Payer Amount and Concept from Bank Notice with Groq` (HTTP Request) |
| **Provider · model** | Groq (`https://api.groq.com/openai/v1/chat/completions`) · `openai/gpt-oss-20b` |
| **What is sent** | One JSON object `{ subject, body }`: the subject and text of one incoming bank-notice email (Bizum or transfer), at most 500 and 12 000 characters, plus the fixed extraction prompt. Built by `Prepare Minimal Bank Notice Extraction Request for Groq`. |
| **What is in that text** | What the bank wrote: the payer's name (the person who paid, usually the customer), the amount, and the concept the payer typed (which may contain a reservation number or a product). It is the payer's own payment data. |
| **Never sent** | The customer list, any phone number or email from the app, balances, deadlines, reservation ids, API keys, credentials, the shop's mailbox address. The sender address is checked by the flow before the call and is not part of the request. |
| **When it runs** | Only after the sender filter passes and only when `allow_external_ai` is true in the `Configure Authorized Test Sender and Groq Access` node (false by default). |
| **What the model decides** | Nothing. It returns `ordenante`, `importe`, `concepto`, `tipo`. The flow checks the amount against the email text and the app decides everything else; an unclear payment is registered by nobody and goes to Marisa. |
| **Legal basis** | Legitimate interest of the shop in registering the payment it received (art. 6.1.f GDPR), minimised to the notice text. Groq is a processor outside the EU; the Groq account's data-retention setting must be checked before real bank emails are used. |
| **How to switch it off** | Set `allow_external_ai` to false, or disable the node. Every payment then goes to Marisa for manual review. |

## Flows that send no data to an AI model

Flows 00, 01, 02, 04, 05, 06, 06b, 07, 08, 09, 09b, 10, 90 and 99 contain no AI node. Customer messages are fixed Spanish templates filled with values from the app.

## Before adding an AI node

1. Add its section here (node, provider, fields sent, fields never sent, when it runs, basis, how to switch it off).
2. Check the fields against the rule at the top; list what personal data the text can still contain.
3. Confirm that only customers with active consent are involved (Telegram assistants, HU-11 and HU-12, also need the customer to be identified before any data is read).
