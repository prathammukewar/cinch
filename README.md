# Cinch

Play it at **https://playcinch.pages.dev/**

A daily game set on a ranch. Seven questions with number answers, the same for everyone each day. For each one you set a lasso between two fence posts on a notched rail, as tight as you dare while staying 90% sure it will rope the answer. Then the horseshoe is pitched.

Most people throw their loops too tight the first time. The Brand Book tracks, over weeks, whether your 90% loops really rope nine answers in ten.

## Scoring

Inside your loop you score 100 minus the share of the rail it covers. Just outside, the points fade to nothing within half a loop's width, so tight loops pay more and fade faster. Nothing goes below zero. A glow on the rail shows what every spot is worth while you set the loop. The rule, a simulation of nine habits and its one trade-off are in [docs/scoring.md](docs/scoring.md).

## Ways to play

- **Roundup**: today's seven, 30 seconds each, one try, a spoiler-free share line and a picture sized for stories
- **The Corral**: practice in sets of seven, never using daily questions
- **Quick Draw**: ten questions, 20 seconds each
- **Showdown**: two riders, the same seven questions. **Side by side** is for two people with one phone: each ropes the question in secret, the phone changes hands, and one horseshoe lands for both. **Send a challenge** is for later: rope seven, send a link, and your friend ropes the same seven when they like
- **Old Trails**: every earlier Roundup
- **Brand Book**: how often your loops hold the answer, over time and by subject

Two hints cost a share of the points. **Fence in** shortens the rail to a stretch that holds the answer, and your loop is then measured against that shorter rail, so roping the whole fenced stretch scores nothing. **Scout** marks two known numbers of the same kind on the rail, and the answer is not always between them.

Each throw gets a name by its points: Tumbleweed (0), Dust devil (1 to 20), Snagged (21 to 40), Roped (41 to 60), Hog-tied (61 to 80), Ringer (81 to 95) and Dead ringer (96 to 100). A near miss worth 41 or more is a Leaner.

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

## Privacy

No accounts and no cookies. Visits are counted by Cloudflare Web Analytics, which sets no cookies and does not follow anyone across sites. Scores live in your browser, and Showdown results travel inside the link you send. When you finish a Roundup on its own day, the day, your score and which questions you roped go to a small standings server (in `server/`, a Cloudflare Worker) under a random id, so the result can say how you did against everyone else that day. The Saddlebag has a backup button that saves everything to one file, and a restore button that merges a backup back in.

## Licence

Code under the MIT licence. Question data comes from the sources named with each question, under their own licences. Fonts under the SIL Open Font License.
