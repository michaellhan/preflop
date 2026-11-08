//! Heads-up 100bb preflop solve. Each round solves the postflop game of every preflop pot on a sample of flops,
//! turns that into per-hand values, solves the preflop tree against them, and moves the strategy part of the way.
//! Every finished flop is written to disk, so a stopped run resumes where it left off.
mod cards;
mod preflop;
use cards::*;
use postflop_solver::*;
use preflop::*;
use std::{collections::HashMap, fs, io::Write, process::Command, time::{Duration, Instant}};

const CHIPS: f32 = 20.0; // chips per bb
const FLOOR: f32 = 0.001; // every hand stays in every pot at this weight so it gets a value for deviating

struct Opts { dir: String, rounds: usize, flops: usize, early_flops: usize, early_rounds: usize, tree: String, target: f32, early_target: f32, alpha: f64, late_alpha: f64, iters: usize, start: String, response: f64 }

fn arg(a: &HashMap<String, String>, k: &str, d: &str) -> String { a.get(k).cloned().unwrap_or(d.to_string()) }

fn parse() -> Opts {
    let raw: Vec<String> = std::env::args().skip(1).collect();
    let a: HashMap<String, String> = raw.chunks(2).map(|c| (c[0].trim_start_matches("--").to_string(), c[1].clone())).collect();
    Opts {
        dir: arg(&a, "dir", "runs/hu"), rounds: arg(&a, "rounds", "8").parse().unwrap(),
        flops: arg(&a, "flops", "50").parse().unwrap(), early_flops: arg(&a, "early-flops", "20").parse().unwrap(),
        early_rounds: arg(&a, "early-rounds", "5").parse().unwrap(), tree: arg(&a, "tree", "B"),
        target: arg(&a, "target", "0.5").parse().unwrap(), early_target: arg(&a, "early-target", "1.0").parse().unwrap(),
        alpha: arg(&a, "alpha", "0.4").parse().unwrap(), late_alpha: arg(&a, "late-alpha", "0.2").parse().unwrap(),
        iters: arg(&a, "iters", "4000").parse().unwrap(), start: arg(&a, "start", "start.txt"), response: arg(&a, "response", "1.0").parse().unwrap(),
    }
}

fn log(dir: &str, s: &str) {
    println!("{s}");
    let mut f = fs::OpenOptions::new().create(true).append(true).open(format!("{dir}/log.txt")).unwrap();
    writeln!(f, "{s}").unwrap();
}

/// Waits while the clock is outside SOLVER_WINDOW ("23-8" = 23:00 to 08:00). Unset means always run.
fn wait_for_window() {
    let Ok(w) = std::env::var("SOLVER_WINDOW") else { return };
    let (a, b) = w.split_once('-').unwrap();
    let (a, b): (u32, u32) = (a.parse().unwrap(), b.parse().unwrap());
    loop {
        let out = Command::new("date").arg("+%H").output().unwrap();
        let h: u32 = String::from_utf8_lossy(&out.stdout).trim().parse().unwrap();
        if if a <= b { h >= a && h < b } else { h >= a || h < b } { return; }
        std::thread::sleep(Duration::from_secs(120));
    }
}

fn load_strategy(path: &str, t: &[Node]) -> Strategy {
    let idx: HashMap<String, usize> = (0..N).map(|c| (label(c), c)).collect();
    let mut s: Strategy = t.iter().map(|n| vec![vec![0.0; N]; n.actions.len()]).collect();
    for l in fs::read_to_string(path).unwrap().lines() {
        let p: Vec<&str> = l.split(' ').collect();
        let n = t.iter().position(|x| x.name == p[0]).unwrap();
        let a = t[n].actions.iter().position(|x| x.0 == p[1]).unwrap();
        s[n][a][idx[p[2]]] = p[3].parse().unwrap();
    }
    // whatever a line left unset goes to the last action
    for n in 0..t.len() { for h in 0..N {
        let sum: f64 = s[n].iter().map(|x| x[h]).sum();
        let last = s[n].len() - 1;
        if sum < 1.0 - 1e-9 { s[n][last][h] += 1.0 - sum; }
        else if sum > 1.0 { for a in 0..s[n].len() { s[n][a][h] /= sum; } }
    } }
    s
}

fn save_strategy(path: &str, t: &[Node], s: &Strategy) {
    let mut o = String::new();
    for (n, node) in t.iter().enumerate() { for (a, act) in node.actions.iter().enumerate() { for h in 0..N {
        if s[n][a][h] > 1e-6 { o += &format!("{} {} {} {:.6}\n", node.name, act.0, label(h), s[n][a][h]); }
    } } }
    fs::write(path, o).unwrap();
}

fn tree_config(shape: &str, pot: i32, stack: i32) -> TreeConfig {
    // flop bet / flop raise / turn bet / river bet. Turn and river have no raises in any shape.
    let (fb, fr, tb, rb) = match shape {
        "C" => ("50%", "", "66%", "75%"),
        "A" => ("33%, 75%", "3x", "66%", "75%"),
        _ => ("50%", "3x", "66%", "75%"),
    };
    let f = BetSizeOptions::try_from((fb, fr)).unwrap();
    let t = BetSizeOptions::try_from((tb, "")).unwrap();
    let r = BetSizeOptions::try_from((rb, "")).unwrap();
    TreeConfig {
        initial_state: BoardState::Flop, starting_pot: pot, effective_stack: stack, rake_rate: 0.05, rake_cap: RAKE_CAP * CHIPS as f64,
        flop_bet_sizes: [f.clone(), f], turn_bet_sizes: [t.clone(), t], river_bet_sizes: [r.clone(), r],
        turn_donk_sizes: None, river_donk_sizes: None, add_allin_threshold: 1.5, force_allin_threshold: 0.15, merging_threshold: 0.1,
    }
}

fn range_of(w: &[f64]) -> Range {
    let mut r = Range::new();
    for (a, b) in combos() { r.set_weight_by_cards(a, b, (w[class_of(a, b)] as f32).max(FLOOR)); }
    r
}

/// Solves one pot on one flop. Returns, per player and class, (mass, mass * value) with value in bb net of preflop money.
fn solve_flop(flop: [u8; 3], pot_id: usize, ranges: &[Vec<f64>; 2], o: &Opts, target_pct: f32) -> (Vec<f64>, f32, f64, f64) {
    let invested = POT_INFO[pot_id].1 as f32;
    let pot = (2.0 * invested * CHIPS) as i32;
    let stack = ((STACK as f32 - invested) * CHIPS) as i32;
    // solver convention: player 0 is out of position (BB), player 1 in position (SB)
    let cfg = CardConfig { range: [range_of(&ranges[BB]), range_of(&ranges[SB])], flop, turn: NOT_DEALT, river: NOT_DEALT };
    let mut g = PostFlopGame::with_config(cfg, ActionTree::new(tree_config(&o.tree, pot, stack)).unwrap()).unwrap();
    let (_, mem) = g.memory_usage();
    let t0 = Instant::now();
    g.allocate_memory(true);
    let e = postflop_solver::solve(&mut g, 500, pot as f32 * target_pct / 100.0, false);
    g.cache_normalized_weights();
    let mut row = vec![0.0f64; 4 * N];
    for (sp, player) in [(1usize, SB), (0, BB)] {
        let ev = g.expected_values(sp);
        let w = g.normalized_weights(sp);
        let hands = g.private_cards(sp).to_vec();
        for (i, (a, b)) in hands.iter().enumerate() {
            let c = class_of(*a, *b);
            let mass = w[i] as f64;
            if mass > 0.0 {
                row[player * 2 * N + c] += mass;
                row[player * 2 * N + N + c] += mass * ((ev[i] / CHIPS - invested) as f64);
            }
        }
    }
    (row, 100.0 * e / pot as f32, t0.elapsed().as_secs_f64(), mem as f64 / 1e9)
}

fn summary(t: &[Node], s: &Strategy) -> String {
    let cc = class_combos();
    let mut o = String::new();
    for (n, node) in t.iter().enumerate() {
        o += &format!("{}:", node.name);
        for (a, act) in node.actions.iter().enumerate() {
            let p: f64 = (0..N).map(|h| s[n][a][h] * cc[h].len() as f64).sum::<f64>() / 13.26;
            o += &format!(" {} {:.1}", act.0, p);
        }
        o += " | ";
    }
    o
}

fn main() {
    let o = parse();
    fs::create_dir_all(&o.dir).unwrap();
    let t = tree();
    let eq = equity_table(&format!("{}/equity.txt", o.dir), 40000);
    let compat = compat_table();
    log(&o.dir, &format!("check AA v KK {:.3}, AKs v QQ {:.3}, AKo v 22 {:.3}", eq[12 * 13 + 12][11 * 13 + 11], eq[12 * 13 + 11][10 * 13 + 10], eq[11 * 13 + 12][0]));
    let mut s = {
        let mut r = 0;
        while fs::metadata(format!("{}/strategy_{}.txt", o.dir, r + 1)).is_ok() { r += 1; }
        if r == 0 { load_strategy(&o.start, &t) } else { load_strategy(&format!("{}/strategy_{}.txt", o.dir, r), &t) }
    };
    let first = (0..).find(|r| fs::metadata(format!("{}/strategy_{}.txt", o.dir, r + 1)).is_err()).unwrap();
    if first == 0 { save_strategy(&format!("{}/strategy_0.txt", o.dir), &t, &s); }
    for round in first..o.rounds {
        let early = round < o.early_rounds;
        let nf = if early { o.early_flops } else { o.flops };
        let target = if early { o.early_target } else { o.target };
        let flops = sample_flops(nf);
        let ranges = pot_ranges(&s);
        let rdir = format!("{}/round_{}", o.dir, round);
        fs::create_dir_all(&rdir).unwrap();
        let mut values: Values = Vec::new();
        for p in 0..POTS {
            let mut total = vec![0.0f64; 4 * N];
            let (mut worst, mut secs, mut peak) = (0.0f32, 0.0f64, 0.0f64);
            for (i, f) in flops.iter().enumerate() {
                let path = format!("{rdir}/{}_{i}.txt", POT_INFO[p].0);
                let row: Vec<f64> = match fs::read_to_string(&path) {
                    Ok(x) => {
                        let mut l = x.lines();
                        let h: Vec<f32> = l.next().unwrap().split(' ').map(|v| v.parse().unwrap()).collect();
                        worst = worst.max(h[0]);
                        l.next().unwrap().split(' ').map(|v| v.parse().unwrap()).collect()
                    }
                    Err(_) => {
                        wait_for_window();
                        let (row, e, sec, mem) = solve_flop(*f, p, &ranges[p], &o, target);
                        worst = worst.max(e); secs += sec; peak = peak.max(mem);
                        let txt: Vec<String> = row.iter().map(|v| format!("{v:.9e}")).collect();
                        fs::write(format!("{path}.tmp"), format!("{e} {sec}\n{}\n", txt.join(" "))).unwrap();
                        fs::rename(format!("{path}.tmp"), &path).unwrap();
                        row
                    }
                };
                for k in 0..4 * N { total[k] += row[k]; }
            }
            let val = |pl: usize| -> Vec<f64> { (0..N).map(|c| {
                let m = total[pl * 2 * N + c];
                if m > 0.0 { total[pl * 2 * N + N + c] / m } else { 0.0 }
            }).collect() };
            values.push([val(SB), val(BB)]);
            log(&o.dir, &format!("round {round} pot {}: {nf} flops, {secs:.0}s, peak {peak:.2}GB, worst expl {worst:.3}% pot", POT_INFO[p].0));
        }
        let refs: Vec<PotRef> = (0..POTS).map(|p| {
            let side = |pl: usize| -> Vec<f64> {
                let opp: Vec<f64> = ranges[p][1 - pl].iter().map(|w| w.max(FLOOR as f64)).collect();
                (0..N).map(|h| {
                    let (mut m, mut e) = (0.0, 0.0);
                    for o in 0..N { let w = compat[h][o] * opp[o]; m += w; e += w * eq[h][o]; }
                    e / m
                }).collect()
            };
            PotRef { size: 2.0 * POT_INFO[p].1, ref_eq: [side(SB), side(BB)] }
        }).collect();
        let ctx = Ctx { tree: &t, eq: &eq, compat: &compat, values: &values, pots: &refs, response: o.response };
        let inner = preflop::solve(&ctx, o.iters, &s);
        let alpha = if early { o.alpha } else { o.late_alpha };
        let mut next = s.clone();
        let mut change = 0.0f64;
        let cc = class_combos();
        for n in 0..t.len() { for a in 0..t[n].actions.len() { for h in 0..N {
            next[n][a][h] = (1.0 - alpha) * s[n][a][h] + alpha * inner[n][a][h];
            if n < 3 || n == 5 || n == 6 { change = change.max((next[n][a][h] - s[n][a][h]).abs() * (cc[h].len() as f64 / 6.0).min(1.0)); }
        } } }
        let one = vec![1.0; N];
        let total_of = |v: Vec<f64>| -> f64 { (0..N).map(|h| v[h] * cc[h].len() as f64).sum::<f64>() / 1326.0 };
        let norm = 1225.0;
        let sb_val = total_of(evaluate(&ctx, &next, 0, SB, &one, false)) / norm;
        let sb_br = total_of(evaluate(&ctx, &next, 0, SB, &one, true)) / norm;
        let bb_br = total_of(evaluate(&ctx, &next, 0, BB, &one, true)) / norm;
        log(&o.dir, &format!("round {round} done: SB EV {sb_val:.3}bb, preflop gap {:.3}bb, largest move {:.1} points", sb_br + bb_br, change * 100.0));
        log(&o.dir, &format!("  {}", summary(&t, &next)));
        save_strategy(&format!("{}/values_{}.tmp", o.dir, round), &t, &next);
        fs::rename(format!("{}/values_{}.tmp", o.dir, round), format!("{}/strategy_{}.txt", o.dir, round + 1)).unwrap();
        s = next;
    }
    log(&o.dir, "finished");
}
