"""MIDDLEWARE · Errores: convierte los errores del negocio en respuestas HTTP con un mensaje claro."""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from models.errores import IdempotencyConflict, NoEncontrado, ReglaDeNegocio


def registrar(app: FastAPI):
    @app.exception_handler(IdempotencyConflict)
    def conflicting_payment_key(_: Request, error: IdempotencyConflict):
        return JSONResponse({"detail": str(error)}, status_code=409)

    @app.exception_handler(ReglaDeNegocio)
    def regla_rota(_: Request, error: ReglaDeNegocio):
        return JSONResponse({"detail": str(error)}, status_code=422)

    @app.exception_handler(NoEncontrado)
    def no_encontrado(_: Request, error: NoEncontrado):
        return JSONResponse({"detail": str(error)}, status_code=404)
