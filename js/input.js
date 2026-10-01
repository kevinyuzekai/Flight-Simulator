/* ==========================================================================
   飞行模拟器 — 输入系统 (input.js)
     键盘 / 鼠标 / 游戏手柄 / 触摸
     采用"动作(Action)"抽象层, 便于重映射
   ========================================================================== */
(function (global) {
  'use strict';

  var FS = global.FS = global.FS || {};
  var U = FS.Utils;

  /* ---------------------------------------------------------------------
     默认按键映射
     --------------------------------------------------------------------- */
  var DEFAULT_BINDINGS = {
    // ---- 飞行操纵 ----
    pitchUp: ['KeyS', 'ArrowDown', 'Numpad2'],
    pitchDown: ['KeyW', 'ArrowUp', 'Numpad8'],
    rollLeft: ['KeyA', 'ArrowLeft', 'Numpad4'],
    rollRight: ['KeyD', 'ArrowRight', 'Numpad6'],
    rudderLeft: ['KeyQ', 'Numpad7'],
    rudderRight: ['KeyE', 'Numpad9'],
    elevatorTrimUp: ['BracketRight'],
    elevatorTrimDown: ['BracketLeft'],

    // ---- 油门 ----
    throttleUp: ['ShiftLeft', 'ShiftRight', 'PageUp'],
    throttleDown: ['ControlLeft', 'ControlRight', 'PageDown'],
    throttleIdle: ['Digit0'],
    throttleClimb: ['Digit9'],
    throttleTOGA: ['Digit8'],
    throttleToggleRev: ['KeyR'],

    // ---- 构型 ----
    gearToggle: ['KeyG'],
    flapsUp: ['KeyF', 'Comma'],
    flapsDown: ['KeyV', 'Period'],
    flapsNext: ['KeyB'],
    speedbrake: ['KeyZ'],
    spoilers: ['KeyX'],
    brakes: ['Space'],
    parkingBrake: ['KeyP'],
    autoBrakeUp: ['KeyN'],
    autoBrakeDown: ['KeyM'],

    // ---- 自动驾驶 ----
    apToggle: ['KeyT'],
    apThrottle: ['KeyY'],
    apHdg: ['KeyH'],
    apAlt: ['KeyL'],
    apVs: ['KeyK'],
    apNav: ['KeyJ'],
    apAppr: ['KeyI'],
    apFLC: ['KeyU'],
    apFlch: ['KeyU'],
    apSpeedMach: ['KeyO'],
    altPlus: ['Equal'],
    altMinus: ['Minus'],
    hdgPlus: ['Semicolon'],
    hdgMinus: ['Quote'],
    spdPlus: ['BracketRight'],
    spdMinus: ['Slash'],
    apLevel: ['KeyV'],

    // ---- 视角/系统 ----
    viewNext: ['KeyC'],
    viewPrev: ['ShiftLeft+KeyC'],
    viewCockpit: ['Digit1'],
    viewWing: ['Digit2'],
    viewChase: ['Digit3'],
    viewTower: ['Digit4'],
    viewOrbit: ['Digit5'],
    viewFree: ['Digit6'],
    viewFlyby: ['Digit7'],
    toggleInstruments: ['KeyTab'],
    toggleHud: ['KeyH'],
    pause: ['Escape'],
    timeScaleUp: ['KeyT'],
    mute: ['KeyM'],
    toggleHelp: ['F1'],
    resetView: ['Home'],
    screenshot: ['F2'],

    // ---- 系统 ----
    apuToggle: ['KeyA'],
    engine1Start: ['Digit1+ControlLeft'],
    engineAllStart: ['KeyS+ControlLeft'],
    nextPage: ['PageDown'],
    prevPage: ['PageUp']
  };

  /* ---------------------------------------------------------------------
     Input 主体
     --------------------------------------------------------------------- */
  function Input(target, opts) {
    opts = opts || {};
    this.target = target || global;
    this.bindings = {};
    for (var k in DEFAULT_BINDINGS) this.bindings[k] = DEFAULT_BINDINGS[k].slice();

    this.keys = {};                // code -> bool
    this.pressedThisFrame = {};
    this.releasedThisFrame = {};
    this._pressedQueue = {};

    /* --- 模拟轴 --- */
    this.axes = {
      pitch: 0, roll: 0, yaw: 0,
      throttle: 0.06, throttleL: 0.06, throttleR: 0.06
    };
    this.axisTargets = { pitch: 0, roll: 0, yaw: 0 };
    this.axisRate = 4.2;           // 杆量每秒行程 (侧杆全行程约 0.5 秒)
    this.axisCenterRate = 5.5;     // 回中速度

    /* --- 鼠标 --- */
    this.mouse = {
      x: 0, y: 0, dx: 0, dy: 0,
      down: false, rightDown: false,
      wheel: 0, locked: false,
      sensitivity: 0.0022
    };
    this.mouseMode = 'none';        // 'none' | 'stick' | 'look'
    this.mouseStick = { x: 0, y: 0 };

    /* --- 手柄 --- */
    this.gamepadIndex = null;
    this.gamepad = null;
    this.gamepadConnected = false;
    this.gpAxes = [0, 0, 0, 0];
    this.gpButtons = {};
    this.gpPressed = {};

    /* --- 快捷键面板状态 --- */
    this.helpVisible = false;

    this._install();
  }

  Input.prototype._install = function () {
    var self = this;
    var t = this.target;

    this._onKeyDown = function (ev) {
      // 忽略在输入框中的按键
      var tag = (ev.target && ev.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (ev.repeat) {
        if (self.keys[ev.code]) return;
      }
      if (!self.keys[ev.code]) {
        self.pressedThisFrame[ev.code] = true;
        self._pressedQueue[ev.code] = true;
      }
      self.keys[ev.code] = true;
      // 阻止页面滚动等默认行为
      if (self._shouldPrevent(ev.code)) ev.preventDefault();
    };
    this._onKeyUp = function (ev) {
      self.keys[ev.code] = false;
      self.releasedThisFrame[ev.code] = true;
      if (self._shouldPrevent(ev.code)) ev.preventDefault();
    };
    this._onBlur = function () {
      self.keys = {};
      self.axisTargets.pitch = 0;
      self.axisTargets.roll = 0;
      self.axisTargets.yaw = 0;
    };

    t.addEventListener('keydown', this._onKeyDown, { passive: false });
    t.addEventListener('keyup', this._onKeyUp, { passive: false });
    t.addEventListener('blur', this._onBlur);

    /* --- 鼠标 --- */
    var el = this.element = (this.target === global ? global.document : null);
    this._onMouseMove = function (ev) {
      self.mouse.dx = ev.movementX || 0;
      self.mouse.dy = ev.movementY || 0;
      self.mouse.x = ev.clientX;
      self.mouse.y = ev.clientY;
    };
    this._onMouseDown = function (ev) {
      if (ev.button === 0) self.mouse.down = true;
      if (ev.button === 2) self.mouse.rightDown = true;
    };
    this._onMouseUp = function (ev) {
      if (ev.button === 0) self.mouse.down = false;
      if (ev.button === 2) self.mouse.rightDown = false;
    };
    this._onWheel = function (ev) {
      self.mouse.wheel += ev.deltaY;
    };
    this._onContext = function (ev) { ev.preventDefault(); };
    this._onPointerLock = function () {
      self.mouse.locked = (global.document.pointerLockElement != null);
    };

    global.addEventListener('mousemove', this._onMouseMove);
    global.addEventListener('mousedown', this._onMouseDown);
    global.addEventListener('mouseup', this._onMouseUp);
    global.addEventListener('wheel', this._onWheel, { passive: true });
    global.addEventListener('contextmenu', this._onContext);
    global.document.addEventListener('pointerlockchange', this._onPointerLock);

    /* --- 手柄 --- */
    global.addEventListener('gamepadconnected', function (ev) {
      self.gamepadIndex = ev.gamepad.index;
      self.gamepadConnected = true;
      FS.Bus.emit('input:gamepad', { connected: true, id: ev.gamepad.id });
      FS.Log.info('手柄已连接: ' + ev.gamepad.id);
    });
    global.addEventListener('gamepaddisconnected', function () {
      self.gamepadConnected = false;
      FS.Bus.emit('input:gamepad', { connected: false });
    });
  };

  Input.prototype._shouldPrevent = function (code) {
    return ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab',
      'PageUp', 'PageDown', 'Home', 'End', 'Slash', 'Quote', 'Semicolon',
      'BracketLeft', 'BracketRight', 'Minus', 'Equal', 'F1'].indexOf(code) >= 0;
  };

  /* ---------------- 绑定查询 ---------------- */
  Input.prototype.isDown = function (action) {
    var b = this.bindings[action];
    if (!b) return false;
    for (var i = 0; i < b.length; i++) {
      var parts = b[i].split('+');
      var ok = true;
      for (var j = 0; j < parts.length; j++) {
        // 修饰键
        var p = parts[j];
        if (p === 'ShiftLeft' && !this.keys['ShiftRight'] && !this.keys['ShiftLeft']) ok = false;
        else if (p === 'ControlLeft' && !this.keys['ControlRight'] && !this.keys['ControlLeft']) ok = false;
        else if (!this.keys[p]) ok = false;
      }
      if (ok) return true;
    }
    return false;
  };

  Input.prototype.wasPressed = function (action) {
    var b = this.bindings[action];
    if (!b) return false;
    for (var i = 0; i < b.length; i++) {
      if (this._pressedQueue[b[i]]) return true;
      var parts = b[i].split('+');
      if (parts.length === 1 && this.pressedThisFrame[parts[0]]) return true;
    }
    return false;
  };

  /** 边沿触发并消费 (避免重复触发) */
  Input.prototype.consume = function (action) {
    if (!this.wasPressed(action)) return false;
    var b = this.bindings[action];
    for (var i = 0; i < b.length; i++) delete this._pressedQueue[b[i]];
    return true;
  };

  Input.prototype.rebind = function (action, codes) {
    this.bindings[action] = Array.isArray(codes) ? codes.slice() : [codes];
  };

  /* ---------------- 手柄读取 ---------------- */
  Input.prototype._pollGamepad = function () {
    if (!global.navigator || !global.navigator.getGamepads) return;
    var pads = global.navigator.getGamepads();
    if (!pads) return;
    var gp = null;
    for (var i = 0; i < pads.length; i++) {
      if (pads[i]) { gp = pads[i]; break; }
    }
    this.gamepad = gp;
    if (!gp) { this.gamepadConnected = false; return; }
    this.gamepadConnected = true;

    // 轴: 左摇杆 = 俯仰/横滚, 右摇杆 = 视角, 扳机 = 油门/方向舵
    var dead = 0.12;
    this.gpAxes[0] = U.deadzone(gp.axes[0] || 0, dead);
    this.gpAxes[1] = U.deadzone(gp.axes[1] || 0, dead);
    this.gpAxes[2] = U.deadzone(gp.axes[2] || 0, dead);
    this.gpAxes[3] = U.deadzone(gp.axes[3] || 0, dead);

    var map = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT',
      8: 'Back', 9: 'Start', 10: 'LS', 11: 'RS', 12: 'Up', 13: 'Down', 14: 'Left', 15: 'Right' };
    for (var bi = 0; bi < gp.buttons.length; bi++) {
      var name = map[bi] || ('B' + bi);
      var val = gp.buttons[bi].pressed || gp.buttons[bi].value > 0.5;
      if (val && !this.gpButtons[name]) this.gpPressed[name] = true;
      this.gpButtons[name] = val;
    }
  };

  Input.prototype.gpDown = function (name) { return !!this.gpButtons[name]; };
  Input.prototype.gpWasPressed = function (name) {
    if (this.gpPressed[name]) { this.gpPressed[name] = false; return true; }
    return false;
  };

  /* ---------------- 每帧更新 ---------------- */
  Input.prototype.update = function (dt) {
    dt = Math.min(dt, 0.1);
    this._pollGamepad();

    var a = this.axisTargets;
    var gp = this.gpAxes;
    var useGamepad = this.gamepadConnected && (Math.abs(gp[0]) > 0.02 || Math.abs(gp[1]) > 0.02);

    /* ---- 俯仰 (约定: +1 = 抬头 / 拉杆) ---- */
    var pIn = 0;
    if (this.isDown('pitchUp')) pIn += 1;          // S / ↓ / 拉杆 = 抬头
    if (this.isDown('pitchDown')) pIn -= 1;        // W / ↑ / 推杆 = 低头
    if (useGamepad) pIn = -gp[1];                  // 手柄前推 = 低头
    if (this.mouseMode === 'stick' && this.mouse.down) pIn = U.clamp(this.mouseStick.y, -1, 1);
    a.pitch = U.clamp(pIn, -1, 1);

    /* ---- 横滚 ---- */
    var rIn = 0;
    if (this.isDown('rollLeft')) rIn -= 1;
    if (this.isDown('rollRight')) rIn += 1;
    if (useGamepad) rIn = gp[0];
    if (this.mouseMode === 'stick' && this.mouse.down) rIn = U.clamp(this.mouseStick.x, -1, 1);
    a.roll = rIn;

    /* ---- 方向舵 ---- */
    var yIn = 0;
    if (this.isDown('rudderLeft')) yIn -= 1;
    if (this.isDown('rudderRight')) yIn += 1;
    if (this.gamepadConnected) {
      // 肩键作方向舵
      if (this.gpButtons['LB']) yIn -= 1;
      if (this.gpButtons['RB']) yIn += 1;
      if (Math.abs(gp[3]) > 0.02) yIn = gp[3];
    }
    // 地面低速时键盘方向舵兼作前轮转向 (由 flightmodel 处理)
    a.yaw = yIn;

    /* ---- 摇杆平滑 (真实侧杆有行程时间) ---- */
    var rate = (Math.abs(pIn) > 0.01) ? this.axisRate : this.axisCenterRate;
    this.axes.pitch = U.moveTowards(this.axes.pitch, a.pitch, rate * dt);
    this.axes.roll = U.moveTowards(this.axes.roll, a.roll, rate * 1.15 * dt);
    this.axes.yaw = U.moveTowards(this.axes.yaw, a.yaw, rate * 1.6 * dt);

    /* ---- 油门 ---- */
    var thrDelta = 0;
    if (this.isDown('throttleUp')) thrDelta += this.throttleRate * dt;
    if (this.isDown('throttleDown')) thrDelta -= this.throttleRate * dt;
    if (this.gamepadConnected) {
      if (this.gpButtons['RT']) thrDelta += this.throttleRate * dt;
      if (this.gpButtons['LT']) thrDelta -= this.throttleRate * dt;
    }
    this.axes.throttle = U.clamp01(this.axes.throttle + thrDelta);

    // 鼠标滚轮微调油门
    if (this.mouse.wheel !== 0) {
      this.axes.throttle = U.clamp01(this.axes.throttle - this.mouse.wheel * 0.00035);
    }

    /* ---- 鼠标摇杆模式 ---- */
    if (this.mouseMode === 'stick') {
      var sens = this.mouse.sensitivity * 2.2;
      if (this.mouse.down || this.mouse.locked) {
        // 鼠标向下 = 拉杆抬头, 因此 y 取负
        this.mouseStick.x = U.clamp(this.mouseStick.x + this.mouse.dx * sens, -1, 1);
        this.mouseStick.y = U.clamp(this.mouseStick.y - this.mouse.dy * sens, -1, 1);
      }
      // 无输入时缓慢回中
      if (!this.mouse.down) {
        this.mouseStick.x = U.damp(this.mouseStick.x, 0, 0.9, dt);
        this.mouseStick.y = U.damp(this.mouseStick.y, 0, 0.9, dt);
      }
    } else {
      this.mouseStick.x = 0; this.mouseStick.y = 0;
    }
    if (this.mouseMode === 'look' && this.mouse.locked) {
      this.lookDeltaX = this.mouse.dx;
      this.lookDeltaY = this.mouse.dy;
    } else {
      this.lookDeltaX = this.lookDeltaY = 0;
    }

    this.dt = dt;
  };

  /** 每帧末调用: 清理边沿触发状态 */
  Input.prototype.endFrame = function () {
    this.pressedThisFrame = {};
    this.releasedThisFrame = {};
    this._pressedQueue = {};
    this.gpPressed = {};
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.mouse.wheel = 0;
  };

  Input.prototype.throttleRate = 0.45;

  Input.prototype.setThrottle = function (v) { this.axes.throttle = U.clamp01(v); };
  Input.prototype.nudgeThrottle = function (d) { this.axes.throttle = U.clamp01(this.axes.throttle + d); };

  Input.prototype.requestPointerLock = function () {
    var el = global.document.getElementById('viewport') || global.document.body;
    if (el.requestPointerLock) {
      var p = el.requestPointerLock();
      if (p && p.catch) p.catch(function () { });
    }
  };
  Input.prototype.exitPointerLock = function () {
    if (global.document.exitPointerLock) global.document.exitPointerLock();
  };

  Input.prototype.dispose = function () {
    var t = this.target;
    t.removeEventListener('keydown', this._onKeyDown);
    t.removeEventListener('keyup', this._onKeyUp);
    t.removeEventListener('blur', this._onBlur);
    global.removeEventListener('mousemove', this._onMouseMove);
    global.removeEventListener('mousedown', this._onMouseDown);
    global.removeEventListener('mouseup', this._onMouseUp);
    global.removeEventListener('wheel', this._onWheel);
    global.removeEventListener('contextmenu', this._onContext);
  };

  Input.DEFAULT_BINDINGS = DEFAULT_BINDINGS;
  FS.Input = Input;

  FS.Log.info('input.js 已加载 — 键盘/鼠标/手柄输入就绪');

})(typeof window !== 'undefined' ? window : globalThis);
