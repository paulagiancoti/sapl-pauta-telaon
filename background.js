const DISPLAY_PAGE = chrome.runtime.getURL("display-pauta.html");

async function openOrFocusDisplay(sessionId) {
  const targetUrl = `${DISPLAY_PAGE}?sessionId=${encodeURIComponent(sessionId)}`;
  const tabs = await chrome.tabs.query({});

  const existing = tabs.find(
    (tab) => typeof tab.url === "string" && tab.url.startsWith(DISPLAY_PAGE)
  );

  if (existing?.id) {
    await chrome.tabs.update(existing.id, { url: targetUrl, active: true });
    if (existing.windowId) {
      await chrome.windows.update(existing.windowId, { focused: true });
    }
    return;
  }

  await chrome.windows.create({
    url: targetUrl,
    type: "popup",
    focused: true,
    width: 1920,
    height: 1080
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") return false;

  if (message.type === "sapl-open-pauta-display" && message.sessionId) {
    openOrFocusDisplay(String(message.sessionId))
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error("[SAPL pauta] falha ao abrir display:", err);
        sendResponse({ ok: false, error: String(err) });
      });
    return true;
  }

  return false;
});
