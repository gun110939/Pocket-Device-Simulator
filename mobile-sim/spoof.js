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
  // Apps often change screen a moment after the tap (an animation, a fetch), so allow a few seconds.
  const byUser = () => performance.now() - lastInput < 4000;
  // spa: the address changed inside the page (History API), not by loading a new document
  const reportUrl = (spa) => post({ type: 'nav', url: location.href, title: document.title, user: byUser(), spa: spa === true });
  for (const fn of ['pushState', 'replaceState']) {
    const orig = history[fn];
    history[fn] = function (...args) {
      const r = orig.apply(this, args);
      reportUrl(true);
      return r;
    };
  }
  addEventListener('popstate', () => reportUrl(true));
  addEventListener('hashchange', () => reportUrl(true));
  addEventListener('DOMContentLoaded', () => reportUrl(false));
  addEventListener('load', () => reportUrl(false));
  // Tell the shell when a full-page navigation starts so it can show the load bar
  // (the Navigation API fires at the start; pagehide is the fallback).
  if (window.navigation) {
    navigation.addEventListener('navigate', (e) => {
      if (e.userInitiated || byUser()) post({ type: 'intent', url: e.destination.url });
      if (!e.destination.sameDocument && !e.downloadRequest) post({ type: 'loading' });
    });
  }
  addEventListener('pagehide', () => post({ type: 'loading' }));

  // ---- mirroring between devices: find "the same element" in another device's copy of the page ----
  // An element is named by its child-index path from <html>, checked against its tag and text; if the
  // layout differs (a tablet), the same tag + text is searched for instead.
  const pathOf = (el) => {
    const p = [];
    for (let n = el; n && n.parentElement; n = n.parentElement) p.unshift(Array.prototype.indexOf.call(n.parentElement.children, n));
    return p;
  };
  const tagsOf = (el) => {
    const t = [];
    for (let n = el; n && n.parentElement; n = n.parentElement) t.unshift(n.tagName);
    return t.join('>');
  };
  // follow the path, requiring the same tag at every step (text may differ: animations, clocks)
  const atPath = (p, tags) => {
    const want = tags ? tags.split('>') : null;
    let n = document.documentElement;
    for (let k = 0; k < (p || []).length; k++) {
      n = n && n.children[p[k]];
      if (!n || (want && n.tagName !== want[k])) return null;
    }
    return n;
  };
  // textContent, not innerText: it is the same in every device whatever the layout hides
  const textOf = (el) => String(el.textContent || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const describe = (el) => {
    const text = textOf(el);
    const same = text ? [...document.getElementsByTagName(el.tagName)].filter((n) => textOf(n) === text) : [];
    return { path: pathOf(el), tags: tagsOf(el), tag: el.tagName, text, nth: same.indexOf(el) };
  };
  const findSame = (m) => {
    const el = atPath(m.path, m.tags);
    if (el && el.tagName === m.tag) return el;
    if (!m.text) return null;
    const same = [...document.getElementsByTagName(m.tag)].filter((n) => textOf(n) === m.text);
    return same[Math.max(0, Math.min(m.nth, same.length - 1))] || null;
  };

  // A tap the user made here is replayed in the other devices (when "mirror taps" is on).
  addEventListener('click', (e) => {
    if (!c.mirror || !e.isTrusted || !(e.target instanceof Element)) return;
    const r = e.target.getBoundingClientRect();
    post({ type: 'tap', ...describe(e.target), rx: r.width ? (e.clientX - r.left) / r.width : 0.5, ry: r.height ? (e.clientY - r.top) / r.height : 0.5 });
  }, true);
  // Replay it the way a phone delivers a tap, so the app runs its own handlers and transitions.
  const replayTap = (m) => {
    const el = findSame(m);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width * m.rx, y = r.top + r.height * m.ry;
    const base = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, screenX: x, screenY: y, button: 0 };
    const touch = !!c.touch && typeof Touch === 'function';
    const ptr = (type, buttons) => el.dispatchEvent(new PointerEvent(type, { ...base, buttons, pointerId: touch ? 2 : 1, pointerType: touch ? 'touch' : 'mouse', isPrimary: true, width: touch ? 22 : 1, height: touch ? 22 : 1 }));
    const tch = (type) => {
      const t = new Touch({ identifier: 2, target: el, clientX: x, clientY: y, pageX: x + scrollX, pageY: y + scrollY, screenX: x, screenY: y, radiusX: 11, radiusY: 11, force: 1 });
      const end = type === 'touchend';
      return el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, composed: true, touches: end ? [] : [t], targetTouches: end ? [] : [t], changedTouches: [t] }));
    };
    let ok = ptr('pointerdown', 1);
    if (touch) ok = tch('touchstart') && ok;
    ptr('pointerup', 0);
    if (touch) ok = tch('touchend') && ok;
    if (!touch || ok) {
      el.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1, detail: 1 }));
      el.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0, detail: 1 }));
      el.dispatchEvent(new MouseEvent('click', { ...base, buttons: 0, detail: 1 }));
    }
    const field = el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
    if (field && field.focus) field.focus();
  };

  // Scroll sync covers the page and inner scroll areas (single-page apps often scroll a <div>).
  const quiet = new WeakMap(); // element -> time until which its scroll events are our own echo
  const queued = new Set();
  const scrollRoot = () => document.scrollingElement || document.documentElement;
  addEventListener(
    'scroll',
    (e) => {
      const el = e.target === document || e.target === window ? scrollRoot() : e.target;
      if (!(el instanceof Element) || queued.has(el) || performance.now() < (quiet.get(el) || 0)) return;
      queued.add(el);
      requestAnimationFrame(() => {
        queued.delete(el);
        const top = el === scrollRoot();
        const maxY = el.scrollHeight - (top ? innerHeight : el.clientHeight);
        const maxX = el.scrollWidth - (top ? innerWidth : el.clientWidth);
        post({ type: 'scroll', ...(top ? {} : { path: pathOf(el), tags: tagsOf(el), tag: el.tagName }), top, ry: maxY > 0 ? el.scrollTop / maxY : 0, rx: maxX > 0 ? el.scrollLeft / maxX : 0 });
      });
    },
    { capture: true, passive: true }
  );
  const scrollable = (el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
  const applyScroll = (m) => {
    let el = m.top || !m.path ? scrollRoot() : findSame({ ...m, text: '' });
    if (!el || !scrollable(el)) {
      if (m.top) return;
      // layouts differ: take the largest scroll area on the page
      let best = null, area = 0;
      for (const n of document.querySelectorAll('*')) {
        if (n.scrollHeight <= n.clientHeight + 1 && n.scrollWidth <= n.clientWidth + 1) continue;
        const st = getComputedStyle(n);
        if (!/(auto|scroll)/.test(st.overflowY + st.overflowX)) continue;
        const a = n.clientWidth * n.clientHeight;
        if (a > area) (best = n), (area = a);
      }
      if (!(el = best)) return;
    }
    const top = el === scrollRoot();
    quiet.set(el, performance.now() + 150);
    const maxY = el.scrollHeight - (top ? innerHeight : el.clientHeight);
    const maxX = el.scrollWidth - (top ? innerWidth : el.clientWidth);
    if (top) scrollTo(m.rx * maxX, m.ry * maxY);
    else el.scrollTo(m.rx * maxX, m.ry * maxY);
  };
  addEventListener('message', (e) => {
    if (e.source !== parentWin || !e.data || e.data.msim !== true) return;
    if (e.data.type === 'config') {
      applyConfig(e.data.cfg);
      applySafeArea();
    }
    if (e.data.type === 'key') typeKey(e.data.key);
    if (e.data.type === 'go') {
      // Follow another device's in-app navigation the way a router expects: push the address and
      // announce it with popstate, so single-page apps change screen without reloading.
      const to = new URL(e.data.url, location.href);
      if (to.origin !== location.origin) location.href = to.href;
      else if (to.href !== location.href) {
        history.pushState(history.state, '', to.href);
        dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
      }
    }
    if (e.data.type === 'kbd') {
      kbH = e.data.h || 0;
      if (window.visualViewport) visualViewport.dispatchEvent(new Event('resize'));
      const el = document.activeElement;
      if (kbH && el && el.getBoundingClientRect) {
        const r = el.getBoundingClientRect();
        if (r.bottom > innerHeight - kbH - 8) scrollBy({ top: r.bottom - (innerHeight - kbH) + 24, behavior: 'smooth' });
      }
    }
    if (e.data.type === 'scrollTo') applyScroll(e.data);
    if (e.data.type === 'tap') replayTap(e.data);
  });
})();
