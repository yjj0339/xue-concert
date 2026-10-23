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
- [x] tools/build_stadium.py（Mimosa 拦变量路径写文件→报告改走 stdout）
- [ ] Blender model.glb + js/model-data.js（base64 内嵌）
- [ ] 各 JS 模块
- [ ] 冒烟测试 / 部署 yjj0339.github.io/xue-concert
