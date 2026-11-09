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

export function contactMessage(result) {
  if (result.ok) return 'Thanks! José María will get back to you.';
  switch (result.error) {
    case 'email': return 'Please check your email address.';
    case 'rate': return 'Too many tries for now, please try again later.';
    case 'nocontact': return 'Sending is not available right now. Please get in touch through demadriz.com.';
    default: return 'It could not be sent. Please try again, or get in touch through demadriz.com.';
  }
}
