// One-off icon generator: a simple white checkmark mark on the app's
// indigo brand color, replacing the default Expo placeholder icon.
const sharp = require('sharp');
const path = require('path');

const BRAND = '#4F46E5';
const CHECK = '<path d="M 277 535 L 437 695 L 747 295" fill="none" stroke="white" stroke-width="100" stroke-linecap="round" stroke-linejoin="round" />';

const svgWithBg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${BRAND}" />${CHECK}</svg>`;
const svgMarkOnly = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${CHECK}</svg>`;
const svgBgOnly = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${BRAND}" /></svg>`;

const assets = path.join(__dirname, '..', 'assets');

async function render(svg, size, file) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(path.join(assets, file));
  console.log('wrote', file, `${size}x${size}`);
}

async function main() {
  await render(svgWithBg, 1024, 'icon.png');
  await render(svgWithBg, 1024, 'splash-icon.png');
  await render(svgWithBg, 48, 'favicon.png');
  await render(svgMarkOnly, 512, 'android-icon-foreground.png');
  await render(svgBgOnly, 512, 'android-icon-background.png');
  await render(svgMarkOnly, 432, 'android-icon-monochrome.png');
}

main();
