'use strict';

const KEY = 'consentVersion';
const VERSION = 1;

async function notifyIfConsented() {
  const result = await chrome.storage.local.get(KEY);
  if (result[KEY] === VERSION) parent.postMessage({ type: 'loot-captain-consent-accepted' }, '*');
}

notifyIfConsented();
window.addEventListener('message', notifyIfConsented);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[KEY]) notifyIfConsented();
});
