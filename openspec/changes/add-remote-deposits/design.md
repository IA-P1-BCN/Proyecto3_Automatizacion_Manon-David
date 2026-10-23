# Design

## Context

Bank notices arrive in the shop Gmail inbox in two layouts (Bizum: `Importe:`, `Ordenante:`, `Concepto:`; transfer: dotted `Ordenante ........`). Decimals use a comma and amounts end in `EUR`. The app has no customer table; reservation names are short ("Carmen Ruiz") while payers appear with full names. The app validates every deposit and answers 422 with a readable `detail`. It announces each registered deposit with `abono.registrado`, which feeds flow 02. See proposal.md and `specs/remote-deposit-registration/spec.md`.

## Goals / Non-Goals

**Goals:** correct automatic registration for clear payments; a precise question to Marisa for everything else; no duplicate deposits.

**Non-Goals:** receiving Marisa's reply and acting on it (she registers the payment in the app herself); fuzzy matching; sending customer messages; handling several bank formats beyond the sample layouts.

## Decisions

1. **Pipeline:** Gmail Trigger (poll) → mark as processed → AI extraction → validation Code node → fetch active reservations → matching Code node → branch (register / ask Marisa) → on 422, ask Marisa. *Alternative:* IMAP trigger; rejected because Gmail OAuth is already needed to send.

2. **Mark-as-processed first.** The email is labelled or marked read before any registration. If something fails afterwards, the error workflow alerts and the team registers by hand; a lost registration is loud, a duplicated deposit would be silent. *Alternative:* mark after registering; rejected because a failure between the two steps reprocesses the email and double-registers.

3. **AI returns a small JSON** (`ordenante`, `importe`, `concepto`, `tipo`) via a prompt that forbids anything else. The validation node parses amounts such as `10,00 EUR`, rejects non-numeric or non-positive values, and checks the amount text occurs in the email (guards against invented figures).

4. **Matching lives in one Code node** with fixed order: number in concept → contained-name match → abbreviated-payer-plus-product match. Candidates come from `GET /api/apartados?estado=activo` (all pages). Exactly one candidate registers; otherwise ask. Names are normalised (lower case, accents removed, spaces collapsed). *Alternative:* similarity scoring; rejected (risk of silent mis-assignment).

5. **Registration through the API only** (`POST /api/apartados/{id}/abonos`, method `bizum`) with the HTTP node's "continue on error" output so a 422 becomes a message to Marisa instead of a failure. The flow does not check pending amount or deadline itself.

6. **Alerts to Marisa are one email template with a reason field**, in Spanish: payer, amount, concept, type (Bizum/transfer), reason and candidate reservations if any.

7. **Model:** a Groq model chosen by testing the sample emails; the choice is logged in `docs/ai-log.md`.

8. **Bank-sender filter as configuration**, so the flow only looks at emails from the bank and not at its own sent mail or customer replies.

## Risks / Trade-offs

- **[Free model is slow or wrong]** → Validation and the "ask Marisa" path make a bad extraction harmless; test on all nine samples and compare at least two models if results are poor.
- **[Name-containment false match]** A stored name like "Ana Torres" could be contained in the payer name of a different person. → Exactly-one rule plus the ask path; the sample data has no such clash, and ambiguity falls to Marisa.
- **[Mark-first loses a payment on failure]** → Accepted; the error alert tells the team an email needs manual handling.
- **[Polling delay]** The flow reacts at the polling interval, not instantly. → Acceptable for payments; set the interval to about a minute.
- **[Attempted payment past 23:55]** It lands in the next day's close. → Documented in the daily-close change.
- **[Reservations list grows]** Fetching all active reservations each time is fine at shop scale.
