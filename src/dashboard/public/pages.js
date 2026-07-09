/* ═══════════════════════════════════════════════════════════════════
   Kizoxy Dashboard — pages.js (page renderers)
   ═══════════════════════════════════════════════════════════════════ */

// ── Overview Page ──
async function renderOverview() {
  const content = document.getElementById("content");
  content.innerHTML =
    '<div class="skeleton" style="height:120px;margin-bottom:16px"></div>';

  try {
    const [stats, meta] = await Promise.all([
      api.get("/stats"),
      Promise.resolve(state.meta),
    ]);
    const lavalinkBadge =
      meta?.lavalink_status === "connected"
        ? '<span class="badge badge--green">● connected</span>'
        : '<span class="badge badge--grey">● ' +
          esc(meta?.lavalink_status || "unknown") +
          "</span>";

    content.innerHTML = `
      <div class="stat-row">
        <div class="stat-card"><div class="stat-card__label">Guilds</div><div class="stat-card__value">${stats.guild_count}</div></div>
        <div class="stat-card"><div class="stat-card__label">Users</div><div class="stat-card__value">${stats.user_count.toLocaleString()}</div></div>
        <div class="stat-card"><div class="stat-card__label">Memory</div><div class="stat-card__value">${stats.memory_rss_mb} MB</div></div>
        <div class="stat-card"><div class="stat-card__label">Uptime</div><div class="stat-card__value">${formatUptime(stats.uptime_ms)}</div></div>
        <div class="stat-card"><div class="stat-card__label">Lavalink</div><div class="stat-card__value">${lavalinkBadge}</div></div>
        <div class="stat-card"><div class="stat-card__label">Music Players</div><div class="stat-card__value">${stats.active_player_count ?? 0}</div></div>
        <div class="stat-card"><div class="stat-card__label">Alarms</div><div class="stat-card__value">${stats.active_alarm_count ?? 0}</div></div>
        <div class="stat-card"><div class="stat-card__label">YT Subs</div><div class="stat-card__value">${stats.youtube_total_subs}</div></div>
        <div class="stat-card"><div class="stat-card__label">TT Subs</div><div class="stat-card__value">${stats.tiktok_total_subs}</div></div>
      </div>
      <div class="card" style="margin-bottom:16px">
        <h3 style="margin-bottom:12px;font-size:14px;font-weight:600">Active Music Players</h3>
        <div id="overview-players"><div class="skeleton" style="height:100px"></div></div>
      </div>
      <div class="card">
        <h3 style="margin-bottom:12px;font-size:14px;font-weight:600">Recent Logs</h3>
        <div id="overview-logs"><div class="skeleton" style="height:200px"></div></div>
        <a class="back-link" style="margin-top:8px" onclick="location.hash='#logs'">View all logs →</a>
      </div>`;

    // Load recent players.
    updateActivePlayersWidget();
    const playersTimer = setInterval(updateActivePlayersWidget, 5000);

    state.pageCleanup = () => {
      clearInterval(playersTimer);
    };

    // Load recent logs.
    try {
      const files = await api.get("/logs");
      if (files.length > 0) {
        const data = await api.get(
          `/logs/${encodeURIComponent(files[0].name)}?tail=30`,
        );
        document.getElementById("overview-logs").innerHTML =
          `<div class="log-viewer">${colorizeLog(data.content)}</div>`;
      } else {
        document.getElementById("overview-logs").innerHTML =
          '<div style="color:var(--text-3)">No log files found.</div>';
      }
    } catch {
      document.getElementById("overview-logs").innerHTML =
        '<div style="color:var(--text-3)">Could not load logs.</div>';
    }
  } catch (err) {
    content.innerHTML =
      '<div class="card" style="color:var(--red)">Failed to load overview data.</div>';
    showToast("Failed to load overview", "error");
  }
}

async function updateActivePlayersWidget() {
  const container = document.getElementById("overview-players");
  if (!container) return;
  try {
    const players = await api.get("/players");
    if (players.length === 0) {
      container.innerHTML =
        '<div style="color:var(--text-3);padding:8px">No active music players.</div>';
      return;
    }

    container.innerHTML = `
      <div style="overflow-x:auto">
        <table class="table" style="margin:0">
          <thead>
            <tr>
              <th>Guild</th>
              <th>Voice Channel ID</th>
              <th>Status</th>
              <th>Current Track</th>
              <th>Queue</th>
            </tr>
          </thead>
          <tbody>
            ${players
              .map((p) => {
                const statusBadge = p.is_paused
                  ? '<span class="badge badge--yellow">Paused</span>'
                  : p.is_playing
                    ? '<span class="badge badge--green">Playing</span>'
                    : '<span class="badge badge--grey">Idle</span>';

                const trackHtml = p.current_track
                  ? `<a href="${esc(p.current_track.uri)}" target="_blank" style="color:var(--accent);text-decoration:none;font-weight:500">${esc(p.current_track.title)}</a> <span style="font-size:11px;color:var(--text-3)">by ${esc(p.current_track.author)}</span>`
                  : '<span style="color:var(--text-3)">None</span>';

                return `
                <tr>
                  <td><strong>${esc(p.guild_name)}</strong> <span style="font-size:11px;color:var(--text-3)">(${esc(p.guild_id)})</span></td>
                  <td style="font-family:var(--font-mono);font-size:12px">${esc(p.voice_channel_id || "N/A")}</td>
                  <td>${statusBadge}</td>
                  <td>${trackHtml}</td>
                  <td>${p.queue_length} track(s)</td>
                </tr>
              `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML =
      '<div style="color:var(--red);padding:8px">Failed to load active music players.</div>';
  }
}

async function renderConfig() {
  const content = document.getElementById("content");
  content.innerHTML = '<div class="skeleton" style="height:300px"></div>';

  try {
    const configData = await api.get("/config");

    const formatVal = (v) => {
      if (v === null || v === undefined || v === "")
        return '<span class="badge badge--grey">Not Set</span>';
      if (typeof v === "boolean")
        return v
          ? '<span class="badge badge--green">True</span>'
          : '<span class="badge badge--red">False</span>';
      return `<code style="font-family:var(--font-mono); background:var(--bg-base); padding:2px 6px; border:1px solid var(--border); border-radius:var(--radius-sm); font-size:12px;">${esc(String(v))}</code>`;
    };

    const renderGroup = (title, obj) => {
      const rows = Object.entries(obj)
        .map(([key, val]) => {
          let displayVal = formatVal(val);
          if (key === "api_key_set") {
            displayVal = val
              ? '<span class="badge badge--green">● Configured</span>'
              : '<span class="badge badge--red">● Not Configured</span>';
          }
          return `
          <tr>
            <td style="font-family:var(--font-mono);font-size:12px;width:30%">${esc(key)}</td>
            <td>${displayVal}</td>
          </tr>
        `;
        })
        .join("");

      return `
        <div class="card" style="margin-bottom:16px; padding:0; overflow:hidden">
          <div style="padding:10px 16px; background:var(--bg-mid); font-weight:600; font-size:12px; border-bottom:1px solid var(--border); color:var(--text-2); text-transform:uppercase; letter-spacing:0.5px">${esc(title)}</div>
          <table class="table" style="margin:0">
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    };

    content.innerHTML = `
      <div style="max-width:800px;margin:0 auto">
        ${renderGroup("Bot Info", configData.bot)}
        ${renderGroup("Lavalink Nodes", configData.lavalink)}
        ${renderGroup("YouTube Settings", configData.youtube)}
        ${renderGroup("TikTok Settings", configData.tiktok)}
        ${renderGroup("Dashboard Server", configData.dashboard)}
      </div>
    `;
  } catch (err) {
    content.innerHTML =
      '<div class="card" style="color:var(--red)">Failed to load configuration settings.</div>';
  }
}

// ── Guilds List Page ──
async function renderGuilds() {
  const content = document.getElementById("content");
  content.innerHTML = '<div class="skeleton" style="height:300px"></div>';

  try {
    const guilds = await api.get("/guilds");
    state.guilds = guilds;

    const featureBadges = (fc) => {
      const b = [];
      if (fc.youtube)
        b.push(`<span class="badge badge--red">yt-${fc.youtube}</span>`);
      if (fc.tiktok)
        b.push(`<span class="badge badge--accent">tt-${fc.tiktok}</span>`);
      if (fc.alarms)
        b.push(`<span class="badge badge--yellow">alarm-${fc.alarms}</span>`);
      if (fc.tempvc)
        b.push(`<span class="badge badge--green">vc-${fc.tempvc}</span>`);
      return b.join(" ") || '<span class="badge badge--grey">none</span>';
    };

    content.innerHTML = `
      <div style="margin-bottom:12px"><input class="search-input" id="guild-search" placeholder="Search guilds..." oninput="filterGuildTable()"></div>
      <div class="card" style="padding:0;overflow:hidden">
        <table class="table" id="guild-table">
          <thead><tr><th></th><th>Name</th><th>Members</th><th>Features</th><th></th></tr></thead>
          <tbody>${guilds
            .map(
              (g) => `
            <tr data-name="${esc(g.name.toLowerCase())}">
              <td>${guildIconHtml(g.icon, g.name)}</td>
              <td>${esc(g.name)}</td>
              <td>${g.memberCount.toLocaleString()}</td>
              <td>${featureBadges(g.feature_counts)}</td>
              <td><button class="btn btn--ghost btn--sm" onclick="location.hash='#guild/${g.id}'">Settings</button></td>
            </tr>`,
            )
            .join("")}</tbody>
        </table>
      </div>`;
  } catch {
    content.innerHTML =
      '<div class="card" style="color:var(--red)">Failed to load guilds.</div>';
  }
}

function filterGuildTable() {
  const q = document.getElementById("guild-search").value.toLowerCase();
  document.querySelectorAll("#guild-table tbody tr").forEach((row) => {
    row.style.display = row.dataset.name.includes(q) ? "" : "none";
  });
}

// ── Guild Detail Page ──
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

// ── Guild Tab: YouTube ──
async function renderYouTube(el, guildId) {
  el.innerHTML = '<div class="skeleton" style="height:200px"></div>';

  try {
    const subs = await api.get(`/guilds/${guildId}/youtube`);
    el.innerHTML = `
      <div class="card" style="padding:0;overflow-x:auto">
        <table class="table" id="yt-table">
          <thead><tr><th>Channel</th><th>Channel ID</th><th>Announce Ch</th><th>Videos</th><th>Shorts</th><th>Live</th><th>Upcoming</th><th></th></tr></thead>
          <tbody>${subs.map((s) => ytRow(s, guildId)).join("")}</tbody>
        </table>
        ${subs.length === 0 ? '<div style="padding:16px;color:var(--text-3)">No YouTube subscriptions.</div>' : ""}
      </div>
      <div class="collapsible" id="yt-add-form">
        <div class="collapsible-header" onclick="this.parentElement.classList.toggle('open')">+ Add YouTube subscription</div>
        <div class="collapsible-body">
          <div class="form-row">
            <div class="form-group" style="flex:1"><label>Channel URL / @handle / UC... ID</label><input class="input" id="yt-channel-input"></div>
            <div class="form-group" style="flex:1"><label>Announce Channel ID</label><input class="input" id="yt-announce-id" placeholder="e.g. 1234..."></div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1"><label>Mention Role ID (optional)</label><input class="input" id="yt-mention-id" placeholder="e.g. 1234... or blank" oninput="updateMsgPreview('yt-custom-msg','yt-mention-id','yt-add-preview','🔔 {name} uploaded a new {type}!\n{title}\n{url}')"></div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1"><label>Custom Message (optional)</label><input class="input" id="yt-custom-msg" placeholder="{role} {name} uploaded {title} {url}" oninput="updateMsgPreview('yt-custom-msg','yt-mention-id','yt-add-preview','🔔 {name} uploaded a new {type}!\n{title}\n{url}')"></div>
          </div>
          <div class="form-hint" style="font-size:11px;color:var(--text-3);margin-bottom:4px">Placeholders: {role} {name} {url} {title} {type}. Leave blank for the default message.</div>
          <div class="form-preview" id="yt-add-preview" style="font-size:12px;color:var(--text-3);background:var(--bg-2);padding:8px 10px;border-radius:6px;margin-bottom:10px;white-space:pre-wrap;border:1px solid var(--border)"></div>
          <div class="form-row" style="margin-bottom:12px">
            <label style="font-size:12px;color:var(--text-3);margin-right:16px">Videos ${toggleHtml("", true, 'id="yt-add-videos"')}</label>
            <label style="font-size:12px;color:var(--text-3);margin-right:16px">Shorts ${toggleHtml("", true, 'id="yt-add-shorts"')}</label>
            <label style="font-size:12px;color:var(--text-3);margin-right:16px">Live ${toggleHtml("", true, 'id="yt-add-live"')}</label>
            <label style="font-size:12px;color:var(--text-3)">Upcoming ${toggleHtml("", true, 'id="yt-add-upcoming"')}</label>
          </div>
          <div id="yt-add-error" class="inline-error" style="display:none"></div>
          <button class="btn btn--primary" onclick="submitYtAdd('${guildId}')">Add Subscription</button>
        </div>
      </div>
      <div class="info-note">YouTube subs are shared across guilds — removing here removes only this guild's subscription.</div>`;
  } catch {
    el.innerHTML =
      '<div class="card" style="color:var(--red)">Failed to load YouTube subscriptions.</div>';
  }
}

function ytRow(s, guildId) {
  return `<tr id="yt-row-${s.id}">
    <td>${esc(s.youtubeChannelTitle || "")}</td>
    <td style="font-family:var(--font-mono);font-size:12px">${esc(s.youtubeChannelId || "")}</td>
    <td style="font-family:var(--font-mono);font-size:12px">${esc(s.announceChannelId || "")}</td>
    <td>${toggleHtml("", s.notifyVideos !== false, `onchange="patchYtSub('${guildId}','${s.id}','notifyVideos',this.checked)"`)}</td>
    <td>${toggleHtml("", s.notifyShorts !== false, `onchange="patchYtSub('${guildId}','${s.id}','notifyShorts',this.checked)"`)}</td>
    <td>${toggleHtml("", (s.notifyLive ?? true) !== false, `onchange="patchYtSub('${guildId}','${s.id}','notifyLive',this.checked)"`)}</td>
    <td>${toggleHtml("", (s.notifyUpcoming ?? true) !== false, `onchange="patchYtSub('${guildId}','${s.id}','notifyUpcoming',this.checked)"`)}</td>
    <td style="white-space:nowrap">
      <button class="btn btn--ghost btn--sm" onclick="toggleYtEdit('${s.id}')">Edit</button>
      <span id="yt-rm-${s.id}"><button class="btn btn--danger btn--sm" onclick="confirmYtRemove('${guildId}','${s.id}')">Remove</button></span>
    </td>
  </tr>
  <tr id="yt-edit-${s.id}" style="display:none">
    <td colspan="8" style="background:var(--bg-2)">
      <div class="form-row">
        <div class="form-group" style="flex:1"><label>Mention Role ID</label><input class="input" id="yt-edit-mention-${s.id}" value="${escAttr(s.mentionRoleId || "")}" placeholder="blank = no ping" oninput="updateMsgPreview('yt-edit-msg-${s.id}','yt-edit-mention-${s.id}','yt-edit-preview-${s.id}','🔔 {name} uploaded a new {type}!\\n{title}\\n{url}')"></div>
        <div class="form-group" style="flex:2"><label>Custom Message</label><input class="input" id="yt-edit-msg-${s.id}" value="${escAttr(s.customMessage || "")}" placeholder="{role} {name} uploaded {title} {url}" oninput="updateMsgPreview('yt-edit-msg-${s.id}','yt-edit-mention-${s.id}','yt-edit-preview-${s.id}','🔔 {name} uploaded a new {type}!\\n{title}\\n{url}')"></div>
      </div>
      <div class="form-hint" style="font-size:11px;color:var(--text-3);margin-bottom:4px">Placeholders: {role} {name} {url} {title} {type}. Leave message blank for the default.</div>
      <div class="form-preview" id="yt-edit-preview-${s.id}" style="font-size:12px;color:var(--text-3);background:var(--bg-1);padding:8px 10px;border-radius:6px;margin-bottom:10px;white-space:pre-wrap;border:1px solid var(--border)"></div>
      <button class="btn btn--primary btn--sm" onclick="saveYtEdit('${guildId}','${s.id}')">Save</button>
    </td>
  </tr>`;
}

function toggleYtEdit(subId) {
  const row = document.getElementById(`yt-edit-${subId}`);
  if (row) {
    const isShowing = row.style.display === "none";
    row.style.display = isShowing ? "table-row" : "none";
    if (isShowing) {
      updateMsgPreview(
        `yt-edit-msg-${subId}`,
        `yt-edit-mention-${subId}`,
        `yt-edit-preview-${subId}`,
        "🔔 {name} uploaded a new {type}!\n{title}\n{url}",
      );
    }
  }
}

async function saveYtEdit(guildId, subId) {
  try {
    await api.patch(`/guilds/${guildId}/youtube/${subId}`, {
      mention_role_id:
        document.getElementById(`yt-edit-mention-${subId}`).value.trim() ||
        null,
      custom_message:
        document.getElementById(`yt-edit-msg-${subId}`).value.trim() || null,
    });
    showToast("Subscription updated", "success");
    toggleYtEdit(subId);
  } catch {
    showToast("Failed to update subscription", "error");
  }
}

async function patchYtSub(guildId, subId, field, value) {
  try {
    await api.patch(`/guilds/${guildId}/youtube/${subId}`, { [field]: value });
  } catch {
    showToast("Failed to update subscription", "error");
    renderYouTube(document.getElementById("guild-tab-content"), guildId);
  }
}

function confirmYtRemove(guildId, subId) {
  const el = document.getElementById(`yt-rm-${subId}`);
  el.innerHTML = `<span class="confirm-inline">
    <button class="btn btn--confirm btn--sm" onclick="doYtRemove('${guildId}','${subId}')">✓</button>
    <button class="btn btn--ghost btn--sm" onclick="renderYouTube(document.getElementById('guild-tab-content'),'${guildId}')">✗</button>
  </span>`;
}

async function doYtRemove(guildId, subId) {
  try {
    await api.del(`/guilds/${guildId}/youtube/${subId}`);
    const row = document.getElementById(`yt-row-${subId}`);
    if (row) row.remove();
    showToast("Subscription removed", "success");
  } catch {
    showToast("Failed to remove subscription", "error");
  }
}

async function submitYtAdd(guildId) {
  const errEl = document.getElementById("yt-add-error");
  errEl.style.display = "none";
  const channel_input = document
    .getElementById("yt-channel-input")
    .value.trim();
  const announce_channel_id = document
    .getElementById("yt-announce-id")
    .value.trim();
  if (!channel_input || !announce_channel_id) {
    errEl.textContent = "Both fields are required.";
    errEl.style.display = "block";
    return;
  }

  try {
    await api.post(`/guilds/${guildId}/youtube`, {
      channel_input,
      announce_channel_id,
      mention_role_id:
        document.getElementById("yt-mention-id").value.trim() || null,
      custom_message:
        document.getElementById("yt-custom-msg").value.trim() || null,
      notify_videos: document.getElementById("yt-add-videos").checked,
      notify_shorts: document.getElementById("yt-add-shorts").checked,
      notify_live: document.getElementById("yt-add-live").checked,
      notify_upcoming: document.getElementById("yt-add-upcoming").checked,
    });
    showToast("YouTube subscription added", "success");
    document.getElementById("yt-add-form").classList.remove("open");
    renderYouTube(document.getElementById("guild-tab-content"), guildId);
  } catch (err) {
    const body = await err.json?.().catch(() => ({}));
    errEl.textContent = body?.error || "Failed to add subscription.";
    errEl.style.display = "block";
  }
}

// ── Guild Tab: TikTok ──
async function renderTikTok(el, guildId) {
  el.innerHTML = '<div class="skeleton" style="height:200px"></div>';

  try {
    const subs = await api.get(`/guilds/${guildId}/tiktok`);
    const dismissed = sessionStorage.getItem("tt-info-dismissed");
    const infoBanner = dismissed
      ? ""
      : `<div class="card" style="margin-bottom:12px;border-left:3px solid var(--accent)" id="tt-info-banner">
      <div style="display:flex;justify-content:space-between;align-items:start">
        <div style="font-size:13px;color:var(--text-2)">ℹ️ Live detection is disabled when using the default TikWM scraper. The Live toggle has no effect unless a custom TIKTOK_API_BASE is set.</div>
        <button class="btn btn--ghost btn--sm" onclick="sessionStorage.setItem('tt-info-dismissed','1');document.getElementById('tt-info-banner').remove()">✕</button>
      </div>
    </div>`;

    el.innerHTML = `${infoBanner}
      <div class="card" style="padding:0;overflow-x:auto">
        <table class="table" id="tt-table">
          <thead><tr><th>Username</th><th>Announce Ch</th><th>Posts</th><th>Live</th><th></th></tr></thead>
          <tbody>${subs.map((s) => ttRow(s, guildId)).join("")}</tbody>
        </table>
        ${subs.length === 0 ? '<div style="padding:16px;color:var(--text-3)">No TikTok subscriptions.</div>' : ""}
      </div>
      <div class="collapsible" id="tt-add-form">
        <div class="collapsible-header" onclick="this.parentElement.classList.toggle('open')">+ Add TikTok subscription</div>
        <div class="collapsible-body">
          <div class="form-row">
            <div class="form-group" style="flex:1"><label>Username or Profile URL</label><input class="input" id="tt-username-input"></div>
            <div class="form-group" style="flex:1"><label>Announce Channel ID</label><input class="input" id="tt-announce-id" placeholder="e.g. 1234..."></div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1"><label>Mention Role ID (optional)</label><input class="input" id="tt-mention-id" placeholder="e.g. 1234... or blank" oninput="updateMsgPreview('tt-custom-msg','tt-mention-id','tt-add-preview','🎵 {name} posted a new {type}!\n{url}')"></div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1"><label>Custom Message (optional)</label><input class="input" id="tt-custom-msg" placeholder="{role} {name} posted {url}" oninput="updateMsgPreview('tt-custom-msg','tt-mention-id','tt-add-preview','🎵 {name} posted a new {type}!\n{url}')"></div>
          </div>
          <div class="form-hint" style="font-size:11px;color:var(--text-3);margin-bottom:4px">Placeholders: {role} {name} {url} {title} {type}. Leave blank for the default message.</div>
          <div class="form-preview" id="tt-add-preview" style="font-size:12px;color:var(--text-3);background:var(--bg-2);padding:8px 10px;border-radius:6px;margin-bottom:10px;white-space:pre-wrap;border:1px solid var(--border)"></div>
          <div class="form-row" style="margin-bottom:12px">
            <label style="font-size:12px;color:var(--text-3);margin-right:16px">Posts ${toggleHtml("", true, 'id="tt-add-posts"')}</label>
            <label style="font-size:12px;color:var(--text-3)">Live ${toggleHtml("", true, 'id="tt-add-live"')}</label>
          </div>
          <div id="tt-add-error" class="inline-error" style="display:none"></div>
          <button class="btn btn--primary" onclick="submitTtAdd('${guildId}')">Add Subscription</button>
        </div>
      </div>`;
  } catch {
    el.innerHTML =
      '<div class="card" style="color:var(--red)">Failed to load TikTok subscriptions.</div>';
  }
}

function ttRow(s, guildId) {
  return `<tr id="tt-row-${s.id}">
    <td>@${esc(s.username || "")}</td>
    <td style="font-family:var(--font-mono);font-size:12px">${esc(s.discordChannelId || "")}</td>
    <td>${toggleHtml("", s.notifyVideos !== false, `onchange="patchTtSub('${guildId}','${s.id}','notify_posts',this.checked)"`)}</td>
    <td>${toggleHtml("", (s.notifyLive ?? true) !== false, `onchange="patchTtSub('${guildId}','${s.id}','notify_live',this.checked)"`)}</td>
    <td style="white-space:nowrap">
      <button class="btn btn--ghost btn--sm" onclick="toggleTtEdit('${s.id}')">Edit</button>
      <span id="tt-rm-${s.id}"><button class="btn btn--danger btn--sm" onclick="confirmTtRemove('${guildId}','${s.id}')">Remove</button></span>
    </td>
  </tr>
  <tr id="tt-edit-${s.id}" style="display:none">
    <td colspan="5" style="background:var(--bg-2)">
      <div class="form-row">
        <div class="form-group" style="flex:1"><label>Mention Role ID</label><input class="input" id="tt-edit-mention-${s.id}" value="${escAttr(s.mentionRoleId || "")}" placeholder="blank = no ping" oninput="updateMsgPreview('tt-edit-msg-${s.id}','tt-edit-mention-${s.id}','tt-edit-preview-${s.id}','🎵 {name} posted a new {type}!\\n{url}')"></div>
        <div class="form-group" style="flex:2"><label>Custom Message</label><input class="input" id="tt-edit-msg-${s.id}" value="${escAttr(s.customMessage || "")}" placeholder="{role} {name} posted {url}" oninput="updateMsgPreview('tt-edit-msg-${s.id}','tt-edit-mention-${s.id}','tt-edit-preview-${s.id}','🎵 {name} posted a new {type}!\\n{url}')"></div>
      </div>
      <div class="form-hint" style="font-size:11px;color:var(--text-3);margin-bottom:4px">Placeholders: {role} {name} {url} {title} {type}. Leave message blank for the default.</div>
      <div class="form-preview" id="tt-edit-preview-${s.id}" style="font-size:12px;color:var(--text-3);background:var(--bg-1);padding:8px 10px;border-radius:6px;margin-bottom:10px;white-space:pre-wrap;border:1px solid var(--border)"></div>
      <button class="btn btn--primary btn--sm" onclick="saveTtEdit('${guildId}','${s.id}')">Save</button>
    </td>
  </tr>`;
}

function toggleTtEdit(subId) {
  const row = document.getElementById(`tt-edit-${subId}`);
  if (row) {
    const isShowing = row.style.display === "none";
    row.style.display = isShowing ? "table-row" : "none";
    if (isShowing) {
      updateMsgPreview(
        `tt-edit-msg-${subId}`,
        `tt-edit-mention-${subId}`,
        `tt-edit-preview-${subId}`,
        "🎵 {name} posted a new {type}!\n{url}",
      );
    }
  }
}

async function saveTtEdit(guildId, subId) {
  try {
    await api.patch(`/guilds/${guildId}/tiktok/${subId}`, {
      mention_role_id:
        document.getElementById(`tt-edit-mention-${subId}`).value.trim() ||
        null,
      custom_message:
        document.getElementById(`tt-edit-msg-${subId}`).value.trim() || null,
    });
    showToast("Subscription updated", "success");
    toggleTtEdit(subId);
  } catch {
    showToast("Failed to update subscription", "error");
  }
}

async function patchTtSub(guildId, subId, field, value) {
  try {
    await api.patch(`/guilds/${guildId}/tiktok/${subId}`, { [field]: value });
  } catch {
    showToast("Failed to update subscription", "error");
    renderTikTok(document.getElementById("guild-tab-content"), guildId);
  }
}

function confirmTtRemove(guildId, subId) {
  const el = document.getElementById(`tt-rm-${subId}`);
  el.innerHTML = `<span class="confirm-inline">
    <button class="btn btn--confirm btn--sm" onclick="doTtRemove('${guildId}','${subId}')">✓</button>
    <button class="btn btn--ghost btn--sm" onclick="renderTikTok(document.getElementById('guild-tab-content'),'${guildId}')">✗</button>
  </span>`;
}

async function doTtRemove(guildId, subId) {
  try {
    await api.del(`/guilds/${guildId}/tiktok/${subId}`);
    const row = document.getElementById(`tt-row-${subId}`);
    if (row) row.remove();
    showToast("Subscription removed", "success");
  } catch {
    showToast("Failed to remove subscription", "error");
  }
}

async function submitTtAdd(guildId) {
  const errEl = document.getElementById("tt-add-error");
  errEl.style.display = "none";
  const username_or_url = document
    .getElementById("tt-username-input")
    .value.trim();
  const announce_channel_id = document
    .getElementById("tt-announce-id")
    .value.trim();
  if (!username_or_url || !announce_channel_id) {
    errEl.textContent = "Both fields are required.";
    errEl.style.display = "block";
    return;
  }

  try {
    await api.post(`/guilds/${guildId}/tiktok`, {
      username_or_url,
      announce_channel_id,
      mention_role_id:
        document.getElementById("tt-mention-id").value.trim() || null,
      custom_message:
        document.getElementById("tt-custom-msg").value.trim() || null,
      notify_posts: document.getElementById("tt-add-posts").checked,
      notify_live: document.getElementById("tt-add-live").checked,
    });
    showToast("TikTok subscription added", "success");
    document.getElementById("tt-add-form").classList.remove("open");
    renderTikTok(document.getElementById("guild-tab-content"), guildId);
  } catch (err) {
    const body = await err.json?.().catch(() => ({}));
    errEl.textContent = body?.error || "Failed to add subscription.";
    errEl.style.display = "block";
  }
}

// ── Guild Tab: TempVC ──
function renderTempVC(el, g) {
  const gens = g.tempvc?.generators || [];
  el.innerHTML = `
    <div class="card" style="padding:0;overflow-x:auto">
      <table class="table">
        <thead><tr><th>Generator Channel ID</th><th>Default Name</th><th>Category</th></tr></thead>
        <tbody>${gens.length ? gens.map((gen) => `<tr><td style="font-family:var(--font-mono);font-size:12px">${esc(gen.id)}</td><td>${esc(gen.defaultName || "")}</td><td style="font-family:var(--font-mono);font-size:12px">${esc(gen.categoryId || "N/A")}</td></tr>`).join("") : '<tr><td colspan="3" style="color:var(--text-3)">No generators configured.</td></tr>'}</tbody>
      </table>
    </div>
    <div style="margin-top:8px" class="stat-row">
      <div class="stat-card"><div class="stat-card__label">Active Temp Channels</div><div class="stat-card__value">${g.tempvc?.active_count ?? 0}</div></div>
    </div>
    <div class="info-note">TempVC settings are managed via /vc slash commands.</div>`;
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
}

// ── Guild Tab: Level ──
function renderLevel(el, g) {
  const top = g.level_top10 || [];
  el.innerHTML = `
    <div class="card" style="padding:0;overflow-x:auto">
      <table class="table">
        <thead><tr><th>Rank</th><th>User ID</th><th>XP</th><th>Level</th></tr></thead>
        <tbody>${
          top.length
            ? top
                .map(
                  (u, i) => `<tr>
          <td>#${i + 1}</td>
          <td style="font-family:var(--font-mono);font-size:12px">${esc(u.userId)}</td>
          <td>${u.xp}</td>
          <td>${u.level}</td>
        </tr>`,
                )
                .join("")
            : '<tr><td colspan="4" style="color:var(--text-3)">No level data.</td></tr>'
        }</tbody>
      </table>
    </div>`;
}

// ── Logs Page ──
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

  try {
    const files = await api.get("/logs");
    content.innerHTML = `
      <div class="logs-layout">
        <div class="logs-filelist" id="logs-filelist">
          ${files.map((f) => `<div class="logs-filelist-item" data-name="${esc(f.name)}" onclick="selectLogFile('${esc(f.name)}')">${esc(f.name)}<div style="font-size:11px;color:var(--text-3)">${(f.size_bytes / 1024).toFixed(1)} KB</div></div>`).join("")}
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

let logsRawContent = "";

async function selectLogFile(name) {
  logsCurrentFile = name;
  document.querySelectorAll(".logs-filelist-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.name === name);
  });
  document.getElementById("log-toolbar").style.display = "flex";
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
    document.getElementById("log-viewer-wrap").innerHTML =
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

  document.getElementById("log-line-count").textContent =
    `Showing ${filtered.length} lines`;
  const html = filtered
    .map((line) => {
      const cls = classifyLogLine(line);
      return `<div class="log-line--${cls}">${formatLogLine(line)}</div>`;
    })
    .join("");

  const wrap = document.getElementById("log-viewer-wrap");
  const wasAtBottom = wrap.firstElementChild
    ? wrap.firstElementChild.scrollHeight -
        wrap.firstElementChild.scrollTop -
        wrap.firstElementChild.clientHeight <
      80
    : true;

  wrap.innerHTML = `<div class="log-viewer">${html}</div>`;

  if (wasAtBottom) {
    const viewer = wrap.firstElementChild;
    if (viewer) viewer.scrollTop = viewer.scrollHeight;
  } else {
    document.getElementById("log-paused").style.display = "inline-flex";
  }
}

function classifyLogLine(line) {
  if (!line) return "info";
  // JSON format (production/PM2): {"level":"error",...}
  const m = line.match(/"level"\s*:\s*"(\w+)"/);
  if (m) {
    const lv = m[1].toLowerCase();
    if (lv === "error") return "error";
    if (lv === "warn" || lv === "warning") return "warn";
    if (lv === "success") return "success";
    if (lv === "debug") return "debug";
    return "info";
  }
  // Pretty format (dev): emoji prefixes
  if (line.includes("❌")) return "error";
  if (line.includes("⚠")) return "warn";
  if (line.includes("✅")) return "success";
  if (line.includes("🐛")) return "debug";
  return "info";
}

function formatLogLine(line) {
  if (!line) return "";
  const trimmed = line.trim();
  let jsonStr = "";
  if (trimmed.startsWith("{")) {
    jsonStr = trimmed;
  } else {
    const idx = trimmed.indexOf("{");
    if (idx !== -1) {
      jsonStr = trimmed.slice(idx);
    }
  }

  if (jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      const emojis = {
        error: "❌",
        warning: "⚠️",
        warn: "⚠️",
        success: "✅",
        debug: "🐛",
        info: "ℹ️",
      };
      const emoji = emojis[data.level?.toLowerCase()] || "ℹ️";

      let timeStr = "";
      if (data.timestamp) {
        const d = new Date(data.timestamp);
        if (!isNaN(d.getTime())) {
          timeStr = `[${d.toLocaleTimeString()}]`;
        }
      }
      if (!timeStr && !trimmed.startsWith("{")) {
        const idx = trimmed.indexOf("{");
        timeStr = `[${trimmed.slice(0, idx).replace(/:$/, "").trim()}]`;
      }

      const moduleStr = data.module ? ` [${data.module}]` : "";
      return `${timeStr} ${emoji}${moduleStr} ${esc(data.message || "")}`;
    } catch {
      // ignore
    }
  }
  return esc(line);
}

function colorizeLog(content) {
  if (!content) return "";
  return content
    .split("\n")
    .map(
      (line) =>
        `<div class="log-line--${classifyLogLine(line)}">${formatLogLine(line)}</div>`,
    )
    .join("");
}

function toggleAutoTail(on) {
  logsAutoTail = on;
  if (logsAutoTimer) {
    clearInterval(logsAutoTimer);
    logsAutoTimer = null;
  }
  if (on) {
    logsAutoTimer = setInterval(reloadLogFile, 2500);
    document.getElementById("log-paused").style.display = "none";
  }
}
