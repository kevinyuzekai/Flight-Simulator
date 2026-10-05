#!/usr/bin/env node
/* 天际航线 SkyRoute — 补全跨出下载范围的机场多边形关系 (构建期工具)
   /api/0.6/map 只返回范围内的关系成员；大型停机坪 / 航站楼多边形常有成员在范围外，无法拼成闭合环。
   本脚本对每个已下载机场，找出 aeroway=apron/terminal/hangar 或 building=terminal/hangar 且缺成员的
   multipolygon 关系，用 /api/0.6/relation/<id>/full 补下载为 rel<id>.osm (缓存, 不入库)。
   数据 © OpenStreetMap contributors, ODbL 1.0 */
'use strict';
var fs = require('fs'), path = require('path'), https = require('https');
var ROOT = path.resolve(__dirname, '../..');
var CACHE = process.env.OSM_CACHE || path.resolve(ROOT, '../assets_src/osm-cache');
function get(url) {
  return new Promise(function (res) {
    var req = https.get(url, { headers: { 'User-Agent': 'SkyRoute-airport-build/0.4 (+https://github.com/kevinyuzekai/Flight-Simulator)' }, timeout: 120000 }, function (r) {
      var c = []; r.on('data', function (d) { c.push(d); }); r.on('end', function () { res({ status: r.statusCode, body: Buffer.concat(c) }); });
    });
    req.on('timeout', function () { req.destroy(); res({ status: 0, body: Buffer.alloc(0) }); });
    req.on('error', function () { res({ status: 0, body: Buffer.alloc(0) }); });
  });
}
var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
(async function () {
  var only = process.argv.slice(2);
  var dirs = fs.readdirSync(CACHE).filter(function (d) { return fs.existsSync(path.join(CACHE, d, 'done')) && (!only.length || only.indexOf(d) >= 0); });
  for (var di = 0; di < dirs.length; di++) {
    var dir = path.join(CACHE, dirs[di]);
    if (fs.existsSync(path.join(dir, 'rels-done'))) continue;
    var files = fs.readdirSync(dir).filter(function (f) { return /\.osm$/.test(f); });
    var ways = new Set(), rels = {};
    files.forEach(function (f) {
      var x = fs.readFileSync(path.join(dir, f), 'utf8'), m;
      var reW = /<way id="(\d+)"/g; while ((m = reW.exec(x))) ways.add(m[1]);
      var reR = /<relation id="(\d+)"[^>]*>([\s\S]*?)<\/relation>/g;
      while ((m = reR.exec(x))) {
        var body = m[2];
        if (!/k="type" v="multipolygon"/.test(body)) continue;
        if (!/k="aeroway" v="(apron|terminal|hangar)"|k="building" v="(terminal|hangar|transportation)"/.test(body)) continue;
        var mem = [], rm = /<member type="way" ref="(\d+)"/g, q; while ((q = rm.exec(body))) mem.push(q[1]);
        rels[m[1]] = mem;
      }
    });
    var need = Object.keys(rels).filter(function (id) { return rels[id].some(function (w) { return !ways.has(w); }) && !fs.existsSync(path.join(dir, 'rel' + id + '.osm')); }).slice(0, 40);
    var got = 0;
    for (var i = 0; i < need.length; i++) {
      var url = 'https://api.openstreetmap.org/api/0.6/relation/' + need[i] + '/full', r = null;
      for (var a = 0; a < 6; a++) {
        await sleep(1200); r = await get(url);
        if (r.status === 200) break;
        if (r.status === 404 || r.status === 410) break;
        var wait = r.status === 509 || r.status === 429 ? 60000 : 5000; console.warn('  retry', r.status, url); await sleep(wait);
      }
      if (r && r.status === 200) { fs.writeFileSync(path.join(dir, 'rel' + need[i] + '.osm'), r.body); got++; }
    }
    fs.writeFileSync(path.join(dir, 'rels-done'), JSON.stringify({ candidates: Object.keys(rels).length, fetched: got }));
    console.log(dirs[di], 'multipolygon 关系', Object.keys(rels).length, '补全', got + '/' + need.length);
  }
})();
