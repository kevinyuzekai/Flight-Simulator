/* ==========================================================================
   天际航线 SkyRoute — 立体机场 (airport3d.js, beta 0.3.2)
   --------------------------------------------------------------------------
   在跑道道面之外生成：停机坪、滑行道、航站楼、廊桥、塔台、机库等。
   · 内置若干主要机场的真实布局（相对机场基准点的东/南偏移，单位米）
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
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2
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

  function groundStrip(THREE, ax, az, bx, bz, width, hf) {
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
        pos[o * 3 + 1] = hf(px, pz) + 0.05;
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

  function groundRect(THREE, cx, cz, len, wid, hdgDeg, hf) {
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
      pos[i * 3 + 1] = hf(corners[i][0], corners[i][1]) + 0.05;
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
    var layout = LAYOUTS[airport.icao] || genericLayout(airport);
    var detailed = !!LAYOUTS[airport.icao];
    var towerPos = null;
    var matsUsed = [];

    function worldES(e, s) {
      return { x: arp.x + e, z: arp.z + s, y: hf(arp.x + e, arp.z + s) };
    }

    // 停机坪
    (layout.aprons || []).forEach(function (a) {
      var w = worldES(a.e, a.s);
      var geo = groundRect(THREE, w.x, w.z, a.len, a.wid, a.hdg || 0, hf);
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
    (layout.taxiways || []).forEach(function (t) {
      var h = (t.hdg || 0) * DEG;
      var fx = Math.sin(h), fz = -Math.cos(h);
      var w0 = worldES(t.e, t.s);
      var ax = w0.x - fx * t.len / 2, az = w0.z - fz * t.len / 2;
      var bx = w0.x + fx * t.len / 2, bz = w0.z + fz * t.len / 2;
      var geo = groundStrip(THREE, ax, az, bx, bz, t.wid || 25, hf);
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
    });

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
    group.userData.towerPos = towerPos;
    group.userData.dispose = function () {
      group.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
      });
      matsUsed.forEach(function (m) { if (m && m.dispose) m.dispose(); });
    };
    return group;
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
        for (var i = 0; i < el.geometry.length - 1; i++) {
          var a = FS.Geo.toWorld(el.geometry[i].lat, el.geometry[i].lon);
          var b = FS.Geo.toWorld(el.geometry[i + 1].lat, el.geometry[i + 1].lon);
          var wid = aeroway === 'apron' ? 40 : 22;
          var geo = groundStrip(THREE, a.x, a.z, b.x, b.z, wid, hf);
          if (!geo) continue;
          var mesh = new THREE.Mesh(geo, mat(THREE, aeroway === 'apron' ? 'apron' : 'taxi'));
          mesh.name = 'osm:' + aeroway;
          mesh.receiveShadow = true;
          group.add(mesh);
          added++;
        }
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

  FS.Airport3D = {
    layouts: LAYOUTS,
    buildAirport: buildAirport3D,
    nearbyBuild: nearbyBuild,
    fetchOsmLayout: fetchOsmLayout,
    applyOsmExtras: applyOsmExtras,
    hasDetailedLayout: function (icao) { return !!LAYOUTS[icao]; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
