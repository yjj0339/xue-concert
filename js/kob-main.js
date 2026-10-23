/* kob-main.js — 启动引导：CDN 探测(importmap) → three r160 → 场馆模型(GLB/base64 双策略) → 模块装配 → 演出循环（导演相机/自由相机/节拍时钟/画质管理/__viewer 接口） */
(function () {
'use strict';
window.KOB_FILE_BUILD = '20261023.1';
window.KOB.report('kob-main');

var P = window.KOB_PARAMS, SHOW = window.KOB_SHOW, GLSL = window.KOB_GLSL;
var BUILD = window.KOB.BUILD;

/* ================= 启动画面进度 ================= */
var bootEl = document.getElementById('kob-boot');
var bootBar = document.getElementById('kob-boot-bar');
var bootMsg = document.getElementById('kob-boot-msg');
var enterBox = document.getElementById('kob-enter');
function prog(pct, msg) {
  if (bootBar) bootBar.style.width = Math.round(pct * 100) + '%';
  if (bootMsg && msg) bootMsg.textContent = msg;
}
function bootFail(msg) {
  prog(1, msg);
  if (bootEl) bootEl.classList.add('fail');
  var hint = document.getElementById('kob-boot-hint');
  if (hint) hint.textContent = '可尝试在网址后加 ?cdn=npmmirror 强制国内镜像，或 Ctrl+F5 强制刷新';
}

/* ================= 构建号校验：不一致自动重载一次 ================= */
(function buildCheck() {
  var bad = window.KOB.FILES.some(function (f) { return f.build !== BUILD; });
  if (!bad) return;
  try {
    if (!sessionStorage.getItem('kob.reloaded')) {
      sessionStorage.setItem('kob.reloaded', '1');
      var u = new URL(location.href);
      u.searchParams.set('_ts', String(Date.now()));
      location.replace(u.toString());
      throw new Error('reloading');
    }
    console.warn('[KOB] 脚本版本不一致，请 Ctrl+F5 强制刷新');
  } catch (e) { /* 重载中 */ }
})();

/* ================= CDN 探测 ================= */
var CDNS = {
  jsdelivr: 'https://cdn.jsdelivr.net/npm/three@0.160.0/',
  unpkg: 'https://unpkg.com/three@0.160.0/',
  npmmirror: 'https://registry.npmmirror.com/three/0.160.0/files/'
};
function probe(base) {
  var ctl = new AbortController();
  var tm = setTimeout(function () { ctl.abort(); }, 6000);
  return fetch(base + 'package.json', { cache: 'no-store', signal: ctl.signal })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return base; })
    .finally(function () { clearTimeout(tm); });
}
function pickCdn() {
  if (P.cdn !== 'auto' && CDNS[P.cdn]) return Promise.resolve(CDNS[P.cdn]);
  return probe(CDNS.jsdelivr)
    .catch(function () { return probe(CDNS.unpkg); })
    .catch(function () { return probe(CDNS.npmmirror); });
}

/* ================= 主流程 ================= */
pickCdn().then(function (base) {
  prog(0.08, '加载 three.js · ' + base.split('/')[2]);
  var imp = document.createElement('script');
  imp.type = 'importmap';
  imp.textContent = JSON.stringify({
    imports: {
      'three': base + 'build/three.module.js',
      'three/addons/': base + 'examples/jsm/'
    }
  });
  document.head.appendChild(imp);
  return Promise.all([
    import('three'),
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/loaders/DRACOLoader.js'),
    import('three/addons/controls/OrbitControls.js')
  ]).then(function (mods) {
    return { base: base, mods: mods };
  });
}).then(function (res) {
  var base = res.base;
  var T = res.mods[0], GLTFLoader = res.mods[1].GLTFLoader, DRACOLoader = res.mods[2].DRACOLoader, OrbitControls = res.mods[3].OrbitControls;

  /* ---- 渲染器 ---- */
  var canvas = document.getElementById('kob-canvas');
  var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  if (!renderer.capabilities.isWebGL2) { bootFail('当前浏览器不支持 WebGL2，无法演出'); return; }
  renderer.toneMapping = T.NoToneMapping;
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(50, 1, 0.5, 9000);
  camera.position.set(-320, 8, 160);

  var gpuName = '';
  try {
    var gl = renderer.getContext();
    var dbg = gl.getExtension('WEBGL_debug_renderer_info');
    gpuName = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'GPU';
  } catch (e) { gpuName = 'GPU'; }

  /* ---- 模型 ---- */
  prog(0.22, '加载场馆模型');
  var draco = new DRACOLoader();
  draco.setDecoderPath(base + 'examples/jsm/libs/draco/gltf/');
  var loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  function loadModel() {
    var isHttp = location.protocol === 'http:' || location.protocol === 'https:';
    var p = isHttp
      ? fetch('model.glb', { cache: 'force-cache' }).then(function (r) {
        if (!r.ok) throw new Error('glb ' + r.status);
        return r.arrayBuffer();
      }).catch(function () { return fromB64(); })
      : fromB64();
    return p.then(function (buf) {
      prog(0.45, 'Draco 解压');
      return loader.parseAsync(buf, '');
    });
  }
  function fromB64() {
    var b64 = window.__KOB_MODEL_B64;
    if (!b64) return Promise.reject(new Error('无内嵌模型'));
    prog(0.3, '解码内嵌场馆模型');
    var bin = atob(b64), buf = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return Promise.resolve(buf.buffer);
  }

  loadModel().then(function (gltf) {
    prog(0.6, '装配灯光 / 激光 / 烟花');
    var stadium = gltf.scene;
    /* 烘焙世界矩阵，收集契约对象 */
    stadium.updateMatrixWorld(true);
    var refs = {};
    stadium.traverse(function (o) {
      if (o.isMesh) {
        o.frustumCulled = false;
        if (o.geometry && !o.geometry.boundingBox) o.geometry.computeBoundingBox();
        if (refs[o.name] === undefined) refs[o.name] = o;
        if (o.name.indexOf('STAND_') === 0) {
          var gg = o.geometry.clone();
          gg.applyMatrix4(o.matrixWorld);
          o.geometry = gg;
          o.matrixWorld.identity(); o.position.set(0, 0, 0); o.updateMatrix();
          refs[o.name] = o;
        }
      }
    });
    var stands = [refs.STAND_LOWER, refs.STAND_MIDDLE, refs.STAND_UPPER].filter(Boolean);
    scene.add(stadium);
    /* 基础光（非演出灯，仅保底可见度；演出灯走自定义灯光循环） */
    scene.add(new T.HemisphereLight(0x4a5a80, 0x1a130d, 1.25));
    var dir = new T.DirectionalLight(0x90a0c8, 0.6);
    dir.position.set(-300, 400, 200);
    scene.add(dir);
    /* 屋顶环带 / 兽塔光带：微自发光，夜色中勾勒轮廓 */
    stadium.traverse(function (o) {
      if (o.isMesh && o.material && o.material.name) {
        if (o.material.name === 'MAT_RIM' || o.material.name === 'MAT_BAND') {
          o.material.emissive = new T.Color(0x5a3010);
          o.material.emissiveIntensity = 1.2;
        }
      }
    });

    /* ---- 上下文与模块装配 ---- */
    var ctx = {
      THREE: T, scene: scene, camera: camera, renderer: renderer,
      params: P, GLSL: GLSL, show: SHOW, refs: refs, stands: stands,
      addons: { OrbitControls: OrbitControls },
      focusDist: 120, glow: null, gpuName: gpuName,
      main: null, fx: null, sfx: null, world: null, ui: null, deck: null, audio: null, post: null
    };
    window.__KOB_CTX = ctx;
    prog(0.72, '编译着色器');
    try {
      window.KOB.ready.forEach(function (fn) { fn(ctx); });
    } catch (e) {
      console.error(e);
      bootFail('模块初始化失败：' + (e && e.message));
      return;
    }
    start(ctx, T, OrbitControls);
  }).catch(function (e) {
    console.error(e);
    bootFail('场馆模型加载失败：' + (e && e.message));
  });
}).catch(function (e) {
  console.error(e);
  bootFail('three.js CDN 全部不可达（jsDelivr / unpkg / npmmirror）');
});

/* ================= 运行时 ================= */
function start(ctx, T, OrbitControls) {
  var renderer = ctx.renderer, scene = ctx.scene, camera = ctx.camera;
  var P = ctx.params, SHOW = ctx.show;
  var controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxDistance = 5000;
  controls.minDistance = 1.5;
  controls.enabled = false;
  ctx.controls = controls;

  function B(x, y, z) { return new T.Vector3(x, z, -y); }
  /* three → Blender（供小地图） */
  function camB() {
    var p = camera.position;
    var fx = new T.Vector3();
    camera.getWorldDirection(fx);
    return { x: p.x, y: -p.z, yaw: Math.atan2(fx.z, -fx.x) };
  }

  /* ---- 状态 ---- */
  var mode = 'play';
  var paused = false;
  var showTime = P.t || 0;
  if (P.chapter) showTime = SHOW.CHAPTERS[P.chapter - 1].t0 + 0.01;
  var lastChapter = -1;
  var started = false;

  /* ---- cue 分发 ---- */
  function fireCue(ev, a) {
    if (ev === 'titles') { if (ctx.ui) ctx.ui.titles(a.cn, a.en); return; }
    if (ev === 'curtain') return;
    if (ctx.fx) ctx.fx.handle(ev, a);
  }
  SHOW.initCues(fireCue);

  /* ---- 画质 ---- */
  var TIERS = {
    low:    { budget: 0.55e6, samples: 0, dofTaps: 0,  qMul: 0.45, bloom: 1 },
    medium: { budget: 1.0e6,  samples: 2, dofTaps: 12, qMul: 0.7,  bloom: 1 },
    high:   { budget: 1.9e6,  samples: 2, dofTaps: 20, qMul: 1.0,  bloom: 1 },
    ultra:  { budget: 3.6e6,  samples: 4, dofTaps: 28, qMul: 1.25, bloom: 1 }
  };
  var qualityName = P.quality;
  var userQuality = P.quality !== 'auto';
  var renderScale = 1;
  function autoTier() {
    var g = String(ctx.gpuName || '').toLowerCase();
    var mob = /android|iphone|ipad|mobile/i.test(navigator.userAgent);
    if (mob || /swiftshader|software|llvmpipe/.test(g)) return 'low';
    if (/apple m|iris|integrated|uhd graphics|hd graphics/.test(g)) return 'medium';
    if (/nvidia|radeon|rtx|gtx|rx \d/.test(g)) return 'high';
    return 'medium';
  }
  if (qualityName === 'auto') qualityName = autoTier();
  function applyTier(name) {
    qualityName = name;
    var t = TIERS[name];
    var w = window.innerWidth, h = window.innerHeight;
    var s = Math.sqrt(t.budget / Math.max(1, w * h));
    renderScale = Math.max(0.4, Math.min(2, s));
    if (P.scale) renderScale = P.scale;
    ctx.post.applyQuality({ samples: t.samples, dofTaps: t.dofTaps, bloom: t.bloom });
    if (ctx.fx) ctx.fx.applyQuality(t.qMul);
    resize();
  }
  function setQuality(name) {
    if (name === 'auto') { userQuality = false; applyTier(autoTier()); return; }
    userQuality = true;
    applyTier(name);
  }
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(1);
    renderer.setSize(Math.max(2, Math.floor(w * renderScale)), Math.max(2, Math.floor(h * renderScale)), false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    ctx.post.resize(w, h, renderScale);
  }
  window.addEventListener('resize', resize);
  applyTier(qualityName);

  /* ---- 自适应：帧率不足先降比例再降档 ---- */
  var fpsEMA = 60, adaptT = 0, lowSteps = 0, highT = 0;
  function adapt(dt) {
    fpsEMA = fpsEMA * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;
    adaptT += dt;
    if (adaptT < 2) return;
    adaptT = 0;
    if (userQuality && P.quality !== 'auto') return;
    if (fpsEMA < 33) {
      lowSteps++;
      var t = TIERS[qualityName];
      if (renderScale > 0.45 && P.scale == null) {
        renderScale = Math.max(0.45, renderScale * 0.86);
        resize();
      } else if (qualityName !== 'low') {
        var order = ['low', 'medium', 'high', 'ultra'];
        applyTier(order[Math.max(0, order.indexOf(qualityName) - 1)]);
      }
    } else if (fpsEMA > 57) {
      lowSteps = 0; highT++;
      if (highT >= 5 && P.scale == null) {
        highT = 0;
        var tgt = Math.sqrt(TIERS[qualityName].budget / Math.max(1, window.innerWidth * window.innerHeight));
        tgt = Math.max(0.4, Math.min(2, tgt));
        if (renderScale < tgt) { renderScale = Math.min(tgt, renderScale * 1.06); resize(); }
      }
    } else highT = 0;
  }

  /* ---- 导演相机 ---- */
  var camOut = { v: [0, 0, 0, 0, 0, 0, 0], lens: 35 };
  var shakeT = 0;
  function lensToFov(mm) { return 2 * Math.atan(12 / mm) * 180 / Math.PI; }
  function updatePlayCam(dt) {
    SHOW.camAt(showTime, camOut);
    var v = camOut.v;
    camera.position.set(v[1], v[3], -v[2]);
    camera.lookAt(v[4], v[6], -v[5]);
    camera.fov = lensToFov(camOut.lens);
    camera.updateProjectionMatrix();
    /* 手持 + 冲击抖动 */
    var sh = P.shake;
    if (sh > 0) {
      shakeT += dt;
      var amp = 0.06 * sh + (ctx.fx && ctx.fx.state.strobe > 0 ? 0.04 : 0);
      camera.position.x += Math.sin(shakeT * 13.7) * amp + Math.sin(shakeT * 2.1) * amp * 0.6;
      camera.position.y += Math.cos(shakeT * 11.3) * amp * 0.7;
      camera.rotateZ(Math.sin(shakeT * 5.3) * 0.0012 * sh);
    }
    ctx.focusDist = camera.position.distanceTo(new T.Vector3(v[4], v[6], -v[5]));
  }

  /* ---- 自由飞行 ---- */
  var keys = {};
  window.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    keys[e.code] = true;
    handleKey(e);
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  var flyV = new T.Vector3(), flyRight = new T.Vector3(), flyFwd = new T.Vector3();
  function updateFreeCam(dt) {
    controls.update();
    var sp = (keys['ShiftLeft'] || keys['ShiftRight'] ? 240 : 80) * dt;
    flyFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    flyRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    flyV.set(0, 0, 0);
    if (keys['KeyW']) flyV.add(flyFwd);
    if (keys['KeyS']) flyV.sub(flyFwd);
    if (keys['KeyD']) flyV.add(flyRight);
    if (keys['KeyA']) flyV.sub(flyRight);
    if (keys['KeyE']) flyV.y += 1;
    if (keys['KeyQ']) flyV.y -= 1;
    if (flyV.lengthSq() > 0) {
      flyV.normalize().multiplyScalar(sp);
      camera.position.add(flyV);
      controls.target.add(flyV);
    }
    ctx.focusDist = camera.position.distanceTo(controls.target);
  }

  /* ---- 按键 ---- */
  function handleKey(e) {
    var k = e.key;
    if (k === ' ') {
      if (mode === 'play') { setMode('free'); e.preventDefault(); }
    } else if (k === 'm' || k === 'M') {
      toggleSound();
    } else if (k === 'h' || k === 'H') {
      if (ctx.uiUnhide && document.getElementById('kob-eye') && document.getElementById('kob-eye').classList.contains('show')) ctx.uiUnhide();
      else if (ctx.ui) document.getElementById('kob-btn-hide') && document.getElementById('kob-btn-hide').click();
    } else if (k === 'f' || k === 'F') {
      fullscreen();
    } else if (k === 'k' || k === 'K') {
      if (mode === 'play') togglePause();
    } else if (k === 'Escape') {
      if (ctx.deck) ctx.deck.close();
    } else if (k === 'ArrowLeft' && mode === 'play') {
      var ci = SHOW.chapterAt(showTime);
      seek(Math.max(0, SHOW.CHAPTERS[Math.max(0, ci - (showTime - SHOW.CHAPTERS[ci].t0 < 1.2 ? 1 : 0))].t0 + 0.01));
    } else if (k === 'ArrowRight' && mode === 'play') {
      var ci2 = SHOW.chapterAt(showTime);
      seek(SHOW.CHAPTERS[Math.min(9, ci2 + 1)].t0 + 0.01);
    } else if (/^[0-9]$/.test(k)) {
      flyTo(k === '0' ? 9 : parseInt(k, 10) - 1);
    }
  }
  function toggleSound() {
    if (!ctx.audio) return;
    var on = ctx.audio.toggle();
    if (ctx.ui) ctx.ui.syncSound(on);
  }
  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
  }

  /* ---- 模式 ---- */
  function setMode(m, silent) {
    if (m === mode) return;
    mode = m;
    controls.enabled = (m === 'free');
    if (m === 'free') {
      controls.target.copy(camera.position.clone().add(camera.getWorldDirection(new T.Vector3()).multiplyScalar(ctx.focusDist || 60)));
    }
    if (ctx.ui) ctx.ui.setMode(m);
    freeActT = performance.now();
    document.body.classList.toggle('kob-mode-free', m === 'free');
  }
  var freeActT = performance.now();
  ['pointerdown', 'pointermove', 'keydown', 'wheel'].forEach(function (ev) {
    window.addEventListener(ev, function () { freeActT = performance.now(); }, { passive: true });
  });

  /* ---- flyTo ---- */
  var flyAnim = null;
  function flyTo(idx, immediate) {
    if (idx < 0 || idx >= SHOW.VIEWS.length) return;
    var v = SHOW.VIEWS[idx];
    var pos = B(v.pos[0], v.pos[1], v.pos[2]);
    var tgt = B(v.tgt[0], v.tgt[1], v.tgt[2]);
    if (mode !== 'free') setMode('free');
    controls.enabled = false;
    if (immediate) {
      camera.position.copy(pos);
      controls.target.copy(tgt);
      camera.lookAt(tgt);
      camera.fov = lensToFov(v.lens);
      camera.updateProjectionMatrix();
      controls.enabled = true;
      return;
    }
    var p0 = camera.position.clone(), t0 = controls.target.clone();
    var mid = p0.clone().add(pos).multiplyScalar(0.5);
    mid.y += p0.distanceTo(pos) * 0.22 + 6;
    flyAnim = { t: 0, p0: p0, p1: mid, p2: pos, t0: t0, t1: tgt, lens0: camera.fov, lens1: lensToFov(v.lens) };
  }
  function flyToPoint(bx, by, bz, dist) {
    if (mode !== 'free') setMode('free');
    var tgt = B(bx, by, 0);
    var dir = new T.Vector3(0.4, 0.25, 1).normalize();
    var pos = tgt.clone().add(dir.multiplyScalar(dist || 40));
    pos.y = Math.max(bz + 6, pos.y);
    flyAnim = { t: 0, p0: camera.position.clone(), p1: camera.position.clone().lerp(pos, 0.5).add(new T.Vector3(0, 30, 0)), p2: pos, t0: controls.target.clone(), t1: tgt, lens0: camera.fov, lens1: 45 };
    controls.enabled = false;
  }
  function updateFly(dt) {
    if (!flyAnim) return;
    flyAnim.t += dt / 2.0;
    var k = Math.min(1, flyAnim.t);
    var e = k * k * (3 - 2 * k);
    var a = flyAnim.p0.clone().lerp(flyAnim.p1, e);
    var b = flyAnim.p1.clone().lerp(flyAnim.p2, e);
    camera.position.copy(a.lerp(b, e));
    controls.target.copy(flyAnim.t0.clone().lerp(flyAnim.t1, e));
    camera.lookAt(controls.target);
    camera.fov = flyAnim.lens0 + (flyAnim.lens1 - flyAnim.lens0) * e;
    camera.updateProjectionMatrix();
    if (k >= 1) { flyAnim = null; controls.enabled = true; }
  }

  /* ---- seek / 暂停 ---- */
  function seek(t) {
    showTime = Math.max(0, Math.min(SHOW.DURATION - 0.01, t));
    SHOW.resetTo(showTime);
    if (ctx.fx) { ctx.fx.resetTransient(); ctx.fx.seekTo(showTime); }
    if (ctx.audio) ctx.audio.seek(showTime);
    lastChapter = -1;
    /* 快进补发射到当前时刻之前的 cue（一次性静默触发灯光状态） */
  }
  function togglePause() {
    paused = !paused;
    var btn = document.getElementById('kob-btn-play');
    if (btn) btn.classList.toggle('paused', paused);
  }

  /* ---- 启动门 ---- */
  function enter(withSound) {
    if (started) return;
    started = true;
    if (withSound && ctx.audio) {
      ctx.audio.start();
      if (ctx.ui) ctx.ui.syncSound(true);
    } else if (P.audio && ctx.audio) {
      ctx.audio.start();
      if (ctx.ui) ctx.ui.syncSound(true);
    }
    if (bootEl) bootEl.classList.add('gone');
    setTimeout(function () { if (bootEl && bootEl.parentNode) bootEl.parentNode.removeChild(bootEl); }, 900);
    if (P.mode === 'free') {
      setMode('free');
      if (P.view != null) flyTo(P.view, true);
      else flyTo(1, true);
    }
  }
  var btnS = document.getElementById('kob-enter-sound');
  var btnM = document.getElementById('kob-enter-mute');
  if (btnS) btnS.addEventListener('click', function () { enter(true); });
  if (btnM) btnM.addEventListener('click', function () { enter(false); });

  /* ---- 主循环 ---- */
  var lastT = performance.now();
  var fpsCapAcc = 0;
  var loopRunning = true;
  if (P.capture) loopRunning = false;   // capture 模式关循环，用 __viewer.renderAt
  var statsCalls = 0;

  function frame() {
    if (!loopRunning) return;
    requestAnimationFrame(frame);
    var now = performance.now();
    var dt = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;
    if (P.fps > 0) {
      fpsCapAcc += dt;
      if (fpsCapAcc < 1 / P.fps) return;
      dt = fpsCapAcc; fpsCapAcc = 0;
    }
    /* 演出时钟 */
    if (!paused && started) {
      var prev = showTime;
      showTime += dt * P.speed;
      if (showTime >= SHOW.DURATION) {
        if (P.loop) {
          showTime -= SHOW.DURATION;
          SHOW.resetTo(showTime);
          if (ctx.audio) ctx.audio.seek(showTime);
          lastChapter = -1;
        } else {
          showTime = SHOW.DURATION - 0.001;
          paused = true;
        }
      }
      SHOW.tickCues(prev, showTime, fireCue);
      if (ctx.audio) ctx.audio.update(showTime, P.speed, true);
    }
    /* 章节卡 */
    var ci = SHOW.chapterAt(showTime);
    if (ci !== lastChapter) {
      lastChapter = ci;
      if (started && ctx.ui) ctx.ui.chapterCard(SHOW.CHAPTERS[ci]);
    }
    /* 相机 */
    if (flyAnim) updateFly(dt);
    else if (mode === 'play') updatePlayCam(dt);
    else {
      updateFreeCam(dt);
      if (P.idle > 0 && performance.now() - freeActT > P.idle * 1000) setMode('play');
    }
    /* 模块更新 */
    if (ctx.fx) ctx.fx.update(dt, showTime, camera);
    if (ctx.world) ctx.world.update(dt, showTime, camera);
    if (ctx.sfx) ctx.sfx.update(dt);
    if (ctx.deck) ctx.deck.update();
    if (ctx.ui) ctx.ui.tick(showTime, paused);
    adapt(dt);
    /* 渲染 */
    ctx.post.render(scene, camera);
    statsCalls = renderer.info.render.calls;
  }

  /* ---- 预热首帧（在门后面渲染一帧避免进入卡顿） ---- */
  resize();
  updatePlayCam(0.016);
  if (ctx.fx) ctx.fx.update(0.016, showTime, camera);
  if (ctx.world) ctx.world.update(0.016, showTime, camera);
  ctx.post.render(scene, camera);
  prog(1, '就绪');
  if (enterBox) enterBox.classList.add('ready');
  if (!P.gate) enter(false);
  if (loopRunning) requestAnimationFrame(frame);

  /* ---- 统计 ---- */
  function stats() {
    return {
      fps: Math.round(fpsEMA),
      res: Math.floor(window.innerWidth * renderScale) + '×' + Math.floor(window.innerHeight * renderScale),
      calls: statsCalls,
      lights: 24,
      gpu: ctx.gpuName || 'GPU'
    };
  }

  /* ---- renderAt / bench ---- */
  var CAP_W = 1280, CAP_H = 580;
  function renderAt(t, opts) {
    opts = opts || {};
    var keepMode = mode, keepPaused = paused;
    if (opts.mode === 'free' || opts.mode === 'play') mode = opts.mode;
    paused = true;
    showTime = Math.max(0, Math.min(SHOW.DURATION - 0.01, t));
    if (opts.view != null && opts.mode === 'free') flyTo(opts.view, true);
    if (mode === 'play') updatePlayCam(0);
    SHOW.resetTo(0);
    SHOW.tickCues(0, showTime, fireCue);
    if (ctx.fx) ctx.fx.update(0.05, showTime, camera);
    if (ctx.world) ctx.world.update(0.05, showTime, camera);
    var keepScale = renderScale;
    if (opts.quality) { applyTier(opts.quality); }
    ctx.post.render(scene, camera, ctx.post.snapRT());
    var dims = ctx.post.dims();
    var buf = ctx.post.readPixels(dims.w, dims.h);
    var cv = document.createElement('canvas');
    var w = Math.min(CAP_W, dims.w), h = Math.floor(w * dims.h / dims.w);
    cv.width = w; cv.height = h;
    var g = cv.getContext('2d');
    var img = g.createImageData(w, h);
    /* 翻转 Y + 缩放行采样 */
    var sx = dims.w / w;
    for (var y = 0; y < h; y++) {
      var sy = Math.floor((dims.h - 1 - y * dims.h / h) * sx) * 0 + Math.floor(dims.h - 1 - y * dims.h / h);
      for (var x = 0; x < w; x++) {
        var sxi = Math.floor(x * sx);
        var si = (Math.floor(dims.h - 1 - y * dims.h / h) * dims.w + sxi) * 4;
        var di = (y * w + x) * 4;
        img.data[di] = buf[si]; img.data[di + 1] = buf[si + 1]; img.data[di + 2] = buf[si + 2]; img.data[di + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    mode = keepMode; paused = keepPaused;
    if (opts.quality) { renderScale = keepScale; resize(); }
    SHOW.resetTo(showTime);
    return cv.toDataURL('image/jpeg', 0.85);
  }
  function bench(t, frames) {
    frames = frames || 60;
    showTime = t;
    var t0 = performance.now();
    for (var i = 0; i < frames; i++) {
      updatePlayCam(0.016);
      ctx.post.render(scene, camera);
    }
    var ms = (performance.now() - t0) / frames;
    return { fps: Math.round(1000 / ms), ms: Math.round(ms * 10) / 10, frames: frames };
  }

  /* ---- 开发者接口 ---- */
  window.__viewer = {
    scene: scene, camera: camera, controls: controls,
    get VIEWS() { return SHOW.VIEWS.map(function (v) { return { name: v.cn, nameEn: v.en, pos: B(v.pos[0], v.pos[1], v.pos[2]), tgt: B(v.tgt[0], v.tgt[1], v.tgt[2]), posB: v.pos, tgtB: v.tgt, lens: v.lens }; }); },
    flyTo: flyTo,
    setMode: function (m) { setMode(m); },
    seek: seek,
    get showTime() { return showTime; },
    get state() { return { mode: mode, paused: paused, chapter: SHOW.chapterAt(showTime) + 1, started: started }; },
    get quality() { return qualityName; },
    setQuality: setQuality,
    renderAt: renderAt,
    bench: bench,
    stats: stats,
    fx: function () { return ctx.fx; },
    sfx: function () { return ctx.sfx; }
  };

  /* ctx.main 补齐（模块里用到） */
  ctx.main = {
    setMode: function (m) { setMode(m); },
    seek: seek,
    togglePause: togglePause,
    toggleSound: toggleSound,
    fullscreen: fullscreen,
    setQuality: function (q) { userQuality = true; setQuality(q); },
    flyTo: flyTo,
    flyToPoint: flyToPoint,
    camB: camB,
    stats: stats
  };
}
})();
