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
    </div>
    <div class="card" style="margin-top:16px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.03)">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-weight:600;color:var(--red);margin-bottom:4px">Leave Server</div>
          <div style="color:var(--text-3);font-size:12px">Make Kizoxy leave this server. The bot can be re-invited anytime.</div>
        </div>
        <button class="btn btn--danger btn--sm" onclick="leaveGuild('${g.id}', '${escAttr(g.name)}')">Leave Server</button>
      </div>
    </div>`;
}
