// Flow 08 · Error Workflow — "Sanitise and format" Code node.
// Pasted as-is into the Code node (mode: Run Once for All Items); also loaded by the tests.
// Reads only workflow name, execution id/url, last node and error message (spec: no customer data).

const HIDDEN = '[oculto]';
const MAX_MESSAGE_LENGTH = 500;

const AUTHORIZATION = /(authorization["']?\s*[:=]\s*["']?)(?:(?:bearer|basic)\s+)?[^\s"',;}]+/gi;
const BEARER = /\b(bearer\s+)[^\s"',;}]+/gi;
const SECRET_PAIR = /(["']?[\w-]*(?:key|token|secret|pass)[\w-]*["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s"',;}&]+)/gi;

function maskSecrets(text) {
  return text
    .replace(AUTHORIZATION, `$1${HIDDEN}`)
    .replace(BEARER, `$1${HIDDEN}`)
    .replace(SECRET_PAIR, (_match, key, value) => {
      const quote = /^["']/.test(value) ? value[0] : '';
      return `${key}${quote}${HIDDEN}${quote}`;
    });
}

function cutMessage(text) {
  return text.length > MAX_MESSAGE_LENGTH ? `${text.slice(0, MAX_MESSAGE_LENGTH)}…` : text;
}

function formatMadridTime(date) {
  return date.toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'medium' });
}

function buildAlert(errorEvent, now = new Date()) {
  const workflowName = errorEvent?.workflow?.name || 'desconocido';
  const step = errorEvent?.execution?.lastNodeExecuted || 'desconocido (falló el disparador)';
  const rawMessage = errorEvent?.execution?.error?.message;
  const message = rawMessage ? cutMessage(maskSecrets(String(rawMessage))) : 'error sin mensaje';
  const link = errorEvent?.execution?.url || 'no disponible';

  return {
    subject: `⚠️ Falló la automatización «${workflowName}»`,
    body: [
      `Flujo:     ${workflowName}`,
      `Paso:      ${step}`,
      `Error:     ${message}`,
      `Cuándo:    ${formatMadridTime(now)}`,
      `Ejecución: ${link}`,
    ].join('\n'),
  };
}

if (typeof module !== 'undefined') module.exports = { buildAlert, maskSecrets };
// Inside n8n there is no `module`; `$input` exists only there.
if (typeof $input !== 'undefined') return [{ json: buildAlert($input.first().json) }];
