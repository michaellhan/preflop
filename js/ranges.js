/* ranges.js — preflop strategy data.
   Model: 100bb effective, no ante, cash-game rake (~NL100 style: 5% capped).
   Open sizes: 2.5bb from every position, 3bb from the SB (raise-or-fold SB).
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
    UTG: "55+, 44:0.8, 33:0.6, 22:0.5, A8s+, A7s:0.8, A6s:0.7, A5s, A4s, A3s:0.9, A2s:0.75, K9s+, K8s:0.5, K7s:0.25, K6s:0.15, K5s:0.15, QTs+, Q9s:0.8, Q8s:0.15, JTs, J9s:0.8, J8s:0.1, T9s, T8s:0.3, 98s:0.7, 87s:0.5, 76s:0.4, 65s:0.3, 54s:0.3, AJo+, ATo:0.6, KQo, KJo:0.5, QJo:0.1",
    HJ:  "44+, 33:0.9, 22:0.8, A2s+, K6s+, K5s:0.6, K4s:0.3, K3s:0.2, K2s:0.15, Q9s+, Q8s:0.6, Q7s:0.1, J9s+, J8s:0.5, T9s, T8s:0.7, T7s:0.1, 98s, 97s:0.3, 87s, 86s:0.1, 76s:0.8, 65s:0.7, 54s:0.6, ATo+, A9o:0.1, KJo+, KTo:0.4, QJo:0.7, QTo:0.1, JTo:0.15",
    CO:  "22+, A2s+, K4s+, K3s:0.7, K2s:0.5, Q6s+, Q5s:0.4, Q4s:0.2, Q3s:0.1, J8s+, J7s:0.4, J6s:0.1, T8s+, T7s:0.4, T6s:0.1, 97s+, 86s+, 75s+, 65s, 64s:0.3, 54s, 53s:0.1, A9o+, A8o:0.3, KTo+, K9o:0.2, QTo+, JTo",
    BTN: "22+, A2s+, K2s+, Q2s+, J5s+, J4s:0.7, J3s:0.3, J2s:0.1, T7s+, T6s:0.8, T5s:0.3, T4s:0.1, 96s+, 95s:0.2, 85s+, 84s:0.1, 74s+, 64s+, 63s:0.1, 53s+, 43s, A4o+, A3o:0.4, A2o:0.3, K9o+, K8o:0.8, K7o:0.4, Q9o+, Q8o:0.3, J9o+, J8o:0.3, T9o, T8o:0.5, 98o:0.4, 87o:0.2",
    SB:  "22+, A2s+, K2s+, Q2s+, J5s+, J4s:0.5, T6s+, T5s:0.2, 96s+, 95s:0.2, 85s+, 84s:0.1, 74s+, 64s+, 53s+, 43s:0.8, A4o+, A3o:0.5, A2o:0.3, K9o+, K8o:0.6, K7o:0.1, Q9o+, Q8o:0.3, J9o+, J8o:0.2, T9o, T8o:0.3, 98o:0.2, 87o:0.1"
  };

  const RFI9 = {
    'UTG':   "66+, 55:0.6, 44:0.3, 33:0.2, 22:0.1, ATs+, A9s:0.7, A8s:0.4, A7s:0.2, A5s:0.9, A4s:0.7, A3s:0.3, A2s:0.1, KTs+, K9s:0.5, QTs+, Q9s:0.2, JTs, J9s:0.3, T9s:0.8, 98s:0.4, 87s:0.2, 76s:0.2, 65s:0.2, AQo+, AJo:0.7, ATo:0.1, KQo:0.6, KJo:0.1",
    'UTG+1': "66+, 55:0.8, 44:0.5, 33:0.3, 22:0.2, A9s+, A8s:0.6, A7s:0.4, A6s:0.2, A5s, A4s:0.9, A3s:0.5, A2s:0.3, KTs+, K9s:0.8, K8s:0.2, QTs+, Q9s:0.4, JTs, J9s:0.5, T9s, T8s:0.1, 98s:0.5, 87s:0.3, 76s:0.3, 65s:0.2, 54s:0.1, AQo+, AJo:0.9, ATo:0.2, KQo:0.8, KJo:0.2",
    'UTG+2': "55+, 44:0.6, 33:0.4, 22:0.3, A8s+, A7s:0.6, A6s:0.4, A5s, A4s, A3s:0.7, A2s:0.5, K9s+, K8s:0.3, K7s:0.1, QTs+, Q9s:0.6, JTs, J9s:0.7, T9s, T8s:0.2, 98s:0.6, 87s:0.4, 76s:0.4, 65s:0.3, 54s:0.2, AJo+, ATo:0.4, KQo, KJo:0.3",
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
      raise: "QQ+, JJ:0.5, AKs, AKo, AQs:0.7, AQo:0.3, A5s:0.6, A4s:0.4, KQs:0.3, AJs:0.2",
      call:  "JJ:0.5, TT, 99, 88, 77:0.8, 66:0.5, 55:0.3, AQs:0.3, AJs:0.8, ATs, A9s:0.3, KQs:0.7, KJs, KTs:0.6, QJs, QTs:0.5, JTs, T9s:0.7, 98s:0.4, 87s:0.2, AQo:0.7, AJo:0.2, KQo:0.3"
    },
    CO_vs_UTG: {
      raise: "QQ+, JJ:0.5, AKs, AKo, AQs:0.8, AQo:0.4, A5s:0.7, A4s:0.5, A3s:0.2, KQs:0.3, KJs:0.2, 76s:0.1",
      call:  "JJ:0.5, TT, 99, 88, 77, 66, 55:0.5, 44:0.3, AQs:0.2, AJs, ATs, A9s:0.5, KQs:0.7, KJs:0.8, KTs:0.8, K9s:0.2, QJs, QTs:0.8, JTs, J9s:0.3, T9s, 98s:0.7, 87s:0.5, 76s:0.4, 65s:0.3, AQo:0.6, AJo:0.4, KQo:0.5"
    },
    BTN_vs_UTG: {
      raise: "QQ+, JJ:0.6, TT:0.1, AKs, AKo, AQs, AQo:0.6, AJs:0.5, A5s:0.8, A4s:0.7, A3s:0.3, A2s:0.1, KQs:0.4, KJs:0.3, KTs:0.1, QJs:0.1, 76s:0.1, 65s:0.1",
      call:  "JJ:0.4, TT:0.9, 99, 88, 77, 66, 55, 44:0.6, 33:0.3, 22:0.2, AJs:0.5, ATs, A9s:0.7, A8s:0.3, KQs:0.6, KJs:0.7, KTs:0.9, K9s:0.4, QJs:0.9, QTs, Q9s:0.3, JTs, J9s:0.6, T9s, T8s:0.4, 98s, 87s:0.9, 76s:0.8, 65s:0.7, 54s:0.5, AQo:0.4, AJo:0.6, ATo:0.1, KQo:0.8, KJo:0.2"
    },
    SB_vs_UTG: {
      raise: "JJ+, TT:0.6, 99:0.2, AKs, AKo, AQs, AQo:0.7, AJs:0.8, ATs:0.4, A5s:0.7, A4s:0.5, KQs:0.7, KJs:0.4, KQo:0.2, QJs:0.2, JTs:0.1",
      call:  "TT:0.4, 99:0.7, 88:0.7, 77:0.5, 66:0.3, AJs:0.2, ATs:0.4, KQs:0.3, KJs:0.3, QJs:0.5, JTs:0.5, T9s:0.3, AQo:0.2"
    },
    BB_vs_UTG: {
      raise: "QQ+, JJ:0.5, TT:0.2, AKs, AKo, AQs:0.8, AQo:0.5, AJs:0.4, A5s:0.7, A4s:0.7, A3s:0.4, A2s:0.3, KQs:0.4, KJs:0.2, K5s:0.1, 76s:0.1, 65s:0.1",
      call:  "JJ:0.5, TT:0.8, 22-99, AQs:0.2, AJs:0.6, A6s-ATs, A5s:0.3, A4s:0.3, A3s:0.6, A2s:0.7, KQs:0.6, KJs:0.8, K6s-KTs, K5s:0.9, K4s:0.7, K3s:0.4, K2s:0.3, Q6s-QJs, Q5s:0.6, Q4s:0.3, J7s-JTs, J6s:0.4, T7s-T9s, T6s:0.4, 96s-98s, 86s-87s, 85s:0.5, 76s:0.9, 75s, 74s:0.3, 65s:0.9, 64s:0.8, 54s, 53s:0.5, 43s:0.4, AQo:0.5, AJo, ATo, A9o:0.7, A8o:0.3, KQo, KJo, KTo:0.9, K9o:0.2, QJo, QTo:0.8, JTo, J9o:0.2, T9o:0.5, 98o:0.2"
    },
    CO_vs_HJ: {
      raise: "QQ+, JJ:0.6, TT:0.1, AKs, AKo, AQs:0.9, AQo:0.5, AJs:0.4, A5s:0.7, A4s:0.6, A3s:0.3, KQs:0.4, KJs:0.3, KTs:0.1, QJs:0.1, 65s:0.1, 76s:0.1",
      call:  "JJ:0.4, TT:0.9, 99, 88, 77, 66, 55:0.7, 44:0.4, 33:0.2, AQs:0.1, AJs:0.6, ATs, A9s:0.6, A8s:0.2, KQs:0.6, KJs:0.7, KTs:0.8, K9s:0.3, QJs:0.9, QTs:0.9, Q9s:0.2, JTs, J9s:0.5, T9s, T8s:0.3, 98s:0.9, 87s:0.7, 76s:0.6, 65s:0.5, 54s:0.3, AQo:0.5, AJo:0.5, KQo:0.7, KJo:0.1"
    },
    BTN_vs_HJ: {
      raise: "QQ+, JJ:0.7, TT:0.2, AKs, AKo, AQs, AQo:0.7, AJs:0.6, ATs:0.2, A5s:0.9, A4s:0.8, A3s:0.4, A2s:0.2, KQs:0.5, KJs:0.4, KTs:0.2, QJs:0.1, KQo:0.1, 76s:0.1, 65s:0.1, 54s:0.1",
      call:  "JJ:0.3, TT:0.8, 99, 88, 77, 66, 55, 44:0.8, 33:0.5, 22:0.4, AJs:0.4, ATs:0.8, A9s:0.8, A8s:0.5, A7s:0.2, KQs:0.5, KJs:0.6, KTs:0.8, K9s:0.6, K8s:0.1, QJs:0.9, QTs, Q9s:0.5, JTs, J9s:0.8, J8s:0.1, T9s, T8s:0.6, 98s, 97s:0.2, 87s, 86s:0.1, 76s:0.9, 65s:0.9, 54s:0.7, AQo:0.3, AJo:0.8, ATo:0.3, KQo:0.9, KJo:0.4, QJo:0.2"
    },
    SB_vs_HJ: {
      raise: "TT+, 99:0.4, 88:0.1, AKs, AKo, AQs, AQo:0.9, AJs, ATs:0.7, A9s:0.2, A5s:0.8, A4s:0.7, A3s:0.2, KQs:0.9, KJs:0.6, KTs:0.3, QJs:0.4, JTs:0.2, KQo:0.5, AJo:0.3",
      call:  "99:0.6, 88:0.8, 77:0.6, 66:0.4, 55:0.2, ATs:0.3, A9s:0.3, KQs:0.1, KJs:0.4, KTs:0.4, QJs:0.6, QTs:0.4, JTs:0.7, T9s:0.5, 98s:0.3, AQo:0.1, KQo:0.2"
    },
    BB_vs_HJ: {
      raise: "QQ+, JJ:0.6, TT:0.3, AKs, AKo, AQs:0.9, AQo:0.6, AJs:0.5, ATs:0.2, A5s:0.7, A4s:0.7, A3s:0.5, A2s:0.4, KQs:0.5, KJs:0.3, KTs:0.1, K6s:0.1, K5s:0.15, Q9s:0.1, J9s:0.1, T9s:0.1, 76s:0.1, 65s:0.15, 54s:0.15, AJo:0.1, KQo:0.15",
      call:  "JJ:0.4, TT:0.7, 22-99, AQs:0.1, AJs:0.5, ATs:0.8, A6s-A9s, A5s:0.3, A4s:0.3, A3s:0.5, A2s:0.6, KQs:0.5, KJs:0.7, KTs:0.9, K7s-K9s, K6s:0.9, K5s:0.85, K4s, K3s:0.8, K2s:0.6, QTs-QJs, Q9s:0.9, Q4s-Q8s, Q3s:0.7, Q2s:0.5, JTs, J9s:0.9, J6s-J8s, J5s:0.7, J4s:0.3, T9s:0.9, T6s-T8s, T5s:0.5, T4s:0.2, 95s-98s, 94s:0.2, 84s-87s, 76s:0.9, 74s-75s, 73s:0.2, 65s:0.85, 64s, 63s:0.5, 54s:0.85, 53s, 52s:0.2, 43s:0.8, 42s:0.2, 32s:0.2, AQo:0.4, AJo:0.9, ATo, A9o, A8o:0.7, A7o:0.4, A6o:0.3, A5o:0.5, A4o:0.3, A3o:0.1, KQo:0.85, KJo, KTo, K9o:0.6, K8o:0.2, QJo, QTo, Q9o:0.5, JTo, J9o:0.5, T9o:0.8, T8o:0.2, 98o:0.5, 87o:0.3, 76o:0.1"
    },
    BTN_vs_CO: {
      raise: "JJ+, TT:0.4, 99:0.1, AKs, AKo, AQs, AQo:0.9, AJs:0.8, ATs:0.4, A9s:0.1, A5s, A4s:0.9, A3s:0.6, A2s:0.4, KQs:0.7, KJs:0.5, KTs:0.3, K9s:0.1, K6s:0.1, K5s:0.1, QJs:0.2, QTs:0.1, JTs:0.1, KQo:0.3, AJo:0.2, 76s:0.15, 65s:0.15, 54s:0.15",
      call:  "TT:0.6, 99:0.9, 88, 77, 66, 55, 44, 33:0.7, 22:0.6, AJs:0.2, ATs:0.6, A9s:0.9, A8s:0.8, A7s:0.5, A6s:0.3, KQs:0.3, KJs:0.5, KTs:0.7, K9s:0.8, K8s:0.3, K7s:0.1, QJs:0.8, QTs:0.9, Q9s:0.7, Q8s:0.2, JTs:0.9, J9s:0.9, J8s:0.4, T9s, T8s:0.8, T7s:0.2, 98s, 97s:0.5, 87s, 86s:0.3, 76s:0.85, 75s:0.2, 65s:0.85, 64s:0.1, 54s:0.85, AQo:0.1, AJo:0.8, ATo:0.6, A9o:0.1, KQo:0.7, KJo:0.7, KTo:0.3, QJo:0.5, QTo:0.1, JTo:0.4"
    },
    SB_vs_CO: {
      raise: "99+, 88:0.5, 77:0.2, AKs, AKo, AQs, AQo, AJs, ATs, A9s:0.5, A8s:0.2, A5s, A4s:0.8, A3s:0.4, A2s:0.2, KQs, KJs:0.9, KTs:0.6, K9s:0.2, QJs:0.6, QTs:0.3, JTs:0.4, T9s:0.2, KQo:0.8, AJo:0.7, ATo:0.2, KJo:0.2, 76s:0.1, 65s:0.1",
      call:  "88:0.5, 77:0.6, 66:0.5, 55:0.3, 44:0.1, A9s:0.4, A8s:0.4, A7s:0.1, KTs:0.3, K9s:0.3, QJs:0.4, QTs:0.5, JTs:0.6, J9s:0.2, T9s:0.6, 98s:0.4, 87s:0.3, 76s:0.2, 65s:0.1, AJo:0.1, ATo:0.1, KQo:0.2, KJo:0.1"
    },
    BB_vs_CO: {
      raise: "JJ+, TT:0.5, 99:0.2, AKs, AKo, AQs, AQo:0.8, AJs:0.7, ATs:0.4, A9s:0.15, A5s:0.7, A4s:0.7, A3s:0.6, A2s:0.5, KQs:0.6, KJs:0.4, KTs:0.2, K9s:0.1, K6s:0.15, K5s:0.2, K4s:0.15, K3s:0.1, K2s:0.1, QJs:0.2, QTs:0.1, Q9s:0.1, JTs:0.1, J9s:0.1, T9s:0.15, 98s:0.1, 87s:0.1, 76s:0.15, 65s:0.2, 54s:0.2, AJo:0.3, ATo:0.1, KQo:0.3, KJo:0.1",
      call:  "TT:0.5, 99:0.8, 22-88, AJs:0.3, ATs:0.6, A9s:0.85, A6s-A8s, A5s:0.3, A4s:0.3, A3s:0.4, A2s:0.5, KQs:0.4, KJs:0.6, KTs:0.8, K9s:0.9, K7s-K8s, K6s:0.85, K5s:0.8, K4s:0.85, K3s:0.9, K2s:0.9, QJs:0.8, QTs:0.9, Q9s:0.9, Q2s-Q8s, JTs:0.9, J9s:0.9, J4s-J8s, J3s:0.6, J2s:0.3, T9s:0.85, T5s-T8s, T4s:0.6, T3s:0.2, 98s:0.9, 94s-97s, 87s:0.9, 84s-86s, 76s:0.85, 73s-75s, 65s:0.8, 63s-64s, 54s:0.8, 53s, 52s:0.8, 43s, 42s:0.3, 32s:0.2, AQo:0.2, AJo:0.7, ATo:0.9, A4o-A9o, A3o:0.9, A2o:0.8, KQo:0.7, KJo:0.9, K9o-KTo, K8o:0.7, K7o:0.4, K6o:0.1, QJo, QTo, Q9o:0.8, Q8o:0.2, JTo, J9o:0.8, J8o:0.2, T9o, T8o:0.4, 98o:0.6, 87o:0.4, 76o:0.2"
    },
    SB_vs_BTN: {
      raise: "88+, 77:0.6, 66:0.3, 55:0.2, AKs, AKo, AQs, AQo, AJs, ATs, A9s:0.8, A8s:0.5, A7s:0.3, A6s:0.2, A5s, A4s, A3s:0.6, A2s:0.4, KQs, KJs, KTs:0.9, K9s:0.5, K8s:0.2, K7s:0.1, K6s:0.1, K5s:0.1, QJs:0.9, QTs:0.6, Q9s:0.3, JTs:0.7, J9s:0.3, T9s:0.4, 98s:0.2, 87s:0.2, 76s:0.2, 65s:0.2, 54s:0.15, AJo, ATo:0.7, A9o:0.2, A5o:0.1, KQo, KJo:0.6, KTo:0.3, QJo:0.4, QTo:0.1, JTo:0.2",
      call:  "77:0.4, 66:0.6, 55:0.6, 44:0.5, 33:0.3, 22:0.2, A9s:0.2, A8s:0.5, A7s:0.5, A6s:0.4, A3s:0.2, A2s:0.1, KTs:0.1, K9s:0.5, K8s:0.3, K7s:0.1, QJs:0.1, QTs:0.4, Q9s:0.5, Q8s:0.1, JTs:0.3, J9s:0.5, J8s:0.1, T9s:0.6, T8s:0.3, 98s:0.6, 97s:0.1, 87s:0.5, 76s:0.5, 65s:0.4, 54s:0.3, ATo:0.2, KJo:0.2, KTo:0.1, QJo:0.2, JTo:0.1"
    },
    BB_vs_BTN: {
      raise: "TT+, 99:0.4, 88:0.2, AKs, AKo, AQs, AQo, AJs, ATs:0.7, A9s:0.4, A8s:0.3, A7s:0.2, A6s:0.2, A5s:0.8, A4s:0.8, A3s:0.7, A2s:0.6, KQs:0.8, KJs:0.6, KTs:0.4, K9s:0.25, K8s:0.15, K7s:0.15, K6s:0.15, K5s:0.2, K4s:0.2, K3s:0.15, K2s:0.15, QJs:0.4, QTs:0.3, Q9s:0.2, Q8s:0.1, JTs:0.3, J9s:0.2, J8s:0.1, T9s:0.2, T8s:0.15, 98s:0.15, 97s:0.1, 87s:0.15, 86s:0.1, 76s:0.2, 75s:0.1, 65s:0.25, 64s:0.1, 54s:0.25, 43s:0.1, AJo:0.5, ATo:0.3, A9o:0.15, A8o:0.1, A5o:0.15, A4o:0.1, KQo:0.5, KJo:0.3, KTo:0.15, QJo:0.15, QTo:0.1, JTo:0.1",
      call:  "99:0.6, 88:0.8, 22-77, ATs:0.3, A9s:0.6, A8s:0.7, A7s:0.8, A6s:0.8, A5s:0.2, A4s:0.2, A3s:0.3, A2s:0.4, KQs:0.2, KJs:0.4, KTs:0.6, K9s:0.75, K8s:0.85, K7s:0.85, K6s:0.85, K5s:0.8, K4s:0.8, K3s:0.85, K2s:0.85, QJs:0.6, QTs:0.7, Q9s:0.8, Q8s:0.9, Q2s-Q7s, JTs:0.7, J9s:0.8, J8s:0.9, J2s-J7s, T9s:0.8, T8s:0.85, T2s-T7s, 98s:0.85, 97s:0.9, 94s-96s, 93s:0.9, 92s:0.6, 87s:0.85, 86s:0.9, 84s-85s, 83s:0.8, 82s:0.5, 76s:0.8, 75s:0.9, 74s, 73s:0.8, 72s:0.4, 65s:0.75, 64s:0.9, 63s:0.9, 62s:0.6, 54s:0.75, 53s, 52s:0.8, 43s:0.9, 42s:0.7, 32s:0.5, AJo:0.5, ATo:0.7, A9o:0.85, A8o:0.9, A7o, A6o, A5o:0.85, A4o:0.9, A3o, A2o, KQo:0.5, KJo:0.7, KTo:0.85, K5o-K9o, K4o:0.5, K3o:0.2, K2o:0.1, QJo:0.85, QTo:0.9, Q8o-Q9o, Q7o:0.5, Q6o:0.2, JTo:0.9, J8o-J9o, J7o:0.4, T8o-T9o, T7o:0.4, 98o, 97o:0.4, 87o:0.8, 86o:0.2, 76o:0.6, 65o:0.4, 54o:0.2"
    },
    BB_vs_SB: {
      raise: "99+, 88:0.5, 77:0.3, 66:0.15, 55:0.1, AKs, AKo, AQs, AQo, AJs, ATs, A9s:0.6, A8s:0.4, A7s:0.3, A6s:0.3, A5s:0.8, A4s:0.7, A3s:0.6, A2s:0.5, KQs, KJs:0.8, KTs:0.6, K9s:0.4, K8s:0.2, K7s:0.15, K6s:0.15, K5s:0.2, K4s:0.15, K3s:0.1, K2s:0.1, QJs:0.5, QTs:0.4, Q9s:0.3, Q8s:0.1, JTs:0.4, J9s:0.3, J8s:0.1, T9s:0.3, T8s:0.15, 98s:0.25, 97s:0.1, 87s:0.25, 76s:0.25, 65s:0.3, 54s:0.3, 43s:0.1, AJo:0.8, ATo:0.5, A9o:0.3, A8o:0.2, A7o:0.1, A5o:0.2, A4o:0.15, KQo:0.7, KJo:0.5, KTo:0.3, K9o:0.1, QJo:0.3, QTo:0.2, JTo:0.2",
      call:  "88:0.5, 77:0.7, 66:0.85, 55:0.9, 22-44, A9s:0.4, A8s:0.6, A7s:0.7, A6s:0.7, A5s:0.2, A4s:0.3, A3s:0.4, A2s:0.5, KJs:0.2, KTs:0.4, K9s:0.6, K8s:0.8, K7s:0.85, K6s:0.85, K5s:0.8, K4s:0.85, K3s:0.9, K2s:0.9, QJs:0.5, QTs:0.6, Q9s:0.7, Q8s:0.9, Q2s-Q7s, JTs:0.6, J9s:0.7, J8s:0.9, J2s-J7s, T9s:0.7, T8s:0.85, T2s-T7s, 98s:0.75, 97s:0.9, 93s-96s, 92s:0.9, 87s:0.75, 83s-86s, 82s:0.7, 76s:0.75, 73s-75s, 72s:0.5, 65s:0.7, 63s-64s, 62s:0.9, 54s:0.7, 53s, 52s, 43s:0.9, 42s:0.8, 32s:0.6, AJo:0.2, ATo:0.5, A9o:0.7, A8o:0.8, A7o:0.9, A6o, A5o:0.8, A4o:0.85, A3o, A2o, KQo:0.3, KJo:0.5, KTo:0.7, K9o:0.9, K5o-K8o, K4o:0.8, K3o:0.6, K2o:0.5, QJo:0.7, QTo:0.8, Q8o-Q9o, Q7o:0.8, Q6o:0.6, Q5o:0.4, JTo:0.8, J8o-J9o, J7o:0.8, J6o:0.4, T8o-T9o, T7o:0.8, T6o:0.3, 98o, 97o:0.8, 96o:0.3, 87o, 86o:0.6, 76o:0.9, 75o:0.5, 65o:0.7, 64o:0.2, 54o:0.4"
    }
  };

  /* ---------------- FACING A 3-BET (opener_vs_3bettor) ----------------
     raise = 4-bet, call = flat the 3-bet, everything else folds. */
  const VS_3BET = {
    UTG_vs_HJ: {
      raise: "KK+, QQ:0.3, AKs:0.6, AKo:0.5, A5s:0.5, A4s:0.3, AQo:0.1, KQs:0.1",
      call:  "QQ:0.7, JJ, TT, 99, 88:0.8, 77:0.5, 66:0.3, 55:0.2, AKs:0.4, AKo:0.5, AQs, AJs, ATs:0.8, A9s:0.2, A5s:0.4, A4s:0.4, A3s:0.2, KQs:0.9, KJs:0.8, KTs:0.5, QJs:0.7, QTs:0.3, JTs:0.7, T9s:0.5, 98s:0.3, 87s:0.2, AQo:0.6, AJo:0.1, KQo:0.3"
    },
    UTG_vs_CO: {
      raise: "KK+, QQ:0.4, AKs:0.7, AKo:0.6, A5s:0.6, A4s:0.4, AQo:0.15, KQs:0.1, AJs:0.1",
      call:  "QQ:0.6, JJ, TT, 99, 88:0.8, 77:0.5, 66:0.3, 55:0.2, AKs:0.3, AKo:0.4, AQs, AJs:0.9, ATs:0.8, A9s:0.2, A5s:0.3, A4s:0.4, A3s:0.2, KQs:0.9, KJs:0.8, KTs:0.5, QJs:0.7, QTs:0.3, JTs:0.7, T9s:0.5, 98s:0.3, 87s:0.2, AQo:0.6, AJo:0.1, KQo:0.3"
    },
    UTG_vs_BTN: {
      raise: "KK+, QQ:0.4, AKs:0.7, AKo:0.6, A5s:0.6, A4s:0.4, AQo:0.2, KQs:0.1, AJs:0.1",
      call:  "QQ:0.6, JJ, TT, 99, 88:0.9, 77:0.6, 66:0.4, 55:0.3, AKs:0.3, AKo:0.4, AQs, AJs:0.9, ATs:0.9, A9s:0.3, A5s:0.4, A4s:0.5, A3s:0.3, KQs:0.9, KJs:0.9, KTs:0.6, QJs:0.8, QTs:0.4, JTs:0.8, T9s:0.6, 98s:0.4, 87s:0.3, 76s:0.2, AQo:0.6, AJo:0.2, KQo:0.4"
    },
    UTG_vs_SB: {
      raise: "KK+, QQ:0.5, AKs:0.8, AKo:0.7, A5s:0.5, A4s:0.4, AQo:0.2, KQs:0.1",
      call:  "QQ:0.5, JJ, TT, 99, 88:0.8, 77:0.5, 66:0.2, AKs:0.2, AKo:0.3, AQs, AJs, ATs:0.7, A9s:0.2, A5s:0.4, A4s:0.4, A3s:0.1, KQs:0.9, KJs:0.8, KTs:0.4, QJs:0.7, QTs:0.2, JTs:0.7, T9s:0.5, 98s:0.3, 87s:0.1, AQo:0.5, KQo:0.2"
    },
    UTG_vs_BB: {
      raise: "KK+, QQ:0.5, AKs:0.8, AKo:0.7, A5s:0.5, A4s:0.4, AQo:0.2, KQs:0.1",
      call:  "QQ:0.5, JJ, TT, 99, 88:0.9, 77:0.7, 66:0.4, 55:0.2, AKs:0.2, AKo:0.3, AQs, AJs, ATs:0.9, A9s:0.3, A5s:0.5, A4s:0.5, A3s:0.2, KQs:0.9, KJs:0.9, KTs:0.6, QJs:0.8, QTs:0.4, JTs:0.8, T9s:0.6, 98s:0.4, 87s:0.3, 76s:0.2, AQo:0.6, AJo:0.1, KQo:0.4"
    },
    HJ_vs_CO: {
      raise: "KK+, QQ:0.5, JJ:0.1, AKs:0.7, AKo:0.6, A5s:0.6, A4s:0.5, A3s:0.1, AQo:0.2, KQs:0.1, AJs:0.1",
      call:  "QQ:0.5, JJ:0.9, TT, 99, 88, 77:0.7, 66:0.5, 55:0.3, 44:0.1, AKs:0.3, AKo:0.4, AQs, AJs:0.9, ATs, A9s:0.4, A8s:0.1, A5s:0.4, A4s:0.4, A3s:0.2, KQs:0.9, KJs:0.9, KTs:0.7, K9s:0.2, QJs:0.8, QTs:0.5, JTs:0.8, J9s:0.2, T9s:0.7, 98s:0.5, 87s:0.4, 76s:0.3, 65s:0.2, AQo:0.6, AJo:0.3, KQo:0.5, KJo:0.1"
    },
    HJ_vs_BTN: {
      raise: "KK+, QQ:0.5, JJ:0.1, AKs:0.7, AKo:0.6, A5s:0.6, A4s:0.5, A3s:0.1, AQo:0.2, KQs:0.1, AJs:0.1",
      call:  "QQ:0.5, JJ:0.9, TT, 99, 88, 77:0.8, 66:0.5, 55:0.3, 44:0.2, AKs:0.3, AKo:0.4, AQs, AJs:0.9, ATs, A9s:0.5, A8s:0.2, A5s:0.4, A4s:0.5, A3s:0.3, A2s:0.1, KQs:0.9, KJs:0.9, KTs:0.8, K9s:0.3, QJs:0.9, QTs:0.6, JTs:0.9, J9s:0.3, T9s:0.8, 98s:0.6, 87s:0.5, 76s:0.4, 65s:0.3, 54s:0.1, AQo:0.6, AJo:0.4, KQo:0.6, KJo:0.1"
    },
    HJ_vs_SB: {
      raise: "KK+, QQ:0.6, JJ:0.15, AKs:0.8, AKo:0.7, A5s:0.6, A4s:0.4, AQo:0.25, KQs:0.15, AJs:0.1",
      call:  "QQ:0.4, JJ:0.85, TT, 99, 88:0.9, 77:0.6, 66:0.3, 55:0.1, AKs:0.2, AKo:0.3, AQs, AJs:0.9, ATs:0.9, A9s:0.3, A5s:0.4, A4s:0.4, A3s:0.1, KQs:0.85, KJs:0.9, KTs:0.6, K9s:0.1, QJs:0.8, QTs:0.4, JTs:0.8, J9s:0.1, T9s:0.6, 98s:0.4, 87s:0.3, 76s:0.2, 65s:0.1, AQo:0.5, AJo:0.2, KQo:0.4"
    },
    HJ_vs_BB: {
      raise: "KK+, QQ:0.6, JJ:0.15, AKs:0.8, AKo:0.7, A5s:0.6, A4s:0.4, AQo:0.25, KQs:0.15, AJs:0.1",
      call:  "QQ:0.4, JJ:0.85, TT, 99, 88, 77:0.8, 66:0.5, 55:0.3, 44:0.1, AKs:0.2, AKo:0.3, AQs, AJs:0.9, ATs, A9s:0.4, A8s:0.1, A5s:0.4, A4s:0.5, A3s:0.2, KQs:0.85, KJs:0.9, KTs:0.8, K9s:0.2, QJs:0.9, QTs:0.5, JTs:0.9, J9s:0.2, T9s:0.7, 98s:0.5, 87s:0.4, 76s:0.3, 65s:0.2, AQo:0.6, AJo:0.3, KQo:0.5"
    },
    CO_vs_BTN: {
      raise: "KK+, QQ:0.6, JJ:0.2, TT:0.05, AKs:0.8, AKo:0.7, AQs:0.1, A5s:0.7, A4s:0.6, A3s:0.2, A2s:0.1, AQo:0.3, KQs:0.15, AJs:0.15, KJs:0.05, K9s:0.05, K8s:0.05, 76s:0.05, 65s:0.05",
      call:  "QQ:0.4, JJ:0.8, TT:0.95, 99, 88, 77, 66:0.7, 55:0.5, 44:0.3, 33:0.1, 22:0.1, AKs:0.2, AKo:0.3, AQs:0.9, AJs:0.85, ATs, A9s:0.7, A8s:0.4, A7s:0.2, A6s:0.1, A5s:0.3, A4s:0.4, A3s:0.3, A2s:0.2, KQs:0.85, KJs:0.95, KTs:0.9, K9s:0.5, K8s:0.15, QJs:0.9, QTs:0.8, Q9s:0.3, JTs:0.9, J9s:0.5, J8s:0.1, T9s:0.9, T8s:0.3, 98s:0.7, 97s:0.1, 87s:0.6, 76s:0.5, 65s:0.4, 54s:0.3, AQo:0.7, AJo:0.5, ATo:0.1, KQo:0.7, KJo:0.3, QJo:0.1"
    },
    CO_vs_SB: {
      raise: "KK+, QQ:0.7, JJ:0.2, AKs:0.85, AKo:0.75, AQs:0.1, A5s:0.7, A4s:0.6, A3s:0.2, AQo:0.35, KQs:0.2, AJs:0.15, KJs:0.05, AJo:0.05",
      call:  "QQ:0.3, JJ:0.8, TT, 99, 88:0.9, 77:0.7, 66:0.4, 55:0.2, AKs:0.15, AKo:0.25, AQs:0.9, AJs:0.85, ATs, A9s:0.5, A8s:0.2, A5s:0.3, A4s:0.4, A3s:0.2, KQs:0.8, KJs:0.9, KTs:0.8, K9s:0.3, QJs:0.9, QTs:0.7, Q9s:0.1, JTs:0.9, J9s:0.3, T9s:0.8, T8s:0.1, 98s:0.6, 87s:0.5, 76s:0.4, 65s:0.3, 54s:0.1, AQo:0.6, AJo:0.4, KQo:0.6, KJo:0.2"
    },
    CO_vs_BB: {
      raise: "KK+, QQ:0.7, JJ:0.2, AKs:0.85, AKo:0.75, AQs:0.1, A5s:0.7, A4s:0.6, A3s:0.2, AQo:0.35, KQs:0.2, AJs:0.15, KJs:0.05, AJo:0.05",
      call:  "QQ:0.3, JJ:0.8, TT, 99, 88, 77:0.8, 66:0.5, 55:0.3, 44:0.1, AKs:0.15, AKo:0.25, AQs:0.9, AJs:0.85, ATs, A9s:0.7, A8s:0.3, A7s:0.1, A5s:0.3, A4s:0.4, A3s:0.3, A2s:0.1, KQs:0.8, KJs:0.95, KTs:0.9, K9s:0.4, K8s:0.1, QJs:0.9, QTs:0.8, Q9s:0.2, JTs:0.9, J9s:0.4, T9s:0.9, T8s:0.2, 98s:0.7, 87s:0.6, 76s:0.5, 65s:0.4, 54s:0.2, AQo:0.6, AJo:0.5, ATo:0.1, KQo:0.7, KJo:0.3"
    },
    BTN_vs_SB: {
      raise: "QQ+, JJ:0.4, TT:0.15, AKs, AKo:0.85, AQs:0.3, AJs:0.2, A5s:0.7, A4s:0.6, A3s:0.3, A2s:0.15, AQo:0.4, AJo:0.1, KQs:0.3, KJs:0.1, K9s:0.05, K8s:0.05, K7s:0.05, K6s:0.05, K5s:0.1, 76s:0.05, 65s:0.05, 54s:0.05",
      call:  "JJ:0.6, TT:0.85, 99, 88, 77, 66:0.8, 55:0.6, 44:0.4, 33:0.2, 22:0.15, AKo:0.15, AQs:0.7, AJs:0.8, ATs, A9s:0.8, A8s:0.6, A7s:0.4, A6s:0.3, A5s:0.3, A4s:0.4, A3s:0.4, A2s:0.3, KQs:0.7, KJs:0.9, KTs:0.9, K9s:0.6, K8s:0.3, K7s:0.15, K6s:0.1, K5s:0.1, QJs:0.9, QTs:0.9, Q9s:0.5, Q8s:0.2, JTs:0.9, J9s:0.7, J8s:0.2, T9s:0.9, T8s:0.5, T7s:0.1, 98s:0.8, 97s:0.3, 87s:0.7, 86s:0.2, 76s:0.65, 75s:0.1, 65s:0.6, 64s:0.1, 54s:0.5, 43s:0.1, AQo:0.6, AJo:0.7, ATo:0.5, A9o:0.1, KQo:0.8, KJo:0.6, KTo:0.3, QJo:0.4, QTo:0.1, JTo:0.4"
    },
    BTN_vs_BB: {
      raise: "QQ+, JJ:0.4, TT:0.15, AKs, AKo:0.85, AQs:0.3, AJs:0.2, A5s:0.7, A4s:0.6, A3s:0.3, A2s:0.15, AQo:0.4, AJo:0.1, KQs:0.3, KJs:0.1, K9s:0.05, K8s:0.05, K7s:0.05, K6s:0.05, K5s:0.1, 76s:0.05, 65s:0.05, 54s:0.05",
      call:  "JJ:0.6, TT:0.85, 99, 88, 77, 66:0.9, 55:0.7, 44:0.5, 33:0.3, 22:0.2, AKo:0.15, AQs:0.7, AJs:0.8, ATs, A9s:0.9, A8s:0.7, A7s:0.5, A6s:0.4, A5s:0.3, A4s:0.4, A3s:0.5, A2s:0.4, KQs:0.7, KJs:0.9, KTs:0.9, K9s:0.7, K8s:0.4, K7s:0.2, K6s:0.15, K5s:0.15, K4s:0.05, QJs:0.9, QTs:0.9, Q9s:0.6, Q8s:0.3, JTs:0.9, J9s:0.8, J8s:0.3, T9s:0.9, T8s:0.6, T7s:0.15, 98s:0.85, 97s:0.4, 87s:0.8, 86s:0.3, 76s:0.7, 75s:0.15, 65s:0.65, 64s:0.15, 54s:0.55, 43s:0.15, AQo:0.6, AJo:0.75, ATo:0.6, A9o:0.2, KQo:0.85, KJo:0.7, KTo:0.4, QJo:0.5, QTo:0.2, JTo:0.5"
    },
    SB_vs_BB: {
      raise: "QQ+, JJ:0.5, TT:0.2, AKs, AKo:0.9, AQs:0.4, AJs:0.3, ATs:0.1, A5s:0.6, A4s:0.6, A3s:0.3, A2s:0.2, AQo:0.5, AJo:0.15, KQs:0.4, KJs:0.15, KTs:0.05, KQo:0.1, K5s:0.1, K4s:0.05, 65s:0.05, 54s:0.05",
      call:  "JJ:0.5, TT:0.8, 99, 88, 77, 66:0.8, 55:0.6, 44:0.4, 33:0.3, 22:0.2, AKo:0.1, AQs:0.6, AJs:0.7, ATs:0.9, A9s:0.8, A8s:0.7, A7s:0.5, A6s:0.4, A5s:0.4, A4s:0.4, A3s:0.4, A2s:0.3, KQs:0.6, KJs:0.85, KTs:0.9, K9s:0.6, K8s:0.3, K7s:0.2, K6s:0.15, K5s:0.15, K4s:0.1, QJs:0.9, QTs:0.9, Q9s:0.5, Q8s:0.2, JTs:0.9, J9s:0.7, J8s:0.2, T9s:0.9, T8s:0.5, T7s:0.1, 98s:0.8, 97s:0.3, 87s:0.7, 86s:0.2, 76s:0.6, 75s:0.1, 65s:0.55, 54s:0.5, 43s:0.1, AQo:0.5, AJo:0.7, ATo:0.5, A9o:0.1, KQo:0.8, KJo:0.6, KTo:0.3, QJo:0.4, QTo:0.1, JTo:0.4"
    }
  };

  /* ---------------- BB FACING A SB LIMP ----------------
     raise = isolate, everything else checks (the only true preflop "check" spot). */
  const VS_LIMP = {
    BB_vs_SB: {
      raise: "77+, 66:0.7, 55:0.5, 44:0.4, 33:0.3, 22:0.3, A2s+, K5s+, K4s:0.7, K3s:0.5, K2s:0.5, Q8s+, Q7s:0.6, Q6s:0.4, Q5s:0.3, J8s+, J7s:0.5, T8s+, T7s:0.4, 97s+, 96s:0.3, 86s+, 75s+, 65s, 64s:0.5, 54s:0.8, 53s:0.3, A5o+, A4o:0.7, A3o:0.5, A2o:0.4, K9o+, K8o:0.6, K7o:0.3, Q9o+, Q8o:0.4, J9o+, J8o:0.3, T9o, T8o:0.3, 98o:0.5, 87o:0.2"
    }
  };

  root.RANGES = { RFI6, RFI9, VS_OPEN, VS_3BET, VS_LIMP };
})(typeof window !== 'undefined' ? window : globalThis);
