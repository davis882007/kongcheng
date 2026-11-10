/* =========================================================
   main.js — 遊戲核心：場景、玩家移動、鏡頭、關卡站點、導航、終章
   ========================================================= */
(function () {
  'use strict';
  const D = window.GAME_DATA, V = M3D.V, PI = Math.PI;
  const G = window.G = {
    state: 'loading', t: 0, dt: 0, sprites: [], npcs: [], stations: [], save: null,
    cam: { yaw: 0.7, pitch: 0.42, dist: 11, tYaw: 0.7, dragging: false },
    input: { keys: {}, jx: 0, jy: 0, run: false },
    player: null, camOverride: null, near: null, collect: null, renderMode: /render/.test(location.search)
  };
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  G.isTouch = isTouch;

  /* ---------- 存檔 ---------- */
  const SAVE_KEY = 'kongcheng_save_v1';
  G.loadSave = function () { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return s && s.name ? s : null; } catch (e) { return null; } };
  G.writeSave = function () { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.save)); } catch (e) { } };
  G.newSave = function (name, look) { G.save = { name, look, levels: {}, storyRead: false, finaleDone: false, created: Date.now() }; G.writeSave(); };
  G.totalScore = function () { let s = 0; for (const k in (G.save ? G.save.levels : {})) s += G.save.levels[k].score || 0; return s; };
  G.isDone = (id) => !!(G.save && G.save.levels[id] && G.save.levels[id].done);
  G.nextLevel = function () { for (const l of D.levels) if (!G.isDone(l.id) && G.unlocked(l.id)) return l.id; return null; };
  // 前七關可任意順序；第八關要前七關都完成
  G.firstSeven = () => D.levels.filter(l => l.id < 8).every(l => G.isDone(l.id));
  G.unlocked = (id) => id < 8 || G.isDone(id) || G.firstSeven();
  G.rankTitle = function (score) { for (const r of D.ranks) if (score >= r.min) return r.title; return D.ranks[D.ranks.length - 1].title; };

  /* ---------- 初始化 ---------- */
  function boot() {
    const canvas = document.getElementById('gl');
    try { G.R = new M3D.Renderer(canvas, { maxDPR: isTouch ? 1.5 : 2, preserve: G.renderMode }); }
    catch (e) { document.getElementById('loading').innerHTML = '<p>😢 這個瀏覽器不支援 3D（WebGL），請改用 Chrome 或 Safari 最新版。</p>'; return; }
    const R = G.R;
    // 手機瀏覽器（如 LINE、Safari）底部工具列可能蓋住畫面：用 visualViewport 量出可見高度
    const resize = () => {
      const vv = window.visualViewport; const h = vv ? Math.min(window.innerHeight, Math.round(vv.height)) : window.innerHeight;
      const gap = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
      document.documentElement.style.setProperty('--vb', gap + 'px');
      R.resize(window.innerWidth, h);
    };
    if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
    window.addEventListener('resize', resize); resize();
    // 文字貼圖
    const mk = (t, o) => R.texture(M3D.textCanvas(t, o));
    G.tex = {
      plaque: (t) => mk(t, { size: 64, bg: '#1f3a5a', border: '#f2c14e', color: '#f2c14e', pad: 16 }),
      flag: (c) => mk(c, { size: c.length > 1 ? 70 : 110, bg: false, color: '#fff8e0', stroke: 'rgba(0,0,0,0.25)' }),
      label: (t, col) => mk(t, { size: 44, bg: col || 'rgba(120,24,20,0.9)', border: '#f2c14e', color: '#fff6d8', pad: 14 })
    };
    G.world = WORLD.build(R, G.tex);
    G.particles = new M3D.Particles(2500);
    buildNPCs(); buildStations(); buildFinaleProps();
    G.creatorScene = buildCreatorScene();
    setupInput();
    G.portraitR = makePortraitRenderer();
    G.save = G.loadSave();
    document.getElementById('loading').classList.add('hidden');
    if (G.renderMode) { G.state = 'render'; return; }
    UI.init();
    UI.showTitle();
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; G.dt = dt; G.t += dt;
      try { update(dt); render(); } catch (e) { console.error(e); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  G.boot = boot;

  /* ---------- NPC ---------- */
  function addNPC(key, x, z, yaw, opt) {
    opt = opt || {}; const ch = MD.character(G.R, Object.assign({}, MD.NPC[key], opt.look || {}));
    const y = opt.y != null ? opt.y : WORLD.surfaceAt(x, z, 50);
    ch.root.pos = [x, y, z]; ch.root.rot = [0, yaw || 0, 0]; ch.baseYaw = yaw || 0; ch.key = key; ch.home = [x, y, z];
    if (opt.sitting) { ch.sitting = true; ch.root.pos[1] = y - 0.0; }
    G.world.add(ch.root); G.npcs.push(ch); ch.opt = opt;
    if (!opt.noCollide) WORLD.circle(x, z, 0.5, y + 2);
    return ch;
  }
  G.addNPC = addNPC;
  function buildNPCs() {
    const R = G.R, W = WORLD;
    const st = (id) => W.stations.find(s => s.id === id).pos;
    let p = st(1); G.npcZhuge1 = addNPC('zhuge', p[0] + 2.5, p[2] + 2.5, -2.4); addNPC('messenger', p[0] - 2.2, p[2] + 2.8, 2.4);
    addNPC('shuSoldier', 54, 58, 0.3); addNPC('shuSoldier', 63, 53, -0.8); addNPC('shuSoldier', 72, 74, PI);
    p = st(2); addNPC('shuSoldier', p[0] + 2.5, p[2] + 2.5, -2.4);
    p = st(3); addNPC('messenger', p[0] + 2.2, p[2] + 1.5, -2.2);
    p = st(4); addNPC('zhuge', p[0], p[2] - 3.2, 0); addNPC('shuSoldier', p[0] - 3, p[2] - 2, 0.4); addNPC('shuSoldier', p[0] + 3, p[2] - 2, -0.4);
    // 城樓：孔明撫琴、書僮
    const TY = W.towerTop; G.qinPos = [-30.95, TY, 6.4];
    const qin = new M3D.Node(MD.item(R, 'guqin')); qin.pos = [-30.95, TY, 6.4]; qin.rot = [0, PI / 2, 0]; G.world.add(qin);
    const cen = new M3D.Node(MD.item(R, 'censer')); cen.pos = [-31.0, TY + 0.06, 8.0]; G.world.add(cen); G.censerPos = [-31.0, TY + 0.7, 8.0];
    const cush = new M3D.Builder(); cush.cyl(0.45, 0.5, 0.2, 12, '#c0392b', { p: [0, 0.1, 0] }); cush.torus(0.46, 0.04, '#f2c14e', { p: [0, 0.2, 0] }, 12, 4);
    const cn = new M3D.Node(cush.build(R)); cn.pos = [-29.95, TY, 6.4]; G.world.add(cn);
    G.towerZhuge = addNPC('zhuge', -29.95, 6.4, -PI / 2, { y: TY + 0.15, sitting: true, noCollide: true });
    WORLD.solid(-31.5, -29.4, 5.4, 7.4, TY + 1.4, TY - 0.3);
    addNPC('shutong', -30.3, 4.9, -PI / 2, { y: TY }); addNPC('shutong2', -30.3, 7.9 + 0.3, -PI / 2, { y: TY });
    // 城門百姓
    addNPC('villager', -33.5, 2, PI / 2); addNPC('villagerF', -34, -2.2, PI / 2); addNPC('villager', -25, -1.5, -PI / 2);
    addNPC('villager', 2, 33, PI); addNPC('villagerF', -2.5, 26, 0); addNPC('villager', 2, -33, 0); addNPC('villagerF', 33, 2, -PI / 2);
    addNPC('villagerF', -11, 1.5, 0.5); addNPC('villager', -17, 1.6, -0.3);
    // 魏營
    p = st(6); G.simayi = addNPC('simayi', p[0] - 3, p[2] - 1.5, PI / 2); addNPC('simazhao', p[0] - 3, p[2] + 1.8, PI / 2 + 0.3);
    addNPC('weiSoldier', p[0] - 6, p[2] - 4, PI / 2); addNPC('weiSoldier', p[0] - 6, p[2] + 4, PI / 2);
    // 北山
    p = st(7); addNPC('guanxing', p[0] - 2.5, p[2] - 2.5, 0.4); addNPC('zhangbao', p[0] + 2.5, p[2] - 2.5, -0.4);
    addNPC('shuSoldier', p[0] - 6, p[2] - 6, 0.3); addNPC('shuSoldier', p[0] + 6, p[2] - 6, -0.3);
    // 書院
    p = st(8); addNPC('teacher', p[0], p[2] - 3, 0);
    addNPC('shutong', p[0] + 3.2, p[2] - 1.8, -0.6, { look: { weapon: 'none', acc: 'scroll' } });
    // 巡邏百姓（會走動）
    G.walkers = [];
    const walker = (key, a, b) => { const c = addNPC(key, a[0], a[1], 0, { noCollide: true }); c.walk = { a, b, t: Math.random() }; G.walkers.push(c); };
    walker('villager', [-20, 1.5], [20, 1.5]); walker('villagerF', [1.5, -20], [1.5, 22]); walker('shuSoldier', [-2, 36], [-2, 52]); walker('villagerF', [-14, -6], [-14, 8]);
  }

  /* ---------- 關卡站點 ---------- */
  function buildStations() {
    const R = G.R;
    for (const s of WORLD.stations) {
      const lv = D.levels.find(l => l.id === s.id);
      const node = new M3D.Node(); node.pos = s.pos.slice(); G.world.add(node);
      const rb = new M3D.Builder(); rb.torus(2.2, 0.12, '#ffffff', { p: [0, 0.15, 0] }, 32, 6); rb.torus(1.6, 0.06, '#ffffff', { p: [0, 0.12, 0] }, 28, 5);
      for (let i = 0; i < 8; i++) { const a = i * PI / 4; rb.box(0.3, 0.05, 0.3, '#ffffff', { p: [Math.cos(a) * 1.9, 0.15, Math.sin(a) * 1.9], r: [0, a + PI / 4, 0] }); }
      const ring = new M3D.Node(rb.build(R)); ring.unlit = true; node.add(ring);
      const bb = new M3D.Builder(); bb.cyl(1.4, 1.8, 40, 16, '#ffe9a0', { p: [0, 20, 0] }, false);
      const beam = new M3D.Node(bb.build(R)); beam.unlit = true; beam.alpha = 0.22; beam.noCull = true; node.add(beam);
      const tok = new M3D.Builder(); tok.lathe([[0, -0.6], [0.45, 0], [0, 0.6]], 6, '#ffd54a', {}, { flat: true });
      const token = new M3D.Node(tok.build(R)); token.pos = [0, 3.4, 0]; token.unlit = false; node.add(token);
      const label = { pos: [s.pos[0], s.pos[1] + 4.6, s.pos[2]], size: [0, 0], tex: null, alpha: 1 };
      const st = { id: s.id, pos: s.pos, look: s.look, node, ring, beam, token, label, lv, status: '' };
      G.stations.push(st); G.sprites.push(label);
    }
    G.refreshStations();
  }
  G.refreshStations = function () {
    const next = G.save ? G.nextLevel() : 1;
    for (const st of G.stations) {
      const done = G.isDone(st.id), open = G.unlocked(st.id);
      const status = done ? 'done' : (st.id === next ? 'next' : (open ? 'open' : 'lock'));
      if (status === st.status && st.label.tex) continue; st.status = status;
      const col = status === 'done' ? [0.45, 0.9, 0.55] : status === 'next' ? [1, 0.82, 0.3] : status === 'open' ? [1, 0.9, 0.6] : [0.6, 0.6, 0.65];
      st.ring.tint = col; st.token.tint = col; st.beam.visible = status === 'next'; st.beam.tint = col;
      const txt = `${done ? '✔ ' : status === 'lock' ? '🔒 ' : ''}第${st.id}關 ${st.lv.title}`;
      const cv = M3D.textCanvas(txt, { size: 44, bg: status === 'done' ? 'rgba(30,110,60,0.9)' : status === 'lock' ? 'rgba(70,70,80,0.85)' : 'rgba(150,30,24,0.92)', border: '#f2c14e', pad: 14 });
      st.label.tex = G.R.texture(cv); st.label.size = [cv.width / cv.height * 1.1, 1.1];
    }
  };

  /* ---------- 終章道具：魏軍方陣、司馬懿騎馬 ---------- */
  function buildFinaleProps() {
    G.finaleRegs = [];
    for (let i = 0; i < 8; i++) {
      const rg = WORLD.regiment(G.R, 4, 6, i % 2 ? '#7a6a9a' : '#6a7aa0', i % 2 ? '#8a4fc8' : '#5a6ad8', '#5a3f8a', G.tex.flag('魏'));
      rg.visible = false; G.world.add(rg); G.finaleRegs.push(rg);
    }
    G.finaleHorse = MD.horse(G.R, 'jueying'); G.finaleHorse.root.visible = false; G.world.add(G.finaleHorse.root);
    G.finaleRider = MD.character(G.R, MD.NPC.simayi); G.finaleRider.riding = true; G.finaleRider.root.pos = [0, 1.05, -0.05]; G.finaleHorse.root.add(G.finaleRider.root);
  }

  /* ---------- 捏角場景 ---------- */
  function buildCreatorScene() {
    const R = G.R; const root = new M3D.Node();
    const b = new M3D.Builder();
    b.cyl(3.2, 3.4, 0.5, 32, '#b8322a', { p: [0, 0.25, 0] }); b.cyl(3.0, 3.0, 0.52, 32, '#d9483a', { p: [0, 0.27, 0] }); b.torus(3.25, 0.08, '#f2c14e', { p: [0, 0.5, 0] }, 40, 5);
    b.cyl(22, 22, 0.1, 40, '#f1e4c8', { p: [0, -0.05, 0] });
    for (let i = 0; i < 6; i++) { const a = PI + (i - 2.5) * 0.45; const x = Math.cos(a) * 9, z = Math.sin(a) * 9 - 2; b.cyl(0.25, 0.25, 6, 8, '#9b2f25', { p: [x, 3, z] }); b.sphere(0.5, '#e8392b', { p: [x, 5.2, z + 0.6], s: [1, 0.85, 1] }, 10, 7); }
    b.box(18, 7, 0.4, '#2f4f6a', { p: [0, 3.5, -8] }); b.box(18.4, 0.5, 0.6, '#f2c14e', { p: [0, 7, -8] });
    b.roof(20, 3, 1.4, '#3d4b5c', { p: [0, 7.2, -8] });
    const n = new M3D.Node(b.build(R)); root.add(n);
    const tq = new M3D.Node(); tq.tq = { tex: G.tex.flag('三國英雄'), w: 6, h: 1.6 }; tq.pos = [0, 5.6, -7.75]; root.add(tq);
    const holder = new M3D.Node(); holder.pos = [0, 0.5, 0]; root.add(holder); G.creatorHolder = holder;
    return root;
  }
  G.rebuildCreatorModel = function (look) {
    const h = G.creatorHolder; h.children.slice().forEach(c => h.remove(c));
    const ch = MD.character(G.R, look); ch.root.pos = [-0.9, 0, 0]; h.add(ch.root); G.creatorChar = ch;
    G.creatorHorse = null;
    if (look.horse && look.horse !== 'none') { const hz = MD.horse(G.R, look.horse); hz.root.pos = [1.3, 0, -0.4]; hz.root.rot = [0, -0.6, 0]; hz.root.scl = [0.85, 0.85, 0.85]; h.add(hz.root); G.creatorHorse = hz; }
  };

  /* ---------- 玩家 ---------- */
  G.buildPlayer = function () {
    if (G.player) G.world.remove(G.player.root);
    const look = G.save.look; const root = new M3D.Node();
    const ch = MD.character(G.R, look); root.add(ch.root);
    let horse = null; if (look.horse && look.horse !== 'none') { horse = MD.horse(G.R, look.horse); root.add(horse.root); }
    const sh = new M3D.Builder(); sh.cyl(0.7, 0.7, 0.02, 16, '#000000', { p: [0, 0.03, 0] }); const shadow = new M3D.Node(sh.build(G.R)); shadow.alpha = 0.22; shadow.unlit = true; root.add(shadow);
    const p = G.player ? G.player.pos : WORLD.spawn.slice();
    G.player = { root, ch, horse, shadow, pos: p, vy: 0, yaw: G.player ? G.player.yaw : -2.4, mounted: false, speed: 0 };
    G.world.add(root); G.setMounted(false);
    G.player.pos[1] = WORLD.surfaceAt(p[0], p[2], (p[1] || 0) + 0.5);
  };
  G.setMounted = function (m) {
    const P = G.player; if (!P) return; if (!P.horse) m = false;
    P.mounted = m; P.ch.riding = m;
    if (P.horse) P.horse.root.visible = m;
    P.ch.root.pos = m ? [0, 1.05, -0.05] : [0, 0, 0];
    P.shadow.scl = m ? [1.3, 1, 2.0] : [1, 1, 1];
    UI.updateMountBtn && UI.updateMountBtn();
  };

  /* ---------- 輸入 ---------- */
  function setupInput() {
    const K = G.input.keys; const cv = G.R.canvas;
    window.addEventListener('keydown', (e) => {
      if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
      K[e.key.toLowerCase()] = true;
      if (G.state === 'world' || G.state === 'collect') {
        if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') { UI.action(); }
        if (e.key === ' ') { e.preventDefault(); G.jump(); }
        if (e.key === 'r' || e.key === 'R') G.setMounted(!G.player.mounted);
        if (e.key === 'n' || e.key === 'N') UI.autoNext();
        if (e.key === 'm' || e.key === 'M') UI.toggleMap && UI.toggleMap();
      }
      if (G.state === 'dialog' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); UI.dialogNext(); }
    });
    window.addEventListener('keyup', (e) => { K[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { for (const k in K) K[k] = false; });
    // 鏡頭拖曳
    let drag = null; const pts = new Map();
    cv.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); drag = { x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now(), moved: 0 }; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return; const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) { const a = [...pts.values()]; const d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); if (G._pinch) G.cam.dist = Math.max(5, Math.min(32, G.cam.dist * G._pinch / d)); G._pinch = d; return; }
      const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
      if (drag && drag.id === e.pointerId) drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag && drag.moved < 8) return;
      if (G.state === 'creator') { G.creatorSpin = (G.creatorSpin || 0) + dx * 0.01; return; }
      G.cam.yaw -= dx * 0.006; G.cam.pitch = Math.max(0.08, Math.min(1.25, G.cam.pitch + dy * 0.004)); G.cam.dragT = 1.2;
    });
    const up = (e) => {
      const wasPinch = pts.size > 1; pts.delete(e.pointerId); G._pinch = null;
      if (e.type === 'pointerup' && drag && drag.id === e.pointerId && !wasPinch && drag.moved < 8 && performance.now() - drag.t < 600 && (G.state === 'world' || G.state === 'collect')) G.tapMove(e.clientX, e.clientY);
      if (drag && drag.id === e.pointerId) drag = null;
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => { e.preventDefault(); G.cam.dist = Math.max(5, Math.min(32, G.cam.dist * (1 + Math.sign(e.deltaY) * 0.1))); }, { passive: false });
    // 虛擬搖桿
    const joy = document.getElementById('joy'), knob = document.getElementById('joyKnob');
    let jid = null, jc = null;
    const jmove = (x, y) => { const r = 50; let dx = x - jc[0], dy = y - jc[1]; const l = Math.hypot(dx, dy); if (l > r) { dx *= r / l; dy *= r / l; } knob.style.transform = `translate(${dx}px,${dy}px)`; G.input.jx = dx / r; G.input.jy = -dy / r; G.input.run = l > r * 0.95; };
    joy.addEventListener('pointerdown', (e) => { e.preventDefault(); jid = e.pointerId; const b = joy.getBoundingClientRect(); jc = [b.left + b.width / 2, b.top + b.height / 2]; joy.setPointerCapture(e.pointerId); jmove(e.clientX, e.clientY); });
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === jid) jmove(e.clientX, e.clientY); });
    const jend = (e) => { if (e.pointerId !== jid) return; jid = null; knob.style.transform = ''; G.input.jx = 0; G.input.jy = 0; G.input.run = false; };
    joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
  }
  G.jump = function () { const P = G.player; if (!P) return; const gh = WORLD.surfaceAt(P.pos[0], P.pos[2], P.pos[1]); if (P.pos[1] - gh < 0.05) P.vy = P.mounted ? 9 : 8; };

  /* ---------- 更新 ---------- */
  function update(dt) {
    G.particles.update(dt);
    // 環境動畫
    WORLD.clouds.children.forEach((c, i) => { c.pos[0] += dt * (1 + i % 3); if (c.pos[0] > 230) c.pos[0] = -230; });
    WORLD.water.pos[1] = Math.sin(G.t * 1.2) * 0.04;
    for (const d of WORLD.dyn) if (d.type === 'flag') d.node.rot[1] = Math.sin(G.t * 1.5 + d.node.pos[0]) * 0.15;
    // NPC
    for (const n of G.npcs) {
      if (n.walk) { const w = n.walk; w.t += dt * 0.05; const k = (Math.sin(w.t * PI * 2) + 1) / 2; const x = w.a[0] + (w.b[0] - w.a[0]) * k, z = w.a[1] + (w.b[1] - w.a[1]) * k; const dx = x - n.root.pos[0], dz = z - n.root.pos[2]; const sp = Math.hypot(dx, dz) / dt; if (sp > 0.05) n.root.rot[1] = Math.atan2(dx, dz); n.root.pos = [x, WORLD.surfaceAt(x, z, 2), z]; n.animate(dt, sp); continue; }
      let face = false;
      if (G.player && !n.sitting && !n.walk) { const d = Math.hypot(G.player.pos[0] - n.root.pos[0], G.player.pos[2] - n.root.pos[2]); if (d < 5 && Math.abs(G.player.pos[1] - n.root.pos[1]) < 2) { const ty = Math.atan2(G.player.pos[0] - n.root.pos[0], G.player.pos[2] - n.root.pos[2]); n.root.rot[1] = lerpAng(n.root.rot[1], ty, dt * 4); face = true; } }
      if (!face && !n.sitting) n.root.rot[1] = lerpAng(n.root.rot[1], n.baseYaw, dt * 2);
      if (n.cheer) { n.root.pos[1] = n.home[1] + Math.abs(Math.sin(G.t * 6 + n.home[0])) * 0.6; }
      n.animate(dt, 0);
    }
    // 站點
    const next = G.save ? G.nextLevel() : null;
    for (const st of G.stations) {
      st.ring.rot[1] += dt * 0.6; st.token.rot[1] += dt * 2; st.token.pos[1] = 3.4 + Math.sin(G.t * 2 + st.id) * 0.25;
      st.beam.alpha = 0.16 + Math.sin(G.t * 3) * 0.06; st.ring.flash = st.status === 'next' ? 0.15 + Math.sin(G.t * 4) * 0.15 : 0;
      st.label.pos[1] = st.pos[1] + 4.6 + Math.sin(G.t * 2 + st.id) * 0.12;
    }
    // 環境粒子：香煙、營火、烽火、落花
    if (Math.random() < dt * 8) G.particles.emit({ p: [G.censerPos[0] + (Math.random() - 0.5) * 0.1, G.censerPos[1], G.censerPos[2]], v: [(Math.random() - 0.5) * 0.2, 0.6, (Math.random() - 0.5) * 0.2], c: [0.9, 0.9, 0.95], s: 0.5, life: 3, max: 3, shrink: false, a: 0.35 });
    if (Math.random() < dt * 25) { const f = WORLD.campfire; G.particles.emit({ p: [f[0] + (Math.random() - 0.5) * 0.8, f[1], f[2] + (Math.random() - 0.5) * 0.8], v: [0, 1.5 + Math.random(), 0], c: [1, 0.5 + Math.random() * 0.3, 0.1], s: 0.7, life: 0.8, max: 0.8, shrink: true }); }
    if (G.isDone(3) || G.state === 'finale') { if (Math.random() < dt * 30) { const f = WORLD.beaconFire; G.particles.emit({ p: [f[0] + (Math.random() - 0.5), f[1], f[2] + (Math.random() - 0.5)], v: [0, 2 + Math.random() * 1.5, 0], c: [1, 0.45 + Math.random() * 0.3, 0.1], s: 1.1, life: 1, max: 1, shrink: true }); }
      if (Math.random() < dt * 6) { const f = WORLD.beaconFire; G.particles.emit({ p: [f[0], f[1] + 2, f[2]], v: [0.5, 2.5, 0.2], c: [0.6, 0.6, 0.62], s: 2.2, life: 4, max: 4, a: 0.3 }); } }
    if (G.player && Math.random() < dt * 6) { const p = G.player.pos; G.particles.emit({ p: [p[0] + (Math.random() - 0.5) * 30, p[1] + 8 + Math.random() * 4, p[2] + (Math.random() - 0.5) * 30], v: [0.6, -0.8, 0.3], c: [1, 0.72, 0.82], s: 0.35, life: 9, max: 9, a: 0.9 }); }

    if (G.state === 'world' || G.state === 'collect') updatePlayer(dt);
    else if (G.player) { G.player.ch.animate(dt, 0); if (G.player.horse) G.player.horse.animate(dt, 0); }
    if (G.state === 'collect') updateCollect(dt);
    if (G.auto && (G.state === 'world' || G.state === 'collect')) { const a = G.auto.pos; for (let i = 0; i < 2; i++) { const ang = G.t * 3 + i * PI; G.particles.emit({ p: [a[0] + Math.cos(ang) * 0.9, a[1] + 0.2, a[2] + Math.sin(ang) * 0.9], v: [0, 0.6, 0], c: [0.4, 0.9, 1], s: 0.5, life: 0.6, max: 0.6, shrink: true }); } }
    if (G.state === 'finale' && G.finaleTick) G.finaleTick(dt);
    if (G.state === 'creator') { if (G.creatorChar) G.creatorChar.animate(dt, 0); if (G.creatorHorse) G.creatorHorse.animate(dt, 0); G.creatorHolder.rot[1] = 0;
      if (!G.creatorPause) G.creatorAngle = (G.creatorAngle || 0) + dt * 0.9;
      const ang = (G.creatorAngle || 0) + (G.creatorSpin || 0);
      if (G.creatorChar) G.creatorChar.root.rot = [0, ang, 0];
      if (G.creatorHorse) G.creatorHorse.root.rot = [0, -0.6 + ang * 0.5, 0]; }
    updateCamera(dt);
    if (G.state === 'world' || G.state === 'collect') { updateNav(dt); UI.updateHUD(); }
  }
  function lerpAng(a, b, t) { let d = ((b - a + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI; return a + d * Math.min(1, t); }
  G.lerpAng = lerpAng;

  /* 自動前往（點地面或按「自動前往」） */
  G.setAuto = function (pos, opt) {
    opt = opt || {}; G.auto = { pos: pos.slice(), station: opt.station || null, start: !!opt.start, last: null, stuckT: 0, side: 0, sideT: 0, t: 0 };
    G._rc = null; UI.updateAutoBtn && UI.updateAutoBtn();
  };
  G.stopAuto = function () { if (!G.auto) return; G.auto = null; UI.updateAutoBtn && UI.updateAutoBtn(); };
  function autoStep(dt, P) {
    const A = G.auto; if (!A) return null;
    A.t += dt;
    const route = G.cachedRoute(P.pos, A.pos); const q = route[0] || [A.pos[0], A.pos[2]];
    const dFin = Math.hypot(A.pos[0] - P.pos[0], A.pos[2] - P.pos[2]);
    const arrived = A.station ? (G.near && G.near.id === A.station) : (dFin < 1.0 && Math.abs(A.pos[1] - P.pos[1]) < 2.5);
    if (arrived) { const st = A.station, go = A.start; G.stopAuto(); if (st && go) setTimeout(() => { if (G.state === 'world' && G.near && G.near.id === st) UI.action(); }, 250); else if (st) UI.toast('已抵達，按「開始」挑戰！'); return null; }
    let dx = q[0] - P.pos[0], dz = q[1] - P.pos[2]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    // 卡住偵測：1.2 秒內幾乎沒前進就側移一下並跳一下
    A.stuckT += dt;
    if (A.stuckT > 1.2) { const moved = A.last ? Math.hypot(P.pos[0] - A.last[0], P.pos[2] - A.last[2]) : 9; A.last = P.pos.slice(); A.stuckT = 0; if (moved < 0.6) { A.side = Math.random() < 0.5 ? 1 : -1; A.sideT = 0.7; G._rc = null; G.jump(); } }
    if (A.sideT > 0) { A.sideT -= dt; const sx = -dz * A.side, sz = dx * A.side; dx = dx * 0.3 + sx; dz = dz * 0.3 + sz; const l2 = Math.hypot(dx, dz) || 1; dx /= l2; dz /= l2; }
    return [dx, dz];
  }
  // 螢幕座標 → 地面座標
  G.screenToGround = function (cx, cy) {
    const R = G.R, v = R.view, c = R.canvas, pr = R.pixelRatio;
    const x = (cx / (c.width / pr)) * 2 - 1, y = 1 - (cy / (c.height / pr)) * 2;
    const th = Math.tan(R.cam.fov / 2), asp = c.width / c.height;
    const right = [v[0], v[4], v[8]], up = [v[1], v[5], v[9]], back = [v[2], v[6], v[10]];
    const d = V.norm([-back[0] + right[0] * x * th * asp + up[0] * y * th, -back[1] + right[1] * x * th * asp + up[1] * y * th, -back[2] + right[2] * x * th * asp + up[2] * y * th]);
    const o = R.cam.pos; let prev = 0;
    for (let t = 0.5; t < 260; t += t < 40 ? 0.35 : 1) {
      const p = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
      if (Math.abs(p[0]) > 99 || Math.abs(p[2]) > 99) return null;
      const h = WORLD.surfaceAt(p[0], p[2], p[1]);
      if (p[1] <= h) { return [p[0], h, p[2]]; }
      prev = t;
    }
    return null;
  };
  G.tapMove = function (cx, cy) {
    if (!G.player) return; const g = G.screenToGround(cx, cy); if (!g) return;
    // 點到關卡光圈附近就走去那一關
    let st = null; for (const s of G.stations) if (Math.hypot(s.pos[0] - g[0], s.pos[2] - g[2]) < 3 && Math.abs(s.pos[1] - g[1]) < 3) st = s;
    if (st) G.setAuto(st.pos, { station: st.id, start: false }); else G.setAuto(g);
    G.tapMark = { p: g, t: 0 };
    AUDIO.sfxPlay('click');
  };
  function updatePlayer(dt) {
    const P = G.player, K = G.input.keys, I = G.input;
    let ix = I.jx, iy = I.jy;
    if (K['w'] || K['arrowup']) iy += 1; if (K['s'] || K['arrowdown']) iy -= 1; if (K['a'] || K['arrowleft']) ix -= 1; if (K['d'] || K['arrowright']) ix += 1;
    let mag = Math.min(1, Math.hypot(ix, iy));
    if (mag > 0.15 && G.auto) G.stopAuto();
    const yaw = G.cam.yaw; const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    let dx = rx * ix + fx * iy, dz = rz * ix + fz * iy; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    let run = K['shift'] || I.run;
    if (G.auto && mag <= 0.15) { const a = autoStep(dt, P); if (a) { dx = a[0]; dz = a[1]; mag = 1; run = true; iy = 1; } }
    const spd = (P.mounted ? 14 : (run ? 9.5 : 6.5)) * mag;
    let moved = 0;
    if (mag > 0.05) {
      P.yaw = lerpAng(P.yaw, Math.atan2(dx, dz), dt * 10);
      const r = P.mounted ? 0.8 : 0.45; const nx = P.pos[0] + dx * spd * dt, nz = P.pos[2] + dz * spd * dt;
      if (!WORLD.blocked(nx, P.pos[2], P.pos[1], r)) { P.pos[0] = nx; moved += Math.abs(dx); }
      if (!WORLD.blocked(P.pos[0], nz, P.pos[1], r)) { P.pos[2] = nz; moved += Math.abs(dz); }
    }
    // 重力與地面
    const gh = WORLD.surfaceAt(P.pos[0], P.pos[2], P.pos[1]);
    if (P.vy > 0 || P.pos[1] > gh + 0.3) { P.vy -= 26 * dt; P.pos[1] += P.vy * dt; if (P.pos[1] <= gh) { P.pos[1] = gh; P.vy = 0; } }
    else { P.pos[1] = gh; P.vy = 0; }
    P.speed = moved > 0 ? spd : 0;
    P.root.pos = P.pos.slice(); P.root.rot = [0, P.yaw, 0];
    P.ch.animate(dt, P.speed);
    if (P.mounted) P.horse.animate(dt, P.speed);
    // 鏡頭自動跟隨
    if (G.cam.dragT > 0) G.cam.dragT -= dt;
    else if (P.speed > 0.5 && iy > -0.3) G.cam.yaw = lerpAng(G.cam.yaw, P.yaw + PI, dt * 0.9);
    // 互動偵測
    let near = null, nd = 1e9;
    for (const st of G.stations) { const d = Math.hypot(st.pos[0] - P.pos[0], st.pos[2] - P.pos[2]); if (d < 3.6 && Math.abs(st.pos[1] - P.pos[1]) < 2.2 && d < nd) { near = st; nd = d; } }
    if (G.state === 'collect') near = null;
    if (near !== G.near) { G.near = near; UI.setAction(near); }
  }

  function updateCamera(dt) {
    const R = G.R; let pos, target;
    if (G.state === 'title') {
      const a = G.t * 0.06; target = [-6, 4, 0]; pos = [Math.cos(a) * 75, 38, Math.sin(a) * 75];
    } else if (G.state === 'creator') {
      const narrow = window.innerWidth <= 760 || window.innerHeight <= 520;
      if (narrow && window.innerHeight > window.innerWidth) { pos = [0.2, 3.0, 11.5]; target = [0.2, -0.9, 0]; }
      else { const k = Math.min(1.6, Math.max(1.0, window.innerWidth / window.innerHeight)); pos = [-1.3 * k, 2.6, 8.4]; target = [-1.3 * k, 1.3, 0]; }
    } else if (G.camOverride) {
      const o = G.camOverride; pos = o.pos; target = o.target;
    } else if (G.player) {
      const P = G.player; const h = P.mounted ? 2.7 : 1.7;
      target = [P.pos[0], P.pos[1] + h, P.pos[2]];
      const c = G.cam; const d = c.dist * (P.mounted ? 1.15 : 1);
      pos = [target[0] + Math.sin(c.yaw) * Math.cos(c.pitch) * d, target[1] + Math.sin(c.pitch) * d, target[2] + Math.cos(c.yaw) * Math.cos(c.pitch) * d];
      const gy = WORLD.ground(pos[0], pos[2]) + 0.8; if (pos[1] < gy) pos[1] = gy;
    }
    if (!pos) return;
    const sm = G.camOverride && G.camOverride.cut ? 1 : Math.min(1, dt * (G.camOverride ? (G.camOverride.speed || 2.5) : 10));
    if (!G._camInit || G.state === 'title' || G.state === 'creator') { R.cam.pos = pos.slice(); R.cam.target = target.slice(); G._camInit = true; if (G.camOverride) G.camOverride.cut = false; return; }
    R.cam.pos = V.lerp(R.cam.pos, pos, sm); R.cam.target = V.lerp(R.cam.target, target, sm);
    if (G.camOverride && G.camOverride.cut) G.camOverride.cut = false;
    R.cam.far = 900;
  }

  /* ---------- 導航 ---------- */
  /* 格狀尋路（A*）：每格 2 公尺 */
  const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const NG = { N: 200, S: 1, O: -100, grid: null };
  function buildNavGrid() {
    const { N, S, O } = NG; const g = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = O + S * i + S / 2, z = O + S * j + S / 2; g[j * N + i] = WORLD.blockedFlat(x, z, 0.85) ? 1 : 0; }
    NG.grid = g;
  }
  G.buildNavGrid = buildNavGrid;
  const cellOf = (x, z) => [Math.max(0, Math.min(NG.N - 1, Math.floor((x - NG.O) / NG.S))), Math.max(0, Math.min(NG.N - 1, Math.floor((z - NG.O) / NG.S)))];
  const free = (i, j) => i >= 0 && j >= 0 && i < NG.N && j < NG.N && !NG.grid[j * NG.N + i];
  function nearestFree(c) { if (free(c[0], c[1])) return c; for (let r = 1; r < 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (Math.max(Math.abs(di), Math.abs(dj)) === r && free(c[0] + di, c[1] + dj)) return [c[0] + di, c[1] + dj]; return c; }
  function los(a, b) { const L = d2(a, b); const n = Math.ceil(L / 0.4); for (let k = 1; k < n; k++) { const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n; const c = cellOf(x, z); if (!free(c[0], c[1])) return false; } return true; }
  function astar(from, to) {
    if (!NG.grid) buildNavGrid();
    const N = NG.N; const s = nearestFree(cellOf(from[0], from[1])), t = nearestFree(cellOf(to[0], to[1]));
    const si = s[1] * N + s[0], ti = t[1] * N + t[0];
    const gS = new Float32Array(N * N).fill(1e9), came = new Int32Array(N * N).fill(-1), closed = new Uint8Array(N * N);
    const heap = []; const hpush = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const hpop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const h = (k) => Math.hypot(k % N - t[0], ((k / N) | 0) - t[1]);
    gS[si] = 0; hpush(si, h(si)); let found = false, iter = 0;
    while (heap.length && iter++ < 40000) {
      const [, k] = hpop(); if (closed[k]) continue; closed[k] = 1; if (k === ti) { found = true; break; }
      const ci = k % N, cj = (k / N) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ni = ci + di, nj = cj + dj; if (!free(ni, nj)) continue;
        if (di && dj && (!free(ci + di, cj) || !free(ci, cj + dj))) continue;
        const nk = nj * N + ni; const ng = gS[k] + (di && dj ? 1.414 : 1);
        if (ng < gS[nk]) { gS[nk] = ng; came[nk] = k; hpush(nk, ng + h(nk)); }
      }
    }
    if (!found) return [to];
    const path = []; let k = ti; while (k !== -1 && k !== si) { path.push([NG.O + NG.S * (k % N) + NG.S / 2, NG.O + NG.S * ((k / N) | 0) + NG.S / 2]); k = came[k]; }
    path.reverse(); path.push([to[0], to[1]]);
    // 拉直路線
    const out = []; let a = [from[0], from[1]]; let i = 0;
    while (i < path.length) { let j = path.length - 1; while (j > i && !los(a, path[j])) j--; out.push(path[j]); a = path[j]; i = j + 1; }
    return out;
  }
  const RAMP_TOP = [-26.9, 11.6], RAMP_BOT = [-26.9, 25.5];
  G.route = function (from, to) {
    const P0 = [from[0], from[2]], T = [to[0], to[2]];
    const onRamp = from[0] > -28.6 && from[0] < -25.2 && from[2] > 10.5 && from[2] < 23.5 && from[1] > 0.3;
    const onWall = !onRamp && from[1] > 3.5 && Math.abs(from[0]) < 33 && Math.abs(from[2]) < 33;
    const tWall = to[1] > 3.5;
    let pts = [];
    if ((onWall || onRamp) && tWall) pts = onRamp ? [RAMP_TOP, T] : [T];
    else {
      let start = P0; if (onWall) { pts.push(RAMP_TOP, RAMP_BOT); start = RAMP_BOT; } else if (onRamp) { pts.push(RAMP_BOT); start = RAMP_BOT; }
      pts = pts.concat(astar(start, tWall ? RAMP_BOT : T));
      if (tWall) pts.push(RAMP_TOP, T);
    }
    while (pts.length > 1 && d2(P0, pts[0]) < 1.6) pts.shift();
    return pts;
  };
  G.cachedRoute = function (from, to) {
    const c = G._rc; if (c && G.t - c.t < 0.35 && d2(c.to, [to[0], to[2]]) < 0.1) return c.pts;
    const pts = G.route(from, to); G._rc = { t: G.t, to: [to[0], to[2]], pts }; return pts;
  };
  G.navTarget = function () {
    if (G.state === 'collect' && G.collect) { let best = null, bd = 1e9; for (const it of G.collect.items) if (!it.taken) { const d = Math.hypot(it.pos[0] - G.player.pos[0], it.pos[2] - G.player.pos[2]); if (d < bd) { bd = d; best = it; } } return best ? { pos: best.pos, name: G.collect.name } : null; }
    if (G.auto && !G.auto.station) return { pos: G.auto.pos, name: '點選的目的地' };
    if (G.auto && G.auto.station) { const s2 = G.stations.find(s => s.id === G.auto.station); return { pos: s2.pos, name: `第${s2.id}關 ${s2.lv.title}`, id: s2.id }; }
    const id = G.nextLevel(); if (!id) return null; const st = G.stations.find(s => s.id === id); return { pos: st.pos, name: `第${id}關 ${st.lv.title}`, id };
  };
  function updateNav(dt) {
    const tgt = G.navTarget(); G.navInfo = null; if (!tgt || !G.player) return;
    const P = G.player.pos; const route = G.cachedRoute(P, tgt.pos);
    // 路線總長、第一個轉折點方向
    let total = 0, prev = [P[0], P[2]]; for (const q of route) { total += d2(prev, q); prev = q; }
    const first = route[0]; const dx = first[0] - P[0], dz = first[1] - P[2];
    const yaw = G.cam.yaw; const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    G.navInfo = { name: tgt.name, dist: total, angle: Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz) };
    // 地面金色足跡
    if (G.uiNavDots !== false) {
      const phase = (G.t * 4) % 2.4; let acc = -phase; prev = [P[0], P[2]]; let count = 0;
      for (const q of route) {
        const L = d2(prev, q); const ux = (q[0] - prev[0]) / (L || 1), uz = (q[1] - prev[1]) / (L || 1);
        while (acc < L && count < 34) { if (acc > 1.2) { const x = prev[0] + ux * acc, z = prev[1] + uz * acc; const y = WORLD.surfaceAt(x, z, P[1] + 1) + 0.25; G.particles.emit({ p: [x, y, z], v: [0, 0, 0], c: [1, 0.8, 0.25], s: 0.55, life: dt * 1.5, max: dt * 1.5, a: 0.85 }); } acc += 2.4; count++; }
        acc -= L; prev = q; if (count >= 34) break;
      }
    }
  }

  /* ---------- 3D 收集小遊戲 ---------- */
  G.startCollect = function (cfg) {
    return new Promise((resolve) => {
      const spots = MINIGAMES.shuffle(WORLD.collectSpots[cfg.item]).slice(0, cfg.count);
      const items = spots.map(([x, z]) => {
        const y = WORLD.surfaceAt(x, z, 2);
        const n = new M3D.Node(MD.item(G.R, cfg.item === 'flag' ? 'flagpole' : 'grain', { color: '#d6352b' }));
        if (cfg.item === 'flag') n.scl = [0.6, 0.6, 0.6];
        if (cfg.item !== 'flag') { n.scl = [1.25, 1.25, 1.25]; const lb = new M3D.Node(); lb.tq = { tex: G.tex.flag('糧'), w: 0.24, h: 0.24 }; lb.pos = [0, 0.36, 0.43]; n.add(lb); }
        n.pos = [x, y, z]; G.world.add(n);
        const bb = new M3D.Builder(); bb.cyl(0.6, 0.9, 14, 10, '#fff0a0', { p: [0, 7, 0] }, false); const beam = new M3D.Node(bb.build(G.R)); beam.unlit = true; beam.alpha = 0.25; beam.noCull = true; n.add(beam); beam.scl = cfg.item === 'flag' ? [1.6, 1.6, 1.6] : [1, 1, 1];
        return { node: n, pos: [x, y, z], taken: false };
      });
      G.collect = { items, cfg, name: cfg.name, time: cfg.time, got: 0, resolve };
      G.state = 'collect'; UI.collectHUD(true);
    });
  };
  function updateCollect(dt) {
    const C = G.collect; C.time -= dt; const P = G.player.pos;
    for (const it of C.items) {
      if (it.taken) continue; it.node.rot[1] += dt * 1.5; it.node.flash = 0.2 + Math.sin(G.t * 5) * 0.15;
      if (Math.hypot(it.pos[0] - P[0], it.pos[2] - P[2]) < 1.8 && Math.abs(it.pos[1] - P[1]) < 2.5) {
        it.taken = true; C.got++; G.world.remove(it.node); AUDIO.sfxPlay('collect'); G.burst([it.pos[0], it.pos[1] + 1, it.pos[2]], [1, 0.85, 0.3], 30);
      }
    }
    UI.collectHUD(true);
    if (C.got >= C.items.length || C.time <= 0) {
      for (const it of C.items) if (!it.taken) G.world.remove(it.node);
      const score = Math.round(D.scoring.miniMax * C.got / C.items.length + (C.got >= C.items.length ? 0 : 0));
      G.collect = null; G.state = 'modal'; UI.collectHUD(false); C.resolve({ score, got: C.got, total: C.items.length });
    }
  }
  G.burst = function (p, col, n, speed) {
    for (let i = 0; i < n; i++) { const a = Math.random() * PI * 2, b = Math.random() * PI - PI / 2, s = (speed || 4) * (0.5 + Math.random() * 0.5);
      G.particles.emit({ p: p.slice(), v: [Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s + 2, Math.sin(a) * Math.cos(b) * s], c: col || [1, 0.8, 0.3], s: 0.5 + Math.random() * 0.4, life: 1 + Math.random() * 0.6, max: 1.6, g: 6, shrink: true, drag: 1.2 }); }
  };
  G.firework = function (p) {
    const cols = [[1, 0.35, 0.35], [1, 0.85, 0.3], [0.4, 0.9, 1], [0.6, 1, 0.5], [1, 0.5, 0.9]]; const c = cols[Math.floor(Math.random() * cols.length)];
    for (let i = 0; i < 70; i++) { const a = Math.random() * PI * 2, b = Math.acos(Math.random() * 2 - 1), s = 9 + Math.random() * 3; G.particles.emit({ p: p.slice(), v: [Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s, Math.sin(b) * Math.sin(a) * s], c, s: 1.4, life: 1.6 + Math.random() * 0.5, max: 2, g: 5, drag: 1.6, shrink: true }); }
    AUDIO.sfxPlay('firework');
  };

  /* ---------- 傳送 ---------- */
  G.teleport = function (st) {
    const P = G.player; const s = st.pos; const ang = Math.atan2(st.look[0] - s[0], st.look[1] - s[2]);
    let x = s[0] - Math.sin(ang) * 2.5, z = s[2] - Math.cos(ang) * 2.5; if (st.id === 5) { x = -29.6; z = 11; }
    P.pos = [x, s[1] + 0.5, z]; P.pos[1] = WORLD.surfaceAt(x, z, s[1] + 1); P.vy = 0; P.yaw = ang; G.cam.yaw = ang + PI; G._camInit = false;
    G.burst([x, P.pos[1] + 1, z], [1, 0.9, 0.5], 40);
  };

  /* ---------- 繪製 ---------- */
  function render() {
    const R = G.R;
    if (G.state === 'creator') {
      R.env.clear = [0.98, 0.93, 0.82, 1]; R.env.fogCol = [0.98, 0.93, 0.82]; R.env.fog = [30, 60];
      R.render(G.creatorScene, [], null); return;
    }
    R.env.clear = [0.8, 0.88, 0.95, 1]; R.env.fogCol = [0.82, 0.9, 0.97]; R.env.fog = [90, 360];
    WORLD.sky.pos = R.cam.pos.slice();
    const sprites = G.state === 'world' ? G.sprites : [];
    for (const st of G.stations) { st.beam.visible = st.status === 'next' && (G.state === 'world' || G.state === 'title'); st.node.visible = ['world', 'collect', 'title', 'render'].includes(G.state); }
    R.render(G.world, sprites, G.particles);
    if (G.state === 'world' || G.state === 'collect' || G.state === 'finale') UI.drawMinimap && UI.drawMinimap();
  }
  G.renderFrame = render;

  /* ---------- 頭像（離屏渲染） ---------- */
  function makePortraitRenderer() {
    const c = document.createElement('canvas'); const pr = new M3D.Renderer(c, { alpha: true, preserve: true, maxDPR: 1 });
    pr.resize(512, 512); pr.env.fog = [500, 900];
    return pr;
  }
  // mode: 'head' | 'body' | 'horse'
  G.portrait = function (look, mode, size) {
    const pr = G.portraitR; size = size || 512; pr.resize(size, size);
    const root = new M3D.Node(); const ch = MD.character(pr, look); root.add(ch.root);
    if (mode === 'horse' && look.horse && look.horse !== 'none') { const h = MD.horse(pr, look.horse); root.add(h.root); ch.riding = true; ch.root.pos = [0, 1.05, -0.05]; ch.animate(0, 0); h.root.rot = [0, 0, 0]; }
    root.rot = [0, mode === 'horse' ? 0.75 : 0.32, 0];
    if (mode === 'head') { pr.cam.pos = [0, 1.95, 3.0]; pr.cam.target = [0, 1.62, 0]; pr.cam.fov = 30 * PI / 180; }
    else if (mode === 'horse') { pr.cam.pos = [0, 2.3, 7.8]; pr.cam.target = [0, 1.45, 0]; pr.cam.fov = 34 * PI / 180; }
    else { pr.cam.pos = [0, 1.5, 6.0]; pr.cam.target = [0, 1.05, 0]; pr.cam.fov = 28 * PI / 180; }
    pr.render(root, [], null);
    return pr.canvas.toDataURL('image/png');
  };

  // 用於產生素材：把任意節點拍成去背圖
  G.snap = function (root, pos, target, fov, w, h) {
    const pr = G.portraitR; pr.resize(w || 512, h || w || 512); pr.cam.pos = pos; pr.cam.target = target; pr.cam.fov = (fov || 30) * PI / 180;
    pr.render(root, [], null); return pr.canvas.toDataURL('image/png');
  };
  G.shotWorld = function (pos, target, fov, w, h, type) {
    const R = G.R; R.resize(w, h); R.cam.pos = pos; R.cam.target = target; R.cam.fov = (fov || 50) * PI / 180; G.state = 'render';
    render(); return R.canvas.toDataURL(type || 'image/jpeg', 0.88);
  };
  window.addEventListener('load', boot);
})();
