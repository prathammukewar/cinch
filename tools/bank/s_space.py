from lib import *

NSSDC = "https://nssdc.gsfc.nasa.gov/planetary/factsheet/"
NAMES = ["Mercury", "Venus", "Earth", "Moon", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]


def planets():
    raw = fetch(NSSDC)
    rows = {}
    for tr in re.findall(r"(?is)<tr>(.*?)</tr>", raw):
        cells = [plain(c) for c in re.findall(r"(?is)<t[dh][^>]*>(.*?)</t[dh]>", tr)]
        if len(cells) == 11 and cells[0]:
            rows[re.sub(r"\(.*", "", cells[0]).strip()] = cells[1:]
    def get(row, body):
        c = rows[row][NAMES.index(body)]
        return number(c.replace("*", "")), f"{row}: {', '.join(f'{n} {v}' for n, v in zip(NAMES, rows[row]))}"
    def q(id, row, body, question, unit, f=1, expl="", **k):
        v, ev = get(row, body)
        ans = clean(abs(v) * f if row == "Length of Day" else v * f)
        add(id, question, ans, unit, "Space", url=NSSDC, source="NASA Planetary Fact Sheet", licence=PD, evidence=ev, explainer=expl(ans) if callable(expl) else expl, check=f"nssdc|{row}|{body}", topic=f"sp-{row[:6]}", label=body if body not in ("Moon",) else "The Moon", **k)
    g = lambda row, body: get(row, body)[0]
    q("sp-jup-diam", "Diameter", "Jupiter", "How many kilometers across is Jupiter at its equator?", "km", expl=lambda a: f"That is about {times(a, g('Diameter','Earth'))} Earths side by side.", span=4, difficulty=2)
    q("sp-mars-diam", "Diameter", "Mars", "How many kilometers across is Mars?", "km", expl=lambda a: f"Mars is roughly half as wide as Earth, which measures {fmt(g('Diameter','Earth'))} km.", span=3, difficulty=2)
    q("sp-moon-diam", "Diameter", "Moon", "How many kilometers across is the Moon?", "km", expl=lambda a: f"It is wider than Pluto, which is only {fmt(g('Diameter','Pluto'))} km across.", span=3, difficulty=1)
    q("sp-pluto-diam", "Diameter", "Pluto", "How many kilometers across is Pluto?", "km", expl=lambda a: f"Our Moon is bigger, at {fmt(g('Diameter','Moon'))} km.", span=3, difficulty=2)
    q("sp-merc-diam", "Diameter", "Mercury", "How many kilometers across is Mercury, the smallest planet?", "km", expl=lambda a: f"It is only {times(a, g('Diameter','Moon'))} times as wide as the Moon.", span=3, difficulty=2)
    q("sp-ven-day", "Length of Day", "Venus", "How many Earth hours pass from one noon to the next on Venus?", "hours", expl=lambda a: f"That is about {fmt(a/24,0)} Earth days. Venus also spins backward compared with most planets.", span=5, difficulty=3)
    q("sp-merc-day", "Length of Day", "Mercury", "How many Earth hours pass from one sunrise to the next on Mercury?", "hours", expl=lambda a: f"One day there lasts about {fmt(a/24,0)} Earth days, twice as long as its {fmt(g('Orbital Period','Mercury'),0)} day year.", span=5, difficulty=3)
    q("sp-jup-day", "Length of Day", "Jupiter", "How long is a day on Jupiter, in hours?", "hours", expl="It is the shortest day of any planet, even though Jupiter is the largest.", span=3, difficulty=2)
    q("sp-mars-year", "Orbital Period", "Mars", "How many Earth days does Mars take to go around the Sun?", "days", expl=lambda a: f"That makes a Martian year about {times(a, 365.2)} Earth years.", span=3, difficulty=1)
    q("sp-nep-year", "Orbital Period", "Neptune", "How many Earth days does Neptune need for one trip around the Sun?", "days", expl=lambda a: f"About {fmt(a/365.25,0)} Earth years.", span=4, difficulty=3)
    q("sp-ven-year", "Orbital Period", "Venus", "How many Earth days long is a year on Venus?", "days", expl="Venus spins so slowly that its full rotation takes longer than its year.", span=3, difficulty=2)
    q("sp-jup-year", "Orbital Period", "Jupiter", "How many Earth days does Jupiter take to circle the Sun?", "days", expl=lambda a: f"Close to {fmt(a/365.25,1)} Earth years.", span=4, difficulty=2)
    q("sp-ven-temp", "Mean Temperature", "Venus", "What is the average temperature on Venus, in degrees Celsius?", "°C", expl=lambda a: f"Mercury is nearer the Sun but averages only {fmt(g('Mean Temperature','Mercury'))}°C, because it has no thick air to hold heat in.", scale="linear", span=900, difficulty=2)
    q("sp-mars-temp", "Mean Temperature", "Mars", "What is the average temperature on Mars, in degrees Celsius?", "°C", expl="Its air is too thin to hold much of the warmth the Sun delivers.", scale="linear", span=300, difficulty=2)
    q("sp-nep-temp", "Mean Temperature", "Neptune", "What is the average temperature of Neptune, in degrees Celsius?", "°C", expl=lambda a: f"Absolute zero is −273°C, so Neptune sits only about {fmt(a+273,0)} degrees above the coldest anything can be.", scale="linear", span=400, difficulty=2, lo=-273)
    q("sp-sat-moons", "Number of Moons", "Saturn", "How many moons does Saturn have?", "moons", expl=lambda a: f"Jupiter comes second in the same table with {fmt(g('Number of Moons','Jupiter'))}. New small ones keep turning up.", as_of="As listed by NASA, November 2026", span=3, difficulty=3, whole=True)
    q("sp-jup-esc", "Escape Velocity", "Jupiter", "How fast must a rocket go to escape Jupiter's gravity, in km per second?", "km/s", expl=lambda a: f"Leaving Earth takes {fmt(g('Escape Velocity','Earth'))} km per second.", span=3, difficulty=3)
    q("sp-moon-esc", "Escape Velocity", "Moon", "How fast must something go to escape the Moon for good, in km per second?", "km/s", expl=lambda a: f"Earth needs {fmt(g('Escape Velocity','Earth'))} km per second, which is why the trip home takes a much smaller rocket.", span=3, difficulty=3)
    q("sp-sun-earth", "Distance from Sun", "Earth", "How many kilometers is Earth from the Sun on average?", "km", f=1e6, expl=lambda a: f"Light covers it in about {fmt(a/299792.458/60,1)} minutes.", span=4, difficulty=1)
    q("sp-nep-sun", "Distance from Sun", "Neptune", "How many kilometers is Neptune from the Sun on average?", "km", f=1e6, expl=lambda a: f"About {times(a, g('Distance from Sun','Earth')*1e6)} times as far as Earth.", span=4, difficulty=2)
    q("sp-sat-dens", "Density", "Saturn", "What is Saturn's average density, in kilograms per cubic meter?", "kg/m³", expl="Water is about 1,000, so Saturn on average is lighter than water.", span=4, difficulty=3)


def moons():
    url = "https://ssd.jpl.nasa.gov/sats/phys_par/"
    raw = fetch(url)
    rows = {}
    for tr in re.findall(r"(?is)<tr[^>]*>(.*?)</tr>", raw):
        cells = [plain(c) for c in re.findall(r"(?is)<t[dh][^>]*>(.*?)</t[dh]>", tr)]
        if len(cells) > 5:
            rows[next((c for c in cells[:3] if c in MOONS), cells[0])] = cells
    for name, (q, ex, d) in MOONS.items():
        c = rows[name]
        # columns: planet, satellite, code, GM, mean radius (value sigma ref), density
        r = number(c[4].split()[0])
        add(f"sp-{name.lower()}-diam", q, round(2 * r, 1), "km", "Space", span=3.4, difficulty=d, url=url, source="NASA JPL satellite parameters", licence=PD, evidence=f"{name}: {' | '.join(c)} (mean radius {r} km, doubled)", explainer=ex, topic="sp-Diamet", label=name)


MOONS = {
    "Titan": ("How many kilometers across is Titan, Saturn's largest moon?", "It is wider than the planet Mercury and has a thick atmosphere of its own.", 2),
    "Ganymede": ("How many kilometers across is Ganymede, the largest moon in the solar system?", "It is wider than the planet Mercury.", 2),
    "Europa": ("How many kilometers across is Europa, the icy moon of Jupiter?", "It is a little smaller than our own Moon.", 3),
    "Enceladus": ("How many kilometers across is Enceladus, the moon of Saturn that sprays water into space?", "Cracks near its south pole feed the spray.", 3),
    "Phobos": ("How many kilometers across, on average, is Phobos, the larger moon of Mars?", "It is lumpy, closer in size to a city than to our Moon.", 3),
    "Triton": ("How many kilometers across is Triton, Neptune's largest moon?", "It circles Neptune backward compared with the planet's spin.", 3),
    "Mimas": ("How many kilometers across is Mimas, the Saturn moon with one giant crater?", "The crater makes it look like a certain movie space station.", 3),
}


def sbdb(des, field):
    j = fetch_json(f"https://ssd-api.jpl.nasa.gov/sbdb.api?sstr={des}&phys-par=1")
    for p in j.get("phys_par", []):
        if p["name"] == field:
            return p["value"], j["object"]["fullname"]
    raise LookupError(field)


def _walk(o):
    if isinstance(o, dict):
        for k, v in o.items():
            yield k, v
            yield from _walk(v)


def small_bodies():
    for des, nm, q, ex, d in [
        ("Ceres", "ceres", "How many kilometers across is Ceres, the largest object in the asteroid belt?", "It is round like a planet and counts as a dwarf planet.", 3),
        ("Vesta", "vesta", "How many kilometers across is the asteroid Vesta?", "On a dark night it is the one asteroid you can sometimes see without a telescope.", 3),
        ("Bennu", "bennu", "How many meters across is the asteroid Bennu, which a NASA spacecraft scooped a sample from?", "It is a loose pile of rubble held together by its own weak gravity.", 3),
        ("Psyche", "psyche", "How many kilometers across is the metal-rich asteroid Psyche?", "A NASA spacecraft named after it is on the way to take a look.", 3),
        ("Eros", "eros", "How many kilometers across is Eros, the first asteroid a spacecraft landed on?", "The lander, NEAR Shoemaker, was not designed to land.", 3),
    ]:
        v, full = sbdb(des, "diameter")
        add(f"sp-{nm}-diam", q, float(v) * (1000 if nm == "bennu" else 1), "meters" if nm == "bennu" else "km", "Space", span=4, difficulty=d, url=f"https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr={des}", source="NASA JPL Small-Body Database", licence=PD, evidence=f"ssd-api.jpl.nasa.gov/sbdb.api?sstr={des}: {full}, diameter {v} km", explainer=ex, check=f"sbdb|{des}|diameter", topic="sp-Diamet" if nm != "bennu" else "sp-small", label=des)
    j = fetch_json("https://ssd-api.jpl.nasa.gov/sbdb.api?des=1P&full-prec=0")
    per = next(e for e in j["orbit"]["elements"] if e["name"] == "per")
    yrs = round(float(per["value"]) / 365.25, 1)
    add("sp-halley-years", "How many years pass between visits of Halley's Comet, on its current orbit?", yrs, "years", "Space", span=3, difficulty=1, url="https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=1P", source="NASA JPL Small-Body Database", licence=PD, evidence=f"sbdb.api?des=1P: period {per['value']} {per['units']}", explainer=f"At its farthest it swings out to {fmt(float(next(e for e in j['orbit']['elements'] if e['name'] == 'ad')['value']), 0)} times Earth's distance from the Sun, past Neptune.", check="sbdb-halley")
    j = fetch_json("https://ssd-api.jpl.nasa.gov/sbdb_query.api?info=count")
    n = int(next(v for k, v in _walk(j) if k == "an"))
    add("sp-numbered-asteroids", "How many asteroids have well-tracked orbits and an official number?", n, "asteroids", "Space", span=5, difficulty=3, as_of="November 2026", url="https://ssd.jpl.nasa.gov/tools/sbdb_query.html", source="NASA JPL Small-Body Database", licence=PD, evidence=f"sbdb_query.api?info=count: {json.dumps(j)[:300]}", explainer="A number is given only once the orbit is known well enough to find it again.", check="sbdb-count")


def exo():
    u = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+count(*)+from+pscomppars&format=csv"
    n = int(fetch(u).strip().split("\n")[-1])
    add("sp-exoplanets", "How many planets around other stars had been confirmed?", n, "planets", "Space", span=4, difficulty=2, as_of="November 2026", url="https://exoplanetarchive.ipac.caltech.edu/", source="NASA Exoplanet Archive", licence=PD, evidence=f"TAP count(*) from pscomppars = {n}", explainer="Most were never seen directly. They were caught dimming or tugging their star.", check="exo-count")


def pages():
    def pq(id, url, pat, question, unit, source, expl, f=1, **k):
        def go():
            v, snip = find(text(url), pat)
            add(id, question, v * f, unit, "Space", url=url, source=source, licence=PD, evidence=snip, explainer=expl, **k)
        attempt(id, go)
    iss = "https://www.nasa.gov/international-space-station/space-station-facts-and-figures/"
    pq("sp-iss-mass", iss, r"([\d,]+) pounds", "How many pounds does the International Space Station weigh?", "pounds", "NASA", "It was put together in orbit, piece by piece.", span=4, difficulty=2)
    pq("sp-iss-orbits", iss, r"(\d+) orbits of Earth", "How many times does the International Space Station circle Earth in 24 hours?", "orbits", "NASA", "The crew passes through a sunrise and a sunset on every lap.", span=3, difficulty=1)
    pq("sp-iss-length", iss, r"(\d+) feet", "How many feet long is the International Space Station from end to end?", "feet", "NASA", "That is one yard short of a football field with its end zones.", span=3, difficulty=2)
    pq("sp-apollo-rock", "https://curator.jsc.nasa.gov/lunar/", r"(\d+) kilograms", "How many kilograms of Moon rock and soil did the Apollo missions bring back?", "kg", "NASA Johnson Space Center", "Researchers still open sealed samples as instruments improve.", span=4, difficulty=2)
    pq("sp-moon-dist", "https://science.nasa.gov/moon/facts/", r"average of ([\d,]+) miles", "How many miles away is the Moon on average?", "miles", "NASA", "About 30 Earths would fit in the gap.", span=3, difficulty=1)
    pq("sp-sun-core", "https://science.nasa.gov/sun/facts/", r"(27 million) degrees Fahrenheit", "How hot is the core of the Sun, in degrees Fahrenheit?", "°F", "NASA", "The surface we see is thousands of times cooler.", span=5, difficulty=2)


def run():
    for f in (planets, moons, small_bodies, exo, pages):
        attempt(f"space.{f.__name__}", f)
