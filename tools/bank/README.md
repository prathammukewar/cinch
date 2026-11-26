# Question bank

Every number in the game comes out of a response fetched by these scripts or a calculation run here. Nothing is typed in by hand.

    python3 tools/bank/build.py      # fetch (or reuse the cache) and write bank/questions.json
    python3 tools/bank/validate.py   # schema, units, rulers, duplicates and near duplicates
    python3 tools/bank/verify.py     # second check: fetch everything again and compare
    node tools/bank/ship.mjs         # plan the days and write data/*.json

## How a question is made

Each `s_*.py` file reads one kind of source and registers questions with `add()`: the wording, the number as read, the unit, the source link, its licence, a short piece of the response that shows the number (`evidence`), and a one-line explainer. Numbers in explainers are computed from the same fetched data or left out.

`build.py` gives each question a ruler. Log rulers cover a fixed number of powers of ten and linear rulers a fixed width, and the answer is placed at a random point between 7% and 93% along it (seeded by the question id), so the middle of the ruler is no hint. Percentages use 0 to 100.

## Checks

- `validate.py` stops the build on a missing field, a missing source, an answer outside its ruler, a question that gives its answer away, a duplicate or near duplicate, a dash in the text, or a grim topic word.
- `verify.py` fetches every source again with the cache ignored and requires the same number (within a stated tolerance for counts that grow, like Wikipedia's article count). Where a different source exists it checks that too (`second.py`): JPL against NASA's fact sheet for planet sizes, PanTHERIA against AnAge for pregnancies and birth weights, GeoNames against the World Bank for country areas and populations, Wikidata against PubChem for melting and boiling points, and a different algorithm for every calculated question.
- Wikidata numbers are kept only when the English Wikipedia article states the same number next to a word that names the measure, within 0.6%, and when Wikidata holds a single value.
- `drop.json` lists questions removed by hand and why.

## Adding questions

Add an entry to the list in the right `s_*.py` file, run the four commands above, and read the new evidence lines. Days that have already been shipped are frozen in `bank/schedule.json` and never change.

Rails are standardized when shipping (`ship.mjs`): every rail of the same kind gets the same length, with the answer placed at random between 10% and 90% along it. Rails for days already played (before `RAILS_FROM`) are left as they were played.
