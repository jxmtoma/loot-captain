// Loot Captain - OpenDKP page-world network bridge
// Content scripts cannot replace the page's fetch/XHR in Chrome's isolated world.

(function () {
  'use strict';

  const EVENT = 'loot-captain-opendkp-item-data';
  const CONSENT_FRAME_ID = 'loot-captain-opendkp-consent';

  function isItemRequest(url) {
    try {
      const parsed = new URL(url, location.href);
      return /\/items(?:\/|\?|$)/i.test(parsed.pathname + parsed.search);
    } catch (e) {
      return false;
    }
  }

  function publish(url, data) {
    document.dispatchEvent(new CustomEvent(EVENT, {
      detail: JSON.stringify({ url, data }),
    }));
  }

  function hookFetch() {
    if (!window.fetch || window.__lootCaptainFetchHooked) return;
    window.__lootCaptainFetchHooked = true;
    const original = window.fetch;
    window.fetch = function (...args) {
      const promise = original.apply(this, args);
      promise.then((response) => {
        if (!isItemRequest(response.url)) return;
        response.clone().text().then((text) => {
          try { publish(response.url, JSON.parse(text)); } catch (e) {}
        }).catch(() => {});
      }).catch(() => {});
      return promise;
    };
  }

  function hookXhr() {
    if (window.__lootCaptainXhrHooked) return;
    window.__lootCaptainXhrHooked = true;
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this.__lootCaptainUrl = url;
      return originalOpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function (...args) {
      this.addEventListener('load', () => {
        const url = this.__lootCaptainUrl || '';
        if (!isItemRequest(url)) return;
        try {
          const response = this.responseType === 'json' ? this.response : this.responseText;
          publish(url, typeof response === 'string' ? JSON.parse(response) : response);
        } catch (e) {}
      });
      return originalSend.apply(this, args);
    };
  }

  function activateFromConsent(event) {
    const frame = document.getElementById(CONSENT_FRAME_ID);
    if (!event.isTrusted || !frame || event.source !== frame.contentWindow) return;
    let frameOrigin;
    try { frameOrigin = new URL(frame.src).origin; } catch (e) { return; }
    if (event.origin !== frameOrigin || !event.data || event.data.type !== 'loot-captain-consent-accepted') return;
    hookFetch();
    hookXhr();
    window.removeEventListener('message', activateFromConsent);
  }

  window.addEventListener('message', activateFromConsent);
  const frame = document.getElementById(CONSENT_FRAME_ID);
  if (frame && frame.contentWindow) {
    try { frame.contentWindow.postMessage({ type: 'loot-captain-consent-probe' }, new URL(frame.src).origin); } catch (e) {}
  }
})();
