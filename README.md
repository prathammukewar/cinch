# Cinch

Play it at **https://prathammukewar.github.io/cinch/**

A daily game about knowing what you don't know. Seven questions with number answers, the same for everyone each day. For each one you stretch a rubber band along a ruler until you are 90% sure the answer is inside it. Then the pin drops.

Most people are overconfident the first time they play. Trading interviews ask for exactly this kind of range, and the game tracks over weeks whether your 90% ranges catch 90% of the answers.

## Scoring

Each question starts at 100. You lose 1 point for every 1% of the ruler your range covers, and 20 for every 1% the answer misses it by. That is the interval score for a 90% range, so honest 90% ranges earn the most on average. There is no cap and no floor, because either one would pay players to gamble. The maths and a simulation of nine strategies are in [docs/scoring.md](docs/scoring.md).

## Modes

- **Today**: seven questions, one try, a share line with no spoilers and a picture sized for stories
- **Practice**: as many questions as you like
- **Quant mode**: ten questions, twenty seconds each
- **Past days**: every earlier day, playable
- **Your calibration**: catch rate over time, a calibration curve once you have 50 answers, and your best and worst subjects

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

## Privacy

No accounts, no tracking, no server. Scores live in your browser. Settings has a backup button that saves them to one file, and a restore button that merges a backup back in.

## Licence

Code under the MIT licence. Question data comes from the sources named with each question, under their own licences. Fonts under the SIL Open Font License.
