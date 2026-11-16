/* spots.js — builds every trainable spot for a table size from the range data. */
(function (root) {
  'use strict';
  const H = root.Hands;
  const R = root.RANGES;

  /* Ring tables of 3-9 players. A seat with the same number of players left to act faces the same decision at
     any table size, so every seat maps to the 9-max seat with that many players behind it (canon): 6-max UTG plays
     like 9-max LJ, 8-max UTG like 9-max UTG+1, 3-max BTN like the 9-max BTN after everyone else folds. Spots are
     built on the canonical seats and shown with each table's own seat names. */
  const NINE = ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  function ring(n, name, positions) { return { key: n + 'max', name, short: n + '-max', positions, canon: NINE.slice(9 - n) }; }
  const TABLES = {
    'hu':   { key: 'hu', name: 'Heads-up', short: 'HU', positions: ['SB', 'BB'], dealer: 'SB' },
    '3max': ring(3, '3-max', ['BTN', 'SB', 'BB']),
    '4max': ring(4, '4-max', ['CO', 'BTN', 'SB', 'BB']),
    '5max': ring(5, '5-max', ['HJ', 'CO', 'BTN', 'SB', 'BB']),
    '6max': ring(6, '6-max', ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']),
    '7max': ring(7, '7-max', ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']),
    '8max': ring(8, '8-max', ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']),
    '9max': ring(9, '9-max (full ring)', NINE.slice())
  };
  const POSITION_NAMES = {
    'UTG': 'Under the gun', 'UTG+1': 'UTG+1', 'UTG+2': 'UTG+2', 'LJ': 'Lojack', 'HJ': 'Hijack',
    'CO': 'Cutoff', 'BTN': 'Button', 'SB': 'Small blind', 'BB': 'Big blind'
  };
  // 9-max early positions share the 6-max UTG strategies. pos is a canonical (9-max) seat.
  function classOf(pos) {
    return (pos === 'UTG+1' || pos === 'UTG+2' || pos === 'LJ') ? 'UTG' : pos;
  }
  /* Opener tier for the vs-open / vs-3-bet charts. 9-max UTG..UTG+2 open far tighter than 6-max UTG, so their
     opponents use the *_vs_EP9 charts and they answer a 3-bet with the EP9_* charts. */
  function openerClass(pos) {
    return pos === 'UTG' || pos === 'UTG+1' || pos === 'UTG+2' ? 'EP9' : classOf(pos);
  }
  /* Sizes follow the reference solution the ranges were checked against. */
  function openSize(pos) { return 2.5; }
  function threeBetSize(threeBettor, openerPos) {
    if (threeBettor === 'BB') return openerPos === 'SB' ? 7.5 : 12.5;
    if (threeBettor === 'SB') return 11.5;
    return 7.5;
  }
  // 4-bets: ~23bb over an in-position 7.5bb 3-bet, ~25bb over a blind 3-bet
  function fourBetSize(threeBet) { return threeBet <= 7.5 ? 23 : 25; }
  // cold 4-bet: 17bb in position, larger from the blinds (out of position against two players)
  function cold4BetSize(threeBet, hero) {
    if (hero === 'SB') return 23;
    if (hero === 'BB') return threeBet <= 7.5 ? 21 : 25;
    return 17;
  }
  // squeeze over an open and a call: small in position, much larger from the blinds (a little smaller over a SB caller)
  function squeezeSize(hero, opener, mid) {
    if (hero === 'BB') return mid === 'SB' ? 17 : 18;
    if (hero === 'SB') return 16;
    return 9.5;
  }
  const ISO_SIZE = 3, ISO_3BET_SIZE = 15; // BB raises a SB limp to 3bb; the SB re-raises to 15bb

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
    if (heroClass === 'UTG' && villainClass === 'EP9') key = 'HJ_vs_EP9';
    return { key, data: R.VS_OPEN[key] };
  }
  function lookupVs3bet(openerClass, threeBettorClass) {
    let key = openerClass + '_vs_' + threeBettorClass;
    if ((openerClass === 'UTG' || openerClass === 'EP9') && threeBettorClass === 'UTG') key = openerClass + '_vs_HJ';
    return { key, data: R.VS_3BET[key] };
  }

  /* Cold 4-bet and squeeze spots have two players ahead of hero. Every 6-max seat combination has its own chart
     (hero_vs_opener_mid); 9-max combinations with no 6-max equivalent (e.g. two early seats) fall back to charts
     keyed by hero group and opener tier. */
  function multiKey(data, hero, opener, mid) {
    const exact = classOf(hero) + '_vs_' + classOf(opener) + '_' + classOf(mid);
    if (data[exact] && classOf(opener) !== classOf(mid) && classOf(mid) !== classOf(hero)) return exact;
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
    const P = T.canon; // spots are built on canonical 9-max seats ...
    const nm = p => T.positions[P.indexOf(p)]; // ... and shown with this table's seat names
    const full = p => POSITION_NAMES[nm(p)];
    const spots = [];
    const rfiData = R.RFI9;
    function add(spot) {
      const seats = {};
      for (const p in spot.seats) seats[nm(p)] = spot.seats[p];
      spot.canon = { hero: spot.hero, villain: spot.villain, opener: spot.opener || null };
      spot.hero = nm(spot.hero);
      if (spot.villain) spot.villain = nm(spot.villain);
      if (spot.opener) spot.opener = nm(spot.opener);
      spot.seats = seats;
      spots.push(spot);
    }

    // ---- RFI ----
    for (let i = 0; i < P.length; i++) {
      const hero = P[i];
      if (hero === 'BB') continue;
      const size = openSize(hero);
      const seats = baseSeats(P);
      for (let k = 0; k < i; k++) seats[P[k]] = { status: 'fold', bet: 0, label: 'Fold' };
      seats[hero] = { status: 'hero', bet: hero === 'SB' ? 0.5 : 0, label: hero === 'SB' ? 'SB' : '' };
      const foldedBefore = i;
      add({
        id: tableKey + ':rfi:' + nm(hero),
        table: tableKey, type: 'rfi', hero, villain: null,
        title: nm(hero) + ' open',
        description: (foldedBefore === 0 ? 'You are first to act' : 'Everyone folds to you') + ' in the ' + full(hero) + '.',
        question: 'Raise to ' + size + 'bb, ' + (hero === 'SB' ? 'limp' : 'call') + ', or fold?',
        actions: [
          { key: 'raise', label: 'Raise ' + size + 'bb', color: COLORS.raise },
          { key: 'limp', label: hero === 'SB' ? 'Limp' : 'Call', color: COLORS.limp },
          { key: 'fold', label: 'Fold', color: COLORS.fold }
        ],
        // only the SB has a limping range; open-limping from UTG..BTN is never part of the solver strategy
        strategy: strategyFor({ actions: ['raise', 'limp', 'fold'], raise: rfiData[hero], limp: rfiData[hero + '_LIMP'] || '' }),
        source: 'RFI9 ' + hero,
        seats, pot: 1.5
      });
    }

    // ---- Facing an open ----
    for (let v = 0; v < P.length; v++) {
      const villain = P[v];
      if (villain === 'BB') continue;
      for (let h = v + 1; h < P.length; h++) {
        const hero = P[h];
        const look = lookupVsOpen(classOf(hero), openerClass(villain));
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
        add({
          id: tableKey + ':vsOpen:' + nm(hero) + ':' + nm(villain),
          table: tableKey, type: 'vsOpen', hero, villain,
          title: nm(hero) + ' vs ' + nm(villain) + ' open',
          description: full(villain) + ' raises to ' + open + 'bb' + (h - v > 1 ? ', everyone else folds to you' : '') + ' in the ' + full(hero) + '.',
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
        const look = lookupVs3bet(openerClass(hero), classOf(villain));
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
        add({
          id: tableKey + ':vs3bet:' + nm(hero) + ':' + nm(villain),
          table: tableKey, type: 'vs3bet', hero, villain,
          title: nm(hero) + ' vs ' + nm(villain) + ' 3-bet',
          description: 'You raise to ' + open + 'bb from the ' + full(hero) + ', the ' + full(villain) + ' 3-bets to ' + tb + 'bb, everyone else folds.',
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
            const key = multiKey(data, hero, opener, mid);
            if (!data[key]) continue;
            const open = openSize(opener);
            const seats = baseSeats(P);
            for (let k = 0; k < o; k++) seats[P[k]] = { status: 'fold', bet: 0, label: 'Fold' };
            seats[opener] = { status: 'raise', bet: open, label: 'Raise ' + open };
            for (let k = o + 1; k < m; k++) seats[P[k]] = { status: 'fold', bet: 0, label: 'Fold' };
            let size, desc, actions, title;
            if (type === 'cold4') {
              const tb = threeBetSize(mid, opener);
              size = cold4BetSize(tb, hero);
              seats[mid] = { status: '3bet', bet: tb, label: '3-Bet ' + tb };
              title = nm(hero) + ' vs ' + nm(opener) + ' open + ' + nm(mid) + ' 3-bet';
              desc = full(opener) + ' raises to ' + open + 'bb, the ' + full(mid) + ' 3-bets to ' + tb + 'bb' + (h - m > 1 ? ', everyone else folds to you' : '') + ' in the ' + full(hero) + '.';
              actions = [
                { key: 'raise', label: '4-Bet ' + size + 'bb', color: COLORS.raise4 },
                { key: 'call', label: 'Call', color: COLORS.call },
                { key: 'fold', label: 'Fold', color: COLORS.fold }
              ];
            } else {
              size = squeezeSize(hero, opener, mid);
              seats[mid] = { status: 'call', bet: open, label: 'Call ' + open };
              title = nm(hero) + ' vs ' + nm(opener) + ' open + ' + nm(mid) + ' call';
              desc = full(opener) + ' raises to ' + open + 'bb, the ' + full(mid) + ' calls' + (h - m > 1 ? ', everyone else folds to you' : '') + ' in the ' + full(hero) + '.';
              actions = [
                { key: 'raise', label: 'Squeeze ' + size + 'bb', color: COLORS.raise },
                { key: 'call', label: 'Call', color: COLORS.call },
                { key: 'fold', label: 'Fold', color: COLORS.fold }
              ];
            }
            for (let k = m + 1; k < h; k++) seats[P[k]] = { status: 'fold', bet: 0, label: 'Fold' };
            seats[hero] = { status: 'hero', bet: hero === 'SB' ? 0.5 : hero === 'BB' ? 1 : 0, label: hero === 'SB' ? 'SB' : hero === 'BB' ? 'BB' : '' };
            add({
              id: tableKey + ':' + type + ':' + nm(hero) + ':' + nm(opener) + ':' + nm(mid),
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

    // ---- BB vs SB limp, and the SB facing the BB's raise after limping ----
    {
      const seats = baseSeats(P);
      for (const p of P) if (p !== 'SB' && p !== 'BB') seats[p] = { status: 'fold', bet: 0, label: 'Fold' };
      seats.SB = { status: 'limp', bet: 1, label: 'Limp 1' };
      seats.BB = { status: 'hero', bet: 1, label: 'BB' };
      add({
        id: tableKey + ':vsLimp:BB:SB',
        table: tableKey, type: 'vsLimp', hero: 'BB', villain: 'SB',
        title: 'BB vs SB limp',
        description: 'Everyone folds, the small blind limps in. You are in the big blind with the option.',
        question: 'Raise to ' + ISO_SIZE + 'bb (isolate) or check?',
        actions: [
          { key: 'raise', label: 'Raise ' + ISO_SIZE + 'bb', color: COLORS.raise },
          { key: 'check', label: 'Check', color: COLORS.check }
        ],
        strategy: strategyFor({ actions: ['raise', 'check'], raise: R.VS_LIMP.BB_vs_SB.raise }),
        source: 'VS_LIMP BB_vs_SB',
        seats, pot: 2
      });
    }
    {
      const limpStrat = strategyFor({ actions: ['raise', 'limp', 'fold'], raise: rfiData.SB, limp: rfiData.SB_LIMP });
      const prior = {};
      for (const hd of H.ALL_HANDS) prior[hd] = limpStrat[hd].limp;
      const seats = baseSeats(P);
      for (const p of P) if (p !== 'SB' && p !== 'BB') seats[p] = { status: 'fold', bet: 0, label: 'Fold' };
      seats.SB = { status: 'hero', bet: 1, label: 'Limp 1' };
      seats.BB = { status: 'raise', bet: ISO_SIZE, label: 'Raise ' + ISO_SIZE };
      add({
        id: tableKey + ':vsLimp:SB:BB',
        table: tableKey, type: 'vsLimp', hero: 'SB', villain: 'BB',
        title: 'SB vs BB raise after limp',
        description: 'Everyone folds, you limp from the small blind and the big blind raises to ' + ISO_SIZE + 'bb.',
        question: '3-bet to ' + ISO_3BET_SIZE + 'bb, call, or fold?',
        actions: [
          { key: 'raise', label: '3-Bet ' + ISO_3BET_SIZE + 'bb', color: COLORS.raise },
          { key: 'call', label: 'Call', color: COLORS.call },
          { key: 'fold', label: 'Fold', color: COLORS.fold }
        ],
        strategy: strategyFor({ actions: ['raise', 'call', 'fold'], raise: R.VS_LIMP.SB_vs_ISO.raise, call: R.VS_LIMP.SB_vs_ISO.call }),
        source: 'VS_LIMP SB_vs_ISO',
        prior, // only hands the SB limped can reach this spot
        seats, pot: 1 + ISO_SIZE
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
      title: 'SB open',
      description: 'Heads-up: you are the small blind and the button, first to act preflop but in position after the flop.',
      question: 'Raise to 2.5bb, limp, or fold?',
      actions: [
        { key: 'raise', label: 'Raise 2.5bb', color: COLORS.raise },
        { key: 'limp', label: 'Limp', color: COLORS.limp },
        { key: 'fold', label: 'Fold', color: COLORS.fold }
      ],
      strategy: openStrat, source: 'HU SB_OPEN',
      seats: { SB: { status: 'hero', bet: 0.5, label: 'SB' }, BB: { status: 'blind', bet: 1, label: 'BB' } }, pot: 1.5
    });
    spots.push({
      id: 'hu:vsOpen:BB:SB', table, type: 'vsOpen', hero: 'BB', villain: 'SB',
      title: 'BB vs SB raise',
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
      title: 'SB vs BB 3-bet',
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
      title: 'BB vs SB limp',
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
      title: 'SB vs BB raise after limp',
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

  root.Spots = { TABLES, POSITION_NAMES, TYPE_META, COLORS, classOf, getSpots, openSize, threeBetSize, fourBetSize, cold4BetSize, squeezeSize, ISO_SIZE, ISO_3BET_SIZE };
})(typeof window !== 'undefined' ? window : globalThis);
