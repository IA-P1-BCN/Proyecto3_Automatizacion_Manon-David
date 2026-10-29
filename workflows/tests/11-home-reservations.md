# Test payloads · 11 Home Reservations and 11b Match Pending Request (issue #13)

The Code node logic is covered by `node --test workflows/code/11-home-reservations.test.js` and `node --test workflows/code/11b-match-request.test.js` (run from the repo root). The tables below test the flows in n8n. Sample data, no real customers; use your own email and a test inbox in `TIENDA_EMAIL_AVISOS`.

Set-up: the Data Table `solicitudes_apartado` exists (columns `ref`, `nombre`, `telefono`, `email`, `producto`, `talla`, `precio`, `estado`, `apartado_id`, `fecha`, `payment_key`), flow 11b is imported, and the flow 03 copy with the hook is imported in your own draft. Payment registration stays **off** (`allow_payment_registration` false) except in rows marked *registration on*; turn it on only in your own draft and off again afterwards.

## Flow 11 · request form (open the form URL, submit)

| # | Submission | Expected result | Spec scenario |
|---|---|---|---|
| 1 | "Ana Pérez", own email, `Zueco cuero negro - 64,50 €`, size 38, consent ticked | One row `pendiente` with `SOL-0001`, price 64.5; no apartado in the app; completion page shows the reference; shop email with the request; customer email with the reference, `64,50 €`, the 5,00 € minimum and the payment instructions | Valid request · Request stored · Marisa is notified · Consent given |
| 2 | Same as #1 but consent not ticked | The form refuses it (required box); if forced, "Necesitamos tu permiso…" and no row | Missing consent |
| 3 | Empty name, or email `ana`, or no model | Page lists the field to fix; no row, no email | Invalid data |
| 4 | Edit the page so the model label reads `Zueco cuero negro - 1,00 €` | "Elige un modelo de la lista."; no row | Altered price |
| 5 | Model from the list | Row stores the list price (not anything from the form) | Known model |
| 6 | Same email, model and size as #1 while its row is `pendiente` | No second row; page shows `SOL-0001` | Same form submitted twice |
| 7 | Same as #1 after setting its row to `confirmada` (or `cancelada`) | New row `SOL-0002` | Earlier request already settled |
| 8 | Email whose consent row is `retirado` | Row stays `retirado`; no customer email; the shop email says to contact the customer another way | Consent withdrawn earlier |
| 9 | New email with no consent row | Row `activo` appears in `consentimientos` | New consent |
| 10 | `TIENDA_PAGO_INSTRUCCIONES` empty (restart n8n) | Customer email says to ask in the shop how to pay | Payment instructions not configured |
| 11 | SMTP credential broken for one run | Row `SOL-…` stays `pendiente`; execution fails; flow 08 alerts | Notification fails |

## Flow 11b · payments (inject a notice in the flow 03 copy, or run 11b by hand with a `payment`)

Pending requests for these rows: `SOL-0007` for "Ana Pérez" (Zueco cuero negro, size 38, 64,50 €).

| # | Payment | Expected result | Spec scenario |
|---|---|---|---|
| 12 | Bizum 20,00 € from `ANA PEREZ LOPEZ`, concept `SOL-0007`, *registration on* | Apartado `activo` with a 20,00 initial deposit; row `confirmada` with `apartado_id`; one confirmation email from flow 01 and none from these flows; flow 03 registers nothing else | Payment with the reference · Payment for a pending request · Confirmation email comes from the usual flow · Apartado created from a request |
| 13 | Same with concept `sol 7` | Treated as `SOL-0007` | Reference spelled loosely |
| 14 | Payer also has an active reservation, concept `SOL-0007` | Apartado created from the request; the old reservation untouched | Reference wins over an existing reservation |
| 15 | Payer `ANTONIO FERNANDEZ SOTO`, concept `SOL-0007` | Nothing created; review email "no coincide"; row stays `pendiente` | Wrong payer |
| 16 | Concept `SOL-0099`, or `SOL-0007 SOL-0008`, or a request already `confirmada` / `cancelada` / `procesando` | Nothing created; review email with the reason | Unknown, repeated or settled reference |
| 17 | Concept `zuecos`, payer `ANA PEREZ LOPEZ`, no active reservation, one pending request | Apartado created from that request | One clear request |
| 18 | Same as #17 but the payer also has an active reservation | Nothing created; review email "decide Marisa" | Request and reservation for the same person |
| 19 | Same as #17 with two pending requests for "Ana Pérez" | Nothing created; review email | Several requests |
| 20 | Payer `ANA P.`, concept `zuecos` | `not_mine`: flow 03 continues as before | Abbreviated payer without the reference |
| 21 | Payer `CARMEN RUIZ GARCIA`, concept `zuecos`, no matching request | `not_mine`; existing flow 03 outcome | Payment unrelated to any request · Payment not about a request |
| 22 | The nine sample notices (cases 01 to 09) with an empty table | Each has exactly the outcome it had before | Existing sample notices |
| 23 | #12 with *registration off* | "Vista previa…" review email; row unchanged; nothing created | Preview only · Registration disabled |
| 24 | Two executions for `SOL-0007` started together, *registration on* | One apartado; the other review "ya se está procesando" | Two payments at once · Request already being processed |
| 25 | Bizum 3,00 € with `SOL-0007`, *registration on* | App refuses (minimum 5 €); row back to `pendiente`; Marisa receives the app's message | App refuses the amount |
| 26 | App stopped during creation (`docker compose -p paso-firme stop tienda`), *registration on* | Row stays `procesando`; review email warns not to register by hand; execution fails; flow 08 alerts | Outcome unknown |
| 27 | Make the Data Table update fail after the app answered (rename the table for the run) | Review email asks to fix the row by hand and check the app; execution fails | Table cannot be updated afterwards |
| 28 | App stopped before matching | Execution fails at *Read Active Reservations*; no row changes; flow 08 alerts | App unreachable while reading reservations |
| 29 | Make 11b answer something unexpected (for example `decision` set to `x`) | Flow 03 sends it to the review email | Unexpected answer |
| 30 | A review answer from 11b | Usual flow 03 review email with the reason; nothing registered | Doubtful request payment · Answers other than created use the existing review path |
| 31 | An uncertain answer from 11b | Review email with the warning; execution fails for flow 08 | Uncertain creation |
| 32 | A created answer from 11b | Flow 03 ends at the NoOp: no second deposit, no customer message | Apartado created from a request |

Rows 24 to 28 change the stack or the table: restore them afterwards. Turn registration off again after any *registration on* row.

To set up a pending request without the form, add a row by hand in `solicitudes_apartado` with `estado` `pendiente` and an empty `payment_key`.
