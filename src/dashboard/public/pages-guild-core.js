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
      "Send Message",
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
    case "Send Message":
      renderGuildSendMsg(container, g);
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
window.fixEmbedSettings = function (guildId, initialData) {
  return {
    guildId,
    settings: { platforms: {}, ...initialData },
    platforms: [
      { key: "twitter", label: "Twitter / X", emoji: "𝕏" },
      { key: "instagram", label: "Instagram", emoji: "📸" },
      { key: "tiktok", label: "TikTok", emoji: "🎵" },
      { key: "reddit", label: "Reddit", emoji: "🤖" },
      { key: "threads", label: "Threads", emoji: "🧵" },
      { key: "bluesky", label: "Bluesky", emoji: "🦋" },
      { key: "facebook", label: "Facebook", emoji: "👥" },
      { key: "tumblr", label: "Tumblr", emoji: "📯" },
      { key: "mastodon", label: "Mastodon", emoji: "🦣" },
      { key: "youtube", label: "YouTube", emoji: "📺" },
      { key: "twitch", label: "Twitch", emoji: "🎮" },
      { key: "bilibili", label: "BiliBili", emoji: "⚡" },
      { key: "spotify", label: "Spotify", emoji: "🟢" },
      { key: "snapchat", label: "Snapchat", emoji: "💛" },
      { key: "pinterest", label: "Pinterest", emoji: "📌" },
      { key: "ifunny", label: "iFunny", emoji: "😂" },
      { key: "imgur", label: "Imgur", emoji: "🖼️" },
      { key: "weibo", label: "Weibo", emoji: "🇨🇳" },
      { key: "booru", label: "Booru", emoji: "🌸" },
      { key: "danbooru", label: "Danbooru", emoji: "🎎" },
      { key: "e621", label: "e621", emoji: "🦄" },
      { key: "moebooru", label: "Moebooru", emoji: "🎐" },
      { key: "derpibooru", label: "Derpibooru", emoji: "🐎" },
      { key: "rule34", label: "Rule34", emoji: "🔞" },
    ],
    saving: false,
    saved: false,
    togglePlatform(key, value) {
      this.settings.platforms = { ...this.settings.platforms, [key]: value };
      this.save();
    },
    async save() {
      this.saving = true;
      this.saved = false;
      try {
        const result = await api.patch(
          `/guilds/${this.guildId}/fixembed`,
          this.settings,
        );
        this.settings = { platforms: {}, ...result };
        state.currentGuild.fixembed = result;
        this.saved = true;
        setTimeout(() => (this.saved = false), 2000);
      } catch (e) {
        showToast("Failed to save FixEmbed settings", "error");
      } finally {
        this.saving = false;
      }
    },
  };
};

function renderFixEmbed(el, g) {
  const fe = g.fixembed || {};
  el.innerHTML = `
    <div x-data="fixEmbedSettings('${g.id}', ${JSON.stringify(fe)})" class="card fixembed-panel">
      <!-- Master toggle -->
      <div class="form-group" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:600; font-size:14px;">FixEmbed</div>
          <div style="font-size:12px; color:var(--text-3);">Auto-fix social media embed previews</div>
        </div>
        <label class="toggle">
          <input type="checkbox" x-model="settings.enabled" @change="save()">
          <span class="slider"></span>
        </label>
      </div>

      <!-- View Mode (only shown when enabled) -->
      <div x-show="settings.enabled" class="form-group" style="margin-top:16px;">
        <label>View Mode</label>
        <select x-model="settings.viewMode" @change="save()" class="select" style="width:200px">
          <option value="normal">Normal</option>
          <option value="direct">Direct</option>
          <option value="gallery">Gallery</option>
          <option value="text">Text-only</option>
        </select>
      </div>

      <!-- Per-platform toggles (only when enabled) -->
      <div x-show="settings.enabled" style="margin-top:20px;">
        <label style="font-weight:600; font-size:14px; display:block; margin-bottom:8px;">Platform Controls</label>
        <div class="platforms-grid">
          <template x-for="platform in platforms" :key="platform.key">
            <div class="platform-row">
              <div class="platform-info" style="display:flex; align-items:center; gap:8px;">
                <span x-text="platform.emoji" class="platform-emoji"></span>
                <span x-text="platform.label" class="platform-label"></span>
              </div>
              <label class="toggle">
                <input type="checkbox"
                       :checked="settings.platforms[platform.key] !== false"
                       @change="togglePlatform(platform.key, $event.target.checked)">
                <span class="slider"></span>
              </label>
            </div>
          </template>
        </div>
      </div>

      <!-- Save state indicator -->
      <div style="margin-top:16px; font-size:12px; display:flex; align-items:center; gap:8px;">
        <div x-show="saving" class="save-indicator" style="color:var(--text-3)">Saving...</div>
        <div x-show="saved" class="save-indicator save-indicator--success" style="color:var(--green)">✓ Saved</div>
      </div>
    </div>`;

  if (window.Alpine) {
    window.Alpine.initTree(el);
  }
}

// ── Guild Tab: Send Message ──
function renderGuildSendMsg(el, g) {
  const formattedChannels = g.channels.map((ch) => ({
    id: ch.id,
    name: ch.parentName ? `${ch.name} [Category: ${ch.parentName}]` : ch.name,
    mentionEveryoneAllowed: ch.mentionEveryoneAllowed,
  }));

  el.innerHTML = `
    <div x-data="guildSendMsgComposer('${g.id}', ${JSON.stringify(formattedChannels)}, ${JSON.stringify(g.roles)})" class="sendmsg-layout" @change="onChannelChange($event)" style="display:grid; grid-template-columns:1fr 1fr; gap:20px; max-width:1200px; margin:0 auto;">
      <!-- Left: Composer -->
      <div class="card compose-panel" style="display:flex; flex-direction:column; gap:16px;">
        <h3 style="font-size:14px; font-weight:600; margin-bottom:4px;">Send Message</h3>
        
        <!-- Channel Select -->
        <div class="form-group">
          <label>Destination Channel</label>
          \${renderSearchableSelect("destination-channel-id", formattedChannels, "Search channel...", "")}
        </div>

        <!-- Mentions Section -->
        <div class="form-group">
          <label style="display:block; margin-bottom:6px;">Mention Target</label>
          <div class="mention-selector-tabs" style="display:flex; gap:4px; background:var(--bg-elevated); padding:4px; border-radius:var(--radius); margin-bottom:12px;">
            <button type="button" class="btn btn--sm" :class="activeMentionTab === 'users' ? 'btn--primary' : 'btn--ghost'" @click="activeMentionTab = 'users'" style="flex:1;">Users</button>
            <button type="button" class="btn btn--sm" :class="activeMentionTab === 'roles' ? 'btn--primary' : 'btn--ghost'" @click="activeMentionTab = 'roles'" style="flex:1;">Roles</button>
            <button type="button" class="btn btn--sm" :class="activeMentionTab === 'everyone_here' ? 'btn--primary' : 'btn--ghost'" @click="activeMentionTab = 'everyone_here'" style="flex:1;">Everyone / Here</button>
          </div>

          <!-- Tab: Users -->
          <div x-show="activeMentionTab === 'users'">
            <div style="position:relative;">
              <input type="text" x-model="userQuery" @input.debounce.300ms="searchUsers()" placeholder="Search users by name, nickname, or ID..." class="input" style="width:100%;" autocomplete="off">
              <div x-show="userResults.length" class="dropdown-options" style="display:block; position:absolute; top:100%; left:0; right:0; z-index:1000; max-height:180px; overflow-y:auto; background:var(--bg-elevated); border:1px solid var(--border); border-radius:var(--radius-sm); margin-top:4px; box-shadow:0 4px 12px rgba(0,0,0,0.5)">
                <template x-for="usr in userResults" :key="usr.id">
                  <div class="dropdown-option" @click="addUserMention(usr)" style="padding:8px 12px; cursor:pointer; color:var(--text-1); border-bottom:1px solid var(--border-light); display:flex; align-items:center; gap:8px;" onmouseenter="this.style.background='var(--bg-3)'" onmouseleave="this.style.background=''">
                    <img :src="usr.avatar_url" style="width:20px; height:20px; border-radius:50%; object-fit:cover;" onerror="this.style.display='none'">
                    <span x-text="usr.display_name"></span>
                    <span class="text-3" style="font-size:11px;" x-text="'@' + usr.username"></span>
                  </div>
                </template>
              </div>
            </div>
            <!-- User Chips -->
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
              <template x-for="usr in mentionUsers" :key="usr.id">
                <span class="id-chip" style="display:inline-flex; align-items:center; gap:6px; background:rgba(var(--accent-rgb), 0.15); border-color:var(--accent); color:var(--text-1);">
                  <span x-text="usr.name"></span>
                  <span @click="removeUserMention(usr.id)" style="cursor:pointer; font-weight:bold; color:var(--red);">✕</span>
                </span>
              </template>
            </div>
          </div>

          <!-- Tab: Roles -->
          <div x-show="activeMentionTab === 'roles'">
            <input type="text" x-model="roleFilter" placeholder="Filter roles by name..." class="input" style="width:100%; margin-bottom:8px;">
            <div style="max-height:150px; overflow-y:auto; border:1px solid var(--border); border-radius:var(--radius); padding:6px; background:var(--bg-elevated);">
              <template x-for="role in filteredRoles()" :key="role.id">
                <div @click="toggleRoleMention(role)" style="padding:6px 8px; cursor:pointer; display:flex; align-items:center; justify-content:space-between; border-radius:var(--radius-sm);" :style="isRoleSelected(role.id) ? 'background:rgba(var(--accent-rgb), 0.2)' : ''" onmouseenter="this.style.background='var(--bg-3)'" onmouseleave="this.style.background=this.getAttribute('style').includes('accent-rgb') ? 'rgba(var(--accent-rgb), 0.2)' : ''">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%;" :style="'background:' + role.color"></span>
                    <span x-text="role.name" style="font-size:13px;"></span>
                  </div>
                  <span x-show="isRoleSelected(role.id)" style="color:var(--green); font-size:12px;">✓ Selected</span>
                </div>
              </template>
            </div>
            <!-- Role Chips -->
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
              <template x-for="role in mentionRoles" :key="role.id">
                <span class="id-chip" :style="'border-color:' + role.color" style="display:inline-flex; align-items:center; gap:6px;">
                  <span x-text="role.name"></span>
                  <span @click="toggleRoleMention(role)" style="cursor:pointer; font-weight:bold; color:var(--red);">✕</span>
                </span>
              </template>
            </div>
          </div>

          <!-- Tab: Everyone / Here -->
          <div x-show="activeMentionTab === 'everyone_here'">
            <div style="display:flex; flex-direction:column; gap:12px; background:var(--bg-elevated); padding:12px; border-radius:var(--radius);">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-weight:600; font-size:13px;">Mention @everyone</div>
                  <div style="font-size:11px; color:var(--text-3);">Notify all members of the server</div>
                </div>
                <label class="toggle" :style="!mentionEveryoneAllowed ? 'opacity:0.5; pointer-events:none' : ''">
                  <input type="checkbox" x-model="mentionEveryone" :disabled="!mentionEveryoneAllowed" @change="updatePreview()">
                  <span class="slider"></span>
                </label>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-weight:600; font-size:13px;">Mention @here</div>
                  <div style="font-size:11px; color:var(--text-3);">Notify active members only</div>
                </div>
                <label class="toggle" :style="!mentionEveryoneAllowed ? 'opacity:0.5; pointer-events:none' : ''">
                  <input type="checkbox" x-model="mentionHere" :disabled="!mentionEveryoneAllowed" @change="updatePreview()">
                  <span class="slider"></span>
                </label>
              </div>
              <div x-show="!mentionEveryoneAllowed" class="info-note" style="color:var(--yellow); font-size:11px; margin-top:4px;">
                ⚠️ Bot lacks "Mention Everyone" permission in this channel.
              </div>
            </div>
          </div>
        </div>

        <!-- Message Body -->
        <div class="form-group">
          <label>Message Content</label>
          <textarea x-model="message" @input="updatePreview()" class="textarea" rows="6" maxlength="2000" placeholder="Type message body..." style="width:100%; min-height:80px; resize:vertical;"></textarea>
          <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-3); margin-top:4px;">
            <span :class="message.length > 1900 ? 'text-danger' : 'text-3'" x-text="message.length + ' / 2000 characters'"></span>
          </div>
        </div>

        <!-- Message Type (Plain vs Embed) -->
        <div class="form-group" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:600; font-size:13px;">Message Format</div>
            <div style="font-size:11px; color:var(--text-3);">Send as normal text or rich embed card</div>
          </div>
          <div style="display:flex; gap:4px; background:var(--bg-elevated); padding:3px; border-radius:var(--radius-sm);">
            <button type="button" class="btn btn--sm" :class="messageType === 'plain' ? 'btn--primary' : 'btn--ghost'" @click="messageType = 'plain'; updatePreview()" style="padding:4px 10px;">Plain</button>
            <button type="button" class="btn btn--sm" :class="messageType === 'embed' ? 'btn--primary' : 'btn--ghost'" @click="messageType = 'embed'; updatePreview()" style="padding:4px 10px;">Embed</button>
          </div>
        </div>

        <!-- Embed configuration fields -->
        <div x-show="messageType === 'embed'" style="display:flex; flex-direction:column; gap:10px; border-left:3px solid var(--accent); padding-left:12px; margin-bottom:8px;">
          <div class="form-group">
            <label>Title</label>
            <input x-model="embed.title" @input="updatePreview()" class="input" placeholder="Embed title">
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea x-model="embed.description" @input="updatePreview()" class="textarea" rows="4" placeholder="Embed description (supports markdown)"></textarea>
          </div>
          <div class="form-group">
            <label>Color</label>
            <div style="display:flex; gap:8px; align-items:center;">
              <input type="color" x-model="embed.color" @input="updatePreview()" style="width:36px; height:36px; border:1px solid var(--border); border-radius:4px; background:none; cursor:pointer; padding:0;">
              <input class="input" x-model="embed.color" @input="updatePreview()" style="width:100px;">
            </div>
          </div>
          <div class="form-group">
            <label>Author</label>
            <input x-model="embed.author" @input="updatePreview()" class="input" placeholder="Embed author name">
          </div>
          <div class="form-group">
            <label>Footer</label>
            <input x-model="embed.footer" @input="updatePreview()" class="input" placeholder="Embed footer text">
          </div>
          <div class="form-group">
            <label>Thumbnail URL</label>
            <input x-model="embed.thumbnail" @input="updatePreview()" class="input" placeholder="https://...">
          </div>
          <div class="form-group">
            <label>Image URL</label>
            <input x-model="embed.image" @input="updatePreview()" class="input" placeholder="https://...">
          </div>
          <label class="checkbox-row" style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text-2);">
            <input type="checkbox" x-model="embed.timestamp" @change="updatePreview()">
            <span>Show timestamp in embed</span>
          </label>
        </div>

        <!-- Attachments configuration fields -->
        <div class="form-group">
          <label>File Attachments</label>
          <div style="display:flex; gap:8px; align-items:center; margin-top:4px;">
            <button type="button" class="btn btn--secondary btn--sm" @click="$refs.fileInput.click()">📁 Add Files</button>
            <input type="file" x-ref="fileInput" multiple style="display:none;" @change="onFileChange($event)">
            <span class="text-3" style="font-size:12px;" x-text="attachments.length ? attachments.length + ' file(s) selected' : 'No files selected'"></span>
          </div>
          <div x-show="attachments.length" style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
            <template x-for="(file, index) in attachments" :key="index">
              <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 8px; background:var(--bg-elevated); border:1px solid var(--border); border-radius:var(--radius-sm); font-size:12px;">
                <div style="display:flex; align-items:center; gap:8px; min-width:0;">
                  <span style="font-size:16px;">📄</span>
                  <span x-text="file.name" style="font-family:var(--font-mono); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-2);"></span>
                  <span class="text-3" x-text="'(' + formatSize(file.size) + ')'"></span>
                </div>
                <button type="button" class="btn btn--danger btn--sm" @click="removeAttachment(index)" style="padding:2px 6px;">✕</button>
              </div>
            </template>
          </div>
        </div>

        <!-- Submit Button -->
        <button type="button" class="btn btn--primary" @click="sendMessage()" :disabled="!canSend || sending" style="margin-top:8px; width:100%;">
          <span x-show="!sending">📨 Send Message</span>
          <span x-show="sending">Sending...</span>
        </button>
      </div>

      <!-- Right: Real-time Discord Preview -->
      <div class="card preview-panel" style="display:flex; flex-direction:column; gap:12px; height:fit-content; position:sticky; top:10px;">
        <h3 style="font-size:14px; font-weight:600;">Message Preview</h3>
        <div id="discord-preview-mount"></div>
      </div>
    </div>
  `;

  state.tabCleanup = () => {
    delete window.guildSendMsgComposer;
  };

  if (window.Alpine) {
    window.Alpine.initTree(el);
  }
}

window.guildSendMsgComposer = function (guildId, channels, roles) {
  return {
    guildId,
    channels,
    roles,
    selectedChannelId: "",
    mentionEveryoneAllowed: false,
    activeMentionTab: "users",
    userQuery: "",
    userResults: [],
    mentionUsers: [],
    mentionRoles: [],
    mentionEveryone: false,
    mentionHere: false,
    roleFilter: "",
    message: "",
    messageType: "plain",
    embed: {
      title: "",
      description: "",
      color: "#5865F2",
      footer: "",
      thumbnail: "",
      image: "",
      author: "",
      timestamp: false,
    },
    attachments: [],
    sending: false,
    init() {
      if (state.meta && state.meta.bot_color) {
        this.embed.color = state.meta.bot_color;
      }
      this.$nextTick(() => this.updatePreview());
    },
    onChannelChange(e) {
      if (e.target.id === "destination-channel-id") {
        this.selectedChannelId = e.target.value;
        const ch = this.channels.find((c) => c.id === this.selectedChannelId);
        if (ch) {
          this.mentionEveryoneAllowed = ch.mentionEveryoneAllowed;
        } else {
          this.mentionEveryoneAllowed = false;
          this.mentionEveryone = false;
          this.mentionHere = false;
        }
        this.updatePreview();
      }
    },
    filteredRoles() {
      const f = this.roleFilter.trim().toLowerCase();
      if (!f) return this.roles;
      return this.roles.filter((r) => r.name.toLowerCase().includes(f));
    },
    isRoleSelected(roleId) {
      return this.mentionRoles.some((r) => r.id === roleId);
    },
    toggleRoleMention(role) {
      const idx = this.mentionRoles.findIndex((r) => r.id === role.id);
      if (idx !== -1) {
        this.mentionRoles.splice(idx, 1);
      } else {
        this.mentionRoles.push({
          id: role.id,
          name: role.name,
          color: role.color,
        });
      }
      this.updatePreview();
    },
    searchUsers() {
      const q = this.userQuery.trim();
      if (q.length < 2) {
        this.userResults = [];
        return;
      }
      api
        .get(
          `/guilds/${this.guildId}/send-message/members?q=\${encodeURIComponent(q)}`,
        )
        .then((data) => {
          this.userResults = data;
        })
        .catch(() => {
          this.userResults = [];
        });
    },
    addUserMention(usr) {
      if (!this.mentionUsers.some((u) => u.id === usr.id)) {
        this.mentionUsers.push({
          id: usr.id,
          name: usr.display_name,
        });
      }
      this.userQuery = "";
      this.userResults = [];
      this.updatePreview();
    },
    removeUserMention(userId) {
      this.mentionUsers = this.mentionUsers.filter((u) => u.id !== userId);
      this.updatePreview();
    },
    onFileChange(e) {
      const files = Array.from(e.target.files);
      files.forEach((file) => {
        if (file.size > 8 * 1024 * 1024) {
          showToast(`File \${file.name} exceeds 8MB.`, "error");
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          this.attachments.push({
            name: file.name,
            size: file.size,
            data: event.target.result,
          });
          this.updatePreview();
        };
        reader.readAsDataURL(file);
      });
      e.target.value = "";
    },
    removeAttachment(index) {
      this.attachments.splice(index, 1);
      this.updatePreview();
    },
    formatSize(bytes) {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    },
    get previewImageUrl() {
      const imgFile = this.attachments.find((a) =>
        /\.(png|jpe?g|gif|webp)$/i.test(a.name),
      );
      return imgFile ? imgFile.data : "";
    },
    generateFinalMessage() {
      const prefixLines = [];
      if (this.mentionEveryone) prefixLines.push("@everyone");
      if (this.mentionHere) prefixLines.push("@here");
      if (this.mentionUsers && this.mentionUsers.length) {
        prefixLines.push(this.mentionUsers.map((u) => `<@\${u.id}>`).join(" "));
      }
      if (this.mentionRoles && this.mentionRoles.length) {
        prefixLines.push(
          this.mentionRoles.map((r) => `<@&\${r.id}>`).join(" "),
        );
      }

      let finalContent = "";
      if (prefixLines.length) {
        finalContent = prefixLines.join("\n") + "\n" + (this.message || "");
      } else {
        finalContent = this.message || "";
      }
      return finalContent.trim();
    },
    get canSend() {
      const hasContent =
        this.message.trim() ||
        this.attachments.length > 0 ||
        (this.messageType === "embed" && this.embed.description.trim());
      return this.selectedChannelId && hasContent && !this.sending;
    },
    updatePreview() {
      const mount = document.getElementById("discord-preview-mount");
      if (!mount) return;

      let finalContent = this.generateFinalMessage();

      const memberCache = new Map();
      this.mentionUsers.forEach((u) => memberCache.set(u.id, u.name));

      this.mentionRoles.forEach((r) => {
        finalContent = finalContent.replace(
          new RegExp(`<@&\${r.id}>`, "g"),
          `@\${r.name}`,
        );
      });

      const embedData =
        this.messageType === "embed"
          ? {
              title: this.embed.title || null,
              description:
                this.embed.description || "(empty embed description)",
              imageUrl: this.embed.image || null,
              color:
                this.embed.color || state.meta?.bot_color || "var(--accent)",
              footer: this.embed.footer || "Sent from Web Dashboard",
            }
          : null;

      renderDiscordPreview(mount, {
        botName: state.meta?.bot_name || "Kizoxy",
        botAvatarUrl: state.meta?.bot_avatar_url || "",
        content:
          this.messageType === "embed"
            ? finalContent || ""
            : finalContent || "(empty message content)",
        imageUrl: this.messageType === "embed" ? "" : this.previewImageUrl,
        embed: embedData,
        memberCache: memberCache,
      });
    },
    async sendMessage() {
      if (!this.canSend) return;
      this.sending = true;
      try {
        await api.post(`/guilds/\${this.guildId}/send-message`, {
          channelId: this.selectedChannelId,
          message: this.message,
          mentionUsers: this.mentionUsers.map((u) => u.id),
          mentionRoles: this.mentionRoles.map((r) => r.id),
          mentionEveryone: this.mentionEveryone,
          mentionHere: this.mentionHere,
          messageType: this.messageType,
          embed: this.messageType === "embed" ? this.embed : null,
          attachments: this.attachments,
        });
        showToast("Message sent successfully!", "success");
        this.message = "";
        this.attachments = [];
        this.mentionUsers = [];
        this.mentionRoles = [];
        this.mentionEveryone = false;
        this.mentionHere = false;
        this.embed.title = "";
        this.embed.description = "";
        this.embed.footer = "";
        this.embed.thumbnail = "";
        this.embed.image = "";
        this.embed.author = "";
        this.embed.timestamp = false;
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
