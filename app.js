// The page: start screen (give a document) and agent screen (the eye, the transcript, Settings).
import { SERVICE_URL, ANALYTICS_BEACON, ANALYTICS_HOST } from './config.js';
import { readDocument, getPass, sendProcessEvent, sendTalkEnd } from './docsource.js';
import { getKey, setKey, forgetKey, getDoc, setDoc, getName, setName } from './keystore.js';
import { messageFor } from './messages.js';
import { createTranscript, domSink } from './transcript.js';
import { startConversation } from './conversation.js';
import { sendContact, contactMessage } from './contact.js';

const $ = (id) => document.getElementById(id);
const base = (SERVICE_URL || location.origin).replace(/\/+$/, '');
const body = document.body;
const LABELS = {
  idle: 'Click the eye to talk', processing: 'Reading your document…', connecting: 'Connecting…',
  intro: 'Introducing itself', listening: 'Listening · click the eye to stop', thinking: 'Thinking…', speaking: 'Speaking',
};
const transcript = createTranscript(domSink($('transcript')));
let conversation = null;

function setState(state) {
  body.dataset.state = state;
  const screen = body.dataset.screen;
  $('status').textContent = screen === 'start' && (state === 'idle') ? '' : (LABELS[state] || '');
  const live = Boolean(conversation);
  $('eye').setAttribute('aria-label', live ? 'Stop the conversation' : 'Talk to the document agent');
}

function showScreen(screen) {
  body.dataset.screen = screen;
  setState('idle');
}

function showMessage(code, detail) {
  if (code === 'user' || code === 'hidden') return;
  const m = messageFor(code, { ownKey: Boolean(getKey()), detail });
  $('message-text').textContent = m.text;
  $('message-settings').hidden = !m.settings;
  $('message-link').hidden = !m.link;
  $('message').hidden = false;
}
const hideMessage = () => { $('message').hidden = true; };

function showDoc(doc) {
  $('doc-label').textContent = doc ? `Talking about ${doc.label}` : '';
  $('settings-doc').textContent = doc ? `Now: ${doc.label}` : 'No document yet.';
}

function showKey() {
  const k = getKey();
  $('settings-key').textContent = k ? `Using your own key (…${k.slice(-4)}).` : 'Using the free demo key.';
  $('forget-key').hidden = !k;
  $('key').value = k;
}

// Reads the file or web address; on success switches to the agent screen.
async function process({ fileInput, urlInput, button, after, where = 'start' }) {
  const file = fileInput.files?.[0];
  const url = urlInput.value.trim();
  if (!file && !url) { showMessage('nothing'); return false; }
  stopTalking('user');
  hideMessage();
  const before = body.dataset.state;
  setState('processing');
  if (body.dataset.screen === 'start') $('status').textContent = LABELS.processing;
  button.disabled = true;
  try {
    const doc = await readDocument({ file, url: file ? '' : url, base });
    sendProcessEvent({ base, kind: file ? 'file' : 'url', result: 'ok', where });
    setDoc(doc);
    showDoc(doc);
    transcript.clear();
    fileInput.value = ''; urlInput.value = '';
    fileInput.dispatchEvent(new Event('change'));
    showScreen('agent');
    if (doc.notice) $('settings-msg').textContent = doc.notice;
    after?.(doc);
    return true;
  } catch (e) {
    sendProcessEvent({ base, kind: file ? 'file' : 'url', result: 'error', where });
    setState(before === 'processing' ? 'idle' : before);
    showMessage(e.code || 'error', e.detail);
    return false;
  } finally {
    button.disabled = false;
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
    getPass: async () => { const p = await getPass({ docText: doc.text, name: getName(), base, ownKey }); pass = p?.pass || null; return p; },
    transcript,
    onState: setState,
    onLevel: (l) => body.style.setProperty('--level', Number(l).toFixed(3)),
    onEnd: (reason, seconds) => {
      conversation = null;
      sendTalkEnd({ base, pass, seconds });
      setState('idle');
      if (reason === 'limit') { openContact("That's the end of this conversation. Thanks for trying it!"); return; }
      showMessage(reason);
    },
  });
}

function chosen(input, nameEl, fallback) {
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    nameEl.textContent = f ? f.name : fallback;
    input.closest('.drop').classList.toggle('chosen', Boolean(f));
  });
}

function init() {
  chosen($('file'), $('file-name'), 'PDF, text or Markdown, up to 20 MB');
  chosen($('s-file'), $('s-file-name'), 'PDF, text or Markdown, up to 20 MB');
  $('eye').addEventListener('click', talk);

  $('start-form').addEventListener('submit', (e) => {
    e.preventDefault();
    setKey($('key').value);
    setName($('name').value);
    showKey();
    process({ fileInput: $('file'), urlInput: $('url'), button: $('process') });
  });

  const dialog = $('settings');
  const openSettings = () => { hideMessage(); showKey(); $('s-key').value = ''; $('s-name').value = getName(); $('settings-msg').textContent = ''; dialog.showModal(); };
  $('open-settings').addEventListener('click', openSettings);
  $('message-settings').addEventListener('click', openSettings);
  $('message-close').addEventListener('click', hideMessage);

  $('settings-doc-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = await process({ fileInput: $('s-file'), urlInput: $('s-url'), button: e.submitter || e.target.querySelector('button'), where: 'settings' });
    if (ok && !$('settings-msg').textContent) $('settings-msg').textContent = 'Document ready. Close Settings and click the eye to talk.';
  });
  $('settings-key-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const k = $('s-key').value.trim();
    if (!k) { $('settings-msg').textContent = 'Paste a key first.'; return; }
    stopTalking('user');
    setKey(k); showKey(); $('s-key').value = '';
    $('settings-msg').textContent = 'Key saved in this browser. Your next conversation uses it.';
  });
  $('settings-name-form').addEventListener('submit', (e) => {
    e.preventDefault();
    stopTalking('user');
    setName($('s-name').value);
    $('name').value = getName();
    $('settings-msg').textContent = getName() ? `Saved. The agent will call you ${getName()}.` : 'Saved. The agent will not use a name.';
  });
  $('forget-key').addEventListener('click', () => {
    stopTalking('user');
    forgetKey(); showKey();
    $('settings-msg').textContent = 'Your key was forgotten. The free demo key is used again.';
  });

  $('open-contact').addEventListener('click', () => openContact());
  $('contact-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('c-send').disabled = true;
    $('contact-msg').textContent = 'Sending…';
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
