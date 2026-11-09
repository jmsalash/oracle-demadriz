// The visitor's own key (remembered on this device) and their document (this tab only).
const KEY = 'dasKey', DOC = 'dasDoc', NAME = 'dasName';
const ls = () => globalThis.localStorage, ss = () => globalThis.sessionStorage;

export const getKey = () => { try { return ls().getItem(KEY) || ''; } catch { return ''; } };
export const setKey = (k) => { const v = String(k || '').trim(); try { if (v) ls().setItem(KEY, v); else ls().removeItem(KEY); } catch { /* private mode */ } };
export const forgetKey = () => { try { ls().removeItem(KEY); } catch { /* nothing kept */ } };

export function getDoc() {
  try { const d = JSON.parse(ss().getItem(DOC) || 'null'); return d && typeof d.text === 'string' && d.text ? d : null; } catch { return null; }
}
export const setDoc = (doc) => { try { ss().setItem(DOC, JSON.stringify({ text: doc.text, label: doc.label || '' })); } catch { /* too big for this browser */ } };
export const clearDoc = () => { try { ss().removeItem(DOC); } catch { /* nothing kept */ } };

// How the visitor wants to be addressed, remembered on this device.
export const getName = () => { try { return ls().getItem(NAME) || ''; } catch { return ''; } };
export const setName = (n) => { const v = String(n || '').trim().slice(0, 40); try { if (v) ls().setItem(NAME, v); else ls().removeItem(NAME); } catch { /* private mode */ } };
