import sys, importlib
import lib
for m in sys.argv[1:]:
    importlib.import_module(m).run()
for q in lib.QUESTIONS:
    print(f"{q['id']:24} {q['answer']!s:>16} {q['unit']:10} d{q['difficulty']} {q['question'][:74]} || {q['explainer'][:60]}")
for f in lib.FAILED: print("FAILED", f)
print(len(lib.QUESTIONS))
