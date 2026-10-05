/* =====================================================================
 * joystick.js — 摇杆 / 侧杆 / 油门台 / 脚舵支持 (beta 0.3, 0.4.1 修正)
 *
 * 基于浏览器 Gamepad API。标准映射的游戏手柄 (Xbox/PS) 由 input.js 直接处理;
 * 这里处理其它 HID 设备: Thrustmaster TCA 空客侧杆、TCA 油门台 (Quadrant)、普通飞行摇杆、方向舵脚舵等。
 *
 * 注意: Chrome / Edge 出于隐私, 要在页面上按一下设备按钮 (或动一下轴) 后才会报告设备。
 * 每个设备 (按 Gamepad.id 区分) 一份映射: 轴 -> 俯仰/横滚/方向舵(扭转)/油门1/油门2/趾刹,
 * 反向、死区、灵敏度, 以及按钮 -> AP 断开 / PTT / 刹车 等。保存在 localStorage。
 *
 * 0.4.1: 设备类型 stick / hotas / other / throttle / pedals。多设备合成时只有
 * 「符合设备类型」或「用户手动绑定」的轴参与, 并按优先级取值 (不再是最后一个设备覆盖):
 *   俯仰/横滚: 侧杆 > HOTAS > 其它摇杆;  方向舵: 脚舵 > 扭转/拨片;  油门: 油门台 > HOTAS > 摇杆滑块
 * ===================================================================== */
(function (global) {
  'use strict';
  var FS = global.FS = global.FS || {};
  var KEY = 'fs.joystick.v1';
  var SCHEMA = 2;     // 配置格式版本 (0.4.1 起); 旧配置在 profile() 中迁移

  var AXIS_FUNCS = [
    { id: 'pitch', name: '俯仰 (拉杆抬头)' },
    { id: 'roll', name: '横滚' },
    { id: 'yaw', name: '方向舵 / 扭转 / 脚舵' },
    { id: 'throttle', name: '油门 1 (或全部)' },
    { id: 'throttle2', name: '油门 2' },
    { id: 'brakeL', name: '左趾刹 (脚舵)' },
    { id: 'brakeR', name: '右趾刹 (脚舵)' },
    { id: 'hat', name: '苦力帽 POV (驾驶舱环视)' }
  ];
  var BUTTON_FUNCS = [
    { id: 'apDisconnect', name: 'AP 断开', edge: true },
    { id: 'ptt', name: 'PTT 通话', hold: true },
    { id: 'brakes', name: '刹车 (按住)', hold: true },
    { id: 'gearToggle', name: '起落架', edge: true },
    { id: 'flapsUp', name: '襟翼 收', edge: true },
    { id: 'flapsDown', name: '襟翼 放', edge: true },
    { id: 'viewNext', name: '切换视角', edge: true },
    { id: 'throttleToggleRev', name: '反推', edge: true }
  ];

  /* 设备类型 -> 默认参与合成的轴功能 (其它功能只有手动绑定后才参与) */
  var KIND_FUNCS = {
    stick: { pitch: 1, roll: 1, yaw: 1, throttle: 1, hat: 1 },
    hotas: { pitch: 1, roll: 1, yaw: 1, throttle: 1, throttle2: 1, hat: 1 },
    other: { pitch: 1, roll: 1, yaw: 1, throttle: 1, hat: 1 },
    throttle: { throttle: 1, throttle2: 1, hat: 1 },
    pedals: { yaw: 1, brakeL: 1, brakeR: 1 }
  };
  /* 合成优先级 (数值大者优先; 手动绑定到「非本类型」功能的轴 = 0) */
  var RANK = {
    pitch: { stick: 3, hotas: 2, other: 1 },
    roll: { stick: 3, hotas: 2, other: 1 },
    yaw: { pedals: 3, stick: 2, hotas: 2, other: 2, throttle: 1 },
    throttle: { throttle: 3, hotas: 2, stick: 1, other: 1 },
    throttle2: { throttle: 3, hotas: 2, stick: 1, other: 1 },
    brakeL: { pedals: 3 }, brakeR: { pedals: 3 },
    hat: { stick: 3, hotas: 2, other: 1, throttle: 1 }
  };
  var KIND_NAMES = { stick: '侧杆 / 摇杆', hotas: 'HOTAS (杆 + 油门)', other: '摇杆 (通用)', throttle: '油门台', pedals: '脚舵 (方向舵踏板)' };

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function load() {
    try { var s = global.localStorage.getItem(KEY); if (s) return JSON.parse(s) || {}; } catch (e) { /* */ }
    return {};
  }
  function save(all) {
    try { global.localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* */ }
  }

  /** 按设备名猜测设备类型 */
  function guessKind(id) {
    id = String(id || '');
    if (/rudder|pedal|tfrp|tpr|t-rudder|skywalker/i.test(id)) return 'pedals';
    // 注意: 不能用 /thr/ —— 会把 "Thrustmaster" 的摇杆也当成油门台
    if (/\bthrottle\b|quadrant|tca q/i.test(id) && !/stick|joystick/i.test(id)) return 'throttle';
    if (/stick|yoke/i.test(id)) return 'stick';
    if (/hotas|x-?52|x-?56/i.test(id)) return 'hotas';
    return 'other';
  }

  /** 按设备名猜测默认映射 */
  function defaultProfile(pad) {
    var id = (pad && pad.id) || '', n = pad && pad.axes ? pad.axes.length : 0;
    var p = {
      axes: { pitch: { axis: -1, invert: true }, roll: { axis: -1, invert: false }, yaw: { axis: -1, invert: false },
        throttle: { axis: -1, invert: true }, throttle2: { axis: -1, invert: true },
        brakeL: { axis: -1, invert: false }, brakeR: { axis: -1, invert: false },
        hat: { axis: n > 9 ? 9 : -1, invert: false } },
      deadzone: 0.05, sensitivity: 1.0, curve: 1.3,
      buttons: { apDisconnect: -1, ptt: -1, brakes: -1, gearToggle: -1, flapsUp: -1, flapsDown: -1, viewNext: -1, throttleToggleRev: -1 },
      guessed: true, schema: SCHEMA
    };
    p.kind = guessKind(id);
    if (p.kind === 'pedals') {
      // 脚舵: Rz (Chrome/Edge 在 Windows 上固定为轴 5) = 方向舵, X/Y (轴 0/1) = 左/右趾刹; 不映射俯仰/横滚
      p.axes.hat.axis = -1;
      if (n > 5) p.axes.yaw.axis = 5; else if (n > 2) p.axes.yaw.axis = 2;
      if (n > 0) p.axes.brakeL.axis = 0;
      if (n > 1) p.axes.brakeR.axis = 1;
    } else if (p.kind === 'throttle') {
      // 油门台: 前两个轴为两根油门杆
      if (n > 0) p.axes.throttle.axis = 0;
      if (n > 1) p.axes.throttle2.axis = 1;
    } else {
      // 侧杆 / HOTAS / 普通摇杆: X=横滚, Y=俯仰, 扭转 (Rz) 常见于第 5 或第 2 个轴, 滑块油门
      if (n > 0) p.axes.roll.axis = 0;
      if (n > 1) p.axes.pitch.axis = 1;
      if (n > 5) { p.axes.yaw.axis = 5; if (n > 6) p.axes.throttle.axis = 6; else p.axes.throttle.axis = 2; }
      else if (n > 3) { p.axes.yaw.axis = 3; p.axes.throttle.axis = 2; }
      else if (n > 2) p.axes.yaw.axis = 2;
      // TCA 侧杆: 扳机 = PTT, 红色按钮 = AP 断开, 按钮 2 = 刹车
      if (pad && pad.buttons) {
        if (pad.buttons.length > 0) p.buttons.ptt = 0;
        if (pad.buttons.length > 1) p.buttons.apDisconnect = 1;
        if (pad.buttons.length > 2) p.buttons.brakes = 2;
        if (pad.buttons.length > 3) p.buttons.gearToggle = 3;
      }
    }
    return p;
  }

  /** 0.4.0 及以前的默认轴映射 (仅用于迁移: 判断旧配置里哪些轴是用户手动改过的) */
  function legacyDefaultAxes(pad) {
    var id = (pad && pad.id) || '', n = pad && pad.axes ? pad.axes.length : 0;
    var a = { pitch: -1, roll: -1, yaw: -1, throttle: -1, throttle2: -1, hat: n > 9 ? 9 : -1 };
    if (/quadrant|throttle|tca q|tq|thr/i.test(id) && !/stick|hotas warthog joystick/i.test(id)) {
      if (n > 0) a.throttle = 0;
      if (n > 1) a.throttle2 = 1;
    } else {
      if (n > 0) a.roll = 0;
      if (n > 1) a.pitch = 1;
      if (n > 5) { a.yaw = 5; a.throttle = n > 6 ? 6 : 2; }
      else if (n > 3) { a.yaw = 3; a.throttle = 2; }
      else if (n > 2) a.yaw = 2;
    }
    return a;
  }

  /** 旧配置迁移: 自动猜测的 (guessed) 直接按新规则重建; 用户改过的保留, 只补字段 */
  function migrate(old, pad) {
    var p, k;
    if (!old || !old.axes) return defaultProfile(pad);
    if (old.guessed !== false) {
      p = defaultProfile(pad);
      // 滑块调整不会清除 guessed 标记, 这些值照样保留
      ['deadzone', 'sensitivity', 'curve', 'forceJoystick'].forEach(function (f) { if (old[f] !== undefined) p[f] = old[f]; });
      return p;
    }
    p = old;
    p.kind = guessKind(pad && pad.id);
    var leg = legacyDefaultAxes(pad), used = {};
    for (k in p.axes) {
      if (!p.axes.hasOwnProperty(k)) continue;
      var c = p.axes[k];
      // 与旧版默认值不同的绑定 = 用户手动绑定, 无论设备类型都参与合成
      if (c && c.axis >= 0 && c.manual === undefined) c.manual = !(k in leg) || leg[k] !== c.axis;
      if (c && c.axis >= 0 && c.manual) used[c.axis] = true;
    }
    var n = pad && pad.axes ? pad.axes.length : 0;
    if (!p.axes.hat) p.axes.hat = { axis: -1, invert: false };
    if (!p.axes.brakeL) p.axes.brakeL = { axis: p.kind === 'pedals' && n > 0 && !used[0] ? 0 : -1, invert: false };
    if (!p.axes.brakeR) p.axes.brakeR = { axis: p.kind === 'pedals' && n > 1 && !used[1] ? 1 : -1, invert: false };
    p.schema = SCHEMA;
    return p;
  }

  var Joystick = {
    all: load(),
    state: {},          // id -> {btn:[], lastThr, lastThr2, thrOwned, thr2Owned, brk:{}}
    AXIS_FUNCS: AXIS_FUNCS,
    BUTTON_FUNCS: BUTTON_FUNCS,
    guessKind: guessKind,
    defaultProfile: defaultProfile,
    learn: null,        // {id, kind:'axis'|'button', func, base:[], t0}

    hasProfile: function (id) { var p = this.all[id]; return !!(p && p.forceJoystick); },

    profile: function (pad) {
      var p = this.all[pad.id];
      if (!p) { p = defaultProfile(pad); this.all[pad.id] = p; }
      else if (p.schema !== SCHEMA) { p = migrate(p, pad); this.all[pad.id] = p; this.saveAll(); }
      if (!p.axes.hat) p.axes.hat = { axis: -1, invert: false };
      if (!p.axes.brakeL) p.axes.brakeL = { axis: -1, invert: false };
      if (!p.axes.brakeR) p.axes.brakeR = { axis: -1, invert: false };
      if (!KIND_FUNCS[p.kind]) p.kind = guessKind(pad.id);
      return p;
    },

    saveAll: function () { save(this.all); },

    reset: function () { this.all = {}; this.state = {}; save(this.all); },

    /** 该设备的该轴功能是否参与合成, 返回优先级 (-1 = 不参与) */
    _rank: function (prof, func) {
      var c = prof.axes[func];
      if (!c || c.axis < 0) return -1;
      if (KIND_FUNCS[prof.kind] && KIND_FUNCS[prof.kind][func]) return (RANK[func] && RANK[func][prof.kind]) || 0;
      return c.manual ? 0 : -1;
    },

    _axis: function (pad, cfg, prof, centered) {
      if (!cfg || cfg.axis < 0 || cfg.axis >= pad.axes.length) return null;
      var v = pad.axes[cfg.axis] || 0;
      if (cfg.invert) v = -v;
      if (!centered) return v;
      var dz = prof.deadzone || 0;
      var a = Math.abs(v);
      if (a < dz) return 0;
      a = (a - dz) / (1 - dz);
      a = Math.pow(a, prof.curve || 1) * (prof.sensitivity || 1);
      return clamp(v < 0 ? -a : a, -1, 1);
    },

    /** 趾刹轴 -> 0..1。首次读数作为静止位置 (静止在 +1 端的踏板自动反向);
        只有踏板动过之后才生效, 避免未接线 / 居中的轴把刹车一直踩住 */
    _brake: function (pad, cfg, st, key) {
      if (!cfg || cfg.axis < 0 || cfg.axis >= pad.axes.length) return null;
      var v = pad.axes[cfg.axis] || 0;
      if (cfg.invert) v = -v;
      var b = st.brk[key];
      if (!b || b.axis !== cfg.axis || b.inv !== !!cfg.invert) b = st.brk[key] = { axis: cfg.axis, inv: !!cfg.invert, rest: v, armed: false };
      if (!b.armed && Math.abs(v - b.rest) > 0.15) b.armed = true;
      if (!b.armed) return 0;
      var val = Math.abs(v - (b.rest > 0.8 ? 1 : -1)) / 2;
      return val < 0.05 ? 0 : clamp(val, 0, 1);
    },

    /** 读取所有非标准设备, 返回合成结果; 同时把按钮动作推给 input */
    read: function (pads, input) {
      var out = { hasStick: false, hasYaw: false, hasThrottle: false, hasThrottle2: false, hasBrakes: false,
        pitch: 0, roll: 0, yaw: 0, throttle: 0, throttle2: null, throttleMoved: false, throttle2Moved: false,
        brakeL: 0, brakeR: 0, brake: 0, held: {}, devices: pads.length, src: {} };
      var best = {}, i, k, r;
      function offer(func, rank, val, idx) {
        var b = best[func];
        // 优先级高者胜; 同级时取偏转较大者 (不会被另一台设备的零值覆盖)
        if (!b || rank > b.rank || (rank === b.rank && Math.abs(val) > Math.abs(b.val))) best[func] = { rank: rank, val: val, idx: idx };
      }
      // 油门: 已被推动 (接管) 的设备优先, 其次按设备类型优先级
      function offerThr(func, rank, owned, val, idx) {
        var b = best[func], key = (owned ? 100 : 0) + rank;
        if (!b || key > b.key) best[func] = { key: key, val: val, idx: idx };
      }
      var states = [];
      for (i = 0; i < pads.length; i++) {
        var pad = pads[i], prof = this.profile(pad);
        var st = this.state[pad.id] || (this.state[pad.id] = { btn: [], lastThr: null, lastThr2: null });
        if (!st.brk) st.brk = {};
        states[i] = st;
        var A = prof.axes, v;
        ['pitch', 'roll', 'yaw'].forEach(function (f) {
          var rk = this._rank(prof, f);
          if (rk < 0) return;
          var val = this._axis(pad, A[f], prof, true);
          if (val !== null) offer(f, rk, val, i);
        }, this);
        // 油门 1 / 2: 每台设备各自跟踪「是否被推动过」, 推动后才接管
        r = this._rank(prof, 'throttle');
        v = r < 0 ? null : this._axis(pad, A.throttle, prof, false);
        if (v !== null) {
          var t01 = (v + 1) / 2;
          if (st.lastThr === null || Math.abs(t01 - st.lastThr) > 0.01) { if (st.lastThr !== null) st.thrOwned = true; st.lastThr = t01; }
          offerThr('throttle', r, !!st.thrOwned, t01, i);
        }
        r = this._rank(prof, 'throttle2');
        v = r < 0 ? null : this._axis(pad, A.throttle2, prof, false);
        if (v !== null) {
          var t02 = (v + 1) / 2;
          if (st.lastThr2 === null || Math.abs(t02 - st.lastThr2) > 0.01) { if (st.lastThr2 !== null) st.thr2Owned = true; st.lastThr2 = t02; }
          offerThr('throttle2', r, !!st.thr2Owned, t02, i);
        }
        // 趾刹
        ['brakeL', 'brakeR'].forEach(function (f) {
          if (this._rank(prof, f) < 0) return;
          var bv = this._brake(pad, A[f], st, f);
          if (bv === null) return;
          out.hasBrakes = true;
          if (bv > out[f]) out[f] = bv;
        }, this);
        // 苦力帽: Chrome/Edge 把 HID 帽子开关报告为一个轴, 上 = -1, 顺时针每 45° +2/7, 中立 ≈ +1.29
        r = this._rank(prof, 'hat');
        if (r >= 0 && A.hat.axis < pad.axes.length) {
          var hv = pad.axes[A.hat.axis];
          if (hv >= -1.05 && hv <= 1.05) {
            var hi = Math.round((hv + 1) * 3.5) % 8;
            var HX = [0, 1, 1, 1, 0, -1, -1, -1], HY = [-1, -1, 0, 1, 1, 1, 0, -1];
            if (!out.hat || r > out._hatRank) { out.hat = { x: HX[hi] * (A.hat.invert ? -1 : 1), y: HY[hi] }; out._hatRank = r; }
          }
        }
        // 按钮
        for (k = 0; k < BUTTON_FUNCS.length; k++) {
          var f = BUTTON_FUNCS[k], bi = prof.buttons[f.id];
          if (bi === undefined || bi < 0 || bi >= pad.buttons.length) continue;
          var b = pad.buttons[bi], down = !!(b && (b.pressed || b.value > 0.5));
          if (f.hold && down) out.held[f.id] = true;
          if (f.edge && down && !st.btn[bi] && input) input.triggerAction(f.id);
        }
        for (k = 0; k < pad.buttons.length; k++) st.btn[k] = !!(pad.buttons[k] && pad.buttons[k].pressed);
        if (this.learn && this.learn.id === pad.id) this._learnStep(pad);
      }
      delete out._hatRank;
      if (best.pitch) { out.hasStick = true; out.pitch = best.pitch.val; out.src.pitch = pads[best.pitch.idx].id; }
      if (best.roll) { out.hasStick = true; out.roll = best.roll.val; out.src.roll = pads[best.roll.idx].id; }
      if (best.yaw) { out.hasYaw = true; out.yaw = best.yaw.val; out.src.yaw = pads[best.yaw.idx].id; }
      // 键盘油门被使用时, 摇杆油门 (两根杆) 交出控制权, 直到再次推动
      var kbThr = input && (input.isDown('throttleUp') || input.isDown('throttleDown'));
      if (kbThr) for (k in this.state) if (this.state.hasOwnProperty(k)) { this.state[k].thrOwned = false; this.state[k].thr2Owned = false; }
      if (best.throttle) {
        out.hasThrottle = true; out.throttle = best.throttle.val; out.src.throttle = pads[best.throttle.idx].id;
        out.throttleMoved = !!states[best.throttle.idx].thrOwned;
      }
      if (best.throttle2) {
        out.hasThrottle2 = true; out.throttle2 = best.throttle2.val; out.src.throttle2 = pads[best.throttle2.idx].id;
        out.throttle2Moved = !!states[best.throttle2.idx].thr2Owned;
      }
      out.brake = Math.max(out.brakeL, out.brakeR);
      var ptt = !!out.held.ptt, pe = global.document && global.document.getElementById('ptt-indicator');
      if (pe) pe.classList.toggle('hidden', !ptt);
      if (ptt !== this._ptt) { this._ptt = ptt; if (FS.Bus) FS.Bus.emit('radio:ptt', { on: ptt }); }
      return out;
    },

    /* ---------------- 检测 (动一下轴 / 按一下按钮 自动识别) ---------------- */
    startLearn: function (id, kind, func) {
      this.learn = { id: id, kind: kind, func: func, base: null, t0: Date.now() };
    },
    _learnStep: function (pad) {
      var L = this.learn, prof = this.profile(pad), i;
      if (Date.now() - L.t0 > 8000) { this.learn = null; this._refreshPanel(true); return; }
      if (L.kind === 'axis') {
        if (!L.base) { L.base = pad.axes.slice(); return; }
        var best = -1, bd = 0.4;
        for (i = 0; i < pad.axes.length; i++) {
          var dlt = Math.abs((pad.axes[i] || 0) - (L.base[i] || 0));
          if (dlt > bd) { bd = dlt; best = i; }
        }
        if (best >= 0) {
          prof.axes[L.func].axis = best; prof.axes[L.func].manual = true; prof.guessed = false;
          this.learn = null; this.saveAll(); this._refreshPanel(true);
        }
      } else {
        for (i = 0; i < pad.buttons.length; i++) {
          if (pad.buttons[i] && pad.buttons[i].pressed) {
            prof.buttons[L.func] = i; prof.guessed = false;
            this.learn = null; this.saveAll(); this._refreshPanel(true);
            return;
          }
        }
      }
    },

    /* ---------------- 设置面板 ---------------- */
    openPanel: function () {
      var ov = global.document.getElementById('joystick-overlay');
      if (!ov) return;
      ov.classList.remove('hidden');
      this._panelOpen = true;
      this._refreshPanel(true);
      var self = this;
      (function loop() {
        if (!self._panelOpen) return;
        self._refreshPanel(false);
        global.requestAnimationFrame(loop);
      })();
    },
    closePanel: function () {
      var ov = global.document.getElementById('joystick-overlay');
      if (ov) ov.classList.add('hidden');
      this._panelOpen = false;
      this.learn = null;
      this.saveAll();
    },

    _pads: function () {
      var out = [], pads, i;
      try { pads = global.navigator.getGamepads ? global.navigator.getGamepads() : []; } catch (e) { pads = []; }
      for (i = 0; i < (pads ? pads.length : 0); i++) if (pads[i] && pads[i].connected) out.push(pads[i]);
      return out;
    },

    _refreshPanel: function (rebuild) {
      var doc = global.document, box = doc.getElementById('joy-devices');
      if (!box) return;
      var pads = this._pads(), self = this, i, k;
      var sig = pads.map(function (p) { return p.id + ':' + p.axes.length + ':' + p.buttons.length; }).join('|') + (this.learn ? 'L' + this.learn.func : '');
      if (rebuild || sig !== this._sig) {
        this._sig = sig;
        box.innerHTML = '';
        if (!pads.length) {
          box.innerHTML = '<div class="joy-empty">未检测到摇杆。请连接设备后 <b>按一下摇杆上的任意按钮</b> (Chrome/Edge 的要求)。' +
            '<br>标准游戏手柄 (Xbox/PS) 无需设置: 左摇杆 = 驾驶杆, LB/RB = 方向舵, LT/RT = 油门, A = 起落架, X = 刹车, Y = 视角, 十字键上/下 = 襟翼, Start = 暂停, Back = AP 断开。</div>';
          return;
        }
        pads.forEach(function (pad) {
          var std = pad.mapping === 'standard' && !self.hasProfile(pad.id);
          var prof = self.profile(pad);
          var d = doc.createElement('div');
          d.className = 'joy-dev';
          var h = '<div class="joy-head"><b>' + escapeHtml(pad.id) + '</b>' +
            '<span class="joy-tag">' + (std ? '标准手柄 (自动映射)' : (KIND_NAMES[prof.kind] || '摇杆')) + '</span>' +
            '<label class="joy-chk"><input type="checkbox" data-force="1"' + (prof.forceJoystick ? ' checked' : '') + '> 按摇杆方式映射</label></div>';
          h += '<div class="joy-live" data-live="' + pad.index + '"></div>';
          if (!std) {
            h += '<table class="joy-table"><tr><th>功能</th><th>轴</th><th>反向</th><th></th></tr>';
            AXIS_FUNCS.forEach(function (f) {
              var c = prof.axes[f.id];
              var opts = '<option value="-1">— 无 —</option>';
              for (k = 0; k < pad.axes.length; k++) opts += '<option value="' + k + '"' + (c.axis === k ? ' selected' : '') + '>轴 ' + k + '</option>';
              var learning = self.learn && self.learn.id === pad.id && self.learn.func === f.id;
              h += '<tr><td>' + f.name + '</td><td><select data-axis="' + f.id + '">' + opts + '</select></td>' +
                '<td><input type="checkbox" data-inv="' + f.id + '"' + (c.invert ? ' checked' : '') + '></td>' +
                '<td><button class="btn btn-ghost btn-xs" data-learn-axis="' + f.id + '">' + (learning ? '请移动该轴…' : '检测') + '</button></td></tr>';
            });
            h += '</table><table class="joy-table"><tr><th>按钮功能</th><th>按钮</th><th></th></tr>';
            BUTTON_FUNCS.forEach(function (f) {
              var bi = prof.buttons[f.id];
              var opts = '<option value="-1">— 无 —</option>';
              for (k = 0; k < pad.buttons.length; k++) opts += '<option value="' + k + '"' + (bi === k ? ' selected' : '') + '>按钮 ' + k + '</option>';
              var learning = self.learn && self.learn.id === pad.id && self.learn.func === f.id;
              h += '<tr><td>' + f.name + '</td><td><select data-btn="' + f.id + '">' + opts + '</select></td>' +
                '<td><button class="btn btn-ghost btn-xs" data-learn-btn="' + f.id + '">' + (learning ? '请按下按钮…' : '检测') + '</button></td></tr>';
            });
            h += '</table>';
            h += '<div class="joy-sliders"><label>死区 <b data-v="dz">' + prof.deadzone.toFixed(2) + '</b>' +
              '<input type="range" min="0" max="0.3" step="0.01" value="' + prof.deadzone + '" data-dz="1"></label>' +
              '<label>灵敏度 <b data-v="sens">' + prof.sensitivity.toFixed(2) + '</b>' +
              '<input type="range" min="0.3" max="2" step="0.05" value="' + prof.sensitivity + '" data-sens="1"></label>' +
              '<label>曲线 <b data-v="curve">' + (prof.curve || 1).toFixed(2) + '</b>' +
              '<input type="range" min="1" max="3" step="0.05" value="' + (prof.curve || 1) + '" data-curve="1"></label></div>';
          }
          d.innerHTML = h;
          box.appendChild(d);
          // 事件
          d.addEventListener('change', function (ev) {
            var t = ev.target, ds = t.dataset;
            if (ds.force) prof.forceJoystick = t.checked;
            if (ds.axis) { prof.axes[ds.axis].axis = parseInt(t.value, 10); prof.axes[ds.axis].manual = prof.axes[ds.axis].axis >= 0; }
            if (ds.inv) prof.axes[ds.inv].invert = t.checked;
            if (ds.btn) prof.buttons[ds.btn] = parseInt(t.value, 10);
            prof.guessed = false;
            self.saveAll();
            if (ds.force) self._refreshPanel(true);
          });
          d.addEventListener('input', function (ev) {
            var t = ev.target, ds = t.dataset, v = parseFloat(t.value);
            if (ds.dz) prof.deadzone = v;
            if (ds.sens) prof.sensitivity = v;
            if (ds.curve) prof.curve = v;
            var lab = t.parentNode.querySelector('b');
            if (lab) lab.textContent = v.toFixed(2);
            self.saveAll();
          });
          d.addEventListener('click', function (ev) {
            var t = ev.target, ds = t.dataset;
            if (ds.learnAxis) { self.startLearn(pad.id, 'axis', ds.learnAxis); self._refreshPanel(true); }
            if (ds.learnBtn) { self.startLearn(pad.id, 'button', ds.learnBtn); self._refreshPanel(true); }
          });
        });
      }
      // 实时数值
      pads.forEach(function (pad) {
        var el = box.querySelector('[data-live="' + pad.index + '"]');
        if (!el) return;
        var h = '';
        for (i = 0; i < pad.axes.length; i++) {
          var v = pad.axes[i] || 0;
          h += '<span class="joy-ax"><i>轴' + i + '</i><span class="joy-bar"><span style="left:' + ((v + 1) * 50).toFixed(1) + '%"></span></span></span>';
        }
        h += '<span class="joy-btns">';
        for (i = 0; i < pad.buttons.length; i++) h += '<span class="joy-b' + (pad.buttons[i].pressed ? ' on' : '') + '">' + i + '</span>';
        el.innerHTML = h + '</span>';
      });
    },

    bindUi: function () {
      var doc = global.document, self = this;
      var b1 = doc.getElementById('joy-btn'), b2 = doc.getElementById('joy-close'), b3 = doc.getElementById('joy-reset'), b4 = doc.getElementById('joy-menu-btn');
      if (b1) b1.addEventListener('click', function () { self.openPanel(); });
      if (b4) b4.addEventListener('click', function () { self.openPanel(); });
      if (b2) b2.addEventListener('click', function () { self.closePanel(); });
      if (b3) b3.addEventListener('click', function () { self.reset(); self._refreshPanel(true); });
      global.addEventListener('gamepadconnected', function (ev) {
        if (FS.Log) FS.Log.info('检测到设备: ' + ev.gamepad.id + ' (' + ev.gamepad.axes.length + ' 轴, ' + ev.gamepad.buttons.length + ' 键, mapping=' + (ev.gamepad.mapping || '无') + ')');
        if (self._panelOpen) self._refreshPanel(true);
      });
    }
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  FS.Joystick = Joystick;
  if (global.document) {
    if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', function () { Joystick.bindUi(); });
    else Joystick.bindUi();
  }
})(typeof window !== 'undefined' ? window : this);
