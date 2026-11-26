from lib import *

MIRROR = "https://gutenberg.pglaf.org"
BOOKS = [
    (2701, "Moby-Dick", "moby", "Melville's chapters on whale anatomy are part of why.", 2),
    (1342, "Pride and Prejudice", "pride", "At a steady pace that is about eight hours of reading.", 2),
    (11, "Alice's Adventures in Wonderland", "alice", "It is short enough to read in an afternoon.", 2),
    (84, "Frankenstein", "frank", "It is shorter than most modern thrillers.", 2),
    (98, "A Tale of Two Cities", "tale", "It first came out in weekly parts.", 2),
    (2600, "War and Peace", "war", "The translation counted here is the classic one by the Maudes.", 2),
    (46, "A Christmas Carol", "carol", "Dickens read it aloud on stage for years.", 2),
    (120, "Treasure Island", "treasure", "It gave us the parrot, the map and the one-legged pirate.", 3),
    (345, "Dracula", "dracula", "The count himself appears on surprisingly few pages.", 3),
    (55, "The Wonderful Wizard of Oz", "oz", "The trip down the road takes up most of it.", 3),
    (5200, "Metamorphosis", "meta", "The bug is there from the first sentence.", 3),
    (35, "The Time Machine", "time", "It made the phrase itself famous.", 3),
    (76, "Adventures of Huckleberry Finn", "huck", "It was written in several dialects on purpose.", 2),
    (174, "The Picture of Dorian Gray", "dorian", "It was Oscar Wilde's only novel.", 3),
    (36, "The War of the Worlds", "wotw", "A radio version of it later startled listeners.", 3),
    (16, "Peter Pan", "peter", "The story began as a play.", 3),
    (135, "Les Misérables", "lesmis", "One of its sentences runs for more than eight hundred words." if False else "A long stretch of it is about the sewers of Paris.", 3),
    (996, "Don Quixote", "quix", "It is really two books, published ten years apart.", 3),
]


def body(n):
    t = None
    base = "/".join(list(str(n))[:-1]) or "0"
    for name in (f"{n}-0.txt", f"{n}.txt"):
        for host in (MIRROR, "https://mirror.csclub.uwaterloo.ca/gutenberg"):
            try:
                t = fetch(f"{host}/{base}/{n}/{name}", pause=1.0); break
            except RuntimeError:
                continue
        if t: break
    if not t: raise LookupError(f"no text for {n}")
    a = re.search(r"\*\*\* ?START OF TH.*?\*\*\*", t, re.S); b = re.search(r"\*\*\* ?END OF TH", t)
    return t[a.end():b.start()] if a and b else t


def words(t): return re.findall(r"[A-Za-zÀ-ÿ]+(?:['’][A-Za-zÀ-ÿ]+)*", t)


def run():
    for n, title, key, ex, d in BOOKS:
        def one():
            w = words(body(n))
            url = f"https://www.gutenberg.org/ebooks/{n}"
            add(f"bk-{key}-words", f"How many words long is {title}?", len(w), "words", "Books and art", span=3.6, difficulty=d, url=url, source="Project Gutenberg text, counted here", licence="Public domain in the US", evidence=f"Project Gutenberg {n}, words between the START and END markers, chapter headings included: {len(w)}", explainer=ex, check=f"pg|{n}|words", topic="bk-words", as_of="Counted from the Project Gutenberg edition" + (" in English" if n in (2600, 5200, 135, 996) else ""))
        attempt(f"bk-{key}", one)
    def count(id, n, title, pat, q, ex, d, unit="times"):
        def one():
            w = [x.lower() for x in words(body(n))]
            k = sum(bool(re.fullmatch(pat, x)) for x in w)
            add(f"bk-{id}", q, k, unit, "Books and art", span=3.6, difficulty=d, url=f"https://www.gutenberg.org/ebooks/{n}", source="Project Gutenberg text, counted here", licence="Public domain in the US", evidence=f"Project Gutenberg {n} ({title}), words matching /{pat}/: {k} of {len(w)}", explainer=ex.replace("{n}", fmt(len(w))), check=f"pg|{n}|{pat}", topic="bk-count", as_of="Counted from the Project Gutenberg edition", whole=True)
        attempt(f"bk-{id}", one)
    count("whale", 2701, "Moby-Dick", r"whales?(['’]s)?", "How many times do the words whale and whales appear in Moby-Dick?", "The whole book is {n} words.", 2)
    count("alice", 11, "Alice", r"alice(['’]s)?", "How many times does the name Alice appear in Alice's Adventures in Wonderland?", "The whole book is {n} words.", 2)
    count("darcy", 1342, "Pride and Prejudice", r"darcy(['’]s)?", "How many times does the name Darcy appear in Pride and Prejudice?", "The whole book is {n} words.", 2)
    count("humbug", 46, "A Christmas Carol", r"humbug", "How many times does the word humbug appear in A Christmas Carol?", "Scrooge says it less often than people remember.", 2)
    count("monster", 84, "Frankenstein", r"monster(['’]s)?|monsters", "How many times does the word monster appear in Frankenstein?", "Nowhere in it does the creature get a name.", 3)
    count("the", 2701, "Moby-Dick", r"the", "How many times does the word the appear in Moby-Dick?", "It is the most common word in English by a wide margin.", 3)
    def founding(id, url, pat_a, pat_b, q, ex, d):
        def one():
            t = text(url)
            i = re.search(pat_a, t); j = re.search(pat_b, t[i.start():])
            k = len(words(t[i.start(): i.start() + j.end()]))
            add(id, q, k, "words", "History", span=3.4, difficulty=d, url=url, source="US National Archives", licence=PD, evidence=f"words from '{i.group(0)}' to '{j.group(0)}' in the transcript: {k}", explainer=ex, check="archives", topic="hi-words")
        attempt(id, one)
    founding("hi-decl-words", "https://www.archives.gov/founding-docs/declaration-transcript", r"When in the Course", r"sacred Honor", "How many words long is the Declaration of Independence, without the signatures?", "Most of it is a list of complaints about the king.", 2)
