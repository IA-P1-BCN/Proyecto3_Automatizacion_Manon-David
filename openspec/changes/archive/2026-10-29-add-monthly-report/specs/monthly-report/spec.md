# Spec Delta

## Purpose

Provide Marisa with a reproducible monthly collection report, current active outstanding balances and explicitly attributable reservation counts, without manual arithmetic or invented historical dates. Implements issue #8 — HU-08 · Informe mensual.

## ADDED Requirements

### Requirement: Previous calendar month in Madrid
The system SHALL schedule the report on day 1 at 09:00 Europe/Madrid and cover the preceding complete calendar month. API date filters SHALL be inclusive YYYY-MM-DD business dates. A manual preview SHALL accept a closed month and default to not sending email.

#### Scenario: November delivery
- **WHEN** the scheduled execution runs on 2026-11-01 at 09:00 Madrid time
- **THEN** it queries 2026-10-01 through 2026-10-31, including both dates and excluding November movements

#### Scenario: January and leap year
- **WHEN** a manual preview selects December 2026 or February 2028
- **THEN** it uses 2026-12-01 through 2026-12-31 or 2028-02-01 through 2028-02-29 respectively

#### Scenario: Unsafe manual period
- **WHEN** the selected month is invalid, current or future
- **THEN** the run rejects it without sending a report

### Requirement: Exact collections by source and method
The system SHALL sum API sales and deposits separately in whole cents, including initial deposits once, and display cash, card, Bizum and combined totals. Unknown payment methods SHALL be visible rather than discarded. The report SHALL state that Bizum includes transfers and SHALL NOT label collections as profit.

#### Scenario: Mixed collections
- **WHEN** sales are EUR 6.50 cash and EUR 20 card, and deposits are EUR 10 cash and EUR 5 Bizum
- **THEN** sales total EUR 26.50, deposits EUR 15, combined collections EUR 41.50, with cash EUR 16.50, card EUR 20 and Bizum EUR 5

#### Scenario: Decimal precision
- **WHEN** valid movements are EUR 0.10 and EUR 0.20
- **THEN** the report total is exactly EUR 0.30

### Requirement: Current active pending balance
The system SHALL sum the API's `pendiente` for reservations currently `activo`, without recomputing individual balances. It SHALL label the result as current at consultation time, not a historical month-end balance.

#### Scenario: Terminal states excluded
- **WHEN** active reservations have pending EUR 14 and EUR 40 and an expired reservation has pending EUR 30
- **THEN** the displayed current active pending total is EUR 54, not EUR 84

### Requirement: Reservation counts with disclosed accounting dates
The system SHALL count new reservations by `fecha`, currently `liquidado` reservations by the latest date among their recorded payments, and `vencido` reservations by their associated voucher date. It SHALL count distinct reservation IDs and disclose that settlement is attributed by payment date, not a stored state-transition timestamp.

#### Scenario: Imported settlement
- **WHEN** a currently settled reservation has its last dated payment on 2026-09-25, loaded into the app in October
- **THEN** it counts as settled in September, not October, without claiming a September state-change timestamp

#### Scenario: Fully paid on creation
- **WHEN** a reservation is created fully paid on 2026-10-15
- **THEN** it counts as both new and settled in October, with its initial payment counted once as a deposit

#### Scenario: Deadline and voucher cross a month boundary
- **WHEN** a reservation's deadline is 2026-11-30 and its voucher is issued on 2026-12-01
- **THEN** it counts as expired in December, not November

### Requirement: Complete and validated source data
The system SHALL use complete API results, validate dates, amounts, IDs and required relationships, and reject duplicate or malformed source data. Missing settlement payments or expiry vouchers SHALL NOT be silently counted as zero. A failed or incomplete API response SHALL NOT produce an apparently complete financial report.

#### Scenario: More than a default page
- **WHEN** the app contains more reservations or sales than its default page size
- **THEN** the report includes every matching record, not just the first page

#### Scenario: Invalid settlement data
- **WHEN** a currently settled reservation has no usable payment date
- **THEN** the run fails with a sanitized diagnostic rather than inventing a settlement month

#### Scenario: Empty month
- **WHEN** all source lists are valid and there are no movements or newly created reservations in the selected month
- **THEN** the report displays zero collections and counts, explicitly says there were no movements, and still displays any current active pending balance

### Requirement: Spanish owner delivery and safe previews
The system SHALL send a Spanish HTML-table report to the configured shop recipient using existing SMTP credentials. It SHALL include the period, source/method totals, pending-balance consultation time and counting definitions. Manual previews SHALL send nothing unless explicitly enabled. The workflow SHALL NOT write business records or call an AI provider.

#### Scenario: Read-only preview
- **WHEN** a user executes a manual report with email disabled
- **THEN** the report is available in the editor without SMTP delivery, payment creation or other business writes

#### Scenario: Scheduled entry clicked in a manual test
- **WHEN** a user starts the scheduled entry from the editor or CLI instead of an actual automatic trigger
- **THEN** it stops before API reads or SMTP, with instructions to select Manual Report Preview, rather than treating the click as automatic delivery

#### Scenario: Controlled delivery
- **WHEN** email is explicitly enabled for the approved test recipient
- **THEN** one report email contains the same totals as the preview and no customer contact list

### Requirement: Delivery safety and errors
The system SHALL report unexpected failures through the configured shared Error Workflow and SHALL NOT blindly retry SMTP delivery. Normal automatic reruns after confirmed successful delivery SHALL suppress a duplicate report for that period. Recovery from uncertain delivery SHALL require checking execution history rather than claiming exactly-once SMTP delivery.

#### Scenario: Source service unavailable
- **WHEN** the shop API remains unavailable after bounded read retries
- **THEN** no financial report is sent and the shared error path receives a sanitized failure

#### Scenario: Repeated confirmed automatic delivery
- **WHEN** the same period is run automatically after its successful delivery was recorded
- **THEN** another report email is skipped

### Requirement: Optional PDF preserves the email baseline
If local PDF support is delivered, the system SHALL generate it from the same report data and attach it to the single table email. Conversion SHALL remain local, without AI or external conversion services. Conversion failure SHALL still allow the valid table email, identify the missing PDF and expose a sanitized diagnostic without sending a second report email.

#### Scenario: PDF success
- **WHEN** local conversion succeeds for the report
- **THEN** the email contains the table and a readable PDF with matching figures, Spanish accents and EUR formatting

#### Scenario: PDF conversion fails
- **WHEN** the optional converter is unavailable or returns an invalid file
- **THEN** the table email is still attempted without attachment and clearly states that PDF generation failed
