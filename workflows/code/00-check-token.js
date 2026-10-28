// Flow 00 · webhook token check: pure, shared by the router generator and the tests.
// The app can only post to a URL, so its token travels in `?token=`; callers that can set headers use `X-Webhook-Token`.

// Compares every character of the longer string, so the time does not reveal where the first difference is.
function sameSecret(expected, given) {
  if (typeof expected !== 'string' || typeof given !== 'string') return false;
  let diff = expected.length ^ given.length;
  const length = Math.max(expected.length, given.length);
  for (let i = 0; i < length; i += 1) {
    diff |= (expected.charCodeAt(i) || 0) ^ (given.charCodeAt(i) || 0);
  }
  return diff === 0;
}

// `configured` is TIENDA_WEBHOOK_TOKEN. An empty one rejects everything: the router never runs open.
function checkWebhookToken({ configured, header, query }) {
  if (typeof configured !== 'string' || configured.trim() === '') {
    return { authorized: false, misconfigured: true };
  }
  const authorized = sameSecret(configured, header) || sameSecret(configured, query);
  return { authorized, misconfigured: false };
}

if (typeof module !== 'undefined') {
  module.exports = { sameSecret, checkWebhookToken };
}
