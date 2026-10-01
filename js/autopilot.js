/* ==========================================================================
   天际航线 SkyRoute — 自动驾驶 / 飞行管理系统 (autopilot.js)
     · FMS: 航路管理 (LNAV 水平导航 / VNAV 垂直导航 / 性能计算)
     · AP:  自动驾驶仪 (AP1/AP2 + FD + A/THR)
            水平模式: HDG/TRK SEL, NAV, LOC, ROLLOUT
            垂直模式: ALT HOLD, ALT SEL (OP CLB/DES), V/S, FPA, FLCH, VNAV, GS, FLARE
            推力模式: SPEED, MACH, N1, THR CLB, THR IDLE, RETARD
   依赖: utils.js / config.js / flightmodel.js
   ========================================================================== */
(function (global) {
  'use strict';

  var FS = global.FS = global.FS || {};
  var U = FS.Utils;
  var C = FS.CONST;
  var D2R = C.DEG, R2D = C.RAD;

  /* =====================================================================
     一、飞行管理系统 (FMS)
     ===================================================================== */
  /**
   * 航路点: { ident, lat, lon, altFt, spdKt, type:'airport'|'waypoint'|'vor'|'ndb'|'fix'|'runway', flyOver:bool }
   */
  function FMS(fm) {
    this.fm = fm;
    this.route = [];
    this.activeLeg = 0;

    this.origin = null;
    this.destination = null;
    this.alternate = null;
    this.cruiseAltFt = 35000;
    this.costIndex = 30;

    this.directTo = null;      // 直飞目标 (航路点对象)
    this.tempRoute = null;     // 临时航路

    this.todDistanceNm = null;
    this.tocDistanceNm = null;
    this.phase = 'PREFLIGHT';  // PREFLIGHT|TAXI|TAKEOFF|CLIMB|CRUISE|DESCENT|APPROACH|LANDING|DONE

    this.estimatedTimeMin = 0;
    this.computedFuelKg = 0;
    this._lastLeg = -1;
  }

  FMS.prototype.setOrigin = function (icao) {
    var a = FS.Airports.byIcao(icao);
    if (!a) return null;
    this.origin = a;
    return a;
  };
  FMS.prototype.setDestination = function (icao) {
    var a = FS.Airports.byIcao(icao);
    if (!a) return null;
    this.destination = a;
    return a;
  };

  FMS.prototype.clearRoute = function () {
    this.route = [];
    this.activeLeg = 0;
    this.directTo = null;
  };

  FMS.prototype.addWaypoint = function (wp) {
    var w = {
      ident: (wp.ident || 'WPT').toUpperCase(),
      lat: wp.lat, lon: wp.lon,
      altFt: wp.altFt !== undefined ? wp.altFt : null,
      spdKt: wp.spdKt !== undefined ? wp.spdKt : null,
      type: wp.type || 'waypoint',
      flyOver: !!wp.flyOver
    };
    var w2 = FS.Geo.toWorld(w.lat, w.lon);
    w.x = w2.x; w.z = w2.z;
    this.route.push(w);
    return w;
  };

  /** 用 [icao, alt, spd] 数组快速构建航路 */
  FMS.prototype.loadIcaoRoute = function (list) {
    this.clearRoute();
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var icao = typeof it === 'string' ? it : it.icao;
      var a = FS.Airports.byIcao(icao);
      if (!a) { FS.Log.warn('FMS: 未知机场 ' + icao); continue; }
      this.addWaypoint({
        ident: a.icao, lat: a.lat, lon: a.lon,
        altFt: typeof it === 'object' ? it.altFt : null,
        spdKt: typeof it === 'object' ? it.spdKt : null,
        type: 'airport'
      });
    }
    if (this.route.length) {
      this.setOrigin(this.route[0].ident);
      this.setDestination(this.route[this.route.length - 1].ident);
    }
    this.computeProfile();
    return this.route.length;
  };

  /** 生成一条连接出发/到达机场的大圆航路 (含中间等分点) */
  FMS.prototype.buildDirectRoute = function (fromIcao, toIcao, cruiseAltFt, numLegs) {
    var a = FS.Airports.byIcao(fromIcao), b = FS.Airports.byIcao(toIcao);
    if (!a || !b) return 0;
    numLegs = numLegs || 6;
    this.clearRoute();
    this.addWaypoint({ ident: a.icao, lat: a.lat, lon: a.lon, type: 'airport', altFt: a.elevFt });
    var totalNm = FS.Geo.greatCircleNm(a.lat, a.lon, b.lat, b.lon);
    var brg = FS.Geo.greatCircleBearing(a.lat, a.lon, b.lat, b.lon);
    for (var i = 1; i < numLegs; i++) {
      var frac = i / numLegs;
      var p = FS.Geo.greatCircleOffset(a.lat, a.lon, brg, frac * totalNm * C.NM);
      this.addWaypoint({
        ident: a.icao.substring(1) + U.pad(i, 2) ,
        lat: p.lat, lon: p.lon, type: 'waypoint',
        altFt: cruiseAltFt || 35000
      });
    }
    this.addWaypoint({ ident: b.icao, lat: b.lat, lon: b.lon, type: 'airport', altFt: b.elevFt });
    this.setOrigin(a.icao);
    this.setDestination(b.icao);
    this.cruiseAltFt = cruiseAltFt || 35000;
    this.computeProfile();
    return this.route.length;
  };

  FMS.prototype.getActiveWaypoint = function () {
    if (this.directTo) return this.directTo;
    return this.route[this.activeLeg] || null;
  };
  FMS.prototype.getNextWaypoint = function () {
    if (this.directTo) return this.route[this.activeLeg] || null;
    return this.route[this.activeLeg + 1] || null;
  };

  /** 到当前航路点的方位 */
  FMS.prototype.getDesiredTrack = function (fm) {
    var wp = this.getActiveWaypoint();
    if (!wp) return fm.heading;
    return U.wrap360(Math.atan2(wp.x - fm.pos.x, -(wp.z - fm.pos.z)) * R2D);
  };

  /** 偏航距 (m, 右偏为正) */
  FMS.prototype.getCrossTrackError = function (fm) {
    var wp = this.getActiveWaypoint();
    if (!wp) return 0;
    var from = this._legStart || { x: fm.pos.x, z: fm.pos.z };
    var dx = wp.x - from.x, dz = wp.z - from.z;
    var len = Math.hypot(dx, dz);
    if (len < 1) return 0;
    var ux = dx / len, uz = dz / len;
    // 航段右侧法线 (世界系: 右 = 前向顺时针 90°)
    var nx = -uz, nz = ux;
    var px = fm.pos.x - from.x, pz = fm.pos.z - from.z;
    return px * nx + pz * nz;
  };

  FMS.prototype.getDistanceToGo = function (fm) {
    var wp = this.getActiveWaypoint();
    if (!wp) return 0;
    return Math.hypot(wp.x - fm.pos.x, wp.z - fm.pos.z) / C.NM;
  };

  /** 计算整条航路剩余距离 */
  FMS.prototype.getRouteDistanceRemaining = function (fm) {
    var total = 0;
    var prev = { x: fm.pos.x, z: fm.pos.z };
    var start = this.getActiveWaypoint() ? this.activeLeg : this.route.length;
    for (var i = start; i < this.route.length; i++) {
      total += Math.hypot(this.route[i].x - prev.x, this.route[i].z - prev.z);
      prev = this.route[i];
    }
    return total / C.NM;
  };

  /** 性能计算: TOC / TOD / 时间 / 燃油 */
  FMS.prototype.computeProfile = function () {
    var fm = this.fm;
    if (!this.route.length) return;
    var totalNm = 0;
    for (var i = 1; i < this.route.length; i++) {
      totalNm += Math.hypot(this.route[i].x - this.route[i - 1].x,
        this.route[i].z - this.route[i - 1].z) / C.NM;
    }
    this.totalDistanceNm = totalNm;
    var cruise = this.cruiseAltFt || 35000;
    // 爬升: 约 3 nm / 1000 ft + 加速段
    var originElev = (this.origin ? this.origin.elevFt : 0);
    var climbDist = (cruise - originElev) / 1000 * 3.2 + 8;
    var climbTime = (cruise - originElev) / 1000 * 1.35 + 3;
    // 下降: 3 nm / 1000 ft
    var destElev = (this.destination ? this.destination.elevFt : 0);
    var descDist = (cruise - destElev) / 1000 * 3.0 + 6;
    var descTime = (cruise - destElev) / 1000 * 1.15 + 5;
    this.climbDistanceNm = climbDist;
    this.descentDistanceNm = descDist;
    this.tocDistanceNm = U.clamp(climbDist, 0, totalNm * 0.5);
    this.todDistanceNm = U.clamp(totalNm - descDist, totalNm * 0.4, totalNm);

    var cruiseDist = Math.max(0, totalNm - climbDist - descDist);
    var cruiseMach = fm ? fm.ac.perf.cruiseMach : 0.85;
    var gsCruise = cruiseMach * 573;                      // 近似 (kt 真空速)
    var cruiseTime = cruiseDist / Math.max(120, gsCruise) * 60;
    this.estimatedTimeMin = climbTime + cruiseTime + descTime;
    var ff = fm ? fm.estimateCruiseFuelFlow(cruise, cruiseMach, fm.gw) : 5500;
    this.computedFuelKg = ff * (cruiseTime / 60) + ff * 1.6 * ((climbTime + descTime) / 60);
    this._legStart = null;
  };

  FMS.prototype.update = function (dt) {
    var fm = this.fm;
    if (!this.route.length) { this.phase = this.phase; return; }

    var wp = this.getActiveWaypoint();
    if (!wp) { this.phase = 'DONE'; return; }

    // 记录航段起点 (用于偏航距)
    if (this._legStart === null || this._lastLeg !== this.activeLeg) {
      var prevWp = this.route[Math.max(0, this.activeLeg - 1)];
      this._legStart = (this.activeLeg === 0 || this.directTo)
        ? { x: fm.pos.x, z: fm.pos.z }
        : { x: prevWp.x, z: prevWp.z };
      this._lastLeg = this.activeLeg;
      FS.Bus.emit('fms:legChanged', { leg: this.activeLeg, waypoint: wp });
    }

    var distNm = this.getDistanceToGo(fm);

    // 航路点切换 (fly-by 提前量)
    var turnRadiusNm = 0;
    if (this.activeLeg + 1 < this.route.length) {
      var nxt = this.route[this.activeLeg + 1];
      var brgChange = Math.abs(U.wrap180(
        Math.atan2(nxt.x - wp.x, -(nxt.z - wp.z)) * R2D -
        Math.atan2(wp.x - this._legStart.x, -(wp.z - this._legStart.z)) * R2D));
      turnRadiusNm = (fm.tasKt / 60) * 0.6 * (brgChange / 90) * 1.1;
    }
    var seqDist = wp.flyOver ? 0.05 : Math.max(0.12, turnRadiusNm);
    if (distNm < seqDist) {
      if (this.directTo) {
        // 直飞切入后回到正常航路
        this.directTo = null;
        this._legStart = { x: wp.x, z: wp.z };
        this.activeLeg++;
      } else if (this.activeLeg < this.route.length - 1) {
        var prev = this.route[this.activeLeg];
        this.activeLeg++;
        this._legStart = { x: prev.x, z: prev.z };
      } else {
        this.phase = 'APPROACH';
      }
      this._lastLeg = -1;
      FS.Bus.emit('fms:waypointSequenced', { leg: this.activeLeg });
    }

    // 飞行阶段判定
    var aglFt = fm.aglFt;
    if (fm.onGround && fm.gs < 2) this.phase = 'PREFLIGHT';
    else if (fm.onGround) this.phase = 'TAXI';
    else if (aglFt < 1500 && fm.vsFpm > 200) this.phase = 'TAKEOFF';
    else if (fm.vsFpm > 200) this.phase = 'CLIMB';
    else if (Math.abs(fm.vsFpm) < 200) this.phase = 'CRUISE';
    else if (fm.vsFpm < -200) this.phase = 'DESCENT';
    if (distNm < 15 && fm.aglFt < 5000) this.phase = 'APPROACH';
    if (fm.onGround && fm.tas < 60) this.phase = 'LANDING';

    this.distanceToGoNm = distNm;
    this.routeRemainingNm = this.getRouteDistanceRemaining(fm);
    this.desiredTrack = this.getDesiredTrack(fm);
    this.crossTrackM = this.getCrossTrackError(fm);
  };

  FMS.prototype.directToWaypoint = function (wp) {
    if (typeof wp === 'string') {
      var a = FS.Airports.byIcao(wp);
      if (!a) return false;
      wp = { ident: a.icao, lat: a.lat, lon: a.lon, type: 'airport' };
    }
    this.addWaypointAt(wp, this.activeLeg);
    this.directTo = this.route[this.activeLeg];
    this._lastLeg = -1;
    FS.Bus.emit('fms:directTo', { waypoint: this.directTo });
    return true;
  };

  FMS.prototype.addWaypointAt = function (wp, index) {
    var w2 = FS.Geo.toWorld(wp.lat, wp.lon);
    var w = {
      ident: (wp.ident || 'WPT').toUpperCase(), lat: wp.lat, lon: wp.lon,
      altFt: wp.altFt || null, spdKt: wp.spdKt || null,
      type: wp.type || 'waypoint', flyOver: !!wp.flyOver,
      x: w2.x, z: w2.z
    };
    this.route.splice(index, 0, w);
    return w;
  };

  /* =====================================================================
     二、自动驾驶仪
     ===================================================================== */
  function Autopilot(fm) {
    this.fm = fm;
    this.ap = fm.ap;

    /* --- 横向 --- */
    this.rollPID = new FS.PID(0.055, 0.0016, 0.020, { iMin: -0.5, iMax: 0.5, outMin: -1, outMax: 1 });
    this.hdgPID = new FS.PID(0.035, 0.0006, 0.012, { iMin: -0.4, iMax: 0.4, outMin: -30, outMax: 30 });
    this.navPID = new FS.PID(0.0011, 0.00004, 0.0009, { iMin: -0.6, iMax: 0.6, outMin: -30, outMax: 30 });
    this.locPID = new FS.PID(0.00016, 0.000002, 0.00016, { iMin: -1, iMax: 1, outMin: -30, outMax: 30 });

    /* --- 纵向 --- */
    this.altPID = new FS.PID(0.00125, 0.000006, 0.0022, { iMin: -3000, iMax: 3000, outMin: -4200, outMax: 4200 });
    this.vsPID = new FS.PID(0.0022, 0.00006, 0.0004, { iMin: -1.2, iMax: 1.2, outMin: -8, outMax: 8 });
    this.pitchPID = new FS.PID(0.058, 0.0022, 0.020, { iMin: -0.5, iMax: 0.5, outMin: -1, outMax: 1 });

    /* --- 自动油门 --- */
    this.spdPID = new FS.PID(0.022, 0.0016, 0.004, { iMin: -0.4, iMax: 0.6, outMin: -0.5, outMax: 0.6 });
    this.machPID = new FS.PID(9.5, 0.7, 1.5, { iMin: -0.4, iMax: 0.6, outMin: -0.5, outMax: 0.6 });

    /* --- 状态 --- */
    this.lastMode = '';
    this.apEngageTime = 0;
    this.disconnectReason = '';
    this.toga = false;
    this.flareArmed = false;
    this._flarePitch = 0;
    this.landMode = null;      // 'LOC' | 'GS' | 'FLARE' | 'ROLLOUT'
    this.locCaptured = false;
    this.gsCaptured = false;
    this.lastLocDev = 0;
    this.lastGsDev = 0;
    this.altCaptureArmed = false;
    this.vsCommand = 0;
    this.pitchCommand = 0;
    this.throttleCmd = 0;
    this.athrActive = false;
    this._prevGs = 0;
    this._flareStartAlt = null;
  }

  /* ---------------- 模式控制 ---------------- */
  Autopilot.prototype.engage = function (which) {
    var ap = this.ap;
    if (this.fm.warnings.stall || this.fm.warnings.overspeed) {
      this.disconnect('保护限制');
      return false;
    }
    ap.engaged = true;
    if (which === 2) ap.ap2 = true; else ap.ap1 = true;
    if (!ap.pitchMode) ap.pitchMode = 'ALT';
    if (!ap.rollMode) ap.rollMode = 'HDG';
    if (ap.targetAltFt === null) ap.targetAltFt = Math.round(this.fm.altFt / 100) * 100;
    if (ap.targetHdg === null) ap.targetHdg = U.wrap360(Math.round(this.fm.heading));
    this.apEngageTime = this.fm.time;
    ap.mode = 'ENGAGED';
    FS.Bus.emit('ap:engaged', { which: which });
    FS.Audio.playCue('autopilot_engage');
    return true;
  };

  Autopilot.prototype.disengage = function (reason) {
    var ap = this.ap;
    if (!ap.engaged) return;
    ap.engaged = false;
    ap.ap1 = ap.ap2 = false;
    ap.athr = false;
    ap.mode = 'OFF';
    this.disconnectReason = reason || '人工断开';
    this.rollPID.reset(); this.altPID.reset(); this.vsPID.reset(); this.pitchPID.reset();
    this.pitchInt = 0;
    FS.Bus.emit('ap:disengaged', { reason: this.disconnectReason });
    FS.Audio.playCue('ap_disconnect');
  };

  Autopilot.prototype.toggle = function () {
    if (this.ap.engaged) this.disengage('人工断开'); else this.engage(1);
  };

  Autopilot.prototype.setTargetAlt = function (ft) {
    if (!isFinite(ft)) return this.ap.targetAltFt;
    this.ap.targetAltFt = U.clamp(Math.round(ft), -2000, 60000);
    this.altPID.reset(); this.vsPID.reset();
    this.altCaptureArmed = false;
    FS.Bus.emit('ap:targetAlt', { ft: this.ap.targetAltFt });
    return this.ap.targetAltFt;
  };
  Autopilot.prototype.setTargetHdg = function (deg) {
    if (!isFinite(deg)) return this.ap.targetHdg;
    this.ap.targetHdg = U.wrap360(deg);
    return this.ap.targetHdg;
  };
  Autopilot.prototype.setTargetVs = function (fpm) {
    if (!isFinite(fpm)) return this.ap.targetVsFpm;
    this.ap.targetVsFpm = U.clamp(fpm, -6000, 6000);
    this.vsPID.reset();
    return this.ap.targetVsFpm;
  };
  Autopilot.prototype.setTargetSpeed = function (kt) {
    if (!isFinite(kt)) return this.ap.targetIas;
    this.ap.targetIas = U.clamp(kt, 90, 400);
    this.spdPID.reset();
    this.ap.targetMach = null;
    return this.ap.targetIas;
  };
  Autopilot.prototype.setTargetMach = function (m) {
    if (!isFinite(m)) return this.ap.targetMach;
    this.ap.targetMach = U.clamp(m, 0.4, 0.92);
    this.machPID.reset();
    this.ap.targetIas = null;
    return this.ap.targetMach;
  };

  /** 模式按键 */
  Autopilot.prototype.setRollMode = function (mode) {
    this.ap.rollMode = mode;
    if (mode !== 'NAV') this.ap.navArmed = false;
    FS.Bus.emit('ap:mode', { rollMode: mode });
  };
  Autopilot.prototype.setPitchMode = function (mode) {
    this.ap.pitchMode = mode;
    this.pitchInt = 0;
    this._lastPitchTarget = undefined;
    this.altPID.reset(); this.vsPID.reset(); this.pitchPID.reset();
    this.altCaptureArmed = false;
    FS.Bus.emit('ap:mode', { pitchMode: mode });
  };
  Autopilot.prototype.setThrustMode = function (mode) {
    this.ap.thrustMode = mode;
    this.ap.athr = (mode === 'SPEED' || mode === 'MACH');
    FS.Bus.emit('ap:mode', { thrustMode: mode });
  };

  Autopilot.prototype.armAppr = function (on) {
    this.ap.apprArmed = !!on;
    if (on) {
      this.ap.locArmed = true; this.ap.gsArmed = true;
      this.locCaptured = false; this.gsCaptured = false;
    }
  };

  Autopilot.prototype.goAround = function () {
    this.toga = true;
    var fm = this.fm;
    fm.setFlapDetent(Math.max(1, Math.floor(fm.ac.flaps.length / 4)));
    fm.setGear(false);
    this.setPitchMode('TOGA');
    this.setRollMode('HDG');
    this.ap.thrustMode = 'TOGA';
    this.ap.athr = true;
    this.setTargetAlt(Math.max(3000, Math.round(fm.altFt / 1000) * 1000 + 3000));
    if (!this.ap.engaged) this.engage(1);
    FS.Bus.emit('ap:goAround');
    FS.Audio.playCue('chime_low');
  };

  /* ---------------- 每帧更新 ---------------- */
  Autopilot.prototype.update = function (dt) {
    var fm = this.fm, ap = this.ap;
    if (dt <= 0) return;

    this.updateFMS(dt);
    this._checkProtections(dt);

    // 手动操纵杆会断开自动驾驶 (优先级高于 AP)
    if (fm.pilotOverride) {
      if (ap.engaged) this.disengage('人工超控');
    }

    var cmd = fm.apCmd;
    cmd.active = ap.engaged;
    cmd.athrActive = ap.athr;

    if (!ap.engaged) {
      // 未接通时仅提供 FD 指引和偏航阻尼
      this._updateFlightDirector(dt);
      cmd.elevator = 0; cmd.aileron = 0; cmd.rudder = this._yawDamper();
      if (ap.athr && ap.thrustMode === 'SPEED') this._autoThrottle(dt);
      return;
    }

    this._lateral(dt);
    this._vertical(dt);
    this._autoThrottle(dt);
    cmd.rudder = this._yawDamper();
    this._publishModes();
  };

  Autopilot.prototype.updateFMS = function (dt) {
    if (this.fm.fms) this.fm.fms.update(dt);
  };

  Autopilot.prototype._yawDamper = function () {
    var fm = this.fm;
    if (!fm.ap.yawDamper) return 0;
    var r = fm.rates.r, beta = fm.beta;
    return U.clamp(-r * 0.85 + beta * 1.1, -0.85, 0.85);
  };

  /* ---------------- 保护 ---------------- */
  Autopilot.prototype._checkProtections = function (dt) {
    var fm = this.fm, ap = this.ap;
    if (!ap.engaged) { this._protTimer = 0; return; }
    // 只有在接通 3 秒之后, 且告警持续 1.5 秒以上才自动断开,
    // 避免瞬时迎角尖峰 (例如接地弹跳或大气扰动) 误触发断开
    var active = fm.warnings.stall || (fm.iasKt > fm.ac.perf.vmo + 8);
    if (active) this._protTimer = (this._protTimer || 0) + dt;
    else this._protTimer = 0;
    if (this._protTimer > 1.5 && (fm.time - this.apEngageTime) > 3) {
      this.disengage(fm.warnings.stall ? '失速保护' : '超速保护');
      this._protTimer = 0;
    }
  };

  /* ---------------- FD 指引 (未接通 AP 时也计算) ---------------- */
  Autopilot.prototype._updateFlightDirector = function (dt) {
    var fm = this.fm;
    var rollCmd = this._computeLateralTarget(dt);
    var pitchCmd = this._computeVerticalTarget(dt);
    fm.fdRoll = -U.clamp(rollCmd / 30, -1, 1) * 0;
    fm.fdBars = {
      rollDeg: rollCmd,
      pitchDeg: pitchCmd
    };
  };

  /* ---------------- 横向控制 ---------------- */
  Autopilot.prototype._computeLateralTarget = function (dt) {
    var fm = this.fm, ap = this.ap;
    var bankCmd = 0;
    var maxBank = 25;

    /* ---- APPR 预位时自动截获航向道 ---- */
    if (ap.apprArmed && !this.locCaptured && ap.ilsIcao) {
      var ilsA = this._getILS();
      if (ilsA) {
        var devA = U.clamp(ilsA.locDdm, -2.5, 2.5);
        this.lastLocDev = devA;
        this.lastGsDev = U.clamp(ilsA.gsDdm, -2.5, 2.5);
        var crsErrA = U.wrap180(ilsA.course - fm.heading);
        if (Math.abs(devA) < 0.55 && Math.abs(crsErrA) < 50 &&
          ilsA.distNm < 26 && ilsA.distNm > -2) {
          this.locCaptured = true;
          this.landMode = 'LOC';
          ap.rollMode = 'LOC';
          FS.Bus.emit('ap:locCaptured');
          FS.Audio.playCue('chime');
        }
      }
    }

    var mode = ap.rollMode || 'HDG';

    if (this.landMode === 'ROLLOUT') {
      // 着陆滑跑: 用方向舵保持跑道中心线
      var rwyHdg = this._rolloutHdg || fm.heading;
      var err = U.wrap180(rwyHdg - fm.heading);
      bankCmd = 0;
      ap.rolloutRudder = U.clamp(err * 0.035 + (this._rolloutTrackErr || 0) * 0.0012, -1, 1);
      return 0;
    }

    switch (mode) {
      case 'HDG':
      case 'TRK':
        this.locCaptured = false;
        var hdgErr = U.wrap180(ap.targetHdg - fm.heading);
        // 坡度指令 = 航向误差 -> 目标坡度
        var desiredBank = U.clamp(hdgErr * 1.6, -maxBank, maxBank);
        // 阻尼
        bankCmd = desiredBank - fm.rates.p * R2D * 0.85;
        break;

      case 'NAV':
      case 'LNAV':
        if (fm.fms) {
          var xte = fm.fms.crossTrackM;
          var xtNm = xte / C.NM;
          var desiredTrack = fm.fms.desiredTrack !== undefined ? fm.fms.desiredTrack : fm.heading;
          var trackErr = U.wrap180(desiredTrack - fm.track);
          // 经典 LNAV: 坡度 = atan( 偏航距增益 + 航迹角误差增益 )
          var bankFromXte = U.clamp(Math.atan2(xtNm * 0.055, 1) * R2D * 1.8, -maxBank, maxBank);
          var bankFromTrack = U.clamp(trackErr * 2.2, -maxBank, maxBank);
          bankCmd = U.clamp(bankFromXte + bankFromTrack, -maxBank, maxBank);
          bankCmd -= fm.rates.p * R2D * 0.7;
        } else {
          this.setRollMode('HDG');
        }
        break;

      case 'LOC':
        var loc = this._getILS();
        if (!loc) { bankCmd = 0; break; }
        var devDdm = U.clamp(loc.locDdm, -1.6, 1.6);   // 正 = 需向右飞
        this.lastLocDev = devDdm;
        var crsErr = U.wrap180(loc.course - fm.heading);
        bankCmd = U.clamp(devDdm * 16 + crsErr * 0.9 - fm.rates.p * R2D * 0.7, -maxBank, maxBank);
        // LOC 捕获
        if (!this.locCaptured && Math.abs(devDdm) < 0.55 && Math.abs(crsErr) < 40 && loc.distNm < 22) {
          this.locCaptured = true;
          this.landMode = 'LOC';
          FS.Bus.emit('ap:locCaptured');
          FS.Audio.playCue('chime');
        }
        break;

      case 'ROLL':
        bankCmd = U.clamp(ap.rollTargetDeg || 0, -maxBank, maxBank);
        break;

      case 'TOGA':
        bankCmd = 0;    // 保持机翼水平
        break;

      default:
        bankCmd = U.clamp(U.wrap180((ap.targetHdg || fm.heading) - fm.heading) * 1.6, -maxBank, maxBank);
    }
    return bankCmd;
  };

  Autopilot.prototype._lateral = function (dt) {
    var fm = this.fm, ap = this.ap;
    var bankCmd = this._computeLateralTarget(dt);

    // 坡度 -> 副翼 (通过滚转速率指令)
    var rollErr = U.wrap180(bankCmd - fm.roll * R2D);
    var pCmd = U.clamp(rollErr * 0.055, -0.30, 0.30);           // rad/s
    var pErr = pCmd - fm.rates.p;
    var aileron = U.clamp(pErr * 1.9, -1, 1);

    // 协调转弯方向舵 (转弯中需要蹬舵)
    var turnCoord = Math.tan(U.clamp(fm.roll, -0.9, 0.9)) * 0 + 0;

    fm.apCmd.aileron = aileron;
    ap.lastBankCmd = bankCmd;
    ap.lastAileron = aileron;
  };

  /* ---------------- 垂直控制 ---------------- */
  Autopilot.prototype._computeVerticalTarget = function (dt) {
    var fm = this.fm, ap = this.ap;
    var mode = ap.pitchMode || 'ALT';
    // 使用无线电高度 (机轮离地高度) 而非参考点高度
    var aglFt = fm.raFt !== undefined ? fm.raFt : fm.aglFt;

    /* ---- 航向道截获后自动截获下滑道 ---- */
    if (this.locCaptured && !this.gsCaptured && ap.apprArmed && ap.ilsIcao && mode !== 'GS') {
      var ilsG = this._getILS();
      if (ilsG) {
        var gdev = ilsG.glideslopeDeviationFt;      // 高于下滑道为正
        this.lastGsDev = U.clamp(ilsG.gsDdm, -2.5, 2.5);
        if (gdev < 80 && gdev > -40 && ilsG.distNm < 24 && ilsG.distNm > 0.4) {
          this.gsCaptured = true;
          this.landMode = 'GS';
          ap.pitchMode = 'GS';
          mode = 'GS';
          // 截获下滑道时同步速度目标 (若尚未设定)
          if (!ap.athr) { ap.athr = true; ap.thrustMode = 'SPEED'; }
          if (ap.targetIas === null || ap.targetIas === undefined) {
            ap.targetIas = fm.getVSpeeds().Vapp;
          }
          FS.Bus.emit('ap:gsCaptured');
          FS.Audio.playCue('chime');
        }
      }
    }

    // 着陆拉平 (自动着陆的最后阶段)
    if (this.landMode === 'FLARE' || (this.gsCaptured && aglFt < 55 && fm.vsFpm < -60)) {
      if (this.landMode !== 'FLARE') {
        this.landMode = 'FLARE';
        this._flareStartAlt = aglFt;
        this._flarePitch = fm.pitchDeg;      // 从当前姿态开始柔和拉平
        FS.Bus.emit('ap:flare');
      }
      /* 拉平律: 让下沉率沿高度剖面平滑收敛到接地值。
         直接以"下沉率误差"修正俯仰角, 比固定抬头角更能适应不同的
         进近下沉率与重量。                                            */
      /* 目标下沉率剖面: 在 55 ft 处与进近下沉率衔接, 到接地时收敛到约 -40 fpm。
         俯仰角以受限速率跟随该剖面, 形成"先保持、再柔和带杆"的拉平轨迹,
         既不会拉飘也不会砸地。                                          */
      var rated = U.clamp01(aglFt / 55);
      var targetVs = -40 - 710 * Math.pow(rated, 1.6);
      var vsErrF = targetVs - fm.vsFpm;
      this._flarePitch = U.clamp(
        this._flarePitch + U.clamp(vsErrF * 0.011, -2.2, 2.2) * dt, -14, 9.0);
      ap.flareThrottleIdle = true;
      return this._flarePitch;
    }

    if (this.landMode === 'ROLLOUT' || (fm.onGround && this.gsCaptured)) {
      this.landMode = 'ROLLOUT';
      this._rolloutHdg = this._rolloutHdg || fm.heading;
      return 0;
    }

    var gammaCmdDeg = 0;
    switch (mode) {
      case 'ALT':
      case 'ALT HOLD':
        if (ap.targetAltFt === null) ap.targetAltFt = Math.round(fm.altFt / 100) * 100;
        var altErr = ap.targetAltFt - fm.altFt;
        var vsDemand = U.clamp(altErr * 1.9 - fm.vsFpm * 0.42, -2600, 2600);
        if (Math.abs(altErr) < 25) vsDemand = U.clamp(vsDemand, -220, 220);
        gammaCmdDeg = this._vsToGamma(vsDemand);
        break;

      case 'ALT SEL':
        if (ap.targetAltFt === null) ap.targetAltFt = Math.round(fm.altFt / 100) * 100;
        if (ap.targetIas === null && ap.targetMach === null) {
          // 未选择速度时按爬升经济速度自动设定
          if (fm.altFt < 10000) ap.targetIas = 250;
          else ap.targetMach = fm.ac.perf.cruiseMach;
        }
        var ae = ap.targetAltFt - fm.altFt;
        if (Math.abs(ae) < 40) {
          this.setPitchMode('ALT');
          gammaCmdDeg = this._vsToGamma(-fm.vsFpm * 0.5);
        } else {
          var climbLimit = ae > 0 ? 2600 : -3200;
          var vd = U.clamp(ae * 1.7 - fm.vsFpm * 0.45, Math.min(0, climbLimit), Math.max(0, climbLimit));
          gammaCmdDeg = this._vsToGamma(vd);
        }
        break;

      case 'VS':
        var vsErr = ap.targetVsFpm - fm.vsFpm;
        gammaCmdDeg = this._vsToGamma(ap.targetVsFpm) + U.clamp(vsErr * 0.0016, -2.5, 2.5);
        break;

      case 'FPA':
        gammaCmdDeg = ap.targetFpaDeg || 0;
        break;

      case 'FLCH':
      case 'SPD':
        // 用俯仰保持速度, 推力保持目标速度 (或反之)
        var spdErr = this._speedError(fm);
        gammaCmdDeg = -U.clamp(spdErr * 0.14, -6.5, 6.5);
        break;

      case 'VNAV':
        var vnavGamma = this._vnavProfile(fm);
        gammaCmdDeg = vnavGamma;
        break;

      case 'GS':
        var loc = this._getILS();
        if (!loc) {
          // 尚未截获, 保持高度
          gammaCmdDeg = this._vsToGamma(-fm.vsFpm * 0.6);
          break;
        }
        var ddm = U.clamp(loc.gsDdm, -1.6, 1.6);      // 正 = 需向上飞
        this.lastGsDev = ddm;
        // 跟踪下滑道: 基准是 -gsAngle, 偏差项修正
        gammaCmdDeg = -loc.gsAngleDeg + U.clamp(ddm * 3.2 - fm.rates.q * R2D * 0.30, -4.5, 4.5);
        break;

      case 'TOGA':
        gammaCmdDeg = 12;
        break;

      case 'OFF':
      default:
        gammaCmdDeg = this._vsToGamma(-fm.vsFpm * 0.8);
    }

    /* ---- 速度保护 ----
       爬升时为保持目标速度而牺牲爬升率 (真实飞机在 ALT/VS 模式下也有此保护),
       避免高空推力不足时拉杆拉到失速。                                    */
    var spdErrProt = this._speedError(fm);
    var hasSpdTarget = (ap.targetIas !== null && ap.targetIas !== undefined) ||
      (ap.targetMach !== null && ap.targetMach !== undefined);
    if (hasSpdTarget && mode !== 'FLCH' && mode !== 'SPD' && mode !== 'GS') {
      // 注意: _speedError 的符号是 (目标速度 - 当前速度), 因此"太慢"为正
      if (gammaCmdDeg > 0 && spdErrProt > 6) {
        // 速度低于目标 6 kt 开始减小爬升角, 低 36 kt 时改为下降以恢复速度
        var over = U.clamp01((spdErrProt - 6) / 30);
        gammaCmdDeg = gammaCmdDeg * (1 - over) - 3.0 * over;
      } else if (gammaCmdDeg < 0 && spdErrProt < -12) {
        // 超速时减小下降角
        var over2 = U.clamp01((-spdErrProt - 12) / 30);
        gammaCmdDeg = gammaCmdDeg * (1 - over2) + 2.5 * over2;
      }
    }

    var pitchTarget = gammaCmdDeg + fm.alphaDeg;
    // 姿态限制 (民航客机正常法则的俯仰限制)
    pitchTarget = U.clamp(pitchTarget, -12, 22);
    // 指令速率限制: 俯仰指令每秒最多变化 4°, 避免触发过大的机动载荷
    if (this._lastPitchTarget === undefined) this._lastPitchTarget = pitchTarget;
    var maxRate = (this.landMode === 'FLARE' || mode === 'GS') ? 3.0 : 4.5;
    pitchTarget = U.clamp(pitchTarget,
      this._lastPitchTarget - maxRate * dt, this._lastPitchTarget + maxRate * dt);
    this._lastPitchTarget = pitchTarget;
    ap.lastPitchCmd = pitchTarget;
    ap.lastGamma = gammaCmdDeg;

    // 高速保护: 接近 VMO/MMO 时俯仰下压
    var vmoMargin = fm.ac.perf.vmo - fm.iasKt;
    var mmoMargin = (fm.ac.perf.mmo - fm.mach) * 600;
    var margin = Math.min(vmoMargin, mmoMargin);
    if (margin < 15) {
      pitchTarget = Math.min(pitchTarget, U.lerp(-4, pitchTarget, U.clamp01(margin / 15 + 0.05)));
    }
    return pitchTarget;
  };

  Autopilot.prototype._vsToGamma = function (vsFpm) {
    var fm = this.fm;
    var vKt = Math.max(80, fm.tasKt);
    var sinG = vsFpm / (vKt * 101.27);
    return Math.asin(U.clamp(sinG, -0.42, 0.42)) * R2D;
  };

  Autopilot.prototype._speedError = function (fm) {
    var ap = this.ap;
    // 统一换算成"等效节" (巡航高度 0.01 马赫约等于 6 节)
    if (ap.targetMach !== null && ap.targetMach !== undefined) {
      return (ap.targetMach - fm.mach) * 600;
    }
    if (ap.targetIas !== null && ap.targetIas !== undefined) {
      return ap.targetIas - fm.iasKt;
    }
    return 0;
  };

  Autopilot.prototype._vertical = function (dt) {
    var fm = this.fm, ap = this.ap;
    var pitchTarget = this._computeVerticalTarget(dt);
    var pitchErr = U.wrap180(pitchTarget - fm.pitch * R2D);
    var q = fm.rates.q;

    /* 升降舵通道: 俯仰角比例 + 角速率阻尼 + 积分(自动配平)
       舵面效能与动压成正比, 因此增益必须按动压归一化, 否则低速时操纵
       不足、高速时又会振荡。                                          */
    var qbar = Math.max(150, fm.qbar);
    // 舵面产生的俯仰角加速度 ≈ (qbar·S·c̄·|Cm_δe| / Iyy) · δe, 因此增益必须
    // 按动压归一化, 才能在整个速度包线内保持一致的闭环特性。
    var refQbar = 0.5 * C.RHO0 * Math.pow(170 * C.KT, 2);   // 170 kt 基准
    var auth = U.clamp(refQbar / qbar, 0.50, 3.0);

    // 积分项 (自动配平): 抵消推力抬头力矩、襟翼/起落架力矩与配平偏差
    this.pitchInt = this.pitchInt || 0;
    if (fm.onGround && fm.gs < 30) {
      this.pitchInt = 0;
    } else {
      this.pitchInt += pitchErr * dt * 0.022;
      if (Math.abs(pitchErr) > 25) this.pitchInt *= 0.98;     // 抗积分饱和
      this.pitchInt = U.clamp(this.pitchInt, -0.90, 0.90);
    }

    /* 俯仰角速率指令 + 角速率反馈 (内环) —— 结构上自带阻尼, 不会出现
       角速率正反馈导致的等幅振荡。
       符号约定: 升降舵正值 = 后缘向下 = 低头力矩; 正俯仰角速率 = 抬头。 */
    var qCmd = U.clamp(pitchErr * 0.28, -0.145, 0.145);     // 期望俯仰角速率 rad/s
    var qErr = qCmd - q;
    var elevCmd = -qErr * 1.55 * auth - this.pitchInt;      // 需要抬头 -> 负升降舵
    elevCmd = U.clamp(elevCmd, -1, 1);
    fm.apCmd.elevator = elevCmd;
    ap.lastElevator = elevCmd;
    ap.lastPitchErr = pitchErr;

    /* 自动配平: 慢速把残余舵面偏度转移到水平安定面配平通道,
       模拟 Airbus 的自动配平 / 波音的安定面配平                    */
    if (ap.engaged && Math.abs(fm.rates.q) < 0.12) {
      var share = U.clamp(dt * 0.10, 0, 0.05);
      fm.surfaces.elevatorTrim = U.clamp(
        fm.surfaces.elevatorTrim + elevCmd * share, -1, 1);
    }
  };

  /* ---------------- 自动油门 ---------------- */
  Autopilot.prototype._autoThrottle = function (dt) {
    var fm = this.fm, ap = this.ap;
    var mode = ap.thrustMode || 'SPEED';
    var target = 0;

    switch (mode) {
      case 'SPEED':
        target = this._throttleFromSpeed(dt, ap.targetIas || fm.iasKt);
        break;
      case 'MACH':
        target = this._throttleFromMach(dt, ap.targetMach || fm.mach);
        break;
      case 'THR CLB':
        target = 0.92 * (this._n1ToLever(fm, 92));
        break;
      case 'THR IDLE':
        target = 0;
        break;
      case 'TOGA':
        target = 1.0;
        break;
      case 'RETARD':
        target = 0;
        break;
      default:
        target = this.throttleCmd;
    }

    // 拉平时收油门
    if (this.landMode === 'FLARE' || this.landMode === 'ROLLOUT') target = 0;

    // 限幅与速率限制
    target = U.clamp01(target);
    var rate = 0.55;
    this.throttleCmd = U.moveTowards(this.throttleCmd, target, rate * dt);
    ap.athr = true;
    fm.apCmd.athrThrottle = this.throttleCmd;
    ap.athrTarget = target;
  };

  /**
   * 推力前馈: 由所需的推力反解出油门杆位置
   * 使用与发动机模型完全相同的推力衰减规律, 因此稳态几乎没有静差,
   * 速度环只需很小的比例/积分增益来修正。
   */
  Autopilot.prototype._thrustFeedForwardLever = function (fm, targetThrustN) {
    var e = fm.ac.engines;
    var perEngine = Math.max(0, targetThrustN) / Math.max(1, e.count);
    var sigma = fm.sigma || 1;
    var machFactor = Math.max(0.22, 1 - 0.40 * Math.sqrt(Math.max(0, fm.mach)));
    var densityFactor = Math.pow(Math.max(0.02, sigma), 0.95);
    var base = e.maxThrust * densityFactor * machFactor;
    if (base < 1) return 0;
    var n1Factor = perEngine / base;
    var n1n = Math.pow(Math.max(0, (n1Factor - 0.030) / 0.970), 1 / 1.45);
    return U.clamp01(n1n);
  };

  /** 当前状态维持飞行所需的推力 (阻力 + 重力沿航迹分量) */
  Autopilot.prototype._requiredThrust = function (fm) {
    var gamma = fm.pitch - fm.alpha;
    var drag = fm.dragN || 0;
    var gcomp = fm.gw * C.G0 * Math.sin(gamma);
    return drag + gcomp;
  };

  Autopilot.prototype._throttleFromSpeed = function (dt, targetIas) {
    var fm = this.fm;
    var err = targetIas - fm.iasKt;
    var ff = this._thrustFeedForwardLever(fm, this._requiredThrust(fm));
    // 速度误差 -> 油门增量 (减速时更积极收油门)
    var kp = err < 0 ? 0.020 : 0.016;
    var delta = U.clamp(err * kp, -0.42, 0.42);
    var out = ff + delta + this.spdPID.update(err, dt) * 0.22;
    return U.clamp01(out);
  };

  Autopilot.prototype._throttleFromMach = function (dt, targetMach) {
    var fm = this.fm;
    var err = (targetMach - fm.mach) * 600;      // 换算成"等效节"
    var ff = this._thrustFeedForwardLever(fm, this._requiredThrust(fm));
    var kp = err < 0 ? 0.020 : 0.016;
    var delta = U.clamp(err * kp, -0.42, 0.42);
    var out = ff + delta + this.machPID.update(err, dt) * 0.22;
    return U.clamp01(out);
  };

  /** 根据目标 N1 反解油门杆位置 */
  Autopilot.prototype._n1ToLever = function (fm, targetN1) {
    var e = fm.ac.engines;
    var n1n = (targetN1 - e.n1Idle) / (e.n1Max - e.n1Idle);
    return Math.pow(U.clamp01(n1n), 1 / 1.45);
  };

  /* ---------------- ILS 偏差计算 ---------------- */
  Autopilot.prototype._getILS = function () {
    var fm = this.fm;
    var ap = this.ap;
    if (!ap.ilsIcao || !ap.ilsRwy) return null;
    var ils = FS.Airports.ilsWorld(ap.ilsIcao, ap.ilsRwy);
    if (!ils) return null;

    var courseRad = ils.course * D2R;
    var dx = fm.pos.x - ils.threshold.x;
    var dz = fm.pos.z - ils.threshold.z;
    // 沿跑道方向 (向前) 与横向
    var fwdX = Math.sin(courseRad), fwdZ = -Math.cos(courseRad);
    var rgtX = Math.cos(courseRad), rgtZ = Math.sin(courseRad);
    var along = dx * fwdX + dz * fwdZ;          // 入口之后为正 (已飞过入口)
    var lateral = dx * rgtX + dz * rgtZ;        // 中心线右侧为正
    // 到入口的距离: 进近时为正
    var distFromThrM = -along;
    var distNm = distFromThrM / C.NM;

    // 下滑道高度: 入口高度 + tan(gs) * 距入口距离
    var gsRad = ils.gsAngle * D2R;
    var thrElevFt = FS.ilsThresholdElevFt ? FS.ilsThresholdElevFt(ils) : 0;
    var expectedAltM = thrElevFt * C.FT + Math.max(0, distFromThrM) * Math.tan(gsRad);
    var devFt = (fm.pos.y - expectedAltM) / C.FT;    // 高于下滑道为正

    // 航向道波束宽度: 入口处约 ±210 m, 随距离线性扩大
    var locWidthM = 210 + Math.max(0, distFromThrM) * 0.0275;

    return {
      ils: ils,
      course: ils.course,
      gsAngleDeg: ils.gsAngle,
      distNm: distNm,
      alongM: along,
      lateralM: lateral,                      // 飞机相对中心线: 偏右为正
      localizerDeviationM: -lateral,          // 应飞方向: 需向右飞为正
      locWidthM: locWidthM,
      locDdm: -lateral / Math.max(1, locWidthM),
      glideslopeDeviationFt: devFt,           // 高于下滑道为正
      gsDdm: -devFt / 55,                     // 应飞方向: 需向上飞为正
      thresholdElevFt: thrElevFt,
      ident: ils.identStr || ils.ident,
      freqMHz: ils.freqMHz
    };
  };

  /* ---------------- VNAV 剖面 ---------------- */
  Autopilot.prototype._vnavProfile = function (fm) {
    var ap = this.ap, fms = fm.fms;
    if (!fms || !fms.route.length) return 0;
    var remaining = fms.getRouteDistanceRemaining(fm);
    var targetAlt = ap.targetAltFt !== null ? ap.targetAltFt : (fms.cruiseAltFt || 35000);

    // 距离-高度剖面 (3:1)
    var requiredAlt = fm.altFt + 0;
    if (ap.vnavTargetAltFt !== null && ap.vnavTargetAltFt !== undefined) {
      var distToTarget = fms.getDistanceToGo(fm);
      var profileAlt = ap.vnavTargetAltFt + distToTarget * 318;   // 每海里约 318 ft
      requiredAlt = Math.min(ap.vnavTargetAltFt + distToTarget * 318, targetAlt);
    }

    var altErr = targetAlt - fm.altFt;
    if (altErr < -150) {
      // 下降到 TOD 剖面
      var desAlt = ap.vnavDescentAltFt !== null && ap.vnavDescentAltFt !== undefined
        ? ap.vnavDescentAltFt + remaining * 0 * 0 : null;
      var gamma = U.clamp(altErr * 0.0016, -3.2, 0);
      return gamma;
    } else if (altErr > 150) {
      return U.clamp(altErr * 0.0008, 0, 3.0);
    }
    return this._vsToGamma(-fm.vsFpm * 0.55);
  };

  /* ---------------- 模式发布 (FMA) ---------------- */
  Autopilot.prototype._publishModes = function () {
    var ap = this.ap, fm = this.fm;
    // 自动高度截获
    if (ap.pitchMode === 'ALT SEL' && ap.targetAltFt !== null) {
      var err = Math.abs(ap.targetAltFt - fm.altFt);
      if (err < 60 && !this.altCaptureArmed) {
        this.altCaptureArmed = true;
        FS.Bus.emit('ap:altCapture');
      }
      if (err < 25) this.setPitchMode('ALT');
    }

    var sig = [ap.engaged, ap.rollMode, ap.pitchMode, ap.thrustMode,
      this.locCaptured, this.gsCaptured, this.landMode].join('|');
    if (sig !== this.lastMode) {
      this.lastMode = sig;
      FS.Bus.emit('ap:fmaChanged', this.getFMA());
    }
  };

  /** 返回 FMA (Flight Mode Annunciator) 三列内容 */
  Autopilot.prototype.getFMA = function () {
    var ap = this.ap, fm = this.fm;
    var thrust = '---', roll = '---', pitch = '---';
    var thrustArmed = '', rollArmed = '', pitchArmed = '';
    var thrustColor = 'auto', rollColor = 'auto', pitchColor = 'auto';

    if (ap.athr || ap.engaged) {
      switch (ap.thrustMode) {
        case 'SPEED': thrust = 'SPEED'; break;
        case 'MACH': thrust = 'MACH'; break;
        case 'THR CLB': thrust = 'THR CLB'; thrustColor = 'auto'; break;
        case 'THR IDLE': thrust = 'THR IDLE'; break;
        case 'TOGA': thrust = 'TOGA'; thrustColor = 'green'; break;
        case 'RETARD': thrust = 'RETARD'; thrustColor = 'amber'; break;
        default: thrust = ap.athr ? 'SPEED' : '---';
      }
      if (ap.thrustMode === 'THR CLB' || ap.thrustMode === 'THR IDLE') thrust += '';
    }

    if (this.landMode === 'ROLLOUT') roll = 'ROLLOUT';
    else if (this.gsCaptured || this.landMode === 'GS' || this.landMode === 'FLARE') {
      roll = this.locCaptured ? 'LOC' : '---';
      pitch = this.landMode === 'FLARE' ? 'FLARE' : (this.gsCaptured ? 'GS' : '---');
    } else if (ap.rollMode === 'NAV' || ap.rollMode === 'LNAV') roll = 'NAV';
    else if (ap.rollMode === 'HDG') roll = 'HDG ' + U.pad(ap.targetHdg || 0, 3);
    else if (ap.rollMode === 'TRK') roll = 'TRK ' + U.pad(ap.targetHdg || 0, 3);
    else if (ap.rollMode === 'LOC') roll = 'LOC';
    else if (ap.rollMode === 'TOGA') roll = 'TOGA';

    if (pitch === '---') {
      switch (ap.pitchMode) {
        case 'ALT': pitch = 'ALT'; break;
        case 'ALT SEL': pitch = (ap.targetAltFt > fm.altFt) ? 'CLB' : 'DES'; break;
        case 'VS': pitch = 'V/S ' + (ap.targetVsFpm >= 0 ? '+' : '-') + U.pad(Math.abs(ap.targetVsFpm), 4); break;
        case 'FPA': pitch = 'FPA ' + (ap.targetFpaDeg >= 0 ? '+' : '-') + Math.abs(ap.targetFpaDeg).toFixed(1); break;
        case 'FLCH': pitch = 'FLCH'; break;
        case 'SPD': pitch = 'SPD'; break;
        case 'VNAV': pitch = 'VNAV'; break;
        case 'TOGA': pitch = 'TOGA'; break;
        default: pitch = 'ALT';
      }
      if (ap.pitchMode === 'ALT SEL') pitch += ' ' + U.pad(Math.round((ap.targetAltFt || 0) / 100), 3);
    }

    // 预位显示
    if (ap.apprArmed && !this.locCaptured) rollArmed = 'LOC';
    if (ap.apprArmed && this.locCaptured && !this.gsCaptured) { pitchArmed = 'GS'; }
    if (ap.rollMode === 'NAV' && !fm.fms) rollColor = 'warn';

    return {
      thrust: thrust, thrustArmed: thrustArmed, thrustColor: thrustColor,
      roll: roll, rollArmed: rollArmed, rollColor: rollColor,
      pitch: pitch, pitchArmed: pitchArmed, pitchColor: pitchColor,
      ap1: ap.ap1, ap2: ap.ap2, athr: ap.athr,
      fd: ap.fd1 || ap.fd2,
      engaged: ap.engaged,
      armed: ap.apprArmed ? 'APPR' : (ap.navArmed ? 'NAV' : '')
    };
  };

  /** 自动着陆能力检查 */
  Autopilot.prototype.canAutoLand = function () {
    var fm = this.fm;
    return fm.ac.systems.hasAutoLand && this.locCaptured && this.gsCaptured &&
      fm.gearPos > 0.95;
  };

  FS.FMS = FMS;
  FS.Autopilot = Autopilot;

  FS.Log.info('autopilot.js 已加载 — 自动驾驶/飞行管理就绪');

})(typeof window !== 'undefined' ? window : globalThis);
