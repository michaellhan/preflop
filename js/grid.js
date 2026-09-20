/* grid.js — 13x13 range matrix renderer, legend and summary. */
(function (root) {
  'use strict';
  const H = root.Hands;

  function gradientFor(freqs, actions) {
    const stops = [];
    let acc = 0;
    for (const a of actions) {
      const f = freqs[a.key] || 0;
      if (f <= 0) continue;
      const start = acc * 100, end = (acc + f) * 100;
      stops.push(a.color + ' ' + start.toFixed(1) + '% ' + end.toFixed(1) + '%');
      acc += f;
    }
    if (!stops.length) return '#2b3140';
    return 'linear-gradient(to right, ' + stops.join(', ') + ')';
  }

  function describe(hand, freqs, actions, prior) {
    const parts = [];
    for (const a of actions) {
      const f = freqs[a.key] || 0;
      if (f > 0) parts.push(a.label.replace(/ [\d.]+bb$/, '') + ' ' + Math.round(f * 100) + '%');
    }
    let s = hand + ': ' + parts.join(' / ');
    if (prior && prior[hand] === 0) s = hand + ': not in opening range';
    return s;
  }

  function renderGrid(container, strategy, actions, opts) {
    opts = opts || {};
    container.innerHTML = '';
    container.classList.add('range-grid');
    for (let i = 0; i < 13; i++) {
      for (let j = 0; j < 13; j++) {
        const hand = H.GRID[i][j];
        const cell = document.createElement('div');
        cell.className = 'cell ' + H.handType(hand);
        cell.dataset.hand = hand;
        const out = opts.prior && opts.prior[hand] === 0;
        if (out) cell.classList.add('out');
        else cell.style.background = gradientFor(strategy[hand], actions);
        if (opts.prior && !out && opts.prior[hand] < 1) cell.style.opacity = String(0.55 + 0.45 * opts.prior[hand]);
        if (opts.highlight === hand) cell.classList.add('highlight');
        const span = document.createElement('span');
        span.textContent = hand;
        cell.appendChild(span);
        cell.title = describe(hand, strategy[hand], actions, opts.prior);
        if (opts.onHover) {
          cell.addEventListener('mouseenter', () => opts.onHover(hand, strategy[hand]));
          cell.addEventListener('click', () => opts.onHover(hand, strategy[hand], true));
        }
        container.appendChild(cell);
      }
    }
  }

  function renderLegend(container, actions) {
    container.innerHTML = '';
    container.classList.add('legend');
    for (const a of actions) {
      const item = document.createElement('div');
      item.className = 'legend-item';
      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = a.color;
      item.appendChild(sw);
      item.appendChild(document.createTextNode(a.label));
      container.appendChild(item);
    }
  }

  /* Weighted summary: share of combos (optionally weighted by a prior) per action. */
  function summarize(strategy, actions, prior) {
    const totals = {};
    let denom = 0;
    for (const a of actions) totals[a.key] = 0;
    for (const h of H.ALL_HANDS) {
      const w = H.combos(h) * (prior ? prior[h] : 1);
      denom += w;
      for (const a of actions) totals[a.key] += w * (strategy[h][a.key] || 0);
    }
    const out = [];
    for (const a of actions) out.push({ key: a.key, label: a.label, color: a.color, combos: totals[a.key], pct: denom ? 100 * totals[a.key] / denom : 0 });
    return { rows: out, denom };
  }

  function renderSummary(container, strategy, actions, prior) {
    const s = summarize(strategy, actions, prior);
    container.innerHTML = '';
    container.classList.add('summary');
    const bar = document.createElement('div');
    bar.className = 'summary-bar';
    for (const r of s.rows) {
      const seg = document.createElement('div');
      seg.style.width = r.pct.toFixed(1) + '%';
      seg.style.background = r.color;
      seg.title = r.label + ' ' + r.pct.toFixed(1) + '%';
      bar.appendChild(seg);
    }
    container.appendChild(bar);
    const list = document.createElement('div');
    list.className = 'summary-rows';
    for (const r of s.rows) {
      const row = document.createElement('div');
      row.className = 'summary-row';
      row.innerHTML = '<span class="swatch" style="background:' + r.color + '"></span><span class="lbl">' + r.label + '</span><span class="pct">' + r.pct.toFixed(1) + '%</span><span class="cmb">' + r.combos.toFixed(0) + ' combos</span>';
      list.appendChild(row);
    }
    if (prior) {
      const note = document.createElement('div');
      note.className = 'summary-note';
      note.textContent = 'Percentages are of the hands you opened (' + (100 * s.denom / H.TOTAL_COMBOS).toFixed(1) + '% of all hands). Greyed cells were never opened.';
      list.appendChild(note);
    }
    container.appendChild(list);
  }

  root.Grid = { renderGrid, renderLegend, renderSummary, summarize, describe };
})(typeof window !== 'undefined' ? window : globalThis);
