'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { identifyBankNotice, classifyNoticeIdentity } = require('./03-payment-identity');

const notice = { accountScope: 'test-bank-account', messageId: '<one@example.test>',
  subject: 'Pago recibido', body: 'Importe: 10,00 EUR\nOrdenante: Test Customer' };

test('same message always produces the same opaque key and no personal data', () => {
  const first = identifyBankNotice(notice);
  assert.deepEqual(identifyBankNotice({ ...notice }), first);
  assert.match(first.key, /^hu03-v1-[a-f0-9]{64}$/);
  assert.equal(classifyNoticeIdentity(first, [first]).action, 'existing');
  assert.ok(!JSON.stringify(first).includes('Test Customer'));
});

test('different IDs with identical content need review, not a duplicate payment or silent dismissal', () => {
  const first = identifyBankNotice(notice);
  const second = identifyBankNotice({ ...notice, messageId: '<two@example.test>' });
  assert.notEqual(first.key, second.key);
  assert.deepEqual(classifyNoticeIdentity(second, [first]), {
    action: 'review', reason: 'identical_content_different_identifier',
  });
});

test('same identifier with changed text needs review', () => {
  const first = identifyBankNotice(notice);
  const changed = identifyBankNotice({ ...notice, body: 'Importe: 20,00 EUR' });
  assert.equal(changed.key, first.key);
  assert.equal(classifyNoticeIdentity(changed, [first]).reason, 'source_identifier_content_conflict');
});

test('trusted bank reference is stable across message IDs', () => {
  const first = identifyBankNotice({ ...notice, verifiedBankReference: 'operation-1' });
  const retry = identifyBankNotice({ ...notice, messageId: '<two@example.test>', verifiedBankReference: 'operation-1' });
  assert.equal(first.key, retry.key);
  assert.equal(classifyNoticeIdentity(retry, [first]).action, 'existing');
});

test('distinct verified bank operations can legitimately have identical text', () => {
  const first = identifyBankNotice({ ...notice, verifiedBankReference: 'operation-1' });
  const second = identifyBankNotice({ ...notice, verifiedBankReference: 'operation-2' });
  assert.equal(classifyNoticeIdentity(second, [first]).action, 'new');
});

test('keys and content fingerprints are isolated by receiving account', () => {
  const first = identifyBankNotice(notice);
  const second = identifyBankNotice({ ...notice, accountScope: 'another-test-account' });
  assert.notEqual(first.key, second.key);
  assert.notEqual(first.contentHash, second.contentHash);
});

test('line endings do not create another content fingerprint', () => {
  assert.deepEqual(identifyBankNotice({ ...notice, body: notice.body.replace(/\n/g, '\r\n') }),
    identifyBankNotice(notice));
});

test('missing identity requires review and missing history fails closed', () => {
  const unidentified = identifyBankNotice({ ...notice, messageId: undefined });
  assert.equal(unidentified.key, null);
  assert.equal(classifyNoticeIdentity(unidentified, []).reason, 'missing_source_identifier');
  assert.throws(() => classifyNoticeIdentity(identifyBankNotice(notice), null), /history/);
  assert.throws(() => identifyBankNotice({ ...notice, accountScope: '' }), /scope/);
  assert.throws(() => identifyBankNotice({ ...notice, body: null }), /text/);
});

test('all nine raw fixtures lack Message-ID and must not gain identity from content alone', () => {
  const directory = path.resolve(__dirname, '../../data/correos');
  const files = fs.readdirSync(directory).filter((file) => file.endsWith('.eml'));
  assert.equal(files.length, 9);
  for (const file of files) {
    const raw = fs.readFileSync(path.join(directory, file), 'utf8').replace(/\r\n/g, '\n');
    const boundary = raw.indexOf('\n\n');
    const headers = raw.slice(0, boundary);
    assert.ok(!/^Message-ID:/im.test(headers));
    const identity = identifyBankNotice({ accountScope: 'fixture-account',
      subject: headers.match(/^Subject: (.*)$/m)[1], body: raw.slice(boundary + 2) });
    assert.equal(classifyNoticeIdentity(identity, []).action, 'review', file);
    // A controlled transport may supply an ID, but fixtures themselves are not changed.
    const transported = identifyBankNotice({ accountScope: 'fixture-account',
      subject: headers.match(/^Subject: (.*)$/m)[1], body: raw.slice(boundary + 2),
      messageId: `<controlled-${file}@example.test>` });
    assert.equal(classifyNoticeIdentity(transported, []).action, 'new', file);
  }
});
