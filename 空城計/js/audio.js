/* audio.js — 以 WebAudio 合成古箏般的音色與音效（不需音檔） */
(function () {
  'use strict';
  const A = { ctx: null, music: true, sfx: true, bgmTimer: null, master: null };
  const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0]; // 宮商角徵羽
  A.PENTA = PENTA;
  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    try {
      A.ctx = new (window.AudioContext || window.webkitAudioContext)();
      A.master = A.ctx.createGain(); A.master.gain.value = 0.55; A.master.connect(A.ctx.destination);
    } catch (e) { A.ctx = null; }
  };
  function env(g, t, a, d, peak) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  A.pluck = function (freq, vol, dur, when) {
    if (!A.ctx) return; const c = A.ctx, t = (when || c.currentTime); vol = vol || 0.3; dur = dur || 1.4;
    const o1 = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o1.type = 'triangle'; o2.type = 'sine'; o1.frequency.value = freq; o2.frequency.value = freq * 2.005;
    f.type = 'lowpass'; f.frequency.setValueAtTime(freq * 8, t); f.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur);
    const g2 = c.createGain(); g2.gain.value = 0.35;
    o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(A.master);
    env(g, t, 0.005, dur, vol);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  };
  A.tone = function (freq, vol, dur, type, when) {
    if (!A.ctx || !A.sfx) return; const c = A.ctx, t = when || c.currentTime; const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = freq; o.connect(g); g.connect(A.master); env(g, t, 0.01, dur, vol); o.start(t); o.stop(t + dur + 0.05);
  };
  A.noise = function (dur, vol, freq) {
    if (!A.ctx || !A.sfx) return; const c = A.ctx, t = c.currentTime; const n = c.sampleRate * dur; const buf = c.createBuffer(1, n, c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(); s.buffer = buf; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200; const g = c.createGain(); g.gain.value = vol || 0.3;
    s.connect(f); f.connect(g); g.connect(A.master); s.start(t);
  };
  A.sfxPlay = function (name) {
    if (!A.ctx || !A.sfx) return; const t = A.ctx.currentTime;
    switch (name) {
      case 'click': A.tone(880, 0.08, 0.08, 'triangle'); break;
      case 'correct': A.pluck(523.25, 0.35, 0.6, t); A.pluck(783.99, 0.35, 0.9, t + 0.12); break;
      case 'wrong': A.tone(180, 0.15, 0.3, 'sawtooth'); A.tone(150, 0.12, 0.35, 'sawtooth', t + 0.12); break;
      case 'collect': A.pluck(1046.5, 0.3, 0.5, t); A.pluck(1318.5, 0.25, 0.6, t + 0.07); break;
      case 'drum': A.tone(80, 0.6, 0.4, 'sine'); A.noise(0.15, 0.25, 400); break;
      case 'fanfare': [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => A.pluck(f, 0.35, 1.0, t + i * 0.13)); break;
      case 'firework': A.noise(0.5, 0.35, 2500); A.tone(600 + Math.random() * 400, 0.06, 0.3, 'triangle'); break;
      case 'whoosh': A.noise(0.35, 0.18, 900); break;
      case 'page': A.noise(0.12, 0.12, 3000); break;
    }
  };
  // 背景音樂：assets/audio/bgm.mp3（〈勇氣之魂：冒險之歌〉），讀不到時改用合成音樂
  A.bgmVol = 0.42; A.el = null;
  A.startBGM = function () {
    if (A.el) { A.applyMusic(); return; }
    try {
      const el = new Audio('assets/audio/bgm.mp3'); el.loop = true; el.preload = 'auto'; el.volume = A.bgmVol; A.el = el;
      el.addEventListener('error', () => { A.el = null; A.startSynth(); });
      const pr = el.play(); if (pr && pr.catch) pr.catch(() => { /* 等下一次點擊再播 */ });
    } catch (e) { A.el = null; A.startSynth(); }
  };
  A.applyMusic = function () {
    if (!A.el) return;
    if (A.music) { A.el.volume = A.ducked ? A.bgmVol * 0.25 : A.bgmVol; if (A.el.paused) { const pr = A.el.play(); if (pr && pr.catch) pr.catch(() => { }); } }
    else A.el.pause();
  };
  A.duck = function (on) { A.ducked = !!on; A.applyMusic(); };
  A.startSynth = function () {
    if (!A.ctx || A.bgmTimer) return;
    let step = 0; const scale = [196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33];
    let idx = 4;
    A.bgmTimer = setInterval(() => {
      if (!A.music || !A.ctx) return;
      const t = A.ctx.currentTime + 0.05;
      if (step % 8 === 0) A.pluck(98.0 * (step % 16 === 0 ? 1 : 1.122), 0.16, 2.6, t);
      if (Math.random() < 0.72) { idx = Math.max(0, Math.min(scale.length - 1, idx + Math.floor(Math.random() * 5) - 2)); A.pluck(scale[idx], 0.14, 1.6, t); }
      if (step % 4 === 2 && Math.random() < 0.4) A.pluck(scale[Math.max(0, idx - 2)] , 0.08, 1.2, t + 0.18);
      step++;
    }, 360);
  };
  window.AUDIO = A;
})();
