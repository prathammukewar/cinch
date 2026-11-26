"""Second check. Fetches every source again from scratch, reads each number a second time,
and compares it with the bank. Wikidata facts are confirmed against Wikipedia as well, and
calculated ones are recomputed with a different method in second.py. Anything that does not
agree is removed from the bank and listed.

    python3 tools/bank/verify.py
"""
import os
os.environ["FRESH"] = "1"
import importlib, json, sys, time
import lib
from build import MODULES, OUT
import second

TOL = {"te-wiki-articles": .01, "te-wiki-edits": .01, "te-wiki-words": .02, "te-crates": .02, "te-tlds": .01, "sp-exoplanets": .02, "sp-numbered-asteroids": .02, "te-rfcs": .01, "mo-banks": .01, "so-games-total": .01, "so-brazil-goals": .01}


def main():
    bank = json.loads(OUT.read_text())
    for m in MODULES:
        importlib.import_module(m).run()
    again = {q["id"]: q for q in lib.QUESTIONS}
    ok, bad, log = [], [], {}
    for q in bank:
        id = q["id"]
        tol = TOL.get(id, 1e-6)
        if id not in again:
            reason = next((m for k, m in lib.FAILED if k == id or id.startswith(k)), "not produced by the second run")
            bad.append((id, f"could not be read again: {reason}")); continue
        a, b = q["answer"], again[id]["answer"]
        if abs(a - b) > tol * max(abs(a), 1e-9):
            bad.append((id, f"first {a}, second {b}")); continue
        rec = {"checked": time.strftime("%Y-%m-%d"), "refetched": b, "tolerance": tol}
        s = second.check(q)
        if s:
            rec["second_source"], rec["second_value"], rec["second_tolerance"] = s["source"], s["value"], s["tol"]
            if s["value"] is not None and abs(s["value"] - a) > s["tol"] * max(abs(a), 1e-9):
                bad.append((id, f"{s['source']} says {s['value']}, bank says {a}")); continue
        log[id] = rec
        ok.append(q)
    OUT.write_text(json.dumps(ok, indent=1, ensure_ascii=False) + "\n")
    (OUT.parent / "verification.json").write_text(json.dumps({"date": time.strftime("%Y-%m-%d"), "kept": len(ok), "removed": [{"id": i, "why": w} for i, w in bad], "checks": log}, indent=1) + "\n")
    n2 = sum("second_source" in r for r in log.values())
    print(f"{len(ok)} confirmed ({n2} of them against a second source), {len(bad)} removed")
    for i, w in bad: print("  removed", i, "|", w[:150])


if __name__ == "__main__":
    main()
