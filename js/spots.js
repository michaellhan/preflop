/* spots.js — builds every trainable spot for a table size from the range data. */
(function (root) {
  'use strict';
  const H = root.Hands;
  const R = root.RANGES;

  const TABLES = {
    '6max': { key: '6max', name: '6-max', positions: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] },
    '9max': { key: '9max', name: '9-max (full ring)', positions: ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'] },
    'hu':   { key: 'hu', name: 'Heads-up', positions: ['SB', 'BB'], dealer: 'SB' }
  };
  const POSITION_NAMES = {
    'UTG': 'Under the gun', 'UTG+1': 'UTG+1', 'UTG+2': 'UTG+2', 'LJ': 'Lojack', 'HJ': 'Hijack',
    'CO': 'Cutoff', 'BTN': 'Button', 'SB': 'Small blind', 'BB': 'Big blind'
  };
  // 9-max early positions share the 6-max UTG strategies (see About page).
  function classOf(pos) {
    return (pos === 'UTG+1' || pos === 'UTG+2' || pos === 'LJ') ? 'UTG' : pos;
  }
  function openSize(pos) { return pos === 'SB' ? 3 : 2.5; }
  function threeBetSize(threeBettor, openerPos) {
    if (threeBettor === 'BB') return openerPos === 'SB' ? 10 : 11;
    if (threeBettor === 'SB') return 10;
    return 7.5;
  }
  function fourBetSize(threeBet) { return Math.round(threeBet * 2.25); }
  // a cold 4-bet is a little bigger than a 4-bet by the opener: the 3-bettor is often in position
  function cold4BetSize(threeBet) { return Math.round(threeBet * 2.4); }
  // squeeze: about 4x the open plus one open per caller, a bit more out of position
  function squeezeSize(hero) { return (hero === 'SB' || hero === 'BB') ? 12 : 11; }

  const TYPE_META = {
    rfi:    { key: 'rfi',    name: 'Open (RFI)',        short: 'RFI' },
    vsOpen: { key: 'vsOpen', name: 'Facing an open',    short: 'vs Open' },
    vs3bet: { key: 'vs3bet', name: 'Facing a 3-bet',    short: 'vs 3-Bet' },
    cold4:  { key: 'cold4',  name: 'Cold 4-bet',        short: 'Cold 4-Bet' },
    squeeze:{ key: 'squeeze', name: 'Squeeze',          short: 'Squeeze' },
    vsLimp: { key: 'vsLimp', name: 'Limped pot',        short: 'Limp pot' }
  };

  const COLORS = { raise: '#e0524f', raise4: '#b8243c', call: '#4fb35e', fold: '#4a7fc1', check: '#2fa39a', limp: '#2fa39a' };

  const cache = {};
  function strategyFor(spec) {
    const key = JSON.stringify(spec);
    if (!cache[key]) cache[key] = H.buildStrategy(spec);
    return cache[key];
  }

  function lookupVsOpen(heroClass, villainClass) {
    let key = heroClass + '_vs_' + villainClass;
    if (heroClass === 'UTG' && villainClass === 'UTG') key = 'HJ_vs_UTG';
    return { key, data: R.VS_OPEN[key] };
  }
  function lookupVs3bet(openerClass, threeBettorClass) {
    let key = openerClass + '_vs_' + threeBettorClass;
    if (openerClass === 'UTG' && threeBettorClass === 'UTG') key = 'UTG_vs_HJ';
    return { key, data: R.VS_3BET[key] };
  }

  /* Cold 4-bet and squeeze spots have two players ahead of hero, so their ranges are keyed by hero group and
     opener tier rather than by every seat combination (see ranges.js). */
  function multiKey(hero, opener) {
    const g = hero === 'SB' || hero === 'BB' ? hero : 'IP';
    const oc = classOf(opener);
    return g + '_vs_' + (oc === 'UTG' || oc === 'HJ' ? 'EP' : 'LP');
  }
  function potOf(seats) { let p = 0; for (const k in seats) p += seats[k].bet; return p; }

  /* seat status: 'blind' (posted, not yet acted), 'fold', 'raise', 'call', '3bet', 'limp', 'hero', 'waiting' */
  function baseSeats(positions) {
    const seats = {};
    for (const p of positions) seats[p] = { status: 'waiting', bet: 0, label: '' };
    seats.SB = { status: 'blind', bet: 0.5, label: 'SB' };
    seats.BB = { status: 'blind', bet: 1, label: 'BB' };
    return seats;
  }

  function buildSpots(tableKey) {
    const T = TABLES[tableKey];
    const P = T.positions;
    const spots = [];
    const rfiData = tableKey === '6max' ? R.RFI6 : R.RFI9;

    // ---- RFI ----
    for (let i = 0; i < P.length; i++) {
      const hero = P[i];
      if (hero === 'BB') continue;
      const size = openSize(hero);
      const seats = baseSeats(P);
      for (let k = 0; k < i; k++) seats[P[k]] = { status: 'fold', bet: 0, label: 'Fold' };
      seats[hero] = { status: 'hero', bet: hero === 'SB' ? 0.5 : 0, label: hero === 'SB' ? 'SB' : '' };
      const foldedBefore = i;
      spots.push({
        id: tableKey + ':rfi:' + hero,
        table: tableKey, type: 'rfi', hero, villain: null,
        title: hero + ' open',
        description: (foldedBefore === 0 ? 'You are first to act' : 'Everyone folds to you') + ' in the ' + POSITION_NAMES[hero] + '.',
        question: 'Raise to ' + size + 'bb, call, or fold?',
        actions: [
          { key: 'raise', label: 'Raise ' + size + 'bb', color: COLORS.raise },
          { key: 'limp', label: 'Call', color: COLORS.limp },
          { key: 'fold', label: 'Fold', color: COLORS.fold }
        ],
        // no limping range: open-limping is never part of the no-ante solver strategy (see About page)
        strategy: strategyFor({ actions: ['raise', 'limp', 'fold'], raise: rfiData[hero], limp: '' }),
        source: 'RFI ' + tableKey + ' ' + hero,
        seats, pot: 1.5
      });
    }

    // ---- Facing an open ----
    for (let v = 0; v < P.length; v++) {
      const villain = P[v];
      if (villain === 'BB') continue;
      for (let h = v + 1; h < P.length; h++) {
        const hero = P[h];
        const look = lookupVsOpen(classOf(hero), classOf(villain));
        if (!look.data) continue;
        const open = openSize(villain);
        const tb = threeBetSize(hero, villain);
        const seats = baseSeats(P);
        for (let k = 0; k < v; k++) seats[P[k]] = { status: 'fold', bet: 0, label: 'Fold' };
        seats[villain] = { status: 'raise', bet: open, label: 'Raise ' + open };
        for (let k = v + 1; k < h; k++) seats[P[k]] = { status: 'fold', bet: 0, label: 'Fold' };
        seats[hero] = { status: 'hero', bet: hero === 'SB' ? 0.5 : hero === 'BB' ? 1 : 0, label: hero === 'SB' ? 'SB' : hero === 'BB' ? 'BB' : '' };
        let pot = open;
        if (villain !== 'SB' && hero !== 'SB') pot += 0.5;
        if (hero !== 'BB') pot += 1;
        if (hero === 'SB') pot += 0.5;
        if (hero === 'BB') pot += 1;
        spots.push({
          id: tableKey + ':vsOpen:' + hero + ':' + villain,
          table: tableKey, type: 'vsOpen', hero, villain,
          title: hero + ' vs ' + villain + ' open',
          description: POSITION_NAMES[villain] + ' raises to ' + open + 'bb' + (h - v > 1 ? ', everyone else folds to you' : '') + ' in the ' + POSITION_NAMES[hero] + '.',
          question: '3-bet to ' + tb + 'bb, call, or fold?',
          actions: [
            { key: 'raise', label: '3-Bet ' + tb + 'bb', color: COLORS.raise },
            { key: 'call', label: 'Call', color: COLORS.call },
            { key: 'fold', label: 'Fold', color: COLORS.fold }
          ],
          strategy: strategyFor({ actions: ['raise', 'call', 'fold'], raise: look.data.raise, call: look.data.call }),
          source: 'VS_OPEN ' + look.key,
          seats, pot
        });
      }
    }

    // ---- Facing a 3-bet ----
    for (let h = 0; h < P.length; h++) {
      const hero = P[h];
      if (hero === 'BB') continue;
      for (let v = h + 1; v < P.length; v++) {
        const villain = P[v];
        const look = lookupVs3bet(classOf(hero), classOf(villain));
        if (!look.data) continue;
        const openStrat = strategyFor({ actions: ['raise', 'fold'], raise: rfiData[hero] });
        const prior = {};
        for (const hd of H.ALL_HANDS) prior[hd] = openStrat[hd].raise;
        const open = openSize(hero);
        const tb = threeBetSize(villain, hero);
        const fb = fourBetSize(tb);
        const seats = baseSeats(P);
        for (let k = 0; k < h; k++) seats[P[k]] = { status: 'fold', bet: 0, label: 'Fold' };
        seats[hero] = { status: 'hero', bet: open, label: 'Raise ' + open };
        for (let k = h + 1; k < v; k++) seats[P[k]] = { status: 'fold', bet: 0, label: 'Fold' };
        seats[villain] = { status: '3bet', bet: tb, label: '3-Bet ' + tb };
        for (let k = v + 1; k < P.length; k++) seats[P[k]] = { status: 'fold', bet: 0, label: 'Fold' };
        let pot = open + tb;
        if (hero !== 'SB' && villain !== 'SB') pot += 0.5;
        if (villain !== 'BB') pot += 1;
        spots.push({
          id: tableKey + ':vs3bet:' + hero + ':' + villain,
          table: tableKey, type: 'vs3bet', hero, villain,
          title: hero + ' vs ' + villain + ' 3-bet',
          description: 'You raise to ' + open + 'bb from the ' + POSITION_NAMES[hero] + ', the ' + POSITION_NAMES[villain] + ' 3-bets to ' + tb + 'bb, everyone else folds.',
          question: '4-bet to ~' + fb + 'bb, call, or fold?',
          actions: [
            { key: 'raise', label: '4-Bet ' + fb + 'bb', color: COLORS.raise4 },
            { key: 'call', label: 'Call', color: COLORS.call },
            { key: 'fold', label: 'Fold', color: COLORS.fold }
          ],
          strategy: strategyFor({ actions: ['raise', 'call', 'fold'], raise: look.data.raise, call: look.data.call }),
          source: 'VS_3BET ' + look.key,
          prior, // only hands hero actually opened can reach this spot
          seats, pot
        });
      }
    }

    // ---- Cold 4-bet: opener raises, a later player 3-bets, hero (still to act) is behind both ----
    // ---- Squeeze: opener raises, a later player calls, hero is behind both ----
    for (const type of ['cold4', 'squeeze']) {
      const data = type === 'cold4' ? R.COLD_4BET : R.SQUEEZE;
      for (let o = 0; o < P.length; o++) {
        const opener = P[o];
        if (opener === 'BB') continue;
        for (let m = o + 1; m < P.length; m++) {
          const mid = P[m];
          for (let h = m + 1; h < P.length; h++) {
            const hero = P[h];
            const key = multiKey(hero, opener);
            if (!data[key]) continue;
            const open = openSize(opener);
            const seats = baseSeats(P);
            for (let k = 0; k < o; k++) seats[P[k]] = { status: 'fold', bet: 0, label: 'Fold' };
            seats[opener] = { status: 'raise', bet: open, label: 'Raise ' + open };
            for (let k = o + 1; k < m; k++) seats[P[k]] = { status: 'fold', bet: 0, label: 'Fold' };
            let size, desc, actions, title;
            if (type === 'cold4') {
              const tb = threeBetSize(mid, opener);
              size = cold4BetSize(tb);
              seats[mid] = { status: '3bet', bet: tb, label: '3-Bet ' + tb };
              title = hero + ' vs ' + opener + ' open + ' + mid + ' 3-bet';
              desc = POSITION_NAMES[opener] + ' raises to ' + open + 'bb, the ' + POSITION_NAMES[mid] + ' 3-bets to ' + tb + 'bb' + (h - m > 1 ? ', everyone else folds to you' : '') + ' in the ' + POSITION_NAMES[hero] + '.';
              actions = [
                { key: 'raise', label: '4-Bet ' + size + 'bb', color: COLORS.raise4 },
                { key: 'call', label: 'Call', color: COLORS.call },
                { key: 'fold', label: 'Fold', color: COLORS.fold }
              ];
            } else {
              size = squeezeSize(hero);
              seats[mid] = { status: 'call', bet: open, label: 'Call ' + open };
              title = hero + ' vs ' + opener + ' open + ' + mid + ' call';
              desc = POSITION_NAMES[opener] + ' raises to ' + open + 'bb, the ' + POSITION_NAMES[mid] + ' calls' + (h - m > 1 ? ', everyone else folds to you' : '') + ' in the ' + POSITION_NAMES[hero] + '.';
              actions = [
                { key: 'raise', label: 'Squeeze ' + size + 'bb', color: COLORS.raise },
                { key: 'call', label: 'Call', color: COLORS.call },
                { key: 'fold', label: 'Fold', color: COLORS.fold }
              ];
            }
            for (let k = m + 1; k < h; k++) seats[P[k]] = { status: 'fold', bet: 0, label: 'Fold' };
            seats[hero] = { status: 'hero', bet: hero === 'SB' ? 0.5 : hero === 'BB' ? 1 : 0, label: hero === 'SB' ? 'SB' : hero === 'BB' ? 'BB' : '' };
            spots.push({
              id: tableKey + ':' + type + ':' + hero + ':' + opener + ':' + mid,
              table: tableKey, type, hero, villain: mid, opener,
              title,
              description: desc,
              question: (type === 'cold4' ? '4-bet to ' + size + 'bb' : 'Squeeze to ' + size + 'bb') + ', call, or fold?',
              actions,
              strategy: strategyFor({ actions: ['raise', 'call', 'fold'], raise: data[key].raise, call: data[key].call }),
              source: (type === 'cold4' ? 'COLD_4BET ' : 'SQUEEZE ') + key,
              seats, pot: potOf(seats)
            });
          }
        }
      }
    }

    // ---- BB vs SB limp ----
    {
      const seats = baseSeats(P);
      for (const p of P) if (p !== 'SB' && p !== 'BB') seats[p] = { status: 'fold', bet: 0, label: 'Fold' };
      seats.SB = { status: 'limp', bet: 1, label: 'Limp 1' };
      seats.BB = { status: 'hero', bet: 1, label: 'BB' };
      spots.push({
        id: tableKey + ':vsLimp:BB:SB',
        table: tableKey, type: 'vsLimp', hero: 'BB', villain: 'SB',
        title: 'BB vs SB limp',
        description: 'Everyone folds, the small blind limps in. You are in the big blind with the option.',
        question: 'Raise to 4bb (isolate) or check?',
        actions: [
          { key: 'raise', label: 'Raise 4bb', color: COLORS.raise },
          { key: 'check', label: 'Check', color: COLORS.check }
        ],
        strategy: strategyFor({ actions: ['raise', 'check'], raise: R.VS_LIMP.BB_vs_SB.raise }),
        source: 'VS_LIMP BB_vs_SB',
        seats, pot: 2
      });
    }
    return spots;
  }

  /* Heads-up: the SB is the button and acts last postflop. */
  function buildHUSpots() {
    const HU = R.HU, table = 'hu';
    const spots = [];
    const openStrat = strategyFor({ actions: ['raise', 'limp', 'fold'], raise: HU.SB_OPEN.raise, limp: HU.SB_OPEN.limp });
    const raisePrior = {}, limpPrior = {};
    for (const h of H.ALL_HANDS) { raisePrior[h] = openStrat[h].raise; limpPrior[h] = openStrat[h].limp; }
    spots.push({
      id: 'hu:rfi:SB', table, type: 'rfi', hero: 'SB', villain: null,
      title: 'SB open (heads-up)',
      description: 'Heads-up: you are the small blind and the button, first to act preflop but in position after the flop.',
      question: 'Raise to 2.5bb, call, or fold?',
      actions: [
        { key: 'raise', label: 'Raise 2.5bb', color: COLORS.raise },
        { key: 'limp', label: 'Call', color: COLORS.limp },
        { key: 'fold', label: 'Fold', color: COLORS.fold }
      ],
      strategy: openStrat, source: 'HU SB_OPEN',
      seats: { SB: { status: 'hero', bet: 0.5, label: 'SB' }, BB: { status: 'blind', bet: 1, label: 'BB' } }, pot: 1.5
    });
    spots.push({
      id: 'hu:vsOpen:BB:SB', table, type: 'vsOpen', hero: 'BB', villain: 'SB',
      title: 'BB vs SB open (heads-up)',
      description: 'Heads-up: the small blind (button) raises to 2.5bb. You are the big blind, out of position for the rest of the hand.',
      question: '3-bet to 10bb, call, or fold?',
      actions: [
        { key: 'raise', label: '3-Bet 10bb', color: COLORS.raise },
        { key: 'call', label: 'Call', color: COLORS.call },
        { key: 'fold', label: 'Fold', color: COLORS.fold }
      ],
      strategy: strategyFor({ actions: ['raise', 'call', 'fold'], raise: HU.BB_vs_SB.raise, call: HU.BB_vs_SB.call }), source: 'HU BB_vs_SB',
      seats: { SB: { status: 'raise', bet: 2.5, label: 'Raise 2.5' }, BB: { status: 'hero', bet: 1, label: 'BB' } }, pot: 3.5
    });
    spots.push({
      id: 'hu:vs3bet:SB:BB', table, type: 'vs3bet', hero: 'SB', villain: 'BB',
      title: 'SB vs BB 3-bet (heads-up)',
      description: 'Heads-up: you raise to 2.5bb from the small blind (button) and the big blind 3-bets to 10bb.',
      question: '4-bet to ~22bb, call, or fold?',
      actions: [
        { key: 'raise', label: '4-Bet 22bb', color: COLORS.raise4 },
        { key: 'call', label: 'Call', color: COLORS.call },
        { key: 'fold', label: 'Fold', color: COLORS.fold }
      ],
      strategy: strategyFor({ actions: ['raise', 'call', 'fold'], raise: HU.SB_vs_BB_3BET.raise, call: HU.SB_vs_BB_3BET.call }), source: 'HU SB_vs_BB_3BET',
      prior: raisePrior,
      seats: { SB: { status: 'hero', bet: 2.5, label: 'Raise 2.5' }, BB: { status: '3bet', bet: 10, label: '3-Bet 10' } }, pot: 12.5
    });
    spots.push({
      id: 'hu:vsLimp:BB:SB', table, type: 'vsLimp', hero: 'BB', villain: 'SB',
      title: 'BB vs SB limp (heads-up)',
      description: 'Heads-up: the small blind (button) limps. You are the big blind with the option.',
      question: 'Raise to 4bb or check?',
      actions: [
        { key: 'raise', label: 'Raise 4bb', color: COLORS.raise },
        { key: 'check', label: 'Check', color: COLORS.check }
      ],
      strategy: strategyFor({ actions: ['raise', 'check'], raise: HU.BB_vs_LIMP.raise }), source: 'HU BB_vs_LIMP',
      seats: { SB: { status: 'limp', bet: 1, label: 'Limp 1' }, BB: { status: 'hero', bet: 1, label: 'BB' } }, pot: 2
    });
    spots.push({
      id: 'hu:vsLimp:SB:BB', table, type: 'vsLimp', hero: 'SB', villain: 'BB',
      title: 'SB vs BB raise after limp (heads-up)',
      description: 'Heads-up: you limp from the small blind (button) and the big blind raises to 4bb.',
      question: '3-bet to 12bb, call, or fold?',
      actions: [
        { key: 'raise', label: '3-Bet 12bb', color: COLORS.raise },
        { key: 'call', label: 'Call', color: COLORS.call },
        { key: 'fold', label: 'Fold', color: COLORS.fold }
      ],
      strategy: strategyFor({ actions: ['raise', 'call', 'fold'], raise: HU.SB_vs_ISO.raise, call: HU.SB_vs_ISO.call }), source: 'HU SB_vs_ISO',
      prior: limpPrior,
      seats: { SB: { status: 'hero', bet: 1, label: 'Limp 1' }, BB: { status: 'raise', bet: 4, label: 'Raise 4' } }, pot: 5
    });
    return spots;
  }

  const spotCache = {};
  function getSpots(tableKey) {
    if (!spotCache[tableKey]) spotCache[tableKey] = tableKey === 'hu' ? buildHUSpots() : buildSpots(tableKey);
    return spotCache[tableKey];
  }

  root.Spots = { TABLES, POSITION_NAMES, TYPE_META, COLORS, classOf, getSpots, openSize, threeBetSize, cold4BetSize, squeezeSize };
})(typeof window !== 'undefined' ? window : globalThis);
