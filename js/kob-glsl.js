/* kob-glsl.js — 全部着色器源（LED 内容 / 光束 / 激光 / 粒子 / 人群 / 无人机 / 大气 / 水面 / 城市 / 极光 / 全息 / 镜头后处理） */
(function () {
'use strict';
window.KOB_FILE_BUILD = '20261023.1';
window.KOB.report('kob-glsl');

var NOISE = [
'float hash11(float p){ p=fract(p*0.1031); p*=p+33.33; p*=p+p; return fract(p); }',
'float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }',
'float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);',
'  float a=hash12(i),b=hash12(i+vec2(1,0)),c=hash12(i+vec2(0,1)),d=hash12(i+vec2(1,1));',
'  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }',
'float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*vnoise(p); p*=2.03; a*=0.5; } return v; }',
'float hash13(vec3 p){ p=fract(p*0.1031); p+=dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }'
].join('\n');

window.KOB_GLSL = {

/* ---------------- LED 主屏 / 大屏内容 ---------------- */
led: {
  vert: [
    'varying vec2 vUv; varying vec3 vN; varying vec3 vWP;',
    'void main(){ vUv=uv; vN=normalize(normalMatrix*normal);',
    '  vec4 wp=modelMatrix*vec4(position,1.0); vWP=wp.xyz;',
    '  gl_Position=projectionMatrix*viewMatrix*wp; }'
  ].join('\n'),
  frag: [
    'precision highp float;',
    'uniform float uTime,uPower,uHue,uHasTex;',
    'uniform vec3 uTint;',
    'uniform sampler2D uTex;',
    'varying vec2 vUv; varying vec3 vN; varying vec3 vWP;',
    NOISE,
    'vec3 ledGrid(vec3 c, vec2 uv){',
    '  vec2 g=fract(uv*vec2(96.0,44.0));',
    '  float dotm=smoothstep(0.12,0.3,min(g.x,g.y))*0.35+0.65;',
    '  return c*dotm; }',
    'void main(){',
    '  float t=uTime; vec2 uv=vUv;',
    '  vec3 col=vec3(0.0);',
    '  /* 内容程序：uMode 通过 uHue 选择 */',
    '  float mode=floor(uHue*10.0+0.5);',
    '  if(mode<0.5){ /* 开机前微光 */ col=vec3(0.02,0.02,0.03)*(0.5+0.5*sin(t*2.0)); }',
    '  else if(mode<1.5){ /* 点亮自下而上 */ float rise=smoothstep(uPower, uPower-0.25, 1.0-uv.y); col=vec3(1.0,0.72,0.35)*rise*(0.6+0.4*sin(uv.y*40.0-t*6.0)); }',
    '  else if(mode<2.5){ /* 音浪柱 */ float bands=26.0; float bi=floor(uv.x*bands); float lv=0.35+0.65*abs(sin(bi*1.7+t*4.0)); float h=uv.y; float on=step(h,lv); vec3 bc=mix(vec3(1.0,0.66,0.25),vec3(1.0,0.15,0.1),bi/bands); col=bc*on*1.6; }',
    '  else if(mode<3.5){ /* 斜向光带 */ float s=sin((uv.x*2.2+uv.y*0.8)*3.14159+t*1.5); col=mix(vec3(0.9,0.2,0.1),vec3(1.0,0.75,0.3),0.5+0.5*s)*pow(max(s,0.0),3.0)*2.2; }',
    '  else if(mode<4.5){ /* 兽瞳 */ vec2 p=(uv-0.5)*vec2(2.2,1.0); float r=length(p); float iris=smoothstep(0.34,0.30,r)-smoothstep(0.31,0.12,r); float slit=smoothstep(0.05,0.035,abs(p.x)); col=mix(vec3(1.0,0.1,0.05),vec3(1.0,0.8,0.4),iris)*max(iris*slit,iris*0.22); float pulse=0.75+0.25*sin(t*3.0); col*=pulse; }',
    '  else if(mode<5.5){ /* 星河 */ float st=hash12(floor(uv*vec2(120.0,56.0))); float tw=step(0.985,st)*(0.5+0.5*sin(t*6.0+st*90.0)); col=vec3(1.0,0.9,0.7)*tw*2.0; float neb=fbm(uv*5.0+vec2(t*0.05,0.0)); col+=vec3(0.25,0.12,0.4)*neb; }',
    '  else { /* 万兽之王 卡面（canvas 纹理） */ col=vec3(0.0); }',
    '  if(uHasTex>0.5){ vec3 tx=texture2D(uTex,uv).rgb; col=mix(col,tx*2.4,tx.r+tx.g+tx.b>0.06?1.0:0.0); }',
    '  col*=uPower>0.02?1.0:0.0;',
    '  col*=uTint*1.7;',
    '  gl_FragColor=vec4(ledGrid(col,vUv),1.0);',
    '} '
  ].join('\n')
},

/* ---------------- 体积光束（instanced 锥） ---------------- */
beam: {
  vert: [
    'attribute float aI;',
    'varying float vI; varying vec2 vUv; varying vec3 vN,vV,vC;',
    'void main(){ vUv=uv; vI=aI; vN=normalize(normalMatrix*normal);',
    '  #ifdef USE_INSTANCING_COLOR',
    '  vC=instanceColor;',
    '  #else',
    '  vC=vec3(1.0);',
    '  #endif',
    '  vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.0); vV=normalize(-mv.xyz);',
    '  gl_Position=projectionMatrix*mv; }'
  ].join('\n'),
  frag: [
    'precision highp float;',
    'uniform float uTime,uFlicker;',
    'varying float vI; varying vec2 vUv; varying vec3 vN,vV,vC;',
    'void main(){',
    '  if(vI<=0.001) discard;',
    '  float edge=abs(dot(normalize(vN),normalize(vV)));',
    '  float soft=pow(1.0-edge,1.6);',
    '  float len=vUv.y;',          // v=1 在灯端（apex）
    '  float a=pow(len,1.35)*soft*vI;',
    '  a*=0.85+0.15*sin(uTime*37.0+vUv.x*20.0)*uFlicker;',
    '  gl_FragColor=vec4(vC*a*2.4, a);',
    '} '
  ].join('\n')
},

/* ---------------- 激光（instanced 细长盒） ---------------- */
laser: {
  vert: [
    'attribute float aI;',
    'varying float vI; varying vec2 vUv; varying vec3 vC;',
    'void main(){ vUv=uv; vI=aI;',
    '  #ifdef USE_INSTANCING_COLOR',
    '  vC=instanceColor;',
    '  #else',
    '  vC=vec3(1.0);',
    '  #endif',
    '  gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0); }'
  ].join('\n'),
  frag: [
    'precision highp float;',
    'varying float vI; varying vec2 vUv; varying vec3 vC;',
    'void main(){ if(vI<=0.001) discard;',
    '  float core=smoothstep(0.0,0.5,vI);',
    '  float end=smoothstep(1.0,0.72,vUv.y)*smoothstep(0.0,0.12,vUv.y);',
    '  float a=core*end;',
    '  gl_FragColor=vec4(vC*a*1.7+vec3(0.5)*a, a);',
    '} '
  ].join('\n')
},

/* ---------------- GPU 粒子池 ---------------- */
/* aType: 0火箭 1烟花星 2火焰 3火花 4彩带 5光雨 6金箔雪 7烟雾CO2 8喷泉水 9孔明灯 */
particle: {
  vert: [
    'attribute vec3 aVel; attribute float aT0,aLife,aSize,aType,aSeed;',
    'attribute vec3 aColor;',
    'uniform float uTime,uScale;',
    'varying vec3 vColor; varying float vFade,vType,vSeed;',
    'void main(){',
    '  float t=uTime-aT0;',
    '  vec3 p=position; float alpha=1.0; float sz=aSize;',
    '  if(t<0.0||t>aLife){ gl_Position=vec4(2.0,2.0,2.0,1.0); gl_PointSize=0.0; vColor=vec3(0.0); vFade=0.0; vType=aType; vSeed=aSeed; return; }',
    '  float k=t/aLife;',
    '  if(aType<0.5){ p+=aVel*t; p.y+= -6.0*t*t*0.5; alpha=1.0-k*0.4; sz*=1.0+k*0.5; }',
    '  else if(aType<1.5){ float dr=exp(-0.55*t); vec3 v=aVel*dr; v.y+= -7.0*t;',
    '    p+=v*t + aVel*0.55*(1.0-dr);', // 阻力近似
    '    alpha=(1.0-k)*(0.55+0.45*sin(aSeed*90.0+t*24.0)); sz*=1.0+k*0.9; }',
    '  else if(aType<2.5){ float dr=1.0/(1.0+t*2.4); vec3 v=aVel*dr;',
    '    p+=v*t; p.x+=sin(aSeed*40.0+t*4.0)*0.4*t; p.z+=cos(aSeed*31.0+t*3.4)*0.4*t;',
    '    p.y+=1.3*t*(1.0-k); alpha=(1.0-k*k)*1.2; sz*=1.0+k*1.6; }',
    '  else if(aType<3.5){ p+=aVel*t; p.y+= -19.0*t*t*0.5; alpha=1.0-k; }',
    '  else if(aType<4.5){ p+=aVel*t; p.y+= -2.2*t*t*0.5; p.x+=sin(t*5.0+aSeed*50.0)*1.6*t; p.z+=cos(t*4.2+aSeed*70.0)*1.2*t; alpha=1.0-k*k; sz*=1.0+k*0.4; }',
    '  else if(aType<5.5){ p+=aVel*t; p.y+= -26.0*t*t*0.5; alpha=(1.0-k)*1.5; }',
    '  else if(aType<6.5){ p+=aVel*t; p.y+= -1.6*t*t*0.5; p.x+=sin(t*1.8+aSeed*30.0)*1.2*t; alpha=(1.0-k)*(0.6+0.4*sin(aSeed*80.0+t*9.0)); }',
    '  else if(aType<7.5){ float gr=1.0+t*0.8; p+=aVel*t; p.x+=sin(aSeed*20.0+t*1.2)*1.5*t; p.z+=cos(aSeed*25.0+t*1.0)*1.5*t; p.y+=0.5*t; alpha=(1.0-k)*0.5; sz*=gr*2.0; }',
    '  else if(aType<8.5){ p+=aVel*t; p.y+= -13.0*t*t*0.5; alpha=(1.0-k)*(0.7+0.3*sin(t*20.0+aSeed*40.0)); }',
    '  else { p+=aVel*t; p.y+=0.9*t*(1.0-k*0.5); p.x+=sin(t*0.7+aSeed*20.0)*2.0*t*0.2; p.z+=cos(t*0.6+aSeed*30.0)*2.0*t*0.2; alpha=min(1.0,k*4.0)*(1.0-pow(k,6.0))*(0.75+0.25*sin(t*7.0+aSeed*10.0)); }',
    '  vec4 mv=modelViewMatrix*vec4(p,1.0);',
    '  gl_PointSize=clamp(sz*uScale/max(-mv.z,0.1),1.0,90.0);',
    '  gl_Position=projectionMatrix*mv;',
    '  vColor=aColor; vFade=alpha; vType=aType; vSeed=aSeed;',
    '} '
  ].join('\n'),
  frag: [
    'precision highp float;',
    'varying vec3 vColor; varying float vFade,vType,vSeed;',
    'void main(){',
    '  vec2 q=gl_PointCoord-0.5; float r=length(q);',
    '  if(r>0.5) discard;',
    '  float a=smoothstep(0.5,0.08,r)*vFade;',
    '  vec3 c=vColor;',
    '  if(vType>1.5&&vType<2.5){ c=mix(c*1.8,c*0.35,smoothstep(0.1,0.5,r)); }', // 火焰中心亮
    '  if(vType>6.5&&vType<7.5){ a*=0.5; }', // 烟雾减半
    '  gl_FragColor=vec4(c*a, a);',
    '} '
  ].join('\n')
},

/* ---------------- 观众荧光棒海 ---------------- */
crowd: {
  vert: [
    'attribute float aSeed,aTier,aAng;',
    'uniform float uTime,uBeat,uIntensity,uCardOn,uPx;',
    'uniform vec3 uColA,uColB;',
    'uniform sampler2D uCard;',
    'varying vec3 vColor; varying float vA;',
    'void main(){',
    '  float bob=abs(sin(uBeat*3.14159+aSeed*6.2831))*0.22*uIntensity;',
    '  vec3 p=position; p.y+=bob;',
    '  /* 光潮波浪：沿看台角度传播 */',
    '  float wave=sin(aAng*6.0-uTime*2.6);',
    '  vec3 c=mix(uColA,uColB,0.5+0.5*wave);',
    '  float br=0.55+0.45*pow(max(wave,0.0),3.0);',
    '  /* 看台字幕：按 (角度,层) 采样卡面 */',
    '  if(uCardOn>0.5){',
    '    vec2 cuv=vec2(fract(aAng/6.28318+0.5), aTier*0.333);',
    '    vec3 cc=texture2D(uCard,cuv).rgb;',
    '    c=mix(c*0.12,cc*2.0,step(0.25,cc.r+cc.g+cc.b));',
    '    br=1.0;',
    '  }',
    '  vec4 mv=modelViewMatrix*vec4(p,1.0);',
    '  gl_PointSize=clamp(uPx*1.0/max(-mv.z,0.1),1.0,7.0);',
    '  gl_Position=projectionMatrix*mv;',
    '  vColor=c*br; vA=0.75+0.25*sin(uTime*10.0+aSeed*40.0);',
    '} '
  ].join('\n'),
  frag: [
    'precision highp float;',
    'varying vec3 vColor; varying float vA;',
    'void main(){ vec2 q=gl_PointCoord-0.5; if(dot(q,q)>0.25) discard;',
    '  gl_FragColor=vec4(vColor*vA,vA); }'
  ].join('\n')
},

/* ---------------- 无人机编队 ---------------- */
drone: {
  vert: [
    'attribute vec3 aHome; attribute float aKind,aSeed;',
    'uniform float uTime,uFormT,uFx,uPx;',
    'uniform vec3 uColor,uOutline;',
    'varying vec3 vColor; varying float vA;',
    'float ease(float x){ return x<0.0?0.0:(x>1.0?1.0:x*x*(3.0-2.0*x)); }',
    'void main(){',
    '  float k=ease(clamp(uFormT*1.35-aSeed*0.35,0.0,1.0));',
    '  vec3 p=mix(aHome,position,k);',
    '  if(uFx>0.5&&uFx<1.5){ p.y+=sin(position.x*0.35+uTime*2.2)*1.6; }',          // wave
    '  float tw=1.0;',
    '  if(uFx>1.5&&uFx<2.5){ tw=step(0.35,fract(aSeed*7.0+uTime*2.0)); }',           // sparkle
    '  else if(uFx>2.5&&uFx<3.5){ vec3 hsb=vec3(0.9,0.6,0.4); }',                     // rainbow 在 frag 里由 kind+time 混
    '  else if(uFx>3.5){ float bl=1.0+2.0*max(0.0,sin(uTime*1.4-position.x*0.08)); tw=min(bl,2.2); }', // bloom
    '  vec4 mv=modelViewMatrix*vec4(p,1.0);',
    '  gl_PointSize=clamp((aKind<0.5?1.6:1.0)*uPx/max(-mv.z,0.1),1.0,10.0);',
    '  gl_Position=projectionMatrix*mv;',
    '  vec3 c=(aKind<0.5)?uOutline*1.6:uColor;',
    '  if(uFx>2.5&&uFx<3.5){ float h=fract(aSeed+uTime*0.12); c=mix(vec3(1.0,0.3,0.2),vec3(0.3,0.5,1.0),h); }',
    '  vColor=c*tw; vA=0.9;',
    '} '
  ].join('\n'),
  frag: [
    'precision highp float;',
    'varying vec3 vColor; varying float vA;',
    'void main(){ vec2 q=abs(gl_PointCoord-0.5); if(max(q.x,q.y)>0.5) discard;',
    '  float r=length(gl_PointCoord-0.5);',
    '  float a=smoothstep(0.5,0.05,r)*vA;',
    '  gl_FragColor=vec4(vColor*a,a); }'
  ].join('\n')
},

/* ---------------- 地面雾霭片 ---------------- */
haze: {
  vert: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  frag: [
    'precision highp float;',
    'uniform float uTime,uDensity; uniform vec3 uColor;',
    'varying vec2 vUv;',
    NOISE,
    'void main(){',
    '  float n=fbm(vUv*3.0+vec2(uTime*0.06,uTime*0.02));',
    '  float r=length((vUv-0.5)*2.0);',
    '  float a=smoothstep(1.0,0.25,r)*n*uDensity*0.32;',
    '  gl_FragColor=vec4(uColor*a,a);',
    '} '
  ].join('\n')
},

/* ---------------- 水面（龙形水系） ---------------- */
water: {
  vert: [
    'varying vec2 vUv; varying vec3 vWP;',
    'void main(){ vUv=uv; vec4 wp=modelMatrix*vec4(position,1.0); vWP=wp.xyz;',
    '  gl_Position=projectionMatrix*viewMatrix*wp; }'
  ].join('\n'),
  frag: [
    'precision highp float;',
    'uniform float uTime,uBeat; uniform vec3 uGlow;',
    'varying vec2 vUv; varying vec3 vWP;',
    NOISE,
    'void main(){',
    '  vec2 p=vWP.xz*0.08;',
    '  float n=fbm(p+vec2(uTime*0.1,uTime*0.06));',
    '  vec3 deep=vec3(0.015,0.03,0.05); vec3 mid=vec3(0.03,0.07,0.10);',
    '  vec3 col=mix(deep,mid,n);',
    '  /* 霓虹倒影拉丝（+X 场馆方向） */',
    '  float g=exp(-max(0.0,(600.0-vWP.x))*0.004);',
    '  float streak=fbm(vec2(vWP.x*0.02,vWP.z*0.15+floor(uTime*2.0)))*g;',
    '  col+=uGlow*streak*1.4;',
    '  /* 喷泉涟漪 */',
    '  float rip=sin(length(vWP.xz-vec2(-160.0,120.0))*0.25-uBeat*3.14159)*0.5+0.5;',
    '  col+=uGlow*0.12*rip*exp(-abs(length(vWP.xz-vec2(-160.0,120.0))-40.0)*0.02);',
    '  /* 波光 */',
    '  float sp=pow(n,7.0)*2.4;',
    '  col+=vec3(0.9,0.95,1.0)*sp*uGlow.r*2.0;',
    '  gl_FragColor=vec4(col,0.94);',
    '} '
  ].join('\n')
},

/* ---------------- 城市建筑（instanced 窗灯） ---------------- */
city: {
  vert: [
    'attribute float aRand;',
    'varying vec2 vUv; varying float vR,vY;',
    'void main(){ vUv=uv; vR=aRand; vY=position.y;',
    '  gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0); }'
  ].join('\n'),
  frag: [
    'precision highp float;',
    'uniform float uTime,uShow; uniform vec3 uShowCol;',
    'varying vec2 vUv; varying float vR,vY;',
    NOISE,
    'void main(){',
    '  vec2 g=vec2(vUv.x*8.0,vUv.y*22.0);',
    '  vec2 cell=floor(g);',
    '  float lit=step(0.72,hash12(cell+vR*97.0));',
    '  float win=step(0.25,fract(g.x))*step(fract(g.x),0.75)*step(0.2,fract(g.y))*step(fract(g.y),0.7);',
    '  vec3 warm=vec3(1.0,0.72,0.38), cool=vec3(0.5,0.7,1.0);',
    '  vec3 c=mix(warm,cool,step(0.5,hash11(vR*31.0)))*lit*win*0.9;',
    '  vec3 base=vec3(0.012,0.013,0.02)+vec3(0.02,0.02,0.03)*vR;',
    '  float pulse=1.0;',
    '  if(uShow>0.5){',
    '    float band=sin(vUv.x*6.0+uTime*3.0)*0.5+0.5;',
    '    c=mix(c,uShowCol*2.0,band*lit); pulse=1.0+band*1.5;',
    '  }',
    '  gl_FragColor=vec4((base+c)*pulse,1.0);',
    '} '
  ].join('\n')
},

/* ---------------- 极光穹顶 ---------------- */
aurora: {
  vert: 'varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  frag: [
    'precision highp float;',
    'uniform float uTime,uIntensity;',
    'varying vec3 vDir;',
    NOISE,
    'void main(){',
    '  float h=clamp(vDir.y,0.0,1.0);',
    '  if(h<0.02) { gl_FragColor=vec4(0.0); return; }',
    '  vec2 p=vec2(atan(vDir.z,vDir.x)*2.0,vDir.y*3.0);',
    '  float band=fbm(vec2(p.x*1.5+uTime*0.05,p.y-uTime*0.02));',
    '  float curt=fbm(vec2(p.x*4.0-uTime*0.12,p.y*0.5));',
    '  float a=pow(band*curt,2.2)*smoothstep(0.02,0.3,h)*smoothstep(1.0,0.45,h);',
    '  vec3 col=mix(vec3(0.1,0.9,0.55),vec3(0.55,0.25,0.95),h*1.4-0.2);',
    '  col=mix(col,vec3(0.2,0.75,0.9),curt*0.4);',
    '  gl_FragColor=vec4(col*a*uIntensity*1.6,a*uIntensity);',
    '} '
  ].join('\n')
},

/* ---------------- 星空 ---------------- */
stars: {
  vert: [
    'attribute float aSize,aTw;',
    'uniform float uTime;',
    'varying float vA;',
    'void main(){ vA=0.4+0.6*sin(uTime*(0.5+aTw)+aTw*40.0);',
    '  vec4 mv=modelViewMatrix*vec4(position,1.0);',
    '  gl_PointSize=aSize; gl_Position=projectionMatrix*mv; }'
  ].join('\n'),
  frag: [
    'precision highp float; varying float vA;',
    'void main(){ vec2 q=gl_PointCoord-0.5; if(dot(q,q)>0.25) discard;',
    '  gl_FragColor=vec4(vec3(0.9,0.93,1.0)*vA,vA*0.8); }'
  ].join('\n')
},

/* ---------------- 星河（螺旋星系） ---------------- */
galaxy: {
  vert: [
    'attribute float aSeed; attribute vec3 aColor;',
    'uniform float uTime,uOpacity;',
    'varying vec3 vC; varying float vA;',
    'void main(){',
    '  vec3 p=position;',
    '  float ang=uTime*0.06+aSeed*0.5;',
    '  float c=cos(ang*0.4),s=sin(ang*0.4);',
    '  p.xz=mat2(c,-s,s,c)*p.xz;',
    '  p.y+=sin(uTime*0.5+aSeed*20.0)*0.8;',
    '  vec4 mv=modelViewMatrix*vec4(p,1.0);',
    '  gl_PointSize=clamp(2.2*aSeed+1.0,1.0,6.0);',
    '  gl_Position=projectionMatrix*mv;',
    '  vC=aColor; vA=uOpacity*(0.6+0.4*sin(uTime*3.0+aSeed*50.0));',
    '} '
  ].join('\n'),
  frag: [
    'precision highp float; varying vec3 vC; varying float vA;',
    'void main(){ vec2 q=gl_PointCoord-0.5; if(dot(q,q)>0.25) discard;',
    '  gl_FragColor=vec4(vC*vA,vA); }'
  ].join('\n')
},

/* ---------------- 全息巨兽 ---------------- */
hologram: {
  vert: [
    'varying vec3 vN,vV; varying vec3 vWP;',
    'void main(){ vN=normalize(normalMatrix*normal);',
    '  vec4 mv=modelViewMatrix*vec4(position,1.0); vV=normalize(-mv.xyz); vWP=position;',
    '  gl_Position=projectionMatrix*mv; }'
  ].join('\n'),
  frag: [
    'precision highp float;',
    'uniform float uTime,uOpacity; uniform vec3 uColor;',
    'varying vec3 vN,vV,vWP;',
    'void main(){',
    '  float fr=pow(1.0-abs(dot(normalize(vN),normalize(vV))),2.0);',
    '  float scan=0.5+0.5*sin(vWP.y*8.0-uTime*6.0);',
    '  float flick=0.85+0.15*sin(uTime*40.0);',
    '  float a=(fr*0.9+0.18)*uOpacity*scan*flick;',
    '  vec3 c=uColor*(fr*2.2+0.35)+vec3(1.0)*fr;',
    '  gl_FragColor=vec4(c*a,a);',
    '} '
  ].join('\n')
},

/* ---------------- 冲击波光环 ---------------- */
ring: {
  vert: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  frag: [
    'precision highp float;',
    'uniform float uProg; uniform vec3 uColor;',
    'varying vec2 vUv;',
    'void main(){',
    '  float r=length((vUv-0.5)*2.0);',
    '  float w=0.06+0.1*uProg;',
    '  float ring=smoothstep(w,0.0,abs(r-(0.3+0.68*uProg)))*(1.0-uProg*0.85);',
    '  gl_FragColor=vec4(uColor*ring*2.5,ring);',
    '} '
  ].join('\n')
},

/* ---------------- 灯牌/跑马灯（canvas 纹理 + 动态） ---------------- */
sign: {
  vert: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  frag: [
    'precision highp float;',
    'uniform sampler2D uMap; uniform float uTime,uAnim; uniform vec3 uTint;',
    'varying vec2 vUv;',
    'void main(){',
    '  vec3 c=texture2D(uMap,vUv).rgb;',
    '  float m=max(c.r,max(c.g,c.b));',
    '  if(uAnim>0.5&&uAnim<1.5){ float chase=0.5+0.5*sin((vUv.x+vUv.y)*24.0-uTime*7.0); c*=0.35+chase*1.3; }',
    '  else if(uAnim>1.5&&uAnim<2.5){ c*=0.55+0.45*sin(uTime*3.0); }',
    '  else if(uAnim>2.5){ vec3 hue=mix(vec3(1.0,0.2,0.2),vec3(0.2,0.4,1.0),0.5+0.5*sin(uTime*2.0+vUv.x*4.0)); c=mix(c,hue*1.4,0.55); }',
    '  gl_FragColor=vec4(c*uTint*1.8+m*0.4,1.0);',
    '} '
  ].join('\n')
},

/* ---------------- 舞台地面自定义灯光循环（24 灯 uniform 数组） ---------------- */
floorfx: {
  vert: [
    'varying vec2 vUv; varying vec3 vWP;',
    'void main(){ vUv=uv; vec4 wp=modelMatrix*vec4(position,1.0); vWP=wp.xyz;',
    '  gl_Position=projectionMatrix*viewMatrix*wp; }'
  ].join('\n'),
  frag: [
    'precision highp float;',
    'uniform vec3 uLPos[24]; uniform vec3 uLCol[24];',
    'uniform float uTime,uBeat,uPower;',
    'varying vec2 vUv; varying vec3 vWP;',
    NOISE,
    'void main(){',
    '  vec3 acc=vec3(0.0);',
    '  for(int i=0;i<24;i++){',
    '    vec3 d=uLPos[i]-vWP; float dist=length(d);',
    '    float att=1.0/(1.0+dist*dist*0.012);',
    '    acc+=uLCol[i]*att;',
    '  }',
    '  vec3 base=vec3(0.02,0.02,0.028);',
    '  /* 击打脉冲网格 */',
    '  float grid=max(smoothstep(0.96,1.0,max(abs(sin(vWP.x*0.35)),abs(sin(vWP.z*0.35)))),0.0);',
    '  float pulse=pow(max(0.0,sin(uBeat*3.14159)),4.0);',
    '  vec3 col=base+acc*1.1+vec3(0.35,0.22,0.1)*grid*pulse*uPower*0.9;',
    '  col+=fbm(vWP.xz*0.05+uTime*0.03)*0.02;',
    '  gl_FragColor=vec4(col,1.0);',
    '} '
  ].join('\n')
},

/* ---------------- 广场地面投影（莲花/曼陀罗） ---------------- */
decal: {
  vert: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  frag: [
    'precision highp float;',
    'uniform float uTime,uOn; uniform vec3 uColor;',
    'varying vec2 vUv;',
    NOISE,
    'void main(){',
    '  vec2 p=(vUv-0.5)*2.0; float r=length(p); float a=atan(p.y,p.x);',
    '  float petals=abs(sin(a*6.0+uTime*0.4));',
    '  float ring1=smoothstep(0.04,0.0,abs(r-0.62));',
    '  float ring2=smoothstep(0.05,0.0,abs(r-0.38))*petals;',
    '  float core=smoothstep(0.16,0.05,r);',
    '  float ripple=sin(r*30.0-uTime*3.0)*0.5+0.5;',
    '  float g=(ring1+ring2*0.9+core)*uOn*(0.55+0.45*ripple);',
    '  g*=smoothstep(1.0,0.72,r);',
    '  gl_FragColor=vec4(uColor*g*1.6,g*0.85);',
    '} '
  ].join('\n')
},

/* ---------------- 后处理 ---------------- */
post: {
  bright: [
    'precision highp float; uniform sampler2D tMap; uniform float uThresh; varying vec2 vUv;',
    'void main(){ vec3 c=texture2D(tMap,vUv).rgb;',
    '  float l=dot(c,vec3(0.299,0.587,0.114));',
    '  float k=max(0.0,l-uThresh)/max(l,0.0001);',
    '  gl_FragColor=vec4(c*k,1.0); }'
  ].join('\n'),
  blur: [
    'precision highp float; uniform sampler2D tMap; uniform vec2 uDir; varying vec2 vUv;',
    'void main(){ vec3 s=texture2D(tMap,vUv).rgb*0.227;',
    '  vec2 o1=uDir*1.384,o2=uDir*3.230;',
    '  s+=(texture2D(tMap,vUv+o1).rgb+texture2D(tMap,vUv-o1).rgb)*0.316;',
    '  s+=(texture2D(tMap,vUv+o2).rgb+texture2D(tMap,vUv-o2).rgb)*0.070;',
    '  gl_FragColor=vec4(s,1.0); }'
  ].join('\n'),
  up: [
    'precision highp float; uniform sampler2D tLow,tHigh; uniform float uMix; varying vec2 vUv;',
    'void main(){ vec3 l=texture2D(tLow,vUv).rgb,h=texture2D(tHigh,vUv).rgb;',
    '  gl_FragColor=vec4(mix(l,h,uMix),1.0); }'
  ].join('\n'),
  streak: [
    'precision highp float; uniform sampler2D tMap; uniform vec2 uDir; uniform float uKeep; varying vec2 vUv;',
    'void main(){ vec3 s=vec3(0.0); float w=0.0;',
    '  for(int i=-6;i<=6;i++){ float k=exp(-float(i*i)*0.06);',
    '    s+=texture2D(tMap,vUv+uDir*float(i)*0.012).rgb*k; w+=k; }',
    '  gl_FragColor=vec4(s/w*uKeep,1.0); }'
  ].join('\n'),
  dof: [
    'precision highp float;',
    'uniform sampler2D tMap,tDepth; uniform float uFocus,uRange,uNear,uFar,uTaps; varying vec2 vUv;',
    'float lin(float d){ float z=d*2.0-1.0;',
    '  return (2.0*uNear*uFar)/(uFar+uNear-z*(uFar-uNear)); }',
    'void main(){',
    '  float d=lin(texture2D(tDepth,vUv).r);',
    '  float coc=clamp(abs(d-uFocus)/uRange,0.0,1.0);',
    '  vec3 s=texture2D(tMap,vUv).rgb; float wsum=1.0;',
    '  float golden=2.39996;',
    '  for(int i=1;i<=28;i++){',
    '    if(float(i)>uTaps) break;',
    '    float fi=float(i); float r=sqrt(fi/28.0)*coc*0.035;',
    '    float an=fi*golden;',
    '    vec2 off=vec2(cos(an),sin(an))*r;',
    '    s+=texture2D(tMap,vUv+off).rgb; wsum+=1.0;',
    '  }',
    '  gl_FragColor=vec4(s/wsum,1.0); }'
  ].join('\n'),
  mblur: [
    'precision highp float;',
    'uniform sampler2D tMap,tDepth; uniform mat4 uInvVP,uPrevVP; uniform float uAmt,uNear,uFar; varying vec2 vUv;',
    'float lin(float d){ float z=d*2.0-1.0;',
    '  return (2.0*uNear*uFar)/(uFar+uNear-z*(uFar-uNear)); }',
    'vec3 wpos(vec2 uv,float d){',
    '  float z=d*2.0-1.0; vec4 cp=vec4(uv*2.0-1.0,z,1.0);',
    '  vec4 wp=uInvVP*cp; return wp.xyz/wp.w; }',
    'void main(){',
    '  float d=texture2D(tDepth,vUv).r;',
    '  vec3 wp=wpos(vUv,d);',
    '  vec4 pp=uPrevVP*vec4(wp,1.0); vec2 puv=pp.xy/pp.w*0.5+0.5;',
    '  vec2 vel=(vUv-puv)*uAmt;',
    '  vec3 s=texture2D(tMap,vUv).rgb;',
    '  for(int i=1;i<=6;i++){ float k=float(i)/6.5;',
    '    s+=texture2D(tMap,vUv+vel*k).rgb; s+=texture2D(tMap,vUv-vel*k).rgb; }',
    '  gl_FragColor=vec4(s/13.0,1.0); }'
  ].join('\n'),
  composite: [
    'precision highp float;',
    'uniform sampler2D tScene,tBloom,tStreak; uniform float uEv,uGrain,uTime,uVig,uHazeTint;',
    'varying vec2 vUv;',
    NOISE,
    'vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }',
    'void main(){',
    '  vec2 uv=vUv;',
    '  /* 轻度色边 */',
    '  float ca=0.0016*uVig;',
    '  vec3 c;',
    '  c.r=texture2D(tScene,uv+vec2(ca,0.0)).r;',
    '  c.g=texture2D(tScene,uv).g;',
    '  c.b=texture2D(tScene,uv-vec2(ca,0.0)).b;',
    '  c+=texture2D(tBloom,uv).rgb*1.25;',
    '  c+=texture2D(tStreak,uv).rgb*0.55;',
    '  c*=exp2(uEv);',
    '  c=aces(c);',
    '  c=pow(c,vec3(0.4545454545));',
    '  /* 颗粒 */',
    '  float g=(hash12(uv*vec2(1920.0,1080.0)+fract(uTime)*7.13)-0.5)*uGrain*0.045;',
    '  c+=g;',
    '  /* 暗角与暖色抬升 */',
    '  float r=length((uv-0.5)*vec2(1.15,1.0));',
    '  c*=1.0-smoothstep(0.55,1.05,r)*0.42*uVig;',
    '  c=mix(c,c*vec3(1.04,1.0,0.95)+vec3(0.008,0.006,0.004),uHazeTint);',
    '  gl_FragColor=vec4(c,1.0); }'
  ].join('\n'),
  quad: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }'
}
};
})();
