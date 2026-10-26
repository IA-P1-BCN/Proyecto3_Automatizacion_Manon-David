# README changes to apply

`README.md` is the supplied assignment (Spanish), so it is not edited by the agents. These are the changes the team should apply when convenient. They cover tasks 5.1 and 5.2 of `openspec/changes/add-error-workflow`, task 4.2 of `openspec/changes/add-event-router` and task 3.2 of `openspec/changes/add-deposit-receipt` and task 3.2 of `openspec/changes/add-reservation-confirmation` and task 5.2 of `openspec/changes/add-large-sale-alert`, plus two corrections found while working on flow 08. Suggested README text is in Spanish.

## 1. Credentials and variables used by flow 08 (task 5.1)

Add to the README's credentials/variables list (names only, never values):

| Name | Type | Used for |
|---|---|---|
| SMTP (Infomaniak mailbox) | n8n credential | Send the alert email |
| `TIENDA_EMAIL_AVISOS` | environment variable in `.env` | Address that receives the alerts (Marisa) |
| `TIENDA_EMAIL_FROM` | environment variable in `.env` | Sender mailbox, the same as the SMTP credential's account |
| `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` | set in `docker-compose.yml` | Lets flows read `$env.…` (blocked by default since n8n v2) |
| `TIENDA_PORT` (optional) | environment variable in `.env` | Browser port of the app when 8000 is busy; n8n still uses `http://tienda:8000` |

Suggested text:

> **Configuración de los avisos de error (flujo 08).** Copia `.env.example` a `.env` y rellena `TIENDA_EMAIL_AVISOS` (dirección que recibe los avisos) y `TIENDA_EMAIL_FROM` (buzón desde el que se envía). En n8n crea la credencial SMTP del buzón (contraseña de buzón generada en Infomaniak). Las *Variables* de n8n son de pago, por eso se usan variables de entorno. Si el puerto 8000 está ocupado, pon `TIENDA_PORT=8001` en tu `.env`: solo cambia la URL en tu navegador (`http://localhost:8001`); dentro de n8n sigue siendo `http://tienda:8000`.

## 2. Failed executions must be checked (task 5.2)

If the alert email itself cannot be sent, nobody is notified automatically (decided: no backup channel). Suggested text:

> **Revisa el historial de ejecuciones.** Si falla el propio correo de aviso (credencial caducada, sin red), el error solo queda en el historial de n8n. Revisa de vez en cuando la pestaña *Executions* y filtra por *Error*.

And the setup step:

> **Conecta cada flujo con el flujo 08.** En cada flujo Essential (01, 02, 03 y 05): *Settings → Error Workflow → `08 Error Workflow`*. Sin esto no llegan los avisos de ese flujo. Vale también para el flujo 00 (router) y para cada flujo que llame a otro: el fallo de un flujo llamado solo avisa si ese flujo tiene su propio *Error Workflow*.

## 3. Corrections

- **Number of sample emails:** the README says 8 (`El flujo 3 resuelve bien los 8 correos…`, near line 348). `data/correos/` holds **9** files. Suggested: "los 9 correos".
- **Email provider:** the README lists Gmail as an example (lines near 140 and 153). The team uses an Infomaniak mailbox (IMAP to read, SMTP to send). No change is required because the README says "Gmail o IMAP", but the project documents say Infomaniak.

## 4. Event router, flow 00 (router task 4.2)

Suggested text for the README (webhook, URLs, publishing and lost events):

> **El router de eventos (flujo 00).** La app avisa de todo lo que pasa con un `POST` a `http://n8n:5678/webhook/tienda` (es el valor de `N8N_WEBHOOK_URL` en `.env`). Un solo flujo, `00 Event Router`, recibe ese aviso y lo reparte por el campo `evento`: `apartado.creado` va al flujo 01 y `abono.registrado` al flujo 02. Los eventos que aún no tienen flujo (`venta.registrada`, `apartado.vencido`) o con un nombre desconocido se aceptan y se ignoran, sin error. Si el aviso llega sin nombre de evento, el router falla a propósito y el flujo 08 avisa.
>
> **Dos direcciones, no las confundas.**
>
> | Dirección | Cuándo funciona |
> |---|---|
> | `http://n8n:5678/webhook-test/tienda` (Test URL) | Solo mientras pulsas *Listen for test event* en el editor, y para un único aviso. Úsala para ver cómo es un aviso |
> | `http://n8n:5678/webhook/tienda` (Production URL) | Cuando el router está **publicado**. Es la que usa la app de verdad |
>
> **Puesta en marcha.** Importa los flujos (`python scripts/import_new_workflows.py --run` o desde el editor), abre los nodos *Call …* del router y elige el flujo al que llaman (los identificadores cambian en cada n8n), pon *Settings → Error Workflow → `08 Error Workflow`* **en el router y en cada flujo que recibe eventos** (el aviso de un flujo llamado solo llega si ese flujo tiene su propio *Error Workflow*), y publica primero los flujos 01 y 02 y después el router.
>
> **Si n8n está parado o el router no está publicado, el aviso se pierde:** la app envía cada evento una sola vez, sin reintentos. Antes de una demo: `docker compose up -d` y el router publicado. Los flujos programados (cierre diario, recordatorios) no dependen de estos avisos, porque consultan la API.

Checked: the routing, import and Error Workflow steps were run in a clean throwaway n8n and in the team's n8n (see `workflows/tests/00-event-router.md`). A literal `docker compose up -d` from an empty volume was not repeated for this task.

## 5. Deposit receipt, flow 02 (deposit-receipt task 3.2)

Add to the README's credentials/variables list (names only, never values). Flow 02 introduces nothing new: it reuses what flows 08 and 00 already need.

| Name | Type | Used for |
|---|---|---|
| SMTP (Infomaniak mailbox) | n8n credential, chosen in the three *Send …* nodes | Send the receipt to the customer and the alert to the shop |
| `TIENDA_EMAIL_FROM` | environment variable in `.env` | Sender of the receipt |
| `TIENDA_EMAIL_AVISOS` | environment variable in `.env` | Address that receives the "deposit without a valid email" notice (Marisa) |
| `08 Error Workflow` | *Settings → Error Workflow* of flow 02 | Alert when sending the receipt fails |

Suggested text:

> **Recibo de cada abono (flujo 02).** Cada vez que la app registra un abono, desde la pantalla o desde la API, el router llama al flujo `02 Deposit Receipt`, que envía a la clienta un recibo con lo abonado, lo pendiente y la fecha límite, tal y como los calcula la app. Si el abono deja el apartado `liquidado`, el mensaje le dice que ya puede recoger sus zapatos. Si el apartado no tiene email, o el email no tiene `@`, no se envía nada a la clienta y la tienda recibe un aviso con el número de apartado, la clienta, el teléfono y lo abonado. El abono inicial de un apartado nuevo no genera este recibo: lo cubre la confirmación del flujo 01.
>
> **Puesta en marcha.** Importa `workflows/02-deposit-receipt.json`, elige tu credencial SMTP en los tres nodos *Send …*, pon *Settings → Error Workflow → `08 Error Workflow`*, publícalo, y en el router elige este flujo en el nodo *Call Deposit Receipt (flow 02)*. Si n8n está parado cuando se registra el abono, no hay recibo: la app no reintenta.

Checked: payloads and results in `workflows/tests/02-deposit-receipt.md`.

## 6. Reservation confirmation, flow 01 (reservation-confirmation task 3.2)

Add to the README's credentials/variables list (names only, never values). Flow 01 introduces nothing new: it reuses what flows 08, 00 and 02 already need.

| Name | Type | Used for |
|---|---|---|
| SMTP (Infomaniak mailbox) | n8n credential, chosen in the two *Send …* nodes | Send the confirmation to the customer and the alert to the shop |
| `TIENDA_EMAIL_FROM` | environment variable in `.env` | Sender of the confirmation |
| `TIENDA_EMAIL_AVISOS` | environment variable in `.env` | Address that receives the "reservation without a valid email" notice (Marisa) |
| `08 Error Workflow` | *Settings → Error Workflow* of flow 01 | Alert when sending the confirmation fails |

Suggested text:

> **Confirmación al apartar (flujo 01).** Cada vez que se crea un apartado, desde la pantalla o desde la API, el router llama al flujo `01 Reservation Confirmation`, que envía a la clienta un correo con el modelo, la talla (si la hay), el precio, lo abonado, lo pendiente y la fecha límite, tal y como los da la app. Si el apartado ya nace `liquidado`, el mensaje le dice que puede recoger sus zapatos. Si el apartado no tiene email, o el email no tiene `@`, no se envía nada a la clienta y la tienda recibe un aviso con el número de apartado, la clienta, el teléfono y el modelo, para que la contacte.
>
> **Puesta en marcha.** Importa `workflows/01-reservation-confirmation.json`, elige tu credencial SMTP en los dos nodos *Send …*, pon *Settings → Error Workflow → `08 Error Workflow`*, publícalo, y en el router elige este flujo en el nodo *Call Reservation Confirmation (flow 01)*. Si n8n está parado cuando se crea el apartado, no hay confirmación: la app no reintenta.

Checked: payloads and results in `workflows/tests/01-reservation-confirmation.md`. Screenshots of the received emails: `docs/evidence/01-reservation-confirmation/`.

## 7. Large sale alert, flow 04 (large-sale-alert task 5.2)

Add to the README's credentials/variables list (names only, never values). Flow 04 reuses the SMTP credential and the two address variables of flows 08 and 02, and adds one variable:

| Name | Type | Used for |
|---|---|---|
| `TIENDA_UMBRAL_VENTA_GRANDE` | environment variable in `.env` (passed to n8n by `docker-compose.yml`) | Amount in euros, with a dot decimal, above which Marisa gets a large-sale alert. The alert is sent only for sales strictly greater than it |
| SMTP (Infomaniak mailbox) | n8n credential, chosen in the *Send Large Sale Alert* node | Send the alert |
| `TIENDA_EMAIL_AVISOS` | environment variable in `.env` | Address that receives the alert (Marisa) |
| `TIENDA_EMAIL_FROM` | environment variable in `.env` | Sender of the alert |
| `08 Error Workflow` | *Settings → Error Workflow* of flow 04 | Alert when the threshold is missing or invalid, when a sale arrives without `importe`, or when sending fails |

Suggested text:

> **Aviso de ventas grandes (flujo 04).** Cada vez que la app registra una venta directa, el router llama al flujo `04 Large Sale Alert`, que avisa a Marisa por correo (concepto, importe, forma de pago y fecha) cuando el importe es **mayor** que el umbral. Una venta igual al umbral no avisa. El umbral es la variable `TIENDA_UMBRAL_VENTA_GRANDE` del `.env` (en euros, con punto decimal, por ejemplo `150` o `99.99`; con coma no vale). Si está vacía o no es un número, el flujo falla y el flujo 08 avisa, en lugar de dejar de avisar sin que nadie lo note.
>
> **Cambiar el umbral.** Edita `TIENDA_UMBRAL_VENTA_GRANDE` en tu `.env` y ejecuta `docker compose up -d` para reiniciar n8n. Hace falta reiniciar porque n8n lee las variables de entorno solo al arrancar; no hay que tocar ningún flujo ni volver a importarlo.
>
> **Puesta en marcha.** Importa `workflows/04-large-sale-alert.json`, elige tu credencial SMTP en el nodo *Send Large Sale Alert*, pon *Settings → Error Workflow → `08 Error Workflow`*, publícalo, y en el router elige este flujo en el nodo *Call Large Sale Alert (flow 04)*. Publica el flujo 04 antes que el router. Si n8n está parado cuando se registra la venta, el aviso se pierde: la app no reintenta.

Checked: payloads and results in `workflows/tests/04-large-sale-alert.md`.

## 8. Demo data, flow 90 (demo-data-flow task 3.2)

Add to the README's credentials/variables list (names only, never values). Flow 90 introduces nothing new: it reuses what flows 08, 00, 01 and 02 already need, plus the shared Header Auth credential.

| Name | Type | Used for |
|---|---|---|
| Header Auth (`X-API-Key`) | n8n credential, chosen in the three HTTP nodes `List Reservations`, `Create Reservation` and `Register Deposit` | Call the app at `http://tienda:8000` |
| `TIENDA_EMAIL_AVISOS` | environment variable in `.env` | Email of every demo customer that has one, so the demo emails reach the team inbox and no real customer |
| `08 Error Workflow` | *Settings → Error Workflow* of flow 90 | Alert when the app rejects a request |

Suggested text:

> **Datos de demostración (flujo 90).** Para preparar una demo, ejecuta a mano `90 Demo Data` (*Execute workflow*; no se publica). Crea cinco apartados de clientes con el sufijo «(demo)» a través de la API de la app y registra sus abonos: uno activo con abono posterior, uno que se liquida con el último abono, uno pagado entero al crearlo, uno sin email y uno con el plazo ya vencido pero todavía `activo`. Los clientes con email usan la dirección de `TIENDA_EMAIL_AVISOS`, así que los correos de los flujos 01 y 02 llegan al buzón del equipo (unos siete) y nunca a una clienta real. Si lo ejecutas otra vez no duplica nada: solo crea los clientes de demostración que aún no existen. La app no tiene botón de borrar: para empezar de cero hay que reiniciar los datos con `docker compose down -v`.
>
> **Antes de ejecutarlo.** Importa `workflows/90-demo-data.json`, elige la credencial Header Auth en los tres nodos HTTP, pon *Settings → Error Workflow → `08 Error Workflow`* y, si quieres ver los correos, publica antes los flujos 01, 02 y el router.

Checked: expected states, email count and PowerShell checks in `workflows/tests/90-demo-data.md`. Screenshots: `docs/evidence/90-demo-data/`.
