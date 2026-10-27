// Flow 00 · migration flag: pure check shared by the router generator and the tests.
// Pasted ahead of the router's "Check Migration Flag" Code node. No network, no clock: "now" is passed in.

const MAX_FLAG_AGE_MS = 30 * 60 * 1000;

// `row` is the `migration_state` row (or an empty/error item). The flag counts only while it is on AND recent:
// a crashed migration can never silence the shop for more than 30 minutes.
function isMigrationRunning(row, nowMs) {
  if (!row || row.error || row.activa !== true) return false;
  const since = Date.parse(row.desde);
  if (Number.isNaN(since)) return false;
  return nowMs - since < MAX_FLAG_AGE_MS && nowMs >= since - 60 * 1000;
}

if (typeof module !== 'undefined') {
  module.exports = { MAX_FLAG_AGE_MS, isMigrationRunning };
}
