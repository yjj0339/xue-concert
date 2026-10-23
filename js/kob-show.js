/* kob-show.js — 演出程序：135s / 128BPM / 10 章节、导演相机路径、灯光与特效 cue 表、烟花时刻表、16 机位 */
(function () {
'use strict';
window.KOB_FILE_BUILD = '20261023.1';
window.KOB.report('kob-show');

var DUR = 135, BPM = 128, BEAT = 60 / BPM, BAR = BEAT * 4; // 1.875s

/* ---------- 章节表 ---------- */
var CHAPTERS = [
  { n: 1,  t0: 0,    t1: 11,   cn: '序幕 · 巢外',     en: 'OUTSIDE' },
  { n: 2,  t0: 11,   t1: 22,   cn: '题字 · 点燃',     en: 'THE CROWN' },
  { n: 3,  t0: 22,   t1: 31,   cn: '降临 · 穿顶',     en: 'DESCENT' },
  { n: 4,  t0: 31,   t1: 43,   cn: '台前 · 烈焰',     en: 'STAGE FRONT' },
  { n: 5,  t0: 43,   t1: 52,   cn: '主屏 · 点亮',     en: 'THE WALL' },
  { n: 6,  t0: 52,   t1: 71,   cn: '四兽 · 苏醒',     en: 'FOUR BEASTS' },
  { n: 7,  t0: 71,   t1: 80,   cn: '群像 · 守望',     en: 'THE STATUES' },
  { n: 8,  t0: 80,   t1: 95,   cn: '人海 · 光潮',     en: 'THE CROWD' },
  { n: 9,  t0: 95,   t1: 118,  cn: '终章 · 万兽之王', en: 'FINALE' },
  { n: 10, t0: 118,  t1: 135,  cn: '全景 · 鸟巢',     en: 'THE NEST' }
];

/* ---------- 导演相机（Blender 坐标关键帧） ---------- */
/* 每章 keys: [u, px,py,pz, lx,ly,lz, lens] */
var CAM = [
  [ /* 1 巢外 */
    [0.00, -380, -210, 4,   -60, 20, 50, 22],
    [0.45, -260, -130, 10,  0, 10, 42, 26],
    [1.00, -140, -60, 22,   20, 0, 34, 30]
  ],
  [ /* 2 点燃 */
    [0.00, -60, -150, 70,   0, 0, 52, 35],
    [0.50, 30, -80, 96,     0, 0, 44, 40],
    [1.00, 78, 8, 122,      0, 0, 34, 44]
  ],
  [ /* 3 降临 */
    [0.00, 72, 5, 128,      0, 0, 24, 40],
    [0.50, 24, 2, 62,       -20, 0, 14, 34],
    [1.00, -18, 4, 16,      -60, 0, 8, 28]
  ],
  [ /* 4 台前 */
    [0.00, -74, -32, 4.2,   60, 0, 12, 35],
    [0.45, -44, 12, 3.4,    64, 0, 10, 40],
    [1.00, -8, -10, 3.6,    70, 0, 12, 32]
  ],
  [ /* 5 主屏 */
    [0.00, -28, 0, 5,       74, 0, 16, 36],
    [0.50, -58, 22, 18,     72, 0, 20, 40],
    [1.00, -96, 0, 34,      70, 0, 24, 34]
  ],
  [ /* 6 四兽 */
    [0.00, -12, -62, 14,    10, -34, 14, 40],
    [0.34, 32, -56, 16,     42, -34, 15, 42],
    [0.67, 52, 22, 16,      42, 34, 15, 42],
    [1.00, 0, 62, 18,       10, 34, 15, 40]
  ],
  [ /* 7 群像 */
    [0.00, -58, -22, 27,    -24, 0, 27, 30],
    [0.50, -36, 26, 24,     -18, 0, 26, 30],
    [1.00, -62, 42, 20,     0, 0, 20, 34]
  ],
  [ /* 8 人海 */
    [0.00, -82, -42, 22,    30, 0, 10, 34],
    [0.50, -60, 32, 27,     30, 0, 8, 34],
    [1.00, -22, 0, 46,      30, 0, 10, 30]
  ],
  [ /* 9 终章 */
    [0.00, -46, 0, 30,      30, 0, 20, 36],
    [0.40, -112, -42, 52,   0, 0, 30, 40],
    [0.75, -162, 62, 82,    0, 0, 40, 45],
    [1.00, -58, 152, 112,   0, 0, 50, 40]
  ],
  [ /* 10 全景 */
    [0.00, -84, 122, 92,    0, 0, 52, 40],
    [0.50, -202, 202, 142,  0, 0, 42, 45],
    [1.00, -382, 262, 122,  -90, 70, 30, 50]
  ]
];

/* ---------- 章节灯光情绪 ---------- */
/* hueA/hueB: [r,g,b] 0-1；beam: 光束预设；laser: 激光预设；led: 主屏内容模式 */
function C(r, g, b) { return [r, g, b]; }
var MOOD = [
  { hueA: C(0.94, 0.72, 0.35), hueB: C(0.35, 0.55, 0.94), beam: 'warm',   laser: 'off',    led: 0, crowd: 0.5 },
  { hueA: C(1.0, 0.75, 0.32),  hueB: C(1.0, 0.32, 0.12),  beam: 'gold',    laser: 'off',    led: 1, crowd: 0.7 },
  { hueA: C(0.5, 0.4, 1.0),    hueB: C(0.3, 0.7, 1.0),    beam: 'cool',    laser: 'off',    led: 5, crowd: 0.6 },
  { hueA: C(1.0, 0.42, 0.1),   hueB: C(1.0, 0.75, 0.3),   beam: 'cross',   laser: 'fan',    led: 2, crowd: 0.9 },
  { hueA: C(1.0, 0.6, 0.2),    hueB: C(0.4, 0.8, 1.0),    beam: 'wall',    laser: 'wall',   led: 2, crowd: 1.0 },
  { hueA: C(1.0, 0.3, 0.1),    hueB: C(0.3, 1.0, 0.6),    beam: 'cross',   laser: 'scan',   led: 3, crowd: 1.0 },
  { hueA: C(0.95, 0.8, 0.45),  hueB: C(0.6, 0.5, 1.0),    beam: 'soft',    laser: 'off',    led: 0, crowd: 0.6 },
  { hueA: C(0.3, 0.9, 1.0),    hueB: C(1.0, 0.3, 0.85),   beam: 'sunburst',laser: 'tunnel', led: 4, crowd: 1.0 },
  { hueA: C(1.0, 0.35, 0.15),  hueB: C(1.0, 0.8, 0.3),    beam: 'gold',    laser: 'wall',   led: 6, crowd: 1.0 },
  { hueA: C(0.4, 0.7, 1.0),    hueB: C(0.9, 0.5, 1.0),    beam: 'soft',    laser: 'off',    led: 5, crowd: 0.5 }
];

/* ---------- 16 机位 ---------- */
var VIEWS = [
  { cn: '龙湖低飞',   en: 'LAKE SKIM',       pos: [-320, -160, 8],   tgt: [0, 0, 45],     lens: 24 },
  { cn: '鸟巢全景',   en: 'NEST PANORAMA',   pos: [-430, 210, 95],   tgt: [0, 0, 30],     lens: 40 },
  { cn: '屋顶之上',   en: 'ABOVE THE ROOF',  pos: [60, 140, 96],     tgt: [0, 0, 55],     lens: 35 },
  { cn: '开口俯瞰',   en: 'THROUGH THE EYE', pos: [28, 0, 132],      tgt: [0, 0, 0],      lens: 28 },
  { cn: '主舞台正面', en: 'STAGE FRONT',     pos: [-30, 0, 6],       tgt: [76, 0, 14],    lens: 50 },
  { cn: '台前仰拍',   en: 'LOW & CLOSE',     pos: [-2, 10, 2.6],     tgt: [60, 0, 18],    lens: 35 },
  { cn: '跑道尽头',   en: 'RUNWAY END',      pos: [-16, 0, 3.6],     tgt: [60, 0, 8],     lens: 40 },
  { cn: '看台高点',   en: 'STAND HIGH',      pos: [-62, -96, 31],    tgt: [40, 0, 15],    lens: 65 },
  { cn: '兽塔之间',   en: 'AMONG BEASTS',    pos: [26, -18, 12],     tgt: [10, -34, 17],  lens: 45 },
  { cn: '镜球之下',   en: 'MIRROR BALL',     pos: [-42, 0, 22],      tgt: [-18, 0, 26],   lens: 30 },
  { cn: '人海之中',   en: 'IN THE CROWD',    pos: [-56, 12, 3.2],    tgt: [60, 0, 20],    lens: 40 },
  { cn: '无人机高度', en: 'DRONE HEIGHT',    pos: [92, 42, 76],      tgt: [0, 0, 56],     lens: 35 },
  { cn: '水立方侧',   en: 'WATER CUBE SIDE', pos: [-262, -62, 42],   tgt: [0, 0, 40],     lens: 50 },
  { cn: '城市远眺',   en: 'CITY DISTANCE',   pos: [660, 450, 165],   tgt: [0, 0, 50],     lens: 85 },
  { cn: '湖心倒影',   en: 'LAKE HEART',      pos: [-182, 132, 5],    tgt: [0, 40, 50],    lens: 28 },
  { cn: '屋檐掠过',   en: 'ROOF RIM RIDE',   pos: [122, -132, 56],   tgt: [-62, 40, 50],  lens: 35 }
];

/* ---------- 相机采样 ---------- */
function smooth(x) { return x * x * (3 - 2 * x); }
function hermite(a, b, s) { return a + (b - a) * smooth(s); }

function sampleCam(chIdx, u, out) {
  var keys = CAM[chIdx];
  if (u <= 0) { copyKey(keys[0], out); return out; }
  if (u >= 1) { copyKey(keys[keys.length - 1], out); return out; }
  var i = 0;
  while (i < keys.length - 2 && u > keys[i + 1][0]) i++;
  var k0 = keys[i], k1 = keys[i + 1];
  var s = (u - k0[0]) / (k1[0] - k0[0]);
  s = Math.max(0, Math.min(1, s));
  var e = smooth(s);
  for (var j = 1; j <= 6; j++) out.v[j] = k0[j] + (k1[j] - k0[j]) * e;
  out.lens = k0[7] + (k1[7] - k0[7]) * e;
  return out;
}
function copyKey(k, out) {
  for (var j = 1; j <= 6; j++) out.v[j] = k[j];
  out.lens = k[7];
}

function chapterAt(t) {
  t = Math.max(0, Math.min(DUR - 0.001, t));
  for (var i = 0; i < CHAPTERS.length; i++) if (t >= CHAPTERS[i].t0 && t < CHAPTERS[i].t1) return i;
  return CHAPTERS.length - 1;
}

function moodAt(t) {
  return MOOD[chapterAt(t)];
}

/* ---------- cue 构建（api = FX/WORLD/UI 聚合） ---------- */
/* 事件类型：fw(烟花) strobe co2 confetti sparks flame shock mirror holo tornado card laserh goldrain
   halo firering surge aurora molten lantern blimp cityshow lakeflame lotus proj firefly fountain search */
function buildCues(api) {
  var cues = [];
  function cue(t, ev, a) { cues.push({ t: t, ev: ev, a: a || {} }); }
  function barT(bar) { return bar * BAR; }
  var i, t;
  var FW_COLORS = [[1, 0.72, 0.3], [1, 0.3, 0.15], [0.4, 0.7, 1], [0.5, 1, 0.7], [1, 0.4, 0.9], [1, 0.9, 0.6]];
  function roofRing(ang, r, h) {
    return [Math.cos(ang) * (r || 200), Math.sin(ang) * (r || 170), h || 95];
  }

  /* 1 巢外 0-11 */
  cue(0.05, 'titles', { cn: '万兽之王', en: 'KING OF BEASTS LIVE · 鸟巢' });
  cue(0.2, 'fountain', { on: 1 }); cue(0.2, 'search', { on: 1 });
  for (i = 0; i < 5; i++) cue(1.2 + i * 2.2, 'fw', { pos: roofRing(i * 1.26 + 0.4, 205, 92 + i * 6), size: 1.6, color: FW_COLORS[i % 6] });
  cue(2.0, 'lantern', { on: 0 }); cue(10.4, 'fw', { pos: roofRing(1.57, 195, 100), size: 2.4, color: FW_COLORS[0] });

  /* 2 点燃 11-22 */
  cue(11.05, 'halo', { on: 1 });                      // 金色光环沿钢结构升起
  cue(11.4, 'stroketext', { txt: '万兽之王' });        // 屋顶题字点亮
  for (i = 0; i < 6; i++) cue(12 + i * 1.875, 'fw', { pos: roofRing(i * 1.047, 190 + (i % 2) * 20, 90), size: 1.2, color: FW_COLORS[(i + 1) % 6] });
  cue(15.0, 'strobe', { p: 0.6 }); cue(18.8, 'strobe', { p: 0.8 });
  cue(21.2, 'halo', { on: 0 });

  /* 3 降临 22-31 */
  cue(22.0, 'galaxy', { on: 1 });
  cue(22.3, 'beams', { p: 'cool' });
  for (i = 0; i < 4; i++) cue(23 + i * 1.875, 'sparks', { p: 0.8 });
  cue(29.5, 'shock', { pos: [30, 0, 30], r: 60 });
  cue(30.5, 'galaxy', { on: 0 });

  /* 4 台前 31-43 */
  cue(31.0, 'flame', { p: 1 }); cue(31.2, 'co2', { p: 1 }); cue(31.3, 'laserh', { on: 1 });
  cue(31.1, 'ledrise', { on: 1 });                     // 主屏自下而上点亮
  for (i = 0; i < 6; i++) cue(32 + i * 1.875, 'co2', { p: 0.9 });
  for (i = 0; i < 3; i++) cue(33.5 + i * 3.75, 'flame', { p: 1 });
  cue(39.0, 'strobe', { p: 1 }); cue(41.0, 'surge', { p: 1 });

  /* 5 主屏 43-52 */
  cue(43.2, 'laserh', { on: 0 });
  cue(43.5, 'beams', { p: 'wall' });
  for (i = 0; i < 4; i++) cue(44 + i * 1.875, 'sparks', { p: 0.7 });
  cue(48.0, 'confetti', { p: 0.7 }); cue(50.5, 'goldrain', { on: 1 });

  /* 6 四兽 52-71 */
  cue(52.3, 'tornado', { i: 0, on: 1 });               // 鹰
  cue(57.3, 'tornado', { i: 1, on: 1 });               // 狮
  cue(62.3, 'tornado', { i: 2, on: 1 });               // 象
  cue(67.3, 'tornado', { i: 3, on: 1 });               // 鲸
  for (i = 0; i < 8; i++) cue(53 + i * 1.875, 'flame', { p: 0.6 });
  cue(69.5, 'shock', { pos: [26, 0, 24], r: 50 });

  /* 7 群像 71-80 */
  cue(71.0, 'mirror', { on: 1 });
  for (i = 0; i < 4; i++) cue(72 + i * 1.875, 'spot', { ang: i * 1.57 });
  cue(78.5, 'goldrain', { on: 1 });

  /* 8 人海 80-95 */
  cue(80.2, 'card', { txt: '谦' });
  cue(84.0, 'card', { txt: '万兽之王' });
  cue(89.0, 'card', { txt: null });
  cue(80.3, 'mirror', { on: 0 });
  for (i = 0; i < 7; i++) cue(80.5 + i * 1.875, 'strobe', { p: 0.5 });
  cue(82.0, 'droneshow', { shape: 'crown', color: [1, 0.72, 0.3] });
  cue(88.0, 'droneshow', { shape: 'text', txt: 'JOKER', color: [0.35, 0.85, 1] });
  cue(93.0, 'surge', { p: 1 });

  /* 9 终章 95-118 */
  cue(95.1, 'holo', { p: 1 });
  cue(95.4, 'firering', { on: 1 });
  for (i = 0; i < 11; i++) cue(95.8 + i * 1.875, 'fw', {
    pos: roofRing(i * 0.57 + 0.2, 185 + (i % 3) * 22, 86 + (i % 4) * 9),
    size: 2.0 + (i % 3) * 0.5, color: FW_COLORS[i % 6]
  });
  cue(99.0, 'confetti', { p: 1 }); cue(103.0, 'confetti', { p: 1 });
  cue(105.0, 'strobe', { p: 1 }); cue(109.0, 'strobe', { p: 1 });
  cue(111.0, 'shock', { pos: [30, 0, 26], r: 80 });
  cue(113.0, 'surge', { p: 1.4 });
  cue(116.5, 'holo', { p: 0 }); cue(116.8, 'firering', { on: 0 });

  /* 10 全景 118-135 */
  cue(118.1, 'aurora', { on: 1 });
  cue(118.6, 'molten', { p: 1 });
  cue(120.0, 'cityshow', { on: 1 }); cue(121.0, 'blimp', { on: 1 });
  cue(123.0, 'lantern', { on: 1 }); cue(124.0, 'lotus', { on: 1 });
  cue(126.0, 'lakeflame', { on: 1 }); cue(128.0, 'proj', { on: 1 });
  for (i = 0; i < 4; i++) cue(119 + i * 3.5, 'fw', { pos: roofRing(i * 1.57, 210, 100 + i * 8), size: 2.2, color: FW_COLORS[i % 6] });
  cue(130.5, 'firefly', { on: 1 });
  cue(132.5, 'titles', { cn: '感谢北京', en: 'THANK YOU, BEIJING' });
  cue(134.8, 'curtain', {});
  return cues.sort(function (a, b) { return a.t - b.t; });
}

/* ---------- cue 引擎 ---------- */
var ptr = 0;
function seekCues(t) {
  ptr = 0;
  while (ptr < CUES.length && CUES[ptr].t < t) ptr++;
}
var CUES = null;
function initCues(api) { CUES = buildCues(api); seekCues(0); }
function resetTo(t) { if (CUES) seekCues(t); }
function tickCues(tPrev, tNow, fire) {
  if (!CUES) return;
  if (tNow < tPrev) { seekCues(tNow); return; }
  while (ptr < CUES.length && CUES[ptr].t <= tNow) {
    var c = CUES[ptr++];
    try { fire(c.ev, c.a, c.t); } catch (e) { /* 单条失败不拖垮演出 */ }
  }
}

window.KOB_SHOW = {
  DURATION: DUR, BPM: BPM, BEAT: BEAT, BAR: BAR,
  CHAPTERS: CHAPTERS, MOOD: MOOD, VIEWS: VIEWS,
  camAt: function (t, out) { return sampleCam(chapterAt(t), (t - CHAPTERS[chapterAt(t)].t0) / (CHAPTERS[chapterAt(t)].t1 - CHAPTERS[chapterAt(t)].t0), out); },
  chapterAt: chapterAt, chapterIdx: chapterAt,
  moodAt: moodAt,
  initCues: initCues, resetTo: resetTo, tickCues: tickCues,
  cuesList: function () { return CUES; }
};
})();
