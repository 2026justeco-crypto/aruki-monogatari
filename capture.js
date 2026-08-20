// 動きを見せるための連続撮影。CSSアニメーションの時刻を自分で進めてコマを撮る。
// 使い方: node capture.js <URL> <出力フォルダ> <秒数> <fps>
const { chromium } = require('C:/Users/ssuga/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const url = process.argv[2];
  const outDir = process.argv[3];
  const seconds = Number(process.argv[4] || 6);
  const fps = Number(process.argv[5] || 24);

  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1200); // 画像の読み込み待ち

  // すべてのアニメーションを止めて、時刻をこちらで進める
  await page.evaluate(() => {
    document.getAnimations().forEach(a => { a.pause(); });
  });

  const total = Math.round(seconds * fps);
  const step = 1000 / fps;

  for (let i = 0; i < total; i++) {
    await page.evaluate((t) => {
      document.getAnimations().forEach(a => { a.currentTime = t; });
    }, i * step);
    await page.screenshot({ path: path.join(outDir, String(i).padStart(4, '0') + '.png') });
  }

  await browser.close();
  console.log('撮影完了: ' + total + '枚');
})();
