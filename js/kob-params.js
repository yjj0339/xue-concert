/* kob-params.js — 参数解析：URL 查询参数 > 主 script 标签 data-* > window.KOB_CONFIG > 内置默认值 */
(function () {
'use strict';
window.KOB = window.KOB || {
  BUILD: '20261023.1',
  FILES: [],
  report: function (name) { window.KOB.FILES.push({ name: name, build: window.KOB_FILE_BUILD || window.KOB.BUILD }); },
  ready: [],
  onReady: function (fn) { window.KOB.ready.push(fn); }
};
window.KOB_FILE_BUILD = '20261023.1';
window.KOB.report('kob-params');

var TRUE_RE = /^(1|true|yes|on)$/i, FALSE_RE = /^(0|false|no|off)$/i;

/* 颜色名 → 十六进制（灯牌/无人机共用 8 色） */
var COLORS = {
  gold: '#f0b85a', red: '#ff3b2f', white: '#f4efe6', cyan: '#35d5e8',
  magenta: '#ff4fd8', jade: '#3fe8a8', violet: '#a07bff', orange: '#ff8a3d'
};

function parseBool(v, def) {
  if (v === null || v === undefined) return def;
  if (typeof v === 'boolean') return v;
  var s = String(v).trim();
  if (TRUE_RE.test(s)) return true;
  if (FALSE_RE.test(s)) return false;
  return def;
}
function parseNum(v, def) {
  var n = parseFloat(v);
  return isFinite(n) ? n : def;
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function clampNum(v, def, a, b) {
  var n = parseFloat(v);
  if (!isFinite(n)) return def;   // 未指定时保持默认（含 null），不落入钳制下限
  return clamp(n, a, b);
}
function parseEnum(v, list, def) {
  if (v === null || v === undefined || v === '') return def;
  var s = String(v).toLowerCase();
  for (var i = 0; i < list.length; i++) if (list[i] === s) return s;
  return def;
}

var SPEC = {
  /* 播放 */
  mode:     { d: 'play', oneOf: ['play', 'free'] },
  t:        { d: 0, min: 0, max: 135 },
  chapter:  { d: null, min: 1, max: 10, int: true },
  speed:    { d: 1, min: 0.05, max: 4 },
  loop:     { d: true, b: true },
  /* 画质 */
  quality:  { d: 'auto', oneOf: ['auto', 'low', 'medium', 'high', 'ultra'] },
  scale:    { d: null, min: 0.25, max: 2 },
  fps:      { d: 0, min: 0, max: 240 },
  /* 音频 */
  audio:    { d: false, b: true },
  volume:   { d: 0.8, min: 0, max: 1 },
  /* 界面 */
  ui:       { d: true, b: true },
  letterbox:{ d: true, b: true },
  theme:    { d: 'light', oneOf: ['light', 'dark'] },
  idle:     { d: 0, min: 0, max: 600 },
  stats:    { d: false, b: true },
  gate:     { d: true, b: true },
  titles:   { d: true, b: true },
  autohide: { d: 3.5, min: 0, max: 60 },
  /* 画面 */
  ev:       { d: 0, min: -4, max: 4 },
  bloom:    { d: 1, min: 0, max: 4 },
  flare:    { d: 1, min: 0, max: 4 },
  grain:    { d: 1, min: 0, max: 4 },
  haze:     { d: 1, min: 0, max: 4 },
  dof:      { d: true, b: true },
  mblur:    { d: true, b: true },
  shake:    { d: 1, min: 0, max: 3 },
  /* 密度 */
  fireworks:{ d: 1, min: 0, max: 3 },
  crowd:    { d: 1, min: 0, max: 3 },
  drones:   { d: 1, min: 0, max: 3 },
  /* 机位/杂项 */
  view:     { d: null, min: 0, max: 15, int: true },
  seed:     { d: 7, min: 1, max: 9999, int: true },
  cdn:      { d: 'auto', oneOf: ['auto', 'jsdelivr', 'unpkg', 'npmmirror'] },
  capture:  { d: false, b: true },
  /* 灯牌 */
  sign:         { d: null, s: true },
  signColor:    { d: 'gold', s: true },
  signStyle:    { d: 'neon', oneOf: ['neon', 'bulbs', 'led'] },
  signAnim:     { d: 'steady', oneOf: ['steady', 'chase', 'pulse', 'rainbow'] },
  ticker:       { d: null, s: true },
  /* 无人机 */
  drone:        { d: null, s: true },
  droneShape:   { d: 'text', oneOf: ['text', 'crown', 'heart', 'eye', 'claws', 'sphere', 'rings', 'star', 'note', 'eagle', 'lion', 'elephant', 'whale', 'planet', 'halo'] },
  droneColor:   { d: 'gold', s: true },
  droneFx:      { d: 'steady', oneOf: ['steady', 'wave', 'sparkle', 'rainbow', 'bloom'] },
  droneSpot:    { d: null, oneOf: ['behind', 'lake', 'crown'] }
};

function resolve() {
  /* 收集三层来源：URL > data-* > KOB_CONFIG */
  var url = {};
  try {
    var usp = new URLSearchParams(location.search);
    usp.forEach(function (v, k) { url[k] = v; });
  } catch (e) { /* ignore */ }
  var data = {};
  var main = document.getElementById('kob-main');
  if (main) {
    for (var i = 0; i < main.attributes.length; i++) {
      var at = main.attributes[i];
      if (at.name.indexOf('data-') === 0) data[at.name.slice(5)] = at.value;
    }
  }
  var cfg = window.KOB_CONFIG || {};

  var P = { rawUrl: url };
  Object.keys(SPEC).forEach(function (key) {
    var sp = SPEC[key];
    var v = (key in url && url[key] !== '' && url[key] !== undefined) ? url[key]
          : (key in data && data[key] !== '') ? data[key]
          : (key in cfg) ? cfg[key] : sp.d;
    if (sp.b) P[key] = parseBool(v, sp.d);
    else if (sp.oneOf) P[key] = parseEnum(v, sp.oneOf, sp.d);
    else if (sp.s) P[key] = (v === null || v === undefined || v === '') ? sp.d : String(v);
    else if (sp.int) {
      var n = parseInt(v, 10);
      P[key] = isFinite(n) ? clamp(n, sp.min, sp.max) : sp.d;
    } else if (sp.min !== undefined) P[key] = clampNum(v, sp.d, sp.min, sp.max);
    else P[key] = v;
  });

  /* 修正与联动 */
  if (P.ticker === true || P.ticker === 'true' || P.ticker === '1') P.ticker = 'KING OF BEASTS LIVE · 万兽之王 · 鸟巢';
  P.colorValue = function (name) {
    var v = P[name];
    if (!v) return null;
    if (v[0] === '#' && /^#[0-9a-fA-F]{6}$/.test(v)) return v;
    return COLORS[v] || COLORS.gold;
  };
  P.colorName = function (name) {
    var v = P[name];
    if (!v) return null;
    return (v[0] === '#') ? v : (COLORS[v] ? v : 'gold');
  };
  P.COLORS = COLORS;
  return P;
}

window.KOB_PARAMS = resolve();
})();
