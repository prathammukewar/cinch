# Standings server

A Cloudflare Worker with a D1 database. The game posts each finished Roundup (day, score, which of the seven were roped, and a random id made in the browser) and gets back how many riders played and what share it beat. Nothing else is stored.

    npx wrangler d1 create cinch-standings          # once; put the id in wrangler.toml
    npx wrangler d1 execute cinch-standings --remote --file schema.sql
    npx wrangler deploy

Then set `API` in `js/config.js` to the worker's address.
