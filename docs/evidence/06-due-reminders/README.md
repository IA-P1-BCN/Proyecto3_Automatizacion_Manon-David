# Evidence · Flow 06 Due Reminders (HU-06 / issue #6)

Test notes: `workflows/tests/06-due-reminders.md`. Save screenshots in this folder; crop out secrets, tokens and customer data that is not demo data.

**Setup:** (n8n version, flows imported, published flows, credentials by name only)

**Date and tester:**

| # | Scenario | Action | Expected | Result | Screenshot |
|---|---|---|---|---|---|
| 1 | 7-day reminder | Manual trigger, `fecha` = deadline − 7 | One Spanish email, one new row in `avisos.csv` | pending | pending |
| 2 | Rerun same date | Run the same date again | No email, no new row | pending | pending |
| 3 | 1-day reminder | `fecha` = deadline − 1 | 1-day email, second row | pending | pending |
| 4 | No email | Reservation without email | One shop alert, `sin_email` row, no second alert on rerun | pending | pending |
| 5 | SMTP broken | Wrong SMTP password for one run | Execution fails, flow 08 alert, no row; next run sends it | pending | pending |
| 6 | Schedule 09:00 | Publish for the test (with permission) | Fires once, Madrid time; unpublish | pending | pending |

**Notes / deviations:**
