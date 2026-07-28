export {};
declare const Exterstellar: import("../types").ExterstellarAPI;

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
  if (form.previousElementSibling?.id === "exterstellar-better-goi-search")
    return;

  const wrapper = document.createElement("div");
  wrapper.id = "exterstellar-better-goi-search";
  wrapper.classList.add("exterstellar-better-goi-search-wrapper");

  const iconSpan = document.createElement("span");
  iconSpan.classList.add("exterstellar-better-goi-search-icon");
  iconSpan.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search-icon lucide-search">
      <path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>
    </svg>
  `;

  const search = document.createElement("input");
  search.id = "exterstellar-better-goi-search-input";
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
    "exterstellar-better-goi-search-input",
  ) as HTMLInputElement | null;
  if (search?.value) filterTable(search.value, cfg);
}

// Devlog MD
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let slackEmojiMap: Record<any, any> = {};
async function fetchSlackEmojis() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_SLACK_EMOJIS" }, (data) => {
      if (data && data.ok) {
        slackEmojiMap = data.emoji;
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

let emojiSupportEnabled = true;
let emojiMapLoaded = false;
let emojiMapLoadingPromise: Promise<void> | null = null;

async function ensureSlackEmojisLoaded(
  cfg: Record<string, string | number | boolean>,
): Promise<void> {
  if (cfg.emojiSupport === false || cfg.emojiSupport === "false") return;
  if (emojiMapLoadingPromise) return emojiMapLoadingPromise;
  emojiMapLoadingPromise = fetchSlackEmojis().then(() => {
    emojiMapLoaded = true;
  });
  return emojiMapLoadingPromise;
}

function formatEmoji(escaped: string): string {
  return escaped.replace(/:([a-z0-9_+\-]+):/gi, (match, name) => {
    const url = slackEmojiMap[name.toLowerCase()];
    if (!url) return match;
    const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=20&h=20&fit=contain`;
    return `<img src="${proxyUrl}" alt=":${name}:" title=":${name}:" class="exterstellar-better-goi-emoji">`;
  });
}

function formatInline(escaped: string): string {
  let out = emojiSupportEnabled ? formatEmoji(escaped) : escaped;
  out = out.replace(
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
  if (desc.getAttribute("data-goi-md-rendered") === "1") return;

  const raw = desc.innerHTML ?? "";
  if (!raw.trim()) return;

  const rendered = renderDevlogMarkdown(raw);
  const replacement = document.createElement("div");
  replacement.className = desc.className;
  replacement.classList.add("exterstellar-better-goi-devlog-md");
  replacement.setAttribute("data-goi-md-rendered", "1");
  replacement.innerHTML = rendered;

  desc.replaceWith(replacement);
}

async function handleDevlogMarkdown(
  cfg: Record<string, string | number | boolean>,
) {
  if (cfg.markdown === false || cfg.markdown === "false") return;

  emojiSupportEnabled =
    cfg.emojiSupport !== false && cfg.emojiSupport !== "false";
  if (emojiSupportEnabled) await ensureSlackEmojisLoaded(cfg);

  const items = document.querySelectorAll(".devlog-item");
  for (const item of Array.from(items)) {
    const desc = item.querySelector<HTMLElement>(".devlog-desc");
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
  if (document.getElementById("exterstellar-better-goi-chart-controls")) return;

  const heading = panel.querySelector(".ysws-dashboard__heading");
  if (!heading) return;

  const wrapper = document.createElement("div");
  wrapper.id = "exterstellar-better-goi-chart-controls";
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

function findReviewerChartElements(): {
  canvas: HTMLCanvasElement;
  panel: Element;
} | null {
  const chartWrapper = document.querySelector(
    `.ysws-dashboard__chart[data-controller="certification--ysws--reviewer-chart"]`,
  );
  const canvas = chartWrapper?.querySelector<HTMLCanvasElement>(
    '[data-certification--ysws--reviewer-chart-target="canvas"]',
  );
  const panel = chartWrapper?.closest(".ysws-dashboard__panel--chart");

  if (canvas && panel) return { canvas, panel };
  return null;
}

function handleChartControls(cfg: Record<string, string | number | boolean>) {
  if (document.getElementById("exterstellar-better-goi-chart-controls")) return;
  if (cfg.graphs == false || cfg.graphs === "false") return;
  let attempts = 0;
  const tryInject = () => {
    const found = findReviewerChartElements();
    if (found) {
      injectChartControls(found.panel, found.canvas);
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

  const items = document.querySelectorAll(".devlog-item");
  for (const item of Array.from(items)) {
    injectOpenAllCommitsButton(item);
  }
}

function handleRandomProject(cfg: Record<string, string | number | boolean>) {
  if (cfg.randomProjectBTN === false || cfg.randomProjectBTN === "false")
    return;
  if (document.querySelector("[data-exterstellar-random-project-btn]")) return;

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
      .map((row) =>
        row.querySelector<HTMLAnchorElement>("a.ysws-queue__view-btn"),
      )
      .filter((link): link is HTMLAnchorElement => link !== null);

    if (links.length === 0) return;

    const choice = links[Math.floor(Math.random() * links.length)];

    const w = window.open(choice!.href, "_blank", "noopener,noreferrer");
    if (w) w.opener = null;
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

  .exterstellar-better-goi-week-stat {
      display: flex;
      align-items: baseline;
      align-self: flex-end;
      gap: var(--space-xs);
      padding: var(--space-xs) var(--space-s);
      background: var(--color-set-1-bg);
      border: 2px solid var(--color-set-1-fg-secondary);
      border-radius: var(--profile-radius);
  }

  .exterstellar-better-goi-sortable-th {
    cursor: pointer;
    user-select: none;
  }

  .exterstellar-better-goi-sortable-th:hover {
    color: var(--color-brand-highlight);
  }

  .exterstellar-better-goi-sort-indicator {
    font-size: 0.75em;
    opacity: 0.8;
  }

  .exterstellar-better-goi-approve-all-link {
    color: inherit;
    text-decoration: underline;
    font-weight: 600;
    cursor: pointer;
  }

  .exterstellar-better-goi-approve-all-link:hover {
    opacity: 0.85;
  }

  .exterstellar-better-goi-emoji {
    width: 20px;
    height: 20px;
    vertical-align: middle;
    display: inline-block;
  }

  .ysws-dashboard {
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(5, 1fr);
  }

  .ysws-dashboard__panel--leaderboard {
    grid-row: span 5 / span 5;
  }

  .ysws-dashboard__panel--chart {
    grid-row: span 4 / span 4;
  }

  #exterstellar-better-goi-personal-standing {
    display: flex;
    flex-direction: column;
    flex-basis: 50%;
    justify-content: flex-end;
    gap: 8px;
    grid-column-start: 2;
    grid-row-start: 5;
  }

  .exterstellar-better-goi-top-value {
    color: var(--color-brand-highlight) !important;
    font-weight: 700;
  }

  .exterstellar-better-goi-rank-gain {
    color: var(--color-brand-highlight) !important;
    font-weight: 700;
  }
`;

// User weekly devlogs
function parseLabelToDate(label: string, reference: Date): Date {
  const [monthStr, dayStr] = label.split("/");
  const month = parseInt(monthStr ?? "1", 10) - 1;
  const day = parseInt(dayStr ?? "1", 10);

  let year = reference.getFullYear();
  let date = new Date(year, month, day);

  const diffDays = (date.getTime() - reference.getTime()) / 86_400_000;
  if (diffDays > 180) {
    date = new Date(year - 1, month, day);
  } else if (diffDays < -180) {
    date = new Date(year + 1, month, day);
  }

  return date;
}

function getWeekRange(reference: Date): { start: Date; end: Date } {
  const day = reference.getDay();
  const diffToMonday = (day + 6) % 7;

  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - diffToMonday);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function extractPointValue(point: any): number {
  if (typeof point === "number") return point;
  if (point && typeof point.y === "number") return point.y;
  return 0;
}

async function computeWeeklyCountForUsername(
  chart: any,
  username: string,
  now: Date,
): Promise<number | null> {
  const labels: string[] = chart.data.labels ?? [];
  const dataset = chart.data.datasets.find(
    (d: any) => (d.label ?? "").trim().toLowerCase() === username,
  );
  if (!dataset?.data || !labels.length) return null;

  const { start, end } = getWeekRange(now);

  let sum = 0;
  for (let i = 0; i < labels.length; i++) {
    const labelDate = parseLabelToDate(labels[i] ?? "", now);
    if (labelDate >= start && labelDate <= end) {
      sum += extractPointValue(dataset.data[i]);
    }
  }

  return sum;
}

async function computeMyWeeklyDevlogCount(): Promise<number | null> {
  const found = findReviewerChartElements();
  if (!found) return null;

  const username = getMyUsername();
  if (!username) return null;

  const chart = await getChartInstance(found.canvas);
  if (!chart) return null;

  return computeWeeklyCountForUsername(chart, username, new Date());
}

const WEEK_STAT_ID = "exterstellar-better-goi-week-stat";

async function injectWeeklyStat(goalEl: Element) {
  if (document.getElementById(WEEK_STAT_ID)) return;

  const wrapper = document.createElement("div");
  wrapper.id = WEEK_STAT_ID;
  wrapper.classList.add("exterstellar-better-goi-week-stat");
  wrapper.setAttribute("role", "status");
  wrapper.setAttribute("aria-live", "polite");

  const span = document.createElement("span");
  span.classList.add("ysws-queue__goal-label");
  span.textContent = "Checking your week...";
  wrapper.appendChild(span);

  goalEl.after(wrapper);

  const count = await computeMyWeeklyDevlogCount();
  if (count === null) {
    wrapper.remove();
    return;
  }

  span.textContent = `You've reviewed ${count} devlog${count === 1 ? "" : "s"} this week`;
}

function handleWeeklyStat(cfg: Record<string, string | number | boolean>) {
  if (cfg.weeklyStat === false || cfg.weeklyStat === "false") return;
  if (document.getElementById(WEEK_STAT_ID)) return;

  let attempts = 0;
  const tryInject = () => {
    const goalEl = document.querySelector(".ysws-queue__goal");
    if (goalEl) {
      injectWeeklyStat(goalEl);
      return;
    }
    attempts += 1;
    if (attempts < 20) requestAnimationFrame(tryInject);
  };

  tryInject();
}

// Weekly stats on lb
const WEEKLY_COL_MARKER_ATTR = "data-exterstellar-weekly-col";

function getUsernameFromLeaderboardRow(
  row: HTMLTableRowElement,
): string | null {
  const link = row.querySelector<HTMLAnchorElement>("a[href^='/admin/users/']");
  const text = link?.textContent?.trim() ?? "";
  return text ? text.toLowerCase() : null;
}

async function injectWeeklyLeaderboardColumn(
  table: HTMLTableElement,
  cfg: Record<string, string | number | boolean>,
) {
  if (table.hasAttribute(WEEKLY_COL_MARKER_ATTR)) return;
  table.setAttribute(WEEKLY_COL_MARKER_ATTR, "1");

  const found = findReviewerChartElements();
  if (!found) return;

  const chart = await getChartInstance(found.canvas);
  if (!chart) return;

  const showRankChange = cfg.rankChange !== false && cfg.rankChange !== "false";
  const showDaysOnTop = cfg.daysOnTop !== false && cfg.daysOnTop !== "false";
  const showHighlights = cfg.leaderboardHighlights !== false && cfg.leaderboardHighlights !== "false";

  const headRow = table.querySelector("thead tr");
  if (headRow) {
    const th = document.createElement("th");
    th.classList.add("ysws-dashboard__col-num");
    th.textContent = "This week";
    headRow.appendChild(th);

    if (showRankChange) {
      const rankTh = document.createElement("th");
      rankTh.classList.add("ysws-dashboard__col-num");
      rankTh.textContent = "Past 7 days";
      headRow.appendChild(rankTh);
    }

    if (showDaysOnTop) {
      const daysOnTopTh = document.createElement("th");
      daysOnTopTh.classList.add("ysws-dashboard__col-num", SORTABLE_TH_CLASS);
      daysOnTopTh.textContent = "Days on top";
      headRow.appendChild(daysOnTopTh);
    }
  }

  const now = new Date();
  const labels: string[] = chart.data.labels ?? [];
  const cutoffIndex = Math.max(0, labels.length - 7);
  const priorRanks = showRankChange
    ? computeRanksAtCutoff(chart, cutoffIndex)
    : null;
  const daysOnTop = showDaysOnTop ? computeDaysOnTop(chart) : null;

  const rows = Array.from(
    table.querySelectorAll("tbody tr"),
  ) as HTMLTableRowElement[];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const username = getUsernameFromLeaderboardRow(row);
    const count = username
      ? await computeWeeklyCountForUsername(chart, username, now)
      : null;

    const td = document.createElement("td");
    td.classList.add("ysws-dashboard__col-num");
    td.textContent = count === null ? "0" : String(count);
    row.appendChild(td);

    if (showRankChange && priorRanks) {
      const currentRank = i + 1;
      const previousRank = username ? priorRanks.get(username) : undefined;
      const rankTd = document.createElement("td");
      rankTd.classList.add("ysws-dashboard__col-num");
      rankTd.textContent = formatRankChange(currentRank, previousRank);
      row.appendChild(rankTd);
    }

    if (showDaysOnTop && daysOnTop) {
      const daysOnTopTd = document.createElement("td");
      daysOnTopTd.classList.add("ysws-dashboard__col-num");
      daysOnTopTd.textContent = String(
        username ? (daysOnTop.get(username) ?? 0) : 0,
      );
      row.appendChild(daysOnTopTd);
    }
  }

  if (showHighlights) highlightLeaderboardColumns(table);
}

function handleWeeklyLeaderboardColumn(
  cfg: Record<string, string | number | boolean>,
): Promise<void> {
  if (
    cfg.weeklyLeaderboardColumn === false ||
    cfg.weeklyLeaderboardColumn === "false"
  )
    return Promise.resolve();

  const table = document.querySelector<HTMLTableElement>(
    ".ysws-dashboard__table",
  );
  if (!table) return Promise.resolve();
  return injectWeeklyLeaderboardColumn(table, cfg);
}

// LB filters
const LEADERBOARD_SORT_INIT_ATTR = "data-exterstellar-lb-sort-init";
const SORTABLE_TH_CLASS = "exterstellar-better-goi-sortable-th";
const SORT_INDICATOR_CLASS = "exterstellar-better-goi-sort-indicator";
const NUMERIC_COL_CLASS = "ysws-dashboard__col-num";
const RANK_COL_CLASS = "ysws-dashboard__col-rank";

type SortDirection = "asc" | "desc";

function parseNumericCellValue(td: HTMLTableCellElement | null): number {
  const raw = (td?.textContent ?? "").replace(/,/g, "").trim();
  const value = parseFloat(raw);
  return Number.isNaN(value) ? -Infinity : value;
}

function clearSortIndicators(headRow: HTMLTableRowElement) {
  const sortableThs = headRow.querySelectorAll<HTMLTableCellElement>(
    `.${SORTABLE_TH_CLASS}`,
  );
  for (const th of Array.from(sortableThs)) {
    th.removeAttribute("aria-sort");
    delete th.dataset.sortDir;
    th.querySelector(`.${SORT_INDICATOR_CLASS}`)?.remove();
  }
}

function markSortIndicator(th: HTMLTableCellElement, direction: SortDirection) {
  th.setAttribute(
    "aria-sort",
    direction === "asc" ? "ascending" : "descending",
  );
  const indicator = document.createElement("span");
  indicator.classList.add(SORT_INDICATOR_CLASS);
  indicator.textContent = direction === "asc" ? " ▲" : " ▼";
  th.appendChild(indicator);
}

function sortLeaderboardTable(
  table: HTMLTableElement,
  columnIndex: number,
  direction: SortDirection,
) {
  const tbody = table.querySelector("tbody");
  if (!tbody) return;

  const rows = Array.from(
    tbody.querySelectorAll("tr"),
  ) as HTMLTableRowElement[];

  const sorted = rows
    .map((row) => ({
      row,
      value: parseNumericCellValue(
        row.querySelectorAll("td")[columnIndex] ?? null,
      ),
    }))
    .sort((a, b) =>
      direction === "asc" ? a.value - b.value : b.value - a.value,
    );

  for (const { row } of sorted) {
    tbody.appendChild(row);
  }

  const rankCells = Array.from(
    tbody.querySelectorAll(`tr > td.${RANK_COL_CLASS}`),
  ) as HTMLTableCellElement[];
  rankCells.forEach((cell, i) => {
    cell.textContent = String(i + 1);
  });
}

function makeColumnSortable(
  table: HTMLTableElement,
  headRow: HTMLTableRowElement,
  th: HTMLTableCellElement,
  columnIndex: number,
) {
  if (th.classList.contains(SORTABLE_TH_CLASS)) return;
  const columnLabel = th.textContent?.trim() ?? "";
  th.classList.add(SORTABLE_TH_CLASS);
  th.setAttribute("tabindex", "0");
  th.setAttribute("role", "button");

  const activate = () => {
    const currentDir = th.dataset.sortDir;
    const nextDir: SortDirection = currentDir === "desc" ? "asc" : "desc";

    clearSortIndicators(headRow);
    th.dataset.sortDir = nextDir;
    markSortIndicator(th, nextDir);
    sortLeaderboardTable(table, columnIndex, nextDir);
    try {
      localStorage.setItem(
        "exterstellar-better-goi-lb-sort",
        JSON.stringify({
          column: columnLabel,
          dir: nextDir,
        }),
      );
    } catch (e) {}
  };

  th.addEventListener("click", activate);
  th.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  });
}

function loadLeaderboardSortState(): {
  column: string;
  dir: SortDirection;
} | null {
  try {
    const raw = localStorage.getItem("exterstellar-better-goi-lb-sort");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.column === "string" &&
      (parsed.dir === "asc" || parsed.dir === "desc")
    ) {
      return parsed as { column: string; dir: SortDirection };
    }
    return null;
  } catch {
    return null;
  }
}

function restoreLeaderboardSort(
  table: HTMLTableElement,
  headRow: HTMLTableRowElement,
) {
  const ths = Array.from(
    headRow.querySelectorAll("th"),
  ) as HTMLTableCellElement[];

  if (ths.some((th) => th.dataset.sortDir)) return;
  const saved = loadLeaderboardSortState();
  if (!saved) return;

  const index = ths.findIndex(
    (th) =>
      th.classList.contains(SORTABLE_TH_CLASS) &&
      (th.textContent ?? "").trim() === saved.column,
  );
  if (index === -1) return;
  console.log("aaa");

  const th = ths[index]!;
  clearSortIndicators(headRow);
  th.dataset.sortDir = saved.dir;
  markSortIndicator(th, saved.dir);
  sortLeaderboardTable(table, index, saved.dir);
}

function makeAllNumericColumnsSortable(
  table: HTMLTableElement,
  headRow: HTMLTableRowElement,
) {
  const ths = Array.from(headRow.querySelectorAll("th"));
  ths.forEach((th, index) => {
    if (!th.classList.contains(NUMERIC_COL_CLASS)) return;
    makeColumnSortable(table, headRow, th as HTMLTableCellElement, index);
  });
}

function observeLeaderboardHeader(
  table: HTMLTableElement,
  headRow: HTMLTableRowElement,
) {
  if (table.hasAttribute(LEADERBOARD_SORT_INIT_ATTR)) return;
  table.setAttribute(LEADERBOARD_SORT_INIT_ATTR, "1");

  const observer = new MutationObserver(() => {
    makeAllNumericColumnsSortable(table, headRow);
  });
  observer.observe(headRow, { childList: true });
}

function initLeaderboardSorting(table: HTMLTableElement) {
  const headRow = table.querySelector("thead tr") as HTMLTableRowElement | null;
  if (!headRow) return;

  makeAllNumericColumnsSortable(table, headRow);
  observeLeaderboardHeader(table, headRow);
}

function finalizeLeaderboardSortRestore(
  cfg: Record<string, string | number | boolean>,
) {
  if (cfg.leaderboardSorting === false || cfg.leaderboardSorting === "false")
    return;

  const table = document.querySelector<HTMLTableElement>(
    ".ysws-dashboard__table",
  );
  const headRow = table?.querySelector(
    "thead tr",
  ) as HTMLTableRowElement | null;
  if (table && headRow) restoreLeaderboardSort(table, headRow);
}

function handleLeaderboardSorting(
  cfg: Record<string, string | number | boolean>,
) {
  if (cfg.leaderboardSorting === false || cfg.leaderboardSorting === "false")
    return;

  const table = document.querySelector<HTMLTableElement>(
    ".ysws-dashboard__table",
  );
  if (table) initLeaderboardSorting(table);
}

// Approve all devlogs missing a verdict hyperlink
function getMissingVerdictItems(): Element[] {
  const items = Array.from(document.querySelectorAll(".devlog-item"));
  return items.filter((item) => {
    const status = item.getAttribute(
      "data-certification--ysws--devlog-review-status-value",
    );
    if (status === "rejected" || status === "approved") return false;

    const isLocked = item.querySelector(".devlog-header-row .status-frozen");
    if (isLocked) return false;

    return true;
  });
}

function approveAllMissingVerdict() {
  const items = getMissingVerdictItems();
  for (const item of items) {
    const approveBtn = item.querySelector<HTMLButtonElement>(
      '[data-certification--ysws--devlog-review-target="approveButton"]',
    );
    approveBtn?.click();
  }

  const closeBtn = document.querySelector<HTMLButtonElement>(".alert__close");
  closeBtn?.click();
}

function injectApproveAllLink(alertContent: HTMLElement) {
  if (document.getElementById("exterstellar-better-goi-approve-all-link"))
    return;

  const link = document.createElement("a");
  link.id = "exterstellar-better-goi-approve-all-link";
  link.href = "#";
  link.textContent = "Approve all devlogs missing a verdict?";
  link.classList.add("exterstellar-better-goi-approve-all-link");
  link.addEventListener("click", (e) => {
    e.preventDefault();
    approveAllMissingVerdict();
  });

  alertContent.appendChild(document.createTextNode(" "));
  alertContent.appendChild(link);
}

function checkFlashForMissingVerdict() {
  if (
    !/^\/admin\/certification\/review\/[^/]+\/?$/.test(window.location.pathname)
  )
    return;

  const flashContainer = document.querySelector(".flash-container");
  const alertContent =
    flashContainer?.querySelector<HTMLElement>(".alert__content");
  if (!alertContent) return;

  const text = alertContent.textContent ?? "";
  if (!text.includes("Review all devlogs before completing")) return;
  if (alertContent.hasAttribute("data-exterstellar-approve-all-injected"))
    return;

  alertContent.setAttribute("data-exterstellar-approve-all-injected", "1");
  injectApproveAllLink(alertContent);
}

let approveAllObserverAttached = false;

function handleApproveAllMissingVerdict(
  cfg: Record<string, string | number | boolean>,
) {
  if (
    cfg.approveAllMissingVerdict === false ||
    cfg.approveAllMissingVerdict === "false"
  )
    return;

  checkFlashForMissingVerdict();

  if (approveAllObserverAttached) return;
  approveAllObserverAttached = true;

  const observer = new MutationObserver(() => {
    checkFlashForMissingVerdict();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

if (sessionStorage.getItem("_ext_better-goi_pre") === "1") {
  const pre = document.createElement("style");
  pre.id = "exterstellar-better-goi";
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
      key: "markdown",
      label: "Use extension's markdown support in reviews",
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
    {
      key: "weeklyStat",
      label: "Show your weekly devlog review count next to the goal",
      type: "checkbox",
      default: true,
    },
    {
      key: "rankChange",
      label: "Show rank change vs 7 days ago on leaderboard",
      type: "checkbox",
      default: true,
    },
    {
      key: "daysOnTop",
      label: "Show days spent as #1 reviewer on that day",
      type: "checkbox",
      default: true,
    },
    {
      key: "approveAllMissingVerdict",
      label:
        "Show 'Approve all missing verdict' link on incomplete-review error",
      type: "checkbox",
      default: true,
    },
    {
      key: "emojiSupport",
      label: "Render Slack emoji shortcodes in devlog markdown",
      type: "checkbox",
      default: true,
    },
    {
      key: "sidebarToggleHotkey",
      label: "Press Tab to toggle the project details sidebar",
      type: "checkbox",
      default: true,
    },
    {
      key: "personalStanding",
      label: "Show your rank gap and percentile next to the goal",
      type: "checkbox",
      default: true,
    },
    {
      key: "leaderboardHighlights",
      label: "Highlight top values and rank gains on the leaderboard",
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

    let style = document.getElementById("exterstellar-better-goi");
    if (!style) {
      style = document.createElement("style");
      style.id = "exterstellar-better-goi";
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
        handleWeeklyStat(cfg);
        handleLeaderboardSorting(cfg);
        handleWeeklyLeaderboardColumn(cfg).then(() => {
          finalizeLeaderboardSortRestore(cfg);
          handlePersonalStanding(cfg);
        });
      }
      if (isReviewDetailPage()) {
        handleReviewDetailPage(cfg);
        handleDevlogMarkdown(cfg);
        handleDevlogReviewPanels(cfg);
        handleApproveAllMissingVerdict(cfg);
        handleSidebarToggleHotkey(cfg);
      }
    };

    document.addEventListener("turbo:load", onTurboUpdate);
    document.addEventListener("turbo:frame-load", onTurboUpdate);

    onTurboUpdate();

    return function cleanup() {
      style?.remove();
      document.removeEventListener("turbo:load", onTurboUpdate);
      document.removeEventListener("turbo:frame-load", onTurboUpdate);
      document.removeEventListener("keydown", handleSidebarHotkeyPress);
      sidebarHotkeyAttached = false;
      document.getElementById("exterstellar-better-goi-search")?.remove();
      document.getElementById("exterstellar-better-goi-chart-controls")?.remove();
    };
  },
});

// sabio's good code (IF YOU TOUCH THIS I WILL FIND YOU - I touched the comment :3 - i will find u)
// rank overtaking visual thingy idk

function sumSeriesBeforeCutoff(data: any[], cutoffIndex: number): number {
  let total = 0;
  for (let i = 0; i < cutoffIndex; i++) {
    total += extractPointValue(data[i]);
  }
  return total;
}

function computeRanksAtCutoff(
  chart: any,
  cutoffIndex: number,
): Map<string, number> {
  const datasets: any[] = chart.data.datasets ?? [];

  const totals = datasets.map((d) => ({
    username: (d.label ?? "").trim().toLowerCase(),
    total: sumSeriesBeforeCutoff(d.data ?? [], cutoffIndex),
  }));

  totals.sort((a, b) => b.total - a.total);

  const ranks = new Map<string, number>();
  totals.forEach((t, i) => ranks.set(t.username, i + 1));
  return ranks;
}

function formatRankChange(
  current: number,
  previous: number | undefined,
): string {
  if (previous === undefined) return "New";

  const diff = previous - current;
  if (diff === 0) return "-";
  return diff > 0 ? `▲${diff}` : `▼${Math.abs(diff)}`;
}

function computeDaysOnTop(chart: any): Map<string, number> {
  const datasets: any[] = chart.data.datasets ?? [];
  const labels: string[] = chart.data.labels ?? [];

  const wins = new Map<string, number>();
  for (const d of datasets) {
    wins.set((d.label ?? "").trim().toLowerCase(), 0);
  }

  for (let day = 0; day < labels.length; day++) {
    let topUsername: string | null = null;
    let topValue = 0;

    for (const d of datasets) {
      const value = extractPointValue(d.data?.[day]);
      if (value > topValue) {
        topValue = value;
        topUsername = (d.label ?? "").trim().toLowerCase();
      }
    }

    if (topUsername && topValue > 0) {
      wins.set(topUsername, (wins.get(topUsername) ?? 0) + 1);
    }
  }

  return wins;
}

let sidebarHotkeyAttached = false;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable);
}

function handleSidebarHotkeyPress(e: KeyboardEvent) {
  if (e.key !== "Tab") return;
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (isEditableTarget(e.target)) return;
  if (!/^\/admin\/certification\/review\/[^/]+\/?$/.test(window.location.pathname)) return;

  const toggle = document.querySelector<HTMLButtonElement>(".review-sidebar-toggle");
  if (!toggle) return;

  e.preventDefault();
  toggle.click();
}

function handleSidebarToggleHotkey(
  cfg: Record<string, string | number | boolean>,
) {
  if (cfg.sidebarToggleHotkey === false || cfg.sidebarToggleHotkey === "false")
    return;

  if (sidebarHotkeyAttached) return;
  sidebarHotkeyAttached = true;

  document.addEventListener("keydown", handleSidebarHotkeyPress);
}

const PERSONAL_STANDING_ID = "exterstellar-better-goi-personal-standing";

interface LeaderboardStanding {
  username: string;
  total: number;
}

function getLeaderboardStandings(
  table: HTMLTableElement,
): LeaderboardStanding[] {
  const rows = Array.from(
    table.querySelectorAll("tbody tr"),
  ) as HTMLTableRowElement[];

  return rows.map((row) => {
    const username = getUsernameFromLeaderboardRow(row) ?? "";
    const totalCell = row.querySelectorAll("td")[2] ?? null;
    const total = parseNumericCellValue(totalCell);
    return { username, total };
  });
}

function computePersonalStanding(
  standings: LeaderboardStanding[],
  myUsername: string,
): {
  rank: number;
  total: number;
  percentile: number;
  gapToFirst: number;
  gapToNext: number | null;
} | null {
  const myIndex = standings.findIndex((s) => s.username === myUsername);
  if (myIndex === -1) return null;

  const me = standings[myIndex]!;
  const first = standings[0]!;
  const above = myIndex > 0 ? standings[myIndex - 1]! : null;

  return {
    rank: myIndex + 1,
    total: me.total,
    percentile: Math.round(((myIndex + 1) / standings.length) * 100),
    gapToFirst: first.total - me.total,
    gapToNext: above ? above.total - me.total : null,
  };
}

async function injectPersonalStanding(goalEl: Element, table: HTMLTableElement) {
  if (document.getElementById(PERSONAL_STANDING_ID)) return;

  const myUsername = getMyUsername();
  if (!myUsername) return;

  const standings = getLeaderboardStandings(table);
  const standing = computePersonalStanding(standings, myUsername);
  if (!standing) return;

  const container = document.createElement("div");
  container.id = PERSONAL_STANDING_ID;
  container.classList.add("exterstellar-better-goi-standing-group");

  const makeBox = (label: string) => {
    const box = document.createElement("div");
    box.classList.add("exterstellar-better-goi-week-stat");
    box.setAttribute("role", "status");
    box.setAttribute("aria-live", "polite");

    const span = document.createElement("span");
    span.classList.add("ysws-queue__goal-label");
    span.textContent = label;
    box.appendChild(span);

    return box;
  };

  if (standing.rank === 1) {
    container.appendChild(makeBox(`Top ${standing.percentile}%`));
    container.appendChild(makeBox("You're #1!"));
  } else {
    container.appendChild(makeBox(`Top ${standing.percentile}%`));
    container.appendChild(
      makeBox(`${standing.gapToFirst} devlog${standing.gapToFirst === 1 ? "" : "s"} behind #1`),
    );
    if (standing.gapToNext !== null) {
      container.appendChild(
        makeBox(`${standing.gapToNext} devlog${standing.gapToNext === 1 ? "" : "s"} to next rank`),
      );
    }
  }

  goalEl.after(container);
}

function handlePersonalStanding(
  cfg: Record<string, string | number | boolean>,
) {
  if (cfg.personalStanding === false || cfg.personalStanding === "false")
    return;
  if (document.getElementById(PERSONAL_STANDING_ID)) return;

  let attempts = 0;
  const tryInject = () => {
    const goalEl = document.querySelector(".ysws-dashboard__panel--chart");
    const table = document.querySelector<HTMLTableElement>(
      ".ysws-dashboard__table",
    );
    if (goalEl && table) {
      injectPersonalStanding(goalEl, table);
      return;
    }
    attempts += 1;
    if (attempts < 20) requestAnimationFrame(tryInject);
  };

  tryInject();
}

function clearHighlights(table: HTMLTableElement) {
  const highlighted = table.querySelectorAll(
    `.exterstellar-better-goi-top-value, .exterstellar-better-goi-rank-gain`,
  );
  for (const cell of Array.from(highlighted)) {
    cell.classList.remove("exterstellar-better-goi-top-value", "exterstellar-better-goi-rank-gain");
  }
}

function highlightLeaderboardColumns(table: HTMLTableElement) {
  const headRow = table.querySelector("thead tr");
  if (!headRow) return;

  clearHighlights(table);

  const ths = Array.from(headRow.querySelectorAll("th")) as HTMLTableCellElement[];
  const rows = Array.from(
    table.querySelectorAll("tbody tr"),
  ) as HTMLTableRowElement[];

  ths.forEach((th, columnIndex) => {
    if (!th.classList.contains(NUMERIC_COL_CLASS)) return;
    const label = th.textContent?.replace(/[▲▼]\s*\d*$/, "").trim() ?? "";

    if (label === "Past 7 days") {
      for (const row of rows) {
        const cell = row.querySelectorAll("td")[columnIndex];
        if (cell?.textContent?.trim().startsWith("▲")) {
          cell.classList.add("exterstellar-better-goi-rank-gain");
        }
      }
      return;
    }

    let topCell: HTMLTableCellElement | null = null;
    let topValue = -Infinity;

    for (const row of rows) {
      const cell = row.querySelectorAll("td")[columnIndex] ?? null;
      const value = parseNumericCellValue(cell);
      if (cell && value > topValue) {
        topValue = value;
        topCell = cell;
      }
    }

    if (topCell && Number.isFinite(topValue)) {
      topCell.classList.add("exterstellar-better-goi-top-value");
    }
  });
}
