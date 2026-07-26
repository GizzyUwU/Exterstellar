async function setCookieRuleImpl(cookieValue: string) {
  const rule: chrome.declarativeNetRequest.Rule = {
    id: 1,
    priority: 1,
    condition: {
      urlFilter: "https://ds.shipwrights.dev/*", // match your real target
      resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST]
    },
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      requestHeaders: [
        {
          header: "cookie",
          operation: chrome.declarativeNetRequest.HeaderOperation.SET,
          value: cookieValue
        }
      ]
    }
  };

  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [1],
    addRules: [rule]
  });
}

async function handleSWDashLinksImpl(id: string, swCookie: string) {
  await setCookieRuleImpl(swCookie);
  const res = await fetch(`https://ds.shipwrights.dev/api/v1/workplaces/stardance/certifications/${id}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if ((msg.type === "GET_CHART_INSTANCE" || msg.type === "CHART_ACTION") && _sender.tab?.id) {
    chrome.scripting
      .executeScript({
        target: {
          tabId: _sender.tab.id,
        },
        world: "MAIN",
        func: (selector, action) => {
          const canvas = document.querySelector(selector);

          if (!(canvas instanceof HTMLCanvasElement)) {
            return { error: "canvas not found" };
          }

          const Chart = (window as any).Chart;
          const chart = Chart?.getChart(canvas);

          if (!chart) {
            return { error: "chart not found" };
          }

          if (!action || action.type === "GET") {
            return {
              exists: true,
              id: chart.id,
              data: {
                labels: chart.data.labels,
                datasets: chart.data.datasets.map((d: any) => ({
                  label: d.label,
                  data: d.data,
                })),
              },
            };
          }

          switch (action.type) {
            case "UPDATE":
              chart.update();
              return { success: true };

            case "DESTROY":
              chart.destroy();
              return { success: true };

            case "SET_DATASET":
              chart.data.datasets[action.dataset].data = action.data;
              chart.update();
              return { success: true };

            case "SET_VISIBILITY": {
              const visibleIndexes = new Set(action.visibleIndexes);

              chart.data.datasets.forEach((_dataset: any, index: number) => {
                chart.setDatasetVisibility(index, visibleIndexes.has(index));
              });

              chart.update();

              return {
                success: true,
              };
            }

            default:
              return {
                error: "unknown action",
              };
          }
        },
        args: [msg.selector, msg.action ?? { type: "GET" }],
      })
      .then(([result]) => {
        sendResponse(result!.result);
      });

    return true;
  }

  if (msg.type === "FETCH_SW_CERT") {
    handleSWDashLinksImpl(msg.id, msg.swCookie).then(sendResponse);
    return true;
  }

  if (msg?.type !== "ext_lp_fetch") return false;

  const url: string = msg.url;
  fetch(url, {
    method: "GET",
    credentials: "omit",
    headers: { Accept: "text/html" },
    signal: AbortSignal.timeout(6000),
  })
    .then(async (r) => {
      if (!r.ok) {
        sendResponse({ ok: false });
        return;
      }
      const ct = r.headers.get("content-type") ?? "";
      if (!ct.includes("text/html")) {
        sendResponse({ ok: false });
        return;
      }
      const html = await r.text();
      sendResponse({ ok: true, html });
    })
    .catch((err) => {
      console.warn("[Exterstellar | link-preview SW] fetch failed:", err);
      sendResponse({ ok: false, error: String(err) });
    });

  return true;
});
