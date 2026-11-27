# Cinch

Play it at **https://playcinch.pages.dev/**

A daily game set on a ranch. Seven questions with number answers, the same for everyone each day. For each one you set a lasso between two fence posts on a notched rail, as tight as you dare while staying 90% sure it will rope the answer. Then the horseshoe is pitched.

Most people throw their loops too tight the first time. The Brand Book tracks, over weeks, whether your 90% loops really rope nine answers in ten.

## Scoring

Inside your loop you score 100 minus the share of the rail it covers. Just outside, the points fade to nothing within half a loop's width, so tight loops pay more and fade faster. Nothing goes below zero. A glow on the rail shows what every spot is worth while you set the loop. Every rail of the same kind is the same length (a factor of 100 for numbers that grow by multiples, 150 years for years, 1,000 degrees for temperatures, 0 to 100 for percentages), so the same loop always scores the same. The rule, a simulation of nine habits and its one trade-off are in [docs/scoring.md](docs/scoring.md).

## Ways to play

- **Roundup**: today's seven, 30 seconds each, one try, a spoiler-free share line and a picture sized for stories
- **The Corral**: practice on your own terms. Pick the topics, the difficulty (Tenderfoot, Wrangler, Trail boss), the kind of answer (years, percentages, temperatures, amounts), 5 to 15 questions, no clock or a 30 or 10 second one, and whether to deal the ones you have seen least or the ones you missed. Daily questions never turn up here
- **Quick Draw**: ten questions, 10 seconds each
- **Rodeo**: a live room for up to twelve riders, each on their own device. One rider opens a room and sends the code or link; the others join, and the host starts it. Everyone ropes the same seven questions against the same 30-second fuse, every loop lands on the rail at once, and the standings come at the end. The host can run it again with new questions
- **Showdown**: two riders, the same seven questions. **Same saddle** is for one device passed between two people. **Send a challenge** is for later: rope seven, send a link, and your friend ropes the same seven when they like
- **Leaderboard**: today, this week and all time. Every Roundup is on it; a name shows only for riders who choose to be listed. Scores are worked out by the server from the loops thrown, so they cannot be made up
- **Old Trails**: every earlier Roundup
- **Brand Book**: your stats: how often your loops hold the answer, every throw by name, each Roundup, your habits, and each topic

Two hints cost a share of the points. **Fence in** shortens the rail to a stretch that holds the answer, and your loop is then measured against that shorter rail, so roping the whole fenced stretch scores nothing. The answer can sit anywhere in the stretch, near its ends too. Fencing once keeps 75% of the points, twice 50%. **Scout** marks two known numbers of the same kind on the rail, and the answer is not always between them.

**See context** is free: one or two sentences on what the subject is (a mountain, a board game, a cheese), for when you have never heard of it. It says nothing about the number.

Each throw gets a name by its points: Tumbleweed (0), Dust devil (1 to 20), Snagged (21 to 40), Roped (41 to 60), Hog-tied (61 to 80), Ringer (81 to 95) and Dead cinch (96 to 100), old cow-country talk for a sure thing. A near miss worth 41 or more is a Leaner.

## Questions

Every answer comes from a fetched source: NASA, NOAA, USGS, the Census Bureau, the Federal Reserve, USDA FoodData Central, PubChem, the World Bank, Our World in Data, AnAge, Wikidata (checked against Wikipedia), Project Gutenberg texts counted here, and others. Each question carries its source link, licence and the piece of the source that shows the number. How they are built and checked is in [tools/bank/README.md](tools/bank/README.md).

## Running it

There is no build step. Serve the folder and open it:

```
node tools/serve.mjs 8691
```

Tests:

```
npm install
npx playwright install chromium
npm run test:unit
npx playwright test
```

The site is hosted on Cloudflare Pages. `npm run deploy` copies only the files the site needs into `dist/` and uploads them with wrangler. The standings server in `server/` deploys on its own; see [server/README.md](server/README.md).

## Accounts and privacy

Accounts are optional. One holds a public name, whether to list it on the leaderboard, a one-way fingerprint of a sign-in key, the Roundups finished while signed in, and a copy of the player's record so it can follow them to other devices. There is no email, no password and no real name. The sign-in key is shown once and kept only by the player; a lost key cannot be recovered. Listing on the leaderboard is off until the player turns it on. Players can rename, hide, download everything held for them, or delete it all at once.

Without an account, a Roundup finished on its own day sends the day, the loops thrown and a random id made in the browser, so the result can say how it compares with everyone else that day. Visits are counted by Cloudflare Web Analytics, which sets no cookies. The site sends a strict Content Security Policy, no referrer, and refuses to be framed. Everything is set out on the game's Privacy page.

## Licence

Code under the MIT licence. Question data comes from the sources named with each question, under their own licences. Fonts under the SIL Open Font License. Sound effects are recordings from Kenney's Impact Sounds and RPG Audio packs (CC0), cut into one file by `tools/sfx.py`; the guitar and the whip crack are made in the browser.
