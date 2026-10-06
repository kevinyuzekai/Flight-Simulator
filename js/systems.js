/* ==========================================================================
   天际航线 SkyRoute — 飞机系统 (systems.js, beta 0.4.2)
   --------------------------------------------------------------------------
   简化的冷舱启动 (COLD & DARK) 系统逻辑, 供三维驾驶舱开关驱动:
     · 电源: BAT 1/2, EXT PWR (地面静止时可用), APU GEN / GEN 1·2 (自动)
     · APU: MASTER SW → START → 约 30 s 后 AVAIL; APU BLEED
     · ADIRS: IR 1/2/3 (波音 IRS L/R) OFF / NAV / ATT, 对准计时 (默认 75 s)
     · 燃油泵 6 个, 引气 (ENG 1/2 BLEED, X BLEED / ISOLATION VALVE), PACK 1/2
     · 液压: ENG 1/2 PUMP, ELEC PUMP, PTU (波音: ELEC 1/2), 防冰 / 探头加温
     · 发动机起动: 空客 ENG MODE IGN/START + ENG MASTER; 波音 ENG START GRD + FUEL CONTROL RUN
   strict = true 时 (冷舱启动场景) 才严格要求起动条件; 其余场景开局所有开关
   都在正常运行位置, 行为与旧版本一致 (键盘 / 侧边面板的起动方式照常可用)。
   纯逻辑, 不依赖 THREE / DOM, 可在单元测试中直接运行。
   ========================================================================== */
(function (global) {
  'use strict';
  var FS = global.FS = global.FS || {};

  var APU_START_SEC = 30;          // APU 起动到 AVAIL (秒)
  var IR_ALIGN_SEC = 75;           // IR 对准时间 (真实约 7–10 分钟, 游戏中缩短)
  var IR_ATT_SEC = 10;             // ATT 模式姿态可用时间

  function isRunning(e) { return !!e && (e.state === 'running' || e.state === 'idle'); }
  function bus(name, data) { if (FS.Bus && FS.Bus.emit) FS.Bus.emit(name, data); }

  function AircraftSystems(fm) {
    this.fm = fm;
    var mf = (fm && fm.ac && fm.ac.manufacturer) || '';
    this.boeing = /Boeing|Embraer/.test(mf);
    this.nIr = this.boeing ? 2 : 3;
    this.nEng = fm && fm.engines ? fm.engines.length : 2;
    this.strict = false;
    this.coldDark = false;
    this.alignSec = IR_ALIGN_SEC;
    this.apuStartSec = APU_START_SEC;
    this.sw = {};
    this.apu = { state: 'off', n: 0, startReq: false };
    this.ir = [];
    this.pending = [];
    this.block = [];
    this.out = {};
    this._memoT = 1;
    this._hints = {};
    this.setRunning();
  }
  var P = AircraftSystems.prototype;

  /* ---------------- 开局状态 ---------------- */
  /** 正常运行位置 (非冷舱场景开局): 一切与旧版本一致 */
  P.setRunning = function () {
    var fm = this.fm, n = this.nEng, i;
    this.strict = false; this.coldDark = false;
    this.sw = {
      bat1: true, bat2: true, extPwr: false, apuMaster: false, apuBleed: false,
      ir: [], pumps: [true, true, true, true, true, true],
      pack1: true, pack2: true, engBleed: [true, true], xbleed: 'AUTO',
      hydEng1: true, hydEng2: true, hydElec: true, ptu: true,
      probeHeat: this.boeing, wingAI: false, engAI: [false, false],
      seatBelts: true, noSmoking: this.boeing ? 'ON' : 'AUTO', emerExit: 'ARM',
      engMode: 'NORM', engStart: [], engMaster: [],
      xpdr: 'AUTO', tcas: 'TA/RA', dome: 'OFF'
    };
    for (i = 0; i < this.nIr; i++) this.sw.ir.push('NAV');
    this.ir = [];
    for (i = 0; i < this.nIr; i++) this.ir.push({ state: 'nav', t: 0, aligned: true });
    for (i = 0; i < n; i++) {
      this.sw.engStart.push(this.boeing ? 'OFF' : 'OFF');
      this.sw.engMaster.push(!!(fm && fm.engines[i] && fm.engines[i].state !== 'off'));
      this.pending[i] = false; this.block[i] = '';
    }
    if (fm && fm.apuRunning) { this.sw.apuMaster = true; this.apu = { state: 'avail', n: 100, startReq: false }; }
    else this.apu = { state: 'off', n: 0, startReq: false };
    this._hints = {};
    this._compute(0);
    return this;
  };
  /** 冷舱: 全部断电 / 关闭, 严格的起动条件 */
  P.setColdDark = function () {
    var n = this.nEng, i, fm = this.fm;
    this.setRunning();
    this.strict = true; this.coldDark = true;
    var s = this.sw;
    s.bat1 = s.bat2 = false; s.extPwr = false; s.apuMaster = false; s.apuBleed = false;
    for (i = 0; i < this.nIr; i++) { s.ir[i] = 'OFF'; this.ir[i] = { state: 'off', t: this.alignSec, aligned: false }; }
    s.pumps = [false, false, false, false, false, false];
    s.pack1 = s.pack2 = true;            // 空客冷舱时 PACK 灯为 ON (无引气, 不起作用)
    s.engBleed = [true, true]; s.xbleed = 'AUTO';
    s.hydEng1 = s.hydEng2 = true; s.hydElec = !this.boeing; s.ptu = !this.boeing;
    s.probeHeat = false; s.wingAI = false; s.engAI = [false, false];
    s.seatBelts = false; s.noSmoking = 'OFF'; s.emerExit = 'OFF';
    s.engMode = 'NORM';
    for (i = 0; i < n; i++) { s.engStart[i] = 'OFF'; s.engMaster[i] = false; this.pending[i] = false; this.block[i] = ''; }
    s.xpdr = 'STBY'; s.tcas = 'STBY'; s.dome = 'OFF';
    this.apu = { state: 'off', n: 0, startReq: false };
    if (fm) { fm.apuRunning = false; fm.apuTimer = 0; fm.apuAvail = false; }
    this._hints = {};
    this._compute(0);
    return this;
  };

  /* ---------------- 开关操作 (三维驾驶舱 / 键盘 / 测试调用) ---------------- */
  P.set = function (key, val) {
    var s = this.sw;
    if (!(key in s)) return false;
    s[key] = val;
    if (key === 'apuMaster' && !val) { this.apu.startReq = false; }
    this._compute(0);
    return true;
  };
  P.toggle = function (key) { return this.set(key, !this.sw[key]); };
  P.setArr = function (key, i, val) {
    var a = this.sw[key];
    if (!a || i < 0 || i >= a.length) return false;
    a[i] = val;
    this._compute(0);
    return true;
  };
  P.setIr = function (i, mode) {
    if (i < 0 || i >= this.nIr) return;
    var prev = this.sw.ir[i];
    this.sw.ir[i] = mode;
    if (mode === 'OFF') this.ir[i] = { state: 'off', t: this.alignSec, aligned: false };
    else if (prev === 'OFF') this.ir[i] = { state: 'align', t: mode === 'ATT' ? IR_ATT_SEC : this.alignSec, aligned: false };
    else if (mode === 'ATT' && !this.ir[i].aligned) this.ir[i].t = Math.min(this.ir[i].t, IR_ATT_SEC);
    else if (prev === 'ATT' && !this.ir[i].aligned) this.ir[i].t = this.alignSec;
    this._compute(0);
  };
  /** APU START 按钮 (需要 MASTER 与直流电) */
  P.pressApuStart = function () {
    if (!this.sw.apuMaster) { this._hint('apustart', 'APU START 无效: 先按下 APU MASTER SW', 'warn'); return false; }
    if (!this.out.dc) { this._hint('apustart', 'APU 无法起动: 无直流电 — 先接通 BAT 1 / BAT 2', 'warn'); return false; }
    if (this.apu.state === 'off') {
      this.apu.state = 'starting'; this.apu.startReq = true;
      bus('fm:apuStart');
      this._hint('apustart', 'APU 起动中… 约 ' + this.apuStartSec + ' 秒后 AVAIL', 'info');
    }
    this._compute(0);
    return true;
  };
  /** 旧接口 (键盘 Shift+A / 侧边面板 APU 按钮): MASTER + START 一步完成 */
  P.legacyStartApu = function () {
    this.sw.apuMaster = true;
    this._compute(0);
    return this.pressApuStart();
  };
  P.stopApu = function () {
    this.sw.apuMaster = false; this.apu.startReq = false;
    this._compute(0);
  };
  /** ENG MASTER / FUEL CONTROL: on = 起动 (满足条件后), off = 关车 */
  P.setEngMaster = function (idx, on) {
    var fm = this.fm, self = this;
    var list = idx === 'all' ? fm.engines.map(function (e, i) { return i; }) : [idx];
    list.forEach(function (i) {
      if (i < 0 || i >= self.nEng) return;
      var was = !!self.sw.engMaster[i];
      self.sw.engMaster[i] = !!on;
      var e = fm.engines[i];
      if (on && !was) self.pending[i] = true;
      if (on && e && e.state === 'off') self.pending[i] = true;
      if (!on) {
        self.pending[i] = false; self.block[i] = '';
        if (e) {
          if (e.state === 'starting') { e.state = 'shutting'; e.fuelOn = false; e.starterOn = false; }
          else e.commandShutdown();
        }
      }
    });
    this._compute(0);
  };

  /* ---------------- 状态计算 ---------------- */
  P.startSelected = function (i) {
    return this.boeing ? (this.sw.engStart[i] === 'GRD') : (this.sw.engMode === 'IGN');
  };
  /** 发动机 i 的起动条件; 返回缺少的条件 ('' = 全部满足) */
  P.startBlockReason = function (i) {
    var o = this.out, fm = this.fm;
    if (!o.dc) return 'NO POWER';
    if (!this.startSelected(i)) return this.boeing ? 'START SW NOT GRD' : 'MODE NOT IGN';
    if (!o.duct[i < 1 ? 0 : 1]) return 'NO BLEED';
    if (!o.fuelFeed[i < 1 ? 0 : 1] || !(fm.fuelKg > 0)) return 'NO FUEL';
    return '';
  };

  P._compute = function (dt) {
    var fm = this.fm, s = this.sw, o = this.out, i;
    if (!fm) return;
    var engs = fm.engines || [];
    var onGnd = !!fm.onGround, gs = fm.gs || 0;
    var run0 = isRunning(engs[0]), run1 = isRunning(engs[Math.min(1, engs.length - 1)]);
    o.extAvail = onGnd && gs < 2;
    if (s.extPwr && !o.extAvail && dt > 0) { s.extPwr = false; this._hint('extoff', 'EXT PWR 已断开 (飞机移动)', 'warn'); }
    o.bat = !!(s.bat1 || s.bat2);
    o.gen = [run0, run1];
    o.apuGen = this.apu.state === 'avail';
    o.ext = o.extAvail && !!s.extPwr;
    o.ac = o.ext || o.apuGen || o.gen[0] || o.gen[1];
    o.acSrc = o.gen[0] || o.gen[1] ? 'GEN' : (o.apuGen ? 'APU GEN' : (o.ext ? 'EXT PWR' : ''));
    o.dc = o.ac || o.bat;
    o.batOnly = o.dc && !o.ac;

    /* APU */
    var a = this.apu;
    if (!s.apuMaster || !o.dc) {
      if (a.state !== 'off') { a.state = 'off'; a.startReq = false; }
      a.n = Math.max(0, a.n - dt * 12);
    } else if (a.state === 'starting') {
      a.n = Math.min(100, a.n + dt * 100 / this.apuStartSec);
      if (a.n >= 99.5) { a.n = 100; a.state = 'avail'; this._hint('apuavail', 'APU AVAIL — 可接通 APU BLEED (APU 发电已自动供电)', 'success'); }
    }
    fm.apuRunning = a.state !== 'off';
    fm.apuAvail = a.state === 'avail';
    if (fm.apuRunning) fm.apuTimer = (fm.apuTimer || 0) + dt; else fm.apuTimer = 0;
    o.apuGen = a.state === 'avail';

    /* 引气 */
    o.apuBleed = o.apuGen && !!s.apuBleed;
    var eb0 = run0 && !!s.engBleed[0], eb1 = run1 && !!s.engBleed[1];
    var xOpen = s.xbleed === 'OPEN' || (s.xbleed === 'AUTO' && o.apuBleed);
    var L = o.apuBleed || eb0, R = eb1;
    if (xOpen) { L = R = L || R; }
    o.duct = [L, R]; o.xOpen = xOpen;
    o.packs = [!!s.pack1 && L, !!s.pack2 && R];

    /* 燃油 (泵为交流电) */
    var pw = o.ac;
    var ctr = s.pumps[2] || s.pumps[3];
    o.fuelFeed = [pw && (s.pumps[0] || s.pumps[1] || ctr), pw && (s.pumps[4] || s.pumps[5] || ctr)];

    /* 液压 */
    var anyRun = run0 || run1;
    if (this.boeing) {
      var A = (run0 && s.hydEng1) || (o.ac && s.hydElec);
      var B = (run1 && s.hydEng2) || (o.ac && s.ptu);
      o.hyd = [!!A, !!B, !!((A || B) && o.ac)];
    } else {
      var G = run0 && s.hydEng1, Y = run1 && s.hydEng2;
      var ptuOn = !!s.ptu && anyRun;
      var G2 = G || (ptuOn && Y), Y2 = Y || (ptuOn && G);
      o.hyd = [!!G2, !!(s.hydElec && o.ac && anyRun), !!Y2];   // G, B, Y
    }
    o.hydAny = o.hyd[0] || o.hyd[1] || o.hyd[2];
    o.gearHyd = o.hyd[0] || o.hyd[2] || (this.boeing && o.hyd[1]);
    o.flapHyd = o.hyd[0] || o.hyd[2] || (this.boeing && o.hyd[1]);

    /* ADIRS */
    var nav = 0, att = 0, adr = 0, aligning = 0, minLeft = 0;
    for (i = 0; i < this.nIr; i++) {
      var m = s.ir[i], r = this.ir[i] || (this.ir[i] = { state: 'off', t: this.alignSec, aligned: false });
      if (m === 'OFF' || !o.dc) {
        if (r.state !== 'off') { r.state = 'off'; r.aligned = false; r.t = this.alignSec; }
        continue;
      }
      adr++;
      if (!r.aligned) {
        r.t -= dt;
        if (r.t <= 0) {
          r.t = 0; r.aligned = m !== 'ATT';
          if (m === 'ATT') r.attOk = true;
          if (r.aligned && dt > 0) this._hint('ir' + i, (this.boeing ? 'IRS ' + (i ? 'R' : 'L') : 'IR ' + (i + 1)) + ' 对准完成 (NAV)', 'success');
        }
      }
      if (m === 'ATT') r.state = r.t <= 0 || r.aligned ? 'att' : 'align';
      else r.state = r.aligned ? (m === 'ALIGN' ? 'aligned' : 'nav') : 'align';
      if (r.state === 'nav') nav++;
      if (r.state === 'nav' || r.state === 'att' || r.state === 'aligned') att++;
      if (r.state === 'align') { aligning++; minLeft = Math.max(minLeft, r.t); }
    }
    o.irNav = nav > 0; o.irAtt = att > 0; o.adr = adr > 0; o.irAllNav = nav === this.nIr;
    o.irAligning = aligning; o.irAlignLeft = minLeft;
    o.onBat = adr > 0 && o.batOnly;

    /* 显示器 */
    o.disp = { pfd: o.ac, nd: o.ac, upper: o.dc, lower: o.ac, fcu: o.dc };
    o.apAvail = o.ac && o.irNav;
    o.domeLevel = o.dc ? ({ OFF: 0, DIM: 1, BRT: 2 }[s.dome] || 0) : 0;

    /* 同步到飞行模型的旧字段 */
    fm.batteryOn = o.bat;
    fm.fuelPumps = s.pumps.slice();
    fm.hydraulics = o.hyd.slice();
    fm.electrical = [o.bat, o.ac, o.gen[0], o.gen[1]];
    fm.packOn = !!(s.pack1 || s.pack2);
    fm.wingAntiIce = !!s.wingAI;
    fm.engineAntiIce = s.engAI.slice();
    if (engs[0]) engs[0].bleed = !!s.engBleed[0];
    if (engs[1]) engs[1].bleed = !!s.engBleed[1];
  };

  /** 每个物理步调用 (FlightModel.update) */
  P.update = function (dt) {
    var fm = this.fm, s = this.sw, i;
    this._compute(dt);
    var engs = fm.engines;
    for (i = 0; i < engs.length; i++) {
      var e = engs[i];
      if (!this.pending[i]) continue;
      if (e.state !== 'off') { this.pending[i] = false; this.block[i] = ''; continue; }
      if (!s.engMaster[i]) { this.pending[i] = false; continue; }
      var why = this.strict ? this.startBlockReason(i) : '';
      if (!why) {
        e.commandStart(false);
        this.pending[i] = false; this.block[i] = '';
        if (this.strict) this._hint('eng' + i + 'start', 'ENG ' + (i + 1) + ' 起动中 — N2 上升, 约 ' + Math.round(e.cfg.startTime || 40) + ' 秒到慢车', 'info');
      } else if (why !== this.block[i]) {
        this.block[i] = why;
        var zh = { 'NO POWER': '无电源 (BAT / EXT PWR / APU GEN)', 'MODE NOT IGN': 'ENG MODE 不在 IGN/START',
          'START SW NOT GRD': 'ENG START 不在 GRD', 'NO BLEED': '无引气 (APU BLEED ON, X BLEED AUTO)', 'NO FUEL': '燃油泵未接通 / 无交流电' }[why] || why;
        this._hint('eng' + i + 'blk', 'ENG ' + (i + 1) + ' 起动等待: ' + zh, 'warn');
      }
    }
    // 波音: 起动完成后 ENG START 自动回到 OFF; 空客 IGN 保留 (提示回 NORM)
    for (i = 0; i < engs.length; i++) {
      if (this.boeing && s.engStart[i] === 'GRD' && isRunning(engs[i])) s.engStart[i] = 'OFF';
      if (this.strict && isRunning(engs[i]) && !this._hints['eng' + i + 'run']) {
        this._hint('eng' + i + 'run', 'ENG ' + (i + 1) + ' 已稳定在慢车 (AVAIL)', 'success');
      }
    }
    this._memoT += dt;
    if (this._memoT >= 0.25) { this._memoT = 0; this.out.memo = this._buildMemo(); }
  };

  /** ECAM / EICAS 备忘与警戒 (level 1 绿 / 2 琥珀 / 0 青色提示) */
  P._buildMemo = function () {
    var o = this.out, s = this.sw, fm = this.fm, out = [], engs = fm.engines, i;
    var anyRun = engs.some(isRunning);
    if (!o.dc) return out;
    for (i = 0; i < engs.length; i++) {
      if (this.block[i] && this.pending[i]) out.push({ t: 'ENG ' + (i + 1) + ' START: ' + this.block[i], c: 'amber', level: 2 });
    }
    if (anyRun) {
      if (!o.hyd[0] && !o.hyd[2] && !this.boeing) out.push({ t: 'HYD G+Y SYS LO PR', c: 'amber', level: 2 });
      else if (this.boeing && !o.hyd[0] && !o.hyd[1]) out.push({ t: 'HYD A+B LO PRESS', c: 'amber', level: 2 });
      if (!o.fuelFeed[0] || !o.fuelFeed[1]) out.push({ t: 'FUEL ' + (!o.fuelFeed[0] ? 'L' : 'R') + ' TK PUMPS OFF', c: 'amber', level: 2 });
      if (!o.irNav) out.push({ t: this.boeing ? 'IRS NOT ALIGNED' : 'NAV IR NOT ALIGNED', c: 'amber', level: 2 });
    }
    if (o.irAligning) out.push({ t: (this.boeing ? 'IRS ALIGN ' : 'IR IN ALIGN ') + Math.ceil(o.irAlignLeft) + ' S', c: 'green', level: 1 });
    if (o.onBat) out.push({ t: 'ADIRS ON BAT', c: 'amber', level: 1 });
    if (this.apu.state === 'starting') out.push({ t: 'APU START ' + Math.round(this.apu.n) + '%', c: 'green', level: 1 });
    else if (this.apu.state === 'avail') out.push({ t: 'APU AVAIL', c: 'green', level: 1 });
    if (o.apuBleed) out.push({ t: 'APU BLEED', c: 'green', level: 1 });
    if (!this.boeing && s.engMode === 'IGN') out.push({ t: anyRun && !engs.some(function (e) { return e.state === 'starting'; }) ? 'ENG MODE SEL → NORM' : 'IGNITION', c: anyRun ? 'cyan' : 'green', level: 1 });
    if (s.seatBelts) out.push({ t: 'SEAT BELTS', c: 'green', level: 1 });
    if (s.noSmoking !== 'OFF' && !this.boeing) out.push({ t: 'NO SMOKING', c: 'green', level: 1 });
    if (s.wingAI) out.push({ t: 'WING A.ICE', c: 'green', level: 1 });
    if (s.engAI[0] || s.engAI[1]) out.push({ t: 'ENG A.ICE', c: 'green', level: 1 });
    if (o.ext) out.push({ t: 'EXT PWR ON', c: 'green', level: 1 });
    if (this.strict) { var nx = this.nextStep(); if (nx) out.push({ t: '▶ ' + nx, c: 'cyan', level: 0 }); }
    return out;
  };

  /** 冷舱启动的下一步提示 (英文短语, 显示在 ECAM 备忘区) */
  P.nextStep = function () {
    var o = this.out, s = this.sw, fm = this.fm, engs = fm.engines, b = this.boeing;
    if (!s.bat1 || !s.bat2) return b ? 'BATTERY + STBY PWR ON' : 'BAT 1 + BAT 2 ON';
    if (!o.ac && !s.extPwr && this.apu.state === 'off') return 'EXT PWR ON (OR APU START)';
    for (var i = 0; i < this.nIr; i++) if (s.ir[i] !== 'NAV') return (b ? 'IRS SEL' : 'IR 1/2/3 SEL') + ' NAV';
    if (!(s.pumps[0] && s.pumps[1] && s.pumps[4] && s.pumps[5])) return 'FUEL PUMPS ON';
    if (this.lights && !this.lights.beacon) return 'BEACON ON';
    if (!s.apuMaster) return 'APU MASTER SW ON';
    if (this.apu.state === 'off') return 'APU START';
    if (this.apu.state !== 'avail') return 'WAIT APU AVAIL';
    if (!s.apuBleed) return 'APU BLEED ON';
    var allRun = engs.every(isRunning);
    if (!allRun) {
      if (b) {
        for (var j = engs.length - 1; j >= 0; j--) if (!isRunning(engs[j])) {
          if (engs[j].state === 'starting') return 'WAIT ENG ' + (j + 1) + ' START';
          if (s.engStart[j] !== 'GRD') return 'ENG ' + (j + 1) + ' START SW GRD';
          return 'FUEL CONTROL ' + (j + 1) + ' RUN';
        }
      } else {
        if (s.engMode !== 'IGN') return 'ENG MODE IGN/START';
        for (var k = engs.length - 1; k >= 0; k--) if (!isRunning(engs[k])) {
          if (engs[k].state === 'starting') return 'WAIT ENG ' + (k + 1) + ' AVAIL';
          return 'ENG MASTER ' + (k + 1) + ' ON';
        }
      }
    }
    if (!b && s.engMode !== 'NORM') return 'ENG MODE NORM';
    if (s.apuBleed) return 'APU BLEED OFF';
    if (!o.irNav) return 'WAIT IR ALIGN';
    if (fm.parkingBrake) return 'PARK BRK OFF — TAXI';
    return '';
  };

  P._hint = function (key, text, type) {
    if (this._hints[key] === text) return;
    this._hints[key] = text;
    bus('sys:hint', { key: key, text: text, type: type || 'info' });
  };

  /** 状态快照 (FlightModel.getState → st.sys) */
  P.snapshot = function () {
    var o = this.out, s = this.sw;
    return {
      strict: this.strict, coldDark: this.coldDark, boeing: this.boeing,
      bat1: s.bat1, bat2: s.bat2, bat: o.bat, extPwr: o.ext, extAvail: o.extAvail, dc: o.dc, ac: o.ac, acSrc: o.acSrc,
      apuMaster: s.apuMaster, apuState: this.apu.state, apuN: this.apu.n, apuAvail: this.apu.state === 'avail', apuBleed: !!s.apuBleed, apuBleedOn: o.apuBleed,
      irModes: s.ir.slice(), irStates: this.ir.map(function (r) { return r.state; }), irNav: o.irNav, irAllNav: o.irAllNav, irAtt: o.irAtt, adr: o.adr,
      irAlignLeft: o.irAlignLeft,
      pumps: s.pumps.slice(), fuelFeed: o.fuelFeed.slice(), duct: o.duct.slice(),
      pack1: s.pack1, pack2: s.pack2, engBleed: s.engBleed.slice(), xbleed: s.xbleed,
      hyd: o.hyd.slice(), engMode: s.engMode, engStart: s.engStart.slice(), engMaster: s.engMaster.slice(),
      seatBelts: s.seatBelts, noSmoking: s.noSmoking, emerExit: s.emerExit,
      probeHeat: s.probeHeat, wingAI: s.wingAI, engAI: s.engAI.slice(),
      xpdr: s.xpdr, tcas: s.tcas, dome: s.dome, disp: o.disp, apAvail: o.apAvail,
      memo: o.memo || []
    };
  };

  AircraftSystems.APU_START_SEC = APU_START_SEC;
  AircraftSystems.IR_ALIGN_SEC = IR_ALIGN_SEC;
  FS.AircraftSystems = AircraftSystems;
  if (FS.Log) FS.Log.info('systems.js 已加载 — 冷舱启动系统逻辑 (电源 / APU / 引气 / ADIRS / 燃油 / 液压)');
})(typeof window !== 'undefined' ? window : globalThis);
