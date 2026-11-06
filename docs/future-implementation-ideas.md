# Postponed on purpose

> Ideas and decisions left for later. If it's here, it's a decision, not an oversight.

## Monthly report: "settled" and "expired" in the month (flow 7, Medium level)
Postponed on 2026-10-22 until the Medium level is reassessed.

**Problem:** the API gives no settlement date for a reservation.
**Candidate rules:** settled in the month = date of the last deposit; expired in the month = date of the voucher.

## Explicit opt-in for consent (HU-14, Advanced level)
Postponed on 2026-10-28. The consent register exists (see [the decision](decisions-clarify.md#personal-data-consent-register-hu-14)) but its basis is still "gave an email in the shop". Left for later: an opt-in email with a confirm link, and a link to withdraw consent from every message.

## Error Workflow: backup channel and alert grouping (flow 08)
Postponed on 2026-10-22. If we reach Advanced: a backup channel (Sheets or Telegram) in case the email fails, and a limit or summary for repeated alerts.

## Excel migration, HU-10 (Medium level)
Postponed on 2026-10-26, then taken up on 2026-10-27 (see the owner and timing decision). Decisions already made (idempotency by app lookup, migration-mode flag in flow 00, Spanish email report, doubtful-row rules, `forma_pago` fallback, owner Manon) are in [decisions-clarify.md](decisions-clarify.md#excel-migration-idempotency-hu-10).

## Home reservations: what was left out (HU-13, Advanced level)
Postponed on 2026-10-29. See [the decision](decisions-clarify.md#home-reservations-from-the-web-hu-13-option-a). Left for later:
- **Stale requests:** a reminder for, or automatic cancellation of, requests that stay `pendiente` for weeks.
- **Telegram** as a second way to ask for a reservation.
- **Card-terminal CSV** (the second option of HU-13): a nightly import as sales without duplicates.
- **Consent origin:** an `origen` input in flow 09 so the form's consent is recorded as `formulario` instead of `tienda`.
- **Shared name rules:** flow 03 exporting its name-matching functions so flow 11b stops keeping a copy.
- **Real catalogue:** replacing the mock price list with Marisa's real models and prices.
