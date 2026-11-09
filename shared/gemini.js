// Talking to Gemini's web API with plain fetch, so the same file works in the browser, in Node and in the Worker.
export const LIVE_MODEL = 'gemini-3.1-flash-live-preview';
export const DEFAULT_VOICE = 'Despina';
const TOKEN_URL = 'https://generativelanguage.googleapis.com/v1alpha/auth_tokens';

// The JSON Google's own SDK sends for a one-use pass locked to the model, voice and instructions.
export function tokenRequest({ voice = DEFAULT_VOICE, instructions, sessionMinutes = 10 }, nowMs) {
  return {
    url: TOKEN_URL,
    body: {
      expireTime: new Date(nowMs + sessionMinutes * 60_000).toISOString(),
      newSessionExpireTime: new Date(nowMs + 60_000).toISOString(),
      uses: 1,
      bidiGenerateContentSetup: {
        model: `models/${LIVE_MODEL}`,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
        systemInstruction: { parts: [{ text: instructions }], role: 'user' },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
      fieldMask: 'model,generationConfig.responseModalities,generationConfig.speechConfig,systemInstruction.parts,'
        + 'systemInstruction.role,inputAudioTranscription,outputAudioTranscription',
    },
  };
}

// A one-use pass for a few minutes. Throws an Error carrying Gemini's status and message.
export async function mintToken({ apiKey, instructions, voice, sessionMinutes, fetchImpl = (...a) => fetch(...a), now = Date.now }) {
  const { url, body } = tokenRequest({ voice, instructions, sessionMinutes }, now());
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.name) {
    const err = new Error(data?.error?.message || data?.error?.status || `Gemini answered ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return { token: data.name, model: LIVE_MODEL, expiresAt: body.expireTime };
}

// What kind of problem Gemini had: the key's free limit is used up, the key is wrong, or something else.
export function geminiError(err) {
  const msg = String(err?.message || err);
  if (err?.status === 429 || /quota|RESOURCE_EXHAUSTED|exhausted/i.test(msg)) return 'quota';
  if (err?.status === 403 || /API key not valid|API_KEY_INVALID|PERMISSION_DENIED|API key expired/i.test(msg)) return 'badkey';
  if (err?.status === 400 && /API key/i.test(msg)) return 'badkey';
  return 'gemini';
}
