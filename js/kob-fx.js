/* kob-fx.js — 特效系统：粒子池 / 光束 / 激光 / 频闪 / 烟花 / 火焰 / 人群 / 表演者 / 无人机 / 灯牌 / 雾 / 星河 / 镜球 / 全息 / 冲击波 / 光环 / 火环 / 自定义灯光循环 */
(function () {
'use strict';
window.KOB_FILE_BUILD = '20261023.1';
window.KOB.report('kob-fx');

window.KOB.onReady(function (ctx) {
  var T = ctx.THREE, scene = ctx.scene, camera = ctx.camera, P = ctx.params, G = ctx.GLSL;
  var SHOW = ctx.show;
  function B(x, y, z) { return new T.Vector3(x, z, -y); } // Blender → three
  var rng = (function () { var s = P.seed * 2654435761 % 2147483647; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
  function R(a, b) { return a + rng() * (b - a); }

  var qMul = 1.0; // 画质粒子/灯数倍率
  var fxGroup = new T.Group(); scene.add(fxGroup);
  var state = {
    showTime: 0, beat: 0, mood: SHOW.moodAt(0),
    strobe: 0, surge: 0, ledPower: 0, ledRise: false,
    mirror: false, fire: 0, co2T: 0, tornado: [0, 0, 0, 0],
    goldrain: false, holo: 0, firering: false, laserh: false,
    running: {}   // 特效面板指示
  };
  function running(name, on) { state.running[name] = on; if (ctx.ui) ctx.ui.fxIndicator(name, on); }

  /* ============ 粒子池 ============ */
  var POOL_N = 24000;
  var pool = (function () {
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(POOL_N * 3), vel = new Float32Array(POOL_N * 3);
    var col = new Float32Array(POOL_N * 3);
    var t0 = new Float32Array(POOL_N), life = new Float32Array(POOL_N);
    var size = new Float32Array(POOL_N), type = new Float32Array(POOL_N), seed = new Float32Array(POOL_N);
    for (var i = 0; i < POOL_N; i++) { t0[i] = -1e9; life[i] = 1; pos[i * 3 + 1] = -999; }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('aVel', new T.BufferAttribute(vel, 3));
    geo.setAttribute('aColor', new T.BufferAttribute(col, 3));
    geo.setAttribute('aT0', new T.BufferAttribute(t0, 1));
    geo.setAttribute('aLife', new T.BufferAttribute(life, 1));
    geo.setAttribute('aSize', new T.BufferAttribute(size, 1));
    geo.setAttribute('aType', new T.BufferAttribute(type, 1));
    geo.setAttribute('aSeed', new T.BufferAttribute(seed, 1));
    var mat = new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 600 } },
      vertexShader: G.particle.vert, fragmentShader: G.particle.frag,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending
    });
    var pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 20;
    fxGroup.add(pts);
    var head = 0, now = 0, dirty0 = 1e9, dirty1 = -1;
    function mark(i) { if (i < dirty0) dirty0 = i; if (i > dirty1) dirty1 = i; }
    return {
      pts: pts, mat: mat,
      setTime: function (t) { now = t; },
      emit: function (p, v, c, lifeS, sz, tp, sd) {
        var i = head; head = (head + 1) % POOL_N;
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        vel[i * 3] = v.x; vel[i * 3 + 1] = v.y; vel[i * 3 + 2] = v.z;
        col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
        t0[i] = now + (sd ? sd : 0); life[i] = lifeS; size[i] = sz; type[i] = tp;
        seed[i] = rng();
        mark(i);
      },
      flush: function (time) {
        this.setTime(time); mat.uniforms.uTime.value = time;
        if (dirty1 >= 0) {
          var attrs = geo.attributes;
          ['position', 'aVel', 'aColor', 'aT0', 'aLife', 'aSize', 'aType', 'aSeed'].forEach(function (n) {
            var at = attrs[n];
            var off = dirty0 * at.itemSize, cnt = (dirty1 - dirty0 + 1) * at.itemSize;
            if (at.addUpdateRange) {
              if (at.clearUpdateRanges) at.clearUpdateRanges();
              at.addUpdateRange(off, cnt);
            }
            at.needsUpdate = true;
          });
          dirty0 = 1e9; dirty1 = -1;
        }
      },
      budget: function (n) { return Math.max(1, Math.floor(n * qMul)); }
    };
  })();

  /* ============ 自定义灯光循环（24 槽 uniform 数组） ============ */
  var KL = { pos: new Float32Array(72), col: new Float32Array(72), n: 24 };
  function klSet(i, p3, c, k) {
    if (i >= KL.n) return;
    KL.pos[i * 3] = p3.x; KL.pos[i * 3 + 1] = p3.y; KL.pos[i * 3 + 2] = p3.z;
    KL.col[i * 3] = c[0] * k; KL.col[i * 3 + 1] = c[1] * k; KL.col[i * 3 + 2] = c[2] * k;
  }

  /* ============ 舞台/场地地面灯光层 ============ */
  var floorMat = new T.ShaderMaterial({
    uniforms: {
      uLPos: { value: null }, uLCol: { value: null },
      uTime: { value: 0 }, uBeat: { value: 0 }, uPower: { value: 1 }
    },
    vertexShader: G.floorfx.vert, fragmentShader: G.floorfx.frag
  });
  var floorUniformArrays = { uLPos: { value: null }, uLCol: { value: null } };
  (function () {
    var stage = new T.Mesh(new T.PlaneGeometry(80, 56), floorMat);
    stage.rotation.x = -Math.PI / 2;
    var c = B(50, 0, 2.06); stage.position.copy(c);
    var field = new T.Mesh(new T.CircleGeometry(1, 64), floorMat);
    field.rotation.x = -Math.PI / 2; field.scale.set(97, 71, 1);
    field.position.copy(B(0, 0, 0.22));
    fxGroup.add(stage); fxGroup.add(field);
  })();

  /* ============ 光束 ============ */
  var beamFixtures = [];
  function trussPoint(ci, u) {
    var cx = [58, 70, 82][ci], hm = [21, 27, 33][ci];
    return B(cx, u * 34, 15 + (hm - 15) * (1 - u * u) + 0.6);
  }
  (function () {
    for (var ci = 0; ci < 3; ci++) for (var k = 0; k < 8; k++)
      beamFixtures.push({ pos: trussPoint(ci, -0.8 + 1.6 * k / 7), grp: 'truss', i: ci * 8 + k });
    for (var r = 0; r < 8; r++) {
      var a = r / 8 * Math.PI * 2 + 0.39;
      beamFixtures.push({ pos: B(Math.cos(a) * 104, Math.sin(a) * 78, 44 + Math.cos(2 * a) * 6), grp: 'rim', i: r });
    }
    var tw = [[10, -34], [10, 34], [42, -34], [42, 34]];
    for (var t = 0; t < 4; t++) beamFixtures.push({ pos: B(tw[t][0], tw[t][1], 27), grp: 'tower', i: t });
    for (var m = 0; m < 4; m++) beamFixtures.push({ pos: B(-25, 0, 27), grp: 'mirror', i: m, mirror: true });
  })();
  var BEAM_MAX = beamFixtures.length; // 36
  var beamMesh = (function () {
    var L = 62;
    var geo = new T.CylinderGeometry(0.4, 3.4, L, 7, 1, true);
    geo.translate(0, -L / 2, 0);
    var aI = new Float32Array(BEAM_MAX);
    var mat = new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uFlicker: { value: 1 } },
      vertexShader: G.beam.vert, fragmentShader: G.beam.frag,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide
    });
    var im = new T.InstancedMesh(geo, mat, BEAM_MAX);
    im.instanceMatrix.setUsage(T.DynamicDrawUsage);
    im.geometry.setAttribute('aI', new T.InstancedBufferAttribute(aI, 1));
    var ic = new Float32Array(BEAM_MAX * 3);
    im.instanceColor = new T.InstancedBufferAttribute(ic, 3);
    im.frustumCulled = false; im.renderOrder = 15;
    fxGroup.add(im);
    return im;
  })();
  var beamAim = new T.Vector3(), beamDir = new T.Vector3(), beamQ = new T.Quaternion(), beamS = new T.Vector3(), beamM = new T.Matrix4();
  var DOWN = new T.Vector3(0, -1, 0);
  var beamPattern = 'warm', beamBoost = 0;
  var tmpC = new T.Color();
  function beamTarget(f, time) {
    var i = f.i, a = i * 0.785;
    switch (beamPattern) {
      case 'off': return null;
      case 'warm': return B(Math.sin(time * 0.5 + a) * 60, Math.cos(time * 0.4 + a) * 50, 8);
      case 'gold': return B(40 + Math.sin(time * 0.8 + a) * 20, Math.sin(a) * 25, 6);
      case 'cool': return B(f.pos.x * 1.4, f.pos.z * 1.4, 80);
      case 'cross': return B(-40 + Math.sin(time * 1.1 + a) * 90, Math.cos(time * 0.9 + a) * 70, 4);
      case 'wall': return B(f.pos.x * 1.15, f.pos.z * 1.1, 70);
      case 'soft': return B(Math.sin(a) * 70, Math.cos(a) * 55, 4);
      case 'sunburst':
        if (f.grp === 'tower') return B(f.pos.x * 2.2, f.pos.z * 2.2, 40 + Math.sin(time + a) * 20);
        return B(Math.sin(time * 1.3 + a) * 80, Math.cos(time + a) * 60, 3);
      default: return B(0, 0, 10);
    }
  }
  function updateBeams(time) {
    var mood = state.mood;
    var n = beamFixtures.length;
    var cap = Math.floor(n * Math.min(1, 0.5 + qMul * 0.5));
    for (var idx = 0; idx < n; idx++) {
      var f = beamFixtures[idx];
      var tgt = f.mirror && !state.mirror ? null : beamTarget(f, time);
      var intensity = 0;
      if (tgt && idx < cap) {
        if (f.grp === 'rim' && (beamPattern === 'wall' || beamPattern === 'gold' || beamPattern === 'sunburst')) intensity = 0.55;
        else if (f.grp === 'truss' || f.grp === 'mirror' || f.grp === 'tower') intensity = 0.5;
        else intensity = 0.3;
        intensity *= (0.7 + 0.3 * Math.sin(time * 2 + idx));
        if (f.mirror) intensity = 0.9;
        beamDir.copy(tgt).sub(f.pos).normalize();
        beamQ.setFromUnitVectors(DOWN, beamDir);
        beamS.set(1, 1, 1);
        beamM.compose(f.pos, beamQ, beamS);
        beamMesh.setMatrixAt(idx, beamM);
        var cmix = (idx % 2 === 0) ? mood.hueA : mood.hueB;
        tmpC.setRGB(cmix[0], cmix[1], cmix[2]);
        beamMesh.instanceColor.setXYZ(idx, tmpC.r, tmpC.g, tmpC.b);
      }
      beamMesh.geometry.attributes.aI.setX(idx, tgt ? intensity * (1 + beamBoost) : 0);
    }
    beamMesh.instanceMatrix.needsUpdate = true;
    beamMesh.instanceColor.needsUpdate = true;
    beamMesh.geometry.attributes.aI.needsUpdate = true;
    beamMesh.material.uniforms.uTime.value = time;
  }

  /* ============ 激光 ============ */
  var LASER_N = 90;
  var laserMesh = (function () {
    var geo = new T.BoxGeometry(0.14, 0.14, 1);
    geo.translate(0, 0, 0.5);
    var mat = new T.ShaderMaterial({
      vertexShader: G.laser.vert, fragmentShader: G.laser.frag,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending
    });
    var im = new T.InstancedMesh(geo, mat, LASER_N);
    im.instanceMatrix.setUsage(T.DynamicDrawUsage);
    im.geometry.setAttribute('aI', new T.InstancedBufferAttribute(new Float32Array(LASER_N), 1));
    im.instanceColor = new T.InstancedBufferAttribute(new Float32Array(LASER_N * 3), 3);
    im.frustumCulled = false; im.renderOrder = 16;
    fxGroup.add(im);
    return im;
  })();
  var laserPattern = 'off';
  var lq = new T.Quaternion(), lz = new T.Vector3(0, 0, 1), ldir = new T.Vector3(), lM = new T.Matrix4(), lS = new T.Vector3();
  var LCOLORS = [[1, 0.2, 0.15], [0.2, 0.6, 1], [0.3, 1, 0.6], [1, 0.5, 0.9], [1, 0.75, 0.3]];
  function updateLasers(time) {
    var used = 0;
    function put(origin, dir, len, col, k) {
      if (used >= LASER_N) return;
      ldir.copy(dir).normalize();
      lq.setFromUnitVectors(lz, ldir);
      lS.set(1, 1, len);
      lM.compose(origin, lq, lS);
      laserMesh.setMatrixAt(used, lM);
      laserMesh.instanceColor.setXYZ(used, col[0], col[1], col[2]);
      laserMesh.geometry.attributes.aI.setX(used, k);
      used++;
    }
    var t = time;
    var lipY = function (k) { return -22 + 44 * k; };
    if (laserPattern === 'fan') {
      for (var i = 0; i < 12; i++) {
        var sw = Math.sin(t * 2.2 + i * 0.5) * 0.9;
        put(B(52, lipY(i / 11), 3), new T.Vector3(-1, sw * 0.9, 0.15), 120, LCOLORS[i % 5], 1);
      }
    } else if (laserPattern === 'wall') {
      for (var i2 = 0; i2 < 18; i2++) {
        put(B(54, lipY(i2 / 17), 3), new T.Vector3(-1, (i2 / 17 - 0.5) * 0.7, 0.6), 130, LCOLORS[i2 % 5], 0.9);
      }
      for (var r2 = 0; r2 < 8; r2++) {
        var a2 = r2 / 8 * Math.PI * 2;
        var org = B(Math.cos(a2) * 100, Math.sin(a2) * 74, 46);
        put(org, new T.Vector3(Math.cos(a2 + 2.6), Math.sin(a2 + 2.6), -0.5), 110, LCOLORS[(r2 + 2) % 5], 0.8);
      }
    } else if (laserPattern === 'tunnel') {
      for (var i3 = 0; i3 < 24; i3++) {
        var a3 = i3 / 24 * Math.PI * 2 + t * 0.7;
        put(B(-30, 0, 30), new T.Vector3(Math.cos(a3) * 0.8, Math.sin(a3) * 0.8, -1), 110, LCOLORS[i3 % 5], 1);
      }
    } else if (laserPattern === 'scan') {
      for (var i4 = 0; i4 < 10; i4++) {
        var sy = Math.sin(t * 1.4 + i4) * 0.8;
        put(B(52, lipY(i4 / 9), 16), new T.Vector3(-1, sy, -0.2), 130, LCOLORS[(i4 + 1) % 5], 0.9);
      }
    } else if (laserPattern === 'hourglass') {
      for (var i5 = 0; i5 < 16; i5++) {
        var k5 = i5 / 15;
        var orgL = B(52, -24 + 48 * k5, 2.5);
        var orgR = B(52, 24 - 48 * k5, 2.5);
        var meet = B(10 + Math.sin(t * 2) * 8, 0, 34);
        var d1 = meet.clone().sub(orgL).normalize();
        var d2 = meet.clone().sub(orgR).normalize();
        put(orgL, d1, 90, LCOLORS[0], 1); put(orgR, d2, 90, LCOLORS[1], 1);
      }
    }
    for (var u = used; u < LASER_N; u++) laserMesh.geometry.attributes.aI.setX(u, 0);
    laserMesh.instanceMatrix.needsUpdate = true;
    laserMesh.instanceColor.needsUpdate = true;
    laserMesh.geometry.attributes.aI.needsUpdate = true;
  }

  /* ============ 频闪排 ============ */
  var strobeMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  var strobeMesh = (function () {
    var geo = new T.BoxGeometry(1.4, 1.0, 0.3);
    var im = new T.InstancedMesh(geo, strobeMat, 18);
    var m = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(1, 1, 1);
    for (var i = 0; i < 18; i++) {
      m.compose(B(49.4, -25.5 + i * 3, 2.8), q, s);
      im.setMatrixAt(i, m);
    }
    im.renderOrder = 18; fxGroup.add(im);
    return im;
  })();

  /* ============ LED 主屏 ============ */
  var ledMat = new T.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uPower: { value: 0 }, uHue: { value: 0 },
      uHasTex: { value: 0 }, uTex: { value: null }, uTint: { value: new T.Vector3(1, 1, 1) }
    },
    vertexShader: G.led.vert, fragmentShader: G.led.frag, side: T.DoubleSide
  });
  if (ctx.refs.LED_WALL) ctx.refs.LED_WALL.material = ledMat;
  var ledTitleTex = (function () {
    var cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
    var g = cv.getContext('2d');
    g.fillStyle = '#050505'; g.fillRect(0, 0, 1024, 512);
    g.font = '900 190px "Noto Sans SC", "Microsoft YaHei", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffd58a'; g.shadowColor = '#ff9a3d'; g.shadowBlur = 40;
    g.fillText('万兽之王', 512, 210);
    g.font = '700 64px "Barlow Condensed", sans-serif';
    g.fillStyle = '#ffb36a'; g.shadowBlur = 14;
    g.fillText('KING OF BEASTS LIVE · 鸟巢', 512, 395);
    var tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
    return tx;
  })();

  /* ============ 屋顶题字 ============ */
  var roofText = (function () {
    var cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256;
    var g = cv.getContext('2d');
    g.font = '900 170px "Noto Sans SC", "Microsoft YaHei", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.strokeStyle = '#ffdf9e'; g.lineWidth = 10;
    g.shadowColor = '#ffae45'; g.shadowBlur = 45;
    g.fillStyle = '#ffcf87';
    g.fillText('万兽之王', 512, 132);
    var tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
    var mat = new T.MeshBasicMaterial({ map: tx, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
    var mesh = new T.Mesh(new T.PlaneGeometry(96, 24), mat);
    mesh.rotation.x = -Math.PI / 2; mesh.rotation.z = Math.PI / 2;
    mesh.position.copy(B(0, 0, 78));
    mesh.renderOrder = 19; mesh.visible = false;
    fxGroup.add(mesh);
    var anim = { t: -1 };
    return {
      show: function (txt) { if (txt && txt !== '万兽之王') { g.clearRect(0, 0, 1024, 256); g.fillText(txt, 512, 132); tx.needsUpdate = true; } anim.t = 0; mesh.visible = true; },
      update: function (dt) {
        if (anim.t < 0) return;
        anim.t += dt;
        var k = anim.t < 1.5 ? anim.t / 1.5 : (anim.t > 9 ? Math.max(0, 1 - (anim.t - 9) / 2) : 1);
        mat.opacity = k;
        if (anim.t > 11) { anim.t = -1; mesh.visible = false; }
      }
    };
  })();

  /* ============ 烟花 ============ */
  var fwFlashes = []; // {pos, col, k}
  function firework(pB, size, color) {
    var p = B(pB[0], pB[1], pB[2]);
    var n = pool.budget(140 * size);
    for (var i = 0; i < n; i++) {
      var u = rng() * 2 - 1, ph = rng() * Math.PI * 2, sp = (0.5 + 0.5 * rng()) * 19 * size;
      var r2 = Math.sqrt(1 - u * u);
      var v = new T.Vector3(Math.cos(ph) * r2 * sp, u * sp, Math.sin(ph) * r2 * sp);
      var c = [
        Math.min(1.6, color[0] * (0.7 + rng() * 0.6)),
        Math.min(1.6, color[1] * (0.7 + rng() * 0.6)),
        Math.min(1.6, color[2] * (0.7 + rng() * 0.6))
      ];
      pool.emit(p, v, c, R(1.6, 2.6) + size, R(1.6, 2.6), 1, 0);
    }
    pool.emit(p, new T.Vector3(0, 0, 0), [2, 1.8, 1.4], 0.22, 26 * size, 1, 0);
    if (fwFlashes.length > 4) fwFlashes.shift();
    fwFlashes.push({ pos: p, col: color, k: 1 });
    if (ctx.audio) ctx.audio.boom(p, size);
    return n;
  }
  function volley(n, r, h) {
    for (var i = 0; i < n; i++) {
      var a = rng() * Math.PI * 2;
      var cols = [[1, 0.72, 0.3], [1, 0.3, 0.15], [0.4, 0.7, 1], [0.5, 1, 0.7], [1, 0.4, 0.9]];
      firework([Math.cos(a) * r, Math.sin(a) * r * 0.85, h + rng() * 22], 1.4 + rng(), cols[i % 5]);
    }
  }

  /* ============ 火焰 / CO2 / 彩带 / 火花 / 金箔 ============ */
  var FIRECOL = [[1.0, 0.55, 0.15], [1.0, 0.35, 0.08], [1.0, 0.8, 0.4]];
  function fireEmit(p3, k, up) {
    var v = new T.Vector3(R(-1, 1) * k * 2, up * R(6, 11) * k, R(-1, 1) * k * 2);
    pool.emit(p3, v, FIRECOL[i3(FIRECOL.length)], R(0.5, 0.9), R(2.5, 4.5) * k, 2, R(0, 0.06));
  }
  function i3(n) { return Math.floor(rng() * n); }
  var stageJets = [];
  for (var sj = 0; sj < 10; sj++) stageJets.push(B(51, -22.5 + sj * 5, 2.4));
  var co2Jets = [];
  for (var cj = 0; cj < 12; cj++) co2Jets.push(B(49.6, -25 + cj * 4.5, 2.2));
  var ringJets = [];
  for (var rj = 0; rj < 14; rj++) {
    var ra = Math.PI * (0.5 + rj / 13); // 半圆朝观众
    ringJets.push(B(46 + Math.cos(ra) * 2, Math.sin(ra) * 27, 1.6));
  }
  function updateFire(dt, time) {
    var chN = SHOW.chapterAt(state.showTime) + 1;
    /* 台前烈焰章节：火焰基线常驻（cue 只负责加码） */
    if (chN === 4) state.fire = Math.max(state.fire, 0.55);
    var k;
    if (state.fire > 0) {
      state.fire -= dt * 0.55;
      var nF = pool.budget(9);
      for (k = 0; k < stageJets.length; k++) if (rng() < state.fire) for (var f = 0; f < nF; f++) fireEmit(stageJets[k], 1, 1);
    }
    if (state.firering) {
      var nR = pool.budget(5);
      for (k = 0; k < ringJets.length; k++) for (var f2 = 0; f2 < nR; f2++) fireEmit(ringJets[k], 0.8, 0.9);
    }
    for (var ti = 0; ti < 4; ti++) {
      if (state.tornado[ti] > 0) {
        var tp = B([10, 10, 42, 42][ti], [-34, 34, -34, 34][ti], 22);
        var nT = pool.budget(7);
        for (var f3 = 0; f3 < nT; f3++) {
          var ta = rng() * Math.PI * 2;
          var v = new T.Vector3(Math.cos(ta) * 5, R(9, 15), Math.sin(ta) * 5);
          pool.emit(new T.Vector3(tp.x + Math.cos(ta) * 1.6, tp.y + R(-1, 2), tp.z + Math.sin(ta) * 1.6), v, FIRECOL[i3(3)], R(0.6, 1.0), R(2.2, 3.6), 2, R(0, 0.1));
        }
      }
    }
    if (state.goldrain) {
      var nG = pool.budget(Math.ceil(dt * 26));
      for (var g2 = 0; g2 < nG; g2++) {
        pool.emit(B(R(-70, 60), R(-55, 55), R(28, 44)), new T.Vector3(R(-0.5, 0.5), -R(0.4, 1), R(-0.5, 0.5)), [1, 0.75, 0.3], R(5, 9), R(1.2, 2), 6, 0);
      }
    }
    if (strobeValFlash > 0) { /* handled in strobe */ }
  }
  function co2Burst(p) {
    var n = pool.budget(46);
    for (var i = 0; i < n; i++) {
      var jj = co2Jets[i3(co2Jets.length)];
      pool.emit(jj, new T.Vector3(R(-2, 1), R(1, 3), R(-2, 2)), [0.8, 0.85, 0.95], R(0.9, 1.5), R(3, 6), 7, 0);
    }
    if (ctx.audio) ctx.audio.psst();
  }
  function confettiBurst(p) {
    var n = pool.budget(240);
    var cols = [[1, 0.4, 0.2], [1, 0.75, 0.3], [0.3, 0.7, 1], [0.5, 1, 0.7], [1, 0.5, 0.9]];
    for (var i = 0; i < n; i++) {
      var org = B(R(56, 84), R(-30, 30), R(20, 30));
      pool.emit(org, new T.Vector3(R(-2, 2), R(0.5, 3), R(-2, 2)), cols[i3(5)], R(4, 8), R(1.6, 2.4), 4, 0);
    }
  }
  function sparkFall(p) {
    var n = pool.budget(170);
    for (var i = 0; i < n; i++) {
      var org = B(70 + R(-8, 8), R(-30, 30), 26 + R(-1, 1));
      pool.emit(org, new T.Vector3(0, -R(0.5, 2.5), 0), [1, 0.72, 0.3], R(1.2, 2.2), R(1.2, 1.8), 3, R(0, 0.4));
    }
  }
  function lightRain(on) { state.goldrain = on; } /* 光之雨复用金雨通道，雨滴更快 */

  /* ============ 人群 ============ */
  var crowd = (function () {
    var geo = new T.BufferGeometry();
    var MAXC = 16000;
    var pos = new Float32Array(MAXC * 3), seed = new Float32Array(MAXC), tier = new Float32Array(MAXC), ang = new Float32Array(MAXC);
    var count = 0;
    function addPt(x3, y3, z3, tr, an) {
      if (count >= MAXC) return;
      pos[count * 3] = x3; pos[count * 3 + 1] = y3; pos[count * 3 + 2] = z3;
      seed[count] = rng(); tier[count] = tr; ang[count] = an;
      count++;
    }
    /* 内场站席 */
    var nField = Math.floor(3600 * Math.min(P.crowd, 1.6));
    for (var i = 0; i < nField; i++) {
      var bx = R(-88, 42), by = R(-64, 64);
      if ((bx * bx) / (95 * 95) + (by * by) / (68 * 68) > 1) { i--; continue; }
      if (bx > 46 && Math.abs(by) < 30) { i--; continue; } // 舞台区
      var v = B(bx, by, 1.5 + rng() * 0.4);
      addPt(v.x, v.y, v.z, 0, Math.atan2(by, bx));
    }
    /* 看台三层：从 GLB 网格三角形面积加权采样 */
    var stands = ctx.refs.stands || [];
    stands.forEach(function (mesh, tIdx) {
      var g = mesh.geometry, pa = g.attributes.position;
      var idx = g.index;
      var triCount = idx ? idx.count / 3 : pa.count / 3;
      var areas = [], total = 0;
      var va = new T.Vector3(), vb = new T.Vector3(), vc = new T.Vector3(), ab = new T.Vector3(), ac = new T.Vector3();
      for (var tr = 0; tr < triCount; tr++) {
        var ia = idx ? idx.getX(tr * 3) : tr * 3, ib = idx ? idx.getX(tr * 3 + 1) : tr * 3 + 1, ic2 = idx ? idx.getX(tr * 3 + 2) : tr * 3 + 2;
        va.fromBufferAttribute(pa, ia); vb.fromBufferAttribute(pa, ib); vc.fromBufferAttribute(pa, ic2);
        ab.subVectors(vb, va); ac.subVectors(vc, va);
        var ar = ab.cross(ac).length() * 0.5;
        if (!(ar > 0)) ar = 0;
        areas.push(ar); total += ar;
      }
      var want = Math.floor(3600 * Math.min(P.crowd, 1.6) / Math.max(1, stands.length));
      for (var s = 0; s < want; s++) {
        var pick = rng() * total, acc = 0, ti = 0;
        for (ti = 0; ti < triCount; ti++) { acc += areas[ti]; if (acc >= pick) break; }
        if (ti >= triCount) ti = triCount - 1;
        var iA = idx ? idx.getX(ti * 3) : ti * 3, iB = idx ? idx.getX(ti * 3 + 1) : ti * 3 + 1, iC = idx ? idx.getX(ti * 3 + 2) : ti * 3 + 2;
        var u = rng(), v2 = rng(); if (u + v2 > 1) { u = 1 - u; v2 = 1 - v2; }
        va.fromBufferAttribute(pa, iA); vb.fromBufferAttribute(pa, iB); vc.fromBufferAttribute(pa, iC);
        var px = va.x + (vb.x - va.x) * u + (vc.x - va.x) * v2;
        var py = va.y + (vb.y - va.y) * u + (vc.y - va.y) * v2;
        var pz = va.z + (vb.z - va.z) * u + (vc.z - va.z) * v2;
        py += 0.55; // 坐姿头顶
        addPt(px, py, pz, 1 + tIdx * 0.45, Math.atan2(-pz, px));
      }
    });
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new T.BufferAttribute(seed, 1));
    geo.setAttribute('aTier', new T.BufferAttribute(tier, 1));
    geo.setAttribute('aAng', new T.BufferAttribute(ang, 1));
    geo.setDrawRange(0, count);
    var cardCv = document.createElement('canvas'); cardCv.width = 1024; cardCv.height = 256;
    var cardTx = new T.CanvasTexture(cardCv); cardTx.colorSpace = T.SRGBColorSpace;
    var mat = new T.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uBeat: { value: 0 }, uIntensity: { value: 0.5 }, uCardOn: { value: 0 },
        uPx: { value: 900 }, uColA: { value: new T.Vector3(1, 0.7, 0.3) }, uColB: { value: new T.Vector3(0.3, 0.6, 1) },
        uCard: { value: cardTx }
      },
      vertexShader: G.crowd.vert, fragmentShader: G.crowd.frag,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending
    });
    var pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 10;
    fxGroup.add(pts);
    function drawCard(txt) {
      var g = cardCv.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 256);
      if (txt) {
        g.fillStyle = '#ffcf87';
        g.font = '900 200px "Noto Sans SC", "Microsoft YaHei", sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(txt, 512, 136);
      }
      cardTx.needsUpdate = true;
    }
    drawCard(null);
    return {
      pts: pts, mat: mat, count: count, drawCard: drawCard,
      applyQuality: function () { geo.setDrawRange(0, Math.floor(count * Math.min(1, 0.4 + qMul * 0.6))); }
    };
  })();

  /* ============ 表演者 ============ */
  var performers = (function () {
    var POS = [
      [26, 0, 2.8], [60, -8, 2.8], [66, -14, 2.8], [72, -8, 2.8], [78, 0, 2.8],
      [72, 8, 2.8], [66, 14, 2.8], [60, 8, 2.8], [38, -3.4, 2.8], [38, 3.4, 2.8], [16, 0, 2.8]
    ];
    var bodyGeo = new T.CapsuleGeometry(0.34, 1.05, 3, 8);
    var headGeo = new T.SphereGeometry(0.26, 8, 6);
    var mat = new T.MeshBasicMaterial({ color: 0x231a12 });
    var bodies = new T.InstancedMesh(bodyGeo, mat, POS.length);
    var heads = new T.InstancedMesh(headGeo, new T.MeshBasicMaterial({ color: 0x6b4a2a }), POS.length);
    bodies.renderOrder = heads.renderOrder = 8;
    fxGroup.add(bodies); fxGroup.add(heads);
    var m = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(1, 1, 1), p = new T.Vector3();
    return {
      update: function (time, beat) {
        for (var i = 0; i < POS.length; i++) {
          var ph = beat * Math.PI + i * 1.7;
          var h = Math.abs(Math.sin(ph)) * 0.5;
          p.copy(B(POS[i][0], POS[i][1], POS[i][2]));
          p.y += 0.85 + h;
          m.compose(p, q, sc); bodies.setMatrixAt(i, m);
          p.y += 0.82;
          m.compose(p, q, sc); heads.setMatrixAt(i, m);
        }
        bodies.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
      }
    };
  })();

  /* ============ 雾霭 ============ */
  var hazeMats = [];
  (function () {
    for (var i = 0; i < 8; i++) {
      var mat = new T.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uDensity: { value: 0.8 }, uColor: { value: new T.Vector3(1, 0.85, 0.7) } },
        vertexShader: G.haze.vert, fragmentShader: G.haze.frag,
        transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide
      });
      var a = i / 8 * Math.PI * 2;
      var mesh = new T.Mesh(new T.PlaneGeometry(130, 46), mat);
      mesh.position.copy(B(Math.cos(a) * 55, Math.sin(a) * 42, 14));
      mesh.lookAt(B(0, 0, 14));
      mesh.renderOrder = 12; mesh.frustumCulled = false;
      fxGroup.add(mesh); hazeMats.push(mat);
    }
  })();

  /* ============ 星河 ============ */
  var galaxy = (function () {
    var N = 2400;
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(N * 3), col = new Float32Array(N * 3), sd = new Float32Array(N);
    for (var i = 0; i < N; i++) {
      var r = 4 + Math.pow(rng(), 0.65) * 52;
      var a = r * 0.22 + rng() * 0.55;
      var hgt = (rng() - 0.5) * 9 * (1 - r / 60);
      var v = B(Math.cos(a) * r, Math.sin(a) * r, hgt);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y + 42; pos[i * 3 + 2] = v.z;
      var k = 1 - r / 60;
      col[i * 3] = 0.6 + k * 0.6; col[i * 3 + 1] = 0.5 + k * 0.3; col[i * 3 + 2] = 0.7 + (1 - k) * 0.3;
      sd[i] = rng();
    }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new T.BufferAttribute(col, 3));
    geo.setAttribute('aSeed', new T.BufferAttribute(sd, 1));
    var mat = new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
      vertexShader: G.galaxy.vert, fragmentShader: G.galaxy.frag,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending
    });
    var pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 14;
    fxGroup.add(pts);
    return { mat: mat, target: 0, update: function (dt) {
      var u = mat.uniforms.uOpacity;
      u.value += (this.target - u.value) * Math.min(1, dt * 1.4);
      pts.visible = u.value > 0.01;
    } };
  })();

  /* ============ 镜球 ============ */
  var mirror = (function () {
    var grp = new T.Group();
    var ball = new T.Mesh(new T.IcosahedronGeometry(2.6, 1), new T.MeshBasicMaterial({ color: 0xcfd6e0 }));
    var wire = new T.Mesh(new T.IcosahedronGeometry(2.65, 1), new T.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.5 }));
    var glitGeo = new T.BufferGeometry();
    var GN = 260, gp = new Float32Array(GN * 3), gs = new Float32Array(GN);
    for (var i = 0; i < GN; i++) {
      var a = rng() * Math.PI * 2, b2 = Math.acos(rng() * 2 - 1), r = 3.4 + rng() * 1.5;
      gp[i * 3] = Math.sin(b2) * Math.cos(a) * r; gp[i * 3 + 1] = Math.cos(b2) * r; gp[i * 3 + 2] = Math.sin(b2) * Math.sin(a) * r;
      gs[i] = rng();
    }
    glitGeo.setAttribute('position', new T.BufferAttribute(gp, 3));
    glitGeo.setAttribute('aSize', new T.BufferAttribute(gs, 1));
    glitGeo.setAttribute('aTw', new T.BufferAttribute(gs.slice(), 1));
    var glit = new T.Points(glitGeo, new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: G.stars.vert, fragmentShader: G.stars.frag,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending
    }));
    glit.material.uniforms && (glit.material.uniforms.uPx = glit.material.uniforms.uPx);
    grp.add(ball); grp.add(wire); grp.add(glit);
    grp.position.copy(B(-25, 0, 44));
    grp.visible = false;
    fxGroup.add(grp);
    var anim = { down: false, y: 44 };
    return {
      grp: grp,
      set: function (on) { anim.down = on; grp.visible = true; running('mirrorball', on); },
      update: function (dt, time) {
        var target = anim.down ? 27 : 44;
        anim.y += (target - anim.y) * Math.min(1, dt * 1.2);
        grp.position.y = anim.y;
        if (!anim.down && Math.abs(anim.y - 44) < 0.4) grp.visible = false;
        ball.rotation.y += dt * 0.8; wire.rotation.y -= dt * 0.5; glit.rotation.y += dt * 0.4;
        glit.material.uniforms.uTime.value = time;
        wire.material.opacity = 0.3 + 0.2 * Math.sin(time * 3);
      }
    };
  })();

  /* ============ 全息巨兽 ============ */
  var holo = (function () {
    var mat = new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: new T.Vector3(1.0, 0.55, 0.2) } },
      vertexShader: G.hologram.vert, fragmentShader: G.hologram.frag,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide
    });
    var grp = new T.Group();
    var mane = new T.Mesh(new T.TorusGeometry(6.2, 1.9, 10, 28), mat);
    mane.rotation.y = Math.PI / 2;
    var head = new T.Mesh(new T.SphereGeometry(4.4, 20, 14), mat);
    head.position.x = -4.6;
    var eyeL = new T.Mesh(new T.SphereGeometry(0.8, 8, 6), mat); eyeL.position.set(-6.5, 1.4, 2.2);
    var eyeR = eyeL.clone(); eyeR.position.z = -2.2;
    var wingL = new T.Mesh(new T.ConeGeometry(3.4, 12, 4), mat);
    wingL.position.set(2, 1, 9); wingL.rotation.z = 1.1;
    var wingR = wingL.clone(); wingR.position.z = -9; wingR.rotation.z = -1.1;
    var jaw = new T.Mesh(new T.ConeGeometry(2.6, 6, 4), mat);
    jaw.position.set(-8.4, -1.4, 0); jaw.rotation.z = -Math.PI / 2 + 0.4;
    grp.add(mane, head, eyeL, eyeR, wingL, wingR, jaw);
    grp.position.copy(B(60, 0, 2.5));
    grp.visible = false; grp.renderOrder = 17;
    fxGroup.add(grp);
    return {
      grp: grp, mat: mat, k: 0, dir: 0,
      set: function (on) { this.dir = on ? 1 : -1; grp.visible = true; running('holobeast', !!on); },
      update: function (dt, time) {
        if (this.dir === 0 && this.k <= 0) { grp.visible = false; return; }
        this.k = Math.max(0, Math.min(1, this.k + this.dir * dt * 0.55));
        if (this.k <= 0 && this.dir <= 0) { grp.visible = false; this.dir = 0; return; }
        mat.uniforms.uOpacity.value = this.k;
        mat.uniforms.uTime.value = time;
        var s = 0.6 + this.k * 0.75 + Math.sin(time * 2.2) * 0.04 * this.k;
        grp.scale.set(s, s, s);
        grp.position.y = 2.2 + this.k * this.k * 21;
        grp.rotation.y = Math.sin(time * 0.3) * 0.22;
      }
    };
  })();

  /* ============ 冲击波 ============ */
  var shocks = [];
  function shockwave(pB, r) {
    var mat = new T.ShaderMaterial({
      uniforms: { uProg: { value: 0 }, uColor: { value: new T.Vector3(1, 0.8, 0.4) } },
      vertexShader: G.ring.vert, fragmentShader: G.ring.frag,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide
    });
    var mesh = new T.Mesh(new T.PlaneGeometry(r * 2.4, r * 2.4), mat);
    mesh.rotation.x = -Math.PI / 2;
    var p = B(pB[0], pB[1], pB[2] ? Math.max(pB[2], 3) : 3);
    mesh.position.set(p.x, 3.2, p.z);
    mesh.renderOrder = 19;
    fxGroup.add(mesh);
    shocks.push({ mesh: mesh, mat: mat, t: 0, r: r });
    if (ctx.audio) ctx.audio.thump();
  }
  function updateShocks(dt) {
    for (var i = shocks.length - 1; i >= 0; i--) {
      var s = shocks[i]; s.t += dt;
      var k = s.t / 1.0;
      if (k >= 1) { fxGroup.remove(s.mesh); s.mesh.geometry.dispose(); s.mat.dispose(); shocks.splice(i, 1); continue; }
      s.mat.uniforms.uProg.value = k;
    }
  }

  /* ============ 光环（沿钢结构升起的金环） ============ */
  var halos = [];
  (function () {
    for (var i = 0; i < 5; i++) {
      var mat = new T.MeshBasicMaterial({ color: 0xffc46a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
      var mesh = new T.Mesh(new T.TorusGeometry(130 - i * 6, 1.1, 8, 90), mat);
      mesh.rotation.x = Math.PI / 2;
      var sc = 0.78;
      mesh.scale.set(sc, sc * 0.82, 1);
      mesh.renderOrder = 19;
      fxGroup.add(mesh); halos.push({ mesh: mesh, mat: mat, on: false, ph: i * 0.7 });
    }
  })();
  var haloOn = false;
  function updateHalos(dt, time) {
    halos.forEach(function (h, i) {
      var target = haloOn ? 1 : 0;
      var op = h.mat.opacity + (target * 0.85 - h.mat.opacity) * Math.min(1, dt * 2);
      h.mat.opacity = op;
      h.mesh.visible = op > 0.02;
      if (h.mesh.visible) {
        var cyc = (time * 0.28 + h.ph) % 1;
        h.mesh.position.y = 4 + cyc * 40;
        var sc = 0.7 + cyc * 0.1;
        h.mesh.scale.set(sc, sc * 0.82, 1);
        h.mat.color.setHSL(0.09, 0.9, 0.55 + 0.25 * (1 - cyc));
      }
    });
  }

  /* ============ 无人机编队 ============ */
  function drawShapePath(g, shape, w, h) {
    g.beginPath();
    var cx = w / 2, cy = h / 2, s = Math.min(w, h);
    switch (shape) {
      case 'crown':
        g.moveTo(cx - s * 0.42, cy + s * 0.3); g.lineTo(cx - s * 0.42, cy - s * 0.05);
        g.lineTo(cx - s * 0.22, cy + s * 0.12); g.lineTo(cx, cy - s * 0.34);
        g.lineTo(cx + s * 0.22, cy + s * 0.12); g.lineTo(cx + s * 0.42, cy - s * 0.05);
        g.lineTo(cx + s * 0.42, cy + s * 0.3); g.closePath(); break;
      case 'heart':
        g.moveTo(cx, cy + s * 0.36);
        g.bezierCurveTo(cx - s * 0.55, cy - s * 0.05, cx - s * 0.3, cy - s * 0.44, cx, cy - s * 0.14);
        g.bezierCurveTo(cx + s * 0.3, cy - s * 0.44, cx + s * 0.55, cy - s * 0.05, cx, cy + s * 0.36);
        break;
      case 'star':
        for (var i = 0; i < 10; i++) {
          var r = i % 2 === 0 ? s * 0.44 : s * 0.18;
          var a = -Math.PI / 2 + i * Math.PI / 5;
          var x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.closePath(); break;
      case 'note':
        g.arc(cx - s * 0.08, cy + s * 0.22, s * 0.2, 0, Math.PI * 2);
        g.moveTo(cx + s * 0.1, cy + s * 0.22); g.lineTo(cx + s * 0.1, cy - s * 0.34);
        g.lineTo(cx + s * 0.34, cy - s * 0.26); g.lineTo(cx + s * 0.34, cy - s * 0.14);
        g.lineTo(cx + s * 0.1, cy - s * 0.2); g.closePath(); break;
      case 'eagle':
        g.moveTo(cx, cy + s * 0.1);
        g.quadraticCurveTo(cx - s * 0.2, cy - s * 0.1, cx - s * 0.5, cy - s * 0.32);
        g.quadraticCurveTo(cx - s * 0.28, cy + s * 0.02, cx - s * 0.1, cy + s * 0.06);
        g.quadraticCurveTo(cx - s * 0.16, cy + s * 0.3, cx - s * 0.28, cy + s * 0.4);
        g.quadraticCurveTo(cx - s * 0.08, cy + s * 0.34, cx, cy + s * 0.18);
        g.quadraticCurveTo(cx + s * 0.08, cy + s * 0.34, cx + s * 0.28, cy + s * 0.4);
        g.quadraticCurveTo(cx + s * 0.16, cy + s * 0.3, cx + s * 0.1, cy + s * 0.06);
        g.quadraticCurveTo(cx + s * 0.28, cy + s * 0.02, cx + s * 0.5, cy - s * 0.32);
        g.quadraticCurveTo(cx + s * 0.2, cy - s * 0.1, cx, cy + s * 0.1);
        break;
      case 'lion':
        for (var k = 0; k < 12; k++) {
          var aa = k / 12 * Math.PI * 2;
          var rr = s * (k % 2 === 0 ? 0.46 : 0.34);
          var xx = cx + Math.cos(aa) * rr * 1.15, yy = cy + Math.sin(aa) * rr;
          k === 0 ? g.moveTo(xx, yy) : g.lineTo(xx, yy);
        }
        g.closePath();
        g.moveTo(cx + s * 0.16, cy); g.arc(cx, cy, s * 0.16, 0, Math.PI * 2); break;
      case 'elephant':
        g.arc(cx + s * 0.05, cy - s * 0.08, s * 0.3, 0, Math.PI * 2);
        g.moveTo(cx - s * 0.24, cy - s * 0.3); g.ellipse(cx - s * 0.24, cy - s * 0.3, s * 0.07, s * 0.22, 0.3, 0, Math.PI * 2);
        g.moveTo(cx - s * 0.05, cy + s * 0.2);
        g.bezierCurveTo(cx - s * 0.3, cy + s * 0.36, cx - s * 0.42, cy + s * 0.18, cx - s * 0.3, cy + s * 0.1);
        g.lineTo(cx - s * 0.18, cy + s * 0.26); g.closePath(); break;
      case 'whale':
        g.moveTo(cx - s * 0.42, cy);
        g.quadraticCurveTo(cx, cy - s * 0.46, cx + s * 0.42, cy);
        g.quadraticCurveTo(cx + s * 0.3, cy + s * 0.16, cx + s * 0.16, cy + s * 0.2);
        g.lineTo(cx + s * 0.34, cy + s * 0.44); g.lineTo(cx + s * 0.06, cy + s * 0.28);
        g.lineTo(cx - s * 0.1, cy + s * 0.44); g.lineTo(cx - s * 0.2, cy + s * 0.24);
        g.quadraticCurveTo(cx - s * 0.34, cy + s * 0.18, cx - s * 0.42, cy);
        break;
      case 'eye':
        g.moveTo(cx - s * 0.46, cy);
        g.quadraticCurveTo(cx, cy - s * 0.4, cx + s * 0.46, cy);
        g.quadraticCurveTo(cx, cy + s * 0.4, cx - s * 0.46, cy);
        g.moveTo(cx - s * 0.05, cy); g.arc(cx, cy, s * 0.16, 0, Math.PI * 2);
        g.moveTo(cx, cy - s * 0.16); g.lineTo(cx, cy + s * 0.16); break;
      case 'claws':
        for (var c2 = -1; c2 <= 1; c2++) {
          g.moveTo(cx + c2 * s * 0.26 - s * 0.08, cy - s * 0.4);
          g.quadraticCurveTo(cx + c2 * s * 0.26 + s * 0.12, cy, cx + c2 * s * 0.26 - s * 0.04, cy + s * 0.4);
        }
        g.moveTo(cx - s * 0.42, cy + s * 0.1); g.quadraticCurveTo(cx, cy + s * 0.5, cx + s * 0.42, cy + s * 0.1); break;
      case 'sphere':
        g.arc(cx, cy, s * 0.4, 0, Math.PI * 2); break;
      case 'rings':
        g.arc(cx, cy, s * 0.16, 0, Math.PI * 2);
        g.moveTo(cx + s * 0.3, cy); g.arc(cx, cy, s * 0.3, 0, Math.PI * 2);
        g.moveTo(cx + s * 0.44, cy); g.arc(cx, cy, s * 0.44, 0, Math.PI * 2); break;
      case 'planet':
        g.arc(cx, cy, s * 0.3, 0, Math.PI * 2);
        g.moveTo(cx - s * 0.52, cy + s * 0.1);
        g.ellipse(cx, cy, s * 0.52, s * 0.14, -0.3, 0, Math.PI * 2); break;
      case 'halo':
        g.ellipse(cx, cy, s * 0.46, s * 0.46, 0, 0, Math.PI * 2);
        g.moveTo(cx + s * 0.14, cy - s * 0.5); g.arc(cx, cy - s * 0.5, s * 0.14, 0, Math.PI * 2); break;
      default:
        g.arc(cx, cy, s * 0.35, 0, Math.PI * 2);
    }
  }
  var shapeCanvas = document.createElement('canvas');
  function rasterFormation(cfg) {
    var w = 480, h = 180;
    shapeCanvas.width = w; shapeCanvas.height = h;
    var g = shapeCanvas.getContext('2d');
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.strokeStyle = '#fff';
    g.lineWidth = 13; g.lineJoin = 'round'; g.lineCap = 'round';
    if (cfg.shape === 'text' && cfg.text) {
      var fs = 150;
      g.font = '900 ' + fs + 'px "Noto Sans SC", "Microsoft YaHei", sans-serif';
      var tw = g.measureText(cfg.text).width;
      if (tw > w - 24) { fs = Math.floor(fs * (w - 24) / tw); g.font = '900 ' + fs + 'px "Noto Sans SC", "Microsoft YaHei", sans-serif'; }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(cfg.text, w / 2, h / 2 + 6);
    } else {
      drawShapePath(g, cfg.shape || 'star', w, h);
      g.fill(); g.stroke();
    }
    var img = g.getImageData(0, 0, w, h).data;
    var step = 3, pts = [];
    var grid = {};
    function filled(x, y) { return img[(y * w + x) * 4 + 3] > 110; }
    for (var y = 4; y < h - 4; y += step) {
      for (var x = 4; x < w - 4; x += step) {
        if (filled(x, y)) {
          var ol = !(filled(x - step, y) && filled(x + step, y) && filled(x, y - step) && filled(x, y + step));
          pts.push({ x: x, y: y, ol: ol ? 1 : 0 });
        }
      }
    }
    while (pts.length > 2200) {
      /* 过密时抽稀内部点 */
      var rm = [];
      for (var i = 1; i < pts.length; i += 2) { if (!pts[i].ol) rm.push(i); }
      if (!rm.length) break;
      for (var j = rm.length - 1; j >= 0; j--) pts.splice(rm[j], 1);
    }
    return pts;
  }
  var DRONE_CAP = 2200;
  var drones = [];
  var dronesFollow = true;
  for (var di = 0; di < 3; di++) {
    (function (idx) {
      var geo = new T.BufferGeometry();
      var tgt = new Float32Array(DRONE_CAP * 3), home = new Float32Array(DRONE_CAP * 3);
      var kind = new Float32Array(DRONE_CAP), sd = new Float32Array(DRONE_CAP);
      for (var i = 0; i < DRONE_CAP; i++) {
        home[i * 3] = R(-45, 45); home[i * 3 + 1] = 62 + R(-6, 10); home[i * 3 + 2] = R(-40, 40);
        sd[i] = rng();
      }
      geo.setAttribute('position', new T.BufferAttribute(tgt, 3));
      geo.setAttribute('aHome', new T.BufferAttribute(home, 3));
      geo.setAttribute('aKind', new T.BufferAttribute(kind, 1));
      geo.setAttribute('aSeed', new T.BufferAttribute(sd, 1));
      geo.setDrawRange(0, 0);
      var mat = new T.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 }, uFormT: { value: 0 }, uFx: { value: 0 }, uPx: { value: 700 },
          uColor: { value: new T.Vector3(1, 0.72, 0.3) }, uOutline: { value: new T.Vector3(1, 0.95, 0.8) }
        },
        vertexShader: G.drone.vert, fragmentShader: G.drone.frag,
        transparent: true, depthWrite: false, blending: T.AdditiveBlending
      });
      var pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 13;
      fxGroup.add(pts);
      drones.push({
        geo: geo, mat: mat, pts: pts, cfg: null, formT: 0, dir: -1,
        show: function (cfg) {
          this.cfg = cfg;
          var cells = rasterFormation(cfg);
          var n = Math.min(DRONE_CAP, cells.length);
          var scale = (cfg.scale || 1) * 0.17;
          var cx = cfg.x || 0, cy = cfg.y || 0, hgt = cfg.height || 62;
          var pa = geo.attributes.position, ka = geo.attributes.aKind;
          for (var i2 = 0; i2 < n; i2++) {
            var c = cells[i2];
            var u = (c.x - 240) * scale, v = (90 - c.y) * scale;
            pa.setXYZ(i2, cx, hgt + v, u + cy);
            ka.setX(i2, c.ol);
          }
          geo.setDrawRange(0, n);
          pa.needsUpdate = true; ka.needsUpdate = true;
          this.mat.uniforms.uColor.value.set(cfg.color[0], cfg.color[1], cfg.color[2]);
          this.mat.uniforms.uOutline.value.set(Math.min(1, cfg.color[0] * 1.3 + 0.2), Math.min(1, cfg.color[1] * 1.3 + 0.2), Math.min(1, cfg.color[2] * 1.3 + 0.2));
          this.mat.uniforms.uFx.value = { steady: 0, wave: 1, sparkle: 2, rainbow: 3, bloom: 4 }[cfg.fx || 'steady'] || 0;
          this.formT = 0; this.dir = 1;
          this.pts.visible = true;
        },
        hide: function () { this.dir = -1; this.cfg = null; },
        update: function (dt, time) {
          if (this.dir < 0 && this.formT <= 0) { this.pts.visible = false; return; }
          this.formT = Math.max(0, Math.min(1, this.formT + this.dir * dt * 0.55));
          this.mat.uniforms.uFormT.value = this.formT;
          this.mat.uniforms.uTime.value = time;
          this.pts.visible = true;
        }
      });
    })(di);
  }
  function colorTriplet(name) {
    var m = { gold: [1, 0.72, 0.3], red: [1, 0.23, 0.18], white: [0.95, 0.93, 0.9], cyan: [0.2, 0.84, 0.91], magenta: [1, 0.31, 0.85], jade: [0.25, 0.91, 0.66], violet: [0.63, 0.48, 1], orange: [1, 0.54, 0.24] };
    return m[name] || m.gold;
  }

  /* ============ 灯牌 ============ */
  var signs = [];
  function drawSignCanvas(cv, cfg) {
    var g = cv.getContext('2d');
    var W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    var col = cfg.color || '#f0b85a';
    var txt = cfg.text || '万兽之王';
    g.font = '900 96px "Noto Sans SC", "Microsoft YaHei", sans-serif';
    var tw = g.measureText(txt).width;
    var fs = 96;
    if (tw > W - 90) { fs = Math.floor(96 * (W - 90) / tw); g.font = '900 ' + fs + 'px "Noto Sans SC", "Microsoft YaHei", sans-serif'; }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (cfg.style === 'led') {
      g.fillStyle = '#0a0a0d';
      g.fillRect(0, 0, W, H);
      g.fillStyle = col;
      g.shadowColor = col; g.shadowBlur = 8;
      var px = 10;
      var img = null;
      var off = document.createElement('canvas'); off.width = W; off.height = H;
      var og = off.getContext('2d');
      og.font = g.font; og.textAlign = 'center'; og.textBaseline = 'middle';
      og.fillStyle = '#fff'; og.fillText(txt, W / 2, H / 2 + 4);
      var data = og.getImageData(0, 0, W, H).data;
      for (var y = 0; y < H; y += px) for (var x = 0; x < W; x += px) {
        if (data[(y * W + x) * 4 + 3] > 110) { g.fillRect(x - px / 2, y - px / 2, px - 2, px - 2); }
      }
    } else if (cfg.style === 'bulbs') {
      g.fillStyle = 'rgba(10,8,6,0.92)';
      g.fillRect(0, 0, W, H);
      g.strokeStyle = col; g.lineWidth = 8;
      g.shadowColor = col; g.shadowBlur = 18;
      g.strokeRect(14, 14, W - 28, H - 28);
      g.fillStyle = col; g.shadowBlur = 26;
      for (var bx = 40; bx < W - 30; bx += 42) {
        g.beginPath(); g.arc(bx, 26, 7, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(bx, H - 26, 7, 0, Math.PI * 2); g.fill();
      }
      g.font = '900 ' + fs + 'px "Noto Sans SC", "Microsoft YaHei", sans-serif';
      g.fillText(txt, W / 2, H / 2 + 4);
    } else { /* neon */
      g.strokeStyle = col; g.lineWidth = 10;
      g.shadowColor = col; g.shadowBlur = 26;
      g.strokeRect(16, 16, W - 32, H - 32);
      g.fillStyle = '#fff';
      g.shadowBlur = 34;
      g.font = '900 ' + fs + 'px "Noto Sans SC", "Microsoft YaHei", sans-serif';
      g.strokeStyle = col; g.lineWidth = 3;
      g.fillText(txt, W / 2, H / 2 + 4);
      g.strokeText(txt, W / 2, H / 2 + 4);
    }
  }
  function makeSign(cfg) {
    var cv = document.createElement('canvas'); cv.width = 640; cv.height = 200;
    drawSignCanvas(cv, cfg);
    var tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
    var animMap = { steady: 0, chase: 1, pulse: 2, rainbow: 3 };
    var mat = new T.ShaderMaterial({
      uniforms: { uMap: { value: tx }, uTime: { value: 0 }, uAnim: { value: animMap[cfg.anim] || 0 }, uTint: { value: new T.Vector3(1, 1, 1) } },
      vertexShader: G.sign.vert, fragmentShader: G.sign.frag,
      transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending
    });
    var w = cfg.w || 16, h = w * 200 / 640;
    var mesh = new T.Mesh(new T.PlaneGeometry(w, h), mat);
    var grp = new T.Group();
    var poleMat = new T.MeshBasicMaterial({ color: 0x2a2a30 });
    var pole = new T.Mesh(new T.BoxGeometry(0.3, 1, 0.3), poleMat);
    grp.add(pole); grp.add(mesh);
    function place() {
      var base = B(cfg.x, cfg.y, 0);
      grp.position.copy(base);
      var hgt = cfg.height || 4;
      mesh.position.y = hgt + h / 2;
      pole.scale.y = Math.max(0.1, hgt + h / 2);
      pole.position.y = (hgt + h / 2) / 2;
      if (cfg.faceCam) { /* 每帧朝向 */ }
      else grp.rotation.y = (cfg.yaw || 0) * Math.PI / 180;
    }
    place();
    mesh.renderOrder = 11;
    fxGroup.add(grp);
    return {
      cfg: cfg, grp: grp, mesh: mesh, mat: mat, cv: cv, tx: tx,
      refresh: function (nc) {
        Object.assign(this.cfg, nc);
        drawSignCanvas(this.cv, this.cfg);
        this.tx.needsUpdate = true;
        this.mat.uniforms.uAnim.value = animMap[this.cfg.anim] || 0;
        var w2 = this.cfg.w || 16, h2 = w2 * 200 / 640;
        this.mesh.geometry.dispose();
        this.mesh.geometry = new T.PlaneGeometry(w2, h2);
        place();
      },
      remove: function () {
        fxGroup.remove(this.grp);
        this.mesh.geometry.dispose(); this.tx.dispose(); this.mat.dispose();
      },
      update: function (dt, time, cam) {
        this.mat.uniforms.uTime.value = time;
        if (this.cfg.faceCam) this.mesh.lookAt(cam.position);
      }
    };
  }
  function addSign(cfg) {
    if (signs.length >= 8) return -1;
    var s = makeSign(cfg); signs.push(s);
    running('signs', true);
    return signs.length - 1;
  }

  /* ============ 跑马灯环带 ============ */
  var ticker = (function () {
    var cv = document.createElement('canvas'); cv.width = 2048; cv.height = 64;
    var g = cv.getContext('2d');
    g.fillStyle = '#070605'; g.fillRect(0, 0, 2048, 64);
    function draw(txt) {
      g.fillStyle = '#070605'; g.fillRect(0, 0, 2048, 64);
      g.font = '700 44px "Noto Sans SC", "Microsoft YaHei", sans-serif';
      g.fillStyle = '#ffc46a';
      g.textBaseline = 'middle';
      var x = 20;
      while (x < 2048) { g.fillText(txt, x, 34); x += g.measureText(txt).width + 90; }
      tx.needsUpdate = true;
    }
    var tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
    tx.wrapS = T.RepeatWrapping; tx.repeat.set(8, 1);
    var mat = new T.MeshBasicMaterial({ map: tx, side: T.DoubleSide, transparent: false });
    var geo = new T.BufferGeometry();
    var SEG = 160, verts = [], uvs = [], idxs = [];
    for (var i = 0; i <= SEG; i++) {
      var a = i / SEG * Math.PI * 2;
      var ex = Math.cos(a) * 101, ey = Math.sin(a) * 75;
      var hz = 40 + Math.cos(2 * a) * 6 + 1.8;
      var v1 = B(ex, ey, hz + 1.0), v2 = B(ex, ey, hz - 1.0);
      verts.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
      var u = i / SEG * 8;
      uvs.push(u, 1, u, 0);
      if (i < SEG) { var b = i * 2; idxs.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    geo.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idxs);
    var mesh = new T.Mesh(geo, mat);
    mesh.renderOrder = 12;
    fxGroup.add(mesh);
    mesh.visible = false;
    var on = false;
    ctx.tickerTex = tx;
    return {
      set: function (txt) {
        if (!txt) { on = false; mesh.visible = false; return; }
        draw(txt); on = true; mesh.visible = true;
      },
      update: function (dt) { if (on) tx.offset.x += dt * 0.06; }
    };
  })();

  /* ============ 事件处理 ============ */
  var strobeValFlash = 0;
  function handle(ev, a) {
    a = a || {};
    switch (ev) {
      case 'fw': firework(a.pos, a.size || 1, a.color || [1, 0.7, 0.3]); break;
      case 'volley': volley(a.n || 5, a.r || 200, a.h || 95); break;
      case 'strobe': strobeValFlash = a.p || 0.6; if (ctx.audio) ctx.audio.click(); break;
      case 'co2': co2Burst(a.p || 1); break;
      case 'confetti': confettiBurst(a.p); break;
      case 'sparks': sparkFall(a.p); break;
      case 'flame': state.fire = Math.max(state.fire, a.p || 1); break;
      case 'goldrain': state.goldrain = !!a.on; running('goldrain', !!a.on); break;
      case 'lightrain': lightRain(!!a.on); break;
      case 'surge': state.surge = Math.max(state.surge, a.p || 1); break;
      case 'shock': shockwave(a.pos || [30, 0, 30], a.r || 60); break;
      case 'mirror': mirror.set(!!a.on); break;
      case 'holo': holo.set(a.p ? true : false); break;
      case 'tornado': state.tornado[a.i | 0] = a.on ? 1 : 0; running('tornado' + (a.i | 0), !!a.on); break;
      case 'firering': state.firering = !!a.on; running('firering', !!a.on); break;
      case 'laserh': state.laserh = !!a.on; running('laserhour', !!a.on); break;
      case 'card':
        if (a.txt) { crowd.drawCard(a.txt); crowd.mat.uniforms.uCardOn.value = 1; running('cardstunt', true); }
        else { crowd.mat.uniforms.uCardOn.value = 0; running('cardstunt', false); }
        break;
      case 'halo': haloOn = !!a.on; running('halo', !!a.on); break;
      case 'galaxy': galaxy.target = a.on ? 1 : 0; running('galaxy', !!a.on); break;
      case 'beams': beamPattern = a.p || beamPattern; break;
      case 'stroketext': roofText.show(a.txt); break;
      case 'ledrise': state.ledRise = true; break;
      case 'droneshow':
        if (dronesFollow) drones[0].show({
          shape: a.shape || 'text', text: a.txt || null,
          color: a.color || [1, 0.72, 0.3], fx: 'steady', height: 62, scale: 1, x: 0, y: 0
        });
        running('droneshow', true);
        break;
      case 'spot': beamBoost = 0.8; setTimeout(function () { beamBoost = 0; }, 2200); break;
      default:
        if (ctx.world && ctx.world.trigger) ctx.world.trigger(ev, a);
    }
  }

  /* ============ URL 参数预置 ============ */
  if (P.sign) {
    addSign({
      x: -215, y: 125, height: 5, w: 18, text: P.sign,
      color: P.colorValue('signColor') || '#f0b85a',
      style: P.signStyle, anim: P.signAnim, faceCam: false, yaw: 55
    });
  }
  if (P.ticker) ticker.set(P.ticker);
  if (P.drone || (P.droneShape && P.droneShape !== 'text')) {
    dronesFollow = false;
    var spot = { behind: [70, 0, 66], lake: [-240, 130, 78], crown: [0, 0, 92] }[P.droneSpot || 'behind'] || [70, 0, 66];
    drones[0].show({
      shape: P.droneShape, text: P.drone || null,
      color: colorTriplet(P.colorName('droneColor') || 'gold'),
      fx: P.droneFx, height: spot[2], x: spot[0], y: spot[1], scale: 1.2
    });
  }

  /* ============ 每帧更新 ============ */
  var lerpV3 = function (u, target, a, b, k) {
    u.set(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
  };
  var glowColor = new T.Vector3();
  function update(dt, showTime, cam) {
    state.showTime = showTime;
    state.beat = showTime / SHOW.BEAT;
    state.mood = SHOW.moodAt(showTime);
    var mood = state.mood;
    var time = performance.now() / 1000;
    /* LED 主屏 */
    if (state.ledRise) state.ledPower = Math.min(1, state.ledPower + dt * 0.5);
    else {
      var chN = SHOW.chapterAt(showTime) + 1;
      var tgtP = (chN >= 4) ? 1 : (chN === 2 ? 0.35 : 0.06);
      state.ledPower += (tgtP - state.ledPower) * Math.min(1, dt * 1.2);
    }
    ledMat.uniforms.uTime.value = time;
    ledMat.uniforms.uPower.value = state.ledPower;
    ledMat.uniforms.uHue.value = mood.led / 10;
    if (mood.led === 6) { ledMat.uniforms.uHasTex.value = 1; ledMat.uniforms.uTex.value = ledTitleTex; }
    else ledMat.uniforms.uHasTex.value = 0;
    /* 光束 / 激光 */
    if (!state.laserh) laserPattern = mood.laser; else laserPattern = 'hourglass';
    if (beamPattern === 'off' || mood.beam) beamPattern = mood.beam;
    updateBeams(time);
    updateLasers(time);
    /* 频闪衰减 */
    strobeValFlash = Math.max(0, strobeValFlash - dt * 3.2);
    var sc = Math.min(1, strobeValFlash);
    strobeMat.color.setRGB(sc * 1.8, sc * 1.7, sc * 1.5);
    /* 火焰等发射器 */
    updateFire(dt, time);
    /* 人群 */
    state.surge = Math.max(0, state.surge - dt * 0.5);
    var cu = crowd.mat.uniforms;
    cu.uTime.value = time; cu.uBeat.value = state.beat;
    cu.uIntensity.value = mood.crowd * Math.min(P.crowd, 1.5) + state.surge;
    lerpV3(cu.uColA.value, 0, mood.hueA, mood.hueA, 1);
    lerpV3(cu.uColB.value, 0, mood.hueB, mood.hueB, 1);
    /* 表演者 */
    performers.update(time, state.beat);
    /* 雾 */
    hazeMats.forEach(function (m) { m.uniforms.uTime.value = time; m.uniforms.uDensity.value = 0.75 * P.haze * (mood.crowd * 0.5 + 0.5); });
    /* 各系统 */
    galaxy.update(dt); mirror.update(dt, time); holo.update(dt, time);
    updateHalos(dt, time); updateShocks(dt); roofText.update(dt);
    drones.forEach(function (d) { d.update(dt, time); });
    signs.forEach(function (s) { s.update(dt, time, cam); });
    ticker.update(dt);
    /* 自定义灯光循环填充 */
    var li = 0;
    for (var bf = 0; bf < beamFixtures.length && li < 14; bf += 3) {
      var f = beamFixtures[bf];
      var cm = (bf % 2) ? mood.hueA : mood.hueB;
      klSet(li++, f.pos, cm, 26 * state.ledPower * (f.grp === 'truss' ? 1 : 0.5) + 8);
    }
    for (var fwI = 0; fwI < fwFlashes.length && li < 20; fwI++) {
      var fl = fwFlashes[fwI];
      fl.k = Math.max(0, fl.k - dt * 1.4);
      klSet(li++, fl.pos, fl.col, fl.k * 320);
    }
    var strobeP = B(50, 0, 4);
    klSet(li++, strobeP, [1, 0.95, 0.85], strobeValFlash * 260);
    if (state.fire > 0) klSet(li++, B(51, 0, 4), [1, 0.5, 0.15], 90 * state.fire);
    if (holo.k > 0) klSet(li++, B(60, 0, 18), [1, 0.55, 0.2], 140 * holo.k);
    while (li < 24) { klSet(li++, new T.Vector3(0, -500, 0), [0, 0, 0], 0); }
    floorMat.uniforms.uLPos.value = KL.pos;
    floorMat.uniforms.uLCol.value = KL.col;
    floorMat.uniforms.uTime.value = time;
    floorMat.uniforms.uBeat.value = state.beat;
    /* 世界联动色 */
    glowColor.set(mood.hueA[0], mood.hueA[1], mood.hueA[2]).multiplyScalar(0.4 + state.ledPower * 0.8);
    ctx.glow = glowColor;
    pool.flush(time);
  }

  function resetTransient() {
    strobeValFlash = 0; state.fire = 0; state.surge = 0;
  }
  /* seek 后按时间区间重建持续性灯光/特效状态（一次性脉冲不重放） */
  function seekTo(t) {
    var ch = SHOW.chapterAt(t) + 1;
    state.ledRise = t >= 31;
    state.ledPower = ch >= 4 ? 1 : (ch === 2 ? 0.5 : 0.08);
    state.laserh = false;
    state.fire = (t >= 31 && t < 43) ? 0.6 : 0;
    state.tornado = [0, 1, 2, 3].map(function (i) { return (t >= 52.3 + i * 5 && t < 71) ? 1 : 0; });
    state.firering = t >= 95.4 && t < 116.8;
    state.goldrain = (t >= 50.5 && t < 56) || (t >= 78.5 && t < 84);
    galaxy.target = (t >= 22 && t < 31) ? 1 : 0;
    mirror.set(t >= 71 && t < 80);
    holo.set(t >= 95.1 && t < 116.5 ? true : false);
    holo.k = t >= 95.1 ? 1 : 0;
    haloOn = t >= 11 && t < 21.2;
    crowd.mat.uniforms.uCardOn.value = 0;
    strobeValFlash = 0; state.surge = 0;
  }

  /* ============ 对外 API ============ */
  window.KOB_FX = {
    handle: handle,
    update: update,
    resetTransient: resetTransient,
    seekTo: seekTo,
    signs: {
      add: addSign,
      remove: function (i) { if (signs[i]) { signs[i].remove(); signs.splice(i, 1); } if (!signs.length) running('signs', false); },
      update: function (i, cfg) { if (signs[i]) signs[i].refresh(cfg); },
      list: function () { return signs.map(function (s) { return Object.assign({}, s.cfg); }); },
      max: 8
    },
    drones: {
      set: function (i, cfg) { dronesFollow = false; if (drones[i]) drones[i].show(cfg); },
      clear: function (i) { if (drones[i]) drones[i].hide(); },
      follow: function (v) { dronesFollow = v; },
      isFollow: function () { return dronesFollow; },
      colorTriplet: colorTriplet,
      max: 3, cap: DRONE_CAP
    },
    ticker: function (txt) { ticker.set(txt); },
    lights: function () { return KL; },
    applyQuality: function (mul) {
      qMul = mul;
      crowd.applyQuality();
    },
    state: state
  };
  ctx.fx = window.KOB_FX;
});
})();
