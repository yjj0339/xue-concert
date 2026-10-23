/* kob-world.js — 奥林匹克公园外景：龙形水系(倒影+音乐喷泉) / 湿地广场 / 树木路灯人群 / 水立方 / 玲珑塔 / 奥林匹克塔 / 城市天际线 / 车流 / 探照灯 / 场外特效(孔明灯·极光·水上火焰·莲花灯·地面投影·萤火·城市秀·LED飞艇·打铁花) */
(function () {
'use strict';
window.KOB_FILE_BUILD = '20261023.1';
window.KOB.report('kob-world');

window.KOB.onReady(function (ctx) {
  var T = ctx.THREE, scene = ctx.scene, P = ctx.params, G = ctx.GLSL;
  function B(x, y, z) { return new T.Vector3(x, z, -y); }
  var rng = (function () { var s = (P.seed + 11) * 48271 % 2147483647; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
  function R(a, b) { return a + rng() * (b - a); }
  var grp = new T.Group(); scene.add(grp);
  var time = 0;
  var world = {};

  /* ============ 远景底板 ============ */
  (function () {
    var gnd = new T.Mesh(new T.CircleGeometry(5000, 48), new T.MeshBasicMaterial({ color: 0x07080b }));
    gnd.rotation.x = -Math.PI / 2; gnd.position.y = -0.4;
    grp.add(gnd);
    scene.fog = new T.FogExp2(0x070a10, 0.00055);
  })();

  /* ============ 星空 + 极光穹顶 ============ */
  var auroraMat = new T.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 0.0 } },
    vertexShader: G.aurora.vert, fragmentShader: G.aurora.frag,
    side: T.BackSide, transparent: true, depthWrite: false, blending: T.AdditiveBlending
  });
  grp.add(new T.Mesh(new T.SphereGeometry(3600, 32, 18), auroraMat));
  (function () {
    var N = 2400, pos = new Float32Array(N * 3), sz = new Float32Array(N), tw = new Float32Array(N);
    for (var i = 0; i < N; i++) {
      var a = rng() * Math.PI * 2, b2 = Math.acos(R(0.03, 1));
      var r = 3400;
      pos[i * 3] = Math.sin(b2) * Math.cos(a) * r; pos[i * 3 + 1] = Math.cos(b2) * r; pos[i * 3 + 2] = Math.sin(b2) * Math.sin(a) * r;
      sz[i] = R(1.2, 3.2); tw[i] = rng();
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new T.BufferAttribute(sz, 1));
    geo.setAttribute('aTw', new T.BufferAttribute(tw, 1));
    var mat = new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: G.stars.vert, fragmentShader: G.stars.frag,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending
    });
    var pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = -10;
    grp.add(pts);
    world.stars = mat;
  })();

  /* ============ 龙形水系 ============ */
  var waterMat = new T.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uBeat: { value: 0 }, uGlow: { value: new T.Vector3(0.9, 0.6, 0.25) } },
    vertexShader: G.water.vert, fragmentShader: G.water.frag,
    transparent: true
  });
  (function () {
    var path = [
      [-240, 350, 105], [-330, 235, 95], [-365, 95, 85], [-320, -25, 80],
      [-385, -155, 70], [-330, -290, 80], [-195, -345, 90], [-55, -315, 85]
    ];
    var verts = [], idx = [];
    for (var i = 0; i < path.length; i++) {
      var p = path[i];
      var nx = i === 0 ? path[1][0] - p[0] : (i === path.length - 1 ? p[0] - path[i - 1][0] : path[i + 1][0] - path[i - 1][0]);
      var ny = i === 0 ? path[1][1] - p[1] : (i === path.length - 1 ? p[1] - path[i - 1][1] : path[i + 1][1] - path[i - 1][1]);
      var l = Math.hypot(nx, ny); nx /= l; ny /= l;
      var w = p[2] / 2;
      verts.push((p[0] - ny * w) / 1, 0.04, -(p[1] + nx * w) / 1);
      verts.push((p[0] + ny * w) / 1, 0.04, -(p[1] - nx * w) / 1);
      if (i < path.length - 1) { var b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx);
    var mesh = new T.Mesh(geo, waterMat);
    grp.add(mesh);
  })();
  /* 雨后湿地广场（微弱水面反光） */
  var wetMat = new T.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uBeat: { value: 0 }, uGlow: { value: new T.Vector3(0.13, 0.11, 0.1) } },
    vertexShader: G.water.vert, fragmentShader: G.water.frag, transparent: true
  });
  (function () {
    var wet = new T.Mesh(new T.CircleGeometry(171, 64), wetMat);
    wet.rotation.x = -Math.PI / 2; wet.position.y = 0.03;
    grp.add(wet);
  })();

  /* ============ 世界迷你粒子池（喷泉/水上火焰/打铁花） ============ */
  var WPOOL = 3000;
  var wpool = (function () {
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(WPOOL * 3), vel = new Float32Array(WPOOL * 3), col = new Float32Array(WPOOL * 3);
    var t0 = new Float32Array(WPOOL).fill(-1e9), life = new Float32Array(WPOOL).fill(1);
    var sz = new Float32Array(WPOOL), tp = new Float32Array(WPOOL), sd = new Float32Array(WPOOL);
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('aVel', new T.BufferAttribute(vel, 3));
    geo.setAttribute('aColor', new T.BufferAttribute(col, 3));
    geo.setAttribute('aT0', new T.BufferAttribute(t0, 1));
    geo.setAttribute('aLife', new T.BufferAttribute(life, 1));
    geo.setAttribute('aSize', new T.BufferAttribute(sz, 1));
    geo.setAttribute('aType', new T.BufferAttribute(tp, 1));
    geo.setAttribute('aSeed', new T.BufferAttribute(sd, 1));
    var mat = new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 600 } },
      vertexShader: G.particle.vert, fragmentShader: G.particle.frag,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending
    });
    var pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 20;
    grp.add(pts);
    var head = 0, d0 = 1e9, d1 = -1;
    function mark(i) { if (i < d0) d0 = i; if (i > d1) d1 = i; }
    return {
      emit: function (p, v, c, lf, s, t) {
        var i = head; head = (head + 1) % WPOOL;
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        vel[i * 3] = v.x; vel[i * 3 + 1] = v.y; vel[i * 3 + 2] = v.z;
        col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
        t0[i] = time; life[i] = lf; sz[i] = s; tp[i] = t; sd[i] = rng();
        mark(i);
      },
      flush: function () {
        mat.uniforms.uTime.value = time;
        if (d1 >= 0) {
          var at = geo.attributes;
          ['position', 'aVel', 'aColor', 'aT0', 'aLife', 'aSize', 'aType', 'aSeed'].forEach(function (n) {
            var a = at[n];
            var off = d0 * a.itemSize, cnt = (d1 - d0 + 1) * a.itemSize;
            if (a.addUpdateRange) {
              if (a.clearUpdateRanges) a.clearUpdateRanges();
              a.addUpdateRange(off, cnt);
            }
            a.needsUpdate = true;
          });
          d0 = 1e9; d1 = -1;
        }
      }
    };
  })();

  /* ============ 音乐喷泉（随节拍起舞） ============ */
  var fountainOn = false;
  function fountains(dt, beat) {
    if (!fountainOn) return;
    var bar = Math.floor(beat / 4);
    var barPhase = (beat / 4) % 1;
    var jets = 5;
    for (var j = 0; j < jets; j++) {
      var ang = j / jets * Math.PI * 2 + 0.4;
      var org = B(-160 + Math.cos(ang) * 26, 120 + Math.sin(ang) * 20, 0.5);
      var hgt = 14 + 22 * Math.abs(Math.sin(bar * 0.9 + j)) * (1 - barPhase * 0.35);
      var n = 3;
      for (var k = 0; k < n; k++) {
        wpool.emit(org, new T.Vector3(R(-1, 1), hgt * R(0.8, 1.1), R(-1, 1)), [0.55, 0.75, 0.95], R(1.6, 2.4), R(1.4, 2.2), 8);
      }
    }
  }

  /* ============ 水上火焰 ============ */
  var lakeFlameOn = false;
  function lakeFlames(dt) {
    if (!lakeFlameOn) return;
    var bases = [[-210, 260], [-300, 140], [-350, -60], [-260, -260]];
    for (var b = 0; b < bases.length; b++) {
      if (rng() < 0.6) {
        var p = B(bases[b][0] + R(-6, 6), bases[b][1] + R(-6, 6), 1);
        wpool.emit(p, new T.Vector3(R(-0.6, 0.6), R(5, 10), R(-0.6, 0.6)), [1, R(0.35, 0.6), 0.12], R(0.7, 1.2), R(2.5, 4), 2);
      }
    }
  }
  /* 打铁花 */
  function molten() {
    var org = B(-150, 210, 2);
    for (var burst = 0; burst < 3; burst++) {
      var n = 420;
      for (var i = 0; i < n; i++) {
        var a = rng() * Math.PI * 2, up = R(0.35, 1);
        var sp = R(16, 34);
        wpool.emit(org, new T.Vector3(Math.cos(a) * sp * Math.sqrt(1 - up * up), up * sp, Math.sin(a) * sp * Math.sqrt(1 - up * up)),
          [1, R(0.4, 0.75), 0.15], R(1.8, 3.2), R(1.2, 2), 3);
      }
    }
    if (ctx.audio) ctx.audio.boom(org, 2.2);
  }

  /* ============ 孔明灯（GPU 循环上升） ============ */
  var lanternMat = (function () {
    var N = 320;
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(N * 3), sd = new Float32Array(N);
    for (var i = 0; i < N; i++) {
      pos[i * 3] = R(-380, 200); pos[i * 3 + 1] = 0; pos[i * 3 + 2] = R(-320, 320);
      sd[i] = rng();
    }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new T.BufferAttribute(sd, 1));
    var mat = new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOn: { value: 0 } },
      vertexShader: [
        'attribute float aSeed; uniform float uTime,uOn;',
        'varying float vA; varying float vS;',
        'void main(){',
        '  float per=46.0+aSeed*30.0;',
        '  float k=mod(uTime*3.2+aSeed*per,per)/per;',
        '  vec3 p=position; p.y=2.0+k*130.0;',
        '  p.x+=sin(uTime*0.4+aSeed*20.0)*6.0*k;',
        '  p.z+=cos(uTime*0.3+aSeed*30.0)*6.0*k;',
        '  vec4 mv=modelViewMatrix*vec4(p,1.0);',
        '  gl_PointSize=clamp(280.0/max(-mv.z,0.1),1.0,10.0);',
        '  gl_Position=projectionMatrix*mv;',
        '  vA=uOn*min(k*6.0,1.0)*(1.0-smoothstep(0.82,1.0,k))*(0.7+0.3*sin(uTime*6.0+aSeed*40.0));',
        '  vS=aSeed;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'precision highp float; varying float vA; varying float vS;',
        'void main(){ vec2 q=gl_PointCoord-0.5; if(dot(q,q)>0.22) discard;',
        '  vec3 c=mix(vec3(1.0,0.62,0.25),vec3(1.0,0.85,0.5),vS);',
        '  gl_FragColor=vec4(c*vA*1.6,vA); }'
      ].join('\n'),
      transparent: true, depthWrite: false, blending: T.AdditiveBlending
    });
    var pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 9;
    grp.add(pts);
    return mat;
  })();

  /* ============ 莲花灯 ============ */
  var lotusMat = (function () {
    var N = 180;
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(N * 3), sd = new Float32Array(N);
    for (var i = 0; i < N; i++) {
      var idx2 = i / N * 7;
      var path = [[-240, 350], [-330, 235], [-365, 95], [-320, -25], [-385, -155], [-330, -290], [-195, -345]];
      var seg = Math.min(path.length - 2, Math.floor(idx2));
      var k = idx2 - seg;
      var lx = path[seg][0] + (path[seg + 1][0] - path[seg][0]) * k + R(-30, 30);
      var ly = path[seg][1] + (path[seg + 1][1] - path[seg][1]) * k + R(-30, 30);
      pos[i * 3] = lx; pos[i * 3 + 1] = 0.4; pos[i * 3 + 2] = -ly;
      sd[i] = rng();
    }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new T.BufferAttribute(sd, 1));
    var mat = new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOn: { value: 0 } },
      vertexShader: [
        'attribute float aSeed; uniform float uTime,uOn;',
        'varying float vA;',
        'void main(){ vec3 p=position;',
        '  p.y=0.4+0.25*sin(uTime*1.2+aSeed*30.0);',
        '  vec4 mv=modelViewMatrix*vec4(p,1.0);',
        '  gl_PointSize=clamp(200.0/max(-mv.z,0.1),1.0,7.0);',
        '  gl_Position=projectionMatrix*mv;',
        '  vA=uOn*(0.8+0.2*sin(uTime*3.0+aSeed*50.0)); }'
      ].join('\n'),
      fragmentShader: [
        'precision highp float; varying float vA;',
        'void main(){ vec2 q=gl_PointCoord-0.5; if(dot(q,q)>0.2) discard;',
        '  gl_FragColor=vec4(vec3(1.0,0.5,0.55)*vA*1.5,vA); }'
      ].join('\n'),
      transparent: true, depthWrite: false, blending: T.AdditiveBlending
    });
    var pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 9;
    grp.add(pts);
    return mat;
  })();

  /* ============ 萤火 ============ */
  var fireflyMat = (function () {
    var N = 260;
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(N * 3), sd = new Float32Array(N);
    for (var i = 0; i < N; i++) {
      var a = rng() * Math.PI * 2, r = R(210, 400);
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = R(1, 12); pos[i * 3 + 2] = Math.sin(a) * r * 0.9;
      sd[i] = rng();
    }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new T.BufferAttribute(sd, 1));
    var mat = new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOn: { value: 0 } },
      vertexShader: [
        'attribute float aSeed; uniform float uTime,uOn;',
        'varying float vA;',
        'void main(){ vec3 p=position;',
        '  p.x+=sin(uTime*0.7+aSeed*40.0)*4.0; p.z+=cos(uTime*0.5+aSeed*30.0)*4.0;',
        '  p.y+=sin(uTime*0.9+aSeed*20.0)*1.6;',
        '  vec4 mv=modelViewMatrix*vec4(p,1.0);',
        '  gl_PointSize=clamp(120.0/max(-mv.z,0.1),1.0,5.0);',
        '  gl_Position=projectionMatrix*mv;',
        '  float bl=0.5+0.5*sin(uTime*(1.5+aSeed*2.0)+aSeed*60.0);',
        '  vA=uOn*pow(bl,3.0); }'
      ].join('\n'),
      fragmentShader: [
        'precision highp float; varying float vA;',
        'void main(){ vec2 q=gl_PointCoord-0.5; if(dot(q,q)>0.25) discard;',
        '  gl_FragColor=vec4(vec3(0.7,1.0,0.45)*vA*1.8,vA); }'
      ].join('\n'),
      transparent: true, depthWrite: false, blending: T.AdditiveBlending
    });
    var pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 9;
    grp.add(pts);
    return mat;
  })();

  /* ============ 树木（暗剪影） ============ */
  (function () {
    var N = 260;
    var cone = new T.InstancedMesh(new T.ConeGeometry(3.2, 11, 6), new T.MeshBasicMaterial({ color: 0x0b1410 }), N);
    var ball = new T.InstancedMesh(new T.SphereGeometry(4.4, 7, 5), new T.MeshBasicMaterial({ color: 0x0c1811 }), N);
    var m = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3();
    for (var i = 0; i < N; i++) {
      var a = rng() * Math.PI * 2, r = R(200, 430);
      var x = Math.cos(a) * r, z = Math.sin(a) * r * 0.92;
      var sc = R(0.7, 1.5);
      s.set(sc, sc, sc);
      m.compose(new T.Vector3(x, 7.5 * sc, z), q, s); cone.setMatrixAt(i, m);
      m.compose(new T.Vector3(x, 13.5 * sc, z), q, s); ball.setMatrixAt(i, m);
    }
    grp.add(cone); grp.add(ball);
  })();

  /* ============ 路灯 ============ */
  (function () {
    var N = 130;
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(N * 3), sz = new Float32Array(N), tw = new Float32Array(N);
    for (var i = 0; i < N; i++) {
      var a = i / N * Math.PI * 2 + R(-0.02, 0.02), r = R(195, 415);
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = 9; pos[i * 3 + 2] = Math.sin(a) * r * 0.92;
      sz[i] = R(2, 3.4); tw[i] = rng() * 0.3;
    }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new T.BufferAttribute(sz, 1));
    geo.setAttribute('aTw', new T.BufferAttribute(tw, 1));
    var mat = new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: G.stars.vert, fragmentShader: G.stars.frag,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending
    });
    mat.fragmentShader = mat.fragmentShader.replace('vec3(0.9,0.93,1.0)', 'vec3(1.0,0.8,0.5)');
    var pts = new T.Points(geo, mat); pts.frustumCulled = false;
    grp.add(pts);
    world.lamps = mat;
  })();

  /* ============ 广场人群（漫步） ============ */
  (function () {
    var N = 500;
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(N * 3), sd = new Float32Array(N);
    for (var i = 0; i < N; i++) {
      var a = rng() * Math.PI * 2, r = R(185, 420);
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = 1; pos[i * 3 + 2] = Math.sin(a) * r * 0.92;
      sd[i] = rng();
    }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new T.BufferAttribute(sd, 1));
    var mat = new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: [
        'attribute float aSeed; uniform float uTime;',
        'varying float vA;',
        'void main(){ vec3 p=position;',
        '  float a=aSeed*6.2831+uTime*0.02*(aSeed>0.5?1.0:-1.0);',
        '  p.x+=cos(a)*8.0; p.z+=sin(a)*8.0; p.y=1.0+0.1*abs(sin(uTime*2.0+aSeed*20.0));',
        '  vec4 mv=modelViewMatrix*vec4(p,1.0);',
        '  gl_PointSize=clamp(160.0/max(-mv.z,0.1),1.0,4.0);',
        '  gl_Position=projectionMatrix*mv;',
        '  vA=0.5; }'
      ].join('\n'),
      fragmentShader: [
        'precision highp float; varying float vA;',
        'void main(){ vec2 q=gl_PointCoord-0.5; if(dot(q,q)>0.25) discard;',
        '  gl_FragColor=vec4(vec3(0.35,0.3,0.25)*vA,vA); }'
      ].join('\n'),
      transparent: true, depthWrite: false
    });
    var pts = new T.Points(geo, mat); pts.frustumCulled = false;
    grp.add(pts);
  })();

  /* ============ 水立方 ============ */
  (function () {
    var mat = new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uGlow: { value: new T.Vector3(0.25, 0.65, 1.0) } },
      vertexShader: [
        'varying vec3 vP; varying vec3 vN;',
        'void main(){ vP=position; vN=normal;',
        '  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }'
      ].join('\n'),
      fragmentShader: [
        'precision highp float;',
        'uniform float uTime; uniform vec3 uGlow;',
        'varying vec3 vP; varying vec3 vN;',
        'float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }',
        'void main(){',
        '  vec2 uv=vP.xy*0.5;',
        '  vec2 cell=floor(uv);',
        '  float r=h21(cell);',
        '  float pulse=0.5+0.5*sin(uTime*(0.6+r)+r*40.0);',
        '  vec3 base=vec3(0.02,0.06,0.11);',
        '  vec3 c=base+uGlow*(0.06+pulse*0.16);',
        '  vec2 f=fract(uv);',
        '  float frame=step(0.92,max(f.x,f.y));',
        '  c+=uGlow*frame*0.10;',
        '  float fr=pow(1.0-abs(vN.z),3.0);',
        '  c+=uGlow*fr*0.12;',
        '  gl_FragColor=vec4(c,1.0);',
        '}'
      ].join('\n')
    });
    var box = new T.Mesh(new T.BoxGeometry(178, 31, 128), mat);
    box.position.copy(B(-40, -262, 15.5));
    grp.add(box);
  })();

  /* ============ 玲珑塔 / 奥林匹克塔 ============ */
  (function () {
    var mat = new T.MeshBasicMaterial({ color: 0x141821 });
    var gl = new T.MeshBasicMaterial({ color: 0x2a3a55 });
    /* 玲珑塔：7 层 */
    var lx = B(165, -210, 0);
    for (var i = 0; i < 7; i++) {
      var w2 = 26 - i * 2.6;
      var box = new T.Mesh(new T.BoxGeometry(w2, 14, w2), i % 2 ? gl : mat);
      box.position.set(lx.x, 10 + i * 15.4, lx.z);
      grp.add(box);
    }
    /* 奥林匹克塔：塔身 + 观光环 */
    var ox = B(255, -330, 0);
    var stalk = new T.Mesh(new T.CylinderGeometry(3.5, 8, 250, 8), mat);
    stalk.position.set(ox.x, 125, ox.z);
    grp.add(stalk);
    for (var r2 = 0; r2 < 5; r2++) {
      var disc = new T.Mesh(new T.TorusGeometry(14 - r2 * 1.4, 1.6, 6, 24), gl);
      disc.rotation.x = Math.PI / 2;
      disc.position.set(ox.x, 120 + r2 * 22, ox.z);
      grp.add(disc);
    }
  })();

  /* ============ 城市天际线 ============ */
  var cityMat = new T.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uShow: { value: 0 }, uShowCol: { value: new T.Vector3(1.0, 0.6, 0.2) } },
    vertexShader: G.city.vert, fragmentShader: G.city.frag
  });
  (function () {
    var N = 230;
    var geo = new T.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    var im = new T.InstancedMesh(geo, cityMat, N);
    var m = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3();
    var rand = new Float32Array(N);
    for (var i = 0; i < N; i++) {
      var a = rng() * Math.PI * 2;
      var r = R(1150, 2600);
      var h2 = R(50, 420) * (rng() < 0.12 ? 1.5 : 1);
      var w2 = R(40, 90);
      s.set(w2, h2, w2 * R(0.7, 1.3));
      q.setFromAxisAngle(new T.Vector3(0, 1, 0), rng() * Math.PI);
      m.compose(new T.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r), q, s);
      im.setMatrixAt(i, m);
      rand[i] = rng();
    }
    im.geometry.setAttribute('aRand', new T.InstancedBufferAttribute(rand, 1));
    im.frustumCulled = false;
    grp.add(im);
  })();

  /* ============ 车流 ============ */
  var traffic = (function () {
    var N = 360;
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(N * 3), sd = new Float32Array(N);
    var items = [];
    for (var i = 0; i < N; i++) {
      var ring = rng() < 0.5 ? 520 : 810;
      var a = rng() * Math.PI * 2;
      var dir = rng() < 0.5 ? 1 : -1;
      var warm = rng() < 0.4;
      items.push({ ring: ring, a: a, dir: dir, warm: warm, sp: R(0.008, 0.02) });
      sd[i] = warm ? 1 : 0;
      pos[i * 3] = Math.cos(a) * ring; pos[i * 3 + 1] = 1.2; pos[i * 3 + 2] = Math.sin(a) * ring * 0.9;
    }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new T.BufferAttribute(sd, 1));
    var mat = new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: [
        'attribute float aSeed; uniform float uTime;',
        'varying float vW;',
        'void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0);',
        '  gl_PointSize=clamp(130.0/max(-mv.z,0.1),1.0,4.0);',
        '  gl_Position=projectionMatrix*mv; vW=aSeed; }'
      ].join('\n'),
      fragmentShader: [
        'precision highp float; varying float vW;',
        'void main(){ vec2 q=gl_PointCoord-0.5; if(dot(q,q)>0.25) discard;',
        '  vec3 c=vW>0.5?vec3(1.0,0.75,0.4):vec3(0.6,0.75,1.0);',
        '  gl_FragColor=vec4(c*1.4,0.9); }'
      ].join('\n'),
      transparent: true, depthWrite: false, blending: T.AdditiveBlending
    });
    var pts = new T.Points(geo, mat); pts.frustumCulled = false;
    grp.add(pts);
    var pa = geo.attributes.position;
    return {
      update: function (dt) {
        for (var i = 0; i < N; i++) {
          var it = items[i];
          it.a += it.dir * it.sp * dt * 8;
          pa.setXYZ(i, Math.cos(it.a) * it.ring, 1.2, Math.sin(it.a) * it.ring * 0.9);
        }
        pa.needsUpdate = true;
      }
    };
  })();

  /* ============ 探照灯光柱 ============ */
  var searchOn = false;
  var searchMesh = (function () {
    var geo = new T.CylinderGeometry(0.5, 5.5, 800, 6, 1, true);
    geo.translate(0, 400, 0);
    var mat = new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uFlicker: { value: 0.1 } },
      vertexShader: G.beam.vert, fragmentShader: G.beam.frag,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide
    });
    var im = new T.InstancedMesh(geo, mat, 6);
    im.geometry.setAttribute('aI', new T.InstancedBufferAttribute(new Float32Array(6).fill(0.14), 1));
    im.instanceColor = new T.InstancedBufferAttribute(new Float32Array(18), 3);
    for (var c = 0; c < 6; c++) im.instanceColor.setXYZ(c, 0.45, 0.62, 1.0);
    im.frustumCulled = false; im.renderOrder = 14;
    grp.add(im);
    return im;
  })();
  var sq = new T.Quaternion(), UP = new T.Vector3(0, 1, 0), sm = new T.Matrix4(), ss = new T.Vector3(1, 1, 1);
  function updateSearch(t) {
    if (!searchOn) { searchMesh.visible = false; return; }
    searchMesh.visible = true;
    searchMesh.material.uniforms.uTime.value = t;
    for (var i = 0; i < 6; i++) {
      var a = i / 6 * Math.PI * 2 + t * 0.05;
      var base = new T.Vector3(Math.cos(a) * 330, 0, Math.sin(a) * 300);
      var dir = new T.Vector3(Math.sin(t * 0.22 + i * 1.3) * 0.5, 1, Math.cos(t * 0.18 + i * 2.1) * 0.5).normalize();
      sq.setFromUnitVectors(UP, dir);
      sm.compose(base, sq, ss);
      searchMesh.setMatrixAt(i, sm);
    }
    searchMesh.instanceMatrix.needsUpdate = true;
  }

  /* ============ LED 飞艇 ============ */
  var blimp = (function () {
    var grp2 = new T.Group();
    var body = new T.Mesh(new T.SphereGeometry(9, 16, 12), new T.MeshBasicMaterial({ color: 0x1a1d26 }));
    body.scale.set(1, 0.42, 2.6);
    var cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
    var g = cv.getContext('2d');
    g.fillStyle = '#0a0806'; g.fillRect(0, 0, 512, 96);
    g.font = '900 58px "Noto Sans SC", "Microsoft YaHei", sans-serif';
    g.fillStyle = '#ffcf87'; g.textBaseline = 'middle'; g.textAlign = 'center';
    g.fillText('万兽之王 LIVE', 256, 52);
    var tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
    if (ctx.tickerTex) { /* 广场大屏共用跑马灯纹理在下方 banner towers */ }
    var banner = new T.Mesh(new T.PlaneGeometry(30, 6.2), new T.MeshBasicMaterial({ map: tx, side: T.DoubleSide }));
    banner.position.set(0, -3.6, 0);
    grp2.add(body); grp2.add(banner);
    grp2.visible = false;
    grp.add(grp2);
    return {
      grp: grp2,
      set: function (v) { grp2.visible = v; },
      update: function (t) {
        if (!grp2.visible) return;
        var a = t * 0.045;
        grp2.position.set(Math.cos(a) * 320, 165 + Math.sin(t * 0.3) * 8, Math.sin(a) * 290);
        grp2.rotation.y = -a;
      }
    };
  })();

  /* ============ 广场大屏（与跑马灯联动） ============ */
  (function () {
    var bMat = new T.MeshBasicMaterial({ color: 0x0a0a0c });
    var scrMat = new T.MeshBasicMaterial({ map: ctx.tickerTex || null, side: T.DoubleSide });
    var spots = [[-120, 235], [150, -205]];
    spots.forEach(function (sp) {
      var p = B(sp[0], sp[1], 0);
      var pole = new T.Mesh(new T.BoxGeometry(2.4, 34, 2.4), bMat);
      pole.position.set(p.x, 17, p.z);
      grp.add(pole);
      var scr = new T.Mesh(new T.PlaneGeometry(26, 9), scrMat);
      scr.position.set(p.x, 36, p.z);
      scr.rotation.y = Math.PI + Math.atan2(-p.z, -p.x);
      grp.add(scr);
    });
    world.screens = scrMat;
  })();

  /* ============ 地面投影 ============ */
  var projMat = new T.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOn: { value: 0 }, uColor: { value: new T.Vector3(1.0, 0.62, 0.25) } },
    vertexShader: G.decal.vert, fragmentShader: G.decal.frag,
    transparent: true, depthWrite: false, blending: T.AdditiveBlending
  });
  (function () {
    var m = new T.Mesh(new T.CircleGeometry(60, 48), projMat);
    m.rotation.x = -Math.PI / 2;
    var p = B(0, -215, 0.1);
    m.position.set(p.x, 0.35, p.z);
    grp.add(m);
  })();

  /* ============ 状态与触发 ============ */
  var states = { aurora: 0, lantern: 0, lotus: 0, firefly: 0, cityshow: 0, lakeflame: false, proj: 0, blimp: false };
  function trigger(ev, a) {
    a = a || {};
    switch (ev) {
      case 'fountain': fountainOn = !!a.on; break;
      case 'search': searchOn = !!a.on; break;
      case 'aurora': states.aurora = a.on ? 1 : 0; break;
      case 'lantern': states.lantern = a.on ? 1 : 0; break;
      case 'lotus': states.lotus = a.on ? 1 : 0; break;
      case 'firefly': states.firefly = a.on ? 1 : 0; break;
      case 'cityshow': states.cityshow = a.on ? 1 : 0; break;
      case 'lakeflame': states.lakeflame = !!a.on; break;
      case 'proj': states.proj = a.on ? 1 : 0; break;
      case 'blimp': states.blimp = !!a.on; blimp.set(states.blimp); break;
      case 'molten': molten(); break;
    }
  }

  function update(dt, showTime, cam) {
    time += dt;
    var t = time;
    waterMat.uniforms.uTime.value = t;
    waterMat.uniforms.uBeat.value = showTime / ctx.show.BEAT;
    if (ctx.glow) waterMat.uniforms.uGlow.value.copy(ctx.glow);
    wetMat.uniforms.uTime.value = t;
    wetMat.uniforms.uBeat.value = waterMat.uniforms.uBeat.value;
    auroraMat.uniforms.uTime.value = t;
    auroraMat.uniforms.uIntensity.value += (states.aurora - auroraMat.uniforms.uIntensity.value) * Math.min(1, dt * 0.5);
    lanternMat.uniforms.uTime.value = t;
    lanternMat.uniforms.uOn.value += (states.lantern - lanternMat.uniforms.uOn.value) * Math.min(1, dt * 0.5);
    lotusMat.uniforms.uTime.value = t;
    lotusMat.uniforms.uOn.value += (states.lotus - lotusMat.uniforms.uOn.value) * Math.min(1, dt * 0.5);
    fireflyMat.uniforms.uTime.value = t;
    fireflyMat.uniforms.uOn.value += (states.firefly - fireflyMat.uniforms.uOn.value) * Math.min(1, dt * 0.8);
    cityMat.uniforms.uTime.value = t;
    cityMat.uniforms.uShow.value += (states.cityshow - cityMat.uniforms.uShow.value) * Math.min(1, dt * 0.8);
    projMat.uniforms.uTime.value = t;
    projMat.uniforms.uOn.value += (states.proj - projMat.uniforms.uOn.value) * Math.min(1, dt * 0.9);
    if (world.stars) world.stars.uniforms.uTime.value = t;
    if (world.lamps) world.lamps.uniforms.uTime.value = t;
    fountains(dt, showTime / ctx.show.BEAT);
    lakeFlames(dt);
    traffic.update(dt);
    blimp.update(t);
    updateSearch(t);
    wpool.flush();
  }

  window.KOB_WORLD = world;
  world.trigger = trigger;
  world.update = update;
  world.states = states;
  ctx.world = world;
});
})();
