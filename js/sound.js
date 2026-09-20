/* sound.js — tiny synthesized feedback sounds (no audio files). */
(function (root) {
  'use strict';
  let ctx = null;
  function ac() {
    if (!ctx) { const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null; ctx = new AC(); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, start, dur, type, gain) {
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, c.currentTime + start);
    g.gain.linearRampToValueAtTime(gain || 0.12, c.currentTime + start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
    o.connect(g); g.connect(c.destination);
    o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.02);
  }
  const SOUNDS = {
    correct: () => { tone(660, 0, 0.12); tone(880, 0.1, 0.18); },
    mixed:   () => { tone(520, 0, 0.16, 'triangle', 0.1); },
    wrong:   () => { tone(200, 0, 0.22, 'square', 0.06); tone(150, 0.12, 0.24, 'square', 0.06); }
  };
  root.Sound = { play: name => { try { const f = SOUNDS[name]; if (f) f(); } catch (e) { /* ignore */ } } };
})(typeof window !== 'undefined' ? window : globalThis);
