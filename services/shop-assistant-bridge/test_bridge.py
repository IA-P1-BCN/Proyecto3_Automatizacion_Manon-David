"""No real bot, messages, AI, app or Docker data are used by these tests."""
import contextlib
import copy
import io
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import threading
import unittest
from unittest.mock import patch
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from bridge import Bridge, Config, Http, Journal, SafeError, discover, original_message, valid_reply
from setup_secrets import prepare


NOW = 1793188800


def update(uid=1, message_id=None, text="/semana"):
    return {"update_id":uid,"message":{"message_id":message_id or uid,"date":NOW,
        "from":{"id":101,"is_bot":False,"first_name":"Never stored"},
        "chat":{"id":101,"type":"private","first_name":"Never stored"},"text":text}}


class FakeHttp:
    def __init__(self):
        self.calls=[]
        self.updates=[]
        self.webhook=""
        self.reply=None
        self.send_error=False
        self.query_error=False
        self.bot_id=999

    def telegram(self,method,payload):
        self.calls.append((method,copy.deepcopy(payload)))
        if method=="getMe": return {"id":self.bot_id,"is_bot":True}
        if method=="getWebhookInfo": return {"url":self.webhook}
        if method=="getUpdates": return copy.deepcopy(self.updates)
        if method=="sendMessage":
            if self.send_error: raise SafeError("network_or_response_failure")
            return {"message_id":100+len(self.calls),"chat":{"id":101}}
        raise AssertionError(method)

    def query(self,envelope):
        self.calls.append(("query",copy.deepcopy(envelope)))
        if self.query_error: raise SafeError("network_or_response_failure")
        return self.reply or {"request_id":envelope["request_id"],"status":"ok","messages":["Respuesta verificada"]}


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.cfg=Config("000000:TEST_ONLY_NOT_A_REAL_TELEGRAM_TOKEN","x"*32,101,101,
            "http://n8n:5678/webhook-test/hu12-shop-assistant",True,self.temp.name)
        self.journal=Journal(self.temp.name)
        self.http=FakeHttp()
        self.logs=[]
        self.bridge=Bridge(self.cfg,self.journal,self.http,clock=lambda:NOW,
            log=lambda code,**fields:self.logs.append((code,fields)))
        self.bridge.startup()
        self.http.calls.clear()

    def tearDown(self):
        self.journal.close()
        self.temp.cleanup()

    def restart(self):
        self.journal.close()
        self.journal=Journal(self.temp.name)
        self.bridge=Bridge(self.cfg,self.journal,self.http,clock=lambda:NOW,
            log=lambda code,**fields:self.logs.append((code,fields)))
        self.bridge.startup()

    def test_authorized_reply_fixed_destination_and_profile_minimization(self):
        self.assertEqual(self.bridge.handle(update()),"sent")
        self.assertEqual([m for m,_ in self.http.calls],["query","sendMessage"])
        query=self.http.calls[0][1]
        self.assertNotIn("Never stored",json.dumps(query))
        sent=self.http.calls[1][1]
        self.assertEqual(sent["chat_id"],101)
        self.assertNotIn("parse_mode",sent)
        self.assertTrue(sent["link_preview_options"]["is_disabled"])

    def test_forbidden_updates_make_zero_privileged_calls(self):
        variations=[]
        for field,value in [("forward_origin",{}),("edit_date",NOW),("via_bot",{}),("sender_chat",{})]:
            u=update();u["message"][field]=value;variations.append(u)
        u=update();u["message"]["from"]["id"]=202;variations.append(u)
        u=update();u["message"]["chat"]["id"]=202;variations.append(u)
        u=update();u["message"]["chat"]["type"]="group";variations.append(u)
        u=update();u["message"]["from"]["is_bot"]=True;variations.append(u)
        u=update();u["message"]["date"]-=301;variations.append(u)
        u=update();u["message"]["date"]+=31;variations.append(u)
        u=update();u["edited_message"]=u.pop("message");variations.append(u)
        variations.extend([update(text="x"*321),update(text="😀"*161),update(text="\ud800"),update(text=""),{}])
        for u in variations:
            with self.subTest(update=u): self.assertEqual(self.bridge.handle(u),"ignored")
        self.assertEqual(self.http.calls,[])

    def test_default_send_gate_blocks_even_querying(self):
        cfg=Config(self.cfg.token,self.cfg.bridge_key,101,101,self.cfg.endpoint,False,self.temp.name)
        bridge=Bridge(cfg,self.journal,self.http,clock=lambda:NOW)
        self.assertEqual(bridge.handle(update()),"disabled")
        self.assertEqual(self.http.calls,[])

    def test_duplicate_update_and_message_are_suppressed(self):
        self.bridge.handle(update())
        self.assertEqual(self.bridge.handle(update()),"duplicate_or_limited")
        self.assertEqual(self.bridge.handle(update(uid=2,message_id=1)),"duplicate_or_limited")
        self.assertEqual(sum(m=="sendMessage" for m,_ in self.http.calls),1)

    def test_duplicate_after_restart_is_suppressed(self):
        self.bridge.handle(update());self.restart();self.http.calls.clear()
        self.assertEqual(self.bridge.handle(update()),"duplicate_or_limited")
        self.assertEqual(self.http.calls,[])

    def test_rate_limit_stops_seventh_before_workflow(self):
        for i in range(1,8): self.bridge.handle(update(i))
        self.assertEqual(sum(m=="query" for m,_ in self.http.calls),6)
        self.assertEqual(sum(m=="sendMessage" for m,_ in self.http.calls),6)

    def test_uncertain_send_never_retried_even_after_restart(self):
        self.http.send_error=True
        self.assertEqual(self.bridge.handle(update()),"held")
        self.http.send_error=False;self.restart();self.http.calls.clear()
        self.assertEqual(self.bridge.handle(update()),"duplicate_or_limited")
        self.assertEqual(self.http.calls,[])
        self.assertIn('delivery_uncertain',[code for code,_ in self.logs])

    def test_crash_before_or_after_first_send_holds_remainder(self):
        for state in ("sending","partial"):
            with self.subTest(state=state):
                uid=10 if state=="sending" else 11
                self.journal.claim(uid,uid,NOW);self.journal.sending(uid,0)
                if state=="partial":self.journal.sent(uid,0,501)
                self.restart();self.http.calls.clear()
                self.assertEqual(self.bridge.handle(update(uid)),"duplicate_or_limited")
                self.assertEqual(self.http.calls,[])

    def test_read_only_crash_can_recalculate_without_a_duplicate_send(self):
        self.journal.claim(1,1,NOW);self.restart();self.http.calls.clear()
        self.assertEqual(self.bridge.handle(update()),"sent")
        self.assertEqual(sum(m=="sendMessage" for m,_ in self.http.calls),1)

    def test_invalid_reply_cannot_override_recipient(self):
        self.http.reply={"request_id":"invented","status":"ok","messages":["bad"],"chat_id":202}
        self.assertEqual(self.bridge.handle(update()),"held")
        self.assertEqual([m for m,_ in self.http.calls],["query"])

    def test_internal_request_failure_gets_only_fixed_unavailability(self):
        self.http.query_error=True
        self.assertEqual(self.bridge.handle(update()),"sent")
        self.assertIn("No puedo verificar",self.http.calls[-1][1]["text"])

    def test_metadata_contains_no_payload_or_credentials(self):
        self.bridge.handle(update(text="private question must never persist"))
        dump="\n".join(self.journal.db.iterdump())
        for forbidden in ["private question","Respuesta verificada","Never stored",self.cfg.token,self.cfg.bridge_key]:
            self.assertNotIn(forbidden,dump)
        self.assertEqual({r[1] for r in self.journal.db.execute("PRAGMA table_info(requests)")},
                         {"update_id","message_id","created","status","request_id"})

    def test_process_lock_and_bot_identity_protect_cursor(self):
        with self.assertRaisesRegex(SafeError,"consumer_lock_busy"):Journal(self.temp.name)
        self.http.bot_id=998
        with self.assertRaisesRegex(SafeError,"state_belongs_to_another_bot"):self.bridge.startup()

    def test_existing_webhook_is_never_deleted(self):
        self.http.webhook="https://some-existing-service.invalid"
        with self.assertRaisesRegex(SafeError,"existing_webhook_refused"):self.bridge.startup()
        self.assertNotIn("deleteWebhook",[m for m,_ in self.http.calls])

    def test_poll_acknowledges_without_negative_or_destructive_offset(self):
        self.http.updates=[update(4),update(5)]
        self.bridge.poll()
        self.assertEqual(self.journal.meta("offset"),"6")
        request=self.http.calls[0][1]
        self.assertEqual(request["offset"],0)
        self.assertNotIn("drop_pending_updates",request)
        self.assertEqual(request["allowed_updates"],["message"])

    def test_bad_order_is_refused(self):
        self.http.updates=[update(4),update(3)]
        with self.assertRaisesRegex(SafeError,"invalid_update_order"):self.bridge.poll()

    def test_empty_poll_reports_no_update_without_privileged_calls(self):
        self.bridge.poll(once=True)
        self.assertEqual(self.logs,[('poll_empty',{})])
        self.assertEqual([method for method,_ in self.http.calls],['getUpdates'])

    def test_ignored_poll_reports_only_fixed_reason_without_payload(self):
        for uid,kind in enumerate(['stale','stranger','unsupported'],30):
            u=update(uid,text='private message not for logs')
            if kind=='stale':u['message']['date']-=301
            if kind=='stranger':u['message']['from']['id']=202
            if kind=='unsupported':u['message']['forward_origin']={}
            self.http.updates=[u];self.bridge.poll(once=True)
        self.assertEqual([fields['reason'] for code,fields in self.logs if code=='update_processed'],
                         ['outside_age_window','owner_mismatch','unsupported_update'])
        self.assertNotIn('private message',repr(self.logs))
        self.assertEqual([method for method,_ in self.http.calls],['getUpdates']*3)

    def test_once_respects_queue_order_not_latest_question(self):
        queue=[update(41,text='/semana'),update(42,text='/vencimientos')]
        original=self.http.telegram
        def telegram(method,payload):
            if method=='getUpdates':
                self.http.calls.append((method,copy.deepcopy(payload)))
                return [u for u in queue if u['update_id']>=payload['offset']][:payload['limit']]
            return original(method,payload)
        self.http.telegram=telegram
        self.bridge.poll(once=True)
        self.assertEqual([p['update']['message']['text'] for m,p in self.http.calls if m=='query'],['/semana'])
        self.bridge.poll(once=True)
        self.assertEqual([p['update']['message']['text'] for m,p in self.http.calls if m=='query'],['/semana','/vencimientos'])
        self.assertEqual(self.journal.meta('offset'),'43')

    def test_workflow_failure_diagnostics_do_not_echo_upstream(self):
        self.http.query_error=True
        self.bridge.handle(update())
        self.assertIn('workflow_unavailable',[code for code,_ in self.logs])
        self.assertNotIn(self.cfg.token,repr(self.logs))
        self.assertNotIn(self.cfg.bridge_key,repr(self.logs))

    def test_terminal_cursor_monotonic(self):
        self.journal.acknowledge(100);self.journal.acknowledge(1)
        self.assertEqual(self.journal.meta("offset"),"101")

    def test_retention_prunes_metadata_only_after_seven_days(self):
        self.journal.claim(80,80,NOW-8*86400)
        self.journal.status(80,'sent')
        self.journal.claim(81,81,NOW)
        self.assertIsNone(self.journal.db.execute('SELECT 1 FROM requests WHERE update_id=80').fetchone())
        self.assertIsNotNone(self.journal.db.execute('SELECT 1 FROM requests WHERE update_id=81').fetchone())

    def test_partial_two_part_reply_is_never_rebuilt(self):
        def query(envelope):
            return {'request_id':envelope['request_id'],'status':'ok','messages':['first','second']}
        self.http.query=query
        original=self.http.telegram
        count=[]
        def send(method,payload):
            if method=='sendMessage':
                count.append(payload['text'])
                if len(count)==2:raise SafeError('network_or_response_failure')
            return original(method,payload)
        self.http.telegram=send
        self.assertEqual(self.bridge.handle(update()),'held')
        self.restart()
        self.assertEqual(self.bridge.handle(update()),'duplicate_or_limited')
        self.assertEqual(count,['first','second'])

    def test_reply_boundaries(self):
        rid="fixture_request_id"
        for bad in [{"request_id":rid,"status":"ok","messages":[]},
                    {"request_id":rid,"status":"disabled","messages":["no"]},
                    {"request_id":rid,"status":"ok","messages":["x"*3501]},
                    {"request_id":rid,"status":"ok","messages":["\ud800"]}]:
            self.assertFalse(valid_reply(bad,rid))

    def test_safe_local_owner_discovery_requires_nonce_and_sends_nothing(self):
        self.http.updates=[update(text="¿Quién soy?"),update(2,text="/start fixed_nonce")]
        output=[]
        with patch("bridge.secrets.token_urlsafe",return_value="fixed_nonce"):
            ids=discover(self.http,clock=lambda:NOW,output=output.append,journal=self.journal)
        self.assertEqual(ids,{"HU12_OWNER_USER_ID":101,"HU12_OWNER_CHAT_ID":101})
        self.assertTrue(all(m not in {"query","sendMessage"} for m,_ in self.http.calls))
        self.assertEqual(self.journal.db.execute("SELECT count(*) FROM requests").fetchone()[0],0)
        self.assertEqual(self.journal.meta('offset'),'3')


class ConfigurationTests(unittest.TestCase):
    def env(self):
        directory=tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        token=Path(directory.name)/'token'
        key=Path(directory.name)/'key'
        token.write_text('000000:TEST_ONLY_NOT_A_REAL_TELEGRAM_TOKEN\n');token.chmod(0o600)
        key.write_text('x'*32+'\n');key.chmod(0o600)
        return {"HU12_TELEGRAM_TOKEN_FILE":str(token),"HU12_BRIDGE_KEY_FILE":str(key),
                "HU12_OWNER_USER_ID":"101","HU12_OWNER_CHAT_ID":"101",
                "HU12_N8N_URL":"http://n8n:5678/webhook-test/hu12-shop-assistant"}

    def test_default_is_no_send_and_cannot_change_endpoint(self):
        env=self.env()
        with patch.dict(os.environ,env,clear=True):self.assertFalse(Config.from_env().send_enabled)
        for name,value in [("HU12_N8N_URL","http://tienda:8000/api/ventas"),("HU12_N8N_URL","http://evil.test"),
                           ("HU12_OWNER_USER_ID",""),("HU12_OWNER_CHAT_ID","-1"),("HU12_BRIDGE_KEY","short"),
                           ("HU12_ALLOW_TELEGRAM_SEND","yes")]:
            with self.subTest(name=name,value=value),patch.dict(os.environ,{**env,name:value},clear=True):
                with self.assertRaises(SafeError):Config.from_env()

    def test_file_secrets_are_not_exposed_in_repr(self):
        with patch.dict(os.environ,self.env(),clear=True):
            cfg=Config.from_env()
        self.assertNotIn(cfg.token,repr(cfg));self.assertNotIn(cfg.bridge_key,repr(cfg))

    def test_plain_secret_environment_is_refused_even_with_good_files(self):
        for name in ['HU12_TELEGRAM_BOT_TOKEN','HU12_BRIDGE_KEY']:
            with self.subTest(name=name),patch.dict(os.environ,{**self.env(),name:'must-not-be-used'},clear=True):
                with self.assertRaisesRegex(SafeError,'legacy_secret_environment_refused'):Config.from_env()

    def test_missing_relative_or_symlink_file_is_refused(self):
        env=self.env()
        for name in ['HU12_TELEGRAM_TOKEN_FILE','HU12_BRIDGE_KEY_FILE']:
            for value in ['relative-secret','/not-a-real-hu12-secret-file']:
                with self.subTest(name=name,path=value),patch.dict(os.environ,{**env,name:value},clear=True):
                    with self.assertRaises(SafeError) as caught:Config.from_env()
                    self.assertNotIn(value,str(caught.exception))
        source=Path(env['HU12_TELEGRAM_TOKEN_FILE']);link=source.parent/'token-link';link.symlink_to(source)
        with patch.dict(os.environ,{**env,'HU12_TELEGRAM_TOKEN_FILE':str(link)},clear=True):
            with self.assertRaisesRegex(SafeError,'secret_file_unavailable'):Config.from_env()

    def test_nonprivate_or_wrong_owner_file_is_refused(self):
        env=self.env();path=Path(env['HU12_TELEGRAM_TOKEN_FILE'])
        for mode in [0o644,0o640,0o604]:
            path.chmod(mode)
            with self.subTest(mode=mode),patch.dict(os.environ,env,clear=True):
                with self.assertRaisesRegex(SafeError,'unsafe_secret_file'):Config.from_env()
        path.chmod(0o600)
        with patch.dict(os.environ,env,clear=True),patch('bridge.os.geteuid',return_value=os.geteuid()+1):
            with self.assertRaisesRegex(SafeError,'unsafe_secret_file'):Config.from_env()

    def test_invalid_secret_contents_are_refused_without_echoing(self):
        for name,value in [('HU12_TELEGRAM_TOKEN_FILE','invalid-value'),('HU12_BRIDGE_KEY_FILE','too-short'),
                           ('HU12_TELEGRAM_TOKEN_FILE','x'*513),('HU12_TELEGRAM_TOKEN_FILE','')]:
            env=self.env();Path(env[name]).write_text(value)
            with self.subTest(name=name),patch.dict(os.environ,env,clear=True):
                with self.assertRaises(SafeError) as caught:Config.from_env()
                if value:self.assertNotIn(value,str(caught.exception))

    def test_nonregular_secret_file_does_not_block(self):
        env=self.env();path=Path(env['HU12_TELEGRAM_TOKEN_FILE']);path.unlink();os.mkfifo(path,0o600)
        with patch.dict(os.environ,env,clear=True):
            with self.assertRaisesRegex(SafeError,'unsafe_secret_file'):Config.from_env()

    def test_http_never_exposes_upstream_exception_or_follows_redirect(self):
        cfg=Config(**dict(token="sensitive-token",bridge_key="key",user_id=101,chat_id=101,endpoint=""))
        client=Http(cfg)
        client.opener.open=lambda *a,**kw:(_ for _ in ()).throw(RuntimeError("https://api.telegram.org/botsensitive-token/sendMessage"))
        with self.assertRaises(SafeError) as caught:client.telegram("getMe",{})
        self.assertEqual(str(caught.exception),"network_or_response_failure")
        with self.assertRaisesRegex(SafeError,"telegram_method_refused"):client.telegram("deleteWebhook",{})

    def test_real_http_adapter_with_local_fake_server(self):
        requests=[]
        class Handler(BaseHTTPRequestHandler):
            def log_message(self,*_):pass
            def do_POST(self):
                requests.append((self.path,json.loads(self.rfile.read(int(self.headers['Content-Length'])))))
                if self.path=='/redirect':
                    self.send_response(302);self.send_header('Location','/should-not-follow');self.end_headers();return
                data=json.dumps({'ok':True,'result':{'id':999}}).encode()
                self.send_response(200);self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        worker=threading.Thread(target=server.serve_forever,daemon=True);worker.start()
        try:
            client=Http(Config('test','key',101,101,''));url=f'http://127.0.0.1:{server.server_port}'
            self.assertTrue(client.request(url+'/getMe',{})['ok'])
            with self.assertRaises(SafeError):client.request(url+'/redirect',{})
            self.assertEqual([p for p,_ in requests],['/getMe','/redirect'])
        finally:
            server.shutdown();server.server_close();worker.join()


class SecretSetupTests(unittest.TestCase):
    def setUp(self):
        import subprocess
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.project=Path(self.temp.name)/'project';self.project.mkdir()
        subprocess.run(['git','init','--quiet',str(self.project)],check=True,capture_output=True)
        (self.project/'.gitignore').write_text('.env\n.env.hu12-*\n')
        (self.project/'.env').write_text('API_KEY=preserve-fixture-value\nHU12_ALLOW_TELEGRAM_SEND=false\n')
        self.directory=Path(self.temp.name)/'private'/'secrets'
        self.token='000000:TEST_ONLY_NOT_A_REAL_TELEGRAM_TOKEN'

    def test_prepares_private_files_outside_repo_and_only_paths_in_env(self):
        captured=io.StringIO()
        with contextlib.redirect_stdout(captured):result=prepare(self.project,self.directory,self.token)
        token=Path(result['token_file']);key=Path(result['bridge_key_file'])
        self.assertEqual(token.read_text().strip(),self.token)
        self.assertEqual(len(key.read_text().strip()),64)
        self.assertEqual(token.stat().st_mode&0o777,0o600)
        self.assertEqual(key.stat().st_mode&0o777,0o600)
        self.assertEqual(self.directory.stat().st_mode&0o777,0o700)
        env=(self.project/'.env').read_text()
        self.assertIn('API_KEY=preserve-fixture-value',env)
        self.assertIn('HU12_ALLOW_TELEGRAM_SEND=false',env)
        self.assertNotIn(self.token,env+captured.getvalue()+repr(result))
        self.assertNotIn(key.read_text().strip(),env+captured.getvalue()+repr(result))
        self.assertEqual(list(self.project.glob('.env.hu12-*')),[])

    def test_existing_secrets_are_reused_without_overwrite(self):
        result=prepare(self.project,self.directory,self.token)
        before=Path(result['bridge_key_file']).read_bytes()
        second=prepare(self.project,self.directory)
        self.assertEqual(result,second)
        self.assertEqual(Path(result['bridge_key_file']).read_bytes(),before)
        with self.assertRaisesRegex(SafeError,'existing_token_not_overwritten'):
            prepare(self.project,self.directory,self.token)

    def test_migrates_only_legacy_secret_fields_after_secure_storage(self):
        env=self.project/'.env'
        env.write_text(env.read_text()+'HU12_TELEGRAM_BOT_TOKEN=old-fixture\nHU12_BRIDGE_KEY=old-fixture\nOTHER_SETTING=unchanged\n')
        prepare(self.project,self.directory,self.token)
        text=env.read_text()
        self.assertNotIn('old-fixture',text)
        self.assertIn('OTHER_SETTING=unchanged',text)
        self.assertNotIn('HU12_TELEGRAM_BOT_TOKEN=',text)
        self.assertNotIn('HU12_BRIDGE_KEY=',text)

    def test_refuses_in_repo_path_and_unignored_env(self):
        with self.assertRaisesRegex(SafeError,'secret_location_or_user_refused'):
            prepare(self.project,self.project/'secrets',self.token)
        (self.project/'.gitignore').write_text('')
        with self.assertRaisesRegex(SafeError,'local_env_not_ignored'):
            prepare(self.project,self.directory,self.token)

    def test_refuses_existing_loose_permissions_without_rewriting(self):
        result=prepare(self.project,self.directory,self.token)
        token=Path(result['token_file']);token.chmod(0o644)
        before=token.read_bytes()
        with self.assertRaisesRegex(SafeError,'unsafe_secret_file'):prepare(self.project,self.directory)
        self.assertEqual(token.read_bytes(),before)


if __name__=='__main__':unittest.main()
