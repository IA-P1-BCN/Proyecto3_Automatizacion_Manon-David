"""MODELO · Abono: los pagos parciales de un apartado y las reglas para registrarlos."""

from datetime import date
import hashlib
import json
import math

import config
import database
from models import apartado
from models.errores import IdempotencyConflict, NoEncontrado, ReglaDeNegocio


def de_apartado(apartado_id):
    return database.consultar("SELECT * FROM abonos WHERE apartado_id = ? ORDER BY fecha, id", apartado_id)


def listar(desde=None, hasta=None):
    return database.consultar("SELECT * FROM abonos WHERE fecha BETWEEN ? AND ? ORDER BY fecha, id",
                              str(desde or "0000-01-01"), str(hasta or "9999-12-31"))


def registrar(apartado_id, importe, forma_pago, fecha=None):
    return register_with_replay_result(apartado_id, importe, forma_pago, fecha)[0]


def register_with_replay_result(apartado_id, importe, forma_pago, fecha=None, idempotency_key=None,
                                notice_fingerprint=None):
    """Return (reservation snapshot, replayed); commit payment and key together."""
    if not math.isfinite(importe):
        raise ReglaDeNegocio("El importe debe ser un número finito")
    request_hash = hashlib.sha256(json.dumps(
        [apartado_id, float(importe), forma_pago, fecha.isoformat() if fecha else None]
        + ([notice_fingerprint] if notice_fingerprint else []),
        separators=(",", ":"), allow_nan=False,
    ).encode()).hexdigest()
    effective_date = fecha or date.today()
    with database.conectar() as con:
        con.execute("BEGIN IMMEDIATE")
        if idempotency_key is not None:
            previous = con.execute("SELECT * FROM payment_idempotency WHERE key = ?",
                                   (idempotency_key,)).fetchone()
            if previous:
                if previous["request_hash"] != request_hash:
                    raise IdempotencyConflict("La clave de este pago ya se utilizó con otros datos")
                return json.loads(previous["response_json"]), True
            if notice_fingerprint and con.execute(
                "SELECT 1 FROM payment_idempotency WHERE notice_fingerprint = ?", (notice_fingerprint,)
            ).fetchone():
                raise IdempotencyConflict(
                    "Existe un aviso de contenido idéntico ya registrado. Revisar antes de apuntar otro pago")
        row = con.execute(apartado.SELECT + " WHERE a.id = ? GROUP BY a.id", (apartado_id,)).fetchone()
        if row is None:
            raise NoEncontrado("Apartado no encontrado")
        actual = dict(row)
        if actual["estado"] != "activo":
            raise ReglaDeNegocio(f"El apartado está {actual['estado']} y no admite abonos")
        if effective_date.isoformat() > actual["fecha_limite"]:
            raise ReglaDeNegocio("El plazo del apartado ha vencido")
        if importe <= 0:
            raise ReglaDeNegocio("El importe debe ser mayor que 0")
        if importe > actual["pendiente"]:
            raise ReglaDeNegocio(f"El importe supera lo pendiente ({actual['pendiente']} €)")
        if forma_pago not in config.FORMAS_PAGO:
            raise ReglaDeNegocio(f"Forma de pago no válida: {forma_pago}")
        con.execute("INSERT INTO abonos (apartado_id, fecha, importe, forma_pago) VALUES (?, ?, ?, ?)",
                    (apartado_id, effective_date.isoformat(), importe, forma_pago))
        if round(actual["pendiente"] - importe, 2) == 0:
            con.execute("UPDATE apartados SET estado = 'liquidado' WHERE id = ?", (apartado_id,))
        result = dict(con.execute(apartado.SELECT + " WHERE a.id = ? GROUP BY a.id", (apartado_id,)).fetchone())
        if idempotency_key is not None:
            con.execute("INSERT INTO payment_idempotency (key, request_hash, response_json, notice_fingerprint) "
                        "VALUES (?, ?, ?, ?)",
                        (idempotency_key, request_hash, json.dumps(result, ensure_ascii=False), notice_fingerprint))
    return result, False
