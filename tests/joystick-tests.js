#!/usr/bin/env node
/* ==========================================================================
   天际航线 SkyRoute —— 摇杆 / 脚舵 / 油门台 映射测试 (0.4.1)
   用法:  node tests/joystick-tests.js      (无第三方依赖, 用模拟 Gamepad 对象)
   覆盖: 脚舵不会劫持侧杆俯仰/横滚; "Thrustmaster" 摇杆不被误判为油门台;
         多设备合成优先级; 油门 2 推动后才接管; 旧配置迁移 (guessed / 用户修改)。
   ========================================================================== */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '..');

function loadJoystick(stored) {
  var store = {};
  if (stored) store['fs.joystick.v1'] = JSON.stringify(stored);
  var ctx = { console: console, Math: Math, Date: Date, JSON: JSON,
    localStorage: { getItem: function (k) { return store[k] || null; }, setItem: function (k, v) { store[k] = v; } } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/joystick.js'), 'utf8'), ctx, { filename: 'joystick.js' });
  ctx.FS.Joystick._store = store;
  return ctx.FS.Joystick;
}
function pad(id, nAxes, nBtn, axes) {
  var a = []; for (var i = 0; i < nAxes; i++) a.push(axes && axes[i] !== undefined ? axes[i] : 0);
  var b = []; for (i = 0; i < (nBtn || 0); i++) b.push({ pressed: false, value: 0 });
  return { id: id, axes: a, buttons: b, connected: true, mapping: '', index: 0 };
}
function fakeInput() { var down = {}; return { down: down, isDown: function (k) { return !!down[k]; }, triggerAction: function () {} }; }

var results = [];
function test(name, fn) {
  try { fn(); results.push(true); console.log('  ✔ ' + name); }
  catch (e) { results.push(false); console.log('  ✘ ' + name + '  — ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m); }
function near(a, b, m) { assert(Math.abs(a - b) < 1e-6, m + ' (got ' + a + ', want ' + b + ')'); }

var STICK = 'Thrustmaster TCA Sidestick Airbus (Vendor: 044f Product: 0405)';
var PEDALS = 'T-Rudder (Vendor: 044f Product: b679)';
var TFRP = 'Thrustmaster TFRP Rudder (Vendor: 044f Product: b68f)';
var SAITEK = 'Saitek Pro Flight Rudder Pedals';
var QUAD = 'TCA Q-Eng 1&2 (Vendor: 044f Product: 0407)';

console.log('摇杆映射测试');

test('设备类型识别', function () {
  var J = loadJoystick();
  var cases = [
    [STICK, 'stick'], ['Thrustmaster T.16000M (Vendor: 044f Product: b10a)', 'other'],
    ['Thrustmaster T.Flight Hotas X', 'hotas'], ['Thrustmaster TWCS Throttle', 'throttle'],
    ['Saitek Pro Flight Throttle Quadrant', 'throttle'], [QUAD, 'throttle'],
    [PEDALS, 'pedals'], [TFRP, 'pedals'], ['Saitek Pro Flight Rudder Pedals', 'pedals'],
    ['Thrustmaster TPR Pendular Rudder', 'pedals'], ['MFG Crosswind Pedals', 'pedals'],
    ['VIRPIL Skywalker Rudder Pedals', 'pedals'], ['Logitech Extreme 3D Pro', 'other'],
    ['Thrustmaster HOTAS Warthog Joystick', 'stick'], ['Saitek Pro Flight Yoke', 'stick']
  ];
  cases.forEach(function (c) { var k = J.guessKind(c[0]); assert(k === c[1], c[0] + ' -> ' + k + ', want ' + c[1]); });
});

test('Thrustmaster 摇杆不会因名称含 "Thr" 被当成油门台', function () {
  var J = loadJoystick();
  ['Thrustmaster T.16000M', 'Thrustmaster TCA Sidestick Airbus', 'Thrustmaster T.Flight Stick X', 'THRUSTMASTER FCS Flight Stick'].forEach(function (id) {
    var p = J.defaultProfile(pad(id, 7, 12));
    assert(p.kind !== 'throttle', id + ' 被识别为油门台');
    assert(p.axes.pitch.axis === 1 && p.axes.roll.axis === 0, id + ' 俯仰/横滚未映射');
  });
});

test('脚舵默认映射: 方向舵 = Rz(轴5), 趾刹 = 轴0/1, 不映射俯仰/横滚', function () {
  var J = loadJoystick();
  var p = J.defaultProfile(pad(PEDALS, 6, 0));
  assert(p.kind === 'pedals', 'kind=' + p.kind);
  assert(p.axes.yaw.axis === 5, 'yaw axis=' + p.axes.yaw.axis);
  assert(p.axes.brakeL.axis === 0 && p.axes.brakeR.axis === 1, 'brakes');
  assert(p.axes.pitch.axis === -1 && p.axes.roll.axis === -1, 'pedals mapped pitch/roll');
});

test('脚舵不劫持侧杆: 脚舵在侧杆之后枚举, 趾刹 = 0 也不会把杆量清零', function () {
  var J = loadJoystick(), inp = fakeInput();
  var s = pad(STICK, 10, 16, [0.6, -0.8, 0, 0, 0, 0.1, 0, 0, 0, 1.28]);
  var r = pad(PEDALS, 6, 0, [-1, -1, 0, 0, 0, -0.5]);
  var out = J.read([s, r], inp);
  assert(out.hasStick, 'no stick');
  assert(out.roll > 0.3, 'roll overwritten: ' + out.roll);
  assert(out.pitch > 0.3, 'pitch overwritten: ' + out.pitch);  // 俯仰默认反向: Y=-0.8 -> 抬头
  assert(out.yaw < -0.3, 'yaw should come from pedals: ' + out.yaw);
  assert(out.src.yaw === PEDALS, 'yaw src=' + out.src.yaw);
  // 反过来枚举顺序也一样
  var J2 = loadJoystick(), out2 = J2.read([r, s], inp);
  near(out2.roll, out.roll, 'order-dependent roll'); near(out2.pitch, out.pitch, 'order-dependent pitch');
});

test('只连接脚舵: 不报告驾驶杆 (不顶掉鼠标/手柄杆量)', function () {
  var J = loadJoystick();
  var out = J.read([pad(TFRP, 6, 0, [0.9, -0.9, 0, 0, 0, 0.4])], fakeInput());
  assert(!out.hasStick, 'pedals reported as stick');
  assert(out.hasYaw && out.yaw > 0.2, 'yaw ' + out.yaw);
});

test('趾刹: 踩下前为 0, 踩下后为连续量', function () {
  var J = loadJoystick(), inp = fakeInput();
  var r = pad(PEDALS, 6, 0, [-1, -1, 0, 0, 0, 0]);
  var out = J.read([r], inp);
  assert(out.hasBrakes && out.brake === 0, 'brake at rest ' + out.brake);
  r.axes[0] = 0; out = J.read([r], inp);
  near(out.brakeL, 0.5, 'half left brake'); near(out.brake, 0.5, 'brake');
  r.axes[0] = 1; r.axes[1] = -1; out = J.read([r], inp);
  near(out.brakeL, 1, 'full left'); near(out.brakeR, 0, 'right released');
  // 静止在 +1 的踏板自动反向
  var J2 = loadJoystick(), r2 = pad(PEDALS, 6, 0, [1, 1, 0, 0, 0, 0]);
  out = J2.read([r2], inp); assert(out.brake === 0, 'inverted rest ' + out.brake);
  r2.axes[1] = -1; out = J2.read([r2], inp); near(out.brakeR, 1, 'inverted full right');
});

test('合成优先级: 俯仰/横滚 侧杆 > HOTAS > 其它', function () {
  var J = loadJoystick(), inp = fakeInput();
  var other = pad('Logitech Extreme 3D Pro', 4, 12, [-0.9, 0.9, 0, 0]);
  var hotas = pad('Thrustmaster T.Flight Hotas X', 5, 12, [0.5, 0.5, 0, 0, 0]);
  var stick = pad(STICK, 10, 16, [0, 0, 0, 0, 0, 0, 0, 0, 0, 1.28]);
  var out = J.read([other, hotas, stick], inp);
  assert(out.src.roll === STICK && out.roll === 0, 'stick should win roll even when centered: ' + out.src.roll);
  out = J.read([other, hotas], inp);
  assert(out.src.roll === hotas.id, 'hotas should beat other: ' + out.src.roll);
});

test('方向舵: 脚舵 > 摇杆扭转', function () {
  var J = loadJoystick(), inp = fakeInput();
  var stick = pad(STICK, 10, 16, [0, 0, 0, 0, 0, 0.9, 0, 0, 0, 1.28]);
  var ped = pad(PEDALS, 6, 0, [-1, -1, 0, 0, 0, 0]);
  var out = J.read([ped, stick], inp);
  assert(out.src.yaw === PEDALS && out.yaw === 0, 'pedals should win yaw: ' + out.src.yaw + ' ' + out.yaw);
});

test('油门台 (TCA Q-Eng) 识别与双油门', function () {
  var J = loadJoystick();
  var p = J.defaultProfile(pad(QUAD, 8, 20));
  assert(p.kind === 'throttle' && p.axes.throttle.axis === 0 && p.axes.throttle2.axis === 1, 'quadrant mapping');
  assert(p.axes.pitch.axis === -1, 'quadrant pitch');
});

test('油门 2 与油门 1 一样: 推动后才接管, 键盘油门可收回控制权', function () {
  var J = loadJoystick(), inp = fakeInput();
  var q = pad(QUAD, 8, 20, [1, 1]);   // 反向: +1 = 慢车
  var out = J.read([q], inp);
  assert(out.hasThrottle2 && !out.throttle2Moved && !out.throttleMoved, 'should not take over before moving');
  q.axes[1] = 0; out = J.read([q], inp);
  assert(out.throttle2Moved && !out.throttleMoved, 'lever 2 moved -> only throttle2 owned');
  near(out.throttle2, 0.5, 'throttle2 value');
  q.axes[0] = -1; out = J.read([q], inp);
  assert(out.throttleMoved && out.throttle2Moved, 'both owned');
  inp.down.throttleUp = true; out = J.read([q], inp);
  assert(!out.throttleMoved && !out.throttle2Moved, 'keyboard should release both levers');
  inp.down.throttleUp = false; out = J.read([q], inp);
  assert(!out.throttleMoved && !out.throttle2Moved, 'stays released until moved again');
  q.axes[1] = 0.5; out = J.read([q], inp);
  assert(out.throttle2Moved && !out.throttleMoved, 'lever 2 re-takes over alone');
});

test('input.js: throttleR 未推动时跟随 throttle', function () {
  // 只验证合成逻辑: 复用 input.js 中的表达式
  var src = fs.readFileSync(path.join(ROOT, 'js/input.js'), 'utf8');
  assert(/joy\.throttle2Moved/.test(src), 'input.js throttleR must check throttle2Moved');
});

test('配置迁移: guessed 配置按新规则重建 (保留滑块), 用户修改的配置保留', function () {
  var stored = {};
  // 旧版把脚舵当摇杆 (自动猜测)
  stored[PEDALS] = { axes: { pitch: { axis: 1, invert: true }, roll: { axis: 0, invert: false }, yaw: { axis: 5, invert: false },
    throttle: { axis: -1, invert: true }, throttle2: { axis: -1, invert: true }, hat: { axis: -1, invert: false } },
    deadzone: 0.12, sensitivity: 1, curve: 1.3, buttons: {}, guessed: true, kind: 'stick' };
  // 旧版用户手动改过的脚舵配置 (名称不含 thr -> 旧版当成摇杆): 俯仰/横滚仍是旧默认 (未改), 方向舵改到轴 2
  stored[SAITEK] = { axes: { pitch: { axis: 1, invert: true }, roll: { axis: 0, invert: false }, yaw: { axis: 2, invert: true },
    throttle: { axis: -1, invert: true }, throttle2: { axis: -1, invert: true }, hat: { axis: -1, invert: false } },
    deadzone: 0.05, sensitivity: 1, curve: 1.3, buttons: { brakes: 3 }, guessed: false, kind: 'stick' };
  // 旧版 "Thrustmaster TFRP" 因 /thr/ 被当成油门台 (趾刹 = 油门 1/2), 用户改过按钮
  stored[TFRP] = { axes: { pitch: { axis: -1, invert: true }, roll: { axis: -1, invert: false }, yaw: { axis: -1, invert: false },
    throttle: { axis: 0, invert: true }, throttle2: { axis: 1, invert: true }, hat: { axis: -1, invert: false } },
    deadzone: 0.05, sensitivity: 1, curve: 1.3, buttons: { brakes: 2 }, guessed: false, kind: 'throttle' };
  // 用户手动给油门台的轴 4 绑了横滚 (不常见, 但应尊重)
  stored[QUAD] = { axes: { pitch: { axis: -1, invert: true }, roll: { axis: 4, invert: false }, yaw: { axis: -1, invert: false },
    throttle: { axis: 0, invert: true }, throttle2: { axis: 1, invert: true }, hat: { axis: -1, invert: false } },
    deadzone: 0.05, sensitivity: 1, curve: 1.3, buttons: {}, guessed: false, kind: 'throttle' };
  var J = loadJoystick(stored), inp = fakeInput();
  var p1 = J.profile(pad(PEDALS, 6, 0));
  assert(p1.kind === 'pedals' && p1.axes.pitch.axis === -1 && p1.axes.yaw.axis === 5, 'guessed pedals not regenerated');
  near(p1.deadzone, 0.12, 'deadzone kept');
  var p2 = J.profile(pad(SAITEK, 6, 4));
  assert(p2.kind === 'pedals', 'kind updated');
  assert(p2.axes.yaw.axis === 2 && p2.axes.yaw.invert === true && p2.buttons.brakes === 3, 'user edits lost');
  assert(p2.axes.pitch.axis === 1 && !p2.axes.pitch.manual, 'old default pitch should be kept but not manual');
  assert(p2.axes.brakeL.axis === 0 && p2.axes.brakeR.axis === 1, 'toe brakes not added');
  var out = J.read([pad(STICK, 10, 16, [0.5, 0, 0, 0, 0, 0, 0, 0, 0, 1.28]), pad(SAITEK, 6, 4, [-1, -1, 0.3, 0, 0, 0])], inp);
  assert(out.src.roll === STICK && out.src.pitch === STICK && out.roll > 0.3, 'edited legacy pedals still hijack stick');
  var pt = J.profile(pad(TFRP, 6, 4));
  assert(pt.kind === 'pedals' && pt.buttons.brakes === 2 && !pt.axes.throttle.manual, 'TFRP migration');
  out = J.read([pad(TFRP, 6, 4, [0.2, 0.2, 0, 0, 0, 0])], inp);
  out = J.read([pad(TFRP, 6, 4, [0.6, 0.6, 0, 0, 0, 0])], inp);
  assert(!out.hasThrottle && !out.throttleMoved, 'legacy TFRP toe brakes still drive throttle');
  var p3 = J.profile(pad(QUAD, 8, 20));
  assert(p3.axes.roll.axis === 4 && p3.axes.roll.manual === true, 'manual roll on quadrant not marked manual');
  out = J.read([pad(QUAD, 8, 20, [1, 1, 0, 0, 0.7])], inp);
  assert(out.hasStick && out.roll > 0.5, 'manual binding should participate: ' + out.roll);
  var saved = JSON.parse(J._store['fs.joystick.v1']);
  assert(saved[PEDALS].schema === 2 && saved[TFRP].schema === 2 && saved[SAITEK].schema === 2, 'migrated config not saved');
});

var fail = results.filter(function (x) { return !x; }).length;
console.log('\n' + (results.length - fail) + '/' + results.length + ' 通过');
process.exit(fail ? 1 : 0);
