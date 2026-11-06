# home-reservation-requests Specification

## Purpose
Lets a customer ask from home to reserve a pair of shoes. The shop is told at once, the customer learns how to pay the initial deposit, and the apartado is created in the app when the matching payment arrives, without anyone entering it by hand.

## Requirements

### Requirement: Public request form
The system SHALL offer a form where a customer gives name, phone (optional), email, shoe model chosen from a fixed list, size chosen from 36 to 44 and a consent checkbox. The model options SHALL show the list price. The form SHALL NOT ask for or accept a price.

#### Scenario: Valid request
- **WHEN** a customer submits "Ana Pérez", an email, a model from the list, size 38 and ticks the consent box
- **THEN** a pending request is stored and the customer sees a confirmation page with the reference

#### Scenario: Missing consent
- **WHEN** the consent box is not ticked
- **THEN** no request is stored and the customer is told the consent is needed to be contacted

#### Scenario: Invalid data
- **WHEN** the name is empty, the email has no valid address, the size is not in the list or the model is not in the list
- **THEN** no request is stored and the customer is told which field to fix

### Requirement: Price comes from the shop
The system SHALL take the price of a request from a fixed list kept in the flow, looked up by the chosen model. A model that is not in the list, or whose label shows a different price, SHALL be rejected.

#### Scenario: Known model
- **WHEN** a request names a model that is in the list
- **THEN** the pending request stores that model's list price

#### Scenario: Altered price
- **WHEN** a submission carries a model label with a price different from the list
- **THEN** no request is stored

### Requirement: Pending request record
The system SHALL store each request in the n8n Data Table `solicitudes_apartado` with a unique reference (`SOL-` plus a zero-padded sequence), the customer data, `producto`, `talla`, `precio`, `estado` (`pendiente`, `procesando`, `confirmada` or `cancelada`), `apartado_id` once created, the date and the key of the payment being processed. No apartado SHALL exist in the app at this point.

#### Scenario: Request stored
- **WHEN** a valid request is submitted
- **THEN** one row with estado `pendiente` and the next reference exists, and the app has no new apartado

#### Scenario: Same form submitted twice
- **WHEN** the same email, model and size are submitted again while a `pendiente` row for them exists
- **THEN** no second row is created and the customer is shown the existing reference

#### Scenario: Earlier request already settled
- **WHEN** the same email, model and size are submitted and the earlier row is `confirmada` or `cancelada`
- **THEN** a new row with a new reference is created

### Requirement: The shop is told of each request
The system SHALL email `TIENDA_EMAIL_AVISOS`, in Spanish, with the reference, customer name, phone, email, model, size and list price, and SHALL say that the apartado will be created when the payment arrives.

#### Scenario: Marisa is notified
- **WHEN** a request is stored
- **THEN** Marisa receives one email with all of the above

#### Scenario: Notification fails
- **WHEN** an email cannot be sent
- **THEN** the request stays `pendiente` in the table and the error workflow alerts the shop

### Requirement: Customer is told how to pay
The system SHALL email the customer, in Spanish, the model, size, list price, the minimum initial deposit stated by the app's rule (5 €), that the apartado is not valid until the deposit is received, the reference to write as the payment concept and the shop's payment instructions from the environment variable `TIENDA_PAGO_INSTRUCCIONES`. When that variable is empty the email SHALL tell the customer to ask the shop. It SHALL send this only when the customer's consent is `activo`.

#### Scenario: Consent given
- **WHEN** a request is stored for an email whose consent is `activo` or is recorded by the form
- **THEN** the customer receives one email with the reference as the concept

#### Scenario: Consent withdrawn earlier
- **WHEN** the email's consent row is `retirado`
- **THEN** the row stays `retirado`, no email goes to the customer, and the shop email says the customer must be contacted another way

#### Scenario: Payment instructions not configured
- **WHEN** `TIENDA_PAGO_INSTRUCCIONES` is empty
- **THEN** the customer email asks the customer to enquire in the shop about how to pay

### Requirement: Consent recorded from the form
The system SHALL record the form's consent through the consent check (flow 09) and SHALL NOT overwrite a `retirado` row.

#### Scenario: New consent
- **WHEN** a request with the box ticked arrives for an email that has no row
- **THEN** a row with estado `activo` is created

### Requirement: A payment with the reference creates the apartado
The system SHALL, when a validated bank payment carries a request reference in its concept and the payer's name fits the request, create the apartado through the app's API using the request's customer data, `producto`, `talla` and `precio` and the paid amount as `abono_inicial`, only when the request is `pendiente`. The app SHALL decide whether the amount is acceptable and the system SHALL NOT recompute any amount.

#### Scenario: Payment with the reference
- **WHEN** a Bizum of 20,00 EUR from "ANA PEREZ LOPEZ" with concept "SOL-0007" arrives and request SOL-0007 for "Ana Pérez" is `pendiente`
- **THEN** the app creates an `activo` apartado with a 20,00 initial deposit and the request becomes `confirmada` with that `apartado_id`

#### Scenario: Reference spelled loosely
- **WHEN** the concept reads "sol 7"
- **THEN** it is treated as SOL-0007

#### Scenario: Reference wins over an existing reservation
- **WHEN** the payer also has an active reservation and the concept carries a valid reference whose request fits the payer
- **THEN** the apartado is created from the request and the existing reservation is not touched

#### Scenario: Wrong payer
- **WHEN** the payer's name does not fit the request named by the reference
- **THEN** nothing is created, nothing is reassigned and Marisa is asked to decide

#### Scenario: Unknown, repeated or settled reference
- **WHEN** the reference does not exist, the concept holds several references, or the request is `confirmada`, `cancelada` or `procesando`
- **THEN** nothing is created and Marisa is told the reason

#### Scenario: Confirmation email comes from the usual flow
- **WHEN** the app creates the apartado
- **THEN** the existing `apartado.creado` handling sends the confirmation, and these flows send no second one

### Requirement: A payment without the reference is taken only when clear
The system SHALL, when the concept has no reference, create the apartado only if exactly one pending request fits the payer's full name and no active reservation fits it. Any other combination SHALL be left to Marisa, and a payment that fits no pending request SHALL be left to the existing remote-deposit handling untouched.

#### Scenario: One clear request
- **WHEN** a Bizum from "ANA PEREZ LOPEZ" with concept "zuecos" arrives and exactly one pending request fits and no active reservation fits
- **THEN** the apartado is created from that request

#### Scenario: Request and reservation for the same person
- **WHEN** both a pending request and an active reservation fit the payer and the concept has no reference
- **THEN** nothing is created and Marisa is asked to decide

#### Scenario: Several requests
- **WHEN** two pending requests fit the payer
- **THEN** nothing is created and Marisa is asked to decide

#### Scenario: Abbreviated payer without the reference
- **WHEN** the payer is abbreviated ("ANA P.") and the concept has no reference
- **THEN** the payment is not treated as a request payment

#### Scenario: Payment unrelated to any request
- **WHEN** a payment fits no pending request
- **THEN** the existing remote-deposit handling continues exactly as before

### Requirement: Never create an apartado twice
The system SHALL ensure that a request produces at most one apartado, including when two payments arrive together. It SHALL mark the request as being processed with the payment's key before calling the app, SHALL read the row again, and SHALL go on only if the stored key is its own.

#### Scenario: Request already being processed
- **WHEN** a second payment reaches a request that another payment has already claimed
- **THEN** nothing is created and Marisa is told the request is already being processed

#### Scenario: Two payments at once
- **WHEN** two payments for the same `pendiente` request are processed together
- **THEN** exactly one apartado is created

### Requirement: The app's answer decides the request's fate
The system SHALL mark the request `confirmada` with the new `apartado_id` when the app creates the apartado, SHALL put it back to `pendiente` when the app refuses, and SHALL leave it `procesando` when the outcome cannot be known.

#### Scenario: App refuses the amount
- **WHEN** a payment of 3,00 EUR is matched and the app answers that the minimum is 5 €
- **THEN** no apartado is created, the request returns to `pendiente`, and Marisa receives the app's message

#### Scenario: Outcome unknown
- **WHEN** the app cannot be reached or answers unexpectedly while creating the apartado
- **THEN** the request stays `procesando`, Marisa is warned to check the app before entering anything by hand, and the error workflow alerts the shop

#### Scenario: Table cannot be updated afterwards
- **WHEN** the apartado was created but the request row cannot be updated
- **THEN** Marisa is told to fix the row by hand and to check the app first, and the error workflow alerts the shop

### Requirement: Registration can be switched off for tests
The system SHALL, when payment registration is not enabled in flow 03, create nothing and tell Marisa what would have been created.

#### Scenario: Preview only
- **WHEN** registration is disabled and a payment matches a request
- **THEN** no row is changed, no apartado is created and Marisa receives "Vista previa" with the request and the amount

### Requirement: Failures are never silent
The system SHALL route every unexpected failure to the error workflow, SHALL put a request that failed with a known refusal back to a state from which it can be matched again, and SHALL NOT include customer data in the alert.

#### Scenario: App unreachable while reading reservations
- **WHEN** the app cannot be reached while a payment is being matched
- **THEN** the execution fails, the error workflow alerts the shop and no request is changed
