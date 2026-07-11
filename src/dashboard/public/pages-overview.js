/* ═══════════════════════════════════════════════════════════════════
   Kizoxy Dashboard — pages-overview.js (Overview Page)
   ═══════════════════════════════════════════════════════════════════ */

async function renderOverview() {
  const content = document.getElementById("content");
  content.innerHTML =
    '<div class="skeleton" style="height:120px;margin-bottom:16px"></div>';

  try {
    const [stats, meta] = await Promise.all([
      api.get("/stats"),
      api.get("/meta"),
    ]);

    let lavalinkBadge =
      '<span class="badge badge--red"><span class="status-dot status-dot--dnd"></span> disconnected</span>';
    if (meta?.lavalink_status === "connected") {
      lavalinkBadge =
        '<span class="badge badge--green"><span class="status-dot status-dot--online"></span> connected</span>';
    } else if (meta?.lavalink_status === "reconnecting") {
      lavalinkBadge =
        '<span class="badge badge--yellow"><span class="status-dot status-dot--reconnecting"></span> reconnecting</span>';
    }

    content.innerHTML = `
      <div class="stat-row">
        <div class="stat-card"><div class="stat-card__label">Guilds</div><div class="stat-card__value">${stats.guild_count}</div></div>
        <div class="stat-card"><div class="stat-card__label">Users</div><div class="stat-card__value">${stats.user_count.toLocaleString()}</div></div>
        <div class="stat-card"><div class="stat-card__label">Memory</div><div class="stat-card__value">${stats.memory_rss_mb} MB</div></div>
        <div class="stat-card"><div class="stat-card__label">Uptime</div><div class="stat-card__value">${formatUptime(stats.uptime_ms)}</div></div>
        <div class="stat-card"><div class="stat-card__label">Lavalink</div><div class="stat-card__value" style="display:flex;align-items:center;height:24px;">${lavalinkBadge}</div></div>
        <div class="stat-card"><div class="stat-card__label">Music Players</div><div class="stat-card__value">${stats.active_player_count ?? 0}</div></div>
        <div class="stat-card"><div class="stat-card__label">Alarms</div><div class="stat-card__value">${stats.active_alarm_count ?? 0}</div></div>
        <div class="stat-card"><div class="stat-card__label">YT Subs</div><div class="stat-card__value">${stats.youtube_total_subs}</div></div>
        <div class="stat-card"><div class="stat-card__label">TT Subs</div><div class="stat-card__value">${stats.tiktok_total_subs}</div></div>
        <div class="stat-card"><div class="stat-card__label">Donations Prompted</div><div class="stat-card__value">${stats.donate_seen_count ?? 0}</div></div>
      </div>

      <div class="card" style="margin-bottom:16px; display:flex; align-items:center; gap:16px;">
        <img src="${esc(meta?.bot_avatar_url || "")}" alt="" style="width:48px;height:48px;border-radius:50%;background:var(--bg-mid);" onerror="this.style.display='none'">
        <div>
          <div style="font-size:16px; font-weight:600; display:flex; align-items:center; gap:8px;">
            <span>${esc(meta?.bot_name)}</span>
            <span style="font-size:12px; color:var(--text-3); font-weight:normal;">${esc(meta?.bot_tag)}</span>
          </div>
          <div style="font-size:12px; color:var(--text-3); margin-top:4px; display:flex; align-items:center; gap:8px;">
            <span>ID: <code class="id-chip" style="cursor:pointer;" onclick="navigator.clipboard.writeText('${esc(meta?.bot_id)}');showToast('Copied Bot ID!','info')">${esc(meta?.bot_id)}</code></span>
          </div>
        </div>
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
