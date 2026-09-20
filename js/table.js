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

  function renderTable(svg, o) {
    const W = 760, H = 440;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const cx = W / 2, cy = H / 2 + 4;

    svg.appendChild(el('ellipse', { cx, cy, rx: 296, ry: 150, fill: '#3a2f2a', stroke: '#5a4a40', 'stroke-width': 3 }));
    svg.appendChild(el('ellipse', { cx, cy, rx: 276, ry: 130, fill: '#1e5c3f', stroke: '#17452f', 'stroke-width': 2 }));
    svg.appendChild(el('ellipse', { cx, cy, rx: 236, ry: 94, fill: 'none', stroke: '#2a7250', 'stroke-width': 1.5 }));
    svg.appendChild(el('text', { x: cx, y: cy - 4, 'text-anchor': 'middle', 'font-size': 13, fill: '#9fd3b6', 'letter-spacing': 1 }, 'POT'));
    svg.appendChild(el('text', { x: cx, y: cy + 18, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': '700', fill: '#e8f5ec' }, (+o.pot.toFixed(1)) + ' bb'));

    const N = o.positions.length;
    const heroIdx = o.positions.indexOf(o.hero);
    o.positions.forEach((pos, idx) => {
      const k = (idx - heroIdx + N) % N;
      const ang = Math.PI / 2 + k * 2 * Math.PI / N;
      const cos = Math.cos(ang), sin = Math.sin(ang);
      const sx = cx + 300 * cos, sy = cy + 155 * sin;
      const seat = o.seats[pos];
      const st = STYLE[seat.status] || STYLE.waiting;
      const g = el('g', { class: 'seat seat-' + seat.status });
      const isHero = seat.status === 'hero';
      const pw = 96, ph = 46;

      // cards
      if (isHero && o.heroCards) {
        g.appendChild(card(sx - 40, sy - 76, 38, 52, o.heroCards[0]));
        g.appendChild(card(sx + 2, sy - 76, 38, 52, o.heroCards[1]));
      } else if (seat.status !== 'fold') {
        // card backs peek out from behind the seat pill (upwards, or downwards for seats along the top)
        const cyOff = sin < -0.3 ? ph / 2 - 12 : -ph / 2 - 16;
        g.appendChild(cardBack(sx - 22, sy + cyOff, 20, 28));
        g.appendChild(cardBack(sx + 2, sy + cyOff, 20, 28));
      }

      g.appendChild(el('rect', { x: sx - pw / 2, y: sy - ph / 2, width: pw, height: ph, rx: 10, fill: st.fill, stroke: st.stroke, 'stroke-width': isHero ? 2.5 : 1.5, opacity: seat.status === 'fold' ? 0.55 : 1 }));
      g.appendChild(el('text', { x: sx, y: sy - 4, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': '700', fill: seat.status === 'fold' ? '#6b7280' : (isHero ? '#f5c542' : '#e8eaf0') }, pos + (isHero ? ' (you)' : '')));
      const stack = 100 - seat.bet;
      g.appendChild(el('text', { x: sx, y: sy + 14, 'text-anchor': 'middle', 'font-size': 12, fill: seat.status === 'fold' ? '#5b6270' : '#b8c0cf' }, seat.status === 'fold' ? 'Fold' : (+stack.toFixed(1)) + ' bb'));

      // bet / action chip
      if (seat.bet > 0) {
        let bx = cx + 205 * cos, by = cy + 88 * sin;
        if (isHero) { bx = sx + 62; by = sy - 50; }
        const chipCol = (seat.status === 'raise' || seat.status === '3bet') ? '#e0524f' : (seat.status === 'limp' ? '#2fa39a' : (isHero ? '#f5c542' : '#7c8aa5'));
        g.appendChild(el('circle', { cx: bx, cy: by, r: 8, fill: chipCol, stroke: '#111', 'stroke-width': 1.5 }));
        g.appendChild(el('circle', { cx: bx, cy: by, r: 4, fill: 'none', stroke: '#fff', 'stroke-width': 1, opacity: 0.7 }));
        let label = seat.label || '';
        if (isHero && seat.status === 'hero' && seat.bet > 1) label = 'Raise ' + seat.bet;
        if (!label) label = String(seat.bet);
        let tx = bx, ty = by + 4, anchor = 'middle';
        if (isHero) { tx = bx + 13; anchor = 'start'; }
        else if (cos > 0.25) { tx = bx - 13; anchor = 'end'; }
        else if (cos < -0.25) { tx = bx + 13; anchor = 'start'; }
        else { ty = sin > 0 ? by - 13 : by + 22; }
        g.appendChild(el('text', { x: tx, y: ty, 'text-anchor': anchor, 'font-size': 12, 'font-weight': '600', fill: '#f3f4f6' }, label));
      }

      // dealer button
      if (pos === 'BTN') {
        const dx = cx + 245 * Math.cos(ang - 0.28), dy = cy + 112 * Math.sin(ang - 0.28);
        g.appendChild(el('circle', { cx: dx, cy: dy, r: 10, fill: '#f8f8f8', stroke: '#333', 'stroke-width': 1.5 }));
        g.appendChild(el('text', { x: dx, y: dy + 4, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': '800', fill: '#222' }, 'D'));
      }
      svg.appendChild(g);
    });
  }

  root.Table = { renderTable };
})(typeof window !== 'undefined' ? window : globalThis);
