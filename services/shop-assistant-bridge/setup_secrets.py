"""Local interactive secret setup. No network, Docker startup or message sends.

Run in your own terminal; never paste a token into an assistant conversation.
Stores private files outside the repo, and ONLY their paths/UID in ignored .env.
Existing secret files are validated/reused, never overwritten or printed.
"""
import getpass
import os
from pathlib import Path
import re
import secrets
import stat
import subprocess
import sys
import tempfile
import warnings

from bridge import SafeError, read_secret_file


def private_directory(path):
    if path.is_symlink():
        raise SafeError('unsafe_secret_directory')
    if not path.exists():
        path.mkdir(mode=0o700, parents=True)
    info=path.stat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid!=os.geteuid() or stat.S_IMODE(info.st_mode)&0o077:
        raise SafeError('unsafe_secret_directory')


def create_private(path, value):
    # O_EXCL: no overwrite even if another setup process wins a race.
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    with os.fdopen(fd,'w',encoding='ascii') as target:
        target.write(value+'\n');target.flush();os.fsync(target.fileno())


def prepare(project, directory, token=None):
    project, directory=Path(project).resolve(), Path(directory)
    if os.geteuid()==0 or directory.resolve().is_relative_to(project):
        raise SafeError('secret_location_or_user_refused')
    env=project/'.env'
    if env.is_symlink() or not env.is_file() or env.stat().st_uid!=os.geteuid():
        raise SafeError('local_env_unavailable')
    # Never create a secret-bearing temp file unless its exact prefix is ignored.
    for candidate in ('.env','.env.hu12-check'):
        if subprocess.run(['git','check-ignore','-q',candidate],cwd=project).returncode!=0:
            raise SafeError('local_env_not_ignored')
    private_directory(directory.parent)
    private_directory(directory)
    token_path=directory/'hu12-telegram-token'
    key_path=directory/'hu12-bridge-key'
    if token_path.exists() or token_path.is_symlink():
        if token is not None:
            raise SafeError('existing_token_not_overwritten')
        token_value=read_secret_file(token_path)
    else:
        token_value=token
    if not isinstance(token_value,str) or not re.fullmatch(r'\d{5,}:[A-Za-z0-9_-]{20,}',token_value):
        raise SafeError('invalid_bot_token')
    if key_path.exists() or key_path.is_symlink():
        key_value=read_secret_file(key_path)
        if not re.fullmatch(r'[A-Za-z0-9_-]{32,128}',key_value):
            raise SafeError('invalid_bridge_key_file')
    else:
        key_value=secrets.token_hex(32)
        create_private(key_path,key_value)
    if not token_path.exists():
        create_private(token_path,token_value)
    # Only path/UID fields are changed; preserve all unrelated local settings.
    settings={'HU12_TELEGRAM_TOKEN_FILE':str(token_path.resolve()),
              'HU12_BRIDGE_KEY_FILE':str(key_path.resolve()),'HU12_BRIDGE_UID':str(os.geteuid())}
    for value in settings.values():
        if any(c in value for c in "'\r\n\x00"):
            raise SafeError('unsupported_local_path')
    old=env.read_text()
    reserved=set(settings)|{'HU12_TELEGRAM_BOT_TOKEN','HU12_BRIDGE_KEY'}
    lines=[]
    for line in old.splitlines(keepends=True):
        match=re.match(r'^\s*(?:export\s+)?([A-Z0-9_]+)\s*=',line)
        if not match or match[1] not in reserved:
            lines.append(line)
    text=''.join(lines)
    if text and not text.endswith('\n'):
        text+='\n'
    text+='\n# HU-12: paths and UID only; secret values live outside the repository.\n'
    text+=''.join(f"{key}='{value}'\n" for key,value in settings.items())
    if not re.search(r'^HU12_ALLOW_TELEGRAM_SEND=',text,re.M):
        text+='HU12_ALLOW_TELEGRAM_SEND=false\n'
    temporary=None
    try:
        with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',dir=project,prefix='.env.hu12-',delete=False) as target:
            temporary=Path(target.name)
            os.chmod(temporary,0o600)
            target.write(text);target.flush();os.fsync(target.fileno())
        os.replace(temporary,env)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()
    # Return metadata only. Do not put token_value/key_value in repr/output.
    return {'token_file':str(token_path),'bridge_key_file':str(key_path),'uid':os.geteuid()}


def main():
    if not sys.stdin.isatty() or not sys.stderr.isatty():
        raise SafeError('use_your_local_interactive_terminal')
    project=Path(__file__).resolve().parents[2]
    directory=Path.home()/'.config'/'paso-firme'/'secrets'
    token_path=directory/'hu12-telegram-token'
    token=None
    if not token_path.exists() and not token_path.is_symlink():
        print('Pega el token de BotFather. No se mostrará al escribir o pegar.')
        with warnings.catch_warnings():
            warnings.simplefilter('error',getpass.GetPassWarning)
            token=getpass.getpass('Token: ')
    result=prepare(project,directory,token)
    print('Credenciales guardadas fuera del repositorio con permisos privados.')
    print('Solo se han configurado rutas y UID en .env; no se ha iniciado ningún servicio.')
    print('Archivo del token: '+result['token_file'])
    print('Archivo de la clave del puente: '+result['bridge_key_file'])


if __name__=='__main__':
    try:
        main()
    except (SafeError, OSError, ValueError, getpass.GetPassWarning) as error:
        code=error.code if isinstance(error,SafeError) else 'local_secret_setup_failed'
        raise SystemExit('Preparación detenida: '+code+'. No compartas los valores de las credenciales.') from None
