/* =====================================================================
 * scenery-online.js — 联网全球地景 (beta 0.3)
 *
 * 在飞机周围按 Web Mercator 四叉树流式加载:
 *   - 高程: AWS Open Data "Terrain Tiles" (Mapzen/Tilezen Terrarium PNG 编码)
 *           height = R*256 + G + B/256 - 32768 (米)
 *   - 影像: 默认 EOX Sentinel-2 cloudless 2016 (CC BY 4.0);
 *           可选 2024 年版 (CC BY-NC-SA 4.0, 仅限非商业) 或 NASA GIBS Blue Marble (公有领域, 低分辨率)
 *
 * 设计要点:
 *   - 近处细分 (最高 z14 影像 / z12 高程), 远处粗瓦片; 子瓦片未就绪时显示父瓦片, 无空洞。
 *   - 物理高度 = 当前显示瓦片的网格双线性插值, 与画面一致; 机场平整区复用 Environment.applyFlattenTo。
 *   - 节流: 最多 6 个并发请求, 每秒新请求数受限; 内存 LRU 缓存; 浏览器 HTTP 缓存 (EOX max-age 7 天)。
 *   - 任何错误/超时/离线: 回退到内置程序化地形 (无缝, 不报错)。
 *   - 屏幕右下角显示数据署名 (ASSETS_LICENSES.md 第 5 节有完整条款)。
 * ===================================================================== */
(function (global) {
  'use strict';
  var FS = global.FS = global.FS || {};
  var THREE = global.THREE;
  var DEG = Math.PI / 180;

  var SOURCES = {
    dem: {
      url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
      maxZ: 12,
      attribution: '地形: Terrain Tiles (AWS Open Data / Tilezen; USGS·NOAA·Copernicus EU-DEM 等, 点击查看完整署名)',
      // tilezen/joerd docs/attribution.md 要求的完整署名 (英文原文, 不可删改)
      attributionFull: [
        'ArcticDEM terrain data DEM(s) were created from DigitalGlobe, Inc., imagery and funded under National Science Foundation awards 1043681, 1559691, and 1542736;',
        'Australia terrain data © Commonwealth of Australia (Geoscience Australia) 2017;',
        'Austria terrain data © offene Daten Österreichs – Digitales Geländemodell (DGM) Österreich;',
        'Canada terrain data contains information licensed under the Open Government Licence – Canada;',
        'Europe terrain data produced using Copernicus data and information funded by the European Union - EU-DEM layers;',
        'Global ETOPO1 terrain data U.S. National Oceanic and Atmospheric Administration',
        'Mexico terrain data source: INEGI, Continental relief, 2016;',
        'New Zealand terrain data Copyright 2011 Crown copyright (c) Land Information New Zealand and the New Zealand Government (All rights reserved);',
        'Norway terrain data © Kartverket;',
        'United Kingdom terrain data © Environment Agency copyright and/or database right 2015. All rights reserved;',
        'United States 3DEP (formerly NED) and global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey.'
      ]
    },
    imagery: {
      's2-2016': {
        name: 'Sentinel-2 cloudless 2016 (CC BY 4.0)',
        url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg',
        maxZ: 14,
        attribution: '影像: Sentinel-2 cloudless 2016 © EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016), CC BY 4.0'
      },
      's2-2024': {
        name: 'Sentinel-2 cloudless 2024 (CC BY-NC-SA 4.0, 仅非商业)',
        url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg',
        maxZ: 14,
        attribution: '影像: Sentinel-2 cloudless 2024 © EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024), CC BY-NC-SA 4.0 (仅限非商业用途)'
      },
      'gibs': {
        name: 'NASA Blue Marble (公有领域, 低分辨率)',
        url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',
        maxZ: 8,
        attribution: '影像: NASA Blue Marble, 由 NASA EOSDIS GIBS 提供'
      }
    }
  };

  var ROOT_Z = 7, MAX_CONC = 6, MAX_PER_SEC = 24, TIMEOUT_MS = 15000;
  var SEG = 32;              // 每块瓦片网格段数
  var SPLIT = 1.05;          // 距离 < SPLIT * 瓦片边长 时细分
  var CACHE_MAX = 260;       // 内存中保留的影像瓦片上限
  var DEM_CACHE_MAX = 120;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lon2x(lon, z) { return (lon + 180) / 360 * Math.pow(2, z); }
  function lat2y(lat, z) {
    var r = clamp(lat, -85.05, 85.05) * DEG;
    return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z);
  }
  function x2lon(x, z) { return x / Math.pow(2, z) * 360 - 180; }
  function y2lat(y, z) {
    var n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
    return Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))) / DEG;
  }
  function tkey(z, x, y) { return z + '/' + x + '/' + y; }
  function fill(t, z, x, y) { return t.replace('{z}', z).replace('{x}', x).replace('{y}', y); }
  function now() { return (global.performance && performance.now) ? performance.now() : Date.now(); }

  /* ------------------------------------------------------------------ */
  function OnlineScenery(env, scene, opts) {
    opts = opts || {};
    this.env = env;
    this.scene = scene;
    this.imageryId = SOURCES.imagery[opts.imagery] ? opts.imagery : 's2-2016';
    this.img = SOURCES.imagery[this.imageryId];
    this.maxZ = Math.min(opts.maxZoom || 14, this.img.maxZ + 3);   // 影像不足时最多再细分 2 级 (仅几何)
    this.group = new THREE.Group();
    this.group.name = 'onlineScenery';
    this.group.visible = false;
    scene.add(this.group);
    this.tiles = {};           // key -> tile
    this.dem = {};             // key -> {state, h: Float32Array(256*256)}
    this.queue = [];
    this.active = 0;
    this._sentT = [];
    this.displayed = [];       // 当前显示的瓦片
    this._dispByZ = {};        // z -> {key: tile}
    this.enabled = true;
    this.ready = false;        // 根覆盖 + 飞机下方瓦片就绪
    this.failed = false;
    this.stats = { requests: 0, ok: 0, errors: 0, timeouts: 0, tiles: 0, shown: 0, lastErr: '' };
    this._lastUpdate = -1e9;
    this._lastHit = null;
    this._oceanDirtyT = 0;
    var anis = 4;
    try { anis = Math.min(4, env.renderer.capabilities.getMaxAnisotropy()); } catch (e) { /* */ }
    this._anis = anis;
    this.material0 = null;
    this._mkAttribution();
    var self = this;
    this.heightFn = function (x, z) { return self.heightAt(x, z); };
    env.setHeightProvider(this.heightFn);
  }

  OnlineScenery.SOURCES = SOURCES;

  OnlineScenery.prototype.attributionText = function () {
    return SOURCES.dem.attribution + ' · ' + this.img.attribution;
  };

  OnlineScenery.prototype._mkAttribution = function () {
    var doc = global.document;
    if (!doc) return;
    var el = doc.getElementById('scenery-attrib');
    if (!el) {
      el = doc.createElement('div');
      el.id = 'scenery-attrib';
      doc.body.appendChild(el);
    }
    el.textContent = '联网地景 · ' + this.attributionText();
    el.title = '点击查看完整署名 (致谢 / 许可); 条款见 ASSETS_LICENSES.md';
    if (!el._fsClick) { el._fsClick = true; el.style.cursor = 'pointer'; el.addEventListener('click', function () { if (FS.Credits) FS.Credits.open(); }); }
    el.style.display = 'block';
    this.attribEl = el;
  };

  /* ---------------------------- 网络 ---------------------------- */

  OnlineScenery.prototype._enqueue = function (job) {
    this.queue.push(job);
  };

  OnlineScenery.prototype._pump = function () {
    var t = now();
    while (this._sentT.length && t - this._sentT[0] > 1000) this._sentT.shift();
    if (!this.queue.length) return;
    // 低 zoom 优先, 同 zoom 近者优先
    // 粗级 (z<=8, 保证远景覆盖) 优先, 其余按距离 (近处先到)
    this.queue = this.queue.filter(function (j) { return !(j.cancelled && j.cancelled()); });
    this.queue.sort(function (a, b) {
      var ca = a.z <= 8 ? 0 : 1, cb = b.z <= 8 ? 0 : 1;
      return (ca - cb) || (a.pri - b.pri) || (a.z - b.z);
    });
    while (this.active < MAX_CONC && this.queue.length && this._sentT.length < MAX_PER_SEC) {
      var job = this.queue.shift();
      if (job.cancelled && job.cancelled()) continue;
      this._sentT.push(t);
      this._load(job);
    }
  };

  OnlineScenery.prototype._load = function (job) {
    var self = this, img = new global.Image(), done = false;
    this.active++;
    this.stats.requests++;
    img.crossOrigin = 'anonymous';
    var timer = setTimeout(function () {
      if (done) return;
      done = true; self.active--; self.stats.timeouts++; self.stats.errors++;
      self.stats.lastErr = 'timeout ' + job.url;
      img.src = '';
      job.fail('timeout');
    }, TIMEOUT_MS);
    img.onload = function () {
      if (done) return;
      done = true; clearTimeout(timer); self.active--; self.stats.ok++;
      try { job.ok(img); } catch (e) { self.stats.lastErr = String(e && e.message || e); job.fail('decode'); }
    };
    img.onerror = function () {
      if (done) return;
      done = true; clearTimeout(timer); self.active--; self.stats.errors++;
      self.stats.lastErr = 'error ' + job.url;
      job.fail('error');
    };
    img.src = job.url;
  };

  /* ---------------------------- 高程 ---------------------------- */

  var _cv = null, _cx = null;
  function decodeTerrarium(img) {
    if (!_cv) {
      _cv = global.document.createElement('canvas');
      _cv.width = 256; _cv.height = 256;
      _cx = _cv.getContext('2d', { willReadFrequently: true });
    }
    _cx.clearRect(0, 0, 256, 256);
    _cx.drawImage(img, 0, 0, 256, 256);
    var d = _cx.getImageData(0, 0, 256, 256).data;   // 跨域未授权时这里抛 SecurityError -> 回退
    var h = new Float32Array(256 * 256), i;
    for (i = 0; i < 65536; i++) h[i] = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768;
    return h;
  }

  OnlineScenery.prototype._demFor = function (z, x, y, pri) {
    var dz = Math.min(z, SOURCES.dem.maxZ), sh = z - dz;
    var dx = x >> sh, dy = y >> sh, k = tkey(dz, dx, dy);
    var e = this.dem[k];
    if (!e) {
      var self = this;
      e = this.dem[k] = { z: dz, x: dx, y: dy, state: 'loading', h: null, used: now() };
      this._enqueue({
        z: dz, pri: pri || 0, url: fill(SOURCES.dem.url, dz, dx, dy),
        cancelled: function () {
          if (!self.enabled || now() - e.used > 3000) { e.state = 'cancelled'; if (self.dem[k] === e) delete self.dem[k]; return true; }
          return false;
        },
        ok: function (img) { e.h = decodeTerrarium(img); e.state = 'ready'; },
        fail: function (why) { e.state = 'error'; e.why = why; e.failT = now(); }
      });
    }
    e.used = now();
    return e;
  };

  /** 在 DEM 瓦片中按 (纬, 经) 双线性取样 */
  function sampleDem(e, lat, lon) {
    var fx = (lon2x(lon, e.z) - e.x) * 256 - 0.5, fy = (lat2y(lat, e.z) - e.y) * 256 - 0.5;
    fx = clamp(fx, 0, 255); fy = clamp(fy, 0, 255);
    var x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(255, x0 + 1), y1 = Math.min(255, y0 + 1);
    var tx = fx - x0, ty = fy - y0, h = e.h;
    var a = h[y0 * 256 + x0], b = h[y0 * 256 + x1], c = h[y1 * 256 + x0], d = h[y1 * 256 + x1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }

  /* ---------------------------- 瓦片 ---------------------------- */

  OnlineScenery.prototype._tile = function (z, x, y) {
    var k = tkey(z, x, y), t = this.tiles[k];
    if (!t) {
      t = this.tiles[k] = { z: z, x: x, y: y, key: k, state: 'idle', tex: null, mesh: null, grid: null, used: now() };
      this.stats.tiles++;
    }
    return t;
  };

  OnlineScenery.prototype._request = function (t, pri) {
    if (t.state !== 'idle') return;
    var self = this;
    t.state = 'loading';
    t.dem = this._demFor(t.z, t.x, t.y, pri);
    var iz = Math.min(t.z, this.img.maxZ), sh = t.z - iz;
    t.imgZ = iz;
    var ix = t.x >> sh, iy = t.y >> sh;
    // 影像超出最大级时复用父级影像 (UV 取子区域)
    var parentImg = sh > 0 ? this._tile(iz, ix, iy) : null;
    if (parentImg) {
      t.imgParent = parentImg;
      if (parentImg.state === 'idle') this._request(parentImg, pri);
      t.texState = 'parent';
      return;
    }
    this._enqueue({
      z: t.z, pri: pri, url: fill(this.img.url, t.z, t.x, t.y),
      cancelled: function () {
        // 已不在需求集 (飞走了) -> 取消, 瓦片回到 idle, 以后需要时再请求
        if (!self.enabled || now() - t.used > 1500) { t.state = 'idle'; t.texState = null; return true; }
        return false;
      },
      ok: function (img) {
        var tex = new THREE.Texture(img);
        if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
        tex.anisotropy = self._anis;
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.needsUpdate = true;
        t.tex = tex; t.texState = 'ready';
      },
      fail: function (why) { t.texState = 'error'; t.state = 'error'; t.failT = now(); t.why = why; }
    });
    t.texState = 'loading';
  };

  /** 两个依赖 (影像 + 高程) 都就绪后建网格 */
  OnlineScenery.prototype._tryBuild = function (t) {
    if (t.state !== 'loading') return t.state === 'ready';
    t.dem.used = now();
    if (t.dem.state === 'cancelled') { t.dem = this._demFor(t.z, t.x, t.y, 0); }
    if (t.dem.state === 'error') { t.state = 'error'; t.failT = now(); return false; }
    if (t.dem.state !== 'ready') return false;
    var tex = null, uv0 = [0, 0, 1, 1];
    if (t.texState === 'parent') {
      var p = t.imgParent;
      if (p.texState === 'error' || p.state === 'error') { t.state = 'error'; t.failT = now(); return false; }
      if (p.texState !== 'ready') return false;
      tex = p.tex;
      var sh = t.z - p.z, n = 1 << sh, ox = t.x - (p.x << sh), oy = t.y - (p.y << sh);
      uv0 = [ox / n, oy / n, (ox + 1) / n, (oy + 1) / n];
      p.used = now();
    } else if (t.texState === 'ready') {
      tex = t.tex;
    } else return false;
    this._buildMesh(t, tex, uv0);
    t.state = 'ready';
    return true;
  };

  OnlineScenery.prototype._buildMesh = function (t, tex, uv0) {
    var Geo = FS.Geo, env = this.env;
    var N = SEG, V = N + 1, i, j;
    var lon0 = x2lon(t.x, t.z), lon1 = x2lon(t.x + 1, t.z);
    var my0 = t.y, my1 = t.y + 1;
    var lat0 = y2lat(my0, t.z), lat1 = y2lat(my1, t.z);
    var c = Geo.toWorld((lat0 + lat1) / 2, (lon0 + lon1) / 2);
    var nv = V * V + 4 * V;                     // 网格 + 裙边
    var pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
    var grid = new Float32Array(V * V);
    var p = { x: 0, z: 0 };
    for (j = 0; j < V; j++) {
      var lat = y2lat(my0 + j / N, t.z);
      for (i = 0; i < V; i++) {
        var lon = lon0 + (lon1 - lon0) * i / N;
        Geo.toWorldInto(lat, lon, p);
        var h = sampleDem(t.dem, lat, lon);
        if (!isFinite(h)) h = 0;
        h = env.applyFlattenTo(p.x, p.z, h, 'online');
        if (h < -40) h = -40;
        grid[j * V + i] = h;
        var o = j * V + i;
        pos[o * 3] = p.x - c.x; pos[o * 3 + 1] = h; pos[o * 3 + 2] = p.z - c.z;
        uv[o * 2] = uv0[0] + (uv0[2] - uv0[0]) * i / N;
        uv[o * 2 + 1] = 1 - (uv0[1] + (uv0[3] - uv0[1]) * j / N);
      }
    }
    // 裙边: 四条边各一行顶点, 向下 skirt 米, 挡住相邻 LOD 之间的细缝
    var skirt = Math.max(30, 2.5 * this._tileSizeM(t));
    skirt = Math.min(skirt, 600);
    var edges = [], e, s;
    for (s = 0; s < V; s++) edges.push(s);                         // 上
    for (s = 0; s < V; s++) edges.push((V - 1) * V + s);           // 下
    for (s = 0; s < V; s++) edges.push(s * V);                     // 左
    for (s = 0; s < V; s++) edges.push(s * V + V - 1);             // 右
    for (e = 0; e < edges.length; e++) {
      var src = edges[e], dst = V * V + e;
      pos[dst * 3] = pos[src * 3]; pos[dst * 3 + 1] = pos[src * 3 + 1] - skirt; pos[dst * 3 + 2] = pos[src * 3 + 2];
      uv[dst * 2] = uv[src * 2]; uv[dst * 2 + 1] = uv[src * 2 + 1];
    }
    var idx = [];
    for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
      var a = j * V + i, b = a + 1, cc = a + V, d = cc + 1;
      idx.push(a, cc, b, b, cc, d);
    }
    var nGridIdx = idx.length;
    function strip(base, getSrc, flip) {
      for (var q = 0; q < N; q++) {
        var a1 = getSrc(q), b1 = getSrc(q + 1), a2 = base + q, b2 = base + q + 1;
        if (flip) idx.push(a1, b1, a2, b1, b2, a2); else idx.push(a1, a2, b1, b1, a2, b2);
      }
    }
    strip(V * V, function (q) { return q; }, false);
    strip(V * V + V, function (q) { return (V - 1) * V + q; }, true);
    strip(V * V + 2 * V, function (q) { return q * V; }, true);
    strip(V * V + 3 * V, function (q) { return q * V + V - 1; }, false);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    // 法线只用地表网格计算 (否则竖直裙边会把瓦片边缘一圈顶点的法线拉歪, 出现暗线), 裙边沿用对应边缘顶点的法线
    geo.setIndex(idx.slice(0, nGridIdx));
    geo.computeVertexNormals();
    var nrm = geo.attributes.normal.array;
    for (e = 0; e < edges.length; e++) {
      var s0 = edges[e] * 3, d0 = (V * V + e) * 3;
      nrm[d0] = nrm[s0]; nrm[d0 + 1] = nrm[s0 + 1]; nrm[d0 + 2] = nrm[s0 + 2];
    }
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    var mat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.FrontSide });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(c.x, 0, c.z);
    mesh.receiveShadow = !!env.useShadows;
    mesh.renderOrder = -60;
    mesh.visible = false;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.group.add(mesh);
    t.mesh = mesh;
    t.grid = grid;
    t.lat0 = lat0; t.lat1 = lat1; t.lon0 = lon0; t.lon1 = lon1;
  };

  OnlineScenery.prototype._tileSizeM = function (t) {
    var lat = y2lat(t.y + 0.5, t.z);
    return 40075016 * Math.cos(lat * DEG) / Math.pow(2, t.z);
  };

  OnlineScenery.prototype._dispose = function (t) {
    if (t.mesh) {
      this.group.remove(t.mesh);
      t.mesh.geometry.dispose();
      t.mesh.material.dispose();
      t.mesh = null;
    }
    if (t.tex) { t.tex.dispose(); t.tex = null; }
    t.grid = null;
    delete this.tiles[t.key];
    this.stats.tiles--;
  };

  /* ---------------------------- 每帧 ---------------------------- */

  OnlineScenery.prototype.update = function (dt, focus) {
    if (!this.enabled) return;
    this._pump();
    var t = now();
    // 每 0.25 s 重算一次四叉树
    if (t - this._lastUpdate < 250) { this._buildPending(); return; }
    this._lastUpdate = t;
    var Geo = FS.Geo, ll = Geo.toLatLon(focus.x, focus.z);
    var gh = this.env.getGroundHeight(focus.x, focus.z);
    var agl = Math.max(0, (focus.y || 0) - gh);
    this._focus = { lat: ll.lat, lon: ll.lon, agl: agl, x: focus.x, z: focus.z };

    // 根: z7 的 3x3 邻域
    var rx = Math.floor(lon2x(ll.lon, ROOT_Z)), ry = Math.floor(lat2y(ll.lat, ROOT_Z)), n = 1 << ROOT_Z;
    var shown = [], ok = true, i, j, self = this;
    var want = {};
    function visit(z, x, y) {
      var tile = self._tile(z, x, y);
      want[tile.key] = true;
      tile.used = t;
      var lat = y2lat(y + 0.5, z), lon = x2lon(x + 0.5, z);
      var dx = (lon - ll.lon) * DEG * 6371000 * Math.cos(ll.lat * DEG);
      var dy = (lat - ll.lat) * DEG * 6371000;
      var size = self._tileSizeM(tile);
      var dist = Math.max(0, Math.sqrt(dx * dx + dy * dy) - size * 0.5) + agl * 1.2;
      if (tile.state === 'idle') self._request(tile, dist);
      if (tile.state === 'loading') self._tryBuild(tile);
      if (tile.state === 'error' && t - (tile.failT || 0) > 30000 && z <= 10) {
        // 30 s 后低级瓦片可重试一次
        tile.state = 'idle'; tile.texState = null;
        if (tile.dem && tile.dem.state === 'error') delete self.dem[tile.dem.z + '/' + tile.dem.x + '/' + tile.dem.y];
      }
      var split = z < self.maxZ && dist < SPLIT * size;
      if (split) {
        var kids = [], allOk = true, q;
        for (q = 0; q < 4; q++) {
          var r = visit(z + 1, x * 2 + (q & 1), y * 2 + (q >> 1));
          kids.push(r);
          if (!r.ok) allOk = false;
        }
        if (allOk) {
          var list = [];
          for (q = 0; q < 4; q++) list = list.concat(kids[q].list);
          return { ok: true, list: list };
        }
      }
      if (tile.state === 'ready') return { ok: true, list: [tile] };
      return { ok: false, list: [] };
    }
    for (j = -1; j <= 1; j++) for (i = -1; i <= 1; i++) {
      var yy = ry + j; if (yy < 0 || yy >= n) continue;
      var xx = ((rx + i) % n + n) % n;
      var res = visit(ROOT_Z, xx, yy);
      if (!res.ok) ok = false;
      shown = shown.concat(res.list);
    }

    // 显示集切换
    var k, map = {}, byZ = {};
    for (i = 0; i < shown.length; i++) {
      map[shown[i].key] = true;
      (byZ[shown[i].z] = byZ[shown[i].z] || {})[shown[i].key] = shown[i];
    }
    for (i = 0; i < this.displayed.length; i++) {
      if (!map[this.displayed[i].key] && this.displayed[i].mesh) this.displayed[i].mesh.visible = false;
    }
    var changed = shown.length !== this.displayed.length;
    for (i = 0; i < shown.length; i++) {
      if (shown[i].mesh && !shown[i].mesh.visible) { shown[i].mesh.visible = true; changed = true; }
    }
    this.displayed = shown;
    this._dispByZ = byZ;
    this._lastHit = null;
    this.stats.shown = shown.length;

    // 就绪判定: 根邻域都能覆盖, 并且飞机正下方的显示瓦片足够细 (>= z11 或高空时更粗也可)
    var under = this._displayedAt(ll.lat, ll.lon);
    var needZ = agl > 6000 ? 8 : (agl > 2000 ? 10 : 11);
    var wasReady = this.ready;
    this.ready = ok && !!under && under.z >= Math.min(needZ, this.maxZ);
    this.group.visible = this.ready;      // 未就绪时不与内置地形叠画
    if (this.ready !== wasReady || (this.ready && changed)) {
      this.env.setBuiltinTerrainVisible(!this.ready);
      if (t - this._oceanDirtyT > 2000) { this.env.markOceanDirty(); this._oceanDirtyT = t; }
    }
    if (this.ready !== wasReady) {
      FS.Log && FS.Log.info('联网地景 ' + (this.ready ? '就绪, 隐藏内置地形' : '未就绪, 显示内置地形'));
    }

    // 回收: 不在需求集中且不显示的瓦片
    var keys = Object.keys(this.tiles);
    if (keys.length > CACHE_MAX) {
      var cands = [];
      for (i = 0; i < keys.length; i++) {
        var tt = this.tiles[keys[i]];
        if (!want[tt.key] && !map[tt.key] && tt.state !== 'loading') cands.push(tt);
      }
      cands.sort(function (a, b) { return a.used - b.used; });
      for (i = 0; i < cands.length && Object.keys(this.tiles).length > CACHE_MAX; i++) {
        // 被子瓦片引用为影像父级的不回收
        this._dispose(cands[i]);
      }
    }
    var dk = Object.keys(this.dem);
    if (dk.length > DEM_CACHE_MAX) {
      dk.sort(function (a, b) { return self.dem[a].used - self.dem[b].used; });
      for (i = 0; i < dk.length - DEM_CACHE_MAX; i++) if (this.dem[dk[i]].state !== 'loading') delete this.dem[dk[i]];
    }
    // 根部持续失败 -> 视为离线
    if (!this.ready && this.stats.ok === 0 && this.stats.errors >= 9) {
      if (!this.failed) {
        this.failed = true;
        FS.Log && FS.Log.warn('联网地景: 瓦片服务器不可达, 使用内置地形 (' + this.stats.lastErr + ')');
        if (FS.Bus) FS.Bus.emit('scenery:offline', { reason: this.stats.lastErr });
      }
    }
  };

  OnlineScenery.prototype._buildPending = function () {
    // 两次四叉树更新之间, 也把已下载完的瓦片尽快建好 (每帧最多 3 块, 控制卡顿)
    var n = 0, k;
    for (k in this.tiles) {
      var t = this.tiles[k];
      if (t.state === 'loading' && this._tryBuild(t) && ++n >= 3) break;
    }
  };

  OnlineScenery.prototype._displayedAt = function (lat, lon) {
    var z, byZ = this._dispByZ;
    for (z = this.maxZ; z >= ROOT_Z; z--) {
      var m = byZ[z]; if (!m) continue;
      var k = tkey(z, Math.floor(lon2x(lon, z)), Math.floor(lat2y(lat, z)));
      if (m[k]) return m[k];
    }
    return null;
  };

  /** 物理/碰撞高度: 当前显示瓦片网格的双线性插值 (与画面一致). 未覆盖时返回 NaN -> 内置地形 */
  OnlineScenery.prototype.heightAt = function (x, z) {
    if (!this.enabled || !this.ready) return NaN;
    var ll = FS.Geo.toLatLon(x, z);
    var t = this._lastHit;
    if (!t || !t.grid || ll.lat > t.lat0 || ll.lat < t.lat1 || ll.lon < t.lon0 || ll.lon > t.lon1) {
      t = this._displayedAt(ll.lat, ll.lon);
      if (!t || !t.grid) return NaN;
      this._lastHit = t;
    }
    var N = SEG, V = N + 1;
    var fi = (ll.lon - t.lon0) / (t.lon1 - t.lon0) * N;
    var fj = (lat2y(ll.lat, t.z) - t.y) * N;
    fi = clamp(fi, 0, N); fj = clamp(fj, 0, N);
    var i0 = Math.min(N - 1, Math.floor(fi)), j0 = Math.min(N - 1, Math.floor(fj));
    var tx = fi - i0, ty = fj - j0, g = t.grid;
    var a = g[j0 * V + i0], b = g[j0 * V + i0 + 1], c = g[(j0 + 1) * V + i0], d = g[(j0 + 1) * V + i0 + 1];
    // 与网格三角剖分一致 (a,c,b)/(b,c,d)
    var hh = (tx + ty <= 1) ? a + (b - a) * tx + (c - a) * ty : d + (c - d) * (1 - tx) + (b - d) * (1 - ty);
    // 跑道带内再按点精确压平 -> 机轮正好落在跑道道面上
    return this.env.applyFlattenTo(x, z, hh, 'online');
  };

  OnlineScenery.prototype.setEnabled = function (on) {
    this.enabled = !!on;
    this.group.visible = this.enabled;
    if (!this.enabled) {
      this.ready = false;
      this.env.setBuiltinTerrainVisible(true);
      this.env.markOceanDirty();
    }
    if (this.attribEl) this.attribEl.style.display = this.enabled ? 'block' : 'none';
  };

  OnlineScenery.prototype.status = function () {
    return {
      enabled: this.enabled, ready: this.ready, failed: this.failed, imagery: this.imageryId,
      requests: this.stats.requests, ok: this.stats.ok, errors: this.stats.errors,
      timeouts: this.stats.timeouts, tiles: this.stats.tiles, shown: this.stats.shown,
      queue: this.queue.length, active: this.active, lastErr: this.stats.lastErr
    };
  };

  OnlineScenery.prototype.dispose = function () {
    this.enabled = false;
    var k;
    for (k in this.tiles) this._dispose(this.tiles[k]);
    this.queue.length = 0;
    this.dem = {};
    if (this.group.parent) this.group.parent.remove(this.group);
    if (this.env.getHeightProvider() === this.heightFn) this.env.setHeightProvider(null);
    this.env.setBuiltinTerrainVisible(true);
    this.env.markOceanDirty();
    if (this.attribEl) this.attribEl.style.display = 'none';
  };

  FS.OnlineScenery = OnlineScenery;
})(typeof window !== 'undefined' ? window : this);
