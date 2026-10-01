#!/usr/bin/env node
/* ==========================================================================
   飞行模拟器 —— 无头 Chrome 端到端测试 (beta 0.2)
   用法:
     npm i puppeteer-core            (只需一次; 本游戏本身不依赖任何 npm 包)
     CHROME=/path/to/chrome node tests/e2e.js [baseUrl]
   baseUrl 默认为 file:// 方式直接打开本目录下的 index.html
   (也可传 http://127.0.0.1:8000/index.html 之类的地址)
   检查内容:
     · 10 个飞行场景均可通过 URL 参数自动开始, 无页面错误 / 无 HTTP 错误
     · 11 种机型均可构建 3D 模型; 真实模型的贴图就绪; 机轮接地 (不悬空/不下陷)
     · 主菜单与「致谢 / 许可」面板可打开
   ========================================================================== */
'use strict';
var path = require('path');
var puppeteer;
try { puppeteer = require('puppeteer-core'); } catch (e) {
  console.error('需要 puppeteer-core:  npm i puppeteer-core'); process.exit(2);
}
var CHROME = process.env.CHROME || '/usr/bin/google-chrome';
var BASE = process.argv[2] || ('file://' + path.resolve(__dirname, '..', 'index.html'));
var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

var SCENARIOS = ['cold-dark', 'takeoff', 'cruise', 'ils-approach', 'crosswind', 'pattern', 'engine-failure', 'night', 'storm-takeoff', 'free-flight'];
var TYPES = ['A350-900', 'A350-1000', 'A320neo', 'A321neo', 'A330-300', 'B737-800', 'B737-MAX8', 'B777-300ER', 'B787-9', 'C919', 'E190'];

(async function () {
  var browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
  var results = [];
  async function job(name, query, check) {
    var page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
    var errs = [];
    page.on('pageerror', function (e) { errs.push('pageerror: ' + e.message); });
    page.on('console', function (m) { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
    page.on('response', function (r) { if (r.status() >= 400) errs.push('HTTP ' + r.status() + ' ' + r.url()); });
    page.on('requestfailed', function (r) { errs.push('requestfailed: ' + r.url()); });
    await page.evaluateOnNewDocument(function () { window.__FS_TEST__ = true; });
    var t0 = Date.now(), msg = '', ok = true;
    try {
      await page.goto(BASE + (query ? '?' + query : ''), { waitUntil: 'load', timeout: 60000 });
      msg = await check(page);
      var fsErr = await page.evaluate(function () { return (window.__FS_ERRORS__ || []).slice(0, 5); });
      if (fsErr.length) errs = errs.concat(fsErr.map(String));
      if (errs.length) { ok = false; msg += ' | ' + errs.join(' ; '); }
    } catch (e) { ok = false; msg = e.message + (errs.length ? ' | ' + errs.join(' ; ') : ''); }
    await page.close();
    results.push({ name: name, ok: ok, msg: msg });
    console.log((ok ? '  ✔ ' : '  ✘ ') + name + '  — ' + msg + '  (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
  }
  async function started(page) {
    await page.waitForFunction('window.FS && FS.sim && FS.sim.running && FS.sim.fm && FS.sim.aircraftModel', { timeout: 90000 });
    await sleep(3000);
  }

  console.log('\n无头 Chrome E2E —— ' + BASE + '\n\n[1] 主菜单 / 致谢面板');
  await job('主菜单 + 致谢面板', '', async function (page) {
    await page.waitForSelector('#main-menu:not(.hidden)', { timeout: 60000 });
    var n = await page.$$eval('.ac-card', function (c) { return c.length; });
    if (n !== 11) throw new Error('机型卡片数 ' + n);
    await page.click('#credits-btn'); await sleep(300);
    var txt = await page.$eval('#credits-list', function (e) { return e.textContent; });
    if (!/CC BY 4\.0/.test(txt) || !/amvlab/.test(txt)) throw new Error('致谢面板内容缺失');
    var real = await page.$$eval('.ac-model-real', function (c) { return c.length; });
    return n + ' 张机型卡片, ' + real + ' 个标注真实模型, 致谢面板正常';
  });

  console.log('\n[2] 10 个场景初始化');
  for (var i = 0; i < SCENARIOS.length; i++) {
    await job('场景 ' + SCENARIOS[i], 'aircraft=A350-900&scenario=' + SCENARIOS[i] + '&autostart=1', async function (page) {
      await started(page);
      return await page.evaluate(function () {
        var st = FS.sim.fm.getState();
        ['altFt', 'iasKt', 'pitchDeg', 'rollDeg'].forEach(function (k) { if (!isFinite(st[k])) throw new Error('NaN ' + k); });
        return 'alt ' + st.altFt.toFixed(0) + ' ft, IAS ' + st.iasKt.toFixed(0) + ' kt, ' + (st.onGround ? '地面' : '空中');
      });
    });
  }

  console.log('\n[3] 11 种机型模型 (起飞场景, ZGGG)');
  for (var j = 0; j < TYPES.length; j++) {
    await job('机型 ' + TYPES[j], 'aircraft=' + TYPES[j] + '&scenario=takeoff&dep=ZGGG&autostart=1', async function (page) {
      await started(page);
      return await page.evaluate(function () {
        var sim = FS.sim, m = sim.aircraftModel, g = m.group, T = THREE;
        g.updateMatrixWorld(true);
        var gh = sim.env.getGroundHeight(sim.fm.pos.x, sim.fm.pos.z);
        // 逐顶点计算: 机身/发动机最低点 与 机轮最低点 相对地面的高度
        function minVert(o) { var pa = o.geometry && o.geometry.attributes.position, v = new T.Vector3(), mn = 1e9;
          if (!pa) return mn; for (var i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld); if (v.y < mn) mn = v.y; } return mn; }
        var wheel = 1e9, body = 1e9;
        g.traverse(function (o) {
          if (!o.isMesh || !o.visible) return;
          var p = o, inGear = false; while (p && p !== g) { if (/bogie|gear|wheel/i.test(p.name || '')) inGear = true; p = p.parent; }
          var mv = minVert(o); if (inGear) wheel = Math.min(wheel, mv); else body = Math.min(body, mv);
        });
        var dz = wheel - gh, bz = body - gh;
        var up = new T.Vector3(0, 1, 0).applyQuaternion(g.getWorldQuaternion(new T.Quaternion()));
        var tex = 'n/a';
        if (m.asset) { var f = m.parts.fuselage; tex = f && f.material && f.material.map && f.material.map.userData.ready ? 'ready' : 'pending'; }
        if (m.asset && tex !== 'ready') throw new Error('贴图未就绪');
        if (dz < -0.5 || dz > 0.3) throw new Error('机轮底部相对地面 ' + dz.toFixed(2) + ' m (悬空或下陷)');
        if (bz < 0.1) throw new Error('机身/发动机最低点距地面仅 ' + bz.toFixed(2) + ' m');
        if (sim.fm.getState().onGround && Math.abs(sim.fm.getState().pitchDeg) < 3 && up.y < 0.99) throw new Error('模型姿态与机体轴不一致 up=' + up.y.toFixed(3));
        return m.source + ', 机轮 ' + dz.toFixed(2) + ' m, 机身/发动机离地 ' + bz.toFixed(2) + ' m, 贴图 ' + tex + ', ' + sim.renderer.info.render.calls + ' draw calls';
      });
    });
  }

  var pass = results.filter(function (r) { return r.ok; }).length;
  console.log('\n结果: ' + pass + ' / ' + results.length + ' 通过');
  await browser.close();
  process.exitCode = pass === results.length ? 0 : 1;
})();
