// Accounts, the leaderboard and the privacy page. Loaded only when one of them is opened.
import { dayKey, dayNumber, keyOf, longDate } from './day.js';
import { nameProblem, tidyName } from './names.js';
import * as acct from './account.js';
import { h, toast, say, signed } from './dom.js';
import { withEmblem } from './art.js';

let main;
export function init(c) { main = c.main; }

const page = (title, ...kids) => h('div', { class: 'page riders' }, h('h1', {}, title), ...kids);
const today = () => dayNumber(dayKey());
const saveFile = (name, text) => {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
const copyText = async (text) => { try { await navigator.clipboard.writeText(text); toast('Copied'); } catch { toast('Copying is blocked in this browser'); } };
const ago = (t) => {
  if (!t) return 'not yet';
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} minute${m === 1 ? '' : 's'} ago` : m < 1440 ? `${Math.round(m / 60)} hours ago` : longDate(new Date(t).toISOString().slice(0, 10));
};
const busy = (btn, on, text) => { btn.disabled = on; if (text) btn.textContent = text; };

// ------------------------------------------------------------ the account page

export function showAccount(arg) {
  if (!acct.apiBase()) {
    main.replaceChildren(page('Your account', h('p', { class: 'lede' }, 'Can\u2019t reach the server right now.')));
    return;
  }
  if (arg === 'key' && acct.signedIn()) return keyScreen(acct.getKey(), true);
  if (acct.signedIn()) return manage();
  return welcome();
}

function welcome() {
  const msg = h('p', { class: 'form-msg', role: 'alert' });
  const hint = h('p', { class: 'field-hint', id: 'acct-name-hint' }, '3 to 20 letters or numbers. Not your full real name.');
  const name = h('input', { type: 'text', id: 'acct-name', maxlength: 20, autocomplete: 'off', spellcheck: 'false', 'aria-describedby': 'acct-name-hint', oninput: () => {
    const p = name.value.trim() ? nameProblem(name.value) : null;
    hint.textContent = p || '3 to 20 letters or numbers. Not your full real name.';
    hint.classList.toggle('bad', !!p);
  } });
  const listed = h('input', { type: 'checkbox', id: 'acct-listed' });
  const go = h('button', { class: 'go', type: 'button', id: 'acct-create', onclick: async () => {
    const problem = nameProblem(name.value);
    if (problem) { msg.textContent = problem; name.focus(); return; }
    busy(go, true, 'Making your account');
    try {
      const r = await acct.create(tidyName(name.value), listed.checked);
      keyScreen(r.key, false, r.joined);
    } catch (e) { msg.textContent = e.message; busy(go, false, 'Create account'); }
  } }, 'Create account');
  const keyIn = h('input', { type: 'text', id: 'acct-key', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'characters', placeholder: 'XXXXX-XXXXX-XXXXX-XXXXX-XXXXX', 'aria-label': 'Sign-in key' });
  const msg2 = h('p', { class: 'form-msg', role: 'alert' });
  const signIn = h('button', { class: 'go quiet', type: 'button', id: 'acct-signin', onclick: async () => {
    busy(signIn, true, 'Signing in');
    try { await acct.signIn(keyIn.value); toast('Signed in'); manage(); } catch (e) { msg2.textContent = e.status === 401 ? 'That key does not match an account. Check it, or it may have been deleted.' : e.message; busy(signIn, false, 'Sign in'); }
  } }, 'Sign in');
  main.replaceChildren(page('Your account',
    h('p', { class: 'lede' }, 'Keep your record on any device and put your name on the leaderboard. No email, no password.'),
    h('section', { class: 'card' },
      h('h2', {}, 'Make an account'),
      h('label', { class: 'name-field', for: 'acct-name' }, h('span', {}, 'Your leaderboard name')), name, hint,
      h('label', { class: 'check' }, listed, h('span', {}, h('b', {}, 'Show my name on the leaderboard'))),
      h('p', { class: 'fine' }, h('a', { href: '#privacy' }, 'What we keep')),
      go, msg),
    h('section', { class: 'card' },
      h('h2', {}, 'Already have an account?'),
      keyIn, signIn, msg2)));
}

/** Shown once after signing up, and again on request from the account page. */
function keyScreen(key, again, joined) {
  const shown = acct.formatKey(key);
  main.replaceChildren(page(again ? 'Your sign-in key' : 'Save your sign-in key',
    h('p', { class: 'lede' }, again ? 'Use it to sign in on another device.' : 'It is the only way back into your account.'),
    h('p', { class: 'key-box num', id: 'acct-key-show', 'aria-label': `Sign-in key ${shown.split('').join(' ')}` }, shown),
    h('div', { class: 'actions' },
      h('button', { class: 'go quiet wide', type: 'button', id: 'acct-copy', onclick: () => copyText(shown) }, 'Copy the key'),
      h('button', { class: 'go quiet wide', type: 'button', id: 'acct-download', onclick: () => saveFile('cinch-sign-in-key.txt', `Cinch sign-in key\n${shown}\n\nAnyone with this key can sign in as you. Keep it private.\n${location.origin}${location.pathname}#account\n`) }, 'Download it')),
    h('ul', { class: 'warn' },
      h('li', {}, 'Anyone with it can sign in as you.'),
      h('li', {}, 'It can\u2019t be sent again.')),
    joined ? h('p', { class: 'fine' }, `${joined} earlier Roundup${joined === 1 ? '' : 's'} added.`) : null,
    h('p', { style: 'margin-top:20px' }, h('button', { class: 'go', type: 'button', id: 'acct-saved', onclick: () => manage() }, again ? 'Done' : 'I saved it'))));
  say(again ? 'Your sign-in key' : 'Save your sign-in key. It is shown here.');
}

async function manage() {
  const m = acct.me() || {};
  const status = h('p', { class: 'fine', id: 'acct-sync' }, `Synced ${ago(acct.lastSynced())}`);
  const view = page(m.name || 'Your account');
  main.replaceChildren(view);
  // Make sure the account still exists before offering anything.
  try { await acct.refresh(); } catch (e) {
    if (e.status === 401) { toast('That account no longer exists, so this device is signed out'); welcome(); return; }
  }
  const me = acct.me();
  const name = h('input', { type: 'text', id: 'acct-rename', maxlength: 20, value: me.name, autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Your leaderboard name' });
  const msg = h('p', { class: 'form-msg', role: 'alert' });
  const rename = h('button', { class: 'go quiet', type: 'button', id: 'acct-rename-go', onclick: async () => {
    const problem = nameProblem(name.value);
    if (problem) { msg.textContent = problem; return; }
    busy(rename, true);
    try { await acct.update({ name: tidyName(name.value) }); msg.textContent = ''; toast('Name changed'); manage(); } catch (e) { msg.textContent = e.message; busy(rename, false); }
  } }, 'Change name');
  const listed = h('input', { type: 'checkbox', id: 'acct-listed-toggle', checked: !!me.listed, onchange: async () => {
    listed.disabled = true;
    try { await acct.update({ listed: listed.checked }); toast(listed.checked ? 'Your name is on the leaderboard' : 'Your name is hidden'); } catch (e) { listed.checked = !listed.checked; toast(e.message); }
    listed.disabled = false;
  } });
  const syncBtn = h('button', { class: 'chip', type: 'button', id: 'acct-sync-go', onclick: async () => {
    busy(syncBtn, true);
    try { await acct.sync(); status.textContent = `Synced ${ago(acct.lastSynced())}`; } catch (e) { status.textContent = e.message; }
    busy(syncBtn, false);
  } }, 'Sync now');
  const delWrap = h('div', { class: 'danger', hidden: true });
  const confirmIn = h('input', { type: 'text', id: 'acct-delete-name', autocomplete: 'off', 'aria-label': 'Type your name to confirm' });
  const delMsg = h('p', { class: 'form-msg', role: 'alert' });
  delWrap.append(
    h('p', {}, `Deletes your account and its Roundups for good. Type ${me.name} to confirm.`),
    confirmIn,
    h('button', { class: 'go danger-go', type: 'button', id: 'acct-delete-go', onclick: async (e) => {
      const btn = e.currentTarget;
      if (tidyName(confirmIn.value).toLowerCase() !== me.name.toLowerCase()) { delMsg.textContent = `Type ${me.name} exactly to confirm.`; return; }
      busy(btn, true, 'Deleting');
      try { await acct.remove(); main.replaceChildren(page('Account deleted', h('p', { class: 'lede' }, 'Your record is still on this device.'), h('p', { style: 'margin-top:20px' }, h('a', { class: 'go', href: '#home' }, 'Home')))); say('Account deleted'); } catch (err) { delMsg.textContent = err.message; busy(btn, false, 'Delete forever'); }
    } }, 'Delete forever'),
    delMsg);
  view.replaceChildren(
    h('h1', {}, me.name),
    h('p', { class: 'lede' }, h('a', { href: '#leaderboard' }, me.listed ? 'Your name is on the leaderboard' : 'Your name is hidden on the leaderboard')),
    h('section', { class: 'card' },
      h('h2', {}, 'Name and leaderboard'),
      h('div', { class: 'row-field' }, name, rename), msg,
      h('label', { class: 'check' }, listed, h('span', {}, h('b', {}, 'Show my name on the leaderboard')))),
    h('section', { class: 'card' },
      h('h2', {}, 'Your record'),
      h('div', { class: 'row-field' }, status, syncBtn)),
    h('section', { class: 'card' },
      h('h2', {}, 'Other devices'),
      h('p', {}, h('a', { class: 'go quiet', href: '#account/key', id: 'acct-show-key' }, 'Show my sign-in key'))),
    h('section', { class: 'card' },
      h('h2', {}, 'Your data'),
      h('div', { class: 'actions' },
        h('button', { class: 'go quiet wide', type: 'button', id: 'acct-export', onclick: async (e) => {
          const btn = e.currentTarget;
          busy(btn, true);
          try { saveFile('cinch-account-data.json', JSON.stringify(await acct.exportAll(), null, 1)); } catch (err) { toast(err.message); }
          busy(btn, false);
        } }, 'Download my data'),
        h('button', { class: 'go quiet wide', type: 'button', id: 'acct-signout', onclick: () => { acct.signOut(); toast('Signed out on this device'); welcome(); } }, 'Sign out on this device')),),
    h('section', { class: 'card' },
      h('h2', {}, 'Delete your account'),
      h('button', { class: 'go quiet', type: 'button', id: 'acct-delete', onclick: (e) => { delWrap.hidden = false; e.currentTarget.hidden = true; confirmIn.focus(); } }, 'Delete my account'),
      delWrap),
    h('p', { class: 'fine' }, h('a', { href: '#privacy' }, 'Privacy')));
}

// ------------------------------------------------------------ the leaderboard

const VIEWS = [['today', 'Today'], ['week', 'This week'], ['all', 'All time']];
/** Riders without a listed account have no name on the board. */
const who = (r) => r.name || 'Unnamed rider';
/** Signed in, the account finds your row; otherwise this browser's random id does. */
export const boardUrl = (v, n) => `/v1/leaderboard?view=${v}&day=${n}${acct.signedIn() ? '' : `&client=${acct.clientId()}`}`;
let view = 'today';

export async function showLeaderboard(arg) {
  if (VIEWS.some(([k]) => k === arg)) view = arg;
  const n = today();
  const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Leaderboard period' }, VIEWS.map(([k, label]) => h('a', { class: 'tab', role: 'tab', href: `#leaderboard/${k}`, 'aria-selected': String(k === view), id: `lb-${k}` }, label)));
  const body = h('div', { class: 'board-wrap', 'aria-live': 'polite' }, h('p', { class: 'fine' }, 'Loading'));
  main.replaceChildren(withEmblem(page('Leaderboard',
    tabs, body), 'board'));
  if (!acct.apiBase()) { body.replaceChildren(h('p', {}, 'Can\u2019t reach the leaderboard right now.')); return; }
  let d;
  try { d = await acct.call(boardUrl(view, n)); } catch (e) { body.replaceChildren(h('p', {}, e.message)); return; }
  const unit = view === 'today' ? `Roundup No. ${n}, ${longDate(keyOf(n))}` : view === 'week' ? `Roundups No. ${d.from} to ${d.to}` : `Every Roundup up to No. ${d.to}`;
  const you = d.you;
  const standing = you ? `You are #${you.rank} with ${you.score} points.` : 'No Roundup from you yet.';
  const yours = !acct.signedIn()
    ? h('div', { class: 'you-card' }, h('p', {}, standing, ' Want your name on it?'), h('a', { class: 'go', href: '#account', id: 'lb-join' }, 'Make an account'))
    : you
      ? h('div', { class: 'you-card' }, h('p', {}, you.listed ? standing : `${standing} Your name is hidden.`), you.listed ? null : h('a', { class: 'go quiet', href: '#account' }, 'Show my name'))
      : h('div', { class: 'you-card' }, h('p', {}, standing), h('a', { class: 'go quiet', href: '#today' }, 'Play today’s Roundup'));
  if (!d.rows.length) {
    body.replaceChildren(h('p', { class: 'fine' }, unit), h('p', { class: 'empty' }, 'Nobody yet.'), yours);
    return;
  }
  const card = h('div', { class: 'peek board-peek', role: 'status', hidden: true });
  const detail = (r) => {
    const roped = view === 'today' ? `Roped ${r.roped} of 7` : `Roped ${r.roped} of ${r.days * 7}`;
    return view === 'today' ? [h('p', { class: 'peek-q' }, who(r)), h('p', {}, `${r.score} points. ${roped}.`)]
      : [h('p', { class: 'peek-q' }, who(r)), h('dl', {},
        h('div', {}, h('dt', {}, 'Roundups'), h('dd', {}, String(r.days))),
        h('div', {}, h('dt', {}, 'Average'), h('dd', {}, String(Math.round(r.score / r.days)))),
        h('div', {}, h('dt', {}, 'Best day'), h('dd', {}, String(r.best))),
        h('div', {}, h('dt', {}, 'Roped'), h('dd', {}, `${Math.round((100 * r.roped) / (r.days * 7))}%`)))];
  };
  let open = null;
  let openedAt = 0;
  const show = (r, btn, toggle) => {
    // A tap focuses the row and then clicks it: the click right after the focus must not close what it opened.
    if (toggle && open === btn && performance.now() - openedAt > 350) { card.hidden = true; open = null; return; }
    if (open !== btn) openedAt = performance.now();
    open = btn;
    card.replaceChildren(...detail(r));
    card.hidden = false;
    card.style.top = `${btn.offsetTop + btn.offsetHeight + 4}px`;
  };
  const list = h('ol', { class: 'board' }, d.rows.map((r) => {
    const btn = h('button', { type: 'button', class: `rider-row${r.you ? ' you' : ''}${r.rank <= 3 ? ` medal m${r.rank}` : ''}`, 'aria-label': `${r.rank}. ${who(r)}, ${r.score} points${r.you ? ', you' : ''}`,
      onclick: (e) => show(r, e.currentTarget, true), onfocus: (e) => show(r, e.currentTarget), onpointerenter: (e) => { if (e.pointerType === 'mouse') show(r, e.currentTarget); } },
    h('span', { class: 'rk num' }, String(r.rank)),
    h('span', { class: `nm${r.name ? '' : ' anon'}` }, who(r), r.you ? h('span', { class: 'you-tag' }, 'you') : null),
    view === 'today' ? h('span', { class: 'dd num' }, `${r.roped}/7`) : h('span', { class: 'dd num' }, `${r.days} day${r.days === 1 ? '' : 's'}`),
    h('span', { class: 'sc num' }, signed(r.score)));
    return h('li', {}, btn);
  }));
  const wrap = h('div', { class: 'board-list' }, list, card);
  wrap.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { card.hidden = true; open = null; } });
  body.replaceChildren(h('p', { class: 'fine' }, `${unit} \u00b7 ${d.players} rider${d.players === 1 ? '' : 's'}`), yours, wrap);
}

// ------------------------------------------------------------ privacy

export function showPrivacy() {
  const sec = (title, ...kids) => h('section', {}, h('h2', {}, title), ...kids);
  const ul = (...items) => h('ul', {}, items.map((t) => h('li', {}, t)));
  main.replaceChildren(page('Privacy',
    h('p', { class: 'lede' }, `No email, no password, no ads, no tracking. Nothing is sold or shared.`),
    sec('On your device',
      ul('Your record, settings and a random browser id.', 'Your sign-in key, if you have an account. Never in backups.', 'In a Rodeo: the room code and a seat key, so you can get back in. Not used after six hours.')),
    sec('What reaches the server',
      ul('Finished Roundups: the day, your loops and hints, and the random browser id. No name unless you have an account.',
        'Accounts: your name, whether it is listed, a fingerprint of your key (not the key), your Roundups, and a copy of your record for other devices, minus settings and Showdown history.',
        'Rodeo rooms: names and loops, deleted within six hours.',
        'Showdown links: nothing stored.')),
    sec('Visit counts',
      h('p', {}, 'Cloudflare Web Analytics counts visits. No cookies, no profile.')),
    sec('Who handles it',
      h('p', {}, 'Cloudflare hosts the site and sees your internet address to serve it. Cinch stores none.')),
    sec('What is public',
      h('p', {}, 'Every Roundup score is on the leaderboard. Your name shows only if you list yourself.')),
    sec('Your choices',
      h('p', {}, 'On the Account page: rename, hide, download your data, or delete it all at once.')),
    sec('How long things are kept',
      ul('Accounts: until you delete them.', 'Roundups without an account: kept, with no name.', 'Rodeo rooms: six hours at most.')),
    sec('Children',
      h('p', {}, 'No age or contact details are asked. Under 13? Don\u2019t use your real name.')),
    sec('Questions',
      h('p', {}, 'Ask in a ', h('a', { href: 'https://github.com/prathammukewar/cinch/issues', target: '_blank', rel: 'noopener noreferrer' }, 'GitHub issue'), '. Never post your sign-in key.')),
    h('p', { class: 'fine' }, 'Last changed November 26, 2026.')));
}
