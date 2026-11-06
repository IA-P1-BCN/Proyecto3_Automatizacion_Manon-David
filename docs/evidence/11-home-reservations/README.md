# Evidence · 11 Home Reservations and 11b Match Pending Request (issue #13)

Run on 2026-10-29 on the team's n8n (manual executions, flows inactive), with the app of this repo. Screenshots of the form, the shop email and the customer email are pending (task 5.4): save them in this folder as `form.png`, `shop-email.png` and `customer-email.png`. What follows is text taken from the runs, or rendered from the tested helper where it says so.

Commands used: `node --test workflows/code/*.test.js` (305 tests passed on 2026-10-29) and manual executions of `03 New Remote Deposits`, `11 Home Reservations` and `11b Match Pending Request`.

## Flow 03 with the hook · the nine synthetic notices

Manual mode, `allow_external_ai` on for the run and off afterwards; `allow_payment_registration` and `allow_shop_notices` off. Executions 183, 185, 187, 189, 191, 192, 194, 196, 197.

| Case | Hook input held `payment`, `payment_key`, `allow_payment_registration` | Hook answer | Outcome |
|---|---|---|---|
| 01 | yes | `not_mine` | Review (two active reservations for the same name) |
| 02 | yes | `not_mine` | Apartado 2 selected, stopped at the proposal |
| 03 | yes | `not_mine` | Apartado 3 selected, stopped at the proposal |
| 04 | yes | `not_mine` | Review (15 € against 10 € pending) |
| 05 | hook not reached | none | Review, `missing_payment_concept` |
| 06 | yes | `not_mine` | Review (reservation overdue) |
| 07 | yes | `not_mine` | Review, no candidates |
| 08 | hook not reached | none | Ignored, `not_a_payment` |
| 09 | yes | `not_mine` | Apartado 24 selected, `decision: register`, stopped at the proposal |

The Data Table held two unrelated rows (SOL-0001 `confirmada`, SOL-0002 `pendiente`), not none.

## A pending request, registration off then on

A synthetic 10 € Bizum from `MARTA GIL` with concept `SOL-0002`, injected from the manual trigger.

- Registration off (execution 199): decision `review`, reason `Vista previa: se habría creado el apartado de la solicitud SOL-0002 con un abono inicial de 10,00 €.` Row SOL-0002 stayed `pendiente`; no apartado.
- Registration on in the draft only (execution 201): decision `created`, `apartado_id` 47. The row became `confirmada` with `apartado_id` 47 and the payment key. The app's apartado 47 is `activo`, paid 10 €, pending 99 €.
- Router execution 203 passed `apartado.creado` to flow 01 (execution 205), which sent one confirmation (SMTP accepted, one recipient). No email node ran in flow 03 or 11b.

Customer confirmation sent by flow 01 (captured from execution 205):

```
Asunto: Tu apartado en Paso Firme: Bota alta negra

Hola Marta Gil,

Hemos registrado tu apartado nº 47.

Modelo:      Bota alta negra
Talla:       40
Precio:      109,00 €
Abonado:     10,00 €
Pendiente:   99,00 €
Fecha límite: 27/01/2027

Gracias por confiar en Zapatería Paso Firme.
```

## Emails of flow 11 · rendered from the helper

Not a capture: these are the two emails that `planEmails` in `workflows/code/11-home-reservations.js` builds for the SOL-0002 row, with example addresses. The real emails from the form run are the ones to screenshot.

```
Para: tienda@example.com
Asunto: Nueva solicitud de apartado SOL-0002

Marisa, hay una nueva solicitud de apartado desde casa.

Referencia: SOL-0002
Cliente: Marta Gil
Teléfono: no indicado
Correo: marta.gil@example.com
Modelo: Bota alta negra, talla 40
Precio: 109,00 €

La clienta o el cliente ya sabe cómo pagar el abono inicial. Cuando llegue su Bizum o transferencia, el apartado se creará solo.
```

```
Para: marta.gil@example.com
Asunto: Hemos recibido tu solicitud de apartado

Hola Marta Gil,

Hemos recibido tu solicitud: Bota alta negra, talla 40, 109,00 €.

Para confirmarla, haz un Bizum o una transferencia de al menos 5,00 € e indica SOL-0002 como concepto.
Tu apartado no será válido hasta que recibamos ese abono.

(texto de TIENDA_PAGO_INSTRUCCIONES)

Zapatería Paso Firme
```

## Limits

- Two payments at once and the app failing during creation were not run in n8n; they are covered by unit tests only.
- The repeat of the same payment, the 3 € refusal and the already-processing case were run in n8n (task 4.5).
- The nine notices and the SOL-0002 notice are synthetic; no real bank email was used.
