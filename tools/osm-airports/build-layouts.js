#!/usr/bin/env node
/* 天际航线 SkyRoute — 由 OSM 原始数据生成立体机场布局 js/airport-osm-data.js (构建期工具)
   用法: node tools/osm-airports/build-layouts.js
   输入: fetch-osm.js 下载的缓存 (默认 ../../assets_src/osm-cache/<ICAO>/part*.osm)
   输出: js/airport-osm-data.js —— FS.AIRPORT_OSM[ICAO] = {
            b: [[kind, heightM, ring, holes?], ...]   建筑 (0 航站楼 1 机库 2 其它场内建筑 3 停车楼)
            a: [[ring, holes?], ...]                  停机坪多边形
            t: [[widthM, line], ...]                  滑行道中线
            j: [line, ...]                            廊桥
            c: [[dLat, dLon, heightM], ...]           塔台
            p: [[dLat, dLon, hdg], ...]               机位 (停机位置, 最多 80 个)
          }
          ring/line = 扁平整数数组 [dLat, dLon, ...] (相对机场基准点, 单位 1e-6 度), 已按 1.2 m 容差简化。
   数据 © OpenStreetMap contributors, 以 ODbL 1.0 授权 (见 ASSETS_LICENSES.md)。 */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var CACHE = process.env.OSM_CACHE || path.resolve(ROOT, '../assets_src/osm-cache');
var OUT = path.join(ROOT, 'js/airport-osm-data.js');

function loadAirports() {
  var ctx = { console: { log: function () {}, warn: function () {}, error: function () {}, info: function () {} }, Math: Math, Date: Date, JSON: JSON };
  ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  ['js/utils.js', 'js/config.js', 'js/airports.js'].forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  });
  return ctx.FS.AIRPORTS;
}
function unesc(v) { return v.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); }
function parseTags(body) {
  var t = {}, re = /<tag k="([^"]*)" v="([^"]*)"\/>/g, m;
  while ((m = re.exec(body))) t[unesc(m[1])] = unesc(m[2]);
  return t;
}
function parseOsm(files) {
  var nodes = {}, ways = {}, rels = {};
  files.forEach(function (f) {
    var x = fs.readFileSync(f, 'utf8'), m;
    var reN = /<node id="(\d+)"[^>]*?lat="([-\d.]+)" lon="([-\d.]+)"(\/>|>([\s\S]*?)<\/node>)/g;
    while ((m = reN.exec(x))) { if (!nodes[m[1]]) nodes[m[1]] = { lat: +m[2], lon: +m[3], tags: m[5] ? parseTags(m[5]) : null }; }
    var reW = /<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g;
    while ((m = reW.exec(x))) {
      if (ways[m[1]]) continue;
      var nds = [], rn = /<nd ref="(\d+)"\/>/g, k;
      while ((k = rn.exec(m[2]))) nds.push(k[1]);
      ways[m[1]] = { nds: nds, tags: parseTags(m[2]) };
    }
    var reR = /<relation id="(\d+)"[^>]*>([\s\S]*?)<\/relation>/g;
    while ((m = reR.exec(x))) {
      if (rels[m[1]]) continue;
      var mem = [], rm = /<member type="(\w+)" ref="(\d+)" role="([^"]*)"\/>/g, q;
      while ((q = rm.exec(m[2]))) mem.push({ type: q[1], ref: q[2], role: q[3] });
      rels[m[1]] = { members: mem, tags: parseTags(m[2]) };
    }
  });
  return { nodes: nodes, ways: ways, rels: rels };
}

/* ---- 几何 ---- */
function mkProj(ap) {
  var kx = 111320 * Math.cos(ap.lat * Math.PI / 180), ky = 110540;
  return {
    xy: function (lat, lon) { return [(lon - ap.lon) * kx, (lat - ap.lat) * ky]; },
    enc: function (lat, lon) { return [Math.round((lat - ap.lat) * 1e6), Math.round((lon - ap.lon) * 1e6)]; }
  };
}
function dp(pts, tol) {          // Douglas-Peucker on [{x,y,lat,lon}]
  if (pts.length < 3) return pts;
  var keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  var stack = [[0, pts.length - 1]];
  while (stack.length) {
    var s = stack.pop(), a = pts[s[0]], b = pts[s[1]], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy, best = -1, bi = -1;
    for (var i = s[0] + 1; i < s[1]; i++) {
      var p = pts[i], d;
      if (L2 < 1e-9) d = Math.hypot(p.x - a.x, p.y - a.y);
      else { var t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)); d = Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); }
      if (d > best) { best = d; bi = i; }
    }
    if (best > tol) { keep[bi] = 1; stack.push([s[0], bi], [bi, s[1]]); }
  }
  return pts.filter(function (_, i) { return keep[i]; });
}
function area(pts) { var s = 0; for (var i = 0, n = pts.length; i < n; i++) { var a = pts[i], b = pts[(i + 1) % n]; s += a.x * b.y - b.x * a.y; } return s / 2; }
function wayPts(osm, w, P) {
  var out = [];
  for (var i = 0; i < w.nds.length; i++) {
    var n = osm.nodes[w.nds[i]]; if (!n) return null;
    var xy = P.xy(n.lat, n.lon); out.push({ x: xy[0], y: xy[1], lat: n.lat, lon: n.lon });
  }
  return out;
}
function encode(pts, P) { var o = []; pts.forEach(function (p) { var e = P.enc(p.lat, p.lon); o.push(e[0], e[1]); }); return o; }
function ringFrom(pts, P, tol) {
  if (!pts || pts.length < 4) return null;
  if (pts[0].lat === pts[pts.length - 1].lat && pts[0].lon === pts[pts.length - 1].lon) pts = pts.slice(0, -1);
  // 闭合环的 DP: 从最远两点拆两半
  var half = Math.floor(pts.length / 2);
  var a = dp(pts.slice(0, half + 1), tol), b = dp(pts.slice(half).concat([pts[0]]), tol);
  var r = a.slice(0, -1).concat(b.slice(0, -1));
  if (r.length < 3 || Math.abs(area(r)) < 30) return null;
  return r;
}
/* 把多条开放 way 拼接为闭合环 (multipolygon) */
function assembleRings(osm, wayIds, P) {
  var segs = [];
  wayIds.forEach(function (id) { var w = osm.ways[id]; if (!w) return; var p = wayPts(osm, w, P); if (p && p.length >= 2) segs.push({ ids: w.nds.slice(), pts: p }); });
  var rings = [];
  while (segs.length) {
    var cur = segs.shift(), ids = cur.ids.slice(), pts = cur.pts.slice(), guard = 0;
    while (ids[0] !== ids[ids.length - 1] && guard++ < 500) {
      var found = false;
      for (var i = 0; i < segs.length; i++) {
        var s = segs[i], last = ids[ids.length - 1];
        if (s.ids[0] === last) { ids = ids.concat(s.ids.slice(1)); pts = pts.concat(s.pts.slice(1)); }
        else if (s.ids[s.ids.length - 1] === last) { ids = ids.concat(s.ids.slice(0, -1).reverse()); pts = pts.concat(s.pts.slice(0, -1).reverse()); }
        else continue;
        segs.splice(i, 1); found = true; break;
      }
      if (!found) break;
    }
    if (ids[0] === ids[ids.length - 1]) rings.push(pts);
  }
  return rings;
}
function pip(pt, ring) {
  var c = false;
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    var a = ring[i], b = ring[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
function centroid(r) { var x = 0, y = 0; r.forEach(function (p) { x += p.x; y += p.y; }); return { x: x / r.length, y: y / r.length }; }
function num(v) { if (!v) return NaN; var m = /^\s*([\d.]+)\s*(m|ft|')?/.exec(v); if (!m) return NaN; return m[2] === 'ft' || m[2] === "'" ? +m[1] * 0.3048 : +m[1]; }
function bldHeight(t, def) {
  var h = num(t.height); if (isFinite(h) && h > 2 && h < 200) return Math.round(h);
  var l = num(t['building:levels']); if (isFinite(l) && l > 0 && l < 40) return Math.round(l * 4.2 + 2);
  return def;
}

function buildOne(ap, osm) {
  var P = mkProj(ap), TOL = 1.2;
  var out = { b: [], a: [], t: [], j: [], c: [], p: [] };
  // 场界: aerodrome 多边形 (取包含 ARP 或面积最大的)
  var fence = [];
  Object.keys(osm.ways).forEach(function (id) {
    var w = osm.ways[id]; if (w.tags.aeroway !== 'aerodrome') return;
    if (w.nds[0] === w.nds[w.nds.length - 1]) { var p = wayPts(osm, w, P); if (p) fence.push(p); }
  });
  Object.keys(osm.rels).forEach(function (id) {
    var r = osm.rels[id]; if (r.tags.aeroway !== 'aerodrome') return;
    assembleRings(osm, r.members.filter(function (m) { return m.type === 'way' && m.role !== 'inner'; }).map(function (m) { return m.ref; }), P).forEach(function (rg) { fence.push(rg); });
  });
  // 跑道外包 + 1 km 作为后备范围
  var rx = [], ry = [];
  ap.runways.forEach(function (r) { var q = P.xy(r.lat, r.lon); rx.push(q[0]); ry.push(q[1]); });
  var box = [Math.min.apply(0, rx) - 1000, Math.min.apply(0, ry) - 1000, Math.max.apply(0, rx) + 1000, Math.max.apply(0, ry) + 1000];
  fence = fence.filter(function (f) { return Math.abs(area(f)) > 2e5; });
  function inField(pt) {
    if (fence.length) { for (var i = 0; i < fence.length; i++) if (pip(pt, fence[i])) return true; return false; }
    return pt.x > box[0] && pt.x < box[2] && pt.y > box[1] && pt.y < box[3];
  }
  function inBox(pt) { return pt.x > box[0] - 600 && pt.x < box[2] + 600 && pt.y > box[1] - 600 && pt.y < box[3] + 600; }

  function polyItems(test) {   // -> [{tags, outer:[pts], holes:[[pts]]}]
    var items = [];
    Object.keys(osm.ways).forEach(function (id) {
      var w = osm.ways[id]; if (!test(w.tags) || w.nds.length < 4 || w.nds[0] !== w.nds[w.nds.length - 1]) return;
      var p = wayPts(osm, w, P); if (p) items.push({ tags: w.tags, outer: p, holes: [] });
    });
    Object.keys(osm.rels).forEach(function (id) {
      var r = osm.rels[id]; if (r.tags.type !== 'multipolygon' || !test(r.tags)) return;
      var outer = assembleRings(osm, r.members.filter(function (m) { return m.type === 'way' && m.role !== 'inner'; }).map(function (m) { return m.ref; }), P);
      var inner = assembleRings(osm, r.members.filter(function (m) { return m.type === 'way' && m.role === 'inner'; }).map(function (m) { return m.ref; }), P);
      outer.forEach(function (o) { items.push({ tags: r.tags, outer: o, holes: inner.filter(function (h) { return pip(h[0], o); }) }); });
    });
    return items;
  }
  function emitPoly(it) {
    var o = ringFrom(it.outer, P, TOL); if (!o) return null;
    var hs = it.holes.map(function (h) { return ringFrom(h, P, TOL); }).filter(Boolean).map(function (h) { return encode(h, P); });
    return { ring: encode(o, P), holes: hs, area: Math.abs(area(o)), c: centroid(o) };
  }

  /* 建筑 */
  var blds = [];
  polyItems(function (t) { return !!t.building || t.aeroway === 'terminal' || t.aeroway === 'hangar' || t['building:part']; }).forEach(function (it) {
    var t = it.tags; if (t['building:part'] && !t.building) return;
    if (/^(house|apartments|residential|detached|terrace|roof|construction|ruins|bungalow|semidetached_house|static_caravan|hut|shed|garage|garages|church|temple|mosque)$/.test(t.building || '') && t.aeroway !== 'terminal') return;
    var e = emitPoly(it); if (!e || e.area < 150) return;
    var kind = 2;
    if (t.aeroway === 'terminal' || t.building === 'terminal' || t.building === 'transportation' && /terminal/i.test(t.name || '')) kind = 0;
    else if (t.aeroway === 'hangar' || t.building === 'hangar') kind = 1;
    else if (t.building === 'parking' || t.amenity === 'parking') kind = 3;
    if (kind === 2 && !inField(e.c)) return;
    if (kind !== 2 && !inBox(e.c)) return;
    var def = kind === 0 ? 24 : kind === 1 ? 20 : kind === 3 ? 14 : (e.area > 8000 ? 14 : 9);
    blds.push({ k: kind, h: bldHeight(t, def), e: e });
  });
  // 场内非航站楼建筑最多保留面积最大的 260 个
  var main = blds.filter(function (b) { return b.k !== 2; }), other = blds.filter(function (b) { return b.k === 2; });
  other.sort(function (a, b) { return b.e.area - a.e.area; }); other = other.slice(0, 260);
  main.concat(other).forEach(function (b) { out.b.push(b.e.holes.length ? [b.k, b.h, b.e.ring, b.e.holes] : [b.k, b.h, b.e.ring]); });

  /* 停机坪 */
  polyItems(function (t) { return t.aeroway === 'apron'; }).forEach(function (it) {
    var e = emitPoly(it); if (!e || e.area < 800 || !inBox(e.c)) return;
    out.a.push(e.holes.length ? [e.ring, e.holes] : [e.ring]);
  });

  /* 滑行道 / 廊桥 (开放线) */
  Object.keys(osm.ways).forEach(function (id) {
    var w = osm.ways[id], t = w.tags;
    var isTx = t.aeroway === 'taxiway' || t.aeroway === 'taxilane';
    if (!isTx && t.aeroway !== 'jet_bridge') return;
    if (t.area === 'yes') return;
    var p = wayPts(osm, w, P); if (!p || p.length < 2) return;
    if (!p.some(inBox)) return;
    var s = dp(p, isTx ? 1.5 : 0.8); if (s.length < 2) return;
    var L = 0; for (var i = 1; i < s.length; i++) L += Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y);
    if (L < 8) return;
    if (isTx) {
      var wd = num(t.width); if (!(wd > 6 && wd < 60)) wd = t.aeroway === 'taxilane' ? 14 : 23;
      out.t.push([Math.round(wd), encode(s, P)]);
    } else if (L < 90) out.j.push(encode(s, P));
  });

  /* 塔台 */
  function isTower(t) { return t && (t.aeroway === 'control_tower' || t.aeroway === 'tower' || (t.man_made === 'tower' && (t['tower:type'] === 'observation' || /control|atc|tower/i.test((t.service || '') + (t.name || '') + (t['tower:type'] || ''))) && t['tower:type'] !== 'communication')); }
  Object.keys(osm.nodes).forEach(function (id) {
    var n = osm.nodes[id]; if (!n.tags || !isTower(n.tags)) return;
    var xy = P.xy(n.lat, n.lon); if (!inBox({ x: xy[0], y: xy[1] })) return;
    var e = P.enc(n.lat, n.lon); out.c.push([e[0], e[1], bldHeight(n.tags, 0)]);
  });
  Object.keys(osm.ways).forEach(function (id) {
    var w = osm.ways[id]; if (!isTower(w.tags)) return;
    var p = wayPts(osm, w, P); if (!p) return; var c = centroid(p); if (!inBox(c)) return;
    var lat = 0, lon = 0; p.forEach(function (q) { lat += q.lat; lon += q.lon; });
    var e = P.enc(lat / p.length, lon / p.length); out.c.push([e[0], e[1], bldHeight(w.tags, 0)]);
  });
  // 去重 (节点与轮廓同指一座塔)
  out.c = out.c.filter(function (c, i) { for (var k = 0; k < i; k++) if (Math.abs(out.c[k][0] - c[0]) < 300 && Math.abs(out.c[k][1] - c[1]) < 300) return false; return true; }).slice(0, 3);

  /* 机位 */
  Object.keys(osm.nodes).forEach(function (id) {
    var n = osm.nodes[id]; if (!n.tags || n.tags.aeroway !== 'parking_position') return;
    var xy = P.xy(n.lat, n.lon); if (!inBox({ x: xy[0], y: xy[1] })) return;
    var e = P.enc(n.lat, n.lon); out.p.push([e[0], e[1]]);
  });
  out.p = out.p.slice(0, 80);
  ['c', 'p', 'j'].forEach(function (k) { if (!out[k].length) delete out[k]; });
  return out;
}

var aps = loadAirports(), result = {}, stats = [];
aps.forEach(function (ap) {
  var dir = path.join(CACHE, ap.icao);
  if (!fs.existsSync(path.join(dir, 'done'))) return;
  var files = fs.readdirSync(dir).filter(function (f) { return /\.osm$/.test(f); }).map(function (f) { return path.join(dir, f); });
  var osm = parseOsm(files);
  var r = buildOne(ap, osm);
  var nTerm = r.b.filter(function (b) { return b[0] === 0; }).length;
  if (r.b.length + r.a.length + r.t.length < 5) { stats.push(ap.icao + ': 数据不足, 跳过'); return; }
  result[ap.icao] = r;
  stats.push(ap.icao + ': 建筑 ' + r.b.length + ' (航站楼 ' + nTerm + ') 停机坪 ' + r.a.length + ' 滑行道 ' + r.t.length + ' 廊桥 ' + (r.j || []).length + ' 塔台 ' + (r.c || []).length);
});
var body = '/* 天际航线 SkyRoute — 立体机场 OSM 布局数据 (由 tools/osm-airports/build-layouts.js 生成, 请勿手改)\n' +
  '   数据 © OpenStreetMap contributors, 以 ODbL 1.0 授权 — https://www.openstreetmap.org/copyright\n' +
  '   本文件为 OSM 数据的衍生数据库, 同样以 ODbL 1.0 提供。机场数 ' + Object.keys(result).length + ', 生成于 ' + new Date().toISOString().slice(0, 10) + ' */\n' +
  '(function (g) { var FS = g.FS = g.FS || {}; FS.AIRPORT_OSM = ' + JSON.stringify(result) + '; })(typeof window !== "undefined" ? window : globalThis);\n';
fs.writeFileSync(OUT, body);
console.log(stats.join('\n'));
console.log('写出 ' + OUT + ' (' + (body.length / 1024).toFixed(0) + ' KB, ' + Object.keys(result).length + ' 座机场)');
