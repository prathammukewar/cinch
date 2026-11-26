import csv, io
from lib import *

T = "Technology"


def web():
    t = fetch("https://unicode.org/Public/emoji/latest/emoji-test.txt")
    n = len(re.findall(r"(?m)^[0-9A-F][0-9A-F ]*;\s*fully-qualified", t))
    ver = re.search(r"# Version: (\S+)", t).group(1)
    add("te-emoji", "How many emoji are there, counting every skin tone and flag?", n, "emoji", T, span=4, difficulty=2, as_of=f"Unicode Emoji {ver}", url="https://unicode.org/Public/emoji/latest/emoji-test.txt", source="Unicode Consortium", licence="Unicode License v3", evidence=f"emoji-test.txt version {ver}: {n} lines marked fully-qualified", explainer="Most of the growth comes from combining people, hair and skin tones.", check="emoji")
    f = len(re.findall(r"(?m)^[0-9A-F][0-9A-F ]*;\s*fully-qualified\s+#.*flag: ", t))
    add("te-flags", "How many country and region flag emoji are there?", f, "flags", T, span=3, difficulty=2, as_of=f"Unicode Emoji {ver}", url="https://unicode.org/Public/emoji/latest/emoji-test.txt", source="Unicode Consortium", licence="Unicode License v3", evidence=f"emoji-test.txt version {ver}: {f} fully-qualified lines named 'flag: ...'", explainer="That includes England, Scotland and Wales, plus islands almost nobody lives on.", check="flags")
    t = fetch("https://data.iana.org/TLD/tlds-alpha-by-domain.txt")
    L = [l for l in t.split("\n") if l and not l.startswith("#")]
    add("te-tlds", "How many internet endings like .com, .org and .uk exist?", len(L), "endings", T, span=4, difficulty=2, as_of="November 2026", url="https://data.iana.org/TLD/tlds-alpha-by-domain.txt", source="IANA", licence=FACT, evidence=f"tlds-alpha-by-domain.txt, {t.split(chr(10))[0]}: {len(L)} entries", explainer="It jumped after 2013, when almost anyone could apply to run a new one." if False else "Companies and cities run many of them, including .google and .nyc.", check="tlds")
    s = fetch_json("https://en.wikipedia.org/w/api.php?action=query&meta=siteinfo&siprop=statistics&format=json")["query"]["statistics"]
    add("te-wiki-articles", "How many articles does English Wikipedia have?", s["articles"], "articles", T, span=4, difficulty=1, as_of="November 2026", url="https://en.wikipedia.org/wiki/Special:Statistics", source="Wikipedia", licence=FACT, evidence=f"siteinfo statistics: articles {s['articles']}", explainer=f"They have been edited {fmt(s['edits'])} times.", check="wiki-articles")
    add("te-wiki-edits", "How many edits have been made to English Wikipedia?", s["edits"], "edits", T, span=5, difficulty=2, as_of="November 2026", url="https://en.wikipedia.org/wiki/Special:Statistics", source="Wikipedia", licence=FACT, evidence=f"siteinfo statistics: edits {s['edits']}", explainer=f"That works out to about {fmt(s['edits']/s['articles'],0)} per article, though talk pages count too.", check="wiki-edits")
    if s.get("cirrussearch-article-words"):
        w = s["cirrussearch-article-words"]
        add("te-wiki-words", "How many words are in all of English Wikipedia's articles?", w, "words", T, span=5, difficulty=2, as_of="November 2026", url="https://en.wikipedia.org/wiki/Special:Statistics", source="Wikipedia", licence=FACT, evidence=f"siteinfo statistics: cirrussearch-article-words {w}", explainer=f"Reading at 250 words a minute without sleep, it would take about {fmt(w/250/1440/365.25,0)} years.", check="wiki-words")
    r = re.findall(r"(?m)^(\d{4,5}) ", fetch("https://www.rfc-editor.org/rfc-index.txt"))
    add("te-rfcs", "The documents that describe how the internet works, called RFCs, are numbered in order. What number has the newest one reached?", int(r[-1]), "", T, span=4, difficulty=3, as_of="November 2026", url="https://www.rfc-editor.org/rfc-index.txt", source="RFC Editor", licence=FACT, evidence=f"rfc-index.txt last number {r[-1]}", explainer="One of them describes sending internet traffic by carrier pigeon.", check="rfc")


def pageviews():
    for art, q, ex, d in [
        ("Pizza", "How many times was Wikipedia's page about pizza opened in 2025?", "It is steady all year, with no season for pizza.", 2),
        ("Rubik's_Cube", "How many times was Wikipedia's page about the Rubik's Cube opened in 2025?", "New speed records send readers back to it.", 2),
        ("Albert_Einstein", "How many times was Wikipedia's page about Albert Einstein opened in 2025?", "He is among the most looked-up scientists there.", 1),
        ("Capybara", "How many times was Wikipedia's page about capybaras opened in 2025?", "The internet has grown very fond of them.", 2),
        ("Shrek", "How many times was Wikipedia's page about the movie Shrek opened in 2025?", "A movie can stay popular for decades if it becomes a joke.", 2),
        ("Chess", "How many times was Wikipedia's page about chess opened in 2025?", "It was one of the first games a computer was taught to play well.", 2),
        ("Dinosaur", "How many times was Wikipedia's page about dinosaurs opened in 2025?", "Birds are counted as dinosaurs there too.", 2),
        ("Coffee", "How many times was Wikipedia's page about coffee opened in 2025?", "The drink is among the most traded farm goods in the world.", 2),
        ("Leonardo_da_Vinci", "How many times was Wikipedia's page about Leonardo da Vinci opened in 2025?", "He finished surprisingly few paintings.", 1),
        ("Titanic", "How many times was Wikipedia's page about the ship Titanic opened in 2025?", "It is one of the longest-running favorites on the site.", 2),
        ("Elvis_Presley", "How many times was Wikipedia's page about Elvis Presley opened in 2025?", "He never toured outside North America.", 2),
        ("Moon", "How many times was Wikipedia's page about the Moon opened in 2025?", "Views jump whenever there is an eclipse.", 2),
        ("Sudoku", "How many times was Wikipedia's page about sudoku opened in 2025?", "The puzzle got its start in the United States under another name.", 3),
        ("Axolotl", "How many times was Wikipedia's page about axolotls opened in 2025?", "It is nearly extinct in the wild and common in fish tanks.", 2),
    ]:
        def go():
            u = f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/{art.replace(chr(39), '%27')}/monthly/2025010100/2025123100"
            it = fetch_json(u)["items"]
            if len(it) != 12: raise LookupError(len(it))
            v = sum(i["views"] for i in it)
            add("te-pv-" + art.lower().replace("_", "").replace("'", ""), q, v, "views", T, span=4.4, difficulty=d, url="https://pageviews.wmcloud.org/?project=en.wikipedia.org&platform=all-access&agent=user&start=2025-01&end=2025-12&pages=" + art.replace("'", "%27"), source="Wikimedia pageviews", licence=CC0, evidence=f"pageviews API {art}, all-access, user, 12 months of 2025 sum to {v}", explainer=ex, check=f"pv|{art}", topic="te-pv")
        attempt("te-pv-" + art, go)


def code():
    j = fetch_json("https://crates.io/api/v1/summary")
    add("te-crates", "How many open-source packages have been published for the Rust programming language?", j["num_crates"], "packages", T, span=5, difficulty=3, as_of="November 2026", url="https://crates.io/", source="crates.io", licence=FACT, evidence=f"crates.io summary num_crates = {j['num_crates']}", explainer="The site calls each package a crate.", check="crates")


def run():
    for f in (web, pageviews, code):
        attempt(f"tech.{f.__name__}", f)
