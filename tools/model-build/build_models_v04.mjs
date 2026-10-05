/* beta 0.4 真实外形模型构建 (Node)
 * 源: Sketchfab 上 CC BY 4.0 的 GLB (经 Objaverse 数据集获取, 每个模型按其原始许可再分发)
 * 流程: 读取 -> 自动朝向 -> 去除起落架 (游戏用程序化起落架) -> 网格简化 -> 按游戏机型尺寸缩放
 *       -> 生成 UV + 中性白色底图 (舷窗/舱门/风挡自绘) + 涂装遮罩 -> 输出 models/ac_*.js / tex_*.js
 * 用法: node build_models_v04.mjs <srcDir> <outDir> [debugDir]
 * 依赖: @gltf-transform/core, meshoptimizer, sharp (tools/node_modules)
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import sharp from 'sharp';
import { MeshoptSimplifier } from 'meshoptimizer';
import { loadOriented } from './orient.mjs';
import { render } from './raster.mjs';

const require = createRequire(import.meta.url);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../..');
const [SRC, OUT, DBG] = process.argv.slice(2);
global.window = global;
const _log = console.log; console.log = () => {};
require(path.join(ROOT, 'js/utils.js')); require(path.join(ROOT, 'js/config.js'));
console.log = _log;
const DB = global.FS.AIRCRAFT_DB;
const PLANS = JSON.parse(fs.readFileSync(path.join(HERE, 'plans.json'), 'utf8'));

const SOURCES = {
  A330: { file: 'b474aa79.glb', uid: 'b474aa79c03148f78f607ce816839824', title: 'Airbus A330', author: 'Andre11230',
    target: 18000, winY: 0.20, family: 'airbus' },
  B737MAX: { file: '197ae72c.glb', uid: '197ae72ceb5441efa91b8bdc2ee37050', title: '737 Max-8 (Free)', author: 'AMGP3D',
    target: 16000, winY: 0.22, family: 'boeing', fanMat: /blades/i, dropMat: /^$/ },
  B777: { file: 'cfe500ad.glb', uid: 'cfe500ad3fb14b9ba950dd5403f57ec1', title: 'Boeing 777- 300ER', author: 'Adam.White',
    target: 18000, winY: 0.20, family: 'boeing', dropMat: /wheels/i }
};
const TYPES = { 'A330-300': 'A330', 'B737-MAX8': 'B737MAX', 'B777-300ER': 'B777' };

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const b64 = (ta) => Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength).toString('base64');

function weld(P, I, eps) {
  const map = new Map(), remap = new Uint32Array(P.length / 3), out = [];
  for (let i = 0; i < P.length / 3; i++) {
    const k = Math.round(P[i * 3] / eps) + ',' + Math.round(P[i * 3 + 1] / eps) + ',' + Math.round(P[i * 3 + 2] / eps);
    let j = map.get(k);
    if (j === undefined) { j = out.length / 3; map.set(k, j); out.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); }
    remap[i] = j;
  }
  const J = new Uint32Array(I.length); for (let i = 0; i < I.length; i++) J[i] = remap[I[i]];
  return { P: Float32Array.from(out), I: J };
}

function components(nv, I) {
  const par = new Int32Array(nv); for (let i = 0; i < nv; i++) par[i] = i;
  const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  for (let t = 0; t < I.length; t += 3) { const a = find(I[t]), b = find(I[t + 1]), c = find(I[t + 2]); par[b] = a; par[find(c)] = a; }
  const comp = new Int32Array(I.length / 3); for (let t = 0; t < comp.length; t++) comp[t] = find(I[t * 3]);
  return comp;
}

function bboxOf(P, idxList) {
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const i of idxList) for (let a = 0; a < 3; a++) { const v = P[i * 3 + a]; if (v < lo[a]) lo[a] = v; if (v > hi[a]) hi[a] = v; }
  return { lo, hi };
}

function measure(P) {
  let zmin = 1e9, zmax = -1e9, xmin = 1e9, xmax = -1e9;
  for (let i = 0; i < P.length; i += 3) { zmin = Math.min(zmin, P[i + 2]); zmax = Math.max(zmax, P[i + 2]); xmin = Math.min(xmin, P[i]); xmax = Math.max(xmax, P[i]); }
  const L = zmax - zmin, secs = [];
  for (let k = 0; k < 7; k++) {
    const f = 0.13 + k * 0.015; let ax = 0, y0 = 1e9, y1 = -1e9, n = 0;
    for (let i = 0; i < P.length; i += 3) {
      const z = P[i + 2]; if (z < zmin + L * (f - 0.012) || z > zmin + L * (f + 0.012) || Math.abs(P[i]) > L * 0.09) continue;
      ax = Math.max(ax, Math.abs(P[i])); y0 = Math.min(y0, P[i + 1]); y1 = Math.max(y1, P[i + 1]); n++;
    }
    if (n > 4) secs.push([ax, y0, y1]);
  }
  secs.sort((a, b) => a[0] - b[0]);
  const [Rm, y0, y1] = secs[secs.length >> 1];
  return { zmin, L, Rm, yc: (y0 + y1) / 2, span: xmax - xmin };
}

// 机身半径剖面 (按游戏机型参数的解析近似, 用于分类与贴图)
function radiusAt(z, plan, dims) {
  const R = plan.R, zN = plan.zN, zT = plan.zT;
  const nl = dims.noseLength || 0.14 * dims.length, tl = dims.tailConeLength || 0.22 * dims.length;
  if (z < zN + nl) { const t = Math.max(0, (z - zN) / nl); return R * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))); }
  if (z > zT - tl) { const t = Math.min(1, (z - (zT - tl)) / tl); return R * (1 - 0.85 * Math.pow(t, 1.3)); }
  return R;
}

async function buildSource(key) {
  const s = SOURCES[key];
  const d = await loadOriented(path.join(SRC, s.file));
  const fanRx = s.fanMat || /^\0$/, dropRx = s.dropMat || /^\0$/;
  // 每三角形: 材质类别
  const triKind = new Uint8Array(d.tm.length); // 0 普通 1 暗色 2 风扇 255 丢弃
  for (let t = 0; t < d.tm.length; t++) {
    const p = d.prims[d.tm[t]], c = p.color;
    const lum = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    triKind[t] = dropRx.test(p.mat) ? 255 : fanRx.test(p.mat) ? 2 : (lum < 0.25 || c[3] < 0.6) ? 1 : 0;
  }
  // 源单位 -> 米的粗略比例 (只用于焊接容差)
  const m0 = measure(d.P);
  const w = weld(d.P, d.I, m0.L * 2e-6);
  let P = w.P, I = w.I;
  const nv = P.length / 3;
  // 去掉起落架: 机身下方中线附近、不与机身相连的小部件
  const comp = components(nv, I);
  const compTris = new Map();
  for (let t = 0; t < comp.length; t++) { if (triKind[t] === 255) continue; let a = compTris.get(comp[t]); if (!a) compTris.set(comp[t], a = []); a.push(t); }
  const m = measure(P);
  const keep = new Uint8Array(comp.length);
  let dropped = 0, droppedComps = 0;
  for (const [, tris] of compTris) {
    const vs = new Set(); for (const t of tris) { vs.add(I[t * 3]); vs.add(I[t * 3 + 1]); vs.add(I[t * 3 + 2]); }
    const bb = bboxOf(P, vs);
    const cx = (bb.lo[0] + bb.hi[0]) / 2;
    const gear = bb.lo[1] < m.yc - m.Rm * 1.12 && bb.hi[1] < m.yc - m.Rm * 0.25 && Math.abs(cx) < m.Rm * 2.1 &&
      (bb.hi[0] - bb.lo[0]) < m.Rm * 1.6 && (bb.hi[2] - bb.lo[2]) < m.L * 0.09;
    if (gear) { dropped += tris.length; droppedComps++; continue; }
    for (const t of tris) keep[t] = 1;
  }
  return { s, P, I, triKind, keep, m, dropped, droppedComps, srcTris: d.tm.length, info: d.info };
}

function simplifyKind(P, I, triKind, keep, kind, ratio) {
  const sel = [];
  for (let t = 0; t < I.length / 3; t++) if (keep[t] && triKind[t] === kind) sel.push(I[t * 3], I[t * 3 + 1], I[t * 3 + 2]);
  if (!sel.length) return new Uint32Array(0);
  const idx = Uint32Array.from(sel);
  const target = Math.max(3, Math.floor(idx.length * ratio / 3) * 3);
  if (ratio >= 0.999) return idx;
  const [res] = MeshoptSimplifier.simplify(idx, P, 3, target, 0.004, ['LockBorder']);
  return res;
}

function transform(P, m, plan, dims) {
  const R = plan.R, span = dims.wingspan;
  const kf = R / m.Rm, kw = (span / 2 - kf * m.Rm) / (m.span / 2 - m.Rm), sz = dims.length / m.L;
  const X = new Float32Array(P.length);
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], ax = Math.abs(x);
    X[i] = Math.sign(x) * (ax <= m.Rm ? ax * kf : kf * m.Rm + (ax - m.Rm) * kw);
    X[i + 1] = (P[i + 1] - m.yc) * kf;
    X[i + 2] = (P[i + 2] - m.zmin) * sz + plan.zN;
  }
  return { X, kf, kw, sz };
}

/* ---------------- 贴图布局 ----------------
   机身带: v ∈ [0, 0.66], θ=(v-0.31)/0.6·2π (θ=0 顶部, +θ 右侧), u = 0.01 + 0.98·(z-zN)/L
   垂尾:   u ∈ [0.01, 0.49], v ∈ [0.69, 0.98] (侧向平面投影)
   色块:   机翼浅灰 (0.62,0.84) / 暗色 (0.80,0.84) / 金属 (0.93,0.84)                         */
const CELL = { wing: [0.62, 0.84], dark: [0.80, 0.84], metal: [0.93, 0.84] };
// 机头前 12% 机身长度占 0.25 的 u 宽度 (风挡更清晰)
const uOfZf = (zf) => zf < 0.12 ? 0.01 + zf / 0.12 * 0.25 : 0.26 + (zf - 0.12) / 0.88 * 0.73;
const zfOfU = (u) => u < 0.26 ? (u - 0.01) / 0.25 * 0.12 : 0.12 + (u - 0.26) / 0.73 * 0.88;
const bodyU = (z, plan, L) => uOfZf((z - plan.zN) / L);
const bodyV = (th) => 0.31 + th / (2 * Math.PI) * 0.6;

// 风挡: 在 (z, θ) 上按实测机头半径换算成侧视高度 y = r(z)·cosθ 判定 (连续风挡带 + 窗框立柱)
const WS = {
  airbus: { z0: 0.50, z1: 1.60, yL: 0.30, yU0: 0.58, yU1: 0.68, lean: 0.55, posts: [0.80, 1.18], postTh: 40 },
  boeing: { z0: 0.55, z1: 1.55, yL: 0.33, yU0: 0.58, yU1: 0.64, lean: 0.55, posts: [0.86, 1.22], postTh: 38 }
};
function windshield(z, th, plan, rN, fam) {
  const w = WS[fam], R = plan.R, dz = (z - plan.zN) / R;
  if (dz < w.z0 - 0.05 || dz > w.z1 + 0.05) return 0;
  const r = rN(z); if (!(r > 0.1 * R)) return 0;
  const y = r * Math.cos(th * Math.PI / 180) / R;
  const f = (dz - w.z0) / (w.z1 - w.z0);
  const yU = w.yU0 + (w.yU1 - w.yU0) * f;
  if (y < w.yL || y > yU || th < 3.5) return 0;
  const zEnd = w.z1 - (y - w.yL) * w.lean;          // 后缘上部前倾
  if (dz < w.z0 || dz > zEnd) return 0;
  for (const p of w.posts) if (Math.abs(dz - p - (y - w.yL) * 0.15) < 0.022) return 0;
  if (Math.abs(th - w.postTh) < 1.6 && dz < w.posts[0] + 0.05) return 0;
  return 1;
}

async function paintTextures(key, src, plan, dims, L, fin, rN) {
  const W = 2048, H = 1024, MW = 512;
  const base = new Float32Array(W * H * 3).fill(250);
  const mask = new Uint8Array(MW * MW * 3);
  const R = plan.R, fam = src.s.family;
  const doors = (dims.doorPositions || []).slice();
  const pitch = fam === 'boeing' ? 0.508 : 0.533;
  const winZ = [];
  for (let z = doors[0] + 1.25; z < doors[doors.length - 1] - 0.9; z += pitch) {
    if (doors.some((dz) => Math.abs(z - dz) < 0.95)) continue;
    winZ.push(z);
  }
  const thW = Math.acos(src.s.winY);
  const doorW = dims.length > 50 ? 1.07 : 0.86, doorH = 1.9;
  const set = (o, r, g, b, a) => { base[o] += (r - base[o]) * a; base[o + 1] += (g - base[o + 1]) * a; base[o + 2] += (b - base[o + 2]) * a; };
  for (let py = 0; py < H; py++) {
    const v = (py + 0.5) / H;
    for (let px = 0; px < W; px++) {
      const u = (px + 0.5) / W, o = (py * W + px) * 3;
      if (v < 0.665) {
        const z = plan.zN + zfOfU(u) * L, th = (v - 0.31) / 0.6 * 2 * Math.PI;
        const r = Math.max(0.05, radiusAt(z, plan, dims));
        const cy = Math.cos(th), ath = Math.abs(((th + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
        // 细微蒙皮接缝
        const zr = z - plan.zN;
        if (Math.abs(((zr % 4.6) + 4.6) % 4.6 - 2.3) > 2.28) set(o, 228, 230, 233, 0.5);
        // 舷窗
        for (const zw of winZ) {
          if (Math.abs(z - zw) > 0.3) continue;
          const dzw = Math.abs(z - zw) / 0.125, dth = Math.abs(ath - thW) * R / 0.19;
          const dd = Math.pow(Math.pow(dzw, 4) + Math.pow(dth, 4), 0.25);
          if (dd < 1.15) set(o, 38, 44, 54, Math.min(1, (1.15 - dd) * 6));
        }
        // 舱门 (外框 + 小窗)
        for (const zd of doors) {
          const dz = Math.abs(z - zd), arc = (ath - Math.acos(0.12)) * R;
          if (dz > doorW) continue;
          const ex = Math.abs(dz - doorW / 2), ey = Math.abs(Math.abs(arc) - doorH / 2);
          if ((ex < 0.035 && Math.abs(arc) < doorH / 2) || (ey < 0.035 && dz < doorW / 2)) set(o, 150, 154, 160, 0.9);
          if (dz < 0.13 && Math.abs(arc + doorH * 0.22) < 0.17) set(o, 38, 44, 54, 1);
        }
        // 风挡
        if (zr < 2.0 * R) {
          // 2x2 超采样抗锯齿
          let cov = 0;
          for (const [sx, sy] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) {
            const zz = plan.zN + zfOfU(u + sx / W) * L, tt = (v + sy / H - 0.31) / 0.6 * 2 * Math.PI;
            const aa = Math.abs(((tt + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
            cov += windshield(zz, aa * 180 / Math.PI, plan, rN, fam) * 0.25;
          }
          if (cov > 0) set(o, 30, 36, 46, cov);
        }
        // 机头雷达罩接缝
        if (Math.abs(zr - R * 0.55) < 0.025 && cy < 0.3) set(o, 205, 208, 212, 0.8);
        if (r < 0.06) set(o, 250, 250, 250, 1);
      } else if (u < 0.5 && v > 0.685) {
        // 垂尾: 轻微的方向舵分界线
        const fz = fin.z0 + (u - 0.01) / 0.48 * (fin.z1 - fin.z0), fy = fin.y0 + (v - 0.69) / 0.29 * (fin.y1 - fin.y0);
        const rudderZ = fin.z1 - (fin.z1 - fin.z0) * 0.24 - (fy - fin.y0) * 0.35;
        if (Math.abs(fz - rudderZ) < 0.04) set(o, 200, 204, 210, 0.9);
      } else if (u >= 0.55 && v > 0.70 && v < 0.98) {
        if (u < 0.71) set(o, 222, 224, 228, 1);
        else if (u < 0.88) set(o, 46, 50, 58, 1);
        else set(o, 168, 172, 178, 1);
      }
    }
  }
  for (let py = 0; py < MW; py++) {
    const v = (py + 0.5) / MW;
    for (let px = 0; px < MW; px++) {
      const u = (px + 0.5) / MW, o = (py * MW + px) * 3;
      if (v < 0.665) {
        const z = plan.zN + zfOfU(u) * L, th = (v - 0.31) / 0.6 * 2 * Math.PI;
        const yN = Math.cos(th), zf = (z - plan.zN) / L;
        const stripe = smooth(-0.36, -0.33, yN) * (1 - smooth(-0.20, -0.17, yN)) * smooth(0.10, 0.14, zf) * (1 - smooth(0.80, 0.86, zf));
        const belly = smooth(-0.42, -0.70, yN);
        const ath = Math.abs(((th + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
        const ws = windshield(z, ath * 180 / Math.PI, plan, rN, src.s.family);
        mask[o + 1] = Math.round(255 * stripe * (1 - ws));
        mask[o + 2] = Math.round(255 * belly * (1 - stripe));
      } else if (u < 0.5 && v > 0.685) mask[o] = 255;
    }
  }
  const b8 = Buffer.alloc(W * H * 3); for (let i = 0; i < b8.length; i++) b8[i] = Math.max(0, Math.min(255, Math.round(base[i])));
  const jpg = await sharp(b8, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 86 }).toBuffer();
  const png = await sharp(Buffer.from(mask), { raw: { width: MW, height: MW, channels: 3 } }).png({ compressionLevel: 9 }).toBuffer();
  if (DBG) { fs.writeFileSync(path.join(DBG, key + '_base.jpg'), jpg); fs.writeFileSync(path.join(DBG, key + '_mask.png'), png); }
  return { base: 'data:image/jpeg;base64,' + jpg.toString('base64'), mask: 'data:image/png;base64,' + png.toString('base64'), raw: b8, W, H };
}

function buildOutput(X, tris, cls, triUV, crease) {
  // tris: Uint32Array 索引; cls/ triUV(t, corner) -> [u,v]; 法线按折角平滑
  const nt = tris.length / 3, nv = X.length / 3;
  const fn = new Float32Array(nt * 3);
  const vt = Array.from({ length: nv }, () => []);
  for (let t = 0; t < nt; t++) {
    const a = tris[t * 3] * 3, b = tris[t * 3 + 1] * 3, c = tris[t * 3 + 2] * 3;
    const e1 = [X[b] - X[a], X[b + 1] - X[a + 1], X[b + 2] - X[a + 2]], e2 = [X[c] - X[a], X[c + 1] - X[a + 1], X[c + 2] - X[a + 2]];
    fn[t * 3] = e1[1] * e2[2] - e1[2] * e2[1]; fn[t * 3 + 1] = e1[2] * e2[0] - e1[0] * e2[2]; fn[t * 3 + 2] = e1[0] * e2[1] - e1[1] * e2[0];
    for (let k = 0; k < 3; k++) vt[tris[t * 3 + k]].push(t);
  }
  const cosC = Math.cos(crease * Math.PI / 180);
  const unit = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  const keyMap = new Map(), pos = [], nrm = [], uv = [], idx = [];
  for (let t = 0; t < nt; t++) {
    const ft = unit(fn[t * 3], fn[t * 3 + 1], fn[t * 3 + 2]);
    for (let k = 0; k < 3; k++) {
      const vi = tris[t * 3 + k];
      let sx = 0, sy = 0, sz = 0;
      for (const s of vt[vi]) {
        const f = unit(fn[s * 3], fn[s * 3 + 1], fn[s * 3 + 2]);
        if (f[0] * ft[0] + f[1] * ft[1] + f[2] * ft[2] >= cosC) { sx += fn[s * 3]; sy += fn[s * 3 + 1]; sz += fn[s * 3 + 2]; }
      }
      const n = unit(sx, sy, sz);
      const q = n.map((x) => Math.round(x * 127));
      const [u, v] = triUV(t, k);
      const key = vi + '|' + q.join(',') + '|' + Math.round(u * 4096) + ',' + Math.round(v * 4096);
      let j = keyMap.get(key);
      if (j === undefined) { j = pos.length / 3; keyMap.set(key, j); pos.push(X[vi * 3], X[vi * 3 + 1], X[vi * 3 + 2]); nrm.push(...q); uv.push(u, v); }
      idx.push(j);
    }
  }
  return { pos: Float32Array.from(pos), nrm: Int8Array.from(nrm), uv: Float32Array.from(uv), idx: Uint32Array.from(idx) };
}

function pack(o, pivot) {
  const P = o.pos.slice();
  if (pivot) for (let i = 0; i < P.length; i += 3) { P[i] -= pivot[0]; P[i + 1] -= pivot[1]; P[i + 2] -= pivot[2]; }
  if (P.length / 3 > 65535) throw new Error('too many vertices ' + P.length / 3);
  return { pos: b64(P), nrm: b64(o.nrm), uv: b64(o.uv), idx: b64(Uint16Array.from(o.idx)), vcount: P.length / 3, icount: o.idx.length };
}

async function main() {
  await MeshoptSimplifier.ready;
  fs.mkdirSync(OUT, { recursive: true }); if (DBG) fs.mkdirSync(DBG, { recursive: true });
  const report = {};
  for (const [tkey, skey] of Object.entries(TYPES)) {
    const src = await buildSource(skey);
    const plan = PLANS[tkey], dims = DB[tkey].dims;
    const { P, I, triKind, keep, m } = src;
    // 简化: 各类别按同一比例
    let nKeep = 0; for (let t = 0; t < keep.length; t++) if (keep[t]) nKeep++;
    const ratio = Math.min(1, src.s.target / nKeep);
    const parts = [0, 1, 2].map((k) => simplifyKind(P, I, triKind, keep, k, k === 2 ? Math.min(1, ratio * 1.5) : ratio));
    const { X, kf, kw, sz } = transform(P, m, plan, dims);
    let zmin = 1e9, zmax = -1e9;
    for (const part of parts) for (const i of part) { zmin = Math.min(zmin, X[i * 3 + 2]); zmax = Math.max(zmax, X[i * 3 + 2]); }
    const L = zmax - zmin, R = plan.R;
    // 三角形分类
    const all = [], kinds = [];
    parts.forEach((part, k) => { for (let i = 0; i < part.length; i += 3) { all.push(part[i], part[i + 1], part[i + 2]); kinds.push(k); } });
    const T = Uint32Array.from(all), nt = T.length / 3;
    const cls = new Uint8Array(nt); // 1 机身 2 垂尾 3 机翼 4 暗色 5 金属(风扇)
    const fin = { z0: 1e9, z1: -1e9, y0: 1e9, y1: -1e9 };
    const cen = (t) => { const a = T[t * 3] * 3, b = T[t * 3 + 1] * 3, c = T[t * 3 + 2] * 3; return [(X[a] + X[b] + X[c]) / 3, (X[a + 1] + X[b + 1] + X[c + 1]) / 3, (X[a + 2] + X[b + 2] + X[c + 2]) / 3]; };
    const fnrm = (t) => { const a = T[t * 3] * 3, b = T[t * 3 + 1] * 3, c = T[t * 3 + 2] * 3;
      const e1 = [X[b] - X[a], X[b + 1] - X[a + 1], X[b + 2] - X[a + 2]], e2 = [X[c] - X[a], X[c + 1] - X[a + 1], X[c + 2] - X[a + 2]];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; const l = Math.hypot(...n) || 1; return n.map((v) => v / l); };
    for (let t = 0; t < nt; t++) {
      const [cx, cy, cz] = cen(t);
      if (kinds[t] === 1) { cls[t] = 4; continue; }
      if (kinds[t] === 2) { cls[t] = 5; continue; }
      const r = radiusAt(cz, plan, dims), n = fnrm(t);
      const rl = Math.hypot(cx, cy) || 1, radial = (n[0] * cx + n[1] * cy) / rl;
      if (cz > plan.zN + 0.6 * L && cy > R * 0.92 && Math.abs(cx) < 0.9 && Math.abs(n[0]) > 0.55) cls[t] = 2;
      else if (cy > -r * 1.35 - 0.3 && cy < r * 1.3 + 0.3 && (Math.abs(cx) < r * 0.8 || (Math.abs(cx) < r * 1.15 + 0.1 && radial > 0.6))) cls[t] = 1;
      else cls[t] = 3;
    }
    // 风扇: 只取每侧 "叶片" 材质里最靠前 1.1 m 的部分 (风扇盘 + 整流锥), 其余为静止金属件
    for (const side of [-1, 1]) {
      let zf = 1e9; const lst = [];
      for (let t = 0; t < nt; t++) if (cls[t] === 5 && Math.sign(cen(t)[0]) === side) { lst.push(t); zf = Math.min(zf, cen(t)[2]); }
      for (const t of lst) if (cen(t)[2] > zf + 1.1) cls[t] = 6;
    }
    for (let t = 0; t < nt; t++) if (cls[t] === 2) for (let k = 0; k < 3; k++) {
      const i = T[t * 3 + k] * 3; fin.z0 = Math.min(fin.z0, X[i + 2]); fin.z1 = Math.max(fin.z1, X[i + 2]); fin.y0 = Math.min(fin.y0, X[i + 1]); fin.y1 = Math.max(fin.y1, X[i + 1]);
    }
    // 实测机头剖面半径 (0.2 m 一档)
    const nb = Math.ceil(L * 0.3 / 0.2), rTop = new Float32Array(nb), rSide = new Float32Array(nb);
    for (const part of [parts[0]]) for (const i of part) {
      const x = X[i * 3], y = X[i * 3 + 1], b = Math.floor((X[i * 3 + 2] - plan.zN) / 0.2);
      if (b < 0 || b >= nb) continue;
      if (Math.abs(x) < 0.15 * R) rTop[b] = Math.max(rTop[b], y);
      if (Math.abs(y) < 0.15 * R) rSide[b] = Math.max(rSide[b], Math.abs(x));
    }
    const rawR = new Float32Array(nb);
    for (let b = 0; b < nb; b++) { const v = Math.max(rTop[b], rSide[b]); rawR[b] = v > 0 ? v : radiusAt(plan.zN + (b + 0.5) * 0.2, plan, dims); }
    // 单调化 (机头半径向后不减) + 5 档滑动平均, 避免风挡边缘出现台阶
    for (let b = 1; b < nb; b++) rawR[b] = Math.max(rawR[b], rawR[b - 1]);
    const smR = new Float32Array(nb);
    for (let b = 0; b < nb; b++) { let s2 = 0, n2 = 0; for (let k = -2; k <= 2; k++) { const j = b + k; if (j >= 0 && j < nb) { s2 += rawR[j]; n2++; } } smR[b] = s2 / n2; }
    const rN = (z) => { const fb = (z - plan.zN) / 0.2 - 0.5; if (fb < 0) return smR[0] * Math.max(0, 1 + fb); if (fb >= nb - 1) return radiusAt(z, plan, dims);
      const b0 = Math.floor(fb), t = fb - b0; return smR[b0] * (1 - t) + smR[b0 + 1] * t; };
    const tex = await paintTextures(skey, src, plan, dims, L, fin, rN);
    const triUV = (t, k) => {
      const i = T[t * 3 + k] * 3, c = cls[t];
      if (c === 1) {
        let th = Math.atan2(X[i], X[i + 1]);
        // 跨越机腹接缝 (θ=±π) 的三角形: 统一到同一侧
        const ths = [0, 1, 2].map((q) => { const j = T[t * 3 + q] * 3; return Math.atan2(X[j], X[j + 1]); });
        if (Math.max(...ths) - Math.min(...ths) > Math.PI) { const neg = ths.filter((x) => x < 0).length; if (neg >= 2) { if (th > 0) th -= 2 * Math.PI; } else if (th < 0) th += 2 * Math.PI; }
        return [bodyU(X[i + 2], plan, L), Math.min(0.664, Math.max(0.0, bodyV(th)))];
      }
      if (c === 2) return [0.01 + 0.48 * (X[i + 2] - fin.z0) / (fin.z1 - fin.z0), 0.69 + 0.29 * (X[i + 1] - fin.y0) / (fin.y1 - fin.y0)];
      return c === 3 ? CELL.wing : c === 4 ? CELL.dark : CELL.metal;   // 5 风扇 / 6 静止金属
    };
    // 风扇
    const fans = [], fanTris = [[], []];
    for (let t = 0; t < nt; t++) if (cls[t] === 5) fanTris[cen(t)[0] > 0 ? 1 : 0].push(t);
    const bodyT = [];
    for (let t = 0; t < nt; t++) if (cls[t] !== 5) bodyT.push(T[t * 3], T[t * 3 + 1], T[t * 3 + 2]);
    // 只保留真正位于短舱前部的风扇 (其余 "Blades" 材质三角形并回机身)
    for (const side of [-1, 1]) {
      const list = fanTris[side > 0 ? 1 : 0]; if (!list.length) continue;
      const vs = new Set(); list.forEach((t) => { for (let k = 0; k < 3; k++) vs.add(T[t * 3 + k]); });
      const bb = bboxOf(X, vs);
      const pivot = [(bb.lo[0] + bb.hi[0]) / 2, (bb.lo[1] + bb.hi[1]) / 2, (bb.lo[2] + bb.hi[2]) / 2];
      const radius = Math.max(bb.hi[0] - bb.lo[0], bb.hi[1] - bb.lo[1]) / 2;
      const ft = []; list.forEach((t) => ft.push(T[t * 3], T[t * 3 + 1], T[t * 3 + 2]));
      const tt = Uint32Array.from(ft);
      const o = buildOutput(X, tt, null, (t2, k) => CELL.metal, 30);
      fans.push({ side, pivot, radius, mesh: pack(o, pivot) });
    }
    // 机身输出 (用 bodyT 但 triUV 需要原 t 编号 -> 重建映射)
    const bodyIdx = []; for (let t = 0; t < nt; t++) if (cls[t] !== 5) bodyIdx.push(t);
    const bo = buildOutput(X, Uint32Array.from(bodyT), null, (t2, k) => triUV(bodyIdx[t2], k), 38);
    // 锚点
    const used = new Set(bodyT);
    let tip = null, tail = null, nacBottom = 1e9, bodyBottom = 1e9, finTop = -1e9;
    let wingRootLE = 1e9, wrPt = null, ringTop = -1e9, ringBot = 1e9;
    const half = dims.wingspan / 2;
    for (const i of used) {
      const x = X[i * 3], y = X[i * 3 + 1], z = X[i * 3 + 2];
      if (!tip || x > tip[0]) tip = [x, y, z];
      if (Math.abs(x) < 0.8 && (!tail || z > tail[2])) tail = [x, y, z];
      if (Math.abs(x) > R * 1.4 && Math.abs(x) < half * 0.6) nacBottom = Math.min(nacBottom, y);
      if (Math.abs(x) < R * 1.05) bodyBottom = Math.min(bodyBottom, y);
      finTop = Math.max(finTop, y);
      if (Math.abs(x) > R * 1.05 && Math.abs(x) < R * 3.0 && y > -0.75 * R && z > plan.zN + L * 0.25 && z < plan.zN + L * 0.7 && z < wingRootLE) { wingRootLE = z; wrPt = [x, y, z]; }
    }
    for (const i of used) { const x = X[i * 3], y = X[i * 3 + 1], z = X[i * 3 + 2]; if (Math.abs(z - wingRootLE) < L * 0.15 && Math.abs(x) < 1.0) { ringTop = Math.max(ringTop, y); ringBot = Math.min(ringBot, y); } }
    const anchors = { tipR: tip, wingRootLEPt: wrPt, bodyTopAtWing: ringTop, bodyBotAtWing: ringBot, tail, nacelleBottom: nacBottom,
      bodyBottom, finTop, wingRootLE, length: L, span: 2 * tip[0] };
    const s = src.s;
    const url = 'https://sketchfab.com/3d-models/' + s.uid;
    const asset = {
      key: tkey, source: skey, derived: false, plug: null,
      credit: { title: s.title, author: s.author, license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', url },
      body: pack(bo), fans, texId: skey, anchors, triangles: nt
    };
    const fn = 'ac_' + tkey.replace(/-/g, '_').toLowerCase() + '.js';
    let js = '/* 自动生成 (tools/model-build/build_models_v04.mjs) — 请勿手改\n   模型: "' + s.title + '", 作者 ' + s.author + ', 许可 CC BY 4.0\n   来源: ' + url + ' (经 Objaverse 数据集获取)\n   修改: 中性白色重新上色/去除原涂装与标志、去除起落架、网格简化、按游戏机型尺寸缩放 — 见 ASSETS_LICENSES.md */\n';
    js += '(function (g) { var FS = g.FS = g.FS || {}; FS.ModelAssets = FS.ModelAssets || {};\nFS.ModelAssets[' + JSON.stringify(tkey) + '] = ' + JSON.stringify(asset) + ';\n})(typeof window !== "undefined" ? window : globalThis);\n';
    fs.writeFileSync(path.join(OUT, fn), js);
    const tfn = 'tex_' + skey.toLowerCase() + '.js';
    let tj = '/* 自动生成 — ' + s.title + ' (' + s.author + ', CC BY 4.0) 的游戏内贴图: 中性白色底图 (自绘舷窗/舱门/风挡) + 涂装遮罩 */\n';
    tj += '(function (g) { var FS = g.FS = g.FS || {}; FS.ModelTextures = FS.ModelTextures || {};\nFS.ModelTextures[' + JSON.stringify(skey) + '] = { base: ' + JSON.stringify(tex.base) + ', mask: ' + JSON.stringify(tex.mask) + ' };\n})(typeof window !== "undefined" ? window : globalThis);\n';
    fs.writeFileSync(path.join(OUT, tfn), tj);
    report[tkey] = { file: fn, tex: tfn, srcTris: src.srcTris, gearDropped: src.dropped, gearComps: src.droppedComps, tris: nt, verts: bo.pos.length / 3,
      kf: +kf.toFixed(4), kw: +kw.toFixed(4), sz: +sz.toFixed(4), L: +L.toFixed(2), anchors, fans: fans.map((f) => [f.side, f.pivot.map((v) => +v.toFixed(2)), +f.radius.toFixed(2)]), planGroundY: plan.groundY, bytes: js.length };
    console.log(tkey, JSON.stringify(report[tkey]));
    if (DBG) {
      // 带贴图的调试渲染
      const pal = { 1: [250, 250, 250], 2: [230, 90, 80], 3: [120, 160, 230], 4: [40, 40, 40], 5: [240, 200, 60], 6: [120, 220, 120] };
      render(path.join(DBG, tkey + '_cls.png'), X, T, (t) => pal[cls[t]], 700);
      render(path.join(DBG, tkey + '_tex.png'), X, T, null, 1000, triUV, tex);
      render(path.join(DBG, tkey + '_nose.png'), X, T, null, 700, triUV, tex, { c: [0, 0, plan.zN + 6], ext: 14 });
      render(path.join(DBG, tkey + '_mid.png'), X, T, null, 700, triUV, tex, { c: [0, 0, plan.zN + L * 0.45], ext: L * 0.5 });
    }
  }
  fs.writeFileSync(path.join(HERE, 'build_report_v04.json'), JSON.stringify(report, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });
