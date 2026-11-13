//! Corrects a round's flop-sample values for which flops the sample happened to draw (a control variate).
//!
//! A hand's postflop value on a flop moves closely with its equity there, and equity can be computed exactly on all
//! 1,755 canonical flops in about a minute. So for each pot and player we fit, on the sampled flops, how a class's
//! value moves with the mean eq, eq² and eq³ of its combos (one fit per hand type: pairs, suited, offsuit, each pulled
//! toward the fit over all hands), then remove the part of the sample average that comes from the sample's equity
//! being off the all-flop equity. The fit uses the sampled flops only. Checked on gtosolver's all-flop heads-up
//! library (the sample_check binary, run by flop_sample_error.py): it cuts the error of a 50-flop sample about 3x.
use crate::cards::N;
use postflop_solver::*;
use rayon::prelude::*;

/// Powers of equity used.
pub const K: usize = 3;
/// One player's numbers on one flop, per class: [mass, Σ mass·eq, Σ mass·eq², Σ mass·eq³].
pub type Side = Vec<[f64; K + 1]>;

/// Pairs 0, suited 1, offsuit 2 (cards::class_of layout).
pub fn group(c: usize) -> usize {
    let (x, y) = (c / 13, c % 13);
    if x == y { 0 } else if x > y { 1 } else { 2 }
}

fn no_bets() -> TreeConfig {
    let none = BetSizeOptions::try_from(("", "")).unwrap();
    TreeConfig {
        initial_state: BoardState::Flop, starting_pot: 100, effective_stack: 100, rake_rate: 0.0, rake_cap: 0.0,
        flop_bet_sizes: [none.clone(), none.clone()], turn_bet_sizes: [none.clone(), none.clone()], river_bet_sizes: [none.clone(), none],
        turn_donk_sizes: None, river_donk_sizes: None, add_allin_threshold: 0.0, force_allin_threshold: 0.0, merging_threshold: 0.0,
    }
}

/// Each player's hands on a flop (solver order, 0 out of position): (cards, equity, normalized weight) per hand.
pub fn flop_hands(ranges: [Range; 2], flop: [u8; 3]) -> [(Vec<(u8, u8)>, Vec<f32>, Vec<f32>); 2] {
    let mut f = flop;
    f.sort_unstable();
    let cfg = CardConfig { range: ranges, flop: f, turn: NOT_DEALT, river: NOT_DEALT };
    let mut g = PostFlopGame::with_config(cfg, ActionTree::new(no_bets()).unwrap()).unwrap();
    g.cache_normalized_weights();
    std::array::from_fn(|p| (g.private_cards(p).to_vec(), g.equity(p), g.normalized_weights(p).to_vec()))
}

/// Each player's per-class equity numbers on each flop; ranges and the result are in solver order (0 out of position).
pub fn eq_stats(ranges: [Range; 2], flops: &[[u8; 3]]) -> Vec<[Side; 2]> {
    flops.par_iter().map(|&f| {
        let h = flop_hands(ranges, f);
        std::array::from_fn(|p| {
            let (cards, eq, w) = &h[p];
            let mut s = vec![[0.0; K + 1]; N];
            for (i, &(a, b)) in cards.iter().enumerate() {
                let (m, e) = (w[i] as f64, eq[i] as f64);
                if m <= 0.0 { continue; }
                let c = &mut s[crate::cards::class_of(a, b)];
                let mut x = m;
                for k in 0..=K { c[k] += x; x *= e; }
            }
            s
        })
    }).collect()
}

/// Weighted all-flop mean of eq^k per class: flops[i] stands for weights[i] of the 22,100.
pub fn exact_eq(stats: &[&Side], weights: &[f64]) -> Vec<[f64; K]> {
    (0..N).map(|c| {
        let m: f64 = stats.iter().zip(weights).map(|(s, w)| w * s[c][0]).sum();
        std::array::from_fn(|k| if m > 0.0 { stats.iter().zip(weights).map(|(s, w)| w * s[c][k + 1]).sum::<f64>() / m } else { 0.0 })
    }).collect()
}

fn solve(mut a: [[f64; K]; K], mut b: [f64; K]) -> [f64; K] {
    for i in 0..K {
        let p = (i..K).max_by(|&x, &y| a[x][i].abs().total_cmp(&a[y][i].abs())).unwrap();
        a.swap(i, p);
        b.swap(i, p);
        if a[i][i].abs() < 1e-300 { return [0.0; K]; }
        for r in 0..K {
            if r == i { continue; }
            let f = a[r][i] / a[i][i];
            for j in 0..K { a[r][j] -= f * a[i][j]; }
            b[r] -= f * b[i];
        }
    }
    std::array::from_fn(|i| b[i] / a[i][i])
}

/// The corrected per-class value of one player in one pot. `mass[f][c]` and `mv[f][c]` are the sampled flops' class
/// mass and mass x value (solve_flop's rows), `stats[f]` the same flops' equity numbers, `exact` exact_eq over all
/// flops, `pot` the pot in bb. Returns (corrected values, uncorrected values, fitted slopes per hand type).
pub fn correct(mass: &[&[f64]], mv: &[&[f64]], stats: &[&Side], exact: &[[f64; K]], pot: f64) -> (Vec<f64>, Vec<f64>, [[f64; K]; 3]) {
    let nf = mass.len();
    let mut vbar = vec![0.0; N];
    let mut xbar = vec![[0.0; K]; N];
    for c in 0..N {
        let m: f64 = (0..nf).map(|f| mass[f][c]).sum();
        if m > 0.0 { vbar[c] = (0..nf).map(|f| mv[f][c]).sum::<f64>() / m; }
        let me: f64 = (0..nf).map(|f| stats[f][c][0]).sum();
        if me > 0.0 { for k in 0..K { xbar[c][k] = (0..nf).map(|f| stats[f][c][k + 1]).sum::<f64>() / me; } }
    }
    // weighted least squares of (flop value - sample mean) on pot x (flop eq^k - sample mean), within classes
    let mut a = [[[0.0; K]; K]; 4];
    let mut b = [[0.0; K]; 4];
    for f in 0..nf { for c in 0..N {
        let (m, me) = (mass[f][c], stats[f][c][0]);
        if m <= 0.0 || me <= 0.0 { continue; }
        let y = mv[f][c] / m - vbar[c];
        let x: [f64; K] = std::array::from_fn(|k| pot * (stats[f][c][k + 1] / me - xbar[c][k]));
        for g in [group(c), 3] { for i in 0..K {
            b[g][i] += m * x[i] * y;
            for j in 0..K { a[g][i][j] += m * x[i] * x[j]; }
        } }
    } }
    let tr = (0..K).map(|i| a[3][i][i]).sum::<f64>() / K as f64;
    let ridge = |mut m: [[f64; K]; K], l: f64| { for i in 0..K { m[i][i] += l; } m };
    let pooled = solve(ridge(a[3], 1e-9 * tr), b[3]);
    let lam = 0.001 * tr;
    let beta: [[f64; K]; 3] = std::array::from_fn(|g| solve(ridge(a[g], lam), std::array::from_fn(|i| b[g][i] + lam * pooled[i])));
    let out = (0..N).map(|c| {
        if stats.iter().all(|s| s[c][0] <= 0.0) { return vbar[c]; }
        vbar[c] - (0..K).map(|k| beta[group(c)][k] * pot * (xbar[c][k] - exact[c][k])).sum::<f64>()
    }).collect();
    (out, vbar, beta)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Values that are an exact cubic in flop equity (a different one per hand type): the correction should recover
    /// the all-flop value from a 50-flop sample almost exactly, where the plain sample average is well off.
    #[test]
    fn recovers_values_that_follow_equity() {
        let (nf, pot) = (500usize, 6.0);
        let mut seed = 12345u64;
        let mut rnd = || { seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407); (seed >> 11) as f64 / (1u64 << 53) as f64 };
        let coef = [[0.3, 1.2, -0.4, 0.8], [0.1, 2.0, 0.5, -0.3], [-0.2, 1.5, 0.0, 0.6]];
        let val = |c: usize, e: f64| { let g = &coef[group(c)]; g[0] + pot * (g[1] * e + g[2] * e * e + g[3] * e * e * e) };
        // one combo per class per flop: mass m, equity e
        let flops: Vec<Vec<(f64, f64)>> = (0..nf).map(|_| (0..N).map(|_| (0.5 + rnd(), rnd())).collect()).collect();
        let sides: Vec<Side> = flops.iter().map(|f| f.iter().map(|&(m, e)| [m, m * e, m * e * e, m * e * e * e]).collect()).collect();
        let exact = exact_eq(&sides.iter().collect::<Vec<_>>(), &vec![1.0; nf]);
        let truth: Vec<f64> = (0..N).map(|c| {
            flops.iter().map(|f| f[c].0 * val(c, f[c].1)).sum::<f64>() / flops.iter().map(|f| f[c].0).sum::<f64>()
        }).collect();
        let pick: Vec<usize> = (0..nf).step_by(10).collect();
        let mass: Vec<Vec<f64>> = pick.iter().map(|&f| flops[f].iter().map(|x| x.0).collect()).collect();
        let mv: Vec<Vec<f64>> = pick.iter().map(|&f| (0..N).map(|c| flops[f][c].0 * val(c, flops[f][c].1)).collect()).collect();
        let st: Vec<&Side> = pick.iter().map(|&f| &sides[f]).collect();
        let (fixed, plain, beta) = correct(&mass.iter().map(|v| v.as_slice()).collect::<Vec<_>>(),
            &mv.iter().map(|v| v.as_slice()).collect::<Vec<_>>(), &st, &exact, pot);
        let err = |v: &[f64]| (0..N).map(|c| (v[c] - truth[c]).abs()).fold(0.0, f64::max);
        println!("worst error: sample average {:.4}, corrected {:.6}; slopes {beta:?}", err(&plain), err(&fixed));
        assert!(err(&plain) > 0.2);
        assert!(err(&fixed) < err(&plain) / 20.0);
    }
}
