const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");
const fixembedStorage = require("../../persistence/fixembedStorage");
const Logger = require("../../lib/logger");
const { replySuccess } = require("../../lib/interactions");
const {
  buildMainEmbed,
  buildMainComponents,
} = require("./panelBuilders/mainBuilder");
const {
  buildIgnoresEmbed,
  buildIgnoresComponents,
  buildIgnoreListEmbed,
  buildIgnoreListComponents,
} = require("./panelBuilders/ignoresBuilder");
const {
  buildPlatformsMainEmbed,
  buildPlatformsMainComponents,
  buildPlatformsGroupEmbed,
  buildPlatformsGroupComponents,
  buildPlatformDetailEmbed,
  buildPlatformDetailComponents,
} = require("./panelBuilders/platformsBuilder");

const logger = new Logger("FIXEMBED_ACTIONS");

function cleanStates(pendingStates) {
  for (const [key, val] of pendingStates.entries()) {
    if (Date.now() > val.expiresAt) pendingStates.delete(key);
  }
}

function getOrCreateState(pendingStates, userId, guildId) {
  const key = `${userId}:${guildId}`;
  cleanStates(pendingStates);
  if (!pendingStates.has(key)) {
    pendingStates.set(key, {
      page: "main",
      selectedPlatform: null,
      selectedGroup: null,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
  }
  const s = pendingStates.get(key);
  s.expiresAt = Date.now() + 5 * 60 * 1000;
  return s;
}

async function updateScreen(interaction, client, pendingStates) {
  const stateObj = getOrCreateState(
    pendingStates,
    interaction.user.id,
    interaction.guildId,
  );
  let embed, components;

  switch (stateObj.page) {
    case "main":
      embed = buildMainEmbed(client, interaction.guildId);
      components = buildMainComponents(interaction.guildId);
      break;
    case "ignores":
      embed = buildIgnoresEmbed(client, interaction.guildId);
      components = buildIgnoresComponents();
      break;
    case "ignore_channels":
      embed = buildIgnoreListEmbed(
        client,
        interaction.guildId,
        "ignoredChannels",
        "Channels",
      );
      components = buildIgnoreListComponents(
        interaction.guildId,
        "ignoredChannels",
        "channel",
      );
      break;
    case "ignore_users":
      embed = buildIgnoreListEmbed(
        client,
        interaction.guildId,
        "ignoredUsers",
        "Users",
      );
      components = buildIgnoreListComponents(
        interaction.guildId,
        "ignoredUsers",
        "user",
      );
      break;
    case "ignore_roles":
      embed = buildIgnoreListEmbed(
        client,
        interaction.guildId,
        "ignoredRoles",
        "Roles",
      );
      components = buildIgnoreListComponents(
        interaction.guildId,
        "ignoredRoles",
        "role",
      );
      break;
    case "ignore_domains":
      embed = buildIgnoreListEmbed(
        client,
        interaction.guildId,
        "ignoredDomains",
        "Domains",
      );
      components = buildIgnoreListComponents(
        interaction.guildId,
        "ignoredDomains",
        "domain",
      );
      break;
    case "ignore_keywords":
      embed = buildIgnoreListEmbed(
        client,
        interaction.guildId,
        "ignoredKeywords",
        "Keywords",
      );
      components = buildIgnoreListComponents(
        interaction.guildId,
        "ignoredKeywords",
        "keyword",
      );
      break;
    case "platforms":
      embed = buildPlatformsMainEmbed(client, interaction.guildId);
      components = buildPlatformsMainComponents();
      break;
    case "platforms_group":
      embed = buildPlatformsGroupEmbed(
        client,
        interaction.guildId,
        stateObj.selectedGroup,
      );
      components = buildPlatformsGroupComponents(
        interaction.guildId,
        stateObj.selectedGroup,
      );
      break;
    case "platform_detail":
      embed = buildPlatformDetailEmbed(
        client,
        interaction.guildId,
        stateObj.selectedPlatform,
      );
      components = buildPlatformDetailComponents(
        interaction.guildId,
        stateObj.selectedPlatform,
      );
      break;
  }
  const { safeReply } = require("../../lib/interactions");
  await safeReply(interaction, { embeds: [embed], components });
}

async function handleToggleEnabled(interaction, client, pendingStates) {
  const s = fixembedStorage.getSettings(interaction.guildId);
  fixembedStorage.setEnabled(interaction.guildId, !s.enabled);
  return updateScreen(interaction, client, pendingStates);
}

async function handleToggleBehavior(interaction, client, pendingStates) {
  const s = fixembedStorage.getSettings(interaction.guildId);
  const cycle = { suppress: "delete", delete: "none", none: "suppress" };
  const next = cycle[s.deleteBehavior] || "suppress";
  fixembedStorage.saveSettings(interaction.guildId, { deleteBehavior: next });
  return updateScreen(interaction, client, pendingStates);
}

async function handleToggleSpoiler(interaction, client, pendingStates) {
  const s = fixembedStorage.getSettings(interaction.guildId);
  fixembedStorage.saveSettings(interaction.guildId, {
    spoilerPassthrough: !s.spoilerPassthrough,
  });
  return updateScreen(interaction, client, pendingStates);
}

async function handleViewIgnores(interaction, client, pendingStates) {
  const stateObj = getOrCreateState(
    pendingStates,
    interaction.user.id,
    interaction.guildId,
  );
  stateObj.page = "ignores";
  return updateScreen(interaction, client, pendingStates);
}

async function handleSelectIgnoreList(interaction, client, pendingStates) {
  const stateObj = getOrCreateState(
    pendingStates,
    interaction.user.id,
    interaction.guildId,
  );
  const val = interaction.values[0];
  stateObj.page = val === "back" ? "main" : `ignore_${val}`;
  return updateScreen(interaction, client, pendingStates);
}

async function handleAddChannel(interaction, client, pendingStates) {
  const channelId = interaction.values[0];
  const s = fixembedStorage.getSettings(interaction.guildId);
  if (!s.ignoredChannels.includes(channelId)) {
    s.ignoredChannels.push(channelId);
    fixembedStorage.saveSettings(interaction.guildId, {
      ignoredChannels: s.ignoredChannels,
    });
  }
  return updateScreen(interaction, client, pendingStates);
}

async function handleAddUser(interaction, client, pendingStates) {
  const userId = interaction.values[0];
  const s = fixembedStorage.getSettings(interaction.guildId);
  if (!s.ignoredUsers.includes(userId)) {
    s.ignoredUsers.push(userId);
    fixembedStorage.saveSettings(interaction.guildId, {
      ignoredUsers: s.ignoredUsers,
    });
  }
  return updateScreen(interaction, client, pendingStates);
}

async function handleAddRole(interaction, client, pendingStates) {
  const roleId = interaction.values[0];
  const s = fixembedStorage.getSettings(interaction.guildId);
  if (!s.ignoredRoles.includes(roleId)) {
    s.ignoredRoles.push(roleId);
    fixembedStorage.saveSettings(interaction.guildId, {
      ignoredRoles: s.ignoredRoles,
    });
  }
  return updateScreen(interaction, client, pendingStates);
}

async function handleRemoveChannelUserRole(interaction, client, pendingStates) {
  const val = interaction.values[0];
  const customId = interaction.customId;
  const field = customId.includes("channel")
    ? "ignoredChannels"
    : customId.includes("user")
      ? "ignoredUsers"
      : "ignoredRoles";
  const s = fixembedStorage.getSettings(interaction.guildId);
  const updatedList = s[field].filter((x) => x !== val);
  fixembedStorage.saveSettings(interaction.guildId, { [field]: updatedList });
  return updateScreen(interaction, client, pendingStates);
}

async function handleAddDomainKeywordBtn(interaction, client, type) {
  const modal = new ModalBuilder()
    .setCustomId(`fixembed_panel:add_${type}_modal`)
    .setTitle(`Add Ignored ${type === "domain" ? "Domain" : "Keyword"}`);
  const input = new TextInputBuilder()
    .setCustomId("input_value")
    .setLabel(type === "domain" ? "Domain pattern" : "Keyword")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(type === "domain" ? "nitter.poast.org" : "bypass")
    .setRequired(true)
    .setMaxLength(100);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

async function handleAddDomainKeywordModal(interaction, client, type) {
  await interaction.deferReply({ ephemeral: true });
  const val = interaction.fields.getTextInputValue("input_value").trim();
  const field = type === "domain" ? "ignoredDomains" : "ignoredKeywords";
  if (val) {
    const s = fixembedStorage.getSettings(interaction.guildId);
    if (!s[field].includes(val)) {
      s[field].push(val);
      fixembedStorage.saveSettings(interaction.guildId, { [field]: s[field] });
    }
  }
  const embed = buildIgnoreListEmbed(
    client,
    interaction.guildId,
    field,
    type === "domain" ? "Domains" : "Keywords",
  );
  const components = buildIgnoreListComponents(
    interaction.guildId,
    field,
    type,
  );
  await replySuccess(interaction, `Added ignored ${type}.`);
  try {
    await interaction.message?.edit({ embeds: [embed], components });
  } catch (err) {
    logger.error(`Error editing message: ${err.message}`);
  }
}

async function handleRemoveDomainKeyword(
  interaction,
  client,
  pendingStates,
  type,
) {
  const val = interaction.values[0];
  const field = type === "domain" ? "ignoredDomains" : "ignoredKeywords";
  const s = fixembedStorage.getSettings(interaction.guildId);
  const updated = s[field].filter((x) => x !== val);
  fixembedStorage.saveSettings(interaction.guildId, { [field]: updated });
  return updateScreen(interaction, client, pendingStates);
}

async function handleViewPlatforms(interaction, client, pendingStates) {
  const stateObj = getOrCreateState(
    pendingStates,
    interaction.user.id,
    interaction.guildId,
  );
  stateObj.page = "platforms";
  return updateScreen(interaction, client, pendingStates);
}

async function handleSelectPlatformGroup(interaction, client, pendingStates) {
  const stateObj = getOrCreateState(
    pendingStates,
    interaction.user.id,
    interaction.guildId,
  );
  const val = interaction.values[0];
  if (val === "back") {
    stateObj.page = "main";
  } else {
    stateObj.page = "platforms_group";
    stateObj.selectedGroup = val;
  }
  return updateScreen(interaction, client, pendingStates);
}

async function handleSelectPlatform(interaction, client, pendingStates) {
  const stateObj = getOrCreateState(
    pendingStates,
    interaction.user.id,
    interaction.guildId,
  );
  stateObj.page = "platform_detail";
  stateObj.selectedPlatform = interaction.values[0];
  return updateScreen(interaction, client, pendingStates);
}

async function handleTogglePlatform(
  interaction,
  client,
  pendingStates,
  platformKey,
) {
  const stateObj = getOrCreateState(
    pendingStates,
    interaction.user.id,
    interaction.guildId,
  );
  const p = platformKey || stateObj.selectedPlatform;
  const s = fixembedStorage.getSettings(interaction.guildId);
  const cfg = { ...(s.platforms[p] || { enabled: true, viewMode: "normal" }) };
  cfg.enabled = !cfg.enabled;
  fixembedStorage.saveSettings(interaction.guildId, {
    platforms: { [p]: cfg },
  });
  return updateScreen(interaction, client, pendingStates);
}

async function handleSelectViewmode(
  interaction,
  client,
  pendingStates,
  platformKey,
) {
  const stateObj = getOrCreateState(
    pendingStates,
    interaction.user.id,
    interaction.guildId,
  );
  const p = platformKey || stateObj.selectedPlatform;
  const s = fixembedStorage.getSettings(interaction.guildId);
  const cfg = { ...(s.platforms[p] || { enabled: true, viewMode: "normal" }) };
  cfg.viewMode = interaction.values[0];
  fixembedStorage.saveSettings(interaction.guildId, {
    platforms: { [p]: cfg },
  });
  return updateScreen(interaction, client, pendingStates);
}

async function handleBackToIgnores(interaction, client, pendingStates) {
  const stateObj = getOrCreateState(
    pendingStates,
    interaction.user.id,
    interaction.guildId,
  );
  stateObj.page = "ignores";
  return updateScreen(interaction, client, pendingStates);
}

async function handleBackToPlatforms(interaction, client, pendingStates) {
  const stateObj = getOrCreateState(
    pendingStates,
    interaction.user.id,
    interaction.guildId,
  );
  stateObj.page = "platforms";
  return updateScreen(interaction, client, pendingStates);
}

async function handleBackToGroup(
  interaction,
  client,
  pendingStates,
  platformKey,
) {
  const stateObj = getOrCreateState(
    pendingStates,
    interaction.user.id,
    interaction.guildId,
  );
  const p = platformKey || stateObj.selectedPlatform;
  const { PLATFORM_GROUPS } = require("./panelBuilders/meta");
  // Find group key containing this platform
  const group =
    Object.entries(PLATFORM_GROUPS).find(([_, list]) =>
      list.includes(p),
    )?.[0] || "social";
  stateObj.page = "platforms_group";
  stateObj.selectedGroup = group;
  return updateScreen(interaction, client, pendingStates);
}

async function handleReset(interaction, client, pendingStates) {
  fixembedStorage.saveSettings(interaction.guildId, {
    enabled: true,
    deleteBehavior: "suppress",
    spoilerPassthrough: true,
    ignoredChannels: [],
    ignoredDomains: [],
    ignoredUsers: [],
    ignoredRoles: [],
    ignoredKeywords: [],
    platforms: {},
  });
  return updateScreen(interaction, client, pendingStates);
}

module.exports = {
  getOrCreateState,
  updateScreen,
  handleToggleEnabled,
  handleToggleBehavior,
  handleToggleSpoiler,
  handleViewIgnores,
  handleSelectIgnoreList,
  handleAddChannel,
  handleAddUser,
  handleAddRole,
  handleRemoveChannelUserRole,
  handleAddDomainKeywordBtn,
  handleAddDomainKeywordModal,
  handleRemoveDomainKeyword,
  handleViewPlatforms,
  handleSelectPlatformGroup,
  handleSelectPlatform,
  handleTogglePlatform,
  handleSelectViewmode,
  handleBackToIgnores,
  handleBackToPlatforms,
  handleBackToGroup,
  handleReset,
};
