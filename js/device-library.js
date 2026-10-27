/* =====================================================================
 * device-library.js — 图马斯特 (Thrustmaster) / 翼胜 (WINWING) 设备库 (beta 0.6.0, 0.6.1 补全)
 *
 * 按 USB VID/PID 识别设备, 给出设备类型与默认轴 / 按钮映射, 供 joystick.js 的 defaultProfile() 使用。
 * Chrome/Edge 的 Gamepad.id 形如 "T.A320 Pilot (Vendor: 044f Product: 0405)",
 * Firefox 形如 "044f-0405-T.A320 Pilot"; 两种都能解析。
 *
 * ⚠ 没有真机: 轴序号按 Windows DirectInput 轴顺序 (X, Y, Z, Rx, Ry, Rz, Slider0, Slider1)
 *   推算 Chrome 的 axes[] 下标 (Chrome/Windows: X=0 Y=1 Z=2 Rx=3 Ry=4 Rz=5 Slider=6 / 7; Hat 常为 9),
 *   全部条目 verified:false, 需要在真机上核对 (设置 → 摇杆 里可以随时改绑定, 改过的绑定会被保存)。
 *   PID 标 src:'public' 的来自公开的 USB ID 数据库 / Linux 内核驱动 / 厂商驱动清单; 标 src:'unconfirmed' 的为社区资料, 更需核对。
 *   按钮号为 0 起 (Gamepad API), 与 Windows「游戏控制器」里显示的编号差 1。
 * ===================================================================== */
(function (global) {
  'use strict';
  var FS = global.FS = global.FS || {};
  var TM = '044f', WW = '4098';

  // axes: 功能 -> [轴号, 反向]; buttons: 功能 -> 按钮号
  var DEVICES = [
    /* ---------- Thrustmaster ---------- */
    { vid: TM, pid: '0405', vendor: 'Thrustmaster', name: 'TCA Sidestick Airbus Edition (T.A320 Pilot)', kind: 'stick', src: 'public',
      axes: { roll: [0, false], pitch: [1, true], yaw: [5, false], throttle: [6, true] },
      buttons: { ptt: 0, apDisconnect: 1, brakes: 2, gearToggle: 3 } },
    { vid: TM, pid: '0406', vendor: 'Thrustmaster', name: 'TCA Sidestick Airbus Edition 副驾驶 (T.A320 Copilot)', kind: 'stick', src: 'public',
      axes: { roll: [0, false], pitch: [1, true], yaw: [5, false], throttle: [6, true] },
      buttons: { ptt: 0, apDisconnect: 1, brakes: 2, gearToggle: 3 } },
    { vid: TM, pid: '0407', vendor: 'Thrustmaster', name: 'TCA Quadrant Airbus Edition', kind: 'throttle', src: 'unconfirmed',
      axes: { throttle: [0, true], throttle2: [1, true] },
      buttons: { apThrottle: 0, throttleToggleRev: 4, masterAck: 2 } },   // 0.6.1: 推力杆上的 A/THR 瞬时断开按钮
    { vid: TM, pid: '0409', vendor: 'Thrustmaster', name: 'TCA Yoke Boeing Edition', kind: 'stick', src: 'unconfirmed',
      axes: { roll: [0, false], pitch: [1, true] },
      buttons: { apDisconnect: 0, ptt: 1, flapsUp: 4, flapsDown: 5, masterAck: 2 } },
    { vid: TM, pid: '040a', vendor: 'Thrustmaster', name: 'TCA Quadrant Boeing Edition', kind: 'throttle', src: 'unconfirmed',
      axes: { throttle: [0, true], throttle2: [1, true] },
      buttons: { apThrottle: 0, throttleTOGA: 1, throttleToggleRev: 2 } },
    { vid: TM, pid: 'b10a', vendor: 'Thrustmaster', name: 'T.16000M 摇杆', kind: 'stick', src: 'public',
      axes: { roll: [0, false], pitch: [1, true], yaw: [5, false], throttle: [6, true] },
      buttons: { ptt: 0, apDisconnect: 1, brakes: 2, gearToggle: 3 } },
    { vid: TM, pid: 'b687', vendor: 'Thrustmaster', name: 'TWCS 油门', kind: 'throttle', src: 'public',
      axes: { throttle: [2, true] }, buttons: { throttleToggleRev: 0 } },
    { vid: TM, pid: 'b108', vendor: 'Thrustmaster', name: 'T.Flight HOTAS X', kind: 'hotas', src: 'public',
      axes: { roll: [0, false], pitch: [1, true], yaw: [5, false], throttle: [2, true] },
      buttons: { apDisconnect: 1, ptt: 0, brakes: 2, gearToggle: 3 } },
    { vid: TM, pid: 'b67b', vendor: 'Thrustmaster', name: 'T.Flight HOTAS 4', kind: 'hotas', src: 'unconfirmed',
      axes: { roll: [0, false], pitch: [1, true], yaw: [5, false], throttle: [2, true] },
      buttons: { apDisconnect: 1, ptt: 0, brakes: 2, gearToggle: 3 } },
    { vid: TM, pid: 'b68d', vendor: 'Thrustmaster', name: 'T.Flight HOTAS One', kind: 'hotas', src: 'unconfirmed',
      axes: { roll: [0, false], pitch: [1, true], yaw: [5, false], throttle: [2, true] },
      buttons: { apDisconnect: 1, ptt: 0, brakes: 2, gearToggle: 3 } },
    { vid: TM, pid: '0402', vendor: 'Thrustmaster', name: 'HOTAS Warthog 摇杆', kind: 'stick', src: 'public',
      axes: { roll: [0, false], pitch: [1, true] }, buttons: { ptt: 0, apDisconnect: 4, brakes: 1 } },
    { vid: TM, pid: '0404', vendor: 'Thrustmaster', name: 'HOTAS Warthog 油门', kind: 'throttle', src: 'public',
      axes: { throttle: [5, true], throttle2: [2, true] }, buttons: { gearToggle: 21 } },
    { vid: TM, pid: 'b679', vendor: 'Thrustmaster', name: 'T.Flight Rudder Pedals (TFRP)', kind: 'pedals', src: 'public',
      axes: { yaw: [5, false], brakeL: [0, false], brakeR: [1, false] }, buttons: {} },
    { vid: TM, pid: 'b68f', vendor: 'Thrustmaster', name: 'TPR Pendular Rudder', kind: 'pedals', src: 'unconfirmed',
      axes: { yaw: [5, false], brakeL: [0, false], brakeR: [1, false] }, buttons: {} },
    { vid: TM, pid: 'b370', vendor: 'Thrustmaster', name: 'T-LCM Pro Pedals', kind: 'pedals', src: 'public',
      axes: { yaw: [5, false], brakeL: [0, false], brakeR: [1, false] }, buttons: {} },
    { vid: TM, pid: 'b106', vendor: 'Thrustmaster', name: 'T.Flight Stick X', kind: 'hotas', src: 'public',
      axes: { roll: [0, false], pitch: [1, true], yaw: [5, false], throttle: [2, true] },
      buttons: { apDisconnect: 1, ptt: 0, brakes: 2, gearToggle: 3 } },
    { vid: TM, pid: '0400', vendor: 'Thrustmaster', name: 'HOTAS Cougar', kind: 'hotas', src: 'public',
      axes: { roll: [0, false], pitch: [1, true], throttle: [2, true] }, buttons: { ptt: 0, apDisconnect: 4, brakes: 1 } },
    /* ---------- WINWING (翼胜) ---------- */
    { vid: WW, pid: 'bc27', vendor: 'WINWING', name: 'URSA MINOR Airline Joystick L', kind: 'stick', src: 'unconfirmed',
      axes: { roll: [0, false], pitch: [1, true], yaw: [5, false] }, buttons: { ptt: 0, apDisconnect: 1, brakes: 2 } },
    { vid: WW, pid: 'bc28', vendor: 'WINWING', name: 'URSA MINOR Airline Joystick R', kind: 'stick', src: 'unconfirmed',
      axes: { roll: [0, false], pitch: [1, true], yaw: [5, false] }, buttons: { ptt: 0, apDisconnect: 1, brakes: 2 } },
    { vid: WW, pid: 'bc29', vendor: 'WINWING', name: 'URSA MINOR Fighter Stick L', kind: 'stick', src: 'public',
      axes: { roll: [0, false], pitch: [1, true], yaw: [2, false], throttle: [6, true] }, buttons: { ptt: 0, apDisconnect: 1 } },
    { vid: WW, pid: 'bc2a', vendor: 'WINWING', name: 'URSA MINOR Fighter Stick R', kind: 'stick', src: 'public',
      axes: { roll: [0, false], pitch: [1, true], yaw: [2, false], throttle: [6, true] }, buttons: { ptt: 0, apDisconnect: 1 } },
    { vid: WW, pid: 'be62', vendor: 'WINWING', name: 'Orion 2 / TGRIP-18', kind: 'stick', src: 'public',
      axes: { roll: [0, false], pitch: [1, true] }, buttons: { ptt: 0, apDisconnect: 1 } },
    { vid: WW, pid: 'be68', vendor: 'WINWING', name: 'Orion 2 / TGRIP-16EX', kind: 'stick', src: 'public',
      axes: { roll: [0, false], pitch: [1, true] }, buttons: { ptt: 0, apDisconnect: 1 } },
    { vid: WW, pid: 'bd64', vendor: 'WINWING', name: 'Orion 2 / TGRIP-15EX', kind: 'stick', src: 'public',
      axes: { roll: [0, false], pitch: [1, true] }, buttons: { ptt: 0, apDisconnect: 1 } },
    { vid: WW, pid: 'b920', vendor: 'WINWING', name: 'URSA MINOR 32 Throttle (TOP ARC)', kind: 'throttle', src: 'unconfirmed',
      axes: { throttle: [0, true], throttle2: [1, true] }, buttons: { throttleToggleRev: 0 } },
    { vid: WW, pid: 'bef0', vendor: 'WINWING', name: 'Skywalker Metal Rudder Pedals', kind: 'pedals', src: 'unconfirmed',
      axes: { yaw: [5, false], brakeL: [0, false], brakeR: [1, false] }, buttons: {} }
  ];
  // 0.6.1: PID 未收录时按设备名匹配 (翼胜新品 / 图马斯特变体常共用同一套轴序)
  var NAMED = [
    { re: /URSA MINOR.*(Airline|Throttle)|TOP ?ARC|AIRBUS THROTTLE/i, vendor: 'WINWING', name: 'WINWING 空客油门台 (按名称匹配)', kind: 'throttle', src: 'name',
      axes: { throttle: [0, true], throttle2: [1, true] }, buttons: { apThrottle: 0, throttleToggleRev: 1 } },
    { re: /ORION.*THROTTLE|F\/?A-?18.*THROTTLE|F-?16EX.*THROTTLE/i, vendor: 'WINWING', name: 'WINWING Orion 油门 (按名称匹配)', kind: 'throttle', src: 'name',
      axes: { throttle: [0, true], throttle2: [1, true] }, buttons: {} },
    { re: /URSA MINOR.*(Joystick|Stick)|SIDESTICK/i, vendor: 'WINWING', name: 'WINWING 侧杆 (按名称匹配)', kind: 'stick', src: 'name',
      axes: { roll: [0, false], pitch: [1, true], yaw: [5, false] }, buttons: { ptt: 0, apDisconnect: 1 } },
    { re: /SKYWALKER|WINWING.*RUDDER/i, vendor: 'WINWING', name: 'WINWING 脚舵 (按名称匹配)', kind: 'pedals', src: 'name',
      axes: { yaw: [5, false], brakeL: [0, false], brakeR: [1, false] }, buttons: {} },
    { re: /TCA Q|Quadrant/i, vendor: 'Thrustmaster', name: 'TCA 油门台 (按名称匹配)', kind: 'throttle', src: 'name',
      axes: { throttle: [0, true], throttle2: [1, true] }, buttons: { apThrottle: 0, throttleToggleRev: 4 } },
    { re: /TCA Yoke|Boeing.*Yoke/i, vendor: 'Thrustmaster', name: 'TCA Yoke (按名称匹配)', kind: 'stick', src: 'name',
      axes: { roll: [0, false], pitch: [1, true] }, buttons: { apDisconnect: 0, ptt: 1 } }
  ];
  var VENDORS = { '044f': 'Thrustmaster', '4098': 'WINWING' };

  function parseId(id) {
    id = String(id || '');
    var m = /vendor:\s*([0-9a-f]{4})\s*product:\s*([0-9a-f]{4})/i.exec(id) || /^([0-9a-f]{4})-([0-9a-f]{4})-/i.exec(id);
    return m ? { vid: m[1].toLowerCase(), pid: m[2].toLowerCase() } : null;
  }
  function lookup(id) {
    var v = parseId(id); if (!v) return null;
    for (var i = 0; i < DEVICES.length; i++) if (DEVICES[i].vid === v.vid && DEVICES[i].pid === v.pid) return DEVICES[i];
    if (!VENDORS[v.vid]) return null;
    for (i = 0; i < NAMED.length; i++) if (NAMED[i].re.test(String(id))) return NAMED[i];
    return null;
  }
  /** 把库里的默认映射写进 joystick.js 的 profile (只在轴号存在时) */
  function apply(p, pad) {
    var d = lookup(pad && pad.id); if (!d) return p;
    var n = pad && pad.axes ? pad.axes.length : 0, nb = pad && pad.buttons ? pad.buttons.length : 0;
    p.kind = d.kind;
    Object.keys(p.axes).forEach(function (f) { if (f !== 'hat') p.axes[f].axis = -1; });
    Object.keys(d.axes).forEach(function (f) { var a = d.axes[f]; if (p.axes[f] && a[0] < n) { p.axes[f].axis = a[0]; p.axes[f].invert = a[1]; } });
    if (d.kind === 'pedals') p.axes.hat.axis = -1;
    Object.keys(p.buttons).forEach(function (f) { p.buttons[f] = -1; });
    Object.keys(d.buttons).forEach(function (f) { var b = d.buttons[f]; if (f in p.buttons && b < nb) p.buttons[f] = b; });
    p.device = { vendor: d.vendor, name: d.name, vid: d.vid, pid: d.pid, verified: false, src: d.src };
    return p;
  }
  FS.DeviceLibrary = { DEVICES: DEVICES, NAMED: NAMED, VENDORS: VENDORS, parseId: parseId, lookup: lookup, apply: apply,
    vendorOf: function (id) { var v = parseId(id); return v ? (VENDORS[v.vid] || null) : null; } };
})(typeof window !== 'undefined' ? window : globalThis);
