/* ==========================================================================
   天际航线 SkyRoute — 摄像机系统 (camera.js)
     多种视角: 驾驶舱 / 副驾 / 客舱舷窗 / 机翼 / 追踪 / 塔台 / 环绕 /
               飞掠 / 起落架 / 机尾 / 自由飞行
   依赖: three.js (全局 THREE), utils.js
   ========================================================================== */
(function (global) {
  'use strict';

  var FS = global.FS = global.FS || {};
  var U = FS.Utils;
  var C = FS.CONST;
  var D2R = C.DEG, R2D = C.RAD;

  /** 机体系(x前 y右 z下) -> three 机体坐标(x右 y上 z后) */
  function bodyToModel(v) {
    return { x: v.y, y: -v.z, z: -v.x };
  }

  var VIEW_LIST = [
    { id: 'cockpit', name: '驾驶舱 (机长)', nameEn: 'Cockpit L', key: '1' },
    { id: 'cockpitR', name: '驾驶舱 (副驾)', nameEn: 'Cockpit R', key: '1' },
    { id: 'cabin', name: '客舱舷窗', nameEn: 'Cabin', key: '2' },
    { id: 'wing', name: '机翼视角', nameEn: 'Wing', key: '2' },
    { id: 'chase', name: '追踪视角', nameEn: 'Chase', key: '3' },
    { id: 'tower', name: '塔台', nameEn: 'Tower', key: '4' },
    { id: 'orbit', name: '环绕', nameEn: 'Orbit', key: '5' },
    { id: 'free', name: '自由飞行', nameEn: 'Free', key: '6' },
    { id: 'flyby', name: '飞掠', nameEn: 'Fly-by', key: '7' },
    { id: 'gear', name: '起落架', nameEn: 'Gear', key: '7' },
    { id: 'tail', name: '机尾', nameEn: 'Tail', key: '3' },
    { id: 'engine', name: '发动机', nameEn: 'Engine', key: '7' }
  ];

  function CameraRig(camera, opts) {
    this.camera = camera;
    this.opts = opts || {};
    this.THREE = global.THREE;

    this.mode = 'chase';
    this.modeIndex = 4;
    this.model = null;
    this.dims = null;

    /* 平滑状态 */
    this.pos = new this.THREE.Vector3(0, 0, 0);
    this.quat = new this.THREE.Quaternion();
    this.targetPos = new this.THREE.Vector3();
    this.targetQuat = new this.THREE.Quaternion();
    this._initialized = false;

    /* 驾驶舱头部运动 */
    this.headYaw = 0; this.headPitch = 0;
    this.headYawTarget = 0; this.headPitchTarget = 0;
    this.headOffset = new this.THREE.Vector3();

    /* 环绕视角 */
    this.orbit = { theta: 0.6, phi: 0.28, dist: 70 };
    this.freeVel = new this.THREE.Vector3();
    this.freeSpeed = 60;

    /* 飞掠视角 */
    this.flyby = { armed: true, pos: new this.THREE.Vector3(), lastDist: 1e9 };

    /* 抖动 */
    this.shake = new this.THREE.Vector3();
    this.shakeSeed = Math.random() * 1000;

    /* 视野 */
    this.baseFov = 62;
    this.fov = 62;

    this._tmpV = new this.THREE.Vector3();
    this._tmpQ = new this.THREE.Quaternion();
    this._tmpM = new this.THREE.Matrix4();

    this.anchors = {};

    /* beta 0.3.1: 三维驾驶舱 */
    this.cockpit3d = null;      // FS.Cockpit3D 实例 (由 main.js 设置)
    this.use3d = false;         // 本帧是否使用三维驾驶舱视点 (main.js 每帧设置)
    this.panelView = false;     // "看仪表板" 预设 (N 键)
  }

  CameraRig.VIEW_LIST = VIEW_LIST;

  CameraRig.prototype.setCockpit3D = function (c) { this.cockpit3d = c || null; };
  /** 看向仪表板 (低头 + 缩小视场, 保证仪表可读) <-> 恢复向外看 */
  CameraRig.prototype.togglePanelView = function (on) {
    this.panelView = on === undefined ? !this.panelView : !!on;
    this.headYawTarget = this.panelView ? -0.10 : 0;
    this.headPitchTarget = this.panelView ? -0.36 : 0;
    return this.panelView;
  };

  /* ---------------------------------------------------------------------
     绑定飞机模型与锚点
     --------------------------------------------------------------------- */
  CameraRig.prototype.setAircraft = function (model, dims) {
    var THREE = this.THREE;
    this.model = model; this._noseHidden = undefined;
    this.dims = dims || (model && model.dims);
    var d = this.dims;
    if (!model || !d) return;

    // 世界变换节点 (可能是包裹模型的外层 Group)
    this.root = model.root || model.group;

    // 清除旧锚点
    for (var k in this.anchors) {
      if (this.anchors[k].parent) this.anchors[k].parent.remove(this.anchors[k]);
    }
    this.anchors = {};

    var noseZ = -d.length / 2;
    function mkAnchor(name, x, y, z, rotX, rotY) {
      var o = new THREE.Object3D();
      o.position.set(x, y, z);
      if (rotX) o.rotation.x = rotX;
      if (rotY) o.rotation.y = rotY;
      model.group.add(o);
      this_ref.anchors[name] = o;
      return o;
    }
    var this_ref = this;

    // 驾驶舱 (机长/副驾) —— three 模型坐标: -Z 为机头
    var eyeZ = noseZ + (d.noseLength || 8) + 2.4;
    var eyeY = (d.fuselageRadius || 2) * 0.34;
    mkAnchor('cockpitL', -(d.fuselageRadius || 2) * 0.22, eyeY, eyeZ, 0, 0);
    mkAnchor('cockpitR', (d.fuselageRadius || 2) * 0.22, eyeY, eyeZ, 0, 0);
    // 驾驶舱稍微朝下俯视仪表
    this.anchors.cockpitL.rotation.x = -0.06;
    this.anchors.cockpitR.rotation.x = -0.06;

    // 客舱舷窗 (机翼前方几排)
    var cabinZ = noseZ + d.length * 0.42;
    mkAnchor('cabin', -(d.fuselageRadius || 2) * 0.92, eyeY + 0.35, cabinZ, 0, 0);
    mkAnchor('cabinR', (d.fuselageRadius || 2) * 0.92, eyeY + 0.35, cabinZ, 0, 0);

    // 机翼视角 (舷窗向外看机翼)
    mkAnchor('wing', -(d.fuselageRadius || 2) * 0.98, eyeY + 0.1, noseZ + d.length * 0.40, 0, 0.55);

    // 机尾
    mkAnchor('tail', 0, d.finHeight ? d.finHeight * 0.35 : 4, d.length * 0.46, 0, Math.PI);

    // 起落架
    var gm = d.gear && d.gear.main;
    if (gm) {
      mkAnchor('gear', gm.x * 1.8, gm.y - gm.strutLen * 0.4, gm.z, 0, 0);
    } else {
      mkAnchor('gear', 8, -3, 0, 0, 0);
    }

    // 发动机
    if (d.enginePos) {
      mkAnchor('engine', d.enginePos.x * 1.5, d.enginePos.y - 1, d.enginePos.z, 0, 0.3);
    } else {
      mkAnchor('engine', 10, -2, 3, 0, 0.3);
    }
  };

  /* ---------------------------------------------------------------------
     模式切换
     --------------------------------------------------------------------- */
  CameraRig.prototype.setMode = function (mode) {
    var found = -1;
    for (var i = 0; i < VIEW_LIST.length; i++) {
      if (VIEW_LIST[i].id === mode) { found = i; break; }
    }
    if (found < 0) return false;
    this.mode = mode;
    this.modeIndex = found;
    this._initialized = false;
    this.headYaw = this.headYawTarget = 0;
    this.headPitch = this.headPitchTarget = 0;
    this.panelView = false;
    if (mode === 'flyby') this._armFlyby();
    FS.Bus.emit('camera:mode', { mode: mode, name: this.getModeName() });
    return true;
  };

  CameraRig.prototype.cycle = function (dir) {
    dir = dir || 1;
    // 去重: 相同 key 的视角归为一组
    var ids = ['cockpit', 'cockpitR', 'cabin', 'wing', 'chase', 'tower', 'orbit', 'free', 'flyby', 'gear', 'tail', 'engine'];
    var i = ids.indexOf(this.mode);
    if (i < 0) i = 0;
    i = (i + dir + ids.length) % ids.length;
    this.setMode(ids[i]);
    return ids[i];
  };

  CameraRig.prototype.getModeName = function () {
    for (var i = 0; i < VIEW_LIST.length; i++) {
      if (VIEW_LIST[i].id === this.mode) return VIEW_LIST[i].name;
    }
    return this.mode;
  };

  CameraRig.prototype.isCockpit = function () {
    return this.mode === 'cockpit' || this.mode === 'cockpitR';
  };
  CameraRig.prototype.isInterior = function () {
    return this.mode === 'cockpit' || this.mode === 'cockpitR' ||
      this.mode === 'cabin' || this.mode === 'wing';
  };

  /* ---------------------------------------------------------------------
     头部环视 (鼠标/右摇杆)
     --------------------------------------------------------------------- */
  CameraRig.prototype.look = function (dx, dy, dt) {
    this.headYawTarget = U.clamp(this.headYawTarget - dx * 0.0022, -2.5, 2.5);
    this.headPitchTarget = U.clamp(this.headPitchTarget - dy * 0.0022, -0.9, 0.9);
  };
  CameraRig.prototype.centerLook = function () {
    this.headYawTarget = 0;
    this.headPitchTarget = 0;
    this.panelView = false;
  };

  /* ---------------------------------------------------------------------
     每帧更新
     --------------------------------------------------------------------- */
  CameraRig.prototype.update = function (dt, st, input) {
    var THREE = this.THREE;
    var cam = this.camera;

    if (!this.model) return;
    this.model.group.updateMatrixWorld(true);

    /* ---- 头部平滑 ---- */
    this.headYaw = U.damp(this.headYaw, this.headYawTarget, 0.13, dt);
    this.headPitch = U.damp(this.headPitch, this.headPitchTarget, 0.13, dt);

    /* ---- 抖动 ---- */
    var shakeAmp = 0;
    shakeAmp += st.turbulence * 0.35;
    shakeAmp += U.clamp01(Math.abs(st.gLoad - 1) * 0.5) * 0.4;
    var engVib = 0;
    for (var i = 0; i < st.engines.length; i++) {
      engVib = Math.max(engVib, st.engines[i].vibration || 0);
    }
    shakeAmp += engVib * (this.isInterior() ? 1.6 : 0.4);
    if (st.onGround && st.gsKt > 3) shakeAmp += U.clamp(st.gsKt / 160, 0, 1) * 0.35;

    var t = st.time + this.shakeSeed;
    var s = shakeAmp * (this.isInterior() ? 0.010 : 0.035);
    this.shake.set(
      (FS.Noise.value3(t * 11, 0, 0, 1) * 2 - 1) * s,
      (FS.Noise.value3(0, t * 13, 5, 2) * 2 - 1) * s,
      (FS.Noise.value3(3, 7, t * 9, 3) * 2 - 1) * s
    );

    var targetPos = this._tmpV;
    var targetQuat = this._tmpQ;
    var fov = this.baseFov;

    // beta 0.3: 驾驶舱视角隐藏前起落架 (真实模型没有驾驶舱地板, 否则会从风挡下方看到前轮支柱)
    var hideNose = this.isCockpit();
    if (this._noseHidden !== hideNose) {
      var ng = this.model.group.getObjectByName('gearNose'), nd = this.model.group.getObjectByName('gearDoorNose');
      if (ng) ng.visible = !hideNose;
      if (nd) nd.visible = !hideNose;
      this._noseHidden = hideNose;
    }

    switch (this.mode) {
      case 'cockpit':
      case 'cockpitR':
      case 'cabin':
      case 'wing':
      case 'tail':
      case 'gear':
      case 'engine': {
        var anchorName = this.mode;
        if (this.mode === 'cockpit') anchorName = 'cockpitL';
        var anchor = this.anchors[anchorName];
        if (!anchor) anchor = this.anchors.cockpitL;
        var cp3 = this.use3d && this.cockpit3d && this.isCockpit();
        if (cp3) anchor = this.mode === 'cockpitR' ? this.cockpit3d.eyeR : this.cockpit3d.eyeL;
        if (anchor) {
          anchor.getWorldPosition(targetPos);
          anchor.getWorldQuaternion(targetQuat);
          // 头部环视
          if (this.isInterior()) {
            var hq = new THREE.Quaternion().setFromEuler(
              new THREE.Euler(this.headPitch, this.headYaw, 0, 'YXZ'));
            targetQuat.multiply(hq);
          }
        }
        fov = this.mode === 'cockpit' || this.mode === 'cockpitR' ? (cp3 ? (this.panelView ? 46 : 62) : 78) : 70;
        break;
      }

      case 'chase': {
        var pos = this.root.position;
        // root 为飞行动力学机体轴 (x 前, y 右, z 下): 机头 = +x, 机顶 = -z
        var fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(this.root.quaternion);
        var up = new THREE.Vector3(0, 0, -1).applyQuaternion(this.root.quaternion);
        var back = 62, height = 16;
        // 速度越快拉得越远
        var spdFactor = U.clamp(st.gsKt / 400, 0, 1.4);
        back += spdFactor * 34;
        height += spdFactor * 12;
        // 平滑跟随速度方向
        var vel = new THREE.Vector3(st.velWorld.x, st.velWorld.y, st.velWorld.z);
        if (vel.lengthSq() > 25) {
          var velDir = vel.clone().normalize();
          fwd.lerp(velDir, 0.35).normalize();
        }
        targetPos.copy(pos)
          .addScaledVector(fwd, -back)
          .addScaledVector(up, height);
        var lookAt = pos.clone().addScaledVector(fwd, 40);
        this._lookAtQuat(targetPos, lookAt, new THREE.Vector3(0, 1, 0), targetQuat);
        fov = this.baseFov;
        break;
      }

      case 'orbit': {
        if (input && input.mouse) {
          // 拖拽旋转
        }
        var R = 62 + this.orbit.dist;
        var rp = this.root.position;
        var cx = rp.x + Math.cos(this.orbit.theta) * Math.cos(this.orbit.phi) * R;
        var cy = rp.y + Math.sin(this.orbit.phi) * R + 8;
        var cz = rp.z + Math.sin(this.orbit.theta) * Math.cos(this.orbit.phi) * R;
        targetPos.set(cx, cy, cz);
        this._lookAtQuat(targetPos, rp, new THREE.Vector3(0, 1, 0), targetQuat);
        this.orbit.theta += dt * 0.06;
        fov = this.baseFov;
        break;
      }

      case 'tower': {
        var ap = st.airportIcao ? FS.Airports.byIcao(st.airportIcao) : null;
        if (!ap) {
          // 找最近的机场
          var near = FS.Airports.nearest(st.lat, st.lon, 200);
          ap = near && near.airport;
        }
        var tx, ty, tz;
        if (ap) {
          var w = FS.Geo.toWorld(ap.lat, ap.lon);
          tx = w.x; tz = w.z; ty = ap.elevFt * C.FT + 45;
        } else {
          tx = st.pos.x - 1500; ty = st.pos.y + 60; tz = st.pos.z - 1500;
        }
        targetPos.set(tx, ty, tz);
        this._lookAtQuat(targetPos, this.root.position, new THREE.Vector3(0, 1, 0), targetQuat);
        fov = 26;
        break;
      }

      case 'flyby': {
        this._updateFlyby(dt, st);
        targetPos.copy(this.flyby.pos);
        this._lookAtQuat(targetPos, this.root.position, new THREE.Vector3(0, 1, 0), targetQuat);
        fov = 34;
        break;
      }

      case 'free': {
        this._updateFree(dt, input, targetQuat);
        targetPos.copy(this.freePos);
        fov = this.baseFov;
        break;
      }

      default: {
        targetPos.set(0, st.altM + 40, st.pos.z + 80);
        targetQuat.identity();
      }
    }

    /* ---- 初始化 / 平滑 ---- */
    if (!this._initialized) {
      this.pos.copy(targetPos);
      this.quat.copy(targetQuat);
      this._initialized = true;
    } else {
      var followed = ['cockpit', 'cockpitR', 'cabin', 'wing', 'tail', 'gear', 'engine', 'chase', 'free'];
      var smooth = followed.indexOf(this.mode) >= 0;
      if (this.mode === 'chase') {
        this.pos.lerp(targetPos, 1 - Math.exp(-dt / 0.16));
        this.quat.slerp(targetQuat, 1 - Math.exp(-dt / 0.13));
      } else if (this.mode === 'free') {
        this.pos.copy(targetPos);
        this.quat.copy(targetQuat);
      } else if (smooth) {
        this.pos.copy(targetPos);
        this.quat.slerp(targetQuat, 1 - Math.exp(-dt / 0.06));
      } else {
        this.pos.lerp(targetPos, 1 - Math.exp(-dt / 0.25));
        this.quat.slerp(targetQuat, 1 - Math.exp(-dt / 0.25));
      }
    }

    /* 抖动叠加 */
    if (shakeAmp > 0.001) {
      this.pos.x += this.shake.x * (this.isInterior() ? 1 : 24);
      this.pos.y += this.shake.y * (this.isInterior() ? 1 : 24);
      this.pos.z += this.shake.z * (this.isInterior() ? 1 : 24);

      var sq = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(this.shake.y * 0.9, this.shake.x * 0.9, this.shake.z * 0.9, 'YXZ'));
      this.quat.multiply(sq);
    }

    cam.position.copy(this.pos);
    cam.quaternion.copy(this.quat);

    /* ---- 视野 (跟随速度/过载) ---- */
    var targetFov = fov;
    if (this.mode !== 'tower' && this.mode !== 'flyby') {
      targetFov = this.panelView && this.use3d ? fov : fov + U.clamp(st.mach * 6, 0, 6) + U.clamp(Math.abs(st.gLoad - 1) * 3, 0, 5);
      if (!this.isInterior()) targetFov += U.clamp(st.gsKt / 40, 0, 12);
    }
    this.fov = U.damp(this.fov, targetFov, this.use3d && this.isCockpit() ? 0.18 : 0.35, dt);
    // 三维驾驶舱: 近裁剪面缩到 5 cm (对数深度缓冲, 不影响远处精度), 否则侧杆 / 遮光板会被裁掉
    var wantNear = (this.use3d && this.isCockpit()) ? 0.05 : 0.4;
    if (Math.abs(cam.fov - this.fov) > 0.01 || cam.near !== wantNear) {
      cam.fov = this.fov;
      cam.near = wantNear;
      cam.updateProjectionMatrix();
    }

    /* ---- 自由视角交互 ---- */
    if (this.mode === 'orbit' || this.mode === 'free') {
      if (input && input.mouse && input.mouse.down) {
        this.orbit.theta -= input.mouse.dx * 0.005;
        this.orbit.phi = U.clamp(this.orbit.phi + input.mouse.dy * 0.004, -0.4, 1.2);
      }
      if (input && input.mouse) {
        this.orbit.dist = U.clamp(this.orbit.dist + input.mouse.wheel * 0.08, -50, 700);
      }
    }
  };

  CameraRig.prototype._lookAtQuat = function (from, to, up, out) {
    var m = this._tmpM;
    m.lookAt(from, to, up);
    out.setFromRotationMatrix(m);
    return out;
  };

  /* ---------------- 飞掠 ---------------- */
  CameraRig.prototype._armFlyby = function () {
    this.flyby.armed = true;
    this.flyby.lastDist = 1e9;
    var st = this._lastState;
    if (!st) return;
    this._placeFlyby(st);
  };

  CameraRig.prototype._placeFlyby = function (st) {
    var THREE = this.THREE;
    var hdg = st.heading * D2R;
    // 放在飞机前方约 1200 m 偏侧处
    var side = (Math.random() < 0.5 ? -1 : 1) * U.range(60, 220);
    var ahead = U.range(900, 1600);
    var fx = Math.sin(hdg), fz = -Math.cos(hdg);
    var rx = Math.cos(hdg), rz = Math.sin(hdg);
    var rp = this.root.position;
    this.flyby.pos.set(
      rp.x + fx * ahead + rx * side,
      Math.max(rp.y + 8, rp.y - U.range(0, 60)),
      rp.z + fz * ahead + rz * side
    );
    this.flyby.armed = false;
    this.flyby.lastDist = 1e9;
  };

  CameraRig.prototype._updateFlyby = function (dt, st) {
    var pos = this.root.position;
    var d = pos.distanceTo(this.flyby.pos);
    if (d > 3500 || (d - this.flyby.lastDist > 50 && this.flyby.lastDist < 300)) {
      this._placeFlyby(st);
    }
    this.flyby.lastDist = d;
  };

  /* ---------------- 自由飞行 ---------------- */
  CameraRig.prototype._updateFree = function (dt, input, outQuat) {
    var THREE = this.THREE;
    if (!this.freePos) {
      this.freePos = new THREE.Vector3();
      this.freePos.copy(this.camera.position);
      this.freeEuler = { yaw: 0, pitch: 0 };
      this.freeQuat = new THREE.Quaternion();
    }
    var speed = this.freeSpeed;
    if (input) {
      if (input.isDown('throttleUp')) speed *= 8;
      if (input.mouse && input.mouse.down) {
        this.freeEuler.yaw -= input.mouse.dx * 0.0032;
        this.freeEuler.pitch = U.clamp(this.freeEuler.pitch - input.mouse.dy * 0.0032, -1.4, 1.4);
      }
      var dir = new THREE.Vector3(0, 0, -1).applyEuler(
        new THREE.Euler(this.freeEuler.pitch, this.freeEuler.yaw, 0, 'YXZ'));
      var right = new THREE.Vector3(1, 0, 0).applyEuler(
        new THREE.Euler(0, this.freeEuler.yaw, 0, 'YXZ'));
      var move = new THREE.Vector3();
      if (input.isDown('pitchDown')) move.add(dir);
      if (input.isDown('pitchUp')) move.sub(dir);
      if (input.isDown('rollRight')) move.add(right);
      if (input.isDown('rollLeft')) move.sub(right);
      if (input.isDown('rudderRight')) move.y += 1;
      if (input.isDown('rudderLeft')) move.y -= 1;
      if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * dt);
      this.freePos.add(move);
    }
    var q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.freeEuler.pitch, this.freeEuler.yaw, 0, 'YXZ'));
    outQuat.copy(q);
  };

  /* ---------------- 辅助: 设置环境相关 ---- */
  CameraRig.prototype.setBaseFov = function (f) {
    this.baseFov = U.clamp(f, 30, 110);
  };

  /* ---------------- 接近真实驾驶舱的默认姿态 ---- */
  CameraRig.prototype.resetToDefault = function (mode) {
    this.setMode(mode || 'chase');
  };

  FS.CameraRig = CameraRig;
  FS.CameraRig.VIEW_LIST = VIEW_LIST;
  FS.CameraRig.bodyToModel = bodyToModel;

  FS.Log.info('camera.js 已加载 — 摄像机系统就绪 (' + VIEW_LIST.length + ' 种视角)');

})(typeof window !== 'undefined' ? window : globalThis);
