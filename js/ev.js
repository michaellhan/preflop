/* ev.js — approximate preflop EV model used to estimate EV loss.
   All EVs are absolute (change in hero's stack from before blinds were posted), in bb.
   Fold therefore equals minus whatever hero already put in.
   Model:
     EV(raise) = P(fold) * pot_won  +  P(call) * (postflop value - invested)  +  P(re-raise) * EV(vs re-raise)
     EV(call)  = postflop value - invested   (with a squeeze penalty when players remain behind)
     postflop value = EQR * equity * (pot - rake)  +  implied value for hands well ahead of the villain's range
   Equity = Monte Carlo vs the villain's actual range from ranges.js (with card removal).
   EQR (equity realization) depends on position and initiative (see About page). */
(function (root) {
  'use strict';
  const H = root.Hands, S = root.Spots, E = root.Equity;
  let SAMPLES = 1200;
  const CAL_SAMPLES = 200;

  function findSpot(table, type, hero, villain) {
    return S.getSpots(table).find(s => s.type === type && s.hero === hero && (s.villain || null) === (villain || null));
  }
  function posted(pos) { return pos === 'SB' ? 0.5 : pos === 'BB' ? 1 : 0; }
  function deadBlinds(exclude) { let d = 0; for (const p of ['SB', 'BB']) if (exclude.indexOf(p) < 0) d += posted(p); return d; }
  function weightsOf(strategy, key, prior, mult) {
    const w = {};
    for (const h of H.ALL_HANDS) {
      let f = strategy[h][key] * (prior ? prior[h] : 1);
      if (mult) f *= (mult[h] || 0);
      if (f > 0) w[h] = f;
    }
    return w;
  }
  function scale(weights, mult) { const w = {}; for (const h in weights) { const f = weights[h] * (mult[h] || 0); if (f > 0) w[h] = f; } return w; }
  function mass(weights, blockers) { return E.rangeMass(weights, blockers); }
  const RANDOM_MASS = 1225; // C(50,2)

  function postIdx(table, pos) {
    if (table === 'hu') return pos === 'SB' ? 1 : 0; // heads-up: the SB is the button and acts last
    if (pos === 'SB') return 0; if (pos === 'BB') return 1; return 2 + S.TABLES[table].positions.indexOf(pos);
  }
  const RV = E.RV;
  /* Hand-type equity realization: strong made hands over-realize, weak/bluff-type hands under-realize. */
  const CAT_EQR = { 'premium-pair': 1.10, 'strong-pair': 1.08, 'AK': 1.08, 'AQ': 1.04, 'medium-pair': 1.0, 'big-suited-ace': 1.0, 'suited-broadway': 1.0,
    'small-pair': 0.95, 'mid-suited-ace': 0.92, 'wheel-suited-ace': 0.92, 'suited-connector': 0.92, 'suited-gapper': 0.9, 'suited-king': 0.9, 'suited-queen': 0.9,
    'offsuit-broadway': 0.9, 'big-offsuit-ace': 0.9, 'weak-offsuit-ace': 0.85, 'offsuit-king': 0.85, 'offsuit-connector': 0.85, 'suited-junk': 0.85, 'offsuit-junk': 0.8 };
  function handMod(hand) { return CAT_EQR[root.Explain.classify(hand).cat] || 1; }
  /* Equity realization: in position ~100%, out of position ~82%, +5% for the last aggressor,
     scaled by hand type. */
  const STRONG = { 'premium-pair': 1, 'strong-pair': 1, 'AK': 1, 'AQ': 1 };
  function isStrong(hand) { return !!STRONG[root.Explain.classify(hand).cat]; }
  /* level: 1 = single-raised pot, 2 = 3-bet pot, 3 = 4-bet pot. Non-premium hands realize less in re-raised pots. */
  function eqr(table, hero, villain, initiative, hand, level) {
    const ip = postIdx(table, hero) > postIdx(table, villain);
    let e = ip ? 1.0 : 0.82;
    if (initiative) e += 0.05;
    let hm = handMod(hand);
    if (table === 'hu') hm = 0.5 + 0.5 * hm; // heads-up ranges are so wide that "weak" hand types are closer to average
    e *= hm;
    if (!isStrong(hand)) { if (level === 2) e *= 0.88; else if (level === 3) e *= 0.8; }
    return e;
  }
  function seedOf(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  const STACK = 100;
  /* Rake: 5% capped at 0.5bb (matches the reference solution the ranges were checked against), taken only from pots that see a flop (no flop, no drop). */
  function rake(pot) { return Math.min(0.05 * pot, 0.5); }
  /* Value of seeing a flop: the realized share of the raked pot, plus implied value for hands that are
     well ahead of the villain's range (they win further bets from worse hands on later streets; with
     100bb stacks that is most of what strong hands earn). e = equity realization, behind = stack left.
     The implied value is a share phi of the remaining stacks going in at the hand's edge: phi grows as the
     stack-to-pot ratio falls, and the edge counts in full only for clear favourites (>= 75% realized). */
  function post(e, eq, pot, behind) {
    const share = Math.min(0.97, e * eq);
    const edge = share - 0.5;
    let iv = 0;
    if (edge > 0 && behind > 0) {
      const phi = Math.min(1, 0.25 + 1.5 * pot / behind);
      iv = behind * phi * edge * Math.min(1, edge / 0.25); // ~half the edge survives once only strong hands put stacks in
    }
    return share * (pot - rake(pot)) + iv;
  }
  /* post() against a known villain range. Strong hands also get stacks in against the villain's own strong
     hands (the part of the range that never folds, STACKOFF): that value is credited when it beats the
     generic implied value, so flatting a monster is not undervalued against a 4-bet or 3-bet line. */
  const STACKOFF = { AA: 1, KK: 1, QQ: 1, JJ: 0.6, TT: 0.3, AKs: 1, AKo: 1, AQs: 0.5 };
  function postVs(e, ids, range, seed, pot, behind, eq) {
    if (eq === undefined) eq = E.equity(ids, range, SAMPLES, seed);
    const v = post(e, eq, pot, behind);
    const share = Math.min(0.97, e * eq);
    if (share < 0.5 || behind <= 0) return v;
    const top = scale(range, STACKOFF), mt = mass(top, ids);
    if (!(mt > 0)) return v;
    const p = mt / (mass(range, ids) || 1e-9);
    const ivStack = p * Math.max(0, E.equity(ids, top, SAMPLES, seed + 7777) - 0.5) * 2 * behind * 0.7;
    const base = share * (pot - rake(pot));
    return base + Math.max(v - base, ivStack);
  }
  /* All-in preflop: raw equity of the (raked) pot. */
  function allIn(eq, pot) { return eq * (pot - rake(pot)); }
  function merge(a, b, wb) { const w = Object.assign({}, a); for (const h in b) w[h] = Math.min(1, (w[h] || 0) + b[h] * (wb === undefined ? 1 : wb)); return w; }
  const ANY = {}; for (const h of H.ALL_HANDS) ANY[h] = 1;

  // how a 3-bettor responds to a 4-bet (approximate, applied on top of their 3-bet range)
  const JAM_VS_4BET = { AA: 1, KK: 1, QQ: 0.5, JJ: 0.15, AKs: 0.9, AKo: 0.6, AQs: 0.1, A5s: 0.35, A4s: 0.3, A3s: 0.2, A2s: 0.15, KQs: 0.1 };
  const CALL_VS_4BET = { QQ: 0.5, JJ: 0.7, TT: 0.7, '99': 0.5, '88': 0.3, '77': 0.15, AQs: 0.8, AQo: 0.4, AJs: 0.7, ATs: 0.4, A9s: 0.2, KQs: 0.6, KJs: 0.4, KTs: 0.2, QJs: 0.3, JTs: 0.3, T9s: 0.2,
    '98s': 0.1, '87s': 0.1, '76s': 0.1, '65s': 0.1, A5s: 0.3, A4s: 0.3, A3s: 0.2, A2s: 0.2, AJo: 0.15, KQo: 0.25 };
  // how a 4-bettor responds to a 5-bet jam
  const CALL_JAM = { AA: 1, KK: 1, QQ: 1, AKs: 1, AKo: 1, JJ: 0.5, AQs: 0.3 };
  /* Fallback for a table whose SB has no limp range in ranges.js: a typical limping range (weak-to-medium
     hands with a few traps) and these approximate responses. Tables with a real SB limp range use that. */
  const SB_LIMP = H.parseRange("AA:0.15, KK:0.15, AKs:0.1, 22-88, A2s-A9s:0.6, K2s-K9s:0.7, Q4s-QTs:0.7, J6s-JTs:0.7, T6s-T9s:0.7, 96s-98s:0.7, 85s-87s:0.7, 74s-76s:0.7, 64s-65s:0.7, 53s-54s:0.7, 43s:0.6, A2o-A9o:0.7, K7o-KTo:0.7, Q8o-QTo:0.7, J8o-JTo:0.7, T8o-T9o:0.7, 98o:0.7, 87o:0.6, 76o:0.5, 65o:0.4");
  const SB_3BET_ISO = { AA: 1, KK: 1, AKs: 1, A5s: 0.3, A4s: 0.3, A9o: 0.1, A8o: 0.1 };
  const SB_CALL_ISO = {};
  for (const h in SB_LIMP) {
    const hi = RV[h[0]], lo = RV[h[1]];
    SB_CALL_ISO[h] = Math.max(0, ((h.length === 2 || h[2] === 's' || hi === 14 || lo >= 9) ? 0.85 : 0.35) - (SB_3BET_ISO[h] || 0));
  }
  function sbLimpRange(table) {
    const w = weightsOf(findSpot(table, 'rfi', 'SB', null).strategy, 'limp');
    return Object.keys(w).length ? w : SB_LIMP;
  }

  /* Hero (last aggressor, invested R before) 4-bets to F vs villain who 3-bet to T with range threeRange. */
  function fourBetEV(table, hero, villain, heroIds, hand, T, threeRange, dead, seed) {
    const F = S.fourBetSize(T);
    const jamR = scale(threeRange, JAM_VS_4BET), callR = scale(threeRange, CALL_VS_4BET);
    const mAll = mass(threeRange, heroIds) || 1e-9, mJam = mass(jamR, heroIds), mCall = mass(callR, heroIds);
    const pJam = mJam / mAll, pCall = mCall / mAll, pFold = Math.max(0, 1 - pJam - pCall);
    const evFold = T + dead;
    const evCall = mCall > 0 ? postVs(eqr(table, hero, villain, true, hand, 3), heroIds, callR, seed, 2 * F + dead, STACK - F) - F : 0;
    const evJam = mJam > 0 ? Math.max(-F, allIn(E.equity(heroIds, jamR, SAMPLES, seed + 1), 2 * STACK + dead) - STACK) : 0;
    return pFold * evFold + pCall * evCall + pJam * evJam;
  }

  /* Hero, first in, raises to R: each player behind folds, calls or 3-bets (their ranges vs this open);
     facing a 3-bet hero plays its own GTO mix of 4-bet / call / fold. */
  function evRFI(spot, heroIds, hand) {
    const table = spot.table, P = S.TABLES[table].positions, hero = spot.hero;
    const R = S.openSize(hero), hp = posted(hero);
    const seed = seedOf(spot.id + hand);
    const behind = P.slice(P.indexOf(hero) + 1);
    let pNone = 1, ev = 0, k = 0;
    for (const b of behind) {
      const resp = findSpot(table, 'vsOpen', b, hero);
      if (!resp) continue;
      const callR = weightsOf(resp.strategy, 'call'), threeR = weightsOf(resp.strategy, 'raise');
      const pc = mass(callR, heroIds) / RANDOM_MASS, pr = mass(threeR, heroIds) / RANDOM_MASS;
      const dead = deadBlinds([hero, b]);
      if (pc > 0) {
        const eq = E.equity(heroIds, callR, SAMPLES, seed + k++);
        ev += pNone * pc * (postVs(eqr(table, hero, b, true, hand, 1), heroIds, callR, seed, 2 * R + dead, STACK - R, eq) - R);
      }
      if (pr > 0) {
        const T = S.threeBetSize(b, hero);
        const eq3 = E.equity(heroIds, threeR, SAMPLES, seed + k++);
        const evFold = -R;
        const evCall = postVs(eqr(table, hero, b, false, hand, 2), heroIds, threeR, seed, 2 * T + dead, STACK - T, eq3) - T;
        const ev4 = fourBetEV(table, hero, b, heroIds, hand, T, threeR, dead, seed + k++);
        const my = findSpot(table, 'vs3bet', hero, b);
        let evVs3;
        if (my) { const f = my.strategy[hand]; evVs3 = f.raise * ev4 + f.call * evCall + f.fold * evFold; }
        else evVs3 = Math.max(evFold, evCall, ev4);
        ev += pNone * pr * evVs3;
      }
      pNone *= Math.max(0, 1 - pc - pr);
    }
    ev += pNone * (1.5 - hp);
    return { raise: ev, fold: -hp };
  }

  /* Isolation raise over a SB limp and the SB's re-raise: 3bb / 15bb in 6-max and 9-max, 4bb / 12bb heads-up. */
  function isoSizes(table) { return table === 'hu' ? [4, 12] : [S.ISO_SIZE, S.ISO_3BET_SIZE]; }
  /* SB, having limped, faces the BB's isolation raise to X: 3-bet to Y / call / fold. */
  function sbVsIso(table, heroIds, hand, isoR, seed) {
    const [X, Y] = isoSizes(table);
    const evFold = -1;
    const evCall = postVs(eqr(table, 'SB', 'BB', false, hand, 1), heroIds, isoR, seed, 2 * X, STACK - X) - X;
    // limp-3-bet to Y: the BB folds ~50%, calls ~40%, jams ~10% (approximate)
    const jamR = scale(isoR, JAM_VS_4BET);
    const evVsJam = mass(jamR, heroIds) > 0 ? Math.max(-Y, allIn(E.equity(heroIds, jamR, SAMPLES, seed + 2), 2 * STACK) - STACK) : -Y;
    const ev3 = 0.5 * X + 0.4 * (postVs(eqr(table, 'SB', 'BB', true, hand, 2), heroIds, isoR, seed + 1, 2 * Y, STACK - Y) - Y) + 0.1 * evVsJam;
    return { raise: ev3, call: evCall, fold: evFold };
  }

  /* Hero, first in, limps (completes to 1bb). */
  function evLimp(spot, heroIds, hand) {
    const table = spot.table, P = S.TABLES[table].positions, hero = spot.hero;
    const seed = seedOf(spot.id + hand + 'limp');
    if (hero === 'SB') {
      // the BB raises (isolates) or checks; after a raise the SB plays its own GTO response
      const bb = findSpot(table, 'vsLimp', 'BB', 'SB'), iso = findSpot(table, 'vsLimp', 'SB', 'BB');
      const isoR = weightsOf(bb.strategy, 'raise'), checkR = weightsOf(bb.strategy, 'check');
      const pIso = mass(isoR, heroIds) / RANDOM_MASS;
      let ev = (1 - pIso) * (postVs(eqr(table, 'SB', 'BB', false, hand, 1), heroIds, checkR, seed, 2, STACK - 1) - 1);
      if (pIso > 0) {
        const r = sbVsIso(table, heroIds, hand, isoR, seed + 1);
        const f = iso ? iso.strategy[hand] : null;
        ev += pIso * (f && (f.raise + f.call + f.fold) > 0 ? f.raise * r.raise + f.call * r.call + f.fold * r.fold : Math.max(r.raise, r.call, r.fold));
      }
      return ev;
    }
    // an open-limp from UTG..BTN: anyone behind may raise (isolate). They isolate a limp far more often than
    // they would play against an open (ISO_MULT), and the limper's capped range realizes less (LIMP_EQR).
    const ISO_MULT = 1.6, LIMP_EQR = 0.9;
    const behind = P.slice(P.indexOf(hero) + 1);
    let pNone = 1, ev = 0, k = 0, bbCheck = ANY;
    for (const b of behind) {
      const resp = findSpot(table, 'vsOpen', b, hero);
      if (!resp) continue;
      const raiseR = weightsOf(resp.strategy, 'raise'), callR = weightsOf(resp.strategy, 'call');
      const isoR = b === 'BB' ? merge(raiseR, callR, 0.3) : merge(raiseR, callR);
      if (b === 'BB') { bbCheck = {}; for (const h of H.ALL_HANDS) { const f = 1 - (isoR[h] || 0); if (f > 0) bbCheck[h] = f; } }
      const pi = Math.min(0.95, ISO_MULT * mass(isoR, heroIds) / RANDOM_MASS);
      if (pi > 0) {
        const X = b === 'BB' ? 4 : 4.5, dead = deadBlinds([hero, b]);
        const evCall = postVs(LIMP_EQR * eqr(table, hero, b, false, hand, 1), heroIds, isoR, seed + k++, 2 * X + dead, STACK - X) - X;
        ev += pNone * pi * Math.max(-1, evCall);
      }
      pNone *= Math.max(0, 1 - pi);
    }
    // nobody raises: the SB folds and hero sees a flop against the BB's checking range
    ev += pNone * (postVs(LIMP_EQR * eqr(table, hero, 'BB', false, hand, 1), heroIds, bbCheck, seed + k++, 2.5, STACK - 1) - 1);
    return ev;
  }

  function evVsOpen(spot, heroIds, hand) {
    const table = spot.table, P = S.TABLES[table].positions, hero = spot.hero, V = spot.villain;
    const O = S.openSize(V), hp = posted(hero), dead = deadBlinds([hero, V]);
    const seed = seedOf(spot.id + hand);
    const openSpot = findSpot(table, 'rfi', V, null);
    const openR = weightsOf(openSpot.strategy, 'raise');
    // call
    let q = 0; // squeeze risk from players still to act
    {
      let pNo = 1;
      for (const b of P.slice(P.indexOf(hero) + 1)) {
        const rs = findSpot(table, 'vsOpen', b, V);
        if (!rs) continue;
        pNo *= 1 - 0.6 * mass(weightsOf(rs.strategy, 'raise'), heroIds) / RANDOM_MASS;
      }
      q = 1 - pNo;
    }
    const eqO = E.equity(heroIds, openR, SAMPLES, seed);
    const evCall = (1 - q) * (postVs(eqr(table, hero, V, false, hand, 1), heroIds, openR, seed, 2 * O + dead, STACK - O, eqO) - O) + q * (-O);
    // 3-bet
    const T = S.threeBetSize(hero, V);
    const resp = findSpot(table, 'vs3bet', V, hero);
    const prior = resp.prior;
    const foldR = weightsOf(resp.strategy, 'fold', prior), callR = weightsOf(resp.strategy, 'call', prior), fourR = weightsOf(resp.strategy, 'raise', prior);
    const mAll = mass(prior, heroIds) || 1e-9;
    const pF = mass(foldR, heroIds) / mAll, pC = mass(callR, heroIds) / mAll, pR = mass(fourR, heroIds) / mAll;
    const evFoldV = O + dead;
    const evCallV = pC > 0 ? postVs(eqr(table, hero, V, true, hand, 2), heroIds, callR, seed + 1, 2 * T + dead, STACK - T) - T : 0;
    let ev4 = 0;
    if (pR > 0) {
      const F = S.fourBetSize(T);
      const jamCall = scale(fourR, CALL_JAM);
      const pCallJam = mass(jamCall, heroIds) / (mass(fourR, heroIds) || 1e-9);
      const evJam = (1 - pCallJam) * (F + dead) + (pCallJam > 0 ? pCallJam * (allIn(E.equity(heroIds, jamCall, SAMPLES, seed + 2), 2 * STACK + dead) - STACK) : 0);
      const evCall4 = postVs(eqr(table, hero, V, false, hand, 3), heroIds, fourR, seed + 3, 2 * F + dead, STACK - F) - F;
      ev4 = Math.max(-T, evJam, evCall4);
    }
    const evRaiseHU = pF * evFoldV + pC * evCallV + pR * ev4;
    // players still to act can cold 4-bet or cold call the 3-bet; non-premium hands then mostly give up
    let pNoBehind = 1;
    for (const b of P.slice(P.indexOf(hero) + 1)) {
      const rs = findSpot(table, 'vsOpen', b, V);
      if (!rs) continue;
      const r3 = mass(weightsOf(rs.strategy, 'raise'), heroIds) / RANDOM_MASS, c3 = mass(weightsOf(rs.strategy, 'call'), heroIds) / RANDOM_MASS;
      pNoBehind *= 1 - (0.5 * r3 + 0.15 * c3);
    }
    const qb = 1 - pNoBehind;
    const evRaise = isStrong(hand) ? evRaiseHU : (1 - qb) * evRaiseHU + qb * (-T);
    return { raise: evRaise, call: evCall, fold: -hp };
  }

  function evVs3bet(spot, heroIds, hand) {
    const table = spot.table, hero = spot.hero, V = spot.villain;
    const R = S.openSize(hero), T = S.threeBetSize(V, hero), dead = deadBlinds([hero, V]);
    const seed = seedOf(spot.id + hand);
    const threeSpot = findSpot(table, 'vsOpen', V, hero);
    const threeR = weightsOf(threeSpot.strategy, 'raise');
    const eq = E.equity(heroIds, threeR, SAMPLES, seed);
    const evCall = postVs(eqr(table, hero, V, false, hand, 2), heroIds, threeR, seed, 2 * T + dead, STACK - T, eq) - T;
    const evRaise = fourBetEV(table, hero, V, heroIds, hand, T, threeR, dead, seed + 1);
    return { raise: evRaise, call: evCall, fold: -R };
  }

  /* Cold 4-bet: O opened to R, V 3-bet to T, hero (not yet in) 4-bets to F / calls / folds.
     The opener, still to act behind hero, jams its very top or folds to a cold 4-bet; after a cold call it
     4-bets with its own vs-3-bet frequencies (hero then gives up) or comes along and makes the pot multi-way. */
  const OPENER_VS_COLD4 = { AA: 1, KK: 1, AKs: 0.4, QQ: 0.2 };
  function evCold4(spot, heroIds, hand) {
    const table = spot.table, hero = spot.hero, O = spot.opener, V = spot.villain;
    const R = S.openSize(O), T = S.threeBetSize(V, O), F = S.cold4BetSize(T, hero), hp = posted(hero);
    const dead = deadBlinds([hero, O, V]);
    const seed = seedOf(spot.id + hand);
    const threeR = weightsOf(findSpot(table, 'vsOpen', V, O).strategy, 'raise');
    const openR = weightsOf(findSpot(table, 'rfi', O, null).strategy, 'raise');
    // 4-bet
    const jamR = scale(threeR, JAM_VS_4BET), callR = scale(threeR, CALL_VS_4BET);
    const mAll = mass(threeR, heroIds) || 1e-9;
    const pJ = mass(jamR, heroIds) / mAll, pC = mass(callR, heroIds) / mAll, pF = Math.max(0, 1 - pJ - pC);
    const evCallV = pC > 0 ? postVs(eqr(table, hero, V, true, hand, 3), heroIds, callR, seed, 2 * F + R + dead, STACK - F) - F : 0;
    const evJamV = pJ > 0 ? Math.max(-F, allIn(E.equity(heroIds, jamR, SAMPLES, seed + 1), 2 * STACK + R + dead) - STACK) : 0;
    const ev4 = pF * (T + R + dead) + pC * evCallV + pJ * evJamV;
    const oJam = scale(openR, OPENER_VS_COLD4), pOJ = mass(oJam, heroIds) / (mass(openR, heroIds) || 1e-9);
    const evVsOJ = pOJ > 0 ? Math.max(-F, allIn(E.equity(heroIds, oJam, SAMPLES, seed + 2), 2 * STACK + T + dead) - STACK) : 0;
    const evRaise = pOJ * evVsOJ + (1 - pOJ) * ev4;
    // cold call
    const my = findSpot(table, 'vs3bet', O, V);
    let p4 = 0, pOc = 0;
    if (my) {
      const m = mass(my.prior, heroIds) || 1e-9;
      p4 = mass(weightsOf(my.strategy, 'raise', my.prior), heroIds) / m;
      pOc = mass(weightsOf(my.strategy, 'call', my.prior), heroIds) / m;
    }
    const mw = 1 - 0.15 * pOc; // a multi-way pot realizes less
    const evCallFlat = postVs(mw * eqr(table, hero, V, false, hand, 2), heroIds, threeR, seed + 3, 2 * T + R + dead + pOc * (T - R), STACK - T) - T;
    const evCall = p4 * (-T) + (1 - p4) * evCallFlat;
    return { raise: evRaise, call: evCall, fold: -hp };
  }

  /* Squeeze: O opened to R, C called, hero squeezes to Z / overcalls / folds. The opener answers with its
     own vs-3-bet frequencies; the caller's capped range continues only with its best hands. */
  const CALLER_VS_SQZ = { AA: 1, KK: 1, QQ: 0.6, JJ: 0.6, TT: 0.5, '99': 0.4, '88': 0.3, '77': 0.2, AKs: 1, AKo: 1, AQs: 0.5, AJs: 0.3, KQs: 0.4, KJs: 0.2, QJs: 0.2, JTs: 0.2, AQo: 0.2 };
  function evSqueeze(spot, heroIds, hand) {
    const table = spot.table, P = S.TABLES[table].positions, hero = spot.hero, O = spot.opener, C = spot.villain;
    const R = S.openSize(O), Z = S.squeezeSize(hero, O, C), hp = posted(hero);
    const dead = deadBlinds([hero, O, C]);
    const seed = seedOf(spot.id + hand);
    const openR = weightsOf(findSpot(table, 'rfi', O, null).strategy, 'raise');
    const callerR = weightsOf(findSpot(table, 'vsOpen', C, O).strategy, 'call');
    // squeeze
    const resp = findSpot(table, 'vs3bet', O, hero);
    const prior = resp.prior, mAll = mass(prior, heroIds) || 1e-9;
    const oCall = weightsOf(resp.strategy, 'call', prior), oFour = weightsOf(resp.strategy, 'raise', prior);
    const pC = mass(oCall, heroIds) / mAll, pR = mass(oFour, heroIds) / mAll, pF = Math.max(0, 1 - pC - pR);
    const pot = 2 * Z + R + dead; // hero and one caller, plus the other player's dead open
    const evVsCall = pC > 0 ? postVs(eqr(table, hero, O, true, hand, 2), heroIds, oCall, seed, pot, STACK - Z) - Z : 0;
    let evVs4 = -Z;
    if (pR > 0 && isStrong(hand)) {
      const jamCall = scale(oFour, CALL_JAM);
      const pCallJam = mass(jamCall, heroIds) / (mass(oFour, heroIds) || 1e-9);
      const F = S.fourBetSize(Z);
      evVs4 = Math.max(-Z, (1 - pCallJam) * (F + R + dead) + (pCallJam > 0 ? pCallJam * (allIn(E.equity(heroIds, jamCall, SAMPLES, seed + 1), 2 * STACK + R + dead) - STACK) : 0));
    }
    const cCont = scale(callerR, CALLER_VS_SQZ);
    const pCc = mass(cCont, heroIds) / (mass(callerR, heroIds) || 1e-9);
    const evVsCaller = pCc > 0 ? postVs(eqr(table, hero, C, true, hand, 2), heroIds, cCont, seed + 2, pot, STACK - Z) - Z : 0;
    const evRaise = pR * evVs4 + pC * evVsCall + pF * (pCc * evVsCaller + (1 - pCc) * (2 * R + dead));
    // overcall: a three-way pot against the opener's range, with a squeeze risk from players still to act
    let pNo = 1;
    for (const b of P.slice(P.indexOf(hero) + 1)) {
      const rs = findSpot(table, 'vsOpen', b, O);
      if (rs) pNo *= 1 - 0.8 * mass(weightsOf(rs.strategy, 'raise'), heroIds) / RANDOM_MASS;
    }
    const q = 1 - pNo;
    const evCall = (1 - q) * (postVs(0.85 * eqr(table, hero, O, false, hand, 1), heroIds, openR, seed + 3, 3 * R + dead, STACK - R) - R) + q * (-R);
    return { raise: evRaise, call: evCall, fold: -hp };
  }

  /* BB facing a SB limp: raise (isolate) or check. */
  function evVsLimp(spot, heroIds, hand) {
    const table = spot.table, [X, Y] = isoSizes(table);
    const seed = seedOf(spot.id + hand);
    const limpR = sbLimpRange(table);
    const iso = findSpot(table, 'vsLimp', 'SB', 'BB');
    const callR = iso ? weightsOf(iso.strategy, 'call', iso.prior) : scale(SB_LIMP, SB_CALL_ISO);
    const threeR = iso ? weightsOf(iso.strategy, 'raise', iso.prior) : scale(SB_LIMP, SB_3BET_ISO);
    const evCheck = postVs(eqr(table, 'BB', 'SB', false, hand, 1), heroIds, limpR, seed, 2, STACK - 1) - 1;
    const mAll = mass(limpR, heroIds) || 1e-9;
    const pC = mass(callR, heroIds) / mAll, pR = mass(threeR, heroIds) / mAll, pF = Math.max(0, 1 - pC - pR);
    const evCallV = postVs(eqr(table, 'BB', 'SB', true, hand, 1), heroIds, callR, seed + 1, 2 * X, STACK - X) - X;
    const evRaiseV = pR > 0 ? Math.max(-X, postVs(eqr(table, 'BB', 'SB', false, hand, 2), heroIds, threeR, seed + 2, 2 * Y, STACK - Y) - Y) : 0;
    return { raise: pF * 1 + pC * evCallV + pR * evRaiseV, check: evCheck };
  }

  /* Heads-up SB first in: raise / limp / fold. */
  function evHUOpen(spot, heroIds, hand) {
    const table = 'hu', seed = seedOf(spot.id + hand);
    const vsOpen = findSpot(table, 'vsOpen', 'BB', 'SB'), my3 = findSpot(table, 'vs3bet', 'SB', 'BB');
    const callR = weightsOf(vsOpen.strategy, 'call'), threeR = weightsOf(vsOpen.strategy, 'raise');
    const pc = mass(callR, heroIds) / RANDOM_MASS, pr = mass(threeR, heroIds) / RANDOM_MASS;
    let evRaise = (1 - pc - pr) * 1;
    evRaise += pc * (postVs(eqr(table, 'SB', 'BB', true, hand, 1), heroIds, callR, seed, 5, STACK - 2.5) - 2.5);
    if (pr > 0) {
      const T = 10;
      const evFold = -2.5;
      const evCall = postVs(eqr(table, 'SB', 'BB', false, hand, 2), heroIds, threeR, seed + 1, 20, STACK - T) - T;
      const ev4 = fourBetEV(table, 'SB', 'BB', heroIds, hand, T, threeR, 0, seed + 2);
      const f = my3.strategy[hand];
      evRaise += pr * (f.raise * ev4 + f.call * evCall + f.fold * evFold);
    }
    return { raise: evRaise, limp: evLimp(spot, heroIds, hand), fold: -0.5 };
  }

  /* SB, having limped, facing the BB's raise to 4bb (any table). */
  function evSBIso(spot, heroIds, hand) {
    const bb = findSpot(spot.table, 'vsLimp', 'BB', 'SB');
    return sbVsIso(spot.table, heroIds, hand, weightsOf(bb.strategy, 'raise'), seedOf(spot.id + hand));
  }

  function rawEVs(spot, heroIds, hand) {
    if (spot.type === 'rfi') {
      if (spot.table === 'hu') return evHUOpen(spot, heroIds, hand);
      const r = evRFI(spot, heroIds, hand);
      return { raise: r.raise, limp: evLimp(spot, heroIds, hand), fold: r.fold };
    }
    if (spot.type === 'vsOpen') return evVsOpen(spot, heroIds, hand);
    if (spot.type === 'vs3bet') return evVs3bet(spot, heroIds, hand);
    if (spot.type === 'cold4') return evCold4(spot, heroIds, hand);
    if (spot.type === 'squeeze') return evSqueeze(spot, heroIds, hand);
    if (spot.hero === 'SB') return evSBIso(spot, heroIds, hand);
    return evVsLimp(spot, heroIds, hand);
  }

  /* ---------- per-spot calibration ----------
     The raw model has systematic biases (e.g. it can overrate 4-bets in one spot). For each spot we compute
     raw EVs for every hand once and shift each action's EV by a constant. At equilibrium a hand that mixes
     two actions is indifferent between them, so the shifts are fitted (least squares) to make the median
     EV gap zero on the hands GTO mixes. An action with no mixed hands is anchored instead by the threshold
     that best separates the hands that purely take it from the hands that purely take the residual action. */
  const MODEL_VERSION = 2;
  const CAL_KEY = 'preflop-evcal-v' + MODEL_VERSION + '-' + seedOf(JSON.stringify(root.RANGES)).toString(36);
  let calStore = null;
  function loadCal() { if (calStore) return calStore; try { calStore = JSON.parse(root.localStorage.getItem(CAL_KEY) || '{}'); } catch (e) { calStore = {}; } return calStore; }
  function saveCal() { try { root.localStorage.setItem(CAL_KEY, JSON.stringify(calStore)); } catch (e) { /* ignore */ } }
  function fixedCards(hand) { // deterministic suits for calibration
    const r1 = hand[0], r2 = hand[1];
    if (hand.length === 2) return [{ r: r1, s: 's' }, { r: r2, s: 'h' }];
    if (hand[2] === 's') return [{ r: r1, s: 's' }, { r: r2, s: 's' }];
    return [{ r: r1, s: 's' }, { r: r2, s: 'h' }];
  }
  function bestThreshold(pos, neg) { // pos gaps should be > t, neg gaps < t
    if (!pos.length || !neg.length) return null;
    const all = pos.map(g => ({ g, p: 1 })).concat(neg.map(g => ({ g, p: 0 }))).sort((a, b) => a.g - b.g);
    let best = -1, bestT = 0;
    for (let i = 0; i <= all.length; i++) {
      const t = i === 0 ? all[0].g - 1e-6 : i === all.length ? all[all.length - 1].g + 1e-6 : (all[i - 1].g + all[i].g) / 2;
      let ok = 0;
      for (const x of all) if ((x.p === 1 && x.g > t) || (x.p === 0 && x.g < t)) ok++;
      if (ok > best) { best = ok; bestT = t; }
    }
    return bestT;
  }
  function median(a) { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  const MIX_MIN = 0.1; // a hand counts as mixing an action if it takes it at least this often
  function fitBias(spot, raw) {
    const keys = spot.actions.map(a => a.key), ref = keys[keys.length - 1];
    const pairs = []; // constraints bias[a] - bias[b] = g, weight n
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i], b = keys[j], gaps = [];
      for (const h in raw) { const f = spot.strategy[h]; if (f[a] >= MIX_MIN && f[b] >= MIX_MIN) gaps.push(raw[h][a] - raw[h][b]); }
      if (gaps.length >= 3) pairs.push({ a, b, g: median(gaps), n: gaps.length });
    }
    for (const a of keys) { // weak anchor from pure hands (dominant only when an action has no mixed hands)
      if (a === ref) continue;
      const pos = [], neg = [];
      for (const h in raw) { const f = spot.strategy[h]; const gap = raw[h][a] - raw[h][ref]; if (f[a] >= 0.999) pos.push(gap); else if (f[ref] >= 0.999) neg.push(gap); }
      const t = bestThreshold(pos, neg);
      if (t !== null) pairs.push({ a, b: ref, g: t, n: 1 });
    }
    const bias = {}; for (const k of keys) bias[k] = 0;
    for (let it = 0; it < 200; it++) {
      for (const k of keys) {
        if (k === ref) continue;
        let num = 0, den = 0;
        for (const p of pairs) {
          if (p.a === k) { num += p.n * (bias[p.b] + p.g); den += p.n; }
          else if (p.b === k) { num += p.n * (bias[p.a] - p.g); den += p.n; }
        }
        if (den) bias[k] = num / den;
      }
    }
    return bias;
  }
  const calMem = {};
  function calHands(spot) { return H.ALL_HANDS.filter(h => !(spot.prior && spot.prior[h] === 0)); }
  function calRaw(spot, h) {
    const c = fixedCards(h);
    const keep = SAMPLES; SAMPLES = CAL_SAMPLES;
    try { return rawEVs(spot, [E.cid(c[0]), E.cid(c[1])], h); } finally { SAMPLES = keep; }
  }
  function finishCalibration(spot, raw) {
    const bias = fitBias(spot, raw);
    calMem[spot.id] = bias;
    loadCal()[spot.id] = bias; saveCal();
    return bias;
  }
  function calibration(spot) {
    if (calMem[spot.id]) return calMem[spot.id];
    const store = loadCal();
    if (store[spot.id]) { calMem[spot.id] = store[spot.id]; return calMem[spot.id]; }
    const raw = {};
    for (const h of calHands(spot)) raw[h] = calRaw(spot, h);
    return finishCalibration(spot, raw);
  }

  const cache = {};
  /* Returns { evs, modelEvs, gtoEV, loss(chosenKey) } for a dealt hand in a spot.
     modelEvs are the calibrated model's own numbers. evs are made consistent with the equilibrium: every
     action GTO takes with this hand shares the GTO EV (a mixed hand is indifferent), and an action GTO
     never takes is worth at least the minimum loss less than that. */
  function analyze(spot, cards, hand) {
    const key = spot.id + '|' + hand;
    if (cache[key]) return cache[key];
    const heroIds = [E.cid(cards[0]), E.cid(cards[1])];
    const bias = calibration(spot);
    const modelEvs = rawEVs(spot, heroIds, hand);
    for (const k in modelEvs) modelEvs[k] -= (bias[k] || 0);
    const f = spot.strategy[hand];
    let gtoEV = 0;
    for (const a of spot.actions) gtoEV += (f[a.key] || 0) * modelEvs[a.key];
    const floor = 0.05 + 0.02 * spot.pot; // an action GTO never takes is never free
    const evs = {};
    for (const a of spot.actions) evs[a.key] = f[a.key] > 0 ? gtoEV : Math.min(modelEvs[a.key], gtoEV - floor);
    const res = { evs, modelEvs, gtoEV, loss: chosen => (f[chosen] > 0 ? 0 : gtoEV - evs[chosen]) };
    cache[key] = res;
    return res;
  }
  /* Calibrate spots in the background, a few hands at a time, so the UI never blocks. */
  let preQueue = [], preRunning = false;
  function precalibrate(spots) {
    const store = loadCal();
    preQueue = spots.filter(s => !calMem[s.id] && !store[s.id]);
    if (preRunning || !preQueue.length) return;
    preRunning = true;
    let cur = null, raw = null, hands = null, idx = 0;
    const later = fn => setTimeout(fn, 0); // short timed slices keep the page responsive
    const step = () => {
      if (!cur) {
        cur = preQueue.shift();
        if (!cur) { preRunning = false; return; }
        if (calMem[cur.id]) { cur = null; return later(step); }
        raw = {}; hands = calHands(cur); idx = 0;
      }
      const t0 = Date.now();
      while (idx < hands.length && Date.now() - t0 < 20) { const h = hands[idx++]; raw[h] = calRaw(cur, h); }
      if (idx >= hands.length) { finishCalibration(cur, raw); cur = null; }
      later(step);
    };
    later(step);
  }

  root.EV = { analyze, eqr, SAMPLES, calibration, precalibrate, rawEVs, fitBias };
})(typeof window !== 'undefined' ? window : globalThis);
