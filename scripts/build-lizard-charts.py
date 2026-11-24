"""Builds js/ranges-lizard.js: the 6-max charts where Lizard's hand-made charts measure closer to published solves than
this site's own, in both rake modes.

    <lizard>/.venv/bin/python -B scripts/build-lizard-charts.py <lizard repo> [--write]

Lizard's charts (solver/gto/preflop.py, through its advice, gto/advisor.py preflop_strategy) are hand-written
approximations of solver output like this site's, curated against more published data. Each candidate chart is read
at this site's own line and sizes (2.5bb opens, 3-bets to 7.5bb in position, 11.5bb from the SB, 12.5bb from the BB,
7.5bb by the BB over a SB open), per hand class (the mean of its combos), at the site's raked game (5% capped at 0.5bb)
and at no rake (Lizard's no-rake move, gto/pf_norake.py, then its re-pricing), rounded to the charts' 5% steps.

Every candidate is scored against Lizard's published references (solver/tests/preflop_refs.py), the site's current
chart the same way:
- `certain` spot references: points of error per published share (mean over the chart's references);
- hand facts on the chart: points outside the published bounds (summed);
- `uncertain` references (other sources and conditions, never enforced by Lizard's tests, so a held-out check).
A chart is replaced when its references and facts favour Lizard's and its uncertain references are no worse
(REPLACE below says how each family was decided). Without --write it only prints the table.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys

import numpy as np

LIZ = sys.argv[1]
WRITE = "--write" in sys.argv
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path[:0] = [os.path.join(LIZ, "solver"), LIZ]
import gto.native  # noqa: E402,F401  (Lizard's own modules from here on)
from gto import preflop as pf  # noqa: E402
from gto import pf_norake  # noqa: E402
from gto.advisor import Advisor, preflop_strategy, replay_hand  # noqa: E402
from gto.pf_classes import CLASSES, CLASS_OF  # noqa: E402
from gto.ranges import parse_range  # noqa: E402
from tests.preflop_refs import REFS, HANDS, RAKED_HANDS, _line  # noqa: E402

base = json.loads(subprocess.check_output(["node", os.path.join(HERE, "scripts", "export-ranges.mjs"), "--site-only"]))
H = base["hands"]
COMBOS = np.array(base["combos"], dtype=float)
G = base["groups"]
CIDX = {c: i for i, c in enumerate(CLASSES)}
GRID_TO_CLS = [CIDX[h] if h in CIDX else CIDX[h[1] + h[0] + h[2:]] for h in H]
CLASS_OF = np.asarray(CLASS_OF)
SITE_RAKE = (0.05, 0.5)
POS = ["UTG", "HJ", "CO", "BTN", "SB", "BB"]


def three_size(tb, op):
    return (7.5 if op == "SB" else 12.5) if tb == "BB" else 11.5 if tb == "SB" else 7.5


def site_line(group, key):
    """(hero, line string at the site's sizes) for a chart."""
    if group == "RFI6":
        return key, ""
    hero, other = key.split("_vs_")
    if group == "VS_OPEN":
        return hero, f"{other} raise 2.5"
    return hero, f"{hero} raise 2.5, {other} raise {three_size(other, hero)}"


def to_act(T, line, hero):
    pre = _line(line, T)
    while (st := replay_hand(T, 100, {"preflop": pre}, 1)[0]).to_act != hero:
        pre.append({"pos": st.to_act, "action": "fold"})
    return pre, st


def per_class(v):
    """1326 combo weights -> 169 grid hands (mean over each class's combos)."""
    v = np.asarray(v, dtype=float)
    s = np.bincount(CLASS_OF, weights=v, minlength=169) / np.bincount(CLASS_OF, minlength=169)
    return np.array([s[c] for c in GRID_TO_CLS])


def lizard_chart(group, key, rake):
    hero, line = site_line(group, key)
    T = pf.Table(pf.SEATS[6], rake=rake)
    pre, st = to_act(T, line, hero)
    if rake is not None:
        s = preflop_strategy(hero, pre, T, 100)
    else:   # hero's own no-rake advice in Lizard: the no-rake move, then the re-pricing
        s = pf_norake.chart(pf.strategy_for(hero, pre, T), hero, pre, T)
        if "call" in s:
            s = Advisor._priced(hero, pre, T, 100, st, s, [], False)
    out = {"raise": per_class(s.get("raise", np.zeros(1326)))}
    if group != "RFI6":
        out["call"] = per_class(s.get("call", s.get("check", np.zeros(1326))))
    # the charts' 5% steps, a hand's actions adding to at most 100%
    q = {a: np.round(v * 20) / 20 for a, v in out.items()}
    if "call" in q:
        over = q["raise"] + q["call"] > 1
        q["call"][over] = 1 - q["raise"][over]
    return q


def site_chart(group, key):
    c = G[group][key]
    return {a: np.array(v, dtype=float) for a, v in c.items()}


# ---- scoring a chart against the references that land on it ----
def chart_key_of(hero, line):
    acts = [a.split() for a in line.split(", ")] if line else []
    if not acts:
        return "RFI6", hero
    if len(acts) == 1 and acts[0][1] == "raise":
        return "VS_OPEN", f"{hero}_vs_{acts[0][0]}"
    if len(acts) == 2 and acts[0][0] == hero and acts[1][1] == "raise":
        return "VS_3BET", f"{hero}_vs_{acts[1][0]}"
    return None, None


def shares(chart, rw):
    w = COMBOS * (1 if rw is None else rw)
    out = {k: float((v * w).sum() / w.sum()) for k, v in chart.items()}
    out["fold"] = 1 - sum(out.values())
    return out


def hand_value(chart, hands, action):
    m = parse_range(hands) > 0
    cls = set(CLASS_OF[m].tolist())
    mk = np.array([GRID_TO_CLS[i] in cls for i in range(len(H))])
    r, c = chart.get("raise", np.zeros(len(H))), chart.get("call", np.zeros(len(H)))
    v = {"raise": r, "call": c, "continue": r + c, "fold": 1 - r - c}[action]
    return float((v * COMBOS)[mk].sum() / COMBOS[mk].sum())


def score(group, key, chart, opens):
    """{'certain': mean points over its certain shares or None, 'n': count, 'facts': points outside bounds,
    'nf': facts, 'uncertain': mean points over its uncertain shares or None}. `opens`: the opener's open chart
    (for references of the range the opener 3-bets into)."""
    cert, unc, facts, nf = [], [], 0.0, 0
    for r in REFS:
        if r["table"] != 6 or chart_key_of(r["hero"], r["line"]) != (group, key):
            continue
        if group == "RFI6" and r["hero"] == "SB":
            continue
        rw = opens if r["of"] == "range" else None
        got = shares(chart, rw)
        e = [100 * abs(got.get(k, 0) - v) for k, v in r["want"].items()]
        (unc if r["uncertain"] else cert).extend(e)
    for h in HANDS + RAKED_HANDS:
        if chart_key_of(h[1], h[2]) != (group, key):
            continue
        v = hand_value(chart, h[3], h[4])
        facts += 100 * max(h[5] - v, v - h[6], 0.0)
        nf += 1
    m = lambda x: float(np.mean(x)) if x else None
    return {"certain": m(cert), "n": len(cert), "facts": facts, "nf": nf, "uncertain": m(unc), "nu": len(unc)}


SIX = lambda k: "EP9" not in k
CANDIDATES = [("RFI6", k) for k in ("UTG", "HJ", "CO", "BTN")] + \
             [("VS_OPEN", k) for k in G["VS_OPEN"] if SIX(k)] + [("VS_3BET", k) for k in G["VS_3BET"] if SIX(k)]

liz = {(g, k): lizard_chart(g, k, SITE_RAKE) for g, k in CANDIDATES}
liz_none = {(g, k): lizard_chart(g, k, None) for g, k in CANDIDATES}


def opens_of(src, g, k):
    if g != "VS_3BET":
        return None
    op = k.split("_vs_")[0]
    return (liz[("RFI6", op)] if src == "lizard" and ("RFI6", op) in liz else site_chart("RFI6", op))["raise"]


rows = {}
for g, k in CANDIDATES:
    s = score(g, k, site_chart(g, k), opens_of("site", g, k))
    l = score(g, k, liz[(g, k)], opens_of("lizard", g, k))
    rows[(g, k)] = (s, l)


def better(s, l):
    """Lizard's chart wins on this chart's own references: its certain error plus facts is lower, and its uncertain
    references are no worse by more than a point."""
    if s["n"] == 0 and s["nf"] == 0:
        return None   # nothing measures this chart
    ss = (s["certain"] or 0) + s["facts"]
    ll = (l["certain"] or 0) + l["facts"]
    unc_ok = s["uncertain"] is None or l["uncertain"] <= s["uncertain"] + 1.0
    return ll < ss and unc_ok


# Families: a measured chart is replaced when Lizard's wins on it (better() above). An unmeasured chart is replaced only
# when at least 80% of its family's measured charts went to Lizard's and the family's measured error at least halves.
# Of the three families only the opener facing a 3-bet qualifies (6 of 7, error 44.6 -> 2.4 a chart on 2026-11-24): the
# site's opener calls 35-42% of its open against an in-position 3-bet where the published solves call 17-25%, the same
# in the unmeasured spots (UTG vs HJ 35.4%, UTG vs CO 37.4%, HJ vs BTN 39.3%; --calls prints them).
decide = {}
for fam in ("RFI6", "VS_OPEN", "VS_3BET"):
    keys = [(g, k) for g, k in CANDIDATES if g == fam]
    measured = [x for x in keys if better(*rows[x]) is not None]
    wins = [x for x in measured if better(*rows[x])]
    se = np.mean([(rows[x][0]["certain"] or 0) + rows[x][0]["facts"] for x in measured]) if measured else 0
    le = np.mean([(rows[x][1]["certain"] or 0) + rows[x][1]["facts"] for x in measured]) if measured else 0
    family_wins = bool(measured) and len(wins) >= 0.8 * len(measured) and le <= se / 2
    for x in keys:
        b = better(*rows[x])
        decide[x] = b if b is not None else family_wins

fmt = lambda v: "   -" if v is None else f"{v:4.1f}"
print(f"{'chart':22} {'site: refs  facts  other':>26} {'Lizard: refs  facts  other':>28}  replace")
for (g, k), (s, l) in rows.items():
    print(f"{g + ' ' + k:22} {fmt(s['certain']):>12} {s['facts']:6.0f} {fmt(s['uncertain']):>6}"
          f" {fmt(l['certain']):>14} {l['facts']:6.0f} {fmt(l['uncertain']):>6}  {'yes' if decide[(g, k)] else 'no'}"
          f"{'' if better(s, l) is not None else ' (unmeasured)'}")


def to_str(v):
    out = []
    for h, x in zip(H, v):
        p = int(round(x * 20)) * 5
        if p >= 100:
            out.append(h)
        elif p > 0:
            out.append(f"{h}:{p / 100:g}")
    return ", ".join(out)


def js_chart(g, c):
    return to_str(c["raise"]) if g == "RFI6" else {"raise": to_str(c["raise"]), "call": to_str(c["call"])}


chosen = [x for x in CANDIDATES if decide[x]]
raked, none = {}, {}
RFI9_OF = {"UTG": "LJ", "HJ": "HJ", "CO": "CO", "BTN": "BTN"}   # ranges.js's RFI9 copies these from RFI6 (the trainer's opens)
for g, k in chosen:
    for gg, kk in [(g, k)] + ([("RFI9", RFI9_OF[k])] if g == "RFI6" else []):
        raked.setdefault(gg, {})[kk] = js_chart(g, liz[(g, k)])
        none.setdefault(gg, {})[kk] = js_chart(g, liz_none[(g, k)])
print(f"\n{len(chosen)} of {len(CANDIDATES)} charts go to Lizard's: " + ", ".join(f"{g} {k}" for g, k in chosen))

if WRITE:
    head = open(os.path.join(HERE, "scripts", "ranges-lizard.head.js")).read()
    data = json.dumps({"raked": raked, "none": none}, separators=(",", ":"), indent=None)
    with open(os.path.join(HERE, "js", "ranges-lizard.js"), "w") as f:
        f.write(head.replace("/*DATA*/", data))
    print("wrote js/ranges-lizard.js")

if "--calls" in sys.argv:   # the opener's call / 4-bet share of its open facing each 3-bet, site against Lizard
    for g, k in CANDIDATES:
        if g != "VS_3BET":
            continue
        s = shares(site_chart(g, k), opens_of("site", g, k))
        l = shares(liz[(g, k)], opens_of("lizard", g, k))
        print(f"{k:12} site call {100 * s['call']:5.1f} 4bet {100 * s['raise']:5.1f}   "
              f"Lizard call {100 * l['call']:5.1f} 4bet {100 * l['raise']:5.1f}")
