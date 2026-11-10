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
  def(window, 'frameElement', null);

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

  // Sync channel with the simulator shell (the parent window).
  const parentWin = window.parent;
  const post = (msg) => {
    try {
      parentWin.postMessage({ msim: true, ...msg }, '*');
    } catch {}
  };
  const reportUrl = () => post({ type: 'nav', url: location.href, title: document.title });
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
    if (e.data.type === 'config') applyConfig(e.data.cfg);
    if (e.data.type === 'scrollTo') {
      const el = document.scrollingElement || document.documentElement;
      suppressUntil = performance.now() + 150;
      scrollTo(e.data.rx * (el.scrollWidth - innerWidth), e.data.ry * (el.scrollHeight - innerHeight));
    }
  });
})();
