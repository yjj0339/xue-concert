# DEVLOG · 万兽之王 · 鸟巢（xue-Concert）

> 交接必读。项目 = 薛之谦「万兽之王」鸟巢演唱会实时 3D 灯光秀（three.js r160，零构建纯静态）。

## 约定（全模块共用）

- 坐标：演出/特效数据一律 **Blender 坐标**（米，Z 向上，+X 指向主舞台），JS 里用 `B(x,y,z) → three(x, z, -y)` 转换。GLB 导出已按 glTF Y-up 转换，与该公式一致。
- 场馆几何常量（tools/build_stadium.py 与 JS 同步）：屋顶外缘椭圆 a=162/b=136，h_out(θ)=55+11cos2θ；中央开口 a=98/b=72，h_in=40+6cos2θ；落地外圈 176/148；三层看台 104..162；场地椭圆 100×74；主舞台 x∈[50,88]，LED 墙 x≈91 曲面 y∈±38 z1.4..40；兽塔 EAGLE(10,-34) LION(10,34) ELEPHANT(42,-34) WHALE(42,34) 高 26；桁架 A/B/C 在 x=58/70/82 峰高 21/27/33。
- 模型契约名：HULL_LATTICE / ROOF_RIM / STAND_LOWER|MIDDLE|UPPER / FIELD / STAGE_DECK / STAGE_RUNWAY / LED_WALL / TOWER_* / TRUSSES / PLAZA_*。几何冻结，只改材质/uniform。
- 脚本顺序（经典 script）：kob-params → kob-glsl → kob-show → kob-fx → kob-sfx → kob-world → kob-post → kob-ui → kob-deck → audio → kob-main(id=kob-main)。所有模块把 `init(ctx)` 挂 `KOB.onReady`，由 kob-main 在 three 加载后统一调。
- `KOB.BUILD` 全局构建号；每文件 `KOB.report(name)`；kob-main 校验不一致→带时间戳重载一次。
- 演出：135 s / 128 BPM（beat=0.46875 s，bar=1.875 s），10 章节见 kob-show。
- 测试：`node tools/server.js`（端口 8137）+ `node tools/shot.js`（playwright + Chrome）。静默截图，绝不打扰用户。

## 进度

- [x] 2026-10-23 环境确认（Blender 5.2 / node24 / gh=yjj0339 / playwright@xiaoren-bike）
- [x] 2026-10-23 tools/build_stadium.py（Mimosa 拦变量路径写文件→报告改走 stdout）
- [x] 2026-10-23 Blender model.glb(255KB, Draco) + js/model-data.js(base64 内嵌)
- [x] 2026-10-23 全部 11 个 JS 模块 + index.html + show.css；Playwright 冒烟修完（updateRange→addUpdateRange / LED墙补UV / seek状态重建 / 全局提亮）
- [x] 2026-10-24 部署 yjj0339.github.io/xue-concert（200+MIME 全对；线上全流程过门测试）
- [x] 2026-10-24 v1.1 全面升级：**浅色主题默认**（?theme=dark 可切，顶栏按钮+localStorage）、**原生中文**（去 Google Fonts，本地字体栈）、GPU 识别加 Arc/Apple M、画质预算上调（high 2.2MP/4xMSAA、ultra 4.0MP）、稳定性（模块初始化隔离 try/catch、webglcontextlost 保护、自适应 6s 预热）
- [x] 2026-10-24 修关键 bug：clampNum 把未指定 scale 钳到 0.25 → 全局 1/4 分辨率渲染（renderAt 35KB→351KB 证实）
- [x] 2026-10-24 导航主页卡片 + 二维码上线

## 大坑记录（新人必读）

1. **clampNum(null, def, min, max) 会把 null 钳到 min**——参数默认值为 null 的数值参数全部中招，scale=0.25 全局降分辨率。数值参数解析必须先 isFinite 判断。
2. **手搓 bmesh 没写 UV → glTF 无 TEXCOORD → ShaderMaterial uv 恒 (0,0)**，LED 墙全屏暗色单色。自定义 bmesh 网格凡是要贴图的必须 `bm.loops.layers.uv.new()` + 逐 loop 赋值。
3. three r160 `BufferAttribute.updateRange` 只读，要用 `clearUpdateRanges()+addUpdateRange(off,len)`。
4. three r160 动态 import(importmap) 的 `base` 变量不能跨两个 .then 闭包，要包一层对象传递。
5. Mimosa 拦截：`pool.spawn()` 误判 child_process.spawn（改 emit）；Blender 脚本变量路径写文件（改字面量+stdout 报告）；Bash 直写源码（走 Write/工具脚本）。
6. `bm.verts[i]` 索引前必须 ensure_lookup_table 或直接持有引用。
7. seek 语义：一次性 cue（烟花/CO2）不重放，但持续性灯光状态（LED/光束/火龙卷/镜球/星河…）必须按时间区间重建（fx.seekTo），否则截图/跳章全黑。
8. 测试时 CDN 强制 npmmirror 稳定；线上默认探测 jsdelivr→unpkg→npmmirror。
