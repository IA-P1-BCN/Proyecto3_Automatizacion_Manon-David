"""Read-only HU-08 API/Decimal comparison. Never prints keys or customer records.

Run from the repo root: python3 scripts/verify-monthly-report.py YYYY-MM
Requires the intended local shop container and Node.js. No POSTs or SMTP calls.
"""
import calendar
from datetime import datetime
from decimal import Decimal
import json
import subprocess
import sys
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


def main(month):
    container = 'proyecto3_automatizacion_manon-david-tienda-1'
    inspected = json.loads(subprocess.check_output(['docker', 'inspect', container], text=True))[0]
    ports = inspected['NetworkSettings']['Ports']['8000/tcp']
    if not any(p['HostPort'] == '8001' for p in ports):
        raise RuntimeError('Unexpected shop target; no API requests made.')
    env = dict(value.split('=', 1) for value in inspected['Config']['Env'] if '=' in value)
    key = env.get('API_KEY')
    if not key:
        raise RuntimeError('Shop API key unavailable; no requests made.')
    year, number = map(int, month.split('-'))
    now = datetime.now(ZoneInfo('Europe/Madrid'))
    if month != f'{year:04d}-{number:02d}' or month >= now.strftime('%Y-%m'):
        raise ValueError('Select a closed YYYY-MM month.')
    start, end = f'{month}-01', f'{month}-{calendar.monthrange(year, number)[1]}'

    def get(endpoint):
        request = Request('http://localhost:8001/api/' + endpoint, headers={'X-API-Key': key})
        with urlopen(request, timeout=30) as response:
            rows = json.load(response)
            if not isinstance(rows, list):
                raise RuntimeError('API response is not an array.')
            total = response.headers.get('X-Total-Count')
            if total is not None and int(total) != len(rows):
                raise RuntimeError('API response is incomplete.')
            return rows

    sources = {
        'sales': get(f'ventas?desde={start}&hasta={end}'),
        'deposits': get(f'abonos?desde={start}&hasta={end}'),
        'reservations': get('apartados'), 'history': get('abonos'), 'vouchers': get('vales'),
    }
    # Independent reference calculation: Python Decimal, not the JS helper.
    methods = {method: {'ventas': Decimal(0), 'abonos': Decimal(0), 'total': Decimal(0)}
               for method in ['efectivo', 'tarjeta', 'bizum', 'otros']}
    for source, name in [('sales', 'ventas'), ('deposits', 'abonos')]:
        for row in sources[source]:
            method = row['forma_pago'] if row['forma_pago'] in methods else 'otros'
            amount = Decimal(str(row['importe']))
            methods[method][name] += amount
            methods[method]['total'] += amount
    methods = {key: {name: int(value * 100) for name, value in values.items()} for key, values in methods.items()}
    totals = {name: sum(row[name] for row in methods.values()) for name in ['ventas', 'abonos', 'total']}
    latest = {}
    for row in sources['history']:
        latest[row['apartado_id']] = max(latest.get(row['apartado_id'], ''), row['fecha'])
    voucher_dates = {row['apartado_id']: row['fecha'] for row in sources['vouchers']}
    inside = lambda date: start <= date <= end
    counts = {
        'nuevos': sum(inside(row['fecha']) for row in sources['reservations']),
        'liquidados': sum(row['estado'] == 'liquidado' and inside(latest[row['id']]) for row in sources['reservations']),
        'vencidos': sum(row['estado'] == 'vencido' and inside(voucher_dates[row['id']]) for row in sources['reservations']),
        'activos_actuales': sum(row['estado'] == 'activo' for row in sources['reservations']),
    }
    pending = int(sum((Decimal(str(row['pendiente'])) for row in sources['reservations'] if row['estado'] == 'activo'), Decimal(0)) * 100)
    payload = {'period': {'mode': 'manual', 'month': month, 'desde': start, 'hasta': end}, 'sources': sources, 'now': now.isoformat()}
    result = subprocess.run(['node', '-e', "const fs=require('node:fs');const c=require('./workflows/code/07-monthly-report');const p=JSON.parse(fs.readFileSync(0,'utf8'));console.log(JSON.stringify(c.reportCalculate(p.period,p.sources,p.now)));"], input=json.dumps(payload), text=True, capture_output=True, check=True)
    report = json.loads(result.stdout)
    assert report['methods'] == methods
    assert report['totals'] == totals
    assert report['counts'] == counts
    assert report['pending_cents'] == pending
    print(json.dumps({'month': month, 'consulted_at': now.isoformat(), 'comparison': 'PASS', 'methods_cents': methods, 'totals_cents': totals, 'counts': counts, 'current_active_pending_cents': pending, 'effects': 'GET only; no messages or business writes'}, indent=2))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python3 scripts/verify-monthly-report.py YYYY-MM')
    main(sys.argv[1])
