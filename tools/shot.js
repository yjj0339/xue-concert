// Playwright + Chrome 冒烟测试：多时刻截图 + 错误捕获 + 接口断言
// 用法: node tools/shot.js [urlSuffix] [tag]
const path = require('path');
const fs = require('fs');
const { chromium } = require('E:/ZCODE/xiaoren-bike/node_modules/playwright-core');

const BASE = 'http://127.0.0.1:8137/';
const TAG = process.argv[3] || 'run';
const SUFFIX = process.argv[2] || '?gate=0&stats=1&cdn=npmmirror';
const SHOTS = path.join(__dirname, '..', 'shots');

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox', '--window-size=1600,760', '--mute-audio']
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 760 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 400)); });
  page.on('pageerror', e => errors.push('[pageerror] ' + String(e && e.message || e).slice(0, 400)));
  page.on('response', r => { if (r.status() >= 400) errors.push('[http' + r.status() + '] ' + r.url().slice(0, 160)); });

  await page.goto(BASE + 'index.html' + SUFFIX, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try {
    await page.waitForFunction(() => window.__viewer && window.__viewer.state && window.__viewer.state.started, null, { timeout: 60000 });
  } catch (e) {
    await page.screenshot({ path: path.join(SHOTS, TAG + '-boot-fail.png') });
    const msg = await page.evaluate(() => ({
      boot: (document.getElementById('kob-boot-msg') || {}).textContent || 'n/a'
    }));
    console.log('BOOT_FAIL ' + JSON.stringify(msg));
    console.log('ERRORS:\n' + errors.join('\n'));
    await browser.close();
    process.exit(2);
  }

  const times = [3, 16, 26, 36, 47, 58, 75, 87, 100, 110, 125];
  for (const t of times) {
    await page.evaluate(t => { window.__viewer.seek(t); }, t);
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(SHOTS, TAG + '-t' + String(t).padStart(3, '0') + '.png') });
  }
  await page.evaluate(() => { window.__viewer.setMode('free'); window.__viewer.flyTo(6, true); });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(SHOTS, TAG + '-free-v6.png') });
  await page.evaluate(() => { window.__viewer.flyTo(13, true); });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(SHOTS, TAG + '-free-v13.png') });

  const checks = await page.evaluate(() => {
    const r = {};
    try {
      r.state = window.__viewer.state;
      r.quality = window.__viewer.quality;
      r.views = window.__viewer.VIEWS.length;
      r.bench = window.__viewer.bench(50, 20);
      const jpeg = window.__viewer.renderAt(100);
      r.jpegLen = jpeg ? jpeg.length : 0;
      r.jpegHead = jpeg ? jpeg.slice(0, 22) : '';
    } catch (e) { r.err = String(e && e.message || e); }
    return r;
  });
  console.log('CHECKS ' + JSON.stringify(checks));
  console.log('ERRORS(' + errors.length + '):\n' + errors.slice(0, 30).join('\n'));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
