chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== 'loot-captain-offscreen') return false;
  try {
    let value = null;
    if (msg.type === 'PARSE_PROFILE') value = parseProfileHtml(msg.html, msg.profileId);
    if (msg.type === 'PARSE_ITEM') value = parseItemPage(msg.html, msg.expectedId);
    if (msg.type === 'PARSE_SEARCH_ITEM') value = parseSearchItem(msg.html, msg.name);
    if (msg.type === 'PARSE_ITEM_SET') value = parseItemSet(msg.html);
    sendResponse({ ok: true, value });
  } catch (e) {
    sendResponse({ ok: false, error: e && e.message || String(e) });
  }
  return true;
});
