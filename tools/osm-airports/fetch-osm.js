#!/usr/bin/env node
/* 天际航线 SkyRoute — 机场 OSM 原始数据下载 (构建期工具，运行时不联网)
   用法: node tools/osm-airports/fetch-osm.js [ICAO ...]
   · 读取 js/airports.js 中全部机场，以跑道端点外包框 + 1.6 km 边距 (OSM_MARGIN 可调) 为范围，
     通过 OpenStreetMap API 0.6 /map 顺序下载 (单线程, 每次请求间隔 ≥1.2 s)；
     节点过多 (HTTP 400/509) 时自动四分。
   · 原始 .osm 缓存于 CACHE 目录 (默认 ../../assets_src/osm-cache, 不入库)，已存在则跳过。
   数据 © OpenStreetMap contributors, ODbL 1.0 */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm'), https = require('https');
var ROOT = path.resolve(__dirname, '../..');
var CACHE = process.env.OSM_CACHE || path.resolve(ROOT, '../assets_src/osm-cache');
fs.mkdirSync(CACHE, { recursive: true });

function loadAirports() {
  var ctx = { console: console, Math: Math, Date: Date, JSON: JSON };
  ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  ['js/utils.js', 'js/config.js', 'js/airports.js'].forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  });
  return ctx.FS.AIRPORTS;
}
function bboxOf(ap) {
  var la = [ap.lat], lo = [ap.lon];
  ap.runways.forEach(function (r) { la.push(r.lat); lo.push(r.lon); });
  var M = +(process.env.OSM_MARGIN || 1600);   // 边距 (m); 限流严重时可调小
  var mLat = M / 111320, mLon = M / (111320 * Math.cos(ap.lat * Math.PI / 180));
  return [Math.min.apply(0, lo) - mLon, Math.min.apply(0, la) - mLat, Math.max.apply(0, lo) + mLon, Math.max.apply(0, la) + mLat];
}
function get(url) {
  return new Promise(function (res) {
    var req = https.get(url, { headers: { 'User-Agent': 'SkyRoute-airport-build/0.4 (+https://github.com/kevinyuzekai/Flight-Simulator)' }, timeout: 120000 }, function (r) {
      var chunks = []; r.on('data', function (c) { chunks.push(c); });
      r.on('end', function () { res({ status: r.statusCode, body: Buffer.concat(chunks) }); });
    });
    req.on('timeout', function () { req.destroy(); res({ status: 0, body: Buffer.alloc(0) }); });
    req.on('error', function () { res({ status: 0, body: Buffer.alloc(0) }); });
  });
}
var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
async function fetchBox(b, depth, out) {
  var url = 'https://api.openstreetmap.org/api/0.6/map?bbox=' + b.map(function (v) { return v.toFixed(5); }).join(',');
  var r = null;
  for (var attempt = 0; attempt < 8; attempt++) {
    await sleep(1500);
    r = await get(url);
    if (r.status === 200) { out.push(r.body); return; }
    if (r.status === 400 && depth < 5) break;            // 节点过多 -> 四分
    var wait = r.status === 509 || r.status === 429 ? 60000 : 5000 * (attempt + 1);   // 带宽限流 -> 等待
    console.warn('  retry', r.status, 'wait', wait / 1000 + 's', url); await sleep(wait);
  }
  if (!r || r.status !== 400) throw new Error('HTTP ' + (r && r.status) + ' ' + url);
  if (depth >= 5) throw new Error('too deep ' + url);
  var mx = (b[0] + b[2]) / 2, my = (b[1] + b[3]) / 2;
  var q = [[b[0], b[1], mx, my], [mx, b[1], b[2], my], [b[0], my, mx, b[3]], [mx, my, b[2], b[3]]];
  for (var i = 0; i < 4; i++) await fetchBox(q[i], depth + 1, out);
}
(async function main() {
  var aps = loadAirports(), only = process.argv.slice(2);
  for (var i = 0; i < aps.length; i++) {
    var ap = aps[i];
    if (only.length && only.indexOf(ap.icao) < 0) continue;
    var dir = path.join(CACHE, ap.icao);
    if (fs.existsSync(path.join(dir, 'done'))) continue;
    fs.mkdirSync(dir, { recursive: true });
    var parts = [], t0 = Date.now();
    try { await fetchBox(bboxOf(ap), 0, parts); } catch (e) { console.error(ap.icao, 'FAILED', e.message); continue; }
    parts.forEach(function (p, k) { fs.writeFileSync(path.join(dir, 'part' + k + '.osm'), p); });
    fs.writeFileSync(path.join(dir, 'done'), JSON.stringify({ bbox: bboxOf(ap), parts: parts.length, at: new Date().toISOString() }));
    console.log((i + 1) + '/' + aps.length, ap.icao, parts.length + ' part(s)', (parts.reduce(function (s, p) { return s + p.length; }, 0) / 1e6).toFixed(1) + ' MB', ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  }
})();
