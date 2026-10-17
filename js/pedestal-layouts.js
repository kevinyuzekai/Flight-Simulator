/* SkyRoute — 中央操纵台数据布局 (按机型)
 * 结构: { pw: 操纵台半宽 (m), mcdu: { x, w } (空客 MCDU 中心 x / 宽), trimX: 空客俯仰配平手轮 x, levX / levZ: 空客减速板 / 襟翼手柄 x 与 (推力扇区后缘起) z,
 *         panels: [{ n, x, z, w, h, rows }] }
 * 面板坐标: x 右为正; z 以推力手柄扇区后缘为 0, 向后为正 (前部 MCDU 区为负)。rows[0] = 面板前缘 (靠仪表板)。
 * 控件字符串与头顶板相同 (见 overhead-layouts.js), 另有 kp = 键盘 (附加 = 列x行)。f=<id> 为功能控件:
 *   eng-master-1/2, eng-mode, park-brake, xpdr, tcas, wxr。推力手柄 / 襟翼 / 减速板 / 配平手轮 / MCDU 由 _buildPedestal 建模。
 * 参考 (仅作位置参考, 未使用其图像): "A32S Pedestal" (Pablo Andrés Ortega Ch., Wikimedia Commons),
 *   "Thrust levers of an Airbus A320.jpg" (Wikimedia Commons), 公开 FCOM 式操纵台说明。
 */
(function (global) {
  'use strict';
  var FS = global.FS = global.FS || {};

  var RMP = function (n, x, z) { return { n: n, x: x, z: z, w: 0.13, h: 0.10, rows: [
    ['disp|ACTIVE', 'pb|XFR|/', 'disp|STBY/CRS', 'knob|'],
    ['pb|VHF1|/', 'pb|VHF2|/', 'pb|VHF3|/', 'pb|HF1|/', 'pb|AM|/', 'pb|HF2|/'],
    ['pb|NAV|/', 'pb|VOR|/', 'pb|ILS|/', 'pb|MLS|/', 'pb|ADF|/', 'pb|BFO|/', 'tg|SEL|ON,OFF']] }; };
  var ACP = function (n, x, z) { return { n: n, x: x, z: z, w: 0.13, h: 0.10, rows: [
    ['pb|VHF1|CALL/', 'pb|VHF2|CALL/', 'pb|VHF3|CALL/', 'pb|HF1|CALL/', 'pb|HF2|CALL/', 'pb|CAB|CALL/'],
    ['knob|VHF1', 'knob|VHF2', 'knob|VHF3', 'knob|HF1', 'knob|HF2', 'knob|PA'],
    ['pb|VOICE|/', 'pb|RESET|/', 'knob|VOR1', 'knob|VOR2', 'knob|MKR', 'knob|ADF1', 'knob|ADF2']] }; };
  var BCOMM = function (n, x, z, w) { return { n: n, x: x, z: z, w: w || 0.15, h: 0.065, rows: [['disp|ACTIVE', 'pb|TFR|/', 'disp|STANDBY', 'knob|', 'pb|TEST|/']] }; };
  var BACP = function (n, x, z, w) { return { n: n, x: x, z: z, w: w || 0.15, h: 0.095, rows: [
    ['pb|VHF1|/', 'pb|VHF2|/', 'pb|VHF3|/', 'pb|HF1|/', 'pb|HF2|/', 'pb|FLT|/', 'pb|SVC|/', 'pb|PA|/', 'pb|CAB|/'],
    ['knob|VHF1', 'knob|VHF2', 'knob|VHF3', 'knob|HF1', 'knob|HF2', 'knob|FLT', 'knob|SVC', 'knob|PA'],
    ['knob|VOR1', 'knob|VOR2', 'knob|APP1', 'knob|APP2', 'knob|MKR', 'knob|ADF', 'tg|R/T-I/C|R/T,I/C', 'rot|FILTER|V,B,R']] }; };

  /* ---------------- A320 系列 (照片: A32S Pedestal) ----------------
   * 前部 MCDU 1 / ECAM 控制板 / MCDU 2 (其前为 SWITCHING); 推力扇区两侧配平手轮, 手轮外侧 RMP 1/2 (前) + ACP 1/2 (后);
   * 扇区后: ENG 面板 (MASTER 1 / MODE / MASTER 2), 两侧减速板 / 襟翼手柄; 左后 FLOOD LT + WX RADAR, 右后 FLOOD LT/PRINT/DFDR + ATC/TCAS;
   * 中后 COCKPIT DOOR; 最后部 RMP 3 / ACP 3, PARK BRK, RUD TRIM, 打印机。 */
  var A320 = { pw: 0.26, mcdu: { x: 0.168, w: 0.15 }, trimX: 0.116, levX: 0.13, levZ: 0.07, panels: [
    { n: 'SWITCHING', x: 0, z: -0.425, w: 0.16, h: 0.05, rows: [['rot|ATT HDG|CAPT 3,NORM,F/O 3', 'rot|AIR DATA|CAPT 3,NORM,F/O 3', 'rot|EIS DMC|CAPT 3,NORM,F/O 3', 'rot|ECAM/ND XFR|CAPT,NORM,F/O']] },
    { n: 'ECAM', x: 0, z: -0.32, w: 0.16, h: 0.15, rows: [
      ['knob|UPPER DISPLAY', 'knob|LOWER DISPLAY'],
      ['pb|TO CONFIG|/', 'pb|EMER CANC|/', 'pb|ENG|/', 'pb|BLEED|/', 'pb|PRESS|/'],
      ['pb|ELEC|/', 'pb|HYD|/', 'pb|FUEL|/', 'pb|APU|/', 'pb|COND|/'],
      ['pb|DOOR|/', 'pb|WHEEL|/', 'pb|F/CTL|/', 'pb|ALL|/', 'pb|CLR|/'],
      ['pb|STS|/', 'pb|RCL|/', 'pb|CLR|/']] },
    RMP('RMP 1', -0.195, -0.165), RMP('RMP 2', 0.195, -0.165),
    ACP('ACP 1', -0.195, -0.06), ACP('ACP 2', 0.195, -0.06),
    { n: 'ENG', x: 0, z: 0.06, w: 0.15, h: 0.11, rows: [
      ['tg|ENG 1|ON,OFF|f=eng-master-1', 'rot|MODE|CRANK,NORM,IGN START|f=eng-mode', 'tg|ENG 2|ON,OFF|f=eng-master-2'],
      ['lamp|1|FIRE', 'sp', 'lamp|2|FIRE']] },
    { n: 'FLOOD LT', x: -0.205, z: 0.035, w: 0.11, h: 0.055, rows: [['knob|MAIN PNL & PED', 'knob|INTEG LT']] },
    { n: 'WX RADAR', x: -0.205, z: 0.13, w: 0.11, h: 0.12, rows: [['knob|GAIN', 'tg|MULTISCAN|AUTO,MAN', 'tg|GCS|AUTO,OFF'], ['rot|MODE|WX,WX+T,TURB,MAP', 'knob|TILT', 'tg|SYS|1,OFF,2|f=wxr']] },
    { n: 'FLOOD LT / AIDS / DFDR', x: 0.205, z: 0.035, w: 0.11, h: 0.055, rows: [['knob|FLOOD LT', 'pb|AIDS PRINT|/', 'pb|DFDR EVENT|/']] },
    { n: 'ATC / TCAS', x: 0.205, z: 0.135, w: 0.11, h: 0.13, rows: [
      ['tg|ATC|1,2', 'disp|', 'pb|IDENT|/'], ['kp|CODE|4x2', 'pb|CLR|/'],
      ['rot|ALT RPTG|OFF,ON', 'rot|XPDR|STBY,AUTO,ON|f=xpdr', 'rot|TCAS|STBY,TA,TA/RA|f=tcas', 'rot|TRAFFIC|THRT,ALL,ABV,BLW']] },
    { n: 'COCKPIT DOOR', x: 0, z: 0.175, w: 0.17, h: 0.055, rows: [['gtg|COCKPIT DOOR|UNLOCK,NORM,LOCK', 'lamp|OPEN', 'lamp|FAULT']] },
    RMP('RMP 3', -0.13, 0.27), ACP('ACP 3', 0.13, 0.27),
    { n: 'PARK BRK', x: -0.13, z: 0.39, w: 0.13, h: 0.08, rows: [['rot|PARK BRK|OFF,ON|f=park-brake']] },
    { n: 'RUD TRIM', x: 0.13, z: 0.39, w: 0.13, h: 0.08, rows: [['disp|L 0.0'], ['rot|RUD TRIM|NOSE L,0,NOSE R', 'pb|RESET|/']] },
    { n: 'PRINTER', x: 0, z: 0.48, w: 0.26, h: 0.06, rows: [['disp|PAPER', 'pb|FEED|/', 'pb|TEST|/', 'lamp|PAPER OUT', 'lamp|FAULT']] }
  ] };

  /* ---------------- A330: A320 式 + MCDU 3 / 3 部 RMP + 更宽操纵台 ---------------- */
  var A330 = { pw: 0.27, mcdu: { x: 0.175, w: 0.15 }, trimX: 0.116, levX: 0.13, levZ: 0.07, panels: [
    { n: 'SWITCHING', x: 0, z: -0.425, w: 0.17, h: 0.05, rows: [['rot|ATT HDG|CAPT 3,NORM,F/O 3', 'rot|AIR DATA|CAPT 3,NORM,F/O 3', 'rot|EIS DMC|CAPT 3,NORM,F/O 3', 'rot|ECAM/ND XFR|CAPT,NORM,F/O']] },
    { n: 'ECAM', x: 0, z: -0.32, w: 0.17, h: 0.15, rows: [
      ['knob|UPPER', 'knob|LOWER'], ['pb|TO CONFIG|/', 'pb|EMER CANC|/', 'pb|ENG|/', 'pb|BLEED|/', 'pb|PRESS|/', 'pb|EL/AC|/'],
      ['pb|EL/DC|/', 'pb|HYD|/', 'pb|C/B|/', 'pb|APU|/', 'pb|COND|/', 'pb|DOOR|/'], ['pb|WHEEL|/', 'pb|F/CTL|/', 'pb|FUEL|/', 'pb|ALL|/', 'pb|CLR|/'], ['pb|STS|/', 'pb|RCL|/', 'pb|CLR|/']] },
    RMP('RMP 1', -0.2, -0.165), RMP('RMP 2', 0.2, -0.165), ACP('ACP 1', -0.2, -0.06), ACP('ACP 2', 0.2, -0.06),
    { n: 'ENG', x: 0, z: 0.06, w: 0.15, h: 0.11, rows: [
      ['tg|ENG 1|ON,OFF|f=eng-master-1', 'rot|MODE|CRANK,NORM,IGN START|f=eng-mode', 'tg|ENG 2|ON,OFF|f=eng-master-2'], ['lamp|1|FIRE', 'sp', 'lamp|2|FIRE']] },
    { n: 'FLOOD LT', x: -0.21, z: 0.035, w: 0.12, h: 0.055, rows: [['knob|MAIN PNL & PED', 'knob|INTEG LT']] },
    { n: 'WX RADAR', x: -0.21, z: 0.13, w: 0.12, h: 0.12, rows: [['knob|GAIN', 'tg|MULTISCAN|AUTO,MAN', 'tg|GCS|AUTO,OFF'], ['rot|MODE|WX,WX+T,TURB,MAP', 'knob|TILT', 'tg|SYS|1,OFF,2|f=wxr']] },
    { n: 'PRINT / DFDR', x: 0.21, z: 0.035, w: 0.12, h: 0.055, rows: [['knob|FLOOD LT', 'pb|PRINT|/', 'pb|DFDR EVENT|/']] },
    { n: 'ATC / TCAS', x: 0.21, z: 0.135, w: 0.12, h: 0.13, rows: [
      ['tg|ATC|1,2', 'disp|', 'pb|IDENT|/'], ['kp|CODE|4x2', 'pb|CLR|/'],
      ['rot|ALT RPTG|OFF,ON', 'rot|XPDR|STBY,AUTO,ON|f=xpdr', 'rot|TCAS|STBY,TA,TA/RA|f=tcas', 'rot|TRAFFIC|THRT,ALL,ABV,BLW']] },
    { n: 'MCDU 3', x: 0, z: 0.215, w: 0.15, h: 0.13, rows: [['disp|', 'disp|'], ['kp|LSK / FUNCTION|6x3'], ['kp|ALPHA / NUM|10x3']] },
    RMP('RMP 3', -0.20, 0.30), ACP('ACP 3', 0.20, 0.30),
    { n: 'PARK BRK', x: -0.14, z: 0.42, w: 0.13, h: 0.08, rows: [['rot|PARK BRK|OFF,ON|f=park-brake']] },
    { n: 'RUD TRIM', x: 0.14, z: 0.42, w: 0.13, h: 0.08, rows: [['disp|L 0.0'], ['rot|RUD TRIM|NOSE L,0,NOSE R', 'pb|RESET|/']] },
    { n: 'COCKPIT DOOR', x: 0, z: 0.335, w: 0.14, h: 0.055, rows: [['gtg|DOOR|UNLOCK,NORM,LOCK', 'lamp|OPEN', 'lamp|FAULT']] },
    { n: 'PRINTER', x: 0, z: 0.50, w: 0.26, h: 0.05, rows: [['disp|PAPER', 'pb|FEED|/', 'pb|TEST|/', 'lamp|PAPER OUT']] }
  ] };

  /* ---------------- A350: KCCU 前部 (保持原建模), 中央 ECP + 多功能面板; RMP 为触屏; SURV 面板集成 XPDR/TCAS/WXR/TERR ---------------- */
  var A350 = { pw: 0.29, trimX: 0.116, levX: 0.13, levZ: 0.075, panels: [
    { n: 'ECP', x: 0, z: -0.30, w: 0.15, h: 0.12, rows: [
      ['pb|ENG|/', 'pb|APU|/', 'pb|BLEED|/', 'pb|COND|/', 'pb|PRESS|/', 'pb|DOOR|/'], ['pb|EL AC|/', 'pb|EL DC|/', 'pb|FUEL|/', 'pb|WHEEL|/', 'pb|HYD|/', 'pb|F/CTL|/'],
      ['pb|VIDEO|/', 'pb|ALL|/', 'pb|CB|/', 'pb|CRUISE|/', 'pb|STS|/', 'pb|C/L|/'], ['pb|TO CONFIG|/', 'pb|EMER CANC|/', 'pb|RCL LL|/', 'pb|CLR|/', 'pb|ABN PROC|/']] },
    { n: 'RMP 1', x: -0.205, z: -0.16, w: 0.15, h: 0.11, rows: [['disp|TOUCH SCREEN', 'disp|'], ['knob|VOL', 'pb|MENU|/', 'pb|SQWK|/', 'pb|VHF|/', 'pb|HF|/', 'pb|TEL|/', 'pb|NAV|/']] },
    { n: 'RMP 2', x: 0.205, z: -0.16, w: 0.15, h: 0.11, rows: [['disp|TOUCH SCREEN', 'disp|'], ['knob|VOL', 'pb|MENU|/', 'pb|SQWK|/', 'pb|VHF|/', 'pb|HF|/', 'pb|TEL|/', 'pb|NAV|/']] },
    { n: 'ACP 1', x: -0.205, z: -0.05, w: 0.15, h: 0.09, rows: [['knob|VHF1', 'knob|VHF2', 'knob|VHF3', 'knob|HF1', 'knob|HF2', 'knob|INT'], ['pb|VOICE|/', 'pb|RESET|/', 'knob|CAB', 'knob|PA', 'knob|NAV']] },
    { n: 'ACP 2', x: 0.205, z: -0.05, w: 0.15, h: 0.09, rows: [['knob|VHF1', 'knob|VHF2', 'knob|VHF3', 'knob|HF1', 'knob|HF2', 'knob|INT'], ['pb|VOICE|/', 'pb|RESET|/', 'knob|CAB', 'knob|PA', 'knob|NAV']] },
    { n: 'ENG', x: 0, z: 0.065, w: 0.15, h: 0.11, rows: [
      ['tg|ENG 1|ON,OFF|f=eng-master-1', 'rot|MODE|CRANK,NORM,IGN START|f=eng-mode', 'tg|ENG 2|ON,OFF|f=eng-master-2'], ['lamp|1|FIRE', 'sp', 'lamp|2|FIRE']] },
    { n: 'SURV', x: -0.215, z: 0.11, w: 0.13, h: 0.14, rows: [
      ['pb|XPDR TCAS 1|/', 'pb|XPDR TCAS 2|/', 'pb|ALT RPTG|/OFF'], ['rot|XPDR|STBY,AUTO,ON|f=xpdr', 'rot|TCAS|STBY,TA,TA/RA|f=tcas'],
      ['pb|WXR|/OFF|f=wxr', 'pb|PRED W/S|/OFF', 'pb|TERR|/OFF'], ['pb|GPWS|/OFF', 'pb|G/S MODE|/OFF', 'pb|FLAP MODE|/OFF']] },
    { n: 'LIGHTING', x: 0.215, z: 0.07, w: 0.13, h: 0.06, rows: [['knob|FLOOD', 'knob|CONSOLE', 'knob|INTEG']] },
    { n: 'PRINTER', x: 0.215, z: 0.15, w: 0.13, h: 0.07, rows: [['disp|PAPER', 'pb|FEED|/', 'lamp|FAULT']] },
    { n: 'COCKPIT DOOR', x: 0, z: 0.18, w: 0.17, h: 0.055, rows: [['gtg|DOOR|UNLOCK,NORM,LOCK', 'lamp|OPEN', 'lamp|FAULT']] },
    { n: 'RMP 3', x: -0.15, z: 0.29, w: 0.15, h: 0.11, rows: [['disp|TOUCH SCREEN', 'disp|'], ['knob|VOL', 'pb|MENU|/', 'pb|VHF|/', 'pb|HF|/', 'pb|NAV|/']] },
    { n: 'CKPT CAMERA', x: 0.15, z: 0.29, w: 0.15, h: 0.07, rows: [['pb|CAM|/', 'pb|DOOR VIDEO|/', 'pb|SATCOM|/']] },
    { n: 'PARK BRK', x: -0.15, z: 0.42, w: 0.14, h: 0.08, rows: [['rot|PARK BRK|OFF,ON|f=park-brake']] },
    { n: 'RUD TRIM', x: 0.15, z: 0.42, w: 0.14, h: 0.08, rows: [['disp|L 0.0'], ['rot|RUD TRIM|L,0,R', 'pb|RESET|/']] }
  ] };

  /* ---------------- C919: 空客式布置 (推测), MCDU 键盘 + 中央显示控制; ---------------- */
  var C919 = { pw: 0.27, mcdu: { x: 0.175, w: 0.15 }, trimX: 0.116, levX: 0.13, levZ: 0.07, panels: [
    { n: 'DISPLAY CTL', x: 0, z: -0.31, w: 0.17, h: 0.13, rows: [['knob|UPPER', 'knob|LOWER', 'rot|SRC|L,NORM,R'], ['pb|SYS|/', 'pb|ENG|/', 'pb|ELEC|/', 'pb|HYD|/', 'pb|FUEL|/', 'pb|AIR|/'], ['pb|DOOR|/', 'pb|F/CTL|/', 'pb|STS|/', 'pb|RCL|/', 'pb|CLR|/', 'pb|C/L|/']] },
    { n: 'CCD 1', x: -0.2, z: -0.155, w: 0.13, h: 0.11, rows: [['disp|TOUCHPAD'], ['pb|ENTER|/', 'knob|', 'pb|MENU|/']] },
    { n: 'CCD 2', x: 0.2, z: -0.155, w: 0.13, h: 0.11, rows: [['disp|TOUCHPAD'], ['pb|ENTER|/', 'knob|', 'pb|MENU|/']] },
    ACP('ACP 1', -0.2, -0.05), ACP('ACP 2', 0.2, -0.05),
    { n: 'ENG', x: 0, z: 0.06, w: 0.15, h: 0.11, rows: [
      ['tg|ENG 1|ON,OFF|f=eng-master-1', 'rot|MODE|CRANK,NORM,IGN START|f=eng-mode', 'tg|ENG 2|ON,OFF|f=eng-master-2'], ['lamp|1|FIRE', 'sp', 'lamp|2|FIRE']] },
    { n: 'RADIO', x: -0.21, z: 0.12, w: 0.12, h: 0.12, rows: [['disp|ACTIVE', 'pb|XFR|/', 'disp|STBY'], ['pb|VHF1|/', 'pb|VHF2|/', 'pb|VHF3|/', 'pb|HF|/'], ['knob|', 'pb|NAV|/']] },
    { n: 'XPDR / TCAS / WXR', x: 0.21, z: 0.13, w: 0.12, h: 0.14, rows: [['disp|', 'pb|IDENT|/'], ['kp|CODE|4x2'], ['rot|XPDR|STBY,AUTO,ON|f=xpdr', 'rot|TCAS|STBY,TA,TA/RA|f=tcas'], ['pb|WXR|/ON|f=wxr', 'knob|TILT', 'knob|GAIN']] },
    { n: 'DOOR', x: 0, z: 0.175, w: 0.17, h: 0.055, rows: [['gtg|DOOR|UNLOCK,NORM,LOCK', 'lamp|OPEN', 'lamp|FAULT']] },
    { n: 'LIGHTING', x: -0.15, z: 0.28, w: 0.14, h: 0.07, rows: [['knob|FLOOD', 'knob|PANEL', 'knob|CONSOLE']] },
    { n: 'PRINTER', x: 0.15, z: 0.28, w: 0.14, h: 0.07, rows: [['disp|PAPER', 'pb|FEED|/']] },
    { n: 'PARK BRK', x: -0.15, z: 0.40, w: 0.14, h: 0.08, rows: [['rot|PARK BRK|OFF,ON|f=park-brake']] },
    { n: 'TRIM', x: 0.15, z: 0.40, w: 0.14, h: 0.08, rows: [['disp|RUD 0.0'], ['rot|RUD TRIM|L,0,R', 'tg|AIL TRIM|L,R', 'pb|RESET|/']] }
  ] };

  /* ---------------- 737NG / MAX: CDU 1/2 前部, 扇区后燃油控制电门 + 停留刹车 + 安定面配平切断; 后电子板两列 ---------------- */
  var B737 = { pw: 0.25, mcdu: { x: 0.10, w: 0.15 }, panels: [
    { n: 'PARKING BRAKE', x: -0.175, z: 0.045, w: 0.12, h: 0.08, rows: [['rot|PARKING BRAKE|OFF,SET|f=park-brake', 'lamp|SET']] },
    { n: 'FUEL CONTROL', x: 0, z: 0.045, w: 0.18, h: 0.08, rows: [['tg|ENG 1|RUN,CUTOFF|f=eng-master-1', 'lamp|ENG VALVE|CLOSED', 'lamp|SPAR VALVE|CLOSED', 'tg|ENG 2|RUN,CUTOFF|f=eng-master-2']] },
    { n: 'STAB TRIM', x: 0.175, z: 0.045, w: 0.12, h: 0.08, rows: [['gtg|MAIN ELEC|CUTOUT,NORMAL', 'gtg|AUTO PILOT|CUTOUT,NORMAL']] },
    BCOMM('VHF COMM 1', -0.125, 0.125, 0.24), BCOMM('VHF COMM 2', 0.125, 0.125, 0.24),
    { n: 'VHF NAV 1', x: -0.125, z: 0.195, w: 0.24, h: 0.065, rows: [['disp|ACTIVE', 'pb|TFR|/', 'disp|STANDBY', 'knob|', 'pb|TEST|/']] },
    { n: 'VHF NAV 2', x: 0.125, z: 0.195, w: 0.24, h: 0.065, rows: [['disp|ACTIVE', 'pb|TFR|/', 'disp|STANDBY', 'knob|', 'pb|TEST|/']] },
    BACP('AUDIO CONTROL 1', -0.125, 0.285, 0.24),
    { n: 'ENGINE & APU FIRE', x: 0.125, z: 0.29, w: 0.24, h: 0.11, rows: [['fire|1|ENG', 'fire|APU|', 'fire|2|ENG'], ['tg|OVHT DET A|A,NORMAL,B', 'pb|BELL CUTOUT|/', 'tg|TEST|FAULT/INOP,OVHT/FIRE', 'tg|OVHT DET B|A,NORMAL,B']] },
    { n: 'ADF', x: -0.125, z: 0.37, w: 0.24, h: 0.06, rows: [['disp|ACTIVE', 'pb|TFR|/', 'disp|STANDBY', 'tg|ANT|ANT,ADF', 'tg|TONE|ON,OFF']] },
    { n: 'ATC / TCAS', x: 0.125, z: 0.385, w: 0.24, h: 0.08, rows: [['disp|CODE', 'pb|IDENT|/', 'tg|ALT SOURCE|1,2', 'tg|XPNDR|1,2'], ['knob|CODE', 'rot|MODE|STBY,ALT OFF,XPNDR,TA,TA/RA|f=tcas', 'rot|XPDR|STBY,AUTO,ON|f=xpdr', 'pb|TEST|/']] },
    { n: 'WEATHER RADAR', x: -0.125, z: 0.445, w: 0.24, h: 0.07, rows: [['knob|TILT', 'knob|GAIN', 'rot|MODE|TEST,WX,WX/T,MAP', 'tg|GC|ON,OFF']] },
    { n: 'CARGO FIRE', x: -0.125, z: 0.51, w: 0.24, h: 0.055, rows: [['pbg|FWD|ARMED/', 'pbg|AFT|ARMED/', 'pb|DISCH|/', 'pb|TEST|/']] },
    { n: 'RUDDER / AILERON TRIM', x: 0.125, z: 0.48, w: 0.24, h: 0.09, rows: [['rot|AILERON|L,0,R', 'disp|', 'rot|RUDDER|NOSE L,0,NOSE R'], ['tg|FLT DECK DOOR|UNLKD,AUTO,DENY', 'lamp|LOCK FAIL']] }
  ] };

  /* ---------------- 777: CDU L/R 前部 (原建模), 扇区后燃油控制 + 停留刹车 + 备用俯仰配平; 后部 CCD 区 (原建模) + 中 CDU + 无线电 / 火警 ---------------- */
  var B777 = { pw: 0.29, mcdu: { x: 0.16, w: 0.15 }, panels: [
    { n: 'PARKING BRAKE', x: -0.19, z: 0.045, w: 0.13, h: 0.08, rows: [['rot|PARK BRAKE|OFF,SET|f=park-brake']] },
    { n: 'FUEL CONTROL', x: 0, z: 0.045, w: 0.18, h: 0.08, rows: [['tg|L|RUN,CUTOFF|f=eng-master-1', 'lamp|L|FIRE', 'lamp|R|FIRE', 'tg|R|RUN,CUTOFF|f=eng-master-2']] },
    { n: 'STAB', x: 0.19, z: 0.045, w: 0.13, h: 0.08, rows: [['gtg|STAB C|CUTOUT,NORM', 'gtg|STAB R|CUTOUT,NORM', 'tg|ALTN PITCH TRIM|NOSE DN,NOSE UP']] },
    { n: 'CCD L', x: -0.19, z: 0.155, w: 0.14, h: 0.12, rows: [['disp|TOUCHPAD'], ['pb|SEL|/', 'pb|SEL|/'], ['pb|CDU|/', 'pb|INFO|/', 'pb|L|/', 'pb|C|/', 'pb|R|/']] },
    { n: 'CCD R', x: 0.19, z: 0.155, w: 0.14, h: 0.12, rows: [['disp|TOUCHPAD'], ['pb|SEL|/', 'pb|SEL|/'], ['pb|CDU|/', 'pb|INFO|/', 'pb|L|/', 'pb|C|/', 'pb|R|/']] },
    { n: 'CDU C', x: 0, z: 0.17, w: 0.15, h: 0.15, rows: [['disp|', 'disp|'], ['kp|LSK / FUNCTION|6x3'], ['kp|ALPHA / NUM|10x3']] },
    { n: 'RADIO TUNING L', x: -0.19, z: 0.27, w: 0.14, h: 0.08, rows: [['disp|ACTIVE', 'pb|TFR|/', 'disp|STANDBY'], ['pb|VHF L|/', 'pb|VHF C|/', 'pb|VHF R|/', 'pb|HF L|/', 'pb|HF R|/', 'knob|']] },
    { n: 'RADIO TUNING R', x: 0.19, z: 0.27, w: 0.14, h: 0.08, rows: [['disp|ACTIVE', 'pb|TFR|/', 'disp|STANDBY'], ['pb|VHF L|/', 'pb|VHF C|/', 'pb|VHF R|/', 'pb|HF L|/', 'pb|HF R|/', 'knob|']] },
    { n: 'ENGINE / APU FIRE', x: 0, z: 0.30, w: 0.20, h: 0.10, rows: [['fire|L|ENG', 'fire|APU|', 'fire|R|ENG'], ['pb|FIRE/OVHT TEST|/', 'pb|DISCH|/']] },
    BACP('AUDIO CONTROL L', -0.19, 0.37, 0.14), BACP('AUDIO CONTROL R', 0.19, 0.37, 0.14),
    { n: 'WXR', x: 0, z: 0.40, w: 0.18, h: 0.07, rows: [['knob|TILT', 'knob|GAIN', 'rot|MODE|TEST,WX,WX/T,MAP', 'pb|AUTO|/']] },
    { n: 'TRANSPONDER', x: 0, z: 0.47, w: 0.18, h: 0.07, rows: [['disp|CODE', 'pb|IDENT|/', 'rot|XPDR|STBY,AUTO,ON|f=xpdr', 'rot|MODE|STBY,TA,TA/RA|f=tcas']] },
    { n: 'TRIM / DOOR', x: -0.17, z: 0.47, w: 0.18, h: 0.08, rows: [['rot|RUDDER|L,0,R', 'tg|AILERON|L,R', 'pb|RUD TRIM CANCEL|/'], ['tg|FLT DECK DOOR|UNLKD,AUTO,DENY', 'lamp|LOCK FAIL']] },
    { n: 'EVAC / OBS AUDIO', x: 0.17, z: 0.47, w: 0.18, h: 0.08, rows: [['pbg|EVAC|/ON', 'pb|HORN|/', 'rot|OBS AUDIO|NORM,CAPT,F/O']] }
  ] };

  /* ---------------- 787: MFK 前部 (原建模), 扇区后燃油控制 + 停留刹车; CCD L/R, TCP L/C/R, 火警, 配平 ---------------- */
  var B787 = { pw: 0.30, panels: [
    { n: 'PARKING BRAKE', x: -0.20, z: 0.045, w: 0.13, h: 0.08, rows: [['rot|PARK BRAKE|OFF,SET|f=park-brake']] },
    { n: 'FUEL CONTROL', x: 0, z: 0.045, w: 0.18, h: 0.08, rows: [['tg|L|RUN,CUTOFF|f=eng-master-1', 'lamp|L|FIRE', 'lamp|R|FIRE', 'tg|R|RUN,CUTOFF|f=eng-master-2']] },
    { n: 'STAB / ALTN PITCH', x: 0.20, z: 0.045, w: 0.13, h: 0.08, rows: [['gtg|STAB L|CUTOUT,NORM', 'gtg|STAB R|CUTOUT,NORM', 'tg|ALTN PITCH TRIM|NOSE DN,NOSE UP']] },
    { n: 'CCD L', x: -0.20, z: 0.16, w: 0.15, h: 0.12, rows: [['disp|TOUCHPAD'], ['pb|SEL|/', 'pb|SEL|/'], ['pb|CDU|/', 'pb|INFO|/', 'pb|L|/', 'pb|C|/', 'pb|R|/']] },
    { n: 'CCD R', x: 0.20, z: 0.16, w: 0.15, h: 0.12, rows: [['disp|TOUCHPAD'], ['pb|SEL|/', 'pb|SEL|/'], ['pb|CDU|/', 'pb|INFO|/', 'pb|L|/', 'pb|C|/', 'pb|R|/']] },
    { n: 'TCP C', x: 0, z: 0.17, w: 0.17, h: 0.14, rows: [['disp|TUNING DISPLAY', 'disp|'], ['pb|VHF|/', 'pb|HF|/', 'pb|SAT|/', 'pb|CAB|/', 'pb|XPDR|/'], ['kp|KEYPAD|6x2', 'knob|']] },
    { n: 'TCP L', x: -0.20, z: 0.29, w: 0.15, h: 0.11, rows: [['disp|TUNING DISPLAY', 'disp|'], ['pb|VHF|/', 'pb|HF|/', 'pb|XPDR|/', 'pb|WXR|/', 'pb|TCAS|/'], ['kp|KEYPAD|6x2', 'knob|']] },
    { n: 'TCP R', x: 0.20, z: 0.29, w: 0.15, h: 0.11, rows: [['disp|TUNING DISPLAY', 'disp|'], ['pb|VHF|/', 'pb|HF|/', 'pb|XPDR|/', 'pb|WXR|/', 'pb|TCAS|/'], ['kp|KEYPAD|6x2', 'knob|']] },
    { n: 'ENGINE / APU FIRE', x: 0, z: 0.31, w: 0.20, h: 0.10, rows: [['fire|L|ENG', 'fire|APU|', 'fire|R|ENG'], ['pb|FIRE/OVHT TEST|/', 'pb|DISCH|/']] },
    BACP('AUDIO CONTROL L', -0.20, 0.40, 0.15), BACP('AUDIO CONTROL R', 0.20, 0.40, 0.15),
    { n: 'XPDR / WXR', x: 0, z: 0.42, w: 0.19, h: 0.10, rows: [['rot|XPDR|STBY,AUTO,ON|f=xpdr', 'rot|TCAS|STBY,TA,TA/RA|f=tcas', 'pb|IDENT|/'], ['pb|WXR|/ON|f=wxr', 'knob|TILT', 'knob|GAIN']] },
    { n: 'TRIM', x: -0.17, z: 0.51, w: 0.19, h: 0.07, rows: [['rot|RUDDER|L,0,R', 'tg|AILERON|L,R', 'pb|RUD TRIM CANCEL|/']] },
    { n: 'FLT DECK DOOR / EVAC', x: 0.17, z: 0.51, w: 0.19, h: 0.07, rows: [['tg|FLT DECK DOOR|UNLKD,AUTO,DENY', 'pbg|EVAC|/ON', 'pb|HORN|/']] }
  ] };

  /* ---------------- E190: MCDU 前部 (原建模), 扇区后 (模拟用) 发动机运转电门 + 紧急/停留刹车; 后部 CCD / 配平 / 无线电 ---------------- */
  var E190 = { pw: 0.24, mcdu: { x: 0.11, w: 0.15 }, panels: [
    { n: 'EMER / PARKING BRAKE', x: -0.165, z: 0.045, w: 0.13, h: 0.08, rows: [['rot|PARK BRAKE|OFF,ON|f=park-brake']] },
    { n: 'ENG RUN (SIM)', x: 0, z: 0.045, w: 0.18, h: 0.08, rows: [['tg|ENG 1|RUN,STOP|f=eng-master-1', 'lamp|1|FIRE', 'lamp|2|FIRE', 'tg|ENG 2|RUN,STOP|f=eng-master-2']] },
    { n: 'TRIM', x: 0.165, z: 0.045, w: 0.13, h: 0.08, rows: [['gtg|PITCH TRIM SYS 1|CUTOUT,NORM', 'gtg|PITCH TRIM SYS 2|CUTOUT,NORM']] },
    { n: 'CCD 1', x: -0.12, z: 0.15, w: 0.22, h: 0.11, rows: [['disp|CURSOR', 'pb|ENTER|/'], ['pb|PFD|/', 'pb|MFD|/', 'pb|EICAS|/', 'knob|']] },
    { n: 'CCD 2', x: 0.12, z: 0.15, w: 0.22, h: 0.11, rows: [['disp|CURSOR', 'pb|ENTER|/'], ['pb|PFD|/', 'pb|MFD|/', 'pb|EICAS|/', 'knob|']] },
    { n: 'TRIM', x: -0.12, z: 0.27, w: 0.22, h: 0.09, rows: [['tg|ROLL TRIM|L,R', 'tg|YAW TRIM|L,R', 'gtg|PITCH TRIM BACKUP|UP,DN'], ['pb|ROLL CUTOUT|/', 'pb|YAW CUTOUT|/']] },
    { n: 'XPDR / TCAS / WXR', x: 0.12, z: 0.28, w: 0.22, h: 0.11, rows: [['rot|XPDR|STBY,AUTO,ON|f=xpdr', 'rot|TCAS|STBY,TA,TA/RA|f=tcas', 'pb|IDENT|/'], ['pb|WXR|/ON|f=wxr', 'knob|TILT', 'knob|GAIN']] },
    { n: 'SPEED BRAKE / FLAP NOTE', x: -0.12, z: 0.37, w: 0.22, h: 0.06, rows: [['lamp|SPDBRK', 'lamp|FLAP FAIL', 'pb|GND SPLR|/']] },
    { n: 'EMERGENCY / DOOR', x: 0.12, z: 0.40, w: 0.22, h: 0.08, rows: [['tg|FLT DECK DOOR|UNLK,NORM,LOCK', 'pbg|EVAC|/ON', 'pb|CVR TEST|/']] },
    { n: 'LIGHTS', x: 0, z: 0.48, w: 0.30, h: 0.06, rows: [['knob|FLOOD', 'knob|PEDESTAL', 'knob|STBY']] }
  ] };

  FS.PEDESTAL_LAYOUTS = { a320: A320, a330: A330, a350: A350, c919: C919, b737: B737, b737max: B737, b777: B777, b787: B787, e190: E190 };
})(typeof window !== 'undefined' ? window : globalThis);
