/* ranges.js — preflop strategy data.
   Model: 100bb effective, no ante, cash-game rake (~NL100 style: 5% capped).
   Open sizes: 2.5bb from every position, 3bb from the SB (raise-or-fold SB first in).
   3-bet sizes: ~3x in position (7.5bb), 10bb from the SB, 11bb from the BB vs a 2.5bb open,
   ~10bb BB vs a 3bb SB open. 4-bets ~2.25x the 3-bet.
   Frequencies are per-hand action weights (0..1). Hands not listed take the residual
   action (fold, or check for the BB vs limp spot). Mixed frequencies are rounded to
   5-10% steps. These are hand-curated approximations of 100bb equilibrium solver output
   (see the About page); they are not exports from any commercial product. */
(function (root) {
  'use strict';

  /* ---------------- RAISE FIRST IN ---------------- */
  const RFI6 = {
    UTG: "66+, 55:0.6, 44:0.35, 33:0.25, 22:0.15, A8s+, A7s:0.9, A6s:0.85, A5s, A4s, A3s:0.8, A2s:0.15, K9s+, K8s:0.5, K7s:0.25, K6s:0.15, K5s:0.15, QTs+, Q9s:0.8, Q8s:0.15, JTs, J9s:0.8, J8s:0.1, T9s, T8s:0.35, 98s:0.5, 87s:0.4, 76s:0.35, 65s:0.3, 54s:0.25, AJo+, ATo:0.6, KQo, KJo:0.5, QJo:0.1",
    HJ:  "55+, 44:0.65, 33:0.5, 22:0.35, A2s+, K6s+, K5s:0.6, K4s:0.3, K3s:0.2, K2s:0.15, Q9s+, Q8s:0.6, Q7s:0.1, J9s+, J8s:0.35, T9s, T8s:0.7, T7s:0.1, 98s, 97s:0.3, 87s, 86s:0.1, 76s:0.8, 65s:0.7, 54s:0.5, ATo+, A9o:0.1, KJo+, KTo:0.75, QJo:0.7, QTo:0.35, JTo:0.15",
    CO:  "22+, A2s+, K4s+, K3s:0.5, K2s:0.3, Q6s+, J8s+, T8s+, T7s:0.4, 97s+, 87s, 86s:0.15, 76s, 65s, 54s, A9o+, A8o:0.75, KTo+, K9o:0.2, QTo+, JTo",
    BTN: "22+, A2s+, K2s+, Q2s+, J5s+, J4s:0.7, T7s+, T6s:0.8, 96s+, 95s:0.2, 85s+, 84s:0.1, 75s+, 64s+, 54s, 53s:0.3, A4o+, A3o:0.4, K9o+, K8o:0.8, Q9o+, J9o+, J8o:0.3, T9o, T8o:0.5, 98o:0.4, 87o:0.2",
    SB:  "22+, A2s+, K2s+, Q2s+, J5s+, J4s:0.8, T6s+, T5s:0.2, 96s+, 95s:0.2, 85s+, 84s:0.1, 75s+, 74s:0.35, 64s+, 53s+, A4o+, A3o:0.5, K9o+, K8o:0.6, K7o:0.1, Q9o+, J9o+, J8o:0.2, T9o, T8o:0.6, 98o:0.8, 87o:0.1"
  };

  const RFI9 = {
    'UTG':   "66+, 55:0.5, 44:0.25, 33:0.1, ATs+, A9s:0.5, A8s:0.3, A7s:0.15, A5s:0.9, A4s:0.5, A3s:0.25, KTs+, K9s:0.3, QTs+, Q9s:0.15, JTs, J9s:0.25, T9s:0.7, 98s:0.3, 87s:0.2, 76s:0.15, 65s:0.15, AQo+, AJo:0.5, KQo:0.4",
    'UTG+1': "66+, 55:0.5, 44:0.25, 33:0.2, 22:0.1, A9s+, A8s:0.4, A7s:0.3, A6s:0.15, A5s, A4s:0.8, A3s:0.35, A2s:0.1, KTs+, K9s:0.6, K8s:0.1, QTs+, Q9s:0.35, JTs, J9s:0.4, T9s:0.85, T8s:0.1, 98s:0.4, 87s:0.3, 76s:0.25, 65s:0.2, 54s:0.1, AQo+, AJo:0.7, ATo:0.1, KQo:0.6, KJo:0.1",
    'UTG+2': "66+, 55:0.6, 44:0.3, 33:0.2, 22:0.1, A8s+, A7s:0.5, A6s:0.3, A5s, A4s, A3s:0.5, A2s:0.15, K9s+, K8s:0.2, QTs+, Q9s:0.5, JTs, J9s:0.65, T9s, T8s:0.2, 98s:0.5, 87s:0.4, 76s:0.35, 65s:0.3, 54s:0.2, AJo+, ATo:0.3, KQo:0.9, KJo:0.2",
    'LJ':  RFI6.UTG,   // 5 players behind — structurally identical to 6-max UTG
    'HJ':  RFI6.HJ,
    'CO':  RFI6.CO,
    'BTN': RFI6.BTN,
    'SB':  RFI6.SB
  };

  /* ---------------- FACING AN OPEN (hero_vs_opener) ----------------
     raise = 3-bet, call = flat, everything else folds. */
  const VS_OPEN = {
    HJ_vs_UTG: {
      raise: "QQ+, JJ:0.6, TT:0.2, AKs, AKo, AQs:0.8, AQo:0.5, AJs:0.3, A5s:0.8, A4s:0.6, A3s:0.2, KQs:0.4, KJs:0.1, 76s:0.1, 65s:0.1",
      call:  "JJ:0.4, TT:0.8, 99, 88:0.8, 77:0.6, 66:0.3, 55:0.1, AQs:0.2, AJs:0.6, ATs:0.7, KQs:0.5, KJs:0.6, KTs:0.3, QJs:0.6, QTs:0.2, JTs:0.6, T9s:0.3, AQo:0.3, KQo:0.1"
    },
    CO_vs_UTG: {
      raise: "QQ+, JJ:0.6, TT:0.25, AKs, AKo, AQs:0.85, AQo:0.6, AJs:0.35, ATs:0.1, A5s:0.9, A4s:0.7, A3s:0.3, KQs:0.5, KJs:0.2, QJs:0.1, 76s:0.1, 65s:0.1, 54s:0.1",
      call:  "JJ:0.4, TT:0.75, 99, 88, 77:0.7, 66:0.4, 55:0.2, AQs:0.15, AJs:0.65, ATs:0.8, A9s:0.2, KQs:0.5, KJs:0.7, KTs:0.4, QJs:0.6, QTs:0.3, JTs:0.7, T9s:0.4, 98s:0.2, AQo:0.3, AJo:0.1, KQo:0.2"
    },
    BTN_vs_UTG: {
      raise: "QQ+, JJ:0.7, TT:0.4, 99:0.2, AKs, AKo, AQs, AQo:0.8, AJs:0.6, ATs:0.25, A5s:0.9, A4s:0.8, A3s:0.45, A2s:0.35, KQs:0.6, KJs:0.45, KTs:0.2, QJs:0.3, JTs:0.15, T9s:0.1, 87s:0.1, AJo:0.2, KQo:0.25, 76s:0.15, 65s:0.15, 54s:0.1",
      call:  "JJ:0.3, TT:0.6, 99:0.8, 88, 77, 66, 55:0.8, 44:0.5, 33:0.3, 22:0.2, AJs:0.4, ATs:0.75, A9s:0.5, A8s:0.2, KQs:0.4, KJs:0.55, KTs:0.65, K9s:0.2, QJs:0.7, QTs:0.8, Q9s:0.1, JTs:0.85, J9s:0.4, T9s:0.7, T8s:0.2, 98s:0.7, 87s:0.5, 76s:0.5, 65s:0.4, 54s:0.2, AQo:0.2, AJo:0.3, KQo:0.45"
    },
    SB_vs_UTG: {
      raise: "QQ+, JJ:0.85, TT:0.75, 99:0.45, 88:0.2, AKs, AKo, AQs:0.8, AQo:0.8, AJs:0.75, ATs:0.45, A5s:0.8, A4s:0.6, A3s:0.2, KQs:0.75, KJs:0.45, KTs:0.15, QJs:0.3, JTs:0.2, T9s:0.1, AJo:0.1, KQo:0.25",
      call:  "JJ:0.15, TT:0.25, 99:0.35, 88:0.3, 77:0.2, AQs:0.2, AJs:0.25, ATs:0.3, KQs:0.25, KJs:0.3, KTs:0.15, QJs:0.3, QTs:0.1, JTs:0.3, T9s:0.15"
    },
    BB_vs_UTG: {
      raise: "QQ+, JJ:0.5, TT:0.2, AKs, AKo, AQs:0.8, AQo:0.5, AJs:0.4, A5s:0.7, A4s:0.7, A3s:0.4, A2s:0.3, KQs:0.4, KJs:0.2, K5s:0.1, 76s:0.1, 65s:0.1",
      call:  "JJ:0.5, TT:0.8, 22-99, AQs:0.2, AJs:0.6, A6s-ATs, A5s:0.3, A4s:0.3, A3s:0.6, A2s:0.7, KQs:0.6, KJs:0.8, K6s-KTs, K5s:0.9, K4s:0.7, K3s:0.4, K2s:0.3, Q6s-QJs, Q5s:0.6, Q4s:0.3, J7s-JTs, J6s:0.4, T7s-T9s, T6s:0.4, 96s-98s, 86s-87s, 85s:0.5, 76s:0.9, 75s, 74s:0.3, 65s:0.9, 64s:0.8, 54s, 53s:0.5, 43s:0.4, AQo:0.5, AJo, ATo, A9o:0.7, A8o:0.3, KQo, KJo, KTo:0.9, K9o:0.2, QJo, QTo:0.8, JTo, J9o:0.2, T9o:0.5, 98o:0.2"
    },
    CO_vs_HJ: {
      raise: "QQ+, JJ:0.7, TT:0.35, 99:0.1, AKs, AKo, AQs, AQo:0.7, AJs:0.55, ATs:0.25, A9s:0.05, A5s:0.9, A4s:0.8, A3s:0.4, A2s:0.15, KQs:0.55, KJs:0.35, KTs:0.15, QJs:0.2, QTs:0.05, JTs:0.1, AJo:0.15, KQo:0.2, 76s:0.1, 65s:0.1, 54s:0.1",
      call:  "JJ:0.3, TT:0.65, 99:0.9, 88, 77:0.8, 66:0.5, 55:0.3, 44:0.1, AJs:0.45, ATs:0.75, A9s:0.4, A8s:0.1, KQs:0.45, KJs:0.6, KTs:0.6, K9s:0.1, QJs:0.7, QTs:0.6, JTs:0.8, J9s:0.2, T9s:0.6, 98s:0.4, 87s:0.3, 76s:0.2, AQo:0.3, AJo:0.3, KQo:0.4"
    },
    BTN_vs_HJ: {
      raise: "QQ+, JJ:0.8, TT:0.55, 99:0.25, 88:0.05, AKs, AKo, AQs, AQo:0.85, AJs:0.7, ATs:0.4, A9s:0.15, A8s:0.1, A5s:0.95, A4s:0.9, A3s:0.6, A2s:0.35, KQs:0.7, KJs:0.6, KTs:0.3, K9s:0.1, QJs:0.45, QTs:0.2, JTs:0.25, T9s:0.15, 98s:0.1, 87s:0.1, 76s:0.2, 65s:0.2, 54s:0.15, AJo:0.4, ATo:0.05, KQo:0.45, KJo:0.05",
      call:  "JJ:0.2, TT:0.45, 99:0.75, 88:0.95, 77, 66, 55:0.8, 44:0.6, 33:0.4, 22:0.3, AJs:0.3, ATs:0.6, A9s:0.6, A8s:0.4, A7s:0.2, KQs:0.3, KJs:0.4, KTs:0.6, K9s:0.4, QJs:0.55, QTs:0.7, Q9s:0.3, JTs:0.75, J9s:0.5, T9s:0.7, T8s:0.3, 98s:0.6, 87s:0.5, 76s:0.4, 65s:0.3, 54s:0.2, AQo:0.15, AJo:0.35, ATo:0.1, KQo:0.4, KJo:0.1"
    },
    SB_vs_HJ: {
      raise: "QQ+, JJ:0.9, TT:0.8, 99:0.65, 88:0.4, 77:0.2, AKs, AKo, AQs:0.85, AQo:0.95, AJs:0.8, ATs:0.65, A9s:0.3, A8s:0.1, A5s:0.9, A4s:0.8, A3s:0.4, A2s:0.1, KQs:0.8, KJs:0.6, KTs:0.35, K9s:0.05, QJs:0.45, QTs:0.2, JTs:0.35, T9s:0.2, 98s:0.1, AJo:0.4, ATo:0.05, KQo:0.6, KJo:0.05",
      call:  "JJ:0.1, TT:0.2, 99:0.35, 88:0.35, 77:0.3, 66:0.15, AQs:0.15, AJs:0.2, ATs:0.3, A9s:0.15, KQs:0.2, KJs:0.3, KTs:0.25, QJs:0.35, QTs:0.2, JTs:0.4, T9s:0.25, 98s:0.15"
    },
    BB_vs_HJ: {
      raise: "QQ+, JJ:0.6, TT:0.3, AKs, AKo, AQs:0.9, AQo:0.6, AJs:0.5, ATs:0.2, A5s:0.7, A4s:0.7, A3s:0.5, A2s:0.4, KQs:0.5, KJs:0.3, KTs:0.1, K6s:0.1, K5s:0.15, Q9s:0.1, J9s:0.1, T9s:0.1, 76s:0.1, 65s:0.15, 54s:0.15, AJo:0.1, KQo:0.15",
      call:  "JJ:0.4, TT:0.7, 22-99, AQs:0.1, AJs:0.5, ATs:0.8, A6s-A9s, A5s:0.3, A4s:0.3, A3s:0.5, A2s:0.6, KQs:0.5, KJs:0.7, KTs:0.9, K7s-K9s, K6s:0.9, K5s:0.85, K4s, K3s:0.8, K2s:0.6, QTs-QJs, Q9s:0.9, Q4s-Q8s, Q3s:0.7, Q2s:0.5, JTs, J9s:0.9, J6s-J8s, J5s:0.7, J4s:0.3, T9s:0.9, T6s-T8s, T5s:0.5, T4s:0.2, 95s-98s, 94s:0.2, 84s-87s, 76s:0.9, 74s-75s, 73s:0.2, 65s:0.85, 64s, 63s:0.5, 54s:0.85, 53s, 52s:0.2, 43s:0.8, 42s:0.2, 32s:0.2, AQo:0.4, AJo:0.9, ATo, A9o, A8o:0.7, A7o:0.4, A6o:0.3, A5o:0.5, A4o:0.3, A3o:0.1, KQo:0.85, KJo, KTo, K9o:0.6, K8o:0.2, QJo, QTo, Q9o:0.5, JTo, J9o:0.5, T9o:0.8, T8o:0.2, 98o:0.5, 87o:0.3, 76o:0.1"
    },
    BTN_vs_CO: {
      raise: "TT+, 99:0.6, 88:0.3, 77:0.15, AKs, AKo, AQs, AQo, AJs, ATs:0.8, A9s:0.5, A8s:0.4, A7s:0.3, A6s:0.3, A5s, A4s, A3s:0.85, A2s:0.6, KQs, KJs:0.85, KTs:0.7, K9s:0.4, K8s:0.2, K7s:0.1, K6s:0.1, K5s:0.1, QJs:0.7, QTs:0.55, Q9s:0.3, JTs:0.55, J9s:0.3, T9s:0.4, T8s:0.15, 98s:0.3, 87s:0.3, 76s:0.3, 65s:0.3, 54s:0.25, AJo:0.8, ATo:0.4, A9o:0.1, KQo:0.8, KJo:0.4, KTo:0.1, QJo:0.25, QTo:0.05, JTo:0.1",
      call:  "99:0.4, 88:0.7, 77:0.85, 66:0.9, 55:0.8, 44:0.6, 33:0.4, 22:0.3, ATs:0.2, A9s:0.4, A8s:0.3, A7s:0.2, KJs:0.15, KTs:0.3, K9s:0.4, QJs:0.3, QTs:0.4, Q9s:0.3, JTs:0.45, J9s:0.4, T9s:0.5, T8s:0.3, 98s:0.4, 87s:0.3, 76s:0.2, 65s:0.2, AJo:0.1, KQo:0.1"
    },
    SB_vs_CO: {
      raise: "JJ+, TT:0.9, 99:0.8, 88:0.7, 77:0.5, 66:0.3, 55:0.1, AKs, AKo, AQs, AQo, AJs:0.9, ATs:0.8, A9s:0.6, A8s:0.45, A7s:0.3, A6s:0.2, A5s, A4s, A3s:0.6, A2s:0.4, KQs:0.9, KJs:0.8, KTs:0.6, K9s:0.35, K8s:0.1, QJs:0.65, QTs:0.45, Q9s:0.2, JTs:0.55, J9s:0.2, T9s:0.4, 98s:0.3, 87s:0.2, 76s:0.2, 65s:0.15, AJo:0.8, ATo:0.3, KQo:0.9, KJo:0.3, QJo:0.1",
      call:  "TT:0.1, 99:0.2, 88:0.3, 77:0.4, 66:0.4, 55:0.3, 44:0.15, AJs:0.1, ATs:0.2, A9s:0.3, A8s:0.2, KQs:0.1, KJs:0.2, KTs:0.35, K9s:0.25, QJs:0.35, QTs:0.4, Q9s:0.15, JTs:0.45, J9s:0.3, T9s:0.4, T8s:0.15, 98s:0.35, 87s:0.3, 76s:0.25, 65s:0.15"
    },
    BB_vs_CO: {
      raise: "JJ+, TT:0.5, 99:0.2, AKs, AKo, AQs, AQo:0.8, AJs:0.7, ATs:0.4, A9s:0.15, A5s:0.7, A4s:0.7, A3s:0.6, A2s:0.5, KQs:0.6, KJs:0.4, KTs:0.2, K9s:0.1, K6s:0.15, K5s:0.2, K4s:0.15, K3s:0.1, K2s:0.1, QJs:0.2, QTs:0.1, Q9s:0.1, JTs:0.1, J9s:0.1, T9s:0.15, 98s:0.1, 87s:0.1, 76s:0.15, 65s:0.2, 54s:0.2, AJo:0.3, ATo:0.1, KQo:0.3, KJo:0.1",
      call:  "TT:0.5, 99:0.8, 22-88, AJs:0.3, ATs:0.6, A9s:0.85, A6s-A8s, A5s:0.3, A4s:0.3, A3s:0.4, A2s:0.5, KQs:0.4, KJs:0.6, KTs:0.8, K9s:0.9, K7s-K8s, K6s:0.85, K5s:0.8, K4s:0.85, K3s:0.9, K2s:0.9, QJs:0.8, QTs:0.9, Q9s:0.9, Q2s-Q8s, JTs:0.9, J9s:0.9, J4s-J8s, J3s:0.6, J2s:0.3, T9s:0.85, T5s-T8s, T4s:0.6, T3s:0.2, 98s:0.9, 94s-97s, 87s:0.9, 84s-86s, 76s:0.85, 73s-75s, 65s:0.8, 63s-64s, 54s:0.8, 53s, 52s:0.8, 43s, 42s:0.3, 32s:0.2, AQo:0.2, AJo:0.7, ATo:0.9, A4o-A9o, A3o:0.9, A2o:0.8, KQo:0.7, KJo:0.9, K9o-KTo, K8o:0.7, K7o:0.4, K6o:0.1, QJo, QTo, Q9o:0.8, Q8o:0.2, JTo, J9o:0.8, J8o:0.2, T9o, T8o:0.4, 98o:0.6, 87o:0.4, 76o:0.2"
    },
    SB_vs_BTN: {
      raise: "99+, 88:0.85, 77:0.7, 66:0.6, 55:0.5, 44:0.4, 33:0.3, 22:0.2, AKs, AKo, AQs, AQo, AJs, ATs:0.9, A9s:0.8, A8s:0.75, A7s:0.6, A6s:0.55, A5s, A4s, A3s:0.8, A2s:0.6, KQs, KJs:0.9, KTs:0.8, K9s:0.65, K8s:0.4, K7s:0.25, K6s:0.2, K5s:0.2, QJs:0.85, QTs:0.7, Q9s:0.5, Q8s:0.15, JTs:0.7, J9s:0.5, J8s:0.1, T9s:0.6, T8s:0.3, 98s:0.5, 97s:0.1, 87s:0.4, 76s:0.4, 65s:0.35, 54s:0.3, AJo, ATo:0.8, A9o:0.25, A8o:0.1, A5o:0.15, KQo:0.9, KJo:0.7, KTo:0.35, QJo:0.45, QTo:0.15, JTo:0.25",
      call:  "88:0.15, 77:0.3, 66:0.4, 55:0.4, 44:0.4, 33:0.35, 22:0.3, ATs:0.1, A9s:0.2, A8s:0.2, A7s:0.2, A6s:0.15, KJs:0.1, KTs:0.2, K9s:0.25, K8s:0.2, QJs:0.15, QTs:0.3, Q9s:0.3, JTs:0.3, J9s:0.35, T9s:0.4, T8s:0.3, 98s:0.4, 97s:0.2, 87s:0.4, 76s:0.35, 65s:0.3, 54s:0.2, KQo:0.1, KJo:0.15, QJo:0.15"
    },
    BB_vs_BTN: {
      raise: "TT+, 99:0.4, 88:0.2, AKs, AKo, AQs, AQo, AJs, ATs:0.7, A9s:0.4, A8s:0.3, A7s:0.2, A6s:0.2, A5s:0.8, A4s:0.8, A3s:0.7, A2s:0.6, KQs:0.8, KJs:0.6, KTs:0.4, K9s:0.25, K8s:0.15, K7s:0.15, K6s:0.15, K5s:0.2, K4s:0.2, K3s:0.15, K2s:0.15, QJs:0.4, QTs:0.3, Q9s:0.2, Q8s:0.1, JTs:0.3, J9s:0.2, J8s:0.1, T9s:0.2, T8s:0.15, 98s:0.15, 97s:0.1, 87s:0.15, 86s:0.1, 76s:0.2, 75s:0.1, 65s:0.25, 64s:0.1, 54s:0.25, 43s:0.1, AJo:0.5, ATo:0.3, A9o:0.15, A8o:0.1, A5o:0.15, A4o:0.1, KQo:0.5, KJo:0.3, KTo:0.15, QJo:0.15, QTo:0.1, JTo:0.1",
      call:  "99:0.6, 88:0.8, 22-77, ATs:0.3, A9s:0.6, A8s:0.7, A7s:0.8, A6s:0.8, A5s:0.2, A4s:0.2, A3s:0.3, A2s:0.4, KQs:0.2, KJs:0.4, KTs:0.6, K9s:0.75, K8s:0.85, K7s:0.85, K6s:0.85, K5s:0.8, K4s:0.8, K3s:0.85, K2s:0.85, QJs:0.6, QTs:0.7, Q9s:0.8, Q8s:0.9, Q2s-Q7s, JTs:0.7, J9s:0.8, J8s:0.9, J2s-J7s, T9s:0.8, T8s:0.85, T2s-T7s, 98s:0.85, 97s:0.9, 94s-96s, 93s:0.9, 92s:0.6, 87s:0.85, 86s:0.9, 84s-85s, 83s:0.8, 82s:0.5, 76s:0.8, 75s:0.9, 74s, 73s:0.8, 72s:0.4, 65s:0.75, 64s:0.9, 63s:0.9, 62s:0.6, 54s:0.75, 53s, 52s:0.8, 43s:0.9, 42s:0.7, 32s:0.5, AJo:0.5, ATo:0.7, A9o:0.85, A8o:0.9, A7o, A6o, A5o:0.85, A4o:0.9, A3o, A2o, KQo:0.5, KJo:0.7, KTo:0.85, K5o-K9o, K4o:0.5, K3o:0.2, K2o:0.1, QJo:0.85, QTo:0.9, Q8o-Q9o, Q7o:0.5, Q6o:0.2, JTo:0.9, J8o-J9o, J7o:0.4, T8o-T9o, T7o:0.4, 98o, 97o:0.4, 87o:0.8, 86o:0.2, 76o:0.6, 65o:0.4, 54o:0.2"
    },
    BB_vs_SB: {
      raise: "99+, 88:0.5, 77:0.3, 66:0.15, 55:0.1, AKs, AKo, AQs, AQo, AJs, ATs, A9s:0.6, A8s:0.4, A7s:0.3, A6s:0.3, A5s:0.8, A4s:0.7, A3s:0.6, A2s:0.5, KQs, KJs:0.8, KTs:0.6, K9s:0.4, K8s:0.2, K7s:0.15, K6s:0.15, K5s:0.2, K4s:0.15, K3s:0.1, K2s:0.1, QJs:0.5, QTs:0.4, Q9s:0.3, Q8s:0.1, JTs:0.4, J9s:0.3, J8s:0.1, T9s:0.3, T8s:0.15, 98s:0.25, 97s:0.1, 87s:0.25, 76s:0.25, 65s:0.3, 54s:0.3, 43s:0.1, AJo:0.8, ATo:0.5, A9o:0.1, A8o:0.1, A7o:0.1, A5o:0.2, A4o:0.15, KQo:0.7, KJo:0.5, KTo:0.15, K9o:0.1, QJo:0.3, QTo:0.1, JTo:0.2, A2o:0.3, K5o:0.25, K4o:0.2, T2s:0.3",
      call:  "88:0.5, 77:0.7, 66:0.85, 55:0.9, 22-44, A9s:0.4, A8s:0.6, A7s:0.7, A6s:0.7, A5s:0.2, A4s:0.3, A3s:0.4, A2s:0.5, KJs:0.2, KTs:0.4, K9s:0.6, K8s:0.8, K7s:0.85, K6s:0.85, K5s:0.8, K4s:0.85, K3s:0.9, K2s:0.9, QJs:0.5, QTs:0.6, Q9s:0.7, Q8s:0.9, Q2s-Q7s, JTs:0.6, J9s:0.7, J8s:0.9, J2s-J7s, T9s:0.7, T8s:0.85, T3s-T7s, T2s:0.7, 98s:0.75, 97s:0.9, 93s-96s, 92s:0.9, 87s:0.75, 83s-86s, 82s:0.7, 76s:0.75, 73s-75s, 72s:0.5, 65s:0.7, 63s-64s, 62s:0.9, 54s:0.7, 53s, 52s, 43s:0.9, 42s:0.8, 32s:0.6, AJo:0.2, ATo:0.5, A9o:0.9, A8o:0.9, A7o:0.9, A6o, A5o:0.8, A4o:0.85, A3o, A2o:0.7, KQo:0.3, KJo:0.5, KTo:0.85, K9o:0.9, K6o-K8o, K5o:0.75, K4o:0.8, K3o:0.6, K2o:0.5, QJo:0.7, QTo:0.9, Q8o-Q9o, Q7o:0.8, Q6o:0.6, Q5o:0.4, JTo:0.8, J8o-J9o, J7o:0.8, J6o:0.4, T8o-T9o, T7o:0.8, T6o:0.3, 98o, 97o:0.8, 96o:0.3, 87o, 86o:0.6, 76o:0.9, 75o:0.5, 65o:0.7, 64o:0.2, 54o:0.4"
    }
  };

  /* ---------------- FACING A 3-BET (opener_vs_3bettor) ----------------
     raise = 4-bet, call = flat the 3-bet, everything else folds. */
  const VS_3BET = {
    UTG_vs_HJ: {
      raise: "KK+, QQ:0.7, JJ:0.25, AKs:0.75, AKo:0.75, AQs:0.15, AQo:0.2, A5s:0.8, A4s:0.6, A3s:0.15, KQs:0.2, KJs:0.2, KTs:0.1, 76s:0.1, 65s:0.25",
      call:  "QQ:0.3, JJ:0.75, TT:0.85, 99:0.7, 88:0.5, 77:0.3, 66:0.1, AKs:0.25, AKo:0.25, AQs:0.85, AJs:0.75, ATs:0.5, A5s:0.2, A4s:0.2, KQs:0.75, KJs:0.4, KTs:0.2, QJs:0.5, QTs:0.1, JTs:0.5, T9s:0.3, 98s:0.2, 87s:0.1, AQo:0.35, KQo:0.05"
    },
    UTG_vs_CO: {
      raise: "KK+, QQ:0.7, JJ:0.25, AKs:0.75, AKo:0.75, AQs:0.15, AQo:0.25, A5s:0.8, A4s:0.6, A3s:0.2, KQs:0.2, KJs:0.2, KTs:0.1, 76s:0.1, 65s:0.3",
      call:  "QQ:0.3, JJ:0.75, TT:0.9, 99:0.7, 88:0.5, 77:0.3, 66:0.15, 55:0.05, AKs:0.25, AKo:0.25, AQs:0.85, AJs:0.8, ATs:0.5, A5s:0.2, A4s:0.2, KQs:0.8, KJs:0.45, KTs:0.2, QJs:0.5, QTs:0.1, JTs:0.5, T9s:0.3, 98s:0.2, 87s:0.1, AQo:0.4, KQo:0.1"
    },
    UTG_vs_BTN: {
      raise: "KK+, QQ:0.7, JJ:0.25, AKs:0.75, AKo:0.75, AQs:0.15, AQo:0.25, A5s:0.8, A4s:0.6, A3s:0.2, KQs:0.2, KJs:0.2, 76s:0.1, 65s:0.3, 54s:0.2",
      call:  "QQ:0.3, JJ:0.75, TT:0.9, 99:0.8, 88:0.6, 77:0.4, 66:0.2, AKs:0.25, AKo:0.25, AQs:0.85, AJs:0.8, ATs:0.6, A5s:0.2, A4s:0.2, KQs:0.8, KJs:0.5, KTs:0.3, QJs:0.6, QTs:0.2, JTs:0.6, T9s:0.4, 98s:0.3, 87s:0.2, AQo:0.4, KQo:0.1"
    },
    UTG_vs_SB: {
      raise: "KK+, QQ:0.75, JJ:0.3, AKs:0.85, AKo:0.8, AQs:0.15, AQo:0.25, A5s:0.6, A4s:0.45, A3s:0.1, KQs:0.15",
      call:  "QQ:0.25, JJ:0.7, TT, 99, 88:0.85, 77:0.6, 66:0.3, 55:0.1, AKs:0.15, AKo:0.2, AQs:0.85, AJs, ATs:0.85, A9s:0.2, A5s:0.4, A4s:0.45, A3s:0.2, KQs:0.85, KJs:0.9, KTs:0.55, QJs:0.85, QTs:0.3, JTs:0.85, T9s:0.5, 98s:0.3, 87s:0.2, 76s:0.1, AQo:0.65, AJo:0.1, KQo:0.3"
    },
    UTG_vs_BB: {
      raise: "KK+, QQ:0.6, JJ:0.15, AKs:0.8, AKo:0.7, AQo:0.1, A5s:0.5, A4s:0.4, KQs:0.1",
      call:  "QQ:0.4, JJ:0.85, TT, 99:0.9, 88:0.7, 77:0.45, 66:0.2, AKs:0.2, AKo:0.3, AQs, AJs:0.9, ATs:0.7, A9s:0.1, A5s:0.4, A4s:0.4, A3s:0.1, KQs:0.9, KJs:0.75, KTs:0.4, QJs:0.7, QTs:0.2, JTs:0.7, T9s:0.45, 98s:0.25, 87s:0.1, AQo:0.5, KQo:0.15"
    },
    HJ_vs_CO: {
      raise: "KK+, QQ:0.9, JJ:0.6, TT:0.3, 99:0.1, AKs:0.9, AKo:0.9, AQs:0.2, AQo:0.3, AJs:0.15, AJo:0.1, A5s:0.85, A4s:0.6, A3s:0.25, A2s:0.1, KQs:0.25, KJs:0.35, KTs:0.25, K9s:0.1, QJs:0.1, 76s:0.1, 65s:0.15, 54s:0.1",
      call:  "QQ:0.1, JJ:0.4, TT:0.7, 99:0.85, 88:0.8, 77:0.6, 66:0.4, 55:0.2, 44:0.1, AKs:0.1, AKo:0.1, AQs:0.8, AJs:0.8, ATs:0.8, A9s:0.4, A8s:0.1, A5s:0.15, A4s:0.2, A3s:0.15, KQs:0.75, KJs:0.55, KTs:0.45, K9s:0.2, QJs:0.7, QTs:0.5, JTs:0.75, J9s:0.15, T9s:0.6, 98s:0.4, 87s:0.3, 76s:0.2, 65s:0.1, AQo:0.5, AJo:0.15, KQo:0.3"
    },
    HJ_vs_BTN: {
      raise: "KK+, QQ:0.9, JJ:0.6, TT:0.3, 99:0.1, AKs:0.9, AKo:0.9, AQs:0.2, AQo:0.3, AJs:0.15, AJo:0.1, KQo:0.05, A5s:0.85, A4s:0.6, A3s:0.3, A2s:0.1, KQs:0.25, KJs:0.35, KTs:0.3, K9s:0.15, QJs:0.1, 76s:0.1, 65s:0.15, 54s:0.1",
      call:  "QQ:0.1, JJ:0.4, TT:0.7, 99:0.85, 88:0.85, 77:0.6, 66:0.4, 55:0.25, 44:0.1, AKs:0.1, AKo:0.1, AQs:0.8, AJs:0.8, ATs:0.85, A9s:0.4, A8s:0.1, A5s:0.15, A4s:0.25, A3s:0.15, KQs:0.75, KJs:0.55, KTs:0.45, K9s:0.2, QJs:0.75, QTs:0.4, JTs:0.8, J9s:0.15, T9s:0.6, 98s:0.3, 87s:0.3, 76s:0.25, 65s:0.15, AQo:0.5, AJo:0.15, KQo:0.35"
    },
    HJ_vs_SB: {
      raise: "KK+, QQ:0.85, JJ:0.5, TT:0.2, AKs:0.85, AKo:0.8, AQs:0.15, AQo:0.3, AJs:0.1, A5s:0.65, A4s:0.45, A3s:0.1, KQs:0.2",
      call:  "QQ:0.15, JJ:0.5, TT:0.8, 99, 88, 77:0.85, 66:0.6, 55:0.4, 44:0.2, AKs:0.15, AKo:0.2, AQs:0.85, AJs:0.9, ATs, A9s:0.6, A8s:0.3, A5s:0.35, A4s:0.4, A3s:0.2, KQs:0.8, KJs:0.95, KTs:0.85, K9s:0.35, QJs:0.9, QTs:0.65, JTs:0.9, J9s:0.35, T9s:0.8, 98s:0.6, 87s:0.5, 76s:0.4, 65s:0.3, AQo:0.6, AJo:0.4, KQo:0.6"
    },
    HJ_vs_BB: {
      raise: "KK+, QQ:0.75, JJ:0.3, TT:0.1, AKs:0.8, AKo:0.7, AQo:0.2, A5s:0.55, A4s:0.4, KQs:0.1",
      call:  "QQ:0.25, JJ:0.7, TT:0.9, 99, 88:0.9, 77:0.7, 66:0.4, 55:0.2, AKs:0.2, AKo:0.3, AQs, AJs:0.85, ATs:0.85, A9s:0.3, A5s:0.4, A4s:0.4, A3s:0.15, KQs:0.85, KJs:0.85, KTs:0.65, K9s:0.1, QJs:0.8, QTs:0.4, JTs:0.8, J9s:0.1, T9s:0.6, 98s:0.4, 87s:0.3, 76s:0.2, 65s:0.1, AQo:0.6, AJo:0.2, KQo:0.4"
    },
    CO_vs_BTN: {
      raise: "KK+, QQ, JJ:0.8, TT:0.5, 99:0.2, 88:0.1, AKs, AKo, AQs:0.2, AQo:0.35, AJs:0.2, AJo:0.2, KQo:0.15, A5s:0.85, A4s:0.6, A3s:0.4, A2s:0.25, KQs:0.25, KJs:0.5, KTs:0.4, K9s:0.25, QJs:0.2, QTs:0.1, 76s:0.1, 65s:0.1",
      call:  "JJ:0.2, TT:0.5, 99:0.8, 88:0.9, 77:0.9, 66:0.7, 55:0.5, 44:0.3, AQs:0.8, AJs:0.8, ATs:0.9, A9s:0.7, A8s:0.4, A7s:0.2, A5s:0.15, A4s:0.3, A3s:0.2, KQs:0.75, KJs:0.5, KTs:0.6, K9s:0.4, K8s:0.1, QJs:0.8, QTs:0.8, Q9s:0.3, JTs:0.9, J9s:0.5, T9s:0.8, T8s:0.2, 98s:0.6, 87s:0.5, 76s:0.4, 65s:0.3, 54s:0.2, AQo:0.6, AJo:0.35, KQo:0.5, KJo:0.1"
    },
    CO_vs_SB: {
      raise: "KK+, QQ:0.9, JJ:0.6, TT:0.3, 99:0.1, AKs:0.9, AKo:0.85, AQs:0.2, AQo:0.45, AJs:0.2, AJo:0.1, KQs:0.25, KJs:0.1, A5s:0.75, A4s:0.6, A3s:0.3, A2s:0.1",
      call:  "QQ:0.1, JJ:0.4, TT:0.7, 99:0.9, 88, 77:0.9, 66:0.65, 55:0.45, 44:0.25, AKs:0.1, AKo:0.15, AQs:0.8, AJs:0.8, ATs, A9s:0.75, A8s:0.5, A7s:0.3, A6s:0.2, A5s:0.25, A4s:0.4, A3s:0.4, A2s:0.25, KQs:0.75, KJs:0.9, KTs:0.8, K9s:0.55, K8s:0.2, QJs:0.9, QTs:0.7, Q9s:0.35, JTs:0.9, J9s:0.55, T9s:0.8, T8s:0.35, 98s:0.8, 97s:0.1, 87s:0.7, 76s:0.6, 65s:0.5, 54s:0.3, AQo:0.55, AJo:0.6, ATo:0.2, KQo:0.75, KJo:0.35, QJo:0.15"
    },
    CO_vs_BB: {
      raise: "KK+, QQ:0.8, JJ:0.45, TT:0.2, AKs:0.85, AKo:0.75, AQs:0.1, AQo:0.3, AJs:0.1, KQs:0.15, A5s:0.65, A4s:0.55, A3s:0.2",
      call:  "QQ:0.2, JJ:0.55, TT:0.8, 99, 88, 77:0.8, 66:0.5, 55:0.3, 44:0.1, AKs:0.15, AKo:0.25, AQs:0.9, AJs:0.9, ATs, A9s:0.7, A8s:0.3, A7s:0.1, A5s:0.35, A4s:0.45, A3s:0.3, A2s:0.1, KQs:0.85, KJs, KTs:0.9, K9s:0.4, K8s:0.1, QJs:0.9, QTs:0.8, Q9s:0.2, JTs:0.9, J9s:0.4, T9s:0.9, T8s:0.2, 98s:0.7, 87s:0.6, 76s:0.5, 65s:0.4, 54s:0.2, AQo:0.65, AJo:0.5, ATo:0.1, KQo:0.7, KJo:0.3"
    },
    BTN_vs_SB: {
      raise: "QQ+, JJ:0.6, TT:0.35, AKs, AKo:0.85, AQs:0.3, AJs:0.2, A5s:0.7, A4s:0.6, A3s:0.3, A2s:0.15, AQo:0.4, AJo:0.1, KQs:0.3, KJs:0.1, K9s:0.05, K8s:0.05, K7s:0.05, K6s:0.05, K5s:0.1, 76s:0.05, 65s:0.05, 54s:0.05, 99:0.1",
      call:  "JJ:0.4, TT:0.65, 99:0.9, 88, 77, 66, 55:0.85, 44:0.7, 33:0.55, 22:0.45, AKo:0.15, AQs:0.7, AJs:0.8, ATs, A9s:0.95, A8s:0.85, A7s:0.7, A6s:0.6, A5s:0.3, A4s:0.4, A3s:0.6, A2s:0.6, KQs:0.7, KJs:0.9, KTs:0.95, K9s:0.9, K8s:0.6, K7s:0.45, K6s:0.35, K5s:0.3, K4s:0.2, QJs:0.95, QTs:0.95, Q9s:0.85, Q8s:0.5, Q7s:0.1, JTs:0.95, J9s:0.9, J8s:0.5, J7s:0.1, T9s:0.95, T8s:0.8, T7s:0.3, 98s:0.95, 97s:0.55, 87s:0.9, 86s:0.4, 76s:0.85, 75s:0.3, 65s:0.8, 64s:0.2, 54s:0.7, AQo:0.6, AJo:0.9, ATo:0.75, A9o:0.3, A8o:0.1, KQo:0.9, KJo:0.8, KTo:0.55, K9o:0.1, QJo:0.65, QTo:0.35, JTo:0.6, T9o:0.1"
    },
    BTN_vs_BB: {
      raise: "QQ+, JJ:0.8, TT:0.55, 99:0.25, AKs, AKo:0.9, AQs:0.55, AJs:0.35, ATs:0.15, A5s:0.75, A4s:0.65, A3s:0.4, A2s:0.25, AQo:0.65, AJo:0.35, ATo:0.1, KQs:0.5, KJs:0.3, KTs:0.15, K9s:0.1, K5s:0.15, KQo:0.35, KJo:0.15, 76s:0.1, 65s:0.1, 54s:0.1",
      call:  "JJ:0.2, TT:0.45, 99:0.75, 88, 77, 66:0.95, 55:0.8, 44:0.6, 33:0.45, 22:0.35, AQs:0.45, AJs:0.65, ATs:0.85, A9s:0.9, A8s:0.8, A7s:0.6, A6s:0.5, A5s:0.25, A4s:0.35, A3s:0.45, A2s:0.4, KQs:0.5, KJs:0.7, KTs:0.8, K9s:0.8, K8s:0.55, K7s:0.4, K6s:0.3, K5s:0.15, K4s:0.1, QJs:0.95, QTs:0.95, Q9s:0.75, Q8s:0.4, JTs:0.95, J9s:0.85, J8s:0.4, T9s:0.95, T8s:0.7, T7s:0.2, 98s:0.9, 97s:0.45, 87s:0.85, 86s:0.35, 76s:0.75, 75s:0.2, 65s:0.7, 64s:0.15, 54s:0.6, AKo:0.1, AQo:0.35, AJo:0.6, ATo:0.6, A9o:0.25, KQo:0.55, KJo:0.6, KTo:0.5, QJo:0.6, QTo:0.3, JTo:0.55"
    },
    SB_vs_BB: {
      raise: "QQ+, JJ:0.7, TT:0.4, 99:0.1, AKs, AKo, AQs:0.5, AQo:0.6, AJs:0.4, AJo:0.3, ATo:0.1, ATs:0.2, A5s:0.7, A4s:0.7, A3s:0.5, A2s:0.4, KQs:0.5, KQo:0.3, KJo:0.1, KJs:0.3, KTs:0.15, K9s:0.1, K8s:0.1, K7s:0.1, K6s:0.1, K5s:0.15, K4s:0.1, QJs:0.1, Q9s:0.1, 87s:0.1, 76s:0.1, 65s:0.1, 54s:0.1",
      call:  "JJ:0.3, TT:0.6, 99:0.9, 88:0.9, 77:0.85, 66:0.6, 55:0.45, 44:0.3, 33:0.3, 22:0.2, AQs:0.5, AJs:0.6, ATs:0.8, A9s:0.6, A8s:0.5, A7s:0.3, A6s:0.2, A5s:0.3, A4s:0.3, A3s:0.3, A2s:0.2, KQs:0.5, KJs:0.65, KTs:0.75, K9s:0.5, K8s:0.15, QJs:0.75, QTs:0.7, Q9s:0.35, JTs:0.75, J9s:0.45, T9s:0.7, T8s:0.25, 98s:0.6, 87s:0.45, 76s:0.4, 65s:0.35, 54s:0.3, AQo:0.4, AJo:0.5, ATo:0.3, KQo:0.6, KJo:0.3, QJo:0.15, JTo:0.1"
    }
  };

  /* ---------------- COLD 4-BET (someone opens, someone else 3-bets, hero has not acted) ----------------
     raise = cold 4-bet, call = cold call the 3-bet, everything else folds. Keyed by hero group
     (IP = any seat before the blinds, SB, BB) and opener tier (EP = UTG..HJ, LP = CO/BTN). The opener is
     still to act behind, so cold calls are rare and the range is mostly 4-bet-or-fold. */
  const COLD_4BET = {
    IP_vs_EP: {
      raise: "KK+, QQ:0.5, AKs:0.7, AKo:0.5, A5s:0.25, A4s:0.15",
      call:  "QQ:0.5, JJ:0.6, TT:0.25, AKs:0.3, AKo:0.3, AQs:0.4, KQs:0.15"
    },
    SB_vs_EP: {
      raise: "KK+, QQ:0.6, AKs:0.75, AKo:0.6, A5s:0.3, A4s:0.2",
      call:  "QQ:0.3, JJ:0.45, TT:0.15, AKs:0.25, AKo:0.2, AQs:0.3"
    },
    SB_vs_LP: {
      raise: "QQ+, JJ:0.5, AKs, AKo, AQs:0.5, AQo:0.2, A5s:0.5, A4s:0.4, A3s:0.2, KQs:0.2",
      call:  "JJ:0.4, TT:0.4, 99:0.2, AQs:0.4, AJs:0.3, KQs:0.3, AQo:0.2"
    },
    BB_vs_EP: {
      raise: "KK+, QQ:0.55, AKs:0.75, AKo:0.55, A5s:0.3, A4s:0.2",
      call:  "QQ:0.45, JJ:0.7, TT:0.5, 99:0.25, AKs:0.25, AKo:0.3, AQs:0.6, AJs:0.25, KQs:0.4, QJs:0.1, JTs:0.1"
    },
    BB_vs_LP: {
      raise: "QQ+, JJ:0.45, AKs, AKo:0.9, AQs:0.4, AQo:0.15, A5s:0.5, A4s:0.4, A3s:0.2, KQs:0.15",
      call:  "JJ:0.5, TT:0.5, 99:0.3, 88:0.15, AKo:0.1, AQs:0.5, AJs:0.4, ATs:0.15, KQs:0.45, KJs:0.2, QJs:0.15, JTs:0.15, AQo:0.25"
    }
  };

  /* ---------------- SQUEEZE (someone opens, someone else calls, hero has not acted) ----------------
     raise = squeeze, call = overcall, everything else folds. Same keys as COLD_4BET. */
  const SQUEEZE = {
    IP_vs_EP: {
      raise: "QQ+, JJ:0.6, TT:0.2, AKs, AKo:0.9, AQs:0.6, AQo:0.2, AJs:0.2, KQs:0.3, A5s:0.5, A4s:0.4, A3s:0.15, 76s:0.1, 65s:0.1",
      call:  "JJ:0.4, TT:0.8, 99, 88, 77:0.9, 66:0.8, 55:0.7, 44:0.6, 33:0.5, 22:0.5, AKo:0.1, AQs:0.4, AJs:0.8, ATs:0.8, A9s:0.3, KQs:0.7, KJs:0.8, KTs:0.6, QJs:0.85, QTs:0.6, JTs:0.9, J9s:0.3, T9s:0.85, T8s:0.2, 98s:0.75, 87s:0.65, 76s:0.6, 65s:0.5, 54s:0.35, AQo:0.4, KQo:0.15"
    },
    SB_vs_EP: {
      raise: "QQ+, JJ:0.75, TT:0.4, 99:0.15, AKs, AKo, AQs:0.8, AQo:0.4, AJs:0.4, ATs:0.15, KQs:0.55, KJs:0.2, A5s:0.6, A4s:0.5, A3s:0.25, A2s:0.1, 76s:0.1, 65s:0.1",
      call:  "JJ:0.25, TT:0.4, 99:0.5, 88:0.5, 77:0.4, 66:0.3, 55:0.2, AQs:0.2, AJs:0.3, ATs:0.3, KQs:0.3, KJs:0.3, QJs:0.3, JTs:0.3, T9s:0.2, 98s:0.1"
    },
    SB_vs_LP: {
      raise: "TT+, 99:0.6, 88:0.3, AKs, AKo, AQs, AQo:0.8, AJs:0.8, AJo:0.3, ATs:0.6, A9s:0.2, KQs:0.85, KQo:0.3, KJs:0.5, KTs:0.3, K9s:0.1, QJs:0.4, QTs:0.15, JTs:0.3, T9s:0.2, A5s:0.8, A4s:0.7, A3s:0.4, A2s:0.25, 98s:0.15, 87s:0.15, 76s:0.15, 65s:0.15",
      call:  "99:0.4, 88:0.6, 77:0.6, 66:0.5, 55:0.4, 44:0.3, 33:0.2, 22:0.2, AJs:0.2, ATs:0.3, A9s:0.3, KJs:0.4, KTs:0.4, QJs:0.5, QTs:0.4, JTs:0.6, J9s:0.3, T9s:0.6, 98s:0.5, 87s:0.4, 76s:0.35, 65s:0.3, 54s:0.2"
    },
    BB_vs_EP: {
      raise: "QQ+, JJ:0.65, TT:0.3, AKs, AKo:0.95, AQs:0.7, AQo:0.3, AJs:0.3, KQs:0.4, A5s:0.6, A4s:0.5, A3s:0.3, A2s:0.15, 65s:0.1, 54s:0.1",
      call:  "JJ:0.35, TT:0.7, 22-99, AKo:0.05, AQs:0.3, AJs:0.7, ATs, A6s-A9s, A5s:0.4, A4s:0.5, A3s:0.7, A2s:0.8, KQs:0.6, KJs:0.9, K9s-KTs, K6s-K8s:0.8, K2s-K5s:0.5, QTs-QJs, Q9s, Q8s:0.8, Q6s-Q7s:0.4, J9s-JTs, J8s:0.8, J7s:0.3, T8s-T9s, T7s:0.6, 98s, 97s:0.8, 96s:0.3, 87s, 86s:0.6, 76s, 75s:0.5, 65s:0.9, 64s:0.3, 54s:0.9, 53s:0.3, 43s:0.2, AQo:0.7, AJo:0.8, ATo:0.5, A9o:0.15, KQo:0.85, KJo:0.6, KTo:0.3, QJo:0.5, QTo:0.2, JTo:0.4, T9o:0.15"
    },
    BB_vs_LP: {
      raise: "TT+, 99:0.5, 88:0.25, AKs, AKo, AQs, AQo, AJs:0.85, AJo:0.5, ATs:0.6, ATo:0.15, A9s:0.25, KQs:0.85, KQo:0.5, KJs:0.5, KJo:0.15, KTs:0.35, K9s:0.15, K8s:0.1, QJs:0.4, QTs:0.2, JTs:0.3, T9s:0.2, A5s:0.8, A4s:0.7, A3s:0.5, A2s:0.4, 98s:0.15, 87s:0.15, 76s:0.2, 65s:0.2, 54s:0.15",
      call:  "99:0.5, 88:0.75, 22-77, AJs:0.15, ATs:0.4, A9s:0.75, A6s-A8s:0.8, A5s:0.2, A4s:0.3, A3s:0.5, A2s:0.6, KQs:0.15, KJs:0.5, KTs:0.65, K9s:0.85, K2s-K8s:0.7, QJs:0.6, QTs:0.8, Q9s, Q5s-Q8s:0.7, JTs:0.7, J9s:0.9, J7s-J8s:0.8, T9s:0.8, T8s:0.9, T7s:0.7, 98s:0.85, 97s:0.8, 96s:0.4, 87s:0.85, 86s:0.6, 76s:0.8, 75s:0.5, 65s:0.8, 64s:0.4, 54s:0.85, 53s:0.4, 43s:0.3, AJo:0.5, ATo:0.75, A9o:0.5, A8o:0.3, KJo:0.85, KTo:0.6, K9o:0.2, QJo:0.85, QTo:0.6, JTo:0.8, J9o:0.2, T9o:0.4, 98o:0.15"
    }
  };

  /* ---------------- BB FACING A SB LIMP ----------------
     raise = isolate, everything else checks (the only true preflop "check" spot). */
  const VS_LIMP = {
    BB_vs_SB: {
      raise: "44+, A2s+, K8s+, K7s:0.8, K6s:0.5, K5s:0.7, Q9s+, Q8s:0.85, JTs, J9s:0.75, A8o+, A7o:0.6, A6o:0.5, A5o:0.6, A4o:0.5, A3o:0.4, A2o:0.3, K8o+, K7o:0.1, QTo+, Q9o:0.4, Q2o:0.05, JTo, J3o:0.35, J2o:0.55, T6o:0.1, T5o:0.4, T4o:0.55, T2o-T3o:0.6, 96o:0.25, 92o-95o:0.6, 87o:0.15, 86o:0.25, 82o-85o:0.6, 76o:0.45, 72o-75o:0.6, 62o+:0.6, 52o+:0.6, 42o+:0.6, 32o:0.6"
    }
  };

  /* ---------------- HEADS-UP (SB = button, 100bb, 2.5x open) ---------------- */
  const HU = {
    // SB first in: raise 2.5bb / limp / fold
    SB_OPEN: {
      raise: "KK+:0.9, 22-QQ, AKs:0.9, A2s-AQs, K2s+, Q2s+, J2s+, T4s+, T3s:0.6, T2s:0.05, 96s+, 95s:0.7, 94s:0.25, 86s+, 85s:0.3, 76s, 75s:0.3, 65s:0.4, 54s:0.35, A8o+, A2o-A7o:0.7, K3o+, K2o:0.65, Q7o+, Q6o:0.85, Q5o:0.75, Q4o:0.95, Q3o:0.45, Q2o:0.2, J7o+, T8o+, T7o:0.1, 98o:0.55",
      limp:  "KK+:0.1, AKs:0.1, T3s:0.4, T2s:0.95, 95s:0.3, 94s:0.75, 92s-93s, 85s:0.7, 82s-84s, 75s:0.7, 72s-74s, 65s:0.6, 62s-64s, 54s:0.65, 53s, 52s:0.7, 42s+, 32s, A2o-A7o:0.3, K2o:0.35, Q6o:0.15, Q5o:0.25, Q4o:0.05, Q3o:0.55, Q2o:0.8, J2o-J6o, T7o:0.9, T2o-T6o, 98o:0.45, 94o-97o, 93o:0.3, 85o+, 84o:0.85, 75o+, 74o:0.1, 65o, 64o:0.55, 54o"
    },
    // BB facing the 2.5bb open: 3-bet to 10bb / call / fold
    BB_vs_SB: {
      raise: "66+, 55:0.15, A7s+, A6s:0.4, A5s:0.55, A2s-A4s:0.4, KJs+, KTs:0.7, K9s:0.6, K2s-K8s:0.2, JTs:0.5, T9s:0.5, 98s:0.5, 87s:0.5, 76s:0.5, 65s:0.5, A9o+, A8o:0.85, A2o-A5o:0.1, KQo, KJo:0.4",
      call:  "55:0.85, 22-44, A6s:0.6, A5s:0.45, A2s-A4s:0.6, KTs:0.3, K9s:0.4, K2s-K8s:0.8, Q2s+, JTs:0.5, J2s-J9s, T9s:0.5, T5s-T8s, T4s:0.75, T3s, T2s:0.85, 98s:0.5, 95s-97s, 87s:0.5, 85s-86s, 84s:0.45, 83s:0.05, 76s:0.5, 75s, 74s:0.8, 65s:0.5, 64s:0.55, 63s:0.5, 53s+, 43s:0.25, A8o:0.15, A6o-A7o, A2o-A5o:0.9, KJo:0.6, K2o-KTo, Q2o+, J7o+, J6o:0.95, J5o, J4o:0.35, T7o+, 98o, 97o:0.65, 96o:0.15, 87o, 76o"
    },
    // SB (opened 2.5bb) facing the 10bb 3-bet: 4-bet to 22bb / call / fold
    SB_vs_BB_3BET: {
      raise: "JJ+, TT:0.8, AKs, AQs:0.5, A2s-A5s:0.3, K2s-K5s:0.1, AKo, AQo:0.2, A2o-A5o:0.2",
      call:  "TT:0.2, 22-99, AQs:0.5, A6s-AJs, A2s-A5s:0.7, K6s+, K5s:0.8, K4s:0.8, Q8s+, Q5s-Q7s:0.8, J8s+, J7s:0.8, J6s:0.6, T7s+, 98s, 97s:0.95, 87s, 76s:0.5, 65s:0.5, 54s:0.55, AQo:0.8, A6o-AJo, A4o-A5o:0.8, A3o:0.5, A2o:0.15, KTo+, QTo+, JTo, J9o:0.15"
    },
    // BB facing the SB limp: raise to 4bb / check
    BB_vs_LIMP: {
      raise: "55+, 44:0.4, A4s+, A2s-A3s:0.7, K4s+, K3s:0.7, K2s:0.4, Q5s+, Q3s-Q4s:0.7, Q2s:0.4, J7s+, J5s-J6s:0.7, J3s-J4s:0.4, T9s, T7s-T8s:0.7, T6s:0.4, 97s+:0.4, 87s:0.35, 86s:0.25, 76s:0.35, 75s:0.25, 65s:0.35, 64s:0.2, 54s:0.35, 53s:0.2, 43s:0.1, A5o+, A4o:0.7, A2o-A3o:0.4, K8o+, K5o-K7o:0.7, K3o-K4o:0.4, Q8o+, Q5o-Q7o:0.7, Q4o:0.4, J8o+, J7o:0.7, J6o:0.4, T8o+:0.7, T7o:0.4, 92o-94o:0.3, 82o-86o:0.3, 72o+:0.3, 62o+:0.3, 52o+:0.3, 42o+:0.3, 32o:0.3"
    },
    // SB (limped) facing the BB's 4bb raise: 3-bet to 12bb / call / fold
    SB_vs_ISO: {
      raise: "KK+, AKs, 84s:0.1, 75s:0.15, 74s:0.1, 65s:0.2, 64s:0.15, 54s:0.2, 53s:0.15, 43s:0.1, A7o:0.4, A6o:0.35, A5o:0.4, A4o:0.3, A3o:0.2, A2o:0.15, K2o:0.15",
      call:  "T2s-T3s, 92s-95s, 85s, 84s:0.9, 82s-83s, 75s:0.85, 74s:0.9, 73s, 65s:0.8, 64s:0.85, 62s-63s, 54s:0.8, 53s:0.85, 52s, 43s:0.9, 42s:0.15, A7o:0.6, A6o:0.65, A5o:0.6, A4o:0.7, A3o:0.8, A2o:0.85, K2o:0.85, Q2o-Q6o, J4o-J6o, J2o-J3o:0.6, T6o-T7o, T5o:0.6, T4o:0.35, T2o-T3o:0.15, 96o+, 95o:0.8, 86o+, 85o:0.35, 76o, 75o:0.6, 65o:0.6, 64o:0.15, 54o:0.15"
    }
  };

  root.RANGES = { RFI6, RFI9, VS_OPEN, VS_3BET, COLD_4BET, SQUEEZE, VS_LIMP, HU };
})(typeof window !== 'undefined' ? window : globalThis);
