/* ==========================================================================
   飞行模拟器 — 飞行动力学模型 (flightmodel.js)
   六自由度刚体 + 气动导数 + 涡扇发动机 + 起落架/地面 + 燃油
   坐标系:
     机体轴  x = 机头前  y = 右翼  z = 机腹向下   (标准航空机体轴)
     世界轴  X = 东  Y = 上  Z = 南   (单位: 米)
   姿态用四元数维护 (机体 -> 世界), 航向 0 = 正北
   依赖: utils.js / config.js (不依赖 THREE)
   ========================================================================== */
(function (global) {
  'use strict';

  var FS = global.FS = global.FS || {};
  var U = FS.Utils;
  var C = FS.CONST;

  /* =====================================================================
     一、轻量四元数 (w,x,y,z) —— 避免对 THREE 的依赖
     ===================================================================== */
  var Q = {
    identity: function () { return { w: 1, x: 0, y: 0, z: 0 }; },

    mul: function (a, b) {
      return {
        w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
        x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
        y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
        z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
      };
    },

    fromAxisAngle: function (ax, ay, az, ang) {
      var h = ang * 0.5, s = Math.sin(h);
      var n = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
      return { w: Math.cos(h), x: ax / n * s, y: ay / n * s, z: az / n * s };
    },

    normalize: function (q) {
      var n = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
      if (n < 1e-9) { q.w = 1; q.x = q.y = q.z = 0; return q; }
      var i = 1 / n;
      q.w *= i; q.x *= i; q.y *= i; q.z *= i;
      return q;
    },

    /** 用四元数旋转向量 (机体 -> 世界) */
    rotate: function (q, v) {
      var tx = 2 * (q.y * v.z - q.z * v.y);
      var ty = 2 * (q.z * v.x - q.x * v.z);
      var tz = 2 * (q.x * v.y - q.y * v.x);
      return {
        x: v.x + q.w * tx + (q.y * tz - q.z * ty),
        y: v.y + q.w * ty + (q.z * tx - q.x * tz),
        z: v.z + q.w * tz + (q.x * ty - q.y * tx)
      };
    },

    /** 逆旋转 (世界 -> 机体) */
    invRotate: function (q, v) {
      var tx = 2 * (-q.y * v.z + q.z * v.y);
      var ty = 2 * (-q.z * v.x + q.x * v.z);
      var tz = 2 * (-q.x * v.y + q.y * v.x);
      return {
        x: v.x + q.w * tx + (-q.y * tz + q.z * ty),
        y: v.y + q.w * ty + (-q.z * tx + q.x * tz),
        z: v.z + q.w * tz + (-q.x * ty + q.y * tx)
      };
    },

    /** 单位阵转四元数用不到的 —— 由四元数生成 3x3 旋转矩阵 (行主序, 返回长度 9 数组) */
    toMatrix: function (q) {
      var w = q.w, x = q.x, y = q.y, z = q.z;
      var xx = x * x, yy = y * y, zz = z * z;
      var xy = x * y, xz = x * z, yz = y * z;
      var wx = w * x, wy = w * y, wz = w * z;
      return [
        1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy),
        2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx),
        2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy)
      ];
    },

    /** 由机体轴姿态角构造 (复合顺序: 世界偏航 * 基准 * 机体俯仰 * 机体滚转) */
    fromEuler: function (pitchRad, rollRad, hdgRad) {
      // 基准四元数: 把 "机头指北、右翼指东、机腹向下" 与机体轴对齐
      var q0 = { w: 0.5, x: 0.5, y: 0.5, z: -0.5 };
      var qRoll = Q.fromAxisAngle(1, 0, 0, rollRad);
      var qPitch = Q.fromAxisAngle(0, 1, 0, pitchRad);
      var qYaw = Q.fromAxisAngle(0, 1, 0, -hdgRad);       // 世界 Y 轴
      var q = Q.mul(qPitch, qRoll);
      q = Q.mul(q0, q);
      q = Q.mul(qYaw, q);
      return Q.normalize(q);
    },

    /** 从四元数解算姿态角 */
    toEuler: function (q) {
      var m = Q.toMatrix(q);
      // 机体 x 轴在世界中的指向 (矩阵第一列)
      var fx = m[0], fy = m[3], fz = m[6];
      var hdg = U.wrap360(Math.atan2(fx, -fz) * C.RAD);
      var pitch = Math.asin(U.clamp(fy, -1, 1));
      // 机体 y 轴 (右翼)
      var rx = m[1], ry = m[4], rz = m[7];
      // 水平参考右向量
      var upx = 0, upy = 1, upz = 0;
      var crx = fy * upz - fz * upy, cry = fz * upx - fx * upz, crz = fx * upy - fy * upx;
      var cn = Math.sqrt(crx * crx + cry * cry + crz * crz);
      var roll;
      if (cn < 1e-6) {
        roll = 0;
      } else {
        crx /= cn; cry /= cn; crz /= cn;
        var dot = crx * rx + cry * ry + crz * rz;
        var cx = cry * rz - crz * ry, cy = crz * rx - crx * rz, cz = crx * ry - cry * rx;
        var sinPhi = cx * fx + cy * fy + cz * fz;
        roll = Math.atan2(sinPhi, dot);
      }
      return { pitch: pitch, roll: roll, heading: hdg };
    }
  };
  FS.Quat = Q;

  /* =====================================================================
     二、升力曲线 (含失速与过失速)
     ===================================================================== */
  function clAt(alphaRad, aStallRad, CL0, CLa) {
    var KNEE = 0.76;
    var POST = 0.21;            // 过失速衰减区宽度 (rad, 约 12°)
    var POST_LOSS = 0.42;       // 失速后升力损失比例
    var aPos = aStallRad, aNeg = -0.82 * aStallRad;
    var CLpos = CL0 + CLa * aPos;
    var CLneg = CL0 + CLa * aNeg;
    var a = alphaRad, t, s, clk;

    if (a >= 0) {
      if (a <= aPos * KNEE) return CL0 + CLa * a;
      if (a <= aPos) {
        clk = CL0 + CLa * aPos * KNEE;
        t = (a - aPos * KNEE) / (aPos * (1 - KNEE));
        s = t * t * (3 - 2 * t);
        return clk + (CLpos - clk) * s;
      }
      t = Math.min(1, (a - aPos) / POST);
      s = t * t * (3 - 2 * t);
      return CLpos * (1 - POST_LOSS * s);
    } else {
      if (a >= aNeg * KNEE) return CL0 + CLa * a;
      if (a >= aNeg) {
        clk = CL0 + CLa * aNeg * KNEE;
        t = (aNeg * KNEE - a) / (aNeg * KNEE - aNeg);
        s = t * t * (3 - 2 * t);
        return clk + (CLneg - clk) * s;
      }
      t = Math.min(1, (aNeg - a) / POST);
      s = t * t * (3 - 2 * t);
      return CLneg * (1 - POST_LOSS * s);
    }
  }

  /* =====================================================================
     三、发动机模型
     ===================================================================== */
  function Engine(cfg, index, side) {
    this.cfg = cfg;
    this.index = index;
    this.side = side;                 // -1 左 / +1 右
    this.n1 = 0;                      // %
    this.n2 = 0;
    this.egt = 15;                    // 摄氏度 (停机时为外界温度)
    this.thrust = 0;                  // N
    this.fuelFlow = 0;                // kg/h
    this.state = 'off';               // off | starting | idle | running | shutting
    this.startTimer = 0;
    this.n1Command = 0;
    this.fuelOn = false;
    this.starterOn = false;
    this.fireWarning = false;
    this.vibration = 0;
    this.oilTemp = 15;
    this.oilPressure = 0;
    this.reverserPos = 0;
    this.reverserArmed = false;
    this.bleed = true;
  }

  Engine.prototype.commandStart = function (auto) {
    if (this.state === 'off') {
      this.state = 'starting';
      this.startTimer = 0;
      this.starterOn = true;
      this.fuelOn = false;
      if (auto) this._auto = true;
    }
  };
  Engine.prototype.commandShutdown = function () {
    if (this.state === 'running' || this.state === 'idle') {
      this.state = 'shutting';
      this.fuelOn = false;
    }
  };

  Engine.prototype.update = function (dt, throttleLever, ambientT, mach, sigma, tas) {
    var e = this.cfg;
    var target = 0;

    switch (this.state) {
      case 'off':
        this.starterOn = false;
        target = 0;
        break;

      case 'starting':
        this.startTimer += dt;
        var p = this.startTimer / e.startTime;            // 0..1
        if (p > 0.16 && !this.fuelOn) this.fuelOn = true; // 供油
        if (p >= 1) {
          this.state = 'running';
          this.starterOn = false;
          this.fuelOn = true;
        }
        // 起动机带动 N2, 点火后 N1 上升
        this.n2 = Math.min(100, 62 * U.smoothstep(p / 0.85));
        var spool = U.smoothstep(U.clamp01((p - 0.14) / 0.86));
        target = e.n1Idle * spool;
        // 起动 EGT 峰值
        var pk = Math.exp(-Math.pow((p - 0.52) / 0.16, 2));
        this.egt = ambientT + (target / e.n1Idle) * (e.egtIdle - ambientT) + 260 * pk;
        break;

      case 'shutting':
        target = 0;
        this.fuelOn = false;
        this.n2 = Math.max(0, this.n2 - dt * 8);
        if (this.n1 <= 0.35 && this.n2 <= 0.5) {
          this.state = 'off';
          this.n1 = 0; this.n2 = 0;
        }
        break;

      case 'idle':
      case 'running':
        target = e.n1Idle + throttleLever * (e.n1Max - e.n1Idle);
        // 高空加速性变差
        target *= (1 - 0.06 * (1 - U.clamp01(sigma)));
        break;
    }

    this.n1Command = target;

    // N1 转子滞后 (加速/减速时间常数不同, 高 N1 时加速更慢)
    var tauUp = e.spoolUp * U.lerp(0.75, 1.45, U.clamp01((this.n1 - e.n1Idle) / (100 - e.n1Idle)));
    var tauDn = e.spoolDown * U.lerp(1.0, 1.25, U.clamp01(this.n1 / 100));
    // 高空空气稀薄 -> 转子惯性相对更大
    tauUp *= U.lerp(1.0, 1.6, 1 - U.clamp01(sigma));
    tauDn *= U.lerp(1.0, 1.4, 1 - U.clamp01(sigma));
    this.n1 = U.lag(this.n1, target, tauUp, tauDn, dt);

    // N2 跟随 N1
    this.n2 = U.damp(this.n2, this.state === 'off' ? 0 : (52 + this.n1 * 0.48), 1.6, dt);

    /* ---- 推力 ----
       海平面静止额定推力经密度比与马赫数冲压修正 */
    var n1n = U.clamp01((this.n1 - e.n1Idle) / (e.n1Max - e.n1Idle));
    var n1Factor = 0.030 + 0.970 * Math.pow(n1n, 1.45);
    var machFactor = Math.max(0.22, 1 - 0.40 * Math.sqrt(Math.max(0, mach)));
    var densityFactor = Math.pow(Math.max(0.02, sigma), 0.95);
    this.thrust = e.maxThrust * n1Factor * densityFactor * machFactor;

    // 反推: 反推打开时正推力转为反向 (约 -45%)
    if (this.reverserPos > 0.02) {
      this.thrust *= (1 - 1.45 * this.reverserPos);
    }
    if (this.state === 'off' || this.state === 'starting') this.thrust = Math.max(0, this.thrust);

    /* ---- 燃油流量 ---- */
    var tsfc = U.lerp(e.tsfcSL, e.tsfcCruise, U.clamp01(mach / 0.85));
    if (this.thrust > 0) {
      this.fuelFlow = this.thrust * tsfc;                 // kg/h
    } else {
      this.fuelFlow = 0;
    }
    if (this.state === 'starting' || this.state === 'running' || this.state === 'idle') {
      this.fuelFlow += e.maxThrust * 0.004 * 0;           // 慢车耗油已包含在推力项
    }
    if (!this.fuelOn) this.fuelFlow = 0;

    /* ---- EGT ---- */
    var egtTarget;
    if (this.state === 'off') egtTarget = ambientT;
    else {
      egtTarget = ambientT + (e.egtIdle - ambientT) * 0.5 +
        (e.egtMax - ambientT) * Math.pow(n1n, 1.9) * 0.86;
      // 反推与高功率时的额外温升
      egtTarget += 45 * this.reverserPos * n1n;
    }
    this.egt = U.damp(this.egt, egtTarget, this.state === 'starting' ? 1.2 : 2.6, dt);

    /* ---- 滑油 ---- */
    this.oilTemp = U.damp(this.oilTemp, ambientT + 60 * U.clamp01(this.n1 / 100) + 25, 30, dt);
    this.oilPressure = this.state === 'off' ? 0 :
      U.damp(this.oilPressure, 30 + 55 * U.clamp01(this.n1 / 100), 2.0, dt);

    /* ---- 振动 (N1 高时更大, 用于驾驶舱抖动) ---- */
    this.vibration = this.state === 'off' ? 0 : U.clamp01(Math.pow(n1n, 1.6) * 0.12 + (this.n1 > 95 ? 0.05 : 0));
  };

  Engine.prototype.getThrustN = function () { return this.thrust; };

  /* =====================================================================
     四、飞行模型主体
     ===================================================================== */
  /**
   * @param {string} typeKey 机型键, 如 'A350-900'
   * @param {object} [opts]  { fuelKg, payloadKg, groundHeightFn(x,z)->m, seed }
   */
  function FlightModel(typeKey, opts) {
    opts = opts || {};
    this.typeKey = typeKey;
    this.ac = FS.AIRCRAFT_DB[typeKey];
    if (!this.ac) throw new Error('未知机型: ' + typeKey);
    this.aero = FS.Aero.get(typeKey);
    this.opts = opts;
    this.seed = opts.seed || 20260101;

    /** 地面高度查询函数 (由 environment 注入) */
    this.groundHeightFn = opts.groundHeightFn || function () { return 0; };

    /* ---- 质量与燃油 ---- */
    var m = this.ac.mass;
    this.payloadKg = opts.payloadKg !== undefined ? opts.payloadKg : Math.round(m.maxPayload * 0.72);
    this.fuelKg = opts.fuelKg !== undefined ? opts.fuelKg : Math.round(m.maxFuel * 0.45);
    this.fuelCapacity = m.maxFuel;

    /* ---- 位置与姿态 ---- */
    this.pos = { x: 0, y: 0, z: 0 };            // 世界坐标, y = 海拔 (m)
    this.lat = 0; this.lon = 0;
    this.q = Q.identity();
    this.pitch = 0; this.roll = 0; this.heading = 0;

    /* ---- 速度 ---- */
    this.velBody = { x: 0, y: 0, z: 0 };        // 机体轴速度 (m/s)
    this.velWorld = { x: 0, y: 0, z: 0 };
    this.rates = { p: 0, q: 0, r: 0 };          // 机体角速度 rad/s

    /* ---- 环境 ---- */
    this.windDir = 0; this.windSpeed = 0; this.gust = 0;
    this.turbulence = 0;
    this.isaDev = 0;
    this.qnh = 1013.25;
    this.ambientT = 15;
    this.windVec = { x: 0, y: 0, z: 0 };

    /* ---- 气动中间量 ---- */
    this.alpha = 0; this.beta = 0; this.mach = 0; this.qbar = 0;
    this.ias = 0; this.tas = 0; this.gs = 0;
    this.CL = 0; this.CD = 0;
    this.gLoad = 1;
    this.alphaDot = 0;
    this._prevAlpha = 0;

    /* ---- 操纵面 ---- */
    this.surfaces = { elevator: 0, aileron: 0, rudder: 0, elevatorTrim: 0, spoiler: 0 };
    this.pilot = { pitch: 0, roll: 0, yaw: 0, brakeL: 0, brakeR: 0 };
    this.apCmd = { active: false, elevator: 0, aileron: 0, rudder: 0, throttle: 0 };
    this.controlLaw = 'normal';

    /* ---- 构型 ---- */
    this.gearCmd = 1;                            // 1 = 放下
    this.gearPos = 1;
    this.flapCmd = 0;                            // 目标襟翼位置 0..1
    this.flapPos = 0;
    this.slatPos = 0;
    this.spoilerCmd = 0;                         // 空中减速板 0..1
    this.spoilerPos = 0;
    this.speedbrakeArmed = false;
    this.groundSpoilers = false;

    /* ---- 刹车 ---- */
    this.autoBrake = 'OFF';
    this.brakeCmd = 0;
    this.parkingBrake = true;
    this.brakeTemp = [20, 20, 20, 20];
    this.antiSkidActive = false;

    /* ---- 起落架接触 ---- */
    this.onGround = false;
    this.wow = false;                            // weight-on-wheels
    this.gearCompression = 0;
    this.wheelSpin = 0;
    this.contactForce = 0;
    this.touchdownVS = 0;
    this.lastTouchdownTime = -999;

    /* ---- 发动机 ---- */
    var ecount = this.ac.engines.count;
    this.engines = [];
    for (var i = 0; i < ecount; i++) {
      this.engines.push(new Engine(this.ac.engines, i, i === 0 ? -1 : 1));
    }
    this.throttle = new Array(ecount);
    for (var t = 0; t < ecount; t++) this.throttle[t] = 0;
    this.throttleRate = 0.42;                    // 每秒油门杆行程

    /* ---- 系统 ---- */
    this.apuRunning = false;
    this.apuTimer = 0;
    this.batteryOn = true;
    this.hydraulics = [true, true, true];
    this.electrical = [true, true, true, true];
    this.fuelPumps = [true, true, true, true, true];
    this.packOn = true;
    this.wingAntiIce = false;
    this.engineAntiIce = [false, false];

    /* ---- 告警 ---- */
    this.warnings = {
      stall: false, overspeed: false, machOverspeed: false,
      gpws: null, pullUp: false, sinkRate: false, glideslope: false,
      configWarning: false, lowFuel: false, windshear: false,
      masterWarning: false, masterCaution: false
    };

    /* ---- 自动驾驶 ---- */
    this.ap = {
      engaged: false, ap1: false, ap2: false, fd1: true, fd2: false,
      athr: false, athrArmed: false, mode: 'OFF',
      pitchMode: null, rollMode: null, thrustMode: null,
      targetAltFt: null, targetVsFpm: 0, targetHdg: null, targetIas: null,
      targetMach: null, locArmed: false, gsArmed: false, apprArmed: false,
      navArmed: false, altHold: false, flch: false, exped: false,
      yawDamper: true, autoLand: false
    };

    /* ---- 统计数据 ---- */
    this.time = 0;
    this.flightTime = 0;
    this.distanceNm = 0;
    this.fuelUsed = 0;
    this._lastPos = { x: 0, z: 0 };

    /* ---- 惯性矩 (随质量变化) ---- */
    this.inertia = { Ixx: 1, Iyy: 1, Izz: 1 };
    this._updateMassProps();

    /* ---- 单位转换的缓存 ---- */
    this.iasKt = 0; this.tasKt = 0; this.gsKt = 0;
    this.altFt = 0; this.aglFt = 0; this.vsFpm = 0;
    this.aero.alphaStallDeg = 0;

    this.log = [];
    this._log = function (msg) {
      this.log.push({ t: this.time, msg: msg });
      if (this.log.length > 200) this.log.shift();
      FS.Bus.emit('fm:event', { time: this.time, message: msg });
    };
  }

  /* ---------------------------------------------------------------------
     质量特性
     --------------------------------------------------------------------- */
  FlightModel.prototype._updateMassProps = function () {
    var m = this.ac.mass;
    this.gw = m.oew + this.payloadKg + this.fuelKg;
    var b = this.ac.dims.wingspan, L = this.ac.dims.length;
    // 由重量比推惯性矩 (基准为 OEW 状态的经验系数)
    var w = this.gw;
    this.inertia.Ixx = 0.0180 * w * b * b;
    this.inertia.Iyy = 0.0235 * w * L * L * (1.0 - 0.06 * this.fuelKg / m.maxFuel);
    this.inertia.Izz = 0.0480 * w * b * b;
    // 重心估算 (向后燃油/载荷移动)
    var fuelFrac = this.fuelKg / m.maxFuel;
    var payFrac = this.payloadKg / m.maxPayload;
    this.cgPercent = 22 + 6 * fuelFrac + 7 * payFrac;      // %MAC (参考值)
    this.zfw = m.oew + this.payloadKg;
  };

  FlightModel.prototype.setFuel = function (kg) {
    this.fuelKg = U.clamp(kg, 0, this.fuelCapacity);
    this._updateMassProps();
  };
  FlightModel.prototype.setPayload = function (kg) {
    this.payloadKg = U.clamp(kg, 0, this.ac.mass.maxPayload);
    this._updateMassProps();
  };

  /* ---------------------------------------------------------------------
     初始化 / 摆位
     --------------------------------------------------------------------- */
  /**
   * 直接设定状态
   * @param {object} s { lat, lon, altFt, headingDeg, iasKt, pitchDeg, rollDeg, onGround, gearDown, flapPos }
   */
  FlightModel.prototype.setState = function (s) {
    s = s || {};
    if (s.lat !== undefined && s.lon !== undefined) {
      this.lat = s.lat; this.lon = s.lon;
      var w = FS.Geo.toWorld(s.lat, s.lon);
      this.pos.x = w.x; this.pos.z = w.z;
    }
    var altM = (s.altFt !== undefined ? s.altFt * C.FT : 0);
    if (!isFinite(altM)) {
      FS.Log.warn('setState 收到无效高度 (' + s.altFt + '), 已按 0 处理');
      altM = 0;
    }
    this.pos.y = altM;
    // 若指定"在地面上", 则把高度设为机轮刚好接地
    if (s.onGround) {
      var gh0 = this.groundHeightAt(this.pos.x, this.pos.z);
      this.pos.y = gh0 + this.getReferenceHeight();
    }
    this.heading = s.headingDeg !== undefined ? U.wrap360(s.headingDeg) : 0;
    this.pitch = (s.pitchDeg || 0) * C.DEG;
    this.roll = (s.rollDeg || 0) * C.DEG;
    this.q = Q.fromEuler(this.pitch, this.roll, this.heading * C.DEG);
    this.pitchDeg = this.pitch * C.RAD;
    this.rollDeg = this.roll * C.RAD;

    // 仅在显式给出时才改动襟翼 (否则会破坏 setupForApproach 等先设好的构型,
    // 导致配平迎角按光洁构型求解, 上机即失速)
    if (s.flapPos !== undefined) {
      this.flapPos = s.flapPos;
      this.flapCmd = this.flapPos;
    } else if (this.flapCmd === undefined) {
      this.flapPos = 0; this.flapCmd = 0;
    }
    this.flapData = FS.Aero.flapAt(this.ac, this.flapPos);
    this.gearPos = s.gearDown === false ? 0 : (s.onGround === false && s.gearDown === undefined ? 0 : 1);
    this.gearCmd = this.gearPos;

    var iasMs = (s.iasKt || 0) * C.KT;          // 输入的指示空速
    this.velBody = { x: iasMs, y: 0, z: 0 };
    this.rates = { p: 0, q: 0, r: 0 };

    // 初始配平: 设定一个近似迎角
    var atm = FS.Atmo.isa(altM);
    this.updateAtmosphere(atm, altM);
    if (iasMs > 1) {
      // 动压必须用真空速计算 (高空 CAS 与 TAS 相差极大)
      var v = FS.Atmo.tasFromCas(iasMs, atm.p, atm.rho);
      var qb = 0.5 * atm.rho * v * v;
      var fp = FS.Aero.flapAt(this.ac, this.flapPos);
      var CLneed = (this.gw * C.G0 * Math.cos(this.pitch)) / Math.max(1, qb * this.ac.dims.wingArea);
      var aStallRad = (fp.alphaStall) * C.DEG;
      var ac_ = Q.invRotate(this.q, { x: 0, y: -C.G0, z: 0 });
      // 用升力曲线反解迎角 (二分)
      var lo = -0.2, hi = aStallRad;
      for (var i = 0; i < 40; i++) {
        var mid = (lo + hi) / 2;
        if (clAt(mid, aStallRad, this.aero.CL0, this.aero.CLalpha) + fp.cl < CLneed) lo = mid; else hi = mid;
      }
      var alpha = (lo + hi) / 2;
      // 把速度矢量按迎角装入机体轴
      this.velBody = { x: v * Math.cos(alpha), y: 0, z: v * Math.sin(alpha) };
      this.alpha = alpha;
      this.alphaDeg = alpha * C.RAD;
      this._prevAlpha = alpha;
      this.surfaces.elevator = 0;
      this.trimForLevel(altM);
    }
    this._lastPos = { x: this.pos.x, z: this.pos.z };
    this.time = 0;
    return this;
  };

  /** 放在跑道入口 (由 airports.js 提供几何) */
  FlightModel.prototype.placeOnRunway = function (icao, rwyIdent, opts) {
    opts = opts || {};
    var g = FS.Airports.runwayWorldGeometry(icao, rwyIdent);
    if (!g) throw new Error('找不到跑道 ' + icao + '/' + rwyIdent);
    var startFrac = opts.startFrac !== undefined ? opts.startFrac : 0.03;   // 从入口稍前方开始
    var along = g.lengthM * startFrac;
    var bp = g.hdgTrue * C.DEG;
    this.pos.x = g.threshold.x + Math.sin(bp) * along;
    this.pos.z = g.threshold.z - Math.cos(bp) * along;
    // 参考点高度 = 实际地面高度 + (机轮最低点距离 - 静态压缩量)
    // 使用注入的地形函数而非跑道标高, 保证与物理地面完全一致
    var groundM = this.groundHeightAt(this.pos.x, this.pos.z);
    if (!isFinite(groundM) || Math.abs(groundM - g.elevM) > 80) groundM = g.elevM;
    this.pos.y = groundM + this.getReferenceHeight();
    var ll = FS.Geo.toLatLon(this.pos.x, this.pos.z);
    this.lat = ll.lat; this.lon = ll.lon;

    this.heading = g.hdgTrue;
    this.pitch = 0; this.roll = 0;
    this.pitchDeg = 0; this.rollDeg = 0;
    this.alpha = 0; this.alphaDeg = 0; this.beta = 0; this.betaDeg = 0;
    this.q = Q.fromEuler(0, 0, this.heading * C.DEG);
    this.velBody = { x: 0, y: 0, z: 0 };
    this.rates = { p: 0, q: 0, r: 0 };
    this.gearPos = 1; this.gearCmd = 1;
    this.flapPos = opts.flapPos || 0; this.flapCmd = this.flapPos;
    this.parkingBrake = opts.parkingBrake !== false;
    this.onGround = true; this.wow = true;
    this.airportIcao = icao;
    this.runwayIdent = rwyIdent;
    this.runway = g;
    this._lastPos = { x: this.pos.x, z: this.pos.z };
    this.time = 0;
    return this;
  };

  /** 在空中根据当前位置摆放 */
  FlightModel.prototype.placeInAir = function (lat, lon, altFt, hdgDeg, iasKt, opts) {
    opts = opts || {};
    return this.setState({
      lat: lat, lon: lon, altFt: altFt, headingDeg: hdgDeg, iasKt: iasKt,
      gearDown: false, flapPos: opts.flapPos || 0
    });
  };

  /** 让升降舵配平到当前状态 (近似) */
  FlightModel.prototype.trimForLevel = function (altM) {
    var a = this.alpha;
    var CmNeed = -(this.aero.Cm0 + this.aero.CmAlpha * a +
      this.aero.CmFlap * this.flapPos + this.aero.CmGear * this.gearPos);
    var de = CmNeed / this.aero.CmElevator;
    this.surfaces.elevatorTrim = U.clamp(de, -0.55, 0.55);
  };

  /* ---------------------------------------------------------------------
     大气 / 环境
     --------------------------------------------------------------------- */
  FlightModel.prototype.updateAtmosphere = function (atm, altM) {
    this.rho = atm.rho;
    this.pressure = atm.p;
    this.soundSpeed = atm.a;
    this.ambientT = atm.T - 273.15 + this.isaDev;
    this.altM = altM;
    this.altFt = altM / C.FT;
    this.sigma = atm.rho / C.RHO0;
  };

  /** 由主循环每帧注入环境风 */
  FlightModel.prototype.setWind = function (dirDeg, speedKt, gustKt, turbulence) {
    this.windDir = dirDeg; this.windSpeed = speedKt;
    this.gust = gustKt || 0; this.turbulence = turbulence || 0;
  };

  /* ---------------------------------------------------------------------
     操纵输入接口
     --------------------------------------------------------------------- */
  FlightModel.prototype.setPilotInput = function (pitch, roll, yaw) {
    this.pilot.pitch = U.clamp(pitch, -1, 1);
    this.pilot.roll = U.clamp(roll, -1, 1);
    this.pilot.yaw = U.clamp(yaw, -1, 1);
  };

  FlightModel.prototype.setThrottle = function (idx, value) {
    if (idx === 'all') {
      for (var i = 0; i < this.throttle.length; i++) this.throttle[i] = U.clamp01(value);
    } else if (this.throttle[idx] !== undefined) {
      this.throttle[idx] = U.clamp01(value);
    }
  };

  FlightModel.prototype.nudgeThrottle = function (delta) {
    for (var i = 0; i < this.throttle.length; i++) {
      this.throttle[i] = U.clamp01(this.throttle[i] + delta);
    }
  };

  FlightModel.prototype.setGear = function (down) { this.gearCmd = down ? 1 : 0; };
  FlightModel.prototype.setFlapDetent = function (index) {
    var f = this.ac.flaps;
    index = U.clamp(Math.round(index), 0, f.length - 1);
    this.flapCmd = f[index].pos;
    this.flapDetentIndex = index;
    return f[index].name;
  };
  FlightModel.prototype.stepFlap = function (dir) {
    var idx = this.flapDetentIndex !== undefined ? this.flapDetentIndex :
      FS.Aero.nearestDetent(this.typeKey, this.flapPos);
    return this.setFlapDetent(idx + dir);
  };
  FlightModel.prototype.setSpoilers = function (v) { this.spoilerCmd = U.clamp01(v); };
  FlightModel.prototype.setBrakes = function (v) { this.brakeCmd = U.clamp01(v); };
  FlightModel.prototype.setParkingBrake = function (on) { this.parkingBrake = !!on; };
  FlightModel.prototype.setAutoBrake = function (mode) { this.autoBrake = mode; };

  FlightModel.prototype.startEngine = function (idx) {
    if (idx === 'all') { for (var i = 0; i < this.engines.length; i++) this.engines[i].commandStart(true); }
    else if (this.engines[idx]) this.engines[idx].commandStart(false);
    this._log('发动机启动 ' + (idx === 'all' ? '全部' : idx));
  };
  FlightModel.prototype.shutdownEngine = function (idx) {
    if (idx === 'all') { for (var i = 0; i < this.engines.length; i++) this.engines[i].commandShutdown(); }
    else if (this.engines[idx]) this.engines[idx].commandShutdown();
  };
  FlightModel.prototype.startAPU = function () {
    if (!this.apuRunning) { this.apuRunning = true; this.apuTimer = 0; FS.Bus.emit('fm:apuStart'); }
  };
  FlightModel.prototype.stopAPU = function () { this.apuRunning = false; };

  FlightModel.prototype.setReverser = function (idx, on) {
    if (idx === 'all') { for (var i = 0; i < this.engines.length; i++) this.engines[i].reverserArmed = on; }
    else if (this.engines[idx]) this.engines[idx].reverserArmed = on;
  };

  /* ---------------------------------------------------------------------
     控制律 (电传 / 直接律)
     --------------------------------------------------------------------- */
  FlightModel.prototype._applyControlLaw = function (dt) {
    var s = this.surfaces;
    var fbw = this.ac.systems.flyByWire;

    if (this.apCmd.active) {
      // 自动驾驶直接给舵面指令
      s.elevator = U.moveTowards(s.elevator, U.clamp(this.apCmd.elevator, -1, 1), 2.2 * dt);
      s.aileron = U.moveTowards(s.aileron, U.clamp(this.apCmd.aileron, -1, 1), 2.5 * dt);
      s.rudder = U.moveTowards(s.rudder, U.clamp(this.apCmd.rudder, -1, 1), 2.0 * dt);
      return;
    }

    var pIn = this.pilot.pitch, rIn = this.pilot.roll, yIn = this.pilot.yaw;

    if (this.controlLaw === 'normal' && fbw && fbw.envelopeProtection) {
      /* ---------- 空客正常法则 ----------
         俯仰杆量 -> 载荷因数需求 (-1g ~ +2.5g), 松杆自动回中并自动配平
         横滚杆量 -> 滚转速率需求 (±15°/s), 松杆保持坡度
         保护: 迎角保护 / 过载保护 / 坡度限制 / 高速保护               */
      var gDemand = pIn >= 0 ? (1 + pIn * (fbw.alphaProt > 0 ? 1.5 : 1.5)) : (1 + pIn * 2.0);
      gDemand = U.clamp(gDemand, -0.5, 2.5);

      // 迎角保护: 接近 alphaProt 时限制拉杆
      var aProt = fbw.alphaProt * C.DEG;
      var aMax = fbw.alphaMax * C.DEG;
      if (this.alpha > aProt) {
        var over = U.clamp01((this.alpha - aProt) / Math.max(0.001, aMax - aProt));
        gDemand = Math.min(gDemand, U.lerp(2.5, 1.0, over));
      }
      // 坡度限制
      var bank = Math.abs(this.roll) * C.RAD;
      if (bank > fbw.bankLimit) {
        var bo = U.clamp01((bank - fbw.bankLimit) / 20);
        gDemand = Math.min(gDemand, U.lerp(2.5, 1.0, bo));
      }
      // 高速保护: 大马赫数时限制抬头
      if (this.mach > this.ac.perf.mmo - 0.03 && gDemand > 1) {
        gDemand = 1 + (gDemand - 1) * 0.25;
      }

      // 载荷因数控制律 (用俯仰角速率阻尼 + 过载反馈)
      var gErr = gDemand - this.gLoad;
      var targetQ = U.clamp(gErr * 0.32 - this.rates.q * 0.55, -0.85, 0.85);
      // 约定: 升降舵正值 = 后缘向下 = 低头力矩, 所以抬头(q>0)需要负的升降舵
      var deCmd = -targetQ / Math.max(0.35, this._elevAuthority());
      s.elevator = U.damp(s.elevator, U.clamp(deCmd, -1, 1), 0.16, dt);

      // 自动配平: 慢慢把升降舵偏度转移到配平通道
      s.elevatorTrim = U.moveTowards(s.elevatorTrim,
        U.clamp(s.elevatorTrim + s.elevator * 0.55, -0.9, 0.9), 0.10 * dt);
      s.elevator *= 0.94;

      // 横滚: 速率需求
      var rollRateCmd = rIn * 15 * C.DEG;
      if (Math.abs(rIn) < 0.02) rollRateCmd = -this.roll * 1.35;      // 松杆保持坡度
      var pErr = rollRateCmd - this.rates.p;
      var daCmd = U.clamp(pErr * 1.15, -1, 1);
      s.aileron = U.damp(s.aileron, daCmd, 0.09, dt);

      // 方向舵: 协调转弯 + 偏航阻尼
      var coordRudder = U.clamp(this.rates.r * -1.4 + this.beta * 1.6, -1, 1);
      s.rudder = U.damp(s.rudder, U.clamp(yIn + coordRudder * 0.55, -1, 1), 0.12, dt);

    } else {
      /* ---------- 直接法则 / 波音传统操纵 ---------- */
      s.elevator = U.damp(s.elevator, -pIn, 0.09, dt);   // +俯仰杆量 = 抬头 = 升降舵上偏
      s.aileron = U.damp(s.aileron, rIn, 0.10, dt);
      // 偏航阻尼器 (正方向舵 = 机头右偏)
      var yawDamp = this.ap.yawDamper ? (-this.rates.r * 0.9 + this.beta * 1.2) : 0;
      s.rudder = U.damp(s.rudder, U.clamp(yIn + yawDamp * 0.6, -1, 1), 0.12, dt);
      // 人工配平
      if (this.trimInput) {
        s.elevatorTrim = U.clamp(s.elevatorTrim - this.trimInput * 0.22 * dt, -1, 1);
      }
    }
  };

  /** 升降舵操纵效能 (随动压变化) */
  FlightModel.prototype._elevAuthority = function () {
    var qb = this.qbar;
    var ref = 0.5 * C.RHO0 * Math.pow(130 * C.KT, 2);
    return U.clamp(qb / ref, 0.06, 4.0);
  };

  /* ---------------------------------------------------------------------
     气动力与力矩
     --------------------------------------------------------------------- */
  FlightModel.prototype._computeAero = function (dt) {
    var dims = this.ac.dims, a = this.aero;
    var S = dims.wingArea;
    var b = dims.wingspan;
    var cbar = S / b;                       // 平均气动弦长 (近似)

    /* ---- 相对气流 (扣除风) ---- */
    var vW = Q.rotate(this.q, this.velBody);              // 机体速度 -> 世界
    // 风: 世界坐标 (风向为来向)
    var wd = this.windDir * C.DEG;
    this.windVec.x = -Math.sin(wd) * this.windSpeed * C.KT;
    this.windVec.z = Math.cos(wd) * this.windSpeed * C.KT;
    this.windVec.y = 0;
    var relWorld = { x: vW.x - this.windVec.x, y: vW.y - this.windVec.y, z: vW.z - this.windVec.z };
    var relBody = Q.invRotate(this.q, relWorld);

    this.velWorld = vW;
    this.gs = Math.hypot(vW.x, vW.z) / C.KT;

    var u = relBody.x, v = relBody.y, w = relBody.z;
    var Vt = Math.sqrt(u * u + v * v + w * w);
    this.tas = Vt;
    this.tasKt = Vt / C.KT;

    /* ---- 气流角 ---- */
    if (Vt < 0.5) {
      this.alpha = this.pitch;
      this.beta = 0;
    } else {
      this.alpha = Math.atan2(w, Math.max(0.5, Math.abs(u)) * (u < 0 ? -1 : 1));
      if (u < 0) this.alpha = Math.atan2(w, u);   // 倒飞/倒退时保持符号正确
      this.beta = Math.asin(U.clamp(v / Vt, -1, 1));
    }
    if (!isFinite(this.alpha)) this.alpha = 0;
    if (!isFinite(this.beta)) this.beta = 0;
    this.alphaDeg = this.alpha * C.RAD;
    this.betaDeg = this.beta * C.RAD;

    /* ---- 动压与马赫 ---- */
    var rho = this.rho || C.RHO0;
    var sos = this.soundSpeed || C.A0;
    this.mach = Vt / sos;
    var qbar = 0.5 * rho * Vt * Vt;
    this.qbar = qbar;

    /* ---- 指示空速 ---- */
    var iasMps = FS.Atmo.casFromTas(Vt, this.pressure || C.P0, rho);
    this.ias = iasMps;
    this.iasKt = iasMps / C.KT;

    /* ---- 迎角变化率 (下洗滞后) ---- */
    var rawAlphaDot = (this.alpha - this._prevAlpha) / Math.max(1e-4, dt);
    this.alphaDot = U.damp(this.alphaDot, U.clamp(rawAlphaDot, -3, 3), 0.05, dt);
    this._prevAlpha = this.alpha;

    /* ---- 构型插值 ---- */
    var fp = FS.Aero.flapAt(this.ac, this.flapPos);
    this.flapData = fp;
    var aStall = fp.alphaStall * C.DEG;

    /* ---- 地面效应 ---- */
    var agl = this.pos.y - this.groundHeightAt(this.pos.x, this.pos.z);
    this.agl = agl;
    this.aglFt = agl / C.FT;
    // 无线电高度 = 机轮离地高度 (参考点高度要扣掉起落架高度),
    // 拉平与 GPWS 喊话必须使用这个值
    this.raFt = Math.max(0, (agl - this.getReferenceHeight()) / C.FT);
    var geFactor = 1;
    if (agl < b * 1.2 && agl > -1) {
      var hr = Math.max(0, agl) / b;
      var sig = Math.pow(16 * hr, 2) / (1 + Math.pow(16 * hr, 2));
      geFactor = 1 - sig;
    }
    this.groundEffectFactor = geFactor;

    /* ---- 升力系数 ---- */
    var CL = clAt(this.alpha, aStall, a.CL0, a.CLalpha) + fp.cl;
    // 马赫数对升力线斜率的影响
    var mcrit = a.machCrit;
    if (this.mach > mcrit) {
      var mf = U.clamp01((this.mach - mcrit) / 0.14);
      CL *= (1 + 0.16 * mf);
    }
    // 地面效应增升
    CL *= (1 + 0.055 * (1 - geFactor));
    // 减速板/扰流板破坏升力
    CL *= (1 - 0.42 * this.spoilerPos);
    if (!isFinite(CL)) CL = 0;
    this.CL = CL;

    /* ---- 阻力系数 ---- */
    var osw = U.lerp(a.oswaldClean, a.oswaldFlap, this.flapPos);
    var k = 1 / (Math.PI * a.AR * osw);
    var CDi = k * CL * CL * geFactor;
    var CD0 = a.CD0Clean;
    CD0 += fp.cd;                                        // 襟翼
    CD0 += a.CD0Slat * fp.slat * 0.55;
    CD0 += a.CD0Gear * this.gearPos;
    CD0 += a.CD0Spoiler * this.spoilerPos;
    // 配平阻力
    CD0 += 0.0016 * Math.abs(this.surfaces.elevatorTrim) / 0.1 * 0.1;
    // 侧滑阻力
    var CDbeta = Math.abs(this.beta) * 0.9;
    // 失速后的分离阻力
    var sepDrag = 0;
    if (Math.abs(this.alpha) > aStall * 0.9) {
      var sOver = U.clamp01((Math.abs(this.alpha) - aStall * 0.9) / (aStall * 0.35));
      sepDrag = 0.09 * sOver * sOver * (1 + Math.abs(CL));
    }
    // 跨音速阻力发散
    var CDwave = 0;
    if (this.mach > mcrit) {
      // 阻力发散: 从临界马赫到 MMO 之间平滑增长, 到 MMO 时达到 full 增量
      var mmo = this.ac.perf.mmo;
      var span = Math.max(0.045, mmo - mcrit);
      var mdiff = (this.mach - mcrit) / span;
      CDwave = a.machDragRise * mdiff * mdiff;
      CDwave = Math.min(CDwave, 0.032);
    }
    // 低速大迎角时的额外阻力
    var CD = CD0 + CDi + CDbeta + sepDrag + CDwave;
    if (!isFinite(CD)) CD = 0.1;
    this.CD = CD;

    /* ---- 气动力 (机体轴) ---- */
    var cosA = Math.cos(this.alpha), sinA = Math.sin(this.alpha);
    var cosB = Math.cos(this.beta), sinB = Math.sin(this.beta);
    var L = qbar * S * CL;
    var D = qbar * S * CD;

    // 侧力系数
    var CY = a.CYbeta * this.beta + a.CYRudder * this.surfaces.rudder * 0.6;
    var Y = qbar * S * CY;

    var Faero = {
      x: -D * cosA * cosB + L * sinA,
      y: -D * sinB + Y,
      z: -D * sinA * cosB - L * cosA
    };
    this.liftN = L; this.dragN = D;

    /* ---- 气动阻尼与操纵力矩 ---- */
    var p = this.rates.p, qq = this.rates.q, r = this.rates.r;
    var b2v = b / Math.max(1, 2 * Vt);
    var c2v = cbar / Math.max(1, 2 * Vt);
    var de = this.surfaces.elevator + this.surfaces.elevatorTrim;
    var da = this.surfaces.aileron;
    var dr = this.surfaces.rudder;

    // 操纵效能随迎角变化 (失速后下降)
    var ctrlEff = 1;
    if (Math.abs(this.alpha) > aStall * 0.9) {
      ctrlEff = U.lerp(1, 0.55, U.clamp01((Math.abs(this.alpha) - aStall * 0.9) / (aStall * 0.3)));
    }
    // 高速时操纵效能增强 (但受结构限制)
    var fastEff = this.mach > 0.78 ? U.lerp(1, 0.72, U.clamp01((this.mach - 0.78) / 0.12)) : 1;

    var Cm = a.Cm0 + a.CmAlpha * this.alpha
      + a.CmElevator * de * ctrlEff * fastEff
      + a.CmFlap * this.flapPos
      + a.CmGear * this.gearPos
      + a.CmQ * qq * c2v
      + a.CmAlphaDot * this.alphaDot * c2v;

    var Cl = a.ClBeta * this.beta
      + a.ClAileron * da * ctrlEff
      + a.ClRudder * dr
      + a.ClP * p * b2v
      + a.ClR * r * b2v;

    var Cn = a.CnBeta * this.beta
      + a.CnRudder * dr * ctrlEff
      + a.CnAileron * da
      + a.CnR * r * b2v
      + a.CnP * p * b2v;

    // 发动机失效时的偏航/滚转力矩
    var engYaw = 0, engRoll = 0;
    for (var i = 0; i < this.engines.length; i++) {
      var eng = this.engines[i];
      if (!eng) continue;
      var dz = this.ac.dims.enginePos.z;
      var fuelOn = eng.fuelOn && eng.state !== 'off';
      if (!fuelOn) {
        // 失效发动机的阻力
        var windmillDrag = qbar * this.ac.dims.engineNacelleDia * 2.2 * 0.42;
        Faero.x -= windmillDrag * 0.55;
        Cn -= eng.side * windmillDrag * this.ac.dims.enginePos.x / (qbar * S * b + 1);
      }
    }
    // 推力力矩在 _computeThrust 中处理

    var Maero = {
      roll: qbar * S * b * Cl,
      pitch: qbar * S * cbar * Cm,
      yaw: qbar * S * b * Cn
    };

    return { F: Faero, M: Maero, S: S, b: b, cbar: cbar, qbar: qbar, Vt: Vt };
  };

  /* ---------------------------------------------------------------------
     推力
     --------------------------------------------------------------------- */
  FlightModel.prototype._computeThrust = function (dt, mach) {
    var totalT = 0, totalFF = 0;
    var dims = this.ac.dims;
    var Fx = 0, My = 0, Mn = 0, Mr = 0;

    for (var i = 0; i < this.engines.length; i++) {
      var eng = this.engines[i];
      var lever = this.ap.athr && this.apCmd.athrThrottle !== undefined
        ? this.apCmd.athrThrottle : this.throttle[i];
      // 反推只能在推力手柄处于慢车附近时展开
      var revTarget = (eng.reverserArmed && this.onGround && lever < 0.32) ? 1 : 0;
      eng.reverserPos = U.moveTowards(eng.reverserPos, revTarget, 0.55 * dt);

      eng.update(dt, lever, this.ambientT, mach, this.sigma || 1, this.tas || 0);

      var T = eng.thrust;
      totalT += T;
      totalFF += eng.fuelFlow;

      Fx += T;
      // 推力线在重心下方 (机体 z 向下为正) -> 抬头力矩
      var engZDown = dims.thrustArmZ !== undefined ? dims.thrustArmZ : 1.2;
      var engYRight = eng.side * dims.enginePos.x;
      My += engZDown * T;
      // 不对称推力 -> 偏航力矩 (右发推力产生左偏)
      Mn += -engYRight * T;
      Mr += 0;
    }

    this.totalThrust = totalT;
    this.fuelFlowTotal = totalFF;
    return { Fx: Fx, My: My, Mn: Mn, Mr: Mr };
  };

  /* ---------------------------------------------------------------------
     地面高度查询
     --------------------------------------------------------------------- */
  FlightModel.prototype.groundHeightAt = function (x, z) {
    var h = this.groundHeightFn(x, z);
    return isFinite(h) ? h : 0;
  };

  /* ---------------------------------------------------------------------
     起落架几何
     配置中的 dims.gear.* 使用"模型坐标系": x = 右, y = 上, z = 机尾方向
     机体轴为 x = 前, y = 右, z = 下, 因此换算关系为:
         x_body = -z_model    y_body = x_model    z_body = -y_model
     --------------------------------------------------------------------- */
  FlightModel.prototype._makeGearList = function () {
    if (this._gearCache) return this._gearCache;
    var d = this.ac.dims;
    var gn = d.gear.nose, gm = d.gear.main;

    function conv(g, lateral) {
      return {
        // 机体轴坐标 (x 前, y 右, z 下)
        x: -g.z,
        y: lateral !== undefined ? lateral : g.x,
        z: -g.y,
        strutLen: g.strutLen,
        wheelR: g.wheelR,
        wheels: g.wheels,
        bogie: !!g.bogie
      };
    }

    var list = [];
    var nose = conv(gn, gn.x);
    nose.name = 'nose';
    nose.steerable = true;
    nose.brakeFrac = 0;
    nose.maxTravel = Math.max(0.28, gn.strutLen * 0.16);
    list.push(nose);

    for (var s = -1; s <= 1; s += 2) {
      var side = conv(gm, gm.x * s);
      side.name = (s < 0 ? 'mainL' : 'mainR');
      side.steerable = false;
      side.brakeFrac = 0.5;
      side.maxTravel = Math.max(0.34, gm.strutLen * 0.16);
      // 4/6 轮小车式主起落架: 重心略微偏向小车中心
      list.push(side);
    }
    this._gearCache = list;
    return list;
  };

  /**
   * 参考点到最低机轮底部的距离 (米)
   * 用于把飞机正确地放在地面上
   */
  FlightModel.prototype.getGroundClearance = function () {
    var gears = this._makeGearList();
    var maxZ = 0;
    for (var i = 0; i < gears.length; i++) {
      var z = gears[i].z + gears[i].strutLen + gears[i].wheelR;
      if (z > maxZ) maxZ = z;
    }
    return maxZ;
  };

  /** 静止时的起落架压缩量 (米) —— 以承载 90% 重量的主起落架为准 */
  FlightModel.prototype.getStaticCompression = function () {
    var gears = this._makeGearList();
    for (var i = 0; i < gears.length; i++) {
      if (gears[i].name !== 'nose') return gears[i].maxTravel * 0.35;
    }
    return gears[0].maxTravel * 0.35;
  };

  /** 参考点距地面的高度 (静止状态) */
  FlightModel.prototype.getReferenceHeight = function () {
    return this.getGroundClearance() - this.getStaticCompression();
  };

  /* ---------------------------------------------------------------------
     地面接触
     --------------------------------------------------------------------- */
  FlightModel.prototype._computeGround = function (dt, F, M) {
    var dims = this.ac.dims;
    var g = C.G0;
    var mass = this.gw;

    // 起落架未放下时不做接触
    if (this.gearPos < 0.85) {
      this.onGround = false; this.wow = false;
      this.contactForce = 0;
      this._groundForceBody = { x: 0, y: 0, z: 0 };
      this.gearCompression = U.damp(this.gearCompression, 0, 0.2, dt);
      return;
    }

    var gears = this._makeGearList();

    var R = Q.toMatrix(this.q);
    var anyContact = false;
    var maxComp = 0;
    var totalNormal = 0;
    var Fground = { x: 0, y: 0, z: 0 };
    var Mground = { roll: 0, pitch: 0, yaw: 0 };

    // 世界速度
    var vw = this.velWorld;

    // 前轮转向角
    this.steerAngle = this.steerAngle || 0;
    var steerCmd = 0;
    if (this.onGround) {
      var speedFactor = U.clamp01(1 - (this.gs || 0) / (60 * C.KT));
      var maxSteer = (72 * speedFactor + 5) * C.DEG;
      steerCmd = U.clamp((this.surfaces.rudder || 0) * maxSteer, -72 * C.DEG, 72 * C.DEG);
    }
    this.steerAngle = U.damp(this.steerAngle, steerCmd, 0.18, dt);

    // 摩擦系数
    var muRoll = 0.020;
    var muBrakeMax = 0.52;
    var muSide = 0.72;
    var wetFactor = this.runwayWet ? 0.72 : 1.0;

    var cc = Math.cos(this.steerAngle), ss = Math.sin(this.steerAngle);

    for (var i = 0; i < gears.length; i++) {
      var gg = gears[i];

      // 机轮接地点 (机体轴, z 向下为正)
      var bodyPt = { x: gg.x, y: gg.y, z: gg.z + gg.strutLen };
      var wp = Q.rotate(this.q, bodyPt);
      var cx = this.pos.x + wp.x, cy = this.pos.y + wp.y, cz = this.pos.z + wp.z;

      var gh = this.groundHeightAt(cx, cz);
      var gap = (cy - gg.wheelR) - gh;            // 轮底相对地面的高度

      if (gap > 0.02) continue;

      anyContact = true;
      var comp = U.clamp(-gap, 0, gg.maxTravel);
      if (comp > maxComp) maxComp = comp;

      // 弹簧-阻尼 (静态压缩约为行程的 35%)
      var fShare = (gg.name === 'nose') ? 0.10 : 0.90 / (gears.length - 1);
      var kSpring = (mass * g * fShare) / (gg.maxTravel * 0.35);
      var mPerGear = mass * Math.max(0.08, fShare);
      var zeta = gg.name === 'nose' ? 0.32 : 0.38;
      var cDamp = 2 * zeta * Math.sqrt(kSpring * mPerGear);

      // 接地点速度 (含机体系角速度贡献): v + ω × r
      var om = Q.rotate(this.q, { x: this.rates.p, y: this.rates.q, z: this.rates.r });
      var vp = {
        x: vw.x + (om.y * wp.z - om.z * wp.y),
        y: vw.y + (om.z * wp.x - om.x * wp.z),
        z: vw.z + (om.x * wp.y - om.y * wp.x)
      };

      var compRate = -vp.y;                     // 压缩速率 (向下为正)
      var N = kSpring * comp + cDamp * Math.max(0, compRate);
      N = U.clamp(N, 0, mass * g * 1.6);
      totalNormal += N;

      /* ---- 摩擦力 (沿地面) ---- */
      // 机体 x 轴 (机头) 与 y 轴 (右翼) 在世界中的方向 = 旋转矩阵的第 1、2 列
      var fwdWx = R[0], fwdWz = R[6];
      var rgtWx = R[1], rgtWz = R[7];

      // 前轮转向: 把轮胎的纵/横方向按转向角旋转
      var useSteer = gg.steerable ? this.steerAngle : 0;
      var cS = Math.cos(useSteer), sS = Math.sin(useSteer);
      var tFwdX = fwdWx * cS + rgtWx * sS, tFwdZ = fwdWz * cS + rgtWz * sS;
      var tRgtX = rgtWx * cS - fwdWx * sS, tRgtZ = rgtWz * cS - fwdWz * sS;

      // 轮胎滚动方向上的速度
      var vfwd = vp.x * tFwdX + vp.z * tFwdZ;
      var vside = vp.x * tRgtX + vp.z * tRgtZ;

      // 侧向 (轮胎侧偏刚度)
      var cornerStiff = 0.42 * N;
      var Fside = U.clamp(-vside * cornerStiff * 2.2, -muSide * N, muSide * N);

      // 纵向: 滚阻 + 刹车
      var brake = this.parkingBrake ? 1 : U.clamp01(this.brakeCmd);
      if (this.autoBrake !== 'OFF' && this.onGround && this.tas > 2.5 && !this.reverserActive()) {
        var abMap = { 'LO': 0.26, '1': 0.28, '2': 0.40, '3': 0.52, 'MED': 0.52, 'HI': 0.74, 'MAX': 0.92 };
        brake = Math.max(brake, abMap[this.autoBrake] || 0);
      }
      var muBrake = muBrakeMax * wetFactor * (gg.brakeFrac > 0 ? 1 : 0.18);
      var Fbrake = -U.sign(vfwd) * Math.min(muBrake * N * (gg.brakeFrac || 0),
        Math.abs(vfwd) * mPerGear * 3.0) * brake;
      var Froll = -U.sign(vfwd) * muRoll * N;

      if (brake > 0.35 && Math.abs(vfwd) > 0.5 && Math.abs(vfwd) < 48 * C.KT) this.antiSkidActive = true;

      var Flong = Fbrake + Froll;
      var Ffric = {
        x: tFwdX * Flong + tRgtX * Fside,
        y: 0,
        z: tFwdZ * Flong + tRgtZ * Fside
      };

      Fground.x += Ffric.x;
      Fground.y += N;
      Fground.z += Ffric.z;

      // 力矩 M = r × F  (统一转到机体轴)
      var Fb = Q.invRotate(this.q, { x: Ffric.x, y: N, z: Ffric.z });
      Mground.roll += bodyPt.y * Fb.z - bodyPt.z * Fb.y;
      Mground.pitch += bodyPt.z * Fb.x - bodyPt.x * Fb.z;
      Mground.yaw += bodyPt.x * Fb.y - bodyPt.y * Fb.x;
    }

    if (this.brakeCmd < 0.05 && this.autoBrake === 'OFF' && !this.parkingBrake) this.antiSkidActive = false;

    this.contactForce = totalNormal;
    this.onGround = anyContact;
    this.wow = anyContact && totalNormal > mass * g * 0.25;
    this.gearCompression = U.damp(this.gearCompression,
      maxComp / Math.max(0.01, dims.gear.main.strutLen * 0.16 * 1.6), 0.12, dt);
    // 机轮转速
    if (anyContact) {
      this.wheelSpin = this.gs / Math.max(0.1, dims.gear.main.wheelR);
    } else {
      this.wheelSpin *= 0.999;
    }

    // Fground / Ffric 都在世界系中累加, 必须转换到机体轴后再并入合力
    var FgBody = Q.invRotate(this.q, Fground);
    this._groundForceBody = FgBody;      // 供过载(比力)计算使用
    F.x += FgBody.x; F.y += FgBody.y; F.z += FgBody.z;
    M.roll += Mground.roll; M.pitch += Mground.pitch; M.yaw += Mground.yaw;
    /* ---- 地面扰流板逻辑 ----
       真实逻辑: 只有在"确实完成一次着陆"并且油门已收到慢车(或反推已展开)时
       才会自动放出地面扰流板。起飞滑跑中即使短暂弹跳也绝不能放板, 否则会
       卸掉升力造成"海豚跳"正反馈。                                    */
    var gsDeploy = false;
    if (this.onGround) {
      if (this.rejectingTakeoff) {
        gsDeploy = true;
      } else if (this._airborneForLanding && this.gs > 40 * C.KT) {
        var bothIdle = true;
        for (var gi = 0; gi < this.engines.length; gi++) {
          var lev = this.throttle[gi] !== undefined ? this.throttle[gi] : 0;
          if (lev > 0.22) { bothIdle = false; break; }
        }
        if (bothIdle || this.reverserActive()) gsDeploy = true;
      }
    }
    this.groundSpoilers = gsDeploy;
  };

  FlightModel.prototype.reverserActive = function () {
    for (var i = 0; i < this.engines.length; i++) {
      if (this.engines[i].reverserPos > 0.3) return true;
    }
    return false;
  };
  FlightModel.prototype._wasAirborneRecently = function () {
    return (this.time - this.lastTouchdownTime) < 3.5;
  };

  /* ---------------------------------------------------------------------
     主更新
     --------------------------------------------------------------------- */
  FlightModel.prototype.update = function (dt, options) {
    options = options || {};
    if (dt <= 0) return this;
    dt = Math.min(dt, 0.05);

    var ac = this.ac, dims = ac.dims, a = this.aero;
    var g = C.G0;

    this.time += dt;
    if (!this.onGround) this.flightTime += dt;

    /* ---- 1. 大气 ---- */
    var altM = this.pos.y;
    var atm = FS.Atmo.isa(Math.max(0, altM));
    this.updateAtmosphere(atm, altM);

    /* ---- 2. 系统状态 ---- */
    if (this.apuRunning) {
      this.apuTimer += dt;
      if (this.apuTimer > 1 && !this._apuStarted) {
        this._apuStarted = true;
        FS.Bus.emit('fm:apuReady');
      }
    } else { this._apuStarted = false; this.apuTimer = 0; }

    /* ---- 3. 控制律 ---- */
    this._applyControlLaw(dt);

    /* ---- 4. 构型动画 ---- */
    var gearRate = 1 / 22;                 // 起落架收放约 22 秒
    var prevGear = this.gearPos;
    this.gearPos = U.moveTowards(this.gearPos, this.gearCmd, gearRate * dt);
    if (prevGear !== this.gearPos) {
      if (prevGear > 0.98 && this.gearPos <= 0.98) FS.Bus.emit('fm:gearInTransit', { direction: 'up' });
      if (prevGear < 0.02 && this.gearPos >= 0.02) FS.Bus.emit('fm:gearInTransit', { direction: 'down' });
    }

    // 襟翼/缝翼作动 (A350 全行程约 25 秒)
    var flapRate = 1 / 25;
    var prevFlap = this.flapPos;
    this.flapPos = U.moveTowards(this.flapPos, this.flapCmd, flapRate * dt);
    this.slatPos = U.moveTowards(this.slatPos, FS.Aero.flapAt(ac, this.flapCmd).slat, flapRate * 1.35 * dt);
    this.flapsMoving = Math.abs(this.flapPos - this.flapCmd) > 0.002;

    // 扰流板
    var spoilerTarget = this.spoilerCmd;
    if (this.groundSpoilers) spoilerTarget = 1;
    if (this.onGround && this.tas < 3 && this.parkingBrake) spoilerTarget = Math.max(spoilerTarget, 0.0);
    // 横滚操纵时的差动扰流板
    this.spoilerPos = U.moveTowards(this.spoilerPos, spoilerTarget,
      (this.groundSpoilers ? 1.6 : 0.85) * dt);

    /* ---- 5. 气动力 ---- */
    var ar = this._computeAero(dt);

    /* ---- 6. 推力 ---- */
    var th = this._computeThrust(dt, this.mach);

    var F = {
      x: ar.F.x + th.Fx,
      y: ar.F.y,
      z: ar.F.z
    };
    var M = {
      roll: ar.M.roll + th.Mr,
      pitch: ar.M.pitch + th.My,
      yaw: ar.M.yaw + th.Mn
    };

    /* ---- 7. 湍流 ---- */
    if (this.turbulence > 0.01 && this.tas > 20) {
      var tt = this.time;
      var amp = this.turbulence * U.clamp(this.qbar / 3000, 0.05, 1.0);
      var nz = (FS.Noise.value3(tt * 0.7, 0, 0, this.seed) * 2 - 1);
      var nx = (FS.Noise.value3(0, tt * 0.9, 3.1, this.seed) * 2 - 1);
      var ny = (FS.Noise.value3(7.3, 2.2, tt * 1.1, this.seed) * 2 - 1);
      var gustAmp = ar.qbar * dims.wingArea * amp;
      F.x += gustAmp * nx * 0.020;
      F.y += gustAmp * nz * 0.055;
      F.z += gustAmp * ny * 0.030;
      M.roll += ar.qbar * dims.wingArea * dims.wingspan * amp * nx * 0.0016;
      M.pitch += ar.qbar * dims.wingArea * (dims.wingArea / dims.wingspan) * amp * nz * 0.0018;
      M.yaw += ar.qbar * dims.wingArea * dims.wingspan * amp * ny * 0.0011;
    }

    /* ---- 8. 重力 (机体轴) ---- */
    var gBody = Q.invRotate(this.q, { x: 0, y: -g, z: 0 });
    F.x += gBody.x * this.gw;
    F.y += gBody.y * this.gw;
    F.z += gBody.z * this.gw;

    /* ---- 9. 地面 ---- */
    // 先用当前力预测一下是否接地 (接地判定需要速度)
    this._computeGround(dt, F, M);

    /* ---- 10. 六自由度积分 ---- */
    var mass = this.gw;
    var I = this.inertia;
    var p = this.rates.p, qq = this.rates.q, r = this.rates.r;

    // 线加速度 (机体轴)
    var ax = F.x / mass, ay = F.y / mass, az = F.z / mass;

    // 过载 = 非重力比力 / g  (机体 z 轴向下, 故取负号)
    // 地面反力属于"非重力"力, 因此停在地面时读数恰好为 1g
    var gf = this._groundForceBody || { x: 0, y: 0, z: 0 };
    var nz = ar.F.z + gf.z;
    this.gLoad = -nz / (mass * g);
    if (!isFinite(this.gLoad)) this.gLoad = 1;
    this.gLoad = U.clamp(this.gLoad, -3.5, 6.0);

    // 角加速度 (欧拉方程)
    var pdot = (M.roll - (I.Izz - I.Iyy) * qq * r) / I.Ixx;
    var qdot = (M.pitch - (I.Ixx - I.Izz) * r * p) / I.Iyy;
    var rdot = (M.yaw - (I.Iyy - I.Ixx) * p * qq) / I.Izz;

    // 限幅防止数值爆炸
    pdot = U.clamp(pdot, -8, 8);
    qdot = U.clamp(qdot, -6, 6);
    rdot = U.clamp(rdot, -6, 6);

    p += pdot * dt; qq += qdot * dt; r += rdot * dt;
    p = U.clamp(p, -6, 6); qq = U.clamp(qq, -4.5, 4.5); r = U.clamp(r, -4.5, 4.5);
    this.rates.p = p; this.rates.q = qq; this.rates.r = r;

    // 机体速度积分 (含旋转引起的科氏项)
    var du = ax + r * this.velBody.y - qq * this.velBody.z;
    var dv = ay - r * this.velBody.x + p * this.velBody.z;
    var dw = az + qq * this.velBody.x - p * this.velBody.y;

    this.velBody.x += du * dt;
    this.velBody.y += dv * dt;
    this.velBody.z += dw * dt;

    // 数值保护
    if (!isFinite(this.velBody.x) || !isFinite(this.velBody.y) || !isFinite(this.velBody.z)) {
      this.velBody.x = this.velBody.y = this.velBody.z = 0;
      FS.Log.error('速度出现非数值, 已重置');
    }
    var spd = Math.sqrt(this.velBody.x * this.velBody.x + this.velBody.y * this.velBody.y + this.velBody.z * this.velBody.z);
    if (spd > 400) {                                    // 约 M1.17 硬限
      var sc = 400 / spd;
      this.velBody.x *= sc; this.velBody.y *= sc; this.velBody.z *= sc;
    }

    // 姿态四元数积分
    var dq = Q.mul(this.q, { w: 0, x: p, y: qq, z: r });
    this.q.w += 0.5 * dq.w * dt;
    this.q.x += 0.5 * dq.x * dt;
    this.q.y += 0.5 * dq.y * dt;
    this.q.z += 0.5 * dq.z * dt;
    Q.normalize(this.q);

    // 世界位置积分
    var newVw = Q.rotate(this.q, this.velBody);
    this.pos.x += newVw.x * dt;
    this.pos.y += newVw.y * dt;
    this.pos.z += newVw.z * dt;
    this.velWorld = newVw;

    /* ---- 11. 地面穿透保护 ---- */
    var gh = this.groundHeightAt(this.pos.x, this.pos.z);
    var minY = gh + (this.gearPos > 0.85 ? (dims.gear.main.strutLen * 0.55 + dims.gear.main.wheelR * 0.05) : 1.2);
    if (this.pos.y < minY) {
      var wasAir = !this.onGround;
      this.pos.y = minY;
      if (this.velWorld.y < 0) {
        this.crashVS = this.velWorld.y;
        if (-this.velWorld.y > 6.5 && this.gearPos > 0.85) {
          FS.Bus.emit('fm:hardLanding', { vs: -this.velWorld.y * 196.85 });
        }
        // 反弹阻尼
        var vertBody = Q.invRotate(this.q, { x: 0, y: this.velBody.y, z: 0 });
        var vUpWorld = this.velWorld.y;
        var localUp = Q.invRotate(this.q, { x: 0, y: 1, z: 0 });
        var vn = this.velBody.x * localUp.x + this.velBody.y * localUp.y + this.velBody.z * localUp.z;
        this.velBody.x -= localUp.x * vn * 1.02;
        this.velBody.y -= localUp.y * vn * 1.02;
        this.velBody.z -= localUp.z * vn * 1.02;
        this.velWorld = Q.rotate(this.q, this.velBody);
      }
      if (wasAir) {
        this.lastTouchdownTime = this.time;
        this.touchdownVS = this._lastVS || 0;
        FS.Bus.emit('fm:touchdown', {
          vsFpm: this.touchdownVS,
          gsKt: this.gs,
          pitchDeg: this.pitch * C.RAD,
          bankDeg: this.roll * C.RAD,
          lateralFpm: 0
        });
      }
    }

    /* ---- 12. 姿态角解析 ---- */
    var eu = Q.toEuler(this.q);
    this.pitch = eu.pitch;
    this.roll = eu.roll;
    this.heading = eu.heading;
    this.pitchDeg = this.pitch * C.RAD;
    this.rollDeg = this.roll * C.RAD;

    /* ---- 13. 经纬度 ---- */
    var ll = FS.Geo.toLatLon(this.pos.x, this.pos.z);
    this.lat = ll.lat; this.lon = ll.lon;

    /* ---- 14. 垂直速度 / 航迹角 ---- */
    this._lastVS = this.velWorld.y * 196.8503937;      // ft/min
    this.vsFpm = this._lastVS;
    this.vsMs = this.velWorld.y;
    this.flightPathAngle = this.tas > 5 ? Math.asin(U.clamp(this.velWorld.y / this.tas, -1, 1)) * C.RAD : 0;
    this.track = U.wrap360(Math.atan2(this.velWorld.x, -this.velWorld.z) * C.RAD);
    this.drift = U.wrap180(this.track - this.heading);

    /* ---- 15. 燃油消耗 ---- */
    var burnKg = (this.fuelFlowTotal / 3600) * dt;
    burnKg = Math.min(burnKg, this.fuelKg);
    if (burnKg > 0) {
      this.fuelKg -= burnKg;
      this.fuelUsed += burnKg;
      if (this.fuelKg <= 0) {
        this.fuelKg = 0;
        if (!this._fuelStarved) {
          this._fuelStarved = true;
          for (var ei = 0; ei < this.engines.length; ei++) this.engines[ei].commandShutdown();
          FS.Bus.emit('fm:fuelStarved');
        }
      }
    }
    if (this.time % 5 < dt) this._updateMassProps();

    /* ---- 16. 地面滚转稳定 ---- */
    // 地面机动时用轻微的阻尼把机翼拉平 (真实飞机靠起落架几何自然回正)
    if (this.onGround && this.gearPos > 0.9) {
      this.rates.p += (-this.roll * 2.6 - this.rates.p * 0.8) * dt;
      this.rates.p = U.clamp(this.rates.p, -1.2, 1.2);
    }

    /* ---- 17. 刹车温度 ---- */
    var brakeHeat = (this.parkingBrake ? 1 : this.brakeCmd) * 900 * Math.max(0, 1 - this.gs / 90);
    for (var bt = 0; bt < 4; bt++) {
      this.brakeTemp[bt] += (brakeHeat * dt * 0.35) - (this.brakeTemp[bt] - this.ambientT) * dt * 0.012;
      this.brakeTemp[bt] = U.clamp(this.brakeTemp[bt], this.ambientT, 780);
    }

    /* ---- 18. 告警 ---- */
    this._updateWarnings(dt);

    /* ---- 19. 统计 ---- */
    var dd = Math.hypot(this.pos.x - this._lastPos.x, this.pos.z - this._lastPos.z);
    this.distanceNm += dd / C.NM;
    this._lastPos.x = this.pos.x; this._lastPos.z = this.pos.z;

    /* ---- 20. 空中/地面状态机 (用于着陆扰流板与自动刹车) ---- */
    if (!this.onGround) {
      this._airTime = (this._airTime || 0) + dt;
      // 必须是"真正飞起来了"才算一次着陆, 起飞滑跑中的小弹跳不算
      if (this._airTime > 2.0 && this.agl > 10) this._airborneForLanding = true;
    } else {
      this._airTime = 0;
      if (this.gs < 5 * C.KT && !this.groundSpoilers) {
        this._airborneForLanding = false;
      }
    }

    FS.Bus.emit('fm:updated', this);
    return this;
  };

  /* ---------------------------------------------------------------------
     告警逻辑
     --------------------------------------------------------------------- */
  FlightModel.prototype._updateWarnings = function (dt) {
    var w = this.warnings;
    var a = this.aero;
    var fp = this.flapData || FS.Aero.flapAt(this.ac, this.flapPos);

    /* 失速 */
    var aStall = fp.alphaStall * C.DEG;
    var stallMargin = aStall - this.alpha;
    var newStall = this.alpha > aStall * 0.94 && this.tas > 8;
    if (newStall && !w.stall) FS.Bus.emit('warning:stall', true);
    if (!newStall && w.stall) FS.Bus.emit('warning:stall', false);
    w.stall = newStall;
    this.stallMarginDeg = stallMargin * C.RAD;

    /* 超速 */
    var vmo = this.ac.perf.vmo, mmo = this.ac.perf.mmo;
    var vfeOver = FS.Aero.vfeExceed(this.typeKey, this.flapPos, this.iasKt);
    var newOver = this.iasKt > vmo || vfeOver > 0;
    var newMachOver = this.mach > mmo;
    if (newOver && !w.overspeed) FS.Bus.emit('warning:overspeed', true);
    if (!newOver && w.overspeed) FS.Bus.emit('warning:overspeed', false);
    w.overspeed = newOver;
    w.machOverspeed = newMachOver;
    this.vfeExceedKt = vfeOver;

    /* 起飞构型警告 */
    var toConf = this.onGround && this.totalThrust > this.gw * C.G0 * 0.18 &&
      (this.flapPos < 0.1 || !this.flapsMoving && this.flapPos < 0.05);
    w.configWarning = !!toConf;

    /* 低燃油 */
    var lowFuel = this.fuelKg < this.fuelCapacity * 0.06;
    if (lowFuel && !w.lowFuel) FS.Bus.emit('warning:lowFuel', true);
    w.lowFuel = lowFuel;

    /* 主警告/主警戒 */
    var mw = w.stall || w.overspeed || this.groundSpoilers === false && false;
    w.masterWarning = mw || w.pullUp;

    /* 发动机火警 */
    for (var i = 0; i < this.engines.length; i++) {
      if (this.engines[i].fireWarning) w.masterWarning = true;
    }

    /* 超速保护提示 */
    this.overspeedMargin = (vmo - this.iasKt);
  };

  /* ---------------------------------------------------------------------
     V 速度计算 (基于当前重量)
     --------------------------------------------------------------------- */
  FlightModel.prototype.getVSpeeds = function (opts) {
    opts = opts || {};
    var mass = this.gw;
    var S = this.ac.dims.wingArea;
    var flapPos = opts.flapPos !== undefined ? opts.flapPos : this.flapPos;
    var fp = FS.Aero.flapAt(this.ac, flapPos);
    var rho = rho0();

    function rho0() { return C.RHO0; }

    // 1g 失速速度
    var CLmax = this.aero.CL0 + this.aero.CLalpha * (fp.alphaStall * C.DEG) + fp.cl;
    var Vs = Math.sqrt((2 * mass * C.G0) / (rho * S * Math.max(0.3, CLmax)));   // m/s

    // 起飞/着陆安全系数
    //   V2  = max(Vr + 8, 1.15 Vs)          (起飞构型失速裕度)
    //   Vr  = 1.10 Vs
    //   V1  ≈ 0.94 Vr  (受 Vmcg / V1 ≤ Vr 约束)
    //   Vref= 1.23 Vs (着陆构型)
    var v2 = Math.max(Vs * 1.10 + 8 * C.KT, Vs * 1.15);
    var vref = Vs * this.ac.perf.vAppFactor;
    var vr = Vs * 1.10;
    var v1 = Math.min(vr * 0.94, Vs * 1.05);
    var vapp = vref + 5 * C.KT;                       // Vapp = Vref + 5
    var vf30 = Vs * 1.30, vf15 = Vs * 1.45, vf5 = Vs * 1.62;
    // 无风修正 (逆风分量的一半, 最多 15 kt)
    var windCorr = U.clamp(this.windSpeed * 0.25, 0, 15);

    return {
      Vs: Vs / C.KT,
      V1: v1 / C.KT,
      Vr: vr / C.KT,
      V2: v2 / C.KT,
      Vref: vref / C.KT,
      Vapp: (vapp / C.KT) + windCorr * 0.5,
      Vf30: vf30 / C.KT,
      Vf15: vf15 / C.KT,
      Vf5: vf5 / C.KT,
      Vfe: fp.vfe,
      VS0: Vs / C.KT,
      weight: mass,
      flapName: fp.name
    };
  };

  /* ---------------------------------------------------------------------
     巡航性能估算 (供 FMS 使用)
     --------------------------------------------------------------------- */
  FlightModel.prototype.estimateOptimumAltitude = function (mach) {
    var w = this.gw * C.G0;
    // 升阻比最优 -> 诱导阻力 = 零升阻力
    var k = 1 / (Math.PI * this.aero.AR * this.aero.oswaldClean);
    var CLopt = Math.sqrt(this.aero.CD0Clean / k);
    var S = this.ac.dims.wingArea;
    var m = mach || this.ac.perf.cruiseMach;
    var vRef = m * C.A0;                       // 用海平面音速做基准, 迭代一次即可
    var rhoneed = (2 * w) / (CLopt * S * vRef * vRef);
    // 从 ISA 表反解高度
    var h = 0;
    for (var alt = 0; alt < 50000; alt += 250) {
      var at = FS.Atmo.isa(alt);
      if (at.rho <= rhoneed) { h = alt; break; }
      h = alt;
    }
    // 抖振裕度与机动裕度带来的运行限制 (比理论最优低约 3000 ft)
    var ft = h / C.FT - 3000;
    return U.clamp(ft, 8000, this.ac.perf.ceiling);
  };

  /** 巡航燃油流量估算 kg/h */
  FlightModel.prototype.estimateCruiseFuelFlow = function (altFt, mach, massKg) {
    var altM = altFt * C.FT;
    var atm = FS.Atmo.isa(altM);
    var v = mach * atm.a;
    var qb = 0.5 * atm.rho * v * v;
    var w = (massKg || this.gw) * C.G0;
    var k = 1 / (Math.PI * this.aero.AR * this.aero.oswaldClean);
    var CL = w / Math.max(1, qb * this.ac.dims.wingArea);
    var CD = this.aero.CD0Clean + k * CL * CL;
    var D = qb * this.ac.dims.wingArea * CD;
    var tsfc = U.lerp(this.ac.engines.tsfcSL, this.ac.engines.tsfcCruise, mach / 0.85);
    return D * tsfc;                                    // kg/h
  };

  /* ---------------------------------------------------------------------
     对外状态快照 (供仪表/自动驾驶/渲染使用)
     --------------------------------------------------------------------- */
  FlightModel.prototype.getState = function () {
    var eng = [];
    for (var i = 0; i < this.engines.length; i++) {
      var e = this.engines[i];
      eng.push({
        n1: e.n1, n2: e.n2, egt: e.egt, thrust: e.thrust,
        fuelFlow: e.fuelFlow, state: e.state, reverser: e.reverserPos,
        vibration: e.vibration, oilTemp: e.oilTemp, oilPressure: e.oilPressure,
        fire: e.fireWarning, side: e.side
      });
    }
    return {
      typeKey: this.typeKey,
      time: this.time,
      lat: this.lat, lon: this.lon,
      pos: this.pos, velWorld: this.velWorld, velBody: this.velBody,
      quaternion: this.q,
      pitch: this.pitch, roll: this.roll, heading: this.heading,
      pitchDeg: this.pitch * C.RAD, rollDeg: this.roll * C.RAD,
      track: this.track, drift: this.drift,
      alpha: this.alpha, alphaDeg: this.alpha * C.RAD,
      beta: this.beta, betaDeg: this.beta * C.RAD,
      mach: this.mach, iasKt: this.iasKt, tasKt: this.tasKt, gsKt: this.gs,
      altFt: this.altFt, altM: this.altM, aglFt: this.aglFt, raFt: this.raFt, agl: this.agl,
      vsFpm: this.vsFpm, flightPathAngle: this.flightPathAngle,
      gLoad: this.gLoad,
      CL: this.CL, CD: this.CD, liftN: this.liftN, dragN: this.dragN, qbar: this.qbar,
      engines: eng,
      throttle: this.throttle.slice(),
      totalThrust: this.totalThrust,
      fuelFlowTotal: this.fuelFlowTotal,
      fuelKg: this.fuelKg, fuelCapacity: this.fuelCapacity, fuelUsed: this.fuelUsed,
      gw: this.gw, zfw: this.zfw, cgPercent: this.cgPercent,
      payloadKg: this.payloadKg,
      gearPos: this.gearPos, flapPos: this.flapPos, slatPos: this.slatPos,
      spoilerPos: this.spoilerPos, speedbrake: this.spoilerCmd,
      flapName: (this.flapData || {}).name,
      flapDetent: this.flapDetentIndex,
      surfaces: this.surfaces,
      onGround: this.onGround, wow: this.wow,
      gearCompression: this.gearCompression, brakeTemp: this.brakeTemp.slice(),
      steering: this.steerAngle, wheelSpin: this.wheelSpin,
      onGroundAny: this.onGround,
      stallWarning: this.warnings.stall,
      overspeed: this.warnings.overspeed,
      machOverspeed: this.warnings.machOverspeed,
      configWarning: this.warnings.configWarning,
      masterWarning: this.warnings.masterWarning,
      masterCaution: this.warnings.masterCaution,
      stallMarginDeg: this.stallMarginDeg,
      wind: { dir: this.windDir, speed: this.windSpeed, gust: this.gust, turbulence: this.turbulence },
      ambientT: this.ambientT,
      apuRunning: this.apuRunning,
      ap: this.ap,
      controlLaw: this.controlLaw,
      groundSpoilers: this.groundSpoilers,
      parkingBrake: this.parkingBrake,
      autoBrake: this.autoBrake,
      antiSkid: this.antiSkidActive,
      airportIcao: this.airportIcao,
      runwayIdent: this.runwayIdent,
      flightTime: this.flightTime,
      distanceNm: this.distanceNm,
      stallAngleDeg: (this.flapData || {}).alphaStall || 0,
      groundEffect: this.groundEffectFactor,
      wingFlex: U.clamp01(Math.abs(this.gLoad - 1) * 0.55 + this.iasKt / 460 * 0.25 + this.turbulence * 0.2),
      brakes: this.brakeCmd
    };
  };

  /* ---------------------------------------------------------------------
     便捷: 一键起飞 / 巡航预设 (供场景使用)
     --------------------------------------------------------------------- */
  FlightModel.prototype.setupForTakeoff = function (icao, rwyIdent, opts) {
    opts = opts || {};
    var o = this.ac.perf;
    this.placeOnRunway(icao, rwyIdent, { flapPos: 0, startFrac: 0.02 });
    // 起飞襟翼
    var d = FS.Aero.flapDetents(this.typeKey);
    var idx = d.indexOf(o.takeoffFlap);
    if (idx < 0) idx = Math.max(1, Math.floor(d.length / 3));
    this.setFlapDetent(idx);
    this.flapPos = this.flapCmd;
    this.slatPos = FS.Aero.flapAt(this.ac, this.flapCmd).slat;
    this.gearCmd = 1; this.gearPos = 1;
    this.parkingBrake = false;
    this.setFuel(opts.fuelKg !== undefined ? opts.fuelKg : this.ac.mass.maxFuel * 0.35);
    this.setPayload(opts.payloadKg !== undefined ? opts.payloadKg : this.ac.mass.maxPayload * 0.7);
    this.startEngine('all');
    for (var i = 0; i < this.engines.length; i++) {
      this.engines[i].state = 'running';
      this.engines[i].n1 = this.ac.engines.n1Idle;
      this.engines[i].fuelOn = true;
      this.engines[i].egt = this.ac.engines.egtIdle;
    }
    this.throttle = this.throttle.map(function () { return 0.06; });
    this.autoBrake = 'OFF';
    return this;
  };

  FlightModel.prototype.setupForCruise = function (lat, lon, altFt, hdgDeg, mach) {
    this.setFuel(this.ac.mass.maxFuel * 0.6);
    this.setPayload(this.ac.mass.maxPayload * 0.75);
    var m = mach || this.ac.perf.cruiseMach;
    var atm = FS.Atmo.isa(altFt * C.FT);
    var tas = FS.Atmo.tasFromMach(m, atm.p, atm.rho);
    var casKt = FS.Atmo.casFromTas(tas, atm.p, atm.rho) / C.KT;
    // 以校正空速摆位, setState 会解算出配平迎角并给出正确的速度矢量
    this.placeInAir(lat, lon, altFt, hdgDeg, casKt, { flapPos: 0 });
    for (var i = 0; i < this.engines.length; i++) {
      this.engines[i].state = 'running';
      this.engines[i].n1 = 82;
      this.engines[i].fuelOn = true;
      this.engines[i].egt = 620;
    }
    this.gearCmd = 0; this.gearPos = 0;
    this.parkingBrake = false;
    this.autoBrake = 'OFF';
    this.throttle = this.throttle.map(function () { return 0.78; });
    // 平飞时俯仰角 = 迎角 (航迹角为 0)
    this.levelAttitude(hdgDeg);
    return this;
  };

  /**
   * 把飞机摆成"零航迹角"的平飞姿态: 俯仰角 = 迎角, 坡度 0
   */
  FlightModel.prototype.levelAttitude = function (hdgDeg) {
    this.pitch = this.alpha;
    this.roll = 0;
    if (hdgDeg !== undefined) this.heading = U.wrap360(hdgDeg);
    this.q = Q.fromEuler(this.pitch, 0, this.heading * C.DEG);
    this.pitchDeg = this.pitch * C.RAD;
    this.rollDeg = 0;
    this.alphaDeg = this.alpha * C.RAD;
    this.rates.p = this.rates.q = this.rates.r = 0;
    var v = Math.sqrt(this.velBody.x * this.velBody.x + this.velBody.z * this.velBody.z);
    this.velBody.x = v * Math.cos(this.alpha);
    this.velBody.z = v * Math.sin(this.alpha);
    this.velBody.y = 0;
    this.velWorld = Q.rotate(this.q, this.velBody);
    this.pos.y = this.pos.y;                       // 保持高度
    this.trimForLevel(this.pos.y);
    return this;
  };

  FlightModel.prototype.setupForApproach = function (icao, rwyIdent, distNm) {
    var g = FS.Airports.ilsWorld(icao, rwyIdent);
    if (!g) throw new Error('该跑道没有 ILS: ' + icao + '/' + rwyIdent);
    var d = (distNm || 10) * C.NM;
    var course = g.course * C.DEG;
    // 沿反方向后退 distNm
    var x = g.threshold.x - Math.sin(course) * d;
    var z = g.threshold.z + Math.cos(course) * d;
    var thrElevFt = ilsThresholdElevFt(g);
    // 把飞机正好摆在下滑道上 (3° 下滑道约 318 ft/nm), 略低 30 ft 便于截获
    var gsRad0 = (g.gsAngle || 3.0) * C.DEG;
    var elevFt = thrElevFt + (distNm || 10) * 6076.115 * Math.tan(gsRad0) + 30;
    var ll = FS.Geo.toLatLon(x, z);
    this.setFuel(this.ac.mass.maxFuel * 0.15);
    this.setPayload(this.ac.mass.maxPayload * 0.6);
    for (var i = 0; i < this.engines.length; i++) {
      this.engines[i].state = 'running';
      this.engines[i].n1 = 58;
      this.engines[i].fuelOn = true;
      this.engines[i].egt = 520;
    }
    // 先用着陆襟翼算出正确的 V 速度 (setState 需要它来解算迎角)
    var dts = FS.Aero.flapDetents(this.typeKey);
    var idx = dts.indexOf(this.ac.perf.approachFlap);
    if (idx < 0) idx = dts.length - 1;
    this.flapPos = this.ac.flaps[idx].pos;
    var vappKt = this.getVSpeeds({ flapPos: this.flapPos }).Vapp;

    this.setState({
      lat: ll.lat, lon: ll.lon, altFt: elevFt, headingDeg: g.course,
      iasKt: vappKt + 15, gearDown: false
    });
    // setState 会把构型归零, 因此必须在其之后再设定襟翼
    this.setFlapDetent(idx);
    this.flapPos = this.flapCmd;
    this.slatPos = FS.Aero.flapAt(this.ac, this.flapCmd).slat;
    this.gearCmd = 1; this.gearPos = 1;
    this.parkingBrake = false;
    this.autoBrake = 'LO';
    this.throttle = this.throttle.map(function () { return 0.42; });
    this.ap.targetIas = this.getVSpeeds().Vapp;
    this.ap.apprArmed = true;
    this.ap.locArmed = true;
    this.ap.gsArmed = true;
    this.ap.ilsIcao = icao;
    this.ap.ilsRwy = rwyIdent;
    this.levelAttitude(g.course);
    this.raFt = Math.max(0, (this.pos.y - this.groundHeightAt(this.pos.x, this.pos.z) - this.getReferenceHeight()) / C.FT);
    return this;
  };

  /**
   * 从 ilsWorld() 的返回结构中取出跑道入口标高 (英尺)
   * 兼容不同的字段命名, 并保证不会返回 NaN
   */
  function ilsThresholdElevFt(g) {
    var e = g.thresholdElevFt;
    if (e === undefined && g.runway) e = g.runway.elevFt;
    if (e === undefined && g.threshold) e = g.threshold.elevFt;
    if (!isFinite(e)) e = 0;
    return e;
  }
  FS.ilsThresholdElevFt = ilsThresholdElevFt;

  FS.FlightModel = FlightModel;
  FS.Engine = Engine;

  FS.Log.info('flightmodel.js 已加载 — 六自由度飞行动力学就绪');

})(typeof window !== 'undefined' ? window : globalThis);
