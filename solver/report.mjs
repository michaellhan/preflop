// Checks a heads-up run against the pass bar and writes the result in the site's chart format.
// Usage: node report.mjs [runDir] [--avg N]   (default runs/hu, N 1). Uses the average of the last N strategy_N.txt
// files, each weighted by how often a hand reaches the spot in that round, and compares it with the average one round
// earlier. Averaging smooths the round-to-round flips of near-indifferent hands; use only rounds from the same settings.
import fs from 'node:fs'; import vm from 'node:vm';

const argv = process.argv.slice(2), ai = argv.indexOf('--avg');
const avgN = ai >= 0 ? +argv[ai + 1] : 1;
const run = argv.find((x, i) => !x.startsWith('--') && i !== ai + 1) || 'runs/hu';
const here = new URL('.', import.meta.url).pathname;
const ctx = vm.createContext({ console });
for (const f of ['hands.js', 'ranges.js']) vm.runInContext(fs.readFileSync(here + '../js/' + f, 'utf8'), ctx, { filename: f });
const { Hands, RANGES: { HU } } = ctx;
const ALL = Hands.ALL_HANDS, n = h => Hands.combos(h);

const files = fs.readdirSync(here + run).filter(f => /^strategy_\d+\.txt$/.test(f)).map(f => +f.match(/\d+/)[0]).sort((a, b) => a - b);
const ACTIONS = {
  sb_open: ['raise', 'limp', 'fold'], bb_vs_open: ['raise', 'call', 'fold'], sb_vs_3bet: ['raise', 'call', 'fold'],
  bb_vs_4bet: ['raise', 'call', 'fold'], sb_vs_jam: ['call', 'fold'], bb_vs_limp: ['raise', 'check'],
  sb_vs_iso: ['raise', 'call', 'fold'], bb_vs_limp3bet: ['raise', 'call', 'fold'], sb_vs_limpjam: ['call', 'fold'],
};
function load(i) {
  const s = {};
  for (const node in ACTIONS) { s[node] = {}; for (const a of ACTIONS[node]) { s[node][a] = {}; for (const h of ALL) s[node][a][h] = 0; } }
  for (const l of fs.readFileSync(`${here}${run}/strategy_${i}.txt`, 'utf8').trim().split('\n')) {
    const [node, a, h, w] = l.split(' '); s[node][a][h] = +w;
  }
  return s;
}
// reach of each player's hands at each node
const one = Object.fromEntries(ALL.map(h => [h, 1]));
const mul = (...xs) => Object.fromEntries(ALL.map(h => [h, xs.reduce((p, x) => p * x[h], 1)]));
const reachOf = S => ({
  sb_open: one, bb_vs_open: one, bb_vs_limp: one,
  sb_vs_3bet: S.sb_open.raise, sb_vs_iso: S.sb_open.limp,
  bb_vs_4bet: S.bb_vs_open.raise, bb_vs_limp3bet: S.bb_vs_limp.raise,
  sb_vs_jam: mul(S.sb_open.raise, S.sb_vs_3bet.raise), sb_vs_limpjam: mul(S.sb_open.limp, S.sb_vs_iso.raise),
});
// average of rounds idx, weighted per hand by reach in each round (plain mean where no round reaches it)
function average(idx) {
  const ss = idx.map(load), rs = ss.map(reachOf), out = {};
  for (const node in ACTIONS) {
    out[node] = {}; for (const a of ACTIONS[node]) out[node][a] = {};
    for (const h of ALL) {
      const w = rs.map(r => r[node][h]), tw = w.reduce((x, y) => x + y, 0);
      for (const a of ACTIONS[node]) out[node][a][h] = tw > 0 ? ss.reduce((t, s, i) => t + w[i] * s[node][a][h], 0) / tw : ss.reduce((t, s) => t + s[node][a][h], 0) / ss.length;
    }
  }
  return out;
}
if (files.length < avgN + 1) { console.error(`need ${avgN + 1} strategy files for --avg ${avgN}, found ${files.length}`); process.exit(1); }
const S = average(files.slice(-avgN)), P = average(files.slice(-avgN - 1, -1));
const reach = reachOf(S);
const pct = x => (100 * x).toFixed(1);

const span = k => avgN === 1 ? `strategy_${files.at(k)}` : `average of strategy_${files.at(k - avgN + 1)}-${files.at(k)}`;
console.log(`Run ${run}: comparing ${span(-1)} with ${span(-2)}\n`);
console.log('Node             share of hands reaching it, by action          moved since last round');
let worstMove = 0;
for (const node in ACTIONS) {
  const r = reach[node]; let tot = 0; const by = {}; let moved = 0;
  for (const h of ALL) {
    const w = n(h) * r[h]; tot += w;
    for (const a of ACTIONS[node]) { by[a] = (by[a] || 0) + w * S[node][a][h]; moved += w * Math.abs(S[node][a][h] - P[node][a][h]) / 2; }
  }
  const m = tot ? moved / tot : 0; worstMove = Math.max(worstMove, m);
  console.log(node.padEnd(16), ACTIONS[node].map(a => `${a} ${pct(by[a] / tot)}`).join('  ').padEnd(46), `${pct(m)} points (reach-weighted)`);
}

// published comparison: PokerCoaching heads-up 100bb, which uses 3bb opens, 12bb 3-bets and 27bb 4-bets
const pcPath = here + 'runs/pc_hu_100bb.json';
if (fs.existsSync(pcPath)) {
  const pc = JSON.parse(fs.readFileSync(pcPath, 'utf8')).data;
  const freq = (id, h) => { const f = pc[id][h].frequencies; let r = 0; for (const k in f) if (k.startsWith('raise')) r += f[k]; return { raise: r, call: f.call || 0 }; };
  console.log('\nAgainst PokerCoaching heads-up 100bb (its sizes: 3bb open, 12bb 3-bet, 27bb 4-bet; ours 2.5/10/22):');
  const tot = (fn, r = one) => { let t = 0, w = 0; for (const h of ALL) { t += n(h) * r[h] * fn(h); w += n(h) * r[h]; } return 100 * t / w; };
  const pcOpen = h => freq('rfi_sb_100bb_hu_cash', h);
  console.log(`  SB plays  : ours ${tot(h => 1 - S.sb_open.fold[h]).toFixed(1)}% (raise ${tot(h => S.sb_open.raise[h]).toFixed(1)}, limp ${tot(h => S.sb_open.limp[h]).toFixed(1)})   PC ${tot(h => pcOpen(h).raise + pcOpen(h).call).toFixed(1)}% (raise ${tot(h => pcOpen(h).raise).toFixed(1)}, limp ${tot(h => pcOpen(h).call).toFixed(1)})`);
  const pcB = h => freq('open_raise_bb_100bb_hu_cash', h);
  console.log(`  BB vs open: ours 3-bet ${tot(h => S.bb_vs_open.raise[h]).toFixed(1)}, call ${tot(h => S.bb_vs_open.call[h]).toFixed(1)}   PC 3-bet ${tot(h => pcB(h).raise).toFixed(1)}, call ${tot(h => pcB(h).call).toFixed(1)}`);
  const pcS = h => freq('facing_rfi_sb_vs_bb_100bb_hu_cash', h), pr = Object.fromEntries(ALL.map(h => [h, pcOpen(h).raise]));
  console.log(`  SB vs 3bet: ours 4-bet ${tot(h => S.sb_vs_3bet.raise[h], reach.sb_vs_3bet).toFixed(1)}, call ${tot(h => S.sb_vs_3bet.call[h], reach.sb_vs_3bet).toFixed(1)} of hands raised   PC 4-bet ${tot(h => pcS(h).raise, pr).toFixed(1)}, call ${tot(h => pcS(h).call, pr).toFixed(1)}`);
  // which hands the SB plays: the hands each side folds most that the other plays
  const diff = ALL.map(h => [h, (1 - S.sb_open.fold[h]) - (pcOpen(h).raise + pcOpen(h).call)]).sort((a, b) => a[1] - b[1]);
  console.log('  SB hands PC plays more:', diff.slice(0, 10).filter(d => d[1] < -0.2).map(d => `${d[0]} ${pct(d[1])}`).join(', ') || 'none');
  console.log('  SB hands we play more :', diff.slice(-10).reverse().filter(d => d[1] > 0.2).map(d => `${d[0]} +${pct(d[1])}`).join(', ') || 'none');
}

// blunder checks: a hand folded while clearly worse hands of the same kind continue
console.log('\nOrder checks (a hand folded at least 60% while a weaker hand of the same kind continues at least 60%):');
const rank = 'AKQJT98765432';
const kinds = { pair: h => h.length === 2, suited: h => h.endsWith('s'), offsuit: h => h.endsWith('o') };
let flags = 0;
for (const node of ['sb_open', 'bb_vs_open', 'sb_vs_3bet', 'bb_vs_limp', 'sb_vs_iso']) {
  const foldOf = h => node === 'bb_vs_limp' ? S[node].check[h] : S[node].fold[h];
  for (const [k, is] of Object.entries(kinds)) {
    for (const h of ALL.filter(is)) {
      if (reach[node][h] < 0.05 || foldOf(h) < 0.6) continue;
      // same top card, lower kicker (or a lower pair)
      const worse = ALL.filter(is).filter(o => reach[node][o] >= 0.05 && (k === 'pair' ? rank.indexOf(o[0]) > rank.indexOf(h[0]) : o[0] === h[0] && rank.indexOf(o[1]) > rank.indexOf(h[1])) && foldOf(o) <= 0.4);
      if (worse.length && node !== 'bb_vs_limp') { flags++; console.log(`  ${node}: folds ${h} ${pct(foldOf(h))}% but plays ${worse.slice(0, 4).join(', ')}`); }
    }
  }
}
if (!flags) console.log('  none');

// chart export, rounded to 5% steps, only for hands that reach the spot in the rounded charts
const round5 = (ws) => { // largest remainder, sums to 1
  const raw = ws.map(w => w * 20), fl = raw.map(Math.floor); let left = 20 - fl.reduce((a, b) => a + b, 0);
  raw.map((x, i) => [x - fl[i], i]).sort((a, b) => b[0] - a[0]).slice(0, left).forEach(([, i]) => fl[i]++);
  return fl.map(x => x / 20);
};
const chart = (node, keep, gate) => {
  const out = Object.fromEntries(keep.map(a => [a, []]));
  for (const h of ALL) {
    if (gate && !(gate[h] > 0)) continue;
    const r = round5(ACTIONS[node].map(a => S[node][a][h]));
    keep.forEach(a => { const w = r[ACTIONS[node].indexOf(a)]; if (w > 0) out[a].push(w === 1 ? h : `${h}:${w}`); });
  }
  return Object.fromEntries(keep.map(a => [a, out[a].join(', ')]));
};
const open = chart('sb_open', ['raise', 'limp']);
const parsed = { raise: Hands.parseRange(open.raise), limp: Hands.parseRange(open.limp) };
const hu = {
  SB_OPEN: open,
  BB_vs_SB: chart('bb_vs_open', ['raise', 'call']),
  SB_vs_BB_3BET: chart('sb_vs_3bet', ['raise', 'call'], parsed.raise),
  BB_vs_LIMP: chart('bb_vs_limp', ['raise']),
  SB_vs_ISO: chart('sb_vs_iso', ['raise', 'call'], parsed.limp),
};
fs.writeFileSync(`${here}${run}/hu_charts.json`, JSON.stringify(hu, null, 1));
console.log(`\nWrote ${run}/hu_charts.json`);
console.log(`Largest reach-weighted move in the last round: ${pct(worstMove)} points`);
