# Spec Delta

## Purpose

Turns bank notices of Bizum and transfer payments into deposits on the correct reservation automatically, and asks the shop owner instead of guessing whenever the payment is unclear or the app refuses it.

## ADDED Requirements

### Requirement: Payment registration supports an idempotency key
The application SHALL accept an optional `Idempotency-Key` header on payment registration while supporting existing callers without it. Successful payment, key, request fingerprint and response SHALL be stored atomically. Identical retries SHALL return the original response without another payment or event. Conflicting reuse SHALL return HTTP 409; invalid keys SHALL be rejected and failed registrations SHALL NOT consume the key.

#### Scenario: Confirmation is lost after recording a payment
- **WHEN** a caller retries the same payment with the same key after losing the confirmation, including after settlement or application restart
- **THEN** the original successful response is returned and only one payment exists

#### Scenario: Simultaneous requests
- **WHEN** two requests attempt the same payment with the same key concurrently
- **THEN** exactly one payment is created and both receive the same successful response

#### Scenario: Key reused for a different payment
- **WHEN** an already used key accompanies a different reservation, amount, method or submitted date
- **THEN** HTTP 409 is returned and no payment or notification is created

#### Scenario: Payment fails validation
- **WHEN** a payment with a new key is rejected
- **THEN** neither the payment nor the key is stored

### Requirement: Only payment emails are processed
The system SHALL read new emails from the shop's bank notices and SHALL ignore any email that is not a payment, without registering anything or notifying anyone.

#### Scenario: Bank advertising
- **WHEN** an email arrives offering up to 150 € for moving the card-terminal collections
- **THEN** nothing is registered, nobody is notified, and the email is marked as processed

### Requirement: Message identity is distinct from payment evidence
The system SHALL derive stable opaque keys from configured receiving-account scope and the message identifier. A separate content hash SHALL flag possible duplicates, never prove payment identity. Missing identifiers SHALL stop for error-workflow-assisted manual review. The AI SHALL NOT invent identifiers. Verified bank-operation adapters are deferred in the approved cut.

#### Scenario: Same message received twice
- **WHEN** the same message identifier and content are received again for the same account
- **THEN** the same registration key is produced

#### Scenario: Different messages with identical content
- **WHEN** two messages have different identifiers but identical subject and body without a verified bank operation reference
- **THEN** the second message requires review rather than automatic registration or silent dismissal

#### Scenario: Identifier reused with changed content
- **WHEN** the same source identifier arrives with different subject or body
- **THEN** the conflicting notice requires review and no automatic registration is allowed

#### Scenario: Fixture has no identifiers
- **WHEN** a raw sample email has neither a verified operation reference nor a message identifier
- **THEN** processing stops for manual review until a controlled transport supplies an identifier; an arbitrary content hash is not treated as proof of payment identity

### Requirement: Extraction is limited to the email text
The system SHALL send an AI model only the subject and body of the email, and SHALL ask it only to return payer, amount, concept and payment type (`bizum`, `transferencia` or `no_es_pago`). The AI SHALL NOT decide which reservation a payment belongs to or whether it is registered.

#### Scenario: Data sent to the model
- **WHEN** a payment email is analysed
- **THEN** the model receives only that email's subject and body, and no reservation, customer list, phone or email address

### Requirement: Extracted data is validated
The system SHALL accept an extraction only when the payer is non-empty, the amount is a number greater than zero, the type is one of the three allowed values and the amount appears in the email text. Otherwise the payment SHALL be treated as doubtful and nothing SHALL be registered.

#### Scenario: Model returns an invented amount
- **WHEN** the model returns an amount that does not appear in the email text
- **THEN** nothing is registered and Marisa is asked to review the email

#### Scenario: Model returns unusable output
- **WHEN** the model's answer is not valid structured data
- **THEN** nothing is registered and Marisa is asked to review the email

### Requirement: Reservation found by number in the concept
The system SHALL, when the concept contains a reservation number written like "apartado 2", consider only that reservation. Multiple references or an incompatible payer SHALL require review, never reassignment.

#### Scenario: Number in the concept
- **WHEN** a Bizum of 20,00 EUR from "JORGE M." has the concept "apartado 2 bota" and reservation 2 is active
- **THEN** a deposit of 20.00 by `bizum` is registered on reservation 2

### Requirement: Reservation found by contained payer name
The system SHALL, when the concept has no reservation number, compare names ignoring case, accents and extra spaces and select the single active reservation whose stored name words are all contained in the payer's name.

#### Scenario: Payer name longer than stored name
- **WHEN** a Bizum of 10,00 EUR from "CARMEN RUIZ GARCIA" arrives and exactly one active reservation is stored as "Carmen Ruiz"
- **THEN** a deposit of 10.00 by `bizum` is registered on that reservation

#### Scenario: Accents and case
- **WHEN** a payment from "LUCIA GOMEZ PEREZ" arrives and the only matching active reservation is stored as "Lucía Gómez"
- **THEN** that reservation is selected

### Requirement: Abbreviated payer needs product confirmation
The system SHALL accept an abbreviated payer name (first name or surname plus an initial) only when the first name matches, the other word starts with the initial, and the concept names the product of exactly one such active reservation.

#### Scenario: Abbreviated payer with product in the concept
- **WHEN** a payment from "LAURA O." with concept "deportivas" arrives and exactly one active reservation matches Laura, a surname starting with O, and a sports-shoes product
- **THEN** that reservation is selected

#### Scenario: Abbreviated payer without a concept
- **WHEN** a payment from "ROMERO D" with an empty concept arrives
- **THEN** no reservation is selected, nothing is registered and Marisa is asked to decide

### Requirement: Doubt means asking, never guessing
The system SHALL, when no reservation or more than one reservation qualifies, register nothing and email Marisa the payer, amount, concept, payment type and, when there are several, the candidate reservations.

#### Scenario: Unknown payer
- **WHEN** a transfer of 25,00 EUR from "ANTONIO FERNANDEZ SOTO" with concept "botas" arrives and no active reservation matches
- **THEN** nothing is registered and Marisa receives the payer, amount and concept with the reason "no matching reservation"

#### Scenario: Several candidates
- **WHEN** two active reservations qualify for the same payment
- **THEN** nothing is registered and Marisa receives both candidate reservation numbers

### Requirement: Transfers are recorded as Bizum
The system SHALL register both Bizum and transfer payments with payment method `bizum`, and SHALL state the real type in any message to Marisa.

#### Scenario: Transfer registered
- **WHEN** a transfer of 12,00 EUR is matched to a reservation with 12.00 pending
- **THEN** a deposit of 12.00 with method `bizum` is registered and the reservation becomes settled

### Requirement: The app's rules decide acceptance
The system SHALL read state, deadline and pending balance from the API, reject ineligible payments for review and refresh the selected reservation before registration. It SHALL NOT recompute balances. The app SHALL validate again when registering. App refusals SHALL not cause reassignment and SHALL be reported to Marisa.

#### Scenario: Payment above the pending amount
- **WHEN** a payment of 15,00 EUR is matched to a reservation with less than 15.00 pending
- **THEN** the workflow rejects it before writing, or the app refuses it after a concurrent balance change; nothing is registered and Marisa receives the reason, payer, amount and reservation number

#### Scenario: Reservation past its deadline
- **WHEN** a payment is matched to an active reservation whose deadline has passed
- **THEN** the workflow or app refuses it, nothing is registered, and Marisa receives the reason

### Requirement: The customer is not messaged by this flow
The system SHALL NOT send any message to the customer. The receipt SHALL come from the deposit-receipt flow when the app announces the registered deposit.

#### Scenario: Successful registration
- **WHEN** a deposit is registered by this flow
- **THEN** this flow sends nothing to the customer, and the customer receives their receipt from the deposit-receipt flow

### Requirement: Repeated registration is protected independently of read status
The system SHALL send a stable Idempotency-Key and Payment-Notice-Fingerprint on each payment POST and SHALL verify the installed app exposes both headers. Mark-as-read SHALL only control reception. No automatic financial retry SHALL occur. Manual app entries and reworded duplicates are explicitly outside the deduplication guarantee.

#### Scenario: Flow restarts
- **WHEN** the flow runs again after a failure partway through an email
- **THEN** any financial retry uses the same key and content fingerprint; no second abono is created by that retry, or an already final reservation is sent to review

### Requirement: Human resolution remains manual in the approved delivery cut
The system SHALL email Marisa the review reason, extracted fields and available candidate contacts without registering a doubtful payment. Marisa SHALL resolve it in the app; no reply or approval form SHALL trigger a write. Uncertain POST outcomes SHALL explicitly warn against manual registration until checked.

#### Scenario: Marisa investigates an ambiguous notice
- **WHEN** several reservations could match
- **THEN** the shop notice includes candidate contacts for Marisa alone and no payment is registered automatically

#### Scenario: Registration response is lost
- **WHEN** the POST outcome is uncertain
- **THEN** Marisa is warned to inspect the app before manual entry and the execution fails for the Error Workflow

### Requirement: Failures are reported
The system SHALL let unexpected failures (API unreachable, model unreachable, email service errors) reach the error workflow so that a payment never disappears silently.

#### Scenario: App unreachable
- **WHEN** the app cannot be reached while registering a deposit
- **THEN** the execution fails and the error workflow alerts the shop
