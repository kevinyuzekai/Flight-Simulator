/* ==========================================================================
   SkyRoute 0.6.1 —— 驾驶舱告警声 (全部 WebAudio 合成 + 系统自带语音合成, 无音频文件)
   · 主警告 MASTER WARNING: 空客 CRC 连续谐音 / 波音 火警铃; 按主警告灯 (或 Shift+M) 消音
   · 主警戒 MASTER CAUTION: 单谐音, 灯亮至按下
   · 超速: 波音 响板 (持续到速度恢复, 不可消音); 空客 CRC + 主警告
   · 起飞形态警告: 地面推油门而襟翼未放 → 警告 + "CONFIG"/"TAKEOFF CONFIG"
   · GPWS 语音: TERRAIN / PULL UP / SINK RATE / DON'T SINK / TOO LOW GEAR / TOO LOW FLAPS /
     BANK ANGLE / GLIDESLOPE / 无线电高度报数 / RETARD (空客); 无语音合成时退回原合成提示音
   · 自动驾驶断开 "骑兵号": 已在 autopilot.js 中循环播放直到再次按断开钮确认
   ========================================================================== */
(function (global) {
  'use strict';
  var FS = global.FS = global.FS || {};
  var SS = global.speechSynthesis, voice = null, lastPri = 0, speakingUntil = 0;
  function pickVoice() {
    if (!SS || !SS.getVoices) return;
    var v = SS.getVoices() || [], best = null;
    for (var i = 0; i < v.length; i++) {
      if (!/^en/i.test(v[i].lang)) continue;
      if (!best || /David|Mark|Male|Guy/i.test(v[i].name)) best = v[i];
      if (v[i].localService && /David|Mark/i.test(v[i].name)) { best = v[i]; break; }
    }
    voice = best;
  }
  if (SS) { try { pickVoice(); SS.onvoiceschanged = pickVoice; } catch (e) { SS = null; } }

  var A = {
    lamps: { mw: false, mc: false },
    _act: {}, _ack: {}, _mcAck: true, _osT: 0, _wasOnGround: true, _toPhase: false, _cfgOn: false,
    maker: function () { var s = FS.sim; return s && s.cockpit3d && s.cockpit3d.L && s.cockpit3d.L.maker === 'boeing' ? 'boeing' : 'airbus'; },
    canSpeak: function () { return !!(SS && global.SpeechSynthesisUtterance); },
    vol: function () { try { var a = FS.Audio; if (a && a.getMasterVolume) return a.isMuted && a.isMuted() ? 0 : a.getMasterVolume(); } catch (e) { } return 0.8; },
    /** 语音喊话; pri 越高越优先 (PULL UP 5 > TERRAIN 4 > 其他 2 > 报数 1) */
    say: function (text, pri, fallbackCue) {
      pri = pri || 1;
      var now = Date.now();
      if (!this.canSpeak()) { if (fallbackCue && FS.Audio) FS.Audio.playCue(fallbackCue); return false; }
      try {
        if (now < speakingUntil) { if (pri <= lastPri) return false; SS.cancel(); }
        var u = new global.SpeechSynthesisUtterance(text);
        if (voice) u.voice = voice;
        u.lang = 'en-US'; u.rate = 1.12; u.pitch = 0.55; u.volume = Math.max(0, Math.min(1, this.vol()));
        SS.speak(u);
        lastPri = pri; speakingUntil = now + 250 + text.length * 70;
        return true;
      } catch (e) { if (fallbackCue && FS.Audio) FS.Audio.playCue(fallbackCue); return false; }
    },
    /** 确认 (按主警告 / 主警戒灯) */
    ack: function () {
      var k; for (k in this._act) if (this._act[k]) this._ack[k] = true;
      this._mcAck = true;
      if (FS.Audio) { FS.Audio.playCue('master_warning_stop'); FS.Audio.playCue('fire_loop_stop'); }
      try { var ap = FS.sim && FS.sim.ap; if (ap && ap.silenceDisconnectWarning) ap.silenceDisconnectWarning(); } catch (e) { }
      this._refresh();
    },
    caution: function () { this._mcAck = false; if (FS.Audio) FS.Audio.playCue('master_caution'); this._refresh(); },
    _refresh: function () {
      var any = false, snd = false, fire = false, k;
      for (k in this._act) if (this._act[k] && !this._ack[k]) { any = true; if (k === 'fire') fire = true; else if (!(k === 'os' && this.maker() === 'boeing')) snd = true; }
      this.lamps.mw = any; this.lamps.mc = !this._mcAck;
      var Au = FS.Audio; if (!Au) return;
      var boeing = this.maker() === 'boeing';
      var wantFire = fire && boeing, wantMw = snd || (fire && !boeing);
      if (wantMw !== !!this._mwSnd) { Au.playCue(wantMw ? 'master_warning_start' : 'master_warning_stop'); this._mwSnd = wantMw; }
      if (wantFire !== !!this._fireSnd) { Au.playCue(wantFire ? 'fire_loop' : 'fire_loop_stop'); this._fireSnd = wantFire; }
    },
    _set: function (k, on) {
      on = !!on;
      if (on === !!this._act[k]) return;
      this._act[k] = on; if (!on) this._ack[k] = false;
      this._refresh();
    },
    /** 每帧调用 */
    update: function (dt, st) {
      if (!st) return;
      var boeing = this.maker() === 'boeing';
      var fire = false; (st.engines || []).forEach(function (e) { if (e && e.fire) fire = true; });
      this._set('fire', fire);
      var os = !!(st.overspeed || st.machOverspeed);
      this._set('os', os);
      if (os && boeing) { this._osT -= dt; if (this._osT <= 0) { this._osT = 0.5; if (FS.Audio) FS.Audio.playCue('overspeed'); } } else this._osT = 0;
      var cfg = !!st.configWarning && st.onGround;
      if (cfg && !this._cfgOn) this.say(boeing ? 'takeoff configuration' : 'config', 3);
      this._cfgOn = cfg; this._set('cfg', cfg);
      if (st.stallWarning && !this._stall && !boeing) this.say('stall, stall', 6);
      this._stall = !!st.stallWarning;
    }
  };
  FS.Alerts = A;
  if (FS.Bus && FS.Bus.on) { FS.Bus.on('warning:lowFuel', function () { A.caution(); }); FS.Bus.on('fm:hardLanding', function () { A.caution(); }); }
})(typeof window !== 'undefined' ? window : this);
