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

  /* Mouse hover previews a hand; a click or tap selects it (outlined) and the info returns to it when the
     mouse leaves the grid. Touch has no hover, so the tap alone drives the info. */
  function bindCell(container, cell, show) {
    cell.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') show(false); });
    cell.addEventListener('click', () => {
      container.querySelectorAll('.cell.selected').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
      container._showSelected = show;
      show(true);
    });
    container.onmouseleave = () => { if (container._showSelected) container._showSelected(false); };
  }

  function renderGrid(container, strategy, actions, opts) {
    opts = opts || {};
    container.innerHTML = '';
    container._showSelected = null;
    container.classList.remove('combined', 'focused');
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
        if (opts.onHover) bindCell(container, cell, clicked => opts.onHover(hand, strategy[hand], clicked));
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

  /* Combined chart: layers are spots in seat order (earliest first), each { name, color, strategy }.
     A hand takes the colour of the earliest layer that raises it at least half the time; hands never raised
     that often are faded in the earliest layer that raises them at all. Hover shows every layer's frequency. */
  const MAJORITY = 0.5;
  function combinedLayer(hand, layers) {
    let faint = null;
    for (let k = 0; k < layers.length; k++) {
      const f = layers[k].strategy[hand].raise || 0;
      if (f >= MAJORITY) return { k, faint: false };
      if (f > 0 && faint === null) faint = k;
    }
    return faint === null ? null : { k: faint, faint: true };
  }

  function renderCombined(container, layers, opts) {
    opts = opts || {};
    container.innerHTML = '';
    container._showSelected = null;
    container.classList.remove('focused');
    container.classList.add('range-grid', 'combined');
    for (let i = 0; i < 13; i++) {
      for (let j = 0; j < 13; j++) {
        const hand = H.GRID[i][j];
        const cell = document.createElement('div');
        cell.className = 'cell ' + H.handType(hand);
        cell.dataset.hand = hand;
        const out = opts.prior && opts.prior[hand] === 0;
        const hit = out ? null : combinedLayer(hand, layers);
        if (out) cell.classList.add('out');
        else if (hit) {
          cell.style.background = layers[hit.k].color;
          cell.dataset.k = hit.k;
          if (hit.faint) cell.classList.add('faint');
        } else cell.style.background = '#2b3140';
        const dim = (hit && hit.faint ? 0.4 : 1) * (opts.prior && !out && opts.prior[hand] < 1 ? 0.55 + 0.45 * opts.prior[hand] : 1);
        if (dim < 1) cell.style.opacity = String(dim);
        const span = document.createElement('span');
        span.textContent = hand;
        cell.appendChild(span);
        cell.title = out ? hand + ': not in opening range'
          : hand + ': ' + layers.map(l => l.name + ' ' + Math.round((l.strategy[hand].raise || 0) * 100) + '%').join(', ');
        if (opts.onHover) bindCell(container, cell, clicked => opts.onHover(hand, clicked));
        container.appendChild(cell);
      }
    }
  }

  /* Pick out the hands coloured by layer k (null clears). */
  function focusCombined(container, k) {
    container.classList.toggle('focused', k != null);
    container.querySelectorAll('.cell').forEach(c => c.classList.toggle('on', k != null && c.dataset.k === String(k)));
  }

  function renderCombinedLegend(container, layers, opts) {
    opts = opts || {};
    container.innerHTML = '';
    container.classList.add('legend');
    layers.forEach((l, k) => {
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.dataset.k = k;
      item.innerHTML = '<span class="swatch" style="background:' + l.color + '"></span>' + l.name;
      if (opts.onFocus) {
        item.addEventListener('mouseenter', () => opts.onFocus(k));
        item.addEventListener('mouseleave', () => opts.onFocus(null));
      }
      container.appendChild(item);
    });
    const faint = document.createElement('div');
    faint.className = 'legend-item';
    faint.innerHTML = '<span class="swatch faint" style="background:' + layers[0].color + '"></span>Faded: never raised more than half the time';
    container.appendChild(faint);
  }

  root.Grid = { renderGrid, renderLegend, renderSummary, summarize, describe, renderCombined, renderCombinedLegend, focusCombined };
})(typeof window !== 'undefined' ? window : globalThis);
