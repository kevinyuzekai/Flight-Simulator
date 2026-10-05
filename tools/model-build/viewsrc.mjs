import { loadGLB } from './glbload.mjs';
import { render } from './raster.mjs';
const prims = await loadGLB(process.argv[2]);
let nv = 0, ni = 0; for (const p of prims) { nv += p.pos.length; ni += p.idx.length; }
const P = new Float32Array(nv), I = new Uint32Array(ni), tm = new Uint16Array(ni / 3);
let ov = 0, oi = 0; prims.forEach((p, k) => { P.set(p.pos, ov); for (let i = 0; i < p.idx.length; i++) I[oi + i] = p.idx[i] + ov / 3; tm.fill(k, oi / 3, (oi + p.idx.length) / 3); ov += p.pos.length; oi += p.idx.length; });
const pal = prims.map((p, k) => [[230,80,80],[80,200,80],[90,120,240],[230,200,60],[200,90,220],[70,210,210],[240,140,40],[160,160,160]][k % 8]);
prims.forEach((p, k) => console.log(k, p.mat, pal[k]));
render(process.argv[3], P, I, t => pal[tm[t]], 700);
