// Writes a heads-up run's charts (report.mjs's hu_charts.json) into the HU block of js/ranges.js, replacing each
// chart's action strings in place. Usage: node apply_charts.mjs [runDir]   (default runs/hu)
import fs from 'node:fs';
const here = new URL('.', import.meta.url).pathname;
const run = process.argv[2] || 'runs/hu';
const hu = JSON.parse(fs.readFileSync(`${here}${run}/hu_charts.json`, 'utf8'));
const path = `${here}../js/ranges.js`;
let src = fs.readFileSync(path, 'utf8');
const start = src.indexOf('const HU = {'), end = src.indexOf('\n  };', start);
if (start < 0 || end < 0) throw new Error('no HU block in js/ranges.js');
let block = src.slice(start, end);
for (const [chart, acts] of Object.entries(hu)) {
  const c0 = block.indexOf(`    ${chart}: {`);
  if (c0 < 0) throw new Error(`no HU.${chart}`);
  const c1 = block.indexOf('\n    }', c0);
  let body = block.slice(c0, c1);
  for (const [act, str] of Object.entries(acts)) {
    const re = new RegExp(`(\\n\\s+${act}:\\s*)"[^"]*"`);
    if (!re.test(body)) throw new Error(`no HU.${chart}.${act}`);
    body = body.replace(re, (_, p) => `${p}${JSON.stringify(str)}`);
  }
  block = block.slice(0, c0) + body + block.slice(c1);
}
fs.writeFileSync(path, src.slice(0, start) + block + src.slice(end));
console.log(`wrote ${Object.keys(hu).length} heads-up charts from ${run}/hu_charts.json into js/ranges.js`);
