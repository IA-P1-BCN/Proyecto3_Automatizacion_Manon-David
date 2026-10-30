# Execution evidence (issue #21)

Evidence of each flow running, one folder per flow. Each folder has a `README.md` with the scenarios, the expected result and a screenshot column. Replace `pending` as evidence is saved.

| Folder | Flow | HU / issue | Status |
|---|---|---|---|
| [01-reservation-confirmation](01-reservation-confirmation/) | 01 | HU-01 · #1 | screenshots saved; SMTP-break pending |
| [02-deposit-receipt](02-deposit-receipt/) | 02 | HU-02 · #2 | screenshots saved |
| [03-remote-deposits](03-remote-deposits/) | 03 | HU-03 · #3 | implementation and verified checks recorded; capture checklist and live limits inside |
| [04-large-sale-alert](04-large-sale-alert/) | 04 | HU-09 · #9 | pending |
| [05-daily-close](05-daily-close/) | 05 | HU-04 · #4 | text only; screenshots and real checks pending |
| [06-due-reminders](06-due-reminders/) | 06 | HU-06 · #6 | pending |
| [06b-expired-reservations](06b-expired-reservations/) | 06b | HU-07 · #7 | pending |
| [08-error-workflow](08-error-workflow/) | 08 | HU-05 · #5 | scenario screenshots, timing pending |
| [90-demo-data](90-demo-data/) | 90 | #20 | existing sample app/email captures are present in the folder |
| [21-execution-evidence](21-execution-evidence/) | full lifecycle | #21 | three reviewed lifecycle clips; publication edits and coverage limits documented inside |

## Full lifecycle (README deliverable 5)

Short video or screenshots of one reservation: creation, partial deposit, settlement, with the router executions and each email (flows 01 and 02). Save it here and link it below.

- [Reservation #27 lifecycle recordings and verification](21-execution-evidence/README.md).
- The recordings show creation, a partial payment and settlement of the same
  reservation. Their index distinguishes API/n8n verification, user-reported
  mailbox receipt and what is visually captured. Black window-switching segments
  do not prove received-email content; no additional messages or payments were
  generated to repair a recording gap.
