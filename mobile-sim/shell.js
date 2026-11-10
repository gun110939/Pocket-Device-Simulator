// Injected into the top document of a simulated tab (isolated world). Replaces the page with
// the simulator UI and loads the page again inside one or more device viewports.
(async () => {
  if (window.__msimShell) return;
  window.__msimShell = true;

  const CAT = self.MSIM_CATEGORIES;
  const BUILTIN = self.MSIM_DEVICES;
  const resolve = self.MSIM_resolve;
  const cap = self.MSIM_capture;
  // After the extension is reloaded, this old copy of the shell can no longer reach it.
  const alive = () => {
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  };
  let staleShown = false;
  function showStale() {
    if (staleShown || !shellRoot) return;
    staleShown = true;
    const o = document.createElement('div');
    o.className = 'stale';
    o.innerHTML = '<div class="box"><h4>Pocket Sim was updated</h4><p>This tab still runs the old version. Reload the page to continue.</p><button class="btn primary">Reload page</button></div>';
    o.querySelector('button').onclick = () => location.reload();
    shellRoot.querySelector('.app').appendChild(o);
  }
  let shellRoot = null;
  const send = async (msg) => {
    if (!alive()) {
      showStale();
      return { error: 'stale' };
    }
    try {
      return await chrome.runtime.sendMessage(msg);
    } catch (e) {
      if (!alive()) showStale();
      return { error: String((e && e.message) || e) };
    }
  };

  let state = await send({ type: 'getState' });
  if (!state || state.error) return;
  let customs = (await chrome.storage.local.get('customDevices')).customDevices || [];
  const allDevices = () => [...BUILTIN, ...customs];
  const lookup = (id) => allDevices().find((d) => d.id === id) || BUILTIN.find((d) => d.id === self.MSIM_DEFAULT_DEVICE);

  let currentUrl = location.href;

  // ---- replace the page ----
  window.stop();
  const pageTitle = document.title;
  document.documentElement.replaceChildren(document.createElement('head'), document.createElement('body'));
  document.title = pageTitle;
  document.documentElement.removeAttribute('class');
  document.documentElement.style.cssText = 'background:#0b1f0b;margin:0;height:100%;overflow:hidden';
  document.body.style.cssText = 'margin:0;height:100%;overflow:hidden';
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;visibility:visible;z-index:2147483647';
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });
  shellRoot = root;

  // Pixel fonts bundled with the extension (SIL OFL). FontFaces live on the document so the
  // shadow root can use them.
  for (const [family, file] of [['MSIM Press', 'fonts/PressStart2P-Regular.ttf'], ['MSIM VT', 'fonts/VT323-Regular.ttf']]) {
    try {
      const face = new FontFace(family, `url("${chrome.runtime.getURL(file)}")`);
      document.fonts.add(face);
      face.load().catch(() => {});
    } catch {}
  }
  const I = self.MSIM_ICON;
  const artBase = chrome.runtime.getURL('assets/');
  const ART = (name) => `${artBase}${name}.png`;
  // Pixel-art thumbnail for a device in the picker.
  const thumbFor = (d) => {
    if (d.fold) return d.fold.kind === 'flip' ? 'thumb-flip' : 'thumb-foldable';
    return ({ island: 'thumb-phone-ios', notch: 'thumb-phone-ios', classic: 'thumb-phone-ios', punch: 'thumb-phone-android',
      cover: 'thumb-phone-android', tablet: 'thumb-tablet', watch: 'thumb-watch', laptop: 'thumb-laptop', monitor: 'thumb-monitor',
      tv: 'thumb-tv', kiosk: 'thumb-kiosk' })[d.style] || 'thumb-phone-android';
  };

  root.innerHTML = `<style>${self.MSIM_CSS}</style>
<div class="app">
  <div class="scene" style="background-image:url('${ART('scene')}')"></div>
  <div class="bar">
    <div class="logo"><img class="mascot" src="${ART('mascot')}" alt="">POCKET&nbsp;SIM</div>
    <div class="grp">
      <button class="btn add" title="Add another device to this tab">${I('plus')}Device</button>
      <button class="btn sync" title="Sync options">${I('sync')}Sync</button>
      <select class="zoom" title="Zoom">
        <option value="fit">Fit</option><option value="1">100%</option><option value="0.75">75%</option><option value="0.5">50%</option><option value="0.33">33%</option>
      </select>
    </div>
    <span class="sep"></span>
    <button class="btn back" title="Back">${I('back')}</button>
    <button class="btn reload" title="Reload all devices">${I('reload')}</button>
    <input class="url" spellcheck="false" />
    <span class="sep"></span>
    <span class="rec-live"><span class="dot"></span>REC <span class="rec-time">0:00</span><button class="btn rec-stop">${I('stop')}Stop</button></span>
    <button class="btn shot" title="Screenshot">${I('camera')}</button>
    <button class="btn rec" title="Record video">${I('rec')}</button>
    <button class="btn danger exit" title="Exit simulator">${I('close')}</button>
  </div>
  <div class="stage"><div class="row"></div></div>

  <div class="pop sync-pop" style="left:120px">
    <h4>Sync between devices</h4>
    <div class="row2"><span>Scroll position</span><label class="toggle"><input type="checkbox" class="sync-scroll"><span></span></label></div>
    <div class="row2"><span>Navigation (links, back)</span><label class="toggle"><input type="checkbox" class="sync-nav"><span></span></label></div>
    <div class="note">The User-Agent header is per tab, so it follows the device marked UA. Each device still reports its own identity to page scripts.</div>
  </div>

  <div class="pop shot-pop" style="right:84px">
    <h4>Screenshot</h4>
    <div class="opts shot-opts">
      <div class="opt sel" data-mode="frame">${I('phone', 3)}Device, no background</div>
      <div class="opt" data-mode="background">${I('image', 3)}Device on a colour</div>
      <div class="opt" data-mode="screen">${I('screen', 3)}Screen only</div>
      <div class="opt" data-mode="full">${I('down', 3)}Full page</div>
    </div>
    <div class="row2 bg-row"><span>Background colour</span><input type="color" class="bg-color" value="#9bbc0f"></div>
    <div class="row2 round-row"><span>Rounded corners, transparent</span><label class="toggle"><input type="checkbox" class="shot-round"><span></span></label></div>
    <div class="row2 all-row"><span>Devices</span><select class="shot-scope">
      <option value="active">Active device</option><option value="combined">All in one image</option><option value="each">Each device (.zip)</option></select></div>
    <button class="btn primary go shot-go">${I('camera')}Take screenshot</button>
    <div class="note">"No background" saves a transparent PNG. Higher zoom gives a sharper image.</div>
  </div>

  <div class="pop rec-pop" style="right:44px">
    <h4>Record video</h4>
    <div class="opts rec-opts">
      <div class="opt sel" data-mode="device">${I('phone', 3)}Device only</div>
      <div class="opt" data-mode="cam">${I('face', 3)}Device + webcam</div>
    </div>
    <div class="row2"><span>Microphone</span><label class="toggle"><input type="checkbox" class="rec-mic"><span></span></label></div>
    <div class="row2"><span>Quality</span><select class="rec-q"><option value="3000000">Standard</option><option value="8000000" selected>High</option><option value="16000000">Max</option></select></div>
    <div class="row2 all-row"><span>All visible devices</span><label class="toggle"><input type="checkbox" class="rec-all"><span></span></label></div>
    <button class="btn primary go rec-go">${I('rec')}Start recording</button>
    <div class="note">Chrome asks you to share this tab; choose it and press Share. Tick "Also share tab audio" to include page sound.</div>
  </div>

  <div class="panel">
    <div class="head"><input class="search" placeholder="Search devices…"><button class="btn close-panel">${I('close')}</button></div>
    <div class="mode"></div>
    <div class="list"></div>
  </div>
  <div class="toast"><img alt=""><span></span></div>
</div>`;

  const $ = (s) => root.querySelector(s);
  const stage = $('.stage');
  const row = $('.row');
  const urlInput = $('.url');
  const zoomSel = $('.zoom');

  const toast = (text, ms = 2000, pose = 'mascot') => {
    const t = $('.toast');
    if (ms < 60000) t.classList.remove('top');
    t.querySelector('span').textContent = text;
    t.querySelector('img').src = ART(pose);
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), ms);
  };

  // Persistent toast for long operations; progress(null) hides it.
  // It sits over the toolbar so it never ends up inside a capture.
  function progress(text) {
    const t = $('.toast');
    if (text === null) {
      t.classList.remove('show', 'top');
      return;
    }
    t.classList.add('top');
    toast(text, 60000, 'mascot');
  }

  // ---- state ----
  // Older state shape had a single deviceId.
  if (!Array.isArray(state.devices)) state.devices = [{ id: state.deviceId || self.MSIM_DEFAULT_DEVICE, landscape: !!state.landscape, folded: true }];
  state.active = Math.min(state.active || 0, state.devices.length - 1);
  state.primary = Math.min(state.primary || 0, state.devices.length - 1);
  state.sync = state.sync || { scroll: true, nav: true };

  async function save(patch) {
    Object.assign(state, patch);
    const next = await send({ type: 'update', patch });
    if (next && !next.error) state = { ...state, ...next };
  }

  const views = []; // per device: { slot, scaler, device, body, screen, iframe, lastUrl, followUntil }

  const cfgFor = (inst) => {
    const d = resolve(lookup(inst.id), inst.folded);
    return { ua: d.ua, platform: d.platform, vendor: d.vendor, touch: d.touch, os: d.os, dpr: d.dpr, w: d.w, h: d.h,
      landscape: !!inst.landscape, mobileHint: /Mobile/.test(d.ua) };
  };

  const PHONE_STYLES = ['island', 'notch', 'punch', 'classic', 'cover'];

  function geometry(d, landscape) {
    switch (d.style) {
      case 'classic': return { pad: landscape ? [14, 72, 14, 72] : [72, 14, 72, 14], radius: 50, screenRadius: 2, band: 3 };
      case 'cover': return { pad: [26, 22, 26, 22], radius: d.radius + 24, screenRadius: d.radius, band: 5 };
      case 'tablet': return { pad: [22, 22, 22, 22], radius: d.radius + 18, screenRadius: d.radius, band: 4 };
      case 'watch': return { pad: [17, 17, 17, 17], radius: d.radius + 17, screenRadius: d.radius, band: 7 };
      case 'laptop': return { pad: [20, 18, 24, 18], radius: '16px 16px 6px 6px', screenRadius: 4, band: 3 };
      case 'monitor': return { pad: [14, 14, 22, 14], radius: 10, screenRadius: 2, band: 2 };
      case 'tv': return { pad: [9, 9, 9, 9], radius: 6, screenRadius: 2, band: 2 };
      case 'kiosk': return { pad: [48, 26, 26, 26], radius: 14, screenRadius: 4, band: 12 };
      default: return { pad: [12, 12, 12, 12], radius: d.radius + 12, screenRadius: d.radius, band: 4 };
    }
  }

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  // Build a device view once. Rotate/fold reshape it in place so the page is not reloaded.
  function createView(i) {
    const v = { lastUrl: currentUrl, followUntil: 0 };
    v.slot = el('div', 'slot');
    v.scaler = el('div', 'scaler', v.slot);
    v.device = el('div', 'device', v.scaler);
    v.body = el('div', 'body', v.device);
    v.screen = el('div', 'screen', v.body);
    v.caption = el('div', 'caption', v.slot);
    v.iframe = el('iframe');
    v.iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-pointer-lock allow-presentation');
    v.iframe.setAttribute('allow', 'geolocation; clipboard-read; clipboard-write; fullscreen; autoplay; camera; microphone');
    v.iframe.name = 'msim:' + encodeURIComponent(JSON.stringify(cfgFor(state.devices[i])));
    v.iframe.src = currentUrl;
    v.screen.appendChild(v.iframe);
    v.iframe.addEventListener('load', () => {
      setLoading(v, false);
      onFrameLoad(v);
    });
    v.loading = true;
    v.slot.addEventListener('pointerdown', () => setActive(views.indexOf(v)));
    new ResizeObserver(() => scheduleLayout()).observe(v.device);
    return v;
  }

  function shapeView(i) {
    const v = views[i];
    const inst = state.devices[i];
    const base = lookup(inst.id);
    const d = resolve(base, inst.folded);
    const landscape = !!inst.landscape;
    const w = landscape ? d.h : d.w;
    const h = landscape ? d.w : d.h;
    const phoneLike = PHONE_STYLES.includes(d.style);
    const unfoldedBook = base.fold && !inst.folded && base.fold.kind === 'book';
    const barH = landscape && phoneLike && !unfoldedBook ? 0 : d.bar || 0;
    const g = geometry(d, landscape);

    const finishes = base.finishes || self.MSIM_FINISHES.dark;
    const finish = finishes[(inst.finish || 0) % finishes.length];
    v.device.dataset.style = d.style;
    v.device.style.setProperty('--metal', finish.metal);
    v.device.style.setProperty('--front', finish.front);
    v.body.style.padding = g.pad.map((p) => p + 'px').join(' ');
    const radius = typeof g.radius === 'number' ? g.radius + 'px' : g.radius;
    v.body.style.borderRadius = radius;
    v.screen.style.width = w + 'px';
    v.screen.style.height = h + 'px';
    v.screen.style.borderRadius = g.screenRadius + 'px';

    // decorations: everything except the screen and the iframe is rebuilt
    for (const n of [...v.body.children]) if (n !== v.screen) n.remove();
    for (const n of [...v.screen.children]) if (n !== v.iframe) n.remove();
    drawLoading(v);
    for (const n of [...v.device.children]) if (n !== v.body && !n.classList.contains('rig')) n.remove();

    // front glass inside the metal band
    const face = el('div', 'face');
    v.body.insertBefore(face, v.screen);
    face.style.inset = g.band + 'px';
    face.style.borderRadius = typeof g.radius === 'number' ? Math.max(2, g.radius - g.band) + 'px' : `${16 - g.band}px ${16 - g.band}px 4px 4px`;

    // side buttons, laid out on the portrait body and turned with the device
    const PW = (landscape ? h : w) + (landscape ? g.pad[0] + g.pad[2] : g.pad[1] + g.pad[3]);
    const PH = (landscape ? w : h) + (landscape ? g.pad[1] + g.pad[3] : g.pad[0] + g.pad[2]);
    for (const [side0, f, len, kind] of base.buttons || []) {
      let side = side0, at = f;
      if (landscape) {
        // a quarter turn counter-clockwise: left -> bottom, right -> top, top -> left
        if (side0 === 'L') side = 'B';
        else if (side0 === 'R') side = 'T';
        else if (side0 === 'T') { side = 'L'; at = 1 - f - len; }
      }
      const b = el('div', 'sbtn ' + (side === 'L' || side === 'R' ? 'v' : 'h') + (kind ? ' ' + kind : ''), v.body);
      const along = side === 'L' || side === 'R' ? (landscape ? PW : PH) : (landscape ? PH : PW);
      const pos = Math.round(at * along) + 'px', size = Math.max(6, Math.round(len * along)) + 'px';
      if (side === 'L') Object.assign(b.style, { left: '-3px', top: pos, height: size });
      if (side === 'R') Object.assign(b.style, { right: '-3px', top: pos, height: size });
      if (side === 'T') Object.assign(b.style, { top: '-3px', left: pos, width: size });
      if (side === 'B') Object.assign(b.style, { bottom: '-3px', left: pos, width: size });
    }

    // earpiece slit in the bezel above the screen
    if (['island', 'punch', 'cover'].includes(d.style) && d.cutout !== false) {
      const ear = el('div', 'ear', v.body);
      const gap = (g.pad[0] - g.band) / 2 + g.band - 1.5;
      if (landscape && !unfoldedBook) Object.assign(ear.style, { left: gap + 'px', top: '50%', width: '3px', height: '54px', marginTop: '-27px' });
      else Object.assign(ear.style, { top: gap + 'px', left: '50%', width: '54px', height: '3px', marginLeft: '-27px' });
    }

    if (barH) {
      const status = el('div', 'status');
      status.style.height = barH + 'px';
      if (d.style === 'island' || d.style === 'notch') {
        status.style.padding = `${Math.round(barH * 0.16)}px ${Math.round(Math.min(w, 430) * 0.09)}px 0`;
      }
      status.innerHTML = '<span class="time"></span><span class="icons"><span class="sig"><i style="height:4px"></i><i style="height:6px"></i><i style="height:8px"></i><i style="height:11px"></i></span><span class="batt"><i></i></span></span>';
      v.screen.insertBefore(status, v.iframe);
    }

    const cut = (css) => Object.assign(el('div', 'cutout', v.screen).style, css);
    const centerX = (cw) => (w - cw) / 2 + 'px';
    const centerY = (ch) => (h - ch) / 2 + 'px';
    // In an unfolded book-style foldable the inner camera sits on the right half.
    const camX = (cw) => (unfoldedBook && !landscape ? w * 0.75 - cw / 2 + 'px' : centerX(cw));
    if (d.cutout === false) {
      // under-display camera: nothing to draw
    } else if (d.style === 'island') {
      const iw = Math.min(124, w * 0.31), ih = 36;
      if (landscape && !unfoldedBook) cut({ left: '10px', top: centerY(iw), width: ih + 'px', height: iw + 'px', borderRadius: '20px' });
      else cut({ left: camX(iw), top: '11px', width: iw + 'px', height: ih + 'px', borderRadius: '20px' });
    } else if (d.style === 'notch') {
      const nw = 160, nh = 32;
      if (landscape) cut({ left: '0', top: centerY(nw), width: nh + 'px', height: nw + 'px', borderRadius: '0 20px 20px 0' });
      else cut({ left: centerX(nw), top: '0', width: nw + 'px', height: nh + 'px', borderRadius: '0 0 20px 20px' });
    } else if (d.style === 'punch' || d.style === 'cover') {
      const s = d.style === 'cover' ? 10 : 13;
      if (landscape && !unfoldedBook) cut({ left: '10px', top: centerY(s), width: s + 'px', height: s + 'px', borderRadius: '50%' });
      else cut({ left: camX(s), top: '9px', width: s + 'px', height: s + 'px', borderRadius: '50%' });
    }

    if (base.fold && !inst.folded) {
      // Fold crease: book folds along the long middle, flips across it.
      const vertical = base.fold.kind === 'book' ? !landscape : landscape;
      el('div', 'crease ' + (vertical ? 'v' : 'h'), v.screen);
    }

    if (['island', 'notch'].includes(d.style) || (d.style === 'tablet' && d.os === 'ios')) el('div', 'homebar', v.screen);
    else if (d.style === 'punch') el('div', 'homebar android', v.screen);

    if (d.style === 'classic' && !landscape) {
      el('div', 'speaker', v.body);
      el('div', 'homebtn', v.body);
    } else if (d.style === 'tablet' || d.style === 'laptop' || d.style === 'kiosk') {
      const dot = el('div', 'camdot', v.body);
      if (landscape && d.style === 'tablet') Object.assign(dot.style, { left: '7px', top: '50%', marginTop: '-4px' });
      else Object.assign(dot.style, { left: '50%', top: (d.style === 'kiosk' ? 20 : d.style === 'laptop' ? 6 : 7) + 'px', marginLeft: '-4px' });
    } else if (d.style === 'watch') {
      el('div', 'crown', v.body);
      const top = el('div', 'band top');
      v.device.insertBefore(top, v.body);
      el('div', 'band bottom', v.device);
    }
    const outerW = w + g.pad[1] + g.pad[3];
    if (d.style === 'laptop') {
      const b = el('div', 'lbase', v.device);
      b.style.width = Math.round(outerW * 1.08) + 'px';
    } else if (d.style === 'monitor') {
      el('div', 'neck', v.device);
      el('div', 'foot', v.device);
    } else if (d.style === 'tv') {
      const f = el('div', 'tvfeet', v.device);
      f.style.width = Math.round(outerW * 0.8) + 'px';
      el('i', '', f);
      el('i', '', f);
    } else if (d.style === 'kiosk') {
      el('div', 'pedestal', v.device);
      el('div', 'pfoot', v.device);
    }

    // caption
    const tags = [];
    if (state.devices.length > 1 && i === state.primary) tags.push('<span class="badge ua" title="User-Agent header comes from this device">UA</span>');
    if (base.estimate) tags.push('<span class="badge" title="Unreleased or rumoured specs">est.</span>');
    v.caption.innerHTML = `
      <button class="name" title="Change device">${escapeHtml(base.name)} ▼</button>
      ${tags.join('')}
      <span class="meta">${w}×${h - barH} @${d.dpr}x</span>
      <button class="btn fin" title="Finish: ${escapeHtml(finish.name)} (click for the next colour)"><i style="background:${finish.metal}"></i></button>
      <button class="btn rot" title="Rotate">${I('rotate')}</button>
      ${base.fold ? `<button class="btn fold ${inst.folded ? '' : 'on'}" title="Fold / unfold">${I('fold')}${inst.folded ? 'Unfold' : 'Fold'}</button>` : ''}
      ${state.devices.length > 1 && i !== state.primary ? '<button class="btn mkua" title="Use this device for the User-Agent header">UA</button>' : ''}
      ${state.devices.length > 1 ? `<button class="btn rm" title="Remove from tab">${I('close')}</button>` : ''}`;
    v.caption.querySelector('.name').onclick = () => openPicker('replace', i);
    v.caption.querySelector('.rot').onclick = () => rotateDevice(i);
    v.caption.querySelector('.fin').onclick = () => {
      inst.finish = ((inst.finish || 0) + 1) % finishes.length;
      shapeView(i);
      save({ devices: state.devices });
      toast(finish === finishes[inst.finish] ? finish.name : finishes[inst.finish].name, 1400);
    };
    const fb = v.caption.querySelector('.fold');
    if (fb) fb.onclick = () => foldDevice(i);
    const mk = v.caption.querySelector('.mkua');
    if (mk) mk.onclick = () => setPrimary(i);
    const rm = v.caption.querySelector('.rm');
    if (rm) rm.onclick = () => removeDevice(i);

    v.slot.classList.toggle('active', i === state.active && state.devices.length > 1);
    tickClock();
  }

  // ---- loading indicators ----
  // A thin bar while a device's page loads; a card with the mascot if it takes a while.
  function drawLoading(v) {
    v.screen.classList.toggle('loading', !!v.loading);
    if (!v.loading) return;
    if (!v.screen.querySelector('.loadbar')) el('div', 'loadbar', v.screen);
    if (!v.screen.querySelector('.loadcard')) {
      const c = el('div', 'loadcard', v.screen);
      c.innerHTML = `<img src="${ART('mascot')}" alt=""><span>Loading…</span>`;
    }
  }
  function setLoading(v, on) {
    if (!v) return;
    clearTimeout(v.loadTimer);
    v.loading = on;
    if (on) {
      drawLoading(v);
      v.loadTimer = setTimeout(() => setLoading(v, false), 30000); // never spin forever
    } else {
      v.screen.classList.remove('loading');
      for (const n of v.screen.querySelectorAll('.loadbar, .loadcard')) n.remove();
    }
  }
  // Status chip above a device while it folds or rotates.
  function chip(v, text) {
    let c = v.slot.querySelector('.chip');
    if (!text) return c && c.remove();
    if (!c) c = el('div', 'chip', v.slot);
    c.textContent = text;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  }

  // Rotate or fold: reshape in place and tell the page its new screen.
  function reshape(i, patch) {
    Object.assign(state.devices[i], patch);
    shapeView(i);
    const cfg = cfgFor(state.devices[i]);
    const v = views[i];
    try {
      v.iframe.contentWindow.postMessage({ msim: true, type: 'config', cfg }, '*');
    } catch {}
    return save({ devices: state.devices });
  }

  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
  // Give the page a moment to re-layout at its new size, showing the load bar meanwhile.
  async function settle(v) {
    v.screen.classList.add('relayout');
    await nextFrame();
    await new Promise((r) => setTimeout(r, 260));
    v.screen.classList.remove('relayout');
  }
  const finished = (anim) => anim.finished.catch(() => {});

  // Screen "power" overlay: the inner screen switches off while folding and back on after.
  function powerOverlay(v, from, to, ms) {
    const o = el('div', 'power', v.screen);
    return finished(o.animate([{ opacity: from }, { opacity: to }], { duration: ms, easing: 'linear', fill: 'forwards' })).then(() => o);
  }

  // Turn the device a quarter turn, then switch the layout to the new orientation.
  async function rotateDevice(i) {
    const v = views[i];
    if (v.busy) return;
    v.busy = true;
    const inst = state.devices[i];
    const deg = inst.landscape ? 90 : -90; // portrait -> landscape turns counter-clockwise
    v.body.style.willChange = 'transform';
    chip(v, 'Rotating');
    await finished(v.body.animate([{ transform: 'rotate(0deg)' }, { transform: `rotate(${deg}deg)` }],
      { duration: 480, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'forwards' }));
    v.body.getAnimations().forEach((a) => a.cancel());
    v.body.style.willChange = '';
    reshape(i, { landscape: !inst.landscape });
    layout();
    await settle(v);
    chip(v, null);
    v.busy = false;
  }

  // Fold or unfold with a 3D hinge animation. The screens go dark while the device moves,
  // like the real hardware, then the new posture appears in its place.
  async function foldDevice(i) {
    const v = views[i];
    if (v.busy) return;
    const inst = state.devices[i];
    const base = lookup(inst.id);
    if (!base.fold) return;
    v.busy = true;
    const closing = !inst.folded;
    chip(v, closing ? 'Folding' : 'Unfolding');
    const landscape = !!inst.landscape;
    const U = resolve(base, false);
    const uw = landscape ? U.h : U.w, uh = landscape ? U.w : U.h;
    const g = geometry(U, landscape);
    const W = uw + g.pad[1] + g.pad[3], H = uh + g.pad[0] + g.pad[2];
    const R = typeof g.radius === 'number' ? g.radius : 20;
    const vertical = base.fold.kind === 'book' ? !landscape : landscape; // hinge runs top to bottom
    // Where the static half sits now: the whole body when open, the closed body when folded.
    const cx = v.body.offsetLeft + v.body.offsetWidth / 2;
    const cy = v.body.offsetTop + v.body.offsetHeight / 2;
    // Offset from the rig centre to the centre of the half that stays still (left or bottom).
    const sx = vertical ? -W / 4 : 0, sy = vertical ? 0 : H / 4;
    let left, top;
    if (!closing) {
      left = cx - sx - W / 2; // the still half sits on the closed body
      top = cy - sy - H / 2;
    } else {
      left = cx - W / 2;
      top = cy - H / 2;
    }
    // Zoom the new posture will get in Fit mode, so the motion ends exactly at the final size.
    const F = resolve(base, closing);
    const fg = geometry(F, landscape);
    const fw = (landscape ? F.h : F.w) + fg.pad[1] + fg.pad[3], fh = (landscape ? F.w : F.h) + fg.pad[0] + fg.pad[2];
    const s0 = computeScale();
    const k = computeScale({ [i]: [fw, fh] }) / s0;
    // End with the still half (closing) or the whole rig (opening) centred where the device is now.
    const ox = left + W / 2, oy = top + H / 2;
    const dx = closing ? cx - ox - k * sx : cx - ox;
    const dy = closing ? cy - oy - k * sy : cy - oy;

    const rig = el('div', 'rig ' + (vertical ? 'v' : 'h'), v.device);
    Object.assign(rig.style, { left: left + 'px', top: top + 'px', width: W + 'px', height: H + 'px', '--r': R + 'px' });
    // Lighting uses opacity on a dark layer per face: cheap to composite, unlike animating filter.
    rig.innerHTML = '<div class="half"><b class="shade"></b></div><div class="flap"><div class="face front"><b class="shade"></b></div><div class="face back"><i></i><b class="shade"></b></div></div>';
    const flap = rig.querySelector('.flap');
    const front = rig.querySelector('.front');
    const back = rig.querySelector('.back');
    const axis = vertical ? 'rotateY' : 'rotateX';
    const shut = -180; // the moving half swings toward the viewer
    flap.style.transform = `${axis}(${closing ? 0 : shut}deg)`;

    // 1) screen off
    const off = await powerOverlay(v, 0, 1, 160);
    await finished(rig.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, fill: 'forwards' }));
    v.body.style.visibility = 'hidden';
    off.remove();

    // 2) swing the flap around the hinge and slide so the result ends up centred
    const ease = 'cubic-bezier(.5,.05,.25,1)';
    const dur = 760;
    const from = closing ? 0 : shut, to = closing ? shut : 0;
    const swing = flap.animate([
      { transform: `${axis}(${from}deg)` },
      { transform: `${axis}(${(from + to) / 2}deg)`, offset: 0.5 },
      { transform: `${axis}(${to}deg)` },
    ], { duration: dur, easing: ease, fill: 'forwards' });
    rig.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }], { duration: dur, easing: ease, fill: 'forwards' });
    // light: faces darken as they turn away from the viewer
    const shade = (face, a, b, c) => face.querySelector('.shade').animate(
      (closing ? [a, b, c] : [c, b, a]).map((o, n) => ({ opacity: o, offset: n / 2 })), { duration: dur, easing: ease, fill: 'forwards' });
    shade(front, 0, 0.55, 0.75);
    shade(back, 0.75, 0.5, 0);
    rig.querySelector('.half .shade').animate([{ opacity: 0 }, { opacity: 0.3, offset: 0.6 }, { opacity: 0 }], { duration: dur, easing: ease });
    await finished(swing);

    // 3) switch posture, then the new screen powers on
    // all in one frame: the rig hands over to the real device at its new zoom
    reshape(i, { folded: closing });
    const on = el('div', 'power', v.screen);
    rig.remove();
    layout();
    v.body.style.visibility = '';
    await settle(v);
    await finished(on.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-out', fill: 'forwards' }));
    on.remove();
    chip(v, null);
    v.busy = false;
  }

  function rebuildAll() {
    row.replaceChildren();
    views.length = 0;
    state.devices.forEach((_, i) => {
      views.push(createView(i));
      row.appendChild(views[i].slot);
    });
    views.forEach((_, i) => shapeView(i));
    scheduleLayout();
  }

  function refreshCaptions() {
    views.forEach((_, i) => shapeView(i));
  }

  function setActive(i) {
    if (i < 0 || i === state.active) return;
    state.active = i;
    views.forEach((v, j) => v.slot.classList.toggle('active', j === i && views.length > 1));
    setUrl(views[i].lastUrl);
    save({ active: i });
  }

  async function setPrimary(i) {
    const ua = lookup(state.devices[i].id).ua;
    await save({ primary: i, ua });
    refreshCaptions();
    reloadAll();
  }

  async function removeDevice(i) {
    state.devices.splice(i, 1);
    views[i].slot.remove();
    views.splice(i, 1);
    if (state.primary === i) state.primary = 0;
    else if (state.primary > i) state.primary--;
    state.active = Math.min(state.active, state.devices.length - 1);
    const ua = lookup(state.devices[state.primary].id).ua;
    const uaChanged = ua !== state.ua;
    await save({ devices: state.devices, primary: state.primary, active: state.active, ua });
    if (uaChanged) reloadAll();
    refreshCaptions();
    scheduleLayout();
  }

  async function addDevice(id) {
    state.devices.push({ id, landscape: false, folded: true });
    const i = state.devices.length - 1;
    views.push(createView(i));
    row.appendChild(views[i].slot);
    await save({ devices: state.devices });
    refreshCaptions();
    setActive(i);
    scheduleLayout();
  }

  async function replaceDevice(i, id) {
    state.devices[i] = { id, landscape: false, folded: true };
    const patch = { devices: state.devices };
    const uaChanged = i === state.primary && lookup(id).ua !== state.ua;
    if (i === state.primary) patch.ua = lookup(id).ua;
    await save(patch); // the header rule must change before the new viewport loads
    const old = views[i];
    views[i] = createView(i);
    old.slot.replaceWith(views[i].slot);
    if (uaChanged) reloadAll(i);
    shapeView(i);
    refreshCaptions();
    scheduleLayout();
  }

  // ---- layout ----
  let layoutQueued = false;
  function scheduleLayout() {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(() => {
      layoutQueued = false;
      layout();
    });
  }

  function computeScale(overrides = {}) {
    if (!views.length) return 1;
    const sizes = views.map((v, i) => overrides[i] || [v.device.offsetWidth, v.device.offsetHeight]);
    const gap = 40;
    let scale = Number(state.zoom);
    if (!scale) {
      const aw = stage.clientWidth - 64 - gap * (views.length - 1);
      // room for the caption plates (they wrap to two lines under narrow devices)
      const ah = stage.clientHeight - 48 - 96;
      const sumW = sizes.reduce((a, s) => a + s[0], 0);
      const maxH = Math.max(...sizes.map((s) => s[1]));
      scale = Math.min(1, aw / sumW, ah / maxH);
      // Each slot is at least as wide as its caption; shrink until the row fits.
      const MIN_SLOT = 230;
      for (let n = 0; n < 8; n++) {
        const rowW = sizes.reduce((a, s) => a + Math.max(MIN_SLOT, s[0] * scale), 0);
        if (rowW <= aw) break;
        const flexible = sizes.filter((s) => s[0] * scale > MIN_SLOT).reduce((a, s) => a + s[0], 0);
        const fixed = sizes.filter((s) => s[0] * scale <= MIN_SLOT).length * MIN_SLOT;
        if (!flexible) break;
        scale = Math.max(0.1, (aw - fixed) / flexible);
      }
    }
    return Math.max(0.1, scale);
  }

  function layout() {
    if (!views.length) return;
    const sizes = views.map((v) => [v.device.offsetWidth, v.device.offsetHeight]);
    const scale = computeScale();
    views.forEach((v, i) => {
      v.device.style.transform = `scale(${scale})`;
      v.scaler.style.width = sizes[i][0] * scale + 'px';
      v.scaler.style.height = sizes[i][1] * scale + 'px';
      v.slot.style.width = Math.max(230, sizes[i][0] * scale) + 'px';
    });
    stage.dataset.scale = String(scale);
  }

  // ---- navigation and sync ----
  function setUrl(url) {
    if (!url) return;
    currentUrl = url;
    if (root.activeElement !== urlInput) urlInput.value = url;
  }

  function onFrameLoad(v) {
    try {
      const w = v.iframe.contentWindow;
      v.lastUrl = w.location.href;
      if (views.indexOf(v) === state.active) {
        setUrl(v.lastUrl);
        document.title = '📱 ' + (w.document.title || new URL(v.lastUrl).host);
      }
    } catch {}
  }

  function navigateOthers(from, url) {
    views.forEach((v, j) => {
      if (j === from || v.lastUrl === url) return;
      v.lastUrl = url;
      v.followUntil = performance.now() + 4000;
      setLoading(v, true);
      v.iframe.src = url;
    });
  }

  window.addEventListener('message', (e) => {
    const data = e.data;
    if (!data || data.msim !== true) return;
    const from = views.findIndex((v) => v.iframe.contentWindow === e.source);
    if (from < 0) return;
    if (data.type === 'loading') {
      setLoading(views[from], true);
      return;
    }
    if (data.type === 'nav') {
      const v = views[from];
      const followed = performance.now() < v.followUntil;
      v.lastUrl = data.url;
      if (from === state.active) {
        setUrl(data.url);
        if (data.title) document.title = '📱 ' + data.title;
      }
      // A device that is only following another one must not lead (mobile/desktop redirects
      // could otherwise bounce between devices).
      if (!followed && state.sync.nav && views.length > 1) navigateOthers(from, data.url);
    } else if (data.type === 'scroll' && state.sync.scroll && views.length > 1) {
      views.forEach((v, j) => {
        if (j !== from) v.iframe.contentWindow.postMessage({ msim: true, type: 'scrollTo', rx: data.rx, ry: data.ry }, '*');
      });
    }
  });

  // Track which device has focus (clicks inside an iframe never reach the shell).
  window.addEventListener('blur', () =>
    setTimeout(() => {
      const i = views.findIndex((v) => v.iframe === root.activeElement);
      if (i >= 0) setActive(i);
    }, 0)
  );

  function reloadAll(except = -1) {
    views.forEach((v, j) => {
      if (j === except) return;
      setLoading(v, true);
      try {
        v.iframe.contentWindow.location.reload();
      } catch {
        v.iframe.src = v.lastUrl || currentUrl;
      }
    });
  }

  function go(raw) {
    let v = raw.trim();
    if (!v) return;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) {
      v = /\s/.test(v) || !v.includes('.') ? 'https://www.google.com/search?q=' + encodeURIComponent(v) : 'https://' + v;
    }
    let target;
    try {
      target = new URL(v);
    } catch {
      return toast('Invalid URL');
    }
    if (target.origin !== location.origin) {
      location.href = target.href; // the shell re-forms on the new origin
      return;
    }
    views.forEach((view) => {
      view.lastUrl = target.href;
      view.followUntil = performance.now() + 4000;
      setLoading(view, true);
      view.iframe.src = target.href;
    });
    setUrl(target.href);
  }

  // ---- clock ----
  let clockTimer = 0;
  function tickClock() {
    clearTimeout(clockTimer);
    const now = new Date();
    const text = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    for (const t of root.querySelectorAll('.time')) t.textContent = text;
    clockTimer = setTimeout(tickClock, 20000);
  }

  // ---- popovers ----
  const pops = ['.sync-pop', '.shot-pop', '.rec-pop'];
  function togglePop(sel) {
    for (const p of pops) if (p !== sel) $(p).classList.remove('show');
    $('.panel').classList.remove('show');
    $(sel).classList.toggle('show');
  }
  function closePops() {
    for (const p of pops) $(p).classList.remove('show');
  }
  root.addEventListener('pointerdown', (e) => {
    const path = e.composedPath();
    if (!path.some((n) => n.classList && (n.classList.contains('pop') || n.classList.contains('shot') || n.classList.contains('rec') || n.classList.contains('sync')))) closePops();
  });

  const pickOpt = (container) => {
    container.addEventListener('click', (e) => {
      const opt = e.target.closest('.opt');
      if (!opt) return;
      for (const o of container.querySelectorAll('.opt')) o.classList.toggle('sel', o === opt);
      updateShotRows();
    });
  };
  pickOpt($('.shot-opts'));
  pickOpt($('.rec-opts'));
  const selected = (container) => container.querySelector('.opt.sel').dataset.mode;
  function updateShotRows() {
    const mode = selected($('.shot-opts'));
    $('.shot-pop .bg-row').style.display = mode === 'background' ? '' : 'none';
    $('.shot-pop .round-row').style.display = mode === 'screen' ? '' : 'none';
    $('.shot-pop .all-row').style.display = views.length > 1 ? '' : 'none';
    const combined = $('.shot-scope option[value=combined]');
    combined.disabled = !(mode === 'frame' || mode === 'background');
    if (combined.disabled && $('.shot-scope').value === 'combined') $('.shot-scope').value = 'active';
    $('.rec-pop .all-row').style.display = views.length > 1 ? '' : 'none';
  }

  // ---- screenshots ----
  async function withCaptureView(fn) {
    closePops();
    if (!$('.toast').classList.contains('top')) $('.toast').classList.remove('show');
    const saved = state.zoom;
    const targetsVisible = () => {
      const r = row.getBoundingClientRect();
      return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
    };
    let changed = false;
    if (!targetsVisible()) {
      state.zoom = 'fit';
      layout();
      changed = true;
    }
    await cap.frames();
    try {
      return await fn();
    } finally {
      stage.classList.remove('chroma', 'capturing');
      if (changed) {
        state.zoom = saved;
        layout();
      }
    }
  }

  const stampNow = () => new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const shotName = (i, mode) => {
    const inst = state.devices[i];
    return `${inst.id}${inst.landscape ? '-landscape' : ''}${lookup(inst.id).fold ? (inst.folded ? '-folded' : '-unfolded') : ''}-${mode}`;
  };

  // One capture of view i (or of the whole row) in the given mode; returns a canvas.
  async function captureOne(mode, i, whole) {
    const v = views[i];
    if (mode === 'full') {
      stage.classList.add('capturing');
      await cap.frames();
      try {
        return await cap.fullPage(v.iframe, (p) => progress(`Full page ${Math.round(p * 100)}%`));
      } finally {
        stage.classList.remove('capturing');
      }
    }
    if (mode === 'screen') {
      stage.classList.add('capturing');
      await cap.frames();
      const { img, k } = await cap.grabTab();
      stage.classList.remove('capturing');
      let c = cap.crop(img, k, v.screen.getBoundingClientRect());
      if ($('.shot-round').checked) {
        const d = resolve(lookup(state.devices[i].id), state.devices[i].folded);
        c = cap.roundCorners(c, (d.radius || 0) * Number(stage.dataset.scale || 1) * k);
      }
      return c;
    }
    // frame / background: paint the stage green and key it out for a transparent PNG
    stage.classList.add('chroma');
    for (const x of views) x.caption.style.visibility = 'hidden';
    await cap.frames();
    const r = (whole ? row : v.device).getBoundingClientRect();
    const m = 6; // include the drawn rim and side buttons
    const rect = { left: r.left - m, top: r.top - m, width: r.width + 2 * m, height: r.height + 2 * m };
    try {
      const { img, k } = await cap.grabTab();
      let c = cap.keyOutGreen(cap.crop(img, k, rect));
      if (mode === 'background') c = cap.withBackground(c, $('.bg-color').value, k);
      return c;
    } finally {
      stage.classList.remove('chroma');
      for (const x of views) x.caption.style.visibility = '';
    }
  }

  async function screenshot() {
    const mode = selected($('.shot-opts'));
    const scope = views.length > 1 ? $('.shot-scope').value : 'active';
    const stamp = stampNow();
    try {
      await withCaptureView(async () => {
        if (scope === 'combined') {
          await cap.save(await captureOne(mode, state.active, true), `devices-${mode}-${stamp}.png`);
        } else if (scope === 'each') {
          const files = [];
          for (let i = 0; i < views.length; i++) {
            progress(`Device ${i + 1} of ${views.length}…`);
            const c = await captureOne(mode, i, false);
            files.push({ name: `${String(i + 1).padStart(2, '0')}-${shotName(i, mode)}.png`, blob: await c.convertToBlob({ type: 'image/png' }) });
            if (i < views.length - 1) await cap.sleep(550); // captureVisibleTab allows about 2 calls per second
          }
          cap.download(await cap.zip(files), `devices-${mode}-${stamp}.zip`);
        } else {
          await cap.save(await captureOne(mode, state.active, false), `${shotName(state.active, mode)}-${stamp}.png`);
        }
      });
      progress(null);
      toast(scope === 'each' ? `Saved ${views.length} screenshots (.zip)` : 'Screenshot saved!', 2400, 'mascot-camera');
    } catch (e) {
      progress(null);
      for (const x of views) x.caption.style.visibility = '';
      toast('Screenshot failed: ' + (e && e.message ? e.message : e), 4000);
    }
  }

  // ---- recording ----
  let recording = null;
  let recTimer = 0;
  async function startRecording() {
    closePops();
    const mode = selected($('.rec-opts'));
    const all = $('.rec-all').checked && views.length > 1;
    const v = views[state.active];
    progress('Waiting for screen-share permission…');
    try {
      recording = await cap.record(all ? row : v.device, {
        mic: $('.rec-mic').checked,
        camHost: mode === 'cam' ? v.body : null,
        bitrate: Number($('.rec-q').value),
      });
    } catch (e) {
      recording = null;
      progress(null);
      return toast('Recording not started: ' + (e && e.message ? e.message : e), 4000);
    }
    progress(null);
    if (!recording.cropped) toast('Cropping is not supported here, so the whole tab is recorded.', 4000);
    const t0 = Date.now();
    $('.rec-live').classList.add('show');
    $('.rec').style.display = 'none';
    const tick = () => {
      const s = Math.floor((Date.now() - t0) / 1000);
      $('.rec-time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    };
    tick();
    recTimer = setInterval(tick, 500);
    const inst = state.devices[state.active];
    const ext = recording.ext;
    recording.done.then((blob) => {
      clearInterval(recTimer);
      $('.rec-live').classList.remove('show');
      $('.rec').style.display = '';
      const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      cap.download(blob, `${all ? 'devices' : inst.id}-recording-${stamp}.${ext}`);
      toast('Recording saved!', 2400, 'mascot-rec');
      recording = null;
    });
  }

  // ---- device picker ----
  let pickerMode = { kind: 'replace', index: 0 };
  function openPicker(kind, index = 0) {
    closePops();
    pickerMode = { kind, index };
    $('.panel .mode').textContent = kind === 'add' ? 'Add a device next to the others' : `Replace: ${lookup(state.devices[index].id).name}`;
    $('.search').value = '';
    renderPicker();
    $('.panel').classList.add('show');
    $('.search').focus();
  }

  function renderPicker() {
    const q = $('.search').value.trim().toLowerCase();
    const list = $('.panel .list');
    list.replaceChildren();
    const curId = pickerMode.kind === 'replace' ? state.devices[pickerMode.index].id : null;
    for (const c of CAT) {
      const items = allDevices().filter((d) => d.cat === c.id && (!q || d.name.toLowerCase().includes(q)));
      if (!items.length && (c.id !== 'custom' || q)) continue;
      el('h3', '', list).textContent = c.label;
      const grid = el('div', 'grid', list);
      for (const d of items) {
        const card = el('div', 'card' + (d.id === curId ? ' cur' : ''), grid);
        card.innerHTML = `<img class="thumb" src="${ART(thumbFor(d))}" alt="" loading="lazy" decoding="async"><span>${escapeHtml(d.name)}</span>`;
        if (d.fold) el('span', 'tag', card).textContent = 'fold';
        else if (d.estimate) el('span', 'tag', card).textContent = 'est.';
        if (d.cat === 'custom') {
          const del = el('button', 'del', card);
          del.textContent = '×';
          del.title = 'Delete custom device';
          del.onclick = async (e) => {
            e.stopPropagation();
            if (state.devices.some((x) => x.id === d.id)) return toast('Remove it from the tab first');
            customs = customs.filter((x) => x.id !== d.id);
            await chrome.storage.local.set({ customDevices: customs });
            renderPicker();
          };
        }
        card.onclick = () => pick(d.id);
      }
      if (c.id === 'custom') {
        const add = el('div', 'card add', grid);
        add.textContent = '+';
        add.title = 'New custom device';
        const form = el('div', 'form', list);
        form.innerHTML = `
          <label class="wide">Name<input class="f-name" placeholder="My device"></label>
          <label>Width (CSS px)<input class="f-w" type="number" min="100" max="4000" value="390"></label>
          <label>Height (CSS px)<input class="f-h" type="number" min="100" max="4000" value="844"></label>
          <label>Pixel ratio<input class="f-dpr" type="number" min="1" max="5" step="0.125" value="3"></label>
          <label>Behaves like<select class="f-preset">${Object.entries(self.MSIM_PRESETS).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join('')}</select></label>
          <label class="wide">User-Agent (optional, overrides the preset)<input class="f-ua" placeholder="leave empty to use the preset"></label>
          <div class="actions"><button class="btn f-cancel">Cancel</button><button class="btn primary f-save">Save</button></div>`;
        add.onclick = () => form.classList.add('show');
        form.querySelector('.f-cancel').onclick = () => form.classList.remove('show');
        form.querySelector('.f-save').onclick = async () => {
          const val = (s) => form.querySelector(s).value.trim();
          const w = Math.round(Number(val('.f-w'))), h = Math.round(Number(val('.f-h'))), dpr = Number(val('.f-dpr'));
          if (!(w >= 100 && w <= 4000 && h >= 100 && h <= 4000 && dpr >= 1 && dpr <= 5)) return toast('Check the size and pixel ratio');
          const preset = self.MSIM_PRESETS[val('.f-preset')];
          const { label, ...identity } = preset;
          const dev = { ...identity, cat: 'custom', id: 'custom-' + Date.now(), name: val('.f-name') || `Custom ${w}×${h}`, w, h, dpr };
          if (val('.f-ua')) dev.ua = val('.f-ua');
          customs = [...customs, dev];
          await chrome.storage.local.set({ customDevices: customs });
          toast('Custom device saved');
          renderPicker();
        };
      }
    }
  }

  async function pick(id) {
    $('.panel').classList.remove('show');
    if (pickerMode.kind === 'add') await addDevice(id);
    else await replaceDevice(pickerMode.index, id);
    updateShotRows();
  }

  // ---- wire up ----
  $('.add').onclick = () => openPicker('add');
  $('.close-panel').onclick = () => $('.panel').classList.remove('show');
  $('.search').addEventListener('input', renderPicker);
  $('.sync').onclick = () => togglePop('.sync-pop');
  $('.shot').onclick = () => {
    updateShotRows();
    togglePop('.shot-pop');
  };
  $('.rec').onclick = () => {
    updateShotRows();
    togglePop('.rec-pop');
  };
  $('.shot-go').onclick = screenshot;
  $('.rec-go').onclick = startRecording;
  $('.rec-stop').onclick = () => recording && recording.stop();
  $('.sync-scroll').checked = !!state.sync.scroll;
  $('.sync-nav').checked = !!state.sync.nav;
  $('.sync-scroll').onchange = (e) => save({ sync: { ...state.sync, scroll: e.target.checked } });
  $('.sync-nav').onchange = (e) => save({ sync: { ...state.sync, nav: e.target.checked } });
  zoomSel.value = String(state.zoom || 'fit');
  zoomSel.onchange = () => {
    state.zoom = zoomSel.value;
    layout();
    save({ zoom: zoomSel.value });
  };
  $('.back').onclick = () => {
    try {
      views[state.active].iframe.contentWindow.history.back();
    } catch {}
  };
  $('.reload').onclick = () => reloadAll();
  urlInput.addEventListener('keydown', (e) => e.key === 'Enter' && go(urlInput.value));
  urlInput.addEventListener('focus', () => urlInput.select());
  $('.exit').onclick = () => send({ type: 'exit' });
  window.addEventListener('resize', scheduleLayout);
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePops();
      $('.panel').classList.remove('show');
    }
  });

  setUrl(currentUrl);
  rebuildAll();
  updateShotRows();
  const staleTimer = setInterval(() => {
    if (!alive()) {
      clearInterval(staleTimer);
      showStale();
    }
  }, 2000);
})();
