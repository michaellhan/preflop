"""Solves the two raked reference games build-norake.py compares Lizard's stored no-rake games with (5% capped at 0.5bb,
2- and 6-handed, 100bb) and saves them as lz2_{2,6}max_100bb_r5c0.5.bin in <out dir>. A solve already there is kept.

    heavy <lizard>/.venv/bin/python -B scripts/solve-norake-refs.py <lizard repo> <out dir>
"""
import os, sys, time
LIZ, OUT = sys.argv[1], sys.argv[2]
sys.path[:0] = [os.path.join(LIZ, "solver"), LIZ]
import gto.native  # noqa: E402,F401
from engine import pf_solve as PS  # noqa: E402
os.makedirs(OUT, exist_ok=True)
for n in (2, 6):
    path = os.path.join(OUT, f"lz2_{n}max_100bb_r5c0.5.bin")
    if os.path.exists(path):
        print(path, "exists"); continue
    s, t0 = PS.Solve(PS.Spec(players=n, rake=(0.05, 0.5))), time.time()
    while not s.done:
        s.run(60)
        print(f"{n}-handed: {s.iters} iterations, {s.mbb} mbb, {time.time() - t0:.0f}s", flush=True)
    open(path, "wb").write(PS.PS.pack(s.game, s.mbb or float("nan")))
    print("saved", path, flush=True)
