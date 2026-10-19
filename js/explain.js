/* explain.js — rule-based "why" notes for a hand in a spot. */
(function (root) {
  'use strict';
  const S = root.Spots;
  const RV = { A: 14, K: 13, Q: 12, J: 11, T: 10, 9: 9, 8: 8, 7: 7, 6: 6, 5: 5, 4: 4, 3: 3, 2: 2 };

  function classify(hand) {
    const hi = RV[hand[0]], lo = RV[hand[1]];
    const pair = hand.length === 2, suited = !pair && hand[2] === 's';
    const gap = pair ? 0 : hi - lo - 1;
    let cat;
    if (pair) cat = hi >= 12 ? 'premium-pair' : hi >= 10 ? 'strong-pair' : hi >= 7 ? 'medium-pair' : 'small-pair';
    else if (hi === 14) {
      if (lo === 13) cat = 'AK';
      else if (lo === 12) cat = 'AQ';
      else if (lo >= 10) cat = suited ? 'big-suited-ace' : 'big-offsuit-ace';
      else if (lo >= 6) cat = suited ? 'mid-suited-ace' : 'weak-offsuit-ace';
      else cat = suited ? 'wheel-suited-ace' : 'weak-offsuit-ace';
    }
    else if (hi >= 10 && lo >= 10) cat = suited ? 'suited-broadway' : 'offsuit-broadway';
    else if (suited && hi === 13) cat = 'suited-king';
    else if (suited && hi === 12) cat = 'suited-queen';
    else if (suited && gap === 0) cat = 'suited-connector';
    else if (suited && gap <= 2) cat = 'suited-gapper';
    else if (suited) cat = 'suited-junk';
    else if (hi === 13 && lo >= 8) cat = 'offsuit-king';
    else if (gap <= 1 && hi >= 8) cat = 'offsuit-connector';
    else cat = 'offsuit-junk';
    return { hi, lo, pair, suited, gap, cat };
  }

  const WHAT = {
    'premium-pair': 'sits at the top of every range: it is usually ahead and dominates the pairs and big cards opponents continue with',
    'strong-pair': 'is very strong but vulnerable to overcards, so it likes to build the pot early against wide ranges and keep it manageable against tight ones',
    'medium-pair': 'flops a set about 12% of the time and otherwise has modest showdown value; it wants a cheap, heads-up pot',
    'small-pair': 'is mostly a set-mining hand: unimproved it rarely wins, so it needs implied odds and opponents who will pay off',
    'AK': 'is the strongest unpaired hand: it dominates every other ace and king, so it plays as a value raise, and it also wants folds because it misses two flops in three',
    'AQ': 'is a strong hand against wide ranges but is dominated by AK and AA/KK/QQ, which are a big share of a tight early-position range',
    'big-suited-ace': 'combines a strong high card with nut-flush potential and dominates weaker aces',
    'big-offsuit-ace': 'has good high-card strength but poor playability: no flush potential, easily dominated by AK and AQ',
    'mid-suited-ace': 'has nut-flush potential but a weak kicker; it is a fine calling hand and a poor bluffing hand because it blocks little and makes few straights',
    'wheel-suited-ace': 'is the classic bluffing hand: it blocks AA and AK, makes the nut flush and wheel straights, and is weak enough that folding it to a re-raise costs almost nothing',
    'weak-offsuit-ace': 'is top-pair-weak-kicker with no suit: dominated by better aces and bad at making straights or flushes',
    'suited-broadway': 'has two high cards plus flush and straight potential; it flops top pair or a strong draw often and realizes its equity well',
    'offsuit-broadway': 'has high-card value but is easily dominated (KJo runs into AK, AJ, KQ) and makes few strong draws',
    'suited-king': 'has flush potential with a weak kicker; it wants position and cheap pots',
    'suited-queen': 'has flush potential with a weak kicker; it wants position and cheap pots',
    'suited-connector': 'has great playability: it makes straights and flushes and is rarely dominated, but has almost no showdown value unimproved',
    'suited-gapper': 'plays like a suited connector with fewer straight outs',
    'suited-junk': 'has a suit and not much else',
    'offsuit-king': 'is a weak-kicker king with no suit: dominated by better kings and aces',
    'offsuit-connector': 'has some straight potential but no flush and weak high cards',
    'offsuit-junk': 'has no high cards, no suit and poor connectivity, so it has almost nothing going for it'
  };

  function posClass(p) { return (p === 'UTG' || p === 'UTG+1' || p === 'UTG+2' || p === 'LJ') ? 'early' : p === 'HJ' ? 'middle' : (p === 'CO' || p === 'BTN') ? 'late' : p; }
  function behind(table, pos) { const P = S.TABLES[table].positions; return P.length - 1 - P.indexOf(pos); }
  function postIdx(table, pos) { if (pos === 'SB') return 0; if (pos === 'BB') return 1; return 2 + S.TABLES[table].positions.indexOf(pos); }
  function inPosition(table, hero, villain) { return postIdx(table, hero) > postIdx(table, villain); }
  function pct(f) { return Math.round(f * 100) + '%'; }
  function primaryOf(freqs) { let b = null, bf = -1; for (const k in freqs) if (freqs[k] > bf) { bf = freqs[k]; b = k; } return b; }

  const CAT_NAME = {
    'premium-pair': 'premium pair', 'strong-pair': 'strong pair', 'medium-pair': 'medium pair', 'small-pair': 'small pair', 'AK': 'ace-king', 'AQ': 'ace-queen',
    'big-suited-ace': 'big suited ace', 'big-offsuit-ace': 'big offsuit ace', 'mid-suited-ace': 'mid suited ace', 'wheel-suited-ace': 'suited wheel ace', 'weak-offsuit-ace': 'weak offsuit ace',
    'suited-broadway': 'suited broadway', 'offsuit-broadway': 'offsuit broadway', 'suited-king': 'suited king', 'suited-queen': 'suited queen', 'suited-connector': 'suited connector',
    'suited-gapper': 'suited gapper', 'suited-junk': 'weak suited hand', 'offsuit-king': 'offsuit king', 'offsuit-connector': 'offsuit connector', 'offsuit-junk': 'offsuit junk'
  };

  /* ---------- decision reasons ---------- */
  function rfiReason(spot, c, hand, primary, freqs) {
    const n = behind(spot.table, spot.hero), pc = posClass(spot.hero);
    const where = pc === 'early' ? 'From early position with ' + n + ' players still to act, ' : pc === 'middle' ? 'From the hijack with ' + n + ' players behind, ' : spot.hero === 'CO' ? 'From the cutoff with only the button and the blinds behind, ' : spot.hero === 'BTN' ? 'On the button, with only the blinds left and guaranteed position, ' : 'From the small blind, with only the big blind left but out of position for the whole hand, ';
    if (primary === 'raise') {
      const parts = { 'premium-pair': 'a raise builds the pot with the best hand and gets value from every hand that continues',
        'strong-pair': 'the hand is far ahead of the range that will call, and raising denies overcards a free flop',
        'medium-pair': 'the pair has enough showdown value and set potential to profit, and raising takes the blinds outright often enough',
        'small-pair': 'the pair is profitable only because the raise wins the blinds often and sets get paid off; it is close to a fold from early seats',
        'AK': 'AK is a clear open: it dominates the calling range and wins the blinds when everyone folds',
        'AQ': 'AQ is a clear open: it gets value from weaker aces and broadways',
        'big-suited-ace': 'a big suited ace is a clear open: strong high card, nut-flush potential and it dominates the aces that call',
        'big-offsuit-ace': 'the hand is strong enough to open because it dominates many calling hands, even though it plays poorly after the flop',
        'mid-suited-ace': 'a suited ace opens: it blocks AA/AK, makes the nut flush, and can continue against some 3-bets or fold cheaply',
        'wheel-suited-ace': 'a suited wheel ace opens: it blocks AA/AK, makes the nut flush and wheel straights, and its equity is well distributed',
        'weak-offsuit-ace': 'the hand wins the blinds often enough and its ace-high has some showdown value against the blinds\' wide defending ranges',
        'suited-broadway': 'a suited broadway opens: it flops top pairs and big draws and rarely gets dominated badly',
        'offsuit-broadway': 'two high cards win the blinds often and make top pair; the domination risk is acceptable with few players behind',
        'suited-king': 'the flush potential and position make the open profitable, mostly because the blinds fold often enough',
        'suited-queen': 'the flush potential and position make the open profitable, mostly because the blinds fold often enough',
        'suited-connector': 'connectors open because they play well after the flop and are rarely dominated, which matters against wide blind defences',
        'suited-gapper': 'the gapper opens because it plays well after the flop and the raise wins the blinds often enough',
        'suited-junk': 'the open is profitable only because the blinds fold so often; the hand itself is weak',
        'offsuit-king': 'the open is profitable only because the blinds fold so often; the hand itself is weak',
        'offsuit-connector': 'the open is profitable only because the blinds fold so often and the hand can make straights',
        'offsuit-junk': 'this is a pure steal: it wins only when the blinds fold' };
      const core = parts[c.cat] || 'the hand is strong enough to open';
      return core.charAt(0).toUpperCase() + core.slice(1) + '.';
    }
    const foldParts = { 'small-pair': 'a small pair loses too often: it needs a heads-up pot with deep implied odds, and with this many players behind it gets 3-bet or outflopped too frequently',
      'medium-pair': 'even a medium pair is marginal here: it is behind every bigger pair and faces too many 3-bets',
      'AQ': 'AQ folds here only because the seat is so early that the hand is dominated too often (very unusual)',
      'big-offsuit-ace': 'an offsuit ace with a weak kicker is dominated by the aces that continue and has no flush or straight backup',
      'weak-offsuit-ace': 'a weak offsuit ace is dominated by every ace that continues and has no suit or connectivity to fall back on',
      'mid-suited-ace': 'from this early a suited ace with a mid kicker is dominated too often and does not win the blinds enough to compensate',
      'offsuit-broadway': 'offsuit broadways run into AK, AQ, AJ and KQ from the players still to act, so the top pairs they make are often second best',
      'suited-king': 'a suited king with a weak kicker needs the blinds to fold a lot; with this many players behind it is called or 3-bet too often',
      'suited-queen': 'a suited queen with a weak kicker needs the blinds to fold a lot; with this many players behind it is called or 3-bet too often',
      'suited-connector': 'small connectors have no showdown value and, with several players behind, get 3-bet or have to play multi-way pots out of position',
      'suited-gapper': 'the gapper has little showdown value and not enough steal equity from this seat',
      'suited-junk': 'a suit alone is not enough: the hand is dominated and rarely makes a strong hand',
      'offsuit-king': 'a weak-kicker king is dominated and cannot make flushes; it only works as a steal from late position',
      'offsuit-connector': 'offsuit connectors rarely make straights and have no showdown value, so they cannot be opened profitably here',
      'offsuit-junk': 'it has no high-card value, no suit and no connectivity, so it only wins when everyone folds, and that is not often enough' };
    const core = foldParts[c.cat] || 'the hand is not strong enough to open';
    return core.charAt(0).toUpperCase() + core.slice(1) + '.';
  }

  function vsOpenReason(spot, c, hand, primary, freqs) {
    const V = spot.villain, hero = spot.hero;
    const vc = posClass(V), ip = inPosition(spot.table, hero, V);
    const vDesc = vc === 'early' ? 'an early-position open (a tight range of about 15-18%)' : vc === 'middle' ? 'a hijack open (about 22%)' : V === 'CO' ? 'a cutoff open (about 29%)' : V === 'BTN' ? 'a button open (about 45%)' : 'a small-blind open (about 44%)';
    const heroDesc = hero === 'BB' ? (V === 'SB' ? 'BB vs SB: you close the action with position, so you defend very wide.' : 'In the BB you close the action at a good price, but play out of position.') : hero === 'SB' ? 'The SB is out of position with the BB still behind, so it mostly 3-bets or folds.' : ip ? (behind(spot.table, hero) > 2 ? 'You have position, but ' + (behind(spot.table, hero) - 2) + ' player(s) plus the blinds behind can squeeze.' : 'You have position and only the blinds behind.') : '';
    let why = '';
    if (primary === 'raise') {
      const parts = { 'premium-pair': 'This is a value 3-bet: you want to build the pot against the opener\'s continuing range and deny cheap flops to hands that can outdraw you',
        'strong-pair': 'JJ/TT 3-bet for value against ' + (vc === 'late' || V === 'SB' ? 'a wide late open' : 'this range') + ': you are ahead of most of what continues and you prevent overcards from seeing a cheap flop',
        'AK': 'AK 3-bets for value: it dominates the aces and kings in the opener\'s range and collects folds from the rest',
        'AQ': 'AQ 3-bets ' + (vc === 'late' || V === 'SB' ? 'for value against a wide open' : 'as a thin value / semi-bluff hand') + ': it dominates weaker aces and broadways and plays well when called',
        'big-suited-ace': 'A big suited ace 3-bets for value against a wide open: it dominates the weaker aces that continue and has the nut flush draw as backup',
        'big-offsuit-ace': 'The offsuit big ace 3-bets rather than calls: it does not play well in a called pot, so it prefers to end the hand preflop or push its high-card edge',
        'mid-suited-ace': 'The suited ace 3-bets as a bluff-heavy hand here: it blocks AA/AK/AQ, has the nut flush draw and folds cheaply to a 4-bet',
        'wheel-suited-ace': 'A2s-A5s are the preferred 3-bet bluffs: they block AA and AK (so the opener 4-bets less often), they make the nut flush and wheel straights when called, and they are not good enough to call profitably',
        'suited-broadway': 'A suited broadway 3-bets as a value-leaning hand: it dominates weaker broadways and plays well when called',
        'offsuit-broadway': 'The offsuit broadway 3-bets as a bluff: it blocks the opener\'s strongest broadway hands and would be dominated as a call',
        'suited-connector': 'Suited connectors are occasionally 3-bet as bluffs: they have great playability when called and their equity is not dominated',
        'medium-pair': 'The medium pair 3-bets as a semi-bluff: it plays well against a 4-bet-or-fold response and takes the pot down often',
        'suited-king': 'The suited king 3-bets as a bluff: it blocks KK/AK and has the second-nut flush draw when called' };
      why = (parts[c.cat] || 'The hand is 3-bet here') + '.';
    } else if (primary === 'call') {
      const parts = { 'premium-pair': 'Calling with a premium pair is a trap play: it keeps the opener\'s bluffs in and disguises your hand',
        'strong-pair': 'The strong pair calls to keep the opener\'s dominated hands in and avoid facing a 4-bet with a hand that hates overcards',
        'medium-pair': 'A medium pair calls: it is too weak to 3-bet for value but has showdown value and set-mining odds against a range that will pay off',
        'small-pair': 'A small pair calls to set-mine: ' + (vc === 'late' || V === 'SB' ? 'against a wide open the pot is usually heads-up and your sets get paid, and a small pair is often the best hand' : 'the opener\'s range is strong enough to pay off sets and the pot is often heads-up'),
        'AQ': 'AQ calls against ' + vDesc + ': 3-betting would fold out the hands it beats and get action only from hands that dominate it',
        'big-suited-ace': 'The big suited ace calls: it dominates the weaker aces that continue, has nut-flush potential and would be folding out worse hands by 3-betting',
        'big-offsuit-ace': 'The big offsuit ace calls: it has enough high-card value against this range but not enough to 3-bet, and it needs to see a flop cheaply',
        'mid-suited-ace': 'Mid suited aces call rather than 3-bet: they dominate much of the opener\'s calling range (A9 beats A8-A6, weaker kings), so they want to keep those hands in',
        'wheel-suited-ace': 'The wheel ace calls here: with position and a good price it can set-mine for the nut flush and wheel, and a 3-bet would not fold enough',
        'weak-offsuit-ace': 'The offsuit ace calls only because of the price and closing the action: it has showdown value against a wide open',
        'suited-broadway': 'The suited broadway calls: it flops top pairs and strong draws and is not dominated badly by the opener\'s range',
        'offsuit-broadway': 'The offsuit broadway calls because it has enough high-card equity against ' + vDesc + ', but it must play carefully with one pair',
        'suited-connector': 'Suited connectors call: they need to see a flop to realize their equity and play well multi-way and in position',
        'suited-gapper': 'The suited gapper calls for the same reasons as a connector: good playability and a fair price',
        'suited-king': 'The suited king calls: flush potential and a king-high pair are enough against ' + vDesc,
        'suited-queen': 'The suited queen calls: flush potential and a queen-high pair are enough against ' + vDesc,
        'suited-junk': 'Even a weak suited hand calls at this price: the big blind only needs about 30% equity and suited hands realize that equity',
        'offsuit-king': 'The offsuit king calls only because of the price: it has some high-card value but is dominated by better kings',
        'offsuit-connector': 'The offsuit connector calls because the price is good and it can make straights, but it will fold to any real pressure',
        'offsuit-junk': 'Even junk defends sometimes at this price from the big blind; it only needs to realize a little equity' };
      why = (parts[c.cat] || 'The hand calls here') + '.';
    } else {
      const parts = { 'small-pair': 'A small pair folds against ' + vDesc + (vc === 'early' ? ': a tight range rarely pays off a set, and a hand that only wins by hitting cannot call this price' : ': set-mining needs a cheap price and a pot that stays heads-up, and here it does not'),
        'medium-pair': 'A medium pair folds against this range: it is dominated by bigger pairs, cannot call profitably out of position and is too weak to 3-bet',
        'big-offsuit-ace': 'The offsuit ace folds: it is dominated by AK/AQ/AJ in ' + vDesc + ' and has no way to make a straight or flush',
        'AQ': 'AQ folds against a very tight early range: too often it runs into AK, AA, KK or QQ',
        'weak-offsuit-ace': 'A weak offsuit ace folds: it is dominated by every ace that opens and it cannot make a flush',
        'mid-suited-ace': 'The mid suited ace folds: against ' + vDesc + ' it is dominated by better aces, cannot call profitably out of position and is not a good enough bluff',
        'offsuit-broadway': 'Offsuit broadways fold against ' + vDesc + ': they are dominated by AK, AQ, AJ and KQ, so the pairs they make are often second best',
        'suited-broadway': 'The suited broadway folds: it is dominated by the top of the opener\'s range and does not fold enough out as a 3-bet',
        'suited-connector': 'Suited connectors fold here: they have no showdown value and ' + (ip ? 'the opener\'s range is too tight to pay off' : 'out of position they realize too little of their equity'),
        'suited-gapper': 'The gapper folds: it has too few straight outs and no showdown value',
        'suited-king': 'The suited king folds: king-high with a weak kicker is dominated and the flush comes too rarely to pay for the call',
        'suited-queen': 'The suited queen folds: queen-high with a weak kicker is dominated and the flush comes too rarely to pay for the call',
        'suited-junk': 'A suit alone does not justify continuing against a raise',
        'offsuit-king': 'The offsuit king folds: dominated and no flush potential',
        'offsuit-connector': 'The offsuit connector folds: too little straight potential and no showdown value to pay this price',
        'offsuit-junk': 'This is an easy fold: no high cards, no suit and no connectivity' };
      why = (parts[c.cat] || 'The hand folds here') + '.';
    }
    return why;
  }

  function vs3betReason(spot, c, hand, primary, freqs) {
    const V = spot.villain, hero = spot.hero, ip = inPosition(spot.table, hero, V);
    const ctx = (ip ? 'You will have position after the flop, which makes calling more attractive.' : 'You will be out of position, so calling needs a hand that plays well without initiative.') + ' The 3-bet range is polarized: premiums plus suited-ace and broadway bluffs.';
    let why;
    if (primary === 'raise') {
      const parts = { 'premium-pair': 'A 4-bet for value: you want stacks in against the 3-bettor\'s value hands and to charge the bluffs',
        'AK': 'AK 4-bets for value and for folds: it blocks AA/KK/AK, gets called by QQ-JJ/AQ where it has fair equity, and is happy to take the pot down now',
        'wheel-suited-ace': 'A4s/A5s are the standard 4-bet bluffs: they block AA/AK (so the 3-bettor has fewer hands to jam with), they are too weak to call, and if called they can still make the nut flush or a wheel',
        'AQ': 'AQ 4-bets as a semi-bluff: it blocks AA/QQ/AK, gets folds from many bluffs and still has decent equity when called',
        'strong-pair': 'JJ/TT occasionally 4-bet to deny equity to the bluffs and to avoid playing a difficult pot out of position',
        'suited-broadway': 'The suited broadway 4-bets as a bluff: it blocks KK/QQ/AK and would be dominated as a call' };
      why = (parts[c.cat] || 'A 4-bet here') + '.';
    } else if (primary === 'call') {
      const parts = { 'premium-pair': 'Calling with the premium pair traps: it keeps all the 3-bettor\'s bluffs in',
        'strong-pair': 'The strong pair calls: it is ahead of most of the 3-bet range but does not want to face a 5-bet with a hand overcards can beat',
        'medium-pair': 'The medium pair calls for set value and because it is ahead of the bluffs; it would have to fold to a 5-bet if it 4-bet',
        'small-pair': 'The small pair calls to set-mine against a strong range that will pay off, with a good price and the pot big enough for implied odds',
        'AK': 'AK sometimes calls rather than 4-bets to keep the bluffs in and avoid being 5-bet by AA/KK',
        'AQ': 'AQ calls: it is too strong to fold against a range with many suited-ace bluffs but too weak to 4-bet for value',
        'big-suited-ace': 'The big suited ace calls: it dominates the 3-bettor\'s weaker aces, has the nut flush draw and plays well in position',
        'mid-suited-ace': 'The mid suited ace calls: nut-flush potential and the bluffs in the 3-bettor\'s range give it enough equity',
        'wheel-suited-ace': 'The wheel ace calls: it dominates none of the range but has the nut flush and wheel draws, and the price is good',
        'suited-broadway': 'The suited broadway calls: it flops well, keeps the 3-bettor\'s bluffs in and is not dominated by the bluffs',
        'suited-connector': 'Suited connectors call: they realize equity well against a polarized range and are never dominated',
        'suited-gapper': 'The suited gapper calls for playability against a polarized range',
        'suited-king': 'The suited king calls: it beats the bluffs and has flush potential',
        'offsuit-broadway': 'The offsuit broadway calls because the 3-bet is small enough and it beats the bluffing part of the range',
        'big-offsuit-ace': 'The big offsuit ace calls occasionally when in position: it beats the bluffs and has some equity against the value hands' };
      why = (parts[c.cat] || 'The hand calls the 3-bet') + '.';
    } else {
      const parts = { 'small-pair': 'The small pair folds: it is behind every pair in the 3-bet range and set-mining needs a cheaper price and a pot that pays off',
        'medium-pair': 'The medium pair folds: it is crushed by the value part of the 3-bet range and cannot call profitably ' + (ip ? 'at this price' : 'out of position'),
        'big-offsuit-ace': 'The offsuit big ace folds: it is dominated by AK/AQ/AA and does not play well against a strong range',
        'weak-offsuit-ace': 'The weak ace folds: dominated and no backup',
        'mid-suited-ace': 'The mid suited ace folds: it is dominated by the 3-bettor\'s better aces and does not flop well enough to pay this price',
        'wheel-suited-ace': 'The wheel ace folds when it is not chosen as a 4-bet bluff: it cannot call profitably',
        'offsuit-broadway': 'Offsuit broadways fold: against a polarized 3-bet range they are dominated by the value hands and have little to gain against the bluffs',
        'suited-broadway': 'The suited broadway folds: it is dominated by the value part of the range and the price is not good enough for its draws',
        'suited-connector': 'Suited connectors fold: they have no showdown value and the pot is not deep enough to chase draws',
        'suited-gapper': 'The gapper folds: not enough playability to pay this price',
        'suited-king': 'The suited king folds: dominated and the flush comes too rarely',
        'suited-queen': 'The suited queen folds: dominated and the flush comes too rarely',
        'suited-junk': 'The weak suited hand folds: nothing to continue with',
        'offsuit-king': 'The offsuit king folds: dominated and no flush potential',
        'offsuit-connector': 'The offsuit connector folds: no showdown value and no price for its draws',
        'offsuit-junk': 'An easy fold: nothing to continue with',
        'AQ': 'AQ folds against a tight 3-bet range from this seat: it is dominated by AK and the big pairs and cannot call profitably out of position' };
      why = (parts[c.cat] || 'The hand folds to the 3-bet') + '.';
    }
    return why;
  }

  function vsLimpReason(spot, c, hand, primary, freqs) {
    const junk = c.cat === 'offsuit-junk' || c.cat === 'offsuit-connector' || c.cat === 'offsuit-king' || c.cat === 'weak-offsuit-ace';
    if (primary === 'raise' && junk && !c.pair) return 'The raise is polar: the weakest offsuit hands realize almost nothing if they check, so they raise as bluffs and win the pot when the limper folds.';
    if (primary === 'raise') return 'Raising isolates the SB\'s capped limping range for value: you build a pot in position with a hand that ' + (c.pair || c.cat.indexOf('ace') >= 0 || c.cat.indexOf('broadway') >= 0 ? 'has real showdown value' : 'plays well after the flop') + '.';
    return 'Middling hands take the free flop: they have showdown value against a limping range but hate facing a limp-3-bet, so they keep the pot small.';
  }

  /* Open-limping: never part of the no-ante GTO strategy at 6-max / 9-max. */
  const LIMP_NOTE = 'Just calling the big blind (open-limping) is not part of the GTO strategy here: in no-ante cash games solvers raise or fold first in from every seat (even the SB limps only a sliver of hands). A limp wins no pot outright, lets the players behind isolate you, and leaves you with a capped range.';

  /* ---------- comparisons that teach the pattern ---------- */
  function comparison(spot, c, hand, primary) {
    if (spot.type === 'vsOpen' && (c.cat === 'wheel-suited-ace' || c.cat === 'mid-suited-ace'))
      return 'A2s-A5s 3-bet more than A6s-A9s: the wheel aces block AA/AK and lose little when 4-bet, while A6s-A9s dominate more of the calling range and prefer to call.';
    if (spot.type === 'vsOpen' && c.cat === 'small-pair')
      return 'Small pairs fold to early opens but call late ones: a tight range rarely pays off a set, a wide one often does and is often behind unimproved.';
    if (spot.type === 'vsOpen' && c.cat === 'offsuit-broadway')
      return 'KQo/KJo/QJo fold to early opens but continue vs late ones: the tighter the range, the more AK/AQ/AJ/KQ dominate them.';
    if (spot.type === 'vsOpen' && (c.cat === 'suited-connector' || c.cat === 'suited-gapper') && spot.hero === 'SB')
      return 'Suited connectors flat freely in position but only rarely from the SB: out of position with the BB behind, the SB mostly 3-bets or folds and keeps just a thin flatting range (more of it against late opens).';
    if (spot.type === 'rfi' && posClass(spot.hero) === 'early' && (c.cat === 'suited-king' || c.cat === 'suited-connector' || c.cat === 'weak-offsuit-ace'))
      return 'The same hand opens from the cutoff or button: ranges widen from ~17% UTG to ~43% on the button as fewer players remain behind.';
    if (spot.type === 'vs3bet' && c.cat === 'wheel-suited-ace')
      return 'A5s/A4s are 4-bet bluffs, A9s-A6s are not: blocking AA/AK matters most against a narrow continuing range.';
    if (spot.type === 'vs3bet' && (c.cat === 'AK' || c.cat === 'premium-pair'))
      return '4-bet value is QQ+/AK, with JJ and TT mixed in more often as the 3-bettor\'s range widens: only strong hands continue against a 4-bet.';
    if (spot.type === 'vsOpen' && spot.hero === 'BB' && spot.villain === 'SB')
      return 'BB vs SB is the widest defence in poker: you close the action, get a good price and have position.';
    if (spot.type === 'rfi' && spot.hero === 'SB' && (c.cat === 'offsuit-junk' || c.cat === 'offsuit-connector'))
      return 'The SB opens almost as wide as the button (~44%): only one player is left and the 3bb raise usually wins the pot outright.';
    return null;
  }

  /* Heads-up spots have their own short reasons. */
  function huReason(spot, c, hand, primary) {
    const strong = c.cat === 'premium-pair' || c.cat === 'strong-pair' || c.cat === 'AK' || c.cat === 'AQ' || c.cat === 'big-suited-ace' || c.cat === 'suited-broadway' || c.cat === 'medium-pair';
    const playable = c.suited || c.pair || c.hi === 14 || (c.hi >= 10 && c.lo >= 8);
    if (spot.type === 'rfi') {
      if (primary === 'raise') return strong ? 'With position and only one opponent the SB raises most hands; a ' + CAT_NAME[c.cat] + ' is a clear value raise.' : 'Heads-up the SB has position and a single opponent, so it raises around half of all hands; this one has enough equity and playability to raise for value and fold equity.';
      if (primary === 'limp') return 'Too weak to raise (it gets 3-bet or called by better hands too often) but too playable to fold with position: limping sees a cheap flop and keeps the BB\'s 3-bet bluffs out.';
      return 'Even heads-up, the weakest offsuit hands lose money in every line: no high cards, no suit, poor connectivity.';
    }
    if (spot.type === 'vsOpen') {
      if (primary === 'raise') return strong ? 'The BB 3-bets for value: out of position it prefers to build the pot now against a ~55% raising range rather than play a big range disadvantage postflop.' : 'The BB 3-bets this hand as a bluff: it has blockers or nut potential, folds cheaply to a 4-bet, and out of position it would realize little equity as a call.';
      if (primary === 'call') return playable ? 'Against a ~55% opening range the BB closes the action at a good price; this hand has enough equity and playability to call even out of position.' : 'The price is good enough to call against such a wide range, though the hand must play carefully out of position.';
      return 'Against even a wide heads-up open, this hand realizes too little equity out of position to pay 1.5bb more.';
    }
    if (spot.type === 'vs3bet') {
      if (primary === 'raise') return strong ? 'A 4-bet for value: the BB 3-bets a wide, bluff-heavy range heads-up, so premiums want to grow the pot.' : 'A 4-bet bluff: it blocks the BB\'s value hands, folds cheaply to a jam, and the BB\'s wide 3-bet range folds often.';
      if (primary === 'call') return 'With position the SB calls a wide, polarized 3-bet range: this hand beats the bluffs and realizes its equity well in position.';
      return 'Not enough equity against the value part of the 3-bet range to call 7.5bb more, and not a good 4-bet bluff candidate.';
    }
    if (spot.hero === 'BB') {
      if (primary === 'raise') return c.cat === 'offsuit-junk' || c.cat === 'offsuit-connector' ? 'The BB\'s raise over a limp is polar: the weakest offsuit hands raise as bluffs because they realize almost nothing if they check.' : 'The SB\'s limping range is capped, so the BB raises strong hands for value and builds the pot now.';
      return 'Middling hands check: they have showdown value against the limp but hate facing a limp-3-bet, so they take the free flop.';
    }
    if (primary === 'raise') return 'A limp-3-bet bluff with a hand that has some nut potential: the BB\'s isolation range folds often enough.';
    if (primary === 'call') return 'With position and a 2:1 price, the limped hand calls the BB\'s raise and plays a small pot in position.';
    return 'The weakest limps give up against a raise: too little equity even at 2:1 with position.';
  }

  function explain(spot, hand, freqs, chosen) {
    const c = classify(hand);
    const primary = primaryOf(freqs);
    if (spot.table === 'hu') {
      const played = spot.actions.filter(a => freqs[a.key] > 0);
      return { what: '', why: huReason(spot, c, hand, primary), mix: played.length > 1 ? played.map(a => a.label.replace(/ [\d.~]+bb$/, '') + ' ' + pct(freqs[a.key])).join(' / ') : null,
        compare: spot.type === 'rfi' ? 'Heads-up the SB is the button: it raises or limps about 87% of hands, far more than the 44% it opens at a full table.' : (spot.type === 'vsOpen' ? 'The BB defends about two-thirds of hands here, and 3-bets more than at 6-max because it is out of position.' : null),
        cat: c.cat, catName: CAT_NAME[c.cat] };
    }
    const played = spot.actions.filter(a => freqs[a.key] > 0);
    const label = k => { const a = spot.actions.find(x => x.key === k); return a ? a.label.replace(/ [\d.~]+bb$/, '') : k; };
    const what = hand + ' (' + CAT_NAME[c.cat] + ') ' + WHAT[c.cat] + '.';
    let why;
    if (spot.type === 'rfi') why = rfiReason(spot, c, hand, primary, freqs);
    else if (spot.type === 'vsOpen') why = vsOpenReason(spot, c, hand, primary, freqs);
    else if (spot.type === 'vs3bet') why = vs3betReason(spot, c, hand, primary, freqs);
    else why = vsLimpReason(spot, c, hand, primary, freqs);
    let mix = null;
    if (played.length > 1) {
      mix = played.map(a => label(a.key) + ' ' + pct(freqs[a.key])).join(' / ') + '. The options are close in EV; mixing keeps the range balanced.';
    }
    const cmp = chosen === 'limp' && spot.type === 'rfi' ? LIMP_NOTE : comparison(spot, c, hand, primary);
    return { what, why, mix, compare: cmp, cat: c.cat, catName: CAT_NAME[c.cat] };
  }

  root.Explain = { explain, classify };
})(typeof window !== 'undefined' ? window : globalThis);
