/* ═══════════════════════════════════════════════════════════════════
   Kizoxy Dashboard — pages-logs.js (Logs Viewer Page)
   ═══════════════════════════════════════════════════════════════════ */

let logsAutoTail = true;
let logsAutoTimer = null;
let logsCurrentFile = null;
let logsRawContent = "";

function getLevelFromLine(line) {
  const cls = classifyLogLine(line);
  return cls === "warn" ? "WARN" : cls.toUpperCase();
}

window.logFilterState = function() {
  return {
    levels: [
      { id: "ERROR", color: "var(--red)" },
      { id: "WARN", color: "var(--yellow)" },
      { id: "SUCCESS", color: "var(--green)" },
      { id: "INFO", color: "var(--text-2)" },
      { id: "DEBUG", color: "var(--blue)" }
    ],
    activeLevels: new Set(["ERROR", "WARN", "SUCCESS", "INFO", "DEBUG"]),
    searchText: "",
    counts: {},
    visibleCount: 0,
    totalCount: 0,
    init() {
      // Listen to log data updates
      window.addEventListener("log-data-updated", (e) => {
        this.counts = e.detail.level_counts || {};
        this.totalCount = this.counts.TOTAL || 0;
        this.applyFilter();
      });
    },
    get allActive() {
      return this.activeLevels.size === this.levels.length;
    },
    toggleLevel(id) {
      if (id === "ALL") {
        if (this.allActive) {
          // keep at least one active
        } else {
          this.levels.forEach(l => this.activeLevels.add(l.id));
        }
      } else if (this.allActive) {
        this.activeLevels = new Set([id]);
      } else if (this.activeLevels.has(id)) {
        if (this.activeLevels.size > 1) this.activeLevels.delete(id);
      } else {
        this.activeLevels.add(id);
      }
      this.$nextTick(() => this.applyFilter());
    },
    applyFilter() {
      applyLogFilter(this.searchText, this.activeLevels);
    }
  };
};

async function renderLogs() {
  const content = document.getElementById("content");
  content.innerHTML = '<div class="skeleton" style="height:400px"></div>';
  if (logsAutoTimer) {
    clearInterval(logsAutoTimer);
    logsAutoTimer = null;
  }

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
          <div x-data="logFilterState()" class="log-toolbar" id="log-toolbar" style="display:none">
            <div class="log-level-filters" style="display:flex;gap:4px;align-items:center;">
              <button @click="toggleLevel('ALL')"
                      :class="{'btn--primary': allActive, 'btn--ghost': !allActive}"
                      class="btn btn--sm">ALL</button>
              <template x-for="level in levels" :key="level.id">
                <button @click="toggleLevel(level.id)"
                        :class="{'btn--primary': activeLevels.has(level.id), 'btn--ghost': !activeLevels.has(level.id)}"
                        class="btn btn--sm"
                        x-text="level.id + ' (' + (counts[level.id] ?? 0) + ')'">
                </button>
              </template>
            </div>
            <input type="text" x-model.debounce.150ms="searchText"
                   @input="applyFilter()" placeholder="Search logs..."
                   class="search-input" style="width:200px">
            <select class="select" id="log-lines" style="width:100px" onchange="reloadLogFile()">
              <option value="200">200 lines</option>
              <option value="500">500 lines</option>
              <option value="1000">1000 lines</option>
            </select>
            <label style="font-size:12px;color:var(--text-3);display:flex;align-items:center;gap:4px">
              Auto-tail ${toggleHtml("", logsAutoTail, 'id="log-autotail" onchange="toggleAutoTail(this.checked)"')}
            </label>
            <span class="log-count" style="font-size:12px;color:var(--text-3);margin-left:auto" x-text="\`Showing \${visibleCount} / \${totalCount}\``"></span>
            <span id="log-paused" class="badge badge--yellow" style="display:none">⏸ Paused</span>
          </div>
          <div id="log-viewer-wrap"><div style="padding:20px;color:var(--text-3)">Select a log file to view.</div></div>
        </div>
      </div>`;

    if (window.Alpine) {
      window.Alpine.initTree(content);
    }

    if (files.length > 0) selectLogFile(files[0].name);
  } catch {
    content.innerHTML =
      '<div class="card" style="color:var(--red)">Failed to load log files.</div>';
  }
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
    
    const event = new CustomEvent("log-data-updated", {
      detail: { level_counts: data.level_counts }
    });
    window.dispatchEvent(event);
  } catch {
    const wrap = document.getElementById("log-viewer-wrap");
    if (wrap)
      wrap.innerHTML =
        '<div style="color:var(--red)">Failed to load log file.</div>';
  }
}

function applyLogFilter(searchText = "", activeLevels = null) {
  if (!activeLevels) {
    const el = document.getElementById("log-toolbar");
    if (el && window.Alpine) {
      try {
        const data = window.Alpine.$data(el);
        if (data) {
          activeLevels = data.activeLevels;
          searchText = data.searchText;
        }
      } catch (_) {}
    }
  }

  const search = (searchText || "").toLowerCase();
  const lines = logsRawContent.split("\n");

  const filtered = lines.filter((line) => {
    if (!line.trim()) return false;
    const lvl = getLevelFromLine(line);
    if (activeLevels && !activeLevels.has(lvl)) return false;
    if (search && !line.toLowerCase().includes(search)) return false;
    return true;
  });

  const el = document.getElementById("log-toolbar");
  if (el && window.Alpine) {
    try {
      const data = window.Alpine.$data(el);
      if (data) data.visibleCount = filtered.length;
    } catch (_) {}
  }

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
      wrap.firstElementChild.clientHeight < 80
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
