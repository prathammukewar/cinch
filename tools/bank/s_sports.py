import csv, io, zipfile
from collections import Counter
from lib import *

S = "Sports"
FOOT = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv"
NFL = "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv"
RETRO = 'The information used here was obtained free of charge from and is copyrighted by Retrosheet. Interested parties may contact Retrosheet at "www.retrosheet.org".'


def soccer():
    rows = [r for r in csv.DictReader(io.StringIO(fetch(FOOT))) if r["home_score"].isdigit() and r["away_score"].isdigit()]
    tot = [int(r["home_score"]) + int(r["away_score"]) for r in rows]
    last = rows[-1]["date"]
    def q(id, question, v, unit, ev, ex, d, **k):
        add("so-" + id, question, v, unit, S, difficulty=d, url="https://github.com/martj42/international_results", source="International football results dataset", licence=CC0, evidence=ev + f" ({len(rows)} matches to {last})", explainer=ex, check="soccer|" + id, **k)
    nil = 100 * sum(t == 0 for t in tot) / len(tot)
    q("nil-nil", "What percent of men's international soccer matches end 0-0?", round(nil, 1), "%", f"share with zero goals {nil:.3f}%", f"The average match has {fmt(sum(tot)/len(tot),1)} goals.", 2, scale="linear", span=60, lo=0, hi=100)
    m = max(range(len(rows)), key=lambda i: tot[i])
    q("most-goals", "What is the most goals scored in one men's international soccer match?", tot[m], "goals", f"{rows[m]['date']} {rows[m]['home_team']} {rows[m]['home_score']}-{rows[m]['away_score']} {rows[m]['away_team']}", f"{rows[m]['home_team']} beat {rows[m]['away_team']} {rows[m]['home_score']} to {rows[m]['away_score']} in {rows[m]['date'][:4]}.", 2, span=3, whole=True)
    q("games-total", "An open record of men's international soccer lists every match since the first in 1872. How many matches does it hold?", len(rows), "matches", f"rows with a score, first {rows[0]['date']}", "The first, Scotland against England, finished with no goals at all.", 3, span=4.4, as_of=f"Through {last[:4]}")
    hw = 100 * sum(int(r["home_score"]) > int(r["away_score"]) for r in rows if r["neutral"].upper() == "FALSE") / sum(r["neutral"].upper() == "FALSE" for r in rows)
    q("home-wins", "What percent of men's international soccer matches does the home team win, when there is a true home team?", round(hw, 1), "%", f"non-neutral matches won by home side {hw:.3f}%", "Crowds, travel and familiar ground all seem to help.", 2, scale="linear", span=100, lo=0, hi=100)
    for y in (1994, 2014, 2022):
        wc = [t for r, t in zip(rows, tot) if r["tournament"] == "FIFA World Cup" and r["date"].startswith(str(y))]
        q(f"wc-{y}", f"How many goals were scored at the {y} men's World Cup?", sum(wc), "goals", f"{len(wc)} matches in {y}, {sum(wc)} goals", f"That was over {len(wc)} matches, shootouts not counted.", 2, span=3, whole=True)
    eng = [r for r in rows if "Brazil" in (r["home_team"], r["away_team"])]
    g = sum(int(r["home_score"]) if r["home_team"] == "Brazil" else int(r["away_score"]) for r in eng)
    q("brazil-goals", "How many goals has Brazil's men's national team scored in its recorded matches?", g, "goals", f"{len(eng)} matches with Brazil, {g} goals", f"They came in {fmt(len(eng))} matches.", 3, span=4, as_of=f"Through {last[:4]}", whole=True)


def nfl():
    rows = [r for r in csv.DictReader(io.StringIO(fetch(NFL))) if r["home_score"] not in ("", "NA")]
    tot = [int(r["home_score"]) + int(r["away_score"]) for r in rows]
    first, last = rows[0]["season"], rows[-1]["season"]
    mg = Counter(abs(int(r["home_score"]) - int(r["away_score"])) for r in rows)
    def q(id, question, v, unit, ev, ex, d, **k):
        add("nfl-" + id, question, v, unit, S, difficulty=d, url="https://github.com/nflverse/nfldata", source="nflverse", licence=CCBY, evidence=ev + f" ({len(rows)} games, {first} to {last})", explainer=ex, check="nfl|" + id, as_of=f"NFL games since {first}", **k)
    i = max(range(len(rows)), key=lambda k: tot[k])
    q("most-points", "What is the most points both teams have scored together in one NFL game?", tot[i], "points", f"{rows[i]['gameday']} {rows[i]['away_team']} {rows[i]['away_score']} at {rows[i]['home_team']} {rows[i]['home_score']}", "Overtime is not what did it. Both defenses simply had a bad day.", 2, span=2.6, whole=True)
    q("by-three", "What percent of NFL games are decided by exactly three points?", round(100 * mg[3] / len(rows), 1), "%", f"{mg[3]} of {len(rows)} decided by 3", "A field goal is worth three, so it is the most common margin.", 2, scale="linear", span=50, lo=0, hi=100)
    ot = sum(r["overtime"] == "1" for r in rows)
    q("overtime", "What percent of NFL games go to overtime?", round(100 * ot / len(rows), 1), "%", f"{ot} of {len(rows)} went to overtime", f"Only {mg[0]} of all these games ended tied.", 2, scale="linear", span=50, lo=0, hi=100)
    hw = sum(int(r["home_score"]) > int(r["away_score"]) for r in rows if r["location"] == "Home")
    hn = sum(r["location"] == "Home" for r in rows)
    q("home-win", "What percent of NFL games does the home team win?", round(100 * hw / hn, 1), "%", f"{hw} of {hn} home games won", "The edge has shrunk in recent years.", 2, scale="linear", span=100, lo=0, hi=100)


def baseball():
    z = zipfile.ZipFile(io.BytesIO(fetch("https://www.retrosheet.org/gamelogs/gl2024.zip", binary=True)))
    rows = list(csv.reader(io.StringIO(z.read(z.namelist()[0]).decode("latin1"))))
    hr = sum(int(r[25]) + int(r[53]) for r in rows)
    so = sum(int(r[32]) + int(r[60]) for r in rows)
    att = [int(r[17]) for r in rows if r[17].isdigit() and int(r[17]) > 0]
    nine = [int(r[18]) for r in rows if r[18].isdigit() and r[11] in ("51", "54")]
    runs = sum(int(r[9]) + int(r[10]) for r in rows)
    def q(id, question, v, unit, ev, ex, d, **k):
        add("mlb-" + id, question, v, unit, S, difficulty=d, url="https://www.retrosheet.org/gamelogs/index.html", source="Retrosheet", licence="Free use with notice: " + RETRO, evidence=ev + f" ({len(rows)} regular-season games in 2024)", explainer=ex, check="mlb|" + id, as_of="2024 regular season", **k)
    q("hr", "How many home runs were hit in the major league baseball season?", hr, "home runs", f"sum of both teams' home runs {hr}", f"About {fmt(hr/len(rows),1)} a game.", 2, span=3.4, whole=True)
    q("so", "How many strikeouts were there in the major league baseball season?", so, "strikeouts", f"sum of both teams' strikeouts {so}", f"About {fmt(so/len(rows),0)} a game.", 2, span=3.4, whole=True)
    q("attend", "How many people came to the average major league baseball game?", round(sum(att) / len(att)), "people", f"mean attendance over {len(att)} games {sum(att)/len(att):.1f}", "Weekend games in summer draw the most.", 2, span=3)
    q("time", "How many minutes did the average nine-inning major league game take?", round(sum(nine) / len(nine), 1), "minutes", f"mean length of {len(nine)} nine-inning games {sum(nine)/len(nine):.2f}", "A pitch clock brought it down by about half an hour.", 2, span=2.4)
    q("runs", "How many runs were scored in the major league baseball season?", runs, "runs", f"sum of both teams' runs {runs}", f"About {fmt(runs/len(rows),1)} a game.", 3, span=3.4, whole=True)


def rules():
    P = lambda id, url, pat, q, unit, src, ex, **k: page("ru-" + id, url, pat, q, unit, S, src, ex, licence=FACT, **k)
    P("goal-w", "https://www.theifab.com/laws/latest/the-field-of-play/", r"distance between the (?:inside of the )?posts is (7\.32)", "How many meters wide is a soccer goal?", "meters", "IFAB Laws of the Game", "The odd figure is exactly eight yards.", span=2.6, difficulty=1)
    P("goal-h", "https://www.theifab.com/laws/latest/the-field-of-play/", r"crossbar to the ground is (2\.44)", "How many meters high is the crossbar of a soccer goal?", "meters", "IFAB Laws of the Game", "It is eight feet, set long before the sport went metric.", span=2.4, difficulty=1)
    P("pen", "https://www.theifab.com/laws/latest/the-field-of-play/", r"penalty mark is made (11) ?m", "How many meters from goal is the penalty spot in soccer?", "meters", "IFAB Laws of the Game", "It is exactly twelve yards.", span=2.4, difficulty=1)
    P("rim", "https://official.nba.com/rule-no-1-court-dimensions-equipment/", r"safety ring (18).{1,3}in inside diameter", "How many inches across is the inside of an NBA hoop?", "inches", "NBA rulebook", "Two basketballs almost fit through it side by side.", span=2.4, difficulty=2)
    P("ft", "https://official.nba.com/rule-no-1-court-dimensions-equipment/", r"(15)[’'′]? from the plane of the face of the backboard", "How many feet from the backboard is an NBA free throw line?", "feet", "NBA rulebook", "Defenders may not enter the lane until the ball leaves the shooter's hand.", span=2.4, difficulty=1)


def run():
    for f in (soccer, nfl, baseball, rules):
        attempt(f"sports.{f.__name__}", f)
