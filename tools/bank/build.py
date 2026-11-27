"""Build bank/questions.json from every source module, with a ruler for each question.

    python3 tools/bank/build.py            use cached responses
    FRESH=1 python3 tools/bank/build.py    fetch everything again
"""
import hashlib, importlib, json, math, random, sys
from pathlib import Path
import lib
from lib import HERE, QUESTIONS, FAILED, TODAY

MODULES = ["s_space", "s_animals", "s_science", "s_food", "s_money", "s_geo", "s_tech", "s_sports", "s_everyday", "s_wikidata", "s_books", "s_more"]
OUT = HERE.parent.parent / "bank" / "questions.json"


def seeded(id):
    return random.Random(int(hashlib.sha256(("ruler:" + id).encode()).hexdigest()[:12], 16))


def nice_down(x, steps=(1, 1.5, 2, 3, 4, 5, 6, 8)):
    p = 10 ** math.floor(math.log10(x))
    return max((s * p for s in steps if s * p <= x * 1.0000001), default=p)


def nice_up(x, steps=(1, 1.5, 2, 3, 4, 5, 6, 8, 10)):
    p = 10 ** math.floor(math.log10(x))
    return min((s * p for s in steps if s * p >= x * 0.9999999), default=10 * p)


def ruler(q):
    """Place the answer at random along a ruler of fixed length, so its spot carries no hint."""
    r = seeded(q["id"])
    a = q["answer"]
    pos = r.uniform(0.07, 0.93)
    if q["scale"] == "log":
        span = q["span"] or 4
        lo = nice_down(a / 10 ** (pos * span))
        if q["whole"] and lo < 1:
            lo = 1
        hi = nice_up(lo * 10 ** span)
        if hi < a * 1.15: hi = nice_up(a * 1.3)
    else:
        w = q["span"] or 100
        if q["lo"] is not None and q["hi"] is not None and q["hi"] - q["lo"] <= w:
            lo, hi = q["lo"], q["hi"]
        else:
            step = 10 ** math.floor(math.log10(w / 10))
            lo = math.floor((a - pos * w) / step) * step
            hi = lo + w
            if q["lo"] is not None and lo < q["lo"]: lo, hi = q["lo"], q["lo"] + w
            if q["hi"] is not None and hi > q["hi"]: lo, hi = (q["hi"] // step) * step - w + (step if q["hi"] % step else 0), (q["hi"] // step) * step + (step if q["hi"] % step else 0)
            if q["unit"] == "year" and hi > 2030: hi = 2030; lo = 2030 - w
    return lib.clean(lo), lib.clean(hi)


def main():
    for m in MODULES:
        importlib.import_module(m).run()
    drop = json.loads((HERE / "drop.json").read_text()) if (HERE / "drop.json").exists() else {}
    out, seen = [], set()
    for q in QUESTIONS:
        if q["id"] in seen: raise SystemExit(f"duplicate id {q['id']}")
        seen.add(q["id"])
        if q["id"] in drop: continue
        lo, hi = ruler(q)
        out.append({k: q[k] for k in ("id", "question", "answer", "unit", "category", "difficulty", "scale")} | {"min": lo, "max": hi} | {k: q[k] for k in ("as_of", "source_url", "source_name", "licence", "evidence", "explainer", "topic", "label", "whole", "check")} | {"fetched": TODAY})
    out.sort(key=lambda q: q["id"])
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    from collections import Counter
    print(len(out), "questions;", len(drop), "dropped by hand;", len(FAILED), "failed to build")
    print(dict(Counter(q["category"] for q in out)))
    for f in FAILED: print("  FAILED", f)


if __name__ == "__main__":
    main()
