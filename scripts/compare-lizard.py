"""Scores this site's 6-max charts and Lizard's preflop solve against the same published 6-max 100bb solves, to decide
whether Lizard's solve should replace the charts.

    <lizard>/.venv/bin/python -B scripts/compare-lizard.py <lizard repo>

The references are Lizard's (solver/tests/preflop_refs.py): spot-level fold/call/raise shares from gtopreflop.com and
an opening-range consensus (the "certain" ones), plus hand-level facts. Both sides are scored the same way as Lizard's
own calibration (scripts/pf/calibrate.py): mean absolute error in points over every published share, spots with any
share outside its tolerance, and hand facts outside their bounds. A spot's shares are of all hands, or of the range the
hero arrives with (the opener's open) where the reference says so.

The site's charts are its raked set (js/ranges.js, 5% capped at 0.5bb); the references were solved at 5% capped at 4bb.
Lizard is scored on its stored raked game (lz4_6max_100bb_r5c3, 5% capped at 3bb, its own tree sizes) through its own
pf_equilibrium.report, and also on its no-rake game for reference.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys

import numpy as np

LIZ = sys.argv[1]
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path[:0] = [os.path.join(LIZ, "solver"), os.path.join(LIZ, "solver", "scripts"), LIZ]
import gto.native  # noqa: E402,F401  (Lizard's own modules from here on)
from gto.pf_classes import CLASSES, CLASS_OF  # noqa: E402
from gto.ranges import parse_range  # noqa: E402
from tests.preflop_refs import REFS, HANDS, RAKED_HANDS  # noqa: E402
from engine import pf_solve as PS  # noqa: E402
import pf_equilibrium as P  # noqa: E402

base = json.loads(subprocess.check_output(["node", os.path.join(HERE, "scripts", "export-ranges.mjs")]))
H = base["hands"]
COMBOS = np.array(base["combos"], dtype=float)
G = base["groups"]
CIDX = {c: i for i, c in enumerate(CLASSES)}
GRID_TO_CLS = [CIDX[h] if h in CIDX else CIDX[h[1] + h[0] + h[2:]] for h in H]


def chart_of(hero, line):
    """(chart {action: 169 freqs}, weight of the range the hero arrives with or None) for a reference line."""
    acts = [a.split() for a in line.split(", ")] if line else []
    if not acts:
        if hero == "SB":   # the reference counts raise + limp together
            return {"raise": np.add(G["RFI6"]["SB"]["raise"], G["RFI6"]["SB_LIMP"]["raise"])}, None
        return {"raise": np.array(G["RFI6"][hero]["raise"])}, None
    if len(acts) == 1 and acts[0][1] == "raise":
        c = G["VS_OPEN"][f"{hero}_vs_{acts[0][0]}"]
        return {k: np.array(v) for k, v in c.items()}, None
    if len(acts) == 2 and acts[0][0] == hero and acts[1][1] == "raise":
        c = G["VS_3BET"][f"{hero}_vs_{acts[1][0]}"]
        return {k: np.array(v) for k, v in c.items()}, np.array(G["RFI6"][hero]["raise"])
    return None, None


def shares(chart, rw):
    w = COMBOS * (1 if rw is None else rw)
    out = {k: float((v * w).sum() / w.sum()) for k, v in chart.items()}
    out["fold"] = 1 - sum(out.values())
    return out


def mask_of(hands):
    m = parse_range(hands) > 0
    cls = {CLASS_OF[i] for i in np.nonzero(m)[0]}
    return np.array([GRID_TO_CLS[i] in cls for i in range(len(H))])


def hand_value(chart, hands, action):
    m = mask_of(hands)
    r, c = chart.get("raise", np.zeros(len(H))), chart.get("call", np.zeros(len(H)))
    v = {"raise": r, "call": c, "continue": r + c, "fold": 1 - r - c}[action]
    return float((v * COMBOS)[m].sum() / COMBOS[m].sum())


def score_site():
    errs, miss, rows = [], 0, {}
    for r in REFS:
        if r["uncertain"] or r["table"] != 6:
            continue
        chart, rw = chart_of(r["hero"], r["line"])
        if chart is None:
            rows[r["name"]] = None
            continue
        got = shares(chart, rw if r["of"] == "range" else None)
        e = [abs(got.get(k, 0) - v) for k, v in r["want"].items()]
        errs += e
        miss += any(x > r["tol"] + 1e-9 for x in e)
        rows[r["name"]] = got
    facts = {}
    for h in HANDS + RAKED_HANDS:
        chart, _ = chart_of(h[1], h[2])
        facts[h[0]] = None if chart is None else hand_value(chart, h[3], h[4])
    return rows, float(np.mean(errs) * 100), miss, len(errs), facts


def score_lizard(key):
    spec = next(s for s in PS.stored_games() if s.key == key)
    s = PS.Solve(spec, open(os.path.join(LIZ, "engine", "pf", key + ".bin"), "rb").read())
    rows, (mae, n_miss), hands, nb = P.report(s.game)
    got = {name: g for name, g, want, bad, unc in rows}
    facts = {name: v for name, action, v, lo, hi, ok in hands}
    # the raked hand facts, on the same game
    g = s.game
    from gto.pf_game import PRIOR  # noqa: F401
    for h in RAKED_HANDS:
        name, hero, line, hand, action = h[:5]
        ln = [tuple(a.split()[:2]) for a in line.split(", ")] if line else []
        node = g.root
        try:
            for posn, act in ln + [(hero, None)]:
                while node.kind == "dec" and g.positions[node.player] != posn:
                    node = node.children[node.names.index("fold")]
                if act is not None:
                    node = node.children[node.names.index("call" if act == "call" else "raise")]
        except ValueError:
            facts[name] = None
            continue
        st = g.strategy_at(node)
        m = parse_range(hand) > 0
        pr = sum(v for k, v in st.items() if k in ("raise", "all-in"))
        ca = st.get("call", 0)
        v = {"raise": pr, "call": ca, "continue": pr + ca, "fold": 1 - pr - ca}[action]
        v = np.asarray(v)
        facts[name] = float((v[np.asarray(CLASS_OF)] if v.shape[0] == len(CLASSES) else v)[m].mean())
    return got, mae * 100, n_miss, facts, s.mbb   # report's error is a fraction


def dist(name, v):
    """Points outside the fact's bounds (0 inside)."""
    h = next(x for x in HANDS + RAKED_HANDS if x[0] == name)
    return 0.0 if v is None else 100 * max(h[5] - v, v - h[6], 0.0)


def off(name, v):
    return dist(name, v) > 1e-7


site_rows, site_mae, site_miss, n_shares, site_facts = score_site()
liz_rows, liz_mae, liz_miss, liz_facts, liz_mbb = score_lizard("lz4_6max_100bb_r5c3")
nr_rows, nr_mae, nr_miss, nr_facts, _ = score_lizard("lz4_6max_100bb")

certain = [r for r in REFS if not r["uncertain"] and r["table"] == 6]
print(f"{'reference':38} {'published':>22} {'site charts':>22} {'Lizard (raked)':>22}")
fmt = lambda d, keys: " ".join(f"{k[0]}{100 * d.get(k, 0):5.1f}" for k in keys) if d else "n/a"
per_site, per_liz = [], []
for r in certain:
    keys = list(r["want"])
    s, l = site_rows.get(r["name"]), liz_rows.get(r["name"])
    es = np.mean([abs(s.get(k, 0) - r["want"][k]) for k in keys]) * 100 if s else np.nan
    el = np.mean([abs(l.get(k, 0) - r["want"][k]) for k in keys]) * 100 if l else np.nan
    per_site.append(es)
    per_liz.append(el)
    win = "site" if es < el - 0.25 else "Lizard" if el < es - 0.25 else "tie"
    print(f"{r['name'][:38]:38} {fmt(r['want'], keys):>22} {fmt(s, keys):>22} {fmt(l, keys):>22}  {es:4.1f} vs {el:4.1f} {win}")

print()
print(f"{'hand fact':44} {'bounds':>11} {'site':>6} {'Lizard':>7}")
fo_site = fo_liz = d_site = d_liz = 0
for h in HANDS + RAKED_HANDS:
    s, l = site_facts.get(h[0]), liz_facts.get(h[0])
    fo_site += off(h[0], s)
    fo_liz += off(h[0], l)
    d_site += dist(h[0], s)
    d_liz += dist(h[0], l)
    mark = lambda v: ("  n/a" if v is None else f"{100 * v:5.0f}") + ("*" if off(h[0], v) else " ")
    print(f"{h[0][:44]:44} {100 * h[5]:4.0f}-{100 * h[6]:<4.0f} {mark(s):>7} {mark(l):>7}")

ps, pl = np.array(per_site), np.array(per_liz)
both = np.isfinite(ps) & np.isfinite(pl)
print()
print(f"Spot shares, mean error in points (lower is better), {len(certain)} certain references:")
print(f"  site charts (raked)         {site_mae:5.2f}   spots out of tolerance {site_miss}")
print(f"  Lizard lz4 raked (r5c3)     {liz_mae:5.2f}   spots out of tolerance {liz_miss}   ({liz_mbb:.2f} mbb/hand a seat)")
print(f"  Lizard lz4 no rake          {nr_mae:5.2f}   spots out of tolerance {nr_miss}")
print(f"  spots where each is closer by over 0.25 points: site {int((ps < pl - 0.25)[both].sum())}, "
      f"Lizard {int((pl < ps - 0.25)[both].sum())}, tie {int(both.sum() - (ps < pl - 0.25)[both].sum() - (pl < ps - 0.25)[both].sum())}")
print(f"Hand facts out of bounds: site {fo_site}, Lizard {fo_liz} (of {len(HANDS + RAKED_HANDS)}); "
      f"points outside the bounds in all: site {d_site:.0f}, Lizard {d_liz:.0f}")
print("Lizard's flop values are fitted to these spot references (scripts/pf/calibrate.py), so its spot score is in-sample;"
      " the hand facts are held out of that fit.")
