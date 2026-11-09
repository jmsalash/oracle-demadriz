// The service's limits and the website addresses allowed to use it. No node: imports (the Worker uses this file).
export const SITE_ORIGIN = 'https://oracle.demadriz.com';

export const DEFAULTS = Object.freeze({
  origins: [SITE_ORIGIN],
  maxSessions: 3,      // the most conversations a free Gemini key allows at once
  sessionMinutes: 5,       // one conversation on the free demo key; Gemini ends it when its pass expires
  minutesPerIpPerDay: 5,   // talking minutes per visitor address per day on the free demo key
  perIpPerHour: 6,
  perDay: 200,
});

// Reading web addresses: no Gemini use, but each read makes up to 40 page requests.
export const TOOL_LIMITS = Object.freeze({
  origins: [SITE_ORIGIN],
  maxSessions: 1000,
  sessionMinutes: 1,
  perIpPerHour: 10,
  perDay: 500,
});

// Conversations on the visitor's own key: their key, their limits.
export const OWN_KEY_MINUTES = 10;
