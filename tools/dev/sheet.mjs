// Contact sheet: node tools/dev/sheet.mjs out.png height img...
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const [out, height, ...files] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 2000, height: Number(height) } });
await p.setContent(`<body style="margin:0;background:#888;display:inline-flex;gap:8px">${files.map((f) => `<img style="height:${height}px" src="data:image/png;base64,${readFileSync(resolve(f)).toString('base64')}">`).join('')}</body>`);
await p.locator('body').screenshot({ path: out });
await b.close();
