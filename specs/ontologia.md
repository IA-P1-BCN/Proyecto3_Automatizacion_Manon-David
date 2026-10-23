# Domain ontology · Zapatería Paso Firme

> One vocabulary for the team and the agents. Each entity says whether **the app stores it** (source of truth) or **n8n creates it**. Field names are the real API ones (`backend/database.py`). Entity and field names stay in Spanish, as in the app and the README; the English gloss is given on first use. Don't invent concepts outside this list: propose them here first.

## 1. Relationship map

```
Cliente ──< Apartado >── Producto (model + size)
              │  │
              │  └──< Abono            (the initial deposit is the first one)
              └──── 0..1 Vale          (only if the reservation expires)

Venta                                   (direct sale, no reservation)
PagoBancario ──resolves to──> Abono     (Bizum/transfer email)
CierreDiario / InformeMensual           (summaries computed from Abonos + Ventas)
Evento ──> Aviso                        (app webhook → n8n message)
```

## 2. Entities the app stores

### Apartado (layaway reservation)
A pair of shoes (one model, one size) reserved by a customer who pays for it in instalments.

| Field | Meaning | Rule |
|---|---|---|
| `id` | Reservation number (the customer can quote it as the payment concept) | Unique |
| `fecha` | Day it is reserved | |
| `cliente`, `telefono`, `email` | Customer data (see *Cliente*) | `telefono` and `email` may be missing |
| `producto`, `talla` | Model and size | **One reservation = one pair** |
| `precio` | Total price | > 0 |
| `fecha_limite` | Deadline to pay in full | `fecha` + 90 days |
| `estado` | `activo` · `liquidado` · `vencido` | See life cycle |
| `abonado`, `pendiente` | **Calculated** by the app: sum of deposits and `precio − abonado` | n8n never recalculates them |

**Life cycle**

| From → to | Triggered by | Condition |
|---|---|---|
| (new) → `activo` | Created in the app | Initial deposit ≥ €5 and ≤ `precio` |
| `activo` → `liquidado` | **The app, by itself** | A deposit leaves `pendiente` = 0 |
| `activo` → `vencido` | **n8n**, calling `POST /api/apartados/{id}/vencer` | `fecha_limite` has passed |
| `liquidado` / `vencido` | — | Final: accept no more deposits |

> ⚠️ A reservation past its deadline **stays `activo`** until n8n expires it. For flow 3, "past deadline" = `estado = activo` **and** today > `fecha_limite`.

### Abono (deposit)
A partial payment toward an Apartado.

| Field | Meaning | Rule |
|---|---|---|
| `apartado_id` | Reservation it pays | Must be `activo` and within the deadline |
| `fecha`, `importe`, `forma_pago` | When, how much and how | `importe` > 0 and ≤ `pendiente`; `forma_pago` ∈ `efectivo`, `tarjeta`, `bizum` |

The **initial deposit** is just the first Abono. It counts as that day's takings.

### Venta (direct sale)
Over-the-counter sale with no reservation. Fields: `id`, `fecha`, `concepto`, `importe` (> 0), `forma_pago`.
Careful: the old Excel mixes initial deposits of reservations in here ("… (abono inicial apartado)"). In the app those are **not sales**, they are Abonos (relevant to the migration, HU-10).

### Vale (voucher)
Store credit the customer receives when their reservation expires. Fields: `id`, `codigo` (`VALE-00016`), `apartado_id`, `fecha`, `importe` (= amount paid), `usado`. Never cash.

## 3. Entities the app does not store

### Cliente (customer) *(implicit)*
The app **has no customer table**: the customer is the trio `cliente` (free text) + `telefono` + `email` on each Apartado. Consequences the specs must account for:
- The same customer can appear with the name spelled several ways and with **several active reservations** at once.
- There is no stable identifier and no recorded consent.
- For flow 3, the reservation is found by the number in the concept and otherwise by exact normalised name ([decision](../docs/decisions-clarify.md#how-a-payment-finds-its-reservation-flow-3)). [NEEDS CLARIFICATION: how the customer is identified in HU-11, only if we reach Advanced.]
- Consent: implied by giving an `email`, only for notices about **their own** reservation ([decision](../docs/decisions-clarify.md#consent-to-receive-messages)); real consent tracking is [postponed to Advanced](../docs/future-implementation-ideas.md).

### Producto (product) *(implicit)*
Exists only as the text `producto` + `talla` inside the Apartado. There is no catalogue or stock; "the shoes go back on sale" on expiry is a **notice to the shop**, not a change in the app.

### PagoBancario (bank payment) *(created by n8n from an email)*
What the AI extracts from a bank notice. **It only extracts; it does not decide.**

| Field | Meaning |
|---|---|
| `ordenante` | Name of the payer (may be abbreviated) |
| `importe` | Amount paid |
| `concepto` | Free text (may contain a reservation number or be empty) |
| `tipo` | `bizum` · `transferencia` · `no_es_pago` |

**Resolution** (done by the flow, using the API):

| Situation | Result | Who is told |
|---|---|---|
| `no_es_pago` | Ignored | Nobody |
| A single clear `activo` Apartado (by number in the concept or by name) | The `Abono` is registered with `forma_pago = bizum` (transfers also as `bizum`: [decision](../docs/decisions-clarify.md#bank-transfers)) | Customer (receipt, HU-02) |
| Ambiguous name, no concept, or unknown customer | **Not registered** | Marisa, to decide |
| `importe` > `pendiente` | **Not registered** (the app rejects it with 422) | Marisa, with the reason |
| Apartado past its deadline | **Not registered** | Marisa, with the reason |

### CierreDiario (daily close)
Summary of one day: direct sales, deposits (initial ones included) and total, **per payment method**. n8n computes it from `GET /api/ventas` and `GET /api/abonos` for the day and stores it in an external history (Google Sheets; the app doesn't store it). Fields: `fecha`, `ventas[efectivo|tarjeta|bizum]`, `abonos[efectivo|tarjeta|bizum]`, `total`. A day with no movements produces a close with total 0, not an error. One row per `fecha` (idempotency).

### InformeMensual (monthly report)
Previous month's takings (sales and deposits separately), **total pending collection** (sum of `pendiente` of `activo` Apartados) and the count of new, settled and expired reservations of the month. How to count "settled" and "expired" in a month is [postponed to the Medium level](../docs/future-implementation-ideas.md).

### Evento (event)
Notice the app sends to n8n by webhook: `{ "evento", "datos" }`. One webhook, one Switch on `evento`.

| `evento` | `datos` | Flow |
|---|---|---|
| `apartado.creado` | The Apartado | 1 |
| `abono.registrado` | The updated Apartado + `importe` | 2 |
| `venta.registrada` | The Venta | 4 |
| `apartado.vencido` | `{ apartado, vale }` | 6 |

The `estado` in `datos` is the state **after** the action: `abono.registrado` with `estado = liquidado` → "can now pick up their shoes".

### Aviso (notice)
Message that leaves n8n. Always carries the amounts **exactly as the app gives them**. Customer-facing text is in Spanish.

| Type | Recipient | Channel |
|---|---|---|
| Reservation confirmation, receipt, reminder, voucher | Customer | Email ([decision](../docs/decisions-clarify.md#notification-channel)) |
| Close, report, big sale, doubtful payment, error | Marisa / shop | Email |

If the customer has no `email`, the flow **does not fail**: it tells the shop the message could not be sent (HU-01).

## 4. Invariants (always true; tests check them)

1. `pendiente = precio − Σ abonos` and `0 ≤ pendiente ≤ precio`: given by the app.
2. A `liquidado` Apartado has `pendiente = 0`; a `vencido` one has a `Vale` with `importe = abonado`.
3. Every `Abono` belongs to an Apartado that was `activo` and within its deadline when registered.
4. Σ `importe` of a `CierreDiario` = Σ `abonos` + Σ `ventas` of that date according to the API.
5. `Vale.importe` > 0 only if there were deposits (there is always at least the initial one).
6. A reminder `Aviso` (7 days / 1 day) is sent **once** per Apartado and threshold.

## 5. Quick glossary

| Term | Meaning |
|---|---|
| Apartar | Reserve shoes with an initial deposit |
| Abonar | Pay part of a reservation |
| Liquidar | Pay what remains; the customer can pick the shoes up |
| Vencer | Close a reservation past its deadline; generates a voucher |
| Pendiente | What is still owed on a reservation |
| Pendiente de cobro | Σ pendiente of all `activo` reservations |
| Cierre | The day's cash summary |
| Marisa / dependienta / cliente | Owner (gets notices, decides doubtful cases) / shop assistant who uses the app / person who reserves |
