/* kob-deck.js — 左侧控制台：机位 / 特效 / 灯牌编辑器 / 无人机编队编辑器（实时小地图点击放置与拖动，localStorage 保存，URL 优先） */
(function () {
'use strict';
window.KOB_FILE_BUILD = '20261023.1';
window.KOB.report('kob-deck');

window.KOB.onReady(function (ctx) {
  var P = ctx.params, SHOW = ctx.show, FX = ctx.fx, SFX = ctx.sfx;
  var COLORS = [
    ['gold', '#f0b85a'], ['red', '#ff3b2f'], ['white', '#f4efe6'], ['cyan', '#35d5e8'],
    ['magenta', '#ff4fd8'], ['jade', '#3fe8a8'], ['violet', '#a07bff'], ['orange', '#ff8a3d']
  ];
  var SHAPES = [
    ['text', '文字'], ['crown', '皇冠'], ['heart', '爱心'], ['star', '星星'], ['note', '音符'],
    ['eagle', '雄鹰'], ['lion', '雄狮'], ['elephant', '巨象'], ['whale', '鲸'],
    ['eye', '兽瞳'], ['claws', '兽爪'], ['planet', '星球'], ['rings', '光环']
  ];
  var LAKE_PATH = [
    [-240, 350, 105], [-330, 235, 95], [-365, 95, 85], [-320, -25, 80],
    [-385, -155, 70], [-330, -290, 80], [-195, -345, 90], [-55, -315, 85]
  ];
  var LS_KEY = 'kob.deck.v1';

  /* ---------- DOM ---------- */
  var root = document.createElement('div');
  root.id = 'kob-deck';
  root.innerHTML =
    '<div class="kob-deck-rail">' +
    '  <button class="kob-deck-tab" data-tab="views"><span class="cn">机位</span><span class="en">VIEWS</span></button>' +
    '  <button class="kob-deck-tab" data-tab="fx"><span class="cn">特效</span><span class="en">FX</span></button>' +
    '  <button class="kob-deck-tab" data-tab="signs"><span class="cn">灯牌</span><span class="en">SIGNS</span></button>' +
    '  <button class="kob-deck-tab" data-tab="drones"><span class="cn">无人机</span><span class="en">DRONES</span></button>' +
    '</div>' +
    '<div class="kob-deck-body">' +
    '  <div class="kob-deck-pane" data-pane="views"><div class="kob-deck-list" id="kob-views-list"></div></div>' +
    '  <div class="kob-deck-pane" data-pane="fx">' +
    '    <div class="kob-deck-h">经典特效 · CLASSIC</div>' +
    '    <div class="kob-fx-grid" id="kob-classic-grid"></div>' +
    '    <div class="kob-deck-h">大型特效 · GRAND FX</div>' +
    '    <div class="kob-fx-grid" id="kob-fx-grid"></div>' +
    '    <button class="kob-tour-btn" id="kob-tour-btn">特效巡礼 · FX TOUR</button>' +
    '    <div class="kob-tour-status" id="kob-tour-status"></div>' +
    '  </div>' +
    '  <div class="kob-deck-pane" data-pane="signs">' +
    '    <canvas class="kob-minimap" id="kob-map-signs" width="248" height="248"></canvas>' +
    '    <div class="kob-map-tip">点击地图放置灯牌 · 拖动标记移动（最多 8 块）</div>' +
    '    <div class="kob-deck-list" id="kob-signs-list"></div>' +
    '    <div class="kob-deck-h">外墙跑马灯 · TICKER</div>' +
    '    <div class="kob-row"><input id="kob-ticker-in" type="text" maxlength="24" placeholder="外墙跑马灯文字"><button id="kob-ticker-ok">设置</button><button id="kob-ticker-off">关</button></div>' +
    '  </div>' +
    '  <div class="kob-deck-pane" data-pane="drones">' +
    '    <canvas class="kob-minimap" id="kob-map-drones" width="248" height="248"></canvas>' +
    '    <div class="kob-map-tip">鸟巢上空编队 · 拖动标记移动（最多 3 队 × 2200 架）</div>' +
    '    <div class="kob-row"><label class="kob-chk"><input type="checkbox" id="kob-drone-follow"> 编队跟随演出</label></div>' +
    '    <div class="kob-deck-list" id="kob-drones-list"></div>' +
    '  </div>' +
    '</div>';
  document.body.appendChild(root);

  var open = false, tab = 'views';
  var tabs = root.querySelectorAll('.kob-deck-tab');
  var panes = root.querySelectorAll('.kob-deck-pane');
  tabs.forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.dataset.tab;
      if (open && tab === t) { setOpen(false); return; }
      tab = t; setOpen(true);
    });
  });
  function setOpen(v) {
    open = v;
    root.classList.toggle('open', v);
    tabs.forEach(function (b) { b.classList.toggle('on', v && b.dataset.tab === tab); });
    panes.forEach(function (p) { p.classList.toggle('on', v && p.dataset.pane === tab); });
    if (v) refresh();
  }
  function close() { setOpen(false); }
  function toggleTab(name) { tab = name; setOpen(true); }

  /* ---------- 机位 ---------- */
  (function () {
    var list = root.querySelector('#kob-views-list');
    SHOW.VIEWS.forEach(function (v, i) {
      var b = document.createElement('button');
      b.className = 'kob-view-item';
      b.innerHTML = '<span class="n">' + String(i + 1).padStart(2, '0') + '</span><span class="cn">' + v.cn + '</span><span class="en">' + v.en + ' · ' + v.lens + 'mm</span>';
      b.addEventListener('click', function () { ctx.main.flyTo(i); });
      list.appendChild(b);
    });
  })();

  /* ---------- 特效面板 ---------- */
  var fxBtns = {};
  (function () {
    var cg = root.querySelector('#kob-classic-grid');
    SFX.classics().forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'kob-fx-btn';
      b.innerHTML = '<span class="cn">' + c.cn + '</span><span class="en">' + c.en + '</span>';
      b.addEventListener('click', function () { SFX.fireClassic(c.id); });
      cg.appendChild(b);
    });
    var g = root.querySelector('#kob-fx-grid');
    SFX.catalog().forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'kob-fx-btn';
      b.innerHTML = '<i class="dot"></i><span class="cn">' + c.cn + (c.cat === 'out' ? ' ⌂' : '') + '</span><span class="en">' + c.en + '</span>';
      b.addEventListener('click', function () { SFX.toggle(c.id); });
      fxBtns[c.id] = b;
      g.appendChild(b);
    });
    var tb = root.querySelector('#kob-tour-btn');
    tb.addEventListener('click', function () {
      SFX.tour(!SFX.isTouring());
      tb.classList.toggle('on', SFX.isTouring());
    });
    SFX.onSetTourBtn(function () { tb.classList.toggle('on', SFX.isTouring()); });
  })();
  function syncFxLights(lights) {
    Object.keys(fxBtns).forEach(function (id) {
      fxBtns[id].classList.toggle('lit', !!lights[id]);
    });
  }
  function tourStatus(e) {
    var el = root.querySelector('#kob-tour-status');
    if (!el) return;
    el.textContent = e ? ('▶ 巡礼中：' + e.cn + ' · ' + e.en) : '';
  }

  /* ---------- 状态 ---------- */
  var signsCfg = [];
  var dronesCfg = [null, null, null];
  var dronesFollow = true;

  /* ---------- localStorage ---------- */
  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        signs: signsCfg, ticker: currentTicker, drones: dronesCfg, follow: dronesFollow
      }));
    } catch (e) { }
  }
  function load() {
    /* URL 参数优先：P.sign / P.drone 已由 fx 应用 */
    try {
      var d = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (!d) return;
      if (!P.sign && d.signs) {
        d.signs.forEach(function (s) {
          if (signsCfg.length < 8) { signsCfg.push(s); FX.signs.add(s); }
        });
      }
      if (!P.ticker && d.ticker) setTicker(d.ticker);
      if (!P.drone && d.drones) {
        d.drones.forEach(function (cfg, i) {
          if (cfg && i < 3) { dronesCfg[i] = cfg; FX.drones.set(i, cfg); }
        });
        if (d.drones.some(function (x) { return x; })) FX.drones.follow(false);
      }
      if (typeof d.follow === 'boolean') setFollow(d.follow);
    } catch (e) { }
  }

  /* ---------- 跑马灯 ---------- */
  var currentTicker = null;
  function setTicker(txt) {
    currentTicker = txt || null;
    FX.ticker(currentTicker);
    root.querySelector('#kob-ticker-in').value = currentTicker || '';
  }
  root.querySelector('#kob-ticker-ok').addEventListener('click', function () {
    var v = root.querySelector('#kob-ticker-in').value.trim();
    if (v) { setTicker(v); save(); }
  });
  root.querySelector('#kob-ticker-off').addEventListener('click', function () {
    setTicker(null); save();
  });

  /* ---------- 灯牌编辑 ---------- */
  function defaultSign(x, y) {
    return {
      x: Math.round(x), y: Math.round(y), height: 4, w: 16,
      text: '鸟巢见', color: '#f0b85a', style: 'neon', anim: 'steady',
      faceCam: false, yaw: Math.round(Math.atan2(y - 0, 0 - x) * 180 / Math.PI + 180)
    };
  }
  function signRow(s, i) {
    var row = document.createElement('div');
    row.className = 'kob-edit-row';
    var colorOpts = COLORS.map(function (c) { return '<option value="' + c[1] + '"' + (s.color === c[1] ? ' selected' : '') + '>' + c[0] + '</option>'; }).join('');
    row.innerHTML =
      '<div class="kob-row r1"><span class="idx">#' + (i + 1) + '</span>' +
      '<input class="t" type="text" maxlength="8" value="' + (s.text || '') + '" data-k="text">' +
      '<select data-k="color"><option value="">颜色…</option>' + colorOpts + '</select></div>' +
      '<div class="kob-row r2">' +
      '<select data-k="style"><option value="neon"' + (s.style === 'neon' ? ' selected' : '') + '>霓虹</option><option value="bulbs"' + (s.style === 'bulbs' ? ' selected' : '') + '>灯泡</option><option value="led"' + (s.style === 'led' ? ' selected' : '') + '>LED</option></select>' +
      '<select data-k="anim"><option value="steady">常亮</option><option value="chase"' + (s.anim === 'chase' ? ' selected' : '') + '>追光</option><option value="pulse"' + (s.anim === 'pulse' ? ' selected' : '') + '>呼吸</option><option value="rainbow"' + (s.anim === 'rainbow' ? ' selected' : '') + '>彩虹</option></select>' +
      '</div>' +
      '<div class="kob-row r3">' +
      '<label>高<input type="range" min="2" max="14" step="0.5" value="' + (s.height || 4) + '" data-k="height"></label>' +
      '<label>宽<input type="range" min="8" max="26" step="1" value="' + (s.w || 16) + '" data-k="w"></label>' +
      '<label>向<input type="range" min="0" max="359" step="5" value="' + (s.yaw || 0) + '" data-k="yaw"></label>' +
      '</div>' +
      '<div class="kob-row r4">' +
      '<button class="mini" data-act="face">朝向镜头</button>' +
      '<button class="mini" data-act="fly">飞过去看</button>' +
      '<button class="mini danger" data-act="del">删除</button>' +
      '</div>';
    row.querySelectorAll('[data-k]').forEach(function (inp) {
      var evName = inp.tagName === 'SELECT' || inp.type === 'range' ? 'change' : 'change';
      inp.addEventListener(evName, function () {
        var k = inp.dataset.k;
        s[k] = (k === 'height' || k === 'w' || k === 'yaw') ? parseFloat(inp.value) : inp.value;
        if (k === 'color' && !s.color) s.color = '#f0b85a';
        FX.signs.update(i, s);
        save();
      });
    });
    row.querySelector('[data-act="face"]').addEventListener('click', function () { s.faceCam = !s.faceCam; FX.signs.update(i, s); save(); });
    row.querySelector('[data-act="fly"]').addEventListener('click', function () {
      ctx.main.flyToPoint(s.x, s.y, s.height + 4, 24);
    });
    row.querySelector('[data-act="del"]').addEventListener('click', function () {
      FX.signs.remove(i);
      signsCfg.splice(i, 1);
      rebuildSignList(); save();
    });
    return row;
  }
  function rebuildSignList() {
    var list = root.querySelector('#kob-signs-list');
    list.innerHTML = '';
    if (!signsCfg.length) {
      list.innerHTML = '<div class="kob-empty">暂无灯牌 · 点击小地图放置</div>';
      return;
    }
    signsCfg.forEach(function (s, i) { list.appendChild(signRow(s, i)); });
  }

  /* ---------- 无人机编辑 ---------- */
  function defaultDrone() {
    return { shape: 'star', text: '', color: 'gold', fx: 'steady', height: 64, x: 0, y: 0, scale: 1.1 };
  }
  function droneRow(cfg, i) {
    if (!cfg) {
      var add = document.createElement('button');
      add.className = 'kob-add-btn';
      add.textContent = '+ 新建编队 ' + (i + 1);
      add.addEventListener('click', function () {
        cfg = defaultDrone();
        dronesCfg[i] = cfg;
        FX.drones.set(i, cfg);
        rebuildDroneList(); save();
      });
      var wrap = document.createElement('div');
      wrap.appendChild(add);
      return wrap;
    }
    var row = document.createElement('div');
    row.className = 'kob-edit-row';
    var shapeOpts = SHAPES.map(function (s) { return '<option value="' + s[0] + '"' + (cfg.shape === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('');
    var colorOpts = COLORS.map(function (c) { return '<option value="' + c[0] + '"' + (cfg.color === c[0] ? ' selected' : '') + '>' + c[0] + '</option>'; }).join('');
    var fxOpts = ['steady', 'wave', 'sparkle', 'rainbow', 'bloom'].map(function (f) {
      var cn2 = { steady: '常亮', wave: '波浪', sparkle: '闪烁', rainbow: '彩虹', bloom: '绽放' }[f];
      return '<option value="' + f + '"' + (cfg.fx === f ? ' selected' : '') + '>' + cn2 + '</option>';
    }).join('');
    row.innerHTML =
      '<div class="kob-row r1"><span class="idx">队' + (i + 1) + '</span>' +
      '<select data-k="shape"><option value="text">文字…</option>' + shapeOpts + '</select>' +
      '<input class="t" type="text" maxlength="8" value="' + (cfg.text || '') + '" placeholder="编队文字" data-k="text"></div>' +
      '<div class="kob-row r2"><select data-k="color">' + colorOpts + '</select><select data-k="fx">' + fxOpts + '</select></div>' +
      '<div class="kob-row r3">' +
      '<label>高<input type="range" min="50" max="110" step="2" value="' + (cfg.height || 64) + '" data-k="height"></label>' +
      '<label>幅<input type="range" min="0.6" max="2" step="0.1" value="' + (cfg.scale || 1) + '" data-k="scale"></label>' +
      '</div>' +
      '<div class="kob-row r4">' +
      '<button class="mini" data-act="face">朝向镜头</button>' +
      '<button class="mini" data-act="watch">观看编队</button>' +
      '<button class="mini danger" data-act="del">解散</button></div>';
    row.querySelectorAll('[data-k]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var k = inp.dataset.k;
        cfg[k] = (k === 'height' || k === 'scale') ? parseFloat(inp.value) : inp.value;
        if (k === 'shape' && inp.value !== 'text') cfg.text = '';
        FX.drones.set(i, cfg);
        save();
      });
    });
    row.querySelector('[data-act="face"]').addEventListener('click', function () {
      cfg.yaw = (cfg.yaw || 0) + 180;
      FX.drones.set(i, cfg);
    });
    row.querySelector('[data-act="watch"]').addEventListener('click', function () {
      ctx.main.flyToPoint(cfg.x, cfg.y, cfg.height + 26, 35);
    });
    row.querySelector('[data-act="del"]').addEventListener('click', function () {
      FX.drones.clear(i);
      dronesCfg[i] = null;
      rebuildDroneList(); save();
    });
    return row;
  }
  function rebuildDroneList() {
    var list = root.querySelector('#kob-drones-list');
    list.innerHTML = '';
    for (var i = 0; i < 3; i++) list.appendChild(droneRow(dronesCfg[i], i));
  }
  function setFollow(v) {
    dronesFollow = v;
    FX.drones.follow(v);
    root.querySelector('#kob-drone-follow').checked = v;
  }
  root.querySelector('#kob-drone-follow').addEventListener('change', function (e) {
    setFollow(e.target.checked); save();
  });

  /* ---------- 小地图 ---------- */
  var SPAN = 960; // 世界范围 ±480m
  function mapCanvas(which) { return root.querySelector(which); }
  var maps = [
    { cv: mapCanvas('#kob-map-signs'), mode: 'signs' },
    { cv: mapCanvas('#kob-map-drones'), mode: 'drones' }
  ];
  var drag = null;
  maps.forEach(function (m) {
    m.cv.addEventListener('pointerdown', function (e) {
      var r = m.cv.getBoundingClientRect();
      var mx = (e.clientX - r.left) / r.width, my = (e.clientY - r.top) / r.height;
      if (m.mode === 'signs') {
        for (var i = 0; i < signsCfg.length; i++) {
          var s = signsCfg[i];
          var sx = (s.x + SPAN / 2) / SPAN, sy = (s.y + SPAN / 2) / SPAN;
          if (Math.hypot(mx - sx, my - sy) < 0.035) { drag = { mode: 'sign', i: i, map: m }; m.cv.setPointerCapture(e.pointerId); return; }
        }
        if (signsCfg.length < 8) {
          var ns = defaultSign(mx * SPAN - SPAN / 2, my * SPAN - SPAN / 2);
          signsCfg.push(ns);
          FX.signs.add(ns);
          rebuildSignList(); save();
        }
      } else {
        for (var d = 0; d < 3; d++) {
          if (!dronesCfg[d]) continue;
          var dx = (dronesCfg[d].x + SPAN / 2) / SPAN, dy = (dronesCfg[d].y + SPAN / 2) / SPAN;
          if (Math.hypot(mx - dx, my - dy) < 0.045) { drag = { mode: 'drone', i: d, map: m }; m.cv.setPointerCapture(e.pointerId); return; }
        }
      }
    });
    m.cv.addEventListener('pointermove', function (e) {
      if (!drag || drag.map !== m) return;
      var r = m.cv.getBoundingClientRect();
      var bx = ((e.clientX - r.left) / r.width) * SPAN - SPAN / 2;
      var by = ((e.clientY - r.top) / r.height) * SPAN - SPAN / 2;
      bx = Math.max(-460, Math.min(460, bx)); by = Math.max(-460, Math.min(460, by));
      if (drag.mode === 'sign') {
        signsCfg[drag.i].x = Math.round(bx); signsCfg[drag.i].y = Math.round(by);
        FX.signs.update(drag.i, signsCfg[drag.i]);
      } else {
        dronesCfg[drag.i].x = Math.round(bx); dronesCfg[drag.i].y = Math.round(by);
        FX.drones.set(drag.i, dronesCfg[drag.i]);
      }
    });
    var end = function () { if (drag && drag.map === m) { drag = null; save(); refresh(); } };
    m.cv.addEventListener('pointerup', end);
    m.cv.addEventListener('pointercancel', end);
  });

  function w2m(x, y, w, h) { return [(x + SPAN / 2) / SPAN * w, (y + SPAN / 2) / SPAN * h]; }
  function drawMap(m) {
    var cv = m.cv, g = cv.getContext('2d');
    var W2 = cv.width, H2 = cv.height;
    g.clearRect(0, 0, W2, H2);
    g.fillStyle = 'rgba(10,12,16,0.9)';
    g.fillRect(0, 0, W2, H2);
    /* 湖 */
    g.strokeStyle = 'rgba(64,110,150,0.55)';
    g.lineWidth = 26; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    LAKE_PATH.forEach(function (p, i) {
      var pt = w2m(p[0], p[1], W2, H2);
      i === 0 ? g.moveTo(pt[0], pt[1]) : g.lineTo(pt[0], pt[1]);
    });
    g.stroke();
    /* 广场环 */
    g.strokeStyle = 'rgba(255,236,200,0.10)';
    g.lineWidth = 1.5;
    var c0 = w2m(0, 0, W2, H2);
    g.beginPath(); g.ellipse(c0[0], c0[1], 176 / SPAN * W2, 150 / SPAN * H2, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.ellipse(c0[0], c0[1], 430 / SPAN * W2, 400 / SPAN * H2, 0, 0, Math.PI * 2); g.stroke();
    /* 场馆椭圆 */
    g.strokeStyle = 'rgba(240,184,90,0.8)';
    g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(c0[0], c0[1], 170 / SPAN * W2, 144 / SPAN * H2, 0, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(240,184,90,0.35)';
    g.beginPath(); g.ellipse(c0[0], c0[1], 104 / SPAN * W2, 78 / SPAN * H2, 0, 0, Math.PI * 2); g.stroke();
    /* 舞台 */
    var st = w2m(69, 0, W2, H2);
    g.fillStyle = 'rgba(255,120,60,0.85)';
    g.fillRect(st[0] - 19 / SPAN * W2, st[1] - 26 / SPAN * H2, 38 / SPAN * W2, 52 / SPAN * H2);
    /* 兽塔 */
    [[10, -34], [10, 34], [42, -34], [42, 34]].forEach(function (t) {
      var pt = w2m(t[0], t[1], W2, H2);
      g.fillStyle = 'rgba(160,120,70,0.9)';
      g.beginPath(); g.arc(pt[0], pt[1], 2.4, 0, Math.PI * 2); g.fill();
    });
    /* 相机 */
    var cam = ctx.main.camB();
    if (cam) {
      var cp = w2m(cam.x, cam.y, W2, H2);
      g.save();
      g.translate(cp[0], cp[1]);
      g.rotate(cam.yaw);
      g.fillStyle = 'rgba(120,200,255,0.30)';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(26, -16); g.lineTo(26, 16); g.closePath(); g.fill();
      g.fillStyle = '#9fdcff';
      g.beginPath(); g.arc(0, 0, 3.2, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    /* 标记 */
    if (m.mode === 'signs') {
      signsCfg.forEach(function (s, i) {
        var pt = w2m(s.x, s.y, W2, H2);
        g.fillStyle = s.color || '#f0b85a';
        g.beginPath(); g.arc(pt[0], pt[1], 5, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#0a0a0a';
        g.font = '700 7px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(i + 1), pt[0], pt[1] + 0.5);
      });
    } else {
      dronesCfg.forEach(function (d, i) {
        if (!d) return;
        var pt = w2m(d.x, d.y, W2, H2);
        g.strokeStyle = '#35d5e8';
        g.lineWidth = 1.6;
        g.beginPath(); g.arc(pt[0], pt[1], 7, 0, Math.PI * 2); g.stroke();
        g.fillStyle = 'rgba(53,213,232,0.4)';
        g.beginPath(); g.arc(pt[0], pt[1], 7, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#bff4ff';
        g.font = '700 7px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(i + 1), pt[0], pt[1]);
      });
    }
  }

  /* ---------- 刷新 ---------- */
  var frameCount = 0;
  function refresh() {
    rebuildSignList();
    rebuildDroneList();
    root.querySelector('#kob-drone-follow').checked = dronesFollow;
  }
  function update() {
    frameCount++;
    if (!open) return;
    if (tab === 'signs' || tab === 'drones') {
      maps.forEach(function (m) { if ((tab === 'signs') === (m.mode === 'signs')) drawMap(m); });
    }
  }

  /* ---------- 初始化 ---------- */
  load();
  if (P.sign && signsCfg.length === 0) {
    /* URL 灯牌参数已由 fx 放置，同步进编辑器状态 */
    try {
      var urlSign = FX.signs.list()[0];
      if (urlSign) signsCfg.push(urlSign);
    } catch (e) { }
  }
  refresh();

  window.KOB_DECK = {
    close: close,
    toggle: function () { setOpen(!open); },
    openTab: toggleTab,
    syncFxLights: syncFxLights,
    tourStatus: tourStatus,
    update: update
  };
  ctx.deck = window.KOB_DECK;
});
})();
