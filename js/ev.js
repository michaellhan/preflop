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
    let limpR = SB_LIMP, callR, threeR;
    const isoSpot = findSpot(table, 'vsLimp', 'SB', 'BB');
    if (isoSpot) { // real limping range and responses (heads-up)
      limpR = weightsOf(findSpot(table, 'rfi', 'SB', null).strategy, 'limp');
      callR = weightsOf(isoSpot.strategy, 'call', isoSpot.prior); threeR = weightsOf(isoSpot.strategy, 'raise', isoSpot.prior);
    } else { callR = scale(SB_LIMP, SB_CALL_ISO); threeR = scale(SB_LIMP, SB_3BET_ISO); }
    const evCheck = eqr(table, 'BB', 'SB', false, hand, 1) * E.equity(heroIds, limpR, SAMPLES, seed) * 2 - 1;
    const mAll = mass(limpR, heroIds) || 1e-9;
    const pC = mass(callR, heroIds) / mAll, pR = mass(threeR, heroIds) / mAll, pF = Math.max(0, 1 - pC - pR);
    const evCallV = eqr(table, 'BB', 'SB', true, hand, 1) * E.equity(heroIds, callR, SAMPLES, seed + 1) * 8 - 4;
    const evRaiseV = pR > 0 ? Math.max(-4, eqr(table, 'BB', 'SB', false, hand, 2) * E.equity(heroIds, threeR, SAMPLES, seed + 2) * 24 - 12) : 0;
    return { raise: pF * 1 + pC * evCallV + pR * evRaiseV, check: evCheck };
  }

  /* Heads-up SB first in: raise / limp / fold. */
  function evHUOpen(spot, heroIds, hand) {
    const table = 'hu', seed = seedOf(spot.id + hand);
    const vsOpen = findSpot(table, 'vsOpen', 'BB', 'SB'), vsLimp = findSpot(table, 'vsLimp', 'BB', 'SB'), iso = findSpot(table, 'vsLimp', 'SB', 'BB'), my3 = findSpot(table, 'vs3bet', 'SB', 'BB');
    // raise 2.5
    const callR = weightsOf(vsOpen.strategy, 'call'), threeR = weightsOf(vsOpen.strategy, 'raise');
    const pc = mass(callR, heroIds) / RANDOM_MASS, pr = mass(threeR, heroIds) / RANDOM_MASS;
    let evRaise = (1 - pc - pr) * 1;
    evRaise += pc * (eqr(table, 'SB', 'BB', true, hand, 1) * E.equity(heroIds, callR, SAMPLES, seed) * 5 - 2.5);
    if (pr > 0) {
      const T = 10;
      const evFold = -2.5;
      const evCall = eqr(table, 'SB', 'BB', false, hand, 2) * E.equity(heroIds, threeR, SAMPLES, seed + 1) * 20 - T;
      const ev4 = fourBetEV(table, 'SB', 'BB', heroIds, hand, T, threeR, 0, seed + 2);
      const f = my3.strategy[hand];
      evRaise += pr * (f.raise * ev4 + f.call * evCall + f.fold * evFold);
    }
    // limp 1
    const isoR = weightsOf(vsLimp.strategy, 'raise');
    const pIso = mass(isoR, heroIds) / RANDOM_MASS;
    const checkR = weightsOf(vsLimp.strategy, 'check');
    let evLimp = (1 - pIso) * (eqr(table, 'SB', 'BB', false, hand, 1) * E.equity(heroIds, checkR, SAMPLES, seed + 3) * 2 - 1);
    if (pIso > 0) {
      const evFoldI = -1;
      const evCallI = eqr(table, 'SB', 'BB', false, hand, 1) * E.equity(heroIds, isoR, SAMPLES, seed + 4) * 8 - 4;
      // re-raise to 12: BB folds ~50%, calls ~40%, jams ~10%
      const ev3I = 0.5 * 4 + 0.4 * (eqr(table, 'SB', 'BB', true, hand, 2) * E.equity(heroIds, isoR, SAMPLES, seed + 5) * 24 - 12) + 0.1 * (-12);
      const f = iso.strategy[hand];
      evLimp += pIso * (f.raise * ev3I + f.call * evCallI + f.fold * evFoldI);
    }
    return { raise: evRaise, limp: evLimp, fold: -0.5 };
  }

  /* Heads-up SB, having limped, facing the BB's raise to 4bb. */
  function evHUIso(spot, heroIds, hand) {
    const table = 'hu', seed = seedOf(spot.id + hand);
    const vsLimp = findSpot(table, 'vsLimp', 'BB', 'SB');
    const isoR = weightsOf(vsLimp.strategy, 'raise');
    const evCall = eqr(table, 'SB', 'BB', false, hand, 1) * E.equity(heroIds, isoR, SAMPLES, seed) * 8 - 4;
    const evRaise = 0.5 * 4 + 0.4 * (eqr(table, 'SB', 'BB', true, hand, 2) * E.equity(heroIds, isoR, SAMPLES, seed + 1) * 24 - 12) + 0.1 * Math.max(-12, E.equity(heroIds, scale(isoR, JAM_VS_4BET), SAMPLES, seed + 2) * 200 - 100);
    return { raise: evRaise, call: evCall, fold: -1 };
  }

  function rawEVs(spot, heroIds, hand) {
    if (spot.table === 'hu' && spot.type === 'rfi') return evHUOpen(spot, heroIds, hand);
    if (spot.table === 'hu' && spot.type === 'vsLimp' && spot.hero === 'SB') return evHUIso(spot, heroIds, hand);
    if (spot.type === 'rfi') return evRFI(spot, heroIds, hand);
    if (spot.type === 'vsOpen') return evVsOpen(spot, heroIds, hand);
    if (spot.type === 'vs3bet') return evVs3bet(spot, heroIds, hand);
    return evVsLimp(spot, heroIds, hand);
  }

  /* ---------- per-spot calibration ----------
     The raw model has systematic biases (e.g. it can overrate 4-bets in one spot). For each spot we
     compute raw EVs for every hand once, then shift each action's EV by a constant so that the model's
     ordering agrees with GTO on the hands GTO plays purely. Actions are calibrated in a chain against the
     previous one (fold -> call -> raise), picking the shift that best separates "purely this action" hands
     from "purely the previous action" hands. */
  const CAL_KEY = 'preflop-lab-evcal-v1';
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
    if (!pos.length || !neg.length) return 0;
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
  const calMem = {};
  function calHands(spot) { return H.ALL_HANDS.filter(h => !(spot.prior && spot.prior[h] === 0)); }
  function calRaw(spot, h) {
    const c = fixedCards(h);
    const keep = SAMPLES; SAMPLES = CAL_SAMPLES;
    try { return rawEVs(spot, [E.cid(c[0]), E.cid(c[1])], h); } finally { SAMPLES = keep; }
  }
  function finishCalibration(spot, raw) {
    const keys = spot.actions.map(a => a.key);
    const bias = {};
    bias[keys[keys.length - 1]] = 0; // residual action (fold/check) is the reference
    for (let i = keys.length - 2; i >= 0; i--) {
      const a = keys[i], prev = keys[i + 1];
      const pos = [], neg = [];
      for (const h in raw) {
        const f = spot.strategy[h];
        const gap = (raw[h][a]) - (raw[h][prev] - bias[prev]);
        if (f[a] >= 0.999) pos.push(gap);
        else if (f[prev] >= 0.999) neg.push(gap);
      }
      bias[a] = bestThreshold(pos, neg);
    }
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
  /* Returns { evs: {action: bb}, gtoEV, loss(chosenKey) } for a dealt hand in a spot. */
  function analyze(spot, cards, hand) {
    const key = spot.id + '|' + hand;
    if (cache[key]) return cache[key];
    const heroIds = [E.cid(cards[0]), E.cid(cards[1])];
    const bias = calibration(spot);
    const evs = rawEVs(spot, heroIds, hand);
    for (const k in evs) evs[k] -= (bias[k] || 0);
    const f = spot.strategy[hand];
    let gtoEV = 0;
    for (const a of spot.actions) gtoEV += (f[a.key] || 0) * evs[a.key];
    const floor = 0.05 + 0.02 * spot.pot; // an action GTO never takes is never free
    const res = {
      evs, gtoEV,
      loss: chosen => (f[chosen] > 0 ? 0 : Math.max(floor, gtoEV - evs[chosen]))
    };
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

  root.EV = { analyze, eqr, SAMPLES, calibration, precalibrate };
})(typeof window !== 'undefined' ? window : globalThis);
