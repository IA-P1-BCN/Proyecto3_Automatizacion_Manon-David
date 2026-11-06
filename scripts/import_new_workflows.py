"""Import the repo's workflow JSON files that your local n8n does not have yet.

Add-only and unpublished: a workflow whose name already exists in n8n is never touched, nothing is
published, no credential is written. Run from the repo root, after pulling `dev`:

    python scripts/import_new_workflows.py            # dry run: shows what would be imported
    python scripts/import_new_workflows.py --run      # imports the new ones
    python scripts/import_new_workflows.py --run --container my-n8n-container

Only run it with the owner's permission (it writes to the local n8n).
"""
import argparse
import glob
import json
import os
import subprocess
import sys

CREDENTIAL_NODES = {
    'n8n-nodes-base.emailSend': 'SMTP credential',
    'n8n-nodes-base.emailReadImap': 'IMAP credential',
    'n8n-nodes-base.googleSheets': 'Google Sheets credential',
    'n8n-nodes-base.httpRequest': 'Header Auth credential (X-API-Key), if it calls the app',
}


def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True, encoding='utf-8').stdout


def find_container(requested):
    if requested:
        return requested
    names = [line for line in run('docker', 'ps', '--format', '{{.Names}}\t{{.Image}}').splitlines()
             if 'n8nio/n8n' in line]
    if len(names) != 1:
        sys.exit(f'Found {len(names)} running n8n containers; pass --container <name>.')
    return names[0].split('\t')[0]


def existing_names(container):
    out = run('docker', 'exec', container, 'n8n', 'list:workflow')
    return {line.split('|', 1)[1].strip() for line in out.splitlines() if '|' in line}


def manual_steps(workflow):
    steps = []
    nodes = workflow.get('nodes', [])
    if any(n.get('type') == 'n8n-nodes-base.executeWorkflow' for n in nodes):
        steps.append('open each "Call ..." node and choose the sub-workflow (IDs differ per instance)')
    for node_type, label in CREDENTIAL_NODES.items():
        if any(n.get('type') == node_type for n in nodes):
            steps.append(f'attach your {label}')
    steps.append('set Settings > Error Workflow to "08 Error Workflow" (not needed for 08 itself)')
    steps.append('save, then publish only when you want it live')
    return steps


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--run', action='store_true', help='actually import (default is a dry run)')
    parser.add_argument('--container', help='n8n container name (auto-detected when only one is running)')
    args = parser.parse_args()

    container = find_container(args.container)
    present = existing_names(container)
    files = sorted(path.replace(os.sep, '/') for path in glob.glob('workflows/*.json') + glob.glob('workflows/tests/*.json'))

    new, skipped = [], []
    for path in files:
        with open(path, encoding='utf-8') as handle:
            workflow = json.load(handle)
        (skipped if workflow['name'] in present else new).append((path, workflow))

    print(f'n8n container: {container}')
    for path, workflow in skipped:
        print(f'  exists, not touched: {workflow["name"]}  ({path})')
    for path, workflow in new:
        print(f'  {"importing" if args.run else "would import"}: {workflow["name"]}  ({path})')
        if args.run:
            target = f'/tmp/{path.replace("/", "_")}'
            run('docker', 'cp', path, f'{container}:{target}')
            run('docker', 'exec', container, 'n8n', 'import:workflow', f'--input={target}')
            # docker cp creates the file as root, so the node user cannot delete it.
            subprocess.run(['docker', 'exec', '-u', 'root', container, 'rm', '-f', target], check=False)
    if not new:
        print('Nothing new to import.')
        return
    if not args.run:
        print('\nDry run only. Add --run to import (unpublished).')
        return
    print('\nStill to do by hand in the n8n editor:')
    for _, workflow in new:
        print(f'  {workflow["name"]}')
        for step in manual_steps(workflow):
            print(f'    - {step}')


if __name__ == '__main__':
    main()
