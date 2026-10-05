/* ==========================================================================
   天际航线 SkyRoute — 全局配置与机型数据库 (config.js)
   依赖: utils.js
   ========================================================================== */
(function (global) {
  'use strict';

  var FS = global.FS = global.FS || {};
  var U = FS.Utils;

  /* ---------------------------------------------------------------------
     1. 模拟器全局设置
     --------------------------------------------------------------------- */
  FS.CFG = {
    version: '0.4.0-beta',
    // beta 0.3: 联网全球地景 (真实高程 + 卫星影像), 菜单 / ?online=0|1 / localStorage 'fs.onlineScenery'
    onlineScenery: (function () {
      try { var v = global.localStorage && global.localStorage.getItem('fs.onlineScenery'); if (v === '0') return false; } catch (e) { /* */ }
      return true;
    })(),
    sceneryImagery: (function () {
      try { var v = global.localStorage && global.localStorage.getItem('fs.sceneryImagery'); if (v) return v; } catch (e) { /* */ }
      return 's2-2016';
    })(),
    // 世界比例: 1 世界单位 = 1 米
    worldRadius: 450000,        // 地形生成半径 (m) —— 约 243 nm
    terrainChunk: 4000,         // 近景地形块尺寸 (m)
    terrainRings: 6,            // 近景 LOD 环数
    // 物理
    physicsHz: 120,             // 物理更新频率
    maxSubSteps: 8,
    timeScaleOptions: [1, 2, 4, 0.5],
    // 默认起始
    defaultAircraft: 'A350-900',
    defaultAirport: 'ZSPD',     // 上海浦东
    // 显示
    units: { alt: 'ft', spd: 'kt', dist: 'nm', weight: 'kg', temp: 'C' },
    showPerf: true
  };

  /* ---------------------------------------------------------------------
     2. 通用气动系数基底 (会按机翼几何自动缩放)
     --------------------------------------------------------------------- */
  var AERO_BASE = {
    // 升力
    CL0: 0.12,                  // 零迎角升力系数 (翼型弯度)
    CLalphaBase: 5.0,           // 3D 升力线斜率 (每弧度), 会按后掠/展弦比修正
    alphaStallClean: 17.5,      // 光洁构型失速迎角 (deg)
    alphaStallLanding: 15.0,    // 着陆构型失速迎角 (deg)
    // 阻力
    CD0Clean: 0.0205,           // 巡航零升阻力 (含干扰/配平阻力)
    CD0Gear: 0.0195,            // 起落架附加阻力
    CD0FlapFull: 0.078,         // 全襟翼附加阻力
    CD0Slat: 0.004,
    CD0Spoiler: 0.062,          // 全部扰流板
    CD0Speedbrake: 0.045,
    oswaldClean: 0.82,
    oswaldFlap: 0.76,
    // 俯仰
    Cm0: 0.045,
    CmAlpha: -1.15,             // 每弧度
    CmElevator: -1.28,          // 每弧度
    CmFlap: -0.078,             // 襟翼下洗引起的低头
    CmGear: -0.021,
    CmQ: -30.0,                 // 俯仰阻尼 (真实运输机约 -25 ~ -35)
    CmAlphaDot: -6.0,           // 俯仰下洗滞后
    // 横侧
    CYbeta: -0.92,              // 侧力系数 每弧度
    CYRudder: -0.20,
    ClBeta: -0.115,             // 上反效应 (滚转)
    ClAileron: 0.062,
    ClRudder: 0.0145,
    ClP: -0.46,                 // 滚转阻尼
    ClR: 0.135,
    CnBeta: 0.135,              // 风标稳定
    CnRudder: 0.075,
    CnAileron: -0.0065,
    CnR: -0.155,                // 偏航阻尼
    CnP: 0.045,
    // 地面
    groundEffectFactor: 0.62,
    // 高速
    machDragRise: 0.022,     // 到达 MMO 时的跨音速阻力增量
    machCritBase: 0.81
  };
  FS.AERO_BASE = AERO_BASE;

  /* ---------------------------------------------------------------------
     3. 机型数据库
     ---------------------------------------------------------------------
     尺寸单位: 米 / 质量: 千克 / 推力: 牛 / 速度: 节
     dims 中坐标使用机体坐标系:
        原点 = 机身参考点(大致在机翼气动中心)
        +X = 右  +Y = 上  +Z = 机尾方向 (即机头朝 -Z)
     --------------------------------------------------------------------- */

  /** 生成默认襟翼卡位 (紧凑写法) */
  function flaps(detents) { return detents; }

  var DB = FS.AIRCRAFT_DB = {

    /* =============== 空客 A350-900 (本模拟器的主角) =============== */
    'A350-900': {
      key: 'A350-900',
      name: 'Airbus A350-900',
      nameZh: '空客 A350-900',
      manufacturer: 'Airbus',
      icaoType: 'A359',
      class: 'widebody',
      engines: {
        model: 'Rolls-Royce Trent XWB-84',
        count: 2,
        maxThrust: 374500,        // N (84,000 lbf) 海平面静止
        bypass: 9.6,
        fanDiameter: 2.98,
        n1Idle: 21.5,
        n1Max: 100,
        spoolUp: 3.1,             // 加速时间常数 (s)
        spoolDown: 4.2,           // 减速时间常数 (s)
        startTime: 42,            // 启动到慢车 (s)
        tsfcCruise: 0.0510,       // kg/(N·h)
        tsfcSL: 0.0300,
        egtIdle: 380, egtMax: 950, egtTakeoffLimit: 905
      },
      dims: {
        length: 66.80, wingspan: 64.75, height: 17.05,
        wingArea: 442.0, wingSweep: 31.9, wingDihedral: 5.0,
        wingRootChord: 13.2, wingTipChord: 2.4,
        wingPos: { x: 0, y: -1.25, z: 1.6 },
        wingletHeight: 1.9, wingletCant: 35,
        tailSpan: 19.4, tailArea: 78.0,
        tailPos: { x: 0, y: 1.6, z: 24.5 }, tailSweep: 36,
        finHeight: 10.6, finArea: 56.0,
        finPos: { x: 0, y: 4.6, z: 25.8 }, finSweep: 40,
        fuselageRadius: 2.96, fuselageWidthTop: 5.96,
        noseLength: 9.2, tailConeLength: 14.5,
        cockpitWindows: 6,
        enginePos: { x: 16.6, y: -1.55, z: 5.6 },
        engineNacelleLen: 7.4, engineNacelleDia: 3.15, pylonLen: 3.6,
        gear: {
          nose: { x: 0, z: -21.5, y: -3.05, strutLen: 3.4, wheelR: 0.62, wheelW: 0.42, wheels: 2, track: 1.1 },
          main: { x: 5.65, z: 2.6, y: -3.25, strutLen: 4.0, wheelR: 1.13, wheelW: 0.42, wheels: 4, bogie: true, track: 11.3 }
        },
        doorPositions: [-20.5, -12.0, 8.5, 17.5],
        windowRows: 46
      },
      mass: {
        oew: 142400, mtow: 280000, mlw: 207000, mzfw: 195700,
        maxFuel: 138000, maxPayload: 53300, paxMax: 350, crew: 12
      },
      perf: {
        vmo: 340, mmo: 0.89, ceiling: 43100, cruiseMach: 0.85,
        v2Base: 148, vref: 138, approachFlap: 'FULL',
        takeoffFlap: '1+F', rotationRate: 3.0,
        mtowFieldLength: 2600, vAppFactor: 1.23
      },
      flaps: flaps([
        { name: '0', pos: 0.00, cl: 0.00, cd: 0.000, alphaStall: 17.5, vfe: 999, slat: 0.00, pitchTrim: 0.0 },
        { name: '1', pos: 0.16, cl: 0.32, cd: 0.012, alphaStall: 17.0, vfe: 255, slat: 0.35, pitchTrim: -0.010 },
        { name: '1+F', pos: 0.28, cl: 0.52, cd: 0.022, alphaStall: 16.8, vfe: 215, slat: 0.55, pitchTrim: -0.018 },
        { name: '2', pos: 0.48, cl: 0.82, cd: 0.040, alphaStall: 16.2, vfe: 200, slat: 0.75, pitchTrim: -0.030 },
        { name: '3', pos: 0.74, cl: 1.22, cd: 0.062, alphaStall: 15.5, vfe: 186, slat: 0.95, pitchTrim: -0.046 },
        { name: 'FULL', pos: 1.00, cl: 1.62, cd: 0.098, alphaStall: 15.0, vfe: 177, slat: 1.00, pitchTrim: -0.062 }
      ]),
      systems: {
        hydraulics: 2, electrics: 4, adirs: 3, fms: 2,
        apu: 'APS 3200', fuelTanks: ['L Inner', 'L Outer', 'C', 'R Inner', 'R Outer'],
        hasHUD: true, autoBrake: ['OFF', 'LO', '2', '3', 'MED', 'HI'],
        hasTCAS: true, hasEGPWS: true, hasWeatherRadar: true, hasAutoLand: true,
        hasThrustReverser: true, hasSpoilers: 12, hasFlyByWire: true,
        flyByWire: { envelopeProtection: true, alphaProt: 14.2, alphaMax: 16.5, bankLimit: 67, highSpeedProt: true, pitchTrimAuto: true }
      },
      lights: { landing: 2, taxi: 1, runwayTurnoff: 2, strobe: 3, beacon: 2, nav: 3, logo: 2, wing: 2 },
      livery: { body: 0xf2f4f7, belly: 0xd8dde3, accent: 0x1d3557, tail: 0x1d3557, stripe: 0x6a8fb3, engine: 0xe8eaee, wing: 0xe4e7ea, gear: 0x9aa0a6, cockpit: 0x101418 }
    },

    /* =============== 空客 A350-1000 =============== */
    'A350-1000': {
      key: 'A350-1000', name: 'Airbus A350-1000', nameZh: '空客 A350-1000',
      manufacturer: 'Airbus', icaoType: 'A35K', class: 'widebody',
      engineModelAlias: 'A350-900',
      engines: {
        model: 'Rolls-Royce Trent XWB-97', count: 2, maxThrust: 431500, bypass: 9.3,
        fanDiameter: 3.00, n1Idle: 21.5, n1Max: 100, spoolUp: 3.3, spoolDown: 4.5,
        startTime: 45, tsfcCruise: 0.0505, tsfcSL: 0.0298,
        egtIdle: 380, egtMax: 950, egtTakeoffLimit: 905
      },
      dims: {
        length: 73.79, wingspan: 64.75, height: 17.08,
        wingArea: 460.0, wingSweep: 31.9, wingDihedral: 5.0,
        wingRootChord: 13.8, wingTipChord: 2.4,
        wingPos: { x: 0, y: -1.25, z: 0.2 }, wingletHeight: 1.9, wingletCant: 35,
        tailSpan: 19.4, tailArea: 80.0, tailPos: { x: 0, y: 1.6, z: 27.0 }, tailSweep: 36,
        finHeight: 10.6, finArea: 57.0, finPos: { x: 0, y: 4.6, z: 28.3 }, finSweep: 40,
        fuselageRadius: 2.96, noseLength: 9.2, tailConeLength: 15.0, cockpitWindows: 6,
        enginePos: { x: 16.6, y: -1.6, z: 4.2 },
        engineNacelleLen: 7.6, engineNacelleDia: 3.25, pylonLen: 3.6,
        gear: {
          nose: { x: 0, z: -24.0, y: -3.05, strutLen: 3.4, wheelR: 0.62, wheelW: 0.42, wheels: 2, track: 1.1 },
          main: { x: 5.65, z: 3.2, y: -3.25, strutLen: 4.1, wheelR: 1.16, wheelW: 0.44, wheels: 6, bogie: true, track: 11.3 }
        },
        doorPositions: [-23.0, -13.0, 10.0, 20.0], windowRows: 51
      },
      mass: { oew: 155400, mtow: 316000, mlw: 236000, mzfw: 223000, maxFuel: 156000, maxPayload: 60400, paxMax: 410, crew: 13 },
      perf: { vmo: 340, mmo: 0.89, ceiling: 41450, cruiseMach: 0.85, v2Base: 152, vref: 142, approachFlap: 'FULL', takeoffFlap: '1+F', rotationRate: 3.0, mtowFieldLength: 2900, vAppFactor: 1.23 },
      flaps: flaps([
        { name: '0', pos: 0.00, cl: 0.00, cd: 0.000, alphaStall: 17.5, vfe: 999, slat: 0.00, pitchTrim: 0.0 },
        { name: '1', pos: 0.16, cl: 0.32, cd: 0.012, alphaStall: 17.0, vfe: 255, slat: 0.35, pitchTrim: -0.010 },
        { name: '1+F', pos: 0.28, cl: 0.52, cd: 0.022, alphaStall: 16.8, vfe: 215, slat: 0.55, pitchTrim: -0.018 },
        { name: '2', pos: 0.48, cl: 0.82, cd: 0.040, alphaStall: 16.2, vfe: 200, slat: 0.75, pitchTrim: -0.030 },
        { name: '3', pos: 0.74, cl: 1.22, cd: 0.062, alphaStall: 15.5, vfe: 186, slat: 0.95, pitchTrim: -0.046 },
        { name: 'FULL', pos: 1.00, cl: 1.62, cd: 0.098, alphaStall: 15.0, vfe: 177, slat: 1.00, pitchTrim: -0.062 }
      ]),
      systems: {
        hydraulics: 2, electrics: 4, adirs: 3, fms: 2, apu: 'APS 3200',
        fuelTanks: ['L Inner', 'L Outer', 'C', 'R Inner', 'R Outer'],
        hasHUD: true, autoBrake: ['OFF', 'LO', '2', '3', 'MED', 'HI'], hasTCAS: true, hasEGPWS: true,
        hasWeatherRadar: true, hasAutoLand: true, hasThrustReverser: true, hasSpoilers: 12, hasFlyByWire: true,
        flyByWire: { envelopeProtection: true, alphaProt: 14.2, alphaMax: 16.5, bankLimit: 67, highSpeedProt: true, pitchTrimAuto: true }
      },
      lights: { landing: 2, taxi: 1, runwayTurnoff: 2, strobe: 3, beacon: 2, nav: 3, logo: 2, wing: 2 },
      livery: { body: 0xf2f4f7, belly: 0xd8dde3, accent: 0x1d3557, tail: 0x1d3557, stripe: 0x6a8fb3, engine: 0xe8eaee, wing: 0xe4e7ea, gear: 0x9aa0a6, cockpit: 0x101418 }
    },

    /* =============== 空客 A320neo =============== */
    'A320neo': {
      key: 'A320neo', name: 'Airbus A320neo', nameZh: '空客 A320neo',
      manufacturer: 'Airbus', icaoType: 'A20N', class: 'narrowbody',
      engines: {
        model: 'CFM LEAP-1A26', count: 2, maxThrust: 120100, bypass: 11.0,
        fanDiameter: 1.98, n1Idle: 22.0, n1Max: 100, spoolUp: 2.4, spoolDown: 3.3,
        startTime: 35, tsfcCruise: 0.0545, tsfcSL: 0.0330,
        egtIdle: 400, egtMax: 940, egtTakeoffLimit: 900
      },
      dims: {
        length: 37.57, wingspan: 35.80, height: 11.76,
        wingArea: 122.6, wingSweep: 25.0, wingDihedral: 5.0,
        wingRootChord: 7.1, wingTipChord: 1.3,
        wingPos: { x: 0, y: -1.05, z: 0.4 }, wingletHeight: 2.4, wingletCant: 20,
        tailSpan: 12.4, tailArea: 31.0, tailPos: { x: 0, y: 1.1, z: 13.6 }, tailSweep: 30,
        finHeight: 6.0, finArea: 21.5, finPos: { x: 0, y: 2.7, z: 14.6 }, finSweep: 35,
        fuselageRadius: 1.98, noseLength: 5.6, tailConeLength: 8.4, cockpitWindows: 6,
        enginePos: { x: 5.75, y: -1.45, z: 3.6 },
        engineNacelleLen: 4.4, engineNacelleDia: 2.15, pylonLen: 2.2,
        gear: {
          nose: { x: 0, z: -12.6, y: -2.05, strutLen: 2.3, wheelR: 0.40, wheelW: 0.25, wheels: 2, track: 0.78 },
          main: { x: 3.80, z: 1.4, y: -2.25, strutLen: 2.7, wheelR: 0.565, wheelW: 0.28, wheels: 2, bogie: false, track: 7.59 }
        },
        doorPositions: [-11.5, -6.5, 5.0, 11.0], windowRows: 26
      },
      mass: { oew: 44300, mtow: 79000, mlw: 67400, mzfw: 64300, maxFuel: 26730, maxPayload: 20000, paxMax: 194, crew: 6 },
      perf: { vmo: 350, mmo: 0.82, ceiling: 39800, cruiseMach: 0.78, v2Base: 138, vref: 130, approachFlap: 'FULL', takeoffFlap: '1+F', rotationRate: 3.0, mtowFieldLength: 2100, vAppFactor: 1.23 },
      flaps: flaps([
        { name: '0', pos: 0.00, cl: 0.00, cd: 0.000, alphaStall: 18.0, vfe: 999, slat: 0.00, pitchTrim: 0.0 },
        { name: '1', pos: 0.16, cl: 0.30, cd: 0.011, alphaStall: 17.4, vfe: 230, slat: 0.35, pitchTrim: -0.010 },
        { name: '1+F', pos: 0.28, cl: 0.50, cd: 0.021, alphaStall: 17.0, vfe: 215, slat: 0.55, pitchTrim: -0.018 },
        { name: '2', pos: 0.48, cl: 0.80, cd: 0.038, alphaStall: 16.4, vfe: 200, slat: 0.75, pitchTrim: -0.030 },
        { name: '3', pos: 0.74, cl: 1.18, cd: 0.060, alphaStall: 15.6, vfe: 185, slat: 0.95, pitchTrim: -0.046 },
        { name: 'FULL', pos: 1.00, cl: 1.55, cd: 0.094, alphaStall: 15.0, vfe: 177, slat: 1.00, pitchTrim: -0.062 }
      ]),
      systems: {
        hydraulics: 3, electrics: 3, adirs: 3, fms: 2, apu: 'APS 3200',
        fuelTanks: ['L Inner', 'L Outer', 'C', 'R Inner', 'R Outer'],
        hasHUD: false, autoBrake: ['OFF', 'LO', '2', '3', 'MED', 'HI'], hasTCAS: true, hasEGPWS: true,
        hasWeatherRadar: true, hasAutoLand: true, hasThrustReverser: true, hasSpoilers: 10, hasFlyByWire: true,
        flyByWire: { envelopeProtection: true, alphaProt: 14.2, alphaMax: 16.5, bankLimit: 67, highSpeedProt: true, pitchTrimAuto: true }
      },
      lights: { landing: 2, taxi: 1, runwayTurnoff: 2, strobe: 3, beacon: 2, nav: 3, logo: 2, wing: 2 },
      livery: { body: 0xf5f6f8, belly: 0xd4d9df, accent: 0x4f8fc0, tail: 0x4f8fc0, stripe: 0x9cc8e6, engine: 0xdfe3e8, wing: 0xe0e3e7, gear: 0x9aa0a6, cockpit: 0x101418 }
    },

    /* =============== 空客 A321neo =============== */
    'A321neo': {
      key: 'A321neo', name: 'Airbus A321neo', nameZh: '空客 A321neo',
      manufacturer: 'Airbus', icaoType: 'A21N', class: 'narrowbody',
      engines: {
        model: 'CFM LEAP-1A32', count: 2, maxThrust: 143000, bypass: 11.0,
        fanDiameter: 1.98, n1Idle: 22.0, n1Max: 100, spoolUp: 2.5, spoolDown: 3.4,
        startTime: 36, tsfcCruise: 0.0540, tsfcSL: 0.0326,
        egtIdle: 400, egtMax: 940, egtTakeoffLimit: 900
      },
      dims: {
        length: 44.51, wingspan: 35.80, height: 11.76,
        wingArea: 128.0, wingSweep: 25.0, wingDihedral: 5.0,
        wingRootChord: 7.1, wingTipChord: 1.3,
        wingPos: { x: 0, y: -1.05, z: 1.2 }, wingletHeight: 2.4, wingletCant: 20,
        tailSpan: 12.4, tailArea: 32.0, tailPos: { x: 0, y: 1.1, z: 17.0 }, tailSweep: 30,
        finHeight: 6.0, finArea: 22.0, finPos: { x: 0, y: 2.7, z: 18.0 }, finSweep: 35,
        fuselageRadius: 1.98, noseLength: 5.6, tailConeLength: 8.4, cockpitWindows: 6,
        enginePos: { x: 5.75, y: -1.45, z: 4.4 },
        engineNacelleLen: 4.6, engineNacelleDia: 2.18, pylonLen: 2.2,
        gear: {
          nose: { x: 0, z: -16.0, y: -2.05, strutLen: 2.3, wheelR: 0.40, wheelW: 0.25, wheels: 2, track: 0.78 },
          main: { x: 3.80, z: 2.2, y: -2.25, strutLen: 2.7, wheelR: 0.565, wheelW: 0.28, wheels: 4, bogie: true, track: 7.59 }
        },
        doorPositions: [-14.5, -8.0, 7.0, 14.5], windowRows: 33
      },
      mass: { oew: 50100, mtow: 97000, mlw: 79200, mzfw: 75600, maxFuel: 32940, maxPayload: 25500, paxMax: 244, crew: 7 },
      perf: { vmo: 350, mmo: 0.82, ceiling: 39800, cruiseMach: 0.78, v2Base: 142, vref: 134, approachFlap: 'FULL', takeoffFlap: '1+F', rotationRate: 3.0, mtowFieldLength: 2300, vAppFactor: 1.23 },
      flaps: flaps([
        { name: '0', pos: 0.00, cl: 0.00, cd: 0.000, alphaStall: 18.0, vfe: 999, slat: 0.00, pitchTrim: 0.0 },
        { name: '1', pos: 0.16, cl: 0.30, cd: 0.011, alphaStall: 17.4, vfe: 230, slat: 0.35, pitchTrim: -0.010 },
        { name: '1+F', pos: 0.28, cl: 0.50, cd: 0.021, alphaStall: 17.0, vfe: 215, slat: 0.55, pitchTrim: -0.018 },
        { name: '2', pos: 0.48, cl: 0.80, cd: 0.038, alphaStall: 16.4, vfe: 200, slat: 0.75, pitchTrim: -0.030 },
        { name: '3', pos: 0.74, cl: 1.18, cd: 0.060, alphaStall: 15.6, vfe: 185, slat: 0.95, pitchTrim: -0.046 },
        { name: 'FULL', pos: 1.00, cl: 1.55, cd: 0.094, alphaStall: 15.0, vfe: 177, slat: 1.00, pitchTrim: -0.062 }
      ]),
      systems: {
        hydraulics: 3, electrics: 3, adirs: 3, fms: 2, apu: 'APS 3200',
        fuelTanks: ['L Inner', 'L Outer', 'C', 'R Inner', 'R Outer'],
        hasHUD: false, autoBrake: ['OFF', 'LO', '2', '3', 'MED', 'HI'], hasTCAS: true, hasEGPWS: true,
        hasWeatherRadar: true, hasAutoLand: true, hasThrustReverser: true, hasSpoilers: 10, hasFlyByWire: true,
        flyByWire: { envelopeProtection: true, alphaProt: 14.2, alphaMax: 16.5, bankLimit: 67, highSpeedProt: true, pitchTrimAuto: true }
      },
      lights: { landing: 2, taxi: 1, runwayTurnoff: 2, strobe: 3, beacon: 2, nav: 3, logo: 2, wing: 2 },
      livery: { body: 0xf5f6f8, belly: 0xd4d9df, accent: 0x1f7a8c, tail: 0x1f7a8c, stripe: 0x7cc3c4, engine: 0xdfe3e8, wing: 0xe0e3e7, gear: 0x9aa0a6, cockpit: 0x101418 }
    },

    /* =============== 空客 A330-300 =============== */
    'A330-300': {
      key: 'A330-300', name: 'Airbus A330-300', nameZh: '空客 A330-300',
      manufacturer: 'Airbus', icaoType: 'A333', class: 'widebody',
      engines: {
        model: 'Rolls-Royce Trent 772B', count: 2, maxThrust: 320300, bypass: 5.0,
        fanDiameter: 2.47, n1Idle: 22.0, n1Max: 100, spoolUp: 3.0, spoolDown: 4.0,
        startTime: 40, tsfcCruise: 0.0570, tsfcSL: 0.0355,
        egtIdle: 390, egtMax: 950, egtTakeoffLimit: 910
      },
      dims: {
        length: 63.69, wingspan: 60.30, height: 16.83,
        wingArea: 361.6, wingSweep: 30.0, wingDihedral: 5.0,
        wingRootChord: 11.0, wingTipChord: 2.0,
        wingPos: { x: 0, y: -1.2, z: 0.6 }, wingletHeight: 2.4, wingletCant: 25,
        tailSpan: 19.0, tailArea: 70.0, tailPos: { x: 0, y: 1.6, z: 23.0 }, tailSweep: 34,
        finHeight: 10.0, finArea: 52.0, finPos: { x: 0, y: 4.4, z: 24.2 }, finSweep: 38,
        fuselageRadius: 2.82, noseLength: 8.6, tailConeLength: 13.5, cockpitWindows: 6,
        enginePos: { x: 14.6, y: -1.5, z: 5.0 },
        engineNacelleLen: 6.4, engineNacelleDia: 2.65, pylonLen: 3.2,
        gear: {
          nose: { x: 0, z: -20.0, y: -2.9, strutLen: 3.2, wheelR: 0.58, wheelW: 0.40, wheels: 2, track: 1.05 },
          main: { x: 5.35, z: 2.2, y: -3.1, strutLen: 3.8, wheelR: 1.07, wheelW: 0.40, wheels: 4, bogie: true, track: 10.7 }
        },
        doorPositions: [-19.0, -11.0, 8.0, 16.5], windowRows: 44
      },
      mass: { oew: 124500, mtow: 233000, mlw: 182000, mzfw: 173000, maxFuel: 109185, maxPayload: 45900, paxMax: 300, crew: 11 },
      perf: { vmo: 330, mmo: 0.86, ceiling: 41100, cruiseMach: 0.82, v2Base: 146, vref: 138, approachFlap: 'FULL', takeoffFlap: '1+F', rotationRate: 3.0, mtowFieldLength: 2500, vAppFactor: 1.23 },
      flaps: flaps([
        { name: '0', pos: 0.00, cl: 0.00, cd: 0.000, alphaStall: 17.5, vfe: 999, slat: 0.00, pitchTrim: 0.0 },
        { name: '1', pos: 0.16, cl: 0.31, cd: 0.012, alphaStall: 17.0, vfe: 235, slat: 0.35, pitchTrim: -0.010 },
        { name: '1+F', pos: 0.28, cl: 0.51, cd: 0.022, alphaStall: 16.7, vfe: 215, slat: 0.55, pitchTrim: -0.018 },
        { name: '2', pos: 0.48, cl: 0.81, cd: 0.039, alphaStall: 16.2, vfe: 200, slat: 0.75, pitchTrim: -0.030 },
        { name: '3', pos: 0.74, cl: 1.19, cd: 0.061, alphaStall: 15.5, vfe: 185, slat: 0.95, pitchTrim: -0.046 },
        { name: 'FULL', pos: 1.00, cl: 1.56, cd: 0.096, alphaStall: 15.0, vfe: 177, slat: 1.00, pitchTrim: -0.062 }
      ]),
      systems: {
        hydraulics: 3, electrics: 4, adirs: 3, fms: 2, apu: 'APS 3200',
        fuelTanks: ['L Inner', 'L Outer', 'C', 'R Inner', 'R Outer'],
        hasHUD: false, autoBrake: ['OFF', 'LO', '2', '3', 'MED', 'HI'], hasTCAS: true, hasEGPWS: true,
        hasWeatherRadar: true, hasAutoLand: true, hasThrustReverser: true, hasSpoilers: 12, hasFlyByWire: true,
        flyByWire: { envelopeProtection: true, alphaProt: 14.5, alphaMax: 16.8, bankLimit: 67, highSpeedProt: true, pitchTrimAuto: true }
      },
      lights: { landing: 2, taxi: 1, runwayTurnoff: 2, strobe: 3, beacon: 2, nav: 3, logo: 2, wing: 2 },
      livery: { body: 0xf5f6f8, belly: 0xd4d9df, accent: 0x55407a, tail: 0x55407a, stripe: 0xa58cc7, engine: 0xdfe3e8, wing: 0xe0e3e7, gear: 0x9aa0a6, cockpit: 0x101418 }
    },

    /* =============== 波音 737-800 =============== */
    'B737-800': {
      key: 'B737-800', name: 'Boeing 737-800', nameZh: '波音 737-800',
      manufacturer: 'Boeing', icaoType: 'B738', class: 'narrowbody',
      engines: {
        model: 'CFM56-7B26', count: 2, maxThrust: 117400, bypass: 5.1,
        fanDiameter: 1.55, n1Idle: 24.0, n1Max: 100, spoolUp: 2.2, spoolDown: 3.0,
        startTime: 30, tsfcCruise: 0.0600, tsfcSL: 0.0370,
        egtIdle: 400, egtMax: 925, egtTakeoffLimit: 900
      },
      dims: {
        length: 39.47, wingspan: 35.79, height: 12.55,
        wingArea: 124.6, wingSweep: 25.0, wingDihedral: 6.0,
        wingRootChord: 7.3, wingTipChord: 1.6,
        wingPos: { x: 0, y: -1.15, z: -0.4 }, wingletHeight: 2.4, wingletCant: 15,
        tailSpan: 14.35, tailArea: 32.8, tailPos: { x: 0, y: 1.2, z: 14.8 }, tailSweep: 30,
        finHeight: 7.16, finArea: 26.4, finPos: { x: 0, y: 3.0, z: 15.8 }, finSweep: 35,
        fuselageRadius: 1.88, noseLength: 5.2, tailConeLength: 7.6, cockpitWindows: 6,
        enginePos: { x: 5.25, y: -1.35, z: 2.9 },
        engineNacelleLen: 4.0, engineNacelleDia: 1.75, pylonLen: 2.0,
        gear: {
          nose: { x: 0, z: -13.0, y: -1.95, strutLen: 2.2, wheelR: 0.38, wheelW: 0.24, wheels: 2, track: 0.75 },
          main: { x: 2.86, z: 0.9, y: -2.1, strutLen: 2.4, wheelR: 0.565, wheelW: 0.28, wheels: 2, bogie: false, track: 5.72 }
        },
        doorPositions: [-11.9, -6.0, 5.5, 12.0], windowRows: 32
      },
      mass: { oew: 41413, mtow: 79015, mlw: 66360, mzfw: 62730, maxFuel: 26020, maxPayload: 20400, paxMax: 189, crew: 6 },
      perf: { vmo: 340, mmo: 0.82, ceiling: 41000, cruiseMach: 0.785, v2Base: 140, vref: 132, approachFlap: '30', takeoffFlap: '5', rotationRate: 2.8, mtowFieldLength: 2300, vAppFactor: 1.23 },
      isBoeing: true,
      flaps: flaps([
        { name: 'UP', pos: 0.00, cl: 0.00, cd: 0.000, alphaStall: 17.5, vfe: 999, slat: 0.00, pitchTrim: 0.0 },
        { name: '1', pos: 0.11, cl: 0.22, cd: 0.010, alphaStall: 17.2, vfe: 230, slat: 0.30, pitchTrim: -0.008 },
        { name: '2', pos: 0.22, cl: 0.40, cd: 0.018, alphaStall: 16.9, vfe: 230, slat: 0.45, pitchTrim: -0.014 },
        { name: '5', pos: 0.36, cl: 0.62, cd: 0.028, alphaStall: 16.5, vfe: 215, slat: 0.60, pitchTrim: -0.022 },
        { name: '10', pos: 0.50, cl: 0.86, cd: 0.040, alphaStall: 16.0, vfe: 195, slat: 0.72, pitchTrim: -0.030 },
        { name: '15', pos: 0.62, cl: 1.06, cd: 0.052, alphaStall: 15.7, vfe: 195, slat: 0.80, pitchTrim: -0.038 },
        { name: '25', pos: 0.78, cl: 1.30, cd: 0.068, alphaStall: 15.3, vfe: 170, slat: 0.90, pitchTrim: -0.048 },
        { name: '30', pos: 0.89, cl: 1.45, cd: 0.082, alphaStall: 15.0, vfe: 165, slat: 0.96, pitchTrim: -0.056 },
        { name: '40', pos: 1.00, cl: 1.60, cd: 0.098, alphaStall: 14.8, vfe: 156, slat: 1.00, pitchTrim: -0.064 }
      ]),
      systems: {
        hydraulics: 3, electrics: 3, adirs: 2, fms: 2, apu: 'GTCP85-129',
        fuelTanks: ['L Main', 'C', 'R Main'],
        hasHUD: false, autoBrake: ['OFF', '1', '2', '3', 'MAX'], hasTCAS: true, hasEGPWS: true,
        hasWeatherRadar: true, hasAutoLand: true, hasThrustReverser: true, hasSpoilers: 8, hasFlyByWire: false,
        flyByWire: { envelopeProtection: false, alphaProt: 0, alphaMax: 0, bankLimit: 0, highSpeedProt: false, pitchTrimAuto: false },
        // beta 0.3.1: 抖杆器 + 失速保护 (波音式: 抖杆 → 升降舵抬头权限逐渐收回 → 推杆器); 不是空客式的迎角指令律
        stallProtection: { shakerMarginDeg: 3.0, limitMarginDeg: 1.2 }
      },
      lights: { landing: 2, taxi: 1, runwayTurnoff: 2, strobe: 3, beacon: 2, nav: 3, logo: 2, wing: 2 },
      livery: { body: 0xf7f8fa, belly: 0xd0d5db, accent: 0x2e3138, tail: 0x2e3138, stripe: 0x7d848e, engine: 0xdde1e6, wing: 0xe0e3e7, gear: 0x9aa0a6, cockpit: 0x0e1216 }
    },

    /* =============== 波音 737 MAX 8 =============== */
    'B737-MAX8': {
      key: 'B737-MAX8', name: 'Boeing 737 MAX 8', nameZh: '波音 737 MAX 8',
      manufacturer: 'Boeing', icaoType: 'B38M', class: 'narrowbody',
      engines: {
        model: 'CFM LEAP-1B27', count: 2, maxThrust: 124600, bypass: 9.0,
        fanDiameter: 1.76, n1Idle: 24.0, n1Max: 100, spoolUp: 2.2, spoolDown: 3.1,
        startTime: 32, tsfcCruise: 0.0570, tsfcSL: 0.0350,
        egtIdle: 400, egtMax: 930, egtTakeoffLimit: 900
      },
      dims: {
        length: 39.52, wingspan: 35.92, height: 12.30,
        wingArea: 127.0, wingSweep: 25.0, wingDihedral: 6.0,
        wingRootChord: 7.3, wingTipChord: 1.6,
        wingPos: { x: 0, y: -1.15, z: -0.4 }, wingletHeight: 2.6, wingletCant: 12,
        tailSpan: 14.35, tailArea: 33.0, tailPos: { x: 0, y: 1.2, z: 14.9 }, tailSweep: 30,
        finHeight: 7.16, finArea: 26.5, finPos: { x: 0, y: 3.0, z: 15.9 }, finSweep: 36,
        fuselageRadius: 1.88, noseLength: 5.2, tailConeLength: 7.6, cockpitWindows: 6,
        enginePos: { x: 5.35, y: -1.20, z: 2.4 },
        engineNacelleLen: 4.3, engineNacelleDia: 2.05, pylonLen: 2.0,
        gear: {
          nose: { x: 0, z: -13.0, y: -1.95, strutLen: 2.35, wheelR: 0.38, wheelW: 0.24, wheels: 2, track: 0.75 },
          main: { x: 2.86, z: 0.9, y: -2.1, strutLen: 2.45, wheelR: 0.565, wheelW: 0.28, wheels: 2, bogie: false, track: 5.72 }
        },
        doorPositions: [-11.9, -6.0, 5.5, 12.0], windowRows: 32
      },
      mass: { oew: 45070, mtow: 82190, mlw: 69309, mzfw: 65952, maxFuel: 25816, maxPayload: 20882, paxMax: 210, crew: 6 },
      perf: { vmo: 340, mmo: 0.82, ceiling: 41000, cruiseMach: 0.79, v2Base: 141, vref: 133, approachFlap: '30', takeoffFlap: '5', rotationRate: 2.8, mtowFieldLength: 2350, vAppFactor: 1.23 },
      isBoeing: true,
      flaps: flaps([
        { name: 'UP', pos: 0.00, cl: 0.00, cd: 0.000, alphaStall: 17.5, vfe: 999, slat: 0.00, pitchTrim: 0.0 },
        { name: '1', pos: 0.11, cl: 0.22, cd: 0.010, alphaStall: 17.2, vfe: 230, slat: 0.30, pitchTrim: -0.008 },
        { name: '2', pos: 0.22, cl: 0.40, cd: 0.018, alphaStall: 16.9, vfe: 230, slat: 0.45, pitchTrim: -0.014 },
        { name: '5', pos: 0.36, cl: 0.62, cd: 0.028, alphaStall: 16.5, vfe: 215, slat: 0.60, pitchTrim: -0.022 },
        { name: '10', pos: 0.50, cl: 0.86, cd: 0.040, alphaStall: 16.0, vfe: 195, slat: 0.72, pitchTrim: -0.030 },
        { name: '15', pos: 0.62, cl: 1.06, cd: 0.052, alphaStall: 15.7, vfe: 195, slat: 0.80, pitchTrim: -0.038 },
        { name: '25', pos: 0.78, cl: 1.30, cd: 0.068, alphaStall: 15.3, vfe: 170, slat: 0.90, pitchTrim: -0.048 },
        { name: '30', pos: 0.89, cl: 1.45, cd: 0.082, alphaStall: 15.0, vfe: 165, slat: 0.96, pitchTrim: -0.056 },
        { name: '40', pos: 1.00, cl: 1.60, cd: 0.098, alphaStall: 14.8, vfe: 156, slat: 1.00, pitchTrim: -0.064 }
      ]),
      systems: {
        hydraulics: 3, electrics: 3, adirs: 2, fms: 2, apu: 'GTCP85-129',
        fuelTanks: ['L Main', 'C', 'R Main'],
        hasHUD: false, autoBrake: ['OFF', '1', '2', '3', 'MAX'], hasTCAS: true, hasEGPWS: true,
        hasWeatherRadar: true, hasAutoLand: true, hasThrustReverser: true, hasSpoilers: 8, hasFlyByWire: false,
        hasMCAS: true, hasWinglets: 'AT',
        flyByWire: { envelopeProtection: false, alphaProt: 0, alphaMax: 0, bankLimit: 0, highSpeedProt: false, pitchTrimAuto: false },
        // beta 0.3.1: 抖杆器 + 失速保护 (波音式: 抖杆 → 升降舵抬头权限逐渐收回 → 推杆器); 不是空客式的迎角指令律
        stallProtection: { shakerMarginDeg: 3.0, limitMarginDeg: 1.2 }
      },
      lights: { landing: 2, taxi: 1, runwayTurnoff: 2, strobe: 3, beacon: 2, nav: 3, logo: 2, wing: 2 },
      livery: { body: 0xf7f8fa, belly: 0xd0d5db, accent: 0x2a6f97, tail: 0x2a6f97, stripe: 0x61c3a0, engine: 0xdde1e6, wing: 0xe0e3e7, gear: 0x9aa0a6, cockpit: 0x0e1216 }
    },

    /* =============== 波音 777-300ER =============== */
    'B777-300ER': {
      key: 'B777-300ER', name: 'Boeing 777-300ER', nameZh: '波音 777-300ER',
      manufacturer: 'Boeing', icaoType: 'B77W', class: 'widebody',
      engines: {
        model: 'GE90-115B', count: 2, maxThrust: 512800, bypass: 8.4,
        fanDiameter: 3.25, n1Idle: 22.0, n1Max: 100, spoolUp: 3.6, spoolDown: 4.8,
        startTime: 48, tsfcCruise: 0.0520, tsfcSL: 0.0320,
        egtIdle: 380, egtMax: 950, egtTakeoffLimit: 910
      },
      dims: {
        length: 73.86, wingspan: 64.80, height: 18.50,
        wingArea: 436.8, wingSweep: 31.6, wingDihedral: 5.0,
        wingRootChord: 13.4, wingTipChord: 2.6,
        wingPos: { x: 0, y: -1.35, z: -0.6 }, wingletHeight: 3.6, wingletCant: 0,
        tailSpan: 21.0, tailArea: 88.0, tailPos: { x: 0, y: 1.8, z: 27.0 }, tailSweep: 35,
        finHeight: 11.0, finArea: 62.0, finPos: { x: 0, y: 5.0, z: 28.5 }, finSweep: 42,
        fuselageRadius: 3.10, noseLength: 9.8, tailConeLength: 15.5, cockpitWindows: 6,
        enginePos: { x: 17.4, y: -1.8, z: 4.6 },
        engineNacelleLen: 8.4, engineNacelleDia: 3.40, pylonLen: 3.8,
        gear: {
          nose: { x: 0, z: -24.5, y: -3.3, strutLen: 3.6, wheelR: 0.65, wheelW: 0.45, wheels: 2, track: 1.2 },
          main: { x: 6.0, z: 3.0, y: -3.5, strutLen: 4.4, wheelR: 1.25, wheelW: 0.48, wheels: 6, bogie: true, track: 12.9 }
        },
        doorPositions: [-23.5, -14.5, 9.5, 20.5], windowRows: 52
      },
      mass: { oew: 167800, mtow: 351500, mlw: 251300, mzfw: 237700, maxFuel: 145500, maxPayload: 69900, paxMax: 550, crew: 14 },
      perf: { vmo: 330, mmo: 0.84, ceiling: 43100, cruiseMach: 0.84, v2Base: 155, vref: 145, approachFlap: '30', takeoffFlap: '15', rotationRate: 3.0, mtowFieldLength: 3200, vAppFactor: 1.23 },
      isBoeing: true,
      flaps: flaps([
        { name: 'UP', pos: 0.00, cl: 0.00, cd: 0.000, alphaStall: 17.0, vfe: 999, slat: 0.00, pitchTrim: 0.0 },
        { name: '1', pos: 0.12, cl: 0.24, cd: 0.011, alphaStall: 16.8, vfe: 255, slat: 0.30, pitchTrim: -0.008 },
        { name: '5', pos: 0.30, cl: 0.58, cd: 0.026, alphaStall: 16.3, vfe: 235, slat: 0.55, pitchTrim: -0.020 },
        { name: '15', pos: 0.55, cl: 0.98, cd: 0.047, alphaStall: 15.7, vfe: 195, slat: 0.78, pitchTrim: -0.034 },
        { name: '20', pos: 0.70, cl: 1.18, cd: 0.060, alphaStall: 15.4, vfe: 180, slat: 0.88, pitchTrim: -0.044 },
        { name: '25', pos: 0.85, cl: 1.34, cd: 0.072, alphaStall: 15.1, vfe: 170, slat: 0.94, pitchTrim: -0.052 },
        { name: '30', pos: 1.00, cl: 1.52, cd: 0.090, alphaStall: 14.8, vfe: 160, slat: 1.00, pitchTrim: -0.062 }
      ]),
      systems: {
        hydraulics: 3, electrics: 4, adirs: 3, fms: 2, apu: 'GTCP331-500',
        fuelTanks: ['L Main', 'C', 'R Main'],
        hasHUD: false, autoBrake: ['OFF', '1', '2', '3', 'MAX'], hasTCAS: true, hasEGPWS: true,
        hasWeatherRadar: true, hasAutoLand: true, hasThrustReverser: true, hasSpoilers: 14, hasFlyByWire: true,
        flyByWire: { envelopeProtection: true, alphaProt: 14.5, alphaMax: 17.0, bankLimit: 35, highSpeedProt: true, pitchTrimAuto: true }
      },
      lights: { landing: 2, taxi: 1, runwayTurnoff: 2, strobe: 3, beacon: 2, nav: 3, logo: 2, wing: 2 },
      livery: { body: 0xf7f8fa, belly: 0xcfd4da, accent: 0x2f5d4a, tail: 0x2f5d4a, stripe: 0x8fbfa5, engine: 0xdde1e6, wing: 0xe0e3e7, gear: 0x9aa0a6, cockpit: 0x0e1216 }
    },

    /* =============== 波音 787-9 =============== */
    'B787-9': {
      key: 'B787-9', name: 'Boeing 787-9 Dreamliner', nameZh: '波音 787-9 梦想客机',
      manufacturer: 'Boeing', icaoType: 'B789', class: 'widebody',
      engines: {
        model: 'GEnx-1B76', count: 2, maxThrust: 338000, bypass: 9.4,
        fanDiameter: 2.82, n1Idle: 22.0, n1Max: 100, spoolUp: 3.2, spoolDown: 4.3,
        startTime: 44, tsfcCruise: 0.0495, tsfcSL: 0.0305,
        egtIdle: 380, egtMax: 950, egtTakeoffLimit: 910
      },
      dims: {
        length: 62.81, wingspan: 60.12, height: 17.02,
        wingArea: 377.0, wingSweep: 32.2, wingDihedral: 6.0,
        wingRootChord: 12.0, wingTipChord: 2.2,
        wingPos: { x: 0, y: -1.2, z: 0.2 }, wingletHeight: 0, wingletCant: 0, raked: true,
        tailSpan: 19.0, tailArea: 74.0, tailPos: { x: 0, y: 1.6, z: 23.5 }, tailSweep: 35,
        finHeight: 10.4, finArea: 55.0, finPos: { x: 0, y: 4.6, z: 24.8 }, finSweep: 40,
        fuselageRadius: 2.98, noseLength: 9.0, tailConeLength: 14.0, cockpitWindows: 4,
        enginePos: { x: 15.4, y: -1.6, z: 4.6 },
        engineNacelleLen: 7.0, engineNacelleDia: 3.00, pylonLen: 3.4,
        gear: {
          nose: { x: 0, z: -21.0, y: -3.0, strutLen: 3.3, wheelR: 0.60, wheelW: 0.42, wheels: 2, track: 1.1 },
          main: { x: 5.6, z: 2.6, y: -3.2, strutLen: 4.0, wheelR: 1.12, wheelW: 0.44, wheels: 4, bogie: true, track: 11.2 }
        },
        doorPositions: [-20.0, -11.5, 8.5, 18.5], windowRows: 42
      },
      mass: { oew: 128850, mtow: 254000, mlw: 192800, mzfw: 181400, maxFuel: 126900, maxPayload: 52500, paxMax: 420, crew: 12 },
      perf: { vmo: 340, mmo: 0.90, ceiling: 43000, cruiseMach: 0.85, v2Base: 147, vref: 139, approachFlap: '30', takeoffFlap: '5', rotationRate: 3.0, mtowFieldLength: 2600, vAppFactor: 1.23 },
      isBoeing: true,
      flaps: flaps([
        { name: 'UP', pos: 0.00, cl: 0.00, cd: 0.000, alphaStall: 17.5, vfe: 999, slat: 0.00, pitchTrim: 0.0 },
        { name: '1', pos: 0.14, cl: 0.26, cd: 0.011, alphaStall: 17.2, vfe: 250, slat: 0.30, pitchTrim: -0.008 },
        { name: '5', pos: 0.34, cl: 0.62, cd: 0.027, alphaStall: 16.6, vfe: 230, slat: 0.55, pitchTrim: -0.020 },
        { name: '15', pos: 0.58, cl: 1.00, cd: 0.048, alphaStall: 16.0, vfe: 195, slat: 0.78, pitchTrim: -0.034 },
        { name: '20', pos: 0.72, cl: 1.20, cd: 0.062, alphaStall: 15.6, vfe: 180, slat: 0.88, pitchTrim: -0.044 },
        { name: '25', pos: 0.86, cl: 1.36, cd: 0.074, alphaStall: 15.3, vfe: 170, slat: 0.94, pitchTrim: -0.052 },
        { name: '30', pos: 1.00, cl: 1.55, cd: 0.092, alphaStall: 15.0, vfe: 160, slat: 1.00, pitchTrim: -0.062 }
      ]),
      systems: {
        hydraulics: 2, electrics: 4, adirs: 3, fms: 2, apu: 'APS 5000',
        fuelTanks: ['L Main', 'C', 'R Main'],
        hasHUD: true, autoBrake: ['OFF', '1', '2', '3', 'MAX'], hasTCAS: true, hasEGPWS: true,
        hasWeatherRadar: true, hasAutoLand: true, hasThrustReverser: true, hasSpoilers: 14, hasFlyByWire: true,
        flyByWire: { envelopeProtection: true, alphaProt: 14.5, alphaMax: 17.0, bankLimit: 35, highSpeedProt: true, pitchTrimAuto: true }
      },
      lights: { landing: 2, taxi: 1, runwayTurnoff: 2, strobe: 3, beacon: 2, nav: 3, logo: 2, wing: 2 },
      livery: { body: 0xf7f8fa, belly: 0xcfd4da, accent: 0x9c7a54, tail: 0x9c7a54, stripe: 0xcdb48c, engine: 0xdde1e6, wing: 0xe0e3e7, gear: 0x9aa0a6, cockpit: 0x0e1216 }
    },

    /* =============== 中国商飞 C919 =============== */
    'C919': {
      key: 'C919', name: 'COMAC C919', nameZh: '中国商飞 C919',
      manufacturer: 'COMAC', icaoType: 'C919', class: 'narrowbody',
      engines: {
        model: 'CFM LEAP-1C28', count: 2, maxThrust: 124500, bypass: 11.0,
        fanDiameter: 1.98, n1Idle: 22.0, n1Max: 100, spoolUp: 2.4, spoolDown: 3.3,
        startTime: 34, tsfcCruise: 0.0550, tsfcSL: 0.0335,
        egtIdle: 400, egtMax: 940, egtTakeoffLimit: 900
      },
      dims: {
        length: 38.90, wingspan: 35.80, height: 11.95,
        wingArea: 129.0, wingSweep: 25.0, wingDihedral: 5.0,
        wingRootChord: 7.2, wingTipChord: 1.5,
        wingPos: { x: 0, y: -1.10, z: 0.2 }, wingletHeight: 2.2, wingletCant: 20,
        tailSpan: 13.0, tailArea: 33.0, tailPos: { x: 0, y: 1.2, z: 14.5 }, tailSweep: 30,
        finHeight: 6.4, finArea: 23.0, finPos: { x: 0, y: 2.8, z: 15.4 }, finSweep: 35,
        fuselageRadius: 1.96, noseLength: 5.5, tailConeLength: 8.6, cockpitWindows: 6,
        enginePos: { x: 5.6, y: -1.40, z: 3.4 },
        engineNacelleLen: 4.5, engineNacelleDia: 2.15, pylonLen: 2.1,
        gear: {
          nose: { x: 0, z: -12.8, y: -2.05, strutLen: 2.3, wheelR: 0.40, wheelW: 0.25, wheels: 2, track: 0.78 },
          main: { x: 3.70, z: 1.3, y: -2.25, strutLen: 2.7, wheelR: 0.56, wheelW: 0.28, wheels: 2, bogie: false, track: 7.40 }
        },
        doorPositions: [-11.6, -6.4, 5.2, 11.2], windowRows: 27
      },
      mass: { oew: 42100, mtow: 72500, mlw: 66600, mzfw: 59700, maxFuel: 21900, maxPayload: 18900, paxMax: 192, crew: 6 },
      perf: { vmo: 340, mmo: 0.82, ceiling: 39800, cruiseMach: 0.785, v2Base: 139, vref: 131, approachFlap: 'FULL', takeoffFlap: '1+F', rotationRate: 3.0, mtowFieldLength: 2100, vAppFactor: 1.23 },
      flaps: flaps([
        { name: '0', pos: 0.00, cl: 0.00, cd: 0.000, alphaStall: 17.8, vfe: 999, slat: 0.00, pitchTrim: 0.0 },
        { name: '1', pos: 0.16, cl: 0.30, cd: 0.011, alphaStall: 17.3, vfe: 230, slat: 0.35, pitchTrim: -0.010 },
        { name: '1+F', pos: 0.28, cl: 0.50, cd: 0.021, alphaStall: 16.9, vfe: 215, slat: 0.55, pitchTrim: -0.018 },
        { name: '2', pos: 0.48, cl: 0.80, cd: 0.038, alphaStall: 16.3, vfe: 200, slat: 0.75, pitchTrim: -0.030 },
        { name: '3', pos: 0.74, cl: 1.18, cd: 0.060, alphaStall: 15.6, vfe: 185, slat: 0.95, pitchTrim: -0.046 },
        { name: 'FULL', pos: 1.00, cl: 1.56, cd: 0.094, alphaStall: 15.0, vfe: 177, slat: 1.00, pitchTrim: -0.062 }
      ]),
      systems: {
        hydraulics: 3, electrics: 3, adirs: 3, fms: 2, apu: 'APS 3200',
        fuelTanks: ['L Inner', 'L Outer', 'C', 'R Inner', 'R Outer'],
        hasHUD: true, autoBrake: ['OFF', 'LO', '2', '3', 'MED', 'HI'], hasTCAS: true, hasEGPWS: true,
        hasWeatherRadar: true, hasAutoLand: true, hasThrustReverser: true, hasSpoilers: 10, hasFlyByWire: true,
        flyByWire: { envelopeProtection: true, alphaProt: 14.3, alphaMax: 16.6, bankLimit: 67, highSpeedProt: true, pitchTrimAuto: true }
      },
      lights: { landing: 2, taxi: 1, runwayTurnoff: 2, strobe: 3, beacon: 2, nav: 3, logo: 2, wing: 2 },
      livery: { body: 0xf7f8fa, belly: 0xd2d7dd, accent: 0xa23b48, tail: 0xa23b48, stripe: 0x8d939a, engine: 0xdde1e6, wing: 0xe0e3e7, gear: 0x9aa0a6, cockpit: 0x0e1216 }
    },

    /* =============== 巴航工业 E190 =============== */
    'E190': {
      key: 'E190', name: 'Embraer E190', nameZh: '巴航工业 E190',
      manufacturer: 'Embraer', icaoType: 'E190', class: 'regional',
      engines: {
        model: 'GE CF34-10E', count: 2, maxThrust: 82300, bypass: 5.4,
        fanDiameter: 1.35, n1Idle: 26.0, n1Max: 100, spoolUp: 2.0, spoolDown: 2.8,
        startTime: 26, tsfcCruise: 0.0640, tsfcSL: 0.0390,
        egtIdle: 410, egtMax: 920, egtTakeoffLimit: 890
      },
      dims: {
        length: 36.24, wingspan: 28.72, height: 10.57,
        wingArea: 92.5, wingSweep: 26.0, wingDihedral: 5.0,
        wingRootChord: 6.4, wingTipChord: 1.2,
        wingPos: { x: 0, y: -0.95, z: 0.4 }, wingletHeight: 1.8, wingletCant: 22,
        tailSpan: 11.0, tailArea: 26.0, tailPos: { x: 0, y: 1.0, z: 13.0 }, tailSweep: 30,
        finHeight: 5.4, finArea: 18.0, finPos: { x: 0, y: 2.5, z: 13.8 }, finSweep: 34,
        fuselageRadius: 1.62, noseLength: 4.8, tailConeLength: 7.2, cockpitWindows: 6,
        enginePos: { x: 4.55, y: -1.15, z: 2.6 },
        engineNacelleLen: 3.4, engineNacelleDia: 1.55, pylonLen: 1.7,
        gear: {
          nose: { x: 0, z: -11.4, y: -1.80, strutLen: 2.0, wheelR: 0.34, wheelW: 0.20, wheels: 2, track: 0.66 },
          main: { x: 2.95, z: 1.0, y: -1.90, strutLen: 2.2, wheelR: 0.48, wheelW: 0.24, wheels: 2, bogie: false, track: 5.90 }
        },
        doorPositions: [-10.4, -5.4, 5.0, 10.6], windowRows: 25
      },
      mass: { oew: 28000, mtow: 51800, mlw: 45200, mzfw: 43500, maxFuel: 16150, maxPayload: 13650, paxMax: 114, crew: 5 },
      perf: { vmo: 320, mmo: 0.78, ceiling: 41000, cruiseMach: 0.78, v2Base: 132, vref: 124, approachFlap: 'FULL', takeoffFlap: '2', rotationRate: 2.8, mtowFieldLength: 1750, vAppFactor: 1.23 },
      flaps: flaps([
        { name: '0', pos: 0.00, cl: 0.00, cd: 0.000, alphaStall: 18.0, vfe: 999, slat: 0.00, pitchTrim: 0.0 },
        { name: '1', pos: 0.20, cl: 0.32, cd: 0.013, alphaStall: 17.4, vfe: 230, slat: 0.40, pitchTrim: -0.012 },
        { name: '2', pos: 0.40, cl: 0.62, cd: 0.028, alphaStall: 16.8, vfe: 215, slat: 0.65, pitchTrim: -0.024 },
        { name: '3', pos: 0.60, cl: 0.92, cd: 0.044, alphaStall: 16.2, vfe: 195, slat: 0.82, pitchTrim: -0.036 },
        { name: '4', pos: 0.80, cl: 1.24, cd: 0.062, alphaStall: 15.6, vfe: 180, slat: 0.94, pitchTrim: -0.048 },
        { name: 'FULL', pos: 1.00, cl: 1.58, cd: 0.090, alphaStall: 15.0, vfe: 165, slat: 1.00, pitchTrim: -0.062 }
      ]),
      systems: {
        hydraulics: 2, electrics: 2, adirs: 2, fms: 2, apu: 'APS 500',
        fuelTanks: ['L', 'R'],
        hasHUD: false, autoBrake: ['OFF', 'LO', 'MED', 'HI'], hasTCAS: true, hasEGPWS: true,
        hasWeatherRadar: true, hasAutoLand: true, hasThrustReverser: true, hasSpoilers: 6, hasFlyByWire: false,
        flyByWire: { envelopeProtection: false, alphaProt: 0, alphaMax: 0, bankLimit: 0, highSpeedProt: false, pitchTrimAuto: false },
        // beta 0.3.1: 抖杆器 + 失速保护 (波音式: 抖杆 → 升降舵抬头权限逐渐收回 → 推杆器); 不是空客式的迎角指令律
        stallProtection: { shakerMarginDeg: 3.0, limitMarginDeg: 1.2 }
      },
      lights: { landing: 2, taxi: 1, runwayTurnoff: 2, strobe: 3, beacon: 2, nav: 3, logo: 2, wing: 2 },
      livery: { body: 0xf7f8fa, belly: 0xd2d7dd, accent: 0xd8643f, tail: 0xd8643f, stripe: 0xe9a66b, engine: 0xdde1e6, wing: 0xe0e3e7, gear: 0x9aa0a6, cockpit: 0x0e1216 }
    }
  };

  /* ---------------------------------------------------------------------
     3.5 起落架 / 发动机几何自标定
     ---------------------------------------------------------------------
     机型数据里的起落架支柱长度与发动机吊挂高度是"看起来合理"的估计值,
     但它们之间必须彼此一致, 否则飞机停在地面时会出现前轮悬空、
     机身被弹簧弹飞等非物理现象。这里统一按真实客机的离地间隙重新标定:

       参考点离地高度 H = 1.84 × 机身半径 + 主轮半径
         (= 机身中心线离地高度, 对应机腹离地约 0.84×机身直径)
       主起落架支柱长 = H − 主起落架挂点下探量 − 主轮半径
       前起落架支柱长 = H − 前起落架挂点下探量 − 前轮半径
       发动机吊挂高度按真实的地面间隙反推
     --------------------------------------------------------------------- */
  Object.keys(DB).forEach(function (k) {
    var d = DB[k].dims;
    var gn = d.gear.nose, gm = d.gear.main;

    // --- 参考点离地高度 ---
    var H = 1.84 * d.fuselageRadius + gm.wheelR;
    d.refHeight = H;

    // --- 起落架支柱长度 (使所有机轮底面共面) ---
    gn.strutLen = Math.max(0.35, H - (-gn.y) - gn.wheelR);
    gm.strutLen = Math.max(0.35, H - (-gm.y) - gm.wheelR);

    // --- 发动机地面间隙 (真实值约 0.5 ~ 0.8 m) ---
    if (d.enginePos && d.engineNacelleDia) {
      var groundClear = DB[k].class === 'regional' ? 0.45 : 0.62;
      var engY = -(H - groundClear - d.engineNacelleDia * 0.5);
      // 发动机不应高于机翼挂点太多
      var wingY = d.wingPos ? d.wingPos.y : -1.0;
      d.enginePos.y = Math.min(engY, wingY - 0.7);
    }

    // --- 推力线相对重心的竖直力臂 ---
    // 几何上发动机吊舱离参考点很远 (4 m 以上), 但真正的推力线到重心的距离
    // 只有 1 m 左右。若直接用几何值, 大推力会产生几十 MN·m 的抬头力矩,
    // 升降舵将无法配平。这里按真实值单独标定。
    var engOffset = d.enginePos ? -d.enginePos.y : 1.5;
    d.thrustArmZ = U.clamp(engOffset * 0.40, 0.55, 1.85);

    // --- 机翼离地间隙检查 (翼尖不应低于 1.2 m) ---
    if (d.wingPos) {
      var tipDrop = d.wingPos.y - Math.tan((d.wingDihedral || 5) * Math.PI / 180) * (d.wingspan / 2);
      d.wingTipHeight = H + tipDrop - 0.4;
    }

    // --- 机头/尾部离地净空 (供擦机尾判定) ---
    d.tailStrikeAngle = Math.atan2(H - 1.1, d.length * 0.45) * 180 / Math.PI;
  });

  /* ---------------------------------------------------------------------
     4. 依据机翼几何推导气动导数 (让每架飞机有各自真实的飞行特性)
     --------------------------------------------------------------------- */
  function deriveAero(ac) {
    var d = ac.dims;
    var AR = (d.wingspan * d.wingspan) / d.wingArea;          // 展弦比
    var sweep = (d.wingSweep || 30) * Math.PI / 180;
    var taper = d.wingTipChord / d.wingRootChord;

    // 3D 升力线斜率: 由二维 2π 经后掠/展弦比修正 (DATCOM 近似)
    var CLalpha2d = 2 * Math.PI;
    var beta = Math.sqrt(Math.max(0.25, 1 - 0.0));            // 不可压近似
    var CLalpha = CLalpha2d * AR /
      (2 + Math.sqrt(AR * AR * beta * beta * (1 + Math.tan(sweep) * Math.tan(sweep) /
        (beta * beta)) + 4));
    // 机身/短舱干扰增益
    CLalpha *= 1.06;
    // 有效后掠再修正 (Mach 0.8 附近)
    CLalpha *= (1 - 0.28 * Math.tan(sweep) * 0.6);

    // Oswald 效率
    var e = 0.80 - 0.06 * Math.tan(sweep) + 0.02 * taper;
    e = U.clamp(e, 0.68, 0.90);

    // 巡航零阻: 由浸润面积/机翼参考面积比推算等效摩擦阻力系数
    // 标定依据: A350-900 在 FL350 / M0.85 / 197t 时 L/D ≈ 18.2, 对应 CD0 ≈ 0.0145
    //           B737-800 巡航 L/D ≈ 17, 对应 CD0 ≈ 0.019
    var wetted = 3.35 * d.wingArea + 2.9 * Math.PI * d.fuselageRadius * d.length;
    var CD0 = 0.00225 * (wetted / d.wingArea) - 0.0020;
    CD0 = U.clamp(CD0, 0.0125, 0.030);
    if (ac.class === 'regional') CD0 *= 1.06;
    if (ac.class === 'widebody') CD0 *= 0.985;

    // 临界马赫数: 与现代超临界翼型客机的实际阻力发散马赫数一致,
    // 约为最大使用马赫数 (MMO) 以下 0.06 ~ 0.07
    var mcrit = U.clamp(ac.perf.mmo - 0.065, 0.74, 0.86);

    var a = {};
    for (var k in AERO_BASE) a[k] = AERO_BASE[k];
    a.AR = AR;
    a.CLalpha = CLalpha;
    a.oswaldClean = e;
    a.CD0Clean = CD0;
    a.machCrit = mcrit;
    a.taper = taper;

    // 全展襟翼阻力按翼面积比例缩放 (大飞机阻力系数增长略小)
    var areaScale = U.clamp(Math.sqrt(150 / d.wingArea), 0.72, 1.25);
    a.CD0FlapFull *= areaScale;
    a.CD0Gear *= U.clamp(Math.sqrt(150 / d.wingArea), 0.80, 1.15);
    a.CD0Spoiler *= areaScale;
    a.CD0Speedbrake *= areaScale;

    // 俯仰阻尼与机翼展弦比/后掠相关
    a.CmQ = -26.0 - 6.0 * Math.tan(sweep);
    a.CnR = -0.14 - 0.05 * (1 - taper);
    a.ClP = -0.42 - 0.10 * (1 - taper);

    // 诱导阻力因子 (供外部快速查询 / FMS 计算使用)
    a.k = 1 / (Math.PI * AR * e);
    // 最大升阻比
    a.LDmax = 1 / (2 * Math.sqrt(CD0 * a.k));
    return a;
  }

  /* ---------------------------------------------------------------------
     5. 派生数据: V 速度表 / 襟翼插值
     --------------------------------------------------------------------- */
  /**
   * 在襟翼卡位之间做线性插值
   * @param {number} pos 0..1 连续的襟翼位置
   */
  function flapAt(ac, pos) {
    var f = ac.flaps;
    pos = U.clamp01(pos);
    for (var i = 0; i < f.length - 1; i++) {
      if (pos >= f[i].pos && pos <= f[i + 1].pos) {
        var t = (pos - f[i].pos) / Math.max(1e-6, f[i + 1].pos - f[i].pos);
        return {
          name: t < 0.5 ? f[i].name : f[i + 1].name,
          index: t < 0.5 ? i : i + 1,
          frac: t,
          cl: U.lerp(f[i].cl, f[i + 1].cl, t),
          cd: U.lerp(f[i].cd, f[i + 1].cd, t),
          alphaStall: U.lerp(f[i].alphaStall, f[i + 1].alphaStall, t),
          // 襟翼完全收上 (t≈0) 时没有 VFE 限制; 修正 beta 0.3 及以前: 光洁构型 230 kt 以上误报超速主警告
          vfe: (f[i].vfe > 900 && t < 0.01) ? 999 : U.lerp(f[i].vfe > 900 ? f[i + 1].vfe : f[i].vfe, f[i + 1].vfe, t),
          slat: U.lerp(f[i].slat, f[i + 1].slat, t),
          pitchTrim: U.lerp(f[i].pitchTrim, f[i + 1].pitchTrim, t)
        };
      }
    }
    var last = f[f.length - 1];
    return {
      name: last.name, index: f.length - 1, frac: 1, cl: last.cl, cd: last.cd,
      alphaStall: last.alphaStall, vfe: last.vfe, slat: last.slat, pitchTrim: last.pitchTrim
    };
  }

  FS.Aero = {
    /** 为某机型生成完整气动模型 (带缓存) */
    get: function (key) {
      var ac = DB[key];
      if (!ac) throw new Error('未知机型: ' + key);
      if (!ac._aero) ac._aero = deriveAero(ac);
      return ac._aero;
    },
    derive: deriveAero,
    flapAt: flapAt,
    /** 襟翼卡位名称列表 */
    flapDetents: function (key) { return DB[key].flaps.map(function (f) { return f.name; }); },
    /** 根据目标位置找最近的卡位索引 */
    nearestDetent: function (key, pos) {
      var f = DB[key].flaps, best = 0, bd = 1e9;
      for (var i = 0; i < f.length; i++) {
        var d = Math.abs(f[i].pos - pos);
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    },
    /** 校验速度: 返回超出 VFE 的量 (kt, 0 表示未超速) */
    vfeExceed: function (key, flapPos, iasKt) {
      var fp = flapAt(DB[key], flapPos);
      if (fp.vfe > 900) return 0;
      return Math.max(0, iasKt - fp.vfe);
    }
  };

  /* ---------------------------------------------------------------------
     6. 机型列表 (供菜单使用)
     --------------------------------------------------------------------- */
  FS.AircraftList = Object.keys(DB).map(function (k) {
    var a = DB[k];
    return {
      key: k, name: a.name, nameZh: a.nameZh,
      manufacturer: a.manufacturer, icao: a.icaoType,
      engine: a.engines.model, class: a.class,
      seats: a.mass.paxMax, range: Math.round(a.mass.maxFuel / (a.mass.mtow * 0.0000072)),
      isBoeing: !!a.isBoeing
    };
  });

  /* ---------------------------------------------------------------------
     7. 简化的航司涂装主题
     --------------------------------------------------------------------- */
  // beta 0.3: 全部改为通用中性名称的配色方案, 不对应、不模仿任何真实航空公司涂装 (只有垂尾/腰线/机腹颜色, 无标志文字)
  FS.LIVERIES = [
    { id: 'classic-white', name: '经典白', body: 0xf4f5f7, belly: 0xdfe3e8, accent: 0x9aa5b1, tail: 0xc3ccd5, stripe: 0x9aa5b1 },
    { id: 'deep-blue', name: '深海蓝', body: 0xf4f5f7, belly: 0xdfe3e8, accent: 0x1d3557, tail: 0x1d3557, stripe: 0x6a8fb3 },
    { id: 'classic-red-tail', name: '经典红尾', body: 0xf4f5f7, belly: 0xdfe3e8, accent: 0xa23b48, tail: 0xa23b48, stripe: 0x8d939a },
    { id: 'sunset-orange', name: '日落橙', body: 0xf4f5f7, belly: 0xe2e2df, accent: 0xd8643f, tail: 0xd8643f, stripe: 0xe9a66b },
    { id: 'forest-green', name: '森林绿', body: 0xf4f5f7, belly: 0xdde3df, accent: 0x2f5d4a, tail: 0x2f5d4a, stripe: 0x8fbfa5 },
    { id: 'lake-teal', name: '湖水青', body: 0xf4f5f7, belly: 0xdbe4e6, accent: 0x1f7a8c, tail: 0x1f7a8c, stripe: 0x7cc3c4 },
    { id: 'twilight-purple', name: '暮光紫', body: 0xf4f5f7, belly: 0xe0dde6, accent: 0x55407a, tail: 0x55407a, stripe: 0xa58cc7 },
    { id: 'sky-blue', name: '晴空蓝', body: 0xf4f5f7, belly: 0xdde6ee, accent: 0x4f8fc0, tail: 0x4f8fc0, stripe: 0x9cc8e6 },
    { id: 'graphite', name: '石墨黑', body: 0xf0f1f3, belly: 0xc9cdd2, accent: 0x2e3138, tail: 0x2e3138, stripe: 0x7d848e },
    { id: 'desert-sand', name: '沙丘金', body: 0xf5f3ef, belly: 0xe2ddd3, accent: 0x9c7a54, tail: 0x9c7a54, stripe: 0xcdb48c },
    { id: 'aurora', name: '极光绿蓝', body: 0xf4f5f7, belly: 0xdfe3e8, accent: 0x2a6f97, tail: 0x2a6f97, stripe: 0x61c3a0 },
    { id: 'military-gray', name: '通用灰', body: 0x8e959c, belly: 0x767c82, accent: 0x5a6068, tail: 0x5a6068, stripe: 0x40454b }
  ];
  // 旧版 (v0.1 / beta 0.2) 涂装 id 的兼容映射, 保证旧链接 ?livery= 仍可用
  FS.LIVERY_ALIASES = {
    'airbus-house': 'classic-white', ces: 'deep-blue', cca: 'classic-red-tail', csh: 'sky-blue', cxa: 'lake-teal',
    singapore: 'graphite', emirates: 'sunset-orange', lufthansa: 'desert-sand', united: 'aurora', delta: 'twilight-purple',
    ana: 'forest-green', qatar: 'twilight-purple', 'airchina-special': 'classic-red-tail'
  };

  /* ---------------------------------------------------------------------
     8. 机场数据的补充坐标 (airports.js 会读取)
     --------------------------------------------------------------------- */
  FS.CFG.defaultAirports = ['ZSPD', 'ZBAA', 'ZGGG', 'ZUUU', 'ZSSS', 'KJFK', 'KLAX', 'EGLL', 'RJTT', 'VHHH', 'WSSS', 'OMDB'];

  /* 机场数据库完整性检查 */
  Object.keys(DB).forEach(function (k) {
    var a = DB[k];
    a._aero = deriveAero(a);
    if (!a.dims.gear || !a.engines || !a.perf) FS.Log.error('机型数据不完整: ' + k);
  });

  FS.Log.info('config.js 已加载 — 机型库 ' + Object.keys(DB).length + ' 种: ' +
    Object.keys(DB).join(', '));

})(typeof window !== 'undefined' ? window : globalThis);
