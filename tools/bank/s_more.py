"""Many more questions, made in bulk from the same kinds of sources as the rest of the bank.

Subjects are picked by how many Wikipedias cover them, or from short lists of familiar names,
so they are things people have heard of. Every number is read from a fetched response, and
Wikidata numbers are kept only when the English Wikipedia article states the same number.
Explainers are worked out from the same fetched data: a comparison, a rank, a conversion.
Nothing here holds an answer."""
import csv, io, math, random, hashlib, urllib.parse
from lib import *
import s_wikidata as W
import s_food, s_animals

from validate import BAD_WORDS

NOW = 2026
have = lambda id: any(q["id"] == id for q in QUESTIONS)
texts = lambda: {q["question"].lower() for q in QUESTIONS}
_add = add
SKIPPED = []
PROFANE = re.compile(r"fuck|shit|bitch|cunt|\bass\b|\bdick\b|\bpiss", re.I)


def add(id, question, answer, unit, cat, **k):
    """The bank's add, behind the same rules validate.py enforces, so a bad candidate is left out, not fixed by hand."""
    why = None
    if " \u2013 " in question or " \u2014 " in question: why = "spaced dash in a title"
    question = question.replace("\u2013", "-").replace("\u2014", "-")
    k["explainer"] = k["explainer"].replace(" \u2013 ", ", ").replace("\u2013", "-").replace("\u2014", "-")
    a = f"{answer:g}"
    if BAD_WORDS.search(question) or BAD_WORDS.search(k["explainer"]): why = "grim word"
    elif PROFANE.search(question) or PROFANE.search(k["explainer"]): why = "swear word"
    elif len(a) > 2 and re.search(rf"(?<!\d){re.escape(a)}(?!\d)", re.sub(r"[,\s]", "", question)): why = "gives the answer away"
    elif question.lower() in texts(): why = "same question as one already in the bank"
    elif unit == "%" and not 0 < answer < 100: why = "percentage at an edge"
    elif k.get("scale", "log") == "log" and answer <= 0: why = "not positive"
    if why:
        SKIPPED.append((id, why))
        return
    _add(id, question, answer, unit, cat, **k)


def sig(v):
    """Two significant figures below 10, one decimal below 100, whole numbers above."""
    return clean(float(f"{v:.2g}")) if v < 10 else clean(round(v, 1)) if v < 100 else clean(round(v))


def shuffled(key, items):
    r = random.Random(int(hashlib.sha256(key.encode()).hexdigest()[:12], 16))
    items = list(items)
    r.shuffle(items)
    return items


def ordinal(n):
    return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def tier(i, n):
    return 1 if i < n * 0.3 else 2 if i < n * 0.7 else 3


# ------------------------------------------------------------------ Wikidata, ranked by fame

W.KEYS.update({"P1082": r"population|inhabitants|residents|people", "P2120": r"radius|diameter", "P1128": r"employees|num_employees|staff|workforce", "P2048": W.KEYS["P2048"] + r"|drop|falls|statue"})
PFX = W.PREFIX + "PREFIX wdt: <http://www.wikidata.org/prop/direct/> PREFIX schema: <http://schema.org/> "


def famous(classes, prop, limit, extra=""):
    vals = " ".join("wd:" + c for c in classes)
    q = PFX + (f"SELECT ?item ?title ?links WHERE {{ VALUES ?c {{ {vals} }} ?item wdt:P31 ?c . ?item p:{prop} ?st . ?item wikibase:sitelinks ?links . "
               f"?a schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title . {extra} }} ORDER BY DESC(?links) LIMIT {limit * 3}")
    j = fetch_json(W.QL + urllib.parse.quote(q), headers={"Accept": "application/sparql-results+json"}, pause=2)
    out, seen = [], set()
    for r in j["results"]["bindings"]:
        i = r["item"]["value"].rsplit("/", 1)[-1]
        if i in seen: continue
        seen.add(i)
        out.append((i, r["title"]["value"], int(r["links"]["value"])))
        if len(out) >= limit: break
    return out


def articles(titles):
    """Wikitext of articles, twenty per request, only the ones not already loaded."""
    todo = [t for t in dict.fromkeys(titles) if t not in W._articles]
    for i in range(0, len(todo), 20):
        j = fetch_json(W.API + "&prop=revisions&rvprop=content&rvslots=main&titles=" + urllib.parse.quote("|".join(todo[i:i + 20])), pause=6, tries=4)
        alias = {}
        for k in ("normalized", "redirects"):
            for r in j["query"].get(k, []): alias[r["to"]] = r["from"]
        for pg in j["query"]["pages"].values():
            if "revisions" in pg: W._articles[alias.get(pg["title"], pg["title"])] = pg["revisions"][0]["slots"]["main"]["*"]


def chunks(cands, size=20):
    for i in range(0, len(cands), size):
        articles([c[1] for c in cands[i:i + size]])
        yield from cands[i:i + size]


def bare(title):
    return re.sub(r" \(.*\)$", "", title)


def lead(title):
    """The first paragraph of the article's own text, as wikitext."""
    for line in W._articles.get(title, "").split("\n"):
        t = line.strip()
        if "'''" in t and not t.startswith(("|", "{", "!", "[[File", "[[Image", "<")):
            return t
    return ""


def plain(t):
    t = re.sub(r"\{\{(?:nihongo|lang|langx|transl)\|", "", t, flags=re.I)
    return re.sub(r"'{2,}|\[\[(?:[^\]|]*\|)?|\]\]", "", t)


def bold(title):
    m = re.search(r"'''(.+?)'''", lead(title))
    return plain(m.group(1)).strip() if m else ""


def the_(title, name=None):
    """'the ' when Wikipedia's own first sentence calls it 'the X', so questions read the way the article does."""
    name = name or bare(title)
    t = lead(title)
    pl, b = plain(t), bold(title)
    if pl.lower().startswith("the " + name.lower()) and not re.match(r"[\w-]| [A-Z]", pl[4 + len(name):]): return "the "
    has_the = b.startswith("The ") or plain(t[:t.find("'''")]).strip().lower() == "the"
    core = re.sub(r"^The ", "", b)
    if has_the and core.lower().endswith(name.lower()) and len(core.split()) - len(name.split()) <= 2: return "the "
    return ""


def named(title, work=False):
    """The name a question uses. Works keep their title as written; for places and things the article's own
    bold name is used when it is the fuller form of the title, with 'the' when the article says 'the'."""
    name = bare(title)
    if work: return name if name.startswith("The ") else the_(title, name) + name
    name = re.sub(r",? Inc\.$", "", name)
    b = bold(title)
    if b and b.lower() == name.lower(): name = b
    elif b and b != name and re.fullmatch(re.escape(name) + r" (?:" + SUFFIX + r")", b): name = b
    if name.startswith("The "): name = "the " + name[4:]
    else: name = the_(title, name) + name
    place = re.search(r" \(([A-Z][^()]*)\)$", title)
    if place and not re.search(TYPES, place.group(1), re.I): name += " in " + place.group(1)
    kind = re.search(r" \(([^()]*)\)$", title)
    if kind and len(name.split()) <= 2:
        k, n = kind.group(1).lower(), re.sub(r"^the ", "", name)
        if k in ("spacecraft", "helicopter", "rover", "satellite", "space probe", "lander", "operating system", "newspaper", "conference", "tv network"): name = f"the {n} {kind.group(1)}"
        elif k == "magazine": name = f"{n} magazine"
    return name


SUFFIX = r"River|Bridge|Tower|Tunnel|Dam|Falls|Lake|Stadium|Arena|Building|Center|Centre|Palace|Castle|Cathedral|Museum|Observatory|Telescope|Island|Mountain|Volcano"


TYPES = r"network|channel|broadcaster|film|novel|album|song|game|series|show|language|stadium|arena|magazine|newspaper|service|toy|company|band|club|team|spacecraft|satellite|telescope|observatory|probe|statue|building|tower|bridge|river|lake|mountain|volcano|island|moon|planet|comet|software|system|console|website|brand|car|aircraft|airliner|ship|ballet|opera|musical|play|poem|book"


def is_are(n):
    return "are" if re.search(r"(Towers|Falls|Waterfalls|Mountains|Islands|Lakes|Gardens)$", n) else "is"


GRIM = re.compile(r"concentration camp|extermination|death camp|holocaust|genocide|massacre|\bnazi|slave|prison|gulag|execution|assassinat|terroris|bombing|famine|plague|cemetery|necropolis|\btomb\b|mausoleum|war memorial", re.I)


def grim(title):
    return bool(GRIM.search(title) or GRIM.search(re.sub(r"'{2,}|\[\[|\]\]", "", lead(title))))


def gone(title):
    """True when the article says the thing no longer stands or runs."""
    t = re.sub(r"'{2,}|\[\[(?:[^\]|]*\|)?|\]\]", "", lead(title))[:400]
    return bool(re.search(r"\bwas (?:a|an|the)\b|\bdemolished\b|\bdefunct\b|\bformer\b|under construction|\bplanned\b|\bproposed\b|unfinished|on hold|\bstalled\b", t, re.I))


YEAR_FIELDS = {
    "P571": r"established|founded|foundation|formation|formed|built|opened|year|first_appeared|released|introduced|launched|inception|date_founded|founding_date|start_date|completion_date|creation_date",
    "P577": r"released|release_date|pub_date|published|first_release_date|first_aired|year|introduced|launched",
    "P619": r"launch_date|launch",
    "P575": r"discovery_date|discovered|discovery|discovery_site_date",
}


def year_ok(title, y, prop, s):
    """The year the question asks for is the only year the article gives, with no hedging."""
    others = [int(x) for x in re.findall(r"(?<!\d)(1\d{3}|20\d{2})(?!\d)", s) if int(x) != y]
    if any(abs(x - y) <= 3 for x in others): return False
    if re.search(rf"(?:\bc\.|\bca\.|circa|around|about|approximately|probably|possibly|perhaps|or)\s*{y}|{y}\s*(?:/|-|\u2013|or\b)\s*\d", s, re.I): return False
    box = W.infobox(title)
    for m in re.finditer(rf"^\s*\|\s*(?:{YEAR_FIELDS[prop]})\s*=\s*(.*)$", box, re.M | re.I):
        val = m.group(1)
        ys = [int(x) for x in re.findall(r"(?<!\d)(1\d{3}|20\d{2})(?!\d)", val)]
        if not ys: continue
        if re.search(r"\bc\.|\bca\.|circa|\?", val, re.I) or set(ys) != {y}: return False
    return True


def point_in_time(prop, items):
    """{(item, value): year} from each statement's point-in-time qualifier."""
    q = W.PREFIX + ("PREFIX pq: <http://www.wikidata.org/prop/qualifier/> "
                    f"SELECT ?item ?v ?t WHERE {{ VALUES ?item {{ {' '.join('wd:' + i for i in items)} }} ?item p:{prop} ?st . ?st psv:{prop} ?n . ?n wikibase:quantityAmount ?v . ?st pq:P585 ?t . }}")
    j = fetch_json(W.QL + urllib.parse.quote(q), headers={"Accept": "application/sparql-results+json"}, pause=2)
    out = {}
    for r in j["results"]["bindings"]:
        out[(r["item"]["value"].rsplit("/", 1)[-1], float(r["v"]["value"]))] = int(r["t"]["value"][:4])
    return out


COUNTS = ("episodes", "people", "minutes", "employees", "seats", "spectators")
KEYS = dict(W.KEYS, P2050=r"wingspan|\bspan\b", P1083=r"capacity", P1113=r"num_episodes", P2047=r"runtime|running time")


def confirm(txt, v, tol, prop, field_only=False):
    """A number within tol of v that the text gives for this measure: either the first number of an infobox
    field whose name names the measure, or, unless field_only, a number in prose right after such a word."""
    for m in re.finditer(r"\d[\d,]*\.?\d*", txt):
        back = txt[max(0, m.start() - 90): m.start()]
        fields = list(re.finditer(r"\|\s*([A-Za-z_][A-Za-z_ 0-9]*?)\s*=", back))
        if fields:
            f = fields[-1]
            if not re.search(KEYS[prop], f.group(1), re.I) or re.search(r"\d", back[f.end():]): continue
        elif field_only or not re.search(KEYS[prop], back, re.I): continue
        try: x = float(m.group(0).replace(",", ""))
        except ValueError: continue
        if v and abs(x - v) <= tol * abs(v) + 1e-9:
            return txt[max(0, m.start() - 70): m.end() + 40].replace("\n", " "), x
    return None, None

DATED = ("P1082", "P1128")
STANDING = "FILTER NOT EXISTS { ?item wdt:P576 ?gone } FILTER NOT EXISTS { ?item wdt:P582 ?ended } "


def quantity(fid, classes, prop, unit, div, question, cat, n, compare, *, span=2, scale="log", whole=False, extra="", lo=None, factors=None, standing=False, field_only=False, work=False):
    """Up to n questions: the value of prop for the most famous items of these classes."""
    cands = famous(classes, prop, n * 3, extra + (STANDING if standing else ""))
    W.load_claims(prop, [c[0] for c in cands], False)
    when = point_in_time(prop, [c[0] for c in cands]) if prop in DATED else {}
    got = []
    for q, title, links in chunks(cands):
        if len(got) >= n: break
        if have(f"wd-{W.slug(title)}-{prop.lower()}") or title not in W._articles or any(W.slug(g["title"]) == W.slug(title) or g["name"] == bare(title) for g in got): continue
        vals = []
        for s in W.best([s for s in W.statements(q, prop) if s["rank"] != "deprecated"]):
            if s["u"] not in W.UNIT: vals = None; break
            vals.append(float(s["v"]) * W.UNIT[s["u"]][1])
        if not vals or max(vals) - min(vals) > 0.02 * abs(max(vals)) or vals[0] <= 0: continue
        if grim(title) or (standing and gone(title)) or re.search(r"\bfamily\b|/", title): continue
        base = vals[0]
        year = None
        if prop in DATED:
            year = when.get((q, base))
            if not year or year < NOW - 12: continue
        txt = W.infobox(title) + "\n" + W.article(title)
        snip = None
        count = unit in COUNTS or whole
        for k in factors or ([1] if count or unit == "km²" else [1, .001, 100, 1 / .3048]):
            snip, _ = confirm(txt, base * k, 0 if count else 0.001, prop, field_only)
            if snip: break
        if not snip: continue
        v = base / div
        v = clean(round(v)) if whole or v >= 100 else clean(round(v, 2)) if v >= 1 else clean(float(f"{v:.3g}"))
        got.append(dict(q=q, title=title, name=named(title, work), label=bare(title), v=v, base=base, snip=snip, year=year))
    for i, g in enumerate(got):
        pool = shuffled("ref" + g["title"], got)
        ref = next((o for o in pool if o is not g and 1.6 <= max(o["v"] / g["v"], g["v"] / o["v"]) <= 25), None) or next((o for o in pool if o is not g and not 0.8 < o["v"] / g["v"] < 1.25), None)
        kw = dict(span=span, scale=scale, whole=whole)
        if lo is not None: kw["lo"] = lo
        add(f"wd-{W.slug(g['title'])}-{prop.lower()}", question(g["name"]), g["v"], unit, cat, difficulty=tier(i, len(got)), url=f"https://www.wikidata.org/wiki/{g['q']}#{prop}",
            source="Wikidata", licence=CC0, evidence=f"Wikidata {g['q']} {prop} = {g['base']:g} (base units). Wikipedia, {g['title']}: {g['snip'].strip()}",
            explainer=compare(g, ref), check=f"wd-num|{g['q']}|{prop}|{g['title']}", topic=f"m-{fid}", label=g["label"], as_of=f"In {g['year']}" if g["year"] else None, **kw)


def years(fid, classes, prop, question, cat, n, words, explain, extra="", work=False, skip=None):
    cands = famous(classes, prop, n * 3, extra)
    W.load_claims(prop, [c[0] for c in cands], True)
    got = []
    for q, title, links in chunks(cands):
        if len(got) >= n: break
        if have(f"yr-{W.slug(title)}-{prop.lower()}") or title not in W._articles or any(W.slug(g["title"]) == W.slug(title) or g["name"] == bare(title) for g in got): continue
        ys = [W.year_of(s) for s in W.best(W.statements(q, prop))]
        if not ys or None in ys: continue
        y = min(ys)
        if max(ys) - y > (2 if prop == "P577" else 0) or not 1000 <= y <= NOW - 1: continue
        if any(abs(int(x) - y) <= 60 for x in re.findall(r"(?<!\d)(1\d{3}|20\d{2})(?!\d)", title)) or grim(title) or "/" in title: continue
        s = W.sentence_with(re.sub(r"(?m)^\s*Category:.*$", "", W.article(title)), y, words)
        if not s or not year_ok(title, y, prop, s): continue
        if skip and skip(title): continue
        got.append(dict(q=q, title=title, name=named(title, work), label=bare(title), y=y, s=s, gone=gone(title)))
    for i, g in enumerate(got):
        add(f"yr-{W.slug(g['title'])}-{prop.lower()}", question(g["name"]), g["y"], "year", cat, scale="linear", span=150, difficulty=tier(i, len(got)),
            url=f"https://www.wikidata.org/wiki/{g['q']}#{prop}", source="Wikidata", licence=CC0, evidence=f"Wikidata {g['q']} {prop} = {g['y']}. Wikipedia, {g['title']}: {g['s'][:260]}",
            explainer=explain(g), check=f"wd-year|{g['q']}|{prop}|{g['title']}|{words}", hi=NOW, topic=f"y-{fid}", label=g["label"])


def cmp(unit_word):
    return lambda g, r: f"For comparison: {r['name']}, {fmt(r['v'])} {unit_word}." if r else f"That is {fmt(g['v'])} {unit_word}."


ago = lambda g: "That was last year." if NOW - g["y"] == 1 else f"That was {NOW - g['y']} years ago."
age = lambda g: ago(g) if g.get("gone") or NOW - g["y"] < 2 else f"That makes it about {NOW - g['y']} years old."


def wikidata_families():
    nb = lambda n: re.sub(r"^the ", "", n)
    jobs = [
        # Engineering
        lambda: quantity("sky", ["Q11303"], "P2048", "meters", 1, lambda n: f"How many meters tall {is_are(n)} {n}?", "Engineering", 30, cmp("meters"), span=2.8, standing=True),
        lambda: quantity("tower", ["Q11166728", "Q1440476"], "P2048", "meters", 1, lambda n: f"How many meters tall {is_are(n)} {n}?", "Engineering", 18, cmp("meters"), span=2.8, standing=True),
        lambda: quantity("bridge", ["Q12280", "Q158218", "Q158555"], "P2043", "meters", 1, lambda n: f"How many meters long is {n}?", "Engineering", 22, cmp("meters"), span=3, standing=True),
        lambda: quantity("dam", ["Q12323"], "P2048", "meters", 1, lambda n: f"How many meters tall is {n}?", "Engineering", 16, cmp("meters"), span=2.6, standing=True),
        lambda: quantity("tunnel", ["Q44377", "Q1311958"], "P2043", "km", 1000, lambda n: f"How many kilometers long is {n}?", "Engineering", 16, cmp("km"), span=2.6, standing=True),
        lambda: quantity("plane", ["Q15056995", "Q15056993"], "P2050", "meters", 1, lambda n: f"How many meters is the wingspan of {n}?", "Engineering", 22, cmp("meters"), span=2.4),
        # Geography
        lambda: quantity("mountain", ["Q8502"], "P2044", "meters", 1, lambda n: f"How many meters high is {n}?", "Geography", 26, cmp("meters"), span=2.4),
        lambda: quantity("volcano", ["Q8072", "Q212057", "Q169358"], "P2044", "meters", 1, lambda n: f"How many meters high is {n}?", "Geography", 18, cmp("meters"), span=2.4),
        lambda: quantity("river", ["Q4022"], "P2043", "km", 1000, lambda n: f"How many kilometers long is {n}?", "Geography", 26, cmp("km"), span=3),
        lambda: quantity("lake", ["Q23397", "Q188025"], "P2046", "km²", 1, lambda n: f"How many square kilometers does {n} cover?", "Geography", 20, cmp("km²"), span=3.4),
        lambda: quantity("island", ["Q23442"], "P2046", "km²", 1, lambda n: f"How many square kilometers is {n}?" if re.search(r"\b(Island|Isle)\b", n) else f"How many square kilometers is the island of {nb(n)}?", "Geography", 22, cmp("km²"), span=3.4),
        lambda: quantity("falls", ["Q34038"], "P2048", "meters", 1, lambda n: f"How many meters tall {is_are(n)} {n}?", "Geography", 14, cmp("meters"), span=2.6),
        lambda: quantity("city", ["Q1637706"], "P1082", "people", 1, lambda n: f"How many people live in the city of {nb(n)}?", "Geography", 28, cmp("people"), span=3, whole=True, standing=True),
        # Sports
        lambda: quantity("stadium", ["Q483110", "Q1154710", "Q641226"], "P1083", "spectators", 1, lambda n: f"How many spectators can {n} hold?", "Sports", 36, cmp("spectators"), span=2.4, whole=True, factors=[1], standing=True, field_only=True),
        lambda: years("club", ["Q476028"], "P571", lambda n: f"In what year was {n} founded?", "Sports", 40, "found|establish|formed", age),
        lambda: years("team", ["Q13393265", "Q17156793", "Q4498974"], "P571", lambda n: f"In what year was the {nb(n)} team founded?" if not n.endswith(("team", "Team")) else f"In what year was the {nb(n)} founded?", "Sports", 20, "found|establish|formed|franchise", age),
        # Books and art
        lambda: years("novel", ["Q7725634", "Q8261"], "P577", lambda n: f"In what year was {n} first published?", "Books and art", 40, "publish", ago, work=True, skip=lambda t: re.search(r"seriali[sz]|in serial|serial form|instal+ments", plain(lead(t)) + W.article(t)[:6000], re.I)),
        lambda: years("film", ["Q11424"], "P577", lambda n: f"In what year did the film {n} come out?", "Books and art", 34, "release|premiere|film", ago, work=True),
        lambda: quantity("runtime", ["Q11424"], "P2047", "minutes", 1, lambda n: f"How many minutes long is the film {n}?", "Books and art", 24, cmp("minutes"), span=1.6, whole=True, field_only=True, work=True),
        lambda: years("painting", ["Q3305213"], "P571", lambda n: f"In what year was {n} painted?" if n.startswith("the ") else f"In what year was the painting {n} made?", "Books and art", 24, "paint|complet|creat|work|made", ago, work=True),
        lambda: quantity("canvas", ["Q3305213"], "P2048", "cm", .01, lambda n: f"How many centimeters tall is {n}?" if n.startswith("the ") else f"How many centimeters tall is the painting {n}?", "Books and art", 18, cmp("cm"), span=2.4, work=True),
        lambda: years("album", ["Q482994", "Q208569"], "P577", lambda n: f"In what year did the album {n} come out?", "Books and art", 24, "release|album|record", ago, work=True),
        # Everyday life
        lambda: quantity("episodes", ["Q5398426", "Q581714"], "P1113", "episodes", 1, lambda n: f"How many episodes of {n} were made?", "Everyday life", 28, cmp("episodes"), span=2.6, whole=True, extra="?item wdt:P582 ?end .", field_only=True, work=True),
        lambda: years("brand", ["Q431289", "Q167270"], "P571", lambda n: f"In what year did {n} get its start?", "Everyday life", 26, "found|introduc|launch|creat|start|began|first", age),
        lambda: years("game", ["Q131436"], "P577", lambda n: f"In what year did the board game {n} come out?", "Everyday life", 16, "publish|release|first|invent|creat", ago, work=True),
        lambda: years("toy", ["Q11422"], "P571", lambda n: f"In what year was {n} first sold?", "Everyday life", 12, "introduc|invent|first|launch|creat|sold", ago),
        # Technology
        lambda: years("lang", ["Q9143"], "P571", lambda n: f"In what year did the {nb(n)} programming language first appear?" if "language" not in n.lower() else f"In what year did {n} first appear?", "Technology", 24, "appear|design|release|first|creat|develop", ago, skip=lambda t: "programming language" not in plain(lead(t)).lower()),
        lambda: years("console", ["Q8076", "Q941818"], "P577", lambda n: f"In what year did the {nb(n)} game console come out?", "Technology", 20, "release|launch", ago),
        lambda: years("site", ["Q35127"], "P571", lambda n: f"In what year did {n} launch?", "Technology", 20, "launch|found|start|creat|began", ago, skip=lambda t: not re.search(r"website|web site|online|social (?:media|network)|search engine|\bwiki\b|web (?:service|platform|application|mapping)", plain(lead(t))[:400], re.I) or re.search(r"newspaper|magazine|\bcity\b|\btown\b|television|\bTV\b|radio|corporation|conglomerate", plain(lead(t))[:400], re.I)),
        lambda: years("os", ["Q9135"], "P577", lambda n: f"In what year did {n} first come out?", "Technology", 12, "release|launch|first|introduc", ago),
        # History
        lambda: years("uni", ["Q3918", "Q902104"], "P571", lambda n: f"In what year was {n} founded?", "History", 34, "found|establish|charter", age),
        lambda: years("museum", ["Q33506", "Q207694"], "P571", lambda n: f"In what year was {n} founded?", "History", 22, "found|establish|open", age),
        # Space
        lambda: years("probe", ["Q26529", "Q2133344", "Q752783"], "P619", lambda n: f"In what year did {n} launch?", "Space", 26, "launch", ago),
        lambda: years("scope", ["Q148578"], "P619", lambda n: f"In what year did {n} launch?", "Space", 10, "launch", ago),
        lambda: years("exo", ["Q44559"], "P575", lambda n: f"In what year was the planet {n} found?", "Space", 12, "discover|announc|found|detect", ago),
        lambda: years("comet", ["Q3559"], "P575", lambda n: f"In what year was {n} discovered?", "Space", 10, "discover|found|spotted", ago),
        lambda: quantity("moon", ["Q2537"], "P2120", "km", 500, lambda n: f"How many kilometers wide is {n}?", "Space", 20, cmp("km"), span=3),
        # Money
        lambda: years("company", ["Q4830453", "Q891723", "Q6881511"], "P571", lambda n: f"In what year was {n} founded?", "Money", 34, "found|establish|began|start", age),
        lambda: quantity("staff", ["Q4830453", "Q891723", "Q6881511"], "P1128", "employees", 1, lambda n: f"How many employees does {n} have?", "Money", 24, cmp("employees"), span=3, whole=True, standing=True),
    ]
    for i, job in enumerate(jobs):
        attempt(f"wd-family-{i}", job)


# ------------------------------------------------------------------ World Bank, every country at once

COUNTRIES = {
    "USA": "the United States", "CHN": "China", "IND": "India", "IDN": "Indonesia", "PAK": "Pakistan", "NGA": "Nigeria", "BRA": "Brazil", "BGD": "Bangladesh", "RUS": "Russia", "MEX": "Mexico",
    "JPN": "Japan", "ETH": "Ethiopia", "PHL": "the Philippines", "EGY": "Egypt", "VNM": "Vietnam", "TUR": "Turkey", "IRN": "Iran", "DEU": "Germany", "THA": "Thailand", "GBR": "the United Kingdom",
    "FRA": "France", "ITA": "Italy", "ZAF": "South Africa", "TZA": "Tanzania", "KEN": "Kenya", "KOR": "South Korea", "COL": "Colombia", "ESP": "Spain", "ARG": "Argentina", "DZA": "Algeria",
    "IRQ": "Iraq", "CAN": "Canada", "POL": "Poland", "MAR": "Morocco", "UKR": "Ukraine", "SAU": "Saudi Arabia", "PER": "Peru", "MYS": "Malaysia", "GHA": "Ghana", "NPL": "Nepal",
    "AUS": "Australia", "CHL": "Chile", "NLD": "the Netherlands", "SWE": "Sweden", "CHE": "Switzerland", "NOR": "Norway", "DNK": "Denmark", "FIN": "Finland", "ISL": "Iceland", "IRL": "Ireland",
    "NZL": "New Zealand", "PRT": "Portugal", "GRC": "Greece", "BEL": "Belgium", "AUT": "Austria", "ISR": "Israel", "SGP": "Singapore", "ARE": "the United Arab Emirates", "QAT": "Qatar", "CUB": "Cuba",
    "JAM": "Jamaica", "MNG": "Mongolia", "KAZ": "Kazakhstan", "CZE": "Czechia", "HUN": "Hungary", "ROU": "Romania", "LKA": "Sri Lanka", "KHM": "Cambodia", "BOL": "Bolivia", "ECU": "Ecuador",
    "URY": "Uruguay", "CRI": "Costa Rica", "PAN": "Panama", "LUX": "Luxembourg", "MLT": "Malta", "FJI": "Fiji", "BTN": "Bhutan", "MDG": "Madagascar", "ZWE": "Zimbabwe", "RWA": "Rwanda",
}
_wb = {}


def wb_all(ind):
    if ind not in _wb:
        econ = fetch_json("https://api.worldbank.org/v2/country?format=json&per_page=400")[1]
        real = {c["id"] for c in econ if c["region"]["id"] != "NA"}
        rows = fetch_json(f"https://api.worldbank.org/v2/country/all/indicator/{ind}?format=json&mrnev=1&per_page=500")[1]
        _wb[ind] = ({r["countryiso3code"]: (r["value"], r["date"]) for r in rows if r["value"] is not None and r["countryiso3code"] in real},
                    next(((r["value"], r["date"]) for r in rows if r["countryiso3code"] == "WLD" and r["value"] is not None), None))
    return _wb[ind]


def worldbank(fid, ind, question, unit, cat, n, *, digits=None, span=None, scale="log", lo=None, hi=None, world=None, d=2):
    vals, wld = wb_all(ind)
    order = sorted(vals, key=lambda k: -vals[k][0])
    seen = texts()
    picked = []
    for iso in shuffled(fid, COUNTRIES):
        if len(picked) >= n: break
        if iso not in vals: continue
        qtext = question(COUNTRIES[iso])
        qtext = qtext[0].upper() + qtext[1:]
        if qtext.lower() in seen or have(f"wb-{fid}-{iso.lower()}"): continue
        picked.append((iso, qtext))
    for iso, qtext in picked:
        v, year = vals[iso]
        v = clean(round(v, digits)) if digits is not None else clean(round(v))
        name = COUNTRIES[iso]
        rank = order.index(iso) + 1
        ex = f"{name[0].upper() + name[1:]} ranks {ordinal(rank)} of {len(order)} countries."
        if world and wld: ex += f" {world(wld[0])}"
        kw = dict(scale=scale)
        if span: kw["span"] = span
        if lo is not None: kw["lo"] = lo
        if hi is not None: kw["hi"] = hi
        add(f"wb-{fid}-{iso.lower()}", qtext, v, unit, cat, difficulty=d if iso not in ("USA", "CHN", "IND", "JPN", "GBR", "FRA", "DEU", "BRA", "CAN", "AUS") else max(1, d - 1),
            url=f"https://data.worldbank.org/indicator/{ind}?locations={iso}", source="World Bank Open Data", licence=CCBY, evidence=f"World Bank API {iso} {ind}, {year}: {v}",
            explainer=ex, as_of=f"In {year}", check=f"wb|{ind}|{iso}", topic="wb-SP.POP" if ind == "SP.POP.TOTL" else "wb-" + ind, label=re.sub(r"^the ", "", name).replace("United States", "US").replace("United Kingdom", "UK"), **kw)


def worldbank_families():
    pct = dict(digits=1, scale="linear", span=100, lo=0, hi=100)
    jobs = [
        lambda: worldbank("pop", "SP.POP.TOTL", lambda c: f"How many people live in {c}?", "people", "Geography", 26, span=4),
        lambda: worldbank("area", "AG.SRF.TOTL.K2", lambda c: f"How many square kilometers does {c} cover?", "km²", "Geography", 22, span=4),
        lambda: worldbank("forest", "AG.LND.FRST.ZS", lambda c: f"What percent of {c} is forest?", "%", "Geography", 22, world=lambda w: f"The world figure is {w:.0f}%.", **pct),
        lambda: worldbank("urban", "SP.URB.TOTL.IN.ZS", lambda c: f"What percent of people in {c} live in towns and cities?", "%", "Geography", 18, world=lambda w: f"The world figure is {w:.0f}%.", **pct),
        lambda: worldbank("density", "EN.POP.DNST", lambda c: f"On average, how many people live on each square kilometer of {c}?", "people", "Geography", 16, span=3.4, world=lambda w: f"The world average is {w:.0f}."),
        lambda: worldbank("gdppc", "NY.GDP.PCAP.CD", lambda c: f"How many US dollars of goods and services does {c} produce per person in a year?", "US dollars", "Money", 26, span=3, world=lambda w: f"The world figure is ${fmt(round(w))}."),
        lambda: worldbank("gdp", "NY.GDP.MKTP.CD", lambda c: f"How many US dollars is the whole economy of {c} worth in a year?", "US dollars", "Money", 18, span=4),
        lambda: worldbank("life", "SP.DYN.LE00.IN", lambda c: f"How many years can a newborn in {c} expect to live?", "years", "Human body", 24, digits=1, scale="linear", span=60, lo=20, world=lambda w: f"The world figure is {w:.0f} years."),
        lambda: worldbank("births", "SP.DYN.TFRT.IN", lambda c: f"On average, how many children does a woman in {c} have?", "children", "Human body", 22, digits=2, scale="linear", span=8, lo=0, world=lambda w: f"The world figure is {w:.1f}."),
        lambda: worldbank("old", "SP.POP.65UP.TO.ZS", lambda c: f"What percent of people in {c} are 65 or older?", "%", "Human body", 20, world=lambda w: f"The world figure is {w:.0f}%.", **pct),
        lambda: worldbank("young", "SP.POP.0014.TO.ZS", lambda c: f"What percent of people in {c} are under 15?", "%", "Human body", 16, world=lambda w: f"The world figure is {w:.0f}%.", **pct),
        lambda: worldbank("smoke", "SH.PRV.SMOK", lambda c: f"What percent of adults in {c} smoke?", "%", "Human body", 16, world=lambda w: f"The world figure is {w:.0f}%.", **pct),
        lambda: worldbank("net", "IT.NET.USER.ZS", lambda c: f"What percent of people in {c} use the internet?", "%", "Technology", 24, world=lambda w: f"The world figure is {w:.0f}%.", **pct),
        lambda: worldbank("phones", "IT.CEL.SETS.P2", lambda c: f"How many mobile phone subscriptions are there for every 100 people in {c}?", "subscriptions", "Technology", 14, digits=0, scale="linear", span=250, lo=0, world=lambda w: f"The world figure is {w:.0f}."),
        lambda: worldbank("flyers", "IS.AIR.PSGR", lambda c: f"How many passengers do airlines based in {c} carry in a year?", "passengers", "Everyday life", 16, span=4),
        lambda: worldbank("farm", "AG.LND.AGRI.ZS", lambda c: f"What percent of the land in {c} is used for farming?", "%", "Food", 14, world=lambda w: f"The world figure is {w:.0f}%.", **pct),
    ]
    for i, job in enumerate(jobs):
        attempt(f"wb-family-{i}", job)


# ------------------------------------------------------------------ the periodic table

PT = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/CSV"
ELEMENTS = ["Hydrogen", "Helium", "Lithium", "Beryllium", "Boron", "Carbon", "Nitrogen", "Oxygen", "Fluorine", "Neon", "Sodium", "Magnesium", "Aluminum", "Silicon", "Phosphorus", "Sulfur", "Chlorine", "Argon",
            "Potassium", "Calcium", "Titanium", "Chromium", "Manganese", "Iron", "Cobalt", "Nickel", "Copper", "Zinc", "Gallium", "Arsenic", "Bromine", "Krypton", "Strontium", "Zirconium", "Silver", "Tin",
            "Iodine", "Xenon", "Cesium", "Barium", "Neodymium", "Tungsten", "Platinum", "Gold", "Mercury", "Lead", "Bismuth", "Radon", "Radium", "Uranium", "Plutonium", "Cadmium", "Cobalt", "Lithium"]


def elements():
    rows = {r["Name"]: r for r in csv.DictReader(io.StringIO(fetch(PT)))}
    seen = texts()
    url = "https://pubchem.ncbi.nlm.nih.gov/periodic-table/"
    names = list(dict.fromkeys(ELEMENTS))

    def add_el(id, name, field, q, v, unit, cat, ex, d, **k):
        if have(id) or q.lower() in seen: return
        add(id, q, v, unit, cat, difficulty=d, url=url, source="PubChem, NIH", licence=PD, evidence=f"PubChem periodic table CSV: {name} {field} = {rows[name][field]}", explainer=ex,
            check=f"pubchem|{name}|{field}", topic=f"el-{field[:4].lower()}", label=name, **k)

    for i, nm in enumerate(shuffled("melt", names)[:28]):
        r = rows.get(nm)
        if not r or not r["MeltingPoint"] or not r["BoilingPoint"] or nm in ("Carbon", "Arsenic"): continue
        m, b = float(r["MeltingPoint"]) - 273.15, float(r["BoilingPoint"]) - 273.15
        add_el(f"el-{nm.lower()}-melt", nm, "MeltingPoint", f"At what temperature does {nm.lower()} melt, in degrees Celsius?", clean(round(m, 1)), "°C", "Math and science", f"It boils at {fmt(round(b))}°C.", 2 if m > 0 else 3, scale="linear", span=1000, lo=-273.15)
        add_el(f"el-{nm.lower()}-boil", nm, "BoilingPoint", f"At what temperature does {nm.lower()} boil, in degrees Celsius?", clean(round(b, 1)), "°C", "Math and science", f"It melts at {fmt(round(m))}°C.", 3, scale="linear", span=1000, lo=-273.15)
    for nm in shuffled("dens", names)[:30]:
        r = rows.get(nm)
        if not r or not r["Density"] or not r["MeltingPoint"] or float(r["MeltingPoint"]) < 230: continue
        dn = float(r["Density"])
        add_el(f"el-{nm.lower()}-dens", nm, "Density", f"How many grams does one cubic centimeter of {nm.lower()} weigh?", clean(dn), "grams", "Math and science", f"That makes it {times(dn, 1)} times as heavy as the same amount of water." if dn > 1.05 else "About as heavy as the same amount of water, or lighter.", 3, span=2.4)
        y = r["YearDiscovered"]
        if y and y.isdigit() and 1000 <= int(y) < NOW:
            add_el(f"el-{nm.lower()}-year", nm, "YearDiscovered", f"In what year was {nm.lower()} discovered?", int(y), "year", "History", f"It is element number {r['AtomicNumber']}, written {r['Symbol']}.", 3, scale="linear", span=150, hi=NOW)


# ------------------------------------------------------------------ foods

FOODS = {
    "Almond butter, creamy": "almond butter", "Apples, fuji, with skin, raw": "Fuji apples", "Avocado, Hass, peeled, raw": "avocado", "Bananas, ripe and slightly ripe, raw": "ripe bananas",
    "Blackberries, raw": "blackberries", "Blueberries, raw": "blueberries", "Bread, white, commercially prepared": "white bread", "Bread, whole-wheat, commercially prepared": "whole wheat bread",
    "Broccoli, raw": "raw broccoli", "Brussels sprouts, raw": "raw Brussels sprouts", "Butter, stick, salted": "salted butter", "Cabbage, green, raw": "green cabbage", "Carrots, mature, raw": "raw carrots",
    "Cauliflower, raw": "raw cauliflower", "Cheese, cheddar": "cheddar cheese", "Cheese, parmesan, grated": "grated parmesan", "Cheese, swiss": "Swiss cheese", "Cheese, feta, whole milk, crumbled": "feta cheese",
    "Cherries, sweet, dark red, raw": "sweet cherries", "Chia seeds, dry, raw": "chia seeds", "Chicken, breast, boneless, skinless, raw": "raw skinless chicken breast", "Cream, heavy": "heavy cream",
    "Cucumber, with peel, raw": "cucumber", "Eggs, Grade A, Large, egg whole": "whole eggs", "Eggs, Grade A, Large, egg white": "egg whites", "Eggs, Grade A, Large, egg yolk": "egg yolks",
    "Fish, cod, Atlantic, wild caught, raw": "raw Atlantic cod", "Fish, salmon, Atlantic, farm raised, raw": "raw farmed Atlantic salmon", "Fish, tuna, light, canned in water, drained solids": "canned light tuna",
    "Garlic, raw": "raw garlic", "Grapes, red, seedless, raw": "red grapes", "Hummus, commercial": "hummus", "Kale, raw": "raw kale", "Ketchup, restaurant": "ketchup", "Kiwifruit, green, raw": "green kiwifruit",
    "Lentils, dry": "dry lentils", "Lettuce, iceberg, raw": "iceberg lettuce", "Mango, Tommy Atkins, peeled, raw": "mango", "Melons, cantaloupe, raw": "cantaloupe", "Milk, whole, 3.25% milkfat, with added vitamin D": "whole milk",
    "Mushrooms, white button": "white button mushrooms", "Nuts, almonds, whole, raw": "raw almonds", "Nuts, brazilnuts, raw": "Brazil nuts", "Nuts, cashew nuts, raw": "raw cashews", "Nuts, macadamia nuts, raw": "macadamia nuts",
    "Nuts, pecans, halves, raw": "pecans", "Nuts, pistachio nuts, raw": "pistachios", "Nuts, walnuts, English, halves, raw": "walnuts", "Oats, whole grain, rolled, old fashioned": "rolled oats",
    "Oil, olive, extra virgin": "extra virgin olive oil", "Onions, yellow, raw": "yellow onions", "Oranges, raw, navels": "navel oranges", "Orange juice, no pulp, not fortified, not from concentrate, refrigerated": "orange juice",
    "Peaches, yellow, raw": "yellow peaches", "Peanut butter, creamy": "creamy peanut butter", "Peanuts, raw": "raw peanuts", "Pears, raw, bartlett": "Bartlett pears", "Peppers, bell, red, raw": "red bell peppers",
    "Peppers, bell, green, raw": "green bell peppers", "Pineapple, raw": "pineapple", "Pork, cured, bacon, cooked, restaurant": "cooked bacon", "Potatoes, russet, without skin, raw": "raw russet potatoes",
    "Raspberries, raw": "raspberries", "Rice, white, long grain, unenriched, raw": "uncooked white rice", "Rice, brown, long grain, unenriched, raw": "uncooked brown rice", "Spinach, mature": "spinach",
    "Strawberries, raw": "strawberries", "Sugars, granulated": "white sugar", "Sweet potatoes, orange flesh, without skin, raw": "raw sweet potatoes", "Tomato, roma": "Roma tomatoes",
    "Seeds, pumpkin seeds (pepitas), raw": "pumpkin seeds", "Seeds, sunflower seed, kernel, raw": "sunflower seeds", "Squash, winter, butternut, raw": "butternut squash", "Squash, summer, green, zucchini, includes skin, raw": "zucchini",
    "Cheese, mozzarella, low moisture, part-skim": "part-skim mozzarella", "Cream cheese, full fat, block": "cream cheese", "Beef, ground, 80% lean meat / 20% fat, raw": "raw 80% lean ground beef",
    "Plantains, ripe, raw": "ripe plantains", "Flaxseed, ground": "ground flaxseed", "Figs, dried, uncooked": "dried figs", "Oat milk, unsweetened, plain, refrigerated": "unsweetened oat milk",
    "Soy milk, unsweetened, plain, shelf stable": "unsweetened soy milk", "Tomato, paste, canned, without salt added": "tomato paste", "Salt, table, iodized": "iodized table salt",
}
NUTS = [
    # family, nutrient, unit as asked, question, unit word, count, difficulty
    ("kcal", "Energy", "KCAL", lambda f: f"How many calories are in 100 grams of {f}?", "calories", 22, 2),
    ("prot", "Protein", None, lambda f: f"How many grams of protein are in 100 grams of {f}?", "grams", 16, 2),
    ("fat", "Total lipid (fat)", None, lambda f: f"How many grams of fat are in 100 grams of {f}?", "grams", 14, 2),
    ("sugar", "Sugars, Total", None, lambda f: f"How many grams of sugar are in 100 grams of {f}?", "grams", 14, 2),
    ("fiber", "Fiber, total dietary", None, lambda f: f"How many grams of fiber are in 100 grams of {f}?", "grams", 12, 3),
    ("vitc", "Vitamin C, total ascorbic acid", None, lambda f: f"How many milligrams of vitamin C are in 100 grams of {f}?", "mg", 12, 3),
    ("potas", "Potassium, K", None, lambda f: f"How many milligrams of potassium are in 100 grams of {f}?", "mg", 10, 3),
    ("water", "Water", None, lambda f: f"How many grams of water are in 100 grams of {f}?", "grams", 12, 2),
    ("sodium", "Sodium, Na", None, lambda f: f"How many milligrams of sodium are in 100 grams of {f}?", "mg", 10, 3),
]


def foods():
    data = s_food.foods()
    seen = texts()

    def value(desc, nutrient, unit):
        fd = data.get(desc)
        if not fd: return None
        for n in fd["foodNutrients"]:
            if n["nutrient"]["name"].startswith(nutrient) and (unit is None or n["nutrient"]["unitName"] == unit) and n.get("amount") is not None:
                return n["amount"], fd
        return None

    for fam, nutrient, unit, question, word, n, d in NUTS:
        have_it = [(desc, nice, value(desc, nutrient, unit)) for desc, nice in FOODS.items()]
        have_it = [(desc, nice, v[0], v[1]) for desc, nice, v in have_it if v and v[0] > 0]
        if not have_it: continue
        ref_desc, ref_nice, ref_v, _ = min(have_it, key=lambda x: abs(math.log(x[2] / sorted(y[2] for y in have_it)[len(have_it) // 2])))
        done = 0
        for desc, nice, v, fd in shuffled(fam, have_it):
            if done >= n: break
            q = question(nice)
            if q.lower() in seen or have(f"fo-{fam}-{W.slug(nice)}"): continue
            other = next((x for x in shuffled(fam + desc, have_it) if x[0] != desc and not 0.7 < x[2] / v < 1.4), None)
            ex = f"For comparison, 100 grams of {other[1]} has {fmt(sig(other[2]))} {'mg' if word == 'mg' else word}." if other else f"That is {fmt(sig(v))} {word}."
            add(f"fo-{fam}-{W.slug(nice)}", q, sig(v), word, "Food", difficulty=d, url=f"https://fdc.nal.usda.gov/food-details/{fd['fdcId']}/nutrients",
                source="USDA FoodData Central", licence=CC0, evidence=f"FoodData Central {fd['fdcId']} ({desc}): {nutrient} = {v}", explainer=ex, check=f"fdc|{fd['fdcId']}|{nutrient}",
                topic=f"fo-{fam}", label=nice[0].upper() + nice[1:], span=2.4)
            done += 1


# ------------------------------------------------------------------ animals

ANIMALS = ["African elephant", "Asian elephant", "Giraffe", "Hippopotamus", "Lion", "Tiger", "Leopard", "Cheetah", "Jaguar", "Gray wolf", "Red fox", "Brown bear", "Polar bear", "Giant panda",
           "Koala", "Red kangaroo", "Common wombat", "Platypus", "Chimpanzee", "Western gorilla", "Bornean orangutan", "Ring-tailed lemur", "House mouse", "Brown rat", "European rabbit", "Eastern gray squirrel",
           "North American beaver", "Capybara", "Domestic cat", "Domestic dog", "Horse", "Donkey", "Cattle", "Goat", "Sheep", "Pig", "Llama", "Dromedary camel", "Bactrian camel", "Moose",
           "Reindeer", "White-tailed deer", "American bison", "Zebra", "Plains zebra", "White rhinoceros", "Black rhinoceros", "Blue whale", "Humpback whale", "Killer whale", "Bottlenose dolphin",
           "Sperm whale", "Walrus", "Harbor seal", "California sea lion", "Sea otter", "Three-toed sloth", "Giant anteater", "Nine-banded armadillo", "Hedgehog", "Common vampire bat", "Little brown bat",
           "Ostrich", "Emu", "Emperor penguin", "Bald eagle", "Golden eagle", "Peregrine falcon", "Barn owl", "Snowy owl", "Mallard", "Mute swan", "Canada goose", "Chicken", "Wild turkey", "Common raven",
           "Blue jay", "American robin", "House sparrow", "Budgerigar", "Ruby-throated hummingbird", "American flamingo", "Greater flamingo", "Atlantic puffin", "Albatross", "Wandering albatross",
           "American alligator", "Nile crocodile", "Saltwater crocodile", "Komodo dragon", "Green iguana", "Galapagos tortoise", "Leatherback sea turtle", "Green sea turtle", "Box turtle", "King cobra",
           "Reticulated python", "Green anaconda", "Common garter snake", "American bullfrog", "Axolotl", "Great white shark", "Whale shark", "Atlantic salmon", "Goldfish", "Common carp", "Rainbow trout"]
BREEDS = {"Domestic dog", "Domestic cat", "Horse", "Donkey", "Cattle", "Goat", "Sheep", "Pig", "Llama", "Chicken", "European rabbit", "Budgerigar", "Goldfish"}
PROPER = {"African", "Asian", "American", "Atlantic", "California", "Canada", "Galapagos", "Komodo", "Nile", "North", "Eastern", "Western", "Bornean", "Bactrian", "European"}
FIELDS = [
    # family, AnAge field, question, unit, factor, span, how many
    ("life", s_animals.LONG, lambda a: f"What is the longest {a} is known to have lived, in years?", "years", 1, 2.6, 30),
    ("mass", s_animals.AW, lambda a: f"How many kilograms does an adult {a[2:] if a.startswith('a ') else a[3:]} weigh?", "kg", .001, 3.4, 30),
    ("preg", s_animals.GEST, lambda a: f"How many days does {a} carry its young before birth or hatching?", "days", 1, 2.6, 26),
    ("litter", s_animals.LIT, lambda a: f"How many young does {a} usually have at once?", "young", 1, 2.4, 16),
]


def animal_name(c):
    first = c.split()[0]
    return c if first in PROPER else first.lower() + c[len(first):]


def with_a(name):
    vowel = name[0].lower() in "aeiou" and not name.lower().startswith(("eu", "uni", "use", "one"))
    return ("an " if vowel else "a ") + name


def animals():
    t = s_animals.table()
    by_common = {}
    for sp, r in t.items():
        c = (r.get("Common name") or "").strip()
        if c and c.lower() not in by_common: by_common[c.lower()] = (sp, r)
    seen = texts()
    for fam, field, question, unit, factor, span, cap in FIELDS:
        rows = []
        for c in ANIMALS:
            hit = by_common.get(c.lower())
            if not hit: continue
            sp, r = hit
            try: v = float(r[field])
            except (TypeError, ValueError): continue
            if v <= 0 or (r.get("Data quality") or "").lower() in ("low", "questionable"): continue
            if fam == "litter" and v < 1.5: continue
            if fam == "mass" and (r.get("Class") not in ("Mammalia", "Aves") or c in BREEDS): continue  # AnAge gives near-record weights for fish and reptiles
            rows.append((c, sp, v * factor, r[field]))
        done = 0
        for c, sp, v, raw in shuffled(fam, rows):
            if done >= cap: break
            name = animal_name(c)
            u, val, q = unit, v, question(with_a(name))
            if fam == "mass" and v < 1:
                u, val, q = "grams", v * 1000, q.replace("How many kilograms", "How many grams")
            if q.lower() in seen or have(f"an-{fam}-{W.slug(c)}"): continue
            near = [x for x in shuffled(fam + c, rows) if x[0] != c and 1.6 <= max(x[2] / v, v / x[2]) <= 25]
            other = near[0] if near else next((x for x in shuffled(fam + c, rows) if x[0] != c and not 0.6 < x[2] / v < 1.6), None)
            if other:
                ou, ov = (unit, other[2]) if not (fam == "mass" and other[2] < 1) else ("grams", other[2] * 1000)
                ex = f"For comparison: the {animal_name(other[0])}, {fmt(sig(ov))} {ou}."
            else:
                ex = f"That is {fmt(sig(val))} {u}."
            add(f"an-{fam}-{W.slug(c)}", q, sig(val), u, "Animals", difficulty=2 if done % 3 else 3,
                url=f"https://genomics.senescence.info/species/entry.php?species={sp.replace(' ', '_')}", source="AnAge", licence="CC BY 3.0",
                evidence=f"AnAge {sp} ({c}): {field} = {raw}", explainer=ex, check=f"anage|{sp}|{field}", topic=f"an-{fam}", label=c, span=span)
            done += 1


def run():
    attempt("more-wikidata", wikidata_families)
    attempt("more-worldbank", worldbank_families)
    attempt("more-elements", elements)
    attempt("more-foods", foods)
    attempt("more-animals", animals)
