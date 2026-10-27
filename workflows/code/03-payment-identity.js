'use strict';

// Pure helpers for HU-03. A durable history/claim adapter is still required.
const { createHash } = require('node:crypto');

function digest(parts) {
  return createHash('sha256').update(JSON.stringify(parts), 'utf8').digest('hex');
}

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n').trim() : '';
}

function identifyBankNotice({ accountScope, messageId, verifiedBankReference, subject, body }) {
  if (typeof accountScope !== 'string' || !accountScope.trim()) {
    throw new Error('A stable receiving-account scope is required');
  }
  if (typeof subject !== 'string' || typeof body !== 'string') {
    throw new Error('The notice subject and body must be text');
  }
  const scope = accountScope.trim();
  const contentHash = digest(['notice-content-v1', scope, cleanText(subject), cleanText(body)]);
  // verifiedBankReference must come from a trusted adapter, never directly from AI.
  const reference = cleanText(verifiedBankReference);
  const message = cleanText(messageId);
  const sourceKind = reference ? 'bank-operation' : message ? 'message-id' : null;
  const sourceId = reference || message;
  return {
    key: sourceKind ? `hu03-v1-${digest([scope, sourceKind, sourceId])}` : null,
    contentHash,
    sourceKind,
  };
}

function classifyNoticeIdentity(identity, history) {
  if (!Array.isArray(history)) throw new Error('Notice history must be available before classification');
  if (!identity.key) return { action: 'review', reason: 'missing_source_identifier' };
  const sameKey = history.filter((record) => record.key === identity.key);
  if (sameKey.some((record) => record.contentHash !== identity.contentHash)) {
    return { action: 'review', reason: 'source_identifier_content_conflict' };
  }
  if (sameKey.length) return { action: 'existing', reason: 'same_source_identifier' };
  if (identity.sourceKind !== 'bank-operation' && history.some(
    (record) => record.contentHash === identity.contentHash,
  )) {
    return { action: 'review', reason: 'identical_content_different_identifier' };
  }
  return { action: 'new', reason: 'new_source_identifier' };
}

module.exports = { identifyBankNotice, classifyNoticeIdentity };
