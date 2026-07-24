/* ═══════════════════════════════════════════════════════════════════
   Kizoxy Dashboard — pages-guild-alarms.js (Alarms Tab Renderer)
   ═══════════════════════════════════════════════════════════════════ */

function renderAlarms(el, g) {
  const alarms = g.alarms || [];
  el.innerHTML = `
    <div class="card" style="padding:0;overflow-x:auto">
      <table class="table">
        <thead><tr><th>Next Fire</th><th>Channel ID</th><th>Label</th><th>Recurring</th></tr></thead>
        <tbody>${
          alarms.length
            ? alarms
                .map(
                  (a) => `<tr>
          <td>${a.time ? new Date(a.time).toLocaleString() : "N/A"}</td>
          <td style="font-family:var(--font-mono);font-size:12px">${esc(a.channelId || "")}</td>
          <td>${esc(a.message || a.label || "")}</td>
          <td>${esc(a.recurring || "none")}</td>
        </tr>`,
                )
                .join("")
            : '<tr><td colspan="4" style="color:var(--text-3)">No active alarms.</td></tr>'
        }</tbody>
      </table>
    </div>`;
}
