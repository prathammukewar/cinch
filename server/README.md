# Standings server

A Cloudflare Worker with a D1 database, at `https://cinch-standings.cinchgame.workers.dev`. It does four things:

- **Standings**: each Roundup finished on its own day arrives as the day, the loops thrown and a random browser id. The worker works the score out itself with the game's own scoring (`verify.js`, which loads the day's questions from the site) and answers with how many riders played and what share this one beat, overall and per question.
- **Accounts** (`accounts.js`): a public name, whether it is listed, a SHA-256 fingerprint of a 125-bit sign-in key, the Roundups finished while signed in, and a copy of the player's save. No email, password or address. Export and delete endpoints cover everything held.
- **Leaderboard**: today, this week and all time. Every verified Roundup is on it; a name shows only for a listed account, everyone else is an unnamed rider. One Roundup per account per day. Score posts are limited to ten a minute per address (`SCORES`).
- **Side by side rooms**: two riders on two devices; rooms are deleted after six hours.

Sign-ups and account calls are rate limited by Cloudflare's limiter (`SIGNUP`, `LIMITS` in `wrangler.toml`), keyed by address at the edge; the worker stores no addresses. There is also a cap of 1,000 new accounts a day.

## Setting up

    npx wrangler d1 create cinch-standings          # once; put the id in wrangler.toml
    npx wrangler d1 execute cinch-standings --remote --file schema.sql
    npx wrangler deploy

A database made before per-question points or accounts needs, once each, in order: `migrate-1.sql`, `migrate-2.sql`.

## Tests

`test/unit/server.test.js` runs this worker in Node over an in-memory SQLite database (`test/backend.js`), and the browser tests in `test/e2e/accounts.spec.js` route the page's calls into it.

## Looking after the leaderboard

Names are checked on the server (`js/names.js`), but a person can still pick something unkind. To hide a listed name, or rename it:

    npx wrangler d1 execute cinch-standings --remote --command "UPDATE accounts SET listed = 0 WHERE name = 'The Name'"
    npx wrangler d1 execute cinch-standings --remote --command "UPDATE accounts SET name = 'Rider', name_key = 'rider' || substr(id, 1, 6) WHERE name = 'The Name'"

To take a made-up score off the board (find it by day and score, then delete that row):

    npx wrangler d1 execute cinch-standings --remote --command "SELECT client, score, at FROM scores WHERE day = 2 ORDER BY score DESC LIMIT 20"
    npx wrangler d1 execute cinch-standings --remote --command "DELETE FROM scores WHERE day = 2 AND client = 'the client id'"
