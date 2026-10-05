import { loadOriented } from './orient.mjs';
import { render } from './raster.mjs';
const [file, out, re] = process.argv.slice(2);
const d = await loadOriented(file);
console.log(d.info);
const rx = new RegExp(re || '^$', 'i');
const hl = d.prims.map(p => rx.test(p.mat + ' ' + p.mesh + ' ' + p.node));
render(out, d.P, d.I, t => hl[d.tm[t]] ? [240, 60, 60] : [200, 200, 205], 700);
