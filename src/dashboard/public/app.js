/* ═══════════════════════════════════════════════════════════════════
   Kizoxy Dashboard — app.js (router, API client, sidebar, boot)
   ═══════════════════════════════════════════════════════════════════ */

// ── SECTION 1: API client ──
const api = {
  get: (path) =>
    fetch("/api" + path).then((r) => (r.ok ? r.json() : Promise.reject(r))),
  post: (path, body) =>
    fetch("/api" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => (r.ok ? r.json() : Promise.reject(r))),
  patch: (path, body) =>
    fetch("/api" + path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => (r.ok ? r.json() : Promise.reject(r))),
  del: (path) =>
    fetch("/api" + path, { method: "DELETE" }).then((r) =>
      r.ok ? r.json() : Promise.reject(r),
    ),
};

// ── SECTION 2: State ──
const state = {
  meta: null,
  guilds: null,
  currentGuild: null,
  uptimeBase: null,
  uptimeTimer: null,
  metaTimer: null,
};

// ── SECTION 3: Toast system ──
function showToast(msg, type = "info", duration = 4000) {
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, duration);
}

// ── SECTION 4: Utilities ──
function esc(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// Attribute-safe escape: esc() handles <>& but not quotes, which would break
// out of a value="..." attribute. Use this for any user value in an attribute.
function escAttr(str) {
  return esc(str).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Client-side mirror of src/lib/notificationTemplate.js buildContent(), used
// to show a live preview of the announcement message as the user types.
const PREVIEW_VARS = {
  name: "Creator Name",
  url: "https://youtu.be/dQw4w9WgXcQ",
  title: "Sample Video Title",
  type: "video",
};
function buildMessagePreview(customMessage, mentionRoleId, defaultPrefix) {
  const roleMention = mentionRoleId ? "@Role" : "";
  const merged = { ...PREVIEW_VARS, role: roleMention };
  let out;
  if (customMessage && customMessage.trim()) {
    out = customMessage.replace(/\{(\w+)\}/g, (_m, k) =>
      merged[k] !== undefined && merged[k] !== null ? String(merged[k]) : "",
    );
    if (roleMention && !/\{role\}/.test(customMessage)) {
      out = `${roleMention} ${out}`;
    }
  } else {
    out = roleMention ? `${roleMention} ${defaultPrefix}` : defaultPrefix;
  }
  return out.trim().slice(0, 2000);
}

function updateMsgPreview(msgId, roleId, targetId, defaultPrefix) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const msg = (document.getElementById(msgId)?.value || "").trim();
  const roleVal = document.getElementById(roleId)?.value || "";
  const rendered = buildMessagePreview(msg, roleVal || null, defaultPrefix);

  const isYoutube = targetId.startsWith("yt-");
  const color = isYoutube ? "#ff0000" : "#00f2fe";
  const authorName = isYoutube
    ? "🎬 NEW VIDEO • Creator Name"
    : "🎵 NEW POST • Creator Name";
  const title = isYoutube ? "Sample Video Title" : "Sample TikTok Post Title";

  const memberCache = new Map();
  if (roleVal) {
    const select = document.getElementById(roleId);
    const selectedOption = select?.options[select.selectedIndex];
    if (selectedOption) {
      memberCache.set(roleVal, selectedOption.text);
    }
  }

  const content = roleVal ? rendered.replace(/@Role/g, `<@${roleVal}>`) : rendered;

  window.renderDiscordPreview(target, {
    botName: state.meta?.bot_name || "Kizoxy",
    botAvatarUrl: state.meta?.bot_avatar_url || "",
    content: content,
    embed: {
      title: title,
      description: `**Creator Name** just posted on ${isYoutube ? "YouTube" : "TikTok"}.`,
      color: color,
      footer: authorName
    },
    memberCache: memberCache
  });
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (d) parts.push(d + "d");
  parts.push(h + "h", m + "m", sec + "s");
  return parts.join(" ");
}

function toggleHtml(id, checked, extraAttrs = "") {
  return `<label class="toggle"><input type="checkbox" ${checked ? "checked" : ""} ${extraAttrs}><span class="slider"></span></label>`;
}

function defaultIcon(name) {
  return name ? name.charAt(0).toUpperCase() : "?";
}

function guildIconHtml(icon, name, cls = "guild-icon") {
  if (icon)
    return `<img class="${cls}" src="${esc(icon)}" alt="" onerror="this.outerHTML='<span class=\\'${cls}\\'>${defaultIcon(esc(name))}</span>'">`;
  return `<span class="${cls}" style="display:inline-flex;align-items:center;justify-content:center;background:var(--bg-elevated);color:var(--text-2);font-weight:600;font-size:${cls.includes("lg") ? "20" : "14"}px;border-radius:50%;width:${cls.includes("lg") ? "48" : "32"}px;height:${cls.includes("lg") ? "48" : "32"}px">${defaultIcon(name)}</span>`;
}

function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => showToast("Copied to clipboard!", "success", 1500))
    .catch(() => showToast("Copy failed", "error", 2000));
}

// ── SECTION 5: Router ──
const routes = {
  "#overview": {
    title: "Overview",
    render: () => typeof renderOverview === "function" && renderOverview(),
  },
  "#guilds": {
    title: "Guilds",
    render: () => typeof renderGuilds === "function" && renderGuilds(),
  },
  "#commands": {
    title: "Commands",
    render: () => typeof renderCommands === "function" && renderCommands(),
  },
  "#sendmsg": {
    title: "Send Message",
    render: () => typeof renderSendMsg === "function" && renderSendMsg(),
  },
  "#updates": {
    title: "Check for Updates",
    render: () => typeof renderUpdates === "function" && renderUpdates(),
  },
  "#config": {
    title: "Configuration",
    render: () => typeof renderConfig === "function" && renderConfig(),
  },
  "#logs": {
    title: "Logs",
    render: () => typeof renderLogs === "function" && renderLogs(),
  },
};

function navigate(hash) {
  document.body.classList.remove("sidebar-open");
  if (!hash || hash === "#") hash = "#overview";

  if (state.pageCleanup) {
    try {
      state.pageCleanup();
    } catch (e) {
      console.error("Cleanup error:", e);
    }
    state.pageCleanup = null;
  }

  // Guild detail route: #guild/<id> or #guild/<id>/<tab>
  if (hash.startsWith("#guild/")) {
    const parts = hash.replace("#guild/", "").split("/");
    document.getElementById("page-title").textContent = "Guild Detail";
    setActiveNav("");
    if (typeof renderGuild === "function") renderGuild(parts[0], parts[1]);
    return;
  }

  const route = routes[hash];
  if (!route) {
    hash = "#overview";
    return navigate(hash);
  }
  document.getElementById("page-title").textContent = route.title;
  setActiveNav(hash);
  
  const res = route.render();
  if (res instanceof Promise) {
    res.then(() => {
      if (window.Alpine) window.Alpine.initTree(document.getElementById("content"));
    }).catch(() => {});
  } else {
    if (window.Alpine) window.Alpine.initTree(document.getElementById("content"));
  }
}

function setActiveNav(hash) {
  document.querySelectorAll(".nav-link").forEach((el) => {
    el.classList.toggle("active", el.dataset.hash === hash);
  });
}

window.addEventListener("hashchange", () => navigate(location.hash));
document.getElementById("refresh-btn").onclick = () => navigate(location.hash);

// ── SECTION 6: Sidebar ──
function renderSidebar(meta) {
  const botInfo = document.getElementById("bot-info");
  const nav = document.getElementById("nav");
  const footer = document.getElementById("sidebar-footer");

  if (!meta) {
    botInfo.innerHTML = `<div class="skeleton" style="width:32px;height:32px;border-radius:50%"></div><div class="bot-meta"><div class="skeleton" style="width:80px;height:14px;margin-bottom:4px"></div><div class="skeleton" style="width:60px;height:12px"></div></div>`;
    footer.innerHTML = `<div class="skeleton" style="width:100px;height:12px"></div>`;
  } else {
    const statusVal = meta.presence_status || meta.status || "online";
    const statusClass = statusVal.toLowerCase();

    let disc = "";
    if (meta.bot_tag && meta.bot_tag.includes("#")) {
      const parts = meta.bot_tag.split("#");
      disc = parts[1];
    }
    const tagDisplay =
      disc === "0" || disc === "0000" ? "#0" : disc ? `#${disc}` : "";

    botInfo.innerHTML = `
      <img src="${esc(meta.bot_avatar_url || "")}" alt="" style="width:40px;height:40px;border-radius:50%" onerror="this.style.display='none'">
      <div class="bot-meta">
        <div class="bot-name" style="font-size:14px;font-weight:600;">${esc(meta.bot_name)}</div>
        ${tagDisplay ? `<div style="font-size:11px;color:var(--text-3);line-height:1.1;">${esc(tagDisplay)}</div>` : ""}
        <div class="bot-tag" style="line-height:1.1;margin-top:2px;"><span class="status-dot status-dot--${statusClass}"></span> ${esc(statusVal)}</div>
      </div>`;
    footer.innerHTML = `<div class="uptime" id="uptime-display">${formatUptime(meta.uptime_ms)}</div><div style="margin-top:4px">v${esc(meta.version)}</div>`;
  }

  nav.innerHTML = [
    { hash: "#overview", icon: "🏠", label: "Overview" },
    { hash: "#guilds", icon: "⚙️", label: "Guilds" },
    { hash: "#commands", icon: "📖", label: "Commands" },
    { hash: "#sendmsg", icon: "✉️", label: "Send Msg" },
    { hash: "#updates", icon: "🚀", label: "Updates" },
    { hash: "#config", icon: "🔧", label: "Config" },
    { hash: "#logs", icon: "📋", label: "Logs" },
  ]
    .map(
      (n) =>
        `<a class="nav-link" data-hash="${n.hash}" onclick="location.hash='${n.hash}'"><span class="nav-icon">${n.icon}</span> <span class="nav-label">${n.label}</span></a>`,
    )
    .join("");
}

function updateUptime() {
  const el = document.getElementById("uptime-display");
  if (!el || !state.uptimeBase) return;
  el.textContent = formatUptime(Date.now() - state.uptimeBase);
}

// ── SECTION 7: Boot ──
async function boot() {
  renderSidebar(null);

  try {
    state.meta = await api.get("/meta");
    if (state.meta.bot_color) {
      document.documentElement.style.setProperty(
        "--accent",
        state.meta.bot_color,
      );
      // Parse hex to RGB for rgba() usage.
      const hex = state.meta.bot_color.replace("#", "");
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
    renderSidebar(state.meta);
    state.uptimeBase = Date.now() - state.meta.uptime_ms;
    state.uptimeTimer = setInterval(updateUptime, 1000);
    state.metaTimer = setInterval(async () => {
      try {
        state.meta = await api.get("/meta");
        state.uptimeBase = Date.now() - state.meta.uptime_ms;
        const dot = document.querySelector("#bot-info .status-dot");
        if (dot) {
          dot.className = `status-dot status-dot--${state.meta.status === "online" ? "online" : "offline"}`;
        }
      } catch {
        /* ignore meta refresh failure */
      }
    }, 30000);

    // Fetch guilds to evaluate filter visibility.
    state.guilds = await api.get("/guilds");
    updateSidebarFilterVisibility();
  } catch (err) {
    showToast("Failed to connect to API", "error");
    renderSidebar(null);
  }

  // Set up sidebar guild filter.
  const filterInput = document.getElementById("sidebar-guild-filter");
  const clearBtn = document.getElementById("sidebar-guild-filter-clear");
  if (filterInput) {
    filterInput.oninput = (e) => {
      const val = e.target.value;
      state.guildsFilter = val.toLowerCase();
      if (clearBtn) clearBtn.style.display = val ? "block" : "none";
      if (location.hash === "#guilds" || !location.hash) {
        filterGuildTableFromSidebar();
      }
    };
  }
  if (clearBtn) {
    clearBtn.onclick = () => {
      if (filterInput) {
        filterInput.value = "";
        state.guildsFilter = "";
        clearBtn.style.display = "none";
        if (location.hash === "#guilds" || !location.hash) {
          filterGuildTableFromSidebar();
        }
      }
    };
  }

  // Set up shortcuts & help.
  document.getElementById("help-shortcuts-btn").onclick = () => {
    showToast(
      "Shortcuts: g+o (Overview), g+g (Guilds), g+m (Commands), g+c (Config), g+l (Logs). Esc: cancel prompts.",
      "info",
      6000,
    );
  };

  let lastGTime = 0;
  window.addEventListener("keydown", (e) => {
    const active = document.activeElement;
    if (
      active &&
      (active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.isContentEditable)
    ) {
      return;
    }

    if (e.key === "Escape") {
      if (location.hash.startsWith("#guild/")) {
        const parts = location.hash.replace("#guild/", "").split("/");
        if (parts[1] === "Alarms") {
          switchGuildTab(parts[0], "Alarms");
        }
      }
      return;
    }

    if (e.key.toLowerCase() === "g") {
      lastGTime = Date.now();
      return;
    }

    if (Date.now() - lastGTime < 500) {
      const key = e.key.toLowerCase();
      if (key === "o") {
        location.hash = "#overview";
        lastGTime = 0;
      } else if (key === "g") {
        location.hash = "#guilds";
        lastGTime = 0;
      } else if (key === "m") {
        location.hash = "#commands";
        lastGTime = 0;
      } else if (key === "c") {
        location.hash = "#config";
        lastGTime = 0;
      } else if (key === "l") {
        location.hash = "#logs";
        lastGTime = 0;
      }
    }
  });

  navigate(location.hash || "#overview");

  // Mobile sidebar toggle
  document.getElementById("sidebar-toggle").onclick = () => {
    document.body.classList.toggle("sidebar-open");
  };
  document.getElementById("sidebar-overlay").onclick = () => {
    document.body.classList.remove("sidebar-open");
  };
}

function updateSidebarFilterVisibility() {
  const container = document.getElementById("sidebar-filter-container");
  if (!container) return;
  if (state.guilds && state.guilds.length > 5) {
    container.style.display = "block";
  } else {
    container.style.display = "none";
  }
}

function filterGuildTableFromSidebar() {
  const q = state.guildsFilter || "";
  const rows = document.querySelectorAll("#guild-table tbody tr");
  rows.forEach((row) => {
    row.style.display = row.dataset.name.includes(q) ? "" : "none";
  });
}

document.addEventListener("DOMContentLoaded", boot);
