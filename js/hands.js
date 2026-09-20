/* hands.js — hand notation, 13x13 grid layout, range-string parser.
   Range notation: comma separated tokens, optional ":weight" (0..1, default 1)
     AA, AKs, AKo          single hand
     77+, 22-99           pair ranges
     A2s+, K9o+           kicker up to one below the high card
     Q2s-Q7s, K5o-K9o     kicker ranges (same high card)
*/
(function (root) {
  'use strict';
  const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];
  const RANK_IDX = {};
  RANKS.forEach((r, i) => { RANK_IDX[r] = i; });
  const SUITS = ['s','h','d','c'];
  const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };

  // GRID[row][col]: diagonal = pairs, upper-right = suited, lower-left = offsuit
  const GRID = [];
  const ALL_HANDS = [];
  for (let i = 0; i < 13; i++) {
    const row = [];
    for (let j = 0; j < 13; j++) {
      let h;
      if (i === j) h = RANKS[i] + RANKS[i];
      else if (j > i) h = RANKS[i] + RANKS[j] + 's';
      else h = RANKS[j] + RANKS[i] + 'o';
      row.push(h);
      ALL_HANDS.push(h);
    }
    GRID.push(row);
  }
  const TOTAL_COMBOS = 1326;

  function combos(h) { return h.length === 2 ? 6 : (h[2] === 's' ? 4 : 12); }
  function handType(h) { return h.length === 2 ? 'pair' : (h[2] === 's' ? 'suited' : 'offsuit'); }

  const R = '[AKQJT98765432]';
  const RE_PAIR = new RegExp('^(' + R + ')\\1$');
  const RE_PAIR_PLUS = new RegExp('^(' + R + ')\\1\\+$');
  const RE_PAIR_RANGE = new RegExp('^(' + R + ')\\1-(' + R + ')\\2$');
  const RE_HAND = new RegExp('^(' + R + ')(' + R + ')([so])$');
  const RE_HAND_PLUS = new RegExp('^(' + R + ')(' + R + ')([so])\\+$');
  const RE_HAND_RANGE = new RegExp('^(' + R + ')(' + R + ')([so])-(' + R + ')(' + R + ')([so])$');

  function expandToken(tok) {
    tok = tok.trim();
    let m;
    if ((m = RE_PAIR.exec(tok))) return [tok];
    if ((m = RE_PAIR_PLUS.exec(tok))) {
      const out = [];
      for (let i = RANK_IDX[m[1]]; i >= 0; i--) out.push(RANKS[i] + RANKS[i]);
      return out;
    }
    if ((m = RE_PAIR_RANGE.exec(tok))) {
      let a = RANK_IDX[m[1]], b = RANK_IDX[m[2]];
      if (a < b) { const t = a; a = b; b = t; }
      const out = [];
      for (let i = a; i >= b; i--) out.push(RANKS[i] + RANKS[i]);
      return out;
    }
    if ((m = RE_HAND.exec(tok))) {
      if (RANK_IDX[m[1]] >= RANK_IDX[m[2]]) throw new Error('Bad hand (high card first): ' + tok);
      return [tok];
    }
    if ((m = RE_HAND_PLUS.exec(tok))) {
      const hi = RANK_IDX[m[1]], lo = RANK_IDX[m[2]];
      if (hi >= lo) throw new Error('Bad hand: ' + tok);
      const out = [];
      for (let k = lo; k > hi; k--) out.push(RANKS[hi] + RANKS[k] + m[3]);
      return out;
    }
    if ((m = RE_HAND_RANGE.exec(tok))) {
      if (m[1] !== m[4] || m[3] !== m[6]) throw new Error('Range must share high card and suitedness: ' + tok);
      const hi = RANK_IDX[m[1]];
      let a = RANK_IDX[m[2]], b = RANK_IDX[m[5]];
      if (a < b) { const t = a; a = b; b = t; }
      if (b <= hi) throw new Error('Bad hand range: ' + tok);
      const out = [];
      for (let k = a; k >= b; k--) out.push(RANKS[hi] + RANKS[k] + m[3]);
      return out;
    }
    throw new Error('Unrecognised range token: "' + tok + '"');
  }

  function parseRange(str) {
    const out = {};
    if (!str) return out;
    for (const raw of str.split(',')) {
      const t = raw.trim();
      if (!t) continue;
      const parts = t.split(':');
      const w = parts.length > 1 ? parseFloat(parts[1]) : 1;
      if (!(w >= 0 && w <= 1)) throw new Error('Bad weight in token "' + t + '"');
      for (const h of expandToken(parts[0])) {
        if (out[h] !== undefined) throw new Error('Duplicate hand ' + h + ' in "' + str.slice(0, 40) + '..."');
        out[h] = w;
      }
    }
    return out;
  }

  /* Build a full 169-hand strategy from a spec:
     { actions: ['raise','call','fold'], raise: '...', call: '...' }
     The last action is the residual (fold / check). */
  function buildStrategy(spec) {
    const parsed = {};
    for (const a of spec.actions.slice(0, -1)) parsed[a] = parseRange(spec[a] || '');
    const residual = spec.actions[spec.actions.length - 1];
    const strat = {};
    for (const h of ALL_HANDS) {
      const s = {};
      let sum = 0;
      for (const a of spec.actions.slice(0, -1)) {
        const w = parsed[a][h] || 0;
        s[a] = w; sum += w;
      }
      if (sum > 1.0001) throw new Error('Frequencies exceed 100% for ' + h + ' (' + sum.toFixed(2) + ')');
      s[residual] = Math.max(0, Math.round((1 - sum) * 1000) / 1000);
      strat[h] = s;
    }
    return strat;
  }

  /* Percent of all 1326 combos taking each action. */
  function strategySummary(strat, actions) {
    const out = {};
    for (const a of actions) out[a] = 0;
    for (const h of ALL_HANDS) for (const a of actions) out[a] += combos(h) * strat[h][a];
    const pct = {};
    for (const a of actions) pct[a] = { combos: Math.round(out[a] * 10) / 10, pct: Math.round(1000 * out[a] / TOTAL_COMBOS) / 10 };
    return pct;
  }

  function randInt(n) { return Math.floor(Math.random() * n); }

  /* Deal concrete cards for a hand class, e.g. 'AKs' -> [{r:'A',s:'h'},{r:'K',s:'h'}] */
  function dealCards(h) {
    const r1 = h[0], r2 = h[1];
    if (h.length === 2) {
      const s1 = SUITS[randInt(4)];
      let s2 = SUITS[randInt(4)];
      while (s2 === s1) s2 = SUITS[randInt(4)];
      return [{ r: r1, s: s1 }, { r: r2, s: s2 }];
    }
    if (h[2] === 's') { const s = SUITS[randInt(4)]; return [{ r: r1, s: s }, { r: r2, s: s }]; }
    const s1 = SUITS[randInt(4)];
    let s2 = SUITS[randInt(4)];
    while (s2 === s1) s2 = SUITS[randInt(4)];
    return [{ r: r1, s: s1 }, { r: r2, s: s2 }];
  }

  function handLabel(h) {
    if (h.length === 2) return 'Pocket ' + h[0] + 's';
    return h.slice(0, 2) + (h[2] === 's' ? ' suited' : ' offsuit');
  }

  root.Hands = { RANKS, RANK_IDX, SUITS, SUIT_SYMBOL, GRID, ALL_HANDS, TOTAL_COMBOS,
    combos, handType, expandToken, parseRange, buildStrategy, strategySummary, dealCards, handLabel };
})(typeof window !== 'undefined' ? window : globalThis);
