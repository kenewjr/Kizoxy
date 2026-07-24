/* ═══════════════════════════════════════════════════════════════════
   Kizoxy Dashboard — pages-admin.js (Runtime Config & Slash Commands)
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

          <!-- Card: Bot Presence Container -->
          <div id="presence-card-container"></div>
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

    // Render Bot Presence Card inside the container
    renderPresenceCard(document.getElementById("presence-card-container"), metaData);

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
