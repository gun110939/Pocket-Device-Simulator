// Screenshot and screen-recording helpers for the shell (isolated world).
(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  async function grabTab() {
    const res = await chrome.runtime.sendMessage({ type: 'capture' });
    if (!res || !res.dataUrl) throw new Error((res && res.error) || 'capture failed');
    const bin = atob(res.dataUrl.slice(res.dataUrl.indexOf(',') + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const img = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    return { img, k: img.width / innerWidth };
  }

  function crop(img, k, rect) {
    const c = new OffscreenCanvas(Math.max(1, Math.round(rect.width * k)), Math.max(1, Math.round(rect.height * k)));
    c.getContext('2d').drawImage(img, rect.left * k, rect.top * k, rect.width * k, rect.height * k, 0, 0, c.width, c.height);
    return c;
  }

  // The stage is painted pure green while capturing; turn that green into transparency.
  function keyOutGreen(canvas) {
    const ctx = canvas.getContext('2d');
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const r = p[i], g = p[i + 1], b = p[i + 2];
      const spill = g - Math.max(r, b);
      if (spill > 160) {
        p[i + 3] = 0;
      } else if (spill > 40) {
        // Anti-aliased edge against green: fade it and remove the green tint.
        p[i + 3] = Math.round(255 * (1 - (spill - 40) / 120));
        p[i + 1] = Math.max(r, b);
      }
    }
    ctx.putImageData(d, 0, 0);
    return canvas;
  }

  async function save(canvas, filename) {
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    download(blob, filename);
  }

  function download(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  function withBackground(canvas, color, k) {
    const pad = Math.round(Math.max(canvas.width, canvas.height) * 0.12);
    const out = new OffscreenCanvas(canvas.width + pad * 2, canvas.height + pad * 2);
    const ctx = out.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = 40 * k;
    ctx.shadowOffsetY = 18 * k;
    ctx.drawImage(canvas, pad, pad);
    return out;
  }

  // Scroll the viewport page by page, capture each step and stitch the strips together.
  async function fullPage(iframe, onProgress) {
    let win, doc;
    try {
      win = iframe.contentWindow;
      doc = iframe.contentDocument;
      void doc.body;
    } catch {
      throw new Error('This page cannot be read (different origin).');
    }
    const se = doc.scrollingElement || doc.documentElement;
    const startX = win.scrollX, startY = win.scrollY;
    const viewH = win.innerHeight;
    const total = Math.max(se.scrollHeight, viewH);
    const rect = iframe.getBoundingClientRect();
    const cssToScreen = rect.height / viewH; // scale of the device on the stage

    const hidden = [];
    const hideFixed = () => {
      for (const el of doc.querySelectorAll('body *')) {
        const pos = win.getComputedStyle(el).position;
        if ((pos === 'fixed' || pos === 'sticky') && el.style.visibility !== 'hidden') {
          hidden.push([el, el.style.visibility]);
          el.style.visibility = 'hidden';
        }
      }
    };

    let out = null, ctx = null, k = 1;
    const maxH = 30000;
    try {
      for (let y = 0, step = 0; ; step++) {
        win.scrollTo(0, y);
        await frames();
        await sleep(step === 0 ? 150 : 550); // captureVisibleTab allows about 2 calls per second
        const actualY = win.scrollY;
        const shot = await grabTab();
        k = shot.k;
        const ratio = cssToScreen * k; // output px per CSS px
        if (!out) {
          out = new OffscreenCanvas(Math.round(rect.width * k), Math.min(maxH, Math.round(total * ratio)));
          ctx = out.getContext('2d');
        }
        const strip = crop(shot.img, k, rect);
        ctx.drawImage(strip, 0, Math.round(actualY * ratio));
        onProgress && onProgress(Math.min(1, (actualY + viewH) / total));
        if (step === 0) hideFixed();
        if (actualY + viewH >= total - 1 || (actualY + viewH) * ratio >= maxH) break;
        y = actualY + viewH;
      }
    } finally {
      for (const [el, v] of hidden) el.style.visibility = v;
      win.scrollTo(startX, startY);
    }
    return out;
  }

  // Screen recording of one element, using tab self-capture cropped to that element.
  async function record(target, { mic, camHost, bitrate }) {
    const display = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: true,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      surfaceSwitching: 'exclude',
    });
    const [video] = display.getVideoTracks();
    let cropped = false;
    if (self.CropTarget && video.cropTo) {
      try {
        await video.cropTo(await CropTarget.fromElement(target));
        cropped = true;
      } catch {}
    }

    const extra = [];
    let camEl = null;
    if (camHost) {
      const cam = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 480 } }).catch(() => null);
      if (cam) {
        extra.push(cam);
        camEl = document.createElement('div');
        camEl.className = 'cam';
        const v = document.createElement('video');
        v.muted = true;
        v.playsInline = true;
        v.srcObject = cam;
        v.play().catch(() => {});
        camEl.appendChild(v);
        camHost.appendChild(camEl);
      }
    }

    // Fallback when Region Capture is unavailable: draw the tab video onto a canvas, cropped to
    // the target's current position each frame, and record the canvas instead.
    let videoOut = video;
    let stopDraw = () => {};
    if (!cropped) {
      const src = document.createElement('video');
      src.muted = true;
      src.srcObject = new MediaStream([video]);
      await src.play();
      const r0 = target.getBoundingClientRect();
      const k0 = src.videoWidth / innerWidth || 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(2, Math.round((r0.width * k0) / 2) * 2);
      canvas.height = Math.max(2, Math.round((r0.height * k0) / 2) * 2);
      const ctx = canvas.getContext('2d');
      let live = true;
      const draw = () => {
        if (!live) return;
        const r = target.getBoundingClientRect();
        const k = src.videoWidth / innerWidth || 1;
        // Keep the aspect ratio if the device was rotated or folded mid-recording.
        const fit = Math.min(canvas.width / (r.width * k), canvas.height / (r.height * k));
        const dw = r.width * k * fit, dh = r.height * k * fit;
        ctx.fillStyle = '#16181d';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(src, r.left * k, r.top * k, r.width * k, r.height * k, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
        if (src.requestVideoFrameCallback) src.requestVideoFrameCallback(draw);
        else setTimeout(draw, 33);
      };
      draw();
      videoOut = canvas.captureStream(30).getVideoTracks()[0];
      stopDraw = () => {
        live = false;
        videoOut.stop();
      };
      cropped = true;
    }

    const tracks = [videoOut];
    const audioIn = [];
    if (display.getAudioTracks().length) audioIn.push(new MediaStream(display.getAudioTracks()));
    if (mic) {
      const m = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
      if (m) {
        extra.push(m);
        audioIn.push(m);
      }
    }
    let actx = null;
    if (audioIn.length === 1) tracks.push(...audioIn[0].getAudioTracks());
    else if (audioIn.length > 1) {
      actx = new AudioContext();
      const dest = actx.createMediaStreamDestination();
      for (const s of audioIn) actx.createMediaStreamSource(s).connect(dest);
      tracks.push(...dest.stream.getAudioTracks());
    }

    const types = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    const rec = new MediaRecorder(new MediaStream(tracks), { mimeType, videoBitsPerSecond: bitrate });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise((resolve) => {
      rec.onstop = () => {
        stopDraw();
        for (const s of [display, ...extra]) s.getTracks().forEach((t) => t.stop());
        if (actx) actx.close();
        if (camEl) camEl.remove();
        resolve(new Blob(chunks, { type: rec.mimeType || 'video/webm' }));
      };
    });
    video.addEventListener('ended', () => rec.state !== 'inactive' && rec.stop());
    rec.start(1000);
    return {
      cropped,
      ext: (rec.mimeType || '').includes('mp4') ? 'mp4' : 'webm',
      stop: () => rec.state !== 'inactive' && rec.stop(),
      done,
    };
  }

  // Round the corners of a screen capture and make them transparent.
  function roundCorners(canvas, r) {
    const out = new OffscreenCanvas(canvas.width, canvas.height);
    const ctx = out.getContext('2d');
    ctx.beginPath();
    ctx.roundRect(0, 0, out.width, out.height, r);
    ctx.clip();
    ctx.drawImage(canvas, 0, 0);
    return out;
  }

  // Minimal ZIP writer (stored, no compression): PNGs are already compressed.
  const CRC = new Uint32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (bytes) => {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  async function zip(files) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (const f of files) {
      const data = new Uint8Array(await f.blob.arrayBuffer());
      const name = enc.encode(f.name);
      const crc = crc32(data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
      local.setUint16(10, dosTime, true); local.setUint16(12, dosDate, true); local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true); local.setUint32(22, data.length, true); local.setUint16(26, name.length, true);
      parts.push(local, name, data);
      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
      cen.setUint16(12, dosTime, true); cen.setUint16(14, dosDate, true); cen.setUint32(16, crc, true);
      cen.setUint32(20, data.length, true); cen.setUint32(24, data.length, true); cen.setUint16(28, name.length, true);
      cen.setUint32(42, offset, true);
      central.push(cen, name);
      offset += 30 + name.length + data.length;
    }
    const size = central.reduce((a, p) => a + p.byteLength, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, size, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end], { type: 'application/zip' });
  }

  self.MSIM_capture = { grabTab, crop, keyOutGreen, save, download, withBackground, fullPage, record, frames, sleep, roundCorners, zip };
})();
