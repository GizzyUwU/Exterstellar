chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "ext_lp_fetch") return false;

  const url: string = msg.url;
  fetch(url, {
    method: "GET",
    credentials: "omit",
    headers: {"Accept": "text/html"},
    signal: AbortSignal.timeout(6000),
  })
    .then(async r => {
      if (!r.ok) {
        sendResponse({ok: false});
        return;
      }
      const ct = r.headers.get("content-type") ?? "";
      if (!ct.includes("text/html")) {
        sendResponse({ok: false});
        return;
      }
      const html = await r.text();
      sendResponse({ok: true, html});
    })
    .catch(err => {
      console.warn("[Exterstellar | link-preview SW] fetch failed:", err);
      sendResponse({ok: false, error: String(err)});
    });

  return true;
});