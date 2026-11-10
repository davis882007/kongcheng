/* =========================================================
   models.js — Q版三國 3D 模型：人物、坐騎、兵器、道具、建築
   ========================================================= */
(function () {
  'use strict';
  const { Builder, Node, shade, hex } = M3D;
  const MD = {};

  /* ---------- 捏角選項（可自行增減） ---------- */
  MD.OPTIONS = {
    gender: [['m', '男生'], ['f', '女生']],
    skin: ['#ffe2c6', '#f6d0ae', '#e8b98f', '#c98f63'],
    hairM: [['bun', '束髮髻'], ['long', '長髮飄逸'], ['short', '俐落短髮'], ['pony', '武將馬尾']],
    hairF: [['twin', '雙丫髻'], ['high', '高雲髻'], ['long', '長髮披肩'], ['pony', '俠女馬尾']],
    hairCol: ['#1d1a22', '#4a2f22', '#7a4a2a', '#2a3550', '#cfcbd6', '#8a2f2a'],
    beard: [['none', '無'], ['goatee', '八字鬍'], ['long', '美髯公']],
    hat: [['none', '不戴'], ['lunjin', '綸巾（孔明）'], ['helmet', '將軍盔'], ['phoenix', '鳳翅盔'], ['crown', '紫金冠'], ['guan', '文官冠'], ['douli', '斗笠'], ['band', '抹額'], ['flower', '花鈿步搖']],
    outfit: [['robe', '文士長袍'], ['armor', '將軍鎧甲'], ['battle', '戰袍披甲'], ['taoist', '仙鶴道袍'], ['dress', '襦裙'], ['cloth', '俠客布衣']],
    clothCol: ['#a9cfd9', '#d9534f', '#3f8a4a', '#4a68b0', '#7d4fa8', '#e8b84a', '#f2f0e8', '#2e3440', '#e88fb0', '#3fb0a8', '#b0703a', '#8a1f2e'],
    accentCol: ['#f4c95d', '#ffffff', '#b8432f', '#2f5a3a', '#1f2f5a', '#5a2f7a', '#c0c8d0', '#111111'],
    acc: [['none', '無'], ['cape', '英雄披風'], ['jade', '玉珮'], ['scroll', '兵書'], ['pouch', '錦囊'], ['gourd', '葫蘆'], ['backflag', '背旗'], ['bow', '長弓']],
    weapon: [['fan', '羽扇'], ['guandao', '青龍偃月刀'], ['snake', '丈八蛇矛'], ['halberd', '方天畫戟'], ['twin', '雙股劍'], ['qinggang', '青釭劍'], ['spear', '涯角槍'], ['dao', '古錠刀'], ['crossbow', '諸葛連弩']],
    horse: [['chitu', '赤兔馬'], ['dilu', '的盧'], ['jueying', '絕影'], ['zhuahuang', '爪黃飛電'], ['zhaoye', '照夜玉獅子'], ['none', '不騎馬']]
  };
  MD.HORSE_INFO = {
    chitu: '呂布、關羽的坐騎，日行千里，全身火紅。',
    dilu: '劉備的坐騎，曾載劉備躍過檀溪脫險。',
    jueying: '曹操的坐騎，快得連影子都追不上。',
    zhuahuang: '曹操的名馬，白身黃蹄，奔跑如閃電。',
    zhaoye: '傳說中趙雲的白馬，夜裡也閃閃發亮。',
    none: '徒步行走，腳踏實地。'
  };
  MD.WEAPON_INFO = {
    fan: '諸葛亮的招牌羽扇，運籌帷幄。', guandao: '關羽的神兵，關興也曾使用。', snake: '張飛的兵器，張苞繼承父親的蛇矛。',
    halberd: '呂布的方天畫戟。', twin: '劉備的雙股劍。', qinggang: '曹操的寶劍，後被趙雲奪得。', spear: '趙雲的涯角槍。',
    dao: '孫堅的古錠刀。', crossbow: '諸葛亮發明，一次可連發十箭。'
  };

  /* ---------- 兵器 ---------- */
  MD.weapon = function (b, type, t) {
    const T = (p) => ({ p: [p[0] + (t.p ? t.p[0] : 0), p[1] + (t.p ? t.p[1] : 0), p[2] + (t.p ? t.p[2] : 0)], r: t.r || [0, 0, 0] });
    const wood = '#7a4a26', gold = '#f2c14e', steel = '#dfe6ee', red = '#d6352b';
    const add = (fn) => { const sub = new Builder(); fn(sub); b.merge(sub, { p: t.p || [0, 0, 0], r: t.r || [0, 0, 0], s: t.s || 1 }); };
    add((w) => {
      switch (type) {
        case 'fan':
          w.cyl(0.025, 0.025, 0.32, 6, '#5a3a22', { p: [0, 0.05, 0] });
          w.sphere(0.22, '#fdfdf8', { p: [0, 0.38, 0], s: [1, 1.15, 0.18] }, 12, 8);
          w.sphere(0.16, '#e8e4d8', { p: [0, 0.34, 0.01], s: [1, 1.1, 0.2] }, 10, 6);
          w.box(0.18, 0.03, 0.06, '#3a2a1a', { p: [0, 0.2, 0] });
          break;
        case 'guandao':
          w.cyl(0.035, 0.035, 2.3, 6, '#2f5a3a', { p: [0, 0.75, 0] });
          w.box(0.06, 0.62, 0.32, '#5fcf9a', { p: [0, 2.05, 0.12], r: [0.15, 0, 0] });
          w.sphere(0.16, '#3fae7a', { p: [0, 2.2, 0.26], s: [0.4, 1.2, 0.8] });
          w.torus(0.1, 0.03, gold, { p: [0, 1.88, 0], r: [Math.PI / 2, 0, 0] }, 10, 6);
          w.sphere(0.09, red, { p: [0, 1.78, -0.02], s: [1, 1.6, 1] });
          w.cone ? 0 : 0;
          w.cyl(0, 0.04, 0.16, 6, gold, { p: [0, -0.45, 0], r: [Math.PI, 0, 0] });
          break;
        case 'snake':
          w.cyl(0.03, 0.03, 2.5, 6, '#2a2a2a', { p: [0, 0.85, 0] });
          for (let i = 0; i < 5; i++) w.box(0.05, 0.14, 0.08, steel, { p: [0, 2.12 + i * 0.12, (i % 2 ? 0.035 : -0.035)], r: [(i % 2 ? -0.5 : 0.5), 0, 0] });
          w.cyl(0, 0.05, 0.18, 6, steel, { p: [0, 2.78, 0] });
          w.sphere(0.1, red, { p: [0, 2.02, 0], s: [1, 1.4, 1] });
          break;
        case 'halberd':
          w.cyl(0.03, 0.03, 2.4, 6, '#8a1f2e', { p: [0, 0.8, 0] });
          w.cyl(0, 0.06, 0.4, 6, steel, { p: [0, 2.2, 0] });
          w.torus(0.17, 0.03, steel, { p: [0, 1.95, 0.17], r: [0, 0, Math.PI / 2] }, 10, 5, Math.PI);
          w.torus(0.17, 0.03, steel, { p: [0, 1.95, -0.17], r: [0, Math.PI, Math.PI / 2] }, 10, 5, Math.PI);
          w.sphere(0.09, gold, { p: [0, 1.88, 0] });
          w.sphere(0.08, red, { p: [0, 1.76, 0], s: [1, 1.5, 1] });
          break;
        case 'twin': case 'qinggang': case 'sword':
          w.cyl(0.03, 0.03, 0.22, 6, '#3a2a1a', { p: [0, 0.02, 0] });
          w.box(0.22, 0.05, 0.07, gold, { p: [0, 0.15, 0] });
          w.box(0.07, 0.75, 0.025, type === 'qinggang' ? '#a8d8ff' : steel, { p: [0, 0.55, 0] });
          w.cyl(0, 0.035, 0.1, 4, type === 'qinggang' ? '#a8d8ff' : steel, { p: [0, 0.97, 0] });
          if (type === 'qinggang') w.sphere(0.04, '#4fc3f7', { p: [0, 0.15, 0.04] });
          break;
        case 'spear':
          w.cyl(0.03, 0.03, 2.4, 6, '#e8e8f0', { p: [0, 0.8, 0] });
          w.cyl(0, 0.07, 0.36, 6, '#cfd8e6', { p: [0, 2.18, 0] });
          w.sphere(0.12, red, { p: [0, 1.92, 0], s: [1, 1.3, 1] });
          w.torus(0.06, 0.02, gold, { p: [0, 2.0, 0], r: [Math.PI / 2, 0, 0] }, 8, 5);
          break;
        case 'dao':
          w.cyl(0.035, 0.035, 0.3, 6, '#3a2a1a', { p: [0, 0.05, 0] });
          w.torus(0.08, 0.025, gold, { p: [0, 0.22, 0], r: [Math.PI / 2, 0, 0] }, 10, 5);
          w.box(0.07, 0.7, 0.16, steel, { p: [0, 0.6, 0.04] });
          w.sphere(0.1, steel, { p: [0, 0.94, 0.06], s: [0.35, 1, 0.9] });
          w.box(0.07, 0.6, 0.03, '#b8c4d0', { p: [0, 0.6, -0.05] });
          break;
        case 'crossbow':
          w.box(0.08, 0.08, 0.6, '#6a3f1f', { p: [0, 0.1, 0.2] });
          w.torus(0.32, 0.025, '#4a2f17', { p: [0, 0.12, 0.42], r: [0, 0, 0] }, 12, 5, Math.PI);
          w.box(0.14, 0.18, 0.14, '#3a2a1a', { p: [0, 0.22, 0.1] });
          for (let i = 0; i < 3; i++) w.cyl(0.012, 0.012, 0.6, 4, steel, { p: [-0.03 + i * 0.03, 0.18, 0.25], r: [Math.PI / 2, 0, 0] });
          break;
        case 'broom':
          w.cyl(0.025, 0.025, 1.5, 6, '#a07040', { p: [0, 0.3, 0] });
          w.cyl(0.05, 0.2, 0.45, 8, '#d8b060', { p: [0, -0.6, 0] });
          break;
        case 'incense':
          w.cyl(0.12, 0.09, 0.14, 10, '#3a5a5a', { p: [0, 0.07, 0] });
          w.sphere(0.08, '#4a6a6a', { p: [0, 0.18, 0], s: [1, 0.6, 1] }, 10, 6, 0.5);
          break;
        case 'scrollh':
          w.cyl(0.05, 0.05, 0.4, 8, '#f4e6c0', { p: [0, 0, 0], r: [0, 0, Math.PI / 2] });
          w.cyl(0.06, 0.06, 0.06, 8, '#8a4a2a', { p: [0.22, 0, 0], r: [0, 0, Math.PI / 2] });
          w.cyl(0.06, 0.06, 0.06, 8, '#8a4a2a', { p: [-0.22, 0, 0], r: [0, 0, Math.PI / 2] });
          break;
        case 'flag':
          w.cyl(0.025, 0.025, 1.8, 6, wood, { p: [0, 0.6, 0] });
          w.box(0.03, 0.6, 0.5, red, { p: [0, 1.2, 0.27] });
          w.sphere(0.05, gold, { p: [0, 1.52, 0] });
          break;
      }
    });
  };

  /* ---------- 人物 ---------- */
  MD.defaultLook = function () {
    return { gender: 'm', skin: '#ffe2c6', hair: 'bun', hairCol: '#1d1a22', beard: 'none', hat: 'none', outfit: 'robe', clothCol: '#d9534f', accent: '#f4c95d', acc: 'cape', weapon: 'fan', horse: 'chitu' };
  };

  MD.character = function (R, L) {
    L = Object.assign(MD.defaultLook(), L || {});
    const root = new Node(); const parts = {};
    const skin = L.skin, cloth = L.clothCol, acc = L.accent, hairC = L.hairCol;
    const isArmor = L.outfit === 'armor' || L.outfit === 'battle';
    const metal = L.metal || (isArmor ? shade(cloth, 1.0) : cloth);
    const dark = '#2a2230';
    /* 腿 */
    const mkLeg = (side) => {
      const b = new Builder();
      const pants = isArmor ? shade(acc, 0.8) : (L.outfit === 'cloth' ? shade(cloth, 0.6) : '#f2efe6');
      b.cyl(0.095, 0.085, 0.42, 8, pants, { p: [0, -0.2, 0] });
      if (isArmor) b.cyl(0.1, 0.1, 0.2, 8, '#cfd6de', { p: [0, -0.36, 0.01] });
      b.box(0.17, 0.12, 0.26, isArmor ? '#3a2a22' : dark, { p: [0, -0.5, 0.04] });
      const n = new Node(b.build(R)); n.pos = [side * 0.13, 0.6, 0]; return n;
    };
    parts.legL = root.add(mkLeg(-1)); parts.legR = root.add(mkLeg(1));
    /* 身體 */
    const torso = new Node(); torso.pos = [0, 0.6, 0]; root.add(torso); parts.torso = torso;
    const tb = new Builder();
    const o = L.outfit;
    if (o === 'robe' || o === 'taoist') {
      const base = o === 'taoist' ? '#f6f4ee' : cloth;
      tb.lathe([[0.4, -0.56], [0.36, -0.3], [0.29, 0.0], [0.27, 0.25], [0.24, 0.48], [0.12, 0.56]], 16, base, {});
      tb.cyl(0.405, 0.405, 0.08, 16, o === 'taoist' ? '#2b2b33' : acc, { p: [0, -0.53, 0] });
      tb.torus(0.285, 0.035, o === 'taoist' ? '#2b2b33' : acc, { p: [0, 0.02, 0] }, 16, 6);
      // 交領
      tb.box(0.07, 0.42, 0.02, o === 'taoist' ? '#2b2b33' : acc, { p: [0.06, 0.32, 0.25], r: [0.1, 0, 0.45] });
      tb.box(0.07, 0.42, 0.02, o === 'taoist' ? '#2b2b33' : acc, { p: [-0.06, 0.32, 0.25], r: [0.1, 0, -0.45] });
      if (o === 'taoist') { tb.sphere(0.1, '#e8b84a', { p: [0, -0.2, 0.33], s: [1, 1, 0.3] }); tb.torus(0.11, 0.02, '#2b2b33', { p: [0, -0.2, 0.34], r: [Math.PI / 2, 0, 0] }, 12, 4); }
    } else if (o === 'dress') {
      tb.lathe([[0.46, -0.58], [0.38, -0.25], [0.27, 0.12], [0.25, 0.14]], 16, cloth, {});
      tb.cyl(0.47, 0.47, 0.06, 16, acc, { p: [0, -0.55, 0] });
      tb.lathe([[0.25, 0.12], [0.24, 0.3], [0.21, 0.48], [0.11, 0.56]], 16, shade(acc, 1.0), {});
      tb.torus(0.26, 0.04, '#ffffff', { p: [0, 0.14, 0] }, 16, 6);
      tb.box(0.05, 0.3, 0.05, '#ffffff', { p: [0.06, -0.05, 0.27], r: [0.15, 0, 0.1] });
      // 披帛
      tb.torus(0.4, 0.025, '#fff3f8', { p: [0, 0.2, -0.05], r: [0.4, 0, 0] }, 20, 5, Math.PI);
    } else if (o === 'cloth') {
      tb.lathe([[0.34, -0.3], [0.3, -0.05], [0.28, 0.2], [0.24, 0.48], [0.12, 0.56]], 14, cloth, {});
      tb.torus(0.29, 0.04, acc, { p: [0, -0.02, 0] }, 14, 6);
      tb.box(0.06, 0.4, 0.02, shade(cloth, 0.7), { p: [0.05, 0.3, 0.25], r: [0.1, 0, 0.4] });
      tb.box(0.08, 0.2, 0.03, acc, { p: [0.18, -0.15, 0.24], r: [0, 0, 0.1] });
    } else { // armor / battle
      if (o === 'battle') tb.lathe([[0.38, -0.5], [0.33, -0.2], [0.29, 0.02]], 16, acc, {});
      tb.lathe([[0.36, -0.3], [0.31, -0.05], [0.29, 0.02]], 10, shade(metal, 0.85), {}, { flat: true });
      for (let i = 0; i < 3; i++) tb.torus(0.3 + i * 0.022, 0.018, shade(metal, 1.15), { p: [0, -0.06 - i * 0.09, 0] }, 16, 4);
      tb.lathe([[0.29, 0.02], [0.28, 0.25], [0.25, 0.45], [0.13, 0.56]], 12, metal, {});
      tb.box(0.36, 0.3, 0.06, shade(metal, 1.1), { p: [0, 0.3, 0.24] });
      tb.sphere(0.07, '#d9a441', { p: [-0.09, 0.32, 0.28], s: [1, 1, 0.4] });
      tb.sphere(0.07, '#d9a441', { p: [0.09, 0.32, 0.28], s: [1, 1, 0.4] });
      tb.torus(0.3, 0.045, '#5a3a22', { p: [0, 0.03, 0] }, 16, 6);
      tb.sphere(0.1, '#f2c14e', { p: [0, 0.03, 0.31], s: [1, 1, 0.35] });
      tb.sphere(0.05, '#c0392b', { p: [0, 0.03, 0.34], s: [1, 1, 0.4] });
      tb.torus(0.14, 0.04, acc, { p: [0, 0.52, 0.02] }, 12, 5);
    }
    // 脖子
    tb.cyl(0.09, 0.1, 0.1, 8, skin, { p: [0, 0.57, 0] });
    // 配件（身上）
    if (L.acc === 'jade') { tb.torus(0.06, 0.02, '#4fbf8a', { p: [0.2, -0.08, 0.22], r: [0.3, 0, 0] }, 10, 5); tb.cyl(0.012, 0.012, 0.16, 4, '#d6352b', { p: [0.2, -0.2, 0.22] }); }
    if (L.acc === 'pouch') { tb.sphere(0.08, '#d6352b', { p: [-0.22, -0.08, 0.2], s: [1, 1.2, 0.7] }); tb.torus(0.04, 0.012, '#f2c14e', { p: [-0.22, 0.02, 0.2] }, 8, 4); }
    if (L.acc === 'gourd') { tb.sphere(0.08, '#e0a83a', { p: [-0.25, -0.15, 0.12] }); tb.sphere(0.055, '#e0a83a', { p: [-0.25, -0.03, 0.12] }); tb.cyl(0.015, 0.015, 0.05, 5, '#6a3f1f', { p: [-0.25, 0.03, 0.12] }); }
    if (L.acc === 'scroll') { tb.cyl(0.07, 0.07, 0.5, 10, '#f4e6c0', { p: [0, 0.25, -0.33], r: [0, 0, 0.9] }); tb.cyl(0.075, 0.075, 0.06, 10, '#8a4a2a', { p: [0.2, 0.39, -0.33], r: [0, 0, 0.9] }); }
    if (L.acc === 'bow') { tb.torus(0.4, 0.022, '#6a3f1f', { p: [0, 0.2, -0.3], r: [0, Math.PI / 2, 0.6] }, 14, 4, Math.PI); tb.cyl(0.08, 0.08, 0.4, 8, '#8a4a2a', { p: [0.12, 0.25, -0.3], r: [0, 0, -0.6] }); }
    if (L.acc === 'backflag') {
      for (const s of [-1, 1]) { tb.cyl(0.015, 0.015, 1.2, 4, '#5a3a22', { p: [s * 0.12, 0.7, -0.28], r: [0, 0, -s * 0.2] }); tb.tris([0, 0, 0, 0, -0.5, 0, s * 0.36, -0.25, 0], acc, { p: [s * 0.24, 1.25, -0.3] }); tb.tris([0, 0, 0, s * 0.36, -0.25, 0, 0, -0.5, 0], acc, { p: [s * 0.24, 1.25, -0.3] }); }
    }
    torso.add(new Node(tb.build(R)));
    if (isArmor || o === 'battle') { // 護肩
      const sb = new Builder();
      for (const s of [-1, 1]) { sb.sphere(0.16, shade(metal, 1.08), { p: [s * 0.29, 0.44, 0], s: [1, 0.7, 1] }, 10, 6, 0.6); sb.torus(0.15, 0.02, '#f2c14e', { p: [s * 0.29, 0.42, 0] }, 12, 4); }
      torso.add(new Node(sb.build(R)));
    }
    if (L.acc === 'cape') {
      const cb = new Builder(); cb.lathe([[0.62, -0.6], [0.42, 0.0], [0.26, 0.5]], 12, acc === '#ffffff' ? '#d6352b' : acc, {}, { a0: Math.PI * 1.08, arc: Math.PI * 0.84 });
      const cn = new Node(cb.build(R)); cn.noCull = true; cn.pos = [0, 0, -0.04]; torso.add(cn); parts.cape = cn;
    }
    /* 手臂 */
    const wide = (o === 'robe' || o === 'taoist' || o === 'dress');
    const mkArm = (side) => {
      const b = new Builder();
      const sleeve = isArmor ? metal : (o === 'taoist' ? '#f6f4ee' : (o === 'dress' ? shade(acc, 1.0) : cloth));
      if (wide) { b.cyl(0.09, 0.17, 0.4, 10, sleeve, { p: [0, -0.2, 0] }); b.cyl(0.175, 0.175, 0.05, 10, o === 'taoist' ? '#2b2b33' : (o === 'dress' ? '#ffffff' : acc), { p: [0, -0.4, 0] }); }
      else { b.cyl(0.085, 0.09, 0.38, 8, sleeve, { p: [0, -0.19, 0] }); if (isArmor) b.cyl(0.1, 0.1, 0.12, 8, '#d9a441', { p: [0, -0.33, 0] }); }
      b.sphere(0.085, skin, { p: [0, -0.46, 0] }, 10, 8);
      const n = new Node(b.build(R)); n.pos = [side * 0.3, 0.45, 0]; n.rot = [0, 0, side * 0.12]; torso.add(n); return n;
    };
    parts.armL = mkArm(-1); parts.armR = mkArm(1);
    /* 兵器 */
    const wtype = L.weapon;
    if (wtype && wtype !== 'none') {
      const wb = new Builder(); MD.weapon(wb, wtype === 'twin' ? 'sword' : wtype, { p: [0, 0, 0] });
      const wn = new Node(wb.build(R)); wn.pos = [0, -0.47, 0.04]; parts.armR.add(wn); parts.weapon = wn;
      if (wtype === 'twin') { const wb2 = new Builder(); MD.weapon(wb2, 'sword', { p: [0, 0, 0] }); const w2 = new Node(wb2.build(R)); w2.pos = [0, -0.47, 0.04]; parts.armL.add(w2); parts.weapon2 = w2; }
    }
    /* 頭 */
    const head = new Node(); head.pos = [0, 0.6, 0]; torso.add(head); parts.head = head;
    const hb = new Builder(); const HY = 0.36;
    hb.sphere(0.38, skin, { p: [0, HY, 0], s: [1, 0.95, 0.95] }, 18, 14);
    hb.sphere(0.07, skin, { p: [-0.37, HY, 0], s: [0.5, 1, 0.8] }); hb.sphere(0.07, skin, { p: [0.37, HY, 0], s: [0.5, 1, 0.8] });
    // 眼睛
    for (const s of [-1, 1]) {
      hb.sphere(0.075, '#1b1622', { p: [s * 0.135, HY - 0.03, 0.335], s: [0.8, 1.1, 0.45] }, 10, 8);
      hb.sphere(0.026, '#ffffff', { p: [s * 0.135 + 0.025, HY + 0.01, 0.365] }, 6, 4);
      hb.sphere(0.055, '#ff9fb0', { p: [s * 0.22, HY - 0.1, 0.29], s: [1, 0.55, 0.3] }, 8, 6);
      hb.box(0.1, 0.022, 0.02, L.gender === 'f' ? shade(hairC, 1.2) : hairC, { p: [s * 0.13, HY + 0.12, 0.34], r: [0, 0, s * (L.brow || 0.12)] });
      if (L.gender === 'f') hb.box(0.04, 0.012, 0.02, '#1b1622', { p: [s * 0.19, HY + 0.05, 0.32], r: [0, 0, s * -0.5] });
    }
    hb.box(0.07, 0.022, 0.02, '#b8434f', { p: [0, HY - 0.15, 0.345] });
    // 鬍子
    if (L.gender === 'm' && L.beard !== 'none') {
      const bc = L.beardCol || (hairC === '#cfcbd6' ? '#e8e6ee' : '#1d1a22');
      hb.box(0.1, 0.025, 0.03, bc, { p: [-0.06, HY - 0.1, 0.35], r: [0, 0, 0.35] }); hb.box(0.1, 0.025, 0.03, bc, { p: [0.06, HY - 0.1, 0.35], r: [0, 0, -0.35] });
      if (L.beard === 'goatee') hb.cyl(0.0, 0.05, 0.16, 6, bc, { p: [0, HY - 0.28, 0.3], r: [Math.PI - 0.3, 0, 0] });
      else hb.lathe([[0.0, -0.32], [0.08, -0.15], [0.14, 0.0]], 8, bc, { p: [0, HY - 0.16, 0.25], s: [1, 1, 0.6] });
    }
    // 頭髮
    const hc = hairC;
    const covered = ['helmet', 'phoenix'].includes(L.hat);
    if (!covered) hb.sphere(0.4, hc, { p: [0, HY + 0.03, -0.03], s: [1.0, 0.98, 1.0] }, 16, 10, 0.55);
    hb.sphere(0.395, hc, { p: [0, HY - 0.02, -0.06], s: [1, 1, 0.95] }, 16, 10, 0.5);
    if (!covered) hb.sphere(0.2, hc, { p: [0, HY + 0.25, 0.25], s: [1.5, 0.45, 0.5] }, 10, 6);
    const hair = L.hair;
    if ((hair === 'bun' || hair === 'pony') && !covered && L.hat !== 'lunjin' && L.hat !== 'guan') { hb.sphere(0.13, hc, { p: [0, HY + 0.4, -0.05] }); hb.cyl(0.015, 0.015, 0.36, 4, '#f2c14e', { p: [0, HY + 0.42, -0.05], r: [0, 0, Math.PI / 2] }); }
    if (hair === 'pony') { hb.cyl(0.07, 0.11, 0.55, 8, hc, { p: [0, HY - 0.05, -0.38], r: [0.35, 0, 0] }); hb.torus(0.09, 0.025, L.accent, { p: [0, HY + 0.22, -0.32], r: [1.3, 0, 0] }, 10, 4); }
    if (hair === 'long') { hb.sphere(0.36, hc, { p: [0, HY - 0.4, -0.22], s: [1.0, 1.5, 0.45] }, 14, 10); }
    if (hair === 'short') { hb.sphere(0.12, hc, { p: [0.18, HY + 0.28, 0.18], s: [1, 0.6, 1] }); hb.sphere(0.12, hc, { p: [-0.2, HY + 0.3, 0.12], s: [1, 0.6, 1] }); }
    if (hair === 'twin') { for (const s of [-1, 1]) { hb.sphere(0.14, hc, { p: [s * 0.24, HY + 0.34, -0.02] }); hb.torus(0.1, 0.025, L.accent, { p: [s * 0.24, HY + 0.28, -0.02] }, 10, 4); } }
    if (hair === 'high') { hb.sphere(0.15, hc, { p: [0, HY + 0.45, -0.08], s: [1.2, 1, 1] }); hb.sphere(0.12, hc, { p: [0, HY + 0.62, -0.08], s: [1.3, 0.8, 0.9] }); hb.cyl(0.012, 0.012, 0.4, 4, '#f2c14e', { p: [0.1, HY + 0.52, -0.08], r: [0, 0, 1.1] }); hb.sphere(0.04, '#ff6b8a', { p: [0.27, HY + 0.6, -0.08] }); }
    if (L.gender === 'f' && hair !== 'long') hb.sphere(0.3, hc, { p: [0, HY - 0.15, -0.2], s: [1.05, 0.9, 0.5] }, 12, 8);
    // 帽子
    const hat = L.hat, hcol = L.hatCol;
    if (hat === 'lunjin') {
      const c = hcol || '#7fa6b8';
      hb.lathe([[0.36, HY + 0.12], [0.37, HY + 0.3], [0.33, HY + 0.52], [0.36, HY + 0.62], [0.28, HY + 0.68], [0.0, HY + 0.7]], 16, c, { p: [0, 0, -0.03] });
      for (let i = 0; i < 4; i++) hb.torus(0.355 - i * 0.008, 0.012, shade(c, 0.8), { p: [0, HY + 0.22 + i * 0.1, -0.03] }, 16, 3);
      hb.torus(0.08, 0.03, shade(c, 1.15), { p: [0, HY + 0.58, 0.32], r: [Math.PI / 2, 0, 0] }, 10, 5);
      hb.box(0.04, 0.4, 0.02, shade(c, 0.85), { p: [-0.1, HY + 0.1, -0.38], r: [0.2, 0, 0.2] }); hb.box(0.04, 0.4, 0.02, shade(c, 0.85), { p: [0.1, HY + 0.1, -0.38], r: [0.2, 0, -0.2] });
    } else if (hat === 'helmet' || hat === 'phoenix') {
      const c = hcol || (hat === 'phoenix' ? '#e8c35a' : '#c9d2dc');
      hb.sphere(0.43, c, { p: [0, HY + 0.08, -0.02] }, 16, 10, 0.55);
      hb.torus(0.42, 0.04, '#f2c14e', { p: [0, HY + 0.1, -0.02] }, 18, 5);
      hb.cyl(0.0, 0.06, 0.25, 8, '#f2c14e', { p: [0, HY + 0.6, -0.02] });
      hb.sphere(0.06, '#f2c14e', { p: [0, HY + 0.46, -0.02] });
      const plume = L.plume || '#e04a3a';
      hb.sphere(0.14, plume, { p: [0, HY + 0.7, -0.12], s: [0.7, 1.2, 1.3], r: [0.6, 0, 0] });
      hb.sphere(0.12, plume, { p: [0, HY + 0.55, -0.32], s: [0.6, 1.3, 1], r: [0.9, 0, 0] });
      hb.box(0.1, 0.08, 0.04, '#f2c14e', { p: [0, HY + 0.2, 0.41] });
      if (hat === 'phoenix') for (const s of [-1, 1]) { hb.box(0.04, 0.42, 0.16, '#f6d77a', { p: [s * 0.44, HY + 0.4, -0.02], r: [0, 0, -s * 0.5] }); hb.box(0.03, 0.3, 0.12, '#f2c14e', { p: [s * 0.52, HY + 0.52, -0.02], r: [0, 0, -s * 0.8] }); }
      for (const s of [-1, 1]) hb.box(0.04, 0.2, 0.2, c, { p: [s * 0.39, HY - 0.08, -0.05], r: [0, 0, s * 0.15] });
    } else if (hat === 'crown') {
      const c = hcol || '#8a4fc8';
      hb.lathe([[0.17, HY + 0.38], [0.2, HY + 0.52], [0.16, HY + 0.6]], 10, c, { p: [0, 0, -0.04] });
      hb.torus(0.19, 0.03, '#f2c14e', { p: [0, HY + 0.5, -0.04] }, 12, 5);
      hb.sphere(0.05, '#ff4a6a', { p: [0, HY + 0.52, 0.16] });
      for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const a = i * 0.16; hb.box(0.04, 0.2, 0.04, i % 2 ? '#c0392b' : '#f4f0e0', { p: [s * (0.12 + i * 0.07), HY + 0.68 + i * 0.16 - i * i * 0.012, -0.05 - i * 0.04], r: [0, 0, -s * (0.2 + a)] }); }
    } else if (hat === 'guan') {
      const c = hcol || '#20202a';
      hb.box(0.34, 0.32, 0.3, c, { p: [0, HY + 0.5, -0.05], r: [-0.15, 0, 0] });
      hb.box(0.38, 0.06, 0.34, '#f2c14e', { p: [0, HY + 0.36, -0.03] });
      hb.cyl(0.015, 0.015, 0.6, 4, '#f2c14e', { p: [0, HY + 0.5, -0.05], r: [0, 0, Math.PI / 2] });
    } else if (hat === 'douli') {
      const c = hcol || '#d8b060';
      hb.lathe([[0.75, HY + 0.3], [0.7, HY + 0.32], [0.3, HY + 0.55], [0.04, HY + 0.72]], 16, c, {}, {});
      hb.lathe([[0.04, HY + 0.7], [0.3, HY + 0.53], [0.7, HY + 0.3], [0.75, HY + 0.28]], 16, shade(c, 0.7), {}, {});
      hb.torus(0.32, 0.02, '#d6352b', { p: [0, HY + 0.53, 0] }, 16, 4);
    } else if (hat === 'band') {
      const c = hcol || '#d6352b';
      hb.torus(0.385, 0.045, c, { p: [0, HY + 0.17, -0.01], s: [1, 1, 0.98] }, 20, 6);
      hb.box(0.06, 0.35, 0.02, c, { p: [-0.07, HY, -0.4], r: [0.2, 0, 0.25] }); hb.box(0.06, 0.35, 0.02, c, { p: [0.07, HY, -0.4], r: [0.2, 0, -0.25] });
      hb.sphere(0.05, '#f2c14e', { p: [0, HY + 0.17, 0.39] });
    } else if (hat === 'flower') {
      for (let i = 0; i < 5; i++) hb.sphere(0.055, i % 2 ? '#ff8fb0' : '#ffd1e0', { p: [0.2 + Math.cos(i * 1.256) * 0.07, HY + 0.38 + Math.sin(i * 1.256) * 0.07, 0.12] });
      hb.sphere(0.04, '#f2c14e', { p: [0.2, HY + 0.38, 0.15] });
      hb.cyl(0.01, 0.01, 0.3, 4, '#f2c14e', { p: [-0.2, HY + 0.3, 0.05], r: [0, 0, 0.3] });
      hb.sphere(0.04, '#4fc3f7', { p: [-0.25, HY + 0.15, 0.06] }); hb.sphere(0.035, '#4fc3f7', { p: [-0.25, HY + 0.05, 0.06] });
      hb.sphere(0.03, '#e84a6a', { p: [0, HY + 0.2, 0.36] });
    }
    head.add(new Node(hb.build(R)));
    /* 動作 */
    const pose = { armR: 0, wR: 0 };
    if (wtype === 'fan') { pose.armR = -0.65; pose.wR = 0.5; }
    else if (['guandao', 'snake', 'halberd', 'spear', 'flag', 'broom'].includes(wtype)) { pose.armR = -0.35; pose.wR = 0.35; }
    else if (wtype === 'crossbow') { pose.armR = -1.2; pose.wR = 1.2; }
    else if (wtype === 'twin' || wtype === 'qinggang' || wtype === 'dao' || wtype === 'sword') { pose.armR = -0.5; pose.wR = -0.2; }
    const ch = { root, parts, look: L, t: Math.random() * 10, pose, riding: false };
    ch.animate = function (dt, speed, extra) {
      this.t += dt * (speed > 0.1 ? 8 + speed * 0.6 : 2.2);
      const s = Math.sin(this.t); const P = this.parts;
      if (this.sitting) {
        P.legL.rot = [-1.45, 0, -0.25]; P.legR.rot = [-1.45, 0, 0.25];
        P.armL.rot = [-0.9 + Math.sin(this.t * 3) * 0.08, 0, -0.1]; P.armR.rot = [-0.9 + Math.cos(this.t * 3) * 0.08, 0, 0.1];
        P.torso.pos[1] = 0.6; P.torso.rot = [0, 0, 0]; P.head.rot = [0.05, 0, Math.sin(this.t * 0.6) * 0.06];
        if (P.weapon) P.weapon.visible = false;
        if (extra) extra(this); return;
      }
      if (P.weapon) P.weapon.visible = true;
      if (this.riding) {
        P.legL.rot = [-1.3, 0, -0.5]; P.legR.rot = [-1.3, 0, 0.5];
        P.armL.rot = [-0.6, 0, -0.12]; P.armR.rot = [pose.armR - 0.2, 0, 0.12];
        P.torso.pos[1] = 0.6 + Math.abs(s) * 0.04 * Math.min(1, speed);
        P.head.rot = [0, 0, 0];
      } else if (speed > 0.1) {
        const a = Math.min(0.75, 0.25 + speed * 0.06);
        P.legL.rot = [s * a, 0, 0]; P.legR.rot = [-s * a, 0, 0];
        P.armL.rot = [-s * a * 0.8, 0, -0.12]; P.armR.rot = [pose.armR + s * a * 0.5, 0, 0.12];
        P.torso.pos[1] = 0.6 + Math.abs(Math.cos(this.t)) * 0.06;
        P.torso.rot = [0.06, 0, 0]; P.head.rot = [0, 0, s * 0.04];
      } else {
        P.legL.rot = [0, 0, 0]; P.legR.rot = [0, 0, 0];
        P.armL.rot = [0, 0, -0.12 - (Math.sin(this.t) * 0.03)]; P.armR.rot = [pose.armR, 0, 0.12 + Math.sin(this.t) * 0.03];
        P.torso.pos[1] = 0.6 + Math.sin(this.t) * 0.015; P.torso.rot = [0, 0, 0];
        P.head.rot = [Math.sin(this.t * 0.5) * 0.03, 0, Math.sin(this.t * 0.7) * 0.04];
      }
      if (P.weapon) P.weapon.rot = [pose.wR - P.armR.rot[0] - pose.armR + (pose.armR ? 0 : 0), 0, 0];
      if (P.weapon) P.weapon.rot[0] = pose.wR + (pose.armR - P.armR.rot[0]) * 0.8;
      if (P.weapon2) P.weapon2.rot = [-0.2, 0, 0];
      if (P.cape) P.cape.rot = [-Math.min(0.5, speed * 0.04), 0, 0];
      if (extra) extra(this);
    };
    ch.animate(0, 0);
    return ch;
  };

  /* ---------- 坐騎 ---------- */
  MD.HORSES = {
    chitu: { body: '#d2432c', mane: '#7a1a10', hoof: '#3a2a22', saddle: '#f2c14e' },
    dilu: { body: '#7a5234', mane: '#1d1a22', hoof: '#2a2020', saddle: '#3f8a4a', star: true },
    jueying: { body: '#33313d', mane: '#111118', hoof: '#111', saddle: '#c0c8d0' },
    zhuahuang: { body: '#f4f1e8', mane: '#e8c040', hoof: '#e8b830', saddle: '#d6352b', sock: '#f0c850' },
    zhaoye: { body: '#ffffff', mane: '#f0f4ff', hoof: '#c8d0e0', saddle: '#4a68b0', fluffy: true }
  };
  MD.horse = function (R, kind) {
    const H = MD.HORSES[kind] || MD.HORSES.chitu; const root = new Node(); const parts = {};
    const b = new Builder();
    b.sphere(0.55, H.body, { p: [0, 1.1, 0], s: [0.9, 0.8, 1.45] }, 16, 12);
    // 脖子與頭
    b.cyl(0.24, 0.32, 0.75, 12, H.body, { p: [0, 1.55, 0.6], r: [0.6, 0, 0] });
    b.sphere(0.3, H.body, { p: [0, 1.95, 0.85], s: [0.9, 0.9, 1.15] }, 14, 10);
    b.sphere(0.2, shade(H.body, 1.08), { p: [0, 1.85, 1.15], s: [1, 0.85, 1] }, 12, 8);
    b.sphere(0.035, '#3a2020', { p: [-0.08, 1.85, 1.33] }); b.sphere(0.035, '#3a2020', { p: [0.08, 1.85, 1.33] });
    for (const s of [-1, 1]) {
      b.sphere(0.06, '#1b1622', { p: [s * 0.22, 2.02, 0.98], s: [0.5, 1.1, 1] }); b.sphere(0.02, '#fff', { p: [s * 0.25, 2.05, 1.0] });
      b.cyl(0, 0.07, 0.2, 6, H.body, { p: [s * 0.13, 2.28, 0.74], r: [-0.2, 0, -s * 0.3] });
      b.sphere(0.05, '#ff9fb0', { p: [s * 0.2, 1.88, 1.1], s: [0.4, 0.7, 1] });
    }
    if (H.star) b.sphere(0.07, '#ffffff', { p: [0, 2.08, 1.06], s: [1, 1, 0.4] });
    // 鬃毛
    const mn = H.fluffy ? 0.14 : 0.1;
    for (let i = 0; i < 7; i++) b.sphere(mn, H.mane, { p: [0, 2.22 - i * 0.12, 0.78 - i * 0.1], s: [0.6, 1, 1] }, 8, 6);
    b.sphere(0.12, H.mane, { p: [0, 2.2, 1.0], s: [0.8, 0.6, 1] });
    // 尾巴
    const tb2 = new Builder();
    tb2.sphere(0.14, H.mane, { p: [0, -0.1, -0.05], s: [0.8, 1, 0.8] }); tb2.sphere(0.13, H.mane, { p: [0, -0.32, -0.12], s: [0.8, 1.2, 0.8] }); tb2.sphere(0.11, H.mane, { p: [0, -0.55, -0.15], s: [0.8, 1.2, 0.8] });
    // 鞍
    b.sphere(0.5, H.saddle, { p: [0, 1.48, -0.05], s: [0.95, 0.35, 0.75] }, 14, 8, 0.6);
    b.box(1.02, 0.08, 0.5, shade(H.saddle, 0.7), { p: [0, 1.32, -0.05] });
    b.torus(0.06, 0.015, '#888', { p: [0.52, 0.95, 0], r: [0, Math.PI / 2, 0] }, 8, 4); b.torus(0.06, 0.015, '#888', { p: [-0.52, 0.95, 0], r: [0, Math.PI / 2, 0] }, 8, 4);
    b.torus(0.18, 0.02, '#8a1f2e', { p: [0, 1.85, 1.12], r: [Math.PI / 2, 0, 0], s: [1.15, 1, 1] }, 12, 4);
    b.sphere(0.08, '#f2c14e', { p: [0, 1.62, 0.92] });
    const body = new Node(b.build(R)); root.add(body); parts.body = body;
    const tail = new Node(tb2.build(R)); tail.pos = [0, 1.25, -0.78]; body.add(tail); parts.tail = tail;
    const legs = [];
    for (const [x, z] of [[-0.28, 0.5], [0.28, 0.5], [-0.28, -0.5], [0.28, -0.5]]) {
      const lb = new Builder(); lb.cyl(0.11, 0.13, 0.78, 8, H.body, { p: [0, -0.38, 0] });
      if (H.sock) lb.cyl(0.12, 0.12, 0.2, 8, H.sock, { p: [0, -0.68, 0] });
      lb.cyl(0.13, 0.14, 0.12, 8, H.hoof, { p: [0, -0.8, 0] });
      const n = new Node(lb.build(R)); n.pos = [x, 0.88, z]; body.add(n); legs.push(n);
    }
    parts.legs = legs;
    const hz = { root, parts, t: 0, kind };
    hz.animate = function (dt, speed) {
      this.t += dt * (speed > 0.1 ? 4 + speed * 0.5 : 1.5); const s = Math.sin(this.t);
      if (speed > 0.1) {
        const a = Math.min(0.8, 0.3 + speed * 0.04);
        legs[0].rot = [s * a, 0, 0]; legs[3].rot = [s * a, 0, 0]; legs[1].rot = [-s * a, 0, 0]; legs[2].rot = [-s * a, 0, 0];
        body.pos[1] = Math.abs(Math.cos(this.t)) * 0.1; tail.rot = [0.6 + s * 0.2, 0, 0];
      } else { for (const l of legs) l.rot = [0, 0, 0]; body.pos[1] = Math.sin(this.t) * 0.02; tail.rot = [0.3, 0, Math.sin(this.t * 1.3) * 0.25]; }
    };
    hz.animate(0, 0);
    return hz;
  };

  /* ---------- 糧草：麻布米袋＋稻草束 ---------- */
  MD.grainSack = function (b, t) {
    const T = (p, r, sc) => ({ p: [p[0] + (t.p ? t.p[0] : 0), p[1] + (t.p ? t.p[1] : 0), p[2] + (t.p ? t.p[2] : 0)], r: r || [0, 0, 0], s: sc });
    const sack = '#d8c08a', sackD = '#b89a5e';
    // 袋身（鼓鼓的麻布袋）
    b.lathe([[0.0, 0.0], [0.26, 0.01], [0.36, 0.08], [0.41, 0.22], [0.42, 0.38], [0.38, 0.54], [0.28, 0.66], [0.15, 0.73], [0.11, 0.76]], 14, sack, T([0, 0, 0]));
    // 麻布縫線
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; b.box(0.025, 0.5, 0.02, sackD, T([Math.cos(a) * 0.4, 0.36, Math.sin(a) * 0.4], [0, -a, 0])); }
    b.torus(0.4, 0.018, sackD, T([0, 0.2, 0]), 16, 4); b.torus(0.39, 0.018, sackD, T([0, 0.5, 0]), 16, 4);
    // 束口繩與袋口
    b.torus(0.12, 0.035, '#8a4a22', T([0, 0.76, 0]), 12, 5);
    b.lathe([[0.11, 0.78], [0.16, 0.86], [0.22, 0.93], [0.2, 0.95]], 12, sack, T([0, 0, 0]));
    // 袋口露出的米粒
    for (let i = 0; i < 9; i++) { const a = i * 0.7, r = 0.04 + (i % 3) * 0.05; b.sphere(0.05, i % 2 ? '#fff6dc' : '#f4e6b8', T([Math.cos(a) * r, 0.92, Math.sin(a) * r]), 6, 4); }
    // 紅色「糧」字標籤底
    b.box(0.3, 0.3, 0.02, '#c0392b', T([0, 0.36, 0.41], [0, 0, Math.PI / 4]));
    b.box(0.24, 0.24, 0.025, '#e8b84a', T([0, 0.36, 0.413], [0, 0, Math.PI / 4]));
    // 稻草束（草）靠在袋邊
    const st = [0.32, 0.0, -0.25];
    for (let i = 0; i < 9; i++) { const a = i * 0.7, r = 0.05 + (i % 3) * 0.03; b.cyl(0.018, 0.018, 1.05, 4, i % 2 ? '#e6c25a' : '#d4aa40', T([st[0] + Math.cos(a) * r, 0.5, st[2] + Math.sin(a) * r], [0.12, 0, -0.32])); }
    for (let i = 0; i < 7; i++) { const a = i * 0.9; b.sphere(0.06, '#e8b030', T([st[0] + 0.33 + Math.cos(a) * 0.08, 1.0 + (i % 3) * 0.05, st[2] + 0.06 + Math.sin(a) * 0.08], [0, 0, 0], [0.7, 1.6, 0.7]), 6, 4); }
    b.torus(0.12, 0.03, '#8a4a22', T([st[0] + 0.07, 0.45, st[2] + 0.02], [0.12, 0, -0.32]), 10, 4);
  };

  /* ---------- 道具（單一網格） ---------- */
  MD.item = function (R, kind, opt) {
    opt = opt || {}; const b = new Builder();
    switch (kind) {
      case 'guqin': // 琴與琴桌
        b.box(1.7, 0.08, 0.5, '#7a4a26', { p: [0, 0.55, 0] });
        for (const x of [-0.75, 0.75]) for (const z of [-0.18, 0.18]) b.box(0.07, 0.55, 0.07, '#5a3420', { p: [x, 0.27, z] });
        b.box(1.5, 0.08, 0.32, '#2a1a14', { p: [0, 0.63, 0], r: [0, 0, 0.0] });
        b.sphere(0.2, '#2a1a14', { p: [0.62, 0.64, 0], s: [1, 0.25, 0.9] });
        for (let i = 0; i < 7; i++) b.box(1.4, 0.008, 0.008, '#f4e6c0', { p: [0, 0.675, -0.12 + i * 0.04] });
        for (let i = 0; i < 13; i++) b.sphere(0.012, '#ffffff', { p: [-0.6 + i * 0.08, 0.675, 0.14] }, 4, 3);
        break;
      case 'censer': // 薰香爐
        b.lathe([[0.0, 0], [0.18, 0.02], [0.22, 0.15], [0.2, 0.3], [0.24, 0.34], [0.0, 0.34]], 12, '#4f7a6a', {});
        for (let i = 0; i < 3; i++) { const a = i * 2.09; b.cyl(0.03, 0.04, 0.16, 5, '#3a5a4a', { p: [Math.cos(a) * 0.14, -0.06, Math.sin(a) * 0.14] }); }
        b.sphere(0.17, '#5f8a7a', { p: [0, 0.36, 0] }, 12, 8, 0.5); b.sphere(0.05, '#f2c14e', { p: [0, 0.54, 0] });
        b.torus(0.06, 0.02, '#f2c14e', { p: [0.24, 0.26, 0], r: [Math.PI / 2, 0, 0] }, 8, 4); b.torus(0.06, 0.02, '#f2c14e', { p: [-0.24, 0.26, 0], r: [Math.PI / 2, 0, 0] }, 8, 4);
        break;
      case 'grain': MD.grainSack(b, {}); break;
      case 'hay':
        b.cyl(0.45, 0.5, 0.7, 10, '#e8c870', { p: [0, 0.35, 0] }); b.cyl(0.0, 0.45, 0.4, 10, '#f0d890', { p: [0, 0.9, 0] }); b.torus(0.47, 0.03, '#b08840', { p: [0, 0.4, 0] }, 12, 4);
        break;
      case 'flagpole': {
        const c = opt.color || '#d6352b';
        b.cyl(0.05, 0.06, 4.2, 6, '#6a3f1f', { p: [0, 2.1, 0] }); b.sphere(0.12, '#f2c14e', { p: [0, 4.3, 0] });
        b.box(0.04, 1.6, 1.3, c, { p: [0, 3.35, 0.68] });
        for (let i = 0; i < 5; i++) b.cyl(0, 0.1, 0.25, 4, '#f2c14e', { p: [0, 2.45 - 0.04, 0.12 + i * 0.27], r: [Math.PI, 0, 0] });
        break;
      }
      case 'lantern':
        b.cyl(0.02, 0.02, 0.2, 4, '#3a2a1a', { p: [0, 0.6, 0] });
        b.sphere(0.25, '#e8392b', { p: [0, 0.32, 0], s: [1, 0.85, 1] }, 12, 8); b.cyl(0.12, 0.12, 0.06, 10, '#f2c14e', { p: [0, 0.54, 0] }); b.cyl(0.12, 0.12, 0.06, 10, '#f2c14e', { p: [0, 0.1, 0] });
        b.cyl(0.03, 0.0, 0.2, 5, '#f2c14e', { p: [0, -0.04, 0] });
        break;
      case 'scroll':
        b.box(0.9, 0.6, 0.02, '#f8edd0', { p: [0, 0.4, 0] }); b.cyl(0.05, 0.05, 1.0, 8, '#8a4a2a', { p: [0, 0.72, 0], r: [0, 0, Math.PI / 2] }); b.cyl(0.05, 0.05, 1.0, 8, '#8a4a2a', { p: [0, 0.08, 0], r: [0, 0, Math.PI / 2] });
        for (let i = 0; i < 5; i++) b.box(0.03, 0.4, 0.01, '#33302a', { p: [-0.3 + i * 0.15, 0.4, 0.015] });
        break;
      case 'chest':
        b.box(0.8, 0.5, 0.55, '#a0522d', { p: [0, 0.25, 0] }); b.cyl(0.275, 0.275, 0.8, 10, '#b8622d', { p: [0, 0.5, 0], r: [0, 0, Math.PI / 2] }, true);
        b.box(0.84, 0.08, 0.6, '#f2c14e', { p: [0, 0.48, 0] }); b.box(0.14, 0.16, 0.05, '#f2c14e', { p: [0, 0.42, 0.29] });
        break;
      case 'star':
        b.sphere(0.3, '#ffd54a', { p: [0, 0, 0], s: [1, 1, 0.4] }, 5, 4);
        break;
      case 'weapon': MD.weapon(b, opt.type || 'spear', {}); break;
    }
    return b.build(R);
  };

  /* ---------- 故事人物造型 ---------- */
  MD.NPC = {
    zhuge: { name: '諸葛亮', gender: 'm', hair: 'long', hairCol: '#1d1a22', beard: 'goatee', hat: 'lunjin', outfit: 'robe', clothCol: '#a9cfd9', accent: '#ffffff', acc: 'none', weapon: 'fan' },
    simayi: { name: '司馬懿', gender: 'm', hair: 'short', beard: 'goatee', hat: 'helmet', hatCol: '#d8b870', plume: '#c0392b', outfit: 'armor', clothCol: '#b8924a', accent: '#a83a2a', acc: 'cape', weapon: 'qinggang', brow: 0.3 },
    simazhao: { name: '司馬昭', gender: 'm', hair: 'pony', hat: 'helmet', hatCol: '#e0d0a8', plume: '#e0603a', outfit: 'armor', clothCol: '#c8b48a', accent: '#8a5a3a', acc: 'none', weapon: 'spear' },
    zhangbao: { name: '張苞', gender: 'm', hair: 'short', hat: 'helmet', plume: '#ffffff', outfit: 'battle', clothCol: '#a8b4c4', accent: '#3f7a4a', acc: 'none', weapon: 'snake', brow: 0.35 },
    guanxing: { name: '關興', gender: 'm', hair: 'short', hat: 'helmet', plume: '#ffffff', outfit: 'battle', clothCol: '#8a9ac8', accent: '#2f5a3a', acc: 'cape', weapon: 'guandao' },
    shutong: { name: '書僮', gender: 'm', hair: 'twin', hairCol: '#1d1a22', hat: 'none', outfit: 'cloth', clothCol: '#9fd4a8', accent: '#ffffff', acc: 'none', weapon: 'sword' },
    shutong2: { name: '書僮', gender: 'm', hair: 'twin', hairCol: '#1d1a22', hat: 'none', outfit: 'cloth', clothCol: '#b8a8e0', accent: '#ffffff', acc: 'scroll', weapon: 'none' },
    messenger: { name: '傳令兵', gender: 'm', hair: 'bun', hat: 'band', outfit: 'cloth', clothCol: '#e0a040', accent: '#c0392b', acc: 'backflag', weapon: 'none' },
    shuSoldier: { name: '蜀軍隊長', gender: 'm', hair: 'short', hat: 'helmet', plume: '#d6352b', outfit: 'armor', clothCol: '#c9d2dc', accent: '#c0392b', acc: 'none', weapon: 'spear' },
    weiSoldier: { name: '魏兵', gender: 'm', hair: 'short', hat: 'helmet', hatCol: '#b0a8c8', plume: '#8a4fc8', outfit: 'armor', clothCol: '#8a84a8', accent: '#4a3a7a', acc: 'none', weapon: 'spear' },
    teacher: { name: '書院夫子', gender: 'm', hair: 'bun', hairCol: '#cfcbd6', beard: 'long', hat: 'guan', outfit: 'taoist', clothCol: '#ffffff', accent: '#2b2b33', acc: 'scroll', weapon: 'none' },
    villager: { name: '百姓', gender: 'm', hair: 'bun', hat: 'douli', outfit: 'cloth', clothCol: '#b0906a', accent: '#6a4a2a', acc: 'none', weapon: 'broom' },
    villagerF: { name: '百姓', gender: 'f', hair: 'twin', hairCol: '#3a2a22', hat: 'none', outfit: 'cloth', clothCol: '#e8a0a0', accent: '#ffffff', acc: 'none', weapon: 'broom' }
  };

  window.MD = MD;
})();
