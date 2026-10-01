/* ==========================================================================
   天际航线 SkyRoute — 环境系统 (environment.js)
   天空 / 太阳月亮 / 地形 LOD / 海洋 / 体积云 / 降水 / 城市与机场灯光
   依赖: utils.js (FS.Utils / FS.Noise / FS.Geo / FS.Atmo / FS.CONST), three.js r149
   全局命名空间: window.FS.Environment
   --------------------------------------------------------------------------
   世界坐标约定:  单位 = 米;  +X = 东,  +Z = 南,  +Y = 上;  y = 0 为平均海平面
   地形高度场是 (x,z) 的纯函数 —— 与相机位置/LOD 无关, 保证飞行模型的
   地面碰撞与渲染结果一致。

   --------------------------------------------------------------------------
   集成注意事项 (给主程序):
   1. 光照本模块已全部提供 (太阳/月亮平行光 + 半球光 + 环境光), 请勿在场景中
      再添加额外的 HemisphereLight / AmbientLight —— 双重环境光会把夜间照成
      白昼 (实测 23:00 地面亮度 38 → 166)。
   2. 若 renderer.outputEncoding 仍是 r149 默认的 LinearEncoding, 本模块会自动
      改为 sRGBEncoding (可用 opts.manageColorSpace = false 关闭); 若调用方已
      自行设置则不做改动。天空/海洋/云等自有着色器与内建材质走同一颜色管线
      (tonemapping + encodings chunk), 因此与 renderer.toneMapping 兼容。
   3. opts.shadows 为真时会打开 renderer.shadowMap.enabled (若尚未开启)。
   4. setFocus/update 每帧调用; addFlattenZone 应在放置跑道之前调用。
   ========================================================================== */
(function (global) {
  'use strict';

  var FS = global.FS = global.FS || {};
  var U = FS.Utils;
  var Noise = FS.Noise;
  var Geo = FS.Geo;
  var C = FS.CONST || { FT: 0.3048, DEG: Math.PI / 180, RAD: 180 / Math.PI, EARTH_R: 6371008.8, KT: 0.514444 };

  /* ---------------------------------------------------------------------
     0. three.js 引用
        浏览器中 three.js 是全局变量; node 冒烟测试下 UMD 包走 CommonJS 分支,
        这里补一个全局别名, 不影响浏览器行为。
     --------------------------------------------------------------------- */
  var THREE = global.THREE;
  if (!THREE || !THREE.Scene) {
    if (typeof module !== 'undefined' && typeof require === 'function') {
      try {
        var _three = require('../vendor/three.min.js');
        if (_three && _three.Scene) { THREE = _three; global.THREE = _three; }
      } catch (e) { /* 浏览器/打包环境下忽略 */ }
    }
  }
  if (!THREE || !THREE.Scene) {
    FS.Log.error('environment.js: 未检测到 THREE, 环境系统未加载');
    return;
  }

  var PI = Math.PI;
  var DEG = C.DEG || PI / 180;
  var RAD = C.RAD || 180 / PI;
  var FT = C.FT || 0.3048;

  /* ---------------------------------------------------------------------
     1. 画质预设
     --------------------------------------------------------------------- */
  var QUALITY = {
    low: {
      chunkSizeM: 4000, ringVert0: 33, ringCount: 3, grid: 7,
      shadowMap: 1024, shadowRadius: 1500, shadows: true,
      stars: 800, cloudPuffs: 1100, puffsPerLayer: 420, cloudRangeM: 46000,
      cityLights: 1400, oceanVerts: 25,
      rainMax: 700, snowMax: 700, contrailSegs: 120,
      buildBudgetMs: 2.6, warmBudgetMs: 9.0, cityCurve: 900
    },
    medium: {
      chunkSizeM: 4000, ringVert0: 65, ringCount: 4, grid: 7,
      shadowMap: 2048, shadowRadius: 2400, shadows: true,
      stars: 1800, cloudPuffs: 2600, puffsPerLayer: 950, cloudRangeM: 62000,
      cityLights: 3400, oceanVerts: 49,
      rainMax: 1400, snowMax: 1400, contrailSegs: 200,
      buildBudgetMs: 3.2, warmBudgetMs: 12.0, cityCurve: 1600
    },
    high: {
      chunkSizeM: 4000, ringVert0: 97, ringCount: 4, grid: 7,
      shadowMap: 4096, shadowRadius: 3200, shadows: true,
      stars: 3200, cloudPuffs: 4200, puffsPerLayer: 1500, cloudRangeM: 78000,
      cityLights: 5600, oceanVerts: 65,
      rainMax: 2200, snowMax: 2200, contrailSegs: 260,
      buildBudgetMs: 4.0, warmBudgetMs: 16.0, cityCurve: 2600
    }
  };

  /* ---------------------------------------------------------------------
     2. 天气预设
     --------------------------------------------------------------------- */
  function layer(cover, baseFt, topFt, type) {
    return { cover: cover, baseFt: baseFt, topFt: topFt, type: type };
  }

  var DEFAULT_WEATHER = {
    cloudCover: 0.18,
    cloudBaseFt: 4200,
    cloudTopFt: 9500,
    cloudLayers: [layer(0.18, 4200, 9500, 'cumulus')],
    visibilityM: 22000,
    rain: 0, snow: 0,
    thunderstorm: false,
    windDirDeg: 270, windSpeedKt: 8, gustKt: 14, turbulence: 0.10,
    temperatureC: 15, qnhHpa: 1013.25,
    fog: 0, haze: 0.18,
    ceilingFt: null
  };

  var PRESET_SPECS = {
    'clear': {
      cloudCover: 0.04, cloudBaseFt: 12000, cloudTopFt: 16000,
      cloudLayers: [layer(0.04, 12000, 16000, 'cirrus')],
      visibilityM: 45000, rain: 0, snow: 0, thunderstorm: false,
      windDirDeg: 250, windSpeedKt: 5, gustKt: 8, turbulence: 0.03,
      temperatureC: 16, qnhHpa: 1018.0, fog: 0, haze: 0.06, ceilingFt: null
    },
    'few': {
      cloudCover: 0.18, cloudBaseFt: 4500, cloudTopFt: 9000,
      cloudLayers: [layer(0.18, 4500, 9000, 'cumulus')],
      visibilityM: 30000, rain: 0, snow: 0, thunderstorm: false,
      windDirDeg: 260, windSpeedKt: 7, gustKt: 11, turbulence: 0.08,
      temperatureC: 18, qnhHpa: 1016.0, fog: 0, haze: 0.12, ceilingFt: null
    },
    'scattered': {
      cloudCover: 0.40, cloudBaseFt: 3500, cloudTopFt: 11000,
      cloudLayers: [layer(0.40, 3500, 11000, 'cumulus')],
      visibilityM: 22000, rain: 0, snow: 0, thunderstorm: false,
      windDirDeg: 250, windSpeedKt: 10, gustKt: 16, turbulence: 0.16,
      temperatureC: 19, qnhHpa: 1014.0, fog: 0, haze: 0.16, ceilingFt: null
    },
    'broken': {
      cloudCover: 0.70, cloudBaseFt: 2200, cloudTopFt: 12000,
      cloudLayers: [layer(0.62, 2200, 9000, 'cumulus'), layer(0.30, 11000, 18000, 'cirrus')],
      visibilityM: 14000, rain: 0.05, snow: 0, thunderstorm: false,
      windDirDeg: 240, windSpeedKt: 14, gustKt: 22, turbulence: 0.28,
      temperatureC: 14, qnhHpa: 1011.0, fog: 0, haze: 0.22, ceilingFt: null
    },
    'overcast': {
      cloudCover: 0.95, cloudBaseFt: 1200, cloudTopFt: 7000,
      cloudLayers: [layer(0.95, 1200, 7000, 'stratus')],
      visibilityM: 9000, rain: 0.10, snow: 0, thunderstorm: false,
      windDirDeg: 230, windSpeedKt: 12, gustKt: 19, turbulence: 0.30,
      temperatureC: 11, qnhHpa: 1009.0, fog: 0.05, haze: 0.35, ceilingFt: null
    },
    'rain': {
      cloudCover: 0.92, cloudBaseFt: 1400, cloudTopFt: 12000,
      cloudLayers: [layer(0.80, 1400, 8000, 'stratus'), layer(0.55, 9000, 14000, 'cumulus')],
      visibilityM: 5000, rain: 0.62, snow: 0, thunderstorm: false,
      windDirDeg: 215, windSpeedKt: 16, gustKt: 25, turbulence: 0.38,
      temperatureC: 12, qnhHpa: 1006.0, fog: 0.12, haze: 0.45, ceilingFt: null
    },
    'storm': {
      cloudCover: 1.0, cloudBaseFt: 900, cloudTopFt: 32000,
      cloudLayers: [layer(1.0, 900, 8000, 'cumulonimbus'), layer(0.85, 7000, 32000, 'cumulonimbus')],
      visibilityM: 2500, rain: 0.92, snow: 0, thunderstorm: true,
      windDirDeg: 240, windSpeedKt: 26, gustKt: 46, turbulence: 0.85,
      temperatureC: 21, qnhHpa: 998.0, fog: 0.20, haze: 0.55, ceilingFt: null
    },
    'snow': {
      cloudCover: 0.94, cloudBaseFt: 1100, cloudTopFt: 8000,
      cloudLayers: [layer(0.90, 1100, 8000, 'stratus')],
      visibilityM: 2400, rain: 0, snow: 0.72, thunderstorm: false,
      windDirDeg: 310, windSpeedKt: 10, gustKt: 18, turbulence: 0.30,
      temperatureC: -7, qnhHpa: 1012.0, fog: 0.16, haze: 0.40, ceilingFt: null
    },
    'fog': {
      cloudCover: 0.45, cloudBaseFt: 150, cloudTopFt: 1400,
      cloudLayers: [layer(0.45, 150, 1400, 'stratus')],
      visibilityM: 550, rain: 0, snow: 0, thunderstorm: false,
      windDirDeg: 200, windSpeedKt: 3, gustKt: 6, turbulence: 0.05,
      temperatureC: 9, qnhHpa: 1015.0, fog: 0.90, haze: 0.85, ceilingFt: null
    },
    'haze': {
      cloudCover: 0.22, cloudBaseFt: 6000, cloudTopFt: 11000,
      cloudLayers: [layer(0.22, 6000, 11000, 'cumulus')],
      visibilityM: 3800, rain: 0, snow: 0, thunderstorm: false,
      windDirDeg: 180, windSpeedKt: 4, gustKt: 7, turbulence: 0.08,
      temperatureC: 26, qnhHpa: 1013.0, fog: 0.10, haze: 0.85, ceilingFt: null
    },
    'windy': {
      cloudCover: 0.35, cloudBaseFt: 3000, cloudTopFt: 14000,
      cloudLayers: [layer(0.35, 3000, 14000, 'cumulus')],
      visibilityM: 28000, rain: 0, snow: 0, thunderstorm: false,
      windDirDeg: 285, windSpeedKt: 28, gustKt: 48, turbulence: 0.62,
      temperatureC: 15, qnhHpa: 1004.0, fog: 0, haze: 0.20, ceilingFt: null
    },
    'night-clear': {
      cloudCover: 0.05, cloudBaseFt: 9000, cloudTopFt: 14000,
      cloudLayers: [layer(0.05, 9000, 14000, 'cirrus')],
      visibilityM: 40000, rain: 0, snow: 0, thunderstorm: false,
      windDirDeg: 240, windSpeedKt: 4, gustKt: 7, turbulence: 0.03,
      temperatureC: 8, qnhHpa: 1019.0, fog: 0, haze: 0.08, ceilingFt: null,
      suggestedTimeHours: 22.5
    }
  };

  var WEATHER_PRESETS = [
    { id: 'clear', name: 'CAVOK', nameZh: '晴空万里', spec: PRESET_SPECS['clear'] },
    { id: 'few', name: 'Few', nameZh: '少云', spec: PRESET_SPECS['few'] },
    { id: 'scattered', name: 'Scattered', nameZh: '疏云', spec: PRESET_SPECS['scattered'] },
    { id: 'broken', name: 'Broken', nameZh: '多云', spec: PRESET_SPECS['broken'] },
    { id: 'overcast', name: 'Overcast', nameZh: '阴天', spec: PRESET_SPECS['overcast'] },
    { id: 'rain', name: 'Rain', nameZh: '降雨', spec: PRESET_SPECS['rain'] },
    { id: 'storm', name: 'Thunderstorm', nameZh: '雷暴', spec: PRESET_SPECS['storm'] },
    { id: 'snow', name: 'Snow', nameZh: '降雪', spec: PRESET_SPECS['snow'] },
    { id: 'fog', name: 'Fog', nameZh: '浓雾', spec: PRESET_SPECS['fog'] },
    { id: 'haze', name: 'Haze', nameZh: '霾/轻雾', spec: PRESET_SPECS['haze'] },
    { id: 'windy', name: 'Windy', nameZh: '大风', spec: PRESET_SPECS['windy'] },
    { id: 'night-clear', name: 'Night Clear', nameZh: '晴夜', spec: PRESET_SPECS['night-clear'] }
  ];

  /* ---------------------------------------------------------------------
     3. 通用小工具
     --------------------------------------------------------------------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(t) { t = clamp01(t); return t * t * (3 - 2 * t); }
  function nowMs() {
    if (typeof performance !== 'undefined' && performance.now) return performance.now();
    return Date.now();
  }
  /** 三维线性插值 (调色板插值用) */
  function mix3(a, b, t, out) {
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    out[2] = a[2] + (b[2] - a[2]) * t;
    return out;
  }
  function mix3b(a, b, t, c, tc, out) {
    var r = [0, 0, 0];
    mix3(a, b, t, r);
    return mix3(r, c, tc, out);
  }
  function finite(v, fallback) { return (typeof v === 'number' && isFinite(v)) ? v : fallback; }

  /* ---------------------------------------------------------------------
     4. 程序化贴图 (不依赖 DOM / canvas, 无浏览器环境下同样可用)
     --------------------------------------------------------------------- */

  /**
   * 云团图集: 4x2 共 8 个 64x64 变体, 非对称絮状 alpha, 打包进 256x128 RGBA 贴图。
   * 用 DataTexture 直接上传, 避免 canvas 2D 上下文缺失导致的黑屏。
   */
  function buildPuffAtlas(seed) {
    var TILE = 64, COLS = 4, ROWS = 2;
    var W = TILE * COLS, H = TILE * ROWS;
    var data = new Uint8Array(W * H * 4);
    var rnd = FS.Rng.mulberry32((seed ^ 0x9e3779b9) >>> 0);
    var t, x, y, i, k;
    for (t = 0; t < COLS * ROWS; t++) {
      var ox = (t % COLS) * TILE, oy = Math.floor(t / COLS) * TILE;
      // 多球体叠加 -> 非对称云团
      var lobes = [];
      var nb = 5 + Math.floor(rnd() * 4);
      for (i = 0; i < nb; i++) {
        lobes.push({
          x: 0.5 + (rnd() - 0.5) * 0.62,
          y: 0.5 + (rnd() - 0.5) * 0.50,
          r: 0.14 + rnd() * 0.22,
          a: 0.35 + rnd() * 0.65
        });
      }
      lobes.push({ x: 0.5, y: 0.53, r: 0.30, a: 0.95 });
      lobes.push({ x: 0.42, y: 0.40, r: 0.22, a: 0.70 });
      for (y = 0; y < TILE; y++) {
        for (x = 0; x < TILE; x++) {
          var u = (x + 0.5) / TILE, v = (y + 0.5) / TILE;
          var d = 0;
          for (k = 0; k < lobes.length; k++) {
            var L = lobes[k];
            var dx = u - L.x, dy = (v - L.y) * 1.18;
            var q = 1 - Math.sqrt(dx * dx + dy * dy) / L.r;
            if (q > 0) d += q * q * L.a;
          }
          var a = clamp01(d);
          a = a * a * (3 - 2 * a);
          // 内部絮状扰动, 避免完美圆形
          var nz = Noise.value2(u * 6.5 + t * 17.3, v * 6.1 - t * 9.7, seed + t * 13);
          a *= 0.70 + 0.30 * nz;
          // 圆形软裁剪 (去掉方块边界)
          var rr = Math.sqrt((u - 0.5) * (u - 0.5) + (v - 0.5) * (v - 0.5) * 1.05) * 2.0;
          a *= clamp01(1 - smoothstep((rr - 0.62) / 0.38));
          var idx = ((oy + y) * W + (ox + x)) * 4;
          var av = (clamp01(a) * 255) | 0;
          data[idx] = 255; data[idx + 1] = 255; data[idx + 2] = 255; data[idx + 3] = av;
        }
      }
    }
    var tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    tex.__dshOwned = true;
    return tex;
  }

  /* ---------------------------------------------------------------------
     5. GLSL 公共片段
     --------------------------------------------------------------------- */
  // 与内建材质保持一致的颜色管线 (r149: tonemapping + encodings)
  var GLSL_OUT = '\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n';

  var GLSL_SKY_VERT = [
    'varying vec3 vDir;',
    'void main() {',
    '  vDir = normalize(position);',
    '  vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);',
    '  gl_Position = vec4(p.xy, p.w, p.w);',   // 强制落在远平面, 永不裁剪
    '}'
  ].join('\n');

  var GLSL_SKY_FRAG = [
    'precision highp float;',
    'varying vec3 vDir;',
    'uniform vec3 uSunDir;',
    'uniform vec3 uMoonDir;',
    'uniform vec3 uZenithCol;',
    'uniform vec3 uHorizonCol;',
    'uniform vec3 uGroundCol;',
    'uniform vec3 uSunCol;',
    'uniform vec3 uGlowCol;',
    'uniform vec3 uDuskCol;',
    'uniform float uSunVisible;',
    'uniform float uMoonVisible;',
    'uniform float uMoonPhase;',
    'uniform float uMoonBright;',
    'uniform float uDay;',
    'uniform float uHaze;',
    'uniform float uDuskAmount;',
    'uniform float uFlat;',
    'uniform float uFlash;',
    'float sat(float v) { return clamp(v, 0.0, 1.0); }',
    'void main() {',
    '  vec3 d = normalize(vDir);',
    '  float y = clamp(d.y, -1.0, 1.0);',
    '  float ay = abs(y);',
    '  float cosSun = dot(d, uSunDir);',
    '  float airMass = 1.0 / (ay * 0.97 + 0.10);',
    '  float horizonW = pow(1.0 - sat(ay), 3.5);',
    '  vec3 col = mix(uZenithCol, uHorizonCol, horizonW);',
    // 瑞利相位函数 —— 让天空有方向性而不是纯渐变
    '  float phR = 0.75 * (1.0 + cosSun * cosSun);',
    '  col *= 0.84 + 0.28 * phR;',
    // 黄昏/黎明: 仅在太阳所在方位的地平线上染色
    '  float azim = pow(sat(cosSun * 0.5 + 0.5), 3.0);',
    '  col = mix(col, uDuskCol, uDuskAmount * azim * pow(horizonW, 0.7) * 0.90);',
    // Mie 前向散射: 太阳附近的辉光
    '  float mie = pow(sat(cosSun), 7.0);',
    '  float glowAir = airMass / (airMass + 2.5);',
    '  col += uGlowCol * mie * (0.30 + 0.90 * uHaze) * (0.20 + 1.30 * uDay) * (0.45 + glowAir);',
    // 大气消光: 低空/高霾时地平线泛白
    '  vec3 att = exp(-vec3(0.060, 0.090, 0.170) * airMass * (0.5 + 1.6 * uHaze));',
    '  col *= mix(vec3(1.0), att, 0.60);',
    // 阴天时整个天空被云层压暗
    '  col *= mix(1.0, 0.62, uFlat);',
    // ---- 太阳圆面 (含边缘增亮) ----
    '  if (uSunVisible > 0.001) {',
    '    float ang = acos(clamp(cosSun, -1.0, 1.0));',
    '    float r = 0.00930;',
    '    float disc = 1.0 - smoothstep(r * 0.90, r * 1.25, ang);',
    '    float limb = sqrt(sat(1.0 - pow(sat(ang / r), 2.0)));',
    '    col += uSunCol * disc * (0.30 + 0.70 * limb) * 9.0 * uSunVisible;',
    '    col += uSunCol * exp(-ang * 26.0) * 0.55 * uSunVisible;',
    '    col += uSunCol * exp(-ang * 4.5) * 0.10 * uSunVisible;',
    '  }',
    // ---- 月亮 (椭圆明暗界线模拟相位) ----
    '  if (uMoonVisible > 0.001) {',
    '    float ang = acos(clamp(dot(d, uMoonDir), -1.0, 1.0));',
    '    float r = 0.00900;',
    '    float disc = 1.0 - smoothstep(r * 0.92, r * 1.14, ang);',
    '    vec3 east = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)) + vec3(1e-5, 0.0, 0.0));',
    '    vec3 rgt = normalize(cross(east, uMoonDir));',
    '    vec3 rel = d - uMoonDir;',
    '    float ax = dot(rel, rgt) / r;',
    '    float ay2 = dot(rel, east) / r;',
    '    vec3 sPerp = uSunDir - uMoonDir * dot(uSunDir, uMoonDir);',
    '    float sl = length(sPerp);',
    '    sPerp = sl > 1e-4 ? sPerp / sl : rgt;',
    '    float sdx = dot(sPerp, rgt);',
    '    float sdy = dot(sPerp, east);',
    '    float nx = ax * sdx + ay2 * sdy;',
    '    float ny = -ax * sdy + ay2 * sdx;',
    '    float nyc = clamp(ny, -0.995, 0.995);',
    '    float term = (1.0 - 2.0 * uMoonPhase) * sqrt(max(1.0 - nyc * nyc, 0.0));',
    '    float lit = clamp((nx - term) * 22.0, 0.0, 1.0);',
    '    vec3 mcol = vec3(0.95, 0.96, 0.90) * (2.6 * uMoonBright);',
    '    col += mcol * disc * lit * uMoonVisible;',
    '    col += mcol * exp(-ang * 34.0) * 0.14 * lit * uMoonVisible;',
    '  }',
    // ---- 地平线以下: 融入地表雾色 ----
    '  float gw = sat(-y * 12.0);',
    '  col = mix(col, uGroundCol, gw * 0.85);',
    // ---- 闪电 ----
    '  col += uFlash * vec3(0.72, 0.78, 0.95) * (0.25 + 0.75 * horizonW);',
    '  col = max(col, vec3(0.0));',
    '  gl_FragColor = vec4(col, 1.0);',
    GLSL_OUT,
    '}'
  ].join('\n');

  var GLSL_STAR_VERT = [
    'attribute float aSize;',
    'attribute vec3 aColor;',
    'attribute float aPhase;',
    'uniform float uTime;',
    'uniform float uPR;',
    'uniform float uFade;',
    'varying vec3 vCol;',
    'varying float vAlpha;',
    'void main() {',
    '  vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);',
    '  gl_Position = vec4(p.xy, p.w, p.w);',
    '  float tw = 0.72 + 0.28 * sin(uTime * 1.6 + aPhase * 43.0);',
    '  gl_PointSize = max(1.0, aSize * uPR * tw);',
    '  vCol = aColor;',
    '  vAlpha = uFade * (0.55 + 0.45 * tw);',
    '}'
  ].join('\n');

  var GLSL_STAR_FRAG = [
    'precision mediump float;',
    'varying vec3 vCol;',
    'varying float vAlpha;',
    'void main() {',
    '  vec2 q = gl_PointCoord - vec2(0.5);',
    '  float r = length(q) * 2.0;',
    '  float a = (1.0 - smoothstep(0.30, 1.02, r)) * vAlpha;',
    '  if (a < 0.004) discard;',
    '  gl_FragColor = vec4(vCol, clamp(a, 0.0, 1.0));',
    GLSL_OUT,
    '}'
  ].join('\n');

  /* =====================================================================
     6. 地形数学模型 —— 纯函数 h(x, z)
        组成:
          a) 低频大陆度场 (fbm) -> 海陆分离, 平滑海岸带
          b) 域扭曲的 ridged 多重分形 -> 山脉走向与山脊
          c) 中频 fbm -> 丘陵/河谷
          d) 高频细节 + 湖泊
        所有参数只与世界种子有关, 与相机/LOD 无关。
     ===================================================================== */

  // 特征波长 (米)
  var W_CONT = 1 / 180000;   // 大陆
  var W_COAST = 1 / 61000;   // 海岸曲折
  var W_BELT = 1 / 205000;   // 造山带掩膜
  var W_RIDGE = 1 / 33000;   // 山脉
  var W_HILL = 1 / 11500;    // 丘陵
  var W_DET = 1 / 2700;      // 细节
  var W_DEEP = 1 / 74000;    // 海盆
  var W_PLAT = 1 / 47000;    // 高原/平原
  var W_LAKE = 1 / 16000;    // 湖泊
  var W_BIOME = 1 / 42000;   // 生物群落
  var W_BIOME2 = 1 / 9000;

  var SEA_THRESH = 0.045;    // 大陆度海平面阈值
  var COAST_BAND = 0.150;    // 海岸过渡带宽度 (大陆度单位, 约 8-12 km)
  var MOUNT_AMP = 6600;      // 山脉最大高度 (m)
  var SNOW_LINE_BASE = 3400; // 雪线 (m, 季节修正前)

  function TerrainModel(seed, seaLevelM) {
    this.seed = (seed >>> 0) || 1;
    this.seaLevel = finite(seaLevelM, 0);
    var s = this.seed;
    this.k = {
      cont: s + 11, cont2: s + 23, belt: s + 53, ridge: s + 31,
      warpA: s + 77, warpB: s + 79, hill: s + 91, det: s + 131,
      deep: s + 97, plat: s + 67, lake: s + 173, biome: s + 151, biome2: s + 163
    };
  }

  /** 海陆过渡权重 t: 0 = 深海, 1 = 内陆 */
  TerrainModel.prototype.coast = function (x, z) {
    var k = this.k;
    var c1 = Noise.fbm2(x * W_CONT + 13.7, z * W_CONT - 5.3, 5, 2.0, 0.5, k.cont);
    var c2 = Noise.fbm2(x * W_COAST - 41.2, z * W_COAST + 19.6, 4, 2.0, 0.5, k.cont2);
    var cc = c1 * 0.80 + c2 * 0.30;
    return smoothstep((cc + SEA_THRESH) / COAST_BAND);
  };

  /** 原始地形高度 (可为负 = 海床), 未做海平面截断 */
  TerrainModel.prototype.rawHeight = function (x, z) {
    if (!isFinite(x) || !isFinite(z)) return this.seaLevel;
    var k = this.k;

    // ---------- a) 海陆 ----------
    var t = this.coast(x, z);

    // ---------- b) 山脉 ----------
    var w = Noise.warp2(x * W_RIDGE + 7.1, z * W_RIDGE - 3.9, 1.35, k.warpA);
    var rid = Noise.ridged2(w.x, w.z, 5, 2.05, 0.5, k.ridge);         // 0..1
    var beltN = Noise.fbm2(x * W_BELT + 3.7, z * W_BELT - 8.1, 4, 2.0, 0.5, k.belt);
    var belt = smoothstep((beltN + 0.30) / 0.60);
    var ridgeN = rid * rid * (3 - 2 * rid);
    var mountain = MOUNT_AMP * Math.pow(ridgeN, 1.45) * belt;

    // ---------- c) 丘陵与细节 ----------
    var hills = Noise.fbm2(x * W_HILL - 17.3, z * W_HILL + 11.9, 4, 2.0, 0.5, k.hill) * 170;
    var det = Noise.fbm2(x * W_DET + 2.2, z * W_DET - 6.6, 3, 2.0, 0.5, k.det) * 24;

    // 近海抑制地形起伏 -> 沙滩/海岸平缓, 而不是悬崖
    var tMask = smoothstep((t - 0.40) / 0.60);

    // ---------- d) 陆地基础地势 ----------
    var platN = Noise.fbm2(x * W_PLAT + 29.1, z * W_PLAT - 13.4, 3, 2.0, 0.5, k.plat);
    var interior = smoothstep((t - 0.35) / 0.65);
    var landBase = 4 + 95 * t + (45 + 430 * (platN * 0.5 + 0.5)) * interior;
    var landTop = landBase + (mountain + hills + det) * tMask;

    // ---------- e) 湖泊 ----------
    var lakeN = Noise.fbm2(x * W_LAKE + 61.3, z * W_LAKE - 27.7, 3, 2.0, 0.5, k.lake);
    if (landTop > 6 && landTop < 420 && lakeN > 0.30) {
      landTop -= (lakeN - 0.30) * 260;
      if (landTop < 1) landTop = -6;
    }
    if (landTop < 1.5) landTop = 1.5;

    // ---------- f) 海床 ----------
    var deepN = Noise.fbm2(x * W_DEEP + 5.5, z * W_DEEP - 3.1, 3, 2.0, 0.5, k.deep) * 0.5 + 0.5;
    var away = smoothstep((0.30 - t) / 0.30);
    var seaFloor = -(7 + 40 * (1 - t)) - (700 + 2800 * deepN) * away * away;

    // ---------- g) 合成 ----------
    var h = seaFloor * (1 - t) + landTop * t;
    if (!isFinite(h)) return this.seaLevel;
    return h;
  };

  /** 地形高度 (含海平面截断, 未计入机场平整区) */
  TerrainModel.prototype.height = function (x, z) {
    var h = this.rawHeight(x, z);
    return h < this.seaLevel ? this.seaLevel : h;
  };

  /**
   * 机场平整区混合 —— 渲染网格与 getGroundHeight 共用同一份逻辑,
   * 保证"看到的"和"撞到的"地形完全一致。
   */
  function applyFlatten(zones, x, z, h) {
    // 圆形平整区按顺序混合; 跑道带状区 (seg) 统一加权: 落在某条跑道核心区内时该跑道权重为 1,
    // 离开核心区按 150 m 指数衰减 —— 平行跑道之间不会互相"压歪"。
    var segW = 0, segSum = 0, segA = 0;
    for (var i = 0; i < zones.length; i++) {
      var f = zones[i];
      if (f.seg) {
        if (x < f.minX || x > f.maxX || z < f.minZ || z > f.maxZ) continue;
        var px = x - f.ax, pz = z - f.az;
        var t = (px * f.dx + pz * f.dz) * f.invL2;
        t = t < 0 ? 0 : (t > 1 ? 1 : t);
        var qx = px - f.dx * t, qz = pz - f.dz * t;
        var ds = Math.sqrt(qx * qx + qz * qz);
        if (ds >= f.inner + f.falloff) continue;
        var ws = 1 - smoothstep((ds - f.inner) / f.falloff);
        var a = Math.exp(-Math.max(0, ds - f.inner) / 150);
        if (ws > segW) segW = ws;
        segSum += a * f.h; segA += a;
        continue;
      }
      var dx = x - f.x, dz = z - f.z;
      var d2 = dx * dx + dz * dz;
      if (d2 < f.r2) {
        var d = Math.sqrt(d2);
        var w = 1 - smoothstep((d - f.inner) / f.falloff);
        h = h + (f.h - h) * w;
      }
    }
    if (segA > 0) h = h + (segSum / segA - h) * segW;
    return h;
  }

  /** 生物群落/材质代码 */
  var MAT_WATER = 0, MAT_LAND = 1, MAT_CITY = 2, MAT_DESERT = 3,
    MAT_FOREST = 4, MAT_MOUNTAIN = 5, MAT_SNOW = 6;
  var MAT_NAMES = ['water', 'land', 'city', 'desert', 'forest', 'mountain', 'snow'];

  /** 纬度 (度) —— 由世界平面坐标反推, 与 Geo 参考点一致 */
  function latOfZ(z) { return Geo.refLat - (z / C.EARTH_R) * RAD; }

  var _cLat = [0, 0, 0];
  /** 低分辨率生物群落采样 (颜色烘焙时复用, 避免重复噪声) */
  TerrainModel.prototype.biomeAt = function (x, z, out) {
    var k = this.k;
    var b1 = Noise.fbm2(x * W_BIOME + 8.3, z * W_BIOME - 4.7, 3, 2.0, 0.5, k.biome);
    var b2 = Noise.fbm2(x * W_BIOME2 - 2.1, z * W_BIOME2 + 9.9, 2, 2.0, 0.5, k.biome2);
    var lat = latOfZ(z);
    out[0] = b1; out[1] = b2; out[2] = lat;
    return out;
  };

  /**
   * 表面类型判定
   * @param {number} h 已截断的高度
   * @param {number} slope 局部坡度 (0 = 水平, 1 ≈ 45°)
   * @param {number} snowLine 雪线高度
   * @param {number} urban 城市影响因子 0..1 (0 = 无)
   */
  TerrainModel.prototype.matCode = function (x, z, h, slope, snowLine, urban) {
    var bm = this.biomeAt(x, z, _cLat);
    var b1 = bm[0], b2 = bm[1], lat = bm[2], alat = Math.abs(lat);
    if (h <= this.seaLevel + 0.01) return MAT_WATER;
    if (urban > 0.35 && h < 900 && slope < 0.35) return MAT_CITY;
    if (h > snowLine && slope < 0.75) return MAT_SNOW;
    if (h > 2100 || slope > 0.60) return MAT_MOUNTAIN;
    // 沙漠: 副热带干旱带 (约 8°~45°) + 干旱噪声
    var arid = smoothstep((alat - 8) / 10) * (1 - smoothstep((alat - 33) / 14));
    if (arid > 0.30 && b1 * 0.6 + b2 * 0.4 > 0.30 - arid * 0.35) return MAT_DESERT;
    if (b1 * 0.65 + b2 * 0.35 > -0.05 && alat > 22 && alat < 66) return MAT_FOREST;
    return MAT_LAND;
  };

  /* =====================================================================
     7. 调色板 (线性空间) —— 由 CPU 计算, 交给天空/水体/云着色器
     ===================================================================== */
  var SKY_PAL = {
    dayZenith: [0.052, 0.140, 0.360],
    dayHorizon: [0.400, 0.520, 0.700],
    duskZenith: [0.055, 0.090, 0.210],
    duskHorizon: [0.640, 0.270, 0.090],
    nightZenith: [0.0035, 0.0055, 0.0150],
    nightHorizon: [0.0110, 0.0180, 0.0380],
    duskCol: [0.950, 0.420, 0.130],
    glowDay: [0.850, 0.780, 0.660],
    glowDusk: [1.000, 0.520, 0.220],
    sunDay: [1.000, 0.960, 0.900],
    sunLow: [1.000, 0.480, 0.170],
    moonCol: [0.720, 0.800, 1.000],
    groundHaze: [0.300, 0.340, 0.420]
  };

  var PB = {                       // 地表材质调色板
    seabedShallow: [0.300, 0.320, 0.230],
    seabedDeep: [0.038, 0.068, 0.092],
    grass: [0.140, 0.250, 0.092],
    grassDry: [0.360, 0.325, 0.140],
    forest: [0.070, 0.175, 0.072],
    desert: [0.590, 0.490, 0.310],
    rock: [0.270, 0.252, 0.234],
    snow: [0.905, 0.940, 0.985],
    beach: [0.600, 0.550, 0.400],
    city: [0.230, 0.226, 0.222],
    cityBright: [0.360, 0.350, 0.340]
  };

  var _colTmp = [0, 0, 0];

  /** 季节 -> 雪线 (m) */
  TerrainModel.prototype.setSeason = function (month, refLat) {
    var m = finite(month, 3);
    var seasonal = Math.cos((m - 7) / 12 * 2 * PI);   // 7 月最高
    if (refLat < 0) seasonal = -seasonal;             // 南半球反转
    this.snowLine = SNOW_LINE_BASE + 950 * seasonal;
  };
  TerrainModel.prototype.snowLine = SNOW_LINE_BASE;

  /**
   * 烘焙顶点颜色 —— 直接写入 {r,g,b} 对象, 无内存分配
   * @param {number} urban 城市影响因子 0..1
   */
  TerrainModel.prototype.colorInto = function (x, z, h, slope, urban, out) {
    var code = this.matCode(x, z, h, slope, this.snowLine, urban);
    var b = _cLat;                                     // matCode 已填充
    var veg = clamp01(b[0] * 0.65 + b[1] * 0.35 + 0.5);
    var sl = clamp01(slope);
    var tmp = _colTmp;
    if (code === MAT_WATER) {
      var depth = clamp01((this.seaLevel - h) / 240);
      mix3(PB.seabedShallow, PB.seabedDeep, depth * depth, tmp);
    } else {
      mix3(PB.grass, PB.grassDry, clamp01(1 - veg * 1.45), tmp);
      mix3(tmp, PB.forest, clamp01((veg - 0.42) * 1.9), tmp);
      if (code === MAT_DESERT) mix3(tmp, PB.desert, 0.88, tmp);
      // 陡坡 -> 裸岩
      mix3(tmp, PB.rock, clamp01((sl - 0.40) / 0.30) * 0.88, tmp);
      // 高海拔 -> 岩石
      mix3(tmp, PB.rock, clamp01((h - 1900) / 1500) * 0.78, tmp);
      // 雪线以上
      var snow = clamp01((h - this.snowLine) / 340) * clamp01(1 - (sl - 0.80) / 0.5);
      mix3(tmp, PB.snow, clamp01(snow), tmp);
      // 海滩
      var beach = (1 - clamp01((h - this.seaLevel) / 15)) * clamp01(1 - sl * 2.4);
      mix3(tmp, PB.beach, clamp01(beach) * 0.75, tmp);
      // 城市 (水泥灰)
      if (urban > 0.01) {
        mix3(tmp, urban > 0.66 ? PB.cityBright : PB.city, clamp01(urban) * 0.92, tmp);
      }
    }
    out.r = tmp[0]; out.g = tmp[1]; out.b = tmp[2];
    return out;
  };

  /* =====================================================================
     8. 天文: 太阳 / 月亮
     ===================================================================== */
  var MONTH_CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

  function dayOfYear(month, day) {
    var m = clamp(Math.round(finite(month, 1)), 1, 12);
    var dd = clamp(Math.round(finite(day, 1)), 1, 31);
    return MONTH_CUM[m - 1] + dd;
  }

  function sunDeclinationDeg(month, day) {
    var n = dayOfYear(month, day);
    return -23.44 * Math.cos((2 * PI / 365) * (n + 10));
  }

  /**
   * 由赤纬/时角/纬度求地平坐标 -> 世界方向 (单位向量)
   * 方位角约定: 自北顺时针 (N=0, E=90, S=180, W=270)
   */
  function horizToWorld(declDeg, hourAngleDeg, latDeg, out) {
    var d = declDeg * DEG, H = hourAngleDeg * DEG, phi = latDeg * DEG;
    var sA = clamp(Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(H), -1, 1);
    var a = Math.asin(sA);
    var x = (Math.sin(d) - Math.sin(phi) * sA) / Math.max(Math.abs(Math.cos(phi)), 1e-4);
    var y = -Math.cos(d) * Math.sin(H);
    var az = Math.atan2(y, x);
    var ca = Math.cos(a);
    out.x = ca * Math.sin(az);
    out.z = -ca * Math.cos(az);
    out.y = sA;
    return out;
  }

  var _v3t = { x: 0, y: 0, z: 0 };

  /** 月亮 (低精度解析式, 精度约 ±1°, 足够模拟用) */
  function moonState(month, day, hours, latDeg, out) {
    var d = (dayOfYear(month, day) - 1) + finite(hours, 12) / 24;
    var ls = (280.460 + 0.9856474 * d) * DEG;
    var Dm = (297.8502 + 12.1907491 * d) * DEG;
    var F = (93.272 + 13.229350 * d) * DEG;
    var lm = ls + Dm;
    var beta = 5.128 * DEG * Math.sin(F);
    var eps = 23.439 * DEG;
    var raS = Math.atan2(Math.cos(eps) * Math.sin(ls), Math.cos(ls));
    var sinDec = Math.sin(beta) * Math.cos(eps) + Math.cos(beta) * Math.sin(eps) * Math.sin(lm);
    var dec = Math.asin(clamp(sinDec, -1, 1));
    var raM = Math.atan2(Math.sin(lm) * Math.cos(eps) - Math.tan(beta) * Math.sin(eps), Math.cos(lm));
    var Hs = 15 * (finite(hours, 12) - 12) * DEG;
    var Hm = Hs + (raS - raM);
    horizToWorld(dec * RAD, Hm * RAD, latDeg, out.dir);
    var phase = (1 - Math.cos(Dm)) / 2;                 // 0 新月, 1 满月
    out.phase = clamp01(phase);
    out.elevDeg = Math.asin(clamp(out.dir.y, -1, 1)) * RAD;
    return out;
  }

  /* =====================================================================
     9. 天空穹顶 + 星空
     ===================================================================== */
  function makeStars(count, seed) {
    count = Math.max(64, count | 0);
    var pos = new Float32Array(count * 3);
    var col = new Float32Array(count * 3);
    var size = new Float32Array(count);
    var phase = new Float32Array(count);
    var rnd = FS.Rng.mulberry32((seed + 7777) >>> 0);
    // 银河带法向 (与黄道近似垂直的一个方向)
    var nx = 0.42, ny = 0.72, nz = -0.55;
    var nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
    nx /= nl; ny /= nl; nz /= nl;
    // 构造带内正交基
    var ux = -nz, uy = 0, uz = nx;
    var ul = Math.max(Math.sqrt(ux * ux + uz * uz), 1e-5);
    ux /= ul; uz /= ul;
    var vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux;
    var r, g, b, i, x, y, z, len, t;
    for (i = 0; i < count; i++) {
      var inBand = rnd() < 0.36;
      if (inBand) {
        var ang = rnd() * 2 * PI;
        var off = (rnd() + rnd() + rnd() - 1.5) * 0.20;
        x = (ux * Math.cos(ang) + vx * Math.sin(ang)) + nx * off;
        y = (uy * Math.cos(ang) + vy * Math.sin(ang)) + ny * off;
        z = (uz * Math.cos(ang) + vz * Math.sin(ang)) + nz * off;
      } else {
        var u1 = rnd() * 2 - 1, th = rnd() * 2 * PI, sq = Math.sqrt(Math.max(0, 1 - u1 * u1));
        x = sq * Math.cos(th); y = u1; z = sq * Math.sin(th);
      }
      len = Math.sqrt(x * x + y * y + z * z) || 1;
      pos[i * 3] = x / len; pos[i * 3 + 1] = y / len; pos[i * 3 + 2] = z / len;
      // 色温: 偏蓝白 / 白 / 偏橙
      t = rnd();
      if (t < 0.16) { r = 0.66; g = 0.76; b = 1.00; }
      else if (t < 0.72) { r = 1.00; g = 0.98; b = 0.94; }
      else if (t < 0.94) { r = 1.00; g = 0.90; b = 0.74; }
      else { r = 1.00; g = 0.76; b = 0.56; }
      var dim = inBand ? 0.55 + rnd() * 0.30 : 0.75 + rnd() * 0.45;
      col[i * 3] = r * dim; col[i * 3 + 1] = g * dim; col[i * 3 + 2] = b * dim;
      var bright = rnd();
      size[i] = (bright > 0.985 ? 2.6 + rnd() * 1.8 : (bright > 0.86 ? 1.7 + rnd() * 0.8 : 1.0 + rnd() * 0.5));
      phase[i] = rnd();
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1);
    return geo;
  }

  function Sky(scene, seed, quality) {
    this.seed = seed;
    this.uniforms = {
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
      uZenithCol: { value: new THREE.Color(0.05, 0.14, 0.36) },
      uHorizonCol: { value: new THREE.Color(0.40, 0.52, 0.70) },
      uGroundCol: { value: new THREE.Color(0.30, 0.34, 0.42) },
      uSunCol: { value: new THREE.Color(1.0, 0.96, 0.90) },
      uGlowCol: { value: new THREE.Color(0.85, 0.78, 0.66) },
      uDuskCol: { value: new THREE.Color(0.95, 0.42, 0.13) },
      uSunVisible: { value: 1.0 },
      uMoonVisible: { value: 0.0 },
      uMoonPhase: { value: 0.5 },
      uMoonBright: { value: 0.0 },
      uDay: { value: 1.0 },
      uHaze: { value: 0.15 },
      uDuskAmount: { value: 0.0 },
      uFlat: { value: 0.0 },
      uFlash: { value: 0.0 }
    };
    var geo = new THREE.SphereGeometry(5000, 32, 20);
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: GLSL_SKY_VERT,
      fragmentShader: GLSL_SKY_FRAG,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      fog: false
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.renderOrder = -1000;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    scene.add(this.mesh);

    // ---- 星空 ----
    this.starUniforms = {
      uTime: { value: 0 },
      uPR: { value: 1 },
      uFade: { value: 0 }
    };
    this.starGeo = makeStars(quality.stars, seed);
    this.starMat = new THREE.ShaderMaterial({
      uniforms: this.starUniforms,
      vertexShader: GLSL_STAR_VERT,
      fragmentShader: GLSL_STAR_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      fog: false
    });
    this.stars = new THREE.Points(this.starGeo, this.starMat);
    this.stars.frustumCulled = false;
    this.stars.matrixAutoUpdate = false;
    this.stars.renderOrder = -999;
    this.stars.castShadow = false;
    scene.add(this.stars);
  }

  Sky.prototype.setStarFade = function (f, time, pr) {
    this.starUniforms.uFade.value = clamp01(f);
    this.starUniforms.uTime.value = time;
    if (pr) this.starUniforms.uPR.value = pr;
  };

  Sky.prototype.dispose = function () {
    var s = this.mesh.parent;
    if (s) s.remove(this.mesh);
    if (s) s.remove(this.stars);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.starGeo.dispose();
    this.starMat.dispose();
  };

  /* =====================================================================
     10. 地形材质 —— Lambert + 顶点色, 注入云影与低空高度雾
     ===================================================================== */
  function makeTerrainMaterial(uni) {
    var mat = new THREE.MeshLambertMaterial({ vertexColors: true, fog: true });
    mat.onBeforeCompile = function (shader) {
      shader.uniforms.uCloudShadow = uni.uCloudShadow;
      shader.uniforms.uCloudCover = uni.uCloudCover;
      shader.uniforms.uCloudOff = uni.uCloudOff;
      shader.uniforms.uHazeColor = uni.uHazeColor;
      shader.uniforms.uHazeAmount = uni.uHazeAmount;
      shader.uniforms.uHazeScale = uni.uHazeScale;
      shader.uniforms.uHazeFar = uni.uHazeFar;
      // 顶点着色器: 计算云影强度 (低频噪声, 随云漂移)
      var declV = [
        'uniform float uCloudShadow;',
        'uniform float uCloudCover;',
        'uniform vec2 uCloudOff;',
        'varying vec3 vWPosT;',
        'varying float vCloudSh;',
        'float dshHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
        'float dshNoise(vec2 p) {',
        '  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);',
        '  float a = dshHash(i), b = dshHash(i + vec2(1.0, 0.0));',
        '  float c = dshHash(i + vec2(0.0, 1.0)), d = dshHash(i + vec2(1.0, 1.0));',
        '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);',
        '}',
        'float dshCloudShade(vec2 xz) {',
        '  float n = dshNoise(xz * 0.000085 + uCloudOff) * 0.62 + dshNoise(xz * 0.00021 + uCloudOff * 1.9) * 0.38;',
        '  return 1.0 - uCloudShadow * uCloudCover * smoothstep(0.30, 0.86, n);',
        '}'
      ].join('\n');
      shader.vertexShader = declV + '\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n  vWPosT = (modelMatrix * vec4(transformed, 1.0)).xyz;\n  vCloudSh = dshCloudShade(vWPosT.xz);'
      );
      // 片元着色器: 云影压暗 + 高度雾
      var declF = [
        'uniform vec3 uHazeColor;',
        'uniform float uHazeAmount;',
        'uniform float uHazeScale;',
        'uniform float uHazeFar;',
        'varying vec3 vWPosT;',
        'varying float vCloudSh;'
      ].join('\n');
      shader.fragmentShader = declF + '\n' + shader.fragmentShader;
      var injectF = [
        '#include <fog_fragment>',
        '  gl_FragColor.rgb *= mix(1.0, vCloudSh, 0.9);',
        '  float dshHz = uHazeAmount * exp(-max(vWPosT.y, 0.0) / uHazeScale);',
        '  #ifdef USE_FOG',
        '  float dshHzA = clamp(dshHz * (1.0 - exp(-vFogDepth / max(uHazeFar, 100.0))), 0.0, 0.90);',
        '  #else',
        '  float dshHzA = clamp(dshHz, 0.0, 0.90);',
        '  #endif',
        '  gl_FragColor.rgb = mix(gl_FragColor.rgb, uHazeColor, dshHzA);'
      ].join('\n');
      shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', injectF);
    };
    return mat;
  }

  /* =====================================================================
     11. 地形 LOD (clipmap) —— 池化 chunk, 逐帧限时重建
     ===================================================================== */
  function TerrainChunk(field, ring, verts, size) {
    this.field = field;
    this.ring = ring;
    this.verts = verts;
    this.seg = verts - 1;
    this.size = size;
    this.gi = 0; this.gj = 0;
    this.key = null;
    this.built = false;
    this.queued = false;          // 已在重建队列中 (防止重复入队)
    this.heights = new Float32Array(verts * verts);
    this.pos = new Float32Array(verts * verts * 3);
    this.nrm = new Float32Array(verts * verts * 3);
    this.col = new Float32Array(verts * verts * 3);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(ring.index);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -1e5, 0), 1);
    this.geo = geo;
    this.mesh = new THREE.Mesh(geo, field.material);
    this.mesh.matrixAutoUpdate = false;
    this.mesh.visible = false;
    this.mesh.frustumCulled = true;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    this.mesh.userData.noPick = true;
    field.group.add(this.mesh);
  }

  /** 重建该 chunk 的顶点数据 (高度是 (x,z) 的纯函数) */
  TerrainChunk.prototype.rebuild = function () {
    var model = this.field.model;
    var heightFn = this.field.heightFn;
    var v = this.verts, seg = this.seg, size = this.size;
    var h = this.heights, pos = this.pos, nrm = this.nrm, col = this.col;
    var step = size / seg;
    var cx = this.gi * size, cz = this.gj * size;
    var x0 = cx - size * 0.5, z0 = cz - size * 0.5;
    var i, j, idx, x, z, hh;
    var minH = 1e9, maxH = -1e9;
    // ---- 高度 + 位置 ----
    for (j = 0; j < v; j++) {
      z = z0 + j * step;
      var row = j * v;
      for (i = 0; i < v; i++) {
        x = x0 + i * step;
        hh = heightFn ? heightFn(x, z) : model.rawHeight(x, z);
        if (!isFinite(hh)) hh = model.seaLevel;
        idx = row + i;
        h[idx] = hh;
        pos[idx * 3] = x; pos[idx * 3 + 1] = hh; pos[idx * 3 + 2] = z;
        if (hh < minH) minH = hh;
        if (hh > maxH) maxH = hh;
      }
    }
    // ---- 法线 + 顶点色 ----
    var urbanFn = this.field.urbanFn;
    for (j = 0; j < v; j++) {
      var rowB = j * v;
      for (i = 0; i < v; i++) {
        idx = rowB + i;
        var hl = h[i > 0 ? idx - 1 : idx], hr = h[i < seg ? idx + 1 : idx];
        var hd = h[j > 0 ? idx - v : idx], hu = h[j < seg ? idx + v : idx];
        var dxm = (i > 0 ? step : 0) + (i < seg ? step : 0);
        var dzm = (j > 0 ? step : 0) + (j < seg ? step : 0);
        var gx = dxm > 0 ? (hr - hl) / dxm : 0;
        var gz = dzm > 0 ? (hu - hd) / dzm : 0;
        var inv = 1 / Math.sqrt(gx * gx + gz * gz + 1);
        nrm[idx * 3] = -gx * inv;
        nrm[idx * 3 + 1] = inv;
        nrm[idx * 3 + 2] = -gz * inv;
        var slope = Math.sqrt(gx * gx + gz * gz);
        var urban = urbanFn ? urbanFn(pos[idx * 3], pos[idx * 3 + 2]) : 0;
        model.colorInto(pos[idx * 3], pos[idx * 3 + 2], h[idx], slope, urban, _rgbOut);
        col[idx * 3] = _rgbOut.r; col[idx * 3 + 1] = _rgbOut.g; col[idx * 3 + 2] = _rgbOut.b;
      }
    }
    var a = this.geo.attributes;
    a.position.needsUpdate = true;
    a.normal.needsUpdate = true;
    a.color.needsUpdate = true;
    var rad = Math.max(size * 0.72, (maxH - minH) * 0.55 + size * 0.35);
    this.geo.boundingSphere.center.set(cx, (minH + maxH) * 0.5, cz);
    this.geo.boundingSphere.radius = rad;
    this.built = true;
    this.mesh.visible = true;
  };
  var _rgbOut = { r: 0, g: 0, b: 0 };

  function TerrainField(scene, model, quality, seed) {
    this.scene = scene;
    this.model = model;
    this.q = quality;
    this.seed = seed;
    this.group = new THREE.Group();
    this.group.frustumCulled = false;
    scene.add(this.group);
    this.uniforms = {
      uCloudShadow: { value: 0.35 },
      uCloudCover: { value: 0.2 },
      uCloudOff: { value: new THREE.Vector2(0, 0) },
      uHazeColor: { value: new THREE.Color(0.35, 0.42, 0.52) },
      uHazeAmount: { value: 0.25 },
      uHazeScale: { value: 1700 },
      uHazeFar: { value: 18000 }
    };
    this.material = makeTerrainMaterial(this.uniforms);
    this.rings = [];
    this.urbanFn = null;
    this.heightFn = null;          // 由 Environment 注入 (含平整区)
    this.flattenZones = [];
    this.focusI = null;
    this.focusJ = null;
    this.pending = [];
    this.stats = { chunks: 0, built: 0, lastMs: 0 };
    this._buildRings();
  }

  TerrainField.prototype._buildRings = function () {
    var q = this.q, grid = q.grid, half = (grid - 1) / 2;
    var k, i, j, size, verts, seg, vcount;
    for (k = 0; k < q.ringCount; k++) {
      size = q.chunkSizeM * Math.pow(2, k);
      verts = Math.max(3, Math.round((q.ringVert0 - 1) / Math.pow(2, k)) + 1);
      seg = verts - 1;
      vcount = verts * verts;
      // 共享索引缓冲
      var idxArr = vcount > 65535 ? new Uint32Array(seg * seg * 6) : new Uint16Array(seg * seg * 6);
      var p = 0;
      for (j = 0; j < seg; j++) {
        for (i = 0; i < seg; i++) {
          var a = j * verts + i, b = a + 1, c = a + verts, d = c + 1;
          idxArr[p++] = a; idxArr[p++] = c; idxArr[p++] = b;
          idxArr[p++] = b; idxArr[p++] = c; idxArr[p++] = d;
        }
      }
      var indexAttr = new THREE.BufferAttribute(idxArr, 1);
      var ring = { order: k, size: size, verts: verts, seg: seg, index: indexAttr, chunks: [], active: {} };
      for (j = -half; j <= half; j++) {
        for (i = -half; i <= half; i++) {
          // 内圈已由更精细的环覆盖 -> 跳过, 避免重叠
          if (k > 0 && Math.abs(i) <= 1 && Math.abs(j) <= 1) continue;
          ring.chunks.push(new TerrainChunk(this, ring, verts, size));
        }
      }
      this.stats.chunks += ring.chunks.length;
      this.rings.push(ring);
    }
  };

  /**
   * 按焦点更新 LOD
   * @param {number} budgetMs 本帧用于重建的时间预算
   */
  TerrainField.prototype.update = function (fx, fz, budgetMs, warm) {
    var q = this.q;
    var ci = Math.floor(fx / q.chunkSizeM), cj = Math.floor(fz / q.chunkSizeM);
    if (ci !== this.focusI || cj !== this.focusJ || this.dirtyAll) {
      this._retarget(fx, fz, !!this.dirtyAll);
      this.focusI = ci; this.focusJ = cj;
      this.dirtyAll = false;
    }
    this._processPending(fx, fz, warm ? Math.max(budgetMs, q.warmBudgetMs) : budgetMs);
  };

  TerrainField.prototype._retarget = function (fx, fz, force) {
    var grid = this.q.grid, half = (grid - 1) / 2;
    var k, i, j, ring, key;
    for (k = 0; k < this.rings.length; k++) {
      ring = this.rings[k];
      var s = ring.size;
      if (force) {
        // 季节/平整区/城市变化 -> 全部重建
        for (key in ring.active) {
          var c0 = ring.active[key];
          if (c0.built && !c0.queued) {
            c0.built = false; c0.queued = true; c0.mesh.visible = false;
            this.pending.push(c0);
          }
        }
      }
      var fi = Math.floor(fx / s), fj = Math.floor(fz / s);
      var wanted = [], wantMap = {};
      for (j = -half; j <= half; j++) {
        for (i = -half; i <= half; i++) {
          if (k > 0 && Math.abs(i) <= 1 && Math.abs(j) <= 1) continue;
          key = (fi + i) + '|' + (fj + j);
          wanted.push({ key: key, gi: fi + i, gj: fj + j });
          wantMap[key] = true;
        }
      }
      // 保留仍然需要的 chunk
      var active = ring.active;
      var newActive = {};
      for (key in active) {
        if (wantMap[key]) newActive[key] = active[key];
      }
      // 池中未被占用的块即为空闲块
      var freeList = [];
      for (var c = 0; c < ring.chunks.length; c++) {
        var cc = ring.chunks[c];
        if (cc.key !== null && newActive[cc.key] === cc) continue;
        freeList.push(cc);
      }
      // 为新的位置分配 chunk (复用, 不分配新对象)
      var fi2 = 0;
      for (i = 0; i < wanted.length; i++) {
        var w = wanted[i];
        if (newActive[w.key]) continue;
        var ch = freeList[fi2++];
        if (!ch) break;                                  // 池容量与需求一致, 正常不会发生
        ch.key = w.key; ch.gi = w.gi; ch.gj = w.gj;
        ch.built = false;
        ch.mesh.visible = false;
        if (!ch.queued) { ch.queued = true; this.pending.push(ch); }
        newActive[w.key] = ch;
      }
      // 剩余未使用的 chunk 隐藏
      for (i = fi2; i < freeList.length; i++) {
        freeList[i].key = null;
        freeList[i].mesh.visible = false;
      }
      ring.active = newActive;
    }
  };

  /** 待重建 chunk 数 (诊断用) */
  TerrainField.prototype.pendingCount = function () { return this.pending.length; };

  TerrainField.prototype._processPending = function (fx, fz, budgetMs) {
    var t0 = nowMs(), built = 0;
    // 近处优先 —— 只在队列较长时排序, 避免频繁分配
    if (this.pending.length > 8) {
      var self = this;
      this.pending.sort(function (a, b) {
        var da = Math.abs(a.gi * a.size - fx) + Math.abs(a.gj * a.size - fz);
        var db = Math.abs(b.gi * b.size - fx) + Math.abs(b.gj * b.size - fz);
        return da - db;
      });
    }
    while (this.pending.length) {
      var ch = this.pending.shift();
      ch.queued = false;
      if (ch.key === null) continue;
      ch.rebuild();
      built++;
      if (nowMs() - t0 > budgetMs && built >= 1) break;
    }
    this.stats.lastMs = nowMs() - t0;
    this.stats.built = built;
  };

  TerrainField.prototype.markAllDirty = function () {
    this.dirtyAll = true;
  };

  TerrainField.prototype.dispose = function () {
    var k, c;
    for (k = 0; k < this.rings.length; k++) {
      var ring = this.rings[k];
      for (c = 0; c < ring.chunks.length; c++) ring.chunks[c].geo.dispose();
      ring.index = null;
    }
    this.material.dispose();
    if (this.group.parent) this.group.parent.remove(this.group);
  };

  /* =====================================================================
     12. 海面 —— 动画波法线 + 菲涅耳 + 太阳闪光
     ===================================================================== */
  var GLSL_OCEAN_VERT = [
    'varying vec3 vWPos;',
    'uniform float uTime;',
    'uniform vec2 uWind;',
    'void main() {',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  float k1 = 6.2831853 / 210.0;',
    '  float k2 = 6.2831853 / 130.0;',
    '  float h = sin(dot(uWind, wp.xz) * k1 + uTime * 1.35) * 0.42',
    '          + sin(dot(vec2(-uWind.y, uWind.x), wp.xz) * k2 + uTime * 1.05) * 0.26;',
    '  wp.y += h;',
    '  vWPos = wp.xyz;',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}'
  ].join('\n');

  var GLSL_OCEAN_FRAG = [
    'precision highp float;',
    'varying vec3 vWPos;',
    'uniform float uTime;',
    'uniform vec2 uWind;',
    'uniform vec3 uSunDir;',
    'uniform vec3 uSunCol;',
    'uniform vec3 uSkyCol;',
    'uniform vec3 uDeepCol;',
    'uniform vec3 uShallowCol;',
    'uniform vec3 uFogCol;',
    'uniform float uFogDensity;',
    'uniform float uChop;',
    'uniform float uWaveScale;',
    'uniform float uFlash;',
    'void dshWave(vec2 p, vec2 dir, float len, float amp, float t, inout float h, inout vec2 g) {',
    '  float k = 6.2831853 / len;',
    '  float w = sqrt(9.81 * k) * t;',
    '  float ph = dot(dir, p) * k + w;',
    '  h += amp * sin(ph);',
    '  g += dir * (amp * k * cos(ph));',
    '}',
    'void main() {',
    '  vec3 V = normalize(cameraPosition - vWPos);',
    '  float dist = length(cameraPosition - vWPos);',
    '  float detail = exp(-dist * 0.000035);',
    '  float h = 0.0; vec2 g = vec2(0.0);',
    '  vec2 d1 = uWind;',
    '  vec2 d2 = normalize(vec2(uWind.y * 0.55 + uWind.x, -uWind.x * 0.55 + uWind.y) + vec2(1e-4));',
    '  vec2 d3 = normalize(vec2(-uWind.y, uWind.x));',
    '  float amp = uWaveScale * (0.35 + 0.65 * uChop);',
    '  dshWave(vWPos.xz, d1, 41.0, 0.62 * amp, uTime, h, g);',
    '  dshWave(vWPos.xz, d2, 26.0, 0.32 * amp, uTime, h, g);',
    '  dshWave(vWPos.xz, d3, 15.5, 0.16 * amp, uTime, h, g);',
    '  dshWave(vWPos.xz, d1, 8.7, 0.075 * amp * detail, uTime, h, g);',
    '  dshWave(vWPos.xz, d2, 4.9, 0.034 * amp * detail, uTime, h, g);',
    '  dshWave(vWPos.xz, d3, 2.7, 0.016 * amp * detail * detail, uTime, h, g);',
    '  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));',
    '  float ndv = clamp(dot(N, V), 0.0, 1.0);',
    '  float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);',
    '  vec3 R = reflect(-V, N);',
    '  R.y = abs(R.y);',
    '  vec3 refl = mix(uSkyCol, uSunCol, pow(clamp(dot(normalize(R), uSunDir), 0.0, 1.0), 3.0) * 0.35);',
    '  vec3 refr = mix(uDeepCol, uShallowCol, pow(1.0 - ndv, 2.5) * 0.55);',
    '  vec3 col = mix(refr, refl, clamp(fres * 1.15, 0.0, 1.0));',
    '  vec3 H = normalize(V + uSunDir);',
    '  float spec = pow(max(dot(N, H), 0.0), 420.0);',
    '  float glit = pow(max(dot(N, H), 0.0), 40.0) * 0.10;',
    '  col += uSunCol * (spec * 3.4 + glit) * clamp(uSunDir.y * 3.0, 0.0, 1.0);',
    '  col += uFlash * vec3(0.55, 0.62, 0.75);',
    '  float fd = dist * uFogDensity;',
    '  float fogA = clamp(1.0 - exp(-fd * fd), 0.0, 1.0);',
    '  col = mix(col, uFogCol, fogA);',
    '  float alpha = mix(0.72, 0.985, clamp(fres * 1.4, 0.0, 1.0));',
    '  alpha = mix(alpha, 1.0, fogA);',
    '  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));',
    GLSL_OUT,
    '}'
  ].join('\n');

  function Ocean(scene, model, quality, seaLevelM, seed) {
    this.model = model;
    this.sea = finite(seaLevelM, 0);
    this.size = 240000;
    this.verts = quality.oceanVerts + 1;
    this._row = 0;
    this._needRefresh = true;
    this._cx = 1e9; this._cz = 1e9;
    this._step = this.size / (this.verts - 1);
    var v = this.verts, i, j;
    var pos = new Float32Array(v * v * 3);
    var dep = new Float32Array(v * v);
    var idx = new Uint32Array((v - 1) * (v - 1) * 6);
    var half = this.size * 0.5, step = this._step;
    for (j = 0; j < v; j++) {
      for (i = 0; i < v; i++) {
        var o = (j * v + i) * 3;
        pos[o] = -half + i * step; pos[o + 1] = 0; pos[o + 2] = -half + j * step;
      }
    }
    var p = 0;
    for (j = 0; j < v - 1; j++) {
      for (i = 0; i < v - 1; i++) {
        var a = j * v + i, b = a + 1, c = a + v, d = c + 1;
        idx[p++] = a; idx[p++] = c; idx[p++] = b;
        idx[p++] = b; idx[p++] = c; idx[p++] = d;
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aDepth', new THREE.BufferAttribute(dep, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), this.size * 0.75);
    this.depth = dep;
    this.geo = geo;
    this.uniforms = {
      uTime: { value: 0 },
      uWind: { value: new THREE.Vector2(1, 0) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunCol: { value: new THREE.Color(1, 0.96, 0.9) },
      uSkyCol: { value: new THREE.Color(0.35, 0.5, 0.7) },
      uDeepCol: { value: new THREE.Color(0.006, 0.028, 0.055) },
      uShallowCol: { value: new THREE.Color(0.045, 0.155, 0.165) },
      uFogCol: { value: new THREE.Color(0.45, 0.55, 0.7) },
      uFogDensity: { value: 0.00012 },
      uChop: { value: 0.4 },
      uWaveScale: { value: 1.0 },
      uFlash: { value: 0 }
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: GLSL_OCEAN_VERT,
      fragmentShader: GLSL_OCEAN_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -50;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.position.y = this.sea;
    this.mesh.updateMatrix();
    scene.add(this.mesh);
  }

  /** 焦点移动 -> 网格吸附 + 分帧刷新水深属性 (用于近岸透明度) */
  Ocean.prototype.update = function (fx, fz, budgetMs) {
    var step = this._step;
    var nx = Math.round(fx / step) * step, nz = Math.round(fz / step) * step;
    if (nx !== this._cx || nz !== this._cz) {
      this._cx = nx; this._cz = nz;
      this.mesh.position.set(nx, this.sea, nz);
      this.mesh.updateMatrix();
      this._needRefresh = true;
      this._row = 0;
    }
    if (this._needRefresh) {
      var t0 = nowMs(), v = this.verts, sea = this.sea, model = this.model;
      var half = this.size * 0.5, dep = this.depth;
      while (this._row < v) {
        var j = this._row, z = this._cz - half + j * step;
        var row = j * v;
        for (var i = 0; i < v; i++) {
          var x = this._cx - half + i * step;
          var hh = this.heightFn ? this.heightFn(x, z) : model.rawHeight(x, z);
          if (!isFinite(hh)) hh = sea;
          dep[row + i] = hh < sea ? (sea - hh) : 0;
        }
        this._row++;
        if (nowMs() - t0 > budgetMs) break;
      }
      this.geo.attributes.aDepth.needsUpdate = true;
      if (this._row >= v) this._needRefresh = false;
    }
  };

  Ocean.prototype.dispose = function () {
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    this.geo.dispose();
    this.material.dispose();
  };

  /* =====================================================================
     13. 云 —— 实例化广告牌 (InstancedBufferGeometry), 每层一次 draw call
     ===================================================================== */
  var GLSL_CLOUD_VERT = [
    'attribute vec3 iPos;',
    'attribute vec2 iSize;',
    'attribute vec4 iPar;',            // x=旋转 y=图集编号 z=层内高度 0..1 w=随机
    'uniform vec3 uCenter;',
    'uniform vec2 uDrift;',
    'uniform float uRange;',
    'varying vec2 vUv;',
    'varying float vTile;',
    'varying float vFade;',
    'varying vec3 vWPos;',
    'varying float vTop;',
    'varying float vSeed;',
    'void main() {',
    '  vUv = uv;',
    '  vTile = iPar.y;',
    '  vTop = iPar.z;',
    '  vSeed = iPar.w;',
    // 云场随风漂移, 并在以焦点为中心的方环内回绕 (零 CPU 开销)
    '  vec2 rel = iPos.xz + uDrift - uCenter.xz;',
    '  rel = mod(rel + uRange, 2.0 * uRange) - uRange;',
    '  vec3 wp = vec3(uCenter.x + rel.x, iPos.y, uCenter.z + rel.y);',
    '  vec3 cR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);',
    '  vec3 cU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);',
    '  float cs = cos(iPar.x), sn = sin(iPar.x);',
    '  vec2 q = position.xy * iSize;',
    '  vec2 rq = vec2(q.x * cs - q.y * sn, q.x * sn + q.y * cs);',
    '  vec3 world = wp + cR * rq.x + cU * rq.y;',
    '  vec4 mv = viewMatrix * vec4(world, 1.0);',
    '  if (mv.z > -26.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vFade = 0.0; return; }',
    '  float dist = -mv.z;',
    '  vFade = (1.0 - smoothstep(uRange * 0.60, uRange * 0.99, dist)) * smoothstep(30.0, 120.0, dist);',
    '  vWPos = world;',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');

  var GLSL_CLOUD_FRAG = [
    'precision mediump float;',
    'uniform sampler2D uAtlas;',
    'uniform vec2 uGrid;',
    'uniform float uOpacity;',
    'uniform vec3 uLitCol;',
    'uniform vec3 uShadowCol;',
    'uniform vec3 uSunDir;',
    'uniform float uFlash;',
    'varying vec2 vUv;',
    'varying float vTile;',
    'varying float vFade;',
    'varying vec3 vWPos;',
    'varying float vTop;',
    'varying float vSeed;',
    'void main() {',
    '  vec2 tl = vec2(mod(vTile, uGrid.x), floor(vTile / uGrid.x));',
    '  vec2 auv = (vUv + tl) / uGrid;',
    '  float a = texture2D(uAtlas, auv).a;',
    '  vec2 p = vUv - vec2(0.5);',
    '  a *= 1.0 - smoothstep(0.40, 0.74, length(p) * 1.55);',
    '  float aTex = a;',                              // 归一化 alpha, 用于银边
    '  a *= uOpacity * vFade;',
    '  if (a < 0.004) discard;',
    '  vec3 V = normalize(vWPos - cameraPosition);',
    '  float sunAlign = dot(V, uSunDir);',            // >0 = 逆光 (朝着太阳看)
    '  float front = smoothstep(-0.62, 0.80, -sunAlign);',  // 1 = 顺光
    '  float topL = mix(0.40, 1.06, vTop);',
    '  float lit = clamp(front * topL, 0.0, 1.0);',
    '  vec3 col = mix(uShadowCol, uLitCol, lit);',
    '  col *= 0.80 + 0.40 * vSeed;',
    '  col += uFlash * 0.30;',
    '  float rim = clamp(aTex * (1.0 - aTex) * 4.0, 0.0, 1.0);',
    '  col += uLitCol * rim * (1.0 - front) * 0.85;',     // 逆光银边
    '  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));',
    GLSL_OUT,
    '}'
  ].join('\n');

  function CloudLayerMesh(scene, capacity, atlas, atlasGrid, seed, salt) {
    this.capacity = capacity;
    this.count = 0;
    this.range = 60000;
    this.drift = new THREE.Vector2(0, 0);
    this.time = 0;
    var quad = new THREE.InstancedBufferGeometry();
    quad.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
    quad.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
    quad.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1));
    this.iPos = new Float32Array(capacity * 3);
    this.iSize = new Float32Array(capacity * 2);
    this.iPar = new Float32Array(capacity * 4);
    this.aPos = new THREE.InstancedBufferAttribute(this.iPos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.InstancedBufferAttribute(this.iSize, 2).setUsage(THREE.DynamicDrawUsage);
    this.aPar = new THREE.InstancedBufferAttribute(this.iPar, 4).setUsage(THREE.DynamicDrawUsage);
    quad.setAttribute('iPos', this.aPos);
    quad.setAttribute('iSize', this.aSize);
    quad.setAttribute('iPar', this.aPar);
    quad.instanceCount = 0;
    quad.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e7);
    this.geo = quad;
    this.uniforms = {
      uCenter: { value: new THREE.Vector3() },
      uDrift: { value: this.drift },
      uRange: { value: 60000 },
      uAtlas: { value: atlas },
      uGrid: { value: new THREE.Vector2(atlasGrid, 2) },
      uOpacity: { value: 0 },
      uLitCol: { value: new THREE.Color(1, 0.99, 0.96) },
      uShadowCol: { value: new THREE.Color(0.30, 0.34, 0.42) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uFlash: { value: 0 }
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: GLSL_CLOUD_VERT,
      fragmentShader: GLSL_CLOUD_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      fog: false,
      side: THREE.DoubleSide
    });
    this.mesh = new THREE.Mesh(quad, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
    this.mesh.matrixAutoUpdate = false;
    this.seed = seed + salt;
    scene.add(this.mesh);
  }

  /**
   * 按天气层参数重新撒云 (仅在天气变化时调用, 运行时不分配新对象)
   * @param {object} spec {cover, baseFt, topFt, type}
   * @param {number} rangeM 云场半径
   * @param {Function} groundHeight 地形高度查询 (AGL -> MSL)
   */
  CloudLayerMesh.prototype.generate = function (spec, maxRangeM, groundHeight, cx, cz) {
    var cap = this.capacity;
    var cover = clamp01(spec.cover);
    var n = Math.round(cap * clamp01(cover * 1.06));
    if (n < 4) n = 0;
    if (n > cap) n = cap;
    var rnd = FS.Rng.mulberry32((this.seed + Math.round(cover * 1000)) >>> 0);
    var baseM = Math.max(60, spec.baseFt * FT);
    var topM = Math.max(baseM + 120, spec.topFt * FT);
    var type = spec.type || 'cumulus';
    var flat = 1.0, tall = 1.0, baseSize = 620, clusterR = 0.05;
    if (type === 'stratus') { flat = 2.2; tall = 0.40; baseSize = 1400; clusterR = 0.10; }
    else if (type === 'cirrus') { flat = 2.8; tall = 0.20; baseSize = 2000; clusterR = 0.12; }
    else if (type === 'cumulonimbus') { flat = 1.20; tall = 2.3; baseSize = 950; clusterR = 0.04; }
    else if (type === 'cumulus') { flat = 1.5; tall = 0.78; baseSize = 640; clusterR = 0.05; }
    // 视野范围与云底高度相关: 高云需要更远才看得全
    var rangeM = clamp(baseM * 24 + 16000, 22000, maxRangeM);
    this.range = rangeM;
    this.uniforms.uRange.value = rangeM;
    // 尺寸随云量增大, 高云量层连成一片
    var sizeScale = 0.75 + 0.85 * cover;
    var ox = finite(cx, 0), oz = finite(cz, 0);
    // 云团簇: 每簇 5 个 puff 组成一朵云
    var clusterCount = Math.max(4, Math.round(n / 5));
    var clx = [], clz = [], clr = [];
    var i;
    for (i = 0; i < clusterCount; i++) {
      clx.push((rnd() * 2 - 1) * rangeM * 0.97);
      clz.push((rnd() * 2 - 1) * rangeM * 0.97);
      clr.push(rangeM * (clusterR * 0.35 + rnd() * clusterR));
    }
    for (i = 0; i < n; i++) {
      var ci = Math.floor(rnd() * clusterCount);
      var ang = rnd() * 2 * PI;
      var rr = Math.sqrt(rnd()) * clr[ci];
      var px = clx[ci] + Math.cos(ang) * rr;
      var pz = clz[ci] + Math.sin(ang) * rr;
      // 层内高度: 中间偏下更密 (积云底部平, 顶部碎)
      var tn = clamp01((rnd() + rnd()) * 0.5);
      tn = Math.pow(tn, 0.85);
      var py = baseM + (topM - baseM) * tn;
      // AGL -> MSL: 让云不要插进山体
      if (groundHeight) {
        var gh = groundHeight(px + ox, pz + oz);
        if (isFinite(gh) && gh > 20) py += Math.min(gh, 5600);
      }
      var sz = baseSize * (0.55 + rnd() * 0.9) * sizeScale;
      this.iPos[i * 3] = px + ox; this.iPos[i * 3 + 1] = py; this.iPos[i * 3 + 2] = pz + oz;
      this.iSize[i * 2] = sz * flat;
      this.iSize[i * 2 + 1] = sz * tall * (0.8 + rnd() * 0.5);
      this.iPar[i * 4] = rnd() * 2 * PI;
      this.iPar[i * 4 + 1] = Math.floor(rnd() * 8);
      this.iPar[i * 4 + 2] = clamp01(tn * (type === 'cumulonimbus' ? 1.3 : 1.0));
      this.iPar[i * 4 + 3] = 0.55 + rnd() * 0.45;
    }
    this.count = n;
    this.geo.instanceCount = n;
    this.aPos.needsUpdate = true;
    this.aSize.needsUpdate = true;
    this.aPar.needsUpdate = true;
  };

  CloudLayerMesh.prototype.setVisible = function (on) {
    this.mesh.visible = !!on && this.count > 0;
  };

  CloudLayerMesh.prototype.dispose = function () {
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    this.geo.dispose();
    this.material.dispose();
  };

  /* =====================================================================
     14. 降水 (雨/雪) —— 跟随焦点的粒子盒, 循环回绕
     ===================================================================== */
  var GLSL_FLAKE_FRAG = [
    'precision mediump float;',
    'uniform vec3 uColor;',
    'varying float vA;',
    'void main() {',
    '  vec2 q = gl_PointCoord - vec2(0.5);',
    '  float r = length(q) * 2.0;',
    '  float a = (1.0 - smoothstep(0.25, 1.0, r)) * vA;',
    '  if (a < 0.01) discard;',
    '  gl_FragColor = vec4(uColor, clamp(a, 0.0, 1.0));',
    GLSL_OUT,
    '}'
  ].join('\n');

  function Precipitation(scene, quality, seed) {
    this.q = quality;
    this.seed = seed;
    this.group = new THREE.Group();
    this.group.frustumCulled = false;
    scene.add(this.group);
    this.box = { x: 260, y: 170, z: 260 };
    this.time = 0;
    this.altFade = 1;
    this.intensity = 0;
    var rnd = FS.Rng.mulberry32((seed + 4242) >>> 0);
    var i;

    // ---- 雨: 线段 ----
    this.rainMax = quality.rainMax;
    this.rainPos = new Float32Array(this.rainMax * 3);
    this.rainVel = new Float32Array(this.rainMax * 3);
    this.rainBuf = new Float32Array(this.rainMax * 6);
    for (i = 0; i < this.rainMax; i++) {
      this.rainPos[i * 3] = (rnd() * 2 - 1) * this.box.x;
      this.rainPos[i * 3 + 1] = (rnd() * 2 - 1) * this.box.y;
      this.rainPos[i * 3 + 2] = (rnd() * 2 - 1) * this.box.z;
      this.rainVel[i * 3] = 0;
      this.rainVel[i * 3 + 1] = -(8.0 + rnd() * 5.0);
      this.rainVel[i * 3 + 2] = 0;
    }
    var rgeo = new THREE.BufferGeometry();
    rgeo.setAttribute('position', new THREE.BufferAttribute(this.rainBuf, 3).setUsage(THREE.DynamicDrawUsage));
    rgeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 500);
    this.rainGeo = rgeo;
    this.rainMat = new THREE.LineBasicMaterial({
      color: 0x9fb4c8, transparent: true, opacity: 0.32, depthWrite: false, fog: false
    });
    this.rain = new THREE.LineSegments(rgeo, this.rainMat);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.group.add(this.rain);

    // ---- 雪: 点 ----
    this.snowMax = quality.snowMax;
    this.snowPos = new Float32Array(this.snowMax * 3);
    this.snowPhase = new Float32Array(this.snowMax);
    this.snowBuf = new Float32Array(this.snowMax * 3);
    this.snowAlpha = new Float32Array(this.snowMax);
    for (i = 0; i < this.snowMax; i++) {
      this.snowPos[i * 3] = (rnd() * 2 - 1) * this.box.x;
      this.snowPos[i * 3 + 1] = (rnd() * 2 - 1) * this.box.y;
      this.snowPos[i * 3 + 2] = (rnd() * 2 - 1) * this.box.z;
      this.snowPhase[i] = rnd() * 6.283;
      this.snowAlpha[i] = 0.4 + rnd() * 0.6;
    }
    var sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute('position', new THREE.BufferAttribute(this.snowBuf, 3).setUsage(THREE.DynamicDrawUsage));
    sgeo.setAttribute('aA', new THREE.BufferAttribute(this.snowAlpha, 1));
    sgeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 500);
    this.snowGeo = sgeo;
    this.snowUniforms = {
      uColor: { value: new THREE.Color(0.95, 0.96, 1.0) },
      uSize: { value: 2.4 },
      uPR: { value: 1 },
      uGlobal: { value: 0 }
    };
    this.snowMat = new THREE.ShaderMaterial({
      uniforms: this.snowUniforms,
      vertexShader: [
        'attribute float aA;',
        'uniform float uSize;',
        'uniform float uPR;',
        'uniform float uGlobal;',
        'varying float vA;',
        'void main() {',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  gl_Position = projectionMatrix * mv;',
        '  float d = max(-mv.z, 1.0);',
        '  gl_PointSize = clamp(uSize * uPR * (140.0 / d), 1.0, 22.0);',
        '  vA = aA * uGlobal * clamp(1.0 - d / 320.0, 0.0, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: GLSL_FLAKE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      fog: false
    });
    this.snow = new THREE.Points(sgeo, this.snowMat);
    this.snow.frustumCulled = false;
    this.snow.visible = false;
    this.group.add(this.snow);

    this.activeRain = 0;
    this.activeSnow = 0;
    this.rnd = FS.Rng.mulberry32((seed + 9182) >>> 0);   // 确定性随机源
  }

  /**
   * @param {number} dt
   * @param {object} focus {x,y,z}
   * @param {object} wind 当前风 (含阵风)
   * @param {number} altFade 高度衰减 (飞到云顶以上时降水消失)
   */
  Precipitation.prototype.update = function (dt, focus, wind, altFade, rainI, snowI, pr) {
    if (dt <= 0) dt = 0.016;
    if (dt > 0.25) dt = 0.25;
    this.time += dt;
    this.group.position.set(focus.x, focus.y, focus.z);
    this.altFade = altFade;
    var wx = Math.sin((wind.dirDeg + 180) * DEG), wz = -Math.cos((wind.dirDeg + 180) * DEG);
    var wspd = (wind.speedKt + wind.gustKt * 0.35) * (C.KT || 0.514444);
    var box = this.box, i, p, stride;
    var vis = altFade > 0.02;

    // ---------- 雨 ----------
    if (rainI > 0.01 && vis) {
      var rn = Math.min(this.rainMax, Math.max(16, Math.round(this.rainMax * clamp01(rainI))));
      if (rn !== this.activeRain) this.activeRain = rn;
      var streak = (3.5 + 13 * clamp01(rainI));
      var vx = wx * wspd * 0.28, vz = wz * wspd * 0.28;
      var buf = this.rainBuf, rp = this.rainPos, rv = this.rainVel;
      for (i = 0; i < rn; i++) {
        var o = i * 3;
        rp[o] += (rv[o] + vx) * dt;
        rp[o + 1] += rv[o + 1] * dt;
        rp[o + 2] += (rv[o + 2] + vz) * dt;
        if (rp[o + 1] < -box.y) { rp[o + 1] += box.y * 2; rp[o] = (this.rnd() * 2 - 1) * box.x; rp[o + 2] = (this.rnd() * 2 - 1) * box.z; }
        if (rp[o] > box.x) rp[o] -= box.x * 2; else if (rp[o] < -box.x) rp[o] += box.x * 2;
        if (rp[o + 2] > box.z) rp[o + 2] -= box.z * 2; else if (rp[o + 2] < -box.z) rp[o + 2] += box.z * 2;
        var o6 = i * 6;
        var f = streak / Math.max(1e-3, Math.abs(rv[o + 1]));
        buf[o6] = rp[o]; buf[o6 + 1] = rp[o + 1]; buf[o6 + 2] = rp[o + 2];
        buf[o6 + 3] = rp[o] - (rv[o] + vx) * f;
        buf[o6 + 4] = rp[o + 1] - rv[o + 1] * f;
        buf[o6 + 5] = rp[o + 2] - (rv[o + 2] + vz) * f;
      }
      this.rainGeo.setDrawRange(0, rn * 2);
      this.rainGeo.attributes.position.needsUpdate = true;
      this.rainMat.opacity = 0.10 + 0.30 * clamp01(rainI) * altFade;
      this.rain.visible = true;
    } else {
      this.rain.visible = false;
    }

    // ---------- 雪 ----------
    if (snowI > 0.01 && vis) {
      var sn = Math.min(this.snowMax, Math.max(16, Math.round(this.snowMax * clamp01(snowI))));
      this.activeSnow = sn;
      var sb = this.snowBuf, sp = this.snowPos, ph = this.snowPhase;
      var fall = 1.1 + 1.4 * clamp01(snowI);
      for (i = 0; i < sn; i++) {
        var o3 = i * 3;
        var wob = Math.sin(this.time * 1.6 + ph[i]) * 0.9 + Math.sin(this.time * 0.7 + ph[i] * 2.3) * 0.5;
        sp[o3] += (vx * 0.75 + wob) * dt;
        sp[o3 + 1] -= fall * dt;
        sp[o3 + 2] += (vz * 0.75 + wob * 0.5) * dt;
        if (sp[o3 + 1] < -box.y) { sp[o3 + 1] += box.y * 2; sp[o3] = (this.rnd() * 2 - 1) * box.x; sp[o3 + 2] = (this.rnd() * 2 - 1) * box.z; }
        if (sp[o3] > box.x) sp[o3] -= box.x * 2; else if (sp[o3] < -box.x) sp[o3] += box.x * 2;
        if (sp[o3 + 2] > box.z) sp[o3 + 2] -= box.z * 2; else if (sp[o3 + 2] < -box.z) sp[o3 + 2] += box.z * 2;
        sb[o3] = sp[o3]; sb[o3 + 1] = sp[o3 + 1]; sb[o3 + 2] = sp[o3 + 2];
      }
      this.snowGeo.setDrawRange(0, sn);
      this.snowGeo.attributes.position.needsUpdate = true;
      this.snowUniforms.uGlobal.value = altFade * (0.35 + 0.65 * clamp01(snowI));
      if (pr) this.snowUniforms.uPR.value = pr;
      this.snow.visible = true;
    } else {
      this.snow.visible = false;
    }
  };

  Precipitation.prototype.dispose = function () {
    if (this.group.parent) this.group.parent.remove(this.group);
    this.rainGeo.dispose(); this.rainMat.dispose();
    this.snowGeo.dispose(); this.snowMat.dispose();
  };

  /* =====================================================================
     15. 尾迹 (拉烟/翼尖涡) —— 池化带状四边形
     ===================================================================== */
  var GLSL_TRAIL_VERT = [
    'attribute float aBirth;',
    'attribute float aStrength;',
    'uniform float uTime;',
    'uniform float uLife;',
    'varying float vA;',
    'void main() {',
    '  float age = uTime - aBirth;',
    '  vA = aStrength * clamp(1.0 - age / uLife, 0.0, 1.0) * smoothstep(0.0, 0.7, age);',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  var GLSL_TRAIL_FRAG = [
    'precision mediump float;',
    'uniform vec3 uColor;',
    'varying float vA;',
    'void main() {',
    '  if (vA < 0.004) discard;',
    '  gl_FragColor = vec4(uColor, vA * 0.62);',
    GLSL_OUT,
    '}'
  ].join('\n');

  function Contrails(scene, maxSegs, seed) {
    this.maxSegs = maxSegs;
    this.head = 0;
    this.time = 0;
    this.lastX = 0; this.lastY = 0; this.lastZ = 0;
    this.hasLast = false;
    this.minStep = 7;
    var n = maxSegs * 6;
    this.pos = new Float32Array(n * 3);
    this.birth = new Float32Array(n);
    this.strength = new Float32Array(n);
    for (var i = 0; i < n; i++) this.birth[i] = -1e6;
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aBirth', new THREE.BufferAttribute(this.birth, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aStrength', new THREE.BufferAttribute(this.strength, 1).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.geo = geo;
    this.uniforms = {
      uTime: { value: 0 },
      uLife: { value: 55 },
      uColor: { value: new THREE.Color(0.92, 0.94, 0.98) }
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: GLSL_TRAIL_VERT,
      fragmentShader: GLSL_TRAIL_FRAG,
      transparent: true,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 18;
    this.mesh.matrixAutoUpdate = false;
    scene.add(this.mesh);
    this.source = null;
  }

  var _trailScratch = new Float32Array(18);

  /** 追加一段尾迹 (世界坐标) */
  Contrails.prototype.add = function (x, y, z, strength) {
    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return;
    strength = clamp01(finite(strength, 0.6));
    if (strength <= 0.02) { this.hasLast = false; return; }
    if (!this.hasLast) {
      this.lastX = x; this.lastY = y; this.lastZ = z; this.hasLast = true;
      return;
    }
    var dx = x - this.lastX, dy = y - this.lastY, dz = z - this.lastZ;
    var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < this.minStep) return;
    if (d > 400) { this.lastX = x; this.lastY = y; this.lastZ = z; return; }
    var ix = dx / d, iy = dy / d, iz = dz / d;
    // 侧向量: 与"上"叉乘 (接近垂直时换一个参考轴)
    var ux = 0, uy = 1, uz = 0;
    if (Math.abs(iy) > 0.94) { ux = 1; uy = 0; uz = 0; }
    var sx = iy * uz - iz * uy, sy = iz * ux - ix * uz, sz = ix * uy - iy * ux;
    var sl = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
    var w = 1.6 + 1.8 * strength;
    sx = sx / sl * w; sy = sy / sl * w; sz = sz / sl * w;
    // 四边形 (两个三角形): A=起点+侧, C=终点+侧, B=起点-侧, B, C, D=终点-侧
    var q = _trailScratch;
    q[0] = this.lastX + sx; q[1] = this.lastY + sy; q[2] = this.lastZ + sz;
    q[3] = x + sx; q[4] = y + sy; q[5] = z + sz;
    q[6] = this.lastX - sx; q[7] = this.lastY - sy; q[8] = this.lastZ - sz;
    q[9] = this.lastX - sx; q[10] = this.lastY - sy; q[11] = this.lastZ - sz;
    q[12] = x + sx; q[13] = y + sy; q[14] = z + sz;
    q[15] = x - sx; q[16] = y - sy; q[17] = z - sz;
    var seg = this.head;
    var base = seg * 6;
    for (var i = 0; i < 18; i++) this.pos[base * 3 + i] = q[i];
    for (i = 0; i < 6; i++) {
      this.birth[base + i] = this.time;
      this.strength[base + i] = strength;
    }
    this.head = (this.head + 1) % this.maxSegs;
    this.lastX = x; this.lastY = y; this.lastZ = z;
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aBirth.needsUpdate = true;
    this.geo.attributes.aStrength.needsUpdate = true;
  };

  Contrails.prototype.update = function (dt) {
    this.time += dt;
    this.uniforms.uTime.value = this.time;
    if (this.source) {
      var p = null;
      try { p = this.source(); } catch (err) { p = null; }
      if (p) this.add(p.x, p.y, p.z, p.strength !== undefined ? p.strength : 0.7);
    }
  };

  Contrails.prototype.clear = function () {
    for (var i = 0; i < this.birth.length; i++) this.birth[i] = -1e6;
    this.geo.attributes.aBirth.needsUpdate = true;
    this.hasLast = false;
  };

  Contrails.prototype.dispose = function () {
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    this.geo.dispose();
    this.material.dispose();
  };

  /* =====================================================================
     16. 灯光点云着色器 (城市灯光 / 机场灯光共用)
     ===================================================================== */
  var GLSL_LIGHT_VERT = [
    'attribute vec3 aColor;',
    'attribute float aSize;',
    'uniform float uPR;',
    'uniform float uNight;',
    'uniform float uScale;',
    'uniform float uFar;',
    'varying vec3 vCol;',
    'varying float vA;',
    'void main() {',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  float d = max(-mv.z, 1.0);',
    '  gl_PointSize = clamp(aSize * uPR * (uScale / d) + 2.0, 2.0, 30.0);',
    '  vCol = aColor;',
    '  vA = uNight * clamp(1.0 - d / uFar, 0.0, 1.0);',
    '}'
  ].join('\n');

  var GLSL_LIGHT_FRAG = [
    'precision mediump float;',
    'varying vec3 vCol;',
    'varying float vA;',
    'void main() {',
    '  vec2 q = gl_PointCoord - vec2(0.5);',
    '  float r = length(q) * 2.0;',
    '  float a = (1.0 - smoothstep(0.42, 1.02, r)) * vA;',   // 实心核心 + 柔边
    '  if (a < 0.004) discard;',
    '  gl_FragColor = vec4(vCol, clamp(a, 0.0, 1.0));',
    GLSL_OUT,
    '}'
  ].join('\n');

  function makeLightMaterial(nightUniform, far) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uPR: { value: 1 },
        uNight: nightUniform,
        uScale: { value: 420 },
        uFar: { value: far || 60000 }
      },
      vertexShader: GLSL_LIGHT_VERT,
      fragmentShader: GLSL_LIGHT_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      fog: false
    });
  }

  /* =====================================================================
     17. 城市索引 (供地表着色与灯光使用)
     ===================================================================== */
  function CityIndex(cell) {
    this.cell = cell;
    this.map = {};
    this.list = [];
  }
  CityIndex.prototype.add = function (x, z, r, b) {
    var c = { x: x, z: z, r: r, b: b };
    this.list.push(c);
    var i0 = Math.floor((x - r) / this.cell), i1 = Math.floor((x + r) / this.cell);
    var j0 = Math.floor((z - r) / this.cell), j1 = Math.floor((z + r) / this.cell);
    for (var i = i0; i <= i1; i++) {
      for (var j = j0; j <= j1; j++) {
        var k = i + '|' + j;
        var a = this.map[k] || (this.map[k] = []);
        a.push(c);
      }
    }
  };
  /** 城市影响因子 0..1 (热路径: 尽量少算) */
  CityIndex.prototype.factor = function (x, z) {
    var k = Math.floor(x / this.cell) + '|' + Math.floor(z / this.cell);
    var arr = this.map[k];
    if (!arr || !arr.length) return 0;
    var best = 0;
    for (var i = 0; i < arr.length; i++) {
      var c = arr[i];
      var dx = x - c.x, dz = z - c.z;
      var core = c.r * 0.62;
      // 用廉价噪声让城市边缘不规则
      var wob = (Noise.value2(x * 0.00021, z * 0.00021, 911) - 0.5) * c.r * 0.5;
      var d = Math.sqrt(dx * dx + dz * dz) - wob;
      var f = (1 - smoothstep((d - core) / Math.max(1, c.r * 0.5))) * (0.35 + 0.65 * clamp01(c.b));
      if (f > best) best = f;
      if (best > 0.99) break;
    }
    return clamp01(best);
  };

  /* =====================================================================
     18. 机场灯光 (跑道边灯 / 入口灯 / PAPI / 滑行道 / 进近灯 / 旋转信标)
     ===================================================================== */
  var LIGHT_CAP = 1800;

  function AirportLightSet(scene, icao, seed) {
    this.icao = icao;
    this.capacity = LIGHT_CAP;
    this.count = 0;
    this.pos = new Float32Array(LIGHT_CAP * 3);
    this.col = new Float32Array(LIGHT_CAP * 3);
    this.size = new Float32Array(LIGHT_CAP);
    this.papiUnits = [];              // 每条跑道一组 PAPI
    this.beaconIdx = -1;
    this.beaconPhase = 0;
    this.seed = seed;
    this.night = { value: 0 };
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.geo = geo;
    this.material = makeLightMaterial(this.night, 45000);
    this.material.uniforms.uScale.value = 900;
    this.mesh = new THREE.Points(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 15;
    this.mesh.matrixAutoUpdate = false;
    scene.add(this.mesh);
  }

  AirportLightSet.prototype.push = function (x, y, z, r, g, b, s) {
    if (this.count >= this.capacity) return -1;
    var i = this.count++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    this.size[i] = s;
    return i;
  };

  AirportLightSet.prototype.finalize = function () {
    this.geo.setDrawRange(0, this.count);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  };

  AirportLightSet.prototype.setPointColor = function (i, r, g, b) {
    if (i < 0 || i >= this.count) return;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
  };

  /** 旋转信标: 白/绿交替闪烁 */
  AirportLightSet.prototype.updateBeacon = function (dt, night) {
    if (this.beaconIdx < 0) return;
    this.beaconPhase += dt;
    var period = 2.4;
    var t = this.beaconPhase % period;
    var flash = Math.exp(-t * 6.0) + Math.exp(-Math.abs(t - 0.85) * 7.0) * 0.7;
    var white = (Math.floor(this.beaconPhase / period) % 2) === 0;
    var k = clamp01(flash) * (0.15 + 0.85 * night);
    this.setPointColor(this.beaconIdx, white ? k : 0.10 * k, k, white ? 0.95 * k : 0.22 * k);
    this.geo.attributes.aColor.needsUpdate = true;
  };

  /**
   * PAPI: 4 个灯箱, 高于对应角度显示白色, 低于显示红色。
   * 标称下滑道上呈 2 白 2 红。
   */
  AirportLightSet.prototype.updatePapi = function (ax, ay, az) {
    var n = this.papiUnits.length;
    if (!n) return;
    var changed = false;
    var angles = [3.35, 3.12, 2.88, 2.65];
    for (var u = 0; u < n; u++) {
      var unit = this.papiUnits[u];
      var dx = ax - unit.x, dz = az - unit.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 22000) continue;
      // 必须从 PAPI 前方进场才有意义
      var elev = Math.atan2(ay - unit.y, Math.max(dist, 1)) * RAD;
      var code = 0, i;
      for (i = 0; i < 4; i++) code += (elev > angles[i] ? 1 : 0) << i;
      if (code === unit.last) continue;
      unit.last = code;
      for (i = 0; i < 4; i++) {
        if ((code >> i) & 1) this.setPointColor(unit.idx[i], 1.0, 0.98, 0.95);
        else this.setPointColor(unit.idx[i], 1.0, 0.06, 0.04);
      }
      changed = true;
    }
    if (changed) this.geo.attributes.aColor.needsUpdate = true;
  };

  AirportLightSet.prototype.dispose = function () {
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    this.geo.dispose();
    this.material.dispose();
  };

  /* =====================================================================
     19. 天气工具
     ===================================================================== */
  function copyWeather(w) {
    var o = {}, k;
    for (k in w) { if (Object.prototype.hasOwnProperty.call(w, k) && k !== 'cloudLayers') o[k] = w[k]; }
    o.cloudLayers = [];
    var L = w.cloudLayers || [];
    for (var i = 0; i < L.length; i++) {
      o.cloudLayers.push({
        cover: L[i].cover, baseFt: L[i].baseFt, topFt: L[i].topFt, type: L[i].type || 'cumulus'
      });
    }
    return o;
  }

  /** 由云层推导云量/云底 (ceiling) */
  function deriveWeather(w) {
    var L = w.cloudLayers || [];
    if (L.length) {
      var maxCover = 0, lowestBkn = null, lowestAny = null;
      for (var i = 0; i < L.length; i++) {
        var c = clamp01(finite(L[i].cover, 0));
        if (c > maxCover) maxCover = c;
        if (c >= 0.5 && (lowestBkn === null || L[i].baseFt < lowestBkn)) lowestBkn = L[i].baseFt;
        if (c >= 0.25 && (lowestAny === null || L[i].baseFt < lowestAny)) lowestAny = L[i].baseFt;
      }
      if (w._coverExplicit !== true) w.cloudCover = clamp01(Math.max(maxCover * 0.92 + 0.06, 0));
      w.cloudBaseFt = L[0].baseFt;
      w.cloudTopFt = L[L.length - 1].topFt;
      if (w.ceilingFt === null || w.ceilingFt === undefined) {
        w.ceilingFt = lowestBkn !== null ? lowestBkn : lowestAny;
      }
    } else {
      w.ceilingFt = null;
    }
    w.visibilityM = clamp(finite(w.visibilityM, 15000), 60, 120000);
    w.rain = clamp01(finite(w.rain, 0));
    w.snow = clamp01(finite(w.snow, 0));
    w.fog = clamp01(finite(w.fog, 0));
    w.haze = clamp01(finite(w.haze, 0));
    w.turbulence = clamp01(finite(w.turbulence, 0));
    w.cloudCover = clamp01(finite(w.cloudCover, 0));
    w.windSpeedKt = clamp(finite(w.windSpeedKt, 0), 0, 220);
    w.gustKt = clamp(finite(w.gustKt, w.windSpeedKt), w.windSpeedKt, 260);
    w.windDirDeg = U.wrap360(finite(w.windDirDeg, 270));
    return w;
  }

  function presetWeather(name) {
    var key = String(name || 'clear').toLowerCase();
    var spec = PRESET_SPECS[key] || PRESET_SPECS['clear'];
    return copyWeather(deriveWeather(copyWeather(spec)));
  }

  /* =====================================================================
     20. 环境系统主体
     ===================================================================== */
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.WebGLRenderer} renderer  可为 null (无渲染器/无头测试)
   * @param {object} [opts] { seed, shadows, quality, seaLevelM }
   */
  function Environment(scene, renderer, opts) {
    opts = opts || {};
    if (!scene || !scene.isScene) scene = new THREE.Scene();
    this.scene = scene;
    this.renderer = renderer || null;
    this.opts = opts;
    this.seed = ((finite(opts.seed, 20240501) >>> 0) || 1);
    this.quality = QUALITY[opts.quality] ? opts.quality : 'medium';
    this.q = QUALITY[this.quality];
    this.useShadows = opts.shadows !== false && this.q.shadows !== false;
    this.seaLevelM = finite(opts.seaLevelM, 0);

    // ---- 时间 / 日期 ----
    this.timeHours = 9.0;
    this.month = 3;
    this.day = 21;
    this._time = 0;

    // ---- 太阳 / 月亮 ----
    this.sunDirection = new THREE.Vector3(0, 0.5, 0.8).normalize();
    this.moonDirection = new THREE.Vector3(0, -0.5, -0.8).normalize();
    this._moon = { dir: { x: 0, y: -1, z: 0 }, phase: 0.5, elevDeg: -90 };
    this._sunElevDeg = 30;
    this._dayFactor = 1;
    this._lightDir = new THREE.Vector3(0, 1, 0);
    this._moonLight = false;

    // ---- 天气 ----
    this.weather = deriveWeather(copyWeather(DEFAULT_WEATHER));
    this._precipType = 'none';
    this._precipIntensity = 0;
    this._fillFactor = 1;         // 外部半球光/环境光存在时, 本模块环境补光的缩放
    this._fillWarned = false;
    this._fillCheck = 0;
    this._flash = 0;
    this._flashTimer = 0;
    this._flashSeq = [];
    this._flashAge = 0;
    this._lightningTimer = 8;

    // ---- 焦点 ----
    this.focus = { x: 0, y: 2000, z: 0 };
    this._focusSet = false;
    this._warmFrames = 0;

    // ---- 平整区 / 城市 / 机场 ----
    this._flatten = [];
    this._flattenCap = 400;
    this.cityIndex = new CityIndex(8000);
    this._cities = [];
    this._cityDirty = true;
    this._cityPoints = null;
    this._airports = [];
    this._airportMap = {};
    this._airportEnabled = true;

    // ---- 世界对象 ----
    this.model = new TerrainModel(this.seed, this.seaLevelM);
    this.model.setSeason(this.month, Geo.refLat);

    this.sky = new Sky(scene, this.seed, this.q);
    this.terrain = new TerrainField(scene, this.model, this.q, this.seed);
    var self = this;
    this.terrain.urbanFn = function (x, z) { return self.cityIndex.factor(x, z); };
    // 云的 AGL -> MSL 探针
    this._groundProbe = function (px, pz) {
      var hh = self._meshHeight(px, pz);
      return hh > 0 ? hh : 0;
    };
    // 渲染网格高度 = 碰撞高度 (含机场平整区, 但不截断海床, 保证水下地形可见)
    this.terrain.heightFn = function (px, pz) {
      return self._meshHeight(px, pz);
    };
    this.ocean = new Ocean(scene, this.model, this.q, this.seaLevelM, this.seed);
    this._heightProvider = null;
    this._terrainSuspended = false;
    this.ocean.heightFn = function (px, pz) { return self._meshHeight(px, pz); };
    this.atlas = buildPuffAtlas(this.seed);
    this.cloudLayers = [];
    for (var ci = 0; ci < 3; ci++) {
      this.cloudLayers.push(new CloudLayerMesh(scene, this.q.puffsPerLayer, this.atlas, 4, this.seed, ci * 977));
    }
    this.precip = new Precipitation(scene, this.q, this.seed);
    this.contrails = new Contrails(scene, this.q.contrailSegs, this.seed);

    // ---- 灯光 ----
    this._cityNight = { value: 0 };
    this._cityGeo = new THREE.BufferGeometry();
    this._cityPos = new Float32Array(this.q.cityLights * 3);
    this._cityCol = new Float32Array(this.q.cityLights * 3);
    this._citySize = new Float32Array(this.q.cityLights);
    this._cityGeo.setAttribute('position', new THREE.BufferAttribute(this._cityPos, 3).setUsage(THREE.DynamicDrawUsage));
    this._cityGeo.setAttribute('aColor', new THREE.BufferAttribute(this._cityCol, 3).setUsage(THREE.DynamicDrawUsage));
    this._cityGeo.setAttribute('aSize', new THREE.BufferAttribute(this._citySize, 1).setUsage(THREE.DynamicDrawUsage));
    this._cityGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this._cityGeo.setDrawRange(0, 0);
    this._cityMat = makeLightMaterial(this._cityNight, 70000);
    this._cityMat.uniforms.uScale.value = 520;
    this._cityPoints = new THREE.Points(this._cityGeo, this._cityMat);
    this._cityPoints.frustumCulled = false;
    this._cityPoints.renderOrder = 14;
    this._cityPoints.matrixAutoUpdate = false;
    scene.add(this._cityPoints);

    // ---- 光照 ----
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.sunLight.castShadow = this.useShadows;
    var sr = this.q.shadowRadius;
    var sc = this.sunLight.shadow.camera;
    sc.left = -sr; sc.right = sr; sc.top = sr; sc.bottom = -sr;
    sc.near = 10; sc.far = sr * 2.6 + 4000;
    if (sc.updateProjectionMatrix) sc.updateProjectionMatrix();
    this.sunLight.shadow.mapSize.set(this.q.shadowMap, this.q.shadowMap);
    this.sunLight.shadow.bias = -0.0006;
    this.sunLight.shadow.normalBias = 3.0;
    this.sunLight.shadow.camera.updateProjectionMatrix();
    this.sunLight.target.position.set(0, 0, 0);
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    this.hemi = new THREE.HemisphereLight(0x9dc0ff, 0x39423a, 0.42);
    scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0x6d7f96, 0.10);
    scene.add(this.ambient);

    // ---- 雾 ----
    this.fogColor = new THREE.Color(0.42, 0.52, 0.66);
    scene.fog = new THREE.FogExp2(this.fogColor.getHex(), 0.00007);

    // ---- 状态 ----
    this._skyDirty = true;
    this._cloudDirty = true;
    this.stats = {
      updateMs: 0, chunkMs: 0, chunks: this.terrain.stats.chunks,
      puffs: 0, airportLights: 0, cityLights: 0
    };

    // ---- 颜色管线 ----
    // r149 默认输出为线性编码, 会让线性空间配色严重偏暗;
    // 仅在调用方尚未配置输出编码时给出 sRGB 默认值 (可用 opts.manageColorSpace=false 关闭)。
    if (this.renderer && opts.manageColorSpace !== false &&
      THREE.sRGBEncoding !== undefined && this.renderer.outputEncoding === THREE.LinearEncoding) {
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      FS.Log.info('environment.js: renderer.outputEncoding 未配置, 已设为 sRGBEncoding');
    }
    // 阴影贴图默认是关闭的, opts.shadows 打开时需要显式启用
    if (this.useShadows && this.renderer && this.renderer.shadowMap && !this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.enabled = true;
    }

    // ---- 初始化 ----
    this._rnd = FS.Rng.mulberry32((this.seed + 31337) >>> 0);
    this._applyVisibility();
    this._rebuildClouds();
    this.setTimeOfDay(this.timeHours);
    this.setFocus(0, 0, this.focus.y);
    this._applySky();          // 首帧之前就把天光算好
    this._applyVisibility();
  }

  /* ---------------------------- 时间 / 日期 ---------------------------- */

  Environment.prototype.setTimeOfDay = function (hours) {
    var h = finite(hours, 12);
    h = h - Math.floor(h / 24) * 24;                     // 归一化到 [0,24)
    if (h < 0) h += 24;
    this.timeHours = h;
    this._skyDirty = true;
    return h;
  };

  Environment.prototype.getTimeOfDay = function () { return this.timeHours; };

  Environment.prototype.setDate = function (month, day) {
    this.month = clamp(finite(month, 1), 1, 12);
    this.day = clamp(finite(day, 1), 1, 31);
    this.model.setSeason(this.month, Geo.refLat);
    this.terrain.markAllDirty();                          // 雪线变化 -> 重新烘焙顶点色
    this._warmFrames = Math.max(this._warmFrames, 40);
    this._skyDirty = true;
  };

  Environment.prototype.getSunElevationDeg = function () { return this._sunElevDeg; };

  Environment.prototype.getSunAzimuthDeg = function () {
    var d = this.sunDirection;
    return U.wrap360(Math.atan2(d.x, -d.z) * RAD);
  };

  Environment.prototype.getDayFactor = function () { return this._dayFactor; };

  Environment.prototype.getMoonPhase = function () { return this._moon.phase; };

  /* ---------------------------- 焦点 / 更新 ---------------------------- */

  Environment.prototype.setFocus = function (x, z, y) {
    var f = this.focus;
    var nx = finite(x, f.x), nz = finite(z, f.z);
    if (!this._focusSet) {
      this._focusSet = true;
      this._warmFrames = 150;
    } else {
      var dx = nx - f.x, dz = nz - f.z;
      if (dx * dx + dz * dz > 2.5e8) this._warmFrames = 120;   // 瞬移 (>15km) -> 预热
      if (dx * dx + dz * dz > 2.25e10) this._regenClouds = true; // >150km -> 重撒云
    }
    f.x = nx; f.z = nz;
    if (y !== undefined) f.y = finite(y, f.y);
    return f;
  };

  /**
   * @param {number} dt 秒
   * @param {object} [focus] {x,y,z}
   */
  Environment.prototype.update = function (dt, focus) {
    if (dt && typeof dt === 'object') { focus = dt; dt = focus.dt; }
    dt = finite(dt, 0.016);
    if (dt < 0) dt = 0;
    if (dt > 0.5) dt = 0.5;
    if (focus) this.setFocus(focus.x, focus.z, focus.y);

    this._time += dt;
    var t0 = nowMs();
    var warm = this._warmFrames > 0;
    if (warm) this._warmFrames--;

    // 1) 地形 LOD (限时重建)
    if (!this._terrainSuspended) this.terrain.update(this.focus.x, this.focus.z, this.q.buildBudgetMs, warm);
    this.stats.chunkMs = this.terrain.stats.lastMs;

    // 2) 海洋跟随 + 水深分帧刷新
    this.ocean.update(this.focus.x, this.focus.z, 1.2);

    // 3) 天光
    if (this._skyDirty) this._applySky();
    this._updateLightTransform();

    // 4) 云
    this._updateClouds(dt);

    // 5) 降水 / 闪电
    this._updatePrecip(dt);
    this._updateLightning(dt);

    // 6) 尾迹
    this.contrails.update(dt);

    // 7) 灯光
    this._updateLights(dt);

    this.stats.updateMs = nowMs() - t0;
    return this.stats.updateMs;
  };

  /* ---------------------------- 天空与光照 ---------------------------- */

  var _sZen = [0, 0, 0], _sHor = [0, 0, 0], _sGnd = [0, 0, 0], _sSun = [0, 0, 0];
  var _sGlow = [0, 0, 0], _sDusk = [0, 0, 0], _grey = [0, 0, 0];

  /** 把调色板三元组写入 THREE.Color (带 NaN 保护) */
  function setCol(c, arr, scale) {
    var s = scale === undefined ? 1 : scale;
    if (!arr || typeof arr[0] !== 'number') {
      FS.Log.error('environment.js: setCol 参数不是调色板数组');
      return c;
    }
    c.setRGB(clamp(arr[0] * s, 0, 8), clamp(arr[1] * s, 0, 8), clamp(arr[2] * s, 0, 8));
    return c;
  }

  Environment.prototype._applySky = function () {
    this._skyDirty = false;
    var W = this.weather;
    var lat = Geo.refLat;
    var decl = sunDeclinationDeg(this.month, this.day);
    var ha = 15 * (this.timeHours - 12);
    horizToWorld(decl, ha, lat, _v3t);
    this.sunDirection.set(_v3t.x, _v3t.y, _v3t.z).normalize();
    moonState(this.month, this.day, this.timeHours, lat, this._moon);
    this.moonDirection.set(this._moon.dir.x, this._moon.dir.y, this._moon.dir.z).normalize();

    var el = Math.asin(clamp(this.sunDirection.y, -1, 1)) * RAD;
    this._sunElevDeg = el;
    var day = smoothstep((el + 5.5) / 9.5);
    this._dayFactor = day;
    var dusk = Math.exp(-(el * el) / (2 * 5.8 * 5.8));
    var flat = clamp01((W.cloudCover - 0.22) / 0.72);      // 阴天程度
    var storm = W.thunderstorm ? 1 : 0;

    // ---- 天空调色 ----
    mix3(SKY_PAL.nightZenith, SKY_PAL.dayZenith, day, _sZen);
    mix3(SKY_PAL.nightHorizon, SKY_PAL.dayHorizon, day, _sHor);
    mix3(_sHor, SKY_PAL.duskHorizon, dusk * 0.9 * (1 - flat * 0.65), _sHor);
    mix3(_sZen, SKY_PAL.duskZenith, dusk * 0.5, _sZen);
    // 阴天: 天空趋向均匀灰色
    var gv = 0.10 + 0.46 * day;
    _grey[0] = gv * 0.96; _grey[1] = gv * 0.99; _grey[2] = gv * 1.06;
    mix3(_sHor, _grey, flat * 0.80, _sHor);
    mix3(_sZen, _grey, flat * 0.72 * (0.6 + 0.4 * day), _sZen);
    // 地表雾色
    _sGnd[0] = _sHor[0] * 0.55 + 0.02;
    _sGnd[1] = _sHor[1] * 0.55 + 0.02;
    _sGnd[2] = _sHor[2] * 0.55 + 0.03;

    // ---- 太阳/月亮 ----
    var sunWhite = clamp01((el - 0.5) / 14);
    mix3(SKY_PAL.sunLow, SKY_PAL.sunDay, sunWhite, _sSun);
    mix3(SKY_PAL.glowDusk, SKY_PAL.glowDay, clamp01((el + 1) / 12), _sGlow);
    mix3(_sGlow, SKY_PAL.duskCol, dusk * 0.8, _sDusk);

    var su = this.sky.uniforms;
    setCol(su.uZenithCol.value, _sZen);
    setCol(su.uHorizonCol.value, _sHor);
    setCol(su.uGroundCol.value, _sGnd);
    setCol(su.uSunCol.value, _sSun);
    setCol(su.uGlowCol.value, _sGlow);
    setCol(su.uDuskCol.value, _sDusk);
    su.uSunDir.value.copy(this.sunDirection);
    su.uMoonDir.value.copy(this.moonDirection);
    su.uSunVisible.value = clamp01((el + 1.2) / 1.6);
    var moonUp = clamp01((this._moon.elevDeg + 2) / 7);
    su.uMoonVisible.value = moonUp * (1 - day * 0.85);
    su.uMoonPhase.value = this._moon.phase;
    su.uMoonBright.value = 0.30 + 0.70 * Math.pow(this._moon.phase, 1.5);
    su.uDay.value = day;
    su.uHaze.value = clamp01(W.haze * 0.8 + W.fog * 0.5 + Math.max(0, 1 - W.visibilityM / 30000) * 0.7);
    su.uDuskAmount.value = dusk;
    su.uFlat.value = flat * 0.9;

    // ---- 光源 ----
    // 注: three r149 传统光照约定为 diffuse = dotNL * color * intensity * albedo (不除 PI)
    var sunI = 1.02 * day * (0.32 + 0.68 * clamp01((el + 2) / 24)) *
      (1 - 0.55 * flat) * (storm ? 0.62 : 1);
    var moonUpI = clamp01((this._moon.elevDeg + 3) / 9);
    var moonI = 0.11 * Math.pow(this._moon.phase, 1.5) * moonUpI * (1 - day) * (1 - 0.5 * flat);
    var useMoon = (sunI < 0.035) && (moonI > 0.008);
    this._moonLight = useMoon;
    if (useMoon) {
      this._lightDir.copy(this.moonDirection);
      setCol(this.sunLight.color, SKY_PAL.moonCol, 1.0);
      this.sunLight.intensity = moonI;
    } else {
      this._lightDir.copy(this.sunDirection);
      setCol(this.sunLight.color, _sSun, 1.0);
      this.sunLight.intensity = sunI;
    }

    // 半球光 / 环境光
    var hemiSky = [_sHor[0] * 1.15 + _sZen[0] * 0.65, _sHor[1] * 1.15 + _sZen[1] * 0.65, _sHor[2] * 1.15 + _sZen[2] * 0.65];
    var hemiGnd = [0.055 + 0.10 * day, 0.058 + 0.105 * day, 0.050 + 0.085 * day];
    setCol(this.hemi.color, hemiSky);
    setCol(this.hemi.groundColor, hemiGnd);
    this.hemi.intensity = (0.055 + 0.30 * day) * (1 - 0.28 * flat) * this._fillFactor;
    this.ambient.intensity = (0.018 + 0.048 * day + 0.030 * flat) * this._fillFactor;
    if (useMoon) this.ambient.intensity += 0.10 * moonI * this._fillFactor;

    // ---- 雾色 (与地平线一致) ----
    var fogS = 1.0 + flat * 0.15;
    this.fogColor.setRGB(clamp(_sHor[0] * fogS, 0, 1), clamp(_sHor[1] * fogS, 0, 1), clamp(_sHor[2] * fogS, 0, 1));
    if (this.scene.fog) this.scene.fog.color.copy(this.fogColor);

    // ---- 其它系统 ----
    var ou = this.ocean.uniforms;
    ou.uSunDir.value.copy(this.sunDirection);
    setCol(ou.uSunCol.value, _sSun, 1.0);
    setCol(ou.uSkyCol.value, _sHor);
    ou.uFogCol.value.copy(this.fogColor);
    ou.uChop.value = clamp01(0.25 + W.windSpeedKt / 45 + W.turbulence * 0.3);

    var tu = this.terrain.uniforms;
    tu.uHazeColor.value.copy(this.fogColor);
    tu.uCloudCover.value = clamp01(W.cloudCover);
    tu.uCloudShadow.value = 0.30 + 0.55 * clamp01(W.cloudCover) * (1 - 0.4 * (1 - day));

    for (var i = 0; i < this.cloudLayers.length; i++) {
      var cu = this.cloudLayers[i].uniforms;
      cu.uSunDir.value.copy(this.sunDirection);
      cu.uLitCol.value.setRGB(
        clamp(_sSun[0] * 1.10 + 0.05, 0, 2), clamp(_sSun[1] * 1.10 + 0.05, 0, 2), clamp(_sSun[2] * 1.10 + 0.06, 0, 2));
      // 云的阴影面: 夜间偏蓝灰, 白天偏灰
      var sh = 0.20 + 0.30 * day;
      cu.uShadowCol.value.setRGB(
        clamp(sh * 0.85 + _sHor[0] * 0.35, 0, 1), clamp(sh * 0.88 + _sHor[1] * 0.35, 0, 1), clamp(sh * 0.98 + _sHor[2] * 0.35, 0, 1));
    }
    this._updateStarFade();
  };

  Environment.prototype._updateStarFade = function () {
    var day = this._dayFactor;
    var fade = clamp01(1 - day * 2.6) * (1 - clamp01(this.weather.cloudCover) * 0.92) * (1 - clamp01(this.weather.fog) * 0.85);
    var pr = 1;
    if (this.renderer && this.renderer.getPixelRatio) {
      try { pr = this.renderer.getPixelRatio() || 1; } catch (e) { pr = 1; }
    }
    this.sky.setStarFade(fade, this._time, pr);
    if (this._cityMat) this._cityMat.uniforms.uPR.value = pr;
    if (this.precip.snowUniforms) this.precip.snowUniforms.uPR.value = pr;
  };

  Environment.prototype._updateLightTransform = function () {
    var f = this.focus;
    var gy = this.getGroundHeight(f.x, f.z);
    var D = Math.max(1400, this.q.shadowRadius * 1.15);
    var d = this._lightDir;
    this.sunLight.position.set(
      f.x + d.x * D,
      gy + Math.max(140, d.y * D),
      f.z + d.z * D
    );
    this.sunLight.target.position.set(f.x, gy, f.z);
    this.sunLight.target.updateMatrixWorld();
  };

  /* ---------------------------- 云 / 降水 / 闪电 ---------------------------- */

  Environment.prototype._rebuildClouds = function () {
    var W = this.weather;
    var L = W.cloudLayers || [];
    var i;
    for (i = 0; i < this.cloudLayers.length; i++) {
      var layerMesh = this.cloudLayers[i];
      var spec = L[i];
      if (!spec || clamp01(spec.cover) < 0.02) {
        layerMesh.count = 0;
        layerMesh.geo.instanceCount = 0;
        layerMesh.setVisible(false);
        continue;
      }
      layerMesh.generate(spec, this.q.cloudRangeM, this._groundProbe, this.focus.x, this.focus.z);
      layerMesh.setVisible(true);
      var cu = layerMesh.uniforms;
      cu.uOpacity.value = clamp01(0.10 + 0.62 * clamp01(spec.cover) * (0.6 + 0.55 * clamp01(W.cloudCover)));
    }
    this.stats.puffs = 0;
    for (i = 0; i < this.cloudLayers.length; i++) this.stats.puffs += this.cloudLayers[i].count;
    this._updateStarFade();
  };

  Environment.prototype._updateClouds = function (dt) {
    var W = this.weather;
    if (this._regenClouds) { this._regenClouds = false; this._rebuildClouds(); }
    var windR = W.windDirDeg * DEG;
    // 海面: 风向 (吹向) 与浪高
    var ou = this.ocean.uniforms;
    ou.uWind.value.set(-Math.sin(windR), Math.cos(windR));
    ou.uWaveScale.value = 0.45 + clamp01(W.windSpeedKt / 34) * 1.25 + W.turbulence * 0.2;
    ou.uTime.value = this._time;
    for (var i = 0; i < this.cloudLayers.length; i++) {
      var lm = this.cloudLayers[i];
      if (!lm.count) continue;
      var spec = (W.cloudLayers || [])[i];
      var baseFt = spec ? spec.baseFt : 4000;
      var altM = Math.max(300, baseFt * FT + 600);
      var shear = 0.62 + 0.38 * clamp01(altM / 3000);
      var spd = (W.windSpeedKt * shear + W.gustKt * 0.12) * (C.KT || 0.514444);
      lm.drift.x += Math.sin(windR + PI) * spd * dt;
      lm.drift.y += -Math.cos(windR + PI) * spd * dt;
      lm.uniforms.uCenter.value.set(this.focus.x, 0, this.focus.z);
      lm.uniforms.uFlash.value = this._flash * 0.5;
    }
    var tu = this.terrain.uniforms;
    tu.uCloudOff.value.set(this.cloudLayers[0] ? this.cloudLayers[0].drift.x * 0.0016 : 0,
      this.cloudLayers[0] ? this.cloudLayers[0].drift.y * 0.0016 : 0);
  };

  Environment.prototype._updatePrecip = function (dt) {
    var W = this.weather;
    var altFade = 1;
    var topM = this.weather.cloudTopFt * FT;
    var f = this.focus;
    if (f.y > topM + 400) {
      altFade = clamp01(1 - (f.y - topM - 400) / 2600);
    }
    // 温度低于 -2°C 时雨转雪
    var temp = finite(W.temperatureC, 10);
    var rainI = W.rain, snowI = W.snow;
    if (snowI <= 0.01 && rainI > 0.02 && temp < 1.5) {
      snowI = rainI * clamp01((1.5 - temp) / 4);
      rainI = rainI - snowI;
    }
    var pr = 1;
    if (this.renderer && this.renderer.getPixelRatio) {
      try { pr = this.renderer.getPixelRatio() || 1; } catch (e2) { pr = 1; }
    }
    var wind = { dirDeg: W.windDirDeg, speedKt: W.windSpeedKt, gustKt: W.gustKt, turbulence: W.turbulence };
    this.precip.update(dt, f, wind, altFade, rainI, snowI, pr);
    this._activeRain = rainI * altFade;
    this._activeSnow = snowI * altFade;
  };

  Environment.prototype._updateLightning = function (dt) {
    var W = this.weather;
    // 触发新的闪电
    if (W.thunderstorm && this._flashAge <= 0) {
      this._lightningTimer -= dt * (0.6 + 1.6 * W.rain);
      if (this._lightningTimer <= 0) {
        this._lightningTimer = 5 + this._rnd() * 16;
        this._flashAge = 0.62;
        var ang = this._rnd() * 2 * PI;
        var dist = 2500 + this._rnd() * 14000;
        var lx = this.focus.x + Math.cos(ang) * dist;
        var lz = this.focus.z + Math.sin(ang) * dist;
        var ly = this.getGroundHeight(lx, lz);
        this._lastStrike = { x: lx, y: ly, z: lz };
        FS.Bus.emit('lightning', {
          x: lx, y: ly, z: lz,
          distanceM: dist,
          distanceNm: dist / (C.NM || 1852),
          intensity: 0.4 + this._rnd() * 0.6,
          time: this._time
        });
      }
    }
    // 衰减的多次脉冲
    if (this._flashAge > 0) {
      this._flashAge -= dt;
      if (this._flashAge <= 0) {
        this._flashAge = 0;
        this._flash = 0;
      } else {
        var t = 0.62 - this._flashAge;
        var f = Math.exp(-t * 24.0)
          + (t > 0.06 ? Math.exp(-(t - 0.06) * 15.0) * 0.80 : 0)
          + (t > 0.17 ? Math.exp(-(t - 0.17) * 10.0) * 0.55 : 0);
        this._flash = clamp01(f);
      }
    }
    var fl = this._flash;
    this.sky.uniforms.uFlash.value = fl * 0.85;
    this.ocean.uniforms.uFlash.value = fl * 0.35;
    for (var i = 0; i < this.cloudLayers.length; i++) {
      this.cloudLayers[i].uniforms.uFlash.value = fl * 0.55;
    }
    if (fl > 0.001) {
      this.hemi.intensity += fl * 0.80 * this._fillFactor;
      this.ambient.intensity += fl * 0.30 * this._fillFactor;
      if (this.scene.fog) {
        this.scene.fog.color.setRGB(
          clamp(this.fogColor.r + fl * 0.45, 0, 1),
          clamp(this.fogColor.g + fl * 0.48, 0, 1),
          clamp(this.fogColor.b + fl * 0.55, 0, 1));
      }
    }
  };

  /* ---------------------------- 灯光 ---------------------------- */

  /**
   * 场景中若已被其它模块添加了半球光/环境光, 本模块的补光按比例减弱,
   * 避免"双重环境光"把夜间照成白昼。首次检测到时会给出提示。
   */
  Environment.prototype._checkForeignFill = function () {
    if ((this._fillCheck++ % 30) !== 0) return;
    var hemi = 0, amb = 0;
    var ch = this.scene ? this.scene.children : null;
    if (!ch) return;
    for (var i = 0; i < ch.length; i++) {
      var o = ch[i];
      if (!o || !o.isLight || o === this.hemi || o === this.ambient) continue;
      if (o.isHemisphereLight) hemi += o.intensity;
      else if (o.isAmbientLight) amb += o.intensity;
    }
    var foreign = hemi * 0.8 + amb;                 // 大致折算成等效辐照度
    var mine = 0.30 * 0.6 + 0.05;                   // 本模块正午量级
    var f = foreign > 0.02 ? clamp(mine / (mine + foreign), 0.05, 1) : 1;
    if (Math.abs(f - this._fillFactor) > 0.02) {
      this._fillFactor = f;
      this._skyDirty = true;
    }
    if (foreign > 0.05 && !this._fillWarned) {
      this._fillWarned = true;
      FS.Log.warn('environment.js: 场景中已存在外部半球光/环境光 (等效 ' + foreign.toFixed(2) +
        '), 本模块补光已减至 ' + Math.round(f * 100) + '%; 建议由环境模块统一提供光照, 删除重复的 HemisphereLight/AmbientLight');
    }
  };

  Environment.prototype._updateLights = function (dt) {
    this._checkForeignFill();
    var day = this._dayFactor;
    var vis = this.weather.visibilityM;
    var night = clamp01(1 - day * 1.9);
    var visBoost = clamp01(1 - vis / 9000) * 0.9;
    var lightAlpha = clamp01(Math.max(night, visBoost));
    this._cityNight.value = lightAlpha * 0.85;
    if (this._cityMat) {
      var pr = 1;
      if (this.renderer && this.renderer.getPixelRatio) {
        try { pr = this.renderer.getPixelRatio() || 1; } catch (e) { pr = 1; }
      }
      this._cityMat.uniforms.uPR.value = pr;
    }
    if (this._cityDirty) this._rebuildCityLights();

    if (!this._airportEnabled) return;
    for (var i = 0; i < this._airports.length; i++) {
      var ap = this._airports[i];
      var dx = ap.centerX - this.focus.x, dz = ap.centerZ - this.focus.z;
      var d2 = dx * dx + dz * dz;
      ap.night.value = 0.04 + 0.96 * lightAlpha;
      ap.mesh.visible = d2 < 4.5e9;                       // 67 km 内才绘制
      if (d2 < 4.0e8) {                                   // 20 km 内更新 PAPI / 信标
        ap.updateBeacon(dt, lightAlpha);
        ap.updatePapi(this.focus.x, this.focus.y, this.focus.z);
      }
    }
  };

  Environment.prototype.setAirportLightsEnabled = function (on) {
    this._airportEnabled = !!on;
    for (var i = 0; i < this._airports.length; i++) {
      this._airports[i].mesh.visible = this._airportEnabled;
    }
  };

  Environment.prototype.setContrailSource = function (fn) {
    this.contrails.source = (typeof fn === 'function') ? fn : null;
  };

  Environment.prototype.addContrail = function (x, y, z, strength) {
    this.contrails.add(x, y, z, strength === undefined ? 0.7 : strength);
  };

  /* ---------------------------- 城市 ---------------------------- */

  Environment.prototype.addCity = function (lat, lon, radiusM, brightness) {
    if (!isFinite(lat) || !isFinite(lon)) return null;
    var p = Geo.toWorld(lat, lon);
    var r = clamp(finite(radiusM, 6000), 400, 60000);
    var b = clamp01(finite(brightness, 0.8));
    var city = { x: p.x, z: p.z, r: r, b: b, lat: lat, lon: lon };
    this._cities.push(city);
    this.cityIndex.add(p.x, p.z, r, b);
    this._cityDirty = true;
    this.terrain.markAllDirty();
    return city;
  };

  Environment.prototype._rebuildCityLights = function () {
    this._cityDirty = false;
    var cap = this.q.cityLights;
    var cities = this._cities;
    var n = 0, i, j;
    var pos = this._cityPos, col = this._cityCol, size = this._citySize;
    if (!cities.length) {
      this._cityGeo.setDrawRange(0, 0);
      return;
    }
    var perCap = Math.max(30, Math.floor(cap / cities.length));
    var rnd = FS.Rng.mulberry32((this.seed + 5150) >>> 0);
    var seaLevel = this.seaLevelM;
    for (i = 0; i < cities.length && n < cap; i++) {
      var c = cities[i];
      var want = Math.round(clamp(c.r / 50 * (0.6 + 0.9 * c.b), 80, perCap));
      var attempts = Math.round(want * 2.4);
      var districts = 5 + Math.floor(rnd() * 6);
      var dx = [], dz = [], dr = [];
      for (j = 0; j < districts; j++) {
        var da = rnd() * 2 * PI, dd = Math.sqrt(rnd()) * c.r * 0.80;
        dx.push(Math.cos(da) * dd); dz.push(Math.sin(da) * dd);
        dr.push(c.r * (0.08 + rnd() * 0.16));
      }
      var arterials = 3 + Math.floor(rnd() * 4);
      var aAng = [], aOff = [];
      for (j = 0; j < arterials; j++) { aAng.push(rnd() * PI); aOff.push((rnd() - 0.5) * c.r * 0.4); }
      var made = 0;
      for (j = 0; j < attempts && made < want && n < cap; j++) {
        var x, z;
        var mode = rnd();
        if (mode < 0.55) {
          var k = Math.floor(rnd() * districts);
          var ang = rnd() * 2 * PI, rr = Math.sqrt(rnd()) * dr[k];
          x = c.x + dx[k] + Math.cos(ang) * rr;
          z = c.z + dz[k] + Math.sin(ang) * rr;
        } else if (mode < 0.85) {
          // 放射状主干道
          var a = aAng[Math.floor(rnd() * arterials)];
          var t = rnd() * c.r * 0.95;
          x = c.x + Math.cos(a) * t + (rnd() - 0.5) * 90;
          z = c.z + Math.sin(a) * t + (rnd() - 0.5) * 90;
        } else {
          // 环路
          var ra = rnd() * 2 * PI;
          var rrad = c.r * (0.42 + rnd() * 0.16);
          x = c.x + Math.cos(ra) * rrad + (rnd() - 0.5) * 120;
          z = c.z + Math.sin(ra) * rrad + (rnd() - 0.5) * 120;
        }
        var gh = this.getGroundHeight(x, z);
        if (gh <= seaLevel + 0.6) continue;
        if (gh > 2600) continue;
        var bright = 0.35 + rnd() * 0.65;
        if (rnd() < 0.10) bright = 1.0;
        var warm = rnd();
        var r0, g0, b0;
        if (warm < 0.62) { r0 = 1.0; g0 = 0.78; b0 = 0.42; }         // 钠灯
        else if (warm < 0.88) { r0 = 1.0; g0 = 0.93; b0 = 0.80; }    // 暖白 LED
        else { r0 = 0.80; g0 = 0.90; b0 = 1.0; }                     // 冷白
        var gain = 1.25 * (0.85 + 0.35 * c.b);
        pos[n * 3] = x; pos[n * 3 + 1] = gh + 2.0; pos[n * 3 + 2] = z;
        col[n * 3] = r0 * bright * gain;
        col[n * 3 + 1] = g0 * bright * gain;
        col[n * 3 + 2] = b0 * bright * gain;
        size[n] = (0.8 + rnd() * 1.5) * (0.7 + 0.5 * c.b);
        n++; made++;
      }
    }
    this._cityGeo.setDrawRange(0, n);
    this._cityGeo.attributes.position.needsUpdate = true;
    this._cityGeo.attributes.aColor.needsUpdate = true;
    this._cityGeo.attributes.aSize.needsUpdate = true;
    this.stats.cityLights = n;
  };

  /* ---------------------------- 天气 / 能见度 / 风 ---------------------------- */

  Environment.prototype._effectiveVisibility = function () {
    var W = this.weather;
    var vis = W.visibilityM;
    if (W.fog > 0.02) vis = Math.min(vis, 180 + 4200 / (0.22 + W.fog * 2.0));
    if (W.haze > 0.05) vis = Math.min(vis, vis * (1 - 0.45 * W.haze));
    if (W.rain > 0.05) vis = Math.min(vis, vis * (1 - 0.35 * W.rain));
    if (W.snow > 0.05) vis = Math.min(vis, vis * (1 - 0.55 * W.snow));
    return clamp(vis, 40, 200000);
  };

  Environment.prototype._applyVisibility = function () {
    var vis = this._effectiveVisibility();
    var d = clamp(1.4 / vis, 1e-5, 0.05);
    if (this.scene.fog) {
      this.scene.fog.density = d;
      this.scene.fog.color.copy(this.fogColor);
    }
    var W = this.weather;
    this.ocean.uniforms.uFogDensity.value = d;
    var tu = this.terrain.uniforms;
    tu.uHazeFar.value = Math.max(1200, vis * 0.7);
    tu.uHazeAmount.value = clamp01(0.10 + W.haze * 0.55 + W.fog * 0.6);
    tu.uHazeScale.value = 1200 + 2800 * (1 - clamp01(W.haze + W.fog * 0.5));
    return vis;
  };

  Environment.prototype.setVisibility = function (meters) {
    this.weather.visibilityM = clamp(finite(meters, 10000), 40, 200000);
    this._applyVisibility();
    this._skyDirty = true;
    return this.weather.visibilityM;
  };

  Environment.prototype.getVisibilityMeters = function () {
    return this._effectiveVisibility();
  };

  /** 部分更新, 与当前天气合并 */
  Environment.prototype.setWeather = function (spec) {
    var W = this.weather, k;
    if (spec) {
      for (k in spec) {
        if (!Object.prototype.hasOwnProperty.call(spec, k)) continue;
        if (k === 'cloudLayers') {
          var src = spec.cloudLayers || [];
          W.cloudLayers = [];
          for (var i = 0; i < src.length && i < 3; i++) {
            W.cloudLayers.push({
              cover: clamp01(finite(src[i].cover, 0.3)),
              baseFt: clamp(finite(src[i].baseFt, 3000), 30, 45000),
              topFt: clamp(finite(src[i].topFt, 8000), 60, 60000),
              type: src[i].type || 'cumulus'
            });
          }
        } else if (k === '_coverExplicit') {
          continue;
        } else {
          W[k] = spec[k];
        }
      }
      // 显式给出云量 -> 以它为准; 只给云层 -> 重新由云层推导
      if (spec.cloudCover !== undefined) W._coverExplicit = true;
      else if (spec.cloudLayers !== undefined) W._coverExplicit = false;
    }
    deriveWeather(W);
    this._applyVisibility();
    this._rebuildClouds();
    this._skyDirty = true;
    return this.getWeather();
  };

  Environment.prototype.getWeather = function () { return copyWeather(this.weather); };

  /** 快捷降水设置 */
  Environment.prototype.setPrecipitation = function (type, intensity) {
    var t = String(type || 'none').toLowerCase();
    var a = clamp01(finite(intensity, 0.5));
    var W = this.weather;
    this._precipType = t;
    this._precipIntensity = a;
    W.rain = 0; W.snow = 0; W.thunderstorm = false;
    switch (t) {
      case 'rain':
        W.rain = a;
        W.cloudCover = Math.max(W.cloudCover, 0.55 + 0.35 * a);
        break;
      case 'snow':
        W.snow = a;
        W.cloudCover = Math.max(W.cloudCover, 0.6 + 0.3 * a);
        if (W.temperatureC > 1) W.temperatureC = -2 - 4 * a;
        break;
      case 'storm':
        W.rain = Math.max(0.7, a);
        W.thunderstorm = true;
        W.cloudCover = 1; W.turbulence = Math.max(W.turbulence, 0.75);
        W.windSpeedKt = Math.max(W.windSpeedKt, 22);
        W.gustKt = Math.max(W.gustKt, 40);
        break;
      case 'fog':
        W.fog = Math.max(0.25, a);
        W.visibilityM = Math.min(W.visibilityM, 200 + 1600 * (1 - a));
        break;
      case 'haze':
        W.haze = Math.max(0.3, a);
        break;
      default:
        break;
    }
    if (t === 'none') { W.fog = 0; W.haze = Math.min(W.haze, 0.2); }
    deriveWeather(W);
    this._applyVisibility();
    this._rebuildClouds();
    this._skyDirty = true;
    return this.getWeather();
  };

  Environment.prototype.setWind = function (dirDeg, speedKt, gustKt, turbulence) {
    var W = this.weather;
    W.windDirDeg = U.wrap360(finite(dirDeg, W.windDirDeg));
    W.windSpeedKt = clamp(finite(speedKt, W.windSpeedKt), 0, 220);
    W.gustKt = clamp(finite(gustKt, Math.max(W.windSpeedKt, W.gustKt)), W.windSpeedKt, 260);
    if (turbulence !== undefined) W.turbulence = clamp01(finite(turbulence, W.turbulence));
    this._skyDirty = true;
    return { dirDeg: W.windDirDeg, speedKt: W.windSpeedKt, gustKt: W.gustKt, turbulence: W.turbulence };
  };

  /**
   * 某点的风 (含高度切变/阵风/湍流)
   * @returns {{dirDeg:number,speedKt:number,gustKt:number,turbulence:number}}
   */
  Environment.prototype.windAt = function (x, z, altFt) {
    var W = this.weather;
    x = finite(x, 0); z = finite(z, 0);
    var altM = Math.max(0, finite(altFt, 0) * FT);
    var shear = smoothstep(altM / 950);
    var speed = W.windSpeedKt * (0.58 + 0.42 * shear);
    var dir = W.windDirDeg - 20 * (1 - shear);
    if (altM > 3200) speed *= 1 + clamp01((altM - 3200) / 9000) * 0.42;
    var t = this._time;
    var nv = Noise.value3(x * 0.00009, z * 0.00009, altM * 0.00035 + t * 0.02, 31) - 0.5;
    speed *= 1 + nv * 0.24;
    dir += nv * 9;
    var gustRange = Math.max(0, W.gustKt - W.windSpeedKt);
    var gustN = Math.abs(Noise.value3(x * 0.0004, z * 0.0004, t * 0.33, 57) - 0.5) * 2;
    var gustNow = speed + gustRange * gustN * 0.9;

    // ---- 湍流: 天气 + 机械(地形) + 热力 ----
    var turb = W.turbulence;
    var gh = this.model.height(x, z);
    var agl = altM - gh;
    if (agl < 2600 && agl > -60) {
      var g1 = this.model.height(x + 900, z);
      var g2 = this.model.height(x, z + 900);
      var rough = clamp01((Math.abs(g1 - gh) + Math.abs(g2 - gh)) / 900);
      turb += (1 - clamp01(agl / 2600)) * (0.10 + 0.30 * rough);
    }
    turb += this._dayFactor * clamp01((2200 - Math.max(agl, 0)) / 2200) *
      clamp01((finite(W.temperatureC, 15) + 5) / 35) * 0.16;
    if (W.thunderstorm) turb += 0.25;
    else if (W.rain > 0.4) turb += 0.08;

    var sp = finite(speed, 0), gu = finite(gustNow, 0), tb = finite(turb, 0);
    if (!(sp >= 0)) sp = 0;
    if (!(gu >= sp)) gu = sp;
    return {
      dirDeg: U.wrap360(finite(dir, 270)),
      speedKt: sp,
      gustKt: gu,
      turbulence: clamp01(tb)
    };
  };

  Environment.prototype.getWindAtAircraft = function (x, z, altFt) {
    return this.windAt(x, z, altFt);
  };

  /* ---------------------------- 地形查询 ---------------------------- */

  /** 网格/碰撞高度: 原始地形 + 机场平整区 (不截断海床) */
  Environment.prototype._meshHeight = function (x, z) {
    // 联网地景 (scenery-online.js) 已覆盖时: 直接用其显示网格的高度 (已含平整区)
    if (this._heightProvider) {
      var ho = this._heightProvider(x, z);
      if (ho === ho) return ho;
    }
    var h = this.model.rawHeight(x, z);
    if (!isFinite(h)) return this.seaLevelM;
    if (this._flatten.length) h = applyFlatten(this._flatten, x, z, h);
    return h;
  };

  /** 外部高度源 (联网地景). fn(x,z) 返回 NaN 表示该处未覆盖 -> 使用内置地形 */
  Environment.prototype.setHeightProvider = function (fn) {
    this._heightProvider = typeof fn === 'function' ? fn : null;
  };
  Environment.prototype.getHeightProvider = function () { return this._heightProvider || null; };
  /** 显示/隐藏内置程序化地形 (隐藏时也暂停其 LOD 重建以省 CPU) */
  Environment.prototype.setBuiltinTerrainVisible = function (on) {
    on = !!on;
    if (this.terrain.group.visible === on) return;
    this.terrain.group.visible = on;
    this._terrainSuspended = !on;
    if (on) { this.terrain.markAllDirty(); this._warmFrames = Math.max(this._warmFrames, 20); }
  };
  Environment.prototype.isBuiltinTerrainVisible = function () { return this.terrain.group.visible; };
  /** 让海面的近岸水深属性按当前高度源重算 */
  Environment.prototype.markOceanDirty = function () {
    this.ocean._needRefresh = true; this.ocean._row = 0;
  };

  /** 地面高度 (米 MSL) —— 纯函数, 与相机/LOD 无关; 海面返回 seaLevelM */
  Environment.prototype.getGroundHeight = function (x, z) {
    if (!isFinite(x) || !isFinite(z)) return this.seaLevelM;
    var h = this._meshHeight(x, z);
    return h < this.seaLevelM ? this.seaLevelM : h;
  };

  Environment.prototype.getGroundHeightLatLon = function (lat, lon) {
    var p = Geo.toWorld(finite(lat, 0), finite(lon, 0));
    return this.getGroundHeight(p.x, p.z);
  };

  Environment.prototype.isWater = function (x, z) {
    return this._meshHeight(x, z) <= this.seaLevelM + 0.05;
  };

  /** 局部坡度 (tan θ) */
  Environment.prototype._slopeAt = function (x, z) {
    var e = 40;
    var gh = this.getGroundHeight(x, z);
    var gx = (this.getGroundHeight(x + e, z) - this.getGroundHeight(x - e, z)) / (2 * e);
    var gz = (this.getGroundHeight(x, z + e) - this.getGroundHeight(x, z - e)) / (2 * e);
    return Math.sqrt(gx * gx + gz * gz);
  };

  Environment.prototype.getSurfaceType = function (x, z) {
    if (!isFinite(x) || !isFinite(z)) return 'land';
    var h = this.getGroundHeight(x, z);
    if (h <= this.seaLevelM + 0.05) return 'water';
    var slope = this._slopeAt(x, z);
    var urban = this.cityIndex.factor(x, z);
    return MAT_NAMES[this.model.matCode(x, z, h, slope, this.model.snowLine, urban)];
  };

  /** 单位法向量 {x,y,z} (中心差分) */
  Environment.prototype.getTerrainNormal = function (x, z) {
    var e = 12;
    if (!isFinite(x) || !isFinite(z)) return { x: 0, y: 1, z: 0 };
    var hl = this.getGroundHeight(x - e, z), hr = this.getGroundHeight(x + e, z);
    var hd = this.getGroundHeight(x, z - e), hu = this.getGroundHeight(x, z + e);
    var nx = hl - hr, nz = hd - hu, ny = 2 * e;
    var len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    return { x: nx / len, y: ny / len, z: nz / len };
  };

  var _rgbPub = { r: 0, g: 0, b: 0 };
  var _waterPub = [0.045, 0.115, 0.185];

  Environment.prototype.getGroundColor = function (x, z) {
    if (!isFinite(x) || !isFinite(z)) return new THREE.Color(0.2, 0.3, 0.2);
    if (this.isWater(x, z)) {
      var depth = clamp01(-this.model.rawHeight(x, z) / 900);
      return new THREE.Color(
        lerp(0.085, _waterPub[0], depth),
        lerp(0.185, _waterPub[1], depth),
        lerp(0.235, _waterPub[2], depth));
    }
    var h = this.getGroundHeight(x, z);
    var slope = this._slopeAt(x, z);
    var urban = this.cityIndex.factor(x, z);
    this.model.colorInto(x, z, h, slope, urban, _rgbPub);
    return new THREE.Color(_rgbPub.r, _rgbPub.g, _rgbPub.b);
  };

  Environment.prototype.addFlattenZone = function (x, z, radiusM, heightM, falloffM) {
    x = finite(x, 0); z = finite(z, 0);
    var r = Math.max(1, finite(radiusM, 1500));
    var f = clamp(finite(falloffM, r * 0.25), 1, r);
    if (this._flatten.length >= this._flattenCap) this._flatten.shift();
    this._flatten.push({
      x: x, z: z, r: r, r2: r * r,
      h: finite(heightM, this.getGroundHeight(x, z)),
      falloff: f, inner: r - f
    });
    this.terrain.markAllDirty();
    this._warmFrames = Math.max(this._warmFrames, 30);
    return this._flatten.length;
  };

  /**
   * beta 0.3: 沿跑道 (A->B 线段) 的带状平整区。
   * halfWidthM 以内完全等于 heightM, 再经 falloffM 平滑过渡到原地形。
   */
  Environment.prototype.addRunwayFlatten = function (ax, az, bx, bz, halfWidthM, heightM, falloffM) {
    var dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    if (!(L2 > 1)) return this._flatten.length;
    var inner = Math.max(10, finite(halfWidthM, 200)), fo = Math.max(10, finite(falloffM, 1200));
    var pad = inner + fo;
    if (this._flatten.length >= this._flattenCap) this._flatten.shift();
    this._flatten.push({
      seg: true, ax: ax, az: az, dx: dx, dz: dz, invL2: 1 / L2,
      inner: inner, falloff: fo, h: finite(heightM, 0),
      minX: Math.min(ax, bx) - pad, maxX: Math.max(ax, bx) + pad,
      minZ: Math.min(az, bz) - pad, maxZ: Math.max(az, bz) + pad,
      x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.sqrt(L2) / 2 + pad, r2: 0
    });
    this.terrain.markAllDirty();
    this._warmFrames = Math.max(this._warmFrames, 30);
    return this._flatten.length;
  };

  /** 平整区列表 (只读, 供联网地景复用同一套平整逻辑) */
  Environment.prototype.applyFlattenTo = function (x, z, h, mode) {
    if (mode === 'online') {
      // 联网地景: 真实高程本来就贴合机场, 只需把跑道带本身压平 (窄核心 + 短过渡);
      // 不用内置地形的 4 km 圆形平整区, 否则沿海机场周围的海面会被"抬"成陆地。
      if (this._flattenOnlineSrc !== this._flatten.length + ':' + (this._flatten[0] && this._flatten[0].h)) {
        var zl = [], i;
        for (i = 0; i < this._flatten.length; i++) {
          var f = this._flatten[i];
          if (!f.seg) continue;
          var inner = f.inner, fo = 420, pad = inner + fo;   // 核心 = 跑道半宽 + 160 m (覆盖 z14 网格间距)
          zl.push({
            seg: true, ax: f.ax, az: f.az, dx: f.dx, dz: f.dz, invL2: f.invL2, inner: inner, falloff: fo, h: f.h,
            minX: Math.min(f.ax, f.ax + f.dx) - pad, maxX: Math.max(f.ax, f.ax + f.dx) + pad,
            minZ: Math.min(f.az, f.az + f.dz) - pad, maxZ: Math.max(f.az, f.az + f.dz) + pad
          });
        }
        this._flattenOnline = zl;
        this._flattenOnlineSrc = this._flatten.length + ':' + (this._flatten[0] && this._flatten[0].h);
      }
      return this._flattenOnline.length ? applyFlatten(this._flattenOnline, x, z, h) : h;
    }
    return this._flatten.length ? applyFlatten(this._flatten, x, z, h) : h;
  };

  Environment.prototype.clearFlattenZones = function () {
    this._flatten.length = 0;
    this.terrain.markAllDirty();
    this._warmFrames = Math.max(this._warmFrames, 30);
  };

  /* ---------------------------- 机场灯光 ---------------------------- */

  /**
   * 生成一座机场的灯光
   * @param {string} icao
   * @param {number} lat 机场参考点纬度
   * @param {number} lon
   * @param {number} elevFt 标高 (ft)
   * @param {Array} runways [{ident,hdgTrue,lengthFt,widthFt,lat,lon,elevFt}]
   */
  Environment.prototype.addAirportLights = function (icao, lat, lon, elevFt, runways) {
    icao = icao || ('AP' + this._airports.length);
    if (this._airportMap[icao]) return this._airportMap[icao];
    var set = new AirportLightSet(this.scene, icao, (this.seed + this._airports.length * 733) >>> 0);
    var self = this;
    var ref = Geo.toWorld(finite(lat, 0), finite(lon, 0));
    set.centerX = ref.x; set.centerZ = ref.z;
    var list = (runways && runways.length) ? runways : [];
    var i, s;

    for (var r = 0; r < list.length; r++) {
      var rw = list[r] || {};
      var hdg = finite(rw.hdgTrue, finite(rw.headingDeg, 0));
      var lenM = clamp(finite(rw.lengthFt, 9000), 300, 20000) * FT;    // ft
      var widM = clamp(finite(rw.widthFt, 148), 40, 400) * FT;         // ft
      var th = Geo.toWorld(finite(rw.lat, lat), finite(rw.lon, lon));
      var fx = Math.sin(hdg * DEG), fz = -Math.cos(hdg * DEG);
      var rx = -fz, rz = fx;                       // 右
      var lx = fz, lz = -fx;                       // 左
      var hw = widM * 0.5;

      // ---- 跑道边灯: 每 60 m 一对, 末端 600 m 转黄 ----
      var n = Math.max(2, Math.round(lenM / 60));
      for (i = 0; i <= n; i++) {
        s = i * (lenM / n);
        var cx = th.x + fx * s, cz = th.z + fz * s;
        var nearEnd = (lenM - s) < 600;
        for (var side = -1; side <= 1; side += 2) {
          var ex = cx + rx * (hw + 1.4) * side, ez = cz + rz * (hw + 1.4) * side;
          var ey = self.getGroundHeight(ex, ez) + 0.9;
          if (nearEnd) set.push(ex, ey, ez, 1.0, 0.78, 0.10, 0.9);
          else set.push(ex, ey, ez, 0.98, 0.98, 0.94, 0.9);
        }
      }
      // ---- 入口灯 (绿) ----
      var tn = 10;
      for (i = 0; i <= tn; i++) {
        var toff = -hw + (widM * i / tn);
        var tx = th.x + lx * toff - fx * 1.2, tz = th.z + lz * toff - fz * 1.2;
        var ty = self.getGroundHeight(tx, tz) + 0.9;
        set.push(tx, ty, tz, 0.05, 1.0, 0.25, 1.0);
      }
      // ---- 末端灯 (红) ----
      for (i = 0; i <= tn; i++) {
        var eoff = -hw + (widM * i / tn);
        var xx = th.x + fx * lenM + lx * eoff + fx * 1.2;
        var zz = th.z + fz * lenM + lz * eoff + fz * 1.2;
        var yy = self.getGroundHeight(xx, zz) + 0.9;
        set.push(xx, yy, zz, 1.0, 0.06, 0.04, 0.9);
      }
      // ---- 进近灯: 入口外 900 m 一排白灯 + 300 m 处横排 ----
      var an = 30;
      for (i = 1; i <= an; i++) {
        var as = -30 * i;
        var ax = th.x + fx * as, az = th.z + fz * as;
        var ay = self.getGroundHeight(ax, az) + 0.9;
        set.push(ax, ay, az, 0.95, 0.95, 0.90, 1.15);
        if (i === 10) {
          for (var cb = -4; cb <= 4; cb++) {
            if (cb === 0) continue;
            var bx = ax + lx * cb * 5.0, bz = az + lz * cb * 5.0;
            var by = self.getGroundHeight(bx, bz) + 0.9;
            set.push(bx, by, bz, 0.95, 0.95, 0.90, 1.1);
          }
        }
      }
      // ---- PAPI: 左侧, 距入口 300 m, 4 个灯箱 (外侧灯箱离跑道最远) ----
      var pbase = { x: th.x + fx * 300 + lx * (hw + 22), z: th.z + fz * 300 + lz * (hw + 22) };
      var psum = { x: 0, y: 0, z: 0 };
      var pidx = [];
      for (i = 0; i < 4; i++) {
        var px = pbase.x + lx * (i * 15), pz = pbase.z + lz * (i * 15);
        var py = self.getGroundHeight(px, pz) + 1.2;
        pidx.push(set.push(px, py, pz, 1.0, 0.06, 0.04, 1.5));
        psum.x += px; psum.y += py; psum.z += pz;
      }
      set.papiUnits.push({
        x: psum.x / 4, y: psum.y / 4, z: psum.z / 4, idx: pidx, last: -1
      });
      // ---- 滑行道边灯 (蓝) ----
      var tx0 = th.x - fx * 160 + lx * (hw + 26);
      var tz0 = th.z - fz * 160 + lz * (hw + 26);
      for (i = 0; i <= 14; i++) {
        var ts = i * 32;
        for (var sk = -1; sk <= 1; sk += 2) {
          var qx = tx0 + lx * (sk * 13) + fx * -ts * 0.35;
          var qz = tz0 + lz * (sk * 13) + fz * -ts * 0.35;
          var qy = self.getGroundHeight(qx, qz) + 0.8;
          set.push(qx, qy, qz, 0.10, 0.28, 1.0, 0.85);
        }
      }
      // ---- 跑道中线延长 / 停机坪边灯 ----
      for (i = 0; i <= 12; i++) {
        var apx = th.x + lx * (hw + 60) + fx * (-120 - i * 26);
        var apz = th.z + lz * (hw + 60) + fz * (-120 - i * 26);
        var apy = self.getGroundHeight(apx, apz) + 0.8;
        set.push(apx, apy, apz, 0.95, 0.80, 0.25, 0.8);
      }
    }

    // ---- 旋转信标 ----
    var bxp = ref.x + 260, bzp = ref.z + 180;
    var byy = this.getGroundHeight(bxp, bzp) + 14;
    set.beaconIdx = set.push(bxp, byy, bzp, 1.0, 1.0, 0.95, 2.2);
    set.finalize();

    this._airports.push(set);
    this._airportMap[icao] = set;
    this.stats.airportLights += set.count;
    void elevFt;
    return set;
  };

  /* ---------------------------- 释放 ---------------------------- */

  Environment.prototype.dispose = function () {
    var i;
    for (i = 0; i < this.cloudLayers.length; i++) this.cloudLayers[i].dispose();
    this.cloudLayers.length = 0;
    this.precip.dispose();
    this.contrails.dispose();
    this.ocean.dispose();
    this.terrain.dispose();
    this.sky.dispose();
    for (i = 0; i < this._airports.length; i++) this._airports[i].dispose();
    this._airports.length = 0;
    this._airportMap = {};
    if (this.atlas && this.atlas.dispose) this.atlas.dispose();
    this.atlas = null;
    if (this._cityPoints && this._cityPoints.parent) this._cityPoints.parent.remove(this._cityPoints);
    this._cityGeo.dispose();
    this._cityMat.dispose();
    if (this.scene) {
      if (this.sunLight) this.scene.remove(this.sunLight);
      if (this.sunLight && this.sunLight.target) this.scene.remove(this.sunLight.target);
      if (this.hemi) this.scene.remove(this.hemi);
      if (this.ambient) this.scene.remove(this.ambient);
      this.scene.fog = null;
    }
    if (this.sunLight.shadow && this.sunLight.shadow.map) {
      this.sunLight.shadow.map.dispose();
      this.sunLight.shadow.map = null;
    }
    this._cities.length = 0;
    this._flatten.length = 0;
    this._disposed = true;
  };

  /* ---------------------------- 静态成员 ---------------------------- */
  Environment.presetWeather = presetWeather;
  Environment.WEATHER_PRESETS = WEATHER_PRESETS;
  Environment.QUALITY_PRESETS = QUALITY;
  Environment.TerrainModel = TerrainModel;
  Environment.version = '1.0.0';

  FS.Environment = Environment;
  FS.Log.info('environment.js 已加载 — 天空/地形/海洋/云/降水/灯光系统就绪');

})(typeof window !== 'undefined' ? window : globalThis);
