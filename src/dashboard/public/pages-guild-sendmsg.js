let _smState = {
  guilds: [],
  channels: [],
  members: [],
  selectedGuild: null,
  selectedChannel: null,
  taggedMembers: [],
  message: "",
  imageUrl: "",
  asEmbed: false,
  embedTitle: "",
  sending: false,
};

window.renderSendMsg = async function () {
  _smState = {
    guilds: [],
    channels: [],
    members: [],
    selectedGuild: null,
    selectedChannel: null,
    taggedMembers: [],
    message: "",
    imageUrl: "",
    asEmbed: false,
    embedTitle: "",
    sending: false,
  };
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">Send Message</h2>
      <p class="page-subtitle text-3">Send a message to any channel in any server the bot is in.</p>
    </div>
    <div class="sendmsg-layout">
      <div class="sendmsg-compose card" id="sm-compose">${_smBuildCompose()}</div>
      <div class="sendmsg-preview" id="sm-preview">${_smBuildPreview()}</div>
    </div>`;

  try {
    const guilds = await api.get("/guilds");
    _smState.guilds = guilds.map((g) => ({ id: g.id, name: g.name }));
    _smRenderGuildSelect();
  } catch (e) {
    showToast("Failed to load servers: " + e.message, "error");
  }
  _smAttachEvents();
};

function _smBuildCompose() {
  return `
    <div class="form-group">
      <label class="form-label">Server</label>
      <select id="sm-guild-select" class="select"><option value="">— Select a server —</option></select>
    </div>
    <div class="form-group" id="sm-channel-group" style="display:none">
      <label class="form-label">Channel</label>
      <select id="sm-channel-select" class="select"><option value="">— Select a channel —</option></select>
      <div id="sm-channel-loading" class="text-3" style="display:none;font-size:12px;margin-top:4px">Loading channels...</div>
    </div>
    <div class="form-group" id="sm-member-group" style="display:none">
      <label class="form-label">Tag / Mention <span class="text-3" style="font-weight:400;font-size:12px">— optional</span></label>
      <div class="sm-mention-search-wrap">
        <input type="text" id="sm-member-search" class="input" placeholder="Search member by name..." autocomplete="off">
        <div id="sm-member-results" class="sm-dropdown" style="display:none"></div>
      </div>
      <div id="sm-tagged-chips" class="sm-chips-row"></div>
    </div>
    <div class="form-group">
      <div class="sm-label-row">
        <label class="form-label">Message</label>
        <div class="sm-format-toggle">
          <button id="sm-btn-plain" class="btn btn--sm btn--ghost sm-active" onclick="_smSetFormat(false)">Plain</button>
          <button id="sm-btn-embed" class="btn btn--sm btn--ghost" onclick="_smSetFormat(true)">Embed</button>
        </div>
      </div>
      <div id="sm-embed-title-group" style="display:none" class="mb-8">
        <input type="text" id="sm-embed-title" class="input" placeholder="Embed title (optional)" maxlength="256" oninput="_smSyncState()">
      </div>
      <textarea id="sm-message" class="textarea" rows="6" maxlength="2000" placeholder="Type your message..." oninput="_smSyncState()"></textarea>
      <div class="sm-char-count"><span id="sm-char-count">0</span> / 2000</div>
    </div>
    <div class="form-group">
      <label class="form-label">Image / GIF URL <span class="text-3" style="font-weight:400;font-size:12px">— optional</span></label>
      <input type="text" id="sm-image-url" class="input" placeholder="https://example.com/image.gif" oninput="_smSyncState()">
      <div id="sm-image-preview-wrap" style="display:none;margin-top:8px">
        <img id="sm-image-preview" style="max-height:80px;border-radius:4px;display:block" onerror="this.parentElement.style.display='none'">
      </div>
    </div>
    <button id="sm-send-btn" class="btn btn--primary w-full" onclick="_smSend()" disabled>📨 Send Message</button>
    <div id="sm-send-result" style="display:none;margin-top:10px"></div>`;
}

function _smBuildPreview() {
  return `
    <div class="preview-header-label">Preview</div>
    <div id="sm-discord-preview" class="dc-preview-empty">
      <span class="text-3">Preview will appear here as you type.</span>
    </div>`;
}

function _smRenderGuildSelect() {
  const sel = document.getElementById("sm-guild-select");
  if (!sel) return;
  sel.innerHTML =
    '<option value="">— Select a server —</option>' +
    _smState.guilds
      .map((g) => `<option value="${escAttr(g.id)}">${esc(g.name)}</option>`)
      .join("");
}

function _smAttachEvents() {
  const guildSel = document.getElementById("sm-guild-select");
  if (guildSel) {
    guildSel.addEventListener("change", async function () {
      const guildId = this.value;
      if (!guildId) {
        _smState.selectedGuild = null;
        _smState.selectedChannel = null;
        _smState.channels = [];
        _smState.members = [];
        _smState.taggedMembers = [];
        document.getElementById("sm-channel-group").style.display = "none";
        document.getElementById("sm-member-group").style.display = "none";
        _smUpdateSendBtn();
        _smUpdatePreview();
        return;
      }
      _smState.selectedGuild =
        _smState.guilds.find((g) => g.id === guildId) ?? null;
      _smState.selectedChannel = null;
      document.getElementById("sm-channel-group").style.display = "";
      document.getElementById("sm-channel-loading").style.display = "";
      const chanSel = document.getElementById("sm-channel-select");
      chanSel.innerHTML = '<option value="">Loading...</option>';
      chanSel.disabled = true;
      try {
        const channels = await api.get(`/sendmsg/channels/${guildId}`);
        _smState.channels = channels;
        chanSel.innerHTML =
          '<option value="">— Select a channel —</option>' +
          channels
            .map(
              (c) =>
                `<option value="${escAttr(c.id)}">#${esc(c.name)}</option>`,
            )
            .join("");
        chanSel.disabled = false;
        document.getElementById("sm-channel-loading").style.display = "none";
        document.getElementById("sm-member-group").style.display = "";
      } catch (e) {
        chanSel.innerHTML = '<option value="">Failed to load channels</option>';
        chanSel.disabled = false;
        document.getElementById("sm-channel-loading").style.display = "none";
        showToast("Could not load channels: " + e.message, "error");
      }
      _smUpdateSendBtn();
    });
  }

  const chanSel = document.getElementById("sm-channel-select");
  if (chanSel) {
    chanSel.addEventListener("change", function () {
      _smState.selectedChannel =
        _smState.channels.find((c) => c.id === this.value) ?? null;
      _smUpdateSendBtn();
      _smUpdatePreview();
    });
  }

  let _memberSearchTimer = null;
  const memberSearch = document.getElementById("sm-member-search");
  if (memberSearch) {
    memberSearch.addEventListener("input", function () {
      clearTimeout(_memberSearchTimer);
      const q = this.value.trim();
      if (q.length < 2) {
        document.getElementById("sm-member-results").style.display = "none";
        return;
      }
      _memberSearchTimer = setTimeout(() => _smSearchMembers(q), 300);
    });
    memberSearch.addEventListener("blur", function () {
      setTimeout(() => {
        const r = document.getElementById("sm-member-results");
        if (r) r.style.display = "none";
      }, 200);
    });
  }
}

async function _smSearchMembers(q) {
  if (!_smState.selectedGuild) return;
  const resultsEl = document.getElementById("sm-member-results");
  if (!resultsEl) return;
  resultsEl.innerHTML =
    '<div class="sm-dropdown-item text-3">Searching...</div>';
  resultsEl.style.display = "";
  try {
    const members = await api.get(
      `/sendmsg/members/${_smState.selectedGuild.id}?q=${encodeURIComponent(q)}`,
    );
    if (!members.length) {
      resultsEl.innerHTML =
        '<div class="sm-dropdown-item text-3">No members found.</div>';
      return;
    }
    resultsEl.innerHTML = members
      .slice(0, 15)
      .map(
        (m) => `
        <div class="sm-dropdown-item sm-member-result" data-id="${escAttr(m.id)}" data-username="${escAttr(m.username)}" data-display="${escAttr(m.display_name ?? m.username)}">
          <span class="sm-member-name">${esc(m.display_name ?? m.username)}</span>
          <span class="text-3 sm-member-tag">@${esc(m.username)}</span>
        </div>`,
      )
      .join("");

    resultsEl.querySelectorAll(".sm-member-result").forEach((el) => {
      el.addEventListener("click", function () {
        _smTagMember({
          id: this.dataset.id,
          username: this.dataset.username,
          display_name: this.dataset.display,
        });
        document.getElementById("sm-member-search").value = "";
        resultsEl.style.display = "none";
      });
    });
  } catch {
    resultsEl.innerHTML =
      '<div class="sm-dropdown-item text-3">Failed to search members.</div>';
  }
}

function _smTagMember(member) {
  if (_smState.taggedMembers.find((m) => m.id === member.id)) return;
  _smState.taggedMembers.push(member);
  _smRenderChips();
  _smUpdatePreview();
}

window._smRemoveMember = function (id) {
  _smState.taggedMembers = _smState.taggedMembers.filter((m) => m.id !== id);
  _smRenderChips();
  _smUpdatePreview();
};

function _smRenderChips() {
  const wrap = document.getElementById("sm-tagged-chips");
  if (!wrap) return;
  wrap.innerHTML = _smState.taggedMembers
    .map(
      (m) => `
    <span class="sm-chip">
      @${esc(m.display_name ?? m.username)}
      <button class="sm-chip-remove" onclick="_smRemoveMember('${escAttr(m.id)}')" title="Remove">×</button>
    </span>`,
    )
    .join("");
}

function _smSyncState() {
  _smState.message = document.getElementById("sm-message")?.value ?? "";
  _smState.imageUrl = document.getElementById("sm-image-url")?.value ?? "";
  _smState.embedTitle = document.getElementById("sm-embed-title")?.value ?? "";

  const cc = document.getElementById("sm-char-count");
  if (cc) {
    cc.textContent = _smState.message.length;
    cc.style.color =
      _smState.message.length > 1900 ? "var(--red)" : "var(--text-3)";
  }

  const imgWrap = document.getElementById("sm-image-preview-wrap");
  const imgEl = document.getElementById("sm-image-preview");
  if (imgWrap && imgEl && _smState.imageUrl) {
    imgEl.src = _smState.imageUrl;
    imgWrap.style.display = "";
  } else if (imgWrap) {
    imgWrap.style.display = "none";
  }
  _smUpdateSendBtn();
  _smUpdatePreview();
}

window._smSetFormat = function (asEmbed) {
  _smState.asEmbed = asEmbed;
  document.getElementById("sm-embed-title-group").style.display = asEmbed
    ? ""
    : "none";
  document
    .getElementById("sm-btn-plain")
    .classList.toggle("sm-active", !asEmbed);
  document
    .getElementById("sm-btn-embed")
    .classList.toggle("sm-active", asEmbed);
  _smUpdatePreview();
};

function _smUpdateSendBtn() {
  const btn = document.getElementById("sm-send-btn");
  if (!btn) return;
  btn.disabled = !(
    _smState.selectedGuild &&
    _smState.selectedChannel &&
    (_smState.message.trim() || _smState.imageUrl.trim()) &&
    !_smState.sending
  );
}

function _smUpdatePreview() {
  const wrap = document.getElementById("sm-discord-preview");
  if (!wrap) return;
  if (!(
    _smState.message.trim() ||
    _smState.imageUrl.trim() ||
    _smState.taggedMembers.length ||
    _smState.embedTitle.trim()
  )) {
    wrap.className = "dc-preview-empty";
    wrap.innerHTML =
      '<span class="text-3">Preview will appear here as you type.</span>';
    return;
  }
  wrap.className = "";
  const pingStr = _smState.taggedMembers
    .map((m) => `@${m.display_name ?? m.username}`)
    .join(" ");
  const contentStr = [pingStr, _smState.message.trim()]
    .filter(Boolean)
    .join("\n");
  renderDiscordPreview(wrap, {
    botName: window._appState?.meta?.bot_name ?? "Kizoxy",
    botAvatarUrl: window._appState?.meta?.bot_avatar_url ?? "",
    content: _smState.asEmbed ? undefined : contentStr || undefined,
    embed: _smState.asEmbed
      ? {
          title: _smState.embedTitle.trim() || undefined,
          description: _smState.message.trim() || undefined,
          imageUrl: _smState.imageUrl.trim() || undefined,
          color: window._appState?.meta?.bot_color ?? "#5865F2",
        }
      : undefined,
    imageUrl:
      !_smState.asEmbed && _smState.imageUrl.trim()
        ? _smState.imageUrl.trim()
        : undefined,
  });
}

window._smSend = async function () {
  if (_smState.sending) return;
  const btn = document.getElementById("sm-send-btn");
  const resultEl = document.getElementById("sm-send-result");
  _smState.sending = true;
  btn.disabled = true;
  btn.textContent = "Sending...";
  if (resultEl) resultEl.style.display = "none";
  try {
    await api.post("/sendmsg", {
      guild_id: _smState.selectedGuild.id,
      channel_id: _smState.selectedChannel.id,
      message: _smState.message.trim(),
      image_url: _smState.imageUrl.trim() || undefined,
      as_embed: _smState.asEmbed,
      embed_title: _smState.embedTitle.trim() || undefined,
      mentions: _smState.taggedMembers.map((m) => m.id),
    });
    _smState.message = "";
    _smState.imageUrl = "";
    _smState.embedTitle = "";
    _smState.taggedMembers = [];
    const textarea = document.getElementById("sm-message");
    if (textarea) textarea.value = "";
    const imgInput = document.getElementById("sm-image-url");
    if (imgInput) imgInput.value = "";
    const titleInput = document.getElementById("sm-embed-title");
    if (titleInput) titleInput.value = "";
    _smRenderChips();
    _smSyncState();
    if (resultEl) {
      resultEl.style.display = "";
      resultEl.className = "sm-result-banner sm-result-success";
      resultEl.innerHTML = "✅ Message sent successfully.";
      setTimeout(() => {
        resultEl.style.display = "none";
      }, 3000);
    }
    showToast("Message sent!", "success", 2000);
  } catch (e) {
    if (resultEl) {
      resultEl.style.display = "";
      resultEl.className = "sm-result-banner sm-result-error";
      resultEl.textContent = "❌ " + (e.message ?? "Failed to send message.");
    }
    showToast("Failed to send: " + e.message, "error");
  } finally {
    _smState.sending = false;
    _smUpdateSendBtn();
    btn.textContent = "📨 Send Message";
  }
};
