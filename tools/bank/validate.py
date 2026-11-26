"""Check bank/questions.json. Exits with an error on any problem."""
import json, math, re, sys
from collections import Counter, defaultdict
from pathlib import Path

BANK = Path(__file__).parent.parent.parent / "bank" / "questions.json"
FIELDS = ["id", "question", "answer", "unit", "category", "difficulty", "scale", "min", "max", "as_of", "source_url", "source_name", "licence", "evidence", "explainer"]
CATS = {"Space", "Animals", "Human body", "Geography", "History", "Technology", "Money", "Sports", "Food", "Engineering", "Math and science", "Everyday life", "Books and art"}
CHANGES = re.compile(r"\b(population|live in|has been|have been|currently|does .* have|had been)\b", re.I)
BAD_WORDS = re.compile(r"\b(died|deaths?|killed|murder|suicide|earthquake|hurricane|war dead|casualt|genocide|crime|abortion|election)\b", re.I)


def shingles(s):
    w = re.findall(r"[a-z0-9]+", s.lower())
    return {" ".join(w[i:i + 3]) for i in range(len(w) - 2)}


def check(qs):
    errors, warnings = [], []
    ids = Counter(q["id"] for q in qs)
    texts = Counter(q["question"].lower() for q in qs)
    for k, n in ids.items():
        if n > 1: errors.append(f"{k}: duplicate id")
    for k, n in texts.items():
        if n > 1: errors.append(f"duplicate question text: {k}")
    for q in qs:
        e = lambda m: errors.append(f"{q['id']}: {m}")
        for f in FIELDS:
            if f not in q: e(f"missing {f}")
        if not q["question"].strip().endswith("?") : e("question does not end with a question mark")
        if len(q["question"]) > 150: e(f"question is {len(q['question'])} characters")
        if not 10 <= len(q["explainer"]) <= 150: e(f"explainer is {len(q['explainer'])} characters")
        if not isinstance(q["answer"], (int, float)) or not math.isfinite(q["answer"]): e("answer is not a number")
        if not q["min"] < q["max"]: e("ruler is empty")
        if not q["min"] < q["answer"] < q["max"]: e(f"answer {q['answer']} outside ruler {q['min']} to {q['max']}")
        if q["scale"] not in ("log", "linear"): e("unknown scale")
        if q["scale"] == "log" and q["min"] <= 0: e("log ruler needs a positive start")
        if q["scale"] == "log":
            t = math.log(q["answer"] / q["min"]) / math.log(q["max"] / q["min"])
            if not 0.02 < t < 0.98: warnings.append(f"{q['id']}: answer sits at {t:.2f} of the ruler")
        if q["category"] not in CATS: e(f"unknown category {q['category']}")
        if q["difficulty"] not in (1, 2, 3): e("difficulty must be 1, 2 or 3")
        if not re.match(r"^https://", q["source_url"]): e("source must be an https link")
        if not q["source_name"] or not q["licence"]: e("missing source name or licence")
        if len(q["evidence"]) < 8 or not re.search(r"\d", q["evidence"]): e("evidence has no number in it")
        if q["unit"] == "%" and not 0 <= q["answer"] <= 100: e("percentage out of range")
        if q["unit"] == "year" and not (q["answer"] == int(q["answer"]) and 1000 <= q["answer"] <= 2026): e("odd year")
        if q.get("whole") and q["answer"] != int(q["answer"]): e("should be a whole number")
        for f in ("question", "explainer"):
            if "—" in q[f] or "–" in q[f]: e(f"{f} has a dash")
            if "  " in q[f]: e(f"{f} has a double space")
            if BAD_WORDS.search(q[f].replace("Death Valley", "")): e(f"{f}: grim or contested word")
            if f == "explainer" and not q[f].rstrip().endswith((".", "?")): e("explainer should end with a period")
        # the answer must not be given away
        plain = re.sub(r"[,\s]", "", q["question"])
        a = f"{q['answer']:g}"
        if len(a) > 2 and re.search(rf"(?<!\d){re.escape(a)}(?!\d)", plain): e("question gives the answer away")
        if q["unit"] and q["unit"] not in ("year", "%", "°C", "°F", "US dollars", "times", "kg", "km", "km²", "km/s", "cm/s", "mg", "kWh", "cm", "kg/m³"):
            stem = q["unit"].split()[0].rstrip("s").lower()[:5]
            if stem not in q["question"].lower(): warnings.append(f"{q['id']}: unit {q['unit']} is not mentioned in the question")
    sh = [(q, shingles(q["question"])) for q in qs]
    for i in range(len(sh)):
        for j in range(i + 1, len(sh)):
            a, b = sh[i], sh[j]
            if not a[1] or not b[1]: continue
            s = len(a[1] & b[1]) / len(a[1] | b[1])
            if s > 0.9: errors.append(f"near duplicate: {a[0]['id']} and {b[0]['id']}")
    return errors, warnings


if __name__ == "__main__":
    qs = json.loads(BANK.read_text())
    errors, warnings = check(qs)
    for w in warnings if "-v" in sys.argv else []: print("warn ", w)
    for e in errors: print("ERROR", e)
    print(f"{len(qs)} questions, {len(errors)} errors, {len(warnings)} warnings")
    sys.exit(1 if errors else 0)
