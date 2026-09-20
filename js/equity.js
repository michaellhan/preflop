/* equity.js — 7-card hand evaluator and Monte Carlo equity of a hand vs a weighted range. */
(function (root) {
  'use strict';
  const H = root.Hands;
  const RV = { A: 14, K: 13, Q: 12, J: 11, T: 10, 9: 9, 8: 8, 7: 7, 6: 6, 5: 5, 4: 4, 3: 3, 2: 2 };
  const SV = { s: 0, h: 1, d: 2, c: 3 };
  // card id: (rank-2)*4 + suit, 0..51
  function cid(c) { return (RV[c.r] - 2) * 4 + SV[c.s]; }
  const RANK_OF = new Int8Array(52), SUIT_OF = new Int8Array(52);
  for (let i = 0; i < 52; i++) { RANK_OF[i] = (i >> 2) + 2; SUIT_OF[i] = i & 3; }

  // straight lookup: highest straight rank for a 13-bit rank mask (bit r-2), 0 if none
  function straightHigh(mask) {
    // wheel: A2345
    const m = mask | ((mask >> 12) & 1); // copy ace bit down to position "1" (bit -1 conceptually); handled below
    for (let hi = 14; hi >= 6; hi--) {
      const need = 0x1F << (hi - 6); // bits hi-4..hi  → (hi-4-2)..(hi-2) = hi-6..hi-2
      if ((mask & need) === need) return hi;
    }
    if ((mask & 0x100F) === 0x100F) return 5; // A,2,3,4,5  (bits 12,0,1,2,3)
    return 0;
  }

  const rc = new Int8Array(15), sc = new Int8Array(4);
  /* Returns a number: higher is better. */
  function evaluate7(c) {
    rc.fill(0); sc.fill(0);
    let mask = 0;
    for (let i = 0; i < 7; i++) { const r = RANK_OF[c[i]]; rc[r]++; sc[SUIT_OF[c[i]]]++; mask |= 1 << (r - 2); }
    // flush?
    let fs = -1;
    for (let s = 0; s < 4; s++) if (sc[s] >= 5) fs = s;
    if (fs >= 0) {
      let fmask = 0;
      for (let i = 0; i < 7; i++) if (SUIT_OF[c[i]] === fs) fmask |= 1 << (RANK_OF[c[i]] - 2);
      const sh = straightHigh(fmask);
      if (sh) return 8e6 + sh;
      // flush: top 5 ranks
      let v = 5e6, n = 0;
      for (let r = 14; r >= 2 && n < 5; r--) if (fmask & (1 << (r - 2))) { v += r * Math.pow(15, 4 - n); n++; }
      return v;
    }
    let quad = 0, trips = 0, p1 = 0, p2 = 0;
    for (let r = 14; r >= 2; r--) {
      if (rc[r] === 4) quad = r;
      else if (rc[r] === 3) { if (!trips) trips = r; else if (!p1) p1 = r; }
      else if (rc[r] === 2) { if (!p1) p1 = r; else if (!p2) p2 = r; }
    }
    if (quad) { let k = 0; for (let r = 14; r >= 2; r--) if (r !== quad && rc[r]) { k = r; break; } return 7e6 + quad * 15 + k; }
    if (trips && p1) return 6e6 + trips * 15 + p1;
    const sh = straightHigh(mask);
    if (sh) return 4e6 + sh;
    if (trips) { let v = 3e6 + trips * 225, n = 0; for (let r = 14; r >= 2 && n < 2; r--) if (r !== trips && rc[r]) { v += r * (n ? 1 : 15); n++; } return v; }
    if (p1 && p2) { let k = 0; for (let r = 14; r >= 2; r--) if (r !== p1 && r !== p2 && rc[r]) { k = r; break; } return 2e6 + p1 * 225 + p2 * 15 + k; }
    if (p1) { let v = 1e6 + p1 * 3375, n = 0; for (let r = 14; r >= 2 && n < 3; r--) if (r !== p1 && rc[r]) { v += r * Math.pow(15, 2 - n); n++; } return v; }
    let v = 0, n = 0;
    for (let r = 14; r >= 2 && n < 5; r--) if (rc[r]) { v += r * Math.pow(15, 4 - n); n++; }
    return v;
  }

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* All concrete 2-card combos of a hand class as [id1,id2]. */
  const COMBO_CACHE = {};
  function combosOf(h) {
    if (COMBO_CACHE[h]) return COMBO_CACHE[h];
    const out = [];
    const r1 = RV[h[0]], r2 = RV[h[1]];
    if (h.length === 2) { for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) out.push([(r1 - 2) * 4 + a, (r1 - 2) * 4 + b]); }
    else if (h[2] === 's') { for (let a = 0; a < 4; a++) out.push([(r1 - 2) * 4 + a, (r2 - 2) * 4 + a]); }
    else { for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (a !== b) out.push([(r1 - 2) * 4 + a, (r2 - 2) * 4 + b]); }
    COMBO_CACHE[h] = out;
    return out;
  }

  /* Weighted combo list of a range given blockers (hero cards). weights: {hand: 0..1} */
  function buildRange(weights, blockers) {
    const combos = [], ws = [];
    let total = 0;
    for (const h in weights) {
      const w = weights[h];
      if (!(w > 0)) continue;
      for (const cb of combosOf(h)) {
        if (blockers.indexOf(cb[0]) >= 0 || blockers.indexOf(cb[1]) >= 0) continue;
        combos.push(cb); ws.push(w); total += w;
      }
    }
    return { combos, ws, total };
  }

  /* Fraction of a range's combos (weighted) after removing blockers, relative to no blockers. */
  function rangeMass(weights, blockers) {
    let t = 0;
    for (const h in weights) {
      const w = weights[h];
      if (!(w > 0)) continue;
      for (const cb of combosOf(h)) if (blockers.indexOf(cb[0]) < 0 && blockers.indexOf(cb[1]) < 0) t += w;
    }
    return t;
  }

  /* Monte Carlo equity of heroCards (2 ids) vs weighted range. Returns 0..1 (ties count half). */
  function equity(heroIds, weights, samples, seed) {
    const R = buildRange(weights, heroIds);
    if (!R.combos.length) return 0.5;
    const rnd = mulberry32(seed || 12345);
    const cum = new Float64Array(R.ws.length);
    let acc = 0;
    for (let i = 0; i < R.ws.length; i++) { acc += R.ws[i]; cum[i] = acc; }
    const deck = new Int8Array(52);
    const hero = [heroIds[0], heroIds[1], 0, 0, 0, 0, 0];
    const vill = [0, 0, 0, 0, 0, 0, 0];
    let score = 0;
    for (let n = 0; n < samples; n++) {
      // pick villain combo
      const x = rnd() * acc;
      let lo = 0, hi = cum.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < x) lo = mid + 1; else hi = mid; }
      const vc = R.combos[lo];
      vill[0] = vc[0]; vill[1] = vc[1];
      // deal 5 board cards from remaining 48
      let m = 0;
      for (let i = 0; i < 52; i++) if (i !== heroIds[0] && i !== heroIds[1] && i !== vc[0] && i !== vc[1]) deck[m++] = i;
      for (let k = 0; k < 5; k++) {
        const j = k + Math.floor(rnd() * (m - k));
        const t = deck[k]; deck[k] = deck[j]; deck[j] = t;
        hero[2 + k] = deck[k]; vill[2 + k] = deck[k];
      }
      const a = evaluate7(hero), b = evaluate7(vill);
      if (a > b) score += 1; else if (a === b) score += 0.5;
    }
    return score / samples;
  }

  root.Equity = { cid, evaluate7, equity, combosOf, rangeMass, buildRange, RV };
})(typeof window !== 'undefined' ? window : globalThis);
