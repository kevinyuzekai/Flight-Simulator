import { loadGLB } from './glbload.mjs';
const f = process.argv[2];
const prims = await loadGLB(f);
const mats = {}; let lo=[1e9,1e9,1e9], hi=[-1e9,-1e9,-1e9], tris=0;
for (const p of prims) { const k = p.mat; const m = mats[k] || (mats[k] = { tris: 0, color: p.color.map(v=>+v.toFixed(2)), tex: p.hasTex, lo:[1e9,1e9,1e9], hi:[-1e9,-1e9,-1e9], meshes: new Set() });
  m.tris += p.idx.length / 3; tris += p.idx.length/3; m.meshes.add(p.mesh||p.node);
  for (let i = 0; i < p.pos.length; i += 3) for (let a = 0; a < 3; a++) { const v=p.pos[i+a]; if (v<lo[a]) lo[a]=v; if (v>hi[a]) hi[a]=v; if (v<m.lo[a]) m.lo[a]=v; if (v>m.hi[a]) m.hi[a]=v; } }
console.log(f, 'prims', prims.length, 'tris', tris, 'bbox', lo.map(v=>v.toFixed(2)), hi.map(v=>v.toFixed(2)));
for (const [k, m] of Object.entries(mats)) console.log(' ', JSON.stringify(k), m.tris, JSON.stringify(m.color), m.tex?'TEX':'', m.lo.map(v=>v.toFixed(1)).join(','), '|', m.hi.map(v=>v.toFixed(1)).join(','), [...m.meshes].slice(0,4).join(';'));
