/* ==========================================================================
   天际航线 SkyRoute — 立体机场 (airport3d.js, beta 0.4)
   --------------------------------------------------------------------------
   在跑道道面之外生成：停机坪、滑行道、航站楼、廊桥、塔台、机库等。
   · beta 0.4: 全部内置机场优先使用 OSM 真实轮廓 (js/airport-osm-data.js, 构建期离线生成, ODbL)
   · 内置若干主要机场的手工布局（相对机场基准点的东/南偏移，单位米；作为后备）
   · 其余机场：由跑道几何自动生成合理的通用布局
   · 联网时尝试 Overpass (OSM) 拉取 aeroway 补充滑行道/建筑轮廓；失败则静默回退
   · 全部为程序化几何 + Canvas 贴图，不依赖外部 GLB 运行时加载
   坐标：与游戏一致 X=东(+) Z=南(+) Y=上；高度贴合 env.getGroundHeight
   ========================================================================== */
(function (global) {
  'use strict';
  var FS = global.FS = global.FS || {};
  var DEG = Math.PI / 180;

  /* ---------------------------------------------------------------------
     1. 内置真实布局 (相对 ARP 的本地东/南偏移；来源：公开航图/卫星图目视校对)
     --------------------------------------------------------------------- */
  /** @type {Object.<string, object>} */
  var LAYOUTS = {
    /* 上海浦东：T1/T2 在西侧平行跑道之间偏西；塔台近 T1；货运区北侧 */
    ZSPD: {
      terminals: [
        { e: -900, s: -200, hdg: 70, len: 920, wid: 95, h: 28, floors: 3, name: 'T1' },
        { e: -1100, s: 650, hdg: 70, len: 1100, wid: 110, h: 32, floors: 3, name: 'T2' }
      ],
      towers: [{ e: -650, s: 180, hdg: 0, h: 72 }],
      hangars: [
        { e: -1600, s: -900, hdg: 70, len: 120, wid: 80, h: 28 },
        { e: -1500, s: -1050, hdg: 70, len: 100, wid: 70, h: 24 }
      ],
      aprons: [
        { e: -700, s: -150, hdg: 70, len: 1100, wid: 220 },
        { e: -900, s: 700, hdg: 70, len: 1300, wid: 260 }
      ],
      taxiways: [
        { e: -200, s: -800, hdg: 155, len: 3200, wid: 28 },
        { e: 200, s: -750, hdg: 155, len: 3100, wid: 28 },
        { e: -400, s: 0, hdg: 70, len: 1400, wid: 26 },
        { e: -500, s: 500, hdg: 70, len: 1600, wid: 26 }
      ],
      gates: [
        { e: -780, s: -280, hdg: 250, n: 8, spacing: 70, bridge: 38 },
        { e: -980, s: 560, hdg: 250, n: 10, spacing: 72, bridge: 40 }
      ]
    },
    /* 北京首都：T3 巨大主楼在东；T1/T2 西侧；塔台近中央 */
    ZBAA: {
      terminals: [
        { e: -600, s: 200, hdg: 0, len: 480, wid: 80, h: 26, floors: 3, name: 'T1' },
        { e: -400, s: -350, hdg: 0, len: 520, wid: 85, h: 26, floors: 3, name: 'T2' },
        { e: 900, s: 0, hdg: 90, len: 1400, wid: 130, h: 36, floors: 4, name: 'T3' }
      ],
      towers: [{ e: 200, s: 100, hdg: 0, h: 88 }],
      hangars: [
        { e: -1100, s: 800, hdg: 0, len: 110, wid: 75, h: 26 },
        { e: 1400, s: -900, hdg: 90, len: 130, wid: 90, h: 30 }
      ],
      aprons: [
        { e: -500, s: 150, hdg: 0, len: 700, wid: 200 },
        { e: -300, s: -400, hdg: 0, len: 750, wid: 210 },
        { e: 700, s: 0, hdg: 90, len: 1600, wid: 280 }
      ],
      taxiways: [
        { e: -100, s: -1500, hdg: 4, len: 3800, wid: 30 },
        { e: 100, s: -1400, hdg: 173, len: 3600, wid: 28 },
        { e: 500, s: -200, hdg: 90, len: 1200, wid: 26 }
      ],
      gates: [
        { e: -520, s: 80, hdg: 180, n: 6, spacing: 65, bridge: 36 },
        { e: -320, s: -280, hdg: 180, n: 6, spacing: 65, bridge: 36 },
        { e: 780, s: -80, hdg: 0, n: 12, spacing: 70, bridge: 42 }
      ]
    },
    /* 广州白云 */
    ZGGG: {
      terminals: [
        { e: 200, s: -100, hdg: 15, len: 900, wid: 100, h: 30, floors: 3, name: 'T1' },
        { e: 600, s: 400, hdg: 15, len: 700, wid: 90, h: 28, floors: 3, name: 'T2' }
      ],
      towers: [{ e: 350, s: 50, hdg: 0, h: 68 }],
      hangars: [{ e: -400, s: 900, hdg: 15, len: 100, wid: 70, h: 24 }],
      aprons: [
        { e: 150, s: -50, hdg: 15, len: 1100, wid: 240 },
        { e: 550, s: 450, hdg: 15, len: 900, wid: 220 }
      ],
      taxiways: [
        { e: -100, s: -1200, hdg: 15, len: 3400, wid: 28 },
        { e: 400, s: -1100, hdg: 15, len: 3200, wid: 26 }
      ],
      gates: [
        { e: 120, s: -180, hdg: 195, n: 9, spacing: 68, bridge: 38 },
        { e: 520, s: 320, hdg: 195, n: 7, spacing: 68, bridge: 38 }
      ]
    },
    /* 香港国际：一号客运大楼在跑道之间；塔台近中部；海上填海 */
    VHHH: {
      terminals: [
        { e: -200, s: 80, hdg: 71, len: 1200, wid: 120, h: 30, floors: 3, name: 'T1' },
        { e: 400, s: -200, hdg: 71, len: 400, wid: 80, h: 24, floors: 2, name: 'Midfield' }
      ],
      towers: [{ e: 50, s: -50, hdg: 0, h: 65 }],
      hangars: [
        { e: -900, s: 400, hdg: 71, len: 110, wid: 80, h: 26 },
        { e: -1050, s: 500, hdg: 71, len: 100, wid: 70, h: 24 }
      ],
      aprons: [
        { e: -150, s: 120, hdg: 71, len: 1400, wid: 260 },
        { e: 350, s: -150, hdg: 71, len: 600, wid: 200 }
      ],
      taxiways: [
        { e: -600, s: -200, hdg: 71, len: 2800, wid: 28 },
        { e: -400, s: 300, hdg: 71, len: 2600, wid: 26 },
        { e: 0, s: -600, hdg: 161, len: 900, wid: 26 }
      ],
      gates: [
        { e: -250, s: 40, hdg: 251, n: 12, spacing: 66, bridge: 40 },
        { e: 360, s: -160, hdg: 251, n: 5, spacing: 70, bridge: 36 }
      ]
    },
    /* 纽约肯尼迪：多航站楼环绕；塔台中央 */
    KJFK: {
      terminals: [
        { e: -800, s: -200, hdg: 30, len: 350, wid: 90, h: 26, floors: 3, name: 'T1' },
        { e: -400, s: -600, hdg: 120, len: 400, wid: 95, h: 28, floors: 3, name: 'T4' },
        { e: 200, s: -500, hdg: 210, len: 380, wid: 90, h: 26, floors: 3, name: 'T5' },
        { e: 600, s: -100, hdg: 300, len: 420, wid: 100, h: 30, floors: 3, name: 'T8' }
      ],
      towers: [{ e: 0, s: -200, hdg: 0, h: 98 }],
      hangars: [
        { e: -1200, s: 400, hdg: 30, len: 120, wid: 80, h: 28 },
        { e: 900, s: 500, hdg: 120, len: 110, wid: 75, h: 26 }
      ],
      aprons: [
        { e: -700, s: -150, hdg: 30, len: 500, wid: 200 },
        { e: -350, s: -550, hdg: 120, len: 550, wid: 210 },
        { e: 180, s: -450, hdg: 210, len: 520, wid: 200 },
        { e: 550, s: -80, hdg: 300, len: 560, wid: 220 }
      ],
      taxiways: [
        { e: -200, s: -1000, hdg: 31, len: 3000, wid: 30 },
        { e: 400, s: -800, hdg: 121, len: 2800, wid: 28 },
        { e: -600, s: 0, hdg: 121, len: 1800, wid: 26 }
      ],
      gates: [
        { e: -720, s: -250, hdg: 210, n: 5, spacing: 68, bridge: 38 },
        { e: -380, s: -520, hdg: 30, n: 6, spacing: 68, bridge: 40 },
        { e: 160, s: -420, hdg: 30, n: 5, spacing: 68, bridge: 38 },
        { e: 540, s: -40, hdg: 120, n: 6, spacing: 70, bridge: 40 }
      ]
    },
    /* 洛杉矶：终端区在北侧中央；平行跑道南北 */
    KLAX: {
      terminals: [
        { e: -200, s: -50, hdg: 83, len: 800, wid: 70, h: 24, floors: 2, name: 'TBIT' },
        { e: -600, s: 80, hdg: 83, len: 350, wid: 65, h: 22, floors: 2, name: 'T3' },
        { e: 300, s: 60, hdg: 83, len: 380, wid: 65, h: 22, floors: 2, name: 'T5' },
        { e: 700, s: 40, hdg: 83, len: 320, wid: 60, h: 22, floors: 2, name: 'T7' }
      ],
      towers: [{ e: 0, s: 200, hdg: 0, h: 76 }],
      hangars: [
        { e: -1400, s: -400, hdg: 83, len: 120, wid: 85, h: 28 },
        { e: 1300, s: -350, hdg: 83, len: 110, wid: 80, h: 26 }
      ],
      aprons: [
        { e: -150, s: 20, hdg: 83, len: 1000, wid: 180 },
        { e: -550, s: 140, hdg: 83, len: 450, wid: 160 },
        { e: 350, s: 120, hdg: 83, len: 500, wid: 160 }
      ],
      taxiways: [
        { e: -800, s: -300, hdg: 83, len: 3200, wid: 28 },
        { e: -700, s: 350, hdg: 83, len: 3000, wid: 26 },
        { e: 0, s: -600, hdg: 173, len: 800, wid: 26 }
      ],
      gates: [
        { e: -180, s: -90, hdg: 263, n: 10, spacing: 62, bridge: 36 },
        { e: -560, s: 40, hdg: 263, n: 5, spacing: 60, bridge: 34 },
        { e: 320, s: 20, hdg: 263, n: 5, spacing: 60, bridge: 34 }
      ]
    },
    /* 伦敦希思罗：T2/T3/T5 等；塔台中央 */
    EGLL: {
      terminals: [
        { e: -200, s: -100, hdg: 90, len: 500, wid: 90, h: 28, floors: 3, name: 'T2' },
        { e: 200, s: -80, hdg: 90, len: 450, wid: 85, h: 26, floors: 3, name: 'T3' },
        { e: -900, s: 50, hdg: 90, len: 700, wid: 110, h: 32, floors: 4, name: 'T5' },
        { e: 800, s: 100, hdg: 0, len: 400, wid: 80, h: 26, floors: 3, name: 'T4' }
      ],
      towers: [{ e: 50, s: 80, hdg: 0, h: 87 }],
      hangars: [{ e: 1200, s: -400, hdg: 90, len: 100, wid: 70, h: 24 }],
      aprons: [
        { e: -150, s: -50, hdg: 90, len: 650, wid: 200 },
        { e: 180, s: -30, hdg: 90, len: 600, wid: 190 },
        { e: -850, s: 100, hdg: 90, len: 900, wid: 240 },
        { e: 750, s: 150, hdg: 0, len: 550, wid: 200 }
      ],
      taxiways: [
        { e: -1000, s: -400, hdg: 90, len: 3400, wid: 28 },
        { e: -1000, s: 400, hdg: 90, len: 3400, wid: 28 },
        { e: 0, s: -200, hdg: 0, len: 600, wid: 26 }
      ],
      gates: [
        { e: -180, s: -150, hdg: 180, n: 6, spacing: 65, bridge: 36 },
        { e: 180, s: -130, hdg: 180, n: 5, spacing: 65, bridge: 36 },
        { e: -880, s: 0, hdg: 180, n: 8, spacing: 70, bridge: 40 }
      ]
    },
    /* 东京羽田 */
    RJTT: {
      terminals: [
        { e: -300, s: 200, hdg: 45, len: 700, wid: 100, h: 28, floors: 3, name: 'T1' },
        { e: 200, s: -100, hdg: 45, len: 650, wid: 95, h: 28, floors: 3, name: 'T2' },
        { e: 600, s: 400, hdg: 150, len: 500, wid: 90, h: 30, floors: 3, name: 'T3' }
      ],
      towers: [{ e: 0, s: 50, hdg: 0, h: 70 }],
      hangars: [{ e: -800, s: -500, hdg: 45, len: 110, wid: 75, h: 26 }],
      aprons: [
        { e: -250, s: 220, hdg: 45, len: 900, wid: 230 },
        { e: 220, s: -80, hdg: 45, len: 850, wid: 220 },
        { e: 580, s: 420, hdg: 150, len: 650, wid: 200 }
      ],
      taxiways: [
        { e: -500, s: -800, hdg: 35, len: 2800, wid: 28 },
        { e: 300, s: -600, hdg: 150, len: 2200, wid: 26 }
      ],
      gates: [
        { e: -280, s: 160, hdg: 225, n: 8, spacing: 68, bridge: 38 },
        { e: 180, s: -140, hdg: 225, n: 7, spacing: 68, bridge: 38 },
        { e: 560, s: 360, hdg: 330, n: 6, spacing: 70, bridge: 40 }
      ]
    },
    /* 新加坡樟宜 */
    WSSS: {
      terminals: [
        { e: -200, s: 0, hdg: 23, len: 600, wid: 100, h: 30, floors: 3, name: 'T1' },
        { e: 200, s: 150, hdg: 23, len: 650, wid: 105, h: 32, floors: 3, name: 'T2' },
        { e: 500, s: -200, hdg: 23, len: 700, wid: 110, h: 34, floors: 4, name: 'T3' },
        { e: -500, s: 300, hdg: 23, len: 550, wid: 95, h: 28, floors: 3, name: 'T4' }
      ],
      towers: [{ e: 100, s: -50, hdg: 0, h: 78 }],
      hangars: [{ e: -900, s: -600, hdg: 23, len: 100, wid: 70, h: 24 }],
      aprons: [
        { e: -150, s: 40, hdg: 23, len: 800, wid: 220 },
        { e: 220, s: 180, hdg: 23, len: 850, wid: 230 },
        { e: 480, s: -160, hdg: 23, len: 900, wid: 240 },
        { e: -460, s: 340, hdg: 23, len: 700, wid: 200 }
      ],
      taxiways: [
        { e: -400, s: -1000, hdg: 23, len: 3600, wid: 28 },
        { e: 200, s: -900, hdg: 23, len: 3400, wid: 28 }
      ],
      gates: [
        { e: -180, s: -40, hdg: 203, n: 7, spacing: 68, bridge: 38 },
        { e: 180, s: 110, hdg: 203, n: 7, spacing: 68, bridge: 38 },
        { e: 460, s: -240, hdg: 203, n: 8, spacing: 70, bridge: 40 }
      ]
    },
    /* 迪拜国际 */
    OMDB: {
      terminals: [
        { e: -100, s: 150, hdg: 122, len: 1000, wid: 120, h: 34, floors: 4, name: 'T3' },
        { e: 400, s: -200, hdg: 122, len: 600, wid: 95, h: 28, floors: 3, name: 'T1' },
        { e: 700, s: -400, hdg: 122, len: 450, wid: 85, h: 26, floors: 3, name: 'T2' }
      ],
      towers: [{ e: 200, s: 0, hdg: 0, h: 86 }],
      hangars: [{ e: -800, s: -700, hdg: 122, len: 130, wid: 90, h: 30 }],
      aprons: [
        { e: -50, s: 180, hdg: 122, len: 1200, wid: 280 },
        { e: 420, s: -160, hdg: 122, len: 800, wid: 220 },
        { e: 680, s: -360, hdg: 122, len: 600, wid: 200 }
      ],
      taxiways: [
        { e: -600, s: -200, hdg: 122, len: 3800, wid: 30 },
        { e: -400, s: 400, hdg: 122, len: 3600, wid: 28 }
      ],
      gates: [
        { e: -80, s: 100, hdg: 302, n: 12, spacing: 72, bridge: 42 },
        { e: 380, s: -240, hdg: 302, n: 7, spacing: 68, bridge: 38 }
      ]
    },
    /* 成都双流 */
    ZUUU: {
      terminals: [
        { e: 300, s: 0, hdg: 22, len: 700, wid: 95, h: 28, floors: 3, name: 'T1' },
        { e: 500, s: 400, hdg: 22, len: 600, wid: 90, h: 26, floors: 3, name: 'T2' }
      ],
      towers: [{ e: 250, s: 150, hdg: 0, h: 62 }],
      hangars: [{ e: -200, s: 600, hdg: 22, len: 90, wid: 65, h: 22 }],
      aprons: [
        { e: 280, s: 40, hdg: 22, len: 900, wid: 220 },
        { e: 480, s: 420, hdg: 22, len: 800, wid: 200 }
      ],
      taxiways: [
        { e: 50, s: -800, hdg: 22, len: 3000, wid: 26 },
        { e: 350, s: -700, hdg: 22, len: 2800, wid: 26 }
      ],
      gates: [
        { e: 260, s: -40, hdg: 202, n: 8, spacing: 66, bridge: 36 },
        { e: 460, s: 360, hdg: 202, n: 6, spacing: 66, bridge: 36 }
      ]
    },
    /* 上海虹桥 */
    ZSSS: {
      terminals: [
        { e: 350, s: 0, hdg: 0, len: 500, wid: 90, h: 26, floors: 3, name: 'T1' },
        { e: -400, s: 50, hdg: 0, len: 600, wid: 100, h: 28, floors: 3, name: 'T2' }
      ],
      towers: [{ e: 0, s: 100, hdg: 0, h: 58 }],
      hangars: [{ e: 600, s: -500, hdg: 0, len: 90, wid: 60, h: 22 }],
      aprons: [
        { e: 320, s: 40, hdg: 0, len: 650, wid: 200 },
        { e: -380, s: 80, hdg: 0, len: 750, wid: 220 }
      ],
      taxiways: [
        { e: 100, s: -900, hdg: 177, len: 2800, wid: 26 },
        { e: -100, s: -900, hdg: 178, len: 2800, wid: 26 }
      ],
      gates: [
        { e: 300, s: -40, hdg: 180, n: 6, spacing: 64, bridge: 34 },
        { e: -360, s: 10, hdg: 180, n: 7, spacing: 66, bridge: 36 }
      ]
    },
    /* 成田 */
    RJAA: {
      terminals: [
        { e: -200, s: 100, hdg: 150, len: 700, wid: 100, h: 30, floors: 3, name: 'T1' },
        { e: 400, s: -200, hdg: 150, len: 550, wid: 90, h: 28, floors: 3, name: 'T2' },
        { e: 700, s: 300, hdg: 60, len: 400, wid: 80, h: 26, floors: 3, name: 'T3' }
      ],
      towers: [{ e: 100, s: 0, hdg: 0, h: 74 }],
      hangars: [{ e: -600, s: -500, hdg: 150, len: 100, wid: 70, h: 24 }],
      aprons: [
        { e: -150, s: 120, hdg: 150, len: 900, wid: 230 },
        { e: 420, s: -160, hdg: 150, len: 700, wid: 210 }
      ],
      taxiways: [
        { e: -300, s: -800, hdg: 150, len: 3200, wid: 28 },
        { e: 200, s: -600, hdg: 150, len: 2800, wid: 26 }
      ],
      gates: [
        { e: -180, s: 60, hdg: 330, n: 8, spacing: 68, bridge: 38 },
        { e: 380, s: -220, hdg: 330, n: 6, spacing: 68, bridge: 38 }
      ]
    },
    /* 法兰克福 */
    EDDF: {
      terminals: [
        { e: -100, s: 200, hdg: 70, len: 900, wid: 110, h: 30, floors: 3, name: 'T1' },
        { e: 400, s: -150, hdg: 70, len: 600, wid: 95, h: 28, floors: 3, name: 'T2' }
      ],
      towers: [{ e: 150, s: 50, hdg: 0, h: 82 }],
      hangars: [{ e: -800, s: -600, hdg: 70, len: 120, wid: 80, h: 28 }],
      aprons: [
        { e: -50, s: 220, hdg: 70, len: 1100, wid: 250 },
        { e: 420, s: -120, hdg: 70, len: 800, wid: 220 }
      ],
      taxiways: [
        { e: -500, s: -400, hdg: 70, len: 3600, wid: 28 },
        { e: -300, s: 500, hdg: 70, len: 3400, wid: 28 }
      ],
      gates: [
        { e: -80, s: 160, hdg: 250, n: 10, spacing: 70, bridge: 40 },
        { e: 380, s: -180, hdg: 250, n: 7, spacing: 68, bridge: 38 }
      ]
    },
    /* 巴黎戴高乐 */
    LFPG: {
      terminals: [
        { e: -200, s: -300, hdg: 80, len: 500, wid: 120, h: 32, floors: 3, name: 'T1' },
        { e: 400, s: 200, hdg: 80, len: 800, wid: 100, h: 30, floors: 3, name: 'T2' },
        { e: -600, s: 400, hdg: 0, len: 450, wid: 90, h: 26, floors: 2, name: 'T3' }
      ],
      towers: [{ e: 0, s: 0, hdg: 0, h: 80 }],
      hangars: [{ e: 900, s: -500, hdg: 80, len: 110, wid: 75, h: 26 }],
      aprons: [
        { e: -150, s: -250, hdg: 80, len: 700, wid: 220 },
        { e: 420, s: 220, hdg: 80, len: 1000, wid: 250 }
      ],
      taxiways: [
        { e: -400, s: -800, hdg: 80, len: 3200, wid: 28 },
        { e: 200, s: -600, hdg: 80, len: 3000, wid: 26 }
      ],
      gates: [
        { e: -180, s: -340, hdg: 260, n: 6, spacing: 70, bridge: 38 },
        { e: 380, s: 160, hdg: 260, n: 9, spacing: 70, bridge: 40 }
      ]
    }
  };

  /* ---------------------------------------------------------------------
     2. 材质 / 贴图缓存
     --------------------------------------------------------------------- */
  var _tex = {};
  var _mats = {};

  function noiseFill(ctx, w, h, base, amp, seed) {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    var r = seed || 3;
    function rnd() { r = (r * 16807) % 2147483647; return r / 2147483647; }
    try {
      var img = ctx.getImageData(0, 0, w, h), d = img.data;
      for (var i = 0; i < d.length; i += 4) {
        var n = (rnd() - 0.5) * amp;
        d[i] += n; d[i + 1] += n; d[i + 2] += n;
      }
      ctx.putImageData(img, 0, 0);
    } catch (e) { /* ignore */ }
  }

  function apronTex(THREE) {
    if (_tex.apron) return _tex.apron;
    var W = 256, H = 256, c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    noiseFill(g, W, H, '#4a4e54', 14, 19);
    g.strokeStyle = 'rgba(230,230,220,0.35)';
    g.lineWidth = 2;
    g.strokeRect(8, 8, W - 16, H - 16);
    g.fillStyle = 'rgba(20,20,20,0.08)';
    g.fillRect(W * 0.35, 0, W * 0.08, H);
    g.fillRect(W * 0.55, 0, W * 0.08, H);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    _tex.apron = t;
    return t;
  }

  function taxiTex(THREE) {
    if (_tex.taxi) return _tex.taxi;
    var W = 128, H = 256, c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    noiseFill(g, W, H, '#45484d', 12, 23);
    g.fillStyle = '#e6e2c8';
    g.fillRect(W * 0.46, 0, W * 0.08, H * 0.55);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    _tex.taxi = t;
    return t;
  }

  function facadeTex(THREE, tint) {
    var key = 'fac' + (tint || 0);
    if (_tex[key]) return _tex[key];
    var W = 256, H = 256, c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    g.fillStyle = tint || '#c8d0da';
    g.fillRect(0, 0, W, H);
    // 玻璃幕墙网格
    var rows = 8, cols = 12;
    for (var r = 0; r < rows; r++) {
      for (var col = 0; col < cols; col++) {
        var x = 6 + col * ((W - 12) / cols);
        var y = 10 + r * ((H - 20) / rows);
        var ww = (W - 12) / cols - 4;
        var hh = (H - 20) / rows - 4;
        var lit = ((r * 7 + col * 3) % 5) !== 0;
        g.fillStyle = lit ? 'rgba(140,190,220,0.85)' : 'rgba(60,90,120,0.75)';
        g.fillRect(x, y, ww, hh);
        g.strokeStyle = 'rgba(80,90,100,0.5)';
        g.strokeRect(x, y, ww, hh);
      }
    }
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    _tex[key] = t;
    return t;
  }

  function mat(THREE, kind) {
    if (_mats[kind]) return _mats[kind];
    var m;
    if (kind === 'apron') {
      m = new THREE.MeshStandardMaterial({
        map: apronTex(THREE), color: 0xffffff, roughness: 0.92, metalness: 0,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2
      });
      m.map.repeat.set(8, 8);
    } else if (kind === 'taxi') {
      m = new THREE.MeshStandardMaterial({
        map: taxiTex(THREE), color: 0xffffff, roughness: 0.9, metalness: 0,
        // 比停机坪 (-1/-2) 更强: 滑行道与停机坪重叠处始终压在上面, 不会互相闪
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4
      });
      m.map.repeat.set(1, 6);
    } else if (kind === 'concrete') {
      m = new THREE.MeshStandardMaterial({ color: 0xb8bec6, roughness: 0.85, metalness: 0.05 });
    } else if (kind === 'glass') {
      m = new THREE.MeshStandardMaterial({
        map: facadeTex(THREE), color: 0xffffff, roughness: 0.35, metalness: 0.45
      });
      m.map.repeat.set(4, 3);
    } else if (kind === 'roof') {
      m = new THREE.MeshStandardMaterial({ color: 0x6a7380, roughness: 0.7, metalness: 0.25 });
    } else if (kind === 'towerCab') {
      m = new THREE.MeshStandardMaterial({
        color: 0xa8d4ef, roughness: 0.25, metalness: 0.35,
        transparent: true, opacity: 0.88
      });
    } else if (kind === 'metal') {
      m = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.4, metalness: 0.7 });
    } else if (kind === 'bridge') {
      m = new THREE.MeshStandardMaterial({ color: 0xd8dde4, roughness: 0.55, metalness: 0.35 });
    } else {
      m = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8, metalness: 0.1 });
    }
    _mats[kind] = m;
    return m;
  }

  /* ---------------------------------------------------------------------
     3. 几何辅助
     --------------------------------------------------------------------- */
  function heightFn(env, elev) {
    if (env && env.getGroundHeight) {
      return function (x, z) { return env.getGroundHeight(x, z); };
    }
    return function () { return elev || 0; };
  }

  function groundStrip(THREE, ax, az, bx, bz, width, hf, yOff) {
    if (yOff === undefined) yOff = 0.05;
    var dx = bx - ax, dz = bz - az, L = Math.sqrt(dx * dx + dz * dz);
    if (!(L > 2)) return null;
    var dxu = dx / L, dzu = dz / L;
    var rx = -dzu, rz = dxu;
    var hw = width / 2;
    var n = Math.max(1, Math.ceil(L / 60));
    var pos = new Float32Array((n + 1) * 2 * 3);
    var uv = new Float32Array((n + 1) * 2 * 2);
    var idx = [];
    for (var k = 0; k <= n; k++) {
      var t = k / n, x = ax + dx * t, z = az + dz * t, v = t * (L / 40);
      for (var s = 0; s < 2; s++) {
        var side = s ? hw : -hw;
        var px = x + rx * side, pz = z + rz * side;
        var o = k * 2 + s;
        pos[o * 3] = px;
        pos[o * 3 + 1] = hf(px, pz) + yOff;
        pos[o * 3 + 2] = pz;
        uv[o * 2] = s; uv[o * 2 + 1] = v;
      }
    }
    for (var q = 0; q < n; q++) {
      var i0 = q * 2, i1 = i0 + 1, i2 = i0 + 3, i3 = i0 + 2;
      idx.push(i0, i1, i2, i0, i2, i3);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /** 沿整条折线生成连续带状路面 (拐点做斜接, 限制尖角长度)
      比"每段矩形独立成面"更可靠: 拐弯处不留缺口, 相邻段也不重叠共面 (避免闪面) */
  function ribbonGeo(THREE, pts, width, hf, yOff) {
    if (yOff === undefined) yOff = 0.05;
    var n = pts.length;
    if (n < 2) return null;
    var hw = width / 2;
    var nx = new Array(n), nz = new Array(n), i;
    for (i = 0; i < n; i++) {
      var inx = 0, inz = 0, oux = 0, ouz = 0, L, dx, dz;
      if (i > 0) {
        dx = pts[i].x - pts[i - 1].x; dz = pts[i].z - pts[i - 1].z; L = Math.sqrt(dx * dx + dz * dz) || 1;
        inx = -dz / L; inz = dx / L;
      }
      if (i < n - 1) {
        dx = pts[i + 1].x - pts[i].x; dz = pts[i + 1].z - pts[i].z; L = Math.sqrt(dx * dx + dz * dz) || 1;
        oux = -dz / L; ouz = dx / L;
      }
      if (i === 0) { nx[i] = oux; nz[i] = ouz; }
      else if (i === n - 1) { nx[i] = inx; nz[i] = inz; }
      else {
        var mx = inx + oux, mz = inz + ouz, ml = Math.sqrt(mx * mx + mz * mz);
        if (ml < 1e-4) { nx[i] = oux; nz[i] = ouz; }          // 几乎 180° 折返
        else {
          mx /= ml; mz /= ml;
          var cs = mx * oux + mz * ouz;
          if (cs < 0.62) cs = 0.62;                            // 限制尖角外伸 (≤1.61 倍半宽)
          nx[i] = mx / cs; nz[i] = mz / cs;
        }
      }
    }
    var pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), idx = [], acc = 0;
    for (var k = 0; k < n; k++) {
      if (k > 0) acc += Math.sqrt(Math.pow(pts[k].x - pts[k - 1].x, 2) + Math.pow(pts[k].z - pts[k - 1].z, 2));
      for (var s = 0; s < 2; s++) {
        var sg = s ? 1 : -1;
        var px = pts[k].x + nx[k] * hw * sg, pz = pts[k].z + nz[k] * hw * sg;
        var o = k * 2 + s;
        pos[o * 3] = px;
        pos[o * 3 + 1] = hf(px, pz) + yOff;
        pos[o * 3 + 2] = pz;
        uv[o * 2] = s; uv[o * 2 + 1] = acc / 40;
      }
    }
    for (var q = 0; q < n - 1; q++) {
      var i0 = q * 2, i1 = i0 + 1, i2 = i0 + 3, i3 = i0 + 2;
      idx.push(i0, i1, i2, i0, i2, i3);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function groundRect(THREE, cx, cz, len, wid, hdgDeg, hf, yOff) {
    if (yOff === undefined) yOff = 0.05;
    var h = hdgDeg * DEG;
    // 航向：0 = 北 = -Z；游戏 Z 南为正，所以前进方向：
    var fx = Math.sin(h), fz = -Math.cos(h);
    var rx = Math.cos(h), rz = Math.sin(h);
    var hl = len / 2, hw = wid / 2;
    var corners = [
      [cx - fx * hl - rx * hw, cz - fz * hl - rz * hw],
      [cx + fx * hl - rx * hw, cz + fz * hl - rz * hw],
      [cx + fx * hl + rx * hw, cz + fz * hl + rz * hw],
      [cx - fx * hl + rx * hw, cz - fz * hl + rz * hw]
    ];
    var pos = new Float32Array(12), uv = new Float32Array(8);
    for (var i = 0; i < 4; i++) {
      pos[i * 3] = corners[i][0];
      pos[i * 3 + 1] = hf(corners[i][0], corners[i][1]) + yOff;
      pos[i * 3 + 2] = corners[i][1];
    }
    uv.set([0, 0, 1, 0, 1, 1, 0, 1]);
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    return g;
  }

  function placeBuilding(THREE, group, mats, cx, cy, cz, len, wid, height, hdgDeg, style) {
    var root = new THREE.Group();
    root.position.set(cx, cy, cz);
    root.rotation.y = -hdgDeg * DEG;

    var body = new THREE.Mesh(
      new THREE.BoxGeometry(len, height, wid),
      style === 'hangar' ? mat(THREE, 'concrete') : mat(THREE, 'glass')
    );
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    root.add(body);

    // 屋顶
    var roofH = style === 'hangar' ? 4 : 2.2;
    var roof = new THREE.Mesh(
      style === 'hangar'
        ? new THREE.CylinderGeometry(wid * 0.55, wid * 0.55, len * 0.98, 12, 1, false, 0, Math.PI)
        : new THREE.BoxGeometry(len + 2, roofH, wid + 2),
      mat(THREE, 'roof')
    );
    if (style === 'hangar') {
      roof.rotation.z = Math.PI / 2;
      roof.position.y = height + 0.5;
    } else {
      roof.position.y = height + roofH / 2;
    }
    roof.castShadow = true;
    root.add(roof);

    // 航站楼入口雨棚
    if (style === 'terminal') {
      var canopy = new THREE.Mesh(
        new THREE.BoxGeometry(len * 0.6, 1.2, 14),
        mat(THREE, 'metal')
      );
      canopy.position.set(0, 8, wid / 2 + 6);
      root.add(canopy);
      // 支柱
      for (var p = -2; p <= 2; p++) {
        var col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 8, 8), mat(THREE, 'metal'));
        col.position.set(p * len * 0.12, 4, wid / 2 + 5);
        root.add(col);
      }
    }

    group.add(root);
    return root;
  }

  /* ---------------------------------------------------------------------
     滑行道灯光 (beta 0.4.2)
     · 边灯: 蓝色 (taxiway edge light), 两侧, 间距 40 m
     · 中线灯: 绿色 (taxiway centerline), 中线, 间距 20 m
     · 出口/等待位置灯: 琥珀色
     polylines: [{ pts:[{x,z}...], hw: 半宽 }]
     按颜色合并为 InstancedMesh, 每座机场只增加 2 个 draw call。
     --------------------------------------------------------------------- */
  function taxiwayLights(THREE, group, hf, polylines) {
    var EDGE = 0x2f6bff, CENTER = 0x35e06a, HOLD = 0xffb020;
    var edge = [], cen = [], hold = [];
    polylines.forEach(function (pl) {
      var pts = pl.pts, hw = pl.hw;
      for (var k = 0; k + 1 < pts.length; k++) {
        var a = pts[k], b = pts[k + 1];
        var dx = b.x - a.x, dz = b.z - a.z, L = Math.sqrt(dx * dx + dz * dz);
        if (L < 4) continue;
        var ux = dx / L, uz = dz / L, rx = -uz, rz = ux;
        var s;
        for (s = 20; s <= L - 8; s += 40) {
          for (var sd = -1; sd <= 1; sd += 2) {
            var ex = a.x + ux * s + rx * sd * (hw + 1.1);
            var ez = a.z + uz * s + rz * sd * (hw + 1.1);
            edge.push([ex, hf(ex, ez) + 0.34, ez]);   // 高出道面, 避免灯球半埋进路面造成闪面
          }
        }
        for (s = 10; s <= L - 5; s += 20) {
          var mx = a.x + ux * s, mz = a.z + uz * s;
          cen.push([mx, hf(mx, mz) + 0.34, mz]);
        }
        // 折点处补一个琥珀色等待灯
        if (k + 2 < pts.length) hold.push([b.x, hf(b.x, b.z) + 0.38, b.z]);
      }
    });
    var geo = new THREE.SphereGeometry(0.28, 5, 3);
    var m4 = new THREE.Matrix4();
    function emit(list, color, name) {
      if (!list.length) return;
      var mm = new THREE.MeshBasicMaterial({ color: color, toneMapped: false });
      // r149 的 InstancedMesh 没有实例包围盒, 视锥裁剪只看 geometry.boundingSphere ——
      // 也就是共享几何在世界原点处的那个 0.28 m 小球, 相机一移开原点整批灯就会整体消失。
      // 给这一批克隆一份几何并写入真实包围球: 该隐藏时正常隐藏, 不该隐藏时不会整批消失。
      // (不能简单关掉裁剪: 单座大机场就有 1.5 万颗灯球, 全程绘制会明显掉帧)
      var c = new THREE.Vector3(), i, d2;
      for (i = 0; i < list.length; i++) { c.x += list[i][0]; c.y += list[i][1]; c.z += list[i][2]; }
      c.multiplyScalar(1 / list.length);
      var rad = 0;
      for (i = 0; i < list.length; i++) {
        d2 = (list[i][0] - c.x) * (list[i][0] - c.x) + (list[i][1] - c.y) * (list[i][1] - c.y) + (list[i][2] - c.z) * (list[i][2] - c.z);
        if (d2 > rad) rad = d2;
      }
      var bg = geo.clone();
      bg.boundingSphere = new THREE.Sphere(c, Math.sqrt(rad) + 0.35);
      var im = new THREE.InstancedMesh(bg, mm, list.length);
      for (i = 0; i < list.length; i++) {
        m4.makeTranslation(list[i][0], list[i][1], list[i][2]);
        im.setMatrixAt(i, m4);
      }
      im.instanceMatrix.needsUpdate = true;
      im.name = name;
      group.add(im);
    }
    emit(edge, EDGE, 'taxiEdgeLights');
    emit(cen, CENTER, 'taxiCenterLights');
    emit(hold, HOLD, 'taxiHoldLights');
  }

  function placeTower(THREE, group, cx, cy, cz, height) {
    var root = new THREE.Group();
    root.position.set(cx, cy, cz);
    var shaftH = height * 0.72;
    var shaft = new THREE.Mesh(
      new THREE.BoxGeometry(9, shaftH, 9),
      mat(THREE, 'concrete')
    );
    shaft.position.y = shaftH / 2;
    shaft.castShadow = true;
    root.add(shaft);
    // 收腰
    var mid = new THREE.Mesh(
      new THREE.CylinderGeometry(5.5, 7, height * 0.12, 12),
      mat(THREE, 'concrete')
    );
    mid.position.y = shaftH + height * 0.06;
    root.add(mid);
    // 塔台瞭望室
    var cab = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 7, height * 0.14, 12),
      mat(THREE, 'towerCab')
    );
    cab.position.y = shaftH + height * 0.18;
    cab.castShadow = true;
    root.add(cab);
    // 顶天线
    var ant = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, height * 0.12, 6),
      mat(THREE, 'metal')
    );
    ant.position.y = height * 0.98;
    root.add(ant);
    var dish = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), mat(THREE, 'metal'));
    dish.position.set(2.5, height * 0.92, 0);
    root.add(dish);
    group.add(root);
    return { x: cx, y: cy + height * 0.9, z: cz };
  }

  function placeJetBridge(THREE, group, gx, gy, gz, hdgDeg, bridgeLen) {
    var root = new THREE.Group();
    root.position.set(gx, gy, gz);
    root.rotation.y = -hdgDeg * DEG;
    var L = bridgeLen || 36;
    // 固定端旋转厅
    var rotunda = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.2, 5.5, 12),
      mat(THREE, 'bridge')
    );
    rotunda.position.set(0, 5.5 / 2 + 4, 0);
    root.add(rotunda);
    // 伸缩廊桥
    var tunnel = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 3.4, L),
      mat(THREE, 'bridge')
    );
    tunnel.position.set(0, 6.5, L / 2);
    tunnel.castShadow = true;
    root.add(tunnel);
    // 玻璃顶条
    var glass = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.3, L * 0.95),
      mat(THREE, 'towerCab')
    );
    glass.position.set(0, 8.3, L / 2);
    root.add(glass);
    // 升降轮架
    var bogie = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 1.2, 4),
      mat(THREE, 'metal')
    );
    bogie.position.set(0, 0.8, L * 0.75);
    root.add(bogie);
    var leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 5.5, 8),
      mat(THREE, 'metal')
    );
    leg.position.set(0, 3.5, L * 0.75);
    root.add(leg);
    // 舱口
    var cab = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 3.6, 3.5),
      mat(THREE, 'bridge')
    );
    cab.position.set(0, 6.6, L + 1);
    root.add(cab);
    group.add(root);
  }

  /* ---------------------------------------------------------------------
     3b. 机场地面细节 (beta 0.4.2)
         风向标 / 油库 / 雷达 / ILS 天线 / 防吹坪 / 围界栅栏
         叠加在 OSM 真实布局与手工布局之上, 提升地景真实度
     --------------------------------------------------------------------- */
  function addGroundDetails(THREE, airport, group, hf) {
    var defs = (FS.Runways && FS.Runways.runwayDefs) ? FS.Runways.runwayDefs(airport) : [];
    if (!defs.length) return;
    var metal = mat(THREE, 'metal'), concrete = mat(THREE, 'concrete');
    defs.sort(function (a, b) { return b.L - a.L; });
    var R = defs[0];
    var midX = (R.a.x + R.b.x) / 2, midZ = (R.a.z + R.b.z) / 2;
    var rx = -R.d.z, rz = R.d.x, fx = R.d.x, fz = R.d.z;   // 右向 / 前向
    var halfW = R.w / 2;

    /* 风向标 x2 (跑道两侧接地区附近) */
    function windsock(x, z) {
      var g = new THREE.Group(), y = hf(x, z);
      g.position.set(x, y, z);
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.20, 6, 6), metal);
      pole.position.y = 3; g.add(pole);
      var sock = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.6, 8, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xff5a2a, roughness: 0.9, side: THREE.DoubleSide }));
      sock.rotation.z = Math.PI / 2; sock.position.set(1.35, 5.7, 0); g.add(sock);
      var sock2 = new THREE.Mesh(new THREE.ConeGeometry(0.48, 2.2, 8, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.9, side: THREE.DoubleSide }));
      sock2.rotation.z = Math.PI / 2; sock2.position.set(3.4, 5.7, 0); g.add(sock2);
      group.add(g);
    }
    windsock(midX + rx * (halfW + 60), midZ + rz * (halfW + 60));
    windsock(midX - rx * (halfW + 60), midZ - rz * (halfW + 60));

    /* 油库: 3 个立式储罐 + 围堰 */
    var cxT = midX + rx * (halfW + 320), czT = midZ + rz * (halfW + 320), yT = hf(cxT, czT);
    var tankM = new THREE.MeshStandardMaterial({ color: 0xcfd4d8, roughness: 0.45, metalness: 0.5 });
    for (var i = -1; i <= 1; i++) {
      var tx = cxT + rx * i * 34, tz = czT + rz * i * 34;
      var tank = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 16, 16), tankM);
      tank.position.set(tx, yT + 8, tz); tank.castShadow = true; group.add(tank);
      var cap = new THREE.Mesh(new THREE.CylinderGeometry(9.4, 9.4, 1.2, 16), metal);
      cap.position.set(tx, yT + 16.4, tz); group.add(cap);
    }
    var berm = new THREE.Mesh(new THREE.BoxGeometry(120, 1.5, 70), concrete);
    berm.position.set(cxT, yT + 0.4, czT); group.add(berm);

    /* 雷达 (ASR): 塔架 + 抛物面天线 */
    var cxR = midX + rx * (halfW + 150) + fx * 180, czR = midZ + rz * (halfW + 150) + fz * 180, yR = hf(cxR, czR);
    var mast = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 16, 8), metal);
    mast.position.set(cxR, yR + 8, czR); group.add(mast);
    var dish = new THREE.Mesh(new THREE.SphereGeometry(5, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), metal);
    dish.rotation.x = -Math.PI / 2.6; dish.position.set(cxR, yR + 17, czR); group.add(dish);

    /* ILS: 航向台 (远端) + 下滑台 (接地区侧向) */
    var hx = R.b.x + fx * 300, hz = R.b.z + fz * 300, hy = hf(hx, hz);
    for (var hi = -3; hi <= 3; hi++) {
      var pxh = hx + rx * hi * 4, pzh = hz + rz * hi * 4;
      var ant = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3, 0.4), metal);
      ant.position.set(pxh, hy + 1.5, pzh); group.add(ant);
    }
    var gx = R.a.x + fx * 300 + rx * (halfW + 30), gz = R.a.z + fz * 300 + rz * (halfW + 30), gy = hf(gx, gz);
    var gsh = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2, 1), metal);
    gsh.position.set(gx, gy + 2.5, gz); group.add(gsh);
    var gpost = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2, 6), metal);
    gpost.position.set(gx, gy + 1, gz); group.add(gpost);

    /* 防吹坪 (blast fence): 停机坪端头的一排立板 */
    var bx = midX + rx * (halfW + 200) - fx * 120, bz = midZ + rz * (halfW + 200) - fz * 120;
    var bm = new THREE.MeshStandardMaterial({ color: 0x8a9098, roughness: 0.7, metalness: 0.4, side: THREE.DoubleSide });
    var byaw = Math.atan2(fx, fz);
    for (var bi = -6; bi <= 6; bi++) {
      var pxb = bx + fx * bi * 10, pzb = bz + fz * bi * 10;
      var plate = new THREE.Mesh(new THREE.BoxGeometry(9.6, 4, 0.3), bm);
      plate.position.set(pxb, hf(pxb, pzb) + 2, pzb);
      plate.rotation.y = byaw;
      group.add(plate);
    }

    /* 围界栅栏: 环绕跑道群的矩形, 立柱 (InstancedMesh) + 3 层铁丝 */
    var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    defs.forEach(function (D) {
      [D.a, D.b].forEach(function (p) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
      });
    });
    var pad = 260;
    minX -= pad; maxX += pad; minZ -= pad; maxZ += pad;
    if (maxX - minX <= 8000 && maxZ - minZ <= 8000) {
      var pts = [], step = 42;
      function edge(x0, z0, x1, z1) {
        var dx = x1 - x0, dz = z1 - z0, LL = Math.sqrt(dx * dx + dz * dz), n = Math.max(1, Math.round(LL / step));
        for (var k = 0; k <= n; k++) pts.push([x0 + dx * k / n, z0 + dz * k / n]);
      }
      edge(minX, minZ, maxX, minZ); edge(maxX, minZ, maxX, maxZ);
      edge(maxX, maxZ, minX, maxZ); edge(minX, maxZ, minX, minZ);
      var postGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.4, 5);
      var im = new THREE.InstancedMesh(postGeo, metal, pts.length);
      var m4 = new THREE.Matrix4();
      for (var pi = 0; pi < pts.length; pi++) {
        m4.makeTranslation(pts[pi][0], hf(pts[pi][0], pts[pi][1]) + 1.2, pts[pi][1]);
        im.setMatrixAt(pi, m4);
      }
      im.instanceMatrix.needsUpdate = true; group.add(im);
      var wirePos = [];
      for (var lvl = 0; lvl < 3; lvl++) {
        for (var wi = 0; wi < pts.length - 1; wi++) {
          var a2 = pts[wi], b2 = pts[wi + 1];
          wirePos.push(a2[0], hf(a2[0], a2[1]) + 0.6 + lvl * 0.85, a2[1]);
          wirePos.push(b2[0], hf(b2[0], b2[1]) + 0.6 + lvl * 0.85, b2[1]);
        }
      }
      var lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(wirePos, 3));
      group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
        color: 0x9aa0a6, transparent: true, opacity: 0.5
      })));
    }
  }

  /* ---------------------------------------------------------------------
     4. 由跑道生成通用布局
     --------------------------------------------------------------------- */
  function genericLayout(airport) {
    var defs = (FS.Runways && FS.Runways.runwayDefs) ? FS.Runways.runwayDefs(airport) : [];
    if (!defs.length) {
      return {
        terminals: [{ e: 400, s: 0, hdg: 0, len: 280, wid: 70, h: 22, floors: 2, name: 'T1' }],
        towers: [{ e: 250, s: 80, hdg: 0, h: 48 }],
        hangars: [{ e: 600, s: -200, hdg: 0, len: 80, wid: 55, h: 20 }],
        aprons: [{ e: 380, s: 40, hdg: 0, len: 400, wid: 160 }],
        taxiways: [{ e: 150, s: -400, hdg: 0, len: 900, wid: 24 }],
        gates: [{ e: 350, s: -50, hdg: 180, n: 4, spacing: 60, bridge: 32 }]
      };
    }
    // 选最长跑道，在其右侧布置航站区
    defs.sort(function (a, b) { return b.L - a.L; });
    var R = defs[0];
    var midX = (R.a.x + R.b.x) / 2, midZ = (R.a.z + R.b.z) / 2;
    // 右向
    var rx = -R.d.z, rz = R.d.x;
    var arp = FS.Geo.toWorld(airport.lat, airport.lon);
    // 转换为相对 ARP 的东/南偏移
    function toES(wx, wz) { return { e: wx - arp.x, s: wz - arp.z }; }
    var side = 380;
    var term = toES(midX + rx * side, midZ + rz * side);
    var hdg = Math.atan2(R.d.x, -R.d.z) / DEG;
    var apronC = toES(midX + rx * (side - 80), midZ + rz * (side - 80));
    var towerC = toES(midX + rx * (side + 40), midZ + rz * (side + 40));
    var hangC = toES(midX + rx * side + R.d.x * (R.L * 0.35), midZ + rz * side + R.d.z * (R.L * 0.35));
    var taxiA = toES(R.a.x + rx * 160, R.a.z + rz * 160);
    return {
      terminals: [{ e: term.e, s: term.s, hdg: hdg, len: Math.min(600, R.L * 0.35), wid: 80, h: 24, floors: 2, name: 'T1' }],
      towers: [{ e: towerC.e, s: towerC.s, hdg: 0, h: airport.size === 'large' ? 64 : 45 }],
      hangars: [{ e: hangC.e, s: hangC.s, hdg: hdg, len: 90, wid: 60, h: 22 }],
      aprons: [{ e: apronC.e, s: apronC.s, hdg: hdg, len: Math.min(800, R.L * 0.4), wid: 180 }],
      taxiways: [
        { e: taxiA.e, s: taxiA.s, hdg: hdg, len: R.L * 0.9, wid: 26 },
        { e: (taxiA.e + term.e) / 2, s: (taxiA.s + term.s) / 2, hdg: hdg + 90, len: side * 0.7, wid: 24 }
      ],
      gates: [{ e: term.e - rx * 30 * 0, s: term.s, hdg: hdg + 180, n: airport.size === 'large' ? 6 : 3, spacing: 62, bridge: 34 }]
    };
  }

  /* ---------------------------------------------------------------------
     5. 构建一座机场
     --------------------------------------------------------------------- */
  function buildAirport3D(THREE, env, airport, opts) {
    opts = opts || {};
    var group = new THREE.Group();
    group.name = 'airport3d:' + airport.icao;
    var elev = (airport.elevFt || 0) * 0.3048;
    var hf = heightFn(env, elev);
    var arp = FS.Geo.toWorld(airport.lat, airport.lon);
    var osmData = FS.AIRPORT_OSM && FS.AIRPORT_OSM[airport.icao];
    var towerPos = null;
    var matsUsed = [];
    if (osmData && opts.osm !== false) {
      /* beta 0.4: 真实轮廓 (OSM) */
      var r = buildFromOsm(THREE, env, airport, osmData, group);
      towerPos = r.towerPos;
      if (!towerPos) {
        // OSM 中没有塔台: 用手工布局或通用布局的塔台位置
        var tl = (LAYOUTS[airport.icao] || genericLayout(airport)).towers || [];
        if (tl[0]) {
          var tw = { x: arp.x + tl[0].e, z: arp.z + tl[0].s };
          towerPos = placeTower(THREE, group, tw.x, hf(tw.x, tw.z), tw.z, tl[0].h || 55);
        }
      }
      group.userData.airport = airport;
      group.userData.detailed = true;
      group.userData.source = 'osm';
      group.userData.osmStats = r.stats;
      group.userData.towerPos = towerPos;
      try { addGroundDetails(THREE, airport, group, hf); } catch (eGD) { /* 忽略 */ }
      group.userData.dispose = function () {
        group.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
      };
      return group;
    }
    var layout = LAYOUTS[airport.icao] || genericLayout(airport);
    var detailed = !!LAYOUTS[airport.icao];

    function worldES(e, s) {
      return { x: arp.x + e, z: arp.z + s, y: hf(arp.x + e, arp.z + s) };
    }

    // 停机坪
    (layout.aprons || []).forEach(function (a, pi) {
      var w = worldES(a.e, a.s);
      // 毫米级分层, 与滑行道/跑道错开 (重叠处不再共面互闪)
      var geo = groundRect(THREE, w.x, w.z, a.len, a.wid, a.hdg || 0, hf, 0.048 + 0.001 * (pi % 4));
      if (!geo) return;
      var m = mat(THREE, 'apron').clone();
      m.map = apronTex(THREE).clone();
      m.map.repeat.set(a.len / 40, a.wid / 40);
      m.map.needsUpdate = true;
      var mesh = new THREE.Mesh(geo, m);
      mesh.name = 'apron';
      mesh.receiveShadow = true;
      group.add(mesh);
      matsUsed.push(m);
    });

    // 滑行道
    var taxiLights = [];
    (layout.taxiways || []).forEach(function (t, ti) {
      var h = (t.hdg || 0) * DEG;
      var fx = Math.sin(h), fz = -Math.cos(h);
      var w0 = worldES(t.e, t.s);
      var ax = w0.x - fx * t.len / 2, az = w0.z - fz * t.len / 2;
      var bx = w0.x + fx * t.len / 2, bz = w0.z + fz * t.len / 2;
      var geo = groundStrip(THREE, ax, az, bx, bz, t.wid || 25, hf, 0.053 + 0.0012 * (ti % 4));
      if (!geo) return;
      var m = mat(THREE, 'taxi').clone();
      m.map = taxiTex(THREE).clone();
      m.map.repeat.set(1, t.len / 40);
      m.map.needsUpdate = true;
      var mesh = new THREE.Mesh(geo, m);
      mesh.name = 'taxiway';
      mesh.receiveShadow = true;
      group.add(mesh);
      matsUsed.push(m);
      taxiLights.push({ pts: [{ x: ax, z: az }, { x: bx, z: bz }], hw: (t.wid || 25) / 2 });
    });
    try { taxiwayLights(THREE, group, hf, taxiLights); } catch (eTL) { /* 忽略 */ }

    // 航站楼
    (layout.terminals || []).forEach(function (t) {
      var w = worldES(t.e, t.s);
      placeBuilding(THREE, group, matsUsed, w.x, w.y, w.z, t.len, t.wid, t.h || 24, t.hdg || 0, 'terminal');
    });

    // 机库
    (layout.hangars || []).forEach(function (h) {
      var w = worldES(h.e, h.s);
      placeBuilding(THREE, group, matsUsed, w.x, w.y, w.z, h.len, h.wid, h.h || 22, h.hdg || 0, 'hangar');
    });

    // 塔台
    (layout.towers || []).forEach(function (t) {
      var w = worldES(t.e, t.s);
      var tp = placeTower(THREE, group, w.x, w.y, w.z, t.h || 55);
      if (!towerPos) towerPos = tp;
    });

    // 廊桥 / 登机口
    (layout.gates || []).forEach(function (g) {
      var h = (g.hdg || 0) * DEG;
      var rx = Math.cos(h), rz = Math.sin(h);
      for (var i = 0; i < (g.n || 1); i++) {
        var off = (i - ((g.n || 1) - 1) / 2) * (g.spacing || 65);
        var w = worldES(g.e + rx * off, g.s + rz * off);
        placeJetBridge(THREE, group, w.x, w.y, w.z, g.hdg || 0, g.bridge || 36);
      }
    });

    // 泛光灯柱（主要机场）
    if (detailed || airport.size === 'large') {
      (layout.aprons || []).slice(0, 3).forEach(function (a) {
        var w = worldES(a.e, a.s);
        var h = (a.hdg || 0) * DEG;
        var fx = Math.sin(h), fz = -Math.cos(h);
        var rx = Math.cos(h), rz = Math.sin(h);
        for (var i = -1; i <= 1; i += 2) {
          for (var j = -1; j <= 1; j += 2) {
            var px = w.x + fx * a.len * 0.4 * i + rx * a.wid * 0.42 * j;
            var pz = w.z + fz * a.len * 0.4 * i + rz * a.wid * 0.42 * j;
            var py = hf(px, pz);
            var pole = new THREE.Mesh(
              new THREE.CylinderGeometry(0.35, 0.5, 22, 6),
              mat(THREE, 'metal')
            );
            pole.position.set(px, py + 11, pz);
            group.add(pole);
            var head = new THREE.Mesh(
              new THREE.BoxGeometry(3.5, 0.6, 1.2),
              mat(THREE, 'metal')
            );
            head.position.set(px, py + 22.2, pz);
            group.add(head);
          }
        }
      });
    }

    group.userData.airport = airport;
    group.userData.detailed = detailed;
    group.userData.source = detailed ? 'layout' : 'generic';
    group.userData.towerPos = towerPos;
    try { addGroundDetails(THREE, airport, group, hf); } catch (eGD2) { /* 忽略 */ }
    group.userData.dispose = function () {
      group.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
      });
      matsUsed.forEach(function (m) { if (m && m.dispose) m.dispose(); });
    };
    return group;
  }

  /* ---------------------------------------------------------------------
     5b. beta 0.4: 由内置 OSM 布局 (js/airport-osm-data.js) 生成真实轮廓的立体机场
         · 航站楼 / 机库 / 场内建筑: 真实轮廓挤出 (高度取 OSM height / building:levels, 缺省按类型)
         · 停机坪: 真实多边形 (含内洞) 三角化
         · 滑行道: 真实中线 + 宽度, 节点处圆盘补角, 黄色中线
         · 廊桥 / 塔台: 真实位置
         全部按材质合并为少量网格 (每座机场约 8 个 draw call)
     --------------------------------------------------------------------- */
  function Acc() { this.p = []; this.n = []; this.uv = []; this.i = []; }
  Acc.prototype.v = function (x, y, z, nx, ny, nz, u, w) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, w);
    return this.p.length / 3 - 1;
  };
  Acc.prototype.mesh = function (THREE, material, name) {
    if (!this.i.length) return null;
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    var m = new THREE.Mesh(g, material);
    m.name = name || '';
    return m;
  };
  /** 追加一个法线朝上 (+Y) 的三角形 (自动纠正绕序) */
  Acc.prototype.triUp = function (a, b, c) {
    var P = this.p;
    var ax = P[a * 3], az = P[a * 3 + 2];
    var ny = (P[b * 3 + 2] - az) * (P[c * 3] - ax) - (P[b * 3] - ax) * (P[c * 3 + 2] - az);
    if (ny >= 0) this.i.push(a, b, c); else this.i.push(a, c, b);
  };
  /** 绕 Y 旋转的长方体追加到累加器 (yaw: 局部 +X 指向世界 (cos, sin)) */
  Acc.prototype.box = function (cx, cy, cz, sx, sy, sz, yaw) {
    var c = Math.cos(yaw || 0), s = Math.sin(yaw || 0), self = this;
    var hx = sx / 2, hy = sy / 2, hz = sz / 2;
    function tr(x, z) { return [cx + x * c - z * s, cz + x * s + z * c]; }
    var faces = [
      [[1, 0, 0], [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]]],
      [[-1, 0, 0], [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]]],
      [[0, 1, 0], [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]]],
      [[0, -1, 0], [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]]],
      [[0, 0, 1], [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]]],
      [[0, 0, -1], [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]]]
    ];
    faces.forEach(function (f) {
      var nx = f[0][0] * c - f[0][2] * s, nz = f[0][0] * s + f[0][2] * c, base = self.p.length / 3;
      f[1].forEach(function (q, k) {
        var w = tr(q[0], q[2]);
        self.v(w[0], cy + q[1], w[1], nx, f[0][1], nz, (k === 1 || k === 2) ? 1 : 0, k >= 2 ? 1 : 0);
      });
      self.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    });
  };

  function wallTex(THREE, kind) {
    var key = 'wall' + kind;
    if (_tex[key]) return _tex[key];
    var W = 256, H = 256, c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var r, col;
    if (kind === 1) {               // 机库: 竖向压型钢板
      g.fillStyle = '#c3c8cd'; g.fillRect(0, 0, W, H);
      for (var x = 0; x < W; x += 8) { g.fillStyle = (x / 8) % 2 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.08)'; g.fillRect(x, 0, 4, H); }
      g.fillStyle = 'rgba(40,50,60,0.25)'; g.fillRect(0, H * 0.06, W, 6);
    } else if (kind === 0) {        // 航站楼: 大面积玻璃幕墙 + 竖梃
      var grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, '#6f97b4'); grd.addColorStop(1, '#3f6580');
      g.fillStyle = grd; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(210,220,228,0.85)'; g.lineWidth = 3;
      for (var mx = 0; mx <= W; mx += 32) { g.beginPath(); g.moveTo(mx, 0); g.lineTo(mx, H); g.stroke(); }
      for (var my = 0; my <= H; my += 64) { g.beginPath(); g.moveTo(0, my); g.lineTo(W, my); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,0.10)';
      for (r = 0; r < 4; r++) g.fillRect(0, r * 64 + 4, W, 10);
    } else {                        // 其它: 混凝土 + 条窗
      noiseFill(g, W, H, kind === 3 ? '#a9a59c' : '#c9c4b8', 10, 41 + kind);
      for (r = 0; r < 4; r++) {
        for (col = 0; col < 8; col++) {
          var lit = ((r * 5 + col * 3) % 7) !== 0;
          g.fillStyle = kind === 3 ? 'rgba(30,30,30,0.85)' : (lit ? 'rgba(90,120,145,0.9)' : 'rgba(45,60,75,0.9)');
          g.fillRect(col * 32 + 4, r * 64 + 22, 24, 22);
        }
      }
    }
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    _tex[key] = t;
    return t;
  }
  function osmMat(THREE, kind) {
    var key = 'osm_' + kind;
    if (_mats[key]) return _mats[key];
    var m;
    switch (kind) {
      case 'wall0': m = new THREE.MeshStandardMaterial({ map: wallTex(THREE, 0), roughness: 0.25, metalness: 0.55, side: THREE.DoubleSide }); break;
      case 'wall1': m = new THREE.MeshStandardMaterial({ map: wallTex(THREE, 1), roughness: 0.55, metalness: 0.45, side: THREE.DoubleSide }); break;
      case 'wall2': m = new THREE.MeshStandardMaterial({ map: wallTex(THREE, 2), roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide }); break;
      case 'wall3': m = new THREE.MeshStandardMaterial({ map: wallTex(THREE, 3), roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide }); break;
      case 'roof': m = new THREE.MeshStandardMaterial({ color: 0x8d949c, roughness: 0.75, metalness: 0.2, side: THREE.DoubleSide }); break;
      case 'apron':
        m = new THREE.MeshStandardMaterial({ map: apronTex(THREE), color: 0xf2f2f2, roughness: 0.92, metalness: 0,
          polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
        break;
      case 'taxi':
        m = new THREE.MeshStandardMaterial({ map: taxiLineTex(THREE), color: 0xffffff, roughness: 0.9, metalness: 0,
          polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
        break;
      case 'bridge': m = mat(THREE, 'bridge'); break;
      default: m = mat(THREE, 'metal');
    }
    _mats[key] = m;
    return m;
  }
  /** 滑行道: 沥青 + 15 cm 黄色中线 + 两侧边线 (u 横向 0..1, v 沿线 40 m 一周期) */
  function taxiLineTex(THREE) {
    if (_tex.taxiLine) return _tex.taxiLine;
    var W = 128, H = 128, c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    noiseFill(g, W, H, '#44474c', 12, 29);
    g.fillStyle = '#d8b31c';
    g.fillRect(W / 2 - 2, 0, 4, H);
    g.fillRect(2, 0, 2, H); g.fillRect(W - 4, 0, 2, H);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    _tex.taxiLine = t;
    return t;
  }

  function buildFromOsm(THREE, env, airport, data, group) {
    var elev = (airport.elevFt || 0) * 0.3048;
    var hf = heightFn(env, elev);
    var lat0 = airport.lat, lon0 = airport.lon;
    function W(arr, k) { return FS.Geo.toWorld(lat0 + arr[k] * 1e-6, lon0 + arr[k + 1] * 1e-6); }
    function ringPts(arr) { var o = []; for (var k = 0; k + 1 < arr.length; k += 2) o.push(W(arr, k)); return o; }
    var V2 = THREE.Vector2, tri = THREE.ShapeUtils.triangulateShape;
    var stats = { b: 0, a: 0, t: 0, j: 0 };

    /* --- 停机坪 --- */
    var apron = new Acc();
    (data.a || []).forEach(function (A, ai) {
      var outer = ringPts(A[0]), holes = (A[1] || []).map(ringPts);
      var contour = outer.map(function (q) { return new V2(q.x, q.z); });
      var hv = holes.map(function (h) { return h.map(function (q) { return new V2(q.x, q.z); }); });
      var faces;
      try { faces = tri(contour, hv); } catch (e) { return; }
      var all = outer.concat.apply(outer, holes), base = apron.p.length / 3;
      // 毫米级分层: 相邻/重叠的停机坪不再完全共面 (否则深度值只差 1 个 ulp, 会随机互闪)
      var ayE = 0.048 + 0.001 * (ai % 4);
      all.forEach(function (q) { apron.v(q.x, hf(q.x, q.z) + ayE, q.z, 0, 1, 0, q.x / 40, q.z / 40); });
      faces.forEach(function (f) { apron.triUp(base + f[0], base + f[1], base + f[2]); });
      stats.a++;
    });

    /* --- 滑行道 --- */
    var taxi = new Acc();
    var taxiLightPolys = [];
    (data.t || []).forEach(function (T, wi) {
      var hw = T[0] / 2, pts = ringPts(T[1]);
      if (pts.length < 2) return;
      taxiLightPolys.push({ pts: pts, hw: hw });
      var n = pts.length, k;
      // 拐点用斜接 (miter) 法线: 相邻两段共用同一条端边 —— 拐弯处既不留缺口也不重叠。
      // 旧做法是"每段一个矩形 + 拐点补圆盘", 圆盘与两侧矩形完全共面重叠, 深度值只差 1 个 ulp,
      // 相机一动就随机互闪; 同一条 way 的段与段之间也重叠。
      var mx = new Array(n), mz = new Array(n);
      for (k = 0; k < n; k++) {
        var inx = 0, inz = 0, oux = 0, ouz = 0, dx, dz, L;
        if (k > 0) { dx = pts[k].x - pts[k - 1].x; dz = pts[k].z - pts[k - 1].z; L = Math.sqrt(dx * dx + dz * dz) || 1; inx = -dz / L; inz = dx / L; }
        if (k < n - 1) { dx = pts[k + 1].x - pts[k].x; dz = pts[k + 1].z - pts[k].z; L = Math.sqrt(dx * dx + dz * dz) || 1; oux = -dz / L; ouz = dx / L; }
        if (k === 0) { mx[k] = oux; mz[k] = ouz; }
        else if (k === n - 1) { mx[k] = inx; mz[k] = inz; }
        else {
          var sx = inx + oux, sz = inz + ouz, sl = Math.sqrt(sx * sx + sz * sz);
          if (sl < 1e-4) { mx[k] = oux; mz[k] = ouz; }        // 近似 180° 折返
          else {
            sx /= sl; sz /= sl;
            var cs = sx * oux + sz * ouz;
            if (cs < 0.62) cs = 0.62;                            // 限制尖角外伸 (≤1.61 倍半宽, 急折返不再鼓成一大块)
            mx[k] = sx / cs; mz[k] = sz / cs;
          }
        }
      }
      // 每条 way 毫米级抬升错开: T 型路口/交叉处与别的滑行道完全共面时会互闪
      // (仍低于跑道 0.06, 跑道上的标线在交叉口不会被盖住)
      var yE = 0.053 + 0.0012 * (wi % 4), vAcc = 0;
      for (k = 0; k + 1 < n; k++) {
        var a = pts[k], b = pts[k + 1];
        var sdx = b.x - a.x, sdz = b.z - a.z, sL = Math.sqrt(sdx * sdx + sdz * sdz);
        if (sL < 0.5) continue;
        var snx = -sdz / sL, snz = sdx / sL;
        var sub = Math.max(1, Math.ceil(sL / 20));            // 每 ≤20 m 一段, 道面贴合地形起伏
        for (var q2 = 0; q2 < sub; q2++) {
          var t0 = q2 / sub, t1 = (q2 + 1) / sub;
          var p0x = a.x + sdx * t0, p0z = a.z + sdz * t0;
          var p1x = a.x + sdx * t1, p1z = a.z + sdz * t1;
          var n0x = q2 === 0 ? mx[k] : snx, n0z = q2 === 0 ? mz[k] : snz;
          var n1x = q2 === sub - 1 ? mx[k + 1] : snx, n1z = q2 === sub - 1 ? mz[k + 1] : snz;
          var v0 = vAcc + sL * t0 / 40, v1 = vAcc + sL * t1 / 40;
          var base = taxi.p.length / 3;
          var c0x = p0x - n0x * hw, c0z = p0z - n0z * hw;
          var c1x = p0x + n0x * hw, c1z = p0z + n0z * hw;
          var c2x = p1x + n1x * hw, c2z = p1z + n1z * hw;
          var c3x = p1x - n1x * hw, c3z = p1z - n1z * hw;
          taxi.v(c0x, hf(c0x, c0z) + yE, c0z, 0, 1, 0, 0, v0);
          taxi.v(c1x, hf(c1x, c1z) + yE, c1z, 0, 1, 0, 1, v0);
          taxi.v(c2x, hf(c2x, c2z) + yE, c2z, 0, 1, 0, 1, v1);
          taxi.v(c3x, hf(c3x, c3z) + yE, c3z, 0, 1, 0, 0, v1);
          taxi.triUp(base, base + 1, base + 2); taxi.triUp(base, base + 2, base + 3);
        }
        vAcc += sL / 40;
      }
      stats.t++;
    });

    /* --- 建筑 --- */
    var walls = [new Acc(), new Acc(), new Acc(), new Acc()], roof = new Acc();
    (data.b || []).forEach(function (B) {
      var kind = B[0], h = B[1], outer = ringPts(B[2]), holes = (B[3] || []).map(ringPts);
      if (outer.length < 3) return;
      var by = Infinity;
      outer.forEach(function (q) { by = Math.min(by, hf(q.x, q.z)); });
      by -= 0.4;
      var top = by + h + 0.4, acc = walls[kind] || walls[2];
      var tileW = kind === 1 ? 16 : 12, tileH = kind === 0 ? Math.max(8, h / 2) : kind === 1 ? h : 12;
      [outer].concat(holes).forEach(function (ring) {
        var per = 0;
        for (var k = 0; k < ring.length; k++) {
          var a = ring[k], b = ring[(k + 1) % ring.length], dx = b.x - a.x, dz = b.z - a.z, L = Math.sqrt(dx * dx + dz * dz);
          if (L < 0.2) continue;
          var nx = -dz / L, nz = dx / L, base = acc.p.length / 3, u0 = per / tileW, u1 = (per + L) / tileW;
          acc.v(a.x, by, a.z, nx, 0, nz, u0, 0);
          acc.v(b.x, by, b.z, nx, 0, nz, u1, 0);
          acc.v(b.x, top, b.z, nx, 0, nz, u1, (top - by) / tileH);
          acc.v(a.x, top, a.z, nx, 0, nz, u0, (top - by) / tileH);
          acc.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
          per += L;
        }
      });
      var faces;
      try {
        faces = tri(outer.map(function (q) { return new V2(q.x, q.z); }), holes.map(function (hh) { return hh.map(function (q) { return new V2(q.x, q.z); }); }));
      } catch (e) { faces = []; }
      var allR = outer.concat.apply(outer, holes), rb = roof.p.length / 3;
      allR.forEach(function (q) { roof.v(q.x, top, q.z, 0, 1, 0, q.x / 20, q.z / 20); });
      faces.forEach(function (f) { roof.triUp(rb + f[0], rb + f[1], rb + f[2]); });
      stats.b++;
    });

    /* --- 廊桥: 旋转厅 + 伸缩通道 + 升降支腿 --- */
    var br = new Acc(), metal = new Acc();
    (data.j || []).forEach(function (J) {
      var pts = ringPts(J); if (pts.length < 2) return;
      var a = pts[0], b = pts[pts.length - 1], dx = b.x - a.x, dz = b.z - a.z, L = Math.sqrt(dx * dx + dz * dz);
      if (L < 6) return;
      var yaw = Math.atan2(dz, dx), gy = hf((a.x + b.x) / 2, (a.z + b.z) / 2);
      br.box((a.x + b.x) / 2, gy + 5.2, (a.z + b.z) / 2, L, 3.0, 3.4, yaw);
      br.box(b.x, gy + 5.2, b.z, 3.2, 3.4, 4.2, yaw);
      metal.box(a.x + dx * 0.72, gy + 1.9, a.z + dz * 0.72, 0.5, 3.8, 0.5, yaw);
      metal.box(a.x + dx * 0.72, gy + 0.5, a.z + dz * 0.72, 2.8, 1.0, 3.2, yaw);
      stats.j++;
    });

    var meshes = [
      apron.mesh(THREE, osmMat(THREE, 'apron'), 'osm:apron'),
      taxi.mesh(THREE, osmMat(THREE, 'taxi'), 'osm:taxiway'),
      walls[0].mesh(THREE, osmMat(THREE, 'wall0'), 'osm:terminal'),
      walls[1].mesh(THREE, osmMat(THREE, 'wall1'), 'osm:hangar'),
      walls[2].mesh(THREE, osmMat(THREE, 'wall2'), 'osm:building'),
      walls[3].mesh(THREE, osmMat(THREE, 'wall3'), 'osm:parking'),
      roof.mesh(THREE, osmMat(THREE, 'roof'), 'osm:roof'),
      br.mesh(THREE, osmMat(THREE, 'bridge'), 'osm:jetbridge'),
      metal.mesh(THREE, osmMat(THREE, 'metal'), 'osm:metal')
    ];
    meshes.forEach(function (m, idx) {
      if (!m) return;
      if (idx <= 1) { m.receiveShadow = true; m.renderOrder = idx === 0 ? -2 : -1; }
      else { m.castShadow = idx >= 2 && idx <= 6; m.receiveShadow = true; }
      group.add(m);
    });

    /* --- 滑行道灯光 (蓝色边灯 + 绿色中线灯) --- */
    try { taxiwayLights(THREE, group, hf, taxiLightPolys); } catch (eTL) { /* 忽略 */ }

    /* --- 塔台 --- */
    var towerPos = null;
    (data.c || []).forEach(function (C) {
      var w = FS.Geo.toWorld(lat0 + C[0] * 1e-6, lon0 + C[1] * 1e-6);
      var h = C[2] > 20 ? C[2] : (airport.size === 'large' ? 70 : 45);
      var tp = placeTower(THREE, group, w.x, hf(w.x, w.z), w.z, h);
      if (!towerPos) towerPos = tp;
    });
    return { towerPos: towerPos, stats: stats };
  }

  /* ---------------------------------------------------------------------
     6. OSM 联网补充 (可选；CORS/网络失败时静默忽略)
     --------------------------------------------------------------------- */
  var OSM_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];

  function fetchOsmLayout(airport, cb) {
    if (!airport || !FS.CFG || !FS.CFG.onlineScenery) { cb(null); return; }
    var pad = 0.04;
    var s = airport.lat - pad, w = airport.lon - pad, n = airport.lat + pad, e = airport.lon + pad;
    var q = '[out:json][timeout:25];(' +
      'way["aeroway"="taxiway"](' + s + ',' + w + ',' + n + ',' + e + ');' +
      'way["aeroway"="apron"](' + s + ',' + w + ',' + n + ',' + e + ');' +
      'way["aeroway"="terminal"](' + s + ',' + w + ',' + n + ',' + e + ');' +
      'way["building"="hangar"](' + s + ',' + w + ',' + n + ',' + e + ');' +
      ');out body geom;';
    var idx = 0;
    function tryNext() {
      if (idx >= OSM_ENDPOINTS.length) { cb(null); return; }
      var url = OSM_ENDPOINTS[idx++];
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 12000);
      fetch(url, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(q),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json();
      }).then(function (data) {
        cb(data);
      }).catch(function () {
        clearTimeout(timer);
        tryNext();
      });
    }
    tryNext();
  }

  /** 把 OSM 元素转成额外滑行道/停机坪 mesh 并加入 group */
  function applyOsmExtras(THREE, env, airport, group, osmData) {
    if (!osmData || !osmData.elements || !osmData.elements.length) return 0;
    var elev = (airport.elevFt || 0) * 0.3048;
    var hf = heightFn(env, elev);
    var added = 0;
    osmData.elements.forEach(function (el) {
      if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) return;
      var tags = el.tags || {};
      var aeroway = tags.aeroway || '';
      if (aeroway === 'taxiway' || aeroway === 'apron') {
        // 整条 way 合成一条连续路面: 拐弯处不再留缝, 也不会出现共面重叠的段
        var pts = [], clean = [], i;
        for (i = 0; i < el.geometry.length; i++) {
          var w = FS.Geo.toWorld(el.geometry[i].lat, el.geometry[i].lon);
          pts.push({ x: w.x, z: w.z });
        }
        for (i = 0; i < pts.length; i++) {
          var last = clean[clean.length - 1];
          if (!last || Math.abs(pts[i].x - last.x) > 0.5 || Math.abs(pts[i].z - last.z) > 0.5) clean.push(pts[i]);
        }
        if (clean.length < 2) return;
        var wid = aeroway === 'apron' ? 40 : 22;
        // 毫米级分层: 滑行道略高于停机坪 (但低于跑道 0.06), 重叠处不会随机互闪
        var yOff = (aeroway === 'apron' ? 0.048 : 0.053) + 0.0012 * (added % 4);
        var geo = ribbonGeo(THREE, clean, wid, hf, yOff);
        if (!geo) return;
        var mesh = new THREE.Mesh(geo, mat(THREE, aeroway === 'apron' ? 'apron' : 'taxi'));
        mesh.name = 'osm:' + aeroway;
        mesh.receiveShadow = true;
        group.add(mesh);
        added++;
      }
    });
    return added;
  }

  /* ---------------------------------------------------------------------
     7. 公共 API
     --------------------------------------------------------------------- */
  function nearbyBuild(THREE, env, radiusKm, mustInclude, opts) {
    var list = (FS.Runways && FS.Runways.nearbyAirports)
      ? FS.Runways.nearbyAirports(radiusKm || 250, mustInclude)
      : (mustInclude || []).filter(Boolean);
    var groups = [];
    var towerByIcao = {};
    list.forEach(function (ap) {
      if (!ap) return;
      try {
        var g = buildAirport3D(THREE, env, ap, opts);
        groups.push(g);
        if (g.userData.towerPos) towerByIcao[ap.icao] = g.userData.towerPos;
      } catch (err) {
        if (FS.Log) FS.Log.warn('airport3d ' + ap.icao + ': ' + err.message);
      }
    });
    return { groups: groups, towerByIcao: towerByIcao };
  }

  /* ---------------------------------------------------------------------
     停机位 (供「冷舱启动」等场景把飞机停在停机坪上)
       从停机坪矩形推算: 机位在停机坪靠外侧的地面上, 机头朝向航站楼一侧,
       沿停机坪长轴排列若干机位。这样保证飞机始终停在道面上, 不会压到航站楼。
     返回世界坐标 [{ x, z, hdg, name }]
     --------------------------------------------------------------------- */
  function parkingStands(icao, opts) {
    opts = opts || {};
    var airport = (FS.Airports && FS.Airports.byIcao) ? FS.Airports.byIcao(icao) : null;
    if (!airport || !FS.Geo) return [];
    var layout = LAYOUTS[icao] || genericLayout(airport);
    var aprons = layout.aprons || [];
    if (!aprons.length) return [];
    var arp = FS.Geo.toWorld(airport.lat, airport.lon);
    function worldE(e, s) { return { x: arp.x + e, z: arp.z + s }; }
    // 选离航站楼最近的停机坪
    var terms = layout.terminals || [];
    var best = aprons[0], bestD = Infinity, bestTerm = null;
    for (var ai = 0; ai < aprons.length; ai++) {
      var ac = worldE(aprons[ai].e, aprons[ai].s);
      for (var ti = 0; ti < terms.length; ti++) {
        var tc = worldE(terms[ti].e, terms[ti].s);
        var dd = Math.hypot(tc.x - ac.x, tc.z - ac.z);
        if (dd < bestD) { bestD = dd; best = aprons[ai]; bestTerm = terms[ti]; }
      }
    }
    var h = (best.hdg || 0) * DEG;
    var fx = Math.sin(h), fz = -Math.cos(h);          // 停机坪长轴
    var rx = Math.cos(h), rz = Math.sin(h);           // 停机坪侧向
    var C = worldE(best.e, best.s);
    // 航站楼在停机坪的哪一侧 (没有航站楼信息时默认 -r 侧)
    var side = -1;
    if (bestTerm) {
      var T = worldE(bestTerm.e, bestTerm.s);
      side = ((T.x - C.x) * rx + (T.z - C.z) * rz) >= 0 ? 1 : -1;
    }
    var halfWid = (best.wid || 160) / 2, halfLen = (best.len || 400) / 2;
    var BODY_HALF = 32;                               // A330 半长, 保证机头仍落在道面上
    var lat = -side * Math.max(0, halfWid - BODY_HALF - 14);   // 靠停机坪外侧
    var hdg = Math.atan2(rx * side, -rz * side) / DEG;         // 机头朝航站楼
    if (hdg < 0) hdg += 360;
    var spacing = 74;
    var span = Math.max(0, Math.min(halfLen - BODY_HALF - 12, 360));
    var n = span < spacing ? 1 : (Math.floor(span * 2 / spacing) + 1);
    var list = [];
    for (var k = 0; k < n; k++) {
      var off = n === 1 ? 0 : (-span + (2 * span) * k / (n - 1));
      list.push({
        x: C.x + fx * off + rx * lat,
        z: C.z + fz * off + rz * lat,
        hdg: hdg,
        name: 'ST' + (k + 1)
      });
    }
    if (opts.index) return [list[Math.min(opts.index, list.length - 1)]];
    return list;
  }

  FS.Airport3D = {
    parkingStands: parkingStands,
    layouts: LAYOUTS,
    buildAirport: buildAirport3D,
    nearbyBuild: nearbyBuild,
    fetchOsmLayout: fetchOsmLayout,
    applyOsmExtras: applyOsmExtras,
    buildFromOsm: buildFromOsm,
    hasOsmLayout: function (icao) { return !!(FS.AIRPORT_OSM && FS.AIRPORT_OSM[icao]); },
    hasDetailedLayout: function (icao) { return !!LAYOUTS[icao] || !!(FS.AIRPORT_OSM && FS.AIRPORT_OSM[icao]); },
    osmCount: function () { return FS.AIRPORT_OSM ? Object.keys(FS.AIRPORT_OSM).length : 0; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
