"""Shared tools for the question pipeline: cached fetching, text extraction, question records.

Nothing here contains an answer. Every number comes out of a fetched response
or a calculation that runs in this repository.
"""
import hashlib, html, json, os, re, sys, time, urllib.request, urllib.error, gzip, io
from pathlib import Path

HERE = Path(__file__).parent
CACHE = HERE / "cache"
CACHE.mkdir(exist_ok=True)
UA = "calibration-game-pipeline/0.1"
FRESH = os.environ.get("FRESH") == "1"   # second check: ignore the cache and fetch again
TODAY = time.strftime("%Y-%m-%d")
_last = {}
_done = set()


def _path(url, data=None):
    key = hashlib.sha256((url + "|" + (data or "")).encode()).hexdigest()[:24]
    return CACHE / (("fresh-" if FRESH else "") + key)


def fetch(url, data=None, binary=False, pause=0.6, tries=2, headers=None):
    """GET (or POST when data is given), cached on disk. Polite: one request per host per `pause`."""
    p = _path(url, data)
    if p.exists() and (not FRESH or p.name in _done or time.time() - p.stat().st_mtime < 6 * 3600):
        raw = p.read_bytes()
    else:
        host = re.sub(r"^https?://([^/]+).*", r"\1", url)
        wait = pause - (time.time() - _last.get(host, 0))
        if wait > 0:
            time.sleep(wait)
        err = None
        for k in range(tries):
            try:
                h = {"User-Agent": UA, "Accept": "*/*", "Accept-Encoding": "gzip"}
                h.update(headers or {})
                req = urllib.request.Request(url, data=data.encode() if data else None, headers=h)
                with urllib.request.urlopen(req, timeout=25) as r:
                    raw = r.read()
                    if r.headers.get("Content-Encoding") == "gzip":
                        raw = gzip.decompress(raw)
                break
            except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
                err = e
                code = getattr(e, "code", None)
                if code in (403, 404, 410):
                    raise RuntimeError(f"{code} {url}")
                if code == 429:   # do as the server asks
                    time.sleep(min(90, int(e.headers.get("Retry-After") or 30) + 2))
                else:
                    time.sleep(2 + 3 * k)
        else:
            raise RuntimeError(f"{err} {url}")
        _last[host] = time.time()
        p.write_bytes(raw)
        _done.add(p.name)
    return raw if binary else raw.decode("utf-8", "replace")


def fetch_json(url, **k):
    return json.loads(fetch(url, **k))


def text(url, **k):
    """Page as one line of readable text."""
    return plain(fetch(url, **k))


def plain(s):
    s = re.sub(r"(?is)<(script|style|noscript)\b.*?</\1>", " ", s)
    s = re.sub(r"(?s)<!--.*?-->", " ", s)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    s = s.replace(" ", " ").replace(" ", " ").replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip()


WORDNUM = {w: i for i, w in enumerate("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty".split())}


def number(s):
    s = s.strip().lower().replace(",", "").replace("−", "-").replace("$", "")
    if s in WORDNUM:
        return float(WORDNUM[s])
    m = re.match(r"^(-?\d*\.?\d+)\s*(hundred|thousand|million|billion|trillion)?$", s)
    if not m:
        raise ValueError(f"not a number: {s!r}")
    return float(m.group(1)) * {None: 1, "hundred": 100, "thousand": 1e3, "million": 1e6, "billion": 1e9, "trillion": 1e12}[m.group(2)]


def find(page, pattern, group=1, flags=re.I):
    """Return (value, snippet) for the first match of pattern in page text."""
    m = re.search(pattern, page, flags)
    if not m:
        raise LookupError(f"pattern not found: {pattern}")
    a, b = max(0, m.start() - 60), min(len(page), m.end() + 60)
    a = page.rfind(" ", 0, a) + 1 if a else 0
    snip = page[a:b].strip()
    return number(m.group(group)), snip


def clean(v):
    """Drop float noise without changing the number."""
    if isinstance(v, int):
        return v
    if v == 0:
        return 0
    r = float(f"{v:.10g}")
    return int(r) if r == int(r) and abs(r) < 1e15 else r


def fmt(v, d=None):
    v = clean(v)
    if d is not None:
        v = round(v, d)
        if d == 0 or v == int(v):
            v = int(v)
    a = abs(v)
    for n, w in ((1e12, "trillion"), (1e9, "billion"), (1e6, "million")):
        if a >= n:
            return f"{float(f'{v / n:.4g}'):g} {w}"
    if isinstance(v, int):
        return f"{v:,}"
    s = f"{v:,.4f}".rstrip("0").rstrip(".")
    return s


def times(a, b):
    """'3.4' style ratio for prose."""
    r = a / b
    return f"{r:.0f}" if r >= 10 else f"{r:.1f}".rstrip("0").rstrip(".")


QUESTIONS = []
FAILED = []


def add(id, question, answer, unit, category, *, scale="log", span=None, difficulty=2, as_of=None, url, source, licence, evidence, explainer, check=None, whole=False, lo=None, hi=None, topic=None):
    """Register one question. span: decades for log rulers, width for linear ones."""
    QUESTIONS.append(dict(
        id=id, question=question.strip(), answer=clean(answer), unit=unit, category=category, difficulty=difficulty,
        scale=scale, span=span, as_of=as_of, source_url=url, source_name=source, licence=licence,
        evidence=re.sub(r"\s+", " ", evidence).strip()[:420], explainer=explainer.strip(), check=check or "", whole=whole, lo=lo, hi=hi, topic=topic or id.split("-")[0],
    ))


def attempt(label, fn):
    """Run one builder. A source that fails drops its questions and says so."""
    try:
        fn()
    except Exception as e:  # noqa: BLE001
        FAILED.append((label, f"{type(e).__name__}: {e}"[:200]))


PD = "US federal government work, public domain in the US"
CC0 = "CC0 1.0"
CCBY = "CC BY 4.0"
CCBY3 = "CC BY 3.0"
OWN = "Calculated for this game, no rights reserved on the number"
FACT = "Single fact cited with a link"


def page(id, url, pat, question, unit, category, source, expl, licence=PD, f=1, conv=None, **k):
    """One question from one pattern on one page."""
    def go():
        t = text(url)
        v, snip = find(t, pat, flags=re.I)
        v = conv(v) if conv else v * f
        add(id, question, v, unit, category, url=url, source=source, licence=licence, evidence=snip, explainer=expl(clean(v)) if callable(expl) else expl, check="page|" + pat, **k)
    attempt(id, go)
