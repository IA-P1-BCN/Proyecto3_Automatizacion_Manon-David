# demo-data-loading Specification

## Purpose
Lets the team fill the app with a known demo story in one manual run, so the Essential flows can be shown end to end, without touching real customers and without duplicating data on a second run.

## Requirements

### Requirement: Manual, one-run demo data
The system SHALL create the demo data only when a person starts the flow by hand. The flow SHALL have no schedule and no webhook.

#### Scenario: Run by hand
- **WHEN** a person executes the flow from the n8n editor on an app without demo data
- **THEN** the app contains five demo reservations and their deposits as described below, and the execution is successful

### Requirement: The demo story covers every case
The system SHALL create reservations through the app API so that the app holds: one `activo` reservation with email and size and a deposit after creation; one reservation without size that becomes `liquidado` through a final deposit; one reservation paid in full at creation (`liquidado`); one reservation without email; and one reservation whose deadline has already passed and whose state is still `activo`.

#### Scenario: Partial reservation
- **WHEN** the flow finishes
- **THEN** a demo reservation with email and size is `activo` with a pending amount greater than 0 after its extra deposit

#### Scenario: Settled by a final deposit
- **WHEN** the flow finishes
- **THEN** a demo reservation without size is `liquidado`, because its last deposit left the pending amount at 0

#### Scenario: Paid in full at creation
- **WHEN** the flow finishes
- **THEN** a demo reservation created with an initial deposit equal to its price is `liquidado`

#### Scenario: Reservation without email
- **WHEN** the flow finishes
- **THEN** a demo reservation exists with no email, and the shop alert of flow 01 was sent for it if flow 01 is published

#### Scenario: Reservation past its deadline
- **WHEN** the flow finishes
- **THEN** a demo reservation exists whose `fecha_limite` is before today and whose `estado` is `activo`

### Requirement: Amounts and states come from the app
The system SHALL send only prices, deposits and the original date, and SHALL NOT calculate or set `abonado`, `pendiente`, `fecha_limite` or `estado`. The app's rules apply: if the app rejects a request, the flow fails and does not retry or adjust the amounts.

#### Scenario: App rejects a request
- **WHEN** the app answers `422` to one of the requests
- **THEN** the execution fails and the error workflow sends its alert

### Requirement: Running twice duplicates nothing
The system SHALL create a demo reservation only if no reservation with the same demo customer name exists, and SHALL register the deposits of a demo reservation only when the flow has just created it.

#### Scenario: Second run
- **WHEN** the flow runs again after a successful run
- **THEN** no reservation and no deposit is created, the execution is successful and the result says that the demo data already exists

#### Scenario: Partly loaded
- **WHEN** some demo reservations already exist and others do not
- **THEN** only the missing ones are created, each with its own deposits, and the existing ones are left unchanged

### Requirement: Demo data never reaches real customers
The system SHALL use the address in `TIENDA_EMAIL_AVISOS` as the email of every demo customer that has one, and SHALL mark every demo customer with the suffix `(demo)` in the customer name.

#### Scenario: Notices go to the team inbox
- **WHEN** flow 01 or flow 02 sends a notice for a demo reservation
- **THEN** it is delivered to the shop alert address and to no other address

### Requirement: Safe to keep in the repository
The flow SHALL contain no credentials, no real email addresses and no API key. It SHALL call the app at `http://tienda:8000` and authenticate with the shared *Header Auth* credential chosen in n8n.

#### Scenario: Exported file
- **WHEN** the flow is exported for the repository
- **THEN** the file has no credential values, no address other than `$env` references, and no `localhost`
