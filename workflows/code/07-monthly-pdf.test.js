const { test } = require('node:test');
const assert = require('node:assert/strict');
const { monthlyPdfValid } = require('./07-monthly-pdf');

test('PDF guard requires file bytes, PDF mime, header, EOF and bounded size', () => {
  const synthetic = Buffer.from('%PDF-1.7\nsynthetic-only-not-a-real-render\n%%EOF\n');
  assert.equal(monthlyPdfValid(synthetic, 'application/pdf'), true);
  assert.equal(monthlyPdfValid(synthetic, 'APPLICATION/PDF; charset=binary'), true);
  assert.equal(monthlyPdfValid(synthetic, 'text/html'), false);
  assert.equal(monthlyPdfValid(Buffer.from('<html>error</html>'), 'application/pdf'), false);
  assert.equal(monthlyPdfValid(Buffer.from('%PDF-1.7\nmissing end marker'), 'application/pdf'), false);
  assert.equal(monthlyPdfValid('not bytes', 'application/pdf'), false);
  assert.equal(monthlyPdfValid(Buffer.alloc(5_000_001), 'application/pdf'), false);
});
