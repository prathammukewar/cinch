import csv, io
from lib import *

E = "Everyday life"


def pages():
    P = lambda id, url, pat, q, unit, src, ex, cat=E, **k: page(id, url, pat, q, unit, cat, src, ex, **k)
    P("ev-trash", "https://www.epa.gov/facts-and-figures-about-materials-waste-and-recycling/national-overview-facts-and-figures-materials", r"(4\.9) pounds per person per day", "How many pounds of trash does the average American make in a day?", "pounds", "US Environmental Protection Agency", "Containers and packaging are the largest piece.", span=3, difficulty=1, as_of="EPA estimate for 2018")
    P("ev-shower", "https://www.epa.gov/watersense/showerheads", r"nearly (40) gallons per day", "How many gallons of water a day does the average US family use in the shower?", "gallons", "US Environmental Protection Agency", "Only toilets use more water indoors.", span=3, difficulty=2)
    P("ev-showerhead", "https://www.epa.gov/watersense/showerheads", r"(2\.5) gallons of water per minute", "How many gallons a minute does a standard US showerhead use?", "gallons", "US Environmental Protection Agency", "Water-saving models have to use a fifth less.", span=2.6, difficulty=2)
    P("ev-toilet", "https://www.epa.gov/watersense/residential-toilets", r"(1\.6) gallons per flush", "How many gallons per flush may a new US toilet use at most?", "gallons", "US Environmental Protection Agency", "Some old ones use several times that.", span=2.6, difficulty=2)
    P("ev-power", "https://www.eia.gov/tools/faqs/faq.php?id=97&t=3", r"([\d,]+) kilowatthours", "How many kilowatt-hours of electricity does the average US home buy in a year?", "kWh", "US Energy Information Administration", "Heating and cooling account for much of it, so it varies a lot by state.", span=3.4, difficulty=2, as_of="In 2022")
    P("en-hoover-h", "https://www.usbr.gov/lc/hooverdam/faqs/damfaqs.html", r"(726\.4) feet", "How many feet tall is Hoover Dam?", "feet", "US Bureau of Reclamation", "It was the tallest dam in the world when it was finished.", cat="Engineering", span=2.8, difficulty=2)
    P("en-hoover-w", "https://www.usbr.gov/lc/hooverdam/faqs/damfaqs.html", r"([\d,]+) tons", "How many tons does Hoover Dam weigh?", "tons", "US Bureau of Reclamation", "It is thickest at the bottom, where the water pushes hardest.", cat="Engineering", span=4, difficulty=3)
    P("en-wash-steps", "https://www.nps.gov/wamo/faqs.htm", r"(896) steps", "How many steps are inside the Washington Monument?", "steps", "National Park Service", "Visitors take the elevator.", cat="Engineering", span=2.8, difficulty=2)
    P("en-wash-h", "https://www.nps.gov/wamo/faqs.htm", r"(555) feet", "How many feet tall is the Washington Monument, to the nearest foot?", "feet", "National Park Service", "You can see where the stone changes color, because work stopped for decades.", cat="Engineering", span=2.4, difficulty=2)
    P("en-arch-h", "https://www.nps.gov/jeff/planyourvisit/gateway-arch-fact-sheet.htm", r"Maximum Height (630)", "How many feet tall is the Gateway Arch in St. Louis?", "feet", "National Park Service", "It is exactly as wide as it is tall, though it never looks it.", cat="Engineering", span=2.4, difficulty=2)
    P("en-arch-steel", "https://www.nps.gov/jeff/planyourvisit/gateway-arch-fact-sheet.htm", r"Exterior Skin[^\d]{0,12}(886) Tons", "How many tons of stainless steel cover the Gateway Arch?", "tons", "National Park Service", "The skin carries much of the load, so there is no frame like a skyscraper's.", cat="Engineering", span=3.4, difficulty=3)
    P("en-arch-top", "https://www.nps.gov/jeff/planyourvisit/gateway-arch-fact-sheet.htm", r"Arch at Top (\d+) ft", "How many feet wide is each side of the Gateway Arch at the very top?", "feet", "National Park Service", "A viewing room with small windows fits inside.", cat="Engineering", span=2.6, difficulty=3)
    P("ev-power-la", "https://www.eia.gov/tools/faqs/faq.php?id=97&t=3", r"Louisiana had the highest annual electricity purchases per residential customer at ([\d,]+) kWh", "How many kilowatt-hours does the average home in Louisiana buy in a year, the most of any state?", "kWh", "US Energy Information Administration", "Hot, damp summers keep the air conditioning on.", span=3.4, difficulty=3, as_of="In 2022")
    P("en-liberty-waist", "https://www.nps.gov/stli/learn/historyculture/statue-statistics.htm", r"waist[^\d]{0,20}(35)", "How many feet thick is the Statue of Liberty at the waist?", "feet", "National Park Service", "Her copper skin is only about as thick as two pennies.", cat="Engineering", span=2.6, difficulty=3)
    P("en-liberty-arm", "https://www.nps.gov/stli/learn/historyculture/statue-statistics.htm", r"right arm[^\d]{0,20}(42)", "How many feet long is the Statue of Liberty's right arm?", "feet", "National Park Service", "It was shown in Philadelphia and New York before the rest of her arrived.", cat="Engineering", span=2.6, difficulty=2)
    P("en-roads", "https://www.fhwa.dot.gov/policyinformation/statistics/2022/hm20.cfm", r"(4,19\d,\d{3})", "How many miles of public road are there in the United States?", "miles", "US Federal Highway Administration", "Most of it is quiet rural road.", cat="Engineering", span=4.4, difficulty=2, as_of="In 2022")
    P("hi-wright-ft", "https://www.nps.gov/wrbr/learn/historyculture/thefirstflight.htm", r"(852) feet", "How many feet did the Wright brothers' longest flight cover on their first day?", "feet", "National Park Service", "It was the last of several tries that day, and a gust then wrecked the plane.", cat="History", span=3.4, difficulty=2)
    P("hi-wright-first", "https://www.nps.gov/wrbr/learn/historyculture/thefirstflight.htm", r"(120) feet", "How many feet did the Wright brothers' very first powered flight cover?", "feet", "National Park Service", "It is shorter than the wingspan of many airliners.", cat="History", span=3.4, difficulty=1)
    P("hi-lewis", "https://www.nps.gov/lecl/faqs.htm", r"([\d,]+) miles", "How many miles long is the Lewis and Clark National Historic Trail?", "miles", "National Park Service", "It runs from Pittsburgh to the mouth of the Columbia River.", cat="History", span=3, difficulty=2)
    P("hi-parks-1904", "https://www.nps.gov/aboutus/visitation-numbers.htm", r"1904\s+([\d,]+)", "How many visits did US national parks get in 1904?", "visits", "National Park Service", "Today a single busy day can beat it.", cat="History", span=4.4, difficulty=2)
    P("hu-taste", "https://www.nidcd.nih.gov/health/taste-disorders", r"about ([\d,]+) taste buds", "About how many taste buds are people born with?", "taste buds", "NIH, NIDCD", "They wear out and regrow about every two weeks, and fewer come back with age.", cat="Human body", span=3.6, difficulty=2)
    P("hu-kidney", "https://www.niddk.nih.gov/health-information/kidney-disease/kidneys-how-they-work", r"(150) quarts", "How many quarts of blood do healthy kidneys filter in a day?", "quarts", "NIH, NIDDK", "The same blood goes round many times. Only a quart or two leaves as urine.", cat="Human body", span=3.4, difficulty=2)
    P("hu-bones-app", "https://training.seer.cancer.gov/anatomy/skeletal/divisions/", r"appendicular skeleton[^.]{0,80}?(126)", "How many of an adult's 206 bones are in the arms, legs, shoulders and hips?", "bones", "NIH, SEER Training", "More than half of all your bones are in your hands and feet.", cat="Human body", scale="linear", span=206, difficulty=2, whole=True, lo=0, hi=206)
    P("hu-brain-water", "https://www.usgs.gov/special-topics/water-science-school/science/water-you-water-and-human-body", r"brain and heart are composed of (73)%", "What percent of the human brain is water?", "%", "US Geological Survey", "Even bones are about a third water.", cat="Human body", scale="linear", span=100, lo=0, hi=100, difficulty=2)
    P("hu-lung-water", "https://www.usgs.gov/special-topics/water-science-school/science/water-you-water-and-human-body", r"lungs are about (83)%", "What percent of the lungs is water?", "%", "US Geological Survey", "It is the wettest of the organs on the list.", cat="Human body", scale="linear", span=100, lo=0, hi=100, difficulty=3)
    P("hu-bone-water", "https://www.usgs.gov/special-topics/water-science-school/science/water-you-water-and-human-body", r"bones are watery: (31)%", "What percent of living human bone is water?", "%", "US Geological Survey", "Bone is living tissue with its own blood supply.", cat="Human body", scale="linear", span=100, lo=0, hi=100, difficulty=3)
    P("hu-skin-water", "https://www.usgs.gov/special-topics/water-science-school/science/water-you-water-and-human-body", r"skin contains (64)% water", "What percent of human skin is water?", "%", "US Geological Survey", "The outermost layer is far drier than the rest.", cat="Human body", scale="linear", span=100, lo=0, hi=100, difficulty=2)
    P("hu-genes", "https://www.genome.gov/genetics-glossary/Gene", r"about ([\d,]+) (?:protein-coding )?genes|(?:approximately|about) (20,000)", "About how many genes that code for proteins do people have?", "genes", "National Human Genome Research Institute", "A grape plant has more.", cat="Human body", span=4, difficulty=2) if False else None
    P("hi-nara", "https://www.archives.gov/about/info/national-archives-by-the-numbers", r"(13\.5 billion) pieces of paper", "How many pieces of paper does the US National Archives hold?", "pieces", "US National Archives", "Laid end to end they would circle Earth many times.", cat="History", span=5, difficulty=2)


def genome():
    def g1():
        j = fetch_json("https://api.ncbi.nlm.nih.gov/datasets/v2/genome/accession/GCF_000001405.40/dataset_report")
        n = int(j["reports"][0]["assembly_stats"]["total_sequence_length"])
        add("hu-genome", "How many letters long is one full copy of the human genome?", n, "letters", "Human body", span=5, difficulty=2, url="https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_000001405.40/", source="NCBI Datasets, NIH", licence=PD, evidence=f"GRCh38.p14 total_sequence_length = {n}", explainer="Nearly every cell carries two copies.", check="ncbi-genome")
    def g2():
        j = fetch_json("https://api.ncbi.nlm.nih.gov/datasets/v2/genome/accession/GCF_000001405.40/sequence_reports?page_size=1000")
        ch = {}
        for r in j["reports"]:
            if r.get("role") == "assembled-molecule": ch[r["chr_name"]] = int(r["length"])
        for nm, key, q, ex, d in [("1", "chr1", "Chromosome 1 is the longest human chromosome. How many letters of DNA does it hold?", f"The Y chromosome holds {fmt(ch['Y'])}.", 3), ("21", "chr21", "Chromosome 21 is the shortest human chromosome. How many letters of DNA does it hold?", f"Chromosome 1 holds {fmt(ch['1'])}.", 3), ("MT", "chrM", "Mitochondria carry their own small ring of DNA. How many letters long is it?", "You inherit it only from your mother.", 3)]:
            add("hu-" + key, q, ch[nm], "letters", "Human body", span=4.4, difficulty=d, url="https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_000001405.40/", source="NCBI Datasets, NIH", licence=PD, evidence=f"GRCh38.p14 sequence report: {nm} length {ch[nm]}", explainer=ex, check=f"ncbi|{nm}", topic="hu-chr")
    def g3():
        for acc, key, q, ex in [("Q8WZ42", "titin", "Titin is the largest human protein. How many amino acids make up its chain?", "It works as a spring inside muscle."), ("P68871", "hemo", "How many amino acids are in one beta chain of human hemoglobin, as first made?", "Four chains fold together to carry oxygen."), ("P01308", "insulin", "How many amino acids long is the chain that gets cut down to make human insulin?", "Finished insulin is less than half of it."), ("P02452", "collagen", "How many amino acids long is the chain that becomes type 1 collagen, the main protein in skin and bone?", "Three of them wind together like a rope.")]:
            j = fetch_json(f"https://rest.uniprot.org/uniprotkb/{acc}.json?fields=length,organism_name", headers={"Accept": "application/json"})
            if "Homo sapiens" not in json.dumps(j): raise LookupError(acc)
            L = j["sequence"]["length"]
            add("hu-" + key, q, L, "amino acids", "Human body", span=3.6, difficulty=3, url=f"https://www.uniprot.org/uniprotkb/{acc}", source="UniProt", licence=CCBY, evidence=f"UniProt {acc} sequence length {L}", explainer=ex, check=f"uniprot|{acc}", topic="hu-protein")
    for f in (g1, g2, g3): attempt("genome." + f.__name__, f)


def run():
    for f in (pages, genome):
        attempt(f"everyday.{f.__name__}", f)
