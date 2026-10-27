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

## 9. Due date reminders, flow 06 (due-reminders task 5.2)

Add to the README's credentials/variables list (names only, never values). Flow 06 reuses what flows 05, 08 and 02 already need and adds no new variable:

| Name | Type | Used for |
|---|---|---|
| Shop Header Auth (`X-API-Key`) | n8n credential, chosen in the *Fetch Reservations* node | Read the active reservations from the app |
| kDrive Header Auth (the one of flow 05) | n8n credential, chosen in *List Records Folder*, *Download Records* and *Save Records* | Read and write `avisos.csv` |
| `KDRIVE_DRIVE_ID`, `KDRIVE_DIRECTORY_ID` | environment variables in `.env` (passed to n8n by `docker-compose.yml`) | Drive and folder that hold `avisos.csv`, next to `basedatos.csv` |
| SMTP (Infomaniak mailbox) | n8n credential, chosen in the *Send Reminder* node | Send the reminders and the shop alerts |
| `TIENDA_EMAIL_AVISOS` | environment variable in `.env` | Address that receives the "no valid email" alerts (Marisa) |
| `TIENDA_EMAIL_FROM` | environment variable in `.env` | Sender of every email |
| `08 Error Workflow` | *Settings → Error Workflow* of flow 06 | Alert when the app, kDrive or the email service fails, or when `avisos.csv` has the wrong columns |

Suggested text:

> **Recordatorios de vencimiento (flujo 06).** Cada mañana a las 09:00 (hora de Madrid) el flujo `06 Due Date Reminders` consulta a la app los apartados `activo` y avisa por correo a los clientes cuyo plazo vence **dentro de 7 días** y **dentro de 1 día**. El mensaje lleva el modelo, la talla, lo que falta por pagar, lo ya abonado y la fecha límite, tal como los da la app. Cada cliente recibe cada aviso **una sola vez**: el flujo apunta cada envío en el fichero `avisos.csv` de kDrive (`apartado_id;umbral;resultado;fecha_envio`), junto a `basedatos.csv`. Si el apartado no tiene correo válido, el aviso va a la tienda y se apunta como `sin_email`.
>
> **Ejecutarlo a mano para otra fecha.** Abre *Choose Date*, pon en `fecha` el día que quieres simular (`AAAA-MM-DD`) y ejecuta desde *Manual Run*. Repetir la misma fecha no vuelve a enviar nada.
>
> **Si algo falla.** Si el envío de un correo falla, los que sí salieron quedan apuntados, el flujo falla y el flujo 08 avisa; al repetir, solo se reintentan los que faltan. Si el correo salió pero no se pudo guardar `avisos.csv`, el flujo falla y avisa: revisa el fichero antes de la próxima mañana para no repetir el aviso.
>
> **Puesta en marcha.** Importa `workflows/06-due-reminders.json`, elige las credenciales (clave de la tienda, kDrive y SMTP), pon *Settings → Error Workflow → `08 Error Workflow`* y publícalo. Si n8n está parado a las 09:00, ese día no se envían los recordatorios y no se recuperan solos: ejecuta el flujo a mano con la fecha de ese día.

Checked: cases and results in `workflows/tests/06-due-reminders.md`.

## 10. Excel migration, flow 10 (excel-migration task 6.2)

Add to the README's credentials/variables list (names only, never values). Flow 10 reuses what flows 08, 00 and 06 already need and adds one n8n Data Table:

| Name | Type | Used for |
|---|---|---|
| Shop Header Auth (`X-API-Key`) | n8n credential, chosen in the five *Read …* nodes and the three *Create …* nodes | Read what the app already holds and create apartados, abonos and ventas |
| SMTP (Infomaniak mailbox) | n8n credential, chosen in the *Send Report* node | Send the report to Marisa |
| `TIENDA_EMAIL_AVISOS` | environment variable in `.env` | Address that receives the report (Marisa); the flow fails before creating anything if it is empty |
| `TIENDA_EMAIL_FROM` | environment variable in `.env` | Sender of the report |
| Data Table `migration_state` | n8n Data Table with columns `clave` (string), `activa` (boolean), `desde` (string) and one row `clave = migracion`, `activa = false` | The "migration running" flag: flow 10 switches it, flow 00 reads it |
| `08 Error Workflow` | *Settings → Error Workflow* of flow 10 | Alert when the app is unreachable, a file is wrong, or the migration stops |

The flow needs no change to `docker-compose.yml` and no access to the repo's `data/` folder: the CSV files are uploaded through its form.

Suggested text:

> **Migración del Excel antiguo (flujo 10).** El flujo `10 Excel Migration` pasa a la app el Excel de Marisa. Se ejecuta **a mano**, una vez: abre el formulario del flujo, sube el CSV de apartados y el CSV de ventas (los de `data/` sirven de ejemplo) y pulsa *Migrar*. El flujo limpia fechas, nombres, teléfonos e importes con `€`, crea los apartados y sus abonos con su **fecha original**, carga las ventas sueltas y **no carga lo dudoso**: un abono inicial de menos de 5 €, un abono mayor de lo que faltaba por pagar, filas sin fecha, importe o cliente, y todo lo que depende de un apartado que no se carga. Al terminar, Marisa recibe **un correo** con lo cargado, lo que ya estaba cargado y la lista de filas que necesitan su decisión, cada una con su motivo, y los abonos a los que el flujo puso «efectivo» porque el Excel no decía la forma de pago.
>
> **Se puede repetir sin duplicar.** Antes de crear algo, el flujo pregunta a la app si ya existe (mismo cliente, modelo, fecha e importe). Si una ejecución se corta a la mitad, repetirla carga solo lo que falte. Ojo: la app **no permite borrar**, así que prueba primero con una copia (una base nueva) y usa la real solo cuando el informe sea el esperado.
>
> **Durante la migración no salen avisos a clientes.** Mientras corre, el flujo marca la migración como activa en la tabla `migration_state` y el router (flujo 00) ignora todos los avisos de la app, para no mandar recibos de abonos antiguos. Se desactiva solo 15 segundos después de la última carga (los avisos tardan un poco en llegar a n8n) y, si algo se rompe, también al fallar. Si la marca se quedara activa por un fallo de n8n, el router la da por apagada a los 30 minutos. **Haz la migración con la tienda cerrada:** los avisos reales de ese momento también se ignoran.
>
> **Puesta en marcha.** Crea la tabla `migration_state` (columnas `clave`, `activa`, `desde`) con una fila `migracion` / `false`, importa `workflows/10-excel-migration.json` y la nueva versión de `workflows/00-event-router.json` (`scripts/import_new_workflows.py` no sustituye un flujo que ya existe: renombra o archiva el router anterior antes de importar el nuevo, o copia en el router actual los nodos *Read Migration Flag* y *Check Migration Flag*, y vuelve a elegir los flujos de los nodos *Call …*), elige las credenciales (clave de la tienda y SMTP), pon *Settings → Error Workflow → `08 Error Workflow`* en el flujo 10 y publícalo. Después abre la *Production URL* del formulario. La ejecución queda en estado *waiting* hasta que alguien abre la página final («Migración terminada»); es el comportamiento normal de los formularios de n8n.

Checked: cases and results in `workflows/tests/10-excel-migration.md` (throwaway stack on 2026-10-27; not yet repeated on the team's n8n with the real flows 01 and 02).
