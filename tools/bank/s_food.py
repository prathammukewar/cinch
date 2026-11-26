import zipfile, io
from lib import *

URL = "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2025-04-24.zip"
_foods = None


def foods():
    global _foods
    if _foods is None:
        z = zipfile.ZipFile(io.BytesIO(fetch(URL, binary=True)))
        d = json.loads(z.read(z.namelist()[0]))
        _foods = {f["description"].replace(" ", " "): f for f in d[list(d)[0]]}
    return _foods


def food(name):
    f = foods()
    if name in f: return f[name]
    c = [k for k in f if k.startswith(name)]
    if len(c) != 1: raise LookupError(f"{name}: {c[:3]}")
    return f[c[0]]


def nut(name, nutrient, unit=None):
    fd = food(name)
    for n in fd["foodNutrients"]:
        if n["nutrient"]["name"] == nutrient and (unit is None or n["nutrient"]["unitName"] == unit) and n.get("amount") is not None:
            return n["amount"], fd
    raise LookupError(f"{name}: no {nutrient}")


W, K, PRO, FAT, SUG, NA, VC, FIB, CA, FE = "Water", "Potassium, K", "Protein", "Total lipid (fat)", "Sugars, Total", "Sodium, Na", "Vitamin C, total ascorbic acid", "Fiber, total dietary", "Calcium, Ca", "Iron, Fe"


def fdc():
    def q(id, name, nutrient, question, unit, expl, d=2, u=None, **k):
        def go():
            v, fd = nut(name, nutrient, u)
            add("fo-" + id, question, v, unit, "Food", difficulty=d, url=f"https://fdc.nal.usda.gov/food-details/{fd['fdcId']}/nutrients", source="USDA FoodData Central", licence=CC0,
                evidence=f"FoodData Central Foundation Foods (April 2025), {fd['description']}, per 100 g: {nutrient} = {v}", explainer=expl(v) if callable(expl) else expl, check=f"fdc|{name}|{nutrient}", topic="fo-" + nutrient[:4], **k)
        attempt("fo-" + id, go)
    A = lambda n, x: nut(n, x)[0]
    pct = dict(scale="linear", span=100, lo=0, hi=100)
    q("water-cuke", "Cucumber, with peel, raw", W, "What percent of a cucumber's weight is water?", "%", lambda v: f"Iceberg lettuce is {fmt(A('Lettuce, iceberg, raw', W),0)}%.", 1, **pct)
    q("water-apple", "Apples, gala, with skin, raw", W, "What percent of a Gala apple's weight is water?", "%", lambda v: f"A ripe banana is {fmt(A('Bananas, ripe and slightly ripe, raw', W),0)}%.", 1, **pct)
    q("water-cheddar", "Cheese, cheddar", W, "What percent of cheddar cheese is water?", "%", lambda v: f"Fat makes up {fmt(A('Cheese, cheddar', FAT),0)}%.", 2, **pct)
    q("water-bread", "Bread, white, commercially prepared", W, "What percent of store-bought white bread is water?", "%", "Toasting drives a good part of it off.", 2, **pct)
    q("water-steak", "Beef, ribeye, steak, boneless, choice, r", W, "What percent of a raw ribeye steak is water?", "%", lambda v: f"Fat is about {fmt(A('Beef, ribeye, steak, boneless, choice, r', FAT),0)}%.", 2, **pct)
    q("water-avocado", "Avocado, Hass, peeled, raw", W, "What percent of a Hass avocado's flesh is water?", "%", lambda v: f"Fat is {fmt(A('Avocado, Hass, peeled, raw', FAT),0)}%, which is where the creaminess comes from.", 2, **pct)
    q("water-egg", "Eggs, Grade A, Large, egg white", W, "What percent of an egg white is water?", "%", lambda v: f"The yolk is only {fmt(A('Eggs, Grade A, Large, egg yolk', W),0)}%.", 2, **pct)
    q("water-butter", "Butter, stick, unsalted", W, "What percent of a stick of butter is water?", "%", lambda v: f"Nearly all the rest, {fmt(A('Butter, stick, unsalted', FAT),0)}%, is fat.", 2, **pct)
    q("water-potato", "Potatoes, russet, without skin, raw", W, "What percent of a peeled raw russet potato is water?", "%", "It has to boil away before a fry turns crisp.", 1, **pct)
    q("water-salmon", "Fish, salmon, Atlantic, farm raised, raw", W, "What percent of a raw farmed salmon fillet is water?", "%", lambda v: f"Fat is {fmt(A('Fish, salmon, Atlantic, farm raised, raw', FAT),0)}%.", 2, **pct)
    q("fat-macadamia", "Nuts, macadamia nuts, raw", FAT, "What percent of a macadamia nut is fat?", "%", lambda v: f"Cashews come in at {fmt(A('Nuts, cashew nuts, raw', FAT),0)}%.", 2, **pct)
    q("fat-heavy", "Cream, heavy", FAT, "What percent of heavy cream is fat?", "%", "That is enough to turn into butter if you keep whipping.", 2, **pct)
    q("fat-creamcheese", "Cream cheese, full fat, block", FAT, "What percent of full-fat cream cheese is fat?", "%", lambda v: f"Cheddar has {fmt(A('Cheese, cheddar', FAT),0)}%.", 2, **pct)
    q("prot-peanut", "Peanut butter, creamy", PRO, "What percent of creamy peanut butter is protein?", "%", lambda v: f"Fat takes up {fmt(A('Peanut butter, creamy', FAT),0)}%.", 2, **pct)
    q("prot-chicken", "Chicken, breast, boneless, skinless, raw", PRO, "What percent of a raw skinless chicken breast is protein?", "%", "Nearly all the rest is water.", 1, **pct)
    q("prot-parm", "Cheese, parmesan, grated, refrigerated", PRO, "What percent of grated parmesan is protein?", "%", "Months of drying concentrate it.", 3, **pct)
    q("prot-lentil", "Lentils, dry", PRO, "What percent of dry lentils is protein?", "%", lambda v: f"Dry chickpeas have {fmt(A('Chickpeas, (garbanzo beans, bengal gram)', PRO),0)}%.", 2, **pct)
    q("sug-ketchup", "Ketchup, restaurant", SUG, "What percent of restaurant ketchup is sugar?", "%", "Sugar and vinegar together help it keep for months.", 1, **pct)
    q("sug-grape", "Grapes, red, seedless, raw", SUG, "What percent of red seedless grapes is sugar?", "%", "Drying them into raisins multiplies that several times.", 2, **pct)
    q("sug-strawberry", "Strawberries, raw", SUG, "What percent of a strawberry is sugar?", "%", lambda v: f"Grapes have {fmt(A('Grapes, red, seedless, raw', SUG),0)}%.", 2, **pct)
    q("sug-oj", "Orange juice, no pulp, not fortified, no", SUG, "What percent of orange juice is sugar?", "%", "Whole oranges have about the same, plus the fiber.", 2, **pct)
    q("pot-banana", "Bananas, ripe and slightly ripe, raw", K, "How many milligrams of potassium are in 100 grams of ripe banana?", "mg", lambda v: f"Raw spinach has more, {fmt(A('Spinach, mature', K),0)} mg.", 1, span=4)
    q("pot-potato", "Potatoes, russet, without skin, raw", K, "How many milligrams of potassium are in 100 grams of raw russet potato?", "mg", lambda v: f"Bananas, famous for it, have {fmt(A('Bananas, ripe and slightly ripe, raw', K),0)} mg.", 2, span=4)
    q("vitc-redpep", "Peppers, bell, red, raw", VC, "How many milligrams of vitamin C are in 100 grams of red bell pepper?", "mg", lambda v: f"A navel orange has {fmt(A('Oranges, raw, navels', VC),0)} mg.", 2, span=4)
    q("vitc-orange", "Oranges, raw, navels", VC, "How many milligrams of vitamin C are in 100 grams of navel orange?", "mg", lambda v: f"Red bell pepper beats it with {fmt(A('Peppers, bell, red, raw', VC),0)} mg.", 1, span=4)
    q("vitc-strawb", "Strawberries, raw", VC, "How many milligrams of vitamin C are in 100 grams of strawberries?", "mg", lambda v: f"Navel oranges have {fmt(A('Oranges, raw, navels', VC),0)} mg.", 2, span=4)
    q("na-feta", "Cheese, feta, whole milk, crumbled", NA, "How many milligrams of sodium are in 100 grams of feta?", "mg", "Feta is stored in brine, which is where the salt gets in.", 2, span=4)
    q("na-pickle", "Pickles, cucumber, dill or kosher dill", NA, "How many milligrams of sodium are in 100 grams of dill pickles?", "mg", "The cucumber itself starts with almost none.", 2, span=4)
    q("na-ketchup", "Ketchup, restaurant", NA, "How many milligrams of sodium are in 100 grams of restaurant ketchup?", "mg", lambda v: f"Yellow mustard has {fmt(A('Mustard, prepared, yellow', NA),0)} mg.", 2, span=4)
    q("na-bread", "Bread, white, commercially prepared", NA, "How many milligrams of sodium are in 100 grams of white bread?", "mg", "Bread tastes mild but is one of the larger sources of salt in many diets.", 2, span=4)
    q("ca-parm", "Cheese, parmesan, grated, refrigerated", CA, "How many milligrams of calcium are in 100 grams of grated parmesan?", "mg", lambda v: f"Whole milk has {fmt(A('Milk, whole, 3.25% milkfat, with added v', CA),0)} mg in the same weight.", 2, span=4)
    q("ca-milk", "Milk, whole, 3.25% milkfat, with added v", CA, "How many milligrams of calcium are in 100 grams of whole milk?", "mg", lambda v: f"Cheddar packs {fmt(A('Cheese, cheddar', CA),0)} mg into the same weight.", 1, span=4)
    q("fe-spinach", "Spinach, mature", FE, "How many milligrams of iron are in 100 grams of raw spinach?", "mg", lambda v: f"Dry lentils have {fmt(A('Lentils, dry', FE),1)} mg.", 2, span=3.6)
    def kcal(id, name, question, expl, d=2):
        def go():
            fd = food(name)
            es = {n["nutrient"]["name"]: n["amount"] for n in fd["foodNutrients"] if n["nutrient"]["unitName"] == "kcal" and n.get("amount")}
            v = es.get("Energy (Atwater General Factors)") or es.get("Energy")
            add("fo-" + id, question, round(v), "calories", "Food", difficulty=d, span=3.4, url=f"https://fdc.nal.usda.gov/food-details/{fd['fdcId']}/nutrients", source="USDA FoodData Central", licence=CC0, evidence=f"FoodData Central Foundation Foods (April 2025), {fd['description']}, per 100 g: {es}", explainer=expl, check=f"fdc-kcal|{name}", topic="fo-kcal")
        attempt("fo-" + id, go)
    kcal("kcal-avocado", "Avocado, Hass, peeled, raw", "How many calories are in 100 grams of Hass avocado?", "Most of it comes from fat.", 1)
    kcal("kcal-broccoli", "Broccoli, raw", "How many calories are in 100 grams of raw broccoli?", "You would need several heads to match a chocolate bar.", 1)
    kcal("kcal-pbutter", "Peanut butter, creamy", "How many calories are in 100 grams of creamy peanut butter?", "A hundred grams is a little over six tablespoons.", 1)
    kcal("kcal-celery", "Celery, raw", "How many calories are in 100 grams of celery?", "It is nearly all water and fiber.", 1)
    kcal("kcal-whiterice", "Rice, white, long grain, unenriched, raw", "How many calories are in 100 grams of uncooked white rice?", "Cooked rice has about a third as many by weight, because of the water.", 2)
    kcal("kcal-banana", "Bananas, ripe and slightly ripe, raw", "How many calories are in 100 grams of ripe banana?", "That is about one medium banana without its peel.", 1)
    kcal("kcal-blueberry", "Blueberries, raw", "How many calories are in 100 grams of blueberries?", "Nearly all of them come from sugar.", 1)


def ecfr():
    base = "https://www.ecfr.gov/api/versioner/v1/full/2026-01-01/title-21.xml?section="
    def e(id, sec, pat, question, unit, expl, d=2, **k):
        def go():
            t = plain(fetch(base + sec, headers={"Accept": "application/xml"}))
            v, snip = find(t, pat)
            add("fo-" + id, question, v, unit, "Food", difficulty=d, url=f"https://www.ecfr.gov/current/title-21/section-{sec}", source=f"US food rules, 21 CFR {sec}", licence=PD, evidence=snip, explainer=expl, check=f"ecfr|{sec}|{pat}", as_of="US rules on January 1, 2026", topic="fo-law", **k)
        attempt("fo-" + id, go)
    pct = dict(scale="linear", span=100, lo=0, hi=100)
    e("mayo", "169.140", r"not less than (\d+) percent by weight of vegetable oil", "By US law, at least what percent of mayonnaise must be vegetable oil?", "%", "Below that it has to be sold as dressing or spread.", **pct)
    e("icecream-fat", "135.110", r"not less than (\d+) percent milkfat", "By US law, plain ice cream must contain at least what percent milkfat?", "%", "Anything leaner has to carry a different name, such as frozen dairy dessert.", **pct)
    e("icecream-lb", "135.110", r"(\d+\.\d+) pounds (?:of finished food )?(?:per|to the) gallon", "By US law, a gallon of ice cream must weigh at least how many pounds?", "pounds", "The rule limits how much air can be whipped in. Water weighs over 8 pounds a gallon.", 3, span=2.6)
    e("milkchoc", "163.130", r"not less than (\d+) percent by weight of chocolate liquor", "By US law, milk chocolate must contain at least what percent chocolate liquor, the ground cocoa part?", "%", "Most of the rest is sugar and milk.", **pct)
    e("maple", "168.140", r"not less than (\d+) percent by weight of soluble solids", "By US law, at least what percent of maple syrup must be dissolved solids, mostly sugar?", "%", "Sap comes out of the tree at only a few percent sugar.", **pct)
    e("margarine", "166.110", r"not less than (\d+) percent fat", "By US law, margarine must be at least what percent fat?", "%", "Butter is held to the same figure.", **pct)
    e("peanutb", "164.150", r"fat content[^.]{0,80}?(\d+) percent", "By US law, peanut butter may be at most what percent fat?", "%", "The same rule says nearly all of it has to be actual peanuts.", **pct)


def other():
    page("fo-caff-coffee", "https://www.fda.gov/consumers/consumer-updates/spilling-beans-how-much-caffeine-too-much", r"black tea[^.]{0,30}?(\d+)", "How many milligrams of caffeine are in a typical 12-ounce black tea, says the FDA?", "mg", "Food", "US Food and Drug Administration", "Green tea has roughly half as much, and brewed coffee well over it.", span=3.4, difficulty=2)
    page("fo-caff-limit", "https://www.fda.gov/consumers/consumer-updates/spilling-beans-how-much-caffeine-too-much", r"(\d+) milligrams a day", "How many milligrams of caffeine a day does the FDA say most healthy adults can have?", "mg", "Food", "US Food and Drug Administration", "It depends on the person. Some people feel far less than that.", span=3.4, difficulty=1)
    page("fo-chicken", "https://www.ers.usda.gov/data-products/ag-and-food-statistics-charting-the-essentials/food-availability-and-consumption", r"(\d+\.\d+) pounds of chicken", "How many pounds of chicken were available per person in the US in 2021?", "pounds", "Food", "USDA Economic Research Service", "It is counted boneless, and it is the most common meat on US plates.", span=3, difficulty=2)


def owid():
    def o(id, slug, country, question, unit, f, expl, d=2, **k):
        def go():
            import csv as _c
            u = f"https://ourworldindata.org/grapher/{slug}.csv?csvType=full&useColumnShortNames=true"
            rows = [r for r in _c.DictReader(io.StringIO(fetch(u))) if r.get("Entity", r.get("entity")) == country]
            rows.sort(key=lambda r: int(r.get("Year", r.get("year"))))
            r = rows[-1]; col = [c for c in r if c.lower() not in ("entity", "code", "year", "owid_region", "time")][0]
            y = r.get("Year", r.get("year")); v = float(r[col]) * f
            add("fo-" + id, question, float(f"{v:.6g}"), unit, "Food", difficulty=d, url=f"https://ourworldindata.org/grapher/{slug}", source="FAO, via Our World in Data", licence=CCBY, evidence=f"{slug}.csv: {country}, {y}, {col} = {r[col]}", explainer=expl, as_of=f"In {y}", check=f"owid|{slug}|{country}|{y}|{f}", topic="fo-crop", **k)
        attempt("fo-" + id, go)
    o("coffee-bra", "coffee-bean-production", "Brazil", "How many tonnes of coffee beans did Brazil grow?", "tonnes", 1, "Brazil grows more coffee than any other country.", span=4.5)
    o("banana-world", "banana-production", "World", "How many tonnes of bananas did the world grow?", "tonnes", 1, "India grows more than anyone but exports few of them.", span=5)
    o("choc-civ", "cocoa-bean-production", "Cote d'Ivoire", "How many tonnes of cocoa beans did Ivory Coast grow?", "tonnes", 1, "It is the world's largest cocoa grower by a wide margin.", span=4.5)
    o("potato-world", "potato-production", "World", "How many tonnes of potatoes did the world grow?", "tonnes", 1, "China alone grows about a quarter of them.", span=5)
    o("avocado-mex", "avocado-production", "Mexico", "How many tonnes of avocados did Mexico grow?", "tonnes", 1, "The name of the fruit comes from a word in Nahuatl.", span=4.5)
    o("tomato-ita", "tomato-production", "Italy", "How many tonnes of tomatoes did Italy grow?", "tonnes", 1, "Tomatoes only reached Italy after Spanish ships crossed the Atlantic.", span=4.5)
    o("rice-chn", "rice-production", "China", "How many tonnes of rice did China grow?", "tonnes", 1, "India and China grow about half of the world's rice between them.", span=5)
    o("apple-usa", "apple-production", "United States", "How many tonnes of apples did the United States grow?", "tonnes", 1, "Washington State grows most of them.", span=4.5)


def run():
    for f in (fdc, ecfr, other, owid):
        attempt(f"food.{f.__name__}", f)
