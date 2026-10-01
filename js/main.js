/* ==========================================================================
   飞行模拟器 — 主程序 (main.js)
     渲染循环 / 世界装配 / 场景启动 / 告警系统 / GPWS / TCAS / 音效联动
   ========================================================================== */
(function (global) {
  'use strict';

  var FS = global.FS = global.FS || {};
  var U = FS.Utils;
  var C = FS.CONST;
  var D2R = C.DEG, R2D = C.RAD;

  /* =====================================================================
     Sim 主类
     ===================================================================== */
  function Sim() {
    this.THREE = global.THREE;
    this.ready = false;
    this.running = false;
    this.paused = false;
    this.timeScale = 1;
    this.frame = 0;
    this.fpsHist = new FS.Ring(60);
    this.lastTime = 0;
    this.accumulator = 0;
    this.fixedDt = 1 / FS.CFG.physicsHz;

    this.lights = {
      landing: false, taxi: false, strobe: false, beacon: true,
      nav: true, logo: false, wing: false, cabin: false
    };

    this.traffic = [];
    this.gpws = {
      mode: null, lastCallout: '', calloutTimes: {},
      sinkRate: false, terrain: false, pullUp: false, glideslope: false,
      minimums: 300, lastCallTime: 0
    };
    this.landingConfig = { gearWasDown: false, spoilersAuto: false };

    this._contrailAccum = 0;
    this._statsTimer = 0;
    this._lastFrameErrors = 0;
  }

  /* ---------------------------------------------------------------------
     启动
     --------------------------------------------------------------------- */
  Sim.prototype.boot = function () {
    var THREE = this.THREE;
    if (!THREE) { FS.Log.error('three.js 未加载'); return false; }

    try {
      this._initRenderer();
      this._initScene();
      this._initUI();
      this._bindEvents();
      this.ready = true;
      FS.Log.info('模拟器初始化完成 · WebGL ' + (this.renderer.capabilities.isWebGL2 ? '2' : '1'));
      this.hideLoading();
      this.hud.showMenu();
      this._startLoop();
      return true;
    } catch (e) {
      FS.Log.error('初始化失败: ' + (e && e.message) + '\n' + (e && e.stack));
      var le = global.document.getElementById('loading');
      if (le) {
        le.classList.remove('hidden');
        le.innerHTML = '<div class="err">初始化失败<br><small>' + (e && e.message) + '</small></div>';
      }
      return false;
    }
  };

  Sim.prototype._initRenderer = function () {
    var THREE = this.THREE;
    var canvas = global.document.getElementById('viewport');
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true,
      stencil: false
    });
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(global.innerWidth, global.innerHeight, false);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = true;
    this.renderer.setClearColor(0x87ceeb, 1);
    this.maxDpr = dpr;
  };

  Sim.prototype._initScene = function () {
    var THREE = this.THREE;
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(62, global.innerWidth / global.innerHeight, 0.4, 900000);
    this.camera.position.set(0, 60, 200);

    this.cameraRig = new FS.CameraRig(this.camera, {});
    this.cameraRig.setMode('chase');

    // 环境 (地形/天空/天气)
    FS.Geo.setReference(31.1443, 121.8083);      // 默认参考点 (上海浦东)
    this.env = new FS.Environment(this.scene, this.renderer, {
      seed: 20260101, quality: 'medium', shadows: true
    });

    // 简单的辅助光 (环境模块可能已提供, 这里补齐保证画面不黑)
    if (!this.env.sunLight) {
      this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
      this.sunLight.position.set(0.4, 0.8, 0.3).multiplyScalar(1000);
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(2048, 2048);
      this.sunLight.shadow.camera.near = 1;
      this.sunLight.shadow.camera.far = 4000;
      this.sunLight.shadow.camera.left = -300;
      this.sunLight.shadow.camera.right = 300;
      this.sunLight.shadow.camera.top = 300;
      this.sunLight.shadow.camera.bottom = -300;
      this.scene.add(this.sunLight);
      this.scene.add(this.sunLight.target);
    } else {
      this.sunLight = this.env.sunLight;
      // environment.js 自带完整的光照体系, 不要再叠加补光, 否则夜间会亮如白昼
    }
  };

  Sim.prototype._initUI = function () {
    var doc = global.document;
    this.scenarioMgr = new FS.ScenarioManager();
    this.checklistMgr = new FS.ChecklistManager();
    this.fms = new FS.FMS(null);

    // 输入系统
    this.input = new FS.Input(global, {});
    this.input.mouseMode = 'look';

    this.hud = new FS.HUD(this);
    this.hud.init();

    // 显示面板
    this.pfdL = new FS.Displays.PFD(doc.getElementById('pfd-left'), { side: 'L' });
    this.pfdR = new FS.Displays.PFD(doc.getElementById('pfd-right'), { side: 'R' });
    this.ndL = new FS.Displays.ND(doc.getElementById('nd-left'), {});
    this.ndR = new FS.Displays.ND(doc.getElementById('nd-right'), {});
    this.ecamU = new FS.Displays.ECAM(doc.getElementById('ecam-upper'), {});
    this.ecamL = new FS.Displays.ECAM(doc.getElementById('ecam-lower'), {});
    this.hudDisplay = new FS.Displays.HUD(doc.getElementById('hud-canvas'), {});

    this.audio = FS.Audio;

    // 尺寸自适应
    this._onResize();
    var self = this;
    global.addEventListener('resize', function () { self._onResize(); });
  };

  Sim.prototype._onResize = function () {
    if (!this.renderer) return;
    var w = global.innerWidth, h = global.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    // 显示面板缩放
    var scale = U.clamp(Math.min(w / 2250, h / 1180), 0.40, 1.15);
    var setSize = function (disp, baseW, baseH) {
      if (!disp) return;
      var el = disp.canvas;
      var pw = Math.round(baseW * scale), ph = Math.round(baseH * scale);
      el.width = Math.round(pw * Math.min(global.devicePixelRatio || 1, 2));
      el.height = Math.round(ph * Math.min(global.devicePixelRatio || 1, 2));
      el.style.width = pw + 'px';
      el.style.height = ph + 'px';
      disp.S = el.width / baseW;
      disp.W = el.width; disp.H = el.height;
    };
    setSize(this.pfdL, 420, 420);
    setSize(this.pfdR, 420, 420);
    setSize(this.ndL, 420, 420);
    setSize(this.ndR, 420, 420);
    setSize(this.ecamU, 420, 280);
    setSize(this.ecamL, 420, 280);

    var hc = global.document.getElementById('hud-canvas');
    if (hc) {
      var dpr = Math.min(global.devicePixelRatio || 1, 2);
      hc.width = Math.round(w * dpr);
      hc.height = Math.round(h * dpr);
      hc.style.width = w + 'px';
      hc.style.height = h + 'px';
      if (this.hudDisplay) { this.hudDisplay.W = hc.width; this.hudDisplay.H = hc.height; }
    }
  };

  /* ---------------------------------------------------------------------
     事件绑定
     --------------------------------------------------------------------- */
  Sim.prototype._bindEvents = function () {
    var self = this;
    var T = this.THREE;

    FS.Bus.on('warning:stall', function (on) {
      if (on) { self.audio.playCue('stall_start'); self.hud.notify('失速警告 — 立即减小迎角', 'error', 8000); }
      else self.audio.playCue('stall_stop');
    });
    FS.Bus.on('warning:overspeed', function (on) {
      if (on) { self.audio.playCue('overspeed'); self.hud.notify('超速警告', 'error'); }
    });
    FS.Bus.on('warning:lowFuel', function () {
      self.hud.notify('燃油不足', 'warn', 8000);
    });
    FS.Bus.on('fm:fuelStarved', function () {
      self.hud.notify('燃油耗尽 — 发动机停车', 'error', 15000);
      self.audio.playCue('master_warning_start');
    });
    FS.Bus.on('fm:touchdown', function (e) {
      self.audio.playCue('touchdown');
      var fpm = Math.abs(e.vsFpm);
      var q = fpm < 150 ? '非常柔和' : fpm < 300 ? '良好' : fpm < 600 ? '偏重' : '重着陆';
      self.hud.notify('接地 ' + Math.round(e.vsFpm) + ' fpm · ' + q, fpm > 600 ? 'warn' : 'info', 4000);
      if (fpm > 600) self.audio.playCue('master_caution');
    });
    FS.Bus.on('fm:hardLanding', function (e) {
      self.hud.notify('重着陆! ' + Math.round(e.vs) + ' fpm — 请检查机体', 'error', 8000);
    });
    FS.Bus.on('fm:apuStart', function () { self.audio.playCue('apu_start'); });
    FS.Bus.on('ap:engaged', function () { self.audio.playCue('autopilot_engage'); });
    FS.Bus.on('ap:disengaged', function (e) {
      self.hud.notify('自动驾驶断开: ' + (e.reason || ''), 'warn');
    });
    FS.Bus.on('ap:altCapture', function () { self.audio.playCue('chime_low'); });
    FS.Bus.on('ap:locCaptured', function () { self.hud.notify('LOC 已截获', 'info'); });
    FS.Bus.on('ap:gsCaptured', function () { self.hud.notify('G/S 已截获', 'info'); });
    FS.Bus.on('ap:flare', function () { self.hud.notify('FLARE 拉平', 'info'); });
    FS.Bus.on('ap:goAround', function () { self.hud.notify('复飞 TOGA', 'warn', 6000); });
    FS.Bus.on('fms:waypointSequenced', function () { self.audio.playCue('chime_low'); });
    FS.Bus.on('scenario:objective', function (e) {
      self.audio.playCue('chime_low');
      self.hud.notify('✓ ' + e.text, 'success', 4000);
    });
    FS.Bus.on('scenario:completed', function (e) {
      self.hud.notify('★ 场景完成: ' + e.title + ' (' + Math.round(e.elapsed) + ' 秒)', 'success', 12000);
      self.audio.playCue('chime_high');
    });
    FS.Bus.on('lightning', function (e) {
      self.audio.playCue('thunder');
    });
  };

  /* ---------------------------------------------------------------------
     开始一次飞行
     --------------------------------------------------------------------- */
  Sim.prototype.startFlight = function (opts) {
    var THREE = this.THREE;
    var self = this;
    opts = opts || {};

    this.showLoading('正在装配飞机…');

    // 稍作延迟让载入界面渲染出来
    global.setTimeout(function () {
      try {
        self._doStartFlight(opts);
      } catch (e) {
        FS.Log.error('启动飞行失败: ' + (e && e.message) + '\n' + (e && e.stack));
        self.hud.notify('启动失败: ' + (e && e.message), 'error', 12000);
        self.hideLoading();
        self.hud.showMenu();
      }
    }, 60);
  };

  Sim.prototype._doStartFlight = function (opts) {
    var THREE = this.THREE;
    var self = this;

    this._teardown();

    var typeKey = opts.aircraft || FS.CFG.defaultAircraft;
    var depIcao = opts.depIcao || FS.CFG.defaultAirport;
    var dep = FS.Airports.byIcao(depIcao) || FS.Airports.list[0];
    var runwayIdent = opts.runwayIdent;
    if (!runwayIdent || !FS.Airports.findRunway(dep.icao, runwayIdent)) {
      var best = dep.runways.slice().sort(function (a, b) {
        return (b.ils ? 1 : 0) - (a.ils ? 1 : 0) || b.lengthFt - a.lengthFt;
      })[0];
      runwayIdent = best ? best.ident : dep.runways[0].ident;
    }

    /* ---- 世界参考点设为出发机场 ---- */
    FS.Geo.setReference(dep.lat, dep.lon);

    /* ---- 地形: 给机场周围压平 ---- */
    var w = FS.Geo.toWorld(dep.lat, dep.lon);
    this.env.addFlattenZone(w.x, w.z, 4200, dep.elevFt * C.FT, 2200);
    // 目的地也压平 (如果在本图范围内)
    if (opts.arrIcao) {
      var arr = FS.Airports.byIcao(opts.arrIcao);
      if (arr) {
        var wa = FS.Geo.toWorld(arr.lat, arr.lon);
        this.env.addFlattenZone(wa.x, wa.z, 4200, arr.elevFt * C.FT, 2200);
      }
    }

    /* ---- 天气与时间 ---- */
    this.env.setTimeOfDay(opts.timeOfDay !== undefined ? opts.timeOfDay : 10);
    var wxPreset = FS.Environment.presetWeather(opts.weather || 'few');
    this.env.setWeather(wxPreset);

    /* ---- 机场灯光 ---- */
    try {
      this.env.addAirportLights(dep.icao, dep.lat, dep.lon, dep.elevFt, dep.runways);
    } catch (e) { FS.Log.warn('机场灯光加载失败: ' + e.message); }

    /* ---- 飞机 ---- */
    this.hud.showLoading && this.showLoading('正在构建 ' + FS.AIRCRAFT_DB[typeKey].nameZh + '…');

    var livery = null;
    if (opts.livery) {
      for (var li = 0; li < FS.LIVERIES.length; li++) {
        if (FS.LIVERIES[li].id === opts.livery) livery = FS.LIVERIES[li];
      }
    }

    this.fm = new FS.FlightModel(typeKey, {
      fuelKg: Math.round((opts.fuelPct !== undefined ? opts.fuelPct : 0.30) * FS.AIRCRAFT_DB[typeKey].mass.maxFuel),
      payloadKg: Math.round((opts.payloadPct !== undefined ? opts.payloadPct : 0.70) * FS.AIRCRAFT_DB[typeKey].mass.maxPayload),
      groundHeightFn: function (x, z) { return self.env.getGroundHeight(x, z); },
      seed: 20260101
    });

    this.ap = new FS.Autopilot(this.fm);
    this.fms = new FS.FMS(this.fm);
    this.fm.fms = this.fms;
    this.fm.ap = this.ap.ap;

    /* ---- 3D 模型 ---- */
    var modelOpts = { quality: 'medium', shadows: true };
    if (livery) {
      modelOpts.livery = {
        body: livery.body, belly: livery.belly, accent: livery.accent,
        tail: livery.tail, stripe: livery.stripe,
        engine: FS.AIRCRAFT_DB[typeKey].livery.engine,
        wing: FS.AIRCRAFT_DB[typeKey].livery.wing,
        gear: FS.AIRCRAFT_DB[typeKey].livery.gear,
        cockpit: FS.AIRCRAFT_DB[typeKey].livery.cockpit
      };
    }
    this.aircraftModel = FS.Aircraft3D.create(typeKey, modelOpts);

    // 坐标系转换: 模型(机头 -Z) -> 气动机体轴(x前 y右 z下)
    this.aircraftRoot = new THREE.Group();
    this.axisHolder = new THREE.Group();
    // beta 0.2 修正: v0.1 的四元数 (0,-0.612,0.612,0.5) 并不是 模型轴->机体轴 的旋转,
    // 导致外部视角里飞机模型歪斜约 50°。正确映射: 模型 -Z(机头)->机体 +x,
    // 模型 +Y(上)->机体 -z, 模型 +X(右翼)->机体 +y  =>  q = (-0.5, -0.5, 0.5, 0.5)
    this.axisHolder.quaternion.set(-0.5, -0.5, 0.5, 0.5);
    // 让 3D 模型的机轮线与其空气动力学模型的机轮线重合。
    // 模型自身的地面线(plan.groundY, 由发动机离地间隙决定)与飞行动力学模型
    // 按起落架几何算出的净空可能略有差异, 这里统一到动力学模型上, 保证机轮
    // 始终精确压在地面上。
    var modelGroundY = (this.aircraftModel.plan && this.aircraftModel.plan.groundY) || 0;
    var bodyOffset = this.fm.getGroundClearance() + modelGroundY;   // 机体 z 轴向下为正
    this.axisHolder.position.set(0, 0, bodyOffset);
    this._modelGroundOffset = bodyOffset;
    this.axisHolder.add(this.aircraftModel.group);
    this.aircraftRoot.add(this.axisHolder);
    this.scene.add(this.aircraftRoot);

    // 摄像机绑定
    this.cameraRig.setAircraft({
      group: this.aircraftModel.group,
      root: this.aircraftRoot,
      dims: this.aircraftModel.dims || FS.AIRCRAFT_DB[typeKey].dims
    }, this.aircraftModel.dims || FS.AIRCRAFT_DB[typeKey].dims);
    this.cameraRig.setMode('cockpit');

    /* ---- 声音 ---- */
    this.audio.loadAircraft(typeKey);

    /* ---- 场景 ---- */
    var scenarioId = opts.scenario || 'takeoff';
    var scenarioOk = this.scenarioMgr.start(scenarioId, {
      fm: this.fm, env: this.env, ap: this.ap, fms: this.fms,
      airportIcao: dep.icao, runwayIdent: runwayIdent,
      setLights: function (l) { self.setLights(l); }
    });

    if (!scenarioOk) {
      // 回退到“正常起飞”
      this.scenarioMgr.start('takeoff', {
        fm: this.fm, env: this.env, ap: this.ap, fms: this.fms,
        airportIcao: dep.icao, runwayIdent: runwayIdent,
        setLights: function (l) { self.setLights(l); }
      });
    }

    /* ---- 同步模型姿态 ---- */
    this._syncModel(0);

    /* ---- 摄像机初始 ---- */
    this.cameraRig._initialized = false;
    this.cameraRig.update(0.016, this.fm.getState(), null);

    /* ---- 检查单 ---- */
    this.checklistMgr.setPhase('beforeStart');
    this.checklistMgr.autoPhase(this.fm.getState());

    /* ---- TCAS 交通 ---- */
    this._spawnTraffic(dep);

    /* ---- HUD ---- */
    this.hud.syncFromSim();
    this.hud.hideMenu();
    this.hud.toggleHelp(false);
    var tEl = global.document.getElementById('flight-title');
    if (tEl) tEl.textContent = this.scenarioMgr.title + '  ·  ' + dep.icao + ' ' + runwayIdent;

    this.paused = false;
    this.running = true;
    this._vspeedsCache = null;
    this.hideLoading();

    this.hud.notify('起飞前: 按 F1 查看操作说明', 'info', 9000);
    FS.Log.info('飞行开始: ' + typeKey + ' @ ' + dep.icao + '/' + runwayIdent + ' 场景=' + scenarioId);

    // 尝试请求指针锁定 (失败也无妨)
    return true;
  };

  Sim.prototype._teardown = function () {
    var THREE = this.THREE;
    if (this.aircraftRoot) {
      this.scene.remove(this.aircraftRoot);
      this.aircraftRoot.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(function (m) { m.dispose(); });
          else o.material.dispose();
        }
      });
      this.aircraftRoot = null;
    }
    if (this.aircraftModel && this.aircraftModel.dispose) {
      try { this.aircraftModel.dispose(); } catch (e) { }
    }
    this.aircraftModel = null;
    this.traffic = [];
    this.env.clearFlattenZones && this.env.clearFlattenZones();
  };

  Sim.prototype.returnToMenu = function () {
    this.running = false;
    this.paused = false;
    this.audio.stop && this.audio.stop();
    this._teardown();
    this.hud.showMenu();
    FS.Log.info('返回主菜单');
  };

  Sim.prototype.setPaused = function (p) {
    this.paused = !!p;
    if (p) this.audio.suspend && this.audio.suspend();
    else this.audio.resume && this.audio.resume();
  };

  /* ---------------------------------------------------------------------
     灯光
     --------------------------------------------------------------------- */
  Sim.prototype.getLights = function () {
    var o = {};
    for (var k in this.lights) o[k] = this.lights[k];
    return o;
  };

  Sim.prototype.setLights = function (l) {
    for (var k in l) if (this.lights[k] !== undefined) this.lights[k] = !!l[k];
    this._applyLights();
    // 同步 UI
    var doc = global.document;
    var btns = doc.querySelectorAll('#lights-panel .light-btn');
    for (var i = 0; i < btns.length; i++) {
      var key = btns[i].dataset.light;
      btns[i].classList.toggle('on', !!this.lights[key]);
    }
  };

  Sim.prototype._applyLights = function () {
    if (!this.aircraftModel) return;
    var m = this.aircraftModel;
    if (m.setLights) m.setLights(this.lights);
    // 灯光在模型 update 里也会读取
  };

  /* ---------------------------------------------------------------------
     TCAS 虚拟交通
     --------------------------------------------------------------------- */
  Sim.prototype._spawnTraffic = function (ap) {
    this.traffic = [];
    var n = 6 + Math.floor(Math.random() * 5);
    for (var i = 0; i < n; i++) {
      var brg = Math.random() * 360;
      var dist = U.range(8, 55) * C.NM;
      var p = FS.Geo.greatCircleOffset(ap.lat, ap.lon, brg, dist);
      var w = FS.Geo.toWorld(p.lat, p.lon);
      this.traffic.push({
        callsign: ['CCA', 'CES', 'CSN', 'CXA', 'CPA', 'ANA', 'JAL', 'SIA', 'UAL', 'DLH', 'AFR', 'KLM'][Math.floor(Math.random() * 12)] +
          (100 + Math.floor(Math.random() * 899)),
        x: w.x, z: w.z,
        altFt: ap.elevFt + U.range(-3000, 37000),
        hdg: Math.random() * 360,
        spdKt: U.range(180, 470),
        vsFpm: U.range(-2000, 2000),
        level: 'other'
      });
    }
  };

  Sim.prototype._updateTraffic = function (dt, st) {
    for (var i = 0; i < this.traffic.length; i++) {
      var t = this.traffic[i];
      var rad = t.hdg * D2R;
      var v = t.spdKt * C.KT;
      t.x += Math.sin(rad) * v * dt;
      t.z -= Math.cos(rad) * v * dt;
      t.altFt += t.vsFpm / 196.85 * dt;

      // 重新激活飞到远处的飞机
      var d = Math.hypot(t.x - st.pos.x, t.z - st.pos.z);
      if (d > 90 * C.NM || t.altFt < -1000 || t.altFt > 45000) {
        var brg = Math.random() * 360;
        var p = FS.Geo.greatCircleOffset(st.lat, st.lon, brg, U.range(25, 55) * C.NM);
        var w = FS.Geo.toWorld(p.lat, p.lon);
        t.x = w.x; t.z = w.z;
        t.altFt = st.altFt + U.range(-8000, 8000);
        t.hdg = U.wrap360(brg + 180 + U.range(-30, 30));
        t.vsFpm = U.range(-1500, 1500);
      }

      // TCAS 等级
      var horiz = d;
      var vert = Math.abs(t.altFt - st.altFt);
      if (horiz < 5 * C.NM && vert < 1200) t.level = 'threat';
      else if (horiz < 12 * C.NM && vert < 2500) t.level = 'proximity';
      else if (horiz < 25 * C.NM && vert < 9900) t.level = 'traffic';
      else t.level = 'other';
    }
  };

  /* ---------------------------------------------------------------------
     GPWS 近地警告
     --------------------------------------------------------------------- */
  Sim.prototype._updateGPWS = function (dt, st) {
    var g = this.gpws;
    var agl = st.raFt !== undefined ? st.raFt : st.aglFt;
    var vs = st.vsFpm;
    var onGround = st.onGround;

    var callout = function (name, cooldown, cue) {
      var last = g.calloutTimes[name] || -999;
      if (st.time - last < cooldown) return;
      g.calloutTimes[name] = st.time;
      if (cue) this.audio.playCue(cue);
    }.bind(this);

    if (onGround) {
      g.terrain = false; g.pullUp = false; g.sinkRate = false; g.glideslope = false;
      g.lastAgl = 0;
      return;
    }

    /* ---- 下沉率警告 ---- */
    var sinkLimit = agl < 500 ? 1100 : (agl < 1500 ? 1400 : 2000);
    if (agl < 2500 && vs < -sinkLimit && vs > -6000) {
      if (!g.sinkRate) { g.sinkRate = true; callout('sink', 5, 'gpws_sink_rate'); }
    } else if (vs > -sinkLimit * 0.7) {
      g.sinkRate = false;
    }

    /* ---- 地形接近率 (简化) ---- */
    var terrainClosure = -vs;
    if (agl < 1200 && terrainClosure > 1800) {
      if (!g.terrain) {
        g.terrain = true;
        this.hud.notify('TERRAIN — 拉起!', 'error', 5000);
      }
      callout('terrain', 2.2, terrainClosure > 3000 ? 'gpws_pull_up' : 'gpws_terrain');
      g.pullUp = terrainClosure > 3000;
    } else if (terrainClosure < 1000 || agl > 1600) {
      g.terrain = false; g.pullUp = false;
    }

    /* ---- 下滑道偏离 ---- */
    if (this.ap.gsCaptured && agl < 1000 && agl > 100) {
      var gsDev = this.ap.lastGsDev || 0;
      if (gsDev < -0.6) {   // 低于下滑道 (按我的符号: gsDeviationFt 高于下滑道为正)
        callout('glideslope', 3, 'gpws_glideslope');
        g.glideslope = true;
      } else g.glideslope = false;
    }

    /* ---- 无线电高度喊话 ---- */
    var lastAgl = g.lastAgl === undefined ? agl : g.lastAgl;
    var descending = agl < lastAgl - 0.05;
    if (descending && (this.ap.gsCaptured || st.gearPos > 0.99) && vs < -80) {
      var marks = [
        [2500, 'gpws_terrain', 2500],   // "TWO THOUSAND FIVE HUNDRED" 用 terrain 音代替
        [1000, 'gpws_10', 1000],
        [500, 'gpws_10', 500],
        [400, 'gpws_40', 400],
        [300, 'gpws_30', 300],
        [200, 'gpws_20', 200],
        [100, 'gpws_10', 100],
        [50, 'gpws_50', 50],
        [40, 'gpws_40', 40],
        [30, 'gpws_30', 30],
        [20, 'gpws_20', 20],
        [10, 'gpws_10', 10]
      ];
      for (var i = 0; i < marks.length; i++) {
        var m = marks[i];
        if (lastAgl > m[0] && agl <= m[0]) {
          if (m[0] >= 500) { callout('ra' + m[0], 999, m[1]); }
          else callout('ra' + m[0], 999, m[1]);
          break;
        }
      }
      // 20 ft RETARD
      if (lastAgl > 20 && agl <= 20 && this.ap.landMode !== 'ROLLOUT') {
        callout('retard', 999, 'gpws_retard');
      }
    }
    g.lastAgl = agl;
  };

  /* ---------------------------------------------------------------------
     模型姿态同步
     --------------------------------------------------------------------- */
  Sim.prototype._syncModel = function (dt) {
    var fm = this.fm;
    if (!this.aircraftRoot) return;

    this.aircraftRoot.position.set(fm.pos.x, fm.pos.y, fm.pos.z);
    this.aircraftRoot.quaternion.set(fm.q.x, fm.q.y, fm.q.z, fm.q.w);

    // 太阳阴影跟随
    if (this.sunLight) {
      this.sunLight.target.position.copy(this.aircraftRoot.position);
      this.sunLight.position.copy(this.aircraftRoot.position).add(
        new this.THREE.Vector3(
          this.env.sunDirection ? this.env.sunDirection.x : 0.4,
          this.env.sunDirection ? this.env.sunDirection.y : 0.8,
          this.env.sunDirection ? this.env.sunDirection.z : 0.3
        ).multiplyScalar(600));
      this.sunLight.target.updateMatrixWorld();
    }

    // 模型动画
    var st = this._stateCache;
    if (this.aircraftModel && this.aircraftModel.update && st) {
      this.aircraftModel.update(dt, {
        elevator: fm.surfaces.elevator,
        aileron: fm.surfaces.aileron,
        rudder: fm.surfaces.rudder,
        elevatorTrim: fm.surfaces.elevatorTrim,
        flapPos: fm.flapPos,
        slatPos: fm.slatPos,
        spoilerPos: fm.spoilerPos,
        speedbrake: fm.spoilerCmd,
        gearPos: fm.gearPos,
        reverserPos: fm.engines[0] ? fm.engines[0].reverserPos : 0,
        n1L: fm.engines[0] ? fm.engines[0].n1 : 0,
        n1R: fm.engines[1] ? fm.engines[1].n1 : (fm.engines[0] ? fm.engines[0].n1 : 0),
        wingFlex: st.wingFlex,
        gearCompression: fm.gearCompression,
        wheelSpin: fm.wheelSpin,
        brakeGlow: U.clamp01((Math.max.apply(null, fm.brakeTemp) - 200) / 500),
        onGround: fm.onGround,
        machNumber: fm.mach,
        lights: this.lights,
        doorOpen: 0,
        time: fm.time
      });
    }
  };

  /* ---------------------------------------------------------------------
     主循环
     --------------------------------------------------------------------- */
  Sim.prototype._startLoop = function () {
    var self = this;
    function frame(now) {
      global.requestAnimationFrame(frame);
      try {
        self._tick(now);
      } catch (e) {
        FS.Log.error('渲染循环异常: ' + (e && e.message) + '\n' + (e && e.stack));
        // 防止刷屏
        if (++self._lastFrameErrors > 20) {
          FS.Log.error('异常过多, 停止循环');
          return;
        }
      }
    }
    global.requestAnimationFrame(frame);
  };

  Sim.prototype._tick = function (now) {
    if (!this.lastTime) this.lastTime = now;
    var rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    rawDt = U.clamp(rawDt, 0, 0.1);

    var fps = rawDt > 0 ? 1 / rawDt : 0;
    this.fpsHist.push(fps);

    if (!this.running) {
      // 菜单: 仅仅慢慢转动摄像机
      this._menuCamera(rawDt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    var dt = this.paused ? 0 : rawDt * this.timeScale;
    var fm = this.fm;
    var input = this.input;

    /* ================= 输入轮询 ================= */
    if (input) input.update(rawDt);

    /* ================= 输入 -> 飞机 ================= */
    if (!this.paused) {
      this._applyInput(rawDt);
    }

    /* ================= 物理: 固定步长 ================= */
    var steps = 0;
    this.accumulator += dt;
    this.accumulator = Math.min(this.accumulator, 0.5);
    while (this.accumulator >= this.fixedDt && steps < FS.CFG.maxSubSteps) {
      // 每步更新风 (随时间起伏)
      this._updateWind(this.fixedDt);
      fm.update(this.fixedDt);
      this.accumulator -= this.fixedDt;
      steps++;
    }
    if (steps >= FS.CFG.maxSubSteps) this.accumulator = 0;

    /* ================= 自动驾驶 ================= */
    if (!this.paused) {
      this.ap.update(rawDt * this.timeScale);
    }

    /* ================= 状态快照 ================= */
    var st = fm.getState();
    st.lights = this.lights;
    st.time = fm.time;
    this._stateCache = st;
    this._vspeeds = fm.getVSpeeds();
    st._vspeeds = this._vspeeds;
    st._toElev = fm.pos.y;

    /* ================= 场景 / 检查单 ================= */
    if (!this.paused) {
      this.scenarioMgr.update(rawDt, st);
      this.checklistMgr.update && this.checklistMgr.update();
      if (this.frame % 30 === 0) this.checklistMgr.autoPhase(st);
      this._updateTraffic(dt, st);
      this._updateGPWS(dt, st);
    }

    /* ================= 世界 ================= */
    this.env.setFocus(fm.pos.x, fm.pos.z, fm.pos.y);
    this.env.update(rawDt, { x: fm.pos.x, y: fm.pos.y, z: fm.pos.z });
    if (!this.paused) {
      this.env.setWind(this.env.getWeather().windDirDeg, this.env.getWeather().windSpeedKt,
        this.env.getWeather().gustKt, this.env.getWeather().turbulence);
    }

    /* ================= 模型 / 相机 ================= */
    this._syncModel(rawDt);
    if (input && this.cameraRig.isInterior() && (input.lookDeltaX || input.lookDeltaY)) {
      this.cameraRig.look(input.lookDeltaX, input.lookDeltaY, rawDt);
    }
    this.cameraRig.update(rawDt, st, input);

    /* ================= 音效 ================= */
    this._updateAudio(rawDt, st);

    /* ================= 渲染 ================= */
    this.renderer.render(this.scene, this.camera);

    /* ================= 仪表 ================= */
    this._updateDisplays(st);

    /* ================= HUD ================= */
    this.hud.update(rawDt, st);
    this._updatePerf(rawDt);

    /* ================= 键盘动作 ================= */
    if (input) {
      this._handleActions(input, st);
      input.endFrame();
    }

    this.frame++;
  };

  /* ---------------------------------------------------------------------
     输入映射
     --------------------------------------------------------------------- */
  Sim.prototype._applyInput = function (dt) {
    var input = this.input;
    var fm = this.fm, ap = this.ap;
    if (!input) return;

    // 摇杆
    fm.setPilotInput(input.axes.pitch, input.axes.roll, input.axes.yaw);
    fm.pilotOverride = (Math.abs(input.axes.pitch) > 0.35 || Math.abs(input.axes.roll) > 0.35) &&
      (Math.abs(input.axes.pitch) > 0.6 || Math.abs(input.axes.roll) > 0.6);

    // 油门 (除非 A/THR 接管)
    if (!ap.ap.athr) {
      for (var i = 0; i < fm.engines.length; i++) fm.setThrottle(i, input.axes.throttle);
    } else {
      // A/THR 生效时同步手柄位置, 松手后不跳变
      input.axes.throttle = fm.throttle[0];
    }

    // 刹车
    var braking = input.isDown('brakes') ? 1 : 0;
    fm.setBrakes(braking);
  };

  /* ---------------------------------------------------------------------
     风场
     --------------------------------------------------------------------- */
  Sim.prototype._updateWind = function (dt) {
    var wx = this.env.getWeather();
    var t = this.fm.time;
    var gust = 0;
    if (wx.gustKt > wx.windSpeedKt) {
      // 阵风: 两个不同频率的正弦叠加 + 噪声
      var g = Math.sin(t * 0.37) * 0.5 + Math.sin(t * 1.13 + 1.7) * 0.3 +
        (FS.Noise.value3(t * 0.8, 0, 0, 77) * 2 - 1) * 0.4;
      gust = (wx.gustKt - wx.windSpeedKt) * U.clamp01(0.5 + g * 0.5);
    }
    var dirVar = (FS.Noise.value3(0, t * 0.15, 3, 99) * 2 - 1) * (3 + wx.turbulence * 12);
    this.fm.setWind(U.wrap360(wx.windDirDeg + dirVar), wx.windSpeedKt + gust, wx.gustKt, wx.turbulence);
  };

  /* ---------------------------------------------------------------------
     音效
     --------------------------------------------------------------------- */
  Sim.prototype._updateAudio = function (dt, st) {
    var a = this.audio;
    if (!a || !a.available) return;
    a.update(dt, {
      n1L: st.engines[0] ? st.engines[0].n1 : 0,
      n1R: st.engines[1] ? st.engines[1].n1 : (st.engines[0] ? st.engines[0].n1 : 0),
      egtL: st.engines[0] ? st.engines[0].egt : 15,
      egtR: st.engines[1] ? st.engines[1].egt : 15,
      iasKt: st.iasKt, mach: st.mach, altFt: st.altFt, aglFt: st.aglFt,
      gearPos: st.gearPos, flapPos: st.flapPos, spoilerPos: st.spoilerPos,
      reverserPos: st.engines[0] ? st.engines[0].reverserPos : 0,
      onGround: st.onGround, gsKt: st.gsKt,
      windSpeedKt: st.wind.speed, turbulence: st.wind.turbulence,
      rain: this.env.getWeather().rain,
      cockpit: this.cameraRig.isInterior(),
      apuRunning: st.apuRunning,
      engineRunning: st.engines.some(function (e) { return e.state === 'running' || e.state === 'idle'; }),
      machNumber: st.mach
    });

    // 听者位置
    var fwd = new this.THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    var up = new this.THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    a.setListener(
      { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
      { x: fwd.x, y: fwd.y, z: fwd.z },
      { x: up.x, y: up.y, z: up.z }
    );
    a.setEnvironment({
      rain: this.env.getWeather().rain,
      wind: U.clamp01(st.iasKt / 300),
      thunder: this.env.getWeather().thunderstorm,
      onGround: st.onGround,
      cockpit: this.cameraRig.isInterior()
    });
  };

  /* ---------------------------------------------------------------------
     仪表刷新
     --------------------------------------------------------------------- */
  Sim.prototype._updateDisplays = function (st) {
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    if (this.frame % 2 !== 0) return;         // 30 Hz 刷新仪表, 节省性能

    var ilsData = null;
    if (this.ap.ap.ilsIcao && this.ap.ap.ilsRwy) {
      var ils = this.ap._getILS();
      if (ils) {
        ilsData = {
          valid: true,
          course: ils.course,
          freq: ils.freqMHz,
          ident: ils.ident,
          dme: ils.distNm,
          localizerDdm: U.clamp(ils.locDdm, -2.5, 2.5),
          glideslopeDdm: U.clamp(ils.gsDdm, -2.5, 2.5),
          thresholdX: ils.ils && ils.ils.threshold ? ils.ils.threshold.x : 0,
          thresholdZ: ils.ils && ils.ils.threshold ? ils.ils.threshold.z : 0,
          distNm: ils.distNm
        };
      }
    }

    var wind = { dir: st.wind.dir, speed: st.wind.speed };
    var terrainFn = null, self = this;
    if (this.ndL.terrainOn || this.ndR.terrainOn) {
      terrainFn = function (x, z) { return self.env.getGroundHeight(x, z); };
    }

    var common = {
      st: st, ap: this.ap, fms: this.fms, ils: ilsData,
      wind: wind, traffic: this.traffic, terrainFn: terrainFn,
      weather: this.env.getWeather(),
      vspeeds: this._vspeeds, showVSpeeds: true, showTrack: true,
      navSource: this.ap.ap.rollMode === 'NAV' ? 'GPS' : 'VOR'
    };

    try {
      this.pfdL.render(common);
      if (!this._singlePfd) this.pfdR.render(common);
      this.ndL.render(common);
      if (!this._singlePfd) this.ndR.render(common);
      this.ecamU.render(common);
      this.ecamL.render(common);
    } catch (e) {
      FS.Log.error('仪表渲染错误: ' + e.message);
    }

    // HUD
    if (this.hudDisplay && this.cameraRig.isCockpit()) {
      try {
        this.hudDisplay.render({
          st: st, ils: ilsData,
          speedBug: this._vspeeds ? this._vspeeds.V2 : undefined,
          altBug: this.ap.ap.targetAltFt
        });
      } catch (e2) { }
    } else if (this.hudDisplay) {
      var hc = this.hudDisplay.canvas;
      this.hudDisplay.ctx.clearRect(0, 0, hc.width, hc.height);
    }
  };

  /* ---------------------------------------------------------------------
     快捷键动作
     --------------------------------------------------------------------- */
  Sim.prototype._handleActions = function (input, st) {
    var fm = this.fm, ap = this.ap, self = this;

    /* --- 视角 --- */
    if (input.consume('viewNext')) {
      this.cameraRig.cycle(1);
      this.hud.notify('视角: ' + this.cameraRig.getModeName(), 'info', 1500);
    }
    var viewKeys = [
      ['viewCockpit', 'cockpit'], ['viewWing', 'wing'], ['viewChase', 'chase'],
      ['viewTower', 'tower'], ['viewOrbit', 'orbit'], ['viewFree', 'free'], ['viewFlyby', 'flyby']
    ];
    for (var vk = 0; vk < viewKeys.length; vk++) {
      if (input.consume(viewKeys[vk][0])) {
        this.cameraRig.setMode(viewKeys[vk][1]);
        this.hud.notify('视角: ' + this.cameraRig.getModeName(), 'info', 1500);
      }
    }

    /* --- 构型 --- */
    if (input.consume('gearToggle')) {
      if (st.tasKt > 260) this.hud.notify('空速过高, 起落架禁止操作', 'warn');
      else {
        var down = fm.gearCmd < 0.5;
        fm.setGear(down);
        this.audio.playCue(down ? 'gear_down' : 'gear_up');
        this.audio.playCue('gear_motor');
        this.hud.notify('起落架 ' + (down ? '放下' : '收上'), 'info');
      }
    }
    if (input.consume('flapsUp')) {
      var n1 = fm.stepFlap(-1);
      this.audio.playCue('flap_motor');
      this.hud.notify('襟翼 ' + n1, 'info', 1500);
      this.hud._highlightFlapDetent(fm.flapDetentIndex);
    }
    if (input.consume('flapsDown')) {
      var n2 = fm.stepFlap(1);
      this.audio.playCue('flap_motor');
      this.hud.notify('襟翼 ' + n2, 'info', 1500);
      this.hud._highlightFlapDetent(fm.flapDetentIndex);
    }
    if (input.consume('spoilers')) {
      fm.setSpoilers(fm.spoilerCmd > 0.5 ? 0 : 1);
      this.audio.playCue('speedbrake');
      this.hud.notify('减速板 ' + (fm.spoilerCmd > 0.5 ? '收回' : '放出'), 'info', 1500);
    }
    if (input.consume('parkingBrake')) {
      fm.setParkingBrake(!fm.parkingBrake);
      var pb = global.document.getElementById('park-brake');
      if (pb) pb.classList.toggle('on', fm.parkingBrake);
      this.hud.notify('停留刹车 ' + (fm.parkingBrake ? 'ON' : 'OFF'), 'info');
    }

    /* --- 油门预设 --- */
    if (input.consume('throttleIdle')) { fm.setThrottle('all', 0); this.hud.notify('油门 慢车', 'info', 1200); }
    if (input.consume('throttleClimb')) { fm.setThrottle('all', 0.82); this.hud.notify('油门 爬升推力', 'info', 1200); }
    if (input.consume('throttleTOGA')) {
      fm.setThrottle('all', 1);
      if (ap) { ap.ap.thrustMode = 'TOGA'; ap.ap.athr = fm.ap.athr; }
      this.audio.playCue('takeoff_config');
      this.hud.notify('起飞推力 TOGA', 'warn', 2500);
    }
    if (input.consume('throttleToggleRev')) {
      var on = !fm.engines[0].reverserArmed;
      fm.setReverser('all', on);
      this.hud.notify('反推 ' + (on ? '预位' : '解除'), 'info');
    }

    /* --- 自动驾驶 --- */
    if (input.consume('apToggle')) {
      if (ap.ap.engaged) ap.disengage('人工断开'); else ap.engage(1);
    }
    if (input.consume('apThrottle')) {
      ap.ap.athr = !ap.ap.athr;
      if (ap.ap.athr && !ap.ap.thrustMode) ap.setThrustMode('SPEED');
      this.hud.notify('自动推力 ' + (ap.ap.athr ? '接通' : '断开'), ap.ap.athr ? 'info' : 'warn');
    }
    if (input.consume('apHdg')) {
      ap.setRollMode('HDG');
      ap.setTargetHdg(this.hud._fcu.hdg);
      this.hud.notify('HDG ' + U.pad(this.hud._fcu.hdg, 3) + '°', 'info', 1500);
    }
    if (input.consume('apNav')) {
      ap.setRollMode('NAV');
      this.hud.notify('LNAV', 'info', 1500);
    }
    if (input.consume('apAlt')) {
      ap.setTargetAlt(this.hud._fcu.alt);
      ap.setPitchMode('ALT SEL');
      this.hud.notify('ALT ' + this.hud._fcu.alt + ' ft', 'info', 1500);
    }
    if (input.consume('apVs')) {
      ap.setTargetVs(this.hud._fcu.vs);
      ap.setPitchMode('VS');
      this.hud.notify('V/S ' + this.hud._fcu.vs + ' fpm', 'info', 1500);
    }
    if (input.consume('apAppr')) {
      ap.armAppr(!ap.ap.apprArmed);
      this.hud.notify('APPR ' + (ap.ap.apprArmed ? '预位' : '取消'), 'info');
    }
    if (input.consume('apFlch')) {
      ap.setPitchMode('FLCH');
      this.hud.notify('FLCH', 'info', 1500);
    }
    if (input.consume('apSpeedMach')) {
      if (ap.ap.thrustMode === 'MACH') {
        ap.setThrustMode('SPEED'); ap.setTargetSpeed(Math.round(st.iasKt));
        this.hud.notify('速度模式 SPD ' + Math.round(st.iasKt) + ' kt', 'info');
      } else {
        ap.setThrustMode('MACH'); ap.setTargetMach(Math.round(st.mach * 100) / 100);
        this.hud.notify('速度模式 MACH ' + st.mach.toFixed(2), 'info');
      }
    }
    if (input.consume('altPlus')) {
      this.hud._fcu.alt += 1000; this.hud._updateFCUDisplay();
      if (ap.ap.engaged) ap.setTargetAlt(this.hud._fcu.alt);
    }
    if (input.consume('altMinus')) {
      this.hud._fcu.alt = Math.max(0, this.hud._fcu.alt - 1000); this.hud._updateFCUDisplay();
      if (ap.ap.engaged) ap.setTargetAlt(this.hud._fcu.alt);
    }
    if (input.consume('hdgPlus')) {
      this.hud._fcu.hdg = U.wrap360(this.hud._fcu.hdg + 5); this.hud._updateFCUDisplay();
      if (ap.ap.engaged && ap.ap.rollMode === 'HDG') ap.setTargetHdg(this.hud._fcu.hdg);
    }
    if (input.consume('hdgMinus')) {
      this.hud._fcu.hdg = U.wrap360(this.hud._fcu.hdg - 5); this.hud._updateFCUDisplay();
      if (ap.ap.engaged && ap.ap.rollMode === 'HDG') ap.setTargetHdg(this.hud._fcu.hdg);
    }
    if (input.consume('spdPlus')) {
      this.hud._fcu.spd = Math.min(400, this.hud._fcu.spd + 5); this.hud._updateFCUDisplay();
      if (ap.ap.engaged && ap.ap.thrustMode === 'SPEED') ap.setTargetSpeed(this.hud._fcu.spd);
    }
    if (input.consume('spdMinus')) {
      this.hud._fcu.spd = Math.max(100, this.hud._fcu.spd - 5); this.hud._updateFCUDisplay();
      if (ap.ap.engaged && ap.ap.thrustMode === 'SPEED') ap.setTargetSpeed(this.hud._fcu.spd);
    }

    /* --- 系统 --- */
    if (input.consume('apuToggle')) {
      if (fm.apuRunning) { fm.stopAPU(); this.hud.notify('APU 停车', 'info'); }
      else { fm.startAPU(); this.hud.notify('APU 起动中…', 'info'); }
      var ab = global.document.getElementById('apu-btn');
      if (ab) ab.classList.toggle('on', fm.apuRunning);
    }
    if (input.consume('mute')) {
      if (this.audio.setMuted) {
        var muted = this.audio.getMasterVolume && this.audio.getMasterVolume() > 0;
        this.audio.setMuted(muted);
        this.hud.notify(muted ? '已静音' : '取消静音', 'info', 1500);
      }
    }
    if (input.consume('timeScaleUp')) {
      var opts = [];
      for (var i = 0; i < FS.CFG.timeScaleOptions.length; i++) {
        if (FS.CFG.timeScaleOptions[i] !== this.timeScale) opts.push(FS.CFG.timeScaleOptions[i]);
      }
      this.timeScale = opts[0] !== undefined ? opts[0] : 1;
      this.hud.notify('时间倍率 ×' + this.timeScale, 'info', 1500);
    }
    if (input.consume('toggleHud')) {
      this._hudVisible = this._hudVisible === false ? true : false;
      var hcv = global.document.getElementById('hud-canvas');
      if (hcv) hcv.style.display = this._hudVisible ? '' : 'none';
    }
    if (input.consume('screenshot')) {
      this._screenshot();
    }
  };

  /* ---------------------------------------------------------------------
     截图
     --------------------------------------------------------------------- */
  Sim.prototype._screenshot = function () {
    try {
      var url = this.renderer.domElement.toDataURL('image/png');
      var a = global.document.createElement('a');
      a.href = url;
      a.download = 'flight-' + Date.now() + '.png';
      a.click();
      this.hud.notify('已保存截图', 'info');
    } catch (e) {
      this.hud.notify('截图失败', 'warn');
    }
  };

  /* ---------------------------------------------------------------------
     菜单摄像机
     --------------------------------------------------------------------- */
  Sim.prototype._menuCamera = function (dt) {
    var t = (this._menuT = (this._menuT || 0) + dt);
    // 慢慢环绕机场
    if (!this._menuRef) {
      var ap = FS.Airports.byIcao('ZSPD');
      this._menuRef = ap ? FS.Geo.toWorld(ap.lat, ap.lon) : { x: 0, z: 0 };
      this._menuAlt = ap ? ap.elevFt * C.FT : 0;
    }
    var r = 2600;
    this.camera.position.set(
      this._menuRef.x + Math.sin(t * 0.045) * r,
      this._menuAlt + 320 + Math.sin(t * 0.08) * 60,
      this._menuRef.z + Math.cos(t * 0.045) * r
    );
    this.camera.lookAt(this._menuRef.x, this._menuAlt + 30, this._menuRef.z);
    this.camera.updateProjectionMatrix();
  };

  /* ---------------------------------------------------------------------
     性能显示
     --------------------------------------------------------------------- */
  Sim.prototype._updatePerf = function (dt) {
    this._statsTimer += dt;
    if (this._statsTimer < 0.4) return;
    this._statsTimer = 0;
    var e = global.document.getElementById('perf');
    if (!e) return;
    var info = this.renderer.info;
    var avg = 0, n = this.fpsHist.count;
    for (var i = 0; i < n; i++) avg += this.fpsHist.get(i);
    avg = n ? avg / n : 0;
    e.textContent = Math.round(avg) + ' fps · ' + info.render.calls + ' calls · ' +
      (info.render.triangles / 1000).toFixed(0) + 'k tri';
  };

  /* ---------------------------------------------------------------------
     载入界面
     --------------------------------------------------------------------- */
  Sim.prototype.showLoading = function (msg) {
    var e = global.document.getElementById('loading');
    if (!e) return;
    e.classList.remove('hidden');
    var m = global.document.getElementById('loading-msg');
    if (m && msg) m.textContent = msg;
  };
  Sim.prototype.hideLoading = function () {
    var e = global.document.getElementById('loading');
    if (e) e.classList.add('hidden');
  };

  /* =====================================================================
     入口
     ===================================================================== */
  function boot() {
    FS.Log.info('=== 飞行模拟器 v' + FS.CFG.version + ' 启动 ===');

    // 依赖检查
    var missing = [];
    if (!global.THREE) missing.push('three.js');
    if (!FS.Airports) missing.push('airports.js');
    if (!FS.Aircraft3D) missing.push('aircraft3d.js');
    if (!FS.Environment) missing.push('environment.js');
    if (missing.length) {
      FS.Log.error('缺少模块: ' + missing.join(', '));
      var le = global.document.getElementById('loading');
      if (le) {
        le.classList.remove('hidden');
        le.innerHTML = '<div class="err">缺少模块: ' + missing.join(', ') +
          '<br><small>请确认 js/ 目录下的所有文件都存在</small></div>';
      }
      return null;
    }

    var sim = new Sim();
    FS.sim = sim;
    var ok = sim.boot();
    if (ok) {
      // 主菜单背景也能看到东西
      global.document.getElementById('menu-version').textContent =
        'v' + FS.CFG.version + ' · ' + FS.AircraftList.length + ' 种机型 · ' +
        FS.Airports.list.length + ' 个机场';
      applyUrlParams(sim);
    }
    return sim;
  }

  /* ---------------------------------------------------------------------
     URL 参数 (便于直接进入某个场景, 也用于自动化测试)
       ?aircraft=A350-900&scenario=ils-approach&dep=ZSPD&rwy=17R
       &weather=storm&time=21.5&log=1&autostart=1&speed=2
     --------------------------------------------------------------------- */
  function applyUrlParams(sim) {
    var q = global.location.search;
    if (!q || q.length < 2) return;
    var p = {};
    q.substring(1).split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i < 0) p[decodeURIComponent(kv)] = '1';
      else p[decodeURIComponent(kv.substring(0, i))] = decodeURIComponent(kv.substring(i + 1));
    });

    var s = sim.hud.selected;
    if (p.aircraft && FS.AIRCRAFT_DB[p.aircraft]) s.aircraft = p.aircraft;
    if (p.scenario && sim.scenarioMgr.get(p.scenario)) s.scenario = p.scenario;
    if (p.dep && FS.Airports.byIcao(p.dep)) s.depIcao = p.dep;
    if (p.arr && FS.Airports.byIcao(p.arr)) s.arrIcao = p.arr;
    if (p.weather) s.weather = p.weather;
    if (p.time !== undefined) s.timeOfDay = parseFloat(p.time);
    if (p.fuel !== undefined) s.fuelPct = parseFloat(p.fuel);
    if (p.payload !== undefined) s.payloadPct = parseFloat(p.payload);
    if (p.livery) s.livery = p.livery;
    if (p.rwy) s.runwayIdent = p.rwy;
    // beta 0.2: ?procedural=1 强制使用 v0.1 的程序化飞机模型 (对比/排错用)
    if (p.procedural !== undefined && p.procedural !== '0') FS.CFG.proceduralModels = true;

    // 只有显式要求时才显示日志面板 (出错时会自动显示)
    if (p.log !== undefined) {
      global.document.body.classList.add('show-log');
    }

    if (p.autostart !== undefined) {
      // 等一帧让菜单渲染完, 然后直接开始飞行
      global.setTimeout(function () {
        sim.startFlight({
          aircraft: s.aircraft, livery: s.livery, depIcao: s.depIcao, arrIcao: s.arrIcao,
          runwayIdent: s.runwayIdent, scenario: s.scenario, weather: s.weather,
          timeOfDay: s.timeOfDay, fuelPct: s.fuelPct, payloadPct: s.payloadPct
        });
        if (p.speed) sim.timeScale = parseFloat(p.speed) || 1;
      }, 150);
    }
  }

  /* 用户手势后初始化音频 */
  function initAudioOnce() {
    if (global.__fsAudioInit) return;
    global.__fsAudioInit = true;
    try {
      var ok = FS.Audio.init();
      if (ok) {
        FS.Audio.setMasterVolume(0.8);
        FS.Log.info('音频引擎已启动');
      } else {
        FS.Log.warn('音频引擎不可用 (浏览器不支持或未授权)');
      }
    } catch (e) {
      FS.Log.warn('音频初始化失败: ' + e.message);
    }
  }
  FS.initAudioOnce = initAudioOnce;

  FS.Sim = Sim;
  FS.boot = boot;

  // 自动启动
  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', function () { boot(); });
  } else {
    global.setTimeout(boot, 0);
  }

})(typeof window !== 'undefined' ? window : globalThis);
