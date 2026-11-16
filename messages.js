// What to tell the visitor when something goes wrong, and whether to offer Settings. Words come from i18n.js.
import { t, getLang } from './i18n.js';
export const KEY_LINK = 'https://aistudio.google.com/apikey';

const CODES = {
  quota: ['msgQuota', true, true], daily: ['msgDaily', true, true], busy: ['msgBusy', true], rate: ['msgRate', false],
  'too-large': ['msgTooLarge', false], 'pdf-empty': ['msgPdfEmpty', false], empty: ['msgEmpty', false], type: ['msgType', false],
  nothing: ['msgNothing', false], offline: ['msgOffline', true], mic: ['msgMic', false], insecure: ['msgInsecure', false],
  dropped: ['msgDropped', false], limit: ['msgLimit', false],
};

export function messageFor(code, { ownKey = false, detail = '', lang = getLang() } = {}) {
  if (ownKey && code === 'quota') return { text: t('msgOwnQuota', {}, lang), settings: true };
  if (code === 'badkey') return { text: t('msgBadKey', {}, lang), settings: true };
  if (code === 'notice') return { text: detail, settings: false };
  if (code === 'site' || code === 'url') return { text: detail || t('msgSite', {}, lang), settings: false };
  const [key, settings, link] = CODES[code] || ['msgError', false];
  return { text: t(key, {}, lang), settings, ...(link ? { link: true } : {}) };
}
