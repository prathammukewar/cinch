import csv, zipfile, io
from lib import *

URL = "https://genomics.senescence.info/species/dataset.zip"


def table():
    z = zipfile.ZipFile(io.BytesIO(fetch(URL, binary=True)))
    name = next(n for n in z.namelist() if n.endswith("anage_data.txt"))
    rows = list(csv.DictReader(io.StringIO(z.read(name).decode("utf-8", "replace")), delimiter="\t"))
    return {f"{r['Genus']} {r['Species']}": r for r in rows}


GEST, LIT, BW, AW, LONG = "Gestation/Incubation (days)", "Litter/Clutch size", "Birth weight (g)", "Adult weight (g)", "Maximum longevity (yrs)"

# (key, species, field, question, unit, factor, explainer(answer, get), difficulty, span)
LIST = [
    ("giraffe-preg", "Giraffa camelopardalis", GEST, "How many days is a giraffe pregnant?", "days", 1, lambda a, g: f"That is about {fmt(a/30.44,0)} months. The calf drops nearly its own height to the ground.", 2, 3),
    ("elephant-preg", "Loxodonta africana", GEST, "How many days is an African elephant pregnant?", "days", 1, lambda a, g: f"Close to {fmt(a/30.44,0)} months, one of the longest pregnancies of any land animal.", 1, 3),
    ("opossum-preg", "Didelphis virginiana", GEST, "How many days is a Virginia opossum pregnant?", "days", 1, lambda a, g: "The babies are born tiny and finish growing in the pouch.", 3, 3),
    ("horse-preg", "Equus caballus", GEST, "How many days is a horse pregnant?", "days", 1, lambda a, g: f"Roughly {fmt(a/30.44,0)} months. Foals can usually stand within hours of birth.", 1, 3),
    ("rabbit-preg", "Oryctolagus cuniculus", GEST, "How many days is a European rabbit pregnant?", "days", 1, lambda a, g: f"Short pregnancies and litters of about {fmt(g('Oryctolagus cuniculus', LIT),0)} explain their reputation.", 2, 3),
    ("cat-preg", "Felis catus", GEST, "How many days is a house cat pregnant?", "days", 1, lambda a, g: f"About {fmt(a/7,0)} weeks.", 1, 2.6),
    ("dog-preg", "Canis familiaris", GEST, "How many days is a dog pregnant?", "days", 1, lambda a, g: "Great Danes and Chihuahuas take about the same time.", 1, 2.6),
    ("blue-whale-preg", "Balaenoptera musculus", GEST, "How many days is a blue whale pregnant?", "days", 1, lambda a, g: f"About {fmt(a/30.44,0)} months, less than an elephant needs.", 2, 3),
    ("mouse-preg", "Mus musculus", GEST, "How many days is a house mouse pregnant?", "days", 1, lambda a, g: "A pair can raise several litters in a single year.", 2, 2.6),
    ("hamster-preg", "Mesocricetus auratus", GEST, "How many days is a golden hamster pregnant?", "days", 1, lambda a, g: "It is one of the shortest pregnancies of any mammal with a placenta.", 2, 2.6),
    ("hippo-preg", "Hippopotamus amphibius", GEST, "How many days is a hippopotamus pregnant?", "days", 1, lambda a, g: f"About {fmt(a/30.44,0)} months, shorter than a human pregnancy.", 2, 3),
    ("rhino-preg", "Ceratotherium simum", GEST, "How many days is a white rhinoceros pregnant?", "days", 1, lambda a, g: f"About {fmt(a/30.44,0)} months.", 2, 3),
    ("giraffe-birth", "Giraffa camelopardalis", BW, "How many kilograms does a newborn giraffe weigh?", "kg", 0.001, lambda a, g: f"About {fmt(a*2.20462,0)} pounds on day one.", 2, 3.4),
    ("bluewhale-birth", "Balaenoptera musculus", BW, "How many kilograms does a newborn blue whale weigh?", "kg", 0.001, lambda a, g: "It then gains weight faster than almost any other animal.", 2, 4),
    ("kangaroo-birth", "Osphranter rufus|Macropus rufus", BW, "How many grams does a newborn red kangaroo weigh?", "grams", 1, lambda a, g: "It is about the size of a jellybean and climbs to the pouch by itself.", 3, 5),
    ("panda-birth", "Ailuropoda melanoleuca", BW, "How many grams does a newborn giant panda weigh?", "grams", 1, lambda a, g: f"Its mother weighs about {fmt(g('Ailuropoda melanoleuca', AW)/a,0)} times as much.", 2, 4),
    ("koala-birth", "Phascolarctos cinereus", BW, "How many grams does a newborn koala weigh?", "grams", 1, lambda a, g: "It spends about its first half year in the pouch.", 3, 5),
    ("elephant-birth", "Loxodonta africana", BW, "How many kilograms does a newborn African elephant weigh?", "kg", 0.001, lambda a, g: "It stands within hours and can walk with the herd in a day or two.", 1, 3.4),
    ("polar-birth", "Ursus maritimus", BW, "How many grams does a newborn polar bear weigh?", "grams", 1, lambda a, g: f"An adult in the same table weighs {fmt(g('Ursus maritimus', AW)/1000,0)} kg.", 3, 4),
    ("lion-birth", "Panthera leo", BW, "How many grams does a newborn lion weigh?", "grams", 1, lambda a, g: "Cubs are born with spots that fade as they grow.", 2, 4),
    ("grizzly-birth", "Ursus arctos", BW, "How many grams does a newborn brown bear weigh?", "grams", 1, lambda a, g: "They are born in the den while the mother is half asleep.", 3, 4),
    ("mouse-birth", "Mus musculus", BW, "How many grams does a newborn house mouse weigh?", "grams", 1, lambda a, g: "It is born blind, deaf and without fur.", 3, 4),
    ("greenland", "Somniosus microcephalus", LONG, "How many years old was the oldest Greenland shark, by the best estimate?", "years", 1, lambda a, g: "Scientists dated it from the lens of its eye.", 2, 3),
    ("bowhead", "Balaena mysticetus", LONG, "How many years has a bowhead whale been estimated to live?", "years", 1, lambda a, g: "Old stone harpoon tips found in living whales were an early clue.", 2, 3),
    ("hummingbird", "Archilochus colubris", LONG, "How many years did the oldest known ruby-throated hummingbird live?", "years", 1, lambda a, g: "That is a long run for a bird that weighs about as much as a coin.", 3, 2.8),
    ("ostrich-age", "Struthio camelus", LONG, "How many years did the oldest ostrich on record live?", "years", 1, lambda a, g: "It is also the heaviest living bird.", 2, 2.8),
    ("bat", "Myotis brandtii", LONG, "Brandt's bat weighs less than two nickels. How many years did the oldest one live?", "years", 1, lambda a, g: "For its size no mammal is known to live longer.", 3, 3),
    ("lion-age", "Panthera leo", LONG, "How many years did the oldest lion on record live?", "years", 1, lambda a, g: "Wild males rarely get past half of that.", 2, 2.6),
    ("mouse-age", "Mus musculus", LONG, "How many years did the oldest house mouse on record live?", "years", 1, lambda a, g: "Lab mice on restricted diets hold the top spots.", 2, 2.6),
    ("eagle-age", "Haliaeetus leucocephalus", LONG, "How many years did the oldest bald eagle on record live?", "years", 1, lambda a, g: "They do not get the white head until about age five.", 2, 2.8),
    ("beaver-age", "Castor canadensis", LONG, "How many years did the oldest American beaver on record live?", "years", 1, lambda a, g: "Their front teeth never stop growing.", 2, 2.8),
    ("hummer-weight", "Archilochus colubris", AW, "How many grams does a ruby-throated hummingbird weigh?", "grams", 1, lambda a, g: "Some cross the Gulf of Mexico without stopping.", 2, 4),
    ("shrew-weight", "Suncus etruscus", AW, "The Etruscan shrew is one of the smallest mammals. How many grams does it weigh?", "grams", 1, lambda a, g: "It has to eat almost constantly to keep warm.", 3, 4.5),
    ("capybara-weight", "Hydrochoerus hydrochaeris", AW, "How many kilograms does a capybara, the largest rodent, weigh?", "kg", 0.001, lambda a, g: f"A house mouse weighs {fmt(g('Mus musculus', AW))} grams.", 2, 3.4),
    ("ostrich-weight", "Struthio camelus", AW, "How many kilograms does an ostrich weigh?", "kg", 0.001, lambda a, g: "It cannot fly but outruns nearly everything that chases it.", 1, 3),
    ("cheetah-preg", "Acinonyx jubatus", GEST, "How many days is a cheetah pregnant?", "days", 1, lambda a, g: "Newborns have a silver mane that may make them look like honey badgers.", 2, 2.8),
    ("tiger-preg", "Panthera tigris", GEST, "How many days is a tiger pregnant?", "days", 1, lambda a, g: f"About {fmt(a/30.44,0)} months, and the cubs are born blind.", 2, 2.8),
    ("wolf-preg", "Canis lupus", GEST, "How many days is a gray wolf pregnant?", "days", 1, lambda a, g: "It is the same as for a dog, its close relative.", 2, 2.6),
    ("cow-preg", "Bos taurus", GEST, "How many days is a cow pregnant?", "days", 1, lambda a, g: f"About {fmt(a/30.44,0)} months, close to a human pregnancy.", 1, 2.8),
    ("pig-preg", "Sus scrofa", GEST, "How many days is a pig pregnant?", "days", 1, lambda a, g: "Farmers remember it as three months, three weeks and three days.", 2, 2.8),
    ("sheep-preg", "Ovis aries", GEST, "How many days is a sheep pregnant?", "days", 1, lambda a, g: f"About {fmt(a/30.44,0)} months, timed so lambs arrive with spring grass.", 2, 2.8),
    ("camel-preg", "Camelus dromedarius", GEST, "How many days is a one-humped camel pregnant?", "days", 1, lambda a, g: f"About {fmt(a/30.44,0)} months. Calves are born without a hump.", 2, 2.8),
    ("chimp-preg", "Pan troglodytes", GEST, "How many days is a chimpanzee pregnant?", "days", 1, lambda a, g: f"A human pregnancy in the same table is {fmt(g('Homo sapiens', GEST))} days.", 2, 2.6),
    ("dolphin-preg", "Tursiops truncatus", GEST, "How many days is a bottlenose dolphin pregnant?", "days", 1, lambda a, g: "Calves are born tail first so they do not drown.", 2, 2.8),
    ("orca-preg", "Orcinus orca", GEST, "How many days is an orca pregnant?", "days", 1, lambda a, g: f"About {fmt(a/30.44,0)} months.", 2, 2.8),
    ("walrus-preg", "Odobenus rosmarus", GEST, "How many days is a walrus pregnant, counting the weeks before the embryo settles?", "days", 1, lambda a, g: "Mothers usually have one calf every two or three years.", 3, 2.8),
    ("zebra-preg", "Equus quagga|Equus burchellii", GEST, "How many days is a plains zebra pregnant?", "days", 1, lambda a, g: "Foals learn their mother's stripes right away.", 2, 2.8),
    ("squirrel-preg", "Sciurus carolinensis", GEST, "How many days is a gray squirrel pregnant?", "days", 1, lambda a, g: "Newborns weigh about as much as a few paper clips.", 2, 2.6),
    ("beaver-preg", "Castor canadensis", GEST, "How many days is an American beaver pregnant?", "days", 1, lambda a, g: "The young stay with the family for about two years.", 3, 2.6),
    ("sloth-preg", "Choloepus hoffmanni", GEST, "How many days is a two-toed sloth pregnant?", "days", 1, lambda a, g: "It even gives birth hanging upside down.", 3, 2.8),
    ("hedgehog-preg", "Erinaceus europaeus", GEST, "How many days is a European hedgehog pregnant?", "days", 1, lambda a, g: "The first spines are under the skin at birth.", 3, 2.6),
    ("bluewhale-weight", "Balaenoptera musculus", AW, "How many kilograms does a blue whale weigh, on average?", "kg", 0.001, lambda a, g: f"A newborn already weighs about {fmt(g('Balaenoptera musculus', BW)/1000)} kg.", 1, 4),
    ("elephant-weight", "Loxodonta africana", AW, "How many kilograms does an African elephant weigh?", "kg", 0.001, lambda a, g: "Males keep growing for most of their lives.", 1, 3.4),
    ("hippo-weight", "Hippopotamus amphibius", AW, "How many kilograms does a hippopotamus weigh?", "kg", 0.001, lambda a, g: "It walks along the river bottom and does not really swim.", 2, 3.4),
    ("gorilla-weight", "Gorilla gorilla", AW, "How many kilograms does a gorilla weigh, averaged over adults?", "kg", 0.001, lambda a, g: "Males can weigh twice as much as females.", 2, 3.2),
    ("polar-weight", "Ursus maritimus", AW, "How many kilograms does a polar bear weigh, on average?", "kg", 0.001, lambda a, g: f"Its cubs are born at about {fmt(g('Ursus maritimus', BW))} grams.", 1, 3.2),
    ("koala-weight", "Phascolarctos cinereus", AW, "How many kilograms does a koala weigh?", "kg", 0.001, lambda a, g: "It sleeps most of the day because leaves give so little energy.", 1, 3),
    ("wombat-weight", "Vombatus ursinus", AW, "How many kilograms does a common wombat weigh?", "kg", 0.001, lambda a, g: "Its pouch opens backward so it does not fill with dirt.", 2, 3),
    ("fox-weight", "Vulpes vulpes", AW, "How many kilograms does a red fox weigh?", "kg", 0.001, lambda a, g: "Most of what looks like fox is fur.", 1, 3),
    ("mouse-weight", "Mus musculus", AW, "How many grams does a house mouse weigh?", "grams", 1, lambda a, g: f"A newborn is {fmt(g('Mus musculus', BW))} grams.", 1, 3.4),
    ("squirrel-weight", "Sciurus carolinensis", AW, "How many grams does a gray squirrel weigh?", "grams", 1, lambda a, g: "It can fall from any tree without getting hurt.", 2, 3.2),
    ("barnowl-weight", "Tyto alba", AW, "How many grams does a barn owl weigh?", "grams", 1, lambda a, g: "Its feathers are shaped to make almost no sound.", 2, 3.2),
    ("robin-weight", "Turdus migratorius", AW, "How many grams does an American robin weigh?", "grams", 1, lambda a, g: "It finds worms mostly by sight.", 2, 3),
    ("crow-age", "Corvus brachyrhynchos", LONG, "How many years did the oldest American crow on record live?", "years", 1, lambda a, g: "Crows can remember a face for years.", 3, 2.8),
    ("albatross-age", "Phoebastria immutabilis|Diomedea immutabilis", LONG, "How many years did the oldest Laysan albatross on record live?", "years", 1, lambda a, g: "It can glide for hours without flapping.", 3, 2.8),
    ("tuatara", "Sphenodon punctatus", LONG, "How many years did the oldest tuatara on record live?", "years", 1, lambda a, g: "It looks like a lizard but is the last of a separate line.", 3, 2.8),
    ("dolphin-age", "Tursiops truncatus", LONG, "How many years did the oldest bottlenose dolphin on record live?", "years", 1, lambda a, g: "Each one has its own whistle, used like a name.", 2, 2.6),
    ("wolf-age", "Canis lupus", LONG, "How many years did the oldest gray wolf on record live?", "years", 1, lambda a, g: "In the wild few reach half of that.", 2, 2.6),
    ("rhino-birth", "Ceratotherium simum", BW, "How many kilograms does a newborn white rhinoceros weigh?", "kg", 0.001, lambda a, g: "The horn starts to show within a couple of months.", 2, 3.4),
    ("hippo-birth", "Hippopotamus amphibius", BW, "How many kilograms does a newborn hippopotamus weigh?", "kg", 0.001, lambda a, g: "Some are born underwater and swim up for a first breath.", 2, 3.4),
    ("orca-birth", "Orcinus orca", BW, "How many kilograms does a newborn orca weigh?", "kg", 0.001, lambda a, g: "Its white patches look orange at first.", 3, 3.4),
    ("tiger-birth", "Panthera tigris", BW, "How many grams does a newborn tiger weigh?", "grams", 1, lambda a, g: f"An adult in the same table weighs {fmt(g('Panthera tigris', AW)/1000,0)} kg.", 2, 3.6),
    ("horse-birth", "Equus caballus", BW, "How many kilograms does a newborn horse weigh?", "kg", 0.001, lambda a, g: "It is mostly legs.", 2, 3.2),
]


def run():
    attempt("animals", go)


def go():
    t = table()
    def get(sp, field):
        return float(t[sp][field])
    for key, species, field, question, unit, f, expl, d, span in LIST:
        def one():
            sp = next(s for s in species.split("|") if s in t)
            r = t[sp]
            if not r[field]:
                raise LookupError(f"{sp} has no {field}")
            if field == LONG and r["Data quality"] not in ("acceptable", "high"):
                raise LookupError(f"{sp} longevity quality {r['Data quality']}")
            v = float(r[field]) * f
            add("an-" + key, question, v, unit, "Animals", span=span, difficulty=d, url=f"https://genomics.senescence.info/species/entry.php?species={sp.replace(' ', '_')}", source="AnAge, Human Ageing Genomic Resources", licence=CCBY3,
                evidence=f"AnAge dataset, {sp} ({r['Common name']}): {field} = {r[field]}; data quality {r['Data quality']}, sample size {r['Sample size']}", explainer=expl(clean(v), get), as_of="On the AnAge research record" if field == LONG else None, check=f"anage|{sp}|{field}", topic="an-" + field[:4], label=(r["Common name"] or sp).split(",")[0].replace("Domestic ", "").strip().capitalize())
        attempt("an-" + key, one)
