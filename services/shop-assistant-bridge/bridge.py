"""HU-12 outbound-only Telegram adapter. No shop credential or financial write."""
import argparse
import contextlib
from dataclasses import dataclass, field
import fcntl
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import signal
import sqlite3
import stat
import sys
import threading
import time
import urllib.error
import urllib.request


UNAVAILABLE = "No puedo verificar los datos ahora. Inténtalo de nuevo más tarde."
ENDPOINTS = {
    "http://n8n:5678/webhook/hu12-shop-assistant",
    "http://n8n:5678/webhook-test/hu12-shop-assistant",
}


class SafeError(Exception):
    """Only fixed codes leave this boundary, never upstream errors/URLs/bodies."""
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def numeric_id(value):
    return type(value) is int and 0 < value <= 2**53 - 1


def text_units(value):
    if not isinstance(value, str):
        return -1
    try:
        return len(value.encode("utf-16-le")) // 2
    except UnicodeError:
        return -1


def read_secret_file(path):
    """Read a small owner-only regular file without following symbolic links."""
    path = str(path)
    if not os.path.isabs(path):
        raise SafeError("invalid_secret_file")
    fd = None
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        info = os.fstat(fd)
        if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid()
                or stat.S_IMODE(info.st_mode) & 0o077
                or not info.st_mode & stat.S_IRUSR or not 0 < info.st_size <= 512):
            raise SafeError("unsafe_secret_file")
        data = os.read(fd, 513)
        if len(data) > 512:
            raise SafeError("invalid_secret_file")
        return data.decode("ascii").rstrip("\r\n")
    except SafeError:
        raise
    except Exception:
        raise SafeError("secret_file_unavailable") from None
    finally:
        if fd is not None:
            os.close(fd)


def secret_file(variable, default_path):
    return read_secret_file(os.environ.get(variable, default_path))


def bot_token():
    if os.environ.get("HU12_TELEGRAM_BOT_TOKEN"):
        raise SafeError("legacy_secret_environment_refused")
    token = secret_file("HU12_TELEGRAM_TOKEN_FILE", "/run/secrets/hu12-telegram-token")
    if not re.fullmatch(r"\d{5,}:[A-Za-z0-9_-]{20,}", token):
        raise SafeError("invalid_secret_configuration")
    return token


@dataclass(frozen=True)
class Config:
    token: str = field(repr=False)
    bridge_key: str = field(repr=False)
    user_id: int
    chat_id: int
    endpoint: str
    send_enabled: bool = False
    state_dir: str = "/state"

    @classmethod
    def from_env(cls):
        token = bot_token()
        if os.environ.get("HU12_BRIDGE_KEY"):
            raise SafeError("legacy_secret_environment_refused")
        key = secret_file("HU12_BRIDGE_KEY_FILE", "/run/secrets/hu12-bridge-key")
        if not re.fullmatch(r"[A-Za-z0-9_-]{32,128}", key):
            raise SafeError("invalid_secret_configuration")
        ids = []
        for name in ("HU12_OWNER_USER_ID", "HU12_OWNER_CHAT_ID"):
            value = os.environ.get(name, "")
            if not re.fullmatch(r"[1-9]\d{0,15}", value) or not numeric_id(int(value)):
                raise SafeError("owner_not_configured")
            ids.append(int(value))
        endpoint = os.environ.get("HU12_N8N_URL", "")
        enabled = os.environ.get("HU12_ALLOW_TELEGRAM_SEND", "false")
        if endpoint not in ENDPOINTS or enabled not in {"true", "false"}:
            raise SafeError("invalid_bridge_configuration")
        return cls(token, key, *ids, endpoint, enabled == "true",
                   os.environ.get("HU12_STATE_DIR", "/state"))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        raise SafeError("redirect_refused")


class Http:
    def __init__(self, config):
        self.config = config
        self.opener = urllib.request.build_opener(NoRedirect())

    def request(self, url, payload, headers=None, timeout=35):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request = urllib.request.Request(url, data=data, headers={
            "Content-Type": "application/json", **(headers or {})}, method="POST")
        try:
            with self.opener.open(request, timeout=timeout) as response:
                raw = response.read(256 * 1024 + 1)
                if response.status != 200 or len(raw) > 256 * 1024:
                    raise SafeError("invalid_http_response")
                return json.loads(raw)
        except SafeError:
            raise
        except urllib.error.HTTPError as error:
            # Telegram uses 409 for another getUpdates consumer. Never print error.url.
            raise SafeError("consumer_conflict" if error.code == 409 else "http_request_failed") from None
        except Exception:
            raise SafeError("network_or_response_failure") from None

    def telegram(self, method, payload):
        if method not in {"getMe", "getWebhookInfo", "getUpdates", "sendMessage"}:
            raise SafeError("telegram_method_refused")
        answer = self.request(f"https://api.telegram.org/bot{self.config.token}/{method}", payload)
        if not isinstance(answer, dict) or answer.get("ok") is not True or "result" not in answer:
            raise SafeError("telegram_response_failed")
        return answer["result"]

    def query(self, envelope):
        # A fresh n8n calculation cannot send a message: only this adapter owns delivery.
        return self.request(self.config.endpoint, envelope,
                            {"X-HU12-Bridge-Key": self.config.bridge_key}, timeout=190)


def original_message(update, now, user_id=None, chat_id=None):
    if not isinstance(update, dict) or set(update) != {"update_id", "message"}:
        return None
    if type(update["update_id"]) is not int or update["update_id"] < 0:
        return None
    m = update["message"]
    if not isinstance(m, dict) or any(k in m for k in
            ("forward_origin", "forward_date", "forward_from", "forward_from_chat", "edit_date", "via_bot", "sender_chat")):
        return None
    sender, chat = m.get("from", {}), m.get("chat", {})
    if not isinstance(sender, dict) or not isinstance(chat, dict):
        return None
    if not numeric_id(sender.get("id")) or sender.get("is_bot") is not False:
        return None
    if not numeric_id(chat.get("id")) or chat.get("type") != "private":
        return None
    if user_id is not None and sender["id"] != user_id:
        return None
    if chat_id is not None and chat["id"] != chat_id:
        return None
    text, date = m.get("text"), m.get("date")
    if not numeric_id(m.get("message_id")) or type(date) is not int or not -30 <= now-date <= 300:
        return None
    if not isinstance(text, str) or not text.strip() or not 0 < text_units(text) <= 320:
        return None
    # Strip optional Telegram profile metadata, never the question's actual text.
    return {"update_id": update["update_id"], "message": {
        "message_id": m["message_id"], "date": date,
        "from": {"id": sender["id"], "is_bot": False},
        "chat": {"id": chat["id"], "type": "private"}, "text": text}}


class Journal:
    def __init__(self, directory):
        path = Path(directory)
        path.mkdir(parents=True, exist_ok=True)
        self.lock = (path / "consumer.lock").open("a+")
        try:
            fcntl.flock(self.lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            self.lock.close()
            raise SafeError("consumer_lock_busy") from None
        try:
            self.db = sqlite3.connect(path / "delivery.sqlite")
            self.db.execute("PRAGMA journal_mode=WAL")
            self.db.execute("PRAGMA synchronous=FULL")
            self.db.executescript("""
                CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS requests (
                    update_id INTEGER PRIMARY KEY, message_id INTEGER UNIQUE NOT NULL,
                    created REAL NOT NULL, status TEXT NOT NULL, request_id TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS chunks (
                    update_id INTEGER NOT NULL, part INTEGER NOT NULL, status TEXT NOT NULL,
                    telegram_message_id INTEGER, PRIMARY KEY(update_id, part));
            """)
            with self.db:
                self.db.execute("UPDATE requests SET status='held' WHERE status IN ('sending','partial')")
        except Exception:
            if hasattr(self, 'db'):
                self.db.close()
            self.lock.close()
            raise SafeError("state_unavailable") from None

    def close(self):
        self.db.close()
        self.lock.close()

    def meta(self, key, default=None):
        row = self.db.execute("SELECT value FROM metadata WHERE key=?", (key,)).fetchone()
        return row[0] if row else default

    def put(self, key, value):
        with self.db:
            self.db.execute("INSERT OR REPLACE INTO metadata VALUES (?,?)", (key, str(value)))

    def bind_bot(self, bot_id):
        if self.meta("bot_id") not in (None, str(bot_id)):
            raise SafeError("state_belongs_to_another_bot")
        self.put("bot_id", bot_id)

    def acknowledge(self, update_id):
        self.put("offset", max(int(self.meta("offset", "0")), update_id + 1))

    def claim(self, update_id, message_id, now):
        with self.db:
            old = self.db.execute("SELECT update_id,status,request_id FROM requests WHERE update_id=? OR message_id=?",
                                  (update_id, message_id)).fetchone()
            if old:
                # Only a read calculation with no send started can be repeated after a crash.
                if old[0] == update_id and old[1] == "querying":
                    return old[2]
                return None
            self.db.execute("DELETE FROM chunks WHERE update_id IN (SELECT update_id FROM requests WHERE created < ?)", (now-7*86400,))
            self.db.execute("DELETE FROM requests WHERE created < ?", (now-7*86400,))
            if self.db.execute("SELECT count(*) FROM requests").fetchone()[0] >= 10000:
                raise SafeError("state_capacity_reached")
            recent = self.db.execute("SELECT count(*) FROM requests WHERE created > ? AND status != 'rate_limited'", (now-60,)).fetchone()[0]
            request_id = hashlib.sha256(f"{self.meta('bot_id')}:{update_id}:{message_id}".encode()).hexdigest()[:32]
            state = "querying" if recent < 6 else "rate_limited"
            self.db.execute("INSERT INTO requests VALUES (?,?,?,?,?)", (update_id,message_id,now,state,request_id))
            return request_id if state == "querying" else None

    def status(self, update_id, status):
        with self.db:
            self.db.execute("UPDATE requests SET status=? WHERE update_id=?", (status,update_id))

    def sending(self, update_id, part):
        with self.db:
            self.db.execute("UPDATE requests SET status='sending' WHERE update_id=?", (update_id,))
            self.db.execute("INSERT INTO chunks VALUES (?,?,'sending',NULL)", (update_id,part))

    def sent(self, update_id, part, message_id):
        with self.db:
            self.db.execute("UPDATE chunks SET status='sent',telegram_message_id=? WHERE update_id=? AND part=?", (message_id,update_id,part))
            self.db.execute("UPDATE requests SET status='partial' WHERE update_id=?", (update_id,))


def valid_reply(reply, request_id):
    if not isinstance(reply, dict) or set(reply) != {"request_id", "status", "messages"} or reply["request_id"] != request_id:
        return False
    messages = reply["messages"]
    if reply["status"] not in {"ok", "help", "unavailable", "ignored", "disabled"} or not isinstance(messages, list):
        return False
    if not 0 <= len(messages) <= 10:
        return False
    if reply["status"] in {"ignored", "disabled"} and messages:
        return False
    if reply["status"] in {"ok", "help", "unavailable"} and not messages:
        return False
    return all(0 < text_units(text) <= 3500 for text in messages)


def ignored_update_reason(update, now, config):
    """Diagnostic only: fixed categories, never grants access or logs a payload."""
    message = update.get('message') if isinstance(update, dict) else None
    if not isinstance(message, dict):
        return 'unsupported_update'
    sender, chat = message.get('from'), message.get('chat')
    if not isinstance(sender, dict) or not isinstance(chat, dict):
        return 'unsupported_update'
    if sender.get('id') != config.user_id or chat.get('id') != config.chat_id:
        return 'owner_mismatch'
    date = message.get('date')
    if type(date) is int and not -30 <= now-date <= 300:
        return 'outside_age_window'
    return 'unsupported_update'


class Bridge:
    def __init__(self, config, journal, http, clock=time.time, stop=None, log=None):
        self.config, self.journal, self.http, self.clock = config, journal, http, clock
        self.stop = stop or threading.Event()
        self.log = log or (lambda code, **fields: print(json.dumps({"stage": code, **fields}), flush=True))

    def startup(self):
        me = self.http.telegram("getMe", {})
        webhook = self.http.telegram("getWebhookInfo", {})
        if not isinstance(me, dict) or not numeric_id(me.get("id")) or me.get("is_bot") is not True:
            raise SafeError("invalid_bot_identity")
        if not isinstance(webhook, dict) or webhook.get("url") != "":
            raise SafeError("existing_webhook_refused")
        self.journal.bind_bot(me["id"])

    def handle(self, update):
        clean = original_message(update,self.clock(),self.config.user_id,self.config.chat_id)
        if clean is None:
            return "ignored"
        if not self.config.send_enabled:
            return "disabled"  # Safe default: no n8n/Groq/shop request or reply.
        uid = clean["update_id"]
        request_id = self.journal.claim(uid, clean["message"]["message_id"], self.clock())
        if request_id is None:
            return "duplicate_or_limited"
        try:
            reply = self.http.query({"request_id": request_id, "update": clean})
        except SafeError:
            self.log('workflow_unavailable', request_id=request_id)
            reply = {"request_id": request_id, "status": "unavailable", "messages": [UNAVAILABLE]}
        if not valid_reply(reply,request_id):
            self.journal.status(uid,"held")
            self.log("invalid_workflow_reply", request_id=request_id)
            return "held"
        self.log('workflow_reply_verified', request_id=request_id, status=reply['status'])
        if not reply["messages"]:
            self.journal.status(uid,"skipped")
            return reply["status"]
        for part,text in enumerate(reply["messages"]):
            # Respect Telegram's per-chat pace, without replaying a failed send.
            if self.stop.is_set() or (part and self.stop.wait(1.1)):
                self.journal.status(uid,"held")
                return "held"
            # Commit BEFORE the non-idempotent call. Unknown outcome never auto-replays.
            self.journal.sending(uid,part)
            try:
                result = self.http.telegram("sendMessage", {
                    "chat_id": self.config.chat_id, "text": text,
                    "link_preview_options": {"is_disabled": True},
                    "disable_web_page_preview": True,
                })
                if not isinstance(result, dict) or not numeric_id(result.get("message_id")) or result.get("chat",{}).get("id") != self.config.chat_id:
                    raise SafeError("delivery_unconfirmed")
                self.journal.sent(uid,part,result["message_id"])
            except SafeError:
                self.journal.status(uid,"held")
                self.log("delivery_uncertain",request_id=request_id,part=part+1)
                return "held"
        self.journal.status(uid,"sent")
        return "sent"

    def poll(self, once=False):
        updates = self.http.telegram("getUpdates", {
            "offset": int(self.journal.meta("offset", "0")), "limit": 1 if once else 100,
            "timeout": 0 if once else 25, "allowed_updates": ["message"],
        })
        if not isinstance(updates,list) or len(updates)>100:
            raise SafeError("invalid_update_batch")
        if not updates:
            self.log('poll_empty')
        last = -1
        for update in updates:
            if self.stop.is_set():
                return
            uid = update.get("update_id") if isinstance(update,dict) else None
            if type(uid) is not int or uid < 0 or uid <= last:
                raise SafeError("invalid_update_order")
            last = uid
            outcome = self.handle(update)
            fields = {'outcome': outcome}
            if outcome == 'ignored':
                fields['reason'] = ignored_update_reason(update, self.clock(), self.config)
            self.log('update_processed', **fields)
            self.journal.acknowledge(uid)


def discover(http, clock=time.time, output=print, wait=120, journal=None):
    me, webhook = http.telegram("getMe",{}), http.telegram("getWebhookInfo",{})
    if not isinstance(me,dict) or not numeric_id(me.get("id")) or webhook.get("url") != "":
        raise SafeError("discovery_bot_conflict")
    if journal is not None:
        journal.bind_bot(me['id'])
    nonce = secrets.token_urlsafe(12)
    output("En el chat privado con tu bot, envía: /start " + nonce)
    output("Solo se leen identificadores; no se autoriza ni se envían mensajes.")
    deadline, offset = clock()+wait, 0
    while clock()<deadline:
        updates = http.telegram("getUpdates",{"offset":offset,"limit":100,"timeout":10,"allowed_updates":["message"]})
        if not isinstance(updates,list) or len(updates)>100:
            raise SafeError("invalid_discovery_updates")
        for update in updates:
            clean=original_message(update,clock())
            if clean and hmac.compare_digest(clean["message"]["text"].encode('utf-8'), ("/start "+nonce).encode('utf-8')):
                ids={"HU12_OWNER_USER_ID":clean["message"]["from"]["id"],"HU12_OWNER_CHAT_ID":clean["message"]["chat"]["id"]}
                if journal is not None:
                    # Pairing is not a business question; do not replay it as the first
                    # controlled query when normal operation starts.
                    journal.acknowledge(clean['update_id'])
                output(json.dumps(ids)); return ids
            if isinstance(update,dict) and type(update.get("update_id")) is int and update["update_id"]>=0:
                offset=max(offset,update["update_id"]+1)
    raise SafeError("discovery_timeout")


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--discover-owner',action='store_true')
    parser.add_argument('--check',action='store_true')
    parser.add_argument('--once',action='store_true')
    args=parser.parse_args()
    if args.discover_owner:
        token=bot_token()
        with contextlib.closing(Journal(os.environ.get('HU12_STATE_DIR','/state'))) as journal:
            discover(Http(Config(token,'',0,0,'')),journal=journal)
        return
    cfg=Config.from_env()
    stop=threading.Event()
    for sig in (signal.SIGTERM,signal.SIGINT):
        signal.signal(sig,lambda *_:stop.set())
    with contextlib.closing(Journal(cfg.state_dir)) as journal:
        bridge=Bridge(cfg,journal,Http(cfg),stop=stop)
        bridge.startup()
        if args.check:
            print('HU12 bot identity/webhook checks passed; no updates consumed or messages sent.')
            return
        if not cfg.send_enabled:
            raise SafeError('send_gate_disabled_no_polling_started')
        while not stop.is_set():
            bridge.poll(once=args.once)
            if args.once:
                break


if __name__=='__main__':
    try:
        main()
    except SafeError as error:
        print(json.dumps({'stage':'bridge_stopped','code':error.code}),file=sys.stderr)
        sys.exit(1)
    except Exception:
        # Never let a urllib/SQLite traceback carry a secret URL or user payload to logs.
        print('{"stage":"bridge_stopped","code":"internal_failure"}',file=sys.stderr)
        sys.exit(1)
