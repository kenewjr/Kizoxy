/* ═══════════════════════════════════════════════════════════════════
   Kizoxy Dashboard — pages-guild-system.js (TempVC, Alarms, & Level)
   ═══════════════════════════════════════════════════════════════════ */

// ── Guild Tab: TempVC ──
function renderTempVC(el, g) {
  let lastUpdated = Date.now();

  const VOICE_REGIONS = [
    { name: "Brazil", value: "brazil" },
    { name: "Hong Kong", value: "hongkong" },
    { name: "India", value: "india" },
    { name: "Japan", value: "japan" },
    { name: "Rotterdam", value: "rotterdam" },
    { name: "Russia", value: "russia" },
    { name: "Singapore", value: "singapore" },
    { name: "South Africa", value: "southafrica" },
    { name: "Sydney", value: "sydney" },
    { name: "US Central", value: "us-central" },
    { name: "US East", value: "us-east" },
    { name: "US South", value: "us-south" },
    { name: "US West", value: "us-west" },
  ];

  window.toggleNameMode = function (genId) {
    const mode = document.getElementById(`tempvc-name-mode-${genId}`).value;
    const templateContainer = document.getElementById(
      `tempvc-template-container-${genId}`,
    );
    const customContainer = document.getElementById(
      `tempvc-custom-container-${genId}`,
    );
    if (templateContainer)
      templateContainer.style.display = mode === "template" ? "block" : "none";
    if (customContainer)
      customContainer.style.display = mode === "custom" ? "block" : "none";
    updatePreview(genId);
  };

  window.updatePreview = function (genId) {
    const mode = document.getElementById(`tempvc-name-mode-${genId}`).value;
    let pattern = "";
    if (mode === "default") {
      pattern = "{username}'s Channel";
    } else if (mode === "template") {
      const sel = document.getElementById(`tempvc-template-select-${genId}`);
      if (sel && sel.selectedIndex >= 0) {
        const opt = sel.options[sel.selectedIndex];
        pattern = opt ? opt.getAttribute("data-pattern") : "";
      }
    } else if (mode === "custom") {
      pattern = document.getElementById(`tempvc-custom-input-${genId}`).value;
    }

    if (!pattern) pattern = "Temporary Channel";
    const preview = pattern
      .replace(/\{username\}/gi, "Username")
      .replace(/\{displayname\}/gi, "DisplayName")
      .replace(/\{owner\}/gi, "Username")
      .replace(/\{game\}/gi, "Gaming")
      .replace(/\{number\}/gi, "1")
      .replace(/\{guild\}/gi, "Kizoxy Server");

    document.getElementById(`tempvc-preview-${genId}`).textContent =
      `Preview: ${preview}`;
  };

  window.saveGeneratorSettings = async function (guildId, genId) {
    try {
      const btn = document.getElementById(`tempvc-save-btn-${genId}`);
      if (btn) {
        btn.textContent = "Saving...";
        btn.disabled = true;
      }
      const mode = document.getElementById(`tempvc-name-mode-${genId}`).value;
      let defaultName = "{username}'s Channel";
      let templateId = null;
      if (mode === "template") {
        templateId =
          document.getElementById(`tempvc-template-select-${genId}`).value ||
          null;
      } else if (mode === "custom") {
        defaultName =
          document
            .getElementById(`tempvc-custom-input-${genId}`)
            .value.trim() || "{username}'s Channel";
      }

      const bitrate =
        parseInt(
          document.getElementById(`tempvc-bitrate-${genId}`).value,
          10,
        ) || 64;
      const rtcRegion =
        document.getElementById(`tempvc-region-${genId}`).value || null;
      const userLimit =
        parseInt(document.getElementById(`tempvc-limit-${genId}`).value, 10) ||
        0;

      await api.patch(`/guilds/${guildId}/tempvc/${genId}`, {
        bitrate,
        rtcRegion: rtcRegion === "auto" ? null : rtcRegion,
        defaultName,
        templateId,
        userLimit,
      });
      showToast("Generator settings saved", "success");
      await loadData(false);
    } catch (err) {
      showToast("Failed to save generator settings", "error");
    } finally {
      const btn = document.getElementById(`tempvc-save-btn-${genId}`);
      if (btn) {
        btn.textContent = "Save Generator Settings";
        btn.disabled = false;
      }
    }
  };

  async function loadData(showSkeleton = false) {
    if (showSkeleton) {
      el.innerHTML = `
        <div class="tab-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h3 style="font-size:14px;font-weight:600">TempVC Generators</h3>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="last-updated-text" style="font-size:12px;color:var(--text-3)">Loading...</span>
            <button class="btn btn--secondary btn--sm" disabled>↻ Refresh</button>
          </div>
        </div>
        <div class="skeleton" style="height:200px"></div>`;
    }

    try {
      const [tempvcData, generatorsData] = await Promise.all([
        api.get(`/guilds/${g.id}/tempvc`),
        api.get(`/guilds/${g.id}/tempvc/generators`),
      ]);
      lastUpdated = Date.now();
      renderContent({
        generators: generatorsData,
        active_channels: tempvcData.active_channels || [],
      });
    } catch (err) {
      el.innerHTML = `
        <div class="tab-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h3 style="font-size:14px;font-weight:600">TempVC Generators</h3>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="last-updated-text" style="font-size:12px;color:var(--red)">Failed to load</span>
            <button class="btn btn--secondary btn--sm" id="tempvc-refresh-btn">Retry</button>
          </div>
        </div>
        <div class="card" style="color:var(--red)">Could not load TempVC data.</div>`;
      const btn = document.getElementById("tempvc-refresh-btn");
      if (btn) btn.onclick = () => loadData(true);
    }
  }

  function getRelativeTimeString(timeMs) {
    const diffSec = Math.floor((Date.now() - timeMs) / 1000);
    if (diffSec < 5) return "just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    return `${Math.floor(diffSec / 60)}m ago`;
  }

  function updateTimeLabel() {
    const label = document.getElementById("tempvc-time-label");
    if (label) {
      label.textContent = `Last updated: ${getRelativeTimeString(lastUpdated)}`;
    }
  }

  function renderContent(data) {
    const gens = data.generators || [];
    const activeChannels = data.active_channels || [];

    const cardsHtml = gens
      .map((gen) => {
        const templates = gen.templates || [];
        const currentTemplateId = gen.templateId || "";
        let initialMode = "default";
        if (currentTemplateId) initialMode = "template";
        else if (gen.defaultName && gen.defaultName !== "{username}'s Channel")
          initialMode = "custom";

        const templateSelectStyle =
          initialMode === "template" ? "display:block" : "display:none";
        const customInputStyle =
          initialMode === "custom" ? "display:block" : "display:none";

        const previewPattern =
          initialMode === "template"
            ? templates.find((t) => t.id === currentTemplateId)?.namePattern ||
              templates.find((t) => t.id === currentTemplateId)?.channelName ||
              ""
            : initialMode === "custom"
              ? gen.defaultName
              : "{username}'s Channel";

        const preview = (previewPattern || "Temporary Channel")
          .replace(/\{username\}/gi, "Username")
          .replace(/\{displayname\}/gi, "DisplayName")
          .replace(/\{owner\}/gi, "Username")
          .replace(/\{game\}/gi, "Gaming")
          .replace(/\{number\}/gi, "1")
          .replace(/\{guild\}/gi, "Kizoxy Server");

        return `
        <div class="card" style="margin-bottom:20px;">
          <div style="font-weight:600;font-size:14px;margin-bottom:12px;display:flex;justify-content:space-between;">
            <span>Voice Channel: <code class="code-chip" style="font-size:13px;">${esc(gen.id)}</code></span>
            <span style="font-size:12px;color:var(--text-3);font-weight:normal;">${gen.activeChannelCount || 0} active channels</span>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(250px, 1fr));gap:16px;margin-bottom:16px;">
            <div class="form-group">
              <label>Channel Name Mode</label>
              <select class="select" id="tempvc-name-mode-${gen.id}" onchange="toggleNameMode('${gen.id}')">
                <option value="default" ${initialMode === "default" ? "selected" : ""}>Use generator default name</option>
                <option value="template" ${initialMode === "template" ? "selected" : ""}>Use template pattern</option>
                <option value="custom" ${initialMode === "custom" ? "selected" : ""}>Custom pattern</option>
              </select>

              <div id="tempvc-template-container-${gen.id}" style="${templateSelectStyle}; margin-top:8px;">
                <label>Template Selector</label>
                <select class="select" id="tempvc-template-select-${gen.id}" onchange="updatePreview('${gen.id}')">
                  <option value="">-- Select Template --</option>
                  ${templates.map((t) => `<option value="${t.id}" ${t.id === currentTemplateId ? "selected" : ""} data-pattern="${escAttr(t.namePattern || t.channelName || "")}">${esc(t.name)} (${esc(t.namePattern || t.channelName || "")})</option>`).join("")}
                </select>
              </div>

              <div id="tempvc-custom-container-${gen.id}" style="${customInputStyle}; margin-top:8px;">
                <label>Custom Pattern</label>
                <input class="input" id="tempvc-custom-input-${gen.id}" value="${escAttr(gen.defaultName || "")}" oninput="updatePreview('${gen.id}')" placeholder="e.g. {owner}'s Room">
                <div class="info-note">Available tokens: {owner} · {game} · {number} · {guild}</div>
              </div>

              <div style="font-size:12px;color:var(--text-3);margin-top:6px;font-style:italic;" id="tempvc-preview-${gen.id}">Preview: ${esc(preview)}</div>
            </div>

            <div class="form-group">
              <label>Bitrate (kbps)</label>
              <input type="number" class="input" id="tempvc-bitrate-${gen.id}" value="${gen.bitrate || 64}" min="8" max="384" placeholder="64">
              <div class="info-note">Max bitrate depends on server boost level.</div>
            </div>

            <div class="form-group">
              <label>Voice Region</label>
              <select class="select" id="tempvc-region-${gen.id}">
                <option value="auto" ${!gen.rtcRegion ? "selected" : ""}>Automatic (recommended)</option>
                ${VOICE_REGIONS.map((r) => `<option value="${r.value}" ${gen.rtcRegion === r.value ? "selected" : ""}>${r.name}</option>`).join("")}
              </select>
            </div>

            <div class="form-group">
              <label>User Limit</label>
              <input type="number" class="input" id="tempvc-limit-${gen.id}" value="${gen.limit ?? 0}" min="0" max="99" placeholder="0">
              <div class="info-note">0 = Unlimited</div>
            </div>
          </div>

          <button class="btn btn--primary" id="tempvc-save-btn-${gen.id}" onclick="saveGeneratorSettings('${g.id}', '${gen.id}')">Save Generator Settings</button>
        </div>
      `;
      })
      .join("");

    el.innerHTML = `
      <div class="tab-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="font-size:14px;font-weight:600">TempVC Generators</h3>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="last-updated-text" id="tempvc-time-label" style="font-size:12px;color:var(--text-3)">Last updated: just now</span>
          <button class="btn btn--secondary btn--sm" id="tempvc-refresh-btn">↻ Refresh</button>
        </div>
      </div>
      
      <div id="tempvc-generators-list">
        ${gens.length ? cardsHtml : '<div class="card" style="color:var(--text-3)">No generators configured.</div>'}
      </div>

      <h3 style="font-size:14px;font-weight:600;margin-top:24px;margin-bottom:12px">Active Temporary Channels</h3>
      <div class="card" style="padding:0;overflow-x:auto;margin-bottom:16px">
        <table class="table">
          <thead><tr><th>Channel ID</th><th>Owner ID</th><th>Created At</th><th>Active Members</th></tr></thead>
          <tbody>${
            activeChannels.length
              ? activeChannels
                  .map(
                    (ch) => `<tr>
            <td><code class="code-chip">${esc(ch.id)}</code></td>
            <td><code class="code-chip">${esc(ch.ownerId)}</code></td>
            <td>${ch.createdAt ? new Date(ch.createdAt).toLocaleString() : "N/A"}</td>
            <td>${esc(ch.memberCount)}</td>
          </tr>`,
                  )
                  .join("")
              : '<tr><td colspan="4" style="color:var(--text-3);padding:16px">No active temporary voice channels.</td></tr>'
          }</tbody>
        </table>
      </div>`;

    const btn = document.getElementById("tempvc-refresh-btn");
    if (btn) {
      btn.onclick = async () => {
        btn.textContent = "Refreshing...";
        btn.disabled = true;
        await loadData(false);
      };
    }
  }

  // Initial load
  loadData(true);

  const ticker = setInterval(updateTimeLabel, 5000);
  state.tabCleanup = () => {
    clearInterval(ticker);
    delete window.toggleNameMode;
    delete window.updatePreview;
    delete window.saveGeneratorSettings;
  };
}

// ── Guild Tab: Alarms ──
function renderAlarms(el, g) {
  const alarms = g.alarms || [];
  el.innerHTML = `
    <div class="card" style="padding:0;overflow-x:auto">
      <table class="table">
        <thead><tr><th>Next Fire</th><th>Channel ID</th><th>Label</th><th>Recurring</th></tr></thead>
        <tbody>${
          alarms.length
            ? alarms
                .map(
                  (a) => `<tr>
          <td>${a.time ? new Date(a.time).toLocaleString() : "N/A"}</td>
          <td style="font-family:var(--font-mono);font-size:12px">${esc(a.channelId || "")}</td>
          <td>${esc(a.message || a.label || "")}</td>
          <td>${esc(a.recurring || "none")}</td>
        </tr>`,
                )
                .join("")
            : '<tr><td colspan="4" style="color:var(--text-3)">No active alarms.</td></tr>'
        }</tbody>
      </table>
    </div>`;
} // ── Guild Tab: Level ──
window.xpManager = function (guildId) {
  return {
    guildId,
    action: "add",
    amount: null,
    selectedUser: "",
    loading: false,
    result: null,
    init() {
      const members = state.currentGuild?.members || [];
      const container = document.getElementById("xp-member-select");
      if (container) {
        container.innerHTML = renderSearchableSelect(
          "xp-user",
          members.map((m) => ({ id: m.id, name: `${m.name} (${m.tag})` })),
          "Search member...",
          "",
          "onXpUserChange(this.value)",
        );
        window.onXpUserChange = (val) => {
          this.selectedUser = val;
        };
      }
    },
    async applyXp() {
      if (!this.selectedUser || !this.amount) return;
      this.loading = true;
      this.result = null;
      try {
        const res = await api.post(`/guilds/${this.guildId}/level/xp`, {
          user_id: this.selectedUser,
          amount: Number(this.amount),
          action: this.action,
        });
        this.result = res;
        showToast("XP updated successfully", "success");
        if (typeof window.loadLevelData === "function") {
          setTimeout(() => window.loadLevelData(false), 500);
        }
      } catch (e) {
        const body = await e.json?.().catch(() => ({}));
        showToast(body?.error || "Failed to apply XP", "error");
      } finally {
        this.loading = false;
      }
    },
  };
};

function renderLevel(el, g) {
  let lastUpdated = Date.now();
  let intervalId = null;

  async function loadData(showSkeleton = false) {
    if (showSkeleton) {
      el.innerHTML = `
        <div class="tab-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h3 style="font-size:14px;font-weight:600">Level Leaderboard</h3>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="last-updated-text" style="font-size:12px;color:var(--text-3)">Loading...</span>
            <button class="btn btn--secondary btn--sm" disabled>↻ Refresh</button>
          </div>
        </div>
        <div class="skeleton" style="height:200px"></div>`;
    }

    try {
      const data = await api.get(`/guilds/${g.id}/level`);
      lastUpdated = Date.now();
      renderContent(data.level_top10);
    } catch (err) {
      el.innerHTML = `
        <div class="tab-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h3 style="font-size:14px;font-weight:600">Level Leaderboard</h3>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="last-updated-text" style="font-size:12px;color:var(--red)">Failed to load</span>
            <button class="btn btn--secondary btn--sm" id="level-refresh-btn">Retry</button>
          </div>
        </div>
        <div class="card" style="color:var(--red)">Could not load level data.</div>`;
      const btn = document.getElementById("level-refresh-btn");
      if (btn) btn.onclick = () => loadData(true);
    }
  }

  window.loadLevelData = loadData;

  function getRelativeTimeString(timeMs) {
    const diffSec = Math.floor((Date.now() - timeMs) / 1000);
    if (diffSec < 5) return "just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    return `${Math.floor(diffSec / 60)}m ago`;
  }

  function updateTimeLabel() {
    const label = document.getElementById("level-time-label");
    if (label) {
      label.textContent = `Last updated: ${getRelativeTimeString(lastUpdated)}`;
    }
  }

  function renderContent(top) {
    el.innerHTML = `
      <div class="tab-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="font-size:14px;font-weight:600">Level Leaderboard</h3>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="last-updated-text" id="level-time-label" style="font-size:12px;color:var(--text-3)">Last updated: just now</span>
          <button class="btn btn--secondary btn--sm" id="level-refresh-btn">↻ Refresh</button>
        </div>
      </div>
      <div class="card" style="padding:0;overflow-x:auto">
        <table class="table">
          <thead><tr><th>Rank</th><th>User</th><th>User ID</th><th>XP</th><th>Level</th><th>Next Level</th></tr></thead>
          <tbody>${
            top && top.length
              ? top
                  .map((u, i) => {
                    let borderStyle = "";
                    if (i === 0)
                      borderStyle = "border-left: 3px solid #ffd700;";
                    else if (i === 1)
                      borderStyle = "border-left: 3px solid #c0c0c0;";
                    else if (i === 2)
                      borderStyle = "border-left: 3px solid #cd7f32;";

                    const serverName = u.server_name;
                    const globalName = u.global_name;
                    let userColHtml = "";
                    if (serverName) {
                      userColHtml = `
                        <div style="font-weight:600;color:var(--text-1)">${esc(serverName)}</div>
                        <div style="font-size:12px;color:var(--text-3)">${esc(globalName || "")}</div>
                      `;
                    } else {
                      userColHtml = `<span style="color:var(--text-3);font-style:italic">(User not in server)</span>`;
                    }

                    const xpFormatted = Number(u.xp).toLocaleString();
                    const pct = u.next_xp
                      ? Math.min(100, Math.round((u.xp / u.next_xp) * 100))
                      : 0;

                    return `<tr>
                      <td style="${borderStyle}">#${i + 1}</td>
                      <td>${userColHtml}</td>
                      <td><code class="id-chip" style="cursor:pointer;" onclick="navigator.clipboard.writeText('${esc(u.user_id)}');showToast('Copied ID!','info')">${esc(u.user_id)}</code></td>
                      <td>${xpFormatted}</td>
                      <td>${u.level}</td>
                      <td>
                        <div class="xp-bar">
                          <div class="xp-bar__fill" style="width:${pct}%"></div>
                        </div>
                        <div style="font-size:11px;color:var(--text-3);margin-top:2px">${u.xp_to_next} XP to next level</div>
                      </td>
                    </tr>`;
                  })
                  .join("")
              : '<tr><td colspan="6" style="color:var(--text-3);padding:16px">No level data.</td></tr>'
          }</tbody>
        </table>
      </div>
      
      <!-- XP Management UI -->
      <div x-data="xpManager('${g.id}')" class="card mt-16" style="margin-top:16px;">
        <div class="card-header" style="font-weight:600; font-size:14px; margin-bottom:12px;">XP Management</div>

        <div class="form-group">
          <label>Member</label>
          <div id="xp-member-select"></div>
        </div>

        <div class="form-row" style="display:flex; gap:16px; margin-top:12px;">
          <div class="form-group" style="flex:1;">
            <label>Action</label>
            <select x-model="action" class="select">
              <option value="add">Add XP</option>
              <option value="remove">Remove XP</option>
              <option value="set">Set XP to</option>
            </select>
          </div>
          <div class="form-group" style="flex:1;">
            <label x-text="action === 'set' ? 'Total XP' : 'XP Amount'"></label>
            <input type="number" x-model.number="amount"
                   min="1" max="100000" class="input"
                   :placeholder="action === 'set' ? 'e.g. 5000' : 'e.g. 100'">
          </div>
        </div>

        <button class="btn btn--primary mt-12" @click="applyXp()" style="margin-top:12px;"
                :disabled="!selectedUser || !amount || loading">
          <span x-show="!loading">Apply</span>
          <span x-show="loading">Applying...</span>
        </button>

        <!-- Result card -->
        <div x-show="result" class="xp-result-card mt-12" style="margin-top:12px;">
          <div class="xp-result-row">
            <span class="text-3">Previous XP</span>
            <span x-text="result?.previous_xp?.toLocaleString()"></span>
          </div>
          <div class="xp-result-row">
            <span class="text-3">New XP</span>
            <span class="text-success" x-text="result?.new_xp?.toLocaleString()"></span>
          </div>
          <div x-show="result?.leveled_up" class="xp-level-up">
            🎉 Level up! <span x-text="\`\${result?.previous_level} → \${result?.new_level}\`'"></span>
          </div>
        </div>
      </div>`;

    const btn = document.getElementById("level-refresh-btn");
    if (btn) {
      btn.onclick = async () => {
        btn.textContent = "Refreshing...";
        btn.disabled = true;
        await loadData(false);
      };
    }

    if (window.Alpine) {
      window.Alpine.initTree(el);
    }
  }

  loadData(true);

  const ticker = setInterval(updateTimeLabel, 5000);
  intervalId = setInterval(() => loadData(false), 60000);

  state.tabCleanup = () => {
    clearInterval(ticker);
    clearInterval(intervalId);
    delete window.loadLevelData;
    delete window.onXpUserChange;
  };
}
