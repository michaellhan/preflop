"""Solves our heads-up game in Lizard's preflop model, as a second opinion for report.mjs.

Lizard (~/Desktop/projects/lizard, read only) has a fast class-level preflop solver whose flop values are a model
fitted to published 6-max solves, not real postflop solves like ours (its docs/ACCURACY.md section 6 calls it
approximate). Given our exact game it gives an independent answer to compare with, not a better one.

Our game: 100bb, 5% rake capped at 0.5bb, SB opens to 2.5 or limps, BB 3-bets to 10 or raises a limp to 4,
SB 4-bets to 22 or limp-3-bets to 12, and the next raise is all-in.

Usage (Lizard's virtualenv has numpy):  ~/Desktop/projects/lizard/.venv/bin/python lizard_hu.py [out_dir]
Writes <out_dir>/strategy.txt (default runs/lizard_hu) in the strategy_N.txt format.
"""
import os
import sys
import time

LIZARD = os.path.expanduser("~/Desktop/projects/lizard")
sys.path[:0] = [LIZARD, os.path.join(LIZARD, "solver")]
from engine import pf_solve as S  # noqa: E402

SIZES = (("sb_open", 2.5), ("bvb_3bet", 4.0), ("four_x", 2.2), ("iso", 4.0), ("limp_3bet", 3.0), ("jam_frac", 0.25))
SPEC = S.Spec(players=2, stacks=(100.0,), rake=(0.05, 0.5), sizes=SIZES)

R, C, F, A = "raise", "call", "fold", "all-in"
# our node: (line to reach it, {lizard action: our action})
NODES = {
    "sb_open": ([], {R: "raise", C: "limp", F: "fold"}),
    "bb_vs_open": ([("SB", R)], {R: "raise", C: "call", F: "fold"}),
    "sb_vs_3bet": ([("SB", R), ("BB", R)], {R: "raise", C: "call", F: "fold"}),
    "bb_vs_4bet": ([("SB", R), ("BB", R), ("SB", R)], {R: "raise", A: "raise", C: "call", F: "fold"}),
    "sb_vs_jam": ([("SB", R), ("BB", R), ("SB", R), ("BB", A)], {C: "call", F: "fold"}),
    "bb_vs_limp": ([("SB", C)], {R: "raise", "check": "check", C: "check"}),
    "sb_vs_iso": ([("SB", C), ("BB", R)], {R: "raise", C: "call", F: "fold"}),
    "bb_vs_limp3bet": ([("SB", C), ("BB", R), ("SB", R)], {R: "raise", A: "raise", C: "call", F: "fold"}),
    "sb_vs_limpjam": ([("SB", C), ("BB", R), ("SB", R), ("BB", A)], {C: "call", F: "fold"}),
}


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "runs/lizard_hu")
    os.makedirs(out, exist_ok=True)
    print(SPEC.label())
    t0 = time.time()
    s = S.solve(SPEC, 30.0)
    while not s.done:
        s = S.solve(SPEC, 30.0)
    s.measure()
    print(f"solved: {s.iters} iterations, {s.mbb:.3f} mbb/hand a seat from equilibrium, {time.time() - t0:.0f}s")
    lines = []
    for name, (line, amap) in NODES.items():
        ans = s.node([{"pos": p, "action": a} for p, a in line])
        if "error" in ans:
            sys.exit(f"{name}: {ans['error']}")
        grid = ans["grid"]
        acts = grid["actions"]          # names, in the order of each cell's mix
        ours = [amap.get(a) for a in acts]
        if None in ours:
            sys.exit(f"{name}: lizard's actions {acts} don't map onto ours")
        for cls, cell in grid["cells"].items():
            for a, f in zip(ours, cell["f"]):
                if f > 1e-6:
                    lines.append(f"{name} {a} {cls} {f:.6f}")
        print(f"  {name}: " + ", ".join(f"{o} {a['freq'] * 100:.1f}" for o, a in zip(ours, ans["actions"])))
    with open(os.path.join(out, "strategy.txt"), "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {out}/strategy.txt")


if __name__ == "__main__":
    main()
