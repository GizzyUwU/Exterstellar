export {};
declare const Exterstellar: import("../types").ExterstellarAPI;

const SEARCH_WRAPPER_ID = "exterstellar-better-goi-search";
const SEARCH_INPUT_ID = "exterstellar-better-goi-search-input";
const SEARCH_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search-icon lucide-search"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>`;
const CHART_CONTROLS_ID = "exterstellar-better-goi-chart-controls";
const STYLE_ID = "exterstellar-better-goi";

// Search bar yippeeeee

interface RowSearchData {
  reviewId: string;
  projectName: string;
  projectId: string;
  userName: string;
  userId: string;
  lengthHours: string;
  age: string;
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

  const lengthHours = cells[4]?.textContent?.trim().toLowerCase() ?? "";
  const userCell = cells[3];
  const age =
    (
      cells[6]?.querySelector("span") as HTMLSpanElement | null
    )?.textContent?.trim() ?? "";
  const userLink = userCell?.querySelector("a") as HTMLAnchorElement | null;
  const userName = userLink?.textContent?.trim().toLowerCase() ?? "";
  let userId = "";
  if (userLink?.href) {
    const match = userLink.href.match(/\/admin\/users\/(\d+)/);
    userId = match?.[1] ?? "";
  }

  return {
    reviewId,
    projectName,
    projectId,
    userName,
    userId,
    lengthHours,
    age,
  };
}

function parseDevTimeToHours(raw: string): number {
  const trimmed = raw.trim();

  const hMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*h/i);
  const mMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*m/i);

  if (hMatch || mMatch) {
    const hours = hMatch ? parseFloat(hMatch[1] ?? "0") : 0;
    const minutes = mMatch ? parseFloat(mMatch[1] ?? "0") : 0;
    return hours + minutes / 60;
  }

  const plain = parseFloat(trimmed);
  return Number.isNaN(plain) ? 0 : plain;
}

function parseRelativeAgeToHours(raw: string): number {
  const s = raw.trim().toLowerCase();
  if (!s) return NaN;
  if (s.includes("just now") || s === "now") return 0;

  const match = s.match(
    /(a|an|\d+(?:\.\d+)?)\s*(second|minute|hour|day|week|month|year)s?/,
  );
  if (!match) return NaN;

  const rawNum = match[1] ?? "1";
  const num = rawNum === "a" || rawNum === "an" ? 1 : parseFloat(rawNum);
  const unit = match[2] ?? "";

  const unitToHours: Record<string, number> = {
    second: 1 / 3600,
    minute: 1 / 60,
    hour: 1,
    day: 24,
    week: 24 * 7,
    month: 24 * 30,
    year: 24 * 365,
  };

  const hoursPerUnit = unitToHours[unit];
  return hoursPerUnit === undefined ? NaN : num * hoursPerUnit;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prevDiag = dp[0] ?? 0;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j] ?? 0;
      dp[j] =
        a[i - 1] === b[j - 1]
          ? prevDiag
          : 1 + Math.min(prevDiag, dp[j] ?? 0, dp[j - 1] ?? 0);
      prevDiag = temp;
    }
  }
  return dp[n] ?? Math.max(m, n);
}

function stringSimilarity(a: string, b: string): number {
  const s1 = a.trim().toLowerCase();
  const s2 = b.trim().toLowerCase();
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.85;

  const dist = levenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  return Math.max(0, 1 - dist / maxLen);
}

function closenessFromDiff(diffHours: number, halfLifeHours: number): number {
  if (!Number.isFinite(diffHours)) return 0;
  return Math.exp((-Math.LN2 * diffHours) / halfLifeHours);
}

interface SWMatchScore {
  row: HTMLTableRowElement;
  score: number;
}

const SW_MATCH_WEIGHTS = {
  projectName: 0.4,
  devTime: 0.25,
  age: 0.15,
  username: 0.2,
};

function scoreRowAgainstSWProject(
  row: HTMLTableRowElement,
  sw: {
    projectName: string;
    devTimeHours: number;
    ageHours: number;
    username: string;
  },
): SWMatchScore {
  const { projectName, userName, lengthHours, age } = getRowSearchData(row);

  const projectSim = stringSimilarity(projectName, sw.projectName);
  const usernameSim = stringSimilarity(userName, sw.username);

  const devTimeDiff = Math.abs(
    parseDevTimeToHours(lengthHours) - sw.devTimeHours,
  );
  const devTimeCloseness = closenessFromDiff(devTimeDiff, 0.5);

  const rowAgeHours = parseRelativeAgeToHours(age);
  const ageDiff = Math.abs(rowAgeHours - sw.ageHours);
  const ageCloseness = closenessFromDiff(ageDiff, 20);

  const score =
    SW_MATCH_WEIGHTS.projectName * projectSim +
    SW_MATCH_WEIGHTS.devTime * devTimeCloseness +
    SW_MATCH_WEIGHTS.age * ageCloseness +
    SW_MATCH_WEIGHTS.username * usernameSim;

  return { row, score };
}

async function handleSWDashLinks(
  id: string,
  cfg: Record<string, string | number | boolean>,
) {
  return await chrome.runtime.sendMessage({
    type: "FETCH_SW_CERT",
    id,
    swCookie: "session=" + cfg.swCookie,
  });
}

async function filterTable(
  query: string,
  cfg: Record<string, string | number | boolean>,
) {
  const q = query.trim().toLowerCase();

  const swMatch = query
    .trim()
    .match(/ds\.shipwrights\.dev\/stardance\/certifications\/([0-9a-f-]{36})/i);

  const table = document.querySelector(".ysws-queue__table-container table");
  if (!table) return;
  const tbody = table.querySelector("tbody");
  const rows = Array.from(
    table.querySelectorAll("tbody tr"),
  ) as HTMLTableRowElement[];

  if (swMatch && cfg.swCookie) {
    const project = await handleSWDashLinks(swMatch[1] ?? "", cfg);

    if (project?.projectName && project?.createdAt) {
      const swProjectName = String(project.projectName).trim().toLowerCase();
      const swDevTimeHours = parseDevTimeToHours(String(project.devTime ?? ""));
      const swAgeHours =
        (Date.now() - new Date(project.createdAt).getTime()) / (1000 * 60 * 60);
      const swUsername = String(project.submitterUsername ?? "")
        .trim()
        .toLowerCase();

      const ranked = rows
        .map((row) =>
          scoreRowAgainstSWProject(row, {
            projectName: swProjectName,
            devTimeHours: swDevTimeHours,
            ageHours: swAgeHours,
            username: swUsername,
          }),
        )
        .sort((a, b) => b.score - a.score);

      for (const { row, score } of ranked) {
        row.style.display = "";
        row.dataset.swMatchScore = score.toFixed(3);
        tbody?.appendChild(row);
      }
      return;
    }
  }

  for (const row of rows) {
    delete row.dataset.swMatchScore;
    if (!q) {
      row.style.display = "";
      continue;
    }
    const { reviewId, projectName, projectId, userName, userId } =
      getRowSearchData(row);

    const matches =
      reviewId.includes(q) ||
      projectName.includes(q) ||
      projectId.includes(q) ||
      userName.includes(q) ||
      userId.includes(q) ||
      reviewId.replace("#", "").includes(q.replace("#", ""));

    row.style.display = matches ? "" : "none";
  }
}

function injectSearchBar(
  form: Element,
  cfg: Record<string, string | number | boolean>,
) {
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
    (_m, text, href) => {
      const safeHref = escapeHtml(String(href));
      return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
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

  const raw = desc.innerHTML ?? "";
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
  if (div.hasAttribute("data-exterstellar-all-project-commits")) return;
  const sectionDetails = document.createElement("section");
  div.setAttribute("data-exterstellar-all-project-commits", "1");
  sectionDetails.classList.add("review-card", "details-card");
  const header = document.createElement("h3");
  header.textContent = "Git Activity";
  sectionDetails.appendChild(header);

  const commitArea = document.createElement("div");
  commitArea.classList.add(
    "details-list",
    "exterstellar-better-goi-commits-list",
  );
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
      for (const commit of commitsData.reverse()) {
        const commitDiv = document.createElement("div");
        commitDiv.classList.add("detail-item");
        const commitKeyMSG = document.createElement("span");
        commitKeyMSG.textContent = commit.message;

        const commitHash = document.createElement("a");
        commitHash.style.float = "right";
        commitHash.style.marginRight = "10px";
        commitHash.textContent = commit.hash.slice(0, 7);
        commitHash.href = commit.url;
        commitHash.target = "_blank";
        commitHash.rel = "noopener noreferrer";
        commitKeyMSG.appendChild(commitHash);
        commitDiv.appendChild(commitKeyMSG);

        const commitKeyDetails = document.createElement("span");
        commitKeyDetails.textContent = `By ${commit.author} · ${formatDate(commit.date)}`;
        commitKeyDetails.classList.add(
          "exterstellar-better-goi-review-commit-details",
        );
        commitDiv.appendChild(commitKeyDetails);
        commitArea.appendChild(commitDiv);
      }
      sectionDetails.appendChild(commitArea);
    }
  }
  div.appendChild(sectionDetails);
}

function handleReviewDetailPage(
  cfg: Record<string, string | number | boolean>,
) {
  if (cfg.git === false || cfg.git === "false") return;
  const sidebar = document.querySelector("div.review-detail-right");
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
    const chartWrapper = document.querySelector(
      `.ysws-dashboard__chart[data-controller="certification--ysws--reviewer-chart"]`,
    );
    const canvas = chartWrapper?.querySelector<HTMLCanvasElement>(
      '[data-certification--ysws--reviewer-chart-target="canvas"]',
    );
    const panel = chartWrapper?.closest(".ysws-dashboard__panel--chart");

    if (canvas && panel) {
      injectChartControls(panel, canvas);
      return;
    }

    attempts += 1;
    if (attempts < 20) requestAnimationFrame(tryInject);
  };

  tryInject();
}

function getCommitUrlsFromItem(item: Element): string[] {
  const svg = item.querySelector("svg.commit-graph");
  if (!svg) return [];

  const anchors = Array.from(svg.querySelectorAll("a[href]")) as SVGAElement[];

  return anchors
    .map((a) => a.getAttribute("href"))
    .filter((href): href is string => !!href);
}

async function openCommitUrlsInTabs(urls: string[]) {
  if (!urls.length) return;
  return chrome.runtime.sendMessage({
    type: "OPEN_TABS",
    urls,
  });
}

function injectOpenAllCommitsButton(item: Element) {
  if (item.hasAttribute("data-exterstellar-open-all-commits")) return;

  const panel = item.querySelector(".devlog-review-panel");
  const panelTitle = panel?.querySelector(".panel-title");
  if (!panelTitle?.parentElement) return;

  const button = document.createElement("button");
  button.type = "button";
  button.classList.add(
    "status-btn",
    "exterstellar-better-goi-commits-window-btn",
  );
  item.setAttribute("data-exterstellar-open-all-commits", "1");
  button.textContent = "Open all commits in window";
  const urls = getCommitUrlsFromItem(item);
  if (urls.length === 0) {
    button.disabled = true;
  }

  button.addEventListener("click", async (e) => {
    e.preventDefault();
    const urls = getCommitUrlsFromItem(item);

    if (!urls.length) {
      console.warn("[Better GOI] No commits found in this panel");
      return;
    }
    await openCommitUrlsInTabs(urls);
  });

  panelTitle.parentElement.insertBefore(button, panelTitle);
}

function handleDevlogReviewPanels(
  cfg: Record<string, string | number | boolean>,
) {
  if (cfg.commitsButton === false || cfg.commitsButton === "false") return;

  const items = document.querySelectorAll(DEVLOG_ITEM_SELECTOR);
  for (const item of Array.from(items)) {
    injectOpenAllCommitsButton(item);
  }
}

function handleRandomProject(cfg: Record<string, string | number | boolean>) {
  if (cfg.randomProjectBTN === false || cfg.randomProjectBTN === "false")
    return;
  if (document.querySelector('[data-exterstellar-random-project-btn]')) return;

  const filtersBTN = document.querySelector("a.ysws-queue__reset-filters");
  if (!filtersBTN) return;

  const button = document.createElement("a");
  button.classList.add("slim", "exterstellar-random-project-btn");
  button.setAttribute("data-exterstellar-random-project-btn", "1");
  button.textContent = "Open a random project";

  button.addEventListener("click", () => {
    const table = document.querySelector(".ysws-queue__table-container table");
    if (!table) return;

    const rows = Array.from(
      table.querySelectorAll("tbody tr"),
    ) as HTMLTableRowElement[];

    if (rows.length === 0) return;

    const links = rows
      .map((row) => row.querySelector<HTMLAnchorElement>("a.ysws-queue__view-btn"))
      .filter((link): link is HTMLAnchorElement => link !== null);

    if (links.length === 0) return;

    const choice = links[Math.floor(Math.random() * links.length)];

    window.open(choice!.href, "_blank");
  });

  filtersBTN.after(button);
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

  .exterstellar-better-goi-commits-window-btn {
    width: 100%;
    margin-bottom: 10px;
    background: var(--color-space-surface-strong);
    color: var(--color-space-text-muted) !important;
  }

  .exterstellar-better-goi-commits-window-btn:hover:not(:disabled) {
    background: var(--color-brand-mint);
    color: var(--color-set-1-bg) !important;
  }

  .exterstellar-better-goi-commits-window-btn:disabled {
      opacity: .6;
      cursor: not-allowed;
  }

  .exterstellar-random-project-btn {
      display: inline-flex;
      align-items: center;
      align-self: flex-end;
      padding: .375rem .75rem;
      min-height: 2rem;
      padding-inline: var(--space-s);
      background: var(--color-set-1-bg);
      border: 2px solid var(--color-set-1-fg-secondary);
      border-radius: var(--profile-radius);
      color: var(--color-space-text) !important;
      font-size: var(--font-size-s);
      font-weight: 700;
      text-decoration: none;
  }

  .exterstellar-random-project-btn:hover {
      background: hsla(0, 0%, 100%, .06);
      border-color: var(--color-brand-highlight);
      color: var(--color-brand-highlight);
      text-decoration: none;
      cursor: pointer;
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
      default: true,
    },
    {
      key: "swCookie",
      label: "SW Cookie (optional)",
      type: "text",
      placeholder: "...",
      default: "",
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
    {
      key: "commitsButton",
      label: "Show 'Open all commits' button on devlog review panels",
      type: "checkbox",
      default: true,
    },
    {
      key: "randomProjectBTN",
      label: "Show 'Open a random project' button on the queue page",
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
        handleRandomProject(cfg);
      }
      if (isReviewDetailPage()) {
        handleReviewDetailPage(cfg);
        handleDevlogMarkdown(cfg);
        handleDevlogReviewPanels(cfg);
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
