/* SkyRoute — 0.6.0 交互式 MCDU / CDU (空客 MCDU, 波音 / E190 CDU 共用逻辑)
 * 简化的 FMS: 页面键 (DIR PROG PERF INIT DATA F-PLN RAD NAV FUEL PRED SEC F-PLN ATC COMM MCDU MENU),
 * 字母 / 数字键输入草稿行, CLR 删除, 行选键 (LSK) 把草稿行写入可编辑字段; 格式不对显示 FORMAT ERROR。
 * 只影响 MCDU 显示, 不改动飞行模型 / 自动驾驶 (V 速度、巡航高度等仅为记录)。 */
(function (global) {
  'use strict';
  var FS = global.FS = global.FS || {};
  var W = 512, H = 572;
  var PAGE_KEYS = [['DIR', 'PROG', 'PERF', 'INIT', 'DATA', ''], ['F-PLN', 'RAD NAV', 'FUEL PRED', 'SEC F-PLN', 'ATC COMM', 'MCDU MENU']];
  var ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').concat(['-', 'SP', '/', 'OVFY', 'CLR']);
  var DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '+/-'];
  var WHITE = '#f2f2f2', CYAN = '#3fd7ff', GREEN = '#3dff6a', AMBER = '#ffb000', MAG = '#ff5cff';

  function MCDU(sim, boeing) {
    this.sim = sim; this.boeing = !!boeing;
    this.page = 'INIT'; this.sp = ''; this.msg = '';
    this.d = { coRte: '', flt: 'SKY0301', ci: '30', crz: 'FL350', crzT: '-54°', tropo: '36090', v1: '', vr: '', v2: '', flx: '45', ths: '', ils: '', ilsCrs: '', vor1: '', zfw: '', block: '' };
    this.keys = this._layout();
  }
  var P = MCDU.prototype;
  P._layout = function () {
    var k = [], i, r, c;
    for (i = 0; i < 6; i++) {
      var y = 16 + (2 + i * 2) * 18 + 6;
      k.push({ id: 'L' + (i + 1), x: 8, y: y - 10, w: 40, h: 22, lsk: true });
      k.push({ id: 'R' + (i + 1), x: W - 48, y: y - 10, w: 40, h: 22, lsk: true });
    }
    for (r = 0; r < 2; r++) for (c = 0; c < 6; c++) if (PAGE_KEYS[r][c]) k.push({ id: PAGE_KEYS[r][c], x: 22 + c * 79, y: 282 + r * 34, w: 72, h: 28, page: true });
    for (i = 0; i < DIGITS.length; i++) k.push({ id: DIGITS[i], x: 26 + (i % 3) * 52, y: 360 + Math.floor(i / 3) * 40, w: 46, h: 34 });
    for (i = 0; i < ALPHA.length; i++) k.push({ id: ALPHA[i], x: 196 + (i % 5) * 60, y: 352 + Math.floor(i / 5) * 36, w: 54, h: 31 });
    return k;
  };
  P.info = function () {
    var s = this.sim || {}, fi = s.flightInfo || {}, fm = s.fm, cfg = fm && fm.cfg;
    return { dep: fi.dep || '----', arr: fi.arr || '----', rwy: fi.rwy || '--', cfg: cfg || (FS.AircraftDB && fi.type ? FS.AircraftDB[fi.type] : null) };
  };
  P.press = function (id) {
    this.msg = '';
    if (id === 'CLR') { if (this.sp) this.sp = this.sp.slice(0, -1); else this.sp = 'CLR'; return; }
    if (this.sp === 'CLR') this.sp = '';
    if (id === 'SP') { this.sp += ' '; return; }
    if (id === '+/-') { this.sp = this.sp.charAt(0) === '-' ? this.sp.slice(1) : '-' + this.sp; return; }
    if (id === 'OVFY') { this.sp += 'Δ'; return; }
    if (id.length === 1) { if (this.sp.length < 22) this.sp += id; return; }
    if (/^[LR]\d$/.test(id)) { this._lsk(id); return; }
    var map = { 'DIR': 'DIR', 'PROG': 'PROG', 'PERF': 'PERF', 'INIT': 'INIT', 'DATA': 'DATA', 'F-PLN': 'F-PLN', 'RAD NAV': 'RAD NAV', 'FUEL PRED': 'FUEL PRED', 'SEC F-PLN': 'SEC F-PLN', 'ATC COMM': 'ATC COMM', 'MCDU MENU': 'MCDU MENU' };
    if (map[id]) this.page = map[id];
  };
  var FIELDS = {   // 页面 → 行选键 → [字段, 校验]
    'INIT': { L1: ['coRte', /^[A-Z0-9]{1,10}$/], L3: ['flt', /^[A-Z0-9]{1,8}$/], L5: ['ci', /^\d{1,3}$/], L6: ['crz', /^(FL)?\d{2,3}$/] },
    'PERF': { L1: ['v1', /^\d{3}$/], L2: ['vr', /^\d{3}$/], L3: ['v2', /^\d{3}$/], R3: ['ths', /^\d{1}\/(UP|DN)?\d\.\d$|^\d$/], R4: ['flx', /^-?\d{1,2}$/] },
    'RAD NAV': { L1: ['vor1', /^\d{3}\.\d{1,2}$/], L3: ['ils', /^1(0[89]|1[01])\.\d{1,2}$/], L4: ['ilsCrs', /^\d{1,3}$/] },
    'FUEL PRED': { R1: ['zfw', /^\d{2}(\.\d)?$/], R2: ['block', /^\d{1,2}(\.\d)?$/] }
  };
  P._lsk = function (id) {
    var f = FIELDS[this.page] && FIELDS[this.page][id];
    if (this.page === 'MCDU MENU' && id === 'L1') { this.page = 'INIT'; return; }
    if (!f) return;
    if (this.sp === 'CLR') { this.d[f[0]] = ''; this.sp = ''; return; }
    if (!this.sp) return;
    var v = this.sp.trim();
    if (!f[1].test(v)) { this.msg = 'FORMAT ERROR'; return; }
    if (f[0] === 'crz' && !/^FL/.test(v)) v = 'FL' + v;
    this.d[f[0]] = v; this.sp = '';
  };
  P._lines = function () {
    var d = this.d, I = this.info(), st = (this.sim && this.sim.fm) || {}, L = [];
    function box(v, n) { return v || (n ? new Array(n + 1).join('□') : '----'); }
    var perf = I.cfg && I.cfg.perf ? I.cfg.perf : {};
    switch (this.page) {
      case 'INIT':
        L = [['INIT', WHITE, 'c'],
          ['CO RTE', WHITE, 'l', 'FROM/TO', WHITE], [box(d.coRte, 10), d.coRte ? CYAN : AMBER, 'l', I.dep + '/' + I.arr, CYAN],
          ['ALTN/CO RTE', WHITE, 'l'], ['----/----------', CYAN, 'l'],
          ['FLT NBR', WHITE, 'l'], [d.flt, CYAN, 'l'],
          ['LAT', WHITE, 'l', 'LONG', WHITE], [st.lat !== undefined ? fmtLat(st.lat) : '----', CYAN, 'l', st.lon !== undefined ? fmtLon(st.lon) : '----', CYAN],
          ['COST INDEX', WHITE, 'l'], [d.ci, CYAN, 'l'],
          ['CRZ FL/TEMP', WHITE, 'l', 'TROPO', WHITE], [d.crz + '/' + d.crzT, CYAN, 'l', d.tropo, CYAN]];
        break;
      case 'PERF':
        L = [['TAKE OFF RWY ' + I.rwy, GREEN, 'c'],
          ['V1', WHITE, 'l', 'FLP RETR', WHITE], [d.v1 || '---', d.v1 ? CYAN : AMBER, 'l', 'F=' + Math.round((perf.v2Base || 140) + 12), GREEN],
          ['VR', WHITE, 'l', 'SLT RETR', WHITE], [d.vr || '---', d.vr ? CYAN : AMBER, 'l', 'S=' + Math.round((perf.v2Base || 140) + 50), GREEN],
          ['V2', WHITE, 'l', 'TO SHIFT', WHITE], [d.v2 || '---', d.v2 ? CYAN : AMBER, 'l', 'FLAPS/THS ' + (d.ths || '[ ]/[   ]'), CYAN],
          ['TRANS ALT', WHITE, 'l', 'FLEX TO TEMP', WHITE], ['3000', CYAN, 'l', d.flx + '°', CYAN],
          ['THR RED/ACC', WHITE, 'l', 'ENG OUT ACC', WHITE], ['1500/1500', CYAN, 'l', '1500', CYAN],
          ['', WHITE, 'l', 'NEXT', WHITE], ['', WHITE, 'l', 'PHASE>', WHITE]];
        if (!d.v2 && perf.v2Base) L[5][3] = 'FLAPS/THS ' + (d.ths || '[ ]/[   ]') + '  V2≈' + perf.v2Base;
        break;
      case 'F-PLN':
                L = [['FROM ' + I.dep, WHITE, 'c'],
          ['', WHITE, 'l', 'TIME  SPD/ALT', WHITE], [I.dep + (I.rwy ? I.rwy : ''), GREEN, 'l', '0000  ---/-----', GREEN],
          ['RWY ' + I.rwy, WHITE, 'l'], ['(SPD)', GREEN, 'l', '---KT', GREEN],
          ['', WHITE, 'l'], ['(DECEL)', GREEN, 'l'],
          ['', WHITE, 'l'], [I.arr !== '----' ? I.arr : '(NO DEST)', GREEN, 'l'],
          ['------END OF F-PLN------', WHITE, 'c'], ['', WHITE, 'l'],
          ['DEST', WHITE, 'l', 'TIME  DIST', WHITE], [I.arr, WHITE, 'l', '----  ----', WHITE]];
        break;
      case 'RAD NAV':
        var ils = this.sim && this.sim._lastIls;
        L = [['RADIO NAV', WHITE, 'c'],
          ['VOR1/FREQ', WHITE, 'l', 'FREQ/VOR2', WHITE], [d.vor1 || '[ ]/[  . ]', CYAN, 'l', '[  . ]/[ ]', CYAN],
          ['CRS', WHITE, 'l', 'CRS', WHITE], ['[ ]', CYAN, 'l', '[ ]', CYAN],
          ['LS /FREQ', WHITE, 'l'], [d.ils || (ils ? ils.ident + '/' + ils.freq.toFixed(2) : '[  ]/[   . ]'), d.ils ? CYAN : MAG, 'l'],
          ['CRS', WHITE, 'l'], [d.ilsCrs || (ils ? String(Math.round(ils.course * 57.3 + 360) % 360) : '[ ]'), CYAN, 'l'],
          ['ADF1/FREQ', WHITE, 'l', 'FREQ/ADF2', WHITE], ['[ ]/[  . ]', CYAN, 'l', '[  . ]/[ ]', CYAN]];
        break;
      case 'PROG':
        L = [['CRZ ' + d.crz, GREEN, 'c'],
          ['CRZ', WHITE, 'l', 'OPT  REC MAX', WHITE], [d.crz, CYAN, 'l', 'FL350 FL390', GREEN],
          ['', WHITE, 'l'], ['<REPORT', WHITE, 'l'],
          ['POSITION UPDATE AT', WHITE, 'l'], ['*[    ]', CYAN, 'l'],
          ['BRG / DIST', WHITE, 'l', 'TO', WHITE], ['---° /----.-', GREEN, 'l', '[    ]', CYAN],
          ['PREDICTIVE', WHITE, 'l'], ['<GPS', WHITE, 'l', 'GPS PRIMARY', GREEN],
          ['REQUIRED', WHITE, 'l', 'ESTIMATED', WHITE], ['1.00NM', CYAN, 'l', '0.05NM', GREEN]];
        break;
      case 'FUEL PRED':
        var fob = st.fuelKg || 0;
        L = [['FUEL PRED', WHITE, 'c'],
          ['AT', WHITE, 'l', 'ZFW/ZFWCG', WHITE], [I.arr, GREEN, 'l', (d.zfw || '[  . ]') + '/[  . ]', CYAN],
          ['', WHITE, 'l', 'BLOCK', WHITE], ['', WHITE, 'l', d.block || (fob / 1000).toFixed(1), CYAN],
          ['', WHITE, 'l'], ['', WHITE, 'l'],
          ['', WHITE, 'l'], ['', WHITE, 'l'],
          ['FOB', WHITE, 'l'], [(fob / 1000).toFixed(1) + ' T', GREEN, 'l'],
          ['GW', WHITE, 'l'], [((st.gw || 0) / 1000).toFixed(1) + ' T', GREEN, 'l']];
        break;
      case 'MCDU MENU':
        L = [['MCDU MENU', WHITE, 'c'], ['', WHITE, 'l'], ['<FMGC', GREEN, 'l'], ['', WHITE, 'l'], ['<ATSU', WHITE, 'l'], ['', WHITE, 'l'], ['<AIDS', WHITE, 'l'], ['', WHITE, 'l'], ['<CFDS', WHITE, 'l']];
        break;
      default:
        L = [[this.page, WHITE, 'c'], ['', WHITE, 'l'], ['NOT AVAILABLE', AMBER, 'c'], ['', WHITE, 'l'], ['(SKYROUTE 简化 FMS)', WHITE, 'c']];
    }
    return L;
  };
  function fmtLat(v) { var a = Math.abs(v), dd = Math.floor(a), m = (a - dd) * 60; return pad(dd, 2) + '°' + m.toFixed(1) + (v >= 0 ? 'N' : 'S'); }
  function fmtLon(v) { var a = Math.abs(v), dd = Math.floor(a), m = (a - dd) * 60; return pad(dd, 3) + '°' + m.toFixed(1) + (v >= 0 ? 'E' : 'W'); }
  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  P.draw = function (c) {
    var g = c.getContext('2d');
    g.fillStyle = '#3b4148'; g.fillRect(0, 0, W, H);
    // 屏幕
    g.fillStyle = '#020403'; g.fillRect(54, 10, W - 108, 262);
    g.textBaseline = 'middle';
    var L = this._lines(), i;
    for (i = 0; i < L.length && i < 13; i++) {
      var l = L[i], y = 16 + i * 18 + 9, small = i > 0 && i % 2 === 1;
      g.font = (small ? '' : 'bold ') + (small ? 14 : 17) + 'px monospace';
      if (l[2] === 'c') { g.textAlign = 'center'; g.fillStyle = l[1]; g.fillText(l[0], W / 2, y); }
      else { g.textAlign = 'left'; g.fillStyle = l[1]; g.fillText(l[0], 62, y); }
      if (l[3]) { g.textAlign = 'right'; g.fillStyle = l[4] || WHITE; g.fillText(l[3], W - 62, y); }
    }
    g.textAlign = 'left'; g.font = 'bold 17px monospace';
    g.fillStyle = this.msg ? WHITE : (this.sp === 'CLR' ? WHITE : WHITE);
    g.fillText(this.msg || this.sp, 62, 16 + 13 * 18 + 9);
    // 键
    var self = this;
    this.keys.forEach(function (k) {
      g.fillStyle = k.lsk ? '#9aa0a6' : (k.page ? '#c9ccd0' : '#e3e5e7');
      g.fillRect(k.x, k.y, k.w, k.h);
      g.fillStyle = '#1b1d20'; g.textAlign = 'center';
      if (!k.lsk) { g.font = 'bold ' + (k.id.length > 5 ? 11 : (k.id.length > 2 ? 13 : 17)) + 'px sans-serif'; g.fillText(k.id, k.x + k.w / 2, k.y + k.h / 2 + 1); }
      else { g.fillRect(k.x + (k.id.charAt(0) === 'L' ? k.w - 10 : 4), k.y + k.h / 2 - 1, 6, 2); }
    });
    void self;
  };
  P.sig = function () { var st = this.sim && this.sim.fm; return this.page + '|' + this.sp + '|' + this.msg + '|' + JSON.stringify(this.d) + '|' + (this.sim && this.sim.flightInfo ? this.sim.flightInfo.dep : '') + '|' + (st && /INIT|FUEL/.test(this.page) ? Math.round((st.fuelKg || 0) / 50) + ':' + Math.round((st.lat || 0) * 1000) : ''); };
  MCDU.W = W; MCDU.H = H;
  FS.MCDU = MCDU;
})(typeof window !== 'undefined' ? window : globalThis);
