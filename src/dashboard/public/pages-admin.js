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

            <div class="form-group" style="margin-top:16px;">
              <label style="display:inline-flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="presence-rotation-toggle" ${!metaData.rotation_paused ? "checked" : ""}>
                <span>Enable Activity Auto-Rotation</span>
              </label>
            </div>

            <!-- Single Activity Form -->
            <div id="presence-single-form" style="${metaData.rotation_paused ? "display:block" : "display:none"}">
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
            </div>

            <!-- Rotation Editor Form -->
            <div id="presence-rotation-form" style="${!metaData.rotation_paused ? "display:block" : "display:none"}">
              <div class="helper-card" style="margin:10px 0; padding:10px; background:var(--bg-mid); border:1px solid var(--border); border-radius:var(--radius-sm); font-size:12px;">
                <div style="font-weight:600; margin-bottom:4px; color:var(--text-1)">💡 Placeholder Tokens</div>
                <div style="color:var(--text-3); margin-bottom:4px">You can use these placeholders to display live statistics:</div>
                <ul style="padding-left:16px; margin:0; color:var(--text-2); line-height:1.4">
                  <li><code>{guilds}</code> - Total server count (e.g., 12 servers)</li>
                  <li><code>{users}</code> - Total member count across all servers</li>
                  <li><code>{prefix}</code> - Command prefix (e.g., kplay)</li>
                </ul>
              </div>
              <div id="presence-activities-list" style="margin-bottom:12px;"></div>
              <button class="btn btn--ghost btn--sm" id="presence-add-row-btn" style="margin-bottom:12px;">+ Add Activity</button>
            </div>

            <div style="display:flex;gap:8px;margin-top:16px;">
              <button class="btn btn--primary" id="presence-save-btn">Save Presence Settings</button>
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

          <!-- Card: Deploy Slash Commands -->
          <div x-data="deployPanel()" class="card mt-16" style="margin-top:16px;">
            <div class="card-header" style="font-weight:600; font-size:14px; margin-bottom:12px;">Slash Commands Deploy</div>
            <p style="font-size:12px; color:var(--text-3); margin-bottom:12px;">
              Deploy slash commands to Discord. Use Guild scope for instant
              updates during development, Global scope for production.
            </p>

            <div class="form-row" style="display:flex; gap:16px; margin-bottom:12px;">
              <div class="form-group" style="flex:1;">
                <label>Scope</label>
                <select x-model="scope" class="select">
                  <option value="global">Global (all servers, ~1h delay)</option>
                  <option value="guild">Guild (instant, dev only)</option>
                </select>
              </div>
              <div class="form-group" x-show="scope === 'guild'" style="flex:1;">
                <label>Guild ID</label>
                <input x-model="guildId" class="input" placeholder="Server ID">
              </div>
            </div>

            <label class="checkbox-row" style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
              <input type="checkbox" x-model="clearFirst">
              <span style="font-size:12px; color:var(--text-2);">Clear existing commands first</span>
            </label>

            <div x-show="clearFirst" class="warning-banner" style="margin-top:8px; background:rgba(240,178,50,0.1); color:var(--yellow); border-radius:var(--radius); padding:8px 12px; font-size:12px;">
              ⚠️ Clear will temporarily remove all slash commands until re-deploy completes.
            </div>

            <button class="btn btn--primary mt-12" @click="deploy()" style="margin-top:12px;"
                    :disabled="loading || (scope === 'guild' && !guildId)">
              <span x-show="!loading">🚀 Deploy Commands</span>
              <span x-show="loading">Deploying to Discord...</span>
            </button>

            <div x-show="result" class="result-banner mt-12" style="margin-top:12px;"
                 :class="result?.error ? 'result-banner--error' : 'result-banner--success'">
              <span x-show="!result?.error"
                    x-text="\`✅ \${result?.deployed} commands deployed to \${result?.scope}\`'">
              </span>
              <span x-show="result?.error" x-text="'❌ ' + result?.error"></span>
            </div>
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

    const rotationListEl = document.getElementById("presence-activities-list");
    const addRowBtn = document.getElementById("presence-add-row-btn");
    const rotationToggle = document.getElementById("presence-rotation-toggle");
    const singleForm = document.getElementById("presence-single-form");
    const rotationForm = document.getElementById("presence-rotation-form");

    rotationToggle.onchange = () => {
      const isRot = rotationToggle.checked;
      singleForm.style.display = isRot ? "none" : "block";
      rotationForm.style.display = isRot ? "block" : "none";
    };

    function createActivityRowHtml(text = "", type = "playing") {
      const rowId = "act-row-" + Math.random().toString(36).substring(2, 9);
      return `
        <div class="form-row activity-row" id="${rowId}" style="display:flex; gap:8px; margin-bottom:8px; align-items:center;">
          <select class="select activity-row-type" style="flex:1;">
            <option value="playing" ${type === "playing" ? "selected" : ""}>Playing</option>
            <option value="listening" ${type === "listening" ? "selected" : ""}>Listening</option>
            <option value="watching" ${type === "watching" ? "selected" : ""}>Watching</option>
            <option value="competing" ${type === "competing" ? "selected" : ""}>Competing</option>
          </select>
          <input class="input activity-row-text" style="flex:3;" value="${escAttr(text)}" placeholder="e.g. {guilds} servers">
          <button class="btn btn--danger btn--sm" onclick="document.getElementById('${rowId}').remove()" style="flex-shrink:0; padding:6px 10px;">✕</button>
        </div>
      `;
    }

    const initialActs =
      metaData.custom_activities && metaData.custom_activities.length > 0
        ? metaData.custom_activities
        : [
            { text: "kplay <songs>", type: "listening" },
            { text: "{guilds} servers", type: "watching" },
            { text: "{users} users", type: "watching" },
            { text: "/help for commands", type: "playing" },
          ];

    rotationListEl.innerHTML = initialActs
      .map((act) => createActivityRowHtml(act.text, act.type))
      .join("");

    addRowBtn.onclick = () => {
      const div = document.createElement("div");
      div.innerHTML = createActivityRowHtml();
      rotationListEl.appendChild(div.firstElementChild);
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
        const isRot = rotationToggle.checked;
        const payload = {
          status: selectedStatus,
          pause_rotation: !isRot,
        };

        if (!isRot) {
          payload.activity_type = document.getElementById(
            "presence-activity-type",
          ).value;
          payload.activity_text = document
            .getElementById("presence-activity-text")
            .value.trim();
        } else {
          const rows = document.querySelectorAll(".activity-row");
          const custom_activities = [];
          rows.forEach((row) => {
            const type = row.querySelector(".activity-row-type").value;
            const text = row.querySelector(".activity-row-text").value.trim();
            if (text) {
              custom_activities.push({ type, text });
            }
          });
          payload.custom_activities = custom_activities;
        }

        await api.patch("/bot/presence", payload);
        showToast("Presence configuration saved", "success");
        document.getElementById("presence-rotation-badge").innerHTML = isRot
          ? '<span class="badge badge--green">⟳ Auto-rotating</span>'
          : '<span class="badge badge--yellow">✋ Manually set</span>';
      } catch (err) {
        showToast("Failed to update presence", "error");
      }
    };

    if (window.Alpine) {
      window.Alpine.initTree(content);
    }

    state.pageCleanup = () => {
      delete window.revealField;
      delete window.toggleConfigEdit;
      delete window.saveConfigField;
      delete window.deployPanel;
    };
  } catch (err) {
    content.innerHTML =
      '<div class="card" style="color:var(--red)">Failed to load configuration settings.</div>';
  }
}

window.deployPanel = function () {
  return {
    scope: "global",
    guildId: "",
    clearFirst: false,
    loading: false,
    result: null,
    async deploy() {
      this.loading = true;
      this.result = null;
      try {
        const res = await api.post("/deploy/slash", {
          scope: this.scope,
          guild_id: this.guildId,
          clear: this.clearFirst,
        });
        this.result = res;
        showToast("Deployment finished successfully", "success");
      } catch (e) {
        const body = await e.json?.().catch(() => ({}));
        this.result = { error: body?.error || "Failed to deploy commands." };
        showToast("Deployment failed", "error");
      } finally {
        this.loading = false;
      }
    },
  };
};

// ── Global Tab: Send Message ──
async function renderSendMsg() {
  const content = document.getElementById("content");
  content.innerHTML = '<div class="skeleton" style="height:300px"></div>';

  try {
    const guilds = state.guilds || (await api.get("/guilds"));

    content.innerHTML = `
      <div x-data="sendMsgComposer(${JSON.stringify(guilds)})" class="sendmsg-layout">
        <!-- Left: Compose Panel -->
        <div class="card compose-panel" style="display:flex; flex-direction:column; gap:16px;">
          <h3 style="font-size:14px; font-weight:600; margin-bottom:4px;">Compose Broadcast</h3>

          <!-- Server select -->
          <div class="form-group">
            <label>Server</label>
            <select x-model="selectedGuildId" @change="onGuildChange()" class="select">
              <option value="">Select a server...</option>
              <template x-for="guild in guilds" :key="guild.id">
                <option :value="guild.id" x-text="guild.name"></option>
              </template>
            </select>
          </div>

          <!-- Channel select -->
          <div class="form-group" x-show="selectedGuildId">
            <label>Channel</label>
            <select x-model="selectedChannelId" @change="updatePreview()" class="select">
              <option value="">Select a channel...</option>
              <template x-for="ch in channels" :key="ch.id">
                <option :value="ch.id" x-text="'#' + ch.name"></option>
              </template>
            </select>
          </div>

          <!-- Send as Embed toggle -->
          <div class="form-group" style="display:flex; justify-content:space-between; align-items:center;">
            <label>Send as Embed</label>
            <label class="toggle">
              <input type="checkbox" x-model="asEmbed" @change="updatePreview()">
              <span class="slider"></span>
            </label>
          </div>

          <!-- Embed title (only when asEmbed) -->
          <div class="form-group" x-show="asEmbed">
            <label>Embed Title</label>
            <input x-model="embedTitle" @input="updatePreview()"
                   class="input" placeholder="Optional title">
          </div>

          <!-- Message textarea with @ mention toolbar -->
          <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <label>Message</label>
              <button class="btn btn--ghost btn--sm" style="padding: 2px 8px;"
                      @click="showMentionSearch = !showMentionSearch; if(showMentionSearch) $nextTick(() => $refs.mentionInput.focus())"
                      :class="{'btn--primary': showMentionSearch}">
                @ Mention
              </button>
            </div>

            <!-- Member search panel -->
            <div x-show="showMentionSearch" class="mention-search-panel" style="margin-bottom:8px;">
              <input type="text" x-ref="mentionInput"
                     x-model.debounce.300ms="mentionQuery"
                     @input="searchMembers()"
                     placeholder="Search member by name..."
                     class="input input--sm">
              <div class="mention-results" style="margin-top:6px; max-height:150px; overflow-y:auto;" x-show="mentionResults.length">
                <template x-for="member in mentionResults" :key="member.id">
                  <div class="mention-result-row" @click="insertMention(member)" style="padding:4px; display:flex; align-items:center; gap:8px; cursor:pointer;">
                    <div class="mention-avatar" style="width:24px; height:24px; border-radius:50%; overflow:hidden;">
                      <img :src="member.avatar_url" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'">
                    </div>
                    <div class="mention-name" style="flex:1;">
                      <strong x-text="member.display_name" style="font-size:12px;"></strong>
                      <span class="text-3" x-text="'@' + member.username" style="font-size:11px; margin-left:4px;"></span>
                    </div>
                    <span class="mention-tag text-accent" style="font-size:10px;">@mention</span>
                  </div>
                </template>
              </div>
              <div x-show="mentionResults.length === 0 && mentionQuery.length > 1"
                   class="mention-no-results text-3" style="font-size:11px; padding:4px;">No members found</div>
            </div>

            <textarea x-model="message" @input="updatePreview()"
                      id="compose-textarea"
                      class="textarea" rows="6" maxlength="2000"
                      placeholder="Type your message... Use @ Mention to tag users."
                      style="width:100%; min-height:100px; resize:vertical; font-family:inherit;"></textarea>
            <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-3); margin-top:4px;">
              <span :class="message.length > 1900 ? 'text-danger' : 'text-3'"
                    x-text="message.length + ' / 2000 characters'"></span>
              <span x-show="message.length > 2000" style="color:var(--red);">⚠️ Exceeds limit</span>
            </div>
          </div>

          <!-- Image URL -->
          <div class="form-group">
            <label>Image / GIF URL <span class="text-3">(optional)</span></label>
            <input x-model="imageUrl" @input="updatePreview()"
                   class="input" placeholder="https://...">
            <img x-show="imageUrl" :src="imageUrl"
                 onerror="this.style.display='none'"
                 style="max-height:80px; margin-top:6px; border-radius:4px; object-fit:contain;">
          </div>

          <!-- Send button -->
          <button class="btn btn--primary w-full"
                  @click="sendMessage()"
                  :disabled="!canSend || sending">
            <span x-show="!sending">📨 Send Message</span>
            <span x-show="sending">Sending...</span>
          </button>
        </div>

        <!-- Right: Live Preview -->
        <div class="card preview-panel">
          <div class="preview-header" style="font-weight:600; font-size:14px; margin-bottom:12px;">Real-time Discord Preview</div>
          <div id="discord-preview-mount">
            <!-- renderDiscordPreview() will render here -->
          </div>
        </div>
      </div>
    `;

    if (window.Alpine) {
      window.Alpine.initTree(content);
    }

    state.pageCleanup = () => {
      delete window.sendMsgComposer;
    };
  } catch (err) {
    content.innerHTML =
      '<div class="card" style="color:var(--red)">Failed to load composition settings.</div>';
  }
}

window.sendMsgComposer = function (guilds) {
  return {
    guilds,
    channels: [],
    selectedGuildId: "",
    selectedChannelId: "",
    asEmbed: false,
    embedTitle: "",
    message: "",
    imageUrl: "",
    sending: false,
    showMentionSearch: false,
    mentionQuery: "",
    mentionResults: [],
    memberCache: new Map(),
    init() {
      this.$nextTick(() => this.updatePreview());
    },
    get canSend() {
      return (
        (this.message.trim() || this.imageUrl.trim()) &&
        this.selectedGuildId &&
        this.selectedChannelId
      );
    },
    async onGuildChange() {
      if (!this.selectedGuildId) {
        this.channels = [];
        this.selectedChannelId = "";
        this.updatePreview();
        return;
      }
      try {
        const data = await api.get(`/sendmsg/channels/${this.selectedGuildId}`);
        this.channels = data;
        this.selectedChannelId = "";
        this.updatePreview();
      } catch (err) {
        showToast("Failed to load channels", "error");
      }
    },
    searchMembers() {
      if (this.mentionQuery.length < 2 || !this.selectedGuildId) {
        this.mentionResults = [];
        return;
      }
      api
        .get(
          `/sendmsg/members/${this.selectedGuildId}?q=${encodeURIComponent(this.mentionQuery)}`,
        )
        .then((data) => {
          this.mentionResults = data;
          data.forEach((m) => this.memberCache.set(m.id, m.display_name));
        });
    },
    insertMention(member) {
      const ta = document.getElementById("compose-textarea");
      if (!ta) return;
      const pos = ta.selectionStart;
      const before = this.message.slice(0, pos);
      const after = this.message.slice(pos);
      this.message = before + `<@${member.id}>` + after;
      this.showMentionSearch = false;
      this.mentionQuery = "";
      this.mentionResults = [];
      this.updatePreview();
      this.$nextTick(() => {
        ta.focus();
        const newPos = pos + `<@${member.id}>`.length;
        ta.setSelectionRange(newPos, newPos);
      });
    },
    updatePreview() {
      const mount = document.getElementById("discord-preview-mount");
      if (!mount) return;

      const embedData = this.asEmbed
        ? {
            title: this.embedTitle || null,
            description: this.message || "(empty embed description)",
            imageUrl: this.imageUrl || null,
            color: state.meta?.bot_color || "var(--accent)",
            footer: "Sent from Web Dashboard",
          }
        : null;

      renderDiscordPreview(mount, {
        botName: state.meta?.bot_name || "Kizoxy",
        botAvatarUrl: state.meta?.bot_avatar_url || "",
        content: this.asEmbed ? "" : this.message || "(empty message content)",
        imageUrl: this.asEmbed ? "" : this.imageUrl,
        embed: embedData,
        memberCache: this.memberCache,
      });
    },
    async sendMessage() {
      if (!this.canSend) return;
      this.sending = true;
      try {
        await api.post("/sendmsg", {
          guild_id: this.selectedGuildId,
          channel_id: this.selectedChannelId,
          message: this.message,
          image_url: this.imageUrl || null,
          embed: this.asEmbed,
        });
        showToast("Message sent successfully!", "success");
        this.message = "";
        this.imageUrl = "";
        this.updatePreview();
      } catch (err) {
        const body = await err.json?.().catch(() => ({}));
        showToast(body?.error || "Failed to send message", "error");
      } finally {
        this.sending = false;
      }
    },
  };
};

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
