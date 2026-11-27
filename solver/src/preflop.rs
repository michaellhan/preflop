//! The heads-up preflop tree and a CFR+ solve of it. Postflop outcomes enter as fixed per-hand values (bb, net of
//! the money put in preflop) that come from the postflop solves of the previous round.
use crate::cards::N;

pub const SB: usize = 0;
pub const BB: usize = 1;
pub const STACK: f64 = 100.0;
pub const RAKE_CAP: f64 = 0.5;
pub const POTS: usize = 6;
/// name, each player's preflop investment in bb, postflop bet tree shape is chosen per run.
pub const POT_INFO: [(&str, f64); POTS] = [
    ("limp", 1.0), ("limp_raise", 4.0), ("limp_3bet", 12.0), ("open", 2.5), ("threebet", 10.0), ("fourbet", 22.0),
];

#[derive(Clone, Copy)]
pub enum Child { Go(usize), Fold { winner: usize, amount: f64 }, AllIn, Pot(usize) }
pub struct Node { pub name: &'static str, pub player: usize, pub actions: Vec<(&'static str, Child)> }

pub fn tree() -> Vec<Node> {
    use Child::*;
    vec![
        crate::preflop::Node { name: "sb_open", player: SB, actions: vec![("raise", Go(1)), ("limp", Go(5)), ("fold", Fold { winner: BB, amount: 0.5 })] },
        crate::preflop::Node { name: "bb_vs_open", player: BB, actions: vec![("raise", Go(2)), ("call", Pot(3)), ("fold", Fold { winner: SB, amount: 1.0 })] },
        crate::preflop::Node { name: "sb_vs_3bet", player: SB, actions: vec![("raise", Go(3)), ("call", Pot(4)), ("fold", Fold { winner: BB, amount: 2.5 })] },
        crate::preflop::Node { name: "bb_vs_4bet", player: BB, actions: vec![("raise", Go(4)), ("call", Pot(5)), ("fold", Fold { winner: SB, amount: 10.0 })] },
        crate::preflop::Node { name: "sb_vs_jam", player: SB, actions: vec![("call", AllIn), ("fold", Fold { winner: BB, amount: 22.0 })] },
        crate::preflop::Node { name: "bb_vs_limp", player: BB, actions: vec![("raise", Go(6)), ("check", Pot(0))] },
        crate::preflop::Node { name: "sb_vs_iso", player: SB, actions: vec![("raise", Go(7)), ("call", Pot(1)), ("fold", Fold { winner: BB, amount: 1.0 })] },
        crate::preflop::Node { name: "bb_vs_limp3bet", player: BB, actions: vec![("raise", Go(8)), ("call", Pot(2)), ("fold", Fold { winner: SB, amount: 4.0 })] },
        crate::preflop::Node { name: "sb_vs_limpjam", player: SB, actions: vec![("call", AllIn), ("fold", Fold { winner: BB, amount: 12.0 })] },
    ]
}

/// strategy[node][action][class]
pub type Strategy = Vec<Vec<Vec<f64>>>;
pub type Values = Vec<[Vec<f64>; 2]>; // values[pot][player][class]

/// How a pot's postflop value responds when the opponent's range differs from the one it was solved against:
/// `values` hold each hand's value against the solved range, and a hand's value against a single opposing hand is
/// taken to move with its preflop equity against that hand, `response` x pot x (equity - equity against the solved range).
/// At a fixed point the ranges equal the solved ones, so this only shapes how the preflop solve responds to change.
pub struct PotRef { pub size: f64, pub ref_eq: [Vec<f64>; 2] }

pub struct Ctx<'a> { pub tree: &'a [Node], pub eq: &'a [Vec<f64>], pub compat: &'a [Vec<f64>], pub values: &'a Values, pub pots: &'a [PotRef], pub response: f64 }

impl Ctx<'_> {
    fn opp_mass(&self, reach: &[f64]) -> Vec<f64> {
        (0..N).map(|h| { let c = &self.compat[h]; (0..N).map(|o| c[o] * reach[o]).sum() }).collect()
    }
    fn terminal(&self, c: Child, me: usize, opp: &[f64]) -> Vec<f64> {
        match c {
            Child::Fold { winner, amount } => {
                let sign = if winner == me { amount } else { -amount };
                self.opp_mass(opp).iter().map(|m| m * sign).collect()
            }
            Child::Pot(p) => {
                let (v, r, k) = (&self.values[p][me], &self.pots[p].ref_eq[me], self.response * self.pots[p].size);
                (0..N).map(|h| {
                    let (c, e) = (&self.compat[h], &self.eq[h]);
                    let (mut m, mut me_eq) = (0.0, 0.0);
                    for o in 0..N { let w = c[o] * opp[o]; m += w; me_eq += w * e[o]; }
                    m * (v[h] - k * r[h]) + k * me_eq
                }).collect()
            }
            Child::AllIn => (0..N).map(|h| {
                let (c, e) = (&self.compat[h], &self.eq[h]);
                (0..N).map(|o| c[o] * opp[o] * (e[o] * (2.0 * STACK - RAKE_CAP) - STACK)).sum()
            }).collect(),
            Child::Go(_) => unreachable!(),
        }
    }
}

fn from_regret(r: &[Vec<f64>], h: usize) -> Vec<f64> {
    let s: f64 = r.iter().map(|a| a[h].max(0.0)).sum();
    if s > 0.0 { r.iter().map(|a| a[h].max(0.0) / s).collect() } else { vec![1.0 / r.len() as f64; r.len()] }
}

struct Cfr { regret: Strategy, sum: Strategy }

fn cfr(ctx: &Ctx, st: &mut Cfr, n: usize, me: usize, mine: &[f64], opp: &[f64], it: f64) -> Vec<f64> {
    let node = &ctx.tree[n];
    let na = node.actions.len();
    let sigma: Vec<Vec<f64>> = (0..N).map(|h| from_regret(&st.regret[n], h)).collect();
    if node.player == me {
        let mut vals = Vec::with_capacity(na);
        for a in 0..na {
            let r2: Vec<f64> = (0..N).map(|h| mine[h] * sigma[h][a]).collect();
            let v = match node.actions[a].1 {
                Child::Go(c) => cfr(ctx, st, c, me, &r2, opp, it),
                t => ctx.terminal(t, me, opp),
            };
            vals.push(v);
        }
        let ev: Vec<f64> = (0..N).map(|h| (0..na).map(|a| sigma[h][a] * vals[a][h]).sum()).collect();
        for a in 0..na { for h in 0..N {
            st.regret[n][a][h] = (st.regret[n][a][h] + vals[a][h] - ev[h]).max(0.0);
            st.sum[n][a][h] += it * mine[h] * sigma[h][a];
        } }
        ev
    } else {
        let mut ev = vec![0.0; N];
        for a in 0..na {
            let r2: Vec<f64> = (0..N).map(|o| opp[o] * sigma[o][a]).collect();
            let v = match node.actions[a].1 {
                Child::Go(c) => cfr(ctx, st, c, me, mine, &r2, it),
                t => ctx.terminal(t, me, &r2),
            };
            for h in 0..N { ev[h] += v[h]; }
        }
        ev
    }
}

/// Equilibrium of the preflop tree for fixed postflop values. `fallback` fills in hands that never reach a node.
pub fn solve(ctx: &Ctx, iters: usize, fallback: &Strategy) -> Strategy { solve_full(ctx, iters, fallback, &[]).0 }

fn average(st: &Cfr, fallback: &Strategy) -> Strategy {
    let mut out = fallback.clone();
    for n in 0..st.sum.len() { for h in 0..N {
        let t: f64 = st.sum[n].iter().map(|a| a[h]).sum();
        if t > 1e-9 { for a in 0..st.sum[n].len() { out[n][a][h] = st.sum[n][a][h] / t; } }
    } }
    out
}

/// `solve`, also returning the final cumulative (CFR+, floored) regrets and the exploitability of the average
/// strategy (bb per hand, both players' best-response gains added) at each iteration count in `checkpoints`.
pub fn solve_full(ctx: &Ctx, iters: usize, fallback: &Strategy, checkpoints: &[usize]) -> (Strategy, Strategy, Vec<(usize, f64)>) {
    let blank = |x: f64| -> Strategy { ctx.tree.iter().map(|n| vec![vec![x; N]; n.actions.len()]).collect() };
    let mut st = Cfr { regret: blank(0.0), sum: blank(0.0) };
    let one = vec![1.0; N];
    let mut conv = Vec::new();
    for i in 1..=iters {
        for p in [SB, BB] { cfr(ctx, &mut st, 0, p, &one, &one, i as f64); }
        if checkpoints.contains(&i) { conv.push((i, exploitability(ctx, &average(&st, fallback)))); }
    }
    (average(&st, fallback), st.regret, conv)
}

/// bb per hand both players together would gain by best-responding to `s` (rake makes the game non-zero-sum, so
/// each player's gain is measured against what they get playing `s`, not against zero).
pub fn exploitability(ctx: &Ctx, s: &Strategy) -> f64 {
    let one = vec![1.0; N];
    let cc = crate::cards::class_combos();
    let tot = |v: Vec<f64>| (0..N).map(|h| v[h] * cc[h].len() as f64).sum::<f64>() / 1326.0 / 1225.0;
    [SB, BB].iter().map(|&p| tot(evaluate(ctx, s, 0, p, &one, true)) - tot(evaluate(ctx, s, 0, p, &one, false))).sum()
}

/// Per own decision node: each action's value per combo (bb, given the hand reaches the node, against the
/// opponent's range there), the opponent mass the hand faces there (counterfactual reach), and the hand's own reach.
pub struct NodeAudit { pub action_ev: Vec<Vec<f64>>, pub opp_mass: Vec<f64>, pub own_reach: Vec<f64> }

pub fn audit(ctx: &Ctx, s: &Strategy, me: usize) -> Vec<Option<NodeAudit>> {
    let mut out: Vec<Option<NodeAudit>> = (0..ctx.tree.len()).map(|_| None).collect();
    fn rec(ctx: &Ctx, s: &Strategy, n: usize, me: usize, mine: &[f64], opp: &[f64], out: &mut Vec<Option<NodeAudit>>) -> Vec<f64> {
        let node = &ctx.tree[n];
        let na = node.actions.len();
        if node.player == me {
            let vals: Vec<Vec<f64>> = (0..na).map(|a| {
                let r2: Vec<f64> = (0..N).map(|h| mine[h] * s[n][a][h]).collect();
                match node.actions[a].1 { Child::Go(c) => rec(ctx, s, c, me, &r2, opp, out), t => ctx.terminal(t, me, opp) }
            }).collect();
            let m = ctx.opp_mass(opp);
            let per = |a: usize| -> Vec<f64> { (0..N).map(|h| if m[h] > 1e-12 { vals[a][h] / m[h] } else { 0.0 }).collect() };
            out[n] = Some(NodeAudit { action_ev: (0..na).map(per).collect(), opp_mass: m, own_reach: mine.to_vec() });
            (0..N).map(|h| (0..na).map(|a| s[n][a][h] * vals[a][h]).sum()).collect()
        } else {
            let mut ev = vec![0.0; N];
            for a in 0..na {
                let r2: Vec<f64> = (0..N).map(|o| opp[o] * s[n][a][o]).collect();
                let v = match node.actions[a].1 { Child::Go(c) => rec(ctx, s, c, me, mine, &r2, out), t => ctx.terminal(t, me, &r2) };
                for h in 0..N { ev[h] += v[h]; }
            }
            ev
        }
    }
    let one = vec![1.0; N];
    rec(ctx, s, 0, me, &one, &one, &mut out);
    out
}

/// Value of `s` for `me` per class, either played as given or with `me` best-responding.
pub fn evaluate(ctx: &Ctx, s: &Strategy, n: usize, me: usize, opp: &[f64], best: bool) -> Vec<f64> {
    let node = &ctx.tree[n];
    let na = node.actions.len();
    if node.player == me {
        let vals: Vec<Vec<f64>> = (0..na).map(|a| match node.actions[a].1 {
            Child::Go(c) => evaluate(ctx, s, c, me, opp, best),
            t => ctx.terminal(t, me, opp),
        }).collect();
        (0..N).map(|h| if best { (0..na).map(|a| vals[a][h]).fold(f64::MIN, f64::max) }
            else { (0..na).map(|a| s[n][a][h] * vals[a][h]).sum() }).collect()
    } else {
        let mut ev = vec![0.0; N];
        for a in 0..na {
            let r2: Vec<f64> = (0..N).map(|o| opp[o] * s[n][a][o]).collect();
            let v = match node.actions[a].1 {
                Child::Go(c) => evaluate(ctx, s, c, me, &r2, best),
                t => ctx.terminal(t, me, &r2),
            };
            for h in 0..N { ev[h] += v[h]; }
        }
        ev
    }
}

/// Reach of each player's range at each postflop pot.
pub fn pot_ranges(s: &Strategy) -> Vec<[Vec<f64>; 2]> {
    let mul = |xs: &[&Vec<f64>]| -> Vec<f64> { (0..N).map(|h| xs.iter().map(|x| x[h]).product()).collect() };
    vec![
        [mul(&[&s[0][1]]), mul(&[&s[5][1]])],                 // limp, check
        [mul(&[&s[0][1], &s[6][1]]), mul(&[&s[5][0]])],       // limp, raise, call
        [mul(&[&s[0][1], &s[6][0]]), mul(&[&s[5][0], &s[7][1]])], // limp, raise, 3-bet, call
        [mul(&[&s[0][0]]), mul(&[&s[1][1]])],                 // open, call
        [mul(&[&s[0][0], &s[2][1]]), mul(&[&s[1][0]])],       // open, 3-bet, call
        [mul(&[&s[0][0], &s[2][0]]), mul(&[&s[1][0], &s[3][1]])], // open, 3-bet, 4-bet, call
    ]
}
