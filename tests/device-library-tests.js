#!/usr/bin/env node
/* 0.6.0: 图马斯特 / 翼胜设备库 (模拟 Gamepad.id, 无真机) */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm'), ROOT = path.resolve(__dirname, '..');
var ctx = { console: console, Math: Math, JSON: JSON, localStorage: { getItem: function () { return null; }, setItem: function () {} } };
ctx.window = ctx; vm.createContext(ctx);
['js/device-library.js', 'js/joystick.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); });
var J = ctx.FS.Joystick, fail = 0;
function pad(id, na, nb) { var a = [], b = []; for (var i = 0; i < na; i++) a.push(0); for (i = 0; i < nb; i++) b.push({ pressed: false, value: 0 }); return { id: id, axes: a, buttons: b }; }
function ok(c, m) { console.log((c ? '✔ ' : '✘ ') + m); if (!c) fail++; }
var p = J.defaultProfile(pad('TCA Sidestick X (Vendor: 044f Product: 0405)', 10, 16));
ok(p.kind === 'stick' && p.axes.roll.axis === 0 && p.axes.pitch.axis === 1 && p.axes.yaw.axis === 5 && p.device && !p.device.verified, 'TCA 侧杆 (Chrome id)');
p = J.defaultProfile(pad('044f-0407-TCA Q-Eng 1&2', 8, 16));
ok(p.kind === 'throttle' && p.axes.throttle.axis === 0 && p.axes.throttle2.axis === 1 && p.axes.pitch.axis === -1, 'TCA 油门台 (Firefox id)');
p = J.defaultProfile(pad('T-Pendular-Rudder (Vendor: 044f Product: b68f)', 6, 0));
ok(p.kind === 'pedals' && p.axes.yaw.axis === 5 && p.axes.brakeL.axis === 0 && p.axes.pitch.axis === -1, 'TPR 脚舵');
p = J.defaultProfile(pad('WINWING URSA MINOR FIGHTER FLIGHT STICK R (Vendor: 4098 Product: bc2a)', 8, 32));
ok(p.kind === 'stick' && p.device.vendor === 'WINWING' && p.axes.yaw.axis === 2, '翼胜 URSA MINOR R');
p = J.defaultProfile(pad('Skywalker Rudder (Vendor: 4098 Product: bef0)', 6, 0));
ok(p.kind === 'pedals', '翼胜 Skywalker 脚舵');
p = J.defaultProfile(pad('Unknown Stick (Vendor: 1234 Product: 5678)', 4, 4));
ok(!p.device && p.kind === 'stick', '未知设备仍走通用猜测');
p = J.defaultProfile(pad('T.16000M (Vendor: 044f Product: b10a)', 3, 4));
ok(p.axes.yaw.axis === 2 || p.axes.yaw.axis === -1, '轴数不足时不绑定越界轴 (yaw=' + p.axes.yaw.axis + ')');
ok(ctx.FS.DeviceLibrary.DEVICES.every(function (d) { return /^[0-9a-f]{4}$/.test(d.pid); }), 'PID 格式');
console.log(fail ? fail + ' 项失败' : '全部通过'); process.exit(fail ? 1 : 0);
