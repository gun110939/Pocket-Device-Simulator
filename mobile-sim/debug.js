// Shared chrome.debugger connection per tab. Separate sessions and accurate-mode emulation both
// need it; it is attached while at least one of them is on and detached when both are off.
const Debug = (() => {
  const users = new Map(); // tabId -> Set of feature names
  const onLost = new Set(); // callbacks(tabId) when the user closes the debugger bar
  chrome.debugger.onDetach.addListener((src) => {
    if (!users.has(src.tabId)) return;
    users.delete(src.tabId);
    for (const fn of onLost) fn(src.tabId);
  });
  return {
    async acquire(tabId, who) {
      const set = users.get(tabId);
      if (set) return set.add(who);
      await chrome.debugger.attach({ tabId }, '1.3');
      users.set(tabId, new Set([who]));
    },
    async release(tabId, who) {
      const set = users.get(tabId);
      if (!set) return;
      set.delete(who);
      if (set.size) return;
      users.delete(tabId);
      await chrome.debugger.detach({ tabId }).catch(() => {});
    },
    attached: (tabId) => users.has(tabId),
    onLost: (fn) => onLost.add(fn),
    cmd: (tabId, method, params = {}) => chrome.debugger.sendCommand({ tabId }, method, params),
  };
})();

// Accurate mode: media features, network and CPU throttling through the debugger.
const Emulation = (() => {
  const NET = {
    none: null,
    fast4g: { latency: 40, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 },
    slow4g: { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
    '3g': { latency: 300, downloadThroughput: (750 * 1024) / 8, uploadThroughput: (250 * 1024) / 8 },
    offline: { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 },
  };
  const isDefault = (e) => !e || ((!e.scheme || e.scheme === 'default') && !e.motion && (!e.net || e.net === 'none') && (!e.cpu || e.cpu === 1));
  async function apply(tabId, e) {
    if (isDefault(e)) {
      if (Debug.attached(tabId)) {
        await Debug.cmd(tabId, 'Emulation.setEmulatedMedia', { features: [] }).catch(() => {});
        await Debug.cmd(tabId, 'Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }).catch(() => {});
        await Debug.cmd(tabId, 'Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => {});
      }
      return Debug.release(tabId, 'emulation');
    }
    await Debug.acquire(tabId, 'emulation');
    const features = [];
    if (e.scheme && e.scheme !== 'default') features.push({ name: 'prefers-color-scheme', value: e.scheme });
    if (e.motion) features.push({ name: 'prefers-reduced-motion', value: 'reduce' });
    await Debug.cmd(tabId, 'Emulation.setEmulatedMedia', { features });
    await Debug.cmd(tabId, 'Network.enable');
    const n = NET[e.net || 'none'];
    await Debug.cmd(tabId, 'Network.emulateNetworkConditions', n ? { offline: !!n.offline, latency: n.latency, downloadThroughput: n.downloadThroughput, uploadThroughput: n.uploadThroughput }
      : { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await Debug.cmd(tabId, 'Emulation.setCPUThrottlingRate', { rate: e.cpu || 1 });
  }
  return { apply, isDefault };
})();
