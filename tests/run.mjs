// End-to-end tests: node tests/run.mjs [suite ...]
// Starts the fixture server and a headless Chromium with the unpacked extension for each suite.
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { ROOT, SITE, R, F, launch, sleep, clickUI, setUI, pickDevice } from './lib.mjs';

const suites = {
  async core(b) {
    await b.enable();
    const s = await b.ev(`(()=>{const d=${F()}.document; return {ua:d.getElementById('hua').textContent, ck:d.getElementById('hck').textContent, js:JSON.parse(d.getElementById('js').textContent)}})()`);
    assert.match(s.ua, /iPhone/, 'User-Agent header is the device');
    assert.equal(s.ck, 'cookie=sid=abc', 'cookies stay first-party');
    assert.match(s.js.ua, /iPhone/);
    assert.equal(s.js.sw, 402, 'screen.width');
    assert.equal(s.js.dpr, 3);
    assert.equal(s.js.coarse, true, 'pointer: coarse');
    assert.equal(s.js.fe, null, 'frameElement hidden');
    await b.ev(`${F()}.document.getElementById('top').click()`);
    await sleep(2000);
    assert.equal(await b.ev(`${F()}.location.pathname`), '/page2', 'target=_top stays in the viewport');
    await b.ev(`${F()}.document.getElementById('cross').click()`);
    await sleep(4000);
    await b.reconnect();
    assert.equal(await b.ev('location.host'), 'localhost:8765', 'shell follows a cross-origin navigation');
    await b.swev(`chrome.tabs.query({}).then(t=>disable(t.find(x=>x.url.startsWith('http')).id))`);
    await sleep(2000);
    assert.equal(await b.swev('chrome.declarativeNetRequest.getSessionRules().then(r=>r.length)'), 0, 'rules removed on exit');
  },

  async devices(b) {
    await b.enable();
    await pickDevice(b, 'Galaxy Z Fold8 Ultra');
    await b.ev(`${F()}.__mark = 1`);
    await clickUI(b, '.caption .fold');
    await sleep(2200);
    assert.equal(await b.ev(`${F()}.innerWidth`), 859, 'unfolded width');
    assert.equal(await b.ev(`${F()}.__mark`), 1, 'unfolding does not reload the page');
    await clickUI(b, '.caption .rot');
    await sleep(1600);
    assert.equal(await b.ev(`${F()}.screen.orientation.type`), 'landscape-primary');
    await pickDevice(b, 'Responsive (free size)');
    await b.ev(`(()=>{const i=${R}.querySelector('.rw'); i.value='777'; i.dispatchEvent(new Event('change'))})()`);
    await sleep(800);
    assert.equal(await b.ev(`${F()}.innerWidth`), 777, 'responsive width');
    await clickUI(b, '.rmode');
    await sleep(3500);
    assert.match(await b.ev(`${F()}.navigator.userAgent`), /Windows/, 'desktop identity');
  },

  async screenshots(b) {
    const dir = mkdtempSync(join(tmpdir(), 'pocket-shots-'));
    await b.downloads(dir);
    await b.enable();
    await pickDevice(b, 'Pixel 9', true);
    for (const [mode, scope] of [['frame', 'active'], ['background', 'combined'], ['screen', 'active'], ['frame', 'each']]) {
      await b.ev(`(()=>{const r=${R}; r.querySelector('.shot').click(); r.querySelector('.shot-opts [data-mode=${mode}]').click(); r.querySelector('.shot-scope').value='${scope}'; r.querySelector('.shot-go').click()})()`);
      await sleep(scope === 'each' ? 4000 : 2500);
    }
    const files = readdirSync(dir).filter((f) => statSync(join(dir, f)).size > 1000);
    assert.equal(files.filter((f) => f.endsWith('.png')).length, 3, 'three PNGs');
    assert.equal(files.filter((f) => f.endsWith('.zip')).length, 1, 'one ZIP');
  },

  async touch(b) {
    await b.enable();
    const pt = await b.ev(`(()=>{const f=${R}.querySelector('iframe'); const fr=f.getBoundingClientRect(); const s=fr.width/f.contentWindow.innerWidth; const r=f.contentDocument.getElementById('b').getBoundingClientRect(); return [fr.left+(r.left+r.width/2)*s, fr.top+(r.top+r.height/2)*s]})()`);
    await b.mouse('mousePressed', pt[0], pt[1], 1);
    await b.mouse('mouseReleased', pt[0], pt[1]);
    await sleep(300);
    assert.equal(await b.ev(`[...new Set(${F()}.__log)].join(',')`), 'touchstart,touchend,mousedown,mouseup,click', 'tap event order');
    const y = pt[1] + 200;
    await b.mouse('mousePressed', pt[0], y, 1);
    for (let k = 1; k <= 8; k++) { await b.mouse('mouseMoved', pt[0], y - k * 30, 1); await sleep(12); }
    await b.mouse('mouseReleased', pt[0], y - 240);
    await sleep(900);
    assert.ok((await b.ev(`${F()}.scrollY`)) > 300, 'drag scrolls with momentum');
    assert.equal(await b.ev(`${F()}.document.getElementById('n').textContent`), '1', 'a swipe sends no click');
  },

  async keyboard(b) {
    await b.enable();
    await clickUI(b, '.settings');
    await setUI(b, '.set-bars', true);
    await clickUI(b, '.settings'); // close the menu so it does not cover the device
    await sleep(600);
    assert.ok((await b.ev(`${F()}.innerHeight`)) < 800, 'browser bar shrinks the viewport');
    const pt = await b.ev(`(()=>{const f=${R}.querySelector('iframe'); const fr=f.getBoundingClientRect(); const s=fr.width/f.contentWindow.innerWidth; const r=f.contentDocument.getElementById('t').getBoundingClientRect(); return [fr.left+(r.left+10)*s, fr.top+(r.top+r.height/2)*s]})()`);
    await b.mouse('mousePressed', pt[0], pt[1], 1);
    await b.mouse('mouseReleased', pt[0], pt[1]);
    await sleep(600);
    assert.ok(await b.ev(`!!${R}.querySelector('.kbd')`), 'keyboard shows on focus');
    for (const k of ['h', 'i']) await b.ev(`[...${R}.querySelectorAll('.kbd .key')].find(x=>x.dataset.k==='${k}').click()`);
    assert.equal(await b.ev(`${F()}.document.getElementById('t').value`), 'hi', 'keys type into the page');
  },

  async safearea(b) {
    await b.enable();
    await clickUI(b, '.caption .rot');
    await sleep(1800);
    const pad = await b.ev(`${F()}.getComputedStyle(${F()}.document.body).paddingLeft`);
    assert.equal(pad, '62px', 'env(safe-area-inset-left) in landscape');
  },

  async prefs(b) {
    await b.enable();
    await clickUI(b, '.settings');
    await sleep(300);
    await setUI(b, '.set-lang', 'ja-JP');
    await sleep(3000);
    assert.equal(await b.ev(`${F()}.navigator.language`), 'ja-JP');
    assert.match(await b.ev(`${F()}.document.getElementById('hal').textContent`), /^ja-JP/, 'Accept-Language header');
    await clickUI(b, '.settings');
    await sleep(300);
    await setUI(b, '.set-geo', '35.6762,139.6503');
    await sleep(3000);
    assert.equal(await b.ev(`new Promise(r=>${F()}.navigator.geolocation.getCurrentPosition(p=>r(p.coords.latitude)))`), 35.6762);
  },

  async sessions(b) {
    await b.enable();
    await pickDevice(b, 'Pixel 9', true);
    await setUI(b, '.sync-nav', false);
    await clickUI(b, '.settings');
    await sleep(300);
    await setUI(b, '.set-iso', true);
    await sleep(4000);
    const go = async (n, url) => { await b.ev(`${R}.querySelectorAll('iframe')[${n}].src=${JSON.stringify(url)}`); await sleep(1500); return b.ev(`${F(n)}.document.body.innerText`); };
    await go(0, SITE + '/setck?user=alice');
    await go(1, SITE + '/setck?user=bob');
    assert.match(await go(0, SITE + '/setck?check=1'), /user=alice/);
    assert.doesNotMatch(await go(0, SITE + '/setck?check=2'), /user=bob/, 'device A never sees B');
    assert.match(await go(1, SITE + '/setck?check=3'), /user=bob/);
    assert.match(await go(0, SITE + '/redir'), /session=fromredirect/, 'cookie set on a redirect is kept');
    await go(0, SITE + '/'); await go(1, SITE + '/');
    await b.ev(`${F(0)}.localStorage.setItem('k','A')`);
    assert.equal(await b.ev(`${F(1)}.localStorage.getItem('k')`), null, 'storage is per device');
  },

  async embed(b) {
    await b.enable();
    await sleep(2000);
    assert.equal(await b.ev('location.host'), '127.0.0.1:8765', "the page's own cross-origin iframe does not move the tab");
    assert.equal(await b.ev(`${F()}.location.pathname`), '/embed', 'the device shows the page');
    assert.equal(await b.ev(`!!${F()}.document.querySelector('iframe')`), true, 'the embed stays inside the device');
  },

  async edge(b) {
    await b.enable();
    // default: the page fills the whole screen and the status bar floats over it
    assert.equal(await b.ev(`${F()}.innerHeight`), 874, 'viewport is the full screen height');
    assert.equal(await b.ev(`${R}.querySelector('iframe').getBoundingClientRect().top === ${R}.querySelector('.screen').getBoundingClientRect().top`), true, 'page starts at the top of the screen');
    await sleep(1500);
    assert.equal(await b.ev(`getComputedStyle(${R}.querySelector('.status')).color`), 'rgb(255, 255, 255)', 'white status text on a red header');
    assert.equal(await b.ev(`getComputedStyle(${R}.querySelector('.status')).visibility`), 'hidden', 'no clock over a page without viewport-fit=cover');
    await clickUI(b, '.settings');
    await sleep(300);
    await setUI(b, '.set-edge', false);
    await sleep(600);
    assert.equal(await b.ev(`${F()}.innerHeight`), 820, 'status bar above the page when turned off');
    await setUI(b, '.set-edge', true);
    await setUI(b, '.set-bars', true);
    await sleep(600);
    assert.equal(await b.ev(`getComputedStyle(${R}.querySelector('.status')).position`), 'static', 'browser bars use a real status bar');
  },

  async navsync(b) {
    await b.enable();
    await pickDevice(b, 'Pixel 9', true);
    // a page that rewrites its own URL and loads slowly must not make the devices reload each other
    await b.ev(`(()=>{const u=${R}.querySelector('.url'); u.value=${JSON.stringify(SITE + '/loop')}; u.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}))})()`);
    await sleep(1500);
    await b.ev(`(()=>{window.__loads=[0,0]; [...${R}.querySelectorAll('iframe')].forEach((f,i)=>f.addEventListener('load',()=>window.__loads[i]++)); return 1})()`);
    await sleep(14000);
    const loads = await b.ev('window.__loads');
    assert.ok(loads[0] <= 1 && loads[1] <= 1, `no reload loop (loads ${JSON.stringify(loads)})`);
    // a real click in one device still leads the others
    await b.ev(`(()=>{const u=${R}.querySelector('.url'); u.value=${JSON.stringify(SITE + '/')}; u.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}))})()`);
    await sleep(2500);
    await b.ev(`(()=>{window.__m=[]; addEventListener('message', e=>{ if (e.data && e.data.msim && e.data.type!=='scroll') { const i=[...${R}.querySelectorAll('iframe')].findIndex(f=>f.contentWindow===e.source); window.__m.push(i+':'+e.data.type+(e.data.url?' '+e.data.url.slice(21):'')) } }); return 1})()`);
    const pt = await b.ev(`(()=>{const f=${R}.querySelector('iframe'); const fr=f.getBoundingClientRect(); const s=fr.width/f.contentWindow.innerWidth; const r=f.contentDocument.getElementById('top').getBoundingClientRect(); return [fr.left+(r.left+r.width/2)*s, fr.top+(r.top+r.height/2)*s]})()`);
    await b.mouse('mousePressed', pt[0], pt[1], 1);
    await sleep(60);
    await b.mouse('mouseReleased', pt[0], pt[1]);
    for (let i = 0; i < 20 && (await b.ev(`${F(1)}.location.pathname`)) !== '/page2'; i++) await sleep(300);
    const after = [await b.ev(`${F(0)}.location.pathname`), await b.ev(`${F(1)}.location.pathname`)];
    assert.deepEqual(after, ['/page2', '/page2'], `the other device follows a user click (got ${after}; ${JSON.stringify(await b.ev('window.__m'))}; toast=${await b.ev(`${R}.querySelector('.toast span').textContent`)})`);
    await clickUI(b, '.back');
    for (let i = 0; i < 20 && (await b.ev(`${F(1)}.location.pathname`)) !== '/'; i++) await sleep(300);
    assert.equal(await b.ev(`${F(0)}.location.pathname`), '/', 'back in the active device');
    assert.equal(await b.ev(`${F(1)}.location.pathname`), '/', 'the other device follows back');
  },

  async emulation(b) {
    await b.enable();
    await clickUI(b, '.settings');
    await sleep(300);
    await setUI(b, '.emu-scheme', 'dark');
    await sleep(900);
    assert.equal(await b.ev(`${F()}.getComputedStyle(${F()}.document.body).backgroundColor`), 'rgb(1, 2, 3)', 'page CSS sees dark mode');
    await setUI(b, '.emu-net', 'offline');
    await sleep(700);
    assert.equal(await b.ev(`${F()}.fetch('/').then(()=> 'ok', ()=> 'failed')`), 'failed', 'offline');
  },
};

const START = { embed: '/embed', edge: '/apphdr', navsync: '/', core: '/', devices: '/', screenshots: '/', touch: '/touch', keyboard: '/kbd', safearea: '/safe', prefs: '/', sessions: '/', emulation: '/dark' };

const server = spawn('python3', ['-I', join(ROOT, 'tests/fixture_server.py'), '8765'], { stdio: 'ignore' });
await sleep(800);
const pick = process.argv.slice(2);
let failed = 0;
for (const [name, fn] of Object.entries(suites)) {
  if (pick.length && !pick.includes(name)) continue;
  const t0 = Date.now();
  let b;
  try {
    b = await launch(SITE + START[name]);
    await fn(b);
    console.log(`  ok    ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}: ${e.message.split('\n')[0]}`);
  } finally {
    b && b.close();
  }
}
server.kill();
console.log(failed ? `\n${failed} suite(s) failed` : '\nall suites passed');
process.exit(failed ? 1 : 0);
