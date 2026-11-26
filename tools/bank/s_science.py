import csv, io, math, itertools
from fractions import Fraction
from lib import *

PT = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/CSV"


def elements():
    rows = list(csv.DictReader(io.StringIO(fetch(PT))))
    el = {r["Name"]: r for r in rows}
    c = lambda n, f="MeltingPoint": float(el[n][f]) - 273.15
    def q(id, name, field, question, unit, conv, expl, d, **k):
        v = conv(float(el[name][field]))
        add(id, question, v, unit, "Math and science", difficulty=d, url="https://pubchem.ncbi.nlm.nih.gov/periodic-table/", source="PubChem, NIH", licence=PD, evidence=f"PubChem periodic table CSV: {name} {field} = {el[name][field]}", explainer=expl(v) if callable(expl) else expl, check=f"pubchem|{name}|{field}", topic="el-" + field[:4], label=name, **k)
    cel = lambda k: round(k - 273.15)
    q("el-tungsten", "Tungsten", "MeltingPoint", "At what temperature does tungsten melt, in degrees Celsius?", "°C", cel, lambda a: f"No other metal holds out longer. Iron gives up at {fmt(c('Iron'),0)}°C.", 2, scale="linear", span=8000, lo=-273)
    q("el-gallium", "Gallium", "MeltingPoint", "At what temperature does the metal gallium melt, in degrees Celsius?", "°C", lambda k: round(k - 273.15, 1), "A spoon made of it would sag in your hand.", 2, scale="linear", span=400, lo=-273)
    q("el-gold", "Gold", "MeltingPoint", "At what temperature does gold melt, in degrees Celsius?", "°C", cel, lambda a: f"Silver melts sooner, at {fmt(c('Silver'),0)}°C.", 1, scale="linear", span=3000, lo=-273)
    q("el-lead", "Lead", "MeltingPoint", "At what temperature does lead melt, in degrees Celsius?", "°C", cel, "A kitchen oven comes close, which is why people used to cast it at home.", 2, scale="linear", span=1500, lo=-273)
    q("el-mercury", "Mercury", "MeltingPoint", "At what temperature does mercury freeze, in degrees Celsius?", "°C", cel, "Mercury thermometers stop working in the coldest parts of Siberia.", 2, scale="linear", span=400, lo=-273)
    q("el-helium", "Helium", "BoilingPoint", "At what temperature does helium boil, in degrees Celsius?", "°C", lambda k: round(k - 273.15, 1), lambda a: f"Only {fmt(a+273.15,1)} degrees above absolute zero, the lowest boiling point of any element.", 3, scale="linear", span=320, lo=-273)
    q("el-nitrogen", "Nitrogen", "BoilingPoint", "At what temperature does liquid nitrogen boil, in degrees Celsius?", "°C", cel, "That is why it seems to smoke at room temperature. The cloud is water from the air.", 2, scale="linear", span=400, lo=-273)
    q("el-aluminum", "Aluminum", "MeltingPoint", "At what temperature does aluminum melt, in degrees Celsius?", "°C", cel, lambda a: f"Copper needs {fmt(c('Copper'),0)}°C.", 2, scale="linear", span=2000, lo=-273)
    q("el-osmium", "Osmium", "Density", "Osmium is the densest natural element. How many grams does a cubic centimeter of it weigh?", "grams", lambda v: v, lambda a: f"Lead is only {fmt(float(el['Lead']['Density']),1)} and water is 1.", 3, span=3)
    q("el-gold-dens", "Gold", "Density", "How many grams does one cubic centimeter of gold weigh?", "grams", lambda v: v, lambda a: f"Iron is {fmt(float(el['Iron']['Density']),1)}, so a gold bar is far heavier than it looks.", 2, span=3)
    q("el-alu-dens", "Aluminum", "Density", "How many grams does one cubic centimeter of aluminum weigh?", "grams", lambda v: v, lambda a: f"About a third of iron, at {fmt(float(el['Iron']['Density']),1)}.", 3, span=3)
    q("el-iron", "Iron", "MeltingPoint", "At what temperature does iron melt, in degrees Celsius?", "°C", cel, lambda a: f"Copper goes first, at {fmt(c('Copper'),0)}°C.", 1, scale="linear", span=3000, lo=-273)
    q("el-silver", "Silver", "MeltingPoint", "At what temperature does silver melt, in degrees Celsius?", "°C", cel, lambda a: f"Gold needs a little more, {fmt(c('Gold'),0)}°C.", 2, scale="linear", span=3000, lo=-273)
    q("el-tin", "Tin", "MeltingPoint", "At what temperature does tin melt, in degrees Celsius?", "°C", cel, "Low enough for a soldering iron, which is why solder used to be mostly tin and lead.", 2, scale="linear", span=1200, lo=-273)
    q("el-titanium-m", "Titanium", "MeltingPoint", "At what temperature does titanium melt, in degrees Celsius?", "°C", cel, lambda a: f"Aluminum softens far earlier and melts at {fmt(c('Aluminum'),0)}°C.", 3, scale="linear", span=4000, lo=-273)
    q("el-oxygen-b", "Oxygen", "BoilingPoint", "At what temperature does liquid oxygen boil, in degrees Celsius?", "°C", cel, "The liquid is pale blue and sticks to a magnet.", 3, scale="linear", span=400, lo=-273)
    q("el-iodine", "Iodine", "MeltingPoint", "At what temperature does iodine melt, in degrees Celsius?", "°C", cel, "Warm it gently and it gives off purple vapor.", 3, scale="linear", span=600, lo=-273)
    q("el-sodium", "Sodium", "MeltingPoint", "At what temperature does sodium metal melt, in degrees Celsius?", "°C", cel, "It is soft enough to cut with a table knife.", 3, scale="linear", span=600, lo=-273)
    q("el-lead-dens", "Lead", "Density", "How many grams does one cubic centimeter of lead weigh?", "grams", lambda v: v, lambda a: f"Gold is far denser, at {fmt(float(el['Gold']['Density']),1)}.", 2, span=3)
    q("el-mercury-dens", "Mercury", "Density", "How many grams does one cubic centimeter of mercury weigh?", "grams", lambda v: v, "A bowling ball would float in it.", 2, span=3)
    q("el-lithium-dens", "Lithium", "Density", "Lithium is the lightest metal. How many grams does one cubic centimeter of it weigh?", "grams", lambda v: v, "It would float on water if it did not react with it first.", 3, span=3)
    for nm, qx, ex in [("Oxygen", "In what year was oxygen discovered, by the periodic table's records?", "Two chemists found it separately within a few years."), ("Helium", "In what year was helium discovered?", "It was seen in sunlight before anyone found it on Earth."), ("Neon", "In what year was neon discovered?", "Neon signs followed within a couple of decades."), ("Titanium", "In what year was titanium discovered?", "Making it as a usable metal took more than a century longer."), ("Aluminum", "In what year was aluminum discovered, by the periodic table's records?", "For decades it cost more than gold."), ("Plutonium", "In what year was plutonium first made?", "It was named after Pluto, next in line after uranium and neptunium.")]:
        if el[nm]["YearDiscovered"].isdigit():
            y = int(el[nm]["YearDiscovered"])
            add(f"el-{nm.lower()}-year", qx, y, "year", "History", scale="linear", span=350, difficulty=3, url="https://pubchem.ncbi.nlm.nih.gov/periodic-table/", source="PubChem, NIH", licence=PD, evidence=f"PubChem periodic table CSV: {nm} YearDiscovered = {y}", explainer=ex, check=f"pubchem|{nm}|YearDiscovered", hi=2020, topic="el-year")
    gases = sum(r["StandardState"] == "Gas" for r in rows)
    add("el-gases", "How many of the 118 elements are gases at room temperature?", gases, "elements", "Math and science", span=2.4, difficulty=2, url="https://pubchem.ncbi.nlm.nih.gov/periodic-table/", source="PubChem, NIH", licence=PD, evidence=f"PubChem periodic table CSV: StandardState = Gas in {gases} rows: {', '.join(r['Name'] for r in rows if r['StandardState']=='Gas')}", explainer="Most of the rest are solid metals. Only a couple are liquid.", check="pubchem-gases", whole=True)
    rad = [r for r in rows if r["Symbol"] == "U"][0]
    add("el-uranium-w", "How many times heavier is one uranium atom than one hydrogen atom?", round(float(rad["AtomicWeight"]) / float(el["Hydrogen"]["AtomicWeight"])), "times", "Math and science", span=3, difficulty=2, url="https://pubchem.ncbi.nlm.nih.gov/periodic-table/", source="PubChem, NIH", licence=PD, evidence=f"Atomic mass uranium {rad['AtomicWeight']}, hydrogen {el['Hydrogen']['AtomicWeight']}", explainer="Uranium is the heaviest element found in quantity in nature.", check="pubchem-ratio")


def nist():
    u = "https://physics.nist.gov/cuu/Constants/Table/allascii.txt"
    t = fetch(u)
    def const(name):
        line = next(l for l in t.split("\n") if l.startswith(name))
        v = line[60:85].replace(" ", "").replace("...", "")
        return float(v), re.sub(r"\s+", " ", line).strip()
    v, ev = const("speed of light in vacuum")
    add("sc-light", "How fast does light travel, in kilometers per second?", v / 1000, "km/s", "Math and science", span=4, difficulty=1, url="https://physics.nist.gov/cgi-bin/cuu/Value?c", source="NIST CODATA", licence=PD, evidence=ev, explainer="The meter is defined from this number, so it is exact.", check="nist|speed of light in vacuum")
    v, ev = const("Avogadro constant")
    add("sc-sound-g", "How fast does a dropped object speed up at Earth's surface, in centimeters per second, every second?", const("standard acceleration of gravity")[0] * 100, "cm/s", "Math and science", span=3, difficulty=2, url="https://physics.nist.gov/cgi-bin/cuu/Value?gn", source="NIST CODATA", licence=PD, evidence=const("standard acceleration of gravity")[1], explainer="After one second of falling you are already moving at about 35 km per hour.", check="nist|standard acceleration of gravity")


def math_q():
    C = "Math and science"
    U = "https://github.com/prathammukewar/cinch/blob/main/tools/bank/s_science.py"
    def m(id, question, ans, unit, ev, expl, d, **k):
        add(id, question, ans, unit, C, difficulty=d, url=U, source="Calculated in the open", licence=OWN, evidence=ev, explainer=expl, check="math|" + id, **k)
    sieve = bytearray([1]) * 1000001
    sieve[0:2] = b"\0\0"
    for i in range(2, 1001):
        if sieve[i]:
            sieve[i * i::i] = bytearray(len(sieve[i * i::i]))
    p = lambda n: sum(sieve[: n + 1])
    m("ma-primes-1000", "How many prime numbers are there below 1,000?", p(1000), "primes", f"sieve of Eratosthenes to 1,000: {p(1000)}", f"Below 100 there are {p(100)}, so they thin out as you go.", 2, span=3, whole=True)
    m("ma-primes-million", "How many prime numbers are there below one million?", p(1000000), "primes", f"sieve of Eratosthenes to 1,000,000: {p(1000000)}", f"About one number in {fmt(1e6/p(1000000),0)} is prime in that stretch.", 3, span=4, whole=True)
    m("ma-100fact", "100 factorial is 1 times 2 times 3 and so on, all the way up to 100. How many digits does it have?", len(str(math.factorial(100))), "digits", f"len(str(100!)) = {len(str(math.factorial(100)))}", f"It ends in {len(str(math.factorial(100))) - len(str(math.factorial(100)).rstrip('0'))} zeros.", 2, span=3.4, whole=True)
    m("ma-52fact", "How many digits are in the number of ways to order a deck of 52 cards?", len(str(math.factorial(52))), "digits", f"52! = {math.factorial(52)}", "A well-shuffled deck is almost surely in an order nobody has ever seen.", 2, span=3, whole=True)
    n = next(n for n in range(1, 400) if 1 - math.prod((365 - i) / 365 for i in range(n)) >= 0.5)
    m("ma-birthday", "How many people do you need before two of them probably share a birthday?", n, "people", f"smallest n with 1 - prod((365-i)/365) >= 1/2 is {n}", f"With {next(k for k in range(1, 400) if 1 - math.prod((365 - i) / 365 for i in range(k)) >= 0.99)} people it is 99% likely.", 1, span=3, whole=True)
    m("ma-2-64", "Put 1 grain of rice on a chessboard's first square and double it on each next one. How many grains go on the last square?", 2 ** 63, "grains", f"2^63 = {2**63}", "All the squares before it hold one grain fewer than it does on its own.", 2, span=8)
    m("ma-paper", "A sheet is 0.1 mm thick. If you could fold it in half 42 times, how many kilometers thick would it be?", round(0.1e-6 * 2 ** 42), "km", f"0.1 mm x 2^42 = {0.1e-6 * 2**42} km", "That is farther than the Moon.", 2, span=8)
    m("ma-chess-squares", "How many squares of every size are on an 8 by 8 chessboard?", sum(k * k for k in range(1, 9)), "squares", "1^2 + ... + 8^2 = 204", "There are 64 small ones, then 49 of the next size, and so on up to the board itself.", 2, span=3, whole=True)
    m("ma-poker-flush", "How many different 5-card poker hands can be dealt from a 52-card deck?", math.comb(52, 5), "hands", f"C(52,5) = {math.comb(52,5)}", f"Only {4} of them are royal flushes.", 2, span=5)
    m("ma-royal", "If you were dealt 5 cards, one chance in how many of getting a royal flush?", math.comb(52, 5) // 4, "", f"C(52,5)/4 = {math.comb(52,5)//4}", "At one hand a minute, day and night, you would wait more than a year on average.", 3, span=5)
    m("ma-powerball", "Powerball picks 5 of 69 white balls and 1 of 26 red. One chance in how many of matching all six?", math.comb(69, 5) * 26, "", f"C(69,5) x 26 = {math.comb(69,5)*26}", "Buying a ticket every day, you would wait about 800,000 years on average.", 2, span=5)
    m("ma-rubik", "How many digits are in the number of ways to scramble a Rubik's Cube?", len(str(math.factorial(8) * 3 ** 7 * math.factorial(12) // 2 * 2 ** 11)), "digits", f"8! x 3^7 x 12!/2 x 2^11 = {math.factorial(8)*3**7*math.factorial(12)//2*2**11}", "About 43 quintillion, and every one can be solved in 20 turns or fewer.", 3, span=2.6, whole=True)
    m("ma-tictac", "How many different ways can a full game of tic-tac-toe play out, move by move?", _ttt(), "games", f"exhaustive count of move sequences = {_ttt()}", "Ignoring rotations and reflections, far fewer are truly different.", 3, span=4)
    m("ma-queens", "In how many ways can 8 queens sit on a chessboard with none attacking another?", _queens(8), "ways", f"backtracking count = {_queens(8)}", "Counting mirror images and turns as the same leaves only 12.", 3, span=3.4, whole=True)
    m("ma-change", "In how many ways can you make change for a dollar using pennies, nickels, dimes, quarters and half dollars?", _change(100, [1, 5, 10, 25, 50]), "ways", f"coin-change count = {_change(100,[1,5,10,25,50])}", "Adding a one-dollar coin to the list adds exactly one more way.", 2, span=3.4, whole=True)
    m("ma-sudoku-fri13", "In 400 years of our calendar, how many Friday the 13ths are there?", _fri13(), "", f"datetime count 2000-2399 = {_fri13()}", "The 13th falls on a Friday slightly more often than on any other weekday.", 2, span=3.4, whole=True)
    m("ma-bday-today", "How many people would you need to be 50% likely that someone shares your own birthday?", next(n for n in range(1, 2000) if 1 - (364 / 365) ** n >= 0.5), "people", f"smallest n with 1-(364/365)^n >= 1/2 is {next(n for n in range(1,2000) if 1-(364/365)**n>=0.5)}", "Far more than it takes for any two people in the room to match each other.", 3, span=3.4, whole=True)
    m("ma-coupon", "Cereal boxes each hold one of 20 toys at random. How many boxes do you need on average to get them all?", round(20 * sum(1 / k for k in range(1, 21)), 1), "boxes", f"20 x H(20) = {20*sum(1/k for k in range(1,21)):.2f}", "The last toy alone takes 20 boxes on average.", 3, span=3)
    m("ma-compound", "Put $1,000 away at 7% a year, compounded yearly. How much is it after 50 years?", round(1000 * 1.07 ** 50), "US dollars", f"1000 x 1.07^50 = {1000*1.07**50:.2f}", "It doubles about every ten years.", 2, span=4)
    m("ma-penny", "Double a penny every day for 30 days, starting with one cent on day 1. How many dollars is it on day 30?", round(0.01 * 2 ** 29, 2), "US dollars", f"0.01 x 2^29 = {0.01*2**29}", "On day 20 it is still only a little over $5,000.", 1, span=6)


def _ttt():
    wins = [(0, 1, 2), (3, 4, 5), (6, 7, 8), (0, 3, 6), (1, 4, 7), (2, 5, 8), (0, 4, 8), (2, 4, 6)]
    def go(b, pl):
        if any(b[i] == b[j] == b[k] != 0 for i, j, k in wins) or all(b):
            return 1
        s = 0
        for i in range(9):
            if not b[i]:
                b[i] = pl; s += go(b, 3 - pl); b[i] = 0
        return s
    return go([0] * 9, 1)


def _queens(n):
    def go(r, cols, d1, d2):
        if r == n: return 1
        return sum(go(r + 1, cols | {c}, d1 | {r + c}, d2 | {r - c}) for c in range(n) if c not in cols and r + c not in d1 and r - c not in d2)
    return go(0, frozenset(), frozenset(), frozenset())


def _change(total, coins):
    w = [1] + [0] * total
    for c in coins:
        for i in range(c, total + 1): w[i] += w[i - c]
    return w[total]


def _fri13():
    import datetime
    return sum(datetime.date(y, m, 13).weekday() == 4 for y in range(2000, 2400) for m in range(1, 13))


def run():
    for f in (elements, nist, math_q):
        attempt(f"science.{f.__name__}", f)
