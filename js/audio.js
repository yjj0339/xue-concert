/* audio.js — WebAudio 程序化配乐：128 BPM 节拍时钟同步鼓组/贝斯/Pad 和弦/人群欢呼/烟花爆点（343m/s 距离延迟），零音频文件 */
(function () {
'use strict';
window.KOB_FILE_BUILD = '20261023.1';
window.KOB.report('kob-audio');

window.KOB.onReady(function (ctx) {
  var P = ctx.params, SHOW = ctx.show;
  var AC = null, master = null, noiseBuf = null;
  var on = false, started = false;
  var crowdGain = null;

  function init() {
    if (AC) return true;
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return false; }
    master = AC.createGain();
    master.gain.value = P.volume;
    var comp = AC.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 5;
    master.connect(comp); comp.connect(AC.destination);
    /* 噪声缓冲 */
    var len = AC.sampleRate * 2;
    noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    /* 人群底噪 */
    var src = AC.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    var lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 620; lp.Q.value = 0.4;
    var bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.35;
    crowdGain = AC.createGain(); crowdGain.gain.value = 0.0;
    src.connect(lp); lp.connect(bp); bp.connect(crowdGain); crowdGain.connect(master);
    src.start();
    return true;
  }

  function env(g, t0, a, peak, d, sustain) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t0 + a + d);
  }

  function kick(t) {
    var o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.13);
    env(g, t, 0.004, 0.95, 0.22);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.3);
    /* 击打瞬态 */
    var n = AC.createBufferSource(); n.buffer = noiseBuf;
    var hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200;
    var ng = AC.createGain();
    env(ng, t, 0.001, 0.18, 0.03);
    n.connect(hp); hp.connect(ng); ng.connect(master);
    n.start(t); n.stop(t + 0.05);
  }
  function snare(t) {
    var n = AC.createBufferSource(); n.buffer = noiseBuf;
    var bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.7;
    var g = AC.createGain();
    env(g, t, 0.002, 0.4, 0.14);
    n.connect(bp); bp.connect(g); g.connect(master);
    n.start(t); n.stop(t + 0.2);
  }
  function hat(t, open) {
    var n = AC.createBufferSource(); n.buffer = noiseBuf;
    n.playbackRate.value = 1.6;
    var hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7200;
    var g = AC.createGain();
    env(g, t, 0.001, open ? 0.14 : 0.08, open ? 0.16 : 0.045);
    n.connect(hp); hp.connect(g); g.connect(master);
    n.start(t); n.stop(t + 0.25);
  }
  var BASS_NOTES = { A: 55, F: 43.65, C: 65.41, G: 49 };
  function bass(t, freq, dur) {
    var o = AC.createOscillator(), o2 = AC.createOscillator(), g = AC.createGain(), lp = AC.createBiquadFilter();
    o.type = 'sawtooth'; o2.type = 'square';
    o.frequency.value = freq; o2.frequency.value = freq * 0.5;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(320, t);
    lp.frequency.exponentialRampToValueAtTime(90, t + dur);
    env(g, t, 0.01, 0.34, dur);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master);
    o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }
  var CHORDS = [
    [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 261.6, 329.6], [196, 246.9, 293.7]
  ]; // Am F C G
  function pad(t, chord, dur) {
    chord.forEach(function (f, i) {
      for (var d2 = 0; d2 < 2; d2++) {
        var o = AC.createOscillator(), g = AC.createGain(), lp = AC.createBiquadFilter();
        o.type = 'sawtooth';
        o.frequency.value = f * (d2 ? 1.004 : 0.997);
        lp.type = 'lowpass'; lp.frequency.value = 900;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.05, t + dur * 0.4);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(lp); lp.connect(g); g.connect(master);
        o.start(t + i * 0.01); o.stop(t + dur + 0.1);
      }
    });
  }
  function cheer(t, k) {
    var n = AC.createBufferSource(); n.buffer = noiseBuf;
    n.playbackRate.value = 0.9 + Math.random() * 0.3;
    var bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.3;
    var g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.3 * k, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    n.connect(bp); bp.connect(g); g.connect(master);
    n.start(t); n.stop(t + 1.8);
  }

  /* ---- 事件（供特效调用） ---- */
  function boomDelay(pos) {
    var cam = ctx.camera;
    if (!cam) return 0;
    return Math.min(2.2, cam.position.distanceTo(pos) / 343);
  }
  function boom(pos, size) {
    if (!on || !AC) return;
    var t = AC.currentTime + boomDelay(pos);
    var n = AC.createBufferSource(); n.buffer = noiseBuf;
    var lp = AC.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(120, t + 0.5);
    var g = AC.createGain();
    env(g, t, 0.004, 0.5 * Math.min(1.4, size), 0.55);
    n.connect(lp); lp.connect(g); g.connect(master);
    n.start(t); n.stop(t + 0.8);
    var o = AC.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(36, t + 0.3);
    var og = AC.createGain();
    env(og, t, 0.005, 0.4 * size, 0.4);
    o.connect(og); og.connect(master);
    o.start(t); o.stop(t + 0.5);
  }
  function click() {
    if (!on || !AC) return;
    var t = AC.currentTime;
    var n = AC.createBufferSource(); n.buffer = noiseBuf;
    var hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
    var g = AC.createGain(); env(g, t, 0.001, 0.12, 0.03);
    n.connect(hp); hp.connect(g); g.connect(master);
    n.start(t); n.stop(t + 0.05);
  }
  function psst() {
    if (!on || !AC) return;
    var t = AC.currentTime;
    var n = AC.createBufferSource(); n.buffer = noiseBuf;
    var hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
    var g = AC.createGain(); env(g, t, 0.02, 0.22, 0.5);
    n.connect(hp); hp.connect(g); g.connect(master);
    n.start(t); n.stop(t + 0.7);
  }
  function thump() {
    if (!on || !AC) return;
    var t = AC.currentTime;
    kick(t); snare(t);
  }

  /* ---- 节拍调度（按演出时钟） ---- */
  var BEAT = SHOW.BEAT;
  var nextBeat = 0;         // 演出时刻（秒）的下一拍
  var lastShowT = -1;
  function chapterIntens(t) {
    var n = SHOW.chapterAt(t) + 1;
    if (n <= 1) return 0.25;
    if (n === 2) return 0.45;
    if (n === 3) return 0.6;
    if (n <= 5) return 0.85;
    if (n <= 7) return 1.0;
    if (n <= 9) return 1.2;
    return 0.4;
  }
  function scheduleBeat(bt, rt) {
    /* bt = 演出时刻该拍的起点；rt = AudioContext 真实时刻 */
    var bar = Math.floor(bt / SHOW.BAR);
    var beatInBar = Math.floor(bt / BEAT) % 4;
    var inten = chapterIntens(bt);
    var chN = SHOW.chapterAt(bt) + 1;
    if (crowdGain) {
      var ctgt = 0.018 + inten * 0.05;
      crowdGain.gain.setTargetAtTime(Math.min(0.12, ctgt), rt, 0.4);
    }
    if (chN >= 3 && beatInBar === 0) kick(rt);
    if (chN >= 4 && inten >= 0.85) kick(rt);
    if (chN >= 4 && (beatInBar === 1 || beatInBar === 3)) snare(rt);
    if (chN >= 6 && inten >= 1) { hat(rt, beatInBar % 2 === 1); hat(rt + BEAT * 0.5 * 0.999, false); }
    var roots = [110, 87.31, 130.81, 98];
    if (chN >= 4) bass(rt, roots[bar % 4] / 2, BEAT * 0.9);
    if (beatInBar === 0 && bar % 2 === 0) pad(rt, CHORDS[bar % 4], SHOW.BAR * 2);
    /* 章节转换欢呼 */
    var chStart = SHOW.CHAPTERS[SHOW.chapterAt(bt)].t0;
    if (Math.abs(bt - chStart) < BEAT * 0.6 && chN >= 2) cheer(rt, 0.8 + inten * 0.3);
  }

  function update(showTime, speed, running) {
    if (!on || !AC) return;
    if (AC.state === 'suspended') { AC.resume(); }
    if (lastShowT < 0) { lastShowT = showTime; nextBeat = Math.ceil(showTime / BEAT) * BEAT; }
    var dShow = showTime - lastShowT;
    lastShowT = showTime;
    if (!running || dShow <= 0) { nextBeat = Math.ceil(showTime / BEAT) * BEAT; return; }
    var guard = 0;
    while (nextBeat <= showTime && guard++ < 64) {
      var rt = AC.currentTime + Math.max(0, (nextBeat - showTime) / Math.max(0.05, speed));
      scheduleBeat(nextBeat, rt);
      nextBeat += BEAT;
    }
    if (nextBeat > showTime + 4) nextBeat = Math.ceil(showTime / BEAT) * BEAT;
  }
  function seek(t) { lastShowT = t; nextBeat = Math.ceil(t / BEAT) * BEAT; }

  /* ---- 开关 ---- */
  function start() {
    if (!init()) return false;
    if (AC.state === 'suspended') AC.resume();
    started = true; on = true;
    return true;
  }
  function toggle() {
    if (!started) { return start(); }
    on = !on;
    master.gain.setTargetAtTime(on ? P.volume : 0.0001, AC.currentTime, 0.05);
    return on;
  }
  function isOn() { return on; }
  function setVolume(v) { if (master) master.gain.setTargetAtTime(on ? v : 0.0001, AC.currentTime, 0.05); }

  window.KOB_AUDIO = {
    start: start, toggle: toggle, isOn: isOn, setVolume: setVolume,
    update: update, seek: seek,
    boom: boom, click: click, psst: psst, thump: thump
  };
  ctx.audio = window.KOB_AUDIO;
});
})();
