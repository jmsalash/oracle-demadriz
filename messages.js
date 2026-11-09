// What to tell the visitor when something goes wrong, and whether to offer Settings.
export const KEY_LINK = 'https://aistudio.google.com/apikey';

export function messageFor(code, { ownKey = false, detail = '' } = {}) {
  if (ownKey && code === 'quota') return { text: "Your Gemini key's free limit is used up for now.", settings: true };
  if (code === 'badkey') return { text: 'Your Gemini key was not accepted. Check it in Settings.', settings: true };
  switch (code) {
    case 'quota': return { text: "The free demo key can't serve any more conversations right now. You can create your own free Gemini key and add it in Settings.", settings: true, link: true };
    case 'daily': return { text: "You've used today's 5 free minutes on the demo key. To keep talking, create your own free Gemini key and add it in Settings, or come back tomorrow.", settings: true, link: true };
    case 'busy': return { text: 'The free demo key is busy, please try again in a minute, or add your own key in Settings.', settings: true };
    case 'rate': return { text: "You've reached this demo's limit for now, please try again later.", settings: false };
    case 'too-large': return { text: 'That file is too big: up to 20 MB.', settings: false };
    case 'pdf-empty': return { text: 'No text could be read from that PDF. It may be scanned pages; try a text version.', settings: false };
    case 'empty': return { text: 'No text could be read from that file.', settings: false };
    case 'type': return { text: 'Please choose a PDF, text or Markdown file.', settings: false };
    case 'nothing': return { text: 'Choose a file or give a web address first.', settings: false };
    case 'offline': return { text: 'The demo is offline right now. You can still talk with your own key, added in Settings.', settings: true };
    case 'mic': return { text: 'The microphone is needed to talk. Allow it in your browser and try again.', settings: false };
    case 'insecure': return { text: 'Talking needs a secure (https) page.', settings: false };
    case 'dropped': return { text: 'The conversation was cut off. Click the eye to talk again.', settings: false };
    case 'limit': return { text: "Time's up for this conversation.", settings: false };
    case 'site': case 'url': return { text: detail || 'That website could not be read.', settings: false };
    default: return { text: 'Something went wrong, please try again.', settings: false };
  }
}
