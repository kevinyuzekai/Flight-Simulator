/* =====================================================================
 * joystick.js — 摇杆 / 侧杆 / 油门台支持 (beta 0.3)
 *
 * 基于浏览器 Gamepad API。标准映射的游戏手柄 (Xbox/PS) 由 input.js 直接处理;
 * 这里处理其它 HID 设备: Thrustmaster TCA 空客侧杆、TCA 油门台 (Quadrant)、普通飞行摇杆等。
 *
 * 注意: Chrome / Edge 出于隐私, 要在页面上按一下设备按钮 (或动一下轴) 后才会报告设备。
 * 每个设备 (按 Gamepad.id 区分) 一份映射: 轴 -> 俯仰/横滚/方向舵(扭转)/油门1/油门2,
 * 反向、死区、灵敏度, 以及按钮 -> AP 断开 / PTT / 刹车 等。保存在 localStorage。
 * ===================================================================== */
(function (global) {
  'use strict';
  var FS = global.FS = global.FS || {};
  var KEY = 'fs.joystick.v1';

  var AXIS_FUNCS = [
    { id: 'pitch', name: '俯仰 (拉杆抬头)' },
    { id: 'roll', name: '横滚' },
    { id: 'yaw', name: '方向舵 / 扭转' },
    { id: 'throttle', name: '油门 1 (或全部)' },
    { id: 'throttle2', name: '油门 2' },
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

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function load() {
    try { var s = global.localStorage.getItem(KEY); if (s) return JSON.parse(s) || {}; } catch (e) { /* */ }
    return {};
  }
  function save(all) {
    try { global.localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* */ }
  }

  /** 按设备名猜测默认映射 */
  function defaultProfile(pad) {
    var id = (pad && pad.id) || '', n = pad && pad.axes ? pad.axes.length : 0;
    var p = {
      axes: { pitch: { axis: -1, invert: true }, roll: { axis: -1, invert: false }, yaw: { axis: -1, invert: false },
        throttle: { axis: -1, invert: true }, throttle2: { axis: -1, invert: true },
        hat: { axis: n > 9 ? 9 : -1, invert: false } },
      deadzone: 0.05, sensitivity: 1.0, curve: 1.3,
      buttons: { apDisconnect: -1, ptt: -1, brakes: -1, gearToggle: -1, flapsUp: -1, flapsDown: -1, viewNext: -1, throttleToggleRev: -1 },
      guessed: true
    };
    if (/quadrant|throttle|tca q|tq|thr/i.test(id) && !/stick|hotas warthog joystick/i.test(id)) {
      // 油门台: 前两个轴为两根油门杆
      p.kind = 'throttle';
      if (n > 0) p.axes.throttle.axis = 0;
      if (n > 1) p.axes.throttle2.axis = 1;
      p.buttons.throttleToggleRev = -1;
    } else {
      // 侧杆 / 普通摇杆: X=横滚, Y=俯仰, 扭转 (Rz) 常见于第 5 或第 2 个轴, 滑块油门
      p.kind = 'stick';
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

  var Joystick = {
    all: load(),
    state: {},          // id -> {btn:[], lastThr, lastThr2}
    AXIS_FUNCS: AXIS_FUNCS,
    BUTTON_FUNCS: BUTTON_FUNCS,
    learn: null,        // {id, kind:'axis'|'button', func, base:[], t0}

    hasProfile: function (id) { var p = this.all[id]; return !!(p && p.forceJoystick); },

    profile: function (pad) {
      var p = this.all[pad.id];
      if (!p) { p = defaultProfile(pad); this.all[pad.id] = p; }
      if (!p.axes.hat) p.axes.hat = { axis: -1, invert: false };     // 旧版本保存的配置没有苦力帽
      return p;
    },

    saveAll: function () { save(this.all); },

    reset: function () { this.all = {}; this.state = {}; save(this.all); },

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

    /** 读取所有非标准设备, 返回合成结果; 同时把按钮动作推给 input */
    read: function (pads, input) {
      var out = { hasStick: false, hasYaw: false, hasThrottle: false, hasThrottle2: false,
        pitch: 0, roll: 0, yaw: 0, throttle: 0, throttle2: null, throttleMoved: false, held: {}, devices: pads.length };
      var i, k;
      for (i = 0; i < pads.length; i++) {
        var pad = pads[i], prof = this.profile(pad);
        var st = this.state[pad.id] || (this.state[pad.id] = { btn: [], lastThr: null, lastThr2: null });
        var A = prof.axes;
        var pv = this._axis(pad, A.pitch, prof, true), rv = this._axis(pad, A.roll, prof, true);
        if (pv !== null || rv !== null) {
          out.hasStick = true;
          if (pv !== null) out.pitch = pv;
          if (rv !== null) out.roll = rv;
        }
        var yv = this._axis(pad, A.yaw, prof, true);
        if (yv !== null) { out.hasYaw = true; out.yaw = yv; }
        var tv = this._axis(pad, A.throttle, prof, false);
        if (tv !== null) {
          var t01 = (tv + 1) / 2;
          out.hasThrottle = true; out.throttle = t01;
          if (st.lastThr === null || Math.abs(t01 - st.lastThr) > 0.01) { if (st.lastThr !== null) out.throttleMoved = true; st.lastThr = t01; }
          if (st.thrOwned) out.throttleMoved = true;
          if (out.throttleMoved) st.thrOwned = true;
        }
        var t2 = this._axis(pad, A.throttle2, prof, false);
        if (t2 !== null) { out.hasThrottle2 = true; out.throttle2 = (t2 + 1) / 2; }
        // 苦力帽: Chrome/Edge 把 HID 帽子开关报告为一个轴, 上 = -1, 顺时针每 45° +2/7, 中立 ≈ +1.29
        if (A.hat && A.hat.axis >= 0 && A.hat.axis < pad.axes.length) {
          var hv = pad.axes[A.hat.axis];
          if (hv >= -1.05 && hv <= 1.05) {
            var hi = Math.round((hv + 1) * 3.5) % 8;
            var HX = [0, 1, 1, 1, 0, -1, -1, -1], HY = [-1, -1, 0, 1, 1, 1, 0, -1];
            out.hat = { x: HX[hi] * (A.hat.invert ? -1 : 1), y: HY[hi] };
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
      // 键盘油门被使用时, 摇杆油门交出控制权, 直到再次推动
      if (input && (input.isDown('throttleUp') || input.isDown('throttleDown'))) {
        for (k in this.state) if (this.state.hasOwnProperty(k)) this.state[k].thrOwned = false;
        out.throttleMoved = false;
      }
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
          prof.axes[L.func].axis = best; prof.guessed = false;
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
            '<span class="joy-tag">' + (std ? '标准手柄 (自动映射)' : (prof.kind === 'throttle' ? '油门台' : '摇杆 / 侧杆')) + '</span>' +
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
            if (ds.axis) prof.axes[ds.axis].axis = parseInt(t.value, 10);
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
