/* ═══════════════════════════════════════════════════════════════════
   Kizoxy Dashboard — pages-admin-updates.js (Updates Center)
   ═══════════════════════════════════════════════════════════════════ */

async function renderUpdates() {
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="tab-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <h3 style="font-size:14px;font-weight:600">Dependency Update Center</h3>
      <button class="btn btn--secondary btn--sm" disabled>↻ Check Updates</button>
    </div>
    <div class="skeleton" style="height:300px"></div>
  `;

  let filterMode = "all";
  let updatesData = null;

  async function loadUpdates() {
    try {
      content.innerHTML = `
        <div class="tab-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h3 style="font-size:14px;font-weight:600">Dependency Update Center</h3>
          <button class="btn btn--secondary btn--sm" disabled>Checking...</button>
        </div>
        <div class="skeleton" style="height:300px"></div>
      `;
      updatesData = await api.get("/updates");
      renderContent();
    } catch (err) {
      content.innerHTML = `
        <div class="tab-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h3 style="font-size:14px;font-weight:600">Dependency Update Center</h3>
          <button class="btn btn--primary btn--sm" onclick="loadUpdates()">Retry</button>
        </div>
        <div class="card" style="color:var(--red)">Failed to fetch registry updates.</div>
      `;
    }
  }

  window.setUpdatesFilter = function (mode) {
    filterMode = mode;
    const btns = document.querySelectorAll("#updates-filter-group button");
    btns.forEach((btn) => {
      btn.className =
        btn.dataset.mode === mode
          ? "btn btn--sm btn--primary"
          : "btn btn--sm btn--ghost";
    });
    renderContent();
  };

  window.triggerUpdateCheck = async function () {
    const btn = document.getElementById("updates-check-btn");
    if (btn) {
      btn.textContent = "Checking...";
      btn.disabled = true;
    }
    try {
      updatesData = await api.get("/updates?refresh=1");
      renderContent();
    } catch (err) {
      showToast("Check updates failed", "error");
    }
  };

  function renderContent() {
    if (!updatesData) return;

    let pkgs = updatesData.packages || [];
    if (filterMode === "outdated") {
      pkgs = pkgs.filter((p) => p.outdated);
    } else if (filterMode === "dev") {
      pkgs = pkgs.filter((p) => p.is_dev);
    }

    const rowsHtml = pkgs
      .map((p) => {
        let statusHtml = '<span class="badge badge--green">Up-to-date</span>';
        if (p.error) {
          statusHtml = '<span class="badge badge--red">⚠️ Error</span>';
        } else if (p.outdated) {
          statusHtml =
            '<span class="badge badge--yellow">Update Available</span>';
        }

        return `
        <tr>
          <td style="font-weight:600;">\${esc(p.name)} \${p.is_dev ? '<span style="font-size:10px;background:var(--bg-mid);color:var(--text-3);padding:2px 4px;border-radius:3px;margin-left:4px;">dev</span>' : ""}</td>
          <td style="font-family:var(--font-mono);font-size:12px;">\${esc(p.current)}</td>
          <td style="font-family:var(--font-mono);font-size:12px;">\${esc(p.latest || "—")}</td>
          <td>\${statusHtml}</td>
        </tr>
      `;
      })
      .join("");

    content.innerHTML = `
      <div class="tab-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="font-size:14px;font-weight:600">Dependency Update Center</h3>
        <button class="btn btn--secondary btn--sm" id="updates-check-btn" onclick="triggerUpdateCheck()">↻ Check Updates</button>
      </div>

      <div class="stat-row" style="margin-bottom:16px;">
        <div class="stat-card">
          <div class="stat-card__label">Node.js Version</div>
          <div class="stat-card__value" style="font-size:16px;font-family:var(--font-mono);">\${esc(updatesData.node_version)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Outdated Packages</div>
          <div class="stat-card__value" style="font-size:16px;color:var(--yellow);">\${updatesData.outdated_count}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Last Checked</div>
          <div class="stat-card__value" style="font-size:12px;color:var(--text-2);">\${new Date(updatesData.checked_at).toLocaleTimeString()}</div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:12px;">
        <div style="display:flex;gap:8px;" id="updates-filter-group">
          <button class="btn btn--sm \${filterMode === "all" ? "btn--primary" : "btn--ghost"}" data-mode="all" onclick="setUpdatesFilter('all')">All (\${updatesData.total_count})</button>
          <button class="btn btn--sm \${filterMode === "outdated" ? "btn--primary" : "btn--ghost"}" data-mode="outdated" onclick="setUpdatesFilter('outdated')">Outdated (\${updatesData.outdated_count})</button>
          <button class="btn btn--sm \${filterMode === "dev" ? "btn--primary" : "btn--ghost"}" data-mode="dev" onclick="setUpdatesFilter('dev')">Dev Dependencies</button>
        </div>
      </div>

      <div class="card" style="padding:0;overflow-x:auto;">
        <table class="table" style="margin:0">
          <thead>
            <tr>
              <th>Package Name</th>
              <th>Current Version</th>
              <th>Latest Version</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            \${pkgs.length ? rowsHtml : \`<tr><td colspan="4" style="text-align:center;color:var(--text-3);padding:24px;">No packages match selection.</td></tr>\`}
          </tbody>
        </table>
      </div>
    `;
  }

  state.pageCleanup = () => {
    delete window.setUpdatesFilter;
    delete window.triggerUpdateCheck;
  };

  loadUpdates();
}
