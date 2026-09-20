/* ev.js — approximate preflop EV model used to estimate EV loss.
   All EVs are absolute (change in hero's stack from before blinds were posted), in bb.
   Fold therefore equals minus whatever hero already put in.
   Model:
     EV(raise) = P(fold) * pot_won  +  P(call) * (EQR * equity * final_pot - invested)  +  P(re-raise) * EV(vs re-raise)
     EV(call)  = EQR * equity * final_pot - invested   (with a squeeze penalty when players remain behind)
   Equity = Monte Carlo vs the villain's actual range from ranges.js (with card removal).
   EQR (equity realization) depends on position and initiative (see About page). */
(function (root) {
  'use strict';
  const H = root.Hands, S = root.Spots, E = root.Equity;
  const SAMPLES = 1200;

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

  function postIdx(table, pos) { if (pos === 'SB') return 0; if (pos === 'BB') return 1; return 2 + S.TABLES[table].positions.indexOf(pos); }
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
    e *= handMod(hand);
    if (!isStrong(hand)) { if (level === 2) e *= 0.88; else if (level === 3) e *= 0.8; }
    return e;
  }
  function seedOf(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // how a 3-bettor responds to a 4-bet (approximate, applied on top of their 3-bet range)
  const JAM_VS_4BET = { AA: 1, KK: 1, QQ: 0.5, JJ: 0.15, AKs: 0.9, AKo: 0.6, AQs: 0.1, A5s: 0.35, A4s: 0.3, A3s: 0.2, A2s: 0.15, KQs: 0.1 };
  const CALL_VS_4BET = { QQ: 0.5, JJ: 0.7, TT: 0.7, '99': 0.5, '88': 0.3, '77': 0.15, AQs: 0.8, AQo: 0.4, AJs: 0.7, ATs: 0.4, A9s: 0.2, KQs: 0.6, KJs: 0.4, KTs: 0.2, QJs: 0.3, JTs: 0.3, T9s: 0.2,
    '98s': 0.1, '87s': 0.1, '76s': 0.1, '65s': 0.1, A5s: 0.3, A4s: 0.3, A3s: 0.2, A2s: 0.2, AJo: 0.15, KQo: 0.25 };
  // how a 4-bettor responds to a 5-bet jam
  const CALL_JAM = { AA: 1, KK: 1, QQ: 1, AKs: 1, AKo: 1, JJ: 0.5, AQs: 0.3 };
  // synthetic SB limping range and responses (the SB limp spot has no solver data of its own)
  const SB_LIMP = H.parseRange("AA:0.15, KK:0.15, AKs:0.1, 22-88, A2s-A9s:0.6, K2s-K9s:0.7, Q4s-QTs:0.7, J6s-JTs:0.7, T6s-T9s:0.7, 96s-98s:0.7, 85s-87s:0.7, 74s-76s:0.7, 64s-65s:0.7, 53s-54s:0.7, 43s:0.6, A2o-A9o:0.7, K7o-KTo:0.7, Q8o-QTo:0.7, J8o-JTo:0.7, T8o-T9o:0.7, 98o:0.7, 87o:0.6, 76o:0.5, 65o:0.4");
  const SB_CALL_ISO = {}; const SB_3BET_ISO = {};
  for (const h in SB_LIMP) { const hi = RV[h[0]], lo = RV[h[1]]; SB_CALL_ISO[h] = (h.length === 2 || h[2] === 's' || hi === 14 || lo >= 9) ? 0.85 : 0.35; }
  Object.assign(SB_3BET_ISO, { AA: 1, KK: 1, AKs: 1, A5s: 0.3, A4s: 0.3, A9o: 0.1, A8o: 0.1 });
  for (const h in SB_3BET_ISO) SB_CALL_ISO[h] = Math.max(0, (SB_CALL_ISO[h] || 0) - SB_3BET_ISO[h]);

  /* Hero (last aggressor, invested R before) 4-bets to F vs villain who 3-bet to T with range threeRange. */
  function fourBetEV(table, hero, villain, heroIds, hand, T, threeRange, dead, seed) {
    const F = Math.round(T * 2.25);
    const jamR = scale(threeRange, JAM_VS_4BET), callR = scale(threeRange, CALL_VS_4BET);
    const mAll = mass(threeRange, heroIds) || 1e-9, mJam = mass(jamR, heroIds), mCall = mass(callR, heroIds);
    const pJam = mJam / mAll, pCall = mCall / mAll, pFold = Math.max(0, 1 - pJam - pCall);
    const evFold = T + dead;
    const evCall = mCall > 0 ? eqr(table, hero, villain, true, hand, 3) * E.equity(heroIds, callR, SAMPLES, seed) * (2 * F + dead) - F : 0;
    const evJam = mJam > 0 ? Math.max(-F, E.equity(heroIds, jamR, SAMPLES, seed + 1) * (200 + dead) - 100) : 0;
    return pFold * evFold + pCall * evCall + pJam * evJam;
  }

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
        ev += pNone * pc * (eqr(table, hero, b, true, hand, 1) * eq * (2 * R + dead) - R);
      }
      if (pr > 0) {
        const T = S.threeBetSize(b, hero);
        const eq3 = E.equity(heroIds, threeR, SAMPLES, seed + k++);
        const evFold = -R;
        const evCall = eqr(table, hero, b, false, hand, 2) * eq3 * (2 * T + dead) - T;
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
    const evCall = (1 - q) * (eqr(table, hero, V, false, hand, 1) * eqO * (2 * O + dead) - O) + q * (-O);
    // 3-bet
    const T = S.threeBetSize(hero, V);
    const resp = findSpot(table, 'vs3bet', V, hero);
    const prior = resp.prior;
    const foldR = weightsOf(resp.strategy, 'fold', prior), callR = weightsOf(resp.strategy, 'call', prior), fourR = weightsOf(resp.strategy, 'raise', prior);
    const mAll = mass(prior, heroIds) || 1e-9;
    const pF = mass(foldR, heroIds) / mAll, pC = mass(callR, heroIds) / mAll, pR = mass(fourR, heroIds) / mAll;
    const evFoldV = O + dead;
    const evCallV = pC > 0 ? eqr(table, hero, V, true, hand, 2) * E.equity(heroIds, callR, SAMPLES, seed + 1) * (2 * T + dead) - T : 0;
    let ev4 = 0;
    if (pR > 0) {
      const F = Math.round(T * 2.25);
      const jamCall = scale(fourR, CALL_JAM);
      const pCallJam = mass(jamCall, heroIds) / (mass(fourR, heroIds) || 1e-9);
      const evJam = (1 - pCallJam) * (F + dead) + (pCallJam > 0 ? pCallJam * (E.equity(heroIds, jamCall, SAMPLES, seed + 2) * (200 + dead) - 100) : 0);
      const evCall4 = eqr(table, hero, V, false, hand, 3) * E.equity(heroIds, fourR, SAMPLES, seed + 3) * (2 * F + dead) - F;
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
    const evCall = eqr(table, hero, V, false, hand, 2) * eq * (2 * T + dead) - T;
    const evRaise = fourBetEV(table, hero, V, heroIds, hand, T, threeR, dead, seed + 1);
    return { raise: evRaise, call: evCall, fold: -R };
  }

  function evVsLimp(spot, heroIds, hand) {
    const table = spot.table;
    const seed = seedOf(spot.id + hand);
    const evCheck = eqr(table, 'BB', 'SB', false, hand, 1) * E.equity(heroIds, SB_LIMP, SAMPLES, seed) * 2 - 1;
    const callR = scale(SB_LIMP, SB_CALL_ISO), threeR = scale(SB_LIMP, SB_3BET_ISO);
    const mAll = mass(SB_LIMP, heroIds) || 1e-9;
    const pC = mass(callR, heroIds) / mAll, pR = mass(threeR, heroIds) / mAll, pF = Math.max(0, 1 - pC - pR);
    const evCallV = eqr(table, 'BB', 'SB', true, hand, 1) * E.equity(heroIds, callR, SAMPLES, seed + 1) * 8 - 4;
    const evRaiseV = pR > 0 ? Math.max(-4, E.equity(heroIds, threeR, SAMPLES, seed + 2) * 200 - 100) : 0;
    return { raise: pF * 1 + pC * evCallV + pR * evRaiseV, check: evCheck };
  }

  const cache = {};
  /* Returns { evs: {action: bb}, gtoEV, loss(chosenKey) } for a dealt hand in a spot. */
  function analyze(spot, cards, hand) {
    const key = spot.id + '|' + hand;
    if (cache[key]) return cache[key];
    const heroIds = [E.cid(cards[0]), E.cid(cards[1])];
    let evs;
    if (spot.type === 'rfi') evs = evRFI(spot, heroIds, hand);
    else if (spot.type === 'vsOpen') evs = evVsOpen(spot, heroIds, hand);
    else if (spot.type === 'vs3bet') evs = evVs3bet(spot, heroIds, hand);
    else evs = evVsLimp(spot, heroIds, hand);
    const f = spot.strategy[hand];
    let gtoEV = 0;
    for (const a of spot.actions) gtoEV += (f[a.key] || 0) * evs[a.key];
    const res = {
      evs, gtoEV,
      loss: chosen => (f[chosen] > 0 ? 0 : Math.max(0, gtoEV - evs[chosen]))
    };
    cache[key] = res;
    return res;
  }

  root.EV = { analyze, eqr, SAMPLES };
})(typeof window !== 'undefined' ? window : globalThis);
