/* ==========================================================================
   飞行模拟器 — 玻璃座舱航电显示 (avionics.js)
     · PFD  主飞行显示 (空客布局: FMA / 速度带 / 姿态 / 高度带 / 升降速度 / 航向)
     · ND   导航显示 (罗盘/弧形, 航路, 地形, 气象, TCAS, ILS)
     · ECAM 发动机与告警显示 (E/WD)
     · HUD  平视显示器
   全部使用 Canvas 2D 绘制, 无外部资源依赖
   ========================================================================== */
(function (global) {
  'use strict';

  var FS = global.FS = global.FS || {};
  var U = FS.Utils;
  var C = FS.CONST;
  var R2D = C.RAD, D2R = C.DEG;

  /* ---------------------------------------------------------------------
     配色 (Airbus 风格)
     --------------------------------------------------------------------- */
  var COL = {
    bg: '#050708',
    panel: '#0d1114',
    white: '#ffffff',
    green: '#00ff3c',
    cyan: '#00f0ff',
    magenta: '#ff00ff',
    amber: '#ffb400',
    yellow: '#ffff00',
    red: '#ff1a1a',
    grey: '#8a9299',
    darkGrey: '#4a5157',
    sky: '#1a6fc4',
    ground: '#8b5a2b',
    tapeBg: '#1a1e20',
    tapeLine: '#9aa3a9',
    trail: '#c8d0d4'
  };
  FS.DISPLAY_COLORS = COL;

  var FONT = '"DIN Alternate","Bahnschrift","Helvetica Neue",Arial,sans-serif';
  var MONO = '"SF Mono","Consolas","Menlo",monospace';

  /* ---------------------------------------------------------------------
     绘图工具
     --------------------------------------------------------------------- */
  function fnt(size, weight) {
    return (weight || 'bold') + ' ' + size.toFixed(1) + 'px ' + FONT;
  }
  function fntM(size, weight) {
    return (weight || 'bold') + ' ' + size.toFixed(1) + 'px ' + MONO;
  }

  function txt(ctx, s, x, y, size, color, align, weight) {
    ctx.font = fnt(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  function txtM(ctx, s, x, y, size, color, align, weight) {
    ctx.font = fntM(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  function strokeRect(ctx, x, y, w, h, color, lw) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw || 2;
    ctx.strokeRect(x, y, w, h);
  }
  function line(ctx, x1, y1, x2, y2, color, lw) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw || 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  function poly(ctx, pts, color, fill) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = color; ctx.fill(); }
    else { ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke(); }
  }
  function fmtSigned(v, digits, plus) {
    var s = Math.abs(v).toFixed(digits === undefined ? 0 : digits);
    if (v < 0) return '-' + s;
    return plus ? '+' + s : s;
  }
  function padNum(v, n) {
    var s = String(Math.round(Math.abs(v)));
    while (s.length < n) s = '0' + s;
    return (v < 0 ? '-' : '') + s;
  }
  /** 把高度换算成航班高度层写法 (FL350 / 3500) */
  function altLabel(ft) {
    if (ft >= 10000) return 'FL' + Math.round(ft / 100);
    return String(Math.round(ft / 20) * 20);
  }

  /* =====================================================================
     一、PFD 主飞行显示
     ===================================================================== */
  function PFD(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = opts || {};
    this.W = canvas.width;
    this.H = canvas.height;
    this.S = this.W / 480;                  // 设计尺寸到实际尺寸的比例
    this.side = (opts && opts.side) || 'L';
    this.baroStd = true;
    this.baroSetting = 1013.25;
    this.speedTrend = new FS.Ring(30);
    this._lastIas = null;
    this._trend = 0;
    this.fdPitch = 0;
    this.fdRoll = 0;
  }

  PFD.prototype.setSize = function (w, h) {
    this.canvas.width = w; this.canvas.height = h;
    this.W = w; this.H = h; this.S = w / 480;
  };

  PFD.prototype.render = function (d) {
    var ctx = this.ctx;
    var S = this.S;
    var st = d.st;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    rect(ctx, 0, 0, this.W, this.H, COL.bg);
    ctx.translate(0, 0);
    ctx.scale(S, S);

    var ias = st.iasKt;
    // 速度趋势
    if (this._lastIas !== null) {
      var dv = (ias - this._lastIas);
      this._trend = U.damp(this._trend, dv * 58, 1.1, 1 / 30);   // 每秒趋势
    }
    this._lastIas = ias;

    this._drawFMA(ctx, d);
    this._drawSpeedTape(ctx, d);
    this._drawAttitude(ctx, d);
    this._drawAltitudeTape(ctx, d);
    this._drawVSI(ctx, d);
    this._drawHeading(ctx, d);
    this._drawBottomInfo(ctx, d);

    ctx.restore();
  };

  /* ---------------- FMA 飞行方式通告器 ---------------- */
  PFD.prototype._drawFMA = function (ctx, d) {
    var x0 = 44, y0 = 6, w = 392, h = 44;
    var ap = d.ap, fm = d.st;
    var fma = ap ? ap.getFMA() : null;
    if (!fma) return;

    line(ctx, x0, y0 + 22, x0 + w, y0 + 22, COL.darkGrey, 1);
    line(ctx, x0 + w / 3, y0, x0 + w / 3, y0 + h, COL.darkGrey, 1);
    line(ctx, x0 + 2 * w / 3, y0, x0 + 2 * w / 3, y0 + h, COL.darkGrey, 1);

    var colW = w / 3;
    function modeColor(m) {
      if (m === 'green') return COL.green;
      if (m === 'amber') return COL.amber;
      if (m === 'warn') return COL.amber;
      return COL.green;
    }

    // 第一列: 自动推力
    txt(ctx, fma.thrust, x0 + colW / 2, y0 + 11, 19, fma.engaged || fma.athr ? modeColor(fma.thrustColor) : COL.white);
    if (fma.thrustArmed) txt(ctx, fma.thrustArmed, x0 + colW / 2, y0 + 33, 17, COL.cyan);

    // 第二列: 垂直
    var vCol = x0 + colW + colW / 2;
    var vColor = fma.engaged ? modeColor(fma.pitchColor) : COL.green;
    if (fma.pitch === '---') vColor = COL.white;
    txt(ctx, fma.pitch, vCol, y0 + 11, 19, vColor);
    if (fma.pitchArmed) txt(ctx, fma.pitchArmed, vCol, y0 + 33, 17, COL.cyan);

    // 第三列: 水平
    var hCol = x0 + 2 * colW + colW / 2;
    var hColor = fma.engaged ? modeColor(fma.rollColor) : COL.green;
    if (fma.roll === '---') hColor = COL.white;
    txt(ctx, fma.roll, hCol, y0 + 11, 19, hColor);
    if (fma.rollArmed) txt(ctx, fma.rollArmed, hCol, y0 + 33, 17, COL.cyan);

    // AP / ATHR / FD 状态
    var statusY = y0 + h + 4;
    ctx.font = fnt(13);
    ctx.textAlign = 'left';
    if (fma.fd) txt(ctx, 'FD', x0, statusY + 4, 13, COL.green, 'left');
    if (fma.ap1) txt(ctx, 'AP1', x0 + 26, statusY + 4, 13, COL.green, 'left');
    if (fma.ap2) txt(ctx, 'AP2', x0 + 60, statusY + 4, 13, COL.green, 'left');
    if (fma.athr) txt(ctx, 'A/THR', x0 + 96, statusY + 4, 13, COL.green, 'left');
    if (!fma.engaged && !fma.fd) txt(ctx, 'AP OFF', x0 + 26, statusY + 4, 13, COL.amber, 'left');
  };

  /* ---------------- 速度带 ---------------- */
  PFD.prototype._drawSpeedTape = function (ctx, d) {
    var st = d.st;
    var x = 46, y = 60, w = 72, h = 336;
    var cx = x + w;                    // 速度带右边缘 (窗口在右侧)
    var cy = y + h / 2;
    var pxPerKt = h / 92;              // 显示 ±46 kt

    var ias = st.iasKt;

    // 背景
    rect(ctx, x, y, w, h, COL.tapeBg);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    // 刻度
    var lo = Math.floor((ias - 48) / 5) * 5;
    var hi = ias + 48;
    ctx.font = fnt(17);
    for (var v = lo; v <= hi; v += 5) {
      var yy = cy - (v - ias) * pxPerKt;
      if (yy < y - 20 || yy > y + h + 20) continue;
      var major = (Math.round(v) % 10 === 0);
      line(ctx, cx - (major ? 18 : 10), yy, cx, yy, COL.tapeLine, major ? 2 : 1.5);
      if (major && v >= 0) {
        txt(ctx, String(Math.round(v)), cx - 22, yy, 17, COL.white, 'right');
      }
    }

    // 抬前轮/决断速度标记 (起飞时)
    var vs = d.vspeeds;
    if (vs && d.showVSpeeds && st.onGround) {
      var marks = [
        { v: vs.V1, label: 'V1', color: COL.green },
        { v: vs.Vr, label: 'VR', color: COL.green },
        { v: vs.V2, label: 'V2', color: COL.green }
      ];
      for (var m = 0; m < marks.length; m++) {
        var mv = marks[m];
        var my = cy - (mv.v - ias) * pxPerKt;
        if (my > y && my < y + h) {
          line(ctx, x, my, x + 30, my, mv.color, 2);
          txt(ctx, mv.label, x + 34, my, 15, mv.color, 'left');
        }
      }
    }

    // VLS / VFE / Vmax
    if (vs) {
      var vlsY = cy - (vs.Vref - ias) * pxPerKt;
      if (vlsY > y && vlsY < y + h) {
        // 琥珀色 VLS 标记
        poly(ctx, [[x, vlsY], [x + 12, vlsY - 6], [x + 12, vlsY + 6]], COL.amber, true);
      }
      var vfeY = cy - (vs.Vfe - ias) * pxPerKt;
      if (vfeY > y && vfeY < y + h && vs.Vfe < 900) {
        line(ctx, x, vfeY, x + 26, vfeY, COL.amber, 3);
      }
    }
    // VMO
    var vmoY = cy - (st.typeKey ? (FS.AIRCRAFT_DB[st.typeKey].perf.vmo - ias) * pxPerKt : 0);
    if (vmoY > y && vmoY < y + h) {
      // 红黑相间条
      for (var i = 0; i < 8; i++) {
        rect(ctx, x + i * 6, vmoY, 3, 5, i % 2 ? COL.red : COL.white);
      }
    }

    ctx.restore();

    // 边框
    strokeRect(ctx, x, y, w, h, COL.tapeLine, 1.5);

    // 当前速度窗口
    var winH = 30;
    rect(ctx, x - 4, cy - winH / 2, w + 10, winH, COL.bg);
    strokeRect(ctx, x - 4, cy - winH / 2, w + 10, winH, COL.tapeLine, 2);
    // 指示三角
    poly(ctx, [[x + w + 8, cy - 9], [x + w + 8, cy + 9], [x + w + 1, cy]], COL.white, true);
    txt(ctx, String(Math.round(ias)), x + w - 4, cy, 24, COL.white, 'right');

    // 速度趋势箭头
    if (Math.abs(this._trend) > 1.2) {
      var tLen = U.clamp(this._trend * 2.6, -64, 64);
      var ty = cy - tLen;
      line(ctx, x + w - 14, cy, x + w - 14, ty, COL.yellow, 3);
      var dir = tLen < 0 ? 1 : -1;
      poly(ctx, [
        [x + w - 14, ty], [x + w - 19, ty + 9 * dir], [x + w - 9, ty + 9 * dir]
      ], COL.yellow, true);
    }

    // 选择速度 (洋红)
    if (d.ap && d.ap.ap && d.ap.ap.targetIas && !d.ap.ap.targetMach) {
      var selY = cy - (d.ap.ap.targetIas - ias) * pxPerKt;
      selY = U.clamp(selY, y + 8, y + h - 8);
      txt(ctx, String(Math.round(d.ap.ap.targetIas)), cx - 6, selY - 16, 19, COL.magenta, 'right');
      // 洋红三角
      poly(ctx, [[x + 12, selY], [x + 22, selY - 6], [x + 22, selY + 6]], COL.magenta, true);
    }

    // 马赫数
    txt(ctx, st.mach.toFixed(3), x + w / 2, y + h + 16, 18, COL.green);
    txt(ctx, 'MACH', x + w / 2, y + h + 32, 12, COL.green);

    // 选择马赫
    if (d.ap && d.ap.ap && d.ap.ap.targetMach) {
      txt(ctx, d.ap.ap.targetMach.toFixed(3), x + w / 2, y + h + 16, 18, COL.green);
      var mY = U.clamp(cy - 0, y + 8, y + h - 8);
    }
  };

  /* ---------------- 姿态指示器 ---------------- */
  PFD.prototype._drawAttitude = function (ctx, d) {
    var st = d.st;
    var x = 126, y = 60, w = 224, h = 292;
    var cx = x + w / 2, cy = y + h / 2;
    var pxPerDeg = 8.2;
    var R = 100;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    var pitchPx = st.pitchDeg * pxPerDeg;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-st.roll);

    // 天空/地面
    var horizonY = pitchPx;
    var big = 900;
    ctx.beginPath();
    ctx.rect(-big, -big, big * 2, big + horizonY, );
    ctx.fillStyle = COL.sky;
    ctx.fill();
    ctx.beginPath();
    ctx.rect(-big, horizonY, big * 2, big * 2);
    ctx.fillStyle = COL.ground;
    ctx.fill();

    // 天地线
    line(ctx, -big, horizonY, big, horizonY, COL.white, 2.5);

    // 俯仰刻度
    ctx.font = fnt(15);
    ctx.fillStyle = COL.white;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var p = -90; p <= 90; p += 2.5) {
      if (Math.abs(p) < 0.1) continue;
      var py = horizonY - p * pxPerDeg;
      if (py < -h || py > h) continue;
      var major = Math.abs(p % 10) < 0.01;
      var mid = Math.abs(p % 5) < 0.01;
      if (!major && !mid) continue;
      var halfW = major ? 46 : (mid ? 32 : 16);
      line(ctx, -halfW, py, halfW, py, COL.white, major ? 2.5 : 1.8);
      if (major) {
        ctx.fillStyle = COL.white;
        ctx.fillText(String(Math.round(p)), -halfW - 18, py);
        ctx.fillText(String(Math.round(p)), halfW + 18, py);
      }
    }
    ctx.restore();

    // 滚转刻度 (固定在屏幕上)
    ctx.save();
    ctx.translate(cx, cy);
    var rollAngles = [0, 10, 20, 30, 45, 60];
    for (var ri = 0; ri < rollAngles.length; ri++) {
      var a = rollAngles[ri];
      for (var sgn = -1; sgn <= 1; sgn += 2) {
        if (a === 0 && sgn > 0) continue;
        var ang = (sgn * a - 90) * D2R;
        var r1 = R, r2 = R - (a % 30 === 0 ? 14 : 8);
        var ax1 = Math.cos(ang) * r1, ay1 = Math.sin(ang) * r1;
        var ax2 = Math.cos(ang) * r2, ay2 = Math.sin(ang) * r2;
        line(ctx, ax1, ay1, ax2, ay2, COL.white, a === 0 ? 3 : 2);
        if (a > 0) {
          var tx = Math.cos(ang) * (R + 13), ty = Math.sin(ang) * (R + 13);
          ctx.font = fnt(13);
          ctx.fillStyle = COL.white;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(a), tx, ty);
        }
      }
    }

    // 滚转指针 (倒三角)
    ctx.rotate(-st.roll);
    poly(ctx, [[0, -R + 6], [-9, -R - 10], [9, -R - 10]], COL.yellow, true);
    ctx.restore();

    // 固定飞机符号
    var fw = 62;
    line(ctx, cx - fw, cy, cx - 16, cy, COL.yellow, 5);
    line(ctx, cx + 16, cy, cx + fw, cy, COL.yellow, 5);
    line(ctx, cx - 16, cy, cx - 16, cy + 11, COL.yellow, 5);
    line(ctx, cx + 16, cy, cx + 16, cy + 11, COL.yellow, 5);
    line(ctx, cx + 16, cy + 11, cx, cy + 17, COL.yellow, 5);
    line(ctx, cx - 16, cy + 11, cx, cy + 17, COL.yellow, 5);
    // 中心点
    rect(ctx, cx - 1.5, cy - 1.5, 3, 3, COL.yellow);

    ctx.restore();

    // 框
    strokeRect(ctx, x, y, w, h, COL.darkGrey, 1);

    /* --- 飞行指引仪 (FD) --- */
    if (d.ap && d.ap.ap && (d.ap.ap.fd1 || d.ap.ap.fd2)) {
      var fma = d.ap.getFMA();
      var fdPitch = (d.ap.lastPitchCmd !== undefined ? d.ap.lastPitchCmd : st.pitchDeg);
      var fdRollDeg = (d.ap.lastBankCmd !== undefined ? d.ap.lastBankCmd : st.rollDeg);
      var useFd = d.ap.ap.engaged || d.ap.ap.fd1 || d.ap.ap.fd2;
      if (useFd) {
        // 俯仰杆
        var pitchErrPx = (fdPitch - st.pitchDeg) * pxPerDeg;
        var fy = U.clamp(cy - pitchErrPx, y + 8, y + h - 8);
        line(ctx, cx - 78, fy, cx - 26, fy, COL.yellow, 4);
        line(ctx, cx + 26, fy, cx + 78, fy, COL.yellow, 4);
        line(ctx, cx - 26, fy, cx - 26, fy + 12, COL.yellow, 4);
        line(ctx, cx + 26, fy, cx + 26, fy + 12, COL.yellow, 4);

        // 滚转杆 (顶端小三角)
        ctx.save();
        ctx.translate(cx, cy);
        var rollCmdRad = (fdRollDeg) * D2R;
        var barR = 88;
        var bx = Math.sin(-rollCmdRad) * barR;
        var by = -Math.cos(rollCmdRad) * barR;
        ctx.beginPath();
        ctx.arc(0, 0, barR, -Math.PI / 2 - 0.28, -Math.PI / 2 + 0.28);
        ctx.strokeStyle = COL.yellow;
        ctx.lineWidth = 4;
        ctx.stroke();
        // 指令指针
        ctx.save();
        ctx.rotate(rollCmdRad);
        poly(ctx, [[0, -barR + 8], [-9, -barR + 22], [9, -barR + 22]], COL.yellow, true);
        ctx.restore();
        ctx.restore();
      }
    }

    /* --- 侧滑指示 (转弯协调仪) --- */
    var beta = U.clamp(st.betaDeg / 10, -1, 1);
    var slipY = cy + 140;
    rect(ctx, cx - 42, slipY, 84, 10, 'rgba(0,0,0,0.45)');
    rect(ctx, cx - 8 + beta * 34, slipY, 16, 10, COL.yellow);
    strokeRect(ctx, cx - 42, slipY, 84, 10, COL.white, 1.5);

    /* --- ILS 偏差刻度 --- */
    if (d.ils && d.ils.valid) {
      this._drawILS(ctx, d, x, y, w, h, cx, cy);
    }

    /* --- 无线电高度 --- */
    if (st.aglFt < 2500 && d.ils && d.ils.valid) {
      var raCol = st.aglFt < 50 ? COL.amber : COL.white;
      txt(ctx, padNum(st.aglFt, 3), cx, y + h - 22, 26, raCol);
    }

    /* --- 失速/超速告警 --- */
    if (st.stallWarning) {
      txt(ctx, 'STALL', cx, y + 26, 24, COL.red);
      txt(ctx, 'STALL', cx, y + 52, 24, COL.red);
    }
    if (st.overspeed) {
      txt(ctx, 'OVERSPEED', cx, y + 26, 22, COL.red);
    }
  };

  PFD.prototype._drawILS = function (ctx, d, x, y, w, h, cx, cy) {
    var ils = d.ils;
    var loc = U.clamp(ils.localizerDdm, -1.6, 1.6);
    var gs = U.clamp(ils.glideslopeDdm, -1.6, 1.6);

    // 航向道刻度 (中心下方)
    var ly = cy + 96;
    ctx.save();
    ctx.beginPath(); ctx.rect(cx - 60, ly - 12, 120, 24);
    ctx.strokeStyle = COL.white; ctx.lineWidth = 1.5; ctx.stroke();
    var marks = [0, 0.5, 1.0];
    for (var i = 0; i < marks.length; i++) {
      var off = marks[i] * 46;
      if (i === 0) {
        line(ctx, cx, ly - 11, cx, ly + 11, COL.white, 1.5);
      } else {
        line(ctx, cx - off, ly - 7, cx - off, ly + 7, COL.white, 1.5);
        line(ctx, cx + off, ly - 7, cx + off, ly + 7, COL.white, 1.5);
      }
    }
    // 菱形指针
    var lx = cx + loc * 46;
    poly(ctx, [[lx, ly - 9], [lx + 9, ly], [lx, ly + 9], [lx - 9, ly]], COL.magenta, true);
    ctx.restore();

    // 下滑道刻度 (中心右侧)
    var gx = cx + 106;
    ctx.save();
    ctx.beginPath(); ctx.rect(gx - 11, cy - 62, 22, 124);
    ctx.strokeStyle = COL.white; ctx.lineWidth = 1.5; ctx.stroke();
    for (var j = 0; j < marks.length; j++) {
      var off2 = marks[j] * 48;
      if (j === 0) line(ctx, gx - 10, cy, gx + 10, cy, COL.white, 1.5);
      else {
        line(ctx, gx - 7, cy - off2, gx + 7, cy - off2, COL.white, 1.5);
        line(ctx, gx - 7, cy + off2, gx + 7, cy + off2, COL.white, 1.5);
      }
    }
    var gy = cy - gs * 48;
    poly(ctx, [[gx, gy - 8], [gx + 8, gy], [gx, gy + 8], [gx - 8, gy]], COL.magenta, true);
    ctx.restore();

    // DME / 频率
    txt(ctx, ils.freq.toFixed(2), cx - 106, cy + 74, 15, COL.cyan, 'center');
    txt(ctx, ils.ident, cx - 106, cy + 92, 15, COL.cyan, 'center');
    if (ils.dme !== undefined && ils.dme !== null) {
      txt(ctx, ils.dme.toFixed(1) + 'NM', cx + 106, cy + 74, 15, COL.cyan, 'center');
    }
  };

  /* ---------------- 高度带 ---------------- */
  PFD.prototype._drawAltitudeTape = function (ctx, d) {
    var st = d.st;
    var x = 356, y = 60, w = 72, h = 336;
    var cx = x;                       // 窗口在左边缘
    var cy = y + h / 2;
    var pxPerFt = h / 1250;

    var alt = st.altFt;

    rect(ctx, x, y, w, h, COL.tapeBg);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    ctx.font = fnt(16);
    var step = alt > 20000 ? 200 : 100;
    var lo = Math.floor((alt - 650) / step) * step;
    var hi = alt + 650;
    for (var v = lo; v <= hi; v += step) {
      var yy = cy - (v - alt) * pxPerFt;
      if (yy < y - 20 || yy > y + h + 20) continue;
      line(ctx, cx, yy, cx + 14, yy, COL.tapeLine, 1.5);
      txt(ctx, altLabel(v), cx + 18, yy, 16, COL.white, 'left');
    }
    ctx.restore();

    strokeRect(ctx, x, y, w, h, COL.tapeLine, 1.5);

    // 当前高度窗口
    var winH = 30;
    rect(ctx, x - 6, cy - winH / 2, w + 10, winH, COL.bg);
    strokeRect(ctx, x - 6, cy - winH / 2, w + 10, winH, COL.tapeLine, 2);
    txt(ctx, String(Math.round(alt / 10) * 10), x + w - 4, cy, 24, COL.white, 'right');

    // 选择高度 (洋红)
    if (d.ap && d.ap.ap && d.ap.ap.targetAltFt !== null) {
      var selAlt = d.ap.ap.targetAltFt;
      var selY = cy - (selAlt - alt) * pxPerFt;
      selY = U.clamp(selY, y + 10, y + h - 10);
      txt(ctx, altLabel(selAlt), x + w - 4, selY, 19, COL.magenta, 'right');
      poly(ctx, [[x + w - 30, selY], [x + w - 40, selY - 6], [x + w - 40, selY + 6]], COL.magenta, true);
    }

    // 气压基准
    var baroY = y + h + 15;
    if (this.baroStd) {
      txt(ctx, 'STD', x + w / 2, baroY, 18, COL.cyan);
    } else {
      var bg = this.baroSetting >= 1000 ? this.baroSetting.toFixed(0) : (this.baroSetting / 33.8639).toFixed(2);
      txt(ctx, bg, x + w / 2, baroY, 18, COL.cyan);
    }
  };

  /* ---------------- 升降速度表 ---------------- */
  PFD.prototype._drawVSI = function (ctx, d) {
    var st = d.st;
    var x = 434, y = 70, w = 34, h = 316;
    var cx = x + w / 2;
    var cy = y + h / 2;

    var vs = U.clamp(st.vsFpm, -6000, 6000);
    var pxPerFpm = h / 2 / 2400;          // ±2400 fpm 满量程

    // 背景
    rect(ctx, x, y, w, h, COL.bg);

    // 刻度
    var ticks = [0, 500, 1000, 1500, 2000];
    for (var sgn = -1; sgn <= 1; sgn += 2) {
      for (var i = 0; i < ticks.length; i++) {
        var v = ticks[i] * sgn;
        if (i === 0 && sgn > 0) continue;
        var yy = cy - v * pxPerFpm;
        var len = (i === 0) ? 20 : (i % 2 === 0 ? 16 : 10);
        line(ctx, cx - len / 2, yy, cx + len / 2, yy, COL.tapeLine, 1.5);
      }
    }
    line(ctx, cx, y, cx, y + h, COL.tapeLine, 1);

    // 指针
    var py = cy - vs * pxPerFpm;
    py = U.clamp(py, y + 2, y + h - 2);
    poly(ctx, [[cx, py], [cx - 13, py - 7], [cx - 13, py + 7]], COL.white, true);
    // 指针线
    line(ctx, cx - 6, cy, cx - 6, py, COL.white, 2);

    // 数字
    txt(ctx, '1', x - 8, cy - 1000 * pxPerFpm, 13, COL.grey, 'right');
    txt(ctx, '2', x - 8, cy - 2000 * pxPerFpm, 13, COL.grey, 'right');
    txt(ctx, '1', x - 8, cy + 1000 * pxPerFpm, 13, COL.grey, 'right');
    txt(ctx, '2', x - 8, cy + 2000 * pxPerFpm, 13, COL.grey, 'right');

    // 数字读数
    if (Math.abs(st.vsFpm) > 200) {
      txt(ctx, (st.vsFpm > 0 ? '+' : '-') + Math.abs(Math.round(st.vsFpm / 100)) * 100,
        x + w + 4, y + h + 16, 15, COL.green, 'center');
    }
  };

  /* ---------------- 航向带 ---------------- */
  PFD.prototype._drawHeading = function (ctx, d) {
    var st = d.st;
    var x = 126, y = 358, w = 224, h = 34;
    var cx = x + w / 2;

    rect(ctx, x, y, w, h, COL.tapeBg);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    var pxPerDeg = w / 60;               // ±30°
    var hdg = st.heading;

    ctx.font = fnt(15);
    for (var a = -40; a <= 40; a += 5) {
      var deg = Math.round(hdg / 5) * 5 + a;
      var xx = cx + U.wrap180(deg - hdg) * pxPerDeg;
      if (xx < x - 20 || xx > x + w + 20) continue;
      var major = (U.wrap360(deg) % 10 === 0);
      line(ctx, xx, y + h - 10, xx, y + h, COL.tapeLine, major ? 2 : 1);
      if (major) {
        var lbl = U.wrap360(deg) % 90 === 0
          ? ['N', 'E', 'S', 'W'][Math.round(U.wrap360(deg) / 90) % 4]
          : String(Math.round(U.wrap360(deg) / 10));
        txt(ctx, lbl, xx, y + 10, 15, COL.white, 'center');
      }
    }
    ctx.restore();
    strokeRect(ctx, x, y, w, h, COL.tapeLine, 1.5);

    // 当前航向窗口
    rect(ctx, cx - 26, y - 2, 52, h + 4, COL.bg);
    strokeRect(ctx, cx - 26, y - 2, 52, h + 4, COL.tapeLine, 2);
    txt(ctx, padNum(Math.round(hdg), 3), cx, y + h / 2, 20, COL.white);

    // 选择航向
    if (d.ap && d.ap.ap && d.ap.ap.targetHdg !== null) {
      var selX = cx + U.wrap180(d.ap.ap.targetHdg - hdg) * pxPerDeg;
      selX = U.clamp(selX, x + 4, x + w - 4);
      poly(ctx, [[selX, y - 4], [selX - 7, y - 12], [selX + 7, y - 12]], COL.magenta, true);
      txt(ctx, padNum(Math.round(d.ap.ap.targetHdg), 3), selX, y - 20, 15, COL.magenta);
    }

    // 航迹
    if (d.showTrack) {
      var tk = st.track;
      var tx = cx + U.wrap180(tk - hdg) * pxPerDeg;
      if (tx > x && tx < x + w) poly(ctx, [[tx, y + h + 2], [tx - 6, y + h + 10], [tx + 6, y + h + 10]], COL.green, true);
    }

    // 风
    if (d.wind) {
      this._drawWindArrow(ctx, cx - w / 2 + 24, y + h + 16, d.wind);
    }
  };

  PFD.prototype._drawWindArrow = function (ctx, x, y, wind) {
    var dir = U.wrap360(wind.dir - this._hdgForWind);
    var rad = (dir + 180) * D2R;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = COL.green;
    ctx.fillStyle = COL.green;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.sin(rad) * 13, -Math.cos(rad) * 13);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    txt(ctx, String(Math.round(wind.speed)) + '/' + String(Math.round(wind.dir)),
      x + 34, y, 14, COL.green, 'left');
  };

  /* ---------------- 底部信息 ---------------- */
  PFD.prototype._drawBottomInfo = function (ctx, d) {
    var st = d.st;
    // 真空速 / 地速
    txt(ctx, 'TAS ' + Math.round(st.tasKt) + 'KT', 46, 440, 15, COL.green, 'left');
    txt(ctx, 'GS ' + Math.round(st.gsKt) + 'KT', 46, 460, 15, COL.green, 'left');

    // 风向风速
    if (d.wind) {
      this._hdgForWind = st.heading;
      this._drawWindArrow(ctx, 356, 440, d.wind);
    }

    // 静温
    txt(ctx, 'TAT ' + (st.ambientT + 0.4 * st.mach * st.mach * 60).toFixed(0) + '°C',
      46, 476, 14, COL.green, 'left');
  };

  /* =====================================================================
     二、ND 导航显示
     ===================================================================== */
  function ND(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = opts || {};
    this.W = canvas.width; this.H = canvas.height;
    this.S = this.W / 480;
    this.mode = 'ROSE';         // ROSE | ARC | PLAN
    this.rangeNm = 40;
    this.terrainOn = false;
    this.weatherOn = true;
    this.trafficOn = true;
    this._terrainCache = null;
    this._terrainCacheKey = '';
  }

  ND.prototype.setSize = function (w, h) {
    this.canvas.width = w; this.canvas.height = h;
    this.W = w; this.H = h; this.S = w / 480;
  };

  ND.prototype.setRange = function (nm) { this.rangeNm = nm; this._terrainCacheKey = ''; };
  ND.prototype.cycleRange = function (up) {
    var ranges = [5, 10, 20, 40, 80, 160, 320];
    var i = ranges.indexOf(this.rangeNm);
    if (i < 0) i = 3;
    i = U.clamp(i + (up ? 1 : -1), 0, ranges.length - 1);
    this.setRange(ranges[i]);
    return ranges[i];
  };

  ND.prototype.render = function (d) {
    var ctx = this.ctx, S = this.S, st = d.st;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    rect(ctx, 0, 0, this.W, this.H, COL.bg);
    ctx.scale(S, S);

    this.cx = 240; this.cy = 240;
    this.radius = 208;
    this.pxPerNm = this.radius / this.rangeNm;

    if (this.terrainOn && d.terrainFn) this._buildTerrain(d);

    if (this.mode === 'ARC') this._drawArcMode(ctx, d);
    else this._drawRoseMode(ctx, d);

    this._drawRoute(ctx, d);
    this._drawTraffic(ctx, d);
    this._drawAircraft(ctx, d);
    this._drawTopInfo(ctx, d);
    this._drawBottomInfo(ctx, d);

    ctx.restore();
  };

  /* 世界坐标 -> ND 屏幕坐标 */
  ND.prototype._proj = function (dx, dz, hdg) {
    // 机体坐标: 前 = -Z, 右 = +X
    var s = Math.sin(-hdg * D2R), c = Math.cos(-hdg * D2R);
    var rx = dx * c - dz * s;
    var rz = dx * s + dz * c;
    return {
      x: this.cx + rx * this.pxPerNm / C.NM,
      y: this.cy + rz * this.pxPerNm / C.NM
    };
  };

  ND.prototype._drawRoseMode = function (ctx, d) {
    var cx = this.cx, cy = this.cy, R = this.radius;
    var hdg = d.st.heading;

    // 罗盘刻度
    ctx.save();
    for (var a = 0; a < 360; a += 5) {
      var rel = U.wrap180(a - hdg);
      var ang = (rel) * D2R - Math.PI / 2;
      var major = (a % 30 === 0);
      var r1 = R, r2 = R - (major ? 15 : 8);
      var x1 = cx + Math.cos(ang) * r1, y1 = cy + Math.sin(ang) * r1;
      var x2 = cx + Math.cos(ang) * r2, y2 = cy + Math.sin(ang) * r2;
      line(ctx, x1, y1, x2, y2, COL.white, major ? 2 : 1);
      if (major) {
        var lbl, col = COL.white;
        if (a % 90 === 0) { lbl = ['N', 'E', 'S', 'W'][a / 90]; col = COL.white; }
        else lbl = String(a / 10);
        txt(ctx, lbl, cx + Math.cos(ang) * (R - 28), cy + Math.sin(ang) * (R - 28), 16, col);
      }
    }
    ctx.restore();

    // 航向线
    line(ctx, cx, cy, cx, cy - R + 22, COL.white, 2);

    // 距离环
    var rings = this._ringList();
    for (var i = 0; i < rings.length; i++) {
      var rr = rings[i] * this.pxPerNm;
      if (rr > R - 18) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(140,150,160,0.55)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      txt(ctx, String(rings[i]), cx + 4, cy - rr + 9, 12, COL.grey, 'left');
    }

    // 地形
    if (this.terrainOn) this._drawTerrain(ctx, d);
    // 气象
    if (this.weatherOn) this._drawWeather(ctx, d);
    // ILS 刻度
    this._drawILSND(ctx, d);
  };

  ND.prototype._drawArcMode = function (ctx, d) {
    var cx = this.cx, cy = this.cy, R = this.radius;
    var hdg = d.st.heading;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - R, cy);
    ctx.arc(cx, cy, R, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    for (var a = -90; a <= 90; a += 5) {
      var deg = hdg + a;
      var ang = a * D2R - Math.PI / 2;
      var major = (U.wrap360(deg) % 30 === 0);
      var r1 = R, r2 = R - (major ? 15 : 8);
      line(ctx,
        cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1,
        cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2, COL.white, major ? 2 : 1);
      if (major) {
        var w2 = U.wrap360(deg);
        var lbl = (w2 % 90 === 0) ? ['N', 'E', 'S', 'W'][Math.round(w2 / 90) % 4] : String(Math.round(w2 / 10));
        txt(ctx, lbl, cx + Math.cos(ang) * (R - 28), cy + Math.sin(ang) * (R - 28), 16, COL.white);
      }
    }
    ctx.restore();

    // 弧形边界
    ctx.beginPath();
    ctx.arc(cx, cy, R, Math.PI, Math.PI * 2);
    ctx.strokeStyle = COL.white;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - R, cy);
    ctx.lineTo(cx, cy);
    line(ctx, cx, cy, cx + R, cy, COL.white, 2.5);

    var rings = this._ringList();
    for (var i = 0; i < rings.length; i++) {
      var rr = rings[i] * this.pxPerNm;
      if (rr > R - 18) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, Math.PI, Math.PI * 2);
      ctx.strokeStyle = 'rgba(140,150,160,0.5)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      txt(ctx, String(rings[i]), cx - 4, cy - rr + 10, 12, COL.grey, 'right');
    }

    if (this.terrainOn) this._drawTerrain(ctx, d);
    if (this.weatherOn) this._drawWeather(ctx, d);
    this._drawILSND(ctx, d);
  };

  ND.prototype._ringList = function () {
    var r = this.rangeNm;
    var out = [];
    var step = r / 4;
    for (var i = 1; i <= 4; i++) out.push(Math.round(step * i * 10) / 10);
    return out;
  };

  /* ---------------- 地形着色 ---------------- */
  ND.prototype._buildTerrain = function (d) {
    var st = d.st;
    var hdg = st.heading;
    var key = Math.round(st.pos.x / 800) + ',' + Math.round(st.pos.z / 800) + ',' +
      Math.round(this.rangeNm) + ',' + Math.round(U.wrap360(hdg) / 3);
    if (key === this._terrainCacheKey) return;
    this._terrainCacheKey = key;

    var N = 34;
    var grid = new Float32Array(N * N);
    var half = this.rangeNm * C.NM;
    var sam = d.terrainFn;
    for (var j = 0; j < N; j++) {
      for (var i = 0; i < N; i++) {
        var lx = (i / (N - 1) * 2 - 1) * half;
        var lz = (j / (N - 1) * 2 - 1) * half;
        // 机体坐标 -> 世界 (dx 东, dz 南)
        var s = Math.sin(hdg * D2R), c = Math.cos(hdg * D2R);
        var wx = lx * c + lz * s;
        var wz = -lx * s + lz * c;
        var h = sam(st.pos.x + wx, st.pos.z + wz);
        grid[j * N + i] = isFinite(h) ? h : 0;
      }
    }
    this._terrainCache = { grid: grid, N: N };
  };

  ND.prototype._drawTerrain = function (ctx, d) {
    if (!this._terrainCache) return;
    var tc = this._terrainCache;
    var N = tc.N, grid = tc.grid;
    var R = this.radius;
    var cellW = (R * 2) / (N - 1);

    ctx.save();
    ctx.beginPath();
    if (this.mode === 'ARC') {
      ctx.moveTo(this.cx - R, this.cy);
      ctx.arc(this.cx, this.cy, R, Math.PI, Math.PI * 2);
      ctx.closePath();
    } else {
      ctx.arc(this.cx, this.cy, R, 0, Math.PI * 2);
    }
    ctx.clip();

    var acAlt = d.st.altFt * C.FT;
    ctx.globalAlpha = 0.82;
    for (var j = 0; j < N - 1; j++) {
      for (var i = 0; i < N - 1; i++) {
        var h = grid[j * N + i];
        var x = this.cx - R + (i * cellW);
        var y = this.cy - R + (j * cellW);
        if (h <= 0) continue;
        var col = terrainColor(h, acAlt);
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x - 0.5, y - 0.5, cellW + 1.2, cellW + 1.2);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  };

  function terrainColor(h, acAlt) {
    // 相对高度差着色 (EGPWS 风格)
    var diff = acAlt - h;
    if (diff < 0) return 'rgba(255,0,0,0.95)';            // 高于飞机 = 红
    if (diff < 300) return 'rgba(255,0,0,0.8)';           // 300m 内
    if (diff < 600) return 'rgba(255,165,0,0.75)';        // 琥珀
    if (diff < 900) return 'rgba(255,255,0,0.5)';         // 黄
    if (h > 2500) return 'rgba(255,255,255,0.22)';
    if (h > 1200) return 'rgba(110,90,60,0.45)';
    if (h > 300) return 'rgba(60,100,50,0.40)';
    if (h > 20) return 'rgba(30,70,40,0.34)';
    return null;
  }

  /* ---------------- 气象回波 ---------------- */
  ND.prototype._drawWeather = function (ctx, d) {
    var wx = d.weather;
    if (!wx || wx.rain < 0.08) return;
    var st = d.st;
    var R = this.radius;
    var N = 20;
    var cellW = R * 2 / N;
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, R, 0, Math.PI * 2);
    ctx.clip();
    var windRad = wx.windDir * D2R;
    for (var j = 0; j < N; j++) {
      for (var i = 0; i < N; i++) {
        var lx = (i / (N - 1) * 2 - 1);
        var lz = (j / (N - 1) * 2 - 1);
        // 世界坐标 (相对飞机)
        var s = Math.sin(st.heading * D2R), c = Math.cos(st.heading * D2R);
        var wxw = lx * R / this.pxPerNm * C.NM * c + lz * R / this.pxPerNm * C.NM * s;
        var wzw = -lx * R / this.pxPerNm * C.NM * s + lz * R / this.pxPerNm * C.NM * c;
        // 气象是用几个高斯团叠加
        var val = 0;
        for (var k = 0; k < 5; k++) {
          var ang = windRad + k * 1.7;
          var cxw = Math.sin(ang) * 24000;
          var czw = -Math.cos(ang) * 24000;
          var dd = Math.hypot(wxw - cxw, wzw - czw);
          val += wx.rain * Math.exp(-Math.pow(dd / 13000, 2)) * (0.7 + 0.3 * Math.sin(k * 3));
        }
        if (val < 0.22) continue;
        var col = val > 0.72 ? 'rgba(255,40,220,0.55)' :
          val > 0.52 ? 'rgba(255,0,0,0.5)' :
            val > 0.36 ? 'rgba(255,180,0,0.45)' : 'rgba(0,220,0,0.35)';
        ctx.fillStyle = col;
        ctx.fillRect(this.cx - R + i * cellW, this.cy - R + j * cellW, cellW, cellW);
      }
    }
    ctx.restore();
    // 气象雷达标尺
    txt(ctx, 'WX', this.cx + this.radius - 30, this.cy - this.radius + 14, 14, COL.green);
  };

  /* ---------------- 航路与航路点 ---------------- */
  ND.prototype._drawRoute = function (ctx, d) {
    var fms = d.fms;
    var st = d.st;
    if (!fms || !fms.route || !fms.route.length) return;
    var hdg = st.heading;

    ctx.save();
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.radius, 0, Math.PI * 2);
    ctx.clip();

    // 航路连线
    ctx.strokeStyle = COL.magenta;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (var i = Math.max(0, fms.activeLeg - 1); i < fms.route.length; i++) {
      var wp = fms.route[i];
      var p = this._proj(wp.x - st.pos.x, wp.z - st.pos.z, hdg);
      if (i === Math.max(0, fms.activeLeg - 1)) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    // 从当前位置接到当前航路点
    if (fms.activeLeg < fms.route.length) {
      var awp = fms.route[fms.activeLeg];
      var ap2 = this._proj(awp.x - st.pos.x, awp.z - st.pos.z, hdg);
      ctx.beginPath();
      ctx.moveTo(this.cx, this.cy);
      ctx.lineTo(ap2.x, ap2.y);
    }
    ctx.stroke();

    // 航路点符号
    for (var j = Math.max(0, fms.activeLeg - 1); j < fms.route.length; j++) {
      var w = fms.route[j];
      var pp = this._proj(w.x - st.pos.x, w.z - st.pos.z, hdg);
      var dist = Math.hypot(pp.x - this.cx, pp.y - this.cy);
      if (dist > this.radius + 10) continue;
      var isActive = (j === fms.activeLeg);
      var col = isActive ? COL.white : COL.magenta;

      if (w.flyOver) {
        ctx.beginPath();
        ctx.arc(pp.x, pp.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
      } else {
        poly(ctx, [[pp.x, pp.y - 7], [pp.x + 7, pp.y], [pp.x, pp.y + 7], [pp.x - 7, pp.y]], col);
      }
      if (isActive) {
        // 活动航路点外框
        ctx.beginPath();
        ctx.arc(pp.x, pp.y, 11, 0, Math.PI * 2);
        ctx.strokeStyle = COL.white; ctx.lineWidth = 1.5; ctx.stroke();
      }
      txt(ctx, w.ident, pp.x, pp.y - 15, 14, isActive ? COL.white : COL.magenta);
      if (w.altFt) {
        txt(ctx, altLabel(w.altFt), pp.x, pp.y + 16, 12, COL.cyan);
      }
    }
    ctx.restore();

    // 直飞连线
    if (fms.directTo) { }
  };

  /* ---------------- TCAS 交通 ---------------- */
  ND.prototype._drawTraffic = function (ctx, d) {
    if (!this.trafficOn || !d.traffic) return;
    var st = d.st;
    for (var i = 0; i < d.traffic.length; i++) {
      var t = d.traffic[i];
      var p = this._proj(t.x - st.pos.x, t.z - st.pos.z, st.heading);
      var dist = Math.hypot(p.x - this.cx, p.y - this.cy);
      if (dist > this.radius) continue;
      var dAlt = t.altFt - st.altFt;
      var col = COL.white;
      var level = t.level || 'other';
      if (level === 'threat') col = COL.red;
      else if (level === 'proximity') col = COL.amber;
      else if (level === 'traffic') col = COL.white;
      else col = 'rgba(160,170,180,0.65)';

      // 菱形/圆形
      ctx.save();
      if (dAlt > 990 || dAlt < -990) {
        // 有高度差的用实心
        poly(ctx, [[p.x, p.y - 7], [p.x + 7, p.y], [p.x, p.y + 7], [p.x - 7, p.y]], col, true);
      } else {
        poly(ctx, [[p.x, p.y - 7], [p.x + 7, p.y], [p.x, p.y + 7], [p.x - 7, p.y]], col, false);
      }
      // 高度标注
      var vsTag = (t.vsFpm > 500 ? '↑' : (t.vsFpm < -500 ? '↓' : ''));
      txt(ctx, (dAlt >= 0 ? '+' : '-') + U.pad(Math.abs(dAlt) / 100, 2) + vsTag,
        p.x, p.y + 17, 12, col);
      ctx.restore();
    }
    txt(ctx, 'TFC', this.cx - this.radius + 30, this.cy - this.radius + 14, 14, COL.green);
  };

  /* ---------------- 本机符号 ---------------- */
  ND.prototype._drawAircraft = function (ctx, d) {
    var cx = this.cx, cy = this.cy;
    // 空客风格: 黑色机身 + 黄色轮廓
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = COL.yellow;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 12);
    ctx.lineTo(cx + 4, cy - 4);
    ctx.lineTo(cx + 14, cy + 2);
    ctx.lineTo(cx + 14, cy + 6);
    ctx.lineTo(cx + 3, cy + 3);
    ctx.lineTo(cx + 3, cy + 11);
    ctx.lineTo(cx + 5, cy + 14);
    ctx.lineTo(cx + 5, cy + 16);
    ctx.lineTo(cx - 5, cy + 16);
    ctx.lineTo(cx - 5, cy + 14);
    ctx.lineTo(cx - 3, cy + 11);
    ctx.lineTo(cx - 3, cy + 3);
    ctx.lineTo(cx - 14, cy + 6);
    ctx.lineTo(cx - 14, cy + 2);
    ctx.lineTo(cx - 4, cy - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  /* ---------------- 顶部信息 ---------------- */
  ND.prototype._drawTopInfo = function (ctx, d) {
    var fms = d.fms;
    var modeStr = this.mode === 'ARC' ? 'ARC' : (this.mode === 'PLAN' ? 'PLAN' : 'ROSE');
    txt(ctx, modeStr, 24, 22, 17, COL.green, 'left');

    // 下一个航路点信息
    if (fms) {
      var wp = fms.getActiveWaypoint();
      if (wp) {
        var dist = fms.distanceToGoNm !== undefined ? fms.distanceToGoNm : 0;
        txt(ctx, wp.ident, 456, 22, 18, COL.white, 'right');
        txt(ctx, dist.toFixed(1) + 'NM', 456, 42, 15, COL.green, 'right');
        var gs = Math.max(60, d.st.gsKt);
        var etaMin = dist / gs * 60;
        if (isFinite(etaMin)) txt(ctx, Math.round(etaMin) + 'MIN', 456, 60, 15, COL.green, 'right');
      }
    }
  };

  /* ---------------- 底部信息 ---------------- */
  ND.prototype._drawBottomInfo = function (ctx, d) {
    var st = d.st;
    var y = 458;

    // 风
    var wind = d.wind;
    if (wind) {
      var wdir = U.wrap360(wind.dir - st.heading);
      ctx.save();
      ctx.translate(40, y - 8);
      ctx.rotate(wdir * D2R);
      ctx.strokeStyle = COL.green; ctx.fillStyle = COL.green; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 10); ctx.lineTo(0, -10);
      ctx.moveTo(0, -10); ctx.lineTo(-5, -3);
      ctx.moveTo(0, -10); ctx.lineTo(5, -3);
      ctx.stroke();
      ctx.restore();
      txt(ctx, String(Math.round(wind.dir)) + '°/' + String(Math.round(wind.speed)),
        66, y - 8, 15, COL.green, 'left');
    }

    // TAS / GS
    txt(ctx, 'TAS', 240, y - 8, 13, COL.green, 'center');
    txt(ctx, Math.round(st.tasKt) + 'KT', 240, y + 8, 15, COL.green, 'center');
    txt(ctx, 'GS', 320, y - 8, 13, COL.green, 'center');
    txt(ctx, Math.round(st.gsKt) + 'KT', 320, y + 8, 15, COL.green, 'center');

    // 距离环
    txt(ctx, String(this.rangeNm), 456, y - 8, 18, COL.white, 'right');
    txt(ctx, 'NM', 456, y + 10, 13, COL.white, 'right');

    // 导航源
    var navSrc = d.navSource || 'GPS';
    txt(ctx, navSrc, 24, y + 8, 14, COL.green, 'left');
  };

  ND.prototype._drawILSND = function (ctx, d) {
    if (!d.ils || !d.ils.valid) return;
    var ils = d.ils;
    var st = d.st;
    // 用洋红线画出跑道延长线
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.radius, 0, Math.PI * 2);
    ctx.clip();

    var fwd = ils.course * D2R;
    var wpx = ils.thresholdX - st.pos.x;
    var wpz = ils.thresholdZ - st.pos.z;
    var p1 = this._proj(wpx, wpz, st.heading);
    var lenNm = 14;
    var ewpX = wpx + Math.sin(fwd) * lenNm * C.NM;
    var ewpZ = wpz - Math.cos(fwd) * lenNm * C.NM;
    var p2 = this._proj(ewpX, ewpZ, st.heading);
    line(ctx, p1.x, p1.y, p2.x, p2.y, COL.magenta, 2);

    // 跑道符号
    var rw = this._proj(wpx, wpz, st.heading);
    ctx.strokeStyle = COL.white;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rw.x, rw.y);
    var perp = fwd + Math.PI / 2;
    ctx.lineTo(rw.x + Math.cos(perp) * 14, rw.y + Math.sin(perp) * 14);
    ctx.stroke();

    txt(ctx, ils.ident + ' ' + ils.freq.toFixed(2), rw.x, rw.y + 16, 14, COL.magenta);
    ctx.restore();
  };

  /* =====================================================================
     三、ECAM 发动机/告警显示 (E/WD)
     ===================================================================== */
  function ECAM(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width; this.H = canvas.height;
    this.S = this.W / 480;
    this.page = 'ENG';
    this.messages = [];
    this._scroll = 0;
  }

  ECAM.prototype.setSize = function (w, h) {
    this.canvas.width = w; this.canvas.height = h;
    this.W = w; this.H = h; this.S = w / 480;
  };

  ECAM.prototype.render = function (d) {
    var ctx = this.ctx, S = this.S, st = d.st;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    rect(ctx, 0, 0, this.W, this.H, COL.bg);
    ctx.scale(S, S);

    var H = this.H / S;
    this._drawEnginePage(ctx, d, H);
    this._drawConfig(ctx, d, H);
    this._drawMessages(ctx, d, H);

    ctx.restore();
  };

  ECAM.prototype._drawEnginePage = function (ctx, d, H) {
    var st = d.st;
    var engs = st.engines || [];
    var n = Math.max(1, engs.length);
    var colW = 190;
    var startX = n === 2 ? 60 : 150;

    // 标题行
    var y0 = 30;
    txt(ctx, 'N1', startX + colW / 2, y0, 13, COL.cyan, 'center', 'normal');
    txt(ctx, 'EGT', startX + colW + colW / 2, y0, 13, COL.cyan, 'center', 'normal');

    for (var i = 0; i < n; i++) {
      var e = engs[i];
      var cx = startX + i * (colW * 2 + 20);
      var cy = 120;
      var R = 74;

      // ---- N1 圆表盘 ----
      this._gaugeDial(ctx, cx, cy, R, e.n1 / 100, COL.green,
        Math.round(e.n1).toString(), 'N1', e.n1 > 101.5);
      // N1 弧线
      ctx.beginPath();
      ctx.arc(cx, cy, R - 5, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * U.clamp01(e.n1 / 100));
      ctx.strokeStyle = e.n1 > 101.5 ? COL.amber : COL.green;
      ctx.lineWidth = 4;
      ctx.stroke();

      // ---- EGT 圆表盘 ----
      var ex = cx + colW;
      var egtFrac = U.clamp01((e.egt - 200) / 800);
      this._gaugeDial(ctx, ex, cy, R, egtFrac, e.egt > 900 ? COL.amber : COL.green,
        Math.round(e.egt).toString(), 'EGT', e.egt > 925);

      // 附加参数
      var extraY = cy + R + 34;
      txtM(ctx, 'N2 ' + Math.round(e.n2) + '%', cx, extraY, 14, COL.green, 'center', 'normal');
      txtM(ctx, 'FF ' + (e.fuelFlow / 1000).toFixed(2) + ' T/H', cx, extraY + 20, 14, COL.green, 'center', 'normal');
      txtM(ctx, 'OIL ' + Math.round(e.oilTemp) + '°C', ex, extraY, 14, COL.green, 'center', 'normal');
      txtM(ctx, 'OIL ' + e.oilPressure.toFixed(0) + ' PSI', ex, extraY + 20, 14, COL.green, 'center', 'normal');

      // 反推指示
      if (e.reverser > 0.05) {
        rect(ctx, cx - 50, cy + R + 46, 100, 18, 'rgba(0,255,60,0.18)');
        strokeRect(ctx, cx - 50, cy + R + 46, 100, 18, COL.green, 1.5);
        txt(ctx, 'REV ' + Math.round(e.reverser * 100) + '%', cx, cy + R + 55, 13, COL.green);
      }
      // 火警
      if (e.fire) {
        rect(ctx, cx - 60, cy - R - 30, 120, 20, COL.red);
        txt(ctx, 'ENG FIRE', cx, cy - R - 20, 15, '#000', 'center');
      }
      // 发动机关闭
      if (e.state === 'off') {
        txt(ctx, 'OFF', cx, cy - R - 18, 14, COL.grey);
      }
    }

    // 燃油总览
    var fy = H - 118;
    rect(ctx, 20, fy - 20, 440, 66, 'rgba(255,255,255,0.04)');
    strokeRect(ctx, 20, fy - 20, 440, 66, COL.darkGrey, 1);
    txt(ctx, 'FOB', 36, fy - 4, 13, COL.cyan, 'left', 'normal');
    txtM(ctx, (st.fuelKg / 1000).toFixed(2) + ' T', 36, fy + 16, 20, st.fuelKg < st.fuelCapacity * 0.08 ? COL.amber : COL.green, 'left');
    txt(ctx, 'F.USED', 180, fy - 4, 13, COL.cyan, 'left', 'normal');
    txtM(ctx, (st.fuelUsed / 1000).toFixed(2) + ' T', 180, fy + 16, 20, COL.green, 'left');
    txt(ctx, 'GW', 320, fy - 4, 13, COL.cyan, 'left', 'normal');
    txtM(ctx, (st.gw / 1000).toFixed(1) + ' T', 320, fy + 16, 20, COL.green, 'left');
    txt(ctx, 'F.FLOW', 400, fy - 4, 13, COL.cyan, 'left', 'normal');
    txtM(ctx, (st.fuelFlowTotal / 1000).toFixed(2), 400, fy + 16, 20, COL.green, 'left');
  };

  ECAM.prototype._gaugeDial = function (ctx, cx, cy, R, frac, color, valueText, label, warn) {
    // 表盘底
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    ctx.fill();
    ctx.strokeStyle = COL.darkGrey;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 刻度
    ctx.save();
    for (var a = 0; a <= 100; a += 5) {
      var ang = Math.PI * 0.75 + Math.PI * 1.5 * (a / 100);
      var major = (a % 25 === 0);
      var r1 = R - 2, r2 = R - (major ? 14 : 8);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
      ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2);
      ctx.strokeStyle = major ? COL.white : COL.grey;
      ctx.lineWidth = major ? 2 : 1;
      ctx.stroke();
    }
    ctx.restore();

    // 数值
    var col = warn ? COL.amber : COL.white;
    ctx.font = fntM(34, 'bold');
    ctx.fillStyle = col;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(valueText, cx, cy + 4);

    // 标签
    txt(ctx, label, cx, cy - R - 12, 14, COL.cyan, 'center', 'normal');

    // 指针
    var ang2 = Math.PI * 0.75 + Math.PI * 1.5 * U.clamp01(frac);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang2) * (R - 16), cy + Math.sin(ang2) * (R - 16));
    ctx.lineTo(cx + Math.cos(ang2) * (R - 2), cy + Math.sin(ang2) * (R - 2));
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.stroke();
  };

  ECAM.prototype._drawConfig = function (ctx, d, H) {
    var st = d.st;
    var y = H - 44;
    // 襟翼/缝翼
    txt(ctx, 'FLAPS', 36, y, 13, COL.cyan, 'left', 'normal');
    txt(ctx, (st.flapName || '0'), 36, y + 18, 18, COL.green, 'left');

    // 起落架
    txt(ctx, 'GEAR', 150, y, 13, COL.cyan, 'left', 'normal');
    var gearCol = st.gearPos > 0.99 ? COL.green : (st.gearPos < 0.01 ? COL.white : COL.amber);
    var gearStr = st.gearPos > 0.99 ? 'DOWN' : (st.gearPos < 0.01 ? 'UP' : 'TRANSIT');
    txt(ctx, gearStr, 150, y + 18, 18, gearCol, 'left');

    // 扰流板
    txt(ctx, 'SPLR', 260, y, 13, COL.cyan, 'left', 'normal');
    txt(ctx, Math.round(st.spoilerPos * 100) + '%', 260, y + 18, 18,
      st.spoilerPos > 0.02 ? COL.green : COL.white, 'left');

    // 自动刹车
    txt(ctx, 'A/BRK', 350, y, 13, COL.cyan, 'left', 'normal');
    txt(ctx, st.autoBrake || 'OFF', 350, y + 18, 18,
      st.autoBrake && st.autoBrake !== 'OFF' ? COL.green : COL.white, 'left');

    // 襟翼/缝翼条
    var barW = 100;
    rect(ctx, 36, y - 22, barW, 6, 'rgba(255,255,255,0.12)');
    rect(ctx, 36, y - 22, barW * st.flapPos, 6, COL.green);
    // 起落架条
    rect(ctx, 150, y - 22, barW, 6, 'rgba(255,255,255,0.12)');
    rect(ctx, 150, y - 22, barW * st.gearPos, 6, gearCol);
  };

  ECAM.prototype._drawMessages = function (ctx, d, H) {
    var st = d.st;
    var list = [];

    // 告警优先级: 红色 > 琥珀 > 绿色备忘
    if (st.stallWarning) list.push({ t: 'STALL', c: COL.red, level: 3 });
    if (st.overspeed) list.push({ t: 'OVERSPEED', c: COL.red, level: 3 });
    if (st.machOverspeed) list.push({ t: 'MACH OVERSPEED', c: COL.red, level: 3 });
    var engs = st.engines || [];
    for (var i = 0; i < engs.length; i++) {
      if (engs[i].fire) list.push({ t: 'ENG ' + (i + 1) + ' FIRE', c: COL.red, level: 3 });
      if (engs[i].egt > 900) list.push({ t: 'ENG ' + (i + 1) + ' EGT', c: COL.amber, level: 2 });
      if (engs[i].oilPressure < 12 && engs[i].state !== 'off') list.push({ t: 'ENG ' + (i + 1) + ' OIL LO PR', c: COL.amber, level: 2 });
    }
    if (st.fuelKg < st.fuelCapacity * 0.08 && st.fuelKg > 0) list.push({ t: 'FUEL LOW', c: COL.amber, level: 2 });
    if (st.fuelKg <= 0) list.push({ t: 'FUEL EXHAUSTED', c: COL.red, level: 3 });
    if (st.aglFt < 750 && !st.onGround && Math.abs(st.vsFpm) > 1400) list.push({ t: 'SINK RATE', c: COL.amber, level: 2 });
    if (st.configWarning) list.push({ t: 'TO CONFIG', c: COL.amber, level: 2 });
    if (st.groundSpoilers && st.onGround) list.push({ t: 'GND SPLRS', c: COL.green, level: 1 });
    if (st.antiSkid) list.push({ t: 'ANTI SKID', c: COL.green, level: 1 });
    if (st.parkingBrake) list.push({ t: 'PARK BRK', c: COL.green, level: 1 });
    if (st.wow && st.tas < 3) list.push({ t: 'WOW', c: COL.green, level: 1 });

    var y0 = H - 190;
    for (var k = 0; k < Math.min(list.length, 5); k++) {
      var m = list[k];
      var yy = y0 + k * 26;
      if (m.level >= 2) {
        rect(ctx, 20, yy - 12, 440, 24, m.level === 3 ? 'rgba(255,20,20,0.18)' : 'rgba(255,180,0,0.14)');
      }
      txt(ctx, m.t, 32, yy, m.level === 3 ? 18 : 16, m.c, 'left', m.level >= 2 ? 'bold' : 'normal');
    }

    // 正常备忘信息
    if (list.length === 0) {
      txt(ctx, 'NORMAL', 240, H - 168, 16, COL.green);
    }

    // 状态行
    var statusY = H - 8;
    txt(ctx, st.onGround ? 'ON GROUND' : 'AIRBORNE', 36, statusY, 13, COL.green, 'left', 'normal');
    txt(ctx, 'APU ' + (st.apuRunning ? 'AVAIL' : 'OFF'), 200, statusY, 13,
      st.apuRunning ? COL.green : COL.grey, 'left', 'normal');
    txt(ctx, 'SAT ' + st.ambientT.toFixed(0) + '°C', 340, statusY, 13, COL.green, 'left', 'normal');
  };

  /* =====================================================================
     四、HUD 平视显示器
     ===================================================================== */
  function HUD(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width; this.H = canvas.height;
    this.visible = true;
  }

  HUD.prototype.setSize = function (w, h) {
    this.canvas.width = w; this.canvas.height = h;
    this.W = w; this.H = h;
  };

  HUD.prototype.render = function (d) {
    var ctx = this.ctx, st = d.st;
    var W = this.W, H = this.H;
    var cx = W / 2, cy = H * 0.52;
    var pxPerDeg = H / 26;
    var col = 'rgba(0,255,60,0.92)';

    ctx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-st.roll);
    ctx.translate(0, st.pitchDeg * pxPerDeg);

    // 俯仰梯
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    for (var p = -20; p <= 20; p += 2.5) {
      if (Math.abs(p) < 0.1) continue;
      var major = Math.abs(p % 10) < 0.01;
      var mid = Math.abs(p % 5) < 0.01;
      if (!major && !mid) continue;
      var y = -p * pxPerDeg;
      var hw = (major ? 130 : 80) * (W / 1400);
      ctx.beginPath();
      ctx.moveTo(-hw, y); ctx.lineTo(hw, y);
      ctx.stroke();
      if (major) {
        ctx.font = fnt(this.H * 0.032);
        ctx.fillStyle = col;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(Math.round(p)), -hw - 22, y);
        ctx.fillText(String(Math.round(p)), hw + 22, y);
      }
    }
    ctx.restore();

    // 地平线
    ctx.save();
    ctx.translate(cx, cy + st.pitchDeg * pxPerDeg);
    ctx.rotate(-st.roll);
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-W * 0.30, 0);
    ctx.lineTo(-W * 0.075, 0);
    ctx.moveTo(W * 0.075, 0);
    ctx.lineTo(W * 0.30, 0);
    ctx.stroke();
    ctx.restore();

    // 飞机符号
    ctx.strokeStyle = col; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - W * 0.055, cy); ctx.lineTo(cx - W * 0.016, cy);
    ctx.moveTo(cx + W * 0.016, cy); ctx.lineTo(cx + W * 0.055, cy);
    ctx.moveTo(cx - W * 0.016, cy); ctx.lineTo(cx - W * 0.016, cy + H * 0.022);
    ctx.moveTo(cx + W * 0.016, cy); ctx.lineTo(cx + W * 0.016, cy + H * 0.022);
    ctx.stroke();

    // FPV 飞行航迹矢量
    var fpvX = cx + Math.tan(U.clamp(st.beta, -0.4, 0.4)) * W * 0.5 + (st.drift / 30) * W * 0.12;
    var fpvY = cy + (st.pitchDeg - st.flightPathAngle) * pxPerDeg;
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(fpvX, fpvY, 9, 0, Math.PI * 2);
    ctx.moveTo(fpvX - 20, fpvY); ctx.lineTo(fpvX - 9, fpvY);
    ctx.moveTo(fpvX + 9, fpvY); ctx.lineTo(fpvX + 20, fpvY);
    ctx.moveTo(fpvX, fpvY - 9); ctx.lineTo(fpvX, fpvY - 19);
    ctx.stroke();
    ctx.restore();

    // 速度 (左侧)
    txtM(ctx, String(Math.round(st.iasKt)), W * 0.13, cy, H * 0.055, col, 'right');
    txt(ctx, 'IAS KT', W * 0.13, cy + H * 0.042, H * 0.022, col, 'right', 'normal');
    txtM(ctx, st.mach.toFixed(3), W * 0.13, cy + H * 0.085, H * 0.032, col, 'right');

    // 高度 (右侧)
    txtM(ctx, String(Math.round(st.altFt)), W * 0.87, cy, H * 0.055, col, 'left');
    txt(ctx, 'ALT FT', W * 0.87, cy + H * 0.042, H * 0.022, col, 'left', 'normal');
    txtM(ctx, (st.vsFpm >= 0 ? '+' : '-') + Math.abs(Math.round(st.vsFpm / 10) * 10),
      W * 0.87, cy + H * 0.085, H * 0.032, col, 'left');

    // 航向带
    var hdgY = H * 0.955;
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W * 0.25, hdgY); ctx.lineTo(W * 0.75, hdgY);
    ctx.stroke();
    for (var a = -40; a <= 40; a += 10) {
      var xx = cx + (a / 40) * W * 0.25;
      ctx.beginPath();
      ctx.moveTo(xx, hdgY); ctx.lineTo(xx, hdgY - 8);
      ctx.stroke();
    }
    txtM(ctx, padNum(Math.round(st.heading), 3), cx, hdgY - 22, H * 0.032, col);
    // 航向指针
    ctx.beginPath();
    ctx.moveTo(cx, hdgY + 2);
    ctx.lineTo(cx - 8, hdgY + 14);
    ctx.lineTo(cx + 8, hdgY + 14);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();

    // 速度/高度限制
    if (d.speedBug !== undefined) {
      txtM(ctx, String(Math.round(d.speedBug)), W * 0.13, cy - H * 0.09, H * 0.030, col, 'right');
    }
    if (d.altBug !== undefined) {
      txtM(ctx, String(Math.round(d.altBug)), W * 0.87, cy - H * 0.09, H * 0.030, col, 'left');
    }

    // 着陆指引 (ILS)
    if (d.ils && d.ils.valid) {
      var locX = cx + U.clamp(d.ils.localizerDdm, -2, 2) * W * 0.10;
      var gsY = cy + U.clamp(-d.ils.glideslopeDdm, -2, 2) * H * 0.10;
      ctx.save();
      ctx.strokeStyle = col; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(locX, gsY, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(locX - 22, gsY); ctx.lineTo(locX - 13, gsY);
      ctx.moveTo(locX + 13, gsY); ctx.lineTo(locX + 22, gsY);
      ctx.moveTo(locX, gsY - 22); ctx.lineTo(locX, gsY - 13);
      ctx.moveTo(locX, gsY + 13); ctx.lineTo(locX, gsY + 22);
      ctx.stroke();
      ctx.restore();
    }

    // 迎角
    txt(ctx, 'AOA ' + st.alphaDeg.toFixed(1) + '°', W * 0.06, H * 0.93, H * 0.024, col, 'left', 'normal');
    txt(ctx, 'G ' + st.gLoad.toFixed(2), W * 0.06, H * 0.965, H * 0.024, col, 'left', 'normal');
    if (st.stallWarning) {
      txt(ctx, 'STALL', cx, H * 0.14, H * 0.05, 'rgba(255,40,40,0.95)');
    }
  };

  /* =====================================================================
     导出
     ===================================================================== */
  FS.Displays = {
    PFD: PFD,
    ND: ND,
    ECAM: ECAM,
    HUD: HUD,
    COL: COL,
    createPFD: function (cv, o) { return new PFD(cv, o); },
    createND: function (cv, o) { return new ND(cv, o); },
    createECAM: function (cv, o) { return new ECAM(cv, o); },
    createHUD: function (cv, o) { return new HUD(cv, o); }
  };

  FS.Log.info('avionics.js 已加载 — PFD/ND/ECAM/HUD 显示模块就绪');

})(typeof window !== 'undefined' ? window : globalThis);
