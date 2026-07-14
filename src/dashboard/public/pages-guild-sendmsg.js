function renderGuildSendMsg(el, g) {
  const formattedChannels = g.channels.map((ch) => ({
    id: ch.id,
    name: ch.parentName ? `${ch.name} [Category: ${ch.parentName}]` : ch.name,
  }));
  const membersList = (g.members || []).map((m) => ({
    id: m.id,
    name: m.tag ? `${m.name} (${m.tag})` : m.name,
  }));

  el.innerHTML = `
    <div x-data="guildSendMsgComposer('${g.id}', ${JSON.stringify(formattedChannels)}, ${JSON.stringify(membersList)})" class="sendmsg-layout" @change="onSelectChange($event)" style="display:grid; grid-template-columns:1fr 1fr; gap:20px; max-width:1200px; margin:0 auto;">
      <div class="card compose-panel" style="display:flex; flex-direction:column; gap:16px;">
        <h3 style="font-size:14px; font-weight:600; margin-bottom:4px;">Send Message</h3>
        <div class="form-group"><label>Destination Channel</label>\${renderSearchableSelect("destination-channel-id", formattedChannels, "Search channel...", "")}</div>
        <div class="form-group"><label>Tag / Mention Member</label>\${renderSearchableSelect("mention-user-select", membersList, "Search member...", "")}</div>
        <div x-show="taggedUsers.length" style="display:flex; flex-wrap:wrap; gap:6px;">
          <template x-for="usr in taggedUsers" :key="usr.id">
            <span class="id-chip" style="display:inline-flex; align-items:center; gap:6px; background:rgba(var(--accent-rgb), 0.15); border-color:var(--accent); color:var(--text-1);">
              <span x-text="usr.name"></span><span @click="removeUserMention(usr.id)" style="cursor:pointer; font-weight:bold; color:var(--red);">✕</span>
            </span>
          </template>
        </div>
        <div class="form-group">
          <label>Message Content</label>
          <textarea x-model="message" @input="updatePreview()" id="sendmsg-message-textarea" class="textarea" rows="6" maxlength="2000" placeholder="Type message body..." style="width:100%; min-height:80px; resize:vertical;"></textarea>
          <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-3); margin-top:4px;"><span :class="message.length > 1900 ? 'text-danger' : 'text-3'" x-text="message.length + ' / 2000 characters'"></span></div>
        </div>
        <div class="form-group" style="display:flex; justify-content:space-between; align-items:center;">
          <div><div style="font-weight:600; font-size:13px;">Message Format</div><div style="font-size:11px; color:var(--text-3);">Send as normal text or rich embed card</div></div>
          <div style="display:flex; gap:4px; background:var(--bg-elevated); padding:3px; border-radius:var(--radius-sm);">
            <button type="button" class="btn btn--sm" :class="messageType === 'plain' ? 'btn--primary' : 'btn--ghost'" @click="messageType = 'plain'; updatePreview()" style="padding:4px 10px;">Plain</button>
            <button type="button" class="btn btn--sm" :class="messageType === 'embed' ? 'btn--primary' : 'btn--ghost'" @click="messageType = 'embed'; updatePreview()" style="padding:4px 10px;">Embed</button>
          </div>
        </div>
        <div x-show="messageType === 'embed'" style="display:flex; flex-direction:column; gap:10px; border-left:3px solid var(--accent); padding-left:12px; margin-bottom:8px;">
          <div class="form-group"><label>Title</label><input x-model="embed.title" @input="updatePreview()" class="input" placeholder="Embed title"></div>
          <div class="form-group"><label>Description</label><textarea x-model="embed.description" @input="updatePreview()" class="textarea" rows="4" placeholder="Embed description (supports markdown)"></textarea></div>
          <div class="form-group"><label>Color</label><div style="display:flex; gap:8px; align-items:center;"><input type="color" x-model="embed.color" @input="updatePreview()" style="width:36px; height:36px; border:1px solid var(--border); border-radius:4px; background:none; cursor:pointer; padding:0;"><input class="input" x-model="embed.color" @input="updatePreview()" style="width:100px;"></div></div>
          <div class="form-group"><label>Author</label><input x-model="embed.author" @input="updatePreview()" class="input" placeholder="Embed author name"></div>
          <div class="form-group"><label>Footer</label><input x-model="embed.footer" @input="updatePreview()" class="input" placeholder="Embed footer text"></div>
          <div class="form-group"><label>Thumbnail URL</label><input x-model="embed.thumbnail" @input="updatePreview()" class="input" placeholder="https://..."></div>
          <div class="form-group"><label>Image URL</label><input x-model="embed.image" @input="updatePreview()" class="input" placeholder="https://..."></div>
          <label class="checkbox-row" style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text-2);"><input type="checkbox" x-model="embed.timestamp" @change="updatePreview()"><span>Show timestamp in embed</span></label>
        </div>
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
                  <span>📄</span><span x-text="file.name" style="font-family:var(--font-mono); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-2);"></span>
                  <span class="text-3" x-text="'(' + formatSize(file.size) + ')'"></span>
                </div>
                <button type="button" class="btn btn--danger btn--sm" @click="removeAttachment(index)" style="padding:2px 6px;">✕</button>
              </div>
            </template>
          </div>
        </div>
        <button type="button" class="btn btn--primary" @click="sendMessage()" :disabled="!canSend || sending" style="margin-top:8px; width:100%;">
          <span x-show="!sending">📨 Send Message</span><span x-show="sending">Sending...</span>
        </button>
      </div>
      <div class="card preview-panel" style="display:flex; flex-direction:column; gap:12px; height:fit-content; position:sticky; top:10px;">
        <h3 style="font-size:14px; font-weight:600;">Message Preview</h3><div id="discord-preview-mount"></div>
      </div>
    </div>`;

  state.tabCleanup = () => { delete window.guildSendMsgComposer; };
  if (window.Alpine) { window.Alpine.initTree(el); }
}

window.guildSendMsgComposer = function (guildId, channels, members) {
  return {
    guildId, channels, members, selectedChannelId: "", taggedUsers: [], message: "", messageType: "plain",
    embed: { title: "", description: "", color: "#5865F2", footer: "", thumbnail: "", image: "", author: "", timestamp: false },
    attachments: [], sending: false,
    init() {
      if (state.meta && state.meta.bot_color) { this.embed.color = state.meta.bot_color; }
      this.$nextTick(() => this.updatePreview());
    },
    onSelectChange(e) {
      if (e.target.id === "destination-channel-id") {
        this.selectedChannelId = e.target.value;
        this.updatePreview();
      } else if (e.target.id === "mention-user-select") {
        const userId = e.target.value;
        if (!userId) return;
        const member = this.members.find((m) => m.id === userId);
        if (member) { this.insertUserMention(member); }
        if (typeof selectDropdownOption === "function") { selectDropdownOption("mention-user-select", "", ""); }
      }
    },
    insertUserMention(member) {
      const ta = document.getElementById("sendmsg-message-textarea");
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const text = this.message;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const token = `<@${member.id}>`;
      this.message = before + token + after;
      if (!this.taggedUsers.some((u) => u.id === member.id)) {
        this.taggedUsers.push({ id: member.id, name: member.name });
      }
      this.updatePreview();
      this.$nextTick(() => {
        ta.focus();
        const newPos = start + token.length;
        ta.setSelectionRange(newPos, newPos);
      });
    },
    removeUserMention(userId) {
      this.taggedUsers = this.taggedUsers.filter((u) => u.id !== userId);
      const token = `<@${userId}>`;
      this.message = this.message.split(token).join("");
      this.updatePreview();
    },
    onFileChange(e) {
      const files = Array.from(e.target.files);
      files.forEach((file) => {
        if (file.size > 8 * 1024 * 1024) {
          showToast(`File ${file.name} exceeds 8MB.`, "error");
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          this.attachments.push({ name: file.name, size: file.size, data: event.target.result });
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
      const imgFile = this.attachments.find((a) => /\.(png|jpe?g|gif|webp)$/i.test(a.name));
      return imgFile ? imgFile.data : "";
    },
    get canSend() {
      const hasContent = this.message.trim() || this.attachments.length > 0 || (this.messageType === "embed" && this.embed.description.trim());
      return this.selectedChannelId && hasContent && !this.sending;
    },
    updatePreview() {
      const mount = document.getElementById("discord-preview-mount");
      if (!mount) return;
      const memberCache = new Map();
      this.taggedUsers.forEach((u) => memberCache.set(u.id, u.name));
      const embedData = this.messageType === "embed"
        ? {
            title: this.embed.title || null,
            description: this.embed.description || "(empty embed description)",
            imageUrl: this.embed.image || null,
            color: this.embed.color || state.meta?.bot_color || "var(--accent)",
            footer: this.embed.footer || "Sent from Web Dashboard",
          }
        : null;
      renderDiscordPreview(mount, {
        botName: state.meta?.bot_name || "Kizoxy",
        botAvatarUrl: state.meta?.bot_avatar_url || "",
        content: this.messageType === "embed" ? (this.message || "") : (this.message || "(empty message content)"),
        imageUrl: this.messageType === "embed" ? "" : this.previewImageUrl,
        embed: embedData,
        memberCache: memberCache,
      });
    },
    async sendMessage() {
      if (!this.canSend) return;
      this.sending = true;
      try {
        await api.post("/sendmsg", {
          guildId: this.guildId,
          channelId: this.selectedChannelId,
          message: this.message,
          messageType: this.messageType,
          embed: this.messageType === "embed" ? this.embed : null,
          attachments: this.attachments,
        });
        showToast("Message sent successfully!", "success");
        this.message = "";
        this.attachments = [];
        this.taggedUsers = [];
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
