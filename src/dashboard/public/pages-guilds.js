/* ═══════════════════════════════════════════════════════════════════
   Kizoxy Dashboard — pages-guilds.js (Guilds List Page)
   ═══════════════════════════════════════════════════════════════════ */

async function renderGuilds() {
  const content = document.getElementById("content");
  content.innerHTML = '<div class="skeleton" style="height:300px"></div>';

  try {
    const guilds = await api.get("/guilds");
    state.guilds = guilds;

    const featureBadges = (fc) => {
      const b = [];
      if (fc.youtube)
        b.push(`<span class="badge badge--red">yt-${fc.youtube}</span>`);
      if (fc.tiktok)
        b.push(`<span class="badge badge--accent">tt-${fc.tiktok}</span>`);
      if (fc.alarms)
        b.push(`<span class="badge badge--yellow">alarm-${fc.alarms}</span>`);
      if (fc.tempvc)
        b.push(`<span class="badge badge--green">vc-${fc.tempvc}</span>`);
      return b.join(" ") || '<span class="badge badge--grey">none</span>';
    };

    content.innerHTML = `
      <div style="margin-bottom:12px"><input class="search-input" id="guild-search" placeholder="Search guilds..." oninput="filterGuildTable()"></div>
      <div class="card" style="padding:0;overflow:hidden">
        <table class="table" id="guild-table">
          <thead><tr><th></th><th>Name</th><th>Members</th><th>Features</th><th></th></tr></thead>
          <tbody>${guilds
            .map(
              (g) => `
            <tr data-name="${esc(g.name.toLowerCase())}">
              <td>${guildIconHtml(g.icon, g.name)}</td>
              <td>${esc(g.name)}</td>
              <td>${g.memberCount.toLocaleString()}</td>
              <td>${featureBadges(g.feature_counts)}</td>
              <td><button class="btn btn--ghost btn--sm" onclick="location.hash='#guild/${g.id}'">Settings</button></td>
            </tr>`,
            )
            .join("")}</tbody>
        </table>
      </div>`;
  } catch {
    content.innerHTML =
      '<div class="card" style="color:var(--red)">Failed to load guilds.</div>';
  }
}

function filterGuildTable() {
  const q = document.getElementById("guild-search").value.toLowerCase();
  document.querySelectorAll("#guild-table tbody tr").forEach((row) => {
    row.style.display = row.dataset.name.includes(q) ? "" : "none";
  });
}
