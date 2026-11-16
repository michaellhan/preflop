/* ranges.js — preflop strategy data.
   Model: 100bb effective, no ante, cash-game rake (5% capped at about 0.5bb, as in the reference solution).
   Open size: 2.5bb from every position; the SB also limps part of its range (RFI6.SB_LIMP).
   3-bet sizes: 7.5bb in position, 11.5bb from the SB, 12.5bb from the BB (7.5bb vs a SB open).
   4-bets 23bb over a 7.5bb 3-bet, 25bb over a blind 3-bet. Sizes follow the reference solution.
   Frequencies are per-hand action weights (0..1). Hands not listed take the residual
   action (fold, or check for the BB vs limp spot). Mixed frequencies are rounded to
   5% steps. These are hand-curated approximations of 100bb equilibrium solver output
   from the sources named on the About page. The heads-up charts are our own solve
   (solver/ in this repo: real postflop solves on sampled flops, the average
   of the last six of 18 rounds), not from those sources. Every 6-max spot was checked hand
   by hand against a free 100bb 6-max solution in October 2026: hands off by more than 10% were corrected, and the
   blind-vs-blind and limped-pot charts follow it throughout. */
(function (root) {
  'use strict';

  /* ---------------- RAISE FIRST IN ---------------- */
  const RFI6 = {
    UTG: "66+, 55:0.45, 44:0.35, 33:0.25, 22:0.4, A8s+, A7s:0.9, A2s-A6s, K8s+, K7s:0.25, K6s:0.3, Q9s+, J9s+, T9s, T8s:0.1, 98s:0.5, 87s:0.05, 76s:0.35, 65s:0.45, 54s:0.4, ATo+, KQo, KJo:0.55, KTo:0.45, QJo:0.2",
    HJ:  "55+, 44:0.65, 33:0.5, 22:0.55, A2s+, K6s+, Q9s+, Q8s:0.5, Q7s:0.1, J9s+, T8s+, T7s:0.1, 98s, 87s:0.45, 76s:0.4, 65s:0.5, 54s:0.5, ATo+, A9o:0.4, KTo+, QJo:0.9, QTo:0.7, JTo:0.15",
    CO:  "33+, 22:0.9, A2s+, K4s+, Q8s+, Q7s:0.15, Q6s, J8s+, T8s+, T7s:0.8, 97s+, 87s, 76s, 65s:0.8, 54s:0.6, A9o+, A8o:0.95, A5o:0.6, KTo+, QTo+, JTo",
    BTN: "22+, A2s+, K2s+, Q4s+, J5s+, T5s+, 96s+, 86s+, 84s:0.1, 75s+, 64s+, 54s, 53s:0.65, A4o+, A3o:0.4, K9o+, Q9o+, J9o+, T8o+, 98o:0.4",
    SB:  "AA:0.9, KK:0.8, QQ:0.85, JJ:0.8, 99-TT:0.85, 88:0.8, 77:0.75, 44-66:0.7, 33:0.65, 22:0.6, AKs, AQs:0.95, A7s-AJs, A6s:0.95, A5s, A4s:0.95, A3s:0.85, A2s:0.5, KTs+, K9s:0.85, K8s:0.55, K7s:0.65, K6s:0.85, K5s:0.75, K4s:0.5, K3s:0.3, K2s:0.35, QTs+, Q9s:0.8, Q8s:0.7, Q7s:0.75, Q6s:0.6, Q5s:0.65, Q4s:0.55, Q3s:0.75, Q2s:0.7, JTs, J9s:0.95, J8s:0.6, J7s:0.65, J6s:0.8, J5s:0.85, J4s:0.65, J3s:0.2, T9s:0.95, T8s:0.65, T7s:0.5, T5s-T6s:0.8, T4s:0.5, T3s:0.05, 98s:0.55, 97s:0.7, 96s:0.65, 95s:0.55, 87s:0.6, 86s:0.65, 85s:0.85, 76s:0.85, 74s-75s:0.7, 65s:0.95, 64s:0.75, 63s:0.1, 54s:0.8, 53s:0.7, 43s:0.65, AKo:0.75, AQo:0.85, ATo-AJo:0.8, A9o:0.65, A8o:0.8, A6o-A7o:0.85, A5o:0.7, A4o:0.65, A3o:0.2, KQo:0.85, KJo:0.7, KTo:0.6, K8o-K9o:0.95, K7o:0.25, QJo:0.6, QTo:0.65, Q9o:0.85, Q8o:0.2, JTo:0.6, J9o:0.7, J8o:0.4, T8o+:0.7, 98o:0.75, 87o:0.6, 76o:0.3",
    // SB limps (completes to 1bb) part of its range; everything else in the SB raises (SB above) or folds
    SB_LIMP: "AA:0.1, KK:0.2, QQ:0.15, JJ:0.2, 99-TT:0.15, 88:0.2, 77:0.25, 44-66:0.3, 33:0.35, 22:0.4, AQs:0.05, A6s:0.05, A4s:0.05, A3s:0.15, A2s:0.5, K9s:0.15, K8s:0.45, K7s:0.35, K6s:0.15, K5s:0.25, K4s:0.5, K3s:0.7, K2s:0.65, Q9s:0.2, Q8s:0.3, Q7s:0.25, Q6s:0.4, Q5s:0.35, Q4s:0.45, Q3s:0.25, Q2s:0.3, J9s:0.05, J8s:0.4, J7s:0.35, J6s:0.2, J5s:0.15, J4s:0.35, J3s:0.8, J2s:0.05, T9s:0.05, T8s:0.35, T7s:0.5, T5s-T6s:0.2, T4s:0.5, T3s:0.15, 98s:0.45, 97s:0.3, 96s:0.35, 95s:0.45, 87s:0.4, 86s:0.35, 85s:0.15, 76s:0.15, 74s-75s:0.3, 65s:0.05, 64s:0.25, 63s:0.05, 54s:0.2, 53s:0.3, 43s:0.25, AKo:0.25, AQo:0.15, ATo-AJo:0.2, A9o:0.35, A8o:0.2, A6o-A7o:0.15, A5o:0.3, A4o:0.35, A3o:0.8, A2o:0.35, KQo:0.15, KJo:0.3, KTo:0.4, K8o-K9o:0.05, K7o:0.65, K6o:0.4, K5o:0.05, QJo:0.4, QTo:0.35, Q9o:0.15, Q8o:0.8, JTo:0.4, J9o:0.3, J8o:0.55, T8o+:0.3, T7o:0.1, 98o:0.25, 97o:0.3, 87o:0.3, 76o:0.25, 65o:0.2"
  };

  /* 9-max UTG: GTO Wizard's published 9-handed 100bb UTG open (blog chart, read to about +-5%), rounded to 5%
     and capped per hand at UTG+1. UTG+1 / UTG+2: PokerCoaching's 8-max 100bb cash UTG / UTG+1 opens (same number
     of players behind), rounded to 5%; UTG+2 capped per hand at LJ (= 6-max UTG). */
  const RFI9 = {
    'UTG':   "99+, 88:0.6, 77:0.3, 66:0.1, 55:0.05, A8s+, A7s:0.95, A6s:0.5, A4s-A5s, A3s:0.2, KTs+, K9s:0.6, K6s:0.05, K5s:0.15, QJs, QTs:0.7, JTs:0.6, T9s:0.05, 65s:0.1, 54s:0.05, AQo+, KQo:0.6",
    'UTG+1': "88+, 77:0.5, 66:0.2, 55:0.15, A8s+, A7s:0.95, A6s:0.5, A4s-A5s, A3s:0.85, KTs+, K9s:0.6, K6s:0.05, K5s:0.15, QTs+, JTs, T9s:0.35, 65s:0.6, 54s:0.05, AQo+, KQo:0.6",
    'UTG+2': "88+, 77:0.95, 66:0.35, 55:0.25, A8s+, A7s:0.9, A3s-A6s, K9s+, K8s:0.2, K7s:0.05, K6s:0.2, QTs+, JTs, T9s:0.65, 65s:0.45, 54s:0.2, AQo+, AJo:0.6, KQo",
    'LJ':  RFI6.UTG,   // 5 players behind — structurally identical to 6-max UTG
    'HJ':  RFI6.HJ,
    'CO':  RFI6.CO,
    'BTN': RFI6.BTN,
    'SB':  RFI6.SB,
    'SB_LIMP': RFI6.SB_LIMP
  };

  /* ---------------- FACING AN OPEN (hero_vs_opener) ----------------
     raise = 3-bet, call = flat, everything else folds. */
  const VS_OPEN = {
    HJ_vs_UTG: {
      raise: "QQ+, TT-JJ:0.95, 99:0.9, 88:0.6, 77:0.35, 66:0.2, AKs, AQs:0.85, ATs-AJs:0.9, A9s:0.3, A5s:0.9, A4s:0.3, KQs:0.95, KTs-KJs, QJs:0.55, QTs:0.2, 65s:0.15, 54s:0.1, AKo, AQo:0.7, KQo:0.15",
      call:  "TT-JJ:0.05, 99:0.1, 66-88:0.05, 55:0.1, AQs:0.15, ATs-AJs:0.1, KQs:0.05, QTs+:0.05, JTs:0.05, AQo:0.1"
    },
    CO_vs_UTG: {
      raise: "QQ+, TT-JJ:0.85, 88-99:0.75, 77:0.45, 66:0.25, AKs, AQs:0.9, AJs:0.65, ATs:0.75, A9s:0.8, A5s:0.95, A4s:0.3, KQs:0.85, KJs:0.95, KTs:0.9, QJs:0.85, QTs:0.65, 65s:0.05, 54s:0.05, AKo:0.9, AQo:0.85, KQo:0.2",
      call:  "TT-JJ:0.15, 88-99:0.25, 77:0.15, 66:0.2, 55:0.1, AQs:0.1, AJs:0.35, ATs:0.25, A9s:0.1, A4s:0.05, KQs:0.15, KJs:0.05, KTs:0.1, QJs:0.15, QTs:0.1, JTs:0.2, T9s:0.05, 76s:0.05, 65s:0.1, 54s:0.2, AKo:0.1, AQo:0.15"
    },
    BTN_vs_UTG: {
      raise: "KK+, QQ:0.8, TT-JJ:0.7, 88-99:0.55, 77:0.5, 66:0.3, AKs, AQs:0.9, AJs:0.4, ATs:0.65, A9s:0.75, A8s:0.5, A5s:0.85, A4s:0.75, A3s:0.1, KQs:0.5, KJs:0.75, KTs:0.6, K9s:0.25, QJs:0.75, QTs:0.7, JTs:0.3, T9s:0.3, 54s:0.1, AKo:0.8, AQo:0.6, KQo:0.25",
      call:  "QQ:0.2, TT-JJ:0.3, 88-99:0.45, 77:0.5, 66:0.7, 55:0.3, 44:0.25, 33:0.2, 22:0.3, AQs:0.1, AJs:0.6, ATs:0.35, A9s:0.25, A8s:0.5, A7s:0.1, A5s:0.15, A4s:0.25, A3s:0.1, KQs:0.5, KJs:0.25, KTs:0.4, QJs:0.25, QTs:0.3, JTs:0.7, T9s:0.4, 98s:0.2, 76s:0.25, 65s:0.25, 54s:0.6, AKo:0.2, AQo:0.4, KQo:0.05, KJo:0.1"
    },
    SB_vs_UTG: {
      raise: "QQ+, JJ:0.7, TT:0.45, 77-99:0.3, 66:0.15, AQs+, ATs-AJs:0.4, A8s:0.1, A5s:0.75, A4s:0.85, A3s:0.3, KQs:0.9, KTs-KJs:0.7, QJs:0.6, QTs:0.5, JTs:0.55, T9s:0.1, 65s:0.15, 54s:0.05, AKo, AQo:0.65, AJo:0.1, KQo:0.25",
      call:  "JJ:0.3, TT:0.55, 88-99:0.7, 77:0.55, 66:0.6, 55:0.3, 44:0.25, 33:0.3, 22:0.5, ATs-AJs:0.6, A9s:0.45, A8s:0.35, A5s:0.25, A4s:0.15, KQs:0.1, KTs-KJs:0.3, QJs:0.4, QTs:0.35, JTs:0.4, T9s:0.15, 76s:0.15, 65s:0.25, 54s:0.35, AQo:0.35"
    },
    BB_vs_UTG: {
      raise: "QQ+, JJ:0.4, TT:0.1, AQs+, AJs:0.2, ATs:0.35, A7s:0.15, A6s:0.35, A5s:0.45, A4s:0.55, A3s:0.4, A2s:0.3, KQs:0.85, KJs:0.45, KTs:0.3, K9s:0.15, K8s:0.2, K7s:0.25, K6s:0.15, K5s:0.1, K4s:0.2, QJs:0.6, QTs:0.1, Q9s:0.2, JTs:0.3, T9s:0.25, T8s:0.35, T7s:0.2, 87s:0.45, 76s:0.2, 65s:0.35, 54s:0.2, AKo, AQo:0.2, KQo:0.35, KJo:0.1",
      call:  "JJ:0.6, TT:0.9, 22-99, AJs:0.8, ATs:0.65, A8s-A9s, A7s:0.85, A6s:0.65, A5s:0.55, A4s:0.45, A3s:0.6, A2s:0.7, KQs:0.15, KJs:0.55, KTs:0.7, K9s:0.85, K8s:0.8, K7s:0.75, K6s:0.85, K5s:0.9, K4s:0.8, K2s-K3s:0.2, QJs:0.4, QTs:0.9, Q9s:0.8, Q8s, Q6s, Q5s:0.25, JTs:0.7, J8s-J9s, T9s:0.75, T8s:0.65, T7s:0.8, 96s+, 87s:0.55, 86s, 85s:0.95, 76s:0.8, 75s, 65s:0.65, 63s-64s, 54s:0.8, 53s, 52s:0.6, 43s, 42s:0.4, AQo:0.8, ATo-AJo, KQo:0.65, KJo:0.6, KTo:0.25, QJo:0.3, QTo:0.15, JTo:0.45"
    },
    /* Facing an open from 9-max UTG / UTG+1 / UTG+2: PokerCoaching's 8-max 100bb cash charts vs a UTG open (8-max
       UTG has the same players behind as 9-max UTG+1), rounded to 5%, via a third-party copy of that data. HJ_vs_EP9
       (UTG+1..HJ responding) averages the 8-max UTG+1, LJ and HJ charts. A UTG+2 open is a little wider than these
       charts assume; no chart built for it is available, and this is closer to it than the 6-max UTG charts. */
    HJ_vs_EP9: {
      raise: "AA, KK:0.7, QQ:0.3, TT-JJ:0.1, 88-99:0.2, 77:0.15, AKs:0.8, ATs-AJs:0.05, A8s-A9s:0.1, A7s:0.55, A5s:0.6, A4s:0.55, A3s:0.1, KQs:0.3, KJs:0.95, KTs:0.8, K9s:0.05, K5s:0.05, JTs:0.2, T9s:0.05, 76s:0.1, 65s:0.5, 54s:0.05, AKo:0.65, AQo:0.1",
      call:  "KK:0.3, QQ:0.7, TT-JJ:0.9, 99:0.65, 88:0.4, 66-77:0.25, 55:0.05, AKs:0.2, AQs, ATs-AJs:0.95, A5s:0.4, A4s:0.25, KQs:0.7, KJs:0.05, KTs:0.2, QJs:0.35, JTs:0.65, 76s:0.05, 65s:0.45, 54s:0.2, AKo:0.35"
    },
    CO_vs_EP9: {
      raise: "AA, KK:0.85, QQ:0.25, TT-JJ:0.1, 99:0.25, 88:0.2, 77:0.15, AKs:0.95, AJs:0.1, A9s:0.2, A8s:0.4, A7s:0.25, A5s:0.8, A4s:0.25, A3s:0.3, KQs:0.1, KJs, KTs:0.85, K9s:0.05, K5s:0.05, QJs:0.15, JTs:0.2, T9s:0.2, 76s:0.1, 65s:0.5, 54s:0.05, AKo:0.5, AQo:0.2",
      call:  "KK:0.15, QQ:0.75, TT-JJ:0.9, 99:0.75, 88:0.8, 77:0.4, 66:0.35, 55:0.25, AKs:0.05, AQs, AJs:0.9, ATs, A9s:0.65, A5s:0.2, A4s:0.7, KQs:0.9, KTs:0.15, QJs:0.8, QTs:0.45, JTs:0.8, T9s:0.1, 76s:0.15, 65s:0.5, 54s:0.35, AKo:0.5, AQo:0.25"
    },
    BTN_vs_EP9: {
      raise: "AA, KK:0.9, QQ:0.3, JJ:0.15, TT:0.05, 99:0.15, 88:0.25, 77:0.15, AKs:0.95, AJs:0.25, A8s:0.6, A7s:0.4, A5s:0.75, A4s:0.3, A3s:0.15, A2s:0.1, KQs:0.1, KJs, KTs:0.5, K9s:0.25, K5s:0.25, QJs:0.1, JTs:0.25, T9s:0.4, 76s:0.15, 65s:0.4, 54s:0.15, AKo:0.5, AQo:0.25",
      call:  "KK:0.1, QQ:0.7, JJ:0.85, TT:0.95, 99:0.85, 88:0.75, 77:0.65, 66:0.4, 55:0.85, AKs:0.05, AQs, AJs:0.75, A9s-ATs, A8s:0.1, A5s:0.25, A4s:0.7, A3s:0.3, KQs:0.9, KTs:0.5, QJs:0.9, QTs, JTs:0.75, T9s:0.55, 76s:0.35, 65s:0.6, 54s:0.6, AKo:0.5, AQo:0.7"
    },
    SB_vs_EP9: {
      raise: "KK+, QQ:0.75, TT-JJ:0.3, 99:0.15, 88:0.1, 66-77:0.05, AKs, AJs:0.45, ATs:0.4, A5s, A4s:0.05, KQs:0.3, KJs:0.75, KTs:0.5, JTs:0.2, 65s:0.6, 54s:0.05, AKo:0.8",
      call:  "QQ:0.25, TT-JJ:0.7, 99:0.45, 88:0.3, 77:0.2, 66:0.15, 55:0.3, AQs, AJs:0.55, ATs:0.6, A4s:0.15, KQs:0.7, KJs:0.25, KTs:0.1, QJs:0.15, JTs:0.45, 65s:0.05, AKo:0.2"
    },
    BB_vs_EP9: {
      raise: "KK+, QQ:0.55, JJ:0.05, TT:0.1, 99:0.05, 88:0.15, 66:0.2, AKs, AJs:0.1, A7s:0.05, A6s:0.25, A5s:0.9, A4s:0.1, A3s:0.5, KJs:0.4, KTs:0.6, K9s:0.25, QTs+:0.15, J9s+:0.05, T9s:0.2, 87s:0.1, 76s:0.15, 65s:0.5, 54s:0.1, AKo:0.6",
      call:  "QQ:0.45, JJ:0.95, TT:0.9, 99:0.95, 88:0.85, 77, 66:0.8, 33-55, 22:0.75, AQs, AJs:0.9, A8s-ATs, A7s:0.95, A6s:0.65, A5s:0.1, A4s:0.9, A3s:0.5, KQs, KJs:0.6, K9s-KTs:0.4, QTs+:0.85, J9s+:0.95, T9s:0.8, T8s, 97s:0.05, 87s:0.6, 76s:0.85, 65s:0.5, 54s:0.9, AKo:0.4, AQo, KQo:0.15"
    },
    CO_vs_HJ: {
      raise: "QQ+, JJ:0.8, 88-TT:0.9, 77:0.8, 66:0.35, AQs+, AJs:0.8, ATs:0.85, A9s, A8s:0.65, A6s:0.2, A5s, A4s:0.75, KQs:0.8, KJs, KTs:0.9, K9s:0.05, QTs+:0.95, JTs:0.1, AKo, AQo:0.95, KQo:0.3, KJo:0.05",
      call:  "JJ:0.2, 77-TT:0.1, 66:0.15, 55:0.05, 44:0.1, AJs:0.2, ATs:0.15, A8s:0.1, A4s:0.05, KQs:0.2, KTs:0.1, K9s:0.05, QTs+:0.05, JTs:0.1, T9s:0.05, 65s:0.05, 54s:0.1, AQo:0.05"
    },
    BTN_vs_HJ: {
      raise: "QQ+, JJ:0.7, TT:0.75, 99:0.65, 88:0.7, 77:0.55, 66:0.45, 55:0.1, AQs+, AJs:0.4, ATs:0.6, A9s, A8s:0.55, A7s:0.65, A6s:0.75, A5s:0.8, A4s:0.7, KQs:0.55, KJs:0.75, KTs:0.55, K9s:0.8, QJs:0.85, QTs:0.7, JTs:0.35, T9s:0.6, AKo:0.9, AQo:0.65, AJo:0.35, ATo:0.05, KQo:0.45, KJo:0.05",
      call:  "JJ:0.3, TT:0.25, 99:0.35, 88:0.3, 77:0.45, 66:0.55, 55:0.35, 44:0.3, 33:0.2, 22:0.3, AJs:0.6, ATs:0.4, A8s:0.45, A7s:0.35, A6s:0.25, A5s:0.2, A4s:0.3, A3s:0.2, KQs:0.45, KJs:0.25, KTs:0.45, QJs:0.15, QTs:0.3, JTs:0.65, J9s:0.05, T9s:0.4, 98s:0.35, 76s:0.15, 65s:0.2, 54s:0.45, AKo:0.1, AQo:0.35, ATo-AJo:0.1, KQo:0.2, KJo:0.1"
    },
    SB_vs_HJ: {
      raise: "QQ+, JJ:0.9, TT:0.65, 99:0.45, 88:0.3, 77:0.35, 66:0.25, 55:0.1, AQs+, AJs:0.45, ATs:0.35, A9s:0.3, A8s:0.4, A7s:0.1, A6s:0.25, A5s:0.6, A4s:0.85, A3s:0.5, A2s:0.1, KQs:0.8, KJs, KTs:0.65, K9s:0.05, QTs+:0.7, JTs:0.65, T9s:0.6, 98s:0.1, AKo, AQo:0.9, ATo:0.05, KQo:0.45, KJo:0.05",
      call:  "JJ:0.1, TT:0.35, 99:0.55, 88:0.7, 77:0.65, 66:0.75, 55:0.4, 44:0.3, 33:0.35, 22:0.55, AJs:0.55, ATs:0.65, A9s:0.7, A8s:0.6, A7s:0.15, A6s:0.3, A5s:0.4, A4s:0.15, A3s:0.1, KQs:0.2, KTs:0.35, QTs+:0.3, JTs:0.35, T9s:0.3, 98s:0.15, 65s:0.2, 54s:0.25, AQo:0.1, AJo:0.15, KQo:0.35"
    },
    BB_vs_HJ: {
      raise: "QQ+, JJ:0.8, TT:0.3, AKs, AQs:0.9, ATs:0.2, A6s-A7s:0.3, A5s:0.35, A4s:0.3, A3s:0.25, A2s:0.3, KQs:0.5, KJs, KTs:0.35, K9s:0.2, K7s:0.2, K6s:0.5, K4s:0.15, QJs:0.6, QTs:0.5, Q9s:0.35, JTs:0.5, J9s:0.1, T9s:0.4, T8s:0.35, T7s:0.1, 87s:0.4, 76s:0.35, 65s:0.4, 54s:0.3, 43s:0.1, AKo, AQo:0.6, AJo:0.1, ATo:0.15, KQo:0.3, KJo:0.35, KTo:0.1, QJo:0.15",
      call:  "JJ:0.2, TT:0.7, 22-99, AQs:0.1, AJs, ATs:0.8, A8s-A9s, A6s-A7s:0.7, A5s:0.65, A4s:0.7, A3s:0.75, A2s:0.7, KQs:0.5, KTs:0.65, K9s:0.8, K8s, K7s:0.8, K6s:0.5, K5s, K4s:0.85, K3s:0.95, K2s:0.35, QJs:0.4, QTs:0.5, Q9s:0.65, Q8s, Q7s:0.35, Q5s-Q6s, Q4s:0.1, JTs:0.5, J9s:0.9, J8s, J7s:0.4, T9s:0.6, T8s:0.65, T7s:0.85, T6s:0.05, 96s+, 87s:0.6, 85s-86s, 76s:0.65, 75s, 74s:0.65, 65s:0.6, 63s-64s, 54s:0.7, 52s-53s, 43s:0.9, 42s:0.35, AQo:0.4, AJo:0.9, ATo:0.85, A9o:0.6, A5o:0.05, A3o:0.1, KQo:0.7, KJo:0.65, KTo:0.8, QJo:0.85, QTo:0.5, JTo:0.5, T9o:0.05, 76o:0.1, 65o:0.15"
    },
    BTN_vs_CO: {
      raise: "QQ+, JJ:0.9, 99-TT:0.85, 77-88:0.8, 66:0.65, 55:0.3, 44:0.05, AQs+, AJs:0.8, ATs:0.65, A9s:0.85, A8s:0.8, A5s-A7s:0.85, A4s:0.8, A3s:0.05, KQs:0.8, KJs:0.85, KTs:0.7, K9s, K8s:0.05, K5s-K7s:0.1, QJs:0.85, QTs:0.7, Q9s:0.2, JTs:0.8, J9s:0.5, T9s:0.9, 98s:0.25, AKo, AQo:0.85, AJo:0.75, ATo:0.4, A9o:0.1, KQo:0.8, KTo:0.1, QTo:0.05, JTo:0.1",
      call:  "JJ:0.1, 99-TT:0.15, 77-88:0.2, 66:0.35, 55:0.25, 44:0.2, 22-33:0.15, AJs:0.2, ATs:0.35, A9s:0.15, A8s:0.2, A5s-A7s:0.15, A4s:0.2, A3s:0.05, KQs:0.2, KJs:0.15, KTs:0.3, QJs:0.15, QTs:0.3, JTs:0.2, J9s:0.1, T9s:0.1, 98s:0.25, 76s:0.1, 65s:0.05, 54s:0.15, AQo:0.15, AJo:0.2, KQo:0.1"
    },
    SB_vs_CO: {
      raise: "JJ+, TT:0.9, 99:0.8, 88:0.55, 77:0.5, 66:0.4, 44-55:0.1, AQs+, AJs:0.9, ATs:0.65, A8s-A9s:0.4, A7s:0.05, A6s:0.45, A5s:0.6, A4s:0.75, KQs:0.9, KJs:0.8, KTs:0.6, K9s:0.8, K8s:0.1, QJs:0.85, QTs:0.7, JTs:0.85, T9s:0.8, AQo+, AJo:0.65, ATo:0.05, KQo:0.75, KJo:0.3, QJo:0.1",
      call:  "TT:0.1, 99:0.2, 88:0.45, 77:0.4, 66:0.6, 33-55:0.3, 22:0.45, AJs:0.1, ATs:0.35, A8s-A9s:0.6, A7s:0.1, A6s:0.25, A5s:0.4, A4s:0.25, A3s:0.05, KQs:0.1, KJs:0.2, KTs:0.35, K9s:0.2, QJs:0.15, QTs:0.3, Q9s:0.05, JTs:0.15, J9s:0.05, T9s:0.2, 98s:0.1, 65s:0.1, AJo:0.35, KQo:0.25"
    },
    BB_vs_CO: {
      raise: "JJ+, TT:0.75, 99:0.2, AQs+, AJs:0.7, A7s:0.2, A6s:0.45, A5s:0.6, A4s:0.35, A2s:0.2, KQs:0.75, KJs, KTs:0.85, K9s:0.2, K6s:0.6, K4s:0.15, K2s-K3s:0.1, Q9s:0.2, Q8s:0.25, JTs:0.7, J9s:0.4, J8s:0.1, T9s, T8s:0.1, T7s:0.2, 87s:0.5, 76s:0.4, 65s:0.45, 54s:0.3, 53s:0.1, 43s:0.1, AKo, AQo:0.9, AJo:0.05, ATo:0.25, A8o:0.1, A5o:0.1, A4o:0.05, KQo:0.4, KJo:0.5, KTo:0.15, QJo:0.4, QTo:0.3, JTo:0.15",
      call:  "TT:0.25, 99:0.8, 22-88, AJs:0.3, A8s-ATs, A7s:0.8, A6s:0.55, A5s:0.4, A4s:0.65, A3s, A2s:0.8, KQs:0.25, KTs:0.15, K9s:0.8, K7s-K8s, K6s:0.4, K5s, K4s:0.85, K2s-K3s:0.9, QTs+, Q9s:0.8, Q8s:0.75, Q4s-Q7s, Q3s:0.5, Q2s:0.1, JTs:0.3, J9s:0.6, J8s:0.9, J6s-J7s, T8s:0.9, T7s:0.8, T6s:0.65, 96s+, 87s:0.5, 85s-86s, 76s:0.6, 74s-75s, 65s:0.55, 63s-64s, 54s:0.7, 53s:0.9, 52s, 43s:0.9, 42s:0.5, AQo:0.1, AJo:0.95, ATo:0.75, A9o, A8o:0.55, A5o:0.4, KQo:0.6, KJo:0.5, KTo:0.85, K6o:0.1, QJo:0.6, QTo:0.7, JTo:0.85, T9o:0.5"
    },
    SB_vs_BTN: {
      raise: "JJ+, 88-TT:0.85, 77:0.7, 66:0.5, 55:0.4, 44:0.15, AQs+, AJs:0.85, ATs:0.9, A9s:0.15, A8s:0.45, A7s:0.6, A6s:0.55, A5s:0.85, A4s:0.5, A3s:0.35, KQs, KTs-KJs:0.9, K9s:0.6, QJs:0.45, QTs:0.7, Q9s:0.65, J9s+:0.9, J8s:0.1, T9s:0.8, T8s:0.75, AKo, AQo:0.9, AJo, ATo:0.8, A8o:0.1, KQo:0.9, KJo:0.7, KTo:0.35, JTo:0.05",
      call:  "88-TT:0.15, 77:0.3, 66:0.5, 55:0.6, 44:0.55, 33:0.45, 22:0.65, AJs:0.15, ATs:0.1, A9s:0.85, A8s:0.55, A7s:0.4, A6s:0.45, A5s:0.15, A4s:0.5, A3s:0.45, KTs-KJs:0.1, K9s:0.4, K8s:0.05, QJs:0.55, QTs:0.3, Q9s:0.35, J9s+:0.1, T9s:0.2, T8s:0.15, 98s:0.15, 76s:0.05, 65s:0.1, AQo:0.1, ATo:0.2, KQo:0.1, KJo:0.15"
    },
    BB_vs_BTN: {
      raise: "TT+, 99:0.85, 88:0.35, AJs+, ATs:0.15, A6s-A7s:0.05, A5s, A4s:0.35, KQs:0.9, KTs-KJs, K9s:0.35, K6s:0.15, QJs:0.15, QTs:0.3, Q8s:0.1, JTs:0.6, J9s:0.15, J8s:0.1, J7s:0.3, J5s:0.3, T8s+, T6s-T7s:0.45, 98s:0.65, 87s:0.55, 76s:0.85, 65s:0.4, 54s:0.7, 53s:0.1, AQo+, AJo:0.6, ATo:0.45, A8o:0.1, A6o-A7o:0.25, A5o:0.1, A4o:0.3, KQo:0.45, KJo:0.25, KTo:0.4, K9o:0.25, QJo:0.05, Q9o-QTo:0.15, JTo:0.35, J9o:0.45",
      call:  "99:0.15, 88:0.65, 22-77, ATs:0.85, A8s-A9s, A6s-A7s:0.95, A4s:0.65, A2s-A3s, KQs:0.1, K9s:0.65, K7s-K8s, K6s:0.85, K2s-K5s, QJs:0.85, QTs:0.7, Q9s, Q8s:0.9, Q2s-Q7s, JTs:0.4, J9s:0.85, J8s:0.9, J7s:0.7, J6s, J5s:0.7, J2s-J4s, T6s-T7s:0.55, T5s, T4s:0.6, T3s:0.15, 98s:0.35, 96s-97s, 95s:0.9, 87s:0.45, 85s-86s, 76s:0.15, 74s-75s, 65s:0.6, 64s, 63s:0.9, 54s:0.3, 53s:0.9, 52s, 42s+, 32s:0.7, AJo:0.4, ATo:0.55, A9o, A8o:0.9, A6o-A7o:0.75, A5o:0.9, A4o:0.7, KQo:0.55, KJo:0.75, KTo:0.6, K9o:0.75, K8o:0.25, K2o:0.1, QJo:0.95, Q9o-QTo:0.85, JTo:0.65, J9o:0.55, T9o, T8o:0.85, 98o:0.4, 87o:0.2, 76o:0.45, 65o:0.2, 54o:0.2"
    },
    BB_vs_SB: {
      raise: "TT+, 99:0.4, 88:0.25, 66-77:0.15, AJs+, ATs:0.55, A5s, A4s:0.7, A3s:0.1, KJs+, KTs:0.8, J6s-J7s:0.4, J5s:0.65, J4s:0.4, J3s:0.1, J2s:0.05, T9s:0.45, T7s:0.2, T6s:0.5, T5s:0.25, T4s:0.6, T3s:0.05, T2s:0.35, 98s:0.25, 97s:0.3, 96s:0.25, 95s:0.6, 94s:0.05, 93s:0.3, 92s:0.05, 87s:0.3, 86s:0.35, 85s:0.25, 84s:0.3, 83s:0.05, 82s:0.1, 76s:0.65, 73s:0.25, 65s:0.35, 62s:0.1, 54s:0.5, 32s:0.1, AKo, AQo:0.75, ATo:0.05, A7o:0.35, A6o:0.4, A5o:0.1, A4o:0.15, A3o:0.3, A2o:0.5, KQo:0.2, KJo:0.05, K9o-KTo:0.1, K8o:0.3, K7o:0.4, K6o:0.45, K4o-K5o:0.25, QJo:0.2, QTo:0.1, Q9o:0.25, Q8o:0.2, Q6o:0.2, Q5o:0.15, JTo:0.25, J9o:0.35, J8o:0.3, J7o:0.25, T9o:0.3, T8o:0.2, T7o:0.45, T6o:0.1, 98o:0.2, 97o:0.15, 87o:0.05, 86o:0.1, 65o:0.1, 53o+:0.15",
      call:  "99:0.6, 88:0.75, 66-77:0.85, 22-55, ATs:0.45, A6s-A9s, A4s:0.3, A3s:0.9, A2s, KTs:0.2, K2s-K9s, Q2s+, J8s+, J6s-J7s:0.6, J5s:0.35, J4s:0.6, J3s:0.9, J2s:0.95, T9s:0.55, T8s, T7s:0.8, T6s:0.5, T5s:0.75, T4s:0.4, T3s:0.95, T2s:0.65, 98s:0.75, 97s:0.7, 96s:0.75, 95s:0.4, 94s:0.95, 93s:0.7, 92s:0.95, 87s:0.7, 86s:0.65, 85s:0.75, 84s:0.7, 83s:0.95, 82s:0.9, 76s:0.35, 74s-75s, 73s:0.75, 72s:0.8, 65s:0.65, 63s-64s, 62s:0.9, 54s:0.5, 52s-53s, 42s+, 32s:0.9, AQo:0.25, AJo, ATo:0.95, A8o-A9o, A7o:0.65, A6o:0.6, A5o:0.9, A4o:0.85, A3o:0.7, A2o:0.5, KQo:0.8, KJo:0.95, K9o-KTo:0.9, K8o:0.7, K7o:0.6, K6o:0.55, K4o-K5o:0.75, K3o:0.05, QJo:0.8, QTo:0.9, Q9o:0.75, Q8o:0.8, Q7o:0.15, Q6o:0.8, Q5o:0.85, JTo:0.75, J9o:0.65, J8o:0.7, J7o:0.75, T9o:0.7, T8o:0.8, T7o:0.55, T6o:0.35, 98o:0.8, 97o:0.85, 96o:0.05, 87o:0.95, 86o:0.9, 76o, 75o:0.8, 65o:0.9, 64o:0.75, 53o+:0.85, 43o:0.25"
    }
  };

  /* ---------------- FACING A 3-BET (opener_vs_3bettor) ----------------
     raise = 4-bet, call = flat the 3-bet, everything else folds. */
  const VS_3BET = {
    UTG_vs_HJ: {
      raise: "KK+, QQ:0.45, JJ:0.25, TT:0.05, 99:0.1, 88:0.05, AKs, AJs:0.3, ATs:0.1, A7s:0.15, A5s:0.45, A4s:0.3, A3s:0.25, KQs:0.8, KJs:0.1, KTs:0.25, K6s:0.35, AKo:0.75, AQo:0.3",
      call:  "QQ:0.55, JJ:0.75, TT:0.95, 99:0.9, 77-88:0.6, 66:0.85, 55:0.95, 22-44, AQs, AJs:0.7, ATs:0.9, A5s:0.55, A4s:0.35, A3s:0.2, KQs:0.2, KJs:0.9, KTs:0.75, QJs:0.75, QTs:0.4, JTs:0.65, T9s:0.7, 98s:0.95, 87s, 76s, 65s, 54s, AKo:0.25, AQo:0.15, KQo:0.05"
    },
    UTG_vs_CO: {
      raise: "KK+, QQ:0.55, JJ:0.25, 99:0.1, 88:0.05, AKs, AJs:0.4, A5s:0.45, A4s:0.4, A3s:0.2, KQs:0.8, KJs:0.1, KTs:0.25, K6s:0.75, AKo:0.75, AQo:0.35",
      call:  "QQ:0.45, JJ:0.75, 99-TT:0.9, 88:0.8, 77:0.65, 66:0.9, 22-55, AQs, AJs:0.6, ATs, A6s:0.2, A5s:0.55, A4s:0.45, A3s:0.15, KQs:0.2, KJs:0.9, KTs:0.75, K6s:0.2, QJs, QTs:0.3, JTs:0.75, T9s:0.75, 98s, 87s, 76s, 65s, 54s, AKo:0.25, AQo:0.2, KQo:0.1"
    },
    UTG_vs_BTN: {
      raise: "KK+, QQ:0.45, JJ:0.25, 88-99:0.05, AKs, AJs:0.25, A9s:0.05, A8s:0.15, A5s:0.5, A4s:0.4, A3s:0.2, KQs:0.7, KJs:0.2, KTs:0.25, K6s:0.55, AKo:0.75, AQo:0.4",
      call:  "QQ:0.55, JJ:0.75, TT:0.9, 88-99:0.95, 77:0.85, 22-66, AQs, AJs:0.75, ATs, A9s:0.75, A8s:0.15, A6s:0.35, A4s-A5s:0.5, KQs:0.3, KJs:0.8, KTs:0.75, QJs, QTs:0.5, JTs:0.85, T9s:0.85, 98s:0.9, 87s, 76s, 65s, 54s, AKo:0.25, AQo:0.3, KQo:0.1"
    },
    UTG_vs_SB: {
      raise: "AA, KK:0.7, JJ:0.3, 99:0.1, AKs:0.85, AJs:0.2, A5s:0.3, A4s:0.2, A3s:0.15, KJs+:0.15, KTs:0.25, AKo:0.45, AQo:0.2",
      call:  "KK:0.3, QQ, JJ:0.7, TT, 99:0.6, 88:0.45, 77:0.3, 66:0.45, 55:0.1, 44:0.5, 33:0.9, 22, AKs:0.15, AQs, AJs:0.8, ATs:0.85, A5s:0.7, A4s:0.05, KJs+:0.85, KTs:0.3, JTs:0.3, T9s:0.3, 87s:0.2, 76s, 65s:0.95, 54s:0.9, AKo:0.55, AQo:0.2, AJo:0.1"
    },
    UTG_vs_BB: {
      raise: "AA, KK:0.65, JJ:0.15, 99-TT:0.05, AKs:0.5, ATs:0.1, A9s:0.2, A6s:0.05, A4s-A5s:0.25, A3s:0.3, A2s:0.15, KQs:0.1, KTs-KJs:0.2, AKo:0.45, AQo:0.2",
      call:  "KK:0.35, QQ, TT-JJ:0.85, 99:0.5, 88:0.45, 77:0.3, 66:0.45, 55:0.35, 44:0.7, 33:0.6, 22:0.75, AKs:0.5, AQs, ATs-AJs:0.9, A6s:0.15, A5s:0.75, A4s:0.1, KQs:0.9, KJs:0.3, QJs:0.15, QTs:0.2, T9s:0.2, 87s, 76s, 65s:0.65, 54s:0.3, AKo:0.55, AQo:0.05"
    },
    /* 9-max UTG / UTG+1 / UTG+2 facing a 3-bet: PokerCoaching's 8-max 100bb cash UTG and UTG+1 opener charts,
       averaged per hand over the openers that open it, rounded to 5%. EP9_vs_HJ covers any 3-bettor from UTG+1 to
       HJ (8-max UTG+1/LJ/HJ 3-bets). */
    EP9_vs_HJ: {
      raise: "AA, KK:0.95, QQ:0.1, JJ:0.25, 99:0.05, AKs:0.35, AQs:0.15, AJs:0.4, ATs:0.05, A5s:0.5, KJs+:0.05, KTs:0.1, AKo:0.7",
      call:  "KK:0.05, QQ:0.9, JJ:0.6, TT:0.2, 99:0.35, 88:0.4, 77:0.75, 55-66, 22-44:0.8, AKs:0.65, AQs:0.85, AJs:0.3, ATs:0.35, A5s:0.15, KQs:0.2, JTs:0.3, T9s:0.55, 98s:0.5, 65s, 54s, AKo:0.25"
    },
    EP9_vs_CO: {
      raise: "KK+, QQ:0.05, JJ:0.25, 99-TT:0.1, AKs:0.45, AQs:0.05, AJs:0.4, ATs:0.25, A5s:0.55, A4s:0.05, KQs:0.05, KJs:0.3, AKo:0.65",
      call:  "QQ:0.95, JJ:0.75, 99-TT:0.35, 88:0.55, 77:0.7, 55-66, 22-44:0.8, AKs:0.55, AQs:0.95, AJs:0.55, ATs:0.3, A5s:0.25, KQs:0.35, KJs:0.05, JTs:0.45, T9s:0.65, 98s:0.75, 65s, 54s, AKo:0.35"
    },
    EP9_vs_BTN: {
      raise: "KK+, QQ:0.05, JJ:0.25, 99-TT:0.1, AKs:0.4, AJs:0.45, ATs:0.35, A5s:0.5, A4s:0.05, KJs:0.2, KTs:0.1, AKo:0.65",
      call:  "QQ:0.95, JJ:0.75, TT:0.4, 99:0.3, 88:0.65, 77:0.7, 55-66, 22-44:0.8, AKs:0.6, AQs, AJs:0.4, ATs:0.6, A9s:0.05, A5s:0.2, KQs:0.65, JTs:0.5, T9s:0.75, 98s:0.75, 87s:0.5, 65s, 54s, AKo:0.35"
    },
    EP9_vs_SB: {
      raise: "AA:0.85, KK:0.35, ATs:0.1, A7s:0.05, A5s:0.15, A4s:0.4, A3s:0.05, KJs+:0.05, KTs:0.15, K9s:0.1, K6s:0.15, AKo:0.5",
      call:  "AA:0.15, KK:0.65, QQ, JJ:0.8, TT:0.05, 99:0.5, 88:0.6, 77:0.8, 66:0.65, 55:0.5, 44:0.4, 33:0.7, 22:0.8, AJs+, ATs:0.6, A5s:0.7, KQs:0.65, QJs:0.1, QTs:0.2, JTs:0.9, T9s, 87s:0.15, 65s, 54s, AKo:0.5"
    },
    EP9_vs_BB: {
      raise: "AA:0.8, KK:0.4, AQs:0.05, AJs:0.1, A9s:0.1, A7s:0.1, A5s:0.05, A4s:0.3, A3s:0.05, A2s:0.1, KTs-KJs:0.1, AKo:0.5",
      call:  "AA:0.2, KK:0.6, QQ, JJ:0.7, TT:0.25, 99:0.3, 77-88:0.8, 66, 55:0.6, 44:0.55, 33:0.5, 22:0.6, AKs, AQs:0.95, AJs:0.9, ATs, A8s:0.05, A5s:0.8, A4s:0.05, KQs:0.5, QTs+:0.15, JTs, T9s, 87s:0.5, 76s:0.8, 65s, 54s, AKo:0.5"
    },
    HJ_vs_CO: {
      raise: "KK+, QQ:0.9, JJ:0.35, 99:0.1, 77-88:0.05, AKs:0.9, AJs:0.15, A5s:0.45, A4s:0.4, A3s:0.3, A2s:0.1, KQs:0.85, KJs:0.2, KTs:0.25, K9s:0.1, K6s:0.35, AKo:0.9, AQo:0.55",
      call:  "QQ:0.1, JJ:0.65, TT, 99:0.85, 77-88:0.95, 66, 55:0.65, 22-44, AKs:0.1, AQs, AJs:0.8, ATs, A9s:0.8, A8s:0.1, A6s:0.35, A5s:0.55, A4s:0.35, KQs:0.15, KJs:0.8, KTs:0.75, K9s:0.2, K6s:0.4, QJs, QTs:0.7, JTs, T9s:0.9, 98s:0.4, 87s:0.3, 76s, 65s, 54s, AKo:0.1, AQo:0.45"
    },
    HJ_vs_BTN: {
      raise: "KK+, QQ:0.9, JJ:0.4, AKs:0.9, A8s:0.3, A7s:0.1, A5s:0.55, A4s:0.45, A3s:0.3, A2s:0.1, KQs:0.85, KJs:0.35, KTs:0.2, K9s:0.35, K6s:0.15, AKo:0.9, AQo:0.5, KQo:0.05",
      call:  "QQ:0.1, JJ:0.6, 99-TT, 88:0.85, 22-77, AKs:0.1, A9s-AQs, A8s:0.6, A7s:0.05, A6s:0.5, A5s:0.45, A4s:0.35, KQs:0.15, KJs:0.55, KTs:0.8, K9s:0.6, K6s:0.5, QTs+, JTs, J9s:0.05, T9s, 98s:0.55, 87s:0.7, 76s, 65s, 54s, AKo:0.1, AQo:0.5, KQo:0.05"
    },
    HJ_vs_SB: {
      raise: "AA, KK:0.9, QQ:0.05, JJ:0.3, AKs:0.55, AJs:0.25, A8s:0.05, A5s:0.3, A4s:0.25, A3s:0.15, KJs+:0.2, KTs:0.3, K9s:0.1, AKo:0.55, AQo:0.3",
      call:  "KK:0.1, QQ:0.95, JJ:0.7, 99-TT, 88:0.75, 77:0.45, 66:0.7, 55:0.1, 44:0.35, 33:0.5, 22:0.95, AKs:0.45, AQs, AJs:0.75, ATs, A9s:0.25, A5s:0.7, A4s:0.15, KJs+:0.8, KTs:0.7, QJs:0.55, JTs:0.9, T9s:0.25, 76s:0.6, 65s:0.95, 54s, AKo:0.45, AQo:0.6"
    },
    HJ_vs_BB: {
      raise: "AA, KK:0.85, QQ:0.15, JJ:0.2, TT:0.1, 99:0.05, AKs:0.55, AJs:0.05, A8s-A9s:0.35, A5s:0.25, A4s:0.3, A3s:0.25, KTs:0.35, AKo:0.55, AQo:0.4",
      call:  "KK:0.15, QQ:0.85, JJ:0.8, TT:0.9, 99:0.75, 88:0.6, 77:0.35, 66:0.55, 55:0.2, 33-44:0.35, 22:0.55, AKs:0.45, AQs, AJs:0.95, ATs, A8s:0.2, A5s:0.75, A4s:0.35, KJs+, KTs:0.6, K9s:0.1, QJs:0.5, QTs:0.25, JTs:0.2, J9s:0.1, T9s:0.15, 87s:0.05, 76s:0.65, 65s:0.55, 54s:0.6, AQo+:0.45"
    },
    CO_vs_BTN: {
      raise: "QQ+, JJ:0.8, TT:0.2, 88:0.1, AKs, A8s:0.4, A7s:0.3, A6s:0.25, A5s:0.45, A4s:0.4, A3s:0.15, KQs:0.65, KJs:0.9, KTs:0.05, K9s:0.15, QJs:0.05, J9s:0.25, T8s:0.1, AKo, AQo:0.5, AJo:0.1, KQo:0.25",
      call:  "JJ:0.2, TT:0.8, 99, 88:0.9, 77:0.95, 22-66, AJs-AQs, ATs:0.95, A9s, A8s:0.6, A7s:0.5, A6s:0.75, A5s:0.55, A4s:0.6, A3s:0.15, KQs:0.35, KJs:0.1, KTs:0.95, K9s:0.85, K8s:0.3, K7s:0.25, K6s:0.95, QJs:0.95, QTs, JTs:0.95, J9s:0.75, J8s:0.1, T9s:0.9, T8s:0.65, 98s, 97s:0.1, 87s:0.45, 76s, 65s, 54s, AQo:0.5, AJo:0.4, ATo:0.1, KQo:0.45"
    },
    CO_vs_SB: {
      raise: "KK+, QQ:0.5, JJ:0.2, TT:0.3, 99:0.1, AKs:0.9, ATs:0.25, A9s:0.1, A8s:0.25, A4s-A5s:0.3, A3s:0.05, KJs:0.1, KTs:0.15, K9s:0.2, AKo:0.5, AQo:0.25, AJo:0.3, KQo:0.35",
      call:  "QQ:0.5, JJ:0.8, TT:0.7, 99:0.9, 88, 77:0.8, 66, 55:0.2, 44:0.25, 33:0.4, 22:0.7, AKs:0.1, AJs-AQs, ATs:0.75, A9s:0.9, A5s:0.7, A4s:0.45, KQs, KJs:0.9, KTs:0.85, QJs:0.9, QTs, JTs:0.9, T9s:0.8, 97s:0.1, 76s:0.3, 65s:0.6, 54s, AKo:0.5, AQo:0.75, KQo:0.1"
    },
    CO_vs_BB: {
      raise: "KK+, QQ:0.65, JJ:0.25, TT:0.05, 99:0.1, 88:0.15, AKs, AJs-AQs:0.1, A9s:0.45, A8s:0.3, A5s:0.05, A4s:0.35, A3s:0.45, KTs:0.2, AKo:0.75, AQo:0.5, AJo:0.15, KQo:0.15, KJo:0.05",
      call:  "QQ:0.35, JJ:0.75, TT:0.95, 99:0.9, 88:0.8, 77:0.5, 66:0.75, 55:0.3, 44:0.35, 33:0.25, 22:0.35, AJs-AQs:0.9, ATs, A9s:0.55, A8s:0.3, A6s-A7s:0.1, A5s:0.95, A4s:0.55, A2s:0.1, KJs+, KTs:0.8, K8s:0.1, QJs:0.9, QTs:0.6, JTs:0.9, T9s:0.2, 76s:0.3, 65s:0.2, 54s:0.5, AKo:0.25, AQo:0.5, ATo:0.1, KQo:0.3"
    },
    BTN_vs_SB: {
      raise: "AA:0.75, QQ-KK, JJ:0.75, TT:0.25, 99:0.1, 88:0.15, 77:0.1, AKs, ATs:0.1, A9s:0.35, A8s:0.3, A7s:0.1, A5s:0.05, A3s-A4s:0.3, KTs:0.1, K9s:0.2, QJs:0.9, 76s:0.05, AKo:0.9, AQo:0.15, AJo:0.25, ATo:0.35, KQo:0.2, KJo:0.25",
      call:  "AA:0.25, JJ:0.25, TT:0.75, 99:0.9, 88:0.85, 77:0.9, 66, 55:0.95, 44:0.7, 33:0.55, 22:0.85, AJs-AQs, ATs:0.9, A9s:0.65, A8s:0.7, A6s-A7s:0.45, A5s:0.95, A4s:0.7, A3s:0.25, KJs+, KTs:0.9, K9s:0.8, QJs:0.1, QTs:0.95, Q9s:0.35, Q7s:0.1, JTs:0.95, J9s:0.9, J7s:0.1, T9s:0.95, T8s:0.55, 98s:0.95, 87s:0.05, 76s:0.85, 65s:0.55, 54s:0.8, AKo:0.1, AQo:0.85, AJo:0.75, A8o:0.1, KQo:0.8, K9o:0.1, T9o:0.1"
    },
    BTN_vs_BB: {
      raise: "AA:0.75, KK, QQ:0.75, JJ:0.9, TT:0.2, 99:0.1, 77-88:0.15, AKs, ATs:0.1, A8s:0.3, A6s-A7s:0.15, A5s:0.3, A4s:0.25, A3s:0.75, QJs:0.35, AKo, AQo:0.25, AJo:0.3, ATo:0.15, KQo:0.15, KTo-KJo:0.1",
      call:  "AA:0.25, QQ:0.25, JJ:0.1, TT:0.8, 99:0.9, 77-88:0.85, 66:0.95, 55:0.8, 44:0.6, 33:0.45, 22:0.35, AJs-AQs, A9s-ATs:0.9, A8s:0.7, A7s:0.85, A6s:0.8, A5s:0.7, A4s:0.75, A3s:0.25, K9s+, K6s:0.05, K4s:0.1, QJs:0.65, QTs:0.95, Q9s:0.3, JTs:0.95, J9s, T9s:0.95, T8s:0.9, 98s:0.15, 76s:0.55, 65s:0.4, 54s:0.45, AQo:0.75, AJo:0.7, ATo:0.2, KQo:0.75, KJo:0.2"
    },
    SB_vs_BB: {
      raise: "JJ+, TT:0.2, AKs, AQs:0.3, A3s:0.35, A2s, K6s:0.25, K5s:0.7, K4s, K3s:0.05, J8s:0.2, 97s:0.15, AKo, AQo:0.75, AJo:0.55, ATo:0.4, A9o:0.05, A5o:0.1, KQo:0.15, KJo:0.65, KTo:0.25, QJo:0.1, JTo:0.15",
      call:  "TT:0.8, 22-99, AQs:0.7, A4s-AJs, A3s:0.65, K7s+, K6s:0.75, K5s:0.3, Q8s+, Q6s:0.05, J9s+, J8s:0.8, T8s+, T7s:0.85, 98s, 97s:0.85, 86s+, 76s, 65s, 64s:0.4, 54s, 53s:0.25, AQo:0.25, AJo:0.45, ATo:0.6, KQo:0.85, KJo:0.35, KTo:0.7, QJo:0.6, QTo:0.15, JTo:0.5"
    }
  };

  /* ---------------- COLD 4-BET (someone opens, someone else 3-bets, hero has not acted) ----------------
     raise = cold 4-bet, call = cold call the 3-bet, everything else folds. The opener is still to act behind,
     so cold calls are rare and the range is mostly 4-bet-or-fold. The first charts are keyed by hero group
     (IP = any seat before the blinds, SB, BB) and opener tier (EP = UTG..HJ, LP = CO/BTN) and are only used by
     9-max seat combinations with no 6-max equivalent; every 6-max combination has its own chart below them. */
  const COLD_4BET = {
    IP_vs_EP: {
      raise: "KK+, QQ:0.75, JJ:0.5, TT:0.15, AKs:0.7, AQs:0.5, A9s:0.15, A5s:0.25, KQs:0.3, KTs:0.6, AKo:0.95",
      call:  "QQ:0.25, JJ:0.15, TT:0.1, AKs:0.3, AQs:0.1, AKo:0.05"
    },
    SB_vs_EP: {
      raise: "QQ+, JJ:0.15, TT:0.1, AKs, AQs:0.5, A5s:0.45, A4s:0.2, KQs:0.75, KJs:0.15, KTs:0.2, AKo",
      call:  ""
    },
    SB_vs_LP: {
      raise: "JJ+, TT:0.25, AQs+, AJs:0.15, A5s:0.15, KJs+, KTs:0.15, AKo, AQo:0.65",
      call:  ""
    },
    BB_vs_EP: {
      raise: "KK+, QQ:0.95, JJ:0.5, TT:0.15, AKs, AQs:0.65, A5s:0.55, A4s:0.2, KQs:0.75, KJs:0.1, AKo",
      call:  "JJ-QQ:0.05, AQs:0.05, QJs:0.1, JTs:0.1"
    },
    BB_vs_LP: {
      raise: "TT+, 88:0.05, AKs, AQs:0.95, AJs:0.55, A5s:0.05, KJs+, AKo:0.9, AQo:0.65",
      call:  "AQs:0.05, AKo:0.1"
    },
    /* BTN opens, SB 3-bets (~17% of hands, wide and linear-polar vs a BTN steal): the BB cold 4-bets ~4.5-5%,
       adding JJ, AQo, AJs and more Axs / KQs blockers to the CO-open lines above. The BTN can still 4-bet
       behind, so cold calls stay rare. Checked per hand against the 6-max solution (cold 4-bet ~5.7%). */
    BB_vs_BTN_SB: {
      raise: "QQ+, JJ:0.95, TT:0.9, 99:0.7, AKs, AJs-AQs:0.8, ATs:0.05, KQs:0.85, KJs, KTs:0.15, AQo+",
      call:  "JJ:0.05, TT:0.1, 88-99:0.05, AJs-AQs:0.2, ATs:0.05, KQs:0.15, KTs:0.05"
    },
    /* per-seat charts (hero_vs_opener_caller-or-3-bettor), from the reference solution */
    CO_vs_UTG_HJ: {
      raise: "QQ+, JJ:0.15, TT:0.1, AKs, AQs:0.05, A8s:0.1, A5s:0.2, KTs:0.8, AKo",
      call:  ""
    },
    BTN_vs_UTG_HJ: {
      raise: "KK+, QQ:0.7, JJ:0.25, TT:0.1, AKs:0.75, AQs:0.25, A8s-A9s:0.05, A5s:0.25, KQs:0.05, KTs:0.7, AKo:0.95",
      call:  "QQ:0.3, TT-JJ:0.1, AKs:0.25, AQs:0.05, 65s:0.05, AKo:0.05"
    },
    SB_vs_UTG_HJ: {
      raise: "QQ+, TT:0.05, AKs, A5s:0.25, KQs:0.55, KTs:0.15, K8s:0.05, K7s:0.15, K6s:0.05, AKo",
      call:  ""
    },
    BB_vs_UTG_HJ: {
      raise: "KK+, QQ:0.95, TT-JJ:0.15, AKs, AQs:0.15, A5s:0.45, A4s:0.05, KQs:0.6, AKo",
      call:  "QQ:0.05"
    },
    BTN_vs_UTG_CO: {
      raise: "KK+, QQ:0.7, JJ:0.35, TT:0.1, AKs:0.75, AQs:0.35, A9s:0.05, A5s:0.15, KTs:0.85, AKo:0.95",
      call:  "QQ:0.3, JJ:0.15, TT:0.1, AKs:0.25, AQs:0.1, 65s:0.05, AKo:0.05"
    },
    SB_vs_UTG_CO: {
      raise: "QQ+, TT:0.05, AKs, A5s:0.3, A4s:0.05, KQs:0.5, KTs:0.3, K7s:0.15, K6s:0.05, AKo",
      call:  ""
    },
    BB_vs_UTG_CO: {
      raise: "KK+, QQ:0.95, JJ:0.25, TT:0.15, AKs, AQs:0.35, A5s:0.4, A4s:0.1, KQs:0.5, KTs:0.05, AKo",
      call:  "JJ-QQ:0.05"
    },
    SB_vs_UTG_BTN: {
      raise: "QQ+, AKs, A5s:0.4, KQs:0.45, KTs:0.3, K9s:0.1, K6s-K7s:0.05, AKo",
      call:  ""
    },
    BB_vs_UTG_BTN: {
      raise: "KK+, QQ:0.95, JJ:0.3, TT:0.15, AKs, AQs:0.4, A5s:0.4, KQs:0.55, AKo",
      call:  "QQ:0.05"
    },
    BB_vs_UTG_SB: {
      raise: "KK+, QQ:0.85, AKs:0.95, AQs:0.25, A8s:0.05, A5s:0.25, KQs:0.35, KTs:0.2, K9s:0.3, AKo:0.95",
      call:  "QQ:0.15, TT-JJ:0.05, AKs:0.05, AQs:0.1, AKo:0.05"
    },
    BTN_vs_HJ_CO: {
      raise: "KK+, JJ-QQ:0.85, TT:0.2, AKs:0.9, AQs:0.85, A9s:0.45, A5s:0.2, KQs:0.85, KJs:0.05, KTs:0.2, AKo:0.95",
      call:  "JJ-QQ:0.15, TT:0.1, 99:0.05, AKs:0.1, AQs:0.15, AKo:0.05"
    },
    SB_vs_HJ_CO: {
      raise: "QQ+, JJ:0.25, TT:0.1, AQs+, A5s:0.5, A4s:0.2, KQs, KJs:0.25, KTs:0.1, K6s:0.1, AKo",
      call:  ""
    },
    BB_vs_HJ_CO: {
      raise: "QQ+, JJ:0.75, TT:0.1, 99:0.05, AQs+, AJs:0.1, A5s:0.75, A4s:0.25, KQs, KJs:0.25, AKo, AQo:0.05",
      call:  "JJ:0.05"
    },
    SB_vs_HJ_BTN: {
      raise: "QQ+, JJ:0.25, TT:0.1, AQs+, A8s:0.05, A5s:0.55, A4s:0.2, KQs, KJs:0.3, KTs:0.1, AKo",
      call:  ""
    },
    BB_vs_HJ_BTN: {
      raise: "QQ+, JJ:0.75, TT:0.1, AKs, AQs:0.95, A7s-A8s:0.1, A5s:0.7, A4s:0.1, KQs, KJs:0.25, AKo, AQo:0.1",
      call:  "JJ:0.05, AQs:0.05"
    },
    BB_vs_HJ_SB: {
      raise: "KK+, QQ:0.95, JJ:0.45, TT:0.05, AKs, AQs:0.9, A8s:0.25, A5s:0.15, KQs, KTs:0.05, K9s:0.1, AKo, AQo:0.2",
      call:  "TT-QQ:0.05, AQs:0.1"
    },
    SB_vs_CO_BTN: {
      raise: "JJ+, TT:0.25, AQs+, AJs:0.15, A5s:0.15, KJs+, KTs:0.15, AKo, AQo:0.65, KQo:0.05",
      call:  ""
    },
    BB_vs_CO_BTN: {
      raise: "TT+, 88:0.05, AKs, AQs:0.95, AJs:0.55, A5s:0.05, KJs+, KTs:0.05, AKo, AQo:0.65",
      call:  "AQs:0.05"
    },
    BB_vs_CO_SB: {
      raise: "QQ+, JJ:0.9, TT:0.35, AKs, AQs:0.75, AJs:0.65, KQs, KJs:0.45, AKo, AQo:0.55",
      call:  "TT-JJ:0.1, 99:0.05, AQs:0.25, KJs:0.05"
    }
  };

  /* ---------------- SQUEEZE (someone opens, someone else calls, hero has not acted) ----------------
     raise = squeeze, call = overcall, everything else folds. Same keys as COLD_4BET. The *_vs_EP fallbacks (two
     early 9-max seats ahead of hero) follow PokerCoaching's 8-max 100bb cash squeeze charts vs UTG open + UTG+1 call. */
  const SQUEEZE = {
    IP_vs_EP: {
      raise: "KK+, QQ:0.35, JJ:0.05, 99-TT:0.2, 88:0.1, 77:0.15, AKs:0.95, ATs-AQs:0.05, A8s:0.05, A7s:0.15, A5s:0.3, A4s:0.15, A3s:0.25, A2s:0.1, KQs:0.9, KJs:0.5, KTs:0.3, K9s:0.2, K8s:0.15, K7s:0.1, K6s:0.05, 76s:0.15, 65s:0.3, 54s:0.1, AKo:0.85, AQo:0.05",
      call:  "QQ:0.65, JJ:0.95, TT:0.6, 99:0.55, 88:0.85, 77:0.6, 66:0.4, 55:0.15, 44:0.2, 33:0.4, 22:0.3, AKs:0.05, AQs:0.95, AJs:0.7, ATs:0.35, A5s:0.4, A4s:0.25, A3s:0.05, KQs:0.1, KJs:0.35, KTs:0.25, QTs+:0.1, JTs:0.2, T9s:0.05, 76s:0.2, 65s:0.45, 54s:0.65, AKo:0.15"
    },
    SB_vs_EP: {
      raise: "KK+, QQ:0.95, JJ:0.05, TT:0.1, 99:0.15, 88:0.1, 77:0.15, AKs, AQs:0.25, A5s:0.45, A4s:0.1, KQs, KJs:0.4, KTs:0.3, K9s:0.05, K7s:0.05, 76s:0.1, 65s:0.6, 54s:0.05, AKo",
      call:  "QQ:0.05, JJ:0.95, TT:0.5, 99:0.7, 88:0.5, 77:0.6, 66:0.15, 55:0.2, 44:0.15, 22:0.25, AQs:0.75, AJs:0.95, A5s:0.3, A3s:0.25, KJs:0.2, KTs:0.05, QJs:0.05, JTs:0.05, 76s:0.3, 65s:0.15, 54s:0.2"
    },
    SB_vs_LP: {
      raise: "TT+, 99:0.15, AQs+, AJs:0.65, ATs:0.5, A7s-A8s:0.05, A5s:0.15, A4s:0.05, KTs+, K9s:0.3, QJs:0.2, QTs:0.3, JTs, J9s:0.8, T9s:0.6, 76s:0.05, 65s:0.15, AQo+, AJo:0.7, KQo:0.7, KJo:0.55",
      call:  "99:0.85, 22-88, AJs:0.35, ATs:0.5, A9s, A8s:0.75, A7s:0.2, A6s:0.15, A5s:0.85, A4s:0.55, A3s:0.25, K9s:0.35, QJs:0.8, QTs:0.7, J9s:0.15, T9s:0.4, 98s:0.2, 76s:0.25, 65s:0.3, 54s:0.35, AJo:0.15, KQo:0.3"
    },
    BB_vs_EP: {
      raise: "QQ+, TT:0.15, 88:0.15, 77:0.05, 66:0.1, AKs, AQs:0.5, A5s:0.15, A4s:0.6, KQs:0.9, KJs:0.25, KTs:0.3, K9s:0.6, K8s:0.05, 87s:0.25, 76s:0.15, 65s:0.25, 54s:0.05, AKo",
      call:  "JJ, TT:0.85, 99, 88:0.85, 77:0.95, 66:0.9, 22-55, AQs:0.5, ATs-AJs, A9s:0.85, A7s-A8s:0.35, A6s:0.1, A5s:0.8, A4s:0.35, A3s:0.95, A2s:0.2, KQs:0.1, KJs:0.75, KTs:0.65, K9s:0.05, K6s:0.2, QJs:0.95, QTs:0.2, JTs:0.95, T9s:0.15, T8s:0.05, 98s:0.1, 97s:0.4, 87s:0.2, 86s:0.3, 76s:0.7, 75s:0.1, 65s:0.75, 64s:0.55, 54s:0.9, 53s:0.05, AQo:0.25"
    },
    BB_vs_LP: {
      raise: "TT+, AQs+, AJs:0.1, A7s:0.25, A5s:0.05, KQs:0.85, KTs-KJs, K8s:0.1, K6s:0.35, QTs:0.6, JTs, J8s-J9s:0.4, T9s:0.05, T7s:0.2, AQo+, AJo:0.85, ATo:0.15, KQo:0.5, KJo:0.55, KTo:0.25, JTo:0.2",
      call:  "22-99, AJs:0.9, A8s-ATs, A7s:0.75, A6s, A5s:0.95, A2s-A4s, KQs:0.15, K9s, K7s-K8s:0.9, K6s:0.65, K5s, K4s:0.95, K3s:0.75, K2s:0.9, QJs, QTs:0.4, Q9s, Q8s:0.5, Q7s:0.05, Q6s:0.4, J8s-J9s:0.6, T8s+:0.95, T7s:0.6, 98s, 96s-97s:0.9, 86s+, 75s+, 64s+, 63s:0.8, 53s+, 52s:0.85, 43s, 42s:0.35, AJo:0.15, ATo:0.85, KQo:0.5, KJo:0.45, KTo:0.55, QJo:0.9, QTo:0.55, JTo:0.75, T9o:0.25, 54o:0.1"
    },
    /* BTN opens, SB flats (a thin, capped range), BB closes the action getting ~4:1 on a three-way pot, so it
       overcalls far wider (~29%) than vs CO open + caller, and squeezes a little wider than the LP chart above
       against the capped SB. Checked per hand against the 6-max solution (squeeze ~12.5%, overcall ~29%). */
    BB_vs_BTN_SB: {
      raise: "99+, AQs+, AJs:0.3, KQs:0.85, KJs, KTs:0.85, Q8s:0.15, Q7s:0.55, Q6s:0.4, Q5s:0.35, Q4s:0.7, Q2s:0.2, JTs:0.4, J7s:0.2, T8s+:0.05, T7s:0.2, T6s, AQo+, AJo:0.4, ATo:0.9, A9o:0.05, A8o:0.6, A7o:0.2, A5o:0.8, KQo:0.3, KTo:0.2, K9o:0.45, QTo+:0.35, Q9o:0.65, J9o:0.05, T9o:0.3",
      call:  "22-88, AJs:0.7, A2s-ATs, KQs:0.15, KTs:0.15, K2s-K9s, Q9s+, Q8s:0.85, Q7s:0.45, Q6s:0.6, Q5s:0.65, Q4s:0.25, Q3s:0.95, Q2s:0.75, JTs:0.6, J8s-J9s, J6s-J7s:0.75, T8s+:0.95, T7s:0.8, 96s+, 85s+, 75s+, 74s:0.95, 63s+, 52s+, 43s, 42s:0.95, AJo:0.6, ATo:0.1, A9o:0.95, A8o:0.35, KQo:0.7, KJo, KTo:0.8, K9o:0.05, QTo+:0.65, Q9o:0.15, JTo, J9o:0.65, T9o:0.7, T8o:0.6, 98o:0.5, 87o:0.75, 76o:0.55, 65o:0.75, 54o:0.95"
    },
    /* per-seat charts (hero_vs_opener_caller-or-3-bettor), from the reference solution */
    CO_vs_UTG_HJ: {
      raise: "QQ+, JJ:0.65, TT:0.5, 88-99:0.4, 77:0.3, 66:0.15, AKs, AQs:0.7, AJs:0.25, ATs:0.45, A5s:0.35, A4s:0.15, KQs, KJs:0.8, KTs:0.9, K9s:0.05, QJs:0.5, QTs:0.3, 76s:0.1, 65s:0.2, 54s:0.25, AKo:0.8, AQo:0.5",
      call:  "JJ:0.35, TT:0.5, 88-99:0.6, 77:0.7, 66:0.85, 55:0.5, 44:0.45, 33:0.5, 22:0.65, AQs:0.3, AJs:0.75, ATs:0.15, KJs:0.2, KTs:0.1, QJs:0.45, QTs:0.4, JTs:0.25, T9s:0.05, 65s:0.25, 54s:0.55, AKo:0.2, AQo:0.05"
    },
    BTN_vs_UTG_HJ: {
      raise: "QQ+, JJ:0.65, TT:0.45, 99:0.4, 88:0.35, 77:0.25, 66:0.1, AKs, AQs:0.9, AJs:0.1, ATs:0.7, A5s:0.4, KQs, KJs:0.75, KTs:0.8, K9s:0.1, QJs:0.45, QTs:0.35, 87s:0.15, 76s:0.2, 65s:0.2, 54s:0.3, AKo:0.8, AQo:0.6, KQo:0.05",
      call:  "JJ:0.35, TT:0.55, 99:0.6, 88:0.65, 77:0.75, 66:0.9, 55:0.85, 44:0.8, 22-33, AQs:0.1, AJs:0.9, ATs:0.25, A4s:0.3, KJs:0.25, KTs:0.2, QJs:0.55, QTs:0.65, JTs:0.7, T9s:0.3, 98s:0.1, 87s:0.1, 76s:0.3, 65s:0.7, 54s:0.7, AKo:0.2, AQo:0.3"
    },
    SB_vs_UTG_HJ: {
      raise: "QQ+, JJ:0.2, TT:0.05, 99:0.1, 88:0.15, AKs, AQs:0.95, A5s:0.4, A4s:0.3, KQs, KJs:0.6, KTs:0.7, K9s:0.25, K8s:0.05, K7s:0.1, QJs:0.65, QTs:0.35, 76s:0.25, 65s:0.25, 54s:0.2, AKo, AQo:0.45, KQo:0.2",
      call:  "JJ:0.8, TT:0.95, 99:0.9, 88:0.85, 22-77, AQs:0.05, AJs, ATs:0.6, A5s:0.1, A4s:0.5, A3s:0.35, KJs:0.4, KTs:0.3, QJs:0.35, QTs:0.6, JTs:0.75, T9s:0.1, 98s:0.05, 86s+:0.1, 76s:0.4, 65s:0.6, 54s:0.7, AQo:0.2"
    },
    BB_vs_UTG_HJ: {
      raise: "QQ+, JJ:0.1, TT:0.05, AKs, AQs:0.95, A7s:0.3, A5s:0.4, A4s:0.3, A3s:0.05, KQs, KJs:0.45, KTs:0.5, K9s:0.55, K8s:0.4, K6s-K7s:0.35, QJs:0.35, QTs:0.1, Q9s:0.05, 87s:0.1, 65s:0.05, AKo, AQo:0.45, KQo:0.35",
      call:  "JJ:0.9, TT:0.95, 22-99, AQs:0.05, ATs-AJs, A8s-A9s:0.9, A7s:0.45, A6s:0.9, A5s:0.6, A4s:0.7, A2s-A3s:0.95, KJs:0.55, KTs:0.5, K9s:0.4, K8s:0.15, K7s:0.35, K6s:0.6, K5s:0.5, K4s:0.05, K2s:0.1, QJs:0.65, QTs:0.9, Q9s:0.55, JTs, J9s:0.9, T9s:0.95, T8s:0.55, 98s, 97s:0.5, 87s:0.9, 86s, 76s, 75s:0.95, 65s:0.95, 64s, 63s:0.15, 53s+, 43s, 42s:0.05, AQo:0.55, KQo:0.55"
    },
    BTN_vs_UTG_CO: {
      raise: "QQ+, JJ:0.85, TT:0.6, 99:0.45, 88:0.4, 77:0.3, 66:0.1, AKs, AQs:0.8, AJs:0.4, ATs:0.6, A5s:0.5, KQs, KJs:0.85, KTs:0.9, K9s:0.3, QTs+:0.4, JTs:0.1, T9s:0.05, 87s:0.1, 76s:0.15, 65s:0.3, 54s:0.25, AQo+:0.8, KQo:0.2",
      call:  "JJ:0.15, TT:0.4, 99:0.55, 88:0.6, 77:0.7, 66:0.9, 55:0.8, 44:0.7, 33:0.8, 22, AQs:0.2, AJs:0.6, ATs:0.4, A5s:0.25, A4s:0.15, KJs:0.15, KTs:0.1, QTs+:0.6, JTs:0.85, T9s:0.4, 98s:0.2, 87s:0.05, 76s:0.25, 65s:0.4, 54s:0.75, AQo+:0.2, KQo:0.05"
    },
    SB_vs_UTG_CO: {
      raise: "QQ+, JJ:0.55, 88-99:0.05, AKs, AQs:0.65, AJs:0.2, A5s:0.5, A4s:0.25, KQs, KJs:0.95, K9s-KTs:0.5, K8s:0.35, K6s-K7s:0.15, QJs:0.65, QTs:0.05, 76s:0.2, 65s:0.1, AKo, AQo:0.9, KQo:0.35",
      call:  "JJ:0.45, TT, 88-99:0.95, 22-77, AQs:0.35, AJs:0.8, ATs:0.95, A5s:0.35, A4s:0.5, A3s:0.3, KJs:0.05, KTs:0.5, K9s:0.05, QJs:0.35, QTs:0.95, JTs:0.95, T9s:0.3, 98s:0.15, 76s:0.45, 65s:0.55, 54s:0.65, AQo:0.1, KQo:0.1"
    },
    BB_vs_UTG_CO: {
      raise: "QQ+, JJ:0.25, AKs, AQs:0.2, A7s:0.2, A5s:0.25, A3s-A4s:0.1, KJs+, KTs:0.25, K9s:0.5, K8s:0.6, K7s:0.35, K6s:0.45, QJs:0.25, AKo, AQo:0.75, KQo:0.5, KJo:0.15",
      call:  "JJ:0.75, 22-TT, AQs:0.8, ATs-AJs, A8s-A9s:0.95, A7s:0.75, A6s:0.95, A5s:0.75, A3s-A4s:0.9, A2s, KTs:0.75, K9s:0.5, K8s:0.4, K6s-K7s:0.55, K5s:0.65, K4s:0.5, K2s:0.3, QJs:0.75, QTs, Q9s:0.75, J9s+, J8s:0.7, T9s, T8s:0.95, 98s, 97s:0.9, 86s+, 76s, 75s:0.95, 64s+, 63s:0.55, 53s+, 52s:0.45, 43s, 42s:0.5, AQo:0.25, KQo:0.5, KJo:0.4, QJo:0.35, JTo:0.15"
    },
    SB_vs_UTG_BTN: {
      raise: "QQ+, JJ:0.7, 88:0.05, AKs, AQs:0.6, AJs:0.45, A8s:0.15, A5s:0.55, A4s:0.25, KQs:0.95, KJs, KTs:0.55, K9s:0.75, K8s:0.2, K7s:0.1, QJs:0.6, JTs:0.2, J9s:0.1, 76s:0.1, 65s:0.05, AQo+, KQo:0.6",
      call:  "JJ:0.3, 99-TT, 88:0.95, 22-77, AQs:0.4, AJs:0.55, ATs, A9s:0.5, A8s:0.15, A5s:0.45, A4s:0.65, A3s:0.25, KQs:0.05, KTs:0.45, K9s:0.05, QJs:0.4, QTs:0.95, JTs:0.8, J9s:0.1, T9s:0.45, 98s:0.05, 76s:0.45, 65s:0.45, 54s:0.4, KQo:0.2"
    },
    BB_vs_UTG_BTN: {
      raise: "QQ+, JJ:0.7, AKs, AQs:0.2, A7s:0.05, A5s:0.1, KQs:0.95, KJs, KTs:0.1, K9s:0.3, K8s:0.55, K6s-K7s:0.5, K5s:0.2, QJs:0.2, AKo, AQo:0.95, AJo:0.15, KQo:0.6, KJo:0.45",
      call:  "JJ:0.3, 22-TT, AQs:0.8, A8s-AJs, A6s-A7s:0.95, A5s:0.9, A2s-A4s, KQs:0.05, KTs:0.9, K9s:0.7, K8s:0.45, K6s-K7s:0.5, K5s:0.65, K4s:0.55, K3s:0.2, K2s:0.4, QJs:0.8, QTs, Q9s:0.95, J9s+, J8s:0.85, T8s+, 97s+, 96s:0.05, 86s+, 75s+, 64s+, 63s:0.35, 53s+, 52s:0.45, 43s, 42s:0.4, AQo:0.05, AJo:0.6, KQo:0.4, KJo:0.5, QJo:0.45, QTo:0.1, JTo:0.55"
    },
    BB_vs_UTG_SB: {
      raise: "QQ+, JJ:0.9, AKs, AQs:0.35, A8s:0.05, A7s:0.3, A3s-A5s:0.15, KQs, KJs:0.95, KTs:0.05, K9s:0.15, K8s:0.9, K7s:0.45, K6s:0.25, K4s-K5s:0.5, K3s:0.35, QJs:0.25, JTs:0.05, AKo, AQo:0.85, AJo:0.55, KQo:0.2, KJo:0.65",
      call:  "JJ:0.1, 22-TT, AQs:0.65, A9s-AJs, A8s:0.95, A7s:0.7, A6s:0.95, A3s-A5s:0.85, A2s, KJs:0.05, KTs:0.95, K9s:0.8, K8s:0.1, K7s:0.55, K6s:0.75, K4s-K5s:0.45, K3s:0.4, K2s:0.35, QJs:0.75, QTs, Q9s:0.95, JTs:0.95, J9s, J8s:0.85, T8s+, 98s, 97s:0.95, 96s:0.25, 86s+, 75s+, 64s+, 63s:0.8, 53s+, 52s:0.55, 43s, 42s:0.15, AQo:0.15, AJo:0.45, KQo:0.8, KJo:0.35, KTo:0.25, QJo:0.6, QTo:0.2, JTo:0.65, 76o:0.05, 54o:0.35"
    },
    BTN_vs_HJ_CO: {
      raise: "JJ+, TT:0.8, 99:0.6, 88:0.4, 77:0.35, 66:0.1, AKs, AQs:0.95, AJs:0.65, ATs:0.45, A5s:0.6, KQs, KJs:0.85, KTs:0.95, K9s:0.05, QJs:0.55, QTs:0.5, JTs:0.45, T9s:0.25, 98s:0.05, 76s:0.15, 65s:0.3, 54s:0.25, AQo+:0.95, KQo:0.15",
      call:  "TT:0.2, 99:0.4, 88:0.6, 77:0.65, 66:0.9, 55:0.75, 44:0.7, 33:0.85, 22, AQs:0.05, AJs:0.35, ATs:0.55, A9s:0.3, A5s:0.4, A4s:0.5, A3s:0.05, KJs:0.15, KTs:0.05, QJs:0.45, QTs:0.5, JTs:0.55, T9s:0.3, 98s:0.15, 76s:0.1, 65s:0.2, 54s:0.45, AQo+:0.05, KQo:0.2"
    },
    SB_vs_HJ_CO: {
      raise: "JJ+, 77-99:0.05, AKs, AJs-AQs:0.85, A8s:0.1, A5s:0.5, A4s:0.3, A3s:0.1, KJs+, KTs:0.55, K9s:0.4, K6s-K7s:0.1, QJs:0.75, JTs:0.4, J9s:0.7, 76s:0.05, 65s:0.05, AQo+, KQo:0.6, KJo:0.05",
      call:  "TT, 77-99:0.95, 22-66, AJs-AQs:0.15, ATs, A9s:0.4, A8s:0.3, A5s:0.5, A4s:0.7, A3s:0.65, A2s:0.05, KTs:0.45, QJs:0.25, QTs:0.8, JTs:0.6, J9s:0.05, T9s:0.1, 76s:0.4, 65s:0.4, 54s:0.55, KQo:0.2"
    },
    BB_vs_HJ_CO: {
      raise: "JJ+, AKs, AQs:0.7, AJs:0.25, A8s:0.05, A5s:0.25, KJs+, K9s:0.35, K7s:0.45, K6s:0.55, QJs:0.5, J9s:0.4, J8s:0.25, AQo+, AJo:0.35, KQo:0.4, KJo:0.55",
      call:  "22-TT, AQs:0.3, AJs:0.75, A9s-ATs, A7s-A8s:0.95, A6s, A5s:0.75, A2s-A4s, KTs, K9s:0.65, K8s:0.25, K7s:0.1, K6s:0.45, K5s:0.4, QJs:0.5, QTs, Q9s:0.9, JTs, J9s:0.6, J8s:0.35, T9s, T8s:0.8, 98s:0.95, 97s:0.9, 87s:0.95, 86s, 76s, 75s:0.95, 64s+, 63s:0.1, 53s+, 52s:0.2, 43s, AJo:0.55, KQo:0.6, KJo:0.35, QJo:0.3"
    },
    SB_vs_HJ_BTN: {
      raise: "JJ+, TT:0.1, 99:0.05, AKs, AQs:0.9, AJs:0.7, A8s:0.25, A7s:0.1, A5s:0.3, A4s:0.25, KQs:0.9, KJs, KTs:0.7, K9s:0.55, K6s:0.15, QJs:0.4, JTs:0.65, J9s:0.8, 76s:0.2, AQo+, AJo:0.25, KQo:0.65, KJo:0.1",
      call:  "TT:0.9, 99:0.95, 22-88, AQs:0.1, AJs:0.3, ATs, A9s:0.95, A8s:0.7, A7s:0.05, A6s:0.1, A5s:0.7, A4s:0.75, A3s:0.4, KQs:0.1, KTs:0.3, QJs:0.6, QTs, JTs:0.35, J9s:0.15, T9s:0.6, 98s:0.1, 76s:0.35, 65s:0.45, 54s:0.4, KQo:0.25"
    },
    BB_vs_HJ_BTN: {
      raise: "JJ+, TT:0.1, AKs, AQs:0.55, AJs:0.05, A5s:0.05, KJs+:0.7, KTs:0.45, K9s:0.4, K8s:0.15, K7s:0.6, K6s:0.7, K5s:0.5, QJs:0.1, JTs:0.4, J9s:0.05, J8s:0.4, AQo+, AJo:0.65, KQo:0.4, KJo:0.45, JTo:0.1",
      call:  "TT:0.9, 22-99, AQs:0.45, AJs:0.95, A6s-ATs, A5s:0.95, A2s-A4s, KJs+:0.3, KTs:0.55, K9s:0.6, K8s:0.85, K7s:0.4, K6s:0.3, K5s:0.45, K4s:0.55, K2s-K3s:0.3, QJs:0.9, Q9s-QTs, JTs:0.6, J9s:0.95, J8s:0.6, T8s+, 97s+, 96s:0.85, 86s+, 75s+, 64s+, 63s:0.4, 53s+, 52s:0.75, 43s, 42s:0.35, AJo:0.35, ATo:0.7, KQo:0.6, KJo:0.5, KTo:0.1, QJo:0.5, QTo:0.15, JTo:0.7, T9o:0.05, 54o:0.05"
    },
    BB_vs_HJ_SB: {
      raise: "JJ+, TT:0.3, AQs+, A7s-A8s:0.15, A5s:0.15, A3s:0.1, A2s:0.3, KQs, KJs:0.45, KTs:0.2, K8s-K9s:0.5, K7s:0.6, K6s:0.55, K5s:0.2, K4s:0.15, QJs:0.5, JTs:0.35, J9s:0.15, T9s:0.05, 87s:0.1, 76s:0.05, 65s:0.1, 54s:0.1, AKo, AQo:0.7, AJo:0.85, ATo:0.25, KQo:0.15, KJo:0.7, KTo:0.25, JTo:0.05",
      call:  "TT:0.7, 22-99, A9s-AJs, A7s-A8s:0.85, A6s, A5s:0.85, A4s, A3s:0.9, A2s:0.7, KJs:0.55, KTs:0.8, K8s-K9s:0.5, K6s-K7s:0.4, K5s:0.75, K4s:0.7, K3s:0.25, QJs:0.5, Q9s-QTs, Q8s:0.15, Q7s:0.1, JTs:0.65, J9s:0.85, J8s:0.95, T9s:0.95, T8s, T7s:0.45, 97s+, 96s:0.85, 87s:0.9, 86s, 85s:0.25, 76s:0.95, 75s, 65s:0.9, 64s, 63s:0.9, 54s:0.9, 53s, 52s:0.9, 43s, 42s:0.55, AQo:0.3, AJo:0.15, ATo:0.7, KQo:0.85, KJo:0.3, KTo:0.6, QJo:0.9, QTo:0.5, JTo:0.85, 76o:0.15, 65o:0.05, 54o:0.45"
    },
    SB_vs_CO_BTN: {
      raise: "TT+, 99:0.15, AKs, AQs:0.95, AJs:0.65, ATs:0.5, A7s-A8s:0.05, A5s:0.15, A4s:0.05, KTs+, K9s:0.3, QJs:0.2, QTs:0.3, JTs, J9s:0.8, T9s:0.6, 76s:0.05, 65s:0.1, AQo+, AJo:0.7, KQo:0.7, KJo:0.55",
      call:  "99:0.85, 22-88, AQs:0.05, AJs:0.35, ATs:0.5, A9s, A8s:0.75, A7s:0.2, A6s:0.15, A5s:0.85, A4s:0.55, A3s:0.25, K9s:0.35, QJs:0.8, QTs:0.7, J9s:0.15, T9s:0.4, 98s:0.2, 76s:0.25, 65s:0.4, 54s:0.35, AJo:0.15, KQo:0.3"
    },
    BB_vs_CO_BTN: {
      raise: "JJ+, TT:0.95, AQs+, AJs:0.1, A7s:0.25, A5s:0.05, KQs:0.8, KTs-KJs, K7s:0.05, K6s:0.35, QTs:0.6, JTs, J8s-J9s:0.4, T8s+:0.05, T7s:0.2, AQo+, AJo:0.85, ATo:0.1, KJo+:0.55, KTo:0.25, JTo:0.2",
      call:  "TT:0.05, 22-99, AJs:0.9, A8s-ATs, A7s:0.75, A6s, A5s:0.95, A2s-A4s, KQs:0.2, K8s-K9s, K7s:0.95, K6s:0.65, K5s, K4s:0.95, K3s:0.8, K2s:0.9, QJs, QTs:0.4, Q9s, Q8s:0.5, Q7s:0.05, Q6s:0.4, J8s-J9s:0.6, T8s+:0.95, T7s:0.6, 97s+, 96s:0.9, 86s+, 75s+, 64s+, 63s:0.8, 53s+, 52s:0.85, 43s, 42s:0.35, AJo:0.15, ATo:0.9, KJo+:0.45, KTo:0.55, QJo:0.85, QTo:0.55, JTo:0.75, T9o:0.25, 54o:0.1"
    },
    BB_vs_CO_SB: {
      raise: "TT+, 99:0.05, AQs+, A7s:0.2, A6s:0.1, A5s:0.35, A4s:0.2, A3s:0.05, A2s:0.3, KQs:0.45, KJs, K9s-KTs:0.15, K8s:0.1, K7s:0.2, K6s:0.6, K5s:0.4, K2s:0.1, QJs:0.05, Q8s:0.75, Q6s:0.2, JTs:0.25, J8s-J9s:0.05, J7s:0.25, T9s:0.45, T8s:0.05, T7s:0.5, T6s:0.35, 76s:0.05, AQo+, AJo:0.7, ATo:0.65, A9o:0.1, KQo:0.25, KJo:0.65, KTo:0.35, QJo:0.1, QTo:0.2, JTo:0.05, T9o:0.05",
      call:  "99:0.95, 22-88, A8s-AJs, A7s:0.8, A6s:0.9, A5s:0.65, A4s:0.8, A3s:0.95, A2s:0.7, KQs:0.55, K9s-KTs:0.85, K8s:0.9, K7s:0.8, K6s:0.4, K5s:0.6, K3s-K4s:0.95, K2s:0.7, QJs:0.95, Q9s-QTs, Q8s:0.2, Q7s:0.9, Q6s:0.7, Q4s-Q5s:0.15, JTs:0.75, J8s-J9s:0.95, J7s:0.2, T9s:0.55, T8s:0.95, T7s:0.45, 96s+, 86s+, 85s:0.65, 76s:0.95, 75s, 74s:0.45, 64s+, 63s:0.95, 53s+, 52s:0.95, 43s, 42s:0.8, AJo:0.3, ATo:0.35, KQo:0.75, KJo:0.35, KTo:0.6, QJo:0.85, QTo:0.8, JTo:0.95, T9o:0.7, 98o:0.15, 76o:0.35, 65o:0.2, 54o:0.55"
    }
  };

  /* ---------------- SB LIMPED POTS ----------------
     BB_vs_SB: raise = isolate to 3bb, everything else checks (the only true preflop "check" spot).
     SB_vs_ISO: the SB's response to that raise; only hands in RFI6.SB_LIMP reach it. */
  const VS_LIMP = {
    BB_vs_SB: {
      raise: "88+, 77:0.8, 66:0.85, 55:0.75, 44:0.65, 33:0.3, 22:0.35, A9s+, A8s:0.75, A7s:0.45, A6s:0.15, A4s-A5s, A3s:0.45, A2s:0.9, K9s+, K7s:0.05, K6s:0.4, K5s:0.25, K4s:0.75, K3s, K2s:0.25, QTs+, Q9s:0.05, Q7s:0.2, Q4s:0.15, Q3s:0.4, JTs, J7s:0.25, J4s:0.4, J3s:0.85, T9s:0.95, T8s:0.65, T7s:0.45, T6s:0.75, T5s:0.1, T4s:0.65, T3s:0.05, T2s:0.2, 98s, 97s:0.75, 96s:0.9, 95s:0.6, 94s:0.25, 93s:0.8, 92s:0.75, 85s+, 84s:0.75, 82s:0.4, 74s+, 73s:0.7, 64s+, 63s:0.05, 62s:0.75, 53s+:0.65, 52s, 43s:0.35, 42s:0.7, 32s:0.4, AQo+, AJo:0.6, ATo:0.85, A9o:0.9, A6o:0.15, A5o:0.7, A4o:0.15, A3o:0.3, A2o:0.4, KQo:0.75, KJo:0.3, KTo:0.5, K9o:0.3, K7o:0.65, K6o:0.85, K5o:0.8, K4o:0.35, K3o:0.1, K2o:0.15, QJo:0.5, QTo:0.35, Q9o:0.55, Q8o:0.25, Q7o:0.85, Q6o:0.8, Q5o:0.5, Q4o:0.1, JTo:0.3, J9o:0.65, J8o:0.7, J7o:0.4, J6o:0.6, J5o:0.4, J4o:0.1, J3o:0.05, J2o:0.25, T9o:0.3, T8o:0.55, T6o-T7o:0.4, T5o:0.2, T4o:0.35, T3o:0.5, T2o:0.1, 98o:0.5, 97o:0.3, 96o:0.25, 95o:0.15, 87o:0.55, 86o:0.4, 85o:0.3, 76o:0.1, 75o:0.3, 74o:0.15, 65o:0.35, 64o:0.2, 54o:0.45, 53o:0.35, 43o:0.35, 42o:0.05"
    },
    // SB (limped) facing the BB's raise to 3bb: 3-bet to 15bb / call / fold
    SB_vs_ISO: {
      raise: "TT+, 99:0.5, AQs, A4s:0.9, A2s-A3s:0.15, K9s:0.15, K3s:0.2, K2s:0.4, J7s:0.1, T9s, T8s:0.2, T6s:0.1, 98s:0.1, 97s:0.15, 96s:0.2, 86s+:0.15, 76s:0.2, 65s:0.65, 54s:0.2, AQo+, AJo:0.6, ATo:0.25, A9o:0.1, A8o:0.2, A7o:0.15, A4o-A6o:0.05, KQo:0.4, KJo:0.25, KTo:0.3, QJo:0.05, QTo:0.1, JTo:0.2, J9o:0.1, T9o:0.1",
      call:  "99:0.5, 22-88, A4s:0.1, A2s-A3s:0.85, K9s:0.85, K4s-K8s, K3s:0.8, K2s:0.6, Q3s-Q9s, Q2s:0.45, J8s, J7s:0.9, J5s-J6s, J4s:0.15, T8s:0.8, T7s, T6s:0.9, T5s:0.05, 98s:0.9, 97s:0.85, 96s:0.8, 86s+:0.85, 85s, 76s:0.8, 75s, 65s:0.35, 64s, 54s:0.8, 53s, 43s:0.85, AJo:0.4, ATo:0.75, A9o:0.9, A8o:0.8, A7o:0.85, A5o-A6o:0.95, A4o:0.45, KQo:0.6, KJo:0.75, KTo:0.7, K9o, QJo:0.95, QTo:0.9, Q9o:0.25, JTo:0.8, J9o:0.6, T9o:0.9"
    }
  };

  /* ---------------- HEADS-UP (SB = button, 100bb, 2.5x open) ---------------- */
  const HU = {
    // SB first in: raise 2.5bb / limp / fold
    SB_OPEN: {
      raise: "AA:0.9, AKs:0.85, AQs:0.9, AJs:0.8, ATs:0.85, A9s:0.5, A8s:0.5, A7s:0.5, A6s:0.5, A5s:0.5, A4s:0.5, A3s:0.5, A2s:0.5, AKo:0.9, KK:0.9, KQs:0.6, KJs:0.5, KTs:0.5, K9s:0.5, K8s:0.5, K7s:0.7, K6s:0.6, K5s:0.55, K4s:0.5, K3s:0.5, K2s:0.5, AQo:0.75, KQo:0.6, QQ:0.7, QJs:0.9, QTs:0.85, Q9s:0.5, Q8s:0.5, Q7s:0.5, Q6s:0.5, Q5s:0.5, Q4s:0.5, Q3s:0.5, Q2s:0.5, AJo:0.65, KJo:0.5, QJo:0.6, JJ:0.95, JTs:0.5, J9s:0.6, J8s:0.6, J7s:0.5, J6s:0.5, J5s:0.5, J4s:0.5, J3s:0.35, J2s:0.3, ATo:0.6, KTo:0.5, QTo:0.4, JTo:0.5, TT:0.9, T9s:0.5, T8s:0.5, T7s:0.5, T6s:0.4, T5s:0.5, T4s:0.5, T3s:0.5, T2s:0.45, A9o:0.5, K9o:0.5, Q9o:0.5, J9o:0.5, T9o:0.5, 99:0.9, 98s:0.55, 97s:0.6, 96s:0.65, 95s:0.55, 94s:0.7, 93s:0.85, 92s:0.85, A8o:0.5, K8o:0.5, Q8o:0.5, J8o:0.6, T8o:0.5, 98o:0.5, 88:0.8, 87s:0.5, 86s:0.6, 85s:0.5, 84s:0.5, 83s:0.55, 82s:0.7, A7o:0.5, K7o:0.5, Q7o:0.5, J7o:0.8, T7o:0.7, 97o:0.5, 87o:0.5, 77:0.5, 76s:0.55, 75s:0.55, 74s:0.5, 73s:0.5, 72s:0.65, A6o:0.5, K6o:0.5, Q6o:0.5, J6o:0.6, T6o:0.6, 96o:0.5, 86o:0.5, 76o:0.5, 66:0.65, 65s:0.5, 64s:0.5, 63s:0.5, 62s:0.75, A5o:0.5, K5o:0.5, Q5o:0.35, J5o:0.55, T5o:0.5, 95o:0.5, 85o:0.5, 75o:0.5, 65o:0.5, 55:0.5, 54s:0.5, 53s:0.5, 52s:0.5, A4o:0.5, K4o:0.5, Q4o:0.45, J4o:0.5, T4o:0.5, 94o:0.3, 84o:0.5, 74o:0.35, 64o:0.45, 54o:0.5, 44:0.5, 43s:0.5, 42s:0.5, A3o:0.5, K3o:0.5, Q3o:0.45, J3o:0.5, T3o:0.5, 93o:0.2, 83o:0.05, 63o:0.15, 53o:0.3, 43o:0.2, 33:0.5, 32s:0.5, A2o:0.5, K2o:0.5, Q2o:0.55, J2o:0.5, T2o:0.5, 92o:0.15, 52o:0.1, 22:0.5",
      limp:  "AA:0.1, AKs:0.15, AQs:0.1, AJs:0.2, ATs:0.15, A9s:0.5, A8s:0.5, A7s:0.5, A6s:0.5, A5s:0.5, A4s:0.5, A3s:0.5, A2s:0.5, AKo:0.1, KK:0.1, KQs:0.4, KJs:0.5, KTs:0.5, K9s:0.5, K8s:0.5, K7s:0.3, K6s:0.4, K5s:0.45, K4s:0.5, K3s:0.5, K2s:0.5, AQo:0.25, KQo:0.4, QQ:0.3, QJs:0.1, QTs:0.15, Q9s:0.5, Q8s:0.5, Q7s:0.5, Q6s:0.5, Q5s:0.5, Q4s:0.5, Q3s:0.5, Q2s:0.5, AJo:0.35, KJo:0.5, QJo:0.4, JJ:0.05, JTs:0.5, J9s:0.4, J8s:0.4, J7s:0.5, J6s:0.5, J5s:0.5, J4s:0.5, J3s:0.65, J2s:0.7, ATo:0.4, KTo:0.5, QTo:0.6, JTo:0.5, TT:0.1, T9s:0.5, T8s:0.5, T7s:0.5, T6s:0.6, T5s:0.5, T4s:0.5, T3s:0.5, T2s:0.55, A9o:0.5, K9o:0.5, Q9o:0.5, J9o:0.5, T9o:0.5, 99:0.1, 98s:0.45, 97s:0.4, 96s:0.35, 95s:0.45, 94s:0.3, 93s:0.15, 92s:0.15, A8o:0.5, K8o:0.5, Q8o:0.5, J8o:0.4, T8o:0.5, 98o:0.5, 88:0.2, 87s:0.5, 86s:0.4, 85s:0.5, 84s:0.5, 83s:0.45, 82s:0.3, A7o:0.5, K7o:0.5, Q7o:0.5, J7o:0.2, T7o:0.3, 97o:0.5, 87o:0.5, 77:0.5, 76s:0.45, 75s:0.45, 74s:0.5, 73s:0.5, 72s:0.3, A6o:0.5, K6o:0.5, Q6o:0.5, J6o:0.4, T6o:0.4, 96o:0.5, 86o:0.5, 76o:0.5, 66:0.35, 65s:0.5, 64s:0.5, 63s:0.5, 62s:0.2, A5o:0.5, K5o:0.5, Q5o:0.65, J5o:0.45, T5o:0.5, 95o:0.5, 85o:0.5, 75o:0.5, 65o:0.5, 55:0.5, 54s:0.5, 53s:0.5, 52s:0.5, A4o:0.5, K4o:0.5, Q4o:0.55, J4o:0.5, T4o:0.5, 94o:0.7, 84o:0.5, 74o:0.5, 64o:0.5, 54o:0.5, 44:0.5, 43s:0.5, 42s:0.5, A3o:0.5, K3o:0.5, Q3o:0.55, J3o:0.5, T3o:0.5, 93o:0.35, 83o:0.35, 73o:0.5, 63o:0.5, 53o:0.5, 43o:0.35, 33:0.5, 32s:0.5, A2o:0.5, K2o:0.5, Q2o:0.45, J2o:0.5, T2o:0.5, 92o:0.35, 82o:0.15, 72o:0.2, 62o:0.2, 52o:0.15, 22:0.5"
    },
    // BB facing the 2.5bb open: 3-bet to 10bb / call / fold
    BB_vs_SB: {
      raise: "AA, AKs, AQs, AJs, ATs, A9s:0.9, A8s:0.7, A7s:0.5, A6s:0.5, A5s:0.5, A4s:0.5, A3s:0.5, A2s:0.5, AKo, KK, KQs, KJs, KTs:0.8, K9s:0.5, K8s:0.5, K7s:0.5, K6s:0.5, K5s:0.5, K4s:0.45, K3s:0.35, K2s:0.35, AQo, KQo:0.7, QQ, QJs:0.9, QTs:0.85, Q9s:0.8, Q8s:0.6, Q7s:0.3, Q6s:0.15, Q5s:0.15, Q4s:0.15, Q2s:0.05, AJo:0.8, KJo:0.5, QJo:0.5, JJ, JTs:0.65, J9s:0.65, J8s:0.5, J7s:0.45, J6s:0.15, J5s:0.05, J3s:0.1, ATo:0.55, KTo:0.5, QTo:0.4, JTo:0.45, TT, T9s:0.65, T8s:0.5, T7s:0.5, T6s:0.2, A9o:0.5, K9o:0.5, Q9o:0.05, J9o:0.2, T9o:0.2, 99, 98s:0.5, 97s:0.5, 96s:0.25, 95s:0.05, A8o:0.4, K8o:0.15, J8o:0.15, T8o:0.4, 98o:0.35, 88:0.85, 87s:0.85, 86s:0.5, 85s:0.25, A7o:0.2, K7o:0.15, 87o:0.1, 77:0.7, 76s, 75s:0.6, 74s:0.1, A6o:0.2, K6o:0.05, 86o:0.05, 66:0.5, 65s:0.6, 64s:0.55, 63s:0.15, A5o:0.45, K5o:0.05, 55:0.55, 54s:0.65, 53s:0.5, A4o:0.25, 44:0.5, 43s:0.3, A3o:0.15, 33:0.35, A2o:0.35, 22:0.35",
      call:  "A9s:0.1, A8s:0.3, A7s:0.5, A6s:0.5, A5s:0.5, A4s:0.5, A3s:0.5, A2s:0.5, KTs:0.2, K9s:0.5, K8s:0.5, K7s:0.5, K6s:0.5, K5s:0.5, K4s:0.55, K3s:0.65, K2s:0.65, KQo:0.3, QJs:0.1, QTs:0.15, Q9s:0.2, Q8s:0.4, Q7s:0.7, Q6s:0.85, Q5s:0.85, Q4s:0.85, Q3s, Q2s:0.95, AJo:0.2, KJo:0.5, QJo:0.5, JTs:0.35, J9s:0.35, J8s:0.5, J7s:0.55, J6s:0.85, J5s:0.95, J4s, J3s:0.9, J2s, ATo:0.45, KTo:0.5, QTo:0.6, JTo:0.55, T9s:0.35, T8s:0.5, T7s:0.5, T6s:0.8, T5s:0.65, T4s:0.65, T3s:0.55, T2s:0.5, A9o:0.5, K9o:0.5, Q9o:0.95, J9o:0.8, T9o:0.8, 98s:0.5, 97s:0.5, 96s:0.75, 95s:0.45, 94s:0.5, 93s:0.5, 92s:0.5, A8o:0.6, K8o:0.85, Q8o, J8o:0.85, T8o:0.6, 98o:0.65, 88:0.15, 87s:0.15, 86s:0.5, 85s:0.7, 84s:0.65, 83s:0.5, 82s:0.45, A7o:0.8, K7o:0.85, Q7o:0.85, J7o:0.55, T7o:0.6, 97o:0.5, 87o:0.55, 77:0.3, 75s:0.4, 74s:0.75, 73s:0.5, A6o:0.8, K6o:0.95, Q6o:0.45, T6o:0.45, 96o:0.45, 86o:0.5, 76o:0.65, 66:0.5, 65s:0.4, 64s:0.45, 63s:0.65, 62s:0.35, A5o:0.55, K5o:0.75, Q5o:0.2, J5o:0.05, T5o:0.1, 95o:0.25, 85o:0.2, 75o:0.45, 65o:0.4, 55:0.45, 54s:0.35, 53s:0.5, 52s:0.5, A4o:0.75, K4o:0.65, Q4o:0.15, T4o:0.05, 64o:0.15, 54o:0.4, 44:0.5, 43s:0.65, 42s:0.5, A3o:0.85, K3o:0.25, T3o:0.05, 53o:0.15, 33:0.65, 32s:0.4, A2o:0.6, K2o:0.3, 22:0.65"
    },
    // SB (opened 2.5bb) facing the 10bb 3-bet: 4-bet to 22bb / call / fold
    SB_vs_BB_3BET: {
      raise: "AA, AKs:0.85, AQs:0.5, AJs:0.4, ATs:0.5, A9s:0.1, A8s:0.05, A7s:0.05, A6s:0.05, A5s:0.05, A4s:0.05, A3s:0.05, A2s:0.05, AKo:0.65, KK, KQs:0.25, KJs:0.2, KTs:0.05, K9s:0.15, K8s:0.1, K7s:0.35, K6s:0.2, K5s:0.25, K4s:0.1, K3s:0.1, K2s:0.05, AQo:0.4, KQo:0.3, QQ:0.7, QJs:0.25, QTs:0.1, Q8s:0.05, Q7s:0.1, Q6s:0.05, Q5s:0.05, Q4s:0.05, Q3s:0.05, Q2s:0.05, AJo:0.35, KJo:0.05, QJo:0.55, JJ:0.85, JTs:0.05, J9s:0.3, J8s:0.35, J7s:0.15, J6s:0.05, J5s:0.05, J4s:0.05, J3s:0.05, ATo:0.4, KTo:0.05, QTo:0.15, JTo:0.1, TT:0.5, T9s:0.05, T8s:0.05, T7s:0.15, T6s:0.5, T5s:0.4, T4s:0.4, T3s:0.25, T2s:0.3, A9o:0.2, K9o:0.1, Q9o:0.45, J9o:0.1, T9o:0.15, 99:0.45, 98s:0.15, 97s:0.05, 96s:0.05, 95s:0.25, A8o:0.15, K8o:0.15, Q8o:0.05, J8o:0.05, T8o:0.15, 98o:0.2, 88:0.45, 86s:0.2, 85s:0.05, 84s:0.05, 83s:0.05, A7o:0.1, K7o:0.2, Q7o:0.05, T7o:0.05, 87o:0.05, 77:0.15, 76s:0.2, 75s:0.15, 73s:0.05, A6o:0.1, K6o:0.15, Q6o:0.05, J6o:0.1, 76o:0.1, 66:0.35, 63s:0.1, A5o:0.05, K5o:0.2, Q5o:0.05, J5o:0.15, 55:0.1, 53s:0.05, A4o:0.05, K4o:0.25, Q4o:0.05, J4o:0.05, 44:0.05, A3o:0.05, K3o:0.25, Q3o:0.05, 33:0.15, 32s:0.2, A2o:0.05, K2o:0.3, Q2o:0.05, 22:0.15",
      call:  "AKs:0.15, AQs:0.5, AJs:0.6, ATs:0.5, A9s:0.8, A8s:0.8, A7s:0.75, A6s:0.75, A5s:0.75, A4s:0.75, A3s:0.75, A2s:0.75, AKo:0.35, KQs:0.75, KJs:0.75, KTs:0.8, K9s:0.75, K8s:0.8, K7s:0.65, K6s:0.75, K5s:0.7, K4s:0.8, K3s:0.8, K2s:0.8, AQo:0.6, KQo:0.65, QQ:0.3, QJs:0.75, QTs:0.9, Q9s, Q8s:0.85, Q7s:0.7, Q6s:0.75, Q5s:0.75, Q4s:0.75, Q3s:0.75, Q2s:0.7, AJo:0.6, KJo:0.75, QJo:0.45, JJ:0.15, JTs:0.85, J9s:0.7, J8s:0.65, J7s:0.65, J6s:0.7, J5s:0.6, J4s:0.55, J3s:0.7, J2s:0.35, ATo:0.6, KTo:0.75, QTo:0.8, JTo:0.75, TT:0.5, T9s:0.8, T8s:0.8, T7s:0.75, T6s:0.25, T5s:0.1, T4s:0.15, T3s:0.35, T2s:0.2, A9o:0.65, K9o:0.75, Q9o:0.35, J9o:0.7, T9o:0.7, 99:0.55, 98s:0.75, 97s:0.95, 96s:0.85, 95s:0.2, A8o:0.65, K8o:0.45, Q8o:0.15, J8o:0.3, T8o:0.7, 98o:0.4, 88:0.55, 87s:0.95, 86s:0.8, 85s:0.8, 84s:0.1, 83s:0.05, A7o:0.65, K7o:0.1, Q7o:0.25, J7o:0.05, T7o:0.05, 97o:0.05, 87o:0.2, 77:0.85, 76s:0.8, 75s:0.75, 74s:0.8, 73s:0.2, A6o:0.65, K6o:0.1, Q6o:0.2, J6o:0.05, 86o:0.1, 76o:0.3, 66:0.65, 65s:0.95, 64s:0.8, 63s:0.6, 62s:0.35, A5o:0.7, K5o:0.1, Q5o:0.05, J5o:0.15, 65o:0.05, 55:0.85, 54s:0.75, 53s:0.8, 52s:0.6, A4o:0.7, K4o:0.05, Q4o:0.1, J4o:0.2, 54o:0.45, 44:0.9, 43s:0.65, 42s:0.6, A3o:0.7, K3o:0.1, Q3o:0.1, J3o:0.05, 53o:0.05, 43o:0.2, 33:0.8, 32s:0.4, A2o:0.65, K2o:0.05, Q2o:0.1, 52o:0.05, 22:0.75"
    },
    // BB facing the SB limp: raise to 4bb / check
    BB_vs_LIMP: {
      raise: "AA, AKs, AQs, AJs, ATs, A9s, A8s, A7s, A6s:0.8, A5s:0.95, A4s:0.65, A3s:0.65, A2s:0.5, AKo, KK, KQs, KJs, KTs, K9s:0.95, K8s:0.8, K7s:0.65, K6s:0.7, K5s:0.6, K4s:0.5, K3s:0.5, K2s:0.5, AQo, KQo, QQ, QJs, QTs, Q9s:0.85, Q8s:0.8, Q7s:0.65, Q6s:0.75, Q5s:0.5, Q4s:0.5, Q3s:0.75, Q2s:0.35, AJo, KJo:0.65, QJo:0.8, JJ, JTs, J9s, J8s:0.65, J7s:0.65, J6s:0.5, J5s:0.55, J4s:0.35, J3s:0.4, J2s:0.15, ATo:0.95, KTo:0.5, QTo:0.65, JTo:0.85, TT, T9s, T8s:0.7, T7s:0.5, T6s:0.5, T5s:0.5, T4s:0.35, T3s:0.25, T2s:0.15, A9o:0.5, K9o:0.5, Q9o:0.5, J9o:0.5, T9o:0.5, 99, 98s:0.7, 97s:0.5, 96s:0.6, 95s:0.5, 94s:0.15, A8o:0.5, K8o:0.5, Q8o:0.5, J8o:0.5, T8o:0.5, 98o:0.5, 88, 87s:0.5, 86s:0.5, 85s:0.6, 84s:0.35, A7o:0.5, K7o:0.5, Q7o:0.2, J7o:0.15, T7o:0.5, 97o:0.5, 87o:0.5, 77, 76s:0.6, 75s:0.6, 74s:0.6, 73s:0.15, A6o:0.5, K6o:0.4, Q6o:0.05, T6o:0.05, 96o:0.25, 86o:0.45, 76o:0.5, 66:0.95, 65s:0.8, 64s:0.75, 63s:0.45, A5o:0.5, K5o:0.05, 75o:0.2, 65o:0.3, 55, 54s:0.65, 53s:0.65, 52s:0.5, A4o:0.5, K4o:0.1, 64o:0.25, 54o:0.25, 44:0.9, 43s:0.5, 42s:0.5, A3o:0.5, K3o:0.35, 63o:0.15, 53o:0.2, 43o:0.2, 33:0.85, 32s:0.4, A2o:0.5, K2o:0.3, 52o:0.1, 42o:0.15, 32o:0.15, 22:0.65"
    },
    // SB (limped) facing the BB's 4bb raise: 3-bet to 12bb / call / fold
    SB_vs_ISO: {
      raise: "AA, AKs, AQs:0.9, AJs:0.5, ATs:0.45, A9s:0.3, A8s:0.3, A7s:0.3, A6s:0.25, A5s:0.25, A4s:0.25, A3s:0.25, A2s:0.2, AKo, KK, KQs:0.85, KJs:0.3, KTs:0.25, K9s:0.25, K8s:0.25, K7s:0.15, K6s:0.15, K5s:0.1, K4s:0.1, K3s:0.2, K2s:0.1, AQo:0.45, KQo:0.5, QQ, QJs:0.7, QTs:0.3, Q9s:0.25, Q8s:0.05, Q7s:0.05, Q6s:0.05, Q5s:0.1, Q4s:0.1, Q3s:0.05, Q2s:0.1, AJo:0.3, KJo:0.25, QJo:0.3, JJ, JTs:0.25, J9s:0.2, J8s:0.2, J7s:0.15, J6s:0.25, J5s:0.25, J4s:0.25, J3s:0.25, J2s:0.15, ATo:0.25, KTo:0.2, QTo:0.35, JTo:0.2, TT, T9s:0.2, T8s:0.05, T7s:0.1, T6s:0.3, T5s:0.3, T4s:0.3, T3s:0.15, T2s:0.1, A9o:0.25, K9o:0.15, Q9o:0.05, J9o:0.2, T9o:0.05, 99:0.95, 98s:0.1, 97s:0.4, 96s:0.1, 95s:0.2, 94s:0.1, 93s:0.1, 92s:0.05, A8o:0.25, K8o:0.05, J8o:0.1, T8o:0.15, 98o:0.25, 88:0.75, 87s:0.3, 86s:0.25, 85s:0.3, 84s:0.15, 83s:0.05, A7o:0.1, K7o:0.05, T7o:0.1, 97o:0.05, 87o:0.15, 77:0.35, 76s:0.2, 75s:0.25, 74s:0.2, 73s:0.15, A6o:0.1, K6o:0.05, 96o:0.05, 86o:0.05, 76o:0.05, 66:0.3, 65s:0.2, 64s:0.15, 63s:0.2, 62s:0.2, A5o:0.1, K5o:0.05, Q5o:0.05, 75o:0.1, 65o:0.05, 55:0.3, 54s:0.2, 53s:0.2, 52s:0.05, A4o:0.1, K4o:0.05, 54o:0.05, 44:0.3, 43s:0.2, 42s:0.05, A3o:0.1, K3o:0.05, 33:0.2, 32s:0.25, A2o:0.05, K2o:0.15, 72o:0.05, 62o:0.05, 22:0.15",
      call:  "AQs:0.1, AJs:0.45, ATs:0.5, A9s:0.65, A8s:0.65, A7s:0.65, A6s:0.65, A5s:0.65, A4s:0.65, A3s:0.65, A2s:0.7, KQs:0.1, KJs:0.65, KTs:0.65, K9s:0.65, K8s:0.65, K7s:0.75, K6s:0.7, K5s:0.75, K4s:0.75, K3s:0.7, K2s:0.75, AQo:0.55, KQo:0.45, QJs:0.2, QTs:0.65, Q9s:0.6, Q8s:0.8, Q7s:0.75, Q6s:0.75, Q5s:0.75, Q4s:0.75, Q3s:0.75, Q2s:0.75, AJo:0.65, KJo:0.65, QJo:0.65, JTs:0.65, J9s:0.7, J8s:0.7, J7s:0.8, J6s:0.65, J5s:0.7, J4s:0.6, J3s:0.7, J2s:0.55, ATo:0.65, KTo:0.7, QTo:0.6, JTo:0.7, T9s:0.7, T8s:0.8, T7s:0.85, T6s:0.7, T5s:0.65, T4s:0.7, T3s:0.75, T2s:0.75, A9o:0.65, K9o:0.7, Q9o:0.75, J9o:0.7, T9o:0.75, 99:0.05, 98s:0.75, 97s:0.6, 96s:0.8, 95s:0.7, 94s:0.7, 93s:0.6, 92s:0.6, A8o:0.65, K8o:0.75, Q8o:0.75, J8o:0.75, T8o:0.65, 98o:0.6, 88:0.25, 87s:0.7, 86s:0.65, 85s:0.65, 84s:0.55, 83s:0.15, 82s:0.1, A7o:0.75, K7o:0.75, Q7o:0.7, J7o:0.6, T7o:0.65, 97o:0.6, 87o:0.7, 77:0.6, 76s:0.7, 75s:0.65, 74s:0.7, 73s:0.7, 72s:0.3, A6o:0.75, K6o:0.65, Q6o:0.6, J6o:0.15, T6o:0.05, 96o:0.15, 86o:0.4, 76o:0.75, 66:0.65, 65s:0.7, 64s:0.7, 63s:0.7, 62s:0.55, A5o:0.75, K5o:0.6, Q5o:0.55, J5o:0.05, T5o:0.05, 95o:0.05, 85o:0.15, 75o:0.25, 65o:0.7, 55:0.65, 54s:0.65, 53s:0.7, 52s:0.75, A4o:0.75, K4o:0.35, Q4o:0.4, J4o:0.1, T4o:0.05, 74o:0.05, 64o:0.4, 54o:0.5, 44:0.65, 43s:0.7, 42s:0.75, A3o:0.75, K3o:0.3, Q3o:0.35, J3o:0.1, T3o:0.1, 73o:0.05, 63o:0.05, 53o:0.45, 43o:0.3, 33:0.7, 32s:0.6, A2o:0.75, K2o:0.3, Q2o:0.25, J2o:0.1, T2o:0.05, 72o:0.05, 62o:0.05, 52o:0.05, 22:0.8"
    }
  };

  root.RANGES = { RFI6, RFI9, VS_OPEN, VS_3BET, COLD_4BET, SQUEEZE, VS_LIMP, HU };
})(typeof window !== 'undefined' ? window : globalThis);
