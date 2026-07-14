/* ═══════════════════════════════════════════════════════════════════
   Kizoxy Dashboard — components.js (Shared UI utilities)
   ═══════════════════════════════════════════════════════════════════ */

function classifyLogLine(line) {
  if (!line) return "info";
  // JSON format (production/PM2): {"level":"error",...}
  const m = line.match(/"level"\s*:\s*"(\w+)"/);
  if (m) {
    const lv = m[1].toLowerCase();
    if (lv === "error") return "error";
    if (lv === "warn" || lv === "warning") return "warn";
    if (lv === "success") return "success";
    if (lv === "debug") return "debug";
    return "info";
  }
  // Pretty format (dev): emoji prefixes
  if (line.includes("❌")) return "error";
  if (line.includes("⚠") || line.includes("⚠️")) return "warn";
  if (line.includes("✅")) return "success";
  if (line.includes("🐛")) return "debug";
  return "info";
}

function formatLogLine(line) {
  if (!line) return "";
  const trimmed = line.trim();
  let jsonStr = "";
  if (trimmed.startsWith("{")) {
    jsonStr = trimmed;
  } else {
    const idx = trimmed.indexOf("{");
    if (idx !== -1) {
      jsonStr = trimmed.slice(idx);
    }
  }

  if (jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      const emojis = {
        error: "❌",
        warning: "⚠️",
        warn: "⚠️",
        success: "✅",
        debug: "🐛",
        info: "ℹ️",
      };
      const emoji = emojis[data.level?.toLowerCase()] || "ℹ️";

      let timeStr = "";
      if (data.timestamp) {
        const d = new Date(data.timestamp);
        if (!isNaN(d.getTime())) {
          timeStr = `[${d.toLocaleTimeString()}]`;
        }
      }
      if (!timeStr && !trimmed.startsWith("{")) {
        const idx = trimmed.indexOf("{");
        timeStr = `[${trimmed.slice(0, idx).replace(/:$/, "").trim()}]`;
      }

      const moduleStr = data.module ? ` [${data.module}]` : "";
      return `${timeStr} ${emoji}${moduleStr} ${esc(data.message || "")}`;
    } catch {
      // ignore
    }
  }
  return esc(line);
}

function colorizeLog(content) {
  if (!content) return "";
  return content
    .split("\n")
    .map(
      (line) =>
        `<div class="log-line--${classifyLogLine(line)}">${formatLogLine(line)}</div>`,
    )
    .join("");
}

function renderSearchableSelect(
  id,
  items,
  placeholder,
  selectedValue,
  onchangeAttr,
) {
  const selectedItem = items.find(
    (item) => String(item.id) === String(selectedValue || ""),
  );
  const selectedName = selectedItem ? selectedItem.name : "";
  const selectedVal = selectedItem ? selectedItem.id : "";

  return `
    <div class="searchable-select" id="select-container-${id}" style="position:relative">
      <input class="input" id="${id}-search" placeholder="${placeholder}" value="${escAttr(selectedName)}" autocomplete="off" onclick="toggleDropdown('${id}')" oninput="filterDropdown('${id}')" style="padding-right:30px">
      <span style="position:absolute; right:10px; top:50%; transform:translateY(-50%); pointer-events:none; color:var(--text-3)">▼</span>
      <input type="hidden" id="${id}" value="${selectedVal}" ${onchangeAttr ? `onchange="${onchangeAttr}"` : ""}>
      <div class="dropdown-options" id="${id}-options" style="display:none; position:absolute; top:100%; left:0; right:0; z-index:1000; max-height:180px; overflow-y:auto; background:var(--bg-elevated); border:1px solid var(--border); border-radius:var(--radius-sm); margin-top:4px; box-shadow:0 4px 12px rgba(0,0,0,0.5)">
        <div class="dropdown-option" data-value="" data-search="none" onclick="selectDropdownOption('${id}', '', 'None / Belum diatur')" style="padding:8px 12px; cursor:pointer; color:var(--text-3); border-bottom:1px solid var(--border-light); font-style:italic" onmouseenter="this.style.background='var(--bg-3)'" onmouseleave="this.style.background=''">
          None / Belum diatur
        </div>
        ${items
      .map(
        (item) => `
          <div class="dropdown-option" data-value="${item.id}" data-search="${escAttr(item.name)}" onclick="selectDropdownOption('${id}', '${item.id}', '${escAttr(item.name)}')" style="padding:8px 12px; cursor:pointer; color:var(--text-1); border-bottom:1px solid var(--border-light)" onmouseenter="this.style.background='var(--bg-3)'" onmouseleave="this.style.background=''">
            ${item.color ? `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${item.color}; margin-right:8px"></span>` : ""}
            ${esc(item.name)}
          </div>
        `,
      )
      .join("")}
      </div>
    </div>
  `;
}

window.toggleDropdown = function (id) {
  document.querySelectorAll(".dropdown-options").forEach((el) => {
    if (el.id !== `${id}-options`) el.style.display = "none";
  });
  const el = document.getElementById(`${id}-options`);
  if (el) {
    el.style.display = el.style.display === "none" ? "block" : "none";
  }
};

window.filterDropdown = function (id) {
  const searchInput = document.getElementById(`${id}-search`);
  if (!searchInput) return;
  const filter = searchInput.value.toLowerCase();
  const optionsContainer = document.getElementById(`${id}-options`);
  if (optionsContainer) {
    optionsContainer.style.display = "block";
    const options = optionsContainer.getElementsByClassName("dropdown-option");
    for (let i = 0; i < options.length; i++) {
      const txtValue = options[i].getAttribute("data-search") || "";
      if (txtValue.toLowerCase().indexOf(filter) > -1) {
        options[i].style.display = "";
      } else {
        options[i].style.display = "none";
      }
    }
  }
};

window.selectDropdownOption = function (id, value, name) {
  const searchInput = document.getElementById(`${id}-search`);
  const hiddenInput = document.getElementById(id);
  const optionsContainer = document.getElementById(`${id}-options`);
  if (searchInput && hiddenInput && optionsContainer) {
    searchInput.value = name;
    hiddenInput.value = value;
    optionsContainer.style.display = "none";

    const event = new Event("change", { bubbles: true });
    hiddenInput.dispatchEvent(event);
  }
};

document.addEventListener("click", function (e) {
  if (!e.target.closest(".searchable-select")) {
    document.querySelectorAll(".dropdown-options").forEach((el) => {
      el.style.display = "none";
    });
  }
});

window.renderDiscordPreview = function(mountEl, options = {}) {
  if (!mountEl) return;
  const {
    botName = "Kizoxy",
    botAvatarUrl = "",
    content = "",
    imageUrl = "",
    embed = null, // { title, description, imageUrl, color, footer }
    memberCache = null
  } = options;

  const formatContent = (text) => {
    if (!text) return "";
    let formatted = esc(text);
    formatted = formatted.replace(/&lt;@(\d+)&gt;/g, (match, id) => {
      const name = memberCache && typeof memberCache.get === "function"
        ? memberCache.get(id)
        : null;
      const label = name ? esc(name) : id;
      return `<span class="discord-preview-mention" data-id="${id}">@${label}</span>`;
    });
    return formatted;
  };

  const getEmbedColor = (col) => {
    if (!col) return "var(--accent)";
    if (col.startsWith("#")) return col;
    if (col.startsWith("var(")) return col;
    return `#${col}`;
  };

  const hasContent = !!content && content !== "(empty message content)";
  const hasEmbed = !!embed;
  const hasPlainImage = !embed && !!imageUrl;

  const embedHtml = hasEmbed ? `
    <div class="discord-preview-embed" style="border-left-color: ${getEmbedColor(embed.color)}">
      ${embed.title ? `<div class="discord-preview-embed-title">${formatContent(embed.title)}</div>` : ""}
      <div class="discord-preview-embed-desc">${formatContent(embed.description)}</div>
      ${embed.imageUrl ? `<img src="${esc(embed.imageUrl)}" class="discord-preview-image" onerror="this.style.display='none'">` : ""}
      <div class="discord-preview-embed-footer">
        <span>${esc(embed.footer || "Sent from Web Dashboard")}</span>
        <span>•</span>
        <span>Today at 12:00 PM</span>
      </div>
    </div>
  ` : "";

  const plainImageHtml = hasPlainImage ? `
    <img src="${esc(imageUrl)}" class="discord-preview-image" onerror="this.style.display='none'">
  ` : "";

  mountEl.innerHTML = `
    <div class="discord-preview-container">
      <div style="display:flex; gap:16px;">
        <img class="discord-preview-avatar" src="${esc(botAvatarUrl)}" onerror="this.style.display='none'">
        <div style="flex:1;">
          <div class="discord-preview-header">
            <span class="discord-preview-botname">${esc(botName)}</span>
            <span class="discord-preview-botbadge">BOT</span>
            <span class="discord-preview-timestamp">Today at 12:00 PM</span>
          </div>
          ${hasContent ? `<div class="discord-preview-text">${formatContent(content)}</div>` : ""}
          ${embedHtml}
          ${plainImageHtml}
        </div>
      </div>
    </div>
  `;
};
