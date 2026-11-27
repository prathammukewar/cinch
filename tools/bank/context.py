"""Check the context lines in bank/context.json (or a file given as the first argument).

A context says what a question's subject is, for players who have never heard of it. It must
give no hint about the answer: no numbers, no ranks, no sizes, no ages or eras, no amounts, no
units, no wealth. A banned word is allowed only where the question itself already uses it, so
"K2" or "the Boeing 727" can still be named. Exits with an error on any problem.

    python3 tools/bank/context.py [file.json]
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
BANK = ROOT / "bank" / "questions.json"
CONTEXT = ROOT / "bank" / "context.json"

W = lambda *words: re.compile(r"\b(" + "|".join(words) + r")\b", re.I)
RULES = [
    ("a number", W(r"\w*\d\w*", "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
                    "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "thirty",
                    "forty", "fifty", "sixty", "seventy", "eighty", "ninety", "hundreds?", "thousands?", "millions?", "billions?", "trillions?", "dozens?", "half", "halves",
                    "quarter", "twice", "thrice", "double", "triple", "quadruple", "single", "pair", "couple", "twin", "twins", "dual")),
    ("an order", W("first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth", r"\w+teenth", r"\w+tieth", "hundredth", "thousandth", "millionth", "last", "final",
                   "debut", "maiden", "inaugural", "premiere", "premiered", "sequel", "prequel", "remake", "successor", "predecessor",
                   "original", "originally", "next", "previous", "later", "earlier", "since", "until")),
    ("a rank", W("most", "least", "more", "less", "fewer", "top", "leading", "record", "records", "rank", "ranks", "ranked", "only", "unique",
                 "larger", "smaller", "bigger", "taller", "shorter", "longer", "older", "newer", "younger", "higher", "lower", "deeper",
                 "heavier", "lighter", "faster", "slower", "greater", "richer", "poorer", "busier", "wider", "narrower", "than",
                 r"\w+est")),
    ("a size or amount", W("large", "big", "huge", "vast", "giant", "gigantic", "enormous", "massive", "immense", "colossal", "tiny",
                           "small", "little", "miniature", "short", "tall", "long", "lengthy", "high", "low", "deep", "shallow", "wide",
                           "narrow", "broad", "heavy", "light", "dense", "thin", "thick", "slim", "compact", "sprawling", "towering",
                           "mega", "mini", "micro", "super", "supertall", "skyscraper", "populous", "crowded", "densely", "sparsely",
                           "empty", "packed", "many", "few", "several", "numerous", "lots", "much", "plenty", "countless", "abundant",
                           "scarce", "rare", "rarely", "common", "commonly", "widespread", "frequent", "frequently", "often", "seldom",
                           "full", "whole", "entire", "entirely", "major", "minor", "great", "grand", "epic", "marathon", "brief",
                           "quick", "fast", "slow", "rapid", "rapidly", "speedy", "swift", "growing", "shrinking", "booming", "dwarf",
                           "tons", "loads", "extensive", "massively", "far", "nearly", "almost", "approximately", "roughly", "up to",
                           "at least")),
    ("an age or era", W("old", "ancient", "new", "young", "modern", "recent", "recently", "early", "late", "historic", "historical",
                        "classic", "vintage", "contemporary", "medieval", "victorian", "colonial", "prehistoric", "era", "eras",
                        "century", "centuries", "decade", "decades", "age", "ages", "aged", "period", "dynasty", "today", "now",
                        "currently", "current", "still", "once", "former", "formerly", "retired", "defunct", "veteran", "pioneer",
                        "pioneering", "pioneered", "founding", "golden", "renaissance", "industrial", "cold war", "world war",
                        "postwar", "wartime", "millennium", "future", "past", "ago", "years", "year", "months", "month", "weeks",
                        "week", "days", "hours", "minutes", "lifetime", "lifespan", "longevity", "aging", "ageing", "elderly")),
    ("wealth or fame", W("rich", "wealthy", "poor", "poorer", "affluent", "prosperous", "expensive", "cheap", "costly", "pricey", "luxury",
                         "luxurious", "budget", "lucrative", "profitable", "billionaire", "millionaire", "famous", "popular", "renowned",
                         "iconic", "celebrated", "beloved", "acclaimed", "legendary", "successful", "blockbuster", "hit", "bestselling",
                         "important", "prominent", "notable", "powerful", "dominant", "giant", "superpower", "global", "worldwide")),
    ("a unit", W("meters?", "metres?", "kilometers?", "kilometres?", "km", "miles?", "feet", "foot", "inch", "inches", "yards?", "acres?",
                 "hectares?", "grams?", "kilograms?", "kg", "pounds?", "lbs?", "tons?", "tonnes?", "ounces?", "oz", "liters?", "litres?",
                 "gallons?", "calories?", "kcal", "degrees?", "celsius", "fahrenheit", "kelvin", "percent", "per cent", "dollars?",
                 "euros?", "cents?", "watts?", "volts?", "knots?", "mph", "seconds?", "episodes?", "pages?", "words?", "seats?",
                 "storeys?", "floors?")),
]
RULES += [
    ("nutrition", W("protein", "proteins", "fat", "fats", "fatty", "sugar", "sugars", "sugary", "sweet", "sweetened", "salty", "salt", "salted",
                    "sodium", "carbs?", "carbohydrates?", "starch", "starchy", "fiber", "fibre", "energy", "nutritious", "nutrients?",
                    "healthy", "lean", "oily", "oil", "cholesterol", "caffeine", "calcium", "iron", "potassium", "vitamins?", "minerals?",
                    "diet", "dietary", "filling", "rich in", "low in", "watery", "juicy", "creamy", "buttery")),
    ("a state of matter", W("gas", "gases", "gaseous", "liquid", "liquids", "solid", "solids", "molten", "frozen", "freezes", "melts",
                            "melting", "boils", "boiling", "vapor", "vapour", "evaporates", "room temperature", "hot", "cold", "warm",
                            "cool", "icy", "inner", "outer", "orbit", "orbits", "moons?")),
    ("a dating clue", W("soviet", "ussr", r"yugoslav\w*", r"czechoslovak\w*", "ottoman", "empire", "imperial", "steam", "smartphones?",
                        "vinyl", "cassettes?", "vhs", "dvds?", "streaming", "silent", "monochrome", "technicolor", "black and white",
                        "art deco", "gothic", "brutalist", "baroque", "edwardian", "modernist", "postmodern", "art nouveau",
                        "space race", "internet", "online", "digital", "analog", "analogue", "retro", "nostalgic")),
]
SYMBOLS = re.compile(r"[%$€£¥°—–!?;]|\s-\s|\.\.\.")


def allowed(word, q):
    """Words the question already says are no hint."""
    said = (q["question"] + " " + (q.get("label") or "")).lower()
    if not re.search(r"\w", word):
        return word in said   # a symbol, like the ! in Help!
    return re.search(r"(?<!\w)" + re.escape(word.lower()) + r"(?!\w)", said) is not None


def problems(text, q):
    out = []
    if not isinstance(text, str) or not text.strip():
        return ["empty"]
    if len(text) > 230: out.append(f"too long ({len(text)})")
    if len(text) < 25: out.append("too short")
    if not text.endswith("."): out.append("does not end with a period")
    # Sentence ends, not initials: J. R. R. Tolkien is one name.
    if len(re.findall(r"(?<![\s.][A-Z])[.](\s|$)", text)) > 2: out.append("more than two sentences")
    for m in SYMBOLS.finditer(text):
        if not allowed(m.group(0), q): out.append(f"symbol {m.group(0)!r}")
    for name, rule in RULES:
        for m in rule.finditer(text):
            w = m.group(0)
            if name == "a rank" and w.lower().endswith("est") and w.lower() in OK_EST: continue
            if w.lower() in NAME_WORDS and w[0].isupper() and re.match(r"\s+[A-Z]", text[m.end():]): continue   # New York, the Great Lakes
            if not allowed(w, q): out.append(f"{name}: {w!r}")
    return out


OK_EST = {"west", "midwest", "northwest", "southwest", "forest", "forests", "interest", "interests", "honest", "crest", "chest", "rest",
          "nest", "test", "tests", "quest", "protest", "harvest", "contest", "request", "suggest", "digest", "arrest", "conquest",
          "invest", "manifest", "modest", "guest", "guests", "pest", "pests", "zest", "vest", "tempest", "inquest", "bequest", "everest",
          "budapest", "bucharest", "unrest", "priest", "priests", "rainforest", "rainforests", "northeast", "southeast", "east",
          "feast", "beast", "beasts", "breast", "yeast", "coast", "toast", "roast", "post", "host", "ghost", "cost", "frost", "almost",
          "honestly", "ernest", "earnest", "forrest"}
# Words that are part of a name when a capitalized word follows: New York, the Great Lakes, Major League Baseball.
NAME_WORDS = {"great", "grand", "big", "little", "long", "high", "low", "new", "old", "major", "minor", "golden", "super", "far"}


def check(contexts, qs):
    by_id = {q["id"]: q for q in qs}
    errors = []
    for qid, text in contexts.items():
        q = by_id.get(qid)
        if not q:
            errors.append(f"{qid}: no such question")
            continue
        for p in problems(text, q):
            errors.append(f"{qid}: {p} | {text}")
    return errors


if __name__ == "__main__":
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else CONTEXT
    contexts = json.loads(path.read_text())
    errors = check(contexts, json.loads(BANK.read_text()))
    for e in errors: print("ERROR", e)
    print(f"{len(contexts)} contexts, {len(errors)} errors")
    sys.exit(1 if errors else 0)
