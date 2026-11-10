// Shell UI stylesheet: four-shade green handheld-LCD look with pixel borders and pixel fonts.
// Device frames themselves stay realistic so screenshots look like the real hardware.
self.MSIM_CSS = `
:host {
  all: initial;
  --g0: #0f380f;  /* darkest */
  --g1: #306230;
  --g2: #8bac0f;
  --g3: #9bbc0f;  /* lightest */
  --ink: #0f380f;
  --bg: #0b1f0b;
  --px: 3px;
  --pixel: "MSIM Press", "Thonburi", "Noto Sans Thai", "Leelawadee UI", ui-monospace, monospace;
  --term: "MSIM VT", "Thonburi", "Noto Sans Thai", "Leelawadee UI", ui-monospace, monospace;
}
* { box-sizing: border-box; }
button, input, select { font: inherit; color: inherit; }
.ico { display: block; flex: none; }

/* pixel border: square notched corners drawn with hard shadows */
.px, .btn, .bar select, .bar input, .pop, .card, .form input, .form select, .row2 select, .panel .head input, .toast {
  border: 0; border-radius: 0;
  box-shadow:
    0 calc(-1 * var(--px)) 0 0 var(--g0), 0 var(--px) 0 0 var(--g0),
    calc(-1 * var(--px)) 0 0 0 var(--g0), var(--px) 0 0 0 var(--g0);
}

.app { position: absolute; inset: 0; display: flex; flex-direction: column; color: var(--g3);
  background-color: var(--bg);
  background-image: radial-gradient(rgba(139,172,15,.10) 1px, transparent 1.2px);
  background-size: 12px 12px;
  font: 20px/1 var(--term); -webkit-font-smoothing: none; }

/* pixel landscape along the bottom, behind the devices */
.scene { position: absolute; left: 0; right: 0; bottom: 0; height: 183px; z-index: 0; pointer-events: none;
  background-repeat: repeat-x; background-size: 960px 183px; background-position: 0 100%; image-rendering: pixelated; opacity: .85; }
.bar, .stage { position: relative; z-index: 1; }

/* toolbar: an LCD strip */
.bar { display: flex; gap: 10px; align-items: center; padding: 10px 14px; background: var(--g3); color: var(--ink);
  border-bottom: 4px solid var(--g0); position: relative; z-index: 5; }
.bar .grp { display: flex; gap: 10px; align-items: center; }
.logo { display: flex; align-items: center; gap: 8px; font: 10px/1 var(--pixel); letter-spacing: 1px; color: var(--g0); white-space: nowrap; padding-right: 6px; }
.logo .mascot { width: 47px; height: 50px; margin: -12px 0 -14px; image-rendering: pixelated; animation: bob 1.2s steps(2) infinite; }
@keyframes bob { 50% { transform: translateY(-2px); } }
.bar .sep { width: 4px; height: 24px; background: var(--g1); margin: 0 2px; }

.btn { cursor: pointer; height: 30px; min-width: 30px; padding: 0 10px; margin: var(--px);
  display: inline-flex; align-items: center; justify-content: center; gap: 7px; white-space: nowrap;
  background: var(--g2); color: var(--ink); font: 9px/1 var(--pixel); text-transform: uppercase;
  box-shadow:
    0 calc(-1 * var(--px)) 0 0 var(--g0), 0 var(--px) 0 0 var(--g0),
    calc(-1 * var(--px)) 0 0 0 var(--g0), var(--px) 0 0 0 var(--g0),
    inset calc(-1 * var(--px)) calc(-1 * var(--px)) 0 0 var(--g1), inset var(--px) var(--px) 0 0 #c5dc5a; }
.btn:hover { background: #a9cc1f; }
.btn:active { transform: translateY(2px);
  box-shadow:
    0 calc(-1 * var(--px)) 0 0 var(--g0), 0 var(--px) 0 0 var(--g0),
    calc(-1 * var(--px)) 0 0 0 var(--g0), var(--px) 0 0 0 var(--g0),
    inset var(--px) var(--px) 0 0 var(--g1); }
.btn.on, .btn.primary { background: var(--g0); color: var(--g3);
  box-shadow:
    0 calc(-1 * var(--px)) 0 0 var(--g0), 0 var(--px) 0 0 var(--g0),
    calc(-1 * var(--px)) 0 0 0 var(--g0), var(--px) 0 0 0 var(--g0),
    inset calc(-1 * var(--px)) calc(-1 * var(--px)) 0 0 #061a06, inset var(--px) var(--px) 0 0 var(--g1); }
.btn.on:hover, .btn.primary:hover { background: #1a4a1a; }
.btn.danger { background: var(--g1); color: var(--g3); }
.btn.danger:hover { background: #3c7a3c; }

.bar select, .bar input { height: 30px; margin: var(--px); padding: 0 10px; background: #c9de6a; color: var(--ink);
  font: 20px/1 var(--term); }
.bar select { appearance: none; padding-right: 26px; cursor: pointer;
  background-image: linear-gradient(45deg, transparent 50%, var(--g0) 50%), linear-gradient(-45deg, transparent 50%, var(--g0) 50%);
  background-size: 6px 6px; background-repeat: no-repeat; background-position: calc(100% - 15px) 13px, calc(100% - 9px) 13px; }
.bar input.url { flex: 1; min-width: 120px; caret-color: var(--g0); }
.bar input.url::selection { background: var(--g0); color: var(--g3); }
.bar input:focus, .bar select:focus { outline: none; background-color: #dcef8a; }

.rec-live { display: none; align-items: center; gap: 10px; padding: 0 4px 0 12px; height: 30px; margin: var(--px); background: var(--g0); color: var(--g3); font: 9px/1 var(--pixel); }
.rec-live.show { display: inline-flex; }
.rec-live .dot { width: 10px; height: 10px; background: var(--g3); animation: blink 1s steps(1) infinite; }
.rec-live .btn { height: 24px; margin: 3px; }
@keyframes blink { 50% { opacity: 0; } }

/* stage and devices (devices stay realistic) */
.stage { flex: 1; overflow: auto; display: grid; place-items: center; padding: 24px; position: relative; }
.stage.chroma { background: #00ff00 !important; }
.row { display: flex; gap: 40px; align-items: center; }
.slot { display: flex; flex: none; flex-direction: column; align-items: center; gap: 14px; }
.scaler { position: relative; flex: none; }
.device { position: absolute; top: 0; left: 0; transform-origin: 0 0; display: flex; flex-direction: column; align-items: center; }
/* device body: brushed metal band with edge highlights; --metal comes from the chosen finish */
.device { --metal: #2c2d30; --front: #050506;
  --m-hi: color-mix(in srgb, var(--metal) 52%, white); --m-lo: color-mix(in srgb, var(--metal) 68%, black); }
.body { position: relative; flex: none;
  background:
    linear-gradient(90deg, rgba(0,0,0,.30), rgba(255,255,255,.26) 1.4%, rgba(255,255,255,0) 4.5%, rgba(255,255,255,0) 95.5%, rgba(255,255,255,.22) 98.6%, rgba(0,0,0,.32)),
    linear-gradient(180deg, rgba(0,0,0,.25), rgba(255,255,255,.24) 1%, rgba(255,255,255,0) 3.5%, rgba(255,255,255,0) 96.5%, rgba(255,255,255,.16) 99%, rgba(0,0,0,.3)),
    linear-gradient(135deg, var(--m-hi), var(--metal) 32%, var(--m-lo) 60%, var(--metal) 80%, var(--m-hi));
  box-shadow: 0 0 0 1px rgba(0,0,0,.6), inset 0 0 0 1px rgba(255,255,255,.3), inset 0 0 0 2px rgba(0,0,0,.18), 0 28px 60px rgba(0,0,0,.6), 0 6px 14px rgba(0,0,0,.4); }
.stage.chroma .body { box-shadow: 0 0 0 1px rgba(0,0,0,.6), inset 0 0 0 1px rgba(255,255,255,.3), inset 0 0 0 2px rgba(0,0,0,.18); }
/* front glass between the band and the screen, with a faint diagonal reflection */
.face { position: absolute; z-index: 0; background: var(--front); overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.06), inset 0 0 6px rgba(0,0,0,.8); }
.face::after { content: ""; position: absolute; inset: 0;
  background: linear-gradient(125deg, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 22%, rgba(255,255,255,0) 70%, rgba(255,255,255,.05) 100%); }
.screen { z-index: 1; }
/* side buttons stick out 3px from the band */
.sbtn { position: absolute; z-index: 0; border-radius: 2px; }
.sbtn.v { width: 4px; background: linear-gradient(90deg, var(--m-lo), var(--m-hi) 45%, var(--metal) 60%, var(--m-lo)); }
.sbtn.h { height: 4px; background: linear-gradient(180deg, var(--m-lo), var(--m-hi) 45%, var(--metal) 60%, var(--m-lo)); }
.sbtn.ring, .sbtn.action { border-radius: 3px; }
.sbtn.cam { background: linear-gradient(90deg, #111214, #3a3c41 50%, #111214); box-shadow: 0 0 0 1px var(--m-lo); }
.sbtn.touchid { box-shadow: inset 0 0 0 1px rgba(255,255,255,.35); }
.sbtn.flat { width: 3px; }
.ear { position: absolute; z-index: 2; border-radius: 2px; background: linear-gradient(#0e0f11, #26282c); box-shadow: 0 0 0 1px rgba(255,255,255,.04); }
.screen { position: relative; overflow: hidden; background: #fff; display: flex; flex-direction: column;
}
.status { flex: none; display: flex; align-items: center; justify-content: space-between; padding: 0 22px;
  background: #fff; color: #000; font: 600 14px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
.status .icons { display: flex; gap: 6px; align-items: center; }
.sig { display: flex; gap: 2px; align-items: flex-end; height: 11px; }
.sig i { width: 3px; background: currentColor; border-radius: 1px; }
.batt { width: 24px; height: 12px; border: 1.5px solid currentColor; border-radius: 4px; padding: 1.5px; opacity: .9; }
.batt i { display: block; height: 100%; width: 75%; background: currentColor; border-radius: 1.5px; }
iframe { flex: 1; width: 100%; min-height: 0; border: 0; background: #fff; display: block; }
.homebar { position: absolute; left: 50%; bottom: 7px; width: 134px; height: 5px; margin-left: -67px; border-radius: 3px;
  background: rgba(0,0,0,.7); pointer-events: none; z-index: 3; }
.homebar.android { width: 108px; margin-left: -54px; height: 4px; background: rgba(0,0,0,.45); }
.cutout { position: absolute; background: #000; pointer-events: none; z-index: 4; }
.crease { position: absolute; pointer-events: none; z-index: 3; }
.crease.v { top: 0; bottom: 0; left: 50%; width: 24px; margin-left: -12px;
  background: linear-gradient(90deg, transparent, rgba(0,0,0,.07) 45%, rgba(255,255,255,.12) 50%, rgba(0,0,0,.07) 55%, transparent); }
.crease.h { left: 0; right: 0; top: 50%; height: 24px; margin-top: -12px;
  background: linear-gradient(180deg, transparent, rgba(0,0,0,.07) 45%, rgba(255,255,255,.12) 50%, rgba(0,0,0,.07) 55%, transparent); }
.stage.capturing .screen { border-radius: 0 !important; }
/* Responsive (free size): plain screen, dashed outline, drag handles and a breakpoint ruler */
.device[data-style="responsive"] .body { background: none; box-shadow: 0 0 0 2px var(--g2), 0 18px 40px rgba(0,0,0,.45); }
.device[data-style="responsive"] .face { display: none; }
.stage.chroma .device[data-style="responsive"] .body { box-shadow: none; }
.rhandle { position: absolute; z-index: 6; background: var(--g2); box-shadow: 0 0 0 3px var(--g0); touch-action: none; }
.rhandle.e { right: -22px; top: 50%; width: 12px; height: 72px; margin-top: -36px; cursor: ew-resize; }
.rhandle.s { bottom: -22px; left: 50%; height: 12px; width: 72px; margin-left: -36px; cursor: ns-resize; }
.rhandle.se { right: -22px; bottom: -22px; width: 16px; height: 16px; cursor: nwse-resize; }
.rhandle:hover { background: var(--g3); }
.stage.resizing iframe { pointer-events: none; }
.stage.chroma .rhandle, .stage.chroma .ruler, .stage.capturing .rhandle, .stage.capturing .ruler { display: none; }
.ruler { position: absolute; left: 0; top: -54px; height: 34px; border-bottom: 3px solid var(--g1); pointer-events: none; }
.ruler .mark { position: absolute; bottom: -3px; transform: translateX(-50%); pointer-events: auto; cursor: pointer;
  font: 20px/1 var(--term); color: var(--g2); background: none; border: 0; padding: 0 0 8px; }
.ruler .mark::after { content: ""; position: absolute; left: 50%; bottom: 0; width: 3px; height: 8px; margin-left: -1px; background: var(--g2); }
.ruler .mark.on { color: var(--g3); font-weight: bold; }
.ruler .mark.on::after { background: var(--g3); height: 12px; }
.caption .rsize { display: inline-flex; align-items: center; gap: 2px; color: var(--g2); font: 18px/1 var(--term); }
.caption .rsize input, .caption select { width: 58px; height: 24px; margin: 0 2px; padding: 0 4px; background: #c9de6a; color: var(--g0);
  border: 0; font: 18px/1 var(--term); box-shadow: 0 0 0 2px var(--g0); }
.caption select { width: auto; }

/* browser bars (a realistic look, not the pixel theme) */
.bbar { flex: none; display: flex; align-items: center; gap: 10px; padding: 0 12px; z-index: 2; position: relative;
  font: 500 15px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111; }
.bbar .host { flex: 1; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bbar .bb-l, .bbar .bb-r { width: 22px; text-align: center; color: #333; font-size: 14px; }
.bbar.ios.bottom { height: 82px; align-items: flex-start; padding-top: 10px; background: rgba(248,248,248,.96); box-shadow: 0 -1px 0 rgba(0,0,0,.12); }
.bbar.ios.bottom .host, .bbar.ios.top .host { background: #e6e6ea; border-radius: 12px; padding: 11px 10px; }
.bbar.ios.top { height: 52px; background: #f7f7f8; box-shadow: 0 1px 0 rgba(0,0,0,.12); }
.bbar.android { height: 56px; background: #fff; box-shadow: 0 1px 0 rgba(0,0,0,.1); }
.bbar.android .host { text-align: left; background: #eef0f3; border-radius: 22px; padding: 10px 14px; color: #222; }
.stage.capturing .guides, .stage.chroma .guides { display: none; }
.guides { position: absolute; inset: 0; z-index: 7; pointer-events: none; border-style: solid; border-color: rgba(255,0,128,.22);
  box-shadow: inset 0 0 0 1px rgba(255,0,128,.6); }
/* virtual keyboard */
.kbd { position: absolute; left: 0; right: 0; bottom: 0; z-index: 8; display: flex; flex-direction: column; justify-content: center; gap: 9px;
  padding: 8px 4px 26px; font: 400 22px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; user-select: none; }
.kbd.ios { background: rgba(209,211,217,.98); }
.kbd.android { background: #e8eaed; padding-bottom: 20px; }
.krow { display: flex; justify-content: center; gap: 6px; padding: 0 3px; }
.key { flex: 1; max-width: 46px; height: 44px; border: 0; border-radius: 6px; background: #fff; color: #000; font: inherit; cursor: pointer;
  box-shadow: 0 1px 0 rgba(0,0,0,.35); padding: 0; }
.key:active { background: #c8cbd2; }
.key.wide { max-width: 90px; flex: 1.5; font-size: 16px; background: #abb0ba; }
.key.space { flex: 5; max-width: none; font-size: 16px; background: #fff; }
.key.ret { flex: 2; max-width: 110px; font-size: 16px; background: #abb0ba; }
.kbd.android .key { border-radius: 8px; box-shadow: none; }
.kbd.num .key { max-width: none; height: 46px; font-size: 26px; }
.stage.chroma .kbd, .stage.capturing .kbd { }

/* page loading: bar along the top of the screen, card after a short delay */
.loadbar { position: absolute; left: 0; right: 0; top: 0; height: 4px; z-index: 9; pointer-events: none; overflow: hidden; background: rgba(15,56,15,.25); }
.loadbar::after { content: ""; position: absolute; top: 0; bottom: 0; width: 30%;
  background: repeating-linear-gradient(90deg, #306230 0 6px, #8bac0f 6px 12px); animation: loadrun 1s steps(10) infinite; }
@keyframes loadrun { from { left: -30%; } to { left: 100%; } }
.screen.relayout::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 4px; z-index: 9;
  background: repeating-linear-gradient(90deg, #306230 0 6px, #8bac0f 6px 12px); animation: loadrun .6s steps(10) infinite; }
.loadcard { position: absolute; left: 50%; top: 50%; z-index: 9; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 10px;
  padding: 10px 16px 10px 10px; background: #9bbc0f; color: #0f380f; font: 20px/1 "MSIM VT", monospace; pointer-events: none;
  box-shadow: 0 -4px 0 0 #0f380f, 0 4px 0 0 #0f380f, -4px 0 0 0 #0f380f, 4px 0 0 0 #0f380f, 8px 8px 0 0 rgba(0,0,0,.35);
  opacity: 0; animation: cardin 0s .7s forwards; }
.loadcard img { width: 47px; height: 50px; image-rendering: pixelated; animation: bob .6s steps(2) infinite; }
@keyframes cardin { to { opacity: 1; } }
.stage.capturing .loadbar, .stage.capturing .loadcard, .stage.chroma .loadbar, .stage.chroma .loadcard { display: none; }
/* status chip above a device while it folds or rotates */
.slot { position: relative; }
.chip { position: absolute; top: -34px; left: 50%; transform: translateX(-50%); z-index: 5; white-space: nowrap;
  padding: 6px 10px; background: var(--g3); color: var(--g0); font: 9px/1 var(--pixel); text-transform: uppercase;
  box-shadow: 0 -3px 0 0 var(--g0), 0 3px 0 0 var(--g0), -3px 0 0 0 var(--g0), 3px 0 0 0 var(--g0); }
.chip::after { content: "..."; display: inline-block; width: 3ch; text-align: left; animation: dots 1s steps(4) infinite; overflow: hidden; vertical-align: bottom; }
@keyframes dots { from { width: 0; } to { width: 3ch; } }

/* screen power overlay and the fold rig */
.power { position: absolute; inset: 0; z-index: 8; pointer-events: none;
  background: linear-gradient(115deg, #0b0c0f 0%, #17191e 38%, #0a0b0d 62%, #121418 100%); }
.rig { position: absolute; z-index: 20; perspective: 2200px; transform-style: preserve-3d; pointer-events: none; will-change: transform; }
.rig .flap { will-change: transform; }
.rig .shade { position: absolute; inset: 0; border-radius: inherit; background: #000; opacity: 0; pointer-events: none; }
.rig .half, .rig .flap { position: absolute; transform-style: preserve-3d; }
.rig .face { position: absolute; inset: 0; backface-visibility: hidden; }
.rig .half, .rig .face { background:
    linear-gradient(115deg, rgba(255,255,255,0) 30%, rgba(255,255,255,.07) 42%, rgba(255,255,255,0) 54%),
    radial-gradient(120% 90% at 30% 20%, #1c1f25, #08090b 70%);
  box-shadow: 0 0 0 1px rgba(0,0,0,.6), inset 0 0 0 4px var(--metal), inset 0 0 0 5px rgba(255,255,255,.25), inset 0 0 0 12px var(--front); }
.rig.v .half { left: 0; top: 0; width: 50%; height: 100%; border-radius: var(--r) 0 0 var(--r); transform: translateZ(-1px); }
.rig.v .flap { left: 50%; top: 0; width: 50%; height: 100%; transform-origin: 0 50%; }
.rig.v .front { border-radius: 0 var(--r) var(--r) 0; }
.rig.v .back { border-radius: 0 var(--r) var(--r) 0; transform: rotateY(180deg); }
.rig.h .half { left: 0; top: 50%; width: 100%; height: 50%; border-radius: 0 0 var(--r) var(--r); transform: translateZ(-1px); }
.rig.h .flap { left: 0; top: 0; width: 100%; height: 50%; transform-origin: 50% 100%; }
.rig.h .front { border-radius: var(--r) var(--r) 0 0; }
.rig.h .back { border-radius: var(--r) var(--r) 0 0; transform: rotateX(180deg); }
/* the outer (cover) side: camera dot on the cover screen */
.rig .back i { position: absolute; width: 12px; height: 12px; border-radius: 50%; background: #000; box-shadow: 0 0 0 2px #23262c; }
.rig.v .back i { top: 22px; left: 50%; margin-left: -6px; }
.rig.h .back i { bottom: 22px; left: 50%; margin-left: -6px; }
.stage.capturing .cutout, .stage.capturing .homebar, .stage.capturing .crease, .stage.capturing .camdot { display: none; }
.camdot, .speaker, .homebtn, .crown { z-index: 2; }
.camdot { position: absolute; width: 8px; height: 8px; border-radius: 50%; background: #1d2027; box-shadow: inset 0 0 0 2px #2a2e37; }
.speaker { position: absolute; left: 50%; top: 32px; width: 54px; height: 5px; margin-left: -27px; border-radius: 3px; background: linear-gradient(#0e0f11, #2a2c30); }
.homebtn { position: absolute; left: 50%; bottom: 12px; width: 46px; height: 46px; margin-left: -23px; border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--metal) 60%, #777); background: radial-gradient(circle at 40% 35%, rgba(255,255,255,.08), rgba(0,0,0,0) 60%); }
.crown { position: absolute; right: -10px; top: 24%; width: 10px; height: 36px; border-radius: 0 5px 5px 0;
  background: repeating-linear-gradient(180deg, var(--m-hi) 0 2px, var(--m-lo) 2px 4px); box-shadow: inset -1px 0 0 rgba(0,0,0,.3); }
.band { width: 62%; height: 90px; flex: none;
  background: linear-gradient(90deg, rgba(0,0,0,.35), rgba(255,255,255,.08) 30%, rgba(255,255,255,0) 50%, rgba(0,0,0,.35)), color-mix(in srgb, var(--metal) 40%, #1e2126); }
.band.top { border-radius: 18px 18px 6px 6px; }
.band.bottom { border-radius: 6px 6px 18px 18px; }
.lbase { height: 18px; border-radius: 2px 2px 16px 16px; flex: none; position: relative;
  background: linear-gradient(180deg, var(--m-hi), var(--metal) 40%, var(--m-lo)); box-shadow: 0 1px 0 rgba(255,255,255,.25) inset, 0 10px 18px rgba(0,0,0,.45); }
.lbase::after { content: ""; position: absolute; left: 50%; top: 0; width: 120px; margin-left: -60px; height: 6px; border-radius: 0 0 8px 8px;
  background: linear-gradient(180deg, var(--m-lo), var(--metal)); }
.neck { width: 70px; height: 80px; flex: none; background: linear-gradient(90deg, var(--m-lo), var(--m-hi) 45%, var(--metal) 60%, var(--m-lo)); }
.foot { width: 260px; height: 14px; border-radius: 6px; flex: none; background: linear-gradient(180deg, var(--m-hi), var(--m-lo)); box-shadow: 0 8px 14px rgba(0,0,0,.4); }
.tvfeet { display: flex; justify-content: space-between; flex: none; }
.tvfeet i { width: 70px; height: 26px; background: linear-gradient(90deg, var(--m-lo), var(--metal), var(--m-lo)); clip-path: polygon(30% 0, 70% 0, 100% 100%, 0 100%); }
.pedestal { width: 34%; height: 140px; flex: none; background: linear-gradient(90deg, var(--m-lo), var(--m-hi) 45%, var(--metal) 60%, var(--m-lo)); }
.pfoot { width: 70%; height: 22px; border-radius: 8px; flex: none; background: linear-gradient(180deg, var(--m-hi), var(--m-lo)); box-shadow: 0 8px 14px rgba(0,0,0,.4); }
.cam { position: absolute; right: 14px; bottom: 14px; width: 30%; aspect-ratio: 1; overflow: hidden; z-index: 6;
  border: 6px solid var(--g3); outline: 4px solid var(--g0); background: #000; image-rendering: pixelated; }
.cam video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }

/* captions under each device: a little name plate */
.caption { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 2px 4px; padding: 4px 6px;
  max-width: 100%; color: var(--g3); background: rgba(11,31,11,.88); }
.slot.active .caption { background: var(--g0);
  box-shadow: 0 -3px 0 0 var(--g2), 0 3px 0 0 var(--g2), -3px 0 0 0 var(--g2), 3px 0 0 0 var(--g2); }
.slot.active .caption .name::before { content: "▶"; margin-right: 6px; animation: blink 1s steps(1) infinite; }
.caption .name { background: none; border: 0; cursor: pointer; padding: 6px 6px; font: 9px/1.4 var(--pixel); color: var(--g3); white-space: nowrap; }
.caption .name:hover { color: #d7f05a; }
.caption .meta { color: var(--g2); white-space: nowrap; padding: 0 4px; font: 18px/1 var(--term); }
.caption .btn { height: 24px; min-width: 24px; padding: 0 6px; font-size: 8px; }
.caption .fin i { display: block; width: 12px; height: 12px; box-shadow: 0 0 0 2px var(--g0); }
.badge { font: 7px/1 var(--pixel); padding: 4px 5px; background: var(--g1); color: var(--g3); }
.badge.ua { background: var(--g2); color: var(--g0); }
.badge.sess { background: #0f380f; color: #9bbc0f; box-shadow: 0 0 0 2px #8bac0f; }

/* popovers: dialog boxes */
.pop { position: absolute; top: 62px; z-index: 10; background: var(--g3); color: var(--ink); padding: 16px; display: none; width: 340px;
  box-shadow:
    0 -4px 0 0 var(--g0), 0 4px 0 0 var(--g0), -4px 0 0 0 var(--g0), 4px 0 0 0 var(--g0),
    inset 0 0 0 4px var(--g3), inset 0 0 0 7px var(--g1), 10px 10px 0 0 rgba(0,0,0,.5); }
.pop.show { display: block; animation: pop .12s steps(3); }
@keyframes pop { from { transform: scale(.94); } }
.pop h4 { margin: 2px 0 16px; font: 10px/1 var(--pixel); color: var(--g0); }
.pop h4::before { content: "▶ "; }
.opts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 0 4px 14px; }
.opt { padding: 10px 6px; cursor: pointer; text-align: center; background: var(--g2); color: var(--ink); font: 18px/1.05 var(--term);
  box-shadow: 0 -3px 0 0 var(--g1), 0 3px 0 0 var(--g1), -3px 0 0 0 var(--g1), 3px 0 0 0 var(--g1); }
.opt:hover { background: #a9cc1f; }
.opt.sel { background: var(--g0); color: var(--g3);
  box-shadow: 0 -3px 0 0 var(--g0), 0 3px 0 0 var(--g0), -3px 0 0 0 var(--g0), 3px 0 0 0 var(--g0); }
.opt .ico { margin: 0 auto 6px; }
.row2 { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 10px 4px; font: 20px/1 var(--term); }
.row2 select { height: 28px; padding: 0 8px; background: #c9de6a; color: var(--ink); font: 18px/1 var(--term); margin: 3px; }
.row2 input[type=color] { width: 44px; height: 28px; padding: 0; border: 3px solid var(--g0); background: none; cursor: pointer; }
.pop .go { width: calc(100% - 6px); height: 38px; margin-top: 10px; font-size: 10px; }
.note { color: var(--g1); font: 17px/1.05 var(--term); margin: 12px 4px 0; }
.toggle { position: relative; width: 40px; height: 20px; flex: none; }
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle span { position: absolute; inset: 0; background: var(--g2); cursor: pointer;
  box-shadow: 0 -3px 0 0 var(--g0), 0 3px 0 0 var(--g0), -3px 0 0 0 var(--g0), 3px 0 0 0 var(--g0); }
.toggle span::after { content: ""; position: absolute; left: 3px; top: 3px; width: 14px; height: 14px; background: var(--g1); transition: transform .12s steps(2); }
.toggle input:checked + span { background: var(--g0); }
.toggle input:checked + span::after { transform: translateX(20px); background: var(--g3); }

/* settings extras */
.pop h4.sub { margin: 16px 4px 8px; }
.row2 input:not([type]), .row2 input[type=text], .pop .row2 input.set-name, .pop .row2 input.set-geo-txt { flex: 1; height: 28px; padding: 0 8px; margin: 3px;
  background: #c9de6a; color: var(--ink); border: 0; font: 18px/1 var(--term); box-shadow: 0 0 0 2px var(--g0); }
.set-pop { width: 380px; max-height: calc(100vh - 80px); overflow: auto; }
.sets { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px; }
.set-item { display: inline-flex; }
.set-item .btn { height: 26px; font-size: 8px; margin: 3px 0 3px 3px; }
.set-item .set-del { min-width: 22px; padding: 0 5px; }

/* device picker: a cartridge shelf */
.panel { position: absolute; top: 54px; right: 0; bottom: 0; width: 480px; max-width: 100%; z-index: 9; background: var(--g1);
  border-left: 4px solid var(--g0); display: none; flex-direction: column; box-shadow: -10px 0 0 0 rgba(0,0,0,.35); }
.panel.show { display: flex; }
.panel .head { padding: 14px 16px; display: flex; gap: 10px; align-items: center; background: var(--g0); }
.panel .head input { flex: 1; height: 32px; padding: 0 10px; margin: 3px; background: var(--g3); color: var(--ink); font: 20px/1 var(--term); }
.panel .head input:focus { outline: none; }
.panel .mode { padding: 12px 18px 0; color: var(--g3); font: 18px/1 var(--term); }
.panel .list { overflow: auto; padding: 4px 18px 24px; }
.panel .list::-webkit-scrollbar, .stage::-webkit-scrollbar { width: 12px; height: 12px; }
.panel .list::-webkit-scrollbar-track, .stage::-webkit-scrollbar-track { background: var(--g0); }
.panel .list::-webkit-scrollbar-thumb, .stage::-webkit-scrollbar-thumb { background: var(--g2); border: 3px solid var(--g0); }
.panel h3 { font: 9px/1 var(--pixel); color: var(--g3); margin: 22px 0 14px; }
.panel h3::before { content: "■ "; color: var(--g2); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 14px; }
.card { position: relative; margin: 3px; background: var(--g2); color: var(--ink); padding: 12px 6px 9px; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; font: 17px/1 var(--term); min-height: 96px; }
.card:hover { background: var(--g3); transform: translateY(-2px); }
.card.cur { background: var(--g0); color: var(--g3); }
.card .thumb { width: 80px; height: 80px; object-fit: contain; image-rendering: pixelated; flex: none; }
.card.cur .thumb { filter: brightness(1.15); }
.card .tag { position: absolute; top: 4px; right: 4px; font: 6px/1 var(--pixel); padding: 3px 4px; background: var(--g0); color: var(--g3); }
.card.cur .tag { background: var(--g3); color: var(--g0); }
.card .del { position: absolute; top: 3px; left: 4px; color: var(--g0); background: none; border: 0; cursor: pointer; font: 18px/1 var(--term); }
.card.add { justify-content: center; background: transparent; color: var(--g3);
  box-shadow: 0 -3px 0 0 var(--g2), 0 3px 0 0 var(--g2), -3px 0 0 0 var(--g2), 3px 0 0 0 var(--g2); }
.form { display: none; background: var(--g3); color: var(--ink); padding: 14px; margin-top: 16px; gap: 12px;
  box-shadow: 0 -4px 0 0 var(--g0), 0 4px 0 0 var(--g0), -4px 0 0 0 var(--g0), 4px 0 0 0 var(--g0); }
.form.show { display: grid; grid-template-columns: 1fr 1fr; }
.form label { display: flex; flex-direction: column; gap: 6px; font: 17px/1 var(--term); color: var(--g0); }
.form label.wide { grid-column: span 2; }
.form input, .form select { height: 30px; padding: 0 8px; margin: 3px; background: #c9de6a; color: var(--ink); font: 18px/1 var(--term); }
.form input:focus, .form select:focus { outline: none; background: #dcef8a; }
.form .actions { grid-column: span 2; display: flex; gap: 10px; justify-content: flex-end; }

/* shown when the extension was reloaded under this tab */
.stale { position: absolute; inset: 0; z-index: 50; display: grid; place-items: center; background: rgba(11,31,11,.82); }
.stale .box { background: var(--g3); color: var(--ink); padding: 22px 26px; max-width: 420px; font: 20px/1.15 var(--term);
  box-shadow: 0 -4px 0 0 var(--g0), 0 4px 0 0 var(--g0), -4px 0 0 0 var(--g0), 4px 0 0 0 var(--g0), 10px 10px 0 0 rgba(0,0,0,.5); }
.stale h4 { margin: 0 0 12px; font: 11px/1.2 var(--pixel); }
.stale .btn { margin-top: 16px; height: 36px; }

/* toast: a text box with a blinking cursor */
.toast { position: absolute; bottom: 22px; left: 50%; transform: translateX(-50%); background: var(--g3); color: var(--ink);
  padding: 10px 38px 10px 12px; opacity: 0; pointer-events: none; z-index: 20; font: 22px/1 var(--term); white-space: nowrap;
  display: flex; align-items: center; gap: 12px; }
.toast img { width: 47px; height: 50px; image-rendering: pixelated; margin: -22px 0 -4px; }
.toast.show img { animation: bob .6s steps(2) infinite; }
.toast::after { content: "▼"; position: absolute; right: 12px; bottom: 9px; font-size: 14px; animation: blink .8s steps(1) infinite; }
.toast.show { opacity: 1; }
.toast.top { top: 8px; bottom: auto; z-index: 30; }
/* Thai interface: the pixel font has no Thai glyphs, so labels use a readable Thai face */
.app.th .btn, .app.th .pop h4, .app.th .panel h3, .app.th .chip, .app.th .caption .name, .app.th .badge, .app.th .stale h4, .app.th .rec-live {
  font-family: "Thonburi", "Noto Sans Thai", "Leelawadee UI", sans-serif; font-size: 14px; font-weight: 600; text-transform: none; letter-spacing: 0; }
.app.th .pop h4, .app.th .panel h3 { font-size: 16px; }
.app.th .caption .name { font-family: var(--pixel); font-size: 9px; }

/* respect the system "reduce motion" setting for decorative loops */
@media (prefers-reduced-motion: reduce) {
  .logo .mascot, .toast.show img, .slot.active .caption .name::before, .rec-live .dot { animation: none !important; }
}
`;
