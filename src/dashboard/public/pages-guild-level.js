/* ═══════════════════════════════════════════════════════════════════
   Kizoxy Dashboard — pages-guild-level.js (Levels Tab Renderer)
   ═══════════════════════════════════════════════════════════════════ */

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
            🎉 Level up! <span x-text="result?.previous_level + ' → ' + result?.new_level"></span>
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
