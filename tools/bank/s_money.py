from lib import *

FED = "https://www.federalreserve.gov/faqs/how-long-is-the-life-span-of-us-paper-money.htm"
COST = "https://www.federalreserve.gov/faqs/currency_12771.htm"
VOL = "https://www.federalreserve.gov/paymentsystems/coin_currcircvolume.htm"
USC = "https://www.law.cornell.edu/uscode/text/31/5112"


def fed():
    t = text(FED)
    for d, ans_d, ex, df in [("1", "one", "Small bills change hands far more often than big ones.", 1), ("5", "five", "The five and the ten wear out fastest.", 2), ("10", "ten", "It wears out sooner than the one.", 2), ("20", "twenty", "It is the bill most cash machines hand out.", 1), ("50", "fifty", "Many people go months without touching one.", 2), ("100", "hundred", "It is mostly held, not spent, and much of it sits abroad.", 2)]:
        def go():
            v, snip = find(t, rf"\${d}\s+(\d+\.\d+)\s+years")
            add(f"mo-life-{d}", f"How many years does a US ${d} bill last before it wears out?", v, "years", "Money", span=3, difficulty=df, url=FED, source="Federal Reserve Board", licence=PD, evidence=snip, explainer=ex, as_of="Federal Reserve estimate", check=f"page|\\${d}\\s+(\\d+\\.\\d+)\\s+years", topic="mo-life")
        attempt(f"mo-life-{d}", go)
    t2 = text(COST)
    for d, ex, df in [("1", "It is made of cotton and linen, with no wood pulp.", 1), ("100", "Its color-shifting ink and woven security ribbon add to the bill.", 2), ("20", "Printing is cheap. Keeping it hard to copy is the expensive part.", 2)]:
        def go():
            v, snip = find(t2, rf"\${d}(?: and \$\d+)?\s+(\d+\.\d+) cents")
            add(f"mo-cost-{d}", f"How many cents does it cost to print a US ${d} bill?", v, "cents", "Money", span=3.4, difficulty=df, url=COST, source="Federal Reserve Board", licence=PD, evidence=snip, explainer=ex, as_of="Federal Reserve figure", check=f"page2", topic="mo-cost")
        attempt(f"mo-cost-{d}", go)


def volume():
    raw = fetch(VOL)
    i = raw.find("Volume of currency")
    rows = [[plain(c) for c in re.findall(r"(?is)<t[dh][^>]*>(.*?)</t[dh]>", tr)] for tr in re.findall(r"(?is)<tr[^>]*>(.*?)</tr>", raw)]
    hdr = next(r for r in rows if any("$100" in c for c in r) and any("$2" == c.strip() or "$2" in c for c in r))
    row = next(r for r in rows if r and re.match(r"^20\d\d$", r[0]))
    for d, q, ex, df in [("$1", "How many one dollar bills are in circulation?", "There are more hundreds than ones.", 2), ("$2", "How many two dollar bills are in circulation?", "They are still printed. People just keep them.", 2), ("$100", "How many hundred dollar bills are in circulation?", "It is the most common US bill there is.", 2)]:
        k = next(i for i, c in enumerate(hdr) if re.sub(r"\s.*", "", c) == d)
        add(f"mo-vol-{d[1:]}", q, number(row[k]) * 1e9, "bills", "Money", span=5, difficulty=df, url=VOL, source="Federal Reserve Board", licence=PD, evidence=f"{' | '.join(hdr)} :: {' | '.join(row)} (billions of notes)", explainer=ex, as_of=f"At the end of {row[0]}", check="fed-volume", topic="mo-vol")


def coins():
    t = text(USC)
    for nm, pat, q, u, ex, df in [
        ("quarter-w", r"quarter dollar coin that is [\d.]+ inch in diameter and weighs ([\d.]+) grams", "How many grams does a US quarter weigh?", "grams", "Two dimes weigh almost the same as it does.", 2),
        ("dime-w", r"dime coin that is [\d.]+ inch in diameter and weighs ([\d.]+) grams", "How many grams does a US dime weigh?", "grams", "Size follows old silver value, so it is smaller than the nickel.", 2),
        ("nickel-w", r"5-cent coin that is [\d.]+ inch in diameter and weighs (\d+) grams", "How many grams does a US nickel weigh?", "grams", "It is a handy kitchen weight, set at a round number by law.", 1),
        ("half-w", r"half dollar coin that is [\d.]+ inches in diameter and weighs ([\d.]+) grams", "How many grams does a US half dollar weigh?", "grams", "Exactly twice a quarter.", 2),
    ]:
        page(f"mo-{nm}", USC, pat, q, u, "Money", "US Code, 31 USC 5112", ex, span=2.8, difficulty=df, topic="mo-coin")


def treasury():
    u = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/gold_reserve?sort=-record_date&page[size]=30"
    j = fetch_json(u)
    date = j["data"][0]["record_date"]
    rows = [r for r in j["data"] if r["record_date"] == date]
    knox = sum(float(r["fine_troy_ounce_qty"]) for r in rows if "Knox" in json.dumps(r))
    tot = sum(float(r["fine_troy_ounce_qty"]) for r in rows)
    add("mo-knox", "How many tonnes of gold does Fort Knox hold?", round(knox * 31.1034768 / 1e6, 1), "tonnes", "Money", span=4, difficulty=3, url="https://fiscaldata.treasury.gov/datasets/status-report-government-gold-reserve/", source="US Treasury Fiscal Data", licence=PD, evidence=f"gold_reserve {date}: Fort Knox {knox} fine troy ounces x 31.1034768 g", explainer=f"That is {fmt(100 * knox / tot, 0)}% of the US government's gold.", as_of=f"On {date}", check="gold", topic="mo-gold")


def fdic():
    j = fetch_json("https://api.fdic.gov/banks/institutions?filters=ACTIVE:1&limit=1&fields=NAME")
    n = j["meta"]["total"]
    add("mo-banks", "How many FDIC-insured banks are there in the United States?", n, "banks", "Money", span=4, difficulty=2, url="https://banks.data.fdic.gov/bankfind-suite/bankfind", source="FDIC BankFind", licence=PD, evidence=f"api.fdic.gov institutions ACTIVE:1 total = {n}", explainer="Most are small and local. A handful hold most of the money.", as_of="November 2026", check="fdic")


SEC = [
    ("mcd", 63908, "McDonald's", "Revenues|RevenueFromContractWithCustomerExcludingAssessedTax", "How much revenue did McDonald's take in over the year?", "Most of its restaurants are franchises, so this is far less than customers spend at the counter.", 1),
    ("cost", 909832, "Costco", "Revenues|RevenueFromContractWithCustomerExcludingAssessedTax", "How much revenue did Costco take in over the year?", "Membership fees are a thin slice of sales but a large share of profit.", 1),
    ("nke", 320187, "Nike", "Revenues|RevenueFromContractWithCustomerExcludingAssessedTax", "How much revenue did Nike take in over the year?", "Shoes bring in roughly two thirds of it.", 2),
    ("dis", 1744489, "Disney", "Revenues|RevenueFromContractWithCustomerExcludingAssessedTax", "How much revenue did Disney take in over the year?", "Parks and cruises now rival the studio that made the name.", 2),
    ("nflx", 1065280, "Netflix", "Revenues|RevenueFromContractWithCustomerExcludingAssessedTax", "How much revenue did Netflix take in over the year?", "It began by mailing discs in red envelopes.", 2),
    ("sbux", 829224, "Starbucks", "Revenues|RevenueFromContractWithCustomerExcludingAssessedTax", "How much revenue did Starbucks take in over the year?", "It has tens of thousands of shops, and beverages are most of it.", 2),
    ("hsy", 47111, "Hershey", "RevenueFromContractWithCustomerExcludingAssessedTax|Revenues", "How much revenue did Hershey take in over the year?", "In the US it also makes Kit Kat bars under license.", 2),
    ("dpz", 1286681, "Domino's", "Revenues|RevenueFromContractWithCustomerExcludingAssessedTax", "How much revenue did Domino's Pizza take in over the year?", "Selling dough and cheese to its own franchises is the biggest piece.", 3),
    ("mat", 63276, "Mattel", "Revenues|RevenueFromContractWithCustomerExcludingAssessedTax", "How much revenue did Mattel, the maker of Barbie, take in over the year?", "It also makes Hot Wheels and Uno.", 3),
    ("mnst", 865752, "Monster", "Revenues|RevenueFromContractWithCustomerExcludingAssessedTax|SalesRevenueNet", "How much revenue did Monster Beverage, the energy drink maker, take in over the year?", "The company started out in fruit juice.", 3),
    ("crox", 1334036, "Crocs", "Revenues|RevenueFromContractWithCustomerExcludingAssessedTax", "How much revenue did Crocs, the shoe company, take in over the year?", "The clogs were first sold as boating shoes.", 3),
    ("wwe", 1035267, "Intuitive", "Revenues|RevenueFromContractWithCustomerExcludingAssessedTax", "How much revenue did Intuitive Surgical, the maker of the da Vinci surgery robot, take in over the year?", "Much of it comes from instruments that wear out and get replaced.", 3),
]


def sec():
    for key, cik, nm, tags, q, ex, d in SEC:
        def go():
            best = None
            for tag in tags.split("|"):
                try:
                    j = fetch_json(f"https://data.sec.gov/api/xbrl/companyconcept/CIK{cik:010d}/us-gaap/{tag}.json")
                except RuntimeError:
                    continue
                if nm.split()[0].lower().replace("'s", "") not in j["entityName"].lower().replace("'s", ""):
                    raise LookupError(j["entityName"])
                for f in j["units"]["USD"]:
                    if f.get("form") != "10-K" or f.get("fp") != "FY" or "start" not in f: continue
                    import datetime as dt; days = (dt.date.fromisoformat(f["end"]) - dt.date.fromisoformat(f["start"])).days
                    if 340 <= days <= 385 and (best is None or (f["end"], f["filed"], f["val"]) > (best[0]["end"], best[0]["filed"], best[0]["val"])):
                        best = (f, tag, j["entityName"])
            f, tag, ent = best
            if f["end"] < "2025-01-01": raise LookupError(f"old {f['end']}")
            add(f"mo-rev-{key}", q, f["val"], "US dollars", "Money", span=4, difficulty=d, url=f"https://data.sec.gov/api/xbrl/companyconcept/CIK{cik:010d}/us-gaap/{tag}.json", source="Company filing with the SEC", licence=PD, evidence=f"{ent}, {tag}, {f['start']} to {f['end']}, form {f['form']} filed {f['filed']}: {f['val']} USD", explainer=ex, as_of=f"Fiscal year ending {f['end']}", check=f"sec|{cik}|{tag}", topic="mo-rev")
        attempt(f"mo-rev-{key}", go)


def run():
    for f in (fed, volume, coins, treasury, fdic, sec):
        attempt(f"money.{f.__name__}", f)
