// Runs after `expo export -p web`. Copies the Cloudflare Pages routing/header
// rules and PWA manifest/icon into dist/, then patches dist/index.html's
// <head> to link them up — done here rather than via expo-router's +html.tsx
// so it works regardless of the web output mode (single vs static).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'web-static');
const dist = path.join(root, 'dist');

if (!fs.existsSync(dist)) {
  console.error('dist/ not found — run `npx expo export -p web` first.');
  process.exit(1);
}

for (const file of fs.readdirSync(src)) {
  fs.copyFileSync(path.join(src, file), path.join(dist, file));
}

const indexPath = path.join(dist, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
const extraHead = [
  '<link rel="manifest" href="/manifest.json">',
  '<meta name="theme-color" content="#4F46E5">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
  '<link rel="apple-touch-icon" href="/icon.png">',
].join('\n    ');

if (!html.includes('rel="manifest"')) {
  html = html.replace('</head>', `    ${extraHead}\n  </head>`);
  fs.writeFileSync(indexPath, html);
}

console.log('Copied _headers, _redirects, manifest.json, icon.png into dist/ and linked the manifest.');
