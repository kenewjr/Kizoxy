/* ═══════════════════════════════════════════════════════════════════
   Kizoxy Dashboard — pages-guild-notif.js (YouTube & TikTok Subscriptions)
   ═══════════════════════════════════════════════════════════════════ */

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
