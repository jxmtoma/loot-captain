// Loot Captain - OpenDKP page-world network bridge
// Content scripts cannot replace the page's fetch/XHR in Chrome's isolated world.

(function () {
  'use strict';

  const EVENT = 'loot-captain-opendkp-item-data';
  const CONSENT_FRAME_ID = 'loot-captain-opendkp-consent';
  const CONSENT_PATH = '/content/opendkp-consent.html';
  const MAX_RESPONSE_BYTES = 512 * 1024;
  let consentSource = null;

  function isItemRequest(url) {
    try {
      const parsed = new URL(url, location.href);
      return /\/items(?:\/|\?|$)/i.test(parsed.pathname + parsed.search);
    } catch (e) {
      return false;
    }
  }

  function publish(url, data) {
    let detail;
    try { detail = JSON.stringify({ url, data }); } catch (e) { return; }
    if (detail.length > MAX_RESPONSE_BYTES) return;
    document.dispatchEvent(new CustomEvent(EVENT, { detail }));
  }

  function declaredLength(response) {
    const raw = response.headers && response.headers.get && response.headers.get('content-length');
    const length = Number(raw);
    return Number.isFinite(length) ? length : 0;
  }

  async function readLimitedText(response) {
    if (declaredLength(response) > MAX_RESPONSE_BYTES) return null;
    if (!response.body || !response.body.getReader) {
      const text = await response.text();
      return text.length <= MAX_RESPONSE_BYTES ? text : null;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const chunks = [];
    let bytes = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          return null;
        }
        chunks.push(decoder.decode(part.value, { stream: true }));
      }
      chunks.push(decoder.decode());
      return chunks.join('');
    } catch (e) {
      try { await reader.cancel(); } catch (ignored) {}
      return null;
    }
  }

  function hookFetch() {
    if (!window.fetch || window.__lootCaptainFetchHooked) return;
    window.__lootCaptainFetchHooked = true;
    const original = window.fetch;
    window.fetch = function (...args) {
      const promise = original.apply(this, args);
      promise.then((response) => {
        if (!isItemRequest(response.url)) return;
        readLimitedText(response.clone()).then((text) => {
          if (text == null) return;
          try { publish(response.url, JSON.parse(text)); } catch (e) {}
        });
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
          if (typeof response === 'string' && response.length > MAX_RESPONSE_BYTES) return;
          publish(url, typeof response === 'string' ? JSON.parse(response) : response);
        } catch (e) {}
      });
      return originalSend.apply(this, args);
    };
  }

  function activateFromConsent(event) {
    const frame = document.getElementById(CONSENT_FRAME_ID);
    if (consentSource) return;
    if (!event.isTrusted || !frame || event.source !== frame.contentWindow) return;
    let frameOrigin;
    try {
      const frameUrl = new URL(frame.src, location.href);
      if (frameUrl.protocol !== 'chrome-extension:' || frameUrl.pathname !== CONSENT_PATH || frameUrl.search || frameUrl.hash) return;
      frameOrigin = frameUrl.origin;
    } catch (e) { return; }
    if (event.origin !== frameOrigin || !event.data || event.data.type !== 'loot-captain-consent-accepted') return;
    consentSource = event.source;
    hookFetch();
    hookXhr();
    window.removeEventListener('message', activateFromConsent);
  }

  window.addEventListener('message', activateFromConsent);
  const frame = document.getElementById(CONSENT_FRAME_ID);
  if (frame && frame.contentWindow) {
    try {
      const frameUrl = new URL(frame.src, location.href);
      if (frameUrl.protocol === 'chrome-extension:' && frameUrl.pathname === CONSENT_PATH) {
        frame.contentWindow.postMessage({ type: 'loot-captain-consent-probe' }, frameUrl.origin);
      }
    } catch (e) {}
  }
})();
