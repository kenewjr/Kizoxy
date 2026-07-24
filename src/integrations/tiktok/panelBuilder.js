const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");
const Embeds = require("../../lib/embeds");

function buildTtListEmbed(client, subs, page, totalPages, searchQuery = null) {
  const startIdx = page * 5;
  const pageSubs = subs.slice(startIdx, startIdx + 5);

  const fields = pageSubs.map((sub, i) => {
    const types =
      [
        sub.notify_videos !== false &&
          sub.notifyVideos !== false &&
          "🎥 Videos",
        sub.notify_live !== false && sub.notifyLive !== false && "🔴 Live",
      ]
        .filter(Boolean)
        .join(" · ") || "*(all disabled)*";

    const announceId = sub.announce_channel_id ?? sub.discordChannelId;
    const ch = announceId ? `<#${announceId}>` : "*(no channel set)*";
    const username = sub.username ?? sub.tiktokUserId;

    return {
      name: `${startIdx + i + 1}. @${username}`,
      value: `Channel → ${ch}\nNotify → ${types}${sub.custom_message || sub.customMessage ? "\nCustom message set ✏️" : ""}`,
      inline: false,
    };
  });

  return Embeds.info(client, {
    title: "🎵 TikTok Subscriptions",
    description:
      subs.length === 0
        ? searchQuery
          ? `No subscriptions matching "**${searchQuery}**" found.`
          : "No subscriptions yet. Click **➕ Add** to subscribe to a TikTok account."
        : `${subs.length} subscription${subs.length !== 1 ? "s" : ""} in this server.${searchQuery ? ` (Filtered by: "**${searchQuery}**")` : ""}`,
    fields,
    footer: totalPages > 1 ? `Page ${page + 1} of ${totalPages}` : null,
  });
}

function buildTtListRows(subs, page, totalPages, pageSize, searchQuery = null) {
  const rows = [];

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tiktok_panel:add")
      .setLabel("➕ Add")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`tiktok_panel:page:${page - 1}`)
      .setLabel("◀")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId("tiktok_panel:page_indicator")
      .setLabel(`${page + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`tiktok_panel:page:${page + 1}`)
      .setLabel("▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId("tiktok_panel:refresh")
      .setLabel("🔄")
      .setStyle(ButtonStyle.Secondary),
  );
  rows.push(navRow);

  const pageSubs = subs.slice(page * pageSize, (page + 1) * pageSize);
  if (pageSubs.length > 0) {
    const editRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("tiktok_panel:select_action")
        .setPlaceholder("Select a subscription to edit or remove...")
        .addOptions(
          pageSubs.flatMap((sub) => {
            const name = sub.username ?? sub.tiktokUserId ?? "Unknown Account";
            const id = sub.id ?? sub.username;
            const announceId = sub.announce_channel_id ?? sub.discordChannelId;
            return [
              {
                label: `✏️ Edit: @${name.slice(0, 40)}`,
                value: `edit:${id}`,
                description: announceId ? `→ #${announceId}` : "No channel set",
              },
              {
                label: `🗑️ Remove: @${name.slice(0, 38)}`,
                value: `remove:${id}`,
                description: "Remove this subscription permanently",
              },
            ];
          }),
        ),
    );
    rows.push(editRow);
  }

  // Row 3: Search controls
  const searchRow = new ActionRowBuilder();
  searchRow.addComponents(
    new ButtonBuilder()
      .setCustomId("tiktok_panel:search_start")
      .setLabel("🔍 Search")
      .setStyle(ButtonStyle.Secondary),
  );
  if (searchQuery) {
    searchRow.addComponents(
      new ButtonBuilder()
        .setCustomId("tiktok_panel:search_clear")
        .setLabel("❌ Clear")
        .setStyle(ButtonStyle.Danger),
    );
  }
  rows.push(searchRow);

  return rows;
}

function buildTtConfigEmbed(client, pending, isEdit) {
  const ch = pending.announceChannelId
    ? `<#${pending.announceChannelId}>`
    : "*(not set — required before saving)*";

  const types = [
    ["🎥 Videos", pending.notifyVideos],
    ["🔴 Live", pending.notifyLive],
  ]
    .map(([name, on]) => (on ? `✅ ${name}` : `❌ ~~${name}~~`))
    .join("\n");

  return Embeds.info(client, {
    title: `🎵 ${isEdit ? "Edit" : "Add"} TikTok Subscription`,
    fields: [
      { name: "Account", value: `@${pending.username}`, inline: true },
      { name: "Announce to", value: ch, inline: true },
      { name: "Notify for", value: types, inline: false },
      {
        name: "Custom Message",
        value: pending.customMessage
          ? `\`\`\`${pending.customMessage.slice(0, 200)}\`\`\``
          : "*(using default format)*",
        inline: false,
      },
    ],
    footer: "Set all options then click Save.",
  });
}

function buildTtConfigRows(pending) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tiktok_panel:set_channel")
      .setLabel("📢 Set Channel")
      .setStyle(
        pending.announceChannelId ? ButtonStyle.Secondary : ButtonStyle.Primary,
      ),
    new ButtonBuilder()
      .setCustomId("tiktok_panel:toggle_types")
      .setLabel("🔔 Notify Types")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("tiktok_panel:custom_msg")
      .setLabel(pending.customMessage ? "✏️ Edit Message" : "✏️ Custom Message")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("tiktok_panel:clear_msg")
      .setLabel("🗑️ Clear Message")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!pending.customMessage),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tiktok_panel:save")
      .setLabel(pending.editSubId ? "💾 Save Changes" : "✅ Add Subscription")
      .setStyle(ButtonStyle.Success)
      .setDisabled(!pending.announceChannelId),
    new ButtonBuilder()
      .setCustomId("tiktok_panel:cancel")
      .setLabel("❌ Cancel")
      .setStyle(ButtonStyle.Danger),
  );

  if (pending.editSubId) {
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`tiktok_panel:status:${pending.editSubId}`)
        .setLabel("🔍 Check Status")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`tiktok_panel:test:${pending.editSubId}`)
        .setLabel("⚡ Test Delivery")
        .setStyle(ButtonStyle.Secondary),
    );
    return [row1, row2, row3];
  }

  return [row1, row2];
}

module.exports = {
  buildTtListEmbed,
  buildTtListRows,
  buildTtConfigEmbed,
  buildTtConfigRows,
};
