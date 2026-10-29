"""Offline HU-12 file-permission/container test using synthetic secrets only.

Explicit opt-in: python3 scripts/test-shop-assistant-secret-files.py --run
Builds a test image with the current non-root host UID, creates disposable
network-disabled containers, verifies RO mounts and no secret values in Docker
environment metadata. Does not read any real secret or start the live bridge.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile
import uuid

ROOT=Path(__file__).resolve().parents[1]
IMAGE='paso-firme-hu12-secret-files-test'


def run(*args,env=None,check=True):
    result=subprocess.run(args,env=env,cwd=ROOT,text=True,capture_output=True,timeout=180)
    if check and result.returncode:
        raise RuntimeError('Offline secret-file check failed; no secret values printed.')
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run',action='store_true')
    args=parser.parse_args()
    if not args.run:
        print('Dry run; --run builds only a test image and network-disabled test containers.');return
    if os.geteuid()==0:
        raise SystemExit('Run as your normal non-root user.')
    run('docker','build','--build-arg',f'BRIDGE_UID={os.geteuid()}',
        '-t',IMAGE,'services/shop-assistant-bridge')
    with tempfile.TemporaryDirectory(prefix='hu12-secret-files-') as directory:
        p=Path(directory)
        token=p/'telegram-token';key=p/'bridge-key'
        token.write_text('000000:TEST_ONLY_NOT_A_REAL_TELEGRAM_TOKEN\n');token.chmod(0o600)
        key.write_text('x'*64+'\n');key.chmod(0o600)
        overrides={**os.environ,'HU12_TELEGRAM_TOKEN_FILE':str(token),'HU12_BRIDGE_KEY_FILE':str(key),
                   'HU12_BRIDGE_UID':str(os.geteuid())}
        resolved=json.loads(run('docker','compose','-f','docker-compose.yml','-f',
            'docker-compose.shop-assistant.yml','config','--format','json',env=overrides).stdout)
        service=resolved['services']['shop-assistant-bridge']
        assert 'HU12_TELEGRAM_BOT_TOKEN' not in service['environment']
        assert 'HU12_BRIDGE_KEY' not in service['environment']
        assert service['build']['args']['BRIDGE_UID']==str(os.geteuid())
        assert all(v.get('read_only') is True and v.get('bind',{}).get('create_host_path') is False
                   for v in service['volumes'] if v['type']=='bind')
        code="""
import errno,json,os
from bridge import Config,SafeError
try:
    cfg=Config.from_env()
except SafeError as e:
    print(json.dumps({'code':e.code}));raise SystemExit(2)
assert 'HU12_TELEGRAM_BOT_TOKEN' not in os.environ
assert 'HU12_BRIDGE_KEY' not in os.environ
for path in [os.environ['HU12_TELEGRAM_TOKEN_FILE'],os.environ['HU12_BRIDGE_KEY_FILE']]:
    try:
        fd=os.open(path,os.O_WRONLY);os.close(fd)
    except OSError as e:
        assert e.errno==errno.EROFS
    else:
        raise AssertionError('secret mount is writable')
print(json.dumps({'files_readable':True,'mounts_read_only':True,'non_root':os.geteuid()!=0,'send_disabled':cfg.send_enabled is False}))
"""
        outcomes=[]
        for private in (True,False):
            token.chmod(0o600 if private else 0o644)
            name='hu12-secrets-check-'+uuid.uuid4().hex[:10]
            command=['docker','create','--name',name,'--label','hu12.disposable=true',
                '--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges',
                '--mount',f'type=bind,src={token},dst=/run/secrets/hu12-telegram-token,readonly',
                '--mount',f'type=bind,src={key},dst=/run/secrets/hu12-bridge-key,readonly',
                '-e','HU12_TELEGRAM_TOKEN_FILE=/run/secrets/hu12-telegram-token',
                '-e','HU12_BRIDGE_KEY_FILE=/run/secrets/hu12-bridge-key',
                '-e','HU12_OWNER_USER_ID=101','-e','HU12_OWNER_CHAT_ID=101',
                '-e','HU12_N8N_URL=http://n8n:5678/webhook-test/hu12-shop-assistant',
                '--entrypoint','python',IMAGE,'-c',code]
            run(*command)
            try:
                metadata=json.loads(run('docker','inspect',name).stdout)[0]
                assert metadata['HostConfig']['NetworkMode']=='none'
                assert metadata['Config']['User']==f'{os.geteuid()}:10001'
                assert all(not mount['RW'] for mount in metadata['Mounts'])
                environment='\n'.join(metadata['Config']['Env'])
                assert token.read_text().strip() not in environment and key.read_text().strip() not in environment
                result=run('docker','start','-a',name,check=False)
                exit_code=int(run('docker','inspect','--format','{{.State.ExitCode}}',name).stdout)
                if private:
                    assert exit_code==0
                    checks=json.loads(result.stdout)
                    assert all(checks.values())
                    outcomes.append('private host files readable by matching non-root UID; writes refused by RO mounts')
                else:
                    assert exit_code==2 and json.loads(result.stdout)['code']=='unsafe_secret_file'
                    outcomes.append('world-readable file rejected without any network access')
            finally:
                run('docker','rm','-f',name,check=False)
        print(json.dumps({'result':'PASS','checks':outcomes,
                         'docker_environment_contains_secret_values':False,
                         'live_bridge_started':False,'network_calls':False},indent=2))


if __name__=='__main__':main()
