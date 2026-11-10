// Device catalogue. Sizes are CSS px in the device's natural orientation, from published
// resolutions divided by the pixel ratio. Devices marked `estimate` are unreleased or rumoured.
//
// style: island | notch | classic | punch | tablet | watch | laptop | monitor | tv | kiosk
// bar:   status bar height (px), taken out of the viewport in portrait
// fold:  { kind: 'book' | 'flip', folded: {w,h,style,radius,bar}, unfolded: {w,h,style,radius,bar} }
(() => {
  const UA = {
    ios18: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
    // Safari 26 freezes the OS version in the UA at 18_6.
    ios26: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
    macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
    android: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
    androidTablet: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    tizen: 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 8.0) AppleWebKit/537.36 (KHTML, like Gecko) 120.0.6099.5/8.0 TV Safari/537.36',
  };

  const ios = { os: 'ios', ua: UA.ios18, platform: 'iPhone', vendor: 'Apple Computer, Inc.', touch: true };
  const ios26 = { ...ios, ua: UA.ios26 };
  // iPadOS Safari requests desktop sites by default and reports itself as a Mac with touch.
  const ipad = { os: 'ios', ua: UA.macSafari, platform: 'MacIntel', vendor: 'Apple Computer, Inc.', touch: true };
  const android = { os: 'android', ua: UA.android, platform: 'Linux armv81', vendor: 'Google Inc.', touch: true };
  const androidTab = { ...android, ua: UA.androidTablet };
  const mac = { os: 'mac', ua: UA.macSafari, platform: 'MacIntel', vendor: 'Apple Computer, Inc.', touch: false };
  const win = { os: 'windows', ua: UA.windows, platform: 'Win32', vendor: 'Google Inc.', touch: false };
  const tv = { os: 'tv', ua: UA.tizen, platform: 'Linux armv7l', vendor: 'Google Inc.', touch: false };

  const phone = (cat, id, name, w, h, dpr, style, radius, bar, base, extra = {}) =>
    ({ cat, id, name, w, h, dpr, style, radius, bar, ...base, ...extra });

  self.MSIM_CATEGORIES = [
    { id: 'apple', label: 'Apple phones' },
    { id: 'android', label: 'Android phones' },
    { id: 'fold', label: 'Foldables' },
    { id: 'tablet', label: 'Tablets' },
    { id: 'special', label: 'Watch, laptops & screens' },
    { id: 'custom', label: 'My custom devices' },
  ];

  self.MSIM_DEVICES = [
    // Apple phones
    phone('apple', 'iphone-se', 'iPhone SE', 375, 667, 2, 'classic', 0, 20, ios),
    phone('apple', 'iphone-13-mini', 'iPhone 13 mini', 375, 812, 3, 'notch', 44, 47, ios),
    phone('apple', 'iphone-14', 'iPhone 14', 390, 844, 3, 'notch', 47, 47, ios),
    phone('apple', 'iphone-14-plus', 'iPhone 14 Plus', 428, 926, 3, 'notch', 53, 47, ios),
    phone('apple', 'iphone-15', 'iPhone 15', 393, 852, 3, 'island', 55, 54, ios),
    phone('apple', 'iphone-15-plus', 'iPhone 15 Plus', 430, 932, 3, 'island', 55, 54, ios),
    phone('apple', 'iphone-16e', 'iPhone 16e', 390, 844, 3, 'notch', 47, 47, ios),
    phone('apple', 'iphone-16-pro', 'iPhone 16 Pro', 402, 874, 3, 'island', 58, 54, ios),
    phone('apple', 'iphone-16-pro-max', 'iPhone 16 Pro Max', 440, 956, 3, 'island', 62, 54, ios),
    phone('apple', 'iphone-17', 'iPhone 17 (iOS 26)', 402, 874, 3, 'island', 58, 54, ios26),
    phone('apple', 'iphone-air', 'iPhone Air (iOS 26)', 420, 912, 3, 'island', 60, 54, ios26),
    phone('apple', 'iphone-17-pro', 'iPhone 17 Pro (iOS 26)', 402, 874, 3, 'island', 58, 54, ios26),
    phone('apple', 'iphone-17-pro-max', 'iPhone 17 Pro Max (iOS 26)', 440, 956, 3, 'island', 62, 54, ios26),

    // Android phones
    phone('android', 'pixel-8', 'Pixel 8', 412, 915, 2.625, 'punch', 38, 30, android),
    phone('android', 'pixel-9', 'Pixel 9', 412, 923, 2.625, 'punch', 40, 30, android),
    phone('android', 'pixel-10-pro', 'Pixel 10 Pro', 410, 914, 3.125, 'punch', 40, 30, android),
    phone('android', 'galaxy-s24', 'Galaxy S24', 360, 780, 3, 'punch', 34, 28, android),
    phone('android', 'galaxy-s24-ultra', 'Galaxy S24 Ultra', 384, 824, 3.75, 'punch', 14, 28, android),
    phone('android', 'galaxy-s25-ultra', 'Galaxy S25 Ultra', 412, 891, 3.5, 'punch', 26, 28, android),
    phone('android', 'galaxy-a55', 'Galaxy A55', 384, 832, 2.8125, 'punch', 32, 28, android),
    phone('android', 'redmi-note-13', 'Redmi Note 13', 393, 873, 2.75, 'punch', 32, 28, android),

    // Foldables: one device, two postures. Start folded.
    // CSS sizes = panel pixels / pixel ratio. Samsung does not publish its density setting, so the ratio
    // is set from each panel's ppi (420 ppi -> 2.625) to keep both screens at the same physical scale.
    {
      // 2026 wide model. Closed 81.9 x 123.9 mm, open 161.4 x 123.9 mm.
      // cover 5.5" 1248x1972 @428 ppi, inner 7.6" 2448x1848 (4:3, wider than tall) @403 ppi
      cat: 'fold', id: 'galaxy-z-fold8', name: 'Galaxy Z Fold8', dpr: 2.625, ...android,
      fold: {
        kind: 'book',
        folded: { w: 475, h: 751, dpr: 2.625, style: 'punch', radius: 34, bar: 28 },
        unfolded: { w: 989, h: 747, dpr: 2.475, style: 'punch', radius: 28, bar: 28 },
      },
    },
    {
      // Closed 72.8 x 158.4 mm, open 143.2 x 158.4 mm.
      // cover 6.5" 1080x2520 @422 ppi, inner 8.0" 2256x2504 @422 ppi
      cat: 'fold', id: 'galaxy-z-fold8-ultra', name: 'Galaxy Z Fold8 Ultra', dpr: 2.625, ...android,
      fold: {
        kind: 'book',
        folded: { w: 411, h: 960, dpr: 2.625, style: 'punch', radius: 30, bar: 28 },
        unfolded: { w: 859, h: 954, dpr: 2.625, style: 'punch', radius: 26, bar: 28 },
      },
    },
    {
      // Closed 72.8 x 158.4 mm, open 143.2 x 158.4 mm.
      // cover 6.5" 1080x2520 @422 ppi, inner 8.0" 1968x2184 @368 ppi
      cat: 'fold', id: 'galaxy-z-fold7', name: 'Galaxy Z Fold7', dpr: 2.625, ...android,
      fold: {
        kind: 'book',
        folded: { w: 411, h: 960, dpr: 2.625, style: 'punch', radius: 30, bar: 28 },
        unfolded: { w: 860, h: 954, dpr: 2.289, style: 'punch', radius: 26, bar: 28 },
      },
    },
    {
      cat: 'fold', id: 'galaxy-z-flip7', name: 'Galaxy Z Flip7', dpr: 2.625, ...android,
      fold: {
        kind: 'flip',
        // the cover fills the top half of the closed phone
        folded: { w: 412, h: 455, dpr: 2.3, style: 'cover', radius: 44, bar: 24 },
        unfolded: { w: 411, h: 960, dpr: 2.625, style: 'punch', radius: 32, bar: 28 },
      },
    },
    {
      cat: 'fold', id: 'pixel-10-pro-fold', name: 'Pixel 10 Pro Fold', dpr: 2.625, ...android,
      fold: {
        kind: 'book',
        // cover 1080x2364, inner 2076x2152; same physical height
        folded: { w: 411, h: 900, dpr: 2.625, style: 'punch', radius: 30, bar: 30 },
        unfolded: { w: 894, h: 926, dpr: 2.32, style: 'punch', radius: 24, bar: 30 },
      },
    },
    {
      // Apple spec sheet: closed 84.1 x 117.8 mm, open 164.6 x 117.8 mm (book fold, opens into a landscape screen).
      // outer 5.4" 1398x2034 @460 ppi, inner 7.6" 2670x1878 @430 ppi, both @3x on iOS.
      // The inner screen has an under-display camera, so no cut-out.
      cat: 'fold', id: 'iphone-duo', name: 'iPhone Duo', dpr: 3, ...ios26,
      fold: {
        kind: 'book',
        folded: { w: 466, h: 678, dpr: 3, style: 'island', radius: 48, bar: 54 },
        unfolded: { w: 890, h: 626, dpr: 3, style: 'island', cutout: false, radius: 40, bar: 30 },
      },
    },

    // Tablets
    phone('tablet', 'ipad-mini', 'iPad mini', 744, 1133, 2, 'tablet', 22, 24, ipad),
    phone('tablet', 'ipad-air-11', 'iPad Air 11"', 820, 1180, 2, 'tablet', 22, 24, ipad),
    phone('tablet', 'ipad-pro-11', 'iPad Pro 11"', 834, 1210, 2, 'tablet', 22, 24, ipad),
    phone('tablet', 'ipad-pro-13', 'iPad Pro 13"', 1032, 1376, 2, 'tablet', 22, 24, ipad),
    phone('tablet', 'galaxy-tab-s9', 'Galaxy Tab S9', 800, 1280, 2, 'tablet', 18, 28, androidTab),

    // Watch, laptops and screens
    phone('special', 'apple-watch', 'Apple Watch 46mm', 208, 248, 2, 'watch', 48, 0, ios),
    phone('special', 'macbook-air-13', 'MacBook Air 13"', 1470, 956, 2, 'laptop', 12, 0, mac),
    phone('special', 'macbook-pro-16', 'MacBook Pro 16"', 1728, 1117, 2, 'laptop', 12, 0, mac),
    phone('special', 'laptop-hd', 'Windows laptop HD', 1366, 768, 1, 'laptop', 6, 0, win),
    phone('special', 'monitor-fhd', 'Desktop monitor 1080p', 1920, 1080, 1, 'monitor', 6, 0, win),
    phone('special', 'tv-4k', 'Smart TV 4K', 1920, 1080, 2, 'tv', 4, 0, tv),
    phone('special', 'kiosk', 'Self-service kiosk', 1080, 1920, 1, 'kiosk', 8, 0, { ...androidTab, touch: true }),
    // Free size: drag the edges or type a size; identity switches between mobile and desktop.
    { cat: 'special', id: 'responsive', name: 'Responsive (free size)', responsive: true, w: 390, h: 844, dpr: 2,
      style: 'responsive', radius: 0, bar: 0, ...android },
  ];

  // ---- finishes (body metal colour, front glass colour) and side-button layouts ----
  const F = (name, metal, front = '#050506') => ({ name, metal, front });
  const FIN = {
    proTitanium: [F('Natural Titanium', '#bdb8ae'), F('Desert Titanium', '#c4a78d'), F('Black Titanium', '#3d3c3a'), F('White Titanium', '#e2e0db')],
    pro17: [F('Cosmic Orange', '#d8733a'), F('Deep Blue', '#34405c'), F('Silver', '#d9d9d6')],
    alu: [F('Black', '#2c2d30'), F('Ultramarine', '#5868c4'), F('Pink', '#e8c5cd'), F('White', '#e7e3db'), F('Teal', '#8fbdb6')],
    air: [F('Space Black', '#2a2b2e'), F('Cloud White', '#e9e8e4'), F('Sky Blue', '#b9cfe2'), F('Light Gold', '#e4d3b3')],
    se: [F('Midnight', '#26282c'), F('Starlight', '#e6e0d3', '#f4f2ee'), F('Red', '#b3202a')],
    pixel: [F('Obsidian', '#2c2d30'), F('Porcelain', '#e9e4dc'), F('Hazel', '#8f9a87'), F('Rose', '#e3b9b4')],
    galaxy: [F('Titanium Gray', '#7c7d80'), F('Titanium Black', '#2a2b2d'), F('Titanium Silverblue', '#aab7c7'), F('Titanium Violet', '#9b8fb4')],
    galaxyA: [F('Awesome Navy', '#2f3a52'), F('Awesome Iceblue', '#bcd3e6'), F('Awesome Lilac', '#c9b8de')],
    redmi: [F('Midnight Black', '#26272a'), F('Mint Green', '#bfe0cf'), F('Ocean Sunset', '#d9a6a0')],
    fold: [F('Silver Shadow', '#a3a7ac'), F('Blue Shadow', '#34415c'), F('Jet Black', '#1f2022')],
    flip: [F('Blue Shadow', '#34415c'), F('Coral Red', '#d9675a'), F('Jet Black', '#1f2022')],
    ipad: [F('Space Gray', '#5f6166'), F('Silver', '#d6d7da'), F('Blue', '#8fa7c4'), F('Purple', '#b8a9cc')],
    tab: [F('Graphite', '#55575b'), F('Beige', '#d8cfc2')],
    watch: [F('Jet Black', '#1d1e20'), F('Silver', '#d5d6d8'), F('Rose Gold', '#e2bfb0')],
    mac: [F('Midnight', '#2e3440'), F('Silver', '#cfd0d3'), F('Space Gray', '#7d7e82'), F('Starlight', '#e3dccf')],
    dark: [F('Black', '#2b2c2f'), F('Silver', '#bfc1c5')],
    kiosk: [F('White', '#e6e7e9', '#0b0c0f'), F('Black', '#2a2b2e')],
  };
  // [side, start, length] in fractions of the portrait body: L/R along the height, T along the width.
  const BTN = {
    iphoneCam: [['L', .19, .045, 'action'], ['L', .265, .085], ['L', .37, .085], ['R', .285, .125], ['R', .62, .075, 'cam']],
    iphoneAction: [['L', .19, .045, 'action'], ['L', .265, .085], ['L', .37, .085], ['R', .285, .125]],
    iphoneRing: [['L', .19, .035, 'ring'], ['L', .265, .085], ['L', .37, .085], ['R', .285, .125]],
    se: [['L', .15, .035, 'ring'], ['L', .225, .07], ['L', .31, .07], ['R', .19, .08]],
    pixel: [['R', .24, .07], ['R', .34, .14]],
    samsung: [['R', .27, .13], ['R', .43, .07]],
    fold: [['R', .3, .12], ['R', .45, .08]],
    flip: [['R', .36, .1], ['R', .47, .06]],
    // Apple lists volume, Camera Control and a side button with Touch ID; positions here are approximate.
    duo: [['L', .22, .11], ['L', .36, .11], ['R', .2, .15, 'touchid'], ['R', .58, .1, 'cam']],
    ipad: [['T', .82, .08], ['R', .09, .06], ['R', .16, .06]],
    tab: [['R', .1, .06], ['R', .18, .1]],
    watch: [['R', .58, .16, 'flat']],
  };
  const LOOK = {
    'iphone-se': ['se', 'se'], 'iphone-13-mini': ['alu', 'iphoneRing'], 'iphone-14': ['alu', 'iphoneRing'], 'iphone-14-plus': ['alu', 'iphoneRing'],
    'iphone-15': ['alu', 'iphoneRing'], 'iphone-15-plus': ['alu', 'iphoneRing'], 'iphone-16e': ['alu', 'iphoneAction'],
    'iphone-16-pro': ['proTitanium', 'iphoneCam'], 'iphone-16-pro-max': ['proTitanium', 'iphoneCam'], 'iphone-17': ['alu', 'iphoneCam'],
    'iphone-air': ['air', 'iphoneCam'], 'iphone-17-pro': ['pro17', 'iphoneCam'], 'iphone-17-pro-max': ['pro17', 'iphoneCam'],
    'pixel-8': ['pixel', 'pixel'], 'pixel-9': ['pixel', 'pixel'], 'pixel-10-pro': ['pixel', 'pixel'],
    'galaxy-s24': ['galaxy', 'samsung'], 'galaxy-s24-ultra': ['galaxy', 'samsung'], 'galaxy-s25-ultra': ['galaxy', 'samsung'],
    'galaxy-a55': ['galaxyA', 'samsung'], 'redmi-note-13': ['redmi', 'pixel'],
    'galaxy-z-fold8': ['fold', 'fold'], 'galaxy-z-fold8-ultra': ['fold', 'fold'], 'galaxy-z-fold7': ['fold', 'fold'], 'galaxy-z-flip7': ['flip', 'flip'], 'pixel-10-pro-fold': ['pixel', 'pixel'], 'iphone-duo': ['pro17', 'duo'],
    'ipad-mini': ['ipad', 'ipad'], 'ipad-air-11': ['ipad', 'ipad'], 'ipad-pro-11': ['ipad', 'ipad'], 'ipad-pro-13': ['ipad', 'ipad'],
    'galaxy-tab-s9': ['tab', 'tab'], 'apple-watch': ['watch', 'watch'], 'macbook-air-13': ['mac', null], 'macbook-pro-16': ['mac', null],
    'laptop-hd': ['dark', null], 'monitor-fhd': ['dark', null], 'tv-4k': ['dark', null], 'kiosk': ['kiosk', null], 'responsive': ['dark', null],
  };
  for (const d of self.MSIM_DEVICES) {
    const [fin, btn] = LOOK[d.id] || ['dark', null];
    d.finishes = FIN[fin];
    d.buttons = btn ? BTN[btn] : [];
  }
  self.MSIM_FINISHES = FIN;
  self.MSIM_BUTTONS = BTN;

  self.MSIM_DEFAULT_DEVICE = 'iphone-16-pro';

  // Identity presets offered when creating a custom device.
  self.MSIM_PRESETS = {
    ios: { label: 'iPhone (Safari)', style: 'island', radius: 50, bar: 54, finishes: FIN.alu, buttons: BTN.iphoneAction, ...ios },
    android: { label: 'Android phone (Chrome)', style: 'punch', radius: 32, bar: 28, finishes: FIN.pixel, buttons: BTN.pixel, ...android },
    tablet: { label: 'Tablet (Android)', style: 'tablet', radius: 18, bar: 28, finishes: FIN.tab, buttons: BTN.tab, ...androidTab },
    ipad: { label: 'iPad (Safari)', style: 'tablet', radius: 22, bar: 24, finishes: FIN.ipad, buttons: BTN.ipad, ...ipad },
    desktop: { label: 'Desktop (Windows Chrome)', style: 'monitor', radius: 6, bar: 0, finishes: FIN.dark, buttons: [], ...win },
  };

  // Resolve a device in its current posture: returns the flat shape the shell renders.
  self.MSIM_resolve = (dev, folded) => {
    if (!dev.fold) return dev;
    const p = folded ? dev.fold.folded : dev.fold.unfolded;
    return { ...dev, ...p, posture: folded ? 'folded' : 'unfolded' };
  };
})();
