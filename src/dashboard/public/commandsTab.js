let commandsList = [];
let commandsSearchQuery = "";
let commandsActiveCategory = "All";
let commandsActiveType = "Slash";

async function renderCommands() {
  const content = document.getElementById("content");
  content.innerHTML = '<div class="skeleton" style="height:400px"></div>';

  try {
    commandsList = await api.get("/commands");
    renderCommandsLayout(content);
  } catch (err) {
    content.innerHTML =
      '<div class="card" style="color:var(--red)">Failed to load commands.</div>';
  }
}

window.switchCommandsType = function (type, el) {
  commandsActiveType = type;
  commandsActiveCategory = "All";
  document.querySelectorAll("#commands-subtabs .tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.type === type);
  });
  renderCommandsLayout(document.getElementById("content"));
};

function renderCommandsLayout(container) {
  const categories = [
    "All",
    ...new Set(
      commandsList
        .filter((c) => c.type === commandsActiveType)
        .map((c) => c.category),
    ),
  ];

  container.innerHTML = `
    <div class="tabs" id="commands-subtabs" style="margin-bottom:16px;">
      <div class="tab ${commandsActiveType === "Slash" ? "active" : ""}" data-type="Slash" onclick="switchCommandsType('Slash', this)">Slash Commands</div>
      <div class="tab ${commandsActiveType === "Prefix" ? "active" : ""}" data-type="Prefix" onclick="switchCommandsType('Prefix', this)">Prefix Commands</div>
    </div>

    <div class="card" style="margin-bottom:16px; display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
      <input class="search-input" id="cmd-search" placeholder="Search ${commandsActiveType.toLowerCase()} commands..." value="${escAttr(commandsSearchQuery)}" oninput="filterCommandsList()" style="width:240px">
      <div style="display:flex; gap:6px; flex-wrap:wrap;" id="cmd-category-filters">
        ${categories
          .map(
            (cat) =>
              `<button class="btn ${cat === commandsActiveCategory ? "btn--primary" : "btn--ghost"} btn--sm" onclick="filterCommandsByCategory('${escAttr(cat)}', this)">${esc(cat)}</button>`,
          )
          .join("")}
      </div>
    </div>
    <div class="card" style="padding:0; overflow-x:auto">
      <table class="table" id="commands-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Original Name</th>
            <th>Description</th>
            <th>Type</th>
            <th>Category</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="commands-tbody">
          ${renderCommandsRows(commandsList)}
        </tbody>
      </table>
    </div>`;
}

function renderCommandsRows(list) {
  const filtered = list.filter((c) => {
    const matchesType = c.type === commandsActiveType;
    const matchesSearch =
      c.name.toLowerCase().includes(commandsSearchQuery) ||
      c.originalDescription.toLowerCase().includes(commandsSearchQuery) ||
      c.description.toLowerCase().includes(commandsSearchQuery);
    const matchesCategory =
      commandsActiveCategory === "All" || c.category === commandsActiveCategory;
    return matchesSearch && matchesCategory && matchesType;
  });

  if (filtered.length === 0) {
    return '<tr><td colspan="6" style="color:var(--text-3); padding:16px; text-align:center;">No commands found.</td></tr>';
  }

  return filtered
    .map(
      (c) => `
    <tr id="cmd-row-${escAttr(c.name)}">
      <td style="font-weight:600">${esc(c.displayName)}</td>
      <td style="font-family:var(--font-mono); font-size:12px; color:var(--text-3)">${esc(c.name)}</td>
      <td>${esc(c.description)}</td>
      <td><span class="badge ${c.type === "Slash" ? "badge--accent" : "badge--green"}">${esc(c.type)}</span></td>
      <td><span class="badge badge--grey">${esc(c.category)}</span></td>
      <td>
        <button class="btn btn--ghost btn--sm" onclick="toggleCommandEdit('${escAttr(c.name)}')">Edit</button>
      </td>
    </tr>
    <tr id="cmd-edit-${escAttr(c.name)}" style="display:none">
      <td colspan="6" style="background:var(--bg-mid)">
        <div class="form-row" style="display:flex; gap:12px; margin-bottom:8px">
          <div class="form-group" style="flex:1">
            <label style="display:block; margin-bottom:4px; font-size:12px; color:var(--text-2)">Display Name</label>
            <input class="input" id="cmd-edit-display-${escAttr(c.name)}" value="${escAttr(c.displayName)}" style="width:100%">
          </div>
          <div class="form-group" style="flex:2">
            <label style="display:block; margin-bottom:4px; font-size:12px; color:var(--text-2)">Description</label>
            <input class="input" id="cmd-edit-desc-${escAttr(c.name)}" value="${escAttr(c.description)}" style="width:100%">
          </div>
        </div>
        <div style="display:flex; gap:8px">
          <button class="btn btn--primary btn--sm" onclick="saveCommandEdit('${escAttr(c.name)}')">Save</button>
          ${
            c.hasCustomization
              ? `<button class="btn btn--danger btn--sm" onclick="deleteCommandCustomization('${escAttr(c.name)}')">Reset to Default</button>`
              : ""
          }
          <button class="btn btn--ghost btn--sm" onclick="toggleCommandEdit('${escAttr(c.name)}')">Cancel</button>
        </div>
      </td>
    </tr>`,
    )
    .join("");
}

function filterCommandsList() {
  commandsSearchQuery = document
    .getElementById("cmd-search")
    .value.toLowerCase()
    .trim();
  document.getElementById("commands-tbody").innerHTML =
    renderCommandsRows(commandsList);
}

function filterCommandsByCategory(cat, btn) {
  commandsActiveCategory = cat;
  document.querySelectorAll("#cmd-category-filters button").forEach((b) => {
    b.className = "btn btn--ghost btn--sm";
  });
  btn.className = "btn btn--primary btn--sm";
  document.getElementById("commands-tbody").innerHTML =
    renderCommandsRows(commandsList);
}

function toggleCommandEdit(name) {
  const editRow = document.getElementById(`cmd-edit-${name}`);
  if (editRow) {
    editRow.style.display =
      editRow.style.display === "none" ? "table-row" : "none";
  }
}

async function saveCommandEdit(name) {
  const displayName = document
    .getElementById(`cmd-edit-display-${name}`)
    .value.trim();
  const description = document
    .getElementById(`cmd-edit-desc-${name}`)
    .value.trim();

  if (!displayName || !description) {
    showToast("Display name and description cannot be empty", "error");
    return;
  }

  try {
    const result = await api.patch(`/commands/${encodeURIComponent(name)}`, {
      displayName,
      description,
    });

    const cmd = commandsList.find((c) => c.name === name);
    if (cmd) {
      cmd.displayName = result.displayName || cmd.name;
      cmd.description = result.description || cmd.originalDescription;
      cmd.hasCustomization = true;
    }

    showToast("Command customization saved", "success");
    renderCommandsLayout(document.getElementById("content"));
  } catch (err) {
    showToast("Failed to save command customization", "error");
  }
}

async function deleteCommandCustomization(name) {
  try {
    await api.del(`/commands/${encodeURIComponent(name)}`);

    const cmd = commandsList.find((c) => c.name === name);
    if (cmd) {
      cmd.displayName = cmd.name;
      cmd.description = cmd.originalDescription;
      cmd.hasCustomization = false;
    }

    showToast("Command customization reset to default", "success");
    renderCommandsLayout(document.getElementById("content"));
  } catch (err) {
    showToast("Failed to reset command customization", "error");
  }
}
