/* ═══════════════════════════════════════════════════════════════════
   Kizoxy Dashboard — pages-guild-fixembed.js (FixEmbed Tab Renderer)
   ═══════════════════════════════════════════════════════════════════ */

window.fixEmbedSettings = function (
  guildId,
  initialData,
  channels,
  roles,
  members,
) {
  return {
    guildId,
    settings: {
      platforms: {},
      ignoredChannels: [],
      ignoredDomains: [],
      ignoredUsers: [],
      ignoredRoles: [],
      ignoredKeywords: [],
      ...initialData,
    },
    channels: (channels || []).map((c) => ({ id: c.id, name: "#" + c.name })),
    roles: (roles || []).map((r) => ({ id: r.id, name: r.name })),
    members: (members || []).map((m) => ({
      id: m.id,
      name: `${m.name} (${m.tag})`,
    })),
    newDomain: "",
    newKeyword: "",
    saving: false,
    saved: false,
    collapsibleOpen: true,
    platformGroups: {
      social: [
        "twitter",
        "instagram",
        "tiktok",
        "reddit",
        "threads",
        "bluesky",
        "facebook",
        "tumblr",
        "mastodon",
      ],
      media: ["youtube", "twitch", "bilibili", "spotify"],
      art: ["pixiv", "deviantart", "newgrounds", "furaffinity"],
      embedez: [
        "snapchat",
        "pinterest",
        "imgur",
        "ifunny",
        "booru",
        "danbooru",
        "weibo",
      ],
    },
    platformMeta: {
      twitter: {
        emoji: "𝕏",
        label: "Twitter / X",
        viewModes: ["Normal", "Gallery", "Direct", "Text"],
      },
      instagram: {
        emoji: "📸",
        label: "Instagram",
        viewModes: ["Normal", "Gallery", "Direct"],
      },
      tiktok: { emoji: "🎵", label: "TikTok", viewModes: ["Normal", "Direct"] },
      reddit: { emoji: "🤖", label: "Reddit", viewModes: [] },
      threads: { emoji: "🧵", label: "Threads", viewModes: [] },
      bluesky: {
        emoji: "☁️",
        label: "Bluesky",
        viewModes: ["Normal", "Gallery", "Direct", "Text"],
      },
      facebook: { emoji: "👤", label: "Facebook", viewModes: [] },
      tumblr: { emoji: "📓", label: "Tumblr", viewModes: [] },
      mastodon: { emoji: "🐘", label: "Mastodon", viewModes: [] },
      youtube: { emoji: "▶️", label: "YouTube", viewModes: [] },
      twitch: { emoji: "🎮", label: "Twitch Clips", viewModes: [] },
      bilibili: { emoji: "📺", label: "BiliBili", viewModes: [] },
      spotify: { emoji: "🎵", label: "Spotify Tracks", viewModes: [] },
      pixiv: { emoji: "🎨", label: "Pixiv", viewModes: [] },
      deviantart: { emoji: "🖼️", label: "DeviantArt", viewModes: [] },
      newgrounds: { emoji: "🎬", label: "Newgrounds", viewModes: [] },
      furaffinity: { emoji: "🐾", label: "Fur Affinity", viewModes: [] },
      snapchat: { emoji: "👻", label: "Snapchat", viewModes: [] },
      pinterest: { emoji: "📌", label: "Pinterest", viewModes: [] },
      imgur: { emoji: "🖼️", label: "Imgur", viewModes: [] },
      ifunny: { emoji: "😂", label: "iFunny", viewModes: [] },
      booru: { emoji: "🔞", label: "Booru sites", viewModes: [] },
      danbooru: { emoji: "🔞", label: "Danbooru", viewModes: [] },
      weibo: { emoji: "🌐", label: "Weibo", viewModes: [] },
    },
    togglePlatform(key, value) {
      if (!this.settings.platforms[key]) {
        this.settings.platforms[key] = { enabled: true, viewMode: "normal" };
      }
      this.settings.platforms[key].enabled = value;
      this.save({ platforms: { [key]: this.settings.platforms[key] } });
    },
    changePlatformViewMode(key, viewMode) {
      if (!this.settings.platforms[key]) {
        this.settings.platforms[key] = { enabled: true, viewMode: "normal" };
      }
      this.settings.platforms[key].viewMode = viewMode;
      this.save({ platforms: { [key]: this.settings.platforms[key] } });
    },
    enableAllInGroup(groupKey) {
      const updates = {};
      this.platformGroups[groupKey].forEach((k) => {
        if (!this.settings.platforms[k]) {
          this.settings.platforms[k] = { enabled: true, viewMode: "normal" };
        }
        this.settings.platforms[k].enabled = true;
        updates[k] = this.settings.platforms[k];
      });
      this.save({ platforms: updates });
    },
    disableAllInGroup(groupKey) {
      const updates = {};
      this.platformGroups[groupKey].forEach((k) => {
        if (!this.settings.platforms[k]) {
          this.settings.platforms[k] = { enabled: true, viewMode: "normal" };
        }
        this.settings.platforms[k].enabled = false;
        updates[k] = this.settings.platforms[k];
      });
      this.save({ platforms: updates });
    },
    addIgnoredChannel() {
      const selectVal = document.getElementById("ignoredChannelSelect").value;
      if (selectVal && !this.settings.ignoredChannels.includes(selectVal)) {
        this.settings.ignoredChannels.push(selectVal);
        document.getElementById("ignoredChannelSelect-search").value = "";
        document.getElementById("ignoredChannelSelect").value = "";
      }
    },
    removeIgnoredChannel(id) {
      this.settings.ignoredChannels = this.settings.ignoredChannels.filter(
        (c) => c !== id,
      );
    },
    saveIgnoredChannels() {
      this.save({ ignoredChannels: this.settings.ignoredChannels });
    },
    addIgnoredUser() {
      const selectVal = document.getElementById("ignoredUserSelect").value;
      if (selectVal && !this.settings.ignoredUsers.includes(selectVal)) {
        this.settings.ignoredUsers.push(selectVal);
        document.getElementById("ignoredUserSelect-search").value = "";
        document.getElementById("ignoredUserSelect").value = "";
      }
    },
    removeIgnoredUser(id) {
      this.settings.ignoredUsers = this.settings.ignoredUsers.filter(
        (u) => u !== id,
      );
    },
    saveIgnoredUsers() {
      this.save({ ignoredUsers: this.settings.ignoredUsers });
    },
    addIgnoredRole() {
      const selectVal = document.getElementById("ignoredRoleSelect").value;
      if (selectVal && !this.settings.ignoredRoles.includes(selectVal)) {
        this.settings.ignoredRoles.push(selectVal);
        document.getElementById("ignoredRoleSelect-search").value = "";
        document.getElementById("ignoredRoleSelect").value = "";
      }
    },
    removeIgnoredRole(id) {
      this.settings.ignoredRoles = this.settings.ignoredRoles.filter(
        (r) => r !== id,
      );
    },
    saveIgnoredRoles() {
      this.save({ ignoredRoles: this.settings.ignoredRoles });
    },
    addIgnoredKeyword() {
      const kw = this.newKeyword.trim();
      if (
        kw &&
        kw.length <= 100 &&
        !this.settings.ignoredKeywords.includes(kw)
      ) {
        this.settings.ignoredKeywords.push(kw);
        this.newKeyword = "";
      }
    },
    removeIgnoredKeyword(kw) {
      this.settings.ignoredKeywords = this.settings.ignoredKeywords.filter(
        (item) => item !== kw,
      );
    },
    saveIgnoredKeywords() {
      this.save({ ignoredKeywords: this.settings.ignoredKeywords });
    },
    addIgnoredDomain() {
      const d = this.newDomain.trim();
      if (d && d.length <= 100 && !this.settings.ignoredDomains.includes(d)) {
        this.settings.ignoredDomains.push(d);
        this.newDomain = "";
      }
    },
    removeIgnoredDomain(d) {
      this.settings.ignoredDomains = this.settings.ignoredDomains.filter(
        (item) => item !== d,
      );
    },
    saveIgnoredDomains() {
      this.save({ ignoredDomains: this.settings.ignoredDomains });
    },
    async save(partialUpdate = null) {
      this.saving = true;
      this.saved = false;
      try {
        const body = partialUpdate || this.settings;
        const result = await api.patch(
          `/guilds/${this.guildId}/fixembed`,
          body,
        );
        this.settings = result;
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
  el.innerHTML = '<div class="skeleton" style="height:300px"></div>';
  api
    .get(`/guilds/${g.id}/fixembed`)
    .then((settings) => {
      state.currentGuild.fixembed = settings;
      window.tmpFixEmbedData = {
        settings,
        channels: g.channels || [],
        roles: g.roles || [],
        members: g.members || [],
      };

      el.innerHTML = `
      <style>
        .fixembed-dashboard {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .chip-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }
        .chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          color: var(--text-2);
          padding: 6px 12px;
          border-radius: var(--radius-sm);
          font-size: 13px;
        }
        .chip-remove {
          cursor: pointer;
          color: var(--red);
          font-weight: bold;
        }
        .platform-group-card {
          margin-top: 16px;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--bg-elevated);
          padding: 12px;
        }
        .platform-group-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border);
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .platforms-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media(max-width: 768px) {
          .platforms-grid {
            grid-template-columns: 1fr;
          }
        }
        .platform-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--bg-top);
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
        }
        .btn-group-row {
          display: flex;
          gap: 8px;
        }
      </style>
      <div x-data="fixEmbedSettings('${g.id}', window.tmpFixEmbedData.settings, window.tmpFixEmbedData.channels, window.tmpFixEmbedData.roles, window.tmpFixEmbedData.members)" class="fixembed-dashboard">
        
        <!-- SECTION 1 — Global Controls -->
        <div class="card">
          <h3 style="margin-bottom:16px;">Global Controls</h3>
          
          <div class="form-group" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <div>
              <div style="font-weight:600; font-size:14px;">Enable FixEmbed</div>
              <div style="font-size:12px; color:var(--text-3);">Auto-fix social media embed previews</div>
            </div>
            <label class="toggle">
              <input type="checkbox" x-model="settings.enabled" @change="save({ enabled: settings.enabled })">
              <span class="slider"></span>
            </label>
          </div>

          <div x-show="settings.enabled">
            <div class="form-group" style="margin-bottom:16px;">
              <label style="font-weight:600; display:block; margin-bottom:8px;">Behavior when URL found:</label>
              <div style="display:flex; gap:8px;">
                <button type="button" class="btn" :class="settings.deleteBehavior === 'suppress' ? 'btn--primary' : 'btn--ghost'" @click="settings.deleteBehavior = 'suppress'; save({ deleteBehavior: 'suppress' })">Suppress Embeds</button>
                <button type="button" class="btn" :class="settings.deleteBehavior === 'delete' ? 'btn--primary' : 'btn--ghost'" @click="settings.deleteBehavior = 'delete'; save({ deleteBehavior: 'delete' })">Delete & Repost</button>
                <button type="button" class="btn" :class="settings.deleteBehavior === 'none' ? 'btn--primary' : 'btn--ghost'" @click="settings.deleteBehavior = 'none'; save({ deleteBehavior: 'none' })">Send Alongside</button>
              </div>
              <div style="margin-top:8px; font-size:12px; color:var(--text-3);">
                <template x-if="settings.deleteBehavior === 'suppress'">
                  <span>Hides Discord's original preview, keeps user's message</span>
                </template>
                <template x-if="settings.deleteBehavior === 'delete'">
                  <span>Deletes user's message, resends cleaned link (requires Manage Messages)</span>
                </template>
                <template x-if="settings.deleteBehavior === 'none'">
                  <span>Sends fixed link while original embed remains visible</span>
                </template>
              </div>
            </div>

            <div class="form-group" style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:600; font-size:14px;">Fix URLs inside spoiler tags</div>
                <div style="font-size:12px; color:var(--text-3);">||spoiler_url|| → bot re-wraps fixed link as ||fixed||</div>
              </div>
              <label class="toggle">
                <input type="checkbox" x-model="settings.spoilerPassthrough" @change="save({ spoilerPassthrough: settings.spoilerPassthrough })">
                <span class="slider"></span>
              </label>
            </div>
          </div>
        </div>

        <template x-if="settings.enabled">
          <div style="display:flex; flex-direction:column; gap:20px; width:100%;">
            
            <!-- SECTION 2 — Ignored Channels -->
            <div class="card">
              <h3 style="margin-bottom:8px;">Ignored Channels</h3>
              <div style="font-size:12px; color:var(--text-3); margin-bottom:16px;">FixEmbed is skipped in these channels.</div>
              
              <div style="display:flex; gap:8px;">
                <div style="flex:1;">
                  \${renderSearchableSelect(
                    "ignoredChannelSelect",
                    g.channels.map((c) => ({ id: c.id, name: "#" + c.name })),
                    "Search channels...",
                    "",
                    "",
                  )}
                </div>
                <button class="btn btn--primary" @click="addIgnoredChannel()">Add</button>
              </div>

              <div class="chip-list">
                <template x-for="chId in settings.ignoredChannels" :key="chId">
                  <div class="chip">
                    <span x-text="channels.find(c => c.id === chId)?.name || chId"></span>
                    <span class="chip-remove" @click="removeIgnoredChannel(chId)">×</span>
                  </div>
                </template>
              </div>

              <div style="margin-top:16px; display:flex; justify-content:flex-end;">
                <button class="btn btn--confirm" @click="saveIgnoredChannels()">Save Ignored Channels</button>
              </div>
            </div>

            <!-- SECTION — Ignored Users -->
            <div class="card">
              <h3 style="margin-bottom:8px;">Ignored Users</h3>
              <div style="font-size:12px; color:var(--text-3); margin-bottom:16px;">FixEmbed is skipped for these users.</div>
              
              <div style="display:flex; gap:8px;">
                <div style="flex:1;">
                  \${renderSearchableSelect(
                    "ignoredUserSelect",
                    g.members.map((m) => ({
                      id: m.id,
                      name: \`\${m.name} (\${m.tag})\`,
                    })),
                    "Search users...",
                    "",
                    "",
                  )}
                </div>
                <button class="btn btn--primary" @click="addIgnoredUser()">Add</button>
              </div>

              <div class="chip-list">
                <template x-for="uId in settings.ignoredUsers" :key="uId">
                  <div class="chip">
                    <span x-text="members.find(m => m.id === uId)?.name || uId"></span>
                    <span class="chip-remove" @click="removeIgnoredUser(uId)">×</span>
                  </div>
                </template>
              </div>

              <div style="margin-top:16px; display:flex; justify-content:flex-end;">
                <button class="btn btn--confirm" @click="saveIgnoredUsers()">Save Ignored Users</button>
              </div>
            </div>

            <!-- SECTION — Ignored Roles -->
            <div class="card">
              <h3 style="margin-bottom:8px;">Ignored Roles</h3>
              <div style="font-size:12px; color:var(--text-3); margin-bottom:16px;">FixEmbed is skipped for members with these roles.</div>
              
              <div style="display:flex; gap:8px;">
                <div style="flex:1;">
                  \${renderSearchableSelect(
                    "ignoredRoleSelect",
                    g.roles.map((r) => ({ id: r.id, name: r.name })),
                    "Search roles...",
                    "",
                    "",
                  )}
                </div>
                <button class="btn btn--primary" @click="addIgnoredRole()">Add</button>
              </div>

              <div class="chip-list">
                <template x-for="rId in settings.ignoredRoles" :key="rId">
                  <div class="chip">
                    <span x-text="roles.find(r => r.id === rId)?.name || rId"></span>
                    <span class="chip-remove" @click="removeIgnoredRole(rId)">×</span>
                  </div>
                </template>
              </div>

              <div style="margin-top:16px; display:flex; justify-content:flex-end;">
                <button class="btn btn--confirm" @click="saveIgnoredRoles()">Save Ignored Roles</button>
              </div>
            </div>

            <!-- SECTION — Ignored Keywords -->
            <div class="card">
              <h3 style="margin-bottom:8px;">Ignored Keywords</h3>
              <div style="font-size:12px; color:var(--text-3); margin-bottom:16px;">FixEmbed is skipped if message contains any of these keywords (case-insensitive).</div>
              
              <div style="display:flex; gap:8px;">
                <input class="input" x-model="newKeyword" placeholder="e.g. bypass" @keydown.enter="addIgnoredKeyword()">
                <button class="btn btn--primary" @click="addIgnoredKeyword()">Add</button>
              </div>

              <div class="chip-list">
                <template x-for="kw in settings.ignoredKeywords" :key="kw">
                  <div class="chip">
                    <span x-text="kw"></span>
                    <span class="chip-remove" @click="removeIgnoredKeyword(kw)">×</span>
                  </div>
                </template>
              </div>

              <div style="margin-top:16px; display:flex; justify-content:flex-end;">
                <button class="btn btn--confirm" @click="saveIgnoredKeywords()">Save Ignored Keywords</button>
              </div>
            </div>

            <!-- SECTION 3 — Ignored Domains -->
            <div class="card">
              <h3 style="margin-bottom:8px;">Ignored Domains</h3>
              <div style="font-size:12px; color:var(--text-3); margin-bottom:16px;">FixEmbed skips URLs matching these domain patterns.</div>
              
              <div style="display:flex; gap:8px;">
                <input class="input" x-model="newDomain" placeholder="e.g. nitter.poast.org" @keydown.enter="addIgnoredDomain()">
                <button class="btn btn--primary" @click="addIgnoredDomain()">Add</button>
              </div>

              <div class="chip-list">
                <template x-for="d in settings.ignoredDomains" :key="d">
                  <div class="chip">
                    <span x-text="d"></span>
                    <span class="chip-remove" @click="removeIgnoredDomain(d)">×</span>
                  </div>
                </template>
              </div>

              <div style="margin-top:16px; display:flex; justify-content:flex-end;">
                <button class="btn btn--confirm" @click="saveIgnoredDomains()">Save Ignored Domains</button>
              </div>
            </div>

            <!-- SECTION 4 — Platform Settings -->
            <div class="card">
              <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" @click="collapsibleOpen = !collapsibleOpen">
                <h3 style="margin:0;">Platform Settings</h3>
                <span x-text="collapsibleOpen ? '▼' : '▲'" style="font-size:16px; color:var(--text-3);"></span>
              </div>
              
              <div x-show="collapsibleOpen" style="margin-top:16px;">
                <!-- Social Group -->
                <div class="platform-group-card">
                  <div class="platform-group-header">
                     <strong style="font-size:14px;">Social Platforms</strong>
                     <div class="btn-group-row">
                       <button class="btn btn--ghost btn--sm" @click="enableAllInGroup('social')">Enable All</button>
                       <button class="btn btn--ghost btn--sm" @click="disableAllInGroup('social')">Disable All</button>
                     </div>
                  </div>
                  <div class="platforms-grid">
                    <template x-for="key in platformGroups.social" :key="key">
                      <div class="platform-row">
                        <div style="display:flex; align-items:center; gap:8px;">
                          <span x-text="platformMeta[key].emoji"></span>
                          <span x-text="platformMeta[key].label" style="font-weight:500;"></span>
                        </div>
                        <div style="display:flex; align-items:center; gap:12px;">
                          <template x-if="platformMeta[key].viewModes.length > 0">
                            <select :value="settings.platforms[key]?.viewMode || 'normal'" @change="changePlatformViewMode(key, $event.target.value)" class="select" style="width:100px; padding:4px 6px;">
                              <template x-for="mode in platformMeta[key].viewModes" :key="mode">
                                <option :value="mode.toLowerCase()" x-text="mode"></option>
                              </template>
                            </select>
                          </template>
                          <label class="toggle">
                            <input type="checkbox" :checked="settings.platforms[key]?.enabled !== false" @change="togglePlatform(key, $event.target.checked)">
                            <span class="slider"></span>
                          </label>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>

                <!-- Media Group -->
                <div class="platform-group-card">
                  <div class="platform-group-header">
                     <strong style="font-size:14px;">Media Platforms</strong>
                     <div class="btn-group-row">
                       <button class="btn btn--ghost btn--sm" @click="enableAllInGroup('media')">Enable All</button>
                       <button class="btn btn--ghost btn--sm" @click="disableAllInGroup('media')">Disable All</button>
                     </div>
                  </div>
                  <div class="platforms-grid">
                    <template x-for="key in platformGroups.media" :key="key">
                      <div class="platform-row">
                        <div style="display:flex; align-items:center; gap:8px;">
                          <span x-text="platformMeta[key].emoji"></span>
                          <span x-text="platformMeta[key].label" style="font-weight:500;"></span>
                        </div>
                        <div style="display:flex; align-items:center; gap:12px;">
                          <template x-if="platformMeta[key].viewModes.length > 0">
                            <select :value="settings.platforms[key]?.viewMode || 'normal'" @change="changePlatformViewMode(key, $event.target.value)" class="select" style="width:100px; padding:4px 6px;">
                              <template x-for="mode in platformMeta[key].viewModes" :key="mode">
                                <option :value="mode.toLowerCase()" x-text="mode"></option>
                              </template>
                            </select>
                          </template>
                          <label class="toggle">
                            <input type="checkbox" :checked="settings.platforms[key]?.enabled !== false" @change="togglePlatform(key, $event.target.checked)">
                            <span class="slider"></span>
                          </label>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>

                <!-- Art Group -->
                <div class="platform-group-card">
                  <div class="platform-group-header">
                     <strong style="font-size:14px;">Art Platforms</strong>
                     <div class="btn-group-row">
                       <button class="btn btn--ghost btn--sm" @click="enableAllInGroup('art')">Enable All</button>
                       <button class="btn btn--ghost btn--sm" @click="disableAllInGroup('art')">Disable All</button>
                     </div>
                  </div>
                  <div class="platforms-grid">
                    <template x-for="key in platformGroups.art" :key="key">
                      <div class="platform-row">
                        <div style="display:flex; align-items:center; gap:8px;">
                          <span x-text="platformMeta[key].emoji"></span>
                          <span x-text="platformMeta[key].label" style="font-weight:500;"></span>
                        </div>
                        <div style="display:flex; align-items:center; gap:12px;">
                          <template x-if="platformMeta[key].viewModes.length > 0">
                            <select :value="settings.platforms[key]?.viewMode || 'normal'" @change="changePlatformViewMode(key, $event.target.value)" class="select" style="width:100px; padding:4px 6px;">
                              <template x-for="mode in platformMeta[key].viewModes" :key="mode">
                                <option :value="mode.toLowerCase()" x-text="mode"></option>
                              </template>
                            </select>
                          </template>
                          <label class="toggle">
                            <input type="checkbox" :checked="settings.platforms[key]?.enabled !== false" @change="togglePlatform(key, $event.target.checked)">
                            <span class="slider"></span>
                          </label>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>

                <!-- Others via EmbedEZ Group -->
                <div class="platform-group-card">
                  <div class="platform-group-header">
                     <strong style="font-size:14px;">Universal (EmbedEZ)</strong>
                     <div class="btn-group-row">
                       <button class="btn btn--ghost btn--sm" @click="enableAllInGroup('embedez')">Enable All</button>
                       <button class="btn btn--ghost btn--sm" @click="disableAllInGroup('embedez')">Disable All</button>
                     </div>
                  </div>
                  <div class="platforms-grid">
                    <template x-for="key in platformGroups.embedez" :key="key">
                      <div class="platform-row">
                        <div style="display:flex; align-items:center; gap:8px;">
                          <span x-text="platformMeta[key].emoji"></span>
                          <span x-text="platformMeta[key].label" style="font-weight:500;"></span>
                        </div>
                        <div style="display:flex; align-items:center; gap:12px;">
                          <template x-if="platformMeta[key].viewModes.length > 0">
                            <select :value="settings.platforms[key]?.viewMode || 'normal'" @change="changePlatformViewMode(key, $event.target.value)" class="select" style="width:100px; padding:4px 6px;">
                              <template x-for="mode in platformMeta[key].viewModes" :key="mode">
                                <option :value="mode.toLowerCase()" x-text="mode"></option>
                              </template>
                            </select>
                          </template>
                          <label class="toggle">
                            <input type="checkbox" :checked="settings.platforms[key]?.enabled !== false" @change="togglePlatform(key, $event.target.checked)">
                            <span class="slider"></span>
                          </label>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </template>

        <!-- Save state indicator -->
        <div style="margin-top:16px; font-size:12px; display:flex; align-items:center; gap:8px;">
          <div x-show="saving" class="save-indicator" style="color:var(--text-3)">Saving...</div>
          <div x-show="saved" class="save-indicator save-indicator--success" style="color:var(--green)">✓ Saved</div>
        </div>
      </div>\`;

      if (window.Alpine) {
        window.Alpine.initTree(el);
      }
    })
    .catch((e) => {
      el.innerHTML =
        '<div class="card" style="color:var(--red)">Failed to load FixEmbed settings.</div>';
    });
}
