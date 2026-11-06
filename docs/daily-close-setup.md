# HU-04 / Flow 05 — Daily close with kDrive

Issue #4 — HU-04 · Cierre de caja automático. Branch: `feat/4-daily-close`.

## Files and generation

- `workflows/code/05-daily-close.js`: pure date, monetary and CSV logic.
- `workflows/code/build-05-daily-close.js`: reproducibly generates `workflows/05-daily-close.json` (inactive, no credentials).
- `workflows/code/05-daily-close.test.js`: local tests.
- `workflows/tests/05-daily-close.md`: contract cases and real integration checklist.

Run the generator from the repository root, then the tests. The OpenSpec CLI is not installed in the current terminal; artifacts were reviewed/updated directly, not CLI-validated.

## Local configuration

Set these non-secret values in your ignored `.env`, using your own Drive and folder identifiers:

```dotenv
KDRIVE_DRIVE_ID=
KDRIVE_DIRECTORY_ID=
```

The current user's intended folder is `paso_firme` (folder ID 7). Their `registro.txt` (ID 8) is out of scope. IDs are not embedded in exported JSON. The flow uses a fixed name `basedatos.csv` only. Do not point at an unrelated folder/history.

Set `TIENDA_EMAIL_FROM` and `TIENDA_EMAIL_AVISOS` locally; both must be valid controlled test addresses. Compose passes these and the two kDrive IDs into n8n. Run `docker compose up -d` after changing `.env`; this recreates affected containers but does not delete volumes. Host ports are controlled separately by `TIENDA_PORT` / `N8N_PORT_HOST`. Internal API access stays `http://tienda:8000`.

## Import and credential assignment

1. Import `workflows/05-daily-close.json` into your local n8n. It stays unpublished until explicitly authorized.
2. Select the shop **Header Auth** credential (`Name: X-API-Key`) on **Fetch Sales** and **Fetch Deposits**.
3. Select the Infomaniak **Header Auth** credential (local name `token_n8n`, `Name: Authorization`, value is Bearer + drive-scoped token) on **List History Folder**, **Download History**, and **Save History**. The name alone does not prove type/permissions. Never export the token.
4. Select your SMTP credential on **Send Closing Email**. No Gmail or Google Sheets is required for this issue.
5. In workflow Settings choose your local **08 Error Workflow** as Error Workflow. IDs differ between teammates, so this reference must be selected locally; the export does not guess it.
6. Review timezone Europe/Madrid and cron `55 23 * * *`. Publication requires user permission.

Do not extract/decrypt the existing n8n credentials to automate setup. A JSON file is not automatically installed just because it exists in Git. No live import, credential association, schedule activation, email send or cloud upload is claimed by the generator.

## Running and recalculating

For a local manual run, open **Choose Date and Email**. Set `fecha` to the selected `YYYY-MM-DD` date and `send_email` to false (default) or true if a new summary should be sent. The default date expression evaluates today in Madrid. Run from **Manual Close**. This is not an exposed form or public webhook.

For publication, the credential-free generated export restores those safe defaults even if the local editor was left on yesterday/send-email-true during tests. `Download History` returns a full text response with the CSV in **`data`** on n8n 2.32.6; the update code explicitly reads that field. JSON responses from the other HTTP nodes continue to use **`body`**. Reimporting is not required to keep using your manually configured local workflow.

The schedule uses Madrid's current date and always requests email. It reads `/api/ventas` and `/api/abonos`, inclusive same-date bounds. Initial payments are already deposits; do not add them again as sales. Amounts are summed as integer cents. `otros` retains unexpected payment methods instead of dropping them. Bizum includes transfers by the team's existing decision.

Transactions added after 23:55 require a manual recalculation of that original date. They do not automatically move to tomorrow's date-filtered close. Edit transactions through the app's allowed mechanisms, not the CSV; the closing workflow only reads transactions.

## Persistence and failure behavior

Folder discovery follows cursor pagination, max 100 requests of up to 1000 children. Only a complete successful listing can prove absence. The exact `basedatos.csv` must be an unlocked file with an ETag. Existing CSVs must have the expected columns, valid unique dates and consistent totals. The flow refuses corrupt/unrecognized content rather than erase it. Empty days still have a zero row. Other rows are preserved and sorted.

New history upload uses a raw UTF-8 BOM CSV body, `directory_id`, `file_name=basedatos.csv`, `total_size` measured in bytes, and `conflict=error`. Existing uploads use `file_id` only (not conflicting directory/name parameters), with `If-Match` from discovery. No delete/recreate or rename fallback, and no blind POST retry. ETag conflicts/uncertain writes require inspecting the file and rerunning a fresh read. The workflow rediscovers its ID each run, so no mutable in-memory ID cache can get out of sync after a failed execution.

Use one scheduled writer for a shared history, or separate per-teammate folders. ETags prevent concurrent overwrite but do not merge concurrent updates automatically. Output exceeding 5 MB aborts safely; review the storage strategy rather than silently truncate it.

Known review follow-up: the current implementation sorts history by date. The user subsequently requested insertion order (append a new date; replace an existing date in place). That change has not been applied to the live/manual workflow or this review delivery and remains an explicit blocker for final acceptance, not an intentional exception to the request.

If requested, email is attempted first with errors captured. History then runs regardless of SMTP success. A successful save followed by a remembered SMTP error still fails at **Verify Result**. A storage error fails at its own node, after the email attempt. This deliberately isolates effects rather than relying on visual branches running concurrently. SMTP has no automatic retry: provider acceptance after a timeout cannot guarantee exactly-once email. Rerunning manually defaults to no email.

When a workflow is executed manually in the editor, n8n does not invoke its Error Workflow. Validate automatic error alerts with an explicitly authorized published execution/test. If SMTP itself is down, flow 08 using the same SMTP may also fail; this delivery does not claim a second alert channel.

## Verified API contracts

Source: Infomaniak developer portal, inspected 2026-10-23:

- [List folder](https://developer.infomaniak.com/docs/api/get/3/drive/{drive_id}/files/{file_id}/files): cursor, limit, `with=etag`; `has_more`/cursor response.
- [Download](https://developer.infomaniak.com/docs/api/get/2/drive/{drive_id}/files/{file_id}/download): content may redirect to download URL.
- [Upload](https://developer.infomaniak.com/docs/api/post/3/drive/{drive_id}/upload): raw binary, `total_size`, create parameters or alternative `file_id`, conflict policy, If-Match.

`GET /2/drive` listing drives additionally needs `account_id`; the file-scoped operations above use `drive_id` instead. WebDAV is not assumed on the free plan. User confirmed token-based reading; write/replace behavior on the actual account remains to be tested in n8n with its local credential.
