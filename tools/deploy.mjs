// Copies only the files the site needs into dist/ and uploads them to Cloudflare Pages.
// Usage: node tools/deploy.mjs [--dry]. Set WRANGLER to a wrangler binary if it is not on PATH.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const PROJECT = 'playcinch';
const FILES = ['index.html', 'site.webmanifest', 'og.png', 'icon.svg', 'icon-180.png', 'icon-512.png', 'LICENSE', 'js', 'css', 'data', 'fonts'];

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
for (const f of FILES) cpSync(f, `dist/${f}`, { recursive: true });
console.log(`dist/ ready with ${FILES.length} entries`);
if (process.argv.includes('--dry')) process.exit(0);

const bin = process.env.WRANGLER || 'wrangler';
execFileSync(bin, ['pages', 'deploy', 'dist', '--project-name', PROJECT, '--branch', 'main', '--commit-dirty=true'], { stdio: 'inherit' });
