// One spoken conversation: microphone, the agent's voice, the eye's states and the transcript.
// Ported from the document agent widget. onState(state) gets: connecting, intro, listening, thinking, speaking.
// onEnd(reason, seconds) gets the talking seconds (0 if it never connected) and a reason: user, hidden, mic, quota, busy, rate, badkey, offline, too-large, limit, dropped.
import { Player } from './audio.js';
import { startLive } from './live.js';
import { WRAP_UP_NOTE, WRAP_UP_SECONDS } from './shared/prompt.js';

const MIC = { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 };
const CONNECT_TIMEOUT_MS = 15000;
const WORKLET_URL = new URL('./mic-worklet.js', import.meta.url).href;

// Must be called inside the click: iOS only unlocks audio there.
export function startConversation({ getPass, transcript, onState, onLevel = () => {}, onEnd, loadSdk }) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  ctx.resume();
  const c = { ctx, player: new Player(ctx), ready: false, introDone: false, ended: false, raf: 0, state: 'connecting', minutes: 5 };
  // The pass says how many minutes this conversation has; Gemini ends it then, the timers only make it end nicely.
  const passWithMinutes = async () => { const p = await getPass(); if (p?.minutes) c.minutes = p.minutes; return p; };
  const setState = (s) => { c.state = s; onState(s); };
  setState('connecting');

  const stopTracks = (stream) => stream?.getTracks().forEach((t) => t.stop());
  const levelLoop = () => { if (c.ended) return; onLevel(c.player.level); c.raf = requestAnimationFrame(levelLoop); };
  const afterDrain = (fn) => {
    const tick = () => { if (c.ended) return; if (c.player.playing) { requestAnimationFrame(tick); return; } fn(); };
    tick();
  };

  function end(reason) {
    if (c.ended) return;
    c.ended = true;
    clearTimeout(c.timer);
    clearTimeout(c.wrapTimer);
    clearTimeout(c.endTimer);
    cancelAnimationFrame(c.raf);
    onLevel(0);
    stopTracks(c.stream);
    try { c.node?.disconnect(); } catch { /* gone */ }
    c.player.stop();
    c.live?.end();
    c.ctx.close().catch(() => {});
    onEnd(reason, c.ready ? (Date.now() - c.readyAt) / 1000 : 0);
  }

  function onEvent(m) {
    if (c.ended) return;
    switch (m.type) {
      case 'ready':
        c.ready = true;
        c.readyAt = Date.now();
        clearTimeout(c.timer);
        c.wrapTimer = setTimeout(() => c.live?.say(WRAP_UP_NOTE), Math.max(0, c.minutes * 60 - WRAP_UP_SECONDS) * 1000);
        c.endTimer = setTimeout(() => afterDrain(() => end('limit')), (c.minutes * 60 + 5) * 1000);
        setState('intro');
        levelLoop();
        c.live.intro();
        break;
      case 'audio':
        c.player.play(m.data);
        if (c.introDone && c.state !== 'speaking') setState('speaking');
        break;
      case 'you':
        if (!c.introDone) break;
        transcript.you(m.text);
        if (c.state === 'listening') setState('thinking');
        break;
      case 'me':
        transcript.me(m.text);
        break;
      case 'interrupted':
        c.player.stop();
        if (c.introDone) setState('listening');
        break;
      case 'turnDone':
        transcript.turnDone();
        afterDrain(() => { c.introDone = true; setState('listening'); });
        break;
      case 'closed':
        // Gemini closes the conversation when its pass runs out.
        end(m.reason === 'dropped' && !c.ready ? 'offline'
          : m.reason === 'dropped' && Date.now() - c.readyAt > (c.minutes * 60 - WRAP_UP_SECONDS) * 1000 ? 'limit' : m.reason);
        break;
    }
  }

  (async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: MIC });
      if (c.ended) { stopTracks(stream); return; }
      c.stream = stream;
      // From here the mic is live: if Gemini never answers, don't leave it on.
      c.timer = setTimeout(() => { if (!c.ready) end('offline'); }, CONNECT_TIMEOUT_MS);
      await c.ctx.audioWorklet.addModule(WORKLET_URL);
      if (c.ended) return;
      const src = c.ctx.createMediaStreamSource(stream);
      c.node = new AudioWorkletNode(c.ctx, 'cva-mic-frames');
      src.connect(c.node);
      // The greeting always plays in full, so the mic is not sent until it ends.
      c.node.port.onmessage = (ev) => { if (!c.ended && c.introDone) c.live.sendAudio(ev.data, c.ctx.sampleRate); };
    } catch (e) {
      if (c.ended) return;
      end(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'mic' : 'offline');
      return;
    }
    c.live = startLive({ getPass: passWithMinutes, on: onEvent, ...(loadSdk ? { loadSdk } : {}) });
  })();

  return { stop: (reason = 'user') => end(reason), get state() { return c.state; }, get started() { return c.ready; } };
}
