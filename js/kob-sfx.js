/* kob-sfx.js — 20 组大型特效目录（场内 11 + 场外 9）+ 经典特效 + 「特效巡礼 Tour」 */
(function () {
'use strict';
window.KOB_FILE_BUILD = '20261023.1';
window.KOB.report('kob-sfx');

window.KOB.onReady(function (ctx) {
  var FX = ctx.fx;
  var on = {};        // id -> bool（当前开启）
  var tourIdx = -1, touring = false, tourT = 0;
  var TOUR_STEP = 8.5;

  /* 经典特效（随时可触发，不属于 20 组） */
  var CLASSICS = [
    { id: 'fwvolley', cn: '烟花齐发', en: 'FIREWORKS', fire: function () { FX.handle('volley', { n: 6, r: 195, h: 92 }); } },
    { id: 'flame', cn: '舞台烈焰', en: 'FLAMES', fire: function () { FX.handle('flame', { p: 1 }); } },
    { id: 'laserfan', cn: '激光扇', en: 'LASER FAN', fire: function () { FX.handle('beams', { p: 'cross' }); FX.handle('laserh', { on: false }); } },
    { id: 'strobe', cn: '频闪', en: 'STROBE', fire: function () { FX.handle('strobe', { p: 0.9 }); } },
    { id: 'co2', cn: 'CO₂ 冷焰', en: 'CO₂ JETS', fire: function () { FX.handle('co2', { p: 1 }); } },
    { id: 'confetti', cn: '彩带', en: 'CONFETTI', fire: function () { FX.handle('confetti', { p: 1 }); } },
    { id: 'sparks', cn: '火花瀑布', en: 'SPARK FALL', fire: function () { FX.handle('sparks', { p: 1 }); } },
    { id: 'surge', cn: '人浪', en: 'CROWD SURGE', fire: function () { FX.handle('surge', { p: 1.4 }); } }
  ];

  /* 20 组大型特效 */
  var CATALOG = [
    /* —— 场内 11 —— */
    { id: 'halo', cn: '光环', en: 'HALO HOOPS', cat: 'in', ev: 'halo', toggle: true },
    { id: 'mirrorball', cn: '镜球', en: 'MIRROR BALL', cat: 'in', ev: 'mirror', toggle: true },
    { id: 'holobeast', cn: '全息巨兽', en: 'HOLO BEAST', cat: 'in', ev: 'holo', toggle: true, p: 1 },
    { id: 'shockwave', cn: '冲击波', en: 'SHOCKWAVE', cat: 'in', one: function () { FX.handle('shock', { pos: [26, 0, 26], r: 90 }); } },
    { id: 'lightrain', cn: '光之雨', en: 'LIGHT RAIN', cat: 'in', ev: 'lightrain', toggle: true },
    { id: 'firering', cn: '火环', en: 'RING OF FIRE', cat: 'in', ev: 'firering', toggle: true },
    { id: 'firetornado', cn: '火龙卷', en: 'FIRE TORNADO', cat: 'in', multi: function (v) { for (var i = 0; i < 4; i++) FX.handle('tornado', { i: i, on: v }); } },
    { id: 'goldsnow', cn: '金箔雪', en: 'GOLD SNOW', cat: 'in', ev: 'goldrain', toggle: true },
    { id: 'laserhour', cn: '激光沙漏', en: 'LASER HOURGLASS', cat: 'in', ev: 'laserh', toggle: true },
    { id: 'cardstunt', cn: '看台字幕', en: 'CARD STUNT', cat: 'in', one: function () { FX.handle('card', { txt: '万兽之王' }); setTimeout(function () { FX.handle('card', { txt: null }); }, 7000); } },
    { id: 'galaxy', cn: '星河', en: 'GALAXY', cat: 'in', ev: 'galaxy', toggle: true },
    /* —— 场外 9 —— */
    { id: 'lantern', cn: '孔明灯', en: 'SKY LANTERNS', cat: 'out', ev: 'lantern', toggle: true },
    { id: 'aurora', cn: '极光', en: 'AURORA', cat: 'out', ev: 'aurora', toggle: true },
    { id: 'lakeflame', cn: '水上火焰', en: 'LAKE FLAMES', cat: 'out', ev: 'lakeflame', toggle: true },
    { id: 'lotus', cn: '莲花灯', en: 'LOTUS LANTERNS', cat: 'out', ev: 'lotus', toggle: true },
    { id: 'projection', cn: '地面投影', en: 'GROUND PROJECTION', cat: 'out', ev: 'proj', toggle: true },
    { id: 'firefly', cn: '萤火', en: 'FIREFLIES', cat: 'out', ev: 'firefly', toggle: true },
    { id: 'cityshow', cn: '城市灯光秀', en: 'CITY LIGHT SHOW', cat: 'out', ev: 'cityshow', toggle: true },
    { id: 'blimp', cn: 'LED 飞艇', en: 'LED BLIMP', cat: 'out', ev: 'blimp', toggle: true },
    { id: 'molten', cn: '打铁花', en: 'MOLTEN IRON', cat: 'out', one: function () { FX.handle('molten', { p: 1 }); } }
  ];

  function setOn(id, v) { on[id] = v; if (ctx.ui) ctx.ui.fxIndicator(id, v); }

  function apply(entry, v) {
    if (entry.one) { entry.one(); return; }
    if (entry.multi) { entry.multi(v); setOn(entry.id, v); return; }
    var arg = { on: v };
    if (entry.p !== undefined) arg.p = v ? entry.p : 0;
    FX.handle(entry.ev, arg);
    setOn(entry.id, v);
  }
  function toggle(id) {
    var e = CATALOG.filter(function (c) { return c.id === id; })[0];
    if (!e) return;
    if (e.one) { e.one(); return; }
    apply(e, !on[id]);
  }

  /* 特效巡礼：按序自动巡演 20 组（每步 TOUR_STEP 秒） */
  function step() {
    if (tourIdx >= 0 && tourIdx < CATALOG.length) {
      var prev = CATALOG[tourIdx];
      if (!prev.one && !on[prev.id + '_pin']) apply(prev, false);
    }
    tourIdx++;
    if (tourIdx >= CATALOG.length) { touring = false; tourIdx = -1; setTourBtn(); return; }
    var e = CATALOG[tourIdx];
    if (e.one) e.one(); else apply(e, true);
    tourT = 0;
    if (ctx.ui) ctx.ui.tourStatus(e);
  }
  var setTourBtn = function () {};
  function startTour() { touring = true; tourIdx = -1; step(); }
  function stopTour() {
    touring = false;
    if (tourIdx >= 0 && tourIdx < CATALOG.length) {
      var e = CATALOG[tourIdx];
      if (!e.one) apply(e, false);
    }
    tourIdx = -1;
    if (ctx.ui) ctx.ui.tourStatus(null);
  }
  function update(dt) {
    if (!touring) return;
    tourT += dt;
    if (tourT >= TOUR_STEP) step();
  }

  window.KOB_SFX = {
    classics: function () { return CLASSICS.map(function (c) { return { id: c.id, cn: c.cn, en: c.en }; }); },
    fireClassic: function (id) {
      var c = CLASSICS.filter(function (x) { return x.id === id; })[0];
      if (c) c.fire();
    },
    catalog: function () { return CATALOG.map(function (c) { return { id: c.id, cn: c.cn, en: c.en, cat: c.cat, on: !!on[c.id], momentary: !!c.one }; }); },
    toggle: toggle,
    isOn: function (id) { return !!on[id]; },
    tour: function (v) { v ? startTour() : stopTour(); },
    isTouring: function () { return touring; },
    onSetTourBtn: function (fn) { setTourBtn = fn; },
    update: update
  };
  ctx.sfx = window.KOB_SFX;
});
})();
