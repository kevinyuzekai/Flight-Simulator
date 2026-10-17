/* ==========================================================================
   天际航线 SkyRoute — 三维驾驶舱 (cockpit3d.js, beta 0.4.2)
   --------------------------------------------------------------------------
   · 机长座位第一人称视角: 风挡 / 窗框 / 立柱, 遮光板, FCU (空客) / MCP (波音),
     EFIS 控制板, 主仪表板上按真实尺寸放置的 PFD / ND / ECAM(EICAS) / 系统页,
     中央操纵台 (MCDU, 可拖动的推力手柄, 襟翼 / 减速板手柄, 发动机主电门, 停留刹车),
     空客侧杆 / 波音驾驶盘 (随输入移动, 737/MAX/E190 抖杆时会抖动; 红色 AP 断开按钮可点),
     头顶板外部灯光拨杆 + APU 按钮 (其余区域仍为示意贴图)。
   · 交互: 左键 = 正向, 右键 / Shift+左键 = 反向; 按住拖动推力 / 襟翼 / 减速板;
     滚轮转 FCU 旋钮与手柄; 悬停显示手形光标与控件名称。
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
    'A320ceo': { maker: 'airbus', du: 0.165, k: 1.0 },
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
    var fam = FAMILY[typeKey] || (L.maker === 'boeing' ? 'b737' : 'a320');
    var F = FAM_STYLE[fam];
    return { maker: L.maker, du: L.du, k: L.k, typeKey: typeKey, fam: fam, aspect: F.aspect, hud: F.hud, lowerCenter: F.lowerCenter };
  }

  /* 按机型系列区分驾驶舱 (程序化): 配色 / 显示器形状 (A350/787/C919/737 MAX 宽屏) / 787 HUD / 无下中央屏 (737 MAX, 787, E190) */
  var FAMILY = { 'A320neo': 'a320', 'A320ceo': 'a320', 'A321neo': 'a320', 'A330-300': 'a330', 'A350-900': 'a350', 'A350-1000': 'a350',
    'C919': 'c919', 'B737-800': 'b737', 'B737-MAX8': 'b737max', 'B777-300ER': 'b777', 'B787-9': 'b787', 'E190': 'e190' };
  var FAM_STYLE = {
    a320: { aspect: 1.0, hud: false, lowerCenter: true, pal: {} },
    a330: { aspect: 1.0, hud: false, lowerCenter: true, pal: { panel: 0x56677a, console: 0x526172 } },
    a350: { aspect: 1.32, hud: false, lowerCenter: true, pal: { panel: 0x3d444d, glare: 0x1d2024, console: 0x3a4148, lining: 0x9aa1a8, seat: 0x23272d } },
    c919: { aspect: 1.25, hud: false, lowerCenter: true, pal: { panel: 0x4a5560, console: 0x46515c, seat: 0x2c333b } },
    b737: { aspect: 1.0, hud: false, lowerCenter: true, pal: { panel: 0x6d7a86, console: 0x66737f, lining: 0xb4b0a6, seat: 0x46382f } },
    b737max: { aspect: 1.3, hud: false, lowerCenter: false, pal: { panel: 0x5f6b76, console: 0x5b6772 } },
    b777: { aspect: 1.0, hud: false, lowerCenter: true, pal: {} },
    b787: { aspect: 1.35, hud: true, lowerCenter: false, pal: { panel: 0x34383d, glare: 0x1b1c1e, console: 0x33373c, lining: 0x8f8a80, seat: 0x2a2523 } },
    e190: { aspect: 1.0, hud: false, lowerCenter: false, pal: { panel: 0x4c5864, console: 0x48545f, seat: 0x2f3640 } }
  };

  /* 每系列驾驶舱布局规格 (单位 m, k=1, 原点 = 机长/副驾视点中点高度; x 右, y 上, -z 前)
     参考: Airbus FCOM 驾驶舱总图 / Boeing FCOM 驾驶舱面板图, 以及 Wikimedia Commons 驾驶舱照片 (见 ASSETS_LICENSES.md 1.6)
     ovh: 顶板 前缘(风挡上框后) → 折点 → 后缘 的 [y, z]; w = 顶板半宽 */
  var SPEC = {
    airbus: { ovh: { front: [0.262, -0.775], bend: [0.305, -0.29], aft: [0.35, 0.16], w: 0.41 }, efisWX: false },
    boeing: { ovh: { front: [0.262, -0.775], bend: [0.30, -0.33], aft: [0.35, 0.16], w: 0.42 }, efisWX: true }
  };

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
    this.pal = Object.assign({}, PAL[this.L.maker], FAM_STYLE[this.L.fam].pal);
    this.opts = opts || {};
    this.sim = this.opts.sim || null;
    this.group = new THREE.Group();
    this.group.name = 'cockpit3d';
    this.group.visible = false;
    this._mats = [];
    this._geoms = [];
    this._texs = [];
    this.clickables = [];
    this.controls = [];      // beta 0.4.2: 可动的开关 / 旋钮 / 手柄 (每帧按系统状态动画)
    this.ctlById = {};
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
    // 哑光面板材质: 程序生成的细颗粒 + 轻微磨损/划痕 (乘在底色上)
    var nc = mkCanvas(256, 256), ng = nc.getContext('2d'), rs = 11;
    ng.fillStyle = '#f4f4f4'; ng.fillRect(0, 0, 256, 256);
    for (var ni = 0; ni < 9000; ni++) { rs = (rs * 16807) % 2147483647; var nv = 222 + (rs % 34); ng.fillStyle = 'rgb(' + nv + ',' + nv + ',' + nv + ')'; ng.fillRect(rs % 256, (rs >> 8) % 256, 1 + (rs % 2), 1); }
    ng.strokeStyle = 'rgba(255,255,255,0.35)'; ng.lineWidth = 1;
    for (ni = 0; ni < 26; ni++) { rs = (rs * 16807) % 2147483647; var sx0 = rs % 256, sy0 = (rs >> 9) % 256; ng.beginPath(); ng.moveTo(sx0, sy0); ng.lineTo(sx0 + (rs % 40) - 20, sy0 + ((rs >> 4) % 12) - 6); ng.stroke(); }
    var edge = ng.createLinearGradient(0, 0, 0, 256); edge.addColorStop(0, 'rgba(0,0,0,0.10)'); edge.addColorStop(0.06, 'rgba(0,0,0,0)'); edge.addColorStop(0.94, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(0,0,0,0.12)');
    ng.fillStyle = edge; ng.fillRect(0, 0, 256, 256);
    var ntex = this._tex(nc);
    ['lining', 'glare', 'frame', 'console', 'seat', 'panel', 'floor', 'door'].forEach(function (key) { M[key].map = ntex; M[key].needsUpdate = true; });

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
    // 遮光板软垫 (圆角唇边)
    [-1, 1].forEach(function (sd) { self._cyl(0.022 * k, 0.022 * k, 0.36 * k, 16, M.glare, sd * 0.80 * k, -0.262 * k, -0.648 * k, 0, 0, Math.PI / 2); });   // 只在 FCU/EFIS 外侧, 不遮挡面板
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
    this._buildSwitchPanels();

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
  /* Airbus 实拍面板贴图 (Wikimedia Commons, 见 ASSETS_LICENSES.md 1.6) */
  P._abImg = function (key) {
    var T = FS.CKPT_TEX_AIRBUS; if (!T || !T[key] || this.L.maker === 'boeing' || this.L.fam === 'e190') return null;
    this._abImgs = this._abImgs || {};
    var im = this._abImgs[key], self = this;
    if (!im) { im = this._abImgs[key] = new Image(); im.onload = function () { if (self._sig) { self._sig.fcu = self._sig.efis = null; } if (self._ovhRedraw) self._ovhRedraw(); }; im.src = T[key].src; }
    return im.complete && im.naturalWidth ? im : null;
  };
  P._buildGlareshieldUnits = function () {
    var L = this.L, k = L.k, boeing = L.maker === 'boeing', M = this.M;
    var abTex = !boeing && L.fam !== 'e190' && FS.CKPT_TEX_AIRBUS;
    this._abFCU = !!abTex;
    var hw = (boeing ? 0.40 : (abTex ? 0.21 : 0.32)) * k, h = abTex ? hw * 2 * 351 / 1024 : 0.074, y = -0.293 * k, z = -0.626 * k, tilt = -0.16;
    this._box(hw * 2 + 0.01, h + 0.012, 0.05 * k, M.frame, 0, y, z - 0.026 * k, tilt);
    this.fcuCanvas = mkCanvas(1024, abTex ? 351 : 128);
    this.fcuTex = this._tex(this.fcuCanvas);
    var fm = this._mat(0xffffff, { flat: true, map: this.fcuTex });
    this.fcuMesh = this._plane(hw * 2, h, fm, 0, y, z, tilt);
    this.fcuMesh.userData.canvas = this.fcuCanvas; this.fcuMesh.userData.rects = [];
    this.clickables.push(this.fcuMesh);
    // EFIS 控制板 (两侧共用一张贴图)
    this.efisCanvas = mkCanvas(512, abTex ? 273 : 144);
    this.efisTex = this._tex(this.efisCanvas);
    var em = this._mat(0xffffff, { flat: true, map: this.efisTex });
    var ew = (abTex ? h * 512 / 273 : 0.25 * k), ex = hw + (abTex ? 0.01 : 0.035) * k + ew / 2;
    this.efisMeshes = [];
    if (abTex) { this.efisCanvasR = mkCanvas(512, 287); this.efisTexR = this._tex(this.efisCanvasR); }
    for (var s = -1; s <= 1; s += 2) {
      var R = abTex && s > 0, ewS = R ? h * 512 / 287 : ew, exS = hw + (abTex ? 0.01 : 0.035) * k + ewS / 2;
      this._box(ewS + 0.01, h + 0.012, 0.04 * k, M.frame, s * exS, y, z - 0.022 * k, tilt);
      var e = this._plane(ewS, h, R ? this._mat(0xffffff, { flat: true, map: this.efisTexR }) : em, s * exS, y, z, tilt);
      e.userData.canvas = R ? this.efisCanvasR : this.efisCanvas; e.userData.rects = []; e.userData.side = s;
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
    var dw = du * (L.aspect || 1);
    function screen(key, x, y, w) {
      w = w || dw;
      // 斜边显示器框: 外框 (凸起) + 内倒角
      self._box(w + 0.034, du + 0.034, 0.012, M.frame, x, y, 0.002, 0, 0, 0, pg);
      self._box(w + 0.020, du + 0.020, 0.016, M.bezel, x, y, 0.002, 0, 0, 0, pg);
      return self._plane(w, du, dmat[key], x, y, 0.0105, 0, 0, 0, pg);
    }
    var ex = this.eyeX, dy = -(0.014 + du / 2);
    var cxW = L.aspect > 1 ? Math.max(cw, dw / 2 + 0.03) : cw;
    var pfdX = ex - dw / 2 - 0.014, ndX = pfdX + dw + 0.028;
    if (ndX + dw / 2 > -(cxW + 0.02)) { ndX = -(cxW + 0.02) - dw / 2; pfdX = ndX - dw - 0.028; }   // 机长侧在 -x
    this.screens = {
      pfdL: screen('pfd', pfdX, dy),
      ndL: screen('nd', ndX, dy),
      ndR: screen('nd', -ndX, dy),
      pfdR: screen('pfd', -pfdX, dy),
      // 787: 主仪表板 4 块 15" 横屏 + 下中央 1 块 (共 5 块) — 中央上方不设显示器
      upper: L.fam === 'b787' ? screen('upper', 0, dy - du - 0.03, du * 1.05) : screen('upper', 0, dy, Math.min(dw, 2 * (-ndX - dw / 2) - 0.03)),
      lower: L.lowerCenter ? screen('lower', 0, dy - du - 0.03, du) : null
    };
    if (L.hud) {
      var hm = this._mat(0x9fe6c0, { flat: true, transparent: true, opacity: 0.16, toneMapped: false });
      hm.depthWrite = false;
      var hg = new THREE.Group(); hg.position.set(this.eyeX, 0.0, -0.42 * k); this.group.add(hg);
      this._plane(0.20, 0.15, hm, 0, 0, 0, 0, 0, 0, hg);
      this._box(0.012, 0.012, 0.22, M.frame, 0, 0.085, 0.10, 0, 0, 0, hg);
    }
    // 备用仪表 (小圆表, 静态外观)
    var stby = mkCanvas(128, 128); this._drawStandby(stby);
    var sm = this._mat(0xffffff, { flat: true, map: this._tex(stby), toneMapped: false, emissive: true });
    this._plane(0.075, 0.075, M.bezel, -cw - 0.055, -hS + 0.06, 0.004, 0, 0, 0, pg);
    this._plane(0.065, 0.065, sm, -cw - 0.055, -hS + 0.06, 0.007, 0, 0, 0, pg);
    // Airbus: TERR ON ND 按钮在每侧 PFD 外侧的侧面板上 (Boeing 的 TERR/WXR 在 EFIS 控制板上)
    if (!boeing && L.fam !== 'e190') {
      for (var ts = -1; ts <= 1; ts += 2) {
        var tx = ts * (Math.abs(pfdX) + dw / 2 + 0.045), tlm = this._lampMat();
        this._plane(0.034, 0.03, M.bezel, tx, dy - du * 0.3, 0.005, 0, 0, 0, pg);
        this._plane(0.026, 0.008, tlm, tx, dy - du * 0.3 + 0.007, 0.008, 0, 0, 0, pg);
        this._ctl(this._hitbox(0.04, 0.036, 0.02, tx, dy - du * 0.3, 0.01, pg), { id: 'terr-on-nd-' + (ts < 0 ? 'L' : 'R'), tip: 'TERR ON ND',
          click: function () { var e = global.document && global.document.getElementById('nd-terrain'); if (e) e.click(); } });
        this._regLamp(tlm, function () { return lit('nd-terrain') ? 0x3dff6a : 0; });
      }
    }

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
    // 起落架手柄: 点击 = 收 / 放; 滚轮向上 = 收, 向下 = 放 (整根手柄都是点击区)
    this._ctl(this._hitbox(0.06, 0.16, 0.05, 0, 0.035, 0.02, gl), {
      id: 'gear', tip: '起落架手柄 (点击收 / 放)',
      click: function () { self._clickGear(); },
      wheel: function (dir) { self._clickGear(dir > 0 ? 'up' : 'down'); }
    });
    this._gearWheel = wheel;
    void boeing;
  };

  /* ---------------- 中央操纵台 ---------------- */
  P._buildPedestal = function () {
    /* 按系列布置中央操纵台 (参考公开照片 / FCOM 式布局描述, 示意性还原, 无厂商标志):
       空客: 前部 MCDU (A350: KCCU 键盘 + 轨迹球), 推力手柄 (TOGA / FLX-MCT / CL / IDLE / REV 卡位, A/THR 时手柄不动),
             左侧减速板 / 右侧襟翼 (0-1-2-3-FULL), 手柄后方 ENG MASTER + ENG MODE, 后部 RMP 无线电, 方向舵配平, 停留刹车;
       波音: 推力手柄 (TO/GA 按钮 + A/T 断开按钮 + 反推手柄), 手柄下方燃油控制电门 (737 起动手柄), 左减速板 / 右襟翼 (带闸口),
             737 两侧安定面配平手轮, 777 / 787 后部光标控制器 (CCD), 787 多功能键盘;
       E190: 推力手柄 (TO/GA), 左减速板 / 右襟翼, 前部 MCDU。 */
    var THREE = this.THREE, L = this.L, k = L.k, M = this.M, boeing = L.maker === 'boeing', fam = L.fam, self = this;
    var pd = this._panelDims, tilt = 0.165;
    var py0 = -0.34 * k - pd.hC * Math.cos(tilt), pz0 = -0.70 * k + pd.hC * Math.sin(tilt);
    var wide = fam === 'a350' || fam === 'b787' || fam === 'b777';
    var PL = (FS.PEDESTAL_LAYOUTS || {})[fam] || null; this._pedLayout = PL;
    var YF = -1.15 * k, top = py0 - 0.004, zEnd = 0.36 * k, pw = Math.min(pd.cw * 0.95, 0.24 * k) * (wide ? 1.12 : 1);
    if (PL && PL.pw) pw = PL.pw * k;   // 数据布局: 按真实宽度 (两块 146 mm 标准面板 + 推力扇区)
    this._box(pw * 2, top - YF, zEnd - pz0, M.console, 0, (top + YF) / 2, (pz0 + zEnd) / 2);
    this._pedTop = top;
    function plate(w, h, x, z, lines, opts) {          // 操纵台上平放的带字铭牌
      opts = opts || {};
      var c = mkCanvas(Math.ceil(w * 1400), Math.ceil(h * 1400)), g = c.getContext('2d');
      g.fillStyle = opts.bg || hex(self.pal.panel); g.fillRect(0, 0, c.width, c.height);
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3; g.strokeRect(2, 2, c.width - 4, c.height - 4);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      lines.forEach(function (l) { g.fillStyle = l[4] || '#eef1f3'; g.font = 'bold ' + Math.round(l[3] * 1400) + 'px sans-serif'; g.fillText(l[0], (l[1] + w / 2) * 1400, (h / 2 - l[2]) * 1400); });
      if (opts.draw) opts.draw(g, c.width, c.height);
      return self._plane(w, h, self._mat(0xffffff, { flat: true, map: self._tex(c) }), x, (opts.y || top) + 0.002, z, -Math.PI / 2);
    }
    // ---- 前部: MCDU / KCCU / CDU / 787 键盘 ----
    var fz = pz0 + 0.11;
    if (fam === 'a350') {
      for (var s = -1; s <= 1; s += 2) {
        var kz = plate(pw * 0.86, 0.15, s * pw * 0.5, fz, [['KCCU', 0, 0.06, 0.010]], { bg: '#2a2f35', draw: function (g, W, H) {
          g.fillStyle = '#5b636b'; for (var r = 0; r < 4; r++) for (var q = 0; q < 10; q++) g.fillRect(W * (0.06 + q * 0.07), H * (0.25 + r * 0.13), W * 0.055, H * 0.1);
          g.fillStyle = '#111'; g.beginPath(); g.arc(W * 0.86, H * 0.55, H * 0.16, 0, Math.PI * 2); g.fill(); } });
        void kz;
        this._cyl(0.016, 0.016, 0.01, 14, M.stick, s * pw * 0.5 + pw * 0.86 * 0.36, top + 0.006, fz + 0.005);
      }
    } else if (fam === 'b787') {
      for (s = -1; s <= 1; s += 2) plate(pw * 0.86, 0.13, s * pw * 0.5, fz, [['MFK', 0, 0.05, 0.010]], { bg: '#26292d', draw: function (g, W, H) {
        g.fillStyle = '#545a60'; for (var r = 0; r < 4; r++) for (var q = 0; q < 9; q++) g.fillRect(W * (0.07 + q * 0.095), H * (0.25 + r * 0.17), W * 0.075, H * 0.12); } });
    } else {
      var mc = mkCanvas(256, 320); this._drawMCDU(mc);
      var mm = this._mat(0xffffff, { flat: true, map: this._tex(mc), toneMapped: false, emissive: true });
      for (s = -1; s <= 1; s += 2) {
        var g = new THREE.Group(); g.position.set(s * pw * 0.5, top + 0.035, fz); g.rotation.x = -1.05; this.group.add(g);
        if (PL && PL.mcdu) g.position.x = s * PL.mcdu.x * k;
        var mw = PL && PL.mcdu ? PL.mcdu.w * k : pw * 0.9;
        this._box(mw, 0.17, 0.05, M.frame, 0, 0, -0.026, 0, 0, 0, g);
        this._plane(mw * 0.955, 0.16, mm, 0, 0, 0.001, 0, 0, 0, g);
      }
    }
    // ---- 推力手柄座 ----
    var qz = pz0 + 0.34, qLen = 0.22, qw = boeing ? 0.17 : 0.20;
    this._box(qw, 0.05, qLen, M.frame, 0, top + 0.02, qz);
    // 侧面卡位刻度 (左侧面)
    var det = boeing ? [['TO/GA', 0.08], ['CLB', 0.03], ['IDLE', -0.06], ['REV', -0.095]] :
      [['TOGA', 0.09], ['FLX/MCT', 0.055], ['CL', 0.02], ['IDLE', -0.06], ['REV', -0.095]];
    plate(0.05, qLen, -qw / 2 - 0.026, qz, det.map(function (d) { return [d[0], 0, d[1], 0.0085, d[0] === 'REV' ? '#ff9d2e' : '#eef1f3']; }), { y: top + 0.045 });
    if (!boeing && fam !== 'e190') plate(0.05, qLen, qw / 2 + 0.026, qz, det.map(function (d) { return [d[0], 0, d[1], 0.0085, d[0] === 'REV' ? '#ff9d2e' : '#eef1f3']; }), { y: top + 0.045 });
    this.thrLevers = [];
    for (var i = 0; i < 2; i++) {
      var sd = i === 0 ? -1 : 1;
      var lv = new THREE.Group(); lv.position.set(sd * (boeing ? 0.035 : 0.045), top - 0.02, qz); this.group.add(lv);
      this._box(0.016, 0.20, 0.02, M.lever, 0, 0.10, 0, 0, 0, 0, lv);
      if (boeing || fam === 'e190') {
        this._cyl(0.016, 0.016, 0.07, 12, M.knob, sd * 0.02, 0.205, 0, 0, 0, Math.PI / 2, lv);
        this._box(0.012, 0.008, 0.01, M.stick, sd * 0.02, 0.19, -0.018, 0, 0, 0, lv);          // TO/GA 按钮 (手柄前下方)
        this._box(0.008, 0.012, 0.012, M.red, sd * 0.056, 0.205, 0, 0, 0, 0, lv);             // A/T 断开按钮 (外侧)
        this._box(0.01, 0.06, 0.012, M.stick, 0, 0.16, -0.022, 0.5, 0, 0, lv);                  // 反推手柄 (背驮式)
      } else {
        // Airbus: 两根手柄平行于机身轴线, 手柄头为居中的黑色横握把
        this._box(0.044, 0.030, 0.034, M.stick, 0, 0.205, 0, 0, 0, 0, lv);
        this._box(0.046, 0.006, 0.036, M.frame, 0, 0.188, 0, 0, 0, 0, lv);
        this._box(0.008, 0.010, 0.020, M.red, sd * 0.024, 0.205, 0, 0, 0, 0, lv);                  // A/THR 断开按钮 (外侧)
      }
      this.thrLevers.push(lv);
      this._ctl(this._hitbox(0.05, 0.075, 0.05, 0, 0.18, 0, lv), this._throttleCtl(i));
    }
    // 737: 两侧安定面配平手轮
    this.trimWheels = [];
    var abTrim = !boeing && fam !== 'e190';
    if (fam === 'b737' || fam === 'b737max' || abTrim) {
      // 737: 安定面配平手轮; 空客: 俯仰配平手轮 (推力扇区两侧, 黑色带白条)
      for (s = -1; s <= 1; s += 2) {
        if (abTrim) {
          var aw = new THREE.Group(); aw.position.set(s * (PL && PL.trimX ? PL.trimX * k : qw / 2 + 0.065), top + 0.02, qz); this.group.add(aw);
          this._cyl(0.11, 0.11, 0.018, 28, M.stick, 0, 0, 0, 0, 0, Math.PI / 2, aw);
          this._box(0.020, 0.012, 0.05, M.knob, 0, 0.105, 0, 0, 0, 0, aw);
          this.trimWheels.push(aw); continue;
        }
        var tw = new THREE.Group(); tw.position.set(s * (qw / 2 + 0.03), top + 0.03, qz + 0.02); this.group.add(tw);
        this._cyl(0.085, 0.085, 0.022, 24, M.stick, 0, 0, 0, 0, 0, Math.PI / 2, tw);
        this._box(0.024, 0.01, 0.17, M.knob, 0, 0.0, 0, 0, 0, 0, tw);   // 白色条纹
        this.trimWheels.push(tw);
      }
    }
    // ---- 减速板 (左) / 襟翼 (右, 带闸口铭牌) ----
    var lx = qw / 2 + ((fam === 'b737' || fam === 'b737max') ? 0.08 : 0.04);
    var mkLever = function (x, color) {
      var g = new THREE.Group(); g.position.set(x, top - 0.015, qz + 0.02); this.group.add(g);
      this._box(0.012, 0.14, 0.014, M.lever, 0, 0.07, 0, 0, 0, 0, g);
      this._box(boeing ? 0.05 : 0.045, 0.022, boeing ? 0.04 : 0.03, color, 0, 0.145, 0, 0, 0, 0, g);
      return g;
    }.bind(this);
    if (!boeing && fam !== 'e190') {
      // Airbus (A320/A330/A350 实拍参考): 减速板在操纵台左缘、襟翼在右缘, 均位于推力手柄扇区后半段旁,
      // 从操纵台顶面的导槽伸出 (短杆); 减速板 = 灰色扁 T 形手柄, 襟翼 = 方形大握把
      var ex2 = PL && PL.levX ? PL.levX * k : qw / 2 + 0.065, lz = qz + qLen / 2 + (PL && PL.levZ !== undefined ? PL.levZ * k : 0.07);   // 参考照片 (A32S Pedestal / Thrust levers of an Airbus A320): 在配平手轮正后方, ENG MASTER 面板左右两侧外缘, 与 ENG MASTER 同一前后位置
      lx = ex2;
      mkLever = function (x, kind) {
        var g = new THREE.Group(); g.position.set(x, top, lz); this.group.add(g);
        this._box(0.010, 0.075, 0.012, M.lever, 0, 0.0375, 0, 0, 0, 0, g);
        if (kind === 'flap') { this._box(0.040, 0.030, 0.034, M.knob, 0, 0.082, 0, 0, 0, 0, g); this._box(0.042, 0.006, 0.036, M.frame, 0, 0.066, 0, 0, 0, 0, g); }
        else { this._box(0.046, 0.012, 0.022, M.lever, 0, 0.080, 0, 0, 0, 0, g); this._cyl(0.006, 0.006, 0.046, 10, M.lever, 0, 0.086, -0.008, 0, 0, Math.PI / 2, g); }
        return g;
      }.bind(this);
      // 顶面导槽
      this._box(0.014, 0.003, 0.10, M.black, ex2, top + 0.0015, lz + 0.02);
      this._box(0.014, 0.003, 0.10, M.black, -ex2, top + 0.0015, lz);
      this.flapLever = mkLever(ex2, 'flap'); this.flapLever.position.z += 0.015;   // 襟翼略靠后
      this.sbLever = mkLever(-ex2, 'sb');
    } else {
      this.flapLever = mkLever(lx, M.knob);
      this.sbLever = mkLever(-lx, M.stick);
    }
    var flaps = safe(function () { return FS.AIRCRAFT_DB[L.typeKey].flaps.map(function (f) { return f.name; }); }, null) || ['0', '1', '2', '3', 'FULL'];
    var abPl = !boeing && fam !== 'e190', plX = abPl ? lx - 0.03 : lx + 0.045, plZ = abPl ? lz + 0.02 : qz, plL = abPl ? 0.11 : qLen, plY = abPl ? top + 0.003 : top + 0.045;
    plate(0.035, plL, plX, plZ, [['FLAPS', 0, qLen / 2 - 0.012, 0.008]].concat(flaps.map(function (n, j) {
      return [n, 0, plL / 2 - 0.035 - j * (plL - 0.05) / Math.max(1, flaps.length - 1), 0.0085, boeing ? '#ffffff' : '#ff9d2e']; })), { y: plY });
    plate(abPl ? 0.035 : 0.045, abPl ? 0.11 : qLen * 0.7, abPl ? -plX : -lx - 0.045, abPl ? lz : qz - qLen * 0.15, [[boeing ? 'SPD BRK' : 'SPEED', 0, 0.065, 0.008], [boeing ? 'DOWN' : 'RET', 0, 0.045, 0.008],
      ['ARM', 0, 0.025, 0.008, '#9dff8f'], ['FLT', 0, -0.01, 0.008], [boeing ? 'UP' : 'FULL', 0, -0.05, 0.008]], { y: plY });
    var selfPed = this;
    this._ctl(this._hitbox(abPl ? 0.034 : 0.06, abPl ? 0.03 : 0.18, abPl ? 0.04 : 0.05, 0, abPl ? 0.074 : 0.08, abPl ? 0 : 0.02, this.flapLever), {
      id: 'flap', tip: '襟翼手柄 (左键放 / 右键收 / 滚轮 / 拖动)',
      click: function (dir) { selfPed._clickFlap(dir); },
      wheel: function (dir) { selfPed._clickFlap(-dir); },
      drag: this._stepDrag(function (dir) { selfPed._clickFlap(dir); }, 0.035)
    });
    this._ctl(this._hitbox(abPl ? 0.034 : 0.06, abPl ? 0.03 : 0.18, abPl ? 0.04 : 0.05, 0, abPl ? 0.074 : 0.08, abPl ? 0 : 0.02, this.sbLever), {
      id: 'speedbrake', tip: '减速板手柄 (左键放出 / 收回, 右键地面扰流板预位, 滚轮 / 拖动)',
      click: function (dir) { if (dir < 0) selfPed._clickSpoilerArm(); else selfPed._clickSpoiler(); },
      wheel: function (dir) { selfPed._stepSpoiler(-dir); },
      drag: this._stepDrag(function (dir) { selfPed._stepSpoiler(dir); }, 0.04)
    });
    this._pedGeo = { top: top, qz: qz, qLen: qLen, zEnd: zEnd, pw: pw };
    // ---- 后部: 无线电 (RMP / VHF) + 系列特有部件 ----
    var rz0 = qz + qLen / 2 + 0.17, rz1 = zEnd - (boeing ? 0.0 : 0.11);
    if (PL) { /* 数据布局: 后部面板在 _buildSwitchPanels 中按数据生成 */ } else if (fam === 'b777' || fam === 'b787') {       // 光标控制器 (CCD) 左右各一, 中间无线电
      for (s = -1; s <= 1; s += 2) plate(pw * 0.55, 0.13, s * pw * 0.66, rz0 + 0.08, [['CCD', 0, 0.05, 0.009]], { bg: '#25282c', draw: function (g, W, H) {
        g.fillStyle = '#3e444a'; g.fillRect(W * 0.18, H * 0.28, W * 0.64, H * 0.5); g.fillStyle = '#5a6168'; g.fillRect(W * 0.25, H * 0.82, W * 0.5, H * 0.1); } });
      var rc = mkCanvas(256, 256); this._drawRadio(rc);
      this._plane(pw * 0.7, rz1 - rz0, this._mat(0xffffff, { flat: true, map: this._tex(rc) }), 0, top + 0.002, (rz0 + rz1) / 2, -Math.PI / 2);
    } else {
      rc = mkCanvas(256, 256); this._drawRadio(rc);
      this._plane(pw * 1.9, rz1 - rz0, this._mat(0xffffff, { flat: true, map: this._tex(rc) }), 0, top + 0.002, (rz0 + rz1) / 2, -Math.PI / 2);
    }
    if (!boeing && !PL) {
      // 方向舵配平面板 (旋钮 + 显示) 最后部; 停留刹车面板在 _buildSwitchPanels 中放在其左侧
      plate(pw * 0.9, 0.09, pw * 0.5, zEnd - 0.055, [['RUD TRIM', 0, 0.03, 0.009], ['L 0.0', 0, 0.0, 0.012, '#ff9d2e'], ['NOSE L    RESET    NOSE R', 0, -0.03, 0.006]]);
      this._cyl(0.014, 0.014, 0.012, 14, M.stick, pw * 0.5 + 0.045, top + 0.008, zEnd - 0.055);
    }
    this._pedFam = { rudTrimZ: zEnd - 0.055 };
    // Airbus: 气象雷达 (WXR) 控制板在中央操纵台后部 -> WXR 开关放在这里 (不在 EFIS 上)
    if (!boeing && L.fam !== 'e190' && !PL) {
      var wl = this._lampMat(), self2 = this, wz = zEnd - 0.17;
      this._box(pw * 0.8, 0.006, 0.07, M.panel, 0, top + 0.003, wz);
      this._plane(0.03, 0.02, wl, -pw * 0.25, top + 0.008, wz, -Math.PI / 2);
      this._ctl(this._hitbox(0.05, 0.03, 0.05, -pw * 0.25, top + 0.01, wz), { id: 'wxr', tip: '气象雷达 WX (中央操纵台后部雷达控制板)',
        click: function () { var e = global.document && global.document.getElementById('nd-weather'); if (e) e.click(); } });
      this._regLamp(wl, function () { return lit('nd-weather') ? 0x3dff6a : 0; });
      void self2;
    }
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
        this._ctl(this._hitbox(0.03, 0.03, 0.035, 0.008 * -s, 0.165, -0.02, st), this._apDiscCtl('sidestick-ap-disc-' + (s < 0 ? 'L' : 'R'), '侧杆 AP 断开按钮 (红色)'));
        // 扶手
        this._box(0.10, 0.04, 0.28, M.console, s * 0.80 * k, top + 0.02, -0.05 * k);
        this.sticks.push({ side: s, g: st });
        // 收起的小桌板 (Airbus 侧杆前方, 主仪表板下)
        var ex = s < 0 ? this.eyeX : -this.eyeX;
        this._box(0.34 * k, 0.012, 0.10 * k, M.console, ex, -0.615 * k, -0.62 * k);   // 收起状态, 贴在主仪表板下方
        this._box(0.12 * k, 0.006, 0.008, M.frame, ex, -0.612 * k, -0.568 * k);
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
        // 驾驶盘外侧握把上的 AP 断开按钮 (红色)
        var gs = s < 0 ? -1 : 1;
        this._cyl(0.008, 0.008, 0.008, 8, M.red, gs * 0.16, 0.115, 0.03, Math.PI / 2, 0, 0, wh);
        this._ctl(this._hitbox(0.04, 0.04, 0.03, gs * 0.16, 0.115, 0.03, wh), this._apDiscCtl('yoke-ap-disc-' + (s < 0 ? 'L' : 'R'), '驾驶盘 AP 断开按钮 (红色)'));
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
    var k = this.L.k, self = this, boeing = this.L.maker === 'boeing';
    var O = (boeing ? SPEC.boeing : SPEC.airbus).ovh, w = O.w * k;
    var F = [O.front[0] * k, O.front[1] * k], Bd = [O.bend[0] * k, O.bend[1] * k], A = [O.aft[0] * k, O.aft[1] * k];
    var l1 = Math.hypot(Bd[0] - F[0], Bd[1] - F[1]), l2 = Math.hypot(A[0] - Bd[0], A[1] - Bd[1]), lt = l1 + l2;
    // 贴图画布按面板实际展开尺寸取宽高比 -> 不拉伸
    var CW = 1024, CH = Math.round(CW * lt / (2 * w));
    var oc = mkCanvas(CW, CH), ot = this._tex(oc), photo = false;   // 顶板由三维可操作开关面板组成, 不再叠加照片 (避免照片按钮与真实开关错位)
    var draw = function () {
      var g = oc.getContext('2d');
      self._drawOverhead(oc);
      var im = photo && self._abImg('overhead');
      if (im) {
        // 照片 (前部各系统面板, 1024x689) 按原比例放在顶板前段 (画布下方 = 前缘)
        var ph = Math.round(CW * 689 / 1024);
        g.drawImage(im, 0, CH - ph, CW, ph);
        // 后段: 维护 / 断路器面板 (程序绘制)
        g.fillStyle = '#4b5a69'; g.fillRect(0, 0, CW, CH - ph);
        g.fillStyle = '#d9dde2'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center';
        g.fillText('MAINTENANCE PANEL', CW / 2, 30);
        for (var r = 0; r < Math.floor((CH - ph - 50) / 26); r++) for (var c = 0; c < 40; c++) {
          g.fillStyle = '#1b1e22'; g.beginPath(); g.arc(30 + c * 24.5, 60 + r * 26, 6, 0, 7); g.fill();
        }
      }
      ot.needsUpdate = true;
    };
    this._ovhRedraw = draw; draw();
    var om = this._mat(0xffffff, { map: ot }), vb = l2 / lt;
    var P0 = [-w, F[0], F[1]], P1 = [w, F[0], F[1]], P2 = [w, Bd[0], Bd[1]], P3 = [-w, Bd[0], Bd[1]], P4 = [w, A[0], A[1]], P5 = [-w, A[0], A[1]];
    this._poly([P0, P1, P2, P3].reverse(), om, null, [[0, 0], [1, 0], [1, 1 - vb], [0, 1 - vb]].reverse());
    this._poly([P3, P2, P4, P5].reverse(), om, null, [[0, 1 - vb], [1, 1 - vb], [1, 1], [0, 1]].reverse());
    // 两侧边框 (沿面板边缘, 不向下伸出)
    [-1, 1].forEach(function (s) {
      self._bar([s * (w + 0.012), F[0], F[1]], [s * (w + 0.012), Bd[0], Bd[1]], 0.024, self.M.frame);
      self._bar([s * (w + 0.012), Bd[0], Bd[1]], [s * (w + 0.012), A[0], A[1]], 0.024, self.M.frame);
    });
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
      this._cyl(0.06, 0.06, 0.50, 14, M.seat, 0, -0.70 * k + 0.0, -0.33, 0, 0, Math.PI / 2, g);   // 坐垫前缘圆角
      this._cyl(0.055, 0.055, 0.66, 14, M.seat, 0.24, -0.30 * k, 0.15, -0.18, 0, 0, g);           // 靠背侧翼
      this._cyl(0.055, 0.055, 0.66, 14, M.seat, -0.24, -0.30 * k, 0.15, -0.18, 0, 0, g);
      this._box(0.40, 0.035, 0.05, M.frame, 0, -0.795 * k, -0.08, 0, 0, 0, g);                  // 座椅底架
      this.seats.push({ side: s, g: g });
    }
  };

  /** 遮阳板、侧窗玻璃、脚蹬、氧气面罩、跳座椅、断路器面板、地毯等细节 */
  P._buildExtras = function () {
    var THREE = this.THREE, k = this.L.k, M = this.M, V = this._v.bind(this), self = this;
    var YF = -1.15 * k;
    // 半透明侧窗玻璃 (加深舱内立体感, 不挡视线太多)
    var glass = this._mat(0x6a8098, { flat: true, transparent: true, opacity: 0.10, toneMapped: false });
    glass.userData.emissive = true;
    [1, -1].forEach(function (sx) {
      function S(p) { return sx > 0 ? p : [-p[0], p[1], p[2]]; }
      self._poly([S(V(-0.975, -0.18, -0.55)), S(V(-0.975, -0.18, 0.18)), S(V(-0.915, 0.20, 0.18)), S(V(-0.915, 0.20, -0.55))], glass);
      // 遮阳板 (风挡上方内侧) + 收纳滑轨
      var vis = self._box(0.28 * k, 0.012, 0.16 * k, M.door, sx * 0.36 * k, 0.18 * k, -0.72 * k, 0.55, 0, sx * 0.08);
      vis.rotation.x = 0.15;
      self._bar([sx * 0.22 * k, 0.235 * k, -0.76 * k], [sx * 0.50 * k, 0.225 * k, -0.74 * k], 0.012 * k, M.frame);
    });

    /* ---- 方向舵脚蹬 (机长 / 副驾两侧, 带支臂) ---- */
    var pedY = -1.05 * k, pedZ = -0.56 * k;
    [1, -1].forEach(function (sx) {
      var px = sx * 0.53 * k;
      self._box(0.085 * k, 0.02 * k, 0.14 * k, M.stick, px - 0.10 * k, pedY, pedZ, -0.35, 0, 0);
      self._box(0.085 * k, 0.02 * k, 0.14 * k, M.stick, px + 0.10 * k, pedY, pedZ, -0.35, 0, 0);
      // 脚蹬支臂 (向前下方接到地板)
      self._bar([px, pedY + 0.01 * k, pedZ], [px, YF + 0.06 * k, pedZ - 0.16 * k], 0.02 * k, M.frame);
    });

    /* ---- 第三乘员跳座椅 (中央后方) + 氧气面罩 ---- */
    var js = new THREE.Group(); js.position.set(0, 0, 0.50 * k); this.group.add(js);
    self._box(0.44 * k, 0.10 * k, 0.42 * k, M.seat, 0, -0.72 * k, 0, 0, 0, 0, js);
    self._box(0.42 * k, 0.62 * k, 0.10 * k, M.seat, 0, -0.36 * k, 0.20 * k, -0.16, 0, 0, js);
    self._box(0.30 * k, 0.16 * k, 0.10 * k, M.seat, 0, 0.08 * k, 0.27 * k, -0.16, 0, 0, js);
    self._box(0.05 * k, 0.42 * k, 0.05 * k, M.frame, 0.20 * k, -0.60 * k, 0.16 * k, 0, 0, 0, js);
    self._box(0.05 * k, 0.42 * k, 0.05 * k, M.frame, -0.20 * k, -0.60 * k, 0.16 * k, 0, 0, 0, js);
    self._box(0.11 * k, 0.06 * k, 0.11 * k, M.door, 0.32 * k, -0.42 * k, 0.30 * k);   // 面罩盒
    self._box(0.11 * k, 0.02 * k, 0.03 * k, M.red, 0.32 * k, -0.38 * k, 0.34 * k);

    /* ---- 侧操纵台附件: 氧气面罩盒 / 耳机 / 应急手电 / 笔记本电脑收纳 ---- */
    [1, -1].forEach(function (sx) {
      var cx = (sx > 0 ? -1 : 1) * 0.89 * k;      // 与侧操纵台同侧
      var topY = -0.60 * k, cz = -0.16 * k;
      self._box(0.11 * k, 0.05 * k, 0.13 * k, M.door, cx, topY + 0.025 * k, cz + 0.22 * k);   // 氧气面罩盒
      self._box(0.11 * k, 0.02 * k, 0.03 * k, M.red, cx, topY + 0.05 * k, cz + 0.28 * k);
      self._cyl(0.05 * k, 0.05 * k, 0.018 * k, 14, M.stick, cx, topY + 0.03 * k, cz - 0.04 * k, Math.PI / 2, 0, 0); // 耳机
      self._cyl(0.016 * k, 0.016 * k, 0.10 * k, 10, M.lever, cx, topY + 0.045 * k, cz - 0.20 * k, 0, 0, Math.PI / 2); // 应急手电
      self._box(0.16 * k, 0.03 * k, 0.22 * k, M.panel, cx, topY + 0.015 * k, cz + 0.44 * k);  // 笔记本电脑托盘
    });

    /* ---- 后隔板: 断路器 (AZS) 面板 + 衣帽钩 ---- */
    var zb = 0.88 * k;
    [1, -1].forEach(function (sx) {
      self._box(0.30 * k, 0.44 * k, 0.03 * k, M.panel, sx * 0.62 * k, -0.55 * k, zb);
      for (var r = 0; r < 3; r++) {
        for (var c2 = 0; c2 < 4; c2++) {
          self._box(0.032 * k, 0.032 * k, 0.02 * k, M.bezel,
            sx * 0.62 * k + (c2 - 1.5) * 0.066 * k, -0.40 * k - r * 0.105 * k, zb + 0.012 * k);
        }
      }
    });

    /* ---- 地板地毯 (略内缩, 深色) ---- */
    this._poly([[-0.90 * k, YF + 0.008 * k, -0.92 * k], [0.90 * k, YF + 0.008 * k, -0.92 * k],
      [0.90 * k, YF + 0.008 * k, 0.86 * k], [-0.90 * k, YF + 0.008 * k, 0.86 * k]], this._mat(0x24262a));
  };

  /* =====================================================================
     beta 0.4.2: 可操作的三维开关 / 旋钮 / 手柄
     --------------------------------------------------------------------
     · 每个控件 = 真实几何体 (拨杆 / 按钮 / 旋钮) + 不可见的点击盒 (userData.ctl)
     · ctl = { id, tip, click(dir), wheel(dir), drag:{begin(), move(dyUp)} }
       dir: 左键 = +1, 右键 / Shift+左键 = -1; 滚轮向上 = +1
     · 动画: 每帧按系统状态 (fm / sim) 插值到目标角度, 键盘 / 侧边面板操作也会同步
     · 全部为程序化几何体, 不依赖外部机模中的开关网格
     ===================================================================== */
  function safe(fn, d) { try { var v = fn(); return v === undefined ? d : v; } catch (e) { return d; } }

  /** 不可见点击盒 (射线可命中, 不渲染) */
  P._hitbox = function (w, h, d, x, y, z, parent) {
    if (!this._hitMat) {
      this._hitMat = new this.THREE.MeshBasicMaterial({ visible: false });
      this._hitMat.userData.emissive = true;
      this._mats.push(this._hitMat);
    }
    var m = this._mesh(new this.THREE.BoxGeometry(w, h, d), this._hitMat, parent);
    m.position.set(x || 0, y || 0, z || 0);
    m.userData.noBake = true;
    return m;
  };
  /** 把点击盒登记为控件 */
  P._ctl = function (mesh, ctl) {
    mesh.userData.ctl = ctl;
    this.clickables.push(mesh);
    if (ctl.id) { this.ctlById[ctl.id] = { mesh: mesh, ctl: ctl }; }
    return mesh;
  };
  /** 拖动换档: 每拖过 step (屏幕高度比例) 触发一次 fn(dir), 向下拖 = +1 */
  P._stepDrag = function (fn, step) {
    var acc = 0;
    return {
      begin: function () { acc = 0; },
      move: function (dyUp) {
        acc -= dyUp;
        while (acc >= step) { acc -= step; fn(1); }
        while (acc <= -step) { acc += step; fn(-1); }
      }
    };
  };
  P._apDiscCtl = function (id, tip) {
    var doc = global.document, sim = this.sim;
    return { id: id, tip: tip, click: function () {
      var e = doc && doc.getElementById('fcu-apdisconnect');
      if (e) e.click(); else if (sim && sim.ap && sim.ap.instinctiveDisconnect) sim.ap.instinctiveDisconnect('人工断开');
    } };
  };

  /* ---------------- 推力手柄 ---------------- */
  P._thrNow = function () { var fm = this.sim && this.sim.fm; return fm && fm.throttle ? (fm.throttle[0] || 0) : 0; };
  P._setThrottle = function (v) {
    var sim = this.sim, fm = sim && sim.fm;
    if (!fm) return;
    v = Math.max(0, Math.min(1, v));
    if (this.L.maker === 'airbus') {          // 空客卡位: CL 0.82 / FLX 0.92 / TOGA 1.0 有吸附
      [0.82, 0.92, 1].forEach(function (d) { if (Math.abs(v - d) < 0.022) v = d; });
    }
    if (v < 0.015) v = 0;
    fm.setThrottle('all', v);
    if (sim.input && sim.input.setThrottle) sim.input.setThrottle(v);    // 否则下一帧会被输入轴覆盖
    var ap = sim.ap && sim.ap.ap;
    if (ap && ap.athr && !this._athrHint) {
      this._athrHint = true;
      if (sim.hud) sim.hud.notify('A/THR 接通中: 推力由自动推力控制 (按 A/THR 断开后手动)', 'info', 2500);
    }
  };
  P._throttleCtl = function (i) {
    var self = this, start = 0, acc = 0;
    return {
      id: 'throttle' + (i + 1), tip: '推力手柄 (按住上下拖动 = 推 / 收油门, 滚轮微调)',
      click: function () { },
      wheel: function (dir) { self._setThrottle(self._thrNow() + dir * 0.04); },
      drag: {
        begin: function () { start = self._thrNow(); acc = 0; self._athrHint = false; },
        move: function (dyUp) { acc += dyUp; self._setThrottle(start + acc / 0.32); }
      }
    };
  };

  /* ---------------- 面板 / 开关构造 ---------------- */
  /**
   * 带文字底板的控件面板. 局部坐标: x 右, y 面板 "上", +z 指向飞行员 (面板外法线)
   * @param {object} o {parent, pos:[x,y,z], rotX, w, h, color, labels:[[text,x,y,size,color]]}
   */
  P._panel = function (o) {
    var THREE = this.THREE, g = new THREE.Group();
    g.position.set(o.pos[0], o.pos[1], o.pos[2]);
    g.rotation.x = o.rotX || 0;
    (o.parent || this.group).add(g);
    var s = 1400, cw = Math.min(1024, Math.ceil(o.w * s)), ch = Math.min(512, Math.ceil(o.h * s));
    var c = mkCanvas(cw, ch), ctx = c.getContext('2d');
    ctx.fillStyle = hex(o.color || this.pal.panel); ctx.fillRect(0, 0, cw, ch);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, cw - 4, ch - 4);
    var P0 = { g: g, w: o.w, h: o.h, c: c, ctx: ctx, sx: cw / o.w, sy: ch / o.h };
    P0.label = function (t, x, y, size, color) {
      ctx.fillStyle = color || '#eef1f3'; ctx.font = 'bold ' + Math.round((size || 0.011) * P0.sy) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t, (x + o.w / 2) * P0.sx, (o.h / 2 - y) * P0.sy);
    };
    P0.frame = function (x, y, w, h) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
      ctx.strokeRect((x - w / 2 + o.w / 2) * P0.sx, (o.h / 2 - y - h / 2) * P0.sy, w * P0.sx, h * P0.sy);
    };
    (o.labels || []).forEach(function (l) { P0.label(l[0], l[1], l[2], l[3], l[4]); });
    P0.mat = this._mat(0xffffff, { flat: true, map: this._tex(c) });
    P0.plate = this._plane(o.w, o.h, P0.mat, 0, 0, 0, 0, 0, 0, g);
    P0.plate.userData.panel = true;
    return P0;
  };
  P._lampMat = function () { return this._mat(0x1a1c1e, { flat: true, toneMapped: false, emissive: true }); };
  P._regAnim = function (obj, prop, target, speed) {
    var a = { obj: obj, prop: prop, target: target, cur: null, speed: speed || 16 };
    this.controls.push(a);
    return a;
  };
  P._regLamp = function (mat, fn) { this.controls.push({ lamp: mat, fn: fn, last: -1 }); };

  /** 拨动开关: get() → bool, toggle(dir) */
  P._toggle = function (pn, x, y, sp) {
    var THREE = this.THREE, M = this.M, g = pn.g, self = this;
    this._box(0.02, 0.026, 0.004, M.black, x, y, 0.002, 0, 0, 0, g);
    if (/^eng-master/.test(sp.id || '')) {          // 主电门两侧护栏 (防误碰)
      this._box(0.004, 0.05, 0.03, M.frame, x - 0.017, y, 0.015, 0, 0, 0, g);
      this._box(0.004, 0.05, 0.03, M.frame, x + 0.017, y, 0.015, 0, 0, 0, g);
    }
    var pv = new THREE.Group(); pv.position.set(x, y, 0.004); g.add(pv);
    this._cyl(0.0032, 0.0042, 0.024, 8, M.knob, 0, 0, 0.012, Math.PI / 2, 0, 0, pv);
    this._cyl(0.0055, 0.0055, 0.006, 10, M.knob, 0, 0, 0.025, Math.PI / 2, 0, 0, pv);
    var on = -0.5 * (sp.onDir || 1);
    this._regAnim(pv.rotation, 'x', function () { return safe(sp.get, false) ? on : -on; });
    pn.label(sp.label, x, y + (sp.labelSize ? 0.017 : 0.027), sp.labelSize || 0.0095);
    if (sp.on !== '') pn.label(sp.on || 'ON', x, y + (sp.onDir || 1) * 0.0165, 0.0075, '#cfd3d6');
    if (sp.off !== '') pn.label(sp.off || 'OFF', x, y - (sp.onDir || 1) * 0.0165, 0.0075, '#cfd3d6');
    if (sp.lamp) {
      var lm = this._lampMat();
      this._plane(0.014, 0.006, lm, x, y - 0.03, 0.002, 0, 0, 0, g);
      this._regLamp(lm, sp.lamp);
    }
    return this._ctl(this._hitbox(0.03, 0.045, 0.04, x, y, 0.016, g),
      { id: sp.id, tip: sp.tip, click: function (dir) { self._sfx(); sp.toggle(dir); }, wheel: function (dir) { if (!!safe(sp.get, false) !== (dir > 0)) sp.toggle(dir); } });
  };
  /** 带灯按钮: lamp() → 0xRRGGBB | 0 (熄灭), press() */
  P._pushBtn = function (pn, x, y, sp) {
    var THREE = this.THREE, M = this.M, g = pn.g, self = this;
    this._box(0.03, 0.026, 0.004, M.black, x, y, 0.002, 0, 0, 0, g);
    var pv = new THREE.Group(); pv.position.set(x, y, 0.004); g.add(pv);
    this._box(0.026, 0.022, 0.008, M.bezel, 0, 0, 0.004, 0, 0, 0, pv);
    var lm = this._lampMat();
    this._plane(0.02, 0.006, lm, 0, 0.004, 0.0085, 0, 0, 0, pv);
    this._regLamp(lm, sp.lamp);
    var anim = this._regAnim(pv.position, 'z', function () { return anim.pressT > 0 ? 0.001 : 0.004; }, 30);
    anim.pressT = 0;
    pn.label(sp.label, x, y + 0.022, 0.0095);
    if (sp.sub) pn.label(sp.sub, x, y - 0.0185, 0.007, '#cfd3d6');
    return this._ctl(this._hitbox(0.034, 0.03, 0.03, x, y, 0.012, g),
      { id: sp.id, tip: sp.tip, click: function (dir) { anim.pressT = 0.18; sp.press(dir); void self; } });
  };
  /** 多档旋钮: positions[], get() → index, set(index) */
  P._rotary = function (pn, x, y, sp) {
    var THREE = this.THREE, M = this.M, g = pn.g, n = sp.positions.length, self = this;
    var step = sp.step || Math.min(0.6, 2.4 / Math.max(1, n - 1)), r = sp.r || 0.014;
    var pv = new THREE.Group(); pv.position.set(x, y, 0.002); g.add(pv);
    this._cyl(r, r * 1.1, 0.012, 16, M.stick, 0, 0, 0.006, Math.PI / 2, 0, 0, pv);
    this._cyl(r * 1.22, r * 1.25, 0.004, 28, M.frame, 0, 0, 0.002, Math.PI / 2, 0, 0, pv);   // 底座环
    for (var kn = 0; kn < 12; kn++) { var ka = kn / 12 * Math.PI * 2; this._box(0.0015, 0.0015, 0.011, M.black, Math.cos(ka) * r * 1.02, Math.sin(ka) * r * 1.02, 0.006, 0, 0, 0, pv); }   // 滚花
    this._box(r * 0.45, r * 1.9, 0.008, M.knob, 0, r * 0.35, 0.013, 0, 0, 0, pv);
    this._regAnim(pv.rotation, 'z', function () { var i = safe(sp.get, 0); return -(i - (n - 1) / 2) * step; }, 14);
    pn.label(sp.label, x, y + r + (sp.labelSize ? 0.012 : 0.022), sp.labelSize || 0.0095);
    for (var i = 0; i < n; i++) {
      var a = (i - (n - 1) / 2) * step, rr = r + 0.0105;
      pn.label(sp.positions[i], x + Math.sin(a) * rr, y + Math.cos(a) * rr, 0.0072, '#d8dcdf');
    }
    function setI(i) { i = Math.max(0, Math.min(n - 1, i)); if (i !== safe(sp.get, 0)) { self._sfx(); sp.set(i); } }
    return this._ctl(this._hitbox(r * 2.6, r * 2.6, 0.03, x, y, 0.012, g), {
      id: sp.id, tip: sp.tip,
      // 点击循环换档 (到头后回到另一端), 滚轮不循环
      click: function (dir) { var i = safe(sp.get, 0) + (dir < 0 ? -1 : 1); i = (i + n) % n; setI(i); },
      wheel: function (dir) { setI(safe(sp.get, 0) + dir); }
    });
  };

  P._sfx = function () { var a = this.sim && this.sim.audio; if (a && a.playCue) { try { a.playCue('click'); } catch (e) { /* */ } } };

  /**
   * 带文字的指示灯 (按钮灯罩 / 独立指示灯). fn() → [{t, col, on}, ...] (1–2 行); 只在变化时重绘
   */
  P._annLamp = function (parent, x, y, z, w, h, fn) {
    var rows = safe(fn, []) || [], n = Math.max(1, rows.length);
    var c = mkCanvas(64, n > 1 ? 56 : 26), tex = this._tex(c);
    var mat = this._mat(0xffffff, { flat: true, map: tex, toneMapped: false, emissive: true });
    this._plane(w, h, mat, x, y, z, 0, 0, 0, parent);
    var a = { c: c, tex: tex, fn: fn, sig: null };
    this.controls.push({ ann: a });
    this._drawAnn(a);
    return a;
  };
  P._drawAnn = function (a) {
    var rows = safe(a.fn, []) || [], sig = JSON.stringify(rows);
    if (sig === a.sig) return;
    a.sig = sig;
    var c = a.c, g = c.getContext('2d'), W = c.width, H = c.height, n = Math.max(1, rows.length);
    g.fillStyle = '#0a0b0c'; g.fillRect(0, 0, W, H);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    rows.forEach(function (r, i) {
      if (!r || !r.t) return;
      var fs = n > 1 ? 17 : 16;
      g.font = 'bold ' + fs + 'px sans-serif';
      var tw = g.measureText(r.t).width;
      if (tw > W - 6) { fs = Math.floor(fs * (W - 6) / tw); g.font = 'bold ' + fs + 'px sans-serif'; }
      var yy = (i + 0.5) * H / n;
      if (r.on) { g.fillStyle = r.col; g.globalAlpha = 0.16; g.fillRect(3, yy - H / n / 2 + 2, W - 6, H / n - 4); g.globalAlpha = 1; }
      g.fillStyle = r.on ? r.col : '#33373b';
      g.fillText(r.t, W / 2, yy + 1);
    });
    a.tex.needsUpdate = true;
  };
  /** 空客风格带字按钮: legend() → [{t,col,on},{t,col,on}], press(dir) */
  P._annBtn = function (pn, x, y, sp) {
    var THREE = this.THREE, M = this.M, g = pn.g, self = this;
    this._box(0.03, 0.026, 0.004, M.black, x, y, 0.002, 0, 0, 0, g);
    var pv = new THREE.Group(); pv.position.set(x, y, 0.004); g.add(pv);
    this._box(0.026, 0.022, 0.008, M.bezel, 0, 0, 0.004, 0, 0, 0, pv);
    this._annLamp(pv, 0, 0, 0.0085, 0.023, 0.019, sp.legend);
    var anim = this._regAnim(pv.position, 'z', function () { return anim.pressT > 0 ? 0.001 : 0.004; }, 30);
    anim.pressT = 0;
    pn.label(sp.label, x, y + (sp.labelSize ? 0.017 : 0.022), sp.labelSize || 0.0085);
    if (sp.sub) pn.label(sp.sub, x, y - 0.0185, 0.0068, '#cfd3d6');
    return this._ctl(this._hitbox(0.034, 0.03, 0.03, x, y, 0.012, g),
      { id: sp.id, tip: sp.tip, click: function (dir) { anim.pressT = 0.18; self._sfx(); sp.press(dir); } });
  };

  /* ---------------- 数据驱动头顶板 (FS.OVERHEAD_LAYOUTS) ----------------
     功能控件 (f=id) 用真实可点击控件; 其余外观控件用合并实例 (InstancedMesh) + 面板贴图上的灯字, 保证性能 */
  P._buildOverheadData = function (layout, FN, ovhPanel) {
    var self = this, THREE = this.THREE, M = this.M;
    var inst = {};   // 名称 → { geo, mat, list: [Matrix4] }
    function addInst(key, geo, mat, pn, x, y, z, rz, sx, sy, sz) {
      var I = inst[key] || (inst[key] = { geo: geo, mat: mat, list: [] });
      I.list.push({ g: pn.g, x: x, y: y, z: z, rz: rz || 0, s: [sx || 1, sy || 1, sz || 1] });
    }
    var G = {
      box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 18), cyl8: new THREE.CylinderGeometry(1, 1, 1, 8)
    };
    var MAT = { bezel: M.bezel, frame: M.frame, knob: M.knob, stick: M.stick, red: this._mat(0xc21d1d), black: M.black,
      guard: this._mat(0x1f2124), fire: this._mat(0xb51414, { flat: true }) };
    function capDraw(pn, x, y, w, h, legend, label, lsz) {
      var c = pn.ctx, sx = pn.sx, sy = pn.sy, X = (x - w / 2 + pn.w / 2) * sx, Y = (pn.h / 2 - y - h / 2) * sy;
      c.fillStyle = '#0b0c0d'; c.fillRect(X, Y, w * sx, h * sy);
      var parts = (legend || '').split('/');
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = 'bold ' + Math.max(6, Math.round(h * sy * 0.30)) + 'px sans-serif';
      if (parts[0]) { c.fillStyle = '#4a3a1c'; c.fillText(parts[0], X + w * sx / 2, Y + h * sy * 0.3); }
      if (parts[1]) { c.fillStyle = '#3a3e42'; c.fillText(parts[1], X + w * sx / 2, Y + h * sy * 0.72); }
      if (label) pn.label(label, x, y + h / 2 + 0.0075, lsz);
    }
    var CELL = { cw: 1, rh: 1 };
    function pbVis(pn, x, y, legend, label, lsz, guard) {
      var w = Math.min(0.022, CELL.cw * 0.8), h = Math.min(0.019, CELL.rh * 0.55);
      capDraw(pn, x, y, w, h, legend, label, lsz);
      // 斜边按钮框 (四边)
      addInst('bzH', G.box, MAT.bezel, pn, x, y + h / 2 + 0.0015, 0.003, 0, w + 0.006, 0.003, 0.006);
      addInst('bzH', G.box, MAT.bezel, pn, x, y - h / 2 - 0.0015, 0.003, 0, w + 0.006, 0.003, 0.006);
      addInst('bzH', G.box, MAT.bezel, pn, x - w / 2 - 0.0015, y, 0.003, 0, 0.003, h, 0.006);
      addInst('bzH', G.box, MAT.bezel, pn, x + w / 2 + 0.0015, y, 0.003, 0, 0.003, h, 0.006);
      if (guard) {   // 护盖: 两侧板 + 顶罩 (红色或黑色)
        var gm = guard === 'red' ? 'gRed' : 'gBlk', gmat = guard === 'red' ? MAT.red : MAT.guard;
        addInst(gm, G.box, gmat, pn, x - w / 2 - 0.004, y, 0.009, 0, 0.002, h + 0.006, 0.016);
        addInst(gm, G.box, gmat, pn, x + w / 2 + 0.004, y, 0.009, 0, 0.002, h + 0.006, 0.016);
        addInst(gm, G.box, gmat, pn, x, y - h / 2 - 0.003, 0.016, 0, w + 0.01, 0.002, 0.004);
      }
    }
    function knobVis(pn, x, y, label, lsz, pos, r) {
      r = Math.min(r || 0.009, CELL.cw * 0.3, CELL.rh * 0.22);
      addInst('kSk', G.cyl, MAT.frame, pn, x, y, 0.002, 0, r * 1.25, 0.004, r * 1.25);
      addInst('kBd', G.cyl, MAT.stick, pn, x, y, 0.008, 0, r, 0.012, r);
      addInst('kPt', G.box, MAT.knob, pn, x, y + r * 0.35, 0.0145, 0, r * 0.4, r * 1.6, 0.002);
      if (label) pn.label(label, x, y + r + 0.012, lsz);
      if (pos) { var n = pos.length, st = Math.min(0.6, 2.4 / Math.max(1, n - 1)); pos.forEach(function (t, i) { var a = (i - (n - 1) / 2) * st, rr = r + 0.007; pn.label(t, x + Math.sin(a) * rr, y + Math.cos(a) * rr, 0.0052, '#d8dcdf'); }); }
    }
    function tgVis(pn, x, y, label, lsz, pos, guard) {
      addInst('tBs', G.box, MAT.black, pn, x, y, 0.002, 0, 0.012, 0.016, 0.004);
      addInst('tLv', G.cyl8, MAT.knob, pn, x, y + 0.003, 0.011, 0, 0.0024, 0.02, 0.0024);
      if (label) pn.label(label, x, y + 0.017, lsz);
      if (pos) { pn.label(pos[0], x, y + 0.0095, 0.0048, '#cfd3d6'); pn.label(pos[pos.length - 1], x, y - 0.0115, 0.0048, '#cfd3d6'); }
      if (guard) { addInst('gRed', G.box, MAT.red, pn, x, y, 0.012, 0, 0.016, 0.02, 0.003); }
    }
    layout.forEach(function (P) {
      var pn = ovhPanel(P.z, P.w, P.h, [[P.n, 0, P.h / 2 - 0.0065, 0.0072, '#ffffff']], P.x);
      var nR = P.rows.length, top = P.h / 2 - 0.014, rowH = (P.h - 0.018) / nR;
      P.rows.forEach(function (row, ri) {
        var y = top - (ri + 0.5) * rowH + 0.002, m = row.length, cw = P.w / m;
        var lsz = Math.min(0.0068, cw * 0.13);
        row.forEach(function (spec, ci) {
          var n0 = self.clickables.length; CELL.cw = cw; CELL.rh = rowH; cell(spec, ci);
          for (var hi = n0; hi < self.clickables.length; hi++) {   // 点击盒收进本格, 避免斜视时与相邻控件重叠
            var hb = self.clickables[hi], gp = hb.geometry && hb.geometry.parameters; if (!gp || !gp.width) continue;
            hb.scale.set(Math.min(1, cw * 0.88 / gp.width), Math.min(1, rowH * 0.8 / gp.height), Math.min(1, 0.012 / gp.depth));
            hb.position.z = Math.min(hb.position.z, 0.007);
          }
        });
        function cell(spec, ci) {
          var a = spec.split('|'), t = a[0], lab = a[1] || '', ex = a[2] || '', op = a.slice(3).join('|');
          var fid = (/(?:^|\|)f=([\w-]+)/.exec(spec) || [])[1];
          if (/^f=/.test(ex)) ex = '';
          var x = -P.w / 2 + (ci + 0.5) * cw, it = fid && FN[fid];
          if (fid === 'adirs-pb' && FN['adirs-ir1']) {   // 777 / 787: 单个 ADIRU ON/OFF 按钮 → 所有 IR 置 NAV / OFF
            var irs = Object.keys(FN).filter(function (k2) { return /^adirs-ir\d/.test(k2); }).map(function (k2) { return FN[k2].sp; });
            var nav = irs[0].positions.indexOf('NAV');
            self._annBtn(pn, x, y, { id: 'adirs-pb', label: lab, labelSize: lsz, tip: 'ADIRU 电门 (点击 开 / 关)',
              legend: function () { var on = irs[0].get() > 0; return [{ t: 'OFF', col: '#f2f2f2', on: !on }, { t: 'ON BAT', col: '#ffb000', on: false }]; },
              press: function () { var on = irs[0].get() > 0; irs.forEach(function (r) { r.set(on ? 0 : nav); }); } });
            return;
          }
          if (fid === 'elec-bat' && FN['elec-bat1'] && FN['elec-bat2']) {   // 单个 BATTERY 电门 → BAT1 + BAT2 同步
            var b1 = FN['elec-bat1'].sp, b2 = FN['elec-bat2'].sp;
            self._annBtn(pn, x, y, { id: 'elec-bat', label: lab, labelSize: lsz, tip: 'BATTERY 电门 (点击 开 / 关)',
              legend: function () { return [{ t: 'OFF', col: '#f2f2f2', on: !b1.get() }, { t: '', col: '#ffb000', on: false }]; },
              press: function () { var on = b1.get(); if (b1.get() === on) b1.press(1); if (b2.get() === on) b2.press(1); } });
            return;
          }
          if (fid === 'apu-rot' && FN.apu && FN['apu-start']) {   // 波音 APU 旋钮 OFF / ON / START (START 弹回 ON)
            var am = FN.apu.sp, as = FN['apu-start'].sp;
            self._rotary(pn, x, y - 0.004, { id: 'apu', label: lab, labelSize: lsz, r: 0.008, positions: ['OFF', 'ON', 'START'], tip: 'APU 电门 (OFF / ON / START)',
              get: function () { return am.get() ? 1 : 0; },
              set: function (i) { var on = am.get(); if (i === 0 && on) am.press(1); else if (i >= 1 && !on) am.press(1); if (i === 2) as.press(1); } });
            // START 档单独热区 (旋钮右侧), 供直接点击起动
            self._ctl(self._hitbox(0.009, 0.01, 0.01, x + 0.016, y + 0.002, 0.008, pn.g), { id: 'apu-start', tip: 'APU START (转到 START, 松手回 ON)',
              click: function () { if (!am.get()) am.press(1); as.press(1); } });
            return;
          }
          if (it) {
            var sp = Object.assign({}, it.sp || {}, { label: lab, labelSize: lsz });
            if (it.t === 'pb' && (t === 'tg' || t === 'gtg') && sp.get) {   // 波音: 同一功能用拨杆 (电瓶等)
              self._toggle(pn, x, y, Object.assign(sp, { on: '', off: '', onDir: -1, toggle: function () { sp.press(1); } }));
              if (t === 'gtg') addInst('gRed', G.box, MAT.red, pn, x, y + 0.004, 0.016, 0, 0.018, 0.012, 0.002);
              return;
            }
            var onOf = it.t === 'pb' ? sp.get : (it.t === 'tg' ? sp.get : null);
            if ((it.t === 'pb' || it.t === 'tg') && (t === 'rot' || t === 'knob') && onOf) {   // 旋钮式开关 (777 防冰 / E190 灯光 / 737 PACK)
              var ps = ex.split(','), hasOff = /OFF|CLOSE/.test(ps[0]) ? 0 : -1;
              if (ps.length < 2) ps = ['OFF', 'ON'];
              var onI = Math.max(1, ps.indexOf('AUTO') >= 0 ? ps.indexOf('AUTO') : (ps.indexOf('ON') >= 0 ? ps.indexOf('ON') : 1));
              var flip = function () { if (it.t === 'pb') sp.press(1); else (sp.toggle || sp.press)(1); };
              self._rotary(pn, x, y - 0.004, { id: sp.id, label: lab, labelSize: lsz, r: 0.008, positions: ps, tip: sp.tip,
                get: function () { var on = !!onOf(); return hasOff < 0 ? (on ? 0 : 1) : (on ? onI : 0); },
                set: function (i) { var want = hasOff < 0 ? i === 0 : i > 0; if (!!onOf() !== want) flip(); } });
              return;
            }
            if (it.t === 'rot' && (t === 'pb' || t === 'pbg')) {   // 按钮式隔离活门 (A350 X BLEED / 777 ISLN): AUTO ↔ OPEN
              var rp = it.sp, op2 = rp.positions.indexOf('OPEN'), au = rp.positions.indexOf('AUTO');
              self._annBtn(pn, x, y, { id: rp.id, label: lab, labelSize: lsz, tip: rp.tip,
                legend: function () { return [{ t: 'FAULT', col: '#ffb000', on: false }, { t: 'OPEN', col: '#f2f2f2', on: rp.get() === op2 }]; },
                press: function () { rp.set(rp.get() === op2 ? au : op2); } });
              return;
            }
            if (it.t === 'pb') { self._annBtn(pn, x, y, sp); return; }
            if (it.t === 'tg' && /f2=light-logo/.test(spec) && FN['light-logo']) {   // 空客 NAV & LOGO 单一电门: 同时控制航行灯与标志灯
              var lg = FN['light-logo'].sp, nv = it.sp;
              self._toggle(pn, x, y, Object.assign(sp, { on: '', off: '', toggle: function () { nv.toggle(); if (!!lg.get() !== !!nv.get()) lg.toggle(); } }));
              var nm = self.ctlById[sp.id];
              if (nm) self.ctlById['light-logo'] = { mesh: nm.mesh, ctl: { id: 'light-logo', tip: lg.tip, click: function () { lg.toggle(); } } };
              return;
            }
            if (it.t === 'tg') { self._toggle(pn, x, y, Object.assign(sp, { on: '', off: '' })); return; }
            if (it.t === 'rot') { self._rotary(pn, x, y - 0.004, Object.assign(sp, { r: 0.008 })); return; }
            if (it.t === 'lamp') { self._annLamp(pn.g, x, y, 0.003, 0.022, 0.01, it.fn); pn.label(lab, x, y + 0.011, lsz); return; }
          }
          if (t === 'pb') pbVis(pn, x, y, ex, lab, lsz, null);
          else if (t === 'pbg') pbVis(pn, x, y, ex, lab, lsz, /red/.test(op) ? 'red' : 'black');
          else if (t === 'fire') {
            addInst('fire', G.box, MAT.fire, pn, x, y, 0.012, 0, 0.05, 0.026, 0.02);
            pn.label(lab, x, y + 0.02, lsz * 1.2); pn.label('PUSH', x, y - 0.019, 0.005);
          } else if (t === 'rot') knobVis(pn, x, y - 0.003, lab, lsz, ex.split(','), 0.008);
          else if (t === 'knob') knobVis(pn, x, y - 0.003, lab, lsz, null, 0.009);
          else if (t === 'tg') tgVis(pn, x, y, lab, lsz, ex.split(','), false);
          else if (t === 'gtg') tgVis(pn, x, y, lab, lsz, ex.split(','), true);
          else if (t === 'lamp') { capDraw(pn, x, y, 0.022, 0.01, ex || lab, '', lsz); pn.label(lab, x, y + 0.011, lsz); }
          else if (t === 'kp') {   // 键盘 (列x行), 每键一个小方键
            var kd = (ex || '4x2').split('x'), kc = +kd[0] || 4, kr = +kd[1] || 2, kw = Math.min(0.012, cw * 0.9 / kc), kh = Math.min(0.010, rowH * 0.8 / kr);
            for (var kx = 0; kx < kc; kx++) for (var ky = 0; ky < kr; ky++) {
              var kxx = x + (kx - (kc - 1) / 2) * kw * 1.15, kyy = y - 0.002 + ((kr - 1) / 2 - ky) * kh * 1.2;
              addInst('key', G.box, MAT.stick, pn, kxx, kyy, 0.003, 0, kw * 0.92, kh * 0.9, 0.005);
            }
            if (lab) pn.label(lab, x, y + kr * kh * 0.6 + 0.006, lsz);
          }
          else if (t === 'disp') {
            var c = pn.ctx, X = (x - 0.018 + pn.w / 2) * pn.sx, Y = (pn.h / 2 - y - 0.007) * pn.sy;
            c.fillStyle = '#050505'; c.fillRect(X, Y, 0.036 * pn.sx, 0.014 * pn.sy);
            if (lab) pn.label(lab, x, y + 0.013, lsz);
          }
        }
      });
      if (pn.mat.map) pn.mat.map.needsUpdate = true;
    });
    // 合并为 InstancedMesh (每类一个绘制调用)
    this.group.updateMatrixWorld(true);
    var inv = new THREE.Matrix4().copy(this.group.matrixWorld).invert(), mtx = new THREE.Matrix4(), loc = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    Object.keys(inst).forEach(function (key) {
      var I = inst[key], geo = I.geo;
      if (geo.type === 'CylinderGeometry' && !I._rot) { geo = geo.clone(); geo.rotateX(Math.PI / 2); }   // 圆柱轴 → 面板法线
      var im = new THREE.InstancedMesh(geo, I.mat, I.list.length);
      I.list.forEach(function (o, i) {
        e.set(0, 0, o.rz); q.setFromEuler(e);
        var s = o.s; if (geo !== I.geo) s = [s[0], s[2], s[1]];
        loc.compose(new THREE.Vector3(o.x, o.y, o.z), q, new THREE.Vector3(s[0], s[1], s[2]));
        mtx.multiplyMatrices(inv, o.g.matrixWorld).multiply(loc);
        im.setMatrixAt(i, mtx);
      });
      im.instanceMatrix.needsUpdate = true;
      im.userData.noBake = true;
      self.group.add(im);
    });
  };

  /* ---------------- 面板布置 ---------------- */
  P._buildSwitchPanels = function () {
    var self = this, k = this.L.k, boeing = this.L.maker === 'boeing', doc = global.document;
    function sim() { return self.sim || {}; }
    function fm() { return sim().fm || null; }
    function sys() { var f = fm(); return f && f.sys ? f.sys : null; }
    function dc() { var s = sys(); return !s || !!s.out.dc; }
    function domClick(id) { var e = doc && doc.getElementById(id); if (e) { e.click(); return true; } return false; }
    function notify(t) { var h = sim().hud; if (h && h.notify) h.notify(t, 'info', 1300); }
    var AMB = '#ffb000', GRN = '#3dff6a', BLU = '#38b6ff', WHT = '#f2f2f2';
    function L2(t1, c1, on1, t2, c2, on2) { var p = dc(); return [{ t: t1, col: c1, on: p && !!on1 }, { t: t2, col: c2, on: p && !!on2 }]; }
    /** 通用的 "开关量" 按钮 (FAULT / OFF 或 FAULT / ON) */
    function swBtn(id, label, tip, key, idx, onLegend, faultFn, sub) {
      function get() { var s = sys(); if (!s) return true; return idx === undefined ? !!s.sw[key] : !!s.sw[key][idx]; }
      return { t: 'pb', w: 0.062, sp: { id: id, label: label, sub: sub, tip: tip + ' (点击 开 / 关)', get: get,
        legend: function () {
          var on = get(), f = faultFn ? safe(faultFn, false) : false;
          return onLegend ? L2('FAULT', AMB, f, 'ON', BLU, on) : L2(boeing ? 'LOW PRESS' : 'FAULT', AMB, f, 'OFF', WHT, !on);
        },
        press: function () {
          var s = sys(); if (!s) return;
          if (idx === undefined) s.toggle(key); else s.setArr(key, idx, !s.sw[key][idx]);
          notify(label.replace(/\n/g, ' ') + (get() ? ' ON' : ' OFF'));
        } } };
    }
    function rot(id, label, tip, positions, get, set, w) {
      return { t: 'rot', w: w || 0.07, sp: { id: id, label: label, tip: tip, positions: positions, r: 0.012,
        get: function () { var i = positions.indexOf(safe(get, positions[0])); return i < 0 ? 0 : i; },
        set: function (i) { set(positions[i]); notify(label + ' ' + positions[i]); } } };
    }
    function engRun(i) { var f = fm(), e = f && f.engines[i]; return !!e && (e.state === 'running' || e.state === 'idle'); }

    /* ---- 1. 头顶板前部: 外部灯光 (真实拨杆) ---- */
    // 头顶板平面: (y 0.245k, z -0.70k) → (y 0.34k, z 0.15k); 局部 +y = 朝后, +z = 朝下 (指向飞行员)
    var O = (boeing ? SPEC.boeing : SPEC.airbus).ovh;
    var off = 0.007;                         // 面板略低于顶板, 避免 z-fighting
    function ovhPanel(zc, w, h, labels, xc) {
      var z = zc * k, A = O.bend[1] * k > z ? [O.front, O.bend] : [O.bend, O.aft];
      var y0 = A[0][0] * k, z0 = A[0][1] * k, y1 = A[1][0] * k, z1 = A[1][1] * k;
      var t = (z - z0) / (z1 - z0), yc = y0 + t * (y1 - y0), th = Math.atan2(z1 - z0, y1 - y0);
      return self._panel({ pos: [(xc || 0) * k, yc - off, z], rotX: th, w: w, h: h, labels: labels });
    }
    var LT = boeing
      ? [['strobe', 'STROBE', '频闪灯'], ['beacon', 'ANTI COL', '防撞信标灯 (BEACON)'], ['wing', 'WING', '机翼照明灯'], ['nav', 'POSITION', '航行灯'],
        ['logo', 'LOGO', '标志灯'], ['landing', 'LANDING', '着陆灯'], ['rwyTurnoff', 'RWY TURNOFF', '跑道脱离灯'], ['taxi', 'TAXI', '滑行灯 / 前轮灯'], ['cabin', 'CABIN', '客舱灯']]
      : [['strobe', 'STROBE', '频闪灯'], ['beacon', 'BEACON', '防撞信标灯'], ['wing', 'WING', '机翼照明灯'], ['nav', 'NAV', '航行灯'],
        ['logo', 'LOGO', '标志灯'], ['landing', 'LAND', '着陆灯'], ['rwyTurnoff', 'RWY T.OFF', '跑道脱离灯'], ['taxi', 'TAXI', '滑行灯 / 前轮灯'], ['cabin', 'CABIN', '客舱灯']];
    var ltItems = LT.map(function (L) {
      var key = L[0];
      return { t: 'tg', w: boeing ? 0.042 : 0.046, sp: { id: 'light-' + key, label: L[1], tip: L[2] + ' (点击开 / 关)', onDir: -1,
        get: function () { var s = sim(); return !!(s.lights && s.lights[key]); },
        toggle: function () { var s = sim(); if (!s.getLights || !s.setLights) return; var st = s.getLights(); st[key] = !st[key]; s.setLights(st); notify(L[2] + (st[key] ? ' 开' : ' 关')); } } };
    });

    /* ---- 1b. beta 0.4.2 冷舱启动: 头顶板 4 排系统面板 (空客 / 波音两套标签, 同一套系统逻辑) ---- */
    function row(zc, sections, xc, Wfix) {
      var H = 0.10, gap = 0.014, total = -gap;
      sections.forEach(function (s) { total += gap; s.items.forEach(function (it) { total += it.w; }); });
      var W = Wfix || total + 0.03;
      var pn = ovhPanel(zc, W, H, [], xc);
      var x = -total / 2;
      sections.forEach(function (sec) {
        var sx0 = x;
        sec.items.forEach(function (it) {
          var cx = x + it.w / 2;
          if (it.t === 'pb') self._annBtn(pn, cx, -0.004, it.sp);
          else if (it.t === 'tg') self._toggle(pn, cx, -0.004, it.sp);
          else if (it.t === 'rot') { self._rotary(pn, cx, -0.009, it.sp); if (it.lamp) self._annLamp(pn.g, cx, -0.038, 0.003, 0.026, 0.009, it.lamp); }
          else if (it.t === 'lamp') { self._annLamp(pn.g, cx, -0.004, 0.003, 0.03, 0.012, it.fn); pn.label(it.label, cx, 0.016, 0.0075); }
          x += it.w;
        });
        pn.frame((sx0 + x) / 2, -0.004, x - sx0 + 0.004, 0.085);
        pn.label(sec.title, (sx0 + x) / 2, 0.040, 0.0085, '#ffffff');
        x += gap;
      });
      if (pn.mat.map) pn.mat.map.needsUpdate = true;
      return pn;
    }
    function apuMaster() {
      return { t: 'pb', w: 0.062, sp: { id: 'apu', label: boeing ? 'APU' : 'MASTER SW', tip: 'APU 主电门 MASTER SW (点击 开 / 关)',
        get: function () { var s = sys(); return s ? !!s.sw.apuMaster : !!(fm() && fm().apuRunning); },
        legend: function () { var s = sys(); var on = s ? s.sw.apuMaster : !!(fm() && fm().apuRunning); return L2('FAULT', AMB, false, 'ON', BLU, on); },
        press: function () {
          var s = sys(), f = fm(); if (!f) return;
          if (!s) { if (!domClick('apu-btn')) { if (f.apuRunning) f.stopAPU(); else f.startAPU(); } return; }
          if (s.sw.apuMaster) { s.stopApu(); notify('APU MASTER OFF'); } else { s.set('apuMaster', true); notify('APU MASTER ON — 再按 START'); }
          var b = doc && doc.getElementById('apu-btn'); if (b) b.classList.toggle('on', !!f.apuRunning);
        } } };
    }
    function apuStart() {
      return { t: 'pb', w: 0.062, sp: { id: 'apu-start', label: 'START', tip: 'APU START (需 MASTER SW ON 与电瓶, 约 30 秒后 AVAIL)',
        legend: function () { var s = sys(); var st = s ? s.apu.state : 'off'; return L2('AVAIL', GRN, st === 'avail', 'ON', BLU, st === 'starting'); },
        press: function () { var s = sys(), f = fm(); if (s) s.pressApuStart(); else if (f && !f.apuRunning) f.startAPU();
          var b = doc && doc.getElementById('apu-btn'); if (b && f) b.classList.toggle('on', !!f.apuRunning); } } };
    }
    var seat = { t: 'tg', w: 0.058, sp: { id: 'sign-seatbelts', label: boeing ? 'FASTEN BELTS' : 'SEAT BELTS', tip: '安全带灯 (点击 开 / 关)', onDir: -1,
      get: function () { var s = sys(); return s ? !!s.sw.seatBelts : true; }, toggle: function () { var s = sys(); if (s) { s.toggle('seatBelts'); notify('安全带灯 ' + (s.sw.seatBelts ? 'ON' : 'OFF')); } } } };
    var row1 = [{ title: 'APU', items: [apuMaster(), apuStart()] }];
    if (boeing) {
      row1.push({ title: 'ENGINE START', items: [0, 1].map(function (i) {
        return rot('eng-start-sel-' + (i + 1), 'ENG ' + (i + 1), '发动机起动电门 ' + (i + 1) + ' (GRD = 地面起动, 起动完成后自动回 OFF)', ['GRD', 'OFF', 'CONT', 'FLT'],
          function () { var s = sys(); return s ? s.sw.engStart[i] : 'OFF'; }, function (v) { var s = sys(); if (s) s.setArr('engStart', i, v); }, 0.08);
      }) });
    }
    row1.push({ title: 'SIGNS', items: [seat] });
    var R1 = row1;
    var R2 = [
      { title: 'ELEC', items: [
        swBtn('elec-bat1', boeing ? 'BATTERY' : 'BAT 1', boeing ? '主电瓶' : '电瓶 1', 'bat1'),
        swBtn('elec-bat2', boeing ? 'STBY PWR' : 'BAT 2', boeing ? '备用电源' : '电瓶 2', 'bat2'),
        { t: 'pb', w: 0.062, sp: { id: 'elec-ext', label: boeing ? 'GRD PWR' : 'EXT PWR', tip: '外部电源 (地面静止时 AVAIL, 点击接通 / 断开)',
          legend: function () { var s = sys(); var av = s && s.out.extAvail, on = s && s.out.ext; return L2('AVAIL', GRN, av && !on, 'ON', BLU, on); },
          press: function () { var s = sys(); if (!s) return; if (!s.out.extAvail) { notify('外部电源不可用 (仅地面静止时)'); return; } s.toggle('extPwr'); notify('EXT PWR ' + (s.sw.extPwr ? 'ON' : 'OFF')); } } }
      ] },
      { title: boeing ? 'BLEED AIR' : 'AIR COND', items: [
        swBtn('pack1', boeing ? 'PACK L' : 'PACK 1', '空调组件 1', 'pack1'),
        swBtn('bleed-eng1', 'ENG 1 BLEED', '发动机 1 引气', 'engBleed', 0),
        swBtn('apu-bleed', 'APU BLEED', 'APU 引气 (发动机起动需要)', 'apuBleed', undefined, true),
        rot('xbleed', boeing ? 'ISOLATION' : 'X BLEED', boeing ? '隔离活门 (CLOSE / AUTO / OPEN)' : '交输引气 (SHUT / AUTO / OPEN)', boeing ? ['SHUT', 'AUTO', 'OPEN'] : ['SHUT', 'AUTO', 'OPEN'],
          function () { var s = sys(); return s ? s.sw.xbleed : 'AUTO'; }, function (v) { var s = sys(); if (s) s.set('xbleed', v); }),
        swBtn('bleed-eng2', 'ENG 2 BLEED', '发动机 2 引气', 'engBleed', 1),
        swBtn('pack2', boeing ? 'PACK R' : 'PACK 2', '空调组件 2', 'pack2')
      ] }
    ];
    var FP = boeing ? ['L FWD', 'L AFT', 'CTR L', 'CTR R', 'R FWD', 'R AFT'] : ['L TK 1', 'L TK 2', 'CTR TK 1', 'CTR TK 2', 'R TK 1', 'R TK 2'];
    var R3 = [
      { title: 'FUEL', items: FP.map(function (n, i) {
        return swBtn('fuel-' + ['l1', 'l2', 'c1', 'c2', 'r1', 'r2'][i], n, '燃油泵 ' + n, 'pumps', i, false, function () { var s = sys(); return boeing ? !(s.sw.pumps[i] && s.out.ac) : (s.sw.pumps[i] && !s.out.ac); }, 'PUMP');
      }) },
      { title: 'HYD', items: [
        swBtn('hyd-eng1', boeing ? 'ENG 1 (A)' : 'ENG 1 PUMP', '液压 发动机 1 泵', 'hydEng1', undefined, false, function () { return !engRun(0); }),
        swBtn('hyd-elec', boeing ? 'ELEC 1 (A)' : 'ELEC PUMP', boeing ? '液压 电动泵 1' : '蓝液压 电动泵', 'hydElec'),
        swBtn('hyd-ptu', boeing ? 'ELEC 2 (B)' : 'PTU', boeing ? '液压 电动泵 2' : '动力转换组件 PTU', 'ptu'),
        swBtn('hyd-eng2', boeing ? 'ENG 2 (B)' : 'ENG 2 PUMP', '液压 发动机 2 泵', 'hydEng2', undefined, false, function () { return !engRun(1); })
      ] }
    ];
    var irPos = boeing ? ['OFF', 'ALIGN', 'NAV', 'ATT'] : ['OFF', 'NAV', 'ATT'];
    var nIr = boeing ? 2 : 3, irItems = [];
    for (var ii = 0; ii < nIr; ii++) (function (i) {
      var it = rot('adirs-ir' + (i + 1), boeing ? 'IRS ' + (i ? 'R' : 'L') : 'IR ' + (i + 1), (boeing ? 'IRS ' : '惯导 IR ') + (i + 1) + ' 方式选择 (NAV = 对准后提供导航, 约 75 秒)', irPos,
        function () { var s = sys(); return s ? s.sw.ir[i] : 'NAV'; }, function (v) { var s = sys(); if (s) s.setIr(i, v); }, boeing ? 0.08 : 0.07);
      it.lamp = function () { var s = sys(), r = s && s.ir[i]; return [{ t: 'ALIGN', col: WHT, on: dc() && !!r && r.state === 'align' && (Math.floor(Date.now() / 500) % 2 === 0) }]; };
      irItems.push(it);
    })(ii);
    irItems.push({ t: 'lamp', w: 0.045, label: 'ON BAT', fn: function () { var s = sys(); return [{ t: 'ON BAT', col: AMB, on: !!(s && s.out.onBat) }]; } });
    var R4 = [
      { title: boeing ? 'IRS' : 'ADIRS', items: irItems },
      { title: 'ANTI ICE', items: [
        swBtn('probe-heat', boeing ? 'PROBE HEAT' : 'PROBE/WINDOW', '探头 / 风挡加温', 'probeHeat', undefined, true),
        swBtn('ai-wing', 'WING', '机翼防冰', 'wingAI', undefined, true),
        swBtn('ai-eng1', 'ENG 1', '发动机 1 防冰', 'engAI', 0, true),
        swBtn('ai-eng2', 'ENG 2', '发动机 2 防冰', 'engAI', 1, true)
      ] }
    ];


    /* ---- 1c. 头顶板按机型真实位置排布 (只含冷舱起动所需控件; 其余为同形状空白面板)
       参考: A320 头顶板照片 (O. Cleynen, Commons) / A350 FFS 驾驶舱 (I. Kousa, Commons) /
             737NG 头顶板 (Commons "B&W Overhead Panel 737NG") / 787 头顶板 (Commons "United 787 overhead panel KSEA AVGeek")
       z: 前缘 (风挡) ≈ -0.75 → 后缘 ≈ +0.12; x: 左 - / 右 + */
    var SEC = {};
    [R1, R2, R3, R4].forEach(function (r) { r.forEach(function (sec) { SEC[sec.title] = sec; }); });
    function S(t) { return SEC[t]; }
    var EXTLT = { title: 'EXT LT', items: ltItems };
    function blank(z, x, w, title) { var pn = ovhPanel(z, w, 0.10, [[title, 0, 0.040, 0.0085, '#d8dde2']], x); pn.frame(0, -0.004, w - 0.01, 0.085); if (pn.mat.map) pn.mat.map.needsUpdate = true; }
    var famO = this.L.fam, LAY;
    if (!boeing) {
      // 空客: 三列 — 左列 (后→前) ADIRS / FLT CTL / EVAC / EMER ELEC / GPWS / OXY-CALLS;
      //        中列 (后→前) FIRE / HYD / FUEL / ELEC / AIR COND / ANTI ICE + CABIN PRESS / 前缘 EXT LT + APU + SIGNS; 右列 FLT CTL / CARGO / VENT / ENG
      LAY = [[0.04, [[-0.27, [S('ADIRS')]]]], [0.04, 'blank', 0.07, 0.24, 'FIRE'],
        [-0.08, [[0, [S('HYD')]]]], [-0.20, [[0, [S('FUEL')]]]], [-0.32, [[0, [S('ELEC')]]]],
        [-0.44, [[0, [S('AIR COND')]]]], [-0.56, [[-0.07, [S('ANTI ICE')]]]], [-0.56, 'blank', 0.19, 0.15, 'CABIN PRESS'],
        [-0.68, [[-0.12, [EXTLT]], [0.21, [S('APU')]], [0.34, [S('SIGNS')]]]]];
      [[-0.08, 'FLT CTL'], [-0.20, 'EVAC'], [-0.32, 'EMER ELEC PWR'], [-0.44, 'GPWS'], [-0.56, 'OXYGEN / CALLS']].forEach(function (b) { LAY.push([b[0], 'blank', -0.33, 0.12, b[1]]); });
      [[-0.08, 'FLT CTL'], [-0.20, 'CARGO SMOKE'], [-0.32, 'VENTILATION'], [-0.44, 'ENG MAN START']].forEach(function (b) { LAY.push([b[0], 'blank', 0.33, 0.12, b[1]]); });
    } else if (famO === 'b737' || famO === 'b737max') {
      // 737NG/MAX: 左列 FLT CONTROL / FUEL / HYD PUMPS, 中 ELEC (BAT / STBY PWR / GRD PWR) + 安全带, 右 WINDOW HEAT / ANTI-ICE / BLEED AIR / PRESS;
      //            前缘一排 APU / ENGINE START / 外部灯; 后头顶板 IRS
      LAY = [[0.06, [[-0.16, [S('IRS')]]]], [0.06, 'blank', 0.18, 0.26, 'AFT OVHD / PSEU'],
        [-0.16, 'blank', -0.30, 0.16, 'FLT CONTROL'], [-0.16, [[-0.03, [S('ELEC')]]]], [-0.16, 'blank', 0.28, 0.22, 'WINDOW HEAT'],
        [-0.30, [[-0.215, [S('FUEL')]]]], [-0.30, [[0.235, [S('ANTI ICE')]]]],
        [-0.44, [[-0.215, [S('HYD')]]]], [-0.44, [[0.215, [S('BLEED AIR')]]]],
        [-0.56, [[-0.12, [S('SIGNS')]]]], [-0.56, 'blank', 0.20, 0.26, 'PRESSURIZATION'],
        [-0.68, [[-0.27, [S('APU')]], [-0.07, [S('ENGINE START')]], [0.22, [EXTLT]]]]];
    } else {
      // 777 / 787 / E190: 中列 (后→前) ELEC / HYD / FUEL / BLEED / ENG START + APU, 左列 IRS / FLT CTL, 右列 WINDOW HEAT / ANTI-ICE / PRESS, 前缘 外部灯
      LAY = [[0.04, [[-0.25, [S('IRS')]]]], [0.04, 'blank', 0.20, 0.30, 'EQUIP COOLING / CARGO'],
        [-0.10, [[-0.10, [S('ELEC')]]]], [-0.10, 'blank', 0.25, 0.22, 'WINDOW HEAT'],
        [-0.22, [[-0.17, [S('HYD')]]]], [-0.22, [[0.235, [S('ANTI ICE')]]]],
        [-0.34, [[-0.06, [S('FUEL')]]]], [-0.34, 'blank', 0.34, 0.12, 'PRESS'],
        [-0.46, [[0.06, [S('BLEED AIR')]]]], [-0.46, 'blank', -0.32, 0.14, 'FLT CTL'],
        [-0.58, [[-0.20, [S('APU')]], [0.02, [S('ENGINE START')]], [0.24, [S('SIGNS')]]]],
        [-0.70, [[0, [EXTLT]]]]];
    }
    var OLK = famO, OL = OLK && FS.OVERHEAD_LAYOUTS && FS.OVERHEAD_LAYOUTS[OLK];
    if (OL) {
      var FN = {};
      [R1, R2, R3, R4, [EXTLT]].forEach(function (r) { r.forEach(function (sec) { sec.items.forEach(function (it) { if (it.sp && it.sp.id) FN[it.sp.id] = it; else if (it.t === 'lamp') FN['adirs-onbat'] = it; }); }); });
      this._buildOverheadData(OL, FN, ovhPanel);
      LAY = [];
    }
    LAY.forEach(function (r) {
      if (r[1] === 'blank') { blank(r[0], r[2], r[3], r[4]); return; }
      r[1].forEach(function (c) { var secs = c[1].filter(Boolean); if (secs.length) row(r[0], secs, c[0]); });
    });

    /* ---- 2. 操纵台: 发动机主电门 (空客 ENG MASTER / 波音 FUEL CONTROL) + ENG MODE ---- */
    var PLD = this._pedLayout, FN2 = {}, nCh0 = this.group.children.length, oTg = this._toggle, oRt = this._rotary;
    if (PLD) {   // 数据布局: 先截获功能控件定义 (不建模), 下面按数据重新摆放
      this._toggle = function (pn, x, y, sp) { FN2[sp.id] = { t: 'tg', sp: sp }; };
      this._rotary = function (pn, x, y, sp) { FN2[sp.id] = { t: 'rot', sp: sp }; };
    }
    var pg = this._pedGeo, pw = pg.pw, pz = pg.qz + pg.qLen / 2 + 0.06;
    var abNarrow = !boeing && this.L.fam !== 'e190', engW = abNarrow ? 0.20 : pw * 1.9;
    var eng = this._panel({ pos: [0, pg.top + 0.004, pz], rotX: -Math.PI / 2, w: engW, h: 0.095,
      labels: [[boeing ? 'FUEL CONTROL' : 'ENG MASTER', -0.065, 0.040, 0.0095, '#ffffff']] });
    [0, 1].forEach(function (i) {
      self._toggle(eng, (i === 0 ? -1 : 1) * 0.065, -0.008, {
        id: 'eng-master-' + (i + 1), label: 'ENG ' + (i + 1), on: boeing ? 'RUN' : 'ON', off: boeing ? 'CUTOFF' : 'OFF', onDir: 1,
        tip: (boeing ? '燃油控制电门 ' : '发动机主电门 ') + (i + 1) + (boeing ? ' (RUN / CUTOFF; 冷舱: 先把 ENG START 旋到 GRD)' : ' (ON / OFF; 冷舱: 先把 ENG MODE 旋到 IGN/START)'),
        get: function () {
          var s = sys(); if (s) return !!s.sw.engMaster[i];
          var f = fm(), e = f && f.engines[Math.min(i, f.engines.length - 1)]; return !!(e && e.state !== 'off' && e.state !== 'shutting');
        },
        lamp: function () { var f = fm(), e = f && f.engines[Math.min(i, f.engines.length - 1)]; return e && (e.state === 'starting' || e.state === 'shutting') ? 0xffb000 : 0; },
        toggle: function () {
          var s = sys(), f = fm(); if (!f) return;
          if (s) { var on = !s.sw.engMaster[i]; s.setEngMaster(i, on); notify((boeing ? 'FUEL CONTROL ' : 'ENG MASTER ') + (i + 1) + (on ? (boeing ? ' RUN' : ' ON') : (boeing ? ' CUTOFF' : ' OFF'))); return; }
          if (domClick('eng-start-' + (i + 1))) return;
          if (f.engines[i].state === 'off') f.startEngine(i); else f.shutdownEngine(i);
        }
      });
    });
    if (!boeing) {
      this._rotary(eng, 0, -0.010, {
        id: 'eng-mode', label: 'MODE', positions: ['CRANK', 'NORM', 'IGN START'], r: 0.011, step: 0.75,
        tip: '发动机方式选择 ENG MODE (IGN/START = 起动, 起动后回 NORM)',
        get: function () { var s = sys(); return s ? ['CRANK', 'NORM', 'IGN'].indexOf(s.sw.engMode) : 1; },
        set: function (i) { var s = sys(); if (s) { s.set('engMode', ['CRANK', 'NORM', 'IGN'][i]); notify('ENG MODE ' + ['CRANK', 'NORM', 'IGN/START'][i]); } }
      });
    }
    // 停留刹车 (操纵台右侧)
    var pbx = Math.min(0.15, pw * 0.95 - 0.03), pbPan = eng, pby = -0.006;
    if (abNarrow) {   // 空客: 停留刹车手柄在操纵台最后部 (方向舵配平旁)
      pbPan = this._panel({ pos: [-pw * 0.5, pg.top + 0.004, pg.zEnd - 0.055], rotX: -Math.PI / 2, w: pw * 0.8, h: 0.08, labels: [['PARK BRK', 0, 0.03, 0.0095, '#ffffff']] });
      pbx = 0; pby = -0.008;
    }
    this._rotary(pbPan, pbx, pby, {
      id: 'park-brake', label: boeing ? 'PARK BRAKE' : 'PARK BRK', positions: ['OFF', 'ON'], step: 1.2, r: 0.011,
      tip: '停留刹车 (点击 / 滚轮 开关)',
      get: function () { var f = fm(); return f && f.parkingBrake ? 1 : 0; },
      set: function (i) { var f = fm(); if (!f) return; if (!!f.parkingBrake !== !!i) { if (!domClick('park-brake')) f.setParkingBrake(!!i); } }
    });
    var pbLamp = this._lampMat();
    this._plane(0.022, 0.007, pbLamp, pbx + (abNarrow ? 0.03 : 0), abNarrow ? -0.008 : -0.04, 0.002, 0, 0, 0, pbPan.g);
    if (pbPan !== eng && pbPan.mat.map) pbPan.mat.map.needsUpdate = true;
    this._regLamp(pbLamp, function () { var f = fm(); return f && f.parkingBrake ? 0xff3020 : 0; });
    if (eng.mat.map) eng.mat.map.needsUpdate = true;
    // ATC / TCAS (简化选择器)
    var atc = this._panel({ pos: [0, pg.top + 0.004, pz + 0.105], rotX: -Math.PI / 2, w: pw * 1.9, h: 0.085,
      labels: [['ATC / TCAS', 0, 0.034, 0.0090, '#ffffff']] });
    this._rotary(atc, -0.06, -0.012, { id: 'xpdr', label: 'XPDR', positions: ['STBY', 'AUTO', 'ON'], r: 0.011, tip: '应答机 (STBY / AUTO / ON)',
      get: function () { var s = sys(); return s ? Math.max(0, ['STBY', 'AUTO', 'ON'].indexOf(s.sw.xpdr)) : 1; },
      set: function (i) { var s = sys(); if (s) { s.set('xpdr', ['STBY', 'AUTO', 'ON'][i]); notify('XPDR ' + s.sw.xpdr); } } });
    this._rotary(atc, 0.06, -0.012, { id: 'tcas', label: 'TCAS', positions: ['STBY', 'TA', 'TA/RA'], r: 0.011, tip: 'TCAS (STBY / TA / TA/RA)',
      get: function () { var s = sys(); return s ? Math.max(0, ['STBY', 'TA', 'TA/RA'].indexOf(s.sw.tcas)) : 2; },
      set: function (i) { var s = sys(); if (s) { s.set('tcas', ['STBY', 'TA', 'TA/RA'][i]); notify('TCAS ' + s.sw.tcas); } } });
    if (atc.mat.map) atc.mat.map.needsUpdate = true;
    if (PLD) {
      this._toggle = oTg; this._rotary = oRt;
      while (this.group.children.length > nCh0) this.group.remove(this.group.children[this.group.children.length - 1]);   // 丢弃截获阶段的旧面板
      FN2.wxr = { t: 'pb', sp: { id: 'wxr', tip: '气象雷达 WX (中央操纵台雷达控制板)', get: function () { return lit('nd-weather'); },
        legend: function () { return [{ t: 'FAULT', col: AMB, on: false }, { t: 'ON', col: GRN, on: lit('nd-weather') }]; },
        press: function () { domClick('nd-weather'); } } };
      var zA = pg.qz + pg.qLen / 2, kk = this.L.k;
      this._buildOverheadData(PLD.panels, FN2, function (zc, w, h, labels, xc) {
        return self._panel({ pos: [(xc || 0) * kk, pg.top + 0.004, zA + zc * kk], rotX: -Math.PI / 2, w: w, h: h, labels: labels });
      });
    }

    /* ---- 3. 主仪表板中央 (下显示器右侧): 自动刹车旋钮 ---- */
    var pd = this._panelDims, du = this.L.du;
    var abx = (du / 2 + 0.012 + pd.cw) / 2, aby = -(0.014 + du / 2) - du - 0.03, abw = Math.max(0.08, pd.cw - du / 2 - 0.02);
    var abModes = safe(function () { return fm().ac.systems.autoBrake; }, null) || ['OFF', 'LO', 'MED', 'MAX'];
    var ab = this._panel({ parent: this.panelGroup, pos: [abx, aby, 0.006], w: abw, h: 0.10,
      labels: [['AUTO BRK', 0, 0.04, 0.0095, '#ffffff']] });
    this._rotary(ab, 0, -0.012, {
      id: 'autobrake', label: '', positions: abModes, r: 0.012, step: Math.min(0.55, 2.6 / Math.max(1, abModes.length - 1)),
      tip: '自动刹车 (左键 / 滚轮向上 = 下一档, 右键 = 上一档)',
      get: function () { var f = fm(); var i = f ? abModes.indexOf(f.autoBrake) : 0; return i < 0 ? 0 : i; },
      set: function (i) {
        var m = abModes[i], f = fm(); if (!f) return;
        var b = doc && doc.querySelector && doc.querySelector('#autobrake-list .ab-btn[data-mode="' + m + '"]');
        if (b) b.click(); else { f.setAutoBrake(m); notify('自动刹车 ' + m); }
      }
    });
    if (ab.mat.map) ab.mat.map.needsUpdate = true;
  };

  /** 每帧: 开关动画 + 指示灯 (指示灯 10 Hz) */
  P._updateSwitches = function (dt) {
    var a = Math.min(1, dt * 16), lampTick = (this._lampT = (this._lampT || 0) + dt) >= 0.1;
    if (lampTick) this._lampT = 0;
    for (var i = 0; i < this.controls.length; i++) {
      var c = this.controls[i];
      if (c.ann) { if (lampTick) this._drawAnn(c.ann); continue; }
      if (c.lamp) {
        if (!lampTick) continue;
        var col = safe(c.fn, 0) || 0;
        if (col !== c.last) { c.last = col; c.lamp.color.setHex(col || 0x1a1c1e); }
        continue;
      }
      if (c.pressT > 0) c.pressT -= dt;
      var tg = c.target();
      if (c.cur === null) c.cur = tg;
      c.cur += (tg - c.cur) * Math.min(1, dt * c.speed);
      if (Math.abs(tg - c.cur) < 1e-4) c.cur = tg;
      c.obj[c.prop] = c.cur;
      void a;
    }
  };

  /** 测试 / 教学: 控件中心的 NDC 坐标 */
  P.locateCtl = function (id, camera) {
    var e = this.ctlById[id];
    if (!e) return null;
    this.group.updateMatrixWorld(true);
    var p = new this.THREE.Vector3().setFromMatrixPosition(e.mesh.matrixWorld).project(camera);
    return { x: p.x, y: p.y, z: p.z };
  };
  /** 列出全部可操作控件 (调试 / 文档) */
  P.listControls = function () {
    var out = Object.keys(this.ctlById).map(function (id) { return id; });
    var rects = 0;
    this.clickables.forEach(function (o) { if (o.userData.rects) rects += o.userData.rects.length; });
    return { meshControls: out, canvasHotspots: rects };
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
    // 顶板底板: 纯哑光面板色 + 细噪点 (具体面板由三维开关面板 / 空白面板按真实位置摆放)
    var g = c.getContext('2d'), W = c.width, H = c.height, r = 5;
    g.fillStyle = hex(this.pal.panel); g.fillRect(0, 0, W, H);
    for (var i = 0; i < 5000; i++) { r = (r * 16807) % 2147483647; g.fillStyle = 'rgba(0,0,0,' + (0.03 + (r % 5) * 0.01) + ')'; g.fillRect(r % W, (r >> 8) % H, 2, 2); }
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3; g.strokeRect(2, 2, W - 4, H - 4);
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
      roll: ap.rollMode || '', pitch: ap.pitchMode || '', thrust: ap.thrustMode || '',
      pwr: !(sim && sim.fm && sim.fm.sys && !sim.fm.sys.out.dc)
    };
  };

  P._drawFCU = function (v) {
    var c = this.fcuCanvas, g = c.getContext('2d'), W = c.width, H = c.height, rects = [], self = this;
    var boeing = this.L.maker === 'boeing';
    var img = this._abFCU && this._abImg('fcu');
    if (this._abFCU) return this._drawFCUPhoto(v, g, W, H, img);
    g.fillStyle = boeing ? '#4d5257' : '#56636f'; g.fillRect(0, 0, W, H);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    function label(t, x, y, size) { g.fillStyle = '#e8ebee'; g.font = 'bold ' + (size || 13) + 'px sans-serif'; g.fillText(t, x, y); }
    function lcd(t, x, y, w, h) {
      g.fillStyle = '#07090a'; g.fillRect(x, y, w, h);
      if (!v.pwr) return;          // 冷舱: 无电时 FCU 窗口全黑
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

  /* Airbus FCU: 实拍底图 + 动态窗口/指示灯, 热区与照片中旋钮/按钮对齐 */
  P._drawFCUPhoto = function (v, g, W, H, img) {
    var rects = [];
    if (img) g.drawImage(img, 0, 0, W, H); else { g.fillStyle = '#3a4550'; g.fillRect(0, 0, W, H); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#07090a'; g.fillRect(88, 22, 850, 58);
    g.fillStyle = '#ff9d2e'; g.font = 'bold 40px monospace';
    g.fillText(String(v.spd), 160, 52); g.fillText(String(v.hdg), 312, 52); g.fillText(String(v.alt), 690, 52); g.fillText(String(v.vs), 880, 52);
    g.font = 'bold 15px monospace'; g.fillText(v.mach ? 'MACH' : 'SPD', 105, 34); g.fillText('HDG', 262, 34); g.fillText('ALT', 640, 34); g.fillText('V/S', 830, 34);
    function knob(cx, id) {
      rects.push({ x: cx - 90, y: 120, w: 60, h: 140, act: { knob: id, dir: -1 } });
      rects.push({ x: cx + 30, y: 120, w: 60, h: 140, act: { knob: id, dir: 1 } });
      rects.push({ x: cx - 30, y: 120, w: 60, h: 70, act: { click: 'fcu-' + id + '-push' } });
      rects.push({ x: cx - 30, y: 190, w: 60, h: 70, act: { click: 'fcu-' + id + '-pull' } });
    }
    knob(155, 'spd'); knob(312, 'hdg'); knob(690, 'alt'); knob(895, 'vs');
    function btn(x, y, w, h, on, id) {
      if (on) { g.fillStyle = '#3dff6a'; g.fillRect(x + w / 2 - 16, y + 6, 32, 6); }
      rects.push({ x: x, y: y, w: w, h: h, act: { click: id } });
    }
    btn(430, 168, 75, 62, v.ap1, 'fcu-ap1'); btn(522, 168, 75, 62, v.ap2, 'fcu-ap2');
    btn(478, 258, 70, 58, v.athr, 'fcu-athr'); btn(278, 275, 68, 50, v.loc, 'fcu-loc');
    btn(656, 275, 68, 50, v.pitch === 'FLCH', 'fcu-exped'); btn(860, 275, 70, 50, v.appr, 'fcu-appr');
    btn(14, 108, 70, 70, v.mach, 'fcu-spd-mach');
    this.fcuMesh.userData.rects = rects;
    this.fcuTex.needsUpdate = true;
  };

  P._efisValues = function () {
    var sim = this.sim || {}, p = sim.pfdL || {}, n = sim.ndL || {};
    var ap = (sim.ap && sim.ap.ap) || {};
    return { std: p.baroStd !== false, baro: Math.round(p.baroSetting || 1013), mode: n.mode || 'ROSE', range: n.rangeNm || 40,
      terr: !!n.terrainOn, wx: n.weatherOn !== false, fd: !!(ap.fd1 || ap.fd2) };
  };
  P._drawEFIS = function (v) {
    var c = this.efisCanvas, g = c.getContext('2d'), W = c.width, H = c.height, rects = [];
    var boeing = this.L.maker === 'boeing';
    if (this._abFCU) {
      var self = this;
      // 照片中各元件位置 (像素): 左 = 机长 EFIS, 右 = 副驾 EFIS (镜像布局)
      var LAY = {
        L: { cv: this.efisCanvas, tex: this.efisTex, img: 'efisL', win: [62, 50, 104, 40], knob: [113, 165], fd: [62, 218], ls: [124, 218], mode: [262, 150], rng: [430, 150] },
        R: { cv: this.efisCanvasR, tex: this.efisTexR, img: 'efisR', win: [352, 55, 104, 40], knob: [410, 175], fd: [408, 224], ls: [345, 224], mode: [250, 150], rng: [80, 150] }
      };
      ['L', 'R'].forEach(function (sd) {
        var Q = LAY[sd], cv = Q.cv, gg = cv.getContext('2d'), rr = [], im = self._abImg(Q.img);
        if (im) gg.drawImage(im, 0, 0, cv.width, cv.height); else { gg.fillStyle = '#3a4550'; gg.fillRect(0, 0, cv.width, cv.height); }
        gg.textAlign = 'center'; gg.textBaseline = 'middle';
        var w0 = Q.win;
        gg.fillStyle = '#07090a'; gg.fillRect(w0[0], w0[1], w0[2], w0[3]);
        gg.fillStyle = '#ff9d2e'; gg.font = 'bold 28px monospace'; gg.fillText(v.std ? 'Std' : String(v.baro), w0[0] + w0[2] / 2, w0[1] + w0[3] / 2 + 1);
        rr.push({ x: w0[0], y: w0[1], w: w0[2], h: w0[3], act: { click: 'baro-std' } });
        rr.push({ x: Q.knob[0] - 44, y: Q.knob[1] - 40, w: 44, h: 80, act: { click: 'baro-dec' } });
        rr.push({ x: Q.knob[0], y: Q.knob[1] - 40, w: 44, h: 80, act: { click: 'baro-inc' } });
        if (v.fd) { gg.fillStyle = '#3dff6a'; gg.fillRect(Q.fd[0] + 14, Q.fd[1] + 5, 28, 5); }
        rr.push({ x: Q.fd[0], y: Q.fd[1], w: 56, h: 40, act: { click: 'efis-fd' } });
        gg.fillStyle = '#3fd7ff'; gg.font = 'bold 15px monospace';
        gg.fillText(v.mode, Q.mode[0], Q.mode[1] + 55); gg.fillText(String(v.range), Q.rng[0], Q.rng[1] + 55);
        rr.push({ x: Q.mode[0] - 47, y: Q.mode[1] - 47, w: 95, h: 95, act: { click: 'nd-mode' } });
        rr.push({ x: Q.rng[0] - 50, y: Q.rng[1] - 47, w: 50, h: 95, act: { click: 'nd-range-down' } });
        rr.push({ x: Q.rng[0], y: Q.rng[1] - 47, w: 50, h: 95, act: { click: 'nd-range-up' } });
        self.efisMeshes.forEach(function (m) { if (m.userData.canvas === cv) m.userData.rects = rr; });
        Q.tex.needsUpdate = true;
      });
      return;
    }
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
    btn('FD', 152, 12, v.fd, 'efis-fd'); btn('LS', 214, 12, false, null);
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
    // 电源: 断电时整块仪表板黑屏
    var powered = !!(st && st.electricalPower);
    this._setDark(!powered);
    // 操纵机构
    this._updateControls(dt, st);
    this._updateSwitches(dt);
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
      if (!powered) {
        // 断电: 指示灯全灭 (FCU/EFIS 面板已在 _setDark 中变暗)
        this.mwMat.color.setHex(0x3a0806);
        this.mcMat.color.setHex(0x3a2a04);
        this.gearLights.forEach(function (m) { m.color.setHex(0x0c2610); });
      } else {
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
    }
  };

  /* 断电黑屏: 把 显示器/FCU/EFIS 画布涂黑; 恢复供电时强制重绘 */
  P._setDark = function (on) {
    on = !!on;
    if (on === !!this._dark) return;
    this._dark = on;
    var self = this, dark = '#050607';
    ['pfd', 'nd', 'upper', 'lower'].forEach(function (k) {
      var c = self.dispCanvas[k], g = c.getContext('2d');
      g.fillStyle = dark; g.fillRect(0, 0, c.width, c.height);
      self.dispTex[k].needsUpdate = true;
    });
    [this.fcuCanvas, this.efisCanvas].forEach(function (c) {
      if (!c) return;
      var g = c.getContext('2d'); g.fillStyle = dark; g.fillRect(0, 0, c.width, c.height);
    });
    if (this.fcuTex) this.fcuTex.needsUpdate = true;
    if (this.efisTex) this.efisTex.needsUpdate = true;
    if (!on) { this._sig.fcu = null; this._sig.efis = null; }   // 恢复供电 -> 重新绘制
  };

  P._renderDisplays = function (st, data) {
    var sim = this.sim, D = FS.Displays, t0 = (global.performance && global.performance.now()) || 0;
    if (!D) return;
    if (this._dark) return;                 // 断电黑屏: 不绘制仪表
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
    var so = sim && sim.fm && sim.fm.sys ? sim.fm.sys.out : null, dp = so && so.disp;
    try {
      this.pfd.render(data);
      this.nd.render(data);
      this.ecam.render(data);
      this._drawLower(st);
      if (dp) this._sysOverlay(so, dp);
    } catch (e) {
      if (!this._warned) { this._warned = true; if (FS.Log) FS.Log.warn('3D 驾驶舱仪表渲染错误: ' + e.message); }
    }
    this.dispTex.pfd.needsUpdate = this.dispTex.nd.needsUpdate = this.dispTex.upper.needsUpdate = this.dispTex.lower.needsUpdate = true;
    this.stats.displayFrames++;
    this.stats.lastRenderMs = ((global.performance && global.performance.now()) || 0) - t0;
  };

  /** beta 0.4.2 冷舱: 无电黑屏, IR 未对准时 PFD 姿态 / ND 地图红旗 */
  P._sysOverlay = function (so, dp) {
    var C = this.dispCanvas;
    function black(c) { var g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); return g; }
    function flag(g, t, x, y, sz) { g.font = 'bold ' + sz + 'px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ff2a1a'; g.fillText(t, x, y); }
    if (!dp.pfd) black(C.pfd);
    else if (!so.adr) { var g0 = black(C.pfd), S0 = C.pfd.width / 480; flag(g0, 'SPD', 60 * S0, 200 * S0, 26 * S0); flag(g0, 'ATT', 238 * S0, 206 * S0, 34 * S0); flag(g0, 'ALT', 420 * S0, 200 * S0, 26 * S0); flag(g0, 'HDG', 238 * S0, 420 * S0, 26 * S0); }
    else if (!so.irAtt) {
      var g1 = C.pfd.getContext('2d'), S1 = C.pfd.width / 480;
      g1.setTransform(1, 0, 0, 1, 0, 0); g1.fillStyle = '#000'; g1.fillRect(126 * S1, 60 * S1, 224 * S1, 292 * S1); g1.fillRect(126 * S1, 380 * S1, 224 * S1, 90 * S1);
      flag(g1, 'ATT', 238 * S1, 190 * S1, 34 * S1); flag(g1, 'HDG', 238 * S1, 420 * S1, 24 * S1);
      if (so.irAligning) { g1.fillStyle = '#3dff6a'; g1.font = 'bold ' + Math.round(17 * S1) + 'px monospace'; g1.fillText('ALIGN ' + Math.ceil(so.irAlignLeft) + 's', 238 * S1, 240 * S1); }
    }
    if (!dp.nd) black(C.nd);
    else if (!so.irNav) { var g2 = black(C.nd), S2 = C.nd.width / 480; flag(g2, so.irAtt ? 'MAP NOT AVAIL' : 'HDG', 240 * S2, 230 * S2, 26 * S2); if (so.irAligning) { g2.fillStyle = '#3dff6a'; g2.font = 'bold ' + Math.round(18 * S2) + 'px monospace'; g2.fillText('IR ALIGN ' + Math.ceil(so.irAlignLeft) + 's', 240 * S2, 280 * S2); } }
    if (!dp.upper) black(C.upper);
    if (!dp.lower) black(C.lower);
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
    if (this.trimWheels && this.trimWheels.length) { var tr = (fm.surfaces && fm.surfaces.elevatorTrim) || 0; this.trimWheels.forEach(function (w) { w.rotation.x = tr * 12; }); }
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
    if (o.userData.ctl) return { ctl: o.userData.ctl, kind: 'ctl' };
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
  P.perform = function (hit, mult, dir) {
    if (!hit) return false;
    var sim = this.sim, doc = global.document;
    if (hit.ctl) { if (hit.ctl.click) hit.ctl.click(dir || 1); this._sig.fcu = ''; this._sig.efis = ''; return true; }
    if (hit.fn) { hit.fn(); return true; }
    var a = hit.act;
    if (!a) return false;
    if (a.knob && sim && sim.hud && sim.hud._knobAdjust) {
      var n = mult || 1, step = a.knob === 'hdg' || a.knob === 'spd' ? 1 : 1;
      for (var i = 0; i < n * step; i++) sim.hud._knobAdjust('fcu-' + a.knob + (a.dir > 0 ? '-inc' : '-dec'), a.dir);
      this._sig.fcu = '';
      return true;
    }
    if (a.click === 'efis-fd') { this._toggleFD(); this._sig.efis = ''; return true; }
    if (a.click) {
      var e = doc && doc.getElementById(a.click);
      if (e) { e.click(); this._sig.fcu = ''; this._sig.efis = ''; return true; }
    }
    return false;
  };

  /** @param {string} [want] 'up' | 'down'; 缺省 = 切换 */
  P._clickGear = function (want) {
    var sim = this.sim, fm = sim && sim.fm, doc = global.document;
    if (!fm) return;
    var down = want ? want === 'down' : fm.gearCmd < 0.5;
    if (down === fm.gearCmd > 0.5) return;
    var before = fm.gearCmd;
    var e = doc && doc.getElementById(down ? 'gear-down' : 'gear-up');
    if (e) e.click(); else fm.setGear(down);
    if (fm.gearCmd !== before && sim.audio && sim.audio.playCue) { sim.audio.playCue(down ? 'gear_down' : 'gear_up'); sim.audio.playCue('gear_motor'); }
  };
  /** @param {number} [dir] +1 = 放下一档 (默认), -1 = 收上一档 */
  P._clickFlap = function (dir) {
    var sim = this.sim, fm = sim && sim.fm;
    if (!fm || !fm.stepFlap) return;
    var before = fm.flapDetentIndex;
    var name = fm.stepFlap(dir < 0 ? -1 : 1);
    if (fm.flapDetentIndex === before) return;
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
  /** 减速板分档: 0 / 0.5 / 1 */
  P._stepSpoiler = function (dir) {
    var sim = this.sim, fm = sim && sim.fm;
    if (!fm || !fm.setSpoilers) return;
    var cur = Math.round((fm.spoilerCmd || 0) * 2) / 2, nv = Math.max(0, Math.min(1, cur + (dir > 0 ? 0.5 : -0.5)));
    if (nv === cur) return;
    fm.setSpoilers(nv);
    if (sim.audio && sim.audio.playCue) sim.audio.playCue('speedbrake');
    if (sim.hud) sim.hud.notify('减速板 ' + (nv === 0 ? '收回' : nv < 1 ? '半程' : '全放出'), 'info', 1200);
  };
  P._clickSpoilerArm = function () {
    var doc = global.document, e = doc && doc.getElementById('spoiler-arm'), fm = this.sim && this.sim.fm;
    if (e) e.click(); else if (fm) fm.spoilerArmedLanding = !fm.spoilerArmedLanding;
  };
  P._toggleFD = function () {
    var sim = this.sim, ap = sim && sim.ap && sim.ap.ap;
    if (!ap) return;
    var on = !(ap.fd1 || ap.fd2);
    ap.fd1 = on; ap.fd2 = on;
    if (sim.hud) sim.hud.notify('飞行指引 FD ' + (on ? '开' : '关'), 'info', 1200);
  };

  P.dispose = function () {
    if (this.group.parent) this.group.parent.remove(this.group);
    this._geoms.forEach(function (g) { g.dispose(); });
    this._mats.forEach(function (m) { m.dispose(); });
    this._texs.forEach(function (t) { t.dispose(); });
    this._geoms = []; this._mats = []; this._texs = [];
    this.clickables = []; this.controls = []; this.ctlById = {};
  };

  /**
   * 交互绑定 (鼠标):
   *  · 左键点击按钮 / 开关; 右键 (或 Shift+左键) = 反向操作 (襟翼收上、旋钮上一档、减速板预位…)
   *  · 按住手柄上下拖动 (推力手柄 / 襟翼 / 减速板); 拖动不足 4 px 视为点击
   *  · 滚轮转旋钮 / 推拉手柄; ALT 旋钮滚轮一格 1000 ft, Shift+滚轮 100 ft
   *  · 悬停显示手形光标与控件名称
   */
  function bindInteraction(sim) {
    if (!global.addEventListener || bindInteraction._done) return;
    bindInteraction._done = true;
    var held = null, drag = null;
    function onScene(ev) {
      var id = ev.target && ev.target.id;
      return id === 'viewport' || id === 'hud-canvas';
    }
    function ndc(ev) { return [(ev.clientX / global.innerWidth) * 2 - 1, -(ev.clientY / global.innerHeight) * 2 + 1]; }
    function cp() { return sim.cockpit3d && sim.cockpit3d.active && sim.running ? sim.cockpit3d : null; }
    global.addEventListener('mousedown', function (ev) {
      var c = cp(); if (!c || (ev.button !== 0 && ev.button !== 2) || !onScene(ev)) return;
      // beta 0.4: 鼠标驾驶杆模式下也允许点击 FCU 按钮 / 旋钮 (点击不参与杆量, 也不会触发 AP 超控断开)
      var n = ndc(ev), hit = c.pick(n[0], n[1], sim.camera);
      if (!hit) return;
      ev.stopPropagation(); ev.preventDefault();
      var dir = (ev.button === 2 || ev.shiftKey) ? -1 : 1;
      if (hit.ctl && hit.ctl.drag) {
        drag = { c: c, hit: hit, dir: dir, y0: ev.clientY, y: ev.clientY, moved: false };
        return;
      }
      if (hit.act && hit.act.knob && ev.button === 2) return;      // 旋钮左右半边已区分方向
      c.perform(hit, 1, dir);
      if (hit.act && hit.act.knob) {
        var t0 = Date.now(), mult = hit.act.knob === 'alt' && !ev.shiftKey ? 10 : 1;
        if (mult > 1) c.perform(hit, mult - 1);   // ALT: 单击 1000 ft
        held = global.setInterval(function () { if (Date.now() - t0 > 350) c.perform(hit, mult); }, 90);
      }
    }, true);
    global.addEventListener('mousemove', function (ev) {
      if (!drag) return;
      var dy = ev.clientY - drag.y;
      if (!drag.moved && Math.abs(ev.clientY - drag.y0) > 4) { drag.moved = true; if (drag.hit.ctl.drag.begin) drag.hit.ctl.drag.begin(); dy = ev.clientY - drag.y0; }
      if (drag.moved && dy) drag.hit.ctl.drag.move(-dy / Math.max(1, global.innerHeight));
      drag.y = ev.clientY;
      ev.stopPropagation();
    }, true);
    global.addEventListener('mouseup', function () {
      if (held) { global.clearInterval(held); held = null; }
      if (drag) {
        var d = drag; drag = null;
        if (!d.moved) d.c.perform(d.hit, 1, d.dir);
      }
    }, true);
    global.addEventListener('wheel', function (ev) {
      var c = cp(); if (!c || !onScene(ev)) return;
      var n = ndc(ev), hit = c.pick(n[0], n[1], sim.camera);
      if (!hit) return;
      var dir = ev.deltaY < 0 ? 1 : -1;
      if (hit.ctl) {
        if (!hit.ctl.wheel) return;
        ev.stopPropagation(); if (ev.cancelable) ev.preventDefault();
        var now = Date.now();
        if (hit.ctl.wheelStep !== false && c._wheelT && now - c._wheelT < 120 && hit.ctl.id !== 'throttle1' && hit.ctl.id !== 'throttle2') return;   // 触控板防连跳
        c._wheelT = now;
        hit.ctl.wheel(dir);
        return;
      }
      if (!hit.act || !hit.act.knob) return;
      ev.stopPropagation(); if (ev.cancelable) ev.preventDefault();
      c.perform({ act: { knob: hit.act.knob, dir: dir } }, hit.act.knob === 'alt' ? (ev.shiftKey ? 1 : 10) : 2);
    }, { capture: true, passive: false });
    var lastMove = 0;
    global.addEventListener('mousemove', function (ev) {
      var c = cp(), now = Date.now();
      if (drag || now - lastMove < 80) return; lastMove = now;
      var vp = global.document.getElementById('viewport');
      var hc = global.document.getElementById('hud-canvas');
      if (!c || !onScene(ev) || (sim.input && sim.input.mouse && sim.input.mouse.down)) {
        if (vp && vp.style.cursor) vp.style.cursor = '';
        if (hc && hc.style.cursor) hc.style.cursor = '';
        return;
      }
      var n = ndc(ev), hit = c.pick(n[0], n[1], sim.camera);
      var cur = hit ? (hit.ctl && hit.ctl.drag ? 'ns-resize' : 'pointer') : '';
      var tip = hit && hit.ctl && hit.ctl.tip ? hit.ctl.tip : '';
      [vp, hc].forEach(function (el) {
        if (!el) return;
        if (el.style.cursor !== cur) el.style.cursor = cur;
        if (el.title !== tip) el.title = tip;
      });
    }, true);
  }

  FS.Cockpit3D = Cockpit3D;
  FS.Cockpit3D.layoutFor = layoutFor;
  FS.Cockpit3D.TYPE_LAYOUT = TYPE_LAYOUT;
  FS.Cockpit3D.bindInteraction = bindInteraction;
  if (FS.Log) FS.Log.info('cockpit3d.js 已加载 — 三维驾驶舱 (空客 / 波音布局)');
})(typeof window !== 'undefined' ? window : globalThis);
