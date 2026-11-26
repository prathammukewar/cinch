// Draw og.png and the app icons from the game's own drawing code: node tools/art.mjs (with the dev server on 8691)
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, colorScheme: 'light' });
await p.goto('http://127.0.0.1:8691/#settings');
const png = await p.evaluate(async () => {
  const { palette, bandPath, strokeRubber, drawPin, drawPeg, drawRuler, tag, pointsBand, DISPLAY } = await import('/js/draw.js');
  const { ticks } = await import('/js/format.js');
  const { NAME } = await import('/js/config.js');
  await document.fonts.load('700 80px Anybody'); await document.fonts.load('500 40px "Familjen Grotesk"');
  const pal = palette();
  const c = document.createElement('canvas'); c.width = 1200; c.height = 630;
  const x = c.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, 630); sky.addColorStop(0, getComputedStyle(document.documentElement).getPropertyValue('--sky-1')); sky.addColorStop(1, pal.paper);
  x.fillStyle = sky; x.fillRect(0, 0, 1200, 630);
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  x.fillStyle = css('--sun'); x.beginPath(); x.arc(1010, 150, 70, 0, Math.PI * 2); x.fill();
  x.fillStyle = css('--far'); x.beginPath(); x.moveTo(0, 430); x.lineTo(160, 400); x.lineTo(200, 330); x.lineTo(420, 326); x.lineTo(460, 392); x.lineTo(700, 380); x.lineTo(760, 300); x.lineTo(900, 296); x.lineTo(950, 372); x.lineTo(1200, 360); x.lineTo(1200, 630); x.lineTo(0, 630); x.fill();
  x.fillStyle = css('--mid'); x.beginPath(); x.moveTo(0, 470); x.lineTo(300, 452); x.lineTo(340, 420); x.lineTo(520, 418); x.lineTo(560, 460); x.lineTo(1200, 450); x.lineTo(1200, 630); x.lineTo(0, 630); x.fill();
  x.font = `780 128px ${DISPLAY}`; x.fillStyle = pal.band; x.fillText(NAME, 70, 166); x.fillStyle = pal.ink; x.fillText(NAME, 64, 160);
  x.fillStyle = pal.mute; x.font = '500 38px "Familjen Grotesk", sans-serif';
  x.fillText('Seven numbers a day.', 66, 222);
  x.fillText('Throw a loop you are 90% sure will rope each one.', 66, 270);
  const top = 500;
  drawRuler(x, pal, { w: 1200, top, h: 110, pad: 60, marks: ticks({ min: 2000, max: 2e7, scale: 'log' }, {}, 1080) });
  x.fillStyle = pal.band; x.globalAlpha = 0.18; x.fillRect(420, top, 420, 110); x.globalAlpha = 1;
  pointsBand(x, pal, 420, 840, top + 1, 109, 0.4);
  for (const px of [420, 840]) drawPeg(x, { x: px, y: top + 8, len: 190, w: 40, h: 60, pal });
  bandPath(x, { xl: 420, xr: 840, yl: top - 138, yr: top - 138, sag: 44, r: 12, modes: [0, 0, 0], back: [0, 0, 0] });
  strokeRubber(x, pal, 10);
  drawPin(x, { x: 590, y: top + 1, r: 22, color: pal.pin, dark: pal.pinDark, lite: '#fff' });
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
