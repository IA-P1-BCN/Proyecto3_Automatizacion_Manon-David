# Spec Delta

## Purpose

Loads the shop's old Excel into the app once, with cleaned data and the original dates, without creating duplicates when run again, and reports to Marisa the rows it did not load so she can decide.

## ADDED Requirements

### Requirement: Manual run over the two CSV files
The system SHALL run only when someone starts it by hand and gives it the two files, the apartados sheet and the sales sheet of the old Excel.

#### Scenario: Run
- **WHEN** someone opens the migration form and uploads the two CSV files
- **THEN** every data row is loaded, skipped or held back, and Marisa receives one report

#### Scenario: A file cannot be read
- **WHEN** a file is missing or its header columns are not the expected ones
- **THEN** nothing is created in the app and the execution fails so flow 08 alerts

### Requirement: Cleaning
The system SHALL clean dates, names, phones and amounts before using them, without changing their meaning, and SHALL NOT report a row as doubtful only because of format.

#### Scenario: Formats
- **WHEN** a row has date `7/9/26`, name `carmen ruiz`, phone `612 345 001` and abono `15€`
- **THEN** it is read as 2026-09-07, `Carmen Ruiz`, a phone and 15.00, and loaded normally

#### Scenario: Missing phone
- **WHEN** a row has no phone
- **THEN** it is loaded without one

#### Scenario: Unreadable value
- **WHEN** a row has no `fecha`, `importe` or `cliente`, or one that cannot be read
- **THEN** it is held back and reported with the reason

### Requirement: Apartados and abonos from the same sheet
The system SHALL treat the first row of a customer and product as the apartado with its initial abono, and every later row of the same customer and product as an abono, and SHALL create them with their original `fecha`.

#### Scenario: Apartado and later abonos
- **WHEN** Carmen Ruiz has rows on 02/09 (10) and 05/09 (20) for the same product
- **THEN** one apartado is created on 2026-09-02 with an initial abono of 10 and one abono of 20 dated 2026-09-05

#### Scenario: Amounts come from the app
- **WHEN** the CSV `resta` differs from what the app computes
- **THEN** the app's figures are kept and `resta` is ignored

### Requirement: Payment method
The system SHALL use, for each deposit, the `forma_pago` of the sales line with the same `fecha` and `importe`, and `efectivo` when there is none, and SHALL list the deposits that got the default in the report.

#### Scenario: Matching sales line
- **WHEN** the sales line of 06/10 for 10 € is `bizum` and Sofía Navarro's initial abono is 10 € on 06/10
- **THEN** the abono is created as `bizum`

#### Scenario: No matching line
- **WHEN** no sales line has the deposit's `fecha` and `importe`
- **THEN** the abono is created as `efectivo` and appears in the report as a default

### Requirement: Sales
The system SHALL load direct sales with their original `fecha`, and SHALL NOT load a sales line that repeats an apartado deposit, nor the hand-typed monthly total.

#### Scenario: Direct sale
- **WHEN** the sales sheet has `Calcetines pack 3`, 6.50, efectivo on 01/10
- **THEN** a sale is created with that `fecha`

#### Scenario: Repeated deposit
- **WHEN** a sales line is `Deportiva blanca T44 (abono inicial apartado)` and the same deposit is in the apartados sheet
- **THEN** no sale is created for it and it is not reported as doubtful

#### Scenario: Monthly total
- **WHEN** the sales sheet has the line `TOTAL SEPTIEMBRE (a mano)`
- **THEN** it is ignored

#### Scenario: Ordinary sale with the amount of a deposit
- **WHEN** a sales line such as `Crema calzado` has the same `fecha` and `importe` as an apartado deposit but its concept does not mention `abono` or `apartado`
- **THEN** it is loaded as a sale

#### Scenario: Deposit line without a matching deposit
- **WHEN** a sales line mentions `abono` or `apartado` but no apartado deposit has its `fecha` and `importe`
- **THEN** it is not loaded and it is held back for Marisa to decide

### Requirement: No duplicates on a second run
The system SHALL ask the app whether a row already exists before creating it, and SHALL create nothing that exists, counting identical rows on the same day.

#### Scenario: Run twice
- **WHEN** the migration finishes and is run again with the same files
- **THEN** nothing new is created and the report says every row was already loaded

#### Scenario: Partial first run
- **WHEN** a first run stopped halfway and is run again
- **THEN** only the rows that were not created are created

#### Scenario: Identical rows on one day
- **WHEN** the CSV has two identical 5 € abonos on the same day for one apartado and the app has one
- **THEN** exactly one more is created

### Requirement: Doubtful rows are held back
The system SHALL NOT load a row that breaks a business rule, and SHALL NOT load any later abono of an apartado that was held back. It SHALL list each such row with its reason in the report.

#### Scenario: Initial abono under 5 €
- **WHEN** Lucía Gómez's initial abono is 4 €
- **THEN** her apartado is not created, and her later abono of 41 € is held back as depending on it

#### Scenario: Abono above the pending balance
- **WHEN** an abono is larger than what the apartado still owes at that date
- **THEN** the abono is held back and reported

#### Scenario: Price differs inside one reservation
- **WHEN** a later row of the same customer and product has a different `precio` than the first
- **THEN** that row is held back and reported

#### Scenario: Rejected by the app
- **WHEN** the app answers `422` to a create that the checks above let through
- **THEN** the row and the rows that depend on it are held back with the app's message, and the run goes on

#### Scenario: Marisa decides
- **WHEN** a row is held back
- **THEN** nothing about it is created in the app and the report says what Marisa has to decide

### Requirement: Report to Marisa
The system SHALL send Marisa one Spanish email per run with the number of rows loaded, skipped as already loaded and held back, a table of the held rows with their reason, and the deposits that used the default payment method.

#### Scenario: Normal run
- **WHEN** a run ends
- **THEN** Marisa receives the email at the shop address with those four parts, even when a part is empty

#### Scenario: No shop address
- **WHEN** the shop address is not configured
- **THEN** the execution fails so flow 08 alerts

### Requirement: Migration flag
The system SHALL set the migration flag on before creating anything and off when the run ends, whether it succeeds or fails.

#### Scenario: Successful run
- **WHEN** the run completes
- **THEN** the flag is off afterwards

#### Scenario: Late events
- **WHEN** the app's events for the last creates reach the router after the creates have finished
- **THEN** the flag is still on for them, because it is switched off only after a short wait

#### Scenario: Failed run
- **WHEN** a step fails after the flag was set on
- **THEN** the flag is set off in the error path, and the alert says if it could not be

### Requirement: Failures are visible
The system SHALL fail the execution when an API call fails for a reason other than a rule (unreachable app, `401`, `5xx`), connect flow 08 as the Error Workflow, and SHALL NOT report such a row as doubtful.

#### Scenario: App unreachable
- **WHEN** the app does not answer
- **THEN** the execution fails, flow 08 alerts, the flag is set off, and re-running loads what is missing
