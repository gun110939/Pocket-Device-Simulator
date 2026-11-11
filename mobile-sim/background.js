importScripts('devices.js', 'debug.js');

// How it works
// 1. Turning the simulator on for a tab installs tab-scoped network rules, then reloads the tab.
// 2. The top document loads with its scripts disabled (CSP), and shell.js replaces it with the
//    simulator UI. The page itself loads again inside a same-origin iframe, so cookies and
//    logins stay first-party.
// 3. Rules: mobile User-Agent on every request (client hints removed), and X-Frame-Options/CSP
//    stripped from sub-frame documents so sites that refuse framing still load.
// 4. spoof.js (MAIN world) makes the JS view of the device match the headers.

const DEVICES = self.MSIM_DEVICES;
const deviceById = (id) => DEVICES.find((d) => d.id === id) || DEVICES.find((d) => d.id === self.MSIM_DEFAULT_DEVICE);

// A spoofed UA breaks bot-challenge checks, so leave those hosts alone.
const CHALLENGE_DOMAINS = ['challenges.cloudflare.com', 'hcaptcha.com', 'recaptcha.net', 'arkoselabs.com'];
const ALL_TYPES = ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object', 'xmlhttprequest', 'ping', 'media', 'websocket', 'other'];

// Tab ids can exceed what fits in a rule id (int32) once multiplied, so each simulated tab
// gets its own block of 4 rule ids, kept in its state.
const ruleIds = (base) => [0, 1, 2, 3, 4].map((k) => base + k);
const key = (tabId) => `tab:${tabId}`;

async function allocRuleBase() {
  const { nextRuleBase = 1 } = await chrome.storage.session.get('nextRuleBase');
  await chrome.storage.session.set({ nextRuleBase: nextRuleBase + 8 });
  return nextRuleBase;
}

async function getState(tabId) {
  const k = key(tabId);
  return (await chrome.storage.session.get(k))[k] || null;
}
// A local copy survives an extension reload/update, so open simulator tabs can be restored.
async function setState(tabId, state) {
  activeTabs.add(tabId);
  await chrome.storage.session.set({ [key(tabId)]: state });
  await chrome.storage.local.set({ ['keep:' + key(tabId)]: state });
}
async function clearState(tabId) {
  activeTabs.delete(tabId);
  await chrome.storage.session.remove(key(tabId));
  await chrome.storage.local.remove('keep:' + key(tabId));
}

// Fast in-memory check so navigation events in ordinary tabs cost nothing.
const activeTabs = new Set();
const ready = chrome.storage.session.get(null).then((all) => {
  for (const k of Object.keys(all)) if (k.startsWith('tab:')) activeTabs.add(Number(k.slice(4)));
});
async function getActiveState(tabId) {
  await ready;
  return activeTabs.has(tabId) ? getState(tabId) : null;
}

// After the extension is reloaded or updated, Chrome drops the session rules and the old shell
// loses its connection. Put the rules back and reload those tabs so the simulator re-forms.
chrome.runtime.onInstalled.addListener(() => restoreKeptTabs());
async function restoreKeptTabs() {
  const old = await chrome.declarativeNetRequest.getSessionRules();
  if (old.length) await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: old.map((r) => r.id) });
  const all = await chrome.storage.local.get(null);
  for (const [k, state] of Object.entries(all)) {
    if (!k.startsWith('keep:tab:')) continue;
    const tabId = Number(k.slice('keep:tab:'.length));
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab || !/^https?:/.test(tab.url || '')) {
      await chrome.storage.local.remove(k);
      continue;
    }
    const ruleBase = await allocRuleBase();
    const next = { ...state, ruleBase };
    await setState(tabId, next);
    await installRules(tabId, ruleBase, next.ua || deviceById().ua, next.lang);
    if (next.emu && !Emulation.isDefault(next.emu)) await Emulation.apply(tabId, next.emu).catch(() => {});
    await setBadge(tabId, true);
    await chrome.tabs.reload(tabId, { bypassCache: true }).catch(() => {});
  }
}
// Tab ids do not survive a browser restart.
chrome.runtime.onStartup.addListener(async () => {
  const all = await chrome.storage.local.get(null);
  await chrome.storage.local.remove(Object.keys(all).filter((k) => k.startsWith('keep:tab:')));
});

async function installRules(tabId, base, ua, lang) {
  const [uaRule, frameRule, destRule, topCspRule] = ruleIds(base);
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: ruleIds(base),
    addRules: [
      {
        id: uaRule,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'user-agent', operation: 'set', value: ua },
            ...(lang ? [{ header: 'accept-language', operation: 'set', value: `${lang},${lang.split('-')[0]};q=0.9,en;q=0.5` }] : []),
            ...['sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform', 'sec-ch-ua-platform-version', 'sec-ch-ua-model',
              'sec-ch-ua-arch', 'sec-ch-ua-bitness', 'sec-ch-ua-full-version', 'sec-ch-ua-full-version-list', 'sec-ch-ua-wow64',
            ].map((header) => ({ header, operation: 'remove' })),
            // Without this the first load can be served from cache as the desktop variant.
            { header: 'cache-control', operation: 'set', value: 'no-cache' },
            { header: 'pragma', operation: 'set', value: 'no-cache' },
          ],
        },
        condition: { tabIds: [tabId], resourceTypes: ALL_TYPES, excludedRequestDomains: CHALLENGE_DOMAINS },
      },
      {
        id: frameRule,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          responseHeaders: [
            { header: 'x-frame-options', operation: 'remove' },
            { header: 'content-security-policy', operation: 'remove' },
          ],
        },
        condition: { tabIds: [tabId], resourceTypes: ['sub_frame'], excludedRequestDomains: CHALLENGE_DOMAINS },
      },
      {
        // Some servers refuse documents requested as iframes.
        id: destRule,
        priority: 1,
        action: { type: 'modifyHeaders', requestHeaders: [{ header: 'sec-fetch-dest', operation: 'set', value: 'document' }] },
        condition: { tabIds: [tabId], resourceTypes: ['sub_frame'], excludedRequestDomains: CHALLENGE_DOMAINS },
      },
      {
        // The top document only hosts the simulator; stop the page's own scripts there.
        id: topCspRule,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          responseHeaders: [
            { header: 'content-security-policy', operation: 'set', value: "script-src 'none'" },
            // Let the shell use screen capture, camera and microphone for recordings.
            { header: 'permissions-policy', operation: 'remove' },
            { header: 'feature-policy', operation: 'remove' },
          ],
        },
        condition: { tabIds: [tabId], resourceTypes: ['main_frame'] },
      },
    ],
  });
}

Debug.onLost(async (tabId) => {
  const state = await getActiveState(tabId);
  if (state && state.emu && !Emulation.isDefault(state.emu)) {
    await setState(tabId, { ...state, emu: null });
    chrome.tabs.sendMessage(tabId, { type: 'emulation-off' }, { frameId: 0 }).catch(() => {});
  }
});

async function removeRules(state) {
  if (!state || !state.ruleBase) return;
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: ruleIds(state.ruleBase) });
}

async function setBadge(tabId, on) {
  await chrome.action.setBadgeText({ tabId, text: on ? 'ON' : '' }).catch(() => {});
  if (on) await chrome.action.setBadgeBackgroundColor({ tabId, color: '#2563eb' }).catch(() => {});
}

async function enable(tab) {
  if (!/^https?:/.test(tab.url || '')) {
    await chrome.action.setBadgeText({ tabId: tab.id, text: 'n/a' }).catch(() => {});
    setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: '' }).catch(() => {}), 1500);
    return;
  }
  const { lastDevices, lastZoom, customDevices = [] } = await chrome.storage.local.get(['lastDevices', 'lastZoom', 'customDevices']);
  const known = (id) => DEVICES.some((d) => d.id === id) || customDevices.some((d) => d.id === id);
  let devices = Array.isArray(lastDevices) ? lastDevices.filter((d) => d && known(d.id)) : [];
  if (!devices.length) devices = [{ id: deviceById().id, landscape: false, folded: true }];
  const primary = DEVICES.find((d) => d.id === devices[0].id) || customDevices.find((d) => d.id === devices[0].id);
  const ruleBase = await allocRuleBase();
  await setState(tab.id, {
    devices, active: 0, primary: 0, zoom: lastZoom || 'fit', sync: { scroll: true, nav: true },
    ua: primary.ua, url: tab.url, ruleBase,
  });
  const { lang } = await chrome.storage.local.get('lang');
  await installRules(tab.id, ruleBase, primary.ua, lang);
  await setBadge(tab.id, true);
  await chrome.tabs.reload(tab.id, { bypassCache: true });
}

async function disable(tabId) {
  const state = await getState(tabId);
  if (state && state.emu) await Emulation.apply(tabId, null).catch(() => {});
  await clearState(tabId);
  await removeRules(state);
  await setBadge(tabId, false);
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) return;
  const url = state && state.url && /^https?:/.test(state.url) ? state.url : tab.url;
  await chrome.tabs.update(tabId, { url });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (await getActiveState(tab.id)) await disable(tab.id);
  else await enable(tab);
});

// Hide the original page as soon as it commits, then build the shell once the DOM is parsed.
chrome.webNavigation.onCommitted.addListener(async (d) => {
  const state = await getActiveState(d.tabId);
  if (!state) return;
  if (d.frameId === 0) {
    if (!/^https?:/.test(d.url)) return disable(d.tabId);
    await setBadge(d.tabId, true);
    chrome.scripting
      .insertCSS({ target: { tabId: d.tabId, frameIds: [0] }, css: 'html{background:#0b1f0b!important}body{visibility:hidden!important}' })
      .catch(() => {});
    return;
  }
  await onInnerNavigation(d, state);
});

chrome.webNavigation.onDOMContentLoaded.addListener(async (d) => {
  if (d.frameId !== 0 || !(await getActiveState(d.tabId))) return;
  chrome.scripting
    .executeScript({ target: { tabId: d.tabId, frameIds: [0] }, files: ['devices.js', 'icons.js', 'i18n.js', 'shell-style.js', 'capture.js', 'shell.js'] })
    .catch((e) => console.warn('shell injection failed', e));
});

chrome.webNavigation.onHistoryStateUpdated.addListener(async (d) => {
  const state = await getActiveState(d.tabId);
  if (state && d.frameId !== 0) await onInnerNavigation(d, state);
});
chrome.webNavigation.onReferenceFragmentUpdated.addListener(async (d) => {
  const state = await getActiveState(d.tabId);
  if (state && d.frameId !== 0) await onInnerNavigation(d, state);
});

// Is this frame one of the simulator's device viewports? The original page's own iframes (a
// YouTube embed, an ad) can commit before the shell replaces the page; they must be ignored.
async function isDeviceFrame(tabId, frameId) {
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, injectImmediately: true,
      func: () => String(window.name).startsWith('msim:') });
    return !!(r && r.result);
  } catch {
    return false;
  }
}

async function onInnerNavigation(d, state) {
  if (d.parentFrameId !== 0 || !/^https?:/.test(d.url)) return;
  if (!(await isDeviceFrame(d.tabId, d.frameId))) return;
  const top = await chrome.webNavigation.getFrame({ tabId: d.tabId, frameId: 0 }).catch(() => null);
  await setState(d.tabId, { ...state, url: d.url });
  if (top && new URL(top.url).origin !== new URL(d.url).origin) {
    // Crossing origins would make the page's cookies third-party. Move the whole shell instead.
    await chrome.tabs.update(d.tabId, { url: d.url });
    return;
  }
  chrome.tabs.sendMessage(d.tabId, { type: 'frameUrl', url: d.url }, { frameId: 0 }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const tabId = sender.tab && sender.tab.id;
  if (tabId == null) return false;
  (async () => {
    const state = await getState(tabId);
    if (!state) return reply({ error: 'inactive' });
    switch (msg.type) {
      case 'getState':
        return reply(state);
      case 'update': {
        const next = { ...state, ...msg.patch };
        await setState(tabId, next);
        await chrome.storage.local.set({ lastDevices: next.devices, lastZoom: next.zoom });
        // The User-Agent header is per tab, so it follows the primary device.
        if ((msg.patch.ua && msg.patch.ua !== state.ua) || 'lang' in msg.patch) await installRules(tabId, next.ruleBase, next.ua, next.lang);
        if ('lang' in msg.patch) await chrome.storage.local.set({ lang: next.lang || '' });
        return reply(next);
      }
      case 'capture': {
        const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' });
        return reply({ dataUrl });
      }
      case 'exit':
        await disable(tabId);
        return reply({ ok: true });
      case 'emulate': {
        try {
          await Emulation.apply(tabId, msg.emu);
          await setState(tabId, { ...state, emu: msg.emu });
          return reply({ ok: true });
        } catch (e) {
          return reply({ error: String((e && e.message) || e) });
        }
      }
      default:
        return reply({ error: 'unknown message' });
    }
  })().catch((e) => reply({ error: String(e && e.message ? e.message : e) }));
  return true;
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await getActiveState(tabId);
  if (!state) return;
  await clearState(tabId);
  await removeRules(state);
});
