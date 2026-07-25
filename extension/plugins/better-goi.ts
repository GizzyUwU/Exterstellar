export {};
declare const Exterstellar: import("../types").ExterstellarAPI;

const SEARCH_WRAPPER_ID = "exterstellar-better-goi-search";
const SEARCH_INPUT_ID = "exterstellar-better-goi-search-input";
const SEARCH_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search-icon lucide-search"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>`;
const CHART_WRAPPER_SELECTOR =
  '.ysws-dashboard__chart[data-controller="certification--ysws--reviewer-chart"]';
const CHART_CANVAS_SELECTOR =
  '[data-certification--ysws--reviewer-chart-target="canvas"]';
const CHART_PANEL_SELECTOR = ".ysws-dashboard__panel--chart";
const CHART_CONTROLS_ID = "exterstellar-better-goi-chart-controls";
const STYLE_ID = "exterstellar-better-goi";
const REVIEW_DETAIL_SIDEBAR_SELECTOR = "div.review-detail-right";

// Search bar yippeeeee

interface RowSearchData {
  reviewId: string;
  projectName: string;
  projectId: string;
  userName: string;
  userId: string;
}

function getRowSearchData(row: HTMLTableRowElement): RowSearchData {
  const cells = row.querySelectorAll("td");
  const reviewId = cells[0]?.textContent?.trim().toLowerCase() ?? "";

  const projectCell = cells[2];
  const projectLink = projectCell?.querySelector(
    "a",
  ) as HTMLAnchorElement | null;
  const projectName = projectLink?.textContent?.trim().toLowerCase() ?? "";
  let projectId = "";
  if (projectLink?.href) {
    const match = projectLink.href.match(/\/admin\/projects\/(\d+)/);
    projectId = match?.[1] ?? "";
  }

  const userCell = cells[3];
  const userLink = userCell?.querySelector("a") as HTMLAnchorElement | null;
  const userName = userLink?.textContent?.trim().toLowerCase() ?? "";
  let userId = "";
  if (userLink?.href) {
    const match = userLink.href.match(/\/admin\/users\/(\d+)/);
    userId = match?.[1] ?? "";
  }

  return { reviewId, projectName, projectId, userName, userId };
}

async function handleSWDashLinks(id: string, cfg: Record<string, string | number | boolean>) {
  return await chrome.runtime.sendMessage({
    type: "FETCH_SW_CERT",
    id,
    swCookie: "session=" + cfg.swCookie
  });
}

async function filterTable(query: string, cfg: Record<string, string | number | boolean>) {
  let q = query.trim().toLowerCase();
  let isSWLink = false;

  const swMatch = query.trim().match(/ds\.shipwrights\.dev\/stardance\/certifications\/([0-9a-f-]{36})/i);
  if (swMatch && cfg.swCookie) {
    const projectId = await handleSWDashLinks(swMatch[1] ?? "", cfg);
    if (projectId) {
      q = String(projectId).toLowerCase();
      isSWLink = true;
    }
  }

  const table = document.querySelector(".ysws-queue__table-container table");
  if (!table) return;
  const rows = Array.from(
    table.querySelectorAll("tbody tr"),
  ) as HTMLTableRowElement[];
  for (const row of rows) {
    if (!q) {
      row.style.display = "";
      continue;
    }
    const { reviewId, projectName, projectId, userName, userId } =
      getRowSearchData(row);
    const matches = isSWLink
      ? projectId.includes(q)
      : reviewId.includes(q) ||
        projectName.includes(q) ||
        projectId.includes(q) ||
        userName.includes(q) ||
        userId.includes(q) ||
        reviewId.replace("#", "").includes(q.replace("#", ""));
    row.style.display = matches ? "" : "none";
  }
}

function injectSearchBar(form: Element, cfg: Record<string, string | number | boolean>) {
  if (form.previousElementSibling?.id === SEARCH_WRAPPER_ID) return;

  const wrapper = document.createElement("div");
  wrapper.id = SEARCH_WRAPPER_ID;
  wrapper.classList.add("exterstellar-better-goi-search-wrapper");

  const iconSpan = document.createElement("span");
  iconSpan.classList.add("exterstellar-better-goi-search-icon");
  iconSpan.innerHTML = SEARCH_ICON_SVG;

  const search = document.createElement("input");
  search.id = SEARCH_INPUT_ID;
  search.classList.add("exterstellar-better-goi-search");
  search.placeholder =
    "Search by Review ID, Project Name, Project ID, Username or User ID...";
  search.addEventListener("input", () => filterTable(search.value, cfg));

  wrapper.appendChild(search);
  wrapper.appendChild(iconSpan);

  form.parentElement?.insertBefore(wrapper, form);
}

function handleQueuePage(cfg: Record<string, string | number | boolean>) {
  if (cfg.search == false || cfg.search === "false") return;
  const form = document.querySelector("form.ysws-queue__filters");
  if (form) injectSearchBar(form, cfg);

  const search = document.getElementById(
    SEARCH_INPUT_ID,
  ) as HTMLInputElement | null;
  if (search?.value) filterTable(search.value, cfg);
}

// Devlog MD
const DEVLOG_ITEM_SELECTOR = ".devlog-item";
const DEVLOG_DESC_SELECTOR = ".devlog-desc";
const DEVLOG_MD_PROCESSED_ATTR = "data-goi-md-rendered";
 
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
 
function formatInline(escaped: string): string {
  let out = escaped.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  out = out.replace(/(^|[^_])_([^_]+)_(?!_)/g, "$1<em>$2</em>");
  return out;
}
 
function renderDevlogMarkdown(raw: string): string {
  const normalized = raw.replace(/<br\s*\/?>/gi, "\n");
  const lines = normalized.split("\n");
 
  const htmlParts: string[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];
 
  const flushParagraph = () => {
    if (paragraphBuffer.length) {
      htmlParts.push(`<p>${paragraphBuffer.join("<br>")}</p>`);
      paragraphBuffer = [];
    }
  };
 
  const flushList = () => {
    if (listBuffer.length) {
      htmlParts.push(
        `<ul>${listBuffer.map((i) => `<li>${i}</li>`).join("")}</ul>`,
      );
      listBuffer = [];
    }
  };
 
  for (const rawLine of lines) {
    const line = rawLine.trim();
 
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
 
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = (headingMatch[1] ?? "").length;
      const text = formatInline(escapeHtml((headingMatch[2] ?? "").trim()));
      htmlParts.push(`<h${level}>${text}</h${level}>`);
      continue;
    }
 
    const listMatch = line.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      flushParagraph();
      listBuffer.push(formatInline(escapeHtml((listMatch[1] ?? "").trim())));
      continue;
    }
 
    flushList();
    paragraphBuffer.push(formatInline(escapeHtml(line)));
  }
 
  flushParagraph();
  flushList();
 
  return htmlParts.join("");
}
 
function formatDevlogDesc(desc: HTMLElement) {
  if (desc.getAttribute(DEVLOG_MD_PROCESSED_ATTR) === "1") return;
 
  const raw = desc.textContent ?? "";
  if (!raw.trim()) return;
 
  const rendered = renderDevlogMarkdown(raw);
  const replacement = document.createElement("div");
  replacement.className = desc.className;
  replacement.classList.add("exterstellar-better-goi-devlog-md");
  replacement.setAttribute(DEVLOG_MD_PROCESSED_ATTR, "1");
  replacement.innerHTML = rendered;
 
  desc.replaceWith(replacement);
}
 
function handleDevlogMarkdown(cfg: Record<string, string | number | boolean>) {
  if (cfg.markdown === false || cfg.markdown === "false") return;
 
  const items = document.querySelectorAll(DEVLOG_ITEM_SELECTOR);
  for (const item of Array.from(items)) {
    const desc = item.querySelector<HTMLElement>(DEVLOG_DESC_SELECTOR);
    if (desc) formatDevlogDesc(desc);
  }
}
 

// All git commits on review
type Commit = {
  hash: string;
  message: string;
  author: string;
  date: string;
  url: string;
};

async function getGithubCommits(repoUrl: string): Promise<Commit[]> {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/#.]+)/);
  if (!match) return [];

  const [, owner, repo] = match;

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits`,
  );

  if (!res.ok) return [];

  const commits = await res.json();

  return commits.map((c: any) => ({
    hash: c.sha,
    message: c.commit.message,
    author: c.commit.author?.name ?? "Unknown",
    date: c.commit.author?.date ?? "",
    url: `https://github.com/${owner}/${repo}/commit/${c.sha}`,
  }));
}

async function getGitlabCommits(repoUrl: string): Promise<Commit[]> {
  const match = repoUrl.match(/gitlab\.com\/(.+?)(?:\.git)?$/);
  if (!match) return [];

  const projectPath = match[1];
  const project = encodeURIComponent(projectPath ?? "");

  const res = await fetch(
    `https://gitlab.com/api/v4/projects/${project}/repository/commits`,
  );

  if (!res.ok) return [];

  const commits = await res.json();

  return commits.map((c: any) => ({
    hash: c.id,
    message: c.message,
    author: c.author_name,
    date: c.created_at,
    url: `https://gitlab.com/${projectPath}/-/commit/${c.id}`,
  }));
}

async function getCodebergCommits(repoUrl: string): Promise<Commit[]> {
  const match = repoUrl.match(/codeberg\.org\/([^/]+)\/([^/#.]+)/);
  if (!match) return [];

  const [, owner, repo] = match;

  const res = await fetch(
    `https://codeberg.org/api/v1/repos/${owner}/${repo}/commits`,
  );

  if (!res.ok) return [];

  const commits = await res.json();

  return commits.map((c: any) => ({
    hash: c.sha,
    message: c.commit.message,
    author: c.commit.author?.name ?? "Unknown",
    date: c.commit.author?.date ?? "",
    url: `https://codeberg.org/${owner}/${repo}/commit/${c.sha}`,
  }));
}

async function getCommits(repoUrl: string): Promise<Commit[] | 0> {
  if (repoUrl.includes("github.com")) {
    return getGithubCommits(repoUrl);
  }

  if (repoUrl.includes("gitlab.com")) {
    return getGitlabCommits(repoUrl);
  }

  if (repoUrl.includes("codeberg.org")) {
    return getCodebergCommits(repoUrl);
  }

  return 0;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
}

async function injectAllProjectsCommits(div: Element) {
  if (div.querySelector("#allProjectCommits")) return;
  const sectionDetails = document.createElement("section");
  sectionDetails.id = "allProjectCommits"
  sectionDetails.classList.add("review-card", "details-card");
  const header = document.createElement("h3");
  header.textContent = "Git Activity";
  sectionDetails.appendChild(header);

  const commitArea = document.createElement("div");
  commitArea.classList.add("details-list", "exterstellar-better-goi-commits-list");
  const repoLink = Array.from(
    document.querySelectorAll<HTMLAnchorElement>("a.detail-link-btn"),
  ).find((a) => a.textContent?.trim() === "Repo");
  if (!repoLink?.href) {
    const pre = document.createElement("pre");
    pre.textContent = "No repo url provided";
    commitArea.appendChild(pre);
    sectionDetails.appendChild(commitArea);
    div.appendChild(sectionDetails);
    return;
  } else {
    const commitsData = await getCommits(repoLink.href);
    if (commitsData === 0) {
      const pre = document.createElement("pre");
      pre.textContent = "Git Provider is unsupported";
      commitArea.appendChild(pre);
      sectionDetails.appendChild(commitArea);
      div.appendChild(sectionDetails);
      return;
    } else {
      for (const commit of commitsData) {
        const commitDiv = document.createElement("div")
        commitDiv.classList.add("detail-item");
        const commitKeyMSG = document.createElement("span")
        commitKeyMSG.textContent = commit.message;

        const commitHash = document.createElement("a");
        commitHash.style.float = "right";
        commitHash.style.marginRight = "10px";
        commitHash.textContent = commit.hash.slice(0, 7);
        commitHash.href = commit.url;
        commitHash.target = "_blank";
        commitHash.rel = "noopener noreferrer";
        commitKeyMSG.appendChild(commitHash)
        commitDiv.appendChild(commitKeyMSG)

        const commitKeyDetails = document.createElement("span")
        commitKeyDetails.textContent = `By ${commit.author} · ${formatDate(commit.date)}`;
        commitKeyDetails.classList.add("exterstellar-better-goi-review-commit-details")
        commitDiv.appendChild(commitKeyDetails)
        commitArea.appendChild(commitDiv);
      }
      sectionDetails.appendChild(commitArea);
    }
  }
  div.appendChild(sectionDetails);
}

function handleReviewDetailPage(cfg: Record<string, string | number | boolean>) {
  if (cfg.git === false || cfg.git === "false") return;
  const sidebar = document.querySelector(REVIEW_DETAIL_SIDEBAR_SELECTOR);
  if (sidebar) injectAllProjectsCommits(sidebar);
}

// Devlog review chart mods bleh

function getMyUsername(): string | null {
  const handleEl = document.querySelector<HTMLAnchorElement>(
    ".sidebar__user-meta-handle",
  );
  if (!handleEl) return null;
  const text = handleEl.textContent?.trim() ?? "";
  if (!text) return null;
  return text.replace(/^@/, "").toLowerCase();
}

function getSelector(canvas: HTMLCanvasElement) {
  if (canvas.id) return `#${canvas.id}`;
  return `canvas[data-certification--ysws--reviewer-chart-target="${canvas.dataset["certification-Ysws-ReviewerChartTarget"]}"]`;
}
async function getChartInstance(
  canvas: HTMLCanvasElement,
): Promise<any | null> {
  const selector = getSelector(canvas);

  const chartStuff = await chrome.runtime.sendMessage({
    type: "GET_CHART_INSTANCE",
    selector,
  });

  if (!chartStuff?.exists) return null;

  return {
    id: chartStuff.id,

    get data() {
      return chartStuff.data;
    },

    update: async () => {
      return chrome.runtime.sendMessage({
        type: "CHART_ACTION",
        selector,
        action: {
          type: "UPDATE",
        },
      });
    },

    destroy: async () => {
      return chrome.runtime.sendMessage({
        type: "CHART_ACTION",
        selector,
        action: {
          type: "DESTROY",
        },
      });
    },

    setDataset: async (dataset: number, data: any[]) => {
      return chrome.runtime.sendMessage({
        type: "CHART_ACTION",
        selector,
        action: {
          type: "SET_DATASET",
          dataset,
          data,
        },
      });
    },

    setDatasetVisibility: async (predicate: (label: string) => boolean) => {
      const datasets = chartStuff.data.datasets.map((d: any) =>
        (d.label ?? "").toLowerCase(),
      );

      return chrome.runtime.sendMessage({
        type: "CHART_ACTION",
        selector,
        action: {
          type: "SET_VISIBILITY",
          visibleIndexes: datasets
            .map((label: string, index: number) =>
              predicate(label) ? index : -1,
            )
            .filter((i: number) => i !== -1),
        },
      });
    },
  };
}

async function setDatasetVisibility(
  chart: any,
  predicate: (label: string) => boolean,
) {
  if (typeof chart.setDatasetVisibility === "function") {
    return chart.setDatasetVisibility(predicate);
  }
}

function injectChartControls(panel: Element, canvas: HTMLCanvasElement) {
  if (document.getElementById(CHART_CONTROLS_ID)) return;

  const heading = panel.querySelector(".ysws-dashboard__heading");
  if (!heading) return;

  const wrapper = document.createElement("div");
  wrapper.id = CHART_CONTROLS_ID;
  wrapper.classList.add("exterstellar-better-goi-chart-controls");

  const onlyMeBtn = document.createElement("button");
  onlyMeBtn.type = "button";
  onlyMeBtn.textContent = "Only show me";
  onlyMeBtn.classList.add("exterstellar-better-goi-chart-button");
  onlyMeBtn.addEventListener("click", async () => {
    const username = getMyUsername();
    const chart = await getChartInstance(canvas);
    if (!username || !chart) return;
    await setDatasetVisibility(chart, (label) => {
      return label === username;
    });
  });

  const showAllBtn = document.createElement("button");
  showAllBtn.type = "button";
  showAllBtn.textContent = "Show all";
  showAllBtn.classList.add("exterstellar-better-goi-chart-button");
  showAllBtn.addEventListener("click", async () => {
    const chart = await getChartInstance(canvas);
    if (!chart) return;
    await setDatasetVisibility(chart, () => true);
  });

  wrapper.appendChild(onlyMeBtn);
  wrapper.appendChild(showAllBtn);
  heading.insertAdjacentElement("afterend", wrapper);
}

function handleChartControls(cfg: Record<string, string | number | boolean>) {
  if (document.getElementById(CHART_CONTROLS_ID)) return;
  if (cfg.graphs == false || cfg.graphs === "false") return;
  let attempts = 0;
  const tryInject = () => {
    const chartWrapper = document.querySelector(CHART_WRAPPER_SELECTOR);
    const canvas = chartWrapper?.querySelector<HTMLCanvasElement>(
      CHART_CANVAS_SELECTOR,
    );
    const panel = chartWrapper?.closest(CHART_PANEL_SELECTOR);

    if (canvas && panel) {
      injectChartControls(panel, canvas);
      return;
    }

    attempts += 1;
    if (attempts < 20) requestAnimationFrame(tryInject);
  };

  tryInject();
}

const GOI_CSS = `
  .exterstellar-better-goi-search-wrapper {
    position: relative;
    margin-bottom: 10px;
  }

  .exterstellar-better-goi-search {
      width: 100%;
      height: 39px;
      padding: 0 38px 0 34px;
      border: 2px solid var(--color-border-input);
      border-radius: var(--profile-radius);
      background: var(--color-set-2-bg);
      color: var(--color-space-text);
      font-family: var(--font-family-text);
      font-size: var(--font-size-s);
  }

  .exterstellar-better-goi-search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    color: white;
    pointer-events: none;
  }

  .exterstellar-better-goi-chart-controls {
    display: flex;
    gap: 8px;
    margin: 8px 0 12px;
  }

  .exterstellar-better-goi-chart-button {
    padding: 6px 12px;
    border: 2px solid var(--color-border-input);
    border-radius: var(--profile-radius);
    background: var(--color-set-2-bg);
    color: var(--color-space-text);
    font-family: var(--font-family-text);
    font-size: var(--font-size-s);
    cursor: pointer;
  }

  .exterstellar-better-goi-chart-button:hover {
    filter: brightness(1.1);
  }

  .exterstellar-better-goi-review-commit-details {
    color: var(--color-space-text-muted);
    font-style: italic;
  }

  .exterstellar-better-goi-commits-list {
    max-height: 350px;
    overflow-y: auto;
  }

  body::-webkit-scrollbar {
    width: 12px;
    background: rgba(0, 0, 0, 0.3);
  }
  
  /* Track */
  body::-webkit-scrollbar-track {
    width: 12px;
    background:  rgba(5, 4, 24, 0.02);
  }
  
  body::-webkit-scrollbar-thumb {
    width: 12px;
    background: rgba(0, 0, 0, 0.3);
    
  }
  
  body::-webkit-scrollbar-thumb:hover {
    width: 12px;
  }

  .certification-ysws .review-detail-right.is-popup-mode {
    overflow-y: scroll;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .certification-ysws .review-detail-right.is-popup-mode::-webkit-scrollbar {
    display: none;
  }
`;

if (sessionStorage.getItem("_ext_better-goi_pre") === "1") {
  const pre = document.createElement("style");
  pre.id = STYLE_ID;
  pre.textContent = GOI_CSS;
  document.documentElement.appendChild(pre);
}

Exterstellar.register({
  id: "better-goi",
  name: "Better GOI",
  description: "The GOI dash you always wanted! Cuz well you know it sucks",
  author: "Gizzy",
  config: [
    {
      key: "preload",
      label: "Preload CSS before paint",
      type: "checkbox",
      default: true
    },
    {
      key: "swCookie",
      label: "SW Cookie (optional)",
      type: "text",
      placeholder: "...",
      default: ""
    },
    {
      key: "search",
      label: "Show a search bar",
      type: "checkbox",
      default: true,
    },
    {
      key: "git",
      label: "Show all git activity in review sidebar panel",
      type: "checkbox",
      default: true,
    },
    {
      key: "graphs",
      label: "Show graph buttons such as Only show me",
      type: "checkbox",
      default: true,
    },
  ],
  start() {
    const cfg = Exterstellar.getConfig("better-goi");
    const isReviewPage = window.location.pathname.includes(
      "/admin/certification/review",
    );
    if (!isReviewPage) return;

    const preload = cfg.preload !== false && cfg.preload !== "false";
    sessionStorage.setItem("_ext_better-goi_pre", preload ? "1" : "0");

    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = GOI_CSS;
    }
    document.head.appendChild(style);

    const isQueueListPage = () =>
      /^\/admin\/certification\/review\/?$/.test(window.location.pathname);
    const isReviewDetailPage = () =>
      /^\/admin\/certification\/review\/[^/]+\/?$/.test(
        window.location.pathname,
      );

    const onTurboUpdate = () => {
      if (isQueueListPage()) {
        handleQueuePage(cfg);
        handleChartControls(cfg);
      }
      if (isReviewDetailPage()) {
        handleReviewDetailPage(cfg);
        handleDevlogMarkdown(cfg);
      }
    };

    document.addEventListener("turbo:load", onTurboUpdate);
    document.addEventListener("turbo:frame-load", onTurboUpdate);

    onTurboUpdate();

    return function cleanup() {
      style?.remove();
      document.removeEventListener("turbo:load", onTurboUpdate);
      document.removeEventListener("turbo:frame-load", onTurboUpdate);
      document.getElementById(SEARCH_WRAPPER_ID)?.remove();
      document.getElementById(CHART_CONTROLS_ID)?.remove();
    };
  },
});