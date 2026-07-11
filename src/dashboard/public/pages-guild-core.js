/* ═══════════════════════════════════════════════════════════════════
   Kizoxy Dashboard — pages-guild-core.js (Guild Detail Page & Tabs)
   ═══════════════════════════════════════════════════════════════════ */

async function renderGuild(guildId, initialTab) {
  const content = document.getElementById("content");
  content.innerHTML = '<div class="skeleton" style="height:400px"></div>';

  try {
    const guild = await api.get(`/guilds/${guildId}`);
    state.currentGuild = guild;

    const tabs = [
      "Overview",
      "FixEmbed",
      "YouTube",
      "TikTok",
      "TempVC",
      "Alarms",
      "Level",
    ];
    const activeTab = initialTab || "Overview";

    content.innerHTML = `
      <span class="back-link" onclick="location.hash='#guilds'">← Back to guilds</span>
      <div class="guild-header">
        ${guildIconHtml(guild.icon, guild.name, "guild-icon guild-icon--lg")}
        <div class="guild-header-info">
          <h2>${esc(guild.name)}</h2>
          <div class="sub">${guild.memberCount.toLocaleString()} members</div>
        </div>
      </div>
      <div class="tabs" id="guild-tabs">
        ${tabs.map((t) => `<div class="tab ${t === activeTab ? "active" : ""}" data-tab="${t}" onclick="switchGuildTab('${guildId}','${t}')">${t}</div>`).join("")}
      </div>
      <div id="guild-tab-content"></div>`;

    switchGuildTab(guildId, activeTab);
  } catch {
    content.innerHTML =
      '<div class="card" style="color:var(--red)">Guild not found or failed to load.</div>';
  }
}

function switchGuildTab(guildId, tab) {
  if (state.tabCleanup) {
    try {
      state.tabCleanup();
    } catch (e) {
      console.error("Tab cleanup error:", e);
    }
    state.tabCleanup = null;
  }

  document.querySelectorAll("#guild-tabs .tab").forEach((el) => {
    el.classList.toggle("active", el.dataset.tab === tab);
  });
  const container = document.getElementById("guild-tab-content");
  const g = state.currentGuild;
  if (!g) return;

  switch (tab) {
    case "Overview":
      renderGuildOverview(container, g);
      break;
    case "FixEmbed":
      renderFixEmbed(container, g);
      break;
    case "YouTube":
      renderYouTube(container, guildId);
      break;
    case "TikTok":
      renderTikTok(container, guildId);
      break;
    case "TempVC":
      renderTempVC(container, g);
      break;
    case "Alarms":
      renderAlarms(container, g);
      break;
    case "Level":
      renderLevel(container, g);
      break;
  }
}

// ── Guild Tab: Overview ──
function renderGuildOverview(el, g) {
  el.innerHTML = `
    <div class="stat-row">
      <div class="stat-card"><div class="stat-card__label">Members</div><div class="stat-card__value">${g.memberCount}</div></div>
      <div class="stat-card"><div class="stat-card__label">Channels</div><div class="stat-card__value">${g.channelCount}</div></div>
      <div class="stat-card"><div class="stat-card__label">Roles</div><div class="stat-card__value">${g.roleCount}</div></div>
    </div>
    <div class="card">
      <div style="margin-bottom:8px"><strong>Owner:</strong> ${esc(g.ownerId)}</div>
      <div><strong>Joined:</strong> ${g.joinedAt ? new Date(g.joinedAt).toLocaleDateString() : "N/A"}</div>
    </div>`;
}

// ── Guild Tab: FixEmbed ──
function renderFixEmbed(el, g) {
  const fe = g.fixembed || {};
  el.innerHTML = `
    <div class="card">
      <div class="form-group">
        <label>Enabled</label>
        ${toggleHtml("fixembed-enabled", fe.enabled, 'id="fixembed-enabled"')}
      </div>
      <div class="form-group">
        <label>View Mode</label>
        <select class="select" id="fixembed-viewmode" style="width:200px">
          ${["normal", "direct", "gallery", "text"].map((m) => `<option value="${m}" ${fe.viewMode === m ? "selected" : ""}>${m}</option>`).join("")}
        </select>
      </div>
      <button class="btn btn--primary" id="fixembed-save">Save</button>
    </div>`;

  document.getElementById("fixembed-save").onclick = async () => {
    try {
      const enabled = document.getElementById("fixembed-enabled").checked;
      const view_mode = document.getElementById("fixembed-viewmode").value;
      const result = await api.patch(`/guilds/${g.id}/fixembed`, {
        enabled,
        view_mode,
      });
      state.currentGuild.fixembed = result;
      showToast("FixEmbed settings saved", "success");
    } catch {
      showToast("Failed to save settings", "error");
    }
  };
}
