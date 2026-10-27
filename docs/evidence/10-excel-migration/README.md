# Evidence · 10 Excel Migration (issue #10)

Run on 2026-10-27 in a throwaway stack, not on the team's instance: n8n 2.44.5, the app of this repo started with `SEED=0` (empty), Mailpit as mailbox. Flows 08, 01 and 02 were not in that stack (the router was linked to stub handlers). Screenshots are pending (task 6.3); what follows is the text output of the runs.

Commands used: `node --test workflows/code/10-excel-migration.test.js workflows/code/10-excel-migration-stages.test.js workflows/code/00-migration-flag.test.js` (54 tests passed) and the form upload of the two files of `data/` (`POST /form/excel-migration-form`).

## Run 1 · clean app, the two files of `data/`

Subject of the report: `Migración del Excel: 7 apartados, 3 abonos, 6 ventas · 2 para revisar`

```
Hola Marisa,

Esto es el resultado de la migración de tu Excel a la app.

Cargado ahora:
  · apartados: 7
  · abonos: 3
  · ventas: 6

Ya estaba cargado (no se ha vuelto a crear):
  · apartados: 0
  · abonos: 0
  · ventas: 0

Filas que NO se han cargado y necesitan tu decisión (2):
  · Hoja de apartados, línea 4 (03/09/2026 · Lucía Gómez · Sandalia tacón negra): El abono inicial (4,00 €) es menor de 5,00 €.
  · Hoja de apartados, línea 10 (20/09/2026 · Lucía Gómez · Sandalia tacón negra): Depende del apartado de Lucía Gómez · Sandalia tacón negra, que no se carga.

Abonos cargados con la forma de pago «efectivo» porque el Excel no la indicaba (7):
  · 02/09/2026 · Carmen Ruiz · Botín piel marrón · 10,00 €
  · 02/09/2026 · Jorge Martín · Zapatilla running azul · 5,00 €
  · 07/09/2026 · Ana Torres · Mocasín ante · 15,00 €
  · 10/09/2026 · Pedro Sanz · Bota agua niño · 5,00 €
  · 15/09/2026 · Rosa Díaz · Zapato vestir hombre · 50,00 €
  · 05/09/2026 · Carmen Ruiz · Botín piel marrón · 20,00 €
  · 12/09/2026 · Jorge Martín · Zapatilla running azul · 30,00 €

Si lo ejecutas otra vez no se duplica nada: solo se cargará lo que falte.
```

What the app held afterwards (read with `GET /api/apartados`, `/api/abonos`, `/api/ventas`):

| id | fecha | cliente | producto | precio | abonado | pendiente | fecha_limite |
|---|---|---|---|---|---|---|---|
| 1 | 2026-09-02 | Carmen Ruiz | Botín piel marrón | 89.9 | 30.0 | 59.9 | 2026-12-01 |
| 2 | 2026-09-02 | Jorge Martín | Zapatilla running azul | 64.5 | 35.0 | 29.5 | 2026-12-01 |
| 3 | 2026-09-07 | Ana Torres | Mocasín ante | 72.0 | 35.0 | 37.0 | 2026-12-06 |
| 4 | 2026-09-10 | Pedro Sanz | Bota agua niño | 29.95 | 5.0 | 24.95 | 2026-12-09 |
| 7 | 2026-09-15 | Rosa Díaz | Zapato vestir hombre | 95.0 | 50.0 | 45.0 | 2026-12-14 |
| 5 | 2026-10-01 | Miguel Ángel López | Deportiva blanca | 55.0 | 5.0 | 50.0 | 2026-12-30 |
| 6 | 2026-10-06 | Sofía Navarro | Bailarina roja | 39.9 | 10.0 | 29.9 | 2027-01-04 |

10 abonos (Sofía's initial abono `bizum`, the rest `efectivo`) and 6 ventas (01/10 to 06/10) with their original dates. `abonado`, `pendiente` and `fecha_limite` are the app's own figures; the flow never calculates them.

## Run 2 · same files again

App unchanged (7 apartados, 10 abonos, 6 ventas). Subject: `Migración del Excel: 0 apartados, 0 abonos, 0 ventas · 2 para revisar`; "Ya estaba cargado": apartados 7, abonos 10, ventas 6.

## Run 3 · partial load completed

After deleting from the throwaway database Carmen's abono of 05/09, Sofía's apartado with its abono and the sale "Crema calzado": Subject `Migración del Excel: 1 apartados, 1 abonos, 1 ventas · 2 para revisar`; "Ya estaba cargado": 6 / 8 / 5.

## Failures

| Situation | Result |
|---|---|
| Wrong API key | Execution failed on the 401 at the first read; app empty; flag `false` |
| App unreachable after the lookups | Execution failed: "La migración se detuvo: No se pudo hablar con la app: … El aviso de migración se desactivó; repetirla carga solo lo que falte."; flag `false` |
| `TIENDA_EMAIL_AVISOS` empty | Execution failed: "Configure TIENDA_EMAIL_AVISOS."; app empty |

## Router and the migration flag

With the router published (stub handlers), a migration of 16 creates (7 + 3 + 6) produced 16 router executions, all successful, and 0 handler runs; the flag was `true` during the run and `false` 15 seconds after the last create. With the event sent by hand and the flag set to off, on, 29 minutes old, 31 minutes old and off again: routed, ignored, ignored, routed, routed.

Before the 15-second wait was added, all 16 events reached the handlers (flag off right after the last create): n8n started the router executions up to a second after the app sent the events.
