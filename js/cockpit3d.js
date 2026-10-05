/* ==========================================================================
   天际航线 SkyRoute — 三维驾驶舱 (cockpit3d.js, beta 0.3.1)
   --------------------------------------------------------------------------
   · 机长座位第一人称视角: 风挡 / 窗框 / 立柱, 遮光板, FCU (空客) / MCP (波音),
     EFIS 控制板, 主仪表板上按真实尺寸放置的 PFD / ND / ECAM(EICAS) / 系统页,
     中央操纵台 (MCDU, 会随推力移动的油门杆, 襟翼 / 减速板手柄),
     空客侧杆 / 波音驾驶盘 (随输入移动, 737/MAX/E190 抖杆时会抖动), 头顶板示意。
   · 全部为本项目自制的程序化几何体与 Canvas 贴图, 不含任何厂商标志。
   · 驾驶舱视角唯一模式: 已取消旧版 2D 六屏 / 简化仪表叠加。
   · 性能: 仪表贴图约 18 Hz 刷新 (机长 / 副驾两侧共用同一组贴图),
     FCU / EFIS 只在数值变化时重绘; 舱内使用无光照材质 + 烘焙的朝向明暗,
     由环境的昼夜系数统一调亮度 (不额外增加灯光, 避免着色器重编译)。
   · 空客布局: A320neo / A321neo / A330 / A350 / C919 (C919 同为侧杆);
     波音布局: 737-800 / 737 MAX 8 / 777 / 787, E190 (驾驶盘) 使用最接近的波音布局。
   坐标: 驾驶舱局部系, 原点 = 机身中线、机长眼高、眼位前后位置; x 右, y 上, -z 前。
   ========================================================================== */
(function (global) {
  'use strict';
  var FS = global.FS = global.FS || {};
  var DEG = Math.PI / 180;

  var TYPE_LAYOUT = {
    'A320neo': { maker: 'airbus', du: 0.165, k: 1.0 },
    'A321neo': { maker: 'airbus', du: 0.165, k: 1.0 },
    'A330-300': { maker: 'airbus', du: 0.17, k: 1.06 },
    'A350-900': { maker: 'airbus', du: 0.21, k: 1.08 },
    'A350-1000': { maker: 'airbus', du: 0.21, k: 1.08 },
    'C919': { maker: 'airbus', du: 0.20, k: 1.0 },
    'B737-800': { maker: 'boeing', du: 0.17, k: 1.0 },
    'B737-MAX8': { maker: 'boeing', du: 0.205, k: 1.0 },
    'B777-300ER': { maker: 'boeing', du: 0.19, k: 1.08 },
    'B787-9': { maker: 'boeing', du: 0.22, k: 1.08 },
    'E190': { maker: 'boeing', du: 0.18, k: 0.96 }
  };

  function layoutFor(typeKey) {
    var L = TYPE_LAYOUT[typeKey];
    if (!L) {
      var ac = (FS.AIRCRAFT_DB && FS.AIRCRAFT_DB[typeKey]) || {};
      L = { maker: /Boeing|Embraer/.test(ac.manufacturer || '') ? 'boeing' : 'airbus', du: 0.18, k: ac.class === 'widebody' ? 1.06 : 1.0 };
    }
    return { maker: L.maker, du: L.du, k: L.k, typeKey: typeKey };
  }

  var PAL = {
    airbus: { panel: 0x5b6979, lining: 0xaeb4bb, glare: 0x2b2f34, frame: 0x3c4249, floor: 0x34373c, console: 0x56636f,
      seat: 0x303845, door: 0x8e949b, stick: 0x1c1d20, lever: 0x2a2c30, knob: 0xd8d8d2 },
    boeing: { panel: 0x50555b, lining: 0xa39d90, glare: 0x232528, frame: 0x383a3d, floor: 0x303235, console: 0x4b4f54,
      seat: 0x3b302b, door: 0x868a8e, stick: 0x26272a, lever: 0x2b2d30, knob: 0xe4e2dc }
  };

  function pad(n, w) { var s = String(Math.abs(Math.round(n))); while (s.length < w) s = '0' + s; return s; }
  function mkCanvas(w, h) {
    var c = global.document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  function hex(c) { return '#' + ('000000' + c.toString(16)).slice(-6); }

  /* =====================================================================
     构造
     ===================================================================== */
  function Cockpit3D(THREE, typeKey, opts) {
    this.THREE = THREE;
    this.typeKey = typeKey;
    this.L = layoutFor(typeKey);
    this.pal = PAL[this.L.maker];
    this.opts = opts || {};
    this.sim = this.opts.sim || null;
    this.group = new THREE.Group();
    this.group.name = 'cockpit3d';
    this.group.visible = false;
    this._mats = [];
    this._geoms = [];
    this._texs = [];
    this.clickables = [];
    this.active = false;
    this._bright = -1;
    this._dispT = 0;
    this._ctlT = 0;
    this._sig = {};
    this.stats = { displayFrames: 0, lastRenderMs: 0 };
    this._build();
  }
  var P = Cockpit3D.prototype;

  /* ---------------- 材质 / 几何辅助 ---------------- */
  P._mat = function (hexc, o) {
    var THREE = this.THREE;
    o = o || {};
    var m = new THREE.MeshBasicMaterial({ color: hexc, vertexColors: !o.flat, side: THREE.DoubleSide, fog: false,
      map: o.map || null, toneMapped: o.toneMapped !== false, transparent: !!o.transparent, opacity: o.opacity === undefined ? 1 : o.opacity });
    // three r149 (legacyMode): 十六进制颜色按线性值处理, 这里把设计用的 sRGB 颜色转换成线性, 否则舱内会发白
    m.userData.base = new THREE.Color(hexc);
    if (!o.emissive && m.userData.base.convertSRGBToLinear) m.userData.base.convertSRGBToLinear();
    m.color.copy(m.userData.base);
    m.userData.emissive = !!o.emissive;
    this._mats.push(m);
    return m;
  };
  P._tex = function (canvas) {
    var THREE = this.THREE;
    var t = new THREE.CanvasTexture(canvas);
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    this._texs.push(t);
    return t;
  };
  P._mesh = function (geom, mat, parent) {
    var m = new this.THREE.Mesh(geom, mat);
    m.frustumCulled = false;
    (parent || this.group).add(m);
    this._geoms.push(geom);
    return m;
  };
  P._v = function (x, y, z) { var k = this.L.k; return [x * k, y * k, z * k]; };
  /** 多边形 (凸, 扇形三角化); pts = [[x,y,z],...] (已缩放) */
  P._poly = function (pts, mat, parent, uvs) {
    var THREE = this.THREE, n = pts.length, pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [], i;
    for (i = 0; i < n; i++) {
      pos[i * 3] = pts[i][0]; pos[i * 3 + 1] = pts[i][1]; pos[i * 3 + 2] = pts[i][2];
      var u = uvs ? uvs[i] : [[0, 0], [1, 0], [1, 1], [0, 1]][i % 4];
      uv[i * 2] = u[0]; uv[i * 2 + 1] = u[1];
    }
    for (i = 1; i < n - 1; i++) idx.push(0, i, i + 1);
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return this._mesh(g, mat, parent);
  };
  P._box = function (w, h, d, mat, x, y, z, rx, ry, rz, parent) {
    var m = this._mesh(new this.THREE.BoxGeometry(w, h, d), mat, parent);
    m.position.set(x || 0, y || 0, z || 0);
    m.rotation.set(rx || 0, ry || 0, rz || 0);
    return m;
  };
  P._plane = function (w, h, mat, x, y, z, rx, ry, rz, parent) {
    var m = this._mesh(new this.THREE.PlaneGeometry(w, h), mat, parent);
    m.position.set(x || 0, y || 0, z || 0);
    m.rotation.set(rx || 0, ry || 0, rz || 0);
    return m;
  };
  P._cyl = function (r1, r2, h, seg, mat, x, y, z, rx, ry, rz, parent) {
    var m = this._mesh(new this.THREE.CylinderGeometry(r1, r2, h, seg || 12), mat, parent);
    m.position.set(x || 0, y || 0, z || 0);
    m.rotation.set(rx || 0, ry || 0, rz || 0);
    return m;
  };
  /** 两点间的方截面杆件 (窗框 / 立柱) */
  P._bar = function (a, b, t, mat, parent, depth) {
    var THREE = this.THREE;
    var va = new THREE.Vector3(a[0], a[1], a[2]), vb = new THREE.Vector3(b[0], b[1], b[2]);
    var dir = vb.clone().sub(va), len = dir.length();
    var m = this._mesh(new THREE.BoxGeometry(t, len, depth || t), mat, parent);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return m;
  };
  function mirror(p) { return [-p[0], p[1], p[2]]; }

  /* =====================================================================
     建模
     ===================================================================== */
  P._build = function () {
    var THREE = this.THREE, self = this, L = this.L, k = L.k, C = this.pal, V = this._v.bind(this);
    var boeing = L.maker === 'boeing';
    var M = this.M = {
      lining: this._mat(C.lining), glare: this._mat(C.glare), frame: this._mat(C.frame), floor: this._mat(C.floor),
      console: this._mat(C.console), seat: this._mat(C.seat), door: this._mat(C.door), stick: this._mat(C.stick),
      lever: this._mat(C.lever), knob: this._mat(C.knob), panel: this._mat(C.panel),
      bezel: this._mat(0x101215), black: this._mat(0x050607, { flat: true }),
      red: this._mat(0xb01818), green: this._mat(0x23c447, { flat: true, emissive: true, toneMapped: false })
    };
    this.eyeX = -0.53 * k;

    /* ---- 风挡与侧窗的关键点 (左侧; 右侧镜像) ---- */
    var WS_BI = V(-0.012, -0.25, -1.025), WS_BO = V(-0.78, -0.25, -0.84),
      WS_TI = V(-0.012, 0.27, -0.805), WS_TO = V(-0.70, 0.26, -0.64);
    var SW_FB = V(-0.98, -0.20, -0.58), SW_FT = V(-0.92, 0.22, -0.58),
      SW_RB = V(-0.98, -0.20, 0.20), SW_RT = V(-0.92, 0.22, 0.20);
    var SW_MB = V(-0.98, -0.20, -0.18), SW_MT = V(-0.92, 0.22, -0.18);
    var ZB = 0.9 * k, YF = -1.15 * k, ZF = -1.05 * k;

    [1, -1].forEach(function (sx) {
      function S(p) { return sx > 0 ? p : mirror(p); }
      var fr = M.frame;
      // 风挡框: 中柱 / 顶框 / 底框 / 外侧立柱
      self._bar(S(WS_BI), S(WS_TI), 0.035 * k, fr, null, 0.06 * k);
      self._bar(S(WS_TI), S(WS_TO), 0.05 * k, fr);
      self._bar(S(WS_BI), S(WS_BO), 0.035 * k, fr);
      self._bar(S(WS_BO), S(WS_TO), (boeing ? 0.075 : 0.065) * k, fr, null, 0.07 * k);
      // 雨刷 (停放在风挡底部)
      self._bar(S(V(-0.62, -0.215, -0.875)), S(V(-0.16, -0.205, -0.985)), 0.012 * k, M.stick);
      // 侧窗框 (前 / 顶 / 底 / 中梃 / 后)
      self._bar(S(SW_FB), S(SW_FT), 0.06 * k, fr);
      self._bar(S(SW_FT), S(SW_RT), 0.045 * k, fr);
      self._bar(S(SW_FB), S(SW_RB), 0.05 * k, fr);
      self._bar(S(SW_MB), S(SW_MT), 0.04 * k, fr);
      self._bar(S(SW_RB), S(SW_RT), 0.06 * k, fr);
      // A 柱内衬 (风挡外侧与侧窗之间)
      self._poly([S(WS_BO), S(SW_FB), S(SW_FT), S(WS_TO)], M.lining);
      // 顶棚 (扇形)
      var E = V(0, 0.46, 0.9), F = V(0, 0.27, -0.81), D = V(-0.92, 0.42, 0.9);
      self._poly([E, F, S(WS_TI)], M.lining);
      self._poly([E, S(WS_TI), S(WS_TO)], M.lining);
      self._poly([E, S(WS_TO), S(SW_FT)], M.lining);
      self._poly([E, S(SW_FT), S(D)], M.lining);
      // 侧壁: 窗下 / 窗上三角 / 窗后
      var x0 = -0.98 * k * (sx > 0 ? 1 : -1);
      self._poly([[x0, YF, ZF], [x0, YF, ZB], [x0, -0.20 * k, ZB], [x0, -0.20 * k, ZF]], M.lining);
      var Pz = V(-0.92, 0.325, 0.20);
      self._poly([S(SW_FT), S(SW_RT), S(Pz)], M.lining);
      self._poly([S(SW_RB), S(V(-0.98, -0.20, 0.9)), S(D), S(Pz), S(SW_RT)], M.lining);
      // 遮光板顶面
      self._poly([V(0, -0.25, -1.03), S(WS_BO), S(V(-0.98, -0.25, -0.66)), V(0, -0.25, -0.64)].map(function (p, i) {
        return i === 0 || i === 3 ? p : p;
      }), M.glare);
      // 侧操纵台
      var cx = (sx > 0 ? -1 : 1) * 0.89 * k;
      self._box(0.18 * k, (boeing ? 0.48 : 0.55) * k, 0.92 * k, M.console, cx, YF + (boeing ? 0.24 : 0.275) * k, -0.16 * k);
    });
    // 遮光板唇边与底面
    this._poly([V(-0.98, -0.335, -0.64), V(0.98, -0.335, -0.64), V(0.98, -0.25, -0.64), V(-0.98, -0.25, -0.64)], M.glare);
    this._poly([V(-0.98, -0.335, -0.70), V(0.98, -0.335, -0.70), V(0.98, -0.335, -0.64), V(-0.98, -0.335, -0.64)], M.glare);
    // 地板 / 后隔板 / 舱门 / 前方腿部空间
    this._poly([[-0.98 * k, YF, ZF], [0.98 * k, YF, ZF], [0.98 * k, YF, ZB], [-0.98 * k, YF, ZB]], M.floor);
    this._poly([[-0.98 * k, YF, ZB], [0.98 * k, YF, ZB], [0.98 * k, -0.2 * k, ZB], V(0.92, 0.42, 0.9), V(0, 0.46, 0.9), V(-0.92, 0.42, 0.9), [-0.98 * k, -0.2 * k, ZB]], M.lining);
    this._poly([[-0.30 * k, YF, ZB - 0.01], [0.30 * k, YF, ZB - 0.01], [0.30 * k, 0.22 * k, ZB - 0.01], [-0.30 * k, 0.22 * k, ZB - 0.01]], M.door);
    this._poly([[-0.98 * k, YF, -0.95 * k], [0.98 * k, YF, -0.95 * k], [0.98 * k, -0.30 * k, -0.95 * k], [-0.98 * k, -0.30 * k, -0.95 * k]], M.frame);

    this._buildGlareshieldUnits();
    this._buildMainPanel();
    this._buildPedestal();
    this._buildControls();
    this._buildOverhead();
    this._buildSeats();
    this._buildExtras();

    /* ---- 视点 ---- */
    this.eyeL = new THREE.Object3D(); this.eyeL.position.set(this.eyeX, 0, 0); this.eyeL.rotation.x = -0.12;
    this.eyeR = new THREE.Object3D(); this.eyeR.position.set(-this.eyeX, 0, 0); this.eyeR.rotation.x = -0.12;
    this.group.add(this.eyeL); this.group.add(this.eyeR);

    this._bake();
  };

  /** 烘焙朝向明暗到顶点色 (上表面亮, 侧面暗), 只做一次 */
  P._bake = function () {
    var THREE = this.THREE;
    this.group.updateMatrixWorld(true);
    var inv = new THREE.Matrix4().copy(this.group.matrixWorld).invert();
    var nm = new THREE.Matrix3(), rel = new THREE.Matrix4(), n = new THREE.Vector3();
    this.group.traverse(function (o) {
      if (!o.isMesh || !o.material || !o.material.vertexColors) return;
      var g = o.geometry;
      if (!g.attributes.normal) g.computeVertexNormals();
      rel.multiplyMatrices(inv, o.matrixWorld);
      nm.getNormalMatrix(rel);
      var N = g.attributes.normal, cnt = N.count, col = new Float32Array(cnt * 3);
      for (var i = 0; i < cnt; i++) {
        n.set(N.getX(i), N.getY(i), N.getZ(i)).applyMatrix3(nm).normalize();
        var s = 0.52 + 0.30 * Math.abs(n.y) + 0.18 * Math.abs(n.z) + (n.y > 0.3 ? 0.06 : 0);
        col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = Math.min(1, s);
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    });
  };

  /* ---------------- 遮光板: FCU / MCP + EFIS + 主警告灯 ---------------- */
  P._buildGlareshieldUnits = function () {
    var L = this.L, k = L.k, boeing = L.maker === 'boeing', M = this.M;
    var hw = (boeing ? 0.40 : 0.32) * k, h = 0.074, y = -0.293 * k, z = -0.626 * k, tilt = -0.16;
    this._box(hw * 2 + 0.01, h + 0.012, 0.05 * k, M.frame, 0, y, z - 0.026 * k, tilt);
    this.fcuCanvas = mkCanvas(1024, 128);
    this.fcuTex = this._tex(this.fcuCanvas);
    var fm = this._mat(0xffffff, { flat: true, map: this.fcuTex });
    this.fcuMesh = this._plane(hw * 2, h, fm, 0, y, z, tilt);
    this.fcuMesh.userData.canvas = this.fcuCanvas; this.fcuMesh.userData.rects = [];
    this.clickables.push(this.fcuMesh);
    // EFIS 控制板 (两侧共用一张贴图)
    this.efisCanvas = mkCanvas(512, 144);
    this.efisTex = this._tex(this.efisCanvas);
    var em = this._mat(0xffffff, { flat: true, map: this.efisTex });
    var ew = 0.25 * k, ex = hw + 0.035 * k + ew / 2;
    this.efisMeshes = [];
    for (var s = -1; s <= 1; s += 2) {
      this._box(ew + 0.01, h + 0.012, 0.04 * k, M.frame, s * ex, y, z - 0.022 * k, tilt);
      var e = this._plane(ew, h, em, s * ex, y, z, tilt);
      e.userData.canvas = this.efisCanvas; e.userData.rects = [];
      this.efisMeshes.push(e); this.clickables.push(e);
    }
    // 主警告 / 主警戒灯 (机长与副驾两侧)
    this.mwMat = this._mat(0x3a0806, { flat: true, toneMapped: false, emissive: true });
    this.mcMat = this._mat(0x3a2a04, { flat: true, toneMapped: false, emissive: true });
    var mx = ex + ew / 2 + 0.05 * k;
    for (var s2 = -1; s2 <= 1; s2 += 2) {
      this._plane(0.04, 0.026, this.mwMat, s2 * mx, y + 0.016, z + 0.004, tilt);
      this._plane(0.04, 0.026, this.mcMat, s2 * mx, y - 0.016, z + 0.004, tilt);
    }
  };

  /* ---------------- 主仪表板 + 显示器 ---------------- */
  P._buildMainPanel = function () {
    var THREE = this.THREE, L = this.L, k = L.k, du = L.du, M = this.M, boeing = L.maker === 'boeing';
    var pg = this.panelGroup = new THREE.Group();
    pg.position.set(0, -0.34 * k, -0.70 * k);
    pg.rotation.x = -0.165;
    this.group.add(pg);
    var cw = Math.max(0.22 * k, du / 2 + 0.035);
    var hS = du + 0.07, hC = 2 * du + 0.075;
    this._panelDims = { cw: cw, hS: hS, hC: hC };
    // 面板底板 (带细节贴图)
    var pc = mkCanvas(512, 256); this._drawPanelBg(pc);
    var ptex = this._tex(pc);
    var pmat = this._mat(this.pal.panel, { map: ptex });
    var W = 0.98 * k;
    this._poly([[-W, -hS, 0], [-cw, -hS, 0], [-cw, 0, 0], [-W, 0, 0]], pmat, pg);
    this._poly([[cw, -hS, 0], [W, -hS, 0], [W, 0, 0], [cw, 0, 0]], pmat, pg);
    this._poly([[-cw, -hC, 0], [cw, -hC, 0], [cw, 0, 0], [-cw, 0, 0]], pmat, pg, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    // 面板下缘 (膝部挡板)
    this._poly([[-W, -hS, 0], [-cw, -hS, 0], [-cw, -hS - 0.02, -0.12], [-W, -hS - 0.02, -0.12]], this.M.frame, pg);
    this._poly([[cw, -hS, 0], [W, -hS, 0], [W, -hS - 0.02, -0.12], [cw, -hS - 0.02, -0.12]], this.M.frame, pg);

    // 显示器贴图
    this.dispCanvas = {
      pfd: mkCanvas(512, 512), nd: mkCanvas(512, 512), upper: mkCanvas(512, 512), lower: mkCanvas(512, 512)
    };
    this.dispTex = {};
    var self = this;
    Object.keys(this.dispCanvas).forEach(function (key) { self.dispTex[key] = self._tex(self.dispCanvas[key]); });
    var dmat = {};
    Object.keys(this.dispTex).forEach(function (key) {
      dmat[key] = self._mat(0xffffff, { flat: true, map: self.dispTex[key], toneMapped: false, emissive: true });
    });
    function screen(key, x, y) {
      self._plane(du + 0.024, du + 0.024, M.bezel, x, y, 0.004, 0, 0, 0, pg);
      return self._plane(du, du, dmat[key], x, y, 0.007, 0, 0, 0, pg);
    }
    var ex = this.eyeX, dy = -(0.014 + du / 2);
    this.screens = {
      pfdL: screen('pfd', ex - du / 2 - 0.014, dy),
      ndL: screen('nd', ex + du / 2 + 0.014, dy),
      ndR: screen('nd', -(ex + du / 2 + 0.014), dy),
      pfdR: screen('pfd', -(ex - du / 2 - 0.014), dy),
      upper: screen('upper', 0, dy),
      lower: screen('lower', 0, dy - du - 0.03)
    };
    // 备用仪表 (小圆表, 静态外观)
    var stby = mkCanvas(128, 128); this._drawStandby(stby);
    var sm = this._mat(0xffffff, { flat: true, map: this._tex(stby), toneMapped: false, emissive: true });
    this._plane(0.075, 0.075, M.bezel, -cw - 0.055, -hS + 0.06, 0.004, 0, 0, 0, pg);
    this._plane(0.065, 0.065, sm, -cw - 0.055, -hS + 0.06, 0.007, 0, 0, 0, pg);

    // 起落架手柄 + 三个起落架指示灯 (右侧面板靠中央处)
    var gx = cw + 0.06, gy = -hS + 0.075;
    this._box(0.05, 0.13, 0.012, M.frame, gx, gy, 0.006, 0, 0, 0, pg);
    var gl = this.gearLever = new THREE.Group();
    gl.position.set(gx, gy, 0.012); pg.add(gl);
    this._box(0.012, 0.075, 0.012, M.lever, 0, 0.032, 0.012, 0, 0, 0, gl);
    var wheel = this._cyl(0.022, 0.022, 0.016, 14, M.knob, 0, 0.07, 0.02, 0, 0, Math.PI / 2, gl);
    this.gearLights = [];
    for (var i = 0; i < 3; i++) {
      var lm = this._mat(0x0c2610, { flat: true, toneMapped: false, emissive: true });
      this.gearLights.push(lm);
      this._plane(0.016, 0.012, lm, gx + 0.045 + (i === 1 ? 0 : (i === 0 ? -0.0 : 0)), gy + 0.045 - i * 0.02, 0.008, 0, 0, 0, pg);
    }
    wheel.userData.hit = function () { self._clickGear(); };
    this.clickables.push(wheel);
    this._gearWheel = wheel;
    void boeing;
  };

  /* ---------------- 中央操纵台 ---------------- */
  P._buildPedestal = function () {
    var THREE = this.THREE, L = this.L, k = L.k, M = this.M, boeing = L.maker === 'boeing';
    var pd = this._panelDims, tilt = 0.165;
    var py0 = -0.34 * k - pd.hC * Math.cos(tilt), pz0 = -0.70 * k + pd.hC * Math.sin(tilt);
    var YF = -1.15 * k, top = py0 - 0.004, zEnd = 0.36 * k, pw = Math.min(pd.cw * 0.95, 0.24 * k);
    this._box(pw * 2, top - YF, zEnd - pz0, M.console, 0, (top + YF) / 2, (pz0 + zEnd) / 2);
    this._pedTop = top;
    // MCDU (两台, 斜放在操纵台前部)
    var mc = mkCanvas(256, 320); this._drawMCDU(mc);
    var mm = this._mat(0xffffff, { flat: true, map: this._tex(mc), toneMapped: false, emissive: true });
    for (var s = -1; s <= 1; s += 2) {
      var g = new THREE.Group(); g.position.set(s * pw * 0.5, top + 0.035, pz0 + 0.11); g.rotation.x = -1.05; this.group.add(g);
      this._box(pw * 0.9, 0.17, 0.05, M.frame, 0, 0, -0.026, 0, 0, 0, g);
      this._plane(pw * 0.86, 0.16, mm, 0, 0, 0.001, 0, 0, 0, g);
    }
    // 推力手柄座
    var qz = pz0 + 0.33, qLen = 0.22;
    this._box(0.20, 0.05, qLen, M.frame, 0, top + 0.02, qz);
    this.thrLevers = [];
    var n = 2;
    for (var i = 0; i < n; i++) {
      var lv = new THREE.Group(); lv.position.set((i === 0 ? -1 : 1) * 0.045, top - 0.02, qz); this.group.add(lv);
      this._box(0.016, 0.20, 0.02, M.lever, 0, 0.10, 0, 0, 0, 0, lv);
      if (boeing) {
        this._cyl(0.016, 0.016, 0.07, 12, M.knob, (i === 0 ? -1 : 1) * 0.02, 0.205, 0, 0, 0, Math.PI / 2, lv);
        this._box(0.012, 0.012, 0.012, M.stick, (i === 0 ? -1 : 1) * 0.02, 0.2, 0.017, 0, 0, 0, lv);
      } else {
        this._box(0.05, 0.035, 0.035, M.knob, (i === 0 ? -1 : 1) * 0.012, 0.205, 0, 0, 0, 0, lv);
        this._box(0.052, 0.008, 0.037, M.stick, (i === 0 ? -1 : 1) * 0.012, 0.187, 0, 0, 0, 0, lv);
      }
      this.thrLevers.push(lv);
    }
    // 襟翼手柄 (右) / 减速板手柄 (左)
    var mkLever = function (x, color) {
      var g = new THREE.Group(); g.position.set(x, top - 0.015, qz + 0.02); this.group.add(g);
      this._box(0.012, 0.14, 0.014, M.lever, 0, 0.07, 0, 0, 0, 0, g);
      this._box(0.045, 0.022, 0.03, color, 0, 0.145, 0, 0, 0, 0, g);
      return g;
    }.bind(this);
    this.flapLever = mkLever(0.14, M.knob);
    this.sbLever = mkLever(-0.14, M.stick);
    // 襟翼 / 减速板手柄可点击 (一轮 = 收/放一档)
    var selfPed = this;
    function hitBox(lever, fn) {
      var h = selfPed._box(0.06, 0.16, 0.05, M.lever, 0, 0.08, 0.02, 0, 0, 0, lever);
      h.material = h.material.clone(); h.material.visible = false; h.material.transparent = true; h.material.opacity = 0;
      selfPed._mats.push(h.material);
      h.userData.hit = fn; selfPed.clickables.push(h);
    }
    hitBox(this.flapLever, function () { selfPed._clickFlap(); });
    hitBox(this.sbLever, function () { selfPed._clickSpoiler(); });
    // 操纵台后部: 无线电面板 (贴图)
    var rc = mkCanvas(256, 256); this._drawRadio(rc);
    var rm = this._mat(0xffffff, { flat: true, map: this._tex(rc) });
    this._plane(pw * 1.9, zEnd - qz - qLen / 2 - 0.02, rm, 0, top + 0.002, (qz + qLen / 2 + zEnd) / 2, -Math.PI / 2);
  };

  /* ---------------- 侧杆 / 驾驶盘 ---------------- */
  P._buildControls = function () {
    var THREE = this.THREE, L = this.L, k = L.k, M = this.M, boeing = L.maker === 'boeing';
    this.sticks = [];
    this.yokes = [];
    for (var s = -1; s <= 1; s += 2) {
      if (!boeing) {
        var top = -1.15 * k + 0.55 * k;
        var base = new THREE.Group(); base.position.set(s * 0.87 * k, top + 0.01, -0.36 * k); this.group.add(base);
        this._cyl(0.045, 0.05, 0.02, 16, M.stick, 0, 0, 0, 0, 0, 0, base);
        var st = new THREE.Group(); base.add(st);
        this._cyl(0.014, 0.017, 0.09, 10, M.stick, 0, 0.05, 0, 0, 0, 0, st);
        this._box(0.04, 0.075, 0.05, M.stick, 0, 0.12, -0.008, 0.22, 0, 0, st);
        this._cyl(0.007, 0.007, 0.006, 8, M.red, 0.008 * -s, 0.162, -0.02, 0, 0, 0, st);
        // 扶手
        this._box(0.10, 0.04, 0.28, M.console, s * 0.80 * k, top + 0.02, -0.05 * k);
        this.sticks.push({ side: s, g: st });
      } else {
        var col = new THREE.Group(); col.position.set(0, -1.15 * k, -0.50 * k);
        col.position.x = s < 0 ? this.eyeX : -this.eyeX;
        this.group.add(col);
        var H = 0.64 * k;   // 驾驶盘上缘在 PFD 下缘以下, 看仪表板时不遮挡 PFD
        this._box(0.05, H, 0.05, M.stick, 0, H / 2, 0, 0, 0, 0, col);
        var wh = new THREE.Group(); wh.position.set(0, H, 0.025); col.add(wh);
        this._box(0.07, 0.06, 0.05, M.stick, 0, 0, 0, 0, 0, 0, wh);
        this._box(0.30, 0.03, 0.035, M.stick, 0, 0.012, 0.01, 0, 0, 0, wh);
        for (var g = -1; g <= 1; g += 2) {
          this._box(0.035, 0.13, 0.04, M.stick, g * 0.15, 0.06, 0.012, 0, 0, -g * 0.12, wh);
        }
        // 中央小屏/检查单夹 (浅色)
        this._box(0.06, 0.035, 0.008, M.door, 0, 0.012, 0.03, 0, 0, 0, wh);
        this.yokes.push({ side: s, col: col, wheel: wh });
        // 前轮转向手轮 (左侧操纵台)
        this._cyl(0.045, 0.045, 0.015, 16, M.stick, s * 0.87 * k, -1.15 * k + 0.50 * k, -0.40 * k, 0, 0, 0);
      }
    }
  };

  /* ---------------- 头顶板 (示意) ---------------- */
  P._buildOverhead = function () {
    var k = this.L.k;
    var oc = mkCanvas(1024, 1024); this._drawOverhead(oc);
    var om = this._mat(0xffffff, { map: this._tex(oc) });
    this._poly([[-0.42 * k, 0.245 * k, -0.70 * k], [0.42 * k, 0.245 * k, -0.70 * k], [0.42 * k, 0.34 * k, 0.15 * k], [-0.42 * k, 0.34 * k, 0.15 * k]].reverse(), om, null,
      [[0, 1], [1, 1], [1, 0], [0, 0]]);
    this._bar([-0.43 * k, 0.24 * k, -0.71 * k], [-0.43 * k, 0.335 * k, 0.16 * k], 0.02, this.M.frame);
    this._bar([0.43 * k, 0.24 * k, -0.71 * k], [0.43 * k, 0.335 * k, 0.16 * k], 0.02, this.M.frame);
  };

  /* ---------------- 座椅 (从另一侧座位可见) ---------------- */
  P._buildSeats = function () {
    var THREE = this.THREE, k = this.L.k, M = this.M;
    this.seats = [];
    for (var s = -1; s <= 1; s += 2) {
      var g = new THREE.Group(); g.position.set(s * 0.53 * k, 0, 0.30 * k); this.group.add(g);
      this._box(0.50, 0.12, 0.50, M.seat, 0, -0.70 * k, -0.08, 0, 0, 0, g);           // 坐垫
      this._box(0.46, 0.04, 0.46, M.door, 0, -0.635 * k, -0.08, 0, 0, 0, g);            // 坐垫缝线层
      this._box(0.50, 0.70, 0.11, M.seat, 0, -0.30 * k, 0.17, -0.18, 0, 0, g);           // 靠背
      this._box(0.34, 0.20, 0.11, M.seat, 0, 0.14 * k, 0.26, -0.18, 0, 0, g);            // 头枕
      this._box(0.06, 0.05, 0.40, M.seat, 0.27, -0.50 * k, -0.02, 0, 0, 0, g);           // 扶手
      this._box(0.06, 0.05, 0.40, M.seat, -0.27, -0.50 * k, -0.02, 0, 0, 0, g);
      this._box(0.04, 0.35, 0.04, M.frame, 0.24, -0.55 * k, 0.12, 0, 0, 0, g);           // 滑轨立柱示意
      this.seats.push({ side: s, g: g });
    }
  };

  /** 遮阳板、侧窗玻璃、脚蹬示意等细节 */
  P._buildExtras = function () {
    var k = this.L.k, M = this.M, V = this._v.bind(this), self = this;
    // 半透明侧窗玻璃 (加深舱内立体感, 不挡视线太多)
    var glass = this._mat(0x6a8098, { flat: true, transparent: true, opacity: 0.10, toneMapped: false });
    glass.userData.emissive = true;
    [1, -1].forEach(function (sx) {
      function S(p) { return sx > 0 ? p : [-p[0], p[1], p[2]]; }
      self._poly([S(V(-0.975, -0.18, -0.55)), S(V(-0.975, -0.18, 0.18)), S(V(-0.915, 0.20, 0.18)), S(V(-0.915, 0.20, -0.55))], glass);
      // 遮阳板 (风挡上方内侧)
      var vis = self._box(0.28 * k, 0.012, 0.16 * k, M.door, sx * 0.36 * k, 0.18 * k, -0.72 * k, 0.55, 0, sx * 0.08);
      vis.rotation.x = 0.15;
    });
    // 方向舵脚蹬示意 (机长侧)
    var pedX = this.eyeX;
    this._box(0.08, 0.02, 0.12, M.stick, pedX - 0.10, -1.05 * k, -0.55 * k);
    this._box(0.08, 0.02, 0.12, M.stick, pedX + 0.10, -1.05 * k, -0.55 * k);
  };

  /* =====================================================================
     静态贴图
     ===================================================================== */
  P._drawPanelBg = function (c) {
    var g = c.getContext('2d'), W = c.width, H = c.height;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
    var r = 7;
    for (var i = 0; i < 2600; i++) {
      r = (r * 16807) % 2147483647;
      var v = 236 + (r % 20);
      g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      g.fillRect(r % W, (r >> 8) % H, 2, 2);
    }
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
    g.strokeRect(4, 4, W - 8, H - 8);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    [[10, 10], [W - 14, 10], [10, H - 14], [W - 14, H - 14]].forEach(function (p) { g.beginPath(); g.arc(p[0] + 2, p[1] + 2, 3, 0, 7); g.fill(); });
  };
  P._drawStandby = function (c) {
    var g = c.getContext('2d');
    g.fillStyle = '#050607'; g.fillRect(0, 0, 128, 128);
    g.save(); g.beginPath(); g.arc(64, 64, 54, 0, 7); g.clip();
    g.fillStyle = '#2a6fc9'; g.fillRect(0, 0, 128, 66); g.fillStyle = '#7a4a1f'; g.fillRect(0, 66, 128, 62);
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 66); g.lineTo(128, 66); g.stroke();
    g.restore();
    g.strokeStyle = '#ffd400'; g.lineWidth = 4; g.beginPath(); g.moveTo(38, 66); g.lineTo(56, 66); g.moveTo(72, 66); g.lineTo(90, 66); g.stroke();
    g.strokeStyle = '#888'; g.lineWidth = 3; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.stroke();
  };
  P._drawMCDU = function (c) {
    var g = c.getContext('2d'), W = c.width, H = c.height;
    g.fillStyle = '#3b4148'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#020403'; g.fillRect(28, 12, W - 56, 128);
    g.font = 'bold 13px monospace'; g.textBaseline = 'top';
    var lines = [['     INIT', '#fff'], ['CO RTE      FROM/TO', '#fff'], ['[    ]     ZSPD/ZBAA', '#4fd1ff'], ['FLT NBR', '#fff'], ['SKY0301', '#4fd1ff'],
      ['CRZ FL/TEMP   TROPO', '#fff'], ['FL350/-54°  36090', '#4fd1ff']];
    lines.forEach(function (l, i) { g.fillStyle = l[1]; g.fillText(l[0], 34, 16 + i * 17); });
    g.fillStyle = '#d9dbdc';
    for (var r = 0; r < 6; r++) for (var q = 0; q < 6; q++) g.fillRect(30 + q * 34, 152 + r * 26, 26, 18);
    for (var j = 0; j < 6; j++) { g.fillRect(6, 18 + j * 20, 16, 10); g.fillRect(W - 22, 18 + j * 20, 16, 10); }
  };
  P._drawRadio = function (c) {
    var g = c.getContext('2d'), W = c.width, H = c.height;
    g.fillStyle = hex(this.pal.console); g.fillRect(0, 0, W, H);
    for (var r = 0; r < 4; r++) {
      var y = 10 + r * 62;
      g.fillStyle = hex(this.pal.panel); g.fillRect(8, y, W - 16, 54);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.strokeRect(8, y, W - 16, 54);
      g.fillStyle = '#060707'; g.fillRect(24, y + 10, 70, 22); g.fillRect(W - 94, y + 10, 70, 22);
      g.fillStyle = '#ffb000'; g.font = 'bold 16px monospace'; g.textBaseline = 'top';
      g.fillText(['118.70', '121.50', '110.30', '2000'][r], 28, y + 13);
      g.fillText(['119.05', '127.80', '109.10', 'ATC'][r], W - 90, y + 13);
      g.fillStyle = '#2a2d31'; g.beginPath(); g.arc(W / 2, y + 27, 16, 0, 7); g.fill();
    }
  };
  P._drawOverhead = function (c) {
    var g = c.getContext('2d'), W = c.width, H = c.height;
    g.fillStyle = hex(this.pal.panel); g.fillRect(0, 0, W, H);
    var names = ['ADIRS', 'FLT CTL', 'EVAC', 'EMER ELEC', 'GPWS', 'RCDR', 'OXYGEN', 'CALLS',
      'FIRE', 'HYD', 'FUEL', 'ELEC', 'AIR COND', 'ANTI ICE', 'CABIN PRESS', 'EXT LT', 'APU', 'SIGNS', 'INT LT', 'WIPER'];
    var cols = 4, rows = 5, cw = W / cols, ch = H / rows, r = 11;
    for (var i = 0; i < names.length; i++) {
      var cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch;
      g.fillStyle = 'rgba(0,0,0,0.09)'; g.fillRect(cx + 8, cy + 8, cw - 16, ch - 16);
      g.strokeStyle = 'rgba(255,255,255,0.65)'; g.lineWidth = 2; g.strokeRect(cx + 8, cy + 8, cw - 16, ch - 16);
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top';
      g.fillText(names[i], cx + cw / 2, cy + 14);
      for (var b = 0; b < 6; b++) {
        r = (r * 16807) % 2147483647;
        var bx = cx + 22 + (b % 3) * ((cw - 44) / 3), by = cy + 48 + Math.floor(b / 3) * 64;
        if (r % 3 === 0) {
          g.fillStyle = '#2a2d31'; g.beginPath(); g.arc(bx + 26, by + 22, 15, 0, 7); g.fill();
          g.fillStyle = '#e7e7e2'; g.fillRect(bx + 24, by + 6, 4, 14);
        } else {
          g.fillStyle = '#1b1d20'; g.fillRect(bx + 4, by + 2, 48, 40);
          g.fillStyle = r % 7 === 0 ? '#e9b53a' : '#3a3d42'; g.fillRect(bx + 8, by + 6, 40, 14);
          g.fillStyle = '#3a3d42'; g.fillRect(bx + 8, by + 24, 40, 14);
        }
      }
    }
  };

  /* =====================================================================
     FCU / MCP 与 EFIS (按需重绘, 带点击区域)
     ===================================================================== */
  function lit(id) { var e = global.document && global.document.getElementById(id); return !!(e && e.classList.contains('on')); }

  P._fcuValues = function () {
    var sim = this.sim, f = (sim && sim.hud && sim.hud._fcu) || { spd: 250, hdg: 0, alt: 10000, vs: 0, mach: 0.78 };
    var ap = (sim && sim.ap && sim.ap.ap) || {};
    return {
      spd: f.spdIsMach ? (f.mach || 0.78).toFixed(2).replace(/^0/, '') : pad(f.spd, 3), mach: !!f.spdIsMach,
      hdg: pad(f.hdg, 3), alt: String(Math.round(f.alt)), vs: (f.vs >= 0 ? '+' : '-') + pad(f.vs, 4),
      ap1: lit('fcu-ap1'), ap2: lit('fcu-ap2'), athr: lit('fcu-athr'), loc: lit('fcu-loc') || !!ap.locArmed, appr: lit('fcu-appr'),
      roll: ap.rollMode || '', pitch: ap.pitchMode || '', thrust: ap.thrustMode || ''
    };
  };

  P._drawFCU = function (v) {
    var c = this.fcuCanvas, g = c.getContext('2d'), W = c.width, H = c.height, rects = [], self = this;
    var boeing = this.L.maker === 'boeing';
    g.fillStyle = boeing ? '#4d5257' : '#56636f'; g.fillRect(0, 0, W, H);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    function label(t, x, y, size) { g.fillStyle = '#e8ebee'; g.font = 'bold ' + (size || 13) + 'px sans-serif'; g.fillText(t, x, y); }
    function lcd(t, x, y, w, h) {
      g.fillStyle = '#07090a'; g.fillRect(x, y, w, h);
      g.fillStyle = boeing ? '#f2f2ea' : '#ff9d2e'; g.font = 'bold ' + Math.round(h * 0.78) + 'px monospace'; g.fillText(t, x + w / 2, y + h / 2 + 1);
    }
    function button(t, x, y, w, h, on, act) {
      g.fillStyle = '#25282c'; g.fillRect(x, y, w, h);
      g.strokeStyle = '#8a9096'; g.lineWidth = 1.5; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      if (boeing) { g.fillStyle = on ? '#9dff8f' : '#3b4a3a'; g.fillRect(x + 6, y + 4, w - 12, 5); }
      else { g.fillStyle = on ? '#3dff6a' : '#1e3424'; g.fillRect(x + w / 2 - 14, y + 5, 28, 5); }
      label(t, x + w / 2, y + h / 2 + 5, t.length > 6 ? 11 : 13);
      rects.push({ x: x, y: y, w: w, h: h, act: act });
    }
    function knobUnit(name, x, w, val, id) {
      label(name, x + w / 2, 12, 13);
      lcd(val, x + 10, 22, w - 20, 38);
      var cx = x + w / 2, cy = 95;
      g.fillStyle = '#1d1f22'; g.beginPath(); g.arc(cx, cy, 24, 0, 7); g.fill();
      g.strokeStyle = '#9aa0a6'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 24, 0, 7); g.stroke();
      g.fillStyle = '#c8ccd0'; g.fillRect(cx - 2, cy - 20, 4, 10);
      g.fillStyle = '#c8ccd0'; g.font = 'bold 18px sans-serif';
      g.fillText('◀', x + (w / 2 - 24) / 2, cy); g.fillText('▶', x + w - (w / 2 - 24) / 2, cy);
      g.font = '10px sans-serif'; g.fillText('PUSH', cx, cy - 31 + 3); g.fillText('PULL', cx, cy + 30);
      rects.push({ x: x, y: 66, w: w / 2 - 24, h: 60, act: { knob: id, dir: -1 } });
      rects.push({ x: cx + 24, y: 66, w: w / 2 - 24, h: 60, act: { knob: id, dir: 1 } });
      rects.push({ x: cx - 24, y: 66, w: 48, h: 29, act: { click: 'fcu-' + id + '-push' } });
      rects.push({ x: cx - 24, y: 95, w: 48, h: 31, act: { click: 'fcu-' + id + '-pull' } });
    }
    if (!boeing) {
      knobUnit(v.mach ? 'MACH' : 'SPD', 14, 180, v.spd, 'spd');
      knobUnit('HDG', 204, 180, v.hdg, 'hdg');
      button('AP1', 400, 16, 72, 46, v.ap1, { click: 'fcu-ap1' });
      button('AP2', 482, 16, 72, 46, v.ap2, { click: 'fcu-ap2' });
      button('A/THR', 564, 16, 72, 46, v.athr, { click: 'fcu-athr' });
      button('LOC', 400, 70, 72, 46, v.loc, { click: 'fcu-loc' });
      button('EXPED', 482, 70, 72, 46, v.pitch === 'FLCH', { click: 'fcu-exped' });
      button('APPR', 564, 70, 72, 46, v.appr, { click: 'fcu-appr' });
      knobUnit('ALT', 650, 200, v.alt, 'alt');
      knobUnit('V/S', 856, 160, v.vs, 'vs');
    } else {
      button('A/T ARM', 6, 14, 64, 48, v.athr, { click: 'fcu-athr' });
      button('SPEED', 6, 70, 64, 48, v.athr && v.thrust === 'SPEED', { click: 'fcu-spd-pull' });
      knobUnit(v.mach ? 'MACH' : 'IAS', 74, 140, v.spd, 'spd');
      button('LVL CHG', 218, 14, 64, 48, v.pitch === 'FLCH', { click: 'fcu-exped' });
      button('C/O', 218, 70, 64, 48, v.mach, { click: 'fcu-spd-mach' });
      knobUnit('HDG', 286, 140, v.hdg, 'hdg');
      button('HDG SEL', 430, 14, 64, 48, v.roll === 'HDG', { click: 'fcu-hdg-pull' });
      button('LNAV', 430, 70, 64, 48, v.roll === 'NAV' || v.roll === 'LNAV', { click: 'fcu-hdg-push' });
      button('VOR LOC', 498, 14, 64, 48, v.loc, { click: 'fcu-loc' });
      button('APP', 498, 70, 64, 48, v.appr, { click: 'fcu-appr' });
      knobUnit('ALT', 566, 140, v.alt, 'alt');
      button('ALT HOLD', 710, 14, 64, 48, v.pitch === 'ALT', { click: 'fcu-vs-push' });
      button('V/S', 710, 70, 64, 48, v.pitch === 'VS', { click: 'fcu-vs-pull' });
      knobUnit('V/S', 778, 140, v.vs, 'vs');
      button('CMD A', 922, 14, 96, 48, v.ap1, { click: 'fcu-ap1' });
      button('CMD B', 922, 70, 96, 48, v.ap2, { click: 'fcu-ap2' });
    }
    this.fcuMesh.userData.rects = rects;
    this.fcuTex.needsUpdate = true;
    void self;
  };

  P._efisValues = function () {
    var sim = this.sim || {}, p = sim.pfdL || {}, n = sim.ndL || {};
    return { std: p.baroStd !== false, baro: Math.round(p.baroSetting || 1013), mode: n.mode || 'ROSE', range: n.rangeNm || 40,
      terr: !!n.terrainOn, wx: n.weatherOn !== false };
  };
  P._drawEFIS = function (v) {
    var c = this.efisCanvas, g = c.getContext('2d'), W = c.width, H = c.height, rects = [];
    var boeing = this.L.maker === 'boeing';
    g.fillStyle = boeing ? '#4d5257' : '#56636f'; g.fillRect(0, 0, W, H);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#e8ebee'; g.font = 'bold 13px sans-serif'; g.fillText(boeing ? 'BARO' : 'QNH', 75, 12);
    g.fillStyle = '#07090a'; g.fillRect(14, 22, 122, 40);
    g.fillStyle = boeing ? '#f2f2ea' : '#ff9d2e'; g.font = 'bold 28px monospace'; g.fillText(v.std ? 'STD' : String(v.baro), 75, 43);
    rects.push({ x: 14, y: 22, w: 122, h: 40, act: { click: 'baro-std' } });
    g.fillStyle = '#1d1f22'; g.beginPath(); g.arc(75, 104, 26, 0, 7); g.fill();
    g.fillStyle = '#c8ccd0'; g.font = 'bold 18px sans-serif'; g.fillText('◀', 30, 104); g.fillText('▶', 120, 104);
    rects.push({ x: 10, y: 74, w: 65, h: 66, act: { click: 'baro-dec' } });
    rects.push({ x: 75, y: 74, w: 65, h: 66, act: { click: 'baro-inc' } });
    function btn(t, x, y, on, id) {
      g.fillStyle = '#25282c'; g.fillRect(x, y, 56, 50);
      g.fillStyle = on ? '#3dff6a' : '#1e3424'; g.fillRect(x + 14, y + 5, 28, 5);
      g.fillStyle = '#e8ebee'; g.font = 'bold 13px sans-serif'; g.fillText(t, x + 28, y + 30);
      if (id) rects.push({ x: x, y: y, w: 56, h: 50, act: { click: id } });
    }
    btn('FD', 152, 12, true, null); btn('LS', 214, 12, false, null);
    btn('WXR', 152, 76, v.wx, 'nd-weather'); btn('TERR', 214, 76, v.terr, 'nd-terrain');
    function knob(cx, t, sub) {
      g.fillStyle = '#e8ebee'; g.font = 'bold 12px sans-serif'; g.fillText(sub, cx, 14);
      g.fillStyle = '#1d1f22'; g.beginPath(); g.arc(cx, 78, 38, 0, 7); g.fill();
      g.strokeStyle = '#9aa0a6'; g.lineWidth = 2; g.beginPath(); g.arc(cx, 78, 38, 0, 7); g.stroke();
      g.fillStyle = '#ffffff'; g.font = 'bold 18px sans-serif'; g.fillText(t, cx, 80);
    }
    knob(340, v.mode, 'ND MODE');
    rects.push({ x: 300, y: 36, w: 80, h: 84, act: { click: 'nd-mode' } });
    knob(448, String(v.range), 'RANGE');
    g.fillStyle = '#c8ccd0'; g.font = 'bold 14px sans-serif'; g.fillText('−', 418, 124); g.fillText('+', 478, 124);
    rects.push({ x: 404, y: 36, w: 44, h: 100, act: { click: 'nd-range-down' } });
    rects.push({ x: 448, y: 36, w: 48, h: 100, act: { click: 'nd-range-up' } });
    this.efisMeshes.forEach(function (m) { m.userData.rects = rects; });
    this.efisTex.needsUpdate = true;
  };

  /* ---------------- 下部显示器: 系统页 (SD / 下 EICAS) ---------------- */
  P._drawLower = function (st) {
    var c = this.dispCanvas.lower, g = c.getContext('2d'), W = c.width, H = c.height;
    var boeing = this.L.maker === 'boeing';
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.textBaseline = 'middle'; g.textAlign = 'left';
    var cyan = '#3fd7ff', green = '#3dff6a', white = '#f0f0f0', amber = '#ffb000';
    g.fillStyle = white; g.font = 'bold 26px monospace';
    g.fillText(boeing ? 'SYS' : 'STATUS', 18, 26);
    g.strokeStyle = white; g.lineWidth = 2; g.beginPath(); g.moveTo(14, 46); g.lineTo(W - 14, 46); g.stroke();
    // 起落架
    g.font = 'bold 22px monospace'; g.fillStyle = white; g.fillText('GEAR', 18, 76);
    var gp = st.gearPos;
    var gtxt = gp > 0.99 ? 'DN' : (gp < 0.01 ? 'UP' : '--'), gcol = gp > 0.99 ? green : (gp < 0.01 ? white : amber);
    [[120, 'NOSE'], [240, 'LEFT'], [360, 'RIGHT']].forEach(function (p, i) {
      g.strokeStyle = gcol; g.lineWidth = 3; g.strokeRect(p[0], 60, 96, 34);
      g.fillStyle = gcol; g.textAlign = 'center'; g.fillText(gtxt, p[0] + 48, 78); g.textAlign = 'left';
      void i;
    });
    // 襟翼 / 缝翼 / 扰流板
    g.fillStyle = white; g.fillText('FLAPS', 18, 132);
    g.fillStyle = cyan; g.fillText(String(st.flapName || '0'), 120, 132);
    g.strokeStyle = '#777'; g.lineWidth = 2; g.strokeRect(220, 120, 260, 22);
    g.fillStyle = green; g.fillRect(222, 122, 256 * Math.max(0, Math.min(1, st.flapPos || 0)), 18);
    g.fillStyle = white; g.fillText('SPLR', 18, 170);
    g.fillStyle = (st.spoilerPos || 0) > 0.05 ? amber : green; g.fillText((st.spoilerPos || 0) > 0.05 ? 'EXT ' + Math.round(st.spoilerPos * 100) + '%' : 'RET', 120, 170);
    // 燃油
    var fob = st.fuelKg || 0;
    g.fillStyle = white; g.fillText('FOB', 18, 214); g.fillStyle = green; g.fillText(Math.round(fob) + ' KG', 120, 214);
    g.fillStyle = white; g.fillText('L', 18, 252); g.fillText('R', 260, 252);
    g.fillStyle = green; g.fillText(Math.round(fob / 2) + '', 60, 252); g.fillText(Math.round(fob / 2) + '', 300, 252);
    g.fillStyle = white; g.fillText('F.USED', 18, 290); g.fillStyle = green; g.fillText(Math.round(st.fuelUsed || 0) + ' KG', 160, 290);
    // 重量 / 温度 / 刹车
    g.strokeStyle = white; g.beginPath(); g.moveTo(14, 318); g.lineTo(W - 14, 318); g.stroke();
    g.fillStyle = white; g.fillText('GW', 18, 346); g.fillStyle = green; g.fillText(Math.round(st.gw || 0) + ' KG', 80, 346);
    g.fillStyle = white; g.fillText('CG', 300, 346); g.fillStyle = green; g.fillText((st.cgPercent || 0).toFixed(1) + '%', 350, 346);
    g.fillStyle = white; g.fillText('SAT', 18, 384); g.fillStyle = green; g.fillText(Math.round(st.ambientT || 0) + ' °C', 80, 384);
    var bt = st.brakeTemp && st.brakeTemp.length ? Math.max.apply(null, st.brakeTemp) : 0;
    g.fillStyle = white; g.fillText('BRK', 260, 384); g.fillStyle = bt > 300 ? amber : green; g.fillText(Math.round(bt) + ' °C', 320, 384);
    var ft = st.flightTime || 0, hh = Math.floor(ft / 3600), mm = Math.floor(ft / 60) % 60;
    g.fillStyle = white; g.fillText('FLT', 18, 422); g.fillStyle = green; g.fillText(pad(hh, 2) + 'H' + pad(mm, 2), 80, 422);
    g.fillStyle = white; g.fillText('PARK BRK', 260, 422); g.fillStyle = st.parkingBrake ? amber : green; g.fillText(st.parkingBrake ? 'ON' : 'OFF', 420, 422);
    g.fillStyle = white; g.fillText('A/BRK', 18, 460); g.fillStyle = cyan; g.fillText(String(st.autoBrake || 'OFF'), 120, 460);
  };

  /* =====================================================================
     每帧
     ===================================================================== */
  /**
   * @param {number} dt
   * @param {object} st  fm.getState()
   * @param {object} data 仪表公共数据 (与 2D 仪表相同, 由 main.js 生成), 可为 null
   */
  P.update = function (dt, st, data) {
    if (!this.active || !st) return;
    var sim = this.sim;
    // 亮度 (昼夜)
    var day = 1;
    if (sim && sim.env && sim.env.getDayFactor) day = sim.env.getDayFactor();
    var b = Math.max(0.16, Math.min(1, 0.16 + 0.84 * (day === day ? day : 1)));
    if (Math.abs(b - this._bright) > 0.01) {
      this._bright = b;
      this._mats.forEach(function (m) {
        if (m.userData.emissive) return;
        m.color.copy(m.userData.base).multiplyScalar(b);
      });
    }
    // 操纵机构
    this._updateControls(dt, st);
    // 仪表 ~18 Hz
    this._dispT += dt;
    if (this._dispT >= 1 / 18 && data) {
      this._dispT = 0;
      this._renderDisplays(st, data);
    }
    // FCU / EFIS: 只在变化时重绘 (检查频率 10 Hz)
    this._ctlT += dt;
    if (this._ctlT >= 0.1 || !this._sig.fcu) {
      this._ctlT = 0;
      var fv = this._fcuValues(), fs = JSON.stringify(fv);
      if (fs !== this._sig.fcu) { this._sig.fcu = fs; this._drawFCU(fv); }
      var ev = this._efisValues(), es = JSON.stringify(ev);
      if (es !== this._sig.efis) { this._sig.efis = es; this._drawEFIS(ev); }
      // 主警告 / 主警戒 / 起落架灯
      var mw = !!(st.masterWarning || st.stallWarning || st.stickShaker), mc = !!st.masterCaution;
      var blink = mw && (Math.floor(Date.now() / 400) % 2 === 0);
      this.mwMat.color.setHex(mw ? (blink ? 0xff2a1a : 0x9a1408) : 0x3a0806);
      this.mcMat.color.setHex(mc ? 0xffb000 : 0x3a2a04);
      var gp = st.gearPos, gc = gp > 0.99 ? 0x2bff5a : (gp > 0.01 ? 0xff3020 : 0x0c2610);
      this.gearLights.forEach(function (m) { m.color.setHex(gc); });
    }
  };

  P._renderDisplays = function (st, data) {
    var sim = this.sim, D = FS.Displays, t0 = (global.performance && global.performance.now()) || 0;
    if (!D) return;
    if (!this.pfd) {
      this.pfd = new D.PFD(this.dispCanvas.pfd, { side: 'L' });
      this.nd = new D.ND(this.dispCanvas.nd, {});
      this.ecam = new D.ECAM(this.dispCanvas.upper, {});
      [this.pfd, this.nd, this.ecam].forEach(function (d) { d.W = d.canvas.width; d.H = d.canvas.height; d.S = d.W / 480; });
    }
    if (sim && sim.pfdL) { this.pfd.baroStd = sim.pfdL.baroStd; this.pfd.baroSetting = sim.pfdL.baroSetting; }
    if (sim && sim.ndL) {
      this.nd.mode = sim.ndL.mode;
      if (this.nd.rangeNm !== sim.ndL.rangeNm) this.nd.setRange(sim.ndL.rangeNm);
      this.nd.terrainOn = sim.ndL.terrainOn; this.nd.weatherOn = sim.ndL.weatherOn; this.nd.trafficOn = sim.ndL.trafficOn;
    }
    try {
      this.pfd.render(data);
      this.nd.render(data);
      this.ecam.render(data);
      this._drawLower(st);
    } catch (e) {
      if (!this._warned) { this._warned = true; if (FS.Log) FS.Log.warn('3D 驾驶舱仪表渲染错误: ' + e.message); }
    }
    this.dispTex.pfd.needsUpdate = this.dispTex.nd.needsUpdate = this.dispTex.upper.needsUpdate = this.dispTex.lower.needsUpdate = true;
    this.stats.displayFrames++;
    this.stats.lastRenderMs = ((global.performance && global.performance.now()) || 0) - t0;
  };

  P._updateControls = function (dt, st) {
    var sim = this.sim, fm = sim && sim.fm, boeing = this.L.maker === 'boeing';
    if (!fm) return;
    this._time = (this._time || 0) + dt;
    var shake = st.stickShaker ? Math.sin(this._time * 95) * 0.02 : 0;
    var pIn = fm.pilot ? fm.pilot.pitch : 0, rIn = fm.pilot ? fm.pilot.roll : 0;
    var seatR = this.seat === 'R';
    // 空客侧杆: 显示本座位飞行员的输入
    this.sticks.forEach(function (s) {
      var mine = (s.side < 0) !== seatR;
      var p = mine ? pIn : 0, r = mine ? rIn : 0;
      s.g.rotation.x = p * 0.28;
      s.g.rotation.z = -r * 0.30;
    });
    // 波音驾驶盘: 两侧机械联动, AP 接通时由舵面反驱
    if (this.yokes.length) {
      var sf = fm.surfaces || {}, yp, yr;
      if (sim.ap && sim.ap.ap && sim.ap.ap.engaged) { yp = -(sf.elevator || 0); yr = sf.aileron || 0; }
      else { yp = pIn; yr = rIn; }
      this._yp = (this._yp || 0) + (yp - (this._yp || 0)) * Math.min(1, dt * 12);
      this._yr = (this._yr || 0) + (yr - (this._yr || 0)) * Math.min(1, dt * 12);
      var ypv = this._yp, yrv = this._yr;
      this.yokes.forEach(function (y) {
        y.col.rotation.x = ypv * 0.17 + shake;
        y.wheel.rotation.z = -yrv * 1.3;
      });
    }
    // 推力手柄: 空客 A/THR 时停在 CL 卡位; 波音随自动油门移动
    var athr = sim.ap && sim.ap.ap && sim.ap.ap.athr;
    for (var i = 0; i < this.thrLevers.length; i++) {
      var ei = Math.min(i, fm.engines.length - 1);
      var thr = fm.throttle[ei] || 0;
      var rev = st.engines[ei] ? (st.engines[ei].reverser || 0) : 0;
      if (!boeing && athr && !(sim.ap.ap.thrustMode === 'TOGA')) thr = 0.82;
      var ang = rev > 0.05 ? -14 - 22 * rev : -14 + 40 * thr;
      this.thrLevers[i].rotation.x = -ang * DEG;
    }
    var nf = (fm.ac && fm.ac.flaps && fm.ac.flaps.length) || 2;
    var fi = fm.flapDetentIndex !== undefined ? fm.flapDetentIndex : 0;
    this.flapLever.rotation.x = -(16 - 38 * (fi / Math.max(1, nf - 1))) * DEG;
    this.sbLever.rotation.x = -(16 - 36 * Math.max(0, Math.min(1, fm.spoilerCmd || 0))) * DEG;
    // 起落架手柄: 放下 = 向下
    this.gearLever.rotation.x = 0;
    this.gearLever.rotation.z = 0;
    this.gearLever.position.y = this._gearBaseY === undefined ? (this._gearBaseY = this.gearLever.position.y) : this._gearBaseY;
    this.gearLever.rotation.x = 0;
    this.gearLever.scale.y = fm.gearCmd > 0.5 ? -1 : 1;
  };

  /* =====================================================================
     激活 / 隐藏机体外部模型
     ===================================================================== */
  P.setActive = function (on, modelGroup, rig, seat) {
    on = !!on;
    this.seat = seat === 'R' ? 'R' : 'L';
    if (this.seats) {
      var sR = this.seat === 'R';
      this.seats.forEach(function (s) { s.g.visible = sR ? s.side < 0 : s.side > 0; });
    }
    if (on === this.active) return;
    this.active = on;
    this.group.visible = on;
    var self = this;
    if (modelGroup) {
      if (on) {
        this._hidden = [];
        modelGroup.traverse(function (o) {
          if (o === self.group) return;
          if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && !isInside(o, self.group)) {
            self._hidden.push([o, o.visible]); o.visible = false;
          }
        });
      } else if (this._hidden) {
        this._hidden.forEach(function (h) { h[0].visible = h[1]; });
        this._hidden = null;
        if (rig) rig._noseHidden = undefined;
      }
    }
    this._sig = {};
    this._bright = -1;
  };
  function isInside(o, root) { for (var p = o; p; p = p.parent) if (p === root) return true; return false; }

  /* =====================================================================
     点击 (FCU / MCP / EFIS / 起落架手柄)
     ===================================================================== */
  P.pick = function (ndcX, ndcY, camera) {
    if (!this.active) return null;
    var THREE = this.THREE;
    this._ray = this._ray || new THREE.Raycaster();
    this._ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    this._ray.near = 0.02; this._ray.far = 3;
    var hits = this._ray.intersectObjects(this.clickables, false);
    if (!hits.length) return null;
    var h = hits[0], o = h.object;
    if (o.userData.hit) return { fn: o.userData.hit, kind: 'mesh' };
    if (o.userData.rects && h.uv) {
      var cv = o.userData.canvas, px = h.uv.x * cv.width, py = (1 - h.uv.y) * cv.height;
      for (var i = 0; i < o.userData.rects.length; i++) {
        var r = o.userData.rects[i];
        if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return { act: r.act, kind: 'rect' };
      }
    }
    return null;
  };

  /**
   * 找到满足 pred(act) 的可点击区域, 返回其中心在屏幕上的 NDC 坐标 (测试 / 教学提示用)
   * @returns {{x:number,y:number,act:object}|null}
   */
  P.locate = function (pred, camera) {
    var THREE = this.THREE;
    this.group.updateMatrixWorld(true);
    for (var i = 0; i < this.clickables.length; i++) {
      var o = this.clickables[i], rs = o.userData.rects, cv = o.userData.canvas, gp = o.geometry.parameters;
      if (!rs || !cv || !gp) continue;
      for (var j = 0; j < rs.length; j++) {
        var r = rs[j];
        if (!pred(r.act)) continue;
        var u = (r.x + r.w / 2) / cv.width, v = 1 - (r.y + r.h / 2) / cv.height;
        var p = new THREE.Vector3((u - 0.5) * gp.width, (v - 0.5) * gp.height, 0).applyMatrix4(o.matrixWorld).project(camera);
        return { x: p.x, y: p.y, act: r.act };
      }
    }
    return null;
  };

  /** 执行一个点击动作; dir 用于滚轮 (+1 / -1) */
  P.perform = function (hit, mult) {
    if (!hit) return false;
    var sim = this.sim, doc = global.document;
    if (hit.fn) { hit.fn(); return true; }
    var a = hit.act;
    if (!a) return false;
    if (a.knob && sim && sim.hud && sim.hud._knobAdjust) {
      var n = mult || 1, step = a.knob === 'hdg' || a.knob === 'spd' ? 1 : 1;
      for (var i = 0; i < n * step; i++) sim.hud._knobAdjust('fcu-' + a.knob + (a.dir > 0 ? '-inc' : '-dec'), a.dir);
      this._sig.fcu = '';
      return true;
    }
    if (a.click) {
      var e = doc && doc.getElementById(a.click);
      if (e) { e.click(); this._sig.fcu = ''; this._sig.efis = ''; return true; }
    }
    return false;
  };

  P._clickGear = function () {
    var fm = this.sim && this.sim.fm, doc = global.document;
    if (!fm) return;
    var e = doc && doc.getElementById(fm.gearCmd > 0.5 ? 'gear-up' : 'gear-down');
    if (e) e.click();
  };
  P._clickFlap = function () {
    var sim = this.sim, fm = sim && sim.fm;
    if (!fm || !fm.stepFlap) return;
    var name = fm.stepFlap(1);
    if (sim.audio && sim.audio.playCue) sim.audio.playCue('flap_motor');
    if (sim.hud) {
      sim.hud.notify('襟翼 ' + name, 'info', 1500);
      if (sim.hud._highlightFlapDetent) sim.hud._highlightFlapDetent(fm.flapDetentIndex);
    }
  };
  P._clickSpoiler = function () {
    var sim = this.sim, fm = sim && sim.fm;
    if (!fm || !fm.setSpoilers) return;
    fm.setSpoilers(fm.spoilerCmd > 0.5 ? 0 : 1);
    if (sim.audio && sim.audio.playCue) sim.audio.playCue('speedbrake');
    if (sim.hud) sim.hud.notify('减速板 ' + (fm.spoilerCmd > 0.5 ? '放出' : '收回'), 'info', 1500);
  };

  P.dispose = function () {
    if (this.group.parent) this.group.parent.remove(this.group);
    this._geoms.forEach(function (g) { g.dispose(); });
    this._mats.forEach(function (m) { m.dispose(); });
    this._texs.forEach(function (t) { t.dispose(); });
    this._geoms = []; this._mats = []; this._texs = [];
    this.clickables = [];
  };

  /** 交互绑定: 在三维画面上点击 FCU 按钮 / 旋钮, 滚轮转旋钮, 悬停显示手形光标 */
  function bindInteraction(sim) {
    if (!global.addEventListener || bindInteraction._done) return;
    bindInteraction._done = true;
    var held = null;
    function onScene(ev) {
      var id = ev.target && ev.target.id;
      return id === 'viewport' || id === 'hud-canvas';
    }
    function ndc(ev) { return [(ev.clientX / global.innerWidth) * 2 - 1, -(ev.clientY / global.innerHeight) * 2 + 1]; }
    function cp() { return sim.cockpit3d && sim.cockpit3d.active && sim.running ? sim.cockpit3d : null; }
    global.addEventListener('mousedown', function (ev) {
      var c = cp(); if (!c || ev.button !== 0 || !onScene(ev)) return;
      // beta 0.4: 鼠标驾驶杆模式下也允许点击 FCU 按钮 / 旋钮 (点击不参与杆量, 也不会触发 AP 超控断开)
      var n = ndc(ev), hit = c.pick(n[0], n[1], sim.camera);
      if (!hit) return;
      ev.stopPropagation(); ev.preventDefault();
      c.perform(hit, 1);
      if (hit.act && hit.act.knob) {
        var t0 = Date.now();
        held = global.setInterval(function () { if (Date.now() - t0 > 350) c.perform(hit, 1); }, 90);
      }
    }, true);
    global.addEventListener('mouseup', function () { if (held) { global.clearInterval(held); held = null; } }, true);
    global.addEventListener('wheel', function (ev) {
      var c = cp(); if (!c || !onScene(ev)) return;
      var n = ndc(ev), hit = c.pick(n[0], n[1], sim.camera);
      if (!hit || !hit.act || !hit.act.knob) return;
      ev.stopPropagation(); if (ev.cancelable) ev.preventDefault();
      c.perform({ act: { knob: hit.act.knob, dir: ev.deltaY < 0 ? 1 : -1 } }, hit.act.knob === 'alt' ? 1 : 2);
    }, { capture: true, passive: false });
    var lastMove = 0;
    global.addEventListener('mousemove', function (ev) {
      var c = cp(), now = Date.now();
      if (now - lastMove < 80) return; lastMove = now;
      var vp = global.document.getElementById('viewport');
      if (!c || !onScene(ev) || (sim.input && sim.input.mouse && sim.input.mouse.down)) { if (vp && vp.style.cursor) vp.style.cursor = ''; return; }
      var n = ndc(ev), hit = c.pick(n[0], n[1], sim.camera);
      var cur = hit ? 'pointer' : '';
      if (vp && vp.style.cursor !== cur) vp.style.cursor = cur;
      var hc = global.document.getElementById('hud-canvas');
      if (hc && hc.style.cursor !== cur) hc.style.cursor = cur;
    }, true);
  }

  FS.Cockpit3D = Cockpit3D;
  FS.Cockpit3D.layoutFor = layoutFor;
  FS.Cockpit3D.TYPE_LAYOUT = TYPE_LAYOUT;
  FS.Cockpit3D.bindInteraction = bindInteraction;
  if (FS.Log) FS.Log.info('cockpit3d.js 已加载 — 三维驾驶舱 (空客 / 波音布局)');
})(typeof window !== 'undefined' ? window : globalThis);
