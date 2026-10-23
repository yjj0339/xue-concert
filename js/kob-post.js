/* kob-post.js — HDR 后处理链：场景 RT(MSAA+深度) → 景深 DOF → 运动模糊 → 泛光 bloom 金字塔 → 变形拉丝 streaks → 色调映射合成（ACES+颗粒+暗角+色边） */
(function () {
'use strict';
window.KOB_FILE_BUILD = '20261023.1';
window.KOB.report('kob-post');

window.KOB.onReady(function (ctx) {
  var T = ctx.THREE, renderer = ctx.renderer, P = ctx.params, G = ctx.GLSL;

  var quadScene = new T.Scene();
  var quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  var quadGeo = new T.PlaneGeometry(2, 2);
  var quadMesh = new T.Mesh(quadGeo, null);
  quadMesh.frustumCulled = false;
  quadScene.add(quadMesh);

  function mkMat(frag, uniforms) {
    return new T.ShaderMaterial({
      uniforms: uniforms, vertexShader: G.post.quad, fragmentShader: frag,
      depthTest: false, depthWrite: false
    });
  }
  function mkRT(w, h, opts) {
    opts = opts || {};
    var rt = new T.WebGLRenderTarget(Math.max(2, Math.floor(w)), Math.max(2, Math.floor(h)), {
      minFilter: T.LinearFilter, magFilter: T.LinearFilter,
      format: T.RGBAFormat, type: opts.byte ? T.UnsignedByteType : T.HalfFloatType,
      depthBuffer: !!opts.depth, samples: opts.samples || 0,
      generateMipmaps: false
    });
    if (opts.depth) {
      rt.depthTexture = new T.DepthTexture(rt.width, rt.height);
      rt.depthTexture.type = T.UnsignedIntType;
    }
    return rt;
  }

  var W = 2, H = 2;
  var sceneRT = null;
  var dofRT = null, mbRT = null, finalRT = null, snapRT = null;
  var bloomLevels = [];
  var BLOOM_MIPS = 5;
  var streakRT = null;
  var prevVP = new T.Matrix4();

  var brightMat, blurMat, upMat, streakMat, dofMat, mbMat, compMat;
  function initMats() {
    brightMat = mkMat(G.post.bright, { tMap: { value: null }, uThresh: { value: 0.62 } });
    blurMat = mkMat(G.post.blur, { tMap: { value: null }, uDir: { value: new T.Vector2() } });
    upMat = mkMat(G.post.up, { tLow: { value: null }, tHigh: { value: null }, uMix: { value: 0.6 } });
    streakMat = mkMat(G.post.streak, { tMap: { value: null }, uDir: { value: new T.Vector2(1, 0) }, uKeep: { value: 1.0 } });
    dofMat = mkMat(G.post.dof, {
      tMap: { value: null }, tDepth: { value: null },
      uFocus: { value: 120 }, uRange: { value: 130 },
      uNear: { value: 0.5 }, uFar: { value: 9000 }, uTaps: { value: 20 }
    });
    mbMat = mkMat(G.post.mblur, {
      tMap: { value: null }, tDepth: { value: null },
      uInvVP: { value: new T.Matrix4() }, uPrevVP: { value: new T.Matrix4() },
      uAmt: { value: 0.6 }, uNear: { value: 0.5 }, uFar: { value: 9000 }
    });
    compMat = mkMat(G.post.composite, {
      tScene: { value: null }, tBloom: { value: null }, tStreak: { value: null },
      uEv: { value: 0 }, uGrain: { value: 1 }, uTime: { value: 0 }, uVig: { value: 1 }, uHazeTint: { value: 0.5 }
    });
  }
  initMats();

  var q = { config: { samples: 2, dofTaps: 20, bloom: 1, scale: 1 } };

  function alloc(w, h) {
    W = Math.max(2, Math.floor(w)); H = Math.max(2, Math.floor(h));
    if (sceneRT) sceneRT.dispose();
    if (dofRT) dofRT.dispose();
    if (mbRT) mbRT.dispose();
    if (streakRT) streakRT.dispose();
    if (snapRT) snapRT.dispose();
    bloomLevels.forEach(function (l) { l.dispose(); });
    bloomLevels = [];
    sceneRT = mkRT(W, H, { depth: true, samples: q.config.samples });
    dofRT = mkRT(W, H);
    mbRT = mkRT(W, H);
    finalRT = mkRT(W, H);
    snapRT = mkRT(W, H, { byte: true });
    var bw = W, bh = H;
    for (var i = 0; i < BLOOM_MIPS; i++) {
      bw = Math.max(2, Math.floor(bw / 2)); bh = Math.max(2, Math.floor(bh / 2));
      bloomLevels.push(mkRT(bw, bh));
    }
    streakRT = mkRT(Math.max(2, Math.floor(W / 4)), Math.max(2, Math.floor(H / 4)));
  }
  alloc(2, 2);

  function run(mat, rt) {
    quadMesh.material = mat;
    renderer.setRenderTarget(rt || null);
    renderer.render(quadScene, quadCam);
  }
  function tex(mat, name, t) { mat.uniforms[name].value = t; }

  function render(scene, camera, targetRT) {
    var t0 = performance.now() / 1000;
    /* 1. 场景 */
    renderer.setRenderTarget(sceneRT);
    renderer.clear();
    renderer.render(scene, camera);
    /* 2. 景深 */
    var src = sceneRT.texture;
    if (q.config.dofTaps > 0 && P.dof) {
      dofMat.uniforms.tMap.value = src;
      dofMat.uniforms.tDepth.value = sceneRT.depthTexture;
      dofMat.uniforms.uTaps.value = q.config.dofTaps;
      dofMat.uniforms.uNear.value = camera.near;
      dofMat.uniforms.uFar.value = camera.far;
      dofMat.uniforms.uFocus.value = ctx.focusDist || 120;
      dofMat.uniforms.uRange.value = Math.max(60, (ctx.focusDist || 120) * 1.4);
      run(dofMat, dofRT);
      src = dofRT.texture;
    }
    /* 3. 运动模糊 */
    if (P.mblur) {
      mbMat.uniforms.tMap.value = src;
      mbMat.uniforms.tDepth.value = sceneRT.depthTexture;
      mbMat.uniforms.uInvVP.value.copy(camera.matrixWorldInverse).multiply(camera.projectionMatrix).invert();
      mbMat.uniforms.uPrevVP.value.copy(prevVP);
      mbMat.uniforms.uNear.value = camera.near;
      mbMat.uniforms.uFar.value = camera.far;
      mbMat.uniforms.uAmt.value = q.config.mblurAmt != null ? q.config.mblurAmt : 0.55;
      run(mbMat, mbRT);
      src = mbRT.texture;
    }
    camera.updateMatrixWorld();
    prevVP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    /* 4. 泛光金字塔 */
    var bloomScale = Math.max(0, Math.min(4, P.bloom));
    if (bloomScale > 0.01 && q.config.bloom > 0) {
      tex(brightMat, 'tMap', src);
      brightMat.uniforms.uThresh.value = 0.6;
      run(brightMat, bloomLevels[0]);
      for (var i = 0; i < BLOOM_MIPS - 1; i++) {
        tex(blurMat, 'tMap', bloomLevels[i].texture);
        blurMat.uniforms.uDir.value.set(1.4 / bloomLevels[i].width, 0);
        run(blurMat, bloomLevels[i + 1]);
        tex(blurMat, 'tMap', bloomLevels[i + 1].texture);
        blurMat.uniforms.uDir.value.set(0, 1.4 / bloomLevels[i + 1].height);
        run(blurMat, bloomLevels[i + 1]);
      }
      for (var j = BLOOM_MIPS - 2; j >= 0; j--) {
        tex(upMat, 'tLow', bloomLevels[j + 1].texture);
        tex(upMat, 'tHigh', bloomLevels[j].texture);
        upMat.uniforms.uMix.value = 0.55;
        run(upMat, bloomLevels[j]);
      }
      /* 5. 变形拉丝（水平） */
      if (P.flare > 0.01) {
        tex(streakMat, 'tMap', bloomLevels[2].texture);
        streakMat.uniforms.uKeep.value = P.flare;
        run(streakMat, streakRT);
      }
    }
    /* 6. 合成 */
    compMat.uniforms.tScene.value = src;
    compMat.uniforms.tBloom.value = (bloomScale > 0.01 && q.config.bloom > 0) ? bloomLevels[0].texture : blackTex();
    compMat.uniforms.tStreak.value = (P.flare > 0.01) ? streakRT.texture : blackTex();
    compMat.uniforms.uEv.value = 0.55 + P.ev * 0.35;
    compMat.uniforms.uGrain.value = P.grain;
    compMat.uniforms.uTime.value = t0;
    compMat.uniforms.uVig.value = 1;
    compMat.uniforms.uHazeTint.value = Math.min(1, P.haze * 0.35);
    run(compMat, targetRT || null);
  }

  var _black = null;
  function blackTex() {
    if (!_black) {
      var d = new Uint8Array([0, 0, 0, 255]);
      _black = new T.DataTexture(d, 1, 1);
      _black.needsUpdate = true;
    }
    return _black;
  }

  function resize(cssW, cssH, pixelScale) {
    alloc(cssW * pixelScale, cssH * pixelScale);
  }

  function readPixels(w, h) {
    var buf = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(snapRT, 0, 0, w, h, buf);
    return buf;
  }

  window.KOB_POST = {
    render: render,
    resize: resize,
    setSize: alloc,
    readPixels: readPixels,
    finalRT: function () { return finalRT; },
    snapRT: function () { return snapRT; },
    sceneRT: function () { return sceneRT; },
    applyQuality: function (cfg) {
      Object.assign(q.config, cfg);
      alloc(W, H); /* 重建 RT（不改着色器，无重编译卡顿） */
    },
    dims: function () { return { w: W, h: H }; }
  };
  ctx.post = window.KOB_POST;
});
})();
