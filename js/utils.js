/* ==========================================================================
   天际航线 SkyRoute — 基础工具库 (utils.js)
   数学 / 大气模型 / 单位换算 / 地理投影 / 噪声 / 事件总线
   全局命名空间: window.FS
   ========================================================================== */
(function (global) {
  'use strict';

  var FS = global.FS = global.FS || {};

  /* ---------------------------------------------------------------------
     1. 常量
     --------------------------------------------------------------------- */
  var CONST = FS.CONST = {
    G0: 9.80665,            // 标准重力加速度 m/s^2
    R_AIR: 287.05287,       // 干空气气体常数 J/(kg*K)
    GAMMA: 1.4,             // 比热比
    T0: 288.15,             // 海平面标准温度 K
    P0: 101325.0,           // 海平面标准气压 Pa
    RHO0: 1.225,            // 海平面标准密度 kg/m^3
    A0: 340.294,            // 海平面标准音速 m/s
    LAPSE: 0.0065,          // 对流层温度递减率 K/m
    TROPOPAUSE: 11000,      // 对流层顶 m
    STRAT2: 20000,          // 第二层顶 m
    FT: 0.3048,             // 1 ft = 0.3048 m
    NM: 1852.0,             // 1 nm = 1852 m
    KT: 0.514444,           // 1 kt = 0.514444 m/s
    EARTH_R: 6371008.8,     // 平均地球半径 m
    WGS84_A: 6378137.0,
    DEG: Math.PI / 180,
    RAD: 180 / Math.PI,
    // 标准大气高度对应的气压高度换算系数 (用于 QNH 修正)
    HPA_TO_INHG: 0.029529983071445,
    INHG_TO_HPA: 33.8638866667
  };

  /* ---------------------------------------------------------------------
     2. 数学工具
     --------------------------------------------------------------------- */
  var Utils = FS.Utils = {
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    clamp01: function (v) { return v < 0 ? 0 : (v > 1 ? 1 : v); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    /** 反向插值 */
    invLerp: function (a, b, v) { return a === b ? 0 : (v - a) / (b - a); },
    /** 把 v 从 [a,b] 映射到 [c,d] */
    remap: function (v, a, b, c, d) { return c + (d - c) * Utils.clamp01((v - a) / (b - a)); },
    smoothstep: function (t) { t = Utils.clamp01(t); return t * t * (3 - 2 * t); },
    smootherstep: function (t) { t = Utils.clamp01(t); return t * t * t * (t * (t * 6 - 15) + 10); },
    sign: function (v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); },
    /** 以固定最大步长逼近目标值 (用于舵面/作动筒限速) */
    moveTowards: function (cur, target, maxDelta) {
      var d = target - cur;
      if (Math.abs(d) <= maxDelta) return target;
      return cur + Utils.sign(d) * maxDelta;
    },
    /** 指数平滑, tau 为时间常数(秒) */
    damp: function (cur, target, tau, dt) {
      if (tau <= 0) return target;
      var k = 1 - Math.exp(-dt / tau);
      return cur + (target - cur) * k;
    },
    /** 一阶惯性 (用于发动机 N1 转子滞后) */
    lag: function (cur, target, tauUp, tauDn, dt) {
      var tau = (target > cur) ? tauUp : tauDn;
      return Utils.damp(cur, target, tau, dt);
    },
    /** 角度归一化到 [0, 360) */
    wrap360: function (d) { d = d % 360; return d < 0 ? d + 360 : d; },
    /** 角度归一化到 (-180, 180] */
    wrap180: function (d) { d = Utils.wrap360(d); return d > 180 ? d - 360 : d; },
    /** 弧度归一化到 (-PI, PI] */
    wrapPi: function (r) {
      r = r % (Math.PI * 2);
      if (r > Math.PI) r -= Math.PI * 2;
      if (r <= -Math.PI) r += Math.PI * 2;
      return r;
    },
    /** 两个方位角之间的最短差值 (deg) */
    angleDiff: function (a, b) { return Utils.wrap180(b - a); },
    /** 角度插值 (走最短路径) */
    angleLerp: function (a, b, t) { return a + Utils.angleDiff(a, b) * t; },
    deg: function (r) { return r * CONST.RAD; },
    rad: function (d) { return d * CONST.DEG; },
    /** 简易二维/三维向量运算 (避免依赖 THREE) */
    hypot: function (x, y) { return Math.sqrt(x * x + y * y); },
    /** 死区 */
    deadzone: function (v, dz) {
      if (Math.abs(v) <= dz) return 0;
      return Utils.sign(v) * (Math.abs(v) - dz) / (1 - dz);
    },
    /** 数值微分保护 */
    safeDiv: function (a, b, fallback) { return Math.abs(b) < 1e-9 ? (fallback || 0) : a / b; },
    /** 格式化数字 */
    fmt: function (v, digits) {
      if (!isFinite(v)) return '--';
      return v.toFixed(digits === undefined ? 0 : digits);
    },
    /** 数字补零 */
    pad: function (v, len, ch) {
      var s = String(Math.abs(Math.round(v)));
      ch = ch || '0';
      while (s.length < len) s = ch + s;
      return (v < 0 ? '-' : '') + s;
    }
  };

  /* ---------------------------------------------------------------------
     3. 单位换算
     --------------------------------------------------------------------- */
  var Units = FS.Units = {
    ktToMs: function (k) { return k * CONST.KT; },
    msToKt: function (m) { return m / CONST.KT; },
    ftToM: function (f) { return f * CONST.FT; },
    mToFt: function (m) { return m / CONST.FT; },
    nmToM: function (n) { return n * CONST.NM; },
    mToNm: function (m) { return m / CONST.NM; },
    kgToLb: function (k) { return k * 2.2046226218; },
    lbToKg: function (l) { return l * 0.45359237; },
    /** kg 航空燃油 -> 升 (Jet A-1 密度约 0.804 kg/L) */
    kgToLitre: function (k) { return k / 0.804; },
    litreToKg: function (l) { return l * 0.804; },
    /** kg -> 美加仑 */
    kgToGal: function (k) { return k / 0.804 / 3.785411784; },
    /** m/s -> ft/min */
    msToFpm: function (m) { return m * 196.8503937; },
    fpmToMs: function (f) { return f / 196.8503937; }
  };

  /* ---------------------------------------------------------------------
     4. 标准大气模型 (ISA) — 提供真实的高度/温度/密度/音速关系
     --------------------------------------------------------------------- */
  var Atmo = FS.Atmo = {
    /**
     * 输入几何高度(米), 返回该高度的 ISA 大气参数
     * @returns {{T:number,p:number,rho:number,a:number,theta:number,delta:number,sigma:number}}
     */
    isa: function (h) {
      var T, p;
      var T0 = CONST.T0, p0 = CONST.P0, L = CONST.LAPSE, g = CONST.G0, R = CONST.R_AIR;
      if (h < 0) h = 0;
      if (h <= CONST.TROPOPAUSE) {
        T = T0 - L * h;
        p = p0 * Math.pow(T / T0, g / (L * R));
      } else if (h <= CONST.STRAT2) {
        T = T0 - L * CONST.TROPOPAUSE;                 // 216.65 K
        var p11 = p0 * Math.pow(T / T0, g / (L * R));
        p = p11 * Math.exp(-g * (h - CONST.TROPOPAUSE) / (R * T));
      } else {
        // 20km 以上: 温度以 +0.001 K/m 递增 (近似)
        var T11 = T0 - L * CONST.TROPOPAUSE;
        var p11b = p0 * Math.pow(T11 / T0, g / (L * R));
        var p20 = p11b * Math.exp(-g * (CONST.STRAT2 - CONST.TROPOPAUSE) / (R * T11));
        var T20 = T11 + 0.001 * (CONST.STRAT2 - CONST.TROPOPAUSE);
        T = T20 + 0.0028 * (h - CONST.STRAT2);
        p = p20 * Math.pow(T / T20, -g / (0.0028 * R));
      }
      var rho = p / (R * T);
      var a = Math.sqrt(CONST.GAMMA * R * T);
      return {
        T: T, p: p, rho: rho, a: a,
        theta: T / CONST.T0,
        delta: p / CONST.P0,
        sigma: rho / CONST.RHO0
      };
    },

    /** 考虑 ISA 偏差 (deltaISA, 摄氏度) 与 QNH 的密度 */
    density: function (h, dISA) {
      var s = Atmo.isa(h);
      var T = s.T + (dISA || 0);
      return s.p / (CONST.R_AIR * T);
    },

    /**
     * 气压高度换算: 给定气压(Pa) 求压力高度(米, ISA 条件下)
     */
    pressureAltitude: function (p) {
      var p0 = CONST.P0, L = CONST.LAPSE, g = CONST.G0, R = CONST.R_AIR, T0 = CONST.T0;
      var p11 = p0 * Math.pow(216.65 / T0, g / (L * R));
      if (p >= p11) {
        return (T0 / L) * (1 - Math.pow(p / p0, L * R / g));
      }
      return CONST.TROPOPAUSE + (R * 216.65 / g) * Math.log(p11 / p);
    },

    /** 给定高度与 QNH(hPa), 返回该处实际气压 (Pa) */
    pressureAtAltitudeWithQNH: function (h, qnhHpa) {
      var isa = Atmo.isa(h);
      // QNH 修正: 海平面气压差按指数衰减
      var scale = 8434.5; // 标高 m (scale height)
      return (qnhHpa * 100) * Math.exp(-h / scale) * (isa.p / (CONST.P0 * Math.exp(-h / scale)));
    },

    /**
     * 校正空速 (CAS) 计算 —— 可压缩流伯努利
     * @param qc 动压 (Pa)
     */
    casFromQc: function (qc) {
      var p0 = CONST.P0;
      var inner = Math.pow(qc / p0 + 1, 2 / 7) - 1;
      if (inner < 0) inner = 0;
      return CONST.A0 * Math.sqrt(5 * inner);
    },

    /** 由真空速与静压求 CAS (m/s) */
    casFromTas: function (tas, p, rho) {
      var a = Math.sqrt(CONST.GAMMA * p / rho);
      var M = tas / a;
      var qc = p * (Math.pow(1 + 0.2 * M * M, 3.5) - 1);
      return Atmo.casFromQc(qc);
    },

    /** 由 CAS 与静压求真空速 (m/s) */
    tasFromCas: function (cas, p, rho) {
      var p0 = CONST.P0, a0 = CONST.A0;
      var qc = p0 * (Math.pow(1 + (cas * cas) / (5 * a0 * a0), 3.5) - 1);
      var a = Math.sqrt(CONST.GAMMA * p / rho);
      var m2 = 5 * (Math.pow(qc / p + 1, 2 / 7) - 1);
      if (m2 < 0) m2 = 0;
      return a * Math.sqrt(m2);
    },

    /** 马赫数 -> 真空速 */
    tasFromMach: function (M, p, rho) {
      return M * Math.sqrt(CONST.GAMMA * p / rho);
    },

    /** 马赫数 -> CAS (kt) */
    casFromMach: function (M, p, rho) {
      var a = Math.sqrt(CONST.GAMMA * p / rho);
      return Atmo.casFromTas(M * a, p, rho);
    },

    /** 温度偏差 (ISA deviation) -> 密度比 */
    sigmaWithISA: function (h, dISA) {
      return Atmo.density(h, dISA) / CONST.RHO0;
    }
  };

  /* ---------------------------------------------------------------------
     5. 地理投影 (局部平面近似, 以参考点为原点)
        世界坐标约定:  X = 东(+)  Z = 南(+)  Y = 上(+)
     --------------------------------------------------------------------- */
  var Geo = FS.Geo = {
    refLat: 0,
    refLon: 0,
    cosRef: 1,

    setReference: function (lat, lon) {
      Geo.refLat = lat;
      Geo.refLon = lon;
      Geo.cosRef = Math.cos(lat * CONST.DEG);
    },

    /** 经纬度 -> 世界平面坐标 (米) */
    toWorld: function (lat, lon) {
      var R = CONST.EARTH_R;
      var x = (lon - Geo.refLon) * CONST.DEG * R * Geo.cosRef;
      var z = -(lat - Geo.refLat) * CONST.DEG * R;
      return { x: x, z: z };
    },

    toWorldInto: function (lat, lon, out) {
      var R = CONST.EARTH_R;
      out.x = (lon - Geo.refLon) * CONST.DEG * R * Geo.cosRef;
      out.z = -(lat - Geo.refLat) * CONST.DEG * R;
      return out;
    },

    /** 世界平面坐标 -> 经纬度 */
    toLatLon: function (x, z) {
      var R = CONST.EARTH_R;
      return {
        lat: Geo.refLat - (z / R) * CONST.RAD,
        lon: Geo.refLon + (x / (R * Geo.cosRef)) * CONST.RAD
      };
    },

    /** 从 A 到 B 的真方位角 (度) —— 输入世界平面坐标 */
    bearingWorld: function (ax, az, bx, bz) {
      var dx = bx - ax, dz = bz - az;
      return Utils.wrap360(Math.atan2(dx, -dz) * CONST.RAD);
    },

    /** 沿方位角与距离推算新位置 (米) */
    offset: function (x, z, bearingDeg, distM) {
      var b = bearingDeg * CONST.DEG;
      return { x: x + Math.sin(b) * distM, z: z - Math.cos(b) * distM };
    },

    /** 两点平面距离(米) */
    dist: function (ax, az, bx, bz) { return Math.hypot(bx - ax, bz - az); },

    /**
     * 大地坐标直接算大圆距离 (nm)
     */
    greatCircleNm: function (lat1, lon1, lat2, lon2) {
      var d2r = CONST.DEG;
      var p1 = lat1 * d2r, p2 = lat2 * d2r;
      var dp = (lat2 - lat1) * d2r, dl = (lon2 - lon1) * d2r;
      var a = Math.sin(dp / 2) * Math.sin(dp / 2) +
        Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
      return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * CONST.EARTH_R / CONST.NM;
    },

    /** 大圆初始方位角 (度) */
    greatCircleBearing: function (lat1, lon1, lat2, lon2) {
      var d2r = CONST.DEG;
      var p1 = lat1 * d2r, p2 = lat2 * d2r, dl = (lon2 - lon1) * d2r;
      var y = Math.sin(dl) * Math.cos(p2);
      var x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
      return Utils.wrap360(Math.atan2(y, x) * CONST.RAD);
    },

    /** 沿大圆推算目标点 */
    greatCircleOffset: function (lat, lon, bearingDeg, distM) {
      var d2r = CONST.DEG, r2d = CONST.RAD;
      var d = distM / CONST.EARTH_R;
      var brg = bearingDeg * d2r;
      var p1 = lat * d2r, l1 = lon * d2r;
      var sinP2 = Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(brg);
      var p2 = Math.asin(Utils.clamp(sinP2, -1, 1));
      var l2 = l1 + Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(p1),
        Math.cos(d) - Math.sin(p1) * Math.sin(p2));
      return { lat: p2 * r2d, lon: Utils.wrap180(l2 * r2d) };
    },

    /** 磁差近似模型 (世界磁偏角简化版, 精度 ±5°) */
    magneticVariation: function (lat, lon) {
      // 简化 WMM 近似: 以磁极位置推算
      var poleLat = 80.65, poleLon = -72.68;   // 北磁极 (2020)
      var b = Geo.greatCircleBearing(lat, lon, poleLat, poleLon);
      return Utils.wrap180(b - 0);              // 相对真北的近似偏角
    }
  };

  /* ---------------------------------------------------------------------
     6. 伪随机数 & 噪声 (确定性, 全项目共用)
     --------------------------------------------------------------------- */
  var Rng = FS.Rng = {
    mulberry32: function (seed) {
      var a = seed >>> 0;
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    /** 全局随机源 */
    rand: Math.random,
    range: function (a, b) { return a + Math.random() * (b - a); },
    intRange: function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
    pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    /** 高斯分布 */
    gauss: function (mean, sd) {
      var u = 0, v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
  };

  // 便捷别名: 让各模块可以直接使用 U.range / U.pick / U.gauss
  Utils.range = function (a, b) { return Rng.range(a, b); };
  Utils.intRange = function (a, b) { return Rng.intRange(a, b); };
  Utils.pick = function (arr) { return Rng.pick(arr); };
  Utils.gauss = function (m, sd) { return Rng.gauss(m, sd); };

  /**
   * 2D 值噪声 (确定性, 无状态) —— 地形/云/湍流共用同一套
   */
  var Noise = FS.Noise = (function () {
    function hash2(ix, iz, seed) {
      var h = ix * 374761393 + iz * 668265263 + (seed || 0) * 1442695040888963407;
      h = (h ^ (h >>> 13)) * 1274126177;
      h = h ^ (h >>> 16);
      return (h >>> 0) / 4294967296;
    }
    function hash3(ix, iy, iz, seed) {
      var h = ix * 374761393 + iy * 668265263 + iz * 2147483647 + (seed || 0) * 1013904223;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }

    /** 二维值噪声, 返回 [0,1] */
    function value2(x, z, seed) {
      var ix = Math.floor(x), iz = Math.floor(z);
      var fx = x - ix, fz = z - iz;
      var ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
      var a = hash2(ix, iz, seed);
      var b = hash2(ix + 1, iz, seed);
      var c = hash2(ix, iz + 1, seed);
      var d = hash2(ix + 1, iz + 1, seed);
      return (a * (1 - ux) + b * ux) * (1 - uz) + (c * (1 - ux) + d * ux) * uz;
    }

    function value3(x, y, z, seed) {
      var ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
      var fx = x - ix, fy = y - iy, fz = z - iz;
      var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
      var c000 = hash3(ix, iy, iz, seed), c100 = hash3(ix + 1, iy, iz, seed);
      var c010 = hash3(ix, iy + 1, iz, seed), c110 = hash3(ix + 1, iy + 1, iz, seed);
      var c001 = hash3(ix, iy, iz + 1, seed), c101 = hash3(ix + 1, iy, iz + 1, seed);
      var c011 = hash3(ix, iy + 1, iz + 1, seed), c111 = hash3(ix + 1, iy + 1, iz + 1, seed);
      var x00 = c000 * (1 - ux) + c100 * ux;
      var x10 = c010 * (1 - ux) + c110 * ux;
      var x01 = c001 * (1 - ux) + c101 * ux;
      var x11 = c011 * (1 - ux) + c111 * ux;
      var y0 = x00 * (1 - uy) + x10 * uy;
      var y1 = x01 * (1 - uy) + x11 * uy;
      return y0 * (1 - uz) + y1 * uz;
    }

    /** 分形噪声 (fBm), 返回 [-1,1] 附近 */
    function fbm2(x, z, octaves, lacunarity, gain, seed) {
      octaves = octaves || 5;
      lacunarity = lacunarity || 2.0;
      gain = gain || 0.5;
      var amp = 1, freq = 1, sum = 0, norm = 0;
      for (var i = 0; i < octaves; i++) {
        sum += amp * (value2(x * freq, z * freq, (seed || 0) + i * 101) * 2 - 1);
        norm += amp;
        amp *= gain;
        freq *= lacunarity;
      }
      return sum / (norm || 1);
    }

    /** 山脊噪声 (ridged multifractal) —— 生成山脉更真实 */
    function ridged2(x, z, octaves, lacunarity, gain, seed) {
      octaves = octaves || 6;
      lacunarity = lacunarity || 2.05;
      gain = gain || 0.5;
      var amp = 1, freq = 1, sum = 0, norm = 0, prev = 1;
      for (var i = 0; i < octaves; i++) {
        var n = value2(x * freq, z * freq, (seed || 0) + i * 307);
        n = 1 - Math.abs(n * 2 - 1);
        n = n * n;
        sum += amp * n * prev;
        prev = n;
        norm += amp;
        amp *= gain;
        freq *= lacunarity;
      }
      return sum / (norm || 1);
    }

    /** 域扭曲 */
    function warp2(x, z, strength, seed) {
      var wx = fbm2(x + 5.2, z + 1.3, 3, 2, 0.5, (seed || 0) + 7);
      var wz = fbm2(x + 9.7, z + 4.1, 3, 2, 0.5, (seed || 0) + 13);
      return { x: x + wx * strength, z: z + wz * strength };
    }

    return {
      value2: value2, value3: value3, fbm2: fbm2, ridged2: ridged2, warp2: warp2,
      hash2: hash2, hash3: hash3
    };
  })();

  /* ---------------------------------------------------------------------
     7. 事件总线
     --------------------------------------------------------------------- */
  FS.Bus = (function () {
    var map = {};
    return {
      on: function (evt, fn) {
        (map[evt] = map[evt] || []).push(fn);
        return function () { FS.Bus.off(evt, fn); };
      },
      off: function (evt, fn) {
        var a = map[evt]; if (!a) return;
        var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
      },
      emit: function (evt, payload) {
        var a = map[evt];
        if (a) for (var i = 0; i < a.length; i++) {
          try { a[i](payload); } catch (e) { console.error('[Bus] ' + evt, e); }
        }
        var any = map['*'];
        if (any) for (var j = 0; j < any.length; j++) {
          try { any[j](evt, payload); } catch (e2) { }
        }
      },
      clear: function () { map = {}; }
    };
  })();

  /* ---------------------------------------------------------------------
     8. 简易环形缓冲 (用于记录轨迹/趋势)
     --------------------------------------------------------------------- */
  FS.Ring = function (n) {
    this.n = n; this.buf = new Float32Array(n); this.i = 0; this.count = 0;
  };
  FS.Ring.prototype.push = function (v) {
    this.buf[this.i] = v;
    this.i = (this.i + 1) % this.n;
    if (this.count < this.n) this.count++;
  };
  FS.Ring.prototype.get = function (k) {
    // k=0 最新
    var idx = (this.i - 1 - k + this.n * 2) % this.n;
    return this.buf[idx];
  };

  /* ---------------------------------------------------------------------
     9. PID 控制器 (自动驾驶/自动油门使用)
     --------------------------------------------------------------------- */
  FS.PID = function (kp, ki, kd, opts) {
    opts = opts || {};
    this.kp = kp; this.ki = ki; this.kd = kd;
    this.i = 0;
    this.prevErr = 0;
    this.iMin = opts.iMin !== undefined ? opts.iMin : -1;
    this.iMax = opts.iMax !== undefined ? opts.iMax : 1;
    this.outMin = opts.outMin !== undefined ? opts.outMin : -1;
    this.outMax = opts.outMax !== undefined ? opts.outMax : 1;
    this.first = true;
  };
  FS.PID.prototype.reset = function () { this.i = 0; this.prevErr = 0; this.first = true; };
  FS.PID.prototype.update = function (err, dt) {
    if (dt <= 0) return 0;
    dt = Math.min(dt, 0.25);
    this.i = Utils.clamp(this.i + err * dt, this.iMin, this.iMax);
    var d = this.first ? 0 : (err - this.prevErr) / dt;
    this.prevErr = err; this.first = false;
    var out = this.kp * err + this.ki * this.i + this.kd * d;
    return Utils.clamp(out, this.outMin, this.outMax);
  };

  /* ---------------------------------------------------------------------
     10. 日志 (同时输出到页面, 便于自动化测试抓取)
     --------------------------------------------------------------------- */
  /* ---------------------------------------------------------------------
     11. 音频占位接口
     audio.js 加载后会覆盖 FS.Audio; 这里先提供空实现, 保证任何模块
     在音频初始化之前调用 playCue() 等接口都不会报错。
     --------------------------------------------------------------------- */
  if (!FS.Audio) {
    FS.Audio = {
      available: false, ctx: null, master: null,
      init: function () { return false; },
      resume: function () { }, suspend: function () { },
      setMasterVolume: function () { }, getMasterVolume: function () { return 0; },
      setMuted: function () { }, update: function () { },
      setListener: function () { }, loadAircraft: function () { },
      playCue: function () { }, setEnvironment: function () { },
      setCabinAmbience: function () { }, stop: function () { }, dispose: function () { }
    };
  }

  FS.Log = (function () {    var lines = [];
    var el = null;
    function ensure() {
      if (!el && typeof document !== 'undefined') {
        el = document.getElementById('boot-log');
      }
      return el;
    }
    function write(level, args) {
      var msg = Array.prototype.slice.call(args).map(function (a) {
        if (a instanceof Error) return a.message + '\n' + (a.stack || '');
        if (typeof a === 'object') { try { return JSON.stringify(a); } catch (e) { return String(a); } }
        return String(a);
      }).join(' ');
      lines.push('[' + level + '] ' + msg);
      if (lines.length > 500) lines.shift();
      var e = ensure();
      if (e) {
        e.textContent += '[' + level + '] ' + msg + '\n';
        // 出现错误时自动显示日志面板, 便于诊断
        if (level === 'ERROR' && typeof document !== 'undefined' && document.body) {
          document.body.classList.add('show-log');
        }
      }
      if (global.__FS_TEST__ && level === 'ERROR') {
        global.__FS_ERRORS__ = (global.__FS_ERRORS__ || []);
        global.__FS_ERRORS__.push(msg);
      }
    }
    return {
      info: function () { write('INFO', arguments); if (global.console) console.log.apply(console, arguments); },
      warn: function () { write('WARN', arguments); if (global.console) console.warn.apply(console, arguments); },
      error: function () { write('ERROR', arguments); if (global.console) console.error.apply(console, arguments); },
      lines: function () { return lines.slice(); },
      text: function () { return lines.join('\n'); }
    };
  })();

  // 全局错误捕获 —— 保证任何异常都能在页面与自动化测试中可见
  if (typeof global.addEventListener === 'function') {
    global.addEventListener('error', function (ev) {
      FS.Log.error('未捕获异常: ' + (ev.message || ev.error));
    });
    global.addEventListener('unhandledrejection', function (ev) {
      FS.Log.error('未处理的 Promise 拒绝: ' + (ev.reason && ev.reason.message ? ev.reason.message : ev.reason));
    });
  }

  FS.Log.info('utils.js 已加载 — 数学/大气/地理/噪声模块就绪');
})(typeof window !== 'undefined' ? window : globalThis);
