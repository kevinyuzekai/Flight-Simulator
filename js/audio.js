/* ==========================================================================
   飞行模拟器 — 音频引擎 (audio.js)
   全部音效均由 Web Audio API 实时合成, 不依赖任何外部音频文件。

   信号链:
     各音源 → 各总线(引擎/气动/雨/座舱/提示音) → busSum → killGain
            → DynamicsCompressor → masterGain → 软限幅器 → destination

   设计要点:
     * 所有持续音节点在 init() 中一次性建立并 start(), 之后只调制增益/频率,
       绝不在 update() 里创建节点 (触地、雷击等稀有事件除外, 见 _autoCue)。
     * 参数一律使用 setTargetAtTime / linearRamp 平滑, 避免拉链噪声。
     * 任何异常都被吞掉, 保证在无 Web Audio 的环境下完全静默降级。
   ========================================================================== */
(function (global) {
  'use strict';

  var FS = global.FS = global.FS || {};
  var U = FS.Utils || {};

  /* ---------------------------------------------------------------------
     0. 本地数值工具 (防止 utils.js 未加载时崩溃)
     --------------------------------------------------------------------- */
  function c01(v) { v = +v; if (!isFinite(v)) return 0; return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function clampr(v, a, b) { v = +v; if (!isFinite(v)) return a; return v < a ? a : (v > b ? b : v); }
  function fin(v, d) { v = +v; return isFinite(v) ? v : (d === undefined ? 0 : d); }
  function lerpn(a, b, t) { return a + (b - a) * t; }
  function smoothstep(t) { t = c01(t); return t * t * (3 - 2 * t); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  /** 指数平滑, tau 为时间常数 (秒) */
  function smoothTo(cur, tgt, tau, dt) {
    if (U.damp) return U.damp(cur, tgt, tau, dt);
    if (tau <= 0) return tgt;
    return cur + (tgt - cur) * (1 - Math.exp(-dt / tau));
  }
  /** 双曲正切近似 (软限幅曲线用) */
  function tanhA(x) {
    if (x < -3) return -1;
    if (x > 3) return 1;
    var x2 = x * x;
    return x * (27 + x2) / (27 + 9 * x2);
  }

  /* ---------------------------------------------------------------------
     1. 模块内部状态
     --------------------------------------------------------------------- */
  var ctx = null;
  var busEng = null;      // 引擎总线 (外部, 可被座舱隔音滤波)
  var engExtGain = null;  // 座舱内引擎衰减
  var engMuffle = null;   // 座舱隔音低通
  var busAir = null;      // 气动/起落架/地面/反推
  var busRain = null;     // 雨/雷
  var rainMuffle = null;
  var busCabin = null;    // 座舱环境
  var busCue = null;      // 提示音 (驾驶舱内部, 不隔音)
  var busSum = null;      // 汇总
  var killGain = null;    // stop() 静音闸门
  var comp = null;        // 压缩器
  var masterGain = null;  // 主音量
  var sanity = null;      // 软限幅 (防 NaN / 削波)
  var cuePanner = null;   // 一次性提示音的 HRTF 定位总线
  var cuePannerIn = null;

  var whiteBuf = null, pinkBuf = null;

  var _ready = false;
  var _silenced = false;
  var _vol = 0.8;
  var _muted = false;
  var _srcCount = 0;              // 已创建的常驻音源计数 (上限保护)
  var MAX_PERSISTENT_SRC = 96;

  /* 状态平滑量 */
  var _ias = 0, _mach = 0, _gs = 0, _alt = 0;
  var _prevOnGround = false;
  var _firstFrame = true;
  var _prevGear = 0, _prevFlap = 0, _prevSpoiler = 0;
  var _sbCool = 0;                // 减速板液压声冷却
  var _thunderTimer = 6;
  var _beatPhase = 0;
  var _cabinReq = 0;              // setCabinAmbience 设定值
  var _env = { rain: 0, wind: 0, thunder: false, onGround: false, cockpit: false };
  var _lisPos = { x: 0, y: 0, z: 0 };   // 听者世界坐标 (雷声等定位提示音据此生成)

  /* 当前机型的音色档案 */
  var prof = null;
  var _pendingType = null;

  /* 常驻声部 */
  var engVoice = [null, null];
  var airVoice = null, gndVoice = null, rainVoice = null, cabinVoice = null;
  var revVoice = null, apuVoice = null;
  var act = { flap: null, gear: null };
  var loops = { mw: null, stall: null, fire: null, ap: null };

  /* ---------------------------------------------------------------------
     2. 基础工具: 参数平滑 / 节点制造
     --------------------------------------------------------------------- */
  function nowT() { return ctx ? ctx.currentTime : 0; }

  /** 平滑地把 AudioParam 送往目标值 (禁止直接写 .value) */
  function ramp(param, value, tc) {
    if (!param || !ctx) return;
    var v = +value;
    if (!isFinite(v)) return;                 // NaN 保护: 忽略非法值
    if (v > 1e6) v = 1e6;
    if (v < -1e6) v = -1e6;
    try { param.setTargetAtTime(v, ctx.currentTime, tc || 0.06); } catch (e) { }
  }

  function rampAt(param, value, when, tc) {
    if (!param || !ctx) return;
    var v = +value;
    if (!isFinite(v)) return;
    try { param.setTargetAtTime(v, when, tc || 0.06); } catch (e) { }
  }

  function gainNode(v) {
    var g = ctx.createGain();
    g.gain.value = isFinite(v) ? v : 0;
    return g;
  }

  function biquad(type, f, q, gainDb) {
    var b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = clampr(f, 10, 20000);
    if (q !== undefined) b.Q.value = clampr(q, 0.0001, 40);
    if (gainDb !== undefined) b.gain.value = clampr(gainDb, -40, 40);
    return b;
  }

  /** 立体声声像节点 (带降级) */
  function stereoPanner(pan) {
    if (ctx.createStereoPanner) {
      var p = ctx.createStereoPanner();
      p.pan.value = clampr(pan, -1, 1);
      return p;
    }
    // 降级: 用等功率 PannerNode 近似
    var pn = ctx.createPanner();
    pn.panningModel = 'equalpower';
    if (pn.positionX) {
      pn.positionX.value = clampr(pan, -1, 1);
      pn.positionY.value = 0;
      pn.positionZ.value = -1;
    } else if (pn.setPosition) {
      pn.setPosition(clampr(pan, -1, 1), 0, -1);
    }
    return pn;
  }

  /** 常驻循环噪声源 */
  function loopNoise(buf, gainVal) {
    var s = ctx.createBufferSource();
    s.buffer = buf || whiteBuf;
    s.loop = true;
    var g = gainNode(gainVal === undefined ? 0 : gainVal);
    s.connect(g);
    try { s.start(0); } catch (e) { }
    _srcCount++;
    return { src: s, out: g };
  }

  /** 常驻振荡器 */
  function persistOsc(type, freq, gainVal) {
    var o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = clampr(freq, 0.01, 20000);
    var g = gainNode(gainVal === undefined ? 0 : gainVal);
    o.connect(g);
    try { o.start(0); } catch (e) { }
    _srcCount++;
    return { osc: o, out: g };
  }

  /* ---------------------------------------------------------------------
     3. 噪声缓冲 (一次生成, 全程复用)
     --------------------------------------------------------------------- */
  function buildBuffers() {
    var sr = ctx.sampleRate || 44100;
    var len = Math.floor(sr * 2);            // 2 秒
    whiteBuf = ctx.createBuffer(2, len, sr);
    for (var ch = 0; ch < 2; ch++) {
      var d = whiteBuf.getChannelData(ch);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    // 粉红噪声 (Paul Kellet 近似滤波) —— 座舱人群 / 雨声更自然
    pinkBuf = ctx.createBuffer(2, len, sr);
    for (var ch2 = 0; ch2 < 2; ch2++) {
      var p = pinkBuf.getChannelData(ch2);
      var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (var j = 0; j < len; j++) {
        var w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        p[j] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
  }

  /* ---------------------------------------------------------------------
     4. 机型音色档案
     --------------------------------------------------------------------- */
  var DEFAULT_ENG = {
    model: 'generic', count: 2, maxThrust: 250000, bypass: 6,
    fanDiameter: 2.2, n1Idle: 22, n1Max: 100, spoolUp: 3, spoolDown: 4.2,
    egtIdle: 380, egtMax: 950
  };

  function defaultProfile() {
    return buildProfile(DEFAULT_ENG, 0.78, 'default');
  }

  /**
   * 由发动机参数推导音色:
   *   高涵道比 (bypass 大) → 深沉的风扇隆隆 + 强烈啸叫
   *   低涵道比            → 更多核心燃烧轰鸣
   *   fanDiameter 越大    → 基频越低 (大直径低速风扇)
   */
  function buildProfile(e, machCrit, key) {
    var eng = {
      model: e.model || 'generic',
      count: clampr(fin(e.count, 2), 1, 4),
      maxThrust: fin(e.maxThrust, 250000),
      bypass: fin(e.bypass, 6),
      fanDiameter: fin(e.fanDiameter, 2.2),
      n1Idle: fin(e.n1Idle, 22),
      n1Max: fin(e.n1Max, 100),
      spoolUp: fin(e.spoolUp, 3),
      spoolDown: fin(e.spoolDown, 4.2),
      egtIdle: fin(e.egtIdle, 380),
      egtMax: fin(e.egtMax, 950)
    };
    var hiB = c01((eng.bypass - 4) / 7);                                     // 0=低涵道比 1=高涵道比
    var fanScale = clampr(Math.pow(2.98 / Math.max(0.4, eng.fanDiameter), 0.85), 0.62, 1.62);
    var loud = clampr(Math.sqrt(eng.maxThrust / 374500), 0.78, 1.20);
    return {
      key: key || 'default',
      eng: eng,
      hiB: hiB,
      fanScale: fanScale,
      loud: loud,
      machCrit: clampr(machCrit || 0.78, 0.6, 0.92),
      whine: lerpn(0.80, 1.30, hiB) * loud,   // 风扇啸叫
      buzz: lerpn(0.55, 1.15, hiB) * loud,    // 锯齿轮 "buzzsaw"
      fanRumble: lerpn(0.50, 1.15, hiB) * loud, // 风扇低频体量
      core: lerpn(1.40, 0.82, hiB) * loud,    // 核心轰鸣 (低涵道比更强)
      hiss: lerpn(1.10, 0.90, hiB) * loud,    // 排气嘶嘶
      rumble: lerpn(1.25, 0.85, hiB) * loud   // 燃烧脉动
    };
  }

  /* ---------------------------------------------------------------------
     5. 常驻声部建立
     --------------------------------------------------------------------- */

  /** 引擎声部 (单台): 风扇啸叫 + buzzsaw + 核心轰鸣 + 排气嘶嘶 + 燃烧脉动 */
  function createEngineVoice(pan) {
    var v = {};

    v.pan = stereoPanner(pan);
    v.out = gainNode(1);
    v.pan.connect(v.out);
    v.out.connect(busEng);

    /* --- 风扇啸叫: 3 个失谐振荡器 → 窄带通 → 增益 --- */
    v.fanMix = gainNode(0.34);
    v.fanOsc = [];
    var ratios = [1.0, 1.0065, 0.5];        // 基频 / 微失谐 / 低八度 (增加厚度)
    var types = ['sawtooth', 'sawtooth', 'triangle'];
    for (var i = 0; i < ratios.length; i++) {
      var o = ctx.createOscillator();
      o.type = types[i];
      o.frequency.value = 70;
      var g = gainNode(i === 2 ? 0.30 : 0.42);
      o.connect(g); g.connect(v.fanMix);
      try { o.start(0); } catch (e) { }
      _srcCount++;
      v.fanOsc.push({ osc: o, ratio: ratios[i], gain: g });
    }
    v.fanBP = biquad('bandpass', 90, 6.5);
    v.fanGain = gainNode(0);
    v.fanMix.connect(v.fanBP);
    v.fanBP.connect(v.fanGain);
    v.fanGain.connect(v.pan);
    // 少量直通信号给风扇"体量"
    v.fanBody = gainNode(0);
    v.fanMix.connect(v.fanBody);
    v.fanBody.connect(v.pan);

    /* --- buzzsaw: N1 高时的锯齿轮啸叫 (高次谐波) --- */
    v.buzzMix = gainNode(0.22);
    v.buzzOsc = [];
    for (var b = 0; b < 2; b++) {
      var bo = ctx.createOscillator();
      bo.type = 'sawtooth';
      bo.frequency.value = 160;
      var bg = gainNode(b === 0 ? 0.5 : 0.34);
      bo.connect(bg); bg.connect(v.buzzMix);
      try { bo.start(0); } catch (e) { }
      _srcCount++;
      v.buzzOsc.push({ osc: bo, mult: b === 0 ? 2.0 : 2.021 });
    }
    v.buzzHP = biquad('highpass', 600, 0.9);
    v.buzzGain = gainNode(0);
    v.buzzMix.connect(v.buzzHP);
    v.buzzHP.connect(v.buzzGain);
    v.buzzGain.connect(v.pan);

    /* --- 核心轰鸣: 噪声 → 低通 → 共振峰 → 增益 (主要低频能量) --- */
    var coreN = loopNoise(whiteBuf, 0.55);
    v.coreLP = biquad('lowpass', 200, 1.1);
    v.corePeak = biquad('peaking', 260, 1.6, 9);
    v.coreGain = gainNode(0);
    coreN.out.connect(v.coreLP);
    v.coreLP.connect(v.corePeak);
    v.corePeak.connect(v.coreGain);
    v.coreGain.connect(v.pan);
    // 低频"体量": 风扇隆隆 (高涵道比更明显)
    v.rumbleFilter = biquad('lowpass', 140, 0.8);
    v.rumbleBody = gainNode(0);
    v.coreLP.connect(v.rumbleFilter);
    v.rumbleFilter.connect(v.rumbleBody);
    v.rumbleBody.connect(v.pan);

    /* --- 排气嘶嘶: 高通噪声, 70% N1 以上显著 --- */
    var hissN = loopNoise(whiteBuf, 0.5);
    v.hissHP = biquad('highpass', 2200, 0.7);
    v.hissGain = gainNode(0);
    hissN.out.connect(v.hissHP);
    v.hissHP.connect(v.hissGain);
    v.hissGain.connect(v.pan);

    /* --- 燃烧脉动: 低频脉冲列 (18~55 Hz) 同时调制轰鸣增益与自身发声 --- */
    var rl = persistOsc('sawtooth', 30, 0.5);
    v.rumbleOsc = rl.osc;
    v.rumbleOscOut = rl.out;
    v.rumbleLP = biquad('lowpass', 150, 1.2);
    v.rumbleAmp = gainNode(0);
    rl.out.connect(v.rumbleLP);
    v.rumbleLP.connect(v.rumbleAmp);
    v.rumbleAmp.connect(v.pan);
    // 脉动深度: 直接叠加到 coreGain.gain 上 (AM 调制)
    v.rumbleMod = gainNode(0);
    rl.out.connect(v.rumbleMod);
    v.rumbleMod.connect(v.coreGain.gain);

    return v;
  }

  /** 气动噪声: 宽带风噪 + 高速滑流嘶嘶 + 抖振 */
  function createAirVoice() {
    var a = {};
    a.n1 = loopNoise(whiteBuf, 0.5);         // 宽带风噪
    a.lp = biquad('lowpass', 300, 0.9);
    a.gain = gainNode(0);
    a.n1.out.connect(a.lp); a.lp.connect(a.gain); a.gain.connect(busAir);

    a.n2 = loopNoise(whiteBuf, 0.45);        // 滑流嘶嘶
    a.hp = biquad('highpass', 2600, 0.7);
    a.bp = biquad('peaking', 5200, 1.1, 7);
    a.hiss = gainNode(0);
    a.n2.out.connect(a.hp); a.hp.connect(a.bp); a.bp.connect(a.hiss); a.hiss.connect(busAir);

    a.n3 = loopNoise(whiteBuf, 0.5);         // 低速抖振 (马赫临界)
    a.buffetLP = biquad('lowpass', 90, 3.2);
    a.buffet = gainNode(0);
    a.n3.out.connect(a.buffetLP); a.buffetLP.connect(a.buffet); a.buffet.connect(busAir);

    // 阵风: 两个慢速 LFO 调制风噪增益
    a.g1 = persistOsc('sine', 0.23, 0.5);
    a.g2 = persistOsc('sine', 0.61, 0.35);
    a.gustDepth = gainNode(0);
    a.g1.out.connect(a.gustDepth);
    a.g2.out.connect(a.gustDepth);
    a.gustDepth.connect(a.gain.gain);
    return a;
  }

  /** 地面滑跑: 轮子低频隆隆 */
  function createGroundVoice() {
    var g = {};
    g.n = loopNoise(whiteBuf, 0.5);
    g.lp = biquad('lowpass', 140, 1.4);
    g.peak = biquad('peaking', 75, 1.2, 8);
    g.gain = gainNode(0);
    g.n.out.connect(g.lp); g.lp.connect(g.peak); g.peak.connect(g.gain); g.gain.connect(busAir);
    return g;
  }

  /** 雨声床 */
  function createRainVoice() {
    var r = {};
    r.n = loopNoise(whiteBuf, 0.5);
    r.bp = biquad('bandpass', 1500, 0.55);
    r.hp = biquad('highpass', 700, 0.7);
    r.gain = gainNode(0);
    r.n.out.connect(r.bp); r.bp.connect(r.hp); r.hp.connect(r.gain); r.gain.connect(busRain);
    return r;
  }

  /** 座舱环境: 空调低频嗡鸣 + 人群粉噪 + 机体低频音 + 驾驶舱风扇 */
  function createCabinVoice() {
    var c = {};
    // 空调嗡鸣
    c.humOsc = persistOsc('triangle', 58, 0.5);
    c.humLP = biquad('lowpass', 220, 0.9);
    c.hum = gainNode(0);
    c.humOsc.out.connect(c.humLP); c.humLP.connect(c.hum); c.hum.connect(busCabin);

    // 机身低频音 (随马赫略变)
    c.bodyOsc = persistOsc('sine', 86, 0.4);
    c.body = gainNode(0);
    c.bodyOsc.out.connect(c.body); c.body.connect(busCabin);

    // 人群 / 客舱粉噪
    c.crowdN = loopNoise(pinkBuf, 0.5);
    c.crowdBP = biquad('bandpass', 850, 0.6);
    c.crowd = gainNode(0);
    c.crowdN.out.connect(c.crowdBP); c.crowdBP.connect(c.crowd); c.crowd.connect(busCabin);

    // 驾驶舱风扇 (仅座舱视角)
    c.fanN = loopNoise(whiteBuf, 0.5);
    c.fanBP = biquad('bandpass', 430, 1.1);
    c.fanGain = gainNode(0);
    c.fanN.out.connect(c.fanBP); c.fanBP.connect(c.fanGain); c.fanGain.connect(busCabin);
    c.fanWhine = persistOsc('triangle', 232, 0.5);
    c.fanWhineBP = biquad('bandpass', 232, 6);
    c.fanWhineGain = gainNode(0);
    c.fanWhine.out.connect(c.fanWhineBP); c.fanWhineBP.connect(c.fanWhineGain);
    c.fanWhineGain.connect(busCabin);
    return c;
  }

  /** 反推: 宽带噪声 + 低频嚎叫 */
  function createReverserVoice() {
    var r = {};
    r.n = loopNoise(whiteBuf, 0.5);
    r.lp = biquad('lowpass', 420, 1.0);
    r.gain = gainNode(0);
    r.n.out.connect(r.lp); r.lp.connect(r.gain); r.gain.connect(busAir);

    var h = persistOsc('sawtooth', 90, 0.4);
    r.howl = h.osc;
    r.howlBP = biquad('bandpass', 180, 3.5);
    r.howlGain = gainNode(0);
    h.out.connect(r.howlBP); r.howlBP.connect(r.howlGain); r.howlGain.connect(busAir);

    // 低频"吼" 的抖动
    r.wob = persistOsc('sine', 7.3, 0.5);
    r.wobDepth = gainNode(0);
    r.wob.out.connect(r.wobDepth); r.wobDepth.connect(r.howl.detune);
    return r;
  }

  /** APU 常驻底噪 */
  function createApuVoice() {
    var a = {};
    a.osc = persistOsc('sawtooth', 430, 0.4);
    a.bp = biquad('bandpass', 430, 4.5);
    a.gain = gainNode(0);
    a.osc.out.connect(a.bp); a.bp.connect(a.gain); a.gain.connect(busEng);
    a.n = loopNoise(whiteBuf, 0.5);
    a.lp = biquad('lowpass', 700, 0.9);
    a.nGain = gainNode(0);
    a.n.out.connect(a.lp); a.lp.connect(a.nGain); a.nGain.connect(busEng);
    return a;
  }

  /** 作动筒电机 (襟翼 / 起落架) */
  function createActuator(baseFreq, noiseLevel) {
    var m = {};
    m.osc = persistOsc('sawtooth', baseFreq, 0.35);
    m.bp = biquad('bandpass', baseFreq * 1.5, 3.0);
    m.osc2 = persistOsc('triangle', baseFreq * 2.02, 0.18);
    m.gain = gainNode(0);
    m.osc.out.connect(m.bp);
    m.osc2.out.connect(m.bp);
    m.bp.connect(m.gain);
    m.gain.connect(busCue);
    m.n = loopNoise(whiteBuf, 0.5);
    m.nBP = biquad('bandpass', 900, 0.8);
    m.nGain = gainNode(0);
    m.n.out.connect(m.nBP); m.nBP.connect(m.nGain); m.nGain.connect(busCue);
    m.noiseLevel = noiseLevel;
    m.hold = 0;
    m.on = false;
    return m;
  }

  /* ---------------------------------------------------------------------
     6. 常驻循环告警 (主警告 / 失速 / 火警铃 / AP 断开)
     --------------------------------------------------------------------- */

  /** 主警告: 红色警告连续音 (方波门控的三连音) */
  function createMasterWarning() {
    var m = {};
    m.gain = gainNode(0);
    m.gain.connect(busCue);
    m.mix = gainNode(0.8);
    var a = persistOsc('triangle', 740, 0.5);
    var b = persistOsc('triangle', 995, 0.28);
    a.out.connect(m.mix);
    b.out.connect(m.mix);
    m.vca = gainNode(0.5);
    m.mix.connect(m.vca);
    m.vca.connect(m.gain);
    var lfo = persistOsc('square', 3.1, 0.5);
    m.lfoDepth = gainNode(0.5);
    lfo.out.connect(m.lfoDepth);
    m.lfoDepth.connect(m.vca.gain);
    m.on = false;
    return m;
  }

  /** 失速警告: 低频粗砺蜂鸣 + 轻微音高抖动 */
  function createStall() {
    var s = {};
    s.gain = gainNode(0);
    s.gain.connect(busCue);
    var o = persistOsc('sawtooth', 82, 0.5);
    s.osc = o.osc;
    s.bp = biquad('bandpass', 210, 1.8);
    s.vca = gainNode(0.5);
    o.out.connect(s.bp); s.bp.connect(s.vca); s.vca.connect(s.gain);
    // 粗砺感: 25 Hz 方波幅度调制
    var rasp = persistOsc('square', 26.5, 0.5);
    s.raspDepth = gainNode(0.48);
    rasp.out.connect(s.raspDepth);
    s.raspDepth.connect(s.vca.gain);
    // 音高抖动
    var wob = persistOsc('sine', 4.7, 0.5);
    s.wobDepth = gainNode(38);
    wob.out.connect(s.wobDepth);
    s.wobDepth.connect(s.osc.detune);
    s.on = false;
    return s;
  }

  /** 火警铃 (连续敲击) */
  function createFireBell() {
    var f = {};
    f.gain = gainNode(0);
    f.gain.connect(busCue);
    f.mix = gainNode(0.5);
    var p1 = persistOsc('sine', 1046, 0.5);
    var p2 = persistOsc('sine', 1568, 0.26);
    var p3 = persistOsc('sine', 2093, 0.14);
    p1.out.connect(f.mix);
    p2.out.connect(f.mix);
    p3.out.connect(f.mix);
    f.vca = gainNode(0.55);
    f.mix.connect(f.vca);
    f.vca.connect(f.gain);
    // 13 Hz 金属颤音
    var am = persistOsc('sine', 13.2, 0.5);
    f.amDepth = gainNode(0.42);
    am.out.connect(f.amDepth); f.amDepth.connect(f.vca.gain);
    // 1.15 Hz 敲击门
    var strike = persistOsc('square', 1.15, 0.5);
    f.strikeDepth = gainNode(0.42);
    strike.out.connect(f.strikeDepth); f.strikeDepth.connect(f.vca.gain);
    f.on = false;
    return f;
  }

  /** AP 断开音响警告 (双哔 + 停顿, 连续变体) */
  function createApDisconnect() {
    var d = {};
    d.gain = gainNode(0);
    d.gain.connect(busCue);
    var o = persistOsc('square', 1180, 0.4);
    d.bp = biquad('bandpass', 1180, 1.6);
    d.vca1 = gainNode(0.5);
    d.vca2 = gainNode(0.5);
    o.out.connect(d.bp); d.bp.connect(d.vca1); d.vca1.connect(d.vca2); d.vca2.connect(d.gain);
    // 5.5 Hz: 单个哔音
    var b1 = persistOsc('square', 5.5, 0.5);
    d.b1Depth = gainNode(0.5);
    b1.out.connect(d.b1Depth); d.b1Depth.connect(d.vca1.gain);
    // 0.75 Hz: 双哔后的长停顿
    var b2 = persistOsc('square', 0.75, 0.5);
    d.b2Depth = gainNode(0.45);
    b2.out.connect(d.b2Depth); d.b2Depth.connect(d.vca2.gain);
    d.on = false;
    return d;
  }

  /* ---------------------------------------------------------------------
     7. 一次性提示音合成器
     --------------------------------------------------------------------- */

  /** 分配输出: 有 pos 时走 HRTF 定位总线 */
  function cueTarget(pos, refDist) {
    if (!pos) return { node: busCue, panner: null };
    try {
      var p = ctx.createPanner();
      p.panningModel = 'HRTF';
      p.distanceModel = 'inverse';
      p.refDistance = clampr(fin(refDist, 25), 1, 3000);
      p.maxDistance = 4000;
      p.rolloffFactor = 1.1;
      if (p.positionX) {
        p.positionX.value = fin(pos.x, 0);
        p.positionY.value = fin(pos.y, 0);
        p.positionZ.value = fin(pos.z, 0);
      } else if (p.setPosition) {
        p.setPosition(fin(pos.x, 0), fin(pos.y, 0), fin(pos.z, 0));
      }
      p.connect(cuePannerIn);
      return { node: p, panner: p };
    } catch (e) {
      return { node: busCue, panner: null };
    }
  }

  /**
   * 一次性乐音 / 语音化音
   * spec: {type,f0,f1,dur,peak,attack,holdFrac,holdLevel,delay,partials,filter:{type,f,f2,q},pan,pos}
   */
  function playTone(spec) {
    if (!_ready || !ctx) return;
    var created = [];
    try {
      var t0 = nowT() + clampr(fin(spec.delay, 0), 0, 30);
      var dur = clampr(fin(spec.dur, 0.2), 0.02, 20);
      var peak = clampr(Math.abs(fin(spec.peak, 0.15)), 0.00001, 1.5);
      var atk = clampr(fin(spec.attack, 0.005), 0.001, dur * 0.5);
      var f0 = clampr(Math.abs(fin(spec.f0, 440)), 20, 18000);
      var f1 = clampr(Math.abs(fin(spec.f1, spec.f0 === undefined ? 440 : spec.f0)), 20, 18000);

      var tgt = cueTarget(spec.pos, spec.ref);
      var head = gainNode(1);
      var tail = head;
      if (spec.filter) {
        var bq = biquad(spec.filter.type || 'lowpass', fin(spec.filter.f, f0 * 2), fin(spec.filter.q, 0.8));
        if (spec.filter.f2 !== undefined) {
          bq.frequency.setValueAtTime(clampr(fin(spec.filter.f, f0 * 2), 10, 20000), t0);
          bq.frequency.exponentialRampToValueAtTime(clampr(Math.abs(fin(spec.filter.f2, f0 * 2)), 10, 20000), t0 + dur * 0.9);
        }
        head.connect(bq);
        tail = bq;
      }
      if (spec.pan !== undefined) {
        var sp = stereoPanner(fin(spec.pan, 0));
        tail.connect(sp);
        tail = sp;
      }
      tail.connect(tgt.node);

      // 包络 (head 本身即包络节点, 振荡器全部汇入 head)
      head.gain.cancelScheduledValues(t0);
      head.gain.setValueAtTime(0.0001, t0);
      head.gain.linearRampToValueAtTime(peak, t0 + atk);
      var holdFrac = c01(fin(spec.holdFrac, 0));
      if (holdFrac > 0) {
        // 下限 0.02: 指数斜坡不允许从 0 起步
        var hl = clampr(fin(spec.holdLevel, 0.75), 0.02, 1);
        head.gain.linearRampToValueAtTime(peak * hl, t0 + atk + holdFrac * (dur - atk));
      }
      head.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      var partials = spec.partials && spec.partials.length ? spec.partials : [1];
      for (var i = 0; i < partials.length; i++) {
        var mult = Math.abs(fin(partials[i], 1));
        if (mult < 0.05 || mult > 24) continue;
        var o = ctx.createOscillator();
        o.type = spec.type || 'sine';
        var of0 = clampr(f0 * mult, 15, 20000);
        var of1 = clampr(f1 * mult, 15, 20000);
        o.frequency.setValueAtTime(of0, t0);
        if (Math.abs(of1 - of0) > 0.5) {
          o.frequency.exponentialRampToValueAtTime(of1, t0 + dur * 0.93);
        }
        if (spec.detune) o.detune.value = clampr(fin(spec.detune, 0), -2400, 2400);
        var pg = gainNode(partials.length > 1 ? (i === 0 ? 0.72 : 0.34) : 1);
        o.connect(pg);
        pg.connect(head);
        created.push(o);
        o.start(t0);
        o.stop(t0 + dur + 0.05);
      }
      cleanupLater(created, tgt.panner, dur + 0.2);
    } catch (e) {
      // 出错时确保已创建的源被停止, 避免悬挂
      for (var k = 0; k < created.length; k++) { try { created[k].stop(0); } catch (e2) { } }
    }
  }

  /**
   * 一次性噪声 (滤波噪声瞬态)
   * spec: {dur,peak,attack,holdFrac,delay,fType,f0,f1,q,buf:'white'|'pink',filter2:{type,f,q},pan,pos,rate}
   */
  function playNoise(spec) {
    if (!_ready || !ctx) return;
    var src = null, panner = null;
    try {
      var t0 = nowT() + clampr(fin(spec.delay, 0), 0, 30);
      var dur = clampr(fin(spec.dur, 0.2), 0.01, 20);
      var peak = clampr(Math.abs(fin(spec.peak, 0.2)), 0.00001, 1.5);
      var atk = clampr(fin(spec.attack, 0.004), 0.0005, dur * 0.5);

      src = ctx.createBufferSource();
      src.buffer = (spec.buf === 'pink' && pinkBuf) ? pinkBuf : whiteBuf;
      src.loop = true;
      if (spec.rate) src.playbackRate.value = clampr(fin(spec.rate, 1), 0.1, 4);

      var head = gainNode(0.0001);
      var node = src;
      var bq = biquad(spec.fType || 'bandpass', fin(spec.f0, 1000), fin(spec.q, 0.8));
      if (spec.f1 !== undefined) {
        var fa = clampr(Math.abs(fin(spec.f0, 1000)), 10, 20000);
        var fb = clampr(Math.abs(fin(spec.f1, fa)), 10, 20000);
        bq.frequency.setValueAtTime(fa, t0);
        bq.frequency.exponentialRampToValueAtTime(fb, t0 + dur * 0.92);
      }
      node.connect(bq);
      var tail = bq;
      if (spec.filter2) {
        var bq2 = biquad(spec.filter2.type || 'highpass', fin(spec.filter2.f, 200), fin(spec.filter2.q, 0.8));
        tail.connect(bq2);
        tail = bq2;
      }
      tail.connect(head);

      var tgt = cueTarget(spec.pos, spec.ref);
      panner = tgt.panner;
      var outTail = head;
      if (spec.pan !== undefined) {
        var sp = stereoPanner(fin(spec.pan, 0));
        head.connect(sp);
        outTail = sp;
      }
      outTail.connect(tgt.node);

      head.gain.cancelScheduledValues(t0);
      head.gain.setValueAtTime(0.0001, t0);
      head.gain.linearRampToValueAtTime(peak, t0 + atk);
      var holdFrac = c01(fin(spec.holdFrac, 0));
      if (holdFrac > 0) {
        var hl2 = clampr(fin(spec.holdLevel, 0.7), 0.02, 1);
        head.gain.linearRampToValueAtTime(peak * hl2, t0 + atk + holdFrac * (dur - atk));
      }
      head.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      src.start(t0);
      src.stop(t0 + dur + 0.05);
      cleanupLater([src], panner, dur + 0.2);
    } catch (e) {
      if (src) { try { src.stop(0); } catch (e2) { } }
    }
  }

  /** 播放结束后自动断开, 避免图无限增长 */
  function cleanupLater(nodes, panner, delay) {
    var last = nodes[nodes.length - 1];
    if (!last) return;
    last.onended = function () {
      for (var i = 0; i < nodes.length; i++) { try { nodes[i].disconnect(); } catch (e) { } }
      if (panner) { try { panner.disconnect(); } catch (e2) { } }
    };
    void delay;
  }

  /* ---------------------------------------------------------------------
     8. 提示音表
     --------------------------------------------------------------------- */
  var CUES = {};

  function cueDef(name, fn) { CUES[name] = fn; }

  /** 归一化 opts → {g,delay,pos} */
  function normOpts(opts) {
    opts = opts || {};
    return {
      g: clampr(fin(opts.gain, 1), 0, 4),
      delay: clampr(fin(opts.delay, 0), 0, 30),
      pos: opts.pos || null,
      ref: fin(opts.ref, 25)
    };
  }

  /* ---- 按钮 / 开关 ---- */
  cueDef('click', function (o) {
    playNoise({ dur: 0.03, peak: 0.085 * o.g, attack: 0.001, delay: o.delay, fType: 'bandpass', f0: 2600, q: 5, pos: o.pos });
    playTone({ type: 'sine', f0: 1750, f1: 1200, dur: 0.028, peak: 0.035 * o.g, attack: 0.001, delay: o.delay, pos: o.pos });
  });

  cueDef('click_hard', function (o) {
    playNoise({ dur: 0.055, peak: 0.18 * o.g, attack: 0.001, delay: o.delay, fType: 'bandpass', f0: 1300, q: 3, pos: o.pos });
    playTone({ type: 'square', f0: 420, f1: 190, dur: 0.07, peak: 0.09 * o.g, attack: 0.001, delay: o.delay, filter: { type: 'lowpass', f: 1400, q: 0.9 }, pos: o.pos });
  });

  /* ---- 客舱钟 ---- */
  function twoTone(fa, fb, g, dur, o) {
    playTone({ type: 'sine', f0: fa, dur: dur, peak: 0.20 * g, attack: 0.012, delay: o.delay, pos: o.pos, partials: [1, 2] });
    playTone({ type: 'sine', f0: fb, dur: dur, peak: 0.20 * g, attack: 0.012, delay: o.delay + dur * 0.55, pos: o.pos, partials: [1, 2] });
  }
  cueDef('chime', function (o) { twoTone(587.33, 784.0, o.g, 0.40, o); });
  cueDef('cabin_chime', function (o) { twoTone(587.33, 784.0, o.g, 0.40, o); });
  cueDef('chime_high', function (o) { twoTone(784.0, 1046.5, o.g, 0.34, o); });
  cueDef('chime_low', function (o) {
    playTone({ type: 'sine', f0: 440, dur: 0.55, peak: 0.22 * o.g, attack: 0.02, delay: o.delay, pos: o.pos, partials: [1, 2, 3] });
  });

  /* ---- 起飞构型警告 (三声上升) ---- */
  cueDef('takeoff_config', function (o) {
    var f = [440, 587.33, 784];
    for (var i = 0; i < 3; i++) {
      playTone({
        type: 'triangle', f0: f[i], dur: 0.16, peak: 0.19 * o.g, attack: 0.012,
        holdFrac: 0.4, holdLevel: 0.8, delay: o.delay + i * 0.19, pos: o.pos,
        filter: { type: 'lowpass', f: f[i] * 6, q: 0.7 }
      });
    }
  });

  /* ---- 自动驾驶断开 ---- */
  function apDiscPattern(g, o) {
    // 双哔 ×3 组, 组间长停顿
    for (var r = 0; r < 3; r++) {
      for (var k = 0; k < 2; k++) {
        var d = o.delay + r * 0.82 + k * 0.19;
        playTone({
          type: 'square', f0: 1180, dur: 0.12, peak: 0.15 * g, attack: 0.004, delay: d, pos: o.pos,
          filter: { type: 'bandpass', f: 1180, q: 1.4 }
        });
      }
    }
  }
  cueDef('ap_disconnect', function (o) { apDiscPattern(o.g, o); });
  cueDef('ap_disconnect_loop', function (o) { startLoop('ap', 0.19 * o.g); });
  cueDef('ap_disconnect_stop', function () { stopLoop('ap'); });
  cueDef('ap_disconnect_loop_stop', function () { stopLoop('ap'); });

  /* ---- 主警告 / 主警戒 ---- */
  cueDef('master_warning', function (o) { startLoop('mw', 0.20 * o.g); });
  cueDef('master_warning_start', function (o) { startLoop('mw', 0.20 * o.g); });
  cueDef('master_warning_stop', function () { stopLoop('mw'); });
  cueDef('master_caution', function (o) {
    playTone({
      type: 'triangle', f0: 620, dur: 0.30, peak: 0.17 * o.g, attack: 0.01, delay: o.delay,
      holdFrac: 0.35, holdLevel: 0.85, pos: o.pos, filter: { type: 'lowpass', f: 4000, q: 0.7 }
    });
  });

  /* ---- 失速 ---- */
  cueDef('stall_start', function (o) { startLoop('stall', 0.30 * o.g); });
  cueDef('stall_stop', function () { stopLoop('stall'); });
  cueDef('stall', function (o) {
    // 单次粗砺蜂鸣 ~0.8 s, 复用常驻声部的节点 (不新建振荡器)
    if (!_ready) return;
    playTone({ type: 'sawtooth', f0: 92, f1: 78, dur: 0.75, peak: 0.20 * o.g, attack: 0.01, delay: o.delay, pos: o.pos, filter: { type: 'bandpass', f: 215, q: 1.8 } });
    playTone({ type: 'square', f0: 47, f1: 40, dur: 0.75, peak: 0.07 * o.g, attack: 0.01, delay: o.delay, filter: { type: 'lowpass', f: 300, q: 1.0 } });
  });

  /* ---- 超速 (响板式喀哒声) ---- */
  cueDef('overspeed', function (o) {
    for (var i = 0; i < 9; i++) {
      playNoise({
        dur: 0.014, peak: 0.16 * o.g, attack: 0.001, delay: o.delay + i * 0.052,
        fType: 'bandpass', f0: 3100, q: 5, pos: o.pos
      });
    }
  });

  /* ---- GPWS ---- */
  function gpwsTriad(fs, g, dur, gap, o, gainPeak, type) {
    for (var rep = 0; rep < 2; rep++) {
      for (var i = 0; i < fs.length; i++) {
        playTone({
          type: type || 'square', f0: fs[i], dur: dur, peak: (gainPeak || 0.17) * g,
          attack: 0.008, delay: o.delay + rep * (fs.length * gap + 0.14) + i * gap, pos: o.pos,
          filter: { type: 'bandpass', f: fs[i] * 1.35, q: 1.2 }
        });
      }
    }
  }
  cueDef('gpws_terrain', function (o) { gpwsTriad([420, 330, 420], o.g, 0.16, 0.17, o, 0.19, 'square'); });
  cueDef('gpws_pull_up', function (o) { gpwsTriad([880, 1046, 1245], o.g, 0.10, 0.105, o, 0.17, 'sawtooth'); });

  /** "FIFTY / FORTY ..." 数字高度喊话 (合成语音感: 基频 + 共振峰 + 下滑音) */
  function gpwsAlt(base, formant, g) {
    return function (o) {
      var s = o.g * g;
      playTone({
        type: 'triangle', f0: base, f1: base * 0.80, dur: 0.32, peak: 0.20 * s,
        attack: 0.018, holdFrac: 0.35, holdLevel: 0.85, delay: o.delay, pos: o.pos,
        filter: { type: 'bandpass', f: formant, q: 3.2 }
      });
      playTone({
        type: 'sine', f0: base * 2, f1: base * 1.55, dur: 0.14, peak: 0.055 * s,
        attack: 0.01, delay: o.delay, pos: o.pos
      });
    };
  }
  cueDef('gpws_50', gpwsAlt(640, 1200, 1.0));
  cueDef('gpws_40', gpwsAlt(590, 1120, 1.0));
  cueDef('gpws_30', gpwsAlt(545, 1050, 1.0));
  cueDef('gpws_20', gpwsAlt(500, 980, 1.0));
  cueDef('gpws_10', gpwsAlt(455, 910, 1.0));

  cueDef('gpws_sink_rate', function (o) {
    for (var r = 0; r < 2; r++) {
      playTone({ type: 'triangle', f0: 780, f1: 620, dur: 0.20, peak: 0.17 * o.g, attack: 0.01, delay: o.delay + r * 0.34, pos: o.pos, filter: { type: 'bandpass', f: 1000, q: 2.2 } });
    }
  });

  cueDef('gpws_glideslope', function (o) {
    for (var r = 0; r < 2; r++) {
      playTone({ type: 'sine', f0: 640, f1: 500, dur: 0.26, peak: 0.15 * o.g, attack: 0.015, delay: o.delay + r * 0.40, pos: o.pos, filter: { type: 'lowpass', f: 3000, q: 0.7 } });
    }
  });

  cueDef('gpws_minimums', function (o) {
    playTone({ type: 'sine', f0: 880, f1: 700, dur: 0.42, peak: 0.16 * o.g, attack: 0.02, delay: o.delay, pos: o.pos, partials: [1, 2] });
  });

  cueDef('gpws_retard', function (o) {
    for (var r = 0; r < 2; r++) {
      playTone({ type: 'triangle', f0: 520, f1: 430, dur: 0.18, peak: 0.18 * o.g, attack: 0.008, delay: o.delay + r * 0.26, pos: o.pos, filter: { type: 'bandpass', f: 780, q: 3.0 } });
    }
  });

  /* ---- TCAS 合成语音 ---- */
  function tcasSyllables(syl, g, o, formant) {
    var t = o.delay;
    for (var i = 0; i < syl.length; i++) {
      playTone({
        type: 'sawtooth', f0: syl[i][0], f1: syl[i][0] * (syl[i][2] || 0.94), dur: syl[i][1],
        peak: 0.16 * g, attack: 0.012, holdFrac: 0.35, holdLevel: 0.9, delay: t, pos: o.pos,
        filter: { type: 'bandpass', f: formant, q: 2.6 }
      });
      playTone({
        type: 'sine', f0: syl[i][0] * 2.02, dur: syl[i][1] * 0.8, peak: 0.045 * g,
        attack: 0.012, delay: t, pos: o.pos
      });
      t += syl[i][1] * 0.92;
    }
  }
  cueDef('tcas_traffic', function (o) { tcasSyllables([[545, 0.15], [505, 0.22]], o.g, o, 1150); });
  cueDef('tcas_climb', function (o) { tcasSyllables([[470, 0.13], [560, 0.13], [665, 0.22]], o.g, o, 1250); });
  cueDef('tcas_descend', function (o) { tcasSyllables([[700, 0.13], [565, 0.13], [465, 0.24]], o.g, o, 1050); });

  /* ---- 风切变 ---- */
  cueDef('wind_shear', function (o) {
    for (var i = 0; i < 3; i++) {
      playTone({ type: 'square', f0: 700, dur: 0.13, peak: 0.15 * o.g, attack: 0.006, delay: o.delay + i * 0.30, pos: o.pos, filter: { type: 'bandpass', f: 950, q: 1.4 } });
      playTone({ type: 'square', f0: 520, dur: 0.13, peak: 0.15 * o.g, attack: 0.006, delay: o.delay + i * 0.30 + 0.15, pos: o.pos, filter: { type: 'bandpass', f: 760, q: 1.4 } });
    }
    playNoise({ dur: 1.1, peak: 0.10 * o.g, attack: 0.25, holdFrac: 0.3, delay: o.delay, fType: 'bandpass', f0: 380, f1: 900, q: 0.8, pos: o.pos });
  });

  /* ---- 火警 ---- */
  function bellStrike(g, o, delay) {
    playTone({ type: 'sine', f0: 1046, dur: 1.15, peak: 0.17 * g, attack: 0.004, delay: delay, pos: o.pos, partials: [1, 1.5, 2, 2.76] });
    playNoise({ dur: 0.06, peak: 0.05 * g, attack: 0.002, delay: delay, fType: 'bandpass', f0: 2600, q: 2.5, pos: o.pos });
  }
  cueDef('fire', function (o) { for (var i = 0; i < 3; i++) bellStrike(o.g, o, o.delay + i * 0.55); });
  cueDef('fire_bell', function (o) { bellStrike(o.g, o, o.delay); });
  cueDef('fire_loop', function (o) { startLoop('fire', 0.19 * o.g); });
  cueDef('fire_loop_stop', function () { stopLoop('fire'); });

  cueDef('engine_fire_test', function (o) {
    // 测试音: 低频测试嗡鸣 + 两次铃响
    playTone({ type: 'square', f0: 300, dur: 0.9, peak: 0.11 * o.g, attack: 0.05, holdFrac: 0.5, holdLevel: 0.9, delay: o.delay, pos: o.pos, filter: { type: 'lowpass', f: 900, q: 0.8 } });
    playTone({ type: 'sine', f0: 620, f1: 615, dur: 0.9, peak: 0.07 * o.g, attack: 0.05, delay: o.delay, pos: o.pos });
    bellStrike(o.g * 0.8, o, o.delay + 1.0);
    bellStrike(o.g * 0.8, o, o.delay + 1.55);
  });

  /* ---- 自动驾驶接通 / 高度警戒 ---- */
  cueDef('autopilot_engage', function (o) {
    playTone({ type: 'sine', f0: 660, dur: 0.34, peak: 0.15 * o.g, attack: 0.06, delay: o.delay, pos: o.pos, partials: [1, 2] });
  });

  cueDef('altitude_alert', function (o) {
    var f = [523.25, 659.25, 783.99];    // C 大三和弦
    for (var i = 0; i < 3; i++) {
      playTone({ type: 'sine', f0: f[i], dur: 0.72, peak: 0.12 * o.g, attack: 0.08, holdFrac: 0.3, holdLevel: 0.85, delay: o.delay, pos: o.pos });
    }
  });

  /* ---- 地面 / 机轮 ---- */
  cueDef('touchdown', function (o) {
    // 轮胎擦地尖叫 (快速下滑的带通噪声) + 低频撞击
    playNoise({ dur: 0.30, peak: 0.34 * o.g, attack: 0.002, delay: o.delay, fType: 'bandpass', f0: 1700, f1: 420, q: 3.4, pos: o.pos });
    playTone({ type: 'sine', f0: 82, f1: 42, dur: 0.34, peak: 0.30 * o.g, attack: 0.003, delay: o.delay, pos: o.pos, filter: { type: 'lowpass', f: 220, q: 1.1 } });
    playNoise({ dur: 0.10, peak: 0.12 * o.g, attack: 0.001, delay: o.delay, fType: 'highpass', f0: 2500, q: 0.7, pos: o.pos });
  });

  cueDef('tire_screech', function (o) {
    playNoise({ dur: 0.95, peak: 0.24 * o.g, attack: 0.03, holdFrac: 0.45, holdLevel: 0.8, delay: o.delay, fType: 'bandpass', f0: 2400, f1: 1900, q: 7, pos: o.pos, filter2: { type: 'highpass', f: 1200, q: 0.7 } });
    playTone({ type: 'triangle', f0: 1180, f1: 1080, dur: 0.9, peak: 0.05 * o.g, attack: 0.05, delay: o.delay, pos: o.pos, filter: { type: 'bandpass', f: 1200, q: 8 } });
  });

  cueDef('brake_squeal', function (o) {
    playTone({ type: 'triangle', f0: 1980, f1: 1720, dur: 1.15, peak: 0.11 * o.g, attack: 0.04, holdFrac: 0.5, holdLevel: 0.85, delay: o.delay, pos: o.pos, filter: { type: 'bandpass', f: 1900, q: 9 } });
    playNoise({ dur: 1.1, peak: 0.07 * o.g, attack: 0.05, holdFrac: 0.5, holdLevel: 0.8, delay: o.delay, fType: 'bandpass', f0: 2600, q: 4, pos: o.pos });
  });

  /* ---- 起落架机械声 ---- */
  cueDef('gear_up', function (o) {
    playNoise({ dur: 0.06, peak: 0.20 * o.g, attack: 0.001, delay: o.delay, fType: 'bandpass', f0: 1900, q: 2.6, pos: o.pos });
    playTone({ type: 'sine', f0: 95, f1: 46, dur: 0.28, peak: 0.24 * o.g, attack: 0.003, delay: o.delay, pos: o.pos, filter: { type: 'lowpass', f: 200, q: 1.0 } });
    playNoise({ dur: 0.45, peak: 0.09 * o.g, attack: 0.02, delay: o.delay + 0.05, fType: 'lowpass', f0: 300, q: 0.8, pos: o.pos });
  });

  cueDef('gear_down', function (o) {
    // 放气声 + 更重的撞击 + 双响锁扣
    playNoise({ dur: 0.55, peak: 0.12 * o.g, attack: 0.03, holdFrac: 0.35, holdLevel: 0.8, delay: o.delay, fType: 'highpass', f0: 900, q: 0.7, pos: o.pos });
    playTone({ type: 'sine', f0: 88, f1: 38, dur: 0.45, peak: 0.30 * o.g, attack: 0.004, delay: o.delay + 0.28, pos: o.pos, filter: { type: 'lowpass', f: 190, q: 1.0 } });
    playNoise({ dur: 0.07, peak: 0.22 * o.g, attack: 0.001, delay: o.delay + 0.30, fType: 'bandpass', f0: 1500, q: 2.2, pos: o.pos });
    playNoise({ dur: 0.07, peak: 0.18 * o.g, attack: 0.001, delay: o.delay + 0.42, fType: 'bandpass', f0: 1750, q: 2.6, pos: o.pos });
  });

  /* ---- 作动筒 ---- */
  cueDef('flap_motor', function () { startActuator('flap'); });
  cueDef('gear_motor', function () { startActuator('gear'); });
  cueDef('speedbrake', function (o) {
    playNoise({ dur: 0.70, peak: 0.15 * o.g, attack: 0.035, holdFrac: 0.30, holdLevel: 0.75, delay: o.delay, fType: 'highpass', f0: 1300, q: 0.7, pos: o.pos, filter2: { type: 'peaking', f: 3200, q: 1.0 } });
    playTone({ type: 'sawtooth', f0: 260, f1: 190, dur: 0.5, peak: 0.05 * o.g, attack: 0.03, delay: o.delay, pos: o.pos, filter: { type: 'bandpass', f: 420, q: 2.5 } });
  });

  /* ---- 应急/动力装置 ---- */
  cueDef('rat', function (o) {
    playTone({ type: 'sawtooth', f0: 260, f1: 1500, dur: 1.6, peak: 0.16 * o.g, attack: 0.10, holdFrac: 0.35, holdLevel: 0.9, delay: o.delay, pos: o.pos, filter: { type: 'bandpass', f: 900, q: 2.2 } });
    playNoise({ dur: 1.7, peak: 0.09 * o.g, attack: 0.2, holdFrac: 0.4, holdLevel: 0.85, delay: o.delay, fType: 'bandpass', f0: 1200, f1: 2600, q: 0.9, pos: o.pos });
  });

  cueDef('apu_start', function (o) {
    playNoise({ dur: 2.4, peak: 0.13 * o.g, attack: 0.5, holdFrac: 0.35, holdLevel: 0.8, delay: o.delay, fType: 'lowpass', f0: 200, f1: 900, q: 0.8, pos: o.pos });
    playTone({ type: 'sawtooth', f0: 90, f1: 440, dur: 2.3, peak: 0.10 * o.g, attack: 0.4, holdFrac: 0.4, holdLevel: 0.85, delay: o.delay, pos: o.pos, filter: { type: 'bandpass', f: 420, q: 3.0 } });
    playTone({ type: 'sine', f0: 1200, f1: 200, dur: 0.9, peak: 0.05 * o.g, attack: 0.05, delay: o.delay, pos: o.pos });
  });

  cueDef('engine_start', function (o) {
    playNoise({ dur: 4.0, peak: 0.20 * o.g, attack: 1.6, holdFrac: 0.30, holdLevel: 0.85, delay: o.delay, fType: 'lowpass', f0: 120, f1: 1300, q: 0.9, pos: o.pos });
    playTone({ type: 'sawtooth', f0: 42, f1: 190, dur: 3.8, peak: 0.13 * o.g, attack: 1.4, holdFrac: 0.35, holdLevel: 0.9, delay: o.delay, pos: o.pos, filter: { type: 'bandpass', f: 200, q: 2.4 } });
    playTone({ type: 'triangle', f0: 150, f1: 520, dur: 3.2, peak: 0.05 * o.g, attack: 1.2, delay: o.delay + 0.8, pos: o.pos });
  });

  cueDef('engine_shutdown', function (o) {
    playTone({ type: 'sawtooth', f0: 380, f1: 52, dur: 3.2, peak: 0.16 * o.g, attack: 0.02, holdFrac: 0.18, holdLevel: 0.8, delay: o.delay, pos: o.pos, filter: { type: 'bandpass', f: 300, f2: 90, q: 2.0 } });
    playNoise({ dur: 3.4, peak: 0.12 * o.g, attack: 0.05, holdFrac: 0.2, holdLevel: 0.7, delay: o.delay, fType: 'lowpass', f0: 900, f1: 150, q: 0.9, pos: o.pos });
  });

  /* ---- 舱门 ---- */
  cueDef('door_open', function (o) {
    playNoise({ dur: 1.0, peak: 0.14 * o.g, attack: 0.06, holdFrac: 0.3, holdLevel: 0.8, delay: o.delay, fType: 'lowpass', f0: 260, q: 0.9, pos: o.pos });
    playNoise({ dur: 1.1, peak: 0.10 * o.g, attack: 0.10, holdFrac: 0.4, holdLevel: 0.85, delay: o.delay, fType: 'highpass', f0: 1400, q: 0.7, pos: o.pos });
    playNoise({ dur: 0.05, peak: 0.14 * o.g, attack: 0.001, delay: o.delay + 0.75, fType: 'bandpass', f0: 1600, q: 3, pos: o.pos });
    playTone({ type: 'sine', f0: 140, f1: 80, dur: 0.5, peak: 0.12 * o.g, attack: 0.02, delay: o.delay + 0.72, pos: o.pos });
  });

  cueDef('door_close', function (o) {
    playTone({ type: 'sine', f0: 150, f1: 70, dur: 0.6, peak: 0.16 * o.g, attack: 0.01, delay: o.delay, pos: o.pos, filter: { type: 'lowpass', f: 300, q: 1.0 } });
    playNoise({ dur: 0.9, peak: 0.12 * o.g, attack: 0.04, holdFrac: 0.25, holdLevel: 0.7, delay: o.delay + 0.1, fType: 'lowpass', f0: 300, q: 0.9, pos: o.pos });
    playNoise({ dur: 0.05, peak: 0.20 * o.g, attack: 0.001, delay: o.delay + 0.55, fType: 'bandpass', f0: 2000, q: 2.6, pos: o.pos });
    playNoise({ dur: 0.5, peak: 0.09 * o.g, attack: 0.02, delay: o.delay + 0.6, fType: 'highpass', f0: 1600, q: 0.7, pos: o.pos });
  });

  /* ---- 天气 ---- */
  cueDef('thunder', function (o) {
    var d = o.delay;
    playNoise({ dur: 0.35, peak: 0.42 * o.g, attack: 0.001, delay: d, fType: 'highpass', f0: 380, q: 0.7, pos: o.pos, ref: o.ref, filter2: { type: 'peaking', f: 2200, q: 0.9 } });
    playNoise({ dur: 2.8, peak: 0.38 * o.g, attack: 0.06, holdFrac: 0.22, holdLevel: 0.6, delay: d + 0.03, fType: 'lowpass', f0: 220, f1: 70, q: 1.1, pos: o.pos, ref: o.ref });
    playTone({ type: 'sine', f0: 58, f1: 26, dur: 2.6, peak: 0.25 * o.g, attack: 0.05, holdFrac: 0.2, holdLevel: 0.55, delay: d + 0.05, pos: o.pos, ref: o.ref });
  });

  cueDef('rain_start', function (o) {
    _env.rain = Math.max(fin(_env.rain, 0), 0.55);
    playNoise({ dur: 3.5, peak: 0.16 * o.g, attack: 0.9, holdFrac: 0.4, holdLevel: 0.85, delay: o.delay, fType: 'bandpass', f0: 1500, q: 0.6, buf: 'pink', pos: o.pos });
    playNoise({ dur: 1.2, peak: 0.07 * o.g, attack: 0.1, delay: o.delay, fType: 'highpass', f0: 3000, q: 0.7, pos: o.pos });
  });

  /* ---------------------------------------------------------------------
     9. 循环控制 (只调制增益, 不创建节点)
     --------------------------------------------------------------------- */
  function startLoop(key, level) {
    if (!_ready) return;
    var l = loops[key];
    if (!l) return;
    l.on = true;
    ramp(l.gain.gain, clampr(level, 0, 1), 0.03);
  }

  function stopLoop(key) {
    if (!_ready) return;
    var l = loops[key];
    if (!l) return;
    l.on = false;
    ramp(l.gain.gain, 0, 0.05);
  }

  function stopAllLoops() {
    stopLoop('mw'); stopLoop('stall'); stopLoop('fire'); stopLoop('ap');
  }

  function startActuator(key) {
    if (!_ready) return;
    var a = act[key];
    if (!a) return;
    a.on = true;
    a.hold = Math.max(a.hold, 1.2);
    ramp(a.gain.gain, key === 'gear' ? 0.16 : 0.13, 0.04);
    ramp(a.nGain.gain, a.noiseLevel, 0.04);
  }

  function stopActuator(key) {
    var a = act[key];
    if (!a) return;
    a.on = false;
    a.hold = 0;
    ramp(a.gain.gain, 0, 0.12);
    ramp(a.nGain.gain, 0, 0.12);
  }

  /* ---------------------------------------------------------------------
     10. 事件驱动的自动提示音 (仅在状态跳变时调用, 非每帧)
     --------------------------------------------------------------------- */
  function autoCue(name, opts) {
    dispatchCue(name, opts);
  }

  function dispatchCue(name, opts) {
    if (!_ready) return;
    var fn = CUES[name];
    if (!fn) return;                       // 未知名称: 静默忽略
    try { fn(normOpts(opts)); } catch (e) { }
  }

  /* ---------------------------------------------------------------------
     11. 每帧更新
     --------------------------------------------------------------------- */
  function updateEngine(v, n1, egt, dt, beat, running) {
    if (!v) return;
    var e = prof.eng;
    var n1norm = c01(n1 / Math.max(1, e.n1Max));
    var u = c01((n1 - e.n1Idle) / Math.max(1, e.n1Max - e.n1Idle));
    // 停车 → 完全静音; 运转中 → 规范要求的陡峭 SPL 曲线
    var spl = running ? (0.05 + 0.95 * Math.pow(n1norm, 2.2)) : 0;
    var egtN = c01((egt - e.egtIdle) / Math.max(1, e.egtMax - e.egtIdle));

    /* 风扇基频: 慢车 ~60 Hz → 100% ~430 Hz, 随风扇直径反比缩放 */
    var f0 = (60 + 370 * u) * prof.fanScale;
    if (!isFinite(f0)) f0 = 60;

    var tc = 0.055;
    for (var i = 0; i < v.fanOsc.length; i++) {
      var fo = v.fanOsc[i];
      var f = f0 * fo.ratio * beat;
      ramp(fo.osc.frequency, clampr(f, 12, 12000), i === 2 ? tc * 2 : tc);
    }
    ramp(v.fanBP.frequency, clampr(f0 * 1.05, 30, 16000), tc);
    ramp(v.fanBP.Q, lerpn(7.5, 4.5, u), 0.3);
    ramp(v.fanGain.gain, spl * prof.whine * 0.30 * (0.35 + 0.65 * smoothstep(u * 1.4)), tc);
    ramp(v.fanBody.gain, spl * prof.fanRumble * 0.10, tc * 2);

    /* buzzsaw: 高 N1 才出现 */
    var buzzAmt = Math.pow(u, 3.0) * spl;
    for (var b = 0; b < v.buzzOsc.length; b++) {
      ramp(v.buzzOsc[b].osc.frequency, clampr(f0 * v.buzzOsc[b].mult * beat, 20, 16000), tc);
    }
    ramp(v.buzzHP.frequency, clampr(f0 * 1.8, 200, 16000), 0.12);
    ramp(v.buzzGain.gain, buzzAmt * prof.buzz * 0.22, tc);

    /* 核心轰鸣: 截止频率与增益随 N1 陡升 */
    var coreF = 120 + 1600 * Math.pow(u, 1.15);
    ramp(v.coreLP.frequency, clampr(coreF, 60, 9000), 0.08);
    ramp(v.coreLP.Q, lerpn(0.8, 1.5, u), 0.2);
    ramp(v.corePeak.frequency, clampr(200 + 320 * u, 120, 900), 0.15);
    ramp(v.corePeak.gain, lerpn(6, 12, egtN), 0.2);
    var coreLevel = spl * prof.core * (0.42 + 0.18 * egtN);
    ramp(v.coreGain.gain, coreLevel, tc);
    ramp(v.rumbleFilter.frequency, clampr(90 + 180 * u, 50, 500), 0.12);
    ramp(v.rumbleBody.gain, spl * prof.fanRumble * 0.34, tc);

    /* 排气嘶嘶: 约 70% N1 以上显著 */
    ramp(v.hissHP.frequency, clampr(1400 + 2600 * u, 600, 12000), 0.12);
    ramp(v.hissGain.gain, spl * prof.hiss * smoothstep((u - 0.62) / 0.38) * 0.17, tc);

    /* 燃烧脉动: 18~55 Hz */
    var pf = 18 + 37 * u;
    ramp(v.rumbleOsc.frequency, clampr(pf, 6, 120), 0.15);
    ramp(v.rumbleAmp.gain, spl * prof.rumble * 0.26, tc);
    ramp(v.rumbleMod.gain, spl * coreLevel * (0.18 + 0.30 * u), 0.1);

    /* 座舱内略微降低高频 (由 engMuffle 统一处理) */
  }

  function update(dt, state) {
    if (!_ready || !ctx) return;
    try {
      dt = clampr(fin(dt, 0.016), 0, 0.25);
      state = state || {};
      if (!prof) prof = defaultProfile();

      var cockpit = (state.cockpit !== undefined) ? !!state.cockpit : !!_env.cockpit;
      var onGround = (state.onGround !== undefined) ? !!state.onGround : !!_env.onGround;
      var rain = c01(Math.max(fin(state.rain, 0), fin(_env.rain, 0)));
      var turb = c01(state.turbulence);
      var windBed = c01(Math.max(fin(_env.wind, 0), fin(state.windSpeedKt, 0) / 70));
      var apuRunning = !!state.apuRunning;

      /* 平滑输入量, 避免突变 */
      _ias = smoothTo(_ias, Math.max(0, fin(state.iasKt, 0)), 0.18, dt);
      var machIn = (state.mach !== undefined) ? state.mach : state.machNumber;
      _mach = smoothTo(_mach, Math.max(0, fin(machIn, 0)), 0.25, dt);
      _gs = smoothTo(_gs, Math.max(0, fin(state.gsKt, 0)), 0.15, dt);
      _alt = smoothTo(_alt, fin(state.altFt, 0), 0.6, dt);

      var gearPos = c01(state.gearPos);
      var flapPos = c01(state.flapPos);
      var spoilPos = c01(state.spoilerPos);
      var revPos = c01(state.reverserPos);

      /* ---------- 引擎 ---------- */
      var running = (state.engineRunning === undefined) ? true : !!state.engineRunning;
      var n1L = running ? Math.max(0, fin(state.n1L, 0)) : 0;
      var n1R = running ? Math.max(0, fin(state.n1R, 0)) : 0;
      var egtL = fin(state.egtL, prof.eng.egtIdle);
      var egtR = fin(state.egtR, prof.eng.egtIdle);

      /* 双发轻微转速差 → 拍频 */
      _beatPhase += dt * 0.31;
      var beatL = 1 + 0.0011 * Math.sin(_beatPhase * 1.7);
      var beatR = 1.0058 + 0.0014 * Math.sin(_beatPhase * 2.3 + 1.1);

      var nEng = prof.eng.count;
      updateEngine(engVoice[0], n1L, egtL, dt, beatL, running && nEng >= 1);
      updateEngine(engVoice[1], n1R, egtR, dt, beatR, running && nEng >= 2);

      /* 座舱隔音: 外部噪声低通 + 衰减 */
      ramp(engMuffle.frequency, cockpit ? 1050 : 17500, 0.25);
      ramp(engMuffle.Q, cockpit ? 0.9 : 0.35, 0.25);
      ramp(engExtGain.gain, cockpit ? 0.62 : 1.0, 0.25);

      /* ---------- 气动 / 风 ---------- */
      var v = _ias;
      var airG = Math.pow(c01(v / 340), 1.7) * 0.30;
      airG += windBed * windBed * 0.10;
      airG *= lerpn(1.0, 0.82, c01(_alt / 40000));    // 高空空气稀薄, 风噪略减
      ramp(airVoice.gain.gain, airG, 0.15);
      ramp(airVoice.lp.frequency, clampr(220 + v * 3.4, 180, 3200), 0.15);

      var hissG = smoothstep((v - 235) / 190) * 0.17 + c01(turb) * 0.02;
      ramp(airVoice.hiss.gain, hissG, 0.15);
      ramp(airVoice.bp.frequency, clampr(4200 + v * 6, 3000, 9500), 0.2);

      /* 抖振: 马赫数逼近临界马赫 */
      var mcrit = prof.machCrit;
      var buffetAmt = c01((_mach - mcrit + 0.03) / 0.09);
      ramp(airVoice.buffet.gain, buffetAmt * buffetAmt * 0.20 + c01(turb) * 0.012, 0.12);
      ramp(airVoice.buffetLP.frequency, clampr(70 + 40 * buffetAmt, 50, 200), 0.2);

      /* 阵风: 湍流驱动 */
      ramp(airVoice.gustDepth.gain, c01(turb) * 0.07 + windBed * 0.02, 0.4);

      /* 座舱内气动噪声略降 */
      ramp(busAir.gain, cockpit ? 0.68 : 1.0, 0.25);

      /* ---------- 地面滑跑 ---------- */
      var gndG = onGround ? c01(_gs / 130) * 0.22 : 0;
      ramp(gndVoice.gain.gain, gndG, 0.15);
      ramp(gndVoice.lp.frequency, clampr(60 + _gs * 2.6, 45, 700), 0.15);
      ramp(gndVoice.peak.frequency, clampr(55 + _gs * 1.4, 40, 320), 0.2);

      /* 触地自动检测 (事件驱动, 只在跳变的那一帧创建节点) */
      if (onGround && !_prevOnGround && !_firstFrame) {
        var tdg = 0.75 + c01(turb) * 0.2;
        autoCue('touchdown', { gain: tdg });
      }
      _prevOnGround = onGround;

      /* ---------- 反推 ---------- */
      var revN1 = c01(Math.max(n1L, n1R) / Math.max(1, prof.eng.n1Max));
      var revAmt = revPos * (0.25 + 0.75 * revN1);
      ramp(revVoice.gain.gain, revAmt * 0.34, 0.08);
      ramp(revVoice.lp.frequency, clampr(260 + 500 * revN1, 150, 1400), 0.1);
      ramp(revVoice.howlGain.gain, revAmt * 0.16, 0.08);
      ramp(revVoice.howl.frequency, clampr((55 + 70 * revN1) * prof.fanScale, 30, 400), 0.1);
      ramp(revVoice.wobDepth.gain, revAmt > 0.02 ? 260 : 0, 0.2);

      /* ---------- 作动筒 (由位置变化自动驱动) ---------- */
      var dFlap = Math.abs(flapPos - _prevFlap);
      var dGear = Math.abs(gearPos - _prevGear);
      if (!_firstFrame) {
        if (dFlap > 0.0004) startActuator('flap');
        if (dGear > 0.0004) startActuator('gear');
      }
      _prevFlap = flapPos; _prevGear = gearPos;

      // 减速板: 快速展开时触发液压声 (带冷却)
      _sbCool = Math.max(0, _sbCool - dt);
      if (spoilPos - _prevSpoiler > 0.06 && _sbCool <= 0 && !_firstFrame) {
        autoCue('speedbrake', { gain: 0.9 });
        _sbCool = 1.6;
      }
      _prevSpoiler = spoilPos;
      _firstFrame = false;

      // 作动筒电机: 位置停稳后延时关闭
      var key;
      for (key in act) {
        if (!act.hasOwnProperty(key)) continue;
        var a = act[key];
        if (a.on) {
          a.hold -= dt;
          if (a.hold <= 0) stopActuator(key);
        }
      }

      /* ---------- APU ---------- */
      ramp(apuVoice.gain.gain, apuRunning ? 0.055 : 0, 0.5);
      ramp(apuVoice.nGain.gain, apuRunning ? 0.05 : 0, 0.5);

      /* ---------- 雨 / 雷 ---------- */
      ramp(rainVoice.gain.gain, rain * rain * 0.30 + rain * 0.06, 0.6);
      ramp(rainMuffle.frequency, cockpit ? 5200 : 17000, 0.3);
      ramp(busRain.gain, cockpit ? 0.8 : 1.0, 0.3);
      _thunderTimer -= dt;
      if (_env.thunder && rain > 0.25 && _thunderTimer <= 0) {
        _thunderTimer = rnd(4.5, 15);
        // 相对听者生成, 避免飞机远离世界原点时雷声消失
        autoCue('thunder', {
          gain: rnd(0.7, 1.0), ref: 420,
          pos: {
            x: _lisPos.x + rnd(-500, 500),
            y: _lisPos.y + rnd(120, 600),
            z: _lisPos.z + rnd(-350, 700)
          }
        });
      } else if (_thunderTimer < 0) {
        _thunderTimer = rnd(3, 9);
      }

      /* ---------- 座舱 ---------- */
      var cabin = c01(Math.max(_cabinReq, cockpit ? 0.35 : 0));
      ramp(cabinVoice.hum.gain, cabin * 0.10, 0.5);
      ramp(cabinVoice.body.gain, cabin * (0.03 + 0.02 * c01(_mach / 0.85)), 0.5);
      ramp(cabinVoice.crowd.gain, cabin * cabin * 0.035, 0.8);
      ramp(cabinVoice.fanGain.gain, cockpit ? cabin * 0.075 : 0, 0.4);
      ramp(cabinVoice.fanWhineGain.gain, cockpit ? cabin * 0.022 : 0, 0.4);
      ramp(cabinVoice.bodyOsc.osc.frequency, 84 + 10 * c01(_mach), 0.6);

      /* ---------- 静音闸门 ---------- */
      ramp(killGain.gain, _silenced ? 0 : 1, 0.08);
    } catch (e) {
      // 任何异常都不应影响主循环
    }
  }

  /* ---------------------------------------------------------------------
     12. 总线与主链构建
     --------------------------------------------------------------------- */
  function buildGraph() {
    busSum = gainNode(1);
    killGain = gainNode(1);
    comp = ctx.createDynamicsCompressor();
    // 安全限幅式压缩: 正常音量基本不受影响, 只在峰值处压住, 绝不削波
    comp.threshold.value = -8;
    comp.knee.value = 8;
    comp.ratio.value = 10;
    comp.attack.value = 0.003;
    comp.release.value = 0.18;
    masterGain = gainNode(0.0001);

    // 软限幅: 任何情况下输出都不会超过 ±0.92
    sanity = ctx.createWaveShaper();
    var n = 2048, curve = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = (i * 2) / (n - 1) - 1;
      var ax = x < 0 ? -x : x;
      if (ax <= 0.55) {
        curve[i] = x;                       // 正常信号完全线性通过
      } else {
        var sg = x < 0 ? -1 : 1;
        curve[i] = sg * (0.55 + 0.37 * tanhA((ax - 0.55) / 0.37));
      }
    }
    sanity.curve = curve;
    sanity.oversample = '2x';

    busSum.connect(killGain);
    killGain.connect(comp);
    comp.connect(masterGain);
    masterGain.connect(sanity);
    sanity.connect(ctx.destination);

    busEng = gainNode(1);
    engExtGain = gainNode(1);
    engMuffle = biquad('lowpass', 17500, 0.35);
    busEng.connect(engExtGain);
    engExtGain.connect(engMuffle);
    engMuffle.connect(busSum);

    busAir = gainNode(1);
    busAir.connect(busSum);

    busRain = gainNode(1);
    rainMuffle = biquad('lowpass', 17000, 0.5);
    busRain.connect(rainMuffle);
    rainMuffle.connect(busSum);

    busCabin = gainNode(1);
    busCabin.connect(busSum);

    // 提示音总线 (驾驶舱内部音响, 不受隔音滤波影响)
    busCue = gainNode(1);
    busCue.connect(busSum);

    // HRTF 定位总线 (用于带 pos 的一次性提示音)
    cuePannerIn = gainNode(1);
    cuePanner = ctx.createPanner();
    cuePanner.panningModel = 'HRTF';
    cuePanner.distanceModel = 'inverse';
    cuePanner.refDistance = 25;
    cuePanner.maxDistance = 1200;
    cuePanner.rolloffFactor = 1.1;
    if (cuePanner.positionX) {
      cuePanner.positionX.value = 0; cuePanner.positionY.value = 0; cuePanner.positionZ.value = 0;
    } else if (cuePanner.setPosition) {
      cuePanner.setPosition(0, 0, 0);
    }
    cuePannerIn.connect(cuePanner);
    cuePanner.connect(busCue);
  }

  /* 监听者 (听者) 参数设置, 兼容新旧 API */
  function applyListenerPos(pos) {
    if (!ctx || !ctx.listener) return;
    var L = ctx.listener;
    var x = fin(pos.x, 0), y = fin(pos.y, 0), z = fin(pos.z, 0);
    if (L.positionX) {
      ramp(L.positionX, x, 0.02);
      ramp(L.positionY, y, 0.02);
      ramp(L.positionZ, z, 0.02);
    } else if (L.setPosition) {
      try { L.setPosition(x, y, z); } catch (e) { }
    }
  }

  function applyListenerOrientation(fwd, up) {
    if (!ctx || !ctx.listener) return;
    var L = ctx.listener;
    var fx = fin(fwd.x, 0), fy = fin(fwd.y, 0), fz = fin(fwd.z, -1);
    var ux = fin(up.x, 0), uy = fin(up.y, 1), uz = fin(up.z, 0);
    // 归一化, 防止非法向量
    var fl = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
    fx /= fl; fy /= fl; fz /= fl;
    var ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
    ux /= ul; uy /= ul; uz /= ul;
    if (L.forwardX) {
      ramp(L.forwardX, fx, 0.02); ramp(L.forwardY, fy, 0.02); ramp(L.forwardZ, fz, 0.02);
      ramp(L.upX, ux, 0.02); ramp(L.upY, uy, 0.02); ramp(L.upZ, uz, 0.02);
    } else if (L.setOrientation) {
      try { L.setOrientation(fx, fy, fz, ux, uy, uz); } catch (e) { }
    }
  }

  /* 主音量应用 */
  function applyVolume() {
    if (!masterGain) return;
    var v = _muted ? 0 : Math.pow(c01(_vol), 1.5);
    ramp(masterGain.gain, clampr(v, 0, 1), 0.05);
  }

  /* ---------------------------------------------------------------------
     13. 公共 API
     --------------------------------------------------------------------- */
  var Audio = {
    available: false,
    ctx: null,
    master: null,

    /** 必须由用户手势触发; 可重复调用; 返回是否可用 */
    init: function () {
      if (_ready && ctx) {
        // 幂等: 已初始化则仅尝试恢复上下文
        try { if (ctx.state === 'suspended' && ctx.resume) ctx.resume(); } catch (e) { }
        return true;
      }
      try {
        var AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) {
          FS.Log.warn('audio.js: 当前环境不支持 Web Audio, 音频已禁用');
          Audio.available = false;
          return false;
        }
        ctx = new AC();
        if (!ctx || !ctx.createGain) {
          ctx = null;
          Audio.available = false;
          return false;
        }

        buildBuffers();
        buildGraph();

        // 常驻声部
        engVoice[0] = createEngineVoice(-0.55);
        engVoice[1] = createEngineVoice(0.55);
        airVoice = createAirVoice();
        gndVoice = createGroundVoice();
        rainVoice = createRainVoice();
        cabinVoice = createCabinVoice();
        revVoice = createReverserVoice();
        apuVoice = createApuVoice();
        act.flap = createActuator(310, 0.05);
        act.gear = createActuator(185, 0.10);
        loops.mw = createMasterWarning();
        loops.stall = createStall();
        loops.fire = createFireBell();
        loops.ap = createApDisconnect();

        // 机型音色
        prof = defaultProfile();
        if (_pendingType) {
          var t = _pendingType;
          _pendingType = null;
          Audio.loadAircraft(t);
        }

        // 初值
        applyVolume();
        _silenced = false;
        ramp(killGain.gain, 1, 0.05);

        _ready = true;
        Audio.available = true;
        Audio.ctx = ctx;
        Audio.master = masterGain;

        try { if (ctx.state === 'suspended' && ctx.resume) ctx.resume(); } catch (e2) { }

        if (_srcCount > MAX_PERSISTENT_SRC) {
          FS.Log.warn('audio.js: 常驻音源数量 ' + _srcCount + ' 超出预算 ' + MAX_PERSISTENT_SRC);
        }
        FS.Log.info('音频引擎已初始化 (采样率 ' + ctx.sampleRate + ' Hz, 常驻音源 ' + _srcCount + ' 个)');
        return true;
      } catch (e) {
        try { if (ctx && ctx.close) ctx.close(); } catch (e3) { }
        ctx = null; _ready = false;
        Audio.available = false; Audio.ctx = null; Audio.master = null;
        FS.Log.warn('audio.js: 音频初始化失败, 已静默降级 — ' + (e && e.message ? e.message : e));
        return false;
      }
    },

    resume: function () {
      _silenced = false;
      if (!ctx) return;
      try {
        if (ctx.resume) {
          var p = ctx.resume();
          if (p && p.catch) p.catch(function () { });
        }
      } catch (e) { }
      if (killGain) ramp(killGain.gain, 1, 0.08);
    },

    suspend: function () {
      if (!ctx) return;
      try {
        if (ctx.suspend) {
          var p = ctx.suspend();
          if (p && p.catch) p.catch(function () { });
        }
      } catch (e) { }
    },

    setMasterVolume: function (v0to1) {
      _vol = c01(v0to1);
      applyVolume();
    },

    getMasterVolume: function () { return _vol; },

    setMuted: function (bool) {
      _muted = !!bool;
      applyVolume();
    },

    /** 每帧调用 */
    update: function (dt, state) { update(dt, state); },

    /** 设置听者位置/朝向 (世界坐标, 米) */
    setListener: function (pos, fwd, up) {
      if (!_ready || !ctx) return;
      try {
        if (pos) { applyListenerPos(pos); _lisPos.x = fin(pos.x, 0); _lisPos.y = fin(pos.y, 0); _lisPos.z = fin(pos.z, 0); }
        if (fwd || up) {
          applyListenerOrientation(fwd || { x: 0, y: 0, z: -1 }, up || { x: 0, y: 1, z: 0 });
        }
      } catch (e) { }
    },

    /** 切换机型时调用 */
    loadAircraft: function (typeKey) {
      try {
        var DB = FS.AIRCRAFT_DB;
        var db = DB ? DB[typeKey] : null;
        if (!db || !db.engines) {
          if (typeKey) FS.Log.warn('audio.js: 未找到机型音色 ' + typeKey + ', 使用默认音色');
          prof = defaultProfile();
        } else {
          var mc = (db._aero && db._aero.machCrit) ? db._aero.machCrit : 0.78;
          prof = buildProfile(db.engines, mc, typeKey);
        }
        if (!_ready) { _pendingType = typeKey; return; }
        // 按发动机数量调整声像与启用状态
        var cnt = prof.eng.count;
        if (engVoice[0]) ramp(engVoice[0].pan.pan ? engVoice[0].pan.pan : null, cnt >= 2 ? -0.55 : -0.12, 0.3);
        if (engVoice[1]) ramp(engVoice[1].pan.pan ? engVoice[1].pan.pan : null, 0.55, 0.3);
        if (revVoice) ramp(revVoice.wobDepth.gain, 0, 0.1);
        FS.Log.info('音频音色已加载: ' + prof.key + ' (' + prof.eng.model +
          ', 涵道比 ' + prof.eng.bypass + ', 风扇 ' + prof.eng.fanDiameter + ' m)');
      } catch (e) {
        prof = defaultProfile();
      }
    },

    /** 一次性提示音; 未知名称静默忽略 */
    playCue: function (name, opts) {
      if (!_ready) return;
      if (typeof name !== 'string') return;
      dispatchCue(name, opts);
    },

    /** 连续环境声床 */
    setEnvironment: function (env) {
      env = env || {};
      try {
        if (env.rain !== undefined) _env.rain = c01(env.rain);
        if (env.wind !== undefined) _env.wind = c01(env.wind);
        if (env.thunder !== undefined) {
          var was = _env.thunder;
          _env.thunder = !!env.thunder;
          if (_env.thunder && !was) _thunderTimer = rnd(0.8, 3.5);
        }
        if (env.onGround !== undefined) _env.onGround = !!env.onGround;
        if (env.cockpit !== undefined) _env.cockpit = !!env.cockpit;
      } catch (e) { }
    },

    /** 客舱环境声 0..1 */
    setCabinAmbience: function (v0to1) { _cabinReq = c01(v0to1); },

    /** 停止全部声音 (保留 AudioContext) */
    stop: function () {
      if (!_ready) return;
      _silenced = true;
      try {
        stopAllLoops();
        stopActuator('flap');
        stopActuator('gear');
        ramp(killGain.gain, 0, 0.06);
      } catch (e) { }
    },

    /** 彻底释放 (可再次 init) */
    dispose: function () {
      try {
        stopAllLoops();
        stopActuator('flap');
        stopActuator('gear');
        if (killGain) ramp(killGain.gain, 0, 0.03);
      } catch (e) { }
      var c = ctx;
      _ready = false;
      _silenced = true;
      ctx = null;
      Audio.ctx = null;
      Audio.master = null;
      Audio.available = false;
      engVoice = [null, null];
      airVoice = gndVoice = rainVoice = cabinVoice = revVoice = apuVoice = null;
      act.flap = act.gear = null;
      loops.mw = loops.stall = loops.fire = loops.ap = null;
      whiteBuf = pinkBuf = null;
      _srcCount = 0;
      try {
        if (sanity) sanity.disconnect();
        if (masterGain) masterGain.disconnect();
        if (comp) comp.disconnect();
        if (killGain) killGain.disconnect();
        if (busSum) busSum.disconnect();
        if (busEng) busEng.disconnect();
        if (busAir) busAir.disconnect();
        if (busRain) busRain.disconnect();
        if (busCabin) busCabin.disconnect();
        if (busCue) busCue.disconnect();
      } catch (e2) { }
      try { if (c && c.close) { var p = c.close(); if (p && p.catch) p.catch(function () { }); } } catch (e3) { }
      busSum = killGain = comp = masterGain = sanity = null;
      busEng = busAir = busRain = busCabin = busCue = null;
      engExtGain = engMuffle = rainMuffle = cuePanner = cuePannerIn = null;
      FS.Log.info('音频引擎已释放');
    }
  };

  FS.Audio = Audio;

  FS.Log.info('audio.js 已加载 — Web Audio 实时合成音频引擎就绪 (含 ' +
    Object.keys(CUES).length + ' 种提示音)');
})(typeof window !== 'undefined' ? window : globalThis);
