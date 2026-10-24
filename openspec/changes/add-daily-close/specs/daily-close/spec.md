# Spec Delta

## Purpose

Gives the shop owner, every night, a correct summary of the day's takings split by payment method, and keeps a history of daily closes, so the till can be closed without adding anything up by hand.

## ADDED Requirements

### Requirement: Nightly close at a fixed time
The system SHALL run the close every day at 23:55 Madrid time and SHALL cover the current calendar day in Madrid time.

#### Scenario: Scheduled run
- **WHEN** the clock reaches 23:55 in Madrid
- **THEN** a close for that day's date is produced

### Requirement: Close includes sales and all deposits
The system SHALL include every direct sale and every deposit dated the closed day, including the initial deposit of each new reservation.

#### Scenario: Initial deposit counts
- **WHEN** a reservation is created on the day with an initial deposit of 10.00 by cash
- **THEN** the day's close counts the 10.00 as a deposit by cash

### Requirement: Totals per payment method
The system SHALL report sales, deposits and combined total separately for cash, card and Bizum, plus an overall total for sales, deposits and everything.

#### Scenario: Mixed day
- **WHEN** the day has sales of 6.50 cash and 20.00 card and deposits of 10.00 cash and 5.00 Bizum
- **THEN** the close shows cash 16,50 €, card 20,00 €, Bizum 5,00 € and an overall total of 41,50 €, with sales 26,50 € and deposits 15,00 €

### Requirement: Amounts match the app
The system SHALL add the amounts exactly as the app returns them, in whole cents, so that the close equals the sum of the app's records for that date.

#### Scenario: Decimal accuracy
- **WHEN** the day's sales are 0.10, 0.20 and 4.50
- **THEN** the total is 4,80 € with no floating-point error

#### Scenario: Close matches the app
- **WHEN** the close for a day is compared with the sum of the app's sales and deposits for the same date
- **THEN** every total is identical

### Requirement: Bizum includes transfers
The system SHALL say in the summary that the Bizum column includes bank transfers.

#### Scenario: Wording
- **WHEN** the summary is produced
- **THEN** it states that Bizum includes bank transfers

### Requirement: Empty day does not fail
The system SHALL, for a day with no sales and no deposits, produce a summary saying there were no movements and SHALL record a close with all totals zero.

#### Scenario: No movements
- **WHEN** the app returns no sales and no deposits for the day
- **THEN** Marisa receives a summary stating there were no movements, the history gets a row of zeros, and the execution is successful

### Requirement: Summary delivered to the owner
The system SHALL email the summary, in Spanish, to the shop's alert address, with the date, the per-method totals and the overall total.

#### Scenario: Summary email
- **WHEN** a close is produced for 2026-10-22
- **THEN** the shop address receives a Spanish email dated 22/10/2026 with per-method and overall totals

### Requirement: History with one row per date
The system SHALL save each close in `basedatos.csv` in the configured kDrive folder, with one row per date. The file SHALL be created once and updated by its ID on later runs, without renaming or deleting it. CSV SHALL use UTF-8, semicolon columns and decimal commas. Rerunning a close SHALL update that date's row without changing other dates.

#### Scenario: Rerun for the same date
- **WHEN** the close for 2026-10-22 is run twice
- **THEN** the history has exactly one row for 2026-10-22, holding the latest figures

### Requirement: A close can be run for a chosen date
The system SHALL allow a person to run the close by hand for a chosen past date, producing the same summary and history row for that date.

Manual runs SHALL default to not sending email; an explicit boolean option SHALL enable resending. Future or invalid dates SHALL be rejected. Transactions added after the scheduled closing time SHALL be recoverable by recalculating their original date, not silently assigned to the next calendar day.

#### Scenario: Recovering a missed night
- **WHEN** a person runs the close by hand for 2026-10-20
- **THEN** the summary and the history row are produced for 2026-10-20 and no other date's row changes

### Requirement: Failures are reported
The system SHALL let any failure (app unreachable, kDrive unavailable, email failure) reach the error workflow. Failure saving history SHALL NOT prevent an explicitly requested email attempt. Failure sending email SHALL NOT prevent a history attempt. An execution SHALL fail if either required output fails.

#### Scenario: kDrive unavailable
- **WHEN** saving to the history fails
- **THEN** Marisa still receives the summary and the error workflow alerts the shop

#### Scenario: App unreachable
- **WHEN** the app cannot be reached at 23:55
- **THEN** no summary is produced and the error workflow alerts the shop

### Requirement: Safe history updates
The system SHALL validate the existing CSV before replacement and use an ETag precondition on updates. A failed/incomplete listing or download SHALL NOT be treated as file absence. Concurrent changes, malformed history, duplicate dates, or a locked file SHALL fail without overwriting existing history. Existing files other than `basedatos.csv`, including `registro.txt`, SHALL remain untouched.

#### Scenario: Manual rerun without email
- **WHEN** a valid date is recalculated with send_email false
- **THEN** only its history row changes and no summary email is sent

#### Scenario: Concurrent history change
- **WHEN** the file changes between discovery and upload
- **THEN** the upload precondition fails and the execution reports an error without replacing the concurrent version
