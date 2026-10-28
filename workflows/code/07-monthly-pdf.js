// Conservative output checks, not a general-purpose PDF parser.
function monthlyPdfValid(bytes, mimeType) {
  return Buffer.isBuffer(bytes)
    && bytes.length >= 20 && bytes.length <= 5_000_000
    && String(mimeType || '').split(';')[0].trim().toLowerCase() === 'application/pdf'
    && bytes.subarray(0, 5).toString('ascii') === '%PDF-'
    && bytes.subarray(-1024).toString('ascii').includes('%%EOF');
}

if (typeof module !== 'undefined') module.exports = { monthlyPdfValid };
