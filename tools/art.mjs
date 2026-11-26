// Draw og.png and the app icons from the game's own drawing code: node tools/art.mjs (with the dev server on 8691)
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, colorScheme: 'light' });
await p.goto('http://127.0.0.1:8691/#settings');
const png = await p.evaluate(async () => {
  const { palette, bandPath, strokeRubber, drawPin, drawPeg, drawRuler, tag, DISPLAY } = await import('/js/draw.js');
  const { ticks } = await import('/js/format.js');
  const { NAME } = await import('/js/config.js');
  await document.fonts.load('700 80px Anybody'); await document.fonts.load('500 40px "Familjen Grotesk"');
  const pal = palette();
  const c = document.createElement('canvas'); c.width = 1200; c.height = 630;
  const x = c.getContext('2d');
  x.fillStyle = pal.paper; x.fillRect(0, 0, 1200, 630);
  for (let i = 0; i <= 1200; i += 30) { x.globalAlpha = i % 150 === 0 ? 0.5 : 0.2; x.strokeStyle = pal.line; x.lineWidth = 1.2; x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 630); if (i <= 630) { x.moveTo(0, i); x.lineTo(1200, i); } x.stroke(); }
  x.globalAlpha = 1;
  x.fillStyle = pal.ink; x.font = `760 120px ${DISPLAY}`; x.fillText(NAME, 64, 160);
  x.fillStyle = pal.mute; x.font = '500 38px "Familjen Grotesk", sans-serif';
  x.fillText('Seven number questions a day.', 66, 222);
  x.fillText('Stretch a range you are 90% sure of.', 66, 270);
  const top = 500;
  drawRuler(x, pal, { w: 1200, top, h: 110, pad: 60, marks: ticks({ min: 2000, max: 2e7, scale: 'log' }, {}, 1080) });
  x.fillStyle = pal.band; x.globalAlpha = 0.18; x.fillRect(420, top, 420, 110); x.globalAlpha = 1;
  for (const px of [420, 840]) drawPeg(x, { x: px, y: top + 8, len: 190, w: 40, h: 60, pal });
  bandPath(x, { xl: 420, xr: 840, yl: top - 138, yr: top - 138, sag: 44, r: 12, modes: [0, 0, 0], back: [0, 0, 0] });
  strokeRubber(x, pal, 10);
  drawPin(x, { x: 590, y: top + 10, len: 120, r: 22, color: pal.pin, dark: pal.pinDark, lite: '#fff', needle: pal.ink });
  return c.toDataURL('image/png');
});
const { writeFileSync } = await import('node:fs');
writeFileSync(new URL('../og.png', import.meta.url), Buffer.from(png.split(',')[1], 'base64'));
const svg = readFileSync(new URL('../icon.svg', import.meta.url), 'utf8');
for (const s of [180, 512]) {
  const q = await b.newPage({ viewport: { width: s, height: s } });
  await q.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</body>`);
  await q.screenshot({ path: new URL(`../icon-${s}.png`, import.meta.url).pathname, omitBackground: true });
}
await b.close();
