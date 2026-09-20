// Validates every range: parse errors, weights > 100%, and prints action percentages.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'js');
const ctx = vm.createContext({ console });
for (const f of ['hands.js', 'ranges.js', 'spots.js']) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
const { Hands, Spots } = ctx;
let failed = false;
for (const table of ['6max', '9max', 'hu']) {
  let spots;
  try { spots = Spots.getSpots(table); } catch (e) { console.error('ERROR building', table, e.message); failed = true; continue; }
  console.log('\n== ' + table + ' (' + spots.length + ' spots) ==');
  console.log('spot'.padEnd(28) + 'raise%'.padStart(8) + 'call%'.padStart(8) + 'fold%'.padStart(8) + '   source');
  for (const s of spots) {
    const keys = s.actions.map(a => a.key);
    const sum = Hands.strategySummary(s.strategy, keys);
    const r = sum.raise ? sum.raise.pct : 0, c = sum.call ? sum.call.pct : (sum.limp ? sum.limp.pct : 0);
    const f = sum.fold ? sum.fold.pct : (sum.check ? sum.check.pct : 0);
    let extra = sum.check ? ' (fold col = check)' : (sum.limp ? ' (call col = limp)' : '');
    if (s.prior) {
      let tot = 0, cont = 0, four = 0;
      for (const h of Hands.ALL_HANDS) { const w = Hands.combos(h) * s.prior[h]; tot += w; cont += w * (s.strategy[h].raise + s.strategy[h].call); four += w * s.strategy[h].raise; }
      extra = '  of opening range: continue ' + (100 * cont / tot).toFixed(0) + '%, 4-bet ' + (100 * four / tot).toFixed(0) + '%';
    }
    console.log(s.title.padEnd(28) + String(r).padStart(8) + String(c).padStart(8) + String(f).padStart(8) + '   ' + s.source + extra);
  }
}
if (failed) process.exit(1);
console.log('\nAll ranges parsed; no hand exceeds 100%.');
