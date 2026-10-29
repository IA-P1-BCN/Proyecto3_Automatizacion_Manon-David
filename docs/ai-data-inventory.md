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

### Flow 12 · Shop Telegram assistant

| | |
|---|---|
| **Agent / model nodes** | `Interpret Supported Shop Question`, `Groq Shop Query Model` |
| **Closed tools** | `Choose Weekly Collections Plan`, `Choose Monthly Deadlines Plan` (return constant plan descriptors, no API access) |
| **Provider · model** | Groq · `openai/gpt-oss-20b`; both authorized real HU-12 query paths passed on 2026-10-29 (Agent 2.2, n8n 2.32.6); see workflow evidence |
| **What is sent** | Only constant vocabulary: `{"question":"weekly_collections"}` or `{"question":"monthly_deadlines"}`, fixed system/tool instructions, the selected constant tool argument/result, and final plan enum. No raw user question is forwarded. |
| **Never sent** | Raw Telegram text, user/chat IDs, names, emails, phones, balances, amounts, deadlines, reservation IDs, API replies, bridge/bot/shop keys or final business replies. |
| **When it runs** | After bridge authentication, independent numeric owner/private-chat authorization, whole-question validation, and both `allow_external_ai` / `allow_shop_reads` gates. Canonical export gates are false. |
| **What the model decides** | A closed plan selection which code must independently approve; it cannot call the app or send/compose a business reply. The model cannot broaden scope. |
| **Basis / privacy boundary** | Only a constant non-personal query representation is sent; customer records are excluded altogether. This does not assess Telegram's handling of the final owner-only business reply: bot chats are not end-to-end encrypted secret chats. |
| **How to switch it off** | Set `allow_external_ai=false` in `Configure Owner and Effects` or stop the dedicated bridge. No AI/API report is emitted with default gates off. |

## Flows that send no data to an AI model

Flows 00, 01, 02, 04, 05, 06, 06b, 07, 08, 09, 09b, 10, 11, 11b, 90 and 99 contain no AI node. Customer messages are fixed Spanish templates filled with values from the app.

Flow 11b runs after flow 03's extraction and only reads what flow 03 already holds (payer, amount and concept of one payment) plus the Data Table `solicitudes_apartado` and the app's active reservations. None of that is sent to a model. Flow 11 keeps a customer's name, phone, email, model and size in that Data Table until the request is settled or cancelled, and emails only the customer and the shop.

## Before adding an AI node

1. Add its section here (node, provider, fields sent, fields never sent, when it runs, basis, how to switch it off).
2. Check the fields against the rule at the top; list what personal data the text can still contain.
3. Confirm that only customers with active consent are involved (Telegram assistants, HU-11 and HU-12, also need the customer to be identified before any data is read).
