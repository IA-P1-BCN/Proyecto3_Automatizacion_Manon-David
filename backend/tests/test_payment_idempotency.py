"""Payment retry safety using only the temporary test database; no real webhooks."""

from concurrent.futures import ThreadPoolExecutor
from datetime import date
from uuid import uuid4

import pytest

import database
from models import abono
from services import n8n


def create_reservation(client):
    response = client.post("/api/apartados", json={
        "cliente": "Payment Safety Test", "producto": "Test shoes",
        "precio": 30, "abono_inicial": 5,
    })
    assert response.status_code == 201
    return response.json()["id"]


def test_retry_after_settlement_returns_original_response_once(cliente, monkeypatch):
    reservation_id = create_reservation(cliente)
    events = []
    monkeypatch.setattr(n8n, "avisar", lambda *args: events.append(args))
    url = f"/api/apartados/{reservation_id}/abonos"
    headers = {"Idempotency-Key": str(uuid4())}
    first = cliente.post(url, json={"importe": 25, "forma_pago": "bizum"}, headers=headers)
    # Simulates the caller losing the first response, then restarting/retrying.
    database.crear_tablas()
    retry = cliente.post(url, json={"importe": 25.0, "forma_pago": "bizum"}, headers=headers)
    assert first.status_code == retry.status_code == 201
    assert first.json() == retry.json()
    assert retry.json()["estado"] == "liquidado"
    assert len(cliente.get(f"/api/apartados/{reservation_id}").json()["abonos"]) == 2
    assert len(events) == 1 and events[0][0] == "abono.registrado"


@pytest.mark.parametrize("change", [
    {"importe": 11}, {"forma_pago": "tarjeta"}, {"fecha": date.today().isoformat()},
    {"different_reservation": True},
])
def test_key_cannot_be_reassigned(cliente, change):
    reservation_id = create_reservation(cliente)
    headers = {"Idempotency-Key": str(uuid4())}
    payload = {"importe": 10, "forma_pago": "bizum"}
    url = f"/api/apartados/{reservation_id}/abonos"
    assert cliente.post(url, json=payload, headers=headers).status_code == 201
    if change.get("different_reservation"):
        other_id = create_reservation(cliente)
        url = f"/api/apartados/{other_id}/abonos"
        change = {}
    assert cliente.post(url, json=payload | change, headers=headers).status_code == 409
    assert len(cliente.get(f"/api/apartados/{reservation_id}").json()["abonos"]) == 2


def test_failed_payment_does_not_consume_key(cliente):
    reservation_id = create_reservation(cliente)
    headers = {"Idempotency-Key": str(uuid4())}
    url = f"/api/apartados/{reservation_id}/abonos"
    assert cliente.post(url, json={"importe": 100}, headers=headers).status_code == 422
    assert cliente.post(url, json={"importe": 10}, headers=headers).status_code == 201


@pytest.mark.parametrize("key", ["", "has spaces", "x" * 129])
def test_invalid_keys_are_rejected(cliente, key):
    reservation_id = create_reservation(cliente)
    response = cliente.post(f"/api/apartados/{reservation_id}/abonos", json={"importe": 10},
                            headers={"Idempotency-Key": key})
    assert response.status_code == 422
    assert len(cliente.get(f"/api/apartados/{reservation_id}").json()["abonos"]) == 1


def test_identical_amounts_with_distinct_keys_are_distinct_payments(cliente):
    reservation_id = create_reservation(cliente)
    for _ in range(2):
        response = cliente.post(f"/api/apartados/{reservation_id}/abonos", json={"importe": 10},
                                headers={"Idempotency-Key": str(uuid4())})
        assert response.status_code == 201
    assert response.json()["pendiente"] == 5


def test_concurrent_retry_creates_one_payment(cliente):
    reservation_id = create_reservation(cliente)
    key = str(uuid4())
    def register(_):
        return abono.register_with_replay_result(reservation_id, 10, "bizum", idempotency_key=key)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(register, range(2)))
    assert sorted(replayed for _, replayed in results) == [False, True]
    assert results[0][0] == results[1][0]
    assert len(abono.de_apartado(reservation_id)) == 2


def test_key_storage_failure_rolls_back_payment_and_settlement(cliente):
    reservation_id = create_reservation(cliente)
    key = str(uuid4())
    with database.conectar() as con:
        con.execute("CREATE TRIGGER fail_payment_key BEFORE INSERT ON payment_idempotency "
                    "BEGIN SELECT RAISE(ABORT, 'simulated storage failure'); END")
    try:
        with pytest.raises(Exception, match="simulated storage failure"):
            abono.register_with_replay_result(reservation_id, 25, "bizum", idempotency_key=key)
    finally:
        with database.conectar() as con:
            con.execute("DROP TRIGGER fail_payment_key")
    detail = cliente.get(f"/api/apartados/{reservation_id}").json()
    assert detail["estado"] == "activo" and detail["pendiente"] == 25
    assert len(detail["abonos"]) == 1
    assert not database.consultar("SELECT 1 FROM payment_idempotency WHERE key = ?", key)


def test_replay_returns_snapshot_not_current_balance(cliente):
    reservation_id = create_reservation(cliente)
    url = f"/api/apartados/{reservation_id}/abonos"
    headers = {"Idempotency-Key": str(uuid4())}
    first = cliente.post(url, json={"importe": 10}, headers=headers)
    assert cliente.post(url, json={"importe": 5}).status_code == 201
    retry = cliente.post(url, json={"importe": 10}, headers=headers)
    assert retry.json() == first.json()
    assert retry.json()["pendiente"] == 15
    assert cliente.get(f"/api/apartados/{reservation_id}").json()["pendiente"] == 10


def test_replay_still_requires_shop_authentication(cliente, anonimo):
    reservation_id = create_reservation(cliente)
    url = f"/api/apartados/{reservation_id}/abonos"
    headers = {"Idempotency-Key": str(uuid4())}
    assert cliente.post(url, json={"importe": 10}, headers=headers).status_code == 201
    assert anonimo.post(url, json={"importe": 10}, headers=headers).status_code == 401


def test_identical_content_under_new_message_key_requires_review(cliente):
    reservation_id = create_reservation(cliente)
    url = f"/api/apartados/{reservation_id}/abonos"
    headers = {"Idempotency-Key": str(uuid4()), "Payment-Notice-Fingerprint": "a" * 64}
    first = cliente.post(url, json={"importe": 10}, headers=headers)
    assert first.status_code == 201
    assert cliente.post(url, json={"importe": 10}, headers=headers).json() == first.json()
    different_message = headers | {"Idempotency-Key": str(uuid4())}
    assert cliente.post(url, json={"importe": 10}, headers=different_message).status_code == 409
    assert len(cliente.get(f"/api/apartados/{reservation_id}").json()["abonos"]) == 2


def test_same_message_key_with_changed_content_is_rejected(cliente):
    reservation_id = create_reservation(cliente)
    url = f"/api/apartados/{reservation_id}/abonos"
    headers = {"Idempotency-Key": str(uuid4()), "Payment-Notice-Fingerprint": "b" * 64}
    assert cliente.post(url, json={"importe": 10}, headers=headers).status_code == 201
    assert cliente.post(url, json={"importe": 10}, headers=headers | {
        "Payment-Notice-Fingerprint": "c" * 64}).status_code == 409


def test_fingerprint_requires_valid_key_and_hex_encoding(cliente):
    reservation_id = create_reservation(cliente)
    url = f"/api/apartados/{reservation_id}/abonos"
    assert cliente.post(url, json={"importe": 10}, headers={"Payment-Notice-Fingerprint": "d" * 64}).status_code == 422
    assert cliente.post(url, json={"importe": 10}, headers={
        "Idempotency-Key": str(uuid4()), "Payment-Notice-Fingerprint": "not-a-hash"}).status_code == 422


def test_additive_upgrade_preserves_legacy_key_history(monkeypatch, tmp_path):
    import config
    monkeypatch.setattr(config, "DB_PATH", str(tmp_path / "legacy.db"))
    with database.conectar() as con:
        con.execute("CREATE TABLE payment_idempotency (key TEXT PRIMARY KEY NOT NULL, "
                    "request_hash TEXT NOT NULL, response_json TEXT NOT NULL)")
        con.execute("INSERT INTO payment_idempotency VALUES ('old-key', 'old-hash', '{}')")
    database.crear_tablas()
    assert database.consultar("SELECT * FROM payment_idempotency WHERE key = ?", "old-key") == [
        {"key": "old-key", "request_hash": "old-hash", "response_json": "{}", "notice_fingerprint": None}
    ]
