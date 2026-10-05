/* ==========================================================================
   天际航线 SkyRoute — 飞机三维机体建模 (aircraft3d.js)
   依赖: three.js (全局 THREE, r149) / utils.js / config.js
   --------------------------------------------------------------------------
   机体坐标系 (与 FS.AIRCRAFT_DB.dims 一致):
       +X = 右翼   +Y = 上   +Z = 机尾方向 (机头指向 -Z)
       原点 = 机身参考点 (大致在机翼气动中心), 单位 = 米
   全部几何按米建立, 三角面数在中档质量下约 1~3 万, 远低于 12 万预算。

   beta 0.2: 若 FS.ModelAssets[机型] 存在 (models/ac_*.js, CC BY 4.0 真实外形
   模型, 来源见 ASSETS_LICENSES.md), 则机身/机翼/尾翼/发动机短舱使用该模型,
   起落架 (含收放与舱门)、灯光、风扇转动、客舱门仍为程序化部件。
   没有模型的机型继续使用下面的程序化建模。
   ========================================================================== */
(function (global) {
  'use strict';

  var FS = global.FS = global.FS || {};
  var U = FS.Utils;

  /* ---------------------------------------------------------------------
     0. three.js 引用
        浏览器: THREE 为全局变量 (three.min.js UMD 已先加载)
        node  : UMD 走 CommonJS 分支, 需要 require 兜底 (无头冒烟测试)
     --------------------------------------------------------------------- */
  var THREE = global.THREE;
  if (!THREE && typeof require === 'function') {
    try { THREE = require('../vendor/three.min.js'); } catch (e1) {
      try { THREE = require('three'); } catch (e2) { THREE = null; }
    }
  }
  if (THREE && !global.THREE) global.THREE = THREE;
  if (!THREE) {
    if (FS.Log) FS.Log.error('aircraft3d.js: 未找到 THREE, 模块未加载');
    return;
  }

  /* ---------------------------------------------------------------------
     1. 小工具
     --------------------------------------------------------------------- */
  var DEG = Math.PI / 180;
  var TAU = Math.PI * 2;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function smoothstep(t) { t = clamp01(t); return t * t * (3 - 2 * t); }
  function v3(x, y, z) { return new THREE.Vector3(x, y, z); }

  /** 三角面朝向修正: 保证 (a,b,c) 的法线朝 want 方向 */
  function pushTri(idx, pos, a, b, c, want) {
    var ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
    var e1x = pos[b * 3] - ax, e1y = pos[b * 3 + 1] - ay, e1z = pos[b * 3 + 2] - az;
    var e2x = pos[c * 3] - ax, e2y = pos[c * 3 + 1] - ay, e2z = pos[c * 3 + 2] - az;
    var nx = e1y * e2z - e1z * e2y;
    var ny = e1z * e2x - e1x * e2z;
    var nz = e1x * e2y - e1y * e2x;
    if (nx * want[0] + ny * want[1] + nz * want[2] < 0) idx.push(a, c, b);
    else idx.push(a, b, c);
  }

  /** 三角形绕序是否需要翻转 (镜像部件) */
  function applyFlip(idx, from, flip) {
    if (!flip) return;
    for (var i = from; i < idx.length; i += 3) {
      var t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t;
    }
  }

  /** 由顶点/UV/索引数组生成几何 */
  function makeGeo(pos, uv, idx, flip, fromIdx) {
    applyFlip(idx, fromIdx || 0, flip);
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (uv && uv.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /**
   * 合并一组几何 (刚性小件合并以减少 draw call)
   * @param {Array} items [{ g: BufferGeometry, m: Matrix4|null }]
   * @returns {THREE.BufferGeometry}
   */
  function mergeGeos(items) {
    var pos = [], idx = [], off = 0, i, j;
    var v = new THREE.Vector3();
    for (i = 0; i < items.length; i++) {
      var g = items[i].g, m = items[i].m;
      var p = g.attributes.position;
      for (j = 0; j < p.count; j++) {
        v.set(p.getX(j), p.getY(j), p.getZ(j));
        if (m) v.applyMatrix4(m);
        pos.push(v.x, v.y, v.z);
      }
      var gi = g.index;
      if (gi) { for (j = 0; j < gi.count; j++) idx.push(gi.getX(j) + off); }
      else { for (j = 0; j < p.count; j++) idx.push(j + off); }
      off += p.count;
    }
    var out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setIndex(idx);
    out.computeVertexNormals();
    return out;
  }

  /* ---------------------------------------------------------------------
     1b. 真实外形模型资源 (models/*.js 以 base64 内嵌, file:// 下也能直接加载)
     --------------------------------------------------------------------- */
  function assetFor(typeKey) {
    if (FS.CFG && FS.CFG.proceduralModels) return null;          // 全局开关: 强制程序化
    var A = FS.ModelAssets;
    if (A && A[typeKey]) return A[typeKey];
    // beta 0.3.2: 无独立模型时, 用相近机型真实外形作基底 (中性涂装, 标注 hybrid)
    var ALIAS = {
      'B737-MAX8': 'B737-800'   // MAX 外形接近 NG; 发动机/小翼仍由程序化部件区分不足时仅外形近似
    };
    var base = ALIAS[typeKey];
    if (base && A && A[base]) {
      var src = A[base];
      return {
        body: src.body, fans: src.fans, plug: src.plug, triangles: src.triangles,
        source: src.source, derived: true, hybrid: true, hybridOf: base,
        credit: src.credit
      };
    }
    return null;
  }

  function b64ToBuffer(str) {
    var bin, n, u, i;
    if (typeof global.atob === 'function') bin = global.atob(str);
    else bin = Buffer.from(str, 'base64').toString('binary');
    n = bin.length; u = new Uint8Array(n);
    for (i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }

  /** 解码打包的网格 (每个资源只解码一次, 之后共享类型数组) */
  function decodePacked(pk) {
    if (pk._dec) return pk._dec;
    pk._dec = {
      pos: new Float32Array(b64ToBuffer(pk.pos)),
      nrm: new Int8Array(b64ToBuffer(pk.nrm)),
      uv: new Float32Array(b64ToBuffer(pk.uv)),
      idx: new Uint16Array(b64ToBuffer(pk.idx))
    };
    return pk._dec;
  }

  function geoFromPacked(pk) {
    var d = decodePacked(pk);
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(d.nrm, 3, true));
    g.setAttribute('uv', new THREE.BufferAttribute(d.uv, 2));
    g.setIndex(new THREE.BufferAttribute(d.idx, 1));
    g.computeBoundingSphere();
    return g;
  }

  /* 贴图: 白色底图 + 涂装遮罩 (R=垂尾 G=腰线 B=机腹), 运行时按涂装颜色合成 */
  var _assetImgs = {};        // texId -> { base: Image, mask: Image, n: 已加载数, cbs: [] }
  var _assetTexCache = {};    // texId|涂装 -> THREE.Texture

  function assetImages(texId, cb) {
    var T = FS.ModelTextures && FS.ModelTextures[texId];
    if (!T || !global.document || typeof global.Image !== 'function') return null;
    var rec = _assetImgs[texId];
    if (!rec) {
      rec = _assetImgs[texId] = { base: new global.Image(), mask: new global.Image(), n: 0, cbs: [], failed: false };
      var done = function () {
        rec.n++;
        if (rec.n === 2) { var c = rec.cbs; rec.cbs = []; for (var i = 0; i < c.length; i++) c[i](rec); }
      };
      var fail = function () { rec.failed = true; FS.Log.warn('模型贴图解码失败: ' + texId); };
      rec.base.onload = done; rec.mask.onload = done;
      rec.base.onerror = fail; rec.mask.onerror = fail;
      rec.base.src = T.base; rec.mask.src = T.mask;
    }
    if (cb) { if (rec.n === 2) cb(rec); else rec.cbs.push(cb); }
    return rec;
  }

  function hexRGB(h) { return [(h >> 16) & 255, (h >> 8) & 255, h & 255]; }

  function compositeLivery(rec, lv, canvas) {
    var W = rec.base.naturalWidth || rec.base.width, H = rec.base.naturalHeight || rec.base.height;
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(rec.base, 0, 0, W, H);
    var mc = global.document.createElement('canvas');
    mc.width = W; mc.height = H;
    var mctx = mc.getContext('2d');
    mctx.drawImage(rec.mask, 0, 0, W, H);
    var img, msk;
    try {
      img = ctx.getImageData(0, 0, W, H);
      msk = mctx.getImageData(0, 0, W, H).data;
    } catch (e) {
      // 极少数浏览器在 file:// 下把 data: 图片视为跨源 -> 退回到不分区着色的白色底图
      FS.Log.warn('涂装合成不可用 (' + e.message + '), 使用默认白色涂装');
      return false;
    }
    var p = img.data, n = p.length, i;
    var bd = hexRGB(lv.body), tl = hexRGB(lv.tail), sp = hexRGB(lv.stripe), bl = hexRGB(lv.belly);
    var kb0 = bd[0] / 255, kb1 = bd[1] / 255, kb2 = bd[2] / 255;
    for (i = 0; i < n; i += 4) {
      var r = p[i] * kb0, g = p[i + 1] * kb1, b = p[i + 2] * kb2;
      var wt = msk[i] / 255, ws = msk[i + 1] / 255, wb = msk[i + 2] / 255;
      if (wb > 0) { r += (bl[0] - r) * wb; g += (bl[1] - g) * wb; b += (bl[2] - b) * wb; }
      if (ws > 0) { r += (sp[0] - r) * ws; g += (sp[1] - g) * ws; b += (sp[2] - b) * ws; }
      if (wt > 0) { r += (tl[0] - r) * wt; g += (tl[1] - g) * wt; b += (tl[2] - b) * wt; }
      p[i] = r; p[i + 1] = g; p[i + 2] = b;
    }
    ctx.putImageData(img, 0, 0);
    return true;
  }

  function assetTexture(texId, lv) {
    if (!global.document || typeof global.document.createElement !== 'function') return null;
    var key = texId + '|' + [lv.body, lv.belly, lv.stripe, lv.tail].join(',');
    if (_assetTexCache[key]) return _assetTexCache[key];
    var canvas;
    try { canvas = global.document.createElement('canvas'); } catch (e) { return null; }
    if (!canvas || typeof canvas.getContext !== 'function' || !canvas.getContext('2d')) return null;
    canvas.width = canvas.height = 4;
    var tex = new THREE.CanvasTexture(canvas);
    tex.flipY = false;                                  // glTF 的 UV 约定
    tex.encoding = THREE.sRGBEncoding;                  // 涂装颜色按 sRGB 十六进制显示
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    var rec = assetImages(texId, function (r) {
      if (!compositeLivery(r, lv, canvas)) {
        canvas.width = r.base.naturalWidth; canvas.height = r.base.naturalHeight;
        canvas.getContext('2d').drawImage(r.base, 0, 0);
      }
      tex.needsUpdate = true;
      tex.userData.ready = true;
    });
    if (!rec) return null;
    _assetTexCache[key] = tex;
    return tex;
  }

  /* ---------------------------------------------------------------------
     2. 质量档位 (控制径向分段数 / 贴图尺寸 / 细节件)
     --------------------------------------------------------------------- */
  var QUALITY = {
    low: { radial: 10, body: 12, blades: 12, wheel: 8, tex: 512, detail: 0 },
    medium: { radial: 18, body: 22, blades: 20, wheel: 12, tex: 1024, detail: 1 },
    high: { radial: 26, body: 32, blades: 30, wheel: 16, tex: 2048, detail: 2 }
  };
  function qOf(name) { return QUALITY[name] || QUALITY.medium; }

  /* ---------------------------------------------------------------------
     3. 翼型剖面
        返回闭合点列 [[u,v], ...]  u: 0=前缘 1=后缘, v: 厚度方向 (±0.5 为最厚)
     --------------------------------------------------------------------- */
  var _profileCache = {};
  function airfoilProfile(n, camber) {
    var key = n + '_' + camber;
    if (_profileCache[key]) return _profileCache[key];
    var up = [], lo = [], i, u, yt, yc, m = camber, p = 0.4;
    for (i = 0; i <= n; i++) {
      u = 0.5 * (1 - Math.cos(Math.PI * i / n));      // 余弦分布, 前缘加密
      yt = 5 * 0.16 * (0.2969 * Math.sqrt(u) - 0.1260 * u - 0.3516 * u * u +
        0.2843 * u * u * u - 0.1036 * u * u * u * u);
      if (u < p) yc = (m / (p * p)) * (2 * p * u - u * u);
      else yc = (m / ((1 - p) * (1 - p))) * ((1 - 2 * p) + 2 * p * u - u * u);
      up.push([u, yc + yt]);
      lo.push([u, yc - yt]);
    }
    var mx = -1e9, mn = 1e9;
    for (i = 0; i < up.length; i++) { if (up[i][1] > mx) mx = up[i][1]; if (lo[i][1] < mn) mn = lo[i][1]; }
    var k = 1 / Math.max(1e-6, mx - mn);
    var pts = [];
    for (i = 0; i <= n; i++) pts.push([up[i][0], up[i][1] * k]);
    for (i = n - 1; i >= 1; i--) pts.push([lo[i][0], lo[i][1] * k]);
    _profileCache[key] = pts;
    return pts;
  }

  /* ---------------------------------------------------------------------
     4. 放样 (loft): 剖面沿站位列表扫掠成板/翼面
        station = { o:[x,y,z](前缘点), cd:[弦向单位向量], td:[厚度单位向量],
                    chord: 弦长, thick: 最大厚度 }
     --------------------------------------------------------------------- */
  function loftProfile(profile, stations, flip, capStart, capEnd) {
    var P = profile.length, S = stations.length;
    var pos = [], uv = [], idx = [], s, p;
    for (s = 0; s < S; s++) {
      var st = stations[s], o = st.o, cd = st.cd, td = st.td, ch = st.chord, th = st.thick;
      for (p = 0; p < P; p++) {
        var u = profile[p][0], v = profile[p][1];
        pos.push(o[0] + cd[0] * (u * ch) + td[0] * (v * th),
          o[1] + cd[1] * (u * ch) + td[1] * (v * th),
          o[2] + cd[2] * (u * ch) + td[2] * (v * th));
        uv.push(u, v + 0.5);
      }
    }
    for (s = 0; s < S - 1; s++) {
      for (p = 0; p < P; p++) {
        var p2 = (p + 1) % P;
        var a = s * P + p, b = s * P + p2, c = (s + 1) * P + p2, d = (s + 1) * P + p;
        idx.push(a, b, c, a, c, d);
      }
    }
    if (capStart) capProfile(pos, uv, idx, stations[0], P, -1);
    if (capEnd) capProfile(pos, uv, idx, stations[S - 1], P, 1);
    return makeGeo(pos, uv, idx, flip, 0);
  }

  /** 端面封盖 (在站位处插一个中心点做扇形) */
  function capProfile(pos, uv, idx, st, P, dir) {
    var base = pos.length / 3;
    var o = st.o, cd = st.cd;
    pos.push(o[0] + cd[0] * st.chord * 0.3, o[1] + cd[1] * st.chord * 0.3, o[2] + cd[2] * st.chord * 0.3);
    uv.push(0.5, 0.5);
    var want = [cd[0] * dir, cd[1] * dir, cd[2] * dir];
    for (var p = 0; p < P; p++) {
      var a = (dir < 0 ? p + 1 : p) % P, b = (dir < 0 ? p : p + 1) % P;
      pushTri(idx, pos, base, base - P + a, base - P + b, want);
    }
  }

  /* ---------------------------------------------------------------------
     5. 旋转体管壳 (机身 / 短舱): sections 沿 Z 排列
        sec = { z, r, cy, aspect, ry, flat }
        flat: 下半部半径压缩系数 (737 平底机身)
     --------------------------------------------------------------------- */
  function loftTube(sections, radial, uz0, uz1, capA, capB) {
    var N = radial, pos = [], uv = [], idx = [], s, i;
    var useUV = (uz1 !== undefined && uz1 !== uz0);
    for (s = 0; s < sections.length; s++) {
      var sec = sections[s];
      var rx = sec.r * (sec.aspect === undefined ? 1 : sec.aspect);
      var ry = (sec.ry === undefined ? sec.r : sec.ry);
      var flat = (sec.flat === undefined ? 1 : sec.flat);
      for (i = 0; i <= N; i++) {
        var phi = i / N * TAU;
        var sp = Math.sin(phi), cp = Math.cos(phi);
        var y = sec.cy + (cp >= 0 ? ry * cp : ry * flat * cp);
        pos.push(rx * sp, y, sec.z);
        if (useUV) uv.push((sec.z - uz0) / (uz1 - uz0), 1 - i / N);
        else uv.push(i / N, s / Math.max(1, sections.length - 1));
      }
    }
    for (s = 0; s < sections.length - 1; s++) {
      for (i = 0; i < N; i++) {
        var a = s * (N + 1) + i, b = (s + 1) * (N + 1) + i;
        var c = (s + 1) * (N + 1) + i + 1, d = s * (N + 1) + i + 1;
        idx.push(a, b, c, a, c, d);
      }
    }
    if (capA) capRing(pos, uv, idx, 0, N, sections[0], -1);
    if (capB) capRing(pos, uv, idx, (sections.length - 1) * (N + 1), N, sections[sections.length - 1], 1);
    return makeGeo(pos, uv, idx, false, 0);
  }

  function capRing(pos, uv, idx, ringStart, N, sec, dir) {
    var base = pos.length / 3;
    pos.push(0, sec.cy, sec.z);
    uv.push(0.5, 0.5);
    var want = [0, 0, dir];
    for (var i = 0; i < N; i++) {
      pushTri(idx, pos, base, ringStart + i, ringStart + i + 1, want);
    }
  }

  /* ---------------------------------------------------------------------
     6. 空心壳体 (短舱整流罩): 由 [[z, r], ...] 外轮廓生成"外皮+内皮+唇口"
     --------------------------------------------------------------------- */
  function shellLathe(prof, radial, wall) {
    var P = prof.length, N = radial, pos = [], uv = [], idx = [], i, j;
    // 外皮
    for (i = 0; i < P; i++) {
      for (j = 0; j <= N; j++) {
        var phi = j / N * TAU;
        pos.push(prof[i][1] * Math.sin(phi), prof[i][1] * Math.cos(phi), prof[i][0]);
        uv.push(j / N, i / (P - 1));
      }
    }
    // 内皮 (半径向内收缩 wall 形成壁厚)
    for (i = 0; i < P; i++) {
      var ri = Math.max(0.02, prof[i][1] - wall);
      for (j = 0; j <= N; j++) {
        var p2 = j / N * TAU;
        pos.push(ri * Math.sin(p2), ri * Math.cos(p2), prof[i][0]);
        uv.push(j / N, i / (P - 1));
      }
    }
    var inner = P * (N + 1);
    for (i = 0; i < P - 1; i++) {
      for (j = 0; j < N; j++) {
        var a = i * (N + 1) + j, b = (i + 1) * (N + 1) + j;
        var c = (i + 1) * (N + 1) + j + 1, d = i * (N + 1) + j + 1;
        var sx = Math.sin(j / N * TAU), sy = Math.cos(j / N * TAU);
        // 外皮朝外
        pushTri(idx, pos, a, b, c, [sx, sy, 0]);
        pushTri(idx, pos, a, c, d, [sx, sy, 0]);
        // 内皮朝内
        var a2 = inner + a, b2 = inner + b, c2 = inner + c, d2 = inner + d;
        pushTri(idx, pos, a2, b2, c2, [-sx, -sy, 0]);
        pushTri(idx, pos, a2, c2, d2, [-sx, -sy, 0]);
      }
    }
    // 前唇口 (朝 -Z) 与尾端环 (朝 +Z)
    for (j = 0; j < N; j++) {
      pushTri(idx, pos, 0 * (N + 1) + j, 0 * (N + 1) + j + 1, inner + j + 1, [0, 0, -1]);
      pushTri(idx, pos, 0 * (N + 1) + j, inner + j + 1, inner + j, [0, 0, -1]);
      var o = (P - 1) * (N + 1);
      pushTri(idx, pos, o + j, inner + o + j, inner + o + j + 1, [0, 0, 1]);
      pushTri(idx, pos, o + j, inner + o + j + 1, o + j + 1, [0, 0, 1]);
    }
    return makeGeo(pos, uv, idx, false, 0);
  }

  /* ---------------------------------------------------------------------
     7. 机身蒙皮贴图 (程序化绘制: 客舱舷窗 / 舱门 / 腰线 / 蒙皮分块线)
        UV: u = 机身纵向 (0=机头), v = 环向 (1=机背, 0.5=机腹)
     --------------------------------------------------------------------- */
  function drawRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function hexStr(int24) {
    var s = ('000000' + (int24 >>> 0).toString(16)).slice(-6);
    return '#' + s;
  }

  function makeSkinTexture(ac, livery, plan, size) {
    if (!global.document || typeof global.document.createElement !== 'function') return null;
    var canvas;
    try { canvas = global.document.createElement('canvas'); } catch (e) { return null; }
    if (!canvas || typeof canvas.getContext !== 'function') return null;
    var W = size, H = Math.max(64, Math.round(size / 4));
    var ctx = canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx) return null;                       // node 无头环境: 退回纯色材质
    canvas.width = W; canvas.height = H;

    var d = ac.dims;
    var zN = plan.zN, zT = plan.zT, span = zT - zN;
    function zu(z) { return (z - zN) / span * W; }

    // 底色 + 机腹
    ctx.fillStyle = hexStr(livery.body);
    ctx.fillRect(0, 0, W, H);
    var g1 = ctx.createLinearGradient(0, H * 0.30, 0, H * 0.44);
    g1.addColorStop(0, hexStr(livery.body));
    g1.addColorStop(1, hexStr(livery.belly));
    ctx.fillStyle = g1; ctx.fillRect(0, H * 0.30, W, H * 0.14);
    ctx.fillStyle = hexStr(livery.belly); ctx.fillRect(0, H * 0.44, W, H * 0.12);
    var g2 = ctx.createLinearGradient(0, H * 0.56, 0, H * 0.70);
    g2.addColorStop(0, hexStr(livery.belly));
    g2.addColorStop(1, hexStr(livery.body));
    ctx.fillStyle = g2; ctx.fillRect(0, H * 0.56, W, H * 0.14);

    // 客舱段范围
    var doors = d.doorPositions || [];
    var zCabin0 = (doors.length ? doors[0] : plan.zBody0) + 1.2;
    var zCabin1 = (doors.length ? doors[doors.length - 1] : plan.zBody1) - 1.2;
    var x0 = zu(zCabin0), x1 = zu(zCabin1);
    var rows = Math.max(6, d.windowRows || 24);
    var winW = (x1 - x0) / rows * 0.62;
    var winH = H * 0.052;
    var winY = H * 0.175;                         // 右舷舷窗带 (v≈0.19)
    var i;
    ctx.fillStyle = '#101820';
    for (i = 0; i < rows; i++) {
      var wx = x0 + (x1 - x0) * (i + 0.5) / rows - winW * 0.5;
      drawRoundRect(ctx, wx, winY, winW, winH, winW * 0.35); ctx.fill();
      drawRoundRect(ctx, wx, H - winY - winH, winW, winH, winW * 0.35); ctx.fill();
    }
    // 舷窗高光
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (i = 0; i < rows; i += 2) {
      var hx = x0 + (x1 - x0) * (i + 0.5) / rows - winW * 0.5;
      ctx.fillRect(hx + winW * 0.12, winY + winH * 0.15, winW * 0.28, winH * 0.22);
      ctx.fillRect(hx + winW * 0.12, H - winY - winH + winH * 0.15, winW * 0.28, winH * 0.22);
    }

    // 腰线 / 装饰条
    ctx.fillStyle = hexStr(livery.stripe);
    ctx.fillRect(0, H * 0.245, W, Math.max(1, H * 0.012));
    ctx.fillRect(0, H * 0.743, W, Math.max(1, H * 0.012));
    ctx.fillStyle = hexStr(livery.accent);
    ctx.fillRect(0, H * 0.262, W, Math.max(1, H * 0.006));
    ctx.fillRect(0, H * 0.732, W, Math.max(1, H * 0.006));

    // 舱门 (每侧 4 个, 位置取 doorPositions)
    for (i = 0; i < doors.length; i++) {
      var dx = zu(doors[i]);
      var dw = W * 0.016, dh = H * 0.20;
      var dy = winY - H * 0.055;
      ctx.fillStyle = hexStr(livery.belly);
      ctx.fillRect(dx - dw * 0.5, dy, dw, dh);
      ctx.fillRect(dx - dw * 0.5, H - dy - dh, dw, dh);
      ctx.strokeStyle = 'rgba(40,50,60,0.55)';
      ctx.lineWidth = Math.max(1, H * 0.004);
      ctx.strokeRect(dx - dw * 0.5, dy, dw, dh);
      ctx.strokeRect(dx - dw * 0.5, H - dy - dh, dw, dh);
      // 门把手/观察窗
      ctx.fillStyle = '#1a2430';
      ctx.fillRect(dx - dw * 0.16, dy + dh * 0.10, dw * 0.32, dh * 0.06);
      ctx.fillRect(dx - dw * 0.16, H - dy - dh + dh * 0.84, dw * 0.32, dh * 0.06);
    }

    // 货舱门
    ctx.fillStyle = 'rgba(90,100,112,0.75)';
    for (i = 0; i < doors.length; i += 2) {
      var cx = zu(doors[i]) + W * 0.03;
      ctx.fillRect(cx, H * 0.40, W * 0.03, H * 0.06);
      ctx.fillRect(cx, H * 0.54, W * 0.03, H * 0.06);
    }

    // 蒙皮分块线
    ctx.strokeStyle = 'rgba(70,80,92,0.22)';
    ctx.lineWidth = 1;
    var nSeg = 26;
    for (i = 1; i < nSeg; i++) {
      var lx = Math.round(W * i / nSeg) + 0.5;
      ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, H); ctx.stroke();
    }
    for (i = 1; i < 12; i++) {
      var ly = Math.round(H * i / 12) + 0.5;
      ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke();
    }

    // 机头雷达罩 + 风挡"浣熊眼"面罩
    ctx.fillStyle = 'rgba(60,68,78,0.20)';
    ctx.fillRect(0, 0, zu(zN + 2.0), H);
    var isAirbus = (ac.manufacturer === 'Airbus');
    ctx.fillStyle = 'rgba(14,18,24,0.92)';
    if (isAirbus) {
      // 空客式"浣熊面罩": 环绕风挡的一整圈深色带
      var mz0 = zu(zN + 1.2), mz1 = zu(zN + d.noseLength * 0.72);
      ctx.beginPath();
      ctx.moveTo(mz0, H * 0.06);
      ctx.lineTo(mz1, H * 0.10);
      ctx.lineTo(mz1, H * 0.30);
      ctx.lineTo(mz0, H * 0.34);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(mz0, H * 0.94);
      ctx.lineTo(mz1, H * 0.90);
      ctx.lineTo(mz1, H * 0.70);
      ctx.lineTo(mz0, H * 0.66);
      ctx.closePath(); ctx.fill();
    } else {
      var bz0 = zu(zN + 1.5), bz1 = zu(zN + d.noseLength * 0.60);
      ctx.fillRect(bz0, H * 0.09, bz1 - bz0, H * 0.17);
      ctx.fillRect(bz0, H * 0.74, bz1 - bz0, H * 0.17);
    }

    var tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }

  /* ---------------------------------------------------------------------
     8. 灯光灯罩
     --------------------------------------------------------------------- */
  var OFF_COLOR = 0x14181c;
  function makeLamp(colorHex, radius, opt) {
    opt = opt || {};
    var g = new THREE.Group();
    var m = new THREE.MeshBasicMaterial({ color: colorHex, toneMapped: false });
    var lens = new THREE.Mesh(new THREE.SphereGeometry(radius, 6, 4), m);
    if (opt.scale) lens.scale.set(opt.scale[0], opt.scale[1], opt.scale[2]);
    g.add(lens);
    g.userData.mat = m;
    g.userData.onColor = colorHex;
    if (opt.point) {
      var pl = new THREE.PointLight(colorHex, 0, opt.dist || 80, 2);
      g.add(pl);
      g.userData.light = pl;
      g.userData.power = opt.power || 1;
      g.userData.dist = opt.dist || 80;
    }
    return g;
  }

  function setLamp(lamp, on) {
    if (!lamp) return;
    var m = lamp.userData.mat;
    if (m) m.color.setHex(on ? lamp.userData.onColor : OFF_COLOR);
    var pl = lamp.userData.light;
    if (pl) pl.intensity = on ? (lamp.userData.power || 1) : 0;
  }

  /* ---------------------------------------------------------------------
     9. 机型建模计划 (与质量档位无关的几何规划)
     --------------------------------------------------------------------- */
  function makePlan(ac, asset) {
    var d = ac.dims;
    var L = d.length, R = d.fuselageRadius;
    var isWide = ac.class === 'widebody';
    var isBoeingNarrow = (ac.isBoeing && !isWide);

    var zN = -(L * 0.5 - 1.0);                 // 机头顶点
    var zT = zN + L;                           // 尾锥顶点
    var zBody0 = zN + d.noseLength;
    var zBody1 = zT - d.tailConeLength;
    var flatBottom = isBoeingNarrow ? 0.90 : (isWide ? 1.0 : 0.965);
    var ryScale = isWide ? 1.03 : 1.05;

    // ---- 尾部上翘: 顶线基本水平, 半径收缩使中心线上抬 ----
    function tailTop(z) {
      var t = clamp01((z - zBody1) / Math.max(1, zT - zBody1));
      return R * ryScale + 0.05 * (z - zBody1) * (1 - 0.35 * t);
    }

    // 翼展分布
    var isRaked = (d.raked === true) || (d.wingletCant === 0 && d.wingletHeight > 0);
    var cantBase = d.wingletCant || 0;
    var tipRun = isRaked ? d.wingspan * 0.045 : (d.wingletHeight || 0) * 0.40;
    var halfSkin = d.wingspan * 0.5 - tipRun;

    var sweepRad = (d.wingSweep || 30) * DEG;
    var dihRad = (d.wingDihedral || 5) * DEG;
    var flexMaxAngle = 0.14;                   // 翼尖弯折 ~2.5% 全展长

    function chordAt(t) { return lerp(d.wingRootChord, d.wingTipChord, Math.pow(clamp01(t), 0.92)); }
    function leZAt(t) { return Math.tan(sweepRad) * (Math.pow(clamp01(t), 0.94) * d.wingspan * 0.5); }
    function thickRatioAt(t) { return isWide ? lerp(0.145, 0.092, t) : lerp(0.140, 0.102, t); }

    var tB = [0, 0.24, 0.50, 0.75, 1.0];
    /**
     * 机翼链式弯折的前向运动学 (相对翼根前缘)
     * @param {number} t 0=翼根 1=翼尖
     * @param {number} flex 0..1 弯折量
     * @param {number} side +1 右翼 / -1 左翼 (只影响 x 符号, 抬升量两侧相同)
     * @returns {{x:number,y:number,z:number,ang:number}} ang 为局部转角幅值 (乘 side 得绕 Z 角)
     */
    function poseAt(t, flex, side) {
      side = side || 1;
      var x = 0, y = 0, z = 0, ang = 0, i;
      t = clamp01(t);
      for (i = 0; i < 4; i++) {
        var t0 = tB[i], t1 = Math.min(t, tB[i + 1]);
        if (t1 <= t0) break;
        var dt = t1 - t0, ds = dt * halfSkin;
        x += side * ds * Math.cos(ang);
        y += ds * Math.sin(ang);
        z += leZAt(t1) - leZAt(t0);
        ang += dihRad * dt + flexMaxAngle * dt * flex;
      }
      return { x: x, y: y, z: z, ang: ang };
    }

    // ---- 地面线: 由主起落架轮底 / 前起落架轮底 / 发动机离地间隙共同决定 ----
    var gMain = d.gear.main, gNose = d.gear.nose;
    var engR = d.engineNacelleDia * 0.5;
    var tEng = clamp(d.enginePos.x / Math.max(1, halfSkin), 0.05, 0.98);
    var poseEng = poseAt(tEng, 0);
    var wingLowerAtEng = d.wingPos.y + poseEng.y - 0.34 * chordAt(tEng) * thickRatioAt(tEng);
    var engY = wingLowerAtEng - engR - (isWide ? 0.30 : 0.22);   // 短舱上表面贴近机翼下表面
    var engClear = isWide ? 0.60 : (ac.class === 'regional' ? 0.42 : 0.45);
    var groundY = Math.min(gMain.y - gMain.wheelR, gNose.y - gNose.wheelR, engY - engR - engClear);
    if (asset && asset.anchors && asset.anchors.nacelleBottom !== null && asset.anchors.nacelleBottom !== undefined) {
      // 真实外形模型: 地面线由模型短舱最低点 + 同样的离地间隙决定 (起落架为程序化部件,
      // 轮底始终在 groundY 上, main.js 再把 groundY 对齐到飞行动力学的接地点)
      groundY = Math.min(gMain.y - gMain.wheelR, gNose.y - gNose.wheelR,
        asset.anchors.nacelleBottom - engClear);
    }

    // ---- 垂尾/平尾 ----
    var finTaper = 0.36, stabTaper = 0.38;
    var finBase = tailTop(d.finPos.z) - 0.30;
    var finRootChord = 2 * (d.finArea / d.finHeight) / (1 + finTaper);
    var finTipChord = finRootChord * finTaper;
    var stabY = (function () {
      var t = clamp01((d.tailPos.z - zBody1) / Math.max(1, zT - zBody1));
      var r = R * (1 - 0.92 * Math.pow(t, 1.35));
      var cy = tailTop(d.tailPos.z) - r;
      return cy + r * 0.15;
    })();
    var stabHalf = d.tailSpan * 0.5;
    var stabRootChord = 2 * (d.tailArea / d.tailSpan) / (1 + stabTaper);
    var stabTipChord = stabRootChord * stabTaper;

    // ---- 发动机 ----
    var nacelleStart = d.enginePos.z - d.engineNacelleLen * 0.55;

    return {
      ac: ac, d: d, R: R, L: L, isWide: isWide, isRaked: isRaked, isBoeing: !!ac.isBoeing,
      zN: zN, zT: zT, zBody0: zBody0, zBody1: zBody1,
      flatBottom: flatBottom, ryScale: ryScale, tailTop: tailTop,
      halfSkin: halfSkin, tB: tB, dihRad: dihRad, flexMaxAngle: flexMaxAngle,
      chordAt: chordAt, leZAt: leZAt, thickRatioAt: thickRatioAt, poseAt: poseAt,
      wingLowerAtEng: wingLowerAtEng, engY: engY, engR: engR, tEng: tEng, engClear: engClear,
      groundY: groundY, nacelleStart: nacelleStart,
      finBase: finBase, finRootChord: finRootChord, finTipChord: finTipChord, finTaper: finTaper,
      stabY: stabY, stabHalf: stabHalf, stabRootChord: stabRootChord, stabTipChord: stabTipChord,
      stabTaper: stabTaper,
      cockpitZ: zN + d.noseLength * 0.34,
      mainTrunnion: gMain.y + gMain.strutLen,
      noseTrunnion: gNose.y + gNose.strutLen,
      mainAxleY: groundY + gMain.wheelR,
      noseAxleY: groundY + gNose.wheelR
    };
  }

  /* ---------------------------------------------------------------------
     10. 单个机体的构建
     --------------------------------------------------------------------- */
  function buildAircraft(ac, opts, shared) {
    var d = ac.dims;
    var asset = opts.asset || null;
    var plan = makePlan(ac, asset);
    var Q = qOf(opts.quality);
    var parts = {};
    var rig = {};
    var group = new THREE.Group();
    group.name = 'aircraft:' + ac.key;

    /* ---------------- 涂装 ---------------- */
    var lv = {};
    var src = ac.livery || {};
    var o = opts.livery || {};
    var kk;
    for (kk in src) if (src.hasOwnProperty(kk)) lv[kk] = src[kk];
    for (kk in o) if (o.hasOwnProperty(kk) && o[kk] !== undefined) lv[kk] = o[kk];

    /* ---------------- 材质 ---------------- */
    var skinTex = shared.tex || null;
    var matBody = new THREE.MeshStandardMaterial({
      color: skinTex ? 0xffffff : lv.body, map: skinTex,
      metalness: 0.25, roughness: 0.35
    });
    var matWing = new THREE.MeshStandardMaterial({ color: lv.wing, metalness: 0.30, roughness: 0.45 });
    var matTail = new THREE.MeshStandardMaterial({ color: lv.tail, metalness: 0.28, roughness: 0.38 });
    var matStripe = new THREE.MeshStandardMaterial({ color: lv.stripe, metalness: 0.35, roughness: 0.35 });
    var matEngine = new THREE.MeshStandardMaterial({ color: lv.engine, metalness: 0.45, roughness: 0.32 });
    var matMetal = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.85, roughness: 0.30 });
    var matDark = new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.55, roughness: 0.55 });
    var matGear = new THREE.MeshStandardMaterial({ color: lv.gear, metalness: 0.70, roughness: 0.38 });
    var matTire = new THREE.MeshStandardMaterial({ color: 0x1b1e22, metalness: 0.05, roughness: 0.92 });
    var matBrake = new THREE.MeshBasicMaterial({ color: 0x2a1c14 });
    var matGlass = new THREE.MeshPhysicalMaterial({
      color: lv.cockpit, metalness: 0.08, roughness: 0.06,
      transparent: true, opacity: 0.72, side: THREE.DoubleSide
    });
    var matCascade = new THREE.MeshStandardMaterial({
      color: 0x8c9199, metalness: 0.8, roughness: 0.42,
      transparent: true, opacity: 0.9, side: THREE.DoubleSide
    });
    var matExhaust = new THREE.MeshBasicMaterial({ color: 0x30353c, toneMapped: false });
    var matVapour = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false
    });
    var matCabin = new THREE.MeshBasicMaterial({
      color: 0xffe9b0, transparent: true, opacity: 0.85, toneMapped: false, side: THREE.DoubleSide
    });
    var mats = [matBody, matWing, matTail, matStripe, matEngine, matMetal, matDark,
      matGear, matTire, matBrake, matGlass, matCascade, matExhaust, matVapour, matCabin];

    var profWing = airfoilProfile(Q.radial >= 18 ? 14 : 10, 0.024);
    var profFin = airfoilProfile(10, 0.012);

    /* ---------------- 工具: 站位 ---------------- */
    function station(o, chord, thick, cd, td, yOff) {
      return {
        o: [o[0], o[1] + (yOff || 0), o[2]],
        cd: cd || [0, 0, 1], td: td || [0, 1, 0],
        chord: chord, thick: thick
      };
    }

    /* ================================================================
       10.1 机身 (机头 / 中段 / 尾锥 / 翼身整流罩)
       ================================================================ */
    function buildFuselage() {
      var R = plan.R, i, t;
      if (!asset) {
      // --- 机头 ---
      var noseSecs = [], noseN = 7;
      for (i = 0; i <= noseN; i++) {
        t = i / noseN;
        var rr = R * Math.pow(Math.sin(t * Math.PI * 0.5), 0.72) * (1 - 0.06 * (1 - t));
        if (i === 0) rr = R * 0.06;
        noseSecs.push({
          z: lerp(plan.zN, plan.zBody0, t * t * 0.35 + t * 0.65),
          r: rr, cy: -R * 0.05 * (1 - t), ry: rr * (1 - 0.03 * (1 - t)),
          aspect: 1.0, flat: plan.flatBottom
        });
      }
      var gNose = loftTube(noseSecs, Q.body, plan.zN, plan.zT, true, false);
      var nose = new THREE.Mesh(gNose, matBody);
      nose.name = 'nose';
      group.add(nose); parts.nose = nose;

      // --- 中段 (等截面, 轻微鼓形) ---
      var bodySecs = [], bodyN = Q.detail ? 6 : 4;
      for (i = 0; i <= bodyN; i++) {
        t = i / bodyN;
        var bulge = 1 + 0.004 * Math.sin(t * Math.PI);
        bodySecs.push({
          z: lerp(plan.zBody0, plan.zBody1, t), r: R * bulge, cy: 0,
          ry: R * bulge * plan.ryScale, aspect: 1.0, flat: plan.flatBottom
        });
      }
      var gBody = loftTube(bodySecs, Q.body, plan.zN, plan.zT, false, false);
      var body = new THREE.Mesh(gBody, matBody);
      body.name = 'fuselage';
      group.add(body); parts.fuselage = body;

      // --- 尾锥 (上翘) ---
      var tailSecs = [], tailN = Q.detail ? 7 : 5;
      for (i = 0; i <= tailN; i++) {
        t = i / tailN;
        var rt = R * (1 - 0.93 * Math.pow(t, 1.35));
        if (i === tailN) rt = R * 0.10;
        var zz = lerp(plan.zBody1, plan.zT, t);
        // 波音 777 特有的"扁平加宽"尾锥
        var asp = plan.ac.key === 'B777-300ER' ? 1 + 0.22 * smoothstep(t * 1.6) : 1.0;
        tailSecs.push({
          z: zz, r: rt, cy: plan.tailTop(zz) - rt, ry: rt * 0.98,
          aspect: asp, flat: 1.0
        });
      }
      var gTail = loftTube(tailSecs, Q.body, plan.zN, plan.zT, false, true);
      var tailCone = new THREE.Mesh(gTail, matBody);
      tailCone.name = 'tailCone';
      group.add(tailCone); parts.tailCone = tailCone;

      // --- 翼身整流罩 (腹部鼓包) ---
      if (Q.detail) {
        var fSecs = [], fN = 5;
        var fz0 = d.wingPos.z - d.wingRootChord * 0.62;
        var fz1 = d.wingPos.z + d.wingRootChord * 0.72;
        for (i = 0; i <= fN; i++) {
          t = i / fN;
          var shape = Math.sin(Math.PI * clamp01(t)) ;
          fSecs.push({
            z: lerp(fz0, fz1, t),
            r: R * (0.42 + 0.56 * shape), cy: -R * (0.30 + 0.24 * shape),
            ry: R * (0.20 + 0.30 * shape), aspect: 1.05, flat: 1.0
          });
        }
        var fg = loftTube(fSecs, Math.max(8, Q.radial - 4), undefined, undefined, true, true);
        var fairing = new THREE.Mesh(fg, matBody);
        fairing.name = 'bellyFairing';
        group.add(fairing); parts.bellyFairing = fairing;
      }

      }   // !asset

      // --- 客舱灯 (舷窗位置的小发光片, 每侧合并为一个网格) ---
      var cabinN = Q.detail ? 12 : 6;
      var cabin = [], j;
      var doors = d.doorPositions || [-d.length * 0.3, d.length * 0.28];
      var zc0 = doors[0] + 1.0, zc1 = doors[doors.length - 1] - 1.0;
      var lampGeo = new THREE.PlaneGeometry(0.34, 0.22);
      for (j = 0; j < 2; j++) {
        var sgn = j === 0 ? 1 : -1;
        var phi = 63 * DEG * sgn;                 // 与贴图舷窗带 (v≈0.825) 对齐
        var items = [];
        for (i = 0; i < cabinN; i++) {
          var zc = lerp(zc0, zc1, (i + 0.5) / cabinN);
          items.push({
            g: lampGeo,
            m: new THREE.Matrix4().makeTranslation(plan.R * Math.sin(phi) * (asset ? 1.03 : 1.004),
              plan.R * plan.ryScale * Math.cos(phi) * (asset ? 1.03 : 1.004), zc)
              .multiply(new THREE.Matrix4().makeRotationY(sgn > 0 ? Math.PI * 0.5 : -Math.PI * 0.5))
          });
        }
        var lm = new THREE.Mesh(mergeGeos(items), matCabin);
        lm.visible = false;
        group.add(lm);
        cabin.push(lm);
      }
      rig.cabinLamps = cabin;
      parts.lights = parts.lights || {};
      parts.lights.cabin = cabin;

      // --- 客舱门板 (doorOpen > 0 时可见并向外摆开) ---
      var doorList = [], dIdx, sideJ;
      for (dIdx = 0; dIdx < doors.length; dIdx++) {
        for (sideJ = 0; sideJ < 2; sideJ++) {
          var sg = sideJ === 0 ? 1 : -1;
          var pphi = 66 * DEG * sg;
          var dh = 0.95, dw = 1.85;
          var dg = new THREE.Group();
          dg.position.set(plan.R * Math.sin(pphi) * 1.002,
            plan.R * plan.ryScale * Math.cos(pphi) * 1.002, doors[dIdx] - dh * 0.5);
          var panel = new THREE.Mesh(new THREE.BoxGeometry(0.08, dw, dh), matBody);
          panel.position.set(0, 0, dh * 0.5);
          dg.add(panel);
          dg.rotation.order = 'ZYX';
          dg.userData.side = sg;
          dg.userData.outward = { x: dg.position.x, z: dg.position.z };
          dg.visible = false;
          group.add(dg);
          doorList.push(dg);
        }
      }
      rig.doors = doorList;
      parts.doors = doorList;
    }

    /* ================================================================
       10.1b 真实外形模型 (机身+机翼+尾翼+短舱 一个网格, 风扇单独网格)
       ================================================================ */
    function buildAssetBody() {
      var tex = assetTexture(asset.texId, lv);
      var matSkin = new THREE.MeshStandardMaterial({
        map: skinMap, color: 0xffffff,
        metalness: 0.28, roughness: 0.32, side: THREE.FrontSide,
        envMapIntensity: 1.15
      });
      mats.push(matSkin);
      var body = new THREE.Mesh(geoFromPacked(asset.body), matSkin);
      body.name = 'assetBody';
      group.add(body);
      parts.fuselage = body;
      var i;
      for (i = 0; i < asset.fans.length; i++) {
        var f = asset.fans[i];
        var g = new THREE.Group();
        g.name = 'fan' + (f.side > 0 ? 'R' : 'L');
        g.position.set(f.pivot[0], f.pivot[1], f.pivot[2]);
        g.add(new THREE.Mesh(geoFromPacked(f.mesh), matSkin));
        group.add(g);
        rig['fan' + (f.side > 0 ? 'R' : 'L')] = g;
        parts[f.side > 0 ? 'fanR' : 'fanL'] = g;
      }
    }

    /* ================================================================
       10.2 座舱玻璃 + 风挡
       ================================================================ */
    function buildCockpit() {
      var n = d.cockpitWindows || 6;
      var g = new THREE.Group();
      var panesPerSide = Math.ceil(n / 2);
      var geo = new THREE.SphereGeometry(1, 8, 6);
      var i, j;
      for (j = 0; j < 2; j++) {
        var sgn = j === 0 ? 1 : -1;
        for (i = 0; i < panesPerSide; i++) {
          var t = (i + 1) / (panesPerSide + 0.6);
          var z = plan.cockpitZ - 0.9 + i * 1.15;
          var phi = (16 + t * 46) * DEG * sgn;
          var rr = plan.R * (0.72 + 0.26 * (1 - t));
          var m = new THREE.Mesh(geo, matGlass);
          m.position.set(rr * Math.sin(phi), rr * 0.98 * Math.cos(phi) - plan.R * 0.10, z);
          m.scale.set(0.16, 0.42, 0.62);
          m.rotation.z = -phi;
          g.add(m);
        }
      }
      group.add(g);
      parts.cockpitGlass = g;
    }

    /* ================================================================
       10.3 机翼 (链式分段 + 操纵面 + 翼尖)
       ================================================================ */
    function buildWing(side) {
      var root = new THREE.Group();
      root.name = side > 0 ? 'wingR' : 'wingL';
      root.position.set(0, d.wingPos.y, d.wingPos.z - 0.34 * d.wingRootChord);
      var tB = plan.tB, segs = [], i;

      function segStation(t, t0) {
        var c = plan.chordAt(t);
        return station([side * (t - t0) * plan.halfSkin, 0, plan.leZAt(t) - plan.leZAt(t0)],
          c, c * plan.thickRatioAt(t));
      }

      for (i = 0; i < 4; i++) {
        var t0 = tB[i], t1 = tB[i + 1];
        var sg = new THREE.Group();
        var ds = (t1 - t0) * plan.halfSkin;
        var dzz = plan.leZAt(t1) - plan.leZAt(t0);
        if (i === 0) sg.position.set(0, 0, 0);
        else sg.position.set(side * ds, 0, dzz);
        var geo = loftProfile(profWing, [segStation(t0, t0), segStation(t1, t0)],
          side < 0, true, false);
        var mesh = new THREE.Mesh(geo, matWing);
        mesh.name = 'wingSeg' + i;
        sg.add(mesh);
        (i === 0 ? root : segs[i - 1]).add(sg);
        segs.push(sg);
        rig['wingSeg' + (side > 0 ? 'R' : 'L') + i] = sg;
      }
      rig['segs' + (side > 0 ? 'R' : 'L')] = segs;

      /**
       * 生成一个铰链操纵面组。
       * 组原点 = 铰链线 (位于该段前缘之后 edgeOff*弦长 处), 因此 rotation.x
       * 即为绕铰链线的偏转; 板面在弦向 [edgeOff, edgeOff+ratio] 区间内。
       * @param {string} name  组名 (也是 parts 键名来源)
       * @param {number} t0,t1 展向比例区间
       * @param {number} edgeOff 铰链线位置的弦向比例 (0=前缘, 1=后缘; 可为负)
       * @param {number} ratio 板面自身弦长占当地弦长的比例
       * @param {number} thickRatio 板面厚度占其自身弦长的比例
       * @param {number} yOff 距弦平面的垂直偏移 (扰流板置于上表面)
       */
      function ctrlGroup(name, t0, t1, edgeOff, ratio, thickRatio, yOff) {
        var c0 = plan.chordAt(t0), c1 = plan.chordAt(t1);
        var g = new THREE.Group();
        g.name = name;
        g.rotation.order = 'ZYX';                 // 先绕自身 X 铰链偏转, 再按弯折角改姿态
        // beta 0.3 修正: 组原点已经放在铰链线上 (动画里 position.z = hingeZ + pose.z),
        // v0.1 在板面顶点里又加了一次 edgeOff*c0, 导致襟翼/缝翼/副翼整体错位, 看起来"脱离"机翼。
        var st0 = station([0, 0, 0], c0 * ratio, c0 * ratio * thickRatio, [0, 0, 1], [0, 1, 0], yOff);
        var st1 = station([side * (t1 - t0) * plan.halfSkin, 0,
          plan.leZAt(t1) - plan.leZAt(t0) + edgeOff * (c1 - c0)], c1 * ratio, c1 * ratio * thickRatio,
          [0, 0, 1], [0, 1, 0], yOff);
        var geo = loftProfile(profWing, [st0, st1], side < 0, true, true);
        g.add(new THREE.Mesh(geo, matWing));
        g.userData.t0 = t0;
        // 铰链线相对翼根前缘的弦向偏移 (位于本组局部坐标原点)
        g.userData.hingeZ = edgeOff * c0;
        g.userData.edgeOff = edgeOff;
        g.userData.baseY = yOff || 0;
        root.add(g);
        return g;
      }

      // 前缘缝翼 (铰链在前缘, 板面伸向前缘之前 20% 弦长, 放下时前伸下垂)
      ctrlGroup('slat' + (side > 0 ? 'R' : 'L'), 0.09, 0.50, -0.015, 0.17, 0.16, 0);  // beta 0.3: 收起时贴合前缘
      // 后退襟翼 (富勒襟翼: 后缘 26% 弦长)
      ctrlGroup('flap' + (side > 0 ? 'R' : 'L'), 0.05, 0.58, 0.74, 0.26, 0.10, 0);
      // 副翼
      ctrlGroup('aileron' + (side > 0 ? 'R' : 'L'), 0.66, 0.95, 0.76, 0.24, 0.09, 0);

      // 扰流板 (上表面, 数量依 systems.hasSpoilers)
      var nSp = Math.max(3, Math.min(5, Math.round((ac.systems && ac.systems.hasSpoilers || 8) / 2)));
      var spoilers = [], s;
      for (s = 0; s < nSp; s++) {
        var ts0 = 0.13 + s * 0.115, ts1 = ts0 + 0.095;
        if (ts1 > 0.72) break;
        var yUp = 0.5 * plan.chordAt(ts0) * plan.thickRatioAt(ts0) * 0.78;
        spoilers.push(ctrlGroup('spoiler' + (side > 0 ? 'R' : 'L') + s, ts0, ts1, 0.30, 0.28, 0.07, yUp));
      }
      rig['spoilers' + (side > 0 ? 'R' : 'L')] = spoilers;

      // ---- 翼尖装置 (弯刀形翼梢小翼 / 斜削翼尖) ----
      buildTip(root, side);

      group.add(root);
      return root;
    }

    function buildTip(root, side) {
      var g = new THREE.Group();
      g.name = 'tip' + (side > 0 ? 'R' : 'L');
      g.rotation.order = 'ZYX';
      // 几何以本组原点 (t=1 处的前缘点) 为基准, 由 update() 摆放到弯折后的姿态
      var h, run;
      var cantB, cantT, height, chordK, sweepK;
      if (plan.isRaked) {
        // 787 / 777 斜削翼尖: 几乎水平外伸, 轻微上反, 后掠加剧
        cantB = 70; cantT = 78; height = d.wingspan * 0.045; chordK = 0.55; sweepK = 1.35;
      } else if (plan.isBoeing && !plan.isWide) {
        // 737 融合式小翼: 根部平缓过渡, 顶部近乎竖直
        cantB = 15; cantT = 7; height = d.wingletHeight; chordK = 0.88; sweepK = 0.55;
      } else if (plan.isWide) {
        // 空客弯刀形小翼: 根 35° 逐渐立起
        cantB = Math.max(20, plan.d.wingletCant); cantT = 9; height = d.wingletHeight; chordK = 0.62; sweepK = 0.85;
      } else {
        // A320 系列鲨鳍小翼 / E190 小型小翼
        cantB = Math.max(16, plan.d.wingletCant); cantT = 8; height = d.wingletHeight; chordK = 0.78; sweepK = 0.62;
      }
      var N = 4;
      var stations = [], i;
      var cx = 0, cy = 0, cz = 0, cant;
      var tipChord = plan.chordAt(1.0);
      // cant 以"与竖直方向的夹角"度量: 0=竖直向上, 90=完全水平外伸
      for (i = 0; i <= N; i++) {
        var f = i / N;
        cant = lerp(cantB, cantT, Math.pow(f, 1.25)) * DEG;
        if (i > 0) {
          var step = height / N;
          cx += side * Math.sin(cant) * step;
          cy += Math.cos(cant) * step;
          cz += Math.tan(14 * DEG) * step * sweepK;
        }
        var ch = tipChord * lerp(1.0, chordK, Math.pow(f, 0.85));
        var td = [-Math.cos(cant), side * Math.sin(cant), 0];
        stations.push({
          o: [cx, cy, cz],
          cd: [0, 0, 1], td: td, chord: ch, thick: ch * 0.095
        });
      }
      var geo = loftProfile(profWing, stations, side < 0, true, true);
      g.add(new THREE.Mesh(geo, matWing));
      root.add(g);
      parts[side > 0 ? 'wingletR' : 'wingletL'] = g;

      // 小翼根部融合整流 (737/320 风格)
      if (!plan.isRaked && Q.detail) {
        var bg = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), matWing);
        bg.position.set(side * 0.35, 0.15, tipChord * 0.25);
        bg.scale.set(0.9, 0.45, tipChord * 0.45);
        g.add(bg);
      }
      return g;
    }

    /* ================================================================
       10.4 尾翼
       ================================================================ */
    function buildTail() {
      var fz = d.finPos.z, baseY = plan.finBase;
      var finSweep = (d.finSweep || 38) * DEG;
      var finLE = fz - plan.finRootChord * 0.42;
      var N = 3, i, stations = [];
      for (i = 0; i <= N; i++) {
        var f = i / N;
        var y = baseY + d.finHeight * f;
        var ch = lerp(plan.finRootChord, plan.finTipChord, Math.pow(f, 0.9));
        stations.push({
          o: [0, y, finLE + Math.tan(finSweep) * d.finHeight * f],
          cd: [0, 0, 1], td: [1, 0, 0], chord: ch, thick: ch * 0.11
        });
      }
      var finGroup = new THREE.Group();
      // 固定部分 (后缘前 70%)
      var fixStations = [], rudStations = [];
      for (i = 0; i <= N; i++) {
        var s = stations[i];
        fixStations.push({ o: s.o, cd: s.cd, td: s.td, chord: s.chord * 0.30, thick: s.thick });
        rudStations.push({
          o: [0, s.o[1], s.o[2] + s.chord * 0.30], cd: [0, 0, 1], td: [1, 0, 0],
          chord: s.chord * 0.30 * 0.98, thick: s.thick * 0.92
        });
      }
      // 垂尾固定段: 从前缘到 70% 弦
      var mainStations = [];
      for (i = 0; i <= N; i++) {
        var s2 = stations[i];
        mainStations.push({ o: s2.o, cd: s2.cd, td: s2.td, chord: s2.chord * 0.70, thick: s2.thick });
      }
      var finMain = new THREE.Mesh(loftProfile(profFin, mainStations, false, false, false), matTail);
      finGroup.add(finMain);
      parts.fin = finGroup;
      group.add(finGroup);

      // 背鳍 (前缘根部小三角)
      if (Q.detail) {
        var dorsal = new THREE.Mesh(loftProfile(profFin, [
          { o: [0, baseY - 0.45, finLE - plan.finRootChord * 0.30], cd: [0, 0, 1], td: [1, 0, 0], chord: 1.6, thick: 0.22 },
          { o: [0, baseY + d.finHeight * 0.22, finLE + 0.35], cd: [0, 0, 1], td: [1, 0, 0], chord: 1.1, thick: 0.16 }
        ], false, true, true), matTail);
        finGroup.add(dorsal);
      }

      // 方向舵
      var rud = new THREE.Group();
      rud.name = 'rudder';
      rud.position.set(0, baseY, finLE + d.finHeight * 0);
      var rudGeo = loftProfile(profFin, rudStations.map(function (s) {
        return { o: [0, s.o[1] - baseY, s.o[2] - finLE], cd: s.cd, td: s.td, chord: s.chord, thick: s.thick };
      }), false, true, true);
      rud.add(new THREE.Mesh(rudGeo, matTail));
      finGroup.add(rud);
      parts.rudder = rud;

      // 平尾 + 升降舵
      var spos = d.tailPos, sh = plan.stabHalf;
      var stabSweep = (d.tailSweep || 34) * DEG;
      var stLE = spos.z - plan.stabRootChord * 0.40;
      function buildStab(side) {
        var g = new THREE.Group();
        var st = [], i2;
        for (i2 = 0; i2 <= 2; i2++) {
          var f = i2 / 2;
          var ch = lerp(plan.stabRootChord, plan.stabTipChord, f);
          st.push({
            o: [side * sh * f, plan.stabY, stLE + Math.tan(stabSweep) * sh * f],
            cd: [0, 0, 1], td: [0, 1, 0], chord: ch * 0.72, thick: ch * 0.11
          });
        }
        g.add(new THREE.Mesh(loftProfile(profFin, st, side < 0, true, false), matWing));
        // 升降舵
        var eg = new THREE.Group();
        eg.name = 'elevator' + (side > 0 ? 'R' : 'L');
        eg.rotation.order = 'ZYX';
        var est = [], i3;
        for (i3 = 0; i3 <= 2; i3++) {
          var f2 = i3 / 2;
          var ch2 = lerp(plan.stabRootChord, plan.stabTipChord, f2);
          est.push({
            o: [side * sh * f2, plan.stabY, stLE + ch2 * 0.72 + Math.tan(stabSweep) * sh * f2],
            cd: [0, 0, 1], td: [0, 1, 0], chord: ch2 * 0.28, thick: ch2 * 0.10
          });
        }
        eg.add(new THREE.Mesh(loftProfile(profFin, est, side < 0, true, true), matWing));
        g.add(eg);
        return { root: g, elev: eg };
      }
      var sl = buildStab(-1), sr = buildStab(1);
      group.add(sl.root); group.add(sr.root);
      parts.stabL = sl.root; parts.stabR = sr.root;
      parts.elevatorL = sl.elev; parts.elevatorR = sr.elev;
      rig.elevatorL = sl.elev; rig.elevatorR = sr.elev;
    }

    /* ================================================================
       10.5 发动机 (吊挂 + 空心短舱 + 风扇 + 反推)
       ================================================================ */
    function buildEngine(side) {
      var mount = new THREE.Group();
      mount.name = 'engineMount' + (side > 0 ? 'R' : 'L');
      var NL = d.engineNacelleLen, RR = plan.engR;
      mount.position.set(side * d.enginePos.x, plan.engY - d.wingPos.y, d.enginePos.z - (d.wingPos.z - 0.34 * d.wingRootChord));
      var eng = new THREE.Group();
      eng.name = 'engine' + (side > 0 ? 'R' : 'L');
      eng.rotation.x = -2 * DEG;                       // 短舱轻微上仰
      mount.add(eng);

      var zF = -NL * 0.55, zA = NL * 0.45;
      // 外罩轮廓 (z, r): 唇口 - 风扇罩 - 反推段 - 尾喷
      var prof = [
        [zF, RR * 0.93], [zF + NL * 0.03, RR * 1.0], [zF + NL * 0.16, RR * 0.995],
        [zF + NL * 0.34, RR * 0.97], [zF + NL * 0.52, RR * 0.92],
        [zF + NL * 0.74, RR * 0.85], [zA, RR * 0.78]
      ];
      var wall = Math.max(0.05, RR * 0.085);
      // 前段 (固定风扇罩)
      var fixGeo = shellLathe(prof.slice(0, 4), Q.radial + 4, wall);
      eng.add(new THREE.Mesh(fixGeo, matEngine));
      // 后段 (反推移动罩)
      var revGroup = new THREE.Group();
      revGroup.name = 'reverser' + (side > 0 ? 'R' : 'L');
      var revGeo = shellLathe(prof.slice(3), Q.radial + 4, wall);
      revGroup.add(new THREE.Mesh(revGeo, matEngine));
      eng.add(revGroup);
      parts[side > 0 ? 'reverserR' : 'reverserL'] = revGroup;
      rig['reverser' + (side > 0 ? 'R' : 'L')] = { group: revGroup, baseZ: 0, travel: Math.min(0.62, NL * 0.13) };

      // 叶栅 (反推时露出)
      var casc = new THREE.Group();
      var cGeo = new THREE.BoxGeometry(0.10, RR * 0.30, 0.16);
      var nc = 12, cascItems = [], c;
      for (c = 0; c < nc; c++) {
        var ca = c / nc * TAU;
        cascItems.push({
          g: cGeo,
          m: new THREE.Matrix4().makeTranslation(Math.sin(ca) * RR * 0.96, Math.cos(ca) * RR * 0.96, zF + NL * 0.50)
            .multiply(new THREE.Matrix4().makeRotationZ(-ca))
        });
      }
      casc.add(new THREE.Mesh(mergeGeos(cascItems), matCascade));
      casc.visible = false;
      eng.add(casc);
      rig['cascade' + (side > 0 ? 'R' : 'L')] = casc;

      // 风扇 (含整流锥 + 叶片), N1 驱动自转
      var fan = new THREE.Group();
      fan.name = 'fan' + (side > 0 ? 'R' : 'L');
      var fanR = Math.min(RR * 0.97, (ac.engines.fanDiameter || RR * 1.9) * 0.5);
      fan.position.z = zF + NL * 0.10;
      var disc = new THREE.Mesh(new THREE.CircleGeometry(fanR, Q.radial + 4), matDark);
      disc.position.z = 0.02;
      fan.add(disc);
      var bladeGeo = new THREE.BoxGeometry(fanR * 0.42, 0.035, fanR * 0.30);
      var nb = Q.blades, bi, bladeItems = [], rr2 = fanR * 0.60;
      for (bi = 0; bi < nb; bi++) {
        var ba = bi / nb * TAU;
        var bm = new THREE.Matrix4().makeTranslation(Math.cos(ba) * rr2, Math.sin(ba) * rr2, -0.06)
          .multiply(new THREE.Matrix4().makeRotationY(0.55))
          .multiply(new THREE.Matrix4().makeRotationZ(ba));
        bladeItems.push({ g: bladeGeo, m: bm });
      }
      fan.add(new THREE.Mesh(mergeGeos(bladeItems), matMetal));
      var spinner = new THREE.Mesh(new THREE.ConeGeometry(fanR * 0.22, fanR * 0.52, Q.radial),
        new THREE.MeshStandardMaterial({ color: 0xd8dbe0, metalness: 0.6, roughness: 0.3 }));
      spinner.rotation.x = -Math.PI / 2;
      spinner.position.z = -fanR * 0.20;
      fan.add(spinner);
      eng.add(fan);
      parts[side > 0 ? 'fanR' : 'fanL'] = fan;
      parts[side > 0 ? 'spinnerR' : 'spinnerL'] = spinner;

      // 内涵尾喷 (N1 高时发红)
      var ex = new THREE.Mesh(new THREE.ConeGeometry(RR * 0.42, NL * 0.30, Q.radial, 1, true), matExhaust);
      ex.rotation.x = Math.PI / 2;
      ex.position.z = zA - NL * 0.16;
      eng.add(ex);
      ex.userData.mat = matExhaust;
      parts[side > 0 ? 'exhaustR' : 'exhaustL'] = ex;

      // 吊挂 (从短舱顶延伸到机翼下表面; 在吊挂局部坐标系中, 发动机中心为 y=0)
      // beta 0.3 修正: 吊挂是 mount 的子对象, mount 已经平移到发动机位置,
      // v0.1 在这里又加了一次 enginePos.z 偏移, 吊挂因此漂到短舱后方很远处。
      // 现以短舱中心为原点, 吊挂从短舱上方前段一直延伸到机翼前缘之后。
      var mountZ = NL * 0.12;
      var pBotY = RR * 0.88;
      var wingLowLocal = (d.wingPos.y + plan.poseAt(plan.tEng, 0).y) - plan.engY
        - 0.42 * plan.chordAt(plan.tEng) * plan.thickRatioAt(plan.tEng);
      var pTopY = Math.max(pBotY + 0.25, wingLowLocal);
      var pCh = Math.max(1.4, d.pylonLen * 0.55, NL * 0.62);
      function rectProfile() {
        return [[0, 0.5], [0.45, 0.5], [1, 0.28], [1, -0.28], [0.45, -0.5], [0, -0.5]];
      }
      var pylon = new THREE.Mesh(loftProfile(rectProfile(), [
        { o: [0, pBotY, mountZ - pCh * 0.42], cd: [0, 0, 1], td: [1, 0, 0], chord: pCh, thick: 0.42 },
        { o: [0, pBotY + (pTopY - pBotY) * 0.6, mountZ - pCh * 0.30], cd: [0, 0, 1], td: [1, 0, 0], chord: pCh * 0.95, thick: 0.40 },
        { o: [0, pTopY, mountZ - pCh * 0.14], cd: [0, 0, 1], td: [1, 0, 0], chord: pCh * 0.82, thick: 0.36 }
      ], false, true, true), matEngine);
      pylon.name = 'pylon' + (side > 0 ? 'R' : 'L');
      mount.add(pylon);
      parts[side > 0 ? 'pylonR' : 'pylonL'] = pylon;

      parts[side > 0 ? 'engineR' : 'engineL'] = mount;
      rig['fan' + (side > 0 ? 'R' : 'L')] = fan;
      rig['mount' + (side > 0 ? 'R' : 'L')] = mount;
      return mount;
    }

    /* ================================================================
       10.6 起落架
       ================================================================ */
    function buildGear() {
      var a = 0;
      /* --- 机轮 --- */
      function wheel(r, w) {
        var g = new THREE.Group();
        var seg = Q.wheel;
        var tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, seg, 1), matTire);
        tire.rotation.z = Math.PI / 2;
        g.add(tire);
        var hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w * 1.05, Math.max(6, seg - 4), 1), matGear);
        hub.rotation.z = Math.PI / 2;
        g.add(hub);
        // 刹车盘 (共用材质, 由 brakeGlow 统一驱动颜色)
        var brake = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.44, r * 0.44, w * 0.34, 8, 1), matBrake);
        brake.rotation.z = Math.PI / 2;
        g.add(brake);
        return g;
      }

      /* --- 前起落架 --- */
      var gn = d.gear.nose;
      var ng = new THREE.Group();
      ng.name = 'gearNose';
      ng.position.set(0, plan.noseAxleY, gn.z);
      var nStrutLen = Math.max(0.2, gn.strutLen + (gn.y - plan.noseAxleY));
      var nStrut = new THREE.Mesh(new THREE.CylinderGeometry(gn.wheelR * 0.30, gn.wheelR * 0.34, nStrutLen, 8, 1), matGear);
      nStrut.position.y = nStrutLen * 0.5;
      ng.add(nStrut);
      var nOleo = new THREE.Mesh(new THREE.CylinderGeometry(gn.wheelR * 0.40, gn.wheelR * 0.40, nStrutLen * 0.34, 8, 1), matMetal);
      nOleo.position.y = nStrutLen * 0.18;
      ng.add(nOleo);
      var nAxle = new THREE.Mesh(new THREE.CylinderGeometry(gn.wheelR * 0.16, gn.wheelR * 0.16, gn.track * 0.9, 6, 1), matMetal);
      nAxle.rotation.z = Math.PI / 2;
      ng.add(nAxle);
      var wheelsN = [];
      for (a = 0; a < gn.wheels; a++) {
        var sx = (gn.wheels === 1) ? 0 : (a === 0 ? -1 : 1);
        var wh = wheel(gn.wheelR, gn.wheelW);
        wh.position.x = sx * gn.wheelW * 0.62;
        ng.add(wh);
        wheelsN.push(wh);
      }
      // 前轮转弯作动器 (位于轮轴上方)
      var steer = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, gn.wheelR * 1.1), matGear);
      steer.position.set(gn.wheelR * 0.55, nStrutLen * 0.30, 0);
      ng.add(steer);
      group.add(ng);
      parts.gearNose = ng;
      parts.wheelNose = wheelsN;
      rig.gearNose = ng;
      rig.noseBaseY = plan.noseAxleY;
      rig.noseMaxComp = Math.min(0.30, gn.strutLen * 0.12);

      /* --- 主起落架 --- */
      function mainGear(side) {
        var gm = d.gear.main;
        var g = new THREE.Group();
        g.name = 'gearMain' + (side > 0 ? 'R' : 'L');
        g.position.set(side * gm.x, plan.mainAxleY, gm.z);
        var strutLen = Math.max(0.2, gm.strutLen + (gm.y - plan.mainAxleY));
        var st = new THREE.Mesh(new THREE.CylinderGeometry(gm.wheelR * 0.30, gm.wheelR * 0.34, strutLen, 8, 1), matGear);
        st.position.y = strutLen * 0.5;
        g.add(st);
        var oleo = new THREE.Mesh(new THREE.CylinderGeometry(gm.wheelR * 0.40, gm.wheelR * 0.40, strutLen * 0.40, 8, 1), matMetal);
        oleo.position.y = strutLen * 0.20;
        g.add(oleo);
        var side2 = new THREE.Mesh(new THREE.BoxGeometry(0.10, strutLen * 0.5, 0.16), matGear);
        side2.position.set(side * gm.wheelR * 0.34, strutLen * 0.30, 0);
        g.add(side2);

        var wheels = [];
        // 车架 (bogie) 或单轴
        var bogie = new THREE.Group();
        bogie.name = 'bogie';
        g.add(bogie);
        var rows, perRow;
        if (gm.bogie) {
          rows = Math.max(1, Math.round(gm.wheels / 2));
          perRow = Math.min(2, gm.wheels);
        } else {
          rows = 1; perRow = gm.wheels;
        }
        var rowGap = gm.wheelR * 1.30;
        var axles = [];
        for (var ri = 0; ri < rows; ri++) {
          var zz = (ri - (rows - 1) / 2) * rowGap;
          var axle = new THREE.Mesh(new THREE.CylinderGeometry(gm.wheelR * 0.17, gm.wheelR * 0.17,
            perRow * gm.wheelW * 1.5, 6, 1), matMetal);
          axle.rotation.z = Math.PI / 2;
          axle.position.z = zz;
          bogie.add(axle);
          axles.push(axle);
          for (var wi = 0; wi < perRow; wi++) {
            var off = (perRow === 1) ? 0 : (wi === 0 ? -1 : 1) * gm.wheelW * 0.62;
            var w2 = wheel(gm.wheelR, gm.wheelW);
            w2.position.set(off, 0, zz);
            bogie.add(w2);
            wheels.push(w2);
          }
        }
        if (rows > 1) {
          var beam = new THREE.Mesh(new THREE.BoxGeometry(gm.wheelW * 0.5, gm.wheelR * 0.30, rowGap * rows * 0.9), matGear);
          bogie.add(beam);
        }
        group.add(g);
        parts[side > 0 ? 'gearMainR' : 'gearMainL'] = g;
        parts[side > 0 ? 'wheelsMainR' : 'wheelsMainL'] = wheels;
        rig[side > 0 ? 'gearMainR' : 'gearMainL'] = g;
        rig[side > 0 ? 'bogieR' : 'bogieL'] = bogie;
        rig[side > 0 ? 'mainBaseYR' : 'mainBaseYL'] = plan.mainAxleY;
        rig.maxComp = Math.min(0.32, gm.strutLen * 0.12);
        return g;
      }
      mainGear(-1);
      mainGear(1);

      /* --- 起落架舱门 (铰链在机身腹部, 向外下方打开) --- */
      function doorPanel(w, h, dpt) {
        return new THREE.Mesh(new THREE.BoxGeometry(w, h, dpt), matBody);
      }
      // 前起落架舱门 (左右两扇, 铰链在中线)
      var dn = new THREE.Group();
      dn.name = 'gearDoorNose';
      dn.position.set(0, -plan.R * plan.flatBottom * 0.97, gn.z + 0.2);
      var dnw = gn.track * 0.55;
      var dnl = doorPanel(dnw, 0.05, gn.strutLen * 0.60);
      dnl.position.set(-dnw * 0.5, 0, 0);
      var dnr = doorPanel(dnw, 0.05, gn.strutLen * 0.60);
      dnr.position.set(dnw * 0.5, 0, 0);
      dn.add(dnl); dn.add(dnr);
      dn.visible = false;
      group.add(dn);
      parts.gearDoorNose = dn;
      rig.doorNose = dn;
      rig.doorNosePanels = [dnl, dnr];

      function mainDoor(side) {
        var gm = d.gear.main;
        var g = new THREE.Group();
        g.name = 'gearDoor' + (side > 0 ? 'R' : 'L');
        // 铰链在机腹外侧, 门板向内覆盖起落架舱
        g.position.set(side * (gm.x * 0.42), -plan.R * plan.flatBottom * 0.97, gm.z);
        var w = gm.wheelR * 1.6;
        var p = doorPanel(w, 0.06, gm.strutLen * 0.66);
        p.position.set(side * w * 0.5, 0, 0);
        g.add(p);
        g.visible = false;
        group.add(g);
        parts[side > 0 ? 'gearDoorR' : 'gearDoorL'] = g;
        rig[side > 0 ? 'doorR' : 'doorL'] = g;
        return g;
      }
      mainDoor(-1);
      mainDoor(1);
    }

    /* ================================================================
       10.7 灯光
       ================================================================ */
    /**
     * beta 0.3: 从模型实际几何量取灯位锚点 (真实模型与程序化模型通用)。
     * 在静止姿态 (弯折 0, 舵面中立) 下遍历结构网格顶点 (排除起落架/舵面/发动机/灯),
     * 在本组局部坐标 (x 右, y 上, z 向后) 中求:
     *   翼尖外端 (去掉上翘的翼梢小翼, 取主翼平面内最外侧的前缘/后缘点),
     *   尾锥末端, 机翼处机背/机腹, 平尾上表面中段, 翼根前缘。
     */
    function measureAnchors() {
      group.updateMatrixWorld(true);
      var inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
      var EXCL = /gear|wheel|bogie|door|strut|lamp|light|vapour|slat|flap|aileron|spoiler|elevator|rudder|reverser|cascade|fan|spinner|exhaust|engine|pylon|cabin|cockpit/i;
      var P = [], v = new THREE.Vector3(), m4 = new THREE.Matrix4();
      function excluded(o) {
        for (var q = o; q && q !== group; q = q.parent) if (q.name && EXCL.test(q.name)) return true;
        return false;
      }
      var meshes = [];
      group.traverse(function (o) {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || excluded(o)) return;
        meshes.push(o);
        var pa = o.geometry.attributes.position, n = pa.count, step = n > 60000 ? 2 : 1, i;
        m4.multiplyMatrices(inv, o.matrixWorld);
        for (i = 0; i < n; i += step) {
          v.fromBufferAttribute(pa, i).applyMatrix4(m4);
          P.push(v.x, v.y, v.z);
        }
      });
      var N = P.length / 3, i, x, y, z;
      if (N < 50) return null;
      var zMin = 1e9, zMax = -1e9, xMax = -1e9;
      for (i = 0; i < N; i++) {
        z = P[i * 3 + 2]; x = Math.abs(P[i * 3]);
        if (z < zMin) zMin = z; if (z > zMax) zMax = z; if (x > xMax) xMax = x;
      }
      var Lb = zMax - zMin;
      // 机身截面 (机头后 22% 处, 纯机身段)
      var zRef = zMin + 0.22 * Lb, R = 0, yTop = -1e9, yBot = 1e9;
      for (i = 0; i < N; i++) {
        if (Math.abs(P[i * 3 + 2] - zRef) > 0.8) continue;
        x = Math.abs(P[i * 3]); y = P[i * 3 + 1];
        if (x > R) R = x; if (y > yTop) yTop = y; if (y < yBot) yBot = y;
      }
      if (!(R > 0.5)) R = plan.R;
      var yC = (yTop + yBot) / 2;

      // 翼尖: 先用 60%~85% 半展长的下表面拟合主翼平面 (y = a + b|x|), 再排除高出该平面的小翼部分
      var sx = 0, sy = 0, sxx = 0, sxy = 0, cnt = 0, bins = {}, k;
      for (i = 0; i < N; i++) {
        x = Math.abs(P[i * 3]);
        if (x < 0.60 * xMax || x > 0.85 * xMax) continue;
        k = Math.round(x / 0.5);
        y = P[i * 3 + 1];
        if (bins[k] === undefined || y < bins[k][1]) bins[k] = [x, y];
      }
      for (k in bins) if (bins.hasOwnProperty(k)) {
        x = bins[k][0]; y = bins[k][1]; sx += x; sy += y; sxx += x * x; sxy += x * y; cnt++;
      }
      var fb = cnt > 2 ? (cnt * sxy - sx * sy) / Math.max(1e-6, cnt * sxx - sx * sx) : 0;
      var fa = cnt > 0 ? (sy - fb * sx) / cnt : yC;
      function tipFor(side) {
        var best = -1e9, j, ok = [];
        for (j = 0; j < N; j++) {
          x = P[j * 3] * side; if (x < 0.8 * xMax) continue;
          y = P[j * 3 + 1];
          if (y > fa + fb * x + 0.9) continue;          // 小翼上翘段不算
          ok.push(j); if (x > best) best = x;
        }
        // 外端 0.45 m 窗口内: 最前点 = 翼尖前缘, 最后点 = 翼尖后缘 (各自保留真实 x/y, 斜削翼尖也贴合)
        var le = null, te = null, yLo = 1e9, yHi = -1e9;
        for (j = 0; j < ok.length; j++) {
          var q = ok[j]; if (P[q * 3] * side < best - 0.45) continue;
          z = P[q * 3 + 2]; y = P[q * 3 + 1];
          if (!le || z < le[2]) le = [P[q * 3], y, z];
          if (!te || z > te[2]) te = [P[q * 3], y, z];
          if (y < yLo) yLo = y; if (y > yHi) yHi = y;
        }
        return { x: side * best, y: (yLo + yHi) / 2, zLE: le[2], zTE: te[2], le: le, te: te };
      }
      var tR = tipFor(1), tL = tipFor(-1);

      // 尾锥末端 (中线附近, 排除垂尾: y 不高于机身中心 + 1.1R)
      var tc = { y: yC, z: zMax };
      var tzBest = -1e9;
      for (i = 0; i < N; i++) {
        if (Math.abs(P[i * 3]) > 0.5) continue;
        y = P[i * 3 + 1]; z = P[i * 3 + 2];
        if (y > yC + 1.1 * R) continue;
        if (z > tzBest) { tzBest = z; tc.y = y; tc.z = z; }
      }
      // 尾锥末端附近的截面中心
      var ty0 = 1e9, ty1 = -1e9;
      for (i = 0; i < N; i++) {
        if (Math.abs(P[i * 3]) > 0.6 || P[i * 3 + 2] < tc.z - 0.5) continue;
        y = P[i * 3 + 1]; if (y > yC + 1.1 * R) continue;
        if (y < ty0) ty0 = y; if (y > ty1) ty1 = y;
      }
      if (ty1 > ty0) tc.y = (ty0 + ty1) / 2;

      // 机翼中部站位 (翼根弦中点) 的机背/机腹
      var rootLE = 1e9, rootTE = -1e9, rootY = 0, rc = 0;
      for (i = 0; i < N; i++) {
        x = Math.abs(P[i * 3]);
        if (x < R + 0.6 || x > R + 1.6) continue;
        y = P[i * 3 + 1]; if (y > yC) continue;           // 下单翼
        z = P[i * 3 + 2]; if (z < zMin + 0.15 * Lb || z > zMin + 0.75 * Lb) continue;
        if (z < rootLE) { rootLE = z; rootY = y; }
        if (z > rootTE) rootTE = z;
        rc++;
      }
      if (!rc) { rootLE = d.wingPos.z - d.wingRootChord * 0.62; rootTE = rootLE + d.wingRootChord; rootY = d.wingPos.y; }
      var zW = (rootLE + rootTE) / 2;
      // 竖直射线求表面 (低面数真实模型的顶点稀疏, 用顶点窗口不可靠)
      var rc0 = new THREE.Raycaster(), gw = group.matrixWorld;
      function surfY(xx, zz, top, yLimit) {
        var o = new THREE.Vector3(xx, top ? 200 : -200, zz).applyMatrix4(gw);
        var t = new THREE.Vector3(xx, top ? -200 : 200, zz).applyMatrix4(gw);
        rc0.set(o, t.sub(o).normalize()); rc0.far = 1000;
        var hits = rc0.intersectObjects(meshes, false), best = null, j;
        for (j = 0; j < hits.length; j++) {
          var hp = hits[j].point.clone().applyMatrix4(inv);
          if (top) { if (yLimit === undefined || hp.y > yLimit) { best = hp.y; break; } }
          else if (hp.y < yLimit && (best === null || hp.y > best)) best = hp.y;   // 机腹 (跳过起落架)
        }
        return best;
      }
      function bodyY(zc, dz, top) {
        var ry = surfY(0, zc, top, top ? undefined : yC);
        if (ry !== null) return ry;
        var r = top ? -1e9 : 1e9, j;
        for (j = 0; j < N; j++) {
          if (Math.abs(P[j * 3]) > 0.35 || Math.abs(P[j * 3 + 2] - zc) > dz) continue;
          y = P[j * 3 + 1];
          if (top ? y > r : y < r) r = y;
        }
        if (r > -1e8 && r < 1e8) return r;
        return dz < 3 ? bodyY(zc, dz * 2.5, top) : (top ? yC + R : yC - R);
      }
      var bTopZ = zW - 0.5, bBotZ = rootTE + 1.0;
      var bTopY = bodyY(bTopZ, 0.6, true), bBotY = bodyY(bBotZ, 0.6, false);

      // 平尾: 尾部 25% 机身内, |x| > 1.3R 的点 (垂尾在中线, 不会被选中)
      var stX = 0, sPts = [];
      for (i = 0; i < N; i++) {
        z = P[i * 3 + 2]; if (z < zMax - 0.25 * Lb) continue;
        x = Math.abs(P[i * 3]); if (x < 1.3 * R) continue;
        if (P[i * 3 + 1] > yC + 2.0 * R) continue;        // T 尾以外的普通平尾
        sPts.push(i); if (x > stX) stX = x;
      }
      var logo = null;
      if (sPts.length > 6 && stX > 2 * R) {
        // 低面数模型在展向中段可能没有顶点, 因此取根部/翼尖两个站位再线性插值
        var xr = 1e9, kk, q2;
        for (kk = 0; kk < sPts.length; kk++) { x = Math.abs(P[sPts[kk] * 3]); if (x < xr) xr = x; }
        var stn = function (x0, x1) {
          var o = { le: 1e9, te: -1e9, top: -1e9 };
          for (var j = 0; j < sPts.length; j++) {
            q2 = sPts[j]; var ax = Math.abs(P[q2 * 3]); if (ax < x0 || ax > x1) continue;
            var yy = P[q2 * 3 + 1], zz = P[q2 * 3 + 2];
            if (zz < o.le) o.le = zz; if (zz > o.te) o.te = zz; if (yy > o.top) o.top = yy;
          }
          return o;
        };
        var st2 = stn(stX - Math.max(0.5, 0.06 * (stX - xr)), stX);
        if (st2.top > -1e8) {
          // 低面数模型的平尾往往只有根部 (藏在机身内) 和翼尖两排顶点, 所以在 30% 展长处
          // 沿弦向打一排竖直射线, 直接求该站位的前缘/后缘与上表面
          var xr2 = 0.6 * R, lx = xr2 + 0.30 * (stX - xr2);
          var zs = zMax - 0.30 * Lb, zFirst = null, zLast = null, yAt = null, zz2;
          for (zz2 = zs; zz2 <= zMax; zz2 += 0.15) {
            var hy = surfY(lx, zz2, true);
            if (hy === null || Math.abs(hy - st2.top) > 2.5) continue;
            if (zFirst === null) zFirst = zz2;
            zLast = zz2;
          }
          if (zFirst !== null) {
            var lz = zFirst + 0.30 * (zLast - zFirst);
            yAt = surfY(lx, lz, true);
            if (yAt !== null) logo = { x: lx, y: yAt, z: lz, span: stX, le: zFirst, te: zLast };
          }
        }
      }
      // 翼根前缘附近机身侧面 (机翼照明灯) 半宽
      var sideX = 0;
      for (i = 0; i < N; i++) {
        if (Math.abs(P[i * 3 + 2] - (rootLE - 1.2)) > 0.5) continue;
        if (Math.abs(P[i * 3 + 1] - (rootY + 1.0)) > 0.4) continue;
        x = Math.abs(P[i * 3]); if (x > sideX && x < 1.3 * R) sideX = x;
      }
      return {
        R: R, yC: yC, tipR: tR, tipL: tL, tail: tc,
        beaconTop: { y: bTopY, z: bTopZ }, beaconBot: { y: bBotY, z: bBotZ },
        rootLE: rootLE, rootY: rootY, logo: logo, sideX: sideX || R
      };
    }

    function buildLights() {
      var L2 = parts.lights = parts.lights || {};
      var lampList = [];
      function reg(lamp, key) { lampList.push({ g: lamp, key: key }); return lamp; }
      var M = null;
      try { M = measureAnchors(); } catch (e) { M = null; }
      var A = asset && asset.anchors;
      if (!M) {
        // 兜底: 旧版计划值 (仅在几何测量失败时使用)
        var tp = plan.poseAt(1.0, 0), tz = d.wingPos.z - 0.34 * d.wingRootChord + tp.z;
        var tx = A ? A.tipR[0] : plan.halfSkin, ty = A ? A.tipR[1] : d.wingPos.y + tp.y;
        M = {
          R: plan.R, yC: 0,
          tipR: { x: tx, y: ty, zLE: A ? A.tipR[2] - 0.6 : tz, zTE: A ? A.tipR[2] + 1.0 : tz + plan.chordAt(1) },
          tipL: { x: -tx, y: ty, zLE: A ? A.tipR[2] - 0.6 : tz, zTE: A ? A.tipR[2] + 1.0 : tz + plan.chordAt(1) },
          tail: { y: A ? A.tail[1] : 0, z: A ? A.tail[2] : plan.zT },
          beaconTop: { y: A ? A.bodyTopAtWing : plan.R, z: d.wingPos.z - 3 },
          beaconBot: { y: A ? A.bodyBotAtWing : -plan.R, z: d.wingPos.z + 2.4 },
          rootLE: d.wingPos.z - d.wingRootChord * 0.62, rootY: d.wingPos.y, logo: null, sideX: plan.R
        };
      }
      rig.anchors = M;
      // 后航行灯样式: 空客/C919 在尾锥, 波音/E190 在两侧翼尖后缘
      var aftOnTips = !!ac.isBoeing || /^E1/.test(ac.key || '');
      var hasTailStrobe = true;   // 各型尾锥均有白色频闪

      function at(lamp, x, y, z) { lamp.position.set(x, y, z); group.add(lamp); return lamp; }
      var tR = M.tipR, tL = M.tipL;
      function tipPts(t, side) {
        var le = t.le || [t.x, t.y, t.zLE], te = t.te || [t.x, t.y, t.zTE];
        var chord = te[2] - le[2], ym = t.y;
        var nav = [le[0] + side * 0.08, ym, le[2] + Math.min(0.5, 0.30 * chord)];
        var f = 0.55, str = [le[0] + (te[0] - le[0]) * f + side * 0.08, ym, le[2] + chord * f];
        var aft = [te[0] + side * 0.04, ym, te[2] + 0.05];
        return { nav: nav, str: str, aft: aft };
      }
      var pR = tipPts(tR, 1), pL = tipPts(tL, -1);
      function atA(lamp, a3) { return at(lamp, a3[0], a3[1], a3[2]); }

      // 航行灯: 左翼尖红, 右翼尖绿 (翼尖前缘外端)
      L2.navL = atA(reg(makeLamp(0xff2b2b, 0.16, { scale: [1, 1, 1.6] }), 'nav'), pL.nav);
      L2.navR = atA(reg(makeLamp(0x2bff5a, 0.16, { scale: [1, 1, 1.6] }), 'nav'), pR.nav);

      // 频闪灯: 两侧翼尖
      L2.strobeL = atA(reg(makeLamp(0xffffff, 0.18, {}), 'strobe'), pL.str);
      L2.strobeR = atA(reg(makeLamp(0xffffff, 0.18, {}), 'strobe'), pR.str);

      // 白色后航行灯
      if (aftOnTips) {
        L2.navTail = atA(reg(makeLamp(0xffffff, 0.13, {}), 'nav'), pL.aft);
        L2.navTailR = atA(reg(makeLamp(0xffffff, 0.13, {}), 'nav'), pR.aft);
      } else {
        L2.navTail = at(reg(makeLamp(0xffffff, 0.13, {}), 'nav'), 0, M.tail.y + 0.12, M.tail.z + 0.05);
      }
      // 尾锥白色频闪
      if (hasTailStrobe) {
        L2.strobeTail = at(reg(makeLamp(0xffffff, 0.18, {}), 'strobe'), 0, M.tail.y - (aftOnTips ? 0 : 0.14), M.tail.z + 0.05);
      }

      // 红色防撞灯: 机背 / 机腹 (机翼站位)
      L2.beaconTop = at(reg(makeLamp(0xff3020, 0.20, { point: Q.detail > 0, power: 1.0, dist: 90 }), 'beacon'), 0, M.beaconTop.y + 0.10, M.beaconTop.z);
      L2.beaconBottom = at(reg(makeLamp(0xff3020, 0.18, {}), 'beacon'), 0, M.beaconBot.y - 0.10, M.beaconBot.z);

      // 着陆灯: 翼根前缘下方 (两侧)
      var lx = M.R + 1.1, lz = M.rootLE + 0.55, ly = M.rootY - 0.12;
      L2.landingL = at(reg(makeLamp(0xfff6e0, 0.22, { point: Q.detail > 0, power: 2.6, dist: 300, scale: [1, 1, 1.2] }), 'landing'), -lx, ly, lz);
      L2.landingR = at(reg(makeLamp(0xfff6e0, 0.22, { point: Q.detail > 0, power: 2.6, dist: 300, scale: [1, 1, 1.2] }), 'landing'), lx, ly, lz);

      // 滑行灯: 前起落架支柱上 (挂到前起落架组, 随之收放)
      var taxi = reg(makeLamp(0xfff4d8, 0.16, { point: Q.detail > 0, power: 1.6, dist: 140 }), 'taxi');
      var tpos = new THREE.Vector3(0, plan.noseAxleY + 0.55, d.gear.nose.z - 0.30);
      if (rig.gearNose) {
        group.updateMatrixWorld(true);
        var wp = tpos.clone().applyMatrix4(group.matrixWorld);
        rig.gearNose.worldToLocal(wp);
        taxi.position.copy(wp);
        rig.gearNose.add(taxi);
      } else at(taxi, tpos.x, tpos.y, tpos.z);
      L2.taxi = taxi;

      // 标志灯: 平尾上表面 (两侧, 照向垂尾)
      if (M.logo) {
        L2.logo = at(reg(makeLamp(0xfff0d0, 0.12, {}), 'logo'), M.logo.x, M.logo.y + 0.06, M.logo.z);
        L2.logoL = at(reg(makeLamp(0xfff0d0, 0.12, {}), 'logo'), -M.logo.x, M.logo.y + 0.06, M.logo.z);
      }

      // 机翼照明灯 (翼根前方机身两侧, 照亮机翼前缘)
      var wy = M.rootY + 1.0, wz = M.rootLE - 1.2, wx = M.sideX + 0.04;
      L2.wingL = at(reg(makeLamp(0xfff2dc, 0.11, {}), 'wing'), -wx, wy, wz);
      L2.wingR = at(reg(makeLamp(0xfff2dc, 0.11, {}), 'wing'), wx, wy, wz);

      rig.lampList = lampList;
    }

    /* ================================================================
       10.8 拖尾凝结云 (高马赫数)
       ================================================================ */
    function buildVapour() {
      var g = new THREE.Group();
      var geo = new THREE.ConeGeometry(0.55, 3.2, 8, 1, true);
      var i;
      for (i = 0; i < 2; i++) {
        var side = i === 0 ? 1 : -1;
        var m = new THREE.Mesh(geo, matVapour);
        m.rotation.x = -Math.PI / 2;
        var pose = plan.poseAt(0.34, 0);
        m.position.set(side * 0.34 * plan.halfSkin, d.wingPos.y + pose.y - 0.5, d.wingPos.z + pose.z + plan.chordAt(0.34) * 0.4);
        m.rotation.z = Math.PI;
        g.add(m);
      }
      group.add(g);
      rig.vapour = g;
      rig.vapourMats = [matVapour];
    }

    /* ================================================================
       10.9 组装
       ================================================================ */
    function clearGroup() {
      var i;
      while (group.children.length) {
        var c = group.children.pop();
        c.traverse(function (o) {
          if (o.isMesh) {
            if (o.geometry && o.geometry.dispose) o.geometry.dispose();
            if (o.material && mats.indexOf(o.material) < 0 && o.material.dispose) o.material.dispose();
          }
        });
        group.remove(c);
      }
      for (i in rig) if (rig.hasOwnProperty(i)) delete rig[i];
      for (i in parts) if (parts.hasOwnProperty(i)) parts[i] = undefined;
    }

    function build() {
      parts.lights = {};
      buildFuselage();
      if (asset) {
        // 真实外形模型: 舵面/缝翼/襟翼/扰流板/反推/机翼弯折为静态 (模型为整体网格)
        buildAssetBody();
      } else {
        buildCockpit();
        parts.wingL = buildWing(-1);
        parts.wingR = buildWing(1);
        buildTail();
        buildEngine(-1);
        buildEngine(1);
        // 发动机吊挂在机翼根组之下, 从而随弯折一起运动
        if (rig.mountL && parts.wingL) parts.wingL.add(rig.mountL);
        if (rig.mountR && parts.wingR) parts.wingR.add(rig.mountR);
      }
      buildGear();

      // 操纵面引用 (避免每帧 getObjectByName 遍历场景树)
      var byName = function (n) { return group.getObjectByName(n) || null; };
      parts.slatL = byName('slatL');
      parts.slatR = byName('slatR');
      parts.flapL = byName('flapL');
      parts.flapR = byName('flapR');
      parts.aileronL = byName('aileronL');
      parts.aileronR = byName('aileronR');
      parts.spoilerL = rig.spoilersL || [];
      parts.spoilerR = rig.spoilersR || [];
      rig.ctrlL = [parts.slatL, parts.flapL, parts.aileronL];
      rig.ctrlR = [parts.slatR, parts.flapR, parts.aileronR];
      rig.tipL = byName('tipL');
      rig.tipR = byName('tipR');
      rig.wheelList = [].concat(parts.wheelNose || [], parts.wheelsMainL || [], parts.wheelsMainR || []);
      // 先摆到静止姿态 (翼尖/舵面就位), 再按实际几何量取灯位
      try { update(1 / 60, { gearPos: 1 }); } catch (e) { /* ignore */ }
      buildLights();
      buildVapour();

      // 阴影
      group.traverse(function (o) {
        if (o.isMesh) {
          o.castShadow = !!opts.shadows;
          o.receiveShadow = !!opts.shadows;
        }
      });
    }

    /* ================================================================
       11. 运行时状态与 update
       ================================================================ */
    var st = {
      elevator: 0, aileron: 0, rudder: 0, elevatorTrim: 0,
      flap: 0, slat: 0, spoiler: 0, speedbrake: 0,
      gear: 0, reverser: 0, n1L: 0, n1R: 0,
      fanL: 0, fanR: 0, wheelAngle: 0, flex: 0, comp: 0, brake: 0,
      door: 0, time: 0
    };
    var lightsOn = {
      landing: false, taxi: false, runwayTurnoff: false, strobe: false,
      beacon: false, nav: false, logo: false, wing: false, cabin: false
    };

    /** 频闪灯: 每 1.2s 双脉冲 */
    function strobePulse(t) {
      var p = t % 1.2;
      return (p < 0.05) || (p > 0.14 && p < 0.19);
    }
    /** 防撞灯: 约 40 次/分 (周期 1.5s) */
    function beaconPulse(t) {
      var p = t % 1.5;
      return p < 0.14;
    }

    function applyLights(now) {
      var list = rig.lampList || [], i;
      var strobe = lightsOn.strobe && strobePulse(now);
      var beacon = lightsOn.beacon && beaconPulse(now);
      for (i = 0; i < list.length; i++) {
        var key = list[i].key, on;
        if (key === 'strobe') on = strobe;
        else if (key === 'beacon') on = beacon;
        else on = !!lightsOn[key];
        setLamp(list[i].g, on);
      }
      var cab = parts.lights && parts.lights.cabin;
      if (cab) {
        for (i = 0; i < cab.length; i++) cab[i].visible = !!lightsOn.cabin;
        if (lightsOn.cabin) matCabin.opacity = 0.75 + 0.20 * Math.sin(now * 2.2);
      }
      if (rig.vapour) rig.vapour.visible = true;
    }

    /**
     * 每帧更新
     * 舵面符号约定 (与 state 文档一致):
     *   elevator +1 => 升降舵后缘向下 (机头下俯)
     *   aileron  +1 => 右滚指令 (右副翼上偏 / 左副翼下偏)
     *   rudder   +1 => 机头右偏 (方向舵后缘向左)
     */
    function update(dt, state) {
      state = state || {};
      if (!(dt > 0)) dt = 1 / 60;
      if (dt > 0.25) dt = 0.25;
      var k;

      // --- 光照开关 (state.lights 优先) ---
      if (state.lights) {
        for (k in lightsOn) if (lightsOn.hasOwnProperty(k)) {
          if (state.lights[k] !== undefined) lightsOn[k] = !!state.lights[k];
        }
      }
      st.time = (state.time !== undefined ? state.time : st.time + dt);

      // --- 舵面限速趋近 ---
      st.elevator = U.moveTowards(st.elevator, clamp(state.elevator || 0, -1, 1), 2.2 * dt);
      st.aileron = U.moveTowards(st.aileron, clamp(state.aileron || 0, -1, 1), 3.0 * dt);
      st.rudder = U.moveTowards(st.rudder, clamp(state.rudder || 0, -1, 1), 2.0 * dt);
      var trim = clamp(state.elevatorTrim || 0, -1, 1);
      var flapTarget = clamp01(state.flapPos || 0);
      var slatTarget = (state.slatPos !== undefined ? clamp01(state.slatPos) : flapTarget);
      st.flap = U.moveTowards(st.flap, flapTarget, 0.16 * dt);
      st.slat = U.moveTowards(st.slat, slatTarget, 0.22 * dt);
      var spTarget = clamp01(state.spoilerPos || 0);
      var sb = clamp01(state.speedbrake || 0);
      if (sb > spTarget) spTarget = sb;
      st.spoiler = U.moveTowards(st.spoiler, spTarget, 1.4 * dt);
      st.reverser = U.moveTowards(st.reverser, clamp01(state.reverserPos || 0), 0.8 * dt);
      st.door = U.damp(st.door, clamp01(state.doorOpen || 0), 0.4, dt);
      st.brake = clamp01(state.brakeGlow || 0);
      st.flex = clamp01(state.wingFlex || 0);
      st.comp = clamp01(state.gearCompression || 0);

      // --- 机翼弯折 + 操纵面跟随 ---
      var side, segs, i, pose;
      var fowler = plan.chordAt(0.30) * 0.11;      // 富勒襟翼后退量
      var slatFwd = plan.chordAt(0.30) * 0.06;     // 缝翼前伸量
      var slatAng = -26 * DEG * st.slat;
      var flapAng = 38 * DEG * st.flap;
      var ailAng = 22 * DEG * st.aileron;
      var spAng = -50 * DEG * st.spoiler;          // 扰流板仅上表面向上偏转

      for (side = -1; side <= 1; side += 2) {
        var sfx = side > 0 ? 'R' : 'L';
        // 链式分段: 上反 + 弯折
        segs = rig['segs' + sfx] || [];
        var tB = plan.tB;
        for (i = 0; i < segs.length; i++) {
          var share = tB[i + 1] - tB[i];
          segs[i].rotation.z = side * (plan.dihRad * share + plan.flexMaxAngle * share * st.flex);
        }
        // 操纵面: 铰链线跟随弯折后的机翼姿态
        var ctrls = (side > 0 ? rig.ctrlR : rig.ctrlL) || [];
        for (i = 0; i < ctrls.length; i++) {
          if (!ctrls[i]) continue;
          pose = plan.poseAt(ctrls[i].userData.t0, st.flex, side);
          ctrls[i].position.set(pose.x, pose.y, ctrls[i].userData.hingeZ + pose.z);
          ctrls[i].rotation.z = side * pose.ang;
        }
        var slatG = ctrls[0], flapG = ctrls[1], ailG = ctrls[2];
        if (slatG) {
          slatG.rotation.x = slatAng;
          slatG.position.z -= slatFwd * st.slat;                 // 前伸 + 下垂
        }
        if (flapG) {
          flapG.rotation.x = flapAng;
          flapG.position.z += fowler * st.flap;                  // 后退襟翼
          flapG.position.y -= 0.10 * fowler * st.flap;
        }
        if (ailG) ailG.rotation.x = (side > 0 ? -1 : 1) * ailAng; // +1 = 右滚

        // 扰流板 (上表面铰链, 向上展开)
        var sps = rig['spoilers' + sfx] || [];
        for (i = 0; i < sps.length; i++) {
          pose = plan.poseAt(sps[i].userData.t0 + 0.045, st.flex, side);
          sps[i].position.set(pose.x, pose.y + sps[i].userData.baseY, sps[i].userData.hingeZ + pose.z);
          sps[i].rotation.z = side * pose.ang;
          sps[i].rotation.x = spAng;
        }
        // 翼尖装置随动
        var tip = side > 0 ? rig.tipR : rig.tipL;
        if (tip) {
          pose = plan.poseAt(1.0, st.flex, side);
          tip.position.set(pose.x, pose.y, pose.z);
          tip.rotation.z = side * pose.ang;
        }
        // 发动机随动 (随弯折抬升/翻转)
        var mount = rig['mount' + sfx];
        if (mount) {
          var pe = plan.poseAt(plan.tEng, st.flex);
          mount.position.y = (plan.engY - d.wingPos.y) + pe.y - plan.poseAt(plan.tEng, 0).y;
          mount.rotation.z = side * pe.ang;
        }
      }

      // 升降舵 (含配平) — 后缘向下为正
      var elAng = 24 * DEG * clamp(st.elevator + trim * 0.6, -1.2, 1.2);
      if (rig.elevatorL) rig.elevatorL.rotation.x = elAng;
      if (rig.elevatorR) rig.elevatorR.rotation.x = elAng;
      // 方向舵: +1 = 机头右偏 => 后缘向左 => 绕 Y 负向
      if (parts.rudder) parts.rudder.rotation.y = -26 * DEG * clamp(st.rudder, -1, 1);

      // --- 起落架收放时序 ---
      var gp = clamp01(state.gearPos === undefined ? 1 : state.gearPos);
      // 舱门: gp 0..0.25 开启, 0.75..1 关闭 (纯位置映射, 因此无论伸出还是收起
      // 都是"门先开 -> 起落架运动 -> 门后关")
      var doorOpen = Math.min(smoothstep(gp * 4), smoothstep((1 - gp) * 4));
      var gearDown = smoothstep((gp - 0.25) / 0.5);
      var stow = 1 - gearDown;                    // 0 = 放下锁定, 1 = 完全收起
      if (rig.gearNose) {
        rig.gearNose.rotation.x = -1.35 * stow;                   // 前起落架向前收起
        rig.gearNose.position.y = rig.noseBaseY + st.comp * rig.noseMaxComp;
        rig.gearNose.visible = (stow < 0.98 || doorOpen > 0.02);
      }
      var mg;
      for (side = -1; side <= 1; side += 2) {
        var key = side > 0 ? 'gearMainR' : 'gearMainL';
        mg = rig[key];
        if (mg) {
          mg.rotation.z = -side * 1.42 * stow;                    // 主起落架向内收起
          mg.rotation.x = 0.42 * stow;                            // 并向后收
          mg.position.y = rig[side > 0 ? 'mainBaseYR' : 'mainBaseYL'] + st.comp * rig.maxComp;
          mg.visible = (stow < 0.98 || doorOpen > 0.02);
          var bg = rig[side > 0 ? 'bogieR' : 'bogieL'];
          if (bg) bg.rotation.x = (state.onGround ? 0.035 : 0.0) + 0.05 * stow + 0.02 * Math.sin(st.wheelAngle * 0.5);
        }
      }
      // 舱门开合 (左门铰链在中线左侧, 右门在右侧; 均向外下方打开)
      if (rig.doorNose) {
        rig.doorNose.visible = doorOpen > 0.01;
        for (i = 0; i < rig.doorNosePanels.length; i++) {
          var dnp = rig.doorNosePanels[i];
          dnp.rotation.z = (i === 0 ? 1 : -1) * 1.45 * doorOpen;
        }
      }
      for (side = -1; side <= 1; side += 2) {
        var dk = side > 0 ? 'doorR' : 'doorL';
        if (rig[dk]) {
          rig[dk].visible = doorOpen > 0.01;
          rig[dk].rotation.z = -side * 1.30 * doorOpen;      // 向外下方打开
        }
      }

      // --- 发动机: 风扇转速 / 反推 / 尾喷辉光 ---
      st.n1L = U.damp(st.n1L, clamp(state.n1L === undefined ? 0 : state.n1L, 0, 110), 1.2, dt);
      st.n1R = U.damp(st.n1R, clamp(state.n1R === undefined ? 0 : state.n1R, 0, 110), 1.2, dt);
      // 视觉转速: N1 100% 约 2.5 转/秒 (再快会与帧率产生频闪)
      st.fanL += (st.n1L / 100) * 16.0 * dt;
      st.fanR += (st.n1R / 100) * 16.0 * dt;
      if (rig.fanL) rig.fanL.rotation.z = st.fanL;
      if (rig.fanR) rig.fanR.rotation.z = st.fanR;
      var glL = clamp01((st.n1L - 35) / 70);
      var glR = clamp01((st.n1R - 35) / 70);
      if (parts.exhaustL && parts.exhaustL.userData.mat) {
        parts.exhaustL.userData.mat.color.setRGB(0.16 + 0.84 * glL, 0.10 + 0.30 * glL, 0.12 + 0.05 * glL);
      }
      if (parts.exhaustR && parts.exhaustR.userData.mat) {
        parts.exhaustR.userData.mat.color.setRGB(0.16 + 0.84 * glR, 0.10 + 0.30 * glR, 0.12 + 0.05 * glR);
      }
      for (side = -1; side <= 1; side += 2) {
        var rv = rig['reverser' + (side > 0 ? 'R' : 'L')];
        var cas = rig['cascade' + (side > 0 ? 'R' : 'L')];
        var amount = st.reverser;
        if (rv) rv.group.position.z = rv.baseZ + rv.travel * amount;
        if (cas) {
          cas.visible = amount > 0.03;
          cas.scale.set(1, 1, 0.4 + 0.6 * amount);
        }
      }

      // --- 机轮旋转 / 刹车盘辉光 ---
      if (state.wheelSpin) st.wheelAngle += state.wheelSpin * dt;
      var wl = rig.wheelList || [];
      for (i = 0; i < wl.length; i++) wl[i].rotation.x = st.wheelAngle;
      if (matBrake) matBrake.color.setRGB(0.16 + 0.84 * st.brake, 0.10 + 0.28 * st.brake, 0.07);

      // --- 客舱门 (贴图已画好舱门, 开门时叠加可动的门板) ---
      var doors3d = rig.doors || [];
      for (i = 0; i < doors3d.length; i++) {
        var dm = doors3d[i];
        var op = st.door;
        dm.visible = op > 0.02;
        if (op > 0.02) {
          var sgn3 = dm.userData.side;
          dm.rotation.y = sgn3 * op * 0.95;                       // 铰链在前缘, 后缘向外摆出
          var sw = dm.userData.outward;
          dm.position.x = sw.x + sgn3 * op * 0.16;
          dm.position.z = sw.z - op * 0.10;
        }
      }

      // --- 马赫锥 ---
      var mach = state.machNumber || 0;
      matVapour.opacity = clamp01((mach - 0.85) / 0.06) * 0.35;
      if (rig.vapour) rig.vapour.visible = matVapour.opacity > 0.01;

      // --- 灯光 ---
      applyLights(st.time);
    }

    /* ================================================================
       12. 对外接口
       ================================================================ */
    var handle = {
      key: ac.key,
      source: asset ? ('asset:' + asset.source + (asset.derived ? ' (derived)' : '')) : 'procedural',
      asset: asset,
      group: group,
      parts: parts,
      dims: d,
      plan: plan,
      getAnchors: function () { return rig.anchors || null; },
      getLamps: function () { return rig.lampList || []; },
      update: update,
      setLights: function (flags) {
        flags = flags || {};
        for (var k2 in lightsOn) if (lightsOn.hasOwnProperty(k2)) {
          if (flags[k2] !== undefined) lightsOn[k2] = !!flags[k2];
        }
        applyLights(st.time);
      },
      setQuality: function (qname) {
        if (!QUALITY[qname] || qname === opts.quality) {
          opts.quality = QUALITY[qname] ? qname : opts.quality;
          return;
        }
        opts.quality = qname;
        clearGroup();
        profWing = airfoilProfile(qOf(qname).radial >= 18 ? 14 : 10, 0.024);
        build();
      },
      dispose: function () {
        clearGroup();
        var i2;
        for (i2 = 0; i2 < mats.length; i2++) if (mats[i2].dispose) mats[i2].dispose();
        if (skinTex && skinTex.dispose) { /* 贴图由共享缓存管理 */ }
      }
    };

    build();
    applyLights(0);
    return handle;
  }

  /* ---------------------------------------------------------------------
     11. 公共 API
     --------------------------------------------------------------------- */
  var _typeCache = null;
  var _texCache = {};                 // 同一机型共享机身贴图

  FS.Aircraft3D = {
    create: function (typeKey, opts) {
      opts = opts || {};
      var DB = FS.AIRCRAFT_DB || {};
      var ac = DB[typeKey];
      if (!ac) {
        var fb = (FS.CFG && FS.CFG.defaultAircraft) || Object.keys(DB)[0];
        FS.Log.error('Aircraft3D.create: 未知机型 ' + typeKey + ', 回退到 ' + fb);
        ac = DB[fb];
      }
      if (!ac) throw new Error('aircraft3d: 机型数据库为空');
      if (!opts.quality || !QUALITY[opts.quality]) opts.quality = 'medium';
      var asset = opts.procedural ? null : assetFor(ac.key);
      if (asset) {
        opts.asset = asset;
        var hA = buildAircraft(ac, opts, { tex: null });
        FS.Log.info('Aircraft3D: 已构建 ' + ac.key + ' (真实外形模型 ' + asset.source +
          (asset.hybrid ? ', 近似改装' : (asset.derived ? ', 加长派生' : '')) +
          ', ' + asset.triangles + ' 三角面, ' + asset.credit.license + ')');
        return hA;
      }

      // 贴图缓存 (按机型 + 涂装 + 质量)
      var lvKey = '';
      var lv = opts.livery || ac.livery || {};
      var k3;
      for (k3 in lv) if (lv.hasOwnProperty(k3)) lvKey += k3 + ':' + lv[k3] + ';';
      var texKey = ac.key + '|' + opts.quality + '|' + lvKey;
      if (_texCache[texKey] === undefined) {
        var planTmp = makePlan(ac);
        var lvFull = {};
        var k4;
        for (k4 in (ac.livery || {})) if (ac.livery.hasOwnProperty(k4)) lvFull[k4] = ac.livery[k4];
        for (k4 in (opts.livery || {})) if (opts.livery.hasOwnProperty(k4)) lvFull[k4] = opts.livery[k4];
        _texCache[texKey] = makeSkinTexture(ac, lvFull, planTmp, qOf(opts.quality).tex);
      }
      var shared = { tex: _texCache[texKey] };
      var h = buildAircraft(ac, opts, shared);
      FS.Log.info('Aircraft3D: 已构建 ' + ac.key + ' (' + opts.quality + ' 质量)');
      return h;
    },

    /** 该机型是否使用真实外形模型 (返回资源对象或 null) */
    assetFor: assetFor,

    /** 预解码全部模型贴图 (启动时调用, 进入飞行时即可直接使用) */
    preloadAssets: function () {
      var T = FS.ModelTextures || {}, k;
      for (k in T) if (T.hasOwnProperty(k)) assetImages(k, null);
    },

    /** 全部模型的版权信息 (菜单"模型版权"与 ASSETS_LICENSES.md 一致) */
    credits: function () {
      var A = FS.ModelAssets || {}, out = [], k;
      for (k in A) if (A.hasOwnProperty(k)) {
        out.push({ type: k, source: A[k].source, derived: !!A[k].derived, plug: A[k].plug, credit: A[k].credit, triangles: A[k].triangles });
      }
      return out;
    },

    /** 可用机型 key 列表 (缓存) */
    types: function () {
      if (!_typeCache) _typeCache = Object.keys(FS.AIRCRAFT_DB || {});
      return _typeCache;
    },

    /** 释放贴图缓存 (切换涂装/质量时由场景调用) */
    clearTextureCache: function () {
      var k;
      for (k in _texCache) if (_texCache.hasOwnProperty(k)) {
        if (_texCache[k] && _texCache[k].dispose) _texCache[k].dispose();
        delete _texCache[k];
      }
    }
  };

  if (global.document && typeof global.document.addEventListener === 'function') {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', function () { FS.Aircraft3D.preloadAssets(); });
    } else {
      global.setTimeout(function () { FS.Aircraft3D.preloadAssets(); }, 0);
    }
  }

  FS.Log.info('aircraft3d.js 已加载');
})(typeof window !== 'undefined' ? window : globalThis);
