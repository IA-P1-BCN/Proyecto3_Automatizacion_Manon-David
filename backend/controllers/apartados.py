"""CONTROLADOR · Apartados: la lógica de cada petición.

Recibe los datos ya validados, llama a los modelos y devuelve el resultado.
Qué URL llega a cada función se define en routes/apartados.py.
"""

from typing import Annotated

from fastapi import BackgroundTasks, Header, Response

from models import abono, apartado, vale
from models.errores import ReglaDeNegocio
from schemas.abono import AbonoIn
from schemas.apartado import ApartadoIn
from services import n8n


def listar(response: Response, estado: str | None = None, q: str = "", pagina: int | None = None, por_pagina: int = 25):
    """Filtra por `estado` (activo, liquidado o vencido) y busca con `q`. Sin `pagina` devuelve todos.
    El total de resultados va en la cabecera `X-Total-Count`."""
    limite = por_pagina if pagina else None
    apartados, total = apartado.listar(estado, q, limite, (max(pagina or 1, 1) - 1) * por_pagina)
    response.headers["X-Total-Count"] = str(total)
    return apartados


def resumen():
    return apartado.contar_por_estado()


def ver(apartado_id: int):
    return apartado.obtener(apartado_id) | {"abonos": abono.de_apartado(apartado_id), "vale": vale.del_apartado(apartado_id)}


def crear(datos: ApartadoIn, tareas: BackgroundTasks):
    nuevo = apartado.crear(**datos.model_dump())
    tareas.add_task(n8n.avisar, "apartado.creado", nuevo)
    return nuevo


def abonar(apartado_id: int, datos: AbonoIn, tareas: BackgroundTasks,
           idempotency_key: Annotated[str | None, Header(
               alias="Idempotency-Key", min_length=1, max_length=128,
               pattern=r"^[A-Za-z0-9._:-]+$",
               description="Unique payment identifier. Reuse unchanged for retries; different data returns 409.",
           )] = None,
           notice_fingerprint: Annotated[str | None, Header(
               alias="Payment-Notice-Fingerprint", min_length=64, max_length=64,
               pattern=r"^[a-f0-9]{64}$",
               description="Optional account-scoped SHA256 of notice content; duplicate content requires review.",
           )] = None):
    if notice_fingerprint and not idempotency_key:
        raise ReglaDeNegocio("La huella del aviso requiere Idempotency-Key")
    actualizado, replayed = abono.register_with_replay_result(
        apartado_id, **datos.model_dump(), idempotency_key=idempotency_key,
        notice_fingerprint=notice_fingerprint)
    if not replayed:
        tareas.add_task(n8n.avisar, "abono.registrado", actualizado | {"importe": datos.importe})
    return actualizado


def vencer(apartado_id: int, tareas: BackgroundTasks):
    resultado = apartado.vencer(apartado_id)
    tareas.add_task(n8n.avisar, "apartado.vencido", resultado)
    return resultado
