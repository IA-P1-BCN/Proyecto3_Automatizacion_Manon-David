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
