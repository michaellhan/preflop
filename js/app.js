/* app.js — trainer, range charts, stats. */
(function () {
  'use strict';
  const H = window.Hands, S = window.Spots, G = window.Grid, T = window.Table;
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const SETTINGS_KEY = 'preflop-lab-settings-v1';
  const STATS_KEY = 'preflop-lab-stats-v1';

  /* ---------------- state ---------------- */
  const defaults = () => ({
    table: '6max',
    types: { rfi: true, vsOpen: true, vs3bet: true, vsLimp: false },
    positions: { '6max': null, '9max': null }, // null = all
    dealing: 'weighted',
    showRange: true,
    autoNext: false
  });
  let settings = loadJSON(SETTINGS_KEY, defaults());
  if (!settings.types || !settings.positions) settings = defaults();
  let stats = loadJSON(STATS_KEY, freshStats());
  let current = null; // { spot, hand, cards, answered, chosen }
  let charts = { table: '6max', type: 'rfi', hero: 'BTN', villain: null };

  function freshStats() { return { total: 0, points: 0, correct: 0, mixed: 0, wrong: 0, blunders: 0, evLoss: 0, streak: 0, bestStreak: 0, byPos: {}, byType: {}, mistakes: [] }; }
  function loadJSON(k, d) { try { const v = localStorage.getItem(k); return v ? Object.assign({}, d, JSON.parse(v)) : d; } catch (e) { return d; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }

  /* ---------------- navigation ---------------- */
  function showView(name) {
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
    window.scrollTo(0, 0);
    if (name === 'ranges') renderCharts();
    if (name === 'about') renderAbout();
  }
  $$('.tab').forEach(t => t.addEventListener('click', () => showView(t.dataset.view)));
  $('#brand-link').addEventListener('click', e => { e.preventDefault(); showView('trainer'); });

  /* ---------------- settings panel ---------------- */
  function selectedPositions() {
    const all = S.TABLES[settings.table].positions;
    const sel = settings.positions[settings.table];
    return sel && sel.length ? all.filter(p => sel.includes(p)) : all.slice();
  }

  function renderSettings() {
    $$('#table-select button').forEach(b => b.classList.toggle('active', b.dataset.table === settings.table));
    $$('#type-select input').forEach(i => { i.checked = !!settings.types[i.value]; });
    const wrap = $('#pos-select');
    wrap.innerHTML = '';
    const all = S.TABLES[settings.table].positions;
    const sel = selectedPositions();
    const allBtn = document.createElement('button');
    allBtn.className = 'chip' + (sel.length === all.length ? ' active' : '');
    allBtn.textContent = 'All';
    allBtn.addEventListener('click', () => { settings.positions[settings.table] = null; persistSettings(); });
    wrap.appendChild(allBtn);
    for (const p of all) {
      const b = document.createElement('button');
      b.className = 'chip' + (sel.includes(p) && sel.length !== all.length ? ' active' : '');
      b.textContent = p;
      b.title = S.POSITION_NAMES[p];
      b.addEventListener('click', () => {
        let cur = settings.positions[settings.table];
        if (!cur || cur.length === all.length) cur = [p];
        else if (cur.includes(p)) { cur = cur.filter(x => x !== p); if (!cur.length) cur = null; }
        else cur = cur.concat([p]);
        settings.positions[settings.table] = cur;
        persistSettings();
      });
      wrap.appendChild(b);
    }
    $$('#dealing-select input').forEach(i => { i.checked = i.value === settings.dealing; });
    $('#show-range').checked = !!settings.showRange;
    $('#auto-next').checked = !!settings.autoNext;
    $('#spot-count').textContent = candidateSpots().length + ' spots in rotation';
  }
  function persistSettings() { saveJSON(SETTINGS_KEY, settings); renderSettings(); newHand(); }

  $$('#table-select button').forEach(b => b.addEventListener('click', () => { settings.table = b.dataset.table; persistSettings(); }));
  $$('#type-select input').forEach(i => i.addEventListener('change', () => { settings.types[i.value] = i.checked; persistSettings(); }));
  $$('#dealing-select input').forEach(i => i.addEventListener('change', () => { if (i.checked) { settings.dealing = i.value; persistSettings(); } }));
  $('#auto-next').addEventListener('change', e => { settings.autoNext = e.target.checked; saveJSON(SETTINGS_KEY, settings); });
  $('#show-range').addEventListener('change', e => { settings.showRange = e.target.checked; saveJSON(SETTINGS_KEY, settings); if (current && current.answered) renderReveal(); });

  /* ---------------- dealing ---------------- */
  function candidateSpots() {
    const pos = selectedPositions();
    return S.getSpots(settings.table).filter(s => settings.types[s.type] && pos.includes(s.hero));
  }
  function pickWeighted(items, weightFn) {
    let total = 0;
    const w = items.map(it => { const x = Math.max(0, weightFn(it)); total += x; return x; });
    if (total <= 0) return items[Math.floor(Math.random() * items.length)];
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  }
  function residualKey(spot) { return spot.actions[spot.actions.length - 1].key; }

  function newHand() {
    const spots = candidateSpots();
    const msg = $('#situation');
    if (!spots.length) {
      current = null;
      msg.innerHTML = '<strong>No spots match your filters.</strong> Enable at least one scenario and one position.';
      $('#action-buttons').innerHTML = '';
      $('#next-btn').disabled = true;
      $('#feedback').classList.add('hidden');
      $('#reveal').classList.add('hidden');
      return;
    }
    const spot = spots[Math.floor(Math.random() * spots.length)];
    const res = residualKey(spot);
    const hand = pickWeighted(H.ALL_HANDS, h => {
      let w = H.combos(h) * (spot.prior ? spot.prior[h] : 1);
      if (settings.dealing === 'weighted') {
        const playable = spot.strategy[h][res] < 1;
        w *= playable ? 1 : 0.3;
      }
      return w;
    });
    current = { spot, hand, cards: H.dealCards(hand), answered: false, chosen: null };
    renderHand();
  }

  function spotOfMistake(m) {
    const spots = S.getSpots(m.table || settings.table);
    return spots.find(s => s.id === m.spotId) || spots.find(s => s.title === m.title) || null;
  }
  function reviewMistake(m) {
    const spot = spotOfMistake(m);
    if (!spot) return;
    current = { spot, hand: m.hand, cards: m.cards || H.dealCards(m.hand), answered: false, chosen: null, review: true };
    renderHand();
    // replay the original decision so the result is shown immediately
    let key = m.chosenKey;
    if (!key && m.chosen) { const a = spot.actions.find(x => labelOf(spot, x.key) === m.chosen); if (a) key = a.key; }
    if (key) answer(key);
    window.scrollTo(0, 0);
  }
  function renderHand() {
    const { spot, hand, cards } = current;
    const T6 = S.TABLES[spot.table];
    T.renderTable($('#table-svg'), { positions: T6.positions, hero: spot.hero, seats: spot.seats, pot: spot.pot, heroCards: cards });
    $('#situation').innerHTML =
      '<span class="pill">' + T6.name + '</span><span class="pill">100bb</span><span class="pill type">' + S.TYPE_META[spot.type].name + '</span>' + (current.review ? '<span class="pill review">Review · not scored</span>' : '') +
      '<div class="sit-text">' + spot.description + ' <strong>' + spot.question + '</strong></div>';
    const cardsHtml = cards.map(c => '<span class="mini-card suit-' + c.s + '">' + c.r + H.SUIT_SYMBOL[c.s] + '</span>').join('');
    $('#hero-hand').innerHTML = cardsHtml + '<span class="hand-name">' + hand + ' &middot; ' + H.handLabel(hand) + '</span>';
    const act = $('#action-buttons');
    act.innerHTML = '';
    spot.actions.forEach((a, i) => {
      const b = document.createElement('button');
      b.className = 'action-btn';
      b.dataset.key = a.key;
      b.style.setProperty('--c', a.color);
      b.innerHTML = '<span class="fill"></span><span class="key" title="Keyboard shortcut">' + (i + 1) + '</span><span class="lbl">' + a.label + '</span><span class="pct"></span>';
      b.addEventListener('click', () => answer(a.key));
      act.appendChild(b);
    });
    const nb = $('#next-btn');
    nb.disabled = true;
    nb.blur();
    $('#feedback').classList.add('hidden');
    $('#reveal').classList.add('hidden');
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  }
  let autoTimer = null;

  /* ---------------- answering ---------------- */
  function verdictFor(freqs, chosen) {
    const f = freqs[chosen] || 0;
    let best = null, bf = -1;
    for (const k in freqs) if (freqs[k] > bf) { bf = freqs[k]; best = k; }
    if (chosen === best || f >= 0.5) return { level: 'correct', f, best, bf };
    if (f > 0) return { level: 'mixed', f, best, bf };
    return { level: 'wrong', f, best, bf };
  }

  function answer(key) {
    if (!current || current.answered) return;
    const { spot, hand } = current;
    const freqs = spot.strategy[hand];
    const v = verdictFor(freqs, key);
    current.answered = true; current.chosen = key; current.verdict = v;
    let loss = 0, analysis = null;
    try { analysis = window.EV.analyze(spot, current.cards, hand); loss = analysis.loss(key); } catch (err) { console.error('EV model failed', err); }
    current.analysis = analysis; current.loss = loss;
    current.blunder = v.level === 'wrong' && loss >= 1;

    if (current.review) { renderFeedback(); renderReveal(); finishButtons(key, freqs, v); return; }
    // stats
    const pts = v.level === 'correct' ? 1 : v.f;
    stats.total++; stats.points += pts;
    stats[v.level]++;
    stats.evLoss = (stats.evLoss || 0) + loss;
    if (current.blunder) stats.blunders = (stats.blunders || 0) + 1;
    if (v.level === 'wrong') stats.streak = 0; else { stats.streak++; stats.bestStreak = Math.max(stats.bestStreak, stats.streak); }
    const bp = stats.byPos[spot.table + ':' + spot.hero] || (stats.byPos[spot.table + ':' + spot.hero] = { total: 0, points: 0 });
    bp.total++; bp.points += pts;
    const bt = stats.byType[spot.type] || (stats.byType[spot.type] = { total: 0, points: 0 });
    bt.total++; bt.points += pts;
    if (v.level !== 'correct') {
      stats.mistakes.unshift({ title: spot.title, table: spot.table, spotId: spot.id, hand, cards: current.cards, chosenKey: key, chosen: labelOf(spot, key), gto: gtoLine(spot, freqs), level: v.level, loss });
      stats.mistakes = stats.mistakes.slice(0, 15);
    }
    saveJSON(STATS_KEY, stats);

    renderFeedback();
    renderReveal();
    renderStats();
    finishButtons(key, freqs, v);
  }
  function finishButtons(key, freqs, v) {
    $$('#action-buttons .action-btn').forEach(b => {
      const f = freqs[b.dataset.key] || 0;
      b.disabled = true;
      b.classList.add('answered');
      if (b.dataset.key === key) b.classList.add('chosen', v.level);
      if (f > 0) b.classList.add('gto');
      b.querySelector('.fill').style.width = (f * 100).toFixed(0) + '%';
      b.querySelector('.pct').textContent = Math.round(f * 100) + '%';
    });
    const nb = $('#next-btn');
    nb.disabled = false;
    if (settings.autoNext && v.level === 'correct') autoTimer = setTimeout(newHand, 1500);
  }
  function labelOf(spot, key) { const a = spot.actions.find(x => x.key === key); return a ? a.label.replace(/ [\d.]+bb$/, '') : key; }
  function gtoLine(spot, freqs) {
    return spot.actions.filter(a => freqs[a.key] > 0).map(a => labelOf(spot, a.key) + ' ' + Math.round(freqs[a.key] * 100) + '%').join(', ');
  }

  function renderFeedback() {
    const { spot, hand, chosen, verdict: v } = current;
    const freqs = spot.strategy[hand];
    const fb = $('#feedback');
    fb.classList.remove('hidden', 'correct', 'mixed', 'wrong');
    fb.classList.add(v.level);
    const headline = v.level === 'correct' ? 'Correct' : v.level === 'mixed' ? 'Acceptable (mixed strategy)' : (current.blunder ? 'Blunder' : 'Mistake');
    let expl;
    const chosenLabel = labelOf(spot, chosen), bestLabel = labelOf(spot, v.best);
    if (v.level === 'correct' && v.f >= 0.999) expl = 'GTO always plays <b>' + bestLabel + '</b> here.';
    else if (v.level === 'correct') expl = '<b>' + chosenLabel + '</b> is the main line (' + Math.round(v.f * 100) + '%).';
    else if (v.level === 'mixed') expl = '<b>' + chosenLabel + '</b> is played only ' + Math.round(v.f * 100) + '%; the main line is <b>' + bestLabel + '</b> (' + Math.round(v.bf * 100) + '%).';
    else expl = 'GTO never plays <b>' + chosenLabel + '</b> here; it plays <b>' + bestLabel + '</b>' + (v.bf < 0.999 ? ' (' + Math.round(v.bf * 100) + '%)' : '') + '.';
    let bars = '<div class="freq-bars">';
    for (const a of spot.actions) {
      const f = freqs[a.key] || 0;
      bars += '<div class="freq-row"><span class="freq-label">' + labelOf(spot, a.key) + '</span><div class="freq-track"><div class="freq-fill" style="width:' + (f * 100).toFixed(0) + '%;background:' + a.color + '"></div></div><span class="freq-pct">' + Math.round(f * 100) + '%</span></div>';
    }
    bars += '</div>';
    // EV loss badge (in the header)
    let evBadge = '';
    if (current.analysis) {
      const loss = current.loss;
      const cls = loss >= 1 ? 'bad' : loss > 0.05 ? 'meh' : 'good';
      const txt = loss < 0.005 ? '0.00' : '−' + loss.toFixed(2);
      const title = v.level !== 'wrong' ? 'GTO plays this action, so it costs nothing' : loss < 0.05 ? 'Close spot: options within model noise' : 'Estimated EV lost vs the GTO mix';
      const modelEvs = spot.actions.map(a => labelOf(spot, a.key) + ' ' + (current.analysis.evs[a.key] >= 0 ? '+' : '') + current.analysis.evs[a.key].toFixed(2)).join(' · ');
      evBadge = '<span class="ev-badge ' + cls + '" title="' + title + ' (model EVs: ' + modelEvs + ' bb)">' + txt + ' bb EV</span>';
    }
    // why note
    let whyHtml = '';
    try {
      const ex = window.Explain.explain(spot, hand, freqs);
      whyHtml = '<div class="why-box"><span class="why-cat">' + ex.catName + '</span> ' + ex.why + (ex.mix ? ' <span class="why-mix">' + ex.mix + '</span>' : '') + (ex.compare ? '<p class="why-compare">' + ex.compare + '</p>' : '') + '</div>';
    } catch (err) { console.error('explain failed', err); }
    fb.innerHTML = '<div class="fb-head"><span class="verdict">' + headline + '</span>' + evBadge + '<span class="fb-hand">' + hand + ' as ' + spot.hero + (spot.villain ? ' vs ' + spot.villain : '') + '</span></div><div class="fb-text">' + expl + '</div>' + bars + whyHtml;
  }

  function renderReveal() {
    const rv = $('#reveal');
    if (!current || !current.answered || !settings.showRange) { rv.classList.add('hidden'); return; }
    rv.classList.remove('hidden');
    const { spot, hand } = current;
    $('#reveal-title').textContent = 'GTO range: ' + spot.title + ' (' + S.TABLES[spot.table].name + ')';
    G.renderGrid($('#reveal-grid'), spot.strategy, spot.actions, { highlight: hand, prior: spot.prior });
    G.renderLegend($('#reveal-legend'), spot.actions);
    G.renderSummary($('#reveal-summary'), spot.strategy, spot.actions, spot.prior);
  }

  $('#next-btn').addEventListener('click', e => { e.currentTarget.blur(); newHand(); });
  document.addEventListener('keydown', e => {
    if ($('#view-trainer').classList.contains('active') === false) return;
    if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return; // leave Cmd+R, Ctrl+F etc. to the browser
    if (!current) return;
    const k = e.key.toLowerCase();
    if (!current.answered) {
      const idx = { '1': 0, '2': 1, '3': 2 }[k];
      if (idx !== undefined && current.spot.actions[idx]) { answer(current.spot.actions[idx].key); e.preventDefault(); }
    } else if (k === ' ' || k === 'spacebar' || k === 'enter' || e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') { newHand(); e.preventDefault(); }
  });

  /* ---------------- stats ---------------- */
  function pct(p, t) { return t ? Math.round(100 * p / t) + '%' : '–'; }
  function renderStats() {
    $('#stat-acc').textContent = pct(stats.points, stats.total);
    $('#stat-hands').textContent = stats.total;
    $('#stat-breakdown').textContent = stats.correct + ' correct · ' + stats.mixed + ' mixed · ' + stats.wrong + ' wrong' + (stats.blunders ? ' · ' + stats.blunders + ' blunders' : '') + ' · streak ' + stats.streak;
    $('#stat-ev').textContent = stats.total ? ((stats.evLoss || 0) / stats.total).toFixed(2) + ' bb' : '–';
    $('#stat-evtotal').textContent = stats.total ? (stats.evLoss || 0).toFixed(1) + ' bb' : '–';
    const pos = $('#stat-pos');
    pos.innerHTML = '';
    const rows = Object.keys(stats.byPos).filter(k => k.startsWith(settings.table + ':')).sort((a, b) => S.TABLES[settings.table].positions.indexOf(a.split(':')[1]) - S.TABLES[settings.table].positions.indexOf(b.split(':')[1]));
    if (!rows.length) pos.innerHTML = '<div class="muted">No hands yet for ' + S.TABLES[settings.table].name + '.</div>';
    for (const k of rows) {
      const r = stats.byPos[k];
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.innerHTML = '<span>' + k.split(':')[1] + '</span><div class="stat-track"><div style="width:' + Math.round(100 * r.points / r.total) + '%"></div></div><span>' + pct(r.points, r.total) + ' <small>(' + r.total + ')</small></span>';
      pos.appendChild(row);
    }
    const typ = $('#stat-type');
    typ.innerHTML = '';
    for (const k in stats.byType) {
      const r = stats.byType[k];
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.innerHTML = '<span>' + S.TYPE_META[k].short + '</span><div class="stat-track"><div style="width:' + Math.round(100 * r.points / r.total) + '%"></div></div><span>' + pct(r.points, r.total) + ' <small>(' + r.total + ')</small></span>';
      typ.appendChild(row);
    }
    const mis = $('#stat-mistakes');
    mis.innerHTML = '';
    if (!stats.mistakes.length) mis.innerHTML = '<div class="muted">No mistakes yet.</div>';
    for (const m of stats.mistakes) {
      const d = document.createElement('div');
      const reviewable = !!spotOfMistake(m);
      d.className = 'mistake ' + m.level + (reviewable ? ' clickable' : '');
      d.innerHTML = '<b>' + m.hand + '</b> ' + m.title + ' <span class="muted">' + (m.table === '9max' ? '9-max' : '6-max') + '</span>' + (m.loss ? ' <span class="loss">−' + m.loss.toFixed(2) + ' bb</span>' : '') + '<br><span class="muted">You: ' + m.chosen + ' · GTO: ' + m.gto + '</span>';
      if (reviewable) { d.title = 'Replay this spot'; d.addEventListener('click', () => reviewMistake(m)); }
      mis.appendChild(d);
    }
  }
  $('#reset-stats').addEventListener('click', () => {
    if (!confirm('Reset all training statistics?')) return;
    stats = freshStats(); saveJSON(STATS_KEY, stats); renderStats();
  });

  /* ---------------- range charts ---------------- */
  function chartSpots() { return S.getSpots(charts.table).filter(s => s.type === charts.type); }
  function renderChartControls() {
    $$('#chart-table button').forEach(b => b.classList.toggle('active', b.dataset.table === charts.table));
    $$('#chart-type button').forEach(b => b.classList.toggle('active', b.dataset.type === charts.type));
    const spots = chartSpots();
    const heroes = Array.from(new Set(spots.map(s => s.hero)));
    if (!heroes.includes(charts.hero)) charts.hero = heroes[0];
    const hw = $('#chart-hero');
    hw.innerHTML = '';
    for (const p of heroes) {
      const b = document.createElement('button');
      b.className = 'chip' + (p === charts.hero ? ' active' : '');
      b.textContent = p; b.title = S.POSITION_NAMES[p];
      b.addEventListener('click', () => { charts.hero = p; charts.villain = null; renderCharts(); });
      hw.appendChild(b);
    }
    const villains = spots.filter(s => s.hero === charts.hero).map(s => s.villain).filter(Boolean);
    const vw = $('#chart-villain');
    vw.innerHTML = '';
    $('#chart-villain-wrap').classList.toggle('hidden', !villains.length);
    if (villains.length) {
      if (!villains.includes(charts.villain)) charts.villain = villains[0];
      for (const p of villains) {
        const b = document.createElement('button');
        b.className = 'chip' + (p === charts.villain ? ' active' : '');
        b.textContent = p; b.title = S.POSITION_NAMES[p];
        b.addEventListener('click', () => { charts.villain = p; renderCharts(); });
        vw.appendChild(b);
      }
    } else charts.villain = null;
    $('#chart-villain-label').textContent = charts.type === 'vs3bet' ? '3-bettor' : charts.type === 'vsLimp' ? 'Limper' : 'Opener';
  }
  function renderCharts() {
    renderChartControls();
    const spot = chartSpots().find(s => s.hero === charts.hero && (s.villain || null) === charts.villain);
    if (!spot) return;
    const T6 = S.TABLES[spot.table];
    $('#chart-title').textContent = spot.title + ' — ' + T6.name + ', 100bb';
    $('#chart-desc').textContent = spot.description + ' ' + spot.question;
    const info = $('#chart-hand-info');
    const showHand = (hand, freqs) => {
      const parts = spot.actions.map(a => '<span class="hi-row"><span class="swatch" style="background:' + a.color + '"></span>' + labelOf(spot, a.key) + ' <b>' + Math.round((freqs[a.key] || 0) * 100) + '%</b></span>').join('');
      const out = spot.prior && spot.prior[hand] === 0;
      info.innerHTML = '<div class="hi-hand">' + hand + ' <small>' + H.handLabel(hand) + ' · ' + H.combos(hand) + ' combos</small></div>' + (out ? '<div class="muted">Not in the ' + spot.hero + ' opening range, so this spot never happens with ' + hand + '.</div>' : parts) + (spot.prior && !out && spot.prior[hand] < 1 ? '<div class="muted">Opened ' + Math.round(spot.prior[hand] * 100) + '% of the time.</div>' : '');
      const why = $('#chart-why');
      if (out) { why.classList.add('hidden'); return; }
      const ex = window.Explain.explain(spot, hand, freqs);
      why.classList.remove('hidden');
      why.innerHTML = '<span class="why-cat">' + ex.catName + '</span> ' + ex.why + (ex.mix ? ' <span class="why-mix">' + ex.mix + '</span>' : '') + (ex.compare ? '<p class="why-compare">' + ex.compare + '</p>' : '');
    };
    G.renderGrid($('#chart-grid'), spot.strategy, spot.actions, { prior: spot.prior, onHover: showHand });
    G.renderLegend($('#chart-legend'), spot.actions);
    G.renderSummary($('#chart-summary'), spot.strategy, spot.actions, spot.prior);
    T.renderTable($('#chart-table-svg'), { positions: T6.positions, hero: spot.hero, seats: spot.seats, pot: spot.pot, heroCards: null });
    info.innerHTML = '<div class="muted">Hover a hand for its frequencies and the reasoning.</div>';
    $('#chart-why').classList.add('hidden');
    const src = $('#chart-source');
    src.textContent = 'Data key: ' + spot.source + (spot.table === '9max' && /UTG\+|LJ/.test(spot.hero + (spot.villain || '')) ? ' (9-max early positions reuse the structurally equivalent 6-max strategy, see About)' : '');
  }
  $$('#chart-table button').forEach(b => b.addEventListener('click', () => { charts.table = b.dataset.table; renderCharts(); }));
  $$('#chart-type button').forEach(b => b.addEventListener('click', () => { charts.type = b.dataset.type; charts.villain = null; renderCharts(); }));

  /* ---------------- about ---------------- */
  function renderAbout() {
    const tbl = $('#about-rfi');
    if (tbl.dataset.done) return;
    tbl.dataset.done = '1';
    let html = '<tr><th>Table</th><th>Position</th><th>Open %</th><th>Combos</th></tr>';
    for (const tk of ['6max', '9max']) {
      for (const s of S.getSpots(tk).filter(x => x.type === 'rfi')) {
        const sum = G.summarize(s.strategy, s.actions).rows[0];
        html += '<tr><td>' + S.TABLES[tk].name + '</td><td>' + s.hero + '</td><td>' + sum.pct.toFixed(1) + '%</td><td>' + sum.combos.toFixed(0) + '</td></tr>';
      }
    }
    tbl.innerHTML = html;
    const def = $('#about-defend');
    let h2 = '<tr><th>Spot</th><th>3-bet</th><th>Call</th><th>Fold</th></tr>';
    for (const s of S.getSpots('6max').filter(x => x.type === 'vsOpen')) {
      const r = G.summarize(s.strategy, s.actions).rows;
      h2 += '<tr><td>' + s.title + '</td><td>' + r[0].pct.toFixed(1) + '%</td><td>' + r[1].pct.toFixed(1) + '%</td><td>' + r[2].pct.toFixed(1) + '%</td></tr>';
    }
    def.innerHTML = h2;
  }

  /* ---------------- init ---------------- */
  renderSettings();
  renderStats();
  newHand();
})();
