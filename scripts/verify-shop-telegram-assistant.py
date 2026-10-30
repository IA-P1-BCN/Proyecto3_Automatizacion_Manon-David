"""HU-12 independent Decimal/calendar comparison. GET-only; no AI or messages.

Run at the repo root: python3 scripts/verify-shop-telegram-assistant.py
Checks David's intended shop mapping (8001) before using its existing API key in
memory. Never prints the key, raw records, customer names/contacts or answers.
"""
import calendar
from datetime import datetime, timedelta
from decimal import Decimal
import hashlib
import json
import subprocess
from urllib.request import Request, urlopen, HTTPRedirectHandler, build_opener
from zoneinfo import ZoneInfo


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        raise RuntimeError("redirect_refused")


def main():
    container = subprocess.check_output(['docker','compose','ps','-q','tienda'],text=True).strip()
    if not container or '\n' in container:
        raise RuntimeError('shop_target_ambiguous')
    inspected = json.loads(subprocess.check_output(['docker','inspect',container],text=True))[0]
    ports = inspected['NetworkSettings']['Ports'].get('8000/tcp',[])
    if not any(p['HostPort']=='8001' for p in ports):
        raise RuntimeError('unexpected_shop_target')
    env = dict(value.split('=',1) for value in inspected['Config']['Env'] if '=' in value)
    key = env.get('API_KEY')
    if not key:
        raise RuntimeError('shop_auth_unavailable')
    now = datetime.now(ZoneInfo('Europe/Madrid'))
    today = now.date()
    monday = today-timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    month_end = today.replace(day=calendar.monthrange(today.year,today.month)[1])
    opener = build_opener(NoRedirect())

    def get(endpoint):
        request = Request('http://localhost:8001/api/'+endpoint,headers={'X-API-Key':key})
        with opener.open(request,timeout=30) as response:
            raw=response.read(5*1024*1024+1)
            if response.status!=200 or len(raw)>5*1024*1024:
                raise RuntimeError('invalid_api_response')
            rows=json.loads(raw)
            if not isinstance(rows,list):
                raise RuntimeError('invalid_api_shape')
            return {'statusCode':200,'headers':dict(response.headers),'body':rows}

    sales=get(f'ventas?desde={monday}&hasta={today}')
    deposits=get(f'abonos?desde={monday}&hasta={today}')
    reservations=get('apartados?estado=activo')
    def cents(value):
        decimal=Decimal(str(value))
        if decimal<0 or not decimal.is_finite() or decimal*100!=(decimal*100).to_integral_value():
            raise RuntimeError('invalid_decimal_amount')
        return int(decimal*100)

    reference_sales=sum(cents(r['importe']) for r in sales['body'])
    reference_deposits=sum(cents(r['importe']) for r in deposits['body'])
    reference_rows=sorted(({'id':r['id'],'pending_cents':cents(r['pendiente']),
                           'fecha_limite':r['fecha_limite'],'overdue':r['fecha_limite']<str(today)}
        for r in reservations['body'] if r['estado']=='activo' and str(month_start)<=r['fecha_limite']<=str(month_end)),
        key=lambda r:(r['fecha_limite'],r['id']))
    payload={'now':now.isoformat(),'sales':sales,'deposits':deposits,'reservations':reservations}
    program="""
const fs=require('node:fs'),c=require('./workflows/code/12-shop-telegram-assistant');
const p=JSON.parse(fs.readFileSync(0,'utf8')),today=c.shopMadridDate(p.now);
const weekly=c.shopWeekly(c.shopPeriod('weekly_collections',today),p.sales,p.deposits);
const monthly=c.shopMonthly(c.shopPeriod('monthly_deadlines',today),p.reservations);
console.log(JSON.stringify({weekly,rows:monthly.rows.map(({id,pending_cents,fecha_limite,overdue})=>({id,pending_cents,fecha_limite,overdue}))}));
"""
    result=subprocess.run(['node','-e',program],input=json.dumps(payload),text=True,capture_output=True,check=False)
    if result.returncode:
        raise RuntimeError('workflow_verification_failed')
    calculated=json.loads(result.stdout)
    if (calculated['weekly']['sales_cents']!=reference_sales or calculated['weekly']['deposits_cents']!=reference_deposits
        or calculated['weekly']['total_cents']!=reference_sales+reference_deposits or calculated['rows']!=reference_rows):
        raise RuntimeError('independent_comparison_failed')
    fingerprint=hashlib.sha256(json.dumps(reference_rows,sort_keys=True).encode()).hexdigest()
    print(json.dumps({'comparison':'PASS','consulted_at':now.isoformat(),
        'week':{'desde':str(monday),'hasta':str(today),'sales_cents':reference_sales,
                'deposits_cents':reference_deposits,'total_cents':reference_sales+reference_deposits},
        'month':{'desde':str(month_start),'hasta':str(month_end),'matching_active_count':len(reference_rows),
                 'overdue_count':sum(r['overdue'] for r in reference_rows),'verified_row_fingerprint':fingerprint},
        'effects':'3 GET requests only; no model, messages or business writes; sequential non-atomic snapshot'},indent=2))


if __name__=='__main__':
    try:
        main()
    except Exception:
        raise SystemExit('HU12 verification failed; no key or customer payload printed. Inspect the intended target and API availability.') from None
