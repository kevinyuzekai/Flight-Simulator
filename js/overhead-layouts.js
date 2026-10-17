/* SkyRoute — 头顶板数据布局 (按机型)
 * 每块面板: { n: 名称, x, z: 面板中心 (m; x 左- 右+, z 前- 后+), w, h, rows: [[控件...], ...] }
 * 行顺序: rows[0] = 面板后缘 (远离风挡) → 最后一行 = 前缘。控件字符串: '类型|标签|附加|选项'
 *   pb   空客式带字按钮 (附加 = 上/下 灯字, 如 FAULT/OFF)      pbg  带护盖按钮 (选项 red = 红色护盖)
 *   fire 发动机 / APU 灭火手柄按钮 (大号红色, 带护盖)          rot  旋钮选择器 (附加 = 档位, 逗号分隔)
 *   knob 无档位旋钮 (温度 / 亮度)                              tg   拨杆 (附加 = 档位)      gtg 带护盖拨杆
 *   lamp 指示灯                                                disp 小型液晶窗             sp  空位
 *   选项 f=<id> 表示功能控件 (冷舱起动用, 与 systems.js 联动), 其余为外观复制。
 * 参考 (仅作位置参考, 未使用其图像): Wikimedia Commons
 *   "Overhead panel of A320 aircraft at parking stand.jpg" (Olivier Cleynen, CC BY-SA 3.0),
 *   "Overhead panel of an Airbus A320 during cruise.jpg" (Olivier Cleynen, CC BY-SA 3.0), 公开 FCOM 式面板说明。
 */
(function (global) {
  'use strict';
  var FS = global.FS = global.FS || {};

  /* ---------------- A320 系列 (A319 / A320 / A321, ceo / neo) ---------------- */
  var A320 = [
    // ===== 左列 (后 → 前) =====
    { n: 'ADIRS', x: -0.305, z: 0.06, w: 0.19, h: 0.15, rows: [
      ['disp|DATA', 'rot|SYS|OFF,1,2,3', 'disp|'],
      ['pb|IR 1|FAULT/ALIGN', 'pb|IR 3|FAULT/ALIGN', 'pb|IR 2|FAULT/ALIGN', 'lamp|ON BAT|f=adirs-onbat'],
      ['rot|IR 1|OFF,NAV,ATT|f=adirs-ir1', 'rot|IR 3|OFF,NAV,ATT|f=adirs-ir3', 'rot|IR 2|OFF,NAV,ATT|f=adirs-ir2']] },
    { n: 'FLT CTL', x: -0.305, z: -0.06, w: 0.19, h: 0.065, rows: [['pb|ELAC 1|FAULT/OFF', 'pb|SEC 1|FAULT/OFF', 'pb|FAC 1|FAULT/OFF']] },
    { n: 'EVAC', x: -0.305, z: -0.135, w: 0.19, h: 0.065, rows: [['pb|COMMAND|EVAC/ON', 'pb|HORN SHUT OFF|/', 'rot|CAPT & PURS|CAPT,CAPT&PURS']] },
    { n: 'EMER ELEC PWR', x: -0.305, z: -0.215, w: 0.19, h: 0.075, rows: [['pbg|MAN ON|FAULT/|red', 'pb|GEN 1 LINE|SMOKE/OFF', 'pb|EMER GEN TEST|/']] },
    { n: 'GPWS', x: -0.305, z: -0.295, w: 0.19, h: 0.065, rows: [['pb|TERR|FAULT/OFF', 'pb|SYS|FAULT/OFF', 'pb|G/S MODE|/OFF', 'pb|FLAP MODE|/OFF', 'pb|LDG FLAP 3|/ON']] },
    { n: 'RCDR', x: -0.305, z: -0.365, w: 0.19, h: 0.06, rows: [['pb|GND CTL|/ON', 'pb|CVR ERASE|/', 'pb|CVR TEST|/']] },
    { n: 'OXYGEN', x: -0.305, z: -0.435, w: 0.19, h: 0.065, rows: [['pbg|MASK MAN ON|/|red', 'pb|PASSENGER|SYS ON/', 'pb|CREW SUPPLY|/OFF']] },
    { n: 'CALLS', x: -0.305, z: -0.505, w: 0.19, h: 0.06, rows: [['pb|MECH|/', 'pb|FWD|/', 'pb|AFT|/', 'pbg|EMER|CALL/ON']] },
    { n: 'WIPER', x: -0.305, z: -0.62, w: 0.19, h: 0.13, rows: [['rot|WIPER|OFF,SLOW,FAST', 'pb|RAIN RPLNT|/']] },
    // ===== 中列 (后 → 前) =====
    { n: 'FIRE', x: 0, z: 0.06, w: 0.42, h: 0.15, rows: [
      ['fire|ENG 1|FIRE', 'fire|APU|FIRE', 'fire|ENG 2|FIRE'],
      ['pb|AGENT 1|SQUIB/DISCH', 'pb|AGENT 2|SQUIB/DISCH', 'pb|TEST|/', 'pb|AGENT|SQUIB/DISCH', 'pb|TEST|/', 'pb|AGENT 1|SQUIB/DISCH', 'pb|AGENT 2|SQUIB/DISCH']] },
    { n: 'HYD', x: 0, z: -0.06, w: 0.42, h: 0.08, rows: [['pb|ENG 1 PUMP|FAULT/OFF|f=hyd-eng1', 'pbg|RAT MAN ON|/|red', 'pb|ELEC PUMP|FAULT/OFF|f=hyd-elec', 'pb|PTU|FAULT/OFF|f=hyd-ptu', 'pb|ELEC PUMP|FAULT/ON', 'pb|ENG 2 PUMP|FAULT/OFF|f=hyd-eng2']] },
    { n: 'FUEL', x: 0, z: -0.15, w: 0.42, h: 0.09, rows: [['pb|L TK PUMP 1|FAULT/OFF|f=fuel-l1', 'pb|L TK PUMP 2|FAULT/OFF|f=fuel-l2', 'pb|MODE SEL|FAULT/MAN', 'pb|CTR TK 1|FAULT/OFF|f=fuel-c1', 'pb|X FEED|OPEN/ON', 'pb|CTR TK 2|FAULT/OFF|f=fuel-c2', 'pb|R TK PUMP 1|FAULT/OFF|f=fuel-r1', 'pb|R TK PUMP 2|FAULT/OFF|f=fuel-r2']] },
    { n: 'ELEC', x: 0, z: -0.28, w: 0.42, h: 0.16, rows: [
      ['disp|BAT 1', 'pb|BAT 1|FAULT/OFF|f=elec-bat1', 'pb|BAT 2|FAULT/OFF|f=elec-bat2', 'disp|BAT 2', 'pb|AC ESS FEED|FAULT/ALTN', 'pb|GALLEY|FAULT/OFF'],
      ['pbg|IDG 1|FAULT/', 'pb|GEN 1|FAULT/OFF', 'pb|APU GEN|FAULT/OFF', 'pb|EXT PWR|AVAIL/ON|f=elec-ext', 'pb|BUS TIE|/OFF', 'pb|GEN 2|FAULT/OFF', 'pbg|IDG 2|FAULT/']] },
    { n: 'AIR COND', x: 0, z: -0.44, w: 0.42, h: 0.16, rows: [
      ['rot|PACK FLOW|LO,NORM,HI', 'knob|COCKPIT', 'knob|FWD CABIN', 'knob|AFT CABIN', 'pb|HOT AIR|FAULT/OFF'],
      ['pb|PACK 1|FAULT/OFF|f=pack1', 'pb|ENG 1 BLEED|FAULT/OFF|f=bleed-eng1', 'pbg|RAM AIR|/ON', 'pb|APU BLEED|FAULT/ON|f=apu-bleed', 'rot|X BLEED|SHUT,AUTO,OPEN|f=xbleed', 'pb|ENG 2 BLEED|FAULT/OFF|f=bleed-eng2', 'pb|PACK 2|FAULT/OFF|f=pack2']] },
    { n: 'ANTI ICE', x: -0.105, z: -0.585, w: 0.21, h: 0.09, rows: [['pb|WING|FAULT/ON|f=ai-wing', 'pb|ENG 1|FAULT/ON|f=ai-eng1', 'pb|ENG 2|FAULT/ON|f=ai-eng2', 'pb|PROBE/WINDOW HEAT|/ON|f=probe-heat']] },
    { n: 'CABIN PRESS', x: 0.105, z: -0.585, w: 0.21, h: 0.09, rows: [['tg|MAN V/S CTL|UP,DN', 'pb|MODE SEL|FAULT/MAN', 'rot|LDG ELEV|AUTO,-2,0,2,4,6', 'pbg|DITCHING|/ON|red']] },
    { n: 'EXT LT', x: -0.075, z: -0.69, w: 0.27, h: 0.10, rows: [['tg|STROBE|ON,AUTO,OFF|f=light-strobe', 'tg|BEACON|ON,OFF|f=light-beacon', 'tg|WING|ON,OFF|f=light-wing', 'tg|NAV & LOGO|1,OFF,2|f=light-nav|f2=light-logo', 'tg|RWY TURN OFF|ON,OFF|f=light-rwyTurnoff', 'tg|LAND L|ON,OFF,RETR|f=light-landing', 'tg|LAND R|ON,OFF,RETR', 'tg|NOSE|T.O,TAXI,OFF|f=light-taxi']] },
    { n: 'APU', x: 0.09, z: -0.69, w: 0.06, h: 0.10, rows: [['pb|MASTER SW|FAULT/ON|f=apu'], ['pb|START|AVAIL/ON|f=apu-start']] },
    { n: 'SIGNS', x: 0.165, z: -0.69, w: 0.09, h: 0.10, rows: [['tg|SEAT BELTS|ON,OFF|f=sign-seatbelts', 'tg|NO SMOKING|ON,AUTO,OFF'], ['tg|EMER EXIT LT|ON,ARM,OFF', 'tg|DOME|BRT,DIM,OFF|f=light-cabin']] },
    // ===== 右列 (后 → 前) =====
    { n: 'FLT CTL', x: 0.305, z: 0.04, w: 0.19, h: 0.065, rows: [['pb|ELAC 2|FAULT/OFF', 'pb|SEC 2|FAULT/OFF', 'pb|SEC 3|FAULT/OFF', 'pb|FAC 2|FAULT/OFF']] },
    { n: 'CARGO SMOKE', x: 0.305, z: -0.05, w: 0.19, h: 0.08, rows: [['pbg|FWD DISCH|/|red', 'pb|TEST|/', 'pbg|AFT DISCH|/|red']] },
    { n: 'CARGO HEAT', x: 0.305, z: -0.14, w: 0.19, h: 0.07, rows: [['knob|AFT', 'pb|HOT AIR|FAULT/OFF', 'pb|AFT ISOL|FAULT/OFF']] },
    { n: 'VENTILATION', x: 0.305, z: -0.225, w: 0.19, h: 0.07, rows: [['pb|BLOWER|FAULT/OVRD', 'pb|EXTRACT|FAULT/OVRD', 'pb|CAB FANS|/OFF']] },
    { n: 'ENG', x: 0.305, z: -0.31, w: 0.19, h: 0.07, rows: [['pb|N1 MODE 1|FAULT/ON', 'pb|MAN START 1|/ON', 'pb|MAN START 2|/ON', 'pb|N1 MODE 2|FAULT/ON']] },
    { n: 'INT LT', x: 0.305, z: -0.42, w: 0.19, h: 0.11, rows: [['knob|OVHD INTEG LT', 'tg|ICE IND & STBY COMPASS|ON,OFF', 'tg|ANN LT|TEST,BRT,DIM']] },
    { n: 'WIPER', x: 0.305, z: -0.62, w: 0.19, h: 0.13, rows: [['pb|RAIN RPLNT|/', 'rot|WIPER|OFF,SLOW,FAST']] }
  ];

  /* ---------------- A330 (A330-200/300): A320 式三列, 但 3 套液压 / PRIM+SEC / 双外接电源 / APU BAT / 配平油箱 ---------------- */
  var A330 = [
    { n: 'ADIRS', x: -0.305, z: 0.06, w: 0.19, h: 0.15, rows: [
      ['disp|DATA', 'rot|SYS|OFF,1,2,3', 'disp|'],
      ['pb|IR 1|FAULT/ALIGN', 'pb|IR 3|FAULT/ALIGN', 'pb|IR 2|FAULT/ALIGN', 'lamp|ON BAT|f=adirs-onbat'],
      ['rot|IR 1|OFF,NAV,ATT|f=adirs-ir1', 'rot|IR 3|OFF,NAV,ATT|f=adirs-ir3', 'rot|IR 2|OFF,NAV,ATT|f=adirs-ir2']] },
    { n: 'FLT CTL', x: -0.305, z: -0.06, w: 0.19, h: 0.065, rows: [['pb|PRIM 1|FAULT/OFF', 'pb|SEC 1|FAULT/OFF']] },
    { n: 'EVAC', x: -0.305, z: -0.135, w: 0.19, h: 0.065, rows: [['pb|COMMAND|EVAC/ON', 'pb|HORN SHUT OFF|/', 'rot|CAPT & PURS|CAPT,CAPT&PURS']] },
    { n: 'EMER ELEC PWR', x: -0.305, z: -0.215, w: 0.19, h: 0.075, rows: [['pbg|RAT & EMER GEN|FAULT/MAN ON|red', 'pb|EMER GEN TEST|/', 'pb|GEN 1 LINE|SMOKE/OFF']] },
    { n: 'GPWS', x: -0.305, z: -0.295, w: 0.19, h: 0.065, rows: [['pb|TERR|FAULT/OFF', 'pb|SYS|FAULT/OFF', 'pb|G/S MODE|/OFF', 'pb|FLAP MODE|/OFF', 'pb|LDG FLAP 3|/ON']] },
    { n: 'RCDR', x: -0.305, z: -0.365, w: 0.19, h: 0.06, rows: [['pb|GND CTL|/ON', 'pb|CVR ERASE|/', 'pb|CVR TEST|/']] },
    { n: 'OXYGEN', x: -0.305, z: -0.435, w: 0.19, h: 0.065, rows: [['pbg|MASK MAN ON|/|red', 'pb|PASSENGER|SYS ON/', 'pb|CREW SUPPLY|/OFF']] },
    { n: 'CALLS', x: -0.305, z: -0.505, w: 0.19, h: 0.06, rows: [['pb|MECH|/', 'pb|FWD|/', 'pb|MID|/', 'pb|AFT|/', 'pbg|EMER|CALL/ON']] },
    { n: 'WIPER', x: -0.305, z: -0.62, w: 0.19, h: 0.13, rows: [['rot|WIPER|OFF,SLOW,FAST', 'pb|RAIN RPLNT|/']] },
    { n: 'FIRE', x: 0, z: 0.06, w: 0.42, h: 0.15, rows: [
      ['fire|ENG 1|FIRE', 'fire|APU|FIRE', 'fire|ENG 2|FIRE'],
      ['pb|AGENT 1|SQUIB/DISCH', 'pb|AGENT 2|SQUIB/DISCH', 'pb|TEST|/', 'pb|AGENT|SQUIB/DISCH', 'pb|TEST|/', 'pb|AGENT 1|SQUIB/DISCH', 'pb|AGENT 2|SQUIB/DISCH']] },
    { n: 'HYD', x: 0, z: -0.065, w: 0.42, h: 0.09, rows: [
      ['pbg|RAT MAN ON|/|red', 'pb|G ELEC PUMP|FAULT/ON|f=hyd-elec', 'pb|B ELEC PUMP|FAULT/ON', 'pb|Y ELEC PUMP|FAULT/ON', 'pb|BLUE PTU|FAULT/OFF|f=hyd-ptu'],
      ['pb|ENG 1 G PUMP|FAULT/OFF|f=hyd-eng1', 'pb|ENG 1 B PUMP|FAULT/OFF', 'pb|ENG 2 Y PUMP|FAULT/OFF', 'pb|ENG 2 G PUMP|FAULT/OFF|f=hyd-eng2']] },
    { n: 'FUEL', x: 0, z: -0.17, w: 0.42, h: 0.11, rows: [
      ['pb|CTR TK L|FAULT/OFF|f=fuel-c1', 'pb|CTR TK XFR|/MAN', 'pb|X FEED|OPEN/ON', 'pb|CTR TK R|FAULT/OFF|f=fuel-c2', 'pb|T TANK MODE|FAULT/FWD', 'pb|TRIM TK ISOL|FAULT/OFF'],
      ['pb|L1|FAULT/OFF|f=fuel-l1', 'pb|L2|FAULT/OFF|f=fuel-l2', 'pb|L STBY|FAULT/OFF', 'pb|OUTR TK XFR|/ON', 'pb|R STBY|FAULT/OFF', 'pb|R1|FAULT/OFF|f=fuel-r1', 'pb|R2|FAULT/OFF|f=fuel-r2']] },
    { n: 'ELEC', x: 0, z: -0.305, w: 0.42, h: 0.15, rows: [
      ['pb|BAT 1|FAULT/OFF|f=elec-bat1', 'disp|BAT', 'pb|BAT 2|FAULT/OFF|f=elec-bat2', 'pb|APU BAT|FAULT/OFF', 'pb|AC ESS FEED|FAULT/ALTN', 'pb|GALLEY|FAULT/OFF', 'pb|COMMERCIAL|/OFF'],
      ['pbg|IDG 1|FAULT/', 'pb|GEN 1|FAULT/OFF', 'pb|APU GEN|FAULT/OFF', 'pb|EXT A|AVAIL/ON|f=elec-ext', 'pb|BUS TIE|/OFF', 'pb|EXT B|AVAIL/ON', 'pb|GEN 2|FAULT/OFF', 'pbg|IDG 2|FAULT/']] },
    { n: 'AIR COND', x: 0, z: -0.455, w: 0.42, h: 0.15, rows: [
      ['knob|COCKPIT', 'knob|FWD CAB', 'knob|AFT CAB', 'pb|HOT AIR 1|FAULT/OFF', 'pb|HOT AIR 2|FAULT/OFF', 'rot|PACK FLOW|LO,NORM,HI'],
      ['pb|PACK 1|FAULT/OFF|f=pack1', 'pb|ENG 1 BLEED|FAULT/OFF|f=bleed-eng1', 'pbg|RAM AIR|/ON', 'pb|APU BLEED|FAULT/ON|f=apu-bleed', 'rot|X BLEED|SHUT,AUTO,OPEN|f=xbleed', 'pb|ENG 2 BLEED|FAULT/OFF|f=bleed-eng2', 'pb|PACK 2|FAULT/OFF|f=pack2']] },
    { n: 'ANTI ICE', x: -0.105, z: -0.585, w: 0.21, h: 0.09, rows: [['pb|WING|FAULT/ON|f=ai-wing', 'pb|ENG 1|FAULT/ON|f=ai-eng1', 'pb|ENG 2|FAULT/ON|f=ai-eng2', 'pb|PROBE/WINDOW HEAT|/ON|f=probe-heat']] },
    { n: 'CABIN PRESS', x: 0.105, z: -0.585, w: 0.21, h: 0.09, rows: [['tg|MAN V/S CTL|UP,DN', 'pb|MODE SEL|FAULT/MAN', 'rot|LDG ELEV|AUTO,-2,0,2,4,6', 'pbg|DITCHING|/ON|red']] },
    { n: 'EXT LT', x: -0.075, z: -0.69, w: 0.27, h: 0.10, rows: [['tg|STROBE|ON,AUTO,OFF|f=light-strobe', 'tg|BEACON|ON,OFF|f=light-beacon', 'tg|WING|ON,OFF|f=light-wing', 'tg|NAV & LOGO|1,OFF,2|f=light-nav|f2=light-logo', 'tg|RWY TURN OFF|ON,OFF|f=light-rwyTurnoff', 'tg|LAND L|ON,OFF,RETR|f=light-landing', 'tg|LAND R|ON,OFF,RETR', 'tg|NOSE|T.O,TAXI,OFF|f=light-taxi']] },
    { n: 'APU', x: 0.09, z: -0.69, w: 0.06, h: 0.10, rows: [['pb|MASTER SW|FAULT/ON|f=apu'], ['pb|START|AVAIL/ON|f=apu-start']] },
    { n: 'SIGNS', x: 0.165, z: -0.69, w: 0.09, h: 0.10, rows: [['tg|SEAT BELTS|ON,OFF|f=sign-seatbelts', 'tg|NO SMOKING|ON,AUTO,OFF'], ['tg|EMER EXIT LT|ON,ARM,OFF', 'tg|DOME|BRT,DIM,OFF|f=light-cabin']] },
    { n: 'FLT CTL', x: 0.305, z: 0.04, w: 0.19, h: 0.065, rows: [['pb|PRIM 2|FAULT/OFF', 'pb|PRIM 3|FAULT/OFF', 'pb|SEC 2|FAULT/OFF']] },
    { n: 'CARGO SMOKE', x: 0.305, z: -0.05, w: 0.19, h: 0.08, rows: [['pbg|FWD DISCH|/|red', 'pb|TEST|/', 'pbg|AFT DISCH|/|red']] },
    { n: 'CARGO AIR COND', x: 0.305, z: -0.14, w: 0.19, h: 0.07, rows: [['pb|FWD ISOL|FAULT/OFF', 'knob|BULK', 'pb|BULK ISOL|FAULT/OFF', 'pb|HOT AIR|FAULT/OFF']] },
    { n: 'VENTILATION', x: 0.305, z: -0.225, w: 0.19, h: 0.07, rows: [['pb|AVNCS EXTRACT|FAULT/OVRD', 'pb|CAB FANS|/OFF', 'pb|BLOWER|FAULT/OVRD']] },
    { n: 'ENG', x: 0.305, z: -0.31, w: 0.19, h: 0.07, rows: [['pb|FADEC GND PWR 1|/ON', 'pb|MAN START 1|/ON', 'pb|MAN START 2|/ON', 'pb|FADEC GND PWR 2|/ON']] },
    { n: 'INT LT', x: 0.305, z: -0.42, w: 0.19, h: 0.11, rows: [['knob|OVHD INTEG LT', 'tg|ICE IND & STBY COMPASS|ON,OFF', 'tg|ANN LT|TEST,BRT,DIM']] },
    { n: 'WIPER', x: 0.305, z: -0.62, w: 0.19, h: 0.13, rows: [['pb|RAIN RPLNT|/', 'rot|WIPER|OFF,SLOW,FAST']] }
  ];

  /* ---------------- A350 (XWB): 深色头顶板, 全部按钮式 (除 ADIRS / 温度 / 雨刷旋钮); 电源 4 台发电机 + EMER BAT ---------------- */
  var A350 = [
    { n: 'ADIRS', x: -0.305, z: 0.07, w: 0.19, h: 0.12, rows: [
      ['pb|IR 1|FAULT/OFF', 'pb|IR 3|FAULT/OFF', 'pb|IR 2|FAULT/OFF', 'lamp|ON BAT|f=adirs-onbat'],
      ['rot|ADIRU 1|OFF,NAV,ATT|f=adirs-ir1', 'rot|ADIRU 3|OFF,NAV,ATT|f=adirs-ir3', 'rot|ADIRU 2|OFF,NAV,ATT|f=adirs-ir2']] },
    { n: 'FLT CTL', x: -0.305, z: -0.035, w: 0.19, h: 0.065, rows: [['pb|PRIM 1|FAULT/OFF', 'pb|SEC 1|FAULT/OFF', 'pb|PRIM 3|FAULT/OFF']] },
    { n: 'EVAC', x: -0.305, z: -0.11, w: 0.19, h: 0.065, rows: [['pb|COMMAND|EVAC/ON', 'pb|HORN SHUT OFF|/', 'rot|CAPT & PURS|CAPT,CAPT&PURS']] },
    { n: 'EMER ELEC', x: -0.305, z: -0.19, w: 0.19, h: 0.075, rows: [['pbg|RAT MAN ON|FAULT/|red', 'pb|EMER GEN TEST|/', 'pbg|ELEC ISOL|FAULT/OFF']] },
    { n: 'SURV', x: -0.305, z: -0.27, w: 0.19, h: 0.065, rows: [['pb|TERR SYS|FAULT/OFF', 'pb|GPWS|FAULT/OFF', 'pb|G/S MODE|/OFF', 'pb|FLAP MODE|/OFF']] },
    { n: 'RCDR', x: -0.305, z: -0.34, w: 0.19, h: 0.06, rows: [['pb|GND CTL|/ON', 'pb|CVR ERASE|/', 'pb|CVR TEST|/']] },
    { n: 'OXYGEN', x: -0.305, z: -0.41, w: 0.19, h: 0.065, rows: [['pbg|MASK MAN ON|/|red', 'pb|PAX OXY|SYS ON/', 'pb|CREW SUPPLY|/OFF']] },
    { n: 'CALLS', x: -0.305, z: -0.48, w: 0.19, h: 0.06, rows: [['pb|MECH|/', 'pb|ALL|/', 'pb|FWD|/', 'pb|AFT|/', 'pbg|EMER|CALL/ON']] },
    { n: 'WIPER', x: -0.305, z: -0.61, w: 0.19, h: 0.14, rows: [['rot|WIPER|OFF,INT,SLOW,FAST', 'pb|WASHER|/']] },
    { n: 'FIRE', x: 0, z: 0.065, w: 0.42, h: 0.13, rows: [
      ['fire|ENG 1|FIRE', 'fire|APU|FIRE', 'fire|ENG 2|FIRE'],
      ['pb|AGENT 1|DISCH/', 'pb|AGENT 2|DISCH/', 'pb|TEST|/', 'pb|AGENT|DISCH/', 'pb|AGENT 1|DISCH/', 'pb|AGENT 2|DISCH/']] },
    { n: 'HYD', x: 0, z: -0.05, w: 0.42, h: 0.085, rows: [
      ['pb|ENG 1 PUMP A|FAULT/OFF|f=hyd-eng1', 'pb|ENG 1 PUMP B|FAULT/OFF', 'pb|G ELEC PUMP|FAULT/ON|f=hyd-elec', 'pb|Y ELEC PUMP|FAULT/ON|f=hyd-ptu', 'pb|ENG 2 PUMP A|FAULT/OFF|f=hyd-eng2', 'pb|ENG 2 PUMP B|FAULT/OFF']] },
    { n: 'FUEL', x: 0, z: -0.15, w: 0.42, h: 0.10, rows: [
      ['pb|CTR TK L|FAULT/OFF|f=fuel-c1', 'pb|X FEED|OPEN/ON', 'pb|CTR TK R|FAULT/OFF|f=fuel-c2', 'pb|REFUEL|/', 'pb|JETTISON|/ARM'],
      ['pb|L MAIN|FAULT/OFF|f=fuel-l1', 'pb|L STBY|FAULT/OFF|f=fuel-l2', 'pb|R STBY|FAULT/OFF|f=fuel-r2', 'pb|R MAIN|FAULT/OFF|f=fuel-r1']] },
    { n: 'ELEC', x: 0, z: -0.29, w: 0.42, h: 0.16, rows: [
      ['pb|BAT 1|FAULT/OFF|f=elec-bat1', 'pb|EMER BAT 1|FAULT/OFF', 'pb|APU BAT|FAULT/OFF', 'pb|EMER BAT 2|FAULT/OFF', 'pb|BAT 2|FAULT/OFF|f=elec-bat2', 'pb|AC ESS FEED|FAULT/ALTN'],
      ['pb|GEN 1A|FAULT/OFF', 'pb|GEN 1B|FAULT/OFF', 'pb|EXT 1|AVAIL/ON|f=elec-ext', 'pb|APU GEN|FAULT/OFF', 'pb|EXT 2|AVAIL/ON', 'pb|GEN 2A|FAULT/OFF', 'pb|GEN 2B|FAULT/OFF'],
      ['pbg|ENG 1 DISC|FAULT/', 'pb|BUS TIE|/OFF', 'pb|GALLEY|FAULT/OFF', 'pb|COMMERCIAL|/OFF', 'pbg|ENG 2 DISC|FAULT/']] },
    { n: 'AIR', x: 0, z: -0.445, w: 0.42, h: 0.14, rows: [
      ['knob|CKPT', 'knob|CABIN', 'pb|HOT AIR 1|FAULT/OFF', 'pb|HOT AIR 2|FAULT/OFF', 'pbg|RAM AIR|/ON', 'rot|FLOW|LO,NORM,HI'],
      ['pb|PACK 1|FAULT/OFF|f=pack1', 'pb|ENG 1 BLEED|FAULT/OFF|f=bleed-eng1', 'pb|APU BLEED|FAULT/ON|f=apu-bleed', 'pb|X BLEED|/OPEN|f=xbleed', 'pb|ENG 2 BLEED|FAULT/OFF|f=bleed-eng2', 'pb|PACK 2|FAULT/OFF|f=pack2']] },
    { n: 'ANTI ICE', x: -0.105, z: -0.575, w: 0.21, h: 0.09, rows: [['pb|WING|FAULT/ON|f=ai-wing', 'pb|ENG 1|FAULT/ON|f=ai-eng1', 'pb|ENG 2|FAULT/ON|f=ai-eng2', 'pb|PROBE & WINDOW HEAT|/ON|f=probe-heat']] },
    { n: 'CABIN PRESS', x: 0.105, z: -0.575, w: 0.21, h: 0.09, rows: [['pb|MODE SEL|FAULT/MAN', 'tg|MAN V/S|UP,DN', 'pb|LDG ELEV|/MAN', 'pbg|DITCHING|/ON|red']] },
    { n: 'EXT LT', x: -0.075, z: -0.69, w: 0.27, h: 0.10, rows: [['tg|STROBE|ON,AUTO,OFF|f=light-strobe', 'tg|BEACON|ON,OFF|f=light-beacon', 'tg|WING|ON,OFF|f=light-wing', 'tg|NAV & LOGO|ON,OFF|f=light-nav|f2=light-logo', 'tg|RWY TURN OFF|ON,OFF|f=light-rwyTurnoff', 'tg|LAND|ON,OFF|f=light-landing', 'tg|TAXI|T.O,TAXI,OFF|f=light-taxi']] },
    { n: 'APU', x: 0.09, z: -0.69, w: 0.06, h: 0.10, rows: [['pb|MASTER SW|FAULT/ON|f=apu'], ['pb|START|AVAIL/ON|f=apu-start']] },
    { n: 'SIGNS', x: 0.165, z: -0.69, w: 0.09, h: 0.10, rows: [['tg|SEAT BELTS|ON,AUTO,OFF|f=sign-seatbelts', 'tg|NO MOBILE|ON,AUTO,OFF'], ['tg|EMER EXIT LT|ON,ARM,OFF', 'tg|DOME|BRT,DIM,OFF|f=light-cabin']] },
    { n: 'FLT CTL', x: 0.305, z: 0.05, w: 0.19, h: 0.065, rows: [['pb|PRIM 2|FAULT/OFF', 'pb|SEC 2|FAULT/OFF', 'pb|SEC 3|FAULT/OFF']] },
    { n: 'CARGO SMOKE', x: 0.305, z: -0.035, w: 0.19, h: 0.08, rows: [['pbg|FWD DISCH|/|red', 'pb|TEST|/', 'pbg|AFT DISCH|/|red']] },
    { n: 'CARGO AIR', x: 0.305, z: -0.125, w: 0.19, h: 0.07, rows: [['pb|FWD ISOL|FAULT/OFF', 'knob|BULK', 'pb|BULK ISOL|FAULT/OFF']] },
    { n: 'VENT', x: 0.305, z: -0.21, w: 0.19, h: 0.07, rows: [['pb|AVNCS|FAULT/OVRD', 'pb|CAB FANS|/OFF', 'pb|EXTRACT|FAULT/OVRD']] },
    { n: 'ENG', x: 0.305, z: -0.295, w: 0.19, h: 0.07, rows: [['pb|ENG 1 MAN START|/ON', 'pb|ENG 2 MAN START|/ON', 'pb|FADEC GND PWR|/ON']] },
    { n: 'INT LT', x: 0.305, z: -0.40, w: 0.19, h: 0.11, rows: [['knob|OVHD INTEG', 'knob|FLOOD', 'tg|ANN LT|TEST,BRT,DIM']] },
    { n: 'WIPER', x: 0.305, z: -0.61, w: 0.19, h: 0.14, rows: [['pb|WASHER|/', 'rot|WIPER|OFF,INT,SLOW,FAST']] }
  ];

  /* ---------------- C919: 空客式 "暗驾驶舱" 按钮理念, 但分区/名称为 COMAC 自定 ---------------- */
  var C919 = [
    { n: 'IRS', x: -0.305, z: 0.07, w: 0.19, h: 0.12, rows: [
      ['pb|IRS 1|FAULT/ALIGN', 'pb|IRS 3|FAULT/ALIGN', 'pb|IRS 2|FAULT/ALIGN', 'lamp|ON BAT|f=adirs-onbat'],
      ['rot|IRS 1|OFF,NAV,ATT|f=adirs-ir1', 'rot|IRS 3|OFF,NAV,ATT|f=adirs-ir3', 'rot|IRS 2|OFF,NAV,ATT|f=adirs-ir2']] },
    { n: 'FLT CTRL', x: -0.305, z: -0.035, w: 0.19, h: 0.065, rows: [['pb|FCM 1|FAULT/OFF', 'pb|FCM 2|FAULT/OFF', 'pb|ACE|FAULT/OFF']] },
    { n: 'EMER', x: -0.305, z: -0.115, w: 0.19, h: 0.075, rows: [['pbg|RAT|/DEPLOY|red', 'pb|EVAC|COMMAND/ON', 'pb|HORN|/OFF']] },
    { n: 'TAWS', x: -0.305, z: -0.195, w: 0.19, h: 0.065, rows: [['pb|TERR|FAULT/OFF', 'pb|GS|/INHIB', 'pb|FLAP|/OVRD']] },
    { n: 'RCDR', x: -0.305, z: -0.265, w: 0.19, h: 0.06, rows: [['pb|GND CTL|/ON', 'pb|ERASE|/', 'pb|TEST|/']] },
    { n: 'OXYGEN', x: -0.305, z: -0.34, w: 0.19, h: 0.07, rows: [['pbg|PAX OXY|/ON|red', 'pb|CREW OXY|/OFF']] },
    { n: 'CALLS', x: -0.305, z: -0.415, w: 0.19, h: 0.06, rows: [['pb|GND|/', 'pb|CABIN|/', 'pbg|EMER|CALL/']] },
    { n: 'WIPER', x: -0.305, z: -0.56, w: 0.19, h: 0.16, rows: [['rot|WIPER|OFF,INT,LO,HI', 'pb|WASH|/']] },
    { n: 'FIRE', x: 0, z: 0.065, w: 0.42, h: 0.13, rows: [
      ['fire|ENG 1|FIRE', 'fire|APU|FIRE', 'fire|ENG 2|FIRE'],
      ['pb|BTL 1|DISCH/', 'pb|BTL 2|DISCH/', 'pb|TEST|/', 'pb|APU BTL|DISCH/', 'pb|BTL 1|DISCH/', 'pb|BTL 2|DISCH/']] },
    { n: 'HYD', x: 0, z: -0.05, w: 0.42, h: 0.08, rows: [['pb|EDP 1|FAULT/OFF|f=hyd-eng1', 'pb|EMP 1|FAULT/ON|f=hyd-elec', 'pb|EMP 3A|FAULT/ON|f=hyd-ptu', 'pb|EMP 3B|FAULT/ON', 'pb|EMP 2|FAULT/ON', 'pb|EDP 2|FAULT/OFF|f=hyd-eng2']] },
    { n: 'FUEL', x: 0, z: -0.145, w: 0.42, h: 0.09, rows: [['pb|L PUMP 1|FAULT/OFF|f=fuel-l1', 'pb|L PUMP 2|FAULT/OFF|f=fuel-l2', 'pb|CTR XFR L|FAULT/OFF|f=fuel-c1', 'pb|X FEED|OPEN/ON', 'pb|CTR XFR R|FAULT/OFF|f=fuel-c2', 'pb|R PUMP 1|FAULT/OFF|f=fuel-r1', 'pb|R PUMP 2|FAULT/OFF|f=fuel-r2']] },
    { n: 'ELEC', x: 0, z: -0.28, w: 0.42, h: 0.16, rows: [
      ['pb|BAT 1|FAULT/OFF|f=elec-bat1', 'pb|BAT 2|FAULT/OFF|f=elec-bat2', 'pb|APU BAT|FAULT/OFF', 'pb|AC ESS|FAULT/ALTN', 'pb|GALLEY|FAULT/OFF'],
      ['pbg|IDG 1|FAULT/DISC', 'pb|GEN 1|FAULT/OFF', 'pb|APU GEN|FAULT/OFF', 'pb|EXT PWR|AVAIL/ON|f=elec-ext', 'pb|BUS TIE|/OFF', 'pb|GEN 2|FAULT/OFF', 'pbg|IDG 2|FAULT/DISC']] },
    { n: 'AIR', x: 0, z: -0.435, w: 0.42, h: 0.15, rows: [
      ['knob|FLT DECK', 'knob|FWD CAB', 'knob|AFT CAB', 'pb|TRIM AIR|FAULT/OFF', 'pb|RECIRC|/OFF'],
      ['pb|PACK 1|FAULT/OFF|f=pack1', 'pb|BLEED 1|FAULT/OFF|f=bleed-eng1', 'pb|APU BLEED|FAULT/ON|f=apu-bleed', 'rot|X BLEED|CLOSE,AUTO,OPEN|f=xbleed', 'pb|BLEED 2|FAULT/OFF|f=bleed-eng2', 'pb|PACK 2|FAULT/OFF|f=pack2']] },
    { n: 'ICE PROT', x: -0.105, z: -0.58, w: 0.21, h: 0.09, rows: [['pb|WING|FAULT/ON|f=ai-wing', 'pb|ENG 1|FAULT/ON|f=ai-eng1', 'pb|ENG 2|FAULT/ON|f=ai-eng2', 'pb|PROBE HEAT|/ON|f=probe-heat', 'pb|WSHLD|/OFF']] },
    { n: 'PRESS', x: 0.105, z: -0.58, w: 0.21, h: 0.09, rows: [['pb|MODE|FAULT/MAN', 'tg|MAN RATE|UP,DN', 'pbg|DITCH|/ON|red']] },
    { n: 'EXT LT', x: -0.075, z: -0.69, w: 0.27, h: 0.10, rows: [['tg|STROBE|ON,OFF|f=light-strobe', 'tg|BEACON|ON,OFF|f=light-beacon', 'tg|WING|ON,OFF|f=light-wing', 'tg|NAV|ON,OFF|f=light-nav', 'tg|LOGO|ON,OFF|f=light-logo', 'tg|RWY TURNOFF|ON,OFF|f=light-rwyTurnoff', 'tg|LDG|ON,OFF|f=light-landing', 'tg|TAXI|ON,OFF|f=light-taxi']] },
    { n: 'APU', x: 0.09, z: -0.69, w: 0.06, h: 0.10, rows: [['pb|MASTER|FAULT/ON|f=apu'], ['pb|START|AVAIL/ON|f=apu-start']] },
    { n: 'SIGNS', x: 0.165, z: -0.69, w: 0.09, h: 0.10, rows: [['tg|BELTS|ON,AUTO,OFF|f=sign-seatbelts', 'tg|NO SMK|ON,AUTO,OFF'], ['tg|EMER LT|ON,ARM,OFF', 'tg|DOME|BRT,DIM,OFF|f=light-cabin']] },
    { n: 'FLT CTRL', x: 0.305, z: 0.05, w: 0.19, h: 0.065, rows: [['pb|FCM 3|FAULT/OFF', 'pb|PFCS|/DIRECT', 'pb|ALTN FLAP|/ARM']] },
    { n: 'CARGO FIRE', x: 0.305, z: -0.035, w: 0.19, h: 0.08, rows: [['pbg|FWD|/DISCH|red', 'pb|TEST|/', 'pbg|AFT|/DISCH|red']] },
    { n: 'VENT', x: 0.305, z: -0.125, w: 0.19, h: 0.07, rows: [['pb|EE FAN|FAULT/OVRD', 'pb|CARGO HEAT|/OFF', 'pb|LAV FAN|/OFF']] },
    { n: 'ENG', x: 0.305, z: -0.21, w: 0.19, h: 0.07, rows: [['pb|EEC 1|FAULT/OFF', 'pb|IGN|/CONT', 'pb|EEC 2|FAULT/OFF']] },
    { n: 'INT LT', x: 0.305, z: -0.36, w: 0.19, h: 0.12, rows: [['knob|PANEL', 'knob|FLOOD', 'tg|ANN|TEST,BRT,DIM']] },
    { n: 'WIPER', x: 0.305, z: -0.56, w: 0.19, h: 0.16, rows: [['pb|WASH|/', 'rot|WIPER|OFF,INT,LO,HI']] }
  ];

  /* ---------------- 737NG / MAX: 前头顶板 5 列 + 前缘灯光/起动排; 后头顶板 IRS ----------------
   * 参考: "B W Overhead" (737NG, Wikimedia Commons, CC BY-SA 2.0) — 仅作位置参考 */
  var B737 = [
    { n: 'IRS', x: -0.12, z: 0.06, w: 0.30, h: 0.13, rows: [
      ['rot|DSPL SEL|TEST,TK/GS,PPOS,WIND,HDG/STS', 'disp|', 'disp|', 'rot|SYS DSPL|L,R'],
      ['rot|IRS L|OFF,ALIGN,NAV,ATT|f=adirs-ir1', 'lamp|ON DC|f=adirs-onbat', 'rot|IRS R|OFF,ALIGN,NAV,ATT|f=adirs-ir2']] },
    { n: 'PSEU / LIGHTS / ENGINE', x: 0.20, z: 0.06, w: 0.26, h: 0.13, rows: [
      ['lamp|PSEU', 'tg|SERVICE INTPH|ON,OFF', 'tg|DOME WHITE|ON,OFF'], ['tg|EEC L|ON,ALTN', 'tg|EEC R|ON,ALTN', 'tg|LEADING EDGE TEST|ON,OFF']] },
    // 第 1 列
    { n: 'FLIGHT CONTROL', x: -0.33, z: -0.15, w: 0.15, h: 0.17, rows: [
      ['gtg|FLT CONTROL A|STBY RUD,OFF,ON', 'gtg|FLT CONTROL B|STBY RUD,OFF,ON'],
      ['gtg|ALTERNATE FLAPS|ARM,OFF', 'tg|ALT FLAPS|UP,OFF,DOWN'], ['gtg|SPOILER A|ON,OFF', 'gtg|SPOILER B|ON,OFF', 'tg|YAW DAMPER|ON,OFF']] },
    { n: 'NAV / DISPLAYS', x: -0.33, z: -0.275, w: 0.15, h: 0.07, rows: [['tg|VHF NAV|BOTH 1,NORMAL,BOTH 2', 'tg|IRS|BOTH L,NORMAL,BOTH R', 'tg|FMC|BOTH L,NORMAL,BOTH R']] },
    { n: 'FUEL', x: -0.33, z: -0.425, w: 0.15, h: 0.22, rows: [
      ['disp|FUEL TEMP', 'lamp|FILTER BYPASS'], ['rot|CROSSFEED|CLOSED,OPEN'],
      ['tg|CTR L|ON,OFF|f=fuel-c1', 'tg|CTR R|ON,OFF|f=fuel-c2'],
      ['tg|AFT 1|ON,OFF|f=fuel-l1', 'tg|FWD 1|ON,OFF|f=fuel-l2', 'tg|FWD 2|ON,OFF|f=fuel-r2', 'tg|AFT 2|ON,OFF|f=fuel-r1']] },
    // 第 2 列 电源
    { n: 'ELECTRICAL', x: -0.165, z: -0.26, w: 0.17, h: 0.36, rows: [
      ['rot|DC|STBY PWR,BAT BUS,BAT,AUX BAT,TR1,TR2,TR3,TEST', 'disp|', 'rot|AC|STBY PWR,GRD PWR,GEN1,APU GEN,GEN2,INV,TEST'],
      ['gtg|BAT|ON,OFF|f=elec-bat1', 'tg|CAB/UTIL|ON,OFF', 'tg|IFE/PASS SEAT|ON,OFF'],
      ['gtg|DRIVE 1 DISC|DISC,NORM', 'gtg|STANDBY POWER|BAT,OFF,AUTO|f=elec-bat2', 'gtg|DRIVE 2 DISC|DISC,NORM'],
      ['tg|GRD POWER|ON,OFF|f=elec-ext', 'gtg|BUS TRANSFER|OFF,AUTO'],
      ['tg|GEN 1|ON,OFF', 'tg|APU GEN L|ON,OFF', 'tg|APU GEN R|ON,OFF', 'tg|GEN 2|ON,OFF']] },
    // 第 3 列
    { n: 'EQUIP COOLING / EMER LT', x: -0.0, z: -0.13, w: 0.15, h: 0.11, rows: [
      ['tg|SUPPLY|NORM,ALTN', 'tg|EXHAUST|NORM,ALTN'], ['gtg|EMERGENCY EXIT LIGHTS|OFF,ARMED,ON']] },
    { n: 'SIGNS', x: 0, z: -0.235, w: 0.15, h: 0.08, rows: [['tg|NO SMOKING|ON,AUTO,OFF', 'tg|FASTEN BELTS|ON,AUTO,OFF|f=sign-seatbelts']] },
    { n: 'CALL / WIPER', x: 0, z: -0.33, w: 0.15, h: 0.09, rows: [['pb|ATTEND|/', 'pb|GRD CALL|/', 'rot|WIPER L|PARK,INT,LOW,HIGH']] },
    { n: 'HYDRAULIC PUMPS', x: 0, z: -0.445, w: 0.15, h: 0.12, rows: [['tg|ENG 1|ON,OFF|f=hyd-eng1', 'tg|ELEC 2|ON,OFF|f=hyd-ptu', 'tg|ELEC 1|ON,OFF|f=hyd-elec', 'tg|ENG 2|ON,OFF|f=hyd-eng2']] },
    // 第 4 列
    { n: 'WINDOW HEAT / PROBE', x: 0.165, z: -0.17, w: 0.17, h: 0.19, rows: [
      ['tg|L SIDE|ON,OFF', 'tg|L FWD|ON,OFF', 'tg|R FWD|ON,OFF', 'tg|R SIDE|ON,OFF'], ['tg|TEST|OVHT,PWR'],
      ['tg|PROBE HEAT A|ON,OFF|f=probe-heat', 'tg|PROBE HEAT B|ON,OFF']] },
    { n: 'ANTI-ICE', x: 0.165, z: -0.34, w: 0.17, h: 0.10, rows: [['tg|WING|ON,OFF|f=ai-wing', 'tg|ENG 1|ON,OFF|f=ai-eng1', 'tg|ENG 2|ON,OFF|f=ai-eng2']] },
    { n: 'AIR COND', x: 0.165, z: -0.47, w: 0.17, h: 0.13, rows: [['rot|TEMP SOURCE|DUCT,CABIN,PASS', 'knob|CONT CAB', 'knob|FWD CAB', 'knob|AFT CAB']] },
    // 第 5 列
    { n: 'BLEED AIR', x: 0.335, z: -0.25, w: 0.15, h: 0.31, rows: [
      ['disp|DUCT PRESS', 'tg|L RECIRC FAN|AUTO,OFF', 'tg|R RECIRC FAN|AUTO,OFF'],
      ['rot|L PACK|OFF,AUTO,HIGH|f=pack1', 'rot|ISOLATION VALVE|CLOSE,AUTO,OPEN|f=xbleed', 'rot|R PACK|OFF,AUTO,HIGH|f=pack2'],
      ['tg|ENG 1 BLEED|ON,OFF|f=bleed-eng1', 'tg|APU BLEED|ON,OFF|f=apu-bleed', 'tg|ENG 2 BLEED|ON,OFF|f=bleed-eng2'],
      ['pb|TRIP RESET|/']] },
    { n: 'PRESSURIZATION', x: 0.335, z: -0.48, w: 0.15, h: 0.13, rows: [['disp|FLT ALT', 'disp|LAND ALT'], ['rot|MODE|AUTO,ALTN,MAN', 'tg|VALVE|OPEN,CLOSE', 'tg|FLT/GRD|FLT,GRD']] },
    // 前缘
    { n: 'LANDING / APU / START', x: -0.15, z: -0.65, w: 0.40, h: 0.11, rows: [[
      'tg|RETRACT L|EXT,RET', 'tg|RETRACT R|EXT,RET', 'tg|LANDING L|ON,OFF|f=light-landing', 'tg|LANDING R|ON,OFF', 'tg|RWY TURNOFF|ON,OFF|f=light-rwyTurnoff', 'tg|TAXI|ON,OFF|f=light-taxi',
      'rot|APU|OFF,ON,START|f=apu-rot', 'rot|ENGINE 1|GRD,OFF,CONT,FLT|f=eng-start-sel-1', 'tg|IGNITION|IGN L,BOTH,IGN R', 'rot|ENGINE 2|GRD,OFF,CONT,FLT|f=eng-start-sel-2']] },
    { n: 'EXT LIGHTS', x: 0.235, z: -0.65, w: 0.26, h: 0.11, rows: [[
      'tg|LOGO|ON,OFF|f=light-logo', 'tg|POSITION|STEADY,OFF,STROBE&STEADY|f=light-nav', 'tg|STROBE|ON,OFF|f=light-strobe', 'tg|ANTI COLLISION|ON,OFF|f=light-beacon', 'tg|WING|ON,OFF|f=light-wing', 'tg|WHEEL WELL|ON,OFF', 'tg|CABIN|ON,OFF|f=light-cabin']] }
  ];

  /* ---------------- 777: 按钮式 (ON/OFF 字) + 旋钮 (液压需求泵 / 防冰 / APU / 起动) ---------------- */
  var B777 = [
    { n: 'ADIRU / FLT CTL', x: -0.31, z: 0.05, w: 0.17, h: 0.14, rows: [
      ['pb|ADIRU|ON BAT/OFF|f=adirs-pb', 'pb|THRUST ASYM COMP|/OFF'], ['gtg|PRIMARY FLT COMPUTERS|DISC,AUTO', 'pbg|FLT CTL HYD VALVE L|/SHUTOFF', 'pbg|C|/SHUTOFF', 'pbg|R|/SHUTOFF']] },
    { n: 'ELECTRICAL', x: -0.07, z: 0.03, w: 0.30, h: 0.17, rows: [
      ['pb|BATTERY|/OFF|f=elec-bat', 'pb|APU GEN|/OFF', 'pb|EXT PWR SEC|AVAIL/ON', 'pb|EXT PWR PRIM|AVAIL/ON|f=elec-ext', 'pb|IFE/PASS SEATS|/OFF', 'pb|CABIN/UTILITY|/OFF'],
      ['pb|L BUS TIE|ISLN/AUTO', 'pb|R BUS TIE|ISLN/AUTO', 'pb|L GEN CTRL|/OFF', 'pb|R GEN CTRL|/OFF', 'pb|L BACKUP GEN|/OFF', 'pb|R BACKUP GEN|/OFF'],
      ['pbg|L DRIVE DISC|DRIVE/|red', 'pbg|R DRIVE DISC|DRIVE/|red']] },
    { n: 'EQUIP COOLING / WINDOW HEAT', x: 0.24, z: 0.03, w: 0.24, h: 0.17, rows: [
      ['pb|EQUIP COOLING|/OVRD', 'pb|GASPER|/OFF', 'pb|RECIRC UPPER|/OFF', 'pb|RECIRC LOWER|/OFF'],
      ['pb|L SIDE|INOP/OFF', 'pb|L FWD|INOP/OFF', 'pb|R FWD|INOP/OFF', 'pb|R SIDE|INOP/OFF']] },
    { n: 'HYDRAULIC', x: -0.12, z: -0.13, w: 0.36, h: 0.13, rows: [
      ['pb|PRIMARY ENG L|FAULT/OFF|f=hyd-eng1', 'pb|PRIMARY C1 ELEC|FAULT/OFF|f=hyd-elec', 'pb|PRIMARY C2 ELEC|FAULT/OFF|f=hyd-ptu', 'pb|PRIMARY ENG R|FAULT/OFF|f=hyd-eng2', 'pbg|RAM AIR TURBINE|UNLKD/PRESS'],
      ['rot|DEMAND L|OFF,AUTO,ON', 'rot|DEMAND C1|OFF,AUTO,ON', 'rot|DEMAND C2|OFF,AUTO,ON', 'rot|DEMAND R|OFF,AUTO,ON']] },
    { n: 'ANTI-ICE', x: 0.27, z: -0.13, w: 0.20, h: 0.13, rows: [['rot|WING|OFF,AUTO,ON|f=ai-wing', 'rot|ENG L|OFF,AUTO,ON|f=ai-eng1', 'rot|ENG R|OFF,AUTO,ON|f=ai-eng2'], ['pb|PROBE HEAT|/OFF|f=probe-heat']] },
    { n: 'APU / CARGO FIRE', x: -0.31, z: -0.25, w: 0.17, h: 0.10, rows: [['rot|APU|OFF,ON,START|f=apu-rot', 'pbg|CARGO FIRE ARM FWD|/ARMED', 'pbg|AFT|/ARMED', 'pbg|DISCH|/']] },
    { n: 'ENGINE START / FUEL', x: -0.06, z: -0.28, w: 0.36, h: 0.15, rows: [
      ['rot|START L|START,NORM|f=eng-start-sel-1', 'pb|EEC MODE L|ALTN/', 'pb|AUTOSTART|/OFF', 'pb|EEC MODE R|ALTN/', 'rot|START R|START,NORM|f=eng-start-sel-2', 'pb|JETTISON ARM|FAULT/ON'],
      ['pb|FWD L|PRESS/|f=fuel-l2', 'pb|AFT L|PRESS/|f=fuel-l1', 'pb|CTR L|PRESS/|f=fuel-c1', 'pb|X FEED FWD|VALVE/', 'pb|X FEED AFT|VALVE/', 'pb|CTR R|PRESS/|f=fuel-c2', 'pb|FWD R|PRESS/|f=fuel-r2', 'pb|AFT R|PRESS/|f=fuel-r1']] },
    { n: 'AIR COND', x: 0.27, z: -0.31, w: 0.20, h: 0.18, rows: [
      ['knob|FLT DECK', 'knob|CABIN', 'pb|TRIM AIR L|/OFF', 'pb|TRIM AIR R|/OFF'],
      ['pb|L PACK|FAULT/OFF|f=pack1', 'pb|R PACK|FAULT/OFF|f=pack2']] },
    { n: 'BLEED', x: 0.10, z: -0.46, w: 0.40, h: 0.11, rows: [
      ['pb|L ENG BLEED|FAULT/OFF|f=bleed-eng1', 'pb|L ISLN|VALVE/|f=xbleed', 'pb|APU BLEED|FAULT/OFF|f=apu-bleed', 'pb|C ISLN|VALVE/', 'pb|R ISLN|VALVE/', 'pb|R ENG BLEED|FAULT/OFF|f=bleed-eng2']] },
    { n: 'PRESS', x: 0.10, z: -0.565, w: 0.40, h: 0.08, rows: [['pb|OUTFLOW FWD|/MAN', 'tg|FWD|OPEN,CLOSE', 'pb|OUTFLOW AFT|/MAN', 'tg|AFT|OPEN,CLOSE', 'knob|LDG ALT']] },
    { n: 'SIGNS / CALLS', x: -0.30, z: -0.50, w: 0.19, h: 0.14, rows: [['tg|NO SMOKING|ON,AUTO,OFF', 'tg|SEAT BELTS|ON,AUTO,OFF|f=sign-seatbelts'], ['gtg|EMER LIGHTS|OFF,ARMED,ON', 'pb|GND CALL|/', 'pb|CABIN|/']] },
    { n: 'EXTERIOR LIGHTS', x: 0, z: -0.68, w: 0.62, h: 0.09, rows: [[
      'tg|LANDING L|ON,OFF|f=light-landing', 'tg|NOSE|ON,OFF', 'tg|LANDING R|ON,OFF', 'tg|RWY TURNOFF L|ON,OFF|f=light-rwyTurnoff', 'tg|RWY TURNOFF R|ON,OFF', 'tg|TAXI|ON,OFF|f=light-taxi',
      'tg|BEACON|ON,OFF|f=light-beacon', 'tg|NAV|ON,OFF|f=light-nav', 'tg|LOGO|ON,OFF|f=light-logo', 'tg|WING|ON,OFF|f=light-wing', 'tg|STROBE|ON,OFF|f=light-strobe', 'tg|DOME|ON,OFF|f=light-cabin', 'rot|WIPER L|OFF,INT,LOW,HIGH', 'rot|WIPER R|OFF,INT,LOW,HIGH']] }
  ];

  /* ---------------- 787: 几乎全部按钮式; 外部灯 / 雨刷 / APU / 起动为旋钮 ----------------
   * 参考: United 787 驾驶舱照片 (Wikimedia Commons, CC BY 2.0) — 仅作位置参考 */
  var B787 = [
    { n: 'ADIRU / FLT CTL / BACKUP', x: -0.30, z: 0.05, w: 0.20, h: 0.14, rows: [
      ['pb|ADIRU|ON BAT/OFF|f=adirs-pb', 'pb|THRUST ASYM|/OFF', 'pbg|PRIMARY FLT CTL|DISC/|red'],
      ['pb|L HYD VALVE|/SHUTOFF', 'pb|C|/SHUTOFF', 'pb|R|/SHUTOFF', 'pb|ALT PITCH TRIM|/']] },
    { n: 'ELECTRICAL', x: -0.04, z: 0.03, w: 0.32, h: 0.17, rows: [
      ['pb|BATTERY|/OFF|f=elec-bat', 'pb|APU GEN|FAULT/OFF', 'pb|FWD EXT PWR|AVAIL/ON|f=elec-ext', 'pb|AFT EXT PWR 1|AVAIL/ON', 'pb|AFT EXT PWR 2|AVAIL/ON', 'pb|IFE/PASS SEATS|/OFF'],
      ['pb|L1 GEN|FAULT/OFF', 'pb|L2 GEN|FAULT/OFF', 'pb|L BUS TIE|ISLN/', 'pb|R BUS TIE|ISLN/', 'pb|R1 GEN|FAULT/OFF', 'pb|R2 GEN|FAULT/OFF'],
      ['pbg|L1 DRIVE|DISC/|red', 'pbg|L2 DRIVE|DISC/|red', 'pb|CABIN/UTILITY|/OFF', 'pbg|R1 DRIVE|DISC/|red', 'pbg|R2 DRIVE|DISC/|red']] },
    { n: 'WINDOW HEAT / EQUIP COOLING', x: 0.255, z: 0.03, w: 0.21, h: 0.17, rows: [
      ['pb|L SIDE|INOP/OFF', 'pb|L FWD|INOP/OFF', 'pb|R FWD|INOP/OFF', 'pb|R SIDE|INOP/OFF'], ['pb|EQUIP COOLING|/OVRD', 'pb|RECIRC UPPER|/OFF', 'pb|RECIRC LOWER|/OFF']] },
    { n: 'HYDRAULIC', x: -0.10, z: -0.135, w: 0.40, h: 0.13, rows: [
      ['pb|PRIMARY L ENG|FAULT/OFF|f=hyd-eng1', 'pb|C1 ELEC|FAULT/OFF|f=hyd-elec', 'pb|C2 ELEC|FAULT/OFF|f=hyd-ptu', 'pb|PRIMARY R ENG|FAULT/OFF|f=hyd-eng2', 'pbg|RAM AIR TURBINE|UNLKD/PRESS'],
      ['pb|DEMAND L|FAULT/AUTO', 'pb|DEMAND C1|FAULT/AUTO', 'pb|DEMAND C2|FAULT/AUTO', 'pb|DEMAND R|FAULT/AUTO']] },
    { n: 'ANTI-ICE / PROBE', x: 0.29, z: -0.135, w: 0.16, h: 0.13, rows: [['pb|WING|/ON|f=ai-wing', 'pb|ENG L|/ON|f=ai-eng1', 'pb|ENG R|/ON|f=ai-eng2'], ['pb|PROBE HEAT|/OFF|f=probe-heat']] },
    { n: 'APU / CARGO FIRE', x: -0.30, z: -0.27, w: 0.20, h: 0.11, rows: [['rot|APU|OFF,ON,START|f=apu-rot', 'pbg|CARGO FIRE FWD|/ARMED', 'pbg|AFT|/ARMED', 'pbg|DISCH|/']] },
    { n: 'ENGINE / FUEL', x: -0.04, z: -0.29, w: 0.32, h: 0.16, rows: [
      ['rot|START L|START,NORM|f=eng-start-sel-1', 'pb|EEC L|ALTN/', 'pb|AUTOSTART|/OFF', 'pb|EEC R|ALTN/', 'rot|START R|START,NORM|f=eng-start-sel-2', 'pb|JETTISON|FAULT/ARM'],
      ['pb|L FWD PUMP|LOW/OFF|f=fuel-l2', 'pb|L AFT PUMP|LOW/OFF|f=fuel-l1', 'pb|CTR L|LOW/OFF|f=fuel-c1', 'pb|CROSSFEED|VALVE/', 'pb|CTR R|LOW/OFF|f=fuel-c2', 'pb|R FWD PUMP|LOW/OFF|f=fuel-r2', 'pb|R AFT PUMP|LOW/OFF|f=fuel-r1']] },
    { n: 'AIR COND', x: 0.255, z: -0.31, w: 0.21, h: 0.18, rows: [
      ['knob|FLT DECK', 'knob|CABIN', 'pb|TRIM AIR|/OFF'], ['pb|L PACK|FAULT/OFF|f=pack1', 'pb|L CAC|FAULT/OFF', 'pb|R CAC|FAULT/OFF', 'pb|R PACK|FAULT/OFF|f=pack2']] },
    { n: 'BLEED / PRESS', x: 0.10, z: -0.47, w: 0.40, h: 0.12, rows: [
      ['pb|L ENG BLEED|FAULT/OFF|f=bleed-eng1', 'pb|APU BLEED|FAULT/OFF|f=apu-bleed', 'pb|ISLN|VALVE/|f=xbleed', 'pb|R ENG BLEED|FAULT/OFF|f=bleed-eng2', 'pb|OUTFLOW FWD|/MAN', 'pb|OUTFLOW AFT|/MAN', 'knob|LDG ALT']] },
    { n: 'SIGNS / CALLS', x: -0.30, z: -0.50, w: 0.19, h: 0.14, rows: [['tg|NO SMOKING|ON,AUTO,OFF', 'tg|SEAT BELTS|ON,AUTO,OFF|f=sign-seatbelts'], ['pbg|EMER LIGHTS|/ON', 'pb|GND CALL|/', 'pb|CABIN|/']] },
    { n: 'EXTERIOR LIGHTS / WIPERS', x: 0, z: -0.68, w: 0.62, h: 0.09, rows: [[
      'rot|WIPER L|OFF,INT,LOW,HIGH', 'tg|LANDING L|ON,OFF|f=light-landing', 'tg|NOSE|ON,OFF', 'tg|LANDING R|ON,OFF', 'tg|RWY TURNOFF|ON,OFF|f=light-rwyTurnoff', 'tg|TAXI|ON,OFF|f=light-taxi',
      'tg|BEACON|ON,OFF|f=light-beacon', 'tg|NAV|ON,OFF|f=light-nav', 'tg|LOGO|ON,OFF|f=light-logo', 'tg|WING|ON,OFF|f=light-wing', 'tg|STROBE|ON,OFF|f=light-strobe', 'tg|DOME|ON,OFF|f=light-cabin', 'rot|WIPER R|OFF,INT,LOW,HIGH']] }
  ];

  /* ---------------- E190 (E-Jet): 按钮式 + 旋钮 (电瓶 / 起动 / APU / 灯光) ---------------- */
  var E190 = [
    { n: 'IRS / ADS', x: -0.30, z: 0.05, w: 0.20, h: 0.12, rows: [['rot|IRS 1|OFF,NAV,ATT|f=adirs-ir1', 'lamp|ON BAT|f=adirs-onbat', 'rot|IRS 2|OFF,NAV,ATT|f=adirs-ir2'], ['pb|ADS PROBE HEAT|/OFF', 'pb|ADS 1|/OFF', 'pb|ADS 2|/OFF']] },
    { n: 'ELECTRICAL', x: -0.03, z: 0.02, w: 0.32, h: 0.18, rows: [
      ['rot|BATT 1|OFF,AUTO|f=elec-bat1', 'rot|BATT 2|OFF,AUTO|f=elec-bat2', 'pb|GPU|AVAIL/IN USE|f=elec-ext', 'pb|TRU ESS|/OFF', 'pb|GALLEY|/OFF'],
      ['pbg|IDG 1|DISC/|red', 'pb|IDG 1 GEN|FAULT/OFF', 'pb|APU GEN|FAULT/OFF', 'pb|IDG 2 GEN|FAULT/OFF', 'pbg|IDG 2|DISC/|red'],
      ['pb|AC BUS TIES|/OFF', 'pb|DC BUS TIES|/OFF', 'rot|ELEC EMER|AUTO,OFF', 'pb|RAT|/MAN']] },
    { n: 'FUEL', x: 0.25, z: 0.02, w: 0.22, h: 0.18, rows: [
      ['rot|XFEED|LOW 1,OFF,LOW 2', 'pb|AC PUMP 1|FAULT/OFF|f=fuel-l1', 'pb|AC PUMP 2|FAULT/OFF|f=fuel-r1', 'pb|DC PUMP|FAULT/ON|f=fuel-c1'],
      ['pb|L AUX|/ON|f=fuel-l2', 'pb|R AUX|/ON|f=fuel-r2', 'pb|CTR|/ON|f=fuel-c2']] },
    { n: 'HYDRAULIC', x: -0.10, z: -0.14, w: 0.40, h: 0.12, rows: [
      ['pb|ENG PUMP 1 SHUTOFF|/CLOSED|f=hyd-eng1', 'rot|ELEC PUMP 1|OFF,AUTO,ON|f=hyd-elec', 'rot|ELEC PUMP 3A|OFF,AUTO,ON|f=hyd-ptu', 'pb|ELEC PUMP 3B|/ON', 'rot|ELEC PUMP 2|OFF,AUTO,ON', 'pb|ENG PUMP 2 SHUTOFF|/CLOSED|f=hyd-eng2']] },
    { n: 'ICE PROTECTION', x: 0.29, z: -0.14, w: 0.16, h: 0.12, rows: [['rot|MODE|AUTO,ON,OFF|f=ai-wing', 'pb|ENG 1|/ON|f=ai-eng1', 'pb|ENG 2|/ON|f=ai-eng2'], ['pb|WINDSHIELD 1|/OFF|f=probe-heat', 'pb|WINDSHIELD 2|/OFF']] },
    { n: 'APU / ENGINE', x: -0.24, z: -0.28, w: 0.30, h: 0.12, rows: [
      ['rot|APU|OFF,ON,START|f=apu-rot', 'rot|ENG 1|STOP,RUN,START|f=eng-start-sel-1', 'rot|IGNITION 1|OFF,AUTO,OVRD', 'rot|IGNITION 2|OFF,AUTO,OVRD', 'rot|ENG 2|STOP,RUN,START|f=eng-start-sel-2']] },
    { n: 'PNEUMATIC / PACKS', x: 0.10, z: -0.28, w: 0.40, h: 0.12, rows: [
      ['pb|PACK 1|FAULT/OFF|f=pack1', 'pb|BLEED 1|FAULT/OFF|f=bleed-eng1', 'pb|APU BLEED|FAULT/OFF|f=apu-bleed', 'rot|XBLEED|CLOSED,AUTO,OPEN|f=xbleed', 'pb|BLEED 2|FAULT/OFF|f=bleed-eng2', 'pb|PACK 2|FAULT/OFF|f=pack2']] },
    { n: 'AIR COND / PRESS', x: 0.10, z: -0.42, w: 0.40, h: 0.12, rows: [['knob|CKPT TEMP', 'knob|CABIN TEMP', 'pb|RECIRC|/OFF', 'pb|PRESS MODE|/MAN', 'tg|CAB ALT|UP,DN', 'pbg|DUMP|/|red']] },
    { n: 'SIGNS / OXYGEN', x: -0.24, z: -0.42, w: 0.30, h: 0.12, rows: [['rot|NO SMKG|OFF,AUTO,ON', 'rot|BELTS|OFF,AUTO,ON|f=sign-seatbelts', 'gtg|EMER LT|OFF,ARMED,ON', 'pbg|PAX OXY|/DEPLOY|red', 'pb|CREW OXY|/']] },
    { n: 'LIGHTS', x: 0, z: -0.58, w: 0.62, h: 0.12, rows: [[
      'rot|LANDING|OFF,ON|f=light-landing', 'rot|TAXI|OFF,ON|f=light-taxi', 'rot|INSP|OFF,ON|f=light-rwyTurnoff', 'rot|NAV|OFF,ON|f=light-nav', 'rot|STROBE|OFF,ON|f=light-strobe', 'rot|RED BCN|OFF,ON|f=light-beacon', 'rot|LOGO|OFF,ON|f=light-logo', 'rot|WING|OFF,ON|f=light-wing', 'knob|DOME|f=light-cabin']] },
    { n: 'WIPERS', x: 0, z: -0.70, w: 0.40, h: 0.08, rows: [['rot|WIPER 1|OFF,TIMER,LOW,HIGH', 'pb|WASHER|/', 'rot|WIPER 2|OFF,TIMER,LOW,HIGH']] }
  ];

  FS.OVERHEAD_LAYOUTS = { a320: A320, a330: A330, a350: A350, c919: C919, b737: B737, b737max: B737, b777: B777, b787: B787, e190: E190 };
})(typeof window !== 'undefined' ? window : globalThis);
