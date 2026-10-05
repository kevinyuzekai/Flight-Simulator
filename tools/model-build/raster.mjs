// 简易 Z 缓冲正交渲染 (调试用): views = side(+X 看), top, front
import { PNG } from 'pngjs';
import fs from 'fs';
export function render(file, P, I, triColor, W = 900, uvFn = null, tex = null, zoom = null) {
  // P: Float32Array xyz (游戏坐标), I: indices, triColor: (t)=>[r,g,b]
  let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let i = 0; i < P.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], P[i + a]); hi[a] = Math.max(hi[a], P[i + a]); }
  let ext = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 1.04;
  if (zoom) { ext = zoom.ext; lo = zoom.c.map(v => v); hi = zoom.c.map(v => v); }
  const views = [ // [u axis, v axis(up), depth axis, sign]
    { u: 2, v: 1, d: 0, su: 1, sd: 1 },   // 右侧看: u=z
    { u: 2, v: 0, d: 1, su: 1, sd: 1 },   // 顶视
    { u: 0, v: 1, d: 2, su: 1, sd: -1 },  // 正前看 (从 -z)
    { u: 2, v: 1, d: 0, su: 1, sd: -1 }]; // 左侧看
  const H = W, png = new PNG({ width: W * 2, height: H * 2 });
  png.data.fill(40);
  const L = [0.3, 0.8, -0.5]; const ln = Math.hypot(...L); L[0] /= ln; L[1] /= ln; L[2] /= ln;
  views.forEach((vw, k) => {
    const ox = (k % 2) * W, oy = Math.floor(k / 2) * H;
    const zb = new Float32Array(W * H).fill(-1e9);
    const sc = W / ext, cu = (lo[vw.u] + hi[vw.u]) / 2, cv = (lo[vw.v] + hi[vw.v]) / 2;
    for (let t = 0; t < I.length / 3; t++) {
      const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
      const e1 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
      let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const nl = Math.hypot(...n) || 1; n = n.map(x => x / nl);
      const sh = 0.35 + 0.65 * Math.abs(n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
      const col = uvFn ? null : triColor(t);
      const uvs = uvFn ? [0, 1, 2].map(k => uvFn(t, k)) : null;
      const pts = [a, b, c].map(i => [W / 2 + (P[i + vw.u] - cu) * sc * vw.su * (vw.sd < 0 && vw.d === 0 ? -1 : 1), H / 2 - (P[i + vw.v] - cv) * sc, P[i + vw.d] * vw.sd]);
      const x0 = Math.max(0, Math.floor(Math.min(pts[0][0], pts[1][0], pts[2][0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(pts[0][0], pts[1][0], pts[2][0])));
      const y0 = Math.max(0, Math.floor(Math.min(pts[0][1], pts[1][1], pts[2][1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(pts[0][1], pts[1][1], pts[2][1])));
      const den = (pts[1][1] - pts[2][1]) * (pts[0][0] - pts[2][0]) + (pts[2][0] - pts[1][0]) * (pts[0][1] - pts[2][1]);
      if (Math.abs(den) < 1e-9) continue;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const w0 = ((pts[1][1] - pts[2][1]) * (x - pts[2][0]) + (pts[2][0] - pts[1][0]) * (y - pts[2][1])) / den;
        const w1 = ((pts[2][1] - pts[0][1]) * (x - pts[2][0]) + (pts[0][0] - pts[2][0]) * (y - pts[2][1])) / den;
        const w2 = 1 - w0 - w1; if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * pts[0][2] + w1 * pts[1][2] + w2 * pts[2][2];
        if (z <= zb[y * W + x]) continue; zb[y * W + x] = z;
        const o = ((oy + y) * W * 2 + ox + x) * 4;
        let cc = col;
        if (uvs) { const uu = w0 * uvs[0][0] + w1 * uvs[1][0] + w2 * uvs[2][0], vv = w0 * uvs[0][1] + w1 * uvs[1][1] + w2 * uvs[2][1];
          const tx = Math.min(tex.W - 1, Math.max(0, Math.floor(uu * tex.W))), ty = Math.min(tex.H - 1, Math.max(0, Math.floor(vv * tex.H))), q = (ty * tex.W + tx) * 3;
          cc = [tex.raw[q], tex.raw[q + 1], tex.raw[q + 2]]; }
        png.data[o] = cc[0] * sh; png.data[o + 1] = cc[1] * sh; png.data[o + 2] = cc[2] * sh; png.data[o + 3] = 255;
      }
    }
  });
  for (let i = 3; i < png.data.length; i += 4) png.data[i] = 255;
  fs.writeFileSync(file, PNG.sync.write(png));
}
