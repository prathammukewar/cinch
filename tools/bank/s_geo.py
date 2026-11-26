import csv, io
from lib import *


def wb(ind, iso):
    u = f"https://api.worldbank.org/v2/country/{iso}/indicator/{ind}?format=json&mrnev=1"
    j = fetch_json(u)
    r = j[1][0]
    return r["value"], r["date"], r["country"]["value"], u


def worldbank():
    L = [
        # key, indicator, iso, question, unit, factor, scale kwargs, explainer, difficulty
        ("pop-iceland", "SP.POP.TOTL", "ISL", "How many people live in Iceland?", "people", dict(span=4.4), "Most of them live in or near the capital, Reykjavik.", 2),
        ("pop-nz", "SP.POP.TOTL", "NZL", "How many people live in New Zealand?", "people", dict(span=4.4), "Sheep outnumber them several times over.", 2),
        ("pop-mongolia", "SP.POP.TOTL", "MNG", "How many people live in Mongolia?", "people", dict(span=4.4), "It is the most thinly populated independent country of any real size.", 2),
        ("pop-canada", "SP.POP.TOTL", "CAN", "How many people live in Canada?", "people", dict(span=4), "Most live within a short drive of the US border.", 1),
        ("pop-australia", "SP.POP.TOTL", "AUS", "How many people live in Australia?", "people", dict(span=4), "Nearly all of them live near the coast.", 1),
        ("pop-indonesia", "SP.POP.TOTL", "IDN", "How many people live in Indonesia?", "people", dict(span=4), "It is spread over thousands of islands.", 2),
        ("pop-nigeria", "SP.POP.TOTL", "NGA", "How many people live in Nigeria?", "people", dict(span=4), "It has more people than any other country in Africa.", 2),
        ("pop-malta", "SP.POP.TOTL", "MLT", "How many people live in Malta?", "people", dict(span=4.4), "It is one of the most crowded countries in Europe.", 3),
        ("pop-bhutan", "SP.POP.TOTL", "BTN", "How many people live in Bhutan?", "people", dict(span=4.4), "The country is better known for measuring happiness.", 3),
        ("pop-chile", "SP.POP.TOTL", "CHL", "How many people live in Chile?", "people", dict(span=4.4), "It is longer than the United States is wide.", 2),
        ("pop-fiji", "SP.POP.TOTL", "FJI", "How many people live in Fiji?", "people", dict(span=4.4), "About a hundred of its many islands have people on them.", 3),
        ("pop-portugal", "SP.POP.TOTL", "PRT", "How many people live in Portugal?", "people", dict(span=4.4), "Brazil, its former colony, has many times more Portuguese speakers.", 2),
        ("pop-world", "SP.POP.TOTL", "WLD", "How many people are there in the world?", "people", dict(span=4), "India and China together hold more than a third.", 1),
        ("area-japan", "AG.SRF.TOTL.K2", "JPN", "How many square kilometers does Japan cover?", "km²", dict(span=4), "It is a bit smaller than California.", 2),
        ("area-madagascar", "AG.SRF.TOTL.K2", "MDG", "How many square kilometers does Madagascar cover?", "km²", dict(span=4), "It is larger than France.", 3),
        ("area-singapore", "AG.SRF.TOTL.K2", "SGP", "How many square kilometers does Singapore cover?", "km²", dict(span=4.4), "It has grown by about a quarter by filling in sea.", 2),
        ("area-uk", "AG.SRF.TOTL.K2", "GBR", "How many square kilometers does the United Kingdom cover?", "km²", dict(span=4), "It is smaller than the state of Oregon.", 2),
        ("area-brazil", "AG.SRF.TOTL.K2", "BRA", "How many square kilometers does Brazil cover?", "km²", dict(span=4), "It borders nearly every other country in South America.", 2),
        ("area-mongolia", "AG.SRF.TOTL.K2", "MNG", "How many square kilometers does Mongolia cover?", "km²", dict(span=4), "It is more than twice the size of Texas.", 3),
        ("area-egypt", "AG.SRF.TOTL.K2", "EGY", "How many square kilometers does Egypt cover?", "km²", dict(span=4), "Almost everyone lives on a small strip of it along the Nile.", 2),
        ("forest-bhutan", "AG.LND.FRST.ZS", "BTN", "What percent of Bhutan is forest?", "%", dict(scale="linear", span=100, lo=0, hi=100), "Its constitution says most of the country must stay that way.", 2),
        ("forest-japan", "AG.LND.FRST.ZS", "JPN", "What percent of Japan is forest?", "%", dict(scale="linear", span=100, lo=0, hi=100), "Steep mountains leave most people packed into the flat parts.", 2),
        ("forest-finland", "AG.LND.FRST.ZS", "FIN", "What percent of Finland is forest?", "%", dict(scale="linear", span=100, lo=0, hi=100), "Lakes take up a good share of the rest.", 2),
        ("forest-usa", "AG.LND.FRST.ZS", "USA", "What percent of the United States is forest?", "%", dict(scale="linear", span=100, lo=0, hi=100), "Maine is the most wooded state.", 1),
        ("forest-uk", "AG.LND.FRST.ZS", "GBR", "What percent of the United Kingdom is forest?", "%", dict(scale="linear", span=100, lo=0, hi=100), "It was once nearly all woodland.", 2),
        ("forest-gabon", "AG.LND.FRST.ZS", "GAB", "What percent of Gabon is forest?", "%", dict(scale="linear", span=100, lo=0, hi=100), "Forest elephants outnumber people in parts of it.", 3),
        ("forest-iceland", "AG.LND.FRST.ZS", "ISL", "What percent of Iceland is forest?", "%", dict(scale="linear", span=100, lo=0, hi=100), "Settlers cut most of its birch a thousand years ago.", 2),
        ("farm-uk", "AG.LND.AGRI.ZS", "GBR", "What percent of the United Kingdom's land is used for farming?", "%", dict(scale="linear", span=100, lo=0, hi=100), "Grazing counts, and it is most of it.", 2),
        ("phones-japan", "IT.CEL.SETS.P2", "JPN", "How many mobile phone subscriptions are there for every 100 people in Japan?", "subscriptions", dict(scale="linear", span=400, lo=0), "Work phones and connected gadgets push it past one each.", 2),
        ("urban-world", "SP.URB.TOTL.IN.ZS", "WLD", "What percent of the world's people live in towns and cities?", "%", dict(scale="linear", span=100, lo=0, hi=100), "The United Nations expects it to keep rising.", 1),
        ("urban-japan", "SP.URB.TOTL.IN.ZS", "JPN", "What percent of people in Japan live in towns and cities?", "%", dict(scale="linear", span=100, lo=0, hi=100), "Greater Tokyo alone holds more people than Canada does." if False else "Greater Tokyo is the largest urban area on Earth by most counts.", 2),
        ("elec-chad", "EG.ELC.ACCS.ZS", "TCD", "What percent of people in Chad have electricity at home?", "%", dict(scale="linear", span=100, lo=0, hi=100), "It is among the lowest shares in the world.", 2),
        ("net-world", "IT.NET.USER.ZS", "WLD", "What percent of the world's people use the internet?", "%", dict(scale="linear", span=100, lo=0, hi=100), "Most of the people still offline live in poorer rural areas.", 1),
        ("renew-norway", "EG.ELC.RNEW.ZS", "NOR", "What percent of Norway's electricity comes from renewable sources?", "%", dict(scale="linear", span=100, lo=0, hi=100), "Nearly all of it is falling water.", 2),
        ("renew-usa", "EG.ELC.RNEW.ZS", "USA", "What percent of US electricity comes from renewable sources?", "%", dict(scale="linear", span=100, lo=0, hi=100), "Wind has overtaken dams.", 2),
        ("life-japan", "SP.DYN.LE00.IN", "JPN", "How many years can a newborn in Japan expect to live?", "years", dict(scale="linear", span=60, lo=20), "Only a few small places do better.", 1),
        ("rail-india", "IS.RRS.TOTL.KM", "IND", "How many kilometers of railway lines does India have?", "km", dict(span=4), "The network runs thousands of passenger trains a day.", 2),
        ("air-usa", "IS.AIR.PSGR", "USA", "How many passengers do US airlines carry in a year?", "passengers", dict(span=4), "That is a few flights for every person in the country.", 2),
        ("pop-switz", "SP.POP.TOTL", "CHE", "How many people live in Switzerland?", "people", dict(span=4), "They speak four national languages between them.", 2),
        ("pop-kenya", "SP.POP.TOTL", "KEN", "How many people live in Kenya?", "people", dict(span=4), "Many of the world's best distance runners come from one small region.", 2),
        ("pop-ireland", "SP.POP.TOTL", "IRL", "How many people live in the Republic of Ireland?", "people", dict(span=4.2), "More people claim Irish roots abroad than live on the island.", 2),
        ("pop-mexico", "SP.POP.TOTL", "MEX", "How many people live in Mexico?", "people", dict(span=4), "About one in six lives around Mexico City.", 1),
        ("pop-egypt", "SP.POP.TOTL", "EGY", "How many people live in Egypt?", "people", dict(span=4), "Nearly all of them live within a few miles of the Nile.", 2),
        ("pop-japan", "SP.POP.TOTL", "JPN", "How many people live in Japan?", "people", dict(span=4), "The number has been falling for years.", 1),
        ("pop-singapore", "SP.POP.TOTL", "SGP", "How many people live in Singapore?", "people", dict(span=4.2), "Most of them live in public housing.", 2),
        ("pop-jamaica", "SP.POP.TOTL", "JAM", "How many people live in Jamaica?", "people", dict(span=4.2), "It once sent a bobsled team to the Winter Olympics.", 3),
        ("pop-samoa", "SP.POP.TOTL", "WSM", "How many people live in Samoa?", "people", dict(span=4.6), "It once skipped a whole day to move across the date line.", 3),
        ("pop-madag", "SP.POP.TOTL", "MDG", "How many people live in Madagascar?", "people", dict(span=4.2), "Its first settlers came across the ocean from Southeast Asia.", 3),
        ("pop-norway", "SP.POP.TOTL", "NOR", "How many people live in Norway?", "people", dict(span=4.2), "Its coast is long enough to circle Earth twice, fjords included.", 2),
        ("pop-vietnam", "SP.POP.TOTL", "VNM", "How many people live in Vietnam?", "people", dict(span=4), "About a third of them share one family name.", 2),
        ("area-nz", "AG.SRF.TOTL.K2", "NZL", "How many square kilometers does New Zealand cover?", "km²", dict(span=4), "It sits on a mostly sunken continent.", 2),
        ("area-iceland", "AG.SRF.TOTL.K2", "ISL", "How many square kilometers does Iceland cover?", "km²", dict(span=4), "It grows a little each year as two plates pull apart.", 2),
        ("area-cuba", "AG.SRF.TOTL.K2", "CUB", "How many square kilometers does Cuba cover?", "km²", dict(span=4), "It is the largest island in the Caribbean.", 3),
        ("area-chile", "AG.SRF.TOTL.K2", "CHL", "How many square kilometers does Chile cover?", "km²", dict(span=4), "It is rarely more than a couple of hundred kilometers wide.", 3),
        ("area-switz", "AG.SRF.TOTL.K2", "CHE", "How many square kilometers does Switzerland cover?", "km²", dict(span=4), "Ironed flat, it would be much bigger.", 2),
        ("area-jamaica", "AG.SRF.TOTL.K2", "JAM", "How many square kilometers does Jamaica cover?", "km²", dict(span=4), "It is a bit smaller than Connecticut.", 3),
        ("area-bhutan", "AG.SRF.TOTL.K2", "BTN", "How many square kilometers does Bhutan cover?", "km²", dict(span=4), "Its highest peak is left unclimbed by law.", 3),
        ("area-australia", "AG.SRF.TOTL.K2", "AUS", "How many square kilometers does Australia cover?", "km²", dict(span=4), "It is about as wide as the Moon.", 1),
        ("forest-brazil", "AG.LND.FRST.ZS", "BRA", "What percent of Brazil is forest?", "%", dict(scale="linear", span=100, lo=0, hi=100), "Most of it is in the Amazon.", 1),
        ("forest-canada", "AG.LND.FRST.ZS", "CAN", "What percent of Canada is forest?", "%", dict(scale="linear", span=100, lo=0, hi=100), "Much of the far north is too cold for trees.", 2),
        ("forest-ireland", "AG.LND.FRST.ZS", "IRL", "What percent of Ireland is forest?", "%", dict(scale="linear", span=100, lo=0, hi=100), "It was nearly all trees before farming.", 2),
        ("forest-costarica", "AG.LND.FRST.ZS", "CRI", "What percent of Costa Rica is forest?", "%", dict(scale="linear", span=100, lo=0, hi=100), "It pays landowners to keep trees standing.", 2),
        ("urban-nepal", "SP.URB.TOTL.IN.ZS", "NPL", "What percent of people in Nepal live in towns and cities?", "%", dict(scale="linear", span=100, lo=0, hi=100), "Villages are scattered up the valleys.", 3),
        ("net-iceland", "IT.NET.USER.ZS", "ISL", "What percent of people in Iceland use the internet?", "%", dict(scale="linear", span=100, lo=0, hi=100), "Cheap power and cool air also make it good for data centers.", 2),
        ("renew-brazil", "EG.ELC.RNEW.ZS", "BRA", "What percent of Brazil's electricity comes from renewable sources?", "%", dict(scale="linear", span=100, lo=0, hi=100), "Big dams supply most of it, so dry years hurt.", 2),
        ("renew-japan", "EG.ELC.RNEW.ZS", "JPN", "What percent of Japan's electricity comes from renewable sources?", "%", dict(scale="linear", span=100, lo=0, hi=100), "Solar has grown quickly on roofs and old golf courses.", 3),
        ("life-us", "SP.DYN.LE00.IN", "USA", "How many years can a newborn in the United States expect to live?", "years", dict(scale="linear", span=60, lo=20), "Japan's figure is several years higher.", 1),
        ("rail-germany", "IS.RRS.TOTL.KM", "DEU", "How many kilometers of railway lines does Germany have?", "km", dict(span=4), "It has one of the densest networks in Europe.", 3),
    ]
    for key, ind, iso, q, unit, kw, ex, d in L:
        def go():
            v, year, name, u = wb(ind, iso)
            if int(year) < 2018: raise LookupError(f"{key} only has {year}")
            v = float(f"{v:.6g}") if abs(v) > 1000 else round(v, 1)
            cat = {"mo": "Technology"}.get(key[:2], "Geography")
            if key.startswith(("phones", "net", "elec", "renew")): cat = "Technology"
            add("ge-" + key, q, v, unit, cat, difficulty=d, url=f"https://data.worldbank.org/indicator/{ind}?locations={iso}", source="World Bank Open Data", licence=CCBY, evidence=f"World Bank API {iso} {ind}, {year} ({name}): {v}", explainer=ex, as_of=f"In {year}", check=f"wb|{ind}|{iso}", topic="wb-" + ind[:6], **kw)
        attempt("ge-" + key, go)


def census():
    u = "https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/state/totals/NST-EST2024-ALLDATA.csv"
    rows = {r["NAME"]: r for r in csv.DictReader(io.StringIO(fetch(u)))}
    for nm, ex, d in [("Wyoming", "It has fewer people than any other state.", 1), ("Alaska", "Spread evenly, each person would have more than a square mile.", 2), ("California", "It has more people than Canada.", 1), ("Massachusetts", "Most of them live within an hour of Boston.", 2), ("Hawaii", "About two in three live on Oahu.", 2), ("Montana", "It is the fourth largest state by area.", 2), ("Florida", "It passed New York around 2014 to become the third largest." if False else "It is the third most populous state.", 2), ("Vermont", "Its largest city has fewer people than any other state's largest city.", 2), ("Texas", "It has more people than any state but California.", 1), ("New York", "Well under half of them live outside the city and its suburbs." if False else "Its biggest city holds more than two fifths of them.", 1), ("Rhode Island", "It is the smallest state by area.", 2), ("North Dakota", "It has more cows than people.", 3), ("Utah", "It has the youngest population of any state.", 2), ("Colorado", "Most live in a strip along the foot of the mountains.", 2), ("Maine", "It has the oldest population of any state.", 3), ("Delaware", "More companies are registered there than people live there.", 3), ("Ohio", "Eight presidents had their home there." if False else "It is the seventh largest state by people.", 2), ("Nevada", "About three in four live around Las Vegas.", 2), ("Puerto Rico", "More people of Puerto Rican descent live in the fifty states than on the island.", 2)]:
        def go():
            v = int(rows[nm]["POPESTIMATE2024"])
            add(f"ge-st-{nm.lower().replace(' ', '')}", f"How many people live in {nm}?", v, "people", "Geography", span=4, difficulty=d, url="https://www.census.gov/data/tables/time-series/demo/popest/2020s-state-total.html", source="US Census Bureau", licence=PD, evidence=f"NST-EST2024-ALLDATA.csv: {nm} POPESTIMATE2024 = {v}", explainer=ex, as_of="July 2024 estimate", check=f"census|{nm}", topic="ge-state")
        attempt(f"ge-st-{nm}", go)


def nature():
    P = lambda id, url, pat, q, unit, src, ex, **k: page("ge-" + id, url, pat, q, unit, "Geography", src, ex, **k)
    P("ocean-mean", "https://oceanservice.noaa.gov/facts/oceandepth.html", r"average depth of the ocean is (?:about )?([\d,]+) meters", "How many meters deep is the ocean on average?", "meters", "NOAA", "If you drained it, you would see mountain chains longer than any on land.", span=3.4, difficulty=2)
    P("ocean-deep", "https://oceanservice.noaa.gov/facts/oceandepth.html", r"approximately ([\d,]+) meters", "How many meters deep is the Challenger Deep, the lowest known point of the ocean?", "meters", "NOAA", "Mount Everest would fit inside with room to spare.", span=3.4, difficulty=1)
    P("water-vol", "https://www.usgs.gov/special-topics/water-science-school/science/how-much-water-there-earth", r"water ball would be about ([\d,]+) miles", "If all the water on Earth were rolled into one ball, how many miles wide would it be?", "miles", "US Geological Survey", "Nearly all of it would be too salty to drink.", span=4, difficulty=2)
    P("yell-acres", "https://www.nps.gov/yell/planyourvisit/parkfacts.htm", r"([\d,]+) acres", "How many acres does Yellowstone National Park cover?", "acres", "National Park Service", "It is larger than Rhode Island and Delaware put together.", span=4, difficulty=2)
    P("yell-falls", "https://www.nps.gov/yell/planyourvisit/parkfacts.htm", r"About (\d+) waterfalls", "About how many waterfalls does Yellowstone have?", "waterfalls", "National Park Service", "More than half of the world's geysers are there too.", span=3.4, difficulty=2)
    P("gc-miles", "https://www.nps.gov/grca/learn/management/statistics.htm", r"Length: (\d+) river miles", "How many miles of the Colorado River run through the Grand Canyon?", "miles", "National Park Service", "Rafting all of it takes a week or two.", span=3, difficulty=2)
    P("sherman", "https://www.nps.gov/seki/learn/nature/sherman.htm", r"Height above Base (\d+\.\d)", "How many feet tall is General Sherman, the giant sequoia?", "feet", "National Park Service", "By volume of trunk it is the largest tree alive. Coast redwoods are taller.", span=2.6, difficulty=2)


    P("sherman-around", "https://www.nps.gov/seki/learn/nature/sherman.htm", r"Circumference at Ground (\d+\.\d)", "How many feet around is the base of General Sherman, the giant sequoia?", "feet", "National Park Service", "It would take a ring of about seventeen adults holding hands.", span=3, difficulty=2)
    P("gc-width", "https://www.nps.gov/grca/learn/management/statistics.htm", r"Maximum Rim to Rim, (\d+) miles", "How many miles across is the Grand Canyon at its widest?", "miles", "National Park Service", "Driving from one rim to the other takes about five hours.", span=3, difficulty=2)
    P("gc-river", "https://www.nps.gov/grca/learn/management/statistics.htm", r"Average Width: (\d+) feet", "How many feet wide is the Colorado River in the Grand Canyon, on average?", "feet", "National Park Service", "Rivers look small when the walls are a mile high.", span=3.4, difficulty=3)
    P("yell-fall-h", "https://www.nps.gov/yell/planyourvisit/parkfacts.htm", r"Lower Falls of the Yellowstone River at (\d+) feet", "How many feet tall is the Lower Falls of the Yellowstone River?", "feet", "National Park Service", "It is nearly twice as tall as Niagara.", span=3, difficulty=2)
    P("yell-springs", "https://www.nps.gov/yell/planyourvisit/parkfacts.htm", r"More than ([\d,]+) hydrothermal features", "Yellowstone has more than how many geysers, hot springs, mud pots and steam vents, says the park?", "features", "National Park Service", "They sit on one of the world's largest calderas.", span=4, difficulty=3)


def parks():
    for code, nm, y, ex, d in [("YELL", "Yellowstone", 2024, "July is the busiest month.", 2), ("GRSM", "Great Smoky Mountains", 2024, "It has no entrance fee and gets more visits than any other national park.", 2), ("ZION", "Zion", 2024, "The main canyon is closed to private cars for most of the year.", 2), ("ACAD", "Acadia", 2024, "From its top you can be among the first in the country to see the sunrise.", 2), ("DEVA", "Death Valley", 2024, "Many come in summer on purpose, to stand in the heat.", 3), ("YOSE", "Yosemite", 2024, "Most people never leave the one valley.", 2), ("ROMO", "Rocky Mountain", 2024, "Its main road climbs above the trees.", 2), ("ARCH", "Arches", 2024, "It has more than two thousand natural stone arches.", 3), ("OLYM", "Olympic", 2024, "It holds beaches, glaciers and rainforest.", 3), ("EVER", "Everglades", 2024, "It is the only place where alligators and crocodiles live together in the wild.", 3), ("BRCA", "Bryce Canyon", 2024, "Its stone spires are called hoodoos.", 3), ("GLAC", "Glacier", 2024, "Its main road is buried in snow until summer.", 2)]:
        def go():
            u = f"https://irmaservices.nps.gov/v3/rest/stats/visitation?unitCodes={code}&startMonth=1&startYear={y}&endMonth=12&endYear={y}"
            raw = fetch(u, headers={"Accept": "application/json"})
            try:
                j = json.loads(raw); tot = sum(int(r["RecreationVisitors"]) for r in j); n = len(j)
            except json.JSONDecodeError:
                vals = [int(x) for x in re.findall(r"<RecreationVisitors>(\d+)<", raw)]; tot, n = sum(vals), len(vals)
            if n != 12: raise LookupError(f"{n} months")
            add(f"ge-park-{code.lower()}", f"How many visits did {nm} National Park get in {y}?", tot, "visits", "Geography", span=4, difficulty=d, url="https://irma.nps.gov/Stats/", source="National Park Service", licence=PD, evidence=f"irmaservices.nps.gov visitation {code} {y}: 12 months of RecreationVisitors sum to {tot}", explainer=ex, check=f"nps|{code}|{y}", topic="ge-park")
        attempt(f"ge-park-{code}", go)


def weather():
    for st, nm, dt, q, unit, ex, d, span in [
        ("USW00014771", "Syracuse", "ANN-SNOW-NORMAL", "How many inches of snow does Syracuse, New York get in a normal year?", "inches", "Cold air picks up water over Lake Ontario and drops it just past the shore.", 2, 3),
        ("USW00014739", "Boston", "ANN-SNOW-NORMAL", "How many inches of snow does Boston get in a normal year?", "inches", "A single bad month has delivered more than that.", 2, 3),
        ("USW00024233", "Seattle", "ANN-PRCP-NORMAL", "How many inches of rain does Seattle get in a normal year?", "inches", "Boston gets more. Seattle's just comes as drizzle on more days.", 2, 2.8),
        ("USW00012839", "Miami", "ANN-PRCP-NORMAL", "How many inches of rain does Miami get in a normal year?", "inches", "Most of it falls from May to October.", 2, 2.8),
        ("USW00023183", "Phoenix", "ANN-PRCP-NORMAL", "How many inches of rain does Phoenix get in a normal year?", "inches", "Much of it comes in short summer storms.", 2, 2.8),
        ("USW00023169", "Las Vegas", "ANN-PRCP-NORMAL", "How many inches of rain does Las Vegas get in a normal year?", "inches", "Its water comes mostly from the Colorado River.", 2, 2.8),
        ("USW00014922", "Minneapolis", "ANN-SNOW-NORMAL", "How many inches of snow does Minneapolis get in a normal year?", "inches", "Its downtown has miles of enclosed bridges so people can stay inside.", 2, 3),
        ("USW00003017", "Denver", "ANN-SNOW-NORMAL", "How many inches of snow does Denver get in a normal year?", "inches", "March is often the snowiest month.", 2, 3),
    ]:
        def go():
            u = f"https://www.ncei.noaa.gov/access/services/data/v1?dataset=normals-annualseasonal-1991-2020&stations={st}&format=json&units=standard&includeStationName=true&includeStationLocation=1&dataTypes={dt}"
            r = fetch_json(u)[0]
            name = r.get("NAME", "")
            if nm.split()[0].lower() not in name.lower(): raise LookupError(f"{st} is {name!r}")
            v = float(r[dt])
            add(f"ge-wx-{nm.lower().replace(' ', '')}-{dt[4:8].lower()}", q, v, unit, "Geography", span=span, difficulty=d, url=f"https://www.ncei.noaa.gov/access/us-climate-normals/", source="NOAA climate normals", licence=PD, evidence=f"{st} {name}: {dt} = {v} (1991-2020)", explainer=ex, as_of="Average for 1991 to 2020", check=f"noaa|{st}|{dt}", topic="ge-wx")
        attempt(f"ge-wx-{nm}", go)


def volcano():
    j = fetch_json("https://volcanoes.usgs.gov/hans-public/api/volcano/getUSVolcanoes")
    for nm, ex, d in [("Rainier", "It can be seen from Seattle on a clear day.", 2), ("Mauna Loa", "Measured from its base on the sea floor it is taller than Everest.", 2), ("Kilauea", "It is one of the most active volcanoes in the world.", 3), ("Hood", "It is the highest point in Oregon.", 3), ("Shasta", "Snow stays on it all year.", 3)]:
        def go():
            r = [x for x in j if x["volcano_name"].replace("Mount ", "").replace(", Mount", "") == nm or x["volcano_name"] == f"Mount {nm}"]
            if len(r) != 1: raise LookupError([x["volcano_name"] for x in j if nm in x["volcano_name"]])
            v = float(r[0]["elevation_meters"])
            lab = f"Mount {nm}" if nm in ("Rainier", "Hood", "Shasta") else nm
            add(f"ge-vol-{nm.lower().replace(' ', '')}", f"How many meters high is the volcano {lab}?", v, "meters", "Geography", span=3, difficulty=d, url="https://www.usgs.gov/programs/VHP", source="USGS Volcano Hazards Program", licence=PD, evidence=f"getUSVolcanoes: {r[0]['volcano_name']} elevation_meters = {r[0]['elevation_meters']}", explainer=ex, check=f"volc|{nm}", topic="ge-elev")
        attempt(f"ge-vol-{nm}", go)


def run():
    for f in (worldbank, census, nature, parks, weather, volcano):
        attempt(f"geo.{f.__name__}", f)
