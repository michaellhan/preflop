// Prints every chart in js/ranges.js as per-hand frequencies (169 hands in Hands.ALL_HANDS order), for tools
// outside the app (scripts/build-norake.py, other projects' comparisons). Usage: node scripts/export-ranges.mjs > ranges.json
// The charts are the raked ones the app plays: js/ranges.js with js/ranges-lizard.js's replacements; --site-only leaves
// those out (js/ranges.js alone, as scripts/build-lizard-charts.py compares against).
import fs from 'node:fs';
import vm from 'node:vm';
const dir = new URL('..', import.meta.url).pathname;
const ctx = {}; ctx.globalThis = ctx; vm.createContext(ctx);
const files = ['js/hands.js', 'js/ranges.js'];
if (!process.argv.includes('--site-only') && fs.existsSync(dir + 'js/ranges-lizard.js')) files.push('js/ranges-lizard.js');
for (const f of files) vm.runInContext(fs.readFileSync(dir + f, 'utf8'), ctx);
const { Hands, RANGES } = ctx, H = Hands.ALL_HANDS;
const vec = (s) => { const m = Hands.parseRange(s || ''); return H.map((h) => +(m[h] || 0)); };
const groups = {};
for (const [g, charts] of Object.entries(RANGES)) {
  groups[g] = {};
  for (const [k, v] of Object.entries(charts)) {
    groups[g][k] = typeof v === 'string' ? { raise: vec(v) } : Object.fromEntries(Object.entries(v).map(([a, s]) => [a, vec(s)]));
  }
}
process.stdout.write(JSON.stringify({ hands: H, combos: H.map((h) => Hands.combos(h)), groups }));
