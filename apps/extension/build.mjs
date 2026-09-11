#!/usr/bin/env node
/**
 * Bundle the EPay browser extension.
 *
 *   node build.mjs             → Chrome MV3 (manifest.json)
 *   node build.mjs --firefox   → Firefox MV3 (manifest.firefox.json)
 *   node build.mjs --watch     → unminified watch build for development
 *
 * Content scripts are classic scripts (MV3 does not allow ESM content
 * scripts), so every entry is bundled as a self-contained IIFE.
 */
import { context, build } from 'esbuild';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const firefox = process.argv.includes('--firefox');
const watch = process.argv.includes('--watch');

const shared = {
  entryPoints: {
    content: resolve(root, 'src/content.ts'),
    background: resolve(root, 'src/background.ts'),
    popup: resolve(root, 'src/popup/main.tsx'),
  },
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: ['chrome116', 'firefox121'],
  outdir: resolve(root, 'dist'),
  sourcemap: true,
  minify: !watch,
  logLevel: 'info',
  jsx: 'automatic',
  define: {
    'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production'),
  },
};

async function copyStatic() {
  const dist = resolve(root, 'dist');
  await copyFile(resolve(root, 'src/popup/popup.html'), resolve(dist, 'popup.html'));
  await copyFile(resolve(root, 'src/popup/styles.css'), resolve(dist, 'styles.css'));
  await copyFile(
    resolve(root, firefox ? 'manifest.firefox.json' : 'manifest.json'),
    resolve(dist, 'manifest.json'),
  );
}

await rm(resolve(root, 'dist'), { recursive: true, force: true });
await mkdir(resolve(root, 'dist'), { recursive: true });

if (watch) {
  const ctx = await context(shared);
  await ctx.watch();
  await copyStatic();
  console.log(`[epay] watching extension (${firefox ? 'firefox' : 'chrome'})`);
} else {
  await build(shared);
  await copyStatic();
  console.log(
    `[epay] built extension → apps/extension/dist (${firefox ? 'firefox' : 'chrome'})`,
  );
}
