/* ═══════════════════════════════════════════════════════════════════
   Kizoxy Dashboard — pages-logs.js (Logs Viewer Page)
   ═══════════════════════════════════════════════════════════════════ */

let logsAutoTail = true;
let logsAutoTimer = null;
let logsCurrentFile = null;
let activeLogLevels = {
  error: true,
  warn: true,
  success: true,
  info: true,
  debug: true,
};
let logsRawContent = "";

async function renderLogs() {
  const content = document.getElementById("content");
  content.innerHTML = '<div class="skeleton" style="height:400px"></div>';
  if (logsAutoTimer) {
    clearInterval(logsAutoTimer);
    logsAutoTimer = null;
  }

  // Reset levels on fresh load
  activeLogLevels = {
    error: true,
    warn: true,
    success: true,
    info: true,
    debug: true,
  };

  state.pageCleanup = () => {
    if (logsAutoTimer) {
      clearInterval(logsAutoTimer);
      logsAutoTimer = null;
    }
  };

  try {
    const files = await api.get("/logs");
    content.innerHTML = `
      <div class="logs-layout">
        <div class="logs-filelist" id="logs-filelist">
          ${files
            .map((f) => {
              const size = f.size_bytes || 0;
              let sizeColor = "var(--text-3)";
              let sizeLabel = "";
              if (size > 50 * 1024 * 1024) {
                sizeColor = "var(--red)";
                sizeLabel =
                  ' <span class="badge badge--red" style="font-size:9px;padding:1px 3px;margin-left:4px;">⚠️ Heavy</span>';
              } else if (size > 10 * 1024 * 1024) {
                sizeColor = "var(--yellow)";
                sizeLabel =
                  ' <span class="badge badge--yellow" style="font-size:9px;padding:1px 3px;margin-left:4px;">⚠️ Large</span>';
              }
              return `<div class="logs-filelist-item" data-name="${esc(f.name)}" onclick="selectLogFile('${esc(f.name)}')">
              ${esc(f.name)}
              <div style="font-size:11px;color:${sizeColor};display:flex;align-items:center;">${esc(f.size_formatted || "0 B")}${sizeLabel}</div>
            </div>`;
            })
            .join("")}
          ${files.length === 0 ? '<div style="color:var(--text-3);padding:8px">No log files.</div>' : ""}
        </div>
        <div class="logs-content">
          <div class="log-toolbar" id="log-toolbar" style="display:none">
            <div style="display:flex;gap:4px;align-items:center;" id="log-level-filters">
              <button class="btn btn--primary btn--sm" onclick="toggleLogLevelFilter('error', this)">Error</button>
              <button class="btn btn--primary btn--sm" onclick="toggleLogLevelFilter('warn', this)">Warn</button>
              <button class="btn btn--primary btn--sm" onclick="toggleLogLevelFilter('success', this)">Success</button>
              <button class="btn btn--primary btn--sm" onclick="toggleLogLevelFilter('info', this)">Info</button>
              <button class="btn btn--primary btn--sm" onclick="toggleLogLevelFilter('debug', this)">Debug</button>
            </div>
            <input class="search-input" id="log-search" placeholder="Search..." oninput="applyLogFilter()" style="width:200px">
            <select class="select" id="log-lines" style="width:100px" onchange="reloadLogFile()">
              <option value="200">200 lines</option>
              <option value="500">500 lines</option>
              <option value="1000">1000 lines</option>
            </select>
            <label style="font-size:12px;color:var(--text-3);display:flex;align-items:center;gap:4px">
              Auto-tail ${toggleHtml("", logsAutoTail, 'id="log-autotail" onchange="toggleAutoTail(this.checked)"')}
            </label>
            <span id="log-line-count" style="font-size:12px;color:var(--text-3);margin-left:auto"></span>
            <span id="log-paused" class="badge badge--yellow" style="display:none">⏸ Paused</span>
          </div>
          <div id="log-viewer-wrap"><div style="padding:20px;color:var(--text-3)">Select a log file to view.</div></div>
        </div>
      </div>`;

    if (files.length > 0) selectLogFile(files[0].name);
  } catch {
    content.innerHTML =
      '<div class="card" style="color:var(--red)">Failed to load log files.</div>';
  }
}

function toggleLogLevelFilter(level, btn) {
  activeLogLevels[level] = !activeLogLevels[level];
  if (activeLogLevels[level]) {
    btn.className = "btn btn--primary btn--sm";
  } else {
    btn.className = "btn btn--ghost btn--sm";
  }
  applyLogFilter();
}

async function selectLogFile(name) {
  logsCurrentFile = name;
  document.querySelectorAll(".logs-filelist-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.name === name);
  });
  const toolbar = document.getElementById("log-toolbar");
  if (toolbar) toolbar.style.display = "flex";
  await reloadLogFile();
  if (logsAutoTail) {
    toggleAutoTail(true);
  }
}

async function reloadLogFile() {
  if (!logsCurrentFile) return;
  const tail = document.getElementById("log-lines")?.value || "200";
  try {
    const data = await api.get(
      `/logs/${encodeURIComponent(logsCurrentFile)}?tail=${tail}`,
    );
    logsRawContent = data.content || "";
    applyLogFilter();
  } catch {
    const wrap = document.getElementById("log-viewer-wrap");
    if (wrap)
      wrap.innerHTML =
        '<div style="color:var(--red)">Failed to load log file.</div>';
  }
}

function applyLogFilter() {
  const search =
    document.getElementById("log-search")?.value?.toLowerCase() || "";
  const lines = logsRawContent.split("\n");

  const filtered = lines.filter((line) => {
    const cls = classifyLogLine(line);
    if (!activeLogLevels[cls]) return false;
    if (search && !line.toLowerCase().includes(search)) return false;
    return true;
  });

  const lineCount = document.getElementById("log-line-count");
  if (lineCount) lineCount.textContent = `Showing ${filtered.length} lines`;
  const html = filtered
    .map((line) => {
      const cls = classifyLogLine(line);
      return `<div class="log-line--${cls}">${formatLogLine(line)}</div>`;
    })
    .join("");

  const wrap = document.getElementById("log-viewer-wrap");
  if (!wrap) return;
  const wasAtBottom = wrap.firstElementChild
    ? wrap.firstElementChild.scrollHeight -
        wrap.firstElementChild.scrollTop -
        wrap.firstElementChild.clientHeight <
      80
    : true;

  wrap.innerHTML = `<div class="log-viewer">${html}</div>`;

  const pausedBadge = document.getElementById("log-paused");
  if (wasAtBottom) {
    const viewer = wrap.firstElementChild;
    if (viewer) viewer.scrollTop = viewer.scrollHeight;
  } else if (pausedBadge) {
    pausedBadge.style.display = "inline-flex";
  }
}

function toggleAutoTail(on) {
  logsAutoTail = on;
  if (logsAutoTimer) {
    clearInterval(logsAutoTimer);
    logsAutoTimer = null;
  }
  if (on) {
    logsAutoTimer = setInterval(reloadLogFile, 2500);
    const badge = document.getElementById("log-paused");
    if (badge) badge.style.display = "none";
  }
}
