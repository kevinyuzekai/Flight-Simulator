#!/usr/bin/env node
/* ==========================================================================
   天际航线 SkyRoute —— 无头 Chrome 端到端测试 (beta 0.2)
   用法:
     npm i puppeteer-core            (只需一次; 本游戏本身不依赖任何 npm 包)
     CHROME=/path/to/chrome node tests/e2e.js [baseUrl]
   baseUrl 默认为 file:// 方式直接打开本目录下的 index.html
   (也可传 http://127.0.0.1:8000/index.html 之类的地址)
   检查内容:
     · 10 个飞行场景均可通过 URL 参数自动开始, 无页面错误 / 无 HTTP 错误
     · 11 种机型均可构建 3D 模型; 真实模型的贴图就绪; 机轮接地 (不悬空/不下陷)
     · 主菜单与「致谢 / 许可」面板可打开
   beta 0.3 新增:
     · 场景/机型测试固定使用内置地形 (online=0), 结果可复现
     · A321neo 起飞 (静止时机身水平, 不坐尾; 能正常抬轮离地)
     · 联网地景回退: 拦截全部瓦片请求 -> 自动回退到内置地形, 无页面错误
     · online=0 时不发出任何瓦片请求
     · 真实瓦片联网测试 (设置环境变量 ONLINE=0 可跳过)
     · 视角按钮 / C 键切换视角, ? 键打开帮助
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
  var TILE_RE = /elevation-tiles-prod|tiles\.maps\.eox\.at|gibs\.earthdata\.nasa\.gov/;
  async function job(name, query, check, setup) {
    var page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
    var errs = [];
    page.__tileStats = { req: 0, failed: 0, http4xx: 0 };
    if (setup) await setup(page);
    page.on('pageerror', function (e) { errs.push('pageerror: ' + e.message); });
    page.on('console', function (m) {
      if (m.type() !== 'error') return;
      // 浏览器自身记录的瓦片网络失败 (非脚本错误) 不计入
      var loc = (m.location && m.location()) || {};
      if (/Failed to load resource/.test(m.text()) && (TILE_RE.test(loc.url || '') || page.__blockTiles)) return;
      errs.push('console.error: ' + m.text());
    });
    // 瓦片请求单独统计: 被取消 (不再需要的瓦片) 或海外无数据属正常现象, 不算页面错误
    page.on('request', function (r) { if (TILE_RE.test(r.url())) page.__tileStats.req++; });
    page.on('response', function (r) {
      if (TILE_RE.test(r.url())) { if (r.status() >= 400) page.__tileStats.http4xx++; return; }
      if (r.status() >= 400) errs.push('HTTP ' + r.status() + ' ' + r.url());
    });
    page.on('requestfailed', function (r) {
      if (TILE_RE.test(r.url())) { page.__tileStats.failed++; return; }
      errs.push('requestfailed: ' + r.url());
    });
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

  var ONLY = process.env.ONLY || '1234';   // 例: ONLY=4 只运行 beta 0.3 部分
  console.log('\n无头 Chrome E2E —— ' + BASE + '\n\n[1] 主菜单 / 致谢面板');
  if (ONLY.indexOf('1') >= 0) await job('主菜单 + 致谢面板', '', async function (page) {
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
  for (var i = 0; ONLY.indexOf('2') >= 0 && i < SCENARIOS.length; i++) {
    await job('场景 ' + SCENARIOS[i], 'aircraft=A350-900&scenario=' + SCENARIOS[i] + '&autostart=1&online=0', async function (page) {
      await started(page);
      return await page.evaluate(function () {
        var st = FS.sim.fm.getState();
        ['altFt', 'iasKt', 'pitchDeg', 'rollDeg'].forEach(function (k) { if (!isFinite(st[k])) throw new Error('NaN ' + k); });
        return 'alt ' + st.altFt.toFixed(0) + ' ft, IAS ' + st.iasKt.toFixed(0) + ' kt, ' + (st.onGround ? '地面' : '空中');
      });
    });
  }

  console.log('\n[3] 11 种机型模型 (起飞场景, ZGGG)');
  for (var j = 0; ONLY.indexOf('3') >= 0 && j < TYPES.length; j++) {
    await job('机型 ' + TYPES[j], 'aircraft=' + TYPES[j] + '&scenario=takeoff&dep=ZGGG&autostart=1&online=0', async function (page) {
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


  /* ---------------- beta 0.3 ---------------- */
  console.log('\n[4] beta 0.3: A321neo 起飞 / 视角与帮助 / 联网地景');
  if (ONLY.indexOf('4') >= 0) {
  await job('A321neo 起飞 (ZGGG, 内置地形)', 'aircraft=A321neo&scenario=takeoff&dep=ZGGG&autostart=1&online=0', async function (page) {
    await started(page);
    return await page.evaluate(function () {
      var sim = FS.sim, fm = sim.fm, st0 = fm.getState();
      if (Math.abs(st0.pitchDeg) > 1.5) throw new Error('静止俯仰角 ' + st0.pitchDeg.toFixed(2) + '° (坐尾?)');
      sim.paused = true;
      fm.setParkingBrake(false); fm.setThrottle('all', 1);
      var vr = (fm.ac.perf && (fm.ac.perf.vr || fm.ac.perf.vrKt)) || 145, maxGroundPitch = 0, t = 0, air = false, st;
      var h0 = st0.heading;   // 度
      for (var i = 0; i < 120 * 90; i++) {
        st = fm.getState();
        var pin = st.iasKt > vr ? 0.55 : 0;
        if (st.pitchDeg > 12) pin = 0;
        var dh = ((h0 - st.heading + 540) % 360) - 180;          // 方向舵保持跑道航向
        fm.setPilotInput(pin, 0, Math.max(-1, Math.min(1, dh * 0.25))); fm.update(1 / 120); t += 1 / 120;
        if (st.onGround) maxGroundPitch = Math.max(maxGroundPitch, st.pitchDeg);
        if (!st.onGround && st.altFt - st0.altFt > 200) { air = true; break; }
      }
      fm.setPilotInput(0, 0, 0); sim.paused = false;
      if (!air) throw new Error('90 s 内未离地 (IAS ' + st.iasKt.toFixed(0) + ' kt, pitch ' + st.pitchDeg.toFixed(1) + '°)');
      if (maxGroundPitch > 11.5) throw new Error('地面最大俯仰 ' + maxGroundPitch.toFixed(1) + '° (擦尾风险)');
      return '静止俯仰 ' + st0.pitchDeg.toFixed(2) + '°, ' + t.toFixed(0) + ' s 后离地并爬升 200 ft, 地面最大俯仰 ' + maxGroundPitch.toFixed(1) + '°';
    });
  });

  await job('视角按钮 / C 键 / ? 帮助', 'aircraft=A320neo&scenario=takeoff&autostart=1&online=0', async function (page) {
    await started(page);
    var m0 = await page.evaluate(function () { return FS.sim.cameraRig.mode; });
    await page.click('#view-btn'); await sleep(300);
    var m1 = await page.evaluate(function () { return FS.sim.cameraRig.mode; });
    if (m1 === m0) throw new Error('视角按钮无效');
    var label = await page.$eval('#view-name', function (e) { return e.textContent; });
    await page.keyboard.press('KeyC'); await sleep(300);
    var m2 = await page.evaluate(function () { return FS.sim.cameraRig.mode; });
    if (m2 === m1) throw new Error('C 键无效');
    var opts = await page.$$eval('#view-select option', function (o) { return o.length; });
    await page.select('#view-select', 'cockpit'); await sleep(200);
    var m3 = await page.evaluate(function () { return FS.sim.cameraRig.mode; });
    if (m3 !== 'cockpit') throw new Error('下拉选择视角无效');
    await page.keyboard.down('Shift'); await page.keyboard.press('Slash'); await page.keyboard.up('Shift'); await sleep(300);
    var help = await page.$eval('#help-overlay', function (e) { return !e.classList.contains('hidden'); });
    if (!help) throw new Error('? 键未打开帮助');
    return m0 + ' → (按钮) ' + m1 + ' [' + label + '] → (C) ' + m2 + ' → (下拉) cockpit; 下拉 ' + opts + ' 项; ? 打开帮助';
  });

  await job('online=0: 不请求任何瓦片', 'aircraft=A320neo&scenario=takeoff&autostart=1&online=0', async function (page) {
    await started(page); await sleep(4000);
    var r = await page.evaluate(function () { return { s: !!FS.sim.scenery, b: FS.sim.env.isBuiltinTerrainVisible() }; });
    if (page.__tileStats.req) throw new Error('仍发出 ' + page.__tileStats.req + ' 个瓦片请求');
    if (!r.b) throw new Error('内置地形未显示');
    return '0 个瓦片请求, 内置地形显示, scenery 对象 ' + (r.s ? '存在(禁用)' : '未创建');
  });

  await job('联网地景回退 (拦截全部瓦片请求)', 'aircraft=A320neo&scenario=takeoff&dep=VHHH&autostart=1&online=1', async function (page) {
    await started(page);
    await page.waitForFunction('FS.sim.scenery && FS.sim.scenery.status().failed', { timeout: 60000 });
    var r = await page.evaluate(function () {
      var st = FS.sim.scenery.status(), fm = FS.sim.fm, h = FS.sim.env.getGroundHeight(fm.pos.x, fm.pos.z);
      return { st: st, b: FS.sim.env.isBuiltinTerrainVisible(), h: h, attrib: (document.getElementById('scenery-attrib') || {}).style };
    });
    if (!r.b) throw new Error('回退后内置地形未显示');
    if (!isFinite(r.h)) throw new Error('地面高度 NaN');
    return 'status failed (请求 ' + r.st.requests + ', 错误 ' + r.st.errors + '), 内置地形显示, 地面高度 ' + r.h.toFixed(1) + ' m, 无页面错误';
  }, async function (page) {
    page.__blockTiles = true;
    await page.setRequestInterception(true);
    page.on('request', function (r) { if (TILE_RE.test(r.url())) r.abort('internetdisconnected'); else r.continue(); });
  });

  if (process.env.ONLINE !== '0') {
    await job('联网地景 真实瓦片 (VHHH 进近)', 'aircraft=A320neo&scenario=ils-approach&dep=VHHH&autostart=1&online=1', async function (page) {
      await started(page);
      await page.waitForFunction('FS.sim.scenery && (FS.sim.scenery.status().ready || FS.sim.scenery.status().failed)', { timeout: 120000 });
      var r = await page.evaluate(function () {
        var sim = FS.sim, st = sim.scenery.status(), fm = sim.fm;
        var a = document.getElementById('scenery-attrib');
        return { st: st, b: sim.env.isBuiltinTerrainVisible(), h: sim.env.getGroundHeight(fm.pos.x, fm.pos.z),
          attr: a ? a.textContent : '', attrShown: a ? a.style.display !== 'none' : false, fps: sim.fps || 0 };
      });
      if (r.st.failed) throw new Error('联网地景失败: ' + r.st.lastErr);
      if (r.b) throw new Error('就绪后内置地形仍显示');
      if (!r.attrShown || !/EOX/.test(r.attr) || !/Terrain Tiles/.test(r.attr)) throw new Error('署名缺失');
      if (!isFinite(r.h)) throw new Error('地面高度 NaN');
      return 'ready; 瓦片 ' + r.st.tiles + ', 请求 ' + r.st.requests + ' (成功 ' + r.st.ok + ', 错误 ' + r.st.errors + '), 地面高度 ' + r.h.toFixed(0) +
        ' m, 署名显示; 浏览器层面: 瓦片请求 ' + page.__tileStats.req + ', 取消 ' + page.__tileStats.failed + ', 4xx ' + page.__tileStats.http4xx;
    });
  }
  }

  var pass = results.filter(function (r) { return r.ok; }).length;
  console.log('\n结果: ' + pass + ' / ' + results.length + ' 通过');
  await browser.close();
  process.exitCode = pass === results.length ? 0 : 1;
})();
