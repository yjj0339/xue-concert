// 手机宽度截图（验证移动端布局 + 自动低画质）
const path = require('path');
const { chromium } = require('E:/ZCODE/xiaoren-bike/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader', '--mute-audio'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 150)));
  await page.goto('https://yjj0339.github.io/xue-concert/?gate=0&cdn=npmmirror', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__viewer && window.__viewer.state.started, null, { timeout: 60000 });
  await page.evaluate(() => { window.__viewer.seek(47); });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'mobile-390.png') });
  const q = await page.evaluate(() => ({ quality: window.__viewer.quality, stats: window.__viewer.stats() }));
  console.log('MOBILE ' + JSON.stringify(q) + ' ERRS ' + errs.join('|'));
  await browser.close();
})();
