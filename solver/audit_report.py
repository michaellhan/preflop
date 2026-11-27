"""Reads hu-solver --audit JSON files and prints the checks of the heads-up audit: convergence of the preflop solve,
how many SB opens sit near 50/50, the flagged hands with each action's value, and whether mixed actions are
indifferent (their values within a small gap of each other). Usage: python3 audit_report.py runs/audit/*.json"""
import json, sys

FLAG = ["QJo", "KTo", "QTo", "JTo", "T6o", "96o", "J6o", "76s", "A5s", "K4s", "Q6s", "KJs", "72o", "32o"]

def load(p):
    d = json.load(open(p))
    d["by"] = {n["node"]: n for n in d["nodes"]}
    d["ix"] = {h: i for i, h in enumerate(d["hands"])}
    return d

def node_line(d, name, h):
    n, i = d["by"][name], d["ix"][h]
    return "  ".join(f"{a['action']} {a['prob'][i]:.3f} (ev {a['ev'][i]:+.3f})" for a in n["actions"]) + f"   reach {n['own_reach'][i]:.3f}"

def indifference(d, name, lo=0.05, reach=0.02):
    n, cc = d["by"][name], d["combos"]
    gaps, worst = [], (0, "")
    for i, h in enumerate(d["hands"]):
        if n["own_reach"][i] < reach: continue
        used = [a for a in n["actions"] if a["prob"][i] >= lo]
        if len(used) < 2: continue
        evs = [a["ev"][i] for a in used]
        g = max(evs) - min(evs)
        gaps.append((g, cc[i] * n["own_reach"][i]))
        if g > worst[0]: worst = (g, h)
    w = sum(x[1] for x in gaps) or 1
    best_gap = []  # every reached hand: best action's value minus the value of the mix it plays
    for i in range(len(d["hands"])):
        if n["own_reach"][i] < reach: continue
        evs = [a["ev"][i] for a in n["actions"]]
        mix = sum(a["prob"][i] * a["ev"][i] for a in n["actions"])
        best_gap.append(max(evs) - mix)
    return len(gaps), sum(g * x for g, x in gaps) / w, worst, max(best_gap or [0])

for p in sys.argv[1:]:
    d = load(p)
    sb = d["by"]["sb_open"]
    r, l = sb["actions"][0]["prob"], sb["actions"][1]["prob"]
    near = [h for i, h in enumerate(d["hands"]) if r[i] > 0.05 and l[i] > 0.05 and abs(r[i] - l[i]) / (r[i] + l[i]) < 0.1]
    mixed = [h for i, h in enumerate(d["hands"]) if max(a["prob"][i] for a in sb["actions"]) < 0.95]
    print(f"\n=== {p}: rounds {d['rounds']}, SB EV {d['sb_ev']:+.3f}bb, BB EV {d['bb_ev']:+.3f}bb")
    print("  preflop-solve exploitability (bb/hand) by iteration:", ", ".join(f"{i}:{e:.5f}" for i, e in d["exploitability"]))
    print(f"  SB open: {len(mixed)} of 169 classes mixed (no action at 95%+); {len(near)} within 10% of an even raise/limp split")
    for name in ["sb_open", "bb_vs_open", "sb_vs_3bet", "bb_vs_limp", "sb_vs_iso"]:
        k, mean, worst, bg = indifference(d, name)
        print(f"  {name:11s}: {k:3d} mixed hands, mean value gap between their actions {mean:.4f}bb, worst {worst[0]:.4f} ({worst[1]}); max gain of a pure switch {bg:.4f}bb")
    for name in ["sb_open", "bb_vs_open"]:
        print(f"  {name}:")
        for h in FLAG: print(f"    {h:4s} {node_line(d, name, h)}")
