/* =========================================================
   M3D — 輕量 WebGL 3D 引擎（離線可用，免外部函式庫）
   支援：階層節點、頂點色模型、半球光+太陽光、霧、透明、
         看板文字(Sprite)、粒子(Points)
   ========================================================= */
(function () {
  'use strict';
  const M3D = {};

  /* ---------- 數學 ---------- */
  const V = {
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
  };
  M3D.V = V;

  function m4() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; }
  const _tmp = new Float32Array(16);
  function mul(out, a, b) {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      _tmp[i * 4 + j] = a[j] * b[i * 4] + a[4 + j] * b[i * 4 + 1] + a[8 + j] * b[i * 4 + 2] + a[12 + j] * b[i * 4 + 3];
    }
    out.set(_tmp); return out;
  }
  // 旋轉順序：Ry * Rx * Rz
  function rot3(rx, ry, rz) {
    const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
    // Ry*Rx
    const a = [cy, sy * sx, sy * cx, 0, cx, -sx, -sy, cy * sx, cy * cx]; // row-major
    // *Rz
    const z = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
    const r = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * z[j] + a[i * 3 + 1] * z[3 + j] + a[i * 3 + 2] * z[6 + j];
    return r; // row-major 3x3
  }
  function compose(out, p, r, s) {
    const R = rot3(r[0], r[1], r[2]);
    out[0] = R[0] * s[0]; out[1] = R[3] * s[0]; out[2] = R[6] * s[0]; out[3] = 0;
    out[4] = R[1] * s[1]; out[5] = R[4] * s[1]; out[6] = R[7] * s[1]; out[7] = 0;
    out[8] = R[2] * s[2]; out[9] = R[5] * s[2]; out[10] = R[8] * s[2]; out[11] = 0;
    out[12] = p[0]; out[13] = p[1]; out[14] = p[2]; out[15] = 1;
    return out;
  }
  function perspective(out, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    out.fill(0);
    out[0] = f / aspect; out[5] = f; out[10] = (far + near) * nf; out[11] = -1; out[14] = 2 * far * near * nf;
    return out;
  }
  function lookAt(out, eye, target, up) {
    const z = V.norm(V.sub(eye, target)); const x = V.norm(V.cross(up, z)); const y = V.cross(z, x);
    out[0] = x[0]; out[1] = y[0]; out[2] = z[0]; out[3] = 0;
    out[4] = x[1]; out[5] = y[1]; out[6] = z[1]; out[7] = 0;
    out[8] = x[2]; out[9] = y[2]; out[10] = z[2]; out[11] = 0;
    out[12] = -V.dot(x, eye); out[13] = -V.dot(y, eye); out[14] = -V.dot(z, eye); out[15] = 1;
    return out;
  }
  function xform(m, v) { // 點
    const x = v[0], y = v[1], z = v[2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w, w];
  }
  M3D.m4 = m4; M3D.mul = mul; M3D.compose = compose; M3D.perspective = perspective; M3D.lookAt = lookAt; M3D.xform = xform;

  /* ---------- 顏色 ---------- */
  function hex(c) {
    if (Array.isArray(c)) return c;
    if (typeof c === 'string') c = parseInt(c.replace('#', ''), 16);
    return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
  }
  M3D.hex = hex;
  M3D.shade = function (c, k) { const h = hex(c); return [Math.min(1, h[0] * k), Math.min(1, h[1] * k), Math.min(1, h[2] * k)]; };
  M3D.mix = function (a, b, t) { a = hex(a); b = hex(b); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };

  /* ---------- 幾何建構器（合併成單一網格） ---------- */
  function Builder() { this.p = []; this.n = []; this.c = []; }
  M3D.Builder = Builder;

  function tmat(t) {
    t = t || {};
    const p = t.p || [0, 0, 0], r = t.r || [0, 0, 0];
    let s = t.s; if (s === undefined) s = [1, 1, 1]; else if (typeof s === 'number') s = [s, s, s];
    return { M: compose(m4(), p, r, s), R: rot3(r[0], r[1], r[2]), S: s };
  }
  Builder.prototype._push = function (verts, norms, color, t, vary) {
    const T = tmat(t), M = T.M, R = T.R, S = T.S; const col = hex(color);
    for (let i = 0; i < verts.length; i += 3) {
      const x = verts[i], y = verts[i + 1], z = verts[i + 2];
      this.p.push(M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]);
      let nx = norms[i] / S[0], ny = norms[i + 1] / S[1], nz = norms[i + 2] / S[2];
      const wx = R[0] * nx + R[1] * ny + R[2] * nz, wy = R[3] * nx + R[4] * ny + R[5] * nz, wz = R[6] * nx + R[7] * ny + R[8] * nz;
      const l = Math.hypot(wx, wy, wz) || 1;
      this.n.push(wx / l, wy / l, wz / l);
      let k = 1; if (vary) k = 1 + (Math.random() - 0.5) * vary;
      this.c.push(col[0] * k, col[1] * k, col[2] * k);
    }
    return this;
  };
  // 依三角形計算平面法線
  function flatNormals(v) {
    const n = [];
    for (let i = 0; i < v.length; i += 9) {
      const a = [v[i], v[i + 1], v[i + 2]], b = [v[i + 3], v[i + 4], v[i + 5]], c = [v[i + 6], v[i + 7], v[i + 8]];
      const f = V.norm(V.cross(V.sub(b, a), V.sub(c, a)));
      n.push(f[0], f[1], f[2], f[0], f[1], f[2], f[0], f[1], f[2]);
    }
    return n;
  }
  Builder.prototype.tris = function (verts, color, t, norms) { return this._push(verts, norms || flatNormals(verts), color, t); };
  Builder.prototype.box = function (w, h, d, color, t) {
    const x = w / 2, y = h / 2, z = d / 2; const v = [], n = [];
    const f = (a, b, c, d2, nn) => { v.push(...a, ...b, ...c, ...a, ...c, ...d2); for (let i = 0; i < 6; i++) n.push(...nn); };
    f([-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [0, 0, 1]);
    f([x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], [0, 0, -1]);
    f([x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z], [1, 0, 0]);
    f([-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], [-1, 0, 0]);
    f([-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z], [0, 1, 0]);
    f([-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [0, -1, 0]);
    return this._push(v, n, color, t);
  };
  // 旋轉體：pts = [[r,y],...] 由下而上
  Builder.prototype.lathe = function (pts, seg, color, t, opt) {
    opt = opt || {}; seg = seg || 12; const v = [], n = [];
    const a0 = opt.a0 || 0, arc = opt.arc || Math.PI * 2;
    for (let i = 0; i < pts.length - 1; i++) {
      const [r1, y1] = pts[i], [r2, y2] = pts[i + 1];
      const dy = y2 - y1, dr = r2 - r1; const sl = Math.hypot(dy, dr) || 1;
      const nyv = -dr / sl, nrv = dy / sl;
      for (let j = 0; j < seg; j++) {
        const t1 = a0 + arc * j / seg, t2 = a0 + arc * (j + 1) / seg;
        const c1 = Math.cos(t1), s1 = Math.sin(t1), c2 = Math.cos(t2), s2 = Math.sin(t2);
        const A = [r1 * c1, y1, r1 * s1], B = [r1 * c2, y1, r1 * s2], C = [r2 * c2, y2, r2 * s2], D = [r2 * c1, y2, r2 * s1];
        v.push(...A, ...C, ...B, ...A, ...D, ...C);
        if (!opt.flat) {
          const nA = [nrv * c1, nyv, nrv * s1], nB = [nrv * c2, nyv, nrv * s2];
          n.push(...nA, ...nB, ...nB, ...nA, ...nA, ...nB);
        }
      }
    }
    return this._push(v, opt.flat ? flatNormals(v) : n, color, t);
  };
  Builder.prototype.cyl = function (rt, rb, h, seg, color, t, caps) {
    const y = h / 2; this.lathe([[rb, -y], [rt, y]], seg, color, t, { flat: seg <= 6 });
    if (caps !== false) {
      const v = [], n = [];
      for (let j = 0; j < seg; j++) {
        const t1 = Math.PI * 2 * j / seg, t2 = Math.PI * 2 * (j + 1) / seg;
        if (rt > 0) { v.push(0, y, 0, rt * Math.cos(t2), y, rt * Math.sin(t2), rt * Math.cos(t1), y, rt * Math.sin(t1)); n.push(0, 1, 0, 0, 1, 0, 0, 1, 0); }
        if (rb > 0) { v.push(0, -y, 0, rb * Math.cos(t1), -y, rb * Math.sin(t1), rb * Math.cos(t2), -y, rb * Math.sin(t2)); n.push(0, -1, 0, 0, -1, 0, 0, -1, 0); }
      }
      this._push(v, n, color, t);
    }
    return this;
  };
  Builder.prototype.sphere = function (r, color, t, ws, hs, part) {
    ws = ws || 14; hs = hs || 10; part = part || 1; const pts = [];
    for (let i = 0; i <= hs; i++) { const a = -Math.PI / 2 + Math.PI * (1 - part) + Math.PI * part * i / hs; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    pts[0][0] = Math.max(pts[0][0], 0); pts[pts.length - 1][0] = 0;
    // 球面法線
    const v = [], n = [];
    for (let i = 0; i < pts.length - 1; i++) {
      for (let j = 0; j < ws; j++) {
        const t1 = Math.PI * 2 * j / ws, t2 = Math.PI * 2 * (j + 1) / ws;
        const P = (k, tt) => [pts[k][0] * Math.cos(tt), pts[k][1], pts[k][0] * Math.sin(tt)];
        const A = P(i, t1), B = P(i, t2), C = P(i + 1, t2), D = P(i + 1, t1);
        v.push(...A, ...C, ...B, ...A, ...D, ...C);
        for (const q of [A, C, B, A, D, C]) { const l = Math.hypot(q[0], q[1], q[2]) || 1; n.push(q[0] / l, q[1] / l, q[2] / l); }
      }
    }
    return this._push(v, n, color, t);
  };
  Builder.prototype.torus = function (R, r, color, t, seg, sseg, arc) {
    seg = seg || 16; sseg = sseg || 8; arc = arc || Math.PI * 2; const v = [], n = [];
    const P = (i, j) => { const u = arc * i / seg, w = Math.PI * 2 * j / sseg; const cx = Math.cos(u), sx = Math.sin(u);
      return { p: [(R + r * Math.cos(w)) * cx, r * Math.sin(w), (R + r * Math.cos(w)) * sx], n: [Math.cos(w) * cx, Math.sin(w), Math.cos(w) * sx] }; };
    for (let i = 0; i < seg; i++) for (let j = 0; j < sseg; j++) {
      const A = P(i, j), B = P(i + 1, j), C = P(i + 1, j + 1), D = P(i, j + 1);
      for (const q of [A, C, B, A, D, C]) { v.push(...q.p); n.push(...q.n); }
    }
    return this._push(v, n, color, t);
  };
  // 中國式屋頂（四角內凹曲線）
  Builder.prototype.roof = function (w, d, h, color, t, opt) {
    opt = opt || {}; const pts = [[1.0, 0.0], [0.97, 0.06], [0.78, 0.22], [0.52, 0.52], [0.28, 0.85], [0.12, 1.0]];
    const b = new Builder();
    b.lathe(pts.map(p => [p[0], p[1]]), 4, color, { r: [0, Math.PI / 4, 0] }, { flat: true });
    // 屋頂底面
    b.lathe([[0.001, 0], [1.0, 0]], 4, opt.under || M3D.shade(color, 0.6), { r: [0, Math.PI / 4, 0] }, { flat: true });
    // 套用縮放
    const s = [w / Math.SQRT2, h, d / Math.SQRT2];
    const T = tmat({ s: s });
    const out = { p: [], n: [] };
    for (let i = 0; i < b.p.length; i += 3) { out.p.push(b.p[i] * s[0], b.p[i + 1] * s[1], b.p[i + 2] * s[2]); }
    for (let i = 0; i < b.p.length; i += 9) { const f = flatNormals(out.p.slice(i, i + 9)); out.n.push(...f); }
    const T2 = tmat(t); const M = T2.M, R = T2.R;
    for (let i = 0; i < out.p.length; i += 3) {
      const x = out.p[i], y = out.p[i + 1], z = out.p[i + 2];
      this.p.push(M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]);
      const nx = out.n[i], ny = out.n[i + 1], nz = out.n[i + 2];
      this.n.push(R[0] * nx + R[1] * ny + R[2] * nz, R[3] * nx + R[4] * ny + R[5] * nz, R[6] * nx + R[7] * ny + R[8] * nz);
      this.c.push(b.c[i], b.c[i + 1], b.c[i + 2]);
    }
    // 屋脊
    this.box(w * 0.22, h * 0.1, d * 0.14, opt.ridge || M3D.shade(color, 0.8), { p: V.add((t && t.p) || [0, 0, 0], [0, h * 1.0, 0]), r: (t && t.r) || [0, 0, 0] });
    return this;
  };
  // 平面（可帶高度函數與顏色函數）
  Builder.prototype.grid = function (size, n, hf, cf, cx, cz) {
    cx = cx || 0; cz = cz || 0; const st = size / n; const v = [], nn = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x0 = cx - size / 2 + i * st, z0 = cz - size / 2 + j * st, x1 = x0 + st, z1 = z0 + st;
      const A = [x0, hf(x0, z0), z0], B = [x1, hf(x1, z0), z0], C = [x1, hf(x1, z1), z1], D = [x0, hf(x0, z1), z1];
      v.push(...A, ...D, ...C, ...A, ...C, ...B);
    }
    const norms = flatNormals(v);
    const start = this.p.length;
    this._push(v, norms, [1, 1, 1], null);
    for (let i = start, k = 0; i < this.p.length; i += 9, k++) {
      const x = (this.p[i] + this.p[i + 3] + this.p[i + 6]) / 3, z = (this.p[i + 2] + this.p[i + 5] + this.p[i + 8]) / 3, y = (this.p[i + 1] + this.p[i + 4] + this.p[i + 7]) / 3;
      const c = hex(cf(x, z, y));
      for (let q = 0; q < 3; q++) { this.c[i + q * 3] = c[0]; this.c[i + q * 3 + 1] = c[1]; this.c[i + q * 3 + 2] = c[2]; }
    }
    return this;
  };
  Builder.prototype.merge = function (other, t) {
    if (!t) { this.p.push(...other.p); this.n.push(...other.n); this.c.push(...other.c); return this; }
    const start = this.c.length; this._push(other.p, other.n, [1, 1, 1], t);
    for (let i = 0; i < other.c.length; i++) this.c[start + i] = other.c[i];
    return this;
  };
  Builder.prototype.count = function () { return this.p.length / 3; };
  Builder.prototype.build = function (r) { return r.createMesh(this); };

  /* ---------- 節點 ---------- */
  function Node(mesh) {
    this.pos = [0, 0, 0]; this.rot = [0, 0, 0]; this.scl = [1, 1, 1];
    this.children = []; this.mesh = mesh || null; this.visible = true; this.world = m4(); this.local = m4();
    this.alpha = 1; this.flash = 0; this.parent = null; this.tint = null;
  }
  Node.prototype.add = function (c) { if (c.parent) c.parent.remove(c); this.children.push(c); c.parent = this; return c; };
  Node.prototype.remove = function (c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parent = null; };
  Node.prototype.update = function (pw) {
    compose(this.local, this.pos, this.rot, this.scl);
    if (pw) mul(this.world, pw, this.local); else this.world.set(this.local);
    for (const c of this.children) c.update(this.world);
  };
  Node.prototype.worldPos = function () { return [this.world[12], this.world[13], this.world[14]]; };
  M3D.Node = Node;

  /* ---------- 渲染器 ---------- */
  const VS = `
attribute vec3 aP; attribute vec3 aN; attribute vec3 aC;
uniform mat4 uVP; uniform mat4 uM;
varying vec3 vC; varying vec3 vN; varying vec3 vW;
void main(){ vec4 w = uM*vec4(aP,1.0); vW=w.xyz; vN=mat3(uM)*aN; vC=aC; gl_Position=uVP*w; }`;
  const FS = `
precision mediump float;
varying vec3 vC; varying vec3 vN; varying vec3 vW;
uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uSky; uniform vec3 uGround; uniform vec3 uCam;
uniform vec3 uFogCol; uniform vec2 uFog; uniform float uAlpha; uniform float uFlash; uniform vec3 uTint; uniform float uUnlit;
void main(){
  vec3 N = normalize(vN); vec3 Vd = normalize(uCam - vW);
  float d = max(dot(N,uSun),0.0);
  d = smoothstep(0.0,0.6,d)*0.75 + d*0.25;
  vec3 amb = mix(uGround, uSky, 0.5+0.5*N.y);
  float rim = pow(1.0-max(dot(N,Vd),0.0), 3.0)*0.28;
  vec3 col = vC*uTint*(amb*0.7 + uSunCol*d*0.5) + rim*vec3(1.0,0.95,0.85);
  col = mix(col, vC*uTint, uUnlit);
  col += uFlash*vec3(1.0,0.85,0.4);
  float f = clamp((length(vW-uCam)-uFog.x)/(uFog.y-uFog.x),0.0,1.0);
  col = mix(col, uFogCol, f*f);
  gl_FragColor = vec4(col, uAlpha);
}`;
  const SVS = `
attribute vec2 aQ; uniform mat4 uVP; uniform vec3 uCenter; uniform vec2 uSize; uniform vec3 uRight; uniform vec3 uUp;
varying vec2 vUV;
void main(){ vUV = vec2(aQ.x+0.5, 0.5-aQ.y); vec3 p = uCenter + uRight*aQ.x*uSize.x + uUp*aQ.y*uSize.y; gl_Position = uVP*vec4(p,1.0); }`;
  const SFS = `precision mediump float; varying vec2 vUV; uniform sampler2D uTex; uniform float uAlpha;
void main(){ vec4 c = texture2D(uTex, vUV); if(c.a<0.02) discard; gl_FragColor = vec4(c.rgb, c.a*uAlpha); }`;
  const TVS = `attribute vec2 aQ; uniform mat4 uVP; uniform mat4 uM; uniform vec2 uSize; varying vec2 vUV;
void main(){ vUV = vec2(aQ.x+0.5, 0.5-aQ.y); gl_Position = uVP*uM*vec4(aQ.x*uSize.x, aQ.y*uSize.y, 0.0, 1.0); }`;
  const PVS = `attribute vec3 aP; attribute vec4 aC; attribute float aS; uniform mat4 uVP; uniform float uH; varying vec4 vC;
void main(){ vec4 p = uVP*vec4(aP,1.0); gl_Position=p; gl_PointSize = aS*uH/max(p.w,0.5); vC=aC; }`;
  const PFS = `precision mediump float; varying vec4 vC; void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d); if(r>0.5) discard; float a = smoothstep(0.5,0.15,r); gl_FragColor=vec4(vC.rgb+ (1.0-r*2.0)*0.35, vC.a*a); }`;

  function compile(gl, vs, fs) {
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, a = {};
    const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < nu; i++) { const n = gl.getActiveUniform(p, i).name; u[n] = gl.getUniformLocation(p, n); }
    const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES); for (let i = 0; i < na; i++) { const n = gl.getActiveAttrib(p, i).name; a[n] = gl.getAttribLocation(p, n); }
    return { p, u, a };
  }

  function Renderer(canvas, opts) {
    opts = opts || {};
    const gl = canvas.getContext('webgl', { antialias: true, alpha: !!opts.alpha, preserveDrawingBuffer: !!opts.preserve, premultipliedAlpha: false })
      || canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('此裝置不支援 WebGL');
    this.gl = gl; this.canvas = canvas;
    this.prog = compile(gl, VS, FS); this.sprog = compile(gl, SVS, SFS); this.pprog = compile(gl, PVS, PFS); this.tprog = compile(gl, TVS, SFS);
    this.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5]), gl.STATIC_DRAW);
    this.pbuf = gl.createBuffer();
    this.view = m4(); this.proj = m4(); this.vp = m4();
    this.cam = { pos: [0, 10, 20], target: [0, 0, 0], fov: 50 * Math.PI / 180, near: 0.3, far: 600 };
    this.env = { sun: V.norm([0.5, 0.9, 0.35]), sunCol: [1.0, 0.95, 0.85], sky: [0.62, 0.72, 0.85], ground: [0.42, 0.38, 0.32], fogCol: [0.80, 0.88, 0.95], fog: [80, 330], clear: [0.80, 0.88, 0.95, 1] };
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, opts.maxDPR || 2);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    this.alphaClear = !!opts.alpha;
  }
  M3D.Renderer = Renderer;
  Renderer.prototype.resize = function (w, h) {
    const c = this.canvas; const pr = this.pixelRatio;
    c.width = Math.round(w * pr); c.height = Math.round(h * pr); c.style.width = w + 'px'; c.style.height = h + 'px';
    this.gl.viewport(0, 0, c.width, c.height);
  };
  Renderer.prototype.createMesh = function (b) {
    const gl = this.gl; const n = b.p.length / 3; const data = new Float32Array(n * 9);
    let minx = 1e9, miny = 1e9, minz = 1e9, maxx = -1e9, maxy = -1e9, maxz = -1e9;
    for (let i = 0; i < n; i++) {
      const x = b.p[i * 3], y = b.p[i * 3 + 1], z = b.p[i * 3 + 2];
      data[i * 9] = x; data[i * 9 + 1] = y; data[i * 9 + 2] = z;
      data[i * 9 + 3] = b.n[i * 3]; data[i * 9 + 4] = b.n[i * 3 + 1]; data[i * 9 + 5] = b.n[i * 3 + 2];
      data[i * 9 + 6] = b.c[i * 3]; data[i * 9 + 7] = b.c[i * 3 + 1]; data[i * 9 + 8] = b.c[i * 3 + 2];
      if (x < minx) minx = x; if (y < miny) miny = y; if (z < minz) minz = z; if (x > maxx) maxx = x; if (y > maxy) maxy = y; if (z > maxz) maxz = z;
    }
    const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const center = [(minx + maxx) / 2, (miny + maxy) / 2, (minz + maxz) / 2];
    return { vbo, count: n, center, radius: Math.hypot(maxx - minx, maxy - miny, maxz - minz) / 2 };
  };
  Renderer.prototype.texture = function (canvas) {
    const gl = this.gl; const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  Renderer.prototype.setupCamera = function () {
    const c = this.canvas; perspective(this.proj, this.cam.fov, c.width / Math.max(1, c.height), this.cam.near, this.cam.far);
    lookAt(this.view, this.cam.pos, this.cam.target, [0, 1, 0]); mul(this.vp, this.proj, this.view);
  };
  Renderer.prototype.project = function (p) { // 世界座標 → 螢幕(CSS px)
    const r = xform(this.vp, p); const c = this.canvas; const pr = this.pixelRatio;
    return { x: (r[0] * 0.5 + 0.5) * c.width / pr, y: (0.5 - r[1] * 0.5) * c.height / pr, behind: r[3] < 0 || r[2] > 1 };
  };
  // scene: Node 根；sprites: [{pos,size:[w,h],tex,alpha}]；particles: {count, data Float32Array(8 per)}
  Renderer.prototype.render = function (scene, sprites, particles) {
    const gl = this.gl, e = this.env; this.setupCamera();
    gl.clearColor(e.clear[0], e.clear[1], e.clear[2], this.alphaClear ? 0 : 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    scene.update(null);
    const P = this.prog; gl.useProgram(P.p);
    gl.uniformMatrix4fv(P.u.uVP, false, this.vp);
    gl.uniform3fv(P.u.uSun, e.sun); gl.uniform3fv(P.u.uSunCol, e.sunCol); gl.uniform3fv(P.u.uSky, e.sky); gl.uniform3fv(P.u.uGround, e.ground);
    gl.uniform3fv(P.u.uCam, this.cam.pos); gl.uniform3fv(P.u.uFogCol, e.fogCol); gl.uniform2fv(P.u.uFog, e.fog);
    gl.enableVertexAttribArray(P.a.aP); gl.enableVertexAttribArray(P.a.aN); gl.enableVertexAttribArray(P.a.aC);
    const opaque = [], trans = [], tqs = []; const cam = this.cam.pos;
    const walk = (n, unlit) => {
      if (!n.visible) return;
      const ul = unlit || n.unlit;
      if (n.tq) tqs.push(n);
      if (n.mesh) { const item = { n, ul }; if (n.alpha < 1 || n.transparent) { const w = n.world; item.d = Math.hypot(w[12] - cam[0], w[13] - cam[1], w[14] - cam[2]); trans.push(item); } else opaque.push(item); }
      for (const c of n.children) walk(c, ul);
    };
    walk(scene, false);
    const vpm = this.vp;
    const draw = (it) => {
      const n = it.n, m = n.mesh;
      // 視錐粗略剔除
      if (m.radius < 400) {
        const w = n.world; const c = xform(w, m.center); const s = Math.max(Math.hypot(w[0], w[1], w[2]), Math.hypot(w[4], w[5], w[6]), Math.hypot(w[8], w[9], w[10]));
        const r = m.radius * s; const cl = vpm;
        const cx = cl[0] * c[0] + cl[4] * c[1] + cl[8] * c[2] + cl[12], cy = cl[1] * c[0] + cl[5] * c[1] + cl[9] * c[2] + cl[13], cw = cl[3] * c[0] + cl[7] * c[1] + cl[11] * c[2] + cl[15];
        if (cw < -r) return; const lim = cw + r * 2.2;
        if (cx > lim || cx < -lim || cy > lim || cy < -lim) return;
      }
      gl.uniformMatrix4fv(P.u.uM, false, n.world);
      gl.uniform1f(P.u.uAlpha, n.alpha); gl.uniform1f(P.u.uFlash, n.flash || 0); gl.uniform3fv(P.u.uTint, n.tint || [1, 1, 1]); gl.uniform1f(P.u.uUnlit, it.ul ? 1 : 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.vbo);
      gl.vertexAttribPointer(P.a.aP, 3, gl.FLOAT, false, 36, 0); gl.vertexAttribPointer(P.a.aN, 3, gl.FLOAT, false, 36, 12); gl.vertexAttribPointer(P.a.aC, 3, gl.FLOAT, false, 36, 24);
      gl.drawArrays(gl.TRIANGLES, 0, m.count);
    };
    gl.disable(gl.BLEND); gl.depthMask(true);
    for (const it of opaque) { if (it.n.noCull) gl.disable(gl.CULL_FACE); draw(it); if (it.n.noCull) gl.enable(gl.CULL_FACE); }
    trans.sort((a, b) => b.d - a.d);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    for (const it of trans) { if (it.n.noCull) gl.disable(gl.CULL_FACE); draw(it); if (it.n.noCull) gl.enable(gl.CULL_FACE); }
    gl.disableVertexAttribArray(P.a.aN); gl.disableVertexAttribArray(P.a.aC);
    // 貼圖平面（旗幟文字、匾額）
    if (tqs.length) {
      const T = this.tprog; gl.useProgram(T.p); gl.uniformMatrix4fv(T.u.uVP, false, this.vp);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.enableVertexAttribArray(T.a.aQ); gl.vertexAttribPointer(T.a.aQ, 2, gl.FLOAT, false, 0, 0);
      gl.disable(gl.CULL_FACE);
      for (const n of tqs) {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, n.tq.tex); gl.uniform1i(T.u.uTex, 0);
        gl.uniformMatrix4fv(T.u.uM, false, n.world); gl.uniform2fv(T.u.uSize, [n.tq.w, n.tq.h]); gl.uniform1f(T.u.uAlpha, n.alpha);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      gl.enable(gl.CULL_FACE); gl.disableVertexAttribArray(T.a.aQ);
    }
    // 看板
    if (sprites && sprites.length) {
      const S = this.sprog; gl.useProgram(S.p); gl.uniformMatrix4fv(S.u.uVP, false, this.vp);
      const v = this.view; gl.uniform3fv(S.u.uRight, [v[0], v[4], v[8]]); gl.uniform3fv(S.u.uUp, [v[1], v[5], v[9]]);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.enableVertexAttribArray(S.a.aQ); gl.vertexAttribPointer(S.a.aQ, 2, gl.FLOAT, false, 0, 0);
      gl.disable(gl.CULL_FACE);
      const list = sprites.filter(s => s.visible !== false).sort((a, b) => V.len(V.sub(b.pos, cam)) - V.len(V.sub(a.pos, cam)));
      for (const s of list) {
        if (s.depth === false) gl.disable(gl.DEPTH_TEST);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.tex); gl.uniform1i(S.u.uTex, 0);
        gl.uniform3fv(S.u.uCenter, s.pos); gl.uniform2fv(S.u.uSize, s.size); gl.uniform1f(S.u.uAlpha, s.alpha == null ? 1 : s.alpha);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        if (s.depth === false) gl.enable(gl.DEPTH_TEST);
      }
      gl.enable(gl.CULL_FACE); gl.disableVertexAttribArray(S.a.aQ);
    }
    // 粒子
    if (particles && particles.count > 0) {
      const Q = this.pprog; gl.useProgram(Q.p); gl.uniformMatrix4fv(Q.u.uVP, false, this.vp); gl.uniform1f(Q.u.uH, this.canvas.height * 0.5);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.pbuf); gl.bufferData(gl.ARRAY_BUFFER, particles.data.subarray(0, particles.count * 8), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(Q.a.aP); gl.enableVertexAttribArray(Q.a.aC); gl.enableVertexAttribArray(Q.a.aS);
      gl.vertexAttribPointer(Q.a.aP, 3, gl.FLOAT, false, 32, 0); gl.vertexAttribPointer(Q.a.aC, 4, gl.FLOAT, false, 32, 12); gl.vertexAttribPointer(Q.a.aS, 1, gl.FLOAT, false, 32, 28);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, particles.count);
      gl.disableVertexAttribArray(Q.a.aC); gl.disableVertexAttribArray(Q.a.aS);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    gl.depthMask(true); gl.disable(gl.BLEND);
  };

  /* ---------- 粒子系統 ---------- */
  function Particles(max) { this.max = max || 2000; this.list = []; this.data = new Float32Array(this.max * 8); this.count = 0; }
  Particles.prototype.emit = function (p) { if (this.list.length < this.max) this.list.push(p); };
  Particles.prototype.update = function (dt) {
    let k = 0; const out = this.data; const keep = [];
    for (const p of this.list) {
      p.life -= dt; if (p.life <= 0) continue;
      p.v[1] -= (p.g || 0) * dt; const dr = p.drag || 0; if (dr) { p.v[0] *= (1 - dr * dt); p.v[1] *= (1 - dr * dt); p.v[2] *= (1 - dr * dt); }
      p.p[0] += p.v[0] * dt; p.p[1] += p.v[1] * dt; p.p[2] += p.v[2] * dt;
      const t = p.life / p.max; keep.push(p);
      out[k * 8] = p.p[0]; out[k * 8 + 1] = p.p[1]; out[k * 8 + 2] = p.p[2];
      out[k * 8 + 3] = p.c[0]; out[k * 8 + 4] = p.c[1]; out[k * 8 + 5] = p.c[2]; out[k * 8 + 6] = Math.min(1, t * 2) * (p.a == null ? 1 : p.a);
      out[k * 8 + 7] = p.s * (p.shrink ? (0.3 + 0.7 * t) : 1); k++;
    }
    this.list = keep; this.count = k;
  };
  M3D.Particles = Particles;

  /* ---------- 文字看板 ---------- */
  M3D.textCanvas = function (text, opt) {
    opt = opt || {}; const fs = opt.size || 48; const pad = opt.pad || 18;
    const c = document.createElement('canvas'); const ctx = c.getContext('2d');
    const font = `${opt.weight || 900} ${fs}px ${opt.font || '"Kaiti TC","BiauKai","STKaiti","PingFang TC","Noto Serif CJK TC","Noto Sans CJK TC",serif'}`;
    ctx.font = font; const lines = String(text).split('\n');
    const w = Math.ceil(Math.max(...lines.map(l => ctx.measureText(l).width))) + pad * 2; const h = lines.length * fs * 1.25 + pad * 2;
    c.width = w; c.height = h; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (opt.bg !== false) {
      const r = Math.min(24, h / 2); ctx.fillStyle = opt.bg || 'rgba(120,20,20,0.88)'; ctx.strokeStyle = opt.border || '#f4c95d'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(r, 3); ctx.arcTo(w - 3, 3, w - 3, h - 3, r); ctx.arcTo(w - 3, h - 3, 3, h - 3, r); ctx.arcTo(3, h - 3, 3, 3, r); ctx.arcTo(3, 3, w - 3, 3, r); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    lines.forEach((l, i) => {
      const y = pad + fs * 1.25 * (i + 0.5);
      if (opt.stroke) { ctx.strokeStyle = opt.stroke; ctx.lineWidth = 8; ctx.strokeText(l, w / 2, y); }
      ctx.fillStyle = opt.color || '#fff6d8'; ctx.fillText(l, w / 2, y);
    });
    return c;
  };

  window.M3D = M3D;
})();
