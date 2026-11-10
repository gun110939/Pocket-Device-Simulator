// Regenerates the README images: node docs/screenshots.mjs
// Serves docs/demo/, drives the extension in headless Chromium at 2x and saves transparent device
// shots (the extension's own "Device, no background" mode) into docs/images/.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, renameSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, R, launch, sleep, clickUI, setUI, pickDevice } from '../tests/lib.mjs';

const DEMO = 'http://127.0.0.1:8770/';
const OUT = join(ROOT, 'docs/images');
mkdirSync(OUT, { recursive: true });
const server = spawn('python3', ['-I', '-m', 'http.server', '8770', '--bind', '127.0.0.1', '--directory', join(ROOT, 'docs/demo')], { stdio: 'ignore' });
await sleep(800);

const dl = mkdtempSync(join(tmpdir(), 'pocket-readme-'));
const b = await launch(DEMO, { flags: ['--force-device-scale-factor=2'], size: '1500,1000' });
await b.downloads(dl);
await b.enable();

// shrink a PNG so its longer side is at most `max` px (keeps alpha)
const fit = (file, max) => {
  const tmp = file + '.tmp.png';
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-vf', `scale='if(gt(iw,ih),min(${max},iw),-2)':'if(gt(iw,ih),-2,min(${max},ih))':flags=lanczos`, tmp]);
  renameSync(tmp, file);
};

async function shoot(name, max) {
  const before = new Set(readdirSync(dl));
  await b.ev(`(()=>{const r=${R}; r.querySelector('.shot').click(); r.querySelector('.shot-opts [data-mode=frame]').click(); const s=r.querySelector('.shot-scope'); if (s) s.value='active'; r.querySelector('.shot-go').click()})()`);
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    const added = readdirSync(dl).filter((f) => !before.has(f) && f.endsWith('.png'));
    if (added.length) {
      await sleep(300);
      const file = join(OUT, name + '.png');
      renameSync(join(dl, added[0]), file);
      fit(file, max);
      console.log('  ', name);
      return;
    }
  }
  throw new Error('no screenshot for ' + name);
}
const finish = async (n) => { for (let i = 0; i < n; i++) { await clickUI(b, '.caption .fin'); await sleep(250); } };
const fold = async () => { await clickUI(b, '.caption .fold'); await sleep(2400); };

const shots = [
  ['iphone-17-pro', 'iPhone 17 Pro (iOS 26)', 0],
  ['galaxy-s25-ultra', 'Galaxy S25 Ultra', 0],
  ['pixel-10-pro', 'Pixel 10 Pro', 1],
  ['ipad-mini', 'iPad mini', 0],
  ['ipad-pro-11', 'iPad Pro 11"', 1],
  ['ipad-pro-13', 'iPad Pro 13"', 0],
  ['macbook-air-13', 'MacBook Air 13"', 0],
];
for (const [file, name, fin] of shots) {
  await pickDevice(b, name);
  await finish(fin);
  await sleep(600);
  await shoot(file, /macbook|ipad-pro-13/.test(file) ? 1400 : 1000);
}
for (const [file, name] of [['iphone-duo', 'iPhone Duo'], ['galaxy-z-fold8', 'Galaxy Z Fold8'], ['galaxy-z-fold8-ultra', 'Galaxy Z Fold8 Ultra']]) {
  await pickDevice(b, name);
  await sleep(600);
  await shoot(file + '-folded', 1000);
  await fold();
  await shoot(file + '-unfolded', 1100);
}

// animated fold: frames of the unfold animation, cropped to the device area
await pickDevice(b, 'Galaxy Z Fold8');
await sleep(800);
const frames = mkdtempSync(join(tmpdir(), 'pocket-gif-'));
const box = await b.ev(`(()=>{const r=${R}.querySelector('.stage').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]})()`);
await clickUI(b, '.caption .fold');
for (let i = 0; i < 26; i++) {
  const r = await b.page.send('Page.captureScreenshot', { format: 'png', clip: { x: box[0], y: box[1], width: box[2], height: box[3], scale: 0.5 } });
  writeFileSync(join(frames, `f${String(i).padStart(2, '0')}.png`), Buffer.from(r.result.data, 'base64'));
  await sleep(55);
}
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '14', '-i', join(frames, 'f%02d.png'), '-vf',
  'scale=560:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', '-loop', '0', join(OUT, 'fold-animation.gif')]);
console.log('   fold-animation.gif');

// overview: the whole simulator with three devices side by side
await pickDevice(b, 'iPhone 17 Pro (iOS 26)');
await pickDevice(b, 'Galaxy Z Fold8 Ultra', true);
await clickUI(b, '.slot:nth-child(2) .caption .fold');
await sleep(2400);
await pickDevice(b, 'iPad mini', true);
await b.ev(`document.body.querySelector('div').shadowRoot.querySelector('.toast').classList.remove('show')`);
await sleep(1500);
const shot = await b.page.send('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(OUT, 'overview.png'), Buffer.from(shot.result.data, 'base64'));
fit(join(OUT, 'overview.png'), 1600);
console.log('   overview.png');

b.close();
server.kill();
rmSync(dl, { recursive: true, force: true });
rmSync(frames, { recursive: true, force: true });
