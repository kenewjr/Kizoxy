const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelType,
} = require("discord.js");
const fixembedStorage = require("../../../persistence/fixembedStorage");
const Embeds = require("../../../lib/embeds");

function buildIgnoresEmbed(client, guildId) {
  const s = fixembedStorage.getSettings(guildId);
  return Embeds.brand(client, {
    title: "🛡️ FixEmbed Ignore Lists",
    description:
      "Manage specific users, channels, roles, domains, or keywords that FixEmbed should skip.",
    fields: [
      {
        name: "📢 Ignored Channels",
        value: `${s.ignoredChannels?.length || 0} channels.`,
        inline: true,
      },
      {
        name: "👤 Ignored Users",
        value: `${s.ignoredUsers?.length || 0} users.`,
        inline: true,
      },
      {
        name: "🛡️ Ignored Roles",
        value: `${s.ignoredRoles?.length || 0} roles.`,
        inline: true,
      },
      {
        name: "🌐 Ignored Domains",
        value: `${s.ignoredDomains?.length || 0} domains.`,
        inline: true,
      },
      {
        name: "🔑 Ignored Keywords",
        value: `${s.ignoredKeywords?.length || 0} keywords.`,
        inline: true,
      },
    ],
  });
}

function buildIgnoresComponents() {
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("fixembed_panel:select_ignore_list")
      .setPlaceholder("Choose a list to manage...")
      .addOptions([
        { label: "📢 Channels", value: "channels" },
        { label: "👤 Users", value: "users" },
        { label: "🛡️ Roles", value: "roles" },
        { label: "🌐 Domains", value: "domains" },
        { label: "🔑 Keywords", value: "keywords" },
        { label: "🔙 Back to Main Settings", value: "back" },
      ]),
  );
  return [row];
}

function buildIgnoreListEmbed(client, guildId, field, label) {
  const s = fixembedStorage.getSettings(guildId);
  const items = s[field] || [];
  let description = `Manage currently ignored **${label}**.\n\n`;

  if (items.length === 0) {
    description += `*(No items currently ignored)*`;
  } else {
    description += items
      .map((item, idx) => {
        let display = item;
        if (field === "ignoredChannels") display = `<#${item}>`;
        if (field === "ignoredUsers") display = `<@${item}>`;
        if (field === "ignoredRoles") display = `<@&${item}>`;
        return `${idx + 1}. ${display}`;
      })
      .join("\n");
  }

  return Embeds.brand(client, {
    title: `🛡️ Ignore List: ${label}`,
    description,
  });
}

function buildIgnoreListComponents(guildId, field, type) {
  const s = fixembedStorage.getSettings(guildId);
  const items = s[field] || [];
  const rows = [];

  if (type === "channel") {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("fixembed_panel:add_channel")
          .setPlaceholder("Select a channel to ignore...")
          .addChannelTypes(
            ChannelType.GuildText,
            ChannelType.GuildAnnouncement,
          ),
      ),
    );
  } else if (type === "user") {
    rows.push(
      new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId("fixembed_panel:add_user")
          .setPlaceholder("Select a user to ignore..."),
      ),
    );
  } else if (type === "role") {
    rows.push(
      new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId("fixembed_panel:add_role")
          .setPlaceholder("Select a role to ignore..."),
      ),
    );
  } else {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`fixembed_panel:add_${type}_btn`)
          .setLabel(`➕ Add ${type === "domain" ? "Domain" : "Keyword"}`)
          .setStyle(ButtonStyle.Primary),
      ),
    );
  }

  if (items.length > 0) {
    const options = items.slice(0, 25).map((item) => {
      let label = item;
      if (field === "ignoredChannels") label = `Channel ID: ${item}`;
      if (field === "ignoredUsers") label = `User ID: ${item}`;
      if (field === "ignoredRoles") label = `Role ID: ${item}`;
      return {
        label: label.slice(0, 100),
        value: item,
      };
    });

    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`fixembed_panel:remove_${type}`)
          .setPlaceholder(`Select an item to remove...`)
          .addOptions(options),
      ),
    );
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("fixembed_panel:back_to_ignores")
        .setLabel("🔙 Back to Lists")
        .setStyle(ButtonStyle.Secondary),
    ),
  );

  return rows;
}

module.exports = {
  buildIgnoresEmbed,
  buildIgnoresComponents,
  buildIgnoreListEmbed,
  buildIgnoreListComponents,
};
