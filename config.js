// Where the service (conversation passes, web addresses, contact) is.
// On this computer or the home network: the address this page came from. Anywhere else (the published website at
// oracle.demadriz.com): the Cloudflare Worker.
export const WORKER_URL = 'https://document-agent-showcase.shy-star-fcf2.workers.dev';

const host = typeof location === 'undefined' ? 'localhost' : location.hostname;
const local = host === 'localhost' || host.endsWith('.local') || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(host) || host.includes(':');
export const SERVICE_URL = local ? '' : WORKER_URL;

// Cloudflare Web Analytics for oracle.demadriz.com: anonymous visit counts, no cookies. This beacon code is public by
// design (it is in every visitor's page) and only counts visits.
export const ANALYTICS_BEACON = '94edca7b61694f19abeb338dc8bfdbda';
export const ANALYTICS_HOST = 'oracle.demadriz.com';
