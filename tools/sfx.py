"""Builds the game's sound sprite: one small MP3 holding every recorded sound, and the map of where
each one starts.

The recordings come from Kenney's "Impact Sounds" and "RPG Audio" packs (CC0, kenney.nl). Unzip
both into one folder and run:

    python3 tools/sfx.py path/to/folder

It writes sfx/ranch.mp3 and js/sprite.js. Needs ffmpeg on the PATH. Standard library only.
"""
import json
import subprocess
import sys
from array import array
from pathlib import Path

SR = 32000
GAP = 0.16          # silence between sounds, long enough that a decoder's lead-in never reaches the next one
LEAD = 0.04         # silence before each sound; its start in the map points here
PEAK = 0.89         # every sound is levelled to the same peak; the game sets how loud each plays

# name: (file in the packs, longest it may run in seconds)
CLIPS = {
    'tap': ('impactWood_light_002', 0.16),
    'tick': ('impactGeneric_light_001', 0.1),
    'count': ('impactTin_medium_002', 0.13),
    'grab': ('handleSmallLeather', 0.34),
    'creak': ('creak1', 0.66),
    'settle': ('creak3', 0.34),
    'swish': ('cloth1', 0.66),
    'swish2': ('cloth2', 0.42),
    'thud': ('impactSoft_heavy_002', 0.5),
    'clank': ('impactMetal_medium_000', 0.27),
    'clatter': ('impactPlate_light_002', 0.49),
    'bell': ('impactBell_heavy_002', 0.7),
    'bell-big': ('impactBell_heavy_001', 1.5),
    'bell-ring': ('impactBell_heavy_000', 1.4),
    'buckle': ('beltHandle1', 0.28),
    'knock': ('impactWood_light_000', 0.26),
    'rubble': ('impactMining_004', 0.83),
    'soft': ('impactSoft_medium_001', 0.18),
}


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    return [s / 32768 for s in array('h', raw)]


def tidy(x, longest):
    # Start right at the attack, stop at the longest allowed, fade the last 30 ms, level the peak.
    first = next((i for i, s in enumerate(x) if abs(s) > 0.02), 0)
    x = x[max(0, first - int(0.002 * SR)):][:int(longest * SR)]
    fade = min(len(x), int(0.03 * SR))
    for i in range(fade):
        x[len(x) - fade + i] *= 1 - (i + 1) / fade
    peak = max(abs(s) for s in x) or 1
    return [s * PEAK / peak for s in x]


def main(folder):
    files = {p.stem: p for p in Path(folder).rglob('*.ogg')}
    out, where = [], {}
    for name, (stem, longest) in CLIPS.items():
        if stem not in files:
            sys.exit(f'{stem}.ogg is not in {folder}')
        x = tidy(decode(files[stem]), longest)
        where[name] = [round(len(out) / SR, 4), round((len(x) + int(LEAD * SR)) / SR, 4)]
        out += [0.0] * int(LEAD * SR) + x + [0.0] * int(GAP * SR)
    pcm = array('h', (max(-32767, min(32767, int(s * 32767))) for s in out)).tobytes()
    root = Path(__file__).resolve().parent.parent
    (root / 'sfx').mkdir(exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-c:a', 'libmp3lame', '-b:a', '48k', str(root / 'sfx' / 'ranch.mp3')], input=pcm, check=True)
    (root / 'js' / 'sprite.js').write_text(
        '// Where each recorded sound sits in sfx/ranch.mp3: [start, length] in seconds. Made by tools/sfx.py.\n'
        f'export const SPRITE = {json.dumps(where, separators=(",", ":"))};\n')
    size = (root / 'sfx' / 'ranch.mp3').stat().st_size
    print(f'{len(where)} sounds, {len(out) / SR:.1f} s, {size / 1024:.0f} KB')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
