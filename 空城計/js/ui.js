/* =========================================================
   ui.js — 介面：標題、捏角、故事書、HUD、對話、題目、結算、
           關卡列表、終章、證書、排行榜
   ========================================================= */
(function () {
  'use strict';
  const D = window.GAME_DATA, CFG = window.GAME_CONFIG || {}, PI = Math.PI;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const sfx = (n) => AUDIO.sfxPlay(n);
  const UI = window.UI = {};

  /* ================= 排行榜 ================= */
  const LB_KEY = 'kongcheng_board_v1';
  const KEEP = (CFG.keepDays || 7) * 864e5, TOP = CFG.leaderboardTop || 30;
  const LB = UI.LB = {
    local() { let a = []; try { a = JSON.parse(localStorage.getItem(LB_KEY) || '[]'); } catch (e) { } const now = Date.now(); a = a.filter(r => now - r.time < KEEP); try { localStorage.setItem(LB_KEY, JSON.stringify(a)); } catch (e) { } return a.sort((x, y) => y.score - x.score || x.time - y.time).slice(0, TOP); },
    addLocal(r) { let a = []; try { a = JSON.parse(localStorage.getItem(LB_KEY) || '[]'); } catch (e) { } a.push(r); try { localStorage.setItem(LB_KEY, JSON.stringify(a)); } catch (e) { } },
    jsonp(params) {
      return new Promise((resolve, reject) => {
        if (!CFG.leaderboardUrl) return reject(new Error('未設定線上排行榜'));
        const cb = 'kcjp' + Date.now() + Math.floor(Math.random() * 1000); const s = document.createElement('script');
        const q = Object.entries(Object.assign({ callback: cb }, params)).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
        const timer = setTimeout(() => { cleanup(); reject(new Error('連線逾時')); }, 9000);
        const cleanup = () => { clearTimeout(timer); delete window[cb]; s.remove(); };
        window[cb] = (data) => { cleanup(); resolve(data); };
        s.onerror = () => { cleanup(); reject(new Error('無法連線')); };
        s.src = CFG.leaderboardUrl + (CFG.leaderboardUrl.includes('?') ? '&' : '?') + q; document.body.appendChild(s);
      });
    },
    // 雲端排行榜（發布在 claude.ai 時使用 db 能力）
    db: null, user: null, canWrite: null, cloudReady: null,
    initCloud() {
      if (LB.cloudReady) return LB.cloudReady;
      LB.cloudReady = (async () => {
        if (!(window.claude && window.claude.use)) return false;
        try { LB.db = await window.claude.use('db'); LB.user = await window.claude.use('user'); } catch (e) { LB.db = null; }
        if (!LB.db) return false;
        try { LB.canWrite = LB.user ? await LB.user.can('data.write') : null; } catch (e) { LB.canWrite = null; }
        return true;
      })();
      return LB.cloudReady;
    },
    hasOnline() { return !!LB.db || !!CFG.leaderboardUrl; },
    async online() {
      await LB.initCloud();
      if (LB.db) {
        const snap = await LB.db.collection('scores').orderBy('time', 'desc').limit(400).get();
        const now = Date.now(); const rows = []; const old = [];
        for (const d of snap.docs) { const r = d.data(); if (!r) continue; if (now - (+r.time || 0) > KEEP) old.push(d.id); else rows.push({ name: String(r.name || ''), score: +r.score || 0, title: String(r.title || ''), time: +r.time || 0 }); }
        if (old.length && LB.canWrite !== false) old.slice(0, 20).forEach(id => LB.db.collection('scores').doc(id).delete().catch(() => { }));
        return rows.sort((x, y) => y.score - x.score || x.time - y.time).slice(0, TOP);
      }
      const d = await LB.jsonp({ action: 'list', top: TOP, days: CFG.keepDays || 7 });
      return (d.rows || []).map(r => ({ name: r.name, score: +r.score, title: r.title, time: +r.time || Date.parse(r.time) }));
    },
    async submit(r) {
      LB.addLocal(r); await LB.initCloud();
      if (LB.db && LB.canWrite !== false) {
        try { await LB.db.collection('scores').add({ name: String(r.name).slice(0, 12), score: Math.max(0, Math.min(800, r.score | 0)), title: String(r.title).slice(0, 10), time: r.time }); return 'online'; }
        catch (e) { LB.canWrite = false; }
      }
      if (CFG.leaderboardUrl) { try { await LB.jsonp({ action: 'add', name: r.name, score: r.score, title: r.title, time: r.time }); return 'online'; } catch (e) { return 'local'; } }
      return LB.db ? 'readonly' : 'local';
    }
  };

  /* ================= 基本元件 ================= */
  UI.toast = function (msg, ms) { const t = $('#toast'); t.innerHTML = msg; t.classList.add('show'); clearTimeout(UI._tt); UI._tt = setTimeout(() => t.classList.remove('show'), ms || 2600); };
  UI.openModal = function (cls) { const m = $('#modal'); const box = $('#modalBox'); box.className = 'modal-box ' + (cls || ''); box.innerHTML = ''; m.classList.remove('hidden'); box.scrollTop = 0; return box; };
  UI.closeModal = function () { $('#modal').classList.add('hidden'); $('#modalBox').innerHTML = ''; };
  UI.fade = async function (fn) { const f = $('#fade'); f.classList.add('on'); await sleep(380); if (fn) await fn(); await sleep(120); f.classList.remove('on'); };
  function screen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); if (id) $(id).classList.remove('hidden'); }
  UI.screen = screen;
  function setHUD(on) { $('#hud').classList.toggle('hidden', !on); $('#joy').classList.toggle('hidden', !on || !G.isTouch); $('#controls').classList.toggle('hidden', !on); $('#camCtl').classList.toggle('hidden', !on); }

  /* ================= 初始化 ================= */
  UI.init = function () {
    const first = () => { AUDIO.init(); AUDIO.startBGM(); if (AUDIO.el && !AUDIO.el.paused) { window.removeEventListener('pointerdown', first); window.removeEventListener('keydown', first); } };
    window.addEventListener('pointerdown', first); window.addEventListener('keydown', first);
    $('#btnAct').onclick = () => UI.action();
    $('#btnMount').onclick = () => { G.setMounted(!G.player.mounted); sfx('click'); };
    $('#btnJump').onclick = () => G.jump();
    $('#btnNav').onclick = () => UI.autoNext();
    LB.initCloud();
    $('#hStory').onclick = () => UI.showStory(false);
    $('#hLevels').onclick = () => UI.showLevels();
    $('#hBoard').onclick = () => UI.showBoard();
    $('#hMenu').onclick = () => UI.showMenu();
    $('#hRestart').onclick = () => { if (G.state !== 'world') return; UI.restartGame(); };
    $('#exitLevel').onclick = () => UI.exitLevel();
    // 鏡頭縮放／旋轉按鈕（按住可連續）
    const camHold = (id, fn) => { const b = $(id); let t = null; const stop = () => { clearInterval(t); t = null; };
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); G.cam.dragT = 2; stop(); t = setInterval(() => { fn(); G.cam.dragT = 2; }, 50); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, stop)); };
    camHold('#camIn', () => { G.cam.dist = Math.max(5, G.cam.dist * 0.95); });
    camHold('#camOut', () => { G.cam.dist = Math.min(40, G.cam.dist * 1.05); });
    camHold('#camL', () => { G.cam.yaw += 0.06; });
    camHold('#camR', () => { G.cam.yaw -= 0.06; });
    camHold('#camUp', () => { G.cam.pitch = Math.min(1.35, G.cam.pitch + 0.03); });
    camHold('#camDown', () => { G.cam.pitch = Math.max(0.08, G.cam.pitch - 0.03); });
    $('#camMap').onclick = () => UI.toggleMap();
    const camFold = (f) => { $('#camCtl').classList.toggle('folded', f); try { localStorage.setItem('kc_cam_fold', f ? '1' : '0'); } catch (e) { } };
    let fold0 = null; try { fold0 = localStorage.getItem('kc_cam_fold'); } catch (e) { }
    camFold(fold0 === null ? G.isTouch : fold0 === '1');
    $('#camToggle').onclick = () => camFold(!$('#camCtl').classList.contains('folded'));
    $('#hMusic').onclick = () => { AUDIO.init(); AUDIO.music = !AUDIO.music; AUDIO.startBGM(); AUDIO.applyMusic(); $('#hMusic').textContent = AUDIO.music ? '🎵' : '🔇'; };
    $('#dialog').onclick = () => UI.dialogNext();
    $('#minimap').onclick = () => UI.toggleMap();
    if (G.isTouch) document.body.classList.add('touch');
  };
  UI.restartGame = function () {
    const go = () => { try { localStorage.removeItem('kongcheng_save_v1'); } catch (e) { } G.save = null; G.stopAuto && G.stopAuto(); UI.showCreator(null); };
    if (G.save) UI.confirmBox('重新開始會清除目前的名字、造型和闖關進度（排行榜紀錄會保留），確定嗎？', go); else go();
  };
  UI.updateMountBtn = function () { const b = $('#btnMount'); if (!G.player || !G.player.horse) { b.classList.add('hidden'); return; } b.classList.remove('hidden'); b.innerHTML = G.player.mounted ? '🚶<small>下馬</small>' : '🐎<small>騎馬</small>'; };

  /* ================= 標題 ================= */
  UI.showTitle = function () {
    G.state = 'title'; setHUD(false); screen('#scr-title');
    const s = G.save; const box = $('#titleBtns'); box.innerHTML = '';
    if (s) { const b = el('button', 'btn big gold', `▶ 繼續冒險<small>${esc(s.name)}・${G.totalScore()} 分</small>`); b.onclick = () => { sfx('click'); s.storyRead ? UI.enterWorld() : UI.showStory(true); }; box.appendChild(b); }
    if (!s) { const n0 = el('button', 'btn big gold', '⚔ 開始冒險'); n0.onclick = () => { sfx('click'); UI.showCreator(null); }; box.appendChild(n0); }
    const n = el('button', 'btn big', '🔄 重新開始遊戲'); n.onclick = () => { sfx('click'); UI.restartGame(); }; box.appendChild(n);
    const lb = el('button', 'btn', '🏆 排行榜'); lb.onclick = () => UI.showBoard(); box.appendChild(lb);
    const hp = el('button', 'btn', '❓ 怎麼玩'); hp.onclick = () => UI.showHelp(); box.appendChild(hp);
  };

  /* ================= 捏角 ================= */
  const NAMES = ['小孔明', '臥龍小將', '西城守將', '羽扇少俠', '赤兔騎士', '常山小龍', '江東才子', '蜀漢先鋒', '鳳雛學士', '神算小軍師', '青龍少年', '月下琴仙'];
  UI.showCreator = function (editing) {
    G.state = 'creator'; setHUD(false); screen('#scr-creator');
    const O = MD.OPTIONS; const look = Object.assign(MD.defaultLook(), editing ? G.save.look : {});
    if (!editing) { look.clothCol = O.clothCol[Math.floor(Math.random() * 6)]; }
    $('#pname').value = editing ? G.save.name : '';
    const tabs = [['basic', '👤 基本'], ['hair', '💇 髮型'], ['hat', '🎩 帽子'], ['outfit', '👘 服裝'], ['acc', '🎐 配件'], ['weapon', '⚔ 兵器'], ['horse', '🐎 坐騎']];
    const tabBox = $('#cTabs'), area = $('#cArea'); let cur = 'basic';
    const rebuild = () => { G.rebuildCreatorModel(look); info(); };
    const info = () => { $('#cInfo').innerHTML = `<b>${optName(O.weapon, look.weapon)}</b>：${MD.WEAPON_INFO[look.weapon] || ''}<br><b>${optName(O.horse, look.horse)}</b>：${MD.HORSE_INFO[look.horse] || ''}`; };
    const optName = (list, v) => (list.find(o => o[0] === v) || ['', ''])[1];
    const group = (title, list, key, icon) => {
      const g = el('div', 'opt-group', `<div class="opt-title">${title}</div>`); const row = el('div', 'opt-row');
      list.forEach(([v, name]) => { const b = el('button', 'opt' + (look[key] === v ? ' on' : ''), (icon ? `<img src="${icon(v)}" alt="" onerror="this.remove()">` : '') + `<span>${name}</span>`); b.onclick = () => { look[key] = v; sfx('click'); row.querySelectorAll('.opt').forEach(x => x.classList.remove('on')); b.classList.add('on'); if (key === 'gender') { look.hair = look.gender === 'f' ? 'twin' : 'bun'; if (look.gender === 'f') look.beard = 'none'; draw(); } rebuild(); }; row.appendChild(b); });
      g.appendChild(row); return g;
    };
    const colors = (title, list, key) => {
      const g = el('div', 'opt-group', `<div class="opt-title">${title}</div>`); const row = el('div', 'opt-row colors');
      list.forEach(c => { const b = el('button', 'sw' + (look[key] === c ? ' on' : '')); b.style.background = c; b.title = c; b.onclick = () => { look[key] = c; sfx('click'); row.querySelectorAll('.sw').forEach(x => x.classList.remove('on')); b.classList.add('on'); rebuild(); }; row.appendChild(b); });
      const pick = el('label', 'sw pick', '🎨<input type="color">'); const inp = pick.querySelector('input'); inp.value = /^#[0-9a-f]{6}$/i.test(look[key]) ? look[key] : '#888888'; inp.oninput = () => { look[key] = inp.value; rebuild(); }; row.appendChild(pick);
      g.appendChild(row); return g;
    };
    const draw = () => {
      tabBox.innerHTML = ''; tabs.forEach(([k, n]) => { const b = el('button', 'tab' + (cur === k ? ' on' : ''), n); b.onclick = () => { cur = k; sfx('page'); draw(); }; tabBox.appendChild(b); });
      area.innerHTML = '';
      if (cur === 'basic') { area.append(group('性別', O.gender, 'gender'), colors('膚色', O.skin, 'skin')); if (look.gender === 'm') area.append(group('鬍子', O.beard, 'beard')); }
      if (cur === 'hair') { area.append(group('髮型', look.gender === 'f' ? O.hairF : O.hairM, 'hair'), colors('髮色', O.hairCol, 'hairCol')); }
      if (cur === 'hat') { area.append(group('帽子／頭飾', O.hat, 'hat'), colors('帽子顏色', ['', '#7fa6b8', '#c9d2dc', '#e8c35a', '#8a4fc8', '#20202a', '#d6352b', '#3f8a4a', '#f4f0e0'].slice(1), 'hatCol')); }
      if (cur === 'outfit') { area.append(group('服裝', O.outfit, 'outfit'), colors('主色', O.clothCol, 'clothCol'), colors('滾邊／點綴色', O.accentCol, 'accent')); }
      if (cur === 'acc') { area.append(group('配件', O.acc, 'acc'), colors('配件／披風顏色', O.accentCol, 'accent')); }
      if (cur === 'weapon') { area.append(group('三國神兵', O.weapon, 'weapon', (v) => `assets/items/weapon_${v}.png`)); }
      if (cur === 'horse') { area.append(group('三國名馬', O.horse, 'horse', (v) => v === 'none' ? '' : `assets/items/horse_${v}.png`)); }
    };
    draw(); rebuild();
    $('#spinBtn').onclick = () => { G.creatorPause = !G.creatorPause; $('#spinBtn').textContent = G.creatorPause ? '⟳ 開始旋轉' : '⏸ 停止旋轉'; };
    $('#spinBtn').textContent = G.creatorPause ? '⟳ 開始旋轉' : '⏸ 停止旋轉';
    $('#rndName').onclick = () => { $('#pname').value = NAMES[Math.floor(Math.random() * NAMES.length)]; sfx('click'); };
    $('#rndLook').onclick = () => {
      const r = (a) => a[Math.floor(Math.random() * a.length)];
      look.gender = r(['m', 'f']); look.hair = r(look.gender === 'f' ? O.hairF : O.hairM)[0]; look.hairCol = r(O.hairCol); look.beard = look.gender === 'm' ? r(O.beard)[0] : 'none';
      look.hat = r(O.hat)[0]; look.hatCol = undefined; look.outfit = r(O.outfit)[0]; look.clothCol = r(O.clothCol); look.accent = r(O.accentCol); look.acc = r(O.acc)[0]; look.weapon = r(O.weapon)[0]; look.horse = r(O.horse.slice(0, 5))[0]; look.skin = r(O.skin);
      sfx('whoosh'); draw(); rebuild();
    };
    $('#creatorOk').onclick = () => {
      const name = $('#pname').value.trim().replace(/[<>]/g, '');
      if (!name) { UI.toast('請先幫你的英雄取個名字！'); $('#pname').focus(); return; }
      sfx('fanfare');
      if (editing) { G.save.name = name; G.save.look = Object.assign({}, look); G.writeSave(); UI.enterWorld(); }
      else { G.newSave(name, Object.assign({}, look)); G.player = null; UI.showStory(true); }
    };
    $('#creatorBack').onclick = () => { editing ? UI.enterWorld() : UI.showTitle(); };
  };

  /* ================= 故事書 ================= */
  UI.showStory = function (first) {
    const prevState = G.state; if (G.state === 'world') G.state = 'modal';
    screen(first ? '#scr-story' : null); setHUD(!first && !!G.player);
    const host = first ? $('#storyBook') : UI.openModal('book-modal');
    const pages = ['people', ...D.story.map((_, i) => i), 'order'];
    let p = 0;
    const draw = () => {
      sfx('page'); host.innerHTML = '';
      const page = pages[p]; const inner = el('div', 'book-page');
      if (page === 'people') {
        inner.innerHTML = `<h2>📜 故事人物介紹</h2><p class="lead">〈空城計〉改寫自《三國演義》第九十五回。先認識故事裡的人物吧！</p>`;
        const grid = el('div', 'people'); D.people.forEach(pp => grid.appendChild(el('div', 'person', `<img src="${pp.img}" alt="${pp.name}"><div><b>${pp.name}</b><small>${pp.sub}</small><p>${pp.text}</p></div>`))); inner.appendChild(grid);
      } else if (page === 'order') {
        inner.innerHTML = `<h2>🧭 故事順序：起因 → 經過 → 結果</h2>
        <div class="flow"><div class="fcol c1"><h3>起因</h3><p>① 街亭失守，孔明分批調度兵馬</p><p>② 城中只剩文官和二千五百名士兵，司馬懿率十五萬大軍來攻</p></div>
        <div class="farrow">➜</div><div class="fcol c2"><h3>經過</h3><p><b>孔明：</b>命士兵打開四座城門、扮作百姓掃地；自己端坐城樓彈琴</p><p><b>司馬懿：</b>看到孔明彈琴、城門有人灑掃，覺得可疑，不敢攻城</p></div>
        <div class="farrow">➜</div><div class="fcol c3"><h3>結果</h3><p>① 司馬懿怕有埋伏，朝北方撤退</p><p>② 孔明早派兵在北方山路埋伏</p><p>③ 眾人佩服孔明神機妙算</p></div></div>
        <p class="quote">「${D.storyEnd}」</p><p class="lead">記住故事的順序，接下來的八個關卡都會用到喔！</p>`;
      } else {
        const s = D.story[page];
        inner.innerHTML = `<div class="story-top"><span class="phase ph-${s.phase}">${s.phase}</span><h2>${page + 1}. ${s.title}</h2></div><div class="story-img"><img src="${s.img}" alt=""></div><p class="story-text">${s.text}</p>`;
      }
      host.appendChild(inner);
      const nav = el('div', 'book-nav');
      const prev = el('button', 'btn', '◀ 上一頁'); prev.disabled = p === 0; prev.onclick = () => { p--; draw(); };
      const dots = el('div', 'dots', pages.map((_, i) => `<i class="${i === p ? 'on' : ''}"></i>`).join(''));
      const last = p === pages.length - 1;
      const next = el('button', 'btn gold', last ? (first ? '⚔ 出發冒險！' : '✔ 讀完了') : '下一頁 ▶');
      next.onclick = () => { if (!last) { p++; draw(); return; } if (first) { G.save.storyRead = true; G.writeSave(); UI.enterWorld(); } else { UI.closeModal(); G.state = prevState === 'modal' ? 'world' : prevState; } };
      nav.append(prev, dots, next); host.appendChild(nav);
      if (!first) { const x = el('button', 'close', '✕'); x.onclick = () => { UI.closeModal(); G.state = 'world'; }; host.appendChild(x); }
    };
    draw();
  };

  /* ================= 進入世界 ================= */
  UI.enterWorld = function () {
    screen(null); UI.closeModal();
    if (!G.player || G.player.ch.look !== G.save.look) G.buildPlayer();
    G.state = 'world'; G.camOverride = null; setHUD(true); G.refreshStations(); UI.updateMountBtn();
    $('#hName').textContent = G.save.name;
    try { $('#hAvatar').src = G.portrait(G.save.look, 'head', 160); } catch (e) { }
    const n = G.nextLevel();
    if (n) UI.toast(`🧭 跟著<b>金色足跡</b>前往 <b>第${n}關</b>！<br><small>${G.isTouch ? '左下搖桿或點地面移動、拖曳畫面轉視角，按「自動前往」直接出發' : 'WASD／方向鍵或滑鼠點地面移動、拖曳轉視角、E 互動、R 騎馬、N 自動前往'}</small>`, 5000);
    else if (!G.save.finaleDone) UI.runFinale(); else UI.toast('🎉 八關全破！可以到排行榜和證書看看成績。', 4000);
  };

  /* ================= HUD ================= */
  UI.updateHUD = function () {
    const total = G.totalScore(); $('#hScore').textContent = total;
    const done = D.levels.filter(l => G.isDone(l.id)).length; $('#hProg').textContent = `${done}/8`;
    const nav = $('#nav'); const ni = G.navInfo;
    if (ni) { nav.classList.remove('hidden'); $('#navName').textContent = ni.name; $('#navDist').textContent = Math.round(ni.dist) + ' 公尺'; $('#navArrow').style.transform = `rotate(${ni.angle}rad)`; }
    else nav.classList.add('hidden');
  };
  UI.setAction = function (st) {
    const b = $('#btnAct');
    if (!st) { b.classList.add('hidden'); return; }
    b.classList.remove('hidden');
    const lock = !G.unlocked(st.id); const done = G.isDone(st.id);
    b.innerHTML = lock ? `🔒 第${st.id}關（未解鎖）` : `${done ? '🔁 再挑戰' : '⚔ 開始'} 第${st.id}關：${st.lv.title}<small>${G.isTouch ? '' : '按 E'}</small>`;
    b.classList.toggle('locked', lock);
  };
  UI.action = function () {
    if (G.state !== 'world' || !G.near) return;
    const st = G.near; if (!G.unlocked(st.id)) { sfx('wrong'); UI.toast('🔒 先完成第 1～7 關，才能挑戰最後一關！'); return; }
    UI.startLevel(st.id);
  };
  UI.autoNext = function () {
    if (G.state === 'collect') { const t = G.navTarget(); if (t) G.setAuto(t.pos); return; }
    if (G.state !== 'world') return;
    if (G.auto) { G.stopAuto(); UI.toast('已停止自動前往'); return; }
    UI.showLevels(true);
  };
  UI.updateAutoBtn = function () { const b = $('#btnNav'); if (!b) return; b.innerHTML = G.auto ? '⏹<small>停止</small>' : '🧭<small>自動前往</small>'; b.classList.toggle('on', !!G.auto); };
  UI.confirmBox = function (msg, ok) {
    const box = UI.openModal('small'); box.innerHTML = `<h2>確認</h2><p class="lead">${msg}</p>`; const row = el('div', 'btn-row');
    const y = el('button', 'btn gold', '確定'); y.onclick = () => { UI.closeModal(); ok(); }; const n = el('button', 'btn', '取消'); n.onclick = () => UI.closeModal(); row.append(y, n); box.appendChild(row);
  };
  UI.collectHUD = function (on) {
    const c = $('#collectHud'); if (!on) { c.classList.add('hidden'); return; } const C = G.collect; c.classList.remove('hidden');
    c.innerHTML = `<b>${C.cfg.item === 'flag' ? '🚩' : '🌾'} ${C.name}</b>　${C.got}/${C.items.length}　⏱ ${Math.max(0, Math.ceil(C.time))} 秒`;
  };

  /* 小地圖 */
  UI.toggleMap = function () { $('#minimap').classList.toggle('big'); };
  UI.drawMinimap = function () {
    const cv = $('#minimap'); if (!cv || $('#hud').classList.contains('hidden')) return; const big = cv.classList.contains('big');
    const S = big ? 300 : 140; if (cv.width !== S * 2) { cv.width = S * 2; cv.height = S * 2; }
    const c = cv.getContext('2d'); const k = cv.width / 210; const X = (x) => (x + 105) * k, Z = (z) => (z + 105) * k;
    c.fillStyle = '#a8d48a'; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#5fb0e0'; c.fillRect(0, Z(40), cv.width, (47 - 40) * k);
    c.fillStyle = '#c9b48a'; for (const b of WORLD.BRIDGES) c.fillRect(X(b.x - 2.5), Z(38), 5 * k, 11 * k);
    c.fillStyle = '#e3a988'; c.fillRect(X(-31.5), Z(-31.5), 63 * k, 63 * k); c.fillStyle = '#efe6cf'; c.fillRect(X(-28.5), Z(-28.5), 57 * k, 57 * k);
    c.fillStyle = 'rgba(192,57,43,0.5)'; c.beginPath(); c.arc(X(58), Z(62), 16 * k, 0, 7); c.fill();
    c.fillStyle = 'rgba(90,63,138,0.5)'; c.beginPath(); c.arc(X(-82), Z(-6), 16 * k, 0, 7); c.fill();
    c.fillStyle = '#7f9a7a'; c.fillRect(0, 0, cv.width, Z(-92));
    c.font = `bold ${big ? 22 : 16}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#7a2a1a'; c.fillText('西城', X(0), Z(0)); if (big) { c.fillText('蜀營', X(58), Z(70)); c.fillText('魏營', X(-82), Z(-18)); c.fillText('北山', X(-35), Z(-88)); }
    for (const st of G.stations) {
      const col = st.status === 'done' ? '#2e9e57' : st.status === 'next' ? '#ffb300' : st.status === 'lock' ? '#888' : '#e0a040';
      const r = st.status === 'next' ? (8 + Math.sin(G.t * 6) * 2) : 7; c.fillStyle = col; c.beginPath(); c.arc(X(st.pos[0]), Z(st.pos[2]), r * (big ? 1.3 : 1), 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#fff'; c.font = `bold ${big ? 15 : 11}px sans-serif`; c.fillText(st.status === 'done' ? '✓' : st.id, X(st.pos[0]), Z(st.pos[2]) + 1);
    }
    const P = G.player; if (!P) return;
    if (G.navInfo) { const tgt = G.navTarget(); if (tgt) { const r = G.cachedRoute(P.pos, tgt.pos); c.strokeStyle = '#ffb300'; c.setLineDash([6, 5]); c.lineWidth = 3; c.beginPath(); c.moveTo(X(P.pos[0]), Z(P.pos[2])); for (const q of r) c.lineTo(X(q[0]), Z(q[1])); c.stroke(); c.setLineDash([]); } }
    if (G.collect) for (const it of G.collect.items) if (!it.taken) { c.fillStyle = '#ff5252'; c.beginPath(); c.arc(X(it.pos[0]), Z(it.pos[2]), 4, 0, 7); c.fill(); }
    c.save(); c.translate(X(P.pos[0]), Z(P.pos[2])); c.rotate(-P.yaw + PI); c.fillStyle = '#d32f2f'; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -10); c.lineTo(7, 8); c.lineTo(0, 4); c.lineTo(-7, 8); c.closePath(); c.fill(); c.stroke(); c.restore();
  };

  /* ================= 對話 ================= */
  UI.dialog = function (lines) {
    return new Promise((resolve) => {
      const prev = G.state; G.state = 'dialog'; let i = 0; const d = $('#dialog');
      const show = () => { const L = lines[i]; d.classList.remove('hidden'); $('#dlgImg').src = L.img || ''; $('#dlgImg').style.display = L.img ? '' : 'none'; $('#dlgName').textContent = L.who; type(L.text); };
      let timer = null, full = '';
      const type = (txt) => { full = txt; const t = $('#dlgText'); t.textContent = ''; let k = 0; clearInterval(timer); timer = setInterval(() => { k++; t.textContent = txt.slice(0, k); if (k % 3 === 0 && AUDIO.ctx) AUDIO.tone(600 + Math.random() * 200, 0.02, 0.04, 'triangle'); if (k >= txt.length) { clearInterval(timer); timer = null; } }, 32); };
      UI.dialogNext = () => { if (timer) { clearInterval(timer); timer = null; $('#dlgText').textContent = full; return; } i++; sfx('click'); if (i >= lines.length) { d.classList.add('hidden'); G.state = prev === 'dialog' ? 'modal' : prev; UI.dialogNext = () => { }; resolve(); } else show(); };
      show();
    });
  };
  UI.dialogNext = () => { };

  /* ================= 關卡流程 ================= */
  const ABORT = { abort: true };
  UI.exitLevel = function () { if (UI._abortFn) UI._abortFn(); };
  UI.startLevel = async function (id) {
    const lv = D.levels.find(l => l.id === id); const st = G.stations.find(s => s.id === id);
    let abortRej; const abortP = new Promise((_, rej) => { abortRej = rej; }); abortP.catch(() => { });
    UI._abortFn = () => abortRej(ABORT);
    const guard = (p) => Promise.race([p, abortP]);
    $('#exitLevel').classList.remove('hidden');
    try {
      G.state = 'modal'; $('#btnAct').classList.add('hidden'); $('#controls').classList.add('hidden'); $('#joy').classList.add('hidden');
      // 鏡頭轉向 NPC
      const P = G.player.pos; const lx = st.look[0], lz = st.look[1];
      const ang = Math.atan2(lx - P[0], lz - P[2]); G.player.yaw = ang; G.player.root.rot = [0, ang, 0];
      G.camOverride = { pos: [P[0] - Math.sin(ang) * 5.5 + Math.cos(ang) * 2.4, P[1] + 4.4, P[2] - Math.cos(ang) * 5.5 - Math.sin(ang) * 2.4], target: [P[0] + Math.sin(ang) * 3.5, P[1] + 1.3, P[2] + Math.cos(ang) * 3.5], speed: 3 };
      $('#nav').classList.add('hidden');
      sfx('drum');
      await guard(showLevelIntro(lv));
      await guard(UI.dialog(lv.dialog));
      let mini = 0; const m = lv.mini;
      if (m.type === 'collect') {
        await guard(infoCard(`🎮 小遊戲：${m.name}`, `${m.tip}<br>⏱ 限時 ${m.time} 秒，共 ${m.count} 個！`, '開始！'));
        G.camOverride = null; setHUD(true); $('#btnAct').classList.add('hidden');
        const r = await guard(G.startCollect(m)); mini = r.score;
        $('#controls').classList.add('hidden'); $('#joy').classList.add('hidden');
        await guard(infoCard(r.got >= r.total ? '🎉 全部收集完成！' : '⏱ 時間到！', `收集了 ${r.got} / ${r.total} 個，小遊戲得分 <b>${mini}</b> 分`, '進入問答 ➜'));
      } else {
        const box = UI.openModal('mg-modal'); if (m.type === 'rhythm' || m.type === 'simon') AUDIO.duck(true);
        mini = await guard(MINIGAMES[m.type](box, m)); AUDIO.duck(false);
        sfx('fanfare'); await guard(infoCard('🎉 小遊戲完成！', `小遊戲得分 <b>${mini}</b> / ${D.scoring.miniMax} 分`, '進入問答 ➜'));
      }
      const quiz = await guard(UI.runQuiz(lv));
      $('#exitLevel').classList.add('hidden'); UI._abortFn = null;
      await UI.showResult(lv, mini, quiz);
      G.camOverride = null; UI.closeModal();
      if (D.levels.every(l => G.isDone(l.id)) && !G.save.finaleDone) { UI.runFinale(); return; }
      G.state = 'world'; setHUD(true); G.near = null;
    } catch (e) {
      if (e !== ABORT) throw e;
      // 中途離開：清除畫面上的關卡內容，回到地圖
      UI.closeModal(); $('#dialog').classList.add('hidden'); UI.dialogNext = () => { };
      $('#banner').classList.add('hidden'); $('#banner').classList.remove('show');
      if (G.collect) { for (const it of G.collect.items) if (!it.taken) G.world.remove(it.node); G.collect = null; UI.collectHUD(false); }
      AUDIO.duck(false); G.camOverride = null; G.state = 'world'; setHUD(true); G.near = null; G.stopAuto && G.stopAuto();
      UI.toast(`已離開 第${id}關，隨時可以回來挑戰！`);
    } finally {
      $('#exitLevel').classList.add('hidden'); UI._abortFn = null;
    }
  };
  function showLevelIntro(lv) {
    return new Promise((res) => {
      const b = $('#banner'); b.innerHTML = `<div class="b-phase ph-${lv.phase}">${lv.phase}</div><div class="b-no">第 ${lv.id} 關</div><div class="b-title">${lv.title}</div><div class="b-place">📍 ${lv.place}</div>`;
      b.classList.remove('hidden'); b.classList.add('show'); setTimeout(() => { b.classList.remove('show'); setTimeout(() => { b.classList.add('hidden'); res(); }, 400); }, 1900);
    });
  }
  function infoCard(title, html, btn) {
    return new Promise((res) => { const box = UI.openModal('small'); box.innerHTML = `<h2>${title}</h2><p class="lead">${html}</p>`; const b = el('button', 'btn gold big', btn || '確定'); b.onclick = () => { sfx('click'); UI.closeModal(); res(); }; box.appendChild(b); });
  }
  UI.infoCard = infoCard;

  UI.runQuiz = function (lv) {
    return new Promise((resolve) => {
      const box = UI.openModal('quiz-modal'); let i = 0, score = 0; const S = D.scoring;
      const draw = () => {
        const q = lv.quiz[i]; let tries = 0; box.innerHTML = '';
        box.appendChild(el('div', 'q-head', `<span class="phase ph-${lv.phase}">第${lv.id}關</span> 智謀問答 ${i + 1} / ${lv.quiz.length}<span class="q-score">⭐ ${score}</span>`));
        box.appendChild(el('div', 'q-text', esc(q.q)));
        const opts = el('div', 'q-opts'); box.appendChild(opts); const fb = el('div', 'q-fb'); box.appendChild(fb);
        const order = q.options.map((t, k) => ({ t, k }));
        order.forEach(({ t, k }, n) => {
          const b = el('button', 'q-opt', `<b>${'ABCD'[n]}</b>${esc(t)}`);
          b.onclick = () => {
            if (b.disabled) return;
            if (k === q.answer) {
              const pts = tries === 0 ? S.quizFirst : S.quizSecond; score += pts; sfx('correct'); b.classList.add('ok');
              opts.querySelectorAll('.q-opt').forEach(x => x.disabled = true);
              fb.innerHTML = `<div class="ok">✔ 答對了！+${pts} 分</div><div class="ex">💡 ${esc(q.explain || '')}</div>`; nextBtn();
            } else {
              tries++; sfx('wrong'); b.classList.add('bad'); b.disabled = true;
              if (tries >= 2) { opts.querySelectorAll('.q-opt').forEach(x => x.disabled = true); opts.children[order.findIndex(o => o.k === q.answer)].classList.add('ok'); fb.innerHTML = `<div class="bad">正確答案是「${esc(q.options[q.answer])}」</div><div class="ex">💡 ${esc(q.explain || '')}</div>`; nextBtn(); }
              else fb.innerHTML = '<div class="bad">再想想看！（第二次答對可得部分分數）</div>';
            }
          };
          opts.appendChild(b);
        });
        const nextBtn = () => { const n = el('button', 'btn gold', i < lv.quiz.length - 1 ? '下一題 ▶' : '看成績 ▶'); n.onclick = () => { i++; if (i < lv.quiz.length) draw(); else resolve(score); }; fb.appendChild(n); };
      };
      draw();
    });
  };

  UI.showResult = function (lv, mini, quiz) {
    return new Promise((resolve) => {
      const total = mini + quiz; const max = D.scoring.miniMax + lv.quiz.length * D.scoring.quizFirst;
      const stars = total >= max * 0.9 ? 3 : total >= max * 0.65 ? 2 : 1;
      const old = G.save.levels[lv.id]; const best = !old || total > old.score;
      if (best) G.save.levels[lv.id] = { score: total, mini, quiz, stars, done: true, time: Date.now() };
      G.writeSave(); G.refreshStations();
      const story = D.story[lv.id - 1];
      const box = UI.openModal('result-modal'); sfx('fanfare');
      box.innerHTML = `<h2>🏯 第${lv.id}關「${lv.title}」完成！</h2>
        <div class="stars">${[1, 2, 3].map(k => `<span class="${k <= stars ? 'on' : ''}">★</span>`).join('')}</div>
        <div class="res-grid"><div>🎮 小遊戲<b>${mini}</b></div><div>📝 問答<b>${quiz}</b></div><div>🏅 本關<b>${total}</b><small>/ ${max}</small></div></div>
        ${!best ? `<p class="lead">（保留之前較高的成績 ${old.score} 分）</p>` : ''}
        <div class="unlock"><span class="phase ph-${story.phase}">劇情解鎖・${story.phase}</span><b>${story.title}</b><p>${story.text}</p></div>
        <p class="lead">目前總分：<b class="big-num">${G.totalScore()}</b> 分</p>`;
      const b = el('button', 'btn gold big', lv.id < 8 ? `🧭 前往下一關` : '🏯 進入終章：空城計之戰'); b.onclick = () => { sfx('click'); resolve(); }; box.appendChild(b);
      for (let k = 0; k < 4; k++) setTimeout(() => G.burst([G.player.pos[0], G.player.pos[1] + 3, G.player.pos[2]], [1, 0.8, 0.3], 30, 6), k * 250);
    });
  };

  /* ================= 關卡列表 ================= */
  UI.showLevels = function (auto) {
    if (G.state !== 'world') return; G.state = 'modal';
    const box = UI.openModal('levels-modal'); box.innerHTML = auto ? `<h2>🧭 要先去哪一關？</h2><p class="lead">前七關可以照自己喜歡的順序闖；七關都完成後，第八關才會開放。選好後英雄會自己走過去。</p>` : `<h2>🗺 八大關卡</h2><p class="lead">前七關可任意闖關，七關都完成才能挑戰第八關。點選關卡，英雄會自動走過去。</p>`;
    const list = el('div', 'lv-list');
    D.levels.forEach(lv => {
      const done = G.isDone(lv.id), open = G.unlocked(lv.id); const r = G.save.levels[lv.id];
      const b = el('button', 'lv-item' + (done ? ' done' : '') + (open ? '' : ' lock'), `<span class="phase ph-${lv.phase}">${lv.phase}</span><b>第${lv.id}關 ${lv.title}</b><small>📍${lv.place}・🎮${lv.mini.name}</small><em>${done ? '★'.repeat(r.stars) + ' ' + r.score + '分（可再挑戰）' : open ? '可挑戰' : '🔒 完成前七關後開放'}</em>`);
      b.onclick = () => { if (!open) { sfx('wrong'); UI.toast('🔒 先完成第 1～7 關，才能挑戰最後一關！'); return; } UI.closeModal(); G.state = 'world'; sfx('whoosh'); if (G.player.horse && !G.player.mounted) G.setMounted(true); G.setAuto(G.stations.find(s => s.id === lv.id).pos, { station: lv.id, start: true }); UI.toast(`🧭 自動前往 第${lv.id}關「${lv.title}」<br><small>移動搖桿或方向鍵即可取消</small>`, 3000); };
      list.appendChild(b);
    });
    box.appendChild(list);
    if (D.levels.every(l => G.isDone(l.id))) { const f = el('button', 'btn gold', '🏯 重看終章「空城計之戰」'); f.onclick = () => { UI.closeModal(); UI.runFinale(); }; box.appendChild(f); const c = el('button', 'btn', '📜 我的成就證書'); c.onclick = () => UI.showCertificate(); box.appendChild(c); }
    const x = el('button', 'close', '✕'); x.onclick = () => { UI.closeModal(); G.state = 'world'; }; box.appendChild(x);
  };

  /* ================= 選單 ================= */
  UI.showMenu = function () {
    if (G.state !== 'world') return; G.state = 'modal';
    const box = UI.openModal('small'); box.innerHTML = `<h2>⚙ 選單</h2>`;
    const add = (t, fn) => { const b = el('button', 'btn wide', t); b.onclick = fn; box.appendChild(b); };
    add('👘 修改人物造型（保留進度）', () => { UI.closeModal(); UI.showCreator(true); });
    add(AUDIO.sfx ? '🔔 音效：開' : '🔕 音效：關', () => { AUDIO.sfx = !AUDIO.sfx; UI.closeModal(); G.state = 'world'; UI.showMenu(); });
    add(G.uiNavDots === false ? '✨ 地面足跡：關' : '✨ 地面足跡：開', () => { G.uiNavDots = G.uiNavDots === false; UI.closeModal(); G.state = 'world'; UI.showMenu(); });
    add('❓ 操作說明', () => { UI.closeModal(); G.state = 'world'; UI.showHelp(); });
    if (D.levels.every(l => G.isDone(l.id))) add('📜 我的成就證書', () => UI.showCertificate());
    add('🏠 回到標題畫面', () => { UI.closeModal(); UI.showTitle(); });
    const x = el('button', 'close', '✕'); x.onclick = () => { UI.closeModal(); G.state = 'world'; }; box.appendChild(x);
  };
  UI.showHelp = function () {
    const prev = G.state; if (G.state === 'world') G.state = 'modal';
    const box = UI.openModal('small'); box.innerHTML = `<h2>❓ 怎麼玩</h2>
      <div class="help"><p>🎯 <b>目標</b>：前七關可以照自己喜歡的順序闖，七關都完成後挑戰第八關，最後迎接「空城計之戰」，拿到成就證書！闖關途中可按「✕ 離開關卡」先回地圖。</p><p>🎥 <b>視角</b>：左側「視角」按鈕可以放大縮小（＋－）、左右旋轉（⟲⟳）、俯視平視（▲▼）。</p>
      <p>🧭 <b>導航</b>：跟著地上的<b>金色足跡</b>和畫面上方的<b>指南針</b>走；按「自動前往」，英雄會自己走到下一關。右上角小地圖可點開放大。</p><p>👆 <b>點地面移動</b>：用滑鼠點一下或手指點一下地面，英雄就會走過去；點關卡光圈會走到那一關。</p>
      <p>💻 <b>電腦</b>：WASD／方向鍵移動、Shift 奔跑、滑鼠拖曳轉視角、滾輪縮放、E 互動、空白鍵跳躍、R 騎馬、N 自動前往。</p>
      <p>📱 <b>手機平板</b>：左下搖桿移動（推到底會奔跑）、單指拖曳畫面轉視角、雙指縮放，右下按鈕互動／跳躍／騎馬／自動前往。</p>
      <p>⭐ <b>計分</b>：每關小遊戲最高 ${D.scoring.miniMax} 分；每題第一次答對 ${D.scoring.quizFirst} 分、第二次答對 ${D.scoring.quizSecond} 分。八關滿分 800 分。</p></div>`;
    const b = el('button', 'btn gold', '我知道了'); b.onclick = () => { UI.closeModal(); if (prev === 'world') G.state = 'world'; }; box.appendChild(b);
  };

  /* ================= 終章：空城計之戰 ================= */
  UI.runFinale = async function () {
    G.state = 'finale'; setHUD(false); UI.closeModal(); $('#btnAct').classList.add('hidden');
    const cap = $('#caption'); const say = (t, who) => { cap.innerHTML = (who ? `<b>${who}</b>` : '') + t; cap.classList.remove('hidden'); };
    let skip = false; const sk = $('#skipBtn'); sk.classList.remove('hidden'); sk.onclick = () => { skip = true; };
    const wait = async (ms) => { const t0 = performance.now(); while (performance.now() - t0 < ms && !skip) await sleep(50); };
    const regs = G.finaleRegs; const HX = G.finaleHorse.root;
    // 佈置：魏軍方陣從西方行軍
    const formation = regs.map((r, i) => ({ r, x0: -100 - (i >> 1) * 9, z: ((i & 1) ? 6 : -6) + ((i >> 1) % 2 ? 3 : -3), x: 0 }));
    formation.forEach(f => { f.r.visible = true; f.x = f.x0; f.r.rot = [0, PI / 2, 0]; f.r.pos = [f.x, WORLD.ground(f.x, f.z), f.z]; });
    HX.visible = true; let hx = -90, hz = 0; HX.pos = [hx, 0, hz]; HX.rot = [0, PI / 2, 0];
    G.player.root.visible = false;
    let phase = 'march'; let bob = 0;
    G.finaleTick = (dt) => {
      bob += dt;
      for (const f of formation) {
        if (phase === 'march') { const stopX = -48 - (formation.indexOf(f) >> 1) * 9; if (f.x < stopX) f.x += dt * 9; f.r.rot[1] = PI / 2; }
        if (phase === 'retreat') { f.r.rot[1] = G.lerpAng(f.r.rot[1], Math.atan2(-35 - f.x, -80 - f.z), dt * 2); f.x += Math.sin(f.r.rot[1]) * dt * 11; f.z += Math.cos(f.r.rot[1]) * dt * 11; }
        f.r.pos = [f.x, WORLD.ground(f.x, f.z) + Math.abs(Math.sin(bob * 8 + f.x)) * 0.12, f.z];
      }
      if (phase === 'march') { if (hx < -40) hx += dt * 10; G.finaleHorse.animate(dt, hx < -40 ? 10 : 0); }
      else if (phase === 'retreat') { HX.rot[1] = G.lerpAng(HX.rot[1], Math.atan2(-35 - hx, -80 - hz), dt * 2.5); hx += Math.sin(HX.rot[1]) * dt * 13; hz += Math.cos(HX.rot[1]) * dt * 13; G.finaleHorse.animate(dt, 13); }
      else G.finaleHorse.animate(dt, 0);
      HX.pos = [hx, WORLD.ground(hx, hz), hz]; G.finaleRider.animate(dt, 0);
      if (phase === 'celebrate' && Math.random() < dt * 2.5) G.firework([-30 + (Math.random() - 0.5) * 40, 22 + Math.random() * 10, (Math.random() - 0.5) * 40]);
      if (Math.random() < dt * 10) G.particles.emit({ p: [G.qinPos[0] - 1, G.qinPos[1] + 1.2, G.qinPos[2] + (Math.random() - 0.5)], v: [-0.5, 0.8, (Math.random() - 0.5)], c: [1, 0.9, 0.5], s: 0.5, life: 2, max: 2, a: 0.8 });
    };
    const music = setInterval(() => { const n = AUDIO.PENTA; AUDIO.pluck(n[Math.floor(Math.random() * 5)] * (Math.random() < 0.3 ? 2 : 1), 0.25, 1.6); }, 520);
    // 鏡頭 1：大軍壓境
    G.camOverride = { pos: [-62, 14, 34], target: [-60, 2, 0], speed: 1.2, cut: true };
    say(D.finale[0]); AUDIO.sfxPlay('drum'); await wait(1200); G.camOverride = { pos: [-48, 16, 30], target: [-52, 2, -2], speed: 0.6 }; await wait(3800);
    // 鏡頭 2：孔明撫琴
    G.camOverride = { pos: [-36.2, 10.2, 7.4], target: [-30.4, 6.3, 6.4], speed: 1.0, cut: true };
    say(D.finale[1]); await wait(4200);
    // 鏡頭 3：司馬懿起疑
    G.camOverride = { pos: [-28.5, 10, 9], target: [-42, 2.2, 0], speed: 1.5, cut: true }; phase = 'stop';
    say(D.finale[2].replace(/^司馬懿：/, ''), '司馬懿：'); AUDIO.sfxPlay('drum'); await wait(4200);
    // 鏡頭 4：撤退
    phase = 'retreat'; G.camOverride = { pos: [-20, 22, 20], target: [-50, 0, -15], speed: 0.8, cut: true };
    say(D.finale[3]); await wait(4800);
    // 鏡頭 5：慶祝
    phase = 'celebrate'; G.npcs.forEach(n => { if (/villager|shuSoldier|shutong/.test(n.key) && !n.walk) n.cheer = true; });
    for (let i = 0; i < 4; i++) setTimeout(() => G.firework([-30 + (Math.random() - 0.5) * 30, 24, (Math.random() - 0.5) * 30]), i * 300);
    G.camOverride = { pos: [-52, 14, 26], target: [-30, 9, 0], speed: 0.5, cut: true };
    say(D.finale[4]); AUDIO.sfxPlay('fanfare'); await wait(5200);
    clearInterval(music); cap.classList.add('hidden'); sk.classList.add('hidden');
    formation.forEach(f => f.r.visible = false); HX.visible = false; G.player.root.visible = true; G.finaleTick = null;
    G.npcs.forEach(n => { if (n.cheer) { n.cheer = false; n.root.pos[1] = n.home[1]; } });
    G.save.finaleDone = true; G.writeSave();
    await UI.showFinalSummary();
  };

  UI.showFinalSummary = async function () {
    G.state = 'modal'; G.camOverride = { pos: [-44, 12, 20], target: [-30, 7, 2], speed: 0.4 };
    const total = G.totalScore(), title = G.rankTitle(total);
    const box = UI.openModal('result-modal');
    box.innerHTML = `<h2>🏯 恭喜完成〈空城計〉大冒險！</h2><p class="lead">${esc(G.save.name)}，你和孔明一起守住了西城縣！</p>
      <div class="final-score"><small>總分</small><b>${total}</b><small>/ 800</small></div><div class="rank">榮獲稱號：<b>「${title}」</b></div>
      <div class="lv-mini">${D.levels.map(l => { const r = G.save.levels[l.id]; return `<div><small>第${l.id}關</small>${l.title}<b>${r ? r.score : 0}</b></div>`; }).join('')}</div>
      <p class="lead" id="submitMsg">正在登錄排行榜……</p>`;
    const row = el('div', 'btn-row');
    const c = el('button', 'btn gold big', '📜 領取成就證書'); c.onclick = () => UI.showCertificate(); row.appendChild(c);
    const b = el('button', 'btn big', '🏆 看排行榜'); b.onclick = () => UI.showBoard(); row.appendChild(b);
    const w = el('button', 'btn', '🗺 回到地圖自由探索'); w.onclick = () => { UI.closeModal(); G.camOverride = null; G.state = 'world'; setHUD(true); }; row.appendChild(w);
    box.appendChild(row);
    const where = await LB.submit({ name: G.save.name, score: total, title, time: Date.now() });
    G.save.submitted = true; G.writeSave();
    const m = $('#submitMsg'); if (m) m.innerHTML = where === 'online' ? '✅ 已登錄到<b>網路排行榜</b>，大家都看得到！' : where === 'readonly' ? '✅ 已記錄在<b>本機排行榜</b>（這個帳號只能觀看網路排行榜）' : '✅ 已登錄到<b>本機排行榜</b>（紀錄保留 7 天）';
  };

  /* ================= 排行榜畫面 ================= */
  UI.showBoard = async function () {
    const prev = G.state; if (G.state === 'world') G.state = 'modal';
    const box = UI.openModal('board-modal');
    await LB.initCloud(); let mode = LB.hasOnline() ? 'online' : 'local';
    const draw = async () => {
      box.innerHTML = `<h2>🏆 空城計英雄榜</h2><p class="lead">前 ${TOP} 名・紀錄保留 ${CFG.keepDays || 7} 天後自動刪除，讓新英雄上榜！</p>`;
      const tabs = el('div', 'tabs2'); [['online', '🌐 網路排行榜'], ['local', '💻 本機排行榜']].forEach(([k, n]) => { const b = el('button', 'tab' + (mode === k ? ' on' : ''), n); b.onclick = () => { mode = k; draw(); }; tabs.appendChild(b); }); box.appendChild(tabs);
      const tb = el('div', 'board', '<p class="lead">讀取中……</p>'); box.appendChild(tb);
      const x = el('button', 'close', '✕'); x.onclick = () => { UI.closeModal(); if (prev !== 'title') UI.backToWorld(); }; box.appendChild(x);
      let rows = [];
      try { rows = mode === 'online' ? await LB.online() : LB.local(); }
      catch (e) { tb.innerHTML = `<p class="lead">⚠ ${esc((e && e.message) || '網路排行榜暫時無法讀取')}。目前先顯示本機紀錄。</p>`; if (mode === 'online') { rows = LB.local(); } else return; }
      const me = G.save ? G.save.name : null;
      const html = rows.length ? `<table><tr><th>名次</th><th>名稱</th><th>分數</th><th>稱號</th><th>日期</th></tr>${rows.map((r, i) => `<tr class="${r.name === me ? 'me' : ''} ${i < 3 ? 'top' + (i + 1) : ''}"><td>${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td><td>${esc(r.name)}</td><td><b>${r.score}</b></td><td>${esc(r.title || '')}</td><td>${new Date(r.time).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}</td></tr>`).join('')}</table>` : '<p class="lead">目前還沒有紀錄，快來當第一位英雄！</p>';
      if (mode === 'online' && tb.querySelector('p') && tb.textContent.includes('⚠')) tb.innerHTML += html; else tb.innerHTML = html;
    };
    draw();
  };

  /* ================= 證書 ================= */
  function loadImg(src) { return new Promise((res) => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
  UI.drawCertificate = async function (cv) {
    const W = 1600, H = 1131; cv.width = W; cv.height = H; const c = cv.getContext('2d');
    const E = window.EMBED || {};
    const KAI = '"Kaiti TC","BiauKai","STKaiti","DFKai-SB","標楷體","PingFang TC","Noto Serif CJK TC",serif';
    const total = G.totalScore(), title = G.rankTitle(total), name = G.save.name;
    const [bg, zg, me, horse] = await Promise.all([loadImg(E.bg), loadImg(E.zhuge), loadImg(G.portrait(G.save.look, 'body', 640)), loadImg(G.save.look.horse !== 'none' ? G.portrait(G.save.look, 'horse', 640) : null)]);
    // 背景
    if (bg) { const s = Math.max(W / bg.width, H / bg.height); c.drawImage(bg, (W - bg.width * s) / 2, (H - bg.height * s) / 2, bg.width * s, bg.height * s); }
    else { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#9fd0f0'); g.addColorStop(1, '#f6e7c1'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    // 外框
    c.fillStyle = 'rgba(120,20,16,0.92)'; c.fillRect(0, 0, W, 34); c.fillRect(0, H - 34, W, 34); c.fillRect(0, 0, 34, H); c.fillRect(W - 34, 0, 34, H);
    c.strokeStyle = '#f2c14e'; c.lineWidth = 6; c.strokeRect(40, 40, W - 80, H - 80); c.lineWidth = 2; c.strokeRect(52, 52, W - 104, H - 104);
    // 中央卷軸
    const px = 300, py = 120, pw = W - 600, ph = H - 230;
    c.save(); c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 30; c.fillStyle = '#fbf3df'; roundRect(c, px, py, pw, ph, 26); c.fill(); c.restore();
    const pg = c.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 700); pg.addColorStop(0, 'rgba(255,250,235,0)'); pg.addColorStop(1, 'rgba(210,170,110,0.35)'); c.fillStyle = pg; roundRect(c, px, py, pw, ph, 26); c.fill();
    c.strokeStyle = '#b8322a'; c.lineWidth = 5; roundRect(c, px + 16, py + 16, pw - 32, ph - 32, 18); c.stroke();
    c.strokeStyle = '#d9a441'; c.lineWidth = 2; roundRect(c, px + 26, py + 26, pw - 52, ph - 52, 14); c.stroke();
    // 回紋角飾
    const corner = (x, y, sx, sy) => { c.save(); c.translate(x, y); c.scale(sx, sy); c.strokeStyle = '#b8322a'; c.lineWidth = 5; c.beginPath(); c.moveTo(0, 60); c.lineTo(0, 0); c.lineTo(60, 0); c.moveTo(14, 46); c.lineTo(14, 14); c.lineTo(46, 14); c.lineTo(46, 34); c.lineTo(28, 34); c.stroke(); c.restore(); };
    corner(px + 38, py + 38, 1, 1); corner(px + pw - 38, py + 38, -1, 1); corner(px + 38, py + ph - 38, 1, -1); corner(px + pw - 38, py + ph - 38, -1, -1);
    // 卷軸軸頭
    for (const yy of [py - 10, py + ph - 10]) { const g = c.createLinearGradient(0, yy, 0, yy + 22); g.addColorStop(0, '#8a4a2a'); g.addColorStop(0.5, '#c07a4a'); g.addColorStop(1, '#6a3420'); c.fillStyle = g; roundRect(c, px - 30, yy, pw + 60, 22, 11); c.fill(); }
    // 人物
    if (horse) c.drawImage(horse, 10, H - 640, 560, 560); else if (me) c.drawImage(me, 30, H - 700, 520, 520);
    if (zg) c.drawImage(zg, W - 520, H - 690, 520, 520);
    // 文字
    c.textAlign = 'center'; c.fillStyle = '#7a1a12';
    c.font = `900 40px ${KAI}`; c.fillText('～ 三國空城計 3D 冒險 ～', W / 2, py + 95);
    c.font = `900 78px ${KAI}`; const tt = CFG.certificateTitle || '空城計 智謀大師 成就證書'; c.fillStyle = '#b8322a'; c.fillText(tt, W / 2, py + 190);
    c.fillStyle = '#3a2416'; c.font = `700 40px ${KAI}`; c.fillText('茲證明', W / 2, py + 270);
    c.font = `900 96px ${KAI}`; c.fillStyle = '#1f1410'; c.fillText(name, W / 2, py + 380);
    c.strokeStyle = '#d9a441'; c.lineWidth = 3; c.beginPath(); c.moveTo(W / 2 - 260, py + 405); c.lineTo(W / 2 + 260, py + 405); c.stroke();
    c.font = `700 36px ${KAI}`; c.fillStyle = '#3a2416';
    c.fillText('隨孔明登上西城城樓，以智慧與沉著完成八大關卡，', W / 2, py + 470);
    c.fillText('識破司馬懿的猜疑，成功守住西城縣，特頒此證。', W / 2, py + 522);
    // 分數徽章
    c.fillStyle = '#b8322a'; roundRect(c, W / 2 - 330, py + 560, 300, 130, 20); c.fill(); c.fillStyle = '#f2c14e'; roundRect(c, W / 2 + 30, py + 560, 300, 130, 20); c.fill();
    c.fillStyle = '#fff6d8'; c.font = `700 30px ${KAI}`; c.fillText('總分', W / 2 - 180, py + 600); c.font = `900 64px ${KAI}`; c.fillText(String(total), W / 2 - 180, py + 668);
    c.fillStyle = '#5a1a10'; c.font = `700 30px ${KAI}`; c.fillText('榮獲稱號', W / 2 + 180, py + 600); c.font = `900 52px ${KAI}`; c.fillText(title, W / 2 + 180, py + 664);
    c.font = `600 28px ${KAI}`; c.fillStyle = '#5a3a26';
    const d = new Date(); const dateStr = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
    c.fillText(`${CFG.schoolName ? CFG.schoolName + '・' : ''}${dateStr}`, W / 2, py + ph - 70);
    // 印章
    c.save(); c.translate(W / 2 + 330, py + ph - 150); c.rotate(-0.08); c.fillStyle = 'rgba(200,30,30,0.88)'; roundRect(c, -70, -70, 140, 140, 12); c.fill(); c.strokeStyle = '#fff1e0'; c.lineWidth = 5; roundRect(c, -60, -60, 120, 120, 8); c.stroke();
    c.fillStyle = '#fff1e0'; c.font = `900 50px ${KAI}`; c.fillText('丞相', 0, -8); c.fillText('之印', 0, 48); c.restore();
    c.textAlign = 'left'; c.fillStyle = '#fff6d8'; c.font = `700 22px ${KAI}`; c.fillText('知彼知己，百戰不殆', 70, 92);
    return cv;
  };
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  UI.showCertificate = async function () {
    const prev = G.state; G.state = 'modal';
    const box = UI.openModal('cert-modal'); box.innerHTML = '<h2>📜 成就證書</h2><p class="lead">繪製中……</p>';
    const cv = document.createElement('canvas'); await UI.drawCertificate(cv);
    box.innerHTML = '<h2>📜 成就證書</h2>'; const img = new Image(); img.className = 'cert-cv'; img.alt = '成就證書'; img.src = cv.toDataURL('image/png'); box.appendChild(img);
    const dlc = window.claude && window.claude.use ? await Promise.race([window.claude.use('downloads'), sleep(3000).then(() => null)]).catch(() => null) : null;
    const row = el('div', 'btn-row');
    const dl = el('button', 'btn gold big', '⬇ 下載證書 (PNG)');
    dl.onclick = () => {
      sfx('click'); const fname = `空城計證書_${G.save.name}.png`;
      if (dlc) { cv.toBlob((blob) => { dlc.save({ filename: fname, data: blob }).then(() => UI.toast('✅ 證書已下載')).catch(() => UI.toast('可以長按（或右鍵）證書圖片另存')); }, 'image/png'); return; }
      try {
        cv.toBlob((blob) => {
          const a = document.createElement('a'); a.download = fname; a.href = URL.createObjectURL(blob); document.body.appendChild(a); a.click();
          setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
        }, 'image/png');
      } catch (e) { const w = window.open(); if (w) w.document.write(`<img src="${cv.toDataURL()}" style="width:100%">`); }
    };
    row.appendChild(dl);
    const back = el('button', 'btn', '返回地圖'); back.onclick = () => { UI.closeModal(); UI.backToWorld(); }; row.appendChild(back);
    box.appendChild(row);
    box.appendChild(el('p', 'lead', G.isTouch ? '手機若無法直接下載，可長按證書圖片儲存。' : '也可以在證書圖片上按右鍵另存。'));
  };
  UI.backToWorld = function () { if (!G.player) { UI.showTitle(); return; } screen(null); G.camOverride = null; G.state = 'world'; setHUD(true); UI.updateMountBtn(); };
})();
