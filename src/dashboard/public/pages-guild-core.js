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
