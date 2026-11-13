//! Checks correct.rs against the truth: gtosolver's heads-up library, which has every canonical flop solved.
//! Usage: sample_check DIR, where DIR holds (written by flop_sample_error.py)
//!   ranges.txt  two lines of 1326 weights (out-of-position player, then in-position), combos in cards::combos() order
//!   values.bin  little-endian: u32 flop count, then per flop 3 card bytes, a u32 weight (how many of the 22,100 it
//!               stands for) and 1326 f32: the out-of-position player's EV per combo (NaN when not in its range)
//! Prints, for 50-flop samples like the solver's, the error per class of the sample average against the all-flop
//! average, with and without the correction.
#[path = "../cards.rs"]
#[allow(dead_code)]
mod cards;
#[path = "../correct.rs"]
#[allow(dead_code)]
mod correct;
use cards::*;
use correct::*;
use postflop_solver::Range;
use rayon::prelude::*;
use std::{collections::HashMap, fs};

fn main() {
    let dir = std::env::args().nth(1).expect("usage: sample_check DIR");
    let rl: Vec<Vec<f32>> = fs::read_to_string(format!("{dir}/ranges.txt")).unwrap().lines().take(2)
        .map(|l| l.split_whitespace().map(|x| x.parse().unwrap()).collect()).collect();
    let all = combos();
    let ranges: [Range; 2] = std::array::from_fn(|p| {
        let mut r = Range::new();
        for (i, &(a, b)) in all.iter().enumerate() { r.set_weight_by_cards(a, b, rl[p][i]); }
        r
    });
    let raw = fs::read(format!("{dir}/values.bin")).unwrap();
    let nf = u32::from_le_bytes(raw[0..4].try_into().unwrap()) as usize;
    let rec = 3 + 4 + 4 * 1326;
    let flops: Vec<([u8; 3], f64, Vec<f32>)> = (0..nf).map(|i| {
        let r = &raw[4 + i * rec..4 + (i + 1) * rec];
        let ev = (0..1326).map(|k| f32::from_le_bytes(r[7 + 4 * k..11 + 4 * k].try_into().unwrap())).collect();
        ([r[0], r[1], r[2]], u32::from_le_bytes(r[3..7].try_into().unwrap()) as f64, ev)
    }).collect();
    let index: HashMap<(u8, u8), usize> = all.iter().enumerate().map(|(i, &c)| (c, i)).collect();
    // per flop: class mass and mass x value of the out-of-position player, and its equity numbers
    let per: Vec<(Vec<f64>, Vec<f64>, Side)> = flops.par_iter().map(|(f, _, ev)| {
        let h = flop_hands(ranges, *f);
        let (cards, eq, w) = &h[0];
        let (mut m, mut mv, mut s) = (vec![0.0; N], vec![0.0; N], vec![[0.0; K + 1]; N]);
        for (i, &(a, b)) in cards.iter().enumerate() {
            let (x, e, v) = (w[i] as f64, eq[i] as f64, ev[index[&(a.min(b), a.max(b))]] as f64);
            if x <= 0.0 { continue; }
            let c = class_of(a, b);
            if !v.is_nan() { m[c] += x; mv[c] += x * v; }
            let mut p = x;
            for k in 0..=K { s[c][k] += p; p *= e; }
        }
        (m, mv, s)
    }).collect();
    let weights: Vec<f64> = flops.iter().map(|x| x.1).collect();
    let exact_v: Vec<f64> = (0..N).map(|c| {
        let m: f64 = per.iter().zip(&weights).map(|(p, w)| w * p.0[c]).sum();
        if m > 0.0 { per.iter().zip(&weights).map(|(p, w)| w * p.1[c]).sum::<f64>() / m } else { f64::NAN }
    }).collect();
    let stats: Vec<&Side> = per.iter().map(|p| &p.2).collect();
    let exact = exact_eq(&stats, &weights);
    let at: HashMap<[u8; 3], usize> = flops.iter().enumerate().map(|(i, x)| (canonical(x.0), i)).collect();
    let pot = 6.0;
    let report = |name: &str, samples: Vec<Vec<[u8; 3]>>| {
        let (mut e0, mut e1, mut r0, mut r1) = (0.0, 0.0, 0.0, 0.0);
        let (mut w0, mut w1) = ((0.0f64, 0usize), (0.0f64, 0usize));
        for s in &samples {
            let idx: Vec<usize> = s.iter().map(|f| at[f]).collect();
            let mass: Vec<&[f64]> = idx.iter().map(|&i| per[i].0.as_slice()).collect();
            let mv: Vec<&[f64]> = idx.iter().map(|&i| per[i].1.as_slice()).collect();
            let st: Vec<&Side> = idx.iter().map(|&i| &per[i].2).collect();
            let (fixed, plain, _) = correct(&mass, &mv, &st, &exact, pot);
            let cls: Vec<usize> = (0..N).filter(|&c| !exact_v[c].is_nan() && mass.iter().any(|m| m[c] > 0.0)).collect();
            let n = cls.len() as f64;
            for &c in &cls {
                let (a, b) = (plain[c] - exact_v[c], fixed[c] - exact_v[c]);
                e0 += a.abs() / n; e1 += b.abs() / n; r0 += a * a / n; r1 += b * b / n;
                if a.abs() > w0.0.abs() { w0 = (a, c); }
                if b.abs() > w1.0.abs() { w1 = (b, c); }
            }
        }
        let k = samples.len() as f64;
        println!("{name:28} {:>7.3} {:>7.3} {:>6} {:+.3}   {:>7.3} {:>7.3} {:>6} {:+.3}", e0 / k, (r0 / k).sqrt(), label(w0.1), w0.0,
                 e1 / k, (r1 / k).sqrt(), label(w1.1), w1.0);
    };
    println!("BB's value at its first decision, error against all {nf} flops, bb (pot {pot}bb)");
    println!("{:28} {:>31}   {:>31}", "", "sample average", "corrected");
    println!("{:28} {:>7} {:>7} {:>15}   {:>7} {:>7} {:>15}", "flops used", "mean", "rms", "worst", "mean", "rms", "worst");
    report("fixed sample (rounds 0-10)", vec![sample_flops(50)]);
    report("one shifted sample, typical", (1..=6).map(|k| sample_flops_at(50, shift(k))).collect());
    report("20 more shifted samples", (7..=26).map(|k| sample_flops_at(50, shift(k))).collect());
    report("6 shifted samples together", vec![(1..=6).flat_map(|k| sample_flops_at(50, shift(k))).collect()]);
}
