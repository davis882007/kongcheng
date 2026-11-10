/* =========================================================
   world.js — 3D 地圖：西城縣城池、城樓、縣衙、糧倉、書院、
   蜀軍大營、魏軍大營、烽火台、北方山路、河流、群山
   座標：x 向東、z 向南（北方 = -z），單位約 1 公尺
   ========================================================= */
(function () {
  'use strict';
  const { Builder, Node, shade, hex } = M3D;
  const W = {};
  const PI = Math.PI;

  // 繞 Y 軸放置的輔助
  function at(ox, oy, oz, ry) {
    const c = Math.cos(ry), s = Math.sin(ry);
    return function (lx, ly, lz, r, sc) {
      r = r || [0, 0, 0];
      return { p: [ox + c * lx + s * lz, oy + ly, oz - s * lx + c * lz], r: [r[0], r[1] + ry, r[2]], s: sc };
    };
  }

  /* ---------- 地形 ---------- */
  const ROADS = [
    [[62, 70], [55, 58], [50, 50], [50, 38], [30, 36], [6, 34], [0, 30]],   // 蜀營 → 木橋 → 南門
    [[0, 30], [0, 52], [8, 62], [20, 70]],                                  // 南門 → 石拱橋
    [[-30, 0], [-50, 0], [-68, -4], [-80, -5]],                             // 西門 → 魏營
    [[-30, 0], [-38, 10], [-46, 22]],                                       // 西門 → 烽火台
    [[0, -30], [-6, -45], [-22, -60], [-35, -72], [-38, -88]],              // 北門 → 北方山路
    [[30, 0], [55, 0], [70, 10]],                                           // 東門
    [[-68, -4], [-55, -30], [-35, -72]]                                     // 魏營 → 北山（撤退路線）
  ];
  function distSeg(px, pz, a, b) {
    const dx = b[0] - a[0], dz = b[1] - a[1]; const l = dx * dx + dz * dz;
    let t = l ? ((px - a[0]) * dx + (pz - a[1]) * dz) / l : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - a[0] - t * dx, pz - a[1] - t * dz);
  }
  function roadDist(x, z) { let d = 1e9; for (const r of ROADS) for (let i = 0; i < r.length - 1; i++) d = Math.min(d, distSeg(x, z, r[i], r[i + 1])); return d; }
  W.RIVER = { z0: 40, z1: 47 };
  W.BRIDGES = [{ x: 0, w: 5 }, { x: 50, w: 5 }];
  function inCity(x, z) { return Math.abs(x) < 28.5 && Math.abs(z) < 28.5; }
  function ground(x, z) {
    let h = 0;
    // 河道
    const R = W.RIVER; if (z > R.z0 - 2 && z < R.z1 + 2) { const t = Math.min(1, Math.min(z - (R.z0 - 2), (R.z1 + 2) - z) / 2.5); h -= 1.4 * Math.max(0, t); }
    // 烽火台山丘
    h += 2.6 * Math.exp(-((x + 50) ** 2 + (z - 25) ** 2) / 90);
    // 外圍起伏
    if (Math.abs(x) > 34 || Math.abs(z) > 34) {
      const n = Math.sin(x * 0.11) * Math.cos(z * 0.09) * 0.5 + Math.sin(x * 0.05 + z * 0.07) * 0.6;
      const rd = roadDist(x, z); const k = Math.min(1, Math.max(0, (rd - 3) / 6));
      if (!(z > R.z0 - 4 && z < R.z1 + 4)) h += Math.max(0, n) * k;
    }
    // 邊界山坡
    const e = Math.max(Math.abs(x), Math.abs(z)); if (e > 92) h += (e - 92) * 0.8;
    // 北方山谷兩側
    if (z < -60) { const valley = Math.abs(x + 35 + (z + 72) * 0.1); h += Math.max(0, (-60 - z) * 0.25) * Math.min(1, Math.max(0, (valley - 6) / 10)); }
    return h;
  }
  W.ground = ground;
  function groundColor(x, z, y) {
    const R = W.RIVER;
    if (z > R.z0 - 0.6 && z < R.z1 + 0.6) return '#7a8a6a';
    if (z > R.z0 - 2.2 && z < R.z1 + 2.2) return '#d8c99a';
    if (inCity(x, z)) {
      if (Math.abs(x) < 3 || Math.abs(z) < 3) return ((Math.floor(x / 1.5) + Math.floor(z / 1.5)) & 1) ? '#cbbfa8' : '#d6cbb5';
      if (Math.abs(x) < 7 && z < -4 && z > -20) return '#cdbfa6';
      const n = (Math.sin(x * 1.7) + Math.cos(z * 1.3)) * 0.04;
      return M3D.mix('#b9cf8a', '#a9c47a', 0.5 + n * 5);
    }
    const rd = roadDist(x, z);
    if (rd < 2.0) return '#d9b98a';
    if (rd < 2.8) return '#c7c48a';
    if (y > 5) return M3D.mix('#7fae6a', '#9a9a8a', Math.min(1, (y - 5) / 8));
    const n = Math.sin(x * 0.3) * Math.cos(z * 0.27) + Math.sin(x * 0.07 - z * 0.05);
    let c = M3D.mix('#9fd27a', '#7fbf68', 0.5 + n * 0.25);
    // 花田
    return c;
  }

  /* ---------- 碰撞與可行走表面 ---------- */
  W.solids = []; W.circles = [];
  function solid(x0, x1, z0, z1, top, bottom, topAt) { const s = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), top, bottom: bottom || -5, topAt }; W.solids.push(s); return s; }
  function circle(x, z, r, top) { W.circles.push({ x, z, r, top: top == null ? 50 : top }); }
  W.solid = solid; W.circle = circle;
  function surfTop(s, x, z) { return s.topAt ? s.topAt(x, z) : s.top; }
  // 回傳此位置在高度 y 時可站立的地面高度
  W.surfaceAt = function (x, z, y) {
    let h = ground(x, z);
    for (const s of W.solids) {
      if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) { const t = surfTop(s, x, z); if (t <= y + 0.75 && t > h && s.walk !== false) h = t; }
    }
    return h;
  };
  // 鏡頭碰撞用：點是否在建築物、城牆裡（含一點邊界）
  W.camHit = function (x, y, z) {
    const m = 0.3;
    for (const s of W.solids) {
      if (x > s.x0 - m && x < s.x1 + m && z > s.z0 - m && z < s.z1 + m) { const t = surfTop(s, Math.max(s.x0, Math.min(s.x1, x)), Math.max(s.z0, Math.min(s.z1, z))); if (y < t + 0.5 && y > s.bottom) return true; }
    }
    return false;
  };
  // 是否被擋住（半徑 r）
  W.blocked = function (x, z, y, r) {
    for (const s of W.solids) {
      if (x + r > s.x0 && x - r < s.x1 && z + r > s.z0 && z - r < s.z1) {
        const t = surfTop(s, Math.max(s.x0, Math.min(s.x1, x)), Math.max(s.z0, Math.min(s.z1, z)));
        if (y < t - 0.75 && y + 1.6 > s.bottom) return true;
      }
    }
    for (const c of W.circles) { if ((x - c.x) ** 2 + (z - c.z) ** 2 < (r + c.r) ** 2 && y < c.top - 0.5) return true; }
    if (Math.abs(x) > 98 || Math.abs(z) > 98) return true;
    return false;
  };

  // 尋路用：只看平地上的阻擋（忽略斜坡、橋面）
  W.blockedFlat = function (x, z, r) {
    const y = ground(x, z);
    if (Math.abs(x) > 96 || Math.abs(z) > 96) return true;
    for (const s of W.solids) { if (s.topAt && !s.ramp) continue; if (x + r > s.x0 && x - r < s.x1 && z + r > s.z0 && z - r < s.z1 && y < s.top - 0.75 && y + 1.6 > s.bottom) return true; }
    for (const c of W.circles) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (r + c.r) ** 2 && y < c.top - 0.5) return true;
    if (y > 4) return true;
    return false;
  };
  /* ---------- 小型建構函式 ---------- */
  function tree(b, x, z, kind, s) {
    s = s || 1; const y = ground(x, z);
    if (kind === 'pine') {
      b.cyl(0.25 * s, 0.35 * s, 1.6 * s, 6, '#7a4a2a', { p: [x, y + 0.8 * s, z] });
      for (let i = 0; i < 3; i++) b.cyl(0, (1.9 - i * 0.45) * s, 1.6 * s, 8, i % 2 ? '#3f8a5a' : '#4a9a63', { p: [x, y + (2.0 + i * 1.0) * s, z] });
    } else if (kind === 'sakura') {
      b.cyl(0.22 * s, 0.32 * s, 2 * s, 6, '#6a3f2a', { p: [x, y + 1 * s, z] });
      b.sphere(1.5 * s, '#ffb7cf', { p: [x, y + 2.9 * s, z] }, 10, 7); b.sphere(1.1 * s, '#ffc9da', { p: [x + 1 * s, y + 2.5 * s, z + 0.4 * s] }, 9, 6); b.sphere(1.0 * s, '#ff9fbe', { p: [x - 0.9 * s, y + 2.6 * s, z - 0.5 * s] }, 9, 6);
    } else if (kind === 'willow') {
      b.cyl(0.25 * s, 0.35 * s, 2.4 * s, 6, '#6a4a2a', { p: [x, y + 1.2 * s, z] });
      b.sphere(1.6 * s, '#8cc46a', { p: [x, y + 3.0 * s, z], s: [1, 0.7, 1] }, 10, 6);
      for (let i = 0; i < 6; i++) { const a = i * 1.05; b.cyl(0.25 * s, 0.05 * s, 2.2 * s, 5, '#9fd47a', { p: [x + Math.cos(a) * 1.2 * s, y + 2.0 * s, z + Math.sin(a) * 1.2 * s] }); }
    } else if (kind === 'bamboo') {
      for (let i = 0; i < 5; i++) { const ax = x + Math.cos(i * 2.4) * 0.6 * s, az = z + Math.sin(i * 2.4) * 0.6 * s; const h = (3.5 + (i % 3)) * s;
        b.cyl(0.09 * s, 0.1 * s, h, 6, '#7fbf5a', { p: [ax, y + h / 2, az] }); b.sphere(0.6 * s, '#5faa4a', { p: [ax, y + h, az], s: [1, 0.5, 1] }, 7, 5); }
    } else {
      b.cyl(0.25 * s, 0.35 * s, 1.8 * s, 6, '#7a4a2a', { p: [x, y + 0.9 * s, z] });
      b.sphere(1.5 * s, '#6fbf5f', { p: [x, y + 2.7 * s, z] }, 10, 7); b.sphere(1.1 * s, '#7fcf6a', { p: [x + 0.9 * s, y + 2.3 * s, z + 0.3 * s] }, 9, 6); b.sphere(1.0 * s, '#5faf55', { p: [x - 0.8 * s, y + 2.4 * s, z - 0.4 * s] }, 9, 6);
    }
    circle(x, z, 0.55 * s);
  }
  function rock(b, x, z, s) { b.sphere(s, '#a8a49a', { p: [x, ground(x, z) + s * 0.3, z], s: [1.2, 0.7, 1], r: [0, x, 0] }, 7, 5); }
  function flowers(b, x, z, n) { const cols = ['#ff7a9a', '#ffd54a', '#ffffff', '#c58aff', '#ff9f43']; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, r = Math.random() * 2.2; const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; b.sphere(0.13, cols[i % 5], { p: [px, ground(px, pz) + 0.18, pz] }, 5, 4); b.cyl(0.02, 0.02, 0.2, 3, '#4a9a40', { p: [px, ground(px, pz) + 0.08, pz] }); } }
  function lanternPost(b, x, z) { const y = ground(x, z); b.cyl(0.08, 0.1, 2.4, 6, '#5a3420', { p: [x, y + 1.2, z] }); b.box(0.9, 0.08, 0.08, '#5a3420', { p: [x + 0.35, y + 2.35, z] }); b.sphere(0.28, '#e8392b', { p: [x + 0.7, y + 1.95, z], s: [1, 0.85, 1] }, 10, 7); b.cyl(0.13, 0.13, 0.06, 8, '#f2c14e', { p: [x + 0.7, y + 2.2, z] }); circle(x, z, 0.3); }
  function fence(b, x0, z0, x1, z1) { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 1.2); for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n; b.cyl(0.08, 0.08, 1.1, 5, '#8a5a32', { p: [x, ground(x, z) + 0.55, z] }); } const a = Math.atan2(z1 - z0, x1 - x0); const L = Math.hypot(x1 - x0, z1 - z0); const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2; for (const hh of [0.45, 0.85]) b.box(L, 0.08, 0.06, '#a06a3a', { p: [mx, ground(mx, mz) + hh, mz], r: [0, -a, 0] }); }

  // 民居
  function house(b, x, z, ry, w, d, opt) {
    opt = opt || {}; const y = ground(x, z); const T = at(x, y, z, ry); const h = opt.h || 2.6;
    b.box(w + 0.6, 0.35, d + 0.6, '#b8b0a0', T(0, 0.17, 0));
    b.box(w, h, d, opt.wall || '#f6efe0', T(0, 0.35 + h / 2, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.14, 0.14, h, 6, '#9b2f25', T(sx * w / 2, 0.35 + h / 2, sz * d / 2));
    b.box(w + 0.05, 0.25, d + 0.05, '#9b2f25', T(0, 0.35 + h - 0.12, 0));
    b.box(1.0, 1.7, 0.08, '#7a3a20', T(0, 0.35 + 0.85, d / 2 + 0.02));
    b.box(0.9, 0.7, 0.06, '#4a3a30', T(-w / 2 + 0.9, 0.35 + 1.5, d / 2 + 0.03)); if (w > 3.6) b.box(0.9, 0.7, 0.06, '#4a3a30', T(w / 2 - 0.9, 0.35 + 1.5, d / 2 + 0.03));
    b.roof(w + 1.6, d + 1.4, opt.rh || 1.7, opt.roof || '#46505e', T(0, 0.35 + h, 0));
    solid(...aabb(x, z, ry, w + 0.6, d + 0.6), 0.35 + h + 1.5);
  }
  function aabb(x, z, ry, w, d) { const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)); const hw = (w * c + d * s) / 2, hd = (w * s + d * c) / 2; return [x - hw, x + hw, z - hd, z + hd]; }

  // 中式樓閣（城樓 / 縣衙 / 書院）
  function hall(b, x, y, z, ry, w, d, opt) {
    opt = opt || {}; const T = at(x, y, z, ry); const h = opt.h || 3.2; const pc = opt.pillar || '#b0302a';
    b.box(w + 1.2, 0.5, d + 1.2, opt.base || '#c9c0ae', T(0, 0.25, 0));
    b.box(w, h, d, opt.wall || '#f3e7cf', T(0, 0.5 + h / 2, 0));
    const nx = Math.max(2, Math.round(w / 2.2)); for (let i = 0; i <= nx; i++) for (const sz of [-1, 1]) b.cyl(0.2, 0.2, h, 8, pc, T(-w / 2 + w * i / nx, 0.5 + h / 2, sz * (d / 2 + 0.25)));
    for (let i = 0; i < nx; i++) { const lx = -w / 2 + w * (i + 0.5) / nx; b.box(w / nx - 0.5, h * 0.55, 0.06, '#c0782a', T(lx, 0.5 + h * 0.5, d / 2 + 0.04)); for (let k = 0; k < 4; k++) b.box(0.05, h * 0.55, 0.08, '#8a3a1a', T(lx - (w / nx - 0.6) / 2 + k * (w / nx - 0.6) / 3, 0.5 + h * 0.5, d / 2 + 0.06)); }
    b.box(w + 0.6, 0.35, d + 0.9, '#2f6f6a', T(0, 0.5 + h + 0.1, 0));
    b.box(w + 0.4, 0.18, d + 0.7, '#f2c14e', T(0, 0.5 + h - 0.12, 0));
    b.roof(w + 3.2, d + 3.0, opt.rh || 2.2, opt.roof || '#3d4b5c', T(0, 0.5 + h + 0.25, 0), { ridge: '#2b3440' });
    if (opt.second) {
      const y2 = 0.5 + h + 1.1; const w2 = w * 0.62, d2 = d * 0.62, h2 = h * 0.7;
      b.box(w2, h2, d2, opt.wall || '#f3e7cf', T(0, y2 + h2 / 2, 0));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.17, 0.17, h2, 8, pc, T(sx * w2 / 2, y2 + h2 / 2, sz * d2 / 2));
      b.box(w2 + 0.5, 0.3, d2 + 0.6, '#2f6f6a', T(0, y2 + h2 + 0.1, 0));
      b.roof(w2 + 2.4, d2 + 2.2, 1.9, opt.roof || '#3d4b5c', T(0, y2 + h2 + 0.2, 0), { ridge: '#2b3440' });
      const topY = y2 + h2 + 0.2 + 1.9;
      b.sphere(0.35, '#f2c14e', T(0, topY + 0.25, 0)); b.cyl(0, 0.2, 0.6, 8, '#f2c14e', T(0, topY + 0.7, 0));
      for (const sx of [-1, 1]) b.torus(0.3, 0.08, '#2b3440', T(sx * (w2 * 0.12 + 0.3), topY - 0.05, 0, [PI / 2, 0, 0]), 10, 5, PI * 1.3);
    }
  }

  // 帳篷
  function tent(b, x, z, col, acc, s, ry) {
    s = s || 1; ry = ry || 0; const y = ground(x, z); const T = at(x, y, z, ry);
    b.cyl(1.8 * s, 1.9 * s, 1.4 * s, 10, col, T(0, 0.7 * s, 0));
    b.lathe([[2.1 * s, 0], [1.6 * s, 0.6 * s], [0.5 * s, 1.5 * s], [0.08 * s, 1.8 * s]], 10, acc, T(0, 1.35 * s, 0), {});
    b.torus(1.9 * s, 0.07 * s, acc, T(0, 1.4 * s, 0), 12, 4);
    b.box(0.9 * s, 1.2 * s, 0.1, shade(acc, 0.75), T(0, 0.6 * s, 1.85 * s));
    b.cyl(0.04, 0.04, 1.4 * s, 4, '#5a3a22', T(0, 3.6 * s, 0)); b.tris([0, 0, 0, 0, -0.5 * s, 0, 0.9 * s, -0.25 * s, 0], acc, T(0, 4.25 * s, 0)); b.tris([0, 0, 0, 0.9 * s, -0.25 * s, 0, 0, -0.5 * s, 0], acc, T(0, 4.25 * s, 0));
    circle(x, z, 2.0 * s);
  }
  function weaponRack(b, x, z, ry) { const y = ground(x, z); const T = at(x, y, z, ry); b.box(2.4, 0.15, 0.4, '#7a4a26', T(0, 0.3, 0)); b.box(2.4, 0.12, 0.2, '#7a4a26', T(0, 1.6, 0)); for (const sx of [-1.1, 1.1]) b.box(0.15, 1.8, 0.15, '#6a3a1a', T(sx, 0.9, 0)); const types = ['spear', 'guandao', 'halberd', 'spear', 'snake']; types.forEach((t, i) => MD.weapon(b, t, T(-0.9 + i * 0.45, 0.2, 0.05, [0, 0, 0], 0.75))); circle(x, z, 1.2); }
  function target(b, x, z, ry) { const y = ground(x, z); const T = at(x, y, z, ry); b.cyl(0.06, 0.06, 1.6, 5, '#6a3a1a', T(-0.5, 0.8, -0.2, [-0.2, 0, 0])); b.cyl(0.06, 0.06, 1.6, 5, '#6a3a1a', T(0.5, 0.8, -0.2, [-0.2, 0, 0]));
    const rings = ['#f4f0e0', '#d6352b', '#f4f0e0', '#d6352b', '#f2c14e']; rings.forEach((c, i) => b.cyl(0.75 - i * 0.15, 0.75 - i * 0.15, 0.08 + i * 0.02, 16, c, T(0, 1.4, 0, [PI / 2, 0, 0]))); circle(x, z, 0.6); }
  function drum(b, x, z, ry) { const y = ground(x, z); const T = at(x, y, z, ry); b.box(1.8, 0.12, 0.12, '#5a2a1a', T(0, 0.1, -0.5)); b.box(1.8, 0.12, 0.12, '#5a2a1a', T(0, 0.1, 0.5)); for (const sx of [-0.8, 0.8]) b.box(0.12, 1.8, 0.12, '#5a2a1a', T(sx, 0.9, 0)); b.cyl(0.75, 0.75, 0.9, 16, '#c0392b', T(0, 1.3, 0, [0, 0, PI / 2])); b.cyl(0.72, 0.72, 0.94, 16, '#f4e6c0', T(0, 1.3, 0, [0, 0, PI / 2]), true); for (const sx of [-0.42, 0.42]) b.torus(0.76, 0.05, '#f2c14e', T(sx, 1.3, 0, [0, 0, PI / 2]), 16, 4); circle(x, z, 1.0); }
  function silo(b, x, z, s) { const y = ground(x, z); b.cyl(1.6 * s, 1.7 * s, 3 * s, 12, '#e9dcc0', { p: [x, y + 1.5 * s, z] }); b.torus(1.62 * s, 0.07, '#9b2f25', { p: [x, y + 2.6 * s, z] }, 14, 4); b.lathe([[2.1 * s, 0], [1.4 * s, 0.7 * s], [0.1 * s, 2 * s]], 12, '#e0b860', { p: [x, y + 3 * s, z] }); b.box(0.9, 1.4, 0.1, '#7a3a20', { p: [x, y + 0.75, z + 1.65 * s] }); circle(x, z, 1.75 * s); }
  function stall(b, x, z, ry, cloth) { const y = ground(x, z); const T = at(x, y, z, ry); b.box(2.4, 0.9, 1.0, '#a0683a', T(0, 0.45, 0)); for (const sx of [-1.1, 1.1]) for (const sz of [-0.5, 0.5]) b.cyl(0.05, 0.05, 2.2, 4, '#6a3a1a', T(sx, 1.1, sz)); b.box(2.8, 0.08, 1.6, cloth, T(0, 2.2, 0, [0.15, 0, 0])); for (let i = 0; i < 4; i++) b.sphere(0.18, ['#ff7043', '#ffd54a', '#8bc34a', '#e84a5f'][i], T(-0.8 + i * 0.5, 1.0, 0)); circle(x, z, 1.2); }
  function well(b, x, z) { const y = ground(x, z); b.cyl(0.9, 1.0, 0.8, 12, '#b8b0a0', { p: [x, y + 0.4, z] }); b.cyl(0.7, 0.7, 0.82, 12, '#3a5a7a', { p: [x, y + 0.42, z] }); for (const s of [-1, 1]) b.box(0.12, 1.8, 0.12, '#6a3a1a', { p: [x + s * 0.8, y + 1.2, z] }); b.roof(2.2, 1.6, 0.7, '#46505e', { p: [x, y + 2.05, z] }); circle(x, z, 1.0); }
  function cart(b, x, z, ry) { const y = ground(x, z); const T = at(x, y, z, ry); b.box(1.6, 0.15, 1.1, '#a0683a', T(0, 0.75, 0)); for (const s of [-1, 1]) b.torus(0.5, 0.07, '#5a3a22', T(0, 0.55, s * 0.62), 12, 4); b.box(0.08, 0.08, 2.2, '#8a5a32', T(1.6, 0.6, 0, [0, PI / 2, 0.2])); MD.item && 0; b.sphere(0.4, '#e8d3a0', T(-0.3, 1.1, 0), 8, 6); b.sphere(0.35, '#e8d3a0', T(0.35, 1.05, 0.1), 8, 6); circle(x, z, 1.0); }
  function stoneLantern(b, x, z) { const y = ground(x, z); b.box(0.7, 0.3, 0.7, '#b8b4aa', { p: [x, y + 0.15, z] }); b.cyl(0.15, 0.2, 0.9, 6, '#b8b4aa', { p: [x, y + 0.75, z] }); b.box(0.6, 0.5, 0.6, '#c8c4ba', { p: [x, y + 1.45, z] }); b.box(0.3, 0.3, 0.62, '#ffcf6a', { p: [x, y + 1.45, z] }); b.roof(1.0, 1.0, 0.45, '#9a968c', { p: [x, y + 1.7, z] }); circle(x, z, 0.4); }
  function mountain(b, x, z, r, h, col) {
    const y = ground(x, z) - 1; const top = col === 'snow';
    b.lathe([[r, 0], [r * 0.8, h * 0.3], [r * 0.5, h * 0.65], [r * 0.25, h * 0.9], [0, h]], 9, top ? '#6fa08a' : (col || '#6fa86e'), { p: [x, y, z], r: [0, x * 0.3, 0] }, { flat: true });
    if (top) b.lathe([[r * 0.27, h * 0.86], [r * 0.12, h * 0.95], [0, h + 0.2]], 9, '#ffffff', { p: [x, y, z], r: [0, x * 0.3, 0] }, { flat: true });
  }

  /* ---------- 迷你士兵（合併網格用） ---------- */
  function miniSoldier(b, x, y, z, ry, armor, plume, weapon) {
    const T = at(x, y, z, ry);
    b.cyl(0.1, 0.1, 0.5, 5, '#3a2a22', T(-0.12, 0.25, 0)); b.cyl(0.1, 0.1, 0.5, 5, '#3a2a22', T(0.12, 0.25, 0));
    b.cyl(0.24, 0.33, 0.7, 8, armor, T(0, 0.8, 0));
    b.sphere(0.32, '#ffe2c6', T(0, 1.45, 0), 8, 6);
    b.sphere(0.35, shade(armor, 1.2), T(0, 1.52, -0.02), 8, 5, 0.55);
    b.sphere(0.12, plume, T(0, 1.9, -0.1), 6, 4);
    b.sphere(0.05, '#1b1622', T(-0.11, 1.45, 0.29), 4, 3); b.sphere(0.05, '#1b1622', T(0.11, 1.45, 0.29), 4, 3);
    if (weapon !== false) { b.cyl(0.03, 0.03, 2.2, 4, '#6a3f1f', T(0.32, 1.1, 0.1)); b.cyl(0, 0.06, 0.25, 4, '#dfe6ee', T(0.32, 2.3, 0.1)); }
  }
  W.miniSoldier = miniSoldier;
  // 一個方陣（Node，可移動）
  W.regiment = function (R, rows, cols, armor, plume, flagCol, flagTex) {
    const b = new Builder();
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) miniSoldier(b, (j - (cols - 1) / 2) * 1.3, 0, (i - (rows - 1) / 2) * 1.3, 0, armor, plume);
    // 旗手
    for (const sx of [-1, 1]) { const fx = sx * ((cols - 1) / 2 * 1.3 + 1.2), fz = (rows - 1) / 2 * 1.3; b.cyl(0.05, 0.05, 4, 5, '#5a3a22', { p: [fx, 2, fz] }); b.box(0.04, 1.4, 1.1, flagCol, { p: [fx, 3.3, fz - 0.6] }); }
    const n = new Node(b.build(R));
    if (flagTex) for (const sx of [-1, 1]) { const q = new Node(); q.tq = { tex: flagTex, w: 0.9, h: 0.9 }; q.pos = [sx * ((cols - 1) / 2 * 1.3 + 1.2) + 0.03, 3.3, (rows - 1) / 2 * 1.3 - 0.6]; q.rot = [0, PI / 2, 0]; n.add(q); const q2 = new Node(); q2.tq = q.tq; q2.pos = [q.pos[0] - 0.06, 3.3, q.pos[2]]; q2.rot = [0, -PI / 2, 0]; n.add(q2); }
    return n;
  };

  /* ---------- 世界建構 ---------- */
  W.build = function (R, tex) {
    W.solids = []; W.circles = [];
    const root = new Node();
    const chunks = {}; const CH = 40;
    const chunk = (x, z) => { const k = Math.floor(x / CH) + ',' + Math.floor(z / CH); return chunks[k] || (chunks[k] = new Builder()); };
    const big = new Builder();      // 大型物件（城牆等）
    const dyn = [];                 // 會動的物件
    const tq = (texc, w, h, p, ry) => { const n = new Node(); n.tq = { tex: texc, w, h }; n.pos = p; n.rot = [0, ry || 0, 0]; root.add(n); return n; };

    // 天空
    const sky = new Builder(); sky.sphere(450, '#ffffff', {}, 24, 16);
    for (let i = 0; i < sky.p.length; i += 3) { const y = sky.p[i + 1] / 450; const c = y > 0 ? M3D.mix('#cfe8ff', '#6fb0e8', Math.min(1, y * 1.6)) : hex('#e8f4ff'); sky.c[i] = c[0]; sky.c[i + 1] = c[1]; sky.c[i + 2] = c[2]; }
    const skyN = new Node(sky.build(R)); skyN.unlit = true; skyN.noCull = true; skyN.isSky = true; root.add(skyN); W.sky = skyN;
    // 雲
    const clouds = new Node(); root.add(clouds); W.clouds = clouds;
    for (let i = 0; i < 16; i++) { const cb = new Builder(); const n = 3 + (i % 3); for (let k = 0; k < n; k++) cb.sphere(6 + Math.random() * 5, '#ffffff', { p: [k * 7 - n * 3.5, Math.random() * 3, Math.random() * 4], s: [1, 0.6, 0.8] }, 10, 7); const cn = new Node(cb.build(R)); cn.unlit = true; cn.pos = [Math.random() * 400 - 200, 70 + Math.random() * 30, Math.random() * 400 - 200]; cn.tint = [0.97, 0.98, 1]; clouds.add(cn); }

    // 地面
    const gb = new Builder(); gb.grid(240, 150, ground, groundColor, 0, 0); root.add(new Node(gb.build(R)));
    // 河水
    const wb = new Builder(); wb.box(240, 0.1, W.RIVER.z1 - W.RIVER.z0 + 3, '#4fa8d8', { p: [0, -0.45, (W.RIVER.z0 + W.RIVER.z1) / 2] });
    const water = new Node(wb.build(R)); water.alpha = 0.78; root.add(water); W.water = water;
    // 河的碰撞（橋除外）
    let xs = -120; for (const br of W.BRIDGES) { solid(xs, br.x - br.w / 2, W.RIVER.z0 - 0.3, W.RIVER.z1 + 0.3, 50, -5); xs = br.x + br.w / 2; } solid(xs, 120, W.RIVER.z0 - 0.3, W.RIVER.z1 + 0.3, 50, -5);
    W.solids.forEach(s => s.walk = false);
    // 橋
    for (const br of W.BRIDGES) {
      const z0 = W.RIVER.z0 - 3, z1 = W.RIVER.z1 + 3; const L = z1 - z0; const arch = (z) => 0.2 + 1.3 * Math.sin(PI * Math.max(0, Math.min(1, (z - z0) / L)));
      const stone = br.x === 0;
      for (let i = 0; i < 14; i++) { const za = z0 + L * i / 14, zb = z0 + L * (i + 1) / 14; const ya = arch(za), yb = arch(zb); const zm = (za + zb) / 2; b2(big, br, zm, (ya + yb) / 2, Math.atan2(yb - ya, zb - za), L / 14 + 0.05, stone); }
      for (const s of [-1, 1]) for (let i = 0; i <= 7; i++) { const z = z0 + L * i / 7; big.cyl(0.1, 0.1, 1.0, 6, stone ? '#d6352b' : '#8a5a32', { p: [br.x + s * (br.w / 2 - 0.2), arch(z) + 0.5, z] }); if (stone && (i === 0 || i === 7)) big.sphere(0.18, '#f2c14e', { p: [br.x + s * (br.w / 2 - 0.2), arch(z) + 1.1, z] }); }
      solid(br.x - br.w / 2, br.x + br.w / 2, z0, z1, 0, -5, (x, z) => arch(z));
      W.solids[W.solids.length - 1].walkOnly = true;
      solid(br.x - br.w / 2 - 0.4, br.x - br.w / 2 + 0.1, z0 + 0.5, z1 - 0.5, 50, -5); solid(br.x + br.w / 2 - 0.1, br.x + br.w / 2 + 0.4, z0 + 0.5, z1 - 0.5, 50, -5);
    }
    function b2(bb, br, zm, ym, ang, len, stone) { bb.box(br.w, 0.3, len, stone ? '#c9c0ae' : '#b07a4a', { p: [br.x, ym, zm], r: [-ang, 0, 0] }); }

    /* ===== 城牆 ===== */
    const WH = 5.5, HALF = 30, TH = 3, GAP = 3.2;
    const brick = '#e3a988', brickD = '#c98a6a';
    const wallSeg = (x0, x1, z0, z1) => {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
      big.box(w, WH, d, brick, { p: [cx, WH / 2, cz] });
      big.box(w + 0.3, 0.8, d + 0.3, brickD, { p: [cx, 0.4, cz] });
      big.box(w, 0.12, d, '#cdbfa6', { p: [cx, WH + 0.06, cz] });
      solid(x0, x1, z0, z1, WH);
    };
    const merlons = (x0, x1, z0, z1, along) => {
      const L = along === 'x' ? x1 - x0 : z1 - z0; const n = Math.floor(L / 1.6);
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; const px = along === 'x' ? x0 + L * t : (x0 + x1) / 2, pz = along === 'z' ? z0 + L * t : (z0 + z1) / 2; big.box(along === 'x' ? 0.9 : 0.5, 0.9, along === 'z' ? 0.9 : 0.5, brick, { p: [px, WH + 0.45, pz] }); }
      big.box(along === 'x' ? L : 0.5, 0.35, along === 'z' ? L : 0.5, brick, { p: [(x0 + x1) / 2, WH + 0.17, (z0 + z1) / 2] });
      solid(x0, x1, z0, z1, WH + 1.2, WH - 0.5);
    };
    const o = HALF + TH / 2, ii = HALF - TH / 2;
    // 北、南
    for (const zc of [-HALF, HALF]) {
      wallSeg(-o, -GAP, zc - TH / 2, zc + TH / 2); wallSeg(GAP, o, zc - TH / 2, zc + TH / 2);
      const zo = zc < 0 ? zc - TH / 2 + 0.25 : zc + TH / 2 - 0.25; merlons(-o, -GAP - 0.5, zo - 0.25, zo + 0.25, 'x'); merlons(GAP + 0.5, o, zo - 0.25, zo + 0.25, 'x');
      // 城門上方
      big.box(GAP * 2, WH - 3.8, TH, brick, { p: [0, 3.8 + (WH - 3.8) / 2, zc] }); solid(-GAP, GAP, zc - TH / 2, zc + TH / 2, WH, 3.6);
      big.torus(GAP, 0.35, brickD, { p: [0, 3.6, zc + (zc < 0 ? -TH / 2 - 0.1 : TH / 2 + 0.1)], r: [-PI / 2, 0, 0], s: [1, 0.4, 1] }, 14, 5, PI);
    }
    // 西、東
    for (const xc of [-HALF, HALF]) {
      wallSeg(xc - TH / 2, xc + TH / 2, -ii, -GAP); wallSeg(xc - TH / 2, xc + TH / 2, GAP, ii);
      const xo = xc < 0 ? xc - TH / 2 + 0.25 : xc + TH / 2 - 0.25; merlons(xo - 0.25, xo + 0.25, -o, -GAP - 0.5, 'z'); merlons(xo - 0.25, xo + 0.25, GAP + 0.5, o, 'z');
      big.box(TH, WH - 3.8, GAP * 2, brick, { p: [xc, 3.8 + (WH - 3.8) / 2, 0] }); solid(xc - TH / 2, xc + TH / 2, -GAP, GAP, WH, 3.6);
      big.torus(GAP, 0.35, brickD, { p: [xc + (xc < 0 ? -TH / 2 - 0.1 : TH / 2 + 0.1), 3.6, 0], r: [-PI / 2, PI / 2, 0], s: [1, 0.4, 1] }, 14, 5, PI);
    }
    // 角樓
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { big.box(5, 1, 5, brick, { p: [sx * HALF, WH + 0.5, sz * HALF] }); hall(big, sx * HALF, WH + 0.8, sz * HALF, 0, 3, 3, { h: 2.0, rh: 1.4 }); solid(sx * HALF - 2.5, sx * HALF + 2.5, sz * HALF - 2.5, sz * HALF + 2.5, WH + 8, WH - 0.4); }
    // 城門（敞開的門扇）
    const gates = [[0, -HALF, 0], [0, HALF, PI], [-HALF, 0, PI / 2], [HALF, 0, -PI / 2]];
    for (const [gx, gz, ry] of gates) {
      const T = at(gx, 0, gz, ry);
      big.box(1.6, 3.6, 0.2, '#9b2f25', T(-GAP - 0.2, 1.8, 1.2, [0, 1.3, 0])); big.box(1.6, 3.6, 0.2, '#9b2f25', T(GAP + 0.2, 1.8, 1.2, [0, -1.3, 0]));
      for (let k = 0; k < 3; k++) for (let m = 0; m < 3; m++) { big.sphere(0.09, '#f2c14e', T(-GAP - 0.25 + 0.0, 0.8 + k * 1.0, 1.0 + (m - 1) * 0.4, [0, 1.3, 0]), 5, 4); }
    }
    // 城樓（四門）
    W.towerTop = WH;
    for (const [gx, gz, ry] of gates) {
      const main = gx < 0; // 西門為主城樓（孔明撫琴處）
      hall(big, gx, WH, gz, ry, main ? 8 : 6, main ? 3.6 : 3, { h: 2.8, second: true });
      const bb = aabb(gx, gz, ry, (main ? 8 : 6) + 1.2, (main ? 3.6 : 3) + 1.2); solid(bb[0], bb[1], bb[2], bb[3], WH + 9, WH - 0.4);
    }
    // 匾額
    tq(tex.plaque('西城'), 3.2, 1.2, [-HALF - TH / 2 - 0.05, 4.65, 0], -PI / 2);
    tq(tex.plaque('西城'), 3.2, 1.2, [0, 4.65, HALF + TH / 2 + 0.05], 0);
    tq(tex.plaque('北門'), 2.6, 1.0, [0, 4.65, -HALF - TH / 2 - 0.05], PI);
    tq(tex.plaque('東門'), 2.6, 1.0, [HALF + TH / 2 + 0.05, 4.65, 0], PI / 2);
    // 登城坡道（西牆內側，南段）
    const rampX0 = -HALF + TH / 2, rampX1 = rampX0 + 3.2, rz0 = 11, rz1 = 23;
    const rampTop = (x, z) => WH * Math.max(0, Math.min(1, (rz1 - z) / (rz1 - rz0)));
    for (let i = 0; i < 16; i++) { const za = rz0 + (rz1 - rz0) * i / 16, zb = rz0 + (rz1 - rz0) * (i + 1) / 16; const ya = rampTop(0, za), yb = rampTop(0, zb); big.box(3.2, Math.max(0.2, (ya + yb) / 2), (rz1 - rz0) / 16 + 0.02, i % 2 ? '#d9a07e' : '#e3a988', { p: [(rampX0 + rampX1) / 2, (ya + yb) / 4, (za + zb) / 2] }); big.box(3.2, 0.12, (rz1 - rz0) / 16, '#cdbfa6', { p: [(rampX0 + rampX1) / 2, (ya + yb) / 2 + 0.03, (za + zb) / 2] }); }
    solid(rampX0, rampX1, rz0, rz1, WH, -5, rampTop);
    W.solids[W.solids.length - 1].ramp = true;
    W.rampBottom = [rampX0 + 1.6, 0, rz1 + 1.5];
    // 城樓平台（坡道頂端加大的平台）＋欄杆：避免從坡道、城牆邊掉下去
    const lz0 = 4.6, lz1 = rz0;
    big.box(rampX1 - rampX0, WH, lz1 - lz0, brick, { p: [(rampX0 + rampX1) / 2, WH / 2, (lz0 + lz1) / 2] });
    big.box(rampX1 - rampX0, 0.12, lz1 - lz0, '#cdbfa6', { p: [(rampX0 + rampX1) / 2, WH + 0.06, (lz0 + lz1) / 2] });
    solid(rampX0, rampX1, lz0, lz1, WH);
    const RAIL = '#a8322a', RAILT = '#f2c14e';
    const railZ = (x, za, zb, yAt) => { // 沿 z 方向的欄杆（yAt：地面高度）
      const n = Math.max(2, Math.round((zb - za) / 1.4));
      for (let i = 0; i <= n; i++) { const z = za + (zb - za) * i / n; const y = yAt(z); big.box(0.22, 1.1, 0.22, RAIL, { p: [x, y + 0.55, z] }); big.box(0.3, 0.12, 0.3, RAILT, { p: [x, y + 1.14, z] }); }
      for (let i = 0; i < n; i++) { const z0 = za + (zb - za) * i / n, z1 = za + (zb - za) * (i + 1) / n; const y0 = yAt(z0), y1 = yAt(z1); const len = Math.hypot(z1 - z0, y1 - y0), ang = Math.atan2(y1 - y0, z1 - z0);
        for (const hh of [0.5, 1.0]) big.box(0.12, 0.12, len, RAIL, { p: [x, (y0 + y1) / 2 + hh, (z0 + z1) / 2], r: [-ang, 0, 0] }); }
    };
    const railX = (z, xa, xb, y) => { const n = Math.max(2, Math.round((xb - xa) / 1.4)); for (let i = 0; i <= n; i++) { const x = xa + (xb - xa) * i / n; big.box(0.22, 1.1, 0.22, RAIL, { p: [x, y + 0.55, z] }); big.box(0.3, 0.12, 0.3, RAILT, { p: [x, y + 1.14, z] }); } for (const hh of [0.5, 1.0]) big.box(xb - xa, 0.12, 0.12, RAIL, { p: [(xa + xb) / 2, y + hh, z] }); };
    // 坡道＋平台外側
    railZ(rampX1 - 0.12, lz0, rz1, (z) => z <= rz0 ? WH : rampTop(0, z));
    solid(rampX1 - 0.3, rampX1 + 0.15, lz0, rz1, WH + 1.1, -5, (x, z) => (z <= rz0 ? WH : rampTop(0, z)) + 1.1);
    W.solids[W.solids.length - 1].walk = false;
    // 平台北側（靠城樓）
    railX(lz0 + 0.12, -HALF + 2.4, rampX1, WH); solid(-HALF + 2.4, rampX1 + 0.15, lz0 - 0.15, lz0 + 0.3, WH + 1.1, WH - 0.3); W.solids[W.solids.length - 1].walk = false;
    // 城牆內側欄杆（四面，西牆避開平台與坡道）
    const ie = HALF - TH / 2; // 內側邊線 28.5
    const segs = [['z', -ie, -HALF + 2.5, lz0], ['z', -ie, rz1, HALF - 2.5], ['z', ie, -HALF + 2.5, HALF - 2.5], ['x', -ie, -HALF + 2.5, HALF - 2.5], ['x', ie, -HALF + 2.5, HALF - 2.5]];
    for (const [ax, c, a, b2] of segs) {
      const off = c < 0 ? 0.12 : -0.12;
      if (ax === 'z') { railZ(c + off * -1 + (c < 0 ? -0.24 : 0.24), a, b2, () => WH); const xx = c < 0 ? c - 0.35 : c + 0.35; solid(Math.min(c, xx), Math.max(c, xx), a, b2, WH + 1.1, WH - 0.3); }
      else { railX(c + (c < 0 ? -0.24 : 0.24), a, b2, WH); const zz = c < 0 ? c - 0.35 : c + 0.35; solid(a, b2, Math.min(c, zz), Math.max(c, zz), WH + 1.1, WH - 0.3); }
      W.solids[W.solids.length - 1].walk = false;
    }
    // 西牆 z 11~23 段的內側（緊鄰坡道）也加欄杆，避免從城牆跳到坡道外
    railZ(-ie - 0.24, rz0, rz1, () => WH); solid(-ie - 0.35, -ie, rz0, rz1, WH + 1.1, WH - 0.3); W.solids[W.solids.length - 1].walk = false;

    /* ===== 城內 ===== */
    const city = new Builder();
    // 縣衙
    hall(city, 0, 0, -16, 0, 10, 5, { h: 3.4, second: true, rh: 2.4 });
    solid(-6.2, 6.2, -19.2, -12.8, 12);
    for (let i = 0; i < 4; i++) city.box(6 - i * 0.6, 0.12 + i * 0.12, 0.6, '#c9c0ae', { p: [0, 0.06 + i * 0.12, -12.4 + i * 0.0 + (3 - i) * 0.6 - 1.2] });
    tq(tex.plaque('西城縣衙'), 3.6, 1.0, [0, 3.6, -13.08], 0);
    for (const sx of [-1, 1]) { city.box(1.4, 0.6, 1.4, '#b8b4aa', { p: [sx * 4, 0.3, -9] }); city.sphere(0.55, '#c8c4ba', { p: [sx * 4, 1.1, -9], s: [0.8, 1, 0.9] }); city.sphere(0.35, '#c8c4ba', { p: [sx * 4, 1.75, -8.8] }); circle(sx * 4, -9, 0.9); }
    // 廣場旗桿
    for (const sx of [-1, 1]) { const fp = new Builder(); fp.cyl(0.08, 0.1, 7, 6, '#6a3f1f', { p: [sx * 6, 3.5, -6] }); fp.sphere(0.2, '#f2c14e', { p: [sx * 6, 7.1, -6] }); city.merge(fp); circle(sx * 6, -6, 0.3); }
    // 糧倉區（東南）
    silo(city, 18, 14, 1); silo(city, 22.5, 18, 1.1); silo(city, 17, 22, 0.9);
    house(city, 22, 9, PI, 5, 3.5, { wall: '#efe2c4' }); tq(tex.plaque('糧倉'), 1.8, 0.7, [22, 3.6, 7.0], PI);
    for (let i = 0; i < 6; i++) city.merge(itemB('grain'), { p: [12 + (i % 3) * 0.9, 0, 20 + Math.floor(i / 3) * 0.9], r: [0, i, 0] });
    cart(city, 9, 20, 0.4); city.merge(itemB('hay'), { p: [25, 0, 24] }); city.merge(itemB('hay'), { p: [24, 0, 25.5], s: 0.8 });
    // 書院區（東北）
    hall(city, 18, 0, -20, 0, 8, 4, { h: 3, rh: 2, wall: '#f6efe0', roof: '#4a5a4a' }); solid(12.8, 23.2, -23.2, -16.8, 10);
    tq(tex.plaque('西城書院'), 3.2, 0.9, [18, 3.3, -17.62], 0);
    const pav = at(10, 0, -22, 0); city.box(3.4, 0.4, 3.4, '#c9c0ae', pav(0, 0.2, 0)); for (const sx of [-1, 1]) for (const sz of [-1, 1]) city.cyl(0.15, 0.15, 2.6, 6, '#b0302a', pav(sx * 1.4, 1.7, sz * 1.4)); city.roof(4.6, 4.6, 1.6, '#4a5a4a', pav(0, 3.0, 0)); city.sphere(0.25, '#f2c14e', pav(0, 4.7, 0));
    circle(10, -22, 0.8);
    for (const [x, z] of [[13, -12], [23, -12], [25, -25]]) stoneLantern(city, x, z);
    for (const [x, z] of [[25, -16], [26, -21], [8, -15], [7, -26]]) tree(city, x, z, 'sakura', 0.9);
    tree(city, 25.5, -8, 'bamboo'); tree(city, 6.5, -9, 'bamboo');
    for (let i = 0; i < 3; i++) city.merge(itemB('scroll'), { p: [14.8 + i * 1.6, 0.5, -14.2], r: [0, 0, 0] });
    for (let i = 0; i < 3; i++) { city.box(1.2, 0.5, 0.6, '#8a5a32', { p: [14.8 + i * 1.6, 0.25, -14] }); circle(14.8 + i * 1.6, -14, 0.6); }
    // 民居（西南、西北、東北空地）
    const houses = [[-20, 10, 0], [-13, 10, 0], [-18.5, 19, PI], [-12, 19, PI], [-9, 24, PI], [-21, -10, PI], [-13, -10, PI], [-20, -20, 0], [-12, -21, 0], [-15, 25, PI], [10, 6, PI / 2], [24, 0, -PI / 2]];
    houses.forEach(([x, z, r], i) => house(city, x, z, r, 4 + (i % 2), 3.2, { roof: i % 3 === 0 ? '#5a4a6a' : '#46505e', wall: i % 2 ? '#f6efe0' : '#efe5d2' }));
    // 市集
    stall(city, -8, 6, 0, '#e85a4f'); stall(city, -14, 5, 0, '#4fa8d8'); stall(city, -20, 5, 0, '#f2c14e'); stall(city, -8, -5, PI, '#7fbf5a'); stall(city, -15, -4.5, PI, '#c58aff');
    well(city, -16, -15); well(city, 6, 15);
    for (const [x, z] of [[-4, 4], [4, 4], [-4, -4], [4, -4], [-4, 22], [4, 22], [-24, 2.5], [-4, -24], [24, 3.5]]) lanternPost(city, x, z);
    for (const [x, z] of [[-24, -25], [-24.5, -15], [8, 25], [-6, 14], [6, -2.5 - 20]]) tree(city, x, z, 'round', 0.8);
    flowers(city, -6, 12, 12); flowers(city, 14, -6, 10); flowers(city, -24, -4, 10);
    root.add(new Node(city.build(R)));

    /* ===== 蜀軍大營（東南） ===== */
    const shu = new Builder();
    const SX = 58, SZ = 62;
    tent(shu, SX + 8, SZ - 6, '#f6efe0', '#c0392b', 1.4); tent(shu, SX - 6, SZ + 8, '#f6efe0', '#3f8a4a'); tent(shu, SX + 10, SZ + 6, '#f6efe0', '#c0392b'); tent(shu, SX - 14, SZ + 2, '#f6efe0', '#3f8a4a'); tent(shu, SX + 2, SZ + 12, '#f6efe0', '#c0392b');
    tent(shu, SX + 16, SZ - 2, '#f6efe0', '#c0392b', 0.9); tent(shu, SX - 4, SZ - 12, '#f6efe0', '#3f8a4a', 0.9);
    weaponRack(shu, SX - 2, SZ - 3, 0); drum(shu, SX + 4, SZ - 4, 0);
    for (let i = 0; i < 3; i++) target(shu, SX + 14 + i * 3, SZ + 14, PI);
    fence(shu, SX - 4, SZ - 16, SX + 22, SZ - 16); fence(shu, SX - 16, SZ - 16, SX - 11, SZ - 16); fence(shu, SX + 22, SZ - 16, SX + 22, SZ + 20); fence(shu, SX - 16, SZ + 20, SX + 22, SZ + 20);
    for (const [x, z] of [[SX - 14, SZ + 18], [SX + 20, SZ - 14], [SX + 20, SZ + 18]]) tree(shu, x, z, 'pine');
    shu.merge(itemB('hay'), { p: [SX - 12, ground(SX - 12, SZ + 10), SZ + 10] }); shu.merge(itemB('hay'), { p: [SX - 13, ground(SX - 13, SZ + 12), SZ + 12], s: 0.8 });
    // 營火
    shu.cyl(1.0, 1.1, 0.3, 10, '#8a8a80', { p: [SX + 1, ground(SX + 1, SZ + 3) + 0.15, SZ + 3] });
    for (let i = 0; i < 5; i++) shu.cyl(0.08, 0.08, 1.4, 4, '#6a3a1a', { p: [SX + 1, ground(SX + 1, SZ + 3) + 0.4, SZ + 3], r: [0, i * 1.25, 1.2] });
    W.campfire = [SX + 1, ground(SX + 1, SZ + 3) + 0.5, SZ + 3]; circle(SX + 1, SZ + 3, 1.0);
    root.add(new Node(shu.build(R)));
    W.flagsSpots = [];
    const flagNode = (x, z, col, ch) => { const n = new Node(MD.item(R, 'flagpole', { color: col })); n.pos = [x, ground(x, z), z]; root.add(n); const t1 = new Node(); t1.tq = { tex: tex.flag(ch), w: 1.1, h: 1.1 }; t1.pos = [0.05, 3.35, 0.68]; t1.rot = [0, PI / 2, 0]; n.add(t1); const t2 = new Node(); t2.tq = t1.tq; t2.pos = [-0.05, 3.35, 0.68]; t2.rot = [0, -PI / 2, 0]; n.add(t2); circle(x, z, 0.3); dyn.push({ type: 'flag', node: n }); return n; };
    flagNode(SX - 14, SZ - 14, '#c0392b', '蜀'); flagNode(SX + 20, SZ - 14, '#c0392b', '漢'); flagNode(SX - 14, SZ + 18, '#3f8a4a', '蜀');
    flagNode(-4, 33, '#c0392b', '漢'); flagNode(4, 33, '#c0392b', '蜀');

    /* ===== 魏軍大營（西） ===== */
    const wei = new Builder(); const WX = -82, WZ = -6;
    tent(wei, WX - 6, WZ, '#e8e4f0', '#5a3f8a', 1.5); tent(wei, WX + 4, WZ - 10, '#e8e4f0', '#3f4a8a'); tent(wei, WX + 4, WZ + 10, '#e8e4f0', '#3f4a8a'); tent(wei, WX - 8, WZ - 12, '#e8e4f0', '#5a3f8a'); tent(wei, WX - 8, WZ + 12, '#e8e4f0', '#5a3f8a'); tent(wei, WX - 2, WZ + 18, '#e8e4f0', '#3f4a8a', 0.9);
    drum(wei, WX + 6, WZ - 3, PI / 2); drum(wei, WX + 6, WZ + 3, PI / 2); weaponRack(wei, WX - 2, WZ - 6, PI / 2);
    fence(wei, WX - 16, WZ - 20, WX + 10, WZ - 20); fence(wei, WX - 16, WZ + 22, WX + 10, WZ + 22); fence(wei, WX - 16, WZ - 20, WX - 16, WZ + 22);
    for (const [x, z] of [[WX - 14, WZ - 18], [WX - 14, WZ + 20], [WX + 8, WZ + 24]]) tree(wei, x, z, 'pine', 1.1);
    root.add(new Node(wei.build(R)));
    flagNode(WX + 9, WZ - 8, '#5a3f8a', '魏'); flagNode(WX + 9, WZ + 8, '#5a3f8a', '魏'); flagNode(WX - 15, WZ, '#3f4a8a', '司馬');
    W.weiRegiments = [];
    for (const [x, z] of [[WX - 2, WZ - 18], [WX + 2, WZ + 26]]) { const rg = W.regiment(R, 3, 5, '#7a6a9a', '#8a4fc8', '#5a3f8a', tex.flag('魏')); rg.pos = [x, ground(x, z), z]; rg.rot = [0, PI / 2, 0]; root.add(rg); }

    /* ===== 烽火台（西南山丘） ===== */
    const bc = new Builder(); const BX = -50, BZ = 25, BY = ground(BX, BZ);
    bc.lathe([[3.2, 0], [2.6, 4], [2.4, 4.4], [2.7, 4.6], [2.7, 5.0]], 8, '#c9b8a0', { p: [BX, BY - 0.3, BZ] }, { flat: true });
    for (let i = 0; i < 8; i++) { const a = i * PI / 4; bc.box(0.7, 0.8, 0.7, '#c9b8a0', { p: [BX + Math.cos(a) * 2.4, BY + 5.0, BZ + Math.sin(a) * 2.4], r: [0, -a, 0] }); }
    bc.cyl(0.9, 0.6, 0.8, 10, '#5a5a5a', { p: [BX, BY + 5.1, BZ] }); bc.cyl(0.85, 0.85, 0.1, 10, '#3a2a1a', { p: [BX, BY + 5.5, BZ] });
    // 樓梯
    for (let i = 0; i < 12; i++) bc.box(1.6, 0.42, 0.7, '#b8a890', { p: [BX + 3.2 + i * 0.0, BY - 0.2 + i * 0.42, BZ + 3.6 - i * 0.6], r: [0, 0, 0] });
    W.beaconFire = [BX, BY + 5.6, BZ];
    W.beacons = [];
    for (const [dx, dz] of [[-7, -5], [6, -6], [-6, 6], [7, 5]]) { const x = BX + dx, z = BZ + dz, y = ground(x, z); bc.lathe([[1.0, 0], [0.8, 1.6], [1.0, 1.8]], 8, '#c9b8a0', { p: [x, y, z] }, { flat: true }); bc.cyl(0.6, 0.45, 0.5, 8, '#5a5a5a', { p: [x, y + 2.0, z] }); W.beacons.push([x, y + 2.3, z]); circle(x, z, 1.0); }
    tree(bc, BX - 10, BZ + 2, 'pine'); tree(bc, BX + 9, BZ + 4, 'pine'); rock(bc, BX + 4, BZ + 9, 1.2); rock(bc, BX - 5, BZ + 10, 0.9);
    root.add(new Node(bc.build(R)));
    circle(BX, BZ, 3.2);

    /* ===== 北方山路（關興、張苞埋伏處） ===== */
    const np = new Builder();
    for (let i = 0; i < 18; i++) { const z = -64 - i * 2.2; for (const s of [-1, 1]) { const x = -35 - (z + 72) * 0.1 + s * (8 + Math.random() * 3); rock(np, x, z, 1.2 + Math.random() * 1.2); } }
    for (const [x, z] of [[-46, -66], [-24, -68], [-47, -78], [-22, -80], [-44, -86], [-26, -90], [-50, -72], [-20, -74]]) tree(np, x, z, 'pine', 1.2 + Math.random() * 0.4);
    for (const [x, z] of [[-41, -76], [-29, -77]]) { np.box(2.5, 1.2, 0.4, '#8a5a32', { p: [x, ground(x, z) + 0.6, z] }); }
    root.add(new Node(np.build(R)));
    flagNode(-43, -70, '#3f8a4a', '關'); flagNode(-27, -70, '#c0392b', '張');

    /* ===== 樹林、山脈、花草（區塊合併） ===== */
    const avoid = (x, z) => inCity(x, z) || Math.abs(x) < 34 && Math.abs(z) < 34 || (z > W.RIVER.z0 - 4 && z < W.RIVER.z1 + 4) || roadDist(x, z) < 4 || Math.hypot(x - SX, z - SZ) < 24 || Math.hypot(x - WX, z - WZ) < 26 || Math.hypot(x - BX, z - BZ) < 11 || (z < -58 && Math.abs(x + 35) < 12) || (x > -62 && x < -30 && Math.abs(z) < 16);
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 260; i++) { const x = rnd() * 180 - 90, z = rnd() * 180 - 90; if (avoid(x, z)) continue; const k = rnd(); tree(chunk(x, z), x, z, k < 0.35 ? 'pine' : k < 0.5 ? 'sakura' : k < 0.6 ? 'bamboo' : 'round', 0.8 + rnd() * 0.6); }
    for (let i = 0; i < 40; i++) { const x = rnd() * 180 - 90, z = rnd() * 180 - 90; if (avoid(x, z)) continue; flowers(chunk(x, z), x, z, 10); }
    for (let i = 0; i < 30; i++) { const x = rnd() * 180 - 90, z = rnd() * 180 - 90; if (avoid(x, z)) continue; rock(chunk(x, z), x, z, 0.5 + rnd()); }
    for (let x = -100; x <= 100; x += 9) { const z = W.RIVER.z0 - 3.5; if (Math.abs(x) < 6 || Math.abs(x - 50) < 6) continue; if (rnd() < 0.5) tree(chunk(x, z), x, z, 'willow', 0.9); }
    for (const [x, z] of [[-18, 57], [18, 57], [-8, 36], [28, 36], [36, -36], [-36, -36], [40, 20]]) tree(chunk(x, z), x, z, 'sakura', 1.1);
    for (const [k, b] of Object.entries(chunks)) root.add(new Node(b.build(R)));
    // 遠山
    const mt = new Builder();
    for (let i = 0; i < 46; i++) { const a = i / 46 * PI * 2; const r = 118 + (i % 3) * 14; const x = Math.cos(a) * r, z = Math.sin(a) * r; const north = z < -60; mountain(mt, x, z, 22 + (i % 4) * 6, (north ? 34 : 22) + (i % 5) * 5, (i % 4 === 0 || north) ? 'snow' : (i % 2 ? '#7fb08a' : '#6fa86e')); }
    for (const [x, z, r, h] of [[-58, -92, 18, 30], [-12, -92, 18, 28], [-70, -78, 12, 18], [-2, -80, 12, 16], [10, -96, 16, 26], [-88, -90, 18, 30]]) mountain(mt, x, z, r, h, 'snow');
    root.add(new Node(mt.build(R)));

    root.add(new Node(big.build(R)));

    /* ===== 關卡地點 ===== */
    W.stations = [
      { id: 1, pos: [50, 0, 52], look: [58, 62] },
      { id: 2, pos: [13, 0, 13], look: [18, 16] },
      { id: 3, pos: [-46, 0, 28.5], look: [-50, 25] },
      { id: 4, pos: [0, 0, -7], look: [0, -16] },
      { id: 5, pos: [-29.8, WH, 9], look: [-30, 5] },
      { id: 6, pos: [-70, 0, -5], look: [-82, -6] },
      { id: 7, pos: [-35, 0, -70], look: [-35, -80] },
      { id: 8, pos: [18, 0, -10], look: [18, -20] }
    ];
    for (const s of W.stations) if (s.id !== 5) s.pos[1] = ground(s.pos[0], s.pos[2]);
    W.spawn = [55, 0, 64];
    // 收集物位置
    W.collectSpots = {
      grain: [[8, 16], [20, 26], [26, 12], [14, 26], [6, 9], [24, 22], [14.5, 3], [26, 4], [5, 24], [18, 8]],
      flag: [[-24, -6], [-8, -24], [24, -6], [-25.5, 27], [8, -6], [-14, -26], [26, 26], [-2, 16]]
    };
    W.dyn = dyn;
    W.root = root;
    return root;
  };

  function itemB(kind) { const b = new Builder(); const R0 = { createMesh: () => null }; // 只取幾何
    const fake = { build: () => b };
    switch (kind) {
      case 'grain': MD.grainSack(b, {}); break;
      case 'hay': b.cyl(0.45, 0.5, 0.7, 10, '#e8c870', { p: [0, 0.35, 0] }); b.cyl(0.0, 0.45, 0.4, 10, '#f0d890', { p: [0, 0.9, 0] }); break;
      case 'scroll': b.box(0.9, 0.6, 0.02, '#f8edd0', { p: [0, 0.4, 0] }); b.cyl(0.05, 0.05, 1.0, 8, '#8a4a2a', { p: [0, 0.72, 0], r: [0, 0, PI / 2] }); b.cyl(0.05, 0.05, 1.0, 8, '#8a4a2a', { p: [0, 0.08, 0], r: [0, 0, PI / 2] }); for (let i = 0; i < 5; i++) b.box(0.03, 0.4, 0.01, '#33302a', { p: [-0.3 + i * 0.15, 0.4, 0.015] }); break;
    }
    return b;
  }

  window.WORLD = W;
})();
