// Writes the heads-up starting strategy (the site's current charts) in the solver's text format.
import fs from 'node:fs'; import vm from 'node:vm';
const dir = new URL('../js/', import.meta.url).pathname;
const ctx = vm.createContext({ console });
for (const f of ['hands.js', 'ranges.js']) vm.runInContext(fs.readFileSync(dir + f, 'utf8'), ctx, { filename: f });
const { Hands, RANGES: { HU } } = ctx;
const lines = [];
const add = (node, action, str) => { const r = Hands.parseRange(str); for (const h in r) if (r[h] > 0) lines.push(`${node} ${action} ${h} ${r[h]}`); };
add('sb_open', 'raise', HU.SB_OPEN.raise); add('sb_open', 'limp', HU.SB_OPEN.limp);
add('bb_vs_open', 'raise', HU.BB_vs_SB.raise); add('bb_vs_open', 'call', HU.BB_vs_SB.call);
add('sb_vs_3bet', 'raise', HU.SB_vs_BB_3BET.raise); add('sb_vs_3bet', 'call', HU.SB_vs_BB_3BET.call);
add('bb_vs_limp', 'raise', HU.BB_vs_LIMP.raise);
add('sb_vs_iso', 'raise', HU.SB_vs_ISO.raise); add('sb_vs_iso', 'call', HU.SB_vs_ISO.call);
// spots the site has no chart for: a plain first guess, the solve replaces it
add('bb_vs_4bet', 'raise', 'QQ+, AKs, AKo'); add('bb_vs_4bet', 'call', 'JJ, TT, 99, AQs, AJs, KQs');
add('sb_vs_jam', 'call', 'JJ+, AKs, AKo');
add('bb_vs_limp3bet', 'raise', 'QQ+, AKs, AKo'); add('bb_vs_limp3bet', 'call', '77-JJ, ATs+, KTs+, QTs+, JTs, T9s, AJo+, KQo');
add('sb_vs_limpjam', 'call', 'QQ+, AKs, AKo');
fs.writeFileSync(new URL('start.txt', import.meta.url), lines.join('\n') + '\n');
console.log(lines.length, 'lines');
