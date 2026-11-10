/* minigames.js — 關卡小遊戲（DOM 版），每個都回傳 Promise<分數 0~40> */
(function () {
  'use strict';
  const MG = {};
  const MAX = () => (window.GAME_DATA.scoring.miniMax || 40);
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const sfx = (n) => window.AUDIO && AUDIO.sfxPlay(n);
  const shake = (e) => { e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); };
  MG.shuffle = shuffle;

  function frame(box, title, tip) {
    box.innerHTML = '';
    const h = el('div', 'mg-head', `<div class="mg-title">${title}</div><div class="mg-tip">${tip || ''}</div>`);
    const stat = el('div', 'mg-stat'); h.appendChild(stat);
    box.appendChild(h); const body = el('div', 'mg-body'); box.appendChild(body);
    return { body, stat };
  }

  /* 派兵佈陣：點卡片 → 點任務 */
  MG.assign = function (box, cfg) {
    return new Promise((resolve) => {
      const { body, stat } = frame(box, '⚔️ ' + cfg.name, cfg.tip);
      let mistakes = 0, done = 0, sel = null;
      const wrap = el('div', 'assign');
      const cardsCol = el('div', 'assign-cards'); const slotsCol = el('div', 'assign-slots');
      wrap.append(cardsCol, slotsCol); body.appendChild(wrap);
      const upd = () => stat.textContent = `完成 ${done}/${cfg.cards.length}　失誤 ${mistakes}`; upd();
      shuffle(cfg.cards).forEach((c) => {
        const b = el('button', 'card', `📜 ${c.text}`); b.dataset.slot = c.slot;
        b.onclick = () => { if (b.classList.contains('ok')) return; sfx('click'); cardsCol.querySelectorAll('.card').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); sel = b; };
        cardsCol.appendChild(b);
      });
      cfg.slots.forEach((s) => {
        const b = el('button', 'slot', `<span class="slot-name">${s}</span><span class="slot-drop">？</span>`);
        b.onclick = () => {
          if (!sel) { shake(b); return; }
          if (sel.dataset.slot === s) {
            sfx('correct'); sel.classList.remove('sel'); sel.classList.add('ok'); b.classList.add('ok'); b.querySelector('.slot-drop').textContent = '✔ ' + sel.textContent.replace('📜 ', '').slice(0, 10) + '…'; sel = null; done++; upd();
            if (done === cfg.cards.length) setTimeout(() => resolve(Math.max(10, MAX() - mistakes * 8)), 700);
          } else { sfx('wrong'); mistakes++; shake(b); shake(sel); upd(); }
        };
        slotsCol.appendChild(b);
      });
    });
  };

  /* 點燃烽火：記憶順序 */
  MG.simon = function (box, cfg) {
    return new Promise((resolve) => {
      const { body, stat } = frame(box, '🔥 ' + cfg.name, cfg.tip);
      const colors = ['#ff6b4a', '#ffc04a', '#5ad17a', '#5aa8ff'];
      const names = ['東烽', '南烽', '西烽', '北烽'];
      const grid = el('div', 'simon'); body.appendChild(grid);
      const msg = el('div', 'simon-msg', '準備……'); body.appendChild(msg);
      const btns = names.map((n, i) => { const b = el('button', 'beacon', `<div class="flame">🔥</div><div>${n}</div>`); b.style.setProperty('--c', colors[i]); grid.appendChild(b); return b; });
      let round = 0, score = 0, attempt = 0, seq = [], input = [], accept = false;
      const per = MAX() / cfg.rounds.length;
      const light = (i, ms) => { btns[i].classList.add('lit'); if (window.AUDIO) AUDIO.pluck(AUDIO.PENTA[i + 1] || 440, 0.35, 0.8); setTimeout(() => btns[i].classList.remove('lit'), ms || 420); };
      const upd = () => stat.textContent = `第 ${Math.min(round + 1, cfg.rounds.length)}/${cfg.rounds.length} 回合　得分 ${Math.round(score)}`;
      const play = () => {
        accept = false; input = []; upd(); msg.textContent = '👀 仔細看烽火亮起的順序……';
        seq.forEach((v, k) => setTimeout(() => light(v), 700 + k * 650));
        setTimeout(() => { accept = true; msg.textContent = '👉 換你了！依序點燃烽火'; }, 700 + seq.length * 650);
      };
      const next = () => {
        if (round >= cfg.rounds.length) { msg.textContent = '烽火傳遍四方！'; setTimeout(() => resolve(Math.round(score)), 800); return; }
        attempt = 0; seq = []; for (let k = 0; k < cfg.rounds[round]; k++) seq.push(Math.floor(Math.random() * 4)); play();
      };
      btns.forEach((b, i) => b.onclick = () => {
        if (!accept) return; light(i, 250); input.push(i);
        const k = input.length - 1;
        if (input[k] !== seq[k]) {
          accept = false; sfx('wrong'); shake(grid); attempt++;
          if (attempt < 2) { msg.textContent = '❌ 順序錯了，再看一次！'; setTimeout(play, 900); }
          else { msg.textContent = '這回合沒成功，下一回合加油！'; round++; setTimeout(next, 1100); }
          return;
        }
        if (input.length === seq.length) { accept = false; sfx('correct'); score += attempt === 0 ? per : per / 2; msg.textContent = '✔ 成功點燃！'; round++; upd(); setTimeout(next, 900); }
      });
      upd(); setTimeout(next, 500);
    });
  };

  /* 城樓撫琴：節奏遊戲 */
  MG.rhythm = function (box, cfg) {
    return new Promise((resolve) => {
      const { body, stat } = frame(box, '🎵 ' + cfg.name, cfg.tip);
      const lanesN = 5, labels = ['宮', '商', '角', '徵', '羽'], keys = ['a', 's', 'd', 'f', 'g'];
      const cv = el('canvas', 'rhythm-cv'); body.appendChild(cv);
      const pads = el('div', 'rhythm-pads'); body.appendChild(pads);
      const padBtns = labels.map((l, i) => { const b = el('button', 'pad', `${l}<small>${keys[i].toUpperCase()}</small>`); pads.appendChild(b); return b; });
      const ctx = cv.getContext('2d');
      const N = cfg.notes || 20; const notes = []; let t0 = 0; const speed = 1.6; // 秒：從頂端落到判定線
      let tt = 1.6; let last = 2;
      const melody = [0, 1, 2, 4, 3, 2, 1, 0, 2, 3, 4, 3, 1, 2, 0, 1, 3, 4, 2, 1, 0, 2, 4, 3];
      for (let i = 0; i < N; i++) { tt += (i % 4 === 3 ? 0.9 : 0.62); notes.push({ lane: melody[i % melody.length], time: tt, hit: null }); }
      const end = tt + 1.5; let perfect = 0, good = 0, miss = 0, combo = 0; let raf; let fb = [];
      const resize = () => { const w = Math.min(560, box.clientWidth - 24); cv.width = w * 2; cv.height = 300 * 2; cv.style.width = w + 'px'; cv.style.height = '300px'; };
      resize();
      const now = () => performance.now() / 1000 - t0;
      const hit = (lane) => {
        padBtns[lane].classList.add('down'); setTimeout(() => padBtns[lane].classList.remove('down'), 120);
        if (window.AUDIO) AUDIO.pluck(AUDIO.PENTA[lane] * (lane < 2 ? 1 : 1), 0.32, 1.2);
        const t = now(); let best = null, bd = 9;
        for (const n of notes) if (n.lane === lane && !n.hit) { const d = Math.abs(n.time - t); if (d < bd) { bd = d; best = n; } }
        if (best && bd < 0.32) { best.hit = bd < 0.15 ? 'p' : 'g'; if (best.hit === 'p') perfect++; else good++; combo++; fb.push({ lane, txt: best.hit === 'p' ? '完美!' : '不錯', t }); }
      };
      padBtns.forEach((b, i) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); hit(i); }));
      const kd = (e) => { const i = keys.indexOf(e.key.toLowerCase()); if (i >= 0) { e.preventDefault(); hit(i); } };
      window.addEventListener('keydown', kd);
      const draw = () => {
        const t = now(); const W = cv.width, H = cv.height, lw = W / lanesN, hy = H * 0.82;
        ctx.clearRect(0, 0, W, H);
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2a1a12'); g.addColorStop(1, '#5a3420'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < lanesN; i++) { ctx.strokeStyle = 'rgba(255,240,200,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(lw * (i + 0.5), 0); ctx.lineTo(lw * (i + 0.5), H); ctx.stroke(); }
        ctx.fillStyle = '#f2c14e'; ctx.fillRect(0, hy - 4, W, 8);
        for (const n of notes) {
          if (n.hit) continue; const y = hy - (n.time - t) / speed * hy; if (y < -40 || y > H + 40) continue;
          if (t - n.time > 0.32) { n.hit = 'm'; miss++; combo = 0; fb.push({ lane: n.lane, txt: '錯過', t }); continue; }
          ctx.beginPath(); ctx.fillStyle = ['#ff8a80', '#ffd180', '#b9f6ca', '#80d8ff', '#ea80fc'][n.lane]; ctx.arc(lw * (n.lane + 0.5), y, lw * 0.28, 0, 7); ctx.fill();
          ctx.fillStyle = '#3a2010'; ctx.font = `bold ${lw * 0.26}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('♪', lw * (n.lane + 0.5), y);
        }
        fb = fb.filter(f => t - f.t < 0.6);
        for (const f of fb) { ctx.globalAlpha = 1 - (t - f.t) / 0.6; ctx.fillStyle = f.txt === '錯過' ? '#ff8a80' : '#fff59d'; ctx.font = `bold ${lw * 0.22}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(f.txt, lw * (f.lane + 0.5), hy - 60 - (t - f.t) * 80); ctx.globalAlpha = 1; }
        stat.textContent = `完美 ${perfect}　不錯 ${good}　錯過 ${miss}　連擊 ${combo}`;
        if (t > end) { cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); const s = Math.round(MAX() * Math.min(1, (perfect + good * 0.6) / (N * 0.85))); resolve(s); return; }
        raf = requestAnimationFrame(draw);
      };
      t0 = performance.now() / 1000; raf = requestAnimationFrame(draw);
    });
  };

  /* 配對 */
  MG.match = function (box, cfg) {
    return new Promise((resolve) => {
      const { body, stat } = frame(box, '🎭 ' + cfg.name, cfg.tip);
      let r = 0, mistakes = 0;
      const runRound = () => {
        body.innerHTML = ''; const round = cfg.rounds[r];
        body.appendChild(el('div', 'round-label', `第 ${r + 1} 回合：${round.label}`));
        const wrap = el('div', 'match'); const L = el('div', 'match-col'), Rc = el('div', 'match-col right'); wrap.append(L, Rc); body.appendChild(wrap);
        let sel = null, done = 0;
        const upd = () => stat.textContent = `配對 ${done}/${round.pairs.length}　失誤 ${mistakes}`; upd();
        shuffle(round.pairs).forEach(([a, b]) => { const e = el('button', 'm-item', a); e.dataset.k = b; e.onclick = () => { if (e.classList.contains('ok')) return; sfx('click'); L.querySelectorAll('.m-item').forEach(x => x.classList.remove('sel')); e.classList.add('sel'); sel = e; }; L.appendChild(e); });
        shuffle(round.pairs.map(p => p[1])).forEach((b) => { const e = el('button', 'm-item word', b); e.onclick = () => {
          if (e.classList.contains('ok')) return; if (!sel) { shake(e); return; }
          if (sel.dataset.k === b) { sfx('correct'); sel.classList.add('ok'); sel.classList.remove('sel'); e.classList.add('ok'); sel.innerHTML += ` <b>➜ ${b}</b>`; sel = null; done++; upd(); if (done === round.pairs.length) { r++; setTimeout(() => r < cfg.rounds.length ? runRound() : resolve(Math.max(10, MAX() - mistakes * 5)), 800); } }
          else { sfx('wrong'); mistakes++; shake(e); upd(); }
        }; Rc.appendChild(e); });
      };
      runRound();
    });
  };

  /* 排序 */
  MG.order = function (box, cfg) {
    return new Promise((resolve) => {
      const { body, stat } = frame(box, '📖 ' + cfg.name, cfg.tip);
      let mistakes = 0, k = 0;
      const seqBox = el('div', 'order-seq'); const pool = el('div', 'order-pool'); body.append(seqBox, pool);
      const slots = cfg.events.map((_, i) => { const s = el('div', 'order-slot', `<b>${i + 1}</b><span>？</span>`); seqBox.appendChild(s); return s; });
      const upd = () => stat.textContent = `已排 ${k}/${cfg.events.length}　失誤 ${mistakes}`; upd();
      shuffle(cfg.events.map((t, i) => ({ t, i }))).forEach(({ t, i }) => {
        const b = el('button', 'card', t);
        b.onclick = () => {
          if (b.disabled) return;
          if (i === k) { sfx('correct'); slots[k].classList.add('ok'); slots[k].querySelector('span').textContent = t; b.disabled = true; b.classList.add('gone'); k++; upd(); if (k === cfg.events.length) setTimeout(() => resolve(Math.max(10, MAX() - mistakes * 6)), 800); }
          else { sfx('wrong'); mistakes++; shake(b); upd(); }
        };
        pool.appendChild(b);
      });
    });
  };

  /* 翻牌記憶 */
  MG.memory = function (box, cfg) {
    return new Promise((resolve) => {
      const { body, stat } = frame(box, '🀄 ' + cfg.name, cfg.tip);
      const grid = el('div', 'memory'); body.appendChild(grid);
      const cards = []; cfg.pairs.forEach(([a, b], i) => { cards.push({ t: a, k: i, type: '文言' }); cards.push({ t: b, k: i, type: '白話' }); });
      let open = [], moves = 0, found = 0, lock = false;
      const upd = () => stat.textContent = `翻牌次數 ${moves}　配對 ${found}/${cfg.pairs.length}`; upd();
      shuffle(cards).forEach((c) => {
        const e = el('button', 'mcard', `<div class="mc-inner"><div class="mc-back">空城計</div><div class="mc-front"><small>${c.type}</small>${c.t}</div></div>`);
        e.onclick = () => {
          if (lock || e.classList.contains('flip')) return; e.classList.add('flip'); sfx('page'); open.push({ e, c });
          if (open.length === 2) {
            moves++; upd(); lock = true; const [x, y] = open;
            if (x.c.k === y.c.k) { setTimeout(() => { sfx('correct'); x.e.classList.add('ok'); y.e.classList.add('ok'); open = []; lock = false; found++; upd(); if (found === cfg.pairs.length) setTimeout(() => resolve(Math.max(10, Math.min(MAX(), MAX() - (moves - cfg.pairs.length - 2) * 3))), 800); }, 350); }
            else setTimeout(() => { x.e.classList.remove('flip'); y.e.classList.remove('flip'); open = []; lock = false; }, 900);
          }
        };
        grid.appendChild(e);
      });
    });
  };

  window.MINIGAMES = MG;
})();
