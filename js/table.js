/* table.js — SVG poker table with seats, bets, dealer button and hero cards. */
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const SUIT_COLOR = { s: '#e8eaf0', h: '#ff5c5c', d: '#4f9cff', c: '#3ec96f' };

  function el(name, attrs, text) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text !== undefined) n.textContent = text;
    return n;
  }

  const STYLE = {
    hero:    { fill: '#3a2f5c', stroke: '#f5c542' },
    fold:    { fill: '#1c2029', stroke: '#2b313d' },
    raise:   { fill: '#4a2427', stroke: '#e0524f' },
    '3bet':  { fill: '#4a2427', stroke: '#e0524f' },
    limp:    { fill: '#1f3d3b', stroke: '#2fa39a' },
    blind:   { fill: '#2b3140', stroke: '#465066' },
    waiting: { fill: '#2b3140', stroke: '#465066' }
  };

  function card(x, y, w, h, c) {
    const g = el('g', { transform: 'translate(' + x + ',' + y + ')' });
    g.appendChild(el('rect', { width: w, height: h, rx: 4, fill: '#f7f7f5', stroke: '#c9c9c9' }));
    const col = SUIT_COLOR[c.s] === '#e8eaf0' ? '#1a1d24' : SUIT_COLOR[c.s];
    g.appendChild(el('text', { x: w / 2, y: h * 0.5, 'text-anchor': 'middle', 'font-size': h * 0.42, 'font-weight': '700', fill: col }, c.r));
    g.appendChild(el('text', { x: w / 2, y: h * 0.88, 'text-anchor': 'middle', 'font-size': h * 0.36, fill: col }, root.Hands.SUIT_SYMBOL[c.s]));
    return g;
  }
  function cardBack(x, y, w, h) {
    const g = el('g', { transform: 'translate(' + x + ',' + y + ')' });
    g.appendChild(el('rect', { width: w, height: h, rx: 3, fill: '#8b2c4a', stroke: '#e8d5da' }));
    g.appendChild(el('rect', { x: 3, y: 3, width: w - 6, height: h - 6, rx: 2, fill: 'none', stroke: '#d98aa3', 'stroke-width': 1 }));
    return g;
  }

  // Two layouts: the wide landscape table (default) and a portrait "compact" one for phones,
  // where the hero sits below the table with big cards and the other seats ring a vertical oval.
  const WIDE = {
    W: 760, H: 440, cx: 380, cy: 224,
    rim: [296, 150], felt: [276, 130], line: [236, 94],
    seat: [300, 155], chip: [205, 88],
    pw: 96, ph: 46, heroPw: 96, fLabel: 14, fStack: 12, fBet: 12, fPotL: 13, fPotV: 20, potY: 0,
    back: [20, 28], cardW: 38, cardH: 52
  };
  const COMPACT = {
    W: 400, H: 494, cx: 200, cy: 222,
    rim: [150, 190], felt: [136, 176], line: [100, 136],
    seat: [158, 196], chip: [96, 128],
    pw: 86, ph: 44, heroPw: 122, fLabel: 15, fStack: 13, fBet: 13, fPotL: 13, fPotV: 20, potY: -30,
    back: [22, 30], cardW: 60, cardH: 82
  };

  // angle of the k-th seat clockwise from the hero (k = 0)
  function seatAngle(k, N, compact) {
    if (!compact || N <= 2 || k === 0) return Math.PI / 2 + k * 2 * Math.PI / N;
    // leave a gap at the bottom for the hero, spread the others evenly around the rest
    const gap = (N >= 8 ? 46 : N >= 6 ? 54 : 70) * Math.PI / 180;
    return Math.PI / 2 + gap + (k - 1) * (2 * Math.PI - 2 * gap) / (N - 2);
  }

  function renderTable(svg, o) {
    const compact = !!o.compact;
    const L = compact ? COMPACT : WIDE;
    const W = L.W, H = L.H;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.classList.toggle('compact', compact);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const cx = L.cx, cy = L.cy;

    svg.appendChild(el('ellipse', { cx, cy, rx: L.rim[0], ry: L.rim[1], fill: '#3a2f2a', stroke: '#5a4a40', 'stroke-width': 3 }));
    svg.appendChild(el('ellipse', { cx, cy, rx: L.felt[0], ry: L.felt[1], fill: '#1e5c3f', stroke: '#17452f', 'stroke-width': 2 }));
    svg.appendChild(el('ellipse', { cx, cy, rx: L.line[0], ry: L.line[1], fill: 'none', stroke: '#2a7250', 'stroke-width': 1.5 }));
    svg.appendChild(el('text', { x: cx, y: cy + L.potY - 4, 'text-anchor': 'middle', 'font-size': L.fPotL, fill: '#9fd3b6', 'letter-spacing': 1 }, 'POT'));
    svg.appendChild(el('text', { x: cx, y: cy + L.potY + 18, 'text-anchor': 'middle', 'font-size': L.fPotV, 'font-weight': '700', fill: '#e8f5ec' }, (+o.pot.toFixed(1)) + ' bb'));

    const N = o.positions.length;
    const heroIdx = o.positions.indexOf(o.hero);
    o.positions.forEach((pos, idx) => {
      const k = (idx - heroIdx + N) % N;
      const ang = seatAngle(k, N, compact);
      const cos = Math.cos(ang), sin = Math.sin(ang);
      const seat = o.seats[pos];
      const isHero = seat.status === 'hero';
      let sx = cx + L.seat[0] * cos, sy = cy + L.seat[1] * sin;
      if (compact && k === 0) sy = H - L.ph / 2 - 3; // hero pill below the table, cards above it
      const st = STYLE[seat.status] || STYLE.waiting;
      const g = el('g', { class: 'seat seat-' + seat.status });
      const pw = isHero ? L.heroPw : L.pw, ph = L.ph;

      // cards
      if (isHero && o.heroCards) {
        const cw = L.cardW, ch = L.cardH, gapX = compact ? 3 : 2;
        const top = compact ? sy - ph / 2 - ch - 4 : sy - 76;
        g.appendChild(card(sx - cw - gapX, top, cw, ch, o.heroCards[0]));
        g.appendChild(card(sx + gapX, top, cw, ch, o.heroCards[1]));
      } else if (seat.status !== 'fold') {
        // card backs peek out from behind the seat pill (upwards, or downwards for seats along the top)
        const bw = L.back[0], bh = L.back[1];
        const cyOff = sin < -0.3 ? ph / 2 - 12 : -ph / 2 - 16;
        g.appendChild(cardBack(sx - bw - 2, sy + cyOff, bw, bh));
        g.appendChild(cardBack(sx + 2, sy + cyOff, bw, bh));
      }

      g.appendChild(el('rect', { x: sx - pw / 2, y: sy - ph / 2, width: pw, height: ph, rx: 10, fill: st.fill, stroke: st.stroke, 'stroke-width': isHero ? 2.5 : 1.5, opacity: seat.status === 'fold' ? 0.55 : 1 }));
      const posLabel = (o.labels && o.labels[pos]) || pos;
      g.appendChild(el('text', { x: sx, y: sy - 4, 'text-anchor': 'middle', 'font-size': L.fLabel, 'font-weight': '700', fill: seat.status === 'fold' ? '#6b7280' : (isHero ? '#f5c542' : '#e8eaf0') }, posLabel + (isHero ? ' (you)' : '')));
      const stack = 100 - seat.bet;
      g.appendChild(el('text', { x: sx, y: sy + 14, 'text-anchor': 'middle', 'font-size': L.fStack, fill: seat.status === 'fold' ? '#5b6270' : '#b8c0cf' }, seat.status === 'fold' ? 'Fold' : (+stack.toFixed(1)) + ' bb'));

      // bet / action chip
      if (seat.bet > 0) {
        let bx = cx + L.chip[0] * cos, by = cy + L.chip[1] * sin;
        if (isHero) {
          if (compact) { bx = sx + pw / 2 + 16; by = sy; } // beside the hero pill
          else { bx = sx + 62; by = sy - 50; }
        } else if (compact && Math.abs(cos) <= 0.45) bx = sx; // seats along the top: chip straight below the seat so centred labels stay apart
        const chipCol = (seat.status === 'raise' || seat.status === '3bet') ? '#e0524f' : (seat.status === 'limp' ? '#2fa39a' : (isHero ? '#f5c542' : '#7c8aa5'));
        g.appendChild(el('circle', { cx: bx, cy: by, r: 8, fill: chipCol, stroke: '#111', 'stroke-width': 1.5 }));
        g.appendChild(el('circle', { cx: bx, cy: by, r: 4, fill: 'none', stroke: '#fff', 'stroke-width': 1, opacity: 0.7 }));
        let label = seat.label || '';
        if (isHero && seat.status === 'hero' && seat.bet > 1 && !seat.label.startsWith('Raise') && !seat.label.startsWith('Limp')) label = 'Raise ' + seat.bet;
        if (!label) label = String(seat.bet);
        let tx = bx, ty = by + 4, anchor = 'middle';
        if (isHero) { tx = bx + 13; anchor = 'start'; }
        else if (cos > (compact ? 0.45 : 0.25)) { tx = bx - 13; anchor = 'end'; }
        else if (cos < (compact ? -0.45 : -0.25)) { tx = bx + 13; anchor = 'start'; }
        else { ty = sin > 0 ? by - 13 : by + 22; }
        g.appendChild(el('text', { x: tx, y: ty, 'text-anchor': anchor, 'font-size': L.fBet, 'font-weight': '600', fill: '#f3f4f6' }, label));
      }

      // dealer button
      if (pos === (o.dealer || 'BTN')) {
        let dx = sx + (cos < -0.3 ? 1 : -1) * (pw / 2 + 16), dy = sy;
        if (compact && k > 0) {
          // keep it on the table side of the pill so it never lands on a neighbouring seat
          if (Math.abs(sin) > 0.75) { dx = sx + (cos < 0 ? -1 : 1) * 40; dy = sy + (sin < 0 ? 1 : -1) * (ph / 2 + 14); }
          else { dx = sx + (cos < 0 ? 1 : -1) * (pw / 2 - 4); dy = sy + (sin < -0.3 ? -1 : 1) * (ph / 2 + 12); } // at the pill's inner corner, on the side away from its cards
        }
        g.appendChild(el('circle', { cx: dx, cy: dy, r: 10, fill: '#f8f8f8', stroke: '#333', 'stroke-width': 1.5 }));
        g.appendChild(el('text', { x: dx, y: dy + 4, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': '800', fill: '#222' }, 'D'));
      }
      svg.appendChild(g);
    });
  }

  root.Table = { renderTable };
})(typeof window !== 'undefined' ? window : globalThis);
