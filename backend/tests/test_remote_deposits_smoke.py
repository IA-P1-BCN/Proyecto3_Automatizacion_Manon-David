"""Minimal cross-layer HU-03 test: mocked Groq, real temporary shop API, no email."""
import json
from pathlib import Path
import subprocess

import config
import database
import seed
from services import n8n


def test_nine_notices_match_seed_and_clear_payment_is_registered_once(cliente, monkeypatch, tmp_path):
    monkeypatch.setattr(config, "DB_PATH", str(tmp_path / "hu03-smoke.db"))
    database.crear_tablas()
    seed.cargar()
    root = Path(__file__).resolve().parents[2]
    script = r"""
const fs=require('node:fs'),crypto=require('node:crypto');
const {prepareNotice,validateExtraction}=require('./workflows/code/03-extract-bank-payment');
const {matchReservation}=require('./workflows/code/03-match-bank-payment');
const reservations=JSON.parse(fs.readFileSync(0,'utf8'));
const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Madrid'});
const results=fs.readdirSync('data/correos').filter(f=>f.endsWith('.eml')).sort().map(file=>{
 const raw=fs.readFileSync('data/correos/'+file,'utf8').replace(/\r\n/g,'\n');
 const boundary=raw.indexOf('\n\n'),body=raw.slice(boundary+2).trim();
 const subject=raw.slice(0,boundary).match(/^Subject: (.*)$/m)[1];
 const field=label=>body.match(new RegExp('^'+label+'[ \\t]*(?::|\\.{2,})[ \\t]*([^\\n]*)','m'))?.[1].trim();
 const mock=file.startsWith('08')?{ordenante:null,importe:null,concepto:null,tipo:'no_es_pago'}:
 {ordenante:field('Ordenante'),importe:Number(field('Importe').replace(' EUR','').replace(',','.')),
 concepto:field('Concepto'),tipo:file.includes('transferencia')?'transferencia':'bizum'};
 const notice=prepareNotice({messageId:'<fixture-'+file+'@example.test>',subject,text:body,from:{value:[{address:'sender@example.test'}]}});
 const extraction=validateExtraction({statusCode:200,body:{choices:[{finish_reason:'stop',message:{content:JSON.stringify(mock)}}]}},notice);
 const match=extraction.result==='ignored'?{decision:'ignored'}:matchReservation(extraction.payment||mock,reservations,today);
 return {file,...match,payment:mock,
 key:crypto.createHash('sha256').update(JSON.stringify(['smoke',notice.messageId])).digest('hex'),
 fingerprint:crypto.createHash('sha256').update(JSON.stringify(['smoke',subject,body])).digest('hex')};
});
process.stdout.write(JSON.stringify(results));
"""
    result = subprocess.run(["node", "-e", script], cwd=root,
                            input=json.dumps(cliente.get("/api/apartados").json()),
                            text=True, capture_output=True, check=True)
    cases = json.loads(result.stdout)
    assert [case["decision"] for case in cases] == [
        "register", "register", "register", "review", "review", "review", "review", "ignored", "register",
    ]
    events = []
    monkeypatch.setattr(n8n, "avisar", lambda *args: events.append(args))
    clear = cases[0]
    url = f"/api/apartados/{clear['reservation']['id']}/abonos"
    payload = {"importe": clear["payment"]["importe"], "forma_pago": "bizum"}
    headers = {"Idempotency-Key": clear["key"], "Payment-Notice-Fingerprint": clear["fingerprint"]}
    before = len(cliente.get(f"/api/apartados/{clear['reservation']['id']}").json()["abonos"])
    first = cliente.post(url, json=payload, headers=headers)
    second = cliente.post(url, json=payload, headers=headers)
    assert first.status_code == second.status_code == 201
    assert first.json() == second.json()
    assert len(cliente.get(f"/api/apartados/{clear['reservation']['id']}").json()["abonos"]) == before + 1
    assert len(events) == 1
    # A separate email with identical content is not silently registered again.
    assert cliente.post(url, json=payload, headers=headers | {"Idempotency-Key": "another-message"}).status_code == 409
    # Financial rejection itself, independent of the earlier matching checks.
    overpayment = cases[3]
    response = cliente.post(f"/api/apartados/{overpayment['candidates'][0]['id']}/abonos",
                            json={"importe": overpayment["payment"]["importe"], "forma_pago": "bizum"},
                            headers={"Idempotency-Key": overpayment["key"]})
    assert response.status_code == 422
    assert len(events) == 1
