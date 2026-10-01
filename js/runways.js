/* ==========================================================================
   runways.js —— 跑道道面 (beta 0.3)
   · 按 airports.js 中的真实跑道端坐标 / 真向 / 长宽 / 标高生成沥青道面
   · 标志 (Canvas 现画, 无外部素材): 入口斑马线、跑道号、接地区、瞄准点、
     中线虚线、边线
   · 同时给每条跑道加带状平整区, 保证跑道所在地形严格水平 (不在海里、不在坡上)
   ========================================================================== */
(function (global) {
  'use strict';
  var FS = global.FS = global.FS || {};

  var END_LEN = 420;          // 每端标志区长度 (m)
  var _texCache = {};

  function asphaltNoise(ctx, w, h, base, seed) {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    var r = seed || 1;
    function rnd() { r = (r * 16807) % 2147483647; return r / 2147483647; }
    var img = ctx.getImageData(0, 0, w, h), d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var n = (rnd() - 0.5) * 18;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }

  /** 中段: 横向覆盖全宽, 纵向 60 m 一个周期 (36 m 虚线 + 24 m 间隔) */
  function bodyTexture(THREE, widthM) {
    var key = 'body' + Math.round(widthM);
    if (_texCache[key]) return _texCache[key];
    var W = 256, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d');
    try { asphaltNoise(g, W, H, '#3b3e42', 7); } catch (e) { g.fillStyle = '#3b3e42'; g.fillRect(0, 0, W, H); }
    var pxm = W / widthM;
    g.fillStyle = '#e8e8e2';
    // 边线 0.9 m, 距边缘 1 m
    g.fillRect(1 * pxm, 0, 0.9 * pxm, H); g.fillRect(W - 1.9 * pxm, 0, 0.9 * pxm, H);
    // 中线 0.9 m 宽, 36/60 长
    g.fillRect(W / 2 - 0.45 * pxm, 0, Math.max(1, 0.9 * pxm), H * 36 / 60);
    // 轮胎痕
    g.fillStyle = 'rgba(20,20,20,0.10)';
    g.fillRect(W / 2 - 6 * pxm, 0, 4 * pxm, H); g.fillRect(W / 2 + 2 * pxm, 0, 4 * pxm, H);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
    t.flipY = false; t.anisotropy = 8;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    _texCache[key] = t;
    return t;
  }

  /** 一端的标志区: canvas x = 横向 (左->右, 以面向跑道内侧的飞行员为准), y = 自入口向内 */
  function endTexture(THREE, widthM, ident) {
    var key = 'end' + Math.round(widthM) + ident;
    if (_texCache[key]) return _texCache[key];
    var W = 256, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d');
    try { asphaltNoise(g, W, H, '#3b3e42', 11 + ident.length); } catch (e) { g.fillStyle = '#3b3e42'; g.fillRect(0, 0, W, H); }
    var px = W / widthM, py = H / END_LEN;
    function rect(x0, y0, w, h) { g.fillRect(x0 * px, y0 * py, w * px, h * py); }
    var cx = widthM / 2;
    g.fillStyle = '#ebebe6';
    // 边线
    rect(1, 0, 0.9, END_LEN); rect(widthM - 1.9, 0, 0.9, END_LEN);
    // 入口横线
    rect(1, 0.5, widthM - 2, 1.8);
    // 入口斑马线 (按宽度 8/12/16 条), 6 m 起, 长 30 m
    var n = widthM >= 58 ? 16 : (widthM >= 44 ? 12 : 8);
    var stripeW = 1.8, gapC = 3.6;
    var half = n / 2, startX = 3;
    var usable = cx - gapC / 2 - startX;
    var step = usable / half;
    for (var i = 0; i < half; i++) {
      rect(startX + i * step, 6, stripeW, 30);
      rect(widthM - startX - i * step - stripeW, 6, stripeW, 30);
    }
    // 跑道号 (数字 + L/R/C), 42–60 m, 字高 9 m —— 飞行员面向 +y 读取
    var m = /^(\d{1,2})([LRC]?)$/.exec(ident) || [ident, ident, ''];
    var num = m[1].length === 1 ? '0' + m[1] : m[1];
    g.save();
    g.translate(cx * px, 51 * py);
    g.scale(1, -1);                       // 面向 +y 的观察者: 上 = +y
    g.font = 'bold ' + Math.round(9 * py) + 'px Arial, Helvetica, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.save(); g.scale(px / py * 0.8, 1); g.fillText(num, 0, 0); g.restore();
    g.restore();
    if (m[2]) {
      g.save();
      g.translate(cx * px, 66 * py);
      g.scale(1, -1);
      g.font = 'bold ' + Math.round(9 * py) + 'px Arial, Helvetica, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.save(); g.scale(px / py * 0.8, 1); g.fillText(m[2], 0, 0); g.restore();
      g.restore();
    }
    // 中线虚线 (从 80 m 开始)
    for (var y = 80; y < END_LEN; y += 60) rect(cx - 0.45, y, 0.9, 36);
    // 接地区标志 150 / 450(超出则省略) 与瞄准点 300 m
    function tdz(y0, bars) {
      for (var b = 0; b < bars; b++) {
        rect(cx - 9 - b * 3, y0, 1.8, 22.5);
        rect(cx + 7.2 + b * 3, y0, 1.8, 22.5);
      }
    }
    tdz(150, 3);
    rect(cx - 15, 300, 6, 45); rect(cx + 9, 300, 6, 45);   // 瞄准点
    var t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
    t.flipY = false; t.anisotropy = 8;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    _texCache[key] = t;
    return t;
  }

  /**
   * 沿跑道方向的条带网格: 起点 a, 方向 d(单位), 右向 r, 从 s0 到 s1, 宽 w。
   * 顶点高度 = 地面高度(heightFn) + 6 cm, 每 ~80 m 一段, 保证贴合地形 (含联网高程)。
   */
  function strip(THREE, a, d, r, s0, s1, w, heightFn, v0, v1) {
    var hw = w / 2, n = Math.max(1, Math.ceil((s1 - s0) / 80));
    var pos = new Float32Array((n + 1) * 2 * 3), uv = new Float32Array((n + 1) * 2 * 2), idx = [];
    for (var k = 0; k <= n; k++) {
      var s = s0 + (s1 - s0) * k / n, v = v0 + (v1 - v0) * k / n;
      for (var side = 0; side < 2; side++) {
        var l = side ? hw : -hw;
        var x = a.x + d.x * s + r.x * l, z = a.z + d.z * s + r.z * l;
        var o = (k * 2 + side);
        pos[o * 3] = x; pos[o * 3 + 1] = heightFn(x, z) + 0.06; pos[o * 3 + 2] = z;
        uv[o * 2] = side; uv[o * 2 + 1] = v;
      }
    }
    // 法线朝上: 判断 (右 x 前) 的 y 分量符号
    var up = (r.z * d.x - r.x * d.z) > 0;
    for (var q = 0; q < n; q++) {
      var i0 = q * 2, i1 = i0 + 1, i2 = i0 + 3, i3 = i0 + 2;
      if (up) idx.push(i0, i1, i2, i0, i2, i3); else idx.push(i0, i2, i1, i0, i3, i2);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /** 一座机场的物理跑道列表 (每对跑道端合并为一条), 世界坐标 */
  function runwayDefs(airport) {
    var seen = {}, out = [], Geo = FS.Geo;
    airport.runways.forEach(function (r) {
      if (seen[r.ident]) return;
      var other = r.paired ? FS.Airports.findRunway(airport.icao, r.paired) : null;
      seen[r.ident] = true; if (other) seen[other.ident] = true;
      var a = Geo.toWorld(r.lat, r.lon), b;
      var lenM = r.lengthFt * 0.3048, wM = Math.max(18, (r.widthFt || 148) * 0.3048);
      if (other) b = Geo.toWorld(other.lat, other.lon);
      else { var e = Geo.greatCircleOffset(r.lat, r.lon, r.hdgTrue, lenM); b = Geo.toWorld(e.lat, e.lon); }
      var dx = b.x - a.x, dz = b.z - a.z, L = Math.sqrt(dx * dx + dz * dz);
      if (!(L > 100)) return;
      var e1 = r.elevFt !== undefined ? r.elevFt : airport.elevFt;
      var e2 = other && other.elevFt !== undefined ? other.elevFt : e1;
      out.push({ r: r, other: other, a: a, b: b, L: L, w: wM, d: { x: dx / L, z: dz / L },
        elev: (e1 + e2) * 0.5 * 0.3048 });
    });
    return out;
  }

  /** 给机场所有跑道加带状平整区: 两侧各 160 m (道肩 + 平行滑行道), 两端延伸 300 m, 1.4 km 过渡 */
  function addFlatten(env, airport) {
    runwayDefs(airport).forEach(function (R) {
      var ext = 300, d = R.d;
      env.addRunwayFlatten(R.a.x - d.x * ext, R.a.z - d.z * ext, R.b.x + d.x * ext, R.b.z + d.z * ext,
        R.w / 2 + 160, R.elev, 1400);
    });
  }

  /** 建一座机场的全部跑道道面 (先调用 addFlatten), 返回 THREE.Group */
  function buildAirport(THREE, env, airport) {
    var group = new THREE.Group();
    group.name = 'runways:' + airport.icao;
    var mats = [];
    var hf = (env && env.getGroundHeight) ? function (x, z) { return env.getGroundHeight(x, z); } : null;
    runwayDefs(airport).forEach(function (R) {
      var a = R.a, b = R.b, d = R.d, rr = { x: -d.z, z: d.x }, L = R.L, wM = R.w;
      var h = hf || function () { return R.elev; };
      var E = Math.min(END_LEN, L * 0.25);
      var matBody = new THREE.MeshStandardMaterial({ map: bodyTexture(THREE, wM).clone(), roughness: 0.92, metalness: 0,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
      matBody.map.needsUpdate = true;
      var body = new THREE.Mesh(strip(THREE, a, d, rr, E, L - E, wM, h, 0, (L - 2 * E) / 60), matBody);
      body.name = 'rwyBody'; body.receiveShadow = true;
      group.add(body); mats.push(matBody);
      [[R.r, a, d, rr], [R.other || { ident: '' }, b, { x: -d.x, z: -d.z }, { x: -rr.x, z: -rr.z }]].forEach(function (ed) {
        var id = ed[0].ident || '';
        var m = new THREE.MeshStandardMaterial({ map: endTexture(THREE, wM, id), roughness: 0.92, metalness: 0,
          polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
        var me = new THREE.Mesh(strip(THREE, ed[1], ed[2], ed[3], 0, E, wM, h, 0, E / END_LEN), m);
        me.name = 'rwyEnd:' + id; me.receiveShadow = true;
        group.add(me); mats.push(m);
      });
    });
    group.userData.dispose = function () {
      group.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
      mats.forEach(function (m) { m.dispose(); });
    };
    group.userData.airport = airport;
    return group;
  }

  /** 选出参考点附近 (radiusKm) 的机场 */
  function nearbyAirports(radiusKm, mustInclude) {
    var out = [], seen = {};
    (mustInclude || []).forEach(function (a) { if (a && !seen[a.icao]) { seen[a.icao] = 1; out.push(a); } });
    FS.Airports.list.forEach(function (a) {
      if (seen[a.icao]) return;
      var w = FS.Geo.toWorld(a.lat, a.lon);
      if (Math.sqrt(w.x * w.x + w.z * w.z) < radiusKm * 1000) { seen[a.icao] = 1; out.push(a); }
    });
    return out;
  }

  FS.Runways = { buildAirport: buildAirport, addFlatten: addFlatten, runwayDefs: runwayDefs, nearbyAirports: nearbyAirports, END_LEN: END_LEN };
})(window);
