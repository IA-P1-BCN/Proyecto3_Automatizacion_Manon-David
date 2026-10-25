"""Mirror each OpenSpec tasks.md into its GitHub issue as a task list (idempotent).

Usage (repo root, gh logged in): python scripts/sync_issue_tasks.py [issue numbers...]
Ref WORKTREE reads the local file; any other ref is read with git show.
"""
import re
import subprocess
import sys
import tempfile

REPO = 'IA-P1-BCN/Proyecto3_Automatizacion_Manon-David'
HEADING = '## Implementation tasks'

# issue -> (OpenSpec change, git ref that holds the most current tasks.md)
ISSUES = {
    5: ('add-error-workflow', 'origin/feat/5-error-workflow'),
    32: ('add-event-router', 'WORKTREE'),
    1: ('add-reservation-confirmation', 'WORKTREE'),
    2: ('add-deposit-receipt', 'WORKTREE'),
    3: ('add-remote-deposits', 'origin/dev'),
    4: ('add-daily-close', 'origin/dev'),
}


def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True, encoding='utf-8').stdout


def build_section(change, tasks_md):
    lines = [f'{HEADING}', '',
             f'Mirror of `openspec/changes/{change}/tasks.md`; the repository file is the source of truth and is updated in the PR. '
             f'Spec: `openspec/changes/{change}/`.', '']
    for raw in tasks_md.replace('\r\n', '\n').split('\n'):
        heading = re.match(r'^##\s+(\d+\..*)$', raw)
        if heading:
            lines += ['', f'**{heading.group(1).strip()}**', '']
        elif raw.startswith('- [') and re.match(r'^- \[[ x]\] \d+\.\d+', raw):
            lines.append(raw.rstrip())
    return '\n'.join(lines).rstrip() + '\n'


def main(only):
    for number, (change, ref) in ISSUES.items():
        if only and number not in only:
            continue
        path_in_repo = f'openspec/changes/{change}/tasks.md'
        if ref == 'WORKTREE':
            tasks = open(path_in_repo, encoding='utf-8').read()
        else:
            tasks = run('git', 'show', f'{ref}:{path_in_repo}')
        body = run('gh', 'issue', 'view', str(number), '--repo', REPO, '--json', 'body', '--jq', '.body')
        body = body.replace('\r\n', '\n')
        body = body.split(f'\n{HEADING}')[0].rstrip('\n')
        new_body = f'{body}\n\n{build_section(change, tasks)}'
        with tempfile.NamedTemporaryFile('w', suffix='.md', delete=False, encoding='utf-8', newline='\n') as f:
            f.write(new_body)
            path = f.name
        run('gh', 'issue', 'edit', str(number), '--repo', REPO, '--body-file', path)
        count = len(re.findall(r'^- \[[ x]\]', new_body, re.M))
        done = len(re.findall(r'^- \[x\]', new_body, re.M))
        print(f'#{number}: {count} tasks mirrored ({done} done)')


if __name__ == '__main__':
    main({int(a) for a in sys.argv[1:]})
