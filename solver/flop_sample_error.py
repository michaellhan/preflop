"""How far our 50-flop samples are from all 1,755 flops, measured on gtosolver's heads-up library.

gtosolver (~/Desktop/projects/gtosolver/.work/hu-lib, read only; files decoded with Lizard's gto/flop_library.py) has
every canonical flop solved for the heads-up single-raised pot (SB opens 3bb, BB calls, 97bb behind). For each flop it
stores each hand's EV at the big blind's first decision. A hand class's value on a flop is the average over its
combos of the EV of the mix it plays there. Averaged over all flops (each weighted by how many of the 22,100 it stands
for) that is the exact flop average for those ranges; averaged over a 50-flop sample it is what our solver sees.
The gap per class is the sampling error. The library's ranges and sizes are not ours, so this measures the size of
the error, not our exact values.

It then checks the correction in src/correct.rs (a control variate on each hand's flop equity) against the same
truth: it writes the library's ranges and per-combo EVs to a temp folder and runs target/release/sample_check on them.

Usage: ~/Desktop/projects/lizard/.venv/bin/python flop_sample_error.py   (after cargo build --release)
"""
import json
import math
import os
import struct
import subprocess
import sys
import tempfile
from collections import defaultdict

import numpy as np

LIZARD = os.path.expanduser("~/Desktop/projects/lizard")
LIB = os.path.expanduser("~/Desktop/projects/gtosolver/.work/hu-lib")
RANGES = os.path.expanduser("~/Desktop/projects/gtosolver/gto/static/flop_library/{}/ranges.json")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [os.path.join(LIZARD, "solver")]
from gto import flop_library as FL  # noqa: E402
from gto.cards import ALL_COMBOS  # noqa: E402

RANKS = "23456789TJQKA"
GOLD = 0.618033988749895


def label(a, b):
    ra, rb = a // 4, b // 4
    if ra < rb:
        ra, rb = rb, ra
    if ra == rb:
        return RANKS[ra] * 2
    return RANKS[ra] + RANKS[rb] + ("s" if a % 4 == b % 4 else "o")


def sample(n, u, weights):
    """solver/src/cards.rs sample_flops_at: canonical flops sorted by (high, mid, low rank, suit count), every
    (k + u) / n step of cumulative weight. Our canonical form sorts low to high; the order key is the same."""
    import itertools
    perms = list(itertools.permutations(range(4)))

    def ours(f):  # cards.rs's canonical form, which breaks ties in its sort
        return min(tuple(sorted(c // 4 * 4 + p[c % 4] for c in f)) for p in perms)

    def key(f):
        lo, mid, hi = sorted(f)
        s = {c % 4 for c in f}
        return (hi // 4, mid // 4, lo // 4, len(s), ours(f))
    v = sorted(weights.items(), key=lambda x: key(x[0]))
    total = sum(w for _, w in v)
    out, acc, k = [], 0.0, 0
    for f, w in v:
        acc += w
        while k < n and (k + u) / n * total <= acc:
            out.append(f)
            k += 1
    return out


def main():
    spot = "srp_sb_bb_2max"
    index = json.load(open(os.path.join(LIB, "index.json")))
    pot = next(s for s in index["spots"] if s["id"] == spot)["pot"]
    weights = FL.all_flops()                     # {canonical flop (cards high to low): count}
    values = {}                                  # flop -> {class: BB's EV in bb}
    combo_ev = {}                                # flop -> BB's EV per combo (NaN outside its range)
    for f in weights:
        name = FL.cards_str(f)
        d = FL.decode(open(os.path.join(LIB, spot, name + ".bin"), "rb").read())
        root = next(nd for nd in d["nodes"] if not nd["path"])
        idx = np.nonzero(d["masks"][root["player"]])[0]
        ev = (root["strat"] * root["evs"]).sum(axis=0)
        combo_ev[f] = np.full(len(ALL_COMBOS), np.nan, dtype="<f4")
        combo_ev[f][idx] = ev
        by = defaultdict(list)
        for i, e in zip(idx, ev):
            a, b = ALL_COMBOS[i]
            by[label(a, b)].append(e)
        values[f] = {c: float(np.mean(x)) for c, x in by.items()}
    classes = sorted({c for v in values.values() for c in v})
    tw = sum(weights.values())

    def avg(flops, w=None):
        out = {}
        for c in classes:
            num = den = 0.0
            for f in flops:
                if c in values[f]:
                    x = w[f] if w else 1.0
                    num += x * values[f][c]
                    den += x
            out[c] = num / den if den else float("nan")
        return out

    exact = avg(list(weights), weights)
    print(f"{spot}: {len(weights)} flops, pot {pot}bb; BB's EV per class at its first decision, in bb\n")
    rows = [("fixed sample (rounds 0-10)", [sample(50, 0.5, weights)])]
    rows.append(("one shifted sample, typical", [sample(50, (0.5 + k * GOLD) % 1, weights) for k in range(1, 7)]))
    rows.append(("6 shifted samples together", [[f for k in range(1, 7) for f in sample(50, (0.5 + k * GOLD) % 1, weights)]]))
    print(f"{'flops used':32} {'mean abs error':>15} {'worst class':>22} {'rms':>8}")
    for name, samples in rows:
        errs = []
        for fl in samples:
            got = avg(fl)
            errs.append({c: got[c] - exact[c] for c in classes if not math.isnan(got[c])})
        mae = np.mean([np.mean([abs(x) for x in e.values()]) for e in errs])
        rms = np.mean([math.sqrt(np.mean([x * x for x in e.values()])) for e in errs])
        worst = max(((c, x) for e in errs for c, x in e.items()), key=lambda t: abs(t[1]))
        print(f"{name:32} {mae:15.3f} {worst[0]:>12} {worst[1]:+8.3f}  {rms:8.3f}")
    # the pairs the order checks flagged, on the fixed sample
    got = avg(sample(50, 0.5, weights))
    print("\nflagged pairs, error of the fixed sample (bb): ", end="")
    print(", ".join(f"{c} {got[c] - exact[c]:+.3f}" for c in ("J4s", "J3s", "T8o", "T7o", "87o", "86o", "T5s", "T3s")
                    if c in got))

    check_correction(spot, weights, combo_ev)


def check_correction(spot, weights, combo_ev):
    """Runs sample_check (src/bin/sample_check.rs) on the library: the solver's own correction code, judged by the truth."""
    ours = [(a, b) for a in range(52) for b in range(a + 1, 52)]
    assert [tuple(sorted(c)) for c in ALL_COMBOS] == ours, "combo orders differ"
    w = json.load(open(RANGES.format(spot)))["w"]              # [out of position, in position], x 10,000
    with tempfile.TemporaryDirectory() as tmp:
        with open(os.path.join(tmp, "ranges.txt"), "w") as f:
            for r in w:
                f.write(" ".join(str(x / 10000) for x in r) + "\n")
        with open(os.path.join(tmp, "values.bin"), "wb") as f:
            f.write(struct.pack("<I", len(weights)))
            for fl, n in weights.items():
                f.write(bytes(fl) + struct.pack("<I", n) + combo_ev[fl].tobytes())
        print(flush=True)
        subprocess.run([os.path.join(HERE, "target/release/sample_check"), tmp], check=True)


if __name__ == "__main__":
    main()
