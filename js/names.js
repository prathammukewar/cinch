// Leaderboard names. The same rules run in the page, for instant feedback, and on the server,
// which has the final say. A name is public, so it must not carry anyone's contact details,
// links or slurs, and it must not pass itself off as the game.

const MIN = 3;
const MAX = 20;
const RESERVED = ['cinch', 'admin', 'administrator', 'moderator', 'mod', 'official', 'support', 'staff', 'system', 'root', 'owner', 'team', 'help', 'null', 'undefined', 'anonymous', 'deleted', 'rider', 'player', 'everyone', 'nobody'];
// Matched anywhere in the folded name: slurs and the worst words, which have no innocent spellings at this length.
const NEVER = ['nigger', 'nigga', 'faggot', 'kike', 'wetback', 'raghead', 'tranny', 'nazi', 'hitler', 'kkk', 'rapist', 'pedophile', 'paedophile', 'molest', 'whore', 'slut', 'porn', 'hentai', 'jizz', 'fuck', 'shit', 'bitch', 'bastard', 'asshole', 'wank', 'twat', 'penis', 'vagina', 'pussy'];
// Whole words only, since they hide inside ordinary words (Scunthorpe, raccoon, grape, torpedo, class).
// Words for who people are are not on either list: they are not insults, and blocking them would be.
const WORDS = ['ass', 'fag', 'sex', 'nig', 'hoe', 'piss', 'cunt', 'coon', 'spic', 'anal', 'cum', 'dick', 'cock', 'tits', 'rape', 'dyke', 'pedo', 'retard', 'chink', 'boob'];
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'i' };

/** The tidy form shown to everyone: trimmed, spaces collapsed, compatibility characters folded. */
export function tidyName(raw) {
  return String(raw || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/** The form two names are compared in, so "Ann Lee", "ann_lee" and "AnnLee" count as one. */
export function nameKey(name) {
  return tidyName(name).toLowerCase().replace(/[0134578@$!|]/g, (c) => LEET[c] || c).replace(/[^\p{L}\p{N}]/gu, '');
}

/** null when the name is fine, otherwise a short reason in plain words. */
export function nameProblem(raw, { min = MIN } = {}) {
  const name = tidyName(raw);
  if (name.length < min) return `Use at least ${min} characters.`;
  if (name.length > MAX) return `Use at most ${MAX} characters.`;
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '._-]*$/u.test(name)) return 'Use letters, numbers, spaces and . _ - ’ only, starting with a letter or number.';
  if ((name.match(/\p{L}/gu) || []).length < 2) return 'Use at least two letters.';
  if (/\d{6,}/.test(name.replace(/[\s._-]/g, ''))) return 'Leave out long numbers, so nobody posts a phone number.';
  if (/(https?|www|\.(com|net|org|io|gg|co|me|xyz|app|dev|tv|ly)\b)/i.test(name)) return 'Leave out web addresses.';
  const key = nameKey(name);
  const spaced = ` ${tidyName(name).toLowerCase().replace(/[0134578@$!|]/g, (c) => LEET[c] || c).replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  if (RESERVED.includes(key) || key.startsWith('cinch')) return 'That name is reserved. Pick another.';
  if (NEVER.some((w) => key.includes(w)) || WORDS.some((w) => spaced.includes(` ${w} `) || key === w)) return 'Pick a name without that word.';
  return null;
}
