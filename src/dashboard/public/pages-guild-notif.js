/* ═══════════════════════════════════════════════════════════════════
   Kizoxy Dashboard — pages-guild-notif.js (YouTube & TikTok Subscriptions)
   ═══════════════════════════════════════════════════════════════════ */

// ── Guild Tab: YouTube ──
async function renderYouTube(el, guildId) {
  el.innerHTML = '<div class="skeleton" style="height:200px"></div>';
  try {
    const subs = await api.get(`/guilds/${guildId}/youtube`);
    const g = state.currentGuild;
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
            <div class="form-group" style="flex:1"><label>Announce Channel ID</label>${renderSearchableSelect("yt-announce-id", g.channels || [], "Search channel...", "")}</div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1"><label>Mention Role ID (optional)</label>${renderSearchableSelect("yt-mention-id", [...(g.roles || []).map((r) => ({ id: r.id, name: r.name, color: r.color })), ...(g.members || []).map((m) => ({ id: m.id, name: `${m.name} (${m.tag})` }))], "Search role or member...", "", "updateMsgPreview('yt-custom-msg','yt-mention-id','yt-add-preview','🔔 {name} uploaded a new {type}!\\n{title}\\n{url}')")}</div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label>Custom Message (optional)</label>
              <textarea class="input" id="yt-custom-msg" rows="3" maxlength="500" placeholder="{role} {name} uploaded {title} {url}" oninput="updateMsgPreview('yt-custom-msg','yt-mention-id','yt-add-preview','🔔 {name} uploaded a new {type}!\n{title}\n{url}')" style="resize:vertical; min-height:60px; font-family:inherit;"></textarea>
            </div>
          </div>
          <div class="helper-card" style="margin:10px 0; padding:10px; background:var(--bg-mid); border:1px solid var(--border); border-radius:var(--radius-sm); font-size:12px;">
            <div style="font-weight:600; margin-bottom:4px; color:var(--text-1)">💬 Custom Message Guide</div>
            <div style="color:var(--text-3); margin-bottom:6px">Placeholders are replaced when posted. Max 500 chars.</div>
            <ul style="padding-left:16px; margin:0; color:var(--text-2); line-height:1.4">
              <li><code>{role}</code>: Mentions the role. If not manually positioned, pings are prepended.</li>
              <li><code>{name}</code>: Channel name.</li>
              <li><code>{url}</code>: Link to the YouTube video / stream.</li>
              <li><code>{title}</code>: Video title.</li>
              <li><code>{type}</code>: Upload type (e.g. video, short, live, upcoming).</li>
            </ul>
          </div>
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
  const g = state.currentGuild;
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
      <button class="btn btn--ghost btn--sm" id="yt-check-btn-${s.id}" onclick="ytCheckStatus('${guildId}','${s.id}')">🔍 Check</button>
      <button class="btn btn--ghost btn--sm" onclick="ytForceNotify('${guildId}','${s.id}')" title="Force send latest YouTube notification to Discord">📢 Test Notif</button>
      <span id="yt-rm-${s.id}"><button class="btn btn--danger btn--sm" onclick="confirmYtRemove('${guildId}','${s.id}')">Remove</button></span>
    </td>
  </tr>
  <tr id="yt-check-result-${s.id}" style="display:none">
    <td colspan="8" style="background:var(--bg-2);padding:10px 16px;font-size:12px">
      <div id="yt-check-content-${s.id}"></div>
    </td>
  </tr>
  <tr id="yt-edit-${s.id}" style="display:none">
    <td colspan="8" style="background:var(--bg-2)">
      <div class="form-row">
        <div class="form-group" style="flex:1"><label>Mention Role ID</label>${renderSearchableSelect("yt-edit-mention-" + s.id, [...(g.roles || []).map((r) => ({ id: r.id, name: r.name, color: r.color })), ...(g.members || []).map((m) => ({ id: m.id, name: `${m.name} (${m.tag})` }))], "Search role or member...", s.mentionRoleId, "updateMsgPreview('yt-edit-msg-" + s.id + "','yt-edit-mention-" + s.id + "','yt-edit-preview-" + s.id + "','🔔 {name} uploaded a new {type}!\\n{title}\\n{url}')")}</div>
        <div class="form-group" style="flex:2">
          <label>Custom Message</label>
          <textarea class="input" id="yt-edit-msg-${s.id}" rows="3" maxlength="500" placeholder="{role} {name} uploaded {title} {url}" oninput="updateMsgPreview('yt-edit-msg-${s.id}','yt-edit-mention-${s.id}','yt-edit-preview-${s.id}','🔔 {name} uploaded a new {type}!\\n{title}\\n{url}')" style="resize:vertical; min-height:60px; font-family:inherit;">${esc(s.customMessage || "")}</textarea>
        </div>
      </div>
      <div class="helper-card" style="margin:10px 0; padding:10px; background:var(--bg-elevated); border:1px solid var(--border); border-radius:var(--radius-sm); font-size:12px;">
        <div style="font-weight:600; margin-bottom:4px; color:var(--text-1)">💬 Custom Message Guide</div>
        <div style="color:var(--text-3); margin-bottom:6px">Placeholders are replaced when posted. Max 500 chars.</div>
        <ul style="padding-left:16px; margin:0; color:var(--text-2); line-height:1.4">
          <li><code>{role}</code>: Mentions the role. If not manually positioned, pings are prepended.</li>
          <li><code>{name}</code>: Channel name.</li>
          <li><code>{url}</code>: Link to the YouTube video / stream.</li>
          <li><code>{title}</code>: Video title.</li>
          <li><code>{type}</code>: Upload type (e.g. video, short, live, upcoming).</li>
        </ul>
      </div>
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

// Check current status: fetch latest RSS entry & details from YouTube right now.
async function ytCheckStatus(guildId, subId) {
  const btn = document.getElementById(`yt-check-btn-${subId}`);
  const resultRow = document.getElementById(`yt-check-result-${subId}`);
  const content = document.getElementById(`yt-check-content-${subId}`);

  // Toggle off if already shown
  if (resultRow.style.display !== "none") {
    resultRow.style.display = "none";
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "⏳ Checking...";
  }
  content.innerHTML =
    '<span style="color:var(--text-3)">Fetching from YouTube...</span>';
  resultRow.style.display = "table-row";

  try {
    const data = await api.get(`/guilds/${guildId}/youtube/${subId}/check`);
    const videoHtml = data.latest_video
      ? `<div style="margin-top:6px">
          <b>Latest content:</b> <a href="${esc(data.latest_video.url)}" target="_blank" style="color:var(--accent)">${esc(data.latest_video.title || data.latest_video.id)}</a><br>
          <span style="color:var(--text-3)">Type: <b style="text-transform:uppercase">${esc(data.latest_video.type || "video")}</b> &nbsp;·&nbsp; ID: ${esc(data.latest_video.id)} &nbsp;·&nbsp; ${esc(data.latest_video.publishedAt || "")}</span>
        </div>`
      : `<div style="color:var(--text-3);margin-top:4px">No recent videos found in feed</div>`;
    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <b style="color:var(--text-1)">${esc(data.youtubeChannelTitle)}</b>
        <span style="color:var(--text-3);font-size:11px">checked ${esc(data.checked_at)}</span>
      </div>
      <div>Channel ID: <code>${esc(data.youtubeChannelId)}</code></div>
      ${videoHtml}`;
  } catch (err) {
    const body = await err.json?.().catch(() => ({}));
    content.innerHTML = `<span style="color:var(--red)">${esc(body?.error || "Failed to check status")}</span>`;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "🔍 Check";
    }
  }
}

// Force-send a notification immediately (bypasses scheduler dedup).
async function ytForceNotify(guildId, subId) {
  try {
    const data = await api.post(
      `/guilds/${guildId}/youtube/${subId}/force-notify`,
    );
    if (data.video) {
      showToast(
        `📺 Sent [${data.type || "video"}]: ${data.video.title || data.video.id}`,
        "success",
      );
    } else {
      showToast(`✅ YouTube notification sent`, "success");
    }
  } catch (err) {
    const body = await err.json?.().catch(() => ({}));
    showToast(body?.error || `Failed to send YouTube notification`, "error");
  }
}

// ── Guild Tab: TikTok ──
async function renderTikTok(el, guildId) {
  el.innerHTML = '<div class="skeleton" style="height:200px"></div>';
  try {
    const subs = await api.get(`/guilds/${guildId}/tiktok`);
    const g = state.currentGuild;
    let proxyStatus;
    try {
      proxyStatus = await api.get(`/guilds/${guildId}/proxy/status`);
    } catch (err) {
      proxyStatus = { error: err.message || "Scraper unavailable" };
    }
    let healthBanner = "";
    try {
      const meta = await api.get("/meta");
      const ttStats = meta?.tiktok_strategy_stats;
      if (ttStats && ttStats.warning_banner) {
        healthBanner = `<div class="card" style="margin-bottom:12px;border-left:4px solid var(--red);background:rgba(255,59,48,0.1);color:var(--red)">
          <div style="font-weight:600">⚠️ TikTok Primary Source Health Warning</div>
          <div style="font-size:13px;margin-top:4px">${ttStats.warning_banner}</div>
        </div>`;
      }
    } catch (_) {}

    const dismissed = sessionStorage.getItem("tt-info-dismissed");
    const infoBanner = dismissed
      ? ""
      : `<div class="card" style="margin-bottom:12px;border-left:3px solid var(--accent)" id="tt-info-banner">
      <div style="display:flex;justify-content:space-between;align-items:start">
        <div style="font-size:13px;color:var(--text-2)">ℹ️ Multi-strategy TikTok scraper active. Live streams and video posts are monitored automatically.</div>
        <button class="btn btn--ghost btn--sm" onclick="sessionStorage.setItem('tt-info-dismissed','1');document.getElementById('tt-info-banner').remove()">✕</button>
      </div>
    </div>`;
    el.innerHTML = `${healthBanner}${infoBanner}
      <div id="tt-proxy-panel">${renderTtProxyPanel(proxyStatus, guildId)}</div>
      <div class="card table-container" style="padding:0">
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
            <div class="form-group" style="flex:1"><label>Announce Channel ID</label>${renderSearchableSelect("tt-announce-id", g.channels || [], "Search channel...", "")}</div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1"><label>Mention Role ID (optional)</label>${renderSearchableSelect("tt-mention-id", [...(g.roles || []).map((r) => ({ id: r.id, name: r.name, color: r.color })), ...(g.members || []).map((m) => ({ id: m.id, name: `${m.name} (${m.tag})` }))], "Search role or member...", "", "updateMsgPreview('tt-custom-msg','tt-mention-id','tt-add-preview','🎵 {name} posted a new {type}!\\n{url}')")}</div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label>Custom Message (optional)</label>
              <textarea class="input" id="tt-custom-msg" rows="3" maxlength="500" placeholder="{role} {name} posted {url}" oninput="updateMsgPreview('tt-custom-msg','tt-mention-id','tt-add-preview','🎵 {name} posted a new {type}!\n{url}')" style="resize:vertical; min-height:60px; font-family:inherit;"></textarea>
            </div>
          </div>
          <div class="helper-card" style="margin:10px 0; padding:10px; background:var(--bg-mid); border:1px solid var(--border); border-radius:var(--radius-sm); font-size:12px;">
            <div style="font-weight:600; margin-bottom:4px; color:var(--text-1)">💬 Custom Message Guide</div>
            <div style="color:var(--text-3); margin-bottom:6px">Placeholders are replaced when posted. Max 500 chars.</div>
            <ul style="padding-left:16px; margin:0; color:var(--text-2); line-height:1.4">
              <li><code>{role}</code>: Mentions the role. If not manually positioned, pings are prepended.</li>
              <li><code>{name}</code>: Creator username.</li>
              <li><code>{url}</code>: Link to the TikTok video / live.</li>
              <li><code>{title}</code>: Video title.</li>
              <li><code>{type}</code>: Upload type (e.g. video, live).</li>
            </ul>
          </div>
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

function proxyData(response) {
  return response?.data && typeof response.data === "object"
    ? response.data
    : response || {};
}

function renderTtProxyPanel(response, guildId) {
  const status = proxyData(response);
  if (status.error) {
    return `<section class="card proxy-card" aria-labelledby="tt-proxy-title">
      <div class="proxy-card__header">
        <div><h3 id="tt-proxy-title">Scraper-wide proxy rotation</h3><p>Shared by every guild, not a per-server setting.</p></div>
        <span class="badge badge--red">Unavailable</span>
      </div>
      <div class="proxy-error">${esc(status.error)}</div>
      ${proxyCaveatHtml()}
    </section>`;
  }

  const mode = ["off", "manual", "auto"].includes(status.mode)
    ? status.mode
    : "off";
  const currentProxy = status.current_proxy || "Direct connection (no proxy)";
  const failures = Number.isFinite(Number(status.consecutive_failures))
    ? Number(status.consecutive_failures)
    : 0;
  const threshold = Number.isFinite(Number(status.failure_threshold))
    ? Number(status.failure_threshold)
    : 20;

  return `<section class="card proxy-card" aria-labelledby="tt-proxy-title">
    <div class="proxy-card__header">
      <div><h3 id="tt-proxy-title">Scraper-wide proxy rotation</h3><p>Shared by every guild, not a per-server setting.</p></div>
      <span class="badge ${currentProxy === "Direct connection (no proxy)" ? "badge--grey" : "badge--green"}">${currentProxy === "Direct connection (no proxy)" ? "Direct" : "Proxy active"}</span>
    </div>
    <div class="proxy-card__status">
      <div><span>Current connection</span><strong>${esc(currentProxy)}</strong></div>
      <div><span>Network failure trigger</span><strong>${failures} / ${threshold} consecutive network failures</strong></div>
    </div>
    <div class="proxy-card__controls">
      <div class="form-group">
        <label for="tt-proxy-mode">Rotation mode</label>
        <select class="select" id="tt-proxy-mode" onchange="setTtProxyMode('${guildId}',this.value)">
          <option value="off" ${mode === "off" ? "selected" : ""}>Off</option>
          <option value="manual" ${mode === "manual" ? "selected" : ""}>Manual</option>
          <option value="auto" ${mode === "auto" ? "selected" : ""}>Auto</option>
        </select>
      </div>
      <button class="btn btn--primary" id="tt-proxy-rotate" onclick="rotateTtProxy('${guildId}')">↻ Rotate Now</button>
    </div>
    <div class="form-group proxy-card__source">
      <label for="tt-proxy-source">Proxy list source URL</label>
      <div class="proxy-source-row">
        <input class="input" id="tt-proxy-source" type="url" value="${escAttr(status.list_source_url || "")}" placeholder="https://provider.example/proxies.txt" autocomplete="url">
        <button class="btn btn--ghost" id="tt-proxy-source-save" onclick="saveTtProxySource('${guildId}')">Save</button>
      </div>
      ${proxyCaveatHtml()}
    </div>
  </section>`;
}

function proxyCaveatHtml() {
  return `<div class="proxy-caveat"><strong>Free proxy lists are usually not reliable against TikTok's anti-bot system</strong> — only about 2–8% of public proxies typically work, and public proxy IPs are often blocked faster than your own connection. This works with any proxy list URL, including a paid provider's, if you have one. Rotation only helps with network-level blocking; it won't help with accounts that are private, banned, or don't exist.</div>`;
}

async function refreshTtProxyPanel(guildId) {
  const panel = document.getElementById("tt-proxy-panel");
  if (!panel) return;
  try {
    panel.innerHTML = renderTtProxyPanel(
      await api.get(`/guilds/${guildId}/proxy/status`),
      guildId,
    );
  } catch (err) {
    panel.innerHTML = renderTtProxyPanel({ error: err.message }, guildId);
  }
}

async function setTtProxyMode(guildId, mode) {
  const select = document.getElementById("tt-proxy-mode");
  if (select) select.disabled = true;
  try {
    await api.post(`/guilds/${guildId}/proxy/mode`, { mode });
    showToast(`Proxy mode set to ${mode}`, "success");
  } catch {
    showToast("Failed to update proxy mode", "error");
  } finally {
    await refreshTtProxyPanel(guildId);
  }
}

async function rotateTtProxy(guildId) {
  const button = document.getElementById("tt-proxy-rotate");
  if (button) {
    button.disabled = true;
    button.textContent = "Rotating…";
  }
  try {
    await api.post(`/guilds/${guildId}/proxy/rotate`);
    showToast("Proxy rotated", "success");
  } catch {
    showToast("Failed to rotate proxy", "error");
  } finally {
    await refreshTtProxyPanel(guildId);
  }
}

async function saveTtProxySource(guildId) {
  const input = document.getElementById("tt-proxy-source");
  const button = document.getElementById("tt-proxy-source-save");
  const listSourceUrl = input?.value.trim() || "";
  if (!listSourceUrl) {
    showToast("Proxy list source URL is required", "error");
    input?.focus();
    return;
  }
  if (button) button.disabled = true;
  try {
    await api.post(`/guilds/${guildId}/proxy/source`, {
      list_source_url: listSourceUrl,
    });
    showToast("Proxy list source saved", "success");
  } catch {
    showToast("Failed to save proxy list source", "error");
  } finally {
    await refreshTtProxyPanel(guildId);
  }
}

function ttRow(s, guildId) {
  const g = state.currentGuild;
  return `<tr id="tt-row-${s.id}">
    <td>@${esc(s.username || "")}</td>
    <td style="font-family:var(--font-mono);font-size:12px">${esc(s.discordChannelId || "")}</td>
    <td>${toggleHtml("", s.notifyVideos !== false, `onchange="patchTtSub('${guildId}','${s.id}','notify_posts',this.checked)"`)}</td>
    <td>${toggleHtml("", (s.notifyLive ?? true) !== false, `onchange="patchTtSub('${guildId}','${s.id}','notify_live',this.checked)"`)}</td>
    <td style="white-space:nowrap">
      <button class="btn btn--ghost btn--sm" onclick="toggleTtEdit('${s.id}')">Edit</button>
      <button class="btn btn--ghost btn--sm" id="tt-check-btn-${s.id}" onclick="ttCheckStatus('${guildId}','${s.id}')">🔍 Check</button>
      <button class="btn btn--ghost btn--sm" onclick="ttForceNotify('${guildId}','${s.id}','video')" title="Force send latest video notification">📲 Send Video</button>
      <button class="btn btn--ghost btn--sm" onclick="ttForceNotify('${guildId}','${s.id}','live')" title="Force send live notification (only if currently live)">🔴 Send Live</button>
      <span id="tt-rm-${s.id}"><button class="btn btn--danger btn--sm" onclick="confirmTtRemove('${guildId}','${s.id}')">Remove</button></span>
    </td>
  </tr>
  <tr id="tt-check-result-${s.id}" style="display:none">
    <td colspan="5" style="background:var(--bg-2);padding:10px 16px;font-size:12px">
      <div id="tt-check-content-${s.id}"></div>
    </td>
  </tr>
  <tr id="tt-edit-${s.id}" style="display:none">
    <td colspan="5" style="background:var(--bg-2)">
      <div class="form-row">
        <div class="form-group" style="flex:1"><label>Mention Role ID</label>${renderSearchableSelect("tt-edit-mention-" + s.id, [...(g.roles || []).map((r) => ({ id: r.id, name: r.name, color: r.color })), ...(g.members || []).map((m) => ({ id: m.id, name: `${m.name} (${m.tag})` }))], "Search role or member...", s.mentionRoleId, "updateMsgPreview('tt-edit-msg-" + s.id + "','tt-edit-mention-" + s.id + "','tt-edit-preview-" + s.id + "','🎵 {name} posted a new {type}!\\n{url}')")}</div>
        <div class="form-group" style="flex:2">
          <label>Custom Message</label>
          <textarea class="input" id="tt-edit-msg-${s.id}" rows="3" maxlength="500" placeholder="{role} {name} posted {url}" oninput="updateMsgPreview('tt-edit-msg-${s.id}','tt-edit-mention-${s.id}','tt-edit-preview-${s.id}','🎵 {name} posted a new {type}!\\n{url}')" style="resize:vertical; min-height:60px; font-family:inherit;">${esc(s.customMessage || "")}</textarea>
        </div>
      </div>
      <div class="helper-card" style="margin:10px 0; padding:10px; background:var(--bg-elevated); border:1px solid var(--border); border-radius:var(--radius-sm); font-size:12px;">
        <div style="font-weight:600; margin-bottom:4px; color:var(--text-1)">💬 Custom Message Guide</div>
        <div style="color:var(--text-3); margin-bottom:6px">Placeholders are replaced when posted. Max 500 chars.</div>
        <ul style="padding-left:16px; margin:0; color:var(--text-2); line-height:1.4">
          <li><code>{role}</code>: Mentions the role. If not manually positioned, pings are prepended.</li>
          <li><code>{name}</code>: Creator username.</li>
          <li><code>{url}</code>: Link to the TikTok video / live.</li>
          <li><code>{title}</code>: Video title.</li>
          <li><code>{type}</code>: Upload type (e.g. video, live).</li>
        </ul>
      </div>
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

// Check current status: fetch latest video + live state from TikTok right now.
async function ttCheckStatus(guildId, subId) {
  const btn = document.getElementById(`tt-check-btn-${subId}`);
  const resultRow = document.getElementById(`tt-check-result-${subId}`);
  const content = document.getElementById(`tt-check-content-${subId}`);

  // Toggle off if already shown
  if (resultRow.style.display !== "none") {
    resultRow.style.display = "none";
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "⏳ Checking...";
  }
  content.innerHTML =
    '<span style="color:var(--text-3)">Fetching from TikTok...</span>';
  resultRow.style.display = "table-row";

  try {
    const data = await api.get(`/guilds/${guildId}/tiktok/${subId}/check`);
    const liveHtml = data.live
      ? `<span style="color:var(--green);font-weight:600">🔴 LIVE</span> — liveId: <code>${esc(data.liveId || "?")}</code>`
      : `<span style="color:var(--text-3)">Not live</span>`;
    const videoHtml = data.latest_video
      ? `<div style="margin-top:6px">
          <b>Latest video:</b> <a href="${esc(data.latest_video.url)}" target="_blank" style="color:var(--accent)">${esc(data.latest_video.title || data.latest_video.id)}</a><br>
          <span style="color:var(--text-3)">ID: ${esc(data.latest_video.id)} &nbsp;·&nbsp; ${esc(data.latest_video.createTime_iso || "")}</span>
        </div>`
      : `<div style="color:var(--text-3);margin-top:4px">No videos found (total fetched: ${data.total_videos_fetched})</div>`;
    const diagnosticHtml = data.diagnostic
      ? `<div style="color:var(--text-3);margin-top:4px">Diagnostic: ${esc(data.diagnostic)}</div>`
      : "";
    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <b style="color:var(--text-1)">@${esc(data.username)}</b>
        <span style="color:var(--text-3);font-size:11px">checked ${esc(data.checked_at)}</span>
      </div>
      <div>Live status: ${liveHtml}</div>
      <div>Videos fetched: <b>${data.total_videos_fetched}</b></div>
      ${videoHtml}
      ${diagnosticHtml}`;
  } catch (err) {
    const body = await err.json?.().catch(() => ({}));
    content.innerHTML = `<span style="color:var(--red)">${esc(body?.error || "Failed to check status")}</span>`;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "🔍 Check";
    }
  }
}

// Force-send a notification immediately (bypasses scheduler dedup).
async function ttForceNotify(guildId, subId, type) {
  const label =
    type === "live" ? "live notification" : "latest video notification";
  try {
    const data = await api.post(
      `/guilds/${guildId}/tiktok/${subId}/force-notify`,
      { type },
    );
    if (type === "video" && data.video) {
      showToast(`📲 Sent: ${data.video.title || data.video.id}`, "success");
    } else {
      showToast(`✅ ${label} sent`, "success");
    }
  } catch (err) {
    const body = await err.json?.().catch(() => ({}));
    showToast(body?.error || `Failed to send ${label}`, "error");
  }
}
