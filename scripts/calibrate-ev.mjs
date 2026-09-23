// Sanity-checks the EV model against the GTO ranges (6-max): known cases + agreement rate.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'js');
const ctx = vm.createContext({ console });
const samples = Number(process.argv[2] || 400);
for (const f of ['hands.js', 'ranges.js', 'spots.js', 'equity.js', 'ev.js', 'explain.js']) {
  let src = fs.readFileSync(path.join(dir, f), 'utf8');
  if (f === 'ev.js') src = src.replace('let SAMPLES = 1200;', 'let SAMPLES = ' + samples + ';');
  vm.runInContext(src, ctx, { filename: f });
}
const { Hands, Spots, EV, Explain } = ctx;
const spot = (type, hero, villain) => Spots.getSpots('6max').find(s => s.type === type && s.hero === hero && (s.villain || null) === (villain || null));
const cards = h => Hands.dealCards(h);
function show(s, hand) {
  const a = EV.analyze(s, cards(hand), hand);
  const f = s.strategy[hand];
  const line = s.actions.map(x => x.key + ' ' + a.modelEvs[x.key].toFixed(2) + ' (gto ' + Math.round(f[x.key] * 100) + '%)').join(' | ');
  console.log(s.title.padEnd(20) + hand.padEnd(5) + line + '  => loss if ' + s.actions.map(x => x.key + ':' + a.loss(x.key).toFixed(2)).join(' '));
}
console.log('--- known cases (calibrated model EV in bb, absolute; loss = what the trainer charges) ---');
show(spot('rfi', 'BTN'), 'AA'); show(spot('rfi', 'BTN'), '72o'); show(spot('rfi', 'BTN'), 'K9s'); show(spot('rfi', 'UTG'), 'AA'); show(spot('rfi', 'UTG'), 'K5s'); show(spot('rfi', 'UTG'), '76s');
show(spot('vsOpen', 'BB', 'BTN'), 'AA'); show(spot('vsOpen', 'BB', 'BTN'), '72o'); show(spot('vsOpen', 'BB', 'BTN'), '65s'); show(spot('vsOpen', 'BB', 'BTN'), 'A5s'); show(spot('vsOpen', 'BB', 'BTN'), 'A9s');
show(spot('vsOpen', 'HJ', 'UTG'), '22'); show(spot('vsOpen', 'BTN', 'CO'), '22'); show(spot('vsOpen', 'BTN', 'UTG'), 'KJo'); show(spot('vsOpen', 'SB', 'CO'), 'T9s');
show(spot('vs3bet', 'UTG', 'BTN'), 'AA'); show(spot('vs3bet', 'UTG', 'BTN'), '76s'); show(spot('vs3bet', 'CO', 'BTN'), 'A5s'); show(spot('vs3bet', 'BTN', 'BB'), 'KQo'); show(spot('vs3bet', 'BTN', 'BB'), 'AKo');
show(spot('vsLimp', 'BB', 'SB'), 'AA'); show(spot('vsLimp', 'BB', 'SB'), '72o');

console.log('\n--- agreement of model argmax with pure GTO actions (6-max) ---');
let agree = 0, total = 0, gapSum = 0, gapN = 0;
const perType = {};
for (const s of Spots.getSpots('6max')) {
  for (const h of Hands.ALL_HANDS) {
    const f = s.strategy[h];
    if (s.prior && s.prior[h] === 0) continue;
    const a = EV.analyze(s, cards(h), h);
    const played = s.actions.filter(x => f[x.key] > 0);
    let best = null, bv = -1e9;
    for (const x of s.actions) if (a.modelEvs[x.key] > bv) { bv = a.modelEvs[x.key]; best = x.key; }
    if (played.length === 1) {
      total++;
      const t = perType[s.type] || (perType[s.type] = { a: 0, n: 0 });
      t.n++;
      if (best === played[0].key) { agree++; t.a++; }
    } else {
      const evs = played.map(x => a.modelEvs[x.key]);
      gapSum += Math.max(...evs) - Math.min(...evs); gapN++;
    }
  }
}
console.log('pure-strategy agreement: ' + (100 * agree / total).toFixed(1) + '% (' + agree + '/' + total + ')');
for (const k in perType) console.log('  ' + k + ': ' + (100 * perType[k].a / perType[k].n).toFixed(1) + '%');
console.log('mixed hands: mean EV gap between GTO-played actions = ' + (gapSum / gapN).toFixed(2) + ' bb (should be small)');

console.log('\n--- sample explanations ---');
for (const [t, h, v, hand] of [['vsOpen', 'BB', 'BTN', 'A5s'], ['vsOpen', 'HJ', 'UTG', '22'], ['vsOpen', 'BTN', 'CO', '22'], ['vsOpen', 'BTN', 'UTG', 'KJo'], ['vs3bet', 'CO', 'BTN', 'A5s'], ['rfi', 'UTG', null, 'K5s']]) {
  const s = spot(t, h, v); const e = Explain.explain(s, hand, s.strategy[hand]);
  console.log('\n[' + s.title + ' ' + hand + ']\n' + e.what + '\n' + e.why + (e.mix ? '\n' + e.mix : '') + (e.compare ? '\n' + e.compare : ''));
}
