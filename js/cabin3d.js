/* ==========================================================================
   天际航线 SkyRoute — 三维客舱 (cabin3d.js, beta 0.4.2)
   --------------------------------------------------------------------------
   · 客舱视角: 走道第一人称, 两侧座椅排 / 头顶行李架 / 舷窗 / 舱顶灯带 / 舱壁板
   · 全部为程序化几何体 (InstancedMesh 合批), 使用无光照材质 + 烘焙朝向明暗,
     由环境昼夜系数统一调亮度 (与 cockpit3d 一致, 不额外增加灯光)
   · 仅在 "客舱" 视角显示; 机身外壳为单面材质, 从舱内看被背面剔除, 不会遮挡
   坐标: 与飞机模型一致 x 右, y 上, z 尾 (机头 -z), 原点 = 机身中线高度中心
   ========================================================================== */
(function (global) {
  'use strict';
  var FS = global.FS = global.FS || {};

  function Cabin3D(THREE, typeKey, opts) {
    this.THREE = THREE;
    this.typeKey = typeKey;
    var ac = (FS.AIRCRAFT_DB && FS.AIRCRAFT_DB[typeKey]) || {};
    this.ac = ac;
    this.d = ac.dims || {};
    this.sim = (opts && opts.sim) || null;
    this.group = new THREE.Group();
    this.group.name = 'cabin3d';
    this.group.visible = false;
    this.active = false;
    this._mats = [];
    this._geoms = [];
    this._bright = -1;
    this._build();
  }
  var P = Cabin3D.prototype;

  /* ---------------- 材质 / 几何辅助 ---------------- */
  P._mat = function (hexc, o) {
    var THREE = this.THREE;
    o = o || {};
    var m = new THREE.MeshBasicMaterial({
      color: hexc, vertexColors: !o.flat, side: o.side || THREE.DoubleSide,
      fog: false, toneMapped: o.toneMapped !== false,
      transparent: !!o.transparent, opacity: o.opacity === undefined ? 1 : o.opacity
    });
    m.userData.base = new THREE.Color(hexc);
    if (!o.emissive && m.userData.base.convertSRGBToLinear) m.userData.base.convertSRGBToLinear();
    m.color.copy(m.userData.base);
    m.userData.emissive = !!o.emissive;
    this._mats.push(m);
    return m;
  };
  P._mesh = function (geom, mat, parent) {
    var m = new this.THREE.Mesh(geom, mat);
    m.frustumCulled = false;
    (parent || this.group).add(m);
    this._geoms.push(geom);
    return m;
  };
  /** 用矩阵数组生成一个 InstancedMesh (合批) */
  P._inst = function (geom, mat, mats) {
    var THREE = this.THREE;
    var im = new THREE.InstancedMesh(geom, mat, mats.length);
    for (var i = 0; i < mats.length; i++) im.setMatrixAt(i, mats[i]);
    im.instanceMatrix.needsUpdate = true;
    im.frustumCulled = false;
    this.group.add(im);
    return im;
  };
  P._mkMat4 = function (x, y, z, rx) {
    var THREE = this.THREE;
    var q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, 0, 0, 'XYZ'));
    return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
  };

  /* ---------------- 建模 ---------------- */
  P._build = function () {
    var THREE = this.THREE, d = this.d, ac = this.ac;
    var R = d.fuselageRadius || 2.0;
    var L = d.length || 40;
    var noseLen = d.noseLength || 8;
    var tailLen = d.tailConeLength || 10;
    var wide = ac.class === 'widebody';
    var zN = -(L * 0.5 - 1.0);
    var z0 = zN + noseLen + 1.6;
    var z1 = (zN + L) - tailLen - 1.6;
    if (z1 - z0 < 8) { z0 = -L * 0.28; z1 = L * 0.28; }
    var len = z1 - z0, zc = (z0 + z1) / 2;
    this.floorY = -R * 0.72;
    this.ceilY = R * 0.82;

    var M = this.M = {
      shell: this._mat(0xe8ebef, { side: THREE.BackSide }),
      floor: this._mat(0x565a61),
      aisle: this._mat(0x6b7078),
      seat: this._mat(0x33506f),
      seatD: this._mat(0x27405a),
      bin: this._mat(0xf1f3f6),
      binTrim: this._mat(0xc7ccd4),
      wall: this._mat(0xdde1e6),
      bulk: this._mat(0xd2d7dd),
      window: this._mat(0x0b1220, { emissive: true, toneMapped: false, flat: true }),
      strip: this._mat(0xfff1c6, { emissive: true, toneMapped: false, flat: true })
    };

    /* ---- 舱壁壳 (内表面) ---- */
    var shellGeo = new THREE.CylinderGeometry(R * 0.99, R * 0.99, len, 32, 1, true);
    shellGeo.rotateX(Math.PI / 2);
    var shell = this._mesh(shellGeo, M.shell);
    shell.position.set(0, 0, zc);
    shell.scale.set(1, 1.02, 1);

    /* ---- 地板 + 走道 ---- */
    var floor = this._mesh(new THREE.BoxGeometry(2 * R * 0.95, 0.06, len), M.floor);
    floor.position.set(0, this.floorY, zc);
    var aisleW = wide ? 1.02 : 0.60;
    var aisle = this._mesh(new THREE.BoxGeometry(aisleW, 0.02, len * 0.99), M.aisle);
    aisle.position.set(0, this.floorY + 0.045, zc);

    /* ---- 前后隔板 ---- */
    var bhGeo = new THREE.CircleGeometry(R * 0.99, 24);
    var bhF = this._mesh(bhGeo, M.bulk); bhF.position.set(0, 0, z0 + 0.05); bhF.scale.set(1, 1.02, 1);
    var bhB = this._mesh(bhGeo, M.bulk); bhB.position.set(0, 0, z1 - 0.05); bhB.scale.set(1, 1.02, 1);

    /* ---- 舱顶灯带 ---- */
    var stripGeo = new THREE.BoxGeometry(0.14, 0.04, len * 0.97);
    for (var ss = -1; ss <= 1; ss += 2) {
      var st = this._mesh(stripGeo.clone(), M.strip);
      st.position.set(ss * R * 0.34, this.ceilY - 0.06, zc);
      this._geoms.push(st.geometry);
    }

    /* ---- 头顶行李架 (两侧长条) ---- */
    var binGeo = new THREE.BoxGeometry(0.54, 0.42, len * 0.96);
    var lipGeo = new THREE.BoxGeometry(0.50, 0.06, len * 0.96);
    for (var b = -1; b <= 1; b += 2) {
      var bin = this._mesh(binGeo.clone(), M.bin);
      bin.position.set(b * R * 0.60, R * 0.56, zc);
      var lip = this._mesh(lipGeo.clone(), M.binTrim);
      lip.position.set(b * R * 0.56, R * 0.34, zc);
      this._geoms.push(bin.geometry, lip.geometry);
    }

    /* ---- 舷窗 (两侧, InstancedMesh) ---- */
    var winGeo = new THREE.BoxGeometry(0.06, 0.30, 0.24);
    var winMats = [];
    var winPitch = 0.55;
    var winN = Math.max(4, Math.floor((len - 4) / winPitch));
    for (var wi = 0; wi < winN; wi++) {
      var wz = z0 + 2 + (wi + 0.5) * ((len - 4) / winN);
      for (var ws = -1; ws <= 1; ws += 2) {
        winMats.push(this._mkMat4(ws * R * 0.965, 0.10, wz, 0));
      }
    }
    this._inst(winGeo, M.window, winMats);
    /* 舷窗内框 (浅色) */
    var frameGeo = new THREE.BoxGeometry(0.03, 0.36, 0.30);
    var frMats = [];
    for (var fi = 0; fi < winMats.length; fi++) frMats.push(winMats[fi].clone());
    this._inst(frameGeo, M.wall, frMats);

    /* ---- 座椅 (分块布局, InstancedMesh 合批) ---- */
    var blocks = wide ? [2, 4, 2] : [3, 3];
    var sw = 0.46, gap = wide ? 0.50 : 0.52;
    var totalW = 0, bi;
    for (bi = 0; bi < blocks.length; bi++) totalW += blocks[bi] * sw;
    totalW += (blocks.length - 1) * gap;
    var bx = -totalW / 2, blockStart = [];
    for (bi = 0; bi < blocks.length; bi++) { blockStart.push(bx); bx += blocks[bi] * sw + gap; }

    var pitch = wide ? 1.02 : 0.80;
    var nRows = Math.max(2, Math.floor((len - 2.6) / pitch));
    var rowsStart = z0 + 1.3;
    var panGeo = new THREE.BoxGeometry(sw * 0.92, 0.07, 0.44);
    var backGeo = new THREE.BoxGeometry(sw * 0.92, 0.60, 0.09);
    var headGeo = new THREE.BoxGeometry(sw * 0.60, 0.16, 0.09);
    var armGeo = new THREE.BoxGeometry(0.05, 0.05, 0.40);
    var panM = [], backM = [], headM = [], armM = [];
    var fy = this.floorY;
    for (var ri = 0; ri < nRows; ri++) {
      var rz = rowsStart + (ri + 0.5) * pitch;
      for (var bj = 0; bj < blocks.length; bj++) {
        for (var sk = 0; sk < blocks[bj]; sk++) {
          var x = blockStart[bj] + (sk + 0.5) * sw;
          panM.push(this._mkMat4(x, fy + 0.44, rz, 0));
          backM.push(this._mkMat4(x, fy + 0.80, rz + 0.20, -0.10));
          headM.push(this._mkMat4(x, fy + 1.12, rz + 0.19, -0.10));
          // 靠走道一侧扶手 (每个座位靠走道端)
          if ((bj === 0 && sk === blocks[bj] - 1) || (bj === blocks.length - 1 && sk === 0)) {
            var ax = (bj === 0 ? 1 : -1) * sw * 0.46;
            armM.push(this._mkMat4(x + ax, fy + 0.56, rz, 0));
          }
        }
      }
    }
    this._inst(panGeo, M.seat, panM);
    this._inst(backGeo, M.seat, backM);
    this._inst(headGeo, M.seatD, headM);
    if (armM.length) this._inst(armGeo, M.seatD, armM);

    this._bake();
  };

  /* ---- 烘焙朝向明暗到顶点色 (只做一次) ---- */
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
        var s = 0.56 + 0.28 * Math.abs(n.y) + 0.16 * Math.abs(n.z);
        col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = Math.min(1, s);
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    });
  };

  /* ---------------- 激活 / 每帧 ---------------- */
  P.setActive = function (on) {
    on = !!on;
    if (on === this.active) return;
    this.active = on;
    this.group.visible = on;
    this._bright = -1;
  };

  P.update = function (dt, st) {
    if (!this.active) return;
    var sim = this.sim, day = 1;
    if (sim && sim.env && sim.env.getDayFactor) day = sim.env.getDayFactor();
    var b = Math.max(0.20, Math.min(1, 0.20 + 0.80 * (day === day ? day : 1)));
    if (Math.abs(b - this._bright) > 0.01) {
      this._bright = b;
      this._mats.forEach(function (m) {
        if (m.userData.emissive) return;
        m.color.copy(m.userData.base).multiplyScalar(b);
      });
    }
  };

  P.dispose = function () {
    this.group.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
    });
    this._mats.forEach(function (m) { m.dispose(); });
    this._mats = []; this._geoms = [];
  };

  FS.Cabin3D = Cabin3D;
  FS.Log.info('cabin3d.js 已加载 — 三维客舱就绪');

})(typeof window !== 'undefined' ? window : globalThis);