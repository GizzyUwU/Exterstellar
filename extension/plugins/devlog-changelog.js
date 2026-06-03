Exterstellar.register({
  id: "devlog-changelog",
  name: "Devlog Changelog",
  description: "Adds an 'add changelog' button that inserts your GitHub/GitLab commit history for that devlog.",
  author: "Sabio",
  config: [
    {
      key: "header",
      label: "Changelog section header",
      type: "text",
      placeholder: "## Changelog",
      default: "## Changelog"
    },
    {
      key: "manualSelection",
      label: "Use commit-range selector",
      type: "checkbox",
      default: true
    },
    {
      key: "maxCommits",
      label: "Max commits to fetch",
      type: "number",
      default: "25"
    },
    {
      key: "githubToken",
      label: "GitHub token (optional)",
      type: "text",
      placeholder: "ghp_...",
      default: ""
    }
  ],

  start() {
    const cfg = Exterstellar.getConfig("devlog-changelog");

    const style = document.createElement("style");
    style.id = "exterstellar-devlog-changelog";
    style.textContent = `
      .ext-cl-wrap {
        position: relative;
        display: inline-flex;
        align-items: center;
      }

      .ext-cl-panel {
        position: absolute;
        left: calc(100% + 8px);
        top: 50%;
        transform: translateY(-50%);
        z-index: 9999;
        background: var(--color-space-bg-2, #1e1e2e);
        border: 1px solid var(--color-space-surface-faint, rgba(255, 255, 255, 0.08));
        border-radius: 10px;
        padding: 13px 15px;
        width: 292px;
        display: flex;
        flex-direction: column;
        gap: 9px;
        font-family: var(--font-family-text, sans-serif);
        font-size: 12px;
        color: var(--color-space-text, #cdd6f4);
      }

      .ext-cl-panel__head {
        font-weight: 700;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--color-space-text-muted, #bac2debf);
        margin: 0 0 1px;
      }

      .ext-cl-field {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .ext-cl-field label {
        font-size: 11px;
        color: var(--color-space-text-muted, #bac2debf);
      }

      .ext-cl-field input {
        background: var(--color-space-bg, #181825);
        border: 1px solid var(--color-space-surface-faint, rgba(255, 255, 255, 0.08));
        border-radius: 6px;
        padding: 5px 8px;
        color: var(--color-space-text, #cdd6f4);
        font-size: 12px;
        font-family: inherit;
        width: 100%;
        box-sizing: border-box;
        outline: none;
        transition: border-color 200ms;
      }

      .ext-cl-field input:focus {
        border-color: var(--color-space-accent, #cba6f7);
      }

      .ext-cl-select,
      .ext-cl-field select {
        background: var(--color-space-bg, #181825);
        border: 1px solid var(--color-space-surface-faint, rgba(255, 255, 255, 0.08));
        border-radius: 6px;
        padding: 5px 8px;
        color: var(--color-space-text, #cdd6f4);
        font-size: 12px;
        font-family: inherit;
        width: 100%;
        box-sizing: border-box;
        outline: none;
        transition: border-color 200ms;
        cursor: pointer;
      }

      .ext-cl-select:focus,
      .ext-cl-field select:focus {
        border-color: var(--color-space-accent, #cba6f7);
      }

      .ext-cl-dates {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 7px;
      }

      .ext-cl-fetch-btn {
        padding: 6px 12px;
        border-radius: 7px;
        border: none;
        background: var(--color-space-accent, #cba6f7);
        color: var(--color-space-bg, #181825);
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
        transition: opacity 200ms, transform 100ms;
        width: 100%;
        margin-top: 1px;
      }

      .ext-cl-fetch-btn:hover:not(:disabled) {opacity: 0.88;}
      .ext-cl-fetch-btn:active:not(:disabled) {transform: scale(0.98);}
      .ext-cl-fetch-btn:disabled {
        opacity: 0.45;
        cursor: default;
      }

      .ext-cl-status {
        font-size: 11px;
        text-align: center;
        line-height: 1.4;
        min-height: 14px;
      }

      .ext-cl-status[data-state="ok"] {color: var(--color-space-accent);}
      .ext-cl-status[data-state="err"] {color: var(--color-space-text);}
      .ext-cl-status[data-state="load"] {color: var(--color-space-text-muted);}
    `;
    document.head.appendChild(style); 

    function getProjectId(composerEl) {
      const activeChip = composerEl.querySelector("[data-composer-post-url-param].feed-composer__chip--active, [data-composer-post-url-param]");
      const m1 = activeChip?.dataset?.composerPostUrlParam?.match(/\/projects\/(\d+)\//);
      if (m1) return m1[1];

      // fallback
      const m2 = location.pathname.match(/\/projects\/(\d+)/);
      if (m2) return m2[1];

      return new URLSearchParams(location.search).get("project_id");
    }

    async function fetchRepoUrl(projectId) {
      const res = await fetch(`/projects/${projectId}?editing=true`);
      if (!res.ok) return null;
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      return doc.querySelector("input[name='project[repo_url]']")?.value?.trim() || null;
    }

    function parseRepoUrl(rawUrl) {
      const url = (rawUrl || "").trim();
      const gh = url.match(/github\.com\/([^/]+)\/([^/?\s#]+?)(?:\.git)?\/?$/i);
      if (gh) return {type: "github", owner: gh[1], repo: gh[2]};
      const gl = url.match(/gitlab\.com\/([^/]+)\/([^/?\s#]+?)(?:\.git)?\/?$/i);
      if (gl) return {type: "gitlab", owner: gl[1], repo: gl[2]};
      return null;
    }

    function toISOEnd(dateStr) {
      const d = new Date(dateStr);
      d.setHours(23, 59, 59, 999);
      return d.toISOString();
    }

    async function fetchBranches(repoInfo, token) {
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      if (repoInfo.type === "github") {
        headers.Accept = "application/vnd.github+json";
        const r = await fetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/branches?per_page=100`, {headers});
        if (!r.ok) return [];
        return (await r.json()).map(b => b.name);
      }

      if (repoInfo.type === "gitlab") {
        const encoded = encodeURIComponent(`${repoInfo.owner}/${repoInfo.repo}`);
        const r = await fetch(`https://gitlab.com/api/v4/projects/${encoded}/repository/branches?per_page=100`);
        if (!r.ok) return [];
        return (await r.json()).map(b => b.name);
      }

      return [];
    }

    async function fetchCommitsForBranch(repoInfo, branch, token, max) {
      if (repoInfo.type !== "github") return [];
      const headers = {Accept: "application/vnd.github+json"};
      if (token) headers.Authorization = `Bearer ${token}`;
      const p = new URLSearchParams({per_page: String(max), sha: branch});
      const r = await fetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/commits?${p}`, {headers});
      if (!r.ok) return [];
      return await r.json();
    }

    async function fetchCommitRange(repoInfo, from, to, token) {
      if (repoInfo.type !== "github") throw new Error("Commit-range mode only supports GitHub. Disable commit-range mode in the plugin settings.");
      const headers = {Accept: "application/vnd.github+json"};
      if (token) headers.Authorization = `Bearer ${token}`;

      const r = await fetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/compare/${from}...${to}`, {headers});
      if (r.status === 404) throw new Error("Repo or commits not found.");
      if (!r.ok) throw new Error(`GitHub error ${r.status}: ${r.statusText}`);
      const data = await r.json();

      const baseR = await fetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/commits/${from}`, {headers});
      const baseCommit = baseR.ok ? await baseR.json() : null;

      let commits = data.commits || [];
      if (baseCommit && !commits.some(c => c.sha === baseCommit.sha)) {
        commits = [baseCommit, ...commits];
      }

      if (!commits.length) throw new Error("No commits found in that range.");

      return commits.map(c => ({
        shortSha: c.sha.slice(0, 7),
        message: c.commit.message.split("\n")[0].trim(),
        url: c.html_url
      }));
    }

    async function fetchCommits(repoInfo, {since, until, branch, token, max}) {
      if (repoInfo.type === "github") {
        const p = new URLSearchParams({per_page: String(max), sha: branch});
        if (since) p.set("since", new Date(since).toISOString());
        if (until) p.set("until", toISOEnd(until));

        const headers = {Accept: "application/vnd.github+json"};
        if (token) headers.Authorization = `Bearer ${token}`;

        const r = await fetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/commits?${p}`, {headers});

        if (r.status === 403) {
          const body = await r.json().catch(() => ({}));
          const msg = body.message || "";
          if (msg.toLowerCase().includes("rate limit")) {
            throw new Error("GitHub rate limit hit. Add your GitHub token in plugin configurations for additional breathing room.");
          }
          throw new Error(`Github 403: ${msg || "Forbidden"}`);
        }
        if (r.status === 404) throw new Error("Repo not found or is private. Check the URL.");
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(`GitHub error ${r.status}: ${body.message || r.statusText}`);
        }

        return (await r.json()).map(c => ({
          shortSha: c.sha.slice(0, 7),
          message: c.commit.message.split("\n")[0].trim(),
          url: c.html_url
        }));
      }

      if (repoInfo.type === "gitlab") {
        const encoded = encodeURIComponent(`${repoInfo.owner}/${repoInfo.repo}`);
        const p = new URLSearchParams({per_page: String(max), ref_name: branch});
        if (since) p.set("since", new Date(since).toISOString());
        if (until) p.set("until", toISOEnd(until));

        const r = await fetch(`https://gitlab.com/api/v4/projects/${encoded}/repository/commits?${p}`);
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(`GitLab error ${r.status}: ${body.message || r.statusText}`);
        }

        return (await r.json()).map(c => ({
          shortSha: c.short_id,
          message: c.title.trim(),
          url: `https://gitlab.com/${repoInfo.owner}/${repoInfo.repo}/-/commit/${c.id}`
        }));
      }

      throw new Error("Unsupported version control systems. (GitHub & GitLab are currently only supported. If you want support for another provider, please send a message to #exterstellar requesting so.)");
    }

    function buildChangelogText(commits, header) {
      const lines = commits.map(c => `* ${c.message} ([${c.shortSha}](${c.url}))`);
      return `${header}\n\n${lines.join("\n")}`;
    }

    function insertAtCursor(ta, text) {
      const at = ta.selectionStart ?? ta.value.length;
      const pre = ta.value.slice(0, at);
      const post = ta.value.slice(at);
      const gapBefore = pre && !pre.endsWith("\n\n") ? (pre.endsWith("\n") ? "\n" : "\n\n") : "";
      const gapAfter = post && !post.startsWith("\n") ? "\n\n" : "";
      ta.value = pre + gapBefore + text + gapAfter + post;
      ta.dispatchEvent(new Event("input", {bubbles: true}));
      ta.focus();
    }

    function buildPanel(composerEl, ta) {
      const manualMode = cfg.manualSelection === true || cfg.manualSelection === "true";

      const panel = document.createElement("div");
      panel.className = "ext-cl-panel";

      const head = document.createElement("p");
      head.className = "ext-cl-panel__head";
      head.textContent = "Add Changelog";
      panel.appendChild(head);

      function addField(labelText, inputType, placeholder, value) {
        const wrap = document.createElement("div");
        wrap.className = "ext-cl-field";

        const lbl = document.createElement("label");
        lbl.textContent = labelText;

        const inp = document.createElement("input");
        inp.type = inputType;
        inp.placeholder = placeholder;
        if (value != null) inp.value = value;

        wrap.append(lbl, inp);
        panel.appendChild(wrap);
        return inp;
      }

      function addSelect(labelText) {
        const wrap = document.createElement("div");
        wrap.className = "ext-cl-field";

        const lbl = document.createElement("label");
        lbl.textContent = labelText;

        const sel = document.createElement("select");
        sel.className = "ext-cl-select";

        wrap.append(lbl, sel);
        panel.appendChild(wrap);
        return sel;
      }
      
      const repoInput = addField("Repository URL", "url", "https://github.com/owner/repo", "");

      const branchSelect = addSelect("Branch");
      branchSelect.innerHTML = `<option disabled selected>detecting repo...</option>`;

      let fromSelect, toSelect, sinceInput, untilInput;
      let loadedCommits = [];

      if (manualMode) {
        fromSelect = addSelect("From (oldest commit)");
        fromSelect.innerHTML = `<option disabled selected>select branch first</option>`;
        toSelect = addSelect("To (newest commit)");
        toSelect.innerHTML = `<option disabled selected>-</option>`;
      } else {
        const dateRow = document.createElement("div");
        dateRow.className = "ext-cl-dates";

        function dateField(labelText) {
          const wrap = document.createElement("div");
          wrap.className = "ext-cl-field";

          const lbl = document.createElement("label");
          lbl.textContent = labelText;

          const inp = document.createElement("input");
          inp.type = "date";

          wrap.append(lbl, inp);
          dateRow.appendChild(wrap);
          return inp;
        }

        sinceInput = dateField("Since (optional)");
        untilInput = dateField("Until (optional)");
        panel.appendChild(dateRow);
      }

      const statusEl = document.createElement("div");
      statusEl.className = "ext-cl-status";
      panel.appendChild(statusEl);

      const fetchBtn = document.createElement("button");
      fetchBtn.type = "button";
      fetchBtn.className = "ext-cl-fetch-btn";
      fetchBtn.textContent = "Fetch & Insert";
      panel.appendChild(fetchBtn);

      function setStatus(msg, state) {
        statusEl.textContent = msg;
        statusEl.dataset.state = state || "";
      }

      function updateToDropdown() {
        const idx = fromSelect.selectedIndex;
        toSelect.innerHTML = loadedCommits.slice(0, idx + 1).map(c => `<option value="${c.sha}">${c.commit.message.split("\n")[0].slice(0, 50)} (${c.sha.slice(0, 7)})</option>`).join("");
        toSelect.selectedIndex = 0;
      }

      async function loadCommits(repoInfo, branch) {
        fromSelect.innerHTML = `<option disabled selected>loading...</option>`;
        toSelect.innerHTML = `<option disabled selected>-</option>`;
        loadedCommits = await fetchCommitsForBranch(repoInfo, branch, cfg.githubToken || "", Math.min(Math.max(parseInt(cfg.maxCommits) || 25, 1), 100));
        if (!loadedCommits.length) {
          fromSelect.innerHTML = `<option value="">No commits found</option>`;
          return;
        }
        fromSelect.innerHTML = loadedCommits.map(c => `<option value="${c.sha}">${c.commit.message.split("\n")[0].slice(0, 50)} (${c.sha.slice(0, 7)})</option>`).join("");
        fromSelect.selectedIndex = loadedCommits.length - 1;
        updateToDropdown();
      }

      async function loadBranches(repoInfo) {
        branchSelect.innerHTML = `<option disabled selected>loading...</option>`;
        const branches = await fetchBranches(repoInfo, cfg.githubToken || "");
        if (!branches.length) {
          branchSelect.innerHTML = `<option value="main">main</option>`;
        } else {
          const def = branches.find(b => b === "main") || branches.find(b => b === "master") || branches[0];
          branchSelect.innerHTML = branches.map(b => `<option value="${b}"${b === def ? " selected" : ""}>${b}</option>`).join("");
        }
        if (manualMode) await loadCommits(repoInfo, branchSelect.value);
      }

      if (manualMode) fromSelect.addEventListener("change", updateToDropdown);

      branchSelect.addEventListener("change", async () => {
        if (!manualMode) return;

        const repoInfo = parseRepoUrl(repoInput.value);
        if (!repoInfo) return;

        setStatus("Loading commits...", "load");
        await loadCommits(repoInfo, branchSelect.value);
        setStatus("", "");
      });

      repoInput.addEventListener("change", async () => {
        const repoInfo = parseRepoUrl(repoInput.value);
        if (!repoInfo) return;

        setStatus("Loading branches...", "load");
        await loadBranches(repoInfo);
        setStatus("", "");
      });

      const projectId = getProjectId(composerEl);
      if (projectId) {
        setStatus("Detecting repo...", "load");
        fetchRepoUrl(projectId).then(async url => {
          if (url) {
            repoInput.value = url;
            const repoInfo = parseRepoUrl(url);
            if (repoInfo) await loadBranches(repoInfo);
            setStatus("", "");
          } else {
            branchSelect.innerHTML = `<option value="main">main</option>`;
            setStatus("Couldn't auto-detect repository. Enter the URL manually.", "err");
          }
        })
        .catch(() => {
          branchSelect.innerHTML = `<option value="main">main</option>`;
          setStatus("Couldn't auto-detect repository. Enter the URL manually.", "err");
        });
      } else {
        branchSelect.innerHTML = `<option value="main">main</option>`;
      }

      fetchBtn.addEventListener("click", async () => {
        const repoInfo = parseRepoUrl(repoInput.value);
        if (!repoInfo) {
          setStatus("Not a valid GitHub or GitLab URL.", "err");
          return;
        }

        fetchBtn.disabled = true;
        setStatus("Fetching commits...", "load");

        try {
          let commits;
          if (manualMode) {
            const from = fromSelect.value;
            const to = toSelect.value;
            if (!from || !to) {
              setStatus("Select both from and to commits.", "err");
              return;
            }
            commits = await fetchCommitRange(repoInfo, from, to, cfg.githubToken || "");
          } else {
            commits = await fetchCommits(repoInfo, {
              since: sinceInput.value || null,
              until: untilInput.value || null,
              branch: branchSelect.value || "main",
              token: cfg.githubToken || "",
              max: Math.min(Math.max(parseInt(cfg.maxCommits) || 25, 1), 100)
            });
          }

          if (!commits.length) {
            setStatus("No commits found for those filters.", "err");
            return;
          }

          const header = cfg.header?.trim() || "## Changelog";
          insertAtCursor(ta, buildChangelogText(commits, header));
          setStatus(`Inserted ${commits.length} commit${commits.length !== 1 ? "s" : ""}`, "ok");
        } catch (err) {
          setStatus(err.message || "Failed to fetch commits.", "err");
        } finally {
          fetchBtn.disabled = false;
        }
      });

      return panel;
    }

    const ac = new AbortController();
    let openPanel = null;
    let openWrap = null;

    document.addEventListener("click", e => {
      if (!openPanel) return;
      if (!openWrap?.contains(e.target)) {
        openPanel.remove();
        openPanel = null;
        openWrap = null;
      }
    }, {capture: true, signal: ac.signal});

    function inject(composerEl) {
      if (composerEl.querySelector(".ext-cl-wrap")) return;
      const tools = composerEl.querySelector(".feed-composer__tools");
      const ta = composerEl.querySelector(".feed-composer__textarea");
      if (!tools || !ta) return;

      const wrap = document.createElement("div");
      wrap.className = "ext-cl-wrap";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "feed-composer__tool-btn";
      btn.title = "Add changelog";
      btn.setAttribute("aria-label", "Add changelog");
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-git-commit-horizontal-icon lucide-git-commit-horizontal feed-composer__tool-icon"><circle cx="12" cy="12" r="3"/><line x1="3" x2="9" y1="12" y2="12"/><line x1="15" x2="21" y1="12" y2="12"/></svg>`;
      btn.addEventListener("click", e => {
        e.stopPropagation();
        if (openPanel && openWrap === wrap) {
          openPanel.remove();
          openPanel = null;
          openWrap = null;
          return;
        }
        openPanel?.remove();
        openPanel = buildPanel(composerEl, ta);
        openWrap = wrap;
        wrap.appendChild(openPanel);
      });

      wrap.appendChild(btn);

      const infoWrap = tools.querySelector(".feed-composer__info-wrap");
      tools.insertBefore(wrap, infoWrap);
    }

    document.querySelectorAll(".feed-composer").forEach(inject);

    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches?.(".feed-composer")) inject(node);
          node.querySelectorAll?.(".feed-composer").forEach(inject);
        }
      }
    });
    observer.observe(document.documentElement, {childList: true, subtree: true});

    return () => {
      observer.disconnect();
      ac.abort();
      openPanel?.remove();
      document.querySelectorAll(".ext-cl-wrap").forEach(w => w.remove());
      style.remove();
    };
  }
});