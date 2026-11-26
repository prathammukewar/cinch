"""Facts from Wikidata (CC0). Each one must also be stated, as the same number, in the
English Wikipedia article for the same subject before it is kept."""
from lib import *

API = "https://en.wikipedia.org/w/api.php?format=json&redirects=1&action=query"
UNIT = {"Q11573": ("m", 1), "Q828224": ("m", 1000), "Q174728": ("m", .01), "Q3710": ("m", .3048), "Q174789": ("m", .001), "Q712226": ("km2", 1), "Q25343": ("km2", 1e-6), "Q35852": ("km2", .01), "Q232291": ("km2", 2.589988), "Q11570": ("kg", 1), "Q191118": ("kg", 1000), "Q7727": ("min", 1), "Q25235": ("min", 60), "Q199": ("", 1), "1": ("", 1), "Q23387": ("m", .01), "Q218593": ("m", .0254)}


def qids(titles):
    out = {}
    for i in range(0, len(titles), 40):
        part = titles[i:i + 40]
        j = fetch_json(API + "&prop=pageprops&ppprop=wikibase_item&titles=" + urllib.parse.quote("|".join(part)))["query"]
        alias = {}
        for k in ("normalized", "redirects"):
            for r in j.get(k, []): alias[r["from"]] = r["to"]
        by = {p["title"]: p.get("pageprops", {}).get("wikibase_item") for p in j["pages"].values()}
        for t in part:
            x = t
            for _ in range(3): x = alias.get(x, x)
            out[t] = (by.get(x), x)
    return out


QL = "https://qlever.dev/api/wikidata?query="
PREFIX = "PREFIX wd: <http://www.wikidata.org/entity/> PREFIX p: <http://www.wikidata.org/prop/> PREFIX psv: <http://www.wikidata.org/prop/statement/value/> PREFIX wikibase: <http://wikiba.se/ontology#> "
_claims = {}


def load_claims(prop, items, time=False):
    """All statements of one property for many items, from the QLever copy of Wikidata."""
    items = sorted(set(items))
    body = "?n wikibase:timeValue ?v ; wikibase:timePrecision ?u ." if time else "?n wikibase:quantityAmount ?v ; wikibase:quantityUnit ?u ."
    q = PREFIX + f"SELECT ?item ?v ?u ?rank WHERE {{ VALUES ?item {{ {' '.join('wd:' + i for i in items)} }} ?item p:{prop} ?st . ?st wikibase:rank ?rank . ?st psv:{prop} ?n . {body} }}"
    j = fetch_json(QL + urllib.parse.quote(q), headers={"Accept": "application/sparql-results+json"}, pause=2)
    for r in j["results"]["bindings"]:
        key = (r["item"]["value"].rsplit("/", 1)[-1], prop)
        _claims.setdefault(key, []).append({"rank": r["rank"]["value"].rsplit("#", 1)[-1].replace("Rank", "").lower(), "v": r["v"]["value"], "u": r["u"]["value"].rsplit("/", 1)[-1], "time": time})


def statements(q, prop):
    return _claims.get((q, prop), [])


_articles = {}


def load_articles(titles):
    """Wikitext of many articles, a few per request. Used only to confirm numbers."""
    todo = [t for t in titles if t not in _articles]
    for i in range(0, len(todo), 8):
        j = fetch_json(API + "&prop=revisions&rvprop=content&rvslots=main&titles=" + urllib.parse.quote("|".join(todo[i:i + 8])), pause=6, tries=4)
        for p in j["query"]["pages"].values():
            if "revisions" in p: _articles[p["title"]] = p["revisions"][0]["slots"]["main"]["*"]


def article(title):
    t = _articles[title]
    t = re.sub(r"(?s)<ref[^>]*/>|<ref.*?</ref>|<!--.*?-->", " ", t)
    t = re.sub(r"\{\{(?:nbsp|snd|spnd)\}\}", " ", t)
    t = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]|]*)\]\]", r"\1", t)
    t = re.sub(r"'{2,}", "", t).replace("&nbsp;", " ")
    return re.sub(r"<[^>]+>", " ", t)


def infobox(title):
    return article(title)[:9000]


def year_of(st):
    m = re.match(r"^(-?)(\d+)-", st["v"])
    if int(st["u"]) < 9: return None
    return int(m.group(2)) * (-1 if m.group(1) else 1)


def best(sts):
    pref = [s for s in sts if s["rank"] == "preferred"]
    return pref or [s for s in sts if s["rank"] == "normal"]


def sentence_with(txt, year, words):
    for s in re.split(r"(?<=[.!?])\s+|\n+", txt):
        if re.search(rf"(?<!\d){year}(?!\d)", s) and (not words or re.search(words, s, re.I)):
            return s.strip()
    return None


KEYS = {"P2048": r"height|tall|architectural|tip|roof|high", "P2044": r"elevation|altitude|above sea|height|summit", "P2046": r"area|km2|square", "P2043": r"length|long|total_length", "P4511": r"depth|deep", "P1083": r"capacity|seat|spectator", "P2047": r"runtime|running time|minutes", "P1113": r"num_episodes|episodes", "P2067": r"mass|weigh|kg", "P2050": r"span|wingspan", "P1101": r"floor", "P2049": r"width|wide"}


def close_number(txt, v, tol, prop=None):
    """Find a number within tol of v in text, close after a word that names the measure."""
    for m in re.finditer(r"\d[\d,]*\.?\d*", txt):
        if prop and not re.search(KEYS[prop], txt[max(0, m.start() - 90): m.start()], re.I):
            continue
        try: x = float(m.group(0).replace(",", ""))
        except ValueError: continue
        if v and abs(x - v) <= tol * abs(v):
            return txt[max(0, m.start() - 70): m.end() + 40].replace("\n", " "), x
    return None, None


import urllib.parse

# ---------------------------------------------------------------- years
# title, property, question, explainer, category, difficulty, words the Wikipedia sentence must contain, ruler width in years
Y = [
    ("Eiffel Tower", "P1619", "In what year did the Eiffel Tower open?", "It was meant to stand for twenty years and be taken down.", "History", 1, "open|complet|world's fair|exposition", 250),
    ("Golden Gate Bridge", "P1619", "In what year did the Golden Gate Bridge open?", "Its color is an orange primer that people liked enough to keep.", "Engineering", 2, "open", 200),
    ("Brooklyn Bridge", "P1619", "In what year did the Brooklyn Bridge open?", "A year later elephants were walked across to show it was safe.", "Engineering", 2, "open", 250),
    ("Empire State Building", "P1619", "In what year did the Empire State Building open?", "It went up in a little over a year.", "Engineering", 2, "open", 200),
    ("Sydney Opera House", "P1619", "In what year did the Sydney Opera House open?", "It ran about ten years late and many times over budget.", "Engineering", 2, "open", 180),
    ("Suez Canal", "P1619", "In what year did the Suez Canal open?", "Verdi was asked to write something for it and declined." if False else "It let ships skip the long way round Africa.", "History", 3, "open", 300),
    ("Panama Canal", "P1619", "In what year did the Panama Canal open?", "A French company had tried and failed first.", "History", 2, "open|complet", 250),
    ("Channel Tunnel", "P1619", "In what year did the Channel Tunnel between England and France open?", "People had been drawing up plans for one since Napoleon's time.", "Engineering", 2, "open", 180),
    ("Disneyland", "P1619", "In what year did Disneyland open?", "The asphalt was still soft on opening day.", "Everyday life", 2, "open", 150),
    ("Space Needle", "P1619", "In what year did Seattle's Space Needle open?", "It was built for a world's fair about the future.", "Engineering", 3, "open|built|world's fair", 150),
    ("London Underground", "P1619", "In what year did the London Underground, the first metro, carry its first passengers?", "The first trains were pulled by steam engines.", "History", 3, "open|first", 300),
    ("Harvard University", "P571", "In what year was Harvard founded?", "It is the oldest university in the United States.", "History", 2, "found|establish", 350),
    ("Massachusetts Institute of Technology", "P571", "In what year was MIT founded?", "Its first classes waited until the Civil War ended.", "History", 2, "found|establish", 250),
    ("British Museum", "P571", "In what year was the British Museum founded?", "It began with one doctor's collection.", "History", 3, "found|establish", 400),
    ("Bank of England", "P571", "In what year was the Bank of England founded?", "It was set up to lend money to the king.", "Money", 3, "found|establish", 500),
    ("IBM", "P571", "In what year was the company that became IBM founded?", "Its early products included time clocks and meat slicers.", "Technology", 2, "found", 200),
    ("Microsoft", "P571", "In what year was Microsoft founded?", "Its first product was a programming language for a kit computer.", "Technology", 1, "found", 120),
    ("Sony", "P571", "In what year was Sony founded?", "Its first try at a product was a rice cooker that did not work well.", "Technology", 2, "found", 180),
    ("YouTube", "P571", "In what year was YouTube founded?", "The first video is nineteen seconds at a zoo.", "Technology", 1, "found|created|launch", 80),
    ("Wikipedia", "P571", "In what year did Wikipedia start?", "It began as a side project of a slower encyclopedia.", "Technology", 1, "launch|found|start", 80),
    ("Toyota", "P571", "In what year was Toyota founded?", "It grew out of a company that made looms.", "Technology", 2, "found", 200),
    ("Harley-Davidson", "P571", "In what year was Harley-Davidson founded?", "The first ones were built in a shed behind a house.", "Technology", 2, "found", 200),
    ("IKEA", "P571", "In what year was IKEA founded?", "Its founder was seventeen and sold small goods by mail.", "Everyday life", 2, "found", 180),
    ("Starbucks", "P571", "In what year was Starbucks founded?", "At first it sold beans and did not serve coffee by the cup.", "Food", 2, "found", 120),
    ("The New York Times", "P571", "In what year was The New York Times founded?", "It cost a penny a copy.", "History", 3, "found", 300),
    ("The Economist", "P571", "In what year was The Economist founded?", "Its articles still carry no bylines.", "History", 3, "found", 350),
    ("National Geographic Society", "P571", "In what year was the National Geographic Society founded?", "Thirty-three men met in a club in Washington to start it.", "History", 3, "found", 250),
    ("Guinness", "P571", "In what year did the Guinness brewery get its start?", "Its founder signed a lease for nine thousand years.", "Food", 3, "found|origin|brew", 450),
    ("Alice's Adventures in Wonderland", "P577", "In what year was Alice's Adventures in Wonderland published?", "It began as a story told on a rowing trip.", "Books and art", 2, "publish|novel|book", 300),
    ("Frankenstein", "P577", "In what year was Frankenstein published?", "Mary Shelley was eighteen when she began writing it.", "Books and art", 2, "publish", 300),
    ("Pride and Prejudice", "P577", "In what year was Pride and Prejudice published?", "Her name was not on the cover.", "Books and art", 2, "publish", 300),
    ("Moby-Dick", "P577", "In what year was Moby-Dick published?", "It sold poorly in its author's lifetime.", "Books and art", 2, "publish|novel", 300),
    ("On the Origin of Species", "P577", "In what year did Darwin publish On the Origin of Species?", "He had been working on the idea for about twenty years.", "Math and science", 2, "publish", 300),
    ("Dracula", "P577", "In what year was Dracula published?", "It is told entirely through diaries, letters and clippings.", "Books and art", 2, "publish|novel", 250),
    ("The Hobbit", "P577", "In what year was The Hobbit published?", "The publisher asked his ten-year-old son what he thought of it first.", "Books and art", 2, "publish", 180),
    ("A Christmas Carol", "P577", "In what year was A Christmas Carol published?", "Dickens wrote it in about six weeks.", "Books and art", 2, "publish", 300),
    ("The Wonderful Wizard of Oz", "P577", "In what year was The Wonderful Wizard of Oz published as a book?", "In the book the slippers are silver.", "Books and art", 2, "publish|book", 200),
    ("The Cat in the Hat", "P577", "In what year was The Cat in the Hat published?", "It uses only 236 different words." if False else "It was written to be read with a very short list of words.", "Books and art", 2, "publish|book", 150),
    ("The Very Hungry Caterpillar", "P577", "In what year was The Very Hungry Caterpillar published?", "The idea came from playing with a hole punch.", "Books and art", 2, "publish|book|1969", 150),
    ("Steamboat Willie", "P577", "In what year did Steamboat Willie, an early Mickey Mouse cartoon, come out?", "It was among the first cartoons with sound matched to the picture.", "Books and art", 2, "film|release|1928", 180),
    ("Snow White and the Seven Dwarfs (1937 film)", "P577", "In what year did Disney's Snow White come out?", "People in the business expected it to fail.", "Books and art", 2, "film|release|premier", 150),
    ("Jaws (film)", "P577", "In what year did the movie Jaws come out?", "The mechanical shark kept breaking, so it is hardly seen.", "Books and art", 1, "film|release", 120),
    ("Jurassic Park (film)", "P577", "In what year did the movie Jurassic Park come out?", "Computer dinosaurs appear for only a few minutes.", "Books and art", 1, "film|release", 100),
    ("Toy Story", "P577", "In what year did Toy Story come out?", "It was the first feature made entirely on computers.", "Books and art", 1, "film|release", 100),
    ("Pong", "P577", "In what year did the video game Pong come out?", "The first test machine broke because it filled up with coins.", "Technology", 2, "release|1972", 120),
    ("Minecraft", "P577", "In what year did the full version of Minecraft come out?", "Millions had already bought it while it was unfinished.", "Technology", 1, "release|2011", 60),
    ("Catan", "P577", "In what year was the board game Catan first published?", "Its designer was a dental technician.", "Everyday life", 2, "publish|1995", 120),
    ("Rubik's Cube", "P571|P575", "In what year was the Rubik's Cube invented?", "It took its inventor about a month to solve his own puzzle.", "Everyday life", 2, "invent", 150),
    ("Uno (card game)", "P571|P577", "In what year was the card game Uno created?", "A barber in Ohio made it up to settle a family argument.", "Everyday life", 2, "develop|creat|1971|invent", 120),
    ("Dungeons & Dragons", "P577", "In what year was Dungeons & Dragons first published?", "It grew out of games with toy soldiers.", "Everyday life", 2, "publish|1974", 100),
    ("Twister (game)", "P571|P577", "In what year was the game Twister introduced?", "Stores were unsure about it until it was played on late-night television.", "Everyday life", 2, "1966|introduc|publish", 120),
    ("Barbie", "P571|P577", "In what year was the Barbie doll introduced?", "She was named after her inventor's daughter.", "Everyday life", 2, "1959|launch|introduc|debut", 120),
    ("Uranus", "P575", "In what year was Uranus discovered?", "Its finder first took it for a comet.", "Space", 3, "discover", 400),
    ("Neptune", "P575", "In what year was Neptune discovered?", "It was found with a calculation before anyone saw it.", "Space", 3, "discover|observ", 350),
    ("Pluto", "P575", "In what year was Pluto discovered?", "An eleven-year-old girl suggested the name.", "Space", 2, "discover", 200),
    ("Ceres (dwarf planet)", "P575", "In what year was Ceres, the first asteroid, discovered?", "For a while it was counted as a planet.", "Space", 3, "discover", 400),
    ("Titan (moon)", "P575", "In what year was Saturn's moon Titan discovered?", "Its discoverer also built the first pendulum clock.", "Space", 3, "discover", 500),
    ("Penicillin", "P575", "In what year was penicillin discovered?", "Mold had blown onto a dish left out over a holiday.", "Math and science", 2, "discover", 200),
    ("Electron", "P575", "In what year was the electron identified as a particle?", "Nobody could think of a use for it.", "Math and science", 3, "identif|discover|thomson", 250),
    ("Transistor", "P575", "In what year was the first working transistor made?", "It was a lump of germanium, gold foil and plastic.", "Technology", 2, "invent|first|1947", 180),
    ("Hubble Space Telescope", "P619", "In what year was the Hubble Space Telescope launched?", "Its first pictures were blurry and astronauts had to fit corrective optics.", "Space", 2, "launch", 80),
    ("Voyager 1", "P619", "In what year was Voyager 1 launched?", "It launched about two weeks after Voyager 2.", "Space", 2, "launch", 90),
    ("Sputnik 1", "P619", "In what year was Sputnik 1, the first artificial satellite, launched?", "Anyone with a shortwave radio could hear it beep.", "Space", 1, "launch", 120),
    ("Curiosity (rover)", "P619", "In what year was the Mars rover Curiosity launched?", "It was lowered to the ground on cables from a hovering crane.", "Space", 2, "launch", 60),
    ("Tour de France", "P571|P580", "In what year was the first Tour de France?", "A newspaper started it to sell more copies.", "Sports", 2, "first|1903", 200),
    ("FIFA", "P571", "In what year was FIFA founded?", "The first World Cup came more than two decades later.", "Sports", 3, "found", 200),
    ("Boston Marathon", "P571|P580", "In what year was the first Boston Marathon?", "It is the oldest marathon still run every year.", "Sports", 2, "1897|first|began", 250),
    ("Premier League", "P571", "In what year was England's Premier League founded?", "Clubs left a league that was over a hundred years old to start it.", "Sports", 2, "found|form", 120),
    ("The Championships, Wimbledon", "P571|P580", "In what year was the first Wimbledon tennis tournament?", "A couple of hundred people watched the first final.", "Sports", 3, "1877|first", 250),
    ("Basketball", "P571|P575", "In what year was basketball invented?", "The first hoops were peach baskets with the bottoms left in.", "Sports", 2, "invent|1891", 250),
    ("FIFA World Cup", "P571", "In what year was the first men's FIFA World Cup played?", "Teams from Europe spent about two weeks on a ship to get there.", "Sports", 1, "1930|first|inaugural", 150),
    ("Machu Picchu", "P575", "In what year did Hiram Bingham bring Machu Picchu to the world's attention?", "Farmers were living among the terraces when he got there.", "History", 3, "1911|Bingham", 200),
    ("White House", "P571", "In what year did construction of the White House begin?", "The first president to live there was the second one.", "History", 3, "1792|construct|cornerstone", 300),
    ("Big Ben", "P571|P1619", "In what year did Big Ben's clock start keeping time?", "The name really belongs to the bell.", "History", 3, "1859", 300),
    ("Taj Mahal", "P571", "In what year was work on the Taj Mahal started?", "Its four towers lean slightly outward on purpose.", "History", 3, "1631|1632|commission|construct", 500),
    ("Central Park", "P571|P1619", "In what year did New York's Central Park first open?", "Nearly all of it was planned and planted.", "History", 3, "open|1858|1857|establish", 250),
    ("Yellowstone National Park", "P571", "In what year did Yellowstone become a national park?", "Soldiers looked after it before there were rangers.", "Geography", 2, "1872|establish", 250),
    ("Metropolitan Museum of Art", "P571", "In what year was New York's Metropolitan Museum of Art founded?", "Its first object was a Roman stone coffin.", "Books and art", 3, "found", 250),
    ("Red Cross", "P571", "In what year was the Red Cross founded?", "Its sign is the Swiss flag with the colors swapped.", "History", 3, "1863|found", 250) ,
    ("Walt Disney Studios (division)", "P571", "In what year was the Walt Disney studio founded?", "Its first star was a rabbit, not a mouse.", "Books and art", 2, "1923|found", 180),
    ("Ford Model T", "P571|P580", "In what year did the Ford Model T go on sale?", "For years it came only in black, because black paint dried fastest.", "Technology", 2, "1908", 180),
    ("Concorde", "P606", "In what year did Concorde first fly?", "Its nose tilted down so pilots could see the runway.", "Technology", 2, "1969|first fl", 150),
    ("Boeing 747", "P606", "In what year did the Boeing 747 first fly?", "The hump was meant to let the nose open for cargo.", "Technology", 2, "1969|first fl", 150),
    ("International Space Station", "P619", "In what year was the first piece of the International Space Station launched?", "People have been living aboard without a break since two years later." if False else "People have lived aboard without a break for over twenty years.", "Space", 2, "1998|launch", 80),
    ("James Webb Space Telescope", "P619", "In what year was the James Webb Space Telescope launched?", "It unfolded like a paper crane on the way to its post.", "Space", 1, "launch|2021", 50),
    ("New Horizons", "P619", "In what year did the New Horizons probe leave for Pluto?", "It took more than nine years to get there.", "Space", 3, "launch|2006", 60),
    ("Apollo 11", "P619", "In what year did Apollo 11 go to the Moon?", "Its computer had less memory than a musical greeting card." if False else "Two of the three crew walked on the surface.", "Space", 1, "1969", 120),
    ("Galileo (spacecraft)", "P619", "In what year was the Jupiter probe Galileo launched?", "Its main antenna never opened all the way.", "Space", 3, "launch|1989", 80),
    ("The Beatles", "P571", "In what year were the Beatles formed?", "They played long nights in Hamburg before anyone knew them.", "Books and art", 2, "1960|form", 120),
    ("Rolling Stone", "P571", "In what year was Rolling Stone magazine founded?", "The first issue cost a quarter.", "Books and art", 3, "found|1967", 120),
    ("Sesame Street", "P580", "In what year did Sesame Street start?", "Researchers tested it on children before it aired.", "Books and art", 2, "1969|premier|debut", 120),
    ("The Simpsons", "P580", "In what year did The Simpsons start as its own show?", "It began as short clips on another program.", "Books and art", 2, "1989|premier|debut", 100),
    ("Doctor Who", "P580", "In what year did Doctor Who first air?", "It was planned as a history show for children.", "Books and art", 3, "1963|first", 120),
    ("Nineteen Eighty-Four", "P577", "In what year was George Orwell's Nineteen Eighty-Four published?", "He typed the final draft while ill, on a remote island.", "Books and art", 2, "publish|1949", 150),
    ("The Great Gatsby", "P577", "In what year was The Great Gatsby published?", "It sold poorly until soldiers were given free copies." if False else "It became famous only after its author was gone.", "Books and art", 2, "publish|1925", 180),
    ("Little Women", "P577", "In what year was the first part of Little Women published?", "The author thought it was dull while writing it.", "Books and art", 3, "publish|1868", 250),
    ("Treasure Island", "P577", "In what year was Treasure Island published as a book?", "It began with a map drawn to amuse a boy on a rainy day.", "Books and art", 3, "publish|1883", 250),
    ("The Adventures of Tom Sawyer", "P577", "In what year was The Adventures of Tom Sawyer published?", "It may be the first novel handed in as typed pages.", "Books and art", 3, "publish|1876", 250),
    ("Harry Potter and the Philosopher's Stone", "P577", "In what year was the first Harry Potter book published?", "The first printing was only a few hundred copies.", "Books and art", 1, "publish|1997", 100),
    ("Where the Wild Things Are", "P577", "In what year was Where the Wild Things Are published?", "The monsters were modeled on the author's relatives.", "Books and art", 2, "publish|1963", 150),
    ("Goodnight Moon", "P577", "In what year was Goodnight Moon published?", "The New York Public Library did not buy a copy for decades.", "Books and art", 3, "publish|1947", 150),
    ("King Kong (1933 film)", "P577", "In what year did the first King Kong movie come out?", "Kong was a model about eighteen inches tall.", "Books and art", 2, "1933|release", 150),
    ("The Wizard of Oz (1939 film)", "P577", "In what year did the movie The Wizard of Oz come out?", "The black-and-white parts are really a brown tint.", "Books and art", 2, "1939|release", 150),
    ("Back to the Future", "P577", "In what year did Back to the Future come out?", "The time machine was a refrigerator in an early draft.", "Books and art", 1, "1985|release", 100),
    ("E.T. the Extra-Terrestrial", "P577", "In what year did E.T. come out?", "It was filmed in story order to help the child actors.", "Books and art", 2, "1982|release", 100),
    ("The Matrix", "P577", "In what year did The Matrix come out?", "The falling green code was made from sushi recipes.", "Books and art", 1, "1999|release", 80),
    ("Finding Nemo", "P577", "In what year did Finding Nemo come out?", "The artists took classes on how fish move.", "Books and art", 1, "2003|release", 60),
    ("Doom (1993 video game)", "P577", "In what year did the video game Doom come out?", "Its first part was given away for free.", "Technology", 2, "1993|release", 80),
    ("The Sims (video game)", "P577", "In what year did the first Sims game come out?", "It started as a tool for designing houses.", "Technology", 2, "2000|release", 70),
    ("World of Warcraft", "P577", "In what year did World of Warcraft come out?", "A glitch once spread a fake plague through it and scientists took notes.", "Technology", 2, "2004|release", 60),
    ("Python (programming language)", "P571|P577", "In what year was the Python programming language first released?", "It is named after a comedy troupe, not the snake.", "Technology", 2, "1991|release", 80),
    ("JavaScript", "P571", "In what year was JavaScript created?", "The first version took about ten days.", "Technology", 2, "1995", 70),
    ("Linux kernel", "P571|P577", "In what year was the Linux kernel first released?", "Its author said it would not be big or professional.", "Technology", 2, "1991|release", 80),
    ("World Wide Web", "P571|P575", "In what year was the World Wide Web invented?", "The first page explained what the web was.", "Technology", 1, "1989|invent", 80),
    ("iPhone (1st generation)", "P577|P571", "In what year did the first iPhone come out?", "It had no app store at launch.", "Technology", 1, "2007|release|announc", 50),
    ("Game Boy", "P577", "In what year did the Game Boy come out?", "One astronaut took his to a space station.", "Technology", 2, "1989|release", 80),
    ("Walkman", "P577|P571", "In what year did the first Sony Walkman come out?", "It had two headphone jacks so you could share.", "Technology", 2, "1979", 100),
    ("Polaroid Corporation", "P571", "In what year was Polaroid founded?", "It made sunglasses before it made cameras.", "Technology", 3, "found|1937", 180),
    ("Adidas", "P571", "In what year was Adidas founded?", "The founder's brother set up Puma across the river.", "Money", 3, "found|1949|1924", 150),
    ("Intel", "P571", "In what year was Intel founded?", "Its name is short for integrated electronics.", "Technology", 2, "found", 120),
    ("eBay", "P571", "In what year was eBay founded?", "The first thing sold on it was a broken laser pointer.", "Money", 2, "found", 60),
    ("FedEx", "P571", "In what year was FedEx founded?", "Its founder sketched the idea in a college paper.", "Money", 3, "found|1971|1973", 120),
    ("Walmart", "P571", "In what year was Walmart founded?", "The first store was in a small town in Arkansas.", "Money", 2, "found|1962", 120),
    ("Subway (restaurant)", "P571", "In what year was the sandwich chain Subway founded?", "It was started with a thousand dollars to pay for college.", "Food", 2, "found|1965", 120),
    ("KFC", "P571", "In what year did KFC get its start?", "The colonel first served chicken at a gas station.", "Food", 3, "found|1930|1952", 150),
    ("Olympic Games", "P571", "In what year were the first modern Olympic Games held?", "Winners got silver medals.", "Sports", 1, "1896", 250),
    ("Super Bowl", "P571", "In what year was the first Super Bowl played?", "It did not sell out.", "Sports", 2, "1967", 120),
    ("Indianapolis 500", "P571", "In what year was the first Indianapolis 500?", "The winner used a mirror, which was a new idea.", "Sports", 3, "1911", 200),
    ("UEFA European Championship", "P571", "In what year was soccer's first European Championship played?", "Only four teams made it to the final tournament.", "Sports", 3, "1960|1958", 120),
    ("New York Yankees", "P571", "In what year was the team that became the Yankees founded?", "It moved from Baltimore before it found the name.", "Sports", 3, "1903|1901|found", 180),
    ("FC Barcelona", "P571", "In what year was FC Barcelona founded?", "A Swiss man put an ad in a newspaper to find players.", "Sports", 2, "found|1899", 200),
    ("Ferrari", "P571", "In what year was Ferrari founded?", "The prancing horse came from a fighter pilot.", "Technology", 2, "found|1939|1947", 150),
]

# ---------------------------------------------------------------- measurements
# title, property, unit shown, factor from base unit, question, explainer, category, difficulty, scale kwargs, Wikipedia factors to try
M = dict(span=3)
H = [
    ("Burj Khalifa", "P2048", "meters", 1, "How many meters tall is the Burj Khalifa, the tallest building in the world?", "The top part is a spire that nobody can live in.", "Engineering", 1, dict(span=2.8)),
    ("Shanghai Tower", "P2048", "meters", 1, "How many meters tall is the Shanghai Tower?", "It twists as it rises, which cuts the push of the wind.", "Engineering", 3, dict(span=2.8)),
    ("Tokyo Skytree", "P2048", "meters", 1, "How many meters tall is the Tokyo Skytree?", "The height was picked as a pun on an old name for the area.", "Engineering", 3, dict(span=2.8)),
    ("Willis Tower", "P2048", "meters", 1, "How many meters tall is Chicago's Willis Tower, not counting antennas?", "Many people there still call it the Sears Tower.", "Engineering", 2, dict(span=2.8)),
    ("One World Trade Center", "P2048", "meters", 1, "How many meters tall is One World Trade Center in New York?", "In feet the height is a nod to the year of independence.", "Engineering", 2, dict(span=2.8)),
    ("Space Needle", "P2048", "meters", 1, "How many meters tall is Seattle's Space Needle?", "Its foundation weighs as much as the whole tower above it.", "Engineering", 3, dict(span=2.8)),
    ("Tokyo Tower", "P2048", "meters", 1, "How many meters tall is Tokyo Tower?", "It was modeled on the Eiffel Tower and is a few meters taller.", "Engineering", 3, dict(span=2.8)),
    ("Arc de Triomphe", "P2048", "meters", 1, "How many meters tall is the Arc de Triomphe in Paris?", "A pilot flew a plane through it once." , "Engineering", 2, dict(span=2.8)),
    ("Burj Khalifa", "P1101", "floors", 1, "How many floors does the Burj Khalifa have?", "The elevators change over partway, since one cable cannot reach all the way." if False else "People on the highest floors see the sunset again after riding up.", "Engineering", 2, dict(span=2.4, whole=True)),
    ("Mount Everest", "P2044", "meters", 1, "How many meters high is Mount Everest?", "It grows a little each year as the plates push together.", "Geography", 1, dict(span=2.4)),
    ("K2", "P2044", "meters", 1, "How many meters high is K2?", "It has been climbed far less often than Everest.", "Geography", 2, dict(span=2.4)),
    ("Mount Kilimanjaro", "P2044", "meters", 1, "How many meters high is Kilimanjaro?", "You can reach the top on foot without ropes.", "Geography", 2, dict(span=2.4)),
    ("Mount Fuji", "P2044", "meters", 1, "How many meters high is Mount Fuji?", "It is a volcano, and it last erupted about three centuries ago.", "Geography", 2, dict(span=2.4)),
    ("Matterhorn", "P2044", "meters", 1, "How many meters high is the Matterhorn?", "Its shape is printed on a famous chocolate bar for decades." if False else "It stands on the border of Switzerland and Italy.", "Geography", 2, dict(span=2.4)),
    ("Aconcagua", "P2044", "meters", 1, "How many meters high is Aconcagua, the highest mountain outside Asia?", "It is in Argentina, close to Chile.", "Geography", 3, dict(span=2.4)),
    ("Ben Nevis", "P2044", "meters", 1, "How many meters high is Ben Nevis, the highest mountain in Britain?", "Its top is in cloud most days of the year.", "Geography", 2, dict(span=2.6)),
    ("Mauna Kea", "P2044", "meters", 1, "How many meters above the sea is the top of Mauna Kea in Hawaii?", "More than half of the mountain is under water.", "Geography", 2, dict(span=2.4)),
    ("Mount Vesuvius", "P2044", "meters", 1, "How many meters high is Mount Vesuvius?", "Its shape and height change with each big eruption.", "Geography", 3, dict(span=2.6)),
    ("Denali", "P2044", "meters", 1, "How many meters high is Denali, the highest mountain in North America?", "From base to top it rises more than Everest does.", "Geography", 2, dict(span=2.4)),
    ("Table Mountain", "P2044", "meters", 1, "How many meters high is Table Mountain in Cape Town?", "A sheet of cloud often covers the flat top.", "Geography", 3, dict(span=2.6)),
    ("Machu Picchu", "P2044", "meters", 1, "How many meters above sea level is Machu Picchu?", "It is lower than the city of Cusco, where most visitors start.", "Geography", 2, dict(span=2.4)),
    ("Lake Titicaca", "P2044", "meters", 1, "How many meters above sea level is Lake Titicaca?", "It is large enough for a small navy, and Bolivia keeps one there.", "Geography", 3, dict(span=2.4)),
    ("Lake Baikal", "P4511", "meters", 1, "How many meters deep is Lake Baikal, the deepest lake?", "It holds about a fifth of the world's unfrozen fresh water.", "Geography", 2, dict(span=3)),
    ("Lake Superior", "P4511", "meters", 1, "How many meters deep is Lake Superior at its deepest?", "It could hold the water of all the other Great Lakes with room to spare.", "Geography", 2, dict(span=3)),
    ("Monaco", "P2046", "km²", 1, "How many square kilometers does Monaco cover?", "It is still growing, by filling in the sea.", "Geography", 2, dict(span=4)),
    ("Liechtenstein", "P2046", "km²", 1, "How many square kilometers does Liechtenstein cover?", "It is one of two countries where you must cross two borders to reach a sea.", "Geography", 2, dict(span=4)),
    ("San Marino", "P2046", "km²", 1, "How many square kilometers does San Marino cover?", "Italy surrounds it on every side.", "Geography", 3, dict(span=4)),
    ("Luxembourg", "P2046", "km²", 1, "How many square kilometers does Luxembourg cover?", "All public transport there is free.", "Geography", 2, dict(span=4)),
    ("Easter Island", "P2046", "km²", 1, "How many square kilometers is Easter Island?", "Its nearest inhabited neighbor is over a thousand miles away.", "Geography", 3, dict(span=4)),
    ("Sicily", "P2046", "km²", 1, "How many square kilometers is Sicily?", "It is the largest island in the Mediterranean.", "Geography", 3, dict(span=4)),
    ("Golden Gate Bridge", "P2043", "meters", 1, "How many meters long is the Golden Gate Bridge from end to end?", "It sways sideways by meters in strong wind.", "Engineering", 2, dict(span=3)),
    ("Brooklyn Bridge", "P2043", "meters", 1, "How many meters long is the Brooklyn Bridge from end to end?", "It took fourteen years to build.", "Engineering", 2, dict(span=3)),
    ("Channel Tunnel", "P2043", "km", .001, "How many kilometers long is the Channel Tunnel?", "Crews dug from both sides and met under the sea, off by less than a meter.", "Engineering", 2, dict(span=3)),
    ("Gotthard Base Tunnel", "P2043", "km", .001, "How many kilometers long is the Gotthard Base Tunnel, the longest railway tunnel?", "The rock at its deepest point is hot enough that trains need cooling.", "Engineering", 3, dict(span=3)),
    ("Suez Canal", "P2043", "km", .001, "How many kilometers long is the Suez Canal?", "It has no locks, because the two seas sit at nearly the same level.", "Engineering", 2, dict(span=3)),
    ("Panama Canal", "P2043", "km", .001, "How many kilometers long is the Panama Canal?", "Ships are lifted up to a lake and lowered again on the other side.", "Engineering", 2, dict(span=3)),
    ("Trans-Siberian Railway", "P2043", "km", .001, "How many kilometers long is the Trans-Siberian Railway from Moscow to Vladivostok?", "It crosses about a third of the way around the world's time zones.", "Engineering", 2, dict(span=3)),
    ("The Starry Night", "P2048", "cm", 100, "How many centimeters tall is Van Gogh's The Starry Night?", "He painted it from memory during the day.", "Books and art", 2, dict(span=2.8)),
    ("Guernica (Picasso)", "P2049", "cm", 100, "How many centimeters wide is Picasso's Guernica?", "It is painted entirely in black, white and gray.", "Books and art", 3, dict(span=2.8)),
    ("Girl with a Pearl Earring", "P2048", "cm", 100, "How many centimeters tall is Girl with a Pearl Earring?", "It once sold at auction for next to nothing.", "Books and art", 2, dict(span=2.8)),
    ("The Night Watch", "P2049", "cm", 100, "How many centimeters wide is Rembrandt's The Night Watch today?", "It was trimmed on all sides to fit between two doors.", "Books and art", 3, dict(span=2.8)),
    ("The Birth of Venus", "P2049", "cm", 100, "How many centimeters wide is Botticelli's The Birth of Venus?", "It is on canvas, which was unusual for its time.", "Books and art", 3, dict(span=2.8)),
    ("David (Michelangelo)", "P2048", "cm", 100, "How many centimeters tall is Michelangelo's David?", "He carved it from a block two others had given up on.", "Books and art", 2, dict(span=2.8)),
    ("The Scream", "P2048", "cm", 100, "How many centimeters tall is the painted 1893 version of The Scream?", "Munch made several versions of it.", "Books and art", 3, dict(span=2.8)),
    ("American Gothic", "P2048", "cm", 100, "How many centimeters tall is the painting American Gothic?", "The models were the artist's sister and his dentist.", "Books and art", 3, dict(span=2.8)),
    ("Titanic (1997 film)", "P2047", "minutes", 1, "How many minutes long is the movie Titanic?", "It was the first film to earn a billion dollars.", "Books and art", 1, dict(span=2, scale2=True)),
    ("The Lion King", "P2047", "minutes", 1, "How many minutes long is the 1994 movie The Lion King?", "It was not expected to be the studio's big hit that year.", "Books and art", 2, dict(span=2)),
    ("The Godfather", "P2047", "minutes", 1, "How many minutes long is The Godfather?", "The cat in the opening scene was a stray found on the lot.", "Books and art", 2, dict(span=2)),
    ("Avengers: Endgame", "P2047", "minutes", 1, "How many minutes long is Avengers: Endgame?", "Cinemas ran showings around the clock on opening weekend.", "Books and art", 1, dict(span=2)),
    ("Friends", "P1113", "episodes", 1, "How many episodes of Friends were made?", "It ran for ten seasons.", "Books and art", 1, dict(span=2.6, whole=True)),
    ("Seinfeld", "P1113", "episodes", 1, "How many episodes of Seinfeld were made?", "The pilot tested badly.", "Books and art", 2, dict(span=2.6, whole=True)),
    ("Breaking Bad", "P1113", "episodes", 1, "How many episodes of Breaking Bad were made?", "It ran for five seasons.", "Books and art", 2, dict(span=2.6, whole=True)),
    ("Game of Thrones", "P1113", "episodes", 1, "How many episodes of Game of Thrones were made?", "The seasons got shorter toward the end.", "Books and art", 2, dict(span=2.6, whole=True)),
    ("Cheers", "P1113", "episodes", 1, "How many episodes of Cheers were made?", "It came close to last in the ratings in its first year.", "Books and art", 3, dict(span=2.6, whole=True)),
    ("Wembley Stadium", "P1083", "people", 1, "How many seats does Wembley Stadium in London have?", "It has thousands of toilets, more than any other venue when it opened." if False else "Every seat is under a roof.", "Sports", 2, dict(span=3.2)),
    ("Michigan Stadium", "P1083", "people", 1, "How many people does Michigan Stadium hold?", "It is the largest stadium in the United States.", "Sports", 2, dict(span=3.2)),
    ("Melbourne Cricket Ground", "P1083", "people", 1, "How many people does the Melbourne Cricket Ground hold?", "It hosted the main events of the 1956 Olympics." if False else "It was used for both Olympic ceremonies and cricket finals.", "Sports", 3, dict(span=3.2)),
    ("Sputnik 1", "P2067", "kg", 1, "How many kilograms did Sputnik 1 weigh?", "It was a polished ball about the width of a beach ball, with four antennas.", "Space", 2, dict(span=4)),
    ("Airbus A380", "P2050", "meters", 1, "How many meters is the wingspan of an Airbus A380, the largest airliner?", "Airports had to widen taxiways for it.", "Engineering", 2, dict(span=2.4)),
    ("Boeing 747", "P2050", "meters", 1, "How many meters is the wingspan of an early Boeing 747?", "It is longer than the first flight of the Wright brothers.", "Engineering", 2, dict(span=2.4)),
    ("Saturn V", "P2048", "meters", 1, "How many meters tall was the Saturn V Moon rocket?", "It is taller than the Statue of Liberty with her pedestal.", "Space", 2, dict(span=2.8)),
    ("Eiffel Tower", "P2048", "meters", 1, "How many meters tall is the Eiffel Tower, with its antennas?", "It can grow several centimeters on a hot day.", "Engineering", 1, dict(span=2.6)),
    ("Merdeka 118", "P2048", "meters", 1, "How many meters tall is Merdeka 118 in Kuala Lumpur?", "It is the second tallest building in the world.", "Engineering", 3, dict(span=2.8)),
    ("Lotte World Tower", "P2048", "meters", 1, "How many meters tall is Lotte World Tower in Seoul?", "It has one of the highest glass floors anywhere.", "Engineering", 3, dict(span=2.8)),
    ("Cologne Cathedral", "P2048", "meters", 1, "How many meters tall is Cologne Cathedral?", "It took more than six hundred years to finish.", "Engineering", 2, dict(span=2.8)),
    ("Leaning Tower of Pisa", "P2048", "meters", 1, "How many meters tall is the Leaning Tower of Pisa?", "Engineers straightened it a little and then stopped on purpose.", "Engineering", 2, dict(span=2.8)),
    ("Great Pyramid of Giza", "P2048", "meters", 1, "How many meters tall is the Great Pyramid of Giza today?", "It has lost its smooth outer stones and its tip.", "Engineering", 2, dict(span=2.8)),
    ("Christ the Redeemer (statue)", "P2048", "meters", 1, "How many meters tall is Christ the Redeemer in Rio, without its base?", "It is covered in thousands of small stone tiles.", "Engineering", 2, dict(span=2.8)),
    ("London Eye", "P2048", "meters", 1, "How many meters tall is the London Eye?", "It turns slowly enough that riders step on while it moves.", "Engineering", 2, dict(span=2.8)),
    ("Three Gorges Dam", "P2048", "meters", 1, "How many meters tall is the Three Gorges Dam in China?", "Filling its lake slowed Earth's spin by a tiny amount.", "Engineering", 3, dict(span=2.8)),
    ("Millau Viaduct", "P2048", "meters", 1, "How many meters tall is the Millau Viaduct in France?", "Drivers on it can be above the clouds.", "Engineering", 3, dict(span=2.8)),
    ("Millau Viaduct", "P2043", "meters", 1, "How many meters long is the Millau Viaduct in France?", "The deck was pushed out from both ends by satellite-guided rams.", "Engineering", 3, dict(span=3)),
    ("Øresund Bridge", "P2043", "meters", 1, "How many meters long is the bridge between Denmark and Sweden?", "Partway across it dives into a tunnel.", "Engineering", 3, dict(span=3)),
    ("Sydney Harbour Bridge", "P2043", "meters", 1, "How many meters long is the Sydney Harbour Bridge?", "Locals call it the Coathanger.", "Engineering", 2, dict(span=3)),
    ("Akashi Kaikyo Bridge", "P2043", "meters", 1, "How many meters long is Japan's Akashi Kaikyo Bridge?", "Its towers stand on foundations sunk into the sea floor.", "Engineering", 3, dict(span=3)),
    ("Mount Olympus", "P2044", "meters", 1, "How many meters high is Mount Olympus in Greece?", "Its top was first reached in recorded climbs only in the twentieth century.", "Geography", 2, dict(span=2.6)),
    ("Mount Kosciuszko", "P2044", "meters", 1, "How many meters high is Australia's highest mountain, Kosciuszko?", "You can walk most of the way on a metal path.", "Geography", 3, dict(span=2.6)),
    ("Mount Elbrus", "P2044", "meters", 1, "How many meters high is Mount Elbrus, the highest in Europe?", "It is a sleeping volcano with two summits.", "Geography", 3, dict(span=2.4)),
    ("Mont Blanc", "P2044", "meters", 1, "How many meters high is Mont Blanc?", "Its cap is ice, so the height shifts from year to year.", "Geography", 2, dict(span=2.4)),
    ("Aoraki / Mount Cook", "P2044", "meters", 1, "How many meters high is Mount Cook, New Zealand's highest?", "It lost about ten meters off the top in a rockslide.", "Geography", 3, dict(span=2.4)),
    ("Mount Etna", "P2044", "meters", 1, "How many meters high is Mount Etna in Sicily?", "Each eruption can raise it or lower it.", "Geography", 3, dict(span=2.4)),
    ("Uluru", "P2044", "meters", 1, "How many meters above sea level is the top of Uluru in Australia?", "Most of the rock is below the ground.", "Geography", 2, dict(span=2.6)),
    ("Mexico City", "P2044", "meters", 1, "How many meters above sea level is Mexico City?", "Home runs fly farther there.", "Geography", 2, dict(span=2.6)),
    ("Denver", "P2044", "meters", 1, "How many meters above sea level is Denver?", "One step of the state capitol is marked one mile high.", "Geography", 1, dict(span=2.6)),
    ("Lhasa", "P2044", "meters", 1, "How many meters above sea level is Lhasa in Tibet?", "The railway to it pumps extra oxygen into the cars.", "Geography", 3, dict(span=2.4)),
    ("Lake Tanganyika", "P4511", "meters", 1, "How many meters deep is Lake Tanganyika in Africa?", "Only one lake in the world is deeper.", "Geography", 3, dict(span=3)),
    ("Lake Michigan", "P4511", "meters", 1, "How many meters deep is Lake Michigan at its deepest?", "It is the only Great Lake entirely in the United States.", "Geography", 2, dict(span=3)),
    ("Lake Erie", "P4511", "meters", 1, "How many meters deep is Lake Erie at its deepest?", "It is the shallowest Great Lake and freezes most easily.", "Geography", 3, dict(span=3)),
    ("Lake Tahoe", "P4511", "meters", 1, "How many meters deep is Lake Tahoe at its deepest?", "The Empire State Building would fit under the water.", "Geography", 2, dict(span=3)),
    ("Corsica", "P2046", "km²", 1, "How many square kilometers is Corsica?", "Napoleon was born there a year after France took it." if False else "Napoleon was born there.", "Geography", 3, dict(span=4)),
    ("Tasmania", "P2046", "km²", 1, "How many square kilometers is Tasmania?", "About two fifths of it is protected land.", "Geography", 3, dict(span=4)),
    ("Bali", "P2046", "km²", 1, "How many square kilometers is Bali?", "It is smaller than Delaware.", "Geography", 2, dict(span=4)),
    ("Crete", "P2046", "km²", 1, "How many square kilometers is Crete?", "It is the largest of the Greek islands.", "Geography", 3, dict(span=4)),
    ("Lake Superior", "P2046", "km²", 1, "How many square kilometers does Lake Superior cover?", "It is about the size of Austria.", "Geography", 2, dict(span=4)),
    ("Vatican City", "P2046", "km²", 1, "How many square kilometers does Vatican City cover?", "You can walk around its walls in under an hour.", "Geography", 1, dict(span=4)),
    ("Andorra", "P2046", "km²", 1, "How many square kilometers does Andorra cover?", "It has two heads of state, and neither lives there.", "Geography", 3, dict(span=4)),
    ("The Wizard of Oz (1939 film)", "P2047", "minutes", 1, "How many minutes long is the 1939 movie The Wizard of Oz?", "Its most famous song was nearly cut.", "Books and art", 2, dict(span=2)),
    ("Shrek", "P2047", "minutes", 1, "How many minutes long is the first Shrek?", "It won the first Oscar ever given for animated feature.", "Books and art", 1, dict(span=2)),
    ("Casablanca (film)", "P2047", "minutes", 1, "How many minutes long is Casablanca?", "Nobody in it says, play it again, Sam.", "Books and art", 2, dict(span=2)),
    ("Frozen (2013 film)", "P2047", "minutes", 1, "How many minutes long is the first Frozen?", "Artists visited an ice hotel to study how light moves.", "Books and art", 1, dict(span=2)),
    ("Gone with the Wind (film)", "P2047", "minutes", 1, "How many minutes long is Gone with the Wind?", "It was shown with an intermission.", "Books and art", 2, dict(span=2)),
    ("Lawrence of Arabia (film)", "P2047", "minutes", 1, "How many minutes long is Lawrence of Arabia?", "No woman has a speaking part in it.", "Books and art", 3, dict(span=2)),
    ("The Office (American TV series)", "P1113", "episodes", 1, "How many episodes of the American version of The Office were made?", "The British original had far fewer.", "Books and art", 2, dict(span=2.6, whole=True)),
    ("Lost (2004 TV series)", "P1113", "episodes", 1, "How many episodes of Lost were made?", "The opening word is a close-up of an eye instead.", "Books and art", 2, dict(span=2.6, whole=True)),
    ("The Sopranos", "P1113", "episodes", 1, "How many episodes of The Sopranos were made?", "Many viewers thought their cable had cut out at the end.", "Books and art", 3, dict(span=2.6, whole=True)),
    ("The Big Bang Theory", "P1113", "episodes", 1, "How many episodes of The Big Bang Theory were made?", "A real physicist checked what was written on the boards.", "Books and art", 2, dict(span=2.6, whole=True)),
    ("Avatar: The Last Airbender", "P1113", "episodes", 1, "How many episodes of the animated Avatar: The Last Airbender were made?", "Each style of bending is based on a real martial art.", "Books and art", 2, dict(span=2.6, whole=True)),
    ("M*A*S*H (TV series)", "P1113", "episodes", 1, "How many episodes of M*A*S*H were made?", "The show lasted longer than the war it was set in.", "Books and art", 2, dict(span=2.6, whole=True)),
    ("Maracanã Stadium", "P1083", "people", 1, "How many people does Brazil's Maracanã Stadium hold today?", "It once held more than twice as many, mostly standing.", "Sports", 3, dict(span=3.2)),
    ("Rose Bowl (stadium)", "P1083", "people", 1, "How many people does the Rose Bowl in Pasadena hold?", "It has hosted soccer World Cup finals and Super Bowls.", "Sports", 2, dict(span=3.2)),
    ("Madison Square Garden", "P1083", "people", 1, "How many people does Madison Square Garden hold for basketball?", "It sits on top of a train station.", "Sports", 2, dict(span=3.2)),
    ("Old Trafford", "P1083", "people", 1, "How many people does Old Trafford, home of Manchester United, hold?", "A local derby club once borrowed it for years." if False else "Trains pass right behind one of its stands.", "Sports", 2, dict(span=3.2)),
    ("Anfield", "P1083", "people", 1, "How many people does Anfield, home of Liverpool, hold?", "Everton played there first.", "Sports", 3, dict(span=3.2)),
    ("Voyager 1", "P2067", "kg", 1, "How many kilograms does Voyager 1 weigh?", "It is the most distant thing people have made.", "Space", 3, dict(span=4)),
    ("Concorde", "P2050", "meters", 1, "How many meters was the wingspan of Concorde?", "At speed it stretched by several inches from the heat.", "Engineering", 3, dict(span=2.4)),
    ("Spirit of St. Louis", "P2050", "meters", 1, "How many meters was the wingspan of Lindbergh's Spirit of St. Louis?", "A fuel tank blocked the front window, so he used a periscope.", "Engineering", 3, dict(span=2.4)),
    ("Hughes H-4 Hercules", "P2050", "meters", 1, "How many meters was the wingspan of the Spruce Goose, the giant wooden plane?", "It flew once, for about a minute.", "Engineering", 3, dict(span=2.4)),
    ("Statue of Liberty", "P2048", "meters", 1, "How many meters tall is the Statue of Liberty from the ground to the torch?", "About half of it is the pedestal.", "Engineering", 1, dict(span=2.6)),
    ("Space Shuttle", "P2048", "meters", 1, "How many meters tall was the Space Shuttle on the launch pad?", "The big orange tank was left unpainted to save weight.", "Space", 3, dict(span=2.8)),
]


def slug(s): return re.sub(r"[^a-z0-9]+", "", s.lower())[:22]


def run():
    attempt("wikidata", go)


def go():
    ids = qids(sorted({x[0] for x in Y} | {x[0] for x in H}))
    load_articles(sorted({real for q, real in ids.values() if q}))
    need = {}
    for title, props, *_ in Y:
        for p in props.split("|"): need.setdefault((p, True), set()).add(ids[title][0])
    for title, prop, *_ in H: need.setdefault((prop, False), set()).add(ids[title][0])
    for (p, time), items in need.items(): load_claims(p, [i for i in items if i], time)
    for title, props, question, ex, cat, d, words, width in Y:
        def one():
            q, real = ids[title]
            for prop in props.split("|"):
                sts = best(statements(q, prop))
                ys = [year_of(s) for s in sts]
                if ys: break
            if not ys or None in ys: raise LookupError(f"{title} {props}: no year")
            y = min(ys)
            if max(ys) - y > (2 if prop == "P577" else 0): raise LookupError(f"{title} {prop}: several years {sorted(set(ys))}")
            s = sentence_with(article(real), y, words)
            if not s: raise LookupError(f"{title}: {y} not confirmed by the article")
            add(f"yr-{slug(title)}-{prop.lower()}", question, y, "year", cat, scale="linear", span=width, difficulty=d, url=f"https://www.wikidata.org/wiki/{q}#{prop}", source="Wikidata", licence=CC0, evidence=f"Wikidata {q} {prop} = {y}. Wikipedia, {real}: {s[:260]}", explainer=ex, check=f"wd-year|{q}|{prop}|{real}|{words}", hi=2026, topic="yr", label=re.sub(r" \(.*\)$", "", title))
        attempt(f"yr-{title}", one)
    for title, prop, unit, f, question, ex, cat, d, kw in H:
        def one():
            kw2 = {k: v for k, v in kw.items() if k != "scale2"}
            q, real = ids[title]
            sts = [s for s in statements(q, prop) if s["rank"] != "deprecated"]
            vals = []
            for s in best(sts):
                u = s["u"]
                if u not in UNIT: raise LookupError(f"{title} unit {u}")
                vals.append(float(s["v"]) * UNIT[u][1])
            if not vals: raise LookupError(f"{title} {prop}: no value")
            if max(vals) - min(vals) > 0.02 * abs(max(vals)): raise LookupError(f"{title} {prop}: several values {sorted(set(round(v,3) for v in vals))}")
            base = vals[0]
            shown = clean(round(base * f, 2)) if base * f >= 1 else clean(base * f)
            txt = article(real)
            snip = None
            for k in ([1] if unit in ("floors", "episodes", "seats", "minutes", "kg", "km²") else [1, .001, 100, 1 / .3048]):
                snip, x = close_number(infobox(real) + "\n" + txt, base * k, 0.006, prop)
                if snip: break
            if not snip: raise LookupError(f"{title} {prop}: {base} not confirmed by the article")
            if prop == "P2047" and re.search(r"runtime\s*=\s*\{\{(?:plainlist|ubl|unbulleted)", infobox(real), re.I):
                raise LookupError(f"{title}: several running times")
            add(f"wd-{slug(title)}-{prop.lower()}", question, shown, unit, cat, difficulty=d, url=f"https://www.wikidata.org/wiki/{q}#{prop}", source="Wikidata", licence=CC0, evidence=f"Wikidata {q} {prop} = {base:g} (base units). Wikipedia, {real}: {snip.strip()}", explainer=ex, check=f"wd-num|{q}|{prop}|{real}", topic=f"wd-{prop}", label=re.sub(r" \(.*\)$", "", title), **kw2)
        attempt(f"wd-{title}-{prop}", one)
