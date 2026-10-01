#!/usr/bin/env node
/* ==========================================================================
   天际航线 SkyRoute —— 物理 / 自动驾驶 / 模型资源 自动化测试 (beta 0.2 重新编写)
   用法:  node tests/run-tests.js            (需要 Node.js ≥ 14, 无第三方依赖)
   说明:  v0.1 的发布包中没有附带任何测试文件, 本文件为 beta 0.2 重新编写。
          直接在 Node 的 vm 沙箱中加载游戏原版 js 文件 (不做任何修改),
          以与游戏相同的 120 Hz 固定步长驱动飞行动力学。
          地面按机场标高取平地 (不加载程序化地形)。
   ========================================================================== */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '..');

function loadSim() {
  var ctx = { console: { log: function () {}, warn: function () {}, error: function () {}, info: function () {} },
    Math: Math, Date: Date, JSON: JSON, setTimeout: setTimeout, clearTimeout: clearTimeout };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  ['js/utils.js', 'js/config.js', 'js/airports.js', 'js/flightmodel.js', 'js/autopilot.js'].forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  });
  return ctx.FS;
}
function loadModels(FS) {
  // 模型资源文件 (models/*.js) —— 只做数据层检查, 不需要 THREE
  var ctx = { window: null, FS: FS }; ctx.window = ctx; vm.createContext(ctx);
  var files = fs.readdirSync(path.join(ROOT, 'models')).filter(function (f) { return /\.js$/.test(f); });
  files.forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(ROOT, 'models', f), 'utf8'), ctx, { filename: f }); });
  return files;
}

var results = [];
function test(name, fn) {
  var t0 = Date.now(), ok = false, msg = '';
  try { msg = fn() || ''; ok = true; } catch (e) { msg = e.message; }
  results.push({ name: name, ok: ok, msg: msg, ms: Date.now() - t0 });
  console.log((ok ? '  ✔ ' : '  ✘ ') + name + (msg ? '  — ' + msg : '') + '  (' + (Date.now() - t0) + ' ms)');
}
function assert(c, m) { if (!c) throw new Error(m); }
function finite(st) {
  ['altFt', 'iasKt', 'pitchDeg', 'rollDeg', 'vsFpm'].forEach(function (k) { assert(isFinite(st[k]), 'NaN/Inf in ' + k); });
}

var FS = loadSim();
var FT = FS.CONST.FT, HZ = FS.CFG.physicsHz, DT = 1 / HZ;
var TYPES = Object.keys(FS.AIRCRAFT_DB);

function makeFm(type, icao) {
  var a = FS.Airports.byIcao(icao);
  FS.Geo.setReference(a.lat, a.lon);
  var elev = a.elevFt * FT;
  var fm = new FS.FlightModel(type, { groundHeightFn: function () { return elev; }, seed: 20260101 });
  return { fm: fm, ap: new FS.Autopilot(fm), elevM: elev, apt: a };
}
function bestRwy(a) {
  return a.runways.slice().sort(function (x, y) { return (y.ils ? 1 : 0) - (x.ils ? 1 : 0) || y.lengthFt - x.lengthFt; })[0].ident;
}
function run(sim, seconds, each) {
  var n = Math.round(seconds * HZ);
  for (var i = 0; i < n; i++) {
    sim.fm.update(DT);
    if (i % 2 === 0) sim.ap.update(DT * 2);
    if (each && each(sim.fm.getState(), i * DT) === false) return i * DT;
  }
  return seconds;
}

console.log('\n天际航线 SkyRoute 自动化测试 (' + TYPES.length + ' 种机型, 物理 ' + HZ + ' Hz)\n');

/* ---------- 1. 静止在跑道上: 所有机型 ---------- */
console.log('[1] 地面静止 (20 s, 慢车, 停留刹车)');
TYPES.forEach(function (type) {
  test('地面静止 ' + type, function () {
    var s = makeFm(type, 'ZSPD'); s.fm.setupForTakeoff('ZSPD', bestRwy(s.apt), {});
    s.fm.setParkingBrake(true);
    var maxPitch = 0, minAgl = 1e9;
    run(s, 20, function (st) { finite(st); maxPitch = Math.max(maxPitch, Math.abs(st.pitchDeg)); if (!st.onGround) throw new Error('离开地面'); });
    var st = s.fm.getState();
    assert(maxPitch < 3, '静止俯仰角异常 ' + maxPitch.toFixed(1) + '°');
    assert(st.gsKt < 2, '静止时地速 ' + st.gsKt.toFixed(1) + ' kt');
    return 'pitch≤' + maxPitch.toFixed(2) + '°, alt ' + st.altFt.toFixed(1) + ' ft';
  });
});

/* ---------- 2. 起飞: 所有机型 ---------- */
console.log('\n[2] 起飞 (TOGA, VR 抬头, 爬升到 1500 ft AGL)');
TYPES.forEach(function (type) {
  test('起飞 ' + type, function () {
    var s = makeFm(type, 'ZSPD'); var rwy = bestRwy(s.apt);
    s.fm.setupForTakeoff('ZSPD', rwy, {});
    var vs = s.fm.getVSpeeds(); var lift = null, roll = 0, x0 = s.fm.pos.x, z0 = s.fm.pos.z, gearUp = false;
    s.fm.setThrottle('all', 1);
    var tEnd = run(s, 150, function (st, t) {
      finite(st);
      var pitchCmd = 0;
      if (st.iasKt > vs.Vr) pitchCmd = st.pitchDeg < 12 ? 0.55 : (st.pitchDeg > 16 ? -0.2 : 0.1);
      s.fm.setPilotInput(pitchCmd, -st.rollDeg * 0.04, 0);
      if (!st.onGround && lift === null) { lift = t; roll = Math.hypot(s.fm.pos.x - x0, s.fm.pos.z - z0); }
      if (lift !== null && st.aglFt > 100 && !gearUp) { s.fm.setGear(false); gearUp = true; }
      if (st.aglFt > 1500) return false;
    });
    var st = s.fm.getState();
    assert(lift !== null, '未离地 (IAS ' + st.iasKt.toFixed(0) + ' kt)');
    assert(st.aglFt > 1500, '150 s 内未爬升至 1500 ft AGL (AGL ' + st.aglFt.toFixed(0) + ')');
    var rwyLenM = FS.Airports.findRunway('ZSPD', rwy).lengthFt * FT;
    assert(roll < rwyLenM, '滑跑距离 ' + roll.toFixed(0) + ' m 超过跑道长度');
    return '滑跑 ' + roll.toFixed(0) + ' m, 离地 ' + lift.toFixed(1) + ' s, 1500 ft @ ' + tEnd.toFixed(0) + ' s';
  });
});

/* ---------- 3. ILS 自动着陆 ---------- */
console.log('\n[3] ILS 自动着陆 (12 nm 起, AP + A/THR + APPR)');
[['A350-900', 'ZSPD'], ['B737-800', 'ZBAA'], ['A320neo', 'ZGGG'], ['B777-300ER', 'ZSPD']].forEach(function (c) {
  test('自动着陆 ' + c[0] + ' @ ' + c[1], function () {
    var s = makeFm(c[0], c[1]); var rwy = bestRwy(s.apt);
    s.fm.setupForApproach(c[1], rwy, 12);
    var ap = s.ap;
    ap.ap.ilsIcao = c[1]; ap.ap.ilsRwy = rwy;
    ap.engage(1); ap.setRollMode('HDG'); ap.setPitchMode('ALT');
    ap.setTargetAlt(Math.round(s.fm.altFt / 100) * 100); ap.armAppr(true);
    ap.setThrustMode('SPEED'); ap.setTargetSpeed(s.fm.getVSpeeds().Vapp + 20);
    var tdVs = null, loc = false, gs = false, lastVs = 0, stopT = null;
    run(s, 600, function (st, t) {
      finite(st);
      if (ap.locCaptured) loc = true; if (ap.gsCaptured) gs = true;
      if (st.onGround && tdVs === null) tdVs = lastVs;
      lastVs = st.vsFpm;
      if (st.aglFt < 1000 && !st.onGround) ap.setTargetSpeed(s.fm.getVSpeeds().Vapp);
      if (tdVs !== null && st.gsKt < 30) { stopT = t; return false; }
    });
    var g = FS.Airports.ilsWorld(c[1], rwy);
    assert(loc && gs, 'LOC/GS 未截获 (loc=' + loc + ', gs=' + gs + ')');
    assert(tdVs !== null, '600 s 内未接地');
    assert(Math.abs(tdVs) < 600, '接地率过大 ' + tdVs.toFixed(0) + ' fpm');
    // 侧向偏差: 相对跑道中线
    var cr = g.course * Math.PI / 180, dx = s.fm.pos.x - g.threshold.x, dz = s.fm.pos.z - g.threshold.z;
    var lateral = Math.abs(dx * Math.cos(cr) + dz * Math.sin(cr));
    assert(lateral < 30, '偏离中线 ' + lateral.toFixed(1) + ' m');
    return '接地率 ' + tdVs.toFixed(0) + ' fpm, 中线偏差 ' + lateral.toFixed(1) + ' m' + (stopT ? ', 减速至 30 kt @ ' + stopT.toFixed(0) + ' s' : '');
  });
});

/* ---------- 4. 失速保护 (beta 0.3: 全部电传机型, 光洁 + 着陆构型) ---------- */
console.log('\n[4] 迎角保护 (所有带包线保护的电传机型, 慢车 + 满拉杆 60 s; 光洁 10000 ft / 着陆构型进近)');
TYPES.forEach(function (type) {
  var fbw = FS.AIRCRAFT_DB[type].systems.flyByWire;
  if (!fbw || !fbw.envelopeProtection) return;
  ['clean', 'land'].forEach(function (cfg) {
    test('迎角保护 ' + type + ' ' + (cfg === 'clean' ? '光洁' : '着陆构型'), function () {
      var s = makeFm(type, 'ZSPD'); var a = s.apt;
      if (cfg === 'clean') s.fm.setupForCruise(a.lat, a.lon, 10000, 90, 0.5);
      else { s.fm.setupForApproach('ZSPD', '17L', 12); s.fm.ap.apprArmed = s.fm.ap.locArmed = s.fm.ap.gsArmed = false; }
      s.fm.setThrottle('all', 0);
      var maxA = -1e9, stallA = 1e9;
      run(s, 60, function (st) { finite(st); s.fm.setPilotInput(1, 0, 0); maxA = Math.max(maxA, st.alphaDeg); stallA = Math.min(stallA, st.stallAngleDeg); });
      assert(maxA < stallA, '迎角 ' + maxA.toFixed(1) + '° 超过失速迎角 ' + stallA.toFixed(1) + '°');
      return '最大迎角 ' + maxA.toFixed(1) + '° < 失速迎角 ' + stallA.toFixed(1) + '°';
    });
  });
});
test('地面模式: 电传机型静止时舵面不乱偏 (A330-300, 30 s)', function () {
  var s = makeFm('A330-300', 'ZGGG'); s.fm.setupForTakeoff('ZGGG', bestRwy(s.apt), {}); s.fm.setParkingBrake(true);
  run(s, 30, function (st) { finite(st); });
  var sf = s.fm.surfaces;
  assert(Math.abs(sf.elevator) < 0.05 && Math.abs(sf.rudder) < 0.05, '升降舵 ' + sf.elevator.toFixed(2) + ' 方向舵 ' + sf.rudder.toFixed(2));
  return '升降舵 ' + sf.elevator.toFixed(3) + ', 方向舵 ' + sf.rudder.toFixed(3);
});

/* ---------- 5. 模型资源 (beta 0.2) ---------- */
console.log('\n[5] 真实 3D 模型资源 (models/*.js)');
var files = loadModels(FS);
var A = FS.ModelAssets || {}, T = FS.ModelTextures || {};
test('模型文件可加载 (' + files.length + ' 个)', function () {
  assert(Object.keys(A).length > 0, '没有模型');
  return Object.keys(A).join(', ');
});
Object.keys(A).forEach(function (k) {
  test('模型数据 ' + k, function () {
    var m = A[k], db = FS.AIRCRAFT_DB[k];
    assert(db, '未知机型 key');
    assert(m.credit && m.credit.author && m.credit.license && m.credit.url && m.credit.licenseUrl, '缺少署名/许可信息');
    assert(/CC0|CC BY 4\.0|Public Domain/.test(m.credit.license), '许可证不在允许列表: ' + m.credit.license);
    assert(m.triangles > 500 && m.triangles < 50000, '三角面数异常 ' + m.triangles);
    var tex = T[m.texId];
    assert(tex && /^data:image\/jpeg;base64,/.test(tex.base) && /^data:image\/png;base64,/.test(tex.mask), '贴图缺失');
    var an = m.anchors;
    assert(Math.abs(an.length - db.dims.length) / db.dims.length < 0.03, '机身长度与机型不符: ' + an.length.toFixed(1) + ' vs ' + db.dims.length);
    assert(Math.abs(an.span - db.dims.wingspan) / db.dims.wingspan < 0.03, '翼展与机型不符: ' + an.span.toFixed(1) + ' vs ' + db.dims.wingspan);
    assert(!!m.derived === !!m.plug, '派生标记与机身插段不一致');
    return m.triangles + ' tris, 长 ' + an.length.toFixed(1) + ' m, 翼展 ' + an.span.toFixed(1) + ' m' + (m.derived ? ', 派生' : '');
  });
});
test('index.html 引用的脚本全部存在 (离线 / file://)', function () {
  var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  var srcs = [], re = /<script[^>]+src="([^"]+)"/g, mm;
  while ((mm = re.exec(html))) srcs.push(mm[1]);
  srcs.forEach(function (s) { assert(!/^https?:/.test(s), '外部脚本: ' + s); assert(fs.existsSync(path.join(ROOT, s)), '缺少文件: ' + s); });
  assert(!/https?:\/\/[^"']+\.(glb|gltf|jpg|png)/.test(html), '引用了外部资源');
  return srcs.length + ' 个脚本均为本地文件';
});

var pass = results.filter(function (r) { return r.ok; }).length;
console.log('\n结果: ' + pass + ' / ' + results.length + ' 通过' + (pass < results.length ? ' (' + (results.length - pass) + ' 项失败)' : ''));
if (process.argv.indexOf('--json') >= 0) fs.writeFileSync(path.join(__dirname, 'last-results.json'), JSON.stringify(results, null, 1));
process.exitCode = pass === results.length ? 0 : 1;
