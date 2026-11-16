"""Builds js/ranges-norake.js: every chart in js/ranges.js moved from the charts' rake (5% capped at 0.5bb) to no rake.

    heavy <lizard>/.venv/bin/python -B scripts/build-norake.py <lizard repo> <dir with lz2_{2,6}max_100bb_r5c0.5.bin>

The shift comes from Lizard's preflop solver (engine/pf_solve.py, its calibrated class-level model), solved at both
rakes: its stored no-rake games (engine/pf/lz2_6max_100bb.bin, lz2_2max_100bb.bin) and the same games at 5% capped at
0.5bb (solved once for this build). Each chart keeps its own hands and is moved only by how much the solver's matching
node continues and raises more or less without rake (spot level, as /charts' live.py does: the class-level model's
hand-by-hand mixes are noisy, its totals are not). The share of the range that continues is scaled by the no-rake /
raked ratio at the node (or, for a range that plays over half its hands, the share it folds), held to 0.67-1.5; the
share that raises by the square root of its ratio (the model's raise/call split is the less certain part). Shares
under 1.5% of the range are left alone. The hands that take up or give back the difference are
picked by the chart's own mix, how often the seat plays the hand in its other charts, and the solver's no-rake EV.

Matching node: 9-max seats play the 6-max seat with the same role (UTG+1/UTG+2/LJ and the EP9 tier as 6-max UTG); the
generic cold 4-bet / squeeze charts (IP_vs_EP and so on) a representative line. The 6-max limped-pot charts (VS_LIMP)
stay as they are: the solver's 6-max tree has no small-blind limp.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys

import numpy as np

LIZ, SOLVED = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path[:0] = [os.path.join(LIZ, "solver"), LIZ]
import gto.native  # noqa: E402,F401
from gto.pf_classes import CLASSES  # noqa: E402
from engine import pf_solve as PS  # noqa: E402

base = json.loads(subprocess.check_output(["node", os.path.join(HERE, "scripts", "export-ranges.mjs")]))
HANDS = base["hands"]
COMBOS = np.array(base["combos"], dtype=float)
CIDX = {c: i for i, c in enumerate(CLASSES)}
GRID_TO_CLS = [CIDX[h] if h in CIDX else CIDX[h[1] + h[0] + h[2:]] for h in HANDS]
CLIP = (0.67, 1.5)
MIN_SHARE = 0.015


def load(n: int, rake):
    spec = PS.Spec(players=n, rake=rake)
    path = (os.path.join(LIZ, "engine", "pf", spec.key + ".bin") if rake is None
            else os.path.join(SOLVED, f"lz2_{n}max_100bb_r5c0.5.bin"))
    return PS.Solve(spec, open(path, "rb").read())


SOLVES = {n: {"rake": load(n, (0.05, 0.5)), "none": load(n, None)} for n in (6, 2)}
POS = {6: ["UTG", "HJ", "CO", "BTN", "SB", "BB"], 2: ["SB", "BB"]}


def line(n, events, hero):
    """Preflop line to hero's decision: `events` [(seat, 'raise'|'call')] in order, every other seat folding."""
    out, folded, ev = [], set(), list(events)
    for seat in POS[n] * 3:
        if not ev and seat == hero:
            return out
        if seat in folded:
            continue
        if ev and seat == ev[0][0]:
            out.append({"pos": seat, "action": ev.pop(0)[1]})
        elif not any(seat == e["pos"] for e in out):
            out.append({"pos": seat, "action": "fold"})
            folded.add(seat)
    raise ValueError((events, hero))


def node(solve, ln):
    """Per hand: range weight, mix [raise, call] and EVs [raise, call] (bb vs folding; -inf where absent). A check is
    the residual action (as in the charts), so it counts as neither."""
    r = solve.node(ln)
    if "grid" not in r:
        raise RuntimeError((ln, r))
    names = r["grid"]["actions"]
    w, f, ev = np.zeros(169), np.zeros((169, 2)), np.full((169, 2), -np.inf)
    for gi, ci in enumerate(GRID_TO_CLS):
        c = r["grid"]["cells"].get(CLASSES[ci])
        if c is None:
            continue
        w[gi] = c["w"]
        for nm, fr, e in zip(names, c["f"], c["ev"]):
            k = 0 if nm in ("raise", "all-in") else 1 if nm == "call" else None
            if k is not None:
                f[gi, k] += fr
                ev[gi, k] = max(ev[gi, k], e)
    return w, f, ev


def share(f, w, k):
    return float((f[:, k] * w).sum() / max(w.sum(), 1e-12))


def adjust(a, n, ln, rw=None, prior=None):
    a = np.array(a, dtype=float)
    if a.shape[1] == 1:
        a = np.hstack([a, np.zeros((169, 1))])
    wgt = COMBOS * (np.ones(169) if rw is None else np.asarray(rw))
    w0, f0, _ = node(SOLVES[n]["rake"], ln)
    w1, f1, ev = node(SOLVES[n]["none"], ln)
    w0, w1 = COMBOS * w0, COMBOS * w1
    has_call = np.isfinite(ev[:, 1]).any()
    c0, c1 = share(f0, w0, 0) + share(f0, w0, 1), share(f1, w1, 0) + share(f1, w1, 1)
    r0, r1 = share(f0, w0, 0), share(f1, w1, 0)
    # (a share under 1.5% of the range is too small for the model's ratio to mean anything: left as it is)
    ratio = lambda x, y: float(np.clip(y / x, *CLIP)) if x > MIN_SHARE else 1.0
    best = np.max(np.where(np.isfinite(ev), ev, -1e9), axis=1)
    score = a.sum(1) + (0 if prior is None else np.asarray(prior)) + 0.5 * np.clip(best, -1, 1)
    cur, tot = (a.sum(1) * wgt).sum(), wgt.sum()
    if cur / tot <= 0.5:
        target = cur * ratio(c0, c1)
    else:   # a range that plays most hands: scale what it folds instead (so 90% can't become 130%)
        target = tot - (tot - cur) * ratio(1 - c0, 1 - c1)
    if target > cur:
        for i in np.argsort(-score):
            if cur >= target - 1e-9:
                break
            room = 1 - a[i].sum()
            if room <= 0 or best[i] <= -1e8 or wgt[i] == 0:
                continue
            add = min(room, (target - cur) / wgt[i])
            a[i, 1 if has_call and ev[i, 1] > ev[i, 0] else 0] += add
            cur += add * wgt[i]
    else:
        for i in np.argsort(score):
            if cur <= target + 1e-9:
                break
            have = a[i].sum()
            if have <= 0 or wgt[i] == 0:
                continue
            cut = min(have, (cur - target) / wgt[i])
            a[i] *= (have - cut) / have
            cur -= cut * wgt[i]
    if has_call:
        edge = np.where(np.isfinite(ev[:, 0]) & np.isfinite(ev[:, 1]), ev[:, 0] - ev[:, 1], 0.0)
        tot = a.sum(1)
        edge = np.where(tot > 0, a[:, 0] / np.maximum(tot, 1e-9), 0.0) + np.clip(edge, -1, 1)
        target, cur = (a[:, 0] * wgt).sum() * ratio(r0, r1) ** 0.5, (a[:, 0] * wgt).sum()
        for i in (np.argsort(-edge) if target > cur else np.argsort(edge)):
            if abs(cur - target) < 1e-9 or wgt[i] == 0:
                break
            if target > cur and a[i, 1] > 0:
                mv = min(a[i, 1], (target - cur) / wgt[i])
                a[i] += [mv, -mv]
                cur += mv * wgt[i]
            elif target < cur and a[i, 0] > 0:
                mv = min(a[i, 0], (cur - target) / wgt[i])
                a[i] += [-mv, mv]
                cur -= mv * wgt[i]
    a = np.clip(a, 0, 1)
    # round to the charts' 5% steps without letting a hand's actions add past 100%
    q = np.round(a * 20) / 20
    over = q.sum(1) > 1
    q[over, 1] = 1 - q[over, 0]
    return q, (c0, c1, r0, r1)


SIX = lambda s: "UTG" if s in ("UTG+1", "UTG+2", "LJ", "EP9", "EP") else s
G = base["groups"]
out, report = {}, []


def put(group, key, acts, arr, info, rw=None):
    out.setdefault(group, {})[key] = {a: arr[:, i].tolist() for i, a in enumerate(acts)}
    old = np.array([G[group][key][a] for a in acts]).T
    w = COMBOS * (np.ones(169) if rw is None else np.asarray(rw))
    p = lambda x, i: 100 * float((x[:, i] * w).sum() / w.sum())
    c0, c1, r0, r1 = info
    report.append(f"{group:9} {key:14} " + "  ".join(f"{a} {p(old, i):5.1f}->{p(arr, i):5.1f}" for i, a in enumerate(acts))
                  + f"   (solver continue {100 * c0:4.1f}->{100 * c1:4.1f}, raise {100 * r0:4.1f}->{100 * r1:4.1f})")


def pair(group, key, acts=("raise", "call")):
    return np.array([G[group][key].get(a, [0.0] * 169) for a in acts]).T


def prior(group, prefix):
    cs = [np.sum([np.asarray(v) for v in c.values()], axis=0) for k, c in G[group].items() if k.startswith(prefix)]
    return np.mean(cs, axis=0) if cs else None


# ---- opens (6-max and 9-max; the SB's limp rides along with its raise) ----
for group in ("RFI6", "RFI9"):
    rp = np.mean([np.asarray(G[group][k]["raise"]) for k in G[group] if k != "SB_LIMP"], axis=0)
    for key in G[group]:
        if key == "SB_LIMP":
            continue
        if key == "SB":
            a = np.array([G[group]["SB"]["raise"], G[group]["SB_LIMP"]["raise"]]).T
            q, info = adjust(a, 6, line(6, [], "SB"), prior=rp)
            put(group, "SB", ["raise"], q[:, :1], info)
            out[group]["SB_LIMP"] = {"raise": q[:, 1].tolist()}
            continue
        q, info = adjust(pair(group, key, ("raise",)), 6, line(6, [], SIX(key)), prior=rp)
        put(group, key, ["raise"], q[:, :1], info)

# ---- facing an open ----
for key in G["VS_OPEN"]:
    hero, op = key.split("_vs_")
    q, info = adjust(pair("VS_OPEN", key), 6, line(6, [(SIX(op), "raise")], hero), prior=prior("VS_OPEN", hero + "_vs_"))
    put("VS_OPEN", key, ["raise", "call"], q, info)

# ---- facing a 3-bet (weighted by the opener's open) ----
OPEN_OF = {"EP9": G["RFI9"]["UTG+1"]["raise"]}
for key in G["VS_3BET"]:
    op, th = key.split("_vs_")
    rw = OPEN_OF.get(op, G["RFI6"].get(op, {}).get("raise"))
    q, info = adjust(pair("VS_3BET", key), 6, line(6, [(SIX(op), "raise"), (th, "raise")], SIX(op)), rw,
                     prior("VS_3BET", op + "_vs_"))
    put("VS_3BET", key, ["raise", "call"], q, info, rw)

# ---- cold 4-bets and squeezes ----
GENERIC = {"IP_vs_EP": ("BTN", "UTG", "HJ"), "SB_vs_EP": ("SB", "UTG", "HJ"), "SB_vs_LP": ("SB", "CO", "BTN"),
           "BB_vs_EP": ("BB", "UTG", "HJ"), "BB_vs_LP": ("BB", "CO", "BTN"), "BB_vs_BTN_SB": ("BB", "BTN", "SB")}
for group, mid_act in (("COLD_4BET", "raise"), ("SQUEEZE", "call")):
    for key in G[group]:
        if key in GENERIC:
            hero, op, mid = GENERIC[key]
        else:
            hero, rest = key.split("_vs_")
            op, mid = rest.split("_")
        q, info = adjust(pair(group, key), 6, line(6, [(op, "raise"), (mid, mid_act)], hero),
                         prior=prior(group, key.split("_vs_")[0] + "_vs_"))
        put(group, key, ["raise", "call"], q, info)

# ---- heads-up ----
HU = G["HU"]
q, info = adjust(pair("HU", "SB_OPEN", ("raise", "limp")), 2, line(2, [], "SB"))
put("HU", "SB_OPEN", ["raise", "limp"], q, info)
q, info = adjust(pair("HU", "BB_vs_SB"), 2, line(2, [("SB", "raise")], "BB"))
put("HU", "BB_vs_SB", ["raise", "call"], q, info)
q, info = adjust(pair("HU", "SB_vs_BB_3BET"), 2, line(2, [("SB", "raise"), ("BB", "raise")], "SB"), HU["SB_OPEN"]["raise"])
put("HU", "SB_vs_BB_3BET", ["raise", "call"], q, info, HU["SB_OPEN"]["raise"])
q, info = adjust(pair("HU", "BB_vs_LIMP", ("raise",)), 2, line(2, [("SB", "call")], "BB"))
put("HU", "BB_vs_LIMP", ["raise"], q[:, :1], info)
q, info = adjust(pair("HU", "SB_vs_ISO"), 2, line(2, [("SB", "call"), ("BB", "raise")], "SB"), HU["SB_OPEN"]["limp"])
put("HU", "SB_vs_ISO", ["raise", "call"], q, info, HU["SB_OPEN"]["limp"])

# ---- write: two base-36 digits... one digit (0..k = 0..100% in 5% steps) per hand per action ----
enc = {g: {k: {a: "".join(np.base_repr(int(round(x * 20)), 36).lower() for x in v) for a, v in c.items()}
           for k, c in charts.items()} for g, charts in out.items()}
meta = {"raked": SOLVES[6]["rake"].spec.label(), "none": SOLVES[6]["none"].spec.label(),
        "mbb": {n: [SOLVES[n]["rake"].mbb, SOLVES[n]["none"].mbb] for n in SOLVES}}
with open(os.path.join(HERE, "js", "ranges-norake.js"), "w") as f:
    f.write(open(os.path.join(HERE, "scripts", "ranges-norake.head.js")).read()
            .replace("/*DATA*/", json.dumps(enc, separators=(",", ":"))))
open(os.path.join(HERE, "scripts", "norake-report.txt"), "w").write("\n".join(report) + "\n" + json.dumps(meta) + "\n")
print("\n".join(report))
print(meta)
