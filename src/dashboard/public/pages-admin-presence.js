/* ═══════════════════════════════════════════════════════════════════
   Kizoxy Dashboard — pages-admin-presence.js (Bot Presence Editor)
   ═══════════════════════════════════════════════════════════════════ */

function renderPresenceCard(container, metaData) {
  const typeNum = metaData.presence_activity_type;
  let activityTypeMapped = "playing";
  if (typeNum === 2) activityTypeMapped = "listening";
  else if (typeNum === 3) activityTypeMapped = "watching";
  else if (typeNum === 5) activityTypeMapped = "competing";

  const badgeHtml = metaData.rotation_paused
    ? '<span class="badge badge--yellow">✋ Manually set</span>'
    : '<span class="badge badge--green">⟳ Auto-rotating</span>';

  container.innerHTML = `
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
  `;

  // Bind handlers
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
}
