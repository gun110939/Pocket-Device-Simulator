// Helpers for the end-to-end tests: start Chromium with the unpacked extension, talk CDP.
import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const EXT = join(ROOT, 'mobile-sim');
export const SITE = 'http://127.0.0.1:8765';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Branded Google Chrome ignores --load-extension, so use Chrome for Testing / Chromium.
export function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const pw = join(homedir(), 'Library/Caches/ms-playwright');
  if (existsSync(pw)) {
    for (const d of readdirSync(pw).filter((x) => x.startsWith('chromium-')).sort().reverse()) {
      for (const p of [`${d}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
        `${d}/chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`, `${d}/chrome-linux/chrome`]) {
        if (existsSync(join(pw, p))) return join(pw, p);
      }
    }
  }
  throw new Error('No Chromium found. Set CHROME_PATH to Chrome for Testing or Chromium (npx playwright install chromium).');
}

function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pend = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) {
      pend.get(d.id)(d);
      pend.delete(d.id);
    }
  };
  return new Promise((res, rej) => {
    ws.onerror = rej;
    ws.onopen = () => res({ send: (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); }), close: () => ws.close() });
  });
}

export async function evaluate(c, expr) {
  const r = await c.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  return r.result?.result?.value;
}

let portSeq = 9400;
export async function launch(startUrl = SITE + '/', { flags = [], size = '1300,950' } = {}) {
  const port = portSeq++;
  try { execSync(`lsof -tiTCP:${port} -sTCP:LISTEN | xargs kill`, { stdio: 'ignore' }); } catch {}
  const profile = mkdtempSync(join(tmpdir(), 'pocket-sim-'));
  const proc = spawn(findChrome(), ['--headless=new', `--user-data-dir=${profile}`, `--load-extension=${EXT}`, `--disable-extensions-except=${EXT}`,
    `--remote-debugging-port=${port}`, `--window-size=${size}`, '--no-first-run', '--lang=en-US', ...flags, startUrl], { stdio: 'ignore' });
  const list = async () => (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  let sw = null, targets = [];
  for (let i = 0; i < 60 && !sw; i++) {
    await sleep(500);
    try {
      targets = await list();
      for (const t of targets.filter((x) => x.type === 'service_worker')) {
        const c = await connect(t.webSocketDebuggerUrl);
        if ((await evaluate(c, 'chrome.runtime.getManifest().name').catch(() => '')) === 'Pocket Device Simulator') { sw = c; break; }
        c.close();
      }
    } catch {}
  }
  if (!sw) throw new Error('extension service worker not found');
  const b = {
    port, sw, proc,
    page: await connect(targets.find((t) => t.type === 'page').webSocketDebuggerUrl),
    async reconnect() {
      const t = (await list()).find((x) => x.type === 'page');
      b.page = await connect(t.webSocketDebuggerUrl);
      return b.page;
    },
    ev: (expr) => evaluate(b.page, expr),
    swev: (expr) => evaluate(sw, expr),
    async enable() {
      await evaluate(sw, `chrome.tabs.query({}).then(t=>enable(t.find(x=>x.url.startsWith('http')))).then(()=>'ok')`);
      await sleep(4000);
    },
    async mouse(type, x, y, buttons = 0) {
      await b.page.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: type === 'mouseMoved' ? 0 : 1 });
    },
    async downloads(dir) {
      await (await connect((await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl))
        .send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
    },
    close() {
      proc.kill();
      try { rmSync(profile, { recursive: true, force: true }); } catch {}
    },
  };
  return b;
}

// Shell shortcuts (the UI lives in an open shadow root)
export const R = `document.querySelector('body>div').shadowRoot`;
export const F = (n = 0) => `${R}.querySelectorAll('iframe')[${n}].contentWindow`;
export const clickUI = (b, sel) => b.ev(`${R}.querySelector(${JSON.stringify(sel)}).click()`);
export const setUI = (b, sel, val) => b.ev(`(()=>{const s=${R}.querySelector(${JSON.stringify(sel)}); if (s.type==='checkbox') s.checked=${JSON.stringify(val)}; else s.value=${JSON.stringify(val)}; s.dispatchEvent(new Event('change')); return 1})()`);
export async function pickDevice(b, name, add = false) {
  await b.ev(`${R}.querySelector('${add ? '.add' : '.caption .name'}').click()`);
  await sleep(300);
  await b.ev(`[...${R}.querySelectorAll('.card')].find(c=>c.querySelector('span').textContent.trim()===${JSON.stringify(name)}).click()`);
  await sleep(2800);
}
