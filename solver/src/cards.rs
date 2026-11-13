//! Hand classes, a seven-card evaluator and the all-in equity table.
//! Cards use postflop-solver's encoding: 4 * rank + suit, rank 0 = deuce.
use rayon::prelude::*;
use std::fs;

pub const N: usize = 169;

/// Class index for two cards: pairs on the diagonal, suited above it, offsuit below it.
pub fn class_of(a: u8, b: u8) -> usize {
    let (ra, rb) = ((a / 4) as usize, (b / 4) as usize);
    let (hi, lo) = if ra >= rb { (ra, rb) } else { (rb, ra) };
    if a % 4 == b % 4 { hi * 13 + lo } else { lo * 13 + hi }
}

pub fn label(c: usize) -> String {
    const R: &[u8] = b"23456789TJQKA";
    let (x, y) = (c / 13, c % 13);
    if x == y { format!("{0}{0}", R[x] as char) }
    else if x > y { format!("{}{}s", R[x] as char, R[y] as char) }
    else { format!("{}{}o", R[y] as char, R[x] as char) }
}

pub fn combos() -> Vec<(u8, u8)> {
    let mut v = Vec::with_capacity(1326);
    for a in 0..52u8 { for b in (a + 1)..52u8 { v.push((a, b)); } }
    v
}

pub fn class_combos() -> Vec<Vec<(u8, u8)>> {
    let mut v = vec![Vec::new(); N];
    for (a, b) in combos() { v[class_of(a, b)].push((a, b)); }
    v
}

fn straight_high(mask: u16) -> Option<u32> {
    let m = ((mask as u32) << 1) | ((mask as u32) >> 12 & 1); // bit 0 = low ace
    let s = m & (m >> 1) & (m >> 2) & (m >> 3) & (m >> 4);
    if s == 0 { None } else { Some(31 - s.leading_zeros()) }
}

fn top_bits(mut m: u16, n: u32) -> u32 {
    let mut out = 0u32;
    for _ in 0..n {
        let b = 15 - m.leading_zeros();
        out = out << 4 | b;
        m &= !(1 << b);
    }
    out
}

/// Higher is better. Only ever compared with another result of this function.
pub fn eval7(c: &[u8; 7]) -> u32 {
    let mut count = [0u8; 13];
    let mut suit = [0u16; 4];
    let mut all = 0u16;
    for &x in c {
        let r = (x / 4) as usize;
        count[r] += 1;
        suit[(x % 4) as usize] |= 1 << r;
        all |= 1 << r;
    }
    let cat = |k: u32, v: u32| k << 24 | v;
    for s in suit {
        if s.count_ones() >= 5 {
            if let Some(h) = straight_high(s) { return cat(8, h); }
        }
    }
    let (mut quad, mut trips, mut pairs) = (0u16, 0u16, 0u16);
    for r in 0..13 {
        match count[r] { 4 => quad |= 1 << r, 3 => trips |= 1 << r, 2 => pairs |= 1 << r, _ => {} }
    }
    if quad != 0 {
        let q = 15 - quad.leading_zeros();
        return cat(7, q << 4 | top_bits(all & !(1 << q), 1));
    }
    if trips != 0 {
        let t = 15 - trips.leading_zeros();
        let rest = (trips & !(1 << t)) | pairs;
        if rest != 0 { return cat(6, t << 4 | (15 - rest.leading_zeros())); }
    }
    for s in suit {
        if s.count_ones() >= 5 { return cat(5, top_bits(s, 5)); }
    }
    if let Some(h) = straight_high(all) { return cat(4, h); }
    if trips != 0 {
        let t = 15 - trips.leading_zeros();
        return cat(3, t << 8 | top_bits(all & !(1 << t), 2));
    }
    if pairs.count_ones() >= 2 {
        let p = top_bits(pairs, 2);
        let (a, b) = (p >> 4, p & 15);
        return cat(2, p << 4 | top_bits(all & !(1 << a) & !(1 << b), 1));
    }
    if pairs != 0 {
        let p = 15 - pairs.leading_zeros();
        return cat(1, p << 12 | top_bits(all & !(1 << p), 3));
    }
    cat(0, top_bits(all, 5))
}

struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }
    fn below(&mut self, n: u64) -> u64 { (self.next() >> 32) * n >> 32 }
}

/// equity[h][o]: chance that a hand of class h wins (ties count half) against class o.
pub fn equity_table(path: &str, sims: u32) -> Vec<Vec<f64>> {
    if let Ok(s) = fs::read_to_string(path) {
        let t: Vec<Vec<f64>> = s.lines().map(|l| l.split(' ').map(|x| x.parse().unwrap()).collect()).collect();
        if t.len() == N { return t; }
    }
    let cc = class_combos();
    let rows: Vec<Vec<f64>> = (0..N).into_par_iter().map(|h| {
        let mut row = vec![0.0; N];
        for o in h..N {
            let mut rng = Rng(0x9E3779B97F4A7C15 ^ ((h as u64) << 32 | o as u64) * 2654435761 + 1);
            let (mut win, mut n) = (0.0f64, 0u32);
            while n < sims {
                let a = cc[h][rng.below(cc[h].len() as u64) as usize];
                let b = cc[o][rng.below(cc[o].len() as u64) as usize];
                if a.0 == b.0 || a.0 == b.1 || a.1 == b.0 || a.1 == b.1 { continue; }
                let mut used = 1u64 << a.0 | 1u64 << a.1 | 1u64 << b.0 | 1u64 << b.1;
                let mut board = [0u8; 5];
                let mut k = 0;
                while k < 5 {
                    let c = rng.below(52) as u8;
                    if used >> c & 1 == 0 { used |= 1 << c; board[k] = c; k += 1; }
                }
                let hv = eval7(&[a.0, a.1, board[0], board[1], board[2], board[3], board[4]]);
                let ov = eval7(&[b.0, b.1, board[0], board[1], board[2], board[3], board[4]]);
                win += if hv > ov { 1.0 } else if hv == ov { 0.5 } else { 0.0 };
                n += 1;
            }
            row[o] = win / n as f64;
        }
        row
    }).collect();
    let mut t = rows;
    for h in 0..N { for o in 0..h { t[h][o] = 1.0 - t[o][h]; } }
    let txt: Vec<String> = t.iter().map(|r| r.iter().map(|x| format!("{x:.5}")).collect::<Vec<_>>().join(" ")).collect();
    fs::write(path, txt.join("\n") + "\n").unwrap();
    t
}

/// compat[h][o]: how many combos of class o are still possible given one combo of class h.
pub fn compat_table() -> Vec<Vec<f64>> {
    let cc = class_combos();
    (0..N).map(|h| (0..N).map(|o| {
        let mut n = 0;
        for a in &cc[h] { for b in &cc[o] {
            if a.0 != b.0 && a.0 != b.1 && a.1 != b.0 && a.1 != b.1 { n += 1; }
        } }
        n as f64 / cc[h].len() as f64
    }).collect()).collect()
}

/// Equal-weight sample of flops, spread across textures. Each of the 22,100 flops is folded onto its
/// suit-canonical form, the forms are sorted by rank and texture, and every nth flop by weight is taken.
pub fn sample_flops(n: usize) -> Vec<[u8; 3]> { sample_flops_at(n, 0.5) }

/// Every suit-canonical flop with how many of the 22,100 it stands for, sorted by rank and texture.
pub fn canonical_flops() -> Vec<([u8; 3], u32)> {
    let mut m = std::collections::BTreeMap::<[u8; 3], u32>::new();
    for a in 0..52u8 { for b in (a + 1)..52u8 { for c in (b + 1)..52u8 { *m.entry(canonical([a, b, c])).or_insert(0) += 1; } } }
    let mut v: Vec<([u8; 3], u32)> = m.into_iter().collect();
    let key = |f: &[u8; 3]| {
        let (a, b, c) = (f[2] / 4, f[1] / 4, f[0] / 4);
        let suits = [f[0] % 4, f[1] % 4, f[2] % 4];
        let distinct = 1 + (suits[1] != suits[0]) as u8 + (suits[2] != suits[0] && suits[2] != suits[1]) as u8;
        (a, b, c, distinct)
    };
    v.sort_by_key(|x| key(&x.0));
    v
}

/// A flop's suit-canonical form: the smallest sorted card triple over the 24 ways of renaming suits.
pub fn canonical(flop: [u8; 3]) -> [u8; 3] {
    const PERMS: [[u8; 4]; 24] = [
        [0,1,2,3],[0,1,3,2],[0,2,1,3],[0,2,3,1],[0,3,1,2],[0,3,2,1],[1,0,2,3],[1,0,3,2],[1,2,0,3],[1,2,3,0],[1,3,0,2],[1,3,2,0],
        [2,0,1,3],[2,0,3,1],[2,1,0,3],[2,1,3,0],[2,3,0,1],[2,3,1,0],[3,0,1,2],[3,0,2,1],[3,1,0,2],[3,1,2,0],[3,2,0,1],[3,2,1,0]];
    let mut best = [255u8; 3];
    for p in PERMS {
        let f = |x: u8| x / 4 * 4 + p[(x % 4) as usize];
        let mut t = [f(flop[0]), f(flop[1]), f(flop[2])];
        t.sort_unstable();
        if t < best { best = t; }
    }
    best
}

/// Same as sample_flops, but takes the flop at position (k + u) / n of each weight step instead of the middle, so
/// different u give different flops with the same stratification. Averaging rounds with spread-out u averages over
/// many more flops than any single round solves.
pub fn sample_flops_at(n: usize, u: f64) -> Vec<[u8; 3]> {
    let v = canonical_flops();
    let total: f64 = v.iter().map(|x| x.1 as f64).sum();
    let mut out = Vec::with_capacity(n);
    let (mut acc, mut k) = (0.0, 0usize);
    for (f, w) in v {
        acc += w as f64;
        while k < n && (k as f64 + u) / n as f64 * total <= acc { out.push(f); k += 1; }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Every 7-card hand, checked against the published count for each hand category.
    #[test]
    fn category_counts() {
        let want = [23294460u64, 58627800, 31433400, 6461620, 6180020, 4047644, 3473184, 224848, 41584];
        let counts: Vec<[u64; 9]> = (0..52u8).into_par_iter().map(|a| {
            let mut n = [0u64; 9];
            for b in a + 1..52 { for c in b + 1..52 { for d in c + 1..52 { for e in d + 1..52 { for f in e + 1..52 { for g in f + 1..52 {
                n[(eval7(&[a, b, c, d, e, f, g]) >> 24) as usize] += 1;
            } } } } } }
            n
        }).collect();
        for k in 0..9 { assert_eq!(counts.iter().map(|x| x[k]).sum::<u64>(), want[k], "category {k}"); }
    }

    #[test]
    fn ordering_within_categories() {
        let c = |s: &str| -> u8 { let b = s.as_bytes(); (b"23456789TJQKA".iter().position(|x| *x == b[0]).unwrap() * 4 + b"cdhs".iter().position(|x| *x == b[1]).unwrap()) as u8 };
        let h = |s: [&str; 7]| eval7(&[c(s[0]), c(s[1]), c(s[2]), c(s[3]), c(s[4]), c(s[5]), c(s[6])]);
        let wheel = h(["Ac", "2d", "3h", "4s", "5c", "9d", "Kh"]);
        let six = h(["2c", "3d", "4h", "5s", "6c", "9d", "Kh"]);
        assert!(six > wheel);
        let kk_a = h(["Kc", "Kd", "Ah", "7s", "5c", "3d", "2h"]);
        let kk_q = h(["Kc", "Kd", "Qh", "7s", "5c", "3d", "2h"]);
        assert!(kk_a > kk_q);
        let aa77 = h(["Ac", "Ad", "7h", "7s", "5c", "3d", "2h"]);
        let kkqq = h(["Kc", "Kd", "Qh", "Qs", "5c", "3d", "Ah"]);
        assert!(aa77 > kkqq);
        let fh1 = h(["Ac", "Ad", "Ah", "2s", "2c", "3d", "4h"]);
        let fh2 = h(["Kc", "Kd", "Kh", "As", "Ac", "3d", "4h"]);
        assert!(fh1 > fh2);
    }

    #[test]
    fn flop_sample_is_valid() {
        let f = sample_flops(50);
        assert_eq!(f.len(), 50);
        for x in f { assert!(x[0] < x[1] && x[1] < x[2]); }
    }
}

/// Offset for the k-th shifted round: golden-ratio steps from the middle, which spread out evenly over [0, 1).
pub fn shift(k: usize) -> f64 { (0.5 + k as f64 * 0.618_033_988_749_895).fract() }

#[cfg(test)]
mod sample_stats {
    #[test]
    fn rank_counts() {
        for n in [20usize, 50] {
            let mut c = [0u32; 13];
            for f in super::sample_flops(n) { for x in f { c[(x / 4) as usize] += 1; } }
            println!("{n} flops, cards of each rank 2..A: {:?} (expected {:.1} each)", c, 3.0 * n as f64 / 13.0);
        }
        let mut all = [0u32; 13];
        let mut seen = std::collections::HashSet::new();
        for r in 1..=6 {
            let fl = super::sample_flops_at(50, super::shift(r));
            let mut c = [0u32; 13];
            for f in &fl { seen.insert(*f); for x in f { c[(x / 4) as usize] += 1; all[(x / 4) as usize] += 1; } }
            println!("shift {r} (u {:.3}): {:?}", super::shift(r), c);
        }
        println!("6 shifted rounds together: {:?} (expected {:.1} each), {} distinct flops", all, 900.0 / 13.0, seen.len());
    }
}
