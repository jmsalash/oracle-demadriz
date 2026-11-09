// The conversation written out as it is spoken: one growing line per speaker per turn.
// The sink draws it: add(role) -> line handle, update(handle, text), clear().
export function createTranscript(sink) {
  let current = { you: null, me: null };
  const say = (role) => (text) => {
    const t = String(text || '').trim();
    if (!t) return;
    if (!current[role]) current[role] = sink.add(role);
    sink.update(current[role], t);
  };
  return {
    you: say('you'),
    me: say('me'),
    turnDone() { current = { you: null, me: null }; },
    clear() { current = { you: null, me: null }; sink.clear(); },
  };
}

// The sink for the page: lines in a scrolling box, newest at the bottom.
export function domSink(box) {
  const stick = () => { box.scrollTop = box.scrollHeight; };
  return {
    add(role) {
      const p = document.createElement('p');
      p.className = `line ${role}`;
      p.setAttribute('aria-label', role === 'you' ? 'You' : 'Agent');
      box.appendChild(p);
      return p;
    },
    update(p, text) { p.textContent = text; stick(); },
    clear() { box.replaceChildren(); },
  };
}
