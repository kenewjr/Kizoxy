/* ═══════════════════════════════════════════════════════════════════
   Kizoxy Dashboard — pages-admin.js (Config, Send Msg & Updates)
   ═══════════════════════════════════════════════════════════════════ */

function renderEditableRow(key, val, label, type = "text", options = []) {
  return `
    <tr id="config-row-${key}">
      <td style="font-family:var(--font-mono);font-size:12px;width:30%">${esc(label)}</td>
      <td>
        <div class="config-view-mode" style="display:flex;justify-content:space-between;align-items:center;">
          <span class="config-val-display">${esc(val)}</span>
          <button class="btn btn--ghost btn--sm edit-btn" onclick="toggleConfigEdit('${key}', true)">✏️ Edit</button>
        </div>
        <div class="config-edit-mode" style="display:none;">
          <div style="display:flex;gap:8px;align-items:center;">
            ${
              type === "select"
                ? `<select class="select edit-input" style="width:120px;">
                     ${options.map((opt) => `<option value="${opt}" ${opt === val ? "selected" : ""}>${opt}</option>`).join("")}
                   </select>`
                : type === "color"
                  ? `<div style="display:flex;gap:8px;align-items:center;">
                     <input type="color" class="color-picker" value="${val}" oninput="document.getElementById('edit-input-${key}').value = this.value" style="width:36px;height:36px;border:1px solid var(--border);border-radius:4px;background:none;cursor:pointer;padding:0;">
                     <input class="input edit-input" id="edit-input-${key}" value="${escAttr(val)}" style="width:100px;" oninput="this.previousElementSibling.value = this.value">
                   </div>`
                  : `<input class="input edit-input" value="${escAttr(val)}" style="width:120px;">`
            }
            <button class="btn btn--confirm btn--sm" onclick="saveConfigField('${key}')">💾 Save</button>
            <button class="btn btn--ghost btn--sm" onclick="toggleConfigEdit('${key}', false)">✕ Cancel</button>
          </div>
          <div class="info-note" style="margin-top:4px;font-size:11px;">This change takes effect immediately and persists across restarts.</div>
        </div>
      </td>
    </tr>
  `;
}

function renderReadonlyRow(label, val) {
  if (val === null || val === undefined || val === "") val = "Not Set";
  return `
    <tr>
      <td style="font-family:var(--font-mono);font-size:12px;width:30%">${esc(label)}</td>
      <td>
        <div style="display:flex;gap:12px;align-items:center;">
          <span class="readonly-value">••••••••</span>
          <button class="btn btn--ghost btn--sm" onclick="revealField(this, '${escAttr(String(val))}')">👁 Reveal</button>
        </div>
      </td>
    </tr>
  `;
}

async function renderConfig() {
  const content = document.getElementById("content");
  content.innerHTML = '<div class="skeleton" style="height:300px"></div>';

  window.revealField = function (btn, value) {
    const row = btn.parentElement;
    const display = row.querySelector(".readonly-value");
    if (display.textContent === "••••••••") {
      const masked =
        value.length > 8 ? value.slice(0, 4) + "..." + value.slice(-4) : value;
      display.textContent = masked;
      btn.textContent = "🙈 Hide";
    } else {
      display.textContent = "••••••••";
      btn.textContent = "👁 Reveal";
    }
  };

  window.toggleConfigEdit = function (key, editing) {
    const row = document.getElementById(`config-row-${key}`);
    row.querySelector(".config-view-mode").style.display = editing
      ? "none"
      : "flex";
    row.querySelector(".config-edit-mode").style.display = editing
      ? "block"
      : "none";
    if (!editing) {
      const displayVal = row.querySelector(".config-val-display").textContent;
      const input = row.querySelector(".edit-input");
      input.value = displayVal;
      const picker = row.querySelector(".color-picker");
      if (picker) picker.value = displayVal;
    }
  };

  window.saveConfigField = async function (key) {
    try {
      const row = document.getElementById(`config-row-${key}`);
      const input = row.querySelector(".edit-input");
      const newVal = input.value.trim();
      const body = { [key]: newVal };
      const updated = await api.patch("/config", body);

      state.meta.bot_color = updated.bot.bot_color;
      state.meta.prefix = updated.bot.prefix;
      state.meta.log_format = updated.bot.log_format;

      if (key === "bot_color") {
        document.documentElement.style.setProperty(
          "--accent",
          updated.bot.bot_color,
        );
        const hex = updated.bot.bot_color.replace("#", "");
        if (hex.length === 6) {
          const r = parseInt(hex.substr(0, 2), 16);
          const g = parseInt(hex.substr(2, 2), 16);
          const b = parseInt(hex.substr(4, 2), 16);
          document.documentElement.style.setProperty(
            "--accent-rgb",
            `${r},${g},${b}`,
          );
        }
      }

      showToast("Config updated", "success");
      renderConfig();
    } catch (err) {
      const errBody = await err.json?.().catch(() => ({}));
      showToast(errBody?.error || "Failed to update config", "error");
    }
  };

  try {
    const [configData, metaData] = await Promise.all([
      api.get("/config"),
      api.get("/meta"),
    ]);

    const typeNum = metaData.presence_activity_type;
    let activityTypeMapped = "playing";
    if (typeNum === 2) activityTypeMapped = "listening";
    else if (typeNum === 3) activityTypeMapped = "watching";
    else if (typeNum === 5) activityTypeMapped = "competing";

    const badgeHtml = metaData.rotation_paused
      ? '<span class="badge badge--yellow">✋ Manually set</span>'
      : '<span class="badge badge--green">⟳ Auto-rotating</span>';

    content.innerHTML = `
      <div class="config-layout" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(360px, 1fr));gap:20px;max-width:1200px;margin:0 auto;">
        
        <!-- Left Column: Bot Identity & Presence -->
        <div style="display:flex;flex-direction:column;gap:20px;">
          <!-- Card: Bot Identity -->
          <div class="card">
            <h3 style="font-size:14px;font-weight:600;margin-bottom:12px;">Bot Identity</h3>
            <div class="form-group" style="margin-bottom:0;">
              <label>Bot Username</label>
              <div style="display:flex;gap:8px;">
                <input class="input" id="bot-username-input" value="${escAttr(metaData.bot_name)}">
                <button class="btn btn--primary" id="bot-username-save">Save Username</button>
              </div>
              <div class="info-note">⚠️ Discord limits username changes to 2/hour.</div>
            </div>
          </div>

          <!-- Card: Bot Presence -->
          <div class="card">
            <h3 style="font-size:14px;font-weight:600;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
              <span>Bot Presence</span>
              <span id="presence-rotation-badge">${badgeHtml}</span>
            </h3>
            
            <div class="form-group">
              <label>Status</label>
              <div style="display:flex;gap:8px;" id="presence-status-group">
                <button class="btn btn--sm ${metaData.presence_status === "online" ? "btn--primary" : "btn--ghost"}" data-status="online">🟢 Online</button>
                <button class="btn btn--sm ${metaData.presence_status === "idle" ? "btn--primary" : "btn--ghost"}" data-status="idle">🟡 Idle</button>
                <button class="btn btn--sm ${metaData.presence_status === "dnd" ? "btn--primary" : "btn--ghost"}" data-status="dnd">🔴 DND</button>
                <button class="btn btn--sm ${metaData.presence_status === "invisible" ? "btn--primary" : "btn--ghost"}" data-status="invisible">⚫ Invisible</button>
              </div>
            </div>

            <div class="form-group">
              <label>Activity Type</label>
              <select class="select" id="presence-activity-type">
                <option value="playing" ${activityTypeMapped === "playing" ? "selected" : ""}>Playing</option>
                <option value="listening" ${activityTypeMapped === "listening" ? "selected" : ""}>Listening to</option>
                <option value="watching" ${activityTypeMapped === "watching" ? "selected" : ""}>Watching</option>
                <option value="competing" ${activityTypeMapped === "competing" ? "selected" : ""}>Competing in</option>
              </select>
            </div>

            <div class="form-group">
              <label>Activity Text</label>
              <input class="input" id="presence-activity-text" value="${escAttr(metaData.presence_activity || "")}" placeholder="Kizoxy Bot · /help">
            </div>

            <div style="display:flex;gap:8px;">
              <button class="btn btn--primary" id="presence-save-btn">Set Presence</button>
              <button class="btn btn--secondary" id="presence-resume-btn" style="${metaData.rotation_paused ? "display:inline-flex" : "display:none"}">Resume Rotation</button>
            </div>
          </div>
        </div>

        <!-- Right Column: Settings -->
        <div style="display:flex;flex-direction:column;gap:20px;">
          <!-- Card: Runtime Editable Settings -->
          <div class="card" style="padding:0; overflow:hidden">
            <div style="padding:10px 16px; background:var(--bg-mid); font-weight:600; font-size:12px; border-bottom:1px solid var(--border); color:var(--text-2); text-transform:uppercase; letter-spacing:0.5px">Runtime Configuration</div>
            <table class="table" style="margin:0">
              <tbody>
                ${renderEditableRow("prefix", configData.bot.prefix, "Command Prefix")}
                ${renderEditableRow("bot_color", configData.bot.bot_color, "Bot Brand Color", "color")}
                ${renderEditableRow("log_format", configData.bot.log_format, "Log Output Format", "select", ["pretty", "json"])}
              </tbody>
            </table>
          </div>

          <!-- Card: Read-only Settings -->
          <div class="card" style="padding:0; overflow:hidden">
            <div style="padding:10px 16px; background:var(--bg-mid); font-weight:600; font-size:12px; border-bottom:1px solid var(--border); color:var(--text-2); text-transform:uppercase; letter-spacing:0.5px">Read-only System Info</div>
            <table class="table" style="margin:0">
              <tbody>
                ${renderReadonlyRow("Client ID", configData.bot.client_id)}
                ${renderReadonlyRow("Owner ID", configData.bot.owner_id)}
                ${renderReadonlyRow("Developer Guild ID", configData.bot.guild_id)}
                ${renderReadonlyRow("Lavalink Host", configData.lavalink.host)}
                ${renderReadonlyRow("Lavalink Port", configData.lavalink.port)}
                ${renderReadonlyRow("Dashboard Port", configData.dashboard.port)}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    document.getElementById("bot-username-save").onclick = async () => {
      try {
        const username = document.getElementById("bot-username-input").value;
        const res = await api.patch("/bot/username", { username });
        showToast("Bot username updated", "success");
        const nameEl = document.querySelector("#bot-info .bot-name");
        if (nameEl) nameEl.textContent = res.username;
      } catch (err) {
        const errBody = await err.json?.().catch(() => ({}));
        showToast(errBody?.error || "Failed to update username", "error");
      }
    };

    let selectedStatus = metaData.presence_status || "online";
    const statusBtns = document.querySelectorAll(
      "#presence-status-group button",
    );
    statusBtns.forEach((btn) => {
      btn.onclick = () => {
        statusBtns.forEach((b) => (b.className = "btn btn--sm btn--ghost"));
        btn.className = "btn btn--sm btn--primary";
        selectedStatus = btn.dataset.status;
      };
    });

    document.getElementById("presence-save-btn").onclick = async () => {
      try {
        const activity_type = document.getElementById(
          "presence-activity-type",
        ).value;
        const activity_text = document
          .getElementById("presence-activity-text")
          .value.trim();
        await api.patch("/bot/presence", {
          status: selectedStatus,
          activity_type,
          activity_text: activity_text || null,
        });
        showToast("Presence updated", "success");
        document.getElementById("presence-resume-btn").style.display =
          "inline-flex";
        document.getElementById("presence-rotation-badge").innerHTML =
          '<span class="badge badge--yellow">✋ Manually set</span>';
      } catch (err) {
        showToast("Failed to update presence", "error");
      }
    };

    document.getElementById("presence-resume-btn").onclick = async () => {
      try {
        await api.patch("/bot/presence/resume");
        showToast("Rotating presence resumed", "success");
        document.getElementById("presence-resume-btn").style.display = "none";
        document.getElementById("presence-rotation-badge").innerHTML =
          '<span class="badge badge--green">⟳ Auto-rotating</span>';
      } catch (err) {
        showToast("Failed to resume presence", "error");
      }
    };

    state.pageCleanup = () => {
      delete window.revealField;
      delete window.toggleConfigEdit;
      delete window.saveConfigField;
    };
  } catch (err) {
    content.innerHTML =
      '<div class="card" style="color:var(--red)">Failed to load configuration settings.</div>';
  }
}

// ── Global Tab: Send Message ──
async function renderSendMsg() {
  const content = document.getElementById("content");
  content.innerHTML = '<div class="skeleton" style="height:300px"></div>';

  window.loadSendMsgChannels = async function (guildId) {
    const sel = document.getElementById("sendmsg-channel-select");
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Loading Channels... --</option>';
    sel.disabled = true;
    if (!guildId) {
      sel.innerHTML = '<option value="">-- Select Channel --</option>';
      return;
    }
    try {
      const channels = await api.get(`/sendmsg/channels/${guildId}`);
      sel.innerHTML =
        '<option value="">-- Select Channel --</option>' +
        channels
          .map((c) => `<option value="${c.id}"># ${esc(c.name)}</option>`)
          .join("");
      sel.disabled = false;
    } catch (err) {
      sel.innerHTML = '<option value="">-- Failed to load channels --</option>';
      showToast("Failed to load channels", "error");
    }
  };

  window.updateSendMsgPreview = function () {
    const isEmbed = document.getElementById("sendmsg-embed-toggle").checked;
    const msg = document.getElementById("sendmsg-message-input").value;
    const image = document.getElementById("sendmsg-image-input").value.trim();

    const charLen = msg.length;
    document.getElementById("sendmsg-char-counter").textContent =
      `${charLen} / 2000 characters`;
    const warning = document.getElementById("sendmsg-char-warning");
    const sendBtn = document.getElementById("sendmsg-submit-btn");

    if (charLen > 2000) {
      warning.style.display = "inline";
      sendBtn.disabled = true;
    } else {
      warning.style.display = "none";
      sendBtn.disabled = false;
    }

    if (state.meta) {
      document.getElementById("sendmsg-preview-avatar").src =
        state.meta.bot_avatar_url || "";
      document.getElementById("sendmsg-preview-botname").textContent =
        state.meta.bot_name;
    }

    const imgBox = document.getElementById("sendmsg-image-preview-box");
    const imgEl = document.getElementById("sendmsg-image-preview-el");
    const imgErr = document.getElementById("sendmsg-image-preview-error");

    if (image) {
      imgBox.style.display = "block";
      imgEl.src = image;
      imgEl.style.display = "block";
      imgErr.style.display = "none";
      imgEl.onerror = () => {
        imgEl.style.display = "none";
        imgErr.style.display = "block";
        document.getElementById("sendmsg-preview-embed-image").style.display =
          "none";
        document.getElementById("sendmsg-preview-plain-image").style.display =
          "none";
      };
    } else {
      imgBox.style.display = "none";
      imgEl.src = "";
    }

    const txtContent = document.getElementById("sendmsg-preview-text-content");
    const embedBox = document.getElementById("sendmsg-preview-embed");
    const embedDesc = document.getElementById("sendmsg-preview-embed-desc");
    const embedImg = document.getElementById("sendmsg-preview-embed-image");
    const plainImg = document.getElementById("sendmsg-preview-plain-image");

    if (isEmbed) {
      txtContent.style.display = "none";
      embedBox.style.display = "block";
      embedDesc.textContent = msg || "(empty embed description)";
      if (image) {
        embedImg.src = image;
        embedImg.style.display = "block";
      } else {
        embedImg.style.display = "none";
      }
      plainImg.style.display = "none";
    } else {
      txtContent.style.display = "block";
      txtContent.textContent = msg || "(empty message content)";
      embedBox.style.display = "none";
      if (image) {
        plainImg.src = image;
        plainImg.style.display = "block";
      } else {
        plainImg.style.display = "none";
      }
    }
  };

  window.submitSendMsg = async function () {
    const guild_id = document.getElementById("sendmsg-guild-select").value;
    const channel_id = document.getElementById("sendmsg-channel-select").value;
    const message = document.getElementById("sendmsg-message-input").value;
    const image_url =
      document.getElementById("sendmsg-image-input").value.trim() || null;
    const embed = document.getElementById("sendmsg-embed-toggle").checked;

    if (!guild_id || !channel_id) {
      showToast("Please select a server and channel", "error");
      return;
    }

    const btn = document.getElementById("sendmsg-submit-btn");
    btn.disabled = true;
    btn.textContent = "Sending...";

    try {
      await api.post("/sendmsg", {
        guild_id,
        channel_id,
        message,
        image_url,
        embed,
      });
      showToast("Message dispatched successfully!", "success");

      document.getElementById("sendmsg-message-input").value = "";
      document.getElementById("sendmsg-image-input").value = "";
      updateSendMsgPreview();
    } catch (err) {
      const errBody = await err.json?.().catch(() => ({}));
      showToast(errBody?.error || "Failed to send message", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Send Message";
    }
  };

  try {
    const guilds = state.guilds || (await api.get("/guilds"));

    content.innerHTML = `
      <div class="config-layout" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(360px, 1fr));gap:20px;max-width:1200px;margin:0 auto;">
        
        <!-- Left: Form -->
        <div class="card" style="display:flex;flex-direction:column;gap:16px;">
          <h3 style="font-size:14px;font-weight:600;margin-bottom:4px;">Compose Broadcast</h3>
          
          <div class="form-group">
            <label>Target Server</label>
            <select class="select" id="sendmsg-guild-select" onchange="loadSendMsgChannels(this.value)">
              <option value="">-- Select Server --</option>
              ${guilds.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join("")}
            </select>
          </div>

          <div class="form-group">
            <label>Target Channel</label>
            <select class="select" id="sendmsg-channel-select" disabled>
              <option value="">-- Select Channel --</option>
            </select>
          </div>

          <div class="form-group">
            <label style="display:flex;justify-content:space-between;align-items:center;">
              <span>Send as Rich Embed</span>
              <label class="toggle">
                <input type="checkbox" id="sendmsg-embed-toggle" onchange="updateSendMsgPreview()">
                <span class="slider"></span>
              </label>
            </label>
          </div>

          <div class="form-group">
            <label>Message Content</label>
            <textarea class="input" id="sendmsg-message-input" rows="6" maxlength="2048" oninput="updateSendMsgPreview()" placeholder="Type your message here..."></textarea>
            <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-3);margin-top:4px;">
              <span id="sendmsg-char-counter">0 / 2000 characters</span>
              <span id="sendmsg-char-warning" style="color:var(--red);display:none;">⚠️ Exceeds limit</span>
            </div>
          </div>

          <div class="form-group">
            <label>Image URL (optional)</label>
            <input class="input" id="sendmsg-image-input" placeholder="https://example.com/image.png" oninput="updateSendMsgPreview()">
            <div id="sendmsg-image-preview-box" style="margin-top:10px;display:none;max-width:200px;border:1px solid var(--border);border-radius:4px;overflow:hidden;background:var(--bg-mid);">
              <img id="sendmsg-image-preview-el" style="max-width:100%;height:auto;display:block;">
              <div id="sendmsg-image-preview-error" style="color:var(--red);font-size:11px;padding:4px;display:none;">Could not load image</div>
            </div>
          </div>

          <button class="btn btn--primary" id="sendmsg-submit-btn" onclick="submitSendMsg()">Send Message</button>
        </div>

        <!-- Right: Live Preview -->
        <div class="card" style="display:flex;flex-direction:column;gap:12px;">
          <h3 style="font-size:14px;font-weight:600;">Real-time Discord Preview</h3>
          
          <div class="card" style="background:#313338;color:#dbdee1;font-family:sans-serif;padding:16px;border-radius:8px;border:none;">
            <div style="display:flex;gap:16px;">
              <img id="sendmsg-preview-avatar" src="" style="width:40px;height:40px;border-radius:50%;background:#5865F2;" onerror="this.style.display='none'">
              <div style="flex:1;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                  <span id="sendmsg-preview-botname" style="font-weight:600;color:#f2f3f5;">Bot</span>
                  <span style="background:#5865f2;color:#ffffff;font-size:10px;font-weight:600;padding:1px 4px;border-radius:3px;letter-spacing:0.5px;">BOT</span>
                  <span style="font-size:12px;color:#949ba4;">Today at 12:00 PM</span>
                </div>
                
                <div id="sendmsg-preview-text-content" style="white-space:pre-wrap;line-height:1.375;font-size:15px;color:#dbdee1;">(empty message content)</div>
                
                <div id="sendmsg-preview-embed" style="margin-top:8px;border-left:4px solid var(--accent);background:#2b2d31;padding:8px 16px 16px;border-radius:4px;max-width:520px;display:none;">
                  <div id="sendmsg-preview-embed-desc" style="white-space:pre-wrap;font-size:14px;line-height:1.375;color:#dbdee1;"></div>
                  <img id="sendmsg-preview-embed-image" style="margin-top:16px;max-width:100%;border-radius:4px;display:none;max-height:220px;object-fit:contain;">
                  <div style="margin-top:8px;font-size:12px;color:#949ba4;display:flex;align-items:center;gap:4px;">
                    <span>Sent from Web Dashboard</span>
                    <span>•</span>
                    <span>Today at 12:00 PM</span>
                  </div>
                </div>
                
                <img id="sendmsg-preview-plain-image" style="margin-top:8px;max-width:100%;border-radius:4px;display:none;max-height:220px;object-fit:contain;">
              </div>
            </div>
          </div>
        </div>

      </div>
    `;

    updateSendMsgPreview();

    state.pageCleanup = () => {
      delete window.loadSendMsgChannels;
      delete window.updateSendMsgPreview;
      delete window.submitSendMsg;
    };
  } catch (err) {
    content.innerHTML =
      '<div class="card" style="color:var(--red)">Failed to load composition settings.</div>';
  }
}

// ── Global Tab: Updates ──
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
          <td style="font-weight:600;">${esc(p.name)} ${p.is_dev ? '<span style="font-size:10px;background:var(--bg-mid);color:var(--text-3);padding:2px 4px;border-radius:3px;margin-left:4px;">dev</span>' : ""}</td>
          <td style="font-family:var(--font-mono);font-size:12px;">${esc(p.current)}</td>
          <td style="font-family:var(--font-mono);font-size:12px;">${esc(p.latest || "—")}</td>
          <td>${statusHtml}</td>
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
          <div class="stat-card__value" style="font-size:16px;font-family:var(--font-mono);">${esc(updatesData.node_version)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Outdated Packages</div>
          <div class="stat-card__value" style="font-size:16px;color:var(--yellow);">${updatesData.outdated_count}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Last Checked</div>
          <div class="stat-card__value" style="font-size:12px;color:var(--text-2);">${new Date(updatesData.checked_at).toLocaleTimeString()}</div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:12px;">
        <div style="display:flex;gap:8px;" id="updates-filter-group">
          <button class="btn btn--sm ${filterMode === "all" ? "btn--primary" : "btn--ghost"}" data-mode="all" onclick="setUpdatesFilter('all')">All (${updatesData.total_count})</button>
          <button class="btn btn--sm ${filterMode === "outdated" ? "btn--primary" : "btn--ghost"}" data-mode="outdated" onclick="setUpdatesFilter('outdated')">Outdated (${updatesData.outdated_count})</button>
          <button class="btn btn--sm ${filterMode === "dev" ? "btn--primary" : "btn--ghost"}" data-mode="dev" onclick="setUpdatesFilter('dev')">Dev Dependencies</button>
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
            ${pkgs.length ? rowsHtml : `<tr><td colspan="4" style="text-align:center;color:var(--text-3);padding:24px;">No packages match selection.</td></tr>`}
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
