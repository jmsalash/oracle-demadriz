import { t, getLang } from './i18n.js';
// Sends the visitor's email to José María through the service, which passes it on and keeps nothing.
export async function sendContact({ base, email, message = '', fetchImpl = (...a) => fetch(...a) }) {
  const e = String(email || '').trim();
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(e) || e.length > 200) return { error: 'email' };
  try {
    const res = await fetchImpl(`${base}/contact`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ email: e, message: String(message || '').trim().slice(0, 1000) }), signal: AbortSignal.timeout(30000),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && data.ok ? { ok: true } : { error: data.error || 'contact' };
  } catch {
    return { error: 'contact' };
  }
}

const CONTACT_KEYS = { email: 'contactEmail', rate: 'contactRate', nocontact: 'contactNoContact' };
export function contactMessage(result, lang = getLang()) {
  return t(result.ok ? 'contactThanks' : CONTACT_KEYS[result.error] || 'contactError', {}, lang);
}
