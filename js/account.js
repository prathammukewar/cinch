// The account on this device: the sign-in key, the public name, and keeping the save in step with the
// server. The key lives in its own storage slot, never inside the save, so backups never carry it.
import { API } from './config.js';
import { store, importSave } from './store.js';

const KEY_SLOT = 'cinch-key';
const ME_SLOT = 'cinch-me';

/** The server, or '' when there is none ('off' in localStorage turns it off, as the tests do). */
export const apiBase = () => { try { const o = localStorage.getItem('cinch-api'); return o === 'off' ? '' : o || API; } catch { return API; } };
const slot = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage blocked */ } return null; };

export const getKey = () => slot(KEY_SLOT);
export const signedIn = () => !!getKey();
export function me() { try { return JSON.parse(slot(ME_SLOT) || 'null'); } catch { return null; } }
const setMe = (m) => slot(ME_SLOT, m ? JSON.stringify(m) : null);
/** The public name of the account signed in here, or ''. Group games start with it filled in. */
export const accountName = () => (signedIn() && me()?.name) || '';

/** Shown in groups of five so it can be read out or typed on another device. */
export const formatKey = (k) => (k || '').match(/.{1,5}/g)?.join('-') || '';

/** The random id this browser sends with Roundups, shared with the standings code. */
export function clientId() {
  let id = store.get('client');
  if (!id) { id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join(''); store.set('client', id); }
  return id;
}

export async function call(path, { method = 'GET', body, key = getKey() } = {}) {
  const base = apiBase();
  if (!base) { const e = new Error('There is no connection to the server in this browser.'); e.status = 0; throw e; }
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (key) headers.authorization = `Bearer ${key}`;
  let res;
  try { res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); } catch { const e = new Error('Could not reach the server. Check your connection.'); e.status = 0; throw e; }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || 'Something went wrong on the server.'); e.status = res.status; throw e; }
  return data;
}

function forget() { slot(KEY_SLOT, null); setMe(null); }

export async function create(name, listed) {
  const r = await call('/v1/account', { method: 'POST', body: { name, listed, client: clientId() }, key: null });
  slot(KEY_SLOT, r.key);
  setMe({ name: r.name, listed: r.listed, created: r.created });
  await sync().catch(() => {});
  return r;
}

export async function signIn(raw) {
  const key = String(raw || '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (!/^[0-9A-HJKMNP-TV-Z]{25}$/.test(key)) { const e = new Error('A sign-in key is 25 letters and numbers.'); e.status = 400; throw e; }
  const m = await call('/v1/me', { key });
  slot(KEY_SLOT, key);
  setMe({ name: m.name, listed: m.listed, created: m.created });
  await call('/v1/me/link', { method: 'POST', body: { client: clientId() } }).catch(() => {});
  await sync().catch(() => {});
  return m;
}

/** Checks the account still exists; a deleted or unknown key signs this device out. */
export async function refresh() {
  if (!signedIn()) return null;
  try {
    const m = await call('/v1/me');
    setMe({ name: m.name, listed: m.listed, created: m.created });
    return m;
  } catch (e) {
    if (e.status === 401) forget();
    throw e;
  }
}

export async function update(changes) {
  const m = await call('/v1/me', { method: 'PATCH', body: changes });
  setMe({ ...me(), ...m });
  return m;
}

export const exportAll = () => call('/v1/me/export');

export async function remove() {
  await call('/v1/me', { method: 'DELETE' });
  forget();
}

/** Signs this device out. The record stays here and on the account. */
export function signOut() { forget(); }

// ------------------------------------------------------------ keeping the save in step

let rev = 0;
let syncing = null;
// Settings stay per device, and Showdown history stays here too: it holds names other people typed.
const payload = () => { const d = JSON.parse(JSON.stringify(store.data())); delete d.settings; delete d.duels; return d; };

/** Merge the server's copy in, then send the merged record back. Nothing is ever dropped on either side. */
export function sync() {
  if (!signedIn() || !apiBase()) return Promise.resolve(null);
  if (syncing) return syncing;
  syncing = (async () => {
    for (let tries = 0; tries < 3; tries++) {
      const there = await call('/v1/me/save');
      if (there.data) importSave(JSON.stringify({ app: 'cinch', data: there.data }));
      try {
        const r = await call('/v1/me/save', { method: 'PUT', body: { rev: there.rev, data: payload() } });
        rev = r.rev;
        slot('cinch-synced', String(r.at));
        return r;
      } catch (e) {
        if (e.status !== 409) throw e;
      }
    }
    return null;
  })().finally(() => { syncing = null; });
  return syncing;
}

export const lastSynced = () => Number(slot('cinch-synced')) || 0;

let soon = null;
/** After each answer, sync a little later, so a whole round goes up in one go. */
export function syncSoon(ms = 6000) {
  if (!signedIn()) return;
  clearTimeout(soon);
  soon = setTimeout(() => { sync().catch(() => {}); }, ms);
}
