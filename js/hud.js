/* ==========================================================================
   天际航线 SkyRoute — 界面控制 (hud.js)
     主菜单 / 载入画面 / FCU 自动驾驶面板 / 中央操纵台 / 通知 / 暂停菜单
     所有 DOM 由 index.html 提供骨架, 这里负责数据绑定与交互
   ========================================================================== */
(function (global) {
  'use strict';

  var FS = global.FS = global.FS || {};
  var U = FS.Utils;
  var C = FS.CONST;

  function $(id) { return global.document.getElementById(id); }
  function $q(sel) { return global.document.querySelector(sel); }
  function $qa(sel) { return Array.prototype.slice.call(global.document.querySelectorAll(sel)); }

  function el(tag, cls, text) {
    var e = global.document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /* =====================================================================
     HUD 主类
     ===================================================================== */
  function HUD(sim) {
    this.sim = sim;
    this.notifications = [];
    this.visible = true;
    this.menuOpen = true;
    this.helpOpen = false;
    this.pauseOpen = false;
    this.pfdMode = 'captain';
    this._lastFma = '';
    this._lastChecklist = '';
    this._fcu = {
      spd: 250, spdIsMach: false, mach: 0.78,
      hdg: 0, alt: 10000, vs: 0,
      altStep: 100, spdStep: 1, hdgStep: 1
    };
    this.selected = {
      aircraft: FS.CFG.defaultAircraft,
      livery: FS.LIVERIES[0].id,
      depIcao: 'ZSPD',
      arrIcao: 'ZBAA',
      runwayIdent: null,
      scenario: 'takeoff',
      weather: 'few',
      timeOfDay: 10,
      fuelPct: 0.30,
      payloadPct: 0.70,
      timeScale: 1
    };
    this._bindings = [];
  }

  HUD.prototype.init = function () {
    this._buildMenuLists();
    this._bindMenu();
    this._bindFCU();
    this._bindPedestal();
    this._bindDisplays();
    this._bindKeyboard();
    this._tick = 0;
    return this;
  };

  /* ---------------------------------------------------------------------
     主菜单构建
     --------------------------------------------------------------------- */
  HUD.prototype._buildMenuLists = function () {
    var self = this;
    var doc = global.document;

    /* ---- 机型卡片 ---- */
    var grid = $('aircraft-grid');
    if (grid) {
      grid.innerHTML = '';
      var list = FS.AircraftList;
      // 按类别排序: 宽体 -> 窄体 -> 支线
      var order = { widebody: 0, narrowbody: 1, regional: 2 };
      list.sort(function (a, b) {
        var oa = order[a.class] !== undefined ? order[a.class] : 3;
        var ob = order[b.class] !== undefined ? order[b.class] : 3;
        if (oa !== ob) return oa - ob;
        return a.name.localeCompare(b.name);
      });
      list.forEach(function (ac) {
        var card = el('div', 'ac-card');
        card.dataset.key = ac.key;
        if (ac.key === self.selected.aircraft) card.classList.add('active');
        var db = FS.AIRCRAFT_DB[ac.key];
        card.innerHTML =
          '<div class="ac-badge">' + (ac.manufacturer === 'Airbus' ? 'AIRBUS' :
            ac.manufacturer === 'Boeing' ? 'BOEING' :
              ac.manufacturer === 'COMAC' ? 'COMAC' : ac.manufacturer.toUpperCase()) + '</div>' +
          '<div class="ac-name">' + ac.name + '</div>' +
          '<div class="ac-zh">' + ac.nameZh + '</div>' +
          '<div class="ac-specs">' +
          '<span>' + (db.dims.wingspan.toFixed(1)) + ' m 翼展</span>' +
          '<span>' + (db.mass.mtow / 1000).toFixed(0) + ' t MTOW</span>' +
          '<span>' + ac.seats + ' 座</span>' +
          '</div>' +
          '<div class="ac-engine">' + db.engines.count + ' × ' + db.engines.model + '</div>' +
          '<div class="ac-class">' + (ac.class === 'widebody' ? '宽体客机' :
            ac.class === 'narrowbody' ? '窄体客机' : '支线客机') + '</div>' +
          (function () {   // beta 0.2/0.3.2: 标注 3D 模型来源
            var as = (FS.Aircraft3D && FS.Aircraft3D.assetFor) ? FS.Aircraft3D.assetFor(ac.key) : (FS.ModelAssets && FS.ModelAssets[ac.key]);
            if (!as) return '<div class="ac-model ac-model-proc">程序化模型</div>';
            var label = as.hybrid ? '真实模型 · 近似' : (as.derived ? '真实模型 · 派生' : '真实模型');
            return '<div class="ac-model ac-model-real">' + label + '</div>';
          })();
        card.addEventListener('click', function () {
          self.selected.aircraft = ac.key;
          $qa('.ac-card').forEach(function (c) { c.classList.remove('active'); });
          card.classList.add('active');
          self._updateMenuSummary();
        });
        grid.appendChild(card);
      });
    }

    /* ---- 机场下拉 ---- */
    var depSel = $('dep-airport');
    var arrSel = $('arr-airport');
    var airports = FS.Airports.list.slice().sort(function (a, b) {
      var ra = a.region === 'china' ? 0 : 1;
      var rb = b.region === 'china' ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return (a.cityZh || a.city).localeCompare(b.cityZh || b.city);
    });
    function fill(s, selected) {
      if (!s) return;
      s.innerHTML = '';
      var regions = {};
      airports.forEach(function (a) {
        var reg = a.region || 'other';
        if (!regions[reg]) {
          regions[reg] = el('optgroup');
          regions[reg].label = ({
            'china': '中国', 'asia': '亚洲', 'europe': '欧洲',
            'north-america': '北美洲', 'oceania': '大洋洲',
            'south-america': '南美洲', 'africa': '非洲', 'middle-east': '中东'
          })[reg] || '其他';
          s.appendChild(regions[reg]);
        }
        var o = el('option');
        o.value = a.icao;
        o.textContent = a.icao + '  ' + (a.nameZh || a.name) + '  (' + (a.cityZh || a.city) + ')';
        if (a.icao === selected) o.selected = true;
        regions[reg].appendChild(o);
      });
    }
    fill(depSel, this.selected.depIcao);
    fill(arrSel, this.selected.arrIcao);

    /* ---- 场景列表 ---- */
    var scList = $('scenario-list');
    if (scList) {
      scList.innerHTML = '';
      this.sim.scenarioMgr.list().forEach(function (sc) {
        var row = el('div', 'sc-row');
        if (sc.id === self.selected.scenario) row.classList.add('active');
        row.innerHTML =
          '<div class="sc-left">' +
          '<div class="sc-name">' + sc.name + '</div>' +
          '<div class="sc-en">' + sc.nameEn + '</div>' +
          '</div>' +
          '<div class="sc-diff diff-' + (sc.difficulty === '入门' ? 'easy' :
            sc.difficulty === '进阶' ? 'mid' :
              sc.difficulty === '困难' ? 'hard' : 'free') + '">' + sc.difficulty + '</div>';
        row.addEventListener('click', function () {
          self.selected.scenario = sc.id;
          $qa('.sc-row').forEach(function (r) { r.classList.remove('active'); });
          row.classList.add('active');
          var d = $('scenario-desc');
          if (d) d.textContent = sc.description + '  ' + (sc.hint ? '提示: ' + sc.hint : '');
          self._updateMenuSummary();
        });
        scList.appendChild(row);
      });
    }

    /* ---- 天气 ---- */
    var wSel = $('weather-select');
    if (wSel) {
      wSel.innerHTML = '';
      FS.Environment.WEATHER_PRESETS.forEach(function (p) {
        var o = el('option');
        o.value = p.id;
        o.textContent = p.nameZh || p.name;
        if (p.id === self.selected.weather) o.selected = true;
        wSel.appendChild(o);
      });
    }

    /* ---- 涂装 ---- */
    var lSel = $('livery-select');
    if (lSel) {
      lSel.innerHTML = '';
      FS.LIVERIES.forEach(function (l) {
        var o = el('option');
        o.value = l.id;
        o.textContent = l.name;
        if (l.id === self.selected.livery) o.selected = true;
        lSel.appendChild(o);
      });
    }

    this._refreshRunways();
    this._updateMenuSummary();
  };

  HUD.prototype._refreshRunways = function () {
    var sel = $('runway-select');
    if (!sel) return;
    var icao = this.selected.depIcao;
    var ap = FS.Airports.byIcao(icao);
    sel.innerHTML = '';
    if (!ap) return;
    ap.runways.forEach(function (r) {
      var o = el('option');
      o.value = r.ident;
      o.textContent = r.ident + '  (' + Math.round(r.lengthFt) + ' ft × ' + Math.round(r.widthFt) + ' ft)  ' +
        U.pad(Math.round(r.hdgTrue), 3) + '°' + (r.ils ? '  ILS ' + r.ils.freq.toFixed(2) : '');
      sel.appendChild(o);
    });
    // 优先选择带 ILS 且较长的跑道
    var best = ap.runways.slice().sort(function (a, b) {
      return (b.ils ? 1 : 0) - (a.ils ? 1 : 0) || b.lengthFt - a.lengthFt;
    })[0];
    if (best) {
      sel.value = best.ident;
      this.selected.runwayIdent = best.ident;
    }
  };

  HUD.prototype._updateMenuSummary = function () {
    var s = this.selected;
    var ac = FS.AIRCRAFT_DB[s.aircraft];
    var dep = FS.Airports.byIcao(s.depIcao);
    var arr = FS.Airports.byIcao(s.arrIcao);
    var dist = (dep && arr) ? FS.Geo.greatCircleNm(dep.lat, dep.lon, arr.lat, arr.lon) : 0;
    var sum = $('menu-summary');
    if (sum) {
      sum.innerHTML =
        '<b>' + ac.nameZh + '</b> · ' + (s.livery ? FS.LIVERIES.filter(function (l) { return l.id === s.livery; })[0].name : '') +
        '<br>' + (dep ? dep.icao + ' ' + (dep.cityZh || dep.city) : '') + ' → ' +
        (arr ? arr.icao + ' ' + (arr.cityZh || arr.city) : '') +
        (dist ? '  ·  大圆距离 ' + Math.round(dist) + ' nm' : '') +
        '<br>跑道 ' + (s.runwayIdent || '--') + '  ·  燃油 ' + Math.round(s.fuelPct * 100) + '%  ·  业载 ' + Math.round(s.payloadPct * 100) + '%';
    }
  };

  /* ---------------------------------------------------------------------
     菜单交互
     --------------------------------------------------------------------- */
  HUD.prototype._bindMenu = function () {
    var self = this;
    var s = this.selected;

    function on(id, evt, fn) {
      var e = $(id);
      if (e) { e.addEventListener(evt, fn); self._bindings.push([e, evt, fn]); }
    }

    on('dep-airport', 'change', function (e) {
      s.depIcao = e.target.value;
      // 默认目的地不要和出发地相同
      if (s.arrIcao === s.depIcao) {
        var other = FS.Airports.list.filter(function (a) { return a.icao !== s.depIcao; })[0];
        if (other) { s.arrIcao = other.icao; $('arr-airport').value = other.icao; }
      }
      self._refreshRunways();
      self._updateMenuSummary();
    });
    on('arr-airport', 'change', function (e) { s.arrIcao = e.target.value; self._updateMenuSummary(); });
    on('runway-select', 'change', function (e) { s.runwayIdent = e.target.value; self._updateMenuSummary(); });
    on('weather-select', 'change', function (e) { s.weather = e.target.value; });
    on('livery-select', 'change', function (e) { s.livery = e.target.value; self._updateMenuSummary(); });
    // beta 0.3: 联网地景开关 + 影像源 (保存到 localStorage)
    var os = $('online-scenery'), is = $('imagery-select');
    if (os) os.value = FS.CFG.onlineScenery ? '1' : '0';
    if (is) is.value = FS.CFG.sceneryImagery || 's2-2016';
    on('online-scenery', 'change', function (e) {
      FS.CFG.onlineScenery = e.target.value === '1';
      try { global.localStorage.setItem('fs.onlineScenery', FS.CFG.onlineScenery ? '1' : '0'); } catch (er) { /* */ }
    });
    on('imagery-select', 'change', function (e) {
      FS.CFG.sceneryImagery = e.target.value;
      try { global.localStorage.setItem('fs.sceneryImagery', e.target.value); } catch (er) { /* */ }
    });

    on('time-slider', 'input', function (e) {
      s.timeOfDay = parseFloat(e.target.value);
      var lbl = $('time-value');
      if (lbl) lbl.textContent = U.pad(Math.floor(s.timeOfDay), 2) + ':' + U.pad(Math.floor((s.timeOfDay % 1) * 60), 2);
    });
    on('fuel-slider', 'input', function (e) {
      s.fuelPct = parseFloat(e.target.value);
      var lbl = $('fuel-value');
      if (lbl) {
        var ac = FS.AIRCRAFT_DB[s.aircraft];
        lbl.textContent = Math.round(s.fuelPct * 100) + '%  (' + Math.round(s.fuelPct * ac.mass.maxFuel / 1000) + ' t)';
      }
      self._updateMenuSummary();
    });
    on('payload-slider', 'input', function (e) {
      s.payloadPct = parseFloat(e.target.value);
      var lbl = $('payload-value');
      if (lbl) {
        var ac = FS.AIRCRAFT_DB[s.aircraft];
        lbl.textContent = Math.round(s.payloadPct * 100) + '%  (' + Math.round(s.payloadPct * ac.mass.maxPayload / 1000) + ' t)';
      }
      self._updateMenuSummary();
    });
    on('timescale-select', 'change', function (e) { s.timeScale = parseFloat(e.target.value); });

    on('start-flight', 'click', function () {
      self.hideMenu();
      self.sim.startFlight({
        aircraft: s.aircraft, livery: s.livery, depIcao: s.depIcao, arrIcao: s.arrIcao,
        runwayIdent: s.runwayIdent, scenario: s.scenario, weather: s.weather,
        timeOfDay: s.timeOfDay, fuelPct: s.fuelPct, payloadPct: s.payloadPct
      });
    });
    on('quick-start', 'click', function () {
      self.hideMenu();
      self.sim.startFlight({
        aircraft: s.aircraft, livery: s.livery, depIcao: s.depIcao, arrIcao: s.arrIcao,
        runwayIdent: s.runwayIdent, scenario: 'takeoff', weather: 'few',
        timeOfDay: 10, fuelPct: 0.30, payloadPct: 0.70
      });
    });
    on('back-to-menu', 'click', function () { self.sim.returnToMenu(); });
    on('resume-flight', 'click', function () { self.closePause(); });
    on('pause-to-menu', 'click', function () { self.closePause(); self.sim.returnToMenu(); });
    on('close-help', 'click', function () { self.toggleHelp(false); });
    on('help-btn', 'click', function () { self.toggleHelp(); });
    on('menu-btn', 'click', function () { self.openPause(); });
  };

  /* ---------------------------------------------------------------------
     FCU 自动驾驶控制面板
     --------------------------------------------------------------------- */
  HUD.prototype._bindFCU = function () {
    var self = this;
    var sim = this.sim;

    function knob(id, delta) {
      var e = $(id);
      if (!e) return;
      e.addEventListener('mousedown', function (ev) {
        ev.preventDefault();
        var dir = (id.indexOf('inc') >= 0) ? 1 : -1;
        self._knobAdjust(id, dir);
        // 长按连续调整
        var timer = global.setInterval(function () { self._knobAdjust(id, dir); }, 110);
        var stop = function () { global.clearInterval(timer); global.removeEventListener('mouseup', stop); };
        global.addEventListener('mouseup', stop);
      });
      e.addEventListener('wheel', function (ev) {
        ev.preventDefault();
        self._knobAdjust(id, ev.deltaY < 0 ? 1 : -1);
      }, { passive: false });
    }

    ['fcu-spd-dec', 'fcu-spd-inc', 'fcu-hdg-dec', 'fcu-hdg-inc',
      'fcu-alt-dec', 'fcu-alt-inc', 'fcu-vs-dec', 'fcu-vs-inc'].forEach(function (id) { knob(id); });

    function btn(id, fn) {
      var e = $(id);
      if (e) e.addEventListener('click', function (ev) { ev.preventDefault(); fn(e); });
    }

    btn('fcu-spd-push', function () {
      sim.ap.setThrustMode(self._fcu.spdIsMach ? 'MACH' : 'SPEED');
      self.notify('A/THR ' + (self._fcu.spdIsMach ? 'MACH' : 'SPEED') + ' 模式', 'info');
    });
    btn('fcu-spd-pull', function () {
      sim.ap.ap.athr = true;
      sim.ap.setThrustMode(self._fcu.spdIsMach ? 'MACH' : 'SPEED');
      if (self._fcu.spdIsMach) sim.ap.setTargetMach(self._fcu.mach);
      else sim.ap.setTargetSpeed(self._fcu.spd);
      self.notify('速度选择 ' + (self._fcu.spdIsMach ? 'M' + self._fcu.mach.toFixed(3) : self._fcu.spd + ' kt'), 'info');
    });
    btn('fcu-spd-mach', function () {
      self._fcu.spdIsMach = !self._fcu.spdIsMach;
      $('fcu-spd-mode').textContent = self._fcu.spdIsMach ? 'MACH' : 'SPD';
      self._updateFCUDisplay();
    });

    btn('fcu-hdg-push', function () {
      sim.ap.setRollMode('NAV');
      self.notify('LNAV 已接通', 'info');
    });
    btn('fcu-hdg-pull', function () {
      sim.ap.setRollMode('HDG');
      sim.ap.setTargetHdg(self._fcu.hdg);
      self.notify('航向选择 ' + U.pad(self._fcu.hdg, 3) + '°', 'info');
    });

    btn('fcu-alt-push', function () {
      sim.ap.setTargetAlt(sim.fm.ac.perf.ceiling);
      sim.ap.setPitchMode('ALT');
      self.notify('爬升至最高高度 ' + sim.fm.ac.perf.ceiling + ' ft', 'info');
    });
    btn('fcu-alt-pull', function () {
      sim.ap.setTargetAlt(self._fcu.alt);
      sim.ap.setPitchMode('ALT SEL');
      self.notify('目标高度 ' + self._fcu.alt + ' ft', 'info');
    });

    btn('fcu-vs-push', function () {
      sim.ap.setPitchMode('ALT');
      self.notify('高度保持', 'info');
    });
    btn('fcu-vs-pull', function () {
      sim.ap.setTargetVs(self._fcu.vs);
      sim.ap.setPitchMode('VS');
      self.notify('垂直速度 ' + (self._fcu.vs >= 0 ? '+' : '') + self._fcu.vs + ' fpm', 'info');
    });

    btn('fcu-ap1', function () {
      if (sim.ap.ap.ap1) sim.ap.disengage('人工断开');
      else sim.ap.engage(1);
    });
    btn('fcu-ap2', function () {
      if (sim.ap.ap.ap2) sim.ap.disengage('人工断开');
      else sim.ap.engage(2);
    });
    btn('fcu-athr', function () {
      sim.ap.ap.athr = !sim.ap.ap.athr;
      if (sim.ap.ap.athr && !sim.ap.ap.thrustMode) sim.ap.setThrustMode('SPEED');
      self.notify('自动推力 ' + (sim.ap.ap.athr ? '接通' : '断开'), sim.ap.ap.athr ? 'info' : 'warn');
    });
    btn('fcu-loc', function () {
      sim.ap.ap.locArmed = !sim.ap.ap.locArmed;
      sim.ap.setRollMode(sim.ap.ap.locArmed ? 'LOC' : 'HDG');
      self.notify('LOC ' + (sim.ap.ap.locArmed ? '预位' : '取消'), 'info');
    });
    btn('fcu-appr', function () {
      sim.ap.armAppr(!sim.ap.ap.apprArmed);
      self.notify('APPR ' + (sim.ap.ap.apprArmed ? '预位' : '取消'), 'info');
    });
    btn('fcu-exped', function () {
      sim.ap.setPitchMode('FLCH');
      self.notify('FLCH / 速度优先', 'info');
    });
    btn('fcu-apdisconnect', function () {
      sim.ap.disengage('人工断开');
      self.notify('自动驾驶断开', 'warn');
    });
    btn('fcu-level', function () {
      sim.ap.setPitchMode('ALT');
      sim.ap.setRollMode('HDG');
      sim.ap.setTargetHdg(U.wrap360(Math.round(sim.fm.heading)));
      self.notify('恢复机翼水平', 'info');
    });
    btn('fcu-toga', function () {
      sim.ap.goAround();
      self.notify('复飞 TOGA', 'warn');
    });

    // 自动油门开关
    btn('fcu-level-change', function () { });
  };

  HUD.prototype._knobAdjust = function (id, dir) {
    var f = this._fcu;
    if (id.indexOf('spd') === 0) {
      if (f.spdIsMach) {
        f.mach = U.clamp(Math.round((f.mach + dir * 0.01) * 100) / 100, 0.40, 0.92);
      } else {
        f.spd = U.clamp(f.spd + dir, 100, 400);
      }
      if (this.sim.ap && this.sim.ap.ap.engaged) {
        if (f.spdIsMach && this.sim.ap.ap.thrustMode === 'MACH') this.sim.ap.setTargetMach(f.mach);
        if (!f.spdIsMach && this.sim.ap.ap.thrustMode === 'SPEED') this.sim.ap.setTargetSpeed(f.spd);
      }
    } else if (id.indexOf('hdg') === 0) {
      f.hdg = U.wrap360(Math.round(f.hdg + dir));
      if (this.sim.ap && this.sim.ap.ap.engaged && this.sim.ap.ap.rollMode === 'HDG') {
        this.sim.ap.setTargetHdg(f.hdg);
      }
    } else if (id.indexOf('alt') === 0) {
      f.alt = U.clamp(f.alt + dir * f.altStep, 0, 60000);
    } else if (id.indexOf('vs') === 0) {
      f.vs = U.clamp(f.vs + dir * 100, -6000, 6000);
      if (this.sim.ap && this.sim.ap.ap.engaged && this.sim.ap.ap.pitchMode === 'VS') {
        this.sim.ap.setTargetVs(f.vs);
      }
    }
    this._updateFCUDisplay();
  };

  HUD.prototype._updateFCUDisplay = function () {
    var f = this._fcu;
    var e;
    if (!f) return;
    if ((e = $('fcu-spd-val'))) e.textContent = f.spdIsMach ? f.mach.toFixed(3) : U.pad(f.spd, 3);
    if ((e = $('fcu-hdg-val'))) e.textContent = U.pad(f.hdg, 3);
    if ((e = $('fcu-alt-val'))) e.textContent = f.alt >= 1000 ? U.pad(Math.round(f.alt / 100), 3) : String(f.alt);
    if ((e = $('fcu-vs-val'))) e.textContent = (f.vs >= 0 ? '+' : '-') + U.pad(Math.abs(f.vs), 4);
    if ((e = $('fcu-spd-unit'))) e.textContent = f.spdIsMach ? '' : 'kt';
  };

  /* ---------------------------------------------------------------------
     中央操纵台
     --------------------------------------------------------------------- */
  HUD.prototype._bindPedestal = function () {
    var self = this;
    var sim = this.sim;

    function btn(id, fn) {
      var e = $(id);
      if (e) e.addEventListener('click', function (ev) { ev.preventDefault(); fn(e); });
    }

    // 油门杆 (拖拽)
    this._initThrottleLevers();

    // 襟翼卡位
    this._buildFlapDetents();

    // 起落架
    btn('gear-up', function () {
      if (sim.fm.tas > 250 * C.KT) { self.notify('空速过高, 起落架不能收放', 'warn'); return; }
      sim.fm.setGear(false); self.notify('起落架 收上', 'info');
    });
    btn('gear-down', function () {
      if (sim.fm.tas > 260 * C.KT) { self.notify('空速过高, 起落架不能收放', 'warn'); return; }
      sim.fm.setGear(true); self.notify('起落架 放下', 'info');
    });

    // 扰流板
    btn('spoiler-arm', function () {
      sim.fm.spoilerArmedLanding = !sim.fm.spoilerArmedLanding;
      $('spoiler-arm').classList.toggle('on', sim.fm.spoilerArmedLanding);
      self.notify('地面扰流板 ' + (sim.fm.spoilerArmedLanding ? '预位' : '解除预位'), 'info');
    });
    btn('speedbrake-toggle', function () {
      sim.fm.setSpoilers(sim.fm.spoilerCmd > 0.5 ? 0 : 1);
    });

    // 停留刹车
    btn('park-brake', function () {
      sim.fm.setParkingBrake(!sim.fm.parkingBrake);
      $('park-brake').classList.toggle('on', sim.fm.parkingBrake);
      self.notify('停留刹车 ' + (sim.fm.parkingBrake ? 'ON' : 'OFF'), 'info');
    });

    // 自动刹车
    var abList = $('autobrake-list');
    if (abList && !sim.fm) abList.innerHTML = '';
    var abModes = sim.fm ? sim.fm.ac.systems.autoBrake : [];
    if (abList && sim.fm) {
      abList.innerHTML = '';
      abModes.forEach(function (m) {
        var b = el('button', 'ab-btn', m);
        b.dataset.mode = m;
        if (m === sim.fm.autoBrake) b.classList.add('on');
        b.addEventListener('click', function () {
          sim.fm.setAutoBrake(m);
          $qa('#autobrake-list .ab-btn').forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on');
          self.notify('自动刹车 ' + m, 'info');
        });
        abList.appendChild(b);
      });
    }

    // APU
    btn('apu-btn', function () {
      if (sim.fm.apuRunning) { sim.fm.stopAPU(); self.notify('APU 停车', 'info'); }
      else { sim.fm.startAPU(); self.notify('APU 起动中, 约 60 秒后可用', 'info'); }
      $('apu-btn').classList.toggle('on', sim.fm.apuRunning);
    });

    // 发动机起动
    for (var i = 0; i < 2; i++) {
      (function (idx) {
        btn('eng-start-' + (idx + 1), function () {
          var e = sim.fm.engines[idx];
          if (e.state === 'off') { sim.fm.startEngine(idx); self.notify('发动机 ' + (idx + 1) + ' 起动中', 'info'); }
          else { sim.fm.shutdownEngine(idx); self.notify('发动机 ' + (idx + 1) + ' 关车', 'info'); }
        });
      })(i);
    }
    btn('eng-start-all', function () {
      sim.fm.startEngine('all');
      self.notify('全部发动机起动中', 'info');
    });

    // 反推
    for (var j = 0; j < 2; j++) {
      (function (idx) {
        btn('reverser-' + (idx + 1), function (ev) {
          var e = sim.fm.engines[idx];
          e.reverserArmed = !e.reverserArmed;
          $('reverser-' + (idx + 1)).classList.toggle('on', e.reverserArmed);
        });
      })(j);
    }

    // 灯光
    var lightIds = ['landing', 'taxi', 'strobe', 'beacon', 'nav', 'logo', 'wing', 'cabin'];
    var lightNames = { landing: '着陆灯', taxi: '滑行灯', strobe: '频闪灯', beacon: '信标灯', nav: '航行灯', logo: '标志灯', wing: '机翼灯', cabin: '客舱灯' };
    var lightPanel = $('lights-panel');
    if (lightPanel) {
      lightPanel.innerHTML = '';
      lightIds.forEach(function (id) {
        var b = el('button', 'light-btn', lightNames[id]);
        b.dataset.light = id;
        b.addEventListener('click', function () {
          var st = sim.getLights();
          st[id] = !st[id];
          sim.setLights(st);
          b.classList.toggle('on', st[id]);
        });
        lightPanel.appendChild(b);
      });
    }
  };

  HUD.prototype._buildFlapDetents = function () {
    var self = this;
    var sim = this.sim;
    var wrap = $('flap-detents');
    if (!wrap) return;
    if (!sim.fm) { wrap.innerHTML = ''; return; }
    var dts = FS.Aero.flapDetents(sim.fm.typeKey);
    wrap.innerHTML = '';
    dts.forEach(function (name, i) {
      var b = el('button', 'flap-detent', name);
      b.dataset.idx = i;
      b.addEventListener('click', function () {
        var nm = sim.fm.setFlapDetent(i);
        $qa('.flap-detent').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        self.notify('襟翼 ' + nm, 'info');
      });
      wrap.appendChild(b);
    });
    this._highlightFlapDetent(sim.fm.flapDetentIndex || 0);
  };

  HUD.prototype._highlightFlapDetent = function (idx) {
    var btns = $qa('.flap-detent');
    btns.forEach(function (x, i) {
      x.classList.toggle('on', i === idx);
    });
  };

  HUD.prototype._initThrottleLevers = function () {
    var self = this;
    var sim = this.sim;
    var track = $('throttle-track');
    if (!track) return;
    if (!sim.fm) { track.innerHTML = ''; this.throttleLevers = []; return; }   // 尚未选定机型
    var n = sim.fm.engines.length;
    this.throttleLevers = [];

    for (var i = 0; i < n; i++) {
      (function (idx) {
        var lever = el('div', 'throttle-lever');
        lever.dataset.idx = idx;
        var knobEl = el('div', 'throttle-knob');
        lever.appendChild(knobEl);
        track.appendChild(lever);

        var dragging = false;
        function setFromY(clientY) {
          var r = track.getBoundingClientRect();
          var frac = 1 - U.clamp01((clientY - r.top) / r.height);
          sim.fm.setThrottle(idx, frac);
          self._throttleSync = true;
        }
        knobEl.addEventListener('mousedown', function (ev) {
          ev.preventDefault(); dragging = true;
          var mv = function (e2) { if (dragging) setFromY(e2.clientY); };
          var up = function () {
            dragging = false;
            global.removeEventListener('mousemove', mv);
            global.removeEventListener('mouseup', up);
          };
          global.addEventListener('mousemove', mv);
          global.addEventListener('mouseup', up);
          setFromY(ev.clientY);
        });
        // 触摸
        knobEl.addEventListener('touchstart', function (ev) {
          ev.preventDefault(); dragging = true;
          var r = track.getBoundingClientRect();
          var frac = 1 - U.clamp01((ev.touches[0].clientY - r.top) / r.height);
          sim.fm.setThrottle(idx, frac);
          var mv = function (e2) {
            var rr = track.getBoundingClientRect();
            var f2 = 1 - U.clamp01((e2.touches[0].clientY - rr.top) / rr.height);
            sim.fm.setThrottle(idx, f2);
          };
          var up = function () {
            dragging = false;
            global.removeEventListener('touchmove', mv);
            global.removeEventListener('touchend', up);
          };
          global.addEventListener('touchmove', mv, { passive: false });
          global.addEventListener('touchend', up);
        }, { passive: false });

        self.throttleLevers.push({ el: lever, knob: knobEl, idx: idx });
      })(i);
    }

    // 油门预设按钮
    ['idle', 'climb', 'flex', 'toga'].forEach(function (mode) {
      var b = $('thr-' + mode);
      if (!b) return;
      b.addEventListener('click', function () {
        var v = mode === 'idle' ? 0 : mode === 'climb' ? 0.82 : mode === 'flex' ? 0.92 : 1.0;
        sim.fm.setThrottle('all', v);
        self.notify('油门 ' + mode.toUpperCase(), 'info');
      });
    });
  };

  HUD.prototype._updateThrottleLevers = function () {
    if (!this.throttleLevers) return;
    var th = this.sim.fm.throttle;
    for (var i = 0; i < this.throttleLevers.length; i++) {
      var L = this.throttleLevers[i];
      var v = th[L.idx] || 0;
      L.knob.style.bottom = (v * 100) + '%';
      L.el.classList.toggle('reverser', this.sim.fm.engines[L.idx].reverserPos > 0.05);
    }
  };

  /* ---------------------------------------------------------------------
     显示面板
     --------------------------------------------------------------------- */
  HUD.prototype._bindDisplays = function () {
    var self = this;
    var sim = this.sim;

    function btn(id, fn) {
      var e = $(id);
      if (e) e.addEventListener('click', function (ev) { ev.preventDefault(); fn(e); });
    }

    btn('nd-range-up', function () { sim.ndL.cycleRange(true); sim.ndR.cycleRange(true); });
    btn('nd-range-down', function () { sim.ndL.cycleRange(false); sim.ndR.cycleRange(false); });
    btn('nd-mode', function () {
      var m = sim.ndL.mode === 'ROSE' ? 'ARC' : 'ROSE';
      sim.ndL.mode = m; sim.ndR.mode = m;
      self.notify('ND 模式 ' + m, 'info');
    });
    btn('nd-terrain', function () {
      sim.ndL.terrainOn = !sim.ndL.terrainOn;
      sim.ndR.terrainOn = sim.ndL.terrainOn;
      $('nd-terrain').classList.toggle('on', sim.ndL.terrainOn);
    });
    btn('nd-weather', function () {
      sim.ndL.weatherOn = !sim.ndL.weatherOn;
      sim.ndR.weatherOn = sim.ndL.weatherOn;
      $('nd-weather').classList.toggle('on', sim.ndL.weatherOn);
    });

    btn('panel-toggle', function () { self.toggleSidePanels(); });
    // beta 0.3.1: 看仪表板 (已取消简化仪表 / 2D 六屏)
    btn('panelview-btn', function () { if (sim.togglePanelView) sim.togglePanelView(); });

    /* ---- beta 0.3: 视角按钮 (点击/触摸循环, 下拉直接选择) ---- */
    var vsel = $('view-select');
    if (vsel && FS.CameraRig && FS.CameraRig.VIEW_LIST) {
      vsel.innerHTML = '';
      FS.CameraRig.VIEW_LIST.forEach(function (v) {
        var o = el('option'); o.value = v.id; o.textContent = v.name; vsel.appendChild(o);
      });
      vsel.addEventListener('change', function () {
        sim.cameraRig.setMode(vsel.value);
        self.notify('视角: ' + sim.cameraRig.getModeName(), 'info', 1500);
        vsel.blur();
      });
    }
    btn('view-btn', function () {
      sim.cameraRig.cycle(1);
      self.notify('视角: ' + sim.cameraRig.getModeName(), 'info', 1500);
    });
    FS.Bus.on('camera:mode', function (e) {
      var vn = $('view-name'); if (vn) vn.textContent = (e.name || '').replace(/\s*\(.*\)/, '');
      var vs = $('view-select'); if (vs && vs.value !== e.mode) vs.value = e.mode;
    });
    btn('yoke-btn', function () {
      if (!sim.input) return;
      sim.input.setMouseYoke(!sim.input.mouseYoke);
      self.notify(sim.input.mouseYoke ? '鼠标驾驶杆: 开 (光标相对屏幕中心 = 杆量, M 键关闭)' : '鼠标驾驶杆: 关', 'info', 3000);
    });
    FS.Bus.on('input:mouseYoke', function (e) {
      var b = $('yoke-btn'); if (b) b.classList.toggle('on', !!e.on);
      var r = $('yoke-reticle'); if (r) r.classList.toggle('hidden', !e.on);
    });
    btn('ui-toggle', function () {
      self.visible = !self.visible;
      var u = $('ui');
      if (u) u.classList.toggle('hidden');
    });
    btn('baro-std', function () {
      sim.pfdL.baroStd = !sim.pfdL.baroStd;
      sim.pfdR.baroStd = sim.pfdL.baroStd;
      $('baro-std').classList.toggle('on', sim.pfdL.baroStd);
    });
    btn('baro-dec', function () {
      sim.pfdL.baroSetting = Math.max(950, sim.pfdL.baroSetting - 1);
      sim.pfdR.baroSetting = sim.pfdL.baroSetting;
    });
    btn('baro-inc', function () {
      sim.pfdL.baroSetting = Math.min(1050, sim.pfdL.baroSetting + 1);
      sim.pfdR.baroSetting = sim.pfdL.baroSetting;
    });
  };

  /** beta 0.3.1: 侧边面板 (左: 目标 / 检查单, 右: 中央操纵台) 显示 / 隐藏 */
  HUD.prototype.toggleSidePanels = function (on) {
    var l = $('left-col'), r = $('right-col');
    this._sidePanelsUser = true;
    var anyHidden = (l && l.classList.contains('hidden')) || (r && r.classList.contains('hidden'));
    var hide = on === undefined ? !anyHidden : !on;
    if (l) l.classList.toggle('hidden', hide);
    if (r) r.classList.toggle('hidden', hide);
    var b = $('panel-toggle'); if (b) b.classList.toggle('on', !hide);
    return !hide;
  };

  /* ---------------------------------------------------------------------
     键盘快捷 (仅处理 UI 相关)
     --------------------------------------------------------------------- */
  HUD.prototype._bindKeyboard = function () {
    var self = this;
    global.addEventListener('keydown', function (ev) {
      if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT')) return;
      switch (ev.code) {
        case 'F1':
          ev.preventDefault();
          self.toggleHelp();
          break;
        case 'Slash':
          if (ev.key === '?' || ev.shiftKey) { ev.preventDefault(); self.toggleHelp(); }
          break;
        case 'Escape':
          ev.preventDefault();
          if (self.helpOpen) self.toggleHelp(false);
          else if (self.pauseOpen) self.closePause();
          else if (!self.menuOpen) self.openPause();
          break;
        case 'Tab':
          // beta 0.3.1: Tab / Shift+Tab = 侧边面板 (检查单 / 操纵台); 已取消简化仪表
          ev.preventDefault();
          if (self.menuOpen) break;
          self.toggleSidePanels();
          break;
        case 'Backquote':
          var u = $('ui');
          if (u) u.classList.toggle('hidden');
          break;
      }
    });
  };

  /* ---------------------------------------------------------------------
     飞航阶段面板更新
     --------------------------------------------------------------------- */
  HUD.prototype.update = function (dt, st) {
    this._tick += dt;
    if (this._tick < 1 / 12 && this.menuOpen) return;
    this._tick = 0;
    if (!st || !this.sim.fm) return;

    this._updateThrottleLevers();
    // 暂停提示 + 鼠标驾驶杆准星
    var pi = $('pause-indicator');
    if (pi) pi.classList.toggle('hidden', !(this.sim.paused && !this.pauseOpen && !this.menuOpen));
    var inp = this.sim.input;
    if (inp && inp.mouseYoke) {
      var dot = $('yoke-dot');
      if (dot) dot.style.transform = 'translate(' + (inp.mouseStick.x * 60).toFixed(1) + 'px,' + (inp.mouseStick.y * 60).toFixed(1) + 'px)';
    }
    this._updateFCUDisplay();
    this._updateStatusBar(st);
    this._updateObjectives(st);
    this._updateChecklist(st);
    this._updateFMA(st);
    this._updateGearIndicator(st);
    this._updateFuelGauge(st);
  };

  HUD.prototype._updateStatusBar = function (st) {
    var e;
    if ((e = $('sb-ias'))) e.textContent = Math.round(st.iasKt) + ' kt';
    if ((e = $('sb-mach'))) e.textContent = 'M' + st.mach.toFixed(3);
    if ((e = $('sb-alt'))) e.textContent = Math.round(st.altFt).toLocaleString() + ' ft';
    if ((e = $('sb-agl'))) e.textContent = st.aglFt < 2500 ? Math.round(st.aglFt) + ' ft AGL' : '';
    if ((e = $('sb-vs'))) e.textContent = (st.vsFpm >= 0 ? '+' : '') + Math.round(st.vsFpm) + ' fpm';
    if ((e = $('sb-hdg'))) e.textContent = U.pad(Math.round(st.heading), 3) + '°';
    if ((e = $('sb-wind'))) e.textContent = U.pad(Math.round(st.wind.dir), 3) + '°/' + Math.round(st.wind.speed) + ' kt';
    if ((e = $('sb-n1'))) {
      e.textContent = st.engines.map(function (g) { return Math.round(g.n1); }).join(' / ') + ' %';
    }
    if ((e = $('sb-fuel'))) e.textContent = (st.fuelKg / 1000).toFixed(1) + ' t';
    if ((e = $('sb-gw'))) e.textContent = (st.gw / 1000).toFixed(1) + ' t';
    if ((e = $('sb-time'))) {
      var t = st.flightTime;
      e.textContent = U.pad(Math.floor(t / 3600), 2) + ':' + U.pad(Math.floor(t / 60) % 60, 2) + ':' + U.pad(Math.floor(t) % 60, 2);
    }
    if ((e = $('sb-trk'))) e.textContent = 'TRK ' + U.pad(Math.round(st.track), 3) + '°';
    if ((e = $('sb-gs'))) e.textContent = Math.round(st.gsKt) + ' kt GS';

    // 告警主灯
    var mw = $('master-warning'), mc = $('master-caution');
    if (mw) mw.classList.toggle('lit', st.masterWarning);
    if (mc) mc.classList.toggle('lit', st.overspeed || st.configWarning || st.stallWarning);
  };

  HUD.prototype._updateObjectives = function (st) {
    var wrap = $('objectives');
    if (!wrap) return;
    var mgr = this.sim.scenarioMgr;
    if (!mgr.objectives.length) { wrap.innerHTML = ''; return; }
    var html = '<div class="obj-title">' + mgr.title + '</div>';
    mgr.objectives.forEach(function (o) {
      var cls = o.done ? 'done' : '';
      html += '<div class="obj-row ' + cls + '">' +
        '<span class="obj-mark">' + (o.done ? '✓' : '○') + '</span>' +
        '<span class="obj-text">' + o.text + '</span>' +
        (o.continuous && !o.done ? '<span class="obj-bar"><i style="width:' + Math.round((o.progressPct || 0) * 100) + '%"></i></span>' : '') +
        '</div>';
    });
    wrap.innerHTML = html;
  };

  HUD.prototype._updateChecklist = function (st) {
    var wrap = $('checklist-body');
    if (!wrap) return;
    var cl = this.sim.checklistMgr;
    if (!cl.active) return;
    var status = cl.status(st);
    var sig = cl.active + '|' + status.items.map(function (i) { return i.done ? 1 : 0; }).join('');
    if (sig === this._lastChecklist) return;
    this._lastChecklist = sig;

    var html = '<div class="cl-head">' + status.name + ' <span>(' + status.nameEn + ')</span>' +
      '<b>' + status.items.filter(function (i) { return i.done; }).length + '/' + status.items.length + '</b></div>';
    status.items.forEach(function (i) {
      html += '<div class="cl-row ' + (i.done ? 'done' : '') + '">' +
        '<span class="cl-box">' + (i.done ? '✓' : '') + '</span>' +
        '<span class="cl-text">' + i.text + '</span></div>';
    });
    wrap.innerHTML = html;
    var t = $('checklist-title');
    if (t) t.textContent = status.name;
  };

  HUD.prototype._updateFMA = function (st) {
    var e = $('fma-strip');
    if (!e) return;
    var fma = this.sim.ap.getFMA();
    var html =
      '<span class="fma-a">' + fma.thrust + '</span>' +
      '<span class="fma-v">' + fma.pitch + '</span>' +
      '<span class="fma-l">' + fma.roll + '</span>';
    if (html !== this._lastFma) {
      e.innerHTML = html;
      this._lastFma = html;
    }
    // AP/ATHR 指示灯
    var lit = function (id, on) { var x = $(id); if (x) x.classList.toggle('on', !!on); };
    lit('fcu-ap1', fma.ap1); lit('fcu-ap2', fma.ap2); lit('fcu-athr', fma.athr);
    lit('fcu-loc', this.sim.ap.locCaptured);
    lit('fcu-appr', this.sim.ap.ap.apprArmed);
  };

  HUD.prototype._updateGearIndicator = function (st) {
    var g = $('gear-indicator');
    if (!g) return;
    var cls = st.gearPos > 0.99 ? 'down' : (st.gearPos < 0.01 ? 'up' : 'transit');
    if (g.dataset.state !== cls) {
      g.dataset.state = cls;
      g.className = 'gear-indicator ' + cls;
      var t = st.gearPos > 0.99 ? 'DOWN' : (st.gearPos < 0.01 ? 'UP' : 'IN TRANSIT');
      g.textContent = t;
    }
  };

  HUD.prototype._updateFuelGauge = function (st) {
    var bar = $('fuel-bar-fill');
    if (bar) bar.style.width = (st.fuelKg / st.fuelCapacity * 100).toFixed(1) + '%';
    var t = $('fuel-text');
    if (t) t.textContent = (st.fuelKg / 1000).toFixed(2) + ' t / ' + (st.fuelCapacity / 1000).toFixed(0) + ' t';
  };

  /* ---------------------------------------------------------------------
     通知
     --------------------------------------------------------------------- */
  HUD.prototype.notify = function (text, type, duration) {
    type = type || 'info';
    duration = duration || (type === 'error' ? 6000 : type === 'warn' ? 4500 : 3000);
    var wrap = $('notifications');
    if (!wrap) return;
    var n = el('div', 'notif notif-' + type);
    n.textContent = text;
    wrap.appendChild(n);
    // 最多保留 6 条
    while (wrap.children.length > 6) wrap.removeChild(wrap.firstChild);
    global.setTimeout(function () {
      n.classList.add('fade');
      global.setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 500);
    }, duration);
    this.notifications.push({ text: text, type: type, t: Date.now() });
    if (this.notifications.length > 60) this.notifications.shift();
  };

  /* ---------------------------------------------------------------------
     面板开关
     --------------------------------------------------------------------- */
  HUD.prototype.showMenu = function () {
    var m = $('main-menu');
    if (m) m.classList.remove('hidden');
    var u = $('ui');
    if (u) u.classList.add('hidden');
    this.menuOpen = true;
  };
  HUD.prototype.hideMenu = function () {
    var m = $('main-menu');
    if (m) m.classList.add('hidden');
    var u = $('ui');
    if (u) u.classList.remove('hidden');
    this.menuOpen = false;
  };
  HUD.prototype.openPause = function () {
    var p = $('pause-menu');
    if (p) p.classList.remove('hidden');
    this.pauseOpen = true;
    this.sim.setPaused(true);
  };
  HUD.prototype.closePause = function () {
    var p = $('pause-menu');
    if (p) p.classList.add('hidden');
    this.pauseOpen = false;
    this.sim.setPaused(false);
  };
  HUD.prototype.toggleHelp = function (force) {
    var h = $('help-overlay');
    if (!h) return;
    this.helpOpen = force !== undefined ? force : !this.helpOpen;
    h.classList.toggle('hidden', !this.helpOpen);
  };

  /** 同步菜单选择到飞行中面板 */
  HUD.prototype.syncFromSim = function () {
    var f = this._fcu;
    f.hdg = Math.round(this.sim.fm.heading);
    f.alt = Math.round(this.sim.fm.altFt / 100) * 100;
    f.spd = Math.max(100, Math.round(this.sim.fm.iasKt));
    this._updateFCUDisplay();
    this._buildFlapDetents();
    // 重建油门杆 (机型可能不同)
    var track = $('throttle-track');
    if (track) { track.innerHTML = ''; this._initThrottleLevers(); }
    // 重建自动刹车
    var abList = $('autobrake-list');
    if (abList) {
      var self = this;
      abList.innerHTML = '';
      this.sim.fm.ac.systems.autoBrake.forEach(function (m) {
        var b = el('button', 'ab-btn', m);
        if (m === 'OFF') b.classList.add('on');
        b.addEventListener('click', function () {
          self.sim.fm.setAutoBrake(m);
          $qa('#autobrake-list .ab-btn').forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on');
          self.notify('自动刹车 ' + m, 'info');
        });
        abList.appendChild(b);
      });
    }
    if ($('spoiler-arm')) $('spoiler-arm').classList.toggle('on', true);
    this.sim.fm.spoilerArmedLanding = true;
  };

  FS.HUD = HUD;
  FS.Log.info('hud.js 已加载 — 界面控制就绪');

})(typeof window !== 'undefined' ? window : globalThis);
