// Turning what the visitor gave into the agent's document, and getting a conversation pass.
import { mintToken, geminiError } from './shared/gemini.js';
import { buildInstructions, fitToTokens, estimateTokens } from './shared/prompt.js';
import { OWN_KEY_MINUTES } from './shared/settings.js';
import { pdfToText as realPdfToText } from './pdftext.js';

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
const fail = (code, detail = '') => Object.assign(new Error(code), { code, detail });
const fmt = (n) => Number(n).toLocaleString('en');

function kindOf(file) {
  const name = String(file.name || '').toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (/^text\/(plain|markdown)$/.test(file.type) || /\.(txt|md|markdown)$/.test(name)) return 'text';
  return null;
}

async function postJson(url, body, fetchImpl) {
  let res;
  try {
    res = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(90000) });
  } catch { throw fail('offline'); }
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

// { text, label, notice }, or throws an Error whose .code is a messageFor code.
export async function readDocument({ file, url, base, fetchImpl = (...a) => fetch(...a), pdfToText = realPdfToText }) {
  if (file) {
    const kind = kindOf(file);
    if (!kind) throw fail('type');
    if (file.size > MAX_FILE_BYTES) throw fail('too-large');
    let raw;
    if (kind === 'pdf') {
      try { raw = await pdfToText(await file.arrayBuffer()); } catch { throw fail('pdf-empty'); }
      if (!raw.trim()) throw fail('pdf-empty');
    } else {
      raw = await file.text();
      if (!raw.trim()) throw fail('empty');
    }
    const fit = await fitToTokens({ text: raw.trim(), count: estimateTokens });
    return { text: fit.text, label: `${file.name} · about ${fmt(fit.tokens)} tokens`, notice: fit.notice };
  }
  const address = String(url || '').trim();
  if (!address) throw fail('nothing');
  const full = /^[a-z]+:\/\//i.test(address) ? address : `https://${address}`;
  const { ok, data } = await postJson(`${base}/crawl`, { url: full }, fetchImpl);
  if (!ok) throw fail(data.error || 'offline', data.message || '');
  const pages = `${data.pages} page${data.pages === 1 ? '' : 's'}`;
  return { text: data.text, label: `${pages} from ${data.host}`, notice: data.notice || '' };
}

// A one-use pass. With the visitor's own key the browser asks Gemini itself and the service is never called.
export async function getPass({ docText, name = '', base, ownKey = '', fetchImpl = (...a) => fetch(...a) }) {
  if (ownKey) {
    try {
      const minutes = OWN_KEY_MINUTES;
      const instructions = buildInstructions({ docText, visitorName: name, minutes });
      const { token, model } = await mintToken({ apiKey: ownKey, instructions, sessionMinutes: minutes, fetchImpl });
      return { token, model, minutes };
    } catch (e) {
      return { error: e?.name === 'TimeoutError' || e instanceof TypeError ? 'offline' : geminiError(e) };
    }
  }
  try {
    const { ok, data } = await postJson(`${base}/token`, { docText, ...(name ? { name } : {}) }, fetchImpl);
    if (ok && data.token) return { token: data.token, model: data.model, minutes: data.minutes || 5, ...(data.pass ? { pass: data.pass } : {}) };
    return { error: data.error || 'offline' };
  } catch {
    return { error: 'offline' };
  }
}

// Tells the service that process was pressed, so the owner can count them; never which file or address.
// Fire and forget: it never slows the visitor down or shows an error.
export function sendProcessEvent({ base, kind, result, where = 'start', fetchImpl = (...a) => fetch(...a) }) {
  try {
    const p = fetchImpl(`${base}/event`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true, cache: 'no-store',
      body: JSON.stringify({ event: 'process', kind, result, where }),
    });
    p?.catch?.(() => {});
  } catch { /* counting is never worth an error */ }
}

// Tells the service how long a conversation on the demo key really lasted, so the unused minutes come back.
// Fire and forget, and sent even while the page closes.
export function sendTalkEnd({ base, pass, seconds, fetchImpl = (...a) => fetch(...a) }) {
  if (!pass) return;
  try {
    const p = fetchImpl(`${base}/end`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true, cache: 'no-store',
      body: JSON.stringify({ pass, seconds: Math.max(0, Math.round(seconds || 0)) }),
    });
    p?.catch?.(() => {});
  } catch { /* the full pass simply stays counted */ }
}
