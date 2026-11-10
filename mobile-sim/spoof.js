// Runs in the page's own JS world at document_start, in every frame. It does nothing unless
// this frame is a simulator viewport, marked by window.name = "msim:" + device JSON.
(() => {
  const name = window.name;
  if (typeof name !== 'string' || !name.startsWith('msim:')) return;
  let c;
  try {
    c = JSON.parse(decodeURIComponent(name.slice(5)));
  } catch {
    return;
  }

  const def = (obj, prop, get) => {
    try {
      Object.defineProperty(obj, prop, { get, configurable: true, enumerable: true });
    } catch {}
  };
  const portrait = () => {
    const natural = c.w <= c.h;
    return natural ? !c.landscape : !!c.landscape;
  };
  const sw = () => (c.landscape ? c.h : c.w);
  const sh = () => (c.landscape ? c.w : c.h);

  // navigator
  const N = Navigator.prototype;
  def(N, 'userAgent', () => c.ua);
  def(N, 'appVersion', () => c.ua.replace(/^Mozilla\//, ''));
  def(N, 'platform', () => c.platform);
  def(N, 'vendor', () => c.vendor);
  def(N, 'maxTouchPoints', () => (c.touch ? 5 : 0));
  if (c.os === 'ios' || c.os === 'mac' || c.os === 'tv') {
    def(N, 'userAgentData', () => undefined); // Safari and TV browsers expose no client hints
  } else if (navigator.userAgentData) {
    const real = navigator.userAgentData;
    const platform = c.os === 'windows' ? 'Windows' : 'Android';
    const mobile = !!c.mobileHint;
    const extra = c.os === 'windows'
      ? { platformVersion: '15.0.0', model: '', architecture: 'x86', bitness: '64' }
      : { platformVersion: '10.0.0', model: 'K', architecture: '', bitness: '' };
    const uad = {
      brands: real.brands,
      mobile,
      platform,
      getHighEntropyValues: async (hints) => {
        const base = await real.getHighEntropyValues(hints).catch(() => ({}));
        return { ...base, mobile, platform, ...extra };
      },
      toJSON() {
        return { brands: this.brands, mobile, platform };
      },
    };
    def(N, 'userAgentData', () => uad);
  }

  // screen, pixel ratio and orientation (live: rotate and fold update these without a reload)
  const S = Screen.prototype;
  def(S, 'width', sw);
  def(S, 'height', sh);
  def(S, 'availWidth', sw);
  def(S, 'availHeight', sh);
  def(window, 'devicePixelRatio', () => c.dpr);
  const orientationTarget = new EventTarget();
  const orientation = {
    get type() {
      return portrait() ? 'portrait-primary' : 'landscape-primary';
    },
    get angle() {
      return c.landscape ? 90 : 0;
    },
    onchange: null,
    addEventListener: (...a) => orientationTarget.addEventListener(...a),
    removeEventListener: (...a) => orientationTarget.removeEventListener(...a),
    dispatchEvent: (e) => orientationTarget.dispatchEvent(e),
    lock: () => Promise.reject(new DOMException('Not supported', 'NotSupportedError')),
    unlock() {},
  };
  def(S, 'orientation', () => orientation);
  if (c.touch) def(window, 'orientation', () => (c.landscape ? 90 : 0));

  // touch capability
  if (c.touch) {
    if (!('ontouchstart' in window)) {
      try {
        window.ontouchstart = null;
      } catch {}
    }
    const realMatchMedia = window.matchMedia.bind(window);
    const TRUE = '(min-width: 0px)';
    const FALSE = '(max-width: 0.01px)';
    window.matchMedia = function matchMedia(query) {
      const q = String(query)
        .replace(/\(\s*(any-)?pointer\s*:\s*coarse\s*\)/gi, TRUE)
        .replace(/\(\s*(any-)?pointer\s*:\s*fine\s*\)/gi, FALSE)
        .replace(/\(\s*(any-)?hover\s*:\s*none\s*\)/gi, TRUE)
        .replace(/\(\s*(any-)?hover\s*:\s*hover\s*\)/gi, FALSE);
      return realMatchMedia(q);
    };
    // Mobile browsers use overlay scrollbars that take no width.
    const st = document.createElement('style');
    st.textContent = 'html{scrollbar-width:none!important}';
    (document.head || document.documentElement).appendChild(st);
  }

  const applyConfig = (next) => {
    const wasPortrait = portrait();
    c = next;
    try {
      window.name = 'msim:' + encodeURIComponent(JSON.stringify(c));
    } catch {}
    if (wasPortrait !== portrait()) {
      const ev = new Event('change');
      if (typeof orientation.onchange === 'function') orientation.onchange(ev);
      orientationTarget.dispatchEvent(ev);
      if (c.touch) dispatchEvent(new Event('orientationchange'));
    }
  };

  // Look like a top-level page.
  def(window, 'frameElement', () => null);

  // Links and forms aimed at _top/_parent open in the viewport itself; the sandbox would
  // otherwise silently drop them.
  const retarget = (el) => {
    if (!el) return;
    const base = document.querySelector('base[target]');
    const target = el.getAttribute('target') || (base && base.getAttribute('target')) || '';
    if (/^_(top|parent)$/i.test(target)) el.setAttribute('target', '_self');
  };
  document.addEventListener('click', (e) => retarget(e.target instanceof Element ? e.target.closest('a[href], area[href]') : null), true);
  document.addEventListener('submit', (e) => retarget(e.target instanceof HTMLFormElement ? e.target : null), true);

  // ---- separate sessions: per-device cookies and storage ----
  // HTTP cookies are swapped in by the extension (sessions.js); here document.cookie and
  // Web Storage / IndexedDB / Cache Storage get a per-device namespace.
  let jarView = null; // non-HttpOnly cookies of this device: [{name, value, domain, hostOnly, path, secure, expires}]
  if (c.isolate && c.sid) {
    const sid = c.sid;
    const seedJar = () => {
      if (jarView === null) jarView = ((window.__msimJars || {})[sid] || []).slice();
      return jarView;
    };
    const defaultPath = (p) => (p.lastIndexOf('/') <= 0 ? '/' : p.slice(0, p.lastIndexOf('/')));
    const visible = () => {
      const host = location.hostname, path = location.pathname || '/', https = location.protocol === 'https:', now = Date.now();
      return seedJar()
        .filter((k) => (k.hostOnly ? host === k.domain : host === k.domain || host.endsWith('.' + k.domain)) &&
          (path === k.path || path.startsWith(k.path.endsWith('/') ? k.path : k.path + '/')) && (!k.secure || https) && (!k.expires || k.expires > now))
        .map((k) => `${k.name}=${k.value}`).join('; ');
    };
    const applyLocal = (str) => {
      const parts = str.split(';');
      const eq = parts[0].indexOf('=');
      if (eq < 0) return;
      const k = { name: parts[0].slice(0, eq).trim(), value: parts[0].slice(eq + 1).trim(), domain: location.hostname, hostOnly: true,
        path: defaultPath(location.pathname), secure: false, expires: 0 };
      for (const a of parts.slice(1)) {
        const i = a.indexOf('=');
        const n = (i < 0 ? a : a.slice(0, i)).trim().toLowerCase(), v = i < 0 ? '' : a.slice(i + 1).trim();
        if (n === 'path' && v.startsWith('/')) k.path = v;
        else if (n === 'domain' && v) Object.assign(k, { domain: v.replace(/^\./, ''), hostOnly: false });
        else if (n === 'secure') k.secure = true;
        else if (n === 'max-age') k.expires = Number(v) <= 0 ? 1 : Date.now() + Number(v) * 1000;
        else if (n === 'expires' && !Number.isNaN(Date.parse(v))) k.expires = Date.parse(v) <= Date.now() ? 1 : Date.parse(v);
      }
      const jar = seedJar();
      const at = jar.findIndex((x) => x.name === k.name && x.domain === k.domain && x.path === k.path);
      if (at >= 0) jar.splice(at, 1);
      if (k.expires !== 1) jar.push(k);
    };
    Object.defineProperty(Document.prototype, 'cookie', {
      configurable: true,
      get() {
        return visible();
      },
      set(v) {
        applyLocal(String(v));
        try {
          window.parent.postMessage({ msim: true, type: 'setcookie', value: String(v), url: location.href }, '*');
        } catch {}
      },
    });
    if (window.cookieStore) def(window, 'cookieStore', () => undefined);

    // Web Storage behind a per-device key prefix
    const prefix = `__msim_${sid}__`;
    const wrap = (real) => {
      const keys = () => Object.keys(real).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
      const api = {
        getItem: (n) => real.getItem(prefix + n),
        setItem: (n, v) => real.setItem(prefix + n, String(v)),
        removeItem: (n) => real.removeItem(prefix + n),
        clear: () => keys().forEach((k) => real.removeItem(prefix + k)),
        key: (i) => keys()[i] ?? null,
      };
      return new Proxy(real, {
        get: (t, k) => (k === 'length' ? keys().length : k in api ? api[k] : typeof k === 'symbol' || k in Storage.prototype ? Reflect.get(t, k) : (real.getItem(prefix + k) ?? undefined)),
        set: (t, k, v) => (real.setItem(prefix + String(k), String(v)), true),
        deleteProperty: (t, k) => (real.removeItem(prefix + String(k)), true),
        has: (t, k) => real.getItem(prefix + String(k)) !== null || k in Storage.prototype,
        ownKeys: () => keys(),
        getOwnPropertyDescriptor: (t, k) => {
          const v = real.getItem(prefix + String(k));
          return v === null ? undefined : { value: v, writable: true, enumerable: true, configurable: true };
        },
      });
    };
    try {
      const ls = wrap(window.localStorage), ss = wrap(window.sessionStorage);
      def(window, 'localStorage', () => ls);
      def(window, 'sessionStorage', () => ss);
    } catch {}
    // IndexedDB and Cache Storage: prefix database / cache names
    const F = IDBFactory.prototype;
    const open = F.open, del = F.deleteDatabase, dbs = F.databases;
    F.open = function (name, ...rest) { return open.call(this, prefix + name, ...rest); };
    F.deleteDatabase = function (name) { return del.call(this, prefix + name); };
    if (dbs) F.databases = async function () {
      return (await dbs.call(this)).filter((d) => d.name.startsWith(prefix)).map((d) => ({ ...d, name: d.name.slice(prefix.length) }));
    };
    if (window.CacheStorage) {
      const C = CacheStorage.prototype;
      for (const fn of ['open', 'has', 'delete']) {
        const orig = C[fn];
        C[fn] = function (name, ...rest) { return orig.call(this, prefix + name, ...rest); };
      }
      const keysFn = C.keys;
      C.keys = async function () { return (await keysFn.call(this)).filter((n) => n.startsWith(prefix)).map((n) => n.slice(prefix.length)); };
    }
  }

  // ---- language / locale ----
  if (c.lang) {
    const langs = [c.lang, c.lang.split('-')[0]].filter((x, i, a) => a.indexOf(x) === i);
    def(N, 'language', () => langs[0]);
    def(N, 'languages', () => Object.freeze([...langs]));
    // Intl and toLocale* use the chosen locale when the page does not pass one.
    const pick = (loc) => (loc === undefined ? c.lang : loc);
    for (const name of ['DateTimeFormat', 'NumberFormat', 'Collator', 'PluralRules', 'RelativeTimeFormat', 'ListFormat', 'DisplayNames', 'Segmenter']) {
      const Orig = Intl[name];
      if (!Orig) continue;
      const Wrapped = function (loc, opts) {
        return new.target ? new Orig(pick(loc), opts) : Orig(pick(loc), opts);
      };
      Wrapped.prototype = Orig.prototype;
      Wrapped.supportedLocalesOf = Orig.supportedLocalesOf.bind(Orig);
      try {
        Object.defineProperty(Intl, name, { value: Wrapped, configurable: true, writable: true });
      } catch {}
    }
    for (const [proto, fns] of [[Date.prototype, ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString']], [Number.prototype, ['toLocaleString']], [BigInt.prototype, ['toLocaleString']]]) {
      for (const fn of fns) {
        const orig = proto[fn];
        proto[fn] = function (loc, opts) {
          return orig.call(this, pick(loc), opts);
        };
      }
    }
    const lc = String.prototype.localeCompare;
    String.prototype.localeCompare = function (that, loc, opts) {
      return lc.call(this, that, pick(loc), opts);
    };
  }

  // ---- geolocation ----
  if (c.geo && navigator.geolocation) {
    const position = () => ({
      coords: { latitude: c.geo.lat, longitude: c.geo.lng, accuracy: 20, altitude: null, altitudeAccuracy: null, heading: null, speed: null,
        toJSON() { return { latitude: this.latitude, longitude: this.longitude, accuracy: this.accuracy }; } },
      timestamp: Date.now(),
    });
    let watchId = 0;
    const G = Geolocation.prototype;
    G.getCurrentPosition = function (ok) {
      setTimeout(() => ok && ok(position()), 50);
    };
    G.watchPosition = function (ok) {
      setTimeout(() => ok && ok(position()), 50);
      return ++watchId;
    };
    G.clearWatch = function () {};
    if (navigator.permissions && navigator.permissions.query) {
      const q = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = (desc) =>
        desc && desc.name === 'geolocation' ? Promise.resolve({ state: 'granted', name: 'geolocation', onchange: null, addEventListener() {}, removeEventListener() {} }) : q(desc);
    }
  }

  // ---- touch emulation: the mouse acts like a finger ----
  // The page receives touchstart/move/end instead of mouse events; dragging scrolls with
  // momentum; a tap still produces the click a phone would send.
  if (c.touch && c.touchEmu !== false) {
    const cursor = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30"><circle cx="15" cy="15" r="11" fill="rgba(80,80,80,.35)" stroke="rgba(255,255,255,.9)" stroke-width="2"/></svg>');
    const cur = document.createElement('style');
    cur.textContent = `html, html * { cursor: url("data:image/svg+xml,${cursor}") 15 15, pointer !important; }`;
    (document.head || document.documentElement).appendChild(cur);

    const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
    let t = null; // the current touch
    let blockClick = false;
    let fling = 0;

    const fire = (type, target, x, y) => {
      const touch = new Touch({ identifier: 1, target, clientX: x, clientY: y, pageX: x + scrollX, pageY: y + scrollY,
        screenX: x, screenY: y, radiusX: 11, radiusY: 11, force: 1 });
      const ended = type === 'touchend' || type === 'touchcancel';
      return target.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, composed: true,
        touches: ended ? [] : [touch], targetTouches: ended ? [] : [touch], changedTouches: [touch] }));
    };
    const canScroll = (el, axis) => {
      const st = getComputedStyle(el);
      const ov = axis === 'y' ? st.overflowY : st.overflowX;
      return /(auto|scroll)/.test(ov) && (axis === 'y' ? el.scrollHeight > el.clientHeight : el.scrollWidth > el.clientWidth);
    };
    const scrollerFor = (el, axis) => {
      for (let n = el; n && n !== document.documentElement && n !== document.body; n = n.parentElement) if (n instanceof Element && canScroll(n, axis)) return n;
      return document.scrollingElement || document.documentElement;
    };
    const swallow = (e) => {
      e.stopImmediatePropagation();
    };

    addEventListener('mousedown', (e) => {
      if (e.button !== 0 || !e.isTrusted) return;
      cancelAnimationFrame(fling);
      const target = e.target instanceof Element ? e.target : document.documentElement;
      const editable = target.closest(EDITABLE);
      t = { target, editable, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false, scroller: null,
        vx: 0, vy: 0, time: performance.now(), prevented: !fire('touchstart', target, e.clientX, e.clientY) };
      if (!editable) e.preventDefault(); // no text selection or image drag while swiping
      swallow(e);
    }, true);

    addEventListener('mousemove', (e) => {
      if (!e.isTrusted) return;
      swallow(e); // phones have no hover-move events
      if (!t || !(e.buttons & 1)) return;
      const dx = e.clientX - t.x, dy = e.clientY - t.y;
      if (!t.moved && Math.hypot(e.clientX - t.x0, e.clientY - t.y0) > 6) t.moved = true;
      const ok = fire('touchmove', t.target, e.clientX, e.clientY);
      if (t.moved && ok && !t.prevented && !t.editable) {
        if (!t.scroller) t.scroller = scrollerFor(t.target, Math.abs(e.clientY - t.y0) >= Math.abs(e.clientX - t.x0) ? 'y' : 'x');
        t.scroller.scrollBy(-dx, -dy);
        const now = performance.now(), dt = Math.max(1, now - t.time);
        t.vx = 0.8 * (-dx / dt) + 0.2 * t.vx;
        t.vy = 0.8 * (-dy / dt) + 0.2 * t.vy;
        t.time = now;
      }
      t.x = e.clientX;
      t.y = e.clientY;
    }, true);

    addEventListener('mouseup', (e) => {
      if (e.button !== 0 || !e.isTrusted || !t) return;
      swallow(e);
      const done = t;
      t = null;
      const ok = fire('touchend', done.target, e.clientX, e.clientY);
      if (done.moved || !ok) {
        blockClick = true; // a swipe, or the page cancelled the tap
        setTimeout(() => (blockClick = false), 0);
      } else {
        // compatibility mouse events a phone sends after a tap
        for (const type of ['mousedown', 'mouseup']) {
          done.target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, clientX: e.clientX, clientY: e.clientY, button: 0, buttons: type === 'mousedown' ? 1 : 0 }));
        }
        if (done.editable && done.editable.focus) done.editable.focus();
      }
      // momentum
      if (done.moved && done.scroller && !done.prevented && performance.now() - done.time < 80) {
        let vx = done.vx * 16, vy = done.vy * 16;
        const step = () => {
          vx *= 0.94;
          vy *= 0.94;
          if (Math.abs(vx) < 0.4 && Math.abs(vy) < 0.4) return;
          done.scroller.scrollBy(vx, vy);
          fling = requestAnimationFrame(step);
        };
        fling = requestAnimationFrame(step);
      }
    }, true);

    addEventListener('click', (e) => {
      if (blockClick && e.isTrusted) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);
    // A drag that leaves the frame ends the touch.
    addEventListener('mouseleave', () => {
      if (t) {
        fire('touchcancel', t.target, t.x, t.y);
        t = null;
      }
    });
  }

  // ---- safe area: env(safe-area-inset-*) for pages that opt in with viewport-fit=cover ----
  const SAFE_RE = /env\(\s*safe-area-inset-(top|right|bottom|left)\s*(?:,[^)]*)?\)/g;
  const applySafeArea = () => {
    const meta = document.querySelector('meta[name="viewport"]');
    const cover = !!meta && /viewport-fit\s*=\s*cover/i.test(meta.content || '');
    post({ type: 'viewport', cover, bg: getComputedStyle(document.documentElement).backgroundColor });
    let out = document.getElementById('__msim_safe');
    const sa = c.safe || { t: 0, r: 0, b: 0, l: 0 };
    if (!cover || !(sa.t || sa.r || sa.b || sa.l)) {
      if (out) out.textContent = '';
      return;
    }
    const vals = { top: sa.t, right: sa.r, bottom: sa.b, left: sa.l };
    const fix = (txt) => txt.replace(SAFE_RE, (_, side) => vals[side] + 'px');
    const rules = [];
    const walk = (list, wrap) => {
      for (const r of list) {
        if (r.cssRules && r.media) walk(r.cssRules, (t) => wrap(`@media ${r.media.mediaText}{${t}}`));
        else if (r.cssRules && r.conditionText) walk(r.cssRules, (t) => wrap(`@supports ${r.conditionText}{${t}}`));
        else if (r.style && r.selectorText && r.cssText.includes('safe-area-inset')) {
          // only the declarations that use env(), marked important so they win over the original
          const decls = r.style.cssText.split(/;(?![^(]*\))/).filter((x) => x.includes('safe-area-inset'));
          rules.push(wrap(`${r.selectorText}{${decls.map((x) => fix(x).trim() + ' !important').join(';')}}`));
        }
      }
    };
    for (const sheet of document.styleSheets) {
      if (sheet.ownerNode && sheet.ownerNode.id === '__msim_safe') continue;
      try {
        walk(sheet.cssRules, (t) => t);
      } catch {} // cross-origin sheets cannot be read
    }
    for (const el of document.querySelectorAll('[style*="safe-area-inset"]')) el.style.cssText = fix(el.style.cssText);
    if (!out) {
      out = document.createElement('style');
      out.id = '__msim_safe';
      (document.head || document.documentElement).appendChild(out);
    }
    out.textContent = rules.join('\n');
  };
  addEventListener('DOMContentLoaded', applySafeArea);
  addEventListener('load', applySafeArea);

  // ---- virtual keyboard: tell the shell when a text field gets focus ----
  const NON_TEXT = /^(checkbox|radio|range|color|file|submit|button|reset|image|hidden)$/i;
  const isEditable = (el) => !!el && (el.isContentEditable || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !NON_TEXT.test(el.type)));
  const kindOf = (el) => {
    const t = ((el.getAttribute && (el.getAttribute('inputmode') || el.type)) || 'text').toLowerCase();
    return /^(number|numeric|decimal|tel)$/.test(t) ? 'num' : t === 'email' ? 'email' : t === 'url' ? 'url' : 'text';
  };
  document.addEventListener('focusin', (e) => isEditable(e.target) && post({ type: 'kbd', show: true, kind: kindOf(e.target) }), true);
  document.addEventListener('focusout', () => setTimeout(() => !isEditable(document.activeElement) && post({ type: 'kbd', show: false }), 60), true);
  // While the keyboard is up, the visual viewport is shorter, like on a phone.
  let kbH = 0;
  const vvHeight = Object.getOwnPropertyDescriptor(VisualViewport.prototype, 'height');
  if (vvHeight && vvHeight.get) {
    def(VisualViewport.prototype, 'height', function () {
      return Math.max(0, vvHeight.get.call(this) - kbH);
    });
  }
  const typeKey = (key) => {
    const el = document.activeElement;
    if (!isEditable(el)) return;
    if (key === 'Backspace') document.execCommand('delete');
    else if (key === 'Enter') {
      const down = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true });
      if (!el.dispatchEvent(down)) return;
      if (el.tagName === 'TEXTAREA' || el.isContentEditable) document.execCommand('insertText', false, '\n');
      else if (el.form) el.form.requestSubmit ? el.form.requestSubmit() : el.form.submit();
      el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    } else {
      el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      document.execCommand('insertText', false, key);
      el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
    }
  };

  // Sync channel with the simulator shell (the parent window).
  const parentWin = window.parent;
  const post = (msg) => {
    try {
      parentWin.postMessage({ msim: true, sid: c.sid, ...msg }, '*');
    } catch {}
  };
  // Navigation sync only follows what the user did in this device. URL changes the page makes on
  // its own (replaceState, script redirects) must not drive the other devices, or they reload each
  // other forever.
  let lastInput = -1e9;
  const markInput = (e) => {
    if (e.isTrusted) lastInput = performance.now();
  };
  for (const t of ['pointerdown', 'mousedown', 'keydown', 'touchstart']) addEventListener(t, markInput, true);
  const byUser = () => performance.now() - lastInput < 1500;
  const reportUrl = () => post({ type: 'nav', url: location.href, title: document.title, user: byUser() });
  for (const fn of ['pushState', 'replaceState']) {
    const orig = history[fn];
    history[fn] = function (...args) {
      const r = orig.apply(this, args);
      reportUrl();
      return r;
    };
  }
  addEventListener('popstate', reportUrl);
  addEventListener('hashchange', reportUrl);
  addEventListener('DOMContentLoaded', reportUrl);
  addEventListener('load', reportUrl);
  // Tell the shell when a full-page navigation starts so it can show the load bar
  // (the Navigation API fires at the start; pagehide is the fallback).
  if (window.navigation) {
    navigation.addEventListener('navigate', (e) => {
      if (e.userInitiated || byUser()) post({ type: 'intent', url: e.destination.url });
      if (!e.destination.sameDocument && !e.downloadRequest) post({ type: 'loading' });
    });
  }
  addEventListener('pagehide', () => post({ type: 'loading' }));

  let suppressUntil = 0;
  let scrollQueued = false;
  addEventListener(
    'scroll',
    () => {
      if (performance.now() < suppressUntil || scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => {
        scrollQueued = false;
        const el = document.scrollingElement || document.documentElement;
        const maxY = el.scrollHeight - innerHeight;
        const maxX = el.scrollWidth - innerWidth;
        post({ type: 'scroll', ry: maxY > 0 ? scrollY / maxY : 0, rx: maxX > 0 ? scrollX / maxX : 0 });
      });
    },
    { passive: true }
  );
  addEventListener('message', (e) => {
    if (e.source !== parentWin || !e.data || e.data.msim !== true) return;
    if (e.data.type === 'config') {
      applyConfig(e.data.cfg);
      applySafeArea();
    }
    if (e.data.type === 'key') typeKey(e.data.key);
    if (e.data.type === 'jar') jarView = e.data.cookies || [];
    if (e.data.type === 'kbd') {
      kbH = e.data.h || 0;
      if (window.visualViewport) visualViewport.dispatchEvent(new Event('resize'));
      const el = document.activeElement;
      if (kbH && el && el.getBoundingClientRect) {
        const r = el.getBoundingClientRect();
        if (r.bottom > innerHeight - kbH - 8) scrollBy({ top: r.bottom - (innerHeight - kbH) + 24, behavior: 'smooth' });
      }
    }
    if (e.data.type === 'scrollTo') {
      const el = document.scrollingElement || document.documentElement;
      suppressUntil = performance.now() + 150;
      scrollTo(e.data.rx * (el.scrollWidth - innerWidth), e.data.ry * (el.scrollHeight - innerHeight));
    }
  });
})();
