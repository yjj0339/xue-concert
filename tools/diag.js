// 诊断：检查 LED 墙材质/ledPower/相机/refs
const path = require('path');
const { chromium } = require('E:/ZCODE/xiaoren-bike/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader', '--mute-audio'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await page.goto('http://127.0.0.1:8137/index.html?gate=0&cdn=npmmirror', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__viewer && window.__viewer.state.started, null, { timeout: 60000 });
  const info = await page.evaluate(() => {
    const ctx = window.__KOB_CTX;
    const led = ctx.refs.LED_WALL;
    const r = {
      ledExists: !!led,
      ledMat: led ? (led.material.type + '/' + (led.material.uniforms ? Object.keys(led.material.uniforms).join(',') : led.material.name)) : 'none',
      ledPower: ctx.fx.state.ledPower,
      moodLed: ctx.fx.state.mood.led,
      refsKeys: Object.keys(ctx.refs),
      stands: ctx.stands.length,
      cam: { p: ctx.camera.position.toArray().map(v => Math.round(v)), mode: __viewer.state.mode }
    };
    __viewer.seek(36);
    r.ledPowerAfter = ctx.fx.state.ledPower;
    r.state = __viewer.state;
    return r;
  });
  console.log(JSON.stringify(info, null, 1));
  console.log('ERRS', errs.join(' | '));
  await browser.close();
})();
