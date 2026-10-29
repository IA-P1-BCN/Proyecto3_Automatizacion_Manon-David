"""Export only David's tested HU-12 draft, normalizing safe defaults.

Dry run by default; --write writes ONLY the shared credential-free JSON. Does
not import, publish, alter the local draft or call any business/provider API.
Raw official-CLI export stays in memory, never printed or saved to a file.
"""
import argparse
import copy
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def normalize_parameters(actual, expected, path=()):
    """n8n omits explicit defaults and adds an empty IF editor field."""
    result = copy.deepcopy(expected)
    omitted_defaults = {'mode': ('manual', 'runOnceForAllItems'), 'method': ('GET',),
                        'language': ('javaScript',), 'hasOutputParser': (False,),
                        'needsFallback': (False,), 'autoSaveHighlightedData': (False,),
                        'errorType': ('errorMessage',)}
    for key in expected.keys() - actual.keys():
        if key not in omitted_defaults or expected[key] not in omitted_defaults[key]:
            raise ValueError('Required tested parameter missing')
    for key, value in actual.items():
        if key not in expected:
            if path == ('conditions', 'options') and key == 'leftValue' and value == '':
                continue
            raise ValueError('Unexpected editor parameter')
        if isinstance(value, dict) and isinstance(expected[key], dict):
            result[key] = normalize_parameters(value, expected[key], path + (key,))
        else:
            result[key] = copy.deepcopy(value)
    return result


def sanitize_export(raw, baseline, published=False):
    if raw.get('name') != baseline['name']:
        raise ValueError('Expected the HU-12 workflow')
    if published:
        if raw.get('active') is not True or not raw.get('activeVersionId'):
            raise ValueError('Expected the explicitly selected published version')
    elif raw.get('active') is not False:
        raise ValueError('Published source requires explicit selection')
    expected = {n['name']: n for n in baseline['nodes']}
    actual = {n['name']: n for n in raw['nodes']}
    if len(actual) != len(raw['nodes']) or set(actual) != set(expected):
        raise ValueError('Unexpected node set')
    if raw['connections'] != baseline['connections']:
        raise ValueError('Connections changed; review required')
    result = copy.deepcopy(baseline)
    for node in result['nodes']:
        tested = actual[node['name']]
        for field in ('type', 'typeVersion', 'onError', 'retryOnFail', 'maxTries', 'waitBetweenTries'):
            if tested.get(field) != node.get(field):
                raise ValueError('Execution behavior changed; review required')
        if tested.get('disabled') or tested.get('executeOnce') or tested.get('alwaysOutputData') or tested.get('continueOnFail'):
            raise ValueError('Unexpected execution override')
        parameters = normalize_parameters(tested['parameters'], node['parameters'])
        if node['name'] == 'Configure Owner and Effects':
            fields = parameters['assignments']['assignments']
            wanted = node['parameters']['assignments']['assignments']
            if len(fields) != len(wanted):
                raise ValueError('Unexpected owner configuration')
            for field, reference in zip(fields, wanted):
                if {k: v for k, v in field.items() if k != 'value'} != {k: v for k, v in reference.items() if k != 'value'}:
                    raise ValueError('Owner configuration structure changed')
                field['value'] = reference['value']
        if parameters != node['parameters']:
            raise ValueError('Business parameters changed; review required')
        node['id'] = tested['id']
        position = tested['position']
        if not isinstance(position, list) or len(position) != 2 or not all(type(v) in (int, float) for v in position):
            raise ValueError('Invalid layout')
        node['position'] = position
    return result


def command(*args):
    return subprocess.check_output(args, cwd=ROOT, text=True, stderr=subprocess.DEVNULL)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--published', action='store_true', help='Read the explicitly authorized tested published version; shared output is still inactive')
    args = parser.parse_args()
    container = command('docker', 'compose', 'ps', '-q', 'n8n').strip()
    if not container or '\n' in container:
        raise ValueError('Ambiguous n8n target')
    ports = json.loads(command('docker', 'inspect', '--format', '{{json .NetworkSettings.Ports}}', container))
    if not any(p['HostPort'] == '5680' for p in ports.get('5678/tcp', [])):
        raise ValueError('Unexpected local n8n target')
    export_args = ['docker', 'exec', container, 'n8n', 'export:workflow', '--id=hu12ShopAssistantDavid']
    if args.published:
        export_args.append('--published')
    exported = command(*export_args)
    raw = None
    for match in re.finditer(r'(?m)^\[', exported):
        try:
            values = json.JSONDecoder().raw_decode(exported[match.start():])[0]
            if len(values) == 1:
                raw = values[0]
                break
        except (ValueError, TypeError):
            continue
    if raw is None:
        raise ValueError('Official CLI export unavailable')
    baseline = json.loads(command('node', '-e', 'console.log(JSON.stringify(require("./workflows/code/build-12-shop-telegram-assistant").buildShopAssistant()))'))
    safe = sanitize_export(raw, baseline, published=args.published)
    text = json.dumps(safe, ensure_ascii=False, indent=2) + '\n'
    # Check actual local secret values in memory only, never in diagnostics.
    compose = json.loads(command('docker', 'compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.shop-assistant.yml', 'config', '--format', 'json'))
    for mount in compose['services']['shop-assistant-bridge']['volumes']:
        if mount.get('target') in ('/run/secrets/hu12-telegram-token', '/run/secrets/hu12-bridge-key'):
            path = Path(mount['source'])
            if path.exists() and path.read_text().strip() in text:
                raise ValueError('Secret detected')
    if args.write:
        (ROOT / 'workflows/12-shop-telegram-assistant.json').write_text(text)
    print(json.dumps({'result': 'PASS', 'shared_export_written': args.write,
                      'published_source_selected': args.published,
                      'tested_parameters_match': True, 'editor_layout_preserved': True,
                      'credentials_and_owner_ids_removed': True, 'shared_effects_disabled': True,
                      'local_effects_disabled': all(a['value'] is False for a in actual_effects(raw)),
                      'local_draft_changed': False}))


def actual_effects(raw):
    node = next(n for n in raw['nodes'] if n['name'] == 'Configure Owner and Effects')
    return [a for a in node['parameters']['assignments']['assignments'] if a['name'] in ('allow_external_ai', 'allow_shop_reads')]


if __name__ == '__main__':
    try:
        main()
    except Exception:
        raise SystemExit('HU12 safe export stopped: target or behavioral drift requires review; no raw data printed.') from None
