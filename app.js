// The page: start screen (give a document) and agent screen (the eye, the transcript, Settings).
import { SERVICE_URL, ANALYTICS_BEACON, ANALYTICS_HOST } from './config.js';
import { readDocument, getPass, sendProcessEvent, sendTalkEnd } from './docsource.js';
import { getKey, setKey, forgetKey, getDoc, setDoc, getName, setName } from './keystore.js';
import { messageFor } from './messages.js';
import { createTranscript, domSink } from './transcript.js';
import { startConversation } from './conversation.js';
import { sendContact, contactMessage } from './contact.js';
import { t, initLang, setLang, getLang, LANGS, LANG_NAMES } from './i18n.js';

const $ = (id) => document.getElementById(id);
const base = (SERVICE_URL || location.origin).replace(/\/+$/, '');
const body = document.body;
const LABEL_KEYS = {
  idle: 'stateIdle', processing: 'stateProcessing', connecting: 'stateConnecting',
  intro: 'stateIntro', listening: 'stateListening', thinking: 'stateThinking', speaking: 'stateSpeaking',
};
const label = (state) => (LABEL_KEYS[state] ? t(LABEL_KEYS[state]) : '');
const transcript = createTranscript(domSink($('transcript')));
let conversation = null;

function setState(state) {
  body.dataset.state = state;
  const screen = body.dataset.screen;
  $('status').textContent = screen === 'start' && (state === 'idle') ? '' : label(state);
  const live = Boolean(conversation);
  $('eye').setAttribute('aria-label', t(live ? 'eyeStop' : 'eyeTalk'));
}

// The language picker: big, above the title on the start screen; small, next to Settings on the agent screen.
function placePicker(screen) {
  const pick = document.querySelector('.lang-pick');
  if (screen === 'start') $('start').prepend(pick);
  else $('open-settings').after(pick);
}

function showScreen(screen) {
  body.dataset.screen = screen;
  placePicker(screen);
  setState('idle');
}

let shown = null; // the message on screen, so it can be said again in another language
function showMessage(code, detail) {
  if (code === 'user' || code === 'hidden') return;
  shown = { code, detail };
  const m = messageFor(code, { ownKey: Boolean(getKey()), detail });
  $('message-text').textContent = m.text;
  $('message-settings').hidden = !m.settings;
  $('message-link').hidden = !m.link;
  $('message').hidden = false;
}
const hideMessage = () => { $('message').hidden = true; shown = null; };

// A document's label and its note (such as it being cut), in the page's language.
const docLabel = (doc) => (doc.labelKey ? t(doc.labelKey, doc.labelVars) : doc.label);
const docNotice = (doc) => (doc.noticeKey ? t(doc.noticeKey, doc.noticeVars) : doc.notice);

function showDoc(doc) {
  $('doc-label').textContent = doc ? t('talkingAbout', { label: docLabel(doc) }) : '';
  $('settings-doc').textContent = doc ? t('docNow', { label: docLabel(doc) }) : t('noDoc');
}

function showKey() {
  const k = getKey();
  $('settings-key').textContent = k ? t('keyOwn', { last4: k.slice(-4) }) : t('keyDemo');
  $('forget-key').hidden = !k;
}

// While a document is read, both document forms are locked (grayed out), so nobody can press Process twice.
let busy = false;
function lockDocForms(on) {
  for (const el of document.querySelectorAll('#start-form :is(button, input), #settings-doc-form :is(button, input)')) el.disabled = on;
  for (const f of document.querySelectorAll('#start-form, #settings-doc-form')) f.toggleAttribute('aria-busy', on);
}

// Reads the file or web address; on success switches to the agent screen.
async function process({ fileInput, urlInput, after, where = 'start' }) {
  if (busy) return null;
  const file = fileInput.files?.[0];
  const url = urlInput.value.trim();
  if (!file && !url) { showMessage('nothing'); return null; }
  stopTalking('user');
  hideMessage();
  const before = body.dataset.state;
  setState('processing');
  if (body.dataset.screen === 'start') $('status').textContent = label('processing');
  busy = true;
  lockDocForms(true);
  try {
    const doc = await readDocument({ file, url: file ? '' : url, base });
    sendProcessEvent({ base, kind: file ? 'file' : 'url', result: 'ok', where });
    setDoc(doc);
    showDoc(doc);
    transcript.clear();
    fileInput.value = ''; urlInput.value = '';
    fileInput.dispatchEvent(new Event('change'));
    showScreen('agent');
    if (doc.notice) $('settings-msg').textContent = docNotice(doc);
    after?.(doc);
    return doc;
  } catch (e) {
    sendProcessEvent({ base, kind: file ? 'file' : 'url', result: 'error', where });
    setState(before === 'processing' ? 'idle' : before);
    showMessage(e.code || 'error', e.detail);
    return null;
  } finally {
    busy = false;
    lockDocForms(false);
  }
}

function stopTalking(reason) { conversation?.stop(reason); }

function openContact(note = '') {
  hideMessage();
  $('contact-msg').textContent = note;
  if (!$('contact').open) $('contact').showModal();
}

function talk() {
  if (body.dataset.screen !== 'agent') return;
  if (conversation) { stopTalking('user'); return; }
  if (body.dataset.state === 'processing') return;
  const doc = getDoc();
  if (!doc) { showScreen('start'); return; }
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { showMessage('insecure'); return; }
  hideMessage();
  const ownKey = getKey();
  let pass = null;
  conversation = startConversation({
    getPass: async () => { const p = await getPass({ docText: doc.text, name: getName(), base, ownKey, lang: getLang() }); pass = p?.pass || null; return p; },
    transcript,
    onState: setState,
    onLevel: (l) => body.style.setProperty('--level', Number(l).toFixed(3)),
    onEnd: (reason, seconds) => {
      conversation = null;
      sendTalkEnd({ base, pass, seconds });
      setState('idle');
      if (reason === 'limit') { openContact(t('endThanks')); return; }
      showMessage(reason);
    },
  });
}

function chosen(input, nameEl) {
  const show = () => {
    const f = input.files?.[0];
    nameEl.textContent = f ? f.name : t('dropSub');
    input.closest('.drop').classList.toggle('chosen', Boolean(f));
  };
  input.addEventListener('change', show);
  addEventListener('langchange', show);
  show();
}

function init() {
  initLang();
  const pick = $('lang');
  for (const code of LANGS) pick.add(new Option(LANG_NAMES[code], code));
  pick.value = getLang();
  pick.addEventListener('change', () => setLang(pick.value));
  // Words set by the code are written again in the new language.
  addEventListener('langchange', () => {
    pick.value = getLang();
    setState(body.dataset.state);
    showDoc(getDoc());
    showKey();
    $('settings-msg').textContent = '';
    if (shown && !$('message').hidden) showMessage(shown.code, shown.detail);
  });
  chosen($('file'), $('file-name'));
  chosen($('s-file'), $('s-file-name'));
  $('eye').addEventListener('click', talk);

  $('start-form').addEventListener('submit', (e) => {
    e.preventDefault();
    setName($('name').value);
    showKey();
    process({ fileInput: $('file'), urlInput: $('url') });
  });

  const dialog = $('settings');
  const openSettings = () => { hideMessage(); showKey(); $('s-key').value = ''; $('s-name').value = getName(); $('settings-msg').textContent = ''; dialog.showModal(); };
  $('open-settings').addEventListener('click', openSettings);
  $('message-settings').addEventListener('click', openSettings);
  $('message-close').addEventListener('click', hideMessage);

  $('settings-doc-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const doc = await process({ fileInput: $('s-file'), urlInput: $('s-url'), where: 'settings' });
    if (!doc) return;
    // Ready: back to the eye. A note about the document (such as it being cut) is shown there instead.
    dialog.close();
    if (doc.notice) showMessage('notice', docNotice(doc));
  });
  $('settings-key-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const k = $('s-key').value.trim();
    if (!k) { $('settings-msg').textContent = t('pasteKeyFirst'); return; }
    stopTalking('user');
    setKey(k); showKey(); $('s-key').value = '';
    $('settings-msg').textContent = t('keySaved');
  });
  $('settings-name-form').addEventListener('submit', (e) => {
    e.preventDefault();
    stopTalking('user');
    setName($('s-name').value);
    $('name').value = getName();
    $('settings-msg').textContent = getName() ? t('nameSaved', { name: getName() }) : t('nameCleared');
  });
  $('forget-key').addEventListener('click', () => {
    stopTalking('user');
    forgetKey(); showKey();
    $('settings-msg').textContent = t('keyForgotten');
  });

  $('open-contact').addEventListener('click', () => openContact());
  $('contact-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('c-send').disabled = true;
    $('contact-msg').textContent = t('sending');
    const result = await sendContact({ base, email: $('c-email').value, message: $('c-message').value });
    $('contact-msg').textContent = contactMessage(result);
    $('c-send').disabled = false;
    if (result.ok) { $('c-email').value = ''; $('c-message').value = ''; }
  });

  document.addEventListener('visibilitychange', () => { if (document.hidden) stopTalking('hidden'); });
  addEventListener('pagehide', () => stopTalking('hidden'));

  showKey();
  $('name').value = getName();
  const doc = getDoc();
  showDoc(doc);
  showScreen(doc ? 'agent' : 'start');

  if (new URLSearchParams(location.search).has('test')) window.__das = { transcript, showMessage, openContact };
}

// Visit counts on the published website only (never on this computer).
export function addAnalytics(doc = document, host = location.hostname) {
  if (host !== ANALYTICS_HOST || doc.querySelector('script[data-cf-beacon]')) return false;
  const s = doc.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.dataset.cfBeacon = JSON.stringify({ token: ANALYTICS_BEACON });
  doc.head.appendChild(s);
  return true;
}

init();
addAnalytics();
