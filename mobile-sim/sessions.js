// Separate sessions per device (opt-in). Loaded by background.js.
//
// Every device viewport gets its own cookie jar. The extension attaches the Chrome debugger to the
// simulated tab and:
//   * pauses each request from a device frame (Fetch domain) and sets its Cookie header from that
//     device's jar, so the browser's own cookies never reach the site from a device;
//   * reads Set-Cookie from the raw response headers (Network.responseReceivedExtraInfo) into the jar;
//   * strips Set-Cookie for the tab with a declarativeNetRequest rule, so the browser's shared jar
//     stays untouched.
// document.cookie and Web Storage are isolated in the page by spoof.js (per device "sid").

const Sessions = (() => {
  const tabs = new Map(); // tabId -> { frames: Map(frameId -> sid), reqs: Map(requestId -> {sid, urls}), jars: {sid: Cookie[]}, scriptId }

  // ---------- cookie jar ----------
  function parseSetCookie(line, url) {
    const u = new URL(url);
    const parts = line.split(';');
    const eq = parts[0].indexOf('=');
    if (eq < 0) return null;
    const c = { name: parts[0].slice(0, eq).trim(), value: parts[0].slice(eq + 1).trim(), domain: u.hostname, hostOnly: true,
      path: defaultPath(u.pathname), secure: false, httpOnly: false, expires: 0, sameSite: 'lax' };
    for (const attr of parts.slice(1)) {
      const i = attr.indexOf('=');
      const k = (i < 0 ? attr : attr.slice(0, i)).trim().toLowerCase();
      const v = i < 0 ? '' : attr.slice(i + 1).trim();
      if (k === 'domain' && v) {
        const d = v.replace(/^\./, '').toLowerCase();
        if (u.hostname === d || u.hostname.endsWith('.' + d)) Object.assign(c, { domain: d, hostOnly: false });
      } else if (k === 'path' && v.startsWith('/')) c.path = v;
      else if (k === 'secure') c.secure = true;
      else if (k === 'httponly') c.httpOnly = true;
      else if (k === 'samesite') c.sameSite = v.toLowerCase();
      else if (k === 'max-age' && /^-?\d+$/.test(v)) c.expires = Number(v) <= 0 ? 1 : Date.now() + Number(v) * 1000;
      else if (k === 'expires' && !parts.some((p) => /^\s*max-age=/i.test(p))) {
        const t = Date.parse(v);
        if (!Number.isNaN(t)) c.expires = t <= Date.now() ? 1 : t;
      }
    }
    return c;
  }
  function defaultPath(p) {
    if (!p || !p.startsWith('/')) return '/';
    const i = p.lastIndexOf('/');
    return i <= 0 ? '/' : p.slice(0, i);
  }
  function store(jar, c) {
    const i = jar.findIndex((x) => x.name === c.name && x.domain === c.domain && x.path === c.path);
    if (i >= 0) jar.splice(i, 1);
    if (c.expires === 1) return; // expiry in the past deletes
    jar.push(c);
  }
  function matches(c, u, now) {
    const host = u.hostname;
    if (c.expires && c.expires < now) return false;
    if (c.hostOnly ? host !== c.domain : host !== c.domain && !host.endsWith('.' + c.domain)) return false;
    const p = u.pathname || '/';
    if (!(p === c.path || p.startsWith(c.path.endsWith('/') ? c.path : c.path + '/'))) return false;
    return !c.secure || u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  }
  function cookieHeader(jar, url) {
    const u = new URL(url);
    const now = Date.now();
    return jar.filter((c) => matches(c, u, now)).sort((a, b) => b.path.length - a.path.length).map((c) => `${c.name}=${c.value}`).join('; ');
  }

  // ---------- frames ----------
  const sidFromName = (name) => {
    if (!name || !name.startsWith('msim:')) return null;
    try {
      return JSON.parse(decodeURIComponent(name.slice(5))).sid || null;
    } catch {
      return null;
    }
  };
  function indexTree(t, node, parentSid) {
    const sid = sidFromName(node.frame.name) || parentSid;
    if (sid) t.frames.set(node.frame.id, sid);
    for (const child of node.childFrames || []) indexTree(t, child, sid);
  }

  const cmd = (tabId, method, params = {}) => chrome.debugger.sendCommand({ tabId }, method, params);

  // Seed for document.cookie: the non-HttpOnly cookies of every device, read by spoof.js at start-up.
  let seedTimer = 0;
  function pushSeed(tabId) {
    clearTimeout(seedTimer);
    seedTimer = setTimeout(async () => {
      const t = tabs.get(tabId);
      if (!t) return;
      const visible = {};
      for (const [sid, jar] of Object.entries(t.jars)) visible[sid] = jar.filter((c) => !c.httpOnly);
      const source = `window.__msimJars = ${JSON.stringify(visible)};`;
      try {
        if (t.scriptId) await cmd(tabId, 'Page.removeScriptToEvaluateOnNewDocument', { identifier: t.scriptId });
        t.scriptId = (await cmd(tabId, 'Page.addScriptToEvaluateOnNewDocument', { source })).identifier;
      } catch {}
      chrome.storage.session.set({ ['jars:' + tabId]: t.jars }).catch(() => {});
    }, 80);
  }
  function changed(tabId, sid) {
    const t = tabs.get(tabId);
    pushSeed(tabId);
    chrome.tabs.sendMessage(tabId, { type: 'jar', sid, cookies: (t.jars[sid] || []).filter((c) => !c.httpOnly) }, { frameId: 0 }).catch(() => {});
  }

  // ---------- debugger events ----------
  chrome.debugger.onEvent.addListener((src, method, p) => {
    const t = tabs.get(src.tabId);
    if (!t) return;
    const tabId = src.tabId;
    if (method === 'Page.frameNavigated') {
      const parentSid = p.frame.parentId ? t.frames.get(p.frame.parentId) : null;
      const sid = sidFromName(p.frame.name) || parentSid;
      if (sid) t.frames.set(p.frame.id, sid);
      else t.frames.delete(p.frame.id);
    } else if (method === 'Page.frameAttached') {
      const sid = t.frames.get(p.parentFrameId);
      if (sid) t.frames.set(p.frameId, sid);
    } else if (method === 'Page.frameDetached') {
      t.frames.delete(p.frameId);
    } else if (method === 'Fetch.requestPaused') {
      const sid = t.frames.get(p.frameId);
      if (!sid) return cmd(tabId, 'Fetch.continueRequest', { requestId: p.requestId }).catch(() => {});
      const headers = Object.entries(p.request.headers).filter(([k]) => k.toLowerCase() !== 'cookie').map(([name, value]) => ({ name, value }));
      const ck = cookieHeader(t.jars[sid] || [], p.request.url);
      if (ck) headers.push({ name: 'Cookie', value: ck });
      cmd(tabId, 'Fetch.continueRequest', { requestId: p.requestId, headers }).catch(() => {});
    } else if (method === 'Network.requestWillBeSent') {
      const sid = t.frames.get(p.frameId);
      if (!sid) return;
      const r = t.reqs.get(p.requestId) || { sid, urls: [] };
      r.urls.push(p.request.url);
      t.reqs.set(p.requestId, r);
    } else if (method === 'Network.responseReceivedExtraInfo') {
      const r = t.reqs.get(p.requestId);
      if (!r) return;
      const url = r.urls.shift() || r.last;
      r.last = url;
      const lines = Object.entries(p.headers || {}).filter(([k]) => k.toLowerCase() === 'set-cookie').flatMap(([, v]) => String(v).split('\n'));
      if (!lines.length || !url) return;
      const jar = (t.jars[r.sid] = t.jars[r.sid] || []);
      for (const line of lines) {
        const c = parseSetCookie(line, url);
        if (c) store(jar, c);
      }
      changed(tabId, r.sid);
    } else if (method === 'Network.loadingFinished' || method === 'Network.loadingFailed') {
      setTimeout(() => t.reqs.delete(p.requestId), 2000);
    }
  });

  chrome.debugger.onDetach.addListener(async (src) => {
    if (!tabs.has(src.tabId)) return;
    tabs.delete(src.tabId);
    // The user closed the debugger bar: turn the mode off for this tab.
    chrome.tabs.sendMessage(src.tabId, { type: 'isolation-off' }, { frameId: 0 }).catch(() => {});
  });

  return {
    has: (tabId) => tabs.has(tabId),
    async start(tabId) {
      if (tabs.has(tabId)) return true;
      const { ['jars:' + tabId]: saved } = await chrome.storage.session.get('jars:' + tabId);
      const t = { frames: new Map(), reqs: new Map(), jars: saved || {}, scriptId: null };
      await chrome.debugger.attach({ tabId }, '1.3');
      tabs.set(tabId, t);
      await cmd(tabId, 'Page.enable');
      await cmd(tabId, 'Network.enable');
      await cmd(tabId, 'Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
      const { frameTree } = await cmd(tabId, 'Page.getFrameTree');
      indexTree(t, frameTree, null);
      pushSeed(tabId);
      return true;
    },
    async stop(tabId, { clear = false } = {}) {
      const t = tabs.get(tabId);
      tabs.delete(tabId);
      if (t) await chrome.debugger.detach({ tabId }).catch(() => {});
      if (clear) await chrome.storage.session.remove('jars:' + tabId);
    },
    // document.cookie = "..." from a device page
    setFromScript(tabId, sid, url, value) {
      const t = tabs.get(tabId);
      if (!t || !sid) return;
      const c = parseSetCookie(value, url);
      if (!c || c.httpOnly) return;
      store((t.jars[sid] = t.jars[sid] || []), c);
      changed(tabId, sid);
    },
    clearDevice(tabId, sid) {
      const t = tabs.get(tabId);
      if (!t) return;
      t.jars[sid] = [];
      changed(tabId, sid);
    },
    count(tabId) {
      const t = tabs.get(tabId);
      return t ? Object.fromEntries(Object.entries(t.jars).map(([k, v]) => [k, v.length])) : {};
    },
    _cookieHeader: cookieHeader,
    _parse: parseSetCookie,
  };
})();
