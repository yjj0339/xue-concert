/* kob-ui.js — 界面控制器：顶栏（字标/时钟/图标按钮）、底栏（模式切换+章节时间轴）、章节字卡、开场谢幕字卡、自动隐藏+眼睛唤回、画质菜单、统计层 */
(function () {
'use strict';
window.KOB_FILE_BUILD = '20261023.1';
window.KOB.report('kob-ui');

window.KOB.onReady(function (ctx) {
  var P = ctx.params, SHOW = ctx.show;
  var $ = function (id) { return document.getElementById(id); };
  var els = {
    topbar: $('kob-topbar'), bottombar: $('kob-bottombar'), clock: $('kob-clock'),
    chapname: $('kob-chapname'), btnSound: $('kob-btn-sound'), btnQuality: $('kob-btn-quality'),
    btnFull: $('kob-btn-full'), btnHide: $('kob-btn-hide'), qmenu: $('kob-qmenu'),
    timeline: $('kob-timeline'), tlHover: $('kob-tl-hover'), chapterCard: $('kob-chapter-card'),
    titleCard: $('kob-title-card'), eye: $('kob-eye'), stats: $('kob-stats'),
    backShow: $('kob-backshow'), modePlay: $('kob-mode-play'), modeFree: $('kob-mode-free'),
    btnPlay: $('kob-btn-play'), letterTop: $('kob-lt'), letterBottom: $('kob-lb'),
    btnTheme: $('kob-btn-theme'), fxPanel: null, hud: $('kob-hud')
  };
  var mode = 'play';
  var lastAct = performance.now();
  var hiddenByUser = false;
  var autoHidden = false;

  function fmt(t) {
    var m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* ---- 时间轴 ---- */
  (function buildTimeline() {
    if (!els.timeline) return;
    els.timeline.innerHTML = '';
    SHOW.CHAPTERS.forEach(function (ch, i) {
      var seg = document.createElement('div');
      seg.className = 'kob-tl-seg';
      seg.style.flex = (ch.t1 - ch.t0) + '';
      seg.dataset.i = i;
      seg.title = '';
      seg.addEventListener('click', function () { ctx.main.seek(ch.t0 + 0.01); });
      seg.addEventListener('mouseenter', function () {
        if (els.tlHover) {
          els.tlHover.textContent = String(ch.n).padStart(2, '0') + ' ' + ch.cn + ' · ' + ch.en;
          els.tlHover.style.opacity = 1;
        }
      });
      seg.addEventListener('mouseleave', function () { if (els.tlHover) els.tlHover.style.opacity = 0; });
      els.timeline.appendChild(seg);
    });
  })();

  /* ---- 指针进度 ---- */
  var tlBar = null;
  if (els.timeline) {
    tlBar = document.createElement('div');
    tlBar.className = 'kob-tl-bar';
    els.timeline.appendChild(tlBar);
  }

  /* ---- 品质菜单 ---- */
  (function buildQMenu() {
    if (!els.qmenu) return;
    ['auto', 'low', 'medium', 'high', 'ultra'].forEach(function (q) {
      var b = document.createElement('button');
      b.className = 'kob-q-opt';
      b.dataset.q = q;
      b.textContent = q.toUpperCase();
      if (q === P.quality) b.classList.add('on');
      b.addEventListener('click', function () {
        ctx.main.setQuality(q);
        els.qmenu.querySelectorAll('.kob-q-opt').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      });
      els.qmenu.appendChild(b);
    });
    var info = document.createElement('div');
    info.className = 'kob-q-info';
    info.textContent = 'BUILD ' + window.KOB.BUILD;
    els.qmenu.appendChild(info);
  })();

  function bind(el, ev, fn) { if (el) el.addEventListener(ev, fn); }
  bind(els.btnSound, 'click', function () { ctx.main.toggleSound(); syncSound(ctx.audio && ctx.audio.isOn()); });
  bind(els.btnFull, 'click', function () { ctx.main.fullscreen(); });
  bind(els.btnHide, 'click', function () { hideByUser(); });
  bind(els.btnTheme, 'click', function () { setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); });
  bind(els.btnQuality, 'click', function (e) { if (els.qmenu) els.qmenu.classList.toggle('open'); e.stopPropagation(); });
  bind(document, 'click', function (e) {
    if (els.qmenu && els.qmenu.classList.contains('open') && !els.qmenu.contains(e.target)) els.qmenu.classList.remove('open');
  });
  bind(els.modePlay, 'click', function () { ctx.main.setMode('play'); });
  bind(els.modeFree, 'click', function () { ctx.main.setMode('free'); });
  bind(els.backShow, 'click', function () { ctx.main.setMode('play'); });
  bind(els.btnPlay, 'click', function () { ctx.main.togglePause(); });
  bind(els.eye, 'click', function () { hiddenByUser = false; restoreUI(); });

  function syncSound(on) {
    if (!els.btnSound) return;
    els.btnSound.classList.toggle('on', !!on);
    els.btnSound.classList.toggle('off', !on);
  }
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    if (els.btnTheme) els.btnTheme.classList.toggle('on', t === 'light');
    try { localStorage.setItem('kob.theme', t); } catch (e) { }
  }
  setTheme(document.documentElement.getAttribute('data-theme') || 'light');

  /* ---- 模式 ---- */
  function setMode(m) {
    mode = m;
    if (els.modePlay) els.modePlay.classList.toggle('on', m === 'play');
    if (els.modeFree) els.modeFree.classList.toggle('on', m === 'free');
    if (els.backShow) els.backShow.classList.toggle('show', m === 'free');
    document.body.classList.toggle('kob-free', m === 'free');
    if (els.letterTop) els.letterTop.classList.toggle('show', m === 'play' && P.letterbox);
    if (els.letterBottom) els.letterBottom.classList.toggle('show', m === 'play' && P.letterbox);
  }

  /* ---- 章节卡 / 字卡 ---- */
  var cardTimer = null;
  function chapterCard(ch) {
    if (!els.chapterCard || !P.titles) return;
    els.chapterCard.querySelector('.kob-cc-n').textContent = String(ch.n).padStart(2, '0');
    els.chapterCard.querySelector('.kob-cc-cn').textContent = ch.cn;
    els.chapterCard.querySelector('.kob-cc-en').textContent = ch.en;
    els.chapterCard.classList.add('show');
    clearTimeout(cardTimer);
    cardTimer = setTimeout(function () { els.chapterCard.classList.remove('show'); }, 3000);
  }
  var titleTimer = null;
  function titles(cn, en) {
    if (!els.titleCard || !P.titles) return;
    els.titleCard.querySelector('.kob-tc-cn').textContent = cn;
    els.titleCard.querySelector('.kob-tc-en').textContent = en;
    els.titleCard.classList.remove('bye');
    els.titleCard.classList.add('show');
    clearTimeout(titleTimer);
    titleTimer = setTimeout(function () {
      els.titleCard.classList.add('bye');
      setTimeout(function () { els.titleCard.classList.remove('show', 'bye'); }, 1200);
    }, 4200);
  }

  /* ---- 自动隐藏 ---- */
  ['pointermove', 'pointerdown', 'keydown', 'wheel'].forEach(function (ev) {
    window.addEventListener(ev, function () { lastAct = performance.now(); restoreUI(); }, { passive: true });
  });
  function restoreUI() {
    if (!hiddenByUser && autoHidden) {
      autoHidden = false;
      if (els.topbar) els.topbar.classList.remove('faded');
      if (els.bottombar) els.bottombar.classList.remove('faded');
    }
  }
  function hideByUser() {
    hiddenByUser = true;
    if (els.topbar) els.topbar.classList.add('faded');
    if (els.bottombar) els.bottombar.classList.add('faded');
    if (els.eye) els.eye.classList.add('show');
    if (els.qmenu) els.qmenu.classList.remove('open');
  }
  function unhideByUser() {
    hiddenByUser = false;
    if (els.eye) els.eye.classList.remove('show');
    restoreUI();
  }
  ctx.uiUnhide = unhideByUser;

  function autohideTick() {
    if (mode !== 'play' || hiddenByUser || P.autohide <= 0) return;
    if (!autoHidden && performance.now() - lastAct > P.autohide * 1000) {
      autoHidden = true;
      if (els.topbar) els.topbar.classList.add('faded');
      if (els.bottombar) els.bottombar.classList.add('faded');
      if (els.qmenu) els.qmenu.classList.remove('open');
    }
  }

  /* ---- 时钟 / 统计 ---- */
  var statFrame = 0;
  function tick(t, paused) {
    var chIdx = SHOW.chapterAt(t);
    var ch = SHOW.CHAPTERS[chIdx];
    if (els.clock) els.clock.textContent = fmt(t) + ' / 2:15';
    if (els.chapname) els.chapname.textContent = String(ch.n).padStart(2, '0') + ' · ' + ch.cn;
    if (els.btnPlay) {
      els.btnPlay.textContent = paused ? '▶' : '❚❚';
      els.btnPlay.classList.toggle('paused', !!paused);
    }
    var k = t / SHOW.DURATION;
    if (tlBar) tlBar.style.width = (k * 100) + '%';
    if (els.timeline) {
      var segs = els.timeline.querySelectorAll('.kob-tl-seg');
      segs.forEach(function (s, i) { s.classList.toggle('past', i < chIdx); s.classList.toggle('cur', i === chIdx); });
    }
    autohideTick();
    statFrame++;
    if (P.stats && els.stats && statFrame % 30 === 0) {
      var st = ctx.main.stats();
      if (st) els.stats.textContent =
        'FPS ' + st.fps + '  ·  ' + st.res + '  ·  CALLS ' + st.calls + '  ·  灯 ' + st.lights + '  ·  ' + st.gpu;
    }
    if (els.stats) els.stats.style.display = P.stats ? 'block' : 'none';
  }

  function setPaused() { /* tick 覆盖 */ }

  var fxLights = {};
  function fxIndicator(id, on) {
    fxLights[id] = on;
    if (ctx.deck) ctx.deck.syncFxLights(fxLights);
  }
  function tourStatus(e) {
    if (ctx.deck) ctx.deck.tourStatus(e);
  }

  function applyUiParam() {
    document.body.classList.toggle('no-ui', !P.ui);
  }
  applyUiParam();

  window.KOB_UI = {
    setMode: setMode,
    tick: tick,
    chapterCard: chapterCard,
    titles: titles,
    fxIndicator: fxIndicator,
    tourStatus: tourStatus,
    syncSound: syncSound,
    toast: function (msg) {
      var t = document.createElement('div');
      t.className = 'kob-toast';
      t.textContent = msg;
      document.body.appendChild(t);
      requestAnimationFrame(function () { t.classList.add('in'); });
      setTimeout(function () { t.classList.remove('in'); setTimeout(function () { t.remove(); }, 500); }, 2400);
    }
  };
  ctx.ui = window.KOB_UI;
});
})();
