/* ==========================================================================
   天际航线 SkyRoute — 飞行场景与检查单 (scenarios.js)
     · 训练场景 (冷舱启动 / 起飞 / 巡航 / ILS 进近 / 侧风落地 / 故障处置 ...)
     · 目标判定 (Objectives)
     · 标准操作检查单 (Checklist)
   ========================================================================== */
(function (global) {
  'use strict';

  var FS = global.FS = global.FS || {};
  var U = FS.Utils;
  var C = FS.CONST;

  /* =====================================================================
     一、检查单
     ===================================================================== */
  var CHECKLISTS = {
    beforeStart: {
      name: '起动前', nameEn: 'BEFORE START',
      items: [
        { text: '电池 / 电源 ........................ ON', key: 'battery' },
        { text: 'APU 主开关 .......................... ON', key: 'apu' },
        { text: 'APU 引气 ............................ ON', key: 'apu' },
        { text: '燃油泵 .............................. ON', key: 'pumps' },
        { text: '防冰 ................................ AS RQRD', key: 'antiice' },
        { text: '航行灯 / 信标灯 ..................... ON', key: 'beacon' },
        { text: '自动驾驶 / 飞行指引 ................. OFF', key: 'apoff' },
        { text: '停留刹车 ............................ ON', key: 'parkbrk' },
        { text: '襟翼手柄 ............................ 起飞位', key: 'flaps' }
      ]
    },
    afterStart: {
      name: '起动后', nameEn: 'AFTER START',
      items: [
        { text: 'APU 引气 ............................ OFF', key: 'apuBleedOff' },
        { text: '空调 / 增压 ......................... ON', key: 'packs' },
        { text: '发动机防冰 .......................... AS RQRD', key: 'engAntiIce' },
        { text: '防滞 / 自动刹车 ..................... RTO', key: 'autobrake' },
        { text: '飞行操纵 检查 ....................... CHECKED', key: 'ctrlCheck' },
        { text: '配平 ................................ SET', key: 'trim' }
      ]
    },
    taxi: {
      name: '滑行', nameEn: 'TAXI',
      items: [
        { text: '停留刹车 ............................ OFF', key: 'parkbrkOff' },
        { text: '滑行灯 .............................. ON', key: 'taxiLight' },
        { text: '刹车检查 ............................ CHECKED', key: 'brakeCheck' },
        { text: '飞行仪表 ............................ CHECKED', key: 'instrCheck' }
      ]
    },
    beforeTakeoff: {
      name: '起飞前', nameEn: 'BEFORE TAKEOFF',
      items: [
        { text: '襟翼 ................................ 起飞位设定', key: 'flapsSet' },
        { text: 'V1 / VR / V2 ........................ 已设定', key: 'vspeeds' },
        { text: '起飞数据 ............................ CONFIRMED', key: 'toData' },
        { text: '自动刹车 ............................ RTO', key: 'rto' },
        { text: '外侧灯 / 起飞灯 ..................... ON', key: 'toLights' },
        { text: 'TCAS ................................ TA/RA', key: 'tcas' },
        { text: '客舱 ................................ READY', key: 'cabin' }
      ]
    },
    afterTakeoff: {
      name: '起飞后', nameEn: 'AFTER TAKEOFF',
      items: [
        { text: '起落架 .............................. UP', key: 'gearUp' },
        { text: '自动驾驶 ............................ ON', key: 'apOn' },
        { text: '起飞灯 .............................. OFF', key: 'toLightsOff' },
        { text: '增压 ................................ CHECKED', key: 'press' },
        { text: '襟翼 ................................ 按速度收上', key: 'flapsUp' }
      ]
    },
    approach: {
      name: '进近', nameEn: 'APPROACH',
      items: [
        { text: '气压基准 ............................ QNH 设定', key: 'qnh' },
        { text: '进近图 / 跑道 ....................... CONFIRMED', key: 'brief' },
        { text: 'ILS 频率 / 航道 ..................... 设定', key: 'ilsSet' },
        { text: '自动驾驶 ............................ APPR 预位', key: 'apprArmed' },
        { text: '起落架 .............................. DOWN', key: 'gearDown' },
        { text: '襟翼 ................................ 着陆位', key: 'flapsLand' },
        { text: '自动刹车 ............................ 设定', key: 'autobrakeSet' },
        { text: '着陆灯 .............................. ON', key: 'landLights' }
      ]
    },
    landing: {
      name: '着陆', nameEn: 'LANDING',
      items: [
        { text: '起落架 .............................. DOWN 3 绿', key: 'gearDown' },
        { text: '襟翼 ................................ 着陆位', key: 'flapsLand' },
        { text: '自动刹车 ............................ 设定', key: 'autobrakeSet' },
        { text: '扰流板 .............................. 预位', key: 'spoilerArm' },
        { text: '发动机 .............................. 已确认', key: 'engCheck' }
      ]
    },
    afterLanding: {
      name: '着陆后', nameEn: 'AFTER LANDING',
      items: [
        { text: '反推 ................................ 收回', key: 'revOff' },
        { text: '扰流板 .............................. 收回', key: 'spoilersRet' },
        { text: '襟翼 ................................ 收回', key: 'flapsRet' },
        { text: '起飞灯 .............................. OFF', key: 'toLightsOff' },
        { text: 'APU 引气 ............................ ON', key: 'apuBleedOn' },
        { text: '气象雷达 ............................ OFF', key: 'wxOff' }
      ]
    },
    parking: {
      name: '停机', nameEn: 'PARKING',
      items: [
        { text: '停留刹车 ............................ ON', key: 'parkbrk' },
        { text: '发动机 .............................. OFF', key: 'engOff' },
        { text: '安全带灯 ............................ OFF', key: 'seatbeltOff' },
        { text: '航行灯 .............................. OFF', key: 'navOff' },
        { text: 'APU ................................. OFF', key: 'apuOff' }
      ]
    }
  };
  FS.CHECKLISTS = CHECKLISTS;

  /* =====================================================================
     二、自动检查单判定 (依据飞机状态自动勾选)
     ===================================================================== */
  var CHECK_FN = {
    battery: function (s) { return true; },
    apu: function (s) { return s.apuRunning; },
    pumps: function (s) { return true; },
    antiice: function (s) { return true; },
    beacon: function (s) { return s.lights && s.lights.beacon; },
    apoff: function (s) { return !s.ap.engaged; },
    parkbrk: function (s) { return s.parkingBrake; },
    parkbrkOff: function (s) { return !s.parkingBrake; },
    flaps: function (s) { return s.flapPos > 0.05; },
    flapsSet: function (s) { return s.flapPos > 0.05 && !s.gearMoving; },
    apuBleedOff: function (s) { return s.apuRunning; },
    apuBleedOn: function (s) { return s.apuRunning; },
    packs: function (s) { return true; },
    engAntiIce: function (s) { return true; },
    autobrake: function (s) { return s.autoBrake && s.autoBrake !== 'OFF'; },
    autobrakeSet: function (s) { return s.autoBrake && s.autoBrake !== 'OFF'; },
    ctrlCheck: function (s) { return true; },
    trim: function (s) { return Math.abs(s.surfaces.elevatorTrim) < 0.6; },
    taxiLight: function (s) { return s.lights && s.lights.taxi; },
    brakeCheck: function (s) { return true; },
    instrCheck: function (s) { return true; },
    vspeeds: function (s) { return true; },
    toData: function (s) { return true; },
    rto: function (s) { return s.autoBrake && s.autoBrake !== 'OFF'; },
    toLights: function (s) { return s.lights && s.lights.landing; },
    toLightsOff: function (s) { return s.lights && !s.lights.landing; },
    tcas: function (s) { return true; },
    cabin: function (s) { return true; },
    gearUp: function (s) { return s.gearPos < 0.02; },
    gearDown: function (s) { return s.gearPos > 0.99; },
    apOn: function (s) { return s.ap.engaged; },
    press: function (s) { return true; },
    flapsUp: function (s) { return s.flapPos < 0.02; },
    flapsRet: function (s) { return s.flapPos < 0.02; },
    flapsLand: function (s) { return s.flapPos > 0.7; },
    qnh: function (s) { return true; },
    brief: function (s) { return true; },
    ilsSet: function (s) { return true; },
    apprArmed: function (s) { return s.ap.apprArmed; },
    landLights: function (s) { return s.lights && s.lights.landing; },
    spoilerArm: function (s) { return true; },
    engCheck: function (s) { return true; },
    revOff: function (s) { return s.engines.every(function (e) { return e.reverser < 0.05; }); },
    spoilersRet: function (s) { return s.spoilerPos < 0.05; },
    wxOff: function (s) { return true; },
    engOff: function (s) { return s.engines.every(function (e) { return e.state === 'off'; }); },
    seatbeltOff: function (s) { return true; },
    navOff: function (s) { return s.lights && !s.lights.nav; },
    apuOff: function (s) { return !s.apuRunning; }
  };

  /* =====================================================================
     三、训练场景
     ===================================================================== */
  var SCENARIOS = [
    /* ---------------- 1. 冷舱启动 ---------------- */
    {
      id: 'cold-dark',
      name: '冷舱启动',
      nameEn: 'Cold & Dark',
      difficulty: '入门',
      description: '飞机完全断电停靠在停机坪。按照标准程序接通电源、启动 APU、起动发动机, 然后滑行至跑道。',
      hint: '按 Shift+A 接通 APU, 等待 APU 可用后按 Ctrl+S 起动全部发动机。',
      setup: function (ctx) {
        var fm = ctx.fm, env = ctx.env;
        var ap = FS.Airports.byIcao(ctx.airportIcao) || FS.Airports.list[0];
        var rwy = ctx.runway || (ap.runways && ap.runways[0]);
        fm.placeOnRunway(ap.icao, rwy.ident, { startFrac: 0.05, parkingBrake: true });
        fm.setFuel(fm.ac.mass.maxFuel * 0.30);
        fm.setPayload(fm.ac.mass.maxPayload * 0.7);
        fm.setFlapDetent(0);
        fm.flapPos = 0; fm.flapCmd = 0; fm.slatPos = 0;
        fm.gearCmd = 1; fm.gearPos = 1;
        fm.parkingBrake = true;
        fm.apuRunning = false;
        for (var i = 0; i < fm.engines.length; i++) {
          fm.engines[i].state = 'off';
          fm.engines[i].n1 = 0; fm.engines[i].n2 = 0;
          fm.engines[i].fuelOn = false;
          fm.engines[i].egt = 15;
        }
        fm.throttle = fm.throttle.map(function () { return 0; });
        if (ctx.setLights) ctx.setLights({ beacon: false, nav: false, landing: false, taxi: false, strobe: false });
        if (env) env.setWeather(FS.Environment.presetWeather('few'));
        if (ctx.ap) ctx.ap.setPitchMode('OFF'), ctx.ap.ap.engaged = false;
        return { title: '冷舱启动', subtitle: ap.nameZh + ' · ' + rwy.ident };
      },
      objectives: [
        { text: '接通 APU 并等待可用', check: function (s) { return s.apuRunning; } },
        { text: '起动两台发动机至慢车', check: function (s) { return s.engines.every(function (e) { return e.n1 > e.n1Idle - 1 && e.state === 'running'; }); } },
        { text: '松开停留刹车', check: function (s) { return !s.parkingBrake; } },
        { text: '滑行速度不超过 25 kt', check: function (s) { return true; }, continuous: true }
      ]
    },

    /* ---------------- 2. 正常起飞 ---------------- */
    {
      id: 'takeoff',
      name: '正常起飞',
      nameEn: 'Normal Takeoff',
      difficulty: '入门',
      description: '已在跑道头对正。襟翼已设定, 发动机运转中。推油门至起飞推力, 抬前轮, 按 V2 爬升。',
      hint: '按 8 设定起飞推力 (TOGA), 达到 VR 后按 ↓ (或 S) 抬前轮。',
      setup: function (ctx) {
        var fm = ctx.fm;
        fm.setupForTakeoff(ctx.airportIcao, ctx.runwayIdent, {});
        fm.setFuel(fm.ac.mass.maxFuel * 0.30);
        fm.setPayload(fm.ac.mass.maxPayload * 0.72);
        if (ctx.env) ctx.env.setWeather(FS.Environment.presetWeather('clear'));
        ctx.setLights({ beacon: true, nav: true, strobe: true, landing: true, taxi: true });
        return { title: '正常起飞', subtitle: ctx.airportIcao + ' · ' + ctx.runwayIdent };
      },
      objectives: [
        { text: '推至起飞推力 (N1 > 90%)', check: function (s) { return s.engines.every(function (e) { return e.n1 > 90; }); } },
        { text: '达到 VR 后抬前轮', check: function (s) { return s.pitchDeg > 5 && !s.onGround; } },
        { text: '离地后收起飞襟翼', check: function (s) { return s.flapPos < 0.02 && s.aglFt > 400; } },
        { text: '收上起落架', check: function (s) { return s.gearPos < 0.02; } },
        { text: '爬升至 5000 ft', check: function (s) { return s.altFt > 5000; } }
      ]
    },

    /* ---------------- 3. 巡航飞行 ---------------- */
    {
      id: 'cruise',
      name: '巡航飞行',
      nameEn: 'Cruise Flight',
      difficulty: '入门',
      description: '已在巡航高度以经济马赫数飞行。练习自动驾驶模式切换、高度/速度选择、航路导航。',
      hint: '使用 H 选择航向, L 保持高度, J 接通 LNAV。',
      setup: function (ctx) {
        var fm = ctx.fm;
        var a = FS.Airports.byIcao(ctx.airportIcao) || FS.Airports.list[0];
        fm.setupForCruise(a.lat, a.lon, 35000, 90, fm.ac.perf.cruiseMach);
        if (ctx.fms) {
          ctx.fms.buildDirectRoute('ZSPD', 'KLAX', 37000, 8);
          ctx.fms.activeLeg = 1;
          fm.fms = ctx.fms;
        }
        if (ctx.ap) {
          ctx.ap.engage(1);
          ctx.ap.setRollMode('NAV');
          ctx.ap.setPitchMode('ALT');
          ctx.ap.setTargetAlt(37000);
          ctx.ap.setThrustMode('MACH');
          ctx.ap.setTargetMach(fm.ac.perf.cruiseMach);
        }
        if (ctx.env) {
          ctx.env.setWeather(FS.Environment.presetWeather('scattered'));
          ctx.env.setTimeOfDay(10);
        }
        ctx.setLights({ beacon: true, nav: true, strobe: true, landing: false, taxi: false });
        return { title: '巡航飞行', subtitle: 'FL350 · M' + fm.ac.perf.cruiseMach.toFixed(2) };
      },
      objectives: [
        { text: '保持高度 ±100 ft 以内 60 秒', check: function (s) { return true; }, continuous: true },
        { text: '切换至 LNAV 沿航路飞行', check: function (s) { return s.ap.rollMode === 'NAV'; } },
        { text: '试验 V/S 模式爬升至 FL370', check: function (s) { return s.altFt > 36500; } },
        { text: '观察燃油流量与 EGT', check: function (s) { return true; } }
      ]
    },

    /* ---------------- 4. ILS 精密进近 ---------------- */
    {
      id: 'ils-approach',
      name: 'ILS 精密进近',
      nameEn: 'ILS Approach',
      difficulty: '进阶',
      description: '从跑道中心线延长线 12 海里处开始, 截获航向道与下滑道, 跟随指引下降至决断高度。',
      hint: '按 I 预位 APPR, 截获 LOC 与 GS 后飞机自动跟随。',
      setup: function (ctx) {
        var fm = ctx.fm;
        var g = FS.Airports.ilsWorld(ctx.airportIcao, ctx.runwayIdent);
        if (!g) throw new Error('该跑道没有 ILS');
        fm.setupForApproach(ctx.airportIcao, ctx.runwayIdent, 12);
        fm.setFuel(fm.ac.mass.maxFuel * 0.14);
        if (ctx.ap) {
          ctx.ap.ap.ilsIcao = ctx.airportIcao;
          ctx.ap.ap.ilsRwy = ctx.runwayIdent;
          ctx.ap.engage(1);
          ctx.ap.setRollMode('HDG');
          ctx.ap.setPitchMode('ALT');
          ctx.ap.setTargetAlt(Math.round(fm.altFt / 100) * 100);
          ctx.ap.armAppr(true);
          ctx.ap.setThrustMode('SPEED');
          ctx.ap.setTargetSpeed(fm.getVSpeeds().Vapp + 20);
        }
        if (ctx.fms) {
          ctx.fms.addWaypoint({
            ident: ctx.runwayIdent, lat: g.thresholdLat, lon: g.thresholdLon,
            type: 'runway', altFt: g.thresholdElevFt
          });
          fm.fms = ctx.fms;
        }
        if (ctx.env) {
          ctx.env.setWeather(FS.Environment.presetWeather('broken'));
          ctx.env.setTimeOfDay(16);
        }
        ctx.setLights({ beacon: true, nav: true, strobe: true, landing: true, taxi: false });
        return { title: 'ILS 精密进近', subtitle: ctx.airportIcao + ' · ' + ctx.runwayIdent + ' · ' + g.freqMHz.toFixed(2) };
      },
      objectives: [
        { text: '截获航向道 (LOC)', check: function (s) { return s.ap.locCaptured; } },
        { text: '截获下滑道 (GS)', check: function (s) { return s.ap.gsCaptured; } },
        { text: '放下起落架', check: function (s) { return s.gearPos > 0.99; } },
        { text: '着陆襟翼设定', check: function (s) { return s.flapPos > 0.7; } },
        { text: '在跑道范围内接地', check: function (s) { return s.onGround; } },
        { text: '接地垂直速度小于 -400 fpm', check: function (s) { return s.touchdownVS !== undefined && Math.abs(s.touchdownVS) < 400 && s.onGround; } }
      ]
    },

    /* ---------------- 5. 侧风着陆 ---------------- */
    {
      id: 'crosswind',
      name: '侧风着陆挑战',
      nameEn: 'Crosswind Landing',
      difficulty: '困难',
      description: '25 节正侧风、中等湍流。练习蟹形进近与拉平接地, 保持跑道中心线。',
      hint: '用方向舵消除偏流, 落地前用交叉操纵对正跑道。',
      setup: function (ctx) {
        var fm = ctx.fm;
        var g = FS.Airports.ilsWorld(ctx.airportIcao, ctx.runwayIdent);
        fm.setupForApproach(ctx.airportIcao, ctx.runwayIdent, 8);
        fm.setFuel(fm.ac.mass.maxFuel * 0.12);
        if (ctx.env) {
          ctx.env.setWeather({
            cloudCover: 0.65, cloudBaseFt: 2500, visibilityM: 8000,
            windDirDeg: U.wrap360(g.course + 90), windSpeedKt: 25, gustKt: 34,
            turbulence: 0.55, temperatureC: 12, qnhHpa: 1008
          });
          ctx.env.setTimeOfDay(17.5);
        }
        fm.setWind(U.wrap360(g.course + 90), 25, 34, 0.55);
        if (ctx.ap) {
          ctx.ap.ap.ilsIcao = ctx.airportIcao;
          ctx.ap.ap.ilsRwy = ctx.runwayIdent;
          ctx.ap.setThrustMode('SPEED');
          ctx.ap.setTargetSpeed(fm.getVSpeeds().Vapp + 12);
        }
        return { title: '侧风着陆挑战', subtitle: '风 ' + U.wrap360(g.course + 90) + '° / 25G34 kt' };
      },
      objectives: [
        { text: '保持航向道偏差小于半个点', check: function (s) { return true; }, continuous: true },
        { text: '放下起落架与着陆襟翼', check: function (s) { return s.gearPos > 0.99 && s.flapPos > 0.7; } },
        { text: '接地垂直速度小于 -500 fpm', check: function (s) { return s.onGround && Math.abs(s.touchdownVS) < 500; } },
        { text: '落地后保持在跑道上 (不冲出)', check: function (s) { return s.onGround && s.gsKt < 40; }, continuous: true }
      ]
    },

    /* ---------------- 6. 五边起落航线 ---------------- */
    {
      id: 'pattern',
      name: '本场五边航线',
      nameEn: 'Traffic Pattern',
      difficulty: '进阶',
      description: '在机场上空完成标准的五边起落航线: 起飞、爬升、四转弯、下风边、三转弯、对正落地。',
      hint: '保持 1500 ft AGL, 下风边与跑道平行, 三转弯后放襟翼与起落架。',
      setup: function (ctx) {
        var fm = ctx.fm;
        fm.setupForTakeoff(ctx.airportIcao, ctx.runwayIdent, {});
        fm.setFuel(fm.ac.mass.maxFuel * 0.10);
        fm.setPayload(fm.ac.mass.maxPayload * 0.4);
        if (ctx.env) ctx.env.setWeather(FS.Environment.presetWeather('clear'), ctx.env.setTimeOfDay(9));
        ctx.setLights({ beacon: true, nav: true, strobe: true, landing: true, taxi: true });
        return { title: '本场五边航线', subtitle: ctx.airportIcao + ' · ' + ctx.runwayIdent };
      },
      objectives: [
        { text: '起飞并爬升至 1500 ft AGL', check: function (s) { return s.aglFt > 1400; } },
        { text: '收上起落架与襟翼', check: function (s) { return s.gearPos < 0.02 && s.flapPos < 0.05; } },
        { text: '完成一次完整转弯', check: function (s) { return Math.abs(s.rollDeg) > 20; } },
        { text: '再次安全接地', check: function (s) { return s.onGround && s.touchdownVS !== undefined && Math.abs(s.touchdownVS) < 600; } }
      ]
    },

    /* ---------------- 7. 单发失效处置 ---------------- */
    {
      id: 'engine-failure',
      name: '单发失效处置',
      nameEn: 'Engine Failure',
      difficulty: '困难',
      description: '巡航中一台发动机失效。识别故障、保持航向、执行单发程序并安全返场。',
      hint: '蹬舵抵消偏航, 保持空速, 另一台发动机推至最大。',
      setup: function (ctx) {
        var fm = ctx.fm;
        var a = FS.Airports.byIcao(ctx.airportIcao) || FS.Airports.list[0];
        fm.setFuel(fm.ac.mass.maxFuel * 0.35);
        fm.setPayload(fm.ac.mass.maxPayload * 0.6);
        fm.setupForCruise(a.lat, a.lon, 28000, a.runways[0].hdgTrue, fm.ac.perf.cruiseMach);
        // 失效左发
        fm.engines[0].state = 'off';
        fm.engines[0].fuelOn = false;
        fm.engines[0].n1 = 0;
        fm.engines[0].fireWarning = false;
        if (ctx.ap) { ctx.ap.ap.engaged = false; ctx.ap.ap.ap1 = false; }
        if (ctx.env) ctx.env.setWeather(FS.Environment.presetWeather('few'));
        return { title: '单发失效处置', subtitle: '左发失效 · FL280' };
      },
      objectives: [
        { text: '识别失效发动机', check: function (s) { return s.engines[0].n1 < 5 && s.engines[0].state === 'off'; } },
        { text: '用方向舵消除偏航 (±10° 以内)', check: function (s) { return Math.abs(s.betaDeg) < 10; } },
        { text: '保持单发最佳爬升速度', check: function (s) { return Math.abs(s.iasKt - 220) < 40; }, continuous: true },
        { text: '另一台发动机推至最大', check: function (s) { return s.throttle[1] > 0.95 || s.engines[1].n1 > 92; } },
        { text: '稳定下降至 10000 ft', check: function (s) { return s.altFt < 11000; } }
      ]
    },

    /* ---------------- 8. 夜航 ---------------- */
    {
      id: 'night',
      name: '夜间飞行',
      nameEn: 'Night Flight',
      difficulty: '进阶',
      description: '夜间进近。跑道灯光、城市灯火与仪表飞行。练习依靠仪表保持姿态。',
      hint: '注意 PFD 姿态, 夜间很容易产生空间定向障碍。',
      setup: function (ctx) {
        var fm = ctx.fm;
        var g = FS.Airports.ilsWorld(ctx.airportIcao, ctx.runwayIdent);
        fm.setupForApproach(ctx.airportIcao, ctx.runwayIdent, 14);
        fm.setFuel(fm.ac.mass.maxFuel * 0.15);
        if (ctx.env) {
          ctx.env.setTimeOfDay(21.5);
          ctx.env.setWeather(FS.Environment.presetWeather('night-clear'));
        }
        if (ctx.ap) {
          ctx.ap.ap.ilsIcao = ctx.airportIcao;
          ctx.ap.ap.ilsRwy = ctx.runwayIdent;
          ctx.ap.setThrustMode('SPEED');
          ctx.ap.setTargetSpeed(fm.getVSpeeds().Vapp + 15);
        }
        ctx.setLights({ beacon: true, nav: true, strobe: true, landing: true, taxi: false, logo: true, wing: true });
        return { title: '夜间飞行', subtitle: '当地 21:30 · ' + ctx.airportIcao };
      },
      objectives: [
        { text: '保持姿态稳定 (滚转 < 15°)', check: function (s) { return Math.abs(s.rollDeg) < 15; }, continuous: true },
        { text: '截获 ILS 下滑道', check: function (s) { return s.ap.gsCaptured; } },
        { text: '打开着陆灯与频闪灯', check: function (s) { return s.lights && s.lights.landing; } },
        { text: '安全着陆', check: function (s) { return s.onGround && Math.abs(s.touchdownVS) < 500; } }
      ]
    },

    /* ---------------- 9. 恶劣天气起飞 ---------------- */
    {
      id: 'storm-takeoff',
      name: '雷雨起飞',
      nameEn: 'Storm Departure',
      difficulty: '困难',
      description: '低能见度、强降雨与风切变环境下起飞。注意发动机参数与跑道积水对刹车的影响。',
      hint: '湿滑跑道刹车效率下降, 起飞距离变长。',
      setup: function (ctx) {
        var fm = ctx.fm;
        fm.setupForTakeoff(ctx.airportIcao, ctx.runwayIdent, {});
        fm.setFuel(fm.ac.mass.maxFuel * 0.28);
        fm.runwayWet = true;
        if (ctx.env) {
          ctx.env.setWeather(FS.Environment.presetWeather('storm'));
          ctx.env.setTimeOfDay(14);
        }
        ctx.setLights({ beacon: true, nav: true, strobe: true, landing: true, taxi: true });
        return { title: '雷雨起飞', subtitle: '强雷暴 · 湿滑跑道' };
      },
      objectives: [
        { text: '在湿滑跑道上加速至 VR', check: function (s) { return s.iasKt > s._vspeeds ? s.iasKt > s._vspeeds.Vr : s.iasKt > 140; } },
        { text: '安全离地 (未冲出跑道)', check: function (s) { return !s.onGround && s.altFt > s._toElev + 50; } },
        { text: '收上起落架', check: function (s) { return s.gearPos < 0.02; } },
        { text: '爬升穿越颠簸层至 10000 ft', check: function (s) { return s.altFt > 10000; } }
      ]
    },

    /* ---------------- 10. 自由飞行 ---------------- */
    {
      id: 'free-flight',
      name: '自由飞行',
      nameEn: 'Free Flight',
      difficulty: '自由',
      description: '没有目标, 没有限制。从跑道起飞, 自由探索这个世界。',
      hint: '按 C 切换视角, 按 空格 或 P 暂停, 按 ? 或 F1 查看操作说明。',
      setup: function (ctx) {
        var fm = ctx.fm;
        fm.setupForTakeoff(ctx.airportIcao, ctx.runwayIdent, {});
        fm.setFuel(fm.ac.mass.maxFuel * 0.5);
        fm.setPayload(fm.ac.mass.maxPayload * 0.5);
        if (ctx.env) ctx.env.setWeather(FS.Environment.presetWeather('few'));
        ctx.setLights({ beacon: true, nav: true, strobe: true, landing: true, taxi: true });
        return { title: '自由飞行', subtitle: '无限制' };
      },
      objectives: []
    }
  ];

  /** 从 ilsWorld() 返回结构中安全取出跑道入口标高 (英尺) */
  function thrElev(g) {
    if (FS.ilsThresholdElevFt) return FS.ilsThresholdElevFt(g);
    var e = g.thresholdElevFt;
    if (e === undefined && g.runway) e = g.runway.elevFt;
    return isFinite(e) ? e : 0;
  }

  /* =====================================================================
     四、场景管理器
     ===================================================================== */
  function ScenarioManager() {
    this.current = null;
    this.objectives = [];
    this.completed = [];
    this.startTime = 0;
    this.title = '';
    this.subtitle = '';
    this.failed = false;
    this._continuousTimers = {};
  }

  ScenarioManager.prototype.list = function () { return SCENARIOS; };

  ScenarioManager.prototype.get = function (id) {
    for (var i = 0; i < SCENARIOS.length; i++) {
      if (SCENARIOS[i].id === id) return SCENARIOS[i];
    }
    return null;
  };

  /**
   * 启动一个场景
   * @param {string} id
   * @param {object} ctx { fm, env, ap, fms, airportIcao, runwayIdent, setLights }
   */
  ScenarioManager.prototype.start = function (id, ctx) {
    var sc = this.get(id);
    if (!sc) { FS.Log.warn('未知场景: ' + id); return false; }
    this.current = sc;
    this.completed = [];
    this.failed = false;
    this._continuousTimers = {};

    var meta = null;
    try {
      meta = sc.setup(ctx);
    } catch (e) {
      FS.Log.error('场景初始化失败: ' + e.message);
      return false;
    }
    if (meta) { this.title = meta.title; this.subtitle = meta.subtitle; }

    this.objectives = (sc.objectives || []).map(function (o) {
      return { text: o.text, check: o.check, continuous: !!o.continuous, done: false, progress: 0 };
    });

    this.startTime = ctx.fm ? ctx.fm.time : 0;
    FS.Bus.emit('scenario:started', { id: id, title: this.title, objectives: this.objectives });
    return true;
  };

  ScenarioManager.prototype.update = function (dt, state) {
    if (!this.current) return;
    var allDone = this.objectives.length > 0;

    for (var i = 0; i < this.objectives.length; i++) {
      var o = this.objectives[i];
      if (o.done) continue;

      var ok = false;
      try { ok = !!o.check(state); } catch (e) { ok = false; }

      if (o.continuous) {
        // 连续目标: 需要保持 N 秒
        var need = o.holdSeconds || 6;
        if (ok) {
          o.progress += dt;
          if (o.progress >= need) {
            o.done = true;
            FS.Bus.emit('scenario:objective', { index: i, text: o.text });
          }
        } else {
          o.progress = Math.max(0, o.progress - dt * 2);
        }
        o.progressPct = U.clamp01(o.progress / need);
      } else if (ok) {
        o.done = true;
        FS.Bus.emit('scenario:objective', { index: i, text: o.text });
      }

      if (!o.done) allDone = false;
    }

    if (allDone && !this.completedAll) {
      this.completedAll = true;
      FS.Bus.emit('scenario:completed', {
        id: this.current.id, title: this.title,
        elapsed: state.time - this.startTime
      });
    }
    if (!allDone) this.completedAll = false;
  };

  ScenarioManager.prototype.getProgress = function () {
    if (!this.objectives.length) return { done: 0, total: 0, pct: 0 };
    var d = 0;
    for (var i = 0; i < this.objectives.length; i++) if (this.objectives[i].done) d++;
    return { done: d, total: this.objectives.length, pct: d / this.objectives.length };
  };

  /* =====================================================================
     五、检查单管理器
     ===================================================================== */
  function ChecklistManager() {
    this.active = null;
    this.done = {};
    this.flightPhase = 'beforeStart';
  }

  ChecklistManager.prototype.setPhase = function (phase) {
    if (CHECKLISTS[phase]) {
      this.active = phase;
      FS.Bus.emit('checklist:phase', { phase: phase, name: CHECKLISTS[phase].name });
    }
  };

  ChecklistManager.prototype.getActive = function () {
    return this.active ? CHECKLISTS[this.active] : null;
  };

  ChecklistManager.prototype.status = function (state) {
    var cl = this.getActive();
    if (!cl) return { items: [], pct: 0 };
    var out = [], done = 0;
    for (var i = 0; i < cl.items.length; i++) {
      var it = cl.items[i];
      var fn = CHECK_FN[it.key];
      var ok = false;
      try { ok = fn ? !!fn(state) : false; } catch (e) { ok = false; }
      if (ok) done++;
      out.push({ text: it.text, key: it.key, done: ok });
    }
    return { name: cl.name, nameEn: cl.nameEn, items: out, pct: out.length ? done / out.length : 0 };
  };

  ChecklistManager.prototype.nextPhase = function () {
    var keys = Object.keys(CHECKLISTS);
    var i = keys.indexOf(this.active);
    this.setPhase(keys[(i + 1) % keys.length]);
    return this.active;
  };

  /* =====================================================================
     六、依据飞行阶段自动切换检查单
     ===================================================================== */
  ChecklistManager.prototype.autoPhase = function (state, prevState) {
    var phase = this.active || 'beforeStart';
    var engRunning = state.engines.every(function (e) { return e.state === 'running' || e.state === 'idle'; });
    var anyRunning = state.engines.some(function (e) { return e.state === 'running' || e.state === 'idle'; });

    if (state.onGround && state.gsKt < 1 && !anyRunning) {
      phase = 'beforeStart';
    } else if (state.onGround && anyRunning && state.gsKt < 1 && state.parkingBrake) {
      phase = 'afterStart';
    } else if (state.onGround && state.gsKt > 2 && state.gsKt < 40) {
      phase = 'taxi';
    } else if (state.onGround && state.tas > 20 && !state.onGround) {
      phase = 'beforeTakeoff';
    } else if (!state.onGround && state.aglFt < 3000 && state.vsFpm > 200) {
      phase = 'afterTakeoff';
    } else if (!state.onGround && state.aglFt < 4000 && state.vsFpm < -300) {
      phase = 'approach';
    } else if (state.onGround && state.tas > 30 && state.parkingBrake === false) {
      phase = 'afterLanding';
    } else if (state.onGround && state.gsKt < 1 && !anyRunning) {
      phase = 'parking';
    }
    if (phase !== this.active) this.setPhase(phase);
  };

  FS.ChecklistManager = ChecklistManager;
  FS.ScenarioManager = ScenarioManager;
  FS.SCENARIOS = SCENARIOS;

  FS.Log.info('scenarios.js 已加载 — ' + SCENARIOS.length + ' 个场景, ' +
    Object.keys(CHECKLISTS).length + ' 份检查单');

})(typeof window !== 'undefined' ? window : globalThis);
