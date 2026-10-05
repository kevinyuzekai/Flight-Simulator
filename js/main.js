/* ==========================================================================
   天际航线 SkyRoute — 主程序 (main.js)
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
    this.simpleInstruments = false;   // beta 0.3.1+: 已取消 2D 六屏叠加, 仅三维驾驶舱
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
    this.cameraRig.sim = this;
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
    // beta 0.3.1: 737 / 737 MAX / E190 抖杆器 (驾驶杆在 3D 驾驶舱中抖动, 并发出失速提示音)
    FS.Bus.on('warning:stickShaker', function (on) {
      if (on) { self.audio.playCue('stall_start'); self.hud.notify('抖杆 STALL — 失速保护已介入, 请推杆 / 加油门', 'error', 6000); }
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
      self.hud.notify('自动驾驶断开: ' + (e.reason || '') + (e.athr ? ' · A/THR 保持' : '') + ' — 再按 T / AP 断开钮消音', 'warn', 5000);
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

    /* ---- beta 0.3: 真实跑道道面 + 跑道带状平整区 (出发/目的机场及参考点 250 km 内的机场) ---- */
    try {
      var rwyAirports = FS.Runways.nearbyAirports(250, [dep, opts.arrIcao ? FS.Airports.byIcao(opts.arrIcao) : null]);
      this.runwayGroups = [];
      this.runwayAirports = rwyAirports;
      for (var rf = 0; rf < rwyAirports.length; rf++) FS.Runways.addFlatten(this.env, rwyAirports[rf]);
      for (var ra = 0; ra < rwyAirports.length; ra++) {
        var rg = FS.Runways.buildAirport(THREE, this.env, rwyAirports[ra]);
        this.scene.add(rg);
        this.runwayGroups.push(rg);
      }
    } catch (e) { FS.Log.warn('跑道道面生成失败: ' + e.message); }

    /* ---- beta 0.3.2: 立体机场 (停机坪/滑行道/航站楼/廊桥/塔台) ---- */
    this.airport3dGroups = [];
    this.towerByIcao = {};
    try {
      if (FS.Airport3D) {
        var a3 = FS.Airport3D.nearbyBuild(THREE, this.env, 250, [dep, opts.arrIcao ? FS.Airports.byIcao(opts.arrIcao) : null]);
        this.airport3dGroups = a3.groups || [];
        this.towerByIcao = a3.towerByIcao || {};
        for (var ai = 0; ai < this.airport3dGroups.length; ai++) this.scene.add(this.airport3dGroups[ai]);
        var nDet = 0;
        for (var aj = 0; aj < this.airport3dGroups.length; aj++) if (this.airport3dGroups[aj].userData.detailed) nDet++;
        FS.Log.info('立体机场: 已生成 ' + this.airport3dGroups.length + ' 座 (其中 ' + nDet + ' 座为真实布局, 内置 OSM 轮廓库 ' + FS.Airport3D.osmCount() + ' 座)');
        // 联网时对出发/到达机场尝试 OSM 补充滑行道
        if (FS.CFG.onlineScenery && opts.online !== false) {
          var selfOsm = this;
          [dep, opts.arrIcao ? FS.Airports.byIcao(opts.arrIcao) : null].forEach(function (apOsm) {
            if (!apOsm || FS.Airport3D.hasOsmLayout(apOsm.icao)) return;   // beta 0.4: 已内置真实轮廓, 不再联网补充
            var grp = null;
            for (var gi = 0; gi < selfOsm.airport3dGroups.length; gi++) {
              if (selfOsm.airport3dGroups[gi].userData.airport && selfOsm.airport3dGroups[gi].userData.airport.icao === apOsm.icao) {
                grp = selfOsm.airport3dGroups[gi]; break;
              }
            }
            if (!grp) return;
            FS.Airport3D.fetchOsmLayout(apOsm, function (data) {
              if (!data || !grp.parent) return;
              var n = FS.Airport3D.applyOsmExtras(THREE, selfOsm.env, apOsm, grp, data);
              if (n > 0) FS.Log.info('OSM 补充 ' + apOsm.icao + ': +' + n + ' 段滑行道/停机坪');
            });
          });
        }
      }
    } catch (e3) { FS.Log.warn('立体机场生成失败: ' + e3.message); }

    /* ---- beta 0.3: 联网全球地景 (失败/离线时自动保持内置地形) ---- */
    this.scenery = null;
    if (FS.CFG.onlineScenery && FS.OnlineScenery && opts.online !== false) {
      try {
        this.scenery = new FS.OnlineScenery(this.env, this.scene, { imagery: FS.CFG.sceneryImagery });
        FS.Log.info('联网地景: 已启用 (' + this.scenery.img.name + ')');
      } catch (e) {
        this.scenery = null;
        FS.Log.warn('联网地景初始化失败, 使用内置地形: ' + e.message);
      }
    } else {
      var oa = global.document && global.document.getElementById('scenery-attrib');
      if (oa) oa.style.display = 'none';
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
    if (opts.livery && FS.LIVERY_ALIASES && FS.LIVERY_ALIASES[opts.livery]) opts.livery = FS.LIVERY_ALIASES[opts.livery];
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

    /* ---- beta 0.3.1: 三维驾驶舱 (驾驶舱视角唯一模式; 已取消 2D 六屏叠加) ---- */
    this.cockpit3d = null;
    this.cameraRig.setCockpit3D(null);
    if (FS.Cockpit3D) {
      try {
        this.cockpit3d = new FS.Cockpit3D(THREE, typeKey, { sim: this });
        var ca = this.cameraRig.anchors.cockpitL;
        this.cockpit3d.group.position.set(0, ca ? ca.position.y : 1, ca ? ca.position.z : -10);
        this.aircraftModel.group.add(this.cockpit3d.group);
        this.cameraRig.setCockpit3D(this.cockpit3d);
        FS.Cockpit3D.bindInteraction(this);
        FS.Log.info('三维驾驶舱: ' + this.cockpit3d.L.maker + ' 布局, 显示器 ' + Math.round(this.cockpit3d.L.du * 1000) + ' mm');
      } catch (e3) { this.cockpit3d = null; FS.Log.warn('三维驾驶舱创建失败: ' + e3.message); }
    }
    this._applyCockpitUi(true);

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
    if (this._startView === 'panel') this.cameraRig.togglePanelView(true);
    else if (this._startView && this._startView !== 'cockpit') this.cameraRig.setMode(this._startView);
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

    this.hud.notify('起飞前: 按 ? 或 F1 查看操作说明 · C 切换视角 · N 看仪表板 · Tab 侧边面板 · M 鼠标驾驶杆', 'info', 9000);
    FS.Log.info('飞行开始: ' + typeKey + ' @ ' + dep.icao + '/' + runwayIdent + ' 场景=' + scenarioId);

    // 尝试请求指针锁定 (失败也无妨)
    return true;
  };

  Sim.prototype._teardown = function () {
    var THREE = this.THREE;
    if (this.cockpit3d) { try { this.cockpit3d.dispose(); } catch (e0) { /* */ } this.cockpit3d = null; }
    if (this.cameraRig) { this.cameraRig.setCockpit3D(null); this.cameraRig.use3d = false; }
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
    if (this.scenery) { try { this.scenery.dispose(); } catch (e) { /* */ } this.scenery = null; }
    if (this.runwayGroups) {
      for (var gi = 0; gi < this.runwayGroups.length; gi++) {
        this.scene.remove(this.runwayGroups[gi]);
        if (this.runwayGroups[gi].userData.dispose) this.runwayGroups[gi].userData.dispose();
      }
      this.runwayGroups = null;
    }
    if (this.airport3dGroups) {
      for (var a3i = 0; a3i < this.airport3dGroups.length; a3i++) {
        this.scene.remove(this.airport3dGroups[a3i]);
        if (this.airport3dGroups[a3i].userData.dispose) this.airport3dGroups[a3i].userData.dispose();
      }
      this.airport3dGroups = null;
      this.towerByIcao = null;
    }
    this.env.clearFlattenZones && this.env.clearFlattenZones();
    try { FS.Audio.playCue('ap_disconnect_stop'); } catch (eA) { /* */ }
  };

  /* ---------------------------------------------------------------------
     beta 0.3.1: 三维驾驶舱界面 (已取消 2D 六屏 / 简化仪表)
     --------------------------------------------------------------------- */
  Sim.prototype.toggleSimpleInstruments = function () {
    // 兼容旧调用: 已取消简化仪表, 始终保持关闭
    this.simpleInstruments = false;
    this._applyCockpitUi();
    if (this.hud) this.hud.notify('本版仅三维驾驶舱 (已取消 2D 六屏叠加)', 'info', 2200);
    return false;
  };

  Sim.prototype._applyCockpitUi = function () {
    var doc = global.document;
    var in3d = !!(this.cockpit3d && this.cameraRig && this.cameraRig.isCockpit());
    var d = doc.getElementById('displays'); if (d) d.classList.add('hidden');
    var f = doc.getElementById('fcu'); if (f) f.classList.toggle('hidden', in3d);
    var b = doc.getElementById('simple-btn'); if (b) b.classList.add('hidden');
    var pv = doc.getElementById('panelview-btn'); if (pv) pv.classList.toggle('hidden', !in3d);
    doc.body.classList.toggle('cockpit-3d', in3d);
    // 三维驾驶舱自带操纵台: 右侧 2D 操纵台默认收起 (Tab / ▤ 可打开)
    if (this.hud && !this.hud._sidePanelsUser) {
      var rc = doc.getElementById('right-col'); if (rc) rc.classList.toggle('hidden', in3d);
    }
  };

  Sim.prototype.togglePanelView = function () {
    if (!this.cameraRig) return;
    if (!this.cameraRig.isCockpit()) this.cameraRig.setMode('cockpit');
    this.simpleInstruments = false;
    var on = this.cameraRig.togglePanelView();
    var pv = global.document.getElementById('panelview-btn'); if (pv) pv.classList.toggle('on', on);
    this.hud.notify(on ? '看向仪表板 (N 恢复向外看)' : '向外看', 'info', 1500);
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
        // beta 0.3: 虚构呼号 (4 个字母, 不可能与 3 字母的真实航空公司 ICAO 代码重合)
        callsign: ['NIMB', 'ZEFR', 'AURA', 'KITE', 'LUMO', 'ORCA', 'PIKA', 'SOLA', 'TERN', 'VELA', 'WREN', 'YUKI'][Math.floor(Math.random() * 12)] +
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
    if (this.scenery) {
      try { this.scenery.update(rawDt, { x: fm.pos.x, y: fm.pos.y, z: fm.pos.z }); }
      catch (e) { FS.Log.warn('联网地景出错, 回退内置地形: ' + e.message); this.scenery.dispose(); this.scenery = null; }
    }
    if (!this.paused) {
      this.env.setWind(this.env.getWeather().windDirDeg, this.env.getWeather().windSpeedKt,
        this.env.getWeather().gustKt, this.env.getWeather().turbulence);
    }

    /* ================= 模型 / 相机 ================= */
    this._syncModel(rawDt);
    if (input && this.cameraRig.isInterior() && (input.lookDeltaX || input.lookDeltaY)) {
      this.cameraRig.look(input.lookDeltaX, input.lookDeltaY, rawDt);
    }
    // beta 0.3.1: 摇杆苦力帽 (POV) 环视
    if (input && input.hatLook && this.cameraRig.isInterior() && (input.hatLook.x || input.hatLook.y)) {
      this.cameraRig.look(input.hatLook.x * 720 * rawDt, input.hatLook.y * 720 * rawDt, rawDt);
    }
    // beta 0.3.1: 三维驾驶舱 (驾驶舱视角唯一模式)
    var use3d = !!(this.cockpit3d && this.cameraRig.isCockpit());
    this.cameraRig.use3d = use3d;
    if (this.cockpit3d) {
      this.cockpit3d.setActive(use3d, this.aircraftModel && this.aircraftModel.group, this.cameraRig,
        this.cameraRig.mode === 'cockpitR' ? 'R' : 'L');
      if (use3d) this.cockpit3d.update(rawDt, st, this._displayData(st));
    }
    if (use3d !== this._lastUse3d) { this._lastUse3d = use3d; this._applyCockpitUi(); }
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
    // beta 0.4: 超控判定只看键盘/摇杆/手柄/触摸杆量 (鼠标驾驶杆不算), 由 Autopilot 做「持续推杆」计时
    fm.pilotOverrideMag = input.overrideMag || 0;
    fm.pilotOverride = fm.pilotOverrideMag > 0.5;

    // 油门 (除非 A/THR 接管)
    if (!ap.ap.athr) {
      // beta 0.3: 双油门杆 (TCA 油门台) -> 左/右发分别控制
      for (var i = 0; i < fm.engines.length; i++) {
        var two = fm.engines.length === 2;
        fm.setThrottle(i, two ? (i === 0 ? input.axes.throttleL : input.axes.throttleR) : input.axes.throttle);
      }
    } else {
      // A/THR 生效时同步手柄位置, 松手后不跳变
      input.axes.throttle = fm.throttle[0];
    }

    // 刹车
    var braking = input.isDown('brakes') ? 1 : 0;
    fm.setBrakes(braking);

    // 配平 (Home 低头 / End 抬头); 电传机型在正常法则下仍会自动配平
    var trimIn = (input.isDown('elevatorTrimUp') ? 1 : 0) - (input.isDown('elevatorTrimDown') ? 1 : 0);
    if (trimIn && fm.surfaces) {
      fm.surfaces.elevatorTrim = U.clamp((fm.surfaces.elevatorTrim || 0) + trimIn * 0.25 * dt, -1, 1);
    }
    // 滚轮: 只在驾驶舱内调油门, 外部视角留给相机缩放
    input.wheelThrottle = this.cameraRig.isInterior();
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
  /** 仪表公共数据 (供 3D 驾驶舱贴图绘制) */
  Sim.prototype._displayData = function (st) {
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
    return common;
  };

  Sim.prototype._updateDisplays = function (st) {
    // beta 0.3.1+: 已取消 2D 六屏; 仅在 Shift+H 打开时绘制 HUD 平视显示器
    if (this.frame % 2 !== 0) return;
    var hcv = this.hudDisplay && this.hudDisplay.canvas;
    if (this._hudVisible !== true) {
      if (hcv && this._hudCleared !== true) { this.hudDisplay.ctx.clearRect(0, 0, hcv.width, hcv.height); this._hudCleared = true; }
      return;
    }
    this._hudCleared = false;
    var common = this._displayData(st), ilsData = common.ils;
    if (this.hudDisplay && this.cameraRig.isCockpit()) {
      try { this.hudDisplay.render({ st: st, ils: ilsData, speedBug: this._vspeeds ? this._vspeeds.V2 : undefined, altBug: this.ap.ap.targetAltFt }); } catch (e1) { }
    } else if (hcv) this.hudDisplay.ctx.clearRect(0, 0, hcv.width, hcv.height);
  };

  /* ---------------------------------------------------------------------
     快捷键动作
     --------------------------------------------------------------------- */
  Sim.prototype._handleActions = function (input, st) {
    var fm = this.fm, ap = this.ap, self = this;

    /* --- 视角 (beta 0.3: C 循环, Shift+C 反向; 屏幕上的"视角"按钮同样可用) --- */
    if (input.consume('viewPrev')) {
      this.cameraRig.cycle(-1);
      this.hud.notify('视角: ' + this.cameraRig.getModeName(), 'info', 1500);
    } else if (input.consume('viewNext')) {
      this.cameraRig.cycle(1);
      this.hud.notify('视角: ' + this.cameraRig.getModeName(), 'info', 1500);
    }
    /* --- 暂停 (空格 / P) --- */
    if (input.consume('pauseToggle')) {
      if (!this.hud.menuOpen && !this.hud.pauseOpen) {
        this.setPaused(!this.paused);
        this.hud.notify(this.paused ? '已暂停 (空格 / P 继续)' : '继续', 'info', this.paused ? 4000 : 1200);
        var pi = global.document.getElementById('pause-indicator');
        if (pi) pi.classList.toggle('hidden', !this.paused);
      }
    }
    /* --- beta 0.3.1: 看仪表板 (N) --- */
    if (input.consume('lookPanel')) this.togglePanelView();
    if (input.consume('lookCenter')) { this.cameraRig.centerLook(); var pvb = global.document.getElementById('panelview-btn'); if (pvb) pvb.classList.remove('on'); }
    /* --- 鼠标驾驶杆 (M) --- */
    if (input.consume('mouseYoke')) {
      input.setMouseYoke(!input.mouseYoke);
      this.hud.notify(input.mouseYoke ? '鼠标驾驶杆: 开 (光标相对屏幕中心 = 杆量, 再按 M 关闭)' : '鼠标驾驶杆: 关', 'info', 3000);
    }
    /* --- 摇杆 AP 断开按钮 --- */
    if (input.consume('apDisconnect')) {
      // beta 0.4: 接通时断开; 已断开时再按 = 断开警告消音
      if (ap.instinctiveDisconnect('侧杆按钮断开') === 'silenced') this.hud.notify('AP 断开警告已消音', 'info', 1500);
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
      // beta 0.4: 断开 → 警告音持续; 再按一次消音; 再按才重新接通
      var tg = ap.toggle();
      if (tg === 'silenced') this.hud.notify('AP 断开警告已消音 (再按 T 接通)', 'info', 2000);
      else if (tg === 'refused') this.hud.notify('无法接通自动驾驶 (失速 / 严重超速)', 'warn', 2500);
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
    if (input.consume('engineAllStart')) {
      fm.startEngine('all'); this.hud.notify('起动全部发动机…', 'info');
    }
    if (input.consume('engine1Start')) {
      fm.startEngine(0); this.hud.notify('发动机 1 起动中', 'info');
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
      // beta 0.3.1: 三维驾驶舱中 HUD 默认关闭; Shift+H 显式开 / 关
      var hudOn = this._hudVisible === true;
      this._hudVisible = !hudOn;
      var hcv = global.document.getElementById('hud-canvas');
      if (hcv) hcv.style.display = this._hudVisible ? '' : 'none';
      this.hud.notify('HUD ' + (this._hudVisible ? '开' : '关'), 'info', 1200);
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
    FS.Log.info('=== 天际航线 SkyRoute v' + FS.CFG.version + ' 启动 ===');

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
    if (p.livery) s.livery = (FS.LIVERY_ALIASES && FS.LIVERY_ALIASES[p.livery]) || p.livery;
    if (p.rwy) s.runwayIdent = p.rwy;
    // beta 0.2: ?procedural=1 强制使用 v0.1 的程序化飞机模型 (对比/排错用)
    if (p.procedural !== undefined && p.procedural !== '0') FS.CFG.proceduralModels = true;
    // beta 0.3: ?online=0|1 联网地景开关 (不写入 localStorage), ?imagery=s2-2016|s2-2024|gibs
    if (p.online !== undefined) FS.CFG.onlineScenery = p.online !== '0' && p.online !== 'off';
    if (p.imagery && FS.OnlineScenery && FS.OnlineScenery.SOURCES.imagery[p.imagery]) FS.CFG.sceneryImagery = p.imagery;
    var osEl = global.document.getElementById('online-scenery');
    if (osEl) osEl.value = FS.CFG.onlineScenery ? '1' : '0';
    var imEl = global.document.getElementById('imagery-select');
    if (imEl) imEl.value = FS.CFG.sceneryImagery;

    // beta 0.3.1: ?view=panel 开场看仪表板 (?simple= 已废弃, 忽略)
    if (p.simple !== undefined) { /* 已取消 2D 六屏 */ }
    if (p.view) sim._startView = p.view;

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
