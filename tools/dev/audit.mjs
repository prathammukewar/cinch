// Layout audit: node tools/dev/audit.mjs [screen,screen]. Needs the dev server on 8691.
// Loads each screen at six sizes, saves screenshots to test-results/audit and lists sideways scroll,
// things off the edge, small tap targets, small text, long lines and play screens that scroll.
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
const OUT = new URL('../../test-results/audit/', import.meta.url).pathname;
const BASE = 'http://localhost:8691/';
const SIZES = [[320, 568], [390, 844], [844, 390], [768, 1024], [1280, 800], [1920, 1080]];
const only = process.argv[2] ? process.argv[2].split(',') : null;
const wait = (p, ms) => p.waitForTimeout(ms);
async function play(p) {
  for (let i = 0; i < 7; i++) {
    await p.locator('.thumb').first().focus();
    for (let k = 0; k < 3; k++) await p.keyboard.press('PageUp');
    await p.locator('.thumb').nth(1).focus();
    for (let k = 0; k < 3; k++) await p.keyboard.press('PageDown');
    await p.click('#drop'); await wait(p, 80); await p.keyboard.press('Enter');
    await p.locator('.panel.done').waitFor(); await wait(p, 300);
    await p.click('#next'); await wait(p, 500);
  }
}
const SCREENS = {
  home: async (p) => { await p.goto(BASE + '#home'); await wait(p, 1800); },
  play: async (p) => { await p.goto(BASE + '#practice'); await wait(p, 1200); },
  reveal: async (p) => { await p.goto(BASE + '#practice'); await wait(p, 1000); await p.locator('.thumb').first().focus(); for (let k = 0; k < 3; k++) await p.keyboard.press('PageUp'); await p.click('#drop'); await wait(p, 80); await p.keyboard.press('Enter'); await p.locator('.panel.done').waitFor(); await wait(p, 1500); },
  result: async (p) => { await p.goto(BASE + '#today'); await wait(p, 1000); await play(p); await wait(p, 2500); },
  duel: async (p) => { await p.goto(BASE + '#duel'); await wait(p, 900); },
  live: async (p) => { await p.goto(BASE + '#duel/side'); await wait(p, 900); },
  scoring: async (p) => { await p.goto(BASE + '#scoring'); await wait(p, 900); },
  archive: async (p) => { await p.goto(BASE + '#archive'); await wait(p, 900); },
  calibration: async (p) => { await p.goto(BASE + '#calibration'); await wait(p, 900); },
  settings: async (p) => { await p.goto(BASE + '#settings'); await wait(p, 900); },
  draw: async (p) => { await p.goto(BASE + '#draw'); await wait(p, 900); },
};
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const report = [];
for (const [name, go] of Object.entries(SCREENS)) {
  if (only && !only.includes(name)) continue;
  for (const [w, h] of SIZES) {
    const touch = w <= 844 && Math.min(w, h) < 500 || w <= 430;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: w < 768 });
    await ctx.addInitScript(() => { localStorage.setItem('cinch-api', 'off'); });
    await ctx.clock?.install?.({ time: new Date('2026-11-26T10:00:00') });
    const p = await ctx.newPage();
    try { await go(p); } catch (e) { report.push(`${name} ${w}x${h}: SETUP FAILED ${e.message.split('\n')[0]}`); await ctx.close(); continue; }
    const r = await p.evaluate(({ touch, play }) => {
      const issues = [];
      const W = innerWidth, H = innerHeight;
      const de = document.documentElement;
      if (de.scrollWidth > W + 1) issues.push(`sideways scroll ${de.scrollWidth - W}px`);
      if (play && de.scrollHeight > H + 1 && H >= 600) issues.push(`play screen scrolls ${de.scrollHeight - H}px`);
      const vis = (el) => { const s = getComputedStyle(el); const b = el.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 && b.width > 0 && b.height > 0 && !el.closest('[hidden],.land,svg'); };
      for (const el of document.querySelectorAll('main *, header *')) {
        if (!vis(el)) continue;
        const b = el.getBoundingClientRect();
        if ((b.right > W + 1 || b.left < -1) && !el.closest('.lineup canvas')) issues.push(`off edge: ${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${Math.round(b.left)}..${Math.round(b.right)}`);
      }
      if (touch) for (const el of document.querySelectorAll('a, button, input, [role=slider], select, summary')) {
        if (!vis(el) || el.closest('p, li span, .src, dd')) continue;
        const b = el.getBoundingClientRect();
        if (b.height < 40 || b.width < 40) issues.push(`small target ${Math.round(b.width)}x${Math.round(b.height)}: ${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${[...el.classList].join('.')} "${(el.textContent || el.value || '').trim().slice(0, 24)}"`);
      }
      for (const el of document.querySelectorAll('main *')) {
        if (!vis(el) || !el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 12.5) issues.push(`small text ${fs}px: ${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent.trim().slice(0, 30)}"`);
      }
      if (W >= 1000) for (const el of document.querySelectorAll('main p, main li, main dd')) {
        if (!vis(el)) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        const chars = el.getBoundingClientRect().width / (fs * 0.5);
        if (chars > 95 && el.textContent.length > 120) issues.push(`long lines ~${Math.round(chars)} chars: ${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent.trim().slice(0, 30)}"`);
      }
      return [...new Set(issues)];
    }, { touch, play: name === 'play' || name === 'reveal' });
    await p.screenshot({ path: `${OUT}${name}-${w}x${h}.png`, fullPage: name !== 'play' && name !== 'reveal' });
    report.push(`${name} ${w}x${h}: ${r.length ? '\n    ' + r.slice(0, 12).join('\n    ') + (r.length > 12 ? `\n    (+${r.length - 12} more)` : '') : 'ok'}`);
    await ctx.close();
  }
}
await browser.close();
console.log(report.join('\n'));
