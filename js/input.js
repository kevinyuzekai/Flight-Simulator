/* ==========================================================================
   天际航线 SkyRoute — 输入系统 (input.js)
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
  // beta 0.3: 默认键位 (常见网页飞行模拟的按键习惯)。
  // 组合键写法: 'Shift+KeyF' / 'Ctrl+KeyS' / 'Alt+...'; 单键写法: 'KeyF'。
  // 带修饰键的单键按下时不会触发不带修饰键的"按一下"动作 (例如 Shift+F 只放襟翼, 不收襟翼)。
  var DEFAULT_BINDINGS = {
    // ---- 飞行操纵 (按住) ----
    pitchUp: ['ArrowDown', 'KeyS', 'Numpad2'],          // 拉杆 / 抬头
    pitchDown: ['ArrowUp', 'KeyW', 'Numpad8'],          // 推杆 / 低头
    rollLeft: ['ArrowLeft', 'KeyA', 'Numpad4'],
    rollRight: ['ArrowRight', 'KeyD', 'Numpad6'],
    rudderLeft: ['Comma', 'Numpad0', 'KeyQ', 'Numpad7'],
    rudderRight: ['Period', 'NumpadEnter', 'KeyE', 'Numpad9'],
    elevatorTrimUp: ['End'],                            // 抬头配平
    elevatorTrimDown: ['Home'],                         // 低头配平

    // ---- 油门 (按住) ----
    throttleUp: ['PageUp', 'Equal', 'NumpadAdd'],
    throttleDown: ['PageDown', 'Minus', 'NumpadSubtract'],
    throttleIdle: ['Digit0'],
    throttleClimb: ['Digit9'],
    throttleTOGA: ['Digit8'],
    throttleToggleRev: ['KeyR'],

    // ---- 构型 ----
    gearToggle: ['KeyG'],
    flapsUp: ['KeyF'],
    flapsDown: ['Shift+KeyF', 'KeyV'],
    speedbrake: ['KeyZ'],
    spoilers: ['KeyX'],
    brakes: ['KeyB'],                                   // 按住刹车
    parkingBrake: ['Shift+KeyB'],
    pauseToggle: ['Space', 'KeyP'],

    // ---- 自动驾驶 ----
    apToggle: ['KeyT'],
    apDisconnect: [],                                   // 仅摇杆按钮
    apThrottle: ['KeyY'],
    apHdg: ['KeyH'],
    apAlt: ['KeyL'],
    apVs: ['KeyK'],
    apNav: ['KeyJ'],
    apAppr: ['KeyI'],
    apFlch: ['KeyU'],
    apSpeedMach: ['KeyO'],
    altPlus: ['BracketRight'],
    altMinus: ['BracketLeft'],
    hdgPlus: ['Quote'],
    hdgMinus: ['Semicolon'],
    spdPlus: ['Shift+BracketRight'],
    spdMinus: ['Shift+BracketLeft'],

    // ---- 视角/界面 ----
    viewNext: ['KeyC'],
    viewPrev: ['Shift+KeyC'],
    viewCockpit: ['Digit1'],
    viewWing: ['Digit2'],
    viewChase: ['Digit3'],
    viewTower: ['Digit4'],
    viewOrbit: ['Digit5'],
    viewFree: ['Digit6'],
    viewFlyby: ['Digit7'],
    mouseYoke: ['KeyM'],                                // 鼠标当驾驶杆 开/关
    lookPanel: ['KeyN'],                                // beta 0.3.1: 三维驾驶舱 看向仪表板 / 向外看
    lookCenter: ['Numpad5'],                            // 视线回正
    toggleHud: ['Shift+KeyH'],
    timeScaleUp: ['Shift+KeyT'],
    mute: ['Shift+KeyM'],
    toggleHelp: ['F1', 'Shift+Slash'],                 // F1 或 ?
    screenshot: ['F2'],

    // ---- 系统 ----
    apuToggle: ['Shift+KeyA'],
    engine1Start: ['Ctrl+Digit1'],
    engineAllStart: ['Ctrl+KeyS']
  };

  /** 绑定字符串规范化: 'ShiftLeft+KeyC' / 'KeyS+ControlLeft' -> 'Shift+KeyC' / 'Ctrl+KeyS' */
  function normBinding(b) {
    var parts = String(b).split('+'), mods = { Ctrl: false, Alt: false, Shift: false }, key = '', i;
    for (i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (/^(Shift|ShiftLeft|ShiftRight)$/.test(p)) mods.Shift = true;
      else if (/^(Ctrl|Control|ControlLeft|ControlRight)$/.test(p)) mods.Ctrl = true;
      else if (/^(Alt|AltLeft|AltRight)$/.test(p)) mods.Alt = true;
      else key = p;
    }
    return (mods.Ctrl ? 'Ctrl+' : '') + (mods.Alt ? 'Alt+' : '') + (mods.Shift ? 'Shift+' : '') + key;
  }
  function isModifierCode(c) { return /^(Shift|Control|Alt|Meta)(Left|Right)$/.test(c); }

  /** 键码 -> 显示用的按键名 (帮助面板) */
  function keyLabel(b) {
    var map = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Comma: ',', Period: '.',
      Equal: '+/=', Minus: '-', NumpadAdd: '小键盘+', NumpadSubtract: '小键盘-', NumpadEnter: '小键盘Enter',
      BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Slash: '/', Space: '空格',
      PageUp: 'PgUp', PageDown: 'PgDn', Home: 'Home', End: 'End' };
    return String(b).split('+').map(function (p) {
      if (map[p]) return map[p];
      if (/^Key[A-Z]$/.test(p)) return p.substring(3);
      if (/^Digit\d$/.test(p)) return p.substring(5);
      if (/^Numpad\d$/.test(p)) return '小键盘' + p.substring(6);
      if (p === 'Shift+Slash') return '?';
      return p;
    }).join('+').replace('Shift+/', '?');
  }

  /* ---------------------------------------------------------------------
     Input 主体
     --------------------------------------------------------------------- */
  function Input(target, opts) {
    opts = opts || {};
    this.target = target || global;
    this.bindings = {};
    for (var k in DEFAULT_BINDINGS) this.bindings[k] = DEFAULT_BINDINGS[k].map(normBinding);
    this.mouseYoke = false;          // beta 0.3: 鼠标位置 (相对屏幕中心) = 驾驶杆
    this.yokeDeadzone = 0.04;
    this.touch = { active: false, id: null, x0: 0, y0: 0, sx: 0, sy: 0, lookId: null, lx: 0, ly: 0 };
    this.joyThrottle = null;         // 摇杆油门轴最近值 (null = 未使用)
    this._joyActions = {};           // 摇杆按钮触发的动作 (边沿)
    this._joyHeld = {};              // 摇杆按钮按住的动作

    this.keys = {};                // code -> bool
    this.pressedThisFrame = {};
    this.releasedThisFrame = {};
    this._pressedQueue = {};

    /* --- 模拟轴 --- */
    this.axes = {
      pitch: 0, roll: 0, yaw: 0,
      throttle: 0.06, throttleL: 0.06, throttleR: 0.06
    };
    this.brakeAxis = 0;            // 脚舵趾刹 0..1 (0.4.1)
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
    this.overrideMag = 0;          // beta 0.4: 可判定 AP 超控的杆量 (不含鼠标)

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
        if (!isModifierCode(ev.code)) {
          var pre = (ev.ctrlKey || ev.metaKey ? 'Ctrl+' : '') + (ev.altKey ? 'Alt+' : '') + (ev.shiftKey ? 'Shift+' : '');
          self._pressedQueue[pre + ev.code] = true;
        }
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
      self.mouse.overScene = onScene(ev);
    };
    function onScene(ev) {
      var id = ev.target && ev.target.id;
      return id === 'viewport' || id === 'hud-canvas' || ev.target === global.document.body;
    }
    this._onMouseDown = function (ev) {
      if (ev.button === 0) self.mouse.down = true;
      if (ev.button === 2) self.mouse.rightDown = true;
      // 在三维画面上按下才算"拖拽环视", 点仪表/按钮不算
      self.mouse.dragView = onScene(ev);
    };
    this._onMouseUp = function (ev) {
      if (ev.button === 0) self.mouse.down = false;
      if (ev.button === 2) self.mouse.rightDown = false;
      if (!self.mouse.down && !self.mouse.rightDown) self.mouse.dragView = false;
    };
    /* --- 触摸: 单指拖动 = 虚拟驾驶杆 (相对按下点), 第二指拖动 = 环视 --- */
    this._onTouchStart = function (ev) {
      if (!onScene(ev)) return;
      for (var i = 0; i < ev.changedTouches.length; i++) {
        var tch = ev.changedTouches[i], T = self.touch;
        if (T.id === null) { T.id = tch.identifier; T.x0 = tch.clientX; T.y0 = tch.clientY; T.sx = 0; T.sy = 0; T.active = true; }
        else if (T.lookId === null) { T.lookId = tch.identifier; T.lx = tch.clientX; T.ly = tch.clientY; }
      }
      ev.preventDefault();
    };
    this._onTouchMove = function (ev) {
      var T = self.touch, R = Math.max(60, Math.min(global.innerWidth, global.innerHeight) * 0.22);
      for (var i = 0; i < ev.changedTouches.length; i++) {
        var tch = ev.changedTouches[i];
        if (tch.identifier === T.id) {
          T.sx = U.clamp((tch.clientX - T.x0) / R, -1, 1);
          T.sy = U.clamp((tch.clientY - T.y0) / R, -1, 1);
        } else if (tch.identifier === T.lookId) {
          self._touchLookX = (self._touchLookX || 0) + (tch.clientX - T.lx);
          self._touchLookY = (self._touchLookY || 0) + (tch.clientY - T.ly);
          T.lx = tch.clientX; T.ly = tch.clientY;
        }
      }
      if (T.active) ev.preventDefault();
    };
    this._onTouchEnd = function (ev) {
      var T = self.touch;
      for (var i = 0; i < ev.changedTouches.length; i++) {
        var id = ev.changedTouches[i].identifier;
        if (id === T.id) { T.id = null; T.active = false; T.sx = 0; T.sy = 0; }
        if (id === T.lookId) T.lookId = null;
      }
    };
    global.addEventListener('touchstart', this._onTouchStart, { passive: false });
    global.addEventListener('touchmove', this._onTouchMove, { passive: false });
    global.addEventListener('touchend', this._onTouchEnd);
    global.addEventListener('touchcancel', this._onTouchEnd);
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
      'PageUp', 'PageDown', 'Home', 'End', 'Slash', 'Quote', 'Semicolon', 'Comma', 'Period',
      'BracketLeft', 'BracketRight', 'Minus', 'Equal', 'F1', 'F2', 'NumpadAdd', 'NumpadSubtract',
      'NumpadEnter', 'Numpad0'].indexOf(code) >= 0;
  };

  /* ---------------- 绑定查询 ---------------- */
  Input.prototype._modDown = function (m) {
    var k = this.keys;
    if (m === 'Shift') return !!(k.ShiftLeft || k.ShiftRight);
    if (m === 'Ctrl') return !!(k.ControlLeft || k.ControlRight || k.MetaLeft || k.MetaRight);
    if (m === 'Alt') return !!(k.AltLeft || k.AltRight);
    return false;
  };
  Input.prototype.isDown = function (action) {
    if (this._joyHeld[action]) return true;
    var b = this.bindings[action];
    if (!b) return false;
    for (var i = 0; i < b.length; i++) {
      var parts = b[i].split('+'), ok = true;
      for (var j = 0; j < parts.length; j++) {
        var p = parts[j];
        if (p === 'Shift' || p === 'Ctrl' || p === 'Alt') { if (!this._modDown(p)) ok = false; }
        else if (!this.keys[p]) ok = false;
      }
      if (ok) return true;
    }
    return false;
  };

  Input.prototype.wasPressed = function (action) {
    if (this._joyActions[action]) return true;
    var b = this.bindings[action];
    if (!b) return false;
    for (var i = 0; i < b.length; i++) if (this._pressedQueue[b[i]]) return true;
    return false;
  };

  /** 边沿触发并消费 (避免重复触发) */
  Input.prototype.consume = function (action) {
    if (!this.wasPressed(action)) return false;
    var b = this.bindings[action] || [];
    for (var i = 0; i < b.length; i++) delete this._pressedQueue[b[i]];
    delete this._joyActions[action];
    return true;
  };

  /** 摇杆按钮 -> 动作 (由 FS.Joystick 调用) */
  Input.prototype.triggerAction = function (action) { this._joyActions[action] = true; };
  Input.prototype.holdAction = function (action, on) { if (on) this._joyHeld[action] = true; else delete this._joyHeld[action]; };

  /** 帮助面板用: 某动作的按键显示文本 */
  Input.prototype.labelFor = function (action) {
    return (this.bindings[action] || []).map(function (b) { return b === 'Shift+Slash' ? '?' : keyLabel(b); }).join(' / ');
  };

  Input.prototype.rebind = function (action, codes) {
    this.bindings[action] = (Array.isArray(codes) ? codes : [codes]).map(normBinding);
  };

  /* ---------------- 手柄 / 摇杆读取 ---------------- */
  // 标准映射 (mapping === 'standard', 如 Xbox/PS 手柄): 左摇杆 = 杆, 肩键 = 方向舵, 扳机 = 油门。
  // 其它 HID 设备 (Thrustmaster TCA 侧杆/油门台、普通飞行摇杆) 交给 FS.Joystick 按"摇杆设置"映射。
  Input.prototype._pollGamepad = function () {
    this.gamepad = null;
    this.joy = null;
    if (!global.navigator || !global.navigator.getGamepads) { this.gamepadConnected = false; return; }
    var pads;
    try { pads = global.navigator.getGamepads(); } catch (e) { pads = null; }
    if (!pads) { this.gamepadConnected = false; return; }
    var gp = null, joyPads = [], i;
    for (i = 0; i < pads.length; i++) {
      var pd = pads[i];
      if (!pd || !pd.connected) continue;
      var isStd = pd.mapping === 'standard' && !(FS.Joystick && FS.Joystick.hasProfile(pd.id));
      if (isStd && !gp) gp = pd; else if (!isStd) joyPads.push(pd);
    }
    this.gamepad = gp;
    this.gamepadConnected = !!gp;
    if (joyPads.length && FS.Joystick) this.joy = FS.Joystick.read(joyPads, this);
    // beta 0.3.1: 摇杆苦力帽 (POV) -> 驾驶舱环视
    this.hatLook = this.joy && this.joy.hat && (this.joy.hat.x || this.joy.hat.y) ? this.joy.hat : null;
    if (!gp) {
      this.gpAxes[0] = this.gpAxes[1] = this.gpAxes[2] = this.gpAxes[3] = 0;
      this.holdAction('brakes', !!(this.joy && this.joy.held.brakes));
      return;
    }

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
    // 标准手柄按钮 -> 动作
    if (this.gpPressed.A) this.triggerAction('gearToggle');
    if (this.gpPressed.Y) this.triggerAction('viewNext');
    if (this.gpPressed.Up) this.triggerAction('flapsUp');
    if (this.gpPressed.Down) this.triggerAction('flapsDown');
    if (this.gpPressed.Start) this.triggerAction('pauseToggle');
    if (this.gpPressed.Back) this.triggerAction('apDisconnect');
    this.holdAction('brakes', !!this.gpButtons.X || !!(this.joy && this.joy.held.brakes));
  };

  Input.prototype.gpDown = function (name) { return !!this.gpButtons[name]; };
  Input.prototype.gpWasPressed = function (name) {
    if (this.gpPressed[name]) { this.gpPressed[name] = false; return true; }
    return false;
  };

  Input.prototype.setMouseYoke = function (on) {
    this.mouseYoke = !!on;
    this.mouseStick.x = this.mouseStick.y = 0;
    FS.Bus && FS.Bus.emit('input:mouseYoke', { on: this.mouseYoke });
  };

  /* ---------------- 每帧更新 ---------------- */
  Input.prototype.update = function (dt) {
    dt = Math.min(dt, 0.1);
    this._pollGamepad();

    var a = this.axisTargets;
    var gp = this.gpAxes, joy = this.joy;
    var useGamepad = this.gamepadConnected && (Math.abs(gp[0]) > 0.02 || Math.abs(gp[1]) > 0.02);
    var useJoy = joy && joy.hasStick;

    // 鼠标驾驶杆: 光标相对屏幕中心 (屏幕 80% 范围 = 满偏), 小死区
    var myX = 0, myY = 0;
    if (this.mouseYoke) {
      // beta 0.4: 光标移到界面面板 / 按钮上 (不在三维画面上) 时冻结杆量, 不跟随光标
      if (this.mouse.overScene !== false) {
        var W = global.innerWidth || 1, H = global.innerHeight || 1;
        this.mouseStick.x = U.deadzone(U.clamp((this.mouse.x - W / 2) / (W * 0.4), -1, 1), this.yokeDeadzone);
        this.mouseStick.y = U.deadzone(U.clamp((this.mouse.y - H / 2) / (H * 0.4), -1, 1), this.yokeDeadzone);
      }
      myX = this.mouseStick.x; myY = this.mouseStick.y;
    }
    var T = this.touch;

    /* ---- 俯仰 (约定: +1 = 抬头 / 拉杆) ---- */
    var pIn = 0, keyP = false;
    if (this.isDown('pitchUp')) { pIn += 1; keyP = true; }
    if (this.isDown('pitchDown')) { pIn -= 1; keyP = true; }
    if (!keyP) {
      if (useJoy) pIn = joy.pitch;
      else if (useGamepad) pIn = -gp[1];             // 手柄前推 = 低头
      else if (T.active) pIn = T.sy;                 // 手指往下拖 = 拉杆
      else if (this.mouseYoke) pIn = myY;            // 光标在中心以下 = 拉杆抬头
    }
    a.pitch = U.clamp(pIn, -1, 1);

    /* ---- 横滚 ---- */
    var rIn = 0, keyR = false;
    if (this.isDown('rollLeft')) { rIn -= 1; keyR = true; }
    if (this.isDown('rollRight')) { rIn += 1; keyR = true; }
    if (!keyR) {
      if (useJoy) rIn = joy.roll;
      else if (useGamepad) rIn = gp[0];
      else if (T.active) rIn = T.sx;
      else if (this.mouseYoke) rIn = myX;
    }
    a.roll = U.clamp(rIn, -1, 1);

    /* beta 0.4: 可判定为「人工超控 AP」的杆量 —— 只算键盘 / 摇杆 / 手柄 / 触摸,
       鼠标驾驶杆 (光标去点 FCU、调旋钮时必然偏离屏幕中心) 一律不算 */
    var ovP = (keyP || useJoy || useGamepad || T.active) ? Math.abs(pIn) : 0;
    var ovR = (keyR || useJoy || useGamepad || T.active) ? Math.abs(rIn) : 0;
    this.overrideMag = Math.min(1, Math.max(ovP, ovR));

    /* ---- 方向舵 ---- */
    var yIn = 0, keyY = false;
    if (this.isDown('rudderLeft')) { yIn -= 1; keyY = true; }
    if (this.isDown('rudderRight')) { yIn += 1; keyY = true; }
    if (!keyY) {
      if (joy && joy.hasYaw) yIn = joy.yaw;
      if (this.gamepadConnected) {
        if (this.gpButtons.LB) yIn -= 1;
        if (this.gpButtons.RB) yIn += 1;
        if (Math.abs(gp[3]) > 0.02 && !this.gpButtons.LB && !this.gpButtons.RB) yIn = gp[3];
      }
    }
    a.yaw = U.clamp(yIn, -1, 1);

    /* ---- 平滑: 键盘/触摸有行程时间; 摇杆/鼠标是绝对位置, 只做轻微滤波 ---- */
    var analog = !keyP && (useJoy || useGamepad || T.active || this.mouseYoke);
    var rate = (Math.abs(pIn) > 0.01) ? this.axisRate : this.axisCenterRate;
    if (analog) {
      this.axes.pitch = U.damp(this.axes.pitch, a.pitch, 0.06, dt);
      this.axes.roll = U.damp(this.axes.roll, a.roll, 0.06, dt);
    } else {
      this.axes.pitch = U.moveTowards(this.axes.pitch, a.pitch, rate * dt);
      this.axes.roll = U.moveTowards(this.axes.roll, a.roll, rate * 1.15 * dt);
    }
    if (!keyY && joy && joy.hasYaw) this.axes.yaw = U.damp(this.axes.yaw, a.yaw, 0.06, dt);
    else this.axes.yaw = U.moveTowards(this.axes.yaw, a.yaw, rate * 1.6 * dt);

    /* ---- 油门 ---- */
    var thrDelta = 0;
    if (this.isDown('throttleUp')) thrDelta += this.throttleRate * dt;
    if (this.isDown('throttleDown')) thrDelta -= this.throttleRate * dt;
    if (this.gamepadConnected) {
      if (this.gpButtons.RT) thrDelta += this.throttleRate * dt;
      if (this.gpButtons.LT) thrDelta -= this.throttleRate * dt;
    }
    this.axes.throttle = U.clamp01(this.axes.throttle + thrDelta);
    // 摇杆/油门台的油门轴: 只有在轴被推动时才接管 (键盘仍可用)
    if (joy && joy.hasThrottle && joy.throttleMoved) this.axes.throttle = U.clamp01(joy.throttle);
    this.axes.throttleL = this.axes.throttle;
    // 0.4.1: 油门 2 与油门 1 相同 —— 只有第二根杆被推动后才接管; 键盘油门 / A/THR 同步后不再一直被它顶回去
    this.axes.throttleR = (joy && joy.hasThrottle2 && joy.throttle2 !== null && joy.throttle2Moved) ? U.clamp01(joy.throttle2) : this.axes.throttle;
    // 0.4.1: 脚舵趾刹 (连续量 0..1), 由 main.js 与「按住刹车」取较大值
    this.brakeAxis = (joy && joy.hasBrakes) ? U.clamp01(joy.brake) : 0;

    // 鼠标滚轮: 驾驶舱内微调油门; 外部视角由相机用来缩放
    if (this.mouse.wheel !== 0 && this.wheelThrottle !== false) {
      this.axes.throttle = U.clamp01(this.axes.throttle - this.mouse.wheel * 0.00035);
    }

    /* ---- 环视: 指针锁定 / 在画面上拖拽 (鼠标驾驶杆模式下只用右键拖拽) / 第二根手指 ---- */
    var drag = this.mouse.dragView && (this.mouse.rightDown || (this.mouse.down && !this.mouseYoke));
    if ((this.mouseMode === 'look' && this.mouse.locked) || drag) {
      this.lookDeltaX = this.mouse.dx;
      this.lookDeltaY = this.mouse.dy;
    } else {
      this.lookDeltaX = this.lookDeltaY = 0;
    }
    if (this._touchLookX || this._touchLookY) {
      this.lookDeltaX += this._touchLookX || 0; this.lookDeltaY += this._touchLookY || 0;
      this._touchLookX = this._touchLookY = 0;
    }

    this.dt = dt;
  };

  /** 每帧末调用: 清理边沿触发状态 */
  Input.prototype.endFrame = function () {
    this._joyActions = {};
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
    global.removeEventListener('touchstart', this._onTouchStart);
    global.removeEventListener('touchmove', this._onTouchMove);
    global.removeEventListener('touchend', this._onTouchEnd);
    global.removeEventListener('touchcancel', this._onTouchEnd);
  };

  Input.DEFAULT_BINDINGS = DEFAULT_BINDINGS;
  Input.keyLabel = keyLabel;
  Input.normBinding = normBinding;
  FS.Input = Input;

  FS.Log.info('input.js 已加载 — 键盘/鼠标/手柄输入就绪');

})(typeof window !== 'undefined' ? window : globalThis);
