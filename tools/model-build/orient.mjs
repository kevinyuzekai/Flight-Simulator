// 合并图元 + 自动判定朝向 -> 游戏坐标 (+X 右翼, +Y 上, 机头 -Z)
import { loadGLB } from './glbload.mjs';
export async function loadOriented(file) {
  const prims = await loadGLB(file);
  let nv = 0, ni = 0; for (const p of prims) { nv += p.pos.length / 3; ni += p.idx.length; }
  const S = new Float32Array(nv * 3), I = new Uint32Array(ni), tm = new Uint16Array(ni / 3);
  let ov = 0, oi = 0;
  prims.forEach((p, k) => { S.set(p.pos, ov * 3); for (let i = 0; i < p.idx.length; i++) I[oi + i] = p.idx[i] + ov; tm.fill(k, oi / 3, (oi + p.idx.length) / 3); ov += p.pos.length / 3; oi += p.idx.length; });
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let i = 0; i < nv; i++) for (let a = 0; a < 3; a++) { const v = S[i * 3 + a]; if (v < lo[a]) lo[a] = v; if (v > hi[a]) hi[a] = v; }
  const ext = [0, 1, 2].map(a => hi[a] - lo[a]);
  const ord = [0, 1, 2].sort((a, b) => ext[b] - ext[a]);
  const aL = ord[0], aS = ord[1], aV = ord[2];
  const c = [0, 1, 2].map(a => (lo[a] + hi[a]) / 2);
  // 竖直方向: 中线附近点, 垂尾一侧离机身中心更远
  const vs = [];
  for (let i = 0; i < nv; i++) if (Math.abs(S[i * 3 + aS] - c[aS]) < ext[aS] * 0.02) vs.push(S[i * 3 + aV]);
  vs.sort((a, b) => a - b);
  const med = vs[vs.length >> 1];
  const upS = (vs[vs.length - 1] - med) > (med - vs[0]) ? 1 : -1;
  const vTop = upS > 0 ? vs[vs.length - 1] : vs[0];
  let sl = 0, n = 0;
  for (let i = 0; i < nv; i++) if (Math.abs(S[i * 3 + aS] - c[aS]) < ext[aS] * 0.02 && Math.abs(S[i * 3 + aV] - vTop) < ext[aV] * 0.12) { sl += S[i * 3 + aL] - c[aL]; n++; }
  const tailS = sl / Math.max(1, n) > 0 ? 1 : -1;
  const u = [0, 0, 0]; u[aV] = upS;
  const f = [0, 0, 0]; f[aL] = -tailS;
  const r = [f[1] * u[2] - f[2] * u[1], f[2] * u[0] - f[0] * u[2], f[0] * u[1] - f[1] * u[0]];
  const bz = f.map(v => -v);
  const P = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) {
    const x = S[i * 3] - c[0], y = S[i * 3 + 1] - c[1], z = S[i * 3 + 2] - c[2];
    P[i * 3] = x * r[0] + y * r[1] + z * r[2];
    P[i * 3 + 1] = x * u[0] + y * u[1] + z * u[2];
    P[i * 3 + 2] = x * bz[0] + y * bz[1] + z * bz[2];
  }
  return { prims, P, I, tm, info: { aL, aS, aV, upS, tailS, ext } };
}
